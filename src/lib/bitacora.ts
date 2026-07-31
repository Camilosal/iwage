/**
 * Unified bitácora entry fetching from Strapi `bitacoras` collection.
 * Each brand filters by `marca` field.
 */
import { strapiFetch, CACHE_TTL } from './strapi';

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
  publishedAt: string;
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
      filters: { marca: { $eq: marca } },
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

/** Fetch a single article by slug (across all brands) */
export async function getBitacoraBySlug(slug: string): Promise<EntradaBitacora | null> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
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
