
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import authenticate, { requireRoles } from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";
import { Loan } from "../models/Loan";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { staffEventBus, broadcastStaffEvent } from "../utils/staffEventBus";

export const staffRoutes = Router();

staffRoutes.use(authenticate);
staffRoutes.use(requireRoles("staff", "admin"));

type TransactionKind = "deposit" | "withdrawal" | "transfer";

type ActivityRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "success" | "critical";
  timestamp: string | Date;
  data?: Record<string, unknown>;
};

function parseAmountRupees(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const rupees = Number(value);
  const paise = Math.round(rupees * 100);

  if (
    !Number.isFinite(rupees) ||
    rupees <= 0 ||
    !Number.isSafeInteger(paise) ||
    Math.abs(rupees * 100 - paise) > 0.000001
  ) {
    return null;
  }

  return paise;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function money(amountPaise: number): string {
  return (amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getReference(activity: ActivityRecord): string | null {
  const reference = activity.data?.reference;
  return typeof reference === "string" && reference.length > 0
    ? reference
    : null;
}

// -----------------------------------------------------------------------------
// 1. Real-time SSE stream
// GET /api/staff/live-stream
// -----------------------------------------------------------------------------

staffRoutes.get(
  "/live-stream",
  (_req: Request, res: Response): void => {
    if (res.destroyed || res.writableEnded) return;

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.flushHeaders();
    res.write("retry: 3000\n\n");
    staffEventBus.registerClient(res);
  }
);

// -----------------------------------------------------------------------------
// 2. Staff dashboard metrics
// GET /api/staff/metrics
// -----------------------------------------------------------------------------

staffRoutes.get(
  "/metrics",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        pendingKycCount,
        pendingLoansCount,
        totalAccountsCount,
        totalCustomersCount,
        todayTransactions,
      ] = await Promise.all([
        Customer.countDocuments({ kycStatus: "pending" }),
        Loan.countDocuments({ status: "pending" }),
        BankAccount.countDocuments({ status: "active" }),
        Customer.countDocuments({ role: "customer" }),
        Transaction.find({
          createdAt: { $gte: startOfToday },
          status: "completed",
        })
          .select("amountPaise type")
          .lean(),
      ]);

      const todayVolumePaise = todayTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amountPaise) || 0),
        0
      );

      res.json({
        success: true,
        metrics: {
          pendingKycCount,
          pendingLoansCount,
          totalAccountsCount,
          totalCustomersCount,
          todayTransactionsCount: todayTransactions.length,
          todayVolumeRupees: todayVolumePaise / 100,
          todayWithdrawalsCount: todayTransactions.filter(
            (tx) => tx.type === "withdrawal"
          ).length,
          todayTransfersCount: todayTransactions.filter(
            (tx) => tx.type === "transfer"
          ).length,
          todayDepositsCount: todayTransactions.filter(
            (tx) => tx.type === "deposit"
          ).length,
          activeStaffStreamClients: staffEventBus.getConnectedClientsCount(),
        },
      });
    } catch (error: unknown) {
      console.error("Staff metrics error:", getErrorMessage(error));
      res.status(500).json({
        success: false,
        message: "Failed to load staff statistics.",
      });
    }
  }
);

// -----------------------------------------------------------------------------
// 3. Combined database and in-memory activity feed
// GET /api/staff/live-activity?limit=30
// -----------------------------------------------------------------------------

staffRoutes.get(
  "/live-activity",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestedLimit = Number.parseInt(
        String(req.query.limit ?? "30"),
        10
      );

      const limit = Number.isFinite(requestedLimit)
        ? Math.min(50, Math.max(10, requestedLimit))
        : 30;

      const [memoryEvents, recentTx, recentLoans, recentAccounts] =
        await Promise.all([
          Promise.resolve(staffEventBus.getRecentEvents(limit)),

          Transaction.find({ status: "completed" })
            .populate({
              path: "accountId",
              select: "accountNumber accountType customerId",
              populate: {
                path: "customerId",
                select: "name email phone",
              },
            })
            .populate({
              path: "relatedAccountId",
              select: "accountNumber customerId",
              populate: { path: "customerId", select: "name" },
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(),

          Loan.find()
            .populate("customerId", "name email phone")
            .populate("accountId", "accountNumber")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),

          BankAccount.find()
            .populate("customerId", "name email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        ]);

      const transactionActivities: ActivityRecord[] = recentTx.map(
        (tx: any) => {
          const account = tx.accountId;
          const customer = account?.customerId;
          const relatedAccount = tx.relatedAccountId;
          const recipient = relatedAccount?.customerId;

          let type = "CUSTOMER_TRANSACTION";
          let title = "Customer Transaction";
          let severity: ActivityRecord["severity"] = "info";

          if (tx.type === "withdrawal") {
            type = "CUSTOMER_WITHDRAWAL";
            title = "Customer Cash Withdrawal";
            severity = "warning";
          } else if (tx.type === "deposit") {
            type = "CUSTOMER_DEPOSIT";
            title = "Customer Funds Deposit";
            severity = "success";
          } else if (tx.type === "transfer") {
            type = "CUSTOMER_TRANSFER";
            title = "Customer Fund Transfer";
          } else if (tx.type === "fd_creation") {
            type = "CUSTOMER_FD_OPENED";
            title = "Fixed Deposit Opened";
          }

          const amountPaise = Number(tx.amountPaise) || 0;
          const customerName = customer?.name || "Customer";
          const recipientName =
            recipient?.name || tx.recipientDetails || "Direct Beneficiary";

          let message = tx.description || `${title}: ₹${money(amountPaise)}`;

          if (tx.type === "withdrawal") {
            message = `${customerName} withdrew ₹${money(amountPaise)} from account ${account?.accountNumber || "unknown"}`;
          } else if (tx.type === "deposit") {
            message = `${customerName} deposited ₹${money(amountPaise)} into account ${account?.accountNumber || "unknown"}`;
          } else if (tx.type === "transfer") {
            message = `${customerName} transferred ₹${money(amountPaise)} to ${recipientName}`;
          }

          return {
            id: `tx_${String(tx._id)}`,
            type,
            title,
            message,
            severity,
            timestamp: tx.createdAt,
            data: {
              reference: tx.reference,
              transactionId: String(tx._id),
              amount: amountPaise / 100,
              accountNumber: account?.accountNumber,
              accountType: account?.accountType,
              customerName,
              customerEmail: customer?.email,
              recipientAccountNumber: relatedAccount?.accountNumber,
              recipientName,
              status: tx.status,
              category: tx.category,
            },
          };
        }
      );

      const loanActivities: ActivityRecord[] = recentLoans.map(
        (loan: any) => ({
          id: `loan_${String(loan._id)}`,
          type: "CUSTOMER_LOAN_APPLIED",
          title: "Loan Application",
          message: `${loan.customerId?.name || "Customer"} applied for ₹${money(Number(loan.amountPaise) || 0)} ${loan.loanType || ""} loan`,
          severity: "warning",
          timestamp: loan.createdAt,
          data: {
            loanId: String(loan._id),
            customerName: loan.customerId?.name || "Customer",
            customerEmail: loan.customerId?.email,
            amount: (Number(loan.amountPaise) || 0) / 100,
            loanType: loan.loanType,
            tenureMonths: loan.tenureMonths,
            accountNumber: loan.accountId?.accountNumber,
            status: loan.status,
            purpose: loan.purpose,
          },
        })
      );

      const accountActivities: ActivityRecord[] = recentAccounts.map(
        (account: any) => ({
          id: `acc_${String(account._id)}`,
          type: "CUSTOMER_ACCOUNT_OPENED",
          title: "Customer Account",
          message: `${account.customerId?.name || "Customer"} has an account ${account.accountNumber}`,
          severity: "success",
          timestamp: account.createdAt,
          data: {
            accountId: String(account._id),
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            customerName: account.customerId?.name || "Customer",
            customerEmail: account.customerId?.email,
            balance: (Number(account.balancePaise) || 0) / 100,
            status: account.status,
          },
        })
      );

      const activityMap = new Map<string, ActivityRecord>();

      // Insert recent in-memory events first. These are the events broadcast
      // immediately after successful operations.
      for (const event of memoryEvents as ActivityRecord[]) {
        const reference = getReference(event);
        const key = reference ? `ref:${reference}` : `id:${event.id}`;
        activityMap.set(key, event);
      }

      // Add database activities without duplicating broadcast transaction events.
      const databaseActivities: ActivityRecord[] = [
        ...transactionActivities,
        ...loanActivities,
        ...accountActivities,
      ];

      for (const activity of databaseActivities) {
        const reference = getReference(activity);
        const key = reference
          ? `ref:${reference}`
          : `id:${activity.id}`;

        if (!activityMap.has(key)) {
          activityMap.set(key, activity);
        }
      }

      const activities = Array.from(activityMap.values())
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime()
        )
        .slice(0, limit);

      res.json({
        success: true,
        count: activities.length,
        activities,
      });
    } catch (error: unknown) {
      console.error("Staff live activity error:", getErrorMessage(error));
      res.status(500).json({
        success: false,
        message: "Failed to load customer activity.",
      });
    }
  }
);

// -----------------------------------------------------------------------------
// 4. KYC queue
// GET /api/staff/kyc-customers
// -----------------------------------------------------------------------------

staffRoutes.get(
  "/kyc-customers",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const customers = await Customer.find({ role: "customer" })
        .select("name email phone address kycStatus status createdAt")
        .sort({ kycStatus: 1, createdAt: -1 })
        .lean();

      res.json({
        success: true,
        customers: customers.map((customer: any) => ({
          id: String(customer._id),
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "—",
          address: customer.address || "—",
          kycStatus: customer.kycStatus,
          status: customer.status,
          createdAt: customer.createdAt,
        })),
      });
    } catch (error: unknown) {
      console.error("KYC queue error:", getErrorMessage(error));
      res.status(500).json({
        success: false,
        message: "Failed to fetch KYC queue.",
      });
    }
  }
);

// -----------------------------------------------------------------------------
// 5. Update KYC status
// PATCH /api/staff/kyc/:id
// -----------------------------------------------------------------------------

staffRoutes.patch(
  "/kyc/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body as {
        status?: unknown;
        remarks?: unknown;
      };

      const staff = res.locals.authenticatedUser;

      if (status !== "verified" && status !== "rejected") {
        res.status(400).json({
          success: false,
          message: "Status must be 'verified' or 'rejected'.",
        });
        return;
      }

      if (
        remarks !== undefined &&
        (typeof remarks !== "string" || remarks.length > 500)
      ) {
        res.status(400).json({
          success: false,
          message: "Remarks must be text with at most 500 characters.",
        });
        return;
      }

      const customer = await Customer.findById(id);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: "Customer not found.",
        });
        return;
      }

      customer.kycStatus = status;
      await customer.save();

      // Broadcast the completed update before non-critical side effects.
      broadcastStaffEvent({
        type: "CUSTOMER_KYC_UPDATED",
        title: `Customer KYC ${status === "verified" ? "Verified" : "Rejected"}`,
        message: `KYC for ${customer.name} was updated to ${status}.`,
        severity: status === "verified" ? "success" : "warning",
        data: {
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          kycStatus: status,
        },
      });

      try {
        await logAudit({
          userId: staff?.customerId,
          userName: "Bank Staff",
          userRole: staff?.role,
          action: "KYC_STATUS_UPDATED",
          details: `Customer ${customer.name} KYC set to ${status}. Remarks: ${remarks || "None"}`,
        });

        await sendNotification({
          customerId: customer._id.toString(),
          title: `KYC Verification ${status === "verified" ? "Approved" : "Needs Attention"}`,
          message:
            status === "verified"
              ? "Your KYC documents have been verified."
              : `Your KYC verification was not approved. Remarks: ${remarks || "Please re-submit valid ID documents."}`,
          type: "security",
        });
      } catch (sideEffectError: unknown) {
        console.error(
          "KYC side effect error:",
          getErrorMessage(sideEffectError)
        );
      }

      res.json({
        success: true,
        message: `KYC for ${customer.name} updated to ${status}.`,
        customer: {
          id: customer.id,
          kycStatus: customer.kycStatus,
        },
      });
    } catch (error: unknown) {
      console.error("KYC update error:", getErrorMessage(error));
      res.status(500).json({
        success: false,
        message: "Failed to update KYC.",
      });
    }
  }
);

// -----------------------------------------------------------------------------
// Shared teller deposit/withdrawal handler
// -----------------------------------------------------------------------------

async function processTellerTransaction(
  req: Request,
  res: Response,
  kind: TransactionKind
): Promise<void> {
  try {
    const { accountNumber, amountRupees, remarks } = req.body as {
      accountNumber?: unknown;
      amountRupees?: unknown;
      remarks?: unknown;
    };

    const staff = res.locals.authenticatedUser;
    const amountPaise = parseAmountRupees(amountRupees);

    if (
      typeof accountNumber !== "string" ||
      accountNumber.trim().length === 0 ||
      amountPaise === null
    ) {
      res.status(400).json({
        success: false,
        message:
          "A valid account number and positive amount with up to two decimal places are required.",
      });
      return;
    }

    if (
      remarks !== undefined &&
      (typeof remarks !== "string" || remarks.length > 300)
    ) {
      res.status(400).json({
        success: false,
        message: "Remarks must be text with at most 300 characters.",
      });
      return;
    }

    const account = await BankAccount.findOne({
      accountNumber: accountNumber.trim(),
    }).populate("customerId");

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Bank account not found.",
      });
      return;
    }

    if (account.status !== "active") {
      res.status(400).json({
        success: false,
        message: `Account is ${account.status}. Transaction cannot be processed.`,
      });
      return;
    }

    if (kind === "withdrawal" && account.balancePaise < amountPaise) {
      res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${money(account.balancePaise)}`,
      });
      return;
    }

    // Important: for a real banking system, balance and ledger changes must
    // use a MongoDB transaction/session to prevent partial updates.
    account.balancePaise +=
      kind === "deposit" ? amountPaise : -amountPaise;

    await account.save();

    const referencePrefix =
      kind === "deposit" ? "VB-TELL-DEP" : "VB-TELL-WTH";

    const reference = `${referencePrefix}-${randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase()}`;

    const tx = await Transaction.create({
      accountId: account._id,
      reference,
      type: kind,
      category:
        kind === "deposit"
          ? "Branch Cash Deposit"
          : "Branch Cash Withdrawal",
      amountPaise,
      description:
        typeof remarks === "string" && remarks.trim()
          ? `Teller ${kind}: ${remarks.trim()}`
          : `Branch Teller Cash ${kind}`,
      status: "completed",
    });

    const customer = account.customerId as any;
    const amountRupeesValue = amountPaise / 100;

    // Broadcast after the transaction document has been successfully created.
    broadcastStaffEvent({
      type: kind === "deposit" ? "CUSTOMER_DEPOSIT" : "CUSTOMER_WITHDRAWAL",
      title: kind === "deposit" ? "Branch Teller Deposit" : "Branch Teller Withdrawal",
      message: `${kind === "deposit" ? "Deposit" : "Withdrawal"} of ₹${money(amountPaise)} processed for ${customer?.name || "Customer"} (${account.accountNumber}).`,
      severity: kind === "deposit" ? "success" : "warning",
      data: {
        reference: tx.reference,
        transactionId: tx._id.toString(),
        amount: amountRupeesValue,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        customerId: customer?._id?.toString(),
        customerName: customer?.name || "Customer",
        customerEmail: customer?.email,
        balance: account.balancePaise / 100,
        status: tx.status,
        category: tx.category,
      },
    });

    // Logging and notifications are secondary: failure here should not make a
    // committed transaction appear to have failed to the caller.
    try {
      await logAudit({
        userId: staff?.customerId,
        userName: "Bank Staff",
        userRole: staff?.role,
        action: kind === "deposit" ? "TELLER_DEPOSIT" : "TELLER_WITHDRAWAL",
        details: `Teller ${kind} of ₹${money(amountPaise)} for account ${account.accountNumber}. Ref: ${reference}`,
      });

      if (customer?._id) {
        await sendNotification({
          customerId: customer._id.toString(),
          title:
            kind === "deposit"
              ? "Teller Cash Deposit Credited"
              : "Teller Cash Withdrawal Debited",
          message: `₹${money(amountPaise)} ${kind === "deposit" ? "was deposited into" : "was withdrawn from"} your account. Reference: ${reference}`,
          type: "transaction",
        });
      }
    } catch (sideEffectError: unknown) {
      console.error(
        "Teller audit/notification error:",
        getErrorMessage(sideEffectError)
      );
    }

    res.status(201).json({
      success: true,
      message: `₹${money(amountPaise)} ${kind === "deposit" ? "deposited" : "withdrawal processed"} successfully.`,
      transaction: {
        id: tx._id.toString(),
        reference: tx.reference,
        type: kind,
        amount: amountRupeesValue,
        accountNumber: account.accountNumber,
        customerName: customer?.name || "VaultBank Customer",
        balance: account.balancePaise / 100,
      },
    });
  } catch (error: unknown) {
    console.error(`Teller ${kind} error:`, getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: `Teller ${kind} failed.`,
    });
  }
}

// -----------------------------------------------------------------------------
// 6. Teller cash deposit
// POST /api/staff/teller-deposit
// -----------------------------------------------------------------------------

staffRoutes.post(
  "/teller-deposit",
  async (req: Request, res: Response): Promise<void> => {
    await processTellerTransaction(req, res, "deposit");
  }
);

// -----------------------------------------------------------------------------
// 7. Teller cash withdrawal
// POST /api/staff/teller-withdraw
// -----------------------------------------------------------------------------

staffRoutes.post(
  "/teller-withdraw",
  async (req: Request, res: Response): Promise<void> => {
    await processTellerTransaction(req, res, "withdrawal");
  }
);

// -----------------------------------------------------------------------------
// 8. Staff customer directory
// GET /api/staff/customers
// -----------------------------------------------------------------------------

staffRoutes.get(
  "/customers",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, status, kycStatus } = req.query;
      const filter: Record<string, any> = { role: "customer" };

      if (search) {
        const query = escapeRegex(String(search).trim());

        if (query) {
          filter.$or = [
            { name: { $regex: query, $options: "i" } },
            { email: { $regex: query, $options: "i" } },
            { phone: { $regex: query, $options: "i" } },
          ];
        }
      }

      if (status && ["active", "frozen", "blocked"].includes(String(status))) {
        filter.status = String(status);
      }

      if (
        kycStatus &&
        ["verified", "pending", "rejected"].includes(String(kycStatus))
      ) {
        filter.kycStatus = String(kycStatus);
      }

      const customers = await Customer.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      const customerIds = customers.map((customer) => customer._id);

      const accounts = await BankAccount.find({
        customerId: { $in: customerIds },
      }).lean();

      const accountsByCustomer: Record<string, any[]> = {};

      for (const account of accounts) {
        const customerId = String(account.customerId);
        (accountsByCustomer[customerId] ||= []).push(account);
      }

      res.json({
        success: true,
        count: customers.length,
        customers: customers.map((customer: any) => {
          const customerAccounts =
            accountsByCustomer[String(customer._id)] || [];

          const totalBalancePaise = customerAccounts.reduce(
            (sum, account) => sum + (Number(account.balancePaise) || 0),
            0
          );

          return {
            id: String(customer._id),
            name: customer.name,
            email: customer.email,
            phone: customer.phone || "—",
            address: customer.address || "—",
            kycStatus: customer.kycStatus || "pending",
            status: customer.status || "active",
            dailyLimitRupees: customer.dailyLimitRupees || 50000,
            accountCount: customerAccounts.length,
            totalBalanceRupees: totalBalancePaise / 100,
            accounts: customerAccounts.map((account) => ({
              id: String(account._id),
              accountNumber: account.accountNumber,
              accountType: account.accountType,
              balance: (Number(account.balancePaise) || 0) / 100,
              status: account.status,
            })),
            createdAt: customer.createdAt,
          };
        }),
      });
    } catch (error: unknown) {
      console.error("Staff customer directory error:", getErrorMessage(error));
      res.status(500).json({
        success: false,
        message: "Failed to load customer directory.",
      });
    }
  }
);

export default staffRoutes;
