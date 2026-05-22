import { z } from "zod";

export const rewriteModeSchema = z.enum([
  "ATS_OPTIMIZED",
  "TECHNICAL",
  "PROFESSIONAL",
  "EXECUTIVE",
  "FRESHER",
  "CONCISE",
]);

export type RewriteMode = z.infer<typeof rewriteModeSchema>;

export const rewriteSectionSchema = z.enum([
  "SUMMARY",
  "EXPERIENCE",
  "PROJECTS",
  "SKILLS",
  "EDUCATION",
]);

export type RewriteSection = z.infer<typeof rewriteSectionSchema>;

export const rewriteRequestSchema = z.object({
  resumeId: z.string().min(1),
  section: rewriteSectionSchema,
  content: z.string().min(1),
  mode: rewriteModeSchema.default("PROFESSIONAL"),
  jobDescription: z.string().optional(),
  targetRole: z.string().optional(),
  additionalInstructions: z.string().optional(),
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const optimizedBulletPointSchema = z.object({
  original: z.string(),
  optimized: z.string(),
  impact: z.string(),
  keywordsAdded: z.array(z.string()),
  score: z.number().min(0).max(100),
});

export type OptimizedBulletPoint = z.infer<typeof optimizedBulletPointSchema>;

export const rewriteResponseSchema = z.object({
  optimizedContent: z.string(),
  summaryOfChanges: z.string(),
  impactMetrics: z.array(z.string()),
  optimizedBulletPoints: z.array(optimizedBulletPointSchema).optional(),
  atsKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;

export const sectionAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  missingElements: z.array(z.string()),
  rewriteSuggestions: z.array(z.string()),
  strength: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export type SectionAnalysis = z.infer<typeof sectionAnalysisSchema>;

export const fullResumeOptimizationSchema = z.object({
  summary: sectionAnalysisSchema,
  experience: sectionAnalysisSchema,
  projects: sectionAnalysisSchema,
  skills: sectionAnalysisSchema,
  education: sectionAnalysisSchema,
  overallScore: z.number().min(0).max(100),
  topActionItems: z.array(z.string()),
});

export type FullResumeOptimization = z.infer<typeof fullResumeOptimizationSchema>;
