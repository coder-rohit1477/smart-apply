import { prisma } from "@/lib/prisma";
import {
  generateStructuredContentWithFallback,
} from "../gemini";
import {
  RESUME_REWRITE_PROMPT,
  SECTION_ANALYSIS_PROMPT,
} from "../prompts/resume-rewrite";
import {
  type RewriteRequest,
  type RewriteResponse,
  rewriteResponseSchema,
  type SectionAnalysis,
  sectionAnalysisSchema,
} from "@/types/rewrite";
import type { Prisma } from "@prisma/client";
import {
  calculateLocalSectionAnalysis,
  calculateLocalSectionRewrite
} from "./heuristic-service";

/**
 * Service for rewriting resume sections using AI.
 */
export async function rewriteResumeSection(
  request: RewriteRequest,
  userId: string,
): Promise<RewriteResponse> {
  const {
    resumeId,
    section,
    content,
    mode,
    jobDescription,
    targetRole,
    additionalInstructions,
  } = request;

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
  });

  if (!resume) {
    throw new Error("Resume not found or unauthorized");
  }

  const prompt = RESUME_REWRITE_PROMPT
    .replace("{mode}", mode)
    .replace("{section}", section)
    .replace("{content}", content)
    .replace("{targetRole}", targetRole ?? "Relevant Position")
    .replace("{jobDescription}", jobDescription ?? "Not provided")
    .replace("{additionalInstructions}", additionalInstructions ?? "None");

  try {
    const generation = await generateStructuredContentWithFallback<RewriteResponse>(prompt);
    // Check for generation success before parsing or using data
    if (!generation.success || !generation.data) {
      console.warn(`[Rewrite Service] Gemini failed to rewrite section. Falling back to local heuristic. Error: ${generation.error}`);
      return calculateLocalSectionRewrite(content, mode); // Fallback to local heuristic
    }
    return rewriteResponseSchema.parse(generation.data);
  } catch (error) {
    console.error("[Rewrite Service] Error rewriting section, falling back to local heuristic:", error);
    return calculateLocalSectionRewrite(content, mode); // Fallback to local heuristic
  }
}

/**
 * Service for analyzing a specific resume section.
 */
export async function analyzeResumeSection(
  section: string,
  content: string,
  targetRole?: string,
): Promise<SectionAnalysis> {
  const prompt = SECTION_ANALYSIS_PROMPT
    .replace("{section}", section)
    .replace("{content}", content)
    .replace("{targetRole}", targetRole ?? "Relevant Position");

  try {
    const generation = await generateStructuredContentWithFallback<SectionAnalysis>(prompt);
    // Check for generation success before parsing or using data
    if (!generation.success || !generation.data) {
      console.warn(`[Rewrite Service] Gemini failed to analyze section. Falling back to local heuristic. Error: ${generation.error}`);
      return calculateLocalSectionAnalysis(section, content, targetRole); // Fallback to local heuristic
    }
    return sectionAnalysisSchema.parse(generation.data);
  } catch (error) {
    console.error("[Rewrite Service] Error analyzing section, falling back to local heuristic:", error);
    return calculateLocalSectionAnalysis(section, content, targetRole); // Fallback to local heuristic
  }
}

/**
 * Creates a new version of a resume with optimized content.
 */
export async function saveOptimizedResumeVersion(
  originalResumeId: string,
  userId: string,
  name: string,
  optimizedData: Record<string, unknown>,
) {
  const original = await prisma.resume.findFirst({
    where: { id: originalResumeId, userId },
  });

  if (!original) {
    throw new Error("Original resume not found");
  }

  const nextVersion = (Number(original.version ?? 0) + 1).toString();

  return prisma.resume.create({
    data: {
      userId,
      parentId: originalResumeId,
      name,
      version: nextVersion,
      targetRole: original.targetRole,
      summary: typeof optimizedData.summary === "string"
        ? optimizedData.summary
        : original.summary,
      rawText: original.rawText,
      parsedData: optimizedData as Prisma.InputJsonObject,
      parsedSkills: original.parsedSkills,
      extractedSkills: original.extractedSkills,
      fileType: original.fileType,
      fileName: original.fileName ? `Optimized - ${original.fileName}` : null,
      fileSize: original.fileSize,
      fileUrl: original.fileUrl,
      atsScore: original.atsScore,
    },
  });
}
