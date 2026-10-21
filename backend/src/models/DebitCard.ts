
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const debitCardSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    accountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      required: true,
      index: true,
    },

    // Store a hash of the card number for secure card lookup.
    // Never store the complete card number in plaintext.
    cardNumberHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    lastFourDigits: {
      type: String,
      required: true,
      match: /^\d{4}$/,
    },

    // Store only a bcrypt hash of the PIN.
    pinHash: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: ["pending", "active", "blocked", "expired"],
      default: "pending",
      required: true,
      index: true,
    },

    expiryMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    expiryYear: {
      type: Number,
      required: true,
      min: 2026,
    },

    atmDailyLimitPaise: {
      type: Number,
      default: 2000000, // ₹20,000
      required: true,
      min: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: "ATM limit must be a safe integer in paise.",
      },
    },

    failedPinAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    pinLockedUntil: {
      type: Date,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    blockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

debitCardSchema.index({ customerId: 1, accountId: 1 });
debitCardSchema.index({ expiryYear: 1, expiryMonth: 1 });

export type DebitCardDocument = InferSchemaType<
  typeof debitCardSchema
>;

export const DebitCard = mongoose.model(
  "DebitCard",
  debitCardSchema
);
