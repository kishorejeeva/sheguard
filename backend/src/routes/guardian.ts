import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("GUARDIAN"));

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
    const schema = z.object({ name: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const user = await prisma.user.update({ where: { id: req.user!.userId }, data: parsed.data });
    res.json({ user: { id: user.id, name: user.name } });
  } catch (err) {
    next(err);
  }
});

/** Guardian must explicitly opt in (active: true) before being considered
 *  for nearby-community alerts — this is never assumed silently. */
router.post("/location", async (req, res, next) => {
  try {
    const schema = z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      active: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const location = await prisma.guardianLocation.upsert({
      where: { guardianId: req.user!.userId },
      create: { guardianId: req.user!.userId, ...parsed.data },
      update: parsed.data,
    });
    res.json({ location });
  } catch (err) {
    next(err);
  }
});

router.get("/alerts/nearby", async (req, res, next) => {
  try {
    // Alerts this guardian was actually escalated to (server-side match,
    // not a client-supplied radius) that are still live.
    const recipientRows = await prisma.alertRecipient.findMany({
      where: { recipientType: "GUARDIAN", recipientId: req.user!.userId },
      include: { alert: true },
      orderBy: { sentAt: "desc" },
      take: 20,
    });

    const alerts = recipientRows
      .map((r: (typeof recipientRows)[number]) => r.alert)
      .filter((a: (typeof recipientRows)[number]["alert"]) => a.status === "ACTIVE" || a.status === "ESCALATED");

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

router.get("/alerts/:id", async (req, res, next) => {
  try {
    const isRecipient = await prisma.alertRecipient.findFirst({
      where: { alertId: req.params.id, recipientType: "GUARDIAN", recipientId: req.user!.userId },
    });
    if (!isRecipient) {
      return res.status(403).json({ error: "You do not have access to this alert." });
    }

    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: { locationLogs: { orderBy: { timestamp: "desc" }, take: 1 } },
    });
    if (!alert) return res.status(404).json({ error: "Alert not found." });

    res.json({ alert });
  } catch (err) {
    next(err);
  }
});

export default router;
