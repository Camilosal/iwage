/**
 * robots.txt dinámico — usa SITE.url (APP_URL) para referenciar el
 * sitemap con el dominio correcto en cada entorno.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';

export const GET: APIRoute = () => {
  const base = SITE.url.replace(/\/+$/, '');
  const body = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${base}/sitemap.xml

# Crawl-delay for politeness
Crawl-delay: 1

# Block API and internal routes
Disallow: /api/
Disallow: /_astro/
Disallow: /admin
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
