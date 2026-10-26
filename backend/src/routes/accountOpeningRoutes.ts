
import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import authenticate, { requireRoles } from "../middleware/authenticate";
import { Customer } from "../models/Customer";
import { AccountOpeningApplication } from "../models/AccountOpeningApplication";
import { analyzeDocument } from "../services/documentAnalysis";

const accountOpeningRoutes = Router();

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_COUNT = 4;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const uploadDirectory = path.resolve(
  process.cwd(),
  "private_uploads",
  "account-opening"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set<string>(ALLOWED_MIME_TYPES);

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
    fileSize: MAX_DOCUMENT_SIZE_BYTES,
    files: MAX_DOCUMENT_COUNT,
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


function hasValidFileSignature(file: Express.Multer.File): boolean {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(file.path, "r");

    let bytesRead: number;

    try {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(fd);
    }

    if (file.mimetype === "application/pdf") {
      return (
        bytesRead >= 5 &&
        buffer.subarray(0, 5).toString("ascii") === "%PDF-"
      );
    }

    if (file.mimetype === "image/png") {
      return (
        bytesRead >= 8 &&
        buffer.equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )
      );
    }

    if (file.mimetype === "image/jpeg") {
      return (
        bytesRead >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    return false;
  } catch (error) {
    console.error("Could not inspect uploaded file signature:", error);
    return false;
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
    verificationStatus: string;
    analysisMessage: string;
    analyzedAt?: Date | null;
    authenticityStatus?: string;
    authenticityMessage?: string;
    authenticityVerifiedAt?: Date | null;
  }>;
  applicantDetails?: {
    fullName?: string | null;
    dateOfBirth?: Date | null;
    email?: string | null;
    mobileNumber?: string | null;
    residentialAddress?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(application._id),
    accountType: application.requestedAccountType,
    applicantDetails: application.applicantDetails
      ? {
          fullName: application.applicantDetails.fullName,
          dateOfBirth: application.applicantDetails.dateOfBirth,
          email: application.applicantDetails.email,
          mobileNumber: application.applicantDetails.mobileNumber,
          residentialAddress:
            application.applicantDetails.residentialAddress,
        }
      : null,
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
            verificationStatus: document.verificationStatus,
      analysisMessage: document.analysisMessage,
      analyzedAt: document.analyzedAt,
            authenticityStatus: document.authenticityStatus ?? "pending",
            authenticityMessage:
              document.authenticityMessage ??
              "Document authenticity has not been verified.",
            authenticityVerifiedAt:
              document.authenticityVerifiedAt ?? null,
    })),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

accountOpeningRoutes.use(authenticate);
accountOpeningRoutes.use(requireRoles("customer"));

accountOpeningRoutes.get("/requirements", (_req, res) => {
  res.json({
    success: true,
    maxDocumentSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
    maxDocumentCount: MAX_DOCUMENT_COUNT,
    acceptedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

// Submit a new account-opening application.
accountOpeningRoutes.post(
  "/",
  (req, res, next) => {
    upload.array("documents", MAX_DOCUMENT_COUNT)(req, res, (error) => {
      if (error) {
        const message =
          error instanceof multer.MulterError
            ? error.code === "LIMIT_FILE_SIZE"
              ? `Each document must be ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)} MB or smaller.`
              : error.code === "LIMIT_FILE_COUNT"
            ? `You can upload at most ${MAX_DOCUMENT_COUNT} documents.`
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


      const invalidSignatureFile = files.find(
        (file) => !hasValidFileSignature(file)
      );

      if (invalidSignatureFile) {
        removeUploadedFiles(files);

        res.status(400).json({
          success: false,
          message:
            `The file "${path.basename(invalidSignatureFile.originalname)}" ` +
            "does not match its declared PDF, JPG, or PNG format. Please upload a valid document.",
        });
        return;
      }


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
      const applicantDetails = {
        fullName:
          typeof req.body.fullName === "string"
            ? req.body.fullName.trim()
            : "",
        dateOfBirth:
          typeof req.body.dateOfBirth === "string"
            ? req.body.dateOfBirth.trim()
            : "",
        email:
          typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "",
        mobileNumber:
          typeof req.body.mobileNumber === "string"
            ? req.body.mobileNumber.trim()
            : "",
        residentialAddress:
          typeof req.body.residentialAddress === "string"
            ? req.body.residentialAddress.trim()
            : "",
      };
      const dateOfBirth = new Date(`${applicantDetails.dateOfBirth}T00:00:00.000Z`);
      const validDateOfBirth =
        /^\d{4}-\d{2}-\d{2}$/.test(applicantDetails.dateOfBirth) &&
        !Number.isNaN(dateOfBirth.getTime()) &&
        dateOfBirth.toISOString().slice(0, 10) ===
          applicantDetails.dateOfBirth &&
        dateOfBirth.getTime() <= Date.now();

      if (
        applicantDetails.fullName.length < 2 ||
        applicantDetails.fullName.length > 80 ||
        !validDateOfBirth ||
        applicantDetails.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantDetails.email) ||
        applicantDetails.mobileNumber.length > 30 ||
        !/^[+()\d\s.-]{7,30}$/.test(applicantDetails.mobileNumber) ||
        (applicantDetails.mobileNumber.match(/\d/g)?.length ?? 0) < 7 ||
        (applicantDetails.mobileNumber.match(/\d/g)?.length ?? 0) > 15 ||
        applicantDetails.residentialAddress.length < 5 ||
        applicantDetails.residentialAddress.length > 250
      ) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message: "Enter valid name, date of birth, email, mobile number, and residential address.",
        });
        return;
      }

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
        Math.abs(initialDeposit * 100 - Math.round(initialDeposit * 100)) >
          0.000001 ||
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

      if (
        accountType !== "business" &&
        types.includes("business_registration")
      ) {
        removeUploadedFiles(files);
        res.status(400).json({
          success: false,
          message:
            "Business registration documents are accepted only for business account applications.",
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


      const documents = await Promise.all(
        files.map(async (file, index) => {
          const analysis = await analyzeDocument(
            file.path,
            file.mimetype
          );

          return {
            documentType: types[index],
            originalName: path.basename(file.originalname).slice(0, 255),
            storedName: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            verificationStatus: analysis.verificationStatus,
            analysisMessage: analysis.analysisMessage,
            analyzedAt: analysis.analyzedAt,
          };
        })
      );

      const failedDocument = documents.find(
        (document) => document.verificationStatus !== "readable"
      );

      if (failedDocument) {
        removeUploadedFiles(files);

        res.status(400).json({
          success: false,
          message:
            `The document "${failedDocument.originalName}" could not be confirmed readable. ` +
            `${failedDocument.analysisMessage} Please upload a clearer document before submitting.`,
          documentType: failedDocument.documentType,
          verificationStatus: failedDocument.verificationStatus,
        });

        return;
      }


      const application = await AccountOpeningApplication.create({
        customerId,
        applicantDetails: {
          ...applicantDetails,
          dateOfBirth,
        },
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

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res.status(409).json({
          success: false,
          message:
            "You already have a pending application for this account type.",
        });
        return;
      }

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
