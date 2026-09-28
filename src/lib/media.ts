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

/**
 * Relativa de sitio: un solo `/` inicial. `//cdn.tercero.com/a.jpg` NO es relativa — es un
 * tercero al que se le quitó el protocolo, y `absUrl` lo devuelve tal cual (`https://cdn…`).
 * Por eso el test es de forma y no "si no es absoluta, es nuestra".
 */
const RELATIVA_DE_SITIO = /^\/(?!\/)/;

/** Nombres con los que existe este mismo equipo. Un loopback nunca es un tercero. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

/** Hosts que en realidad son este mismo sitio dicho de otra manera. */
function isSelfHost(host: string): boolean {
  if (host === 'iwage.co' || host === 'www.iwage.co' || host === 'iwage_strapi' || host === 'strapi_backend') return true;
  // Importa por `esPintable`: si STRAPI_URL dice `127.0.0.1` y los uploads dicen `localhost`
  // —pase en cualquier dev— no reconocerlo borra TODAS las imágenes locales.
  if (LOOPBACK.has(host)) return true;
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

const EXT_VIDEO = /\.(mp4|webm|mov|m4v|m4a|mp3|ogg|wav)$/i;
const EXT_IMAGEN = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/**
 * `kind`/`provider` según el host y, para lo propio, según el nombre del archivo. `ext`
 * separa el hecho del nombre (`'.mp4'` → `'video'`, `'.webp'` → `'imagen'`, `/uploads/abc`
 * → `null`) de la etiqueta heredada: `toMediaItem` solo escucha `tipo` cuando `ext` es null.
 */
function classify(url: string): { kind: MediaKind; provider: MediaProvider; ext: MediaKind | null } {
  const u = safeUrl(url);
  const host = u ? u.hostname : '';
  if (/youtu\.?be/.test(host)) return { kind: 'video', provider: 'youtube', ext: null };
  if (/vimeo/.test(host)) return { kind: 'video', provider: 'vimeo', ext: null };
  if (/drive\.google/.test(host)) return { kind: 'imagen', provider: 'drive', ext: null };
  // tour360 solo si el HOST es un proveedor de recorridos: `embed` son enlaces de
  // terceros. Nunca sobre la ruta, o un /uploads/panorama-miel.webp propio iría a <iframe>.
  if (/(matterport|kuula|360|pano|tourmkr)/.test(host)) return { kind: 'tour360', provider: 'otro', ext: null };
  const path = url.split(/[?#]/)[0];
  const ext = EXT_VIDEO.test(path) ? 'video' : EXT_IMAGEN.test(path) ? 'imagen' : null;
  return { kind: ext === 'video' ? 'video' : 'imagen', provider: 'strapi', ext };
}

const TIPO_VIEJO: Record<string, MediaKind> = {
  imagen: 'imagen', image: 'imagen', video: 'video', '360': 'tour360', tour360: 'tour360', tour: 'tour360',
};

/**
 * Hosts de terceros que SÍ son contenido legítimo del sitio (video y recorridos). Cerrada y
 * anclada con frontera de dominio: la versión anterior era `(360|pano)` sin anclar, así que
 * cualquier tercero cuyo nombre llevara ese trozo pasaba por proveedor (`fotos-panoramicas-360.com`
 * se pintaba como tour propio) y `notyoutube.com` se clasificaba como YouTube. `classify()` sigue
 * razonando por parecido porque ya no le llega nada que no esté en esta lista: aflojar o anclar
 * ahí no cambia una sola salida (medido con mutante el 2026-09-27).
 */
const HOST_EMBED = /(^|\.)(youtu\.be|youtube\.com|youtube-nocookie\.com|vimeo\.com|drive\.google\.com|matterport\.com|kuula\.co|tourmkr\.com|momento360\.com)$/i;

/**
 * ¿Esta URL se puede pintar? Se puede cuando es nuestra (relativa o alguna de las
 * maneras de decir este sitio) o cuando es un proveedor de video/recorrido conocido.
 *
 * Lo que NO pasa: el hotlink de imagen de un tercero. Medido otra vez el 2026-09-27 con esta
 * misma regla sobre la BD viva: **10 celdas con 15 URLs** de `images.unsplash.com` en 6 columnas
 * (`anfitriones.foto_perfil_url|foto_territorio|video_thumbnail`,
 * `experiencias.imagen_hero_url|galeria_urls|mapa_imagen_url`); dos son el retrato de stock de dos
 * anfitriones con nombre y apellido reales, presentados como su cara. Y no solo mienten:
 * el archivo está fuera del control del dueño del contenido, así que un día deja de servir. La
 * decisión aprobada fue «Strapi único dueño, sin hotlinks de imagen», y vaciar esas celdas es la
 * puerta **G4** del dueño (un `UPDATE`), no algo que este reductor pueda hacer.
 *
 * Su límite, también medido: la regla frena la imagen de tercero, pero **no** al placeholder que
 * vive en un host de embed permitido. Son 5 celdas con 6 ocurrencias de dos URLs: el rickroll
 * (`youtube.com/watch?v=dQw4w9WgXcQ`) y la demo (`momento360.com/e/u/demo`) pasan y se sirven —enlace
 * de video y tour— en la ficha de `amanecer-en-el-bosque-de-niebla` y en la de `don-hernando-caficultor`. Distinguirlos por forma es imposible —un `watch?v=` legítimo
 * y la broma son el mismo string—, así que la única puerta es la data (G4).
 *
 * El filtro va en el reductor y no solo en `toMediaItem` porque hay superficies que
 * llaman a `mediaSrc()` directamente (`naturaleza` con `foto_territorio`, `cafe.ts`,
 * `heroes.ts`): puesta la regla aquí, no existe forma de pintarlas por descuido.
 */
export function esPintable(input: unknown): boolean {
  const raw = rawOf(input);
  if (!raw) return false;
  const u = safeUrl(raw);
  if (!u) return RELATIVA_DE_SITIO.test(raw); // relativa de sitio; `//host/x` no lo es
  return isSelfHost(u.hostname) || HOST_EMBED.test(u.hostname);
}

export function mediaSrc(input: unknown): string | null {
  const raw = rawOf(input);
  if (!raw) return null;
  if (!esPintable(raw)) return null;
  const u = safeUrl(raw);
  if (u && isSelfHost(u.hostname)) return u.pathname;
  return raw;
}

export function absUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, SITE_URL()).toString(); } catch { return null; }
}

/** Material de este sitio: relativa de sitio, o absoluta que apunta a este mismo equipo. */
function esPropia(url: string): boolean {
  const u = safeUrl(url);
  return !u || isSelfHost(u.hostname);
}

export function toMediaItem(input: unknown): MediaItem | null {
  const raw = rawOf(input);
  if (!raw) return null;
  const url = mediaSrc(raw);
  // Sin `!`: `mediaSrc` ya devolvió null para lo que no es pintable (ver `esPintable`), y
  // este es el camino por el que un hotlink de stock deja de ser un `MediaItem`.
  if (!url) return null;
  const clas = classify(url);

  let kind = clas.kind;
  let provider = clas.provider;
  let alt: string | undefined;
  let caption: string | undefined;

  if (input && typeof input === 'object') {
    const o = input as StrapiMedia & LegacyItem;
    if (o.mime && /^video\//.test(o.mime)) kind = 'video';
    // Lo heredado (`tipo`/`kind` de las formas históricas, `kind` con prioridad) re-etiqueta
    // material PROPIO y solo cuando el nombre del archivo no dice nada. `tour360` y lo de tercero
    // los decide el host en `classify()`: con `provider:'strapi'` y `kind:'tour360'`, `isEmbed()`
    // mentía y MediaGallery emitía `<iframe src="/uploads/pano.webp">`. Una extensión conocida es
    // un hecho sobre los bytes que la etiqueta a mano no contradice: medida hoy en la BD, `tipo`
    // solo aparece en el JSON de terceros (`image`/`video`/`360` sobre Unsplash, YouTube y
    // momento360) y en ningún material propio, así que no había testigo que justificara que un
    // `tipo:'imagen'` bajara un `.mp4` propio a `<img>`.
    const heredado = TIPO_VIEJO[o.kind] ?? TIPO_VIEJO[o.tipo];
    if (heredado && heredado !== 'tour360' && esPropia(url) && !clas.ext) kind = heredado;
    alt = o.alternativeText ?? o.alt ?? undefined;
    caption = o.caption ?? o.titulo ?? undefined;
  }

  return { url, kind, provider, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) };
}

/** Clave de dedupe: la misma pieza escrita de cualquier forma converge. */
function canonicalKey(url: string): string {
  const u = safeUrl(url);
  // Host + ruta: dedupe solo la MISMA pieza. Dos externos distintos que comparten
  // ruta (cdn-a.com/i.jpg y cdn-b.com/i.jpg) son dos activos, no un duplicado.
  // Las URLs propias ya llegan reducidas a pathname por mediaSrc(), así que siguen cayendo
  // en la misma clave entre las tres formas de escribirlas.
  return (u ? `${u.hostname}${u.pathname}` : url).toLowerCase();
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
