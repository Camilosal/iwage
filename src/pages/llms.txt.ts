/**
 * llms.txt generado: los conteos y el catálogo de publicaciones salen de Strapi en
 * cada construcción, así que no pueden volver a quedarse atrás como pasaba con la
 * copia estática de public/.
 */
import type { APIRoute } from 'astro';
import plantilla from '@/data/llms-plantilla.txt?raw';
import { aplicarConteos, seccionBitacora, type PublicacionLlms } from '@/lib/llms';
import { MARCAS_BITACORA } from '@/lib/sitemap-bitacora';
import { strapiFetch, CACHE_TTL } from '@/lib/strapi';
import { collectSitemapUrls } from '@/lib/sitemap';

const PAGINA = 100;

export const GET: APIRoute = async () => {
  const [bitacora, tierras, gestion, urls] = await Promise.all([
    filasDeBitacora(),
    total('propiedades', { publicado: { $eq: true } }),
    total('propiedades-gestion', { publicado: { $eq: true } }),
    collectSitemapUrls().then((r) => r.urls.length),
  ]);

  return new Response(
    aplicarConteos(plantilla, {
      publicaciones: bitacora.total,
      propiedades: tierras + gestion, // la línea habla de "portafolio (Tierras + Gestión)"
      urls,
      bitacora: seccionBitacora(bitacora.entradas),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
};

/** Total de una colección; 0 si Strapi no responde (mejor un número bajo que un 500). */
async function total(endpoint: string, filters: Record<string, unknown>): Promise<number> {
  try {
    const res = await strapiFetch<any>(endpoint, {
      ttl: CACHE_TTL.list,
      cacheKey: `llms:total:${endpoint}`,
      filters,
      pagination: { page: 1, pageSize: 1 },
    });
    return res.meta?.pagination?.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Título y slug de cada bitácora publicada, paginando de a 100 igual que el sitemap.
 * Solo marcas con ruta de bitácora real: una URL que no resuelve en llms.txt es peor
 * que ninguna.
 */
async function filasDeBitacora(): Promise<{ total: number; entradas: PublicacionLlms[] }> {
  const entradas: PublicacionLlms[] = [];
  let total = 0;
  try {
    let page = 1;
    for (;;) {
      const res = await strapiFetch<any>('bitacoras', {
        ttl: CACHE_TTL.list,
        cacheKey: `llms:bitacoras:${page}`,
        filters: { publicado: { $eq: true } },
        fields: ['titulo', 'slug', 'marca'],
        pagination: { page, pageSize: PAGINA },
      });
      const items = res.data || [];
      for (const item of items) {
        if (item?.slug && MARCAS_BITACORA.has(item.marca)) {
          entradas.push({ marca: item.marca, slug: item.slug, titulo: item.titulo });
        }
      }
      total = res.meta?.pagination?.total ?? items.length;
      if (items.length === 0 || page * PAGINA >= total) break;
      page += 1;
    }
  } catch {
    // Strapi no responde: se conserva lo ya recorrido y la cifra se queda donde está.
  }
  return { total, entradas };
}
