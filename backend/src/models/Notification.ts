import mongoose, { Schema, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["transaction", "security", "loan", "system"],
      default: "transaction",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ customerId: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const Notification = mongoose.model("Notification", notificationSchema);
