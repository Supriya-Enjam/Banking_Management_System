
import mongoose, { Schema } from "mongoose";

const chatAttachmentSchema = new Schema(
  {
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    storageName: {
      type: String,
      required: true,
      select: false,
    },
    mimeType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: 10 * 1024 * 1024,
    },
  },
  { _id: false }
);

const chatMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    attachment: {
      type: chatAttachmentSchema,
      default: undefined,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({
  conversationId: 1,
  createdAt: -1,
  _id: -1,
});

export const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", chatMessageSchema);
