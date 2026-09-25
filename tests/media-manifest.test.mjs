/**
 * Parte pura del importador: qué tapa se enlaza a qué registro y qué queda pendiente.
 * Se testea aquí porque es la única decisión que no puede revertirse después:
 * un enlace equivocado en la BD se ve en el sitio.
 *
 * Los tres primeros testes son los de la brief (task-10-brief.md, Step 1) y sus
 * aserciones no se aflojan. Los cinco siguientes cubren las dos contradicciones
 * internas de la brief resueltas en el módulo (ver el header de
 * strapi/scripts/lib/media-manifest.mjs):
 *   · `campo` lo deriva la tabla por endpoint (y un valor explícito manda),
 *   · separar emparejar de reclamar hace que la razón de ambigüedad exista.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifesto } from '../strapi/scripts/lib/media-manifest.mjs';

const tapas = [
  'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  'public/images/bitacora/granja-el-cercado-de-piedra.webp',
];

test('asocia cada tapa de bitácora con su artículo por slug', () => {
  const m = manifesto({
    archivos: tapas,
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', marca: 'meliponas' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'el-cercado-de-piedra', marca: 'granja' },
    ],
  });
  assert.equal(m.enlazar.length, 2);
  assert.deepEqual(m.enlazar[0], {
    endpoint: 'bitacoras', documentId: 'd1', campo: 'imagen',
    archivo: 'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  });
});

test('un archivo sin registro equivalente no se sube: queda en pendientes', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/meliponas-huerfana.webp'],
    registros: [],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.pendientes, ['public/images/bitacora/meliponas-huerfana.webp']);
});

test('dos registros que reclaman la misma tapa: gana el slug más largo y el otro queda pendiente', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/la-miel.webp'],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'miel' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].documentId, 'd1');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [{ slug: 'miel', documentId: 'd2', motivo: 'la tapa ya está asignada a la-miel' }]);
});

// --- resolución 1: de dónde sale `campo` -----------------------------------

test('campo: lo deriva la tabla por endpoint si el registro no lo trae; uno explícito manda', () => {
  const m = manifesto({
    archivos: [
      'public/images/cafe-menu/proveedor-cacao-espinal.webp',
      'public/images/bitacora/bitacora-la-caja-de-angelita.webp',
    ],
    registros: [
      { endpoint: 'proveedors', documentId: 'p1', slug: 'cacao-espinal' },
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', campo: 'portada' },
    ],
  });
  // 'foto' es el campo real de proveedor (strapi/src/api/proveedor/.../schema.json),
  // y el orden de salida es el de los registros de entrada, no el de reclamo.
  assert.deepEqual(m.enlazar.map((e) => `${e.documentId}:${e.campo}`), ['p1:foto', 'd1:portada']);
  assert.deepEqual(m.ambiguos, []);
});

// --- resolución 2: emparejar y reclamar son pasos separados -----------------

test('con el nombre real de las tapas (bitacora-<slug>) también se nombra al slug que ganó', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/bitacora-miel-chef.webp'],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'miel-chef' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'chef' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].archivo, 'public/images/bitacora/bitacora-miel-chef.webp');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [
    { slug: 'chef', documentId: 'd2', motivo: 'la tapa ya está asignada a miel-chef' },
  ]);
});

test('una coincidencia que no es del namespace del endpoint se enlaza marcada, nunca en silencio', () => {
  const m = manifesto({
    archivos: ['public/images/cafe-menu/proveedor-meliponario.webp'],
    registros: [{ endpoint: 'item-menus', documentId: 'm1', slug: 'meliponario' }],
  });
  assert.equal(m.enlazar.length, 1);
  assert.deepEqual(m.ambiguos, [
    {
      slug: 'meliponario', documentId: 'm1',
      motivo: 'coincidencia solo por sufijo: public/images/cafe-menu/proveedor-meliponario.webp',
    },
  ]);
  assert.deepEqual(m.pendientes, []);
});

test('entre el .webp y su gemelo .png gana el .webp; el gemelo queda en pendientes, no se pierde', () => {
  const m = manifesto({
    archivos: [
      'public/images/cafe-menu/aromatica-flora-nativa.png',
      'public/images/cafe-menu/aromatica-flora-nativa.webp',
    ],
    registros: [{ endpoint: 'item-menus', documentId: 'i1', slug: 'aromatica-flora-nativa' }],
  });
  assert.equal(m.enlazar[0].archivo, 'public/images/cafe-menu/aromatica-flora-nativa.webp');
  assert.deepEqual(m.pendientes, ['public/images/cafe-menu/aromatica-flora-nativa.png']);
});

test('dos tapas distintas para un mismo slug: gana la del namespace propio y la otra se reporta', () => {
  const m = manifesto({
    archivos: [
      'public/images/bitacora/bitacora-miel.webp',
      'public/images/bitacora/cosecha-miel.webp',
    ],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'miel' }],
  });
  assert.equal(m.enlazar[0].archivo, 'public/images/bitacora/bitacora-miel.webp');
  assert.deepEqual(m.ambiguos, [
    { slug: 'miel', documentId: 'd1', motivo: 'descartada por ambigüedad: public/images/bitacora/cosecha-miel.webp' },
  ]);
});
