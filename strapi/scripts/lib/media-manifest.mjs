/**
 * Mapeo huérfano → registro. Puro y sin red a propósito: es la parte que decide
 * qué se sube y a quién se le asigna, y eso hay que poder revisarlo antes de
 * tocar la base de datos (F2 es la primera fase que escribe).
 *
 * Pureza medible: sin `fs`, sin `fetch`, sin `process.env`, sin `Date` ni
 * `Math.random`. Misma entrada → misma salida, incluso el orden de cada arreglo.
 *
 * ---------------------------------------------------------------------------
 * Contrato (dos cosas que la brief de la Tarea 10 dejaba indeterminadas y que
 * aquí están decididas; los testes de tests/media-manifest.test.mjs las fijan):
 *
 * 1. `campo` es propiedad del content-type, no del registro. Un archivo se
 *    enlaza al campo de portada que define el esquema, así que la única fuente
 *    de verdad es `ENDPOINTS_CON_MEDIO[endpoint].campo`. Si el llamador trae
 *    `campo` en el registro, ese manda (permite apuntar a otro campo sin tocar
 *    la tabla). Con esto `enlazar[].campo` nunca sale `undefined`.
 *
 * 2. Emparejar y reclamar son dos pasos separados. Primero se calculan los
 *    candidatos de cada registro contra TODOS los archivos; después, en orden
 *    de prioridad, se van reclamando. Así un slug cuyo único candidato ya está
 *    en manos de otro se REPORTA en `ambiguos` con el nombre del ganador en el
 *    motivo, en vez de desaparecer.
 *
 * ---------------------------------------------------------------------------
 * Convención de nombres: la brief documenta `<marca>-<slug>.webp`. Medido en
 * disco el 2026-09-25, NINGUNA de las 36 tapas de bitácora la cumple: se llaman
 * `bitacora-<slug>.webp`, y en `cafe-menu/` conviven tres namespaces
 * (`<slug>`, `proveedor-<slug>`, `visitante-<slug>`) que son de endpoints
 * distintos. El emparejamiento, entonces, tiene tres orígenes:
 *
 *   · nivel `ALIAS` (declarado por un humano): ver el bloque ALIAS abajo;
 *   · nivel `REGLA` (confiable): el nombre base es `slug`, `<marca>-slug` o
 *     `<prefijo-del-endpoint>-slug`;
 *   · nivel `SUFIJO` (sospechoso): el nombre base termina en `-slug` con un
 *     prefijo que no pertenece al endpoint. **No se enlaza.** Va a `revisar` con
 *     el motivo `coincidencia solo por sufijo: <ruta>`, y `aplicar()` se niega a
 *     escribir ese balde: la única forma de convertir un `revisar` en enlace es
 *     declararlo en `alias`.
 *
 * Nunca se enlaza un archivo que no esté en el directorio del endpoint — ni por
 * regla ni por alias, que fija el emparejamiento pero no abre esa puerta. Un
 * archivo con dos candidatos de nombre distinto se reporta, no se elige en
 * silencio. Entre gemelos de extensión del mismo nombre base gana el .webp y el
 * .png queda en `pendientes` (esa es la lista que consume Tarea 14 para borrar
 * los duplicados).
 *
 * `archivos` se pasa con ruta relativa al repo (`public/images/<dir>/<nombre>`);
 * lo que no tenga esa forma no es reclamable y termina en `pendientes`, que es
 * el modo de fallar visible.
 *
 * ---------------------------------------------------------------------------
 * ALIAS — el mecanismo para los emparejamientos que ninguna regla alcanza.
 *
 * Medido el 2026-09-25: de las 36 tapas de `public/images/bitacora/` se enlazan
 * por regla **cero**, y no es un bug del emparejamiento sino un problema de
 * dirección. Los archivos traen el slug RECORTADO (`bitacora-caso-don-manuel.webp`)
 * y el slug real de esa publicación es más largo (`caso-la-finca-de-don-manuel`,
 * front-matter de `Publicaciones/Meliponario/caso-la-finca-de-don-manuel.md`).
 * `base === slug` no puede ocurrir y `base.endsWith('-' + slug)` tampoco: el
 * archivo es más CORTO que el slug. Ninguna relajación de la regla lo resuelve
 * sin adivinar, y adivinar en una herramienta que escribe en producción no está
 * en el menú.
 *
 * Así que el emparejamiento que la regla no puede deducir se DECLARA, y se revisa
 * como se revisa cualquier dato:
 *
 *   manifesto({ archivos, registros, alias })
 *
 *   alias: {
 *     'public/images/bitacora/bitacora-caso-don-manuel.webp':
 *       { endpoint: 'bitacoras', slug: 'caso-la-finca-de-don-manuel' },
 *   }
 *
 * · la clave es la RUTA tal como la produce el inventario (no el nombre base: las
 *   bases se repiten entre directorios y la ruta no);
 * · el valor nombra al registro por `endpoint` + `slug`. El `documentId` lo aporta
 *   la lectura de la API, nunca el alias: un alias no puede inventar un id;
 * · un alias se resuelve en el nivel más alto — le gana a cualquier coincidencia
 *   por nombre sobre el mismo archivo — y su enlace sale ETIQUETADO con
 *   `origen: 'alias'`. Los enlaces por regla NO traen la clave: su ausencia es lo
 *   que los distingue (el contrato literal de la brief fija `enlazar[0]` con
 *   cuatro claves);
 * · si la lectura trae dos registros con el mismo `endpoint`/`slug`, el alias firma
 *   el primero en el orden de entrada: determinista, no aleatorio;
 * · un alias que no se puede firmar (el archivo no está en el inventario, ningún
 *   registro trae ese endpoint/slug, cae fuera del directorio del endpoint, o el
 *   registro ya tiene otro alias) NO escribe nada: va a `revisar` con el motivo
 *   exacto, para que un alias viejo o mal escrito se vea y no se calle.
 *
 * DE DÓNDE TIENE QUE SALIR EL VOCABULARIO: de `bitacoras.slug` en la base de
 * datos, que hasta hoy NADIE leyó (la lectura está gateada al dueño y F2 no está
 * autorizada). Este módulo no lo adivina y el repo no trae ni una fila:
 * `strapi/scripts/media-alias.json` es un envase vacío con el aviso puesto. Lo
 * llena la Tarea 11 con un volcado de SOLO LECTURA de `bitacoras.slug` autorizado
 * por el dueño, y se le pasa al importador con `--alias=<ruta>`.
 */

const RAIZ = 'public/images';
const RE_RUTA = /^public\/images\/([^/]+)\/([^/]+)$/;

/**
 * Unidades de negocio que tienen un campo de portada y directorio de arte
 * producido. Datos verificados, no inventados:
 *   · endpoint  = `info.pluralName` del schema de cada content-type
 *     (strapi/src/api/<ct>/content-types/<ct>/schema.json), que es la ruta REST
 *     real (proveedor → `proveedors`, no `proveedores`;
 *     proyecto-meliponario → `proyecto-meliponarios`, no `proyectos`).
 *   · campo     = nombre del atributo de portada en ese esquema.
 *   · dir       = directorio que EXISTE en public/images/; las tapas de
 *     visitante y proveedor viven dentro de `cafe-menu/`, no hay
 *     `public/images/visitante/` ni `public/images/proveedor/`.
 *   · prefijos  = namespaces de nombre que pertenece al endpoint (medidos en
 *     los 86 archivos de los tres directorios).
 *   · tieneMarca = el content-type tiene atributo `marca` (solo bitacora y
 *     producto lo tienen), así que solo ahí se pide en `fields`.
 *   · campoForma = tipo ACTUAL del atributo en el esquema: `string` o `media`.
 *     Define la forma del cuerpo del PUT (ruta relativa vs id de archivo). La
 *     Tarea 11 convierte los `string` de portada a `media`: cuando lo haga,
 *     esta columna cambia con ellos (bitacoras y proyecto-meliponarios primero).
 */
export const ENDPOINTS_CON_MEDIO = {
  bitacoras: { dir: 'bitacora', campo: 'imagen', campoForma: 'string', prefijos: ['bitacora'], tieneMarca: true },
  'historia-visitantes': { dir: 'cafe-menu', campo: 'imagen', campoForma: 'media', prefijos: ['visitante'], tieneMarca: false },
  proveedors: { dir: 'cafe-menu', campo: 'foto', campoForma: 'media', prefijos: ['proveedor'], tieneMarca: false },
  'item-menus': { dir: 'cafe-menu', campo: 'imagen', campoForma: 'media', prefijos: [], tieneMarca: false },
  'proyecto-meliponarios': { dir: 'galeria', campo: 'imagen', campoForma: 'string', prefijos: ['proyecto'], tieneMarca: false },
};

/** Preferencia de formato: el .webp es el activo canónico; .png es su gemelo. */
const RANGO_EXT = { webp: 0, png: 1, jpg: 2, jpeg: 3 };

/** Origen de un emparejamiento, en orden de confianza. También es el orden de reclamo. */
const NIVEL = { ALIAS: 0, REGLA: 1, SUFIJO: 2 };
/** Orden de un registro sin ningún candidato: reclama después de todos (no reclama). */
const SIN_CANDIDATOS = 9;

function archivoInfo(archivo) {
  const ruta = RE_RUTA.exec(archivo);
  if (!ruta) return null;
  const [, dir, nombre] = ruta;
  const punto = nombre.lastIndexOf('.');
  if (punto <= 0) return null;
  const ext = nombre.slice(punto + 1).toLowerCase();
  if (!(ext in RANGO_EXT)) return null;
  return { archivo, dir, nombre, base: nombre.slice(0, punto), ext };
}

/**
 * Candidatos de un registro: el archivo declarado por alias primero, y después los
 * que da el nombre, ordenados por nivel, preferencia de extensión y ruta.
 * `aliasInfo` solo llega cuando la fila ya pasó los filtros del pre-pase (existe
 * en el inventario y está en el directorio del endpoint).
 */
function candidatos(reg, infos, aliasInfo) {
  const cfg = ENDPOINTS_CON_MEDIO[reg.endpoint];
  if (!cfg || !reg.slug) return [];
  const slug = reg.slug;
  const nivel1 = new Set([
    slug,
    ...(reg.marca ? [`${reg.marca}-${slug}`] : []),
    ...cfg.prefijos.map((p) => `${p}-${slug}`),
  ]);
  const porNombre = infos
    .filter((i) => i.dir === cfg.dir && (i.base === slug || i.base.endsWith(`-${slug}`)))
    .map((i) => ({ ...i, nivel: nivel1.has(i.base) ? NIVEL.REGLA : NIVEL.SUFIJO }));
  const todos = aliasInfo
    ? [{ ...aliasInfo, nivel: NIVEL.ALIAS }, ...porNombre.filter((c) => c.archivo !== aliasInfo.archivo)]
    : porNombre;
  return todos.sort((a, b) => a.nivel - b.nivel || RANGO_EXT[a.ext] - RANGO_EXT[b.ext] || (a.archivo < b.archivo ? -1 : 1));
}

/**
 * @param {{
 *   archivos: string[],
 *   registros: Array<{endpoint: string, documentId: string, slug?: string, marca?: string, campo?: string}>,
 *   alias?: Record<string, {endpoint: string, slug: string}>
 * }} in rutas de archivo → registro declarado, o `{}` / ausente si no hay alias
 * @returns {{
 *   enlazar: Array<{endpoint: string, documentId: string, campo: string, archivo: string, origen?: 'alias'}>,
 *   pendientes: string[],
 *   ambiguos: Array<{slug: string, documentId: string, motivo: string}>,
 *   revisar: Array<{archivo: string, motivo: string, endpoint?: string, documentId?: string, campo?: string}>
 * }}
 */
export function manifesto({ archivos, registros, alias = {} }) {
  const infos = archivos.map(archivoInfo).filter(Boolean);
  const porRuta = new Map(infos.map((i) => [i.archivo, i]));

  /** índice de `registros` → archivo declarado, solo para filas firmables. */
  const aliasFirmado = new Map();
  /** filas de alias que no producen enlace, con la razón exacta. */
  const aliasDescartado = [];

  // Orden de ruta, no de autoría: dos alias escritos en distinto orden dan la misma salida.
  for (const ruta of Object.keys(alias).sort()) {
    const destino = alias[ruta];
    if (!destino || typeof destino.endpoint !== 'string' || typeof destino.slug !== 'string') {
      aliasDescartado.push({ archivo: ruta, motivo: `el alias no trae \`endpoint\` y \`slug\` de texto: ${ruta}` });
      continue;
    }
    const info = porRuta.get(ruta);
    if (!info) {
      aliasDescartado.push({ archivo: ruta, motivo: `el alias declara un archivo que no está en el inventario: ${ruta}` });
      continue;
    }
    const cfg = ENDPOINTS_CON_MEDIO[destino.endpoint];
    if (!cfg || info.dir !== cfg.dir) {
      aliasDescartado.push({
        archivo: ruta,
        motivo: `el alias saca ${ruta} del directorio de ${destino.endpoint} (${cfg ? cfg.dir : 'endpoint fuera de la tabla'})`,
      });
      continue;
    }
    const i = registros.findIndex((r) => r.endpoint === destino.endpoint && r.slug === destino.slug);
    if (i < 0) {
      aliasDescartado.push({ archivo: ruta, motivo: `ningún registro de la lectura trae ${destino.endpoint}/${destino.slug}` });
      continue;
    }
    if (aliasFirmado.has(i)) {
      aliasDescartado.push({ archivo: ruta, motivo: `${destino.endpoint}/${destino.slug} ya tiene otro alias declarado; se ignora esta fila` });
      continue;
    }
    aliasFirmado.set(i, info);
  }

  const priorizados = registros
    .map((reg, i) => ({ reg, i, cs: candidatos(reg, infos, aliasFirmado.get(i)) }))
    // Gana lo declarado sobre lo deducible por nombre, y dentro de lo deducible lo
    // confiable antes que el sufijo; empatados, el slug más largo; empatados también,
    // el orden de entrada (determinismo reproducible).
    .sort((a, b) => (a.cs[0]?.nivel ?? SIN_CANDIDATOS) - (b.cs[0]?.nivel ?? SIN_CANDIDATOS)
      || (b.reg.slug?.length ?? 0) - (a.reg.slug?.length ?? 0)
      || a.i - b.i);

  /** archivo → slug que lo reclamó. */
  const duenio = new Map();
  /** índice de entrada → decisión, para devolver en el orden de `registros`. */
  const decidido = new Map();

  for (const { reg, i, cs } of priorizados) {
    if (!cs.length) continue; // el registro no tiene tapa producida: nada que reportar
    const libres = cs.filter((c) => !duenio.has(c.archivo));
    if (!libres.length) {
      decidido.set(i, { motivo: `la tapa ya está asignada a ${duenio.get(cs[0].archivo).slug}` });
      continue;
    }
    const gana = libres[0];
    duenio.set(gana.archivo, { slug: reg.slug });
    decidido.set(i, {
      archivo: gana.archivo,
      nivel: gana.nivel,
      notas: libres.slice(1)
        .filter((c) => c.base !== gana.base)
        .map((c) => `descartada por ambigüedad: ${c.archivo}`),
    });
  }

  const enlazar = [];
  const revisar = [];
  const ambiguos = [];
  registros.forEach((reg, i) => {
    const d = decidido.get(i);
    if (!d) return;
    if (d.motivo) {
      ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo: d.motivo });
      return;
    }
    for (const motivo of d.notas) {
      ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo });
    }
    const enlace = {
      endpoint: reg.endpoint,
      documentId: reg.documentId,
      campo: reg.campo ?? ENDPOINTS_CON_MEDIO[reg.endpoint].campo,
      archivo: d.archivo,
      ...(d.nivel === NIVEL.ALIAS ? { origen: 'alias' } : {}),
    };
    if (d.nivel === NIVEL.SUFIJO) {
      // Solo propuesta: `aplicar()` no escribe este balde. Se eleva con una fila de alias.
      revisar.push({ ...enlace, motivo: `coincidencia solo por sufijo: ${d.archivo}` });
      return;
    }
    enlazar.push(enlace);
  });

  for (const fila of aliasDescartado) revisar.push(fila);

  const pendientes = archivos.filter((a) => !duenio.has(a) && !/\.gitkeep$/.test(a));
  return { enlazar, pendientes, ambiguos, revisar };
}

/** Directorios que el inventario debe recorrer: los que la tabla declara, sin inventar. */
export function directoriosDeInventario() {
  return [...new Set(Object.values(ENDPOINTS_CON_MEDIO).map((c) => c.dir))].sort();
}

export { RAIZ };
