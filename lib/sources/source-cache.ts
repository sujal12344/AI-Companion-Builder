// High-speed in-memory cache to prevent database overload during polling
export const sourceCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_TTL_MS = 3500; // 3.5s cache for fast, responsive polling (15ms latency)

export function invalidateSourceCache(sourceId?: string) {
  if (sourceId) {
    sourceCache.delete(sourceId);
  } else {
    sourceCache.clear();
  }
}
