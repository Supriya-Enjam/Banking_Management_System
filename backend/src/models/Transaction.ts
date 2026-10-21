
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const transactionSchema = new Schema(
  {
    // Bank account associated with a normal banking transaction.
    // Optional so credit card transactions can use creditCardId instead.
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
      index: true,
    },

    // Destination or related bank account for transfers.
    relatedAccountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },

    // Credit card associated with a credit card transaction.
    creditCardId: {
      type: Schema.Types.ObjectId,
      ref: "CreditCard",
      default: null,
      index: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal",
        "transfer",
        "loan_disbursement",
        "loan_repayment",
        "fd_creation",
        "fd_liquidation",
        "credit_card_purchase",
        "credit_card_repayment",
      ],
      required: true,
    },

    category: {
      type: String,
      default: "General",
    },

    // All transaction amounts are stored in paise.
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: "Transaction amount must be a positive integer in paise.",
      },
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    recipientDetails: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for transaction history queries.
transactionSchema.index({ accountId: 1, createdAt: -1 });
transactionSchema.index({ creditCardId: 1, createdAt: -1 });

export type TransactionDocument = InferSchemaType<
  typeof transactionSchema
>;

export const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);
