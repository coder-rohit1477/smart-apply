import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { performFullResumeAnalysis } from "@/lib/ai/services/ai-resume-service";
import { prisma } from "@/lib/prisma";

const analyzeSchema = z.object({
  resumeId: z.string().min(1),
  jobDescription: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { resumeId, jobDescription } = analyzeSchema.parse(body);

    const userProfile = await prisma.userProfile.findUnique({
      where: { clerkUserId },
    });

    if (!userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const analysis = await performFullResumeAnalysis(
      resumeId,
      userProfile.id,
      jobDescription
    );

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    console.error("Analysis Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to analyze resume";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
