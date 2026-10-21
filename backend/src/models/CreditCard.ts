
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const creditCardSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    // Store only a hash of the card number, never the full number.
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

    creditLimitPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: "Credit limit must be a safe integer in paise.",
      },
    },

    outstandingBalancePaise: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: "Outstanding balance must be a safe integer in paise.",
      },
    },

    status: {
      type: String,
      enum: ["pending", "active", "blocked", "rejected", "closed"],
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

    billingDay: {
      type: Number,
      default: 1,
      required: true,
      min: 1,
      max: 28,
    },

    paymentDueDate: {
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

creditCardSchema.index({ customerId: 1, status: 1 });

export type CreditCardDocument = InferSchemaType<
  typeof creditCardSchema
>;

export const CreditCard = mongoose.model(
  "CreditCard",
  creditCardSchema
);
