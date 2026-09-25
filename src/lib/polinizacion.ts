/**
 * Polinización Asistida con Meliponas — data layer.
 * Fetches crop sheets from Strapi `cultivo-polinizaciones` with Redis caching.
 * Strapi es el único dueño de las fichas de cultivo: si no responde o no tiene filas,
 * las consultas devuelven [] / null y la tarjeta pinta el mosaico Icon. Nunca un seed.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc, toMediaList, type MediaItem } from './media.ts';

// ── Types ──────────────────────────────────────────────
// El único tipo de galería del sitio es `MediaItem` (./media.ts). Se re-exporta desde
// aquí para no romper importaciones que pedían el tipo a esta capa de datos.
export type { MediaItem };

export interface EspecieMelipona {
  nombre: string;
  cientifico?: string;
  rol?: string;
}

export interface CasoExito {
  ubicacion?: string;
  cultivo?: string;
  metrica?: string;
  detalle?: string;
  ano?: number;
}

export interface CultivoPolinizacion {
  id: number;
  documentId: string;
  nombre: string;
  slug: string;
  nombre_cientifico: string | null;
  familia_botanica: string | null;
  icono: string | null;
  imagen: string | null;
  galeria: MediaItem[] | null;
  descripcion: string | null;
  descripcion_corta: string | null;
  rendimiento: string | null;
  rendimiento_detalle: string | null;
  fuente: string | null;
  especies_meliponas: EspecieMelipona[] | null;
  mecanismo_polinizacion: string | null;
  ventaja_vs_apis: string | null;
  compatibilidad_organica: boolean;
  // Variables operativas (simulador)
  tarifa_por_hectarea: number | null;
  densidad_cajas_ha: number | null;
  dias_alistamiento: number | null;
  dias_en_campo: number | null;
  dias_recuperacion: number | null;
  tasa_desgaste_pct: number | null;
  opex_logistico: number | null;
  multiplicador_distancia: number | null;
  area_minima_ha: number | null;
  area_maxima_ha: number | null;
  // Condiciones ambientales
  meses_floracion: number[] | null;
  altitud_optima_msnm: string | null;
  temperatura_optima: string | null;
  humedad_relativa: string | null;
  requerimiento_flora: string | null;
  // Servicio
  que_incluye: string[] | null;
  que_se_pide: string[] | null;
  condiciones_servicio: string | null;
  restricciones: string[] | null;
  garantia: string | null;
  caso_exito: CasoExito | null;
  destacado: boolean;
  activo: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

// ── Labels ─────────────────────────────────────────────
export const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ICONO_DEFAULT = 'flower-2';

// ── Mapper ─────────────────────────────────────────────
function mapCultivo(raw: any): CultivoPolinizacion {
  const galeria = Array.isArray(raw.galeria) ? toMediaList(raw.galeria) : null;

  return {
    id: raw.id,
    documentId: raw.documentId,
    nombre: raw.nombre,
    slug: raw.slug ?? '',
    nombre_cientifico: raw.nombre_cientifico ?? null,
    familia_botanica: raw.familia_botanica ?? null,
    icono: raw.icono ?? null,
    imagen: mediaSrc(raw.imagen) ?? raw.imagen ?? (galeria?.[0]?.url ?? null),
    galeria,
    descripcion: raw.descripcion ?? null,
    descripcion_corta: raw.descripcion_corta ?? null,
    rendimiento: raw.rendimiento ?? null,
    rendimiento_detalle: raw.rendimiento_detalle ?? null,
    fuente: raw.fuente ?? null,
    especies_meliponas: Array.isArray(raw.especies_meliponas) ? raw.especies_meliponas : null,
    mecanismo_polinizacion: raw.mecanismo_polinizacion ?? null,
    ventaja_vs_apis: raw.ventaja_vs_apis ?? null,
    compatibilidad_organica: raw.compatibilidad_organica ?? true,
    tarifa_por_hectarea: raw.tarifa_por_hectarea ?? null,
    densidad_cajas_ha: raw.densidad_cajas_ha ?? null,
    dias_alistamiento: raw.dias_alistamiento ?? null,
    dias_en_campo: raw.dias_en_campo ?? null,
    dias_recuperacion: raw.dias_recuperacion ?? null,
    tasa_desgaste_pct: raw.tasa_desgaste_pct ?? null,
    opex_logistico: raw.opex_logistico ?? null,
    multiplicador_distancia: raw.multiplicador_distancia ?? null,
    area_minima_ha: raw.area_minima_ha ?? null,
    area_maxima_ha: raw.area_maxima_ha ?? null,
    meses_floracion: Array.isArray(raw.meses_floracion) ? raw.meses_floracion : null,
    altitud_optima_msnm: raw.altitud_optima_msnm ?? null,
    temperatura_optima: raw.temperatura_optima ?? null,
    humedad_relativa: raw.humedad_relativa ?? null,
    requerimiento_flora: raw.requerimiento_flora ?? null,
    que_incluye: Array.isArray(raw.que_incluye) ? raw.que_incluye : null,
    que_se_pide: Array.isArray(raw.que_se_pide) ? raw.que_se_pide : null,
    condiciones_servicio: raw.condiciones_servicio ?? null,
    restricciones: Array.isArray(raw.restricciones) ? raw.restricciones : null,
    garantia: raw.garantia ?? null,
    caso_exito: raw.caso_exito ?? null,
    destacado: raw.destacado ?? false,
    activo: raw.activo ?? true,
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── API ────────────────────────────────────────────────
export async function getCultivos(opts?: { destacado?: boolean }): Promise<CultivoPolinizacion[]> {
  const filters: Record<string, any> = { activo: { $eq: true } };
  if (opts?.destacado) filters.destacado = { $eq: true };

  try {
    const res = await strapiFetch<any>('cultivo-polinizaciones', {
      ttl: CACHE_TTL.list,
      filters,
      sort: ['nombre:asc'],
      pagination: { pageSize: 50 },
    });
    return (res.data ?? []).map(mapCultivo);
  } catch {
    // Con Strapi caído no hay fichas que mostrar: []. El `catch` no es un seed de
    // reserva — inventar cultivos, tarifas y métricas de amarre sería peor que un
    // índice vacío, y la página sigue respondiendo 200 con el estado vacío.
    return [];
  }
}

export async function getCultivoBySlug(slug: string): Promise<CultivoPolinizacion | null> {
  try {
    const res = await strapiFetch<any>('cultivo-polinizaciones', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
    });
    const item = res.data?.[0];
    return item ? mapCultivo(item) : null;
  } catch {
    // Strapi caído o sin esa ficha: null → la ruta responde con Astro.redirect al índice,
    // nunca una ficha inventada (tarifas, métricas de amarre, casos de éxito del seed).
    return null;
  }
}
