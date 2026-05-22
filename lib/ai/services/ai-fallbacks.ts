import type { FullResumeAnalysis } from "./ai-resume-service";
import type { JobMatchResult } from "./ai-job-match-service";
import type { AtsMatchResult } from "@/lib/matching/ats-engine";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "you",
  "your",
  "will",
  "this",
  "they",
  "their",
  "have",
  "has",
  "using",
  "use",
  "into",
  "than",
  "our",
  "about",
]);

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function extractKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();

  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function createResumeAnalysisFallback(
  resumeText: string,
  jobDescription: string | undefined,
  reason: string,
): FullResumeAnalysis {
  const normalizedResume = resumeText.toLowerCase();
  const normalizedJobDescription = jobDescription?.toLowerCase() ?? "";
  const expectedKeywords = extractKeywords(normalizedJobDescription, 12);
  const matchedKeywords = expectedKeywords.filter((keyword) =>
    normalizedResume.includes(keyword),
  );
  const missingKeywords = expectedKeywords
    .filter((keyword) => !normalizedResume.includes(keyword))
    .slice(0, 8);

  const hasExperienceSection = hasAny(normalizedResume, [/experience/, /employment/, /work history/]);
  const hasSkillsSection = hasAny(normalizedResume, [/skills/, /technologies/, /tooling/]);
  const hasEducationSection = hasAny(normalizedResume, [/education/, /university/, /college/]);
  const hasMetrics = /\b\d+[%+xkmb]?\b/.test(normalizedResume);
  const hasContactInfo = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/.test(normalizedResume);

  const strengths = unique(
    [
      hasExperienceSection ? "Includes an experience section that ATS systems can index." : "",
      hasSkillsSection ? "Lists explicit skills or technologies for keyword matching." : "",
      hasMetrics ? "Contains measurable outcomes that improve impact and credibility." : "",
      matchedKeywords.length > 0
        ? `Already aligns with ${matchedKeywords.length} important role keywords.`
        : "",
    ].filter(Boolean),
  );

  const weaknesses = unique(
    [
      !hasContactInfo ? "Contact details are incomplete or difficult to detect automatically." : "",
      !hasExperienceSection ? "A clear experience section is missing, which weakens ATS parsing." : "",
      !hasSkillsSection ? "A dedicated skills section is missing, reducing keyword coverage." : "",
      !hasMetrics ? "Achievement bullets need more numbers, percentages, or business outcomes." : "",
      missingKeywords.length > 0
        ? "Important job-description keywords are missing from the resume."
        : "",
    ].filter(Boolean),
  );

  const recommendations = unique(
    [
      "Use clear section headings such as Experience, Skills, Education, and Projects.",
      "Rewrite top bullets to include measurable outcomes, scope, and tools used.",
      missingKeywords[0]
        ? `Add missing role language like '${missingKeywords[0]}' where it truthfully applies.`
        : "Tailor the summary and skills section for the target role before applying.",
      "Keep formatting simple and ATS-friendly: standard fonts, consistent dates, and no tables.",
    ],
  ).slice(0, 4);

  const topThreeChanges = unique(
    [
      recommendations[0],
      recommendations[1],
      recommendations[2] ?? "Tailor the resume to the target job before applying.",
    ].filter(Boolean),
  ).slice(0, 3);

  const technicalGaps = missingKeywords.slice(0, 5);
  const softSkillGaps = normalizedJobDescription
    ? ["communication", "leadership", "collaboration", "ownership"].filter(
        (skill) =>
          normalizedJobDescription.includes(skill) && !normalizedResume.includes(skill),
      )
    : [];

  const baseAtsScore =
    45 +
    (hasContactInfo ? 10 : 0) +
    (hasExperienceSection ? 10 : 0) +
    (hasSkillsSection ? 10 : 0) +
    (hasEducationSection ? 5 : 0) +
    (hasMetrics ? 10 : 0) +
    matchedKeywords.length * 2 -
    missingKeywords.length * 2;

  const formattingScore =
    50 + (hasExperienceSection ? 10 : 0) + (hasSkillsSection ? 10 : 0) + (hasContactInfo ? 10 : 0);
  const impactScore = 45 + (hasMetrics ? 20 : 0) + matchedKeywords.length * 2;

  return {
    atsScore: clampScore(baseAtsScore),
    formattingScore: clampScore(formattingScore),
    impactScore: clampScore(impactScore),
    readinessScore: clampScore(baseAtsScore - missingKeywords.length * 2),
    sectionScores: {
      summary: clampScore(baseAtsScore - 5),
      experience: hasExperienceSection ? clampScore(baseAtsScore) : 30,
      projects: 50,
      skills: hasSkillsSection ? clampScore(baseAtsScore + 10) : 30,
      education: hasEducationSection ? 90 : 0,
    },
    prioritizedActions: [
      {
        impact: "HIGH",
        type: "CONTENT",
        action: "Quantify your achievements",
        reason: "Adding metrics like % or $ helps recruiters and ATS systems understand your value."
      },
      {
        impact: "MEDIUM",
        type: "KEYWORDS",
        action: `Add missing keywords: ${missingKeywords.slice(0, 3).join(", ")}`,
        reason: "These keywords are highly relevant to the job description."
      }
    ],
    strengths:
      strengths.length > 0
        ? strengths
        : ["Resume content is available, but the fallback analyzer could only produce limited insights."],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : ["Manual review is recommended because the AI response was unavailable."],
    recommendations,
    missingKeywords,
    matchedKeywords,
    technicalGaps,
    softSkillGaps,
    executiveSummary:
      `Gemini analysis was unavailable, so a resilient local fallback generated this review. ${reason}`,  
    topThreeChanges,
    upskillingPlan: unique(
      [
        technicalGaps[0]
          ? `Build a small project or case study that demonstrates ${technicalGaps[0]}.`
          : "Build one fresh project that matches the target role's tooling.",
        "Quantify outcomes in recent experience bullets with metrics and ownership.",
        "Tailor keywords and role language for each application before submitting.",
      ],
    ),
  };}

export function createJobMatchFallback(
  resumeText: string,
  jobDescription: string,
  reason: string,
): JobMatchResult {
  const resumeKeywords = extractKeywords(resumeText, 30);
  const jobKeywords = extractKeywords(jobDescription, 16);
  const matchedSkills = jobKeywords.filter((keyword) => resumeKeywords.includes(keyword));
  const missingSkills = jobKeywords.filter((keyword) => !resumeKeywords.includes(keyword)).slice(0, 8);

  const coverage = jobKeywords.length === 0 ? 0.5 : matchedSkills.length / jobKeywords.length;
  const matchScore = clampScore(45 + coverage * 45 - missingSkills.length);

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    recommendation:
      matchScore >= 75
        ? "Strong base fit. Tailor bullets and keywords before applying."
        : "Moderate fit. Close the missing-skill gaps and align the summary to the role.",
    reasoning:
      `Gemini matching was unavailable, so this score uses keyword overlap as a safe fallback. ${reason}`,
  };
}

export function createAtsMatchFallback(
  resumeText: string,
  jobDescription: string,
  reason: string,
): AtsMatchResult {
  const resumeKeywords = extractKeywords(resumeText, 40);
  const jobKeywords = extractKeywords(jobDescription, 20);
  const matched = jobKeywords.filter((keyword) => resumeKeywords.includes(keyword));
  const missing = jobKeywords.filter((keyword) => !resumeKeywords.includes(keyword)).slice(0, 10);
  const keywordPercentage =
    jobKeywords.length === 0 ? 50 : clampScore((matched.length / jobKeywords.length) * 100);
  const semanticSimilarity = clampScore(40 + keywordPercentage * 0.45);
  const qualityScore = clampScore(55 + matched.length * 3 - missing.length * 2);
  const readinessScore = clampScore(45 + keywordPercentage * 0.4);
  const overallScore = clampScore(
    semanticSimilarity * 0.35 +
      keywordPercentage * 0.35 +
      readinessScore * 0.2 +
      qualityScore * 0.1,
  );

  return {
    overallScore,
    semanticSimilarity,
    keywordMatch: {
      percentage: keywordPercentage,
      matched,
      missing,
    },
    sectionQuality: {
      summary: qualityScore,
      experience: clampScore(qualityScore + 5),
      skills: clampScore(keywordPercentage + 10),
      projects: clampScore(qualityScore - 5),
    },
    recruiterReadiness: {
      score: readinessScore,
      pros:
        matched.length > 0
          ? [`Resume already matches keywords like ${matched.slice(0, 3).join(", ")}.`]
          : ["Resume has some reusable baseline content but needs role-specific tailoring."],
      cons:
        missing.length > 0
          ? [`Important keywords are still missing: ${missing.slice(0, 3).join(", ")}.`]
          : ["Additional tailoring could improve alignment."],
    },
    recommendations: [
      {
        priority: "HIGH",
        title: "Add missing role language",
        suggestion:
          missing.length > 0
            ? `Integrate terms like ${missing.slice(0, 3).join(", ")} where they are true and supported by experience.`
            : "Align the summary and key bullets more tightly to the target role.",
        type: "KEYWORD",
      },
      {
        priority: "MEDIUM",
        title: "Quantify achievements",
        suggestion: "Add measurable outcomes to recent bullets to increase recruiter confidence.",
        type: "CONTENT",
      },
      {
        priority: "LOW",
        title: "Keep formatting ATS-safe",
        suggestion: `Fallback ATS analysis was used because Gemini was unavailable. ${reason}`,
        type: "FORMATTING",
      },
    ],
  };
}
