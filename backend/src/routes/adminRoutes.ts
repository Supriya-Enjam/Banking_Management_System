import { Router, type Request, type Response } from "express";
import authenticate, { requireRoles } from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";
import { Loan } from "../models/Loan";
import { FixedDeposit } from "../models/FixedDeposit";
import { AuditLog } from "../models/AuditLog";
import { logAudit, sendNotification } from "../utils/auditAndNotify";

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRoles("admin"));

// 1. Overview KPIs
adminRoutes.get("/metrics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      customerCount,
      accounts,
      transactions,
      loans,
      fds,
      pendingLoansCount,
    ] = await Promise.all([
      Customer.countDocuments({ role: "customer" }),
      BankAccount.find().select("balancePaise status").lean(),
      Transaction.find({ status: "completed" }).select("amountPaise type createdAt").lean(),
      Loan.find().select("amountPaise status remainingAmountPaise").lean(),
      FixedDeposit.find({ status: "active" }).select("amountPaise").lean(),
      Loan.countDocuments({ status: "pending" }),
    ]);

    const totalReservesPaise = accounts.reduce((sum, acc) => sum + (acc.balancePaise || 0), 0);
    const activeAccountsCount = accounts.filter((a) => a.status === "active").length;

    // Disbursed loans
    const disbursedLoans = loans.filter((l) => l.status === "approved" || l.status === "disbursed");
    const totalLoansDisbursedPaise = disbursedLoans.reduce((sum, l) => sum + l.amountPaise, 0);

    // Active FD reserves
    const totalFdReservesPaise = fds.reduce((sum, f) => sum + f.amountPaise, 0);

    // Today's transaction volume
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTx = transactions.filter((t) => new Date(t.createdAt) >= startOfToday);
    const todayVolumePaise = todayTx.reduce((sum, t) => sum + t.amountPaise, 0);

    res.json({
      success: true,
      metrics: {
        totalCustomers: customerCount,
        activeAccounts: activeAccountsCount,
        totalAccounts: accounts.length,
        totalReserves: totalReservesPaise / 100,
        totalLoansDisbursed: totalLoansDisbursedPaise / 100,
        pendingLoansCount,
        totalFixedDeposits: totalFdReservesPaise / 100,
        todayVolume: todayVolumePaise / 100,
        totalTransactionsCount: transactions.length,
      },
    });
  } catch (error) {
    console.error("Admin metrics error:", error);
    res.status(500).json({ success: false, message: "Failed to load admin metrics." });
  }
});

// 2. List all customers with accounts and aggregate balances
adminRoutes.get("/customers", async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const filter: Record<string, any> = {};

    if (search) {
      const q = String(search).trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();

    // Attach account stats for each customer
    const customerIds = customers.map((c) => c._id);
    const accounts = await BankAccount.find({ customerId: { $in: customerIds } }).lean();

    const accountsByCustomer: Record<string, any[]> = {};
    accounts.forEach((acc) => {
      const cId = acc.customerId.toString();
      if (!accountsByCustomer[cId]) accountsByCustomer[cId] = [];
      accountsByCustomer[cId].push(acc);
    });

    res.json({
      success: true,
      count: customers.length,
      customers: customers.map((c) => {
        const custAccs = accountsByCustomer[c._id.toString()] || [];
        const totalBalancePaise = custAccs.reduce((sum, a) => sum + (a.balancePaise || 0), 0);

        return {
          id: c._id.toString(),
          name: c.name,
          email: c.email,
          role: c.role,
          phone: c.phone || "—",
          address: c.address || "—",
          kycStatus: c.kycStatus || "verified",
          status: c.status || "active",
          dailyLimitRupees: c.dailyLimitRupees || 50000,
          accountCount: custAccs.length,
          totalBalanceRupees: totalBalancePaise / 100,
          accounts: custAccs.map((a) => ({
            id: a._id.toString(),
            accountNumber: a.accountNumber,
            accountType: a.accountType,
            balance: a.balancePaise / 100,
            status: a.status,
          })),
          createdAt: c.createdAt,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load customers." });
  }
});

// 3. Update customer status / KYC / daily limit
adminRoutes.patch("/customers/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, kycStatus, dailyLimitRupees, role } = req.body;
    const adminUser = res.locals.authenticatedUser;

    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404).json({ success: false, message: "Customer not found." });
      return;
    }

    if (status && ["active", "frozen", "blocked"].includes(status)) {
      customer.status = status;
    }
    if (kycStatus && ["verified", "pending", "rejected"].includes(kycStatus)) {
      customer.kycStatus = kycStatus;
    }
    if (dailyLimitRupees && Number(dailyLimitRupees) >= 1000) {
      customer.dailyLimitRupees = Number(dailyLimitRupees);
    }
    if (role && ["customer", "staff", "admin"].includes(role)) {
      customer.role = role;
    }

    await customer.save();

    await logAudit({
      userId: adminUser?.customerId,
      userName: "Administrator",
      userRole: "admin",
      action: "CUSTOMER_MODIFIED",
      details: `Admin modified customer ${customer.name} (${customer.email}): Status=${customer.status}, KYC=${customer.kycStatus}, DailyLimit=₹${customer.dailyLimitRupees}.`,
      severity: customer.status === "blocked" ? "critical" : "info",
    });

    await sendNotification({
      customerId: customer._id.toString(),
      title: "Account Status Update",
      message: `Your profile status is set to "${customer.status}". Daily transaction limit: ₹${customer.dailyLimitRupees.toLocaleString()}.`,
      type: "security",
    });

    res.json({
      success: true,
      message: `Customer ${customer.name} profile updated successfully.`,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        kycStatus: customer.kycStatus,
        dailyLimitRupees: customer.dailyLimitRupees,
        role: customer.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update customer." });
  }
});

// 4. Audit Trail Logs
adminRoutes.get("/audit-logs", async (req: Request, res: Response): Promise<void> => {
  try {
    const { severity, action, limit = "50" } = req.query;
    const filter: Record<string, any> = {};

    if (severity && severity !== "all") filter.severity = severity;
    if (action && action !== "all") filter.action = action;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50)))
      .lean();

    res.json({
      success: true,
      count: logs.length,
      logs: logs.map((l) => ({
        id: l._id.toString(),
        userName: l.userName,
        userEmail: l.userEmail,
        userRole: l.userRole,
        action: l.action,
        details: l.details,
        severity: l.severity,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load audit logs." });
  }
});

// 5. Financial breakdown & Reports
adminRoutes.get("/reports", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [accounts, transactions, loans] = await Promise.all([
      BankAccount.find().select("accountType balancePaise status").lean(),
      Transaction.find({ status: "completed" }).select("type amountPaise category createdAt").lean(),
      Loan.find().select("loanType amountPaise status").lean(),
    ]);

    // Account distribution
    const accountTypeCounts: Record<string, { count: number; balance: number }> = {
      savings: { count: 0, balance: 0 },
      current: { count: 0, balance: 0 },
      business: { count: 0, balance: 0 },
    };

    accounts.forEach((acc) => {
      if (accountTypeCounts[acc.accountType]) {
        accountTypeCounts[acc.accountType].count++;
        accountTypeCounts[acc.accountType].balance += acc.balancePaise / 100;
      }
    });

    // Transaction categories
    const categoryTotals: Record<string, number> = {};
    transactions.forEach((tx) => {
      const cat = tx.category || "General";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amountPaise / 100;
    });

    // Loan distribution
    const loanDistribution: Record<string, number> = {};
    loans.forEach((l) => {
      loanDistribution[l.loanType] = (loanDistribution[l.loanType] || 0) + l.amountPaise / 100;
    });

    res.json({
      success: true,
      reports: {
        accountDistribution: Object.entries(accountTypeCounts).map(([type, d]) => ({
          type,
          count: d.count,
          totalBalance: d.balance,
        })),
        categoryTotals: Object.entries(categoryTotals).map(([category, amount]) => ({
          category,
          amount,
        })),
        loanDistribution: Object.entries(loanDistribution).map(([type, amount]) => ({
          type,
          amount,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to generate system reports." });
  }
});

export default adminRoutes;
