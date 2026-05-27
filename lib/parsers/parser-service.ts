import "server-only";
import path from "node:path";
import { extractStructuredResume } from "@/lib/parsers/extractors";
import { normalizeResumeText } from "@/lib/parsers/normalize";
import type { ParserResult, ResumeMetadata } from "@/types/resume";

/**
 * Orchestration service for resume parsing.
 * Routes files to appropriate parsers (PDF or DOCX) and normalizes output.
 */
export async function parseResumeBuffer(input: {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string | null;
}): Promise<ParserResult> {
  console.log("[Parser Service] Orchestrating parse for:", input.fileName, "Type:", input.fileType, "Size:", input.fileSize);
  
  const metadata: ResumeMetadata = {
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.fileSize,
    fileUrl: input.fileUrl ?? null,
  };

  const extension = path.extname(input.fileName).toLowerCase();
  console.log("[Parser Service] Detected extension:", extension);
  
  let rawContent: string;
  
  try {
    if (extension === ".pdf") {
      console.log("[Parser Service] Routing to PDF parser...");
      // Dynamic import ensures heavy parser logic only loads when needed.
      const { parsePdfBuffer } = await import("@/lib/parsers/pdf-parser");
      rawContent = await parsePdfBuffer(input.buffer);
    } else if (extension === ".docx") {
      console.log("[Parser Service] Routing to DOCX parser...");
      // Mammoth is used for DOCX as it preserves semantic structure well.
      const { parseDocxBuffer } = await import("@/lib/parsers/docx-parser");
      rawContent = await parseDocxBuffer(input.buffer);
    } else {
      console.warn("[Parser Service] Unsupported extension:", extension);
      throw new Error("UNSUPPORTED_FILE_TYPE");
    }

    console.log("[Parser Service] Extraction successful. Raw content length:", rawContent.length);
    const rawText = normalizeResumeText(rawContent);
    console.log("[Parser Service] Text normalized. Normalized length:", rawText.length);

    if (!rawText || rawText.length < 50) {
      console.warn("[Parser Service] Content too short after normalization.");
      throw new Error("EMPTY_OR_TOO_SHORT_CONTENT");
    }

    // Extract structured data using the modular extractor system.
    console.log("[Parser Service] Extracting structured data...");
    const parsedResume = extractStructuredResume(rawText);
    console.log("[Parser Service] Parse complete.");

    return {
      metadata,
      rawText,
      parsedResume,
      warnings: [],
    };
  } catch (error: any) {
    console.error("[Parser Service] Pipeline failure:", error);
    // Map specific technical errors to semantic codes for the ResumeService.
    const message = error.message || "";
    
    if (message.includes("PASSWORD")) {
      throw new Error("This PDF is password protected and cannot be parsed.", { cause: error });
    }
    if (message.includes("INVALID") || message.includes("CORRUPTED")) {
      throw new Error("The resume file appears to be corrupted.", { cause: error });
    }
    if (message === "UNSUPPORTED_FILE_TYPE") {
      throw new Error("Only PDF and DOCX files are supported.", { cause: error });
    }
    if (message === "EMPTY_OR_TOO_SHORT_CONTENT") {
      throw new Error("We couldn't find enough text in your resume. Is it a scanned image?", { cause: error });
    }

    // Re-throw if it's already a formatted error or a generic one.
    throw error;
  }
}
