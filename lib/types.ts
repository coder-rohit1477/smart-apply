export interface MarketingStat {
  label: string;
  value: string;
  note: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  description: string;
  trend: "up" | "steady";
}

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  location: string;
  schedule: "Remote" | "Hybrid" | "On-site";
  salary: string;
  summary: string;
  skills: Skill[];
  postedAt: string;
  stage: "Curated" | "Shortlisted" | "Interview" | "Applied";
  source: string;
}

export interface MatchInsight {
  id: string;
  company: string;
  title: string;
  location: string;
  salary: string;
  summary: string;
  matchScore: number;
  atsScore: number;
  missingSkills: Skill[];
  stage: JobRecord["stage"];
}

export interface PipelineItem {
  id: string;
  company: string;
  title: string;
  status:
    | "Resume tailoring"
    | "Applied"
    | "Interview prep"
    | "Offer review";
  nextStep: string;
  fitScore: number;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
}

export interface Skill {
  name: string;
  normalizedName: string;
  source: string;
  confidence: string;
}

export interface ResumeProfile {
  roleFocus: string;
  yearsOfExperience: number;
  strengths: string[];
  keywords: string[];
  seniority: "Intern" | "Fresher" | "Junior" | "Mid-level" | "Senior" | "Lead" | "Staff" | "Principal";
}

export interface ParsedResume {
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  headline?: string | null;
  summary?: string | null;
  estimatedYearsOfExperience?: number | null;
  projects?: string[] | null;
  education?: any[] | null;
  experience?: any[] | null;
  certifications?: string[] | null;
  skills?: Skill[] | null;
  rawText?: string | null;
  sections?: { [key: string]: string | string[] } | null;
}

export interface AiRecommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
}

export interface LandingSnapshot {
  stats: MarketingStat[];
  previewMetrics: DashboardMetric[];
  previewMatches: MatchInsight[];
}

export interface DashboardSnapshot {
  metrics: DashboardMetric[];
  pipeline: PipelineItem[];
  matches: MatchInsight[];
  activities: ActivityItem[];
  recommendations: AiRecommendation[];
  resumeProfile: ResumeProfile;
}
