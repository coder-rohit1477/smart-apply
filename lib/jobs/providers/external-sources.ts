import { JobFreshnessBucket } from "@prisma/client";

import type { Page } from "playwright";

import type { JobProvider, UnifiedJob } from "@/types/jobs";
import {
  logProviderFailure,
  scrapeListingPage,
  withProviderCache,
} from "../playwright-scraper";
import {
  classifyFreshness,
  inferJobType,
  makeAbsoluteUrl,
  normalizeKeywords,
  parseRelativePostedAt,
  slugifyQuery,
} from "../utils";

function normalizeInternshalaCard(card: {
  href: string | null;
  title: string;
  company: string;
  location: string;
  compensation: string | null;
  duration: string | null;
  experienceLevel: string | null;
  description: string;
  skills: string[];
  freshnessLabel: string | null;
  isInternship: boolean;
}): UnifiedJob | null {
  if (!card.title || !card.company || !card.description) {
    return null;
  }

  const postedAt = parseRelativePostedAt(card.freshnessLabel);
  const location = card.location || "India";
  const experienceLevel =
    card.experienceLevel ??
    (card.isInternship ? "Internship" : "Fresher / Entry level");

  return {
    externalId: `internshala-${card.title}-${card.company}-${card.href ?? location}`,
    source: "Internshala",
    title: card.title,
    company: card.company,
    location,
    type: inferJobType(location, card.description),
    description: card.description,
    applyUrl: makeAbsoluteUrl("https://internshala.com", card.href),
    duration: card.duration,
    salaryRange: card.compensation,
    experienceLevel,
    isInternship: card.isInternship,
    isFresherFriendly: card.isInternship || /fresher|entry|0|1 year|graduate/i.test(experienceLevel),
    freshnessBucket: postedAt ? classifyFreshness(postedAt) : JobFreshnessBucket.UNKNOWN,
    keywords: normalizeKeywords(card.skills),
    postedAt,
  };
}

async function scrapeInternshalaCards(page: Page, isInternship: boolean) {
  const cards = await page
    .locator(".individual_internship")
    .filter({ has: page.locator(".job-title-href") })
    .evaluateAll((elements) =>
      elements.map((element) => {
        const text = (selector: string) =>
          (element.querySelector(selector)?.textContent ?? "").trim();

        const location = Array.from(element.querySelectorAll(".locations a, .locations span"))
          .map((node) => (node.textContent ?? "").trim())
          .filter(Boolean)
          .join(", ");

        const detailItems = Array.from(element.querySelectorAll(".detail-row-1 .row-1-item"));
        let compensation: string | null = null;
        let duration: string | null = null;
        let experienceLevel: string | null = null;

        detailItems.forEach((item) => {
          const iconClass = item.querySelector("i")?.className ?? "";
          const value = (item.textContent ?? "").trim();
          if (iconClass.includes("money")) {
            compensation = value || null;
          } else if (iconClass.includes("calendar")) {
            duration = value || null;
          } else if (iconClass.includes("briefcase")) {
            experienceLevel = value || null;
          }
        });

        return {
          href: element.querySelector<HTMLAnchorElement>(".job-title-href")?.getAttribute("href") ?? null,
          title: text(".job-title-href"),
          company: text(".company-name"),
          location,
          compensation,
          duration,
          experienceLevel,
          description: text(".about_job .text"),
          skills: Array.from(element.querySelectorAll(".job_skill")).map((node) => (node.textContent ?? "").trim()).filter(Boolean),
          freshnessLabel: text(".detail-row-2 .color-labels div[class*='status'] span"),
          isInternship,
        };
      }),
    );

  const jobs: UnifiedJob[] = [];
  for (const card of cards) {
    const job = normalizeInternshalaCard(card);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

async function scrapeInternshalaQuery(query: string) {
  const slug = slugifyQuery(query);
  const urls = [
    {
      url: `https://internshala.com/internships/${slug}-internship`,
      isInternship: true,
    },
    {
      url: `https://internshala.com/jobs/fresher-${slug}-jobs`,
      isInternship: false,
    },
  ];

  const results = await Promise.allSettled(
    urls.map(async ({ url, isInternship }) =>
      scrapeListingPage("Internshala", url, (page) =>
        scrapeInternshalaCards(page, isInternship),
      ),
    ),
  );

  const jobs: UnifiedJob[] = [];
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
      return;
    }

    logProviderFailure("Internshala", result.reason);
  });

  return jobs;
}

export class InternshalaProvider implements JobProvider {
  name = "Internshala";

  async fetchJobs(query: string): Promise<UnifiedJob[]> {
    return withProviderCache(`${this.name}:${query}`, async () => {
      try {
        return await scrapeInternshalaQuery(query);
      } catch (error) {
        logProviderFailure(this.name, error);
        return [];
      }
    });
  }
}

export class NaukriProvider implements JobProvider {
  name = "Naukri";

  async fetchJobs(query: string): Promise<UnifiedJob[]> {
    return withProviderCache(`${this.name}:${query}`, async () => {
      const slug = slugifyQuery(query);
      const url = `https://www.naukri.com/${slug}-jobs-in-india`;

      try {
        return await scrapeListingPage(this.name, url, async (page): Promise<UnifiedJob[]> => {
          const rawJobs = await page
            .locator(".srp-jobtuple-wrapper, article.jobTuple, .cust-job-tuple")
            .evaluateAll((elements) =>
              elements.map((element) => {
                const pickText = (selector: string) =>
                  (element.querySelector(selector)?.textContent ?? "").trim();

                const href =
                  element
                    .querySelector<HTMLAnchorElement>("a.title, a[title]")
                    ?.getAttribute("href") ?? null;
                const location = pickText(".locWdth, .location");
                const experienceLevel = pickText(".expwdth, .experience");
                const freshnessLabel = pickText(".job-post-day, .job-post-day-time, .time");

                return {
                  externalId: `naukri-${href ?? pickText("a.title, a[title]")}-${pickText(".comp-name, .companyInfo a")}`,
                  source: "Naukri",
                  title: pickText("a.title, a[title]"),
                  company: pickText(".comp-name, .companyInfo a"),
                  location,
                  description: pickText(".job-desc, .job-description"),
                  applyUrl: href,
                  salaryRange: pickText(".sal-wrap, .salary"),
                  experienceLevel,
                  isInternship: /intern/i.test(pickText("a.title, a[title]")),
                  isFresherFriendly: /fresher|0|1 year|entry/i.test(experienceLevel),
                  freshnessLabel,
                  keywords: Array.from(element.querySelectorAll(".tags-gt li, .tags li"))
                    .map((node) => (node.textContent ?? "").trim())
                    .filter(Boolean),
                };
              }),
            )
            .catch(() => []);

          const normalizedJobs: UnifiedJob[] = [];
          for (const job of rawJobs) {
            const postedAt = parseRelativePostedAt(job.freshnessLabel ?? null);
            if (!job.title || !job.company || !job.description) {
              continue;
            }

            normalizedJobs.push({
              externalId: job.externalId,
              source: "Naukri",
              title: job.title,
              company: job.company,
              location: job.location || "India",
              type: inferJobType(job.location || "India", job.description),
              description: job.description,
              applyUrl: job.applyUrl ?? null,
              duration: null,
              salaryRange: job.salaryRange || null,
              experienceLevel: job.experienceLevel || null,
              isInternship: job.isInternship,
              isFresherFriendly: job.isFresherFriendly,
              // Fix: always use classifyFreshness to get a proper JobFreshnessBucket enum value
              freshnessBucket: postedAt ? classifyFreshness(postedAt) : JobFreshnessBucket.UNKNOWN,
              keywords: normalizeKeywords(job.keywords),
              postedAt,
            });
          }

          return normalizedJobs;
        });
      } catch (error) {
        logProviderFailure(this.name, error);
        return [];
      }
    });
  }
}

export class WellfoundProvider implements JobProvider {
  name = "Wellfound";

  async fetchJobs(query: string): Promise<UnifiedJob[]> {
    return withProviderCache(`${this.name}:${query}`, async () => {
      const url = "https://wellfound.com/jobs";

      try {
        return await scrapeListingPage(this.name, url, async (page): Promise<UnifiedJob[]> => {
          const jobs = await page
            .locator("a[href*='/jobs/']")
            .evaluateAll((elements) =>
              elements.slice(0, 40).map((element) => {
                const container = element.closest("article, div");
                const text = (container?.textContent ?? "").trim();

                return {
                  href: element.getAttribute("href"),
                  title: (element.textContent ?? "").trim(),
                  text,
                };
              }),
            )
            .catch(() => []);

          const normalizedJobs: UnifiedJob[] = [];
          for (const job of jobs) {
            if (!job.title || !job.href || !job.text) {
              continue;
            }

            const normalized = job.text.toLowerCase();
            if (
              !/india|remote|frontend|backend|ai|intern/i.test(
                `${normalized} ${query.toLowerCase()}`,
              )
            ) {
              continue;
            }

            const postedAt = parseRelativePostedAt(
              job.text.match(/(\d+\s+(?:hour|hours|day|days|week|weeks)\s+ago|just now|few hours ago)/i)?.[0] ?? null,
            );
            const locationMatch =
              job.text.match(/remote.*india|india remote|bangalore|bengaluru|pune|hyderabad|gurgaon|gurugram|india/i)?.[0] ?? "India";
            const company = job.text
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean)[1] ?? "Wellfound Startup";

            normalizedJobs.push({
              externalId: `wellfound-${job.href}`,
              source: "Wellfound",
              title: job.title,
              company,
              location: locationMatch,
              type: inferJobType(locationMatch, job.text),
              description: job.text,
              applyUrl: makeAbsoluteUrl("https://wellfound.com", job.href),
              duration: /intern/i.test(job.title) ? "Internship" : null,
              salaryRange: null,
              experienceLevel: /intern/i.test(job.title) ? "Internship" : null,
              isInternship: /intern/i.test(job.title),
              isFresherFriendly: /intern|junior|entry/i.test(job.title),
              freshnessBucket: postedAt ? classifyFreshness(postedAt) : JobFreshnessBucket.UNKNOWN,
              keywords: normalizeKeywords(
                Array.from(
                  new Set(
                    job.text.match(/\b(?:react|next\.js|frontend|backend|ai|ml|python|typescript|node)\b/gi) ?? [],
                  ),
                ),
              ),
              postedAt,
            });
          }

          return normalizedJobs;
        });
      } catch (error) {
        logProviderFailure(this.name, error);
        return [];
      }
    });
  }
}
