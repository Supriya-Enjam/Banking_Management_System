import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { AUTH_COOKIE_NAME } from "../utils/authCookie";
import { Customer } from "../models/Customer";
import { Session } from "../models/Session";
import { ChatConversation } from "../models/ChatConversation";

const EMPLOYEE_ROLES = ["staff", "management", "admin"] as const;
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_ACTIVITY_INTERVAL_MS = 60 * 1000;

type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
type ChatSocketData = {
  customerId: string;
  sessionId: string;
  role: EmployeeRole;
  name: string;
  lastActivityRefresh: number;
  tokenExpiresAt: number;
};

type VaultBankTokenPayload = {
  sub?: string;
  sid?: string;
  role?: string;
  exp?: number;
};

let io: Server | undefined;
const socketsByEmployee = new Map<string, Set<Socket>>();

function getCookieValue(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return undefined;
}

function getHandshakeToken(socket: Socket): string | undefined {
  const authorization = socket.handshake.headers.authorization;
  const bearer =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : undefined;

  return getCookieValue(socket.handshake.headers.cookie) || bearer;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

async function validateSocketSession(
  socket: Socket,
  refreshActivity = true
): Promise<boolean> {
  const data = socket.data as ChatSocketData;
  const now = new Date();
  if (Date.now() >= data.tokenExpiresAt) return false;
  const session = await Session.findOne({
    sessionId: data.sessionId,
    customerId: data.customerId,
    role: data.role,
    revokedAt: null,
    expiresAt: { $gt: now },
  }).select("lastActivityAt createdAt");

  if (!session) return false;

  const lastActivity = session.lastActivityAt ?? session.createdAt;
  if (now.getTime() - lastActivity.getTime() >= SESSION_IDLE_TIMEOUT_MS) {
    return false;
  }

  const timestamp = Date.now();
  if (
    refreshActivity &&
    timestamp - data.lastActivityRefresh >= SESSION_ACTIVITY_INTERVAL_MS
  ) {
    await Session.updateOne(
      {
        sessionId: data.sessionId,
        customerId: data.customerId,
        role: data.role,
        revokedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { lastActivityAt: now } }
    );
    data.lastActivityRefresh = timestamp;
  }

  const employee = await Customer.exists({
    _id: data.customerId,
    role: data.role,
    status: "active",
  });
  return Boolean(employee);
}

async function canAccessConversation(
  socket: Socket,
  conversationId: string
): Promise<boolean> {
  if (!(await validateSocketSession(socket))) return false;
  const conversation = await ChatConversation.exists({
    _id: conversationId,
    participants: {
      $elemMatch: {
        customerId: socket.data.customerId,
        removedAt: null,
      },
    },
  });
  return Boolean(conversation);
}

export function initializeChatSocketServer(
  server: import("node:http").Server,
  allowedOrigins: string[]
): Server {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    maxHttpBufferSize: 16 * 1024,
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = getHandshakeToken(socket);
      const jwtSecret = process.env.JWT_SECRET;
      if (!token || !jwtSecret || jwtSecret.length < 32) {
        next(new Error("Authentication required."));
        return;
      }

      const decoded = jwt.verify(token, jwtSecret, {
        issuer: "vaultbank-api",
        audience: "vaultbank-client",
        algorithms: ["HS256"],
      }) as VaultBankTokenPayload;

      if (
        typeof decoded.sub !== "string" ||
        typeof decoded.sid !== "string" ||
        typeof decoded.exp !== "number" ||
        !EMPLOYEE_ROLES.includes(decoded.role as EmployeeRole)
      ) {
        next(new Error("Employee access is required."));
        return;
      }

      const now = new Date();
      const [session, employee] = await Promise.all([
        Session.findOne({
          sessionId: decoded.sid,
          customerId: decoded.sub,
          role: decoded.role,
          revokedAt: null,
          expiresAt: { $gt: now },
        }).select("lastActivityAt createdAt"),
        Customer.findById(decoded.sub).select("name role status"),
      ]);

      const lastActivity = session?.lastActivityAt ?? session?.createdAt;
      if (
        !session ||
        !employee ||
        employee.role !== decoded.role ||
        employee.status !== "active" ||
        !lastActivity ||
        now.getTime() - lastActivity.getTime() >= SESSION_IDLE_TIMEOUT_MS
      ) {
        next(new Error("Your session is expired or revoked."));
        return;
      }

      socket.data = {
        customerId: decoded.sub,
        sessionId: decoded.sid,
        role: decoded.role as EmployeeRole,
        name: employee.name,
        lastActivityRefresh: Date.now(),
        tokenExpiresAt: decoded.exp * 1000,
      } satisfies ChatSocketData;
      next();
    } catch {
      next(new Error("Unable to authenticate this connection."));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as ChatSocketData;
    const sessionMonitor = setInterval(() => {
      void validateSocketSession(socket, false)
        .then((valid) => {
          if (!valid) socket.disconnect(true);
        })
        .catch(() => socket.disconnect(true));
    }, SESSION_ACTIVITY_INTERVAL_MS);
    sessionMonitor.unref?.();
    const employeeSockets = socketsByEmployee.get(data.customerId) ?? new Set();
    employeeSockets.add(socket);
    socketsByEmployee.set(data.customerId, employeeSockets);
    socket.join(`employee:${data.customerId}`);

    socket.broadcast.emit("chat:presence", {
      employeeId: data.customerId,
      online: true,
      lastSeenAt: null,
    });
    socket.emit("chat:presence:snapshot", {
      onlineEmployeeIds: [...socketsByEmployee.keys()],
    });
    socket.emit("chat:presence:self", { employeeId: data.customerId });

    socket.on("chat:join", async (payload: unknown, acknowledge?: (result: { ok: boolean }) => void) => {
      const conversationId =
        typeof payload === "object" &&
        payload !== null &&
        "conversationId" in payload &&
        typeof payload.conversationId === "string"
          ? payload.conversationId
          : "";

      if (!conversationId || !(await canAccessConversation(socket, conversationId))) {
        acknowledge?.({ ok: false });
        if (!(await validateSocketSession(socket))) socket.disconnect(true);
        return;
      }

      await socket.join(conversationRoom(conversationId));
      acknowledge?.({ ok: true });
    });

    socket.on("chat:leave", (payload: unknown) => {
      const conversationId =
        typeof payload === "object" &&
        payload !== null &&
        "conversationId" in payload &&
        typeof payload.conversationId === "string"
          ? payload.conversationId
          : "";
      if (conversationId) void socket.leave(conversationRoom(conversationId));
    });

    socket.on(
      "chat:typing",
      async (
        payload: unknown,
        acknowledge?: (result: { ok: boolean }) => void
      ) => {
        const record =
          typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};
        const conversationId =
          typeof record.conversationId === "string"
            ? record.conversationId
            : "";
        const isTyping = record.isTyping === true;

        if (
          !conversationId ||
          !(await canAccessConversation(socket, conversationId))
        ) {
          acknowledge?.({ ok: false });
          if (!(await validateSocketSession(socket))) socket.disconnect(true);
          return;
        }

        socket.to(conversationRoom(conversationId)).emit("chat:typing", {
          conversationId,
          employeeId: data.customerId,
          name: data.name,
          isTyping,
        });
        acknowledge?.({ ok: true });
      }
    );

    socket.on("disconnect", () => {
      clearInterval(sessionMonitor);
      const current = socketsByEmployee.get(data.customerId);
      current?.delete(socket);
      if (current?.size === 0) {
        socketsByEmployee.delete(data.customerId);
        socket.broadcast.emit("chat:presence", {
          employeeId: data.customerId,
          online: false,
          lastSeenAt: new Date().toISOString(),
        });
      }
    });
  });

  return io;
}

export function emitChatEvent(
  conversationId: string,
  eventName: string,
  payload: Record<string, unknown>
): void {
  io?.to(conversationRoom(conversationId)).emit(eventName, payload);
}

export function emitEmployeeEvent(
  employeeId: string,
  eventName: string,
  payload: Record<string, unknown>
): void {
  io?.to(`employee:${employeeId}`).emit(eventName, payload);
}

export function disconnectEmployeeFromConversation(
  employeeId: string,
  conversationId: string
): void {
  for (const socket of socketsByEmployee.get(employeeId) ?? []) {
    void socket.leave(conversationRoom(conversationId));
    socket.emit("chat:membership-removed", { conversationId });
  }
}

export function isEmployeeOnline(employeeId: string): boolean {
  return (socketsByEmployee.get(employeeId)?.size ?? 0) > 0;
}
