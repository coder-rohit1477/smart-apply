import { z } from "zod";

export const atsMatchResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  semanticSimilarity: z.number().min(0).max(100),
  keywordMatch: z.object({
    percentage: z.number().min(0).max(100),
    matched: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  sectionQuality: z.object({
    summary: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    skills: z.number().min(0).max(100),
    projects: z.number().min(0).max(100),
  }),
  recruiterReadiness: z.object({
    score: z.number().min(0).max(100),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  }),
  recommendations: z.array(z.object({
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    title: z.string(),
    suggestion: z.string(),
    type: z.enum(["KEYWORD", "PHRASING", "CONTENT", "FORMATTING"]),
  })),
});

export type AtsMatchResult = z.infer<typeof atsMatchResultSchema>;

export const jdAnalysisSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  technologies: z.array(z.string()),
  experienceYears: z.number().nullable(),
  softSkills: z.array(z.string()),
  keyResponsibilities: z.array(z.string()),
});

export type JdAnalysis = z.infer<typeof jdAnalysisSchema>;

/**
 * Core engine to orchestrate the ATS matching logic.
 */
export class AtsEngine {
  /**
   * Calculates a weighted ATS score based on multiple factors.
   */
  static calculateWeightedScore(metrics: {
    semantic: number;
    keywords: number;
    readiness: number;
    quality: number;
  }): number {
    const weights = {
      semantic: 0.35,
      keywords: 0.35,
      readiness: 0.20,
      quality: 0.10,
    };

    return Math.round(
      metrics.semantic * weights.semantic +
      metrics.keywords * weights.keywords +
      metrics.readiness * weights.readiness +
      metrics.quality * weights.quality
    );
  }
}
