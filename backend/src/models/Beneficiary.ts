import mongoose, { Schema, type InferSchemaType } from "mongoose";

const beneficiarySchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
      default: "VaultBank",
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      default: "VAULT000108",
    },
    nickname: {
      type: String,
      trim: true,
      default: "",
    },
    maxLimitRupees: {
      type: Number,
      default: 50000,
    },
  },
  { timestamps: true }
);

beneficiarySchema.index({ customerId: 1, accountNumber: 1 }, { unique: true });

export type BeneficiaryDocument = InferSchemaType<typeof beneficiarySchema>;

export const Beneficiary = mongoose.model("Beneficiary", beneficiarySchema);
