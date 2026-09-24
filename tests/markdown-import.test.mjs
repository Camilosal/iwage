import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  limpiarSlug,
  parseFrontMatter,
  quitarPlaceholders,
  extraerExtracto,
  calcularTiempoLectura,
} from '../strapi/scripts/lib/markdown-import.mjs';

test('limpiarSlug: minúsculas, sin acentos, sin tramos de fecha de WordPress', () => {
  assert.equal(limpiarSlug('Cosecha-Mayo-2026-Lote-L25-05-001'), 'cosecha-mayo-lote-l25-05-001');
  assert.equal(limpiarSlug('  Meliponas__de_Ángel  '), 'meliponas-de-angel');
  assert.equal(limpiarSlug('melipona-2026-05-17-la-reina'), 'melipona-la-reina');
  assert.equal(limpiarSlug(''), '');
});

test('parseFrontMatter: scalares y listas en línea del export de WordPress', () => {
  const bruto = `---
title: "Caso: La finca de Don Manuel"
date: 2026-05-25
slug: caso-la-finca-de-don-manuel
categories: ["Proyectos Realizados"]
tags: ["meliponas", "finca tolima"]
source: wordpress
---

# Caso: La finca de Don Manuel
`;
  const { data, body } = parseFrontMatter(bruto);
  assert.equal(data.title, 'Caso: La finca de Don Manuel');
  assert.equal(data.date, '2026-05-25');
  assert.equal(data.slug, 'caso-la-finca-de-don-manuel');
  assert.deepEqual(data.categories, ['Proyectos Realizados']);
  assert.deepEqual(data.tags, ['meliponas', 'finca tolima']);
  assert.ok(body.startsWith('# Caso'), 'el cuerpo conserva el H1');
});

test('parseFrontMatter: sin front matter devuelve el texto intacto', () => {
  const { data, body } = parseFrontMatter('Solo un párrafo.');
  assert.deepEqual(data, {});
  assert.equal(body, 'Solo un párrafo.');
});

test('quitarPlaceholders: borra el aviso de imagen sugerida y los hotlinks muertos', () => {
  const bruto = [
    'Párrafo uno que habla del corredor y sus nidos.',
    '',
    '![Imagen sugerida: vista general de la finca de Don Manuel. Sin personas.]()',
    '',
    '![caja de cria](https://tienda.iwage.co/wp-content/uploads/2026/05/img_3091.jpeg)',
    '',
    'Párrafo dos, el que sigue después de lo que sobraba.',
  ].join('\n');
  const limpio = quitarPlaceholders(bruto);
  assert.ok(!/Imagen sugerida/i.test(limpio));
  assert.ok(!/tienda\.iwage\.co/.test(limpio));
  assert.ok(limpio.includes('Párrafo uno') && limpio.includes('Párrafo dos'));
  assert.ok(!/\n{3,}/.test(limpio), 'sin saltos triples');
});

test('extraerExtracto: primer párrafo real, sin títulos ni liga, cortado en palabra', () => {
  const bruto =
    '# Título\n\n![Imagen sugerida: x]()\n\n' +
    'Don Manuel llega a la finca algunas mañanas de la semana y camina la hectárea que es suya, ' +
    'entre el cafetal con sombrío de guamo y el bosque nativo que bordea el río.';
  const e = extraerExtracto(bruto, 120);
  assert.ok(e.length <= 121, `corto (${e.length})`);
  assert.ok(!e.includes('#'));
  assert.ok(e.endsWith('…'));
});

test('calcularTiempoLectura: 220 palabras por minuto, mínimo 1', () => {
  assert.equal(calcularTiempoLectura('una dos tres'), 1);
  assert.equal(calcularTiempoLectura(Array(441).fill('pal').join(' ')), 2);
});
