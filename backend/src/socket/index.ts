import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../middleware/auth";
import { prisma } from "../utils/prisma";

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || "*", credentials: true },
  });

  // Authenticate every socket connection with the same JWT used for REST.
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required."));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired session."));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };

    // Personal room so we can target this exact user.
    socket.join(`user:${userId}`);
    if (role === "GUARDIAN") {
      socket.join(`guardian:${userId}`);
    }

    // Join the room for a specific alert's live-location updates. Only the
    // wearer who owns the alert, or a guardian it was actually escalated to,
    // may subscribe — this is re-checked server-side, never trusted from the client.
    socket.on("alert:subscribe", async (alertId: string) => {
      try {
        const alert = await prisma.alert.findUnique({ where: { id: alertId } });
        if (!alert) return;

        const isOwner = role === "WEARER" && alert.wearerId === userId;
        const isRecipientGuardian =
          role === "GUARDIAN" &&
          (await prisma.alertRecipient.findFirst({
            where: { alertId, recipientType: "GUARDIAN", recipientId: userId },
          }));

        if (isOwner || isRecipientGuardian) {
          socket.join(`alert:${alertId}`);
        }
      } catch (err) {
        console.error("alert:subscribe failed:", err);
      }
    });

    socket.on("disconnect", () => {
      // No-op: presence handling is derived from GuardianLocation.updatedAt
      // rather than socket connection state, so a dropped connection can't
      // silently mark a guardian permanently unavailable.
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized yet.");
  return io;
}
