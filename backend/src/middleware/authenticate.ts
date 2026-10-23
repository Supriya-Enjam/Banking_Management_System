import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Session } from "../models/Session";
import { AUTH_COOKIE_NAME, clearAuthCookie } from "../utils/authCookie";

export type UserRole = "customer" | "staff" | "management" | "admin";

export interface AuthenticatedUser {
  customerId: string;
  role: UserRole;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Locals {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

interface VaultBankTokenPayload {
  sub?: string;
  role?: string;
  sid?: string;
  exp?: number;
}

const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_ACTIVITY_INTERVAL_MS = 60 * 1000;
const allowedRoles: UserRole[] = [
  "customer",
  "staff",
  "management",
  "admin",
];

export const authenticate: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const cookieToken =
    typeof req.cookies?.[AUTH_COOKIE_NAME] === "string"
      ? req.cookies[AUTH_COOKIE_NAME]
      : "";
  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    console.error("JWT_SECRET is missing or too short.");
    res.status(500).json({
      success: false,
      message: "Authentication is not configured correctly.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "vaultbank-api",
      audience: "vaultbank-client",
      algorithms: ["HS256"],
    }) as VaultBankTokenPayload;

    if (
      !decoded ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      typeof decoded.sid !== "string" ||
      !decoded.sid ||
      typeof decoded.role !== "string" ||
      typeof decoded.exp !== "number" ||
      !allowedRoles.includes(decoded.role as UserRole)
    ) {
      if (cookieToken) clearAuthCookie(res);
      console.warn("JWT payload validation failed:", {
        hasSubject: typeof decoded?.sub === "string" && Boolean(decoded.sub),
        hasSessionId: typeof decoded?.sid === "string" && Boolean(decoded.sid),
        role: decoded?.role,
      });

      res.status(401).json({
        success: false,
        message: "Invalid authentication token. Please log in again.",
      });
      return;
    }

    const now = new Date();
    const activeSession = await Session.findOne({
      sessionId: decoded.sid,
      customerId: decoded.sub,
      role: decoded.role,
      revokedAt: null,
      expiresAt: { $gt: now },
    }).select("sessionId lastActivityAt createdAt");

    if (!activeSession) {
      if (cookieToken) clearAuthCookie(res);
      res.status(401).json({
        success: false,
        message: "Your session is expired or revoked. Please log in again.",
      });
      return;
    }

    const lastActivityTime = activeSession.lastActivityAt
      ? new Date(activeSession.lastActivityAt).getTime()
      : activeSession.createdAt
        ? new Date(activeSession.createdAt).getTime()
        : 0;
    const idleDuration = now.getTime() - lastActivityTime;

    if (
      !Number.isFinite(lastActivityTime) ||
      lastActivityTime <= 0 ||
      idleDuration >= SESSION_IDLE_TIMEOUT_MS
    ) {
      await Session.updateOne(
        {
          sessionId: decoded.sid,
          customerId: decoded.sub,
          role: decoded.role,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { expiresAt: now } }
      );

      if (cookieToken) clearAuthCookie(res);
      res.status(401).json({
        success: false,
        message:
          "Session expired due to 15 minutes of inactivity. Please log in again.",
      });
      return;
    }

    const activityCutoff = new Date(
      now.getTime() - SESSION_ACTIVITY_INTERVAL_MS
    );

    if (
      activeSession.lastActivityAt &&
      new Date(activeSession.lastActivityAt).getTime() <=
        activityCutoff.getTime()
    ) {
      await Session.updateOne(
        {
          sessionId: decoded.sid,
          customerId: decoded.sub,
          role: decoded.role,
          revokedAt: null,
          expiresAt: { $gt: now },
          lastActivityAt: activeSession.lastActivityAt,
        },
        { $set: { lastActivityAt: now } }
      );
    } else if (!activeSession.lastActivityAt) {
      await Session.updateOne(
        {
          sessionId: decoded.sid,
          customerId: decoded.sub,
          role: decoded.role,
          revokedAt: null,
          expiresAt: { $gt: now },
          lastActivityAt: { $exists: false },
        },
        { $set: { lastActivityAt: now } }
      );
    }

    res.locals.authenticatedUser = {
      customerId: decoded.sub,
      role: decoded.role as UserRole,
      sessionId: activeSession.sessionId,
    };

    next();
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      if (cookieToken) clearAuthCookie(res);
      res.status(401).json({
        success: false,
        message: "Your token has expired. Please log in again.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      if (cookieToken) clearAuthCookie(res);
      console.warn("JWT verification failed:", error.name);
      res.status(401).json({
        success: false,
        message: "Your token is invalid. Please log in again.",
      });
      return;
    }

    console.error("Authentication/session validation failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to validate your session. Please try again.",
    });
  }
};

export const requireRoles = (
  ...roles: UserRole[]
): RequestHandler => {
  return (_req, res, next) => {
    const user = res.locals.authenticatedUser;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: You do not have permission (${user.role}) to access this resource.`,
      });
      return;
    }

    next();
  };
};

export default authenticate;
