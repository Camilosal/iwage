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
  requirements: Array<string | { title?: string; desc?: string; iconName?: string }> | null;
  includes: string[] | null;
  excludes: string[] | null;
  optional_addons: Array<{ nombre?: string; precio?: number; title?: string; desc?: string; price?: string }> | null;
  complementos: Complemento[] | null;
  faqs: Array<{ pregunta?: string; respuesta?: string; question?: string; answer?: string }> | null;
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
  tipo_alojamiento: string | null;
  estado: string | null;
  publicado: boolean;
  precio_noche: number | null;
  precio_mensual: number | null;
  capacidad_huespedes: number | null;
  numero_habitaciones: number | null;
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
  url_reservas?: string;
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
  1: { nombre: 'Semilla', icono: 'sprout', color: '#8BC34A', descripcion: 'Anfitrión nuevo en la plataforma.' },
  2: { nombre: 'Brote', icono: 'leaf', color: '#4CAF50', descripcion: 'Experiencia comprobada y primeras reseñas positivas.' },
  3: { nombre: 'Raíz', icono: 'trees', color: '#2E7D32', descripcion: 'Impacto ambiental demostrado y comunidad fiel.' },
  4: { nombre: 'Guardián', icono: 'shield', color: '#1B5E20', descripcion: 'Referente territorial con liderazgo en conservación.' },
  5: { nombre: 'Sabio Ancestral', icono: 'mountain', color: '#FFD700', descripcion: 'Máximo reconocimiento. Legado ancestral y transformador.' },
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
const POPULATE_EXP = ['imagen_hero', 'galeria', 'anfitriones', 'proveedores', 'propiedades', 'propiedades_gestion', 'complementos'];
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

// ── Fallback data (Strapi unavailable) ─────────────────

const FALLBACK_COMPLEMENTOS_EXP: Complemento[] = [
  { id: 1, documentId: 'fb-c1', slug: 'cena-campesina-tolimense', nombre: 'Cena campesina tolimense', descripcion: 'Cena tradicional con ingredientes de la finca: tamal tolimense, chocolate de mesa y postre de brevas.', categoria: 'comida', precio: 45000, moneda: 'COP', precio_por: 'persona', icono: 'utensils-crossed', imagen_url: null },
  { id: 2, documentId: 'fb-c2', slug: 'almuerzo-tipico-tolima', nombre: 'Almuerzo típico del Tolima', descripcion: 'Lechona tolimense con papa criolla, ají de maní y jugo natural.', categoria: 'comida', precio: 35000, moneda: 'COP', precio_por: 'persona', icono: 'cooking-pot', imagen_url: null },
  { id: 3, documentId: 'fb-c3', slug: 'fogata-con-cuenteria', nombre: 'Fogata con cuentería', descripcion: 'Noche de fogata con historias del territorio y mitos del Tolima. Incluye chocolate caliente.', categoria: 'espectaculo', precio: 60000, moneda: 'COP', precio_por: 'grupo', icono: 'flame', imagen_url: null },
  { id: 4, documentId: 'fb-c5', slug: 'cafe-origen-llevar', nombre: 'Café de origen para llevar', descripcion: 'Bolsa de 250g de café Ambalá, tostado medio.', categoria: 'compra_local', precio: 30000, moneda: 'COP', precio_por: 'unidad', icono: 'coffee', imagen_url: null },
  { id: 5, documentId: 'fb-c6', slug: 'transporte-desde-ibague', nombre: 'Transporte desde Ibagué', descripcion: 'Recogida y traslado ida y vuelta en camioneta 4x4.', categoria: 'transporte', precio: 120000, moneda: 'COP', precio_por: 'grupo', icono: 'car', imagen_url: null },
  { id: 6, documentId: 'fb-c8', slug: 'senderismo-guiado', nombre: 'Senderismo guiado extra', descripcion: 'Caminata adicional de 2 horas por sendero de cascadas ocultas.', categoria: 'actividad', precio: 40000, moneda: 'COP', precio_por: 'persona', icono: 'footprints', imagen_url: null },
];

const FALLBACK_EXPERIENCIAS: Experiencia[] = [
  {
    id: 1, documentId: 'fb-e1', slug: 'ruta-del-cafe-ambala', titulo: 'Ruta del Café Ambalá',
    resumen: 'Recorrido sensorial por el cafetal de la familia Cardona: siembra, recolección, beneficio y catación de café de origen a 1,400 m.s.n.m.',
    categoria: 'Gastronomia', ubicacion: 'Ambalá, Ibagué', ubicacion_latitud: 4.45, ubicacion_longitud: -75.25,
    ciudad_referencia: 'Ibagué Centro', distancia_km: '18', tiempo_desde_ciudad: '35 min',
    estado_via: 'pavimentada', ofrece_transporte: false, duracion: '4 - 5 Horas',
    nivel_dificultad: 2, tipo_propiedad: 'local-partner', precio_desde: 85000,
    cupo_maximo_desc: '8 personas', porcentaje_fondo_impacto: 2, descripcion_fondo_impacto: null,
    es_destacado: true, publicado: true,
    imagen_hero: null, imagen_hero_url: null, galeria: null, galeria_urls: null,
    video_url: null, tour_360_url: null, link_drone: null, mapa_imagen_url: null,
    highlights: ['Catación de café de especialidad', 'Recorrido por cafetal en producción', 'Almuerzo campesino incluido', 'Vista al valle del Magdalena'],
    requirements: ['Ropa cómoda', 'Botas o tenis con agarre', 'Sombrero o gorra', 'Protector solar'],
    includes: ['Guía local certificado', 'Almuerzo campesino', 'Catación de 3 cafés', 'Seguro de asistencia'],
    excludes: ['Transporte desde Ibagué', 'Gastos personales'],
    optional_addons: [{ nombre: 'Transporte desde Ibagué', precio: 120000 }],
    complementos: FALLBACK_COMPLEMENTOS_EXP,
    faqs: [{ pregunta: '¿Necesito experiencia previa?', respuesta: 'No, la ruta es apta para todos los niveles.' }],
    safety_content: null, etiquetas_personalizadas: null,
    itinerario_sensorial: [
      { time: '8:00 AM', title: 'Bienvenida con café', sense: 'Gusto', desc: 'Taza de bienvenida en la casa de la familia Cardona.' },
      { time: '9:00 AM', title: 'Recorrido por el cafetal', sense: 'Tacto', desc: 'Recolección manual de granos maduros.' },
      { time: '11:00 AM', title: 'Beneficio y secado', sense: 'Olfato', desc: 'Proceso de fermentación y secado al sol.' },
      { time: '12:30 PM', title: 'Catación y almuerzo', sense: 'Gusto', desc: 'Cata de 3 perfiles y almuerzo campesino.' },
    ],
    anfitriones_data: null, iniciativas_impacto: null, paquetes_upsell: null,
    anfitriones: null, proveedores: null, propiedades: null, propiedades_gestion: null,
    seo_titulo: null, seo_descripcion: null,
  },
];

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
    // Fallback: return matching experience from local data
    return FALLBACK_EXPERIENCIAS.find((e) => e.slug === slug) || null;
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

// ── Iniciativas de Impacto (página Impacto · gestionables en Strapi) ──
export interface Iniciativa {
  id: number;
  documentId: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  estado: string | null;
  metrica: string | null;
  progreso: number | null;
  orden: number | null;
  activo: boolean;
}

export async function getIniciativas(): Promise<Iniciativa[]> {
  try {
    const res = await strapiFetch<Iniciativa>('iniciativas', {
      ttl: CACHE_TTL.list,
      filters: { activo: { $eq: true } },
      sort: 'orden:asc',
      pagination: { pageSize: 50 },
    });
    return res.data || [];
  } catch {
    return [];
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
