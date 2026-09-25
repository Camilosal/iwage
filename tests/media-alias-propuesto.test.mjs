/**
 * El envase de alias que el importador recibe con `--alias=<ruta>` es un archivo de
 * decisiones editoriales, y este teste no decide ninguna: verifica que las 27 filas
 * PROPUESTAS (`strapi/scripts/media-alias-propuesto.json`) son mecánicamente válidas
 * —el archivo existe en el inventario, el endpoint está en la tabla del manifiesto,
 * el slug no se repite— y que `manifesto()` las firma a todas sin mandar una sola a
 * `motivosAlias`.
 *
 * Por qué vale la pena un teste sobre un `.json` que aún no se aplica: la puerta del
 * dueño (`--apply`) es la que escribe, pero el trabajo previo era transcribir 27 pares
 * de `alias-firmes.json` a la forma que exige el contrato, y una transcripción a mano
 * es justo donde nace un alias que apunta a un registro equivocado. Con este teste,
 * un archivo mal escrito o un endpoint fuera de tabla se ve acá, no el día del `--apply`.
 *
 * Y la segunda mitad, que es la que protege el estado actual: `media-alias.json` (el
 * nombre que el importador usaría si alguien le pasa la ruta por defecto) sigue vacío
 * en su clave `alias`. proponente ≠ aplicado.
 *
 * El envase es parte del contrato, y no lo inventó este teste: `leerAlias()` exige
 * `{"aviso": …, "alias": {…}}` y aborta con `no trae un objeto en la clave "alias"`
 * ante un mapa pelado. Medido el 2026-09-25 con este archivo escrito como mapa
 * directo — las 27 filas pasaban `manifesto()` verdes y ni por enterado de que el
 * CLI las rechazaba antes de leerlas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifesto, ENDPOINTS_CON_MEDIO } from '../strapi/scripts/lib/media-manifest.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PROPUESTA = join(RAIZ, 'strapi/scripts/media-alias-propuesto.json');

const crudo = JSON.parse(readFileSync(PROPUESTA, 'utf8'));
const alias = crudo.alias;
const filas = Object.entries(alias ?? {});

test('el archivo viene en el envase que `leerAlias()` acepta: {aviso, alias}', () => {
  // Mismo predicado que strapi/scripts/media-import.mjs:leerAlias — si el de allá
  // cambia, la otra mitad de este par de testes (tests/media-flags.test.mjs) la
  // corre contra el CLI real y lo descubre.
  const acepta = (c) => !!c?.alias && typeof c.alias === 'object' && !Array.isArray(c.alias);
  assert.ok(acepta(crudo), 'el importador abortaría antes de leer una fila');
  assert.ok(Array.isArray(crudo.aviso) && crudo.aviso.length > 0, 'un envase sin aviso no dice a quién le toca revisar esto');
  assert.ok(crudo.aviso.every((l) => typeof l === 'string' && l.length > 0));
  assert.ok(!acepta(filas.reduce((o, [r, f]) => Object.assign(o, { [r]: f }), {})), 'el mapa pelado tiene que seguir siendo rechazado');
});

test('la propuesta no está vacía y todas sus rutas existen en el inventario', () => {
  assert.ok(filas.length > 0, 'sin filas no hay nada que revisar: si se borra la propuesta, se borra este teste con ella');
  const ausentes = filas.filter(([ruta]) => !existsSync(join(RAIZ, ruta)));
  assert.deepEqual(ausentes.map(([r]) => r), [], 'un alias que nombra un archivo inexistente no se puede firmar');
});

test('cada fila tiene la forma 1 del contrato: endpoint de la tabla y slug de texto', () => {
  for (const [ruta, fila] of filas) {
    assert.equal(typeof fila.endpoint, 'string', `${ruta}: falta \`endpoint\``);
    assert.ok(fila.endpoint in ENDPOINTS_CON_MEDIO, `${ruta}: endpoint fuera de la tabla: ${fila.endpoint}`);
    assert.equal(typeof fila.slug, 'string', `${ruta}: falta \`slug\``);
    assert.ok(fila.slug.length > 0, `${ruta}: slug vacío`);
    // Un archivo del directorio de `bitacora` no puede declararse contra un endpoint de otro directorio.
    assert.ok(ruta.startsWith(`public/images/${ENDPOINTS_CON_MEDIO[fila.endpoint].dir}/`),
      `${ruta}: saca el archivo del directorio de ${fila.endpoint}`);
  }
});

test('los slugs son distintos: dos tapas al mismo registro es una disputa, no un alias', () => {
  const vistos = new Map();
  for (const [ruta, fila] of filas) {
    const previo = vistos.get(fila.slug);
    assert.equal(previo, undefined, `${fila.slug}: lo reclaman ${previo ?? ''} y ${ruta}`);
    vistos.set(fila.slug, ruta);
  }
});

test('manifesto() firma las 27 filas y no manda ninguna a motivosAlias', () => {
  // Los registros se derivan de la propia propuesta: lo que se prueba acá es la forma
  // del alias contra el resolutor real, no que la API exista (eso se ve en el dry-run).
  const registros = filas.map(([ruta, fila], i) => ({
    endpoint: fila.endpoint,
    documentId: `d${i}`,
    slug: fila.slug,
    marca: 'meliponas',
    ...(ENDPOINTS_CON_MEDIO[fila.endpoint].tieneMarca ? { marca: 'meliponas' } : {}),
  }));
  const m = manifesto({ archivos: filas.map(([ruta]) => ruta), registros, alias });

  assert.deepEqual(m.motivosAlias, [], `ninguna fila se pudo firmar: ${JSON.stringify(m.motivosAlias)}`);
  assert.equal(m.enlazar.length, filas.length, 'enlazar no cubre exactamente la propuesta');
  assert.deepEqual(m.pendientes, [], 'una tapa propuesta y pendiente es un alias que no ató');

  const documentIdPorSlug = new Map(registros.map((r) => [r.slug, r.documentId]));
  for (const enlace of m.enlazar) {
    assert.equal(enlace.origen, 'alias', `${enlace.archivo}: el enlace no vino del alias`);
    assert.equal(enlace.campo, ENDPOINTS_CON_MEDIO[enlace.endpoint].campo, `${enlace.archivo}: campo inesperado`);
    assert.equal(enlace.documentId, documentIdPorSlug.get(alias[enlace.archivo.replace(RAIZ + '/', '')].slug));
  }
});

test('lo propuesto no es lo aplicado: el `alias` de `media-alias.json` sigue vacío', () => {
  const aplicado = JSON.parse(readFileSync(join(RAIZ, 'strapi/scripts/media-alias.json'), 'utf8'));
  assert.deepEqual(aplicado.alias, {}, 'si alguien llenó el envase, la puerta del dueño se abrió sin decirlo');
});
