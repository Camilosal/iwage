/**
 * Redis client singleton with circuit breaker pattern.
 * Ported from app_marca_personal/packages/strapi-utils/src/redis.ts
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KEY_PREFIX = 'iwage:';

// Circuit breaker state
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_TTL = 15 * 60 * 1000; // 15 minutes

function isCircuitBreakerActive(): boolean {
  if (!circuitOpen) return false;
  if (Date.now() - circuitOpenedAt > CIRCUIT_TTL) {
    circuitOpen = false; // Half-open: allow retry
    return false;
  }
  return true;
}

function tripCircuitBreaker(): void {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
  console.warn('[redis] Circuit breaker tripped — Redis unavailable for 15min');
}

// Lazy singleton
let client: any = null;

async function getClient() {
  if (isCircuitBreakerActive()) return null;

  if (!client) {
    try {
      const { default: Redis } = await import('ioredis');
      client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) {
            tripCircuitBreaker();
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        connectTimeout: 5000,
      });
      await client.connect();
    } catch (err) {
      console.warn('[redis] Connection failed:', (err as Error).message);
      tripCircuitBreaker();
      client = null;
      return null;
    }
  }
  return client;
}

/** Get a value from Redis (namespaced) */
export async function redisGet(key: string): Promise<string | null> {
  const c = await getClient();
  if (!c) return null;
  try {
    return await c.get(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

/** Set a value in Redis with TTL (seconds) */
export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const c = await getClient();
  if (!c) return;
  try {
    await c.set(KEY_PREFIX + key, value, 'EX', ttlSeconds);
  } catch {
    // Silent fail — cache is best-effort
  }
}

/** Delete keys matching a pattern (non-blocking SCAN) */
export async function redisInvalidate(pattern: string): Promise<number> {
  const c = await getClient();
  if (!c) return 0;
  try {
    let deleted = 0;
    let cursor = '0';
    const fullPattern = KEY_PREFIX + pattern;
    do {
      const [nextCursor, keys] = await c.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await c.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  } catch {
    return 0;
  }
}

/** Get JSON from cache */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Set JSON in cache */
export async function cacheSet<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  await redisSet(key, JSON.stringify(data), ttlSeconds);
}
