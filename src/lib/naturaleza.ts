/**
 * Iwagé Naturaleza — Strapi data access layer
 * Handles experiences, hosts, packages, and filters.
 */
import { strapiFetch, strapiImage, CACHE_TTL } from './strapi';

// ── Types ──────────────────────────────────────────────

export interface Experiencia {
  id: number;
  documentId: string;
  slug: string;
  titulo: string;
  resumen: string | null;
  categoria: 'Naturaleza' | 'Cultura' | 'Bienestar' | 'Aventura' | 'Gastronomia';
  ubicacion: string | null;
  ubicacion_latitud: number | null;
  ubicacion_longitud: number | null;
  ciudad_referencia: string | null;
  distancia_km: string | null;
  tiempo_desde_ciudad: string | null;
  estado_via: string | null;
  ofrece_transporte: boolean;
  duracion: string | null;
  nivel_dificultad: number;
  tipo_propiedad: 'iwage-managed' | 'local-partner' | 'comunitario' | null;
  precio_desde: number | null;
  cupo_maximo_desc: string | null;
  porcentaje_fondo_impacto: number | null;
  descripcion_fondo_impacto: string | null;
  es_destacado: boolean;
  publicado: boolean;
  imagen_hero: { url: string; alternativeText?: string } | null;
  imagen_hero_url: string | null;
  galeria: Array<{ url: string; alternativeText?: string }> | null;
  galeria_urls: Array<{ url: string; tipo?: string; titulo?: string }> | null;
  video_url: string | null;
  tour_360_url: string | null;
  link_drone: string | null;
  mapa_imagen_url: string | null;
  highlights: string[] | null;
  requirements: string[] | null;
  includes: string[] | null;
  excludes: string[] | null;
  optional_addons: Array<{ nombre: string; precio?: number }> | null;
  faqs: Array<{ pregunta: string; respuesta: string }> | null;
  safety_content: SafetyContent | null;
  etiquetas_personalizadas: Record<string, string> | null;
  itinerario_sensorial: ItinerarioItem[] | null;
  anfitriones_data: AnfitrionJunction[] | null;
  iniciativas_impacto: IniciativaImpacto[] | null;
  paquetes_upsell: PaqueteUpsell[] | null;
  anfitriones: Anfitrion[] | null;
  proveedores: ProveedorVinculado[] | null;
  propiedades: PropiedadVinculada[] | null;
  propiedades_gestion: PropiedadGestionVinculada[] | null;
  seo_titulo: string | null;
  seo_descripcion: string | null;
}

/** Lightweight cross-brand relation types */
export interface ProveedorVinculado {
  id: number;
  documentId: string;
  slug: string;
  nombre: string;
  producto: string | null;
  ubicacion: string | null;
  foto: { url: string } | null;
}

export interface PropiedadVinculada {
  id: number;
  documentId: string;
  slug: string;
  titulo: string;
  tipo_propiedad: string | null;
  operacion: string | null;
  precio: number | null;
  estado: string | null;
  ubicacion_municipio: string | null;
  imagen_principal: { url: string } | null;
}

export interface PropiedadGestionVinculada {
  id: number;
  documentId: string;
  slug: string;
  titulo: string;
  tipo_gestion: string | null;
  estado: string | null;
  ubicacion_municipio: string | null;
  imagen_principal: { url: string } | null;
}

export interface SafetyContent {
  title?: string;
  description?: string;
  features?: string[];
}

export interface ItinerarioItem {
  time?: string;
  title?: string;
  sense?: string;
  desc?: string;
  iconName?: string;
}

export interface AnfitrionJunction {
  anfitrion_id?: string;
  nombre?: string;
  precio_personalizado?: number;
  superpoder_en_esta_ruta?: string;
  toque_unico?: string;
  url_qloapps?: string;
  lema_seccion?: string;
  manifiesto_ruta?: string;
  momento_favorito_ruta?: string;
  destacados_unicos?: string[];
  recomendaciones_especificas?: string[];
  enfoque_de_ruta?: string;
}

export interface IniciativaImpacto {
  icono?: string;
  titulo?: string;
  descripcion?: string;
  estado?: string;
  metrica?: string;
}

export interface PaqueteUpsell {
  title?: string;
  tagline?: string;
  duration?: string;
  price?: number;
  includes?: string[];
}

export interface Anfitrion {
  id: number;
  documentId: string;
  slug: string;
  nombre: string;
  especialidad: string | null;
  foto_perfil: { url: string; alternativeText?: string } | null;
  foto_perfil_url: string | null;
  video_thumbnail: string | null;
  video_url: string | null;
  manifiesto: string | null;
  momento_favorito: string | null;
  arraigo: string | null;
  historia_personal: string | null;
  anos_en_territorio: number | null;
  generaciones_familia: number | null;
  foto_territorio: string | null;
  galeria_fotos: Array<{ url: string; caption?: string; tipo?: string }> | null;
  nivel_escalafon: number;
  nombre_escalafon: string | null;
  descripcion_escalafon: string | null;
  calificacion_promedio: number;
  numero_resenas: number;
  impacto_hectareas: number | null;
  impacto_hectareas_desc: string | null;
  impacto_familias: number | null;
  impacto_familias_desc: string | null;
  impacto_mensaje: string | null;
  fondo_impacto_titulo: string | null;
  fondo_impacto_descripcion: string | null;
  sueno_narrativa: string | null;
  insignia_titulo: string | null;
  insignia_narrativa: string | null;
  pacto_subtitulo: string | null;
  pacto_items: Array<{ titulo?: string; descripcion?: string; icono_name?: string }> | null;
  certificaciones_seguridad: string[] | null;
  faqs: Array<{ pregunta: string; respuesta: string }> | null;
  resenas: Resena[] | null;
  publicado: boolean;
  experiencias: Experiencia[] | null;
  seo_titulo: string | null;
  seo_descripcion: string | null;
}

export interface Resena {
  author?: string;
  profile?: string;
  rating?: number;
  text?: string;
  date?: string;
}

export interface Paquete {
  id: number;
  documentId: string;
  slug: string;
  titulo: string;
  tagline: string | null;
  descripcion: string | null;
  categoria: string | null;
  duracion_dias: number;
  duracion_texto: string | null;
  precio_base: number | null;
  precio_por_persona: boolean;
  ubicacion: string | null;
  dificultad: number | null;
  incluye: string[] | null;
  no_incluye: string[] | null;
  imagen_hero: { url: string; alternativeText?: string } | null;
  imagenes: Array<{ url: string; alternativeText?: string }> | null;
  activo: boolean;
  destacado: boolean;
  experiencias_data: Array<{ slug?: string; titulo?: string }> | null;
  anfitriones_data: Array<{ id?: string; nombre?: string; rol?: string }> | null;
  seo_titulo: string | null;
  seo_descripcion: string | null;
}

// ── Constants ──────────────────────────────────────────

export const CATEGORIAS = ['Naturaleza', 'Cultura', 'Bienestar', 'Aventura', 'Gastronomía'] as const;

export const DIFICULTAD_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: 'Rarezas del Viento', desc: 'Caminata pasiva de contemplación absoluta.' },
  2: { label: 'Ritmo de la Tierra', desc: 'Senderismo suave por terrenos estables.' },
  3: { label: 'Senda del Agua', desc: 'Requiere equilibrio y paso firme junto al río.' },
  4: { label: 'Pasos de Montaña', desc: 'Ascensos moderados que exigen aliento constante.' },
  5: { label: 'Vuelo del Águila', desc: 'Reto físico en pendientes pronunciadas.' },
  6: { label: 'Cúspide de la Roca', desc: 'Zonas de alta montaña y clima variable.' },
  7: { label: 'Caminante del Cielo', desc: 'Expedición técnica de alto rendimiento.' },
};

export const NIVELES_ESCALAFON: Record<number, { nombre: string; icono: string; color: string; descripcion: string }> = {
  1: { nombre: 'Semilla', icono: '🌱', color: '#8BC34A', descripcion: 'Anfitrión nuevo en la plataforma.' },
  2: { nombre: 'Brote', icono: '🌿', color: '#4CAF50', descripcion: 'Experiencia comprobada y primeras reseñas positivas.' },
  3: { nombre: 'Raíz', icono: '🌳', color: '#2E7D32', descripcion: 'Impacto ambiental demostrado y comunidad fiel.' },
  4: { nombre: 'Guardián', icono: '🛡️', color: '#1B5E20', descripcion: 'Referente territorial con liderazgo en conservación.' },
  5: { nombre: 'Sabio Ancestral', icono: '🏔️', color: '#FFD700', descripcion: 'Máximo reconocimiento. Legado ancestral y transformador.' },
};

export const TIPOS_EXPERIENCIA = [
  { value: 'iwage-managed', label: 'Iwagé Gestionada' },
  { value: 'local-partner', label: 'Partner Local' },
  { value: 'comunitario', label: 'Comunitario' },
] as const;

// ── Filters ────────────────────────────────────────────

export interface ExperienciaFilters {
  categoria?: string;
  dificultad?: number;
  tipo?: string;
  ubicacion?: string;
  precioMax?: number;
  search?: string;
  destacado?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
}

// ── Data Fetchers ──────────────────────────────────────

// Relaciones cross-brand del modelo "Ecosistema Iwagé" (todas existen en el schema de
// Strapi: experiencia ↔ propiedad / propiedad-gestion / proveedor / anfitrion).
const POPULATE_EXP = ['imagen_hero', 'galeria', 'anfitriones', 'proveedores', 'propiedades', 'propiedades_gestion'];
const POPULATE_HOST = ['foto_perfil'];
const POPULATE_HOST_DETAIL = ['foto_perfil', 'experiencias'];
const POPULATE_PKG = ['imagen_hero', 'imagenes'];

export async function getExperiencias(filters: ExperienciaFilters = {}): Promise<{
  data: Experiencia[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { categoria, dificultad, tipo, ubicacion, precioMax, search, destacado, page = 1, pageSize = 12, sort } = filters;

  const strapiFilters: Record<string, any> = { publicado: { $eq: true } };
  if (categoria) strapiFilters.categoria = { $eq: categoria };
  if (dificultad) strapiFilters.nivel_dificultad = { $eq: dificultad };
  if (tipo) strapiFilters.tipo_propiedad = { $eq: tipo };
  if (ubicacion) strapiFilters.ubicacion = { $containsi: ubicacion };
  if (precioMax) strapiFilters.precio_desde = { $lte: precioMax };
  if (search) strapiFilters.$or = [
    { titulo: { $containsi: search } },
    { resumen: { $containsi: search } },
  ];
  if (destacado) strapiFilters.es_destacado = { $eq: true };

  const sortParam = sort === 'precio_asc' ? 'precio_desde:asc'
    : sort === 'precio_desc' ? 'precio_desde:desc'
    : sort === 'dificultad' ? 'nivel_dificultad:desc'
    : sort === 'nombre' ? 'titulo:asc'
    : 'createdAt:desc';

  try {
    const res = await strapiFetch<Experiencia>('experiencias', {
      ttl: CACHE_TTL.search,
      populate: POPULATE_EXP,
      filters: strapiFilters,
      sort: sortParam,
      pagination: { page, pageSize },
      cacheKey: `strapi:experiencias:${JSON.stringify({ ...filters })}`,
    });
    return {
      data: res.data || [],
      total: res.meta?.pagination?.total || 0,
      page: res.meta?.pagination?.page || page,
      pageSize: res.meta?.pagination?.pageSize || pageSize,
    };
  } catch {
    return { data: [], total: 0, page, pageSize };
  }
}

export async function getExperienciaBySlug(slug: string): Promise<Experiencia | null> {
  try {
    const res = await strapiFetch<Experiencia>('experiencias', {
      ttl: CACHE_TTL.single,
      populate: POPULATE_EXP,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
      cacheKey: `strapi:experiencia:${slug}`,
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getExperienciasDestacadas(limit = 3): Promise<Experiencia[]> {
  const { data } = await getExperiencias({ destacado: true, pageSize: limit });
  return data;
}

export async function getAnfitriones(page = 1, pageSize = 20): Promise<{
  data: Anfitrion[];
  total: number;
}> {
  try {
    const res = await strapiFetch<Anfitrion>('anfitriones', {
      ttl: CACHE_TTL.list,
      populate: POPULATE_HOST,
      filters: { publicado: { $eq: true } },
      sort: 'nivel_escalafon:desc',
      pagination: { page, pageSize },
    });
    return { data: res.data || [], total: res.meta?.pagination?.total || 0 };
  } catch {
    return { data: [], total: 0 };
  }
}

export async function getAnfitrionBySlug(slug: string): Promise<Anfitrion | null> {
  try {
    const res = await strapiFetch<Anfitrion>('anfitriones', {
      ttl: CACHE_TTL.single,
      populate: POPULATE_HOST_DETAIL,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
      cacheKey: `strapi:anfitrion:${slug}`,
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getPaquetes(destacadoOnly = false): Promise<Paquete[]> {
  try {
    const filters: Record<string, any> = { activo: { $eq: true } };
    if (destacadoOnly) filters.destacado = { $eq: true };
    const res = await strapiFetch<Paquete>('paquetes', {
      ttl: CACHE_TTL.list,
      populate: POPULATE_PKG,
      filters,
      sort: 'destacado:desc',
      pagination: { pageSize: 50 },
    });
    return res.data || [];
  } catch {
    return [];
  }
}

export async function getPaqueteBySlug(slug: string): Promise<Paquete | null> {
  try {
    const res = await strapiFetch<Paquete>('paquetes', {
      ttl: CACHE_TTL.single,
      populate: POPULATE_PKG,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
      cacheKey: `strapi:paquete:${slug}`,
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────

export function experienciaImagen(exp: Experiencia): string {
  // Priority: imagen_hero_url (direct URL from sync) > imagen_hero (Strapi media) > galeria_urls > galeria > fallback
  if (exp.imagen_hero_url) return exp.imagen_hero_url;
  if (exp.imagen_hero?.url) return strapiImage(exp.imagen_hero.url) || '';
  if (exp.galeria_urls?.[0]?.url) return exp.galeria_urls[0].url;
  if (exp.galeria?.[0]?.url) return strapiImage(exp.galeria[0].url) || '';
  return 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=70';
}

/** Get all gallery image URLs (merging galeria_urls and Strapi media galeria) */
export function experienciaGaleria(exp: Experiencia): Array<{ url: string; tipo?: string; titulo?: string }> {
  const items: Array<{ url: string; tipo?: string; titulo?: string }> = [];
  if (exp.galeria_urls && exp.galeria_urls.length > 0) {
    items.push(...exp.galeria_urls);
  } else if (exp.galeria && exp.galeria.length > 0) {
    items.push(...exp.galeria.map((g) => ({ url: strapiImage(g.url) || '', titulo: g.alternativeText || undefined })));
  }
  return items.filter((i) => i.url);
}

export function anfitrionFoto(host: Anfitrion): string {
  if (host.foto_perfil_url) return host.foto_perfil_url;
  if (host.foto_perfil?.url) return strapiImage(host.foto_perfil.url) || '';
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=70';
}

export function formatPrecioCOP(value: number | null | undefined): string {
  if (!value) return 'Consultar';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function dificultadInfo(nivel: number): { label: string; desc: string } {
  return DIFICULTAD_LABELS[nivel] || DIFICULTAD_LABELS[1];
}

export function nivelInfo(nivel: number): { nombre: string; icono: string; color: string; descripcion: string } {
  return NIVELES_ESCALAFON[nivel] || NIVELES_ESCALAFON[1];
}
