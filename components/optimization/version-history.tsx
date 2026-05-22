"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, FileText, Calendar, ArrowRight, Trash2, CheckCircle } from "lucide-react";
import { getResumeVersionsAction } from "@/actions/optimization-actions";
import { formatDistanceToNow } from "date-fns";

interface VersionHistoryProps {
  resumeId: string;
}

export function VersionHistory({ resumeId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadVersions() {
      try {
        const data = await getResumeVersionsAction(resumeId);
        setVersions(data);
      } catch (err) {
        console.error("Failed to load versions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadVersions();
  }, [resumeId]);

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-accent/50 rounded-lg" />)}
    </div>;
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
        <div className="space-y-4">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No version history found.
            </div>
          ) : (
            versions.map((version, index) => (
              <div 
                key={version.id} 
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {version.name}
                      {index === 0 && <Badge variant="secondary" className="text-[10px] h-4">Latest</Badge>}
                      {version.parentId === null && <Badge variant="outline" className="text-[10px] h-4">Original</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        ATS Score: {version.atsScore}
                      </span>
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
