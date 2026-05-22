import { 
  generateStructuredContentWithFallback,
} from "../gemini";
import { 
  atsMatchResultSchema, 
  AtsMatchResult, 
  jdAnalysisSchema, 
  JdAnalysis,
} from "@/lib/matching/ats-engine";
import { createAtsMatchFallback } from "./ai-fallbacks";

const JD_ANALYSIS_PROMPT = `
ACT AS AN EXPERT RECRUITER. ANALYZE THE FOLLOWING JOB DESCRIPTION AND EXTRACT KEY REQUIREMENTS.

JOB DESCRIPTION:
{jobDescription}

---
RESPONSE FORMAT (JSON ONLY):
{
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "technologies": ["tech1", "tech2"],
  "experienceYears": number or null,
  "softSkills": ["skill1", "skill2"],
  "keyResponsibilities": ["task1", "task2"]
}
`;

const ATS_MATCH_PROMPT = `
ACT AS A SOPHISTICATED ATS (APPLICANT TRACKING SYSTEM) MATCHING ENGINE.
COMPARE THE RESUME AGAINST THE JOB DESCRIPTION ANALYSIS.

RESUME CONTENT:
{resumeText}

JOB ANALYSIS:
{jdAnalysis}

---
CRITICAL INSTRUCTIONS:
1. Semantic Similarity: How well does the overall profile match the intent of the job? (0-100)
2. Keyword Match: Check for exact and variant matches of skills/tech. (0-100)
3. Section Quality: Evaluate the clarity and impact of Summary, Experience, Skills, and Projects. (0-100 each)
4. Recruiter Readiness: How "hireable" does the candidate look for this specific role? (0-100)
5. Provide prioritized recommendations for improvement.

---
RESPONSE FORMAT (JSON ONLY):
{
  "overallScore": number,
  "semanticSimilarity": number,
  "keywordMatch": {
    "percentage": number,
    "matched": string[],
    "missing": string[]
  },
  "sectionQuality": {
    "summary": number,
    "experience": number,
    "skills": number,
    "projects": number
  },
  "recruiterReadiness": {
    "score": number,
    "pros": string[],
    "cons": string[]
  },
  "recommendations": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "title": "string",
      "suggestion": "string",
      "type": "KEYWORD" | "PHRASING" | "CONTENT" | "FORMATTING"
    }
  ]
}
`;

export async function analyzeJobDescription(jd: string): Promise<JdAnalysis> {
  const prompt = JD_ANALYSIS_PROMPT.replace("{jobDescription}", jd);
  const generation = await generateStructuredContentWithFallback<JdAnalysis>(prompt);
  return jdAnalysisSchema.parse(generation.data);
}

export async function performAtsMatch(resumeText: string, jd: string): Promise<AtsMatchResult> {
  try {
    const jdAnalysis = await analyzeJobDescription(jd);
    const prompt = ATS_MATCH_PROMPT
      .replace("{resumeText}", resumeText)
      .replace("{jdAnalysis}", JSON.stringify(jdAnalysis, null, 2));

    const generation = await generateStructuredContentWithFallback<AtsMatchResult>(prompt);
    return atsMatchResultSchema.parse(generation.data);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown ATS matching failure.";
    console.error("[ATS Service] Falling back to local ATS matcher", { reason });
    return createAtsMatchFallback(resumeText, jd, reason);
  }
}
