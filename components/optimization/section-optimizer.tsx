"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, RotateCcw, Copy, AlertCircle } from "lucide-react";
import { rewriteSectionAction, analyzeSectionAction } from "@/actions/optimization-actions";
import { RewriteMode, RewriteResponse, SectionAnalysis } from "@/types/rewrite";
import { cn } from "@/lib/utils";

interface SectionOptimizerProps {
  resumeId: string;
  section: string;
  initialContent: string;
  targetRole?: string;
  onSave: (optimizedContent: string) => void;
}

export function SectionOptimizer({ 
  resumeId, 
  section, 
  initialContent, 
  targetRole,
  onSave 
}: SectionOptimizerProps) {
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<RewriteMode>("PROFESSIONAL");
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [analysis, setAnalysis] = useState<SectionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRewrite = async () => {
    setIsRewriting(true);
    setError(null);
    try {
      const response = await rewriteSectionAction({
        resumeId,
        section: section as any,
        content,
        mode,
        targetRole,
      });
      setResult(response);
      setContent(response.optimizedContent);
    } catch (err) {
      setError("Failed to rewrite section. Please try again.");
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await analyzeSectionAction(section, content, mode, targetRole);
      setAnalysis(response);
    } catch (err) {
      setError("Failed to analyze section.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const modes: { label: string; value: RewriteMode; description: string }[] = [
    { label: "Professional", value: "PROFESSIONAL", description: "Standard business language" },
    { label: "Technical", value: "TECHNICAL", description: "Focus on tools & methods" },
    { label: "ATS Optimized", value: "ATS_OPTIMIZED", description: "Keyword density focus" },
    { label: "Executive", value: "EXECUTIVE", description: "High-level impact focus" },
    { label: "Concise", value: "CONCISE", description: "Punchy and brief" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold capitalize">{section} Content</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || isRewriting}
                  >
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Analyze
                  </Button>
                </div>
              </div>
              <CardDescription>
                Edit your content below or use AI to optimize it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[300px] p-4 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Enter your ${section} content...`}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => setContent(initialContent)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button size="sm" onClick={() => onSave(content)}>
                <Check className="h-4 w-4 mr-2" />
                Apply Changes
              </Button>
            </CardFooter>
          </Card>

          {result && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-md flex items-center">
                  <Sparkles className="h-4 w-4 mr-2 text-primary" />
                  Optimization Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <p className="font-medium">{result.summaryOfChanges}</p>
                <div className="flex flex-wrap gap-2">
                  {result.atsKeywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="bg-background">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Optimization Mode</CardTitle>
              <CardDescription>Choose how the AI should rewrite your content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {modes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all hover:bg-accent",
                    mode === m.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
                  )}
                >
                  <div className="font-medium text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </button>
              ))}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleRewrite} 
                disabled={isRewriting || isAnalyzing}
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Rewriting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Optimize with AI
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {analysis && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-md">Section Score</CardTitle>
                  <div className={cn(
                    "text-2xl font-bold",
                    analysis.score > 80 ? "text-green-500" : analysis.score > 50 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {analysis.score}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Feedback</div>
                  <ul className="text-xs space-y-1">
                    {analysis.feedback.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="mt-1 h-1 w-1 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {analysis.missingElements.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Missing Elements</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.missingElements.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
