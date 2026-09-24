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

// ── Task 7: un solo tipo de galería, y un solo juego de campos ──────────────
//
// El grep que pidió el plan (`GaleriaItem|GalleryItem`) borra los duplicados pero no ve la
// mitad que sí rompe el sitio en el navegador: `MediaItem` renombra `tipo`→`kind` y
// `titulo`→`caption`, y `astro build` SOLO borra tipos, no los verifica. Una lectura
// `item.tipo` que sobreviva da build verde, página 200 y galería pintando vacío. Es
// especialmente fácil de dejar viva porque las dos galerías serializan sus `items` a un
// `<script type="application/json">` y VUELVEN a leerlos en el cliente: server y navegador
// tienen que nombrar los mismos campos, y ningún compilador lo comprueba aquí.
//
// Fix round 1 (review): este gate leía el texto COMPLETO del archivo, así que podía poner la
// suite roja siendo el código correcto. Dos cambios, los dos medidos (informe, "Fix round 1"):
//   (a) los comentarios se borran antes de casar — «aquí antes se leía `item.tipo`» o un JSDoc
//       que nombre `GalleryItem` es documentación, no el bug que este gate corta;
//   (b) las lecturas históricas se anclan a la forma que está en juego: un `prop.titulo` o un
//       `cultivo.tipo` legítimos dentro de un componente de galería no son un `MediaItem`.
// Los dientes no se perdieron: contra `git show a0552b5:src/components/shared/*.astro` (el
// árbol ANTES del rename) el mismo código sigue casando 18 lecturas en MediaGallery y 16 en
// ProductGallery, y el gate de `GalleryItem` sigue cayendo sobre ese árbol.
const GALERIAS = ['components/shared/MediaGallery.astro', 'components/shared/ProductGallery.astro'];

/** Convierte un bloque de comentario en espacios: se va el texto, se queda la línea. */
function enBlanco(bloque) {
  return bloque.replace(/[^\n]/g, ' ');
}

/**
 * Quita el contenido de los comentarios dejando las líneas en su sitio, para que los números
 * que salen en los mensajes sigan apuntando a la línea real del archivo.
 *
 * No es un lexer, son tres reglas y su coste está declarado:
 *  · `//` abre comentario solo si NO va pegado a `:` o `/` → las URLs `https://www.youtube...`
 *    que las dos galerías arman en el `ytEmbed`/`embedUrl` (server y cliente) sobreviven.
 *  · `/* … *\/` (JSDoc y los `{/* … *\/}` de la plantilla Astro) y `<!-- … -->` de HTML se
 *    cierran por su propio delimitador, sin anidar.
 *  · Un `//` dentro de un string de código se perdería con su resto de línea. Medido sobre las
 *    dos galerías: ningún read de un item cae después de una URL en la misma línea. Y el coste
 *    de equivocarse es un gate más flojo en ESA línea, nunca un falso positivo, que es lo que
 *    hay que evitar aquí.
 */
function sinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    .replace(/<!--[\s\S]*?-->/g, enBlanco)
    .replace(/(?<![:/])\/\/[^\n]*/g, '');
}

/**
 * Receptores que en ESTAS dos galerías son un `MediaItem`, medidos en los cuatro fuentes
 * (HEAD y `git show a0552b5:` de los dos componentes): `items` es el array normalizado,
 * `item`/`it` son sus elementos en los `map` y en el `<script>` del navegador, `first` es
 * `items[0]` en ProductGallery y `*Item` cubre cualquier variable declarada como un item.
 * El filtro de coherencia del test (punto 4) comprueba que ningún receptor que lee
 * `kind`/`caption` se quede fuera de esta lista, así que renombrar la variable del `map`
 * (Task 8) rompe el test con un mensaje explícito en vez de dejar el gate silencioso.
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

test('las galerías leen kind/caption/alt también en el script del navegador', () => {
  // (1) Ninguna lectura `.tipo`/`.titulo` SOBRE UN ITEM: en un MediaItem son `undefined` y el
  //     visor se queda en blanco sin que el build se entere. Anclado al receptor, un
  //     `prop.titulo` o un `cultivo.tipo` de este componente son otra cosa y no casan.
  //     Se barren las DOS galerías antes deassertir: el rojo tiene que nombrar de una vez
  //     todas las líneas vivas (18 en MediaGallery y 16 en ProductGallery contra el árbol
  //     histórico `a0552b5`), no solo las de la primera que cae.
  const legadas = GALERIAS.flatMap((ruta) => lecturasLegadas(ruta)).join('\n');
  assert.equal(legadas, '', 'las galerías siguen leyendo campos de la forma histórica sobre un item');

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
