/**
 * Task 12 (F2) · slice bitácora — el adaptador de media que separa "cómo lo guarda
 * Strapi" de "cómo lo pinta la plantilla".
 *
 * Por qué existe `src/lib/normalizar-medio.ts` en vez de abrir el objeto media en cada
 * `normalize*` de `src/lib`: las tres formas de una portada (string de la BD vieja,
 * objeto media de Strapi, `MediaItem` ya normalizado) tienen que converger en un solo
 * lugar, y ese lugar es el contrato `src/lib/media.ts`. Aquí se corta que una de las
 * tres se cuele al HTML como `[object Object]`.
 *
 * Task 11 (migrar los content-types a `media`) AÚN NO CORRÍO: en la BD `imagen` sigue
 * siendo un `string`. Por eso el adaptador acepta las tres formas y el segundo teste
 * del brief es el que lo garantiza.
 *
 * Los tres bloques de abajo no son relleno, cada uno corta un fallo medido:
 *  · adaptador → las formas que nadie escribió a propósito (malformadas) no pueden lanzar;
 *  · `og-image` → el borde donde un objeto iría a un `<meta content>` como texto;
 *  · barrido de plantillas → `astro build` solo borra tipos, no los verifica: renombrar
 *    un prop o dejar `src={article.imagen}` pintando un `MediaItem` compila verde y
 *    rompe la página en el navegador. Aquí se pone rojo.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediaSrc } from '../src/lib/media.ts';
import { normalizarParaPlantilla } from '../src/lib/normalizar-medio.ts';
import { ogImageDe } from '../src/lib/og-image.ts';
import { filasParaPlantilla, filasAResumen } from '../src/lib/bitacora-resumen.ts';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

// Raíz barrable. `IWAGE_SRC` apunta el barrido de plantillas a una COPIA del árbol, que
// es la única forma de MEDIR los dientes del gate (se demuestra en el informe de la
// tarea: mismo código, /tmp con un call site revertido, rojo). Sin esta puerta,
// «el barrido cacha la regresión» sería un dicho. Por defecto, el repositorio.
const RAIZ = process.env.IWAGE_SRC
  ? resolve(process.env.IWAGE_SRC)
  : fileURLToPath(new URL('..', import.meta.url));


// ── 1. El adaptador: las tres formas canónicas (los tres testes del brief) ─────

test('un media object de Strapi llega como MediaItem con alt', () => {
  const r = normalizarParaPlantilla({
    imagen: { id: 7, url: '/uploads/bitacora/la-caja.webp', mime: 'image/webp', alternativeText: 'Caja de Angelita' },
    galeria: [{ url: '/uploads/galeria/a.webp', mime: 'image/webp' }, { url: '/uploads/galeria/a.webp', mime: 'image/webp' }],
  });
  assert.equal(r.imagen.url, '/uploads/bitacora/la-caja.webp');
  assert.equal(r.imagen.alt, 'Caja de Angelita');
  assert.equal(r.galeria.length, 1);
});

test('un string suelto (BD vieja) sigue funcionando', () => {
  const r = normalizarParaPlantilla({ imagen: '/uploads/x.webp', galeria: ['/uploads/y.webp'] });
  assert.equal(r.imagen.url, '/uploads/x.webp');
  assert.equal(r.galeria[0].url, '/uploads/y.webp');
});

test('null en ambos: la plantilla recibe null y [], no undefined', () => {
  const r = normalizarParaPlantilla({ imagen: null, galeria: null });
  assert.equal(r.imagen, null);
  assert.deepEqual(r.galeria, []);
});

// ── 2. Metadata rica: `alt` y `caption` tienen que sobrevivir el viaje ─────────

test('un MediaItem con `alt` conserva el alt, y un item de galería conserva su caption', () => {
  // Idempotencia: la fila ya pudo pasar por otro borde. Si el adaptador perdiera el
  // `alt` acá, una tarjeta con `alternativeText` en el admin pintaría el título.
  const r = normalizarParaPlantilla({
    imagen: { url: '/uploads/bitacora/la-caja.webp', kind: 'imagen', provider: 'strapi', alt: 'Caja de Angelita' },
    galeria: [{ url: '/uploads/galeria/b.webp', caption: 'Colmena 4, vereda Santagueda' }],
  });
  assert.equal(r.imagen.alt, 'Caja de Angelita');
  assert.equal(r.imagen.kind, 'imagen');
  assert.equal(r.galeria[0].caption, 'Colmena 4, vereda Santagueda');

  // Y la forma Strapi (alternativeText/caption), que es la que llega del admin.
  const s = normalizarParaPlantilla({
    imagen: { url: '/uploads/x.webp', alternativeText: 'Flor de guamo', caption: 'Detalle' },
    galeria: [{ url: '/uploads/g.webp', alternativeText: 'Angelitas', caption: 'Alero del café' }],
  });
  assert.equal(s.imagen.alt, 'Flor de guamo');
  assert.equal(s.imagen.caption, 'Detalle');
  assert.deepEqual(
    { alt: s.galeria[0].alt, caption: s.galeria[0].caption },
    { alt: 'Angelitas', caption: 'Alero del café' },
  );

  // Un `caption` viejo (`titulo` de las galerías históricas) también llega a caption.
  const v = normalizarParaPlantilla({ galeria: [{ url: '/uploads/g.webp', titulo: 'Pie viejo' }] });
  assert.equal(v.galeria[0].caption, 'Pie viejo');
});

test('el adaptador reduce el host interno de Docker en la portada, no solo en la galería', () => {
  const r = normalizarParaPlantilla({ imagen: 'http://iwage_strapi:1337/uploads/bitacora/x.webp' });
  assert.equal(r.imagen.url, '/uploads/bitacora/x.webp');
});

// ── 3. Filas malformadas: null / [] y NUNCA una excepción ─────────────────────
// `fallo` (Task 9) existe para que Strapi se caiga sin tumbar el índice. Un `throw`
// dentro del mapeo haría lo contrario: convertir un dato feo en un 500, o —peor— en
// una degradación que se disfraza de "Strapi falló" y prende el `noindex`.

const MALFORMADA = [
  ['objeto vacío', {}],
  ['array vacío', []],
  ['cero', 0],
  ['espacios', '   '],
  ['false', false],
  ['NaN', Number.NaN],
  ['objeto sin url', { id: 12, mime: 'image/webp' }],
  ['url en blanco', { url: '   ' }],
  ['undefined', undefined],
];

// El array anidado es la forma en que Strapi devuelve una relación `multiple`. En
// `galeria` es un dato VÁLIDO (la lista lo aplana, se prueba abajo); en `imagen`, que
// es un campo de a una, no hay pieza que pintar: tiene que dar `null`, no el primero.
const ANIDADO = ['array anidado de media (como Strapi devuelve un `multiple`)', [{ url: '/uploads/a.webp' }]];

test('imagen malformada → null, y nunca lanza', () => {
  for (const [motivo, imagen] of [...MALFORMADA, ANIDADO]) {
    assert.doesNotThrow(() => normalizarParaPlantilla({ imagen }), `${motivo}: lanzó`);
    assert.equal(normalizarParaPlantilla({ imagen }).imagen, null, `${motivo}: no dio null`);
  }
});

test('galería malformada → [], y nunca lanza', () => {
  for (const [motivo, galeria] of MALFORMADA) {
    assert.doesNotThrow(() => normalizarParaPlantilla({ galeria }), `${motivo}: lanzó`);
    assert.deepEqual(normalizarParaPlantilla({ galeria }).galeria, [], `${motivo}: no dio []`);
  }
  // El anidado SÍ es válido en `galeria` (es la forma de una relación multiple).
  const ok = normalizarParaPlantilla({ galeria: [[{ url: '/uploads/a.webp' }, { url: '/uploads/b.webp' }]] });
  assert.deepEqual(ok.galeria.map((m) => m.url), ['/uploads/a.webp', '/uploads/b.webp']);
});

test('filasParaPlantilla: una fila nula o rarísima no revienta la lista', () => {
  const filas = [null, undefined, 0, 'x', { titulo: 'ok', imagen: { url: '/uploads/a.webp' } }];
  const r = filasParaPlantilla(filas);
  assert.equal(r.length, filas.length, 'se pierden filas: el conteo del índice mentiría');
  assert.deepEqual(r.slice(0, 4).map((f) => f.imagen), [null, null, null, null]);
  assert.equal(r[4].imagen.url, '/uploads/a.webp');
});

test('filasParaPlantilla: NO muta la fila cruda (la entrada cruda del cache de Redis)', () => {
  // `strapiFetch` devuelve el objeto del cache tal cual; mutarlo en el mapeo escribiría
  // `MediaItem`s en una estructura que comparten otras llamadas del proceso.
  const cruda = { titulo: 'La caja', slug: 'la-caja', marca: 'meliponas', imagen: { url: '/uploads/bitacora/la-caja.webp', alternativeText: 'Caja de Angelita' } };
  const antes = structuredClone(cruda);
  const [normalizada] = filasParaPlantilla([cruda]);
  assert.deepEqual(cruda, antes, 'la fila cruda salió mutada');
  assert.notEqual(normalizada, cruda, 'devolvió el mismo objeto en vez de una copia');
  assert.equal(normalizada.titulo, 'La caja', 'se perdió el resto de la fila');
  assert.equal(normalizada.imagen.alt, 'Caja de Angelita');

  // Mismo objeto de entrada dos veces = dos salidas distintas, y la segunda sigue bien
  // (es el caso del `inflightFetches` de strapi.ts, que reparte el MISMO objeto).
  const otra = filasParaPlantilla([cruda])[0];
  assert.equal(otra.imagen.url, '/uploads/bitacora/la-caja.webp');

  // Y el resumen (la superficie que pintan `/` y las 5 landings) recibe filas ya normalizadas.
  const resumen = filasAResumen([normalizada]);
  assert.equal(resumen.porMarca.meliponas.ultimas[0].imagen.url, '/uploads/bitacora/la-caja.webp');
});

// ── 4. El borde de `og-image`: aquí es donde un objeto se volvía texto ─────────
// `ogImageDe()` declaraba `imagen?: string | null`. Con `EntradaBitacora.imagen` ya
// siendo `MediaItem`, cualquier llamada que pase el objeto sin abrirlo daría
// `content="[object Object]"` en `<meta>`: build verde, preview social roto, sin un
// solo error en ningún lado. El borde se vuelve tolerante (`unknown`) y resuelve con
// `absUrl(mediaSrc(x))`, que ya acepta un media object.

const AMBIENTE = { APP_URL: process.env.APP_URL, STRAPI_URL: process.env.STRAPI_URL };
process.env.APP_URL = 'https://iwage.co';
process.env.STRAPI_URL = 'http://iwage_strapi:1337';
after(() => {
  for (const [clave, valor] of Object.entries(AMBIENTE)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

test('ogImageDe acepta un MediaItem, una ruta, la URL interna y null: siempre absoluta', () => {
  const esperada = 'https://iwage.co/uploads/x.webp';
  const formas = [
    ['MediaItem', { url: '/uploads/x.webp', kind: 'imagen', provider: 'strapi', alt: 'Caja' }],
    ['ruta de sitio', '/uploads/x.webp'],
    ['URL interna de Docker', 'http://iwage_strapi:1337/uploads/x.webp'],
    ['objeto media de Strapi', { id: 3, url: 'http://iwage_strapi:1337/uploads/x.webp', mime: 'image/webp' }],
  ];
  for (const [motivo, imagen] of formas) {
    const salida = ogImageDe({ brand: 'meliponas', imagen });
    assert.equal(salida, esperada, `${motivo}: ${salida}`);
    assert.doesNotMatch(salida, /\[object Object\]/, `${motivo}: objeto interpolado en el metadato`);
    assert.doesNotMatch(salida, /iwage_strapi|:1337/, `${motivo}: host interno al metadato`);
  }
  // `null` no tiene pieza propia: el contrato es el hero de la marca, igual de absoluto.
  assert.equal(ogImageDe({ brand: 'meliponas', imagen: null }), 'https://iwage.co/images/hero-meliponas.webp');
});

test('og-image.ts declara el borde en unknown (sin type-check, el tipo ES el contrato)', () => {
  const fuente = readFileSync(join(RAIZ, 'src/lib/og-image.ts'), 'utf8');
  assert.match(
    fuente,
    /imagen\?\s*:\s*unknown/,
    'ogImageDe sigue declarando `imagen` como string: un MediaItem que llegue por error no lo diría el tipo',
  );
});

// ── 5. Barrido de plantillas de bitácora ──────────────────────────────────────
// `astro build` no verifica tipos ni nombres de prop: `src={article.imagen}` sobre un
// `MediaItem` pinta `src="[object Object]"` con build verde. Este barrido es el que
// corta eso en las 12 rutas de bitácora y sus dos componentes.
//
// Los comentarios se quitan antes de casar (mismo `sinComentarios()` que
// `tests/media-contract.test.mjs`): «aquí antes se pintaba `article.imagen`» en el JSDoc
// de una página es documentación, no el bug.

/** Todos los `.astro`/`.ts` bajo un directorio. */
function caminar(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) out.push(...caminar(p));
    else if (/\.(astro|ts|tsx)$/.test(entrada)) out.push(p);
  }
  return out;
}

/**
 * ¿Este archivo consume el módulo `bitacora`? Se mira el ÚLTIMO segmento del
 * especificador, no una subcadena: `\bbitacora` también casaba `@/lib/schema-bitacora`
 * y `@/lib/sitemap-bitacora` (el guion es un límite de palabra) y metía en el barrido a
 * archivos que no ven una fila de bitácora. Y se aceptan las dos sintaxis que existen en
 * el árbol: estática (`from '@/lib/bitacora'`, `from './bitacora'`) y dinámica
 * (`import('@/lib/bitacora')`, lo único que usa
 * `src/pages/granja/sistema/[subsistema].astro:101`, que un regex de `from` perdía).
 */
function consumeBitacora(contenido) {
  return [...contenido.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].some(
    ([, esp]) => esp.split('/').pop() === 'bitacora',
  );
}

/**
 * Archivos barridos. Tres orígenes, unidos y deduplicados:
 *  · TODAS las rutas bajo un directorio `bitacora` (así una página nueva no se libra del
 *    barrido por no estar en una lista);
 *  · los componentes que pintan tapas de bitácora sin vivir dentro de la carpeta
 *    `bitacora` de una marca;
 *  · TODO consumidor del módulo `bitacora` (I4): el `MediaItem` viaja con la fila, no con el
 *    directorio. Un `<img src={post.imagen}>` en `src/pages/granja/novedad.astro` —fuera de
 *    cualquier carpeta `bitacora`— pinta `[object Object]` igual que dentro, y hasta hoy se
 *    libraba del gate por su dirección. Medido: 21 consumidores bajo `src/` (los 18 que
 *    importan `@/lib/bitacora` + `src/lib/{bitacora-resumen,granja-experimentos}` y
 *    `src/lib/rag/indexer.ts`, que importan `./bitacora`) frente a los 14 que veía el
 *    barrido por directorio.
 * Se mantienen los dos orígenes anteriores aunque ya estén cubiertos, para que el barrido
 * no dependa de que un archivo recuerde escribir el import.
 */
function archivosDeBitacora() {
  const paginas = caminar(join(RAIZ, 'src/pages')).filter((f) => `${relative(RAIZ, f)}`.split('/').includes('bitacora'));
  const componentes = [
    'src/components/BitacoraCard.astro',
    'src/components/brand/UltimasDeBitacora.astro',
  ].map((r) => join(RAIZ, r)).filter((f) => existsSync(f));
  const importadores = caminar(join(RAIZ, 'src')).filter((f) => consumeBitacora(readFileSync(f, 'utf8')));
  return [...new Set([...paginas, ...componentes, ...importadores])].sort();
}


/** Nombres que en una plantilla SON un medio (portada, galería, foto), no un string cualquiera. */
const ID_MEDIO = /\b(imagen|imagen_principal|imagen_hero|image|foto|foto_territorio|foto_perfil|portada|galeria|poster|hero)\b/;

/** Qué cuenta como "ya resuelto por el contrato": `.url` o una de sus funciones. */
const RESUELTO = /\b(mediaSrc|absUrl|toMediaItem|toMediaList|embedSrc)\s*\(|\.url\b/;

function lineaDe(fuente, indice) {
  return fuente.slice(0, indice).split('\n').length;
}

/**
 * Reglas, sobre el código sin comentarios:
 *  (a) todo atributo de plantilla `src={EXPR}`, `ogImage={EXPR}` o `poster={EXPR}` que
 *      mencione un medio debe resolverlo con `.url` o con una función del contrato;
 *  (b) lo mismo sobre la propiedad `image:` del `articleMeta` del frontmatter, que es la
 *      puerta del JSON-LD (`MetaArticulo.image?: string`, y `BrandLayout` no es editable);
 *  (c) la misma exigencia sobre una variable local (`src={portada}`), siguiendo sus
 *      asignaciones en dos pasadas para cubrir cadenas. Sin (c), «arreglar» el bug con
 *      `const u = article.imagen` y `src={u}` lo esquivaría.
 *
 * EXCLUSIÓN deliberada: `image={post.imagen}` no entra en el barrido. `BitacoraCard.image` es
 * hoy `MediaItem | null`: pasarle el objeto ES el contrato de esa prop, y lo que pinta el
 * HTML lo decide la tarjeta, que sí está barrida por su `<img src>`.
 *
 * Costes declarados: (c) es rastreo sintáctico de una línea, no data-flow real (un valor
 * que venga de una función o de `obj.portada` solo se ve por el nombre), y el `[^{}\n]`
 * de las expresiones no alcanza un objeto literal escrito en varias líneas.
 */
function violacionesDeMedios(archivo) {
  const ruta = relative(RAIZ, archivo).replace(/\\/g, '/');
  const fuente = sinComentarios(readFileSync(archivo, 'utf8'));
  const culpables = [];

  // (c) asignaciones locales `const X = <resto de línea>`: lo que ya pasó por el contrato
  //     y lo que no. Un nombre reasignado sucia una sola vez cuenta como sucio: más vale
  //     un falso positivo declarado que un gate esquivable con una reasignación.
  const asignaciones = [...fuente.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)]
    .map(([, nombre, rhs]) => ({ nombre, rhs }));
  const resueltas = new Set();
  const sucias = new Set();
  for (const { nombre, rhs } of asignaciones) {
    if (RESUELTO.test(rhs)) resueltas.add(nombre);
    else if (ID_MEDIO.test(rhs)) sucias.add(nombre);
  }
  for (let pasada = 0; pasada < 2; pasada += 1) {
    for (const { nombre, rhs } of asignaciones) {
      if (RESUELTO.test(rhs) || sucias.has(nombre)) continue;
      if ([...sucias].some((s) => new RegExp(`\\b${s}\\b`).test(rhs))) sucias.add(nombre);
    }
  }

  /** Un valor ya resuelto, o una variable local limpia, no son materia de este gate. */
  function sinResolver(expr) {
    if (!expr || RESUELTO.test(expr)) return false;
    const local = expr.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
    const mencionaMedio = ID_MEDIO.test(expr);
    const vieneDeMedio = local ? sucias.has(local) : false;
    if (!mencionaMedio && !vieneDeMedio) return false;
    // `const portada = mediaSrc(image)` y después `src={portada}`: sí está resuelto.
    if (local && !vieneDeMedio && resueltas.has(local)) return false;
    return true;
  }

  const REGLAS = [
    { re: /\b(?:src|ogImage|poster)\s*=\s*\{\s*([^{}\n]*?)\s*\}/g, capt: 1, motivo: 'atributo de plantilla' },
    { re: /^\s*image:\s*([^{}\n]+?)\s*,?$/gm, capt: 1, motivo: 'image: del articleMeta (JSON-LD)' },
  ];
  for (const { re, capt, motivo } of REGLAS) {
    for (const m of fuente.matchAll(re)) {
      if (!sinResolver(m[capt])) continue;
      culpables.push(
        `    ${ruta}:${lineaDe(fuente, m.index)}: ${m[0].trim().slice(0, 140)}  ← ${motivo}: un medio sin pasar por .url ni por mediaSrc()/absUrl()`,
      );
    }
  }
  return culpables;
}

test('el barrido tiene a quién mirar: las 12 rutas, los componentes y TODOS los importadores de @/lib/bitacora', () => {
  const lista = archivosDeBitacora().map((f) => relative(RAIZ, f).replace(/\\/g, '/'));
  assert.ok(lista.length >= 13, `barrido vacío o recortado (${lista.length} archivos): ${lista.join(', ')}`);
  for (const marca of ['meliponas', 'granja', 'naturaleza', 'cafe', 'gestion', 'tierras']) {
    assert.ok(
      lista.some((f) => f === `src/pages/${marca}/bitacora/[slug].astro`),
      `falta ${marca}/bitacora/[slug].astro del barrido`,
    );
  }
  assert.ok(lista.includes('src/components/BitacoraCard.astro'), 'falta BitacoraCard.astro del barrido');
  // I4: los cinco consumidores que reciben filas de bitácora fuera de un directorio
  // `bitacora/`. Si el barrido vuelve a ser "el que está en la carpeta", estos cuatro
  // nombres dan rojo y la regresión se ve.
  for (const fuera of [
    'src/pages/index.astro',
    'src/pages/meliponas/index.astro',
    'src/components/brand/BitacoraEcosistema.astro',
    'src/components/brand/BrandFooter.astro',
    'src/pages/granja/sistema/[subsistema].astro',
  ]) {
    assert.ok(lista.includes(fuera), `el barrido deja fuera a ${fuera}, que también pinta filas de bitácora`);
  }
  // 21 consumidores del módulo bajo `src/` (medido con este mismo criterio: 18 vía
  // `@/lib/bitacora` + 3 vía `./bitacora` desde `src/lib`), más los componentes que pintan
  // tapas sin tener el import. Si alguien vuelve al barrido por directorio, cae a 14 y esto
  // da rojo.
  assert.ok(lista.length >= 21, `barrido más chico que el conjunto de consumidores (${lista.length}): ${lista.join(', ')}`);
});

test('ningún <img src> de bitácora pinta un MediaItem sin resolverlo (.url o el contrato)', () => {
  const culpables = archivosDeBitacora().flatMap(violacionesDeMedios).join('\n');
  assert.equal(
    culpables,
    '',
    `una plantilla de bitácora interpola un medio sin resolverlo (build verde, HTML roto):\n${culpables}`,
  );
});

test('BitacoraCard pinta la tapa por el contrato y prefiere el alt del medio al título', () => {
  const fuente = readFileSync(join(RAIZ, 'src/components/BitacoraCard.astro'), 'utf8');
  assert.match(fuente, /image\?\s*:\s*MediaItem\s*\|\s*null/, 'BitacoraCard no declara `image?: MediaItem | null`');
  assert.match(fuente, /from ['"]@\/lib\/media/, 'BitacoraCard no importa el contrato de medios');
  assert.match(fuente, /mediaSrc\(/, 'BitacoraCard no resuelve la tapa con mediaSrc()');
  // El alt del editor manda sobre el título: `alternativeText` es lo que describe la foto.
  assert.match(fuente, /\.alt\s*\|\|/, 'BitacoraCard no prefiere el alt del medio');
});

test('una portada absoluta de Strapi no llega con el host interno al <img> de la tarjeta', () => {
  // El camino de la tapa: fila cruda (hoy un string con el host interno de Docker) →
  // adaptador en `bitacora.ts` → `mediaSrc()` en `BitacoraCard`. Si alguien pinta la
  // propiedad tal cual, el navegador pide `http://iwage_strapi:1337/...` (host interno:
  // 000) y la tarjeta sale rota con build verde. nginx ya proxya /uploads, así que la
  // ruta de sitio es la que tiene que salir.
  const { imagen } = normalizarParaPlantilla({ imagen: 'http://iwage_strapi:1337/uploads/bitacora/la-caja.webp' });
  assert.equal(imagen.url, '/uploads/bitacora/la-caja.webp');
  // Idempotencia: resolver un MediaItem que ya viene reducido no lo rompe ni lo absolutea.
  assert.equal(mediaSrc(imagen), '/uploads/bitacora/la-caja.webp');
  // Y un externo ajeno NO se pinta: `esPintable` lo descarta (imagen de un tercero fuera
  // del control del dueño del contenido). Un video o recorrido de un proveedor conocido
  // sí sigue saliendo intacto — sin este par, el teste se pasaría suprimiendo todo lo
  // absoluto y nadie se enteraría.
  assert.equal(mediaSrc({ url: 'https://cdn.tercero.com/a.jpg', kind: 'imagen', provider: 'otro' }), null);
  assert.equal(
    mediaSrc('https://www.youtube.com/watch?v=Vv1b4Vvq0fM'),
    'https://www.youtube.com/watch?v=Vv1b4Vvq0fM',
  );
  const fuente = readFileSync(join(RAIZ, 'src/components/BitacoraCard.astro'), 'utf8');
  assert.match(
    fuente,
    /mediaSrc\(\s*image\b/,
    'BitacoraCard no resuelve la prop `image` con mediaSrc(): un http://iwage_strapi:1337 llegaría pintado al <img>',
  );
});

test('la bitácora expone MediaItem: la DECLARACIÓN de EntradaBitacora lo dice, no la prosa', () => {
  // I1: la versión anterior de este teste casaba `/imagen:\s*MediaItem\s*\|\s*null/` sobre
  // el archivo CRUDO, y `src/lib/bitacora.ts` tiene comentarios que contienen esa cadena
  // literal — o sea lo satisfacía la prosa. Medido en el review: revertir el tipo de la
  // interfaz a `string | null` dejaba los 16 testes verdes (mutante MT4). Por eso ahora el
  // texto pasa primero por `sinComentarios()` y la aserción se ancla a la línea de la
  // declaración dentro de `interface EntradaBitacora`, con su `;` y su `| null`.
  const fuente = sinComentarios(readFileSync(join(RAIZ, 'src/lib/bitacora.ts'), 'utf8'));
  const interfaz = fuente.match(/\bexport interface EntradaBitacora \{[\s\S]*?\n\}/);
  assert.ok(interfaz, 'no se encontró `export interface EntradaBitacora { … }` en src/lib/bitacora.ts');
  assert.match(
    interfaz[0],
    /^\s*imagen:\s*MediaItem\s*\|\s*null;$/m,
    'EntradaBitacora.imagen ya no declara `MediaItem | null;`: las plantillas vuelven a recibir un string (o un objeto crudo) y el build sigue verde',
  );
  assert.doesNotMatch(
    interfaz[0],
    /^\s*imagen:[^;]*\bstring\b[^;]*;$/m,
    'EntradaBitacora.imagen menciona `string` en su declaración',
  );
});

/**
 * C1 — el contrato de fuente del `populate`.
 *
 * Desde `fa240b2`, `bitacora.imagen` es `type: 'media'` y la REST API de Strapi v5 no
 * devuelve relaciones ni media salvo que se pidan: sin `populate: ['imagen']` la respuesta
 * trae `200` sin el campo, `normalizarParaPlantilla` ve `undefined`, `imagen` sale `null`
 * en las 112 filas y no hay ni una tapa en el sitio — con `astro build` y `npm test`
 * verdes, porque ningún teste de normalización puede ver un campo que nunca llegó.
 *
 * El único guard posible sin compilador de tipos ni red es este: una función cuyo
 * resultado alimenta `imagen` (`filasParaPlantilla` en su cuerpo) TIENE que poblar la
 * relación. Se lee sobre el código sin comentarios para que la prosa no lo satisfaga —
 * la clase exacta de hueco que dejó el mutante MT4 (I1).
 */
function opcionesDeStrapiFetch(cuerpo) {
  const m = cuerpo.match(/strapiFetch\s*(?:<[^>]*>)?\s*\(\s*['"]bitacoras['"]\s*,\s*\{([\s\S]*?)\n\s*\}\s*\)/);
  return m ? m[1] : null;
}

test('cada lectura de bitácora que construye filas de plantilla puebla `imagen` (C1)', () => {
  const fuente = sinComentarios(readFileSync(join(RAIZ, 'src/lib/bitacora.ts'), 'utf8'));
  const funciones = [...fuente.matchAll(/export async function (\w+)[\s\S]*?\n\}/g)].map((m) => m[1]);
  assert.ok(funciones.length >= 4, `no se encontraron las funciones de lectura: ${funciones.join(', ')}`);

  const conFilas = [];
  for (const fn of funciones) {
    const cuerpo = fuente.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(cuerpo, `no se encontró el cuerpo de ${fn}`);
    const opciones = opcionesDeStrapiFetch(cuerpo);
    assert.ok(opciones !== null, `${fn} no llama a strapiFetch('bitacoras', { … }): la busqué mal`);
    if (!/filasParaPlantilla/.test(cuerpo)) continue;
    conFilas.push(fn);
    // (1) las filas llegan normalizadas a la plantilla (mata MT5/MT6/MT7 del review);
    assert.match(cuerpo, /filasParaPlantilla/, `${fn} entrega filas crudas a la plantilla`);
    // (2) y la relación que alimenta `imagen` está pedida (mata el C1).
    assert.match(
      opciones,
      /\bpopulate\s*:\s*\[[^\]]*['"]imagen['"][^\]]*\]/,
      `${fn} entrega filas a la plantilla SIN poblar "imagen": Strapi responde sin el campo, imagen sale null y la tapa desaparece con build verde (C1)`,
    );
  }
  assert.deepEqual(
    conFilas.sort(),
    ['getBitacoraByMarca', 'getBitacoraBySlug', 'getResumenBitacora'],
    'el conjunto de lecturas que pueblan la portada cambió: hay que revisar este gate',
  );

  // Y la excepción contraria, también anclada: `getAllBitacoraSlugs` mapea solo
  // `slug`/`marca`, no construye `EntradaBitacora`, así que poblar ahí sería pagar una
  // clave de cache nueva por un campo que nadie lee.
  const cuerpoSlugs = fuente.match(/export async function getAllBitacoraSlugs[\s\S]*?\n\}/)?.[0];
  assert.ok(cuerpoSlugs, 'no se encontró getAllBitacoraSlugs');
  assert.doesNotMatch(
    opcionesDeStrapiFetch(cuerpoSlugs) ?? '',
    /\bpopulate\b/,
    'getAllBitacoraSlugs pide populate: no lee `imagen`, solo estrena clave de cache',
  );
});

/**
 * C1, segunda red: la QUERY real que sale del proceso. El teste de contrato de fuente de
 * arriba es el que da rojo cuando se borra el `populate`; este además prueba que la cadena
 * completa llega a un `MediaItem` utilizable. Sale "cara" pero vale: para cargar
 * `bitacora.ts` bajo `node --test` hizo falta escribir `./strapi.ts` y
 * `./bitacora-resumen.ts` con extensión (el Minor M3 del review, que bloqueaba este teste).
 *
 * Cómo se domó, sin tocar un archivo de producción:
 *  · `globalThis.fetch` se reemplaza y se restaura: no se llama a la red ni al contenedor.
 *  · `REDIS_URL` se pone en `'redis://localhost:['`: con ese valor el CONSTRUCTOR de ioredis
 *    lanza `Invalid URL` dentro del mismo `try` de `src/lib/redis.ts` (`getClient`), el
 *    breaker queda abierto y `cacheGet`/`cacheSet` son no-op. Medido antes de escribirlo:
 *    con una URL válida pero inalcanzable (`iwage-test://invalid:0`) ioredis reconnecta en
 *    bucle y suelta `[ioredis] Unhandled error event` para siempre —el proceso no muere—;
 *    con esta el fallo es síncrono y limpio. Sin este detalle el teste leería y ESCRIBIRÍA
 *    claves en el Redis real y su resultado dependería de lo que haya en el cache.
 *  · Por eso el `import()` es dinámico y va DESPUÉS de tocar el ambiente: `redis.ts` y
 *    `strapi.ts` leen `process.env` al cargarse.
 */
test('la URL que sale hacia Strapi pide la relación (populate[]=imagen) y la fila vuelve con MediaItem', async () => {
  const urls = [];
  const fetchOriginal = globalThis.fetch;
  const redisOriginal = process.env.REDIS_URL;
  const appOriginal = process.env.APP_URL;
  process.env.REDIS_URL = 'redis://localhost:['; // ⇒ `new Redis()` throws, breaker abierto, sin Redis real
  process.env.APP_URL = 'https://iwage.co';
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 1,
            documentId: 'abc',
            titulo: 'La caja',
            slug: 'la-caja',
            marca: 'meliponas',
            fecha: '2026-09-01',
            publicado: true,
            // La forma que devuelve Strapi v5 cuando la relación SÍ fue poblada.
            imagen: { id: 7, url: 'http://iwage_strapi:1337/uploads/bitacora/la-caja.webp', mime: 'image/webp', alternativeText: 'Caja de Angelita' },
          },
        ],
        meta: { pagination: { total: 1, page: 1, pageSize: 20 } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const bitacora = await import(`file://${join(RAIZ, 'src/lib/bitacora.ts')}`);
    await bitacora.getBitacoraByMarca('meliponas');
    await bitacora.getResumenBitacora();
    await bitacora.getBitacoraBySlug('la-caja');
    await bitacora.getAllBitacoraSlugs();

    assert.equal(urls.length, 4, `se esperaban 4 consultas y salieron ${urls.length}: ${urls.join(' | ')}`);
    const [listado, resumen, ficha, slugs] = urls;
    for (const [nombre, url] of [['getBitacoraByMarca', listado], ['getResumenBitacora', resumen], ['getBitacoraBySlug', ficha]]) {
      const params = new URL(url).searchParams;
      assert.ok(
        [...params.getAll('populate[]'), ...params.getAll('populate')].includes('imagen'),
        `${nombre} no envía populate[]=imagen a Strapi: ${url}`,
      );
    }
    // La lectura de slugs no paga populate: no construye filas de plantilla.
    assert.equal(new URL(slugs).searchParams.getAll('populate[]').length, 0, `getAllBitacoraSlugs sí envía populate: ${slugs}`);

    // Y el viaje completo: relación poblada → adaptador → MediaItem con ruta de sitio y alt.
    const { data } = await bitacora.getBitacoraByMarca('meliponas');
    assert.equal(data[0].imagen.url, '/uploads/bitacora/la-caja.webp');
    assert.equal(data[0].imagen.alt, 'Caja de Angelita');
  } finally {
    globalThis.fetch = fetchOriginal;
    if (redisOriginal === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = redisOriginal;
    if (appOriginal === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = appOriginal;
  }
});
