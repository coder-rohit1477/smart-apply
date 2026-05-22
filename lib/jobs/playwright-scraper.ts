import "server-only";

import type { Browser, BrowserContext, Page } from "playwright";

import type { UnifiedJob } from "@/types/jobs";
import { sleep } from "./utils";

const SCRAPER_CACHE_TTL_MS = 10 * 60 * 1000;
const PROVIDER_MIN_INTERVAL_MS = 2500;

class ProviderBlockedError extends Error {
  constructor(
    providerName: string,
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`[${providerName}] blocked: ${reason}`);
    this.name = "ProviderBlockedError";
  }
}

type CacheEntry = {
  expiresAt: number;
  jobs: UnifiedJob[];
};

const globalState = globalThis as typeof globalThis & {
  __smartApplyScraperCache?: Map<string, CacheEntry>;
  __smartApplyLastRun?: Map<string, number>;
};

function getCache() {
  if (!globalState.__smartApplyScraperCache) {
    globalState.__smartApplyScraperCache = new Map();
  }

  return globalState.__smartApplyScraperCache;
}

function getLastRunMap() {
  if (!globalState.__smartApplyLastRun) {
    globalState.__smartApplyLastRun = new Map();
  }

  return globalState.__smartApplyLastRun;
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
  });

  await context.setExtraHTTPHeaders({
    "accept-language": "en-IN,en;q=0.9",
    referer: "https://www.google.com/",
  });

  await context.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") {
      await route.abort();
      return;
    }

    await route.continue();
  });

  return context;
}

async function enforceProviderRateLimit(providerName: string) {
  const lastRunMap = getLastRunMap();
  const previous = lastRunMap.get(providerName) ?? 0;
  const waitMs = PROVIDER_MIN_INTERVAL_MS - (Date.now() - previous);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRunMap.set(providerName, Date.now());
}

async function withRetry<T>(providerName: string, fn: (attempt: number) => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderBlockedError) {
        break;
      }

      console.warn(`[${providerName}] scrape attempt ${attempt} failed`, error);
      if (attempt < 2) {
        await sleep(1250 * attempt);
      }
    }
  }

  throw lastError;
}

async function openPage(providerName: string, url: string) {
  const { chromium } = await import("playwright");
  await enforceProviderRateLimit(providerName);

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await createContext(browser);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3500);
  return { browser, context, page };
}

export async function withProviderCache(
  cacheKey: string,
  producer: () => Promise<UnifiedJob[]>,
) {
  const cache = getCache();
  const entry = cache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.jobs;
  }

  const jobs = await producer();
  cache.set(cacheKey, {
    expiresAt: Date.now() + SCRAPER_CACHE_TTL_MS,
    jobs,
  });
  return jobs;
}

export function detectBotWall(title: string, bodyText: string) {
  const haystack = `${title} ${bodyText}`.toLowerCase();
  return /access denied|captcha|datadome|cloudflare|unusual traffic|forbidden|verify you are human/.test(
    haystack,
  );
}

export async function scrapeListingPage(
  providerName: string,
  url: string,
  extractor: (page: Page) => Promise<UnifiedJob[]>,
) {
  return withRetry(providerName, async () => {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const session = await openPage(providerName, url);
      browser = session.browser;
      context = session.context;

      const title = await session.page.title();
      const bodyText = await session.page.locator("body").innerText().catch(() => "");
      if (detectBotWall(title, bodyText)) {
        throw new ProviderBlockedError(providerName, url, title || "bot wall detected");
      }

      return await extractor(session.page);
    } finally {
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  });
}

export function logProviderFailure(providerName: string, error: unknown) {
  if (error instanceof ProviderBlockedError) {
    console.warn(`[${providerName}] blocked by anti-bot controls`, {
      url: error.url,
      reason: error.reason,
    });
    return;
  }

  console.error(`[${providerName}] scrape failed`, error);
}
