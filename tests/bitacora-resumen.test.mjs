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

// Distribución real medida el 2026-09-24 en Strapi: 37 de meliponas + 19 de granja,
// y las otras cuatro marcas sin filas publicadas. Es el contrato del grafo expresado
// en datos: `/` debe dar 2 portadas y 6 artículos, cada landing con contenido 3 tarjetas,
// y ninguna vacía un enlace.
test('contrato del grafo con los 56 artículos publicados', () => {
  const filas = [
    ...Array.from({ length: 37 }, (_, i) => fila(`m${i}`, 'meliponas')),
    ...Array.from({ length: 19 }, (_, i) => fila(`g${i}`, 'granja')),
  ];
  const r = filasAResumen(filas);
  const MARCAS = ['tierras', 'naturaleza', 'meliponas', 'cafe', 'gestion', 'granja'];

  assert.equal(r.total, 56);
  // `/.`: chips de portada (misma condición que BitacoraEcosistema/BrandFooter)
  const marcasConEnlace = MARCAS.filter((m) => conteoDe(r, m) > 0);
  assert.deepEqual(marcasConEnlace, ['meliponas', 'granja']);
  assert.deepEqual(marcasConEnlace.map((m) => `/${m}/bitacora`), ['/meliponas/bitacora', '/granja/bitacora']);
  assert.equal(r.recientes.length, 6);
  assert.equal(new Set(r.recientes.map((f) => `/${f.marca}/bitacora/${f.slug}`)).size, 6);
  // Landings: 3 tarjetas donde hay contenido, 0 donde no
  assert.equal((r.porMarca.meliponas?.ultimas ?? []).length, 3);
  assert.equal((r.porMarca.granja?.ultimas ?? []).length, 3);
  for (const m of ['tierras', 'naturaleza', 'cafe', 'gestion']) {
    assert.equal(r.porMarca[m]?.ultimas.length ?? 0, 0, `${m} no debe ganar enlaces`);
  }
});
