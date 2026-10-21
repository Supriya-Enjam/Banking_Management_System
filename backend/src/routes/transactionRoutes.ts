
import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import authenticate, { requireRoles } from "../middleware/authenticate";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";
import { Customer } from "../models/Customer";
import { DebitCard } from "../models/DebitCard";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { broadcastStaffEvent } from "../utils/staffEventBus";

export const transactionRoutes = Router();

const MAX_AMOUNT_RUPEES = 1_000_000;
const MAX_ATM_AMOUNT_RUPEES = 100_000;
const MAX_FAILED_ATM_PIN_ATTEMPTS = 5;
const ATM_PIN_LOCK_DURATION_MS = 30 * 60 * 1000;

class RouteError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "RouteError";
  }
}

/* =========================================================
   VALIDATION
========================================================= */

const amountSchema = (maximum: number) =>
  z
    .number()
    .finite()
    .positive("Amount must be greater than zero.")
    .max(
      maximum,
      `Maximum transaction amount is ₹${maximum.toLocaleString("en-IN")}.`
    )
    .refine(
      (value) => Number.isSafeInteger(Math.round(value * 100)),
      "Invalid amount."
    )
    .refine(
      (value) => Math.round(value * 100) === value * 100,
      "Use no more than two decimal places."
    );

const depositBodySchema = z.object({
  accountId: z.string().min(1),
  amount: amountSchema(MAX_AMOUNT_RUPEES),
  description: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});

const withdrawBodySchema = z.object({
  accountId: z.string().min(1),
  amount: amountSchema(MAX_AMOUNT_RUPEES),
  description: z.string().trim().max(120).optional(),
});

const atmWithdrawBodySchema = z.object({
  accountId: z.string().min(1),
  cardId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, "ATM PIN must be 4 digits."),
  amount: amountSchema(MAX_ATM_AMOUNT_RUPEES),
});

const transferBodySchema = z.object({
  accountId: z.string().min(1),
  recipientAccountNumber: z.string().trim().min(3).max(40),
  amount: amountSchema(MAX_AMOUNT_RUPEES),
  description: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});

/* =========================================================
   HELPERS
========================================================= */

function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}

function getCustomerId(res: Response): string | null {
  const user = res.locals.authenticatedUser;
  return user?.customerId ? String(user.customerId) : null;
}

function makeReference(prefix: string): string {
  return `${prefix}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase()}`;
}

function validObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function getTodayDebitsPaise(
  accountId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<number> {
  const { start, end } = localDayRange();

  let query = Transaction.find({
    accountId,
    type: {
      $in: ["withdrawal", "transfer", "loan_repayment", "fd_creation"],
    },
    status: "completed",
    createdAt: { $gte: start, $lte: end },
  }).select("amountPaise");

  if (session) {
    query = query.session(session);
  }

  const transactions = await query;

  return transactions.reduce((sum, tx) => sum + tx.amountPaise, 0);
}

function pagination(query: Request["query"]) {
  const page = Math.max(
    1,
    Number.parseInt(String(query.page ?? "1"), 10) || 1
  );

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit ?? "50"), 10) || 50)
  );

  return { page, limit, skip: (page - 1) * limit };
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sendRouteError(res: Response, error: unknown): void {
  if (error instanceof RouteError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  console.error("Transaction route error:", error);

  res.status(500).json({
    success: false,
    message: "The transaction request could not be completed.",
  });
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

      const { page, limit, skip } = pagination(req.query);
      const { type, search, startDate, endDate, accountId } = req.query;

      const accountFilter: Record<string, unknown> = { customerId };

      if (accountId) {
        if (!validObjectId(String(accountId))) {
          res.status(400).json({
            success: false,
            message: "Invalid account ID.",
          });
          return;
        }

        accountFilter._id = String(accountId);
      }

      const accounts = await BankAccount.find(accountFilter)
        .select("_id")
        .lean();

      const filter: Record<string, any> = {
        accountId: { $in: accounts.map((account) => account._id) },
      };

      const allowedTypes = [
        "deposit",
        "withdrawal",
        "transfer",
        "loan",
        "loan_repayment",
        "fd_creation",
        "fd_maturity",
      ];

      if (type && type !== "all") {
        if (!allowedTypes.includes(String(type))) {
          res.status(400).json({
            success: false,
            message: "Invalid transaction type.",
          });
          return;
        }

        filter.type = String(type);
      }

      if (startDate || endDate) {
        const start = startDate ? validDate(startDate) : null;
        const end = endDate ? validDate(endDate) : null;

        if (
          (startDate && !start) ||
          (endDate && !end) ||
          (start && end && start > end)
        ) {
          res.status(400).json({
            success: false,
            message: "Invalid date range.",
          });
          return;
        }

        filter.createdAt = {};

        if (start) {
          filter.createdAt.$gte = start;
        }

        if (end) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }

      if (search) {
        const term = escapeRegex(String(search).trim().slice(0, 100));

        filter.$or = [
          { reference: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { recipientDetails: { $regex: term, $options: "i" } },
          { category: { $regex: term, $options: "i" } },
        ];
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .populate("accountId", "accountNumber accountType")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: transactions.length,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        transactions: transactions.map((tx: any) => ({
          id: String(tx._id),
          accountId:
            tx.accountId?._id?.toString() || String(tx.accountId ?? ""),
          accountNumber: tx.accountId?.accountNumber || "—",
          accountType: tx.accountId?.accountType || "savings",
          reference: tx.reference,
          type: tx.type,
          category: tx.category || "General",
          amountPaise: tx.amountPaise,
          amount: tx.amountPaise / 100,
          currency: "INR",
          description: tx.description || "",
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
========================================================= */

transactionRoutes.get(
  "/receipt/:reference",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const transaction = await Transaction.findOne({
        reference: String(req.params.reference),
      })
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
      const user = res.locals.authenticatedUser;
      const customerId = getCustomerId(res);

      if (
        user?.role === "customer" &&
        account?.customerId?.toString() !== customerId &&
        relatedAccount?.customerId?.toString() !== customerId
      ) {
        res.status(403).json({
          success: false,
          message: "You are not authorized to view this receipt.",
        });
        return;
      }


      if (
      !user?.role ||
      !["customer", "staff", "admin"].includes(user.role)
      ) {
      
        res.status(403).json({
          success: false,
          message: "Access denied.",
        });
        return;
      }

      // Explicitly narrow populated customer IDs to string | null.
      const senderCustomerId: string | null = account?.customerId
        ? String(account.customerId)
        : null;

      const recipientCustomerId: string | null = relatedAccount?.customerId
        ? String(relatedAccount.customerId)
        : null;

      const sender = senderCustomerId
        ? await Customer.findById(senderCustomerId)
            .select("name")
            .lean()
        : null;

      const recipient = recipientCustomerId
        ? await Customer.findById(recipientCustomerId)
            .select("name")
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
            name: sender?.name || "VaultBank Account Holder",
            accountNumber: account?.accountNumber || "—",
            accountType: account?.accountType || "savings",
          },
          recipient: {
            name: recipient?.name || transaction.recipientDetails || "Payee",
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
    const parsed = depositBodySchema.safeParse(req.body);

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid deposit details.",
      });
      return;
    }

    const { accountId, amount, description, category } = parsed.data;

    if (!validObjectId(accountId)) {
      res.status(400).json({
        success: false,
        message: "Invalid account ID.",
      });
      return;
    }

    const amountPaise = amountToPaise(amount);
    const reference = makeReference("VB-DEP");
    const session = await mongoose.startSession();
    let result: any;

    try {
      await session.withTransaction(async () => {
        const account = await BankAccount.findOne({
          _id: accountId,
          ...(user?.role === "customer" ? { customerId } : {}),
          status: "active",
        }).session(session);

        if (!account) {
          throw new RouteError(
            404,
            "Active account not found or access denied."
          );
        }

        const updated = await BankAccount.findOneAndUpdate(
          { _id: account._id, status: "active" },
          { $inc: { balancePaise: amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updated) {
          throw new RouteError(409, "Account changed. Please retry.");
        }

        const [transaction] = await Transaction.create(
          [
            {
              accountId: updated._id,
              reference,
              type: "deposit",
              category: category || "Deposit",
              amountPaise,
              description: description || "VaultBank Instant Deposit",
              status: "completed",
            },
          ],
          { session }
        );

        result = {
          transaction,
          accountNumber: updated.accountNumber,
          accountType: updated.accountType,
          customerId: String(updated.customerId),
          balancePaise: updated.balancePaise,
        };
      });

      await logAudit({
        userId: customerId,
        userName: user?.role === "customer" ? "Customer" : "Staff",
        userRole: user?.role,
        action: "FUNDS_DEPOSITED",
        details: `Deposited ₹${amount} into ${result.accountNumber}. Reference: ${reference}`,
      });

      await sendNotification({
        customerId: result.customerId,
        title: "Deposit Successful",
        message: `₹${amount.toLocaleString("en-IN")} credited to account ${result.accountNumber}.`,
        type: "transaction",
      });

      const depositCustomer = await Customer.findById(result.customerId)
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_DEPOSIT",
        title: "Customer Deposit",
        message: `${depositCustomer?.name || "Customer"} deposited ₹${amount} into ${result.accountNumber}.`,
        severity: "success",
        data: {
          reference,
          amount,
          accountNumber: result.accountNumber,
          accountType: result.accountType,
          customerName: depositCustomer?.name || "Customer",
          customerEmail: depositCustomer?.email,
          balance: result.balancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString("en-IN")} deposited successfully.`,
        transaction: {
          id: result.transaction.id,
          reference,
          amountPaise,
          amount,
          balancePaise: result.balancePaise,
          balance: result.balancePaise / 100,
          currency: "INR",
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (error) {
      sendRouteError(res, error);
    } finally {
      await session.endSession();
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
    const parsed = withdrawBodySchema.safeParse(req.body);

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message || "Invalid withdrawal details.",
      });
      return;
    }

    const { accountId, amount, description } = parsed.data;

    if (!validObjectId(accountId)) {
      res.status(400).json({
        success: false,
        message: "Invalid account ID.",
      });
      return;
    }

    const amountPaise = amountToPaise(amount);
    const reference = makeReference("VB-WTH");
    const session = await mongoose.startSession();
    let result: any;

    try {
      await session.withTransaction(async () => {
        const account = await BankAccount.findOne({
          _id: accountId,
          ...(user?.role === "customer" ? { customerId } : {}),
          status: "active",
        }).session(session);

        if (!account) {
          throw new RouteError(
            404,
            "Active account not found or access denied."
          );
        }

        const todayDebits = await getTodayDebitsPaise(account._id, session);
        const dailyLimit = account.dailyLimitPaise || 5_000_000;

        if (todayDebits + amountPaise > dailyLimit) {
          throw new RouteError(400, "Daily transaction limit exceeded.");
        }

        const updated = await BankAccount.findOneAndUpdate(
          {
            _id: account._id,
            status: "active",
            balancePaise: { $gte: amountPaise },
          },
          { $inc: { balancePaise: -amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updated) {
          throw new RouteError(
            400,
            "Insufficient funds or account changed."
          );
        }

        const [transaction] = await Transaction.create(
          [
            {
              accountId: updated._id,
              reference,
              type: "withdrawal",
              category: "Withdrawal",
              amountPaise,
              description: description || "VaultBank Cash Withdrawal",
              status: "completed",
            },
          ],
          { session }
        );

        result = {
          transaction,
          accountNumber: updated.accountNumber,
          accountType: updated.accountType,
          customerId: String(updated.customerId),
          balancePaise: updated.balancePaise,
        };
      });

      await logAudit({
        userId: customerId,
        userName: user?.role === "customer" ? "Customer" : "Staff",
        userRole: user?.role,
        action: "FUNDS_WITHDRAWN",
        details: `Withdrew ₹${amount} from ${result.accountNumber}. Reference: ${reference}`,
      });

      await sendNotification({
        customerId: result.customerId,
        title: "Withdrawal Alert",
        message: `₹${amount.toLocaleString("en-IN")} debited from account ${result.accountNumber}.`,
        type: "transaction",
      });

      const withdrawalCustomer = await Customer.findById(result.customerId)
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_WITHDRAWAL",
        title: "Customer Withdrawal",
        message: `${withdrawalCustomer?.name || "Customer"} withdrew ₹${amount} from ${result.accountNumber}.`,
        severity: "warning",
        data: {
          reference,
          amount,
          accountNumber: result.accountNumber,
          accountType: result.accountType,
          customerName: withdrawalCustomer?.name || "Customer",
          customerEmail: withdrawalCustomer?.email,
          balance: result.balancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString("en-IN")} withdrawn successfully.`,
        transaction: {
          id: result.transaction.id,
          reference,
          amountPaise,
          amount,
          balancePaise: result.balancePaise,
          balance: result.balancePaise / 100,
          currency: "INR",
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (error) {
      sendRouteError(res, error);
    } finally {
      await session.endSession();
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
    const parsed = transferBodySchema.safeParse(req.body);

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid transfer details.",
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

    if (!validObjectId(accountId)) {
      res.status(400).json({
        success: false,
        message: "Invalid source account ID.",
      });
      return;
    }

    const amountPaise = amountToPaise(amount);
    const reference = makeReference("VB-TRF");
    const session = await mongoose.startSession();
    let result: any;

    try {
      await session.withTransaction(async () => {
        const sender = await BankAccount.findOne({
          _id: accountId,
          ...(user?.role === "customer" ? { customerId } : {}),
          status: "active",
        }).session(session);

        if (!sender) {
          throw new RouteError(
            404,
            "Active source account not found or access denied."
          );
        }

        if (sender.accountNumber === recipientAccountNumber) {
          throw new RouteError(
            400,
            "Cannot transfer money to the same account."
          );
        }

        const todayDebits = await getTodayDebitsPaise(sender._id, session);
        const dailyLimit = sender.dailyLimitPaise || 5_000_000;

        if (todayDebits + amountPaise > dailyLimit) {
          throw new RouteError(400, "Daily transfer limit exceeded.");
        }

        const recipient = await BankAccount.findOne({
          accountNumber: recipientAccountNumber,
          status: "active",
        }).session(session);

        let recipientName = "External Payee";

        if (recipient) {
          if (String(recipient._id) === String(sender._id)) {
            throw new RouteError(
              400,
              "Cannot transfer money to the same account."
            );
          }

          const recipientCustomerId = recipient.customerId
            ? String(recipient.customerId)
            : null;

          const recipientCustomer = recipientCustomerId
            ? await Customer.findById(recipientCustomerId).session(session)
            : null;

          recipientName = recipientCustomer?.name || "VaultBank Customer";
        }

        const updatedSender = await BankAccount.findOneAndUpdate(
          {
            _id: sender._id,
            status: "active",
            balancePaise: { $gte: amountPaise },
          },
          { $inc: { balancePaise: -amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updatedSender) {
          throw new RouteError(
            400,
            "Insufficient funds or source account changed."
          );
        }

        if (recipient) {
          const updatedRecipient = await BankAccount.findOneAndUpdate(
            { _id: recipient._id, status: "active" },
            { $inc: { balancePaise: amountPaise } },
            { new: true, session, runValidators: true }
          );

          if (!updatedRecipient) {
            throw new RouteError(
              409,
              "Recipient account changed. Please retry."
            );
          }

          await Transaction.create(
            [
              {
                accountId: updatedRecipient._id,
                relatedAccountId: updatedSender._id,
                reference: `${reference}-IN`,
                type: "deposit",
                category: category || "Transfer In",
                amountPaise,
                description: `Transfer received from ${updatedSender.accountNumber}`,
                recipientDetails: `Received from ${updatedSender.accountNumber}`,
                status: "completed",
              },
            ],
            { session }
          );
        }

        const [senderTransaction] = await Transaction.create(
          [
            {
              accountId: updatedSender._id,
              relatedAccountId: recipient?._id || null,
              reference,
              type: "transfer",
              category: category || "Transfer",
              amountPaise,
              description:
                description || `Transfer to ${recipientAccountNumber}`,
              recipientDetails: `${recipientName} (${recipientAccountNumber})`,
              status: "completed",
            },
          ],
          { session }
        );

        result = {
          transaction: senderTransaction,
          senderAccountNumber: updatedSender.accountNumber,
          senderCustomerId: String(updatedSender.customerId),
          senderBalancePaise: updatedSender.balancePaise,
          recipientAccountNumber,
          recipientName,
          recipientCustomerId: recipient?.customerId
            ? String(recipient.customerId)
            : null,
        };
      });

      await logAudit({
        userId: customerId,
        userName: user?.role,
        userRole: user?.role,
        action: "FUNDS_TRANSFERRED",
        details: `Transferred ₹${amount} from ${result.senderAccountNumber} to ${recipientAccountNumber}. Ref: ${reference}`,
      });

      await sendNotification({
        customerId: result.senderCustomerId,
        title: "Transfer Sent",
        message: `₹${amount.toLocaleString("en-IN")} sent to ${result.recipientName} (${recipientAccountNumber}). Reference: ${reference}`,
        type: "transaction",
      });

      if (result.recipientCustomerId) {
        await sendNotification({
          customerId: result.recipientCustomerId,
          title: "Money Received",
          message: `₹${amount.toLocaleString("en-IN")} received from account ${result.senderAccountNumber}.`,
          type: "transaction",
        });
      }

      const senderCustomer = await Customer.findById(result.senderCustomerId)
        .select("name email")
        .lean();

      broadcastStaffEvent({
        type: "CUSTOMER_TRANSFER",
        title: "Customer Fund Transfer",
        message: `${senderCustomer?.name || "Customer"} transferred ₹${amount} from ${result.senderAccountNumber} to ${recipientAccountNumber}.`,
        severity: "info",
        data: {
          reference,
          amount,
          accountNumber: result.senderAccountNumber,
          recipientAccountNumber,
          recipientName: result.recipientName,
          customerName: senderCustomer?.name || "Customer",
          customerEmail: senderCustomer?.email,
          balance: result.senderBalancePaise / 100,
          status: "completed",
        },
      });

      res.status(201).json({
        success: true,
        message: `₹${amount.toLocaleString("en-IN")} transferred successfully to ${result.recipientName}.`,
        transaction: {
          id: result.transaction.id,
          reference,
          amount,
          amountPaise,
          balancePaise: result.senderBalancePaise,
          balance: result.senderBalancePaise / 100,
          recipient: result.recipientName,
          recipientAccountNumber,
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (error) {
      sendRouteError(res, error);
    } finally {
      await session.endSession();
    }
  }
);

/* =========================================================
   6. POST /api/transactions/atm-withdraw
   Five failed PIN attempts -> 30-minute lock
========================================================= */

transactionRoutes.post(
  "/atm-withdraw",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const customerId = getCustomerId(res);
    const user = res.locals.authenticatedUser;
    const parsed = atmWithdrawBodySchema.safeParse(req.body);

    if (!customerId || user?.role !== "customer") {
      res.status(403).json({
        success: false,
        message: "Only authenticated customers can use ATM withdrawals.",
      });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message || "Invalid ATM withdrawal details.",
      });
      return;
    }

    const { accountId, cardId, pin, amount } = parsed.data;

    if (!validObjectId(accountId) || !validObjectId(cardId)) {
      res.status(400).json({
        success: false,
        message: "Invalid account ID or debit card ID.",
      });
      return;
    }

    const amountPaise = amountToPaise(amount);
    const reference = makeReference("VB-ATM");
    const session = await mongoose.startSession();
    const now = new Date();
    const { start: startOfDay, end: endOfDay } = localDayRange(now);
    let result: any;

    try {
      const customer = await Customer.findById(customerId)
        .select("status")
        .lean();

      if (!customer || customer.status !== "active") {
        throw new RouteError(403, "An active customer profile is required.");
      }

      const card = await DebitCard.findOne({
        _id: cardId,
        customerId,
        accountId,
      }).select("+pinHash");

      if (!card) {
        throw new RouteError(
          404,
          "Debit card not found for this customer and account."
        );
      }

      if (card.status !== "active") {
        throw new RouteError(403, "This debit card is not active.");
      }

      if (
        card.pinLockedUntil &&
        card.pinLockedUntil.getTime() > now.getTime()
      ) {
        const minutesLeft = Math.ceil(
          (card.pinLockedUntil.getTime() - now.getTime()) / 60000
        );

        throw new RouteError(
          423,
          `ATM PIN is locked. Try again in approximately ${minutesLeft} minute(s).`
        );
      }

      const expiryDate = new Date(card.expiryYear, card.expiryMonth, 1);

      if (now >= expiryDate) {
        throw new RouteError(403, "This debit card has expired.");
      }

      if (
        card.pinLockedUntil &&
        card.pinLockedUntil.getTime() <= now.getTime()
      ) {
        await DebitCard.updateOne(
          {
            _id: card._id,
            pinLockedUntil: { $lte: now },
          },
          { $set: { failedPinAttempts: 0, pinLockedUntil: null } }
        );
      }

      const pinMatches = await bcrypt.compare(pin, card.pinHash);

      if (!pinMatches) {
        const updatedCard = await DebitCard.findOneAndUpdate(
          {
            _id: card._id,
            status: "active",
            $or: [
              { pinLockedUntil: null },
              { pinLockedUntil: { $exists: false } },
              { pinLockedUntil: { $lte: now } },
            ],
          },
          [
            {
              $set: {
                failedPinAttempts: {
                  $add: [{ $ifNull: ["$failedPinAttempts", 0] }, 1],
                },
              },
            },
            {
              $set: {
                pinLockedUntil: {
                  $cond: [
                    {
                      $gte: [
                        "$failedPinAttempts",
                        MAX_FAILED_ATM_PIN_ATTEMPTS,
                      ],
                    },
                    { $add: [now, ATM_PIN_LOCK_DURATION_MS] },
                    null,
                  ],
                },
              },
            },
          ] as any,
          { new: true }
        );

        if (!updatedCard) {
          throw new RouteError(
            423,
            "ATM PIN is locked or the card is unavailable. Please retry later."
          );
        }

        if (updatedCard.failedPinAttempts >= MAX_FAILED_ATM_PIN_ATTEMPTS) {
          throw new RouteError(
            423,
            "Too many incorrect PIN attempts. ATM PIN is locked for 30 minutes."
          );
        }

        throw new RouteError(
          401,
          `Incorrect ATM PIN. ${MAX_FAILED_ATM_PIN_ATTEMPTS - updatedCard.failedPinAttempts} attempt(s) remaining.`
        );
      }

      const resetResult = await DebitCard.updateOne(
        {
          _id: card._id,
          status: "active",
          failedPinAttempts: card.failedPinAttempts || 0,
          $or: [
            { pinLockedUntil: null },
            { pinLockedUntil: { $exists: false } },
            { pinLockedUntil: { $lte: now } },
          ],
        },
        { $set: { failedPinAttempts: 0, pinLockedUntil: null } }
      );

      if (
        resetResult.modifiedCount === 0 &&
        (card.failedPinAttempts || 0) !== 0
      ) {
        throw new RouteError(423, "ATM PIN state changed. Please retry.");
      }

      await session.withTransaction(async () => {
        const currentCard = await DebitCard.findOne({
          _id: cardId,
          customerId,
          accountId,
          status: "active",
          $or: [
            { pinLockedUntil: null },
            { pinLockedUntil: { $exists: false } },
            { pinLockedUntil: { $lte: new Date() } },
          ],
        }).session(session);

        if (!currentCard) {
          throw new RouteError(
            423,
            "Debit card is locked or no longer active."
          );
        }

        const currentExpiry = new Date(
          currentCard.expiryYear,
          currentCard.expiryMonth,
          1
        );

        if (new Date() >= currentExpiry) {
          throw new RouteError(403, "This debit card has expired.");
        }

        const account = await BankAccount.findOne({
          _id: accountId,
          customerId,
          status: "active",
        }).session(session);

        if (!account) {
          throw new RouteError(
            403,
            "The linked bank account is unavailable or inactive."
          );
        }

        const todayTransactions = await Transaction.find({
          accountId: account._id,
          type: {
            $in: ["withdrawal", "transfer", "loan_repayment", "fd_creation"],
          },
          status: "completed",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        })
          .select("amountPaise")
          .session(session);

        const todayDebitsPaise = todayTransactions.reduce(
          (sum, tx) => sum + tx.amountPaise,
          0
        );

        const accountDailyLimit = account.dailyLimitPaise || 5_000_000;

        if (todayDebitsPaise + amountPaise > accountDailyLimit) {
          throw new RouteError(
            400,
            "The account's daily debit limit would be exceeded."
          );
        }

        const atmTransactions = await Transaction.find({
          accountId: account._id,
          type: "withdrawal",
          category: "ATM Withdrawal",
          status: "completed",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        })
          .select("amountPaise")
          .session(session);

        const atmDebitsPaise = atmTransactions.reduce(
          (sum, tx) => sum + tx.amountPaise,
          0
        );

        if (atmDebitsPaise + amountPaise > currentCard.atmDailyLimitPaise) {
          throw new RouteError(
            400,
            "The debit card's ATM daily limit would be exceeded."
          );
        }

        const updatedAccount = await BankAccount.findOneAndUpdate(
          {
            _id: account._id,
            customerId,
            status: "active",
            balancePaise: { $gte: amountPaise },
          },
          { $inc: { balancePaise: -amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updatedAccount) {
          throw new RouteError(
            400,
            "Insufficient funds or account changed."
          );
        }

        const [transaction] = await Transaction.create(
          [
            {
              accountId: updatedAccount._id,
              reference,
              type: "withdrawal",
              category: "ATM Withdrawal",
              amountPaise,
              description: "VaultBank ATM Cash Withdrawal",
              status: "completed",
            },
          ],
          { session }
        );

        result = {
          transaction,
          accountNumber: updatedAccount.accountNumber,
          balancePaise: updatedAccount.balancePaise,
        };
      });

      await logAudit({
        userId: customerId,
        userName: "Customer",
        userRole: user.role,
        action: "ATM_WITHDRAWAL",
        details: `ATM withdrawal of ₹${amount} from ${result.accountNumber}. Reference: ${reference}`,
      });

      await sendNotification({
        customerId,
        title: "ATM Withdrawal",
        message: `₹${amount.toLocaleString("en-IN")} withdrawn from account ending ${result.accountNumber.slice(-4)}.`,
        type: "transaction",
      });

      res.status(201).json({
        success: true,
        message: "ATM withdrawal completed successfully.",
        transaction: {
          id: result.transaction.id,
          reference,
          amount,
          amountPaise,
          balance: result.balancePaise / 100,
          balancePaise: result.balancePaise,
          currency: "INR",
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (error) {
      sendRouteError(res, error);
    } finally {
      await session.endSession();
    }
  }
);

/* =========================================================
   7. GET /api/transactions/all
   Staff/Admin transaction monitor
========================================================= */

transactionRoutes.get(
  "/all",
  authenticate,
  requireRoles("staff","management", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const { type, status, search } = req.query;
      const filter: Record<string, any> = {};

      if (type && type !== "all") {
        filter.type = String(type);
      }

      if (status && status !== "all") {
        filter.status = String(status);
      }

      if (search) {
        const term = escapeRegex(String(search).trim().slice(0, 100));

        filter.$or = [
          { reference: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { recipientDetails: { $regex: term, $options: "i" } },
        ];
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .populate({
            path: "accountId",
            select: "accountNumber accountType customerId",
            populate: { path: "customerId", select: "name email" },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: transactions.length,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        transactions: transactions.map((tx: any) => ({
          id: String(tx._id),
          accountId:
            tx.accountId?._id?.toString() || String(tx.accountId || ""),
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
   8. GET /api/transactions/stats
   Staff/Admin financial statistics
========================================================= */

transactionRoutes.get(
  "/stats",
  authenticate,
  requireRoles("staff","management", "admin"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const transactions = await Transaction.find({ status: "completed" })
        .select("type amountPaise createdAt")
        .lean();

      let totalDepositsPaise = 0;
      let totalWithdrawalsPaise = 0;
      let totalTransfersPaise = 0;

      const monthlyMap: Record<
        string,
        {
          deposits: number;
          withdrawals: number;
          transfers: number;
        }
      > = {};

      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];

      for (const tx of transactions) {
        const date = new Date(tx.createdAt);
        const key = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyMap[key]) {
          monthlyMap[key] = {
            deposits: 0,
            withdrawals: 0,
            transfers: 0,
          };
        }

        if (tx.type === "deposit") {
          totalDepositsPaise += tx.amountPaise;
          monthlyMap[key].deposits += tx.amountPaise / 100;
        } else if (tx.type === "withdrawal") {
          totalWithdrawalsPaise += tx.amountPaise;
          monthlyMap[key].withdrawals += tx.amountPaise / 100;
        } else if (tx.type === "transfer") {
          totalTransfersPaise += tx.amountPaise;
          monthlyMap[key].transfers += tx.amountPaise / 100;
        }
      }

      res.json({
        success: true,
        stats: {
          totalDeposits: totalDepositsPaise / 100,
          totalWithdrawals: totalWithdrawalsPaise / 100,
          totalTransfers: totalTransfersPaise / 100,
          totalVolume:
            (
              totalDepositsPaise +
              totalWithdrawalsPaise +
              totalTransfersPaise
            ) / 100,
          transactionCount: transactions.length,
          monthlyTrends: Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, data]) => ({
              month: `${months[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
              ...data,
            })),
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
