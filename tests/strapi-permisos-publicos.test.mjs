/**
 * D9 · G7 — lo que el sitio lee sin token tiene que estar autorizado por `bootstrap`.
 *
 * El front solo manda `Authorization` si el entorno define `STRAPI_API_TOKEN` (`src/lib/strapi.ts:8`
 * y `:136-137`). Medido en el despliegue: `iwage_web` **sí** lo define, así que hoy las páginas no
 * piden como rol Public y esta puerta no se nota. Lo que guarda este teste es el otro camino —el de
 * cualquier entorno sin la variable, el de un dev local, el de un token rotado o fuera del env—, que
 * es un camino real: cuando se abrió G7 estaba cerrado y daba 403. Que producción fuera por token es
 * justamente el dato que D8 no midió y lo que dejó ocho láminas jubilables en el tree.
 *
 * Por el camino sin token la lista `PUBLIC_APIS` de `strapi/src/index.ts` es el único cable que
 * decide qué se ve. Se rompió dos veces por la misma razón —`experimento` y `historia-visitante` se
 * crearon y nadie las agregó— y el costo no fue un 403 en el panel: fueron dos superficies del café
 * pintando relleno versionado en `src/` en lugar del dato de Strapi.
 *
 * Cuatro guardas, cada una con sus dientes:
 *
 *  1. **Ningún content-type queda afuera.** Todo directorio real de `strapi/src/api/` tiene que
 *     estar en `PUBLIC_APIS`. Estuvo rojo desde que se crearon `experimento` e `historia-visitante`
 *     hasta D9.
 *  2. **Ninguna entrada de `PUBLIC_APIS` está muerta.** Al sacarla de la lista no pasa nada, pero
 *     quedarse mintiendo sobre qué existe sí: `articulo` llevaba meses nombrando un content-type que
 *     no está ni en `src/api` ni como tabla, y sus dos filas huérfanas en `up_permissions` hacían ver
 *     el mecanismo más sano de lo que estaba (el sync de Strapi las recolectó al recrear el
 *     contenedor; la cuenta quedó 50 + 4 − 2 = 52).
 *  3. **El `action` que arma el código es el que la BD acepta.** La plantilla es
 *     `api::<nombre>.<nombre>.<acción>` y `nombre` es el `info.singularName` del schema, no el
 *     nombre de la carpeta: si alguien declara un content-type cuyo `singularName`
 *     no coincida, el bootstrap inserta un permiso que ninguna ruta mira y el 403 sobrevive verde.
 *  4. **Todo endpoint que el sitio nombra resuelve a un content-type publicado a Public.** Esta es
 *     la que hubiese agarrado el 403 sin leer el runbook: se extraen los literales de
 *     `strapiFetch/strapiSingle/fetchAllSlugs/ENDPOINT` en `src/` y se casan contra
 *     `singularName`/`pluralName`. `seo-landings` es la única excepción declarada, y es otro
 *     problema medido: no hay content-type (404, no 403), así que la puerta pública no lo arregla.
 *
 * No hay red en estos tests: el 403 → 200 se midió a mano contra el contenedor y quedó consignado
 * en `docs/superpowers/runbooks/2026-09-25-gates-de-medios.md`, puerta G7.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = new URL('..', import.meta.url).pathname;
const INDEX_STRAPI = join(RAIZ, 'strapi', 'src', 'index.ts');
const DIR_API = join(RAIZ, 'strapi', 'src', 'api');

const fuente = (p) => readFileSync(p, 'utf8');

// ── 1. La lista declarada en el bootstrap ────────────────────────────────────
function publicApis() {
  const m = fuente(INDEX_STRAPI).match(/const PUBLIC_APIS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, 'no se encontró `const PUBLIC_APIS = [` en strapi/src/index.ts');
  return [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
}

// ── 2. Los content-types reales, leídos del schema (no del nombre de carpeta) ─
function contentTypes() {
  const out = new Map();
  for (const carpeta of readdirSync(DIR_API).sort()) {
    const schema = join(DIR_API, carpeta, 'content-types', carpeta, 'schema.json');
    if (!existsSync(schema)) continue;
    const s = JSON.parse(fuente(schema));
    out.set(carpeta, {
      singular: s.info.singularName,
      plural: s.info.pluralName,
      kind: s.kind,
    });
  }
  assert.ok(out.size >= 20, `el censo de content-types se encogió: ${out.size}`);
  return out;
}

const APIS = publicApis();
const CTS = contentTypes();

// Regresión nombrada, para que el día que alguien saque una de estas dos la falla se lea sola:
// son las dos que quedaron afuera cuando se crearon los content-types (puerta G7 del runbook), y
// las ocho láminas de relleno que D8 no jubilaba porque creía que ese 403 era lo que se veía en
// producción.
test('experimento e historia-visitante están declaradas a Público', () => {
  for (const api of ['experimento', 'historia-visitante']) {
    assert.ok(APIS.includes(api), `PUBLIC_APIS perdió '${api}': la superficie vuelve a 403`);
  }
});

test('todo content-type de strapi/src/api está en PUBLIC_APIS', () => {
  const afuera = [...CTS.keys()].filter((c) => !APIS.includes(c));
  assert.deepEqual(
    afuera,
    [],
    `sin permiso Público el sitio recibe 403 y pinta relleno: ${afuera.join(', ')}`,
  );
});

test('ninguna entrada de PUBLIC_APIS nombra un content-type que no existe', () => {
  const muertas = APIS.filter((a) => !CTS.has(a));
  assert.deepEqual(muertas, [], `entradas sin content-type en strapi/src/api: ${muertas.join(', ')}`);
});

test('el action api::<singular>.<singular>.<acción> que arma bootstrap existe por content-type', () => {
  // La plantilla del código, replicada acá a propósito: si el `singularName` del schema no es el
  // nombre que la lista usa, el `action` insertado no corresponde a ninguna ruta y el 403 sigue.
  const malas = APIS.filter((a) => CTS.get(a)?.singular !== a);
  assert.deepEqual(malas, [], `singularName distinto del nombre declarado: ${malas.join(', ')}`);
  const fuenteIndex = fuente(INDEX_STRAPI);
  assert.match(
    fuenteIndex,
    /`api::\$\{api\}\.\$\{api\}\.\$\{action\}`/,
    'bootstrap dejó de armar el action con la plantilla api::<nombre>.<nombre>.<acción>',
  );
  assert.match(
    fuenteIndex,
    /\[\s*'find'\s*,\s*'findOne'\s*\]/,
    'bootstrap dejó de otorgar find y findOne',
  );
});

// ── 3. Los endpoints que el sitio nombra, extraídos de src/ ──────────────────
/**
 * Excepciones DECLARADAS: endpoint nombrado en `src/` que no resuelve a ningún content-type. No
 * se "arreglan" acá, se nombran. `seo-landings` lo llaman dos veces
 * `src/pages/tierras/landing/[slug].astro` y no existe `api::seo-landing` ni tabla: el `fetch`
 * toma 404 (no 403), la página cae en su vacío y la puerta G7 no tiene nada que ver — lo que hace
 * falta es un content-type o borrar la ruta, y eso es decisión de contenido del dueño.
 */
const SIN_CONTENT_TYPE = new Set(['seo-landings']);

test('todo endpoint que lee el sitio sin token corresponde a un content-type abierto a Public', () => {
  const nombrados = new Set();
  const Patrones = [
    /strapi(?:Fetch|Single)(?:<[^>]*>)?\(\s*'([a-z0-9-]+)'/g,
    /fetchAllSlugs\(\s*'([a-z0-9-]+)'/g,
    /const ENDPOINT\s*=\s*'([a-z0-9-]+)'/g,
  ];

  const archivos = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|astro)$/.test(e.name)) archivos.push(p);
    }
  };
  walk(join(RAIZ, 'src'));

  for (const f of archivos) {
    const texto = fuente(f);
    for (const re of Patrones) {
      for (const m of texto.matchAll(re)) nombrados.add(m[1]);
    }
  }

  assert.ok(nombrados.size >= 20, `se esperaban ≥20 endpoints nombrados, hay ${nombrados.size}`);

  // endpoint -> carpeta, por singularName o pluralName (los dos son rutas reales en Strapi 5)
  const porEndpoint = new Map();
  for (const [carpeta, ct] of CTS.entries()) {
    porEndpoint.set(ct.singular, carpeta);
    porEndpoint.set(ct.plural, carpeta);
  }

  const huerfanos = [...nombrados]
    .filter((e) => !porEndpoint.has(e) && !SIN_CONTENT_TYPE.has(e))
    .sort();
  assert.deepEqual(huerfanos, [], `endpoints sin content-type: ${huerfanos.join(', ')}`);

  // Y los que sí existen tienen que estar abiertos: la ruta resuelve, pero la puerta es la lista.
  const cerrados = [...nombrados]
    .filter((e) => porEndpoint.has(e))
    .filter((e) => !APIS.includes(porEndpoint.get(e)))
    .sort();
  assert.deepEqual(cerrados, [], `endpoints leídos por el sitio sin permiso Público: ${cerrados.join(', ')}`);
});
