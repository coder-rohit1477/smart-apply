import "server-only";

export async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid loading heavy dependencies on non-parsing routes
    const mammothModule = (await import("mammoth")) as any;
    const mammoth = mammothModule.default || mammothModule;
    
    const result = await mammoth.extractRawText({ buffer });

    return result.value.trim();
  } catch (error) {
    console.error("DOCX parsing failed:", error);
    throw new Error("Failed to extract text from DOCX resume.", { cause: error });
  }
}
