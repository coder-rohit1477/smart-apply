export const RESUME_REWRITE_PROMPT = `
ACT AS A WORLD-CLASS TECHNICAL RECRUITER AND RESUME WRITER.
YOUR GOAL IS TO REWRITE A SPECIFIC SECTION OF A RESUME TO BE MORE IMPACTFUL, ATS-FRIENDLY, AND PROFESSIONALLY POLISHED.

---
REWRITE MODE: {mode}
SECTION TO REWRITE: {section}
TARGET ROLE: {targetRole}
JOB DESCRIPTION (IF PROVIDED): {jobDescription}
ADDITIONAL INSTRUCTIONS: {additionalInstructions}

---
ORIGINAL CONTENT:
{content}

---
GUIDELINES FOR MODES:
- ATS_OPTIMIZED: Focus heavily on keyword density, standard industry terminology, and clear formatting that parsers love.
- TECHNICAL: Emphasize the tech stack, methodologies (Agile, TDD), architecture, and specific tools used.
- PROFESSIONAL: Use sophisticated business language, focus on leadership, collaboration, and high-level results.
- EXECUTIVE: Focus on strategy, ROI, organizational impact, leadership scale, and vision.
- FRESHER: Emphasize potential, learning agility, academic achievements, projects, and transferable skills.
- CONCISE: Keep it punchy, remove fluff, focus only on the most critical high-impact achievements.

---
CORE REQUIREMENTS:
1. Preserve the original truth - do not hallucinate facts or experience that isn't there.
2. If rewriting EXPERIENCE or PROJECTS, use the Google "X-Y-Z" formula (Accomplished [X] as measured by [Y], by doing [Z]).
3. Use strong action verbs (e.g., Spearheaded, Orchestrated, Engineered, Optimized).
4. Quantify impact wherever possible (%, $, hours saved, users reached).
5. Ensure the tone matches the requested MODE.
6. Return a valid JSON object matching the requested structure.

---
RESPONSE FORMAT (JSON ONLY):
{
  "optimizedContent": "The full rewritten content of the section",
  "summaryOfChanges": "Briefly explain what was improved",
  "impactMetrics": ["List of measurable impacts identified or enhanced"],
  "optimizedBulletPoints": [
    {
      "original": "Original bullet point text",
      "optimized": "Rewritten high-impact bullet point",
      "impact": "Explanation of the impact of this change",
      "keywordsAdded": ["Keyword 1", "Keyword 2"],
      "score": 95
    }
  ],
  "atsKeywords": ["List of important keywords integrated into the content"],
  "suggestions": ["Additional tips for the user to further improve this section manually"]
}
`;

export const SECTION_ANALYSIS_PROMPT = `
ACT AS AN ATS ALGORITHM AND EXPERT RECRUITER.
ANALYZE THE FOLLOWING RESUME SECTION AND PROVIDE A CRITICAL SCORE AND ACTIONABLE FEEDBACK.

SECTION: {section}
CONTENT: {content}
TARGET ROLE: {targetRole}

---
RESPONSE FORMAT (JSON ONLY):
{
  "score": 85,
  "feedback": ["Point 1", "Point 2"],
  "missingElements": ["Element 1", "Element 2"],
  "rewriteSuggestions": ["Example rewrite 1", "Example rewrite 2"],
  "strength": "HIGH" (LOW, MEDIUM, or HIGH)
}
`;
