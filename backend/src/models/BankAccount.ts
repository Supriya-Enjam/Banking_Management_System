import mongoose, { Schema, type InferSchemaType } from "mongoose";

const bankAccountSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    accountType: {
      type: String,
      enum: ["savings", "current", "business"],
      default: "savings",
      required: true,
    },
    balancePaise: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: "Balance must be a safe integer in paise.",
      },
    },
    dailyLimitPaise: {
      type: Number,
      default: 5000000, // ₹50,000 in paise
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "frozen", "closed"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

export type BankAccountDocument = InferSchemaType<typeof bankAccountSchema>;

export const BankAccount = mongoose.model("BankAccount", bankAccountSchema);