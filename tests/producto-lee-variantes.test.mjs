// `variantes` (jsonb, `Array<{nombre, opciones[]}>`) llevaba desde septiembre declarado en la
// interfaz `Producto`, poblado por `normalizeProducto` y leído por **ninguna** plantilla: el CMS
// mostraba un campo que el sitio tiraba a la basura, y quien lo llenara no veía nada. Este arquivo
// fija el contrato completo —esquema de Strapi → normalizador → hoja— para que romperse en
// cualquiera de los tres eslabones sea rojo y no un campo que desaparece en silencio.
//
// La cuarta prueba no es decorativa: `Icon.astro` devuelve un `<span>` vacío cuando el nombre no
// está en `lucide`, así que un ícono mal escrito no tira el build ni pinta un cuadro rojo. Es el
// mismo fallo mudo que ya se midió con los nombres kebab-Pascal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons } from 'lucide';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

const FICHA = 'src/pages/meliponas/tienda/[slug].astro';
const TIENDA = 'src/lib/tienda.ts';
const ESQUEMA = 'strapi/src/api/producto/content-types/producto/schema.json';

test('el esquema de Strapi sigue exponiendo `variantes` a quien llena el CMS', () => {
  const campo = JSON.parse(leer(ESQUEMA)).attributes.variantes;
  assert.ok(campo, '`variantes` desapareció del esquema: hay que quitarlo también del contrato');
  assert.equal(campo.type, 'json');
});

test('normalizeProducto trae `variantes` desde el crudo de Strapi', () => {
  const codigo = sinComentarios(leer(TIENDA));
  assert.match(codigo, /variantes:\s*Array<\{\s*nombre:\s*string;\s*opciones:\s*string\[\]\s*\}>\s*\|\s*null/);
  assert.match(codigo, /variantes:\s*raw\.variantes\s*\?\?\s*null/);
});

test('la ficha de producto lee `variantes` y lo pinta con su etiqueta', () => {
  const codigo = sinComentarios(leer(FICHA));
  assert.match(codigo, /producto\.variantes\?\.map\(\(eje\)/, 'la hoja volvió a dejar de consumir el campo');
  assert.match(codigo, /\{eje\.nombre\}:\s*\{eje\.opciones\.join\(' · '\)\}/, 'se perdió la forma «Nombre: opción · opción»');
});

test('el ícono del bloque existe en lucide', () => {
  const codigo = leer(FICHA);
  const usados = [...codigo.matchAll(/name="([a-z0-9-]+)"/g)].map((m) => m[1]);
  const aPascal = (k) => k.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  const ausentes = usados.filter((n) => !icons[aPascal(n)]);
  assert.deepEqual(ausentes, [], 'nombres de ícono que lucide no conoce y que pintan un span vacío');
});
