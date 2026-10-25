
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const loanDocumentSchema = new Schema(
  {
    documentType: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: true, timestamps: true }
);

const loanSchema = new Schema(
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
    loanType: {
      type: String,
      enum: ["Personal", "Home", "Vehicle", "Education", "Business"],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1000000,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    tenureMonths: {
      type: Number,
      required: true,
      min: 6,
      max: 360,
    },
    emiPaise: {
      type: Number,
      required: true,
    },
    remainingAmountPaise: {
      type: Number,
      required: true,
    },
    paidEmis: {
      type: Number,
      default: 0,
    },
    purpose: {
      type: String,
      trim: true,
      default: "",
    },
    documents: {
      type: [loanDocumentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "disbursed", "closed"],
      default: "pending",
      required: true,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
  },
  { timestamps: true }
);

export type LoanDocument = InferSchemaType<typeof loanSchema>;

export const Loan = mongoose.model("Loan", loanSchema);
