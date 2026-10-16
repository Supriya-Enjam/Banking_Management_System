import mongoose, { Schema, type InferSchemaType } from "mongoose";

const fixedDepositSchema = new Schema(
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
    },
    depositNumber: {
      type: String,
      required: true,
      unique: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 500000, // min ₹5,000
    },
    tenureMonths: {
      type: Number,
      required: true,
      min: 3,
      max: 120,
    },
    interestRate: {
      type: Number,
      required: true,
    },
    maturityAmountPaise: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    maturityDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "matured", "liquidated"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

export type FixedDepositDocument = InferSchemaType<typeof fixedDepositSchema>;

export const FixedDeposit = mongoose.model("FixedDeposit", fixedDepositSchema);
