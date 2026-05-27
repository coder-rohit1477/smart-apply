import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DashboardMetric, MatchInsight } from "@/lib/types";

interface DashboardPreviewProps {
  metrics: DashboardMetric[];
  matches: MatchInsight[];
}

export function DashboardPreview({
  metrics,
  matches,
}: DashboardPreviewProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 pt-20">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/60 bg-card/80 shadow-[0_35px_110px_-65px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Dashboard preview
            </Badge>
            <CardTitle className="text-2xl">Signal-rich, not noisy</CardTitle>
            <p className="text-sm leading-7 text-muted-foreground">
              The dashboard is structured around metrics, application pipeline,
              and AI guidance so a candidate always knows the next action.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1.25rem] border border-border/60 bg-background/80 p-5"
              >
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                <p className="mt-2 text-sm font-medium text-primary">{metric.delta}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {metric.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl">AI-ranked opportunities</CardTitle>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              Roles are sorted by fit score and ATS readiness, with visible gaps
              before a candidate submits.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {matches.map((match, index) => (
              <div key={match.id} className="space-y-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border border-border/60">
                    <AvatarFallback className="bg-secondary text-sm font-semibold">
                      {match.company.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{match.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {match.company} · {match.location}
                        </p>
                      </div>
                      <Badge variant="success">{match.matchScore}% fit</Badge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {match.summary}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {match.missingSkills.map((skill) => (
                        <Badge key={skill.name} variant="outline">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {index < matches.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
