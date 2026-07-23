import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export async function rateLimit(identifier: string) {
  // If Upstash Redis credentials are not configured, skip rate limiting
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('⚠️  Rate limiting disabled: Upstash Redis not configured');
    return { success: true, limit: 10, remaining: 10, reset: 0 };
  }

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    analytics: true,
    prefix: "@upstash/ratelimit",
  });
  return await ratelimit.limit(identifier);
}
