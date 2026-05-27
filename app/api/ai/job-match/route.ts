import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { performAiJobMatch } from "@/lib/ai/services/ai-job-match-service";
import { ensureUserProfile } from "@/lib/user-profiles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const matchSchema = z.object({
  resumeId: z.string().min(1),
  jobDescription: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { resumeId, jobDescription } = matchSchema.parse(body);

    const user = await currentUser();
    const userProfile = await ensureUserProfile({
      clerkUserId,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      firstName: user?.firstName ?? user?.username ?? null,
    });

    const resume = await prisma.resume.findFirst({
      where: {
        id: resumeId,
        userId: userProfile.id,
      },
    });

    if (!resume || !resume.rawText) {
      return NextResponse.json({ error: "Resume not found or has no text" }, { status: 404 });
    }

    const matchResult = await performAiJobMatch(resume.rawText, jobDescription);

    return NextResponse.json({
      success: true,
      match: matchResult,
    });
  } catch (error: unknown) {
    console.error("Job Match Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to match job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
