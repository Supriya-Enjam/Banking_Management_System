import mongoose, { Schema, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // Password is optional for Google-authenticated customers.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    // Firebase UID for customers authenticated through Google.
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // Authentication provider used by this customer.
    authProvider: {
      type: String,
      enum: ["password", "google"],
      default: "password",
      required: true,
    },

    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
      required: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "+91 98765 43210",
    },

    address: {
      type: String,
      trim: true,
      default: "42 Financial District, Cyber City, Mumbai",
    },

    // Google registration must not automatically verify banking KYC.
    kycStatus: {
      type: String,
      enum: ["verified", "pending", "rejected"],
      default: "pending",
      required: true,
    },

    dailyLimitRupees: {
      type: Number,
      default: 50000,
      min: 1000,
      max: 1000000,
    },

    status: {
      type: String,
      enum: ["active", "frozen", "blocked"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

export type CustomerDocument = InferSchemaType<typeof customerSchema>;

export const Customer = mongoose.model("Customer", customerSchema);