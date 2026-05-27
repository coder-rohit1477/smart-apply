import {
  generateStructuredContentWithFallback,
} from "../gemini";
import {
  atsMatchResultSchema,
  type AtsMatchResult,
  jdAnalysisSchema,
  type JdAnalysis,
} from "@/lib/matching/ats-engine";
import { createAtsMatchFallback } from "./ai-fallbacks";

const JD_ANALYSIS_PROMPT = `
ACT AS AN EXPERT RECRUITER. ANALYZE THE FOLLOWING JOB DESCRIPTION AND EXTRACT KEY REQUIREMENTS.

JOB DESCRIPTION:
{jobDescription}

---
RESPONSE FORMAT (JSON ONLY):
{
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "technologies": ["tech1", "tech2"],
  "experienceYears": number or null,
  "softSkills": ["skill1", "skill2"],
  "keyResponsibilities": ["task1", "task2"]
}
`;

const ATS_MATCH_PROMPT = `
ACT AS A SOPHISTICATED ATS (APPLICANT TRACKING SYSTEM) MATCHING ENGINE.
COMPARE THE RESUME AGAINST THE JOB DESCRIPTION ANALYSIS.

RESUME CONTENT:
{resumeText}

JOB ANALYSIS:
{jdAnalysis}

---
CRITICAL INSTRUCTIONS:
1. Semantic Similarity: How well does the overall profile match the intent of the job? (0-100)
2. Keyword Match: Check for exact and variant matches of skills/tech. (0-100)
3. Section Quality: Evaluate the clarity and impact of Summary, Experience, Skills, and Projects. (0-100 each)
4. Recruiter Readiness: How "hireable" does the candidate look for this specific role? (0-100)
5. Provide prioritized recommendations for improvement.

---
RESPONSE FORMAT (JSON ONLY):
{
  "overallScore": number,
  "semanticSimilarity": number,
  "keywordMatch": {
    "percentage": number,
    "matched": string[],
    "missing": string[]
  },
  "sectionQuality": {
    "summary": number,
    "experience": number,
    "skills": number,
    "projects": number
  },
  "recruiterReadiness": {
    "score": number,
    "pros": string[],
    "cons": string[]
  },
  "recommendations": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "title": "string",
      "suggestion": "string",
      "type": "KEYWORD" | "PHRASING" | "CONTENT" | "FORMATTING"
    }
  ]
}
`;

/**
 * Normalize a raw Gemini ATS response before Zod parsing.
 * Handles:
 *  - Array responses (Gemini sometimes wraps the object in an array)
 *  - Missing sectionQuality / recruiterReadiness / recommendations fields
 *  - Partial or null sub-objects
 * Returns null if the value is so malformed that fallback should be used.
 */
function normalizeAtsResponse(raw: unknown): Record<string, unknown> | null {
  // If Gemini returned an array, try to use the first element
  let data: unknown = raw;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    data = data[0];
  }

  // Must be a plain object at this point
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // overallScore is the minimum required field — if missing, fallback
  if (typeof obj.overallScore !== "number") return null;

  const overallScore = obj.overallScore as number;

  // Fill missing sectionQuality with safe defaults derived from overallScore
  if (!obj.sectionQuality || typeof obj.sectionQuality !== "object") {
    obj.sectionQuality = {
      summary: overallScore,
      experience: overallScore,
      skills: overallScore,
      projects: overallScore,
    };
  } else {
    const sq = obj.sectionQuality as Record<string, unknown>;
    if (typeof sq.summary !== "number")    sq.summary    = overallScore;
    if (typeof sq.experience !== "number") sq.experience = overallScore;
    if (typeof sq.skills !== "number")     sq.skills     = overallScore;
    if (typeof sq.projects !== "number")   sq.projects   = overallScore;
  }

  // Fill missing recruiterReadiness
  if (!obj.recruiterReadiness || typeof obj.recruiterReadiness !== "object") {
    obj.recruiterReadiness = {
      score: overallScore,
      pros: [],
      cons: [],
    };
  } else {
    const rr = obj.recruiterReadiness as Record<string, unknown>;
    if (typeof rr.score !== "number")   rr.score = overallScore;
    if (!Array.isArray(rr.pros))        rr.pros  = [];
    if (!Array.isArray(rr.cons))        rr.cons  = [];
  }

  // Fill missing recommendations
  if (!Array.isArray(obj.recommendations)) {
    obj.recommendations = [];
  }

  // Fill missing keywordMatch
  if (!obj.keywordMatch || typeof obj.keywordMatch !== "object") {
    obj.keywordMatch = { percentage: 0, matched: [], missing: [] };
  } else {
    const km = obj.keywordMatch as Record<string, unknown>;
    if (typeof km.percentage !== "number") km.percentage = 0;
    if (!Array.isArray(km.matched))        km.matched    = [];
    if (!Array.isArray(km.missing))        km.missing    = [];
  }

  // Fill missing semanticSimilarity
  if (typeof obj.semanticSimilarity !== "number") {
    obj.semanticSimilarity = overallScore;
  }

  return obj;
}

export async function analyzeJobDescription(jd: string): Promise<JdAnalysis> {
  const prompt = JD_ANALYSIS_PROMPT.replace("{jobDescription}", jd);
  const generation = await generateStructuredContentWithFallback<JdAnalysis>(prompt);
  return jdAnalysisSchema.parse(generation.data);
}

export async function performAtsMatch(resumeText: string, jd: string): Promise<AtsMatchResult> {
  try {
    const jdAnalysis = await analyzeJobDescription(jd);
    const prompt = ATS_MATCH_PROMPT
      .replace("{resumeText}", resumeText)
      .replace("{jdAnalysis}", JSON.stringify(jdAnalysis, null, 2));

    const generation = await generateStructuredContentWithFallback<AtsMatchResult>(prompt);

    // Normalize before parsing — handles arrays, missing fields, partial objects
    const normalized = normalizeAtsResponse(generation.data);

    if (!normalized) {
      console.warn("[ATS Service] Gemini response was not a usable object; using local fallback", {
        receivedType: Array.isArray(generation.data) ? "array" : typeof generation.data,
      });
      return createAtsMatchFallback(resumeText, jd, "Gemini returned unusable ATS response shape.");
    }

    // Parse with Zod — normalized object should now satisfy the schema
    try {
      return atsMatchResultSchema.parse(normalized);
    } catch (zodError) {
      const reason = zodError instanceof Error ? zodError.message : String(zodError);
      console.warn("[ATS Service] Zod validation failed after normalization; using local fallback", {
        reason,
      });
      return createAtsMatchFallback(resumeText, jd, reason);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown ATS matching failure.";
    console.error("[ATS Service] Falling back to local ATS matcher", { reason });
    return createAtsMatchFallback(resumeText, jd, reason);
  }
}
