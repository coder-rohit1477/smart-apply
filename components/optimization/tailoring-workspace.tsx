"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Wand2,
  CheckCircle2,
  MessageSquare,
  Target,
  Zap,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { tailorResumeAction, saveOptimizedVersionAction } from "@/actions/optimization-actions";
import type { TailoringResult } from "@/types/tailoring";
import { cn } from "@/lib/utils";

interface TailoringWorkspaceProps {
  resumeId: string;
}

export function TailoringWorkspace({ resumeId }: TailoringWorkspaceProps) {
  const [jd, setJd] = useState("");
  const [focus, setFocus] = useState<"ATS" | "TECHNICAL" | "LEADERSHIP" | "GENERAL">("ATS");
  const [isTailoring, setIsTailoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<TailoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTailor = async () => {
    if (!jd.trim()) {
      setError("Please provide a job description.");
      return;
    }

    setIsTailoring(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const data = await tailorResumeAction(resumeId, jd, focus);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to tailor resume.");
    } finally {
      setIsTailoring(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!result) return;
    setIsSaving(true);
    setError(null);
    try {
      const optimizedData = {
        summary: result.summary.tailoredContent,
        experience: result.experience.map((exp) => ({
          company: exp.company,
          role: exp.role,
          bullets: exp.bullets.map((b) => b.tailored),
        })),
        skills: result.skills.suggestedOrdering,
        projects: result.projects.map((p) => ({
          name: p.name,
          description: p.description.tailoredContent,
        })),
      };

      const versionName = `Tailored for ${result.experience[0]?.company ?? "Position"}`;
      await saveOptimizedVersionAction(resumeId, versionName, optimizedData);
      setSaveSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Resume Tailoring Workspace
          </CardTitle>
          <CardDescription>
            Optimize your entire resume for a specific role in one click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[150px] p-4 rounded-xl border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Paste the target Job Description here..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {(["ATS", "TECHNICAL", "LEADERSHIP", "GENERAL"] as const).map((f) => (
                <Button
                  key={f}
                  variant={focus === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFocus(f)}
                  className="text-[10px] h-8"
                >
                  {f}
                </Button>
              ))}
            </div>
            <Button onClick={handleTailor} disabled={isTailoring || !jd.trim()}>
              {isTailoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Tailoring Content...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Tailor My Resume
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Tailored version saved successfully!
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Tailoring Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-emerald-800 leading-relaxed">{result.overallStrategy}</p>
              <div className="flex gap-4 mt-4">
                <Badge variant="outline" className="bg-background text-emerald-700 border-emerald-200">
                  Seniority: {result.seniorityAlignment}
                </Badge>
                <Badge variant="outline" className="bg-background text-emerald-700 border-emerald-200">
                  Tone: {result.toneProfile}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <SectionTailorCard
            title="Professional Summary"
            original={result.summary.originalContent}
            tailored={result.summary.tailoredContent}
            highlights={result.summary.improvementHighlights}
            note={result.summary.recruiterNote}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Tailored Experience
            </h3>
            {result.experience.map((exp, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="bg-accent/30 py-3 border-b">
                  <CardTitle className="text-md flex items-center justify-between">
                    <span>{exp.role} @ {exp.company}</span>
                    <Badge variant="secondary">{exp.bullets.length} Bullets Tailored</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {exp.bullets.map((bullet, j) => (
                      <div key={j} className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x">
                        <div className="p-4 bg-background text-xs text-muted-foreground italic">
                          <span className="font-bold text-[10px] block mb-1 uppercase opacity-50">Original</span>
                          {bullet.original}
                        </div>
                        <div className="p-4 bg-primary/5 text-sm">
                          <span className="font-bold text-[10px] block mb-1 uppercase text-primary">Tailored for JD</span>
                          <p className="font-medium">{bullet.tailored}</p>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {bullet.keywordsInjected.map((kw, k) => (
                              <Badge key={k} variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-200/30">
                                + {kw}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-primary/70 leading-relaxed">
                            <span className="font-bold mr-1">Impact:</span> {bullet.impactImprovement}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => { setResult(null); setSaveSuccess(false); }}>
              Discard
            </Button>
            <Button size="lg" onClick={handleApplyChanges} disabled={isSaving || saveSuccess}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {saveSuccess ? "Saved!" : "Save as New Version"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTailorCard({
  title,
  original,
  tailored,
  highlights,
  note,
}: {
  title: string;
  original: string;
  tailored: string;
  highlights: string[];
  note: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-md font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Original Content</span>
            <div className="p-3 rounded-lg border bg-accent/10 text-sm text-muted-foreground min-h-[100px]">
              {original}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-primary">Optimized Content</span>
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm font-medium min-h-[100px]">
              {tailored}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <div className="md:col-span-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">Key Improvements</span>
            <ul className="space-y-1">
              {highlights.map((h, i) => (
                <li key={i} className="text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
            <span className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1 mb-1">
              <MessageSquare className="h-3 w-3" />
              Recruiter Feedback
            </span>
            <p className="text-xs text-amber-800 leading-relaxed italic">{note}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
