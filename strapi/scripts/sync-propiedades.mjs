/**
 * Sync properties from Flask PostgreSQL → Strapi v5
 * 
 * Usage:
 *   node strapi/scripts/sync-propiedades.mjs [--dry-run]
 * 
 * Requires:
 *   - FLASK_DB_URL (or defaults to postgres://admin:Pr@yectos123@localhost:5432/inmobiliaria)
 *   - STRAPI_URL (or defaults to http://localhost:1337)
 *   - STRAPI_TOKEN (Bearer token for Strapi API)
 */

const DRY_RUN = process.argv.includes('--dry-run');

const FLASK_DB_URL = process.env.FLASK_DB_URL || 'postgres://admin:Pr%40yectos123@localhost:5432/inmobiliaria';
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {}),
};

// ── Database Query ──────────────────────────────────────

async function fetchProperties() {
  // Dynamic import for pg (may need: npm install pg)
  const { default: pg } = await import('pg');
  const client = new pg.Client(FLASK_DB_URL);
  await client.connect();

  const { rows } = await client.query(`
    SELECT 
      p.*,
      json_agg(json_build_object(
        'url', pi.url,
        'titulo', pi.titulo,
        'es_principal', pi.es_principal,
        'orden', pi.orden
      )) FILTER (WHERE pi.id IS NOT NULL) as images,
      row_to_json(prd.*) as rural_detail
    FROM properties p
    LEFT JOIN property_images pi ON pi.property_id = p.id
    LEFT JOIN property_rural_details prd ON prd.property_id = p.id
    WHERE p.publicado = true
    GROUP BY p.id, prd.id
    ORDER BY p.created_at DESC
  `);

  await client.end();
  return rows;
}

// ── Strapi Upsert ───────────────────────────────────────

async function strapiApi(method, endpoint, body) {
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${endpoint} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function findExisting(slug) {
  const res = await strapiApi('GET', `propiedades?filters[slug][$eq]=${slug}`);
  return res.data?.[0] || null;
}

function transformProperty(row) {
  return {
    data: {
      uuid: row.id,
      titulo: row.titulo,
      slug: row.slug || row.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      descripcion: row.descripcion || null,
      seo_titulo: row.seo_titulo || null,
      seo_descripcion: row.seo_descripcion || null,
      tipo_propiedad: mapTipoPropiedad(row.tipo_propiedad),
      operacion: row.operacion || 'venta',
      precio: row.precio ? Number(row.precio) : null,
      moneda: row.moneda || 'COP',
      estado: row.estado || 'disponible',
      es_destacado: row.es_destacado || false,
      publicado: true,
      ubicacion_direccion: row.ubicacion_direccion || null,
      ubicacion_municipio: row.ubicacion_municipio || null,
      ubicacion_departamento: row.ubicacion_departamento || 'Tolima',
      ubicacion_latitud: row.ubicacion_latitud ? Number(row.ubicacion_latitud) : null,
      ubicacion_longitud: row.ubicacion_longitud ? Number(row.ubicacion_longitud) : null,
      area_total: row.area_total ? Number(row.area_total) : null,
      area_construida: row.area_construida ? Number(row.area_construida) : null,
      area_hectareas: row.area_hectareas ? Number(row.area_hectareas) : null,
      numero_habitaciones: row.numero_habitaciones || null,
      numero_banos: row.numero_banos || null,
      numero_garajes: row.numero_garajes || null,
      anno_construccion: row.anno_construccion || null,
      caracteristicas: row.caracteristicas || null,
      video_url: row.video_url || null,
      tour_virtual_url: row.tour_virtual_url || null,
      link_drone: row.link_drone || null,
      disponibilidad_agua: row.disponibilidad_agua || null,
      energia_electrica: row.energia_electrica || false,
      tipo_via: row.tipo_via || null,
      distancia_centro_poblado: row.distancia_centro_poblado ? Number(row.distancia_centro_poblado) : null,
      sello_vap: 'plata', // Default; VAP verification done separately
      modelo_sugerido: null,
      detalle_rural: row.rural_detail ? cleanRuralDetail(row.rural_detail) : null,
      verificacion_vap: null,
      perfil_comprador: inferPerfil(row),
    },
  };
}

function mapTipoPropiedad(tipo) {
  const map = {
    'finca': 'finca',
    'lote': 'lote',
    'casa': 'casa_campestre',
    'casa_campestre': 'casa_campestre',
    'predio': 'predio_rural',
    'terreno': 'terreno',
  };
  return map[tipo] || 'otro';
}

function cleanRuralDetail(r) {
  if (!r) return null;
  const { id, property_id, created_at, updated_at, ...rest } = r;
  return rest;
}

function inferPerfil(row) {
  const rd = row.rural_detail;
  if (rd?.apta_glamping_agroturismo) return 'turistico';
  if (rd?.cobertura_starlink_verificada) return 'nomada';
  if (row.tipo_propiedad === 'casa_campestre' || row.tipo_propiedad === 'casa') return 'campestre';
  if (row.area_hectareas && Number(row.area_hectareas) > 5) return 'productivo';
  return 'patrimonial';
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Sync Propiedades: Flask → Strapi ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`   Flask DB: ${FLASK_DB_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Strapi: ${STRAPI_URL}\n`);

  let properties;
  try {
    properties = await fetchProperties();
  } catch (err) {
    console.error('❌ Error connecting to Flask DB:', err.message);
    console.log('\n💡 Make sure PostgreSQL is running and the inmobiliaria DB is accessible.');
    console.log('   Or set FLASK_DB_URL env var.');
    process.exit(1);
  }

  console.log(`📦 Found ${properties.length} published properties\n`);

  let created = 0, updated = 0, errors = 0;

  for (const row of properties) {
    const slug = row.slug || row.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payload = transformProperty(row);

    if (DRY_RUN) {
      console.log(`  [DRY] ${slug} — ${row.titulo}`);
      continue;
    }

    try {
      const existing = await findExisting(slug);
      if (existing) {
        await strapiApi('PUT', `propiedades/${existing.documentId}`, payload);
        updated++;
        console.log(`  ✏️  Updated: ${slug}`);
      } else {
        await strapiApi('POST', 'propiedades', payload);
        created++;
        console.log(`  ✅ Created: ${slug}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Error (${slug}): ${err.message}`);
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 Summary: ${created} created, ${updated} updated, ${errors} errors`);
  console.log(`   Total: ${properties.length} properties processed\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
