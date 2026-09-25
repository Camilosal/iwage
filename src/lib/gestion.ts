/**
 * Iwagé Gestión — Strapi data access layer
 * Handles managed properties with cross-brand relations.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc } from './media';

/** API interna de app_reservas (server-side) para filtros de disponibilidad */
const RESERVAS_API = import.meta.env.RESERVAS_API_URL || 'http://reservas_app:4326';

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
  imagen_url: string | null;
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
  imagen: string | null;
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
  imagen: string | null;
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
  imagen_principal: { url: string; alternativeText?: string } | null;
  galeria: Array<{ url: string; alternativeText?: string }> | null;
  propiedad_tierras: { id: number; slug: string; titulo: string; precio?: number; operacion?: string } | null;
  experiencias: Array<{ id: number; slug: string; titulo: string; categoria?: string; precio_desde?: number }> | null;
  anfitriones: Array<{ id: number; slug: string; nombre: string; foto_perfil?: any; foto_perfil_url?: string; nivel_escalafon?: number; especialidad?: string }> | null;
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

function normalizePropiedadGestion(raw: any): PropiedadGestion {
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
    imagen_principal: raw.imagen_principal ? { url: raw.imagen_principal.url, alternativeText: raw.imagen_principal.alternativeText } : null,
    galeria: Array.isArray(raw.galeria) ? raw.galeria.map((img: any) => ({ url: img.url, alternativeText: img.alternativeText })) : null,
    propiedad_tierras: raw.propiedad_tierras ? { id: raw.propiedad_tierras.id, slug: raw.propiedad_tierras.slug, titulo: raw.propiedad_tierras.titulo, precio: raw.propiedad_tierras.precio ? Number(raw.propiedad_tierras.precio) : undefined, operacion: raw.propiedad_tierras.operacion } : null,
    experiencias: Array.isArray(raw.experiencias) ? raw.experiencias.map((e: any) => ({ id: e.id, slug: e.slug, titulo: e.titulo, categoria: e.categoria, precio_desde: e.precio_desde ? Number(e.precio_desde) : undefined })) : null,
    anfitriones: Array.isArray(raw.anfitriones) ? raw.anfitriones.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      nombre: a.nombre,
      foto_perfil: a.foto_perfil,
      foto_perfil_url: a.foto_perfil_url,
      nivel_escalafon: a.nivel_escalafon,
      especialidad: a.especialidad,
    })) : null,
    proveedores: Array.isArray(raw.proveedores) ? raw.proveedores.map((p: any) => ({ id: p.id, slug: p.slug, nombre: p.nombre, producto: p.producto, ubicacion: p.ubicacion })) : null,
    complementos: Array.isArray(raw.complementos) ? raw.complementos.map((c: any) => ({
      id: c.id,
      documentId: c.documentId,
      slug: c.slug,
      nombre: c.nombre,
      descripcion: c.descripcion || null,
      categoria: c.categoria || 'otro',
      precio: c.precio ? Number(c.precio) : 0,
      moneda: c.moneda || 'COP',
      precio_por: c.precio_por || 'persona',
      icono: c.icono || null,
      imagen_url: mediaSrc(c.imagen?.url ?? c.imagen_url),
    })) : null,
    productos: Array.isArray(raw.productos) ? raw.productos.map((p: any) => ({
      id: p.id,
      documentId: p.documentId,
      slug: p.slug,
      nombre: p.nombre,
      descripcion_corta: p.descripcion_corta || null,
      precio: p.precio ? Number(p.precio) : 0,
      presentacion: p.presentacion || null,
      categoria: p.categoria || 'miel',
      imagen: mediaSrc(p.imagen),
      destacado: p.destacado || false,
      stock_disponible: p.stock_disponible !== false,
    })) : null,
    seo_titulo: raw.seo_titulo || null,
    seo_descripcion: raw.seo_descripcion || null,
  };
}

/** Get image URL for a managed property */
export function propiedadGestionImagen(prop: PropiedadGestion): string | null {
  if (prop.imagen_principal?.url) return mediaSrc(prop.imagen_principal.url);
  if (prop.galeria && prop.galeria.length > 0) return mediaSrc(prop.galeria[0].url);
  return null;
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

    return (res.data || []).map((e: any) => ({
      id: e.id,
      documentId: e.documentId,
      slug: e.slug,
      titulo: e.titulo,
      resumen: e.resumen || null,
      categoria: e.categoria || 'Naturaleza',
      ubicacion: e.ubicacion || null,
      duracion: e.duracion || null,
      cupo_maximo_desc: e.cupo_maximo_desc || null,
      nivel_dificultad: e.nivel_dificultad || 1,
      precio_desde: e.precio_desde ? Number(e.precio_desde) : null,
      imagen: mediaSrc(e.imagen_hero?.url ?? e.imagen_hero_url),
      es_destacado: e.es_destacado || false,
    }));
  } catch {
    return [];
  }
}
