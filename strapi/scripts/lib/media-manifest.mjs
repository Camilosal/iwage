/**
 * Mapeo huérfano → registro. Puro y sin red a propósito: es la parte que decide
 * qué se sube y a quién se le asigna, y eso hay que poder revisarlo antes de
 * tocar la base de datos (F2 es la primera fase que escribe).
 *
 * Pureza medible: sin `fs`, sin `fetch`, sin `process.env`, sin `Date` ni
 * `Math.random`. Misma entrada → misma salida, incluso el orden de cada arreglo.
 * Todo lo que se recorre para producir salida se ordena antes.
 *
 * ---------------------------------------------------------------------------
 * CONTRATO DE SALIDA
 *
 * `manifesto({ archivos, registros, alias })` devuelve:
 *
 *   enlazar:    Array<{ endpoint, documentId, campo,
 *                       archivo?: string,          // cuando la unidad es UN archivo
 *                       archivos?: string[],       // cuando es una serie (ordenada)
 *                       origen?: 'alias'|'slug'|'nombre' }>
 *   pendientes: string[]
 *   revisar:    Array<{ archivo, motivo, endpoint?, documentId?, campo? }>
 *   ambiguos:   Array<{ slug, documentId, motivo }>          // RAZONES
 *   motivosAlias: Array<{ archivo, motivo }>                  // RAZONES
 *
 * 1. `campo` es propiedad del content-type, no del registro. La fuente de verdad
 *    es `ENDPOINTS_CON_MEDIO[endpoint].campo` (portada) y
 *    `ENDPOINTS_CON_MEDIO[endpoint].campoMultiple` (campo repetible). Si el
 *    llamador trae `campo` en el registro, ese manda — pero solo entre los dos de
 *    la tabla: un campo que el content-type no declara NO produce enlace, y su
 *    razón sale en `ambiguos` (o en `motivosAlias` si venía por una fila de alias
 *    por ruta). `enlazar[].campo` nunca sale `undefined` y nunca sale con un nombre
 *    que `formaDeCampo()` no conozca: si lo hiciera, el `--apply` reventaría por
 *    enlace en vez de reventar acá.
 *
 * 2. **Un enlace puede llevar varios archivos.** Una *unidad* es lo que un
 *    registro reclama de una vez: un archivo suelto, o una **serie**. El número
 *    final del nombre es un ÍNDICE de posición, no parte de la identidad:
 *    `galeria/proyecto-ambala-1.webp` y `galeria/proyecto-ambala-2.webp` son la
 *    misma unidad en dos posiciones, agrupadas por la raíz **literal** del nombre
 *    (`proyecto-ambala`). La raíz sin índice (`galeria/proyecto-ambala.webp`)
 *    abre la serie en la posición 0. La clave del grupo NO es la raíz
 *    normalizada: `normalizar` se bota tokens de parada e iniciales, no es
 *    inyectable, y dos raíces distintas (`proyecto-el-poblado`,
 *    `proyecto-poblado`) compartirían grupo. La normalización sigue siendo la
 *    identidad con la que el grupo le pertenece a un registro.
 *    El agrupamiento está condicionado al DIRECTORIO del `campoMultiple` —lo
 *    cumple `DIRS_CON_SERIE`, que es la lista de esos directorios—, que es el
 *    único destino donde tiene sentido escribir varios archivos en orden. En
 *    un endpoint sin campo repetible (`bitacoras`, `proveedors`, directorio
 *    `cafe-menu`) no hay serie posible ni serie que secuestre la portada:
 *    `cafeterias-1` y `cafeterias-2` son dos identidades distintas, cada una con
 *    su unidad de un archivo — y por eso un `-N` de `cafe-menu` sí puede
 *    reclamar por `imagen`/`foto`—; dos de ellas para el mismo registro y campo
 *    son la colisión «varias producciones», que se reporta y no se escribe.
 *    Si la unidad tiene un archivo, la entrada trae `archivo`; si tiene más de
 *    uno, trae `archivos` en el ORDEN en que hay que escribirlos (por índice
 *    numérico: `-2` antes que `-10`). Para leer los archivos de un enlace sin
 *    saber cuál caso es, usar `archivosDelEnlace(e)`.
 *    La aridad del VALOR no la decide el conteo sino la tabla: un enlace cuyo
 *    `campo` es `campoMultiple` se escribe como lista **aunque tenga un solo
 *    archivo** (es un campo repetible con una sola foto).
 *
 * 3. Un archivo solo es candidato por su nombre base o por la raíz de su serie:
 *    `proyecto-poblado-1.webp` es el archivo 1 de `proyecto-poblado` y no puede
 *    ser la identidad de un registro cuyo `slug` sea `1`. La identidad de un
 *    `producto` es su `nombre`, que a menudo termina en un número de formato
 *    real (`Miel Angelita 120ml`, `Miel con propóleo 250ml`, `Kit Observación`):
 *    ahí la frontera dígito/no-dígito de `normalizar` separa `120` de `ml`, y el
 *    índice de serie solo se mira sobre el nombre base completo
 *    (`modulo-1` es la posición 1 de `modulo`, `modulo1` es la palabra `modulo1`).
 *
 * 4. `origen` dice qué regla produjo el enlace, con una excepción histórica: el
 *    contrato literal de la brief fija `enlazar[0]` con CUATRO claves, así que
 *    `origen` se OMITE justo en ese caso (regla de `slug` sobre un solo archivo,
 *    que es lo que la brief muestra). En una serie, `origen` siempre viene.
 *    El CLI imprime el origen de cada enlace, omitido o no.
 *
 * 5. Emparejar y reclamar son dos pasos separados: primero se calculan las
 *    unidades de cada registro contra TODOS los archivos; después, en orden de
 *    prioridad, se van reclamando. Así un archivo cuyo único candidato ya está en
 *    manos de otro se REPORTA en `ambiguos` con el nombre del ganador, en vez de
 *    desaparecer.
 *
 * ---------------------------------------------------------------------------
 * IDENTIDAD — cómo un archivo llega a pertenecer a un registro, en orden.
 *
 *   nivel `ALIAS`   (0) fila declarada por un humano. Dos formas: clave = ruta
 *                     de archivo → `{endpoint, slug}` (como siempre), y clave =
 *                     `documentId` → `{endpoint, campo, archivos: [...]}`. La
 *                     segunda es la única que puede firmar un registro **sin
 *                     `slug`**, que medido en la BD es el caso de
 *                     `proyecto-meliponarios` y `cultivo-polinizaciones` (6/6 con
 *                     `slug` null) y de 3 de 14 `productos`.
 *   nivel `REGLA`   (1) el nombre base (o la raíz de la serie) es exactamente
 *                     `slug`, `<marca>-slug` o `<prefijo-del-endpoint>-slug`.
 *                     Enlace con `origen` omitido (o `'slug'` si es serie).
 *   nivel `NOMBRE`  (2) el content-type declara `identidadNombre` y los tokens
 *                     normalizados del nombre base, quitado el prefijo del
 *                     endpoint, son una parte de los tokens de `nombre`. Es la
 *                     regla que cablea `galeria/proyecto-*.webp`: medido el
 *                     2026-09-25, esos 6 registros no tienen `slug` y su
 *                     identidad real es `nombre`.
 *   nivel `SUFIJO`  (3) el nombre base TERMINA en `-slug` con un prefijo que no
 *                     pertenece al endpoint. **No se enlaza**: va a `revisar` con
 *                     el motivo `coincidencia solo por sufijo: <ruta>` y
 *                     `aplicar()` se niega a escribir ese balde.
 *
 * Normalización (nivel 2, y solo 2): minúsculas, acentos fuera (`Meliponario
 * I.E. Ambalá` → `ambala`), abreviaturas con puntos plegadas (`i.e.` → `ie`,
 * que es token de parada), fronteras letra/dígito (`modulo1` ≡ `modulo-1`,
 * `120ml` → `120 ml`), separadores no alfanuméricos, iniciales sueltas de una
 * letra y tokens de parada (`de`, `el`, `la`, `que`, …). Es la misma
 * normalización con la que se midió el artefacto de vocabulario F2.
 *
 * Por qué el nivel 2 NO se aplica a `slug`: `slug` en bitácoras es un título
 * largo y las tapas lo traen RECORTADO, así que la contención de tokens diría
 * sí en 29 de 36 casos y los 29 son los que el dueño marcó como
 * `PROPUESTA … requiere revision humana` (`.superpowers/…/alias-bitacoras-
 * propuesta.json`). Adivinar sobre un título no es una regla, es una decisión
 * de redacción: ahí solo habla una fila de alias. Por eso `identidadNombre` lo
 * declaran únicamente los content-type que TIENEN un atributo `nombre`
 * (proyecto-meliponario, producto); `bitacora` tiene `titulo`, no `nombre`, y
 * por lo tanto **cero de sus 36 tapas son enlazables por regla** — estructura,
 * no esperanza.
 *
 * ---------------------------------------------------------------------------
 * COLISIONES — ninguna se resuelve adivinando.
 *
 * · **Un archivo, varios registros** al mismo nivel de confianza: si el largo
 *   del `slug` no deja UN solo ganador, el archivo va a `revisar` con los
 *   contendores nombrados. Medido: `galeria/producto-caja-1.webp` casaba por
 *   `nombre` con `Caja AF Estándar`, `Caja INPA con atril` y `Caja INPA Nogal
 *   Cafetero` a la vez — y los tres sin `slug`, así que el desempate por largo
 *   no existe: `revisar`.
 * · **Dos archivos, un registro** (dos unidades distintas del mismo nivel para
 *   el mismo `campo` del mismo registro): ninguna gana; todos los archivos van a
 *   `revisar`. Es la forma de la colisión medida `bitacora-miel-chef` +
 *   `bitacora-miel-cocina` → un artículo que contiene `chef` y `cocina`.
 * · El desempate **por largo de slug se conserva donde fue diseñado**: dos
 *   registros que reclaman el mismo archivo a nivel `REGLA` con `slug` de
 *   distinta longitud. No es una adivinanza porque un `slug` más largo explica
 *   un nombre base más largo; en el nivel `NOMBRE` no aplica (allí la coincidencia
 *   es idéntica para todos los reclamantes) y nunca se elige por orden de entrada.
 *
 * ---------------------------------------------------------------------------
 * PARTICIÓN — los tres baldes de ARCHIVOS son una partición del inventario:
 *
 *   enlazar ∪ pendientes ∪ revisar = archivos (salvo `.gitkeep`), y disjuntos.
 *
 * Cada archivo de entrada aparece en **exactamente un** balde. Como una entrada
 * de `enlazar` puede traer varios archivos, la identidad de longitudes solo vale
 * cuando todas las unidades son de un archivo; la contabilidad que hay que leer
 * es por archivos: `archivosDelEnlace` + `pendientes` + `revisar` cubren el
 * inventario sin repetir ninguno. `ambiguos` y `motivosAlias` son listas de
 * RAZONES, no de archivos: se imprimen y se revisan, pero no suman.
 * `pendientes` se filtra contra el conjunto de archivos que ya tienen balde, y
 * una serie bloqueada arrastra a `revisar` a TODOS sus miembros (si el par 1 está
 * en disputa, el par 2 no puede quedar como si no existiera: eso fue justo lo
 * que hacía escribir una galería de un elemento).
 *
 * Nunca se enlaza un archivo que no esté en el directorio del endpoint — ni por
 * regla ni por alias, que fija el emparejamiento pero no abre esa puerta. Entre
 * gemelos de extensión del mismo nombre gana el .webp y el .png queda en
 * `pendientes` (esa lista la consume Tarea 14 para borrar duplicados).
 *
 * `archivos` se pasa con ruta relativa al repo (`public/images/<dir>/<nombre>`);
 * lo que no tenga esa forma no es reclamable y termina en `pendientes`, que es el
 * modo de fallar visible.
 *
 * ---------------------------------------------------------------------------
 * ALIAS — el mecanismo para los emparejamientos que ninguna regla alcanza.
 *
 *   manifesto({ archivos, registros, alias })
 *
 *   alias: {
 *     // forma 1 — clave = ruta, registro nombrado por endpoint + slug:
 *     'public/images/bitacora/bitacora-caso-don-manuel.webp':
 *       { endpoint: 'bitacoras', slug: 'caso-la-finca-de-don-manuel' },
 *     // forma 2 — clave = documentId, destino explícito y lista ORDENADA:
 *     '<documentId del proyecto, de la lectura>': {
 *       endpoint: 'proyecto-meliponarios', campo: 'galeria',
 *       archivos: ['public/images/galeria/proyecto-ambala-1.webp',
 *                  'public/images/galeria/proyecto-ambala-2.webp'],
 *     },
 *   }
 *
 * · la forma se decide por la CLAVE: si tiene la forma de ruta del inventario es
 *   fila por ruta (la de siempre); cualquier otra clave es un `documentId`;
 * · una fila por `documentId` trae el destino explícito (`endpoint`, `campo`,
 *   `archivos` no vacío y en el orden en que hay que escribirlos): como puede
 *   escribir un campo repetible, no se le deja adivinar el campo;
 * · el `documentId` de una fila por ruta lo aporta la lectura de la API, nunca
 *   el alias: un alias no puede inventar un id;
 * · un alias se resuelve en el nivel más alto y su enlace sale etiquetado con
 *   `origen: 'alias'`;
 * · una fila que no se puede firmar (el archivo no está en el inventario, ningún
 *   registro trae ese endpoint/slug o ese documentId, el campo no es un campo de
 *   medio de la tabla, la ruta cae fuera del directorio del endpoint, el archivo
 *   está en otra fila, o el registro ya tiene otra fila para ese campo) NO
 *   escribe nada: su motivo va a `motivosAlias` con la razón exacta.
 *   `motivosAlias` **no es un balde de archivos** (ver PARTICIÓN arriba).
 *
 * DE DÓNDE TIENE QUE SALIR EL VOCABULARIO: de la lectura de SOLO LECTURA que ya
 * está medida en `.superpowers/sdd/2026-09-24-media-strapi-consolidation/
 * f2-vocabulario-medido.md` (slugs, documentIds y nombres reales). Las 29 filas
 * de tapas de bitácora siguen siendo una PROPUESTA que necesita la revisión del
 * dueño: el envase del repo, `strapi/scripts/media-alias.json`, se shippea sin
 * ninguna fila real.
 */

const RAIZ = 'public/images';
const RE_RUTA = /^public\/images\/([^/]+)\/([^/]+)$/;
/** Base de un archivo de serie: `<raíz>-<índice>`. El índice es el orden del campo repetible. */
const RE_SERIE = /^(.*)-(\d+)$/;

/**
 * Unidades de negocio que tienen un campo de portada —y en su caso un campo
 * repetible— y directorio de arte producido. Datos verificados, no inventados:
 *   · endpoint  = `info.pluralName` del schema de cada content-type
 *     (strapi/src/api/<ct>/content-types/<ct>/schema.json), que es la ruta REST
 *     real (proveedor → `proveedors`, no `proveedores`;
 *     proyecto-meliponario → `proyecto-meliponarios`, no `proyectos`).
 *   · campo     = nombre del atributo de portada en ese esquema.
 *   · dir       = directorio que EXISTE en public/images/; las tapas de
 *     visitante y proveedor viven dentro de `cafe-menu/`.
 *   · prefijos  = namespaces de nombre que pertenece al endpoint.
 *   · tieneMarca = el content-type tiene atributo `marca` (bitácora y producto),
 *     así que solo ahí se pide en `fields`.
 *   · campoForma / multipleForma = tipo ACTUAL del atributo en el esquema:
 *     `string` o `json` → ruta relativa de sitio; `media` → id de archivo.
 *     Define la forma del cuerpo del PUT. La Tarea 11 los convirtió (commit
 *     `fa240b2`): medido sobre los 22 `schema.json`, hoy los seis endpoints de
 *     esta tabla tienen portada y galería como `media`, así que las dos columnas
 *     valen `media` en todas las filas y lo que se manda es el `id` del archivo.
 *     No es una transcripción al día por buena voluntad: `tests/
 *     media-manifest.test.mjs` lee los 22 `schema.json` y revienta si una columna
 *     y el esquema difieren, así que mover el esquema sin mover la tabla se ve en
 *     `npm test` y no en el primer `--apply` contra producción.
 *   · identidadNombre = el content-type tiene un atributo `nombre` que funciona
 *     como identidad. La restringimos a donde hay arte PRODUCIDO en su directorio
 *     (medido: `galeria/`), no a donde el atributo existe: `nombre` lo declaran
 *     también proveedor, item-menu, complemento, anfitrion, cultivo-polinizacion,
 *     configuracion-sitio y testimonio, y en esos endpoints no hay archivo que
 *     emparejar — prenderla ahí sería ampliar la superficie de falsos positivos
 *     sin nada que ganar. `bitacora` ni siquiera tiene `nombre`: tiene `titulo`,
 *     y un título no es una identidad emparejable.
 *   · campoMultiple = el atributo repetible donde van las SERIES de arte
 *     (esquema actual: `media` multiple, con `allowedTypes` imágenes y videos).
 *     `cultivo-polinizaciones` también tiene `nombre` + `galeria`, pero en el
 *     inventario medido NO hay ningún archivo `cultivo-*`: declararlo sería
 *     configuración muerta, así que no está en la tabla hasta que haya arte.
 */
export const ENDPOINTS_CON_MEDIO = {
  bitacoras: { dir: 'bitacora', campo: 'imagen', campoForma: 'media', prefijos: ['bitacora'], tieneMarca: true },
  'historia-visitantes': { dir: 'cafe-menu', campo: 'imagen', campoForma: 'media', prefijos: ['visitante'], tieneMarca: false },
  proveedors: { dir: 'cafe-menu', campo: 'foto', campoForma: 'media', prefijos: ['proveedor'], tieneMarca: false },
  'item-menus': { dir: 'cafe-menu', campo: 'imagen', campoForma: 'media', prefijos: [], tieneMarca: false },
  'proyecto-meliponarios': {
    dir: 'galeria', campo: 'imagen', campoForma: 'media', prefijos: ['proyecto'], tieneMarca: false,
    identidadNombre: true, campoMultiple: 'galeria', multipleForma: 'media',
  },
  productos: {
    dir: 'galeria', campo: 'imagen', campoForma: 'media', prefijos: ['producto'], tieneMarca: true,
    identidadNombre: true, campoMultiple: 'galeria', multipleForma: 'media',
  },
};

/** Preferencia de formato: el .webp es el activo canónico; .png es su gemelo. */
const RANGO_EXT = { webp: 0, png: 1, jpg: 2, jpeg: 3 };

/**
 * Restricción de las SERIES (CONTRATO 2): un grupo de archivos que comparten
 * raíz solo se lee como serie (y se escribe de una vez) en los directorios donde
 * la tabla declara un campo repetible. Fuera de esos directorios no hay destino
 * posible para varios archivos de un mismo tema, así que `-1` y `-2` siguen
 * siendo dos identidades distintas, cada una con su unidad de un archivo;
 * agruparlas ahí sería secuestrar la portada de un registro.
 */
const DIRS_CON_SERIE = new Set(
  Object.values(ENDPOINTS_CON_MEDIO).filter((c) => c.campoMultiple).map((c) => c.dir),
);

/** Origen de un emparejamiento, en orden de confianza. También es el orden de reclamo. */
const NIVEL = { ALIAS: 0, REGLA: 1, NOMBRE: 2, SUFIJO: 3 };
const ORIGEN_DEL_NIVEL = { [NIVEL.ALIAS]: 'alias', [NIVEL.REGLA]: 'slug', [NIVEL.NOMBRE]: 'nombre', [NIVEL.SUFIJO]: 'slug' };
/** Orden de un registro sin ninguna unidad: reclama después de todos (no reclama). */
const SIN_CANDIDATOS = 9;

/**
 * Tokens de parada de la normalización: artículos, preposiciones, conjunciones,
 * pronombres y la abreviatura que deja `I.E.` plegado. No incluyen `san` ni
 * `don`, que son parte del nombre propio y quitarlos abriría falsos positivos.
 */
const STOP_TOKENS = new Set([
  'a', 'al', 'ante', 'bajo', 'cabe', 'con', 'contra', 'desde', 'en', 'entre', 'hacia', 'hasta',
  'mediante', 'por', 'para', 'sin', 'sobre', 'tras', 'y', 'e', 'o', 'u',
  'de', 'del', 'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas',
  'que', 'se', 'su', 'sus', 'le', 'les', 'me', 'te', 'nos', 'os', 'si',
  'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'esos', 'esas',
  'muy', 'mas', 'como', 'cuando', 'donde', 'ie',
]);

const RE_LETRA_o_DIGITO = /[^\p{L}\p{N}]+/gu;
const RE_INICIAL_SUELTA = /^\p{L}$/u;

/**
 * Normaliza una identidad (`slug`, `nombre`) o un nombre base de archivo a la
 * lista de tokens con la que se compara en el nivel `NOMBRE`.
 */
function normalizar(texto) {
  if (typeof texto !== 'string' || !texto) return [];
  const pelado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(?<=\p{L})\.(?=\p{L})/gu, ''); // `i.e.` → `ie`, `E.F.M.` → `efm`
  return pelado
    .replace(/(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/gu, ' ') // `modulo1` ≡ `modulo-1`
    .split(RE_LETRA_o_DIGITO)
    .filter(Boolean)
    .filter((t) => !RE_INICIAL_SUELTA.test(t) && !STOP_TOKENS.has(t));
}

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

/** Etiqueta legible de un registro para los motivos: `slug`, si no `nombre`, si no el id. */
function etiqueta(reg) {
  return reg.slug ?? reg.nombre ?? reg.documentId;
}

/**
 * Campos de medio que la tabla declara para un endpoint. Única fuente para
 * validar un `campo` venga por la vía que venga (contrato 1): la fila de alias ya
 * lo consultaba, la vía de regla no, y un override del llamador con un campo que
 * el content-type no tiene no es un enlace, es un 400 en el primer `--apply`.
 */
function camposDeTabla(cfg) {
  return [cfg.campo, cfg.campoMultiple].filter(Boolean);
}

/** Identidad de un archivo o de una serie: los crudos comparables y sus tokens. */
function identidadDe(crudos, tokens) {
  return { crudos: [...new Set(crudos)].sort(), tokens };
}

/** Tokens del nombre base sin el namespace del endpoint; `null` si no trae ninguno. */
function residuoDeTokens(tokens, cfg) {
  if (!cfg.prefijos.length || !tokens.length) return null;
  for (const p of cfg.prefijos) {
    const [primero] = normalizar(p);
    if (primero && tokens[0] === primero) return tokens.slice(1);
  }
  return null;
}

/**
 * Nivel de confianza con el que una identidad de archivo le pertenece a un
 * registro, o `null` si no le pertenece. El orden es el del bloque IDENTIDAD.
 */
function nivelDe(identidad, reg, cfg) {
  if (reg.slug) {
    const exactas = new Set([
      reg.slug,
      ...(reg.marca ? [`${reg.marca}-${reg.slug}`] : []),
      ...cfg.prefijos.map((p) => `${p}-${reg.slug}`),
    ]);
    if (identidad.crudos.some((c) => exactas.has(c))) return NIVEL.REGLA;
  }
  if (cfg.identidadNombre && reg.nombre) {
    const residuo = residuoDeTokens(identidad.tokens, cfg);
    if (residuo && residuo.length) {
      const nombre = new Set(normalizar(reg.nombre));
      if (residuo.every((t) => nombre.has(t))) return NIVEL.NOMBRE;
    }
  }
  if (reg.slug && identidad.crudos.some((c) => c.endsWith(`-${reg.slug}`))) return NIVEL.SUFIJO;
  return null;
}

/**
 * Series del inventario, por directorio. Un grupo es una serie cuando al menos un
 * miembro trae el índice `-N` y el directorio está en `DIRS_CON_SERIE`; la clave
 * del grupo es la raíz LITERAL del nombre, sin el índice, y la identidad que se
 * compara contra el registro es su forma normalizada (`cafeterias-1` y
 * `cafeterias-2` son la misma unidad; `cafeterias.webp` es la posición 0). La
 * clave no puede ser la raíz normalizada: `normalizar` no es inyectable, así que
 * dos raíces distintas compartirían grupo y, con el mismo índice, slot — qué
 * archivo se enlazaba quedaría en manos del orden del directorio. Por posición
 * gana la extensión preferida, y el gemelo descartado no es candidato de nadie:
 * queda en `pendientes`. El índice nunca es identidad: `1` no puede ser el `slug`
 * de un registro.
 *
 * Devuelve `{ series, miembros }`: `series` son las unidades ordenadas por
 * directorio y `miembros` el conjunto de TODOS los archivos que entraron en un
 * grupo que resultó serie —ganadores y gemelos perdedores—, para que el colapso
 * de archivos sueltos no vuelva a ofrecerlos como candidatos independientes.
 */
function agruparSeries(infos) {
  const porDir = new Map();
  for (const i of infos) {
    const conIndice = RE_SERIE.exec(i.base);
    const raiz = conIndice ? conIndice[1] : i.base;
    const indice = conIndice ? Number(conIndice[2]) : null;
    // Clave = la RAÍZ LITERAL, nunca la normalizada (C1/I3): `normalizar` se bota
    // tokens de parada e iniciales, así que NO es inyectable y `proyecto-el-poblado`
    // y `proyecto-poblado` compartirían slot — qué archivo se enlazaba quedaba en
    // manos del orden de `readdirSync`, y con índices distintos se fundían en una
    // sola galería. La raíz normalizada sigue siendo la IDENTIDAD que se compara
    // contra el registro (`tokens`); solo deja de ser la llave del grupo.
    const tokens = normalizar(raiz);
    if (!tokens.length) continue;
    let porClave = porDir.get(i.dir);
    if (!porClave) {
      porClave = new Map();
      porDir.set(i.dir, porClave);
    }
    let grupo = porClave.get(raiz);
    if (!grupo) {
      grupo = { crudos: new Set([raiz]), slots: new Map(), todos: [], indiceVisto: false, tokens };
      porClave.set(raiz, grupo);
    }
    grupo.crudos.add(raiz);
    grupo.todos.push(i);
    if (indice !== null) grupo.indiceVisto = true;
    const slot = indice ?? -1; // la raíz pelada abre la serie; los demás, por índice
    const actual = grupo.slots.get(slot);
    // Con la clave literal, dos archivos DISTINTOS ya no pueden pelearse un slot
    // (haría falta el mismo `dir` + raíz + índice + extensión, o sea la misma
    // ruta), pero el desempate por ruta se queda: `archivos` lo pone el llamador y
    // una ruta repetida dos veces no tiene por qué ganarse por orden de llegada.
    if (!actual || RANGO_EXT[i.ext] < RANGO_EXT[actual.ext]
      || (RANGO_EXT[i.ext] === RANGO_EXT[actual.ext] && i.archivo < actual.archivo)) {
      grupo.slots.set(slot, i);
    }
  }
  const series = new Map();
  /** todos los archivos de un grupo que SÍ es serie, incluidos los gemelos perdedores */
  const miembros = new Set();
  for (const [dir, porClave] of [...porDir].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // CONTRATO 2, y ahora de verdad: fuera de los directorios con campo repetible
    // no hay serie (I2). `cafeterias-1` y `cafeterias-2` siguen siendo dos
    // identidades distintas de un archivo cada una, y los dos se quedan en
    // `soltadas`, donde sí pueden reclamar por `imagen`/`foto` o reportarse como
    // colisión — en vez de desaparecer del inventario en silencio.
    if (!DIRS_CON_SERIE.has(dir)) continue;
    const salidas = [];
    for (const [clave, g] of [...porClave].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (!g.indiceVisto) continue; // no es una serie: son archivos sueltos
      const archivos = [...g.slots.entries()]
        .sort((a, b) => a[0] - b[0] || RANGO_EXT[a[1].ext] - RANGO_EXT[b[1].ext] || (a[1].archivo < b[1].archivo ? -1 : 1))
        .map(([, i]) => i.archivo);
      for (const i of g.todos) miembros.add(i.archivo);
      salidas.push({ dir, clave, crudos: [...g.crudos], tokens: g.tokens, archivos });
    }
    if (salidas.length) series.set(dir, salidas);
  }
  return { series, miembros };
}

/**
 * @param {{
 *   archivos: string[],
 *   registros: Array<{endpoint: string, documentId: string, slug?: string, nombre?: string, marca?: string, campo?: string}>,
 *   alias?: Record<string, {endpoint: string, slug: string} | {endpoint: string, campo: string, archivos: string[]}>
 * }} in rutas de archivo → registro declarado, o `{}` / ausente si no hay alias
 * @returns {{
 *   enlazar: Array<{endpoint: string, documentId: string, campo: string, archivo?: string, archivos?: string[], origen?: string}>,
 *   pendientes: string[],
 *   revisar: Array<{archivo: string, motivo: string, endpoint?: string, documentId?: string, campo?: string}>,
 *   ambiguos: Array<{slug: string|undefined, documentId: string, motivo: string}>,
 *   motivosAlias: Array<{archivo: string, motivo: string}>
 * }}
 */
export function manifesto({ archivos, registros, alias = {} }) {
  const infos = archivos.map(archivoInfo).filter(Boolean);
  const porRuta = new Map(infos.map((i) => [i.archivo, i]));
  const { series, miembros } = agruparSeries(infos);
  /**
   * Archivos sueltos, UNO por `<dir>/<base>`: entre gemelos de extensión del mismo
   * nombre gana el de extensión preferida (el .webp sobre el .png) y el perdedor no
   * es candidato de nadie, así que cae en `pendientes` — la lista que consume la
   * Tarea 14 para borrar duplicados. Sin este paso los dos gemelos formarían dos
   * unidades del mismo nivel sobre el mismo campo y la colisión sería falsa.
   */
  const soltadas = [];
  {
    const porBase = new Map();
    for (const i of infos) {
      if (miembros.has(i.archivo)) continue;
      const clave = `${i.dir}/${i.base}`;
      const actual = porBase.get(clave);
      if (!actual || RANGO_EXT[i.ext] < RANGO_EXT[actual.ext]) porBase.set(clave, i);
    }
    soltadas.push(...[...porBase.values()].sort((a, b) => (a.archivo < b.archivo ? -1 : 1)));
  }

  /** unidades por índice de registro, y los motivos de las filas que no se firmaron */
  const unidadesPorRegistro = new Map();
  const motivosAlias = [];
  const agregarUnidad = (i, unidad) => {
    const lista = unidadesPorRegistro.get(i) ?? [];
    lista.push(unidad);
    unidadesPorRegistro.set(i, lista);
  };
  /** otra fila de alias del mismo registro ya ocupa ese campo */
  const filaRepitida = (i, campo) => (unidadesPorRegistro.get(i) ?? [])
    .find((u) => u.nivel === NIVEL.ALIAS && u.campo === campo);

  // --- 1. ALIAS. Orden de clave, no de autoría: dos alias escritos en distinto
  //         orden dan la misma salida.
  const aliasPorArchivo = new Set();
  for (const clave of Object.keys(alias).sort()) {
    const fila = alias[clave];
    const porRutaKey = RE_RUTA.test(clave);
    if (!fila || typeof fila !== 'object' || typeof fila.endpoint !== 'string') {
      motivosAlias.push({
        archivo: clave,
        motivo: porRutaKey
          ? `el alias no trae \`endpoint\` y \`slug\` de texto: ${clave}`
          : `la fila de alias de ${clave} no trae \`endpoint\` de texto`,
      });
      continue;
    }
    const cfg = ENDPOINTS_CON_MEDIO[fila.endpoint];
    if (!cfg) {
      motivosAlias.push({ archivo: clave, motivo: `el alias apunta a un endpoint fuera de la tabla: ${fila.endpoint}` });
      continue;
    }
    const campos = camposDeTabla(cfg);
    let rutas;
    let i;
    if (porRutaKey) {
      if (typeof fila.slug !== 'string') {
        motivosAlias.push({ archivo: clave, motivo: `el alias no trae \`endpoint\` y \`slug\` de texto: ${clave}` });
        continue;
      }
      const info = porRuta.get(clave);
      if (!info) {
        motivosAlias.push({ archivo: clave, motivo: `el alias declara un archivo que no está en el inventario: ${clave}` });
        continue;
      }
      if (info.dir !== cfg.dir) {
        motivosAlias.push({
          archivo: clave,
          motivo: `el alias saca ${clave} del directorio de ${fila.endpoint} (${cfg.dir})`,
        });
        continue;
      }
      rutas = [clave];
      i = registros.findIndex((r) => r.endpoint === fila.endpoint && r.slug === fila.slug);
    } else {
      const campo = fila.campo;
      if (typeof campo !== 'string' || !campos.includes(campo)) {
        motivosAlias.push({ archivo: clave, motivo: `la fila de ${clave} declara un campo que la tabla no conoce: ${String(campo)}` });
        continue;
      }
      if (!Array.isArray(fila.archivos) || !fila.archivos.length || fila.archivos.some((a) => typeof a !== 'string' || !a)) {
        motivosAlias.push({ archivo: clave, motivo: `la fila de ${clave} no trae \`archivos\` como lista no vacía de rutas` });
        continue;
      }
      if (fila.archivos.length > 1 && campo !== cfg.campoMultiple) {
        motivosAlias.push({
          archivo: clave,
          motivo: `la fila de ${clave} trae ${fila.archivos.length} archivos para ${campo}, que no es un campo repetible de ${fila.endpoint}`,
        });
        continue;
      }
      rutas = [];
      let roto = null;
      for (const a of fila.archivos) {
        const info = porRuta.get(a);
        if (!info) { roto = `el alias declara un archivo que no está en el inventario: ${a}`; break; }
        if (info.dir !== cfg.dir) { roto = `el alias saca ${a} del directorio de ${fila.endpoint} (${cfg.dir})`; break; }
        if (aliasPorArchivo.has(a)) { roto = `${a} ya está declarado en otra fila de alias`; break; }
        rutas.push(a);
      }
      if (roto) { motivosAlias.push({ archivo: clave, motivo: roto }); continue; }
      i = registros.findIndex((r) => r.endpoint === fila.endpoint && r.documentId === clave);
    }
    if (i < 0) {
      motivosAlias.push({
        archivo: clave,
        motivo: porRutaKey
          ? `ningún registro de la lectura trae ${fila.endpoint}/${fila.slug}`
          : `ningún registro de la lectura trae el documentId ${clave} en ${fila.endpoint}`,
      });
      continue;
    }
    const campo = porRutaKey ? registros[i].campo ?? cfg.campo : fila.campo;
    if (porRutaKey && registros[i].campo !== undefined && !campos.includes(campo)) {
      motivosAlias.push({
        archivo: clave,
        motivo: `el registro trae un campo que la tabla no conoce para ${fila.endpoint}: ${String(campo)}`,
      });
      continue;
    }
    const repetida = filaRepitida(i, campo);
    if (repetida) {
      motivosAlias.push({
        archivo: clave,
        motivo: `el registro ya tiene otra fila de alias para ${campo}: ${repetida.clave}`,
      });
      continue;
    }
    const duplicada = rutas.find((a) => aliasPorArchivo.has(a));
    if (duplicada) { motivosAlias.push({ archivo: clave, motivo: `${duplicada} ya está declarado en otra fila de alias` }); continue; }
    for (const a of rutas) aliasPorArchivo.add(a);
    agregarUnidad(i, {
      nivel: NIVEL.ALIAS,
      campo,
      archivos: rutas,
      clave: porRutaKey ? clave : `${clave}:${campo}`,
      mejorExt: Math.min(...rutas.map((a) => RANGO_EXT[porRuta.get(a).ext])),
      idLen: 0,
    });
  }

  // --- 2. Unidades deducibles por nombre (REGLA / NOMBRE / SUFIJO).
  /** registro → motivo de un `campo` que la tabla no declara (contrato 1, I5) */
  const rechazosPorRegistro = new Map();
  registros.forEach((reg, i) => {
    const cfg = ENDPOINTS_CON_MEDIO[reg.endpoint];
    if (!cfg) return;
    // Contrato 1: "`campo` es propiedad del content-type". Si el llamador trae el
    // suyo, manda — pero solo entre los campos de medio que la tabla declara para
    // ese endpoint. Uno inventado no es un enlace: es un 400 en el primer `--apply`
    // (y en `--dry-run`, un manifiesto que miente). La vía del alias ya lo validaba;
    // esta es la misma pregunta, al revés.
    if (reg.campo !== undefined && !camposDeTabla(cfg).includes(reg.campo)) {
      rechazosPorRegistro.set(i, `el registro trae un campo que la tabla no conoce para ${reg.endpoint}: ${String(reg.campo)}`);
      return;
    }
    const salida = [];
    if (cfg.campoMultiple) {
      for (const g of series.get(cfg.dir) ?? []) {
        const nivel = nivelDe(identidadDe(g.crudos, g.tokens), reg, cfg);
        if (nivel === null) continue;
        salida.push({
          nivel,
          campo: reg.campo ?? cfg.campoMultiple,
          archivos: g.archivos,
          clave: g.clave,
          mejorExt: Math.min(...g.archivos.map((a) => RANGO_EXT[porRuta.get(a).ext])),
          idLen: nivel === NIVEL.REGLA || nivel === NIVEL.SUFIJO ? reg.slug.length : 0,
        });
      }
    }
    for (const info of soltadas.filter((x) => x.dir === cfg.dir)) {
      const nivel = nivelDe(identidadDe([info.base], normalizar(info.base)), reg, cfg);
      if (nivel === null) continue;
      salida.push({
        nivel,
        campo: reg.campo ?? cfg.campo,
        archivos: [info.archivo],
        clave: info.base,
        mejorExt: RANGO_EXT[info.ext],
        idLen: nivel === NIVEL.REGLA || nivel === NIVEL.SUFIJO ? reg.slug.length : 0,
      });
    }
    const lista = unidadesPorRegistro.get(i) ?? [];
    unidadesPorRegistro.set(i, lista.concat(salida));
  });

  const ordenUnidades = (a, b) => a.nivel - b.nivel || a.mejorExt - b.mejorExt || (a.clave < b.clave ? -1 : 1);
  for (const [i, lista] of unidadesPorRegistro) {
    unidadesPorRegistro.set(i, lista.slice().sort(ordenUnidades));
  }

  const duenio = new Map();          // archivo → registro que lo reclamó
  const revisarPorArchivo = new Map(); // archivo → entrada del balde
  const enlacesPorRegistro = new Map();
  const notasPorRegistro = new Map();
  /** un archivo ya tiene balde (enlace, propuesta o bloqueo): no se toca dos veces */
  const ocupado = (a) => duenio.has(a) || revisarPorArchivo.has(a);
  const marcar = (archivo, motivo, extra) => {
    if (ocupado(archivo)) return;
    const { endpoint, documentId, campo } = extra ?? {};
    revisarPorArchivo.set(archivo, {
      archivo,
      ...(endpoint === undefined ? {} : { endpoint }),
      ...(documentId === undefined ? {} : { documentId }),
      ...(campo === undefined ? {} : { campo }),
      motivo,
    });
  };

  // --- 3. Disputas: un archivo reclamado por varios registros sin desempate claro.
  const reclamos = new Map();
  registros.forEach((reg, i) => {
    for (const u of unidadesPorRegistro.get(i) ?? []) {
      for (const a of u.archivos) {
        const lista = reclamos.get(a) ?? [];
        lista.push({ i, nivel: u.nivel, idLen: u.idLen, campo: u.campo });
        reclamos.set(a, lista);
      }
    }
  });
  const enDisputa = new Map();
  for (const [archivo, rs] of [...reclamos].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const nivel = Math.min(...rs.map((r) => r.nivel));
    const delNivel = rs.filter((r) => r.nivel === nivel);
    if (delNivel.length < 2) continue;
    // El largo del slug solo desempata donde fue diseñado (identidad por slug).
    const mejor = Math.max(...delNivel.map((r) => r.idLen));
    const punteros = delNivel.filter((r) => r.idLen === mejor);
    if (mejor > 0 && punteros.length === 1) continue;
    const nombres = delNivel.map((r) => `${registros[r.i].endpoint}/${registros[r.i].documentId}`).join(', ');
    const campos = [...new Set(delNivel.map((r) => r.campo))];
    const endpoints = [...new Set(delNivel.map((r) => registros[r.i].endpoint))];
    // Ninguno de los contendores escribe: el archivo se va a `revisar` con ellos nombrados.
    marcar(archivo, `varios registros reclaman el mismo archivo sin que la identidad lo desempate: ${nombres}`, {
      endpoint: endpoints.length === 1 ? endpoints[0] : undefined,
      documentId: undefined, // no hay UN destinatario: esa es la definición de la disputa
      campo: campos.length === 1 ? campos[0] : undefined,
    });
    enDisputa.set(archivo, delNivel.map((r) => r.i));
  }

  // --- 4. Reclamo, en orden de prioridad: declarado antes que deducible, y dentro
  //         de lo deducible por nivel de confianza; empatados, el slug más largo
  //         (solo donde eso significa algo); empatados también, el orden de entrada
  //         — que a estas alturas solo ordena el recorrido, porque una coincidencia
  //         sin desempate real ya está bloqueada arriba como disputa.
  const priorizados = registros
    .map((reg, i) => ({ reg, i, us: unidadesPorRegistro.get(i) ?? [] }))
    .sort((a, b) => (a.us[0]?.nivel ?? SIN_CANDIDATOS) - (b.us[0]?.nivel ?? SIN_CANDIDATOS)
      || (b.reg.slug?.length ?? 0) - (a.reg.slug?.length ?? 0)
      || a.i - b.i);

  for (const { reg, i, us } of priorizados) {
    if (!us.length) continue;
    const campos = [...new Set(us.map((u) => u.campo))].sort();
    const notas = [];
    const enlaces = [];
    for (const campo of campos) {
      const delCampo = us.filter((u) => u.campo === campo);
      // Una serie con UN archivo en disputa no puede escribirse a medias: todos sus
      // miembros van a `revisar` (dejar el par 2 en `pendientes` era justo lo que
      // hacía escribir una galería de un elemento).
      for (const u of delCampo.filter((x) => x.archivos.some((a) => enDisputa.has(a)))) {
        const motivo = `serie bloqueada por un archivo en disputa: ${u.archivos.filter((a) => enDisputa.has(a)).join(', ')}`;
        for (const a of u.archivos) {
          marcar(a, motivo, { endpoint: reg.endpoint, documentId: reg.documentId, campo });
        }
      }
      const firmes = delCampo.filter((u) => !u.archivos.some((a) => enDisputa.has(a)));
      if (!firmes.length) {
        // Cada archivo de la unidad ya está en `revisar` con su disputa nombrada.
        continue;
      }
      const libres = firmes.filter((u) => u.archivos.every((a) => !ocupado(a)));
      if (!libres.length) {
        const perdido = firmes[0].archivos.find((a) => ocupado(a));
        const dueno = duenio.get(perdido);
        notas.push(`la tapa ya está asignada a ${dueno ? etiqueta(dueno) : `un archivo pasado a revisar (${perdido})`}`);
        continue;
      }
      const nivel = libres[0].nivel;
      const rivales = libres.filter((u) => u.nivel === nivel);
      if (rivales.length > 1) {
        // Dos producciones para el mismo registro y el mismo campo: no se elige.
        for (const u of rivales) {
          for (const a of u.archivos) {
            marcar(a, `varias producciones reclaman ${etiqueta(reg)} en ${campo}: ${rivales.map((r) => r.clave).join(', ')}`, {
              endpoint: reg.endpoint, documentId: reg.documentId, campo,
            });
          }
        }
        continue;
      }
      const gana = rivales[0];
      if (gana.nivel === NIVEL.SUFIJO) {
        // Solo propuesta: `aplicar()` no escribe este balde. Se eleva con una fila de alias.
        for (const a of gana.archivos) {
          marcar(a, `coincidencia solo por sufijo: ${a}`, { endpoint: reg.endpoint, documentId: reg.documentId, campo });
        }
      } else {
        enlaces.push({
          endpoint: reg.endpoint,
          documentId: reg.documentId,
          campo,
          ...(gana.archivos.length > 1 ? { archivos: gana.archivos } : { archivo: gana.archivos[0] }),
          ...(marcaOrigen(gana.nivel, gana.archivos) ?? {}),
        });
      }
      // Anotado el balde, el archivo deja de estar disponible: así un `revisar` por
      // sufijo no cae también en `pendientes` y los reclamantes que pierden se nombran.
      for (const a of gana.archivos) duenio.set(a, reg);
      for (const u of libres.filter((x) => x.nivel > gana.nivel)) {
        notas.push(`descartada por ambigüedad: ${u.archivos.join(' + ')}`);
      }
    }
    if (enlaces.length) enlacesPorRegistro.set(i, enlaces);
    if (notas.length) notasPorRegistro.set(i, notas);
  }

  // --- 5. Salida, en el orden de `registros` para lo referido a registros y por
  //         ruta para los baldes de archivos.
  const enlazar = [];
  const ambiguos = [];
  registros.forEach((reg, i) => {
    for (const e of enlacesPorRegistro.get(i) ?? []) enlazar.push(e);
    // Un `campo` rechazado (I5) se nombra acá: `ambiguos` es lista de RAZONES, no de
    // archivos, así que los archivos del registro siguen cayendo a su balde normal
    // (`pendientes`) y la PARTICIÓN no se entera.
    const rechazo = rechazosPorRegistro.get(i);
    if (rechazo) ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo: rechazo });
    for (const motivo of notasPorRegistro.get(i) ?? []) {
      ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo });
    }
  });
  const revisar = [...revisarPorArchivo.values()].sort((a, b) => (a.archivo < b.archivo ? -1 : 1));

  // PARTICIÓN (ver header): un archivo, un balde. `duenio` anota todo archivo
  // reclamado —enlazado o pasado a `revisar` por sufijo—, `marcar` anota los
  // bloqueados, y `pendientes` se filtra además contra el conjunto baldado.
  const conBalde = new Set([
    ...duenio.keys(),
    ...enlazar.flatMap(archivosDelEnlace),
    ...revisar.map((r) => r.archivo),
  ]);
  const pendientes = archivos
    .filter((a) => !conBalde.has(a) && !/\.gitkeep$/.test(a))
    .sort(); // Mi1: el último balde que quedaba en el orden del llamador
  return { enlazar, pendientes, ambiguos, revisar, motivosAlias };
}

/**
 * Marcador de origen de un enlace. Se OMITE solo en el caso que fija el
 * contrato literal de la brief: regla de `slug` sobre un único archivo. En una
 * serie el origen siempre va, incluso cuando es `slug`.
 */
function marcaOrigen(nivel, archivos) {
  const origen = ORIGEN_DEL_NIVEL[nivel];
  if (origen === 'slug' && archivos.length === 1) return null;
  return { origen };
}

/** Los archivos de una entrada de `enlazar`, en el orden en que hay que escribirlos. */
export function archivosDelEnlace(enlace) {
  return enlace.archivos ?? [enlace.archivo];
}

/** Forma actual del atributo en el esquema: `string`, `json` o `media`; `null` si el campo no es de medio. */
export function formaDeCampo(endpoint, campo) {
  const cfg = ENDPOINTS_CON_MEDIO[endpoint];
  if (!cfg) return null;
  if (campo === cfg.campo) return cfg.campoForma;
  if (cfg.campoMultiple && campo === cfg.campoMultiple) return cfg.multipleForma;
  return null;
}

/** Si el campo es el repetible del endpoint: lo que decide escribir lista o escalar. */
export function esCampoMultiple(endpoint, campo) {
  const cfg = ENDPOINTS_CON_MEDIO[endpoint];
  return !!cfg && !!cfg.campoMultiple && cfg.campoMultiple === campo;
}

/** Directorios que el inventario debe recorrer: los que la tabla declara, sin inventar. */
export function directoriosDeInventario() {
  return [...new Set(Object.values(ENDPOINTS_CON_MEDIO).map((c) => c.dir))].sort();
}

export { RAIZ };
