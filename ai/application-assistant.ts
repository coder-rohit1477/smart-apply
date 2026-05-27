import type {
  AiRecommendation,
  MatchInsight,
  PipelineItem,
  ResumeProfile,
} from "@/lib/types";

export function buildAiRecommendations(
  profile: ResumeProfile,
  matches: MatchInsight[],
  pipeline: PipelineItem[],
): AiRecommendation[] {
  // Defensive checks and fallbacks
  const topMatch = matches[0];
  const firstGap = topMatch?.missingSkills[0] ?? "critical technical skills"; // More generic fallback
  const nextPipelineItem = pipeline[0];

  const safeCompany = topMatch?.company ?? "priority roles";
  const safeNextCompany = nextPipelineItem?.company ?? "current top";

  const safeStrength = profile.strengths.length > 0 ? profile.strengths[0].toLowerCase() : "your key strengths";

  // Graceful fallback for recommendations if no matches or pipeline items
  if (!topMatch && !nextPipelineItem) {
    return [
      {
        id: "general-advice",
        title: "Strengthen overall profile alignment",
        description:
          "Analyze job descriptions to identify common keywords and tailor your resume to highlight relevant experience and skills. This improves ATS compatibility and recruiter interest.",
        impact: "High impact",
      },
    ];
  }

  return [
    {
      id: "tailor-resume",
      title: `Tailor keywords for ${safeCompany}`,
      description: `Add stronger evidence for ${firstGap} and keep ${safeStrength} above the fold. This increases both ATS coverage and recruiter skim quality.`,
      impact: "High impact",
    },
    {
      id: "follow-up-sequence",
      title: "Schedule a proactive follow-up",
      description: `Create a follow-up message around the ${safeNextCompany} process so the application does not stall after submission.`,
      impact: "Medium impact",
    },
    {
      id: "interview-brief",
      title: "Prepare a project narrative pack",
      description:
        "Generate STAR-style stories tied to performance, cross-functional execution, and delivery outcomes before the interview loop starts.",
      impact: "High impact",
    },
  ];
}
