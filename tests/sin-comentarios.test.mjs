/**
 * Testes del stripper que usan los contratos de fuente.
 *
 * Este helper es la pieza que decide qué ve una aserción de texto sobre `src/`. Si borra de
 * más, un contrato se verdea porque desapareció la línea que lo negaba; si borra de menos, la
 * prosa vuelve a satisfacerlo (que es el mutante MT4 del ledger). Las dos mitades del daño van
 * aquí, con el caso medido del 2026-09-25 como uno de los testes: tres líneas de
 * `src/lib/media.ts` se borraban solas porque un regex que casa `https://` abría un comentario
 * fantasma para la versión anterior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');
const sin = (n) => sinComentarios(n);

test('quita el comentario de línea y deja la declaración', () => {
  const salida = sin('  imagen: MediaItem | null; // imagen: string | null;\n');
  assert.equal(salida, '  imagen: MediaItem | null;                          \n');
});

test('quita un comentario de bloque multilínea respetando las líneas', () => {
  const fuente = 'a;\n/* una\n   dos */\nb;\n';
  const salida = sin(fuente);
  assert.equal(salida.split('\n').length, fuente.split('\n').length);
  assert.equal(salida.length, fuente.length);
  assert.equal(salida, 'a;\n      \n         \nb;\n');
});

test('una URL dentro de una cadena no es un comentario', () => {
  const salida = sin("const u = 'https://iwage.co/granja'; // fin\n");
  assert.match(salida, /'https:\/\/iwage\.co\/granja'/);
  assert.doesNotMatch(salida, /fin/);
});

test('un regex que casa barras no se traga el resto de la línea (el caso medido)', () => {
  const linea = "if (!/^https?:\\/\\//i.test(raw)) return null;";
  assert.equal(sin(linea), linea);
  assert.equal(sin(`if (/^video\\//.test(o.mime)) kind = 'video';`), `if (/^video\\//.test(o.mime)) kind = 'video';`);
});

test('la evidencia real: las tres líneas de src/lib/media.ts que el stripper anterior borraba', () => {
  const salida = sin(readFileSync(join(RAIZ, 'src/lib/media.ts'), 'utf8'));
  for (const n of [49, 134, 154]) {
    const cruda = readFileSync(join(RAIZ, 'src/lib/media.ts'), 'utf8').split('\n')[n - 1];
    assert.equal(salida.split('\n')[n - 1], cruda, `la línea ${n} de src/lib/media.ts desaparece del contrato`);
  }
});

test('un `<!--` dentro de una plantilla es prosa y se va', () => {
  const fuente = 'app.innerHTML = `\n  <!-- Progress Bar -->\n  <p>hola</p>\n`;\n';
  const salida = sin(fuente);
  assert.doesNotMatch(salida, /Progress Bar/);
  assert.match(salida, /<p>hola<\/p>/, 'el markup de la plantilla sí se conserva');
});

test('el comentario dentro de una interpolación se quita y el escaneo vuelve al código', () => {
  const fuente = 'const t = `a ${ x /* y */ } b`;\n// fuera\nconst z = 1;\n';
  const salida = sin(fuente);
  assert.doesNotMatch(salida, /y \*\/|fuera/);
  assert.match(salida, /const z = 1;/);
  assert.match(salida, /`a \$\{ x /, 'el texto de la plantilla se conserva');
});

test('la división no se confunde con un regex', () => {
  const linea = 'const r = total / cajas; // unidades';
  const salida = sin(linea);
  assert.match(salida, /total \/ cajas/);
  assert.doesNotMatch(salida, /unidades/);
});

test('`return` seguido de regex: el regex no es una división y su contenido se respeta', () => {
  const linea = '  return /\\/\\/dos barras/.test(s);';
  assert.equal(sin(linea), linea);
});

test('después de una cadena con comilla sin cerrar en su línea, el escaneo no se descarría', () => {
  // `const a = 'roto` (sin cierre) es código inválido; lo que importa es que el stripper no
  // se coma el comentario de la línea siguiente ni el de la propia.
  const fuente = "const a = 'roto; // uno\nconst b = 2; // dos\n";
  const salida = sin(fuente);
  assert.doesNotMatch(salida, /uno/);
  assert.match(salida, /const b = 2;/);
});
