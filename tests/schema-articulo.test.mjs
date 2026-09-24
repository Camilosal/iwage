import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articuloSchema } from '../src/lib/schema-bitacora.ts';

const URL_ARTICULO = 'https://iwage.co/granja/bitacora/agua';
const OG = 'https://iwage.co/images/hero-granja.webp';

const meta = (extras = {}) => ({
  title: 'Cómo dimensionamos el tanque de agua',
  description: 'Cálculo del tanque para el ciclo seco de 240 días.',
  datePublished: '2026-07-25',
  dateModified: '2026-09-02',
  author: 'Manuel Camilo Saldarriaga Acosta',
  authorPlace: 'Ibagué',
  section: 'Agua',
  keywords: ['cosecha de agua', 'tanque'],
  wordCount: 1420,
  ...extras,
});

const nodo = (overrides = {}) =>
  articuloSchema({ brand: 'granja', url: URL_ARTICULO, imagen: OG, article: meta(), ...overrides });

test('articuloSchema: declara los seis campos que pide el goal, más el tipo y el idioma', () => {
  const a = nodo();

  assert.equal(a['@type'], 'Article');
  assert.equal(a.headline, 'Cómo dimensionamos el tanque de agua');
  assert.equal(a.datePublished, '2026-07-25');
  assert.equal(a.dateModified, '2026-09-02');
  assert.equal(a.author.name, 'Manuel Camilo Saldarriaga Acosta');
  assert.equal(a.publisher['@id'], 'https://iwage.co/granja/#organization');
  assert.equal(a.mainEntityOfPage, URL_ARTICULO);
  assert.equal(a.inLanguage, 'es-CO');
  assert.ok(Array.isArray(a.about) && a.about.length > 0, 'about debe ir en el nodo');
});

test('articuloSchema: about sale de la sección y las keywords, deduplicado y como DefinedTerm', () => {
  const a = articuloSchema({
    brand: 'granja',
    url: URL_ARTICULO,
    imagen: OG,
    article: meta({ section: 'Agua', keywords: ['cosecha de agua', 'Agua', 'tanque', ''] }),
  });

  assert.deepEqual(
    a.about.map((t) => t.name),
    ['Agua', 'cosecha de agua', 'tanque'],
  );
  for (const termino of a.about) {
    assert.equal(termino['@type'], 'DefinedTerm');
    assert.equal(typeof termino.name, 'string');
  }
});

test('articuloSchema: about se corta en 8 términos para no inflar el nodo', () => {
  const a = articuloSchema({
    brand: 'granja',
    url: URL_ARTICULO,
    imagen: OG,
    article: meta({ keywords: Array.from({ length: 12 }, (_, i) => `kw ${i}`) }),
  });

  assert.equal(a.about.length, 8);
});

test('articuloSchema: sin sección ni keywords el nodo no emite about vacío', () => {
  const a = articuloSchema({
    brand: 'cafe',
    url: 'https://iwage.co/cafe/bitacora/v60',
    imagen: OG,
    article: meta({ section: undefined, keywords: [] }),
  });

  assert.equal('about' in a, false);
});

test('articuloSchema: la imagen de la fila manda; si no tiene, cae en la del layout', () => {
  const conImagen = articuloSchema({
    brand: 'granja',
    url: URL_ARTICULO,
    imagen: OG,
    article: meta({ image: 'https://iwage.co/images/tanque.webp' }),
  });
  const sinImagen = nodo({ article: meta({ image: undefined }) });

  assert.equal(conImagen.image, 'https://iwage.co/images/tanque.webp');
  assert.equal(sinImagen.image, OG);
});

test('articuloSchema: dateModified no se inventa cuando la fila no lo trae', () => {
  const a = articuloSchema({
    brand: 'granja',
    url: URL_ARTICULO,
    imagen: OG,
    article: meta({ dateModified: undefined }),
  });

  assert.equal('dateModified' in a, false);
  assert.equal(a.datePublished, '2026-07-25');
});

test('articuloSchema: el autor sin nombre explícito queda igual que el fundador declarado', () => {
  const a = articuloSchema({
    brand: 'granja',
    url: URL_ARTICULO,
    imagen: OG,
    article: meta({ author: undefined, authorPlace: undefined }),
  });

  assert.equal(a.author['@type'], 'Person');
  assert.equal(a.author.name, 'Manuel Camilo Saldarriaga Acosta');
  assert.equal(a.author.url, 'https://camilosaldarriaga.com');
  assert.equal('address' in a.author, false);
});
