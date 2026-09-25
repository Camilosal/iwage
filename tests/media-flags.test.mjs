/**
 * El parseo de flags del importador, aparte del script (strapi/scripts/lib/
 * media-flags.mjs) justamente para poder testealo SIN servidor, sin red y sin
 * credenciales: es el único guard que impide que esta herramienta escriba en la
 * BD, y un guard que no se puede romper en un teste no es un guard.
 *
 * El último teste sí corre el CLI, pero con una invocación que tiene que salir
 * antes de mirar el entorno: nada de aquí toca un host.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsearFlags } from '../strapi/scripts/lib/media-flags.mjs';

const SCRIPT = fileURLToPath(new URL('../strapi/scripts/media-import.mjs', import.meta.url));

test('--apply a secas es el único modo que escribe', () => {
  assert.equal(parsearFlags(['--apply']).modo, 'aplicar');
});

test('sin flags y con --dry-run son el mismo camino: dry-run', () => {
  assert.equal(parsearFlags([]).modo, 'dry-run');
  assert.equal(parsearFlags(['--dry-run']).modo, 'dry-run');
});

test('--dry-run y --apply a la vez es un conflicto, no un empate a favor de la escritura', () => {
  for (const argv of [['--dry-run', '--apply'], ['--apply', '--dry-run']]) {
    assert.equal(parsearFlags(argv).modo, 'conflicto', argv.join(' '));
  }
});

test('un flag desconocido no se decide por defecto y se reporta pelado', () => {
  const o = parsearFlags(['--apply-x=secreta', '--alias', 'x']);
  assert.equal(o.modo, 'invalido');
  // `--alias` sin `=<ruta>` y `--alias` con el valor vacío son argumentos sueltos:
  // reconocerlos sin ruta habría dejado el alias declarado en el aire.
  assert.deepEqual(o.desconocidas, ['--apply-x=secreta', '--alias', 'x']);
  assert.deepEqual(parsearFlags(['--alias=']).modo, 'invalido');
});

test('--alias=<ruta> se recoge y no es un flag desconocido', () => {
  const o = parsearFlags(['--dry-run', '--alias=/tmp/alias-de-ejemplo.json']);
  assert.equal(o.modo, 'dry-run');
  assert.equal(o.alias, '/tmp/alias-de-ejemplo.json');
  assert.deepEqual(o.desconocidas, []);
  assert.equal(parsearFlags([]).alias, null);
});

// --- el guard, del lado del CLI: que la contradicción salga ANTES de todo -----

const SIN_ENV = { ...process.env, STRAPI_URL: '', STRAPI_TOKEN: '' };

test('el CLI aborta con --dry-run --apply antes de mirar el entorno', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dry-run', '--apply'], {
    encoding: 'utf8',
    env: SIN_ENV,
  });
  // Exit 2 (flag), no 1 (entorno): la contradicción se resuelve antes de leer
  // credenciales, así que tampoco puede acabar en una corrida a medias.
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--dry-run/);
  assert.match(r.stderr, /--apply/);
  // Y la salida no tiene valor de credencial alguno: el script no reimprime argumentos.
  assert.doesNotMatch(r.stderr, /secreta|Bearer/i);
});

test('el CLI con --apply y sin credenciales aborta en el guard del entorno', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--apply'], { encoding: 'utf8', env: SIN_ENV });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /STRAPI_URL y STRAPI_TOKEN/);
});
