
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import authenticate, { requireRoles } from "../middleware/authenticate";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";
import { Customer } from "../models/Customer";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { broadcastStaffEvent } from "../utils/staffEventBus";

export const transactionRoutes = Router();

const MAX_AMOUNT_RUPEES = 1_000_000;

/* =========================================================
   VALIDATION SCHEMAS
========================================================= */

const depositBodySchema = z.object({
  accountId: z.string().min(1, "Account ID is required."),
  amount: z
    .number()
    .finite()
    .positive("Amount must be greater than zero.")
    .max(MAX_AMOUNT_RUPEES, "Maximum transaction amount is ₹1,000,000.")
    .refine(
      (value) => Math.round(value * 100) === value * 100,
      "Use no more than two decimal places."
    ),
  description: z.string().trim().max(120).optional(),
  category: z.string().optional(),
});

const withdrawBodySchema = z.object({
  accountId: z.string().min(1, "Account ID is required."),
  amount: z
    .number()
    .finite()
    .positive("Amount must be greater than zero.")
    .max(MAX_AMOUNT_RUPEES, "Maximum transaction amount is ₹1,000,000.")
    .refine(
      (value) => Math.round(value * 100) === value * 100,
      "Use no more than two decimal places."
    ),
  description: z.string().trim().max(120).optional(),
});

const transferBodySchema = z.object({
  accountId: z.string().min(1, "Source account ID is required."),
  recipientAccountNumber: z
    .string()
    .trim()
    .min(3, "Recipient account number is required."),
  amount: z
    .number()
    .finite()
    .positive("Amount must be greater than zero.")
    .max(MAX_AMOUNT_RUPEES, "Maximum transaction amount is ₹1,000,000.")
    .refine(
      (value) => Math.round(value * 100) === value * 100,
      "Use no more than two decimal places."
    ),
  description: z.string().trim().max(120).optional(),
  category: z.string().optional(),
});

/* =========================================================
   HELPERS
========================================================= */

function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}

function getCustomerId(res: Response): string | null {
  const user = res.locals.authenticatedUser;
  return user?.customerId || null;
}

async function getTodayDebitsPaise(
  accountId: mongoose.Types.ObjectId
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const transactions = await Transaction.find({
    accountId,
    type: {
      $in: ["withdrawal", "transfer", "loan_repayment", "fd_creation"],
    },
    status: "completed",
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).select("amountPaise");

  return transactions.reduce((sum, tx) => sum + tx.amountPaise, 0);
}

/* =========================================================
   1. GET /api/transactions
   Customer transaction history
========================================================= */

transactionRoutes.get(
  "/",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = getCustomerId(res);

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Authentication is required.",
        });
        return;
      }

      const {
        page = "1",
        limit = "50",
        type,
        search,
        startDate,
        endDate,
        accountId,
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10) || 50)
      );

      const accountQuery: Record<string, any> = { customerId };

      if (accountId && mongoose.isValidObjectId(accountId as string)) {
        accountQuery._id = accountId;
      }

      const customerAccounts = await BankAccount.find(accountQuery)
        .select("_id")
        .lean();

      const accountIds = customerAccounts.map((account) => account._id);

      const filter: Record<string, any> = {
        accountId: { $in: accountIds },
      };

      if (type && type !== "all") {
        filter.type = type;
      }

      if (startDate || endDate) {
        filter.createdAt = {};

        if (startDate) {
          filter.createdAt.$gte = new Date(startDate as string);
        }

        if (endDate) {
          const end = new Date(endDate as string);
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }

      if (search) {
        const query = String(search).trim();

        filter.$or = [
          { reference: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { recipientDetails: { $regex: query, $options: "i" } },
          { category: { $regex: query, $options: "i" } },
        ];
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .populate("accountId", "accountNumber accountType")
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: transactions.length,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        transactions: transactions.map((tx: any) => ({
          id: tx._id.toString(),
          accountId:
            tx.accountId?._id?.toString() || String(tx.accountId),
          accountNumber: tx.accountId?.accountNumber || "—",
          accountType: tx.accountId?.accountType || "savings",
          reference: tx.reference,
          type: tx.type,
          category: tx.category || "General",
          amountPaise: tx.amountPaise,
          amount: tx.amountPaise / 100,
          currency: "INR",
          description: tx.description,
          recipientDetails: tx.recipientDetails || "",
          status: tx.status,
          createdAt: tx.createdAt,
        })),
      });
    } catch (error) {
      console.error("Transaction fetch error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load transactions.",
      });
    }
  }
);

/* =========================================================
   2. GET /api/transactions/receipt/:reference
   Printable transaction receipt
========================================================= */

transactionRoutes.get(
  "/receipt/:reference",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reference } = req.params;

      const transaction = await Transaction.findOne({ reference })
        .populate("accountId", "accountNumber accountType customerId")
        .populate("relatedAccountId", "accountNumber accountType customerId")
        .lean();

      if (!transaction) {
        res.status(404).json({
          success: false,
          message: "Transaction receipt not found.",
        });
        return;
      }

      const account: any = transaction.accountId;
      const relatedAccount: any = transaction.relatedAccountId;

      const senderCustomer = account?.customerId
        ? await Customer.findById(account.customerId)
            .select("name email phone")
            .lean()
        : null;

      const recipientCustomer = relatedAccount?.customerId
        ? await Customer.findById(relatedAccount.customerId)
            .select("name email phone")
            .lean()
        : null;

      res.json({
        success: true,
        receipt: {
          reference: transaction.reference,
          date: transaction.createdAt,
          type: transaction.type,
          category: transaction.category,
          amount: transaction.amountPaise / 100,
          amountPaise: transaction.amountPaise,
          currency: "INR",
          status: transaction.status,
          description: transaction.description,
          recipientDetails: transaction.recipientDetails,
          bankName: "VaultBank International",
          sender: {
            name: senderCustomer?.name || "VaultBank Account Holder",
            accountNumber: account?.accountNumber || "—",
            accountType: account?.accountType || "savings",
          },
          recipient: {
            name:
              recipientCustomer?.name ||
              transaction.recipientDetails ||
              "Direct Payee",
            accountNumber: relatedAccount?.accountNumber || "—",
          },
        },
      });
    } catch (error) {
      console.error("Receipt lookup error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch receipt.",
      });
    }
  }
);

/* =========================================================
   3. POST /api/transactions/deposit
========================================================= */

transactionRoutes.post(
  "/deposit",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const customerId = getCustomerId(res);
    const user = res.locals.authenticatedUser;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    const parsed = depositBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Invalid deposit details.",
      });
      return;
    }

    const { accountId, amount, description, category } = parsed.data;
    const amountPaise = amountToPaise(amount);

    try {
      const account = await BankAccount.findById(accountId);

      if (!account) {
        res.status(404).json({
          success: false,
          message: "Bank account not found.",
        });
        return;
      }

      if (
        user?.role === "customer" &&
        account.customerId.toString() !== customerId
      ) {
        res.status(403).json({
          success: false,
          message: "You can only deposit into your own accounts.",
        });
        return;
      }

      if (account.status !== "active") {
        res.status(400).json({
          success: false,
          message: `Account is ${account.status} and cannot receive funds.`,
        });
        return;
      }

      account.balancePaise += amountPaise;
      await account.save();

      const reference = `VB-DEP-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 10)
        .toUpperCase()}`;

      const transaction = await Transaction.create({
        accountId: account._id,
        reference,
        type: "deposit",
        category: category || "Deposit",
        amountPaise,
        description: description || "VaultBank Instant Deposit",
        status: "completed",
      });

      await logAudit({
        userId: customerId,
        userName: user?.role === "customer" ? "Customer" : "Teller Staff",
        userRole: user?.role,
        action: "FUNDS_DEPOSITED",
        details: `Deposited ₹${amount.toLocaleString()} into account ${account.accountNumber}. Reference: ${reference}`,
      });

      await sendNotification({
        customerId: account.customerId.toString(),
        title: "Deposit Successful",
        message: `₹${amount.toLocaleString()} credited to ${account.accountType.toUpperCase()} account ${account.accountNumber}. New balance: ₹${(account.balancePaise / 100).toLocaleString()}`,
        type: "transaction",
      });

      const depositCustomer = await Customer.findById(account.customerId)
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_DEPOSIT",
        title: "Customer Deposit",
        message: `${depositCustomer?.name || "Customer"} deposited ₹${amount.toLocaleString()} into ${account.accountNumber}.`,
        severity: "success",
        data: {
          reference,
          amount,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          customerName: depositCustomer?.name || "Customer",
          customerEmail: depositCustomer?.email,
          balance: account.balancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString()} deposited successfully.`,
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amountPaise: transaction.amountPaise,
          amount,
          balancePaise: account.balancePaise,
          balance: account.balancePaise / 100,
          currency: "INR",
          createdAt: transaction.createdAt,
        },
      });
    } catch (error) {
      console.error("Deposit error:", error);

      res.status(500).json({
        success: false,
        message: "The deposit could not be completed.",
      });
    }
  }
);

/* =========================================================
   4. POST /api/transactions/withdraw
========================================================= */

transactionRoutes.post(
  "/withdraw",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const customerId = getCustomerId(res);
    const user = res.locals.authenticatedUser;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    const parsed = withdrawBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Invalid withdrawal details.",
      });
      return;
    }

    const { accountId, amount, description } = parsed.data;
    const amountPaise = amountToPaise(amount);

    try {
      const account = await BankAccount.findById(accountId);

      if (!account) {
        res.status(404).json({
          success: false,
          message: "Account not found.",
        });
        return;
      }

      if (
        user?.role === "customer" &&
        account.customerId.toString() !== customerId
      ) {
        res.status(403).json({
          success: false,
          message: "You can only withdraw from your own accounts.",
        });
        return;
      }

      if (account.status !== "active") {
        res.status(400).json({
          success: false,
          message: `Account is ${account.status} and cannot be debited.`,
        });
        return;
      }

      if (account.balancePaise < amountPaise) {
        res.status(400).json({
          success: false,
          message: `Insufficient funds. Available balance: ₹${(account.balancePaise / 100).toLocaleString()}`,
        });
        return;
      }

      const todayDebitsPaise = await getTodayDebitsPaise(account._id);
      const dailyLimit = account.dailyLimitPaise || 5_000_000;

      if (todayDebitsPaise + amountPaise > dailyLimit) {
        const remainingLimit = Math.max(
          0,
          dailyLimit - todayDebitsPaise
        );

        res.status(400).json({
          success: false,
          message: `Daily transaction limit exceeded! Daily limit: ₹${(dailyLimit / 100).toLocaleString()}. Remaining limit for today: ₹${(remainingLimit / 100).toLocaleString()}`,
        });
        return;
      }

      account.balancePaise -= amountPaise;
      await account.save();

      const reference = `VB-WTH-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 10)
        .toUpperCase()}`;

      const transaction = await Transaction.create({
        accountId: account._id,
        reference,
        type: "withdrawal",
        category: "Withdrawal",
        amountPaise,
        description: description || "VaultBank Cash Withdrawal",
        status: "completed",
      });

      await logAudit({
        userId: customerId,
        userName: user?.role === "customer" ? "Customer" : "Teller Staff",
        userRole: user?.role,
        action: "FUNDS_WITHDRAWN",
        details: `Withdrew ₹${amount.toLocaleString()} from account ${account.accountNumber}. Reference: ${reference}`,
      });

      await sendNotification({
        customerId: account.customerId.toString(),
        title: "Withdrawal Alert",
        message: `₹${amount.toLocaleString()} debited from ${account.accountType.toUpperCase()} account ${account.accountNumber}. New balance: ₹${(account.balancePaise / 100).toLocaleString()}`,
        type: "transaction",
      });

      const withdrawalCustomer = await Customer.findById(account.customerId)
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_WITHDRAWAL",
        title: "Customer Withdrawal",
        message: `${withdrawalCustomer?.name || "Customer"} withdrew ₹${amount.toLocaleString()} from ${account.accountNumber}.`,
        severity: "warning",
        data: {
          reference,
          amount,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          customerName: withdrawalCustomer?.name || "Customer",
          customerEmail: withdrawalCustomer?.email,
          balance: account.balancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString()} withdrawn successfully.`,
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amountPaise: transaction.amountPaise,
          amount,
          balancePaise: account.balancePaise,
          balance: account.balancePaise / 100,
          currency: "INR",
          createdAt: transaction.createdAt,
        },
      });
    } catch (error) {
      console.error("Withdrawal error:", error);

      res.status(500).json({
        success: false,
        message: "Withdrawal failed.",
      });
    }
  }
);

/* =========================================================
   5. POST /api/transactions/transfer
========================================================= */

transactionRoutes.post(
  "/transfer",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const customerId = getCustomerId(res);
    const user = res.locals.authenticatedUser;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    const parsed = transferBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Invalid transfer details.",
      });
      return;
    }

    const {
      accountId,
      recipientAccountNumber,
      amount,
      description,
      category,
    } = parsed.data;

    const amountPaise = amountToPaise(amount);

    try {
      const senderAccount = await BankAccount.findById(accountId);

      if (!senderAccount) {
        res.status(404).json({
          success: false,
          message: "Sender account not found.",
        });
        return;
      }

      if (
        user?.role === "customer" &&
        senderAccount.customerId.toString() !== customerId
      ) {
        res.status(403).json({
          success: false,
          message: "You can only transfer from your own account.",
        });
        return;
      }

      if (senderAccount.status !== "active") {
        res.status(400).json({
          success: false,
          message: `Your account is ${senderAccount.status} and cannot send funds.`,
        });
        return;
      }

      if (
        senderAccount.accountNumber === recipientAccountNumber.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Cannot transfer money to the same account.",
        });
        return;
      }

      if (senderAccount.balancePaise < amountPaise) {
        res.status(400).json({
          success: false,
          message: `Insufficient balance. Available: ₹${(senderAccount.balancePaise / 100).toLocaleString()}`,
        });
        return;
      }

      const todayDebitsPaise = await getTodayDebitsPaise(
        senderAccount._id
      );
      const dailyLimit = senderAccount.dailyLimitPaise || 5_000_000;

      if (todayDebitsPaise + amountPaise > dailyLimit) {
        const remainingLimit = Math.max(
          0,
          dailyLimit - todayDebitsPaise
        );

        res.status(400).json({
          success: false,
          message: `Daily transfer limit exceeded. Daily limit: ₹${(dailyLimit / 100).toLocaleString()}. Remaining limit: ₹${(remainingLimit / 100).toLocaleString()}`,
        });
        return;
      }

      const recipientAccount = await BankAccount.findOne({
        accountNumber: recipientAccountNumber.trim(),
      });

      const reference = `VB-TRF-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 10)
        .toUpperCase()}`;

      let recipientName = "External Payee";

      senderAccount.balancePaise -= amountPaise;
      await senderAccount.save();

      if (recipientAccount) {
        if (recipientAccount.status !== "active") {
          senderAccount.balancePaise += amountPaise;
          await senderAccount.save();

          res.status(400).json({
            success: false,
            message:
              "The recipient bank account is currently frozen or inactive.",
          });
          return;
        }

        recipientAccount.balancePaise += amountPaise;
        await recipientAccount.save();

        const recipientCustomer = await Customer.findById(
          recipientAccount.customerId
        );

        if (recipientCustomer) {
          recipientName = recipientCustomer.name;
        }

        await Transaction.create({
          accountId: recipientAccount._id,
          relatedAccountId: senderAccount._id,
          reference: `${reference}-IN`,
          type: "deposit",
          category: category || "Transfer In",
          amountPaise,
          description: `Transfer received from ${user?.role === "customer" ? "VaultBank Customer" : "Account Holder"} (${senderAccount.accountNumber})`,
          recipientDetails: `Received from ${senderAccount.accountNumber}`,
          status: "completed",
        });

        await sendNotification({
          customerId: recipientAccount.customerId.toString(),
          title: "Money Received!",
          message: `₹${amount.toLocaleString()} received into ${recipientAccount.accountNumber} from ${senderAccount.accountNumber}.`,
          type: "transaction",
        });
      }

      const senderTransaction = await Transaction.create({
        accountId: senderAccount._id,
        relatedAccountId: recipientAccount ? recipientAccount._id : null,
        reference,
        type: "transfer",
        category: category || "Transfer",
        amountPaise,
        description:
          description || `Transfer to ${recipientAccountNumber}`,
        recipientDetails: `${recipientName} (${recipientAccountNumber})`,
        status: "completed",
      });

      await logAudit({
        userId: customerId,
        userName: user?.role,
        userRole: user?.role,
        action: "FUNDS_TRANSFERRED",
        details: `Transferred ₹${amount.toLocaleString()} from ${senderAccount.accountNumber} to ${recipientAccountNumber}. Ref: ${reference}`,
      });

      await sendNotification({
        customerId: senderAccount.customerId.toString(),
        title: "Transfer Sent",
        message: `₹${amount.toLocaleString()} successfully sent to ${recipientName} (${recipientAccountNumber}). Ref: ${reference}`,
        type: "transaction",
      });

      const transferCustomer = await Customer.findById(
        senderAccount.customerId
      )
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_TRANSFER",
        title: "Customer Fund Transfer",
        message: `${transferCustomer?.name || "Customer"} transferred ₹${amount.toLocaleString()} from ${senderAccount.accountNumber} → ${recipientAccountNumber} (${recipientName}).`,
        severity: "info",
        data: {
          reference,
          amount,
          accountNumber: senderAccount.accountNumber,
          recipientAccountNumber,
          recipientName,
          customerName: transferCustomer?.name || "Customer",
          customerEmail: transferCustomer?.email,
          balance: senderAccount.balancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString()} transferred successfully to ${recipientName}.`,
        transaction: {
          id: senderTransaction.id,
          reference: senderTransaction.reference,
          amount,
          amountPaise,
          balancePaise: senderAccount.balancePaise,
          balance: senderAccount.balancePaise / 100,
          recipient: recipientName,
          recipientAccountNumber,
          createdAt: senderTransaction.createdAt,
        },
      });
    } catch (error) {
      console.error("Transfer error:", error);

      res.status(500).json({
        success: false,
        message: "Fund transfer failed.",
      });
    }
  }
);

/* =========================================================
   6. GET /api/transactions/all
   Staff/Admin system-wide transaction monitor
========================================================= */

transactionRoutes.get(
  "/all",
  authenticate,
  requireRoles("staff", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = "1",
        limit = "50",
        type,
        status,
        search,
      } = req.query;

      const pageNum = Math.max(
        1,
        parseInt(page as string, 10) || 1
      );

      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10) || 50)
      );

      const filter: Record<string, any> = {};

      if (type && type !== "all") {
        filter.type = type;
      }

      if (status && status !== "all") {
        filter.status = status;
      }

      if (search) {
        const query = String(search).trim();

        filter.$or = [
          { reference: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { recipientDetails: { $regex: query, $options: "i" } },
        ];
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .populate({
            path: "accountId",
            select: "accountNumber accountType customerId",
            populate: {
              path: "customerId",
              select: "name email",
            },
          })
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: transactions.length,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        transactions: transactions.map((tx: any) => ({
          id: tx._id.toString(),
          accountId:
            tx.accountId?._id?.toString() ||
            (tx.accountId ? String(tx.accountId) : ""),
          accountNumber: tx.accountId?.accountNumber || "—",
          accountType: tx.accountId?.accountType || "savings",
          reference: tx.reference,
          type: tx.type,
          category: tx.category || "General",
          amount: tx.amountPaise / 100,
          amountPaise: tx.amountPaise,
          currency: "INR",
          description: tx.description || "",
          recipientDetails: tx.recipientDetails || "",
          status: tx.status,
          createdAt: tx.createdAt,
          account: tx.accountId
            ? {
                accountNumber: tx.accountId.accountNumber,
                customerName:
                  tx.accountId.customerId?.name || "Vault Customer",
                customerEmail: tx.accountId.customerId?.email || "",
              }
            : null,
        })),
      });
    } catch (error) {
      console.error("Staff transaction monitor error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load transactions for monitoring.",
      });
    }
  }
);

/* =========================================================
   7. GET /api/transactions/stats
========================================================= */

transactionRoutes.get(
  "/stats",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const transactions = await Transaction.find({
        status: "completed",
      })
        .select("type amountPaise createdAt")
        .lean();

      let totalDepositsPaise = 0;
      let totalWithdrawalsPaise = 0;
      let totalTransfersPaise = 0;

      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const monthlyMap: Record<
        string,
        { deposits: number; withdrawals: number; transfers: number }
      > = {};

      transactions.forEach((tx) => {
        const month = months[new Date(tx.createdAt).getMonth()];

        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            deposits: 0,
            withdrawals: 0,
            transfers: 0,
          };
        }

        if (tx.type === "deposit") {
          totalDepositsPaise += tx.amountPaise;
          monthlyMap[month].deposits += tx.amountPaise / 100;
        } else if (tx.type === "withdrawal") {
          totalWithdrawalsPaise += tx.amountPaise;
          monthlyMap[month].withdrawals += tx.amountPaise / 100;
        } else if (tx.type === "transfer") {
          totalTransfersPaise += tx.amountPaise;
          monthlyMap[month].transfers += tx.amountPaise / 100;
        }
      });

      res.json({
        success: true,
        stats: {
          totalDeposits: totalDepositsPaise / 100,
          totalWithdrawals: totalWithdrawalsPaise / 100,
          totalTransfers: totalTransfersPaise / 100,
          totalVolume:
            (totalDepositsPaise +
              totalWithdrawalsPaise +
              totalTransfersPaise) /
            100,
          transactionCount: transactions.length,
          monthlyTrends: Object.entries(monthlyMap).map(
            ([month, data]) => ({
              month,
              ...data,
            })
          ),
        },
      });
    } catch (error) {
      console.error("Transaction statistics error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to compile financial reports.",
      });
    }
  }
);

export default transactionRoutes;
