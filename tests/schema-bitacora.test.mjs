import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogDeBitacora, founderPersona, organizacionMadre, referenciaMadre, webSiteSchema } from '../src/lib/schema-bitacora.ts';

const fila = (slug, extras = {}) => ({ slug, titulo: `Título de ${slug}`, ...extras });

test('blogDeBitacora: null cuando la marca no tiene artículos publicados', () => {
  assert.equal(blogDeBitacora({ brand: 'cafe', nombre: 'Café de Origen', articulos: [] }), null);
});

test('blogDeBitacora: un BlogPosting por artículo, con URL absoluta y su fecha', () => {
  const blog = blogDeBitacora({
    brand: 'granja',
    nombre: 'Iwagé Granja',
    descripcion: 'Diario del sistema',
    articulos: [
      fila('granja-peri-urbana', { fecha: '2026-07-25T10:00:00.000Z' }),
      fila('agua', { updatedAt: '2026-06-01T10:00:00.000Z' }),
    ],
  });

  assert.deepEqual(blog['@type'], ['Blog', 'ItemList']);
  assert.equal(blog.numberOfItems, 2);
  assert.deepEqual(
    blog.blogPost.map((p) => p.url),
    [
      'https://iwage.co/granja/bitacora/granja-peri-urbana',
      'https://iwage.co/granja/bitacora/agua',
    ],
  );
  assert.deepEqual(
    blog.blogPost.map((p) => p.datePublished),
    ['2026-07-25T10:00:00.000Z', '2026-06-01T10:00:00.000Z'],
  );
  assert.deepEqual(blog.blogPost.map((p) => p['@type']), ['BlogPosting', 'BlogPosting']);
});

test('blogDeBitacora: descarta las filas sin slug y no inventa URLs con undefined', () => {
  const blog = blogDeBitacora({
    brand: 'meliponas',
    nombre: 'Meliponario',
    articulos: [fila('sin-slug-aca', { slug: undefined }), fila('polinizacion')],
  });

  assert.equal(blog.numberOfItems, 1);
  assert.equal(blog.blogPost[0].url, 'https://iwage.co/meliponas/bitacora/polinizacion');
});

test('blogDeBitacora: ancla el nodo a la organización de la marca y al sitio', () => {
  const blog = blogDeBitacora({
    brand: 'granja',
    nombre: 'Iwagé Granja',
    articulos: [fila('a', { fecha: '2026-01-02' })],
  });

  assert.equal(blog['@id'], 'https://iwage.co/granja/bitacora#blog');
  assert.equal(blog.publisher['@id'], 'https://iwage.co/granja/#organization');
  assert.equal(blog.isPartOf['@id'], 'https://iwage.co/#website');
  assert.equal(blog.inLanguage, 'es');
  // fecha suelta del corpus: sale como fecha ISO válida, no como texto arbitrario
  assert.equal(blog.blogPost[0].datePublished, '2026-01-02');
});

// El validador de grafo midió 12 referencias colgadas: parentOrganization, worksFor y
// publisher apuntan a https://iwage.co/#organization, que solo se declaraba en el hub.
test('organizacionMadre: la entidad que sostienen las referencias @id de las marcas', () => {
  const madre = organizacionMadre();
  assert.equal(madre['@type'], 'Organization');
  assert.equal(madre['@id'], 'https://iwage.co/#organization');
  assert.equal(madre.name, 'Iwagé Ecosistema');
  assert.equal(madre.url, 'https://iwage.co/');
});
test('webSiteSchema: un solo WebSite de iwage.co en español, publicado por la Organización madre', () => {
  const sitio = webSiteSchema();

  assert.equal(sitio['@type'], 'WebSite');
  assert.equal(sitio['@id'], 'https://iwage.co/#website');
  assert.equal(sitio.url, 'https://iwage.co/');
  assert.equal(sitio.inLanguage, 'es');
  assert.equal(sitio.publisher['@id'], 'https://iwage.co/#organization');
});

// El validador schema.org encontró la Organización madre declarada dos veces en la misma
// página y con `url` en conflicto ('https://iwage.co/' contra 'https://iwage.co'): el layout
// repetía el nodo dentro de parentOrganization. Desde acá solo sale la referencia.
test('referenciaMadre: las páginas de marca apuntan a la madre sin volver a declararla', () => {
  const ref = referenciaMadre();

  assert.deepEqual(Object.keys(ref), ['@id']);
  assert.equal(ref['@id'], organizacionMadre()['@id']);
});

// Las dos declaraciones que quedaron en el repo no decían lo mismo: la de `index.astro`
// traía descripción, fundador y dirección; la del módulo, no. Una sola fuente de verdad.
// El mismo `@id` del fundador se declaraba dos veces con `knowsAbout` distintos (6 en el
// layout de marca, 8 en la home). Sale del módulo con una sola lista.
test('founderPersona: un solo Person para el fundador, con su contexto y sus materias', () => {
  const p = founderPersona();

  assert.equal(p['@context'], 'https://schema.org');
  assert.equal(p['@type'], 'Person');
  assert.equal(p['@id'], 'https://iwage.co/#founder');
  assert.equal(p.name, 'Manuel Camilo Saldarriaga Acosta');
  assert.equal(p.url, 'https://camilosaldarriaga.com');
  assert.equal(p.jobTitle, 'Fundador');
  assert.equal(p.worksFor['@id'], 'https://iwage.co/#organization');
  assert.equal(p.knowsAbout.length, 8);
});

test('organizacionMadre: la misma identidad en todas las páginas que la declaran', () => {
  const madre = organizacionMadre();

  assert.equal(madre.description, 'Ecosistema de desarrollo rural en el Tolima, Colombia');
  assert.equal(madre.founder['@id'], 'https://iwage.co/#founder');
  assert.equal(madre.address.addressLocality, 'Ibagué');
  assert.equal(madre.address.addressRegion, 'Tolima');
  assert.equal(madre.address.addressCountry, 'CO');
});
