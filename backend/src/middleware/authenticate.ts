
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Session } from "../models/Session";

export type UserRole = "customer" | "staff" | "admin";

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
}

const SESSION_ACTIVITY_INTERVAL_MS = 60 * 1000;

export const authenticate: RequestHandler = async (req, res, next) => {
  let token = "";
  const authorization = req.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    token = authorization.slice(7).trim();
  } else if (
    typeof req.query.token === "string" &&
    req.query.token.trim()
  ) {
    // Temporary compatibility for existing download endpoints.
    token = req.query.token.trim();
  }

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
      !["customer", "staff", "admin"].includes(decoded.role)
    ) {
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
    }).select("sessionId lastActivityAt");

    if (!activeSession) {
      res.status(401).json({
        success: false,
        message: "Your session is expired or revoked. Please log in again.",
      });
      return;
    }

    // Refresh activity no more than once per 60 seconds.
    const lastActivityAt = activeSession.lastActivityAt;
    const activityCutoff = new Date(
      now.getTime() - SESSION_ACTIVITY_INTERVAL_MS
    );

    if (
      lastActivityAt instanceof Date &&
      lastActivityAt.getTime() <= activityCutoff.getTime()
    ) {
      // The conditional update prevents concurrent requests from
      // repeatedly refreshing the same session at the same time.
      await Session.updateOne(
        {
          sessionId: decoded.sid,
          customerId: decoded.sub,
          role: decoded.role,
          revokedAt: null,
          expiresAt: { $gt: now },
          lastActivityAt: { $lte: activityCutoff },
        },
        {
          $set: { lastActivityAt: now },
        }
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
      res.status(401).json({
        success: false,
        message: "Your token has expired. Please log in again.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
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
  ...allowedRoles: UserRole[]
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

    if (!allowedRoles.includes(user.role)) {
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
