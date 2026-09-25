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
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

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

// ── Task 7: un solo tipo de galería, y un solo juego de campos ──────────────
// ── Task 8: además, una sola GALERÍA física (MediaGallery); ProductGallery se borró ──
//
// El grep que pidió el plan (`GaleriaItem|GalleryItem`) borra los duplicados pero no ve la
// mitad que sí rompe el sitio en el navegador: `MediaItem` renombra `tipo`→`kind` y
// `titulo`→`caption`, y `astro build` SOLO borra tipos, no los verifica. Una lectura
// `item.tipo` que sobreviva da build verde, página 200 y galería pintando vacío. Es
// especialmente fácil de dejar viva porque la galería serializa sus `items` a un
// `<script type="application/json">` y VUELVEN a leerlos en el cliente: server y navegador
// tienen que nombrar los mismos campos, y ningún compilador lo comprueba aquí.
//
// Fix round 1 (review): este gate leía el texto COMPLETO del archivo, así que podía poner la
// suite roja siendo el código correcto. Dos cambios, los dos medidos (informe, "Fix round 1"):
//   (a) los comentarios se borran antes de casar — «aquí antes se leía `item.tipo`» o un JSDoc
//       que nombre `GalleryItem` es documentación, no el bug que este gate corta;
//   (b) las lecturas históricas se anclan a la forma que está en juego: un `prop.titulo` o un
//       `cultivo.tipo` legítimos dentro de un componente de galería no son un `MediaItem`.
// Los dientes no se perdieron: contra `git show a0552b5:src/components/shared/MediaGallery.astro`
// (el árbol ANTES del rename) el mismo código sigue casando 18 lecturas, y el gate de
// `GalleryItem` sigue cayendo sobre ese árbol.
//
// Task 8 borra `ProductGallery.astro`. El barrido no puede quedarse mirando un archivo que
// ya no está (readFileSync daría ENOENT) ni reducirse a la nada: `GALERIAS` pasa a listar la
// galería única y un gate nuevo —`ProductGallery.astro` fuera del árbol y sin referencias
// vivas en `src/`— es lo que impide que el componente borrado resucite y vuelva a dividir
// el contrato en dos. La medición histórica (18 lecturas en MediaGallery + 16 en
// ProductGallery contra `a0552b5`) queda como referencia de que el barrido sigue siendo el
// mismo código sobre una ruta menos.
const GALERIAS = ['components/shared/MediaGallery.astro'];

/**
 * Receptores que en ESTAS galerías son un `MediaItem`, medidos en los cuatro
 * árboles (HEAD de la galería única y `git show a0552b5:` de las dos componentes
 * históricas): `items` es el array normalizado, `item`/`it` son sus elementos en los
 * `map` y en el `<script>` del navegador, `first` era el `items[0]` de la galería de
 * producto (se queda: es también un nombre natural en cualquier variante futura) y
 * `*Item` cubre cualquier variable declarada como un item. El filtro de coherencia
 * del test (punto 4) comprueba que ningún receptor que lee `kind`/`caption` se quede
 * fuera de esta lista, así que renombrar la variable del `map` (`entry.kind`) rompe
 * el test con un mensaje explícito en vez de dejar el gate silencioso.
 */
const ITEM_RECEPTOR = String.raw`\b(?:items\s*\[[^\]]*\]|[A-Za-z_$][A-Za-z0-9_$]*[Ii]tem|item|it|first)`;
const LECTURA_LEGADA_DE_ITEM = new RegExp(`${ITEM_RECEPTOR}\\s*\\.\\s*(?:tipo|titulo)\\b`);

test('el tipo de galería es uno solo: no vuelve GaleriaItem ni GalleryItem', () => {
  const culpables = archivosEn(SRC)
    .filter((f) => /\b(GaleriaItem|GalleryItem)\b/.test(sinComentarios(readFileSync(f, 'utf8'))))
    .map((f) => enSrc(f))
    .join(', ');
  assert.equal(culpables, '', `duplicados del tipo de galería todavía presentes: ${culpables}`);
});

// Task 8: la consolidación física. `ProductGallery.astro` se borró con `git rm` y las dos
// fichas de producto migraron a MediaGallery; este gate es lo que mantiene vivo el barrido
// de GALERIAS (una sola ruta) sin dejarlo decorativo: si el componente vuelve al árbol o
// algún `import` vivo lo referencia otra vez, la suite se pone roja nombrando el culpable.
// Se barren también los comentarios — tras el borrado no debe quedar NI la mención.
test('la galería es una sola: ProductGallery no resucita ni se referencia', () => {
  assert.equal(
    existsSync(join(SRC, 'components/shared/ProductGallery.astro')),
    false,
    'components/shared/ProductGallery.astro volvió al árbol: MediaGallery es la única galería (Task 8)',
  );
  const culpables = archivosEn(SRC)
    .filter((f) => /ProductGallery/.test(readFileSync(f, 'utf8')))
    .map((f) => enSrc(f))
    .join(', ');
  assert.equal(culpables, '', `referencias a ProductGallery en src/: ${culpables}`);
});

test('los campos de galería de los modelos declaran MediaItem[] | null', () => {
  const culpables = [];
  for (const ruta of ['lib/tienda.ts', 'lib/proyectos.ts', 'lib/polinizacion.ts']) {
    const fuente = readFileSync(join(SRC, ruta), 'utf8');
    if (!/galeria:\s*MediaItem\[\]\s*\|\s*null/.test(fuente)) culpables.push(`${ruta}: galeria no declara MediaItem[] | null`);
  }
  const naturaleza = readFileSync(join(SRC, 'lib/naturaleza.ts'), 'utf8');
  if (!/function experienciaGaleria\([^)]*\)\s*:\s*MediaItem\[\]/.test(naturaleza)) {
    culpables.push('lib/naturaleza.ts: experienciaGaleria() no devuelve MediaItem[]');
  }
  assert.deepEqual(culpables, []);
});

/** `ruta:linea: código` por cada lectura histórica de un item, sobre el código sin comentarios. */
function lecturasLegadas(ruta) {
  return sinComentarios(readFileSync(join(SRC, ruta), 'utf8'))
    .split('\n')
    .map((linea, i) => [i + 1, linea])
    .filter(([, linea]) => LECTURA_LEGADA_DE_ITEM.test(linea))
    .map(([n, linea]) => `    ${ruta}:${n}: ${linea.trim().slice(0, 140)}`);
}

test('la galería lee kind/caption/alt también en el script del navegador', () => {
  // (1) Ninguna lectura `.tipo`/`.titulo` SOBRE UN ITEM: en un MediaItem son `undefined` y el
  //     visor se queda en blanco sin que el build se entere. Anclado al receptor, un
  //     `prop.titulo` o un `cultivo.tipo` de este componente son otra cosa y no casan.
  //     Se barren TODAS las rutas de GALERIAS antes de assertir: el rojo tiene que nombrar
  //     de una vez todas las líneas vivas — contra el árbol histórico `a0552b5` este mismo
  //     código casaba 18 lecturas en MediaGallery (y 16 en la ya borrada ProductGallery) —,
  //     no solo las de la primera que cae.
  const legadas = GALERIAS.flatMap((ruta) => lecturasLegadas(ruta)).join('\n');
  assert.equal(legadas, '', 'las galerías siguen leyendo campos de la forma histórica sobre un item (una por línea):\n' + legadas);

  for (const ruta of GALERIAS) {
    // Todo lo que casa este test es código: los comentarios ya no son materia prima.
    const fuente = sinComentarios(readFileSync(join(SRC, ruta), 'utf8'));

    // (2) Sí leen los canónicos: `kind` es lo que decide <img> o <iframe>, y `caption` el pie.
    assert.match(fuente, /\bkind\b/, `${ruta} no lee el campo canónico 'kind'`);
    assert.match(fuente, /\bcaption\b/, `${ruta} no lee el campo canónico 'caption'`);

    // (3) La normalización está en el borde del componente: la única puerta es toMediaList().
    assert.match(fuente, /toMediaList/, `${ruta} no normaliza con toMediaList()`);
    //     El especificador se casa con las tres formas de comilla: lo que se exige es que el
    //     import apunte al contrato, no con qué comilla lo escribió quien lo escribió.
    assert.match(fuente, /from\s+["'`]@\/lib\/media["'`]/, `${ruta} no importa el contrato de medios`);

    // (4) Coherencia del anclaje del punto (1): TODO receptor que lee un campo canónico de un
    //     MediaItem tiene que estar cubierto por LECTURA_LEGADA_DE_ITEM. Sin esto, renombrar la
    //     variable del `map` (`entry.kind`) dejaría el gate verde sobre código histórico.
    const receptoresCanonicos = [
      ...fuente.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*(?:\s*\[[^\]]*\])?)\s*\.\s*(?:kind|caption)\b/g),
    ].map((m) => m[1]);
    const fueraDelAnclaje = [...new Set(receptoresCanonicos)]
      .filter((rec) => !LECTURA_LEGADA_DE_ITEM.test(`${rec}.tipo`))
      .join(', ');
    assert.equal(
      fueraDelAnclaje,
      '',
      `${ruta}: receptores que leen kind/caption y el anclaje no cubre: ${fueraDelAnclaje} — ampliar ITEM_RECEPTOR o nombrar la variable como un item`,
    );
  }
});

// ── Task 9 (F1): Strapi es el único dueño de los datos, y eso se mide ───────
//
// El barrido que faltaba. `SEED_CULTIVOS` (`src/lib/polinizacion.ts`) sobrevivió al commit
// `a6c38fa` porque el gate del plan buscaba las otras agujas y esa constante se escribe con
// otro prefijo: seis fichas inventadas (`documentId: 'seed-1'..'seed-6'`, `+14% amarre`)
// seguían llegando al HTML de `/meliponas/polinizacion` cuando Strapi caía — medido en el
// informe de la Tarea 9, fix round 1. Esta aserción es la que lo habría cortado sola, y es
// la que corta las regresiones de F2 y F3, donde los seeds vuelven a tener motivo de aparecer.
//
// Dientes y sus dos condiciones, ambas medidas:
//  · se camina TODO `src/**` (`.astro`/`.ts`/`.tsx`) línea a línea y se listan TODOS los
//    culpables como `ruta:línea: código`, no solo el primero;
//  · los comentarios se quitan antes de casar, con el `sinComentarios()` ya establecido arriba:
//    «Sin stock de Unsplash», que está en el JSDoc de `anfitrionFoto` en `lib/naturaleza.ts`, es
//    documentación de por qué ya no está, no el bug. (Se cita por símbolo y no por número de
//    línea: este archivo decía «línea 478» y el comentario se había mudado a la 623.) El coste
//    declarado es un gate más flojo sobre la prosa — un array en código no puede esconderse
//    dentro de un comentario, así que los dientes no se pierden.
//
// Auto-ceguera (el bug que esta sección tuvo antes): cada aguja se arma en dos mitades con
// `aguja()`, así que el texto de ESTE archivo nunca contiene ninguna de las cuatro cadenas de
// forma contigua; y `archivosEn()` solo devuelve `.astro`/`.ts`/`.tsx` bajo `src/`, nunca `.mjs`.
// Ninguna de las dos defensas depende de la otra.
function aguja(izq, der) {
  return izq + der;
}

const AGUJAS_SEMILLA = [
  // 16 líneas en 14 archivos servían fotos de stock en lugar de un activo propio.
  { motivo: 'foto de stock de un tercero', re: new RegExp(aguja('uns', 'plash'), 'i') },
  // Dominio muerto: `curl` responde 000 (paso 1 del brief). Nadie lo sirve.
  { motivo: 'hotlink a un dominio que no sirve nada', re: new RegExp(aguja('tienda\\.', 'iwage\\.co')) },
  // Registros inventados que se hacen pasar por filas de Strapi (precios, existencias, métricas).
  { motivo: 'seed que se hace pasar por filas de Strapi', re: new RegExp(`\\b${aguja('FALLBACK', '_')}[A-Za-z0-9_]*`) },
  { motivo: 'seed que se hace pasar por filas de Strapi', re: new RegExp(aguja('SEED', '_CULTIVOS')) },
];

// Excepciones DECLARADAS y ya falladas por el controller — no se "arreglan", se nombran:
//  · `FALLBACK_HISTORIAS_HOME` (pages/cafe/index.astro:54): 4 registros cuyas imágenes son
//    archivos producidos y versionados (`/images/cafe-menu/visitante-*.webp`), no stock ajeno ni
//    rutas 404. Lo retira la **Tarea 12/13** cuando `historia-visitante` esté poblado en Strapi.
//  · `INICIATIVAS_FALLBACK` (pages/naturaleza/impacto.astro:54): son métricas inventadas
//    («1.200 plántulas», «12 becados»), no medios; el caso se escaló al dueño y no lo decide
//    esta gate. Se declara igualmente: la aguja ruling es `FALLBACK_` (prefijo) y hoy ni siquiera
//    lo alcanza, así que esta entrada deja escrita la excepción por si la aguja se aprieta.
const EXCEPCIONES_SEMILLA = {
  'pages/cafe/index.astro': new Set([aguja('FALLBACK', '_HISTORIAS_HOME')]),
  'pages/naturaleza/impacto.astro': new Set([aguja('INICIATIVAS', '_FALLBACK')]),
};

test('ningún seed vuelve a suplantar a Strapi en src/: ni stock de tercero, ni dominio muerto, ni FALLBACK_, ni SEED_CULTIVOS', () => {
  const culpables = [];
  for (const archivo of archivosEn(SRC)) {
    const ruta = enSrc(archivo);
    const permitidos = EXCEPCIONES_SEMILLA[ruta];
    sinComentarios(readFileSync(archivo, 'utf8'))
      .split('\n')
      .forEach((linea, i) => {
        for (const { motivo, re } of AGUJAS_SEMILLA) {
          const casa = linea.match(re);
          if (!casa) continue;
          if (permitidos?.has(casa[0])) continue;
          culpables.push(`    ${ruta}:${i + 1}: ${linea.trim().slice(0, 160)}  ← ${motivo} («${casa[0]}»)`);
        }
      });
  }

  assert.equal(
    culpables.join('\n'),
    '',
    `Strapi es el único dueño de los datos de contenido (Tarea 9 / F1). Fuentes inventadas o de tercero en src/:\n${culpables.join('\n')}`,
  );
});
