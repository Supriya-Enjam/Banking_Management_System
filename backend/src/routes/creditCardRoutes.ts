
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { createHash, randomInt, randomUUID } from "node:crypto";

import authenticate from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { CreditCard } from "../models/CreditCard";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";

const creditCardRoutes = Router();

creditCardRoutes.use(authenticate);

// ------------------------------------------------------
// Types and helpers
// ------------------------------------------------------

type AuthenticatedUser = {
  customerId: string;
  role: string;
};

function isCustomer(user: unknown): user is AuthenticatedUser {
  if (typeof user !== "object" || user === null) {
    return false;
  }

  const candidate = user as Record<string, unknown>;

  return (
    typeof candidate.customerId === "string" &&
    candidate.role === "customer" &&
    mongoose.isValidObjectId(candidate.customerId)
  );
}

function isStaffOrAdmin(
  user: unknown
): user is { role: string } {
  if (typeof user !== "object" || user === null) {
    return false;
  }

  const candidate = user as Record<string, unknown>;

  return (
    typeof candidate.role === "string" &&
    ["staff", "admin"].includes(candidate.role)
  );
}

function hashCardNumber(cardNumber: string): string {
  return createHash("sha256").update(cardNumber).digest("hex");
}

function makeReference(prefix: string): string {
  return `${prefix}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase()}`;
}

function parseRupeesToPaise(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.round(value * 100) !== value * 100
  ) {
    return null;
  }

  const paise = Math.round(value * 100);

  return Number.isSafeInteger(paise) ? paise : null;
}

function httpError(message: string, statusCode: number): Error & {
  statusCode: number;
} {
  return Object.assign(new Error(message), { statusCode });
}

function sendRouteError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  logLabel: string
): void {
  const err = error as Error & { statusCode?: number };

  console.error(logLabel, err?.message ?? error);

  const statusCode =
    typeof err?.statusCode === "number" ? err.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallbackMessage : err.message,
  });
}

async function generateCardNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const cardNumber = Array.from(
      { length: 4 },
      () => randomInt(0, 10000).toString().padStart(4, "0")
    ).join("");

    const exists = await CreditCard.exists({
      cardNumberHash: hashCardNumber(cardNumber),
    });

    if (!exists) {
      return cardNumber;
    }
  }

  throw new Error("Unable to generate a unique demo card number.");
}

// ------------------------------------------------------
// POST /api/cards/credit/apply
// Customer applies for a credit card.
// Body: { "requestedLimitRupees": 50000 }
// ------------------------------------------------------

creditCardRoutes.post(
  "/apply",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;

      if (!isCustomer(user)) {
        res.status(403).json({
          success: false,
          message: "Only authenticated customers can apply for credit cards.",
        });
        return;
      }

      const customerId = user.customerId;

      const customer = await Customer.findById(customerId).select(
        "_id status"
      );

      if (!customer || customer.status !== "active") {
        res.status(403).json({
          success: false,
          message: "An active customer profile is required.",
        });
        return;
      }

      const requestedLimitRupees = req.body?.requestedLimitRupees;

      if (
        typeof requestedLimitRupees !== "number" ||
        !Number.isSafeInteger(requestedLimitRupees) ||
        requestedLimitRupees < 5000 ||
        requestedLimitRupees > 500000
      ) {
        res.status(400).json({
          success: false,
          message:
            "Choose a whole-rupee credit limit between ₹5,000 and ₹5,00,000.",
        });
        return;
      }

      const existingApplication = await CreditCard.exists({
        customerId: customer._id,
        status: { $in: ["pending", "active"] },
      });

      if (existingApplication) {
        res.status(409).json({
          success: false,
          message:
            "You already have a pending application or active credit card.",
        });
        return;
      }

      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 5);

      const cardNumber = await generateCardNumber();

      const card = await CreditCard.create({
        customerId: customer._id,
        cardNumberHash: hashCardNumber(cardNumber),
        lastFourDigits: cardNumber.slice(-4),
        creditLimitPaise: requestedLimitRupees * 100,
        outstandingBalancePaise: 0,
        status: "pending",
        expiryMonth: expiry.getMonth() + 1,
        expiryYear: expiry.getFullYear(),
      });

      res.status(201).json({
        success: true,
        message: "Credit card application submitted for review.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          requestedLimitPaise: card.creditLimitPaise,
          outstandingBalancePaise: card.outstandingBalancePaise,
          status: card.status,
          createdAt: card.createdAt,
        },
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to submit your credit card application.",
        "Credit card application error:"
      );
    }
  }
);

// ------------------------------------------------------
// GET /api/cards/credit
// Customer views their own credit cards.
// ------------------------------------------------------

creditCardRoutes.get(
  "/",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;

      if (!isCustomer(user)) {
        res.status(403).json({
          success: false,
          message: "Only customers can view their credit cards.",
        });
        return;
      }

      const customerId = user.customerId;

      const cards = await CreditCard.find({ customerId })
        .select(
          "_id lastFourDigits creditLimitPaise outstandingBalancePaise status expiryMonth expiryYear billingDay paymentDueDate activatedAt blockedAt createdAt"
        )
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        count: cards.length,
        cards: cards.map((card) => ({
          id: card._id.toString(),
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          creditLimitPaise: card.creditLimitPaise,
          outstandingBalancePaise: card.outstandingBalancePaise,
          availableCreditPaise:
            card.creditLimitPaise - card.outstandingBalancePaise,
          status: card.status,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          billingDay: card.billingDay,
          paymentDueDate: card.paymentDueDate,
          activatedAt: card.activatedAt,
          blockedAt: card.blockedAt,
          createdAt: card.createdAt,
        })),
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to retrieve credit cards.",
        "Credit card listing error:"
      );
    }
  }
);

// ------------------------------------------------------
// GET /api/cards/credit/applications
// Staff/admin views pending applications.
// ------------------------------------------------------

creditCardRoutes.get(
  "/applications",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;

      if (!isStaffOrAdmin(user)) {
        res.status(403).json({
          success: false,
          message: "Staff or admin access is required.",
        });
        return;
      }

      const applications = await CreditCard.find({ status: "pending" })
        .select(
          "_id customerId lastFourDigits creditLimitPaise outstandingBalancePaise status createdAt"
        )
        .sort({ createdAt: 1 })
        .lean();

      res.status(200).json({
        success: true,
        count: applications.length,
        applications: applications.map((card) => ({
          id: card._id.toString(),
          customerId: card.customerId.toString(),
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          requestedLimitPaise: card.creditLimitPaise,
          status: card.status,
          createdAt: card.createdAt,
        })),
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to retrieve credit card applications.",
        "Credit card application listing error:"
      );
    }
  }
);

// ------------------------------------------------------
// PATCH /api/cards/credit/applications/:cardId/review
// Staff/admin approves or rejects an application.
// Body: { "decision": "approve", "approvedLimitRupees": 50000 }
// ------------------------------------------------------

creditCardRoutes.patch(
  "/applications/:cardId/review",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;
      const { cardId } = req.params;
      const { decision, approvedLimitRupees } = req.body ?? {};

      if (!isStaffOrAdmin(user)) {
        res.status(403).json({
          success: false,
          message: "Staff or admin access is required.",
        });
        return;
      }

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid credit card ID.",
        });
        return;
      }

      if (decision !== "approve" && decision !== "reject") {
        res.status(400).json({
          success: false,
          message: "Decision must be approve or reject.",
        });
        return;
      }

      const card = await CreditCard.findOne({
        _id: cardId,
        status: "pending",
      });

      if (!card) {
        res.status(404).json({
          success: false,
          message: "Pending credit card application not found.",
        });
        return;
      }

      if (decision === "reject") {
        card.status = "rejected";
        await card.save();

        res.status(200).json({
          success: true,
          message: "Credit card application rejected.",
          card: {
            id: card.id,
            status: card.status,
          },
        });
        return;
      }

      const limitRupees =
        approvedLimitRupees === undefined
          ? card.creditLimitPaise / 100
          : approvedLimitRupees;

      if (
        typeof limitRupees !== "number" ||
        !Number.isSafeInteger(limitRupees) ||
        limitRupees < 5000 ||
        limitRupees > 500000
      ) {
        res.status(400).json({
          success: false,
          message:
            "Approved limit must be between ₹5,000 and ₹5,00,000 in whole rupees.",
        });
        return;
      }

      const cardNumber = await generateCardNumber();

      card.cardNumberHash = hashCardNumber(cardNumber);
      card.lastFourDigits = cardNumber.slice(-4);
      card.creditLimitPaise = limitRupees * 100;
      card.status = "active";
      card.activatedAt = new Date();

      await card.save();

      res.status(200).json({
        success: true,
        message: "Credit card application approved.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          // Demo-only number. Never use this approach for a real banking card.
          demoCardNumber: cardNumber,
          creditLimitPaise: card.creditLimitPaise,
          outstandingBalancePaise: card.outstandingBalancePaise,
          availableCreditPaise:
            card.creditLimitPaise - card.outstandingBalancePaise,
          status: card.status,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          activatedAt: card.activatedAt,
        },
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to review the credit card application.",
        "Credit card application review error:"
      );
    }
  }
);

// ------------------------------------------------------
// POST /api/cards/credit/:cardId/purchase
// Simulates a credit card purchase.
// Body: { "amount": 1200, "merchant": "Demo Store" }
// ------------------------------------------------------

creditCardRoutes.post(
  "/:cardId/purchase",
  async (req: Request, res: Response): Promise<void> => {
    const user: unknown = res.locals.authenticatedUser;

    if (!isCustomer(user)) {
      res.status(403).json({
        success: false,
        message: "Only customers can make credit card purchases.",
      });
      return;
    }

    const customerId = user.customerId;
    const { cardId } = req.params;
    const { amount, merchant, description } = req.body ?? {};

    if (!mongoose.isValidObjectId(cardId)) {
      res.status(400).json({
        success: false,
        message: "Invalid credit card ID.",
      });
      return;
    }

    const amountPaise = parseRupeesToPaise(amount);

    if (amountPaise === null || amountPaise > 100000000) {
      res.status(400).json({
        success: false,
        message:
          "Purchase amount must be greater than ₹0 and no more than ₹10,00,000.",
      });
      return;
    }

    if (
      merchant !== undefined &&
      (typeof merchant !== "string" || merchant.trim().length > 100)
    ) {
      res.status(400).json({
        success: false,
        message: "Merchant must be text of at most 100 characters.",
      });
      return;
    }

    if (
      description !== undefined &&
      (typeof description !== "string" ||
        description.trim().length > 200)
    ) {
      res.status(400).json({
        success: false,
        message: "Description must be text of at most 200 characters.",
      });
      return;
    }

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        const card = await CreditCard.findOne({
          _id: cardId,
          customerId,
          status: "active",
        }).session(session);

        if (!card) {
          throw httpError("Active credit card not found.", 404);
        }

        const now = new Date();

        const expired =
          card.expiryYear < now.getFullYear() ||
          (card.expiryYear === now.getFullYear() &&
            card.expiryMonth < now.getMonth() + 1);

        if (expired) {
          throw httpError("This credit card has expired.", 409);
        }

        const availableCredit =
          card.creditLimitPaise - card.outstandingBalancePaise;

        if (amountPaise > availableCredit) {
          throw httpError("Purchase exceeds available credit.", 409);
        }

        const updatedCard = await CreditCard.findOneAndUpdate(
          {
            _id: card._id,
            customerId,
            status: "active",
            outstandingBalancePaise: {
              $lte: card.creditLimitPaise - amountPaise,
            },
          },
          { $inc: { outstandingBalancePaise: amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updatedCard) {
          throw httpError("Unable to authorize this purchase.", 409);
        }

        const reference = makeReference("VB-CCP");

        const [transaction] = await Transaction.create(
          [
            {
              accountId: null,
              creditCardId: updatedCard._id,
              reference,
              type: "credit_card_purchase",
              category: "Credit Card Purchase",
              amountPaise,
              description:
                typeof description === "string" && description.trim()
                  ? description.trim()
                  : "Demo credit card purchase",
              recipientDetails:
                typeof merchant === "string" && merchant.trim()
                  ? merchant.trim()
                  : "Demo Merchant",
              status: "completed",
            },
          ],
          { session }
        );

        return {
          transactionId: transaction.id,
          reference,
          outstandingBalancePaise: updatedCard.outstandingBalancePaise,
          availableCreditPaise:
            updatedCard.creditLimitPaise -
            updatedCard.outstandingBalancePaise,
        };
      });

      if (!result) {
        throw new Error("Purchase transaction did not complete.");
      }

      res.status(201).json({
        success: true,
        message: "Demo credit card purchase completed.",
        transaction: {
          transactionId: result.transactionId,
          reference: result.reference,
          outstandingBalancePaise: result.outstandingBalancePaise,
          availableCreditPaise: result.availableCreditPaise,
          amountPaise,
          amountRupees: amountPaise / 100,
          cardId,
          status: "completed",
        },
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to complete the credit card purchase.",
        "Credit card purchase error:"
      );
    } finally {
      await session.endSession();
    }
  }
);

// ------------------------------------------------------
// POST /api/cards/credit/:cardId/repay
// Repays credit card outstanding using customer's bank account.
// Body: { "accountId": "...", "amount": 1000 }
// ------------------------------------------------------

creditCardRoutes.post(
  "/:cardId/repay",
  async (req: Request, res: Response): Promise<void> => {
    const user: unknown = res.locals.authenticatedUser;

    if (!isCustomer(user)) {
      res.status(403).json({
        success: false,
        message: "Only customers can repay credit cards.",
      });
      return;
    }

    const customerId = user.customerId;
    const { cardId } = req.params;
    const { accountId, amount } = req.body ?? {};

    if (
      !mongoose.isValidObjectId(cardId) ||
      typeof accountId !== "string" ||
      !mongoose.isValidObjectId(accountId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid credit card ID and bank account ID are required.",
      });
      return;
    }

    const amountPaise = parseRupeesToPaise(amount);

    if (amountPaise === null || amountPaise > 100000000) {
      res.status(400).json({
        success: false,
        message:
          "Repayment amount must be greater than ₹0 and no more than ₹10,00,000.",
      });
      return;
    }

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        const card = await CreditCard.findOne({
          _id: cardId,
          customerId,
          status: { $in: ["active", "blocked"] },
        }).session(session);

        if (!card) {
          throw httpError("Eligible credit card not found.", 404);
        }

        if (amountPaise > card.outstandingBalancePaise) {
          throw httpError(
            "Repayment cannot exceed the outstanding balance.",
            409
          );
        }

        const updatedAccount = await BankAccount.findOneAndUpdate(
          {
            _id: accountId,
            customerId,
            status: "active",
            balancePaise: { $gte: amountPaise },
          },
          { $inc: { balancePaise: -amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updatedAccount) {
          throw httpError(
            "Active bank account not found, or its balance is insufficient.",
            409
          );
        }

        const updatedCard = await CreditCard.findOneAndUpdate(
          {
            _id: card._id,
            customerId,
            status: { $in: ["active", "blocked"] },
            outstandingBalancePaise: { $gte: amountPaise },
          },
          { $inc: { outstandingBalancePaise: -amountPaise } },
          { new: true, session, runValidators: true }
        );

        if (!updatedCard) {
          throw httpError(
            "Unable to apply the credit card repayment.",
            409
          );
        }

        const reference = makeReference("VB-CCR");

        const [transaction] = await Transaction.create(
          [
            {
              accountId: updatedAccount._id,
              creditCardId: updatedCard._id,
              reference,
              type: "credit_card_repayment",
              category: "Credit Card Repayment",
              amountPaise,
              description: "Credit card bill repayment",
              recipientDetails: `Credit card ending ${updatedCard.lastFourDigits}`,
              status: "completed",
            },
          ],
          { session }
        );

        return {
          transactionId: transaction.id,
          reference,
          remainingOutstandingPaise:
            updatedCard.outstandingBalancePaise,
          bankBalancePaise: updatedAccount.balancePaise,
        };
      });

      if (!result) {
        throw new Error("Repayment transaction did not complete.");
      }

      res.status(200).json({
        success: true,
        message: "Credit card repayment completed successfully.",
        transaction: {
          transactionId: result.transactionId,
          reference: result.reference,
          remainingOutstandingPaise:
            result.remainingOutstandingPaise,
          bankBalancePaise: result.bankBalancePaise,
          amountPaise,
          amountRupees: amountPaise / 100,
          cardId,
          accountId,
          status: "completed",
        },
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to complete the credit card repayment.",
        "Credit card repayment error:"
      );
    } finally {
      await session.endSession();
    }
  }
);

// ------------------------------------------------------
// PATCH /api/cards/credit/:cardId/block
// Customer blocks their own active credit card.
// ------------------------------------------------------

creditCardRoutes.patch(
  "/:cardId/block",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;
      const { cardId } = req.params;

      if (!isCustomer(user)) {
        res.status(403).json({
          success: false,
          message: "Only customers can block their own credit cards.",
        });
        return;
      }

      const customerId = user.customerId;

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid credit card ID.",
        });
        return;
      }

      const card = await CreditCard.findOne({
        _id: cardId,
        customerId,
      });

      if (!card) {
        res.status(404).json({
          success: false,
          message: "Credit card not found.",
        });
        return;
      }

      if (card.status !== "active") {
        res.status(409).json({
          success: false,
          message: "Only active credit cards can be blocked.",
        });
        return;
      }

      card.status = "blocked";
      card.blockedAt = new Date();

      await card.save();

      res.status(200).json({
        success: true,
        message: "Credit card blocked successfully.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          status: card.status,
          blockedAt: card.blockedAt,
        },
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to block the credit card.",
        "Credit card blocking error:"
      );
    }
  }
);


/* ------------------------------------------------------
   GET /api/cards/credit/:cardId/transactions
   View transaction history for the customer's own card.
   Optional query parameters:
   ?type=purchase&page=1&limit=10
------------------------------------------------------ */

creditCardRoutes.get(
  "/:cardId/transactions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user: unknown = res.locals.authenticatedUser;

      if (!isCustomer(user)) {
        res.status(403).json({
          success: false,
          message: "Only customers can view credit card transactions.",
        });
        return;
      }

      const customerId = user.customerId;
      const { cardId } = req.params;

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid credit card ID.",
        });
        return;
      }

      // Verify that the card belongs to this customer.
      const card = await CreditCard.findOne({
        _id: cardId,
        customerId,
      })
        .select("_id lastFourDigits")
        .lean();

      if (!card) {
        res.status(404).json({
          success: false,
          message: "Credit card not found.",
        });
        return;
      }

      const allowedTypes = ["purchase", "repayment"] as const;
      type HistoryType = (typeof allowedTypes)[number];

      const rawType = req.query.type;
      let transactionType: HistoryType | undefined;

      if (rawType !== undefined) {
        if (
          typeof rawType !== "string" ||
          !allowedTypes.includes(rawType as HistoryType)
        ) {
          res.status(400).json({
            success: false,
            message: "Type must be purchase or repayment.",
          });
          return;
        }

        transactionType = rawType as HistoryType;
      }

      const parsePositiveInteger = (
        value: unknown,
        defaultValue: number,
        maximum: number
      ): number | null => {
        if (value === undefined) return defaultValue;

        if (
          typeof value !== "string" ||
          !/^[1-9]\d*$/.test(value)
        ) {
          return null;
        }

        const parsed = Number(value);

        return Number.isSafeInteger(parsed) && parsed <= maximum
          ? parsed
          : null;
      };

      const page = parsePositiveInteger(req.query.page, 1, 1000000);
      const limit = parsePositiveInteger(req.query.limit, 10, 100);

      if (page === null || limit === null) {
        res.status(400).json({
          success: false,
          message:
            "Page must be a positive integer and limit must be between 1 and 100.",
        });
        return;
      }

      const filter: Record<string, unknown> = {
        creditCardId: card._id,
        type: {
          $in:
            transactionType === "purchase"
              ? ["credit_card_purchase"]
              : transactionType === "repayment"
                ? ["credit_card_repayment"]
                : ["credit_card_purchase", "credit_card_repayment"],
        },
      };

      const total = await Transaction.countDocuments(filter);

      const transactions = await Transaction.find(filter)
        .select(
          "_id reference type category amountPaise description recipientDetails status createdAt"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.status(200).json({
        success: true,
        card: {
          id: card._id.toString(),
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        count: transactions.length,
        transactions: transactions.map((transaction) => ({
          id: transaction._id.toString(),
          reference: transaction.reference,
          type: transaction.type,
          category: transaction.category,
          amountPaise: transaction.amountPaise,
          amountRupees: transaction.amountPaise / 100,
          description: transaction.description,
          merchant: transaction.recipientDetails,
          status: transaction.status,
          createdAt: transaction.createdAt,
        })),
      });
    } catch (error: unknown) {
      sendRouteError(
        res,
        error,
        "Unable to retrieve credit card transaction history.",
        "Credit card transaction history error:"
      );
    }
  }
);


export default creditCardRoutes;
