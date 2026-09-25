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
 * archivo tiene dos mitades: la unidad pura (`normalizeCultivo` → `ficha`) y el contrato de
 * fuente sobre las DOS plantillas. En la mitad de fuente hay dos guards, y es deliberado: el
 * que había (`href=\{c\.ficha \?\? undefined\}` casado como texto literal) no podía fallar, así
 * que dejaba pasar la tarjeta que sigue fingiéndose clicable sin `href`. Ahora uno pide que el
 * enlace salga de `ficha` y el otro que una tarjeta sin ficha lo declare (`aria-disabled`) y no
 * lleve `group`/`hover:` fuera del condicional.
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

const PLANTILLAS = [
  'src/pages/meliponas/polinizacion/index.astro',
  'src/pages/meliponas/polinizacion/[slug].astro',
];

/** La línea del `<a>` de la tarjeta, en cada plantilla. */
function lineaEnlace(ruta) {
  const fuente = readFileSync(join(RAIZ, ruta), 'utf8');
  return fuente.split('\n').filter((l) => /<a\s[^>]*href=\{[cr]\.ficha/.test(l));
}

test('las dos plantillas enlazan por `ficha` y no reconstruyen la ruta a mano', () => {
  // Medido el 2026-09-25: este guard estaba escrito solo contra `index.astro` y el MISMO
  // defecto vivía tranquilo en `[slug].astro:374` («Otros cultivos» enlazaba
  // `/meliponas/polinizacion/${r.slug}` con `slug` NULL en las 12 filas -> lazo autoreferido).
  // Un guard que mira un archivo de los dos no es un guard: barren los dos.
  for (const ruta of PLANTILLAS) {
    const enlace = lineaEnlace(ruta);
    assert.equal(enlace.length, 1, `${ruta}: esperaba UN <a> con el href salido de \`ficha\`, encontrados ${enlace.length}`);
    const fuente = readFileSync(join(RAIZ, ruta), 'utf8');
    assert.doesNotMatch(
      fuente,
      /href=\{`\/meliponas\/polinizacion\/\$\{/,
      `${ruta}: vuelve a interpolar la ruta de la ficha: con \`slug\` vacío eso es el lazo autoreferido`,
    );
  }
});

test('la tarjeta sin ficha no finge ser enlace: declara `aria-disabled` y no lleva hover estático', () => {
  // El guard de arriba casaba el texto LITERAL `href={c.ficha ?? undefined}`, así que no podía
  // fallar; y lo que ese texto escondía era un `<a>` sin `href` —las 12 filas de
  // `cultivo_polinizacions` están hoy todas en ese caso— con `group`, `hover:shadow-md` y
  // `hover:-translate-y-1`: una tarjeta que se ve clicable y no lleva a ninguna parte.
  for (const ruta of PLANTILLAS) {
    const [linea] = lineaEnlace(ruta);
    const letra = linea.match(/href=\{([cr])\.ficha/)[1];
    assert.match(
      linea,
      new RegExp(`aria-disabled=\\{!${letra}\\.ficha\\}`),
      `${ruta}: el \`<a>\` sin \`href\` no declara que está deshabilitado`,
    );
    assert.doesNotMatch(
      linea,
      /class="[^"]*(\bgroup\b|hover:)/,
      `${ruta}: \`group\` o un \`hover:\` volvieron a una \`class\` estática: la tarjeta sin ficha vuelve a fingirse clicable`,
    );
    assert.match(
      linea,
      new RegExp(`\\$\\{${letra}\\.ficha \\? '[^']*\\bgroup\\b[^']*hover:[^']*'`),
      `${ruta}: la señal de «clicable» ya no está dentro del condicional de \`ficha\``,
    );
  }
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
