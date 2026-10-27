import "dotenv/config";
import { createServer } from "node:http";
import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDatabase } from "./config/database";
import { seedInitialData } from "./config/seed";
import authRoutes from "./routes/authRoutes";
import accountRoutes from "./routes/accountRoutes";
import { transactionRoutes } from "./routes/transactionRoutes";
import { beneficiaryRoutes } from "./routes/beneficiaryRoutes";
import { loanRoutes } from "./routes/loanRoutes";
import { fixedDepositRoutes } from "./routes/fixedDepositRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { staffRoutes } from "./routes/staffRoutes";
import debitCardRoutes from "./routes/debitCardRoutes";
import creditCardRoutes from "./routes/creditCardRoutes";
import cookieParser from "cookie-parser";
import { AUTH_COOKIE_NAME } from "./utils/authCookie";

import accountOpeningRoutes from "./routes/accountOpeningRoutes";
import staffAccountOpeningRoutes from "./routes/staffAccountOpeningRoutes";
import chatRoutes from "./routes/chatRoutes";
import { initializeChatSocketServer } from "./services/chatSocket";

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());

const configuredFrontendOrigins = process.env.FRONTEND_URL?.trim();

if (process.env.NODE_ENV === "production" && !configuredFrontendOrigins) {
  throw new Error("FRONTEND_URL must be set for production deployments.");
}

const allowedOrigins = new Set(
  (configuredFrontendOrigins || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  throw new Error("Configure at least one frontend origin in FRONTEND_URL.");
}

app.use(
  cors({
    origin: [...allowedOrigins],
    credentials: true,
  })
);

app.use(cookieParser());

app.use((req, res, next) => {
  const origin = req.get("origin");
  const isStateChangingRequest = !["GET", "HEAD", "OPTIONS"].includes(
    req.method
  );
  const hasAuthenticationCookie =
    typeof req.cookies?.[AUTH_COOKIE_NAME] === "string";

  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({
      success: false,
      message: "Request origin is not allowed.",
    });
    return;
  }

  if (isStateChangingRequest && hasAuthenticationCookie && !origin) {
    res.status(403).json({
      success: false,
      message: "A valid request origin is required for this operation.",
    });
    return;
  }

  next();
});

app.use(express.json({ limit: "50kb" }));


// Route handlers
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/beneficiaries", beneficiaryRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/fixed-deposits", fixedDepositRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/staff/account-opening", staffAccountOpeningRoutes);
app.use("/api/cards/debit", debitCardRoutes);
app.use("/api/cards/credit", creditCardRoutes);
app.use("/api/account-opening", accountOpeningRoutes);

initializeChatSocketServer(httpServer, [...allowedOrigins]);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to the VaultBank API - Core Banking Management System",
    version: "2.0.0",
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "VaultBank backend is running",
    timestamp: new Date().toISOString(),
  });
});

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    await seedInitialData();

    httpServer.listen(PORT, () => {
      console.log(`🚀 VaultBank API running at http://localhost:${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start VaultBank:", error);
    process.exit(1);
  }
}

void startServer();