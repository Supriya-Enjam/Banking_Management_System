
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { randomInt, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import authenticate, {
  requireRoles,
} from "../middleware/authenticate";

import { BankAccount } from "../models/BankAccount";
import { AccountOpeningApplication } from "../models/AccountOpeningApplication";
import { Transaction } from "../models/Transaction";
import { sendAccountOpenedEmail } from "../services/emailService";

const staffAccountOpeningRoutes = Router();

staffAccountOpeningRoutes.use(authenticate);
staffAccountOpeningRoutes.use(
  requireRoles("staff", "management", "admin")
);

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

function getReviewerId(res: Response): string | undefined {
  const user = res.locals.authenticatedUser as
    | { customerId?: string }
    | undefined;

  return user?.customerId;
}

async function generateAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const accountNumber = `VB${Date.now()}${randomInt(1000, 10000)}`;

    const exists = await BankAccount.exists({ accountNumber });

    if (!exists) {
      return accountNumber;
    }
  }

  throw new Error("Could not generate a unique account number.");
}

function serializeApplication(application: any) {
  const customer =
    application.customerId &&
    typeof application.customerId === "object" &&
    "email" in application.customerId
      ? {
          id: String(application.customerId._id),
          name: application.customerId.name,
          email: application.customerId.email,
        }
      : {
          id: String(application.customerId),
          name: "Customer",
          email: "",
        };

  return {
    id: String(application._id),
    customer,
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
    accountType: application.requestedAccountType,
    initialDepositPaise: application.initialDepositPaise,
    status: application.status,
    reviewRemarks: application.reviewRemarks ?? "",
    reviewedAt: application.reviewedAt ?? null,
    accountId: application.accountId
      ? String(application.accountId)
      : null,

documents: application.documents.map((document: any) => ({
  id: String(document._id),
  documentType: document.documentType,
  originalName: document.originalName,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  verificationStatus: document.verificationStatus ?? "pending",
  analysisMessage:
    document.analysisMessage ??
    "Document analysis details are not available.",
  analyzedAt: document.analyzedAt ?? null,
  authenticityStatus: document.authenticityStatus,
  authenticityMessage: document.authenticityMessage,
  authenticityVerifiedAt: document.authenticityVerifiedAt,
authenticityVerifiedBy: document.authenticityVerifiedBy,
})),

    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

// -----------------------------------------------------
// GET /api/staff/account-opening
// Optional query: ?status=pending|approved|rejected
// -----------------------------------------------------

staffAccountOpeningRoutes.get(
  "/",
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status;
      const filter: Record<string, unknown> = {};

      if (
        typeof status === "string" &&
        ["pending", "approved", "rejected"].includes(status)
      ) {
        filter.status = status;
      }

      const applications = await AccountOpeningApplication.find(filter)
        .populate("customerId", "name email")
        .sort({ createdAt: -1 })
        .limit(200);

      return res.json({
        success: true,
        applications: applications.map(serializeApplication),
      });
    } catch (error) {
      console.error(
        "Could not load account-opening applications:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not load account-opening applications.",
      });
    }
  }
);

// -----------------------------------------------------
// GET /api/staff/account-opening/:id/documents/:documentId
// View a private uploaded document.
// -----------------------------------------------------

staffAccountOpeningRoutes.get(
  "/:id/documents/:documentId",
  async (req: Request, res: Response) => {
    try {
      const { id, documentId } = req.params;

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(documentId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid application or document ID.",
        });
      }

      const application =
        await AccountOpeningApplication.findById(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Account-opening application not found.",
        });
      }

      const document = application.documents.find(
        (item) => String(item._id) === documentId
      );

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      const allowedMimeTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
      ];

      if (!allowedMimeTypes.includes(document.mimeType)) {
        return res.status(415).json({
          success: false,
          message: "This document type cannot be previewed.",
        });
      }

      const uploadDirectory = path.resolve(
        process.cwd(),
        "private_uploads",
        "account-opening"
      );

      const storedName = document.storedName;

      if (
        path.basename(storedName) !== storedName ||
        storedName.includes("..")
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid stored document reference.",
        });
      }

      const filePath = path.resolve(
        uploadDirectory,
        storedName
      );

      if (!filePath.startsWith(uploadDirectory + path.sep)) {
        return res.status(400).json({
          success: false,
          message: "Invalid document path.",
        });
      }

      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch {
        return res.status(404).json({
          success: false,
          message: "The uploaded document file could not be found.",
        });
      }

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; sandbox"
      );

      const stream = fs.createReadStream(filePath);

      stream.on("error", (error) => {
        console.error("Private document streaming failed:", error);

        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Could not open the document.",
          });
        } else {
          res.destroy(error);
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Private document retrieval failed:", error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve the document.",
      });
    }
  }
);


/* -----------------------------------------------------
   PATCH /api/staff/account-opening/:id/documents/:documentId/verify
   Body: { decision: "verified" | "rejected", remarks: string }
----------------------------------------------------- */

staffAccountOpeningRoutes.patch(
  "/:id/documents/:documentId/verify",
  async (req: Request, res: Response) => {
    const reviewerId = getReviewerId(res);

    if (!reviewerId || !mongoose.isValidObjectId(reviewerId)) {
      return res.status(401).json({
        success: false,
        message: "Your staff session is invalid. Please sign in again.",
      });
    }

    const { id, documentId } = req.params;
    const { decision, remarks } = req.body ?? {};

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(documentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid application or document ID.",
      });
    }

    if (decision !== "verified" && decision !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Decision must be verified or rejected.",
      });
    }

    if (
      typeof remarks !== "string" ||
      remarks.trim().length === 0 ||
      remarks.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide verification remarks of 1–500 characters.",
      });
    }

    try {
      const application =
        await AccountOpeningApplication.findOne({
          _id: id,
          status: "pending",
        });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Pending account-opening application not found.",
        });
      }

      const document = application.documents.find(
        (item) => String(item._id) === documentId
      );

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found in this application.",
        });
      }

      // Readability is a prerequisite, not proof of authenticity.
      if (
        decision === "verified" &&
        document.verificationStatus !== "readable"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only readable documents can be marked verified. Request a clearer document or resolve manual review first.",
        });
      }

      document.authenticityStatus = decision;
      document.authenticityMessage = remarks.trim();
      document.authenticityVerifiedAt = new Date();
      document.authenticityVerifiedBy = new mongoose.Types.ObjectId(
        reviewerId
      );

      await application.save();

      return res.json({
        success: true,
        message:
          decision === "verified"
            ? "Document verification decision recorded."
            : "Document rejected during authenticity review.",
        application: serializeApplication(application),
      });
    } catch (error) {
      console.error("Document authenticity review failed:", error);

      return res.status(500).json({
        success: false,
        message: "Could not record the document verification decision.",
      });
    }
  }
);


// -----------------------------------------------------
// PATCH /api/staff/account-opening/:id/review
// Body: { decision: "approved" | "rejected", remarks?: string }
// -----------------------------------------------------

staffAccountOpeningRoutes.patch(
  "/:id/review",
  async (req: Request, res: Response) => {
    const reviewerId = getReviewerId(res);

    if (!reviewerId || !mongoose.isValidObjectId(reviewerId)) {
      return res.status(401).json({
        success: false,
        message: "Your staff session is invalid. Please sign in again.",
      });
    }

    const { id } = req.params;
    const { decision, remarks = "" } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID.",
      });
    }

    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected.",
      });
    }

    if (
      typeof remarks !== "string" ||
      remarks.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Review remarks must be 500 characters or fewer.",
      });
    }

    if (decision === "rejected" && !remarks.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for rejecting the application.",
      });
    }

    const session = await mongoose.startSession();

    try {
      let accountDetails:
        | {
            id: string;
            accountNumber: string;
            accountType: string;
            balancePaise: number;
            createdAt: Date;
          }
        | undefined;

      await session.withTransaction(async () => {
        const application = await AccountOpeningApplication.findOne({
  _id: id,
  status: "pending",
}).session(session);

if (!application) {
  throw new Error("APPLICATION_ALREADY_REVIEWED");
}

if (decision === "approved") {
  const unverifiedDocument = application.documents.find(
    (document) =>
      document.verificationStatus !== "readable" ||
      document.authenticityStatus !== "verified"
  );

  if (unverifiedDocument) {
    throw new Error("DOCUMENTS_NOT_VERIFIED");
  }
}

application.status = decision;
application.reviewRemarks = remarks.trim();
application.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
application.reviewedAt = new Date();

        if (decision === "approved") {


  const accountNumber = await generateAccountNumber();

          const dailyLimitPaise =
            application.requestedAccountType === "business"
              ? 50_000_000
              : 10_000_000;

          const [account] = await BankAccount.create(
            [
              {
                customerId: application.customerId,
                accountNumber,
                accountType: application.requestedAccountType,
                balancePaise: application.initialDepositPaise,
                dailyLimitPaise,
                status: "active",
              },
            ],
            { session }
          );

          // Record the initial deposit without adding it
          // to the balance a second time.
          if (application.initialDepositPaise > 0) {
            await Transaction.create(
              [
                {
                  accountId: account._id,
                  reference: `VB-${randomUUID()}`,
                  type: "deposit",
                  category: "Account Opening",
                  amountPaise: application.initialDepositPaise,
                  description:
                    "Initial deposit for newly opened account",
                  status: "completed",
                },
              ],
              { session }
            );
          }

          application.accountId = account._id;


          accountDetails = {
            id: String(account._id),
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            balancePaise: account.balancePaise,
            createdAt: account.createdAt,
          };
        }

        await application.save({ session });
      });

      // The database transaction has committed at this point.
      const application =
        await AccountOpeningApplication.findById(id).populate(
          "customerId",
          "name email"
        );

      if (!application) {
        return res.status(500).json({
          success: false,
          message:
            "The review completed, but the application could not be reloaded.",
        });

      }
      // Send the email after committing the database transaction.
      // Email failures must not undo a successfully opened account.
      if (decision === "approved" && accountDetails) {
        const customer = application.customerId as unknown as {
          name?: string;
          email?: string;
        };

        if (customer.email) {
          try {
            await sendAccountOpenedEmail(
              customer.email,
              customer.name ?? "Customer",
              {
                accountNumber: accountDetails.accountNumber,
                accountType: accountDetails.accountType,
                balancePaise: accountDetails.balancePaise,
                openingDate: accountDetails.createdAt,
              }
            );
          } catch (emailError) {
            console.error(
              "Account was opened, but its confirmation email could not be sent.",
              emailError
            );
          }
        } else {
          console.warn(
            "Account was opened, but the customer has no email address."
          );
        }
      }

      return res.json({
        success: true,
        message:
          decision === "approved"
            ? "Application approved and bank account created successfully."
            : "Application rejected successfully.",
        application: serializeApplication(application),
        account: accountDetails ?? null,
      });
    } catch (error) {
      if (
  error instanceof Error &&
  error.message === "DOCUMENTS_NOT_VERIFIED"
) {
  return res.status(400).json({
    success: false,
    message:
      "All submitted documents must be readable and authenticity-verified before this application can be approved.",
  });
}
      if (
        error instanceof Error &&
        error.message === "APPLICATION_ALREADY_REVIEWED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This application has already been reviewed. Refresh the application list.",
        });
      }

      console.error("Account-opening review failed:", error);

      return res.status(500).json({
        success: false,
        message: "Could not complete the application review.",
      });
    } finally {
      await session.endSession();
    }
  }
);

export default staffAccountOpeningRoutes;
