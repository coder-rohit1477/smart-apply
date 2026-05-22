import { prisma } from "@/lib/prisma";
import { generateStructuredContentWithFallback } from "../gemini";
import { z } from "zod";

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

const KEYWORD_COMPARISON_PROMPT = `
ACT AS AN ATS OPTIMIZER. COMPARE THE EXTRACTED JOB KEYWORDS AGAINST THE RESUME CONTENT.
IDENTIFY WHICH ARE PRESENT AND WHICH ARE MISSING. PROVIDE TIPS ON WHERE TO NATURALLY ADD MISSING KEYWORDS.

EXTRACTED JOB KEYWORDS:
{jobKeywords}

RESUME CONTENT:
{resumeContent}

---
RESPONSE FORMAT (JSON ONLY):
{
  "foundKeywords": [],
  "missingKeywords": [],
  "optimizationTips": [],
  "keywordDensityScore": 0-100
}
`;

export async function extractKeywordsFromJD(jobDescription: string): Promise<KeywordExtraction> {
  const prompt = KEYWORD_EXTRACTION_PROMPT.replace("{jobDescription}", jobDescription);
  const generation = await generateStructuredContentWithFallback<KeywordExtraction>(prompt);
  return keywordExtractionSchema.parse(generation.data);
}

export async function compareKeywords(
  resumeContent: string, 
  jobKeywords: KeywordExtraction
): Promise<KeywordComparison> {
  const prompt = KEYWORD_COMPARISON_PROMPT
    .replace("{jobKeywords}", JSON.stringify(jobKeywords))
    .replace("{resumeContent}", resumeContent);
  
  const generation = await generateStructuredContentWithFallback<KeywordComparison>(prompt);
  return keywordComparisonSchema.parse(generation.data);
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
