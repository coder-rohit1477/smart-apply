import { prisma } from "@/lib/prisma";
import { generateStructuredContentWithFallback } from "../gemini";
import { z } from "zod";
import { calculateLocalKeywordComparison, calculateLocalKeywordExtraction } from "./heuristic-service";

const keywordExtractionSchema = z.object({
  criticalKeywords: z.array(z.string()),
  softSkills: z.array(z.string()),
  toolsAndTechnologies: z.array(z.string()),
  industryTerms: z.array(z.string()),
});

export type KeywordExtraction = z.infer<typeof keywordExtractionSchema>;

const keywordComparisonSchema = z.object({
  foundKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  optimizationTips: z.array(z.string()),
  keywordDensityScore: z.number(),
});

export type KeywordComparison = z.infer<typeof keywordComparisonSchema>;

const KEYWORD_EXTRACTION_PROMPT = `
ACT AS AN ATS OPTIMIZER. EXTRACT THE MOST IMPORTANT KEYWORDS FROM THE FOLLOWING JOB DESCRIPTION.
GROUP THEM INTO CRITICAL KEYWORDS, SOFT SKILLS, TOOLS & TECHNOLOGIES, AND INDUSTRY TERMS.

JOB DESCRIPTION:
{jobDescription}

---
RESPONSE FORMAT (JSON ONLY):
{
  "criticalKeywords": [],
  "softSkills": [],
  "toolsAndTechnologies": [],
  "industryTerms": []
}
`;

export async function extractKeywordsFromJD(jobDescription: string): Promise<KeywordExtraction> {
  const localKeywords = calculateLocalKeywordExtraction(jobDescription);
  
  const prompt = KEYWORD_EXTRACTION_PROMPT.replace("{jobDescription}", jobDescription);
  const generation = await generateStructuredContentWithFallback<KeywordExtraction>(prompt);
  
  if (generation.error || !generation.data) {
    console.warn("[Keyword Optimizer] Gemini extraction failed, using local heuristics");
    return localKeywords;
  }

  try {
    return keywordExtractionSchema.parse(generation.data);
  } catch (error) {
    console.error("[Keyword Optimizer] Schema validation error:", error);
    return localKeywords;
  }
}

export async function compareKeywords(
  resumeContent: string, 
  jobKeywords: KeywordExtraction
): Promise<KeywordComparison> {
  // FAST PATH: Comparison is 100% heuristic-based now to save quota
  // This is highly accurate for keyword detection and doesn't need LLM.
  return calculateLocalKeywordComparison(resumeContent, jobKeywords);
}

export async function getKeywordOptimization(resumeId: string, userId: string, jobDescription: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId }
  });

  if (!resume || !resume.rawText) {
    throw new Error("Resume not found");
  }

  const extracted = await extractKeywordsFromJD(jobDescription);
  const comparison = await compareKeywords(resume.rawText, extracted);

  return {
    extracted,
    comparison
  };
}

