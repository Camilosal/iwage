import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noindexDeIndice } from '../src/lib/bitacora-noindex.ts';

// El bug: un blip de Strapi devuelve { data: [] } y el índice decidía el robots solo
// con la longitud, así que /meliponas/bitacora --con 37 artículos-- quedaba
// respondiendo 200 con `noindex, follow` durante los 120 s que tarda nginx en expirar.

test('noindexDeIndice: la marca de verdad vacía sí se marca noindex', () => {
  assert.equal(noindexDeIndice({ total: 0, fallo: false }), true);
});

test('noindexDeIndice: un blip de Strapi no convierte un índice en noindex', () => {
  assert.equal(noindexDeIndice({ total: 0, fallo: true }), false);
});

test('noindexDeIndice: con contenido nunca va noindex, haya o no fallo', () => {
  assert.equal(noindexDeIndice({ total: 19, fallo: false }), false);
  assert.equal(noindexDeIndice({ total: 19, fallo: true }), false);
});

test('noindexDeIndice: sin el dato del fallo se conserva la conducta vieja', () => {
  assert.equal(noindexDeIndice({ total: 0 }), true);
  assert.equal(noindexDeIndice({ total: 5 }), false);
});
