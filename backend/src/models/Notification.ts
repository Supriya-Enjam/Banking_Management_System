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
      enum: ["transaction", "security", "loan", "system", "chat"],
      default: "transaction",
    },
    eventType: {
      type: String,
      enum: ["message", "group_added", "group_removed"],
      default: null,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      default: null,
    },
    relatedMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    dedupeKey: {
      type: String,
      default: null,
      maxlength: 160,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ customerId: 1, createdAt: -1 });
notificationSchema.index(
  { customerId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const Notification = mongoose.model("Notification", notificationSchema);
