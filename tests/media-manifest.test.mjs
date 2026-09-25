/**
 * Parte pura del importador: qué tapa se enlaza a qué registro y qué queda pendiente.
 * Se testea aquí porque es la única decisión que no puede revertirse después:
 * un enlace equivocado en la BD se ve en el sitio.
 *
 * Los tres primeros testes son los de la brief (task-10-brief.md, Step 1) y sus
 * aserciones no se aflojan ni se tocan: son byte-idénticos a los de la brief, y eso
 * es propiedad revisada.
 *
 * Los once siguientes fijan lo que la brief no decía o decía mal, resuelto en el
 * módulo (ver el header de strapi/scripts/lib/media-manifest.mjs):
 *   · `campo` lo deriva la tabla por endpoint (y un valor explícito manda),
 *   · separar emparejar de reclamar hace que la razón de ambigüedad exista,
 *   · un archivo nunca se enlaza fuera del directorio de su endpoint — ni por
 *     nombre ni por alias (dos testes: el guard de directorio tiene que poder
 *     romperse y verse rojo),
 *   · entre dos reclamos del mismo nivel gana el slug más largo, no el orden de
 *     entrada (otro teste con ese único propósito: sin él, ese criterio se puede
 *     borrar sin que nada se queje),
 *   · una coincidencia "solo por sufijo" NO se enlaza: va a `revisar`, que
 *     `aplicar()` se niega a escribir,
 *   · y el `alias` declarado resuelve lo que ningún nombre puede deducir (las 36
 *     tapas de bitácora, cuyo nombre trae el slug recortado), le gana a la regla
 *     y sale etiquetado;
 *   · y los tres baldes de archivos (`enlazar`, `pendientes`, `revisar`) son una
 *     PARTICIÓN del inventario: cada archivo en exactamente uno, las longitudes
 *     suman los archivos leídos, y una fila de alias descartada reporta su motivo
 *     en `motivosAlias` sin crear una segunda entrada para un archivo ya baldado.
 *     Es lo que las Tareas 11 y 14 van a leer como inventario, y medido en
 *     `f32dd88` no cerraba: 86 entradas con suma 88 y filas fantasma.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifesto, archivosDelEnlace, esCampoMultiple, formaDeCampo } from '../strapi/scripts/lib/media-manifest.mjs';

const tapas = [
  'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  'public/images/bitacora/granja-el-cercado-de-piedra.webp',
];

test('asocia cada tapa de bitácora con su artículo por slug', () => {
  const m = manifesto({
    archivos: tapas,
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', marca: 'meliponas' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'el-cercado-de-piedra', marca: 'granja' },
    ],
  });
  assert.equal(m.enlazar.length, 2);
  assert.deepEqual(m.enlazar[0], {
    endpoint: 'bitacoras', documentId: 'd1', campo: 'imagen',
    archivo: 'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  });
});

test('un archivo sin registro equivalente no se sube: queda en pendientes', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/meliponas-huerfana.webp'],
    registros: [],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.pendientes, ['public/images/bitacora/meliponas-huerfana.webp']);
});

test('dos registros que reclaman la misma tapa: gana el slug más largo y el otro queda pendiente', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/la-miel.webp'],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'miel' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].documentId, 'd1');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [{ slug: 'miel', documentId: 'd2', motivo: 'la tapa ya está asignada a la-miel' }]);
});

// --- resolución 1: de dónde sale `campo` -----------------------------------

test('campo: lo deriva la tabla por endpoint si el registro no lo trae; uno explícito manda', () => {
  const m = manifesto({
    archivos: [
      'public/images/cafe-menu/proveedor-cacao-espinal.webp',
      'public/images/bitacora/bitacora-la-caja-de-angelita.webp',
    ],
    registros: [
      { endpoint: 'proveedors', documentId: 'p1', slug: 'cacao-espinal' },
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', campo: 'portada' },
    ],
  });
  // 'foto' es el campo real de proveedor (strapi/src/api/proveedor/.../schema.json),
  // y el orden de salida es el de los registros de entrada, no el de reclamo.
  assert.deepEqual(m.enlazar.map((e) => `${e.documentId}:${e.campo}`), ['p1:foto', 'd1:portada']);
  assert.deepEqual(m.ambiguos, []);
});

// --- resolución 2: emparejar y reclamar son pasos separados -----------------

test('con el nombre real de las tapas (bitacora-<slug>) también se nombra al slug que ganó', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/bitacora-miel-chef.webp'],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'miel-chef' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'chef' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].archivo, 'public/images/bitacora/bitacora-miel-chef.webp');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [
    { slug: 'chef', documentId: 'd2', motivo: 'la tapa ya está asignada a miel-chef' },
  ]);
});

test('una coincidencia solo por sufijo es una propuesta, no un enlace: va a revisar', () => {
  const m = manifesto({
    archivos: ['public/images/cafe-menu/proveedor-meliponario.webp'],
    registros: [{ endpoint: 'item-menus', documentId: 'm1', slug: 'meliponario' }],
  });
  // `item-menus` no declara el namespace `proveedor-`: el nombre solo TERMINA en el
  // slug. Con el vocabulario recortado de las tapas eso es pan de hoy, y escribirlo
  // en un CMS de producción es demasiado permisivo: cero enlaces.
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.revisar, [{
    endpoint: 'item-menus',
    documentId: 'm1',
    campo: 'imagen',
    archivo: 'public/images/cafe-menu/proveedor-meliponario.webp',
    motivo: 'coincidencia solo por sufijo: public/images/cafe-menu/proveedor-meliponario.webp',
  }]);
  assert.deepEqual(m.ambiguos, []);
  // Tampoco es un archivo sin dueño: la propuesta existe y está nombrada.
  assert.deepEqual(m.pendientes, []);
});

test('entre el .webp y su gemelo .png gana el .webp; el gemelo queda en pendientes, no se pierde', () => {
  const m = manifesto({
    archivos: [
      'public/images/cafe-menu/aromatica-flora-nativa.png',
      'public/images/cafe-menu/aromatica-flora-nativa.webp',
    ],
    registros: [{ endpoint: 'item-menus', documentId: 'i1', slug: 'aromatica-flora-nativa' }],
  });
  assert.equal(m.enlazar[0].archivo, 'public/images/cafe-menu/aromatica-flora-nativa.webp');
  assert.deepEqual(m.pendientes, ['public/images/cafe-menu/aromatica-flora-nativa.png']);
});

test('dos tapas distintas para un mismo slug: gana la del namespace propio y la otra se reporta', () => {
  const m = manifesto({
    archivos: [
      'public/images/bitacora/bitacora-miel.webp',
      'public/images/bitacora/cosecha-miel.webp',
    ],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'miel' }],
  });
  assert.equal(m.enlazar[0].archivo, 'public/images/bitacora/bitacora-miel.webp');
  assert.deepEqual(m.ambiguos, [
    { slug: 'miel', documentId: 'd1', motivo: 'descartada por ambigüedad: public/images/bitacora/cosecha-miel.webp' },
  ]);
});

// --- el guard de directorio: "nunca se enlaza un archivo fuera del directorio
// --- del endpoint" es una promesa del módulo y hasta acá no tenía teste que la
// --- hiciera roja. Los dos siguientes la fijan por los dos lados. ------------

test('el mismo slug en dos directorios no los cruza: bitacoras toma la de bitacora/', () => {
  const m = manifesto({
    archivos: [
      'public/images/bitacora/bitacora-miel.webp',
      'public/images/galeria/proyecto-miel.webp',
    ],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'miel' }],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'bitacoras', documentId: 'd1', campo: 'imagen',
    archivo: 'public/images/bitacora/bitacora-miel.webp',
  }]);
  // Sin el guard, la de `galeria/` entra como candidata de sufijo y esto se llena.
  assert.deepEqual(m.ambiguos, []);
  assert.deepEqual(m.revisar, []);
  // Y el archivo ajeno no se pierde: queda pendiente, que es la lista del humano.
  assert.deepEqual(m.pendientes, ['public/images/galeria/proyecto-miel.webp']);
});

test('un archivo fuera del directorio del endpoint no se enlaza ni con el slug exacto en el nombre', () => {
  const m = manifesto({
    archivos: [
      'public/images/galeria/miel.webp',
      'public/images/galeria/proyecto-miel.webp',
    ],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'miel' }],
  });
  // `galeria/miel.webp` casaría de nombre con `bitacoras/miel` (base === slug, nivel 1):
  // si el guard se va, este enlace aparece y el inventario entero se contamina.
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.ambiguos, []);
  assert.deepEqual(m.pendientes, [
    'public/images/galeria/miel.webp',
    'public/images/galeria/proyecto-miel.webp',
  ]);
});

// --- el desempate por largo de slug -----------------------------------------

test('dos reclamos de nivel 1 sobre la misma tapa: gana el slug más largo, no el que llegó primero', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/meliponas-la-miel.webp'],
    registros: [
      // Los dos son nivel 1 sobre el MISMO nombre base: `meliponas-la-miel` es
      // `<marca>-<slug>` para el primero y el slug pelado para el segundo. Empatado
      // el nivel, decide el largo del slug — y el orden de entrada está puesto a
      // propósito al revés, para que si el criterio se borra gane `d1` y se vea.
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel', marca: 'meliponas' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'meliponas-la-miel' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].documentId, 'd2');
  assert.equal(m.enlazar[0].archivo, 'public/images/bitacora/meliponas-la-miel.webp');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [
    { slug: 'la-miel', documentId: 'd1', motivo: 'la tapa ya está asignada a meliponas-la-miel' },
  ]);
});

// --- el alias declarado: la única ruta para las tapas con el slug recortado ----

test('un alias le gana a la regla sobre la misma tapa y su enlace sale etiquetado', () => {
  // Las dos rutas son medidas, no inventadas: el archivo existe en
  // public/images/bitacora/ y el slug largo es el front-matter de
  // Publicaciones/Meliponario/caso-la-finca-de-don-manuel.md. El `documentId` es de
  // fixture: lo aporta la lectura de la API, nunca el alias.
  const archivo = 'public/images/bitacora/bitacora-caso-don-manuel.webp';
  const m = manifesto({
    archivos: [archivo],
    registros: [
      // `caso-don-manuel` es el slug recortado: casaría por regla, nivel 1.
      { endpoint: 'bitacoras', documentId: 'd-recortado', slug: 'caso-don-manuel' },
      // El slug real no aparece en el nombre: por regla nunca candidata.
      { endpoint: 'bitacoras', documentId: 'd-real', slug: 'caso-la-finca-de-don-manuel' },
    ],
    alias: { [archivo]: { endpoint: 'bitacoras', slug: 'caso-la-finca-de-don-manuel' } },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'bitacoras',
    documentId: 'd-real',
    campo: 'imagen',
    archivo,
    origen: 'alias',
  }]);
  // El reclamo por regla que perdió se nombra, con el slug del ganador.
  assert.deepEqual(m.ambiguos, [{
    slug: 'caso-don-manuel',
    documentId: 'd-recortado',
    motivo: 'la tapa ya está asignada a caso-la-finca-de-don-manuel',
  }]);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.pendientes, []);
});

test('un alias que no se puede firmar no escribe: su motivo se nombra sin crear un segundo balde', () => {
  const archivo = 'public/images/bitacora/bitacora-miel-chef.webp';
  // Slug que la lectura no trae (un alias mal escrito o un rename en la BD).
  const sinRegistro = manifesto({
    archivos: [archivo],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'miel-chef' }],
    alias: { [archivo]: { endpoint: 'bitacoras', slug: 'chef-de-miel' } },
  });
  // Un alias que no se puede firmar no veta lo que la regla sí sabe: la tapa sigue
  // enlazada por regla, y sin clave `origen` — eso es lo que la distingue de una
  // enlazada por alias.
  assert.deepEqual(sinRegistro.enlazar, [{
    endpoint: 'bitacoras', documentId: 'd1', campo: 'imagen', archivo,
  }]);
  assert.deepEqual(sinRegistro.pendientes, []);
  // El archivo YA tiene balde (`enlazar`): reportarlo además en `revisar` era
  // contarlo dos veces. La razón se nombra aparte, y `motivosAlias` no es un balde
  // de archivos — ver la PARTICIÓN del header del módulo.
  assert.deepEqual(sinRegistro.revisar, []);
  assert.deepEqual(sinRegistro.motivosAlias, [{
    archivo,
    motivo: 'ningún registro de la lectura trae bitacoras/chef-de-miel',
  }]);

  // Y el alias tampoco abre la puerta del directorio: esto es `galeria/`, no `bitacora/`.
  const fuera = manifesto({
    archivos: ['public/images/galeria/proyecto-ambala-1.webp'],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'ambala' }],
    alias: {
      'public/images/galeria/proyecto-ambala-1.webp': { endpoint: 'bitacoras', slug: 'ambala' },
    },
  });
  assert.deepEqual(fuera.enlazar, []);
  assert.deepEqual(fuera.pendientes, ['public/images/galeria/proyecto-ambala-1.webp']);
  assert.deepEqual(fuera.revisar, []);
  assert.deepEqual(fuera.motivosAlias, [{
    archivo: 'public/images/galeria/proyecto-ambala-1.webp',
    motivo: 'el alias saca public/images/galeria/proyecto-ambala-1.webp del directorio de bitacoras (bitacora)',
  }]);
});

// --- PARTICIÓN: los tres baldes de archivos son una partición del inventario.
//
// Medido sobre `f32dd88` con los 86 archivos reales de public/images/ (reporte
// §12.2): sin filas de alias descartadas los conteos cerraban (2 + 0 + 84 = 86),
// pero con dos de ellas el mismo archivo aparecía en `revisar` estando ya en
// `enlazar` o en `pendientes` ⇒ suma 88 sobre 86 entradas, 2 archivos en dos
// baldes y una fila fantasma. Este teste fija la propiedad que las Tareas 11 y 14
// van a leer como inventario: cada archivo de entrada, en exactamente un balde.
test('los tres baldes son una partición del inventario, también con filas de alias descartadas', () => {
  const enlaceRegla = 'public/images/bitacora/bitacora-la-miel.webp';
  const enlaceAlias = 'public/images/bitacora/bitacora-caso-don-manuel.webp';
  const porSufijo = 'public/images/cafe-menu/proveedor-meliponario.webp';
  const pendiente = 'public/images/galeria/proyecto-ambala-1.webp';
  const fantasma = 'public/images/bitacora/la-miel-fantasma.webp';
  const archivos = [enlaceRegla, enlaceAlias, porSufijo, pendiente, 'public/images/bitacora/.gitkeep'];
  const m = manifesto({
    archivos,
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'caso-la-finca-de-don-manuel' },
      { endpoint: 'item-menus', documentId: 'm1', slug: 'meliponario' },
    ],
    alias: {
      // firmable: el único camino de las tapas con el slug recortado.
      [enlaceAlias]: { endpoint: 'bitacoras', slug: 'caso-la-finca-de-don-manuel' },
      // descartadas las tres, y las tres sobre archivos que YA tienen balde (o que
      // no están en el inventario): ninguna puede crear una segunda entrada.
      [enlaceRegla]: { endpoint: 'bitacoras', slug: 'miel-de-mesa' },
      [fantasma]: { endpoint: 'bitacoras', slug: 'la-miel' },
      [pendiente]: { endpoint: 'bitacoras', slug: 'ambala' },
    },
  });

  const baldeados = [
    ...m.enlazar.map((e) => e.archivo),
    ...m.pendientes,
    ...m.revisar.map((r) => r.archivo),
  ];
  // El `.gitkeep` no va a ningún balde (lo excluye el inventario), así que la
  // suma se mide sobre las entradas que sí son arte producida.
  const entradas = archivos.filter((a) => !a.endsWith('.gitkeep'));

  // 1. cada archivo, en exactamente un balde:
  assert.deepEqual(
    baldeados.slice().sort(),
    entradas.slice().sort(),
    'la suma de los tres baldes tiene que ser exactamente el inventario, sin repetidos',
  );
  assert.equal(new Set(baldeados).size, baldeados.length, 'ningún archivo en dos baldes');
  assert.equal(
    m.enlazar.length + m.pendientes.length + m.revisar.length,
    entradas.length,
    'las longitudes suman el número de archivos de entrada',
  );
  // 2. y cada balde trae lo que le toca, por nombre:
  assert.deepEqual(m.enlazar.map((e) => e.archivo), [enlaceRegla, enlaceAlias]);
  assert.deepEqual(m.revisar.map((r) => r.archivo), [porSufijo]);
  assert.deepEqual(m.pendientes, [pendiente]);
  // 3. los tres motivos de alias descartados se ven, y en ninguna parte cuentan
  // como archivos: `motivosAlias` es una lista de razones.
  assert.deepEqual(m.motivosAlias, [
    { archivo: enlaceRegla, motivo: 'ningún registro de la lectura trae bitacoras/miel-de-mesa' },
    { archivo: fantasma, motivo: `el alias declara un archivo que no está en el inventario: ${fantasma}` },
    { archivo: pendiente, motivo: `el alias saca ${pendiente} del directorio de bitacoras (bitacora)` },
  ]);
  // Un `.gitkeep` no se enlaza ni se revisa: no es arte.
  assert.ok(!baldeados.includes('public/images/bitacora/.gitkeep'));
});

// ===========================================================================
// F2-a — identidad por `nombre`, series de varios archivos y colisiones medidas
//
// Los fixtures de acá salen de `.superpowers/sdd/2026-09-24-media-strapi-
// consolidation/f2-vocabulario-medido.md` (nombres, slugs y documentIds REALES
// medidos por el dueño; `historia-visitantes` quedó fuera porque sin token la
// lectura es 403 y no se puede fixturear sin red). Nada de esto abre `public/
// images/` ni la API: `manifesto()` recibe listas de strings.
//
// Lo que fija este bloque, con un teste por propiedad:
//   · identidad nivel `nombre` con acentos, `I.E.` y tokens de parada (los 6
//     `proyecto-meliponario` medidos, que NO tienen `slug`),
//   · el `-N` final es un ÍNDICE: una tapa reclama varios archivos y la entrada
//     trae la lista ORDENADA que `aplicar()` tiene que escribir,
//   · `documentId` como clave de alias, que es lo único que firma un registro sin
//     `slug`, y su prioridad sobre la regla,
//   · las dos formas de colisión medida (dos archivos sobre un registro; un
//     archivo sobre varios registros sin `slug`) → `revisar`, nunca "gana el
//     primero" ni "gana el más largo" donde eso no es un desempate,
//   · y que las 36 tapas de bitácora siguen siendo CERO por regla, no por
//     olvido: la contención de tokens no se aplica a un título.
// ===========================================================================

/** Los nueve archivos de `galeria/` que el vocabulario F2 ya casó con un proyecto. */
const GALERIA_AMBALA = [
  'public/images/galeria/proyecto-ambala-1.webp',
  'public/images/galeria/proyecto-ambala-2.webp',
];

test('F2-a identidad por `nombre`: un proyecto sin `slug` se enlaza y su galería sale ORDENADA', () => {
  // Medido: `proyecto-meliponarios` trae `slug: null` en 6 de 6 registros, así
  // que la identidad real es `nombre`. El archivo se escribió `proyecto-ambala-N`
  // y el nombre, con acento y abreviatura: `Meliponario I.E. Ambalá`.
  const m = manifesto({
    archivos: [GALERIA_AMBALA[1], GALERIA_AMBALA[0]], // deliberadamente en desorden
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p-ambala', slug: null, nombre: 'Meliponario I.E. Ambalá' },
    ],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'proyecto-meliponarios',
    documentId: 'p-ambala',
    campo: 'galeria',
    archivos: GALERIA_AMBALA,
    origen: 'nombre',
  }]);
  // El par no es "un enlace y un sobrante": la unidad son LOS DOS archivos.
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.ambiguos, []);
});

test('F2-a el orden de una serie es el índice numérico, no el texto', () => {
  // Medido en `galeria`: el orden del campo repetible lo dice el `-N`, así que
  // `-10` NO puede adelantarse a `-2`. La raíz sin índice abre en la posición 0.
  const m = manifesto({
    archivos: [
      'public/images/galeria/proyecto-cumbre-10.webp',
      'public/images/galeria/proyecto-cumbre-2.webp',
      'public/images/galeria/proyecto-cumbre-3.webp',
      'public/images/galeria/proyecto-cumbre.webp',
    ],
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p-cumbre', slug: null, nombre: 'EcoHotel La Cumbre' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.deepEqual(archivosDelEnlace(m.enlazar[0]), [
    'public/images/galeria/proyecto-cumbre.webp',
    'public/images/galeria/proyecto-cumbre-2.webp',
    'public/images/galeria/proyecto-cumbre-3.webp',
    'public/images/galeria/proyecto-cumbre-10.webp',
  ]);
});

test('F2-a entre los gemelos de extensión de una serie gana el .webp y el .png queda en pendientes', () => {
  const m = manifesto({
    archivos: [
      'public/images/galeria/proyecto-ambala-1.png',
      ...GALERIA_AMBALA,
    ],
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' },
    ],
  });
  assert.deepEqual(m.enlazar.map((e) => archivosDelEnlace(e)), [GALERIA_AMBALA]);
  assert.deepEqual(m.pendientes, ['public/images/galeria/proyecto-ambala-1.png']);
  assert.deepEqual(m.revisar, []);
});

test('F2-a un alias por `documentId` le gana a la regla y firma a un registro que la regla no ve', () => {
  // `p-cumbre` pierde ante el alias; `p1` no tiene NINGÚN reclamo por regla (su
  // nombre no aparece en ningún archivo): solo escribe lo declarado por humano.
  const m = manifesto({
    archivos: GALERIA_AMBALA,
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p-cumbre', slug: 'ambala', nombre: 'Meliponario I.E. Ambalá' },
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: 'cumbre', nombre: 'EcoHotel La Cumbre' },
    ],
    alias: {
      p1: { endpoint: 'proyecto-meliponarios', campo: 'galeria', archivos: GALERIA_AMBALA },
    },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'proyecto-meliponarios',
    documentId: 'p1',
    campo: 'galeria',
    archivos: GALERIA_AMBALA,
    origen: 'alias',
  }]);
  assert.deepEqual(m.ambiguos, [{
    slug: 'ambala',
    documentId: 'p-cumbre',
    motivo: 'la tapa ya está asignada a cumbre',
  }]);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.pendientes, []);
});

test('F2-a dos producciones para el mismo registro y el mismo campo: ninguna gana', () => {
  // Forma de la colisión medida con `bitacora-miel-chef` + `bitacora-miel-cocina`
  // sobre un artículo: dos archivos que casan con la misma identidad.
  const m = manifesto({
    archivos: [
      'public/images/galeria/producto-miel-angelita.webp',
      'public/images/galeria/producto-angelita-miel.webp',
    ],
    registros: [
      { endpoint: 'productos', documentId: 'prd1', slug: null, nombre: 'Miel Angelita 120ml' },
    ],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.revisar, [
    {
      archivo: 'public/images/galeria/producto-angelita-miel.webp',
      endpoint: 'productos',
      documentId: 'prd1',
      campo: 'imagen',
      motivo: 'varias producciones reclaman Miel Angelita 120ml en imagen: producto-angelita-miel, producto-miel-angelita',
    },
    {
      archivo: 'public/images/galeria/producto-miel-angelita.webp',
      endpoint: 'productos',
      documentId: 'prd1',
      campo: 'imagen',
      motivo: 'varias producciones reclaman Miel Angelita 120ml en imagen: producto-angelita-miel, producto-miel-angelita',
    },
  ]);
  assert.deepEqual(m.pendientes, []);
});

test('F2-a un archivo que reclaman tres productos sin `slug` no se reparte: `producto-caja-1`', () => {
  // Medido: `producto-caja-1.webp` casa por `nombre` con `Caja AF Estándar`,
  // `Caja INPA con atril` y `Caja INPA Nogal Cafetero`, y los tres traen
  // `slug: null`. Sin slug no hay largo que desempate: se revisa, no se adivina.
  const m = manifesto({
    archivos: ['public/images/galeria/producto-caja-1.webp'],
    registros: [
      { endpoint: 'productos', documentId: 'caja-af', slug: null, nombre: 'Caja AF Estándar' },
      { endpoint: 'productos', documentId: 'caja-atril', slug: null, nombre: 'Caja INPA con atril' },
      { endpoint: 'productos', documentId: 'caja-nogal', slug: null, nombre: 'Caja INPA Nogal Cafetero' },
    ],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.pendientes, []);
  assert.equal(m.revisar.length, 1);
  assert.deepEqual(m.revisar[0], {
    archivo: 'public/images/galeria/producto-caja-1.webp',
    endpoint: 'productos',
    campo: 'galeria',
    motivo: 'varios registros reclaman el mismo archivo sin que la identidad lo desempate: '
      + 'productos/caja-af, productos/caja-atril, productos/caja-nogal',
  });
  // Sin UN destinatario no hay a quién escribirle: `documentId` no puede salir.
  assert.equal('documentId' in m.revisar[0], false);
});

test('F2-a una serie en disputa no escribe a medias: ninguno de sus archivos cae a pendientes', () => {
  const m = manifesto({
    archivos: GALERIA_AMBALA,
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' },
      { endpoint: 'proyecto-meliponarios', documentId: 'p2', slug: null, nombre: 'Proyecto Ambala' },
    ],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar.map((r) => r.archivo), GALERIA_AMBALA);
  assert.match(m.revisar[0].motivo, /p1, proyecto-meliponarios\/p2$/);
});

test('F2-a las tapas de bitácora siguen siendo cero por regla: un título no es una identidad', () => {
  // La regla de tokens del dueño casaba 29 de 36 tapas, pero contra el TÍTULO.
  // `bitacora` no declara `identidadNombre` (tiene `titulo`, no `nombre`), así
  // que ni siquiera mirar el campo: las 36 terminan en `pendientes`, no enlazadas
  // a medias. Pasar de ahí cuesta una fila de alias, que es lo que sigue abajo.
  const chef = 'public/images/bitacora/bitacora-miel-chef.webp';
  const cocina = 'public/images/bitacora/bitacora-miel-cocina.webp';
  const registros = [{
    endpoint: 'bitacoras',
    documentId: 'xv5ia6c4xumhfl4imtvhbryi',
    slug: 'la-miel-de-angelita-y-el-chef-maridajes-y-aplicaciones-en-la-alta-cocina',
    nombre: 'La miel de Angelita y el chef: maridajes y aplicaciones en la alta cocina',
  }];
  const m = manifesto({ archivos: [chef, cocina], registros });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.motivosAlias, []);
  assert.deepEqual(m.pendientes, [chef, cocina]);

  // Y el único camino que existe para ese archivo es la fila declarada.
  const conAlias = manifesto({
    archivos: [chef, cocina],
    registros,
    alias: { [chef]: { endpoint: 'bitacoras', slug: 'la-miel-de-angelita-y-el-chef-maridajes-y-aplicaciones-en-la-alta-cocina' } },
  });
  assert.deepEqual(conAlias.enlazar, [{
    endpoint: 'bitacoras',
    documentId: 'xv5ia6c4xumhfl4imtvhbryi',
    campo: 'imagen',
    archivo: chef,
    origen: 'alias',
  }]);
  assert.deepEqual(conAlias.pendientes, [cocina]);
});

test('F2-a frontera letra/dígito: `modulo1` ≡ `modulo-1` y `120ml` ≡ `120 ml`', () => {
  // Cuatro combinaciones del mismo empaquetado: nombre pegado o con espacio,
  // archivo con guion o pegado. Solo las dos extremas coinciden por suerte; las
  // cruzadas (`120ml` en el nombre, `120-ml` en el archivo, y a la inversa) son
  // las que sostienen la regla de la frontera letra/dígito en `normalizar()`.
  // Además: una serie de UN archivo se escribe igual como lista porque el campo
  // es repetible — la aridad la decide la tabla, no el conteo (CONTRATO 2).
  const casos = [
    ['nombre pegado / archivo pegado', 'Miel Angelita 120ml', 'producto-miel-angelita-120ml'],
    ['nombre separado / archivo separado', 'Miel Angelita 120 ml', 'producto-miel-angelita-120-ml'],
    ['nombre pegado / archivo con guion', 'Miel Angelita 120ml', 'producto-miel-angelita-120-ml'],
    ['nombre separado / archivo pegado', 'Miel Angelita 120 ml', 'producto-miel-angelita-120ml'],
  ];
  for (const [etiqueta, nombre, raiz] of casos) {
    const archivo = `public/images/galeria/${raiz}-1.webp`;
    const m = manifesto({
      archivos: [archivo],
      registros: [{ endpoint: 'productos', documentId: 'prd1', slug: null, nombre }],
    });
    assert.deepEqual(m.enlazar, [{
      endpoint: 'productos',
      documentId: 'prd1',
      campo: 'galeria',
      archivo,
      origen: 'nombre',
    }], etiqueta);
    assert.deepEqual(m.pendientes, [], etiqueta);
    assert.deepEqual(m.revisar, [], etiqueta);
  }
  // Y la tabla es la que dice qué campo es repetible y de qué forma es cada valor.
  assert.equal(esCampoMultiple('productos', 'galeria'), true);
  assert.equal(esCampoMultiple('productos', 'imagen'), false);
  assert.equal(formaDeCampo('productos', 'galeria'), 'json');
  assert.equal(formaDeCampo('productos', 'imagen'), 'string');
});

test('F2-a la salida no depende del orden de entrada: mismos baldes con el inventario barajado', () => {
  // I1: hasta acá este fixture no dejaba NINGÚN archivo en `pendientes`, que es
  // justo el único balde que se devolvía en el orden del llamador. O sea: la
  // prueba se llamaba como la propiedad y no la tocaba — el mutante «quitar el
  // `.sort()` de `pendientes`» sobrevivía verde. Ahora hay huérfanos en los tres
  // baldes que recorren el inventario, y dos filas de alias con claves que no
  // ordenan igual, para que el `assert.equal` pueda morir por los dos lados.
  const archivos = [
    ...GALERIA_AMBALA,
    'public/images/bitacora/bitacora-la-miel.webp',
    'public/images/bitacora/bitacora-caso-don-manuel.webp',
    'public/images/cafe-menu/proveedor-meliponario.webp',
    'public/images/galeria/proyecto-poblado-1.webp',
    // huérfano de verdad: ningún registro lo reclama por ninguna regla → `pendientes`
    'public/images/bitacora/bitacora-nadie-me-pide.webp',
    // y otro, en el directorio de las series, para que el balde no dependa de un solo caso
    'public/images/galeria/proyecto-orfan-9.webp',
  ];
  const registros = [
    { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel' },
    { endpoint: 'bitacoras', documentId: 'd2', slug: 'caso-la-finca-de-don-manuel' },
    { endpoint: 'item-menus', documentId: 'm1', slug: 'meliponario' },
    { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' },
    { endpoint: 'proyecto-meliponarios', documentId: 'p2', slug: null, nombre: 'Jardín Residencial El Poblado' },
  ];
  const alias = {
    'public/images/bitacora/bitacora-caso-don-manuel.webp': { endpoint: 'bitacoras', slug: 'caso-la-finca-de-don-manuel' },
    // segunda fila, otra clave, y NO firmable (el archivo no está en el inventario):
    // obliga a `motivosAlias` a salir ordenado por clave y no por autoría.
    'public/images/bitacora/bitacora-fantasma.webp': { endpoint: 'bitacoras', slug: 'la-miel' },
  };
  const vueltaAlias = {
    'public/images/bitacora/bitacora-fantasma.webp': alias['public/images/bitacora/bitacora-fantasma.webp'],
    'public/images/bitacora/bitacora-caso-don-manuel.webp': alias['public/images/bitacora/bitacora-caso-don-manuel.webp'],
  };
  const ida = JSON.stringify(manifesto({ archivos, registros, alias }));
  const vuelta = JSON.stringify(manifesto({
    archivos: archivos.slice().reverse(),
    registros,
    alias: vueltaAlias, // mismas dos filas, insertadas al revés
  }));
  assert.equal(vuelta, ida, 'barajar el inventario no puede cambiar ningún balde');
  // Y para que el `equal` de arriba no sea vacío por omisión: los tres baldes con
  // orden propio están llenos en este fixture.
  const m = manifesto({ archivos, registros, alias });
  assert.ok(m.pendientes.length >= 2, 'el fixture tiene que dejar archivos en pendientes');
  assert.ok(m.revisar.length >= 1, 'y en revisar');
  assert.deepEqual(
    m.pendientes,
    ['public/images/bitacora/bitacora-nadie-me-pide.webp', 'public/images/galeria/proyecto-orfan-9.webp'],
    '`pendientes` sale ordenado por ruta, no en el orden del llamador',
  );
});

test('F2-a `pendientes` se devuelve ordenado: el orden del llamador no sobrevive a la función', () => {
  // Mi1: el header promete que «todo lo que se recorre para producir salida se
  // ordena antes», y `pendientes` era el balde que la incumplía: el CLI lo imprime
  // una línea por archivo, así que dos corridas sobre el mismo disco daban dos
  // inventarios no diff-eables.
  const entrada = [
    'public/images/bitacora/zzz-huerfana.webp',
    'public/images/bitacora/aaa-huerfana.webp',
    'public/images/bitacora/mmm-huerfana.webp',
  ];
  const esperado = entrada.slice().sort();
  assert.deepEqual(manifesto({ archivos: entrada, registros: [] }).pendientes, esperado);
  assert.deepEqual(
    manifesto({ archivos: entrada.slice().reverse(), registros: [] }).pendientes,
    esperado,
    'la misma lista al revés da el mismo balde',
  );
});

test('F2-a abreviatura con puntos: `E.F.M.` se pliega en UN token de la identidad', () => {
  // Dientes agregados al verificar F2-a: el mutante «borrar el plegado de
  // puntos de `normalizar()`» sobrevivió la primera corrida, porque las siglas
  // MEDIDAS de la BD (`Meliponario I.E. Ambalá`) están cubiertas dos veces —
  // `ie` es token de parada y `i`/`e` son iniciales sueltas que se descartan—.
  // Este es el caso que distingue la regla: una abreviatura cuyas letras forman
  // un token de dos o más caracteres. Sin el plegado, `E.F.M.` deja `e`, `f`,
  // `m` (tres iniciales que se botan), la identidad pierde un token y el archivo
  // `producto-efm-…-1` deja de pertenecer a nadie: cae a `pendientes`.
  const archivo = 'public/images/galeria/producto-efm-ambala-1.webp';
  const m = manifesto({
    archivos: [archivo],
    registros: [{ endpoint: 'productos', documentId: 'prd-efm', slug: null, nombre: 'Miel E.F.M. Ambalá' }],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'productos',
    documentId: 'prd-efm',
    campo: 'galeria',
    archivo,
    origen: 'nombre',
  }], 'la abreviatura plegada es parte del `nombre`');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.ambiguos, []);
});

test('F2-a acentos fuera, `ñ` incluida: `Caja INPA Pequeña` ≡ `producto-inpa-pequena`', () => {
  // Segundo mutante que sobrevivió al primer pase: `normalizar()` pliega los
  // acentos por dos caminos (borrar `.normalize('NFD')` sí rompe pruebas; borrar
  // solo el strip de marcas combinantes no, porque una vocal descompuesta cae
  // como separador y el token sale igual). La línea hace falta con `ñ`: sin ella
  // `Pequeña` se parte en `peque` + `n` + `a` y la identidad se deforma, así que
  // el arte de ese producto no pertenece a nadie. El nombre es MEDIDO
  // (`strapi/scripts/seed-productos.mjs`, 14 productos); el archivo es la forma
  // en que ese arte está escrito en disco.
  const archivo = 'public/images/galeria/producto-inpa-pequena.webp';
  const m = manifesto({
    archivos: [archivo],
    registros: [
      { endpoint: 'productos', documentId: 'caja-inpa-pequena', slug: null, nombre: 'Caja INPA Pequeña' },
      { endpoint: 'productos', documentId: 'caja-inpa-mediana', slug: null, nombre: 'Caja INPA Mediana' },
    ],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'productos',
    documentId: 'caja-inpa-pequena',
    campo: 'imagen',
    archivo,
    origen: 'nombre',
  }], 'la `ñ` plegada es parte del nombre: no casa con `Mediana` ni se pierde');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.ambiguos, []);
});

// ===========================================================================
// Ronda de arreglo (ola F2-a) — C1, I3, I2: el agrupamiento de series tiene
// que ser inyectable y tiene que respetar `DIRS_CON_SERIE`.
//
// Por qué estos testes y no un comentario: la clave de agrupamiento era
// `normalizar(raiz).join(' ')`, y `normalizar` no es inyectable (se bota `el`,
// `de`, iniciales). Dos raíces distintas chocaban en la misma clave, y de ahí
// salían dos daños medidos con el módulo real antes de arreglar:
//   • mismo índice → mismo slot, y con igual extensión ganaba el primero que
//     llegó: `orden A enlaza proyecto-el-poblado-1`, `orden B enlaza
//     proyecto-poblado-1`. O sea: qué archivo sube y enlaza `--apply` dependía de
//     `readdirSync`, y el perdedor caía a `pendientes` — el balde que Tarea 14 usa
//     para borrar duplicados.
//   • índices distintos → ni siquiera había slot que las separara: las dos piezas
//     se escribían como UNA galería de dos en un registro.
// El arreglo es agrupar por raíz LITERAL. Estos testes fijan la conducta nueva.
// ===========================================================================

/** Las dos raíces que colisionan al normalizarse: tokens `proyecto poblado` en las dos. */
const COLISION_A = 'public/images/galeria/proyecto-el-poblado-1.webp';
const COLISION_B = 'public/images/galeria/proyecto-poblado-1.webp';
const REG_POBLADO = [{ endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Jardín Residencial El Poblado' }];

test('C1 dos raíces que colisionan al normalizarse: ninguna gana, las dos van a `revisar`', () => {  // Antes del arreglo: con el inventario en un orden se enlazaba `proyecto-el-poblado-1`
  // y en el otro, `proyecto-poblado-1`; el perdedor caía a `pendientes`. Hoy las dos
  // raíces son dos unidades del mismo nivel sobre el mismo registro y campo, que es
  // la definición de «varias producciones»: se REPORTA y no se escribe.
  const m = manifesto({ archivos: [COLISION_A, COLISION_B], registros: REG_POBLADO });
  assert.deepEqual(m.enlazar, [], 'no puede salir NINGÚN enlace: elegir uno sería elegir el orden del disco');
  assert.deepEqual(m.pendientes, [], 'y ninguna de las dos desaparece: están nombradas en `revisar`');
  assert.deepEqual(m.revisar.map((r) => r.archivo), [COLISION_A, COLISION_B]);
  assert.match(m.revisar[0].motivo, /^varias producciones reclaman .* en galeria: proyecto-el-poblado, proyecto-poblado$/);
  // El balde escribible no cambia con el orden de lectura: ese es el punto del arreglo.
  const vuelta = manifesto({ archivos: [COLISION_B, COLISION_A], registros: REG_POBLADO });
  assert.deepEqual(JSON.stringify(vuelta), JSON.stringify(m), 'barajar las dos raíces no puede mover un archivo de balde');
});

test('C1 desempate de slot: `-01` y `-1` caen en la MISMA posición, y gana la ruta menor', () => {
  // La raíz literal cerró la colisión entre raíces distintas, pero queda un empate
  // real dentro de UN grupo: `proyecto-ambala-01` y `proyecto-ambala-1` comparten
  // raíz literal y `Number('01') === Number('1')`, o sea el mismo slot, y los dos
  // son .webp → `RANGO_EXT` empata. Sin el desempate por ruta gana el que llegó
  // primero, medido: `orden A → …-01`, `orden B → …-1`. Mismo mecanismo del C1,
  // otra puerta.
  const ceroUno = 'public/images/galeria/proyecto-ambala-01.webp';
  const uno = 'public/images/galeria/proyecto-ambala-1.webp';
  const registros = [{ endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' }];
  const ida = manifesto({ archivos: [ceroUno, uno], registros });
  const vuelta = manifesto({ archivos: [uno, ceroUno], registros });
  assert.deepEqual(archivosDelEnlace(ida.enlazar[0]), [ceroUno], 'gana la ruta menor, no la primera');
  assert.deepEqual(JSON.stringify(vuelta), JSON.stringify(ida), 'y dar la vuelta al inventario no mueve el ganador');
  assert.deepEqual(vuelta.pendientes, ida.pendientes);
  // El perdedor no se pierde: sigue en el inventario, que es lo que Tarea 14 necesita.
  assert.deepEqual(ida.pendientes, [uno]);
});

test('C1/I3 con índices distintos: dos raíces no se funden en una galería de dos', () => {
  // La variante silenciosa: acá no empataba un slot, simplemente no había slot que
  // las separara, así que el resultado era DETERMINISTA pero FALSO — una galería de
  // dos archivos de dos temas distintos, escrita con convicción.
  const a = 'public/images/galeria/proyecto-el-poblado-1.webp';
  const b = 'public/images/galeria/proyecto-poblado-2.webp';
  const m = manifesto({ archivos: [a, b], registros: REG_POBLADO });
  assert.deepEqual(m.enlazar, [], 'dos raíces distintas no son la misma unidad');
  assert.deepEqual(m.revisar.map((r) => r.archivo), [a, b]);
  assert.match(m.revisar[0].motivo, /varias producciones/);
  // Y cada una por separado SÍ es una galería de uno, con su propia clave: el
  // agrupamiento no rompió la serie, solo le quitó la llave no-inyectable.
  for (const [archivo, raiz] of [[a, 'proyecto-el-poblado'], [b, 'proyecto-poblado']]) {
    const sola = manifesto({ archivos: [archivo], registros: REG_POBLADO });
    assert.deepEqual(sola.enlazar, [{
      endpoint: 'proyecto-meliponarios', documentId: 'p1', campo: 'galeria', archivo, origen: 'nombre',
    }], `sola, ${raiz} reclama y enlaza`);
    assert.deepEqual(sola.revisar, []);
  }
});

test('I2 `DIRS_CON_SERIE` es la regla: un `-N` fuera de `galeria` no desaparece, reclama su portada', () => {
  // CONTRATO 2 promete que fuera de los directorios con campo repetible `cafeterias-1`
  // y `cafeterias-2` son DOS identidades distintas. Medido antes del arreglo, la
  // promesa era falsa y el código se caía a `pendientes` en silencio: cero líneas en
  // `revisar`, cero `motivosAlias`. La sonda que la distingue es un archivo numerado
  // cuyo nombre base completo ES la identidad de un registro.
  const portada = 'public/images/cafe-menu/visitante-tour-familiar-1.webp';
  const m = manifesto({
    archivos: [portada],
    registros: [{ endpoint: 'historia-visitantes', documentId: 'v1', slug: 'tour-familiar-1' }],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'historia-visitantes', documentId: 'v1', campo: 'imagen', archivo: portada,
  }], 'el `-1` es parte del nombre, no un índice de serie: hay destino de una sola pieza y se enlaza');
  assert.deepEqual(m.pendientes, []);

  // Dos numerados del mismo tema, en un directorio sin campo repetible: dos unidades
  // de un archivo, cada una con su registro. No una serie fantasma que nadie lee.
  const dos = manifesto({
    archivos: ['public/images/cafe-menu/cafeterias-1.webp', 'public/images/cafe-menu/cafeterias-2.webp'],
    registros: [
      { endpoint: 'item-menus', documentId: 'i1', slug: 'cafeterias-1' },
      { endpoint: 'item-menus', documentId: 'i2', slug: 'cafeterias-2' },
    ],
  });
  assert.deepEqual(
    dos.enlazar.map((e) => `${e.documentId}:${e.archivo}`),
    ['i1:public/images/cafe-menu/cafeterias-1.webp', 'i2:public/images/cafe-menu/cafeterias-2.webp'],
  );
  assert.deepEqual(dos.pendientes, []);
  assert.equal(dos.enlazar.every((e) => !('archivos' in e)), true, 'ninguna de las dos es una serie');

  // Y el destino de la variante que NINGÚN registro pide: `pendientes`, pero con la
  // puerta abierta — el archivo sí fue candidato, simplemente no casó.
  const huerfano = manifesto({
    archivos: ['public/images/cafe-menu/cafeterias-1.webp'],
    registros: [{ endpoint: 'item-menus', documentId: 'i1', slug: 'cafeterias' }],
  });
  assert.deepEqual(huerfano.enlazar, []);
  assert.deepEqual(huerfano.pendientes, ['public/images/cafe-menu/cafeterias-1.webp']);
});
