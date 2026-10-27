import mongoose, { Schema } from "mongoose";

const participantSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    role: {
      type: String,
      enum: ["staff", "management", "admin"],
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const chatConversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["personal", "group"],
      required: true,
    },
    personalKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: (participants: unknown[]) =>
          Array.isArray(participants) && participants.length >= 2,
        message: "A conversation requires at least two participants.",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    lastMessagePreview: {
      type: String,
      default: "",
      maxlength: 160,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chatConversationSchema.index({ "participants.customerId": 1, lastMessageAt: -1 });

export const ChatConversation =
  mongoose.models.ChatConversation ||
  mongoose.model("ChatConversation", chatConversationSchema);
