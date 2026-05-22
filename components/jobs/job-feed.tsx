"use client";

import React, { useEffect, useState } from "react";
import {
  Briefcase,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";

import {
  getJobRecommendationsAction,
  syncJobsAction,
} from "@/actions/job-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IndiaJobLocation, JobFeedFilters, JobRecommendation } from "@/types/jobs";

const LOCATION_OPTIONS: Array<{ value: IndiaJobLocation; label: string }> = [
  { value: "ALL", label: "India Focus" },
  { value: "INDIA_REMOTE", label: "India Remote" },
  { value: "BANGALORE", label: "Bangalore" },
  { value: "PUNE", label: "Pune" },
  { value: "HYDERABAD", label: "Hyderabad" },
  { value: "GURGAON", label: "Gurgaon" },
];

const DEFAULT_FILTERS: JobFeedFilters = {
  internshipsOnly: false,
  fresherOnly: false,
  location: "ALL",
};

export function JobFeed() {
  const [query, setQuery] = useState("software engineer");
  const [isSyncing, setIsSyncing] = useState(false);
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<JobFeedFilters>(DEFAULT_FILTERS);

  const loadJobs = async (nextFilters: JobFeedFilters) => {
    try {
      const data = await getJobRecommendationsAction(nextFilters);
      setRecommendations(data as JobRecommendation[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void getJobRecommendationsAction(filters)
      .then((data) => {
        if (!cancelled) {
          setRecommendations(data as JobRecommendation[]);
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const updateFilters = (updater: (current: JobFeedFilters) => JobFeedFilters) => {
    setIsLoading(true);
    setFilters((current) => updater(current));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setIsLoading(true);
    try {
      await syncJobsAction(query);
      await loadJobs(filters);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Smart Match Feed
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              India-focused internships, fresher roles, and recent software jobs ranked with ATS, semantic fit, and freshness.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                className="w-[220px] rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary lg:w-[320px]"
                placeholder="software engineer, react, internship..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Sync Indian Jobs
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={filters.internshipsOnly}
              onClick={() =>
                updateFilters((current) => ({
                  ...current,
                  internshipsOnly: !current.internshipsOnly,
                }))
              }
            >
              Internships only
            </FilterChip>
            <FilterChip
              active={filters.fresherOnly}
              onClick={() =>
                updateFilters((current) => ({
                  ...current,
                  fresherOnly: !current.fresherOnly,
                }))
              }
            >
              Fresher only
            </FilterChip>
          </div>
          <div className="flex flex-wrap gap-2">
            {LOCATION_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={filters.location === option.value}
                onClick={() =>
                  updateFilters((current) => ({
                    ...current,
                    location: option.value,
                  }))
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[320px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((rec) => (
            <JobCard
              key={rec.job.id ?? rec.job.externalId}
              recommendation={rec}
            />
          ))}
          {recommendations.length === 0 && (
            <div className="col-span-full rounded-3xl border-2 border-dashed py-12 text-center">
              <p className="text-muted-foreground">
                No Indian jobs matched these filters. Try another query or relax the location filter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function JobCard({ recommendation }: { recommendation: JobRecommendation }) {
  const { job, category, score, reasoning, scoreBreakdown } = recommendation;

  const categoryConfig = {
    BEST_MATCH: { color: "bg-emerald-500", icon: Zap, label: "Best Match" },
    HIGH_ATS_POTENTIAL: { color: "bg-blue-500", icon: Target, label: "Fresh Pick" },
    SAFE: { color: "bg-amber-500", icon: ShieldCheck, label: "Strong Bet" },
    STRETCH: { color: "bg-purple-500", icon: Sparkles, label: "Stretch" },
  } as const;

  const config = categoryConfig[category] ?? categoryConfig.SAFE;

  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-300 hover:border-primary/40">
      <CardHeader className="pb-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
              {job.source}
            </Badge>
            {job.isInternship ? (
              <Badge className="bg-sky-500/10 text-sky-700">Internship</Badge>
            ) : null}
            {job.isFresherFriendly ? (
              <Badge className="bg-emerald-500/10 text-emerald-700">Fresher</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <config.icon className={cn("h-4 w-4", config.color.replace("bg-", "text-"))} />
            <span className={cn("text-xs font-black uppercase", config.color.replace("bg-", "text-"))}>
              {score}% Match
            </span>
          </div>
        </div>
        <CardTitle className="line-clamp-2 text-lg transition-colors group-hover:text-primary">
          {job.title}
        </CardTitle>
        <CardDescription className="font-medium text-slate-900 dark:text-slate-100">
          {job.company}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.location}
          </span>
          <span className="flex items-center gap-1 capitalize">
            <Briefcase className="h-3 w-3" /> {job.type.toLowerCase()}
          </span>
          {job.duration ? (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" /> {job.duration}
            </span>
          ) : null}
        </div>

        <div className="rounded-xl border border-accent/50 bg-accent/30 p-3">
          <p className="text-[11px] italic leading-relaxed text-muted-foreground">
            &quot;{reasoning}&quot;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="rounded-lg bg-muted/40 px-2 py-1">
            ATS {scoreBreakdown.atsMatch}%
          </div>
          <div className="rounded-lg bg-muted/40 px-2 py-1">
            Semantic {scoreBreakdown.semanticMatch}%
          </div>
          <div className="rounded-lg bg-muted/40 px-2 py-1">
            Location {scoreBreakdown.locationRelevance}%
          </div>
          <div className="rounded-lg bg-muted/40 px-2 py-1">
            Freshness {scoreBreakdown.freshness}%
          </div>
        </div>

        {job.salaryRange ? (
          <p className="text-xs font-medium text-foreground">{job.salaryRange}</p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {job.keywords?.slice(0, 4).map((kw) => (
            <Badge key={kw} variant="secondary" className="bg-background text-[9px]">
              {kw}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="outline" className="h-9 w-full rounded-xl text-xs" asChild>
          <a href={job.applyUrl || "#"} target="_blank" rel="noopener noreferrer">
            Apply Now
            <ExternalLink className="ml-2 h-3 w-3" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
