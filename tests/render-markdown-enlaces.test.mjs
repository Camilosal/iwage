import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/render-markdown.ts';

// Medido en producción 2026-10-04: 33 de 56 artículos publicados mostraban el
// markdown crudo `[texto](/ruta)` al lector, porque el renderer devolvía
// `token.text` (sin parsear) en párrafos y en las etiquetas de los enlaces.
const REGISTRO = {
  bitacoras: [
    { slug: 'modulo-3-c2-b7-el-nido-por-dentro', marca: 'meliponas' },
    { slug: 'cafe-agroecologico-iwage', marca: 'cafe' },
  ],
  productos: [{ slug: 'miel-angelita-120ml-frasco', marca: 'meliponas' }],
};

test('párrafos: el markdown en línea se vuelve HTML', () => {
  const html = renderMarkdown('Mira **la miel** y [el nido](/modulo-3-el-nido).');
  assert.match(html, /<strong class="font-semibold text-text-primary">la miel<\/strong>/);
  assert.match(html, /<a href="\/modulo-3-el-nido"/);
  assert.doesNotMatch(html, /\]\(|\*\*/);
});

test('con registro: el enlace heredado se repara en el render, sin tocar la base de datos', () => {
  const html = renderMarkdown('[Miel](/producto/miel-abeja-angelita/) y [café](/p-cafe-agroecologico-iwage/)', {
    registro: REGISTRO,
    marca: 'meliponas',
  });
  assert.match(html, /href="\/meliponas\/tienda\/miel-angelita-120ml-frasco"/);
  assert.match(html, /href="\/cafe\/bitacora\/cafe-agroecologico-iwage"/);
});

test('sin registro: los enlaces salen como los escribió el autor', () => {
  const html = renderMarkdown('[Miel](/producto/miel-abeja-angelita/)', { marca: 'meliponas' });
  assert.match(html, /href="\/producto\/miel-abeja-angelita\/"/);
});

test('el contexto de reparación no se filtra a renders posteriores', () => {
  renderMarkdown('[nido](/modulo-3-el-nido)', { registro: REGISTRO, marca: 'meliponas' });
  const despues = renderMarkdown('[nido](/modulo-3-el-nido)');
  assert.match(despues, /href="\/modulo-3-el-nido"/);
  assert.doesNotMatch(despues, /bitacora/);
});

test('encabezados, citas y listas también interpretan el en línea', () => {
  const html = renderMarkdown('## Título **negro**\n\n> Cita con [enlace](/cafe/menu)\n\n- [item](/producto/miel-angelita)\n');
  assert.match(html, /<h2[^>]*>Título <strong/);
  assert.match(html, /<blockquote[^>]*>.*<a href="\/cafe\/menu"/s);
  assert.match(html, /<li class="leading-relaxed"><a href="\/producto\/miel-angelita"/);
});

test('enlace externo: abre en pestaña nueva y conserva el rótulo', () => {
  const html = renderMarkdown('[Instagram](https://instagram.com/iwage.co)');
  assert.match(html, /<a href="https:\/\/instagram\.com\/iwage\.co"[^>]*target="_blank"[^>]*rel="noopener noreferrer">Instagram<\/a>/);
});

test('tablas GFM: las celdas interpretan el en línea', () => {
  const html = renderMarkdown('| producto | precio |\n|---|---|\n| **miel** | [ver](/meliponas/tienda) |\n');
  assert.match(html, /<td[^>]*><strong class="font-semibold text-text-primary">miel<\/strong><\/td>/);
  assert.match(html, /<td[^>]*><a href="\/meliponas\/tienda"/);
});

test('placeholder de imagen sin URL (migración WP) no se muestra al lector', () => {
  const html = renderMarkdown('![Imagen plano amplio del corredor Ambalá — sin texto.]\n\nPárrafo real.');
  assert.doesNotMatch(html, /!\[/);
  assert.doesNotMatch(html, /plano amplio/);
  assert.match(html, /Párrafo real/);
});

test('imagen con URL sí se renderiza', () => {
  const html = renderMarkdown('![miel](/uploads/miel.webp)');
  assert.match(html, /<img src="\/uploads\/miel\.webp" alt="miel"/);
});

test('contenido vacío sigue devolviendo cadena vacía', () => {
  assert.equal(renderMarkdown(''), '');
});
