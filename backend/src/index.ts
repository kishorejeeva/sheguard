import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import wearerRoutes from "./routes/wearer";
import guardianRoutes from "./routes/guardian";
import { initSocket } from "./socket";
import { reconcileScheduledAlerts } from "./services/alertService";

const requiredEnv = ["DATABASE_URL", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);
app.use(express.json());

// General API rate limit; auth routes get a stricter one to slow brute force.
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(
  "/api/auth/",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: "Too many attempts, try again later." } })
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/wearer", wearerRoutes);
app.use("/api/guardian", guardianRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Never leak stack traces to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

initSocket(server);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, async () => {
  console.log(`SheGuard backend listening on port ${PORT}`);
  await reconcileScheduledAlerts();
});
