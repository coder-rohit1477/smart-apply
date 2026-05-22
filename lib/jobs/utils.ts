import "server-only";

import { JobFreshnessBucket, JobType } from "@prisma/client";

import type { IndiaJobLocation, JobFeedFilters, UnifiedJob } from "@/types/jobs";

const INDIA_LOCATION_TERMS = [
  "india",
  "bangalore",
  "bengaluru",
  "pune",
  "hyderabad",
  "gurgaon",
  "gurugram",
  "mumbai",
  "delhi",
  "noida",
  "chennai",
  "ahmedabad",
  "kolkata",
  "guwahati",
  "remote",
  "work from home",
];

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugifyQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "software-engineer";
}

export function makeAbsoluteUrl(baseUrl: string, href: string | null | undefined) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function inferJobType(location: string, description: string) {
  const haystack = `${location} ${description}`.toLowerCase();
  if (haystack.includes("hybrid")) return JobType.HYBRID;
  if (
    haystack.includes("remote") ||
    haystack.includes("work from home") ||
    haystack.includes("wfh")
  ) {
    return JobType.REMOTE;
  }

  return JobType.ONSITE;
}

export function parseRelativePostedAt(label: string | null | undefined) {
  if (!label) {
    return null;
  }

  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const now = Date.now();
  if (normalized === "just now") return new Date(now - 10 * 60 * 1000);
  if (normalized.includes("few hours")) return new Date(now - 4 * 60 * 60 * 1000);
  if (normalized.includes("yesterday")) return new Date(now - 24 * 60 * 60 * 1000);

  const match = normalized.match(/(\d+)\s+(hour|hours|day|days|week|weeks)/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value)) {
    return null;
  }

  const multipliers: Record<string, number> = {
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  return new Date(now - value * multipliers[unit]);
}

export function classifyFreshness(postedAt: Date | null | undefined) {
  if (!postedAt) {
    return JobFreshnessBucket.UNKNOWN;
  }

  const ageMs = Date.now() - postedAt.getTime();
  if (ageMs <= 24 * 60 * 60 * 1000) return JobFreshnessBucket.LAST_24_HOURS;
  if (ageMs <= 3 * 24 * 60 * 60 * 1000) return JobFreshnessBucket.LAST_3_DAYS;
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return JobFreshnessBucket.LAST_7_DAYS;
  return JobFreshnessBucket.STALE;
}

export function freshnessScore(bucket: JobFreshnessBucket) {
  switch (bucket) {
    case JobFreshnessBucket.LAST_24_HOURS:
      return 100;
    case JobFreshnessBucket.LAST_3_DAYS:
      return 85;
    case JobFreshnessBucket.LAST_7_DAYS:
      return 70;
    case JobFreshnessBucket.STALE:
      return 40;
    case JobFreshnessBucket.UNKNOWN:
    default:
      return 50;
  }
}

export function isIndiaRelevantLocation(location: string) {
  const normalized = location.toLowerCase();
  return INDIA_LOCATION_TERMS.some((term) => normalized.includes(term));
}

export function locationRelevanceScore(location: string, type: JobType, filter: IndiaJobLocation) {
  const normalized = location.toLowerCase();
  const isRemote = type === JobType.REMOTE || normalized.includes("remote") || normalized.includes("work from home");
  const inIndia = isIndiaRelevantLocation(location);

  if (filter === "ALL") {
    if (inIndia && isRemote) return 100;
    if (inIndia) return 90;
    if (isRemote) return 55;
    return 20;
  }

  if (filter === "INDIA_REMOTE") {
    if (isRemote && inIndia) return 100;
    if (isRemote) return 75;
    if (inIndia) return 45;
    return 10;
  }

  const cityTerms: Record<Exclude<IndiaJobLocation, "ALL" | "INDIA_REMOTE">, string[]> = {
    BANGALORE: ["bangalore", "bengaluru"],
    PUNE: ["pune"],
    HYDERABAD: ["hyderabad"],
    GURGAON: ["gurgaon", "gurugram"],
  };

  const targetTerms = cityTerms[filter as keyof typeof cityTerms] ?? [];
  if (targetTerms.some((term) => normalized.includes(term))) return 100;
  if (isRemote && inIndia) return 80;
  if (inIndia) return 45;
  return 10;
}

export function fresherFitScore(job: Pick<UnifiedJob, "isInternship" | "isFresherFriendly" | "experienceLevel">, filters: JobFeedFilters) {
  const experience = job.experienceLevel?.toLowerCase() ?? "";
  const looksJunior = /fresher|entry|0|1 year|0-1|0 to 1|graduate|intern/.test(experience);
  const fresherAligned = job.isFresherFriendly || job.isInternship || looksJunior;

  if (filters.internshipsOnly) {
    return job.isInternship ? 100 : 15;
  }

  if (filters.fresherOnly) {
    return fresherAligned ? 100 : 25;
  }

  if (job.isInternship) return 85;
  if (fresherAligned) return 90;
  return 55;
}

export function matchesFilters(job: Pick<UnifiedJob, "isInternship" | "isFresherFriendly" | "location" | "type" | "experienceLevel">, filters: JobFeedFilters) {
  if (filters.internshipsOnly && !job.isInternship) {
    return false;
  }

  if (filters.fresherOnly) {
    const experience = job.experienceLevel?.toLowerCase() ?? "";
    const fresherLike = job.isFresherFriendly || job.isInternship || /fresher|entry|0|1 year|0-1|graduate|intern/.test(experience);
    if (!fresherLike) {
      return false;
    }
  }

  return locationRelevanceScore(job.location, job.type, filters.location) >= 45;
}

export function normalizeKeywords(keywords: string[]) {
  return Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)));
}
