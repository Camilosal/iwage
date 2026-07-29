/**
 * catalogo.ts
 * Acceso al catálogo de recursos reservables (app_reservas) desde el servidor,
 * y resolución de productos locales (slug/nombre) a su recurso del catálogo.
 *
 * Solo para uso server-side (Astro SSR). Usa RESERVAS_API_URL interno.
 */

const RESERVAS_API = import.meta.env.RESERVAS_API_URL || 'http://reservas_app:4326';

export interface RecursoCatalogo {
  documentId: string;
  nombre: string;
  slug: string;
  tipo: string;
  origen: string;
  origen_slug: string | null;
  requiere_pago: boolean;
  precio_base: number | null;
  moneda: string;
  tipo_disponibilidad: string;
  url_publica: string | null;
}

let cache: RecursoCatalogo[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Obtiene todos los recursos del catálogo (con cache en memoria de 5 min). */
export async function getCatalogo(): Promise<RecursoCatalogo[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;
  try {
    const res = await fetch(`${RESERVAS_API}/api/recursos?pagination[pageSize]=100`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return cache ?? [];
    const json = await res.json();
    cache = (json.data || []) as RecursoCatalogo[];
    cacheTime = now;
    return cache;
  } catch {
    return cache ?? [];
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Resuelve un producto local a su recurso del catálogo.
 * Prueba: origen_slug exacto → slug prefijado → nombre normalizado.
 */
export function resolveRecurso(
  catalogo: RecursoCatalogo[],
  productSlug: string,
  productName: string,
  prefix = 'meliponas'
): RecursoCatalogo | undefined {
  return (
    catalogo.find((r) => r.origen_slug === productSlug) ||
    catalogo.find((r) => r.slug === `${prefix}-${productSlug}`) ||
    catalogo.find((r) => norm(r.nombre) === norm(productName))
  );
}
