/**
 * Task 12d · la rebanada de `tierras.ts` — la última forma armada a mano del sitio.
 *
 * Por qué existe este archivo y no una extensión de `normalizar-medio.test.mjs` (que está
 * bajo revisión por la 12c) ni de `normalizar-medio-2.test.mjs` (de la 12b, en vuelo):
 * el brief de 12d pide testes PROPIOS en un archivo nuevo.
 *
 * Qué corta de verdad, medido en `src/lib/tierras.ts` antes de tocar nada:
 *
 *  · `:48-49` y `:382-383` re-arman la forma de Strapi campo a campo
 *    (`{ url: img.url, alternativeText: img.alternativeText }` con `.map((img: any) => …)`)
 *    en vez de `toMediaItem`/`toMediaList`. Consecuencia 1: el `alternativeText` del admin
 *    **no baja a la plantilla** — `mediaSrc()` dentro de `propiedadImagen()` devuelve solo la
 *    ruta, y las tres tarjetas pintan `alt={prop.titulo}`: el alt sale del nombre de la
 *    propiedad, no de la foto.
 *  · Consecuencia 2: el re-armado **no pasa por `mediaSrc()`**, así que una URL absoluta con el
 *    host interno del compose (`http://strapi_backend:1337/uploads/...`) llega pintada al `<img>`
 *    y el navegador pide un host inalcanzable (nginx solo proxya `/uploads`).
 *  · Consecuencia 3: `raw.imagen_principal` como string (la forma vieja) produce
 *    `{ url: undefined, alternativeText: undefined }` — un objeto truthy donde el contrato dice
 *    "media o `null`". Y `raw.imagenes = [null, …]` lanza `TypeError` dentro de
 *    `normalizePropiedad`, que `getPropiedades` atrapa EN BLOQUE y devuelve `data: []`:
 *    un dato feo se disfraza de "Strapi caído".
 *
 * Sin compilador de tipos en el repo, `astro build` no ve ninguna de las tres: un objeto donde
 * se espera string compila verde y pinta `[object Object]`. El único guard es este archivo.
 *
 * Los datos no pueden ser el guard: `select count(*) from propiedades;` = 0 y
 * `select count(*) from files;` = 0 (medido con `docker exec sostenibilidad_db psql`, solo
 * SELECT). Ningún camino de imagen de `/tierras/*` tiene contenido hoy, así que todo lo que se
 * afirma acá es sobre la FORMA del dato, y se afirma con filas construidas a mano.
 *
 * `IWAGE_SRC` apunta el barrido de plantillas a una COPIA del árbol — la única forma de MEDIR los
 * dientes del gate (precedente: `tests/normalizar-medio.test.mjs`). Sin esta puerta, "el barrido
 * cacha la regresión" sería un dicho.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediaSrc } from '../src/lib/media.ts';
import { normalizePropiedad, propiedadImagen, propiedadGaleria } from '../src/lib/tierras.ts';

const RAIZ = process.env.IWAGE_SRC
  ? resolve(process.env.IWAGE_SRC)
  : fileURLToPath(new URL('..', import.meta.url));

const fuente = (rel) => readFileSync(join(RAIZ, rel), 'utf8');

/**
 * Código sin prosa, conservando los números de línea. Las reglas de contrato de fuente miran
 * esto y no el archivo crudo: los comentarios de `tierras.ts` y de la ficha explican el defecto
 * que ya no está (dicen `mediaSrc()`, `alternativeText`, `.map((img: any) =>`), y una regla que
 * se activa por un comentario no cacha nada — solo miente.
 * (Versión local: `sinComentarios` en `tests/normalizar-medio.test.mjs` está bajo revisión de
 * la 12c y no se importa de ahí.)
 */
const enBlanco = (m) => m.replace(/[^\n]/g, ' ');
function sinComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    .replace(/<!--[\s\S]*?-->/g, enBlanco)
    .replace(/(?<![:/])\/\/[^\n]*/g, enBlanco);
}
/** Fuente de un archivo, sin comentarios. */
const codigo = (rel) => sinComentarios(fuente(rel));

/**
 * Fila cruda mínima de `propiedad`. `normalizePropiedad` lee ~40 campos; los que no se listan
 * quedan `undefined` y salen con sus defaults — no es el punto de estos testes.
 */
const fila = (extra = {}) => ({
  id: 1,
  documentId: 'doc1',
  slug: 'finca-la-esperanza',
  titulo: 'Finca La Esperanza',
  ...extra,
});

// ── 1. El contrato del módulo: `imagen_principal` / `imagenes` salen `MediaItem` ─

test('imagen_principal objeto media de Strapi → MediaItem con url de sitio y alt del admin', () => {
  const raw = {
    id: 7,
    url: 'http://strapi_backend:1337/uploads/propiedad/linderos.jpg',
    alternativeText: 'Linderos hitos del predio',
    caption: 'Levantamiento 2026',
    mime: 'image/jpeg',
  };
  const p = normalizePropiedad(fila({ imagen_principal: raw }));

  // La ruta que pinta la plantilla es de sitio: nginx proxya /uploads; el host del compose es un roto.
  assert.equal(p.imagen_principal.url, '/uploads/propiedad/linderos.jpg');
  // El `alternativeText` del admin describe la foto: tiene que BAJAR hasta el MediaItem.
  assert.equal(p.imagen_principal.alt, 'Linderos hitos del predio');
  assert.equal(p.imagen_principal.caption, 'Levantamiento 2026');
  assert.equal(p.imagen_principal.kind, 'imagen');
  assert.equal(p.imagen_principal.provider, 'strapi');

  // Nunca el crudo: el objeto de Strapi no se pasa por referencia ni conserva sus claves.
  assert.notEqual(p.imagen_principal, raw);
  assert.ok(!('alternativeText' in p.imagen_principal), 'imagen_principal conserva la forma cruda de Strapi');
});

test('imagen_principal string viejo (la forma anterior al media) sigue funcionando: mismo MediaItem', () => {
  const p = normalizePropiedad(fila({ imagen_principal: 'http://iwage_strapi:1337/uploads/propiedad/a.jpg' }));
  assert.equal(p.imagen_principal?.url, '/uploads/propiedad/a.jpg');
  assert.equal(p.imagen_principal?.kind, 'imagen');
  assert.equal(p.imagen_principal?.alt, undefined);

  // Idempotencia: la fila que ya pasó por un borde (MediaItem dentro de MediaItem) no se degrada.
  const otra = normalizePropiedad(fila({ imagen_principal: p.imagen_principal }));
  assert.deepEqual(otra.imagen_principal, p.imagen_principal);
});

test('basura en la portada → null, nunca `undefined`, nunca el crudo, nunca lanza', () => {
  for (const basura of [{}, { url: null }, { url: '   ' }, 123, '   ', [], true, null, undefined]) {
    const p = normalizePropiedad(fila({ imagen_principal: basura }));
    assert.equal(p.imagen_principal, null, `imagen_principal con ${JSON.stringify(basura)} no sale null`);
    // El objeto `{ url: undefined }` era el defecto: truthy para la plantilla, roto en el navegador.
    assert.equal(propiedadImagen(p), null, `propiedadImagen con ${JSON.stringify(basura)} no sale null`);
  }
});

test('basura en la galería → [] y NO lanza: un elemento nulo no puede vaciar el catálogo', () => {
  const p = normalizePropiedad(fila({ imagenes: [null, 123, {}, { url: '' }, { url: '/uploads/ok.jpg' }] }));
  assert.ok(Array.isArray(p.imagenes), 'imagenes no es array');
  assert.deepEqual(p.imagenes.map((i) => i.url), ['/uploads/ok.jpg']);

  // Sin relación, el contrato sigue siendo `MediaItem[] | null` (null = "no vino", [] = "vino vacía").
  assert.equal(normalizePropiedad(fila({ imagenes: null })).imagenes, null);
  assert.deepEqual(normalizePropiedad(fila({})).imagenes, null);

  // Este es el fallo que se disfrazaba de outage: `getPropiedades` envuelve el `.map` en un
  // `try/catch` que devuelve `data: []`. Una fila con un elemento nulo en la galería vaciaba
  // el catálogo entero y prendía el "no hay propiedades" de las páginas.
  assert.doesNotThrow(() => normalizePropiedad(fila({ imagenes: [null, { url: '/uploads/a.jpg' }] })));
});

test('el host interno de Docker sale relativo de sitio en portada Y en galería', () => {
  const p = normalizePropiedad(fila({
    imagen_principal: { url: 'http://strapi_backend:1337/uploads/propiedad/portada.jpg' },
    imagenes: [
      { url: 'http://iwage_strapi:1337/uploads/propiedad/patio.jpg' },
      { url: 'https://iwage.co/uploads/propiedad/drone.jpg' },
      { url: 'https://cdn.tercero.com/embebe.jpg' },
    ],
  }));
  assert.equal(p.imagen_principal.url, '/uploads/propiedad/portada.jpg');
  assert.deepEqual(p.imagenes.map((i) => i.url), [
    '/uploads/propiedad/patio.jpg',
    '/uploads/propiedad/drone.jpg',
  ]);
  // El externo ajeno NO se reduce: se descarta. `esPintable` en `media.ts` —decisión
  // «Strapi único dueño, sin hotlinks de imagen»—, y no solo en esta capa.
  assert.ok(!p.imagenes.some((i) => /cdn\.tercero\.com/.test(i.url)), 'el hotlink llegó a la ficha');
});

test('la galería de la ficha no repite la portada y el mismo archivo escrito de dos formas sale una vez', () => {
  const p = normalizePropiedad(fila({
    imagen_principal: { url: '/uploads/propiedad/casa.jpg', alternativeText: 'Casa principal' },
    imagenes: [
      { url: 'http://strapi_backend:1337/uploads/propiedad/casa.jpg' },
      { url: '/uploads/propiedad/casa.jpg?width=800' },
      { url: '/uploads/propiedad/mirador.jpg' },
    ],
  }));
  const galeria = propiedadGaleria(p);
  assert.deepEqual(galeria.map((i) => i.url), [
    '/uploads/propiedad/casa.jpg',
    '/uploads/propiedad/casa.jpg?width=800',
    '/uploads/propiedad/mirador.jpg',
  ]);
  // El alt de la portada sobrevive a la fusión (RIQUEZA en `toMediaList`): el item que queda es
  // el que tiene `alternativeText`, no el primero que llegó.
  assert.equal(galeria[0].alt, 'Casa principal');

  // Sin portada, la galería es la galería; y sin nada, [] (no null: la ficha pregunta por .length).
  assert.equal(propiedadGaleria(normalizePropiedad(fila({ imagenes: [{ url: '/uploads/x.jpg' }] })) ).length, 1);
  assert.deepEqual(propiedadGaleria(normalizePropiedad(fila({}))), []);
});

test('LA FUSIÓN DEL DEDUPE es case-insensitive: `/uploads/Foto.jpg` y `/uploads/foto.jpg` se funden', () => {
  // Consecuencia documentada del ledger de T6+7 (`ledger.md:84`), fijada acá para que no sea
  // un secreto a voces: `canonicalKey()` en `src/lib/media.ts` baja la clave a minúsculas.
  // Dos archivos DISTINTOS del mismo nombre en el mismo directorio (ext4 es case-sensitive)
  // se muestran como uno solo en `propiedad.imagenes` y en la galería de la ficha.
  const p = normalizePropiedad(fila({
    imagenes: [{ url: '/uploads/Foto.jpg' }, { url: '/uploads/foto.jpg' }],
  }));
  assert.equal(p.imagenes.length, 1, 'el dedupe dejó de fundir nombres que solo difieren en mayúsculas');
  assert.equal(propiedadGaleria(p).length, 1);
  // Medido en la BD: `select count(*) from files;` = 0 → hoy no hay NINGUNA pieza que se pueda
  // estar escondiendo. El riesgo es del importador (Task 14), no del estado actual del sitio.
});

test('propiedadImagen entrega MediaItem (objeto con url/alt), no string: el alt del admin tiene camino', () => {
  const p = normalizePropiedad(fila({
    imagen_principal: { url: '/uploads/propiedad/portada.jpg', alternativeText: 'Portada del predio' },
  }));
  const item = propiedadImagen(p);
  assert.equal(typeof item, 'object');
  assert.ok(item && 'url' in item && 'alt' in item, 'propiedadImagen no devuelve un MediaItem');
  assert.equal(item.alt, 'Portada del predio');
  // Y sigue siendo idempotente con lo que la plantilla ya sabe hacer.
  assert.equal(mediaSrc(item), '/uploads/propiedad/portada.jpg');

  // Sin portada, cae en la primera de la galería (otro MediaItem, con su alt).
  const soloGaleria = normalizePropiedad(fila({ imagenes: [{ url: '/uploads/g.jpg', alternativeText: 'Galería' }] }));
  assert.equal(propiedadImagen(soloGaleria)?.url, '/uploads/g.jpg');
  assert.equal(propiedadImagen(soloGaleria)?.alt, 'Galería');
});

test('SIN FALLBACK de imagen: con Strapi caído la propiedad no tiene foto, no hay stock', () => {
  const p = normalizePropiedad(fila({}));
  assert.equal(propiedadImagen(p), null);
  assert.deepEqual(propiedadGaleria(p), []);
  // Ningún camino del módulo devuelve una ruta local de relleno.
  const sinMedios = [
    normalizePropiedad(fila({ imagen_principal: {} })),
    normalizePropiedad(fila({ imagen_principal: '   ', imagenes: [] })),
    normalizePropiedad(fila({ imagenes: [{ url: null }] })),
  ];
  for (const q of sinMedios) {
    const img = propiedadImagen(q);
    assert.ok(img === null || /^\/uploads\/|^https?:\/\//.test(img.url), `fallback de stock en ${JSON.stringify(img)}`);
  }
  // Y el módulo no importa ninguna lista de imágenes locales (`LOCAL_IMAGES` es el patrón de café
  // que la 12d NO debe reproducir).
  assert.doesNotMatch(codigo('src/lib/tierras.ts'), /LOCAL_IMAGES|stock|placeholder/i);
});

// ── 2. El barrido de fuente: ninguna plantilla de tierras pinta un medio sin resolver ─

function archivosBajo(dir) {
  const out = [];
  for (const entrada of readdirSync(join(RAIZ, dir))) {
    const p = join(join(RAIZ, dir), entrada);
    if (statSync(p).isDirectory()) out.push(...archivosBajo(join(dir, entrada)));
    else if (p.endsWith('.astro')) out.push(relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return out.sort();
}

const ARCHIVOS_TIERRAS = () => [...archivosBajo('src/pages/tierras'), ...archivosBajo('src/components/tierras')];

/** Llamadas del módulo que entregan un `MediaItem` (o `null`): su resultado NO es un src. */
const RESOLVER = /propiedadImagen\s*\(|propiedadGaleria\s*\(|toMediaItem\s*\(|toMediaList\s*\(|normalizarParaPlantilla\s*\(/;
/** Lo que sí es un src utilizable. */
const RESUELTO = /\.url\b|\bmediaSrc\s*\(|\babsUrl\s*\(|\bembedSrc\s*\(|^['"`]|url=\{|src=`/;

/** Variables del frontmatter que contienen un MediaItem (taint simple: `const X = <RESOLVER>(…)`). */
function nombresMedio(src) {
  const nombres = new Set();
  for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    if (RESOLVER.test(m[2])) nombres.add(m[1]);
  }
  return nombres;
}

function violacionesDeMedios(rel) {
  const src = codigo(rel);
  const cuerpo = src.slice(0, src.indexOf('---', 3) > 0 ? src.indexOf('---', 3) + 3 : 0);
  const nombres = nombresMedio(cuerpo);
  const culpables = [];
  for (const m of src.matchAll(/<img\b[^>]*?\bsrc=\{([\s\S]*?)\}/g)) {
    const expr = m[1].trim();
    const menciona = RESOLVER.test(expr) || [...nombres].some((n) => new RegExp(`\\b${n}\\b`).test(expr));
    if (!menciona) continue;
    if (RESUELTO.test(expr)) continue;
    culpables.push(`    ${rel}:${src.slice(0, m.index).split('\n').length}: src={${expr}}  ← un MediaItem pintado tal cual sale "[object Object]" en el navegador`);
  }
  return culpables;
}

test('el barrido tiene a quién mirar: las tarjetas y la ficha de tierras están en la lista', () => {
  const lista = ARCHIVOS_TIERRAS();
  assert.ok(lista.length >= 20, `barrido recortado (${lista.length} archivos)`);
  for (const f of [
    'src/pages/tierras/index.astro',
    'src/pages/tierras/perfiles/[perfil].astro',
    'src/pages/tierras/propiedades/[slug].astro',
    'src/components/tierras/PropertyCard.astro',
  ]) {
    assert.ok(lista.includes(f), `falta ${f} del barrido`);
  }
});

test('ninguna plantilla de tierras pinta un MediaItem sin resolverlo (.url o el contrato)', () => {
  const culpables = ARCHIVOS_TIERRAS().flatMap(violacionesDeMedios).join('\n');
  assert.equal(culpables, '', `un <img src> de /tierras interpola un objeto del módulo:\n${culpables}`);
});

// ── 3. Contrato de fuente, archivo por archivo (sin type-check, el texto ES el contrato) ─

test('tierras.ts declara MediaItem y normaliza con toMediaItem/toMediaList, no campo a campo', () => {
  const src = codigo('src/lib/tierras.ts');
  assert.match(src, /import\s*\{[^}]*MediaItem[^}]*\}\s*from\s*['"]\.\/media\.ts['"]/, 'tierras.ts no importa el contrato MediaItem desde ./media.ts');
  assert.match(src, /imagen_principal:\s*MediaItem\s*\|\s*null/, 'Propiedad.imagen_principal no es MediaItem | null');
  assert.match(src, /imagenes:\s*MediaItem\[\]\s*\|\s*null/, 'Propiedad.imagenes no es MediaItem[] | null');
  assert.match(src, /toMediaItem\(/, 'normalizePropiedad no usa toMediaItem()');
  assert.match(src, /toMediaList\(/, 'normalizePropiedad no usa toMediaList()');
  // El re-armado a mano, que es lo que mata la rebanada:
  assert.doesNotMatch(src, /\.map\(\s*\(?\s*img\s*:\s*any\s*\)?\s*=>/, 'sigue el .map((img: any) => …) sobre la forma de Strapi');
  assert.doesNotMatch(src, /alternativeText\s*:/, 'sigue armando `{ alternativeText }` campo a campo');
});

test('tierras.ts no arrastra el host interno ni lo deja sin reducir: mediaSrc en el borde correcto', () => {
  const src = codigo('src/lib/tierras.ts');
  // El helper público ya no reduce rutas: entrega el MediaItem con la ruta ya reducida.
  assert.doesNotMatch(src, /propiedadImagen[\s\S]{0,200}?return\s+mediaSrc\(/, 'propiedadImagen sigue devolviendo una ruta y tirando el alt');
});

test('los imports runtime de src/lib llevan extensión .ts (si no, node --test no carga el módulo)', () => {
  const src = codigo('src/lib/tierras.ts');
  const sinExt = [...src.matchAll(/^import\s+(?!type\s)[^'"]*from\s+['"](\.\/[^'"]+)['"]/gm)]
    .map((m) => m[1])
    .filter((esp) => !esp.endsWith('.ts'));
  assert.deepEqual(sinExt, [], `import runtime sin .ts en tierras.ts: ${sinExt.join(', ')}`);
  assert.equal(typeof normalizePropiedad, 'function');
  assert.equal(typeof propiedadImagen, 'function');
  assert.equal(typeof propiedadGaleria, 'function');
});

test('las tres tarjetas pintan `url` y prefieren el alt del medio al título de la propiedad', () => {
  for (const [rel, nombre] of [
    ['src/components/tierras/PropertyCard.astro', 'PropertyCard'],
    ['src/pages/tierras/index.astro', 'índice de tierras'],
    ['src/pages/tierras/perfiles/[perfil].astro', 'perfil de comprador'],
  ]) {
    const src = codigo(rel);
    assert.match(src, /\.alt\s*\|\|/, `${nombre} no prefiere el alt del medio (el alternativeText del admin)`);
    assert.match(src, /propiedadImagen\(/, `${nombre} no pide la portada al módulo`);
    assert.equal(
      (src.match(/propiedadImagen\(/g) || []).length,
      1,
      `${nombre} llama propiedadImagen() más de una vez por tarjeta (se resuelve una vez en el map)`,
    );
    // Y el slot cae al mosaico Icon, no a una imagen de relleno.
    assert.match(src, /name="mountain"/, `${nombre} no cae al Icon sin foto`);
  }
});

test('la ficha ya no re-normaliza: propiedadGaleria desde el módulo, cero mediaSrc en el render', () => {
  const src = codigo('src/pages/tierras/propiedades/[slug].astro');
  assert.match(src, /propiedadGaleria\(/, 'la ficha no usa la galería del módulo');
  assert.doesNotMatch(src, /prop\.imagenes\?\.map\(/, 'la ficha sigue mapeando la forma de Strapi');
  assert.doesNotMatch(src, /mediaSrc\(/, 'la ficha sigue resolviendo rutas que ya vienen reducidas del módulo');
});

test('el slot muerto de fotos_evidencia no vuelve: se retiró con la Task 14', () => {
  // `fotos_evidencia` no es atributo de `propiedades` en el esquema ni campo de `Propiedad`,
  // así que el bloque no renderizaba nunca — y sin type-check en el repo, `astro build` verde
  // no lo decía. Se retira el bloque y el componente; esta prueba es lo único que impide
  // que reaparezcan como "inofensivos".
  assert.ok(!existsSync(join(RAIZ, 'src/components/tierras/VAPEvidenceGallery.astro')), 'revivió VAPEvidenceGallery.astro');
  const culpables = ARCHIVOS_TIERRAS().filter((rel) => /fotos_evidencia|VAPEvidenceGallery/.test(codigo(rel)));
  assert.deepEqual(culpables, [], 'una plantilla de tierras vuelve a leer un campo que el esquema no entrega');
});

// ── 4. Fila 9 del censo: `/tierras/perfiles/*` no puede volver a pedir `/images/perfiles/*.jpg` ─

test('ningún archivo de /tierras referencia /images/perfiles (las 5 rutas que daban 404)', () => {
  const culpables = ARCHIVOS_TIERRAS().filter((rel) => /images\/perfiles/.test(codigo(rel)));
  assert.deepEqual(culpables, [], 'una página de tierras vuelve a hotlinear /images/perfiles/*.jpg');
  // Y el material NO existe: el 0 del censo tiene que poder atribuirse a supresión del slot.
  let existe = true;
  try { readdirSync(join(RAIZ, 'public/images/perfiles')); } catch { existe = false; }
  assert.equal(existe, false, 'public/images/perfiles/ apareció: cambió el motivo del 0 y hay que re-escribir la fila 9');
});

test('los cinco perfiles declaran `imagen: null` y la tarjeta cae al mosaico Icon', () => {
  const src = fuente('src/pages/tierras/perfiles/index.astro');
  assert.equal((src.match(/imagen:\s*null/g) || []).length, 5, 'un perfil de `perfiles/index.astro` volvió a pedir una foto que no existe');
  assert.match(src, /SIN_IMAGEN_TILE/, 'desapareció el mosaico Icon de respaldo');
  // El slot del <img> sigue condicionado a que haya foto: sin foto no se emite <img>.
  assert.match(src, /perfil\.ext\.imagen\s*\?/, 'el <img> del perfil se emite sin foto (404 garantizado)');
});

// ── 5. El JSX reestructurado compila, sin correr `astro build` (la dist/ es compartida) ─

/**
 * Las tres tarjetas pasaron de `map((prop) => (<…>))` a `map((prop) => { const img = …; return (<…>); })`
 * para resolver la portada UNA vez por tarjeta. Un `);` olvidado es un error de sintaxis que
 * `astro build` cacharía — y el build no se puede correr en el árbol compartido. Este teste es
 * el reemplazo: el MISMO compilador de plantillas (`@astrojs/compiler-rs`, dependencia de Astro)
 * + el parser de `esbuild` (dependencia de Vite), en memoria, sin escribir `dist/`.
 */
test('las plantillas de tierras que toqué transforman a JS y ese JS parsea (astro transform + esbuild)', async (t) => {
  const { createRequire } = await import('node:module');
  const require = createRequire(join(RAIZ, 'noop.cjs'));
  let transform;
  let esbuild;
  try {
    ({ transform } = require('@astrojs/compiler-rs'));
    esbuild = require('esbuild');
  } catch {
    t.skip('sin @astrojs/compiler-rs o esbuild en node_modules (el gate necesita el compilador)');
    return;
  }

  const casos = [
    ['src/pages/tierras/index.astro', ['propiedadImagen(prop)', 'img.alt || prop.titulo', 'img.url']],
    ['src/pages/tierras/perfiles/[perfil].astro', ['propiedadImagen(prop)', 'img.alt || prop.titulo']],
    ['src/pages/tierras/propiedades/[slug].astro', ['propiedadGaleria(prop)']],
    ['src/components/tierras/PropertyCard.astro', ['propiedadImagen(prop)', 'img.alt || prop.titulo']],
  ];

  const transformar = async (rel, src) => {
    const r = await transform(src, { filename: rel });
    const code = r?.code ?? '';
    assert.ok(code.length > 0, `${rel}: el transform de Astro no devolvió código (template mal balanceado)`);
    assert.doesNotThrow(
      () => esbuild.transformSync(code, { loader: 'js' }),
      `${rel}: el JS generado por Astro no parsea — el template quedó roto`,
    );
    return code;
  };

  for (const [rel, esperadas] of casos) {
    const code = await transformar(rel, fuente(rel));
    for (const expr of esperadas) {
      assert.ok(code.includes(expr), `${rel}: la expresión \`${expr}\` no llegó al código generado`);
    }
  }

  // Dientes del gate: el mismo `index.astro` con el `);` que cierra el `return (` del map borrado
  // tiene que morir acá (ese es exactamente el error que el restructure podía dejar).
  const crudo = fuente('src/pages/tierras/index.astro');
  const mutado = crudo.replace(/\n\s*\);\n\s*\}\)\}/, '\n        })}');
  assert.notEqual(mutado, crudo, 'el control de dientes no encontró el patrón: este gate no está midiendo nada');
  await assert.rejects(
    (async () => {
      await transformar('src/pages/tierras/index.astro (mutado)', mutado);
    })(),
    'el gate no cachó un `return (` sin cerrar',
  );
});
