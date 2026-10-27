import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import authenticate, { requireRoles } from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { ChatConversation } from "../models/ChatConversation";
import { ChatMessage } from "../models/ChatMessage";
import { ChatReaction, CHAT_REACTIONS } from "../models/ChatReaction";
import { Notification } from "../models/Notification";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import {
  disconnectEmployeeFromConversation,
  emitChatEvent,
  emitEmployeeEvent,
  isEmployeeOnline,
} from "../services/chatSocket";

const chatRoutes = Router();
const EMPLOYEE_ROLES = ["staff", "management", "admin"] as const;
const MESSAGE_PAGE_SIZE = 50;
const MAX_GROUP_MEMBERS = 50;

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const CHAT_UPLOAD_DIR = path.resolve(
  process.cwd(),
  "private-uploads",
  "chat"
);

const ALLOWED_ATTACHMENT_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
};

const chatUpload = multer({
  storage: multer.diskStorage({
    
destination: (_req, _file, callback) => {
  mkdir(CHAT_UPLOAD_DIR, { recursive: true })
    .then(() => callback(null, CHAT_UPLOAD_DIR))
    .catch(() =>
      callback(new Error("Could not prepare attachment storage."), "")
    );
},

    filename: (_req, _file, callback) => {
      callback(null, randomUUID());
    },
  }),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_ATTACHMENT_TYPES[file.mimetype];

    if (!allowedExtensions?.includes(extension)) {
      callback(
        new Error(
          "Unsupported attachment type. Allowed: JPG, PNG, WEBP, PDF, TXT, and CSV."
        )
      );
      return;
    }

    callback(null, true);
  },
});



async function removeUploadedFile(
  file?: Express.Multer.File
): Promise<void> {
  if (!file?.path) return;

  await unlink(file.path).catch(() => undefined);
}

async function validateUploadedFile(
  file: Express.Multer.File
): Promise<boolean> {
  const extension = path.extname(file.originalname).toLowerCase();
  const buffer = await readFile(file.path);

  if (extension === ".jpg" || extension === ".jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (extension === ".png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ])
      )
    );
  }

  if (extension === ".webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  if (extension === ".pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (extension === ".txt" || extension === ".csv") {
    return !buffer.includes(0);
  }

  return false;
}



const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You are sending messages too quickly. Please wait a moment.",
  },
});

const groupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(250).optional().default(""),
  memberIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(MAX_GROUP_MEMBERS - 1),
});

const messageSchema = z.object({
  content: z.string().trim().max(4000).default(""),
});
const reactionSchema = z.object({
  emoji: z.union([z.enum(CHAT_REACTIONS), z.null()]),
});

function getEmployeeId(res: Response): string | undefined {
  const user = res.locals.authenticatedUser;
  return user && EMPLOYEE_ROLES.includes(user.role as (typeof EMPLOYEE_ROLES)[number])
    ? user.customerId
    : undefined;
}

function getSafeNotificationPreview(content: string): string {
  return content
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\b(?:password|passcode|otp|one[- ]time code|jwt|access token|refresh token|cvv|cvc|pin)\s*(?:is|:|=)?\s*[A-Za-z0-9._~+/=-]{3,}/gi, "[redacted]")
    .replace(/\bVB\d{6,}\b/gi, "[redacted account number]")
    .replace(/(?<!\d)\d{6,19}(?!\d)/g, "[redacted number]")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function containsSensitiveData(content: string): boolean {
  return (
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(content) ||
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(content) ||
    /\b(?:password|passcode|otp|one[- ]time code|jwt|access token|refresh token|cvv|cvc|pin)\s*(?:is|:|=)?\s*[A-Za-z0-9._~+/=-]{3,}/i.test(content) ||
    /\bVB\d{6,}\b/i.test(content) ||
    /\b(?:account|card|customer|loan)\s*(?:no\.?|number|#)\s*[:#-]?\s*\d{6,}/i.test(content) ||
    /(?<!\d)\d{10,19}(?!\d)/.test(content) ||
    /\bbalance\s*(?:is|:|=)\s*(?:₹|INR|Rs\.?)?\s*[\d,]+(?:\.\d{1,2})?/i.test(content)
  );
}

function isValidId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function logChatFailure(operation: string, error: unknown): void {
  console.error(
    `Internal chat ${operation} failed.`,
    error instanceof Error ? error.name : "Unknown error"
  );
}

function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

async function findMembership(conversationId: string, employeeId: string) {
  if (!isValidId(conversationId)) return null;

  return ChatConversation.findOne({
    _id: conversationId,
    participants: {
      $elemMatch: {
        customerId: employeeId,
        removedAt: null,
      },
    },
  });
}

async function serializeReactions(messageIds: unknown[], employeeId: string) {
  const reactions = await ChatReaction.find({
    messageId: { $in: messageIds },
  }).lean();

  const byMessage = new Map<
    string,
    Array<{ emoji: string; count: number; reactedByMe: boolean }>
  >();
  const grouped = new Map<string, Map<string, { count: number; mine: boolean }>>();

  for (const reaction of reactions) {
    const messageId = String(reaction.messageId);
    let messageReactions = grouped.get(messageId);
    if (!messageReactions) {
      messageReactions = new Map();
      grouped.set(messageId, messageReactions);
    }
    const current = messageReactions.get(reaction.emoji) ?? {
      count: 0,
      mine: false,
    };
    current.count += 1;
    current.mine ||= String(reaction.customerId) === employeeId;
    messageReactions.set(reaction.emoji, current);
  }

  for (const [messageId, entries] of grouped) {
    byMessage.set(
      messageId,
      [...entries].map(([emoji, value]) => ({
        emoji,
        count: value.count,
        reactedByMe: value.mine,
      }))
    );
  }

  return byMessage;
}

async function createChatNotification(
  recipientId: string,
  input: {
    title: string;
    message: string;
    eventType: "message" | "group_added" | "group_removed";
    conversationId: string;
    relatedMessageId?: string;
    dedupeKey: string;
  }
) {
  try {
    const notification = await Notification.create({
      customerId: recipientId,
      title: input.title,
      message: input.message,
      type: "chat",
      eventType: input.eventType,
      conversationId: input.conversationId,
      relatedMessageId: input.relatedMessageId ?? null,
      dedupeKey: input.dedupeKey,
      read: false,
    });
    const serialized = {
      id: String(notification._id),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      eventType: notification.eventType,
      conversationId: String(notification.conversationId),
      relatedMessageId: notification.relatedMessageId
        ? String(notification.relatedMessageId)
        : null,
      read: notification.read,
      createdAt: notification.createdAt,
    };
    emitEmployeeEvent(recipientId, "chat:notification", serialized);
    return serialized;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return null;
    }
    throw error;
  }
}

async function emitMembershipNotice(
  conversationId: string,
  employeeId: string,
  eventType: "group_added" | "group_removed"
) {
  const conversation = await ChatConversation.findById(conversationId).select("name");
  const title =
    eventType === "group_added" ? "Added to a group" : "Removed from a group";
  const message =
    eventType === "group_added"
      ? `You were added to ${conversation?.name || "an employee group"}.`
      : `You were removed from ${conversation?.name || "an employee group"}.`;

  return createChatNotification(employeeId, {
    title,
    message,
    eventType,
    conversationId,
    dedupeKey: `${eventType}:${conversationId}:${employeeId}:${Date.now()}`,
  });
}

chatRoutes.use(authenticate, requireRoles("staff", "management", "admin"));

chatRoutes.use(async (_req, res, next) => {
  try {
    const employeeId = getEmployeeId(res);
    const employee = employeeId
      ? await Customer.exists({
          _id: employeeId,
          role: { $in: EMPLOYEE_ROLES },
          status: "active",
        })
      : null;

    if (!employee) {
      res.status(403).json({
        success: false,
        message: "Only active bank employees can use internal chat.",
      });
      return;
    }

    next();
  } catch (error) {
    logChatFailure("access check", error);
    res.status(500).json({
      success: false,
      message: "Could not validate employee access.",
    });
  }
});

chatRoutes.get("/employees", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const query =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const filter: Record<string, unknown> = {
      role: { $in: EMPLOYEE_ROLES },
      status: "active",
      _id: { $ne: employeeId },
    };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } },
        { role: { $regex: escaped, $options: "i" } },
      ];
    }
    const employees = await Customer.find(filter)
      .select("name employeeId role")
      .sort({ name: 1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      employees: employees.map((employee) => ({
        id: String(employee._id),
        name: employee.name,
        employeeId: employee.employeeId ?? "",
        role: employee.role,
        online: isEmployeeOnline(String(employee._id)),
      })),
    });
  } catch (error) {
    logChatFailure("employee search", error);
    res.status(500).json({ success: false, message: "Could not load employees." });
  }
});

chatRoutes.get("/conversations", async (_req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const conversations = await ChatConversation.find({
      participants: {
        $elemMatch: { customerId: employeeId, removedAt: null },
      },
    })
      .populate("participants.customerId", "name employeeId role")
      .populate("lastMessageId", "senderId")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100)
      .lean();

    const result = await Promise.all(
      conversations.map(async (conversation) => {
        const ownParticipant = conversation.participants.find(
          (participant: any) =>
            String(
              participant.customerId?._id ?? participant.customerId
            ) === employeeId && !participant.removedAt
        ) as any;
        const participants = conversation.participants
          .filter((participant: any) => !participant.removedAt)
          .map((participant: any) => {
            const employee = participant.customerId;
            return {
              id: String(employee?._id ?? employee),
              name: employee?.name ?? "Employee",
              employeeId: employee?.employeeId ?? "",
              role: employee?.role ?? participant.role,
              isAdmin: participant.isAdmin,
              online: isEmployeeOnline(String(employee?._id ?? employee)),
            };
          });
        const otherParticipants = participants.filter(
          (participant: { id: string }) => participant.id !== employeeId
        );
        const unreadCount = await ChatMessage.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: employeeId },
          createdAt: { $gt: ownParticipant?.lastReadAt ?? new Date(0) },
        });
        const lastMessage = conversation.lastMessageId as any;

        return {
          id: String(conversation._id),
          type: conversation.type,
          name:
            conversation.type === "group"
              ? conversation.name
              : otherParticipants[0]?.name ?? "Employee",
          description: conversation.description ?? "",
          participantCount: participants.length,
          participants,
          isAdmin: Boolean(ownParticipant?.isAdmin),
          unreadCount,
          lastMessagePreview: conversation.lastMessagePreview ?? "",
          lastMessageAt: conversation.lastMessageAt ?? null,
          lastMessageSenderId: lastMessage?.senderId
            ? String(lastMessage.senderId)
            : null,
          createdAt: conversation.createdAt,
        };
      })
    );

    res.json({ success: true, conversations: result });
  } catch (error) {
    logChatFailure("conversation list", error);
    res.status(500).json({
      success: false,
      message: "Could not load your conversations.",
    });
  }
});

chatRoutes.post("/direct/:employeeId", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const otherId = getRouteParam(req, "employeeId");
    if (!isValidId(otherId) || otherId === employeeId) {
      res.status(400).json({ success: false, message: "Choose a valid employee." });
      return;
    }
    const other = await Customer.findOne({
      _id: otherId,
      role: { $in: EMPLOYEE_ROLES },
      status: "active",
    }).select("_id role");
    if (!other) {
      res.status(404).json({ success: false, message: "Employee not found." });
      return;
    }

    const personalKey = [employeeId, otherId].sort().join(":");
    let conversation;
    try {
      conversation = await ChatConversation.findOneAndUpdate(
        { personalKey },
        {
          $setOnInsert: {
            type: "personal",
            personalKey,
            participants: [
              {
                customerId: employeeId,
                role: res.locals.authenticatedUser?.role ?? "staff",
                isAdmin: false,
                lastReadAt: new Date(),
              },
              {
                customerId: otherId,
                role: other.role,
                isAdmin: false,
                lastReadAt: new Date(),
              },
            ],
            createdBy: employeeId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      conversation = await ChatConversation.findOne({ personalKey });
    }
    conversation ??= await ChatConversation.findOne({ personalKey });
    if (!conversation) {
      res.status(500).json({
        success: false,
        message: "Could not retrieve the conversation.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      conversation: { id: String(conversation._id) },
    });
  } catch (error) {
    logChatFailure("direct conversation creation", error);
    res.status(500).json({
      success: false,
      message: "Could not start the conversation.",
    });
  }
});

chatRoutes.post("/groups", async (req: Request, res: Response) => {
  try {
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success) {
  await removeUploadedFile(req.file);

  res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid group details.",
      });
      return;
    }
    const employeeId = getEmployeeId(res)!;
    const memberIds = [...new Set(parsed.data.memberIds)].filter(
      (id) => id !== employeeId
    );
    const employees = await Customer.find({
      _id: { $in: memberIds },
      role: { $in: EMPLOYEE_ROLES },
      status: "active",
    }).select("_id role");
    if (employees.length !== memberIds.length) {
      res.status(400).json({
        success: false,
        message: "All group members must be active bank employees.",
      });
      return;
    }

    const creatorRole = res.locals.authenticatedUser?.role ?? "staff";
    const conversation = await ChatConversation.create({
      type: "group",
      name: parsed.data.name,
      description: parsed.data.description,
      createdBy: employeeId,
      participants: [
        {
          customerId: employeeId,
          role: creatorRole,
          isAdmin: true,
          lastReadAt: new Date(),
        },
        ...employees.map((employee) => ({
          customerId: employee._id,
          role: employee.role,
          isAdmin: false,
          lastReadAt: new Date(),
        })),
      ],
    });

    await Promise.all(
      memberIds.map((memberId) =>
        emitMembershipNotice(String(conversation._id), memberId, "group_added")
      )
    );
    emitChatEvent(String(conversation._id), "chat:membership-changed", {
      conversationId: String(conversation._id),
      action: "created",
    });
    res.status(201).json({
      success: true,
      conversation: { id: String(conversation._id) },
    });
  } catch (error) {
    logChatFailure("group creation", error);
    res.status(500).json({
      success: false,
      message: "Could not create the group.",
    });
  }
});

chatRoutes.get("/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const conversationId = getRouteParam(req, "conversationId");
    const conversation = await findMembership(conversationId, employeeId);
    if (!conversation) {
      res.status(isValidId(conversationId) ? 404 : 400).json({
        success: false,
        message: "Conversation not found.",
      });
      return;
    }

    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit ?? MESSAGE_PAGE_SIZE), 10) || MESSAGE_PAGE_SIZE, 1),
      MESSAGE_PAGE_SIZE
    );
    const before =
      typeof req.query.before === "string"
        ? req.query.before
        : undefined;
    if (before && !isValidId(before)) {
      res.status(400).json({ success: false, message: "Invalid message cursor." });
      return;
    }

    const filter: Record<string, unknown> = { conversationId };
    if (before) {
      const cursor = await ChatMessage.findOne({
        _id: before,
        conversationId,
      }).select("createdAt _id");
      if (!cursor) {
        res.status(400).json({
          success: false,
          message: "Invalid message cursor.",
        });
        return;
      }
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }
    const messages = await ChatMessage.find(filter)
      .populate("senderId", "name role")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
    const reactionMap = await serializeReactions(
      messages.map((message) => message._id),
      employeeId
    );
    const serialized = messages.reverse().map((message: any) => ({
      id: String(message._id),
      conversationId: String(message.conversationId),
      sender: {
        id: String(message.senderId?._id ?? message.senderId),
        name: message.senderId?.name ?? "Employee",
        role: message.senderId?.role ?? "staff",
      },
     
content: message.content,
attachment: message.attachment
  ? {
      originalName: message.attachment.originalName,
      mimeType: message.attachment.mimeType,
      sizeBytes: message.attachment.sizeBytes,
      downloadUrl: `/api/chat/messages/${message._id}/attachment`,
    }
  : null,
reactions: reactionMap.get(String(message._id)) ?? [],
createdAt: message.createdAt,
updatedAt: message.updatedAt,

    }));

    res.json({
      success: true,
      messages: serialized,
      nextCursor:
        messages.length === limit
          ? String(messages[0]?._id ?? "") || null
          : null,
    });
  } catch (error) {
    logChatFailure("message history", error);
    res.status(500).json({ success: false, message: "Could not load messages." });
  }
});



async function verifyChatUploadMembership(
  req: Request,
  res: Response,
  next: (error?: unknown) => void
) {
  try {
    const employeeId = getEmployeeId(res);
    const conversationId = getRouteParam(req, "conversationId");

    if (!employeeId) {
      res.status(403).json({
        success: false,
        message: "Active employee access required.",
      });
      return;
    }

    const conversation = await findMembership(conversationId, employeeId);

    if (!conversation) {
      res.status(isValidId(conversationId) ? 404 : 400).json({
        success: false,
        message: "Conversation not found.",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}


chatRoutes.get(
  "/messages/:messageId/attachment",
  async (req: Request, res: Response) => {
    try {
      const employeeId = getEmployeeId(res);
      const messageId = getRouteParam(req, "messageId");

      if (!employeeId) {
        res.status(403).json({
          success: false,
          message: "Active employee access required.",
        });
        return;
      }

      if (!isValidId(messageId)) {
        res.status(400).json({
          success: false,
          message: "Invalid message ID.",
        });
        return;
      }

      const message = await ChatMessage.findById(messageId)
        .select("+attachment.storageName")
        .exec();

      if (!message?.attachment) {
        res.status(404).json({
          success: false,
          message: "Attachment not found.",
        });
        return;
      }

      const conversationId = String(message.conversationId);
      const conversation = await findMembership(
        conversationId,
        employeeId
      );

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: "Attachment not found.",
        });
        return;
      }

      const storageName = message.attachment.storageName;

      if (
        !storageName ||
        !/^[0-9a-f-]{36}$/i.test(storageName) ||
        path.basename(storageName) !== storageName
      ) {
        res.status(404).json({
          success: false,
          message: "Attachment not found.",
        });
        return;
      }

      const filePath = path.join(CHAT_UPLOAD_DIR, storageName);

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(
          path.basename(message.attachment.originalName)
        )}`
      );

      const stream = createReadStream(filePath);

      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            message: "Attachment file not found.",
          });
        } else {
          res.destroy();
        }
      });

      stream.pipe(res);
    } catch (error) {
      logChatFailure("attachment download", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Could not download the attachment.",
        });
      }
    }
  }
);


chatRoutes.post(
  "/:conversationId/messages",
  messageLimiter,
  verifyChatUploadMembership,
  (req: Request, res: Response, next) => {
    chatUpload.single("attachment")(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          res.status(400).json({
            success: false,
            message:
              error.code === "LIMIT_FILE_SIZE"
                ? "Attachments must be 10 MB or smaller."
                : "The attachment could not be uploaded.",
          });
          return;
        }

        res.status(400).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "The attachment could not be uploaded.",
        });
        return;
      }

      next();
    });
  },
    async (req: Request, res: Response) => {
    let messageSaved = false;

    try {
      const parsed = messageSchema.safeParse({
        content:
          typeof req.body?.content === "string"
            ? req.body.content.trim()
            : "",
      });

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid message.",
        });
        return;
      }

      const content = parsed.data.content;

      if (!content && !req.file) {
        res.status(400).json({
          success: false,
          message: "Enter a message or select an attachment.",
        });
        return;
      }

     if (containsSensitiveData(content)) {
  await removeUploadedFile(req.file);

  res.status(400).json({
          success: false,
          message:
            "Do not share passwords, codes, account/card numbers, balances, or other sensitive banking information in chat.",
        });
        return;
      }

if (req.file) {
  const isValid = await validateUploadedFile(req.file);

  if (!isValid) {
    await removeUploadedFile(req.file);

    res.status(400).json({
      success: false,
      message: "The uploaded file content is invalid or unsupported.",
    });
    return;
  }
}

      const employeeId = getEmployeeId(res)!;
      const conversationId = getRouteParam(req, "conversationId");
      const conversation = await findMembership(conversationId, employeeId);

      if (!conversation) {
  await removeUploadedFile(req.file);

  res.status(isValidId(conversationId) ? 404 : 400).json({
          success: false,
          message: "Conversation not found.",
        });
        return;
      }

      const attachment = req.file
        ? {
            originalName: path.basename(req.file.originalname).slice(0, 255),
            storageName: req.file.filename,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
          }
        : undefined;

      const message = await ChatMessage.create({
        conversationId,
        senderId: employeeId,
        content,
        ...(attachment ? { attachment } : {}),
      });
            messageSaved = true;

      conversation.lastMessageId = message._id;
      conversation.lastMessagePreview = content
        ? content.slice(0, 160)
        : `Attachment: ${attachment?.originalName ?? "file"}`;
      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      await ChatConversation.updateOne(
        {
          _id: conversationId,
          "participants.customerId": employeeId,
          "participants.removedAt": null,
        },
        { $set: { "participants.$.lastReadAt": message.createdAt } }
      );

      const sender = await Customer.findById(employeeId).select("name role");

      const serialized = {
        id: String(message._id),
        conversationId,
        sender: {
          id: employeeId,
          name: sender?.name ?? "Employee",
          role: sender?.role ?? "staff",
        },
        content: message.content,
        attachment: attachment
          ? {
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              downloadUrl: `/api/chat/messages/${message._id}/attachment`,
            }
          : null,
        reactions: [],
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      emitChatEvent(conversationId, "chat:message", serialized);

      const recipients: string[] = conversation.participants
        .filter(
          (participant: any) =>
            !participant.removedAt &&
            String(participant.customerId) !== employeeId
        )
        .map((participant: any) => String(participant.customerId));

      const preview = getSafeNotificationPreview(content);
      const notificationMessage = preview
        ? `Message: ${preview}`
        : attachment
          ? `Attachment: ${attachment.originalName}`
          : "Open the chat to view it.";

      await Promise.all(
        recipients.map((recipientId) =>
          createChatNotification(recipientId, {
            title: sender?.name
              ? `New message from ${sender.name}`
              : "New employee chat message",
            message: notificationMessage,
            eventType: "message",
            conversationId,
            relatedMessageId: String(message._id),
            dedupeKey: `message:${message._id}`,
          })
        )
      );

      res.status(201).json({ success: true, message: serialized });
        } catch (error) {
      if (!messageSaved) {
        await removeUploadedFile(req.file);
      }

      logChatFailure("message send", error);

      res.status(500).json({
        success: false,
        message: "Could not send the message.",
      });
    }
  }
);

chatRoutes.post("/:conversationId/read", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const conversationId = getRouteParam(req, "conversationId");
    const conversation = await findMembership(conversationId, employeeId);
    if (!conversation) {
      res.status(isValidId(conversationId) ? 404 : 400).json({
        success: false,
        message: "Conversation not found.",
      });
      return;
    }
    const readAt = new Date();
    await ChatConversation.updateOne(
      {
        _id: conversation._id,
        participants: {
          $elemMatch: { customerId: employeeId, removedAt: null },
        },
      },
      { $set: { "participants.$.lastReadAt": readAt } }
    );
    res.json({ success: true, readAt });
  } catch (error) {
    logChatFailure("mark read", error);
    res.status(500).json({ success: false, message: "Could not mark messages as read." });
  }
});

chatRoutes.patch("/messages/:messageId/reaction", async (req: Request, res: Response) => {
  try {
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Choose a supported reaction." });
      return;
    }
    const employeeId = getEmployeeId(res)!;
    const messageId = getRouteParam(req, "messageId");
    if (!isValidId(messageId)) {
      res.status(400).json({ success: false, message: "Invalid message ID." });
      return;
    }
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      res.status(404).json({ success: false, message: "Message not found." });
      return;
    }
    const conversation = await findMembership(
      String(message.conversationId),
      employeeId
    );
    if (!conversation) {
      res.status(404).json({ success: false, message: "Message not found." });
      return;
    }

    if (parsed.data.emoji === null) {
      await ChatReaction.deleteOne({ messageId, customerId: employeeId });
    } else {
      try {
        await ChatReaction.findOneAndUpdate(
          { messageId, customerId: employeeId },
          {
            $set: {
              emoji: parsed.data.emoji,
              conversationId: message.conversationId,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        await ChatReaction.updateOne(
          { messageId, customerId: employeeId },
          { $set: { emoji: parsed.data.emoji } }
        );
      }
    }
    const reactions = await serializeReactions([message._id], employeeId);
    const payload = {
      messageId,
      conversationId: String(message.conversationId),
      reactions: reactions.get(messageId) ?? [],
    };
    emitChatEvent(String(message.conversationId), "chat:reaction", payload);
    res.json({ success: true, ...payload });
  } catch (error) {
    logChatFailure("reaction update", error);
    res.status(500).json({ success: false, message: "Could not update the reaction." });
  }
});

chatRoutes.post("/:conversationId/members", async (req: Request, res: Response) => {
  try {
    const body = z
      .object({
        employeeId: z.string().regex(/^[a-f\d]{24}$/i),
        isAdmin: z.boolean().optional().default(false),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ success: false, message: "Choose a valid employee." });
      return;
    }
    const employeeId = getEmployeeId(res)!;
    const conversationId = getRouteParam(req, "conversationId");
    const conversation = await findMembership(conversationId, employeeId);
    if (!conversation || conversation.type !== "group") {
      res.status(404).json({ success: false, message: "Group not found." });
      return;
    }
    const actor = conversation.participants.find(
      (participant: any) => String(participant.customerId) === employeeId
    ) as any;
    if (!actor?.isAdmin) {
      res.status(403).json({ success: false, message: "Only group admins can manage members." });
      return;
    }
    const memberId = body.data.employeeId;
    const employee = await Customer.findOne({
      _id: memberId,
      role: { $in: EMPLOYEE_ROLES },
      status: "active",
    }).select("_id role");
    if (!employee) {
      res.status(404).json({ success: false, message: "Employee not found." });
      return;
    }
    const existing = conversation.participants.find(
      (participant: any) => String(participant.customerId) === memberId
    ) as any;
    if (existing && !existing.removedAt) {
      res.status(409).json({ success: false, message: "Employee is already a group member." });
      return;
    }
    const activeCount = conversation.participants.filter(
      (participant: any) => !participant.removedAt
    ).length;
    if (activeCount >= MAX_GROUP_MEMBERS) {
      res.status(400).json({ success: false, message: "This group has reached its member limit." });
      return;
    }

    if (existing) {
      existing.role = employee.role;
      existing.isAdmin = body.data.isAdmin;
      existing.joinedAt = new Date();
      existing.lastReadAt = new Date();
      existing.removedAt = null;
    } else {
      conversation.participants.push({
        customerId: employee._id,
        role: employee.role,
        isAdmin: body.data.isAdmin,
        lastReadAt: new Date(),
      } as never);
    }
    await conversation.save();
    await emitMembershipNotice(
      String(conversation._id),
      memberId,
      "group_added"
    );
    emitEmployeeEvent(memberId, "chat:membership-added", {
      conversationId: String(conversation._id),
    });
    emitChatEvent(String(conversation._id), "chat:membership-changed", {
      conversationId: String(conversation._id),
      action: "added",
    });
    res.json({ success: true, message: "Employee added to the group." });
  } catch (error) {
    logChatFailure("add group member", error);
    res.status(500).json({ success: false, message: "Could not add the group member." });
  }
});

chatRoutes.delete("/:conversationId/members/:employeeId", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const memberId = getRouteParam(req, "employeeId");
    const conversationId = getRouteParam(req, "conversationId");
    const conversation = await findMembership(conversationId, employeeId);
    if (!conversation || conversation.type !== "group") {
      res.status(404).json({ success: false, message: "Group not found." });
      return;
    }
    const actor = conversation.participants.find(
      (participant: any) => String(participant.customerId) === employeeId
    ) as any;
    const target = conversation.participants.find(
      (participant: any) => String(participant.customerId) === memberId
    ) as any;
    if (!actor?.isAdmin) {
      res.status(403).json({ success: false, message: "Only group admins can manage members." });
      return;
    }
    if (!target || target.removedAt) {
      res.status(404).json({ success: false, message: "Group member not found." });
      return;
    }
    if (memberId === employeeId) {
      res.status(400).json({ success: false, message: "Use the leave-group action to leave." });
      return;
    }
    target.removedAt = new Date();
    await conversation.save();
    disconnectEmployeeFromConversation(memberId, String(conversation._id));
    await emitMembershipNotice(
      String(conversation._id),
      memberId,
      "group_removed"
    );
    emitChatEvent(String(conversation._id), "chat:membership-changed", {
      conversationId: String(conversation._id),
      action: "removed",
      employeeId: memberId,
    });
    res.json({ success: true, message: "Employee removed from the group." });
  } catch (error) {
    logChatFailure("remove group member", error);
    res.status(500).json({ success: false, message: "Could not remove the group member." });
  }
});

chatRoutes.post("/:conversationId/leave", async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(res)!;
    const conversationId = getRouteParam(req, "conversationId");
    const conversation = await findMembership(conversationId, employeeId);
    if (!conversation || conversation.type !== "group") {
      res.status(404).json({ success: false, message: "Group not found." });
      return;
    }
    const actor = conversation.participants.find(
      (participant: any) => String(participant.customerId) === employeeId
    ) as any;
    if (
      actor?.isAdmin &&
      !conversation.participants.some(
        (participant: any) =>
          !participant.removedAt &&
          participant.isAdmin &&
          String(participant.customerId) !== employeeId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Assign another group admin before leaving this group.",
      });
      return;
    }
    actor.removedAt = new Date();
    await conversation.save();
    disconnectEmployeeFromConversation(employeeId, String(conversation._id));
    emitChatEvent(String(conversation._id), "chat:membership-changed", {
      conversationId: String(conversation._id),
      action: "left",
      employeeId,
    });
    res.json({ success: true, message: "You left the group." });
  } catch (error) {
    logChatFailure("leave group", error);
    res.status(500).json({ success: false, message: "Could not leave the group." });
  }
});

export default chatRoutes;
