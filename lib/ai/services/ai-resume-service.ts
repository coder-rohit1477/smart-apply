import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  GeminiServiceError,
  generateStructuredContentWithFallback,
  getPrimaryGeminiModel,
} from "../gemini";
import { FULL_RESUME_ANALYSIS_PROMPT } from "../prompts/full-analysis";
import { createResumeAnalysisFallback } from "./ai-fallbacks";

export interface FullResumeAnalysis {
  atsScore: number;
  formattingScore: number;
  impactScore: number;
  readinessScore: number;
  sectionScores: {
    summary: number;
    experience: number;
    projects: number;
    skills: number;
    education: number;
  };
  prioritizedActions: {
    impact: "HIGH" | "MEDIUM";
    type: "FORMATTING" | "CONTENT" | "KEYWORDS";
    action: string;
    reason: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  executiveSummary: string;
  topThreeChanges: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  technicalGaps: string[];
  softSkillGaps: string[];
  upskillingPlan: string[];
}

const fullResumeAnalysisSchema = z.object({
  atsScore: z.number().finite(),
  formattingScore: z.number().finite(),
  impactScore: z.number().finite(),
  readinessScore: z.number().finite(),
  sectionScores: z.object({
    summary: z.number().default(0),
    experience: z.number().default(0),
    projects: z.number().default(0),
    skills: z.number().default(0),
    education: z.number().default(0),
  }).default({
    summary: 0,
    experience: 0,
    projects: 0,
    skills: 0,
    education: 0,
  }),
  prioritizedActions: z.array(z.object({
    impact: z.enum(["HIGH", "MEDIUM"]),
    type: z.enum(["FORMATTING", "CONTENT", "KEYWORDS"]),
    action: z.string(),
    reason: z.string(),
  })).default([]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  executiveSummary: z.string(),
  topThreeChanges: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  matchedKeywords: z.array(z.string()),
  technicalGaps: z.array(z.string()),
  softSkillGaps: z.array(z.string()),
  upskillingPlan: z.array(z.string()),
});

function normalizeAnalysis(analysis: FullResumeAnalysis): FullResumeAnalysis {
  return {
    atsScore: Math.round(analysis.atsScore || 0),
    formattingScore: Math.round(analysis.formattingScore || 0),
    impactScore: Math.round(analysis.impactScore || 0),
    readinessScore: Math.round(analysis.readinessScore || 0),
    sectionScores: {
      summary: Math.round(analysis.sectionScores?.summary || 0),
      experience: Math.round(analysis.sectionScores?.experience || 0),
      projects: Math.round(analysis.sectionScores?.projects || 0),
      skills: Math.round(analysis.sectionScores?.skills || 0),
      education: Math.round(analysis.sectionScores?.education || 0),
    },
    prioritizedActions: analysis.prioritizedActions ?? [],
    strengths: analysis.strengths ?? [],
    weaknesses: analysis.weaknesses ?? [],
    recommendations: analysis.recommendations ?? [],
    executiveSummary: analysis.executiveSummary?.trim() ?? "",
    topThreeChanges: analysis.topThreeChanges ?? [],
    missingKeywords: analysis.missingKeywords ?? [],
    matchedKeywords: analysis.matchedKeywords ?? [],
    technicalGaps: analysis.technicalGaps ?? [],
    softSkillGaps: analysis.softSkillGaps ?? [],
    upskillingPlan: analysis.upskillingPlan ?? [],
  };
}

/**
 * Performs a comprehensive AI analysis of a resume in a single pass.
 */
export async function performFullResumeAnalysis(
  resumeId: string,
  userId: string,
  jobDescription?: string,
) {
  console.log(`[AI Resume Service] Starting analysis for resume ${resumeId}`);

  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      userId,
    },
  });

  if (!resume || !resume.rawText) {
    throw new Error("Resume not found or has no text content");
  }

  const jobDescriptionInstruction = jobDescription
    ? `JOB DESCRIPTION:\n${jobDescription}\n\nCompare the resume against this job description specifically.`
    : "No specific job description provided. Analyze against general industry standards for the detected role.";

  const prompt = FULL_RESUME_ANALYSIS_PROMPT
    .replace("{resumeText}", resume.rawText)
    .replace("{jobDescriptionInstruction}", jobDescriptionInstruction);

  const generation = await generateStructuredContentWithFallback<FullResumeAnalysis>(prompt);
  
  let modelName: string = generation.model;
  let degraded: boolean = generation.usedFallbackModel;
  let fallbackReason: string | undefined;
  let analysisData: FullResumeAnalysis; // This will be assigned conditionally

  if (!generation.data) {
    fallbackReason = "All Gemini models unavailable or returned malformed data.";
    analysisData = createResumeAnalysisFallback(
      resume.rawText,
      jobDescription,
      fallbackReason,
    );

    console.error("[AI Resume Service] Falling back to local analysis", {
      resumeId,
      code: "gemini_unavailable",
      message: fallbackReason,
    });
  } else {
    try {
      // Normalize Gemini field name variants before Zod parsing.
      // Gemini sometimes returns `areasForImprovement` instead of `weaknesses`.
      const raw = generation.data as Record<string, unknown>;
      if (raw.areasForImprovement !== undefined && raw.weaknesses === undefined) {
        raw.weaknesses = raw.areasForImprovement;
      }

      const parsedAnalysis = fullResumeAnalysisSchema.parse(raw);
      analysisData = normalizeAnalysis(parsedAnalysis);
    } catch (parseError) {
      fallbackReason = `Failed to parse Gemini analysis: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
      analysisData = createResumeAnalysisFallback(
        resume.rawText,
        jobDescription,
        fallbackReason,
      );

      console.error("[AI Resume Service] Falling back to local analysis due to parse error", {
        resumeId,
        code: "analysis_parse_failed",
        message: fallbackReason,
        originalData: generation.data,
      });
    }
  }

  // Build the JSON payload explicitly so Prisma receives a well-typed InputJsonObject
  const analysisDataJson: Prisma.InputJsonObject = {
    atsScore: analysisData.atsScore,
    formattingScore: analysisData.formattingScore,
    impactScore: analysisData.impactScore,
    readinessScore: analysisData.readinessScore,
    sectionScores: analysisData.sectionScores as unknown as Prisma.InputJsonObject,
    prioritizedActions: analysisData.prioritizedActions as unknown as Prisma.InputJsonValue[],
    strengths: analysisData.strengths,
    weaknesses: analysisData.weaknesses,
    recommendations: analysisData.recommendations,
    executiveSummary: analysisData.executiveSummary,
    topThreeChanges: analysisData.topThreeChanges,
    missingKeywords: analysisData.missingKeywords,
    matchedKeywords: analysisData.matchedKeywords,
    technicalGaps: analysisData.technicalGaps,
    softSkillGaps: analysisData.softSkillGaps,
    upskillingPlan: analysisData.upskillingPlan,
    metadata: {
      degraded,
      fallbackReason,
      generatedBy: degraded ? "local-fallback" : "gemini",
      model: modelName,
    },
  };

  const savedAnalysis = await prisma.resumeAnalysis.create({
    data: {
      resumeId,
      userId,
      provider: "google-gemini",
      model: modelName,
      promptVersion: "2025-02-gemini-2-5",
      executiveSummary: analysisData.executiveSummary,
      atsScore: analysisData.atsScore,
      jobReadinessScore: analysisData.readinessScore,
      strengths: analysisData.strengths,
      weaknesses: analysisData.weaknesses,
      missingSkills: analysisData.technicalGaps,
      recommendations: Array.from(
        new Set([
          ...analysisData.recommendations,
          ...analysisData.topThreeChanges,
        ]),
      ),
      analysisData: analysisDataJson,
    },
  });

  await prisma.resume.update({
    where: { id: resumeId },
    data: {
      atsScore: analysisData.atsScore,
    },
  });

  console.log("[AI Resume Service] Analysis complete", {
    resumeId,
    model: modelName,
    degraded,
  });

  return savedAnalysis;
}

export async function getLatestAnalysis(resumeId: string) {
  return prisma.resumeAnalysis.findFirst({
    where: { resumeId },
    orderBy: { createdAt: "desc" },
  });
}
