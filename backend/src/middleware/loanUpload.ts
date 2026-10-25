
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const uploadDirectory = path.resolve(
  process.cwd(),
  "private-uploads",
  "loans"
);

// Create the private storage directory if it does not exist.
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    // Never use the customer's original filename as the stored filename.
    callback(null, `${randomUUID()}${extension}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedMimeTypes.has(file.mimetype) ||
    !allowedExtensions.has(extension)
  ) {
    callback(
      new Error("Only PDF, JPG, JPEG, and PNG documents are allowed.")
    );
    return;
  }

  callback(null, true);
}

export const loanDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 5,
  },
});
