/**
 * Hero Configurations — data layer.
 * Queries hero section data from Strapi v5 with Redis caching.
 *
 * The `hero-configuracion` collection has one record per page route
 * (e.g., /cafe, /cafe/menu, /tierras/comprar). Each record carries the
 * title, subtitle, image, and up to 2 CTAs.
 */
import { strapiFetch, CACHE_TTL } from './strapi.ts';
import { mediaSrc } from './media.ts';

const ENDPOINT = 'hero-configuracions';

// ── Tolerancia a Strapi caído ──────────────────────────

/** Una línea, acotada: diagnostica sin volcar el cuerpo de la respuesta ni los registros. */
function motivo(err: unknown): string {
  const texto = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return texto.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function esObjeto(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null;
}

function esTexto(valor: unknown): boolean {
  return typeof valor === 'string';
}

/**
 * Strapi puede estar caído; una landing de marca no puede ser un 500 por eso.
 * El costo de fallar blando es un hero sin foto, no una página fuera de línea.
 *
 * Cubre las dos familias de fallo que llegaban crudas al SSR de las ~40 páginas:
 *  - lo que `strapiFetch` rechaza: red rota, non-ok, `json()` sobre un cuerpo que no
 *    es JSON (nginx devolviendo HTML) y el `AbortSignal.timeout(8000)` expirado;
 *  - lo que `strapiFetch` devuelve pero nadie pidió: un 200 con forma sorpresa
 *    (`null`, un string, `{ data: "no-array" }`, `[null]`). `res.data` y el
 *    `map(normalizeSeguro)` de abajo viven FUERA de este try, así que aquí se devuelve
 *    SIEMPRE la forma utilizable `{ data: T[] }` y nada más; lo que haya DENTRO de un
 *    registro lo remata `normalizeSeguro`, que descarta el registro y no la página.
 *
 * No se traga el fallo en silencio: sale una línea al stderr por request intentado, con
 * el endpoint y el motivo. Un array vacío no es una anomalía (una página puede no tener
 * hero configurado) y por eso no avisa.
 */
async function fetchSeguro<T>(
  endpoint: string,
  options: Parameters<typeof strapiFetch>[1],
): Promise<{ data: T[]; meta: unknown }> {
  const vacio = { data: [] as T[], meta: {} };
  let res: { data?: unknown; meta?: unknown } | null;

  try {
    res = await strapiFetch<T>(endpoint, options);
  } catch (err) {
    console.warn(`[heroes] Strapi no responde para ${endpoint}: ${motivo(err)}`);
    return vacio;
  }

  const filas = res?.data;
  if (!Array.isArray(filas)) {
    console.warn(`[heroes] Strapi respondió con una forma inesperada para ${endpoint}`);
    return vacio;
  }
  // Un elemento `null` dentro del array tampoco puede tirar el `map(normalizeSeguro)` del llamador.
  return { data: filas.filter(esObjeto), meta: res?.meta ?? {} };
}

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
    imagen: mediaSrc(rec.imagen) ?? null,
    label: rec.label ?? null,
    cta_primario_texto: rec.cta_primario_texto ?? null,
    cta_primario_url: rec.cta_primario_url ?? null,
    cta_secundario_texto: rec.cta_secundario_texto ?? null,
    cta_secundario_url: rec.cta_secundario_url ?? null,
    color_overlay: rec.color_overlay ?? null,
    orden: rec.orden ?? 0,
  };
}

/**
 * El paso por registro del `map` de los tres puntos de entrada.
 *
 * `fetchSeguro` garantiza la forma del sobre (`{ data: T[] }`), pero el `map(normalize)`
 * vive FUERA de ese `try` y un solo registro podrido de un 200 tiraba la página igual que
 * una caída de Strapi. Dos caminos medidos:
 *  - `imagen: { url: 5 }` → `media.ts:67` hace `(o.url || '').trim()` y lanza TypeError;
 *  - `slug_ruta: 123` → `normalize` lo deja pasar (es truthy) y `h.slug_ruta.startsWith`
 *    lanza en `getHeroesByPrefix`, y además sale al HTML un `HeroConfig` que miente en sus
 *    tipos (y en el `.trim()`/`.toLowerCase()` de cualquiera de las ~40 páginas).
 *
 * Aquí eso degrada a UN registro descartado (o sin foto), nunca a una promesa rechazada.
 * El aviso es una línea con el tipo del problema: ni el registro ni el payload. Un
 * `null` de `normalize` por campos que faltan NO avisa: es el estado normal de una página
 * sin hero configurado, y llenar stderr de falsas alarmas ocultaría la caída real.
 */
function normalizeSeguro(rec: StrapiHeroRecord): HeroConfig | null {
  let hero: HeroConfig | null;
  try {
    hero = normalize(rec);
  } catch (err) {
    console.warn(`[heroes] Registro descartado en ${ENDPOINT}: ${motivo(err)}`);
    return null;
  }
  if (hero && (!esTexto(hero.slug_ruta) || !esTexto(hero.titulo))) {
    console.warn(
      `[heroes] Registro descartado en ${ENDPOINT}: slug_ruta o titulo no son texto (${typeof hero.slug_ruta}, ${typeof hero.titulo})`,
    );
    return null;
  }
  return hero;
}

// ── Public API ─────────────────────────────────────────

/** Get all hero configurations (sorted by orden asc). */
export async function getHeroes(): Promise<HeroConfig[]> {
  const res = await fetchSeguro<StrapiHeroRecord>(ENDPOINT, {
    ttl: CACHE_TTL.config,
    sort: ['orden:asc', 'slug_ruta:asc'],
    pagination: { pageSize: 100 },
  });
  return (res.data ?? [])
    .map(normalizeSeguro)
    .filter((h): h is HeroConfig => h !== null);
}

/** Get hero by route slug (e.g. '/cafe', '/tierras/comprar').
 *  Tolerates trailing-slash variants: '/cafe' and '/cafe/' both work.
 *  Strapi caído devuelve `null`: la página se pinta sin hero, no con un 500. */
export async function getHeroBySlug(slug: string): Promise<HeroConfig | null> {
  // Try the exact slug first; fall back to the opposite trailing-slash variant.
  const variants = slug.endsWith('/') && slug.length > 1
    ? [slug, slug.slice(0, -1)]
    : [slug, `${slug}/`];

  for (const v of variants) {
    const res = await fetchSeguro<StrapiHeroRecord>(ENDPOINT, {
      ttl: CACHE_TTL.config,
      filters: { slug_ruta: { $eq: v } },
      pagination: { pageSize: 1 },
    });
    const rec = res.data?.[0];
    if (rec) return normalizeSeguro(rec);
  }
  return null;
}

/** Get heroes whose slug starts with a given prefix (e.g. '/cafe'). */
export async function getHeroesByPrefix(prefix: string): Promise<HeroConfig[]> {
  const res = await fetchSeguro<StrapiHeroRecord>(ENDPOINT, {
    ttl: CACHE_TTL.config,
    sort: ['orden:asc', 'slug_ruta:asc'],
    pagination: { pageSize: 100 },
  });
  return (res.data ?? [])
    .map(normalizeSeguro)
    .filter((h): h is HeroConfig => h !== null && h.slug_ruta.startsWith(prefix));
}
