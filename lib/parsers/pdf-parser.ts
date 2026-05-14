import "server-only";

/**
 * PDF Parsing Service using 'unpdf'
 * Optimized for Next.js 15 App Router.
 * No manual PDF.js configuration required.
 */

export async function parsePdfBuffer(
  buffer: Buffer
): Promise<string> {
  console.log(
    "[PDF Parser] Starting extraction. Buffer length:",
    buffer.length
  );

  try {
    // Dynamically import unpdf only on server runtime
    const { extractText } = await import("unpdf");

    console.log("[PDF Parser] Calling extractText...");

    // Convert Buffer -> Uint8Array
    const result = await extractText(
      new Uint8Array(buffer)
    );

    console.log(
      "[PDF Parser] extractText completed. Result keys:",
      Object.keys(result)
    );

    /**
     * Normalize extracted text
     */
    let rawText = "";

    if (typeof result.text === "string") {
      rawText = result.text;

      console.log(
        "[PDF Parser] Result text is string. Length:",
        rawText.length
      );
    } else if (Array.isArray(result.text)) {
      rawText = result.text.join("\n");

      console.log(
        "[PDF Parser] Result text is array. Item count:",
        result.text.length,
        "Total length:",
        rawText.length
      );
    } else {
      console.warn(
        "[PDF Parser] Unexpected result.text type:",
        typeof result.text
      );
    }

    /**
     * Cleanup extracted text
     */
    const cleanedText = rawText
      .replace(/\u0000/g, "")
      .replace(/\s+/g, " ")
      .trim();

    /**
     * Validate extracted content
     */
    if (!cleanedText || cleanedText.length < 10) {
      console.warn(
        "[PDF Parser] Extracted text too short or empty."
      );

      throw new Error("EMPTY_OR_CORRUPTED_PDF");
    }

    console.log(
      "[PDF Parser] Final cleaned text length:",
      cleanedText.length
    );

    return cleanedText;
  } catch (error: any) {
    console.error(
      "[PDF Parser] Critical Failure:",
      error
    );

    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unknown PDF parsing error";

    /**
     * Password protected PDF
     */
    if (
      message.toLowerCase().includes("password")
    ) {
      throw new Error(
        "CANNOT_PARSE_PASSWORD_PROTECTED_PDF"
      );
    }

    /**
     * Empty or image-only PDF
     */
    if (message === "EMPTY_OR_CORRUPTED_PDF") {
      throw new Error(
        "The PDF appears to be empty or contains no extractable text."
      );
    }

    /**
     * Generic extraction failure
     */
    throw new Error(
      `FAILED_TO_EXTRACT_PDF_TEXT: ${message}`
    );
  }
}