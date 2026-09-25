/**
 * El envase de alias que el importador recibe con `--alias=<ruta>` es un archivo de
 * decisiones editoriales, y este teste no decide ninguna: verifica que las 33 filas
 * PROPUESTAS (`strapi/scripts/media-alias-propuesto.json`) son mecánicamente válidas
 * —el archivo existe en el inventario, el endpoint está en la tabla del manifiesto,
 * el campo es de los que la tabla declara, el slug y el documentId no se repiten— y
 * que `manifesto()` las firma a todas sin mandar una sola a `motivosAlias`.
 *
 * Por qué vale la pena un teste sobre un `.json` que aún no se aplica: la puerta del
 * dueño (`--apply`) es la que escribe, pero el trabajo previo era transcribir 27 pares
 * de `alias-firmes.json` y 6 series de galería a la forma que exige el contrato, y una
 * transcripción a mano es justo donde nace un alias que apunta a un registro equivocado.
 * Con este teste, un archivo mal escrito o un endpoint fuera de tabla se ve acá, no el
 * día del `--apply`.
 *
 * Las dos formas no son un capricho: los 6 `proyecto-meliponarios` tienen `slug: null`
 * medido en 6/6, así que ninguna regla por nombre los firma; solo una clave `documentId`
 * puede. Por eso el teste separa las filas por forma y exige a cada una lo suyo.
 *
 * Y la segunda mitad, que es la que protege el estado actual: `media-alias.json` (el
 * nombre que el importador usaría si alguien le pasa la ruta por defecto) sigue vacío
 * en su clave `alias`. proponente ≠ aplicado.
 *
 * El envase es parte del contrato, y no lo inventó este teste: `leerAlias()` exige
 * `{"aviso": …, "alias": {…}}` y aborta con `no trae un objeto en la clave "alias"`
 * ante un mapa pelado. Medido el 2026-09-25 con este archivo escrito como mapa
 * directo — las filas pasaban `manifesto()` verdes y ni por enterado de que el
 * CLI las rechazaba antes de leerlas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifesto, ENDPOINTS_CON_MEDIO, archivosDelEnlace } from '../strapi/scripts/lib/media-manifest.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PROPUESTA = join(RAIZ, 'strapi/scripts/media-alias-propuesto.json');

const crudo = JSON.parse(readFileSync(PROPUESTA, 'utf8'));
const alias = crudo.alias;
const entradas = Object.entries(alias);
// Forma 1 = la clave es la ruta del archivo. Forma 2 = la clave es el documentId.
const F1 = entradas.filter(([, f]) => 'slug' in f);
const F2 = entradas.filter(([, f]) => 'archivos' in f);
/** 27 tapas de bitácora + 6 series de proyecto: lo que hay que revisar, contado. */
const FILAS_F1 = 27;
const FILAS_F2 = 6;
/**
 * Las 12 rutas que a PROPÓSITO no tienen fila: 9 tapas de bitácora sin par firme (la
 * disputa `miel-chef`/`miel-cocina`, dos ambigüedades de cosecha, `modulo6`/`modulo9`
 * flojos, `territorio-pijao` sin decidir y dos tapas cuyo artículo no existe en la BD)
 * y 3 archivos de producto ambigüos. Enumeradas, no derivadas: si una de estas cambia
 * de estado, este teste se pone rojo y alguien la lee.
 */
const SIN_PROPUESTA = [
  'public/images/bitacora/bitacora-calendario-manejo.webp',
  'public/images/bitacora/bitacora-conservacion-cosecha.webp',
  'public/images/bitacora/bitacora-cosecha-miel.webp',
  'public/images/bitacora/bitacora-miel-chef.webp',
  'public/images/bitacora/bitacora-miel-cocina.webp',
  'public/images/bitacora/bitacora-modulo6-division.webp',
  'public/images/bitacora/bitacora-modulo9-cosecha.webp',
  'public/images/bitacora/bitacora-red-meliponicultores.webp',
  'public/images/bitacora/bitacora-territorio-pijao.webp',
  'public/images/galeria/producto-caja-1.webp',
  'public/images/galeria/producto-miel-1.webp',
  'public/images/galeria/producto-miel-2.webp',
];

test('el archivo viene en el envase que `leerAlias()` acepta: {aviso, alias}', () => {
  // Mismo predicado que strapi/scripts/media-import.mjs:leerAlias — si el de allá
  // cambia, la otra mitad de este par de testes (tests/media-flags.test.mjs) la
  // corre contra el CLI real y lo descubre.
  const acepta = (c) => !!c?.alias && typeof c.alias === 'object' && !Array.isArray(c.alias);
  assert.ok(acepta(crudo), 'el importador abortaría antes de leer una fila');
  assert.ok(Array.isArray(crudo.aviso) && crudo.aviso.length > 0, 'un envase sin aviso no dice a quién le toca revisar esto');
  assert.ok(crudo.aviso.every((l) => typeof l === 'string' && l.length > 0));
  assert.ok(!acepta(F1.reduce((o, [r, f]) => Object.assign(o, { [r]: f }), {})), 'el mapa pelado tiene que seguir siendo rechazado');
});

test('cada fila es de UNA forma del contrato, ni mezcla ni invento', () => {
  for (const [clave, f] of entradas) {
    const forma1 = 'slug' in f;
    const forma2 = 'archivos' in f;
    assert.ok(!(forma1 && forma2), `${clave}: no puede traer slug y archivos a la vez`);
    assert.ok(forma1 || forma2, `${clave}: fila que no es forma 1 ni forma 2`);
  }
  assert.equal(F1.length, FILAS_F1, 'creció la propuesta: hay que revisar la cuenta y decirlo acá');
  assert.equal(F2.length, FILAS_F2, 'creció la propuesta: hay que revisar la cuenta y decirlo acá');
});

test('forma 1: endpoint de la tabla, slug de texto, archivo en su directorio y en el inventario', () => {
  for (const [ruta, fila] of F1) {
    assert.ok(fila.endpoint in ENDPOINTS_CON_MEDIO, `${ruta}: endpoint fuera de la tabla: ${fila.endpoint}`);
    assert.equal(typeof fila.slug, 'string', `${ruta}: falta el slug`);
    assert.ok(fila.slug.length > 0, `${ruta}: slug vacío`);
    assert.ok(!('campo' in fila), `${ruta}: la forma 1 no declara campo, lo da la tabla`);
    // Un archivo del directorio de `bitacora` no puede declararse contra un endpoint de otro.
    assert.ok(ruta.startsWith(`public/images/${ENDPOINTS_CON_MEDIO[fila.endpoint].dir}/`),
      `${ruta}: saca el archivo del directorio de ${fila.endpoint}`);
    assert.ok(existsSync(join(RAIZ, ruta)), `${ruta}: un alias que nombra un archivo inexistente no se puede firmar`);
  }
});

test('forma 2: clave con pinta de documentId, campo repetible de la tabla y archivos existentes', () => {
  for (const [clave, fila] of F2) {
    assert.match(clave, /^[a-z0-9]{24}$/, `${clave}: la forma 2 se declara por documentId`);
    assert.ok(fila.endpoint in ENDPOINTS_CON_MEDIO, `${clave}: endpoint fuera de la tabla: ${fila.endpoint}`);
    const cfg = ENDPOINTS_CON_MEDIO[fila.endpoint];
    assert.equal(fila.campo, cfg.campoMultiple,
      `${clave}: una fila de varios archivos solo puede ir al campo repetible de ${fila.endpoint}`);
    assert.ok(Array.isArray(fila.archivos) && fila.archivos.length > 0, `${clave}: archivos vacío`);
    for (const a of fila.archivos) {
      assert.equal(typeof a, 'string', `${clave}: archivo que no es ruta`);
      assert.ok(a.startsWith(`public/images/${cfg.dir}/`), `${clave}: ${a} saca el archivo del directorio de ${fila.endpoint}`);
      assert.ok(existsSync(join(RAIZ, a)), `${clave}: ${a} no existe en disco`);
    }
    assert.equal(new Set(fila.archivos).size, fila.archivos.length, `${clave}: el mismo archivo dos veces en la misma serie`);
  }
});

test('ningún archivo se declara dos veces: ni entre dos filas, ni entre las dos formas', () => {
  const vistos = new Map();
  const ver = (ruta, clave) => {
    assert.equal(vistos.get(ruta), undefined, `${ruta}: lo reclaman ${vistos.get(ruta) ?? ''} y ${clave}`);
    vistos.set(ruta, clave);
  };
  for (const [ruta] of F1) ver(ruta, 'forma 1');
  for (const [clave, fila] of F2) for (const a of fila.archivos) ver(a, clave);
});

test('los destinos son distintos: dos tapas al mismo slug es disputa, y dos filas al mismo documentId también', () => {
  const slugVisto = new Map();
  for (const [ruta, fila] of F1) {
    assert.equal(slugVisto.get(fila.slug), undefined, `${fila.slug}: lo reclaman ${slugVisto.get(fila.slug) ?? ''} y ${ruta}`);
    slugVisto.set(fila.slug, ruta);
  }
  assert.equal(new Set(F2.map(([c]) => c)).size, F2.length, 'dos filas para el mismo documentId');
  // Y las dos formas no se solapan: una clave de 24 caracteres no es una ruta.
  assert.deepEqual(F2.map(([c]) => c).filter((c) => c.includes('/')), [], 'una forma 2 con clave de ruta');
});

test('manifesto() firma las 33 filas y no manda ninguna a motivosAlias', () => {
  // Los registros se derivan de la propia propuesta: lo que se prueba acá es la forma
  // del alias contra el resolutor real, no que la API exista (eso se midió por lectura
  // pública: los 27 slugs y los 6 documentId están en la BD del runtime).
  const registros = [
    ...F1.map(([ruta, fila], i) => ({
      endpoint: fila.endpoint,
      documentId: `d${i}`,
      slug: fila.slug,
      ...(ENDPOINTS_CON_MEDIO[fila.endpoint].tieneMarca ? { marca: 'meliponas' } : {}),
    })),
    // Los proyectos reales: `slug: null` medido en 6/6, identidad solo por documentId.
    ...F2.map(([clave, fila]) => ({ endpoint: fila.endpoint, documentId: clave, slug: null })),
  ];
  // El inventario es el DISCO, no lo que la propuesta dice que tocó. Con la lista de la
  // propia propuesta como inventario, una fila que olvida un archivo no lo deja
  // pendiente: sencillamente nunca existió (medido: `ambala-2` fuera de su fila daba
  // verde). Las 48 rutas de `bitacora/` y `galeria/` son lo que el importador ve.
  const archivos = [...F1.map(([ruta]) => ruta), ...F2.flatMap(([, f]) => f.archivos)];
  const EN_DIRECTORIOS = new Set(['bitacora', 'galeria']);
  const inventario = [...EN_DIRECTORIOS]
    .flatMap((d) => readdirSync(join(RAIZ, 'public', 'images', d))
      .filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
      .map((f) => `public/images/${d}/${f}`))
    .sort();
  assert.equal(inventario.length, 48, 'el inventario cambió: hay que recountar qué se propuso y qué no');
  const m = manifesto({ archivos: inventario, registros, alias });

  assert.deepEqual(m.motivosAlias, [], `ninguna fila se pudo firmar: ${JSON.stringify(m.motivosAlias)}`);
  assert.equal(m.enlazar.length, entradas.length, 'enlazar no cubre exactamente la propuesta');
  // Ningún archivo de la propuesta queda sin enlazar...
  const enlazados = new Set(m.enlazar.flatMap(archivosDelEnlace));
  assert.deepEqual(archivos.filter((a) => !enlazados.has(a)), [], 'un archivo propuesto y no enlazado es un alias que no ató');
  // ...y lo que NO queda enlazado son exactamente los 12 que se saben sin decisión: 9 tapas
  // de bitácora y 3 archivos de producto. Si mañana alguien agrega una tapa y no la propone,
  // esta igualdad la nombra.
  assert.deepEqual(inventario.filter((a) => !enlazados.has(a)).sort(), [...SIN_PROPUESTA].sort(),
    'la cuenta de archivos huérfanos cambió');
  // `archivosDelEnlace` es el helper del contrato para esto: una serie de UN solo
  // archivo sale con `archivo`, no con `archivos` (bonifacio, esperanza y poblado lo
  // midieron). Discriminar por la presencia de `archivos` reordenaba esas tres.
  assert.equal(
    m.enlazar.reduce((n, e) => n + archivosDelEnlace(e).length, 0),
    archivos.length,
    'la cuenta de archivos enlazados no cierra con la del inventario de la propuesta',
  );

  const documentIdPorSlug = new Map(registros.map((r) => [r.slug, r.documentId]));
  const destinosF2 = new Set(F2.map(([c]) => c));
  for (const enlace of m.enlazar) {
    const los = archivosDelEnlace(enlace);
    assert.equal(enlace.origen, 'alias', `${los[0]}: el enlace no vino del alias`);
    if (destinosF2.has(enlace.documentId)) {
      // Forma 2: el campo y el orden los fija la fila declarada, no la tabla.
      const fila = alias[enlace.documentId];
      assert.equal(enlace.campo, fila.campo, `${los[0]}: campo inesperado para ${enlace.documentId}`);
      assert.deepEqual(los, fila.archivos, `${enlace.documentId}: se reordenó o se recortó la serie`);
    } else {
      assert.equal(enlace.campo, ENDPOINTS_CON_MEDIO[enlace.endpoint].campo, `${los[0]}: campo inesperado`);
      assert.equal(enlace.documentId, documentIdPorSlug.get(alias[los[0].replace(RAIZ + '/', '')].slug));
    }
  }
});

test('lo propuesto no es lo aplicado: el `alias` de `media-alias.json` sigue vacío', () => {
  const aplicado = JSON.parse(readFileSync(join(RAIZ, 'strapi/scripts/media-alias.json'), 'utf8'));
  assert.deepEqual(aplicado.alias, {}, 'si alguien llenó el envase, la puerta del dueño se abrió sin decirlo');
});
