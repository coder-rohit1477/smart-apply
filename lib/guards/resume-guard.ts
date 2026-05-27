import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Throws a typed error if the given clerkUserId does not own the resume.
 * Use this at the top of any API route or server action that accepts a resumeId.
 *
 * @example
 * const resume = await assertResumeOwnership(resumeId, clerkUserId);
 * // resume is the verified Prisma record — no second DB trip needed
 */
export async function assertResumeOwnership(
  resumeId: string,
  clerkUserId: string,
) {
  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      user: {
        clerkUserId,
      },
    },
    select: {
      id: true,
      rawText: true,
      userId: true,
    },
  });

  if (!resume) {
    // Return 404 rather than 403 — never confirm a resource exists to
    // someone who doesn't own it.
    throw new ResumeOwnershipError(resumeId);
  }

  return resume;
}

export class ResumeOwnershipError extends Error {
  readonly status = 404;
  readonly code = "NOT_FOUND";

  constructor(resumeId: string) {
    super(`Resume ${resumeId} not found or access denied.`);
    this.name = "ResumeOwnershipError";
  }
}
