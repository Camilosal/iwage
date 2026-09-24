/**
 * Sitemap dinámico — recolecta TODAS las URLs públicas del sitio:
 * páginas estáticas (src/pages) + contenido dinámico de Strapi
 * (productos, propiedades, experiencias, anfitriones, programas,
 * proyectos, cultivos y bitácoras de cada marca).
 * Cada consulta a Strapi ya pasa por Redis vía strapiFetch.
 *
 * La lista estática, el tipo de URL y la derivación de los índices de bitácora
 * viven en `sitemap-bitacora.ts` --lo puro, lo que `node --test` puede cargar—.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { PERFILES_COMPRADOR } from './tierras';
import { getCultivos } from './polinizacion';
import {
  indicesDeBitacora,
  MARCAS_BITACORA,
  STATIC_PAGES,
  type SlugEntry,
  type SitemapUrl,
} from './sitemap-bitacora';

/**
 * Trae TODOS los slugs de una colección de Strapi paginando de a 100
 * (los helpers de cada lib cortan en la primera página).
 */
async function fetchAllSlugs(
  endpoint: string,
  filters?: Record<string, any>,
  failed?: string[],
): Promise<SlugEntry[]> {
  const out: SlugEntry[] = [];
  try {
    let page = 1;
    const pageSize = 100;
    while (true) {
      const res = await strapiFetch<any>(endpoint, {
        ttl: CACHE_TTL.list,
        cacheKey: `strapi:sitemap:${endpoint}:${page}`,
        filters,
        sort: 'updatedAt:desc',
        pagination: { page, pageSize },
      });
      const items = res.data || [];
      for (const item of items) {
        if (item?.slug) {
          out.push({ slug: item.slug, marca: item.marca, updatedAt: item.updatedAt });
        }
      }
      const total = res.meta?.pagination?.total ?? items.length;
      if (page * pageSize >= total || items.length === 0) break;
      page += 1;
    }
  } catch (err) {
    // Strapi no disponible: se omite la colección (el sitemap sigue sirviendo lo demás),
    // pero queda registrado para que la ruta no cache un resultado incompleto.
    failed?.push(endpoint);
    console.error(`[sitemap] no se pudo cargar ${endpoint}:`, err instanceof Error ? err.message : err);
  }
  return out;
}

function toUrls(
  entries: SlugEntry[],
  basePath: string | ((e: SlugEntry) => string | null),
  priority: number,
  changefreq: SitemapUrl['changefreq'] = 'weekly',
): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  for (const e of entries) {
    const prefix = typeof basePath === 'function' ? basePath(e) : basePath;
    if (!prefix) continue;
    urls.push({
      loc: `${prefix}/${e.slug}`,
      lastmod: e.updatedAt ? e.updatedAt.slice(0, 10) : undefined,
      changefreq,
      priority,
    });
  }
  return urls;
}

/** Recolecta todas las URLs públicas del sitio (rutas relativas). */
export async function collectSitemapUrls(): Promise<{ urls: SitemapUrl[]; failed: string[] }> {
  const failed: string[] = [];
  const [
    bitacoras,
    experimentos,
    productos,
    proyectos,
    cultivos,
    propiedades,
    propiedadesGestion,
    experiencias,
    anfitriones,
    paquetes,
  ] = await Promise.all([
    fetchAllSlugs('bitacoras', { publicado: { $eq: true } }, failed),
    fetchAllSlugs('experimentos', void 0, failed),
    fetchAllSlugs('productos', void 0, failed),
    fetchAllSlugs('proyecto-meliponarios', void 0, failed),
    // Cultivos: getCultivos() replica la página (incluye fallback a datos semilla)
    getCultivos()
      .then((cs) => cs.filter((c) => c.slug).map((c) => ({ slug: c.slug }) as SlugEntry))
      .catch(() => {
        failed.push('cultivos');
        return [] as SlugEntry[];
      }),
    fetchAllSlugs('propiedades', { publicado: { $eq: true } }, failed),
    fetchAllSlugs('propiedades-gestion', { publicado: { $eq: true } }, failed),
    fetchAllSlugs('experiencias', { publicado: { $eq: true } }, failed),
    fetchAllSlugs('anfitriones', { publicado: { $eq: true } }, failed),
    fetchAllSlugs('paquetes', { activo: { $eq: true } }, failed),
  ]);

  const urls: SitemapUrl[] = STATIC_PAGES.map(([path, priority, changefreq]) => ({
    loc: path,
    priority,
    changefreq,
  }));

  // Perfiles de comprador (rutas prerenderizadas desde datos locales)
  for (const perfil of PERFILES_COMPRADOR) {
    urls.push({ loc: `/tierras/perfiles/${perfil.id}`, priority: 0.7, changefreq: 'monthly' });
  }

  // Contenido dinámico de Strapi
  urls.push(
    // Productos: la tienda depende de la marca (default meliponas)
    ...toUrls(productos, (e) => (e.marca === 'granja' ? '/granja/tienda' : '/meliponas/tienda'), 0.8),
    ...toUrls(proyectos, '/meliponas/proyectos', 0.7),
    ...toUrls(cultivos, '/meliponas/polinizacion', 0.7),
    ...toUrls(propiedades, '/tierras/propiedades', 0.8),
    ...toUrls(propiedadesGestion, '/gestion/alojamientos', 0.7),
    ...toUrls(experiencias, '/naturaleza/experiencias', 0.8),
    ...toUrls(anfitriones, '/naturaleza/anfitriones', 0.7),
    ...toUrls(paquetes, '/naturaleza/programas', 0.7),
    // Bitácoras: la URL depende de la marca de cada entrada (granja usa experimentos)
    ...toUrls(
      bitacoras,
      (e) => (e.marca && MARCAS_BITACORA.has(e.marca) ? `/${e.marca}/bitacora` : null),
      0.6,
    ),
    // El índice de cada marca con contenido, con el updatedAt más nuevo de esa marca
    // como lastmod. Las cuatro marcas sin filas publicadas no emiten: su `/bitacora`
    // responde `noindex, follow` y declararlo era una señal cruzada.
    ...indicesDeBitacora(bitacoras),
    // Experimentos Granja
    ...toUrls(experimentos, '/granja/experimentos', 0.7),
  );

  // Deduplicar por loc conservando la primera aparición
  const seen = new Set<string>();
  return {
    urls: urls.filter((u) => (seen.has(u.loc) ? false : (seen.add(u.loc), true))),
    failed,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Genera el XML del sitemap con URLs absolutas sobre `siteUrl`. */
export function renderSitemapXml(siteUrl: string, urls: SitemapUrl[]): string {
  const base = siteUrl.replace(/\/+$/, '');
  const body = urls
    .map((u) => {
      const loc = escapeXml(`${base}${u.loc.startsWith('/') ? u.loc : `/${u.loc}`}`);
      const parts = [`    <loc>${loc}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined) parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
