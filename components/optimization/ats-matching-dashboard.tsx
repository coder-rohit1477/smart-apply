"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Briefcase, 
  Cpu, 
  Zap,
  Loader2,
  BarChart3
} from "lucide-react";
import { performAtsMatchAction } from "@/actions/optimization-actions";
import { AtsMatchResult } from "@/lib/matching/ats-engine";
import { cn } from "@/lib/utils";

interface AtsMatchingDashboardProps {
  resumeId: string;
}

export function AtsMatchingDashboard({ resumeId }: AtsMatchingDashboardProps) {
  const [jd, setJd] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<AtsMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMatch = async () => {
    if (!jd.trim()) {
      setError("Please paste a job description first.");
      return;
    }

    setIsMatching(true);
    setError(null);
    try {
      const data = await performAtsMatchAction(resumeId, jd);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to perform ATS match.");
    } finally {
      setIsMatching(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-destructive";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            ATS Matching Engine
          </CardTitle>
          <CardDescription>
            Analyze your resume against a specific job description to find gaps and optimize your match rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[200px] p-4 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Paste the Job Description here..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={handleMatch} disabled={isMatching || !jd.trim()}>
              {isMatching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running Engine...
                </>
              ) : (
                <>
                  <Cpu className="h-4 w-4 mr-2" />
                  Analyze Match
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Overall Match</div>
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <div className={cn("text-4xl font-black", getScoreColor(result.overallScore))}>
                    {result.overallScore}%
                  </div>
                  <svg className="absolute inset-0 -rotate-90 h-32 w-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={364}
                      strokeDashoffset={364 - (364 * result.overallScore) / 100}
                      className={cn("transition-all duration-1000", getScoreColor(result.overallScore).replace("text-", "stroke-"))}
                    />
                  </svg>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Based on semantic similarity, keyword density, and structural quality.
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Metric Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Semantic Similarity</span>
                    <span>{result.semanticSimilarity}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all", getProgressColor(result.semanticSimilarity))} 
                      style={{ width: `${result.semanticSimilarity}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Keyword Match</span>
                    <span>{result.keywordMatch.percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all", getProgressColor(result.keywordMatch.percentage))} 
                      style={{ width: `${result.keywordMatch.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-500" /> Recruiter Readiness</span>
                    <span>{result.recruiterReadiness.score}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all", getProgressColor(result.recruiterReadiness.score))} 
                      style={{ width: `${result.recruiterReadiness.score}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Matched Keywords ({result.keywordMatch.matched.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.keywordMatch.matched.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-emerald-200">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Missing Keywords ({result.keywordMatch.missing.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.keywordMatch.missing.map((kw, i) => (
                    <Badge key={i} variant="outline" className="text-destructive border-destructive/20 bg-destructive/5">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Improvement Roadmap
              </CardTitle>
              <CardDescription>Prioritized steps to improve your match score.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl border bg-card/50 hover:bg-accent/50 transition-colors">
                    <div className={cn(
                      "mt-1 shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm",
                      rec.priority === "HIGH" ? "bg-red-500/10 text-red-500" : rec.priority === "MEDIUM" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {rec.priority === "HIGH" ? "!!!" : rec.priority === "MEDIUM" ? "!!" : "!"}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{rec.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{rec.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
