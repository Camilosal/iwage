import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const start = Date.now();
  const checks: Record<string, string> = {};

  // Check Strapi
  try {
    const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    const res = await fetch(`${strapiUrl}/_health`, { signal: AbortSignal.timeout(3000) });
    checks.strapi = res.ok ? 'ok' : `error:${res.status}`;
  } catch {
    checks.strapi = 'unreachable';
  }

  // Check Redis (optional)
  try {
    const { redisGet } = await import('../../lib/redis');
    await redisGet('health:ping');
    checks.redis = 'ok';
  } catch {
    checks.redis = 'unavailable';
  }

  const healthy = checks.strapi === 'ok';
  const uptime = Date.now() - start;

  return new Response(
    JSON.stringify({
      status: healthy ? 'healthy' : 'degraded',
      uptime_ms: uptime,
      checks,
      timestamp: new Date().toISOString(),
      brands: ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion'],
    }),
    {
      status: healthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
