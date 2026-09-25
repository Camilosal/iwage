/**
 * Mapeo huérfano → registro. Puro y sin red a propósito: es la parte que decide
 * qué se sube y a quién se le asigna, y eso hay que poder revisarlo antes de
 * tocar la base de datos (F2 es la primera fase que escribe).
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
 *    en manos de un slug más largo se REPORTA en `ambiguos` con el nombre del
 *    ganador en el motivo, en vez de desaparecer.
 *
 * ---------------------------------------------------------------------------
 * Convención de nombres: la brief documenta `<marca>-<slug>.webp`. Medido en
 * disco el 2026-09-25, NINGUNA de las 36 tapas de bitácora la cumple: se llaman
 * `bitacora-<slug>.webp`, y en `cafe-menu/` conviven tres namespaces
 * (`<slug>`, `proveedor-<slug>`, `visitante-<slug>`) que son de endpoints
 * distintos. El emparejamiento, entonces, es en dos niveles:
 *
 *   · nivel 1 (confiable): el nombre base es `slug`, `<marca>-slug` o
 *     `<prefijo-del-endpoint>-slug`;
 *   · nivel 2 (sospechoso): el nombre base termina en `-slug` con un prefijo
 *     que no pertenece al endpoint. Se enlaza, pero queda marcado en `ambiguos`
 *     con el motivo `coincidencia solo por sufijo:` para que un humano lo revise
 *     antes de `--apply`.
 *
 * Nunca se enlaza un archivo que no esté en el directorio del endpoint, y un
 * archivo con dos candidatos de nombre distinto se reporta, no se elige en
 * silencio. Entre gemelos de extensión del mismo nombre base gana el .webp y el
 * .png queda en `pendientes` (esa es la lista que consume Tarea 14 para borrar
 * los duplicados).
 *
 * `archivos` se pasa con ruta relativa al repo (`public/images/<dir>/<nombre>`);
 * lo que no tenga esa forma no es reclamable y termina en `pendientes`, que es
 * el modo de fallar visible.
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

/** Candidatos de un registro, ordenados: nivel 1 antes que 2, .webp antes que .png. */
function candidatos(reg, infos) {
  const cfg = ENDPOINTS_CON_MEDIO[reg.endpoint];
  if (!cfg || !reg.slug) return [];
  const slug = reg.slug;
  const nivel1 = new Set([
    slug,
    ...(reg.marca ? [`${reg.marca}-${slug}`] : []),
    ...cfg.prefijos.map((p) => `${p}-${slug}`),
  ]);
  return infos
    .filter((i) => i.dir === cfg.dir && (i.base === slug || i.base.endsWith(`-${slug}`)))
    .map((i) => ({ ...i, nivel: nivel1.has(i.base) ? 1 : 2 }))
    .sort((a, b) => a.nivel - b.nivel || RANGO_EXT[a.ext] - RANGO_EXT[b.ext] || (a.archivo < b.archivo ? -1 : 1));
}

/**
 * @param {{ archivos: string[], registros: Array<{endpoint: string, documentId: string, slug?: string, marca?: string, campo?: string}> }} in
 * @returns {{ enlazar: Array<{endpoint: string, documentId: string, campo: string, archivo: string}>, pendientes: string[], ambiguos: Array<{slug: string, documentId: string, motivo: string}> }}
 */
export function manifesto({ archivos, registros }) {
  const infos = archivos.map(archivoInfo).filter(Boolean);
  const priorizados = registros
    .map((reg, i) => ({ reg, i, cs: candidatos(reg, infos) }))
    // Gana la coincidencia confiable sobre la de sufijo; empatadas, el slug más
    // largo; empatadas también, el orden de entrada (determinismo reproducible).
    .sort((a, b) => (a.cs[0]?.nivel ?? 9) - (b.cs[0]?.nivel ?? 9)
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
      notas: [
        ...(gana.nivel === 2 ? [`coincidencia solo por sufijo: ${gana.archivo}`] : []),
        ...libres.slice(1)
          .filter((c) => c.base !== gana.base)
          .map((c) => `descartada por ambigüedad: ${c.archivo}`),
      ],
    });
  }

  const enlazar = [];
  const ambiguos = [];
  registros.forEach((reg, i) => {
    const d = decidido.get(i);
    if (!d) return;
    for (const motivo of d.motivo ? [d.motivo] : d.notas) {
      ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo });
    }
    if (!d.archivo) return;
    enlazar.push({
      endpoint: reg.endpoint,
      documentId: reg.documentId,
      campo: reg.campo ?? ENDPOINTS_CON_MEDIO[reg.endpoint].campo,
      archivo: d.archivo,
    });
  });

  const pendientes = archivos.filter((a) => !duenio.has(a) && !/\.gitkeep$/.test(a));
  return { enlazar, pendientes, ambiguos };
}

/** Directorios que el inventario debe recorrer: los que la tabla declara, sin inventar. */
export function directoriosDeInventario() {
  return [...new Set(Object.values(ENDPOINTS_CON_MEDIO).map((c) => c.dir))].sort();
}

export { RAIZ };
