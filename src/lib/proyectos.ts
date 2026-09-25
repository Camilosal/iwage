/**
 * Proyectos Meliponario — data layer.
 * Fetches project sheets from Strapi with Redis caching.
 * Strapi es el único dueño de los proyectos: si no responde o no tiene filas,
 * las consultas devuelven [] y la tarjeta pinta el mosaico Icon. Nunca un seed.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc, toMediaList, type MediaItem } from './media.ts';

// ── Types ──────────────────────────────────────────────
export type TipoProyecto = 'finca' | 'empresa' | 'club' | 'cultivo' | 'turismo' | 'residencial' | 'institucional';
export type EstadoProyecto = 'diagnostico' | 'diseno' | 'instalacion' | 'activo' | 'en-proceso' | 'pausado' | 'finalizado';
export type ModeloCaja = 'inpa' | 'af' | 'inpa-atril' | 'mixto' | 'otro';
export type EstadoPago = 'pendiente' | 'parcial' | 'pagado' | 'no-aplica';
export type TipoContrato = 'unico' | 'acompanamiento-mensual' | 'convenio' | 'donacion';
export type SaludColonias = 'excelente' | 'buena' | 'regular' | 'critica';
export type ClienteTipo = 'colegio' | 'finca' | 'empresa' | 'hotel' | 'particular' | 'ong' | 'gobernacion';

// El único tipo de galería del sitio es `MediaItem` (./media.ts). Se re-exporta desde
// aquí para no romper importaciones que pedían el tipo a esta capa de datos.
export type { MediaItem };

export interface ProyectoMeliponario {
  id: number;
  documentId: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  imagen: string | null;
  galeria: MediaItem[] | null;

  // Clasificación
  tipo: TipoProyecto;
  estado: EstadoProyecto;

  // Ubicación
  ubicacion: string | null;
  municipio: string | null;
  vereda: string | null;
  altitud_msnm: number | null;
  coordenadas: string | null;
  area_m2: number | null;

  // Técnico
  colmenas: number | null;
  modelo_caja: ModeloCaja | null;
  especies: string | null;
  flora_melifera: string[] | null;
  fecha_instalacion: string | null;
  fecha_ultima_visita: string | null;
  proxima_visita: string | null;

  // Comercial
  cliente_nombre: string | null;
  cliente_tipo: ClienteTipo | null;
  cliente_contacto: string | null;
  valor_contrato: number | null;
  estado_pago: EstadoPago | null;
  tipo_contrato: TipoContrato | null;
  servicios_incluidos: string[] | null;

  // Modelo Iwagé
  iot_activo: boolean;
  iot_sensores: Array<{ tipo: string; valor?: string }> | null;
  trazabilidad_qr: boolean;
  identidad_digital_colmena: boolean;

  // Producción e impacto
  produccion_miel_ml: number | null;
  produccion_cosechas: number | null;
  indice_biodiversidad: number | null;
  mejora_polinizacion_pct: number | null;
  salud_colonias: SaludColonias | null;

  // Impacto social
  impacto_familias: number | null;
  impacto_estudiantes: number | null;
  impacto_empleos: number | null;
  prae_alineado: boolean;
  componente_ancestral: string | null;

  // Meta
  metricas: Record<string, any> | null;
  notas_tecnicas: string | null;
  tags: string[] | null;
  orden: number;
  destacado: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

// ── Labels ─────────────────────────────────────────────
export const TIPO_LABELS: Record<TipoProyecto, string> = {
  finca: 'Finca productiva',
  empresa: 'Empresa',
  club: 'Club / PRAE',
  cultivo: 'Cultivo',
  turismo: 'Turismo',
  residencial: 'Residencial',
  institucional: 'Institucional',
};

export const ESTADO_LABELS: Record<EstadoProyecto, { label: string; color: string }> = {
  diagnostico: { label: 'Diagnóstico', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  diseno: { label: 'Diseño', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  instalacion: { label: 'Instalación', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  activo: { label: 'Activo', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  'en-proceso': { label: 'En proceso', color: 'bg-accent-muted text-accent' },
  pausado: { label: 'Pausado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  finalizado: { label: 'Finalizado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export const MODELO_CAJA_LABELS: Record<ModeloCaja, string> = {
  inpa: 'INPA',
  af: 'Augusto Ferreira',
  'inpa-atril': 'INPA con atril',
  mixto: 'Mixto',
  otro: 'Otro',
};

export const SALUD_LABELS: Record<SaludColonias, { label: string; color: string }> = {
  excelente: { label: 'Excelente', color: 'text-green-600 dark:text-green-400' },
  buena: { label: 'Buena', color: 'text-emerald-600 dark:text-emerald-400' },
  regular: { label: 'Regular', color: 'text-amber-600 dark:text-amber-400' },
  critica: { label: 'Crítica', color: 'text-red-600 dark:text-red-400' },
};

// ── Normalizer ─────────────────────────────────────────
function normalizeProyecto(raw: any): ProyectoMeliponario {
  const galeria = Array.isArray(raw.galeria) ? toMediaList(raw.galeria) : null;

  return {
    id: raw.id,
    documentId: raw.documentId ?? String(raw.id),
    nombre: raw.nombre,
    slug: raw.slug,
    descripcion: raw.descripcion ?? null,
    descripcion_corta: raw.descripcion_corta ?? null,
    imagen: raw.imagen ? mediaSrc(raw.imagen) : (galeria?.[0]?.url ?? null),
    galeria,
    tipo: raw.tipo,
    estado: raw.estado ?? 'en-proceso',
    ubicacion: raw.ubicacion ?? null,
    municipio: raw.municipio ?? null,
    vereda: raw.vereda ?? null,
    altitud_msnm: raw.altitud_msnm ?? null,
    coordenadas: raw.coordenadas ?? null,
    area_m2: raw.area_m2 ?? null,
    colmenas: raw.colmenas ?? null,
    modelo_caja: raw.modelo_caja ?? null,
    especies: raw.especies ?? null,
    flora_melifera: raw.flora_melifera ?? null,
    fecha_instalacion: raw.fecha_instalacion ?? null,
    fecha_ultima_visita: raw.fecha_ultima_visita ?? null,
    proxima_visita: raw.proxima_visita ?? null,
    cliente_nombre: raw.cliente_nombre ?? null,
    cliente_tipo: raw.cliente_tipo ?? null,
    cliente_contacto: raw.cliente_contacto ?? null,
    valor_contrato: raw.valor_contrato ?? null,
    estado_pago: raw.estado_pago ?? null,
    tipo_contrato: raw.tipo_contrato ?? null,
    servicios_incluidos: raw.servicios_incluidos ?? null,
    iot_activo: raw.iot_activo ?? false,
    iot_sensores: raw.iot_sensores ?? null,
    trazabilidad_qr: raw.trazabilidad_qr ?? false,
    identidad_digital_colmena: raw.identidad_digital_colmena ?? false,
    produccion_miel_ml: raw.produccion_miel_ml ?? null,
    produccion_cosechas: raw.produccion_cosechas ?? null,
    indice_biodiversidad: raw.indice_biodiversidad ?? null,
    mejora_polinizacion_pct: raw.mejora_polinizacion_pct ?? null,
    salud_colonias: raw.salud_colonias ?? null,
    impacto_familias: raw.impacto_familias ?? null,
    impacto_estudiantes: raw.impacto_estudiantes ?? null,
    impacto_empleos: raw.impacto_empleos ?? null,
    prae_alineado: raw.prae_alineado ?? false,
    componente_ancestral: raw.componente_ancestral ?? null,
    metricas: raw.metricas ?? null,
    notas_tecnicas: raw.notas_tecnicas ?? null,
    tags: raw.tags ?? null,
    orden: raw.orden ?? 0,
    destacado: raw.destacado ?? false,
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── Public API ─────────────────────────────────────────

/** Get all published projects, optionally filtered */
export async function getProyectos(opts?: {
  tipo?: TipoProyecto;
  estado?: EstadoProyecto;
}): Promise<ProyectoMeliponario[]> {
  try {
    const filters: Record<string, any> = {};
    if (opts?.tipo) filters.tipo = { $eq: opts.tipo };
    if (opts?.estado) filters.estado = { $eq: opts.estado };

    const res = await strapiFetch<ProyectoMeliponario>('proyecto-meliponarios', {
      ttl: CACHE_TTL.list,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: ['orden:asc', 'nombre:asc'],
      pagination: { pageSize: 100 },
    });

    return (res.data ?? []).map(normalizeProyecto);
  } catch {
    // Con Strapi caído no hay proyectos que mostrar: [] y la card pinta el mosaico
    // Icon. El seed de 6 meliponarios era contenido inventado haciéndose pasar por BD.
    return [];
  }
}

/** Get a single project by slug */
export async function getProyectoBySlug(slug: string): Promise<ProyectoMeliponario | null> {
  try {
    const res = await strapiFetch<ProyectoMeliponario>('proyecto-meliponarios', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
    });

    const first = res.data?.[0];
    return first ? normalizeProyecto(first) : null;
  } catch {
    return null;
  }
}
