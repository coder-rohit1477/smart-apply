"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  rewriteResumeSection,
  analyzeResumeSection,
  saveOptimizedResumeVersion,
} from "@/lib/ai/services/resume-rewrite-service";
import { tailorResume } from "@/lib/ai/services/ai-tailoring-service";
import { getKeywordOptimization } from "@/lib/ai/services/keyword-optimizer-service";
import { performAtsMatch } from "@/lib/ai/services/ats-service";
import type { RewriteRequest } from "@/types/rewrite";
import { prisma } from "@/lib/prisma";
import { ensureUserProfile } from "@/lib/user-profiles";

async function getAuthenticatedUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  const user = await currentUser();

  return ensureUserProfile({
    clerkUserId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    firstName: user?.firstName ?? user?.username ?? null,
  });
}

export async function rewriteSectionAction(request: RewriteRequest) {
  const user = await getAuthenticatedUser();
  return rewriteResumeSection(request, user.id);
}

export async function analyzeSectionAction(
  section: string,
  content: string,
  targetRole?: string,
) {
  await getAuthenticatedUser();
  return analyzeResumeSection(section, content, targetRole);
}

export async function getKeywordOptimizationAction(
  resumeId: string,
  jobDescription: string,
) {
  const user = await getAuthenticatedUser();
  return getKeywordOptimization(resumeId, user.id, jobDescription);
}

export async function performAtsMatchAction(
  resumeId: string,
  jobDescription: string,
) {
  const user = await getAuthenticatedUser();

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!resume || !resume.rawText) {
    throw new Error("Resume not found or has no content");
  }

  return performAtsMatch(resume.rawText, jobDescription);
}

export async function tailorResumeAction(
  resumeId: string,
  jobDescription: string,
  focusArea: "ATS" | "TECHNICAL" | "LEADERSHIP" | "GENERAL",
) {
  const user = await getAuthenticatedUser();
  return tailorResume(resumeId, user.id, jobDescription, focusArea);
}

export async function saveOptimizedVersionAction(
  resumeId: string,
  name: string,
  optimizedData: Record<string, unknown>,
) {
  const user = await getAuthenticatedUser();
  const result = await saveOptimizedResumeVersion(resumeId, user.id, name, optimizedData);
  revalidatePath("/dashboard/resume");
  return result;
}

export async function getResumeVersionsAction(resumeId: string) {
  const user = await getAuthenticatedUser();
  return prisma.resume.findMany({
    where: {
      OR: [
        { id: resumeId },
        { parentId: resumeId },
      ],
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      atsScore: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
