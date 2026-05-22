"use client";

import React, { useState, useEffect } from "react";
import { SectionOptimizer } from "./section-optimizer";
import { AtsMatchingDashboard } from "./ats-matching-dashboard";
import { TailoringWorkspace } from "./tailoring-workspace";
import { VersionHistory } from "./version-history";
import { HealthDashboard } from "./health-dashboard";
import { LivePreview } from "./live-preview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Target,
  History,
  Layout,
  FileText,
  Briefcase,
  GraduationCap,
  Code,
  Activity,
  ChevronRight,
  ShieldCheck,
  PanelLeft,
  Columns,
  Wand2
} from "lucide-react";
import { FullResumeAnalysis } from "@/types/resume";

interface OptimizationPanelProps {
  resumeId: string;
  parsedData: any;
  targetRole?: string;
}

export function OptimizationPanel({ resumeId, parsedData, targetRole }: OptimizationPanelProps) {
  const [activeTab, setActiveTab] = useState("health");
  const [activeSection, setActiveSection] = useState("EXPERIENCE");
  const [analysis, setAnalysis] = useState<FullResumeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    async function fetchLatestAnalysis() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/ai/analyze-resume`, {
          method: "POST",
          body: JSON.stringify({ resumeId })
        });
        const data = await response.json();
        if (data.success) {
          setAnalysis(data.analysis.analysisData as FullResumeAnalysis);
        }
      } catch (err) {
        console.error("Failed to fetch analysis:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLatestAnalysis();
  }, [resumeId]);

  const sections = [
    { id: "SUMMARY", label: "Summary", icon: FileText, content: parsedData.summary || "" },
    { id: "EXPERIENCE", label: "Experience", icon: Briefcase, content: Array.isArray(parsedData.experience) ? parsedData.experience.join("\n") : (parsedData.experience || "") },
    { id: "PROJECTS", label: "Projects", icon: Code, content: Array.isArray(parsedData.projects) ? parsedData.projects.join("\n") : (parsedData.projects || "") },
    { id: "SKILLS", label: "Skills", icon: Layout, content: Array.isArray(parsedData.skills) ? parsedData.skills.map((s: any) => s.name || s).join(", ") : (parsedData.skills || "") },
    { id: "EDUCATION", label: "Education", icon: GraduationCap, content: Array.isArray(parsedData.education) ? parsedData.education.join("\n") : (parsedData.education || "") },
  ];

  const handleSaveSection = (optimizedContent: string) => {
    console.log(`Saved ${activeSection}:`, optimizedContent);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Optimization Studio</h1>
          <p className="text-muted-foreground">
            A professional-grade suite to transform your resume into a top-tier application.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="hidden lg:flex"
          >
            {showPreview ? <PanelLeft className="h-4 w-4 mr-2" /> : <Columns className="h-4 w-4 mr-2" />}
            {showPreview ? "Hide Preview" : "Split View"}
          </Button>
          {analysis && (
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-500/20 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              AI Verified: {analysis.readinessScore}% Match
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 gap-6",
        showPreview ? "lg:grid-cols-12" : "lg:grid-cols-4"
      )}>
        <Card className={cn(
          "h-fit lg:sticky lg:top-6",
          showPreview ? "lg:col-span-2" : "lg:col-span-1"
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Workspace</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              <SidebarButton
                active={activeTab === "health"}
                onClick={() => setActiveTab("health")}
                icon={Activity}
                label="Health Score"
                badge={analysis?.readinessScore.toString()}
              />
              <SidebarButton
                active={activeTab === "tailor"}
                onClick={() => setActiveTab("tailor")}
                icon={Wand2}
                label="One-Click Tailor"
              />
              <SidebarButton
                active={activeTab === "sections"}
                onClick={() => setActiveTab("sections")}
                icon={Sparkles}
                label="AI Rewriter"
              />
              <SidebarButton
                active={activeTab === "keywords"}
                onClick={() => setActiveTab("keywords")}
                icon={Target}
                label="Target Matching"
              />
              <SidebarButton
                active={activeTab === "history"}
                onClick={() => setActiveTab("history")}
                icon={History}
                label="Version History"
              />
            </div>
          </CardContent>
        </Card>

        <div className={cn(
          "min-h-[600px]",
          showPreview ? "lg:col-span-5" : "lg:col-span-3"
        )}>
          {activeTab === "health" && (
            analysis ? <HealthDashboard analysis={analysis} /> : (
              <div className="h-full flex items-center justify-center p-12 border-2 border-dashed rounded-[2rem] bg-accent/20">
                <div className="text-center space-y-4">
                  <Activity className="h-12 w-12 text-primary/40 mx-auto animate-pulse" />
                  <p className="text-muted-foreground">Generating your comprehensive health report...</p>
                </div>
              </div>
            )
          )}

          {activeTab === "tailor" && (
            <TailoringWorkspace resumeId={resumeId} />
          )}

          {activeTab === "sections" && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 mb-4 bg-accent/30 p-2 rounded-xl border">
                {sections.map((s) => (
                  <Button
                    key={s.id}
                    variant={activeSection === s.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection(s.id)}
                    className="flex items-center gap-2 rounded-lg"
                  >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </Button>
                ))}
              </div>

              {sections.map((s) => (
                activeSection === s.id && (
                  <SectionOptimizer
                    key={s.id}
                    resumeId={resumeId}
                    section={s.id}
                    initialContent={s.content}
                    targetRole={targetRole}
                    onSave={handleSaveSection}
                  />
                )
              ))}
            </div>
          )}

          {activeTab === "keywords" && (
            <AtsMatchingDashboard resumeId={resumeId} />
          )}

          {activeTab === "history" && (
            <VersionHistory resumeId={resumeId} />
          )}
        </div>

        {showPreview && (
          <div className="lg:col-span-5 hidden lg:block">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Live Preview
                </span>
                <Badge variant="outline" className="text-[10px]">Standard Template</Badge>
              </div>
              <LivePreview data={parsedData} className="scale-[0.8] origin-top border-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between p-4 text-sm font-medium transition-all border-l-2 ${
        active
          ? "bg-primary/5 border-primary text-primary"
          : "border-transparent hover:bg-accent text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
        {label}
      </div>
      {badge ? (
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
          {badge}%
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 opacity-20" />
      )}
    </button>
  );
}
