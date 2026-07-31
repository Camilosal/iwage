/**
 * Strapi Webhook receiver → triggers IndexNow submission.
 * Configure Strapi to POST to /api/webhook/publish on entry.publish events.
 * This automatically notifies Bing/Yandex when new content goes live.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';

const INDEXNOW_KEY = import.meta.env.INDEXNOW_KEY || 'iwage-indexnow-2024-key';
const SITE_HOST = new URL(SITE.url).host;
const WEBHOOK_SECRET = import.meta.env.STRAPI_WEBHOOK_SECRET || '';

// Map Strapi content types to URL paths
const CONTENT_TYPE_ROUTES: Record<string, (entry: any) => string | null> = {
  'api::producto.producto': (e) => e.slug ? `/meliponas/tienda/${e.slug}` : null,
  'api::propiedad.propiedad': (e) => e.slug ? `/tierras/propiedades/${e.slug}` : null,
  'api::experiencia.experiencia': (e) => e.slug ? `/naturaleza/experiencias/${e.slug}` : null,
  'api::bitacora.bitacora': (e) => {
    if (!e.slug || !e.marca) return null;
    const brandMap: Record<string, string> = { meliponas: 'meliponas', cafe: 'cafe', tierras: 'tierras', naturaleza: 'naturaleza', gestion: 'gestion', granja: 'granja' };
    const brand = brandMap[e.marca];
    return brand ? `/${brand}/bitacora/${e.slug}` : null;
  },
  'api::proyecto-meliponario.proyecto-meliponario': (e) => e.slug ? `/meliponas/proyectos/${e.slug}` : null,
  'api::anfitrion.anfitrion': (e) => e.slug ? `/naturaleza/anfitriones/${e.slug}` : null,
  'api::paquete.paquete': (e) => e.slug ? `/naturaleza/programas/${e.slug}` : null,
};

export const POST: APIRoute = async ({ request }) => {
  // Optional: verify webhook secret
  if (WEBHOOK_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { event, model, entry } = payload;

  // Only handle publish events
  if (event !== 'entry.publish' && event !== 'entry.update') {
    return new Response(JSON.stringify({ skipped: true, reason: `Event ${event} not handled` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve URL from content type
  const routeResolver = CONTENT_TYPE_ROUTES[model];
  if (!routeResolver) {
    return new Response(JSON.stringify({ skipped: true, reason: `Model ${model} not mapped` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const path = routeResolver(entry);
  if (!path) {
    return new Response(JSON.stringify({ skipped: true, reason: 'No slug in entry' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fullUrl = `${SITE.url.replace(/\/$/, '')}${path}`;

  // Submit to IndexNow
  const indexNowPayload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE.url.replace(/\/$/, '')}/${INDEXNOW_KEY}.txt`,
    urlList: [fullUrl],
  };

  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowPayload),
    });

    return new Response(
      JSON.stringify({
        indexed: true,
        url: fullUrl,
        indexnow_status: res.status,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        indexed: false,
        url: fullUrl,
        error: err.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
