/**
 * El parseo de flags del importador, aparte del script (strapi/scripts/lib/
 * media-flags.mjs) justamente para poder testealo SIN servidor, sin red y sin
 * credenciales: es el único guard que impide que esta herramienta escriba en la
 * BD, y un guard que no se puede romper en un teste no es un guard.
 *
 * Varios testes corren el CLI como proceso hijo. Los dos primeros, con una
 * invocación que tiene que salir antes de mirar el entorno: nada de aquí toca un
 * host. El último (Fix round 2) sí ejercita la DECISIÓN DE ESCRITURA: levanta un
 * stub propio en `127.0.0.1` con puerto efímero, un inventario de juguete en un
 * `/tmp` desechable y credenciales falsas, y cuenta cada petición que recibe. Es
 * el teste que faltaba: medido en una copia mutada de `f32dd88`, `ESCRIBIR = true`,
 * `if (!ESCRIBIR)` → `if (false)` y `aplicar()` iterando `[...enlazar, ...revisar]`
 * dejaban los 20 testes verdes, porque las dos corridas de CLI existentes morían en
 * el guard del entorno sin llegar nunca a la decisión.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearFlags } from '../strapi/scripts/lib/media-flags.mjs';

const SCRIPT = fileURLToPath(new URL('../strapi/scripts/media-import.mjs', import.meta.url));

test('--apply a secas es el único modo que escribe', () => {
  assert.equal(parsearFlags(['--apply']).modo, 'aplicar');
});

test('sin flags y con --dry-run son el mismo camino: dry-run', () => {
  assert.equal(parsearFlags([]).modo, 'dry-run');
  assert.equal(parsearFlags(['--dry-run']).modo, 'dry-run');
});

test('--dry-run y --apply a la vez es un conflicto, no un empate a favor de la escritura', () => {
  for (const argv of [['--dry-run', '--apply'], ['--apply', '--dry-run']]) {
    assert.equal(parsearFlags(argv).modo, 'conflicto', argv.join(' '));
  }
});

test('un flag desconocido no se decide por defecto y se reporta pelado', () => {
  const o = parsearFlags(['--apply-x=secreta', '--alias', 'x']);
  assert.equal(o.modo, 'invalido');
  // `--alias` sin `=<ruta>` y `--alias` con el valor vacío son argumentos sueltos:
  // reconocerlos sin ruta habría dejado el alias declarado en el aire.
  assert.deepEqual(o.desconocidas, ['--apply-x=secreta', '--alias', 'x']);
  assert.deepEqual(parsearFlags(['--alias=']).modo, 'invalido');
});

test('--alias=<ruta> se recoge y no es un flag desconocido', () => {
  const o = parsearFlags(['--dry-run', '--alias=/tmp/alias-de-ejemplo.json']);
  assert.equal(o.modo, 'dry-run');
  assert.equal(o.alias, '/tmp/alias-de-ejemplo.json');
  assert.deepEqual(o.desconocidas, []);
  assert.equal(parsearFlags([]).alias, null);
});

// --- el guard, del lado del CLI: que la contradicción salga ANTES de todo -----

const SIN_ENV = { ...process.env, STRAPI_URL: '', STRAPI_TOKEN: '' };

test('el CLI aborta con --dry-run --apply antes de mirar el entorno', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dry-run', '--apply'], {
    encoding: 'utf8',
    env: SIN_ENV,
  });
  // Exit 2 (flag), no 1 (entorno): la contradicción se resuelve antes de leer
  // credenciales, así que tampoco puede acabar en una corrida a medias.
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--dry-run/);
  assert.match(r.stderr, /--apply/);
  // Y la salida no tiene valor de credencial alguno: el script no reimprime argumentos.
  assert.doesNotMatch(r.stderr, /secreta|Bearer/i);
});

test('el CLI con --apply y sin credenciales aborta en el guard del entorno', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--apply'], { encoding: 'utf8', env: SIN_ENV });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /STRAPI_URL y STRAPI_TOKEN/);
});

// --- y la obediencia del guard, del lado del proceso completo ------------------
//
// Parsear bien `--dry-run` no sirve de nada si el script después no lo obedece.
// Este teste corre `strapi/scripts/media-import.mjs` tal cual (copia byte-idéntica
// hecha a tiempo de teste, para que una mutación en el archivo real se vea acá)
// contra un servidor desechable en 127.0.0.1 con PUERTO EFÍMERO (`listen(0)`): el
// puerto se elige a runtime, así que no invade el de nadie. Cero contacto con la
// API real: el stub nunca ve un token auténtico — el valor de `STRAPI_TOKEN` es
// texto claramente falso y ni siquiera se imprime en las aserciones — y el único
// host alcanzado es el loopback.
//
// El árbol de trabajo va a `mkdtemp` con un inventario de cuatro archivos de
// juguete, porque el script resuelve `public/images/` desde su propia ubicación:
// así la corrida no depende del árbol real de producción ni de sus 86 archivos, y
// lo que se asienta acá son decisiones, no datos. Limpieza en `finally`: servidor
// cerrado (con las conexiones abiertas cortadas) y directorio borrado; cada corrida
// del hijo lleva su propio plazo, así que una cuelga no cuelga `npm test`.

/** Lo que el stub finge ser: una Strapi con 4 registros y 1 archivo en librería. */
const LECTURAS_STUB = {
  '/api/upload/files': [
    { id: 501, name: 'bitacora-la-miel.webp', url: '/uploads/501/bitacora-la-miel.webp', mime: 'image/webp' },
  ],
  // `la-miel` enlaza por regla y su nombre YA está en la librería → PUT sin POST.
  '/api/bitacoras': { data: [{ documentId: 'b1', slug: 'la-miel', marca: null }] },
  '/api/historia-visitantes': { data: [] },
  '/api/proveedors': { data: [] },
  // `miel-crema` enlaza por regla y hay que subirlo; `meliponario` solo coincide por
  // sufijo (`proveedor-` no es namespace de `item-menus`) → es un `revisar`.
  '/api/item-menus': {
    data: [{ documentId: 'i1', slug: 'miel-crema' }, { documentId: 'r1', slug: 'meliponario' }],
  },
  '/api/proyecto-meliponarios': { data: [] },
  // F2-a: `productos` entra a la tabla para que las colisiones medidas de
  // `galeria/producto-*` se reporten en `revisar` en vez de quedar en `pendientes`.
  // Aquí la lectura viene vacía: el inventario de juguete no trae arte de producto.
  '/api/productos': { data: [] },
};
/** El orden exacto en que el importador lee: siete GET, uno por tabla + librería. */
const SECUENCIA_LECTURA = [
  'GET /api/upload/files',
  'GET /api/bitacoras',
  'GET /api/historia-visitantes',
  'GET /api/proveedors',
  'GET /api/item-menus',
  'GET /api/proyecto-meliponarios',
  'GET /api/productos',
];
/** Lo único que `--apply` puede escribir: dos enlaces, y solo dos peticiones más. */
const ESCRITURAS_ESPERADAS = ['POST /api/upload', 'PUT /api/bitacoras/b1', 'PUT /api/item-menus/i1'];

const PLAZO_CORRIDA = 20_000;

/** Inventario de juguete + copia byte-idéntica del script y sus dos módulos. */
function arbolDePrueba(arte = {
  'bitacora': ['bitacora-la-miel.webp'],
  'cafe-menu': ['miel-crema.webp', 'proveedor-meliponario.webp'],
  'galeria': ['proyecto-ambala-1.webp'],
}) {
  const raiz = mkdtempSync(join(tmpdir(), 'media-import-cli-'));
  const scripts = join(raiz, 'strapi', 'scripts');
  mkdirSync(join(scripts, 'lib'), { recursive: true });
  copyFileSync(SCRIPT, join(scripts, 'media-import.mjs'));
  for (const modulo of ['media-manifest.mjs', 'media-flags.mjs']) {
    copyFileSync(join(dirname(SCRIPT), 'lib', modulo), join(scripts, 'lib', modulo));
  }
  for (const [dir, nombres] of Object.entries(arte)) {
    const abs = join(raiz, 'public', 'images', dir);
    mkdirSync(abs, { recursive: true });
    for (const nombre of nombres) writeFileSync(join(abs, nombre), 'stub-iwage-bytes-de-prueba');
  }
  return raiz;
}

/** Corre el CLI como hijo y devuelve exit code, salida y lo que escuchó el stub. */
function correr(cli, args, env) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, [cli, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    hijo.stdout.on('data', (d) => { stdout += d; });
    hijo.stderr.on('data', (d) => { stderr += d; });
    const temporizador = setTimeout(() => {
      hijo.kill('SIGKILL');
      reject(new Error(`el CLI no terminó en ${PLAZO_CORRIDA} ms (${args.join(' ') || 'sin flags'})`));
    }, PLAZO_CORRIDA);
    hijo.once('error', (e) => { clearTimeout(temporizador); reject(e); });
    hijo.once('close', (status) => {
      clearTimeout(temporizador);
      resolve({ status, stdout, stderr });
    });
  });
}

test('el CLI obedece sus flags: en seco no escribe ni una petición, y con --apply solo escribe los enlazar', async (t) => {
  const peticiones = [];
  const servidor = createServer((req, res) => {
    const ruta = (req.url ?? '').split('?')[0];
    peticiones.push(`${req.method} ${ruta}`);
    req.resume(); // el cuerpo del POST no se inspecciona: hay que drenarlo igual
    if (req.method === 'GET' && ruta in LECTURAS_STUB) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(LECTURAS_STUB[ruta]));
      return;
    }
    if (ruta === '/api/upload') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ id: 777, name: 'miel-crema.webp', url: '/uploads/777/miel-crema.webp' }]));
      return;
    }
    if (req.method === 'PUT' && ruta.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    // Cualquier otra cosa no existe en este stub: 404/501 para que se note.
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  try {
    // Bind: si el entorno no deja escuchar en loopback, esto se SALTA, no falla.
    const escuchando = await new Promise((resolve) => {
      const fallo = (e) => resolve({ ok: false, codigo: e.code ?? e.message });
      servidor.once('error', fallo);
      servidor.listen(0, '127.0.0.1', () => {
        servidor.removeListener('error', fallo);
        resolve({ ok: true });
      });
    });
    if (!escuchando.ok) {
      t.skip(`no se pudo abrir un socket propio en 127.0.0.1 (${escuchando.codigo})`);
      return;
    }
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const raiz = arbolDePrueba();
    const cli = join(raiz, 'strapi', 'scripts', 'media-import.mjs');
    // Credenciales falsas y evidentes; el valor nunca se reimprime en las aserciones.
    const CON_ENV = { ...process.env, STRAPI_URL: base, STRAPI_TOKEN: 'falso-para-stub-127' };
    const SIN_CREDENCIALES = { ...process.env, STRAPI_URL: '', STRAPI_TOKEN: '' };
    const cuenta = (lista) => lista.filter((p) => !p.startsWith('GET '));
    try {
      // 1) sin entorno: sale antes de hablar con cualquier host.
      peticiones.length = 0;
      const sin = await correr(cli, [], SIN_CREDENCIALES);
      assert.notEqual(sin.status, 0, 'sin credenciales tiene que salir con exit != 0');
      assert.deepEqual(peticiones, [], 'sin credenciales no se puede pedir nada');

      // 2) invocación pelada = dry-run: lee y no escribe.
      peticiones.length = 0;
      const seco = await correr(cli, [], CON_ENV);
      assert.equal(seco.status, 0, seco.stderr);
      assert.deepEqual(peticiones, SECUENCIA_LECTURA, 'la corrida en seco hace exactamente las lecturas');
      assert.deepEqual(cuenta(peticiones), [], 'invocación sin flags: cero peticiones que no sean GET');
      assert.match(seco.stdout, /^dry-run: /m, 'y lo dice en la salida');

      // 3) `--dry-run` explícito: el mismo camino.
      peticiones.length = 0;
      const explicito = await correr(cli, ['--dry-run'], CON_ENV);
      assert.equal(explicito.status, 0, explicito.stderr);
      assert.deepEqual(cuenta(peticiones), [], '--dry-run: cero peticiones que no sean GET');
      // Que sí hubo decisiones que no escribir: 2 enlaces y 1 propuesta en revisar.
      assert.match(explicito.stdout, /2 enlaces · 1 en revisar \(NO se escriben\) · 1 pendientes/);
      assert.match(explicito.stdout, /revisar: public\/images\/cafe-menu\/proveedor-meliponario\.webp/);

      // 4) `--dry-run --apply`: aborta con exit 2 antes de la primera petición.
      peticiones.length = 0;
      const conflicto = await correr(cli, ['--dry-run', '--apply'], CON_ENV);
      assert.equal(conflicto.status, 2);
      assert.deepEqual(peticiones, [], 'con flags contradictorias no se pide nada, ni lectura');

      // 5) `--apply`: se escriben SOLO los enlaces; el `revisar` no genera nada.
      peticiones.length = 0;
      const apply = await correr(cli, ['--apply'], CON_ENV);
      assert.equal(apply.status, 0, apply.stderr);
      assert.deepEqual(cuenta(peticiones).slice().sort(), ESCRITURAS_ESPERADAS, 'los únicos escritos son los de `enlazar`');
      assert.ok(!peticiones.some((p) => p.includes('/r1')), 'el `revisar` (item-menus/r1) no recibe ni una petición');
      assert.ok(!peticiones.some((p) => p.includes('proyecto-ambala')), 'un `pendiente` no recibe ni una petición');
      assert.doesNotMatch(apply.stdout + apply.stderr, /falso-para-stub|Bearer/i, 'ni el token ni la cabecera se imprimen');
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  } finally {
    // Nadie se queda escuchando: `close()` espera a las conexiones abiertas, así
    // que se cortan primero. Si el bind falló, cerrar no hace nada.
    servidor.closeAllConnections?.();
    await new Promise((resolve) => servidor.close(() => resolve()));
  }
});

// --- F2-a: el multi-asset llega hasta el cuerpo del PUT -----------------------
//
// El módulo puro ya promete que una galería es UNA unidad de N archivos en el
// orden de su `-N`. Esa promesa no vale nada si `aplicar()` la escribe como un
// escalar: con un array de un elemento, Strapi borra la segunda foto. Este teste
// corre el CLI completo contra un stub propio y lee el CUERPO del PUT, que es
// donde se ve la aridad y el orden. Mide además el all-or-nothing: si el segundo
// upload no devuelve archivo, el enlace no se escribe NADA.

/** La lectura del stub: un proyecto SIN `slug`, con su nombre real de producción. */
const LECTURAS_GALERIA = {
  '/api/upload/files': [],
  '/api/bitacoras': { data: [] },
  '/api/historia-visitantes': { data: [] },
  '/api/proveedors': { data: [] },
  '/api/item-menus': { data: [] },
  '/api/productos': { data: [] },
  '/api/proyecto-meliponarios': {
    data: [{ documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' }],
  },
};

test('un enlace de varios archivos se escribe COMPLETO, en orden y en un solo PUT', async (t) => {
  const peticiones = [];
  const put = [];
  let nombreQueNoSube = null;
  // El stub reparte ids DISTINTOS y crecientes. Si los dos uploads devolvieran el
  // mismo id, `[900, 900]` diría poco: el orden del enlace se prueba porque el id
  // del archivo 1 es menor que el del archivo 2 y aparecen en ese orden.
  let proximoId = 900;
  const servidor = createServer((req, res) => {
    const ruta = (req.url ?? '').split('?')[0];
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const cuerpo = Buffer.concat(trozos).toString('utf8');
      peticiones.push(`${req.method} ${ruta}`);
      const json = (v) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(v));
      };
      if (req.method === 'GET' && ruta in LECTURAS_GALERIA) return json(LECTURAS_GALERIA[ruta]);
      if (req.method === 'POST' && ruta === '/api/upload') {
        const nombre = /filename="([^"]+)"/.exec(cuerpo)?.[1] ?? '';
        if (nombre === nombreQueNoSube) return json([]); // el upload no devuelve archivo
        return json([{ id: proximoId++, name: nombre, url: `/uploads/900/${nombre}` }]);
      }
      if (req.method === 'PUT' && ruta.startsWith('/api/')) {
        put.push({ ruta, cuerpo: JSON.parse(cuerpo) });
        return json({});
      }
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  let raiz = null;
  try {
    const escuchando = await new Promise((resolve) => {
      const fallo = (e) => resolve({ ok: false, codigo: e.code ?? e.message });
      servidor.once('error', fallo);
      servidor.listen(0, '127.0.0.1', () => {
        servidor.removeListener('error', fallo);
        resolve({ ok: true });
      });
    });
    if (!escuchando.ok) {
      t.skip(`no se pudo abrir un socket propio en 127.0.0.1 (${escuchando.codigo})`);
      return;
    }
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const env = { ...process.env, STRAPI_URL: base, STRAPI_TOKEN: 'falso-para-stub-127' };
    // En disco a PROPÓSITO en orden inverso: el orden del enlace lo da el índice,
    // no lo que diga `readdirSync`.
    raiz = arbolDePrueba({ galeria: ['proyecto-ambala-2.webp', 'proyecto-ambala-1.webp'] });
    const cli = join(raiz, 'strapi', 'scripts', 'media-import.mjs');

    // 1) en seco: decide la galería y no escribe nada.
    peticiones.length = 0;
    const seco = await correr(cli, ['--dry-run'], env);
    assert.equal(seco.status, 0, seco.stderr);
    assert.deepEqual(peticiones.filter((p) => !p.startsWith('GET ')), [], '--dry-run: cero peticiones que no sean GET');
    assert.match(
      seco.stdout,
      /enlace \(nombre\): public\/images\/galeria\/proyecto-ambala-1\.webp \+ public\/images\/galeria\/proyecto-ambala-2\.webp → proyecto-meliponarios\/p1\.galeria/,
      'el enlace trae los DOS archivos, en el orden del índice',
    );
    assert.match(seco.stdout, /archivos: 2 enlazados \+ 0 en revisar \+ 0 pendientes = 2 de 2/, 'y la contabilidad cierra por archivos');

    // 2) `--apply`: dos subidas y UN solo PUT con la lista completa en orden.
    peticiones.length = 0;
    put.length = 0;
    proximoId = 900;
    const apply = await correr(cli, ['--apply'], env);
    assert.equal(apply.status, 0, apply.stderr);
    assert.deepEqual(
      peticiones.filter((p) => p.startsWith('POST ') || p.startsWith('PUT ')),
      ['POST /api/upload', 'POST /api/upload', 'PUT /api/proyecto-meliponarios/p1'],
      'se suben los dos archivos y se enlaza una sola vez',
    );
    // Desde `fa240b2` el esquema dice `media` multiple, así que el valor es la
    // lista de IDS del archivo, no la de rutas relativas (`multipleForma` estaba
    // desincronizada: ver I4 en tests/media-manifest.test.mjs).
    assert.deepEqual(put, [{
      ruta: '/api/proyecto-meliponarios/p1',
      cuerpo: { data: { galeria: [900, 901] } },
    }], 'el PUT lleva la galería completa y en orden (aridad de la tabla, no del conteo)');

    // 3) all-or-nothing: si el segundo archivo no sube, ese enlace no escribe nada.
    peticiones.length = 0;
    put.length = 0;
    proximoId = 900;
    nombreQueNoSube = 'proyecto-ambala-2.webp';
    const roto = await correr(cli, ['--apply'], env);
    nombreQueNoSube = null;
    assert.notEqual(roto.status, 0, 'un enlace incompleto tiene que terminar con exit != 0');
    assert.deepEqual(put, [], 'y no puede dejar escrita una galería de un elemento');
    assert.match(roto.stdout + roto.stderr, /falló el enlace: proyecto-meliponarios p1/, 'lo dice por nombre y registro');
  } finally {
    if (raiz) rmSync(raiz, { recursive: true, force: true });
    servidor.closeAllConnections?.();
    await new Promise((resolve) => servidor.close(() => resolve()));
  }
});

// --- el envase del alias, del lado del CLI ------------------------------------
//
// `strapi/scripts/lib/media-manifest.mjs` valida FILAS; el ENVASE lo valida el
// script, en `leerAlias()`. La distinción dejó de ser teórica el 2026-09-25: el
// artefacto de alias propuesto (`media-alias-propuesto.json`) se escribió como un
// mapa directo ruta→{endpoint, slug} y las 27 filas pasaban `manifesto()` verdes —
// el CLI las habría rechazado antes de leer la primera. Un teste sobre la forma
// interna no puede ver eso; este, sí.

const RAIZ_REPO = dirname(dirname(dirname(SCRIPT)));
const RECHAZO_ENVASE = /no trae un objeto en la clave "alias"/;

test('el CLI rechaza un envase de alias mal formado antes de hablar con la red, y acepta el de la propuesta', async (t) => {
  const peticiones = [];
  const servidor = createServer((req, res) => {
    peticiones.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // Las siete lecturas del importador, resueltas y vacías: ninguna fila de alias
    // puede firmar acá, pero eso es el paso siguiente al que se mira en este teste.
    res.end(req.url.startsWith('/api/upload/files') ? '[]' : '{"data":[]}');
  });
  const escuchando = await new Promise((resolve) => {
    const fallo = (e) => resolve({ ok: false, codigo: e.code ?? e.message });
    servidor.once('error', fallo);
    servidor.listen(0, '127.0.0.1', () => {
      servidor.removeListener('error', fallo);
      resolve({ ok: true });
    });
  });
  if (!escuchando.ok) {
    t.skip(`no se pudo abrir un socket propio en 127.0.0.1 (${escuchando.codigo})`);
    return;
  }
  const env = {
    ...process.env,
    STRAPI_URL: `http://127.0.0.1:${servidor.address().port}`,
    STRAPI_TOKEN: 'falso-para-stub-127',
  };
  const raiz = arbolDePrueba();
  const cli = join(raiz, 'strapi', 'scripts', 'media-import.mjs');
  try {
    // 1) El mapa pelado — la forma que TENÍA la propuesta — no pasa.
    writeFileSync(join(raiz, 'pelado.json'), JSON.stringify({
      'public/images/bitacora/bitacora-la-miel.webp': { endpoint: 'bitacoras', slug: 'la-miel' },
    }));
    peticiones.length = 0;
    const pelado = await correr(cli, ['--alias=pelado.json'], env);
    assert.equal(pelado.status, 1, 'un envase mal formado no puede terminar en corrida');
    assert.match(pelado.stderr, RECHAZO_ENVASE);
    assert.deepEqual(peticiones, [], 'y se aborta antes de la primera petición: no gasta credencial ni red');

    // 2) Las otras dos formas de "no es el envase": ruta que no existe y JSON roto.
    peticiones.length = 0;
    const ausente = await correr(cli, ['--alias=no-existe.json'], env);
    assert.match(ausente.stderr, /el archivo de --alias no existe/);
    writeFileSync(join(raiz, 'roto.json'), '{ alias: ');
    const roto = await correr(cli, ['--alias=roto.json'], env);
    assert.match(roto.stderr, /no es JSON válido/);
    assert.deepEqual(peticiones, [], 'ninguna de las dos llegó a pedir nada');

    // 3) El artefacto real pasa el mismo lector: se llega a la red y no hay rechazo
    //    de envase. (Que las 27 filas FIRMAN se prueba en isolation en
    //    tests/media-alias-propuesto.test.mjs, sin servidor en el medio.)
    copyFileSync(join(RAIZ_REPO, 'strapi', 'scripts', 'media-alias-propuesto.json'), join(raiz, 'propuesta.json'));
    peticiones.length = 0;
    const buena = await correr(cli, ['--alias=propuesta.json'], env);
    assert.doesNotMatch(buena.stderr + buena.stdout, RECHAZO_ENVASE, 'la propuesta quedó en una forma que el CLI no lee');
    assert.equal(buena.status, 0, buena.stderr);
    assert.ok(peticiones.some((p) => p.startsWith('GET ')), 'y sí pasó del envase a la lectura');
    assert.deepEqual(peticiones.filter((p) => !p.startsWith('GET ')), [], 'con --alias en seco: ni un POST, ni un PUT');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
    servidor.closeAllConnections?.();
    await new Promise((resolve) => servidor.close(() => resolve()));
  }
});
