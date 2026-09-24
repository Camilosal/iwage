/**
 * Unified bitácora entry fetching from Strapi `bitacoras` collection.
 * Each brand filters by `marca` field.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { filasAResumen, type ResumenBitacora } from './bitacora-resumen';

export { conteoDe, type ResumenBitacora } from './bitacora-resumen';

export interface EntradaBitacora {
  id: number;
  documentId: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  contenido: string | null;
  categoria: string | null;
  tiempo_lectura: number | null;
  imagen: string | null;
  fecha: string | null;
  marca: string;
  destacado: boolean;
  publicado: boolean;
  autor: string | null;
  etiquetas: string[] | null;
  fecha_actualizacion: string | null;
  meta_title: string | null;
  meta_description: string | null;
  subsistema: string | null;
  publishedAt: string;
  updatedAt: string;
}

export type Marca = 'tierras' | 'naturaleza' | 'meliponas' | 'cafe' | 'gestion' | 'granja';

/** Fetch all published articles for a specific brand */
export async function getBitacoraByMarca(
  marca: Marca,
  opts: { pageSize?: number; page?: number } = {}
): Promise<{ data: EntradaBitacora[]; total: number }> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      filters: { marca: { $eq: marca }, publicado: { $eq: true } },
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: opts.page || 1, pageSize: opts.pageSize || 20 },
    });
    return {
      data: res.data || [],
      total: res.meta?.pagination?.total || 0,
    };
  } catch {
    return { data: [], total: 0 };
  }
}

/** Campos que necesitan las tiras de resumen; `contenido` queda fuera a propósito. */
const CAMPOS_RESUMEN = [
  'titulo', 'slug', 'marca', 'fecha', 'extracto', 'imagen', 'categoria', 'tiempo_lectura',
];

/**
 * Una sola pasada a Strapi para todas las superficies que muestran bitácora
 * (hub, 5 landings y BrandFooter). `porMarca`/`recientes` son de post-proceso:
 * no entran al cache key, así que las 7 superficies comparten una única entrada
 * de Redis con TTL `CACHE_TTL.list`.
 * Si Strapi falla, devuelve el resumen vacío: el bloque se degrada a nada, nunca
 * a un 500 en la portada.
 */
export async function getResumenBitacora(
  opts: { porMarca?: number; recientes?: number } = {}
): Promise<ResumenBitacora> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      filters: { publicado: { $eq: true } },
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: 1, pageSize: 100 },
      fields: CAMPOS_RESUMEN,
    });
    return filasAResumen(res.data || [], opts);
  } catch {
    return filasAResumen([], opts);
  }
}

/** Fetch a single article by slug (across all brands) */
export async function getBitacoraBySlug(slug: string): Promise<EntradaBitacora | null> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug }, publicado: { $eq: true } },
      pagination: { pageSize: 1 },
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

/** Get all slugs for static generation (optional, for getStaticPaths) */
export async function getAllBitacoraSlugs(): Promise<{ slug: string; marca: string }[]> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      filters: { publicado: { $eq: true } },
      pagination: { pageSize: 100 },
      sort: ['fecha:desc'],
    });
    return (res.data || []).map((a) => ({ slug: a.slug, marca: a.marca }));
  } catch {
    return [];
  }
}

/** Format date for display */
export function formatFecha(fecha: string | null): string {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
