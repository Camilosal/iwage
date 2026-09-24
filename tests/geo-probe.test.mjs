import test from 'node:test';
import assert from 'node:assert/strict';

import { PREGUNTAS, MOTORES, mencionar } from '../tools/geo-probe.mjs';

// La serie del probe solo vale si las preguntas no se mueven: quien la re-ejecuta
// tiene que estar preguntando lo mismo que se preguntó el 2026-09-24.
test('PREGUNTAS: las 10 fijas de la serie, con su marca dueña', () => {
  assert.equal(PREGUNTAS.length, 10);
  assert.deepEqual(
    PREGUNTAS.map((p) => p.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(
    PREGUNTAS[0].pregunta,
    'qué es la meliponicultura cómo empezar Colombia abejas sin aguijón',
  );
  assert.equal(PREGUNTAS[0].marca, 'meliponas');
  assert.equal(
    PREGUNTAS[9].pregunta,
    'energía solar para finca autosuficiente dimensionamiento paneles Colombia',
  );
  assert.equal(
    new Set(PREGUNTAS.map((p) => p.pregunta)).size,
    10,
    'dos preguntas idénticas romperían la lectura por marca',
  );
});

// Un slug inventado no es un motor: la lista tiene que traer la evidencia de dónde se verificó.
test('MOTORES: slugs reales del catálogo, con la fuente de la verificación', () => {
  assert.ok(MOTORES.length >= 2, 'hace falta más de un motor para poder hablar de share of voice');
  for (const m of MOTORES) {
    assert.match(m.slug, /^[a-z0-9-]+\/[a-z0-9.:-]+$/);
    assert.equal(typeof m.engine, 'string');
    assert.match(m.verificado, /2026-\d\d-\d\d/, 'sin fecha de verificación el slug puede haber desaparecido');
  }
  assert.ok(
    MOTORES.some((m) => m.slug.startsWith('perplexity/')),
    'Perplexity tiene que estar: es uno de los tres motores que pide el objetivo',
  );
});

// El error que ya se cometió midiendo esto: `iwage` aparece dentro de un slug ajeno
// (`…/meliponario-iwage-subsistema-vivo`) y contar eso por substring infla la visibilidad.
test('mencionar: no confunde iwage.co con la subcadena dentro de otro dominio', () => {
  const deOtro = mencionar(
    'Guía en https://camilosaldarriaga.com/es/bitacora/meliponario-iwage-subsistema-vivo (dominio personal)',
  );
  assert.equal(deOtro.esMencion, false);
  assert.equal(deOtro.url, null);

  const granja = mencionar('Ver https://iwage.co/granja/bitacora/agroecosistema-productivo para más');
  assert.equal(granja.esMencion, true);
  assert.equal(granja.url, 'https://iwage.co/granja/bitacora/agroecosistema-productivo');
});

// `iwage.co` como prefijo de otro host tampoco es nuestra URL.
test('mencionar: exige que iwage.co sea el dominio, no un pedazo de uno mayor', () => {
  assert.equal(mencionar(' espejo en https://iwage.co.mirror.example/x').esMencion, false);
  assert.equal(mencionar('citó iwage.co como fuente').esMencion, true);
  // `recetas.iwage.co` es nuestro (deuda del ítem 4), así que cuenta y se anota cual es.
  const recetas = mencionar('https://recetas.iwage.co/moka');
  assert.equal(recetas.esMencion, true);
  assert.equal(recetas.host, 'recetas.iwage.co');
});

// Una cita puede venir sin esquema en la lista de fuentes del motor.
test('mencionar: reconoce la URL sin esquema y le pone el canónico', () => {
  const r = mencionar('iwage.co/meliponas/bitacora/pureza-en-la-miel-de-angelita-lo-que-no-es-adulteracion');
  assert.equal(r.esMencion, true);
  assert.equal(
    r.url,
    'https://iwage.co/meliponas/bitacora/pureza-en-la-miel-de-angelita-lo-que-no-es-adulteracion',
  );
  assert.equal(r.host, 'iwage.co');
});
