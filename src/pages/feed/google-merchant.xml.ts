/**
 * Google Merchant Center product feed.
 * Generates an XML feed at /feed/google-merchant.xml with all published
 * products from Strapi, mapped to Google Shopping specifications.
 *
 * Feed URL: https://iwage.co/feed/google-merchant.xml
 * Cache: 1 hour in Redis + nginx short-cache for API routes.
 */
import type { APIRoute } from 'astro';
import { getProductos, type Producto } from '@/lib/tienda';
import { cacheGet, cacheSet } from '@/lib/redis';
import { SITE } from '@/config/site';

const CACHE_KEY = 'feed:google-merchant';
const CACHE_TTL_SECONDS = 3600;

/** Strip HTML tags and collapse whitespace for plain-text descriptions. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape special XML characters. */
function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Google Merchant Center availability value. */
function gmcAvailability(p: Producto): string {
  if (p.stock_disponible && (p.stock_cantidad === null || p.stock_cantidad > 0)) {
    return 'in stock';
  }
  if (p.stock_cantidad !== null && p.stock_cantidad <= 0 && !p.stock_disponible) {
    return 'out of stock';
  }
  return 'out of stock';
}

/** Map product category to Google product type hierarchy. */
function gmcProductType(p: Producto): string {
  const brand = p.marca === 'granja' ? 'Granja Autosustentable' : 'Meliponario Iwagé';
  const cat = p.categoria || 'general';
  return `${brand} > ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
}

/** Build the product canonical URL on the site. */
function productLink(p: Producto): string {
  const base = SITE.url.replace(/\/+$/, '');
  return `${base}/meliponas/tienda/${p.slug}`;
}

/** Format price as Google expects: "amount currency" (e.g. "45000 COP"). */
function gmcPrice(precio: number): string {
  return `${precio} COP`;
}

function renderProduct(p: Producto): string {
  const title = escXml(p.nombre);
  const description = escXml(
    stripHtml(p.descripcion_corta || p.descripcion || p.nombre).slice(0, 5000)
  );
  const link = escXml(productLink(p));
  const id = escXml(p.sku || `prod-${p.documentId}`);
  const price = gmcPrice(p.precio);
  const availability = gmcAvailability(p);
  const condition = 'new';
  const brand = escXml('Iwagé');
  const productType = escXml(gmcProductType(p));
  const imageLink = p.imagen ? escXml(p.imagen) : '';

  const parts = [
    `      <g:id>${id}</g:id>`,
    `      <g:title>${title}</g:title>`,
    `      <g:description>${description}</g:description>`,
    `      <g:link>${link}</g:link>`,
    `      <g:price>${price}</g:price>`,
    `      <g:condition>${condition}</g:condition>`,
    `      <g:availability>${availability}</g:availability>`,
    `      <g:brand>${brand}</g:brand>`,
    `      <g:product_type>${productType}</g:product_type>`,
  ];

  if (imageLink) {
    parts.push(`      <g:image_link>${imageLink}</g:image_link>`);
  }

  // Optional: sale price (precio_comparativo acts as "was" price)
  if (p.precio_comparativo && p.precio_comparativo > p.precio) {
    parts.push(`      <g:sale_price>${gmcPrice(p.precio)}</g:sale_price>`);
    parts.push(`      <g:price>${gmcPrice(p.precio_comparativo)}</g:price>`);
  }

  return `    <item>\n${parts.join('\n')}\n    </item>`;
}

export const GET: APIRoute = async () => {
  // Try cache first
  let xml = await cacheGet<string>(CACHE_KEY);

  if (!xml) {
    // Fetch all products (online + local, both brands)
    const productos = await getProductos();

    const items = productos.map(renderProduct).join('\n');

    xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Iwagé — Catálogo de productos</title>
    <link>${SITE.url}</link>
    <description>Feed de productos de Iwagé para Google Merchant Center. Miel de Angelita, cajas meliponeras, kits, accesorios y productos de la Granja Autosustentable.</description>
${items}
  </channel>
</rss>`;

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
