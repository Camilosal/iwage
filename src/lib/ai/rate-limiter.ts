/**
 * Configurable in-memory rate limiter.
 * Replaces duplicated Map-based limiters across API routes.
 */

interface RateEntry {
  count: number;
  reset: number;
}

export interface RateLimiterConfig {
  /** Max requests per window. Default: 10 */
  maxRequests?: number;
  /** Window duration in ms. Default: 60000 (1 min) */
  windowMs?: number;
}

export class RateLimiter {
  private store = new Map<string, RateEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimiterConfig = {}) {
    this.maxRequests = config.maxRequests ?? 10;
    this.windowMs = config.windowMs ?? 60_000;
  }

  /**
   * Check if a request from the given key (usually IP) is allowed.
   * Returns true if allowed, false if rate-limited.
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.reset) {
      this.store.set(key, { count: 1, reset: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) return false;
    entry.count++;
    return true;
  }

  /** Extract client IP from request context */
  static getClientIp(clientAddress: string | undefined, headers: Headers): string {
    return clientAddress || headers.get('x-forwarded-for') || 'unknown';
  }
}

// ── Pre-configured instances for common use cases ────────

/** Chat endpoint: 10 req/min */
export const chatLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });

/** AI match: 5 req/min */
export const matchLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Business insights: 3 req/min */
export const insightsLimiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });

/** Storytelling: 5 req/min */
export const storytellingLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
