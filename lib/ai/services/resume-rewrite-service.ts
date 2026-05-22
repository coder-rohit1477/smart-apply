import { prisma } from "@/lib/prisma";
import { 
  generateStructuredContentWithFallback,
} from "../gemini";
import { 
  RESUME_REWRITE_PROMPT, 
  SECTION_ANALYSIS_PROMPT 
} from "../prompts/resume-rewrite";
import { 
  RewriteRequest, 
  RewriteResponse, 
  rewriteResponseSchema,
  SectionAnalysis,
  sectionAnalysisSchema
} from "@/types/rewrite";

/**
 * Service for rewriting resume sections using AI.
 */
export async function rewriteResumeSection(request: RewriteRequest, userId: string): Promise<RewriteResponse> {
  const { 
    resumeId, 
    section, 
    content, 
    mode, 
    jobDescription, 
    targetRole, 
    additionalInstructions 
  } = request;

  // Verify ownership
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId }
  });

  if (!resume) {
    throw new Error("Resume not found or unauthorized");
  }

  const prompt = RESUME_REWRITE_PROMPT
    .replace("{mode}", mode)
    .replace("{section}", section)
    .replace("{content}", content)
    .replace("{targetRole}", targetRole || "Relevant Position")
    .replace("{jobDescription}", jobDescription || "Not provided")
    .replace("{additionalInstructions}", additionalInstructions || "None");

  try {
    const generation = await generateStructuredContentWithFallback<RewriteResponse>(prompt);
    return rewriteResponseSchema.parse(generation.data);
  } catch (error) {
    console.error("[Rewrite Service] Error rewriting section:", error);
    throw error;
  }
}

/**
 * Service for analyzing a specific resume section.
 */
export async function analyzeResumeSection(
  section: string, 
  content: string, 
  targetRole?: string
): Promise<SectionAnalysis> {
  const prompt = SECTION_ANALYSIS_PROMPT
    .replace("{section}", section)
    .replace("{content}", content)
    .replace("{targetRole}", targetRole || "Relevant Position");

  try {
    const generation = await generateStructuredContentWithFallback<SectionAnalysis>(prompt);
    return sectionAnalysisSchema.parse(generation.data);
  } catch (error) {
    console.error("[Rewrite Service] Error analyzing section:", error);
    throw error;
  }
}

/**
 * Creates a new version of a resume with optimized content.
 */
export async function saveOptimizedResumeVersion(
  originalResumeId: string,
  userId: string,
  name: string,
  optimizedData: any // This would be the full parsed data with some fields updated
) {
  const original = await prisma.resume.findFirst({
    where: { id: originalResumeId, userId }
  });

  if (!original) {
    throw new Error("Original resume not found");
  }

  return prisma.resume.create({
    data: {
      userId,
      parentId: originalResumeId,
      name,
      version: (Number(original.version || 0) + 1).toString(),
      targetRole: original.targetRole,
      summary: optimizedData.summary || original.summary,
      rawText: original.rawText,
      parsedData: optimizedData,
      parsedSkills: original.parsedSkills,
      extractedSkills: original.extractedSkills,
      fileType: original.fileType,
      fileName: original.fileName ? `Optimized - ${original.fileName}` : null,
      fileSize: original.fileSize,
      fileUrl: original.fileUrl,
      atsScore: original.atsScore,
    }
  });
}
