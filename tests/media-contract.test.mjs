/**
 * Contrato de medios: `strapiImage()` murió y no vuelve.
 *
 * Este teste es deliberadamente tonto: lee texto fuente y no importa nada de
 * `src/`. Importar `src/lib/strapi.ts` arrastraría `./redis`, que abre conexiones
 * de ioredis al cargarse. Aquí no hace falta ejecutar nada: lo que se corta es
 * que alguien vuelva a construir, a mano y desde `src/`, la URL de un medio que
 * termina pintando en el HTML del navegador.
 *
 * Dos puertas, las dos medidas sobre TODO `src/**` (`.astro`/`.ts`/`.tsx`), porque
 * el bug original no vivía en `src/pages`: `strapiImage()` estaba en `src/lib/` y
 * de las 34 llamadas migradas, 19 eran `src/lib/*.ts` y el resto `src/components`
 * y `src/pages`. Escanear solo `src/pages` habría dejado el contrato decorativo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

/** Ruta relativa a `src/`, con separadores normalizados, para los mensajes. */
function enSrc(archivo) {
  return relative(SRC, archivo).replace(/\\/g, '/');
}

/** `archivo:línea: código` por cada línea que casa, para que el rojo diga el motivo. */
function lineasQueCasan(archivos, patron, motivo) {
  const culpables = [];
  for (const archivo of archivos) {
    readFileSync(archivo, 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        if (patron.test(linea)) {
          culpables.push(`${motivo}\n    ${enSrc(archivo)}:${i + 1}: ${linea.trim().slice(0, 160)}`);
        }
      });
  }
  return culpables;
}

test('nadie vuelve a importar strapiImage: la resolución de URLs es mediaSrc', () => {
  const culpables = archivosEn(SRC)
    .filter((f) => /strapiImage/.test(readFileSync(f, 'utf8')))
    .join(', ');
  assert.equal(culpables, '', `still referencing strapiImage: ${culpables}`);
});

// ── Dueños legítimos del base de Strapi (exclusiones DECLARADAS, no accidentadas) ──
// `src/lib/strapi.ts`: declara `STRAPI_URL` y hace el único `fetch` server-side a
//   `/api/...` — ahí el host interno es correcto, nunca pinta en el HTML.
// `src/lib/media.ts`: lee `process.env.STRAPI_URL` y compara hosts (`isSelfHost`) para
//   QUITAR el prefijo; es la función que este contrato exige usar.
// Ningún otro módulo de `src/` necesita el base de Strapi para pintar un medio: eso lo
// hacen `mediaSrc()` (relativo de sitio) y `absUrl()` (para og:image / JSON-LD / feeds).
const DUENOS_DEL_BASE = new Set(['lib/strapi.ts', 'lib/media.ts']);

// (1) URL de medio construida a mano interpolando o sumando el base de Strapi — la forma
//     exacta del bug: el cuerpo de `strapiImage()` era `${STRAPI_URL}${path}` y desde ahí el
//     valor con host interno llegaba al `<img src>`. Case-sensitive a propósito: una variable
//     local llamada `strapiUrl` (p. ej. el `_health` de `src/pages/api/health.ts:10`) no es
//     este contrato; lo que no puede volver es leer la variable de entorno en la plantilla.
//     Medido con grep: hoy ninguna línea de `src/` fuera de `lib/strapi.ts` escribe ese
//     patrón. Si alguna vez la documentación de staff lo necesitara en prosa, la excepción se
//     declara aquí (como `DUENOS_DEL_BASE`), nunca se degrada la regla para que pase.
const URL_DE_STRAPI_A_MANO = /\$\{[^}\n]*\bSTRAPI_URL\b[^}\n]*\}|\bSTRAPI_URL\b\s*\+/;

// (2) Host interno escrito como LITERAL DE CADENA con scheme: es la URL que un navegador
//     intentaría pedir (`iwage_strapi` sin puerto es igual de inalcanzable que con `:1337`).
//     Exige que el `http(s)://` vaya pegado a la comilla de apertura del literal (comilla
//     doble, comilla simple o backtick), o sea: solo código. Por eso no casa con la prosa de
//     `/ayuda/equipo/configuracion`, donde `http://iwage_strapi:1337` está dentro de un nodo
//     de texto HTML tras «(ej: » y sin comilla que lo delimite
//     (`src/pages/ayuda/equipo/configuracion.astro:36`).
//     Esta regla no necesita excluidos: `lib/media.ts:55` compara el host sin scheme
//     (`host === 'iwage_strapi'`) y `lib/strapi.ts:7` usa `http://localhost:1337`, así que
//     ninguno de los dos casa; la exclusión declarada (`DUENOS_DEL_BASE`) es para la regla 1.
const HOST_INTERNO_LITERAL = /["'`]\s*https?:\/\/iwage_strapi(?::1337)?\b/;

test('ninguna URL de Strapi construida a mano puede llegar al HTML: ni host interno ni ${STRAPI_URL}', () => {
  const todos = archivosEn(SRC);
  const fueraDelBase = todos.filter((f) => !DUENOS_DEL_BASE.has(enSrc(f)));

  const culpables = [
    ...lineasQueCasan(fueraDelBase, URL_DE_STRAPI_A_MANO, 'base de Strapi interpolado/sumado fuera de sus dueños'),
    ...lineasQueCasan(todos, HOST_INTERNO_LITERAL, 'host interno de Strapi como literal de URL'),
  ].join('\n  ');

  assert.equal(
    culpables,
    '',
    `URLs de Strapi construidas a mano en src/ — deben pasar por mediaSrc()/absUrl():\n  ${culpables}`.trim(),
  );
});
