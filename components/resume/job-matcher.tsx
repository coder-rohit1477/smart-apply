"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Search,
  Target,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { StoredResume } from "@/types/resume";

interface JobMatchResult {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: string;
  reasoning: string;
}

interface JobMatcherProps {
  resume: StoredResume;
}

export function JobMatcher({ resume }: JobMatcherProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMatching() {
    if (!jobDescription.trim() || jobDescription.length < 50) {
      setError("Please provide a more detailed job description (at least 50 characters).");
      return;
    }

    setIsMatching(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: resume.id,
          jobDescription,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Matching failed");

      setMatchResult(data.match);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Matching failed");
    } finally {
      setIsMatching(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Job Description Matcher
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste the job description you&apos;re interested in, and our AI will analyze how well your current resume matches the requirements.
          </p>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job description here..."
            className="min-h-[200px] w-full rounded-xl border border-border/60 bg-background/50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={startMatching}
              disabled={isMatching || !jobDescription.trim()}
              className="rounded-full"
            >
              {isMatching ? "Analyzing Match..." : "Analyze Match"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isMatching && (
        <Card className="animate-pulse">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Comparing your skills against the job requirements...</p>
          </CardContent>
        </Card>
      )}

      {matchResult && !isMatching && (
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <Card className="flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-4 flex h-32 w-32 items-center justify-center">
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle
                    className="stroke-secondary"
                    strokeWidth="8"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className={cn(
                      "transition-all duration-1000 ease-out",
                      matchResult.matchScore >= 80
                        ? "stroke-emerald-500"
                        : matchResult.matchScore >= 60
                          ? "stroke-amber-500"
                          : "stroke-destructive",
                    )}
                    strokeWidth="8"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * matchResult.matchScore) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{matchResult.matchScore}%</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Match Score</span>
                </div>
              </div>
              <h4 className="font-semibold">Match Quality</h4>
              <p className="text-xs text-muted-foreground">
                {matchResult.matchScore >= 80
                  ? "Strong fit for this role."
                  : matchResult.matchScore >= 60
                    ? "Moderate fit. Some gaps detected."
                    : "Low fit. Significant gaps found."}
              </p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Match Reasoning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {matchResult.reasoning}
                </p>
                <Separator />
                <div>
                  <h5 className="mb-3 text-sm font-semibold">AI Recommendation</h5>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm italic text-foreground">
                    &quot;{matchResult.recommendation}&quot;
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Matched Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {matchResult.matchedSkills.length > 0 ? (
                    matchResult.matchedSkills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No specific matching skills identified.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Missing Critical Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {matchResult.missingSkills.length > 0 ? (
                    matchResult.missingSkills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Great! You have all the critical skills listed.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Skills Gap Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{matchResult.matchedSkills.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Skills Matched</p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{matchResult.missingSkills.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Skills Missing</p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{matchResult.matchScore}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Overall Fit</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
