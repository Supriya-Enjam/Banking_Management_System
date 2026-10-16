import { Router, type Request, type Response } from "express";
import { z } from "zod";
import authenticate from "../middleware/authenticate";
import { Beneficiary } from "../models/Beneficiary";
import { BankAccount } from "../models/BankAccount";
import { Customer } from "../models/Customer";
import { logAudit } from "../utils/auditAndNotify";

export const beneficiaryRoutes = Router();

beneficiaryRoutes.use(authenticate);

const beneficiarySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  accountNumber: z.string().trim().min(5, "Account number must be valid."),
  bankName: z.string().trim().min(2, "Bank name is required."),
  ifscCode: z.string().trim().min(4, "IFSC code is required."),
  nickname: z.string().trim().optional(),
  maxLimitRupees: z.number().min(500).max(1000000).optional(),
});

// Lookup account details (e.g. if internal VaultBank account)
beneficiaryRoutes.get("/lookup/:accountNumber", async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber } = req.params;
    const account = await BankAccount.findOne({ accountNumber: String(accountNumber).trim() })
      .populate("customerId", "name")
      .lean();

    if (!account) {
      res.json({
        success: true,
        found: false,
        isInternal: false,
      });
      return;
    }

    const cust: any = account.customerId;
    res.json({
      success: true,
      found: true,
      isInternal: true,
      customerName: cust?.name || "VaultBank Account Holder",
      accountType: account.accountType,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lookup failed." });
  }
});

// List saved beneficiaries for the logged-in customer
beneficiaryRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const beneficiaries = await Beneficiary.find({ customerId }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      count: beneficiaries.length,
      beneficiaries: beneficiaries.map((b) => ({
        id: b._id.toString(),
        name: b.name,
        accountNumber: b.accountNumber,
        bankName: b.bankName,
        ifscCode: b.ifscCode,
        nickname: b.nickname || b.name,
        maxLimitRupees: b.maxLimitRupees || 50000,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load beneficiaries." });
  }
});

// Add a beneficiary
beneficiaryRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const parsed = beneficiarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid beneficiary details.",
      });
      return;
    }

    const { name, accountNumber, bankName, ifscCode, nickname, maxLimitRupees } = parsed.data;

    // Check if duplicate
    const exists = await Beneficiary.findOne({ customerId, accountNumber });
    if (exists) {
      res.status(409).json({
        success: false,
        message: "This beneficiary account is already saved in your list.",
      });
      return;
    }

    const beneficiary = await Beneficiary.create({
      customerId,
      name,
      accountNumber,
      bankName: bankName || "VaultBank",
      ifscCode: ifscCode || "VAULT000108",
      nickname: nickname || name,
      maxLimitRupees: maxLimitRupees || 50000,
    });

    await logAudit({
      userId: customerId,
      action: "BENEFICIARY_ADDED",
      details: `Added payee ${name} (${accountNumber}) at ${bankName}.`,
    });

    res.status(201).json({
      success: true,
      message: "Beneficiary added successfully.",
      beneficiary: {
        id: beneficiary.id,
        name: beneficiary.name,
        accountNumber: beneficiary.accountNumber,
        bankName: beneficiary.bankName,
        ifscCode: beneficiary.ifscCode,
        nickname: beneficiary.nickname,
        maxLimitRupees: beneficiary.maxLimitRupees,
      },
    });
  } catch (error) {
    console.error("Add beneficiary error:", error);
    res.status(500).json({ success: false, message: "Failed to add beneficiary." });
  }
});

// Delete a beneficiary
beneficiaryRoutes.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    const { id } = req.params;

    const deleted = await Beneficiary.findOneAndDelete({ _id: id, customerId });
    if (!deleted) {
      res.status(404).json({ success: false, message: "Beneficiary not found." });
      return;
    }

    await logAudit({
      userId: customerId,
      action: "BENEFICIARY_DELETED",
      details: `Removed beneficiary ${deleted.name} (${deleted.accountNumber}).`,
    });

    res.json({
      success: true,
      message: "Beneficiary removed successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to remove beneficiary." });
  }
});

export default beneficiaryRoutes;
