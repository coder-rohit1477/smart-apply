export const FULL_RESUME_ANALYSIS_PROMPT = `
You are a senior technical recruiter and ATS (Applicant Tracking System) optimization expert.
Perform a comprehensive, professional-grade analysis of the following resume.

RESUME TEXT:
{resumeText}

{jobDescriptionInstruction}

---
CRITICAL INSTRUCTIONS:
1. ATS Score (0-100): Evaluate based on parser readability, keyword density, and structural integrity.
2. Section Scores: Provide individual scores for Summary, Experience, Projects, Skills, and Education.
3. Prioritized Actions: Identify the top 5 most impactful changes. For each, specify the "impact" (High/Medium), "type" (Formatting/Content/Keywords), and a clear "action" description.
4. Executive Summary: Write a high-level assessment of market readiness.
5. Upskilling: Suggest specific certifications or projects based on detected gaps.

---
RESPONSE FORMAT (JSON ONLY):
{
  "atsScore": number,
  "formattingScore": number,
  "impactScore": number,
  "readinessScore": number,
  "sectionScores": {
    "summary": number,
    "experience": number,
    "projects": number,
    "skills": number,
    "education": number
  },
  "prioritizedActions": [
    {
      "impact": "HIGH" | "MEDIUM",
      "type": "FORMATTING" | "CONTENT" | "KEYWORDS",
      "action": "string",
      "reason": "string"
    }
  ],
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[],
  "executiveSummary": string,
  "topThreeChanges": string[],
  "missingKeywords": string[],
  "matchedKeywords": string[],
  "technicalGaps": string[],
  "softSkillGaps": string[],
  "upskillingPlan": string[]
}
`;
