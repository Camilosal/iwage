#!/usr/bin/env node
/**
 * Flask → Strapi migration: Experiencias, Anfitriones, Paquetes
 * Reads from PostgreSQL (inmobiliaria DB) and upserts into Strapi.
 *
 * Usage:
 *   node strapi/scripts/sync-experiencias.mjs [--dry-run]
 */
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

const DB_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: 'inmobiliaria',
  user: process.env.PG_USER || 'admin',
  password: process.env.PG_PASSWORD || 'Pr@yectos123',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Strapi helpers ─────────────────────────────────────

async function strapiUpsert(endpoint, slugField, slugValue, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

  // Find existing
  const findUrl = `${STRAPI_URL}/api/${endpoint}?filters[${slugField}][$eq]=${encodeURIComponent(slugValue)}`;
  const findRes = await fetch(findUrl, { headers });
  const findJson = await findRes.json();
  const existing = findJson.data?.[0];

  if (DRY_RUN) {
    console.log(`  [DRY] ${existing ? 'UPDATE' : 'CREATE'} ${endpoint}/${slugValue}`);
    return existing?.documentId || null;
  }

  if (existing) {
    const url = `${STRAPI_URL}/api/${endpoint}/${existing.documentId}`;
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ data: payload }) });
    if (!res.ok) console.error(`  ✗ PUT ${endpoint}/${slugValue}: ${res.status}`);
    else console.log(`  ✓ Updated ${endpoint}/${slugValue}`);
    return existing.documentId;
  } else {
    const url = `${STRAPI_URL}/api/${endpoint}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data: payload }) });
    if (!res.ok) {
      const body = await res.text();
      console.error(`  ✗ POST ${endpoint}/${slugValue}: ${res.status} — ${body.slice(0, 200)}`);
      return null;
    } else {
      const json = await res.json();
      console.log(`  ✓ Created ${endpoint}/${slugValue}`);
      return json.data?.documentId || null;
    }
  }
}

/** Look up a Strapi entry's documentId by slug field */
async function strapiFindDocumentId(endpoint, slugField, slugValue) {
  const headers = {};
  if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
  const url = `${STRAPI_URL}/api/${endpoint}?filters[${slugField}][$eq]=${encodeURIComponent(slugValue)}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  return json.data?.[0]?.documentId || null;
}

// ── Main ───────────────────────────────────────────────

async function main() {
  console.log(`\n🌿 Sync Experiencias → Strapi ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`   Strapi: ${STRAPI_URL}\n`);

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  console.log('   ✓ Connected to PostgreSQL (inmobiliaria)\n');

  // ── 1. Anfitriones ──────────────────────────────────
  console.log('── Anfitriones ──');
  const hostsRes = await client.query(`SELECT * FROM iwage_anfitriones ORDER BY id`);
  console.log(`   Found ${hostsRes.rows.length} hosts`);

  // Map: anfitrion_id (slug) → Strapi documentId (for relation linking later)
  const anfitrionDocIds = new Map();

  for (const h of hostsRes.rows) {
    const payload = {
      slug: h.id,
      nombre: h.nombre,
      especialidad: h.especialidad,
      foto_perfil_url: h.foto_perfil,
      video_thumbnail: h.video_thumbnail,
      video_url: h.video_url,
      manifiesto: h.manifiesto,
      momento_favorito: h.momento_favorito,
      arraigo: h.arraigo,
      historia_personal: h.historia_personal,
      anos_en_territorio: h.anos_en_territorio,
      generaciones_familia: h.generaciones_familia,
      foto_territorio: h.foto_territorio,
      galeria_fotos: h.galeria_fotos,
      nivel_escalafon: h.nivel_escalafon || 1,
      nombre_escalafon: h.nombre_escalafon,
      descripcion_escalafon: h.descripcion_escalafon,
      calificacion_promedio: h.calificacion_promedio ? Number(h.calificacion_promedio) : 5.0,
      numero_resenas: h.numero_resenas || 0,
      impacto_hectareas: h.impacto_hectareas ? Number(h.impacto_hectareas) : null,
      impacto_hectareas_desc: h.impacto_hectareas_desc,
      impacto_familias: h.impacto_familias,
      impacto_familias_desc: h.impacto_familias_desc,
      impacto_mensaje: h.impacto_mensaje,
      fondo_impacto_titulo: h.fondo_impacto_titulo,
      fondo_impacto_descripcion: h.fondo_impacto_descripcion,
      sueno_narrativa: h.sueno_narrativa,
      insignia_titulo: h.insignia_titulo,
      insignia_narrativa: h.insignia_narrativa,
      pacto_subtitulo: h.pacto_subtitulo,
      pacto_items: h.pacto_items,
      certificaciones_seguridad: h.certificaciones_seguridad,
      faqs: h.faqs,
      publicado: true,
      seo_titulo: h.seo_titulo,
      seo_descripcion: h.seo_descripcion,
    };

    // Fetch reviews for this host
    const reviewsRes = await client.query(
      `SELECT autor, perfil_viajero, calificacion, comentario, fecha FROM iwage_resenas WHERE anfitrion_id = $1 ORDER BY id`,
      [h.id]
    );
    if (reviewsRes.rows.length > 0) {
      payload.resenas = reviewsRes.rows.map((r) => ({
        author: r.autor,
        profile: r.perfil_viajero,
        rating: Number(r.calificacion),
        text: r.comentario,
        date: r.fecha,
      }));
    }

    const docId = await strapiUpsert('anfitriones', 'slug', h.id, payload);
    if (docId) anfitrionDocIds.set(h.id, docId);
    await sleep(200);
  }

  // ── 2. Experiencias ─────────────────────────────────
  console.log('\n── Experiencias ──');
  const expRes = await client.query(`SELECT * FROM iwage_experiencias ORDER BY slug`);
  console.log(`   Found ${expRes.rows.length} experiences`);

  for (const e of expRes.rows) {
    // Fetch itinerary
    const itRes = await client.query(
      `SELECT momento, titulo, sentido, descripcion, icono FROM iwage_itinerario_sensorial WHERE experiencia_slug = $1 ORDER BY orden`,
      [e.slug]
    );
    // Fetch junction data
    const jRes = await client.query(
      `SELECT * FROM iwage_experiencia_anfitrion WHERE experiencia_slug = $1`,
      [e.slug]
    );
    // Fetch initiatives
    const iniRes = await client.query(
      `SELECT icono, titulo, descripcion, estado, metrica FROM iwage_iniciativas_impacto WHERE experiencia_slug = $1 AND activo = true ORDER BY orden`,
      [e.slug]
    );
    // Fetch bundles
    const bRes = await client.query(
      `SELECT titulo_paquete, tagline, duracion, precio, items_incluidos FROM iwage_paquetes WHERE experiencia_slug = $1`,
      [e.slug]
    );
    // Fetch min price from junction
    const priceRes = await client.query(
      `SELECT MIN(precio_personalizado) as min_precio FROM iwage_experiencia_anfitrion WHERE experiencia_slug = $1 AND precio_personalizado IS NOT NULL`,
      [e.slug]
    );
    // Fetch media gallery from dedicated table
    const mediaRes = await client.query(
      `SELECT url, tipo, titulo, orden FROM iwage_experiencia_media WHERE experiencia_slug = $1 ORDER BY orden`,
      [e.slug]
    );

    const categoriaMap = { 'Naturaleza': 'Naturaleza', 'Cultura': 'Cultura', 'Bienestar': 'Bienestar', 'Aventura': 'Aventura', 'Gastronomía': 'Gastronomia' };

    // Build gallery URLs array from media table
    const galeriaUrls = mediaRes.rows.map((m) => ({
      url: m.url,
      tipo: m.tipo || 'image',
      titulo: m.titulo || null,
    }));

    const payload = {
      slug: e.slug,
      titulo: e.titulo,
      resumen: e.resumen,
      categoria: categoriaMap[e.categoria] || 'Naturaleza',
      ubicacion: e.ubicacion,
      ubicacion_latitud: e.ubicacion_latitud ? Number(e.ubicacion_latitud) : null,
      ubicacion_longitud: e.ubicacion_longitud ? Number(e.ubicacion_longitud) : null,
      ciudad_referencia: e.ciudad_referencia,
      distancia_km: e.distancia_km,
      tiempo_desde_ciudad: e.tiempo_desde_ciudad,
      estado_via: e.estado_via,
      ofrece_transporte: e.ofrece_transporte || false,
      duracion: e.duracion,
      nivel_dificultad: e.nivel_dificultad || 1,
      tipo_propiedad: e.tipo_propiedad || null,
      precio_desde: priceRes.rows[0]?.min_precio ? Number(priceRes.rows[0].min_precio) : null,
      cupo_maximo_desc: e.cupo_maximo_desc,
      porcentaje_fondo_impacto: e.porcentaje_fondo_impacto ? Number(e.porcentaje_fondo_impacto) : 2.0,
      descripcion_fondo_impacto: e.descripcion_fondo_impacto,
      es_destacado: false,
      publicado: true,
      imagen_hero: null, // Strapi media field — not usable with plain URLs
      imagen_hero_url: e.imagen_hero || null, // Store original URL directly
      galeria_urls: galeriaUrls.length > 0 ? galeriaUrls : null,
      video_url: e.video_url,
      tour_360_url: e.tour_360_url,
      link_drone: e.link_drone,
      mapa_imagen_url: e.mapa_imagen_url,
      highlights: e.highlights,
      requirements: e.requirements,
      includes: e.includes,
      excludes: e.excludes,
      optional_addons: e.optional_addons,
      faqs: e.faqs,
      safety_content: e.safety_content,
      etiquetas_personalizadas: e.etiquetas_personalizadas,
      seo_titulo: e.seo_titulo,
      seo_descripcion: e.seo_descripcion,
    };

    // Itinerary
    if (itRes.rows.length > 0) {
      payload.itinerario_sensorial = itRes.rows.map((it) => ({
        time: it.momento,
        title: it.titulo,
        sense: it.sentido,
        desc: it.descripcion,
        iconName: it.icono,
      }));
    }

    // Junction data
    if (jRes.rows.length > 0) {
      payload.anfitriones_data = jRes.rows.map((j) => ({
        anfitrion_id: j.anfitrion_id,
        precio_personalizado: j.precio_personalizado ? Number(j.precio_personalizado) : null,
        superpoder_en_esta_ruta: j.superpoder_en_esta_ruta,
        toque_unico: j.toque_unico,
        url_qloapps: j.url_qloapps,
        lema_seccion: j.lema_seccion,
        manifiesto_ruta: j.manifiesto_ruta,
        momento_favorito_ruta: j.momento_favorito_ruta,
        destacados_unicos: j.destacados_unicos,
        recomendaciones_especificas: j.recomendaciones_especificas,
        enfoque_de_ruta: j.enfoque_de_ruta,
      }));

      // Link anfitriones relation (manyToMany) using collected documentIds
      const relatedDocIds = jRes.rows
        .map((j) => anfitrionDocIds.get(j.anfitrion_id))
        .filter(Boolean);
      if (relatedDocIds.length > 0) {
        payload.anfitriones = { connect: relatedDocIds.map((documentId) => ({ documentId })) };
      }
    }

    // Initiatives
    if (iniRes.rows.length > 0) {
      payload.iniciativas_impacto = iniRes.rows.map((ini) => ({
        icono: ini.icono,
        titulo: ini.titulo,
        descripcion: ini.descripcion,
        estado: ini.estado,
        metrica: ini.metrica,
      }));
    }

    // Bundles
    if (bRes.rows.length > 0) {
      payload.paquetes_upsell = bRes.rows.map((b) => ({
        title: b.titulo_paquete,
        tagline: b.tagline,
        duration: b.duracion,
        price: b.precio ? Number(b.precio) : null,
        includes: b.items_incluidos,
      }));
    }

    await strapiUpsert('experiencias', 'slug', e.slug, payload);
    await sleep(200);
  }

  // ── 3. Paquetes Independientes ──────────────────────
  console.log('\n── Paquetes ──');
  const pkgRes = await client.query(`SELECT * FROM iwage_paquetes_independientes ORDER BY id`);
  console.log(`   Found ${pkgRes.rows.length} packages`);

  for (const p of pkgRes.rows) {
    const payload = {
      slug: p.slug,
      titulo: p.titulo,
      tagline: p.tagline,
      descripcion: p.descripcion,
      categoria: p.categoria,
      duracion_dias: p.duracion_dias || 1,
      duracion_texto: p.duraciontexto,
      precio_base: p.precio_base ? Number(p.precio_base) : null,
      precio_por_persona: p.precio_por_persona !== false,
      ubicacion: p.ubicacion,
      dificultad: p.dificultad,
      incluye: p.incluye,
      no_incluye: p.no_incluye,
      activo: p.activo !== false,
      destacado: p.destacado || false,
      seo_titulo: p.seo_titulo,
      seo_descripcion: p.seo_descripcion,
    };
    await strapiUpsert('paquetes', 'slug', p.slug, payload);
  }

  await client.end();
  console.log('\n✅ Sync complete!\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
