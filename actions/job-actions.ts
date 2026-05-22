"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { JobAggregationService } from "@/lib/jobs/job-aggregation-service";
import { JobRecommendationService } from "@/lib/jobs/job-recommendation-service";
import { ensureUserProfile } from "@/lib/user-profiles";
import { jobFeedFiltersSchema, type JobFeedFilters } from "@/types/jobs";

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

export async function syncJobsAction(query: string) {
  await getAuthenticatedUser();
  const service = new JobAggregationService();
  return service.syncJobs(query);
}

export async function getRecentJobsAction() {
  await getAuthenticatedUser();
  const service = new JobAggregationService();
  return service.getRecentJobs();
}

export async function getJobRecommendationsAction(filters?: JobFeedFilters) {
  const user = await getAuthenticatedUser();
  const service = new JobRecommendationService();
  return service.getRecommendations(
    user.id,
    jobFeedFiltersSchema.parse(filters ?? {}),
  );
}
