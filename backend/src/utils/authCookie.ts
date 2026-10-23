import type { Response } from "express";

export const AUTH_COOKIE_NAME = "vaultbank_token";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";
const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE || "lax";

if (!["strict", "lax", "none"].includes(configuredSameSite)) {
  throw new Error(
    "AUTH_COOKIE_SAME_SITE must be set to strict, lax, or none."
  );
}

if (configuredSameSite === "none" && !isProduction) {
  throw new Error(
    "AUTH_COOKIE_SAME_SITE=none requires production HTTPS."
  );
}

const sameSite = configuredSameSite as "strict" | "lax" | "none";

export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite,
  path: "/",
  maxAge: SESSION_DURATION_MS,
} as const;

export const clearAuthCookie = (response: Response): void => {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: authCookieOptions.httpOnly,
    secure: authCookieOptions.secure,
    sameSite: authCookieOptions.sameSite,
    path: authCookieOptions.path,
  });
};
