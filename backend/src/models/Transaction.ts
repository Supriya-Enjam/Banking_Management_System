import mongoose, { Schema, type InferSchemaType } from "mongoose";

const transactionSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      required: true,
      index: true,
    },
    relatedAccountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
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
      ],
      required: true,
    },
    category: {
      type: String,
      default: "General",
    },
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

transactionSchema.index({ accountId: 1, createdAt: -1 });

export type TransactionDocument = InferSchemaType<typeof transactionSchema>;

export const Transaction = mongoose.model("Transaction", transactionSchema);