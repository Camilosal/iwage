#!/usr/bin/env node
/**
 * sync-recursos-reservas.mjs
 * Sincroniza todos los recursos reservables desde iwage_strapi y marca_personal_strapi
 * hacia el microservicio centralizado app_reservas (BFF Astro).
 *
 * Uso:
 *   node strapi/scripts/sync-recursos-reservas.mjs
 *
 * Variables de entorno (opcionales):
 *   IWAGE_STRAPI_URL        (default: http://localhost:1338)
 *   MP_STRAPI_URL           (default: http://localhost:1337)
 *   ESPACIOS_PLUS_STRAPI_URL (default: http://localhost:1340)
 *   RESERVAS_API_URL        (default: http://localhost:4326)
 *   RESERVAS_SYNC_TOKEN     (requerido: token del endpoint /api/admin/recursos/sync)
 */

const IWAGE_STRAPI = process.env.IWAGE_STRAPI_URL || 'http://localhost:1338';
const MP_STRAPI = process.env.MP_STRAPI_URL || 'http://localhost:1337';
const ESPACIOS_PLUS_STRAPI = process.env.ESPACIOS_PLUS_STRAPI_URL || 'http://localhost:1340';
const RESERVAS_API = process.env.RESERVAS_API_URL || 'http://localhost:4326';
const SYNC_TOKEN = process.env.RESERVAS_SYNC_TOKEN || '';

// ── Helpers ──────────────────────────────────────────────

async function strapiGetAll(base, endpoint, fields, extraParams = '') {
  const fieldsParam = fields.map((f, i) => `fields[${i}]=${f}`).join('&');
  const url = `${base}/api/${endpoint}?${fieldsParam}&pagination[pageSize]=100${extraParams}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    console.warn(`  [WARN] ${endpoint} from ${base}: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

async function syncRecurso(data) {
  const res = await fetch(`${RESERVAS_API}/api/admin/recursos/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Token': SYNC_TOKEN,
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`  [ERROR] ${data.nombre}: ${json.error || res.status}`);
    return null;
  }
  return json;
}

/** Parse price string like "Desde $800.000 COP" → number */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = String(priceStr).replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

/** Parse duration string like "4 - 5 Horas" → minutes (approx) */
function parseDurationMinutes(dur) {
  if (!dur) return null;
  const lower = String(dur).toLowerCase();
  const nums = lower.match(/\d+/g);
  if (!nums) return null;
  if (lower.includes('hora')) {
    const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.round(avg * 60);
  }
  if (lower.includes('semana')) {
    const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.round(avg * 7 * 24 * 60);
  }
  if (lower.includes('día') || lower.includes('dia')) {
    const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.round(avg * 24 * 60);
  }
  return null;
}

// ── Sync: iwage_naturaleza (experiencias) ────────────────

async function syncExperiencias() {
  console.log('\n📗 iwage_naturaleza: experiencias');
  const items = await strapiGetAll(IWAGE_STRAPI, 'experiencias',
    ['slug', 'titulo', 'precio_desde', 'duracion', 'publicado', 'cupo_maximo_desc', 'etiquetas_personalizadas'],
    '&filters[publicado][$eq]=true');

  let count = 0;
  for (const exp of items) {
    // Anti-eco: las experiencias espejo de recursos de aliados nacen en
    // app_reservas; devolverlas duplicaría el recurso original.
    if (exp.etiquetas_personalizadas?.origen === 'app_reservas') {
      console.log(`  ↷ ${exp.titulo} (origen app_reservas, omitida)`);
      continue;
    }
    const durMin = parseDurationMinutes(exp.duracion);
    const capacidad = parseInt(exp.cupo_maximo_desc) || 8;
    const result = await syncRecurso({
      nombre: exp.titulo,
      slug: exp.slug,
      tipo: 'experiencia',
      origen: 'iwage_naturaleza',
      origen_slug: exp.slug,
      requiere_pago: true,
      precio_base: exp.precio_desde || null,
      moneda: 'COP',
      capacidad_maxima: capacidad,
      duracion_minutos: durMin,
      tipo_disponibilidad: 'slot_horario',
      config_disponibilidad: {
        dias_semana: [1, 2, 3, 4, 5, 6, 7],
        hora_apertura: '06:00',
        hora_cierre: '18:00',
        duracion_slot_minutos: durMin || 300,
        intervalo_entre_slots_minutos: 30,
        capacidad_por_slot: capacidad,
        anticipacion_minima_horas: 24,
        max_reservas_por_cliente: 3,
        bloqueos: [],
      },
      url_publica: `https://iwage.co/naturaleza/experiencias/${exp.slug}`,
    });
    if (result) { count++; console.log(`  ✓ ${exp.titulo} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_naturaleza (paquetes) ────────────────────

async function syncPaquetes() {
  console.log('\n📗 iwage_naturaleza: paquetes');
  const items = await strapiGetAll(IWAGE_STRAPI, 'paquetes',
    ['slug', 'titulo', 'precio_base', 'duracion_dias', 'activo'],
    '&filters[activo][$eq]=true');

  let count = 0;
  for (const pkg of items) {
    const durMin = pkg.duracion_dias ? pkg.duracion_dias * 24 * 60 : null;
    const result = await syncRecurso({
      nombre: pkg.titulo,
      slug: pkg.slug,
      tipo: 'paquete',
      origen: 'iwage_naturaleza',
      origen_slug: pkg.slug,
      requiere_pago: true,
      precio_base: pkg.precio_base || null,
      moneda: 'COP',
      capacidad_maxima: 12,
      duracion_minutos: durMin,
      tipo_disponibilidad: 'rango_fechas',
      config_disponibilidad: {
        dias_semana: [1, 2, 3, 4, 5, 6, 7],
        hora_apertura: '00:00',
        hora_cierre: '23:59',
        duracion_slot_minutos: durMin || 1440,
        intervalo_entre_slots_minutos: 0,
        capacidad_por_slot: 12,
        anticipacion_minima_horas: 48,
        max_reservas_por_cliente: 2,
        bloqueos: [],
      },
      url_publica: `https://iwage.co/naturaleza/programas/${pkg.slug}`,
    });
    if (result) { count++; console.log(`  ✓ ${pkg.titulo} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_gestion (propiedades en gestión) ─────────

async function syncPropiedadesGestion() {
  console.log('\n📘 iwage_gestion: propiedades');
  const items = await strapiGetAll(IWAGE_STRAPI, 'propiedades-gestion',
    ['slug', 'titulo', 'precio_noche', 'capacidad_huespedes', 'tipo_gestion', 'estado'],
    '&filters[estado][$eq]=activa');

  let count = 0;
  for (const prop of items) {
    // Solo las que tienen precio nocturno son reservables online
    const requierePago = !!prop.precio_noche;
    const result = await syncRecurso({
      nombre: prop.titulo,
      slug: prop.slug,
      tipo: 'propiedad_estancia',
      origen: 'iwage_gestion',
      origen_slug: prop.slug,
      requiere_pago: requierePago,
      precio_base: prop.precio_noche || null,
      moneda: 'COP',
      capacidad_maxima: prop.capacidad_huespedes || 10,
      duracion_minutos: 1440, // 1 noche
      tipo_disponibilidad: requierePago ? 'rango_fechas' : 'bajo_consulta',
      config_disponibilidad: null, // rango_fechas usa modelo abierto-salvo-bloqueo
      url_publica: `https://iwage.co/gestion/propiedades/${prop.slug}`,
      metadata: { tipo_gestion: prop.tipo_gestion },
    });
    if (result) { count++; console.log(`  ✓ ${prop.titulo} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_tierras (visitas a propiedades) ──────────

async function syncPropiedadesTierras() {
  console.log('\n📙 iwage_tierras: visitas a propiedades');
  const items = await strapiGetAll(IWAGE_STRAPI, 'propiedades',
    ['slug', 'titulo', 'estado'],
    '&filters[estado][$eq]=disponible');

  let count = 0;
  for (const prop of items) {
    const recursoSlug = `visita-${prop.slug}`;
    const result = await syncRecurso({
      nombre: `Visita: ${prop.titulo}`,
      slug: recursoSlug,
      tipo: 'propiedad_visita',
      origen: 'iwage_tierras',
      origen_slug: prop.slug,
      requiere_pago: false,
      precio_base: null,
      moneda: 'COP',
      capacidad_maxima: 5,
      duracion_minutos: 120,
      tipo_disponibilidad: 'slot_horario',
      config_disponibilidad: {
        dias_semana: [1, 2, 3, 4, 5, 6],
        hora_apertura: '08:00',
        hora_cierre: '17:00',
        duracion_slot_minutos: 120,
        intervalo_entre_slots_minutos: 60,
        capacidad_por_slot: 5,
        anticipacion_minima_horas: 24,
        max_reservas_por_cliente: 2,
        bloqueos: [],
      },
      url_publica: `https://iwage.co/tierras/propiedades/${prop.slug}`,
    });
    if (result) { count++; console.log(`  ✓ Visita: ${prop.titulo} (${result.action})`); }
  }
  return count;
}

// ── Sync: marca_personal (servicios) ─────────────────────

async function syncServiciosMarcaPersonal() {
  console.log('\n📕 marca_personal: servicios');
  const items = await strapiGetAll(MP_STRAPI, 'servicios',
    ['slug', 'title', 'price', 'currency', 'duration', 'cupo_mensual', 'type']);

  let count = 0;
  for (const svc of items) {
    const precio = parsePrice(svc.price);
    const durMin = parseDurationMinutes(svc.duration);
    const cupo = svc.cupo_mensual || 0;
    // Servicios con cupo 0 son "bajo consulta" (sin agenda automática)
    const tipoDisp = cupo > 0 ? 'slot_horario' : 'bajo_consulta';
    const result = await syncRecurso({
      nombre: svc.title,
      slug: svc.slug,
      tipo: precio ? 'servicio' : 'consulta_gratuita',
      origen: 'marca_personal',
      origen_slug: svc.slug,
      requiere_pago: !!precio,
      precio_base: precio,
      moneda: svc.currency || 'COP',
      capacidad_maxima: cupo || 1,
      duracion_minutos: durMin,
      tipo_disponibilidad: tipoDisp,
      config_disponibilidad: cupo > 0 ? {
        dias_semana: [1, 2, 3, 4, 5],
        hora_apertura: '08:00',
        hora_cierre: '18:00',
        duracion_slot_minutos: durMin || 60,
        intervalo_entre_slots_minutos: 30,
        capacidad_por_slot: cupo,
        anticipacion_minima_horas: 48,
        max_reservas_por_cliente: 1,
        bloqueos: [],
      } : null,
      url_publica: `https://camilosalazar.co/es/servicios/${svc.slug}`,
      metadata: { type: svc.type, cupo_mensual: cupo },
    });
    if (result) { count++; console.log(`  ✓ ${svc.title} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_cafe (menú) ─────────────────────────────

async function syncCafeMenu() {
  console.log('\n☕ iwage_cafe: menú');
  const items = await strapiGetAll(IWAGE_STRAPI, 'item-menus',
    ['nombre', 'slug', 'precio', 'categoria', 'disponible'],
    '&filters[disponible][$eq]=true');

  let count = 0;
  for (const item of items) {
    const precio = parsePrice(item.precio);
    const slug = item.slug || item.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await syncRecurso({
      nombre: item.nombre,
      slug: `cafe-${slug}`,
      tipo: 'pedido_cafe',
      origen: 'iwage_cafe',
      origen_slug: slug,
      requiere_pago: true,
      precio_base: precio,
      moneda: 'COP',
      capacidad_maxima: 20,
      duracion_minutos: 30,
      tipo_disponibilidad: 'inmediato',
      config_disponibilidad: null,
      url_publica: `https://iwage.co/cafe/menu`,
      metadata: { categoria: item.categoria },
    });
    if (result) { count++; console.log(`  ✓ ${item.nombre} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_meliponas (productos) ────────────────────

async function syncProductosMeliponas() {
  console.log('\n🐝 iwage_meliponas: productos');
  const items = await strapiGetAll(IWAGE_STRAPI, 'productos',
    ['nombre', 'slug', 'precio', 'categoria', 'stock_disponible', 'presentacion']);

  let count = 0;
  for (const prod of items) {
    const slug = prod.slug || prod.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await syncRecurso({
      nombre: prod.nombre,
      slug: `meliponas-${slug}`,
      tipo: 'producto',
      origen: 'iwage_meliponas',
      origen_slug: slug,
      requiere_pago: true,
      precio_base: prod.precio || null,
      moneda: 'COP',
      capacidad_maxima: prod.stock_cantidad || 50,
      duracion_minutos: null,
      tipo_disponibilidad: 'inmediato',
      config_disponibilidad: null,
      url_publica: `https://iwage.co/meliponas/tienda`,
      metadata: { categoria: prod.categoria, presentacion: prod.presentacion },
    });
    if (result) { count++; console.log(`  ✓ ${prod.nombre} (${result.action})`); }
  }
  return count;
}

// ── Sync: iwage_meliponas (servicio polinización) ────────

async function syncServicioPolinizacion() {
  console.log('\n🐝 iwage_meliponas: servicio de polinización');
  // Single service resource (bajo consulta, sin pago online)
  const result = await syncRecurso({
    nombre: 'Servicio de Polinización con Meliponas',
    slug: 'servicio-polinizacion-meliponas',
    tipo: 'polinizacion',
    origen: 'iwage_meliponas',
    origen_slug: 'polinizacion',
    requiere_pago: false,
    precio_base: null,
    moneda: 'COP',
    capacidad_maxima: 5,
    duracion_minutos: null,
    tipo_disponibilidad: 'bajo_consulta',
    config_disponibilidad: null,
    url_publica: 'https://iwage.co/meliponas/polinizacion',
    metadata: { cultivos: ['café', 'aguacate', 'mora', 'tomate', 'uchuva', 'cacao'] },
  });
  if (result) { console.log(`  ✓ Servicio de Polinización (${result.action})`); return 1; }
  return 0;
}

// ── Sync: iwage_complementos (servicios adicionales) ─────

async function syncComplementos() {
  console.log('\n🎁 iwage_complementos: complementos');
  const items = await strapiGetAll(IWAGE_STRAPI, 'complementos',
    ['nombre', 'slug', 'precio', 'categoria', 'disponible', 'precio_por'],
    '&filters[disponible][$eq]=true');

  let count = 0;
  for (const comp of items) {
    const result = await syncRecurso({
      nombre: comp.nombre,
      slug: `complemento-${comp.slug}`,
      tipo: 'complemento',
      origen: 'iwage_complementos',
      origen_slug: comp.slug,
      requiere_pago: (comp.precio || 0) > 0,
      precio_base: comp.precio || null,
      moneda: 'COP',
      capacidad_maxima: 50,
      duracion_minutos: null,
      tipo_disponibilidad: 'inmediato',
      config_disponibilidad: null,
      url_publica: 'https://iwage.co/gestion/alojamientos',
      metadata: { categoria: comp.categoria, precio_por: comp.precio_por },
    });
    if (result) { count++; console.log(`  ✓ ${comp.nombre} (${result.action})`); }
  }
  return count;
}

// ── Sync: espacios_plus (servicios de diseño) ────────────

async function syncServiciosEspaciosPlus() {
  console.log('\n🪑 espacios_plus: servicios de diseño');
  const items = await strapiGetAll(ESPACIOS_PLUS_STRAPI, 'servicios',
    ['nombre', 'slug', 'linea', 'precio_desde']);

  let count = 0;
  for (const svc of items) {
    const result = await syncRecurso({
      nombre: svc.nombre,
      slug: svc.slug,
      tipo: 'servicio',
      origen: 'espacios_plus',
      origen_slug: svc.slug,
      requiere_pago: false,
      precio_base: svc.precio_desde || null,
      moneda: 'COP',
      capacidad_maxima: 3,
      duracion_minutos: null,
      tipo_disponibilidad: 'bajo_consulta',
      config_disponibilidad: null,
      url_publica: `https://espaciosplus.com/mobiliario/servicios/${svc.slug}`,
      metadata: { linea: svc.linea },
    });
    if (result) { count++; console.log(`  ✓ ${svc.nombre} (${result.action})`); }
  }
  return count;
}

// ── Sync: espacios_plus (modelos de vivienda) ────────────

async function syncModelosVivienda() {
  console.log('\n🏠 espacios_plus: modelos de vivienda');
  const items = await strapiGetAll(ESPACIOS_PLUS_STRAPI, 'modelo-viviendas',
    ['nombre', 'slug', 'tipo', 'precio_base', 'area_m2']);

  let count = 0;
  for (const modelo of items) {
    const result = await syncRecurso({
      nombre: modelo.nombre,
      slug: modelo.slug,
      tipo: 'modelo_vivienda',
      origen: 'espacios_plus',
      origen_slug: modelo.slug,
      requiere_pago: false,
      precio_base: modelo.precio_base || null,
      moneda: 'COP',
      capacidad_maxima: 1,
      duracion_minutos: null,
      tipo_disponibilidad: 'bajo_consulta',
      config_disponibilidad: null,
      url_publica: `https://espaciosplus.com/viviendas/modelos/${modelo.slug}`,
      metadata: { tipo_vivienda: modelo.tipo, area_m2: modelo.area_m2 },
    });
    if (result) { count++; console.log(`  ✓ ${modelo.nombre} (${result.action})`); }
  }
  return count;
}

// ── Sync: espacios_plus (productos mobiliario) ───────────

async function syncProductosEspaciosPlus() {
  console.log('\n🪑 espacios_plus: productos mobiliario');
  const items = await strapiGetAll(ESPACIOS_PLUS_STRAPI, 'productos',
    ['nombre', 'slug', 'precio_base', 'categoria', 'disponible', 'bajo_pedido', 'tiempo_fabricacion_dias']);

  let count = 0;
  for (const prod of items) {
    if (!prod.slug) continue;
    const result = await syncRecurso({
      nombre: prod.nombre,
      slug: prod.slug,
      tipo: 'producto',
      origen: 'espacios_plus',
      origen_slug: prod.slug,
      requiere_pago: false,
      precio_base: prod.precio_base || null,
      moneda: 'COP',
      capacidad_maxima: 10,
      duracion_minutos: prod.tiempo_fabricacion_dias ? prod.tiempo_fabricacion_dias * 1440 : null,
      tipo_disponibilidad: prod.bajo_pedido ? 'bajo_consulta' : 'inmediato',
      config_disponibilidad: null,
      url_publica: `https://espaciosplus.com/mobiliario/catalogo/${prod.slug}`,
      metadata: { categoria: prod.categoria, bajo_pedido: prod.bajo_pedido },
    });
    if (result) { count++; console.log(`  ✓ ${prod.nombre} (${result.action})`); }
  }
  return count;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log('🔄 Sync unificado de recursos reservables → app_reservas');
  console.log(`   iwage_strapi: ${IWAGE_STRAPI}`);
  console.log(`   marca_personal: ${MP_STRAPI}`);
  console.log(`   espacios_plus: ${ESPACIOS_PLUS_STRAPI}`);
  console.log(`   reservas_api: ${RESERVAS_API}`);

  // Verify connectivity
  try {
    const healthRes = await fetch(`${RESERVAS_API}/api/recursos?activo=false`, { signal: AbortSignal.timeout(5000) });
    if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`);
  } catch (err) {
    console.error(`\n❌ No se pudo conectar a app_reservas en ${RESERVAS_API}: ${err.message}`);
    process.exit(1);
  }

  const results = {
    experiencias: await syncExperiencias(),
    paquetes: await syncPaquetes(),
    propiedades_gestion: await syncPropiedadesGestion(),
    propiedades_tierras: await syncPropiedadesTierras(),
    servicios_marca: await syncServiciosMarcaPersonal(),
    cafe_menu: await syncCafeMenu(),
    meliponas_productos: await syncProductosMeliponas(),
    meliponas_polinizacion: await syncServicioPolinizacion(),
    espacios_servicios: await syncServiciosEspaciosPlus(),
    espacios_modelos: await syncModelosVivienda(),
    espacios_productos: await syncProductosEspaciosPlus(),
    complementos: await syncComplementos(),
  };

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Completado: ${total} recursos sincronizados`);
  console.log(`   naturaleza: exp=${results.experiencias} pkg=${results.paquetes}`);
  console.log(`   gestion=${results.propiedades_gestion} tierras=${results.propiedades_tierras}`);
  console.log(`   marca_personal=${results.servicios_marca}`);
  console.log(`   cafe=${results.cafe_menu} meliponas=${results.meliponas_productos + results.meliponas_polinizacion}`);
  console.log(`   espacios_plus: svc=${results.espacios_servicios} modelos=${results.espacios_modelos} prod=${results.espacios_productos}`);
  console.log(`   complementos=${results.complementos}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
