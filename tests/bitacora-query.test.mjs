/**
 * La forma del query que se le manda a Strapi por la bitácora, medida y no supuesta.
 *
 * `strapiFetch` arma la URL adentro y ningún teste la veía: `tests/bitacora-resumen.test.mjs`
 * ejercita `filasAResumen` con filas ya armadas, y los testes de contrato miran el código
 * fuente. Nadie miraba la queryString saliente, y ahí vive un bug que ni el build ni esos
 * testes pueden ver.
 *
 * Lo que motivó este arquivo es medido contra el contenedor en vuelo (`localhost:1338`)
 * el 2026-09-25, con el crawl del censo:
 *
 *   `fields[]=imagen_hero` sobre `experiencias` (atributo que SÍ es media relation vivo)
 *     → 400 ValidationError «Invalid key imagen_hero», `details.param: "fields"`.
 *   `populate[]=imagen` sobre `bitacoras` (donde todavía es string)
 *     → 400 ValidationError «Invalid key imagen», `details.param: "populate"`.
 *
 * Es decir: un atributo `media` no puede ir en `fields[]`, y un atributo `string` no puede
 * ir en `populate[]`. Ningún query que mezcle las dos cosas es válido en los dos mundos, así
 * que pedir `imagen` en `fields` Y en `populate` devuelve 400 con el esquema de adentro del
 * contenedor Y con el del repo (`fa240b2`): la superficie se cae entero en los dos casos, y
 * el commentario que justificaba la mezcla estaba al revés de la medición.
 *
 * El stub de abajo no imita a Strapi por fantasía: replica las dos reglas de arriba, que
 * son las dos líneas medidas. Si alguien vuelve a meter `imagen` en la lista de escalares,
 * el stub responde 400 como respondió el contenedor y `getResumenBitacora` se degrada a
 * resumen vacío — que es exactamente el fallo que este arquivo existe para atrapar.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Atributos que en el esquema del repo son `type: 'media'` desde `fa240b2`: prohibidos en
// `fields[]`, y solo se obtienen con `populate[]`.
const ATRIBUTOS_MEDIA = new Set(['imagen', 'galeria', 'imagenes', 'foto_perfil', 'documentos']);

// El stub modela UN mundo: el esquema del repo. No intenta modelar el contenedor en vuelo,
// donde `imagen` sigue siendo string y por lo tanto `populate[]=imagen` también da 400. No
// hay query que sirva a los dos mundos —en el uno falla `fields[]`, en el otro `populate[]`—
// así que la pregunta no es «qué query funciona hoy», que es ninguna, sino «qué query va a
// funcionar cuando el esquema del repo esté desplegado», que es el gate del dueño y el único
// estado que este código puede decidir soportar.

const peticiones = [];

function invalida(key, param) {
  return {
    data: null,
    error: {
      status: 400,
      name: 'ValidationError',
      message: `Invalid key ${key}`,
      details: { key, path: key, source: 'query', param },
    },
  };
}

const servidor = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  peticiones.push(url.searchParams);
  const fields = url.searchParams.getAll('fields[]');

  let cuerpo;
  const enFields = fields.find((f) => ATRIBUTOS_MEDIA.has(f));
  if (enFields) cuerpo = invalida(enFields, 'fields');
  else {

    cuerpo = {
      data: [{
        id: 41, documentId: 'b41', titulo: 'La caja de Angelita', slug: 'la-caja',
        marca: 'granja', fecha: '2026-09-10', extracto: 'dos colmenas', categoria: null,
        tiempo_lectura: 4, contenido: 'no la pide, por eso `fields[]` existe',
        publicado: true, destacado: false,
        imagen: {
          id: 7, documentId: 'f7',
          url: 'http://localhost:1338/uploads/la_caja_9f2c.jpg',
          alt: 'La caja de Angelita', width: 1600, height: 900, mime: 'image/jpeg',
        },
      }],
      meta: { pagination: { total: 1, page: 1, pageSize: 100, pageCount: 1 } },
    };
  }
  res.writeHead(cuerpo.error ? 400 : 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
});

await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const { port } = servidor.address();

process.env.STRAPI_URL = `http://127.0.0.1:${port}`;
// Redis inalcanzable a propósito: la clave de cache es `strapi:bitacoras:<queryString>` sin
// puerto, y una entrada viva de otra corrida vaciaría el teste sin tocar el stub. El circuit
// breaker de `redis.ts` degrada a null y la petición sale de verdad.
process.env.REDIS_URL = 'redis://127.0.0.1:1';

const { getResumenBitacora } = await import('../src/lib/bitacora.ts');

after(() => servidor.close());

test('la queryString de la bitácora pide `imagen` por populate, no por fields', async () => {
  const degradados = [];
  const consola = console.error;
  // Solo los avisos de degradación: `redis.ts` e ioredis imprimen por su cuenta el intento
  // fallido contra el Redis a propósito inalcanzable, y eso no es un 400 de Strapi.
  console.error = (...a) => {
    const m = a.join(' ');
    if (/degradado|Strapi error/.test(m)) degradados.push(m);
  };
  let r;
  try {
    r = await getResumenBitacora({ recientes: 5 });
  } finally {
    console.error = consola;
  }

  assert.equal(peticiones.length, 1, 'una sola pasada a Strapi por resumen');
  const q = peticiones[0];
  assert.ok(q.getAll('populate[]').includes('imagen'), 'la portada se pide poblando la relación');
  assert.ok(
    !q.getAll('fields[]').includes('imagen'),
    '`imagen` no puede estar en `fields[]`: Strapi lo rechaza con 400 (`param: fields`) y tumba las 7 superficies',
  );
  assert.deepEqual(degradados, [], 'el resumen no se degradó');
  assert.equal(r.total, 1, 'la fila llegó: si el query fue inválido, esto es 0 con build verde');
  assert.equal(r.recientes[0].slug, 'la-caja');
});

test('la ficha de una bitácora no manda `fields[]` y la portada llega por populate', async () => {
  const { getBitacoraBySlug } = await import('../src/lib/bitacora.ts');
  const antes = peticiones.length;
  const ficha = await getBitacoraBySlug('la-caja');
  assert.ok(ficha, 'la ficha se construye con el populate limpio');

  const q = peticiones[antes];
  assert.deepEqual(q.getAll('fields[]'), [], 'esta lectura no usa selección de campos: no hay forma de meter un media');
  assert.ok(q.getAll('populate[]').includes('imagen'));

  assert.equal(ficha.imagen.alt, 'La caja de Angelita', 'el alt viaja con el contrato');
  assert.equal(
    ficha.imagen.url,
    '/uploads/la_caja_9f2c.jpg',
    'el host interno de Docker sale del HTML (`mediaSrc`)',
  );
});
