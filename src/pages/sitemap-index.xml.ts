/**
 * Compatibilidad: el robots.txt antiguo apuntaba a /sitemap-index.xml
 * (generado por @astrojs/sitemap, que en modo SSR quedaba vacío).
 * Redirige permanentemente al sitemap dinámico único.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: { Location: '/sitemap.xml' },
  });
