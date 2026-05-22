import { JobFreshnessBucket } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { JobProvider, UnifiedJob } from "@/types/jobs";
import { ArbeitnowProvider, RemoteOkProvider } from "./providers/official-apis";
import {
  InternshalaProvider,
  NaukriProvider,
  WellfoundProvider,
} from "./providers/external-sources";
import { classifyFreshness, normalizeKeywords } from "./utils";

export class JobAggregationService {
  private providers: JobProvider[] = [
    new InternshalaProvider(),
    new NaukriProvider(),
    new WellfoundProvider(),
    new RemoteOkProvider(),
    new ArbeitnowProvider(),
  ];

  private createStableExternalId(job: UnifiedJob) {
    const normalized = `${job.source}-${job.externalId || `${job.company}-${job.title}-${job.location}`}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || `job-${Date.now()}`;
  }

  private normalizeJob(job: UnifiedJob): UnifiedJob | null {
    const title = job.title?.trim();
    const company = job.company?.trim();
    const description = job.description?.trim();

    if (!title || !company || !description) {
      return null;
    }

    const postedAt = job.postedAt ?? null;
    return {
      ...job,
      externalId: this.createStableExternalId(job),
      source: job.source.trim(),
      title,
      company,
      location: job.location?.trim() || "India",
      description,
      applyUrl: job.applyUrl?.trim() || null,
      duration: job.duration?.trim() || null,
      salaryRange: job.salaryRange?.trim() || null,
      experienceLevel: job.experienceLevel?.trim() || null,
      isInternship: Boolean(job.isInternship),
      isFresherFriendly: Boolean(job.isFresherFriendly),
      freshnessBucket:
        job.freshnessBucket && job.freshnessBucket !== JobFreshnessBucket.UNKNOWN
          ? job.freshnessBucket
          : classifyFreshness(postedAt),
      keywords: normalizeKeywords(job.keywords ?? []),
      postedAt,
    };
  }

  async syncJobs(query: string) {
    console.log(`[Job Aggregation] Syncing jobs for: ${query}`);

    const results = await Promise.allSettled(
      this.providers.map((provider) => provider.fetchJobs(query)),
    );

    const allJobs: UnifiedJob[] = [];
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value);
      } else {
        console.error(`Provider ${this.providers[idx].name} failed:`, result.reason);
      }
    });

    const dedupedJobs = new Map<string, UnifiedJob>();

    for (const job of allJobs) {
      const normalizedJob = this.normalizeJob(job);
      if (!normalizedJob) {
        console.warn("[Job Aggregation] Skipping invalid job payload", {
          source: job.source,
          externalId: job.externalId,
          title: job.title,
        });
        continue;
      }

      dedupedJobs.set(normalizedJob.externalId, normalizedJob);
    }

    const normalizedJobs = Array.from(dedupedJobs.values());
    const persistedJobs = await Promise.allSettled(
      normalizedJobs.map((job) =>
        prisma.jobListing.upsert({
          where: { externalId: job.externalId },
          update: {
            source: job.source,
            title: job.title,
            company: job.company,
            location: job.location,
            type: job.type,
            description: job.description,
            applyUrl: job.applyUrl,
            duration: job.duration,
            salaryRange: job.salaryRange,
            experienceLevel: job.experienceLevel,
            isInternship: job.isInternship,
            isFresherFriendly: job.isFresherFriendly,
            freshnessBucket: job.freshnessBucket,
            keywords: job.keywords,
            postedAt: job.postedAt,
          },
          create: {
            externalId: job.externalId,
            source: job.source,
            title: job.title,
            company: job.company,
            location: job.location,
            type: job.type,
            description: job.description,
            applyUrl: job.applyUrl,
            duration: job.duration,
            salaryRange: job.salaryRange,
            experienceLevel: job.experienceLevel,
            isInternship: job.isInternship,
            isFresherFriendly: job.isFresherFriendly,
            freshnessBucket: job.freshnessBucket,
            keywords: job.keywords,
            postedAt: job.postedAt,
          },
        }),
      ),
    );

    let savedCount = 0;
    persistedJobs.forEach((result, index) => {
      if (result.status === "fulfilled") {
        savedCount += 1;
        return;
      }

      const failedJob = normalizedJobs[index];
      console.error("[Job Aggregation] Failed to persist job", {
        externalId: failedJob?.externalId,
        source: failedJob?.source,
        title: failedJob?.title,
        error: result.reason,
      });
    });

    console.log("[Job Aggregation] Sync complete", {
      fetched: allJobs.length,
      deduped: dedupedJobs.size,
      saved: savedCount,
    });

    return savedCount;
  }

  async getRecentJobs(limit = 20) {
    return prisma.jobListing.findMany({
      where: {
        OR: [
          { source: { in: ["Internshala", "Naukri", "Wellfound"] } },
          { isInternship: true },
          { isFresherFriendly: true },
        ],
      },
      orderBy: [
        { freshnessBucket: "asc" },
        { postedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });
  }
}
