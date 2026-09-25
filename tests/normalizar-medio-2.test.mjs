/**
 * Task 12b — las cuatro capas de datos de la rebanada (tienda, proyectos, polinización,
 * experimentos) tienen que entregar `MediaItem`, no un `string` que miente.
 *
 * Por qué un arquivo aparte y no más testes en `normalizar-medio.test.mjs` (12a): ese ya
 * está en revisión del controlador y es el contrato del adaptador. Aquí lo que se prueba
 * es el USO del adaptador por estas cuatro capas y sus plantillas.
 *
 * No hay compilador de TypeScript en este repo: `astro build` solo borra tipos. Un
 * `imagen: MediaItem` entregado a una plantilla que espera `string` —o al revés— compila
 * verde y pinta `[object Object]`. El único guard real es este arquivo.
 *
 * Reglas del runner: `node --test` carga los `.ts` de `src/lib` directo (type-stripping de
 * Node 22), así que los imports llevan extensión `.ts` y acá NO se usa el alias `@/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.APP_URL = process.env.APP_URL || 'https://iwage.co';
process.env.STRAPI_URL = process.env.STRAPI_URL || 'http://iwage_strapi:1337';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Un `MediaItem` bien formado, con lo que las plantillas de esta capa leen. */
const PORTADA = {
  id: 41,
  documentId: 'abc123',
  url: 'http://iwage_strapi:1337/uploads/meliponas/miel-angelita.webp',
  mime: 'image/webp',
  width: 1200,
  height: 800,
  alternativeText: 'Frasco de miel de Angelita 250 ml',
  caption: 'Cosecha 2026, vereda Santagueda',
};

/**
 * El contracto que se rompe con el `?? raw.imagen` de `polinizacion.ts:95` (y con cualquier
 * otro `?? <crudo>`): lo que no tiene URL utilizable sale `null`, NUNCA el valor de entrada.
 */
const BASURA = [
  ['objeto vacío', {}],
  ['url nula', { url: null }],
  ['url en blanco', { url: '   ' }],
  ['número', 123],
  ['array anidado (forma de un `multiple` en un campo de a una)', [{ url: '/uploads/a.webp' }]],
  ['null', null],
  ['undefined', undefined],
  ['string en blanco', '  '],
];

/**
 * Ya no vale "que no sea un objeto": después de 12b `imagen` ES un objeto (`MediaItem`). Lo
 * prohibido es un objeto **sin contrato**, que es exactamente lo que escupía el
 * `?? raw.imagen` de `polinizacion.ts:95`: `{}` o `{url: null}` llegaban a la plantilla y
 * `<img src={[object Object]}>` se pintaba con `astro build` verde. Aquí un valor solo pasa
 * si es `null` o un `MediaItem` con `url` de sitio y `kind`.
 */
function assertSinObjetoCrudo(valor, donde) {
  if (valor === null) return;
  assert.equal(Array.isArray(valor), false, `${donde}: salió un array crudo`);
  assert.equal(typeof valor, 'object', `${donde}: ni null ni MediaItem`);
  assert.equal(typeof valor.url, 'string', `${donde}: objeto sin url utilizable → [object Object] en el <img>`);
  assert.ok(valor.url, `${donde}: url vacía`);
  assert.ok(['imagen', 'video', 'tour360'].includes(valor.kind), `${donde}: MediaItem sin kind`);
  assert.doesNotMatch(valor.url, /iwage_strapi|:1337/, `${donde}: host interno de Docker a la plantilla`);
}

// ── 1. tienda.ts — `normalizeProducto` ────────────────────────────────────────
// `Producto.imagen` declaraba `string | null` (`tienda.ts:60`) y el mapper devolvía
// `mediaSrc(raw.imagen)` (`:125`): la ruta sí llegaba, el `alternativeText` del admin no,
// y el tipo no avisaba nada.

import { normalizeProducto } from '../src/lib/tienda.ts';

const PRODUCTO_BASE = { id: 1, documentId: 'p1', nombre: 'Miel Angelita 250 ml', slug: 'miel-angelita-250', precio: 38000, categoria: 'miel' };

test('tienda: una portada media de Strapi sale MediaItem con alt y ruta de sitio', () => {
  const p = normalizeProducto({ ...PRODUCTO_BASE, imagen: PORTADA });
  assert.equal(p.imagen.url, '/uploads/meliponas/miel-angelita.webp', 'el host interno de Docker llegó a la plantilla');
  assert.equal(p.imagen.alt, 'Frasco de miel de Angelita 250 ml', 'el alternativeText del admin se pierde');
  assert.equal(p.imagen.caption, 'Cosecha 2026, vereda Santagueda');
  assert.equal(p.imagen.kind, 'imagen');
});

test('tienda: la forma vieja (string suelto) sigue funcionando', () => {
  const p = normalizeProducto({ ...PRODUCTO_BASE, imagen: '/uploads/x.webp' });
  assert.equal(p.imagen.url, '/uploads/x.webp');
  const v = normalizeProducto({ ...PRODUCTO_BASE, imagen: 'http://iwage_strapi:1337/uploads/x.webp' });
  assert.equal(v.imagen.url, '/uploads/x.webp');
});

test('tienda: imagen basura → null, y jamás el valor crudo', () => {
  for (const [motivo, imagen] of BASURA) {
    const p = normalizeProducto({ ...PRODUCTO_BASE, imagen });
    assert.equal(p.imagen, null, `${motivo}: salió ${JSON.stringify(p.imagen)}`);
    assertSinObjetoCrudo(p.imagen, `tienda/${motivo}`);
  }
});

test('tienda: la galería deduplica el mismo archivo y una tarjeta no se queda sin alt', () => {
  const p = normalizeProducto({
    ...PRODUCTO_BASE,
    imagen: PORTADA,
    galeria: [{ url: '/uploads/g.jpg', alternativeText: 'Con alt' }, { url: '/uploads/g.jpg' }],
  });
  assert.equal(p.galeria.length, 1, 'el mismo archivo dos veces sale duplicado');
  assert.equal(p.galeria[0].alt, 'Con alt', 'el dedupe eligió la versión pobre');
});

// ── 2. polinizacion.ts — `mapCultivo` → `normalizeCultivo` ───────────────────
// `polinizacion.ts:95` es `mediaSrc(raw.imagen) ?? raw.imagen ?? (galeria?.[0]?.url ?? null)`.
// `rawOf()` de `media.ts:60-69` acepta objeto, así que el primer tramo funciona con el
// esquema nuevo; pero cuando devuelve `null` el segundo tramo entrega EL OBJETO CRUDO, y
// `src/pages/meliponas/polinizacion/[slug].astro:64` lo pinta en `<img src>`.

import { normalizeCultivo } from '../src/lib/polinizacion.ts';

const CULTIVO_BASE = { id: 1, documentId: 'c1', nombre: 'Café', slug: 'cafe' };

test('polinización: portada media de Strapi → MediaItem con alt', () => {
  const c = normalizeCultivo({ ...CULTIVO_BASE, imagen: { ...PORTADA, url: '/uploads/cultivos/cafe.webp', alternativeText: 'Cafetal en floración' } });
  assert.equal(c.imagen.url, '/uploads/cultivos/cafe.webp');
  assert.equal(c.imagen.alt, 'Cafetal en floración');
});

test('polinización: imagen basura → null y NUNCA el crudo (el `?? raw.imagen` de :95)', () => {
  for (const [motivo, imagen] of BASURA) {
    const c = normalizeCultivo({ ...CULTIVO_BASE, imagen });
    assert.equal(c.imagen, null, `${motivo}: salió ${JSON.stringify(c.imagen)}`);
    assertSinObjetoCrudo(c.imagen, `polinización/${motivo}`);
  }
  // Y con galería llena pero portada basura: sin imagen, no la primera de la galería
  // disfrazada de portada (la galería se pinta aparte en `[slug].astro:71`).
  const conGaleria = normalizeCultivo({
    ...CULTIVO_BASE,
    imagen: {},
    galeria: [{ url: '/uploads/g1.webp' }, { url: '/uploads/g2.webp' }],
  });
  assert.equal(conGaleria.imagen, null, 'la portada se está inventando desde la galería');
  assert.equal(conGaleria.galeria.length, 2);
});

test('polinización: la forma vieja string y el host interno', () => {
  const c = normalizeCultivo({ ...CULTIVO_BASE, imagen: 'http://iwage_strapi:1337/uploads/cultivos/cafe.webp' });
  assert.equal(c.imagen.url, '/uploads/cultivos/cafe.webp');
});
