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

/**
 * La Organización madre. Las páginas de marca referencian su `@id` en
 * `parentOrganization`, `worksFor` y en el `publisher` del WebSite, pero solo el hub
 * la declaraba: el validador de grafo midió 12 referencias colgadas.
 */
export function organizacionMadre(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITIO}/#organization`,
    name: 'Iwagé Ecosistema',
    url: `${SITIO}/`,
    description: 'Ecosistema de desarrollo rural en el Tolima, Colombia',
    founder: { '@id': `${SITIO}/#founder` },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Ibagué',
      addressRegion: 'Tolima',
      addressCountry: 'CO',
    },
  };
}

/** El fundador es una sola entidad en todo el sitio: `knowsAbout` era distinto en la home
 *  (8 materias) y en el layout de marca (6). */
export function founderPersona(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITIO}/#founder`,
    name: 'Manuel Camilo Saldarriaga Acosta',
    url: 'https://camilosaldarriaga.com',
    sameAs: [
      'https://camilosaldarriaga.com',
      'https://www.linkedin.com/in/camilosaldarriaga',
      SITIO,
    ],
    jobTitle: 'Fundador',
    worksFor: { '@id': `${SITIO}/#organization` },
    knowsAbout: [
      'Meliponicultura', 'Desarrollo rural', 'Turismo regenerativo',
      'Café de especialidad', 'Inmobiliaria rural', 'Property management',
      'Tetragonisca angustula', 'Corredor Ambalá',
    ],
  };
}

/** La referencia, sin repetir la entidad: dos declaraciones del mismo `@id` con `url`
 *  distinto hacen que el fusor JSON-LD elija una al azar. */
export function referenciaMadre(): Record<string, unknown> {
  return { '@id': `${SITIO}/#organization` };
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
    '@type': ['Blog', 'ItemList'],
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
