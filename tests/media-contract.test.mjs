/**
 * Contrato de medios: `strapiImage()` murió y no vuelve.
 *
 * Este teste es deliberadamente tonto: lee texto fuente y no importa nada de
 * `src/`. Importar `src/lib/strapi.ts` arrastraría `./redis`, que abre conexiones
 * de ioredis al cargarse. Aquí no hace falta ejecutar nada: lo que se corta es
 * que alguien vuelva a prefijar el host interno de Docker (`http://iwage_strapi:1337`)
 * en una URL que pinta en el HTML del navegador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function archivosEn(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivosEn(p));
    else if (/\.(astro|ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

test('nadie vuelve a importar strapiImage: la resolución de URLs es mediaSrc', () => {
  const culpables = archivosEn(SRC)
    .filter((f) => /strapiImage/.test(readFileSync(f, 'utf8')))
    .join(', ');
  assert.equal(culpables, '', `still referencing strapiImage: ${culpables}`);
});

// El host interno solo es un problema cuando se usa COMO URL: atributo src/href/content,
// cadena entre comillas o url() de CSS. No cuando un staff lo lee en la tabla de variables
// de entorno de `/ayuda/equipo/configuracion` — ahí es documentación legítima del CMS.
const URL_INTERNA = /["'`(]\s*https?:\/\/iwage_strapi(?::1337)?\b/;

test('ninguna URL interna de Strapi puede llegar al HTML', () => {
  const culpables = archivosEn(join(SRC, 'pages'))
    .filter((f) => URL_INTERNA.test(readFileSync(f, 'utf8')))
    .join(', ');
  assert.equal(culpables, '', `hardcoded internal host in pages: ${culpables}`);
});
