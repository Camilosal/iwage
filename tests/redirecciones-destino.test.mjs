// Ninguna prueba de este repo miraba el destino de las redirecciones propias, y por eso dos
// puertas 301 vivieron años terminando en 404: `/meliponas/blog` mandaba a un `/blog` que no
// existe en ninguna parte, y `/estandar` a `/meliponas/estandar`, una hoja que nunca existió
// (medido con `git log --diff-filter=D`, que está vacío). El crawl de enlaces interiores no las
// ve porque nadie enlaza la puerta: lo que se rompe es la promesa que el servidor le hizo a
// Google y a los marcadores de la gente.
//
// Este arquivo lee `nginx.conf` y `src/middleware.ts` como texto —en el repo no hay compilador
// de tipos y la única guarda posible es una aserción sobre la línea— y exige que el destino
// FINAL de cada cadena corresponda a una página. Las dos aserciones de conteo no son relleno:
// un parser que no casa nada también se pondría verde, y ese es el modo de fallo exacto de un
// guarda escrito sobre expresiones regulares ajenas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PAGES = join(RAIZ, 'src', 'pages');

const nginx = readFileSync(join(RAIZ, 'nginx.conf'), 'utf8');
const middleware = sinComentarios(readFileSync(join(RAIZ, 'src/middleware.ts'), 'utf8'));

/** `location = /x { return 301 /y; }` — la forma que usa este archivo, una regla por línea. */
function reglasDeNginx(texto) {
  const out = [];
  const re = /location\s*=\s*(\/[^\s{]+)\s*\{\s*return\s+301\s+(\/[^;]+);/g;
  let m;
  while ((m = re.exec(texto)) !== null) out.push({ desde: m[1], hacia: m[2].trim() });
  return out;
}

/**
 * `[/^\/ruta\/?$/, () => '/destino']` y su hermana con interpolación `(m) => \`/destino/${m[1]}\``.
 * El segmento dinámico se normaliza a `*` porque lo que se pregunta es si la puerta lleva a una
 * hoja, no si cada slug existe.
 */
function reglasDeMiddleware(codigo) {
  const out = [];
  const re = /\[\s*(\/\^[^\n]*?),\s*(?:\(\)|\(m\))\s*=>\s*(?:'([^']+)'|`([^`]+)`)\s*\]/g;
  let m;
  while ((m = re.exec(codigo)) !== null) {
    out.push({ desde: rutaDesdeRegex(m[1]), hacia: (m[2] ?? m[3]).replace(/\$\{[^}]+\}/g, '*') });
  }
  return out;
}

/** `^\/gestion\/operacion-turistica\/?$` → `/gestion/operacion-turistica`. La captura incluye las
 *  dos barras del literal, así que hay que desarmar el literal completo: apertura `/^`, cierre
 *  `/`, ancla `$`, barras escapadas, el segmento dinámico y el `/?` que cubre la variante con
 *  barra final. */
function rutaDesdeRegex(src) {
  return src
    .replace(/^\/\^/, '')
    .replace(/\/$/, '')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/')
    .replace(/\(\[\^\/\]\+\)/g, '*')
    .replace(/\/\?$/, '');
}

/** ¿Hay una hoja que sirva esta ruta? Acepta la forma archivo, la de carpeta con `index` y las
 *  de segmento dinámico (`[slug]`, `[...slug]`), que son las cuatro maneras de existir que hay
 *  en este `src/pages`. La última comprobación es sobre el **padre**, porque `/meliponas/tienda/
 *  <slug>` lo sirve `meliponas/tienda/[slug].astro`, no una hoja dentro de la carpeta del slug. */
function paginaExiste(path) {
  const sinAncla = path.split('#')[0];
  const estatico = sinAncla.split('*')[0].replace(/\/+$/, '');
  if (estatico === '') return true; // la raíz la sirve `pages/index.astro`
  const candidatos = [
    `${estatico}.astro`,
    `${estatico}/index.astro`,
    `${estatico}/[slug].astro`,
    `${estatico}/[...slug].astro`,
    `${estatico.replace(/\/[^/]+$/, '')}/[slug].astro`,
    `${estatico.replace(/\/[^/]+$/, '')}/[...slug].astro`,
  ];
  return candidatos.some((c) => existsSync(join(PAGES, c)));
}

const reglas = [
  ...reglasDeNginx(nginx).map((r) => ({ ...r, origen: 'nginx.conf' })),
  ...reglasDeMiddleware(middleware).map((r) => ({ ...r, origen: 'src/middleware.ts' })),
];

const porOrigen = new Map(reglas.map((r) => [`${r.origen} ${r.desde}`, r]));

/** Desanda la cadena nginx → middleware y devuelve el destino final con sus saltos. */
function cadenaFinal(desde, hacia) {
  const saltos = [{ desde, hacia }];
  let actual = hacia;
  for (let i = 0; i < 5; i += 1) {
    const siguiente = porOrigen.get(`nginx.conf ${actual}`) ?? porOrigen.get(`src/middleware.ts ${actual}`);
    if (!siguiente || siguiente.hacia === actual) break;
    saltos.push({ desde: actual, hacia: siguiente.hacia });
    actual = siguiente.hacia;
  }
  return { final: actual, saltos: saltos.length };
}

test('el parser de redirecciones no se deja ninguna por fuera', () => {
  const returnEnNginx = (nginx.match(/return\s+301/g) ?? []).length;
  const reglasEnNginx = reglasDeNginx(nginx).length;
  assert.ok(returnEnNginx > 0, 'nginx.conf no tiene un solo 301: cambió la forma y el parser ya no sirve');
  assert.equal(reglasEnNginx, returnEnNginx, 'hay 301 en nginx.conf que este parser no está leyendo');

  const literalesEnMiddleware = (middleware.match(/\[\s*\/\^/g) ?? []).length;
  const reglasEnMiddleware = reglasDeMiddleware(middleware).length;
  assert.ok(literalesEnMiddleware > 0, 'middleware.ts no tiene un solo par [regex, destino]');
  assert.equal(reglasEnMiddleware, literalesEnMiddleware, 'hay reglas en middleware.ts que este parser no está leyendo');
});

test('toda redirección termina en una hoja que existe', () => {
  const rotas = [];
  for (const r of reglas) {
    const { final } = cadenaFinal(r.desde, r.hacia);
    if (!paginaExiste(final)) rotas.push(`${r.origen}: ${r.desde} → ${final}`);
  }
  assert.deepEqual(rotas, [], 'puertas 301 que caen en 404');
});

test('las tres puertas que se arreglaron el 2026-10-05 siguen en su destino', () => {
  // `/meliponas/blog` se movió de nginx a middleware para cubrir `/meliponas/blog/` con la misma
  // línea; `/estandar` y `/operacion-turistica` siguen en nginx, que es donde viven las rutas de
  // raíz según la regla declarada en el propio middleware.
  const casos = [
    ['/meliponas/blog', '/meliponas/bitacora'],
    ['/estandar', '/meliponas/investigacion'],
    ['/operacion-turistica', '/gestion/propietarios/operacion-turistica'],
  ];
  for (const [desde, esperado] of casos) {
    const regla = reglas.find((r) => r.desde === desde);
    assert.ok(regla, `se perdió la puerta ${desde}`);
    const { final } = cadenaFinal(desde, regla.hacia);
    assert.equal(final, esperado, `${desde} ya no llega a ${esperado}`);
    assert.ok(paginaExiste(final));
  }
});

// Las tres puertas de la miel Angelita, fijadas aparte del barrido general porque su arreglo no
// fue solo «que el destino exista»: las presentaciones estaban mal numeradas, así que la ficha de
// $78.000 pasó a llamarse 120 ml y a reclamar el slug que acaba de desocupar la ficha de $25.000.
// Un 301 sobre `/meliponas/tienda/miel-angelita-120ml` habría pasado esta prueba —el destino
// existe— y habría tapado una página viva, mandando a quien la tenía en marcadores a un producto
// cuatro veces más caro. Lo que se fija acá es el slug con envase, que es lo que impide la sombra.
test('las tres puertas de la miel Angelita llevan al slug con envase, no al pelado', () => {
  const casos = [
    ['/meliponas/tienda/miel-angelita-120ml', '/meliponas/tienda/miel-angelita-25ml-gotero'],
    ['/meliponas/tienda/miel-angelita-250ml', '/meliponas/tienda/miel-angelita-60ml-botella'],
    ['/meliponas/tienda/miel-angelita-500ml', '/meliponas/tienda/miel-angelita-120ml-frasco'],
  ];
  for (const [desde, esperado] of casos) {
    const regla = reglas.find((r) => r.desde === desde && r.origen === 'src/middleware.ts');
    assert.ok(regla, `se perdió la puerta ${desde}`);
    assert.equal(regla.hacia, esperado, `${desde} ya no llega a ${esperado}`);
    assert.ok(paginaExiste(esperado), `${esperado} no resuelve a ninguna hoja`);
    assert.notEqual(desde, esperado, `${desde} se redirige a sí misma`);
  }
  // La sombra: ninguna de las tres puertas puede apuntar a un slug que sea idéntico a la puerta
  // misma, y ningún destino puede ser `miel-angelita-<volumen>ml` pelado (sin envase).
  for (const [, esperado] of casos) {
    assert.match(esperado, /-(gotero|botella|frasco)$/, `${esperado} perdió el envase del slug`);
  }
});

// ── La forma del `Location`, que no es solo el destino ───────────────
//
// Medido el 2026-10-05 sobre el dominio público: `curl -sI https://iwage.co/tienda`
// respondía `location: http://iwage.co/meliponas/tienda`. Nginx arma el `Location`
// absoluto con SU esquema —escucha el :80 detrás del túnel de Cloudflare—, así que las
// trece puertas legacy bajaban al visitante de HTTPS antes de entregarlo, y ahí se
// quedaba porque el sitio también responde 200 por http. Las redirecciones del middleware
// de Astro nunca hicieron eso: salen relativas (`location: /meliponas/investigacion`,
// medido en la misma pasada). `absolute_redirect off` pone las de nginx en esa forma.
test('las 301 de nginx salen relativas y no reescriben el esquema a http', () => {
  assert.match(nginx, /^\s*absolute_redirect\s+off\s*;/m,
    'falta `absolute_redirect off`: las puertas de nginx entregan `http://` y bajan de TLS');

  // Ningún destino escrito puede venir absoluto: sería la misma fuga por otra puerta.
  for (const r of reglasDeNginx(nginx)) {
    assert.match(r.hacia, /^\//, `nginx: ${r.desde} apunta a un destino absoluto (${r.hacia})`);
  }
  for (const r of reglasDeMiddleware(middleware)) {
    assert.match(r.hacia, /^\//, `middleware: ${r.desde} apunta a un destino absoluto (${r.hacia})`);
  }
});
