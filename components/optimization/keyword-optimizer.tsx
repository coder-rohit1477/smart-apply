"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getKeywordOptimizationAction } from "@/actions/optimization-actions";
import { KeywordExtraction, KeywordComparison } from "@/lib/ai/services/keyword-optimizer-service";
import { cn } from "@/lib/utils";

interface KeywordOptimizerProps {
  resumeId: string;
}

export function KeywordOptimizer({ resumeId }: KeywordOptimizerProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<{
    extracted: KeywordExtraction;
    comparison: KeywordComparison;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (!jobDescription.trim()) {
      setError("Please provide a job description.");
      return;
    }

    setIsOptimizing(true);
    setError(null);
    try {
      const result = await getKeywordOptimizationAction(resumeId, jobDescription);
      setOptimization(result);
    } catch (err) {
      setError("Failed to analyze keywords. Please try again.");
      console.error(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Smart Keyword Optimizer
          </CardTitle>
          <CardDescription>
            Paste a job description to extract critical keywords and see how your resume matches up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[200px] p-4 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Paste the Job Description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleOptimize} disabled={isOptimizing}>
            {isOptimizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing Keywords...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyze Match
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {optimization && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-md">Match Quality</CardTitle>
                <div className={cn(
                  "text-2xl font-bold",
                  optimization.comparison.keywordDensityScore > 70 ? "text-green-500" : optimization.comparison.keywordDensityScore > 40 ? "text-yellow-500" : "text-red-500"
                )}>
                  {optimization.comparison.keywordDensityScore}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Found Keywords ({optimization.comparison.foundKeywords.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {optimization.comparison.foundKeywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                      {kw}
                    </Badge>
                  ))}
                  {optimization.comparison.foundKeywords.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No matches found.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Missing Keywords ({optimization.comparison.missingKeywords.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {optimization.comparison.missingKeywords.map((kw, i) => (
                    <Badge key={i} variant="outline" className="text-yellow-700 border-yellow-200">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-md">Optimization Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {optimization.comparison.optimizationTips.map((tip, i) => (
                  <li key={i} className="text-sm flex items-start gap-3 p-2 rounded-md hover:bg-accent/50">
                    <div className="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {i + 1}
                    </div>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
