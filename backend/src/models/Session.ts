
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const sessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      required: true,
    },

    userAgent: {
      type: String,
      default: "Unknown",
      maxlength: 500,
    },

    ipAddress: {
      type: String,
      default: "Unknown",
      maxlength: 100,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve sessions belonging to a user.
sessionSchema.index({ customerId: 1, revokedAt: 1, expiresAt: 1 });

export type SessionDocument = InferSchemaType<typeof sessionSchema>;

export const Session =
  mongoose.models.Session ||
  mongoose.model("Session", sessionSchema);

export default Session;
