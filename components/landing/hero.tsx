import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MarketingStat, MatchInsight } from "@/lib/types";
import { routes } from "@/utils/routes";

interface HeroProps {
  authenticated: boolean;
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta: {
    href: string;
    label: string;
  };
  stats: MarketingStat[];
  topMatch?: MatchInsight;
}

export function Hero({
  authenticated,
  primaryCta,
  secondaryCta,
  stats,
  topMatch,
}: HeroProps) {
  const isDashboardLink = primaryCta.href === routes.dashboard;

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div className="space-y-8">
        <Badge variant="secondary" className="w-fit gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          AI applications, ATS scoring, and match intelligence in one workflow
        </Badge>
        <div className="space-y-5">
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Apply faster with an AI job platform built for serious operators.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Smart Apply parses resumes, scores ATS readiness, ranks openings, and
            organizes every application step from discovery to follow-up.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={primaryCta.href} prefetch={isDashboardLink ? false : undefined}>
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border/60 bg-card/70 backdrop-blur">
              <CardContent className="space-y-2 p-5">
                <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-sm leading-6 text-muted-foreground">{stat.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute -left-8 top-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-4 right-2 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
        <Card className="relative overflow-hidden border-border/60 bg-card/80 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <CardContent className="space-y-6 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live orchestration</p>
                <p className="text-lg font-semibold">Candidate command layer</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-[1.25rem] border border-border/60 bg-background/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Current role focus</p>
                    <p className="mt-1 text-xl font-semibold">Senior Frontend Engineer</p>
                  </div>
                  <Badge variant="success">ATS-ready</Badge>
                </div>
              </div>
              {topMatch ? (
                <div className="space-y-4 rounded-[1.25rem] border border-border/60 bg-background/70 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Top recommended role</p>
                      <p className="mt-1 text-lg font-semibold">
                        {topMatch.title} at {topMatch.company}
                      </p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {topMatch.matchScore}% fit
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {topMatch.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topMatch.missingSkills.map((skill) => (
                      <Badge key={skill.name} variant="outline">
                        {skill.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                  <p className="text-sm text-muted-foreground">Application speed</p>
                  <p className="mt-1 text-lg font-semibold">
                    {authenticated ? "Tracked from dashboard" : "Up to 4x faster"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                  <p className="text-sm text-muted-foreground">Workflow state</p>
                  <p className="mt-1 text-lg font-semibold">Parser + matcher + AI</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
