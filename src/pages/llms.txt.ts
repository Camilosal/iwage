/**
 * llms.txt generado: los conteos salen de Strapi en cada construcción, así que no
 * pueden volver a quedarse atrás como pasaba con la copia estática de public/.
 */
import type { APIRoute } from 'astro';
import plantilla from '@/data/llms-plantilla.txt?raw';
import { aplicarConteos } from '@/lib/llms';
import { strapiFetch, CACHE_TTL } from '@/lib/strapi';
import { collectSitemapUrls } from '@/lib/sitemap';

export const GET: APIRoute = async () => {
  const [bitacoras, tierras, gestion, urls] = await Promise.all([
    total('bitacoras', { publicado: { $eq: true } }),
    total('propiedades', { publicado: { $eq: true } }),
    total('propiedades-gestion', { publicado: { $eq: true } }),
    collectSitemapUrls().then((r) => r.urls.length),
  ]);

  return new Response(
    aplicarConteos(plantilla, {
      publicaciones: bitacoras,
      propiedades: tierras + gestion, // la línea habla de "portafolio (Tierras + Gestión)"
      urls,
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
