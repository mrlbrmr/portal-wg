const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    if (store.size > 10_000) {
      for (const [key, val] of store.entries()) {
        if (val.resetAt <= now) store.delete(key);
      }
    }
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}
