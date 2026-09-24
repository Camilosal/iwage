/**
 * Task 5 (F0) — Que la caída de Strapi no sea un 500 en las ~40 páginas con hero.
 *
 * Contrato que corta este teste: las tres funciones públicas de `src/lib/heroes.ts`
 * NUNCA rechazan. Strapi es el dueño único de los medios y no hay fallback de imagen
 * (decisión de la spec), pero "sin fallback" no es "sin tolerancia": en fallo el hero
 * degrada a `[]` / `null` —una landing sin foto— y la página responde 200.
 *
 * Se prueban los cinco sabores del fallo, porque en la caída real pasan indistintamente
 * y los cinco llegaban crudos al SSR:
 *   1. red rota              → `fetch` rechaza (ECONNREFUSED)
 *   2. Strapi vivo y malo    → respuesta non-ok (503 / 500 / 404)
 *   3. 200 con cuerpo basura → `res.json()` rechaza (nginx devolviendo HTML)
 *   4. 200 con forma sorpresa → `null`, `"hola"`, `[1,2,3]`, `{}`, `{data:null}`, `{data:[null]}`
 *   5. timeout              → el `AbortSignal.timeout(8000)` de `strapiFetch` expira y
 *                             `fetch` rechaza con el `DOMException: TimeoutError` genuino
 *
 * Dos aislamientos van ANTES del `import()` dinámico:
 *   - Redis: `src/lib/redis.ts` congela `REDIS_URL` al cargarse. Se apunta a un puerto
 *     enano (6399): el breaker abre, `cacheGet()` devuelve `null`, y la caché real del
 *     sitio ni se lee ni se escribe. El teste 0 comprueba que el aviso `[redis]` salió
 *     de verdad — si Redis hubiera respondido, los `[]` de abajo podían venir de la caché.
 *   - `fetch`: se sustituye por un stub por caso. Nunca se toca la red.
 *
 * La mitad visible del contrato también se prueba: `console.warn` se captura, no solo
 * se mira. Tiene que salir UNA línea concisa por request intentado, al stderr, con el
 * endpoint y el motivo; nunca los datos del registro ni el cuerpo de la respuesta.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

// ── Entorno del teste, fijado antes de importar el módulo bajo prova ──
const AMBIENTE = {
  REDIS_URL: process.env.REDIS_URL,
  APP_URL: process.env.APP_URL,
  STRAPI_URL: process.env.STRAPI_URL,
};
process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // puerto enano: el breaker abre y cacheGet devuelve null
process.env.APP_URL = 'https://iwage.co';
process.env.STRAPI_URL = 'http://iwage_strapi:1337';

function restaurar() {
  for (const [clave, valor] of Object.entries(AMBIENTE)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
}

let heroes;
try {
  heroes = await import('../src/lib/heroes.ts');
} catch (err) {
  // Si el módulo no carga, no dejamos el entorno del teste puesto para nadie más.
  restaurar();
  throw err;
}
const { getHeroes, getHeroBySlug, getHeroesByPrefix } = heroes;

// Los testes de este arquivo corren dentro del processo; el entorno se devuelve al cerrar.
after(restaurar);

// ── Registro tal como lo devuelve Strapi v5 (imagen con el host interno de Docker) ──
const REGISTRO = {
  data: [
    {
      id: 1,
      documentId: 'd1',
      pagina: 'Café',
      slug_ruta: '/cafe',
      titulo: 'Café de origen',
      subtitulo: null,
      imagen: 'http://iwage_strapi:1337/uploads/hero-cafe.webp',
      label: null,
      cta_primario_texto: null,
      cta_primario_url: null,
      cta_secundario_texto: null,
      cta_secundario_url: null,
      color_overlay: null,
      orden: 1,
    },
  ],
  meta: {},
};

const SANO = () =>
  new Response(JSON.stringify(REGISTRO), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Los tres puntos de entrada públicos, con el valor vacío que cada uno debe devolver. */
const LOS_TRES = [
  { nombre: 'getHeroes', llamar: () => getHeroes(), vacio: [] },
  { nombre: 'getHeroBySlug', llamar: () => getHeroBySlug('/cafe'), vacio: null },
  { nombre: 'getHeroesByPrefix', llamar: () => getHeroesByPrefix('/cafe'), vacio: [] },
];

/** Instala el stub de Strapi, captura los avisos y devuelve el parte de lo que pasó. */
async function conStrapi(stub, cuerpo) {
  const fetchReal = globalThis.fetch;
  const consolaReal = { warn: console.warn, error: console.error, log: console.log };
  const parte = { pedidos: 0, urls: [], señales: [], avisos: [] };

  globalThis.fetch = (url, opciones) => {
    parte.pedidos += 1;
    parte.urls.push(String(url));
    parte.señales.push(opciones?.signal);
    return stub(url, opciones, parte);
  };
  for (const sink of ['warn', 'error', 'log']) {
    console[sink] = (...args) => {
      parte.avisos.push({
        sink,
        texto: args
          .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' '),
      });
    };
  }

  try {
    await cuerpo(parte);
  } finally {
    globalThis.fetch = fetchReal;
    Object.assign(console, consolaReal);
  }
  return parte;
}

/** Los avisos que este módulo emite sobre los heroes, con el sink que los recibió. */
const avisosHeros = (parte) => parte.avisos.filter((a) => a.texto.includes('[heroes]')).map((a) => a.texto);

/** Un aviso por request intentado, al stderr, de una línea, con endpoint y motivo. */
function exigeAvisoVisible(parte) {
  assert.equal(avisosHeros(parte).length, parte.pedidos, 'un aviso por request intentado, ni más ni menos');
  for (const aviso of avisosHeros(parte)) {
    assert.match(aviso, /hero-configuracions/, `el aviso debe decir qué endpoint falló: ${aviso}`);
    assert.ok(aviso.length < 400, `aviso de una línea y acotado (${aviso.length}): ${aviso}`);
    // El aviso diagnostica, no vuelca: ni la imagen del hero ni el cuerpo de la respuesta.
    assert.ok(!aviso.includes('hero-cafe'), `el aviso no puede contener datos del registro: ${aviso}`);
  }
  // Es SSR server-side: el diagnóstico se va al stderr, nunca al stdout del render.
  for (const { sink, texto } of parte.avisos) {
    if (texto.includes('[heroes]')) assert.equal(sink, 'warn', `el aviso de heroes sale por ${sink}, no por stderr: ${texto}`);
  }
}

/** Los tres puntos de entrada degradan al valor vacío, sin rechazar. */
async function losTresDegradan(parte) {
  for (const punto of LOS_TRES) {
    assert.deepEqual(await punto.llamar(), punto.vacio, `${punto.nombre} debe degradar a ${JSON.stringify(punto.vacio)}`);
  }
}

// ── 0. El Redis del teste está muerto de verdad: la caché no enmascara nada ──
test('0. sin caché disponible: el teste habla con Strapi, no con Redis', async () => {
  const parte = await conStrapi(SANO, async () => {
    const todos = await getHeroes();
    assert.equal(todos.length, 1, 'sin Redis la respuesta tiene que salir de fetch');
  });
  assert.ok(parte.pedidos >= 1, 'si no hubo request a Strapi, alguien sirvió datos de una caché');
  assert.match(
    parte.avisos.map((a) => a.texto).join('\n'),
    /\[redis\]/,
    'falta el aviso de Redis caído: este arquivo no estaría probando la tolerancia a Strapi',
  );
});

// ── 1. Red rota ──
test('1. Strapi caído (red): los tres devuelven [] / null y no rechazan', async () => {
  const parte = await conStrapi(
    async () => { throw new Error('ECONNREFUSED 127.0.0.1:1337'); },
    losTresDegradan,
  );
  exigeAvisoVisible(parte);
  assert.match(avisosHeros(parte)[0], /ECONNREFUSED/, 'el aviso tiene que decir por qué falló');
});

// ── 2. Strapi responde, pero mal ──
for (const status of [503, 500, 404]) {
  test(`2. Strapi con ${status}: ninguno de los tres propaga el error`, async () => {
    const parte = await conStrapi(
      async () => new Response('oops', { status, statusText: `HTTP ${status}` }),
      losTresDegradan,
    );
    exigeAvisoVisible(parte);
    assert.match(avisosHeros(parte)[0], new RegExp(String(status)), 'el aviso lleva el status');
  });
}

// ── 3. 200 con cuerpo que no es JSON ──
test('3. 200 con cuerpo basura (HTML de nginx): degrada igual y no vuelca el cuerpo', async () => {
  const cuerpoBasura = `<html><body>502 Bad Gateway</body>${'x'.repeat(4000)}</html>`;
  const parte = await conStrapi(
    async () => new Response(cuerpoBasura, { status: 200, headers: { 'content-type': 'text/html' } }),
    losTresDegradan,
  );
  exigeAvisoVisible(parte);
  for (const aviso of avisosHeros(parte)) {
    assert.ok(!aviso.includes('x'.repeat(50)), `el aviso no repite el cuerpo de la respuesta: ${aviso}`);
  }
});

// ── 4. 200 con JSON válido, forma sorpresa ──
// Cuatro formas distintas de "Strapi contestó y no es una lista de heroes". En ninguna
// puede quedar un 500: el acceso a `res.data` y el `map(normalize)` viven FUERA del try,
// así que el envoltorio tiene que entregar siempre la forma `{ data: T[] }`.
for (const [etiqueta, texto] of [
  ['null', 'null'],
  ['un string', '"hola"'],
  ['un array de números', '[1,2,3]'],
  ['un objeto sin data', '{}'],
  ['{ data: null }', '{"data":null,"meta":{}}'],
  ['{ data: "no-array" }', '{"data":"no-array","meta":{}}'],
]) {
  test(`4. 200 con forma sorpresa (${etiqueta}): degrada y se avisa`, async () => {
    const parte = await conStrapi(
      async () => new Response(texto, { status: 200, headers: { 'content-type': 'application/json' } }),
      losTresDegradan,
    );
    exigeAvisoVisible(parte);
  });
}

test('4b. 200 con registros rotos dentro del array: se descartan sin gritar una caída', async () => {
  for (const texto of ['{"data":[null],"meta":{}}', '{"data":[],"meta":{}}', '{"data":[{}],"meta":{}}']) {
    const parte = await conStrapi(
      async () => new Response(texto, { status: 200, headers: { 'content-type': 'application/json' } }),
      losTresDegradan,
    );
    // Un array sin heroes útiles es un estado normal (una página sin hero configurado):
    // no es una caída de Strapi y no puede llenar stderr de avisos falsos.
    assert.deepEqual(avisosHeros(parte), [], `falsa alarma de caída con ${texto}: ${avisosHeros(parte)[0]}`);
  }
});

// ── 5. El timeout de 8 s de strapiFetch ──
test('5. timeout del AbortSignal: se degrada, se nombra y la señal sigue llegando a fetch', async () => {
  const parte = await conStrapi(
    async () => {
      // Se reproduce el rechazo EXACTO de fetch cuando su señal expira: el `reason`
      // genuino de un AbortSignal.timeout, no un Error inventado con nombre parecido.
      const señal = AbortSignal.timeout(25);
      const razon = await new Promise((resolver) => {
        // El timer interno de AbortSignal.timeout no mantiene vivo el event loop.
        const vivo = setTimeout(() => {}, 5000);
        const listo = () => { clearTimeout(vivo); resolver(señal.reason); };
        if (señal.aborted) listo();
        else señal.addEventListener('abort', listo, { once: true });
      });
      throw razon;
    },
    losTresDegradan,
  );
  exigeAvisoVisible(parte);
  assert.match(avisosHeros(parte)[0], /TimeoutError/, 'el aviso del timeout tiene que nombrarlo');
  // El techo de 8 s no se pierde con el envoltorio: la señal sigue yendo a fetch.
  assert.ok(parte.pedidos > 0);
  for (const señal of parte.señales) {
    assert.ok(señal instanceof AbortSignal, 'strapiFetch debe seguir pasando signal a fetch');
  }
});

// ── 6. Los valores vacíos no comparten estado ──
test('6. el [] del fallo es un array nuevo: dos llamadas no comparten el mismo objeto', async () => {
  await conStrapi(
    async () => { throw new Error('ECONNREFUSED'); },
    async () => {
      const primera = await getHeroes();
      const segunda = await getHeroes();
      assert.notEqual(primera, segunda, 'devolver siempre el mismo array vacío permite corromperlo desde una página');
      assert.deepEqual(primera, []);
      assert.deepEqual(segunda, []);
    },
  );
});

// ── 7. Strapi sano: la tolerancia no se traga los datos buenos ──
test('7. Strapi sano: normaliza, la imagen queda relativa de sitio y no se avisa nada', async () => {
  const parte = await conStrapi(SANO, async () => {
    const todos = await getHeroes();
    assert.equal(todos.length, 1);
    assert.equal(todos[0].imagen, '/uploads/hero-cafe.webp', 'el host interno de Docker no sale al HTML');
    assert.equal(todos[0].titulo, 'Café de origen');
    assert.equal(todos[0].slug_ruta, '/cafe');
    assert.equal(todos[0].orden, 1);

    const porSlug = await getHeroBySlug('/cafe');
    assert.equal(porSlug.imagen, '/uploads/hero-cafe.webp');
    assert.equal(porSlug.documentId, 'd1');

    assert.equal((await getHeroesByPrefix('/cafe')).length, 1, 'el prefijo sigue filtrando');
    assert.deepEqual(await getHeroesByPrefix('/meliponas'), [], 'y sigue excluyendo lo que no es de su prefijo');
  });
  assert.deepEqual(avisosHeros(parte), [], 'un Strapi sano no puede generar avisos de caída');
});
