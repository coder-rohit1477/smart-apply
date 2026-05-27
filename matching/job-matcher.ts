import { calculateAtsScore } from "@/ats/ats-scorer";
import type { JobRecord, MatchInsight, ResumeProfile } from "@/lib/types";
import { getKeywordOverlap } from "@/parser/resume-parser";

export function buildJobMatches(
  profile: ResumeProfile,
  jobs: JobRecord[],
): MatchInsight[] {
  return jobs
    .map((job) => {
      const overlap = getKeywordOverlap(profile, job.skills.map(skill => skill.name));
      const missingSkills = job.skills.filter(
        (skill) => !overlap.some((match) => match.toLowerCase() === skill.name.toLowerCase()),
      );
      const overlapRatio = overlap.length / job.skills.length;
      const seniorityBoost =
        profile.seniority === "Senior" || profile.seniority === "Lead" ? 12 : 4;
      const matchScore = Math.min(99, Math.round(overlapRatio * 78 + seniorityBoost));

      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: `${job.location} · ${job.schedule}`,
        salary: job.salary,
        summary: job.summary,
        matchScore,
        atsScore: calculateAtsScore(profile, job.skills.map(skill => skill.name)),
        missingSkills: missingSkills.slice(0, 3),
        stage: job.stage,
      } satisfies MatchInsight;
    })
    .sort((left, right) => right.matchScore - left.matchScore);
}
