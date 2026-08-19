import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { signToken, requireAuth } from "../middleware/auth";

const router = Router();

const phoneRegex = /^\+?[0-9]{7,15}$/;

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required."),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number."),
    whatsappNumber: z.string().regex(phoneRegex, "Enter a valid WhatsApp number."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  phone: z.string().regex(phoneRegex, "Enter a valid phone number."),
  password: z.string().min(1, "Password is required."),
});

async function handleSignup(
  role: "WEARER" | "GUARDIAN",
  body: unknown,
  res: import("express").Response
) {
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, phone, whatsappNumber, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return res.status(409).json({ error: "This phone number is already registered." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, phone, whatsappNumber, passwordHash, role },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  });
}

async function handleLogin(
  role: "WEARER" | "GUARDIAN",
  body: unknown,
  res: import("express").Response
) {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { phone, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.role !== role) {
    return res.status(401).json({ error: "Invalid phone number or password." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid phone number or password." });
  }

  const token = signToken({ userId: user.id, role: user.role });
  return res.json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  });
}

router.post("/wearer/signup", (req, res, next) =>
  handleSignup("WEARER", req.body, res).catch(next)
);
router.post("/wearer/login", (req, res, next) =>
  handleLogin("WEARER", req.body, res).catch(next)
);
router.post("/guardian/signup", (req, res, next) =>
  handleSignup("GUARDIAN", req.body, res).catch(next)
);
router.post("/guardian/login", (req, res, next) =>
  handleLogin("GUARDIAN", req.body, res).catch(next)
);

router.post("/logout", requireAuth, (_req, res) => {
  // Stateless JWT: logout is handled client-side by discarding the token.
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, phone: true, whatsappNumber: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
