#!/usr/bin/env node
/**
 * Inventario accionable de los assets huérfanos de public/images/ e importador
 * a la media library de Strapi, con el enlace por identidad.
 *
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs            # dry-run
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs --dry-run  # ídem, explícito
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs --apply    # ESCRIBE: requiere autorización del dueño
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs --alias=strapi/scripts/media-alias.json
 *
 * Sin flags corre en seco: solo hace GET (lectura) y no sube ni cambia nada.
 * `--apply` es la única ruta que escribe, y es la que abre la fase F2.
 * `--dry-run` y `--apply` a la vez ABORTAN con exit 2 antes de mirar el entorno:
 * el dry-run es el único guard de esta herramienta, así que una invocación
 * contradictoria no se resuelve a favor de la escritura (parsea
 * ./lib/media-flags.mjs, que es pura y se testea sin servidor).
 *
 * Qué decide cada enlace, y con qué grado de confianza, vive en
 * ./lib/media-manifest.mjs: cuatro niveles (`alias` declarado → `slug` exacto →
 * `nombre` normalizado → coincidencia solo por sufijo, esta última NO se
 * enlaza). Un enlace puede llevar una LISTA ORDENADA de archivos —la galería de
 * un proyecto, en el orden de su `-N`—; `aplicar()` escribe la unidad COMPLETA o
 * no escribe ese enlace, porque una galería de dos archivos cuyo segundo upload
 * falla no puede dejar detrás una galería de un elemento.
 *
 * Por eso la lectura pide `nombre` además de `slug` donde el content-type tiene
 * la identidad en el nombre: medido, los 6 `proyecto-meliponario` traen
 * `slug: null`, y sin `nombre` no habría ningún enlace posible.
 *
 * `--alias=<ruta>` lee un JSON `{"alias": {...}}` con los emparejamientos que
 * ningún nombre permite deducir — hoy, las 36 tapas de bitácora, que traen el
 * slug recortado—. Acepta dos formas de fila: la de siempre, clave = ruta de
 * archivo y valor `{endpoint, slug}`, y una con clave = `documentId` y valor
 * `{endpoint, campo, archivos: [...]}`, que es la única que puede firmar a un
 * registro SIN `slug` y la única que escribe un campo repetible en el orden
 * declarado. Ver el bloque ALIAS de ./lib/media-manifest.mjs: sin ese archivo,
 * esas tapas quedan en `pendientes`.
 *
 * Idempotencia REAL y declarada: por NOMBRE. Se indexa la media library y un
 * nombre que ya existe no se vuelve a subir; enlazar vuelve a asignar el mismo
 * valor, así que re-ejecutar no duplica archivos ni enlaces. NO pretende
 * detectar re-producciones (mismo nombre, bytes distintos): /api/upload/files
 * no expone un checksum con el que comparar, así que una tapa reproducida a mano
 * exige borrar su archivo en el admin y re-ejecutar. Si algún día hace falta el
 * control por bytes, es un hash propio guardado junto al registro, no esto.
 *
 * Las credenciales salen SOLO del entorno. Este archivo no las imprime nunca, ni
 * en el éxito ni en el error, y tampoco admite que se pasen por argumento.
 * El mapeo vive en ./lib/media-manifest.mjs (puro, testeado en
 * tests/media-manifest.test.mjs); aquí solo hay E/S.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDPOINTS_CON_MEDIO,
  RAIZ,
  archivosDelEnlace,
  directoriosDeInventario,
  esCampoMultiple,
  formaDeCampo,
  manifesto,
} from './lib/media-manifest.mjs';
import { parsearFlags } from './lib/media-flags.mjs';

/** El repo se resuelve desde este archivo, no desde el cwd: el script corre desde cualquier carpeta. */
const RAIZ_REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CARPETA_IMAGENES = join(RAIZ_REPO, RAIZ);

const OPCIONES = parsearFlags(process.argv.slice(2));
if (OPCIONES.modo === 'invalido') {
  // Se imprime solo el nombre del flag, cortado antes del `=`: si alguien intentó
  // pasar un secreto por argumento, echopear el argumento entero lo filtraría.
  console.error(`Flag no reconocida: ${OPCIONES.desconocidas.map((a) => a.split('=')[0]).join(', ')}. Uso: --dry-run (por defecto) | --apply | --alias=<ruta>`);
  process.exit(2);
}
if (OPCIONES.modo === 'conflicto') {
  // `--dry-run` y `--apply` no se resuelven eligiendo una: se aborta. Pasar los dos era, hasta
  // acá, escribir PUT/POST sin imprimir la línea `dry-run:`. Se sale antes de leer
  // el entorno y antes de la primera petición, así que no hay nada tocado.
  console.error('Flags contradictorias: --dry-run y --apply a la vez. No escribo y no decido por uno: elija una. Aborto sin leer el entorno ni tocar nada.');
  process.exit(2);
}
/** El único modo que escribe. `conflicto` e `invalido` ya salieron del proceso. */
const ESCRIBIR = OPCIONES.modo === 'aplicar';

const FALTAN = ['STRAPI_URL', 'STRAPI_TOKEN'].filter((n) => !process.env[n]);
if (FALTAN.length) {
  console.error(`Faltan ${FALTAN.join(' y ')} en el entorno. Aborto sin leer ni tocar nada.`);
  process.exit(1);
}
const BASE = process.env.STRAPI_URL.replace(/\/+$/, '');
const TOKEN = process.env.STRAPI_TOKEN;

/** pedir — único punto de salida a Strapi. En dry-run solo se llaman GET. */
async function pedir(ruta, opciones) {
  const metodo = opciones?.method ?? 'GET';
  const sinQuery = ruta.split('?')[0];
  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(opciones?.headers ?? {}) },
    });
  } catch (e) {
    // Ni el host ni la cabecera: solo qué llamada no llegó, que es lo que sirve para diagnosticar.
    throw new Error(`no llegó la petición ${metodo} ${sinQuery} (${e.message})`);
  }
  if (!res.ok) {
    throw new Error(`Strapi respondió ${res.status} a ${metodo} ${sinQuery}`);
  }
  return res.json();
}

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const nombreDe = (archivo) => archivo.split('/').pop();
const extensionDe = (archivo) => nombreDe(archivo).split('.').pop().toLowerCase();

/**
 * Valor que se le manda al campo. La forma la pregunta `formaDeCampo(endpoint,
 * campo)` —portada y galería pueden ser de tipo distinto en el mismo
 * content-type— y la tabla está candada contra el esquema por
 * `tests/media-manifest.test.mjs`, así que acá no se decide nada: se obedece.
 *   · `media`   → id numérico del archivo. Es la forma de los seis endpoints de
 *                 la tabla HOY: desde `fa240b2` portada y galería son `media` en
 *                 el esquema (`galería`, `media` multiple), así que este es el
 *                 caso que corre en producción. `connect` NO está soportado para
 *                 atributos media según la doc de REST de Strapi, y el doc de la
 *                 brief lo dejaba como variante a comprobar: hay que validar el
 *                 formato con UN registro antes de lanzar el lote.
 *   · `string`  → ruta relativa de sitio. Nunca el host interno de Strapi: ese
 *                 fue justo el bug que cerró F0 con `mediaSrc`. Queda para un
 *                 campo que el esquema todavía no convirtió.
 *   · `json`    → lista de esas mismas rutas relativas; cada elemento se arma
 *                 igual que en `string`. Idem: ninguna fila de la tabla lo usa ya.
 * `null` = no hay forma utilizable, y el enlace no se escribe.
 */
function valorDeEnlace(file, forma) {
  if (forma === 'media') return file.id;
  if (forma !== 'string' && forma !== 'json') return null;
  const url = file.url ?? '';
  if (url.startsWith('/')) return url;
  try {
    return new URL(url, BASE).pathname;
  } catch {
    return null;
  }
}

/**
 * Archivo de alias declarados (`--alias=<ruta>`): `{"aviso": "…", "alias": {...}}`
 * con filas de dos formas — clave = ruta de archivo y valor `{endpoint, slug}`, o
 * clave = `documentId` y valor `{endpoint, campo, archivos: [...]}` en el orden en
 * que hay que escribirlos—. `aviso` y cualquier otra clave de arriba se ignoran:
 * lo único que se lee es `alias`, que tiene que ser un objeto. La forma la valida
 * el módulo puro, que reporta la fila que no puede firmar en vez de reventar la
 * corrida.
 *
 * Ni este mensaje ni ninguno echoea el valor de `--alias`: la política del script
 * es no reimprimir argumentos (un secreto podría viajar ahí), y el que pasó la
 * ruta ya sabe cuál era. Una ruta relativa se resuelve contra el repo, como el
 * inventario de imágenes: el script corre desde cualquier carpeta.
 */
function leerAlias(ruta) {
  const abs = isAbsolute(ruta) ? ruta : join(RAIZ_REPO, ruta);
  if (!existsSync(abs)) throw new Error('el archivo de --alias no existe');
  let crudo;
  try {
    crudo = JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    throw new Error('el archivo de --alias no es JSON válido');
  }
  const mapa = crudo?.alias;
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) {
    throw new Error('el archivo de --alias no trae un objeto en la clave "alias"');
  }
  return mapa;
}

/** Lee el disco y Strapi (solo GET) y arma el manifiesto. */
async function construir(alias) {
  const declarados = directoriosDeInventario();
  const archivos = [];
  for (const dir of declarados) {
    const abs = join(CARPETA_IMAGENES, dir);
    if (!existsSync(abs)) {
      console.warn(`  sin directorio en disco: ${RAIZ}/${dir} (la tabla lo declara; no se inventa)`);
      continue;
    }
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isFile() && /\.(webp|png|jpe?g)$/i.test(e.name)) archivos.push(`${RAIZ}/${dir}/${e.name}`);
    }
  }
  // `readdirSync` devuelve lo que dice el directorio, no un orden. El manifiesto
  // ya no depende del orden de entrada (ver C1 en ./lib/media-manifest.mjs), pero
  // el INVENTARIO sí se imprime: ordenarlo acá hace que dos corridas sobre el
  // mismo disco den un diff vacío, y le quita al llamador la obligación de saber
  // que la clave de agrupamiento tiene que ser estable.
  archivos.sort();
  // Nada se cae en silencio por el otro lado tampoco: un directorio con arte que
  // ninguna unidad de negocio reclame es un hallazgo del inventario, no un detalle.
  const enDisco = readdirSync(CARPETA_IMAGENES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  for (const dir of enDisco.filter((d) => !declarados.includes(d))) {
    console.warn(`  directorio sin endpoint en la tabla (no se oferta): ${RAIZ}/${dir}`);
  }

  const existentes = await pedir('/api/upload/files?pagination[pageSize]=200');
  const libreria = Array.isArray(existentes) ? existentes : (existentes?.data ?? []);
  const porNombre = new Map(libreria.map((f) => [f.name, f]));
  if (libreria.length >= 200) console.warn('  la media library trajo 200 archivos: hay más de una página, el índice por nombre está incompleto');

  const registros = [];
  const leidos = [];
  for (const [endpoint, cfg] of Object.entries(ENDPOINTS_CON_MEDIO)) {
    // `nombre` solo donde el content-type lo tiene y la tabla lo declara identidad:
    // pedir un field que no existe es un 400 garantizado. Y al revés también manda:
    // `proveedor` e `item-menu`, que sí están en la tabla, tienen `nombre` en el esquema
    // y no declaran identidad por nombre, así que prenderles `identidadNombre` obliga a
    // tocar esta línea. El criterio está escrito una sola vez, en `ENDPOINTS_CON_MEDIO`
    // (lib/media-manifest.mjs).
    const campos = ['slug', ...(cfg.tieneMarca ? ['marca'] : []), ...(cfg.identidadNombre ? ['nombre'] : [])];
    const qs = new URLSearchParams({ 'pagination[pageSize]': '200', 'pagination[page]': '1', sort: 'slug:asc' });
    campos.forEach((c, i) => qs.set(`fields[${i}]`, c));
    const j = await pedir(`/api/${endpoint}?${qs}`);
    const datos = j?.data ?? [];
    leidos.push(`${endpoint}=${datos.length}`);
    if (datos.length >= 200) console.warn(`  ${endpoint}: 200 registros, puede que hayan más (paginar)`);
    for (const d of datos) {
      // `campo` no se pasa: lo deriva la tabla del módulo puro. Un valor aquí mandaría.
      registros.push({ endpoint, documentId: d.documentId, slug: d.slug, nombre: d.nombre, marca: d.marca });
    }
  }

  return {
    manifiesto: manifesto({ archivos, registros, alias }),
    porNombre,
    leidos,
    registros,
    archivos,
    filasAlias: Object.keys(alias).length,
  };
}

function imprimir({ manifiesto: m, porNombre, leidos, registros, archivos, filasAlias }) {
  console.log(`lectura: ${leidos.join(' ')} · ${registros.length} registros · ${archivos.length} archivos · ${filasAlias} filas de alias`);
  // CONTABILIDAD (Tareas 11 y 14): `enlazar`, `pendientes` y `revisar` son una
  // PARTICIÓN de los archivos leídos — cada archivo cae en exactamente un balde—.
  // Como una entrada de `enlazar` puede traer VARIOS archivos (la galería de un
  // proyecto), la suma que cierra contra el inventario es por archivos, no por
  // líneas: se imprimen las dos y la de archivos es la que vale como inventario.
  // Nunca se suma un cuarto arreglo a ese total: `ambiguos` y `motivosAlias` son
  // listas de RAZONES, no de archivos, y un mismo archivo puede tener varias.
  // Y se cuentan por archivo DISTINTO, no por suma por enlace: la cabida del
  // contrato es un archivo → un balde, pero una fila de alias con `portada` escribe
  // DOS enlaces del mismo registro sobre el MISMO archivo (la portada es miembro de
  // su propia serie). Sumando longitudes, `3 de 2` apagaba la guarda de abajo.
  const enlazados = new Set(m.enlazar.flatMap(archivosDelEnlace));
  console.log(`${m.enlazar.length} enlaces · ${m.revisar.length} en revisar (NO se escriben) · ${m.pendientes.length} pendientes · ${m.ambiguos.length} ambigüedades · ${m.motivosAlias.length} motivo(s) de alias sin firmar`);
  console.log(`archivos: ${enlazados.size} enlazados + ${m.revisar.length} en revisar + ${m.pendientes.length} pendientes = ${enlazados.size + m.revisar.length + m.pendientes.length} de ${archivos.length}`);
  if (enlazados.size + m.revisar.length + m.pendientes.length !== archivos.length) {
    console.warn('  LA PARTICIÓN NO CIERRA: hay archivos sin balde o en dos baldes. No usar esta salida como inventario.');
  }
  for (const e of m.enlazar) {
    const lista = archivosDelEnlace(e);
    const porSubir = lista.filter((a) => !porNombre.has(nombreDe(a))).length;
    const estado = porSubir === lista.length
      ? (lista.length > 1 ? `${lista.length} nombres nuevos: hay que subirlos` : 'nombre nuevo: hay que subirlo')
      : porSubir ? `${porSubir} de ${lista.length} por subir` : 'los nombres ya están en la librería';
    // El origen va siempre en la salida: omitido significa «regla de `slug`», que
    // es el caso que el contrato del módulo deja sin etiqueta.
    console.log(`  enlace (${e.origen ?? 'slug'}): ${lista.join(' + ')} → ${e.endpoint}/${e.documentId}.${e.campo} (${estado})`);
  }
  // Un `revisar` es una propuesta con nombre y apellido: se imprime para el humano,
  // y la única forma de volverla escribible es declararla en el archivo de alias.
  for (const r of m.revisar) console.log(`  revisar: ${r.archivo} · ${r.motivo}`);
  for (const p of m.pendientes) console.log('  pendiente:', p);
  // Un registro sin `slug` se nombra por `documentId`: medido, 6 de 6
  // `proyecto-meliponario` y 3 de 14 `producto` no tienen otra identidad.
  for (const a of m.ambiguos) console.log('  ambiguo:', a.slug ?? a.documentId, '·', a.motivo);
  // Y la fila de alias que no se pudo firmar se nombra, sin contar su archivo dos
  // veces: ese archivo ya está en `enlazar` o en `pendientes`.
  for (const s of m.motivosAlias) console.log(`  alias sin firmar: ${s.archivo} · ${s.motivo}`);
}

/** Sube lo que falte y enlaza. Solo se llega aquí con --apply y con modo `aplicar`. */
async function aplicar({ manifiesto: m, porNombre }) {
  // El balde `revisar` no se escribe ni con --apply: son coincidencias solo por
  // sufijo y colisiones sin desempate, es decir, propuestas con nombre y apellido
  // que requieren la fila de alias de un humano. Las filas de alias que ningún
  // registro pudo firmar ya no están acá (van a `motivosAlias`, que no es un balde
  // de archivos) y tampoco se escriben.
  if (m.revisar.length) console.warn(`  ${m.revisar.length} emparejamiento(s) en revisar: se omite(n), no se escribe(n).`);
  let errores = 0;
  for (const enlace of m.enlazar) {
    const { endpoint, documentId, campo } = enlace;
    // Un enlace puede traer VARIOS archivos, ya en el orden en que hay que
    // escribirlos (ver CONTRATO 2 del módulo). Se preparan TODOS antes de tocar
    // el registro: escribir la mitad de una galería borra la otra mitad, y ese es
    // exactamente el daño que esta fase no puede hacer.
    const archivos = archivosDelEnlace(enlace);
    const forma = formaDeCampo(endpoint, campo);
    const multiple = esCampoMultiple(endpoint, campo);
    // Un enlace roto no corta el lote: se cuenta y se sigue, y el script termina con exit 1.
    try {
      if (!forma) throw new Error(`${endpoint}.${campo} no es un campo de medio de la tabla`);
      const valores = [];
      for (const archivo of archivos) {
        const nombre = nombreDe(archivo);
        let file = porNombre.get(nombre);
        if (!file) {
          const form = new FormData();
          form.append('files', new Blob([readFileSync(join(RAIZ_REPO, archivo))], { type: MIME[extensionDe(archivo)] ?? 'application/octet-stream' }), nombre);
          const sub = await pedir('/api/upload', { method: 'POST', body: form });
          file = (Array.isArray(sub) ? sub : sub?.data)?.[0];
          if (!file?.id) throw new Error('el upload no devolvió archivo');
          porNombre.set(nombre, file);
        }
        const valor = valorDeEnlace(file, forma);
        if (valor === null) throw new Error(`sin ruta utilizable para ${nombre}`);
        valores.push(valor);
      }
      await pedir(`/api/${endpoint}/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { [campo]: multiple ? valores : valores[0] } }),
      });
      console.log('  ok', endpoint, documentId, campo, '←', archivos.map(nombreDe).join(' + '));
    } catch (e) {
      console.warn('  falló el enlace:', endpoint, documentId, '·', e.message);
      errores += 1;
    }
  }
  return errores;
}

try {
  // El alias se lee antes que nada: si está mal, se aborta sin haber tocado la red.
  const alias = OPCIONES.alias ? leerAlias(OPCIONES.alias) : {};
  const inventario = await construir(alias);
  imprimir(inventario);
  if (!ESCRIBIR) {
    // `process.exitCode`, no `process.exit`: `console.log` sobre una cañería es
    // asíncrono en Node y salir de golpe puede recortar la salida. Acá eso es un
    // teste intermitente (`tests/media-flags.test.mjs` aserta sobre `stdout` del
    // hijo) y un inventario truncado en un terminal. El módulo termina solo.
    console.log('\ndry-run: no subí nada ni toqué registros. Repetir con --apply.');
    process.exitCode = 0;
  } else {
    const errores = await aplicar(inventario);
    if (errores) console.error(`\n--apply terminó con ${errores} enlace(s) sin completar.`);
    else console.log('\napply terminado.');
    process.exitCode = errores ? 1 : 0;
  }
} catch (e) {
  // Solo el mensaje propio: ni la cabecera de autorización ni el host aparecen aquí.
  console.error(`Aborto: ${e.message}`);
  process.exitCode = 1;
}
