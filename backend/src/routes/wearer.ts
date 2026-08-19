import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAlert, stopAlert, addLocationUpdate, HttpError } from "../services/alertService";

const router = Router();
router.use(requireAuth, requireRole("WEARER"));

const phoneRegex = /^\+?[0-9]{7,15}$/;

/* ---------- Profile ---------- */

router.get("/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, phone: true, whatsappNumber: true, createdAt: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.put("/profile", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      whatsappNumber: z.string().regex(phoneRegex).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: parsed.data,
    });
    res.json({ user: { id: user.id, name: user.name, whatsappNumber: user.whatsappNumber } });
  } catch (err) {
    next(err);
  }
});

/* ---------- Bluetooth device ---------- */

router.get("/device", async (req, res, next) => {
  try {
    const device = await prisma.bluetoothDevice.findFirst({
      where: { wearerId: req.user!.userId },
      orderBy: { lastConnectedAt: "desc" },
    });
    res.json({ device: device || null });
  } catch (err) {
    next(err);
  }
});

router.post("/device", async (req, res, next) => {
  try {
    const schema = z.object({
      deviceName: z.string().min(1),
      deviceIdentifier: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    // Real connection state comes from the browser's Web Bluetooth API on the
    // client; this endpoint just persists the fact that a connection happened.
    const device = await prisma.bluetoothDevice.upsert({
      where: { id: `${req.user!.userId}:${parsed.data.deviceIdentifier}` },
      create: {
        id: `${req.user!.userId}:${parsed.data.deviceIdentifier}`,
        wearerId: req.user!.userId,
        deviceName: parsed.data.deviceName,
        deviceIdentifier: parsed.data.deviceIdentifier,
        connected: true,
        lastConnectedAt: new Date(),
      },
      update: { connected: true, lastConnectedAt: new Date(), deviceName: parsed.data.deviceName },
    });
    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
});

router.delete("/device", async (req, res, next) => {
  try {
    await prisma.bluetoothDevice.updateMany({
      where: { wearerId: req.user!.userId, connected: true },
      data: { connected: false, lastDisconnectedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- Emergency contacts (max 5) ---------- */

router.get("/contacts", async (req, res, next) => {
  try {
    const contacts = await prisma.emergencyContact.findMany({
      where: { wearerId: req.user!.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required."),
  phone: z.string().regex(phoneRegex, "Enter a valid phone number."),
  whatsappNumber: z.string().regex(phoneRegex, "Enter a valid WhatsApp number."),
  relationship: z.string().min(1, "Relationship is required."),
});

router.post("/contacts", async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const count = await prisma.emergencyContact.count({ where: { wearerId: req.user!.userId } });
    if (count >= 5) {
      return res.status(409).json({ error: "You can add a maximum of 5 emergency contacts." });
    }

    const contact = await prisma.emergencyContact.create({
      data: { ...parsed.data, wearerId: req.user!.userId },
    });
    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
});

router.put("/contacts/:id", async (req, res, next) => {
  try {
    const parsed = contactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const existing = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.wearerId !== req.user!.userId) {
      return res.status(404).json({ error: "Contact not found." });
    }

    const contact = await prisma.emergencyContact.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});

router.delete("/contacts/:id", async (req, res, next) => {
  try {
    const existing = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.wearerId !== req.user!.userId) {
      return res.status(404).json({ error: "Contact not found." });
    }
    await prisma.emergencyContact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- Voice detection settings ---------- */

router.get("/voice-settings", async (req, res, next) => {
  try {
    const settings = await prisma.voiceSetting.upsert({
      where: { wearerId: req.user!.userId },
      create: { wearerId: req.user!.userId },
      update: {},
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put("/voice-settings", async (req, res, next) => {
  try {
    const schema = z.object({
      language: z.string().min(2).optional(),
      keyword: z.string().min(1).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const settings = await prisma.voiceSetting.upsert({
      where: { wearerId: req.user!.userId },
      create: { wearerId: req.user!.userId, ...parsed.data },
      update: parsed.data,
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.post("/voice-settings/detected", async (req, res, next) => {
  try {
    const settings = await prisma.voiceSetting.upsert({
      where: { wearerId: req.user!.userId },
      create: { wearerId: req.user!.userId, detectionCount: 1 },
      update: { detectionCount: { increment: 1 } },
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

/* ---------- Location ---------- */

router.post("/location", async (req, res, next) => {
  try {
    const schema = z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      address: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const location = await prisma.location.create({
      data: { ...parsed.data, wearerId: req.user!.userId },
    });
    res.status(201).json({ location });
  } catch (err) {
    next(err);
  }
});

router.get("/location", async (req, res, next) => {
  try {
    const location = await prisma.location.findFirst({
      where: { wearerId: req.user!.userId },
      orderBy: { timestamp: "desc" },
    });
    res.json({ location: location || null });
  } catch (err) {
    next(err);
  }
});

/* ---------- Alerts (SOS) ---------- */

router.post("/alerts", async (req, res, next) => {
  try {
    const schema = z.object({
      latitude: z.number(),
      longitude: z.number(),
      address: z.string().optional(),
      message: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const alert = await createAlert({ wearerId: req.user!.userId, ...parsed.data });
    res.status(201).json({ alert });
  } catch (err) {
    next(err);
  }
});

router.post("/alerts/:id/stop", async (req, res, next) => {
  try {
    const alert = await stopAlert(req.params.id, req.user!.userId);
    res.json({ alert });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post("/alerts/:id/location", async (req, res, next) => {
  try {
    const schema = z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    await addLocationUpdate(req.params.id, req.user!.userId, parsed.data);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { wearerId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

export default router;
