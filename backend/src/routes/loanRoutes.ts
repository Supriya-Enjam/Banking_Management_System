import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import authenticate, { requireRoles } from "../middleware/authenticate";
import { Loan } from "../models/Loan";
import { BankAccount } from "../models/BankAccount";
import { Customer } from "../models/Customer";
import { Transaction } from "../models/Transaction";
import { logAudit, sendNotification } from "../utils/auditAndNotify";
import { broadcastStaffEvent } from "../utils/staffEventBus";

export const loanRoutes = Router();

loanRoutes.use(authenticate);

const loanRates: Record<string, number> = {
  Personal: 10.5,
  Home: 8.4,
  Vehicle: 9.0,
  Education: 7.5,
  Business: 11.5,
};

function calculateEmi(principalPaise: number, annualRate: number, tenureMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return Math.round(principalPaise / tenureMonths);

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principalPaise * monthlyRate * factor) / (factor - 1);
  return Math.round(emi);
}

const applyLoanSchema = z.object({
  accountId: z.string().min(1, "Account ID is required for disbursement."),
  loanType: z.enum(["Personal", "Home", "Vehicle", "Education", "Business"]),
  amountRupees: z.number().min(10000, "Minimum loan amount is ₹10,000.").max(10000000, "Maximum loan amount is ₹10,000,000."),
  tenureMonths: z.number().min(6).max(360),
  purpose: z.string().trim().min(3, "Please provide the loan purpose."),
});

// Calculate EMI preview endpoint
loanRoutes.post("/calculate", (req: Request, res: Response) => {
  const { amountRupees = 100000, loanType = "Personal", tenureMonths = 12 } = req.body;
  const rate = loanRates[loanType] || 10.0;
  const principalPaise = Math.round(amountRupees * 100);
  const emiPaise = calculateEmi(principalPaise, rate, Number(tenureMonths));
  const totalRepaymentPaise = emiPaise * Number(tenureMonths);

  res.json({
    success: true,
    loanType,
    interestRate: rate,
    tenureMonths: Number(tenureMonths),
    principalRupees: amountRupees,
    monthlyEmiRupees: emiPaise / 100,
    totalInterestRupees: (totalRepaymentPaise - principalPaise) / 100,
    totalRepaymentRupees: totalRepaymentPaise / 100,
  });
});

// 1. Customer: Apply for a new loan
loanRoutes.post("/apply", async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const parsed = applyLoanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid loan application parameters.",
      });
      return;
    }

    const { accountId, loanType, amountRupees, tenureMonths, purpose } = parsed.data;

    const account = await BankAccount.findOne({ _id: accountId, customerId, status: "active" });
    if (!account) {
      res.status(404).json({ success: false, message: "Active bank account not found for disbursement." });
      return;
    }

    const interestRate = loanRates[loanType] || 10.0;
    const amountPaise = Math.round(amountRupees * 100);
    const emiPaise = calculateEmi(amountPaise, interestRate, tenureMonths);

    const loan = await Loan.create({
      customerId,
      accountId: account._id,
      loanType,
      amountPaise,
      interestRate,
      tenureMonths,
      emiPaise,
      remainingAmountPaise: emiPaise * tenureMonths,
      paidEmis: 0,
      purpose,
      status: "pending",
      reviewNotes: "Application submitted. Under review by Bank Staff.",
    });

    await logAudit({
      userId: customerId,
      action: "LOAN_APPLIED",
      details: `Applied for ${loanType} loan of ₹${amountRupees.toLocaleString()} for ${tenureMonths} months.`,
    });

    await sendNotification({
      customerId,
      title: "Loan Application Received",
      message: `Your ${loanType} loan application of ₹${amountRupees.toLocaleString()} is submitted and under review.`,
      type: "loan",
    });

    // Broadcast to bank staff live feed
    const loanCust = await Customer.findById(customerId).select("name email phone").lean();
    broadcastStaffEvent({
      type: "CUSTOMER_LOAN_APPLIED",
      title: "New Loan Application",
      message: `${loanCust?.name || "Customer"} applied for ₹${amountRupees.toLocaleString()} ${loanType} Loan (${tenureMonths} months).`,
      severity: "warning",
      data: {
        loanId: loan.id,
        customerId,
        customerName: loanCust?.name || "Customer",
        customerEmail: loanCust?.email,
        amount: amountRupees,
        loanType,
        tenureMonths,
        accountNumber: account.accountNumber,
        status: "pending",
        purpose,
      },
    });

    res.status(201).json({
      success: true,
      message: "Loan application submitted successfully. Bank staff will review shortly.",
      loan: {
        id: loan.id,
        loanType: loan.loanType,
        amountRupees,
        interestRate,
        tenureMonths,
        monthlyEmiRupees: emiPaise / 100,
        status: loan.status,
        createdAt: loan.createdAt,
      },
    });
  } catch (error) {
    console.error("Loan application error:", error);
    res.status(500).json({ success: false, message: "Failed to submit loan application." });
  }
});

// 2. Customer: Get my loans
loanRoutes.get("/my", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const loans = await Loan.find({ customerId })
      .populate("accountId", "accountNumber")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: loans.length,
      loans: loans.map((loan: any) => ({
        id: loan._id.toString(),
        loanType: loan.loanType,
        amount: loan.amountPaise / 100,
        amountPaise: loan.amountPaise,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        emiAmount: loan.emiPaise / 100,
        emiPaise: loan.emiPaise,
        remainingAmount: loan.remainingAmountPaise / 100,
        remainingAmountPaise: loan.remainingAmountPaise,
        paidEmis: loan.paidEmis,
        purpose: loan.purpose,
        status: loan.status,
        accountNumber: loan.accountId?.accountNumber || "—",
        reviewNotes: loan.reviewNotes,
        createdAt: loan.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load loans." });
  }
});

// 3. Staff / Admin: List all loans across the bank
loanRoutes.get("/all", requireRoles("staff", "management","admin"), async (_req: Request, res: Response): Promise<void> => {
  try {
    const loans = await Loan.find()
      .populate("customerId", "name email phone kycStatus")
      .populate("accountId", "accountNumber")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: loans.length,
      loans: loans.map((loan: any) => ({
        id: loan._id.toString(),
        customer: loan.customerId
          ? {
              id: loan.customerId._id?.toString(),
              name: loan.customerId.name,
              email: loan.customerId.email,
              phone: loan.customerId.phone,
              kycStatus: loan.customerId.kycStatus,
            }
          : null,
        accountNumber: loan.accountId?.accountNumber || "—",
        loanType: loan.loanType,
        amount: loan.amountPaise / 100,
        amountPaise: loan.amountPaise,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        emiAmount: loan.emiPaise / 100,
        remainingAmount: loan.remainingAmountPaise / 100,
        paidEmis: loan.paidEmis,
        purpose: loan.purpose,
        status: loan.status,
        reviewNotes: loan.reviewNotes,
        createdAt: loan.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load all loans." });
  }
});

// 4. Staff / Admin: Approve or Reject a loan
loanRoutes.patch("/:id/review", requireRoles("staff", "admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'reject'
    const reviewer = res.locals.authenticatedUser;

    if (!["approve", "reject"].includes(action)) {
      res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'." });
      return;
    }

    const loan = await Loan.findById(id).populate("accountId").populate("customerId");
    if (!loan) {
      res.status(404).json({ success: false, message: "Loan application not found." });
      return;
    }

    if (loan.status !== "pending") {
      res.status(400).json({ success: false, message: `Loan is already ${loan.status}.` });
      return;
    }

    const custObj: any = loan.customerId;
    const accObj: any = loan.accountId;

    if (action === "approve") {
      loan.status = "approved";
      loan.reviewNotes = notes || "Approved by Bank Review Team.";
      loan.reviewedBy = reviewer?.customerId as any;
      await loan.save();

      // Disburse amount to customer account
      if (accObj && accObj.status === "active") {
        accObj.balancePaise += loan.amountPaise;
        await accObj.save();

        const reference = `VB-DISB-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

        await Transaction.create({
          accountId: accObj._id,
          reference,
          type: "loan_disbursement",
          category: "Loan",
          amountPaise: loan.amountPaise,
          description: `${loan.loanType} Loan Disbursed to account ${accObj.accountNumber}`,
          status: "completed",
        });

        await sendNotification({
          customerId: custObj._id.toString(),
          title: "🎉 Loan Approved & Disbursed!",
          message: `Your ${loan.loanType} loan of ₹${(loan.amountPaise / 100).toLocaleString()} has been approved and credited to ${accObj.accountNumber}.`,
          type: "loan",
        });
      }
    } else {
      loan.status = "rejected";
      loan.reviewNotes = notes || "Application does not meet the eligibility criteria.";
      loan.reviewedBy = reviewer?.customerId as any;
      await loan.save();

      await sendNotification({
        customerId: custObj._id.toString(),
        title: "Loan Application Status",
        message: `Your ${loan.loanType} loan application was declined. Reason: ${loan.reviewNotes}`,
        type: "loan",
      });
    }

    await logAudit({
      userId: reviewer?.customerId,
      userName: reviewer?.role,
      userRole: reviewer?.role,
      action: action === "approve" ? "LOAN_APPROVED" : "LOAN_REJECTED",
      details: `${action === "approve" ? "Approved" : "Rejected"} loan of ₹${(loan.amountPaise / 100).toLocaleString()} for ${custObj?.name}. Notes: ${loan.reviewNotes}`,
    });

    res.json({
      success: true,
      message: `Loan application ${action === "approve" ? "approved and disbursed" : "rejected"}.`,
      loan: {
        id: loan.id,
        status: loan.status,
        reviewNotes: loan.reviewNotes,
      },
    });
  } catch (error) {
    console.error("Loan review error:", error);
    res.status(500).json({ success: false, message: "Failed to update loan status." });
  }
});

// 5. Customer: Pay an EMI for an active loan
loanRoutes.post("/:id/pay-emi", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = res.locals.authenticatedUser?.customerId;

    const loan = await Loan.findOne({ _id: id, customerId, status: "approved" });
    if (!loan) {
      res.status(404).json({ success: false, message: "Active loan not found." });
      return;
    }

    const account = await BankAccount.findById(loan.accountId);
    if (!account || account.status !== "active") {
      res.status(400).json({ success: false, message: "Repayment bank account is inactive." });
      return;
    }

    if (account.balancePaise < loan.emiPaise) {
      res.status(400).json({
        success: false,
        message: `Insufficient balance to pay EMI of ₹${(loan.emiPaise / 100).toLocaleString()}. Available: ₹${(account.balancePaise / 100).toLocaleString()}`,
      });
      return;
    }

    // Deduct EMI
    account.balancePaise -= loan.emiPaise;
    await account.save();

    loan.paidEmis += 1;
    loan.remainingAmountPaise = Math.max(0, loan.remainingAmountPaise - loan.emiPaise);

    if (loan.remainingAmountPaise === 0 || loan.paidEmis >= loan.tenureMonths) {
      loan.status = "closed";
    }
    await loan.save();

    const reference = `VB-EMI-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    await Transaction.create({
      accountId: account._id,
      reference,
      type: "loan_repayment",
      category: "Loan Repayment",
      amountPaise: loan.emiPaise,
      description: `EMI payment for ${loan.loanType} Loan (Installment #${loan.paidEmis})`,
      status: "completed",
    });

    await logAudit({
      userId: customerId,
      action: "LOAN_EMI_PAID",
      details: `Paid installment #${loan.paidEmis} of ₹${(loan.emiPaise / 100).toLocaleString()} for ${loan.loanType} loan.`,
    });

    await sendNotification({
      customerId: customerId as string,
      title: "EMI Payment Successful",
      message: `EMI #${loan.paidEmis} of ₹${(loan.emiPaise / 100).toLocaleString()} paid successfully. Remaining balance: ₹${(loan.remainingAmountPaise / 100).toLocaleString()}`,
      type: "loan",
    });

    res.json({
      success: true,
      message: `EMI #${loan.paidEmis} paid successfully.`,
      loan: {
        id: loan.id,
        paidEmis: loan.paidEmis,
        remainingAmount: loan.remainingAmountPaise / 100,
        status: loan.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "EMI payment failed." });
  }
});

export default loanRoutes;
