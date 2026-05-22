import { z } from "zod";

import {
  GeminiServiceError,
  generateStructuredContentWithFallback,
  getPrimaryGeminiModel,
} from "../gemini";
import { createJobMatchFallback } from "./ai-fallbacks";

export interface JobMatchResult {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: string;
  reasoning: string;
}

const jobMatchResultSchema = z.object({
  matchScore: z.number().finite(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  recommendation: z.string(),
  reasoning: z.string(),
});

function normalizeMatchResult(result: JobMatchResult): JobMatchResult {
  return {
    matchScore: Math.max(0, Math.min(100, Math.round(result.matchScore || 0))),
    matchedSkills: result.matchedSkills ?? [],
    missingSkills: result.missingSkills ?? [],
    recommendation: result.recommendation?.trim() ?? "",
    reasoning: result.reasoning?.trim() ?? "",
  };
}

/**
 * Modernized AI Job Matcher with resilient Gemini integration.
 */
export async function performAiJobMatch(
  resumeText: string,
  jobDescription: string,
): Promise<JobMatchResult> {
  console.log("[AI Job Match] Performing match", {
    model: getPrimaryGeminiModel(),
  });

  const prompt = `
You are a senior technical recruiter. Match the following resume against the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Evaluate the match carefully.
Return ONLY a JSON object:
{
  "matchScore": number (0-100),
  "matchedSkills": string[],
  "missingSkills": string[],
  "recommendation": string,
  "reasoning": string
  }
`;

  try {
    const generation = await generateStructuredContentWithFallback<JobMatchResult>(prompt);
    return normalizeMatchResult(
      jobMatchResultSchema.parse(generation.data),
    );
  } catch (error) {
    const normalizedError =
      error instanceof GeminiServiceError
        ? error
        : new GeminiServiceError("Job matching failed.", {
            status: 503,
            code: "job_match_failed",
            cause: error,
          });

    console.error("[AI Job Match] Falling back to local matcher", {
      code: normalizedError.code,
      message: normalizedError.message,
    });

    return createJobMatchFallback(
      resumeText,
      jobDescription,
      normalizedError.message,
    );
  }
}
