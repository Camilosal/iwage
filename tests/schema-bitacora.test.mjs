import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogDeBitacora, organizacionMadre, webSiteSchema } from '../src/lib/schema-bitacora.ts';

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

  assert.equal(blog['@type'], 'Blog');
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
