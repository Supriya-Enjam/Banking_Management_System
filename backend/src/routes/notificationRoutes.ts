import { Router, type Request, type Response } from "express";
import authenticate from "../middleware/authenticate";
import { Notification } from "../models/Notification";

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

// Get user notifications
notificationRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const user = res.locals.authenticatedUser;
    const customerId = user?.customerId;
    if (!customerId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const notificationQuery = Notification.find({ customerId });
    const unreadQuery = Notification.countDocuments({
      customerId,
      read: false,
    });
    if (user.role === "customer") {
      notificationQuery.where("type").ne("chat");
      unreadQuery.where("type").ne("chat");
    }
    const [notifications, unreadCount] = await Promise.all([
      notificationQuery.sort({ createdAt: -1 }).limit(30),
      unreadQuery,
    ]);

    res.json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        eventType: n.eventType ?? null,
        conversationId: n.conversationId ? String(n.conversationId) : null,
        relatedMessageId: n.relatedMessageId
          ? String(n.relatedMessageId)
          : null,
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

    const filter: Record<string, unknown> = { _id: id, customerId };
    if (res.locals.authenticatedUser?.role === "customer") {
      filter.type = { $ne: "chat" };
    }
    const notification = await Notification.findOneAndUpdate(
      filter,
      { read: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
      return;
    }

    res.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notification." });
  }
});

// Mark all as read
notificationRoutes.post("/mark-all-read", async (_req: Request, res: Response): Promise<void> => {
  try {
    const customerId = res.locals.authenticatedUser?.customerId;
    const filter: Record<string, unknown> = { customerId, read: false };
    if (res.locals.authenticatedUser?.role === "customer") {
      filter.type = { $ne: "chat" };
    }
    await Notification.updateMany(filter, { read: true });

    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark notifications read." });
  }
});

export default notificationRoutes;
