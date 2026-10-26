
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const uploadedDocumentSchema = new Schema(
  {
    documentType: {
      type: String,
      enum: [
        "identity",
        "address",
        "photo",
        "business_registration",
      ],
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/png", "application/pdf"],
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    verificationStatus: {
      type: String,
      enum: [
        "pending",
        "readable",
        "unreadable",
        "manual_review",
      ],
      default: "pending",
      required: true,
    },
    analysisMessage: {
      type: String,
      default: "",
      maxlength: 500,
    },
    analyzedAt: {
      type: Date,
      default: null,
    },

    authenticityStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      required: true,
    },
    authenticityMessage: {
      type: String,
      default: "Document authenticity has not been verified.",
      maxlength: 500,
    },
    authenticityVerifiedAt: {
      type: Date,
      default: null,
    },
    authenticityVerifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
  },
  { _id: true }
);

const accountOpeningApplicationSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    applicantDetails: {
      // Older applications predate this snapshot; new submissions are validated by the route.
      fullName: {
        type: String,
        trim: true,
        minlength: 2,
        maxlength: 80,
      },
      dateOfBirth: {
        type: Date,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
      },
      mobileNumber: {
        type: String,
        trim: true,
        maxlength: 30,
      },
      residentialAddress: {
        type: String,
        trim: true,
        minlength: 5,
        maxlength: 250,
      },
    },
    requestedAccountType: {
      type: String,
      enum: ["savings", "current", "business"],
      required: true,
    },
    initialDepositPaise: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      validate: {
        validator: (value: number) =>
          Number.isSafeInteger(value),
        message: "Initial deposit must be a safe integer in paise.",
      },
    },
    documents: {
      type: [uploadedDocumentSchema],
      required: true,
      validate: {
        validator: (documents: unknown[]) =>
          Array.isArray(documents) && documents.length >= 3,
        message: "Identity, address, and photo documents are required.",
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    reviewRemarks: {
      type: String,
      default: "",
      maxlength: 500,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent multiple simultaneous pending applications of the same type
// for the same customer. Approved and rejected applications are retained.
accountOpeningApplicationSchema.index(
  { customerId: 1, requestedAccountType: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

export type AccountOpeningApplicationDocument =
  InferSchemaType<typeof accountOpeningApplicationSchema>;

export const AccountOpeningApplication = mongoose.model(
  "AccountOpeningApplication",
  accountOpeningApplicationSchema
);
