/**
 * Iwagé Tierras — Strapi data access layer
 * Handles property listings, filters, and detail pages.
 */
import { strapiFetch, strapiSingle, CACHE_TTL } from './strapi.ts';
// `toMediaItem`/`toMediaList` son el contrato de medios del sitio (`src/lib/media.ts`).
// Los imports runtime de un módulo de `src/lib` llevan extensión `.ts`: sin ella solo los
// resuelve el bundler de Astro, y `node --test` carga este archivo directo
// (`tests/normalizar-medio-4.test.mjs`). Precedente: `src/lib/bitacora-ruta.ts:8`.
import { toMediaItem, toMediaList, type MediaItem } from './media.ts';

// ── Types ──────────────────────────────────────────────

export interface Propiedad {
  id: number;
  documentId: string;
  uuid: string | null;
  titulo: string;
  slug: string;
  descripcion: string | null;
  seo_titulo: string | null;
  seo_descripcion: string | null;
  tipo_propiedad: 'finca' | 'lote' | 'casa_campestre' | 'predio_rural' | 'terreno' | 'otro';
  operacion: 'venta' | 'arriendo';
  precio: number | null;
  moneda: string;
  estado: 'disponible' | 'reservado' | 'vendido' | 'retirado';
  es_destacado: boolean;
  publicado: boolean;
  ubicacion_direccion: string | null;
  ubicacion_municipio: string | null;
  ubicacion_departamento: string | null;
  ubicacion_latitud: number | null;
  ubicacion_longitud: number | null;
  area_total: number | null;
  area_construida: number | null;
  area_hectareas: number | null;
  numero_habitaciones: number | null;
  numero_banos: number | null;
  numero_garajes: number | null;
  anno_construccion: number | null;
  caracteristicas: Record<string, any> | null;
  video_url: string | null;
  tour_virtual_url: string | null;
  link_drone: string | null;
  disponibilidad_agua: string | null;
  energia_electrica: boolean;
  tipo_via: string | null;
  distancia_centro_poblado: number | null;
  sello_vap: 'oro' | 'plata' | 'bronce' | 'cuarentena';
  modelo_sugerido: { titulo?: string; valor?: string; icono?: string } | null;
  /**
   * Los dos campos son `type: media` en
   * `strapi/src/api/propiedad/content-types/propiedad/schema.json` (`imagen_principal`
   * simple, `imagenes` múltiple) y salen de `normalizePropiedad` ya como `MediaItem`:
   * `url` reducida a ruta de sitio (nginx proxya `/uploads`; una URL con el host interno
   * del compose es un roto en el navegador), `alt` tomado del `alternativeText` del admin
   * y `kind`/`provider` resueltos por `src/lib/media.ts`.
   * `null` en `imagenes` sigue significando "Strapi no trajo el campo" (una relación
   * vacía sale `[]`), así que las plantillas no cambian de contrato.
   */
  imagenes: MediaItem[] | null;
  imagen_principal: MediaItem | null;
  detalle_rural: DetalleRural | null;
  verificacion_vap: VerificacionVAP | null;
  perfil_comprador: 'productivo' | 'campestre' | 'nomada' | 'turistico' | 'patrimonial';
  experiencias: Array<{ id: number; slug: string; titulo: string; categoria?: string; precio_desde?: number }> | null;
  proveedores: Array<{ id: number; slug: string; nombre: string; producto?: string; ubicacion?: string }> | null;
}

export interface DetalleRural {
  tiene_concesion_agua?: boolean;
  tipo_concesion_agua?: string;
  caudal_autorizado_ls?: number;
  entidad_concesion?: string;
  tiene_puaa?: boolean;
  tipo_via_acceso?: string;
  distancia_casco_urbano_min?: number;
  municipio_referencia?: string;
  tiene_energia_trifasica?: boolean;
  cobertura_starlink_verificada?: boolean;
  velocidad_internet_mbps?: number;
  vocacion_suelo_pbot?: string;
  restriccion_fraccionamiento_m2?: number;
  uso_suelo_permitido?: string;
  inclinacion_topografica?: string;
  porcentaje_area_plana?: number;
  tiene_levantamiento_topografico?: boolean;
  apta_glamping_agroturismo?: boolean;
  pre_viabilidad_turistica?: string;
  tiene_mirador_natural?: boolean;
  roi_estimado_glamping_pct?: number;
  seguridad_sector?: string;
  estado_legal?: string;
  observaciones_legales?: string;
}

export interface VerificacionVAP {
  tipo?: string;
  reporte_banderas?: any;
  conclusion_auditor?: string;
  costo_estimado_saneamiento?: number;
  nota_transparencia?: string;
  fecha_aprobacion?: string;
  fecha_vencimiento?: string;
}

export interface PerfilComprador {
  id: string;
  num: string;
  label: string;
  headline: string;
  accentHeadline: string;
  subheadline: string;
  checks: Array<{ text: string; detail: string }>;
  cta: string;
  tag: string;
  metrics: Array<{ val: string; lbl: string }>;
}

// ── Constants ──────────────────────────────────────────

export const TIPOS_PROPIEDAD = [
  { slug: 'finca', label: 'Finca' },
  { slug: 'lote', label: 'Lote' },
  { slug: 'casa_campestre', label: 'Casa Campestre' },
  { slug: 'predio_rural', label: 'Predio Rural' },
  { slug: 'terreno', label: 'Terreno' },
] as const;

export const SELLOS_VAP = [
  { id: 'oro', label: 'Sello Oro', tagline: 'Total paz mental', icono: 'medal', desc: 'Escritura pública saneada, sin cargas ni gravámenes activos. Linderos milimétricos. Sin restricciones ambientales.' },
  { id: 'plata', label: 'Sello Plata', tagline: 'Nudo gestionable', icono: 'medal', desc: 'Documentación sólida con un nudo jurídico identificado. Ruta de cierre clara.' },
  { id: 'bronce', label: 'Sello Bronce', tagline: 'Oportunidad informada', icono: 'medal', desc: 'Posesión histórica documentada o nudos complejos. Venta de contado bajo consentimiento informado.' },
  { id: 'cuarentena', label: 'Cuarentena', tagline: 'Bloqueo Comercial', icono: 'ban', desc: 'Hallazgo crítico insalvable. La propiedad no se comercializa.' },
] as const;

export const PERFILES_COMPRADOR: PerfilComprador[] = [
  {
    id: 'productivo',
    num: '01',
    label: 'Producción agropecuaria',
    headline: 'Tierra que trabaja para ti todos los días.',
    accentHeadline: 'para ti todos los días.',
    subheadline: 'Buscas suelos productivos, agua garantizada y vías de acceso para maquinaria. Aquí encontrarás fincas auditadas con todo lo que necesitas saber antes de invertir.',
    checks: [
      { text: 'Concesión de agua verificada', detail: 'con Cortolima — caudal en litros/segundo y vigencia del permiso.' },
      { text: 'Vocación del suelo según PBOT', detail: '— agrícola, ganadero o mixto, con usos permitidos claros.' },
      { text: 'Tipo de vía de acceso', detail: '— pavimentada, placa huella o afirmado, y acceso para camiones.' },
      { text: 'Topografía certificada', detail: '— área exacta, linderos y porcentaje de terreno plano.' },
    ],
    cta: 'Ver fincas productivas',
    tag: 'Fincas & Predios',
    metrics: [
      { val: '18+', lbl: 'Fincas productivas' },
      { val: '100%', lbl: 'Agua certificada' },
      { val: '2–80', lbl: 'Hectáreas' },
    ],
  },
  {
    id: 'campestre',
    num: '02',
    label: 'Vivir en el campo',
    headline: 'El ruido de la ciudad ya no te pertenece.',
    accentHeadline: 'ya no te pertenece.',
    subheadline: 'Quieres despertar con montañas en la ventana, estar a 30 minutos de todo y no renunciar a ninguna comodidad.',
    checks: [
      { text: 'Distancia real en minutos', detail: 'desde Ibagué, sin estimaciones optimistas.' },
      { text: 'Conectividad verificada', detail: '— qué tipo de internet real hay en el predio.' },
      { text: 'Entorno y vecindario', detail: '— condominios con vigilancia, vías pavimentadas.' },
      { text: 'Fotografía aérea con drone', detail: 'en cada propiedad.' },
    ],
    cta: 'Ver casas campestres',
    tag: 'Casas & Lotes',
    metrics: [
      { val: '20 min', lbl: 'Promedio a Ibagué' },
      { val: '$150M+', lbl: 'Desde' },
      { val: '12+', lbl: 'Condominios activos' },
    ],
  },
  {
    id: 'nomada',
    num: '03',
    label: 'Nómada digital',
    headline: 'Trabaja desde el campo. Sin perder señal.',
    accentHeadline: 'Sin perder señal.',
    subheadline: 'Generas ingresos desde cualquier lugar y quieres que ese lugar sea el Tolima. Aquí solo verás propiedades con internet real, verificado.',
    checks: [
      { text: 'Sello Internet Verificado', detail: '— cielo despejado confirmado, +200 Mbps.' },
      { text: 'Conectividad garantizada', detail: '— si no tiene internet real, no está en este catálogo.' },
      { text: 'Espacios home office', detail: '— áreas adaptables para trabajo rural.' },
      { text: 'Gestión remota 100%', detail: '— recorridos virtuales 360°, documentos digitales.' },
    ],
    cta: 'Ver propiedades con Internet',
    tag: 'Conectividad certificada',
    metrics: [
      { val: '200+', lbl: 'Mbps Internet' },
      { val: '99.9%', lbl: 'Uptime' },
      { val: 'USD', lbl: 'Pagos globales' },
    ],
  },
  {
    id: 'turistico',
    num: '04',
    label: 'Proyecto turístico',
    headline: 'Un lote hoy. Un negocio mañana.',
    accentHeadline: 'Un negocio mañana.',
    subheadline: 'Buscas tierra con potencial turístico para montar glamping, ecoturismo o retiros. Nosotros ya hicimos el análisis de viabilidad.',
    checks: [
      { text: 'Pre-viabilidad turística', detail: '— miradores, fuentes hídricas y vocación de suelo.' },
      { text: 'Estimación de ROI', detail: '— proyección de ingresos reales para turismo rural.' },
      { text: 'Internet verificado', detail: '— condición indispensable para huéspedes modernos.' },
      { text: 'Property Management', detail: '— si compras, te administramos el proyecto.' },
    ],
    cta: 'Ver lotes para glamping',
    tag: 'Glamping & Turismo',
    metrics: [
      { val: '18–35%', lbl: 'ROI anual' },
      { val: '$50M+', lbl: 'Lotes desde' },
      { val: '100%', lbl: 'Pre-viabilidad' },
    ],
  },
  {
    id: 'patrimonial',
    num: '05',
    label: 'Inversión y patrimonio',
    headline: 'La tierra no se devalúa. No la hackean.',
    accentHeadline: 'No la hackean.',
    subheadline: 'Quieres diversificar fuera de la bolsa y los CDTs. La tierra rural del Tolima ha valorizado consistentemente.',
    checks: [
      { text: 'Estudio de títulos incluido', detail: '— verificamos la cadena de tradición.' },
      { text: 'Análisis de valorización', detail: 'por corredor geográfico con datos proyectados.' },
      { text: 'Avalúo certificado', detail: '— por profesionales inscritos en el RNA.' },
      { text: 'Calculadora de gastos', detail: '— simula derechos y registro antes de comprometerte.' },
    ],
    cta: 'Ver propiedades de inversión',
    tag: 'Inversión & Patrimonio',
    metrics: [
      { val: '+12%', lbl: 'Valorización anual' },
      { val: '$150M', lbl: 'Ticket mínimo' },
      { val: 'Títulos', lbl: '100% Claros' },
    ],
  },
];

// ── Data Fetchers ──────────────────────────────────────

export interface PropiedadFilters {
  tipo?: string;
  operacion?: string;
  perfil?: string;
  municipio?: string;
  precioMin?: number;
  precioMax?: number;
  areaMin?: number;
  destacado?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/**
 * Fetch published properties with optional filters.
 */
export async function getPropiedades(filters: PropiedadFilters = {}): Promise<{
  data: Propiedad[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const strapiFilters: Record<string, any> = {
    publicado: { $eq: true },
  };

  if (filters.tipo) strapiFilters.tipo_propiedad = { $eq: filters.tipo };
  if (filters.operacion) strapiFilters.operacion = { $eq: filters.operacion };
  if (filters.perfil) strapiFilters.perfil_comprador = { $eq: filters.perfil };
  if (filters.municipio) strapiFilters.ubicacion_municipio = { $containsi: filters.municipio };
  if (filters.destacado) strapiFilters.es_destacado = { $eq: true };
  if (filters.precioMin) strapiFilters.precio = { ...strapiFilters.precio, $gte: filters.precioMin };
  if (filters.precioMax) strapiFilters.precio = { ...strapiFilters.precio, $lte: filters.precioMax };
  if (filters.areaMin) strapiFilters.area_hectareas = { $gte: filters.areaMin };
  if (filters.search) strapiFilters.titulo = { $containsi: filters.search };

  const cacheKey = `strapi:propiedades:${JSON.stringify(strapiFilters)}:${filters.page || 1}:${filters.pageSize || 12}`;

  try {
    const res = await strapiFetch<any>('propiedades', {
      ttl: CACHE_TTL.search,
      cacheKey,
      populate: ['imagen_principal', 'imagenes'],
      filters: strapiFilters,
      sort: filters.sort || 'es_destacado:desc',
      pagination: { page: filters.page || 1, pageSize: filters.pageSize || 12 },
    });

    return {
      data: (res.data || []).map(normalizePropiedad),
      total: res.meta?.pagination?.total || 0,
      page: res.meta?.pagination?.page || 1,
      pageSize: res.meta?.pagination?.pageSize || 12,
    };
  } catch {
    return { data: [], total: 0, page: 1, pageSize: 12 };
  }
}

/**
 * Fetch a single property by slug.
 */
export async function getPropiedadBySlug(slug: string): Promise<Propiedad | null> {
  try {
    const res = await strapiFetch<any>('propiedades', {
      ttl: CACHE_TTL.single,
      cacheKey: `strapi:propiedad:${slug}`,
      populate: ['imagen_principal', 'imagenes', 'experiencias', 'proveedores'],
      filters: { slug: { $eq: slug }, publicado: { $eq: true } },
      pagination: { pageSize: 1 },
    });

    if (!res.data || res.data.length === 0) return null;
    return normalizePropiedad(res.data[0]);
  } catch {
    return null;
  }
}

/**
 * Fetch all published slugs (for static generation or sitemap).
 */
export async function getAllPropiedadSlugs(): Promise<string[]> {
  try {
    const res = await strapiFetch<any>('propiedades', {
      ttl: CACHE_TTL.list,
      cacheKey: 'strapi:propiedades:slugs',
      filters: { publicado: { $eq: true } },
      pagination: { pageSize: 100 },
      sort: 'createdAt:desc',
    });
    return (res.data || []).map((p: any) => p.slug);
  } catch {
    return [];
  }
}

/**
 * Fetch featured properties (for homepage).
 */
export async function getPropiedadesDestacadas(limit = 6): Promise<Propiedad[]> {
  const { data } = await getPropiedades({ destacado: true, pageSize: limit });
  return data;
}

// ── Helpers ────────────────────────────────────────────

/**
 * Fila cruda de Strapi → `Propiedad` para plantilla. Está exportada por la misma razón que
 * `filasParaPlantilla` en `src/lib/bitacora-resumen.ts`: el mapeo tiene que poder probarse
 * sin Redis ni red (`tests/normalizar-medio-4.test.mjs`), y NO muta la fila de entrada —
 * `strapiFetch` reparte el mismo objeto entre llamadas concurrentes.
 */
export function normalizePropiedad(raw: any): Propiedad {
  return {
    id: raw.id,
    documentId: raw.documentId,
    uuid: raw.uuid || null,
    titulo: raw.titulo,
    slug: raw.slug,
    descripcion: raw.descripcion || null,
    seo_titulo: raw.seo_titulo || null,
    seo_descripcion: raw.seo_descripcion || null,
    tipo_propiedad: raw.tipo_propiedad || 'finca',
    operacion: raw.operacion || 'venta',
    precio: raw.precio ? Number(raw.precio) : null,
    moneda: raw.moneda || 'COP',
    estado: raw.estado || 'disponible',
    es_destacado: raw.es_destacado || false,
    publicado: raw.publicado || false,
    ubicacion_direccion: raw.ubicacion_direccion || null,
    ubicacion_municipio: raw.ubicacion_municipio || null,
    ubicacion_departamento: raw.ubicacion_departamento || 'Tolima',
    ubicacion_latitud: raw.ubicacion_latitud ? Number(raw.ubicacion_latitud) : null,
    ubicacion_longitud: raw.ubicacion_longitud ? Number(raw.ubicacion_longitud) : null,
    area_total: raw.area_total ? Number(raw.area_total) : null,
    area_construida: raw.area_construida ? Number(raw.area_construida) : null,
    area_hectareas: raw.area_hectareas ? Number(raw.area_hectareas) : null,
    numero_habitaciones: raw.numero_habitaciones || null,
    numero_banos: raw.numero_banos || null,
    numero_garajes: raw.numero_garajes || null,
    anno_construccion: raw.anno_construccion || null,
    caracteristicas: raw.caracteristicas || null,
    video_url: raw.video_url || null,
    tour_virtual_url: raw.tour_virtual_url || null,
    link_drone: raw.link_drone || null,
    disponibilidad_agua: raw.disponibilidad_agua || null,
    energia_electrica: raw.energia_electrica || false,
    tipo_via: raw.tipo_via || null,
    distancia_centro_poblado: raw.distancia_centro_poblado ? Number(raw.distancia_centro_poblado) : null,
    sello_vap: raw.sello_vap || 'plata',
    modelo_sugerido: raw.modelo_sugerido || null,
    // `toMediaList`/`toMediaItem` en vez de abrir el objeto media campo a campo. Lo que
    // arregla no es cosmética:
    //  · `alt` del admin — el `.map((img: any) => ({ url, alternativeText }))` dejaba la
    //    clave con el nombre de Strapi, y ninguna plantilla la leía: el `alt` salía del
    //    título de la propiedad, no de la foto.
    //  · la ruta — `mediaSrc()` dentro de `propiedadImagen()` solo reducía UNA de las dos
    //    salidas; `prop.imagenes[0].url` pintado directo en una plantilla se servía con el
    //    host interno del compose (`http://strapi_backend:1337/…`), que el navegador no ve.
    //  · la basura — `{ url: img.url }` sobre un elemento `null` lanzaba `TypeError` que
    //    `getPropiedades` atrapaba EN BLOQUE y devolvía `data: []`: un dato feo se
    //    disfrazaba de "Strapi caído" y vaciaba el catálogo.
    // `null` sigue significando "el campo no vino" (relación no populateada), no "vacía".
    imagenes: Array.isArray(raw.imagenes) ? toMediaList(raw.imagenes) : null,
    imagen_principal: toMediaItem(raw.imagen_principal),
    detalle_rural: raw.detalle_rural || null,
    verificacion_vap: raw.verificacion_vap || null,
    perfil_comprador: raw.perfil_comprador || 'productivo',
    experiencias: Array.isArray(raw.experiencias) ? raw.experiencias.map((e: any) => ({ id: e.id, slug: e.slug, titulo: e.titulo, categoria: e.categoria, precio_desde: e.precio_desde ? Number(e.precio_desde) : undefined })) : null,
    proveedores: Array.isArray(raw.proveedores) ? raw.proveedores.map((p: any) => ({ id: p.id, slug: p.slug, nombre: p.nombre, producto: p.producto, ubicacion: p.ubicacion })) : null,
  };
}

/** Format price for display */
export function formatPrecio(precio: number | null, moneda = 'COP'): string {
  if (!precio) return 'Consultar';
  if (moneda === 'COP') {
    if (precio >= 1_000_000_000) return `$${(precio / 1_000_000_000).toFixed(1)}B`;
    if (precio >= 1_000_000) return `$${(precio / 1_000_000).toFixed(0)}M`;
    return `$${precio.toLocaleString('es-CO')}`;
  }
  return `$${precio.toLocaleString('es-CO')}`;
}

/**
 * La portada de una propiedad como `MediaItem` — no como ruta.
 *
 * Antes devolvía `string | null` (`mediaSrc(...)`), y por esa firma las tres tarjetas del
 * catálogo pintaban `alt={prop.titulo}`: el `alternativeText` del admin no tenía camino al
 * `<img>`. Acá sale el item completo, así que la plantilla hace
 * `src={img.url}` + `alt={img.alt || prop.titulo}`.
 *
 * SIN FALLBACK de imagen: si Strapi no trajo nada devuelve `null` y la tarjeta cae al
 * mosaico `Icon`. Ninguna ruta de stock entra por acá (es la regla que el brief fija para
 * toda la fase; `LOCAL_IMAGES` en `cafe.ts` es el patrón que NO hay que reproducir).
 */
export function propiedadImagen(prop: Propiedad): MediaItem | null {
  const item = toMediaItem(prop.imagen_principal) ?? toMediaList(prop.imagenes ?? [])[0] ?? null;
  return item && item.url ? item : null;
}

/**
 * La galería de la ficha (`/tierras/propiedades/[slug]`) como `MediaItem[]`: la portada
 * delante y una sola vez. `toMediaList` deduplica por host+pathname, así que una portada
 * que además está en `imagenes` no sale dos veces ni desplaza a las demás.
 *
 * Devuelve `[]` (nunca `null`) para que el guard de la plantilla sea `galeria.length > 0`.
 */
export function propiedadGaleria(prop: Propiedad): MediaItem[] {
  const portada = propiedadImagen(prop);
  const resto = toMediaList(prop.imagenes ?? []);
  if (!portada) return resto;
  // La portada va primero, y si ya estaba en `imagenes` se quita de ahí (`toMediaList` ya
  // la hubiera dejado en su posición original).
  const clave = portada.url.toLowerCase();
  return [portada, ...resto.filter((i) => i.url.toLowerCase() !== clave)];
}

/** Format area display */
export function formatArea(prop: Propiedad): string {
  if (prop.area_hectareas && prop.area_hectareas >= 1) {
    return `${prop.area_hectareas.toFixed(1)} ha`;
  }
  if (prop.area_total) {
    return `${prop.area_total.toLocaleString('es-CO')} m²`;
  }
  return '';
}
