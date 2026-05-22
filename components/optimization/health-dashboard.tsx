"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Target, Zap, Layout, GraduationCap, Briefcase, FileText, Code, CheckCircle2, AlertTriangle } from "lucide-react";
import { FullResumeAnalysis } from "@/types/resume";

interface HealthDashboardProps {
  analysis: FullResumeAnalysis;
}

export function HealthDashboard({ analysis }: HealthDashboardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
  };

  const sections = [
    { label: "Summary", score: analysis.sectionScores.summary, icon: FileText },
    { label: "Experience", score: analysis.sectionScores.experience, icon: Briefcase },
    { label: "Projects", score: analysis.sectionScores.projects, icon: Code },
    { label: "Skills", score: analysis.sectionScores.skills, icon: Layout },
    { label: "Education", score: analysis.sectionScores.education, icon: GraduationCap },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 overflow-hidden border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Readiness</h3>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-5xl font-bold tracking-tighter", getScoreColor(analysis.readinessScore))}>
                    {analysis.readinessScore}%
                  </span>
                  <Badge variant="outline" className="bg-background">Market Ready</Badge>
                </div>
              </div>
              <div className="h-20 w-20 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                <Target className="h-8 w-8 text-primary" />
                <svg className="absolute inset-0 -rotate-90 h-20 w-20">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={226}
                    strokeDashoffset={226 - (226 * analysis.readinessScore) / 100}
                    className={cn("transition-all duration-1000", getScoreColor(analysis.readinessScore).replace("text-", "stroke-"))}
                  />
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.executiveSummary.split('.')[0]}. Your resume ranks in the top {100 - analysis.readinessScore}% of candidates in your field.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">ATS Score</h3>
              <div className={cn("text-3xl font-bold", getScoreColor(analysis.atsScore))}>{analysis.atsScore}</div>
            </div>
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", analysis.atsScore > 70 ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${analysis.atsScore}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">Impact Score</h3>
              <div className={cn("text-3xl font-bold", getScoreColor(analysis.impactScore))}>{analysis.impactScore}</div>
            </div>
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", analysis.impactScore > 70 ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${analysis.impactScore}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {sections.map((section) => (
          <Card key={section.label} className="bg-card/50">
            <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
              <section.icon className="h-4 w-4 text-muted-foreground" />
              <div className="text-xs font-medium text-muted-foreground">{section.label}</div>
              <div className={cn("text-lg font-bold", getScoreColor(section.score))}>{section.score}%</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Critical Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.prioritizedActions.map((action, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-lg border bg-background/50 hover:bg-accent/50 transition-colors">
                <div className={cn(
                  "mt-1 shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
                  action.impact === "HIGH" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {action.impact === "HIGH" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{action.action}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase h-4">
                      {action.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{action.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
