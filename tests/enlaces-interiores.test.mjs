import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarSlug, repararEnlaceInterno } from '../src/lib/enlaces-interiores.ts';

// Registro de prueba con la forma real de los slugs de Strapi tras la
// migración WP (algunos conservan el `c2-b7` literal del `·` en el slug).
const REGISTRO = {
  bitacoras: [
    { slug: 'modulo-3-c2-b7-el-nido-por-dentro', marca: 'meliponas' },
    { slug: 'modulo-5-c2-b7-manejo-y-revision-periodica', marca: 'meliponas' },
    { slug: 'resultados-polinizacion-aguacate-hass', marca: 'meliponas' },
    { slug: 'cafe-agroecologico-iwage', marca: 'cafe' },
    { slug: 'siembra-de-cobertura-en-terrazas', marca: 'tierras' },
  ],
  productos: [
    { slug: 'miel-angelita-120ml-frasco', marca: 'meliponas' },
    { slug: 'miel-con-propoleo-250ml', marca: 'meliponas' },
    { slug: 'kit-observacion', marca: 'meliponas' },
    { slug: 'cafe-grano-selva-340g', marca: 'cafe' },
  ],
};

test('normalizarSlug: decodifica, sin acentos, mata el c2-b7 literal y el ·', () => {
  assert.equal(normalizarSlug('Módulo%205%20·%20Manejo'), 'modulo-5-manejo');
  assert.equal(normalizarSlug('modulo-5-c2-b7-manejo-y-revision'), 'modulo-5-manejo-y-revision');
  assert.equal(normalizarSlug('MODULO-5-C2-B7-Manejo'), 'modulo-5-manejo');
  assert.equal(normalizarSlug('  Polinización   en Águacate!!  '), 'polinizacion-en-aguacate');
});

test('/producto/<slug> con producto ambiguo pero ganador estricto → balde de la marca del producto', () => {
  assert.equal(
    repararEnlaceInterno('/producto/miel-abeja-angelita', REGISTRO, 'meliponas'),
    '/meliponas/tienda/miel-angelita-120ml-frasco',
  );
  // El enlace vive en una página de café, pero el producto es de meliponas.
  assert.equal(
    repararEnlaceInterno('/producto/miel angelita 120ml', REGISTRO, 'cafe'),
    '/meliponas/tienda/miel-angelita-120ml-frasco',
  );
});

test('/producto/<slug> sin ganador → la tienda de la marca que renderiza', () => {
  assert.equal(repararEnlaceInterno('/producto/caja-abejas-meliponas', REGISTRO, 'meliponas'), '/meliponas/tienda');
  assert.equal(repararEnlaceInterno('/producto/panal-de-cera', REGISTRO, 'granja'), '/granja/tienda');
});

test('cross-link de raíz: sin prefijo p-, con stopword, con %c2%b7 y con el c2-b7 del slug', () => {
  assert.equal(
    repararEnlaceInterno('/modulo-5-manejo-revision-periodica', REGISTRO, 'meliponas'),
    '/meliponas/bitacora/modulo-5-c2-b7-manejo-y-revision-periodica',
  );
  assert.equal(
    repararEnlaceInterno('/p-cafe-agroecologico-iwage', REGISTRO, 'meliponas'),
    '/cafe/bitacora/cafe-agroecologico-iwage',
  );
  assert.equal(
    repararEnlaceInterno('/polinizacion-en-aguacate-hass', REGISTRO, 'meliponas'),
    '/meliponas/bitacora/resultados-polinizacion-aguacate-hass',
  );
  assert.equal(
    repararEnlaceInterno('/Modulo%203%20%C2%B7%20el%20nido%20por%20dentro', REGISTRO, 'cafe'),
    '/meliponas/bitacora/modulo-3-c2-b7-el-nido-por-dentro',
  );
});

test('cross-link de raíz no reproducible → índice de bitácora de la marca actual, nunca 404', () => {
  assert.equal(
    repararEnlaceInterno('/articulo-borrado-de-wordpress', REGISTRO, 'meliponas'),
    '/meliponas/bitacora',
  );
});

test('/contacto genérico → el contacto de la marca que renderiza', () => {
  assert.equal(repararEnlaceInterno('/contacto', REGISTRO, 'meliponas'), '/meliponas/contacto');
  assert.equal(repararEnlaceInterno('/contacto?utm=1', REGISTRO, 'cafe'), '/cafe/contacto');
});

test('barra final de la migración WP: repara igual que sin barra', () => {
  assert.equal(
    repararEnlaceInterno('/producto/miel-abeja-angelita/', REGISTRO, 'meliponas'),
    '/meliponas/tienda/miel-angelita-120ml-frasco',
  );
  assert.equal(
    repararEnlaceInterno('/p-cafe-agroecologico-iwage/', REGISTRO, 'meliponas'),
    '/cafe/bitacora/cafe-agroecologico-iwage',
  );
  assert.equal(repararEnlaceInterno('/contacto/', REGISTRO, 'tierras'), '/tierras/contacto');
  assert.equal(repararEnlaceInterno('/modulo-5-manejo-revision-periodica/', REGISTRO, 'meliponas'),
    '/meliponas/bitacora/modulo-5-c2-b7-manejo-y-revision-periodica');
});

test('deja intactos los enlaces que no son de la migración', () => {
  const noToca = [
    'https://iwage.co/algo',
    '//cdn.example.com/x',
    '#seccion',
    '',
    '/',
    '/meliponas/',
    '/meliponas/tienda/miel-angelita-120ml-frasco',
    '/cafe/menu',
    '/ayuda/',
    '/granja/sistema/hidrico',
    '/api/contacto',
  ];
  for (const href of noToca) {
    assert.equal(repararEnlaceInterno(href, REGISTRO, 'meliponas'), null, `debía quedar intacto: ${href}`);
  }
});

test('registro vacío: ningún enlace de marca se rompe en el render', () => {
  const vacio = { bitacoras: [], productos: [] };
  assert.equal(repararEnlaceInterno('/modulo-3-el-nido', vacio, 'meliponas'), '/meliponas/bitacora');
  assert.equal(repararEnlaceInterno('/producto/miel', vacio, 'granja'), '/granja/tienda');
  assert.equal(repararEnlaceInterno('/cafe/menu', vacio, 'granja'), null);
});
