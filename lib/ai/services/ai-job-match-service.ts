import { z } from "zod";

import {
  generateContentWithFallback,
  parseGeminiJson,
} from "../gemini";
import { calculateLocalJobMatch } from "./heuristic-service";

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
 * Modernized Job Matcher with Heuristic-First logic.
 */
export async function performAiJobMatch(
  resumeText: string,
  jobDescription: string,
  mode: string = "General"
): Promise<JobMatchResult> {
  // STEP 1: Always perform local heuristic match (FAST & FREE)
  const localMatch = calculateLocalJobMatch(resumeText, jobDescription, mode);

  // STEP 2: Selective Gemini enhancement
  console.log("[AI Job Match] Enhancing match via Gemini");

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

  const generation = await generateContentWithFallback(prompt);
  
  if (generation.error) {
    console.log("[AI Job Match] Gemini unavailable, using local match");
    return localMatch;
  }

  try {
    const parsedData = parseGeminiJson<JobMatchResult>(generation.text);
    const aiMatch = normalizeMatchResult(
      jobMatchResultSchema.parse(parsedData),
    );

    // MERGE: Prioritize local heuristics for scores and keyword detection
    return {
      ...aiMatch,
      matchScore: localMatch.matchScore,
      matchedSkills: localMatch.matchedSkills,
      missingSkills: localMatch.missingSkills
    };
  } catch (error) {
    console.warn("[AI Job Match] Error parsing AI response, using local match", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return localMatch;
  }
}
