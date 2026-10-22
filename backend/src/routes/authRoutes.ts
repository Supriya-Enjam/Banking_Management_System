
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "crypto";

import { Session } from "../models/Session";
import { Customer } from "../models/Customer";
import { LoginOtp } from "../models/LoginOtp";
import authenticate from "../middleware/authenticate";
import { firebaseAdminAuth } from "../config/firebaseAdmin";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { sendLoginOtp } from "../services/emailService";

const authRoutes = Router();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const DEMO_STAFF_EMAIL = "staff@vaultbank.com";
const DEMO_MANAGEMENT_EMAIL = "management@vaultbank.com";
const DEMO_ADMIN_EMAIL = "admin@vaultbank.com";

const isDevelopment = process.env.NODE_ENV !== "production";



const isDemoPrivilegedEmail = (email: string): boolean =>
  [
    DEMO_STAFF_EMAIL,
    DEMO_MANAGEMENT_EMAIL,
    DEMO_ADMIN_EMAIL,
  ].includes(email.trim().toLowerCase());

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    password: z.string().min(6).max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const verifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit OTP."),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required."),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(250).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72),
});

// ============================================================
// SECURITY HELPERS
// ============================================================

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
};

const getOtpPepper = (): string => {
  const pepper = process.env.OTP_SECRET;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "OTP_SECRET must be configured with at least 32 characters."
    );
  }

  return pepper;
};

const createVaultBankToken = (
  customer: { id: string; role: string },
  sessionId: string
): string =>
  jwt.sign(
    {
      sub: customer.id,
      role: customer.role,
      sid: sessionId,
    },
    getJwtSecret(),
    {
      expiresIn: "24h",
      issuer: "vaultbank-api",
      audience: "vaultbank-client",
      algorithm: "HS256",
    }
  );

const hashOtp = (challengeId: string, otp: string): string =>
  createHmac("sha256", getOtpPepper())
    .update(`${challengeId}:${otp}`)
    .digest("hex");

const otpMatches = (
  challengeId: string,
  otp: string,
  storedHash: string
): boolean => {
  if (
    typeof storedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  const submitted = Buffer.from(hashOtp(challengeId, otp), "hex");
  const stored = Buffer.from(storedHash, "hex");

  return (
    submitted.length === stored.length &&
    submitted.length > 0 &&
    timingSafeEqual(submitted, stored)
  );
};

const customerResponse = (customer: {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
  kycStatus: string;
  dailyLimitRupees: number;
  createdAt: Date;
}) => ({
  id: customer.id,
  name: customer.name,
  email: customer.email,
  role: customer.role,
  phone: customer.phone,
  address: customer.address,
  kycStatus: customer.kycStatus,
  dailyLimitRupees: customer.dailyLimitRupees,
  createdAt: customer.createdAt,
});

const maskEmail = (email: string): string =>
  email.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2");

function useTerminalOtpDescription(email: string): string {
  return isDevelopment && isDemoPrivilegedEmail(email)
    ? "Password accepted; development demo OTP generated in backend terminal."
    : "Password accepted; email second-factor challenge created.";
}

// ============================================================
// CREATE OTP CHALLENGE
// ============================================================

const createOtpChallenge = async (customer: {
  _id: { toString(): string };
  email: string;
  name: string;
}): Promise<{ challengeId: string }> => {
  const email = customer.email.trim().toLowerCase();
  const challengeId = randomUUID();
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = new Date();

  const useTerminalOtp =
    isDevelopment && isDemoPrivilegedEmail(email);

  await LoginOtp.deleteMany({
    customerId: customer._id,
    consumedAt: { $exists: false },
  });

  await LoginOtp.create({
    challengeId,
    customerId: customer._id,
    email,
    otpHash: hashOtp(challengeId, otp),
    attempts: 0,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
    lastSentAt: now,
  });

  if (useTerminalOtp) {
    console.log("\n========================================");
    console.log("       VAULTBANK DEMO LOGIN OTP");
    console.log("========================================");
    console.log(`Account: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log("Expires in: 5 minutes");
    console.log("========================================\n");
  } else {
    try {
      await sendLoginOtp(email, otp);
    } catch (error: unknown) {
      await LoginOtp.deleteOne({ challengeId });
      throw error;
    }
  }

  return { challengeId };
};

// ============================================================
// DEMO USERS — DEVELOPMENT ONLY
// ============================================================

authRoutes.get("/demo-users", (_req: Request, res: Response) => {
  if (!isDevelopment) {
    res.status(404).json({
      success: false,
      message: "Endpoint not found.",
    });
    return;
  }

  res.json({
    success: true,
    users: [
      {
        role: "customer",
        label: "Alexander Morgan (Customer)",
        email: "demo.customer@example.com",
        password: "Demo@12345",
        description: "Customer banking dashboard demo account",
      },
      {
        role: "staff",
        label: "Arthur Vance (Bank Staff)",
        email: DEMO_STAFF_EMAIL,
        password: "Staff@12345",
        description: "Bank staff portal demo account",
      },
      {
        role: "management",
        label: "Morgan Blake (Management)",
        email: DEMO_MANAGEMENT_EMAIL,
        password: "Management@12345",
        description: "Management oversight and customer-management demo account",
      },
      {
        role: "admin",
        label: "Victoria Sterling (Administrator)",
        email: DEMO_ADMIN_EMAIL,
        password: "Admin@12345",
        description: "Administrator portal demo account",
      },
    ],
  });
});

// ============================================================
// REGISTER
// ============================================================

authRoutes.post(
  "/register",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = registrationSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message:
            parsed.error.issues[0]?.message ||
            "Please check the registration details.",
        });
        return;
      }

      const { name, password, phone, address } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      if (await Customer.exists({ email })) {
        res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const customer = await Customer.create({
        name,
        email,
        phone: phone || "+91 98765 43210",
        address: address || "Financial District, Mumbai",
        passwordHash,
        authProvider: "password",
        role: "customer",
        kycStatus: "pending",
        dailyLimitRupees: 50000,
        status: "active",
      });

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "USER_REGISTERED",
        details: "New customer registered using email and password.",
      });

      await sendNotification({
        customerId: customer._id.toString(),
        title: "Welcome to VaultBank!",
        message:
          "Your profile has been registered successfully. Complete the required verification steps to access eligible banking services.",
        type: "system",
      });

      res.status(201).json({
        success: true,
        message: "Customer registered successfully. You can now log in.",
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          role: customer.role,
          kycStatus: customer.kycStatus,
          createdAt: customer.createdAt,
        },
      });
    } catch (error: unknown) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to register right now. Please try again later.",
      });
    }
  }
);

// ============================================================
// LOGIN STEP 1 — PASSWORD AND OTP
// ============================================================

authRoutes.post(
  "/login",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid email and password.",
        });
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const customer = await Customer.findOne({ email }).select(
        "+passwordHash"
      );

      if (!customer || !customer.passwordHash) {
        res.status(401).json({
          success: false,
          message:
            "Invalid email or password. If you registered with Google, use Google sign-in.",
        });
        return;
      }

      const passwordMatches = await bcrypt.compare(
        parsed.data.password,
        customer.passwordHash
      );

      if (!passwordMatches) {
        await logAudit({
          userId: customer._id.toString(),
          userName: customer.name,
          userEmail: customer.email,
          userRole: customer.role,
          action: "LOGIN_FAILED",
          details: "Failed login attempt with incorrect password.",
          severity: "warning",
        });

        res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
        return;
      }

      if (customer.status !== "active") {
        res.status(403).json({
          success: false,
          message: `Your account is currently ${customer.status}. Please contact support.`,
        });
        return;
      }

      let challenge: { challengeId: string };

      try {
        challenge = await createOtpChallenge(customer);
      } catch (error: unknown) {
        console.error("Login OTP creation/delivery failed:", error);
        res.status(503).json({
          success: false,
          message:
            "We could not create or deliver your verification code. Please try logging in again.",
        });
        return;
      }

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "LOGIN_OTP_SENT",
        details: useTerminalOtpDescription(customer.email),
        severity: "info",
      });

      res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        challengeId: challenge.challengeId,
        message:
          isDevelopment && isDemoPrivilegedEmail(email)
            ? "Demo verification code generated. Check the backend terminal."
            : "A verification code has been sent to your registered email.",
        expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
        maskedEmail: maskEmail(email),
      });
    } catch (error: unknown) {
      console.error("Login initiation error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to start login right now. Please try again.",
      });
    }
  }
);

// ============================================================
// LOGIN STEP 2 — VERIFY OTP AND CREATE SESSION
// ============================================================

authRoutes.post(
  "/verify-login-otp",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Enter a valid challenge ID and six-digit OTP.",
        });
        return;
      }

      const { challengeId, otp } = parsed.data;

      const challenge = await LoginOtp.findOneAndUpdate(
        {
          challengeId,
          consumedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
          attempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" }
      ).select("+otpHash");

      if (!challenge) {
        res.status(401).json({
          success: false,
          message:
            "This verification code is invalid, expired, or locked. Please log in again.",
        });
        return;
      }

      if (
        typeof challenge.otpHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(challenge.otpHash)
      ) {
        res.status(500).json({
          success: false,
          message:
            "Unable to verify the code right now. Please request a new code.",
        });
        return;
      }

      if (!otpMatches(challengeId, otp, challenge.otpHash)) {
        res.status(401).json({
          success: false,
          message: "Incorrect verification code.",
          attemptsRemaining: Math.max(
            0,
            MAX_OTP_ATTEMPTS - challenge.attempts
          ),
        });
        return;
      }

      const consumed = await LoginOtp.findOneAndUpdate(
        {
          _id: challenge._id,
          consumedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
          attempts: { $lte: MAX_OTP_ATTEMPTS },
        },
        { $set: { consumedAt: new Date() } },
        { returnDocument: "after" }
      );

      if (!consumed) {
        res.status(401).json({
          success: false,
          message:
            "This verification code has already been used or expired. Please log in again.",
        });
        return;
      }

      const customer = await Customer.findById(challenge.customerId);

      if (!customer || customer.status !== "active") {
        res.status(401).json({
          success: false,
          message: "Customer account is unavailable or suspended.",
        });
        return;
      }

      // Persist the session before issuing the JWT.
      const sessionId = randomUUID();
      const sessionExpiry = new Date(
        Date.now() + SESSION_DURATION_MS
      );

      await Session.create({
        sessionId,
        customerId: customer._id,
        role: customer.role,
        userAgent: req.get("user-agent") || "Unknown",
        ipAddress: req.ip || "Unknown",
        lastActivityAt: new Date(),
        expiresAt: sessionExpiry,
        revokedAt: null,
      });

      const token = createVaultBankToken(
        {
          id: customer.id,
          role: customer.role,
        },
        sessionId
      );

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "LOGIN_SUCCESS",
        details: `Successful email OTP login to ${customer.role} portal.`,
        severity: "info",
      });

      res.status(200).json({
        success: true,
        message: "Two-factor verification successful.",
        token,
        expiresIn: Math.floor(SESSION_DURATION_MS / 1000),
        customer: customerResponse(customer),
      });
    } catch (error: unknown) {
      console.error("OTP verification error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to verify the code right now. Please try again.",
      });
    }
  }
);

// ============================================================
// GOOGLE SIGN-IN — VERIFY IDENTITY AND SEND OTP
// ============================================================

authRoutes.post(
  "/google",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = googleLoginSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "A valid Google sign-in token is required.",
        });
        return;
      }

      const decodedToken = await firebaseAdminAuth.verifyIdToken(
        parsed.data.idToken,
        true
      );

      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email?.trim().toLowerCase();
      const emailVerified = decodedToken.email_verified === true;

      if (!email || !emailVerified) {
        res.status(401).json({
          success: false,
          message: "Google sign-in requires a verified email address.",
        });
        return;
      }

      let customer = await Customer.findOne({ firebaseUid });

      if (customer) {
        if (customer.email.toLowerCase() !== email) {
          res.status(409).json({
            success: false,
            message:
              "The Google account email has changed. Contact support to update your VaultBank profile securely.",
          });
          return;
        }
      } else {
        const existingCustomer = await Customer.findOne({ email });

        if (existingCustomer) {
          res.status(409).json({
            success: false,
            message:
              "An account already exists with this email. Sign in using your existing method and contact support to link Google securely.",
          });
          return;
        }

        const name =
          decodedToken.name?.trim().slice(0, 80) ||
          email.split("@")[0].slice(0, 80);

        if (name.length < 2) {
          res.status(400).json({
            success: false,
            message:
              "Your Google profile does not provide a usable name. Update your Google profile and try again.",
          });
          return;
        }

        try {
          customer = await Customer.create({
            name,
            email,
            firebaseUid,
            authProvider: "google",
            role: "customer",
            kycStatus: "pending",
            status: "active",
            dailyLimitRupees: 50000,
          });
        } catch (createError: unknown) {
          if (
            typeof createError === "object" &&
            createError !== null &&
            "code" in createError &&
            createError.code === 11000
          ) {
            res.status(409).json({
              success: false,
              message:
                "An account with this email or Google identity already exists. Please try signing in again.",
            });
            return;
          }

          throw createError;
        }

        await logAudit({
          userId: customer._id.toString(),
          userName: customer.name,
          userEmail: customer.email,
          userRole: customer.role,
          action: "USER_REGISTERED",
          details: "New customer registered using Google authentication.",
        });

        await sendNotification({
          customerId: customer._id.toString(),
          title: "Welcome to VaultBank!",
          message:
            "Your Google sign-in was successful. Complete the required verification steps to access eligible banking services.",
          type: "system",
        });
      }

      if (customer.status !== "active") {
        res.status(403).json({
          success: false,
          message: `Your account is currently ${customer.status}. Please contact support.`,
        });
        return;
      }

      let challenge: { challengeId: string };

      try {
        challenge = await createOtpChallenge(customer);
      } catch (error: unknown) {
        console.error("Google login OTP creation/delivery failed:", error);
        res.status(503).json({
          success: false,
          message:
            "Google identity was verified, but we could not create or deliver your verification code. Please try again.",
        });
        return;
      }

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "LOGIN_OTP_SENT",
        details: useTerminalOtpDescription(customer.email),
        severity: "info",
      });

      res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        challengeId: challenge.challengeId,
        message:
          isDevelopment && isDemoPrivilegedEmail(email)
            ? "Demo verification code generated. Check the backend terminal."
            : "A verification code has been sent to your registered email.",
        expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
        maskedEmail: maskEmail(email),
      });
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code.startsWith("auth/")
      ) {
        res.status(401).json({
          success: false,
          message:
            "Google sign-in could not be verified. Please sign in again.",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Unable to complete Google sign-in right now.",
      });
    }
  }
);

// ============================================================
// GET CURRENT AUTHENTICATED CUSTOMER
// ============================================================

authRoutes.get(
  "/me",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const authenticatedUser = res.locals.authenticatedUser;

      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const customer = await Customer.findById(
        authenticatedUser.customerId
      );

      if (!customer || customer.status !== "active") {
        res.status(401).json({
          success: false,
          message: "Customer account is unavailable or suspended.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        customer: customerResponse(customer),
      });
    } catch (error: unknown) {
      console.error("Profile lookup error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to retrieve user profile.",
      });
    }
  }
);

// ============================================================
// UPDATE PROFILE
// ============================================================

authRoutes.put(
  "/profile",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authenticatedUser = res.locals.authenticatedUser;

      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const parsed = profileSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message:
            parsed.error.issues[0]?.message ||
            "Please check the profile details.",
        });
        return;
      }

      const customer = await Customer.findById(
        authenticatedUser.customerId
      );

      if (!customer) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      const { name, phone, address } = parsed.data;

      if (name !== undefined) customer.name = name;
      if (phone !== undefined) customer.phone = phone;
      if (address !== undefined) customer.address = address;

      await customer.save();

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "PROFILE_UPDATED",
        details: "User updated contact and personal details.",
      });

      res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        customer: customerResponse(customer),
      });
    } catch (error: unknown) {
      console.error("Profile update error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile.",
      });
    }
  }
);

// ============================================================
// CHANGE PASSWORD
// ============================================================

authRoutes.put(
  "/change-password",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authenticatedUser = res.locals.authenticatedUser;

      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const parsed = changePasswordSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message:
            parsed.error.issues[0]?.message ||
            "Please provide valid password details.",
        });
        return;
      }

      const { currentPassword, newPassword } = parsed.data;

      const customer = await Customer.findById(
        authenticatedUser.customerId
      ).select("+passwordHash");

      if (!customer) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      if (!customer.passwordHash) {
        res.status(400).json({
          success: false,
          message:
            "This account does not have a password. Use the configured account recovery process to set one.",
        });
        return;
      }

      const matches = await bcrypt.compare(
        currentPassword,
        customer.passwordHash
      );

      if (!matches) {
        res.status(400).json({
          success: false,
          message: "Current password does not match.",
        });
        return;
      }

      customer.passwordHash = await bcrypt.hash(newPassword, 10);
      await customer.save();

      await LoginOtp.deleteMany({ customerId: customer._id });

      // Revoke all sessions after a password change.
      await Session.updateMany(
        {
          customerId: customer._id,
          revokedAt: null,
        },
        { $set: { revokedAt: new Date() } }
      );

      await logAudit({
        userId: customer._id.toString(),
        userName: customer.name,
        userEmail: customer.email,
        userRole: customer.role,
        action: "PASSWORD_CHANGED",
        details:
          "User changed their account password; active sessions were revoked.",
        severity: "info",
      });

      res.status(200).json({
        success: true,
        message:
          "Password updated successfully. Please log in again on your devices.",
      });
    } catch (error: unknown) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password.",
      });
    }
  }
);

// ============================================================
// KEEP ALIVE — REFRESH SESSION ACTIVITY
// ============================================================

authRoutes.post(
  "/session/keep-alive",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const now = new Date();

      const session = await Session.findOneAndUpdate(
        {
          sessionId: user.sessionId,
          customerId: user.customerId,
          role: user.role,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: { lastActivityAt: now },
        },
        { new: true }
      );

      if (!session) {
        res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Session activity refreshed.",
      });
    } catch (error: unknown) {
      console.error("Session keep-alive error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to refresh your session.",
      });
    }
  }
);

// ============================================================
// LOGOUT — REVOKE CURRENT SESSION
// Requires authenticate.ts to expose sessionId.
// ============================================================

authRoutes.post(
  "/logout",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser as
        | {
            customerId: string;
            role: string;
            sessionId?: string;
          }
        | undefined;

      if (!user?.sessionId) {
        res.status(401).json({
          success: false,
          message: "No active session was found.",
        });
        return;
      }

      const session = await Session.findOneAndUpdate(
        {
          sessionId: user.sessionId,
          customerId: user.customerId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { revokedAt: new Date() } },
        { new: true }
      );

      if (!session) {
        res.status(401).json({
          success: false,
          message: "This session is already revoked or expired.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully.",
      });
    } catch (error: unknown) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to log out right now.",
      });
    }
  }
);

/* ============================================================
   SESSION MANAGEMENT — LIST AND REVOKE OWN SESSIONS
============================================================ */

// GET /sessions — list the current user's active sessions
authRoutes.get(
  "/sessions",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const now = new Date();

      const sessions = await Session.find({
        customerId: user.customerId,
        revokedAt: null,
        expiresAt: { $gt: now },
      })
        .select(
          "sessionId userAgent ipAddress lastActivityAt expiresAt createdAt"
        )
        .sort({ lastActivityAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        count: sessions.length,
        sessions: sessions.map((session) => ({
          sessionId: session.sessionId,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          isCurrent: session.sessionId === user.sessionId,
        })),
      });
    } catch (error: unknown) {
      console.error("List sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to retrieve active sessions.",
      });
    }
  }
);

// DELETE /sessions/:sessionId — revoke one of the user's sessions
authRoutes.delete(
  "/sessions/:sessionId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const sessionId = req.params.sessionId;

      if (
        typeof sessionId !== "string" ||
        sessionId.length > 100
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid session ID.",
        });
        return;
      }

      const revokedSession = await Session.findOneAndUpdate(
        {
          sessionId,
          customerId: user.customerId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { revokedAt: new Date() },
        },
        { new: true }
      ).select("sessionId");

      if (!revokedSession) {
        res.status(404).json({
          success: false,
          message:
            "Active session not found for this account.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Session revoked successfully.",
        sessionId: revokedSession.sessionId,
      });
    } catch (error: unknown) {
      console.error("Revoke session error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to revoke this session.",
      });
    }
  }
);

export default authRoutes;
