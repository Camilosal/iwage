import { defineMiddleware } from 'astro:middleware';

/**
 * 301 Redirect map for dynamic slug routes (nginx handles static ones).
 * Pattern: [regex, replacement function]
 */
const DYNAMIC_REDIRECTS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  // /experiencia/:slug → /naturaleza/experiencias/:slug
  [/^\/experiencia\/([^/]+)\/?$/, (m) => `/naturaleza/experiencias/${m[1]}`],
  // /anfitrion/:slug → /naturaleza/anfitriones/:slug
  [/^\/anfitrion\/([^/]+)\/?$/, (m) => `/naturaleza/anfitriones/${m[1]}`],
  // /propiedades/:id → /tierras/propiedades/:id
  [/^\/propiedades\/([^/]+)\/?$/, (m) => `/tierras/propiedades/${m[1]}`],
  // /gestion/modelo-alianzas → /gestion/propietarios/modelo-alianzas
  [/^\/gestion\/modelo-alianzas\/?$/, () => '/gestion/propietarios/modelo-alianzas'],
  // /gestion/renta-corta → /gestion/propietarios/renta-corta
  [/^\/gestion\/renta-corta\/?$/, () => '/gestion/propietarios/renta-corta'],
  // /gestion/finca-productiva → /gestion/propietarios/finca-productiva
  [/^\/gestion\/finca-productiva\/?$/, () => '/gestion/propietarios/finca-productiva'],
  // /gestion/segunda-residencia → /gestion/propietarios/segunda-residencia
  [/^\/gestion\/segunda-residencia\/?$/, () => '/gestion/propietarios/segunda-residencia'],
  // /gestion/operacion-turistica → /gestion/propietarios/operacion-turistica
  [/^\/gestion\/operacion-turistica\/?$/, () => '/gestion/propietarios/operacion-turistica'],
  // /cafe/:anything → /cafe/:anything (subdomain catch-all handled at DNS level)
];

/**
 * Astro middleware:
 * 1. Handles dynamic 301 redirects for legacy routes
 * 2. Sets HTTP cache headers per route type (layered with nginx SWR)
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // ── Dynamic 301 Redirects ──────────────────────────
  for (const [pattern, resolve] of DYNAMIC_REDIRECTS) {
    const match = path.match(pattern);
    if (match) {
      const target = resolve(match);
      return context.redirect(target, 301);
    }
  }

  const response = await next();

  // Never cache API mutations or admin
  if (path.startsWith('/api/') || path.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }

  // Property/experience search: short cache
  if (path.includes('/propiedades') || path.includes('/experiencias')) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
    );
    return response;
  }

  // Static-ish pages (gestion, protocolo, herramientas): long cache
  if (
    path.startsWith('/gestion/') ||
    path.includes('/protocolo') ||
    path.includes('/herramientas/')
  ) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'
    );
    return response;
  }

  // Default: moderate SWR cache for all HTML pages
  response.headers.set(
    'Cache-Control',
    'public, max-age=60, s-maxage=120, stale-while-revalidate=3600'
  );

  return response;
});
