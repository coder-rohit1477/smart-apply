"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AiAnalysis } from "@/components/resume/ai-analysis";
import { JobMatcher } from "@/components/resume/job-matcher";
import { ParsedResumePreview } from "@/components/resume/parsed-resume-preview";
import { ResumeDropzone } from "@/components/resume/resume-dropzone";
import { UploadError } from "@/components/resume/upload-error";
import { UploadProgress } from "@/components/resume/upload-progress";
import { OptimizationPanel } from "@/components/optimization/optimization-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadResponseSchema, deleteResponseSchema } from "@/types/resume";
import type { ResumeApiError, StoredResume } from "@/types/resume";
import { BrainCircuit, FileText, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

import { useMounted } from "@/hooks/use-mounted";

interface ResumeUploadProps {
  initialResume: StoredResume | null;
}

type UploadStage = "uploading" | "parsing" | "saving";
type ViewTab = "preview" | "analysis" | "matching" | "optimization";

export function ResumeUpload({ initialResume }: ResumeUploadProps) {
  const mounted = useMounted();
  const [resume, setResume] = useState<StoredResume | null>(initialResume);
  const [error, setError] = useState<ResumeApiError | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("uploading");
  const [activeTab, setActiveTab] = useState<ViewTab>("preview");

  useEffect(() => {
    if (!isUploading) {
      return;
    }

    const stages: UploadStage[] = ["uploading", "parsing", "saving"];
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      setStage(stages[index]);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isUploading]);

  if (!mounted) return <PreviewSkeleton />;

  async function handleUpload(file: File) {
    setLastFile(file);
    setError(null);
    setIsUploading(true);
    setStage("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });
      const payload = uploadResponseSchema.parse(await response.json());

      if (!response.ok || !payload.success) {
        setError(
          payload.success
            ? {
                code: "UNKNOWN_ERROR",
                message: "The upload failed unexpectedly.",
              }
            : payload.error,
        );
        return;
      }

      setResume(payload.resume);
    } catch {
      setError({
        code: "UNKNOWN_ERROR",
        message: "A network error interrupted the upload.",
        details: ["Check your connection and retry the upload."],
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!resume) return;

    if (!confirm("Are you sure you want to delete your resume? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/resume/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resumeId: resume.id }),
      });

      const payload = deleteResponseSchema.parse(await response.json());

      if (!response.ok || !payload.success) {
        setError(
          payload.success
            ? {
                code: "UNKNOWN_ERROR",
                message: "The deletion failed unexpectedly.",
              }
            : payload.error,
        );
        return;
      }

      setResume(null);
      setLastFile(null);
    } catch {
      setError({
        code: "UNKNOWN_ERROR",
        message: "A network error interrupted the deletion.",
        details: ["Check your connection and retry."],
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/70">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Resume upload</CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Upload the latest version of your resume to parse text, extract skills,
            and feed the rest of the Smart Apply workflow.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ResumeDropzone
            disabled={isUploading || isDeleting}
            onFileSelected={handleUpload}
            onValidationError={setError}
          />
          {isUploading ? <UploadProgress stage={stage} /> : null}
          {error ? (
            <UploadError
              error={error}
              canRetry={Boolean(lastFile) && !isUploading && !isDeleting}
              onRetry={() => {
                if (lastFile) {
                  void handleUpload(lastFile);
                }
              }}
              onDismiss={() => setError(null)}
            />
          ) : null}
          {!isUploading && !error && resume ? (
            <div
              className="flex items-start gap-3 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-4"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium text-foreground">
                  Resume processed successfully
                </p>
                <p className="text-sm text-muted-foreground">
                  Structured data and extracted skills are now available in your
                  workspace.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {resume ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-border/60 pb-1">
            <TabButton 
              active={activeTab === "preview"} 
              onClick={() => setActiveTab("preview")}
              icon={FileText}
              label="Resume Preview"
            />
            <TabButton 
              active={activeTab === "analysis"} 
              onClick={() => setActiveTab("analysis")}
              icon={BrainCircuit}
              label="AI Analysis"
            />
            <TabButton
              active={activeTab === "matching"}
              onClick={() => setActiveTab("matching")}
              icon={Search}
              label="Job Matching"
            />
            <TabButton
              active={activeTab === "optimization"}
              onClick={() => setActiveTab("optimization")}
              icon={Sparkles}
              label="AI Optimization"
            />
            </div>

            {activeTab === "preview" && (
            <ParsedResumePreview
              resume={resume}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
            )}

            {activeTab === "analysis" && (
            <AiAnalysis resume={resume} />
            )}

            {activeTab === "matching" && (
            <JobMatcher resume={resume} />
            )}

            {activeTab === "optimization" && (
            <OptimizationPanel 
              resumeId={resume.id} 
              parsedData={resume.parsedData}
              targetRole={resume.targetRole || undefined}
            />
            )}        </div>
      ) : (
        <PreviewSkeleton />
      )}
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
        "border-b-2",
        active 
          ? "border-primary text-primary" 
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]" aria-hidden="true">
      <div className="h-[420px] animate-pulse rounded-[1.75rem] border border-border/60 bg-card/50" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-[1.75rem] border border-border/60 bg-card/50"
          />
        ))}
      </div>
    </div>
  );
}
