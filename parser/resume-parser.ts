import type { ParsedResume, ResumeProfile } from "@/lib/types";
import { getLatestResumeForActor } from "@/services/resume-service";

const defaultResumeProfile: ResumeProfile = {
  roleFocus: "Target role not yet detected",
  yearsOfExperience: 0,
  strengths: [],
  keywords: [],
  seniority: "Fresher",
};

const mockParsedResume: ParsedResume = {
  fullName: "Jane Doe",
  email: "jane.doe@example.com",
  phoneNumber: "555-123-4567",
  headline: "Frontend Developer with 3+ years experience",
  summary: "Experienced frontend developer passionate about building intuitive and performant web applications.",
  estimatedYearsOfExperience: 3,
  skills: [
    { name: "React", normalizedName: "react", source: "skills-section", confidence: "high" },
    { name: "Next.js", normalizedName: "next.js", source: "skills-section", confidence: "high" },
    { name: "TypeScript", normalizedName: "typescript", source: "skills-section", confidence: "high" },
    { name: "JavaScript", normalizedName: "javascript", source: "skills-section", confidence: "high" },
    { name: "HTML", normalizedName: "html", source: "skills-section", confidence: "high" },
    { name: "CSS", normalizedName: "css", source: "skills-section", confidence: "high" },
    { name: "Tailwind CSS", normalizedName: "tailwind css", source: "skills-section", confidence: "medium" },
    { name: "Node.js", normalizedName: "node.js", source: "keyword-match", confidence: "medium" },
    { name: "MongoDB", normalizedName: "mongodb", source: "keyword-match", confidence: "medium" },
  ],
  projects: [
    "E-commerce Platform: Built a full-stack e-commerce application using Next.js, React, and Node.js.",
    "Portfolio Website: Developed a personal portfolio showcasing various web development projects.",
  ],
  education: ["Bachelor of Science in Computer Science - University of Example (2018-2022)"],
  experience: [
    "Frontend Developer - Tech Solutions Inc. (2022-Present)",
    "Junior Web Developer - Creative Agency (2021-2022)",
    "Software Engineering Intern - Innovate Corp (2020-2021)",
  ],
  certifications: [],
};

export async function getResumeProfile(userId?: string): Promise<ResumeProfile> {
  let parsedResume: ParsedResume | null = null;
  let extractedSkills: string[] = [];

  if (userId) {
    const latestResume = await getLatestResumeForActor(userId);
    if (latestResume) {
      parsedResume = latestResume.parsedData;
      extractedSkills = latestResume.extractedSkills;
    }
  }

  // Use mockParsedResume if no user ID or no resume found for user
  if (!parsedResume) {
    parsedResume = mockParsedResume;
    extractedSkills = mockParsedResume.skills?.map(s => s.name) || [];
  }

  const skills = parsedResume.skills?.map((skill) => skill.name.toLowerCase()) || [];
  const experienceEntries = parsedResume.experience;

  // 1. Infer yearsOfExperience
  let yearsOfExperience: number = parsedResume.estimatedYearsOfExperience ?? 0;
  if (!parsedResume.estimatedYearsOfExperience) {
    // Basic estimation: count experience entries, with a cap
    yearsOfExperience = Math.min(experienceEntries?.length || 0, 10); // Cap at 10 for estimation
  }
  // Adjust for very junior profiles
  if (yearsOfExperience === 0 && (skills.includes("intern") || experienceEntries?.some(e => e.toLowerCase().includes("intern")))) {
      yearsOfExperience = 0.5; // Represent intern as 0.5 years
  } else if (yearsOfExperience === 0 && (skills.includes("fresher") || experienceEntries?.some(e => e.toLowerCase().includes("fresher")))) {
      yearsOfExperience = 0;
  } else if (yearsOfExperience === 0 && (skills.includes("junior") || experienceEntries?.some(e => e.toLowerCase().includes("junior")))) {
      yearsOfExperience = 1;
  }

  // 2. Infer seniority
  let seniority: ResumeProfile["seniority"] = "Fresher";
  if (yearsOfExperience >= 8) {
    seniority = "Lead";
  } else if (yearsOfExperience >= 4) {
    seniority = "Senior";
  } else if (yearsOfExperience >= 2) {
    seniority = "Mid-level";
  } else if (yearsOfExperience >= 1) {
    seniority = "Junior";
  } else if (yearsOfExperience > 0) {
      seniority = "Intern";
  }

  // 3. Infer roleFocus
  let roleFocus: string = "Target role not yet detected";
  if (parsedResume.headline && parsedResume.headline.length > 5) { // Ensure headline is substantial
    roleFocus = parsedResume.headline;
  } else if ((experienceEntries?.length || 0) > 0) {
    // Try to extract from the most recent experience entry
    const mostRecentExperience = experienceEntries![0].toLowerCase();
    if (mostRecentExperience.includes("frontend")) {
      roleFocus = "Frontend Developer";
    } else if (mostRecentExperience.includes("backend")) {
      roleFocus = "Backend Developer";
    } else if (mostRecentExperience.includes("fullstack") || (mostRecentExperience.includes("front") && mostRecentExperience.includes("back"))) {
      roleFocus = "Fullstack Developer";
    } else if (mostRecentExperience.includes("mobile")) {
      roleFocus = "Mobile Developer";
    } else if (mostRecentExperience.includes("devops")) {
        roleFocus = "DevOps Engineer";
    } else if (mostRecentExperience.includes("data scientist")) {
        roleFocus = "Data Scientist";
    } else if (mostRecentExperience.includes("qa") || mostRecentExperience.includes("quality assurance")) {
        roleFocus = "QA Engineer";
    } else if (mostRecentExperience.includes("ai") || mostRecentExperience.includes("machine learning")) {
        roleFocus = "AI/ML Engineer";
    } else if (mostRecentExperience.includes("software engineer")) {
        roleFocus = "Software Engineer";
    } else {
        // Fallback to more generic if no specific role found
        const commonRoles = ["Software Engineer", "Developer", "Engineer"];
        for(const role of commonRoles) {
            if (mostRecentExperience.includes(role.toLowerCase())) {
                roleFocus = role;
                break;
            }
        }
    }
  }

  // Use AI keywords if available and relevant for roleFocus
  const aiKeywords = ["machine learning", "artificial intelligence", "nlp", "computer vision"];
  if (aiKeywords.some(keyword => skills.includes(keyword))) {
      roleFocus = "AI/ML Engineer";
  }

  const frontendKeywords = ["react", "next.js", "angular", "vue", "frontend", "javascript", "typescript", "html", "css"];
  if (frontendKeywords.some(keyword => skills.includes(keyword))) {
      if (roleFocus === "Target role not yet detected" || roleFocus.includes("Developer") || roleFocus.includes("Engineer")) {
          roleFocus = "Frontend " + roleFocus; // Prepend if generic or not detected yet
      } else if (roleFocus === "Frontend Developer" || roleFocus === "Fullstack Developer") {
          // Keep as is or refine further if needed
      } else if (!roleFocus.includes("Frontend")) {
          roleFocus = "Frontend Developer"; // Override if conflicting
      }
  }

  const backendKeywords = ["node.js", "python", "java", "go", "backend", "api", "database", "sql", "nosql", "fastapi"];
  if (backendKeywords.some(keyword => skills.includes(keyword))) {
      if (roleFocus === "Target role not yet detected" || roleFocus.includes("Developer") || roleFocus.includes("Engineer")) {
          roleFocus = "Backend " + roleFocus; // Prepend if generic or not detected yet
      } else if (roleFocus === "Backend Developer" || roleFocus === "Fullstack Developer") {
          // Keep as is or refine further if needed
      } else if (!roleFocus.includes("Backend")) {
          roleFocus = "Backend Developer"; // Override if conflicting
      }
  }

  // If both frontend and backend keywords are present, suggest Fullstack
  if (frontendKeywords.some(keyword => skills.includes(keyword)) && backendKeywords.some(keyword => skills.includes(keyword))) {
      roleFocus = "Fullstack Developer";
  }


  // Final check for roleFocus fallback if still generic or not detected
  if (roleFocus.includes("Target role not yet detected") || roleFocus.trim() === "Developer" || roleFocus.trim() === "Engineer") {
      roleFocus = "Software Engineer"; // Default to a common generic role
  }


  // 4. Determine strengths (top 3 skills with high confidence, or from headline/summary)
  const strengths = (parsedResume.skills || [])
    .filter((s) => s.confidence === "high")
    .map((s) => s.name)
    .slice(0, 3);

  return {
    roleFocus,
    yearsOfExperience,
    strengths: strengths.length > 0 ? strengths : defaultResumeProfile.strengths,
    keywords: extractedSkills.length > 0 ? extractedSkills : skills, // Use extracted if available, else all parsed skills
    seniority,
  };
}

export function getKeywordOverlap(profile: ResumeProfile, skills: string[]) {
  const normalizedProfileKeywords = new Set(
    profile.keywords.map((keyword) => keyword.toLowerCase()),
  );

  return skills.filter((skill) => normalizedProfileKeywords.has(skill.toLowerCase()));
}
