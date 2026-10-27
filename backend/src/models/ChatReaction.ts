import mongoose, { Schema } from "mongoose";

export const CHAT_REACTIONS = ["👍", "❤️", "😂", "👏", "🎉", "😮"] as const;

const chatReactionSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    emoji: {
      type: String,
      enum: CHAT_REACTIONS,
      required: true,
    },
  },
  { timestamps: true }
);

chatReactionSchema.index({ messageId: 1, customerId: 1 }, { unique: true });

export const ChatReaction =
  mongoose.models.ChatReaction ||
  mongoose.model("ChatReaction", chatReactionSchema);
