import "server-only";

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerativeModel,
} from "@google/generative-ai";
import { jsonrepair } from "jsonrepair";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";

export class GeminiServiceError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "GeminiServiceError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "gemini_error";
    this.retryable = options?.retryable ?? false;
  }
}

export interface GeminiGenerationResult {
  success: boolean;
  text: string;
  model: string;
  usedFallbackModel: boolean;
  error?: string;
}

export interface GeminiStructuredResult<T> extends GeminiGenerationResult {
  data: T | null;
}

let cachedClient: GoogleGenerativeAI | null | undefined;

const DEFAULT_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
] as const;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function getClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = getGeminiApiKey();
  cachedClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  return cachedClient;
}

export function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}

const MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

export function getPrimaryGeminiModel() {
  return MODEL_FALLBACKS[0] ?? DEFAULT_GEMINI_MODEL;
}

function getModel(modelName: string): GenerativeModel {
  const client = getClient();

  if (!client) {
    throw new GeminiServiceError("Gemini API is not configured.", {
      status: 503,
      code: "missing_api_key",
    });
  }

  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
    safetySettings: [...DEFAULT_SAFETY_SETTINGS],
  });
}

function normalizeGeminiError(error: unknown, _modelName: string) {
  if (error instanceof GeminiServiceError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("quota") || lowerMessage.includes("429")) {
    return new GeminiServiceError("Rate limit exceeded.", { status: 429, code: "rate_limited", retryable: true });
  }

  return new GeminiServiceError(message, {
    status: 500,
    code: "request_failed",
    cause: error,
  });
}

function stripMarkdownFences(text: string) {
  return text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function sanitizeJsonPayload(payload: string) {
  return payload
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function previewPayload(payload: string, maxLength = 200) {
  const normalized = payload.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const markdownStripped = stripMarkdownFences(trimmed);
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = markdownStripped.indexOf("{");
  const lastBrace = markdownStripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return markdownStripped.substring(firstBrace, lastBrace + 1);
  }

  const firstBracket = markdownStripped.indexOf("[");
  const lastBracket = markdownStripped.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return markdownStripped.substring(firstBracket, lastBracket + 1);
  }

  return markdownStripped;
}

export function parseGeminiJson<T>(text: string): T {
  const rawPayload = extractJsonPayload(text);

  if (!rawPayload) {
    throw new GeminiServiceError("Empty JSON payload extracted.", { status: 502, code: "empty_payload" });
  }

  const sanitizedPayload = sanitizeJsonPayload(rawPayload);

  try {
    return JSON.parse(rawPayload) as T;
  } catch (initialError) {
    try {
      return JSON.parse(sanitizedPayload) as T;
    } catch {
      console.warn("[Gemini Parser] Standard parsing failed, attempting repair...", {
        rawPreview: previewPayload(rawPayload),
      });

      try {
        const repaired = jsonrepair(sanitizedPayload);
        const parsed = JSON.parse(repaired) as T;
        console.info("[Gemini Parser] JSON repaired successfully.", {
          repairedPreview: previewPayload(repaired),
        });
        return parsed;
      } catch (repairError) {
        console.error("[Gemini Parser] Critical parse failure", {
          rawPreview: previewPayload(rawPayload),
          sanitizedPreview: previewPayload(sanitizedPayload),
          error:
            repairError instanceof Error ? repairError.message : "Unknown",
        });

        throw new GeminiServiceError("AI returned malformed data that could not be repaired.", {
          status: 502,
          code: "invalid_json",
          cause: repairError ?? initialError,
        });
      }
    }
  }
}

let lastRateLimitFailureTime: number = 0;
const GEMINI_COOLDOWN_DURATION = 60 * 1000; // 60 seconds
let loggedCooldownWarning = false; // To prevent spamming console during cooldown
let lastConsoleErrorForRateLimit: string | undefined; // To prevent spamming "rate limit exceeded" messages

// ... (rest of the file)

export async function generateContentWithFallback(
  prompt: string,
): Promise<GeminiGenerationResult> {
  // Check for active cooldown
  if (Date.now() - lastRateLimitFailureTime < GEMINI_COOLDOWN_DURATION) {
    if (!loggedCooldownWarning) {
      console.warn("[Gemini] Gemini API is in cooldown period. Returning fallback immediately.");
      loggedCooldownWarning = true;
      lastConsoleErrorForRateLimit = undefined; // Reset last error message to allow a new one after cooldown starts
    }
    return {
      success: false,
      text: "",
      model: "none",
      usedFallbackModel: false, // Not used a fallback model, entire system is in cooldown
      error: "Gemini API is in cooldown period. Try again later.",
    };
  } else {
    // Reset warning flag when cooldown expires
    if (loggedCooldownWarning) { // Only log reset if it was previously active
      console.info("[Gemini] Gemini API cooldown has expired.");
    }
    loggedCooldownWarning = false;
    lastConsoleErrorForRateLimit = undefined; // Clear the last error message as cooldown has passed
  }

  let lastError: GeminiServiceError | undefined;

  const hardenedPrompt = `${prompt}

IMPORTANT RESPONSE RULES:
- Return ONLY valid JSON.
- No markdown.
- No explanations.
- No backticks.`;

  for (const [index, modelName] of MODEL_FALLBACKS.entries()) {
    if (!modelName) {
      continue; // Skip if modelName is empty or undefined
    }
    try {
      const model = getModel(modelName);
      const result = await model.generateContent(hardenedPrompt);
      const text = result.response.text();

      // If successful, reset cooldown timer and error logging state
      lastRateLimitFailureTime = 0;
      loggedCooldownWarning = false;
      lastConsoleErrorForRateLimit = undefined;
      
      return {
        success: true,
        text,
        model: modelName,
        usedFallbackModel: index > 0,
      };
    } catch (error) {
      const normalizedError = normalizeGeminiError(error, modelName);
      lastError = normalizedError;

      // Only log unique rate limit errors during the cooldown detection phase
      if (normalizedError.code === "rate_limited") {
        if (lastConsoleErrorForRateLimit !== normalizedError.message) {
          console.error(`[Gemini] Model ${modelName} failed due to rate limit:`, normalizedError.message);
          lastConsoleErrorForRateLimit = normalizedError.message;
        }
        lastRateLimitFailureTime = Date.now(); // Set cooldown timestamp
        loggedCooldownWarning = true; // Mark that cooldown has started, so next calls will log once.
        continue; // Try next fallback model
      } else {
        // Log other errors normally
        console.error(`[Gemini] Model ${modelName} failed with non-rate-limit error:`, normalizedError.message);
      }
      break; // For non-rate-limit errors, stop trying fallback models
    }
  }

  // All models failed (either all rate-limited, or one failed with a non-rate-limit error)
  return {
    success: false,
    text: "",
    model: "none",
    usedFallbackModel: true,
    error: lastError?.message || "All Gemini models unavailable",
  };
}

export async function generateStructuredContentWithFallback<T>(
  prompt: string,
): Promise<GeminiStructuredResult<T>> {
  let parseError: GeminiServiceError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryPrompt =
      attempt === 0
        ? prompt
        : `${prompt}

Your previous response was malformed.
Return ONLY valid JSON.
No markdown.
No explanations.
No backticks.`;

    const generation = await generateContentWithFallback(retryPrompt);

    // If generateContentWithFallback failed, propagate its failure
    if (!generation.success) {
      return {
        ...generation,
        data: null, // No structured data on generation failure
      };
    }

    try {
      return {
        ...generation,
        data: parseGeminiJson<T>(generation.text),
      };
    } catch (error) {
      // Existing error handling for parseGeminiJson
      if (
        error instanceof GeminiServiceError &&
        error.code === "invalid_json" &&
        attempt === 0
      ) {
        finalParseError = error; // Store the error for the final return if repair fails
        console.warn("[Gemini] Retrying once after malformed JSON response.", {
          model: generation.model,
        });
        continue; // Retry with modified prompt
      }

      // If parseGeminiJson throws for any other reason or after the second attempt,
      // return a failure result instead of rethrowing.
      const parseFailError = error instanceof GeminiServiceError
        ? error
        : new GeminiServiceError("Failed to parse AI response.", { cause: error });

      return {
        success: false,
        text: generation.text,
        model: generation.model,
        usedFallbackModel: generation.usedFallbackModel,
        data: null,
        error: parseFailError.message,
      };
    }
  }

  // If we reach here, it means parsing failed twice.
  // Return the last parse error as a failed result, instead of throwing.
  return {
    success: false,
    text: "", // No successful text from which to parse
    model: "none", // Indicate no model produced valid structured output
    usedFallbackModel: true, // Indicates multiple attempts/models failed
    data: null,
    error: finalParseError?.message || "Gemini returned malformed JSON twice.",
  };
}
