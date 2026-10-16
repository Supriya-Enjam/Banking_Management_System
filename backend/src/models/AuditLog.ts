import mongoose, { Schema, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    userName: {
      type: String,
      default: "System",
    },
    userEmail: {
      type: String,
      default: "system@vaultbank.local",
    },
    userRole: {
      type: String,
      default: "system",
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
