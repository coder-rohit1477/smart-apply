import { auth, currentUser } from "@clerk/nextjs/server";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { MatchCard } from "@/components/dashboard/match-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSnapshot } from "@/services/dashboard-service";
import { JobFeed } from "@/components/jobs/job-feed";
import { routes } from "@/utils/routes";

export default async function DashboardPage() {
  await auth.protect();

  const user = await currentUser();
  const snapshot = await getDashboardSnapshot(user?.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10">
      <section className="grid gap-6 rounded-[2rem] border border-border/60 bg-card/70 p-8 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit">
            Smart Apply Control Center
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {user?.firstName ? `Welcome back, ${user.firstName}.` : "Welcome back."}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Monitor your career progress, optimize your resumes, and discover high-fit roles tailored by our AI engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={routes.dashboard}>Refresh insights</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={routes.dashboardResume}>Manage resume</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#recommendations">Review priorities</a>
            </Button>
          </div>
        </div>
        <Card className="border-border/60 bg-background/70">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-none px-2 text-[10px]">AI</Badge>
              Profile Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Target role</p>
              <p className="text-xl font-semibold">
                {snapshot.resumeProfile.roleFocus}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Seniority</p>
                <p className="mt-1 font-medium">{snapshot.resumeProfile.seniority}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Experience</p>
                <p className="mt-1 font-medium">
                  {snapshot.resumeProfile.yearsOfExperience} years
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {snapshot.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section>
        <SectionHeading
          eyebrow="Opportunities"
          title="Smart Match Job Feed"
          description="Real-time jobs from multi-source aggregation, matched against your latest resume."
        />
        <div className="mt-8">
          <JobFeed />
        </div>
      </section>

      <section id="recommendations" className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <SectionHeading
            eyebrow="AI priorities"
            title="Recommended next moves"
            description="Actionable suggestions generated from the matching, ATS, and activity domains."
          />
          <div className="grid gap-4">
            {snapshot.recommendations.map((recommendation) => (
              <Card
                key={recommendation.id}
                className="border-border/60 bg-card/70 backdrop-blur"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{recommendation.title}</CardTitle>
                    <Badge variant="secondary">{recommendation.impact}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {recommendation.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <ActivityFeed items={snapshot.activities} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Pipeline"
            title="Application workflow"
            description="Each card maps directly to the future PostgreSQL-backed application state."
          />
          <div className="grid gap-4">
            {snapshot.pipeline.map((item) => (
              <PipelineCard key={item.id} item={item} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Top matches"
            title="Highest-fit roles"
            description="These roles are scored through the shared ATS and matching services."
          />
          <div className="grid gap-4">
            {snapshot.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
