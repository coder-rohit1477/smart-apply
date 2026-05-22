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
  text: string;
  model: string;
  usedFallbackModel: boolean;
}

export interface GeminiStructuredResult<T> extends GeminiGenerationResult {
  data: T;
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

export function getConfiguredGeminiModels() {
  return Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL?.trim() ?? "",
        process.env.GEMINI_FALLBACK_MODEL?.trim() ?? "",
        DEFAULT_GEMINI_MODEL,
        DEFAULT_GEMINI_FALLBACK_MODEL,
      ]
        .filter(Boolean),
    ),
  );
}

export function getPrimaryGeminiModel() {
  return getConfiguredGeminiModels()[0] ?? DEFAULT_GEMINI_MODEL;
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
      temperature: 0.1, // Lowered for more stability in JSON
      topP: 0.8,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
    safetySettings: [...DEFAULT_SAFETY_SETTINGS],
  });
}

function normalizeGeminiError(error: unknown, modelName: string) {
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

export async function generateContentWithFallback(
  prompt: string,
  options: { retryOnParseFailure?: boolean } = { retryOnParseFailure: true }
): Promise<GeminiGenerationResult> {
  const models = getConfiguredGeminiModels();
  let lastError: any;

  // Append strict formatting instructions globally
  const hardenedPrompt = `${prompt}

IMPORTANT RESPONSE RULES:
- Return ONLY valid JSON.
- No markdown.
- No explanations.
- No backticks.`;

  for (const [index, modelName] of models.entries()) {
    try {
      const model = getModel(modelName);
      const result = await model.generateContent(hardenedPrompt);
      const text = result.response.text();

      return {
        text,
        model: modelName,
        usedFallbackModel: index > 0,
      };
    } catch (error) {
      const normalizedError = normalizeGeminiError(error, modelName);
      lastError = normalizedError;
      
      console.error(`[Gemini] Model ${modelName} failed`, normalizedError.message);
      
      if (normalizedError.code === "rate_limited" || normalizedError.status === 503) {
        continue; // Try next model
      }
      break; 
    }
  }

  throw lastError || new Error("Gemini request failed");
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

    try {
      return {
        ...generation,
        data: parseGeminiJson<T>(generation.text),
      };
    } catch (error) {
      if (
        error instanceof GeminiServiceError &&
        error.code === "invalid_json" &&
        attempt === 0
      ) {
        parseError = error;
        console.warn("[Gemini] Retrying once after malformed JSON response.", {
          model: generation.model,
        });
        continue;
      }

      throw error;
    }
  }

  throw parseError ?? new GeminiServiceError("Gemini returned malformed JSON twice.", {
    status: 502,
    code: "invalid_json",
  });
}
