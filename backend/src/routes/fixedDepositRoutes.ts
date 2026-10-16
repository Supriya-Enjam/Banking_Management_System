import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import authenticate from "../middleware/authenticate";
import { FixedDeposit } from "../models/FixedDeposit";
import { BankAccount } from "../models/BankAccount";
import { Customer } from "../models/Customer";
import { Transaction } from "../models/Transaction";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { broadcastStaffEvent } from "../utils/staffEventBus";

export const fixedDepositRoutes = Router();

fixedDepositRoutes.use(authenticate);

function getFdRate(tenureMonths: number): number {
  if (tenureMonths < 12) return 6.5;
  if (tenureMonths < 24) return 7.25;
  if (tenureMonths < 36) return 7.75;
  return 8.25;
}

function calculateMaturity(principalPaise: number, rate: number, tenureMonths: number): number {
  const years = tenureMonths / 12;
  // Quarterly compounding: A = P * (1 + r / 400)^(4 * years)
  const maturity = principalPaise * Math.pow(1 + rate / 400, 4 * years);
  return Math.round(maturity);
}

const openFdSchema = z.object({
  accountId: z.string().min(1, "Source account ID is required."),
  amountRupees: z.number().min(5000, "Minimum Fixed Deposit is ₹5,000.").max(5000000, "Maximum FD is ₹5,000,000."),
  tenureMonths: z.number().min(3).max(120),
});

// Calculate FD preview
fixedDepositRoutes.post("/preview", (req: Request, res: Response) => {
  const { amountRupees = 50000, tenureMonths = 12 } = req.body;
  const rate = getFdRate(Number(tenureMonths));
  const principalPaise = Math.round(amountRupees * 100);
  const maturityPaise = calculateMaturity(principalPaise, rate, Number(tenureMonths));

  res.json({
    success: true,
    amountRupees,
    tenureMonths: Number(tenureMonths),
    interestRate: rate,
    estimatedInterestRupees: (maturityPaise - principalPaise) / 100,
    maturityAmountRupees: maturityPaise / 100,
  });
});

// 1. Open new FD
fixedDepositRoutes.post("/open", async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const parsed = openFdSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid parameters.",
      });
      return;
    }

    const { accountId, amountRupees, tenureMonths } = parsed.data;
    const amountPaise = Math.round(amountRupees * 100);

    const account = await BankAccount.findOne({ _id: accountId, customerId, status: "active" });
    if (!account) {
      res.status(404).json({ success: false, message: "Source account not found or is inactive." });
      return;
    }

    if (account.balancePaise < amountPaise) {
      res.status(400).json({
        success: false,
        message: `Insufficient balance to open FD. Available: ₹${(account.balancePaise / 100).toLocaleString()}`,
      });
      return;
    }

    // Deduct amount from account
    account.balancePaise -= amountPaise;
    await account.save();

    const rate = getFdRate(tenureMonths);
    const maturityAmountPaise = calculateMaturity(amountPaise, rate, tenureMonths);

    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    const depositNumber = `FD-VB-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    const fd = await FixedDeposit.create({
      customerId,
      accountId: account._id,
      depositNumber,
      amountPaise,
      tenureMonths,
      interestRate: rate,
      maturityAmountPaise,
      startDate,
      maturityDate,
      status: "active",
    });

    // Record transaction
    const reference = `VB-FD-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await Transaction.create({
      accountId: account._id,
      reference,
      type: "fd_creation",
      category: "Fixed Deposit",
      amountPaise,
      description: `Opened Term Deposit ${depositNumber} (${tenureMonths} months @ ${rate}%)`,
      status: "completed",
    });

    await logAudit({
      userId: customerId,
      action: "FD_CREATED",
      details: `Created Fixed Deposit ${depositNumber} of ₹${amountRupees.toLocaleString()} for ${tenureMonths} months @ ${rate}%.`,
    });

    await sendNotification({
      customerId,
      title: "Fixed Deposit Created",
      message: `Your Term Deposit ${depositNumber} of ₹${amountRupees.toLocaleString()} is active. Maturity value: ₹${(maturityAmountPaise / 100).toLocaleString()}`,
      type: "transaction",
    });

    // Broadcast to bank staff live feed
    const fdCust = await Customer.findById(customerId).select("name email").lean();
    broadcastStaffEvent({
      type: "CUSTOMER_FD_OPENED",
      title: "Fixed Deposit Opened",
      message: `${fdCust?.name || "Customer"} opened Term Deposit ${depositNumber} for ₹${amountRupees.toLocaleString()} @ ${rate}% (${tenureMonths} months).`,
      severity: "info",
      data: {
        customerId,
        customerName: fdCust?.name || "Customer",
        customerEmail: fdCust?.email,
        depositNumber,
        amount: amountRupees,
        accountNumber: account.accountNumber,
        tenureMonths,
        interestRate: rate,
        status: "active",
      },
    });

    res.status(201).json({
      success: true,
      message: "Fixed deposit opened successfully.",
      fixedDeposit: {
        id: fd.id,
        depositNumber: fd.depositNumber,
        amountRupees,
        tenureMonths,
        interestRate: rate,
        maturityAmountRupees: maturityAmountPaise / 100,
        startDate: fd.startDate,
        maturityDate: fd.maturityDate,
        status: fd.status,
      },
    });
  } catch (error) {
    console.error("Open FD error:", error);
    res.status(500).json({ success: false, message: "Failed to create fixed deposit." });
  }
});

// 2. List customer FDs
fixedDepositRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const fds = await FixedDeposit.find({ customerId })
      .populate("accountId", "accountNumber")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: fds.length,
      fixedDeposits: fds.map((fd: any) => ({
        id: fd._id.toString(),
        depositNumber: fd.depositNumber,
        accountNumber: fd.accountId?.accountNumber || "—",
        amount: fd.amountPaise / 100,
        amountPaise: fd.amountPaise,
        tenureMonths: fd.tenureMonths,
        interestRate: fd.interestRate,
        maturityAmount: fd.maturityAmountPaise / 100,
        maturityAmountPaise: fd.maturityAmountPaise,
        startDate: fd.startDate,
        maturityDate: fd.maturityDate,
        status: fd.status,
        createdAt: fd.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load fixed deposits." });
  }
});

// 3. Liquidate / Close FD early
fixedDepositRoutes.post("/:id/liquidate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = res.locals.authenticatedUser?.customerId;

    const fd = await FixedDeposit.findOne({ _id: id, customerId, status: "active" });
    if (!fd) {
      res.status(404).json({ success: false, message: "Active fixed deposit not found." });
      return;
    }

    const account = await BankAccount.findById(fd.accountId);
    if (!account) {
      res.status(400).json({ success: false, message: "Linked bank account not found." });
      return;
    }

    // Check if mature or early liquidation (early liquidation returns principal + 50% accrued interest)
    const isMatured = new Date() >= new Date(fd.maturityDate);
    const returnAmountPaise = isMatured
      ? fd.maturityAmountPaise
      : Math.round(fd.amountPaise + (fd.maturityAmountPaise - fd.amountPaise) * 0.4);

    fd.status = isMatured ? "matured" : "liquidated";
    await fd.save();

    account.balancePaise += returnAmountPaise;
    await account.save();

    const reference = `VB-LIQ-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    await Transaction.create({
      accountId: account._id,
      reference,
      type: "fd_liquidation",
      category: "Fixed Deposit Payout",
      amountPaise: returnAmountPaise,
      description: `Liquidation payout for FD ${fd.depositNumber}${isMatured ? " (Matured)" : " (Premature)"}`,
      status: "completed",
    });

    await logAudit({
      userId: customerId,
      action: "FD_LIQUIDATED",
      details: `Liquidated FD ${fd.depositNumber}. Returned ₹${(returnAmountPaise / 100).toLocaleString()} to ${account.accountNumber}.`,
    });

    await sendNotification({
      customerId: customerId as string,
      title: "Fixed Deposit Liquidated",
      message: `FD ${fd.depositNumber} closed. ₹${(returnAmountPaise / 100).toLocaleString()} credited back to your account ${account.accountNumber}.`,
      type: "transaction",
    });

    res.json({
      success: true,
      message: `Fixed deposit closed. ₹${(returnAmountPaise / 100).toLocaleString()} credited to ${account.accountNumber}.`,
      payoutAmountRupees: returnAmountPaise / 100,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to liquidate fixed deposit." });
  }
});

export default fixedDepositRoutes;
