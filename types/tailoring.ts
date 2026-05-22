import { z } from "zod";

export const tailoredBulletPointSchema = z.object({
  original: z.string(),
  tailored: z.string(),
  reasoning: z.string(),
  impactImprovement: z.string(),
  keywordsInjected: z.array(z.string()),
});

export type TailoredBulletPoint = z.infer<typeof tailoredBulletPointSchema>;

export const tailoredSectionSchema = z.object({
  originalContent: z.string(),
  tailoredContent: z.string(),
  improvementHighlights: z.array(z.string()),
  recruiterNote: z.string(),
});

export type TailoredSection = z.infer<typeof tailoredSectionSchema>;

export const tailoringResultSchema = z.object({
  summary: tailoredSectionSchema,
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    bullets: z.array(tailoredBulletPointSchema),
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: tailoredSectionSchema,
    bullets: z.array(tailoredBulletPointSchema).optional(),
  })),
  skills: z.object({
    suggestedOrdering: z.array(z.string()),
    newKeywordsAdded: z.array(z.string()),
    reasoning: z.string(),
  }),
  overallStrategy: z.string(),
  seniorityAlignment: z.string(),
  toneProfile: z.string(),
});

export type TailoringResult = z.infer<typeof tailoringResultSchema>;

export const tailoringRequestSchema = z.object({
  resumeId: z.string(),
  jobDescription: z.string(),
  focusArea: z.enum(["TECHNICAL", "LEADERSHIP", "ATS", "GENERAL"]).default("ATS"),
});

export type TailoringRequest = z.infer<typeof tailoringRequestSchema>;
