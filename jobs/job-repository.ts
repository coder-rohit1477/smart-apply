import type { ActivityItem, JobRecord, PipelineItem, ResumeProfile } from "@/lib/types";
import { prisma } from "@/lib/prisma";

import type { UnifiedJob } from "@/types/jobs";
import { JobType } from "@prisma/client"; // Added import

const pipelineItems: PipelineItem[] = [
  {
    id: "pipeline-bridge-labs",
    company: "Bridge Labs",
    title: "Staff Frontend Engineer",
    status: "Interview prep",
    nextStep: "Finalize system design examples",
    fitScore: 92,
    updatedAt: "2 hours ago",
  },
  {
    id: "pipeline-orbit-ai",
    company: "Orbit AI",
    title: "AI Product Engineer",
    status: "Resume tailoring",
    nextStep: "Add LLM workflow evidence",
    fitScore: 86,
    updatedAt: "Yesterday",
  },
  {
    id: "pipeline-cascade-cloud",
    company: "Cascade Cloud",
    title: "Design Systems Lead",
    status: "Applied",
    nextStep: "Prepare follow-up note",
    fitScore: 84,
    updatedAt: "2 days ago",
  },
];

const activityFeed: ActivityItem[] = [
  {
    id: "activity-1",
    title: "Resume parser refreshed profile strengths",
    description:
      "Smart Apply re-scored the resume and detected stronger design-system signals from the latest update.",
    time: "Today · 08:30",
  },
  {
    id: "activity-2",
    title: "ATS engine flagged one missing keyword cluster",
    description:
      "The Orbit AI role is missing evidence for LLM workflow delivery and product experimentation language.",
    time: "Today · 07:10",
  },
  {
    id: "activity-3",
    title: "Application pipeline advanced to interview prep",
    description:
      "Bridge Labs moved into the preparation stage, so Smart Apply surfaced system-design and leadership talking points.",
    time: "Yesterday · 17:40",
  },
];


interface GetFeaturedJobsFilters {
  isInternship?: boolean;
  isFresherFriendly?: boolean;
  location?: string; // "India", "Remote", "New York"
  remote?: boolean;
  query?: string; // Search query
  seniority?: ResumeProfile["seniority"];
}

export async function getFeaturedJobs(
  filters: GetFeaturedJobsFilters = {},
  limit: number = 20,
): Promise<JobRecord[]> {
  const where: any = {};
  const orderBy: any[] = [];
  let strictIndiaFilter = false;

  // 1. Internship Filter (Hard)
  if (filters.isInternship || filters.seniority === "Fresher" || filters.seniority === "Intern") {
    where.isInternship = true;
    // Explicitly exclude senior roles for internship/fresher
    where.experienceLevel = {
      notIn: ["Senior", "Lead", "Staff", "Principal"],
    };
    
      
    
    orderBy.push({ isInternship: "desc" });
  }

  // 2. Fresher Filter (Hard) - applied if not already covered by internship filter
  if (filters.isFresherFriendly || (filters.seniority === "Fresher" && !where.isInternship)) {
    where.OR = [
        ...(where.OR || []), // Preserve existing OR conditions
        { isFresherFriendly: true },
        { isInternship: true } // Internships are also fresher-friendly
    ];
    // Explicitly exclude senior roles for fresher
    where.experienceLevel = {
      AND: [
        { not: { equals: "Senior", mode: "insensitive" } },
        { not: { equals: "Lead", mode: "insensitive" } },
        { not: { equals: "Staff", mode: "insensitive" } },
        { not: { equals: "Principal", mode: "insensitive" } },
      ],
    };
    orderBy.push({ isFresherFriendly: "desc" });
  }

  // 3. Location Filters
  if (filters.remote) {
    where.location = { contains: "Remote", mode: "insensitive" };
  }
  // Strict India Focus
  if (filters.location === "India") {
    strictIndiaFilter = true;
    where.location = {
      // Prioritize explicit Indian cities and "India" keyword
      // This will be a hard filter, only showing these locations
      OR: [
        { contains: "India", mode: "insensitive" },
        { contains: "IN", mode: "insensitive" },
        { contains: "Bangalore", mode: "insensitive" },
        { contains: "Bengaluru", mode: "insensitive" },
        { contains: "Hyderabad", mode: "insensitive" },
        { contains: "Pune", mode: "insensitive" },
        { contains: "Gurgaon", mode: "insensitive" },
        { contains: "Gurugram", mode: "insensitive" },
        { contains: "Mumbai", mode: "insensitive" },
        { contains: "Delhi", mode: "insensitive" },
        { contains: "Chennai", mode: "insensitive" },
        // ... add more Indian cities
      ],
    };
    orderBy.push({ location: "desc" }); // Prioritize India in ordering
  } else if (filters.location && filters.location !== "Remote") {
    // General city filter if not India and not Remote
    where.location = { contains: filters.location, mode: "insensitive" };
  }


  // 4. Seniority-based exclusion (for non-internship/fresher filters)
  // Only apply if not already handled by internship/fresher filters in experienceLevel
  if (!where.experienceLevel?.not && filters.seniority) {
    if (filters.seniority === "Junior") {
      where.experienceLevel = { OR: [{ equals: "Entry-level", mode: "insensitive" }, { equals: "Junior", mode: "insensitive" }] };
    } else if (filters.seniority === "Mid-level") {
      where.experienceLevel = { OR: [{ equals: "Entry-level", mode: "insensitive" }, { equals: "Junior", mode: "insensitive" }, { equals: "Mid-level", mode: "insensitive" }] };
    } else if (filters.seniority === "Senior") {
      where.experienceLevel = { OR: [{ equals: "Mid-level", mode: "insensitive" }, { equals: "Senior", mode: "insensitive" }, { equals: "Lead", mode: "insensitive" }] };
    } else if (filters.seniority === "Lead") {
      where.experienceLevel = { OR: [{ equals: "Senior", mode: "insensitive" }, { equals: "Lead", mode: "insensitive" }] };
    }
  }


  // 5. Query Filter
  if (filters.query) {
    const queryConditions = [
      { title: { contains: filters.query, mode: "insensitive" } },
      { description: { contains: filters.query, mode: "insensitive" } },
      { keywords: { has: filters.query.toLowerCase() } },
    ];
    if (where.AND) {
        where.AND.push({ OR: queryConditions });
    } else if (where.OR) { // If there were existing OR conditions, combine them with the query
        where.AND = [{ OR: where.OR }, { OR: queryConditions }];
        delete where.OR;
    } else {
        where.OR = queryConditions;
    }
  }

  // Default ordering if no specific seniority/location prioritization
  if (orderBy.length === 0) {
      orderBy.push({ freshnessBucket: "asc" }, { postedAt: "desc" }, { createdAt: "desc" });
  } else {
      // Always include freshness and recency as secondary sorts
      orderBy.push({ freshnessBucket: "asc" }, { postedAt: "desc" }, { createdAt: "desc" });
  }

  const rawJobListings = await prisma.jobListing.findMany({
    where,
    orderBy,
    take: limit * 3, // Fetch more to allow for balancing
  });

  // --- Provider Balancing ---
  const balancedJobs: JobRecord[] = [];
  const jobsByProvider: { [key: string]: JobRecord[] } = {};
  const maxPerProvider = Math.ceil(limit * 0.4); // Max 40% from one provider

  // Convert JobListing to JobRecord and group by provider
  rawJobListings.forEach((job) => {
    let recordId: string;
    if (job.externalId) {
      recordId = job.externalId;
    } else {
      const parts = [
        job.source,
        job.company,
        job.title,
        job.location,
        job.postedAt?.toISOString(),
      ].filter(Boolean);
      let generatedId = `generated-${parts.join('-').replace(/\s+/g, '-').toLowerCase()}`;
      generatedId = generatedId.substring(0, 200).replace(/[^a-z0-9-]/g, '');
      if (generatedId.length === 0 || generatedId === "generated-") {
          generatedId = `fallback-${Math.random().toString(36).substring(2, 15)}`;
      }
      recordId = generatedId;
    }
    let jobSchedule: "Remote" | "Hybrid" | "On-site";
    switch (job.type) {
      case JobType.REMOTE:
        jobSchedule = "Remote";
        break;
      case JobType.HYBRID:
        jobSchedule = "Hybrid";
        break;
      case JobType.ONSITE:
        jobSchedule = "On-site";
        break;
      default:
        console.warn(`Unknown JobType: ${job.type}. Defaulting to "On-site".`);
        jobSchedule = "On-site";
        break;
    }
    const record: JobRecord = {
      id: recordId,
      company: job.company,
      title: job.title,
      location: job.location,
      schedule: jobSchedule,
      salary: job.salaryRange || "Not Disclosed",
      summary: job.description,
      skills: job.keywords.map(keyword => ({ name: keyword, normalizedName: keyword.toLowerCase(), source: "job-keywords", confidence: "high" })),
      postedAt: job.postedAt?.toDateString() || "Unknown",
      stage: "Curated",
      source: job.source,
    };
    if (!jobsByProvider[job.source]) {
      jobsByProvider[job.source] = [];
    }
    jobsByProvider[job.source].push(record);
  });

  // Round-robin selection with caps
  let providerKeys = Object.keys(jobsByProvider);
  let currentIndexes: { [key: string]: number } = {};
  providerKeys.forEach(key => currentIndexes[key] = 0);

  let jobsAdded = 0;
  let attempts = 0;
  const maxAttempts = limit * providerKeys.length * 2; // Prevent infinite loops

  while (jobsAdded < limit && attempts < maxAttempts) {
    for (const provider of providerKeys) {
      if (jobsAdded >= limit) break; // Stop if we have enough jobs

      const providerJobs = jobsByProvider[provider];
      const currentJobIndex = currentIndexes[provider];

      // Check if provider has jobs left AND hasn't exceeded its cap
      const currentProviderCount = balancedJobs.filter(j => j.source === provider).length;
      if (currentJobIndex < providerJobs.length && currentProviderCount < maxPerProvider) {
        balancedJobs.push(providerJobs[currentJobIndex]);
        currentIndexes[provider]++;
        jobsAdded++;
      }
    }
    attempts++;
    // If no jobs were added in a full round, break to avoid infinite loop
    if (jobsAdded === balancedJobs.length && attempts > providerKeys.length) break;
  }

  // If after balancing, we still don't have enough jobs, fill with remaining
  let remainingJobsToFill = limit - balancedJobs.length;
  if (remainingJobsToFill > 0) {
      const allRemainingJobs = rawJobListings
          .filter(rawJob => !balancedJobs.some(balJob => balJob.id === rawJob.externalId))
          .map(job => {
              let recordId: string;
              if (job.externalId) {
                recordId = job.externalId;
              } else {
                const parts = [
                  job.source,
                  job.company,
                  job.title,
                  job.location,
                  job.postedAt?.toISOString(),
                ].filter(Boolean);
                let generatedId = `generated-${parts.join('-').replace(/\s+/g, '-').toLowerCase()}`;
                generatedId = generatedId.substring(0, 200).replace(/[^a-z0-9-]/g, '');
                if (generatedId.length === 0 || generatedId === "generated-") {
                    generatedId = `fallback-${Math.random().toString(36).substring(2, 15)}`;
                }
                recordId = generatedId;
              }
              return { // Convert to JobRecord
              id: recordId,
              company: job.company,
              title: job.title,
              location: job.location,
              schedule: (() => {
                let jobSchedule: "Remote" | "Hybrid" | "On-site";
                switch (job.type) {
                  case JobType.REMOTE:
                    jobSchedule = "Remote";
                    break;
                  case JobType.HYBRID:
                    jobSchedule = "Hybrid";
                    break;
                  case JobType.ONSITE:
                    jobSchedule = "On-site";
                    break;
                  default:
                    console.warn(`Unknown JobType: ${job.type}. Defaulting to "On-site".`);
                    jobSchedule = "On-site";
                    break;
                }
                return jobSchedule;
              })(),
              salary: job.salaryRange || "Not Disclosed",
              summary: job.description,
              skills: job.keywords.map(keyword => ({ name: keyword, normalizedName: keyword.toLowerCase(), source: "job-keywords", confidence: "high" })),
              postedAt: job.postedAt?.toDateString() || "Unknown",
              stage: "Curated",
              source: job.source,
          } as JobRecord; // This is the corrected closing of the object literal and cast
          }); // This closes the map call and implicitly terminates the const statement.
      balancedJobs.push(...allRemainingJobs.slice(0, remainingJobsToFill));
  }

  return balancedJobs;
}

export async function getPipelineItems(_userId?: string): Promise<PipelineItem[]> {
  return pipelineItems;
}

export async function getActivityFeed(_userId?: string): Promise<ActivityItem[]> {
  return activityFeed;
}