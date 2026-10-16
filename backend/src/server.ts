import "dotenv/config";
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

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());
app.use(
  cors({
    origin: "*", // Allow local dev clients
  })
);
app.use(express.json({ limit: "50kb" }));

// Route handlers
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/beneficiaries", beneficiaryRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/fixed-deposits", fixedDepositRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);

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

    app.listen(PORT, () => {
      console.log(`🚀 VaultBank API running at http://localhost:${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start VaultBank:", error);
    process.exit(1);
  }
}

void startServer();