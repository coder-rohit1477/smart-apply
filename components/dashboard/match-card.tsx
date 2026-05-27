import { MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MatchInsight } from "@/lib/types";

interface MatchCardProps {
  match: MatchInsight;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {match.title} · {match.company}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {match.location}
            </p>
          </div>
          <Badge variant="success">{match.matchScore}% fit</Badge>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{match.summary}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
            <p className="text-sm text-muted-foreground">ATS score</p>
            <p className="mt-1 font-medium">{match.atsScore}%</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
            <p className="text-sm text-muted-foreground">Compensation</p>
            <p className="mt-1 font-medium">{match.salary}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggested skill gaps to close
          </p>
          <div className="flex flex-wrap gap-2">
            {match.missingSkills.map((skill) => (
              <Badge key={skill.name} variant="outline">
                {skill.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
