import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  customerId: string;
  role: "customer" | "staff" | "admin";
}

declare global {
  namespace Express {
    interface Locals {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  let token = "";
  const authorization = req.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    token = authorization.slice(7).trim();
  } else if (typeof req.query.token === "string" && req.query.token.trim()) {
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
    }) as { sub?: string; role?: string };

    if (
      typeof decoded !== "object" ||
      !decoded ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      !["customer", "staff", "admin"].includes(decoded.role || "")
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    res.locals.authenticatedUser = {
      customerId: decoded.sub,
      role: decoded.role as "customer" | "staff" | "admin",
    };

    next();
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Your token is invalid. Please log in again.",
    });
  }
};

export const requireRoles = (...allowedRoles: Array<"customer" | "staff" | "admin">): RequestHandler => {
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
