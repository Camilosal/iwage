/**
 * Reparación de enlaces internos en el cuerpo renderizado de los contenidos
 * (bitácoras, productos, experimentos). Medido el 2026-10-04 sobre las 180 URLs
 * servidas: ~25 enlaces del markdown heredado de la migración WP apuntan a
 * rutas que no existen — `/producto/<slug>` (la tienda vive en
 * `/meliponas/tienda` y `/granja/tienda`) y cross-links de artículo a artículo
 * en la raíz (`/modulo-3-el-nido-por-dentro`, en vez de
 * `/meliponas/bitacora/modulo-3-c2-b7-el-nido-por-dentro`). Todos devolvían 404.
 *
 * La reparación ocurre en el render, no en la base de datos: Strapi sigue
 * siendo el único dueño del contenido y el texto no se toca.
 *
 * Este arquivo es puro a propósito (solo `node:` nada, ni fetch ni Redis):
 * `tests/enlaces-interiores.test.mjs` lo carga sin levantar el mundo. La
 * construcción del registro vive en `enlaces-registro.ts`.
 */

export interface RegistroEnlaces {
  /** Slugs CANÓNICOS de bitácora con su marca (los del sitio, no los del texto). */
  bitacoras: { slug: string; marca: string }[];
  /** Slugs de producto publicados; `marca` decide el balde de la tienda. */
  productos: { slug: string; marca: string }[];
}

/** Primeros segmentos que SÍ son rutas legítimas del sitio. */
const RUTAS_CONOCIDAS = new Set([
  'cafe', 'meliponas', 'tierras', 'naturaleza', 'granja', 'gestion',
  'ayuda', 'legal', 'contacto', 'api', 'uploads', 'sitemap.xml', 'sitemap-index.xml',
  'robots.txt', 'favicon.ico', 'favicon.svg', '_astro', 'p', 'well-known',
]);

const STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'un', 'una', 'que', 'con', 'por', 'para', 'a', 'lo', 'al', 'sus', 'su']);

/**
 * Normaliza un slug para comparar textos de origenes distintos:
 *  · decodifica `%c2%b7` (el `·` de la migración WP);
 *  · quita acentos;
 *  · elimina los literales `c2-b7`/`c2b7` que Strapi guarda INCRUSTADOS en el
 *    slug (`modulo-5-c2-b7-manejo…`) y que el autor del enlace no escribe;
 *  · colapsa no-alfanuméricos a guiones.
 */
export function normalizarSlug(input: string): string {
  let s = input;
  try { s = decodeURIComponent(s); } catch { /* secuencia de escape suelta: se deja tal cual */ }
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/·/g, '-').replace(/-?c2-?b7-?/gi, '-');
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function quitarStopwords(normalizado: string): string {
  return normalizado.split('-').filter((t) => t && !STOPWORDS.has(t)).join('-');
}

function tokens(s: string): Set<string> {
  return new Set(s.split('-').filter(Boolean));
}

function solapamiento(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function mejorCoincidencia(
  candidato: string,
  entries: { slug: string }[],
): string | null {
  const cn = normalizarSlug(candidato);
  const cCore = quitarStopwords(cn);
  const exacta = entries.find((e) => normalizarSlug(e.slug) === cn);
  if (exacta) return exacta.slug;
  if (cCore.length >= 12) {
    const contenidas = entries.filter((e) => {
      const en = quitarStopwords(normalizarSlug(e.slug));
      return en.includes(cCore) || cCore.includes(en);
    });
    if (contenidas.length === 1) return contenidas[0].slug;
  }
  return null;
}

/** Match de producto por token sharing: exige solape >= 2 y ganador ÚNICO. */
function resolverProducto(candidato: string, productos: RegistroEnlaces['productos']): string | null {
  const ct = tokens(quitarStopwords(normalizarSlug(candidato)));
  let mejor: string | null = null;
  let mejorN = 0;
  let segundoN = 0;
  for (const p of productos) {
    const n = solapamiento(ct, tokens(quitarStopwords(normalizarSlug(p.slug))));
    if (n > mejorN) { segundoN = mejorN; mejorN = n; mejor = p.slug; }
    else if (n > segundoN) segundoN = n;
  }
  return mejorN >= 2 && mejorN > segundoN ? mejor : null;
}

function baldeTienda(marca: string): string {
  return marca === 'granja' ? '/granja/tienda' : '/meliponas/tienda';
}

/**
 * Devuelve el href corregido, o `null` cuando el enlace no es reparable-o-no-requiere
 * corrección (se deja intacto). Solo toca enlaces internos absolutos (`/x`);
 * externos, anclas y protocolos raros salen intactos.
 */
export function repararEnlaceInterno(
  href: string,
  registro: RegistroEnlaces,
  marcaActual: string,
): string | null {
  if (!href || href[0] !== '/' || href.startsWith('//')) return null;
  // La migración WP escribe los enlaces con barra final (`/producto/x/`), y esa
  // barra es la que hacía que el enlace escapara a las reglas de abajo.
  const clean = href.split('?')[0].split('#')[0].replace(/\/+$/, '');
  if (!clean || clean === '/') return null;

  const seg = clean.slice(1).split('/');
  const primera = seg[0];

  // 1) /producto/<slug> → la ruta /producto no existe; la tienda es por marca.
  if (primera === 'producto' && seg.length === 2 && seg[1]) {
    const resuelto = resolverProducto(seg[1], registro.productos);
    if (resuelto) {
      const p = registro.productos.find((x) => x.slug === resuelto)!;
      return `${baldeTienda(p.marca)}/${resuelto}`;
    }
    return `${baldeTienda(marcaActual)}`;
  }

  // 2) Cross-link de raíz de un solo segmento: `/modulo-3-…`, `/p-cafe-…`.
  if (seg.length === 1 && primera === 'contacto') {
    // `/contacto` genérico responde 301; enlazarlo obligaba al usuario a un
    // viaje sin marca. Cada marca tiene su propio contacto.
    return `/${marcaActual}/contacto`;
  }
  if (seg.length === 1 && !RUTAS_CONOCIDAS.has(primera)) {
    const sinPrefijo = primera.startsWith('p-') ? primera.slice(2) : primera;
    const resuelto = mejorCoincidencia(sinPrefijo, registro.bitacoras);
    if (resuelto) {
      const b = registro.bitacoras.find((x) => x.slug === resuelto)!;
      return `/${b.marca}/bitacora/${resuelto}`;
    }
    // Irreparable: al índice de bitácora de la marca actual mejor que al 404.
    return `/${marcaActual}/bitacora`;
  }

  return null;
}
