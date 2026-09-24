/**
 * Strapi v5 API client with Redis caching and request coalescing.
 * Ported patterns from app_marca_personal/src/lib/strapi-fetcher.ts
 */
import { cacheGet, cacheSet, redisInvalidate } from './redis';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// ── TTL Hierarchy (seconds) ────────────────────────────
export const CACHE_TTL = {
  search: 60,       // Property/experience search results
  list: 300,        // Listing pages
  featured: 600,    // Featured/highlighted content
  single: 3600,     // Individual entity pages
  config: 86400,    // Site config, static content
} as const;

// ── In-memory request coalescing ───────────────────────
const inflightFetches = new Map<string, Promise<any>>();

interface StrapiResponse<T> {
  data: T[];
  meta: { pagination?: { total: number; page: number; pageSize: number } };
}

interface StrapiFetchOptions {
  /** Cache TTL in seconds (0 = no cache) */
  ttl?: number;
  /** Cache key override (auto-generated if omitted) */
  cacheKey?: string;
  /** Additional fetch options */
  fetchOptions?: RequestInit;
  /** Populate relations */
  populate?: string | string[];
  /** Filter parameters */
  filters?: Record<string, any>;
  /** Sort order */
  sort?: string | string[];
  /** Pagination */
  pagination?: { page?: number; pageSize?: number };
  /**
   * Subconjunto de atributos (Strapi v5 `fields[]`). En colecciones con `contenido`
   * largo evita arrastrar el texto completo al caché de Redis.
   */
  fields?: string[];
  /**
   * Strapi v5 publication state filter.
   * Use 'live' to return only published records (excludes drafts and their locale duplicates).
   * Leave undefined to return all records (default Strapi behavior).
   */
  publicationState?: 'live' | 'preview';
}

/**
 * Serializa filtros a sintaxis de bracket de Strapi v5.
 * Strapi v5 rechaza `filters` como JSON string ("The filters parameter must be
 * an object or an array"); requiere filters[campo][$op]=valor.
 * Ej: { publicado: { $eq: true } } → [['filters[publicado][$eq]', 'true']]
 */
function filterParams(filters: any, prefix = 'filters'): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (Array.isArray(filters)) {
    filters.forEach((v, i) => out.push(...filterParams(v, `${prefix}[${i}]`)));
  } else if (filters !== null && typeof filters === 'object') {
    for (const [k, v] of Object.entries(filters)) out.push(...filterParams(v, `${prefix}[${k}]`));
  } else {
    out.push([prefix, String(filters)]);
  }
  return out;
}

/**
 * Fetch from Strapi with Redis cache + in-memory coalescing.
 * Pipeline: cache lookup → coalesced fetch → save to cache → return
 */
export async function strapiFetch<T = any>(
  endpoint: string,
  options: StrapiFetchOptions = {}
): Promise<StrapiResponse<T>> {
  const {
    ttl = CACHE_TTL.list,
    cacheKey: customKey,
    fetchOptions = {},
    populate,
    filters,
    sort,
    pagination,
    fields,
    publicationState,
  } = options;

  // Build URL with query params
  const params = new URLSearchParams();
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((p) => params.append('populate[]', p));
    } else {
      params.set('populate', populate);
    }
  }
  if (fields) fields.forEach((f) => params.append('fields[]', f));
  if (filters) filterParams(filters).forEach(([k, v]) => params.append(k, v));
  if (sort) {
    const sorts = Array.isArray(sort) ? sort : [sort];
    sorts.forEach((s) => params.append('sort', s));
  }
  if (pagination) {
    if (pagination.page) params.set('pagination[page]', String(pagination.page));
    if (pagination.pageSize) params.set('pagination[pageSize]', String(pagination.pageSize));
  }
  if (publicationState) params.set('publicationState', publicationState);

  const queryString = params.toString();
  const url = `${STRAPI_URL}/api/${endpoint}${queryString ? `?${queryString}` : ''}`;

  // Generate cache key (sorted for consistency)
  const cacheKey = customKey || `strapi:${endpoint}:${queryString}`;

  // 1. Try Redis cache
  if (ttl > 0) {
    const cached = await cacheGet<StrapiResponse<T>>(cacheKey);
    if (cached) return cached;
  }

  // 2. Coalesce concurrent identical requests
  if (inflightFetches.has(cacheKey)) {
    return inflightFetches.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (STRAPI_API_TOKEN) {
        headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
      }
      const res = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(8000),
        headers: {
          ...headers,
          ...(fetchOptions.headers || {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Strapi error: ${res.status} ${res.statusText} — ${url}`);
      }

      const data: StrapiResponse<T> = await res.json();

      // 3. Save to cache
      if (ttl > 0) {
        await cacheSet(cacheKey, data, ttl);
      }

      return data;
    } finally {
      inflightFetches.delete(cacheKey);
    }
  })();

  inflightFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch a single-type from Strapi (e.g., configuracion-sitio, cafe-config)
 */
export async function strapiSingle<T = any>(
  endpoint: string,
  options: { ttl?: number; populate?: string | string[] } = {}
): Promise<T> {
  const { ttl = CACHE_TTL.config, populate } = options;
  const cacheKey = `strapi:single:${endpoint}`;

  // Try cache
  if (ttl > 0) {
    const cached = await cacheGet<T>(cacheKey);
    if (cached) return cached;
  }

  const params = new URLSearchParams();
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((p) => params.append('populate[]', p));
    } else {
      params.set('populate', populate);
    }
  }

  const url = `${STRAPI_URL}/api/${endpoint}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Strapi single error: ${res.status} — ${endpoint}`);

  const json = await res.json();
  const data = json.data;

  if (ttl > 0) {
    await cacheSet(cacheKey, data, ttl);
  }

  return data;
}

/**
 * Invalidate all cache entries matching a pattern.
 * Call from Strapi webhooks when content changes.
 */
export async function invalidateStrapiCache(pattern: string): Promise<number> {
  return redisInvalidate(`strapi:${pattern}`);
}

/**
 * Resolve image URL from Strapi.
 * - External URLs (http/https): returned as-is
 * - Strapi media library (/uploads/...): prepend STRAPI_URL
 * - Local paths (/images/...): served by Astro, return as-is
 */
export function strapiImage(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/')) return `${STRAPI_URL}${path}`;
  return path;
}
