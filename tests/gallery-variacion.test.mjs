/**
 * Task 12e · la galería y la variación de la ficha de tienda no pueden volver a divergir.
 *
 * Reviewer A#8, medido antes de tocar nada: `src/pages/meliponas/tienda/[slug].astro` cambiaba
 * el `src` del `<img data-gal-main-img>` al elegir una variación, pero el visor a pantalla
 * completa pinta `items[]` —parseado UNA vez del `<script type="application/json">` del
 * componente—, así que:
 *   · abrir «Pantalla completa» mostraba la foto del producto BASE, no la de la variación, y
 *   · `show(0)` reasignaba `img.src = item.url` y revertía hasta el recuadro del thumbnail.
 *
 * Ninguno de los dos hechos se ve en el fuente de un solo archivo: por eso este archivo EJECUTA
 * el `<script>` real del componente sobre el DOM mínimo de `helpers/dom-mini.mjs` en lugar de
 * buscar patrones de texto. El barrido de fuente sigue, pero como red de seguridad de la
 * frontera (quién escribe adentro de la galería), no como prueba del comportamiento.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarGaleria, guionDelComponente } from './helpers/dom-mini.mjs';

const RAIZ = process.env.IWAGE_SRC
  ? resolve(process.env.IWAGE_SRC)
  : fileURLToPath(new URL('..', import.meta.url));

const RUTA_GALERIA = 'src/components/shared/MediaGallery.astro';
const fuenteGaleria = readFileSync(join(RAIZ, RUTA_GALERIA), 'utf8');
const GUION = guionDelComponente(fuenteGaleria);

/** Lo que el servidor serializa en `<script data-gal-items>`: MediaItem + render + embed. */
const IMG = (url, extra = {}) => ({ url, kind: 'imagen', provider: 'strapi', render: 'img', embed: url, ...extra });
const VIDEO = (url) => ({ url, kind: 'video', provider: 'strapi', render: 'video', embed: url });

function montar(items, gid = 'gal-test') {
  const montaje = montarGaleria(gid, items);
  new Function('gid', 'document', GUION)(gid, montaje.doc);
  return montaje;
}

const clickEn = (doc, nodo, sel) => {
  const el = nodo.querySelector(sel);
  assert.ok(el, `no existe ${sel}: el montaje no parece el HTML de la galería`);
  el.dispatch('click');
};

test('la galería expone setMainImage y es el único camino para cambiar la pieza principal', () => {
  const { wrapper } = montar([IMG('/uploads/base.jpg'), IMG('/uploads/otro.jpg')]);
  const api = wrapper.__iwageGallery;
  assert.ok(api, 'MediaGallery no expone __iwageGallery: la ficha de variaciones vuelve a tocar el DOM por su cuenta');
  assert.equal(typeof api.setMainImage, 'function');
});

test('setMainImage deja thumbnail, tira y visor en la MISMA url: abrir el visor no revierte', () => {
  const items = [IMG('/uploads/base.jpg'), IMG('/uploads/segunda.jpg')];
  const { wrapper, lightbox, doc } = montar(items);

  assert.equal(wrapper.__iwageGallery.setMainImage('/uploads/variacion-b.jpg'), true);

  const thumb = wrapper.querySelector('[data-gal-main-img]');
  const miniaturaTira = lightbox.querySelectorAll('[data-gal-strip]')[0].querySelector('img');
  assert.equal(thumb.src, '/uploads/variacion-b.jpg', 'el recuadro no cambió');
  assert.equal(miniaturaTira.src, '/uploads/variacion-b.jpg', 'la tira del visor quedó con la foto vieja');

  // Este es el assert de A#8: abrir «Pantalla completa» ejecuta `show(0)`, que lee `items[0]`.
  clickEn(doc, wrapper, '[data-gal-open="0"]');
  const visor = lightbox.querySelector('[data-gal-img]');
  assert.equal(visor.src, '/uploads/variacion-b.jpg', 'el lightbox pintó la foto del producto base');
  assert.equal(lightbox.querySelector('[data-gal-counter]').textContent, '1 / 2', 'no se abrió el visor: el assert de arriba sería vacío');

  // Y navegar fuera y regresar no restaura la foto vieja (el otro camino del defecto).
  clickEn(doc, lightbox, '[data-gal-next]');
  assert.equal(lightbox.querySelector('[data-gal-img]').src, '/uploads/segunda.jpg');
  clickEn(doc, lightbox, '[data-gal-prev]');
  assert.equal(lightbox.querySelector('[data-gal-img]').src, '/uploads/variacion-b.jpg');
});

test('si la primera pieza es video, setMainImage dice que no y no pinta una foto encima', () => {
  const { wrapper, lightbox } = montar([VIDEO('/videos/recorrido.mp4'), IMG('/uploads/otro.jpg')]);
  assert.equal(wrapper.__iwageGallery.setMainImage('/uploads/variacion-b.jpg'), false);
  assert.equal(lightbox.querySelector('[data-gal-img-placeholder]')?.children.length, 0);
  assert.equal(wrapper.querySelector('[data-gal-main-img]'), null, 'el montaje emitió <img> principal sin ser imagen');
});

test('setMainImage no inventa nada con basura', () => {
  const { wrapper } = montar([IMG('/uploads/base.jpg')]);
  for (const basura of [null, undefined, '', '   ']) {
    assert.equal(wrapper.__iwageGallery.setMainImage(basura), false, `setMainImage(${JSON.stringify(basura)}) no devolvió false`);
  }
  assert.equal(wrapper.querySelector('[data-gal-main-img]').src, '/uploads/base.jpg', 'la basura pisó la foto');
});

// ── Frontera: quién escribe adentro de la galería ─────────────────────────────

function archivosEn(dir, filtro = /\.(astro|tsx?|jsx|ts)$/) {
  const out = [];
  for (const entrada of readdirSync(join(RAIZ, dir))) {
    const p = join(join(RAIZ, dir), entrada);
    if (statSync(p).isDirectory()) out.push(...archivosEn(join(dir, entrada), filtro));
    else if (filtro.test(entrada)) out.push(relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return out;
}

test('nadie fuera del componente escribe los hooks internos de la galería', () => {
  const culpables = [];
  for (const rel of archivosEn('src')) {
    if (rel === RUTA_GALERIA) continue;
    const fuente = readFileSync(join(RAIZ, rel), 'utf8');
    fuente.split('\n').forEach((linea, i) => {
      if (/data-gal-/.test(linea)) culpables.push(`    ${rel}:${i + 1}: ${linea.trim().slice(0, 120)}`);
    });
  }
  assert.equal(
    culpables.join('\n'),
    '',
    `una página volvió a manipular el interior de MediaGallery (thumbnail y visor divergen otra vez):\n${culpables.join('\n')}`,
  );
});

test('las dos fichas de tienda usan la API y ya no le tocan el src al thumbnail', () => {
  // `granja/tienda/[slug].astro` era COPIA exacta de `meliponas/tienda/[slug].astro` en este
  // bloque: el barrido de arriba lo encontró y por eso el guard recorre las dos, no una.
  const FICHAS = ['src/pages/meliponas/tienda/[slug].astro', 'src/pages/granja/tienda/[slug].astro'];
  for (const rel of FICHAS) {
    const fuente = readFileSync(join(RAIZ, rel), 'utf8');
    assert.match(fuente, /__iwageGallery/, `${rel} no le pide el cambio de foto a la galería`);
    assert.match(fuente, /setMainImage\(/, `${rel} no llama setMainImage()`);
    assert.doesNotMatch(fuente, /setAttribute\(\s*['"]src['"]/, `${rel} vuelve a escribir un src a mano`);
  }
});

test('el DOM mínimo sigue pareciéndose al fuente: los hooks que el montaje asume existen', () => {
  // `dom-mini` no parsea el template: supone los hooks. Si la galería los renombra, el montaje
  // quedaría probando un DOM que ya no existe y el teste sería una mentira verde.
  const HOOKS = [
    'data-gallery-wrapper', 'data-gal-lightbox', 'data-gal-items', 'data-gal-open',
    'data-gal-main-img', 'data-gal-stage', 'data-gal-img', 'data-gal-img-placeholder',
    'data-gal-counter', 'data-gal-title', 'data-gal-prev', 'data-gal-next', 'data-gal-strip', 'data-gal-close',
  ];
  const faltos = HOOKS.filter((h) => !fuenteGaleria.includes(h));
  assert.deepEqual(faltos, [], `MediaGallery ya no emite estos hooks y hay que actualizar el montaje: ${faltos.join(', ')}`);
});
