import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  DatabaseZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const APP_NAME = "Smart Apply";

export const APP_DESCRIPTION =
  "An AI-native job platform for parsing resumes, scoring ATS readiness, and orchestrating high-signal applications.";

export const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "/workflow", label: "Workflow" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export interface FeatureCard {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
}

export const FEATURE_CARDS: FeatureCard[] = [
  {
    title: "Resume parsing",
    eyebrow: "parser",
    description:
      "Extract role focus, keywords, and strengths into structured data that downstream services can use consistently.",
    icon: Sparkles,
  },
  {
    title: "ATS scoring",
    eyebrow: "ats",
    description:
      "Quantify how well each profile aligns to a role before a user spends time applying to the wrong opportunity.",
    icon: ShieldCheck,
  },
  {
    title: "Job matching",
    eyebrow: "matching",
    description:
      "Rank openings by fit score, surface missing skills, and keep prioritization explainable for operators and candidates.",
    icon: BrainCircuit,
  },
  {
    title: "Durable data layer",
    eyebrow: "prisma + postgres",
    description:
      "Store user profiles, applications, resumes, and AI insights behind a typed Prisma client and scalable PostgreSQL schema.",
    icon: DatabaseZap,
  },
];

export const WORKFLOW_STEPS = [
  {
    title: "Parse the candidate profile",
    description:
      "Normalize resume content into structured strengths, keywords, and seniority signals.",
    detail: "Domain: parser/",
  },
  {
    title: "Score and match open roles",
    description:
      "Use ATS heuristics and fit scoring to rank the opportunities worth pursuing first.",
    detail: "Domains: ats/ + matching/ + jobs/",
  },
  {
    title: "Trigger AI recommendations",
    description:
      "Generate the next best actions for tailoring, follow-up, and interview preparation.",
    detail: "Domains: ai/ + actions/ + services/",
  },
] as const;
