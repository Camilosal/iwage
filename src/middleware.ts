import { defineMiddleware } from 'astro:middleware';

/**
 * 301 Redirect map for legacy routes that need a trailing slash variant covered, plus
 * dynamic slug routes. Nginx still handles the root-level legacy paths.
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
  // /gestion/propiedades → /gestion/alojamientos (las páginas se movieron en la migración)
  [/^\/gestion\/propiedades\/?$/, () => '/gestion/alojamientos'],
  [/^\/gestion\/propiedades\/([^/]+)\/?$/, (m) => `/gestion/alojamientos/${m[1]}`],
  // Las dos hojas que se borraron al disolver el grupo «Herramientas» de la navegación. Van aquí y
  // no en nginx porque `\/?$` cubre las dos formas (/ruta y /ruta/) con una sola línea; nginx
  // necesitaría un bloque exacto por cada una. El ancla final es lo que deja pasar las tres fichas
  // de estándar, que siguen vivas debajo de /meliponas/trazabilidad/.
  [/^\/meliponas\/trazabilidad\/?$/, () => '/meliponas/investigacion'],
  [/^\/meliponas\/herramientas\/?$/, () => '/meliponas/'],
  // La puerta vieja del blog de Meliponas estaba en nginx y mandaba a `/blog`, una hoja que no
  // existe en ningún lado del repo: el 301 prometía una página y entregaba un 404. Va aquí por
  // el mismo motivo que las dos de arriba —`\/?$` cubre `/meliponas/blog` y `/meliponas/blog/`
  // con una sola línea— y el destino es la bitácora de la marca, que es lo que ese blog era.
  [/^\/meliponas\/blog\/?$/, () => '/meliponas/bitacora'],
  // La «Caja INPA con atril» se retiró del catálogo el 2026-10-05: el mismo paquete ya existe
  // como dos fichas (Caja INPA Mediana + su soporte) y como Kit Meliponas Inicio. La URL
  // vieja sigue circulando en Google y en los WhatsApp reenviados, así que devuelve a la caja
  // y no a la tienda entera.
  [/^\/meliponas\/tienda\/caja-inpa-con-atril\/?$/, () => '/meliponas/tienda/caja-inpa-nogal-cafetero'],
  // El atril de guadua salió del catálogo el 2026-10-05 y lo reemplaza la casa techada: además
  // de montar la caja, la cubre de la lluvia. Apunta al modelo de pedestal, que es el
  // representante de la familia en el listado y el único de los dos con foto a 1024 px.
  [/^\/meliponas\/tienda\/atril-de-guadua\/?$/, () => '/meliponas/tienda/casa-techada-pedestal'],
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

  // SEO endpoints (robots/sitemap) definen sus propios headers de cache
  if (path === '/robots.txt' || path === '/sitemap.xml' || path === '/sitemap-index.xml') {
    return response;
  }

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
