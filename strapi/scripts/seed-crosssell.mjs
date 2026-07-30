#!/usr/bin/env node
/**
 * seed-crosssell.mjs
 * Vincula relaciones de cross-selling en iwage_strapi:
 *   - experiencias ↔ propiedades-gestion (el huésped ve experiencias cercanas)
 *   - productos    ↔ propiedades-gestion (productos locales recomendados)
 *
 * Usage:
 *   STRAPI_API_TOKEN=xxx node strapi/scripts/seed-crosssell.mjs
 *
 * Environment:
 *   IWAGE_STRAPI_URL   (default: http://localhost:1338)
 *   STRAPI_API_TOKEN   (token con permisos de escritura)
 */

const STRAPI = process.env.IWAGE_STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const HEADERS = {
  'Content-Type': 'application/json',
  ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
};

// Productos recomendados para huéspedes (selección curada, una cara por familia)
const PRODUCTOS_RECOMENDADOS = [
  'miel-angelita-250ml',
  'miel-con-propoleo-250ml',
  'kit-observacion',
];

async function getBySlug(endpoint, slugs = null) {
  const filter = slugs
    ? slugs.map((s, i) => `filters[slug][$in][${i}]=${encodeURIComponent(s)}`).join('&') + '&'
    : '';
  const res = await fetch(`${STRAPI}/api/${endpoint}?${filter}fields[0]=slug&pagination[pageSize]=100`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    console.error(`  [ERROR] GET ${endpoint}: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  return (json.data || []).map((d) => ({ documentId: d.documentId, slug: d.slug }));
}

async function linkPropiedad(prop, data) {
  const res = await fetch(`${STRAPI}/api/propiedades-gestion/${prop.documentId}`, {
    method: 'PUT',
    headers: HEADERS,
    // slug incluido: Strapi v5 anula campos uid si no vienen en el payload del PUT
    body: JSON.stringify({ data: { slug: prop.slug, ...data } }),
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
}

async function main() {
  console.log('🔗 Seeding cross-sell → iwage_strapi');
  console.log(`   Strapi: ${STRAPI}`);

  const propiedades = await getBySlug('propiedades-gestion');
  const experiencias = await getBySlug('experiencias');
  const productos = await getBySlug('productos', PRODUCTOS_RECOMENDADOS);

  console.log(`   Alojamientos: ${propiedades.length} · Experiencias: ${experiencias.length} · Productos: ${productos.length}`);
  if (propiedades.length === 0) {
    console.error('❌ No hay propiedades-gestion. Nada que vincular.');
    process.exit(1);
  }

  const expIds = experiencias.map((e) => e.documentId);
  const prodIds = productos.map((p) => p.documentId);

  for (const prop of propiedades) {
    const ok = await linkPropiedad(prop, { experiencias: expIds, productos: prodIds });
    if (ok) {
      console.log(`  ✓ ${prop.slug}: ${expIds.length} experiencias + ${prodIds.length} productos`);
    } else {
      console.error(`  [ERROR] No se pudo vincular ${prop.slug}`);
    }
  }

  console.log('\n✅ Cross-sell vinculado.');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
