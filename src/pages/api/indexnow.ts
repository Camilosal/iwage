/**
 * IndexNow API — notifica a Bing y Yandex de URLs nuevas o actualizadas
 * para indexación inmediata (minutos en vez de días).
 *
 * POST /api/indexnow
 * Body: { urls: string[] } — URLs absolutas a enviar
 * Header: x-api-key: INDEXNOW_SECRET (protección contra abuso)
 *
 * La key de IndexNow se almacena como variable de entorno INDEXNOW_KEY.
 * El archivo de verificación se sirve en /api/indexnow-key.ts.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';

const INDEXNOW_KEY = import.meta.env.INDEXNOW_KEY || 'iwage-indexnow-2024-key';
const INDEXNOW_SECRET = import.meta.env.INDEXNOW_SECRET || 'iwage-internal-secret';
const SITE_HOST = new URL(SITE.url).host;

// IndexNow endpoints
const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/IndexNow',       // Bing + Yandex + others
  'https://yandex.com/indexnow',              // Yandex direct
];

interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== INDEXNOW_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const urls = body.urls;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify({ error: 'urls array required (max 10000)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Normalize: ensure all URLs are absolute
  const normalizedUrls = urls.map((u) =>
    u.startsWith('http') ? u : `${SITE.url.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`
  );

  // Cap at 10000 (IndexNow limit)
  const urlList = normalizedUrls.slice(0, 10000);

  const payload: IndexNowPayload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE.url.replace(/\/$/, '')}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  // Submit to all IndexNow endpoints in parallel
  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map(async (endpoint) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      return { endpoint, status: res.status, ok: res.ok };
    })
  );

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { endpoint: 'unknown', status: 0, ok: false, error: r.reason?.message }
  );

  return new Response(
    JSON.stringify({
      submitted: urlList.length,
      results: summary,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

// GET: Quick health check / usage info
export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      service: 'IndexNow',
      description: 'POST URLs for instant indexation in Bing/Yandex',
      usage: 'POST /api/indexnow with { urls: [...] } and x-api-key header',
      key: INDEXNOW_KEY,
      host: SITE_HOST,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
