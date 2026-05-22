import { prisma } from "@/lib/prisma";
import { generateStructuredContentWithFallback } from "../gemini";
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

export async function tailorResume(
  resumeId: string, 
  userId: string, 
  jobDescription: string,
  focusArea: string = "ATS"
): Promise<TailoringResult> {
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

  try {
    const generation = await generateStructuredContentWithFallback<TailoringResult>(prompt);
    return tailoringResultSchema.parse(generation.data);
  } catch (error) {
    console.error("[Tailoring Service] Error tailoring resume:", error);
    throw error;
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
