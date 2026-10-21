
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

import authenticate from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { BankAccount } from "../models/BankAccount";
import { DebitCard } from "../models/DebitCard";

const debitCardRoutes = Router();

debitCardRoutes.use(authenticate);

function hashCardNumber(cardNumber: string): string {
  return createHash("sha256").update(cardNumber).digest("hex");
}

async function generateCardNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const cardNumber = Array.from(
      { length: 4 },
      () => randomInt(0, 10000).toString().padStart(4, "0")
    ).join("");

    const exists = await DebitCard.exists({
      cardNumberHash: hashCardNumber(cardNumber),
    });

    if (!exists) {
      return cardNumber;
    }
  }

  throw new Error("Unable to generate a unique card number.");
}

// Request a debit card for the authenticated customer's account.
debitCardRoutes.post(
  "/request",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;

      if (
        !user ||
        user.role !== "customer" ||
        !mongoose.isValidObjectId(user.customerId)
      ) {
        res.status(403).json({
          success: false,
          message: "Only authenticated customers can request debit cards.",
        });
        return;
      }

      const { accountId, pin } = req.body ?? {};

      if (
        typeof accountId !== "string" ||
        !mongoose.isValidObjectId(accountId)
      ) {
        res.status(400).json({
          success: false,
          message: "A valid accountId is required.",
        });
        return;
      }

      if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        res.status(400).json({
          success: false,
          message: "Choose a 4-digit numeric PIN.",
        });
        return;
      }

      const customer = await Customer.findById(user.customerId).select(
        "_id status name email role"
      );

      if (!customer || customer.status !== "active") {
        res.status(403).json({
          success: false,
          message: "An active customer profile is required.",
        });
        return;
      }

      // Verify that the account belongs to this customer and is active.
      const account = await BankAccount.findOne({
        _id: accountId,
        customerId: customer._id,
        status: "active",
      });

      if (!account) {
        res.status(404).json({
          success: false,
          message: "No active bank account was found for your profile.",
        });
        return;
      }

      // Prevent multiple pending or active cards for the same account.
      const existingCard = await DebitCard.exists({
        customerId: customer._id,
        accountId: account._id,
        status: { $in: ["pending", "active"] },
      });

      if (existingCard) {
        res.status(409).json({
          success: false,
          message:
            "This account already has a pending or active debit card.",
        });
        return;
      }

      const cardNumber = await generateCardNumber();
      const cardNumberHash = hashCardNumber(cardNumber);
      const pinHash = await bcrypt.hash(pin, 12);

      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 5);

      const card = await DebitCard.create({
        customerId: customer._id,
        accountId: account._id,
        cardNumberHash,
        lastFourDigits: cardNumber.slice(-4),
        pinHash,
        status: "pending",
        expiryMonth: expiry.getMonth() + 1,
        expiryYear: expiry.getFullYear(),
      });

      // The full demo number is returned only in this response.
      // Save it securely before leaving the response.
      res.status(201).json({
        success: true,
        message: "Debit card request submitted successfully.",
        card: {
          id: card.id,
          accountId: account.id,
          accountNumberMasked: `****${account.accountNumber.slice(-4)}`,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          demoCardNumber: cardNumber,
          status: card.status,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          atmDailyLimitPaise: card.atmDailyLimitPaise,
          createdAt: card.createdAt,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res.status(409).json({
          success: false,
          message: "A duplicate card was detected. Please try again.",
        });
        return;
      }

      console.error("Debit card request error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to request a debit card right now.",
      });
    }
  }
);

// List cards belonging to the authenticated customer.
debitCardRoutes.get(
  "/",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;

      if (
        !user ||
        user.role !== "customer" ||
        !mongoose.isValidObjectId(user.customerId)
      ) {
        res.status(403).json({
          success: false,
          message: "Only authenticated customers can view their debit cards.",
        });
        return;
      }

      const cards = await DebitCard.find({
        customerId: user.customerId,
      })
        .select(
          "_id accountId lastFourDigits status expiryMonth expiryYear atmDailyLimitPaise createdAt activatedAt blockedAt"
        )
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        count: cards.length,
        cards: cards.map((card) => ({
          id: card._id.toString(),
          accountId: card.accountId.toString(),
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          status: card.status,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          atmDailyLimitPaise: card.atmDailyLimitPaise,
          createdAt: card.createdAt,
          activatedAt: card.activatedAt,
          blockedAt: card.blockedAt,
        })),
      });
    } catch (error: unknown) {
      console.error("Debit card listing error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve your debit cards.",
      });
    }
  }
);

// Cancel a pending debit card whose demo number has been lost.
// This uses "blocked" as the retired status because the current model
// does not define a separate "cancelled" status.
debitCardRoutes.patch(
  "/:cardId/cancel",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;
      const { cardId } = req.params;

      if (
        !user ||
        user.role !== "customer" ||
        !mongoose.isValidObjectId(user.customerId)
      ) {
        res.status(403).json({
          success: false,
          message: "Only authenticated customers can cancel debit cards.",
        });
        return;
      }

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid card ID.",
        });
        return;
      }

      const card = await DebitCard.findOne({
        _id: cardId,
        customerId: user.customerId,
        status: "pending",
      });

      if (!card) {
        res.status(404).json({
          success: false,
          message: "No pending card found for this customer.",
        });
        return;
      }

      card.status = "blocked";
      card.blockedAt = new Date();
      await card.save();

      res.status(200).json({
        success: true,
        message: "Pending demo card cancelled. You can request a replacement.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          status: card.status,
          blockedAt: card.blockedAt,
        },
      });
    } catch (error: unknown) {
      console.error("Pending card cancellation error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to cancel the pending card.",
      });
    }
  }
);

/**
 * Activate a pending debit card.
 * Requires the demo card number and PIN to prove possession.
 */
debitCardRoutes.patch(
  "/:cardId/activate",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;
      const { cardId } = req.params;
      const { cardNumber, pin } = req.body ?? {};

      if (
        !user ||
        user.role !== "customer" ||
        !mongoose.isValidObjectId(user.customerId)
      ) {
        res.status(403).json({
          success: false,
          message: "Only customers can activate their debit cards.",
        });
        return;
      }

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid card ID.",
        });
        return;
      }

      if (
        typeof cardNumber !== "string" ||
        !/^\d{16}$/.test(cardNumber) ||
        typeof pin !== "string" ||
        !/^\d{4}$/.test(pin)
      ) {
        res.status(400).json({
          success: false,
          message:
            "A valid 16-digit demo card number and 4-digit PIN are required.",
        });
        return;
      }

      const card = await DebitCard.findOne({
        _id: cardId,
        customerId: user.customerId,
      }).select("+cardNumberHash +pinHash");

      if (!card) {
        res.status(404).json({
          success: false,
          message: "Debit card not found.",
        });
        return;
      }

      if (card.status !== "pending") {
        res.status(409).json({
          success: false,
          message: "Only pending cards can be activated.",
        });
        return;
      }

      const currentDate = new Date();
      const expiryDate = new Date(
        card.expiryYear,
        card.expiryMonth,
        1
      );

      if (expiryDate <= currentDate) {
        card.status = "expired";
        await card.save();

        res.status(400).json({
          success: false,
          message: "This card has expired.",
        });
        return;
      }

      const suppliedHash = hashCardNumber(cardNumber);
      const numberMatches = suppliedHash === card.cardNumberHash;
      const pinMatches = await bcrypt.compare(pin, card.pinHash);

      if (!numberMatches || !pinMatches) {
        res.status(400).json({
          success: false,
          message: "Card details could not be verified.",
        });
        return;
      }

      const account = await BankAccount.findOne({
        _id: card.accountId,
        customerId: user.customerId,
        status: "active",
      });

      if (!account) {
        res.status(403).json({
          success: false,
          message: "The linked bank account is not active.",
        });
        return;
      }

      card.status = "active";
      card.activatedAt = new Date();
      await card.save();

      res.status(200).json({
        success: true,
        message: "Debit card activated successfully.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          status: card.status,
          activatedAt: card.activatedAt,
        },
      });
    } catch (error: unknown) {
      console.error("Debit card activation error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to activate the debit card.",
      });
    }
  }
);

/**
 * Block an active debit card.
 * A blocked card cannot be used for ATM transactions.
 */
debitCardRoutes.patch(
  "/:cardId/block",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = res.locals.authenticatedUser;
      const { cardId } = req.params;

      if (
        !user ||
        user.role !== "customer" ||
        !mongoose.isValidObjectId(user.customerId)
      ) {
        res.status(403).json({
          success: false,
          message: "Only customers can block their debit cards.",
        });
        return;
      }

      if (!mongoose.isValidObjectId(cardId)) {
        res.status(400).json({
          success: false,
          message: "Invalid card ID.",
        });
        return;
      }

      const card = await DebitCard.findOne({
        _id: cardId,
        customerId: user.customerId,
      });

      if (!card) {
        res.status(404).json({
          success: false,
          message: "Debit card not found.",
        });
        return;
      }

      if (card.status !== "active") {
        res.status(409).json({
          success: false,
          message: "Only active cards can be blocked.",
        });
        return;
      }

      card.status = "blocked";
      card.blockedAt = new Date();
      await card.save();

      res.status(200).json({
        success: true,
        message: "Debit card blocked successfully.",
        card: {
          id: card.id,
          cardNumberMasked: `**** **** **** ${card.lastFourDigits}`,
          status: card.status,
          blockedAt: card.blockedAt,
        },
      });
    } catch (error: unknown) {
      console.error("Debit card blocking error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to block the debit card.",
      });
    }
  }
);

export default debitCardRoutes;
