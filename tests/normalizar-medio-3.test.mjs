/**
 * Task 12c (F2) · rebanada `naturaleza.ts` + `gestion.ts` — el adaptador de media llega a
 * las últimas dos fichas que armaban la forma de Strapi a mano.
 *
 * Por qué este archivo existe y no es copia de `normalizar-medio.test.mjs` (12a) ni de
 * `normalizar-medio-2.test.mjs` (12b, en vuelo): los tres defectos que se matan acá son
 * medidos y propios de estos dos módulos —
 *
 *  1. `gestion.ts:291` entregaba `foto_perfil: a.foto_perfil` **crudo** con el tipo
 *     `foto_perfil?: any`. Un objeto media donde la plantilla espera string pinta
 *     `src="[object Object]"`, y `astro build` NO lo detecta: en este repo no hay
 *     compilador de TypeScript, `astro build` solo borra tipos. El único guard posible
 *     es un teste, y ese teste es `la ficha de anfitriones de gestion.ts jamas entrega el
 *     objeto crudo` (se demoledó por mutación en el reporte de la tarea).
 *  2. El `alternativeText` del admin no bajaba a la plantilla. `mediaSrc()` devuelve solo
 *     la ruta, así que el `alt` salía del nombre de la propiedad o del anfitrión: las
 *     fichas de anfitriones, experiencias y paquetes pintaban fotos sin descripción.
 *     Se corta por dos lados: el valor (`MediaItem.alt`) y el render (`alt={x.alt || …}`,
 *     barrido (d) abajo).
 *  3. Los tipos declarados mentían (`imagen: string | null` sobre un campo `media`,
 *     `imagen_principal: { url; alternativeText? } | null` re-armado campo a campo). Sin
 *     compilador, el tipo ES el contrato y el contrato se lee en el fuente: bloque 5.
 *
 * Forma de entrada admitida en todos los casos: objeto media de Strapi v5, string de la
 * BD vieja (o twin `*_url`), `MediaItem` ya normalizado (fila que pasó por dos bordes) y
 * basura (`{}`, `{url:null}`, `123`, `[]`). La basura sale `null` / `[]`, nunca `undefined`
 * y nunca el crudo.
 *
 * Correr solo este archivo mientras la rebanada está en vuelo:
 *   node --test tests/normalizar-medio-3.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

// El mismo `IWAGE_SRC` del barrido de 12a: apunta el gate de plantillas a una COPIA del
// árbol, única forma de MEDIR los dientes del candado (revertir un call site en /tmp y
// ver el rojo) sin tocar el árbol compartido. Sin la variable, el repositorio.
const RAIZ = process.env.IWAGE_SRC ? resolve(process.env.IWAGE_SRC) : fileURLToPath(new URL('..', import.meta.url));

// Import de namespace, no destructuring: los normalizadores nuevos de esta rebanada
// todavía no existen mientras el teste está rojo, y un `import { x }` inexistente tumbaría
// la carga del archivo entero (rojo sin información). Con `exp()` cada ítem dice qué falta.
const gestion = await import(join(RAIZ, 'src/lib/gestion.ts'));
const naturaleza = await import(join(RAIZ, 'src/lib/naturaleza.ts'));

function exp(modulo, nombre, archivo) {
  assert.equal(typeof modulo[nombre], 'function', `${archivo} no exporta ${nombre}()`);
  return modulo[nombre];
}

// Alias por función: la exportación se resuelve EN LA LLAMADA, así que un nombre que aún
// no existe da el rojo dentro del teste que le corresponde (y no a la carga del archivo).
const normalizePropiedadGestion = (...a) => exp(gestion, 'normalizePropiedadGestion', 'gestion.ts')(...a);
const propiedadGestionImagen = (...a) => exp(gestion, 'propiedadGestionImagen', 'gestion.ts')(...a);
const normalizarComplemento = (...a) => exp(gestion, 'normalizarComplemento', 'gestion.ts')(...a);
const normalizarProductoRecomendado = (...a) => exp(gestion, 'normalizarProductoRecomendado', 'gestion.ts')(...a);
const experienciaGestionParaPlantilla = (...a) => exp(gestion, 'experienciaGestionParaPlantilla', 'gestion.ts')(...a);
const experienciaParaPlantilla = (...a) => exp(naturaleza, 'experienciaParaPlantilla', 'naturaleza.ts')(...a);
const anfitrionParaPlantilla = (...a) => exp(naturaleza, 'anfitrionParaPlantilla', 'naturaleza.ts')(...a);
const paqueteParaPlantilla = (...a) => exp(naturaleza, 'paqueteParaPlantilla', 'naturaleza.ts')(...a);
const experienciaImagen = (...a) => exp(naturaleza, 'experienciaImagen', 'naturaleza.ts')(...a);
const experienciaGaleria = (...a) => exp(naturaleza, 'experienciaGaleria', 'naturaleza.ts')(...a);
const anfitrionFoto = (...a) => exp(naturaleza, 'anfitrionFoto', 'naturaleza.ts')(...a);

/** Host interno del compose: pintado tal cual, el navegador pide un host que no existe. */
const ADENTRO = 'http://strapi_backend:1337/uploads/gestion/finca-paraiso.webp';

// ── 1. `gestion.ts`: la cuna del `[object Object]` (brief, defecto 2) ─────────

test('gestion: foto_perfil de anfitrion → MediaItem con url de sitio y alt del admin, nunca el crudo', () => {
  const prop = normalizePropiedadGestion({
    id: 1, documentId: 'pg1', titulo: 'Finca El Paraíso', slug: 'finca-paraiso',
    anfitriones: [{
      id: 8, slug: 'don-hernando', nombre: 'Don Hernando',
      foto_perfil: { id: 12, url: ADENTRO, mime: 'image/webp', alternativeText: 'Don Hernando en el cafetal' },
    }],
  });
  const [anf] = prop.anfitriones;
  assert.ok(anf.foto_perfil, 'foto_perfil salió vacío con un media object de entrada');
  assert.equal(anf.foto_perfil.url, '/uploads/gestion/finca-paraiso.webp', 'el host interno del compose llegó a la plantilla');
  assert.equal(anf.foto_perfil.alt, 'Don Hernando en el cafetal', 'el alternativeText del admin no baja: defecto 1');
  assert.equal(anf.foto_perfil.kind, 'imagen');
  // El crudo NO puede salir por ningún lado: ni el objeto de Strapi ni sus campos sueltos.
  assert.equal(anf.foto_perfil.mime, undefined, 'salió el objeto media crudo de Strapi');
  assert.equal(anf.foto_perfil.id, undefined, 'salió el objeto media crudo de Strapi');
  // La forma EXACTA del contrato: ni los campos de Strapi dentro, ni campos de más.
  assert.deepEqual(anf.foto_perfil, {
    url: '/uploads/gestion/finca-paraiso.webp',
    kind: 'imagen',
    provider: 'strapi',
    alt: 'Don Hernando en el cafetal',
  });
});

test('gestion: el twin foto_perfil_url YA no es fuente de datos (G5 lo sacó del esquema)', () => {
  // Retirado el 2026-09-28 con Task 15 / G5: la columna salió de
  // `anfitrion/schema.json`, de `normalizarAnfitrionVinculado` y de la BD (G4 la puso a NULL).
  // El guard deja de probar que el twin funciona y pasa a probar que NADIE lo re-cablea:
  // si alguien lo vuelve a meter en `medioCrudo(...)`, este test se pinta rojo.
  const soloTwin = normalizePropiedadGestion({
    anfitriones: [{ id: 9, slug: 'luz-elenia', nombre: 'Luz Elenia', foto_perfil_url: '/uploads/anfitriones/luz-elenia.jpg' }],
  });
  assert.equal(soloTwin.anfitriones[0].foto_perfil, null, 'el twin resurrecto volvió a pintar en gestión');

  // El media de Strapi es la única fuente.
  const conMedia = normalizePropiedadGestion({
    anfitriones: [{
      id: 11, slug: 'y', nombre: 'Y',
      foto_perfil_url: '/uploads/viejas/stale.jpg',
      foto_perfil: { url: '/uploads/nuevas/foto-nueva.webp', alternativeText: 'Foto nueva del admin' },
    }],
  });
  assert.equal(conMedia.anfitriones[0].foto_perfil.url, '/uploads/nuevas/foto-nueva.webp');
  assert.equal(conMedia.anfitriones[0].foto_perfil.alt, 'Foto nueva del admin');

  const fotoViejaComoString = normalizePropiedadGestion({
    anfitriones: [{ id: 10, slug: 'x', nombre: 'X', foto_perfil: ADENTRO }],
  });
  assert.equal(fotoViejaComoString.anfitriones[0].foto_perfil.url, '/uploads/gestion/finca-paraiso.webp');
});

test('gestion: foto_perfil basura → null (no undefined, no el crudo)', () => {
  for (const [motivo, valor] of [
    ['objeto vacío', {}],
    ['url nula', { url: null }],
    ['numero', 123],
    ['array vacío', []],
    ['string en blanco', '   '],
    ['nulo', null],
  ]) {
    const prop = normalizePropiedadGestion({ anfitriones: [{ id: 1, slug: 's', nombre: 'N', foto_perfil: valor }] });
    assert.equal(prop.anfitriones[0].foto_perfil, null, `${motivo}: no dio null`);
    assert.ok('foto_perfil' in prop.anfitriones[0], `${motivo}: el campo desapareció de la fila`);
  }
});

test('gestion: imagen_principal y galeria salen MediaItem (antes se re-armaban campo a campo)', () => {
  const prop = normalizePropiedadGestion({
    id: 2, documentId: 'pg2', slug: 'glamping', titulo: 'Glamping Bosque de Niebla',
    imagen_principal: { id: 21, url: ADENTRO, mime: 'image/webp', alternativeText: 'Domo al amanecer' },
    // Array anidado: la forma en que Strapi devuelve una relación `multiple`.
    galeria: [[
      { url: '/uploads/g/alba.webp', alternativeText: 'Alba' },
      { url: '/uploads/g/alba.webp', alternativeText: 'Alba' },
      { url: 'http://iwage_strapi:1337/uploads/g/niebla.webp', alternativeText: 'Niebla' },
    ]],
  });
  assert.equal(prop.imagen_principal.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(prop.imagen_principal.alt, 'Domo al amanecer');
  assert.equal(prop.imagen_principal.alternativeText, undefined, 'salió la forma vieja re-armada, no un MediaItem');
  assert.deepEqual(prop.galeria.map((g) => g.url), ['/uploads/g/alba.webp', '/uploads/g/niebla.webp'], 'el mismo archivo dos veces debe salir 1 vez');
  assert.equal(prop.galeria[1].alt, 'Niebla');

  // Sin datos, null y []: la tarjeta cae al mosaico Icon, no a una foto de stock.
  const vacia = normalizePropiedadGestion({});
  assert.equal(vacia.imagen_principal, null);
  assert.deepEqual(vacia.galeria, []);
});

test('gestion: propiedadGestionImagen entrega MediaItem y cede a la galería solo con evidencia', () => {
  const conPortada = normalizePropiedadGestion({
    titulo: 'T', imagen_principal: { url: '/uploads/p/a.webp', alternativeText: 'Portada A' },
  });
  const portada = propiedadGestionImagen(conPortada);
  assert.equal(portada.url, '/uploads/p/a.webp');
  assert.equal(portada.alt, 'Portada A', 'propiedadGestionImagen pierde el alt del admin');

  const sinPortada = normalizePropiedadGestion({ titulo: 'T', galeria: [{ url: '/uploads/p/b.webp', alternativeText: 'Galería B' }] });
  assert.equal(propiedadGestionImagen(sinPortada).url, '/uploads/p/b.webp');
  assert.equal(propiedadGestionImagen(sinPortada).alt, 'Galería B');

  assert.equal(propiedadGestionImagen(normalizePropiedadGestion({ titulo: 'T' })), null, 'una propiedad sin fotos tiene que caer al mosaico, no a un stock');
});

test('gestion: complemento, producto recomendado y experiencia de gestión salen MediaItem', () => {
  const crudos = {
    complemento: { id: 3, slug: 'cena', nombre: 'Cena campesina', imagen: { url: ADENTRO, alternativeText: 'Mesa servida' } },
    producto: { id: 4, slug: 'miel', nombre: 'Miel multi floral', imagen: { url: '/uploads/p/miel.webp', alternativeText: 'Frasco de miel' } },
    experiencia: { id: 5, slug: 'ruta', titulo: 'Ruta del café', imagen_hero: { url: '/uploads/e/cafe.webp', alternativeText: 'Cafetal en flor' } },
  };
  const c = normalizarComplemento(crudos.complemento);
  assert.equal(c.imagen.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(c.imagen.alt, 'Mesa servida');
  assert.ok('imagen' in c && !('imagen_url' in c), 'complemento sigue entregando el twin imagen_url por separado');

  const p = normalizarProductoRecomendado(crudos.producto);
  assert.equal(p.imagen.url, '/uploads/p/miel.webp');
  assert.equal(p.imagen.alt, 'Frasco de miel');

  const e = experienciaGestionParaPlantilla(crudos.experiencia);
  assert.equal(e.imagen.url, '/uploads/e/cafe.webp');
  assert.equal(e.imagen.alt, 'Cafetal en flor');

  // Twins como única fuente: G5 los sacó del esquema y G4 de la BD, así que ya NO pintan.
  // El guard queda para que nadie los re-cablee al normalizador.
  assert.equal(normalizarComplemento({ imagen_url: '/uploads/c/vieja.jpg' }).imagen, null, 'el twin imagen_url volvió a ser fuente');
  assert.equal(experienciaGestionParaPlantilla({ imagen_hero_url: ADENTRO }).imagen, null, 'el twin imagen_hero_url volvió a ser fuente');
  // Y basura → null sin lanzar.
  assert.equal(normalizarComplemento({ imagen: {} }).imagen, null);

  // El camino largo: `normalizePropiedadGestion` tiene que normalizar las relaciones,
  // no entregarlas crudas. Ese era exactamente el objeto de la línea 291 de `gestion.ts`
  // (`complementos: raw.complementos`), y el único motivo por el que la rebanada existió.
  const conRel = normalizePropiedadGestion({
    titulo: 'T',
    complementos: [crudos.complemento],
    productos: [crudos.producto],
    anfitriones: [{ slug: 'ana', nombre: 'Ana', foto_perfil: { url: ADENTRO, alternativeText: 'Ana en la puerta' } }],
  });
  assert.equal(conRel.complementos[0].imagen.alt, 'Mesa servida', 'gestion.ts entrega el complemento crudo: [object Object] en ComplementosSection');
  assert.equal(conRel.productos[0].imagen.alt, 'Frasco de miel', 'gestion.ts entrega el producto crudo');
  assert.equal(conRel.anfitriones[0].foto_perfil.alt, 'Ana en la puerta', 'gestion.ts entrega el anfitrión crudo');
  assert.equal(normalizarProductoRecomendado({ imagen: 123 }).imagen, null);
  assert.equal(experienciaGestionParaPlantilla({ imagen_hero: [] }).imagen, null);
});

// ── 2. `naturaleza.ts`: el alt que nunca llegó y la cadena de fallback ────────

test('naturaleza: la ficha de experiencia conserva el alt del hero y cae a la galería', () => {
  const exp = experienciaParaPlantilla({
    slug: 'jardin', titulo: 'Jardín medicinal',
    imagen_hero: { id: 31, url: ADENTRO, mime: 'image/webp', alternativeText: 'Herbario de Don Hernando' },
  });
  assert.equal(exp.imagen_hero.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(exp.imagen_hero.alt, 'Herbario de Don Hernando');
  assert.equal(experienciaImagen(exp).alt, 'Herbario de Don Hernando', 'experienciaImagen() devuelve solo la ruta: defecto 1');

  const deGaleria = experienciaParaPlantilla({ slug: 's', titulo: 'T', galeria: [{ url: '/uploads/g/1.webp', alternativeText: 'Sendero' }] });
  assert.equal(experienciaImagen(deGaleria).url, '/uploads/g/1.webp');
  assert.equal(experienciaImagen(deGaleria).alt, 'Sendero');
  assert.deepEqual(experienciaGaleria(deGaleria).map((m) => m.url), ['/uploads/g/1.webp']);

  assert.equal('imagen_hero_url' in exp, false, 'la ficha entrega el twin imagen_hero_url por separado: el borde lo borra');
  assert.equal(experienciaImagen(experienciaParaPlantilla({ slug: 's', titulo: 'T' })), null, 'sin foto propia: mosaico Icon, no stock');
  assert.equal(experienciaGaleria(experienciaParaPlantilla({})).length, 0);
});

test('naturaleza: la galería es solo la relación media; galeria_urls (json del Grupo C) ya no fusiona', () => {
  // G5 sacó `galeria_urls` del esquema y G4 dejó las 2 filas en `'[]'`. La fusión con la
  // columna json se retiró del borde; el guard impide que alguien la re-cablee: si vuelve,
  // esta fila pintaría un ítem que Strapi ya no sirve.
  const exp = experienciaParaPlantilla({
    slug: 'amanecer', titulo: 'Amanecer',
    galeria: [{ url: '/uploads/e/niebla.webp', alternativeText: 'Niebla en el bosque' }],
    galeria_urls: [
      { url: '/uploads/e/niebla.webp', titulo: 'Niebla (pie viejo)' },
      { url: '/uploads/e/guaduales.webp', tipo: 'image', titulo: 'Guaduales' },
    ],
  });
  const galeria = experienciaGaleria(exp);
  assert.deepEqual(galeria.map((m) => m.url), ['/uploads/e/niebla.webp'], 'galeria_urls resucitó: la columna json volvió a la galería');
  assert.equal(galeria[0].alt, 'Niebla en el bosque');
  assert.deepEqual(exp.galeria.map((m) => m.url), ['/uploads/e/niebla.webp']);
  assert.equal('galeria_urls' in exp, false, 'naturaleza.ts entrega la columna json por separado');
});

test('naturaleza: el anfitrión pinta su foto con el alt del admin, y la galería es MediaItem', () => {
  const host = anfitrionParaPlantilla({
    slug: 'don-hernando', nombre: 'Don Hernando',
    foto_perfil: { id: 41, url: 'http://iwage_strapi:1337/uploads/a/hernando.webp', alternativeText: 'Don Hernando con su cepo' },
    galeria: [{ url: '/uploads/a/cafetal.webp', alternativeText: 'Cafetal', caption: 'Vereda Santagueda' }],
    // La columna legacy, tal como está en las 2 filas huérfanas de `anfitriones`: si algún
    // caller la trae (sync directo a la BD, fixture), no puede ni declararse ni pintar. La
    // URL es `/uploads/...` a propósito: con un hotlink de Unsplash lo filtraba `esPintable()`
    // más abajo y el candado pasaba vacío (comprobado con mutant el 2026-09-25).
    galeria_fotos: [{ url: '/uploads/a/cepo-viejo.webp', titulo: 'Valor huérfano de la BD' }],
  });
  assert.equal(anfitrionFoto(host).url, '/uploads/a/hernando.webp');
  assert.equal(anfitrionFoto(host).alt, 'Don Hernando con su cepo', 'anfitrionFoto() devolvía un string: el alt no existía');
  assert.equal(host.galeria[0].caption, 'Vereda Santagueda');
  assert.deepEqual(host.galeria.map((m) => m.url), ['/uploads/a/cafetal.webp'],
    'galeria_fotos mete el valor huérfano de la BD en la galería: la columna ya no es fuente');
  assert.equal('galeria_fotos' in host, false, 'anfitrionParaPlantilla sigue declarando galeria_fotos, un campo que ya no está en el schema');


  // Twin `foto_perfil_url`: G5 lo sacó del esquema y G4 de la BD. Ya no es fuente; el guard
  // queda para que nadie lo re-cablee al normalizador.
  const delTwin = anfitrionParaPlantilla({ nombre: 'Luz', foto_perfil_url: '/uploads/a/luz.jpg' });
  assert.equal(anfitrionFoto(delTwin), null, 'el twin foto_perfil_url volvió a pintar en la ficha');
  assert.equal('foto_perfil_url' in delTwin, false, 'el twin llegó a la plantilla: dos fuentes de verdad en el HTML');
  assert.equal(anfitrionFoto(anfitrionParaPlantilla({ nombre: 'Nada' })), null);
});

test('naturaleza: paquete — portada y galería MediaItem (hoy se perdía el alt en las tres páginas)', () => {
  const pkg = paqueteParaPlantilla({
    slug: 'retiro', titulo: 'Retiro de silencio',
    imagen_hero: { url: ADENTRO, alternativeText: 'Cabaña entre niebla' },
    imagenes: [{ url: '/uploads/p/interno.webp', alternativeText: 'Interior' }, { url: '/uploads/p/interno.webp' }],
  });
  assert.equal(pkg.imagen_hero.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(pkg.imagen_hero.alt, 'Cabaña entre niebla');
  assert.deepEqual(pkg.imagenes.map((m) => m.url), ['/uploads/p/interno.webp']);
  assert.equal(pkg.imagenes[0].alt, 'Interior');
  assert.equal(paqueteParaPlantilla({}).imagen_hero, null);
  assert.deepEqual(paqueteParaPlantilla({}).imagenes, []);
});

test('naturaleza: relaciones cross-brand (proveedor, propiedad, propiedad-gestion) salen MediaItem', () => {
  const exp = experienciaParaPlantilla({
    slug: 'r', titulo: 'R',
    proveedores: [{ id: 51, slug: 'p', nombre: 'Proveedor', foto: { url: ADENTRO, alternativeText: 'Local del proveedor' } }],
    propiedades: [{ id: 52, slug: 'pp', titulo: 'Propiedad', imagen_principal: { url: '/uploads/prop/1.webp', alternativeText: 'Fachada' } }],
    propiedades_gestion: [{ id: 53, slug: 'ppg', titulo: 'Gestionada', imagen_principal: { url: 'http://strapi_backend:1337/uploads/pg/1.webp' } }],
  });
  assert.equal(exp.proveedores[0].foto.alt, 'Local del proveedor');
  assert.equal(exp.proveedores[0].foto.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(exp.propiedades[0].imagen_principal.alt, 'Fachada');
  assert.equal(exp.propiedades_gestion[0].imagen_principal.url, '/uploads/pg/1.webp');
});

test('naturaleza: `anfitriones` y `complementos` poblabados también se mapean (el typo que tumbó la sección)', () => {
  // Medido el 2026-09-28 en el preflight de D10: `/naturaleza/experiencias` no pintaba ninguna
  // tarjeta y las dos fichas daban 302, porque `experienciaCruda` llamaba `anfitrionCrudo` (sin la
  // «a») y el `catch` de `getExperiencias`/`getExperienciaBySlug` se comía el ReferenceError
  // devolviendo `[]`/`null`. Ningún teste cubría estos DOS mapas: los otros tres enlaces del mismo
  // objeto sí estaban cubiertos arriba.
  const e = experienciaParaPlantilla({
    slug: 'r', titulo: 'R',
    anfitriones: [{ id: 60, slug: 'a', nombre: 'Anfitriona', foto_perfil: { url: ADENTRO, alternativeText: 'Retrato' } }],
    complementos: [{ id: 61, slug: 'c', nombre: 'Transporte', precio: '20000' }],
  });
  assert.equal(e.anfitriones.length, 1, 'el anfitrión poblado se perdió en el mapeo');
  assert.equal(e.anfitriones[0].nombre, 'Anfitriona');
  assert.equal(e.anfitriones[0].foto_perfil.alt, 'Retrato');
  assert.equal(e.anfitriones[0].foto_perfil.url, '/uploads/gestion/finca-paraiso.webp');
  assert.equal(e.complementos.length, 1, 'el complemento poblado se perdió en el mapeo');
  assert.equal(e.complementos[0].precio, 20000);

  // Y el borde inverso, que es la misma recursión cruzada: anfitrión → experiencias.
  const a = anfitrionParaPlantilla({
    slug: 'a', nombre: 'A',
    experiencias: [{ slug: 'r', titulo: 'R', anfitriones: [{ slug: 'a', nombre: 'A' }] }],
  });
  assert.equal(a.experiencias.length, 1);
  assert.equal(a.experiencias[0].titulo, 'R');
});

test('naturaleza: fila basura → null / [] y ninguna excepción; la fila de Strapi no se muta', () => {
  for (const [motivo, fila] of [['nulo', null], ['cero', 0], ['string', 'x'], ['array', []], ['objeto sin nada', {}]]) {
    assert.doesNotThrow(() => experienciaParaPlantilla(fila), `${motivo}: experiencia lanzó`);
    assert.doesNotThrow(() => anfitrionParaPlantilla(fila), `${motivo}: anfitrion lanzó`);
    assert.doesNotThrow(() => paqueteParaPlantilla(fila), `${motivo}: paquete lanzó`);
    assert.equal(experienciaParaPlantilla(fila).imagen_hero, null, `${motivo}: imagen_hero no dio null`);
    assert.deepEqual(experienciaParaPlantilla(fila).galeria, [], `${motivo}: galeria no dio []`);
    assert.equal(anfitrionParaPlantilla(fila).foto_perfil, null, `${motivo}: foto_perfil no dio null`);
    assert.equal(paqueteParaPlantilla(fila).imagen_hero, null, `${motivo}: portada de paquete no dio null`);
  }

  // Idempotencia y pureza: `strapiFetch` reparte el MISMO objeto desde Redis
  // (`inflightFetches`); escribir el MediaItem sobre la fila cruda contaminaría la caché.
  const cruda = { slug: 's', titulo: 'T', imagen_hero: { url: '/uploads/e/x.webp', alternativeText: 'X' }, galeria: [] };
  const antes = structuredClone(cruda);
  const una = experienciaParaPlantilla(cruda);
  const dos = experienciaParaPlantilla(una); // segunda pasada por el borde
  assert.deepEqual(cruda, antes, 'la fila cruda salió mutada');
  assert.notEqual(una, cruda, 'devolvió el mismo objeto en vez de una copia');
  assert.equal(dos.imagen_hero.url, '/uploads/e/x.webp', 'un MediaItem que ya pasó por el borde no debería volver a leerse');
  assert.equal(dos.imagen_hero.alt, 'X');
});

// ── 3. Idempotencia de los helpers de `gestion.ts` ───────────────────────────

test('los normalizadores son idempotentes: volver a pasar la fila ya normalizada no la rompe', () => {
  const una = normalizePropiedadGestion({
    titulo: 'T', imagen_principal: { url: '/uploads/p/a.webp', alternativeText: 'A' },
    anfitriones: [{ nombre: 'H', foto_perfil: { url: '/uploads/h.jpg', alternativeText: 'H' } }],
    complementos: [{ nombre: 'C', imagen: { url: '/uploads/c.jpg', alternativeText: 'C' } }],
    productos: [{ nombre: 'P', imagen: { url: '/uploads/p.jpg', alternativeText: 'P' } }],
  });
  const dos = normalizePropiedadGestion(una);
  assert.equal(dos.imagen_principal.url, '/uploads/p/a.webp');
  assert.equal(dos.imagen_principal.alt, 'A');
  assert.equal(dos.anfitriones[0].foto_perfil.alt, 'H');
  assert.equal(dos.complementos[0].imagen.alt, 'C');
  assert.equal(dos.productos[0].imagen.alt, 'P');
  assert.equal(experienciaGestionParaPlantilla(experienciaGestionParaPlantilla({ imagen_hero: { url: '/uploads/e/x.webp', alternativeText: 'X' } })).imagen.alt, 'X');
});

// ── 4. El contrato de fuente: los tipos que mienten (defecto 3) ──────────────
// Sin compilador de TypeScript en el repo, `astro build` solo BORRA los tipos: un
// `imagen: string | null` sobre un campo `media` del schema no da ningún error y es la
// razón por la que el `[object Object]` pudo vivir tanto tiempo. Los candados de texto
// fuente son lo único que mantiene el censo ("2 familias") legible.

function fuente(...rutas) {
  return rutas.map((r) => readFileSync(join(RAIZ, r), 'utf8')).join('\n');
}

test('los dos módulos no declaran la forma armada a mano ni `any` sobre un media', () => {
  const mienten = [
    [/\bfoto_perfil\??\s*:\s*any\b/, 'foto_perfil?: any (el crudo de gestion.ts:291)'],
    [/\{\s*url:\s*string;\s*alternativeText\??\s*:\s*string\s*\}/, '{ url: string; alternativeText?: string } (forma armada a mano)'],
    [/\bfoto_perfil_url\??\s*:/, 'el twin foto_perfil_url declarado en la interfaz'],
    [/\bimagen_hero_url\??\s*:/, 'el twin imagen_hero_url declarado en la interfaz'],
    [/\bgaleria_urls\??\s*:/, 'la columna json galeria_urls declarada en la interfaz'],
    [/\bimagen_url\??\s*:/, 'el twin imagen_url declarado en la interfaz'],
    [/\bimagen\??\s*:\s*string\b/, 'imagen: string (| null) sobre un campo media: el tipo mentía y el build no lo ve'],
    [/\bgaleria_fotos\??\s*:/, 'galeria_fotos, que ya no existe en el schema de anfitrion'],
  ];
  for (const [re, motivo] of mienten) {
    for (const ruta of ['src/lib/gestion.ts', 'src/lib/naturaleza.ts']) {
      assert.doesNotMatch(fuente(ruta), re, `${ruta}: ${motivo}`);
    }
  }
});

test('los dos módulos entregan MediaItem donde hay un media', () => {
  const gestion = fuente('src/lib/gestion.ts');
  const naturaleza = fuente('src/lib/naturaleza.ts');
  for (const [fuente_, nombre] of [[gestion, 'gestion.ts'], [naturaleza, 'naturaleza.ts']]) {
    assert.match(fuente_, /\btoMediaItem\b/, `${nombre} no usa toMediaItem`);
    assert.match(fuente_, /from '\.\/media\.ts'/, `${nombre} importa el contrato sin extensión: node --test no lo resuelve`);
  }
  assert.match(gestion, /imagen_principal:\s*MediaItem\s*\|\s*null/, 'gestion.ts: PropiedadGestion.imagen_principal no es MediaItem | null');
  assert.match(gestion, /galeria:\s*MediaItem\s*\[\]/, 'gestion.ts: PropiedadGestion.galeria no es MediaItem[]');
  assert.match(gestion, /propiedadGestionImagen\([^)]*\)\s*:\s*MediaItem\s*\|\s*null/, 'gestion.ts: propiedadGestionImagen no devuelve MediaItem');
  assert.match(naturaleza, /experienciaImagen\([^)]*\)\s*:\s*MediaItem\s*\|\s*null/, 'naturaleza.ts: experienciaImagen no devuelve MediaItem');
  assert.match(naturaleza, /anfitrionFoto\([^)]*\)\s*:\s*MediaItem\s*\|\s*null/, 'naturaleza.ts: anfitrionFoto no devuelve MediaItem');
});

// ── 5. Barrido de plantillas: `astro build` no ve el `[object Object]` ────────
// Precedente: los 12 routes de bitácora en `tests/normalizar-medio.test.mjs`. Acá se
// barren MIS archivos: las 9 páginas de naturaleza, las de gestión y los 3 componentes.

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

function archivosDeLaRebanada() {
  const dirs = ['src/pages/naturaleza', 'src/pages/gestion', 'src/components/gestion'];
  // `ComplementosSection` vive en shared/ (lo comparten naturaleza y gestión) y las dos
  // páginas de la rebanada se lo pasan: es consumidor directo de `Complemento.imagen`.
  const sueltos = ['src/components/shared/ComplementosSection.astro', 'src/components/naturaleza/ExperienciasMap.astro'];
  const lista = [...dirs.flatMap((d) => caminar(join(RAIZ, d))), ...sueltos.map((f) => join(RAIZ, f))];
  assert.ok(lista.length >= 20, `barrido recortado (${lista.length} archivos): los directorios no existen en ${RAIZ}`);
  return [...new Set(lista)].sort();
}


/** Nombres que en una plantilla de esta rebanada SON un medio, no un string cualquiera. */
const ID_MEDIO = /\b(imagen|imagen_principal|imagen_hero|imagenes|image|foto|foto_perfil|foto_territorio|fotoHost|fotoPanel|portadaRel|heroImg|portada|galeria|galeriaImgs|heroUrl|poster)\b/;

/**
 * Helpers del módulo que DESPUÉS de 12c devuelven `MediaItem`: pintar su resultado tal
 * cual es el `[object Object]` de la rebanada. No cuentan como "resuelto".
 */
const DEVUELVE_MEDIAITEM = /\b(experienciaImagen|experienciaGaleria|anfitrionFoto|propiedadGestionImagen)\s*\(/;

/** Qué cuenta como "ya resuelto por el contrato": `.url` o una de sus funciones. */
const RESUELTO = /\b(mediaSrc|absUrl|toMediaItem|toMediaList|embedSrc)\s*\(|\.url\b/;

function lineaDe(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

/**
 * Reglas sobre el código sin comentarios:
 *  (a) todo `src={EXPR}`, `ogImage={EXPR}` o `poster={EXPR}` que mencione un medio, o que
 *      tome el valor de una variable asignada desde un medio o desde un helper que ahora
 *      devuelve `MediaItem`, tiene que resolverlo con `.url` o con una función del contrato;
 *  (b) lo mismo para `image:` del `articleMeta` (la puerta del JSON-LD);
 *  (c) rastreo de asignaciones locales en dos pasadas (no sea cosa que «arreglar» el bug
 *      sea `const u = exp.imagen`);
 *  (d) DEFECTO 1: si un `<img>` pinta `src={X.url}`, su `alt` tiene que mirar `X.alt` —
 *      el `alternativeText` del admin existe justamente para describir la foto.
 */
function violacionesDeMedios(archivo) {
  const ruta = relative(RAIZ, archivo).replace(/\\/g, '/');
  const fuente_ = sinComentarios(readFileSync(archivo, 'utf8'));
  const culpables = [];

  const asignaciones = [...fuente_.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)]
    .map(([, nombre, rhs]) => ({ nombre, rhs }));
  const resueltas = new Set();
  const sucias = new Set();
  for (const { nombre, rhs } of asignaciones) {
    if (RESUELTO.test(rhs) && !DEVUELVE_MEDIAITEM.test(rhs)) resueltas.add(nombre);
    else if (ID_MEDIO.test(rhs) || DEVUELVE_MEDIAITEM.test(rhs)) sucias.add(nombre);
  }
  for (let pasada = 0; pasada < 2; pasada += 1) {
    for (const { nombre, rhs } of asignaciones) {
      if (resueltas.has(nombre) || sucias.has(nombre)) continue;
      if ([...sucias].some((s) => new RegExp(`\\b${s}\\b`).test(rhs))) sucias.add(nombre);
    }
  }

  function sinResolver(expr) {
    if (!expr || RESUELTO.test(expr)) return false;
    const local = expr.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
    const mencionaMedio = ID_MEDIO.test(expr) || DEVUELVE_MEDIAITEM.test(expr);
    const vieneDeMedio = local ? sucias.has(local) : false;
    if (!mencionaMedio && !vieneDeMedio) return false;
    if (local && !vieneDeMedio && resueltas.has(local)) return false;
    return true;
  }

  const REGLAS = [
    { re: /\b(?:src|ogImage|poster)\s*=\s*\{\s*([^{}\n]*?)\s*\}/g, capt: 1, motivo: 'atributo de plantilla' },
    { re: /^\s*image:\s*([^{}\n]+?)\s*,?$/gm, capt: 1, motivo: 'image: del articleMeta (JSON-LD)' },
  ];
  for (const { re, capt, motivo } of REGLAS) {
    for (const m of fuente_.matchAll(re)) {
      if (!sinResolver(m[capt])) continue;
      culpables.push(
        `    ${ruta}:${lineaDe(fuente_, m.index)}: ${m[0].trim().slice(0, 140)}  ← ${motivo}: un medio sin pasar por .url ni por mediaSrc()/absUrl()`,
      );
    }
  }

  // (e) `absUrl()` y `mediaSrc()` son funciones de STRING: si les pasás el MediaItem
  //     entero, `new URL(objeto, base)` lo coerce a `[object Object]` y el JSON-LD sale
  //     con `https://iwage.co/[object%20Object]` — build verde, schema roto.
  for (const m of fuente_.matchAll(/\b(absUrl|mediaSrc)\s*\(\s*([^(){}\n]*?)\s*\)/g)) {
    const fn = m[1];
    const arg = m[2];
    if (!arg) continue;
    if (/\.url\b/.test(arg)) continue; // absUrl(heroImg.url): la forma correcta
    if (/foto_territorio\b/.test(arg)) continue; // columna string pura del schema: sí es para mediaSrc()
    const local = arg.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
    const menciona = ID_MEDIO.test(arg) || DEVUELVE_MEDIAITEM.test(arg);
    const vieneDeMedio = local ? sucias.has(local) : [...sucias].some((sv) => new RegExp(`\\b${sv}\\b`).test(arg));
    if (!menciona && !vieneDeMedio) continue;
    culpables.push(
      `    ${ruta}:${lineaDe(fuente_, m.index)}: ${m[0].trim().slice(0, 140)}  ← ${fn}() recibe un objeto: need .url`,
    );
  }

  // (f) `mediaSrc()` en el render solo se justifica con una columna que HOY es string
  //     puro (`foto_territorio`). Sobre un valor ya normalizado por el módulo es una
  //     segunda interpretación encima del contrato: el borde la dejó `MediaItem`.
  for (const m of fuente_.matchAll(/\bmediaSrc\s*\(\s*([^(){}\n]*?)\s*\)/g)) {
    const arg = m[1];
    if (/foto_territorio\b|\bfotoTerritorio\b/.test(arg)) continue; // la columna string legítima
    if (/\.url\b/.test(arg)) continue;
    if (!ID_MEDIO.test(arg) && !DEVUELVE_MEDIAITEM.test(arg)) continue;
    culpables.push(
      `    ${ruta}:${lineaDe(fuente_, m.index)}: ${m[0].trim().slice(0, 140)}  ← mediaSrc() reinterpreta un valor que el módulo ya entregó normalizado`,
    );
  }

  // (d) el alt del admin tiene que bajar al `<img>`.
  for (const m of fuente_.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const srcExpr = tag.match(/\bsrc=\{([^{}]*)\}/)?.[1] ?? '';
    if (!/\.url\b/.test(tag)) continue;
    if (!ID_MEDIO.test(srcExpr) && ![...sucias].some((sv) => new RegExp(`\\b${sv}\\b`).test(srcExpr))) continue;
    if (/alt=\{[^}]*\.alt/.test(tag)) continue;
    culpables.push(
      `    ${ruta}:${lineaDe(fuente_, m.index)}: ${tag.trim().slice(0, 140)}  ← pinta un MediaItem con .url pero su alt no mira .alt: el alternativeText del admin se pierde`,
    );
  }
  return culpables;
}

test('el barrido tiene a quién mirar: las páginas de naturaleza/gestión y sus componentes están en la lista', () => {
  const lista = archivosDeLaRebanada().map((f) => relative(RAIZ, f).replace(/\\/g, '/'));
  for (const ruta of [
    'src/pages/naturaleza/index.astro',
    'src/pages/naturaleza/anfitriones/[slug].astro',
    'src/pages/naturaleza/experiencias/[slug].astro',
    'src/pages/naturaleza/experiencias/index.astro',
    'src/pages/naturaleza/programas/[slug].astro',
    'src/pages/naturaleza/programas/index.astro',
    'src/pages/gestion/alojamientos/[slug].astro',
    'src/pages/gestion/experiencias.astro',
    'src/components/gestion/AlojamientoCard.astro',
    'src/components/gestion/PropiedadGestionCard.astro',
    'src/components/shared/ComplementosSection.astro',
  ]) {
    assert.ok(lista.includes(ruta), `falta ${ruta} del barrido`);
  }
});

test('ningún <img> de naturaleza/gestión pinta un MediaItem sin resolverlo, y el alt del admin baja', () => {
  const culpables = archivosDeLaRebanada().flatMap(violacionesDeMedios).join('\n');
  assert.equal(
    culpables,
    '',
    `una plantilla de la rebanada interpola un medio sin resolverlo (build verde, HTML roto):\n${culpables}`,
  );
});

test('las páginas de la rebanada no re-interpretan la forma de Strapi: piden el valor al módulo', () => {
  // `alternativeText` leído en una plantilla es el síntoma de que el módulo no entregó el
  // `MediaItem`: el único lugar que abre la forma de Strapi es el normalizador.
  const culpables = archivosDeLaRebanada()
    .map((f) => [relative(RAIZ, f).replace(/\\/g, '/'), sinComentarios(readFileSync(f, 'utf8'))])
    .filter(([, txt]) => /alternativeText/.test(txt))
    .map(([r]) => r);
  assert.deepEqual(culpables, [], 'una plantilla lee alternativeText: la normalización tiene que estar en src/lib');
});
