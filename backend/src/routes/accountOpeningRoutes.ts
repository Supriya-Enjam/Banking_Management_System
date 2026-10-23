
import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import authenticate from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { AccountOpeningApplication } from "../models/AccountOpeningApplication";

const accountOpeningRoutes = Router();

const uploadDirectory = path.resolve(
  process.cwd(),
  "private_uploads",
  "account-opening"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension =
      file.mimetype === "application/pdf"
        ? ".pdf"
        : file.mimetype === "image/png"
          ? ".png"
          : ".jpg";

    callback(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new Error("Only PDF, JPG, and PNG documents are accepted.")
      );
      return;
    }

    callback(null, true);
  },
});

type DocumentType =
  | "identity"
  | "address"
  | "photo"
  | "business_registration";

const allowedDocumentTypes = new Set<DocumentType>([
  "identity",
  "address",
  "photo",
  "business_registration",
]);

function getCustomerId(res: Response): string | undefined {
  const user = res.locals.authenticatedUser as
    | { customerId?: string }
    | undefined;

  return user?.customerId;
}

function removeUploadedFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.error("Could not remove uploaded document:", error);
    }
  }
}

function serializeApplication(application: {
  _id: unknown;
  requestedAccountType: string;
  initialDepositPaise: number;
  status: string;
  reviewRemarks?: string;
  reviewedAt?: Date | null;
  accountId?: unknown;
  documents: Array<{
    _id: unknown;
    documentType: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(application._id),
    accountType: application.requestedAccountType,
    initialDepositPaise: application.initialDepositPaise,
    status: application.status,
    reviewRemarks: application.reviewRemarks ?? "",
    reviewedAt: application.reviewedAt ?? null,
    accountId: application.accountId
      ? String(application.accountId)
      : null,
    documents: application.documents.map((document) => ({
      id: String(document._id),
      documentType: document.documentType,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    })),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

accountOpeningRoutes.use(authenticate);

// Submit a new account-opening application.
accountOpeningRoutes.post(
  "/",
  (req, res, next) => {
    upload.array("documents", 4)(req, res, (error) => {
      if (error) {
        const message =
          error instanceof multer.MulterError
            ? error.code === "LIMIT_FILE_SIZE"
              ? "Each document must be 5 MB or smaller."
              : error.code === "LIMIT_FILE_COUNT"
                ? "You can upload at most four documents."
                : "The uploaded documents could not be processed."
            : error instanceof Error
              ? error.message
              : "Document upload failed.";

        res.status(400).json({
          success: false,
          message,
        });
        return;
      }

      next();
    });
  },
  async (req: Request, res: Response) => {
    const files = (req.files ?? []) as Express.Multer.File[];

    try {
      const customerId = getCustomerId(res);

      if (!customerId) {
        removeUploadedFiles(files);
        res.status(401).json({
          success: false,
          message: "Please sign in again.",
        });
        return;
      }

      const accountType = req.body.accountType;
      const initialDeposit = Number(req.body.initialDeposit ?? 0);

      if (
        !["savings", "current", "business"].includes(accountType)
      ) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Choose a valid account type.",
        });
        return;
      }

      if (
        !Number.isFinite(initialDeposit) ||
        initialDeposit < 0 ||
        initialDeposit > 100000 ||
        !Number.isSafeInteger(Math.round(initialDeposit * 100))
      ) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Initial deposit must be between ₹0 and ₹1,00,000.",
        });
        return;
      }

      if (files.length < 3) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Upload identity proof, address proof, and a photo.",
        });
        return;
      }

      let documentTypes: unknown;

      try {
        documentTypes = JSON.parse(req.body.documentTypes);
      } catch {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Document types are missing or invalid.",
        });
        return;
      }

      if (
        !Array.isArray(documentTypes) ||
        documentTypes.length !== files.length ||
        documentTypes.some(
          (type) =>
            typeof type !== "string" ||
            !allowedDocumentTypes.has(type as DocumentType)
        )
      ) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Every uploaded document must have a valid document type.",
        });
        return;
      }

      const types = documentTypes as DocumentType[];

      if (new Set(types).size !== types.length) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Upload only one document for each document type.",
        });
        return;
      }

      const requiredTypes: DocumentType[] = [
        "identity",
        "address",
        "photo",
      ];

      if (accountType === "business") {
        requiredTypes.push("business_registration");
      }

      if (requiredTypes.some((type) => !types.includes(type))) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message:
            accountType === "business"
              ? "Business accounts require identity, address, photo, and business registration documents."
              : "Upload identity, address, and photo documents.",
        });
        return;
      }

      const customer = await Customer.findById(customerId);

      if (!customer) {
        removeUploadedFiles(files);
        res.status(404).json({
          success: false,
          message: "Customer account was not found.",
        });
        return;
      }

      const existingAccount = await AccountOpeningApplication.findOne({
        customerId,
        requestedAccountType: accountType,
        status: "pending",
      });

      if (existingAccount) {
        removeUploadedFiles(files);
        res.status(409).json({
          success: false,
          message: "You already have a pending application for this account type.",
        });
        return;
      }

      const documents = files.map((file, index) => ({
        documentType: types[index],
        originalName: path.basename(file.originalname).slice(0, 255),
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }));

      const application = await AccountOpeningApplication.create({
        customerId,
        requestedAccountType: accountType,
        initialDepositPaise: Math.round(initialDeposit * 100),
        documents,
        status: "pending",
      });

      res.status(201).json({
        success: true,
        message: "Your account-opening application was submitted for review.",
        application: serializeApplication(application),
      });
    } catch (error) {
      removeUploadedFiles(files);
      console.error("Account-opening submission failed:", error);

      res.status(500).json({
        success: false,
        message: "Could not submit the application. Please try again.",
      });
    }
  }
);

// Return the signed-in customer's own application history.
accountOpeningRoutes.get(
  "/",
  async (_req: Request, res: Response) => {
    try {
      const customerId = getCustomerId(res);

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Please sign in again.",
        });
        return;
      }

      const applications = await AccountOpeningApplication.find({
        customerId,
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        applications: applications.map(serializeApplication),
      });
    } catch (error) {
      console.error("Could not load account applications:", error);

      res.status(500).json({
        success: false,
        message: "Could not load your applications.",
      });
    }
  }
);

export default accountOpeningRoutes;
