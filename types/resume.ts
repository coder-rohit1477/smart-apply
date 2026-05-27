import { z } from "zod";

export const resumeErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "INVALID_FILE",
  "INVALID_FILE_TYPE",
  "FILE_TOO_LARGE",
  "EMPTY_FILE",
  "PARSE_FAILED",
  "CORRUPTED_FILE",
  "STORAGE_FAILED",
  "DATABASE_FAILED",
  "NOT_FOUND",
  "FORBIDDEN",
  "UNKNOWN_ERROR",
]);

export type ResumeErrorCode = z.infer<typeof resumeErrorCodeSchema>;

export const supportedResumeMimeTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type SupportedResumeMimeType = z.infer<
  typeof supportedResumeMimeTypeSchema
>;

export const resumeSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  source: z.enum(["skills-section", "keyword-match", "section-inference"]),
  confidence: z.enum(["high", "medium"]),
});

export type ResumeSkill = z.infer<typeof resumeSkillSchema>;

export const parsedResumeSchema = z.object({
  fullName: z.string().min(1).nullable(),
  email: z.string().email().nullable(),
  phoneNumber: z.string().min(1).nullable(),
  headline: z.string().min(1).nullable(),
  summary: z.string().min(1).nullable(),
  estimatedYearsOfExperience: z.number().int().nonnegative().nullable(),
  skills: z.array(resumeSkillSchema),
  projects: z.array(z.string().min(1)),
  education: z.array(z.string().min(1)),
  experience: z.array(z.string().min(1)),
  certifications: z.array(z.string().min(1)),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

export const resumeMetadataSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  fileUrl: z.string().min(1).nullable(),
});

export type ResumeMetadata = z.infer<typeof resumeMetadataSchema>;

export const parserResultSchema = z.object({
  metadata: resumeMetadataSchema,
  rawText: z.string().min(1),
  parsedResume: parsedResumeSchema,
  warnings: z.array(z.string().min(1)),
});

export type ParserResult = z.infer<typeof parserResultSchema>;

export const storedResumeSchema = z.object({
  id: z.string().min(1),
  metadata: resumeMetadataSchema.extend({
    fileUrl: z.string().min(1).nullable(),
  }),
  rawText: z.string().min(1),
  parsedData: parsedResumeSchema,
  extractedSkills: z.array(z.string().min(1)),
  targetRole: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type StoredResume = z.infer<typeof storedResumeSchema>;

export interface ResumeApiError {
  code: ResumeErrorCode;
  message: string;
  details?: string[];
}

export const resumeApiErrorSchema = z.object({
  code: resumeErrorCodeSchema,
  message: z.string().min(1),
  details: z.array(z.string().min(1)).optional(),
});

export interface UploadResponseSuccess {
  success: true;
  resume: StoredResume;
}

export interface UploadResponseError {
  success: false;
  error: ResumeApiError;
}

export type UploadResponse = UploadResponseSuccess | UploadResponseError;

export const uploadResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    resume: storedResumeSchema,
  }),
  z.object({
    success: z.literal(false),
    error: resumeApiErrorSchema,
  }),
]);

export interface ParseResponseSuccess {
  success: true;
  result: ParserResult;
}

export interface ParseResponseError {
  success: false;
  error: ResumeApiError;
}

export type ParseResponse = ParseResponseSuccess | ParseResponseError;

export const parseResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    result: parserResultSchema,
  }),
  z.object({
    success: z.literal(false),
    error: resumeApiErrorSchema,
  }),
]);

export interface DeleteResponseSuccess {
  success: true;
  deletedResumeId: string;
}

export interface DeleteResponseError {
  success: false;
  error: ResumeApiError;
}

export type DeleteResponse = DeleteResponseSuccess | DeleteResponseError;

export const deleteResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    deletedResumeId: z.string().min(1),
  }),
  z.object({
    success: z.literal(false),
    error: resumeApiErrorSchema,
  }),
]);

// Re-exported from ai-resume-service to avoid duplication
export type { FullResumeAnalysis } from "@/lib/ai/services/ai-resume-service";

export interface AnalysisResponseSuccess {
  success: true;
  analysis: {
    analysisData: import("@/lib/ai/services/ai-resume-service").FullResumeAnalysis;
    [key: string]: unknown;
  };
}

export interface AnalysisResponseError {
  success: false;
  error: string;
}

export type AnalysisResponse = AnalysisResponseSuccess | AnalysisResponseError;
