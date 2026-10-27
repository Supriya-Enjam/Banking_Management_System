
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import authenticate from "../middleware/authenticate";
import { PushSubscription } from "../models/PushSubscription";
import { getVapidPublicKey } from "../services/pushNotifications";

const pushNotificationRoutes = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const endpointSchema = z.object({
  endpoint: z.string().url().max(4096),
});

pushNotificationRoutes.get(
  "/public-key",
  authenticate,
  (_req: Request, res: Response) => {
    const publicKey = getVapidPublicKey();

    if (!publicKey) {
      res.status(503).json({
        success: false,
        message: "Push notifications are not configured.",
      });
      return;
    }

    res.json({ success: true, publicKey });
  }
);

pushNotificationRoutes.post(
  "/subscribe",
  authenticate,
  async (req: Request, res: Response) => {
    const parsed = subscriptionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid browser push subscription.",
      });
      return;
    }

    const user = res.locals.authenticatedUser!;

    try {
      await PushSubscription.findOneAndUpdate(
        { endpoint: parsed.data.endpoint },
        {
          $set: {
            customerId: user.customerId,
            endpoint: parsed.data.endpoint,
            expirationTime: parsed.data.expirationTime ?? null,
            keys: parsed.data.keys,
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            lastUsedAt: new Date(),
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        message: "Browser push notifications enabled.",
      });
    } catch (error) {
      console.error("Unable to save push subscription:", error);
      res.status(500).json({
        success: false,
        message: "Unable to register this browser for notifications.",
      });
    }
  }
);

pushNotificationRoutes.delete(
  "/unsubscribe",
  authenticate,
  async (req: Request, res: Response) => {
    const parsed = endpointSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "A valid subscription endpoint is required.",
      });
      return;
    }

    const user = res.locals.authenticatedUser!;

    try {
      await PushSubscription.deleteOne({
        customerId: user.customerId,
        endpoint: parsed.data.endpoint,
      });

      res.json({
        success: true,
        message: "Browser push notifications disabled.",
      });
    } catch (error) {
      console.error("Unable to remove push subscription:", error);
      res.status(500).json({
        success: false,
        message: "Unable to disable browser notifications.",
      });
    }
  }
);

export default pushNotificationRoutes;
