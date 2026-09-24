/**
 * Conteos y catálogo de /llms.txt: el archivo presume de cifras (propiedades,
 * publicaciones, URLs del sitemap) que cambian solos, y hasta ahora no nombraba
 * ni una sola publicación. Aquí viven los marcadores y la sección que se arma con
 * las filas publicadas de Strapi --sin texto nuevo: título y slug ya existen—.
 */
export interface ConteosLlms {
  propiedades: number;
  publicaciones: number;
  urls: number;
  bitacora: string;
}

export interface PublicacionLlms {
  marca?: string;
  slug?: string;
  titulo?: string;
}

const SITIO = 'https://iwage.co';

const SIN_PUBLICACIONES = ['## Bitácora', '', '- 0 publicaciones: la lista vive en /sitemap.xml'].join('\n');

/**
 * Catálogo absoluto de la bitácora, agrupado por marca y de mayor a menor
 * contenido. Un crawler de IA que lee este archivo no tiene que descubrir los
 * artículos por el sitemap.
 */
export function seccionBitacora(entradas: PublicacionLlms[]): string {
  const validas = entradas.filter((e) => e.marca && e.slug);
  if (validas.length === 0) return SIN_PUBLICACIONES;

  const porMarca = new Map<string, PublicacionLlms[]>();
  for (const e of validas) {
    const lista = porMarca.get(e.marca!) ?? [];
    lista.push(e);
    porMarca.set(e.marca!, lista);
  }

  const marcas = [...porMarca.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  const lineas: string[] = ['## Bitácora', ''];
  for (const [marca, lista] of marcas) {
    lineas.push(`### ${marca} — ${lista.length} ${lista.length === 1 ? 'publicación' : 'publicaciones'}`);
    lineas.push(`Índice: ${SITIO}/${marca}/bitacora`);
    for (const e of lista) {
      // El título va en una sola línea: es un archivo que se lee por línea.
      const titulo = (e.titulo ?? '').replace(/\s+/g, ' ').trim();
      lineas.push(`- ${SITIO}/${marca}/bitacora/${e.slug}${titulo ? ` — ${titulo}` : ''}`);
    }
    lineas.push('');
  }
  return lineas.join('\n').trimEnd();
}

export function aplicarConteos(plantilla: string, c: Partial<ConteosLlms>): string {
  return plantilla
    .replace(/\{\{PROPIEDADES\}\}/g, String(c.propiedades ?? 0))
    .replace(/\{\{PUBLICACIONES\}\}/g, String(c.publicaciones ?? 0))
    .replace(/\{\{URLS\}\}/g, String(c.urls ?? 0))
    .replace(/\{\{BITACORA\}\}/g, c.bitacora ?? '');
}
