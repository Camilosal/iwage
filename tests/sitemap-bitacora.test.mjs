import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indicesDeBitacora, STATIC_PAGES } from '../src/lib/sitemap-bitacora.ts';

const fila = (slug, marca, updatedAt) => ({ slug, marca, updatedAt });

test('indicesDeBitacora: una URL por marca con filas, ninguna para las marcas sin contenido', () => {
  const urls = indicesDeBitacora([
    fila('g1', 'granja', '2026-07-25T10:00:00.000Z'),
    fila('g2', 'granja', '2026-07-16T10:00:00.000Z'),
    fila('m1', 'meliponas', '2026-06-02T10:00:00.000Z'),
    fila('x1', 'sostenty', '2026-06-02T10:00:00.000Z'),
    fila('n1', undefined, '2026-06-02T10:00:00.000Z'),
  ]);

  assert.deepEqual(
    urls.map((u) => u.loc).sort(),
    ['/granja/bitacora', '/meliponas/bitacora'],
  );
});

test('indicesDeBitacora: el lastmod es el updatedAt más reciente de esa marca, en fecha suelta', () => {
  const urls = indicesDeBitacora([
    fila('g-vieja', 'granja', '2026-05-01T23:00:00.000Z'),
    fila('g-nueva', 'granja', '2026-09-24T08:30:00.000Z'),
    fila('g-sin-fecha', 'granja', undefined),
    fila('m1', 'meliponas', '2026-06-02T10:00:00.000Z'),
  ]);

  const granja = urls.find((u) => u.loc === '/granja/bitacora');
  const meliponas = urls.find((u) => u.loc === '/meliponas/bitacora');
  assert.equal(granja.lastmod, '2026-09-24');
  assert.equal(meliponas.lastmod, '2026-06-02');
});

test('indicesDeBitacora: conserva priority y changefreq que tenía el índice cuando era estático', () => {
  const [unica] = indicesDeBitacora([fila('g1', 'granja', '2026-07-25T10:00:00.000Z')]);
  assert.equal(unica.priority, 0.8);
  assert.equal(unica.changefreq, 'daily');
});

test('los índices de bitácora ya no viven en STATIC_PAGES: si volvieran, la dedup conservaría la entrada sin lastmod', () => {
  const rutasEstaticas = STATIC_PAGES.map(([path]) => path);
  const indices = rutasEstaticas.filter((p) => /^\/[a-z]+\/bitacora$/.test(p));
  assert.deepEqual(indices, []);
});

test('STATIC_PAGES no envía al sitemap ninguna ruta que el sitio sirve con noindex', () => {
  // Medido en el origen 2026-09-24: src/pages/legal/_layout.astro declara
  // `noindex, follow` en las 5 hojas, pero las 6 seguían declaradas en el sitemap.
  const noindexServidas = [
    '/legal/terminos-y-condiciones',
    '/legal/tratamiento-de-datos',
    '/legal/cookies',
    '/legal/cancelaciones-y-reembolsos',
    '/legal/devoluciones-y-retracto',
  ];
  const rutasEstaticas = STATIC_PAGES.map(([path]) => path);
  assert.deepEqual(rutasEstaticas.filter((p) => noindexServidas.includes(p)), []);
});
