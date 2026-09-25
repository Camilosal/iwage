/**
 * Iwagé Naturaleza — Strapi data access layer
 * Handles experiences, hosts, packages, and filters.
 */
import { strapiFetch, CACHE_TTL } from './strapi.ts';
import { toMediaItem, toMediaList, type MediaItem } from './media.ts';

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
  /**
   * Portada. `experiencia.imagen_hero` es `media` en el schema; el twin string que dejó la
   * sincronización (`imagen_hero_url`, Grupo C) se sigue leyendo DENTRO de
   * `experienciaParaPlantilla` porque con `files = 0` en la BD es el único valor alcanzable
   * hoy. No se entrega por separado: sale un `MediaItem` o `null`. Retiro = Task 14.
   */
  imagen_hero: MediaItem | null;
  /** Galería: la relación `media` y la columna json `galeria_urls` fusionadas y deduplicadas. */
  galeria: MediaItem[];
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
  foto: MediaItem | null;
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
  imagen_principal: MediaItem | null;
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
  imagen_principal: MediaItem | null;
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
  /** `complemento.imagen` es `media`; el twin `imagen_url` se lee dentro del normalizador. */
  imagen: MediaItem | null;
}

export interface Anfitrion {
  id: number;
  documentId: string;
  slug: string;
  nombre: string;
  especialidad: string | null;
  /** Foto del anfitrión: media de Strapi con el twin `foto_perfil_url` de respaldo. */
  foto_perfil: MediaItem | null;
  video_thumbnail: string | null;
  video_url: string | null;
  manifiesto: string | null;
  momento_favorito: string | null;
  arraigo: string | null;
  historia_personal: string | null;
  anos_en_territorio: number | null;
  generaciones_familia: number | null;
  foto_territorio: string | null;
  /**
   * La galería del anfitrión. `anfitrion.galeria_fotos` era una columna json que el schema
   * YA no declara (la reemplazó `galeria`, tipo `media` multiple); el valor viejo quedó
   * huérfano en la BD y Strapi no lo devuelve, así que el bloque que lo pintaba no
   * renderizaba nada. Acá se entrega la relación real del schema. Su gemela en `files`
   * todavía está en cero: la galería se llena cuando el importador vincule los archivos.
   */
  galeria: MediaItem[];
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
  imagen_hero: MediaItem | null;
  imagenes: MediaItem[];
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
// `galeria` es la relación `media` que reemplazó a la columna json vieja del anfitrión
// (ver `Anfitrion.galeria`): sin poblarla, la galería de la ficha sale siempre vacía.
const POPULATE_HOST = ['foto_perfil', 'galeria'];
const POPULATE_HOST_DETAIL = ['foto_perfil', 'galeria', 'experiencias'];
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
      data: (res.data || []).map(experienciaParaPlantilla),
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
    return res.data?.[0] ? experienciaParaPlantilla(res.data[0]) : null;
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
    return { data: (res.data || []).map(anfitrionParaPlantilla), total: res.meta?.pagination?.total || 0 };
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
    return res.data?.[0] ? anfitrionParaPlantilla(res.data[0]) : null;
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
    return (res.data || []).map(paqueteParaPlantilla);
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
    return res.data?.[0] ? paqueteParaPlantilla(res.data[0]) : null;
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

/**
 * ── El borde Strapi → plantilla ────────────────────────────────────────────────
 *
 * Antes de esto, `getExperiencias`/`getAnfitriones`/`getPaquetes` devolvían la fila de
 * Strapi TAL CUAL, con la interfaz declarando por encima `{ url; alternativeText? }`: un
 * tipo que mentía (defecto 3 del brief) y un `alternativeText` del admin que nunca llegaba
 * al `alt` (defecto 1). Las tres firmas de un medio —objeto de Strapi, string de la BD
 * vieja o twin `*_url`, y `MediaItem` de una fila que ya pasó por dos bordes— convergen
 * acá y salen en el contrato de `./media.ts`.
 *
 * Es el mismo diseño de `filasParaPlantilla` (bitácora, `26393d2`): no muta la entrada
 * (`strapiFetch` reparte el MISMO objeto desde Redis vía `inflightFetches`), es total
 * (cualquier fila decodificable sale con `MediaItem | null`, sin lanzar) y no inventa: si
 * no hay pieza, `null`, y la tarjeta cae al mosaico `Icon`.
 */

type Registro = Record<string, any>;

const esObjeto = (v: unknown): v is Registro => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Un medio de estas fichas puede llegar por el campo `media` del schema o por el twin
 * string que dejó la sincronización. Se prueban en orden —el `media` primero, que es lo
 * que escribió el admin— y sale el primer `MediaItem` útil o `null`. Con `files = 0` en la
 * BD (medido con SELECT), el twin es hoy el único valor alcanzable; retirar la columna es
 * Task 14, retirar su lectura de acá también.
 */
function medioCrudo(...formas: unknown[]): MediaItem | null {
  for (const forma of formas) {
    const item = toMediaItem(forma);
    if (item) return item;
  }
  return null;
}

/** Copia sin las columnas gemelas que el borde ya no entrega (el valor vive en el MediaItem). */
function sinClaves(fila: Registro, ...claves: string[]): Registro {
  const copia: Registro = { ...fila };
  for (const clave of claves) delete copia[clave];
  return copia;
}

/**
 * Galería: la relación `media` y la columna json sincronizada se funden en una sola lista.
 * `toMediaList` aplana el array anidado, deduplica por host+ruta y deja la variante más
 * rica en `alt`/`caption`, así que el `alternativeText` de la media le gana al `titulo`
 * histórico del json. Medido sobre las 12 entradas con datos hoy: cero fusiones, o sea la
 * fusión no esconde ninguna pieza real (ver el reporte de la rebanada).
 */
function galeriaFusionada(media: unknown, json: unknown): MediaItem[] {
  return toMediaList([].concat(media ?? [], json ?? []));
}

/** Servicio adicional vinculado a experiencias y alojamientos. */
export function normalizarComplemento(raw: unknown): Complemento {
  const fila = esObjeto(raw) ? raw : {};
  return {
    ...fila,
    descripcion: fila.descripcion ?? null,
    precio: fila.precio ? Number(fila.precio) : 0,
    moneda: fila.moneda || 'COP',
    icono: fila.icono ?? null,
    imagen: medioCrudo(fila.imagen, fila.imagen_url),
  };
}

export function proveedorParaPlantilla(raw: unknown): ProveedorVinculado {
  const fila = esObjeto(raw) ? raw : {};
  return { ...fila, foto: medioCrudo(fila.foto) } as ProveedorVinculado;
}

export function propiedadVinculadaParaPlantilla(raw: unknown): PropiedadVinculada {
  const fila = esObjeto(raw) ? raw : {};
  return { ...fila, imagen_principal: medioCrudo(fila.imagen_principal) } as PropiedadVinculada;
}

export function propiedadGestionVinculadaParaPlantilla(raw: unknown): PropiedadGestionVinculada {
  const fila = esObjeto(raw) ? raw : {};
  return { ...fila, imagen_principal: medioCrudo(fila.imagen_principal) } as PropiedadGestionVinculada;
}

/**
 * Experiencia → ficha de plantilla. `nivel` corta la recursión de las relaciones
 * cruzadas (experiencia → anfitrión → experiencia): Strapi solo pobla un nivel, y aun así
 * el borde no debe seguir cadenas indefinidamente.
 */
function experienciaCruda(raw: unknown, nivel = 0): Experiencia {
  const fila = esObjeto(raw) ? raw : {};
  return {
    ...sinClaves(fila, 'imagen_hero_url', 'galeria_urls'),
    imagen_hero: medioCrudo(fila.imagen_hero, fila.imagen_hero_url),
    galeria: galeriaFusionada(fila.galeria, fila.galeria_urls),
    complementos: Array.isArray(fila.complementos) ? fila.complementos.map(normalizarComplemento) : null,
    proveedores: Array.isArray(fila.proveedores) ? fila.proveedores.map(proveedorParaPlantilla) : null,
    propiedades: Array.isArray(fila.propiedades) ? fila.propiedades.map(propiedadVinculadaParaPlantilla) : null,
    propiedades_gestion: Array.isArray(fila.propiedades_gestion) ? fila.propiedades_gestion.map(propiedadGestionVinculadaParaPlantilla) : null,
    anfitriones: Array.isArray(fila.anfitriones)
      ? fila.anfitriones.map((a: unknown) => anfitrionCrudo(a, nivel + 1))
      : null,
  } as Experiencia;
}

export function experienciaParaPlantilla(raw: unknown): Experiencia {
  return experienciaCruda(raw, 0);
}

/**
 * Anfitrión → ficha de plantilla. Las `experiencias` poblabadas en la ficha de detalle
 * salen por `anfitrionCruda(nivel 0)`, así que sus propias relaciones cruzadas (volver a
 * anfitriones) se dejan vacías: la página solo usa slug y título.
 */
function anfitrionCruda(raw: unknown, nivel = 0): Anfitrion {
  const fila = esObjeto(raw) ? raw : {};
  return {
    ...sinClaves(fila, 'foto_perfil_url', 'galeria_fotos'),
    foto_perfil: medioCrudo(fila.foto_perfil, fila.foto_perfil_url),
    // `galeria_fotos` ya no está en el schema, pero la columna sigue en `anfitriones` con 2
    // JSON huérfanos de Unsplash. Passarla a la fusión no agregaba nada (Strapi no la
    // selecciona) y dejaba la puerta abierta a que resucitara si alguien la re-declara.
    galeria: toMediaList(fila.galeria),
    experiencias: Array.isArray(fila.experiencias)
      ? (nivel === 0 ? fila.experiencias.map((e: unknown) => experienciaCruda(e, 1)) : fila.experiencias)
      : null,
    // `foto_territorio` y `video_thumbnail` son columnas string del schema (Grupo C
    // residual): no hay media que normalizar, así que siguen saliendo como texto.
  } as Anfitrion;
}

export function anfitrionParaPlantilla(raw: unknown): Anfitrion {
  return anfitrionCruda(raw, 0);
}

export function paqueteParaPlantilla(raw: unknown): Paquete {
  const fila = esObjeto(raw) ? raw : {};
  return {
    ...fila,
    imagen_hero: medioCrudo(fila.imagen_hero),
    imagenes: toMediaList(fila.imagenes),
  } as Paquete;
}

/**
 * `null` = la experiencia no tiene imagen propia. Quien la pinta debe caer al mosaico Icon.
 * Cadena de respaldo equivalente a la vieja `imagen_hero_url → imagen_hero → galeria`:
 * el `MediaItem` de la portada ya resolvió media y twin adentro, y la galería ya fusionó
 * la columna json. La diferencia es que ahora trae el `alt` del admin.
 */
export function experienciaImagen(exp: Experiencia): MediaItem | null {
  return medioCrudo(exp?.imagen_hero) ?? toMediaList(exp?.galeria)[0] ?? null;
}

/** Galería de la experiencia como `MediaItem[]` (la fila ya vino normalizada del borde). */
export function experienciaGaleria(exp: Experiencia): MediaItem[] {
  return toMediaList(exp?.galeria);
}

/** `null` = el anfitrión no tiene foto propia; la tarjeta cae al mosaico Icon. Sin stock de Unsplash. */
export function anfitrionFoto(host: Anfitrion): MediaItem | null {
  return medioCrudo(host?.foto_perfil);
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
