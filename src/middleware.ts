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
  // La asistencia técnica dejó de ser una ficha con precio y pasó a banda de cierre en la tienda:
  // la oferta sigue existiendo, lo que ya no existe es la SKU. La URL estaba publicada y en el
  // sitemap desde agosto, así que devuelve al listado —que es donde ahora vive el ofrecimiento—
  // en vez de morir en 404.
  [/^\/meliponas\/tienda\/asistencia-tecnica-mensual\/?$/, () => '/meliponas/tienda'],
  // Las tres presentaciones de la miel Angelita estaban mal numeradas el 2026-10-06: la que se
  // vendía como 120 ml es en realidad la de 25 ml en gotero ámbar, la de 250 ml es la de 60 ml en
  // botella pequeña y la de 500 ml es la de 120 ml en frasco. Los precios no se movieron.
  //
  // Los slugs nuevos llevan el envase porque si no la corrección se muerde la cola: el URL
  // `miel-angelita-120ml` de la ficha de $25.000 es exactamente el URL que la ficha de $78.000
  // pasaría a ocupar, así que un 301 sobre esa ruta habría tapado una página viva y enviado a
  // quien la tenía en marcadores a un producto cuatro veces más caro. Con el envase en el slug
  // —el mismo arreglo que ya usan `casa-techada-pedestal` y `casa-techada-pared`— las tres rutas
  // viejas quedan desocupadas y las tres devoluciones son honestas.
  [/^\/meliponas\/tienda\/miel-angelita-120ml\/?$/, () => '/meliponas/tienda/miel-angelita-25ml-gotero'],
  [/^\/meliponas\/tienda\/miel-angelita-250ml\/?$/, () => '/meliponas/tienda/miel-angelita-60ml-botella'],
  [/^\/meliponas\/tienda\/miel-angelita-500ml\/?$/, () => '/meliponas/tienda/miel-angelita-120ml-frasco'],
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
