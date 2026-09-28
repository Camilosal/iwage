/**
 * Iwagé Gestión — Strapi data access layer
 * Handles managed properties with cross-brand relations.
 */
import { strapiFetch, CACHE_TTL } from './strapi.ts';
import { toMediaItem, toMediaList, type MediaItem } from './media.ts';

/** API interna de app_reservas (server-side) para filtros de disponibilidad */
// `?.` y no `import.meta.env` pelado: ese objeto lo inyecta Astro/Vite y en Node NO
// existe. Sin el encadenado el módulo no se puede importar desde `node --test`, y sin
// importarlo no hay forma de probar el mapeo de media (`normalizePropiedadGestion`).
const RESERVAS_API = import.meta.env?.RESERVAS_API_URL || 'http://reservas_app:4326';

// ── Types ──────────────────────────────────────────────

/** Servicio adicional (comida, espectáculo, compra, ...) vinculable a alojamientos y experiencias. */
export interface Complemento {
  id: number;
  documentId: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  categoria: 'comida' | 'espectaculo' | 'compra_local' | 'transporte' | 'actividad' | 'otro';
  precio: number;
  moneda: string;
  precio_por: 'persona' | 'grupo' | 'noche' | 'unidad';
  icono: string | null;
  /** La foto del servicio: `complemento.imagen` es `media` en el schema. */
  imagen: MediaItem | null;
}

/** Producto local recomendado (tienda del meliponario) vinculado al alojamiento para cross-selling. */
export interface ProductoRecomendado {
  id: number;
  documentId: string;
  slug: string;
  nombre: string;
  descripcion_corta: string | null;
  precio: number;
  presentacion: string | null;
  categoria: string;
  /** `producto.imagen` es `media` en el schema: el `string | null` que estaba declarado mentía. */
  imagen: MediaItem | null;
  destacado: boolean;
  stock_disponible: boolean;
}

/** Experiencia conectada a los alojamientos (datos clave para tarjetas del listado). */
export interface ExperienciaGestion {
  id: number;
  documentId: string;
  slug: string;
  titulo: string;
  resumen: string | null;
  categoria: string;
  ubicacion: string | null;
  duracion: string | null;
  cupo_maximo_desc: string | null;
  nivel_dificultad: number;
  precio_desde: number | null;
  /** Portada de la experiencia (`experiencia.imagen_hero`, que es `media`), ya normalizada. */
  imagen: MediaItem | null;
  es_destacado: boolean;
}

export interface PropiedadGestion {
  id: number;
  documentId: string;
  titulo: string;
  slug: string;
  descripcion: string | null;
  tipo_gestion: 'renta_corta' | 'finca_productiva' | 'segunda_residencia' | 'operacion_turistica';
  tipo_alojamiento: 'finca' | 'casa_campestre' | 'cabana' | 'glamping' | 'domo' | 'minicasa' | 'apartamento';
  modelo_alianza: 'gestion_pura' | 'co_inversion' | 'operacion_compartida';
  estado: 'activa' | 'pausada' | 'prospecto';
  es_destacado: boolean;
  publicado: boolean;
  precio_noche: number | null;
  precio_mensual: number | null;
  moneda: string;
  ubicacion_municipio: string | null;
  ubicacion_latitud: number | null;
  ubicacion_longitud: number | null;
  area_hectareas: number | null;
  numero_habitaciones: number | null;
  numero_banos: number | null;
  capacidad_huespedes: number | null;
  amenidades: string[] | null;
  highlights: string[] | null;
  /** Portada (`propiedad-gestion.imagen_principal`, que es `media`). */
  imagen_principal: MediaItem | null;
  /** Galería (`propiedad-gestion.galeria`, `media` multiple), ya aplanada y deduplicada. */
  galeria: MediaItem[];
  propiedad_tierras: { id: number; slug: string; titulo: string; precio?: number; operacion?: string } | null;
  experiencias: Array<{ id: number; slug: string; titulo: string; categoria?: string; precio_desde?: number }> | null;
  anfitriones: Array<{
    id: number;
    slug: string;
    nombre: string;
    /**
     * Antes `any`: salía el objeto media crudo de Strapi y la plantilla pintaba
     * `[object Object]` en el `src` (`gestion.ts:291`, defecto 2 del brief).
     */
    foto_perfil: MediaItem | null;
    nivel_escalafon?: number;
    especialidad?: string;
  }> | null;
  proveedores: Array<{ id: number; slug: string; nombre: string; producto?: string; ubicacion?: string }> | null;
  complementos: Complemento[] | null;
  productos: ProductoRecomendado[] | null;
  seo_titulo: string | null;
  seo_descripcion: string | null;
}

// ── Constants ──────────────────────────────────────────

export const TIPOS_GESTION = [
  { slug: 'renta_corta', label: 'Renta Corta', icon: 'sparkles', color: '#52B788', desc: 'Airbnb, Booking, Vrbo' },
  { slug: 'finca_productiva', label: 'Finca Productiva', icon: 'sprout', color: '#4CAF50', desc: 'Gestión agropecuaria' },
  { slug: 'segunda_residencia', label: 'Segunda Residencia', icon: 'house', color: '#2d5a8f', desc: 'Supervisión y mantenimiento' },
  { slug: 'operacion_turistica', label: 'Op. Turística', icon: 'tent', color: '#C8933E', desc: 'Glamping, ecoturismo, retiros' },
] as const;

export const MODELOS_ALIANZA = [
  { slug: 'gestion_pura', label: 'Gestión Pura', desc: 'Fee mensual + porcentaje de ingresos' },
  { slug: 'co_inversion', label: 'Co-Inversión', desc: 'Inversión conjunta, utilidades compartidas' },
  { slug: 'operacion_compartida', label: 'Operación Compartida', desc: 'Cada parte opera un componente' },
] as const;

/** Guest-facing accommodation types (clasificación del listado de alojamientos) */
export const TIPOS_ALOJAMIENTO = [
  { slug: 'finca', label: 'Finca', icon: 'wheat' },
  { slug: 'casa_campestre', label: 'Casa Campestre', icon: 'house' },
  { slug: 'cabana', label: 'Cabaña', icon: 'tent-tree' },
  { slug: 'glamping', label: 'Glamping', icon: 'tent' },
  { slug: 'domo', label: 'Domo', icon: 'hexagon' },
  { slug: 'minicasa', label: 'Minicasa', icon: 'caravan' },
  { slug: 'apartamento', label: 'Apartamento', icon: 'building' },
] as const;

/** Categorías de experiencia (mismas del enum en Strapi) con icono para filtros */
export const CATEGORIAS_EXPERIENCIA = [
  { slug: 'Naturaleza', label: 'Naturaleza', icon: 'leaf' },
  { slug: 'Cultura', label: 'Cultura', icon: 'landmark' },
  { slug: 'Bienestar', label: 'Bienestar', icon: 'heart-pulse' },
  { slug: 'Aventura', label: 'Aventura', icon: 'mountain' },
  { slug: 'Gastronomia', label: 'Gastronomía', icon: 'utensils' },
] as const;

/** Municipalities in Tolima for search filters */
export const MUNICIPIOS_TOLIMA = [
  'Ibagué', 'Alvarado', 'Venadillo', 'Coello', 'Lérida', 'Espinal',
  'Chaparral', 'Honda', 'Mariquita', 'Fresno', 'Libano', 'Cajamarca',
  'Melgar', 'Piedras', 'Valle de San Juan', 'San Luis', 'Carmen de Apicalá',
] as const;

// ── Filters ────────────────────────────────────────────

export interface GestionFilters {
  tipo?: string;
  /** Filtro por tipo de alojamiento (finca, cabaña, domo, ...) */
  tipoAlojamiento?: string;
  estado?: string;
  municipio?: string;
  destacado?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  checkin?: string;
  checkout?: string;
  huespedes?: number;
  /** Restringir a una lista de slugs (usado por el filtro de disponibilidad) */
  slugs?: string[];
}

// ── Data Fetchers ──────────────────────────────────────

const POPULATE_FIELDS = ['imagen_principal', 'galeria', 'propiedad_tierras', 'experiencias', 'anfitriones', 'proveedores', 'complementos', 'productos'];

/**
 * Fetch published managed properties with optional filters.
 */
export async function getPropiedadesGestion(filters: GestionFilters = {}): Promise<{
  data: PropiedadGestion[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const strapiFilters: Record<string, any> = {
    publicado: { $eq: true },
  };

  if (filters.tipo) strapiFilters.tipo_gestion = { $eq: filters.tipo };
  if (filters.tipoAlojamiento) strapiFilters.tipo_alojamiento = { $eq: filters.tipoAlojamiento };
  if (filters.estado) strapiFilters.estado = { $eq: filters.estado };
  if (filters.municipio) strapiFilters.ubicacion_municipio = { $containsi: filters.municipio };
  if (filters.destacado) strapiFilters.es_destacado = { $eq: true };
  if (filters.search) strapiFilters.titulo = { $containsi: filters.search };
  if (filters.huespedes) strapiFilters.capacidad_huespedes = { $gte: filters.huespedes };
  if (filters.slugs && filters.slugs.length > 0) strapiFilters.slug = { $in: filters.slugs };

  const cacheKey = `strapi:propiedades-gestion:${JSON.stringify(strapiFilters)}:${filters.page || 1}:${filters.pageSize || 12}`;

  try {
    const res = await strapiFetch<any>('propiedades-gestion', {
      ttl: CACHE_TTL.search,
      cacheKey,
      populate: POPULATE_FIELDS,
      filters: strapiFilters,
      sort: filters.sort || 'es_destacado:desc',
      pagination: { page: filters.page || 1, pageSize: filters.pageSize || 12 },
    });

    return {
      data: (res.data || []).map(normalizePropiedadGestion),
      total: res.meta?.pagination?.total || 0,
      page: res.meta?.pagination?.page || 1,
      pageSize: res.meta?.pagination?.pageSize || 12,
    };
  } catch {
    // Con Strapi caído el listado va vacío y la card pinta el mosaico Icon: las dos
    // «propiedades» del seed (Finca El Paraíso, Glamping Bosque de Niebla) se hacían
    // pasar por alojamientos reales, con teléfono y precio incluidos.
    return { data: [], total: 0, page: filters.page || 1, pageSize: filters.pageSize || 12 };
  }
}

/**
 * Fetch a single managed property by slug.
 */
export async function getPropiedadGestionBySlug(slug: string): Promise<PropiedadGestion | null> {
  try {
    const res = await strapiFetch<any>('propiedades-gestion', {
      ttl: CACHE_TTL.single,
      cacheKey: `strapi:propiedad-gestion:${slug}`,
      populate: POPULATE_FIELDS,
      filters: { slug: { $eq: slug }, publicado: { $eq: true } },
      pagination: { pageSize: 1 },
    });

    if (!res.data || res.data.length === 0) return null;
    return normalizePropiedadGestion(res.data[0]);
  } catch {
    return null;
  }
}

/**
 * Fetch featured managed properties (for homepage).
 */
export async function getPropiedadesGestionDestacadas(limit = 3): Promise<PropiedadGestion[]> {
  const { data } = await getPropiedadesGestion({ destacado: true, pageSize: limit });
  return data;
}

/**
 * Fetch all published slugs (for static generation or sitemap).
 */
export async function getAllPropiedadGestionSlugs(): Promise<string[]> {
  try {
    const res = await strapiFetch<any>('propiedades-gestion', {
      ttl: CACHE_TTL.list,
      cacheKey: 'strapi:propiedades-gestion:slugs',
      filters: { publicado: { $eq: true } },
      pagination: { pageSize: 100 },
      sort: 'createdAt:desc',
    });
    return (res.data || []).map((p: any) => p.slug);
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────

/**
 * Un medio de estas fichas puede llegar por dos caminos y hay que recorrerlos en orden:
 * el campo `media` del schema (lo que escribió el admin) y el twin string `*_url` de la
 * sincronización vieja. Con `files = 0` en la BD (medido), el twin es hoy el ÚNICO valor
 * alcanzable en varias fichas, así que se sigue leyendo; el retiro de esa columna es el
 * Task 14, no este. Lo que cambia acá es la SALIDA: siempre `MediaItem | null`, nunca el
 * objeto crudo ni el string suelto.
 */
function medioCrudo(...formas: unknown[]): MediaItem | null {
  for (const forma of formas) {
    const item = toMediaItem(forma);
    if (item) return item;
  }
  return null;
}

/** Servicio adicional: `complemento.imagen` es `media`. */
export function normalizarComplemento(raw: any): Complemento {
  return {
    id: raw?.id,
    documentId: raw?.documentId,
    slug: raw?.slug,
    nombre: raw?.nombre,
    descripcion: raw?.descripcion || null,
    categoria: raw?.categoria || 'otro',
    precio: raw?.precio ? Number(raw.precio) : 0,
    moneda: raw?.moneda || 'COP',
    precio_por: raw?.precio_por || 'persona',
    icono: raw?.icono || null,
    imagen: medioCrudo(raw?.imagen),
  };
}

/** Producto local del alojamiento: `producto.imagen` ya es `media` en el schema. */
export function normalizarProductoRecomendado(raw: any): ProductoRecomendado {
  return {
    id: raw?.id,
    documentId: raw?.documentId,
    slug: raw?.slug,
    nombre: raw?.nombre,
    descripcion_corta: raw?.descripcion_corta || null,
    precio: raw?.precio ? Number(raw.precio) : 0,
    presentacion: raw?.presentacion || null,
    categoria: raw?.categoria || 'miel',
    imagen: medioCrudo(raw?.imagen),
    destacado: raw?.destacado || false,
    // Con la columna ausente no hay stock informado: se asume disponible, como antes.
    stock_disponible: raw?.stock_disponible !== false,
  };
}

/** Anfitrión vinculado a la propiedad: `anfitrion.foto_perfil` es `media`. */
function normalizarAnfitrionVinculado(raw: any): NonNullable<PropiedadGestion['anfitriones']>[number] {
  return {
    id: raw?.id,
    slug: raw?.slug,
    nombre: raw?.nombre,
    // Acá estaba el `foto_perfil: a.foto_perfil` crudo que pintaba `[object Object]`.
    foto_perfil: medioCrudo(raw?.foto_perfil),
    nivel_escalafon: raw?.nivel_escalafon,
    especialidad: raw?.especialidad,
  };
}

/**
 * Fila cruda de `experiencias` → tarjeta del listado de Gestión. Exportada y total
 * (cualquier fila decodificable sale con `imagen: MediaItem | null`) por la misma razón
 * que `filasParaPlantilla` en la bitácora.
 */
export function experienciaGestionParaPlantilla(raw: any): ExperienciaGestion {
  const fila = raw && typeof raw === 'object' ? raw : {};
  return {
    id: fila.id,
    documentId: fila.documentId,
    slug: fila.slug,
    titulo: fila.titulo,
    resumen: fila.resumen || null,
    categoria: fila.categoria || 'Naturaleza',
    ubicacion: fila.ubicacion || null,
    duracion: fila.duracion || null,
    cupo_maximo_desc: fila.cupo_maximo_desc || null,
    nivel_dificultad: fila.nivel_dificultad || 1,
    precio_desde: fila.precio_desde ? Number(fila.precio_desde) : null,
    // Tercer término: una fila que ya pasó por el borde trae el `MediaItem` en `imagen`
    // (así se devuelve `experienciaGestionParaPlantilla` sobre su propia salida).
    imagen: medioCrudo(fila.imagen_hero, fila.imagen),
    es_destacado: fila.es_destacado || false,
  };
}

/**
 * Fila cruda de Strapi → ficha para plantilla. Exportada para que `node --test` pueda
 * tocarla: es el único sitio donde se abre la forma de Strapi de esta ficha, y su
 * contrato (`MediaItem`, nunca el objeto crudo) se prueba en
 * `tests/normalizar-medio-3.test.mjs`.
 */
export function normalizePropiedadGestion(raw: any): PropiedadGestion {
  return {
    id: raw.id,
    documentId: raw.documentId,
    titulo: raw.titulo,
    slug: raw.slug,
    descripcion: raw.descripcion || null,
    tipo_gestion: raw.tipo_gestion || 'renta_corta',
    tipo_alojamiento: raw.tipo_alojamiento || 'finca',
    modelo_alianza: raw.modelo_alianza || 'gestion_pura',
    estado: raw.estado || 'activa',
    es_destacado: raw.es_destacado || false,
    publicado: raw.publicado || false,
    precio_noche: raw.precio_noche ? Number(raw.precio_noche) : null,
    precio_mensual: raw.precio_mensual ? Number(raw.precio_mensual) : null,
    moneda: raw.moneda || 'COP',
    ubicacion_municipio: raw.ubicacion_municipio || null,
    ubicacion_latitud: raw.ubicacion_latitud ? Number(raw.ubicacion_latitud) : null,
    ubicacion_longitud: raw.ubicacion_longitud ? Number(raw.ubicacion_longitud) : null,
    area_hectareas: raw.area_hectareas ? Number(raw.area_hectareas) : null,
    numero_habitaciones: raw.numero_habitaciones || null,
    numero_banos: raw.numero_banos || null,
    capacidad_huespedes: raw.capacidad_huespedes || null,
    amenidades: Array.isArray(raw.amenidades) ? raw.amenidades : null,
    highlights: Array.isArray(raw.highlights) ? raw.highlights : null,
    imagen_principal: medioCrudo(raw.imagen_principal),
    // `toMediaList` aplana el array anidado de la relación `multiple`, deduplica el mismo
    // archivo dos veces y se queda con la variante más rica en alt/caption.
    galeria: toMediaList(raw.galeria),
    propiedad_tierras: raw.propiedad_tierras ? { id: raw.propiedad_tierras.id, slug: raw.propiedad_tierras.slug, titulo: raw.propiedad_tierras.titulo, precio: raw.propiedad_tierras.precio ? Number(raw.propiedad_tierras.precio) : undefined, operacion: raw.propiedad_tierras.operacion } : null,
    experiencias: Array.isArray(raw.experiencias) ? raw.experiencias.map((e: any) => ({ id: e.id, slug: e.slug, titulo: e.titulo, categoria: e.categoria, precio_desde: e.precio_desde ? Number(e.precio_desde) : undefined })) : null,
    anfitriones: Array.isArray(raw.anfitriones) ? raw.anfitriones.map(normalizarAnfitrionVinculado) : null,
    proveedores: Array.isArray(raw.proveedores) ? raw.proveedores.map((p: any) => ({ id: p.id, slug: p.slug, nombre: p.nombre, producto: p.producto, ubicacion: p.ubicacion })) : null,
    complementos: Array.isArray(raw.complementos) ? raw.complementos.map(normalizarComplemento) : null,
    productos: Array.isArray(raw.productos) ? raw.productos.map(normalizarProductoRecomendado) : null,
    seo_titulo: raw.seo_titulo || null,
    seo_descripcion: raw.seo_descripcion || null,
  };
}

/**
 * Portada de la propiedad como `MediaItem`: la foto principal y, solo si no la hay, la
 * primera pieza de la galería. `null` = sin evidencia → la tarjeta cae al mosaico `Icon`.
 * Antes devolvía `string`, y por eso el `alternativeText` del admin no podía bajar al `alt`.
 */
export function propiedadGestionImagen(prop: PropiedadGestion): MediaItem | null {
  return medioCrudo(prop?.imagen_principal) ?? toMediaList(prop?.galeria)[0] ?? null;
}

/** Format price display based on type */
export function formatPrecioGestion(prop: PropiedadGestion): string {
  const { precio_noche, precio_mensual, moneda, tipo_gestion } = prop;

  if (tipo_gestion === 'renta_corta' || tipo_gestion === 'operacion_turistica') {
    if (precio_noche) return `$${formatNumber(precio_noche)} / noche`;
  }
  if (precio_mensual) return `$${formatNumber(precio_mensual)} / mes`;
  if (precio_noche) return `$${formatNumber(precio_noche)} / noche`;
  return 'Consultar';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString('es-CO');
}

/** Get tipo_gestion metadata */
export function tipoGestionInfo(tipo: string) {
  return TIPOS_GESTION.find((t) => t.slug === tipo) || TIPOS_GESTION[0];
}

/** Get modelo_alianza metadata */
export function modeloAlianzaInfo(modelo: string) {
  return MODELOS_ALIANZA.find((m) => m.slug === modelo) || MODELOS_ALIANZA[0];
}

/** Get tipo_alojamiento metadata */
export function tipoAlojamientoInfo(tipo: string) {
  return TIPOS_ALOJAMIENTO.find((t) => t.slug === tipo) || TIPOS_ALOJAMIENTO[0];
}

/**
 * Fetch bookable accommodations for guests (active + with nightly price).
 * Si se proveen checkin/checkout, filtra contra la disponibilidad real en
 * app_reservas (modelo abierto-salvo-bloqueo). Si el servicio de reservas
 * no responde, degrada al listado completo sin filtro de fechas.
 */
export async function getAlojamientosDisponibles(filters: GestionFilters = {}): Promise<{
  data: PropiedadGestion[];
  total: number;
  page: number;
  pageSize: number;
}> {
  let slugs: string[] | undefined;

  if (filters.checkin && filters.checkout) {
    try {
      const params = new URLSearchParams({
        origen: 'iwage_gestion',
        desde: filters.checkin,
        hasta: filters.checkout,
      });
      if (filters.huespedes) params.set('capacidad_min', String(filters.huespedes));

      const res = await fetch(`${RESERVAS_API}/api/recursos/disponibles?${params}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        slugs = (json.data || []).map((r: any) => r.slug as string);
        if (slugs.length === 0) {
          return { data: [], total: 0, page: 1, pageSize: filters.pageSize || 24 };
        }
      }
    } catch {
      // Degradación graceful: mostrar listado sin filtro de fechas
    }
  }

  return getPropiedadesGestion({
    ...filters,
    slugs,
    estado: 'activa',
    sort: 'es_destacado:desc',
  });
}

/**
 * Experiencias publicadas para el listado de Gestión (cross-sell de alojamientos),
 * con datos clave para tarjetas y filtro opcional por categoría.
 */
export async function getExperienciasGestion(categoria?: string): Promise<ExperienciaGestion[]> {
  const strapiFilters: Record<string, any> = { publicado: { $eq: true } };
  if (categoria) strapiFilters.categoria = { $eq: categoria };

  try {
    const res = await strapiFetch<any>('experiencias', {
      ttl: CACHE_TTL.list,
      cacheKey: `strapi:experiencias-gestion:${categoria || 'todas'}`,
      populate: ['imagen_hero'],
      filters: strapiFilters,
      sort: 'es_destacado:desc',
      pagination: { pageSize: 50 },
    });

    return (res.data || []).map(experienciaGestionParaPlantilla);
  } catch {
    return [];
  }
}
