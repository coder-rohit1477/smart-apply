"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, FileText, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { getResumeVersionsAction } from "@/actions/optimization-actions";
import { formatDistanceToNow } from "date-fns";

interface ResumeVersion {
  id: string;
  name: string;
  createdAt: string | Date;
  atsScore: number | null;
  parentId: string | null;
}

interface VersionHistoryProps {
  resumeId: string;
}

export function VersionHistory({ resumeId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVersions() {
      try {
        const data = await getResumeVersionsAction(resumeId);
        setVersions(data as ResumeVersion[]);
      } catch (err) {
        console.error("Failed to load versions:", err);
        setError("Could not load version history.");
      } finally {
        setIsLoading(false);
      }
    }
    loadVersions();
  }, [resumeId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-accent/50 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Version History
        </CardTitle>
        <CardDescription>
          View and compare previous versions of your resume.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No version history found. Save an optimized version to see it here.
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {version.name}
                      {index === 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4">Latest</Badge>
                      )}
                      {version.parentId === null && (
                        <Badge variant="outline" className="text-[10px] h-4">Original</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                      </span>
                      {version.atsScore != null && version.atsScore > 0 ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          ATS Score: {version.atsScore}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground/60">
                          <CheckCircle className="h-3 w-3" />
                          ATS Score: N/A
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                  <Button variant="outline" size="sm">
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
