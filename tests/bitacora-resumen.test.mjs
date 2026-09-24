import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filasAResumen, conteoDe } from '../src/lib/bitacora-resumen.ts';

const fila = (titulo, marca, fecha = '2026-09-01') => ({
  id: 0, documentId: titulo, titulo, slug: titulo, extracto: null, contenido: null,
  categoria: null, tiempo_lectura: null, imagen: null, fecha, marca, destacado: false,
  publicado: true, autor: null, etiquetas: null, fecha_actualizacion: null,
  meta_title: null, meta_description: null, subsistema: null,
  publishedAt: fecha, updatedAt: fecha,
});

test('filasAResumen: sin filas devuelve un resumen vacío, sin marcas fantasma', () => {
  assert.deepEqual(filasAResumen([]), { total: 0, porMarca: {}, recientes: [] });
});

test('filasAResumen: agrupa dos marcas, recorta por `porMarca` y respeta el orden de entrada', () => {
  const r = filasAResumen([
    fila('g1', 'granja'), fila('m1', 'meliponas'), fila('g2', 'granja'),
    fila('m2', 'meliponas'), fila('m3', 'meliponas'), fila('m4', 'meliponas'),
  ]);
  assert.equal(r.total, 6);
  assert.equal(r.porMarca.granja.count, 2);
  assert.equal(r.porMarca.meliponas.count, 4);
  assert.deepEqual(r.porMarca.meliponas.ultimas.map((f) => f.titulo), ['m1', 'm2', 'm3']);
  assert.deepEqual(r.recientes.map((f) => f.titulo), ['g1', 'm1', 'g2', 'm2', 'm3', 'm4']);
  assert.equal(Object.values(r.porMarca).reduce((s, v) => s + v.count, 0), r.total);
});

test('filasAResumen: una marca desconocida no produce enlaces rotos', () => {
  const r = filasAResumen([fila('x', 'desconocida'), fila('m', 'meliponas')]);
  assert.equal(r.total, 1);
  assert.deepEqual(Object.keys(r.porMarca), ['meliponas']);
  assert.deepEqual(r.recientes.map((f) => f.titulo), ['m']);
});

test('conteoDe: 0 sin bitácora, el conteo real con contenido', () => {
  const r = filasAResumen([fila('a', 'granja'), fila('b', 'granja')]);
  assert.equal(conteoDe(r, 'granja'), 2);
  assert.equal(conteoDe(r, 'cafe'), 0);
  assert.equal(conteoDe(r, 'cualquier-cosa'), 0);
});
