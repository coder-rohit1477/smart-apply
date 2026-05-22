import { z } from "zod";
import { JobFreshnessBucket, JobType } from "@prisma/client";

export const indiaJobLocationSchema = z.enum([
  "ALL",
  "INDIA_REMOTE",
  "BANGALORE",
  "PUNE",
  "HYDERABAD",
  "GURGAON",
]);

export type IndiaJobLocation = z.infer<typeof indiaJobLocationSchema>;

export const jobFeedFiltersSchema = z.object({
  internshipsOnly: z.boolean().default(false),
  fresherOnly: z.boolean().default(false),
  location: indiaJobLocationSchema.default("ALL"),
});

export type JobFeedFilters = z.infer<typeof jobFeedFiltersSchema>;

export const jobScoreBreakdownSchema = z.object({
  atsMatch: z.number().min(0).max(100),
  semanticMatch: z.number().min(0).max(100),
  locationRelevance: z.number().min(0).max(100),
  fresherFit: z.number().min(0).max(100),
  freshness: z.number().min(0).max(100),
});

export type JobScoreBreakdown = z.infer<typeof jobScoreBreakdownSchema>;

export const unifiedJobSchema = z.object({
  externalId: z.string(),
  source: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  type: z.nativeEnum(JobType),
  description: z.string(),
  salaryRange: z.string().optional().nullable(),
  applyUrl: z.string().url().optional().nullable(),
  duration: z.string().optional().nullable(),
  experienceLevel: z.string().optional().nullable(),
  isInternship: z.boolean().default(false),
  isFresherFriendly: z.boolean().default(false),
  freshnessBucket: z.nativeEnum(JobFreshnessBucket).default(JobFreshnessBucket.UNKNOWN),
  keywords: z.array(z.string()).default([]),
  postedAt: z.date().optional().nullable(),
});

export type UnifiedJob = z.infer<typeof unifiedJobSchema>;

export interface JobProvider {
  name: string;
  fetchJobs(query: string, options?: { signal?: AbortSignal | undefined }): Promise<UnifiedJob[]>;
}

export const jobRecommendationCategorySchema = z.enum([
  "BEST_MATCH",
  "HIGH_ATS_POTENTIAL",
  "STRETCH",
  "SAFE",
]);

export type JobRecommendationCategory = z.infer<typeof jobRecommendationCategorySchema>;

export interface JobRecommendation {
  job: UnifiedJob & { id?: string };
  category: JobRecommendationCategory;
  score: number;
  reasoning: string;
  scoreBreakdown: JobScoreBreakdown;
  matchDetails?: any;
}
