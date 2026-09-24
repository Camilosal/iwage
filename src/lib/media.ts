/**
 * Contrato único de medios del sitio.
 *
 * Todo lo que es imagen, video o recorrido 360 llega aquí y sale como MediaItem.
 * Regla de oro: la URL que se pinta en el HTML es relativa de sitio (/uploads/...),
 * porque nginx ya proxya /uploads hacia Strapi. Las absolutas existen solo para
 * og:image, twitter:image y JSON-LD, que no aceptan rutas relativas.
 *
 * No importa ./strapi.ts: arrastra ioredis y abre conexiones al cargarse.
 */

export type MediaKind = 'imagen' | 'video' | 'tour360';
export type MediaProvider = 'strapi' | 'youtube' | 'vimeo' | 'drive' | 'otro';

export interface MediaItem {
  url: string;
  kind: MediaKind;
  alt?: string;
  caption?: string;
  provider?: MediaProvider;
}

/** Forma del objeto media de Strapi v5 (solo lo que usamos). */
export interface StrapiMedia {
  id?: number;
  documentId?: string;
  url?: string | null;
  mime?: string | null;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Formas históricas de galería repartidas por src/lib. */
interface LegacyItem {
  url?: string | null;
  tipo?: string;
  titulo?: string;
  alt?: string;
  caption?: string;
  kind?: string;
  mime?: string;
}

const SITE_URL = () => process.env.APP_URL || 'https://iwage.co';

function safeUrl(raw: string): URL | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try { return new URL(raw); } catch { return null; }
}

/** Hosts que en realidad son este mismo sitio dicho de otra manera. */
function isSelfHost(host: string): boolean {
  if (host === 'iwage.co' || host === 'www.iwage.co' || host === 'iwage_strapi' || host === 'strapi_backend') return true;
  const strapi = safeUrl(process.env.STRAPI_URL || '');
  return !!strapi && strapi.hostname === host;
}

function rawOf(input: unknown): string | null {
  if (typeof input === 'string') {
    const t = input.trim();
    return t || null;
  }
  if (!input || typeof input !== 'object') return null;
  const o = input as StrapiMedia & LegacyItem;
  const u = (o.url || '').trim();
  return u || null;
}

function classify(url: string): { kind: MediaKind; provider: MediaProvider } {
  const u = safeUrl(url);
  const host = u ? u.hostname : '';
  if (/youtu\.?be/.test(host)) return { kind: 'video', provider: 'youtube' };
  if (/vimeo/.test(host)) return { kind: 'video', provider: 'vimeo' };
  if (/drive\.google/.test(host)) return { kind: 'imagen', provider: 'drive' };
  if (/(matterport|kuula|360|pano|tourmkr)/.test(host + url)) return { kind: 'tour360', provider: 'otro' };
  const path = url.split(/[?#]/)[0];
  if (/\.(mp4|webm|mov|m4v|m4a|mp3|ogg|wav)$/i.test(path)) return { kind: 'video', provider: 'strapi' };
  return { kind: 'imagen', provider: 'strapi' };
}

const TIPO_VIEJO: Record<string, MediaKind> = {
  imagen: 'imagen', image: 'imagen', video: 'video', '360': 'tour360', tour360: 'tour360', tour: 'tour360',
};

export function mediaSrc(input: unknown): string | null {
  const raw = rawOf(input);
  if (!raw) return null;
  const u = safeUrl(raw);
  if (u && isSelfHost(u.hostname)) return u.pathname;
  return raw;
}

export function absUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, SITE_URL()).toString(); } catch { return null; }
}

export function toMediaItem(input: unknown): MediaItem | null {
  const raw = rawOf(input);
  if (!raw) return null;
  const url = mediaSrc(raw)!;
  const clas = classify(url);

  let kind = clas.kind;
  let provider = clas.provider;
  let alt: string | undefined;
  let caption: string | undefined;

  if (input && typeof input === 'object') {
    const o = input as StrapiMedia & LegacyItem;
    if (o.mime && /^video\//.test(o.mime)) kind = 'video';
    if (o.tipo) kind = TIPO_VIEJO[o.tipo] ?? kind;
    if (o.kind && TIPO_VIEJO[o.kind]) kind = TIPO_VIEJO[o.kind];
    alt = o.alternativeText ?? o.alt ?? undefined;
    caption = o.caption ?? o.titulo ?? undefined;
  }

  return { url, kind, provider, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) };
}

/** Clave de dedupe: la misma pieza escrita de cualquier forma converge. */
function canonicalKey(url: string): string {
  const u = safeUrl(url);
  return (u ? u.pathname : url).toLowerCase();
}

const RIQUEZA = (m: MediaItem) => (m.alt ? 2 : 0) + (m.caption ? 1 : 0);

export function toMediaList(input: unknown): MediaItem[] {
  const arr = Array.isArray(input) ? input : input == null ? [] : [input];
  const seen = new Map<string, MediaItem>();
  for (const entry of arr) {
    // Un array anidado es la forma en que Strapi devuelve una relación multiple.
    const nodes = Array.isArray(entry) ? entry : [entry];
    for (const node of nodes) {
      const item = toMediaItem(node);
      if (!item) continue;
      const key = canonicalKey(item.url);
      const prev = seen.get(key);
      if (!prev || RIQUEZA(item) > RIQUEZA(prev)) seen.set(key, item);
    }
  }
  return [...seen.values()];
}

export function isEmbed(item: MediaItem): boolean {
  return item.provider === 'youtube' || item.provider === 'vimeo'
    || item.provider === 'drive' || item.kind === 'tour360';
}

/** URL reproducible en <iframe>. Imagen y video propio pasan intactas. */
export function embedSrc(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }
  if (/vimeo\.com/.test(url)) {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  if (/drive\.google\.com\/file\/d\/(.+)/.test(url)) {
    const m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
  }
  return url;
}
