import test from 'node:test';
import assert from 'node:assert/strict';

import { PREGUNTAS, MOTORES, mencionar, configDesdeAmbiente, cuerpoDe, mensajesTrasHerramienta, fuentesDelMensaje, dominiosCitados } from '../tools/geo-probe.mjs';

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

test('configDesdeAmbiente: sin GEO_MODELS la serie sigue siendo la de OpenRouter con busqueda', () => {
  const c = configDesdeAmbiente({ OPENROUTER_API_KEY: 'k' });
  assert.equal(c.endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(c.key, 'k');
  assert.deepEqual(c.motores.map((m) => m.slug), MOTORES.map((m) => m.slug));
  assert.deepEqual(c.motores.map((m) => m.busqueda), [true, true]);
});

test('configDesdeAmbiente: GEO_MODELS fija endpoint y lista, y la busqueda se declara modelo por modelo', () => {
  const c = configDesdeAmbiente({
    GEO_ENDPOINT: 'https://relay.example/v1/chat/completions',
    GEO_KEY: 'kk',
    GEO_MODELS: 'gpt-6-luna, kimi-k3',
    GEO_BUSQUEDA: 'gpt-6-luna',
  });
  assert.equal(c.endpoint, 'https://relay.example/v1/chat/completions');
  assert.equal(c.key, 'kk');
  assert.deepEqual(c.motores.map((m) => m.slug), ['gpt-6-luna', 'kimi-k3']);
  assert.deepEqual(c.motores.map((m) => m.busqueda), [true, false]);
});

test('configDesdeAmbiente: GEO_MODELS sin GEO_KEY falla antes de gastar una sola llamada', () => {
  assert.throws(() => configDesdeAmbiente({ GEO_MODELS: 'gpt-6-luna' }), /GEO_KEY/);
});

test('cuerpoDe: web_search_options solo se manda a los motores con busqueda', () => {
  assert.deepEqual(cuerpoDe({ slug: 'gpt-6-luna', busqueda: false }, 'p'), {
    model: 'gpt-6-luna',
    messages: [{ role: 'user', content: 'p' }],
  });
  assert.equal(cuerpoDe({ slug: 'perplexity/sonar-pro', busqueda: true }, 'p').web_search_options.search_context_size, 'medium');
});

test('cuerpoDe: en moonshot la busqueda se pide como builtin_function, no con web_search_options', () => {
  const c = cuerpoDe({ slug: 'kimi-k2.6', busqueda: true, busquedaFormato: 'moonshot' }, 'pregunta');
  assert.deepEqual(c.tools, [{ type: 'builtin_function', function: { name: '$web_search' } }]);
  assert.equal('web_search_options' in c, false);
});

test('configDesdeAmbiente: el formato de busqueda se deduce del endpoint', () => {
  const moonshot = configDesdeAmbiente({ GEO_ENDPOINT: 'https://api.moonshot.ai/v1/chat/completions', GEO_KEY: 'k', GEO_MODELS: 'kimi-k2.6', GEO_BUSQUEDA: 'kimi-k2.6' });
  assert.equal(moonshot.motores[0].busquedaFormato, 'moonshot');
  const otro = configDesdeAmbiente({ GEO_ENDPOINT: 'https://relay.example/v1/chat/completions', GEO_KEY: 'k', GEO_MODELS: 'gpt-x', GEO_BUSQUEDA: 'gpt-x' });
  assert.equal(otro.motores[0].busquedaFormato, 'openrouter');
});

test('mensajesTrasHerramienta: devuelve el assistant y el eco del arguments, que es como moonshot entrega la busqueda ya ejecutada', () => {
  // `arguments` lleva el `search_id` de la busqueda ya ejecutada por el servidor: si no se
  // devuelve, el segundo completion responde de memoria y la medicion sale falsa (medido
  // 2026-09-24: con content:'[]' dio 0 citas y respuesta sin fuentes; con el eco, cito ASOAPITOL).
  const args = '{"search_result":{"search_id":"99ea"}}';
  const mensaje = { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', function: { name: '$web_search', arguments: args } }] };
  const ms = mensajesTrasHerramienta(mensaje);
  assert.equal(ms.length, 2);
  assert.deepEqual(ms[0], mensaje);
  assert.deepEqual(ms[1], { role: 'tool', tool_call_id: 'call_1', name: '$web_search', content: args });
});

test('mensajesTrasHerramienta: sin tool_calls no hay nada que devolver', () => {
  assert.deepEqual(mensajesTrasHerramienta({ role: 'assistant', content: 'respuesta' }), []);
});

test('fuentesDelMensaje: las citas de busqueda de moonshot cuentan como fuentes', () => {
  const urls = fuentesDelMensaje({ content: 'x', search_citations: [{ title: 'a', url: 'https://iwage.co/granja' }, { title: 'b' }] });
  assert.deepEqual(urls, ['https://iwage.co/granja']);
});

test('dominiosCitados: quien ocupa el lugar se anota con los hosts que el motor cita en la respuesta', () => {
  const texto = 'Opciones: https://iwage.co/meliponas/ y [ASOAPITOL](https://asoapitol.org/meliponas) o www.apicola.example.co.uk/faq';
  assert.deepEqual(dominiosCitados(texto), ['asoapitol.org', 'apicola.example.co.uk']);
});

test('dominiosCitados: sin URLs en la prosa no hay nada que anotar', () => {
  assert.deepEqual(dominiosCitados('no hay enlaces aca'), []);
});
