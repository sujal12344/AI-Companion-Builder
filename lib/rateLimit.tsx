import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { log } from "console";

export async function rateLimit(identifier: string) {
  log("rateLimitProps", identifier);
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(1, "10 s"),
    analytics: true,
    prefix: "@upstash/ratelimit",
  });
  log("RateLimit", Ratelimit);
  log("ratelimit", ratelimit);
  log("ratelimit.limit", ratelimit.limit);
  return await ratelimit.limit(identifier);
}
