import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { getServerEnv } from "./env";

// Retrieve Upstash Redis environment variables
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getServerEnv();

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be defined in your environment variables for rate limiting to work.",
  );
}

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// Define different rate limit configurations
export const rateLimitPresets = {
  strict: {
    tokens: 10, // 10 requests
    window: "1m", // per minute
    prefix: "ratelimit:strict",
  },
  moderate: {
    tokens: 20, // 20 requests
    window: "1h", // per hour
    prefix: "ratelimit:moderate",
  },
} as const;

/**
 * Creates a rate limiter instance.
 * @param config - The rate limit configuration (tokens, window, prefix).
 * @returns A Ratelimit instance.
 */
export function getRateLimiter(
  config: (typeof rateLimitPresets)[keyof typeof rateLimitPresets],
) {
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.fixedWindow(config.tokens, config.window),
    ephemeralCache: new Map(), // Used to store the state of the rate limiter in memory for a short period
    analytics: true,
    prefix: config.prefix,
  });
}

/**
 * Extracts a unique identifier for rate limiting.
 * Prioritizes Clerk userId, falls back to IP address.
 * @param userId - The Clerk user ID (optional).
 * @param request - The Next.js request object.
 * @returns A string identifier for rate limiting.
 */
export function getIdentifier(userId: string | null | undefined, request: Request) {
  if (userId) {
    return userId;
  }

  // Fallback to IP address if userId is not available
  // Vercel deployment will provide 'x-forwarded-for' or 'cf-connecting-ip'
  // For local development, this might be '127.0.0.1' or similar
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? "127.0.0.1";
  return ip;
}

/**
 * Helper function to create a rate-limited response for API routes.
 * @param limit - The Ratelimit object.
 * @param identifier - The unique identifier (user ID or IP).
 * @returns A Promise that resolves to a NextResponse if rate limited, otherwise null.
 */
export async function withRateLimit(
  limit: Ratelimit,
  identifier: string,
) {
  const { success, pending, limit: rateLimitLimit, reset, remaining } = await limit.limit(identifier);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: `Rate limit exceeded. Please try again after ${retryAfter} seconds.`,
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitLimit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": retryAfter.toString(),
          "Content-Type": "application/json",
        },
      },
    );
  }
  return null; // Not rate limited
}
