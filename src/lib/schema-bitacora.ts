/**
 * Nodos de esquema (schema.org) que el layout no puede deducir solos.
 *
 * Puro a propósito: sin fetch y sin imports de `@/lib/strapi`, para que `node --test`
 * pueda cargarlo y dejar el contrato del grafo de entidades codificado en los tests.
 */

const SITIO = 'https://iwage.co';

export interface FilaDeBlog {
  slug?: string;
  titulo?: string;
  fecha?: string;
  updatedAt?: string;
}

export interface OpcionesBlog {
  brand: string;
  nombre: string;
  descripcion?: string;
  articulos: FilaDeBlog[];
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITIO}/#website`,
    url: `${SITIO}/`,
    name: 'Iwagé — Ecosistema de Desarrollo Rural',
    description: 'Seis líneas de acción rurales en el corredor Ambalá, Ibagué: meliponicultura, café, tierra, turismo, gestión y granja.',
    inLanguage: 'es',
    publisher: { '@id': `${SITIO}/#organization` },
  };
}

/**
 * `null` con la marca vacía: un índice sin publicaciones no debe declararse Blog,
 * es el mismo criterio que el `noindex` de la fase 3.
 */
export function blogDeBitacora({ brand, nombre, descripcion, articulos }: OpcionesBlog): Record<string, unknown> | null {
  const filas = articulos.filter((a) => Boolean(a.slug));
  if (filas.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITIO}/${brand}/bitacora#blog`,
    name: `Bitácora · ${nombre}`,
    ...(descripcion ? { description: descripcion } : {}),
    url: `${SITIO}/${brand}/bitacora`,
    inLanguage: 'es',
    isPartOf: { '@id': `${SITIO}/#website` },
    publisher: { '@id': `${SITIO}/${brand}/#organization` },
    numberOfItems: filas.length,
    blogPost: filas.map((a) => {
      const fecha = a.fecha || a.updatedAt;
      return {
        '@type': 'BlogPosting',
        headline: a.titulo || a.slug,
        url: `${SITIO}/${brand}/bitacora/${a.slug}`,
        ...(fecha ? { datePublished: fecha } : {}),
        author: { '@id': `${SITIO}/#founder` },
      };
    }),
  };
}
