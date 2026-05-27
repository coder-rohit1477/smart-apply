import { prisma } from "@/lib/prisma";
import { performAtsMatch } from "@/lib/ai/services/ats-service";
import { createAtsMatchFallback } from "@/lib/ai/services/ai-fallbacks";
import type {
  JobFeedFilters,
  JobRecommendation,
  JobRecommendationCategory,
} from "@/types/jobs";
import type { AtsMatchResult } from "@/lib/matching/ats-engine";
import {
  freshnessScore,
  fresherFitScore,
  locationRelevanceScore,
  matchesFilters,
} from "./utils";

const DEFAULT_FILTERS: JobFeedFilters = {
  internshipsOnly: false,
  fresherOnly: false,
  location: "ALL",
};

// Simple in-process cache: key = `${resumeId}:${jobId}`, TTL = 10 minutes
const atsCache = new Map<string, { result: AtsMatchResult; expiresAt: number }>();
const ATS_CACHE_TTL_MS = 10 * 60 * 1000;

async function cachedAtsMatch(
  resumeText: string,
  resumeId: string,
  jobId: string,
  jobDescription: string,
): Promise<AtsMatchResult> {
  const cacheKey = `${resumeId}:${jobId}`;
  const cached = atsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const result = await performAtsMatch(resumeText, jobDescription);
    atsCache.set(cacheKey, { result, expiresAt: Date.now() + ATS_CACHE_TTL_MS });
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "ATS match failed";
    return createAtsMatchFallback(resumeText, jobDescription, reason);
  }
}

export class JobRecommendationService {
  async getRecommendations(
    userId: string,
    filters: JobFeedFilters = DEFAULT_FILTERS,
  ): Promise<JobRecommendation[]> {
    const resume = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!resume || !resume.rawText) return [];

    const jobs = await prisma.jobListing.findMany({
      where: {
        description: {
          not: "",
        },
        OR: [
          { source: { in: ["Internshala", "Naukri", "Wellfound"] } },
          { isInternship: true },
          { isFresherFriendly: true },
          { location: { contains: "India", mode: "insensitive" } },
          { location: { contains: "Bangalore", mode: "insensitive" } },
          { location: { contains: "Pune", mode: "insensitive" } },
          { location: { contains: "Hyderabad", mode: "insensitive" } },
          { location: { contains: "Gurgaon", mode: "insensitive" } },
          { location: { contains: "Gurugram", mode: "insensitive" } },
          { location: { contains: "Remote", mode: "insensitive" } },
        ],
      },
      orderBy: [
        { postedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 80,
    });

    const filteredJobs = jobs
      .filter((job) =>
        matchesFilters(
          {
            isInternship: job.isInternship,
            isFresherFriendly: job.isFresherFriendly,
            location: job.location,
            type: job.type,
            experienceLevel: job.experienceLevel,
          },
          filters,
        ),
      )
      .slice(0, 12);

    const recommendations: JobRecommendation[] = [];

    for (const job of filteredJobs) {
      try {
        const match = await cachedAtsMatch(
          resume.rawText,
          resume.id,
          job.id,
          job.description,
        );

        const locationScore = locationRelevanceScore(job.location, job.type, filters.location);
        const fresherScore = fresherFitScore(
          {
            isInternship: job.isInternship,
            isFresherFriendly: job.isFresherFriendly,
            experienceLevel: job.experienceLevel,
          },
          filters,
        );
        const recencyScore = freshnessScore(job.freshnessBucket);

        const score = Math.round(
          match.overallScore * 0.4 +
            match.semanticSimilarity * 0.2 +
            match.keywordMatch.percentage * 0.15 +
            locationScore * 0.1 +
            fresherScore * 0.1 +
            recencyScore * 0.05,
        );

        let category: JobRecommendationCategory = "STRETCH";
        if (score >= 85) category = "BEST_MATCH";
        else if (match.keywordMatch.percentage >= 75 || recencyScore >= 90) category = "HIGH_ATS_POTENTIAL";
        else if (score >= 60) category = "SAFE";

        const reasons = [
          match.recruiterReadiness.pros[0],
          job.isInternship ? "Internship role" : null,
          job.isFresherFriendly ? "Fresher-friendly" : null,
          recencyScore >= 90 ? "recently posted" : null,
        ].filter(Boolean);

        recommendations.push({
          job: {
            ...job,
            externalId: job.externalId || `job-${job.id}`,
            source: job.source || "Unknown",
            applyUrl: job.applyUrl,
            duration: job.duration,
            salaryRange: job.salaryRange,
            experienceLevel: job.experienceLevel,
            isInternship: job.isInternship,
            isFresherFriendly: job.isFresherFriendly,
            freshnessBucket: job.freshnessBucket,
            keywords: job.keywords ?? [],
            postedAt: job.postedAt,
          },
          category,
          score,
          reasoning: reasons.join(" · ") || "Aligned with your profile.",
          scoreBreakdown: {
            atsMatch: match.overallScore,
            semanticMatch: match.semanticSimilarity,
            locationRelevance: locationScore,
            fresherFit: fresherScore,
            freshness: recencyScore,
          },
          matchDetails: match,
        });
      } catch (err) {
        console.error(`Failed to score job ${job.id}:`, err);
      }
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }
}
