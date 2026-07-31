/**
 * Sitemap dinámico en /sitemap.xml — incluye todas las páginas estáticas
 * y todo el contenido publicado en Strapi (productos, propiedades,
 * experiencias, anfitriones, programas, proyectos, cultivos, landings
 * y bitácoras de las 5 marcas). Cacheado en Redis 1 hora.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';
import { collectSitemapUrls, renderSitemapXml } from '@/lib/sitemap';
import { cacheGet, cacheSet } from '@/lib/redis';

const CACHE_KEY = 'sitemap:xml';
const CACHE_TTL_SECONDS = 3600;

export const GET: APIRoute = async () => {
  let xml = await cacheGet<string>(CACHE_KEY);

  if (!xml) {
    const urls = await collectSitemapUrls();
    xml = renderSitemapXml(SITE.url, urls);
    await cacheSet(CACHE_KEY, xml, CACHE_TTL_SECONDS);
  }

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
