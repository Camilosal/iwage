import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rutaDeLaMarcaDelArticulo } from '../src/lib/bitacora-ruta.ts';

// Medido en el origen 2026-09-24: /cafe/bitacora/<slug de granja> respondía 200,
// `index, follow`, con canónica a sí mismo y un Article cuyo publisher era la
// Organización equivocada. Las 6 rutas de artículo aceptan cualquier slug.

test('la marca de la ruta no es la del artículo: se devuelve la ruta correcta', () => {
  assert.equal(
    rutaDeLaMarcaDelArticulo({ marcaRuta: 'cafe', marcaArticulo: 'granja', slug: 'agroecosistema-productivo' }),
    '/granja/bitacora/agroecosistema-productivo'
  );
});

test('la marca de la ruta es la del artículo: no hay nada que redirigir', () => {
  assert.equal(
    rutaDeLaMarcaDelArticulo({ marcaRuta: 'granja', marcaArticulo: 'granja', slug: 'agroecosistema-productivo' }),
    null
  );
});

test('marca del artículo desconocida o ausente: no se redirige a una ruta que no existe', () => {
  const base = { marcaRuta: 'cafe', slug: 'x' };
  assert.equal(rutaDeLaMarcaDelArticulo({ ...base, marcaArticulo: 'meliponario' }), null);
  assert.equal(rutaDeLaMarcaDelArticulo({ ...base, marcaArticulo: null }), null);
  assert.equal(rutaDeLaMarcaDelArticulo({ ...base, marcaArticulo: undefined }), null);
});
