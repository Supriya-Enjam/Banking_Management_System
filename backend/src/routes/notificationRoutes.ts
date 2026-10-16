import { Router, type Request, type Response } from "express";
import authenticate from "../middleware/authenticate";
import { Notification } from "../models/Notification";

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

// Get user notifications
notificationRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ customerId }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ customerId, read: false }),
    ]);

    res.json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load notifications." });
  }
});

// Mark single as read
notificationRoutes.patch("/:id/read", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = res.locals.authenticatedUser?.customerId;

    await Notification.findOneAndUpdate({ _id: id, customerId }, { read: true });

    res.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notification." });
  }
});

// Mark all as read
notificationRoutes.post("/mark-all-read", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    await Notification.updateMany({ customerId, read: false }, { read: true });

    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark notifications read." });
  }
});

export default notificationRoutes;
