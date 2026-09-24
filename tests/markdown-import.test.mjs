import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarSlug, parseFrontMatter } from '../strapi/scripts/lib/markdown-import.mjs';

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
