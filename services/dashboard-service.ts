import { buildAiRecommendations } from "@/ai/application-assistant";
import { getActivityFeed, getFeaturedJobs, getPipelineItems } from "@/jobs/job-repository";
import type { DashboardSnapshot, LandingSnapshot } from "@/lib/types";
import { buildJobMatches } from "@/matching/job-matcher";
import { getResumeProfile } from "@/parser/resume-parser";

export async function getLandingSnapshot(): Promise<LandingSnapshot> {
  const profile = await getResumeProfile();
  const jobs = await getFeaturedJobs({});
  const previewMatches = buildJobMatches(profile, jobs).slice(0, 3);
  const averageAts = Math.round(
    previewMatches.reduce((total, match) => total + match.atsScore, 0) /
      previewMatches.length,
  );

  return {
    stats: [
      {
        label: "curated roles",
        value: "12k+",
        note: "Tracked across engineering, product, and design pipelines.",
      },
      {
        label: "average ATS readiness",
        value: `${averageAts}%`,
        note: "Computed from parser and ATS heuristics before submission.",
      },
      {
        label: "faster targeting",
        value: "4x",
        note: "Candidates see ranked opportunities instead of searching blind.",
      },
    ],
    previewMetrics: [
      {
        label: "Qualified matches",
        value: String(previewMatches.length).padStart(2, "0"),
        delta: "+6 this week",
        description: "Roles currently above the internal fit threshold.",
        trend: "up",
      },
      {
        label: "Avg ATS score",
        value: `${averageAts}%`,
        delta: "+9 pts",
        description: "Baseline optimization signal before application review.",
        trend: "up",
      },
      {
        label: "Automation coverage",
        value: "81%",
        delta: "steady",
        description: "Workflow stages already mapped to services and actions.",
        trend: "steady",
      },
    ],
    previewMatches,
  };
}

export async function getDashboardSnapshot(
  userId?: string,
): Promise<DashboardSnapshot> {
  const profile = await getResumeProfile(userId);
  const jobs = await getFeaturedJobs({ seniority: profile.seniority });
  const matches = buildJobMatches(profile, jobs);
  const pipeline = await getPipelineItems(userId);
  const activities = await getActivityFeed(userId);
  const recommendations = buildAiRecommendations(profile, matches, pipeline);

  const averageFit = Math.round(
    matches.reduce((total, match) => total + match.matchScore, 0) / matches.length,
  );
  const averageAts = Math.round(
    matches.reduce((total, match) => total + match.atsScore, 0) / matches.length,
  );

  return {
    metrics: [
      {
        label: "Match quality",
        value: `${averageFit}%`,
        delta: "+12 pts",
        description: "Average ranking across the recommended roles list.",
        trend: "up",
      },
      {
        label: "ATS readiness",
        value: `${averageAts}%`,
        delta: "+8 pts",
        description: "Parser-informed estimate of resume alignment for current roles.",
        trend: "up",
      },
      {
        label: "Active applications",
        value: String(pipeline.length).padStart(2, "0"),
        delta: "steady",
        description: "Items being tailored, sent, or prepared for interviews.",
        trend: "steady",
      },
    ],
    pipeline,
    matches,
    activities,
    recommendations,
    resumeProfile: profile,
  };
}
