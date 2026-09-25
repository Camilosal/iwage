/**
 * Task 12b — las cuatro capas de datos de la rebanada (tienda, proyectos, polinización,
 * experimentos) tienen que entregar `MediaItem`, no un `string` que miente.
 *
 * Por qué un arquivo aparte y no más testes en `normalizar-medio.test.mjs` (12a): ese ya
 * está en revisión del controlador y es el contrato del adaptador. Aquí lo que se prueba
 * es el USO del adaptador por estas cuatro capas y sus plantillas.
 *
 * No hay compilador de TypeScript en este repo: `astro build` solo borra tipos. Un
 * `imagen: MediaItem` entregado a una plantilla que espera `string` —o al revés— compila
 * verde y pinta `[object Object]`. El único guard real es este arquivo.
 *
 * Reglas del runner: `node --test` carga los `.ts` de `src/lib` directo (type-stripping de
 * Node 22), así que los imports llevan extensión `.ts` y acá NO se usa el alias `@/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.APP_URL = process.env.APP_URL || 'https://iwage.co';
process.env.STRAPI_URL = process.env.STRAPI_URL || 'http://iwage_strapi:1337';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Un `MediaItem` bien formado, con lo que las plantillas de esta capa leen. */
const PORTADA = {
  id: 41,
  documentId: 'abc123',
  url: 'http://iwage_strapi:1337/uploads/meliponas/miel-angelita.webp',
  mime: 'image/webp',
  width: 1200,
  height: 800,
  alternativeText: 'Frasco de miel de Angelita 250 ml',
  caption: 'Cosecha 2026, vereda Santagueda',
};

/**
 * El contracto que se rompe con el `?? raw.imagen` de `polinizacion.ts:95` (y con cualquier
 * otro `?? <crudo>`): lo que no tiene URL utilizable sale `null`, NUNCA el valor de entrada.
 */
const BASURA = [
  ['objeto vacío', {}],
  ['url nula', { url: null }],
  ['url en blanco', { url: '   ' }],
  ['número', 123],
  ['array anidado (forma de un `multiple` en un campo de a una)', [{ url: '/uploads/a.webp' }]],
  ['null', null],
  ['undefined', undefined],
  ['string en blanco', '  '],
];

/**
 * Ya no vale "que no sea un objeto": después de 12b `imagen` ES un objeto (`MediaItem`). Lo
 * prohibido es un objeto **sin contrato**, que es exactamente lo que escupía el
 * `?? raw.imagen` de `polinizacion.ts:95`: `{}` o `{url: null}` llegaban a la plantilla y
 * `<img src={[object Object]}>` se pintaba con `astro build` verde. Aquí un valor solo pasa
 * si es `null` o un `MediaItem` con `url` de sitio y `kind`.
 */
function assertSinObjetoCrudo(valor, donde) {
  if (valor === null) return;
  assert.equal(Array.isArray(valor), false, `${donde}: salió un array crudo`);
  assert.equal(typeof valor, 'object', `${donde}: ni null ni MediaItem`);
  assert.equal(typeof valor.url, 'string', `${donde}: objeto sin url utilizable → [object Object] en el <img>`);
  assert.ok(valor.url, `${donde}: url vacía`);
  assert.ok(['imagen', 'video', 'tour360'].includes(valor.kind), `${donde}: MediaItem sin kind`);
  assert.doesNotMatch(valor.url, /iwage_strapi|:1337/, `${donde}: host interno de Docker a la plantilla`);
}

// ── 1. tienda.ts — `normalizeProducto` ────────────────────────────────────────
// `Producto.imagen` declaraba `string | null` (`tienda.ts:60`) y el mapper devolvía
// `mediaSrc(raw.imagen)` (`:125`): la ruta sí llegaba, el `alternativeText` del admin no,
// y el tipo no avisaba nada.

import { normalizeProducto } from '../src/lib/tienda.ts';

const PRODUCTO_BASE = { id: 1, documentId: 'p1', nombre: 'Miel Angelita 250 ml', slug: 'miel-angelita-250', precio: 38000, categoria: 'miel' };

test('tienda: una portada media de Strapi sale MediaItem con alt y ruta de sitio', () => {
  const p = normalizeProducto({ ...PRODUCTO_BASE, imagen: PORTADA });
  assert.equal(p.imagen.url, '/uploads/meliponas/miel-angelita.webp', 'el host interno de Docker llegó a la plantilla');
  assert.equal(p.imagen.alt, 'Frasco de miel de Angelita 250 ml', 'el alternativeText del admin se pierde');
  assert.equal(p.imagen.caption, 'Cosecha 2026, vereda Santagueda');
  assert.equal(p.imagen.kind, 'imagen');
});

test('tienda: la forma vieja (string suelto) sigue funcionando', () => {
  const p = normalizeProducto({ ...PRODUCTO_BASE, imagen: '/uploads/x.webp' });
  assert.equal(p.imagen.url, '/uploads/x.webp');
  const v = normalizeProducto({ ...PRODUCTO_BASE, imagen: 'http://iwage_strapi:1337/uploads/x.webp' });
  assert.equal(v.imagen.url, '/uploads/x.webp');
});

test('tienda: imagen basura → null, y jamás el valor crudo', () => {
  for (const [motivo, imagen] of BASURA) {
    const p = normalizeProducto({ ...PRODUCTO_BASE, imagen });
    assert.equal(p.imagen, null, `${motivo}: salió ${JSON.stringify(p.imagen)}`);
    assertSinObjetoCrudo(p.imagen, `tienda/${motivo}`);
  }
});

test('tienda: la galería deduplica el mismo archivo y una tarjeta no se queda sin alt', () => {
  const p = normalizeProducto({
    ...PRODUCTO_BASE,
    imagen: PORTADA,
    galeria: [{ url: '/uploads/g.jpg', alternativeText: 'Con alt' }, { url: '/uploads/g.jpg' }],
  });
  assert.equal(p.galeria.length, 1, 'el mismo archivo dos veces sale duplicado');
  assert.equal(p.galeria[0].alt, 'Con alt', 'el dedupe eligió la versión pobre');
});

// ── 2. polinizacion.ts — `mapCultivo` → `normalizeCultivo` ───────────────────
// `polinizacion.ts:95` es `mediaSrc(raw.imagen) ?? raw.imagen ?? (galeria?.[0]?.url ?? null)`.
// `rawOf()` de `media.ts:60-69` acepta objeto, así que el primer tramo funciona con el
// esquema nuevo; pero cuando devuelve `null` el segundo tramo entrega EL OBJETO CRUDO, y
// `src/pages/meliponas/polinizacion/[slug].astro:64` lo pinta en `<img src>`.

import { normalizeCultivo } from '../src/lib/polinizacion.ts';

const CULTIVO_BASE = { id: 1, documentId: 'c1', nombre: 'Café', slug: 'cafe' };

test('polinización: portada media de Strapi → MediaItem con alt', () => {
  const c = normalizeCultivo({ ...CULTIVO_BASE, imagen: { ...PORTADA, url: '/uploads/cultivos/cafe.webp', alternativeText: 'Cafetal en floración' } });
  assert.equal(c.imagen.url, '/uploads/cultivos/cafe.webp');
  assert.equal(c.imagen.alt, 'Cafetal en floración');
});

test('polinización: imagen basura → null y NUNCA el crudo (el `?? raw.imagen` de :95)', () => {
  for (const [motivo, imagen] of BASURA) {
    const c = normalizeCultivo({ ...CULTIVO_BASE, imagen });
    assert.equal(c.imagen, null, `${motivo}: salió ${JSON.stringify(c.imagen)}`);
    assertSinObjetoCrudo(c.imagen, `polinización/${motivo}`);
  }
  // Y con galería llena pero portada basura: sin imagen, no la primera de la galería
  // disfrazada de portada (la galería se pinta aparte en `[slug].astro:71`).
  const conGaleria = normalizeCultivo({
    ...CULTIVO_BASE,
    imagen: {},
    galeria: [{ url: '/uploads/g1.webp' }, { url: '/uploads/g2.webp' }],
  });
  assert.equal(conGaleria.imagen, null, 'la portada se está inventando desde la galería');
  assert.equal(conGaleria.galeria.length, 2);
});

test('polinización: la forma vieja string y el host interno', () => {
  const c = normalizeCultivo({ ...CULTIVO_BASE, imagen: 'http://iwage_strapi:1337/uploads/cultivos/cafe.webp' });
  assert.equal(c.imagen.url, '/uploads/cultivos/cafe.webp');
});

// ── 3. proyectos.ts — `normalizeProyecto` ─────────────────────────────────────
// `proyectos.ts:140` es `raw.imagen ? mediaSrc(raw.imagen) : (galeria?.[0]?.url ?? null)`:
// cuando no hay portada, la portada es la primera foto de la galería dicha como string, y
// `:30` declara `string | null`. En `[slug].astro:38` se pinta `src={proyecto.imagen}` y en
// `meliponas/index.astro:235` se mezcla `p.galeria?.[0]?.url ?? p.imagen`: dos formas de la
// misma pieza viajando por el mismo campo.

import { normalizeProyecto } from '../src/lib/proyectos.ts';

const PROYECTO_BASE = { id: 1, documentId: 'pr1', nombre: 'Finca Angelita', slug: 'finca-angelita', tipo: 'finca' };

test('proyectos: portada media de Strapi → MediaItem con alt', () => {
  const p = normalizeProyecto({ ...PROYECTO_BASE, imagen: { ...PORTADA, url: '/uploads/proyectos/finca.webp', alternativeText: 'Casetas de meliponas en la finca' } });
  assert.equal(p.imagen.url, '/uploads/proyectos/finca.webp');
  assert.equal(p.imagen.alt, 'Casetas de meliponas en la finca');
});

test('proyectos: sin portada no hay portada, aunque la galería esté llena', () => {
  const p = normalizeProyecto({
    ...PROYECTO_BASE,
    imagen: null,
    galeria: [{ url: '/uploads/proyectos/g1.webp', alternativeText: 'Primera de la galería' }],
  });
  assert.equal(p.imagen, null, 'la galería se está usando de portada: dos campos diciendo lo mismo');
  assert.equal(p.galeria[0].alt, 'Primera de la galería', 'y arriba se pierde el alt que sí tenía');
});

test('proyectos: la forma vieja string y el host interno', () => {
  const p = normalizeProyecto({ ...PROYECTO_BASE, imagen: 'http://strapi_backend:1337/uploads/proyectos/finca.webp' });
  assert.equal(p.imagen.url, '/uploads/proyectos/finca.webp');
});

test('proyectos: imagen basura → null y jamás el crudo', () => {
  for (const [motivo, imagen] of [...BASURA, ['string de galería', '/uploads/g1.webp']]) {
    const p = normalizeProyecto({ ...PROYECTO_BASE, imagen, galeria: [{ url: '/uploads/g1.webp' }] });
    assert.equal(typeof p.imagen === 'string', false, `${motivo}: sigue saliendo un string pelado`);
    assertSinObjetoCrudo(p.imagen, `proyectos/${motivo}`);
    if (imagen !== '/uploads/g1.webp') assert.equal(p.imagen, null, `${motivo}: salió ${JSON.stringify(p.imagen)}`);
  }
});

// ── 4. granja-experimentos.ts — el módulo que no normalizaba nada ─────────────
// `Experimento.imagen` (`:31`) declara `string | null` y el módulo NO importa `media.ts`:
// `getExperimentos`, `getExperimentoBySlug` y `getExperimentosBySubsistema` devuelven
// `res.data` crudo. Dos de sus consumidores (`granja/experimentos/[slug].astro:28,129` y
// `granja/index.astro:193`) lo salvan llamando `mediaSrc()` en el render; `ExperimentFicha`
// no pinta imagen en absoluto (medido con grep). O sea: el tipo miente y el arreglo está
// repartido en tres plantillas. Se normaliza UNA vez, en el módulo.

import { normalizeExperimento } from '../src/lib/granja-experimentos.ts';

const EXPERIMENTO_BASE = { id: 1, documentId: 'e1', titulo: 'Composta en tambo', slug: 'composta-tambo' };

test('experimentos: portada media de Strapi → MediaItem con alt', () => {
  const e = normalizeExperimento({ ...EXPERIMENTO_BASE, imagen: { ...PORTADA, url: '/uploads/experimentos/composta.webp', alternativeText: 'Tambo de compostaje abierto' } });
  assert.equal(e.imagen.url, '/uploads/experimentos/composta.webp');
  assert.equal(e.imagen.alt, 'Tambo de compostaje abierto');
  assert.equal(e.titulo, 'Composta en tambo', 'el mapper perdió el resto de la ficha');
});

test('experimentos: la forma vieja string sigue funcionando y el host interno se reduce', () => {
  const a = normalizeExperimento({ ...EXPERIMENTO_BASE, imagen: '/uploads/experimentos/x.webp' });
  assert.equal(a.imagen.url, '/uploads/experimentos/x.webp');
  const b = normalizeExperimento({ ...EXPERIMENTO_BASE, imagen: 'http://iwage_strapi:1337/uploads/experimentos/x.webp' });
  assert.equal(b.imagen.url, '/uploads/experimentos/x.webp');
});

test('experimentos: imagen basura → null, y jamás el valor crudo de Strapi', () => {
  for (const [motivo, imagen] of [...BASURA, [ 'el objeto media sin poblar', { id: 9, documentId: 'm9', mime: 'image/webp' }]]) {
    const e = normalizeExperimento({ ...EXPERIMENTO_BASE, imagen });
    assert.equal(e.imagen, null, `${motivo}: salió ${JSON.stringify(e.imagen)}`);
    assertSinObjetoCrudo(e.imagen, `experimentos/${motivo}`);
  }
});

test('experimentos: las tres lecturas mapean; ninguna devuelve res.data crudo', () => {
  // Sin el mapper en las tres funciones, el `[object Object]` depende de qué página se
  // acuerde de llamar `mediaSrc()`. Este barrido es el que no deja volver a ese estado.
  const fuente = readFileSync(join(RAIZ, 'src/lib/granja-experimentos.ts'), 'utf8');
  const funciones = fuente.split(/\n(?=export async function )/).filter((b) => /res\.data/.test(b));
  assert.ok(funciones.length >= 3, `se esperaban al menos 3 lecturas, hay ${funciones.length}`);
  for (const bloque of funciones) {
    const nombre = (bloque.match(/export async function (\w+)/) ?? [])[1] ?? '?';
    assert.match(bloque, /normalizeExperimento/, `${nombre}: devuelve la fila cruda de Strapi`);
  }
  assert.doesNotMatch(fuente, /imagen:\s*string\s*\|\s*null/, 'el tipo sigue declarando string');
});

// ── 5. El barrido: sin compilador de tipos, el guard es este teste ────────────
// `astro build` borra los tipos, no los verifica. Un `src={x.imagen}` que se quedó
// atrás al migrar el módulo pinta `[object Object]` con la suite entera en verde, así
// que lo que se comprueba acá es la TEXTURA del árbol: en los archivos de esta capa ya
// no puede quedar una interpolación que meta un `imagen` pelado en un atributo, ni un
// `mediaSrc()` resolviendo en el render (eso es exactamente lo que se estaba arreglando:
// la normalización vive en `src/lib`, una sola vez).

const ARCHIVOS_CAPA = [
  'src/pages/meliponas/tienda/[slug].astro',
  'src/pages/granja/tienda/[slug].astro',
  'src/pages/meliponas/tienda/index.astro',
  'src/pages/granja/tienda/index.astro',
  'src/pages/meliponas/polinizacion/[slug].astro',
  'src/pages/meliponas/polinizacion/index.astro',
  'src/pages/meliponas/proyectos/[slug].astro',
  'src/pages/meliponas/proyectos/index.astro',
  'src/pages/meliponas/proyectos/lineas/fincas-productivas.astro',
  'src/pages/meliponas/proyectos/lineas/paisajismo-residencial.astro',
  'src/pages/meliponas/proyectos/lineas/prae-educativo.astro',
  'src/pages/meliponas/proyectos/lineas/turismo-naturaleza.astro',
  'src/pages/meliponas/index.astro',
  'src/pages/granja/index.astro',
  'src/pages/granja/experimentos/[slug].astro',
  'src/pages/granja/experimentos/index.astro',
  'src/pages/feed/google-merchant.xml.ts',
  'src/components/ProductCard.astro',
  'src/components/ProjectCard.astro',
  'src/components/granja/ExperimentFicha.astro',
];

const MODULOS_CAPA = ['src/lib/tienda.ts', 'src/lib/proyectos.ts', 'src/lib/polinizacion.ts', 'src/lib/granja-experimentos.ts'];

/**
 * `= { x.imagen }`: un `MediaItem` entrando crudo a un atributo de imagen. El nombre del
 * atributo importa —`imagen={hero.imagen}` es la config del héroe (un string de `/images/`
 * que sale de `src/lib/heroes.ts`, no media de contenido) y por eso NO entra en el barrido.
 *
 * El cierre `}` ya NO se exige: estaba en la versión anterior, así que
 * `src={prop.imagen ?? x}` (mismo defecto, misma `[object Object]`) escapaba del barrido
 * por llevar algo después del campo.
 *
 * Dos cosas que este ensanche midió y que hay que saber para no volver a romperla:
 *  · `\bimagen\b` NUNCA cachaba `imagen_principal`: `_` es carácter de palabra, así que no hay
 *    frontier entre `n` y `_`. El campo real de `Propiedad` —el que más se pinta— le era invisible
 *    a la aguja. Por eso la alternación nombra los campos, de largo a corto: con `imagen` primero,
 *    el regex se queda en `imagen` y el lookahead deja pasar `imagen_principal.url` por accidente.
 *  · La exclusión es `\.url` y `\?\.url`: medidas 20 de las 20 banderas del primer ensanche, 9 eran
 *    `image={p.imagen?.url}` — resueltas y bien. Sin el `?` opcional el gate ruge sobre código sano.
 */
const INTERPOLACION_CRUDA = /\b((?:src|image|ogImage|twitterImage|url)\s*=\s*\{\s*[A-Za-z_$][\w$]*(?:\.[\w$]+)*\.(?:imagen_principal|imagen_hero|foto_perfil|foto_territorio|thumbnail|foto|imagen)\b(?!\s*\??\.url))/;

/**
 * Textos que SÍ entregan el `MediaItem` entero porque el resolve corre del otro lado.
 * No es una excepción de conveniencia: `BitacoraCard.astro:12` declara `image?: MediaItem | null`
 * y lo reduce con `mediaSrc()` en `:22`. `image` es el único nombre ambiguo del barrido —en
 * ProductCard/ProjectCard espera un string (`image={p.imagen?.url}`) y en BitacoraCard espera el
 * objeto—, así que la excepción va ligada al texto exacto y no al nombre del atributo.
 */
const PROP_MEDIAITEM = new Set(['image={post.imagen']);

test('la aguja tiene dientes: se traga el MediaItem crudo y deja pasar lo resuelto', () => {
  for (const defecto of [
    '<img src={prop.imagen_principal}',
    'src={prop.imagen ?? x}',
    '<img src={p.foto}',
    'ogImage={exp.imagen_hero}',
  ]) {
    assert.match(defecto, INTERPOLACION_CRUDA, `la aguja dejó pasar un medio crudo: ${defecto}`);
  }
  for (const sano of [
    'image={p.imagen?.url}',
    'ogImage={exp.imagen?.url ?? undefined}',
    'ogImage={exp.imagen_principal.url}',
    'image={p.imagen?.url ?? p.galeria?.[0]?.url}',
    'imagen={hero.imagen}',
    'src={`/uploads/a.jpg`}',
  ]) {
    assert.doesNotMatch(sano, INTERPOLACION_CRUDA, `la aguja traga código sano: ${sano}`);
  }
});

test('barrido: ninguna plantilla de la capa interpola la portada cruda', () => {
  const culpables = [];
  for (const ruta of ARCHIVOS_CAPA) {
    const absoluto = join(RAIZ, ruta);
    assert.ok(existsSync(absoluto), `${ruta}: desapareció, actualiza la lista del barrido`);
    const fuente = readFileSync(absoluto, 'utf8');
    for (const [i, linea] of fuente.split('\n').entries()) {
      const casa = linea.match(INTERPOLACION_CRUDA);
      if (!casa) continue;
      if (PROP_MEDIAITEM.has(casa[1])) continue;
      culpables.push(`${ruta}:${i + 1}: ${casa[1]}`);
    }
  }
  assert.deepEqual(culpables, [], `portada cruda interpolada (pintaría [object Object]): ${culpables.join(', ')}`);
});

test('barrido: la capa ya no resuelve media en el render', () => {
  const culpables = ARCHIVOS_CAPA.filter((ruta) => /mediaSrc\s*\(/.test(readFileSync(join(RAIZ, ruta), 'utf8')));
  assert.deepEqual(culpables, [], `mediaSrc() en plantilla: normalizar dos veces / tipo mentiroso: ${culpables.join(', ')}`);
});

test('barrido: los cuatro módulos declaran MediaItem, no string', () => {
  for (const ruta of MODULOS_CAPA) {
    const fuente = readFileSync(join(RAIZ, ruta), 'utf8');
    assert.match(fuente, /imagen:\s*MediaItem\s*\|\s*null/, `${ruta}: ` + `imagen` + ` sigue declarado como string`);
    assert.doesNotMatch(fuente, /imagen:\s*string\s*\|\s*null/, `${ruta}: quedó un string | null`);
    // Y el import runtime del adaptador lleva extensión: sin ella `node --test` no carga
    // el módulo y los cinco testes de arriba ni siquiera correrían.
    assert.match(fuente, /from '\.\/normalizar-medio\.ts'/, `${ruta}: no usa el adaptador de 12a`);
  }
});

// ── 6. Dos cosas que el brief pidió medir y no solo asumir ────────────────────

test('el dedupe de galería es por host+ruta y NO distingue mayúsculas: Foto.jpg y foto.jpg se funden', () => {
  // Es comportamiento heredado de `canonicalKey()` en `media.ts:127-134`, no de esta capa.
  // Se fija acá porque es la única forma de que el cambio de comportamiento se vea.
  const p = normalizeProducto({
    ...PRODUCTO_BASE,
    galeria: [{ url: '/uploads/Foto.jpg', alternativeText: 'Arriba' }, { url: '/uploads/foto.jpg', alternativeText: 'Abajo' }],
  });
  assert.equal(p.galeria.length, 1, 'se esperaban 1 item (la clave baja el case): salió ' + p.galeria.length);
  assert.equal(p.galeria[0].alt, 'Arriba', 'el dedupe conserva la primera (la más rica)');

  // Y la ruta con el host propio escrito de dos formas sigue siendo UNA sola pieza.
  const mixtas = normalizeProducto({
    ...PRODUCTO_BASE,
    galeria: [
      { url: 'http://iwage_strapi:1337/uploads/g.jpg' },
      '/uploads/g.jpg',
      { url: 'https://www.iwage.co/uploads/g.jpg' },
    ],
  });
  assert.equal(mixtas.galeria.length, 1, 'las tres formas de la misma pieza no convergen');

  // Y una galería MIXTA no se contamina: la pieza propia sobrevive y el hotlink de
  // stock se descarta en el camino (`esPintable`, `media.ts`). Antes este bloque fijaba
  // lo contrario —dos externos, dos piezas— y por eso se reemplaza, no se borra: lo que
  // se prueba ahora es la política aprobada, no un detalle del dedupe.
  const mixta = normalizeProducto({
    ...PRODUCTO_BASE,
    galeria: [
      { url: 'https://images.unsplash.com/photo-1470071459604?w=800' },
      '/uploads/producto/real.jpg',
    ],
  });
  assert.deepEqual(mixta.galeria.map((g) => g.url), ['/uploads/producto/real.jpg']);
});

test('las 18 plantillas de la capa compilan con el compiler de Astro', async () => {
  // El `astro build` completo NO se corre acá: `dist/` es compartida y hay otros agentes
  // en el árbol (lo corrige el controlador al final). Lo que sí se puede medir sin tocar
  // el disco es que el componente parsee y transforme: un `<img src={x.imagen}` roto al
  // migrar sería un error de sintaxis de plantilla, y esto lo nombra con su archivo.
  const { parse, transform } = await import('@astrojs/compiler-rs');
  const culpables = [];
  for (const ruta of ARCHIVOS_CAPA.filter((f) => f.endsWith('.astro'))) {
    const fuente = readFileSync(join(RAIZ, ruta), 'utf8');
    try {
      const p = parse(fuente, { position: false });
      const dp = (p.diagnostics ?? []).filter((d) => (d.severity ?? 1) === 1);
      if (dp.length) culpables.push(`${ruta}: parse — ${dp[0].text}`);
      const t = await transform(fuente, { filename: ruta, normalizeEncoding: 'utf-8' });
      const dt = (t.diagnostics ?? []).filter((d) => (d.severity ?? 1) === 1);
      if (dt.length) culpables.push(`${ruta}: transform — ${dt[0].text}`);
    } catch (e) {
      culpables.push(`${ruta}: ${String(e && e.message).slice(0, 120)}`);
    }
  }
  assert.ok(ARCHIVOS_CAPA.filter((f) => f.endsWith('.astro')).length >= 17, 'la lista del barrido se quedó corta');
  assert.deepEqual(culpables, [], 'plantillas de la capa que no compilan');
});
