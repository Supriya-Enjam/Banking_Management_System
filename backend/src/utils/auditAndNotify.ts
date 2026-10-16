import { AuditLog } from "../models/AuditLog";
import { Notification } from "../models/Notification";

export async function logAudit(data: {
  userId?: string | null;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  details: string;
  severity?: "info" | "warning" | "critical";
  ipAddress?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      userId: data.userId || null,
      userName: data.userName || "System",
      userEmail: data.userEmail || "system@vaultbank.local",
      userRole: data.userRole || "system",
      action: data.action,
      details: data.details,
      severity: data.severity || "info",
      ipAddress: data.ipAddress || "127.0.0.1",
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

export async function sendNotification(data: {
  customerId: string;
  title: string;
  message: string;
  type?: "transaction" | "security" | "loan" | "system";
}): Promise<void> {
  try {
    await Notification.create({
      customerId: data.customerId,
      title: data.title,
      message: data.message,
      type: data.type || "transaction",
      read: false,
    });
  } catch (error) {
    console.error("Notification creation error:", error);
  }
}
