
import { Schema, model, models } from "mongoose";

export interface ILoginOtp {
  challengeId: string;
  customerId: Schema.Types.ObjectId;
  email: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  lastSentAt: Date;
  createdAt: Date;
}

const loginOtpSchema = new Schema<ILoginOtp>(
  {
    challengeId: {
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

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    otpHash: {
      type: String,
      required: true,
      select: false,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    consumedAt: {
      type: Date,
      default: undefined,
    },

    lastSentAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const LoginOtp =
  models.LoginOtp ||
  model<ILoginOtp>("LoginOtp", loginOtpSchema);
