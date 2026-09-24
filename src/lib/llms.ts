/**
 * Conteos de /llms.txt: el archivo presume de cifras (propiedades, publicaciones,
 * URLs del sitemap) que cambian solos. Aquí viven como marcadores y se sustituyen
 * con lo que reporta Strapi en cada construcción.
 */
export interface ConteosLlms {
  propiedades: number;
  publicaciones: number;
  urls: number;
}

export function aplicarConteos(plantilla: string, c: Partial<ConteosLlms>): string {
  return plantilla
    .replace(/\{\{PROPIEDADES\}\}/g, String(c.propiedades ?? 0))
    .replace(/\{\{PUBLICACIONES\}\}/g, String(c.publicaciones ?? 0))
    .replace(/\{\{URLS\}\}/g, String(c.urls ?? 0));
}
