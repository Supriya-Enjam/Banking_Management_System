
import mongoose, { Schema } from "mongoose";

const pushSubscriptionSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    expirationTime: {
      type: Number,
      default: null,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// A browser endpoint must only be stored once.
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

// Efficiently retrieve all browser subscriptions for an employee.
pushSubscriptionSchema.index({ customerId: 1, createdAt: -1 });

export const PushSubscription =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);
