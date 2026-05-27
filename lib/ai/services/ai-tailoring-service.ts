import { prisma } from "@/lib/prisma";
import { generateContentWithFallback, parseGeminiJson } from "../gemini";
import crypto from "crypto";
import { 
  TailoringResult, 
  tailoringResultSchema 
} from "@/types/tailoring";

const TAILORING_PROMPT = `
ACT AS A WORLD-CLASS EXECUTIVE RESUME WRITER AND ATS EXPERT.
YOUR TASK IS TO TAILOR THE PROVIDED RESUME CONTENT TO MATCH THE TARGET JOB DESCRIPTION.

---
STRATEGY:
1. TRUTHFULNESS: Do not hallucinate experiences. Only rephrase existing facts to align with JD.
2. ACTION VERBS: Use strong, varied action verbs (Orchestrated, Engineered, Scaled).
3. QUANTIFICATION: If metrics aren't present, suggest placeholders like "[X]%" where they belong.
4. KEYWORD INJECTION: Naturally weave in missing skills/tech from the JD.
5. TONE: Adapt to the JD's company culture (e.g., Startup/Agile vs. Enterprise/Formal).
6. SENIORITY: Ensure the phrasing matches the required seniority level.

---
INPUTS:
RESUME DATA:
{resumeData}

TARGET JOB DESCRIPTION:
{jobDescription}

FOCUS AREA:
{focusArea}

---
RESPONSE FORMAT (JSON ONLY):
{
  "summary": {
    "originalContent": "...",
    "tailoredContent": "...",
    "improvementHighlights": ["...", "..."],
    "recruiterNote": "..."
  },
  "experience": [
    {
      "company": "...",
      "role": "...",
      "bullets": [
        {
          "original": "...",
          "tailored": "...",
          "reasoning": "...",
          "impactImprovement": "...",
          "keywordsInjected": ["...", "..."]
        }
      ]
    }
  ],
  "projects": [
    {
      "name": "...",
      "description": {
        "originalContent": "...",
        "tailoredContent": "...",
        "improvementHighlights": ["..."],
        "recruiterNote": "..."
      }
    }
  ],
  "skills": {
    "suggestedOrdering": ["skill1", "skill2"],
    "newKeywordsAdded": ["keyword1"],
    "reasoning": "..."
  },
  "overallStrategy": "Explain the tailoring strategy used...",
  "seniorityAlignment": "High/Medium/Low assessment...",
  "toneProfile": "Startup/Enterprise/etc..."
}
`;

function sanitizeTailoringData(data: any): any {
  if (!data || typeof data !== 'object') return {};

  const sanitizeSection = (section: any) => ({
    originalContent: typeof section?.originalContent === 'string' ? section.originalContent : '',
    tailoredContent: typeof section?.tailoredContent === 'string' ? section.tailoredContent : '',
    improvementHighlights: Array.isArray(section?.improvementHighlights) ? section.improvementHighlights : [],
    recruiterNote: typeof section?.recruiterNote === 'string' ? section.recruiterNote : '',
  });

  return {
    ...data,
    summary: sanitizeSection(data.summary),
    experience: Array.isArray(data.experience) ? data.experience : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    skills: {
      suggestedOrdering: Array.isArray(data.skills?.suggestedOrdering) ? data.skills.suggestedOrdering : [],
      newKeywordsAdded: Array.isArray(data.skills?.newKeywordsAdded) ? data.skills.newKeywordsAdded : [],
      reasoning: typeof data.skills?.reasoning === 'string' ? data.skills.reasoning : '',
    },
    overallStrategy: typeof data.overallStrategy === 'string' ? data.overallStrategy : '',
    seniorityAlignment: typeof data.seniorityAlignment === 'string' ? data.seniorityAlignment : '',
    toneProfile: typeof data.toneProfile === 'string' ? data.toneProfile : '',
  };
}

// In-memory cache for tailoring results to save quota
const tailoringCache = new Map<string, { result: TailoringResult; timestamp: number }>();
const TAILORING_CACHE_TTL = 1000 * 60 * 60; // 1 hour
const tailoringCooldowns = new Map<string, number>();
const COOLDOWN_DURATION = 1000 * 15; // 15 seconds

export async function tailorResume(
  resumeId: string, 
  userId: string, 
  jobDescription: string,
  focusArea: string = "ATS"
): Promise<TailoringResult> {
  const cacheKey = `${resumeId}-${crypto.createHash("md5").update(jobDescription).digest("hex")}-${focusArea}`;
  
  // 1. Check Cache
  const cached = tailoringCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TAILORING_CACHE_TTL) {
    console.log("[Tailoring Service] Returning cached tailoring result");
    return cached.result;
  }

  // 2. Check Cooldown
  const lastCall = tailoringCooldowns.get(cacheKey) || 0;
  if (Date.now() - lastCall < COOLDOWN_DURATION) {
    console.warn("[Tailoring Service] Tailoring cooldown active, skipping expensive AI call");
    throw new Error("Please wait a few seconds before tailoring again.");
  }
  tailoringCooldowns.set(cacheKey, Date.now());

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId }
  });

  if (!resume || !resume.parsedData) {
    throw new Error("Resume not found or has no parsed data");
  }

  const prompt = TAILORING_PROMPT
    .replace("{resumeData}", JSON.stringify(resume.parsedData, null, 2))
    .replace("{jobDescription}", jobDescription)
    .replace("{focusArea}", focusArea);

  const generation = await generateContentWithFallback(prompt);
  
  if (generation.error) {
    console.error("[Tailoring Service] AI service unavailable, returning safe fallback", { error: generation.error });
    // Return a structured safe fallback that passes validation
    return {
      summary: {
        originalContent: "",
        tailoredContent: "AI quota temporarily reached. Using local optimization insights.",
        improvementHighlights: [],
        recruiterNote: "Service unavailable."
      },
      experience: [],
      projects: [],
      skills: {
        suggestedOrdering: [],
        newKeywordsAdded: [],
        reasoning: "Service unavailable."
      },
      overallStrategy: "Service unavailable.",
      seniorityAlignment: "N/A",
      toneProfile: "N/A"
    };
  }

  try {
    const parsedData = parseGeminiJson<TailoringResult>(generation.text);
    const sanitizedData = sanitizeTailoringData(parsedData);
    const validatedResult = tailoringResultSchema.parse(sanitizedData);
    
    // Update cache
    tailoringCache.set(cacheKey, { result: validatedResult, timestamp: Date.now() });
    
    return validatedResult;
  } catch (error) {
    console.error("[Tailoring Service] Error parsing tailoring response:", error);
    // Return the same safe fallback
    return {
      summary: {
        originalContent: "",
        tailoredContent: "Error processing tailoring response. Please try again later.",
        improvementHighlights: [],
        recruiterNote: "Error processing response."
      },
      experience: [],
      projects: [],
      skills: {
        suggestedOrdering: [],
        newKeywordsAdded: [],
        reasoning: "Error processing response."
      },
      overallStrategy: "Error processing response.",
      seniorityAlignment: "N/A",
      toneProfile: "N/A"
    };
  }
}

/**
 * Utility to generate a side-by-side diff for UI presentation.
 * We can expand this if needed, but for now we provide the full structured tailoring.
 */
export function calculateSimpleDiff(original: string, tailored: string) {
  // Simple word-level diffing could be implemented here or on frontend
  return { original, tailored };
}
