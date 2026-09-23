/**
 * Hero Configurations — data layer.
 * Queries hero section data from Strapi v5 with Redis caching.
 *
 * The `hero-configuracion` collection has one record per page route
 * (e.g., /cafe, /cafe/menu, /tierras/comprar). Each record carries the
 * title, subtitle, image, and up to 2 CTAs.
 */
import { strapiFetch, CACHE_TTL } from './strapi';

const ENDPOINT = 'hero-configuracions';

// ── Types ──────────────────────────────────────────────
export interface HeroConfig {
  id: number;
  documentId: string;
  pagina: string;
  slug_ruta: string;
  titulo: string;
  subtitulo: string | null;
  imagen: string | null;
  label: string | null;
  cta_primario_texto: string | null;
  cta_primario_url: string | null;
  cta_secundario_texto: string | null;
  cta_secundario_url: string | null;
  color_overlay: string | null;
  orden: number;
}

interface StrapiHeroRecord {
  id: number;
  documentId: string;
  pagina?: string;
  slug_ruta?: string;
  titulo?: string;
  subtitulo?: string | null;
  imagen?: string | null;
  label?: string | null;
  cta_primario_texto?: string | null;
  cta_primario_url?: string | null;
  cta_secundario_texto?: string | null;
  cta_secundario_url?: string | null;
  color_overlay?: string | null;
  orden?: number;
}

function normalize(rec: StrapiHeroRecord): HeroConfig | null {
  if (!rec.slug_ruta || !rec.titulo) return null;
  return {
    id: rec.id,
    documentId: rec.documentId,
    pagina: rec.pagina ?? rec.slug_ruta,
    slug_ruta: rec.slug_ruta,
    titulo: rec.titulo,
    subtitulo: rec.subtitulo ?? null,
    imagen: rec.imagen ?? null,
    label: rec.label ?? null,
    cta_primario_texto: rec.cta_primario_texto ?? null,
    cta_primario_url: rec.cta_primario_url ?? null,
    cta_secundario_texto: rec.cta_secundario_texto ?? null,
    cta_secundario_url: rec.cta_secundario_url ?? null,
    color_overlay: rec.color_overlay ?? null,
    orden: rec.orden ?? 0,
  };
}

// ── Public API ─────────────────────────────────────────

/** Get all hero configurations (sorted by orden asc). */
export async function getHeroes(): Promise<HeroConfig[]> {
  const res = await strapiFetch<StrapiHeroRecord>(ENDPOINT, {
    ttl: CACHE_TTL.config,
    sort: ['orden:asc', 'slug_ruta:asc'],
    pagination: { pageSize: 100 },
  });
  return (res.data ?? [])
    .map(normalize)
    .filter((h): h is HeroConfig => h !== null);
}

/** Get hero by route slug (e.g. '/cafe', '/tierras/comprar').
 *  Tolerates trailing-slash variants: '/cafe' and '/cafe/' both work. */
export async function getHeroBySlug(slug: string): Promise<HeroConfig | null> {
  // Try the exact slug first; fall back to the opposite trailing-slash variant.
  const variants = slug.endsWith('/') && slug.length > 1
    ? [slug, slug.slice(0, -1)]
    : [slug, `${slug}/`];

  for (const v of variants) {
    const res = await strapiFetch<StrapiHeroRecord>(ENDPOINT, {
      ttl: CACHE_TTL.config,
      filters: { slug_ruta: { $eq: v } },
      pagination: { pageSize: 1 },
    });
    const rec = res.data?.[0];
    if (rec) return normalize(rec);
  }
  return null;
}

/** Get heroes whose slug starts with a given prefix (e.g. '/cafe'). */
export async function getHeroesByPrefix(prefix: string): Promise<HeroConfig[]> {
  const res = await strapiFetch<StrapiHeroRecord>(ENDPOINT, {
    ttl: CACHE_TTL.config,
    sort: ['orden:asc', 'slug_ruta:asc'],
    pagination: { pageSize: 100 },
  });
  return (res.data ?? [])
    .map(normalize)
    .filter((h): h is HeroConfig => h !== null && h.slug_ruta.startsWith(prefix));
}
