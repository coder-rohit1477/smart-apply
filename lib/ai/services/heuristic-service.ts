import type { FullResumeAnalysis } from "./ai-resume-service";
import type { JobMatchResult } from "./ai-job-match-service";
import type { AtsMatchResult } from "@/lib/matching/ats-engine";
import type { KeywordExtraction, KeywordComparison } from "./keyword-optimizer-service";
import type { RewriteResponse, SectionAnalysis } from "@/types/rewrite";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "with", "you", "your", "will", "this", "they", "their", "have", "has", "using", "use", "into", "than", "our", "about", "managed", "responsible", "worked", "duties", "including", "developed", "led", "assisted", "helped", "made", "created", "performed", "participated", "supported", "worked on"
]);

const ACTION_VERBS = new Set([
  "orchestrated", "engineered", "scaled", "led", "developed", "implemented", "optimized", "spearheaded", "designed", "managed",
  "architected", "automated", "mentored", "delivered", "negotiated", "executed", "transformed", "modernized", "pioneered", "integrated",
  "authored", "accelerated", "accomplished", "achieved", "attained", "budgeted", "clarified", "conceptualized", "consolidated", "delegated"
]);

const TECH_KEYWORDS = new Set([
  "react", "node", "python", "java", "aws", "azure", "docker", "kubernetes", "sql", "typescript", "javascript", "c++", "rust", "go", "swift",
  "cloud", "api", "rest", "graphql", "microservices", "frontend", "backend", "fullstack", "devops", "agile", "scrum", "ci/cd", "terraform",
  "next.js", "tailwind", "prisma", "mongodb", "postgresql", "redis", "elasticsearch", "kafka", "rabbitmq"
]);

const EXECUTIVE_KEYWORDS = new Set([
  "revenue", "strategy", "growth", "leadership", "stakeholder", "vision", "p&l", "budget", "operations", "transformation", "executive", "board", "partnership", "ma", "mergers", "acquisitions", "cost-savings", "efficiency", "roi", "strategic"
]);

const TECHNICAL_KEYWORDS = new Set([
  "architecture", "system", "performance", "optimization", "infrastructure", "scalability", "distributed", "security", "latency", "throughput", "concurrency", "algorithm", "database", "api", "integration", "deployment", "automation", "framework", "library", "stack", "middleware", "microservices", "event-driven", "idempotency", "caching", "design patterns", "refactoring", "observability", "monitoring", "vector", "embeddings", "rag", "pipeline", "etl", "scraping", "parsing", "schema", "validation", "middleware", "orchestration"
]);

const ENGINEERING_DEPTH_KEYWORDS = new Set([
  "orchestration", "distributed", "scalability", "concurrency", "latency", "idempotency", "throughput", "observability", "sharding", "replication", "event-driven", "async", "background jobs", "retry handling", "circuit breaker", "rate limiting", "caching", "architecture", "system design", "load balancing", "failover", "atomic", "vector database", "rag", "embeddings", "semantic search", "indexing", "parsing engine", "rule engine", "workflow automation"
]);

const SEMANTIC_GROUPS: Record<string, string[]> = {
  "ats": ["ats", "applicant tracking system", "resume optimization", "parser", "hiring engine", "matching engine"],
  "backend": ["backend", "server-side", "api development", "rest api", "restful", "graphql", "microservices", "web services"],
  "auth": ["auth", "authentication", "authorization", "jwt", "oauth", "sso", "security", "clerk", "passport"],
  "automation": ["automation", "playwright", "puppeteer", "selenium", "scraping", "crawler", "browser automation", "testing"],
  "cloud": ["aws", "azure", "gcp", "cloud", "serverless", "lambda", "s3", "ec2", "infrastructure"],
  "devops": ["ci/cd", "pipeline", "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "github actions"],
  "database": ["database", "sql", "postgresql", "postgres", "mysql", "mongodb", "nosql", "prisma", "orm", "redis", "elasticsearch"],
  "frontend": ["frontend", "client-side", "ui", "ux", "react", "next.js", "typescript", "javascript", "tailwind", "css"],
  "state_management": ["redux", "zustand", "context api", "state management", "query"],
};

function findSynonyms(keyword: string): string[] {
  const k = keyword.toLowerCase();
  for (const group of Object.values(SEMANTIC_GROUPS)) {
    if (group.some(syn => syn.includes(k) || k.includes(syn))) {
      return group;
    }
  }
  return [k];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
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

/**
 * Advanced Heuristic Analyzer
 */
export function analyzeContentHeuristics(content: string, jobDescription: string = "") {
  const normalized = content.toLowerCase();
  const tokens = tokenize(content);
  const wordCount = tokens.length;
  
  // Detect Metrics (Numbers with context)
  const metrics = content.match(/\b\d+[%+xkmb]?\b/g) || [];
  
  // Detect Action Verbs
  const detectedVerbs = tokens.filter(t => ACTION_VERBS.has(t));
  const uniqueVerbs = unique(detectedVerbs);
  
  // Detect Technologies
  const detectedTech = tokens.filter(t => TECH_KEYWORDS.has(t));
  const uniqueTech = unique(detectedTech);

  // Detect Executive Phrasing
  const executiveMatch = tokens.filter(t => EXECUTIVE_KEYWORDS.has(t));
  const uniqueExecutive = unique(executiveMatch);

  // Detect Technical Phrasing
  const technicalMatch = tokens.filter(t => TECHNICAL_KEYWORDS.has(t));
  const uniqueTechnical = unique(technicalMatch);

  // Detect Engineering Depth
  const engineeringDepthMatch = tokens.filter(t => ENGINEERING_DEPTH_KEYWORDS.has(t));
  const uniqueEngineeringDepth = unique(engineeringDepthMatch);

  // Cross-reference with JD if provided
  const jdTokens = tokenize(jobDescription);
  const jdTech = jdTokens.filter(t => TECH_KEYWORDS.has(t));
  const matchedTech = uniqueTech.filter(t => jdTech.includes(t));
  
  return {
    wordCount,
    metricsCount: metrics.length,
    hasStrongMetrics: metrics.length > 3,
    verbDensity: uniqueVerbs.length / (wordCount || 1),
    uniqueVerbs,
    uniqueTech,
    uniqueExecutive,
    uniqueTechnical,
    uniqueEngineeringDepth,
    matchedTech,
    contentDepth: wordCount > 250 ? "high" : wordCount > 100 ? "medium" : "low" as const
  };
}

export function calculateLocalResumeAnalysis(
  resumeText: string,
  jobDescription?: string,
): FullResumeAnalysis {
  const h = analyzeContentHeuristics(resumeText, jobDescription || "");
  const normalizedResume = resumeText.toLowerCase();
  
  // Intelligence Gathering
  const expectedKeywords = extractKeywords(jobDescription || "", 15);
  const matchedKeywords = expectedKeywords.filter((keyword) =>
    normalizedResume.includes(keyword),
  );
  const missingKeywords = expectedKeywords
    .filter((keyword) => !normalizedResume.includes(keyword))
    .slice(0, 8);

  const hasExperienceSection = hasAny(normalizedResume, [/experience/, /employment/, /work history/, /professional background/]);
  const hasSkillsSection = hasAny(normalizedResume, [/skills/, /technologies/, /tooling/, /competencies/]);
  const hasEducationSection = hasAny(normalizedResume, [/education/, /university/, /college/]);
  const hasProjectsSection = hasAny(normalizedResume, [/projects/, /portfolio/, /technical projects/]);
  
  // Dynamic Scoring - Recruiter Reality Focus
  // Students/Freshers often have Projects instead of formal Experience.
  // If they have EITHER Experience OR Projects, AND Skills, the baseline is high.
  const hasCoreStructure = (hasExperienceSection || hasProjectsSection) && hasSkillsSection;
  const baseBaseline = hasCoreStructure ? 72 : 55;
  
  const baseAtsScore = baseBaseline 
    + (matchedKeywords.length * 1.5) 
    + (h.matchedTech.length * 2.5) 
    + (h.uniqueEngineeringDepth.length * 4)
    + (h.uniqueTechnical.length * 1.5)
    - (missingKeywords.length * 0.3);

  const formattingScore = 80 
    + (hasExperienceSection ? 10 : 0) 
    + (hasSkillsSection ? 10 : 0) 
    + (hasProjectsSection ? 5 : 0);

  const impactScore = 60 
    + (h.metricsCount * 5) 
    + (h.uniqueVerbs.length * 2)
    + (h.hasStrongMetrics ? 10 : 0)
    + (h.uniqueEngineeringDepth.length > 0 ? 5 : 0);

  const readinessScore = (baseAtsScore * 0.65 + impactScore * 0.35);

  const strengths = unique([
    h.uniqueEngineeringDepth.length > 2 ? `Exceptional engineering depth with focus on ${h.uniqueEngineeringDepth.slice(0, 2).join(" and ")}.` : null,
    h.uniqueTech.length > 8 ? `Strong technical stack versatility including ${h.uniqueTech.slice(0, 3).join(", ")}.` : "Consistent use of industry-standard technical terminology.",
    h.hasStrongMetrics ? "Excellent quantification of business impact and achievements." : "Professional description of roles and responsibilities.",
    h.uniqueVerbs.length > 5 ? "Action-oriented language demonstrates strong ownership and delivery." : "Clean, structured section formatting.",
  ].filter((s): s is string => s !== null)).slice(0, 3);

  let areasForImprovement = unique([
    h.metricsCount < 2 ? "Lacks quantifiable results; add more data points to experience bullets." : "",
    h.contentDepth === "low" ? "Content density is thin; expand on key project implementations." : "",
    missingKeywords.length > 6 ? "Significant keyword gaps identified relative to target role." : "",
    !hasSkillsSection ? "Missing a dedicated technical skills matrix for faster indexing." : "",
  ].filter(Boolean)).slice(0, 3);

  // ENSURE: Areas for improvement are never empty
  if (areasForImprovement.length === 0) {
    areasForImprovement = [
      "Add more quantifiable achievements",
      "Improve keyword alignment with target role",
      "Include more measurable impact metrics",
      "Strengthen technical terminology",
    ];
  }

  let recommendations = [
    h.metricsCount < 3 ? "Transform 'Responsibilities' into 'Achievements' by adding measurable outcomes." : "Refine existing metrics to focus on bottom-line business value.",
    `Integrate core keywords like '${missingKeywords[0] || 'industry-specific terms'}' to improve ATS ranking.`,
    h.uniqueVerbs.length < 5 ? "Use more impactful verbs (Spearheaded, Architected) to lead your bullet points." : "Review bullet points for maximum impact and clarity.",
    "Ensure your summary leads with your most relevant technical certification or achievement."
  ];

  // ENSURE: Recommendations are never empty
  if (recommendations.length === 0) {
    recommendations = [
      "Add more quantifiable achievements with specific metrics.",
      "Improve keyword alignment with industry-standard roles.",
      "Include more measurable impact metrics in your experience section.",
      "Strengthen technical terminology across all sections."
    ];
  }

  return {
    atsScore: clampScore(baseAtsScore),
    formattingScore: clampScore(formattingScore),
    impactScore: clampScore(impactScore),
    readinessScore: clampScore(readinessScore),
    sectionScores: {
      summary: clampScore(baseAtsScore - 5),
      experience: hasExperienceSection ? clampScore(baseAtsScore + 5) : 30,
      projects: hasProjectsSection ? clampScore(impactScore + 10) : 40,
      skills: hasSkillsSection ? clampScore(baseAtsScore + 15) : 35,
      education: hasEducationSection ? 95 : 0,
    },
    prioritizedActions: [
      {
        impact: "HIGH" as const,
        type: "KEYWORDS" as const,
        action: `Add ${missingKeywords.slice(0, 2).join(", ")} to your skills section`,
        reason: "These are primary requirements that are currently missing from your profile."
      },
      {
        impact: "MEDIUM" as const,
        type: "CONTENT" as const,
        action: "Quantify 2 additional experience bullets",
        reason: "Adding specific metrics increases recruiter trust in your reported skill level."
      }
    ],
    strengths,
    weaknesses: areasForImprovement,
    recommendations,
    missingKeywords,
    matchedKeywords,
    technicalGaps: missingKeywords.slice(0, 5),
    softSkillGaps: ["Leadership", "Stakeholder Management", "Agile Collaboration"].filter(s => !normalizedResume.includes(s.toLowerCase())).slice(0, 3),
    executiveSummary: `Heuristic analysis complete. Your profile shows a ${h.contentDepth} depth of content with ${h.uniqueTech.length} technical competencies identified. ${h.hasStrongMetrics ? 'High' : 'Moderate'} achievement density was detected.`,
    topThreeChanges: recommendations.slice(0, 3),
    upskillingPlan: [
      `Deepen expertise in ${missingKeywords[0] || 'emerging industry tools'} through hands-on projects.`,
      "Adopt the STAR method for all experience descriptions.",
      "Synchronize your technical skills list with the latest industry standards."
    ],
  };
}

export function calculateLocalJobMatch(
  resumeText: string,
  jobDescription: string,
  mode: string = "General"
): JobMatchResult {
  const h = analyzeContentHeuristics(resumeText, jobDescription);
  const rawExpected = extractKeywords(jobDescription, 20);
  
  const { matched, missing } = checkSemanticMatch(resumeText, rawExpected);
  
  const keywordPercentage = clampScore((matched.length / (rawExpected.length || 1)) * 100);
  const normalizedMode = mode.toLowerCase();
  
  // Recruiter Match Scoring with Mode Awareness
  const baseMatch = 45;
  let keywordWeight = 30;
  let depthWeight = 10;
  let techWeight = 15;

  if (normalizedMode === "ats") {
    keywordWeight = 45;
    depthWeight = 5;
    techWeight = 5;
  } else if (normalizedMode === "technical") {
    keywordWeight = 15;
    depthWeight = 25;
    techWeight = 15;
  } else if (normalizedMode === "leadership") {
    keywordWeight = 20;
    depthWeight = 10;
    techWeight = 5;
    // Add ownership bonus for leadership
    const ownershipBonus = Math.min(20, h.uniqueVerbs.length * 2 + h.uniqueExecutive.length * 5);
    return {
      matchScore: clampScore(baseMatch + (keywordPercentage / 100) * keywordWeight + Math.min(techWeight, h.matchedTech.length * 3) + Math.min(depthWeight, h.uniqueEngineeringDepth.length * 3) + ownershipBonus),
      matchedSkills: matched,
      missingSkills: missing.slice(0, 8),
      recommendation: "Leadership profile assessment complete. Focus on demonstrated ownership and strategic impact.",
      reasoning: `Matched ${matched.length} semantic keys. Ownership density is ${h.uniqueExecutive.length > 2 ? 'high' : 'moderate'}.`,
    };
  }

  const keywordContribution = (keywordPercentage / 100) * keywordWeight;
  const techAlignmentContribution = Math.min(techWeight, h.matchedTech.length * 3);
  const depthContribution = Math.min(depthWeight, h.uniqueEngineeringDepth.length * 3);
  
  const score = clampScore(baseMatch + keywordContribution + techAlignmentContribution + depthContribution);

  return {
    matchScore: score,
    matchedSkills: matched,
    missingSkills: missing.slice(0, 8),
    recommendation: score > 85 
      ? "Exceptional fit. You meet all primary technical requirements and demonstrate significant depth. Apply immediately." 
      : score > 70 
        ? "Strong candidate. You have the core stack and relevant experience. Light tailoring of your projects section is recommended." 
        : "Potential match. Consider highlighting equivalent skills or closing technical gaps in your summary before applying.",
    reasoning: `Identified ${matched.length} semantic keyword matches and ${h.matchedTech.length} direct technical alignments. Your profile shows ${h.uniqueEngineeringDepth.length > 2 ? 'significant' : 'moderate'} engineering depth with ${h.metricsCount} substantiating metrics.`,
  };
}

function checkSemanticMatch(text: string, keywords: string[]): { matched: string[], missing: string[] } {
  const normalized = text.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    const synonyms = findSynonyms(kw);
    if (synonyms.some(syn => normalized.includes(syn.toLowerCase()))) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  return { matched, missing };
}

export function calculateLocalAtsMatch(
  resumeText: string,
  jobDescription: string,
  mode: string = "General"
): AtsMatchResult {
  const h = analyzeContentHeuristics(resumeText, jobDescription);
  const rawExpected = extractKeywords(jobDescription, 20);
  
  const { matched, missing } = checkSemanticMatch(resumeText, rawExpected);
  
  const keywordPercentage = clampScore((matched.length / (rawExpected.length || 1)) * 100);
  const normalizedMode = mode.toLowerCase();
  
  // Recruiter-Realistic Scoring with Mode Awareness
  // Baseline is higher to avoid unrealistically low scores for structured resumes
  let baseline = 70; 
  let keywordMax = 15;
  let depthMax = 10;
  let metricMax = 5;

  if (normalizedMode === "technical") {
    baseline = 72;
    keywordMax = 10;
    depthMax = 15;
    metricMax = 3;
  } else if (normalizedMode === "ats") {
    baseline = 65;
    keywordMax = 25;
    depthMax = 5;
    metricMax = 5;
  } else if (normalizedMode === "leadership") {
    baseline = 70;
    keywordMax = 10;
    depthMax = 5;
    metricMax = 15; // Focus on business metrics
  }
  
  const keywordWeight = (keywordPercentage / 100) * keywordMax;
  const depthBonus = Math.min(depthMax, h.uniqueEngineeringDepth.length * (depthMax / 4));
  const metricBonus = h.hasStrongMetrics ? metricMax : Math.min(metricMax * 0.7, h.metricsCount * 1);
  
  const overallScore = clampScore(baseline + keywordWeight + depthBonus + metricBonus);

  return {
    overallScore,
    semanticSimilarity: clampScore(overallScore - 3),
    keywordMatch: {
      percentage: keywordPercentage,
      matched,
      missing: missing.slice(0, 10),
    },
    sectionQuality: {
      summary: clampScore(overallScore - 2),
      experience: clampScore(overallScore + 2),
      skills: clampScore(keywordPercentage + 10),
      projects: clampScore(baseline + depthBonus + 5),
    },
    recruiterReadiness: {
      score: clampScore(overallScore + 2),
      pros: [
        h.uniqueEngineeringDepth.length > 2 ? `Demonstrates significant engineering depth in ${h.uniqueEngineeringDepth.slice(0, 2).join(" and ")}.` : null,
        `Strong alignment with ${matched.length} key industry competencies.`,
        h.hasStrongMetrics ? "Quantifiable achievements provide strong evidence of impact." : "Consistent professional formatting and technical clarity.",
        h.uniqueVerbs.length > 5 ? "Strong action-oriented phrasing conveys ownership." : null,
      ].filter((p): p is string => p !== null),
      cons: [
        missing.length > 5 ? `Missing several role-specific semantic markers like ${missing.slice(0, 2).join(", ")}.` : null,
        h.metricsCount < 2 ? "Could benefit from more specific data points to substantiate claims." : null,
        h.uniqueEngineeringDepth.length < 2 ? "Engineering depth could be more explicitly stated in core projects." : null,
      ].filter((c): c is string => c !== null),
    },
    recommendations: [
      {
        priority: (missing.length > 4 ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
        title: "Strengthen Semantic Alignment",
        suggestion: `Integrate terms related to ${missing.slice(0, 2).join(" and ")} to improve recruiter indexing.`,
        type: "KEYWORD" as const,
      },
      {
        priority: (h.metricsCount < 3 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
        title: "Substantiate Achievements",
        suggestion: "Ensure every major project includes at least one measurable outcome or metric.",
        type: "CONTENT" as const,
      }
    ],
  };
}

export function calculateLocalKeywordExtraction(jobDescription: string): KeywordExtraction {
  const h = analyzeContentHeuristics(jobDescription);
  const critical = extractKeywords(jobDescription, 12);

  return {
    criticalKeywords: critical,
    softSkills: ["Leadership", "Communication", "Problem Solving", "Mentorship", "Ownership"],
    toolsAndTechnologies: h.uniqueTech.slice(0, 10),
    industryTerms: ["Agile", "Scrum", "CI/CD", "Cloud Computing", "Architecture"],
  };
}

export function calculateLocalKeywordComparison(resumeText: string, jobKeywords: KeywordExtraction): KeywordComparison {
  const normalized = resumeText.toLowerCase();
  const allKeywords = [...jobKeywords.criticalKeywords, ...jobKeywords.toolsAndTechnologies];
  const foundKeywords = allKeywords.filter(k => normalized.includes(k.toLowerCase()));
  const missingKeywords = allKeywords.filter(k => !normalized.includes(k.toLowerCase())).slice(0, 10);
  
  const score = (foundKeywords.length / (allKeywords.length || 1)) * 100;

  return {
    foundKeywords: unique(foundKeywords),
    missingKeywords: unique(missingKeywords),
    optimizationTips: [
      `Your profile is missing ${missingKeywords.length} key technical terms.`,
      "Add missing keywords naturally into your most recent experience section.",
      "Ensure your skills matrix includes all the technologies mentioned in the JD."
    ],
    keywordDensityScore: clampScore(score)
  };
}

export function calculateLocalSectionAnalysis(section: string, content: string, mode: string = "Professional"): SectionAnalysis {
  const h = analyzeContentHeuristics(content);
  
  let score = 40; // Base score
  let feedback: string[] = [];
  let missingElements: string[] = [];
  let rewriteSuggestions: string[] = [];

  const normalizedMode = mode.toLowerCase();

  // Common feedback based on general heuristics
  if (h.metricsCount === 0) {
    feedback.push("Section lacks quantifiable achievements. Add numbers, percentages, or dollar values.");
    missingElements.push("Quantifiable achievements");
    rewriteSuggestions.push("Transform responsibilities into achievements by adding measurable outcomes.");
  } else if (h.metricsCount < 3) {
    feedback.push("Could use more specific metrics to strengthen impact.");
    rewriteSuggestions.push("Refine existing metrics to focus on bottom-line business value.");
  }

  if (h.uniqueVerbs.length < 5) {
    feedback.push("Increase action verb diversity for a more dynamic read.");
    rewriteSuggestions.push("Start bullet points with stronger, unique action verbs.");
  }

  if (h.wordCount < 50 && normalizedMode !== "concise") {
    feedback.push("Content appears brief; consider expanding on key contributions.");
    missingElements.push("Detailed context for contributions");
  }

  // Mode-specific scoring and feedback
  if (normalizedMode === "technical") {
    score += clampScore(h.uniqueTechnical.length * 5 + h.uniqueTech.length * 3);
    feedback.push(`Technical depth detected: ${h.uniqueTechnical.length} specific terms, ${h.uniqueTech.length} general tech.`);
    if (h.uniqueTechnical.length < 3) {
      feedback.push("Add more deep-technical architectural terminology.");
      missingElements.push("System design or architecture mentions");
    } else {
      feedback.push("Excellent use of technical and architectural keywords.");
    }
    rewriteSuggestions.push("Describe the specific stack and trade-offs made in this implementation.");
  } 
  else if (normalizedMode === "ats") {
    score += clampScore(h.uniqueTech.length * 4 + h.uniqueVerbs.length * 4);
    feedback.push(`ATS readiness: ${h.uniqueVerbs.length} action verbs, ${h.uniqueTech.length} tech keywords.`);
    if (h.uniqueVerbs.length < 4) {
      feedback.push("Increase action verb density for better ATS indexing.");
      missingElements.push("Diverse industry-standard action verbs");
    } else {
      feedback.push("Strong keyword and action verb coverage for ATS optimization.");
    }
    rewriteSuggestions.push("Ensure your primary technical skills are mentioned in the first two bullets.");
  }
  else if (normalizedMode === "executive") {
    score += clampScore(h.uniqueExecutive.length * 8 + (h.metricsCount > 2 ? 20 : 0));
    feedback.push(`Executive presence: ${h.uniqueExecutive.length} leadership terms. Metrics: ${h.metricsCount}.`);
    if (h.uniqueExecutive.length < 2) {
      feedback.push("Lacks strategic and leadership-focused terminology.");
      missingElements.push("Business impact or strategic ownership keywords");
    } else {
      feedback.push("Strategic impact and leadership presence are well-communicated.");
    }
    if (!h.hasStrongMetrics) {
      feedback.push("Executive summaries require more P&L or ROI-focused metrics.");
      missingElements.push("Quantifiable business ROI");
    }
    rewriteSuggestions.push("Focus on the 'Why' and the business outcome rather than just the 'What'.");
  }
  else if (normalizedMode === "concise") {
    score = h.wordCount < 60 ? 90 : h.wordCount < 100 ? 75 : 50;
    feedback.push(`Word count: ${h.wordCount}. Aim for high-impact brevity.`);
    if (h.wordCount > 100) {
      feedback.push("Content is too wordy for a concise profile; aim for high-impact brevity.");
      missingElements.push("Compact phrasing");
    } else {
      feedback.push("Excellent brevity and impact-to-word ratio.");
    }
    rewriteSuggestions.push("Remove filler words and combine overlapping bullet points.");
  }
  else { // Professional / Default
    score += clampScore(h.uniqueVerbs.length * 5 + (h.metricsCount > 0 ? 15 : 0) + (h.wordCount > 50 ? 15 : 0));
    feedback.push(h.wordCount > 80 ? "Well-balanced professional overview." : "Provide more context for a standard professional audience.");
    if (h.metricsCount === 0) missingElements.push("Quantifiable achievements");
    rewriteSuggestions.push("Ensure a consistent professional tone throughout the section.");
  }

  // Ensure arrays are unique and not empty
  feedback = unique(feedback).filter(Boolean);
  missingElements = unique(missingElements).filter(Boolean);
  rewriteSuggestions = unique(rewriteSuggestions).filter(Boolean);

  if (feedback.length === 0) feedback.push("Good general structure and content detected.");
  if (missingElements.length === 0) missingElements.push("No critical missing elements identified.");
  if (rewriteSuggestions.length === 0) rewriteSuggestions.push("Review for minor phrasing improvements.");


  return {
    score: clampScore(score),
    feedback,
    missingElements,
    rewriteSuggestions,
    strength: (score > 80 ? "HIGH" : score > 55 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW"
  };
}

const WEAK_TO_STRONG_VERBS: Record<string, string> = {
  "developed": "engineered",
  "created": "architected",
  "led": "orchestrated",
  "managed": "spearheaded",
  "worked on": "implemented",
  "assisted": "facilitated",
  "helped": "supported",
  "made": "generated",
  "performed": "executed",
  "participated": "contributed",
  "supported": "championed",
};

/**
 * Rewrites a single bullet point based on mode and heuristic analysis.
 * @param bullet The original bullet point string.
 * @param mode The optimization mode (e.g., "technical", "ats", "professional").
 * @param h Heuristic analysis results for the content.
 * @param jobDescriptionKeywords Optional keywords from the job description for ATS injection.
 * @returns The rewritten bullet point and a list of changes made.
 */
function rewriteBullet(
  bullet: string,
  mode: string,
  h: ReturnType<typeof analyzeContentHeuristics>,
  jobDescriptionKeywords: string[] = []
): { rewrittenBullet: string; changes: string[] } {
  let rewritten = bullet;
  const changes: string[] = [];
  const normalizedMode = mode.toLowerCase();

  // 1. Verb Strengthening
  let verbReplaced = false;
  for (const [weak, strong] of Object.entries(WEAK_TO_STRONG_VERBS)) {
    // Only replace if the weak verb is at the start of the bullet or after specific punctuation/space
    const regex = new RegExp(`^(${weak})\\b|\\s(${weak})\\b`, 'gi');
    if (regex.test(rewritten)) {
      rewritten = rewritten.replace(regex, (match, p1, p2) => {
        if (p1) { // Matched at the start
          return strong.charAt(0).toUpperCase() + strong.slice(1);
        } else if (p2) { // Matched with leading space
          return ` ${strong}`;
        }
        return match; // Should not happen
      });
      changes.push(`Strengthened verb: "${weak}" to "${strong}"`);
      verbReplaced = true;
      break; // Only replace one major verb per bullet for simplicity
    }
  }
  // If no explicit weak verb was replaced, but the bullet starts with a common non-action verb, suggest it.
  // Use raw first word instead of tokenize (which filters stop words) to better detect leading weak words.
  const rawFirstWord = (bullet || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  if (!verbReplaced && rawFirstWord && !ACTION_VERBS.has(rawFirstWord) && STOP_WORDS.has(rawFirstWord)) {
    changes.push(`Consider starting "${rawFirstWord}" with a stronger action verb.`);
  }


  // 2. Keyword Injection (ATS mode) - simple injection if missing and relevant
  if (normalizedMode === "ats" && jobDescriptionKeywords.length > 0) {
    const bulletTokens = tokenize(rewritten);
    const missingRelevantKeywords = jobDescriptionKeywords.filter(
      (kw) => !bulletTokens.some((token) => token.includes(kw.toLowerCase()))
    );

    if (missingRelevantKeywords.length > 0) {
      const keywordToInject = missingRelevantKeywords[0]; // Inject one for simplicity
      // Attempt to inject naturally, e.g., before or after a relevant noun
      const lowerRewritten = rewritten.toLowerCase();
      let injected = false;

      // Try to inject near existing relevant words or at natural breaking points
      const insertionPoints = [
        lowerRewritten.indexOf("using "),
        lowerRewritten.indexOf("with "),
        lowerRewritten.indexOf("in "),
        lowerRewritten.indexOf("for "),
      ];

      for (const insertionPoint of insertionPoints) {
        if (insertionPoint !== -1) {
          rewritten = rewritten.substring(0, insertionPoint) + ` ${keywordToInject} ` + rewritten.substring(insertionPoint);
          injected = true;
          break;
        }
      }

      if (!injected) {
        // Simple append if no natural place found
        rewritten = `${rewritten}. Leveraging ${keywordToInject}.`;
      }
      changes.push(`Injected ATS keyword: "${keywordToInject}"`);
    }
  }

  // 3. Mode-specific enhancements (simplified)
  if (normalizedMode === "technical") {
    const techToInject = h.uniqueTech.filter(tech => !rewritten.toLowerCase().includes(tech.toLowerCase()));
    if (techToInject.length > 0) {
        rewritten = `${rewritten} utilizing ${techToInject[0]}.`;
        changes.push(`Enhanced technical specificity with "${techToInject[0]}"`);
    }
  } else if (normalizedMode === "executive") {
    if (h.metricsCount === 0 && bullet.match(/\b(improved|increased|reduced|achieved|delivered)\b/i)) {
      rewritten = rewritten.replace(/\b(improved|increased|reduced|achieved|delivered)\b/i, "$1 by [X%]");
      changes.push("Added metric placeholder for impact.");
    }
  } else if (normalizedMode === "concise") {
    if (rewritten.split(' ').length > 20) { // Slightly longer limit for more practical conciseness
      rewritten = rewritten.split(' ').slice(0, 18).join(' ') + '...';
      changes.push("Shortened for conciseness.");
    }
  }

  // Ensure bullet starts with an uppercase letter
  rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);

  return { rewrittenBullet: rewritten, changes };
}

export function calculateLocalSectionRewrite(
  content: string,
  mode: string,
  jobDescriptionKeywords: string[] = [] // New parameter
): RewriteResponse {
  const h = analyzeContentHeuristics(content);
  const normalizedMode = mode.toLowerCase();
  
 const originalBulletPoints = content
  .split(/\n+/)
  .filter((line) => line.trim().length > 0);
  const optimizedBulletPoints: {
  original: string;
  optimized: string;
  impact: string;
  keywordsAdded: string[];
  score: number;
}[] = [];
  const changesLog: string[] = []; // Collect all individual changes

  // Track specific types of changes for summary
  const atsKeywordsInjected: string[] = [];
  let metricPlaceholdersAddedCount = 0;
  let strongVerbsUsedCount = 0;
  let technicalEnhancementsCount = 0;
  let concisenessEnhancementsCount = 0;
  const suggestions: string[] = []; // Collect general suggestions

  for (const bullet of originalBulletPoints) {
    const { rewrittenBullet, changes } = rewriteBullet(bullet, mode, h, jobDescriptionKeywords);
    optimizedBulletPoints.push({
  original: bullet,
  optimized: rewrittenBullet,
  impact: (changes.length > 2 ? "HIGH" : "MEDIUM") as string,
  keywordsAdded: changes
    .filter((c) => c.includes("Injected ATS keyword"))
    .map((c) => c.match(/"(.*?)"/)?.[1] || "")
    .filter(Boolean),
  score: Math.min(100, 70 + changes.length * 5),
});
    changesLog.push(...changes);

    changes.forEach(change => {
      if (change.startsWith("Injected ATS keyword")) {
        const keywordMatch = change.match(/"(.*?)"/);
        if (keywordMatch) atsKeywordsInjected.push(keywordMatch[1]);
      } else if (change.startsWith("Added metric placeholder")) {
        metricPlaceholdersAddedCount++;
      } else if (change.startsWith("Strengthened verb")) {
        strongVerbsUsedCount++;
      } else if (change.startsWith("Enhanced technical specificity")) {
        technicalEnhancementsCount++;
      } else if (change.startsWith("Shortened for conciseness")) {
        concisenessEnhancementsCount++;
      } else if (change.startsWith("Consider starting")) {
        suggestions.push(change);
      }
    });
  }

  // Build richer summaryOfChanges based on collected changes
  const finalSummaryOfChanges: string[] = [];
  finalSummaryOfChanges.push(`Heuristic optimization applied for ${mode.toUpperCase()} mode.`);

  if (strongVerbsUsedCount > 0) {
    finalSummaryOfChanges.push(`- Strengthened ${strongVerbsUsedCount} action verb(s).`);
  }
  if (atsKeywordsInjected.length > 0) {
    finalSummaryOfChanges.push(`- Injected relevant ATS keywords: ${unique(atsKeywordsInjected).join(", ")}.`);
  }
  if (metricPlaceholdersAddedCount > 0) {
    finalSummaryOfChanges.push(`- Suggested quantifying ${metricPlaceholdersAddedCount} achievement(s).`);
  }
  if (technicalEnhancementsCount > 0) {
    finalSummaryOfChanges.push(`- Enhanced technical specificity in ${technicalEnhancementsCount} instance(s).`);
  }
  if (concisenessEnhancementsCount > 0) {
    finalSummaryOfChanges.push(`- Improved conciseness for ${concisenessEnhancementsCount} bullet(s).`);
  }
  if (finalSummaryOfChanges.length === 1) { // If only the general message was added
      finalSummaryOfChanges.push("- Minor phrasing adjustments for clarity.");
  }


  // Populate mode-specific suggestions based on overall heuristics
  if (normalizedMode === "technical") {
    if (h.uniqueTechnical.length < 3) suggestions.push("Add more deep-technical architectural terminology.");
    suggestions.push("Describe the specific stack and trade-offs made in this implementation.");
  } else if (normalizedMode === "ats") {
    if (h.uniqueVerbs.length < 4) suggestions.push("Increase action verb density for better ATS indexing.");
    suggestions.push("Ensure your primary technical skills are mentioned in the first two bullets.");
  } else if (normalizedMode === "executive") {
    if (h.uniqueExecutive.length < 2) suggestions.push("Lacks strategic and leadership-focused terminology.");
    if (!h.hasStrongMetrics) suggestions.push("Executive summaries require more P&L or ROI-focused metrics.");
    suggestions.push("Focus on the 'Why' and the business outcome rather than just the 'What'.");
  } else if (normalizedMode === "concise") {
    if (h.wordCount > 100) suggestions.push("Content is too wordy for a concise profile; aim for high-impact brevity.");
    suggestions.push("Remove filler words and combine overlapping bullet points.");
  } else { // Professional / Default
    if (h.wordCount < 80) suggestions.push("Provide more context for a standard professional audience.");
    if (h.metricsCount === 0) suggestions.push("Add quantifiable achievements.");
    suggestions.push("Ensure a consistent professional tone throughout the section.");
  }


  return {
  optimizedContent: optimizedBulletPoints
  .map((b) => b.optimized)
  .join("\n"),
  summaryOfChanges: finalSummaryOfChanges.join("\n"),
  impactMetrics: [
    `${h.metricsCount} metrics detected`,
    `${strongVerbsUsedCount} strong action verbs identified`,
    `${h.uniqueTech.length} technical skills identified`
  ],
  optimizedBulletPoints: optimizedBulletPoints,
  atsKeywords:
    atsKeywordsInjected.length > 0
      ? unique(atsKeywordsInjected).slice(0, 5)
      : h.uniqueTech.slice(0, 5),
  suggestions: unique(suggestions)
};
}