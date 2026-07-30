#!/usr/bin/env node
/**
 * seed-complementos.mjs
 * Seeds the "complementos" collection in iwage_strapi with typical add-on
 * services (meals, shows, local purchases, transport, activities) and links
 * them to existing propiedades-gestion and experiencias.
 *
 * Usage:
 *   node strapi/scripts/seed-complementos.mjs
 *
 * Environment (optional):
 *   IWAGE_STRAPI_URL   (default: http://localhost:1338)
 *   STRAPI_API_TOKEN   (token con permisos de escritura; requerido si la API pública es read-only)
 */

const STRAPI = process.env.IWAGE_STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const HEADERS = {
  'Content-Type': 'application/json',
  ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
};

// ── Complementos to seed ─────────────────────────────────

const complementos = [
  // ── Comidas ──
  {
    nombre: 'Cena campesina tolimense',
    slug: 'cena-campesina-tolimense',
    descripcion: 'Cena tradicional preparada con ingredientes de la finca: arepa de choclo, tamal tolimense, chocolate de mesa y postre de brevas.',
    categoria: 'comida',
    precio: 45000,
    precio_por: 'persona',
    icono: '🍽️',
  },
  {
    nombre: 'Almuerzo típico del Tolima',
    slug: 'almuerzo-tipico-tolima',
    descripcion: 'Lechona tolimense con papa criolla, ají de maní y jugo natural de frutas de la región.',
    categoria: 'comida',
    precio: 35000,
    precio_por: 'persona',
    icono: '🥘',
  },
  {
    nombre: 'Desayuno rural',
    slug: 'desayuno-rural',
    descripcion: 'Huevos pericos, arepa blanca, queso campesino, chocolate de mesa y frutas frescas de la huerta.',
    categoria: 'comida',
    precio: 25000,
    precio_por: 'persona',
    icono: '☕',
  },

  // ── Espectáculos ──
  {
    nombre: 'Fogata con cuentería',
    slug: 'fogata-con-cuenteria',
    descripcion: 'Noche de fogata con historias del territorio, mitos y leyendas del Tolima contadas por un cuentero local. Incluye chocolate caliente y masato.',
    categoria: 'espectaculo',
    precio: 60000,
    precio_por: 'grupo',
    icono: '🔥',
  },
  {
    nombre: 'Show de música andina',
    slug: 'show-musica-andina',
    descripcion: 'Presentación en vivo de trío andino con tiple, bandola y guitarra. Repertorio de bambucos, torbellinos y sanjuaneros del Tolima.',
    categoria: 'espectaculo',
    precio: 80000,
    precio_por: 'grupo',
    icono: '🎶',
  },

  // ── Compras locales ──
  {
    nombre: 'Mercado de artesanías',
    slug: 'mercado-artesanias',
    descripcion: 'Recorrido guiado por el taller de artesanos locales: cerámica, tejido en fique y tallado en madera. Sin costo, pago directo al artesano.',
    categoria: 'compra_local',
    precio: 0,
    precio_por: 'grupo',
    icono: '🛍️',
  },
  {
    nombre: 'Café de origen para llevar',
    slug: 'cafe-origen-llevar',
    descripcion: 'Bolsa de 250g de café de origen Ambalá, tostado medio. Molido o en grano, empacado al vacío.',
    categoria: 'compra_local',
    precio: 30000,
    precio_por: 'unidad',
    icono: '☕',
  },

  // ── Transporte ──
  {
    nombre: 'Transporte desde Ibagué',
    slug: 'transporte-desde-ibague',
    descripcion: 'Recogida en Ibagué centro y traslado ida y vuelta al alojamiento en camioneta 4x4. Capacidad hasta 6 personas.',
    categoria: 'transporte',
    precio: 120000,
    precio_por: 'grupo',
    icono: '🚗',
  },

  // ── Actividades ──
  {
    nombre: 'Cabalgata al río',
    slug: 'cabalgata-al-rio',
    descripcion: 'Cabalgata guiada de 2 horas por senderos de montaña hasta el río Coello. Incluye caballos mansos, guía baquiano y refrigerio.',
    categoria: 'actividad',
    precio: 70000,
    precio_por: 'persona',
    icono: '🐴',
  },
  {
    nombre: 'Senderismo guiado',
    slug: 'senderismo-guiado',
    descripcion: 'Caminata interpretativa de 3 horas por bosque andino con guía naturalista. Avistamiento de aves y reconocimiento de flora nativa.',
    categoria: 'actividad',
    precio: 50000,
    precio_por: 'persona',
    icono: '🥾',
  },
];

// ── Helpers ──────────────────────────────────────────────

async function strapiUpsert(endpoint, slug, data) {
  // Find existing by slug
  const findRes = await fetch(`${STRAPI}/api/${endpoint}?filters[slug][$eq]=${encodeURIComponent(slug)}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!findRes.ok) {
    console.error(`  [ERROR] Finding ${slug}: HTTP ${findRes.status}`);
    return null;
  }
  const findJson = await findRes.json();

  if (findJson.data && findJson.data.length > 0) {
    // Update
    const docId = findJson.data[0].documentId;
    const upRes = await fetch(`${STRAPI}/api/${endpoint}/${docId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upRes.ok) {
      console.error(`  [ERROR] Updating ${slug}: HTTP ${upRes.status}`);
      return null;
    }
    const upJson = await upRes.json();
    return { action: 'updated', documentId: upJson.data.documentId };
  } else {
    // Create
    const crRes = await fetch(`${STRAPI}/api/${endpoint}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(10000),
    });
    if (!crRes.ok) {
      const errText = await crRes.text();
      console.error(`  [ERROR] Creating ${slug}: HTTP ${crRes.status} — ${errText}`);
      return null;
    }
    const crJson = await crRes.json();
    return { action: 'created', documentId: crJson.data.documentId };
  }
}

/** Fetch all documentIds of a collection (for linking relations) */
async function getAllDocumentIds(endpoint, pageSize = 100) {
  const res = await fetch(`${STRAPI}/api/${endpoint}?fields[0]=slug&pagination[pageSize]=${pageSize}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((d) => ({ documentId: d.documentId, slug: d.slug }));
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log('🎁 Seeding complementos → iwage_strapi');
  console.log(`   Strapi: ${STRAPI}`);

  // Verify connectivity
  try {
    const healthRes = await fetch(`${STRAPI}/api/complementos?pagination[pageSize]=1`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!healthRes.ok && healthRes.status !== 403) {
      // 403 means the endpoint exists but permissions are restricted (OK for seed)
      if (healthRes.status === 404) {
        console.error('\n❌ El content-type "complementos" no existe en Strapi. Ejecuta la migración primero.');
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(`\n❌ No se pudo conectar a Strapi en ${STRAPI}: ${err.message}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const comp of complementos) {
    const result = await strapiUpsert('complementos', comp.slug, {
      nombre: comp.nombre,
      slug: comp.slug,
      descripcion: comp.descripcion,
      categoria: comp.categoria,
      precio: comp.precio,
      moneda: 'COP',
      precio_por: comp.precio_por,
      disponible: true,
      // icono se omite: el frontend usa el ícono Lucide por categoría (ComplementosSection)
    });
    if (result) {
      if (result.action === 'created') created++;
      else updated++;
      console.log(`  ✓ ${comp.nombre} (${result.action})`);
    }
  }

  // ── Link complementos to existing propiedades and experiencias ──
  console.log('\n🔗 Vinculando complementos a propiedades y experiencias...');

  try {
    const propiedades = await getAllDocumentIds('propiedades-gestion');
    const experiencias = await getAllDocumentIds('experiencias');
    const complementosDocs = await getAllDocumentIds('complementos');

    if (complementosDocs.length === 0) {
      console.log('  [SKIP] No complementos found after seeding.');
    } else {
      const allCompIds = complementosDocs.map((c) => c.documentId);

      // Link all complementos to all active propiedades (if any exist)
      for (const prop of propiedades.slice(0, 5)) {
        const linkRes = await fetch(`${STRAPI}/api/propiedades-gestion/${prop.documentId}`, {
          method: 'PUT',
          headers: HEADERS,
          // slug incluido: Strapi v5 anula campos uid si no vienen en el payload del PUT
          body: JSON.stringify({ data: { slug: prop.slug, complementos: allCompIds } }),
          signal: AbortSignal.timeout(10000),
        });
        if (linkRes.ok) {
          console.log(`  ✓ Linked ${allCompIds.length} complementos → propiedad "${prop.slug}"`);
        }
      }

      // Link all complementos to all experiencias (if any exist)
      for (const exp of experiencias.slice(0, 5)) {
        const linkRes = await fetch(`${STRAPI}/api/experiencias/${exp.documentId}`, {
          method: 'PUT',
          headers: HEADERS,
          // slug incluido: Strapi v5 anula campos uid si no vienen en el payload del PUT
          body: JSON.stringify({ data: { slug: exp.slug, complementos: allCompIds } }),
          signal: AbortSignal.timeout(10000),
        });
        if (linkRes.ok) {
          console.log(`  ✓ Linked ${allCompIds.length} complementos → experiencia "${exp.slug}"`);
        }
      }
    }
  } catch (err) {
    console.warn(`  [WARN] Could not link relations: ${err.message}`);
  }

  console.log(`\n✅ Completado: ${created} creados, ${updated} actualizados`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
