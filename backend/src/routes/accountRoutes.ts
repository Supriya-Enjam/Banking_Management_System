import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import authenticate, { requireRoles } from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { BankAccount } from "../models/BankAccount";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { broadcastStaffEvent } from "../utils/staffEventBus";

const accountRoutes = Router();

accountRoutes.use(authenticate);

async function generateAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `VB${randomInt(1000, 9999)}${randomInt(1000, 9999)}${randomInt(100, 999)}`;
    const exists = await BankAccount.exists({ accountNumber: number });
    if (!exists) {
      return number;
    }
  }
  return `VB${Date.now().toString().slice(-10)}`;
}

// Create a new account (savings, current, or business)
accountRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = res.locals.authenticatedUser;

    if (!user || !mongoose.isValidObjectId(user.customerId)) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication identity.",
      });
      return;
    }

    const customer = await Customer.findById(user.customerId);

    if (!customer || customer.status !== "active") {
      res.status(403).json({
        success: false,
        message: "An active customer account is required.",
      });
      return;
    }

    const { accountType = "savings" } = req.body;
    if (!["savings", "current", "business"].includes(accountType)) {
      res.status(400).json({
        success: false,
        message: "Invalid account type. Choose savings, current, or business.",
      });
      return;
    }

    // Check if customer already has 3 accounts of this type
    const count = await BankAccount.countDocuments({
      customerId: customer._id,
      accountType,
      status: { $ne: "closed" },
    });

    if (count >= 2) {
      res.status(400).json({
        success: false,
        message: `You already have ${count} ${accountType} accounts. Maximum allowed is 2 per type.`,
      });
      return;
    }

    const accountNumber = await generateAccountNumber();
    const initialDeposit = Number(req.body.initialDeposit) || 0;
    const balancePaise = Math.round(Math.max(0, initialDeposit) * 100);

    const account = await BankAccount.create({
      customerId: customer._id,
      accountNumber,
      accountType,
      balancePaise,
      dailyLimitPaise: accountType === "business" ? 50000000 : 10000000,
      status: "active",
    });

    await logAudit({
      userId: customer._id.toString(),
      userName: customer.name,
      userEmail: customer.email,
      userRole: customer.role,
      action: "ACCOUNT_CREATED",
      details: `Created new ${accountType} account (${account.accountNumber}) with initial balance ₹${initialDeposit}.`,
    });

    await sendNotification({
      customerId: customer._id.toString(),
      title: "New Account Opened",
      message: `Your new ${accountType.toUpperCase()} account ${account.accountNumber} has been activated.`,
      type: "system",
    });

    // Broadcast to bank staff live feed
    broadcastStaffEvent({
      type: "CUSTOMER_ACCOUNT_OPENED",
      title: "New Account Opened",
      message: `${customer.name} opened a new ${accountType.toUpperCase()} account (${account.accountNumber}) with initial balance ₹${initialDeposit.toLocaleString()}.`,
      severity: "success",
      data: {
        customerId: customer._id.toString(),
        customerName: customer.name,
        customerEmail: customer.email,
        accountNumber: account.accountNumber,
        accountType,
        balance: account.balancePaise / 100,
        status: account.status,
      },
    });

    res.status(201).json({
      success: true,
      message: `${accountType.charAt(0).toUpperCase() + accountType.slice(1)} account created successfully.`,
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        balancePaise: account.balancePaise,
        currency: "INR",
        dailyLimitPaise: account.dailyLimitPaise,
        status: account.status,
        createdAt: account.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error("Account creation error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create an account right now.",
    });
  }
});

// List authenticated customer's accounts
accountRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const user = res.locals.authenticatedUser;

    if (!user || !mongoose.isValidObjectId(user.customerId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const accounts = await BankAccount.find({
      customerId: user.customerId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: accounts.length,
      accounts: accounts.map((account) => ({
        id: account._id.toString(),
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        balancePaise: account.balancePaise,
        dailyLimitPaise: account.dailyLimitPaise || 5000000,
        currency: "INR",
        status: account.status,
        createdAt: account.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error("Account listing error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve your accounts.",
    });
  }
});

// Admin / Staff: List all bank accounts across all customers
accountRoutes.get("/all", requireRoles("staff", "management", "admin"), async (_req: Request, res: Response): Promise<void> => {
  try {
    const accounts = await BankAccount.find()
      .populate("customerId", "name email phone status kycStatus")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: accounts.length,
      accounts: accounts.map((acc: any) => ({
        id: acc._id.toString(),
        accountNumber: acc.accountNumber,
        accountType: acc.accountType,
        balancePaise: acc.balancePaise,
        dailyLimitPaise: acc.dailyLimitPaise || 5000000,
        currency: "INR",
        status: acc.status,
        createdAt: acc.createdAt,
        customer: acc.customerId
          ? {
              id: acc.customerId._id?.toString(),
              name: acc.customerId.name,
              email: acc.customerId.email,
              phone: acc.customerId.phone,
              kycStatus: acc.customerId.kycStatus,
            }
          : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load all accounts." });
  }
});

// Admin / Staff: Update account status (e.g. freeze, activate, close) or limit
accountRoutes.patch("/:id/status", requireRoles("staff", "admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, dailyLimitRupees } = req.body;
    const user = res.locals.authenticatedUser;

    const account = await BankAccount.findById(id).populate("customerId");
    if (!account) {
      res.status(404).json({ success: false, message: "Bank account not found." });
      return;
    }

    if (status && ["active", "frozen", "closed"].includes(status)) {
      account.status = status;
    }

    if (dailyLimitRupees && Number(dailyLimitRupees) > 0) {
      account.dailyLimitPaise = Math.round(Number(dailyLimitRupees) * 100);
    }

    await account.save();

    await logAudit({
      userId: user?.customerId,
      userName: user?.role === "admin" ? "Admin" : "Staff Officer",
      userRole: user?.role,
      action: "ACCOUNT_STATUS_UPDATED",
      details: `Account ${account.accountNumber} status updated to ${account.status}. Daily limit: ₹${(account.dailyLimitPaise / 100).toLocaleString()}`,
      severity: status === "frozen" ? "warning" : "info",
    });

    if (account.customerId) {
      const custObj: any = account.customerId;
      await sendNotification({
        customerId: custObj._id.toString(),
        title: `Account Status Changed`,
        message: `Your account ${account.accountNumber} has been updated to "${account.status}" by bank administration.`,
        type: "security",
      });
    }

    res.json({
      success: true,
      message: `Account status updated to ${account.status}.`,
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        status: account.status,
        dailyLimitPaise: account.dailyLimitPaise,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update account status." });
  }
});

export default accountRoutes;