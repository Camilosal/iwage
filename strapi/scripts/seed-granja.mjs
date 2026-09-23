// Seed script for the "granja" brand: imports the 19 "Territorio y Sostenibilidad"
// articles from Publicaciones/Granja/*.md and creates the initial farm products.
// Run: STRAPI_URL=http://localhost:1337 STRAPI_API_TOKEN=xxx node scripts/seed-granja.mjs

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = path.resolve(__dirname, '../../Publicaciones/Granja');

async function create(endpoint, data) {
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`✗ Error creating ${endpoint} (${data.slug || data.nombre || ''}):`, JSON.stringify(err.error || err).slice(0, 300));
    return null;
  }
  const json = await res.json();
  console.log(`✓ Created ${endpoint}: ${data.titulo || data.nombre || 'entry'}`);
  return json.data;
}

async function exists(endpoint, slug) {
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}?filters[slug][$eq]=${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!res.ok) return false;
  const json = await res.json();
  return (json.data || []).length > 0;
}

// ── Minimal Obsidian frontmatter parser (scalars, inline arrays, block lists) ──
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  let currentKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s*(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(listItem[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    let value = kv[2].trim();
    if (value === '') {
      meta[currentKey] = '';
      continue;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }
    meta[currentKey] = value.replace(/^["']|["']$/g, '');
  }
  return { meta, body: raw.slice(m[0].length) };
}

// Clean Obsidian body: strip wikilinks and embedded image placeholders.
function cleanBody(body) {
  return body
    .replace(/!\[\[([^\]]+)\]\]/g, '')                 // embedded files ![[...]]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')      // [[target|label]] → label
    .replace(/\[\[([^\]]+)\]\]/g, '$1')                 // [[target]] → target
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readingTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

async function seedArticles() {
  console.log('📓 Importing Granja bitácora articles...\n');
  const files = (await readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.md')).sort();
  let created = 0, skipped = 0;

  // Mapping: article slug → subsistema
  const SUBSISTEMA_MAP = {
    'gestion-hidrica': 'gestion-hidrica',
    'solar-offgrid': 'energia',
    'biorefineria-domestica': 'biorefineria-domestica',
    'compostaje-rural-como-cerrar-el-ciclo-de-nutrientes-en-la-finca': 'biorefineria-domestica',
    'agroecosistema-productivo': 'agroecosistema-productivo',
    'cuaderno-campo': 'agroecosistema-productivo',
    'home-assistant': 'gemelo-digital',
    'edge-computing-rural-como-un-esp32-sobrevive-meses-con-dos-baterias-y-sin-internet-confiable': 'gemelo-digital',
    'esg-sin-greenwashing': 'gemelo-digital',
    'bioarquitectura-terrenos': 'bioarquitectura',
    'climatizacion-olores': 'bioarquitectura',
  };

  for (const file of files) {
    const raw = await readFile(path.join(ARTICLES_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = meta.strapi_slug || file.replace(/\.md$/, '');

    if (await exists('bitacoras', slug)) {
      console.log(`· Skipped (exists): ${slug}`);
      skipped++;
      continue;
    }

    const contenido = cleanBody(body);
    const categoria = Array.isArray(meta.categoria) ? meta.categoria[0] : meta.categoria || 'Sistema';
    const serie = meta.serie || meta.strapi_serie || '';
    const fecha = meta.strapi_pubDate ? meta.strapi_pubDate.split('T')[0] : null;

    const data = {
      titulo: meta.nombre || slug,
      slug,
      extracto: meta.strapi_description || '',
      contenido,
      categoria,
      tiempo_lectura: readingTime(contenido),
      fecha,
      marca: 'granja',
      destacado: serie.includes('Sistema Autosustentable') && slug === 'sistema-autosustentable-ancla',
      subsistema: SUBSISTEMA_MAP[slug] || null,
      publishedAt: new Date().toISOString(),
    };
    if (await create('bitacoras', data)) created++;
  }
  console.log(`\n📓 Articles: ${created} created, ${skipped} skipped.\n`);
}

async function seedProductos() {
  console.log('🥚 Creating Granja products...\n');
  const productos = [
    {
      nombre: 'Huevos de gallina feliz (docena)',
      slug: 'huevos-gallina-feliz-docena',
      categoria: 'huevos',
      precio: 18000,
      presentacion: 'Docena · cartón reutilizable',
      descripcion_corta: 'Huevos de gallinas en pastoreo dentro del agroecosistema, alimentadas sin concentrados industriales.',
      descripcion: 'Huevos de gallinas criadas en pastoreo rotativo dentro del agroecosistema de la granja. Su alimentación se complementa con excedentes de la huerta y larvas del sistema de compostaje, cerrando el ciclo de nutrientes. Recolección diaria.',
      sku: 'GRA-HUE-012',
    },
    {
      nombre: 'Canasta de hortalizas de temporada',
      slug: 'canasta-hortalizas-temporada',
      categoria: 'cosecha',
      precio: 45000,
      presentacion: 'Canasta ~5 kg · según cosecha de la semana',
      descripcion_corta: 'Selección semanal de hortalizas agroecológicas cosechadas el mismo día de la entrega.',
      descripcion: 'Canasta con la cosecha de la semana: hortalizas de hoja, raíces, aromáticas y frutos de temporada producidos sin agroquímicos de síntesis. El contenido varía según el ciclo de la huerta y se corta el mismo día de la entrega en Ibagué.',
      sku: 'GRA-COS-001',
    },
    {
      nombre: 'Plántulas nativas',
      slug: 'plantulas-nativas',
      categoria: 'plantas',
      precio: 8000,
      presentacion: 'Unidad · bolsa biodegradable',
      descripcion_corta: 'Plántulas de especies nativas y flora melífera propagadas en el vivero de la granja.',
      descripcion: 'Plántulas de especies nativas del corredor Ambalá y flora melífera para meliponarios, propagadas en el vivero de la granja con sustrato del sistema de compostaje propio. Ideales para restauración, cercas vivas y jardines para polinizadores.',
      sku: 'GRA-PLA-001',
    },
    {
      nombre: 'Compost madurado (bulto 40 kg)',
      slug: 'compost-madurado-bulto',
      categoria: 'abono',
      precio: 35000,
      presentacion: 'Bulto 40 kg',
      descripcion_corta: 'Abono orgánico madurado en la bio-refinería de la granja, con trazabilidad del proceso.',
      descripcion: 'Compost madurado producido en la bio-refinería doméstica de la granja a partir de residuos orgánicos del agroecosistema. Proceso monitoreado con sensores de temperatura y humedad: cada lote es trazable en la bitácora.',
      sku: 'GRA-ABO-040',
    },
    {
      nombre: 'Visita guiada a la granja',
      slug: 'granja-visita-guiada',
      categoria: 'experiencia',
      precio: 45000,
      presentacion: 'Por persona · ~2 horas · grupos de máx. 10',
      descripcion_corta: 'Recorrido guiado por los subsistemas de la granja autosustentable: agua, solar, bio-refinería, huerta, gemelo digital y meliponario.',
      descripcion: 'Recorrido guiado de aproximadamente 2 horas por la granja autosustentable Iwagé en el corredor Ambalá: gestión hídrica de ciclo cerrado, sistema solar off-grid, bio-refinería, agroecosistema, gemelo digital con Home Assistant y meliponario con cata de miel de Angelita. Incluye refrigerio con productos de la granja.',
      sku: 'GRA-EXP-001',
    },
  ];

  let created = 0, skipped = 0;
  for (const p of productos) {
    if (await exists('productos', p.slug)) {
      console.log(`· Skipped (exists): ${p.slug}`);
      skipped++;
      continue;
    }
    const ok = await create('productos', {
      ...p,
      marca: 'granja',
      canal_venta: 'online',
      stock_disponible: true,
      envio_gratis: false,
      tiempo_entrega: 'Entrega en Ibagué bajo pedido',
      publishedAt: new Date().toISOString(),
    });
    if (ok) created++;
  }
  // Miel Angelita ya existe en la marca meliponas: se referencia como cross-sell, no se duplica.
  console.log(`\n🥚 Products: ${created} created, ${skipped} skipped.`);
}

async function seed() {
  console.log(`🌱 Seeding Granja content → ${STRAPI_URL}\n`);
  await seedArticles();
  await seedProductos();
  console.log('\n✅ Granja seed finished.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
