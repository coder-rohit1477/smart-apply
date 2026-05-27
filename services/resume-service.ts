import "server-only";
import type { Prisma, Resume } from "@prisma/client";
import { ZodError } from "zod";
import { createEmptyParsedResume } from "@/lib/parsers/normalize";
import { prisma } from "@/lib/prisma";
import { deleteLocalResumeFile, uploadLocalResumeFile } from "@/lib/upload/local-upload";
import { ensureUserProfile } from "@/lib/user-profiles";
import {
  toValidationError,
  validateResumeFileDescriptor,
} from "@/lib/validations/resume-validation";
import {
  parsedResumeSchema,
  storedResumeSchema,
  type DeleteResponse,
  type ParsedResume,
  type ParserResult,
  type ResumeApiError,
  type ResumeErrorCode,
  type StoredResume,
} from "@/types/resume";

interface ResumeActor {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
}

export class ResumeServiceError extends Error {
  readonly code: ResumeErrorCode;
  readonly details?: string[];
  readonly status: number;

  constructor(
    code: ResumeErrorCode,
    message: string,
    status: number,
    details?: string[],
  ) {
    super(message);
    this.name = "ResumeServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toApiError(): ResumeApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export async function uploadResumeForActor(input: {
  actor: ResumeActor;
  file: File;
}) {
  const buffer = await readResumeFile(input.file);
  const parserResult = await parseResumeOnly({ file: input.file, buffer });
  const uploadedFile = await uploadLocalResumeFile({
    buffer,
    clerkUserId: input.actor.clerkUserId,
    originalFileName: input.file.name,
  });

  try {
    const userProfile = await ensureUserProfile(input.actor);
    const storedResume = await prisma.resume.create({
      data: {
        userId: userProfile.id,
        name: parserResult.parsedResume.fullName ?? input.file.name,
        version: null,
        targetRole: parserResult.parsedResume.headline,
        summary: parserResult.parsedResume.summary,
        atsScore: 0,
        parsedSkills: parserResult.parsedResume.skills.map((skill) => skill.name),
        fileName: input.file.name,
        fileType: input.file.type || "application/octet-stream",
        fileSize: input.file.size,
        fileUrl: uploadedFile.fileUrl,
        rawText: parserResult.rawText,
        parsedData: toParsedResumeJson(parserResult.parsedResume),
        extractedSkills: parserResult.parsedResume.skills.map((skill) => skill.name),
      },
    });

    return serializeStoredResume(storedResume);
  } catch (error) {
    await deleteLocalResumeFile(uploadedFile.fileUrl);
    throw mapUnknownResumeError(error, "DATABASE_FAILED", "Unable to save the parsed resume.");
  }
}

export async function parseResumeOnly(input: {
  file: File;
  buffer?: Buffer;
}): Promise<ParserResult> {
  const validationIssues = validateResumeFileDescriptor({
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
  });

  if (validationIssues.length > 0) {
    const validationError = toValidationError(validationIssues);
    throw new ResumeServiceError(
      validationError.code,
      validationError.message,
      400,
      validationError.details,
    );
  }

  const buffer = input.buffer ?? (await readResumeFile(input.file));

  try {
    const { parseResumeBuffer } = await import("@/lib/parsers/parser-service");
    return await parseResumeBuffer({
      buffer,
      fileName: input.file.name,
      fileType: input.file.type || "application/octet-stream",
      fileSize: input.file.size,
      fileUrl: null,
    });
  } catch (error) {
    throw mapUnknownResumeError(
      error,
      "PARSE_FAILED",
      "We couldn't extract text from that resume. Try another PDF or DOCX file.",
    );
  }
}

export async function deleteResumeForActor(input: {
  actor: ResumeActor;
  resumeId: string;
}): Promise<DeleteResponseSuccess> {
  const existingResume = await prisma.resume.findFirst({
    where: {
      id: input.resumeId,
      user: {
        clerkUserId: input.actor.clerkUserId,
      },
    },
  });

  if (!existingResume) {
    throw new ResumeServiceError(
      "NOT_FOUND",
      "The requested resume could not be found.",
      404,
    );
  }

  await prisma.resume.delete({
    where: {
      id: existingResume.id,
    },
  });

  if (existingResume.fileUrl) {
    await deleteLocalResumeFile(existingResume.fileUrl);
  }

  return {
    success: true,
    deletedResumeId: existingResume.id,
  };
}

export async function getLatestResumeForActor(
  clerkUserId: string,
): Promise<StoredResume | null> {
  const resume = await prisma.resume.findFirst({
    where: {
      user: {
        clerkUserId,
      },
    },
    select: {
      id: true,
      name: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      fileUrl: true,
      parsedData: true,
      extractedSkills: true,
      parsedSkills: true,
      targetRole: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      // rawText intentionally excluded to keep the response lean;
      // serializeStoredResume falls back to summary when rawText is null.
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!resume) return null;

  // Build a partial Resume shape that satisfies serializeStoredResume.
  const partial = {
    id: resume.id,
    name: resume.name,
    fileName: resume.fileName,
    fileType: resume.fileType,
    fileSize: resume.fileSize,
    fileUrl: resume.fileUrl,
    parsedData: resume.parsedData,
    extractedSkills: resume.extractedSkills,
    parsedSkills: resume.parsedSkills,
    targetRole: resume.targetRole,
    summary: resume.summary,
    rawText: null, // not fetched — will be handled by the fallback inside serializeStoredResume
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
  } as unknown as Resume;

  return serializeStoredResume(partial);
}

export function buildResumeErrorResponse(error: unknown) {
  const resumeError =
    error instanceof ResumeServiceError
      ? error
      : error instanceof ZodError
        ? new ResumeServiceError(
            "INVALID_FILE",
            "The resume request payload was invalid.",
            400,
            error.issues.map((issue) => issue.message),
          )
        : mapUnknownResumeError(
            error,
            "UNKNOWN_ERROR",
            "Something went wrong while processing the resume.",
          );

  return {
    status: resumeError.status,
    body: {
      success: false,
      error: resumeError.toApiError(),
    } as const,
  };
}

type DeleteResponseSuccess = Extract<DeleteResponse, { success: true }>;

async function readResumeFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new ResumeServiceError(
      "EMPTY_FILE",
      "The uploaded file is empty.",
      400,
    );
  }

  return Buffer.from(arrayBuffer);
}

function serializeStoredResume(resume: Resume) {
  const parsedResume = parseStoredResumeJson(resume.parsedData);

  // rawText is omitted on lightweight queries; fall back gracefully.
  const rawText =
    resume.rawText ??
    parsedResume.summary ??
    resume.summary ??
    "Resume text unavailable.";

  return storedResumeSchema.parse({
    id: resume.id,
    metadata: {
      fileName: resume.fileName ?? resume.name,
      fileType: resume.fileType ?? "application/octet-stream",
      fileSize: resume.fileSize ?? 0,
      fileUrl: resume.fileUrl ?? null,
    },
    rawText,
    parsedData: parsedResume,
    extractedSkills:
      resume.extractedSkills.length > 0
        ? resume.extractedSkills
        : resume.parsedSkills,
    targetRole: resume.targetRole,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  });
}

function parseStoredResumeJson(parsedData: Prisma.JsonValue | null): ParsedResume {
  if (!parsedData) {
    return createEmptyParsedResume();
  }

  const parsed = parsedResumeSchema.safeParse(parsedData);

  if (parsed.success) {
    return parsed.data;
  }

  return createEmptyParsedResume();
}

function toParsedResumeJson(parsedResume: ParsedResume): Prisma.InputJsonObject {
  return {
    fullName: parsedResume.fullName,
    email: parsedResume.email,
    phoneNumber: parsedResume.phoneNumber,
    headline: parsedResume.headline,
    summary: parsedResume.summary,
    estimatedYearsOfExperience: parsedResume.estimatedYearsOfExperience,
    skills: parsedResume.skills.map((skill) => ({
      name: skill.name,
      normalizedName: skill.normalizedName,
      source: skill.source,
      confidence: skill.confidence,
    })),
    projects: parsedResume.projects,
    education: parsedResume.education,
    experience: parsedResume.experience,
    certifications: parsedResume.certifications,
  };
}

function mapUnknownResumeError(
  error: unknown,
  code: ResumeErrorCode,
  message: string,
) {
  if (error instanceof ResumeServiceError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : message;
  const finalCode: ResumeErrorCode =
    error instanceof Error && error.message.includes("supported")
      ? "INVALID_FILE_TYPE"
      : code;

  return new ResumeServiceError(
    finalCode,
    errorMessage,
    inferStatus(finalCode),
    error instanceof Error ? [error.message] : [],
  );
}

function inferStatus(code: ResumeErrorCode) {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "INVALID_FILE":
    case "INVALID_FILE_TYPE":
    case "FILE_TOO_LARGE":
    case "EMPTY_FILE":
      return 400;
    case "PARSE_FAILED":
    case "CORRUPTED_FILE":
      return 422;
    case "STORAGE_FAILED":
    case "DATABASE_FAILED":
      return 500;
    case "UNKNOWN_ERROR":
      return 500;
  }
}
