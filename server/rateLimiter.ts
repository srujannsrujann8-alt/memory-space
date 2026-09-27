/**
 * Rate Limiter for Abuse Protection (Phase 9B.4)
 *
 * Sliding-window in-memory rate limiter per authenticated user.
 * Configurable via:
 *   RATE_LIMIT_WINDOW_MS (default: 60,000 = 1 minute)
 *   RATE_LIMIT_MAX_REQUESTS (default: 30 requests / minute)
 */

import type { ServerResponse } from 'http';

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Periodic cleanup of stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000;
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < maxAge);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export function checkRateLimit(
  userId: string,
  options?: RateLimitOptions
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const windowMs =
    options?.windowMs ||
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    60_000; // 1 minute default

  const maxRequests =
    options?.maxRequests ||
    Number(process.env.RATE_LIMIT_MAX_REQUESTS) ||
    30; // 30 requests / window default

  const now = Date.now();
  let record = store.get(userId);

  if (!record) {
    record = { timestamps: [] };
    store.set(userId, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, maxRequests - record.timestamps.length);

  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Convenience helper to handle rate limiting directly on a response.
 * Returns true if allowed, false if rejected (and sends 429).
 */
export function enforceRateLimit(
  res: ServerResponse,
  userId: string,
  actionName: string = 'request',
  options?: RateLimitOptions
): boolean {
  const result = checkRateLimit(userId, options);
  if (!result.allowed) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.end(
      JSON.stringify({
        success: false,
        status: 429,
        error: `Rate limit exceeded for ${actionName}. Please wait ${result.retryAfterSeconds} seconds before trying again.`,
        retry_after: result.retryAfterSeconds,
      })
    );
    return false;
  }
  return true;
}
