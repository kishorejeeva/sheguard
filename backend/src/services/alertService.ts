import { prisma } from "../utils/prisma";
import { getIO } from "../socket";
import { haversineDistanceKm } from "../utils/haversine";

const ALERT_DELAY_SECONDS = Number(process.env.ALERT_DELAY_SECONDS || 60);
const NEARBY_RADIUS_KM = Number(process.env.NEARBY_GUARDIAN_RADIUS_KM || 5);

// In-memory map of scheduled escalation timers, keyed by alert id.
// On restart, reconcileScheduledAlerts() rebuilds this from DB state so a
// COUNTDOWN alert can never be "lost" by a server restart.
const timers = new Map<string, NodeJS.Timeout>();

const DEFAULT_MESSAGE =
  "Emergency alert from SheGuard. The wearer may be in danger. Please check the live location immediately.";

export async function createAlert(params: {
  wearerId: string;
  latitude: number;
  longitude: number;
  address?: string;
  message?: string;
}) {
  const alert = await prisma.alert.create({
    data: {
      wearerId: params.wearerId,
      status: "COUNTDOWN",
      latitude: params.latitude,
      longitude: params.longitude,
      address: params.address,
      message: params.message || DEFAULT_MESSAGE,
    },
  });

  scheduleEscalation(alert.id, ALERT_DELAY_SECONDS * 1000);

  getIO().to(`user:${params.wearerId}`).emit("alert:created", {
    alertId: alert.id,
    delaySeconds: ALERT_DELAY_SECONDS,
  });

  return alert;
}

export async function stopAlert(alertId: string, wearerId: string) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert || alert.wearerId !== wearerId) {
    throw new HttpError(404, "Alert not found.");
  }
  if (alert.status !== "PENDING" && alert.status !== "COUNTDOWN") {
    throw new HttpError(409, "This alert can no longer be stopped.");
  }

  clearScheduledEscalation(alertId);

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: { status: "STOPPED", stoppedAt: new Date() },
  });

  getIO().to(`user:${wearerId}`).emit("alert:stopped", { alertId });
  return updated;
}

export async function addLocationUpdate(
  alertId: string,
  wearerId: string,
  point: { latitude: number; longitude: number; accuracy?: number }
) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert || alert.wearerId !== wearerId) {
    throw new HttpError(404, "Alert not found.");
  }

  await prisma.$transaction([
    prisma.alertLocationLog.create({
      data: { alertId, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy },
    }),
    prisma.alert.update({
      where: { id: alertId },
      data: { latitude: point.latitude, longitude: point.longitude },
    }),
  ]);

  const payload = { alertId, ...point, timestamp: new Date().toISOString() };
  getIO().to(`alert:${alertId}`).emit("alert:location-update", payload);
}

/** Server-authoritative escalation: fires ALERT_DELAY_SECONDS after alert creation
 *  unless the alert was stopped first. Never trust a client-side timer alone. */
function scheduleEscalation(alertId: string, delayMs: number) {
  const timer = setTimeout(() => {
    escalateAlert(alertId).catch((err) => console.error("Escalation failed:", err));
  }, delayMs);
  timers.set(alertId, timer);
}

function clearScheduledEscalation(alertId: string) {
  const timer = timers.get(alertId);
  if (timer) clearTimeout(timer);
  timers.delete(alertId);
}

async function escalateAlert(alertId: string) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  // Guard against a race where the alert was stopped moments before the timer fired.
  if (!alert || alert.status !== "COUNTDOWN") return;

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: "ESCALATED", escalationStartedAt: new Date() },
  });

  const io = getIO();
  io.to(`user:${alert.wearerId}`).emit("alert:escalated", { alertId });

  // 1) Emergency contacts
  const contacts = await prisma.emergencyContact.findMany({ where: { wearerId: alert.wearerId } });
  for (const contact of contacts) {
    await prisma.alertRecipient.create({
      data: {
        alertId,
        recipientType: "EMERGENCY_CONTACT",
        recipientId: contact.id,
        deliveryStatus: "SENT", // actual SMS/WhatsApp delivery is provider-specific; see README
        sentAt: new Date(),
      },
    });
  }

  // 2) Configured police station + headquarters
  const stations = await prisma.policeStation.findMany({ where: { active: true } });
  const nearestStation = pickNearestStation(
    stations.filter((s) => !s.isHeadquarters),
    alert.latitude,
    alert.longitude
  );
  const headquarters = stations.find((s) => s.isHeadquarters);
  for (const station of [nearestStation, headquarters].filter(Boolean)) {
    await prisma.alertRecipient.create({
      data: {
        alertId,
        recipientType: station!.isHeadquarters ? "POLICE_HEADQUARTERS" : "POLICE_STATION",
        recipientId: station!.id,
        deliveryStatus: "SENT",
        sentAt: new Date(),
      },
    });
  }

  // 3) Guardians within radius who have opted in and shared a recent location
  const nearbyGuardians = await findNearbyGuardians(alert.latitude, alert.longitude);
  for (const g of nearbyGuardians) {
    await prisma.alertRecipient.create({
      data: {
        alertId,
        recipientType: "GUARDIAN",
        recipientId: g.guardianId,
        deliveryStatus: "SENT",
        sentAt: new Date(),
      },
    });
    io.to(`guardian:${g.guardianId}`).emit("guardian:nearby-alert", {
      alertId,
      distanceKm: g.distanceKm,
      latitude: alert.latitude,
      longitude: alert.longitude,
      address: alert.address,
      message: alert.message,
      createdAt: alert.createdAt,
    });
  }

  await prisma.alert.update({ where: { id: alertId }, data: { status: "ACTIVE" } });
  io.to(`user:${alert.wearerId}`).emit("alert:active", { alertId, guardianCount: nearbyGuardians.length });
}

async function findNearbyGuardians(lat: number, lng: number) {
  // Only consider guardians who explicitly opted in (active=true) and have a
  // location on file. A stale cutoff (30 min) keeps "available" meaningful
  // without depending on socket connection state.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const candidates = await prisma.guardianLocation.findMany({
    where: { active: true, updatedAt: { gte: cutoff } },
  });

  return candidates
    .map((c) => ({ ...c, distanceKm: haversineDistanceKm(lat, lng, c.latitude, c.longitude) }))
    .filter((c) => c.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function pickNearestStation<T extends { latitude: number; longitude: number }>(
  stations: T[],
  lat: number,
  lng: number
): (T & { distanceKm: number }) | undefined {
  if (stations.length === 0) return undefined;
  return stations
    .map((s) => ({ ...s, distanceKm: haversineDistanceKm(lat, lng, s.latitude, s.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

/** Call once at server startup: rebuild in-memory timers for any alert that
 *  was mid-countdown when the process last stopped, based on stored createdAt. */
export async function reconcileScheduledAlerts() {
  const pending = await prisma.alert.findMany({ where: { status: "COUNTDOWN" } });
  const delayMs = ALERT_DELAY_SECONDS * 1000;
  for (const alert of pending) {
    const elapsed = Date.now() - alert.createdAt.getTime();
    const remaining = delayMs - elapsed;
    if (remaining <= 0) {
      escalateAlert(alert.id).catch((err) => console.error("Escalation failed:", err));
    } else {
      scheduleEscalation(alert.id, remaining);
    }
  }
  if (pending.length > 0) {
    console.log(`Reconciled ${pending.length} in-progress alert(s) after restart.`);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
