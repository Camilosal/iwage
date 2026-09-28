/**
 * El envase de alias que el importador recibe con `--alias=<ruta>` es un archivo de
 * decisiones editoriales, y este teste no decide ninguna: verifica que las 66 filas
 * PROPUESTAS (`strapi/scripts/media-alias-propuesto.json`) son mecánicamente válidas
 * —el archivo existe en el inventario, el endpoint está en la tabla del manifiesto,
 * el campo es de los que la tabla declara, el slug y el documentId no se repiten— y
 * que `manifesto()` las firma a todas sin mandar una sola a `motivosAlias`.
 *
 * Por qué vale la pena un teste sobre un `.json` que aún no se aplica: la puerta del
 * dueño (`--apply`) es la que escribe, pero el trabajo previo era transcribir 27 pares
 * de `alias-firmes.json` y 6 series de galería a la forma que exige el contrato, y una
 * transcripción a mano es justo donde nace un alias que apunta a un registro equivocado.
 * Con este teste, un archivo mal escrito o un endpoint fuera de tabla se ve acá, no el
 * día del `--apply`.
 *
 * D3 (2026-09-27) sumó 7 filas y reasignó una, y las decidió mirando los `.webp` contra
 * el título de cada publicación. Es la clase de trabajo que este teste cubre sin poder
 * juzgarlo: puede probar que `bitacora-miel-chef.webp` apunta a un slug que existe, está
 * solo una vez y no se lo disputa nadie — no que la lámina sea la del chef y no la de
 * las recetas. Eso último se miró con los ojos y quedó contado en el `aviso` del envase.
 *
 * D5 (2026-09-27) sumó las otras 3 filas que faltaban —los tres `producto-*` que el
 * manifiesto mandaba a `revisar` porque varios registros los reclamaban— y tampoco las
 * decidió este teste: eligió el `aviso`. Lo que sí puede probar acá es lo mecánico, que
 * en este caso ya no es obvio: una fila por ruta contra un `slug` que existe, y dos filas
 * por `documentId` que parten en dos una SERIE que los dos productos de miel reclamaban
 * entera. Que la foto del frasco sea la del frasco de 120 ml y no la del propóleo es una
 * lectura de la lámina, no un predicado.
 *
 * Las dos formas no son un capricho: los 6 `proyecto-meliponarios` tienen `slug: null`
 * medido en 6/6, así que ninguna regla por nombre los firma; solo una clave `documentId`
 * puede. Lo mismo les pasa a 2 de los 3 `productos` de D5 (medido: 3 de 14 sin `slug`),
 * y por eso la forma 2 ya no es exclusividad de la galería: puede escribir un campo de
 * portada con UN archivo. Por eso el teste separa las filas por forma y exige a cada una
 * lo suyo.
 *
 * D6 (2026-09-27) sumó 23 filas y estrenó `compartida`, así que la invariant «ningún
 * archivo se declara dos veces» dejó de ser absoluta y pasó a ser declarada: lo que este
 * teste exige ahora es que todo archivo con dos filas lo diga en las dos, en el mismo
 * endpoint y sobre el campo de portada. Un reparto sin la bandera sigue siendo un error
 * de transcripción, que es exactamente lo que la cláusula vieja cazaba.
 *
 * Y la segunda mitad, que protege el estado DESPUÉS de G3 (aplicado el 2026-09-26 con
 * autorización del dueño): `media-alias.json` —el nombre que el importador lee cuando se
 * le pasa `--alias` por defecto— ya no está vacío, y lo que se le exige es ser EXACTAMENTE
 * la propuesta aceptada, ni una fila más ni en otro endpoint. proponente ≠ aplicado sigue
 * siendo la invariant, pero ahora se verifica por igualdad de contenido, no por vacuidad:
 * una fila que se añade directo al envase se salta el `--dry-run` y la revisión humana, y
 * ese es exactamente el movimiento que este teste tiene que romper.
 *
 * El envase es parte del contrato, y no lo inventó este teste: `leerAlias()` exige
 * `{"aviso": …, "alias": {…}}` y aborta con `no trae un objeto en la clave "alias"`
 * ante un mapa pelado. Medido el 2026-09-25 con este archivo escrito como mapa
 * directo — las filas pasaban `manifesto()` verdes y ni por enterado de que el
 * CLI las rechazaba antes de leerlas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifesto, ENDPOINTS_CON_MEDIO, archivosDelEnlace } from '../strapi/scripts/lib/media-manifest.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PROPUESTA = join(RAIZ, 'strapi/scripts/media-alias-propuesto.json');

const crudo = JSON.parse(readFileSync(PROPUESTA, 'utf8'));
const alias = crudo.alias;
const entradas = Object.entries(alias);
// Forma 1 = la clave es la ruta del archivo. Forma 2 = la clave es el documentId.
const F1 = entradas.filter(([, f]) => 'slug' in f);
const F2 = entradas.filter(([, f]) => 'archivos' in f);
/** 34 tapas de bitácora + 1 producto (D5) en forma 1; 6 series de proyecto, 2 productos
 *  (D5) y 23 filas de café — 15 ítems, 4 proveedores, 4 visitantes— (D6) en forma 2. */
const FILAS_F1 = 35;
const FILAS_F2 = 31;
/**
 * Filas que declaran `portada` (D4, 2026-09-27): las 6 series de proyecto. Cada una
 * escribe DOS campos —`galeria` con la serie y `imagen` con la lámina declarada—, así
 * que esta cuenta es la diferencia entre `enlazar.length` y el número de filas.
 */
const FILAS_CON_PORTADA = 6;
/**
 * Archivos que se declaran en más de una fila (D6): las 6 fotos de familia del café,
 * 14 filas sobre 6 archivos. Cada una de esas filas escribe su propio `imagen`, así que
 * la cuenta de enlaces crece una vez por fila, no una vez por archivo.
 */
const FILAS_COMPARTIDAS = 14;
/**
 * Enlaces que no salen de una fila: `espresso-doble.webp` se llama exactamente como el
 * `slug` del ítem, así que la REGLA de nombre lo firma sola y no necesita alias. Está
 * acá porque el inventario de este teste incluye `cafe-menu/` y la cuenta de `enlazar`
 * tiene que cerrar contra la corrida real, no contra la mitad que se propuso.
 */
const ENLACES_POR_REGLA = 1;
/**
 * Registros que existen en la lectura y NO necesitan fila porque la regla de `slug` los
 * firma: `espresso-doble.webp` es exactamente el slug del ítem. Está acá porque el
 * inventario de este teste lo ve y la cuenta de `enlazar` tiene que cerrar con la de la
 * corrida real. Medido el 2026-09-27: es el único de los 17 `item_menus` que se firma solo.
 */
const REGISTROS_SIN_FILA = [
  { endpoint: 'item-menus', documentId: 'eco9rlgy5goi8wabtjzp2ueu', slug: 'espresso-doble' },
];

/**
 * Las 5 rutas que a PROPÓSITO no tienen fila después de D6, enumeradas y no derivadas: si
 * una cambia de estado, este teste se pone rojo y alguien la lee. Dos tapas de bitácora —
 * `calendario-manejo`, porque la lámina es defectuosa (pseudo-texto ilegible) y su asunto ya
 * tiene tapa en `modulo5-manejo`, y `red-meliponicultores`, porque la lámina está bien pero el
 * artículo no existe en la BD. Y tres archivos de `cafe-menu/`: `pan-yuca-miel`, porque el ítem
 * no existe (17 `item_menus` publicados, ninguno es pan de yuca) y las dos `promo-*`, porque las pinta
 * el template de `pages/cafe/index.astro` y ningún content-type tiene un campo donde ir.
 *
 * Estaba escrito además que estos tres «son la razón por la que `LOCAL_IMAGES` sigue vivo». Ya no:
 * D8 (2026-09-27) borró la tabla y las 10 reglas por nombre, medido antes de tocarlas —disparaban
 * para 0 de las 17 filas publicadas—. Lo que protege esa jubilación es
 * `tests/cafe-lee-de-strapi.test.mjs`, y lo que se ve en el censo es la fila 6.
 */
const SIN_PROPUESTA = [
  'public/images/bitacora/bitacora-calendario-manejo.webp',
  'public/images/bitacora/bitacora-red-meliponicultores.webp',
  'public/images/cafe-menu/pan-yuca-miel.webp',
  'public/images/cafe-menu/promo-duos-perfectos.webp',
  'public/images/cafe-menu/promo-reutilizable.webp',
];

test('el archivo viene en el envase que `leerAlias()` acepta: {aviso, alias}', () => {
  // Mismo predicado que strapi/scripts/media-import.mjs:leerAlias — si el de allá
  // cambia, la otra mitad de este par de testes (tests/media-flags.test.mjs) la
  // corre contra el CLI real y lo descubre.
  const acepta = (c) => !!c?.alias && typeof c.alias === 'object' && !Array.isArray(c.alias);
  assert.ok(acepta(crudo), 'el importador abortaría antes de leer una fila');
  assert.ok(Array.isArray(crudo.aviso) && crudo.aviso.length > 0, 'un envase sin aviso no dice a quién le toca revisar esto');
  assert.ok(crudo.aviso.every((l) => typeof l === 'string' && l.length > 0));
  assert.ok(!acepta(F1.reduce((o, [r, f]) => Object.assign(o, { [r]: f }), {})), 'el mapa pelado tiene que seguir siendo rechazado');
});

test('cada fila es de UNA forma del contrato, ni mezcla ni invento', () => {
  for (const [clave, f] of entradas) {
    const forma1 = 'slug' in f;
    const forma2 = 'archivos' in f;
    assert.ok(!(forma1 && forma2), `${clave}: no puede traer slug y archivos a la vez`);
    assert.ok(forma1 || forma2, `${clave}: fila que no es forma 1 ni forma 2`);
    if ('portada' in f) {
      assert.ok(forma2, `${clave}: una fila por ruta no declara portada, su clave ya es un archivo`);
      assert.ok(f.archivos.includes(f.portada), `${clave}: portada fuera de sus archivos`);
    }
  }
  assert.equal(F1.length, FILAS_F1, 'creció la propuesta: hay que revisar la cuenta y decirlo acá');
  assert.equal(F2.length, FILAS_F2, 'creció la propuesta: hay que revisar la cuenta y decirlo acá');
  assert.equal(F2.filter(([, f]) => 'portada' in f).length, FILAS_CON_PORTADA,
    'la cuenta de portadas declaradas cambió: hay que revisar cuál lámina es la portada y decirlo acá');
});

test('forma 1: endpoint de la tabla, slug de texto, archivo en su directorio y en el inventario', () => {
  for (const [ruta, fila] of F1) {
    assert.ok(fila.endpoint in ENDPOINTS_CON_MEDIO, `${ruta}: endpoint fuera de la tabla: ${fila.endpoint}`);
    assert.equal(typeof fila.slug, 'string', `${ruta}: falta el slug`);
    assert.ok(fila.slug.length > 0, `${ruta}: slug vacío`);
    assert.ok(!('campo' in fila), `${ruta}: la forma 1 no declara campo, lo da la tabla`);
    // Un archivo del directorio de `bitacora` no puede declararse contra un endpoint de otro.
    assert.ok(ruta.startsWith(`public/images/${ENDPOINTS_CON_MEDIO[fila.endpoint].dir}/`),
      `${ruta}: saca el archivo del directorio de ${fila.endpoint}`);
    assert.ok(existsSync(join(RAIZ, ruta)), `${ruta}: un alias que nombra un archivo inexistente no se puede firmar`);
  }
});

test('forma 2: clave con pinta de documentId, campo de la tabla y archivos existentes', () => {
  for (const [clave, fila] of F2) {
    assert.match(clave, /^[a-z0-9]{24}$/, `${clave}: la forma 2 se declara por documentId`);
    assert.ok(fila.endpoint in ENDPOINTS_CON_MEDIO, `${clave}: endpoint fuera de la tabla: ${fila.endpoint}`);
    const cfg = ENDPOINTS_CON_MEDIO[fila.endpoint];
    assert.ok([cfg.campo, cfg.campoMultiple].includes(fila.campo),
      `${clave}: ${fila.campo} no es un campo de medio de ${fila.endpoint}`);
    // D5 usa la forma 2 para lo contrario que las series: un producto sin `slug` y con UN
    // archivo, declarado al campo de portada. Lo que no se puede aflojar es el otro lado:
    // varios archivos solo caben en el campo repetible.
    if (fila.archivos.length > 1) {
      assert.equal(fila.campo, cfg.campoMultiple,
        `${clave}: una fila de varios archivos solo puede ir al campo repetible de ${fila.endpoint}`);
    }
    assert.ok(Array.isArray(fila.archivos) && fila.archivos.length > 0, `${clave}: archivos vacío`);
    for (const a of fila.archivos) {
      assert.equal(typeof a, 'string', `${clave}: archivo que no es ruta`);
      assert.ok(a.startsWith(`public/images/${cfg.dir}/`), `${clave}: ${a} saca el archivo del directorio de ${fila.endpoint}`);
      assert.ok(existsSync(join(RAIZ, a)), `${clave}: ${a} no existe en disco`);
    }
    assert.equal(new Set(fila.archivos).size, fila.archivos.length, `${clave}: el mismo archivo dos veces en la misma serie`);
    if ('compartida' in fila) {
      // El módulo rechaza estas tres formas y el envase no tiene por qué contenerlas:
      // una bandera que no es `true`, un reparto de serie, o compartir una galería en vez
      // de la portada. Medido con mutantes M5..M7 en la ronda D6.
      assert.equal(fila.compartida, true, `${clave}: \`compartida\` solo se escribe como true`);
      assert.equal(fila.archivos.length, 1, `${clave}: una fila compartida declara UN solo archivo`);
      assert.equal(fila.campo, cfg.campo, `${clave}: \`compartida\` solo vale sobre el campo de portada de ${fila.endpoint}`);
    }
  }
});

test('un archivo no se declara dos veces SIN DECIRLO: `compartida` es la única apertura', () => {
  // Hasta D6 esta cláusula era absoluta: dos filas sobre la misma ruta eran un error de
  // transcripción. Lo que sigue siendo un error es el reparto sin bandera, y lo que ahora
  // se permite es el que las dos filas declaran — mismo endpoint, mismo campo, un archivo
  // cada una. El módulo tiene los mismos tres guardes; este teste los exige en el ARCHIVO,
  // para que una fila mal editada se vea acá y no en el `--apply`.
  const porArchivo = new Map();
  const ver = (ruta, clave, fila) => porArchivo.set(ruta, [...(porArchivo.get(ruta) ?? []), { clave, fila }]);
  for (const [ruta, fila] of F1) ver(ruta, 'forma 1', fila);
  for (const [clave, fila] of F2) for (const a of fila.archivos) ver(a, clave, fila);
  for (const [ruta, reclamos] of [...porArchivo].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (reclamos.length < 2) continue;
    const quienes = reclamos.map((r) => r.clave).join(', ');
    for (const { clave, fila } of reclamos) {
      assert.equal(fila.compartida, true, `${ruta}: lo reclaman ${quienes} y ${clave} no declaró \`compartida\``);
    }
    const destinos = new Set(reclamos.map(({ fila }) => `${fila.endpoint}.${fila.campo}`));
    assert.equal(destinos.size, 1, `${ruta}: compartido entre destinos distintos: ${[...destinos].join(', ')}`);
    assert.equal(reclamos.length, new Set(reclamos.map((r) => r.clave)).size,
      `${ruta}: dos filas del mismo documento`);
  }
  // El reparto que se declaró, en número: 14 filas sobre 6 fotos de familia del café.
  const compartidas = F2.filter(([, f]) => f.compartida === true);
  assert.equal(compartidas.length, FILAS_COMPARTIDAS, 'cambió la cuenta de filas compartidas');
  assert.equal(new Set(compartidas.flatMap(([, f]) => f.archivos)).size, 6,
    'las filas compartidas no caen sobre 6 archivos de familia');
});

test('los destinos son distintos: dos tapas al mismo slug es disputa, y dos filas al mismo documentId también', () => {
  const slugVisto = new Map();
  for (const [ruta, fila] of F1) {
    assert.equal(slugVisto.get(fila.slug), undefined, `${fila.slug}: lo reclaman ${slugVisto.get(fila.slug) ?? ''} y ${ruta}`);
    slugVisto.set(fila.slug, ruta);
  }
  assert.equal(new Set(F2.map(([c]) => c)).size, F2.length, 'dos filas para el mismo documentId');
  // Y las dos formas no se solapan: una clave de 24 caracteres no es una ruta.
  assert.deepEqual(F2.map(([c]) => c).filter((c) => c.includes('/')), [], 'una forma 2 con clave de ruta');
});

test('manifesto() firma las 66 filas y no manda ninguna a motivosAlias', () => {
  // Los registros se derivan de la propia propuesta: lo que se prueba acá es la forma
  // del alias contra el resolutor real, no que la API exista (eso se midió por lectura
  // pública: los 34 slugs y los 6 documentId están en la BD del runtime).
  const registros = [
    ...F1.map(([ruta, fila], i) => ({
      endpoint: fila.endpoint,
      documentId: `d${i}`,
      slug: fila.slug,
      ...(ENDPOINTS_CON_MEDIO[fila.endpoint].tieneMarca ? { marca: 'meliponas' } : {}),
    })),
    // Los proyectos reales: `slug: null` medido en 6/6, identidad solo por documentId. Lo
    // mismo traen los 4 `proveedors` y los 9 `historia_visitantes` (medido 2026-09-27), y
    // los ítems del café se dejan SIN slug a propósito: con los slugs reales la regla no
    // alcanza a ninguna foto de familia, así que lo que se prueba acá es el reparto
    // declarado puro. La única fila que la regla sí firma sola está en `REGISTROS_SIN_FILA`.
    ...F2.map(([clave, fila]) => ({ endpoint: fila.endpoint, documentId: clave, slug: null })),
    ...REGISTROS_SIN_FILA,
  ];
  // El inventario es el DISCO, no lo que la propuesta dice que tocó. Con la lista de la
  // propia propuesta como inventario, una fila que olvida un archivo no lo deja
  // pendiente: sencillamente nunca existió (medido: `ambala-2` fuera de su fila daba
  // verde). Las 67 rutas de `bitacora/`, `galeria/` y `cafe-menu/` son lo que el importador
  // ve — el tercero entró con D6, que es justo el directorio con huecos de contenido.
  const archivos = [...F1.map(([ruta]) => ruta), ...F2.flatMap(([, f]) => f.archivos)];
  const EN_DIRECTORIOS = new Set(['bitacora', 'galeria', 'cafe-menu']);
  const inventario = [...EN_DIRECTORIOS]
    .flatMap((d) => readdirSync(join(RAIZ, 'public', 'images', d))
      .filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
      .map((f) => `public/images/${d}/${f}`))
    .sort();
  assert.equal(inventario.length, 67, 'el inventario cambió: hay que recountar qué se propuso y qué no');
  const m = manifesto({ archivos: inventario, registros, alias });

  assert.deepEqual(m.motivosAlias, [], `ninguna fila se pudo firmar: ${JSON.stringify(m.motivosAlias)}`);
  // Una fila con `portada` son DOS enlaces del mismo registro, y una fila compartida
  // escribe la suya aunque el archivo ya tenga dueño: la cuenta de entradas no es la cuenta
  // de filas. `ENLACES_POR_REGLA` es lo que la corrida real suma sin ninguna fila.
  assert.equal(m.enlazar.length, entradas.length + FILAS_CON_PORTADA + ENLACES_POR_REGLA,
    'enlazar no cubre exactamente la propuesta');
  // Ningún archivo de la propuesta queda sin enlazar...
  const enlazados = new Set(m.enlazar.flatMap(archivosDelEnlace));
  assert.deepEqual(archivos.filter((a) => !enlazados.has(a)), [], 'un archivo propuesto y no enlazado es un alias que no ató');
  // ...y lo que NO queda enlazado son exactamente los 5 archivos sin decisión: 2 tapas de
  // bitácora sin artículo (o sin lámina usable) y 3 láminas de café sin destino. Si mañana
  // alguien agrega una tapa y no la propone, esta igualdad la nombra.
  assert.deepEqual(inventario.filter((a) => !enlazados.has(a)).sort(), [...SIN_PROPUESTA].sort(),
    'la cuenta de archivos huérfanos cambió');
  // `archivosDelEnlace` es el helper del contrato para esto: una serie de UN solo
  // archivo sale con `archivo`, no con `archivos` (bonifacio, esperanza y poblado lo
  // midieron). Discriminar por la presencia de `archivos` reordenaba esas tres.
  // Se cuentan archivos DISTINTOS, no la suma por enlace: la portada declarada es un
  // segundo enlace sobre un archivo que ya está en su propia serie, y las 14 filas
  // compartidas de D6 son 6 archivos. Lo único que se suma es el archivo que firma la
  // regla sin fila declarada (`ENLACES_POR_REGLA`, uno, con un archivo).
  assert.equal(
    new Set(m.enlazar.flatMap(archivosDelEnlace)).size,
    new Set(archivos).size + ENLACES_POR_REGLA,
    'la cuenta de archivos enlazados no cierra con la del inventario de la propuesta',
  );

  const documentIdPorSlug = new Map(registros.map((r) => [r.slug, r.documentId]));
  const destinosF2 = new Set(F2.map(([c]) => c));
  const porRegla = m.enlazar.filter((e) => e.origen === undefined);
  assert.equal(porRegla.length, ENLACES_POR_REGLA, 'la regla de slug escribió otra cosa');
  assert.deepEqual(porRegla.flatMap(archivosDelEnlace), ['public/images/cafe-menu/espresso-doble.webp'],
    'el único enlace sin fila declarada tiene que ser el que la tabla firma sola');
  for (const enlace of m.enlazar.filter((e) => e.origen !== undefined)) {
    const los = archivosDelEnlace(enlace);
    assert.equal(enlace.origen, 'alias', `${los[0]}: el enlace no vino del alias`);
    if (destinosF2.has(enlace.documentId)) {
      // Forma 2: el campo y el orden los fija la fila declarada, no la tabla.
      const fila = alias[enlace.documentId];
      if (enlace.campo === fila.campo) {
        assert.deepEqual(los, fila.archivos, `${enlace.documentId}: se reordenó o se recortó la serie`);
      } else {
        // El segundo enlace de la misma unidad: la portada, campo de la tabla y un solo archivo.
        assert.equal(enlace.campo, ENDPOINTS_CON_MEDIO[fila.endpoint].campo,
          `${enlace.documentId}: campo inesperado en la portada`);
        assert.deepEqual(los, [fila.portada], `${enlace.documentId}: la portada enlazada no es la declarada`);
      }
    } else {
      assert.equal(enlace.campo, ENDPOINTS_CON_MEDIO[enlace.endpoint].campo, `${los[0]}: campo inesperado`);
      assert.equal(enlace.documentId, documentIdPorSlug.get(alias[los[0].replace(RAIZ + '/', '')].slug));
    }
  }
});

test('el envase aplicado es la propuesta, exacta: ni una fila más y ni un endpoint más', () => {
  const aplicado = JSON.parse(readFileSync(join(RAIZ, 'strapi/scripts/media-alias.json'), 'utf8'));
  assert.deepEqual(
    aplicado.alias,
    alias,
    'media-alias.json se salió de la propuesta: toda fila nueva exige seco y revisión del dueño',
  );
  const endpoints = [...new Set(Object.values(aplicado.alias).map((v) => v.endpoint))].sort();
  assert.deepEqual(
    endpoints,
    ['bitacoras', 'historia-visitantes', 'item-menus', 'productos', 'proveedors', 'proyecto-meliponarios'],
    'el envase aplicado escribe en un endpoint que ninguna decisión abrió (G3, D3, D4, D5 y D6)',
  );
  assert.equal(aplicado.alias['public/images/bitacora/bitacora-inpa-vs-af.webp'].slug,
               'cajas-inpa-vs-af-c2-b7-comparativas', 'la fila que sirvió de sonda se fue de su destino');
});
