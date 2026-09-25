/**
 * La honestidad de las tarjetas de cultivos de polinización.
 *
 * Medido el 2026-09-25 en la BD (`cultivo_polinizacions`): 12 filas, 0 con `slug` —
 * `count(nullif(slug,'')) = 0`. Con `slug: raw.slug ?? ''` (src/lib/polinizacion.ts:92),
 * la plantilla armada en `src/pages/meliponas/polinizacion/index.astro:172` producía
 * `href="/meliponas/polinizacion/"`, o sea una tarjeta que apunta a la misma página que
 * la contiene, y debajo decía «Ver ficha completa →». El enlace no es un 404: `[slug].astro`
 * no encuentra fila y hace `Astro.redirect('/meliponas/polinizacion')`, un lazo que borra
 * el scroll del visitante. Y en el formulario de solicitud, `<option value={c.slug}>`
 * daba `value=""` — el mismo valor que el placeholder — así que el `select` perdía el
 * cultivo elegido y `notas` salía sin la línea `Cultivo: …` (index.astro:395-402).
 *
 * Ninguno de esos dos daños lo ve `astro build`: aquí no hay compilador de tipos, y un
 * `ficha` mal tipeado o renombrado compila verde y miente en el navegador. Por eso este
 * archivo tiene dos mitades: la unidad pura (`normalizeCultivo` → `ficha`) y el contrato
 * de fuente sobre la plantilla, que es lo único que se pone rojo si el `href` vuelve a
 * construirse a mano o si el `value` del `select` pierde su respaldo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');

// `polinizacion.ts` importa `strapi.ts`, que importa `redis.ts` y congela `REDIS_URL` al
// cargarse. Se apunta a un puerto cerrado: el breaker abre, la caché es un no-op y la
// unidad pura no toca la red ni deja un cliente vivo al terminar o teste.
const REDIS_ANTES = process.env.REDIS_URL;
process.env.REDIS_URL = 'redis://127.0.0.1:1';
const { normalizeCultivo } = await import('../src/lib/polinizacion.ts');
if (REDIS_ANTES === undefined) delete process.env.REDIS_URL;
else process.env.REDIS_URL = REDIS_ANTES;

const crudo = (extra) => ({ id: 1, documentId: 'd1', nombre: 'Café', ...extra });

test('normalizeCultivo: con slug, `ficha` es la ruta de la ficha', () => {
  assert.equal(normalizeCultivo(crudo({ slug: 'cafe' })).ficha, '/meliponas/polinizacion/cafe');
});

test('normalizeCultivo: sin slug (null, ausente o cadena vacía) `ficha` es null, no una ruta a medias', () => {
  // Las 12 filas reales están en este caso. `?? ''` produciría `/meliponas/polinizacion/`,
  // que es el enlace autoreferido que hay que eliminar.
  for (const slug of [null, undefined, '']) {
    assert.equal(normalizeCultivo(crudo({ slug })).ficha, null, `slug=${JSON.stringify(slug)}`);
  }
});

test('normalizeCultivo: `slug` sigue expuesto crudo para el respaldo del `select`', () => {
  assert.equal(normalizeCultivo(crudo({ slug: null })).slug, '');
  assert.equal(normalizeCultivo(crudo({ slug: 'guanabana' })).slug, 'guanabana');
});

test('la plantilla enlaza por `c.ficha` y no reconstruye la ruta a mano', () => {
  const fuente = readFileSync(join(RAIZ, 'src/pages/meliponas/polinizacion/index.astro'), 'utf8');
  assert.match(
    fuente,
    /<a\s+href=\{c\.ficha\s*\?\?\s*undefined\}/,
    'el `href` de la tarjeta ya no sale de `c.ficha`: sin la guarda, un cultivo sin slug vuelve a enlazarse a sí mismo',
  );
  assert.doesNotMatch(
    fuente,
    /href=\{`\/meliponas\/polinizacion\/\$\{/,
    'la tarjeta vuelve a interpolar la ruta de la ficha: con `slug` vacío eso es el lazo autoreferido',
  );
});

test('«Ver ficha completa» solo aparece cuando la ficha existe', () => {
  const fuente = readFileSync(join(RAIZ, 'src/pages/meliponas/polinizacion/index.astro'), 'utf8');
  assert.match(
    fuente,
    /\{c\.ficha\s*\?\s*\([\s\S]{0,240}?Ver ficha completa/,
    '«Ver ficha completa →» volvió a un `<p>` sin condición: las 12 filas actuales no tienen ficha que ver',
  );
});

test('el `select` de la solicitud conserva el cultivo aunque no tenga slug', () => {
  const fuente = readFileSync(join(RAIZ, 'src/pages/meliponas/polinizacion/index.astro'), 'utf8');
  assert.match(
    fuente,
    /<option\s+value=\{c\.slug\s*\|\|\s*c\.nombre\}>/,
    'el `value` del `select` ya no respalda con el nombre: `value={c.slug}` con slug vacío es el valor del placeholder y el cultivo elegido se pierde en `notas`',
  );
});
