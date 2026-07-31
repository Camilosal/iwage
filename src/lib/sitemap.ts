/**
 * Sitemap dinámico — recolecta TODAS las URLs públicas del sitio:
 * páginas estáticas (src/pages) + contenido dinámico de Strapi
 * (productos, propiedades, experiencias, anfitriones, programas,
 * proyectos, cultivos, landings SEO y bitácoras de cada marca).
 * Cada consulta a Strapi ya pasa por Redis vía strapiFetch.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { PERFILES_COMPRADOR } from './tierras';
import { getCultivos } from './polinizacion';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

// ── Páginas estáticas (rutas de src/pages sin parámetros) ──
const STATIC_PAGES: Array<[path: string, priority: number, changefreq: SitemapUrl['changefreq']]> = [
  // Hub
  ['/', 1.0, 'daily'],

  // Meliponas
  ['/meliponas/', 0.9, 'daily'],
  ['/meliponas/tienda', 0.9, 'daily'],
  ['/meliponas/polinizacion', 0.8, 'weekly'],
  ['/meliponas/proyectos', 0.8, 'weekly'],
  ['/meliponas/proyectos/lineas/fincas-productivas', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/paisajismo-residencial', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/prae-educativo', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/turismo-naturaleza', 0.7, 'monthly'],
  ['/meliponas/herramientas', 0.6, 'monthly'],
  ['/meliponas/trazabilidad', 0.7, 'monthly'],
  ['/meliponas/trazabilidad/cajas', 0.6, 'monthly'],
  ['/meliponas/trazabilidad/miel', 0.6, 'monthly'],
  ['/meliponas/trazabilidad/polinizacion', 0.6, 'monthly'],
  ['/meliponas/bitacora', 0.8, 'daily'],
  ['/meliponas/nosotros', 0.6, 'monthly'],
  ['/meliponas/ayuda', 0.5, 'monthly'],
  ['/meliponas/contacto', 0.6, 'monthly'],

  // Café
  ['/cafe/', 0.9, 'daily'],
  ['/cafe/menu', 0.8, 'weekly'],
  ['/cafe/recetas', 0.7, 'weekly'],
  ['/cafe/proveedores', 0.7, 'weekly'],
  ['/cafe/bitacora', 0.8, 'daily'],
  ['/cafe/nosotros', 0.6, 'monthly'],
  ['/cafe/ayuda', 0.5, 'monthly'],
  ['/cafe/contacto', 0.6, 'monthly'],

  // Tierras
  ['/tierras/', 0.9, 'daily'],
  ['/tierras/propiedades', 0.9, 'daily'],
  ['/tierras/comprar', 0.7, 'monthly'],
  ['/tierras/vender', 0.7, 'monthly'],
  ['/tierras/protocolo-vap', 0.7, 'monthly'],
  ['/tierras/lab', 0.6, 'monthly'],
  ['/tierras/perfiles', 0.7, 'monthly'],
  ['/tierras/herramientas/calculadora-notarial', 0.6, 'monthly'],
  ['/tierras/herramientas/evaluacion-vap', 0.6, 'monthly'],
  ['/tierras/herramientas/roi-calculator', 0.6, 'monthly'],
  ['/tierras/bitacora', 0.8, 'daily'],
  ['/tierras/nosotros', 0.6, 'monthly'],
  ['/tierras/ayuda', 0.5, 'monthly'],
  ['/tierras/contacto', 0.6, 'monthly'],

  // Naturaleza
  ['/naturaleza/', 0.9, 'daily'],
  ['/naturaleza/experiencias', 0.9, 'daily'],
  ['/naturaleza/anfitriones', 0.8, 'weekly'],
  ['/naturaleza/anfitriones/hub', 0.6, 'monthly'],
  ['/naturaleza/programas', 0.8, 'weekly'],
  ['/naturaleza/clasificacion', 0.6, 'monthly'],
  ['/naturaleza/escalafon', 0.6, 'monthly'],
  ['/naturaleza/se-anfitrion', 0.7, 'monthly'],
  ['/naturaleza/impacto', 0.6, 'monthly'],
  ['/naturaleza/bitacora', 0.8, 'daily'],
  ['/naturaleza/ayuda', 0.5, 'monthly'],
  ['/naturaleza/contacto', 0.6, 'monthly'],

  // Gestión
  ['/gestion/', 0.9, 'daily'],
  ['/gestion/alojamientos', 0.8, 'weekly'],
  ['/gestion/propiedades', 0.8, 'weekly'],
  ['/gestion/experiencias', 0.7, 'weekly'],
  ['/gestion/propietarios', 0.7, 'monthly'],
  ['/gestion/propietarios/modelo-alianzas', 0.6, 'monthly'],
  ['/gestion/propietarios/renta-corta', 0.6, 'monthly'],
  ['/gestion/propietarios/finca-productiva', 0.6, 'monthly'],
  ['/gestion/propietarios/segunda-residencia', 0.6, 'monthly'],
  ['/gestion/propietarios/operacion-turistica', 0.6, 'monthly'],
  ['/gestion/bitacora', 0.8, 'daily'],
  ['/gestion/ayuda', 0.5, 'monthly'],
  ['/gestion/contacto', 0.6, 'monthly'],

  // Granja
  ['/granja/', 0.9, 'daily'],
  ['/granja/sistema', 0.8, 'weekly'],
  ['/granja/tienda', 0.9, 'daily'],
  ['/granja/visitas', 0.8, 'weekly'],
  ['/granja/bitacora', 0.8, 'daily'],
  ['/granja/nosotros', 0.6, 'monthly'],
  ['/granja/ayuda', 0.5, 'monthly'],
  ['/granja/contacto', 0.6, 'monthly'],

  // Ayuda global
  ['/ayuda/', 0.5, 'monthly'],
  ['/ayuda/usuarios/', 0.4, 'monthly'],
  ['/ayuda/usuarios/explorar-plataforma', 0.4, 'monthly'],
  ['/ayuda/usuarios/marcas', 0.4, 'monthly'],
  ['/ayuda/usuarios/tienda', 0.4, 'monthly'],
  ['/ayuda/usuarios/carrito', 0.4, 'monthly'],
  ['/ayuda/usuarios/pedidos', 0.4, 'monthly'],
  ['/ayuda/usuarios/reservas', 0.4, 'monthly'],
  ['/ayuda/usuarios/herramientas', 0.4, 'monthly'],
  ['/ayuda/usuarios/mi-cuenta', 0.4, 'monthly'],
  ['/ayuda/equipo/', 0.3, 'monthly'],
  ['/ayuda/equipo/configuracion', 0.3, 'monthly'],
  ['/ayuda/equipo/contenido-tipos', 0.3, 'monthly'],
  ['/ayuda/equipo/gestion-reservas', 0.3, 'monthly'],
  ['/ayuda/equipo/ordenes', 0.3, 'monthly'],
  ['/ayuda/equipo/pagos', 0.3, 'monthly'],
  ['/ayuda/equipo/portal-aliados', 0.3, 'monthly'],
  ['/ayuda/equipo/reservas-admin', 0.3, 'monthly'],
  ['/ayuda/equipo/sincronizacion', 0.3, 'monthly'],
  ['/ayuda/equipo/strapi-cms', 0.3, 'monthly'],

  // Legal
  ['/legal/', 0.3, 'yearly'],
  ['/legal/terminos-y-condiciones', 0.3, 'yearly'],
  ['/legal/tratamiento-de-datos', 0.3, 'yearly'],
  ['/legal/cookies', 0.3, 'yearly'],
  ['/legal/cancelaciones-y-reembolsos', 0.3, 'yearly'],
  ['/legal/devoluciones-y-retracto', 0.3, 'yearly'],
];

const MARCAS_BITACORA = new Set(['tierras', 'naturaleza', 'meliponas', 'cafe', 'gestion', 'granja']);

interface SlugEntry {
  slug: string;
  marca?: string;
  updatedAt?: string;
}

/**
 * Trae TODOS los slugs de una colección de Strapi paginando de a 100
 * (los helpers de cada lib cortan en la primera página).
 */
async function fetchAllSlugs(
  endpoint: string,
  filters?: Record<string, any>,
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
  } catch {
    // Strapi no disponible: se omite la colección (el sitemap sigue sirviendo lo demás)
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
export async function collectSitemapUrls(): Promise<SitemapUrl[]> {
  const [
    bitacoras,
    productos,
    proyectos,
    cultivos,
    propiedades,
    propiedadesGestion,
    experiencias,
    anfitriones,
    paquetes,
    landings,
  ] = await Promise.all([
    fetchAllSlugs('bitacoras'),
    fetchAllSlugs('productos'),
    fetchAllSlugs('proyecto-meliponarios'),
    // Cultivos: getCultivos() replica la página (incluye fallback a datos semilla)
    getCultivos()
      .then((cs) => cs.filter((c) => c.slug).map((c) => ({ slug: c.slug }) as SlugEntry))
      .catch(() => [] as SlugEntry[]),
    fetchAllSlugs('propiedades', { publicado: { $eq: true } }),
    fetchAllSlugs('propiedades-gestion', { publicado: { $eq: true } }),
    fetchAllSlugs('experiencias', { publicado: { $eq: true } }),
    fetchAllSlugs('anfitriones', { publicado: { $eq: true } }),
    fetchAllSlugs('paquetes', { activo: { $eq: true } }),
    fetchAllSlugs('seo-landings', { publicado: { $eq: true } }),
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
    ...toUrls(propiedadesGestion, '/gestion/propiedades', 0.7),
    ...toUrls(experiencias, '/naturaleza/experiencias', 0.8),
    ...toUrls(anfitriones, '/naturaleza/anfitriones', 0.7),
    ...toUrls(paquetes, '/naturaleza/programas', 0.7),
    ...toUrls(landings, '/tierras/landing', 0.6, 'monthly'),
    // Bitácoras: la URL depende de la marca de cada entrada
    ...toUrls(
      bitacoras,
      (e) => (e.marca && MARCAS_BITACORA.has(e.marca) ? `/${e.marca}/bitacora` : null),
      0.6,
    ),
  );

  // Deduplicar por loc conservando la primera aparición
  const seen = new Set<string>();
  return urls.filter((u) => (seen.has(u.loc) ? false : (seen.add(u.loc), true)));
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
