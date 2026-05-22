import { JobFreshnessBucket, JobType } from "@prisma/client";

import type { JobProvider, UnifiedJob } from "@/types/jobs";
import { classifyFreshness } from "../utils";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function cleanKeywords(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item))
        .filter(Boolean),
    ),
  );
}

function parseOptionalDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeRemoteOkType(tags: string[]) {
  const lowered = tags.map((tag) => tag.toLowerCase());
  if (lowered.includes("hybrid")) return JobType.HYBRID;
  if (lowered.includes("onsite") || lowered.includes("on-site")) return JobType.ONSITE;
  return JobType.REMOTE;
}

function matchQuery(job: UnifiedJob, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = `${job.title} ${job.description} ${job.keywords.join(" ")}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

export class RemoteOkProvider implements JobProvider {
  name = "RemoteOK";

  async fetchJobs(query: string): Promise<UnifiedJob[]> {
    try {
      const response = await fetch("https://remoteok.com/api", {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        console.error(`[${this.name}] Request failed with ${response.status}`);
        return [];
      }

      const data = await response.json();
      const jobs = Array.isArray(data) ? data.slice(1) : [];
      const normalizedQuery = query.trim().toLowerCase();

      return jobs
        .map((job: Record<string, unknown>) => {
          const keywords = cleanKeywords(job.tags);
          const title = cleanText(job.position);
          const company = cleanText(job.company);
          const description = cleanText(job.description);
          const postedAt = parseOptionalDate(job.date);

          return {
            externalId: `remoteok-${cleanText(job.id, cleanText(job.slug, title.toLowerCase().replace(/\s+/g, "-")))}`,
            source: this.name,
            title,
            company,
            location: cleanText(job.location, "Remote"),
            type: normalizeRemoteOkType(keywords),
            description,
            applyUrl: cleanText(job.apply_url, cleanText(job.url)) || null,
            duration: null,
            salaryRange:
              typeof job.salary_min === "number" && typeof job.salary_max === "number"
                ? `${job.salary_min}-${job.salary_max}`
                : null,
            experienceLevel: cleanText(job.seniority) || null,
            isInternship: false,
            isFresherFriendly: /junior|entry|graduate|0-1/i.test(cleanText(job.seniority)),
            freshnessBucket: postedAt ? classifyFreshness(postedAt) : JobFreshnessBucket.UNKNOWN,
            keywords,
            postedAt,
          } satisfies UnifiedJob;
        })
        .filter((job: UnifiedJob) => job.title && job.company && job.description && matchQuery(job, normalizedQuery));
    } catch (error) {
      console.error(`[${this.name}] Fetch failed:`, error);
      return [];
    }
  }
}

export class ArbeitnowProvider implements JobProvider {
  name = "Arbeitnow";

  async fetchJobs(query: string): Promise<UnifiedJob[]> {
    try {
      const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        console.error(`[${this.name}] Request failed with ${response.status}`);
        return [];
      }

      const data = await response.json();
      const jobs = Array.isArray(data?.data) ? data.data : [];
      const normalizedQuery = query.trim().toLowerCase();

      return jobs
        .map((job: Record<string, unknown>) => {
          const keywords = cleanKeywords(job.tags);
          const title = cleanText(job.title);
          const company = cleanText(job.company_name);
          const description = cleanText(job.description);
          const location = cleanText(job.location, "Remote");
          const remote = Boolean(job.remote);
          const postedAt = parseOptionalDate(job.created_at);
          const experienceLevel = cleanText(job.experience_level) || null;

          return {
            externalId: `arbeitnow-${cleanText(job.slug, title.toLowerCase().replace(/\s+/g, "-"))}`,
            source: this.name,
            title,
            company,
            location,
            type: remote ? JobType.REMOTE : JobType.ONSITE,
            description,
            applyUrl: cleanText(job.url) || null,
            duration: null,
            salaryRange: null,
            experienceLevel,
            isInternship: false,
            isFresherFriendly: /junior|entry|graduate|0-1/i.test(experienceLevel ?? ""),
            freshnessBucket: postedAt ? classifyFreshness(postedAt) : JobFreshnessBucket.UNKNOWN,
            keywords,
            postedAt,
          } satisfies UnifiedJob;
        })
        .filter((job: UnifiedJob) => job.title && job.company && job.description && matchQuery(job, normalizedQuery));
    } catch (error) {
      console.error(`[${this.name}] Fetch failed:`, error);
      return [];
    }
  }
}
