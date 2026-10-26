
import fs from "node:fs/promises";
import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

export type DocumentVerificationStatus =
  | "readable"
  | "unreadable"
  | "manual_review";

export interface DocumentAnalysisResult {
  verificationStatus: DocumentVerificationStatus;
  analysisMessage: string;
  analyzedAt: Date;
}

const MINIMUM_TEXT_LENGTH = 50;
const MINIMUM_WORD_COUNT = 8;

function hasMeaningfulText(text: string): boolean {
  const normalizedText = text
    .replace(/\s+/g, " ")
    .trim();

  const words = normalizedText.match(
    /[\p{L}\p{N}]{2,}/gu
  ) ?? [];

  const meaningfulCharacters = normalizedText.match(
    /[\p{L}\p{N}]/gu
  ) ?? [];

  return (
    meaningfulCharacters.length >= MINIMUM_TEXT_LENGTH &&
    words.length >= MINIMUM_WORD_COUNT
  );
}

function createResult(
  verificationStatus: DocumentVerificationStatus,
  analysisMessage: string
): DocumentAnalysisResult {
  return {
    verificationStatus,
    analysisMessage,
    analyzedAt: new Date(),
  };
}

export async function analyzeDocument(
  filePath: string,
  mimeType: string
): Promise<DocumentAnalysisResult> {
  try {
    if (mimeType === "application/pdf") {
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({
        data: new Uint8Array(buffer),
      });

      try {
        const result = await parser.getText();
        const extractedText = result.text.trim();

        if (hasMeaningfulText(extractedText)) {
          return createResult(
            "readable",
            "Text was extracted from the PDF. Document authenticity has not been verified."
          );
        }

        return createResult(
          "manual_review",
          "No sufficient embedded text was found. This PDF may be scanned and requires further inspection."
        );
      } finally {
        await parser.destroy();
      }
    }

    if (
      mimeType === "image/jpeg" ||
      mimeType === "image/png"
    ) {
      const worker = await createWorker("eng");

      try {
        const result = await worker.recognize(filePath);
        const extractedText = result.data.text.trim();

        if (hasMeaningfulText(extractedText)) {
          return createResult(
            "readable",
            "Text was detected in the image. Document authenticity has not been verified."
          );
        }

        return createResult(
          "unreadable",
          "Very little text was detected. Please upload a clearer image or request staff review."
        );
      } finally {
        await worker.terminate();
      }
    }

    return createResult(
      "manual_review",
      "This file format requires manual inspection."
    );
  } catch (error) {
    console.error("Document analysis failed:", error);

    return createResult(
      "manual_review",
      "Automatic analysis could not be completed. Staff review is required."
    );
  }
}
