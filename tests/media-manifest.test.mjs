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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDPOINTS_CON_MEDIO,
  archivosDelEnlace,
  esCampoMultiple,
  formaDeCampo,
  manifesto,
} from '../strapi/scripts/lib/media-manifest.mjs';

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

test('campo: lo deriva la tabla por endpoint si el registro no lo trae; uno explícito VÁLIDO manda', () => {
  const m = manifesto({
    archivos: [
      'public/images/cafe-menu/proveedor-cacao-espinal.webp',
      'public/images/bitacora/bitacora-la-caja-de-angelita.webp',
    ],
    registros: [
      { endpoint: 'proveedors', documentId: 'p1', slug: 'cacao-espinal' },
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', campo: 'imagen' },
    ],
  });
  // 'foto' es el campo real de proveedor (strapi/src/api/proveedor/.../schema.json),
  // y el orden de salida es el de los registros de entrada, no el de reclamo. El
  // override de bitácoras manda a `imagen`, que es lo que el content-type declara
  // (antes este teste asertaba `'d1:portada'` — y `portada` NO existe en
  // strapi/src/api/bitacora/content-types/bitacora/schema.json: el teste fijaba el
  // bug, no la resolución).
  assert.deepEqual(m.enlazar.map((e) => `${e.documentId}:${e.campo}`), ['p1:foto', 'd1:imagen']);
  assert.deepEqual(m.ambiguos, []);
  // Y un override explícito a otro campo de medio de la MISMA tabla también manda,
  // que es el caso para el que el contrato existe.
  const aLaGaleria = manifesto({
    archivos: ['public/images/galeria/producto-miel-angelita.webp'],
    registros: [{ endpoint: 'productos', documentId: 'prd1', slug: 'miel-angelita', campo: 'galeria' }],
  });
  assert.deepEqual(aLaGaleria.enlazar, [{
    endpoint: 'productos', documentId: 'prd1', campo: 'galeria',
    archivo: 'public/images/galeria/producto-miel-angelita.webp',
  }]);
  assert.equal(formaDeCampo('productos', aLaGaleria.enlazar[0].campo) === null, false, 'todo lo que sale en `enlazar` tiene forma en la tabla');
});

test('I5 un `campo` que la tabla no conoce no produce enlace: se reporta y no se escribe', () => {
  // El contrato 1 dice que un override del llamador manda. Sin validación, un
  // `portada` inventado salía en `enlazar` igual: en `--dry-run` se imprimía como
  // enlace prometido y solo en `--apply` reventaba por enlace (exit 1), con el
  // manifiesto — que las Tareas 11 y 14 leen como inventario — mintiendo.
  const archivo = 'public/images/bitacora/bitacora-la-caja-de-angelita.webp';
  const m = manifesto({
    archivos: [archivo],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', campo: 'portada' }],
  });
  assert.deepEqual(m.enlazar, [], 'nada se enlaza a un campo que el content-type no declara');
  assert.deepEqual(m.ambiguos, [{
    slug: 'la-caja-de-angelita',
    documentId: 'd1',
    motivo: 'el registro trae un campo que la tabla no conoce para bitacoras: portada',
  }]);
  // El archivo no desaparece: `ambiguos` es una lista de razones, el balde es
  // `pendientes`, así que la PARTICIÓN sigue cerrando.
  assert.deepEqual(m.pendientes, [archivo]);
  assert.deepEqual(m.revisar, []);

  // Sobre un endpoint con campo repetible: `galeria` sí es válido y `cover` no.
  // El `slug` es la RAÍZ de la serie (`ambala`), no `ambala-1`: contrato 3, el
  // índice nunca es identidad.
  const si = manifesto({
    archivos: ['public/images/galeria/proyecto-ambala-1.webp'],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: 'ambala', campo: 'galeria' }],
  });
  assert.equal(si.enlazar.length, 1, 'el campo multiple de la tabla es un destino legítimo');
  const no = manifesto({
    archivos: ['public/images/galeria/proyecto-ambala-1.webp'],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: 'ambala', campo: 'cover' }],
  });
  assert.deepEqual(no.enlazar, []);
  assert.equal(no.ambiguos.length, 1);
  assert.match(no.ambiguos[0].motivo, /la tabla no conoce para proyecto-meliponarios: cover$/);

  // Y por la vía del alias por ruta la respuesta es el otro balde de razones:
  // `motivosAlias`, no `ambiguos`, porque lo que no se pudo firmar es la fila.
  const porAlias = manifesto({
    archivos: [archivo],
    registros: [{ endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', campo: 'portada' }],
    alias: { [archivo]: { endpoint: 'bitacoras', slug: 'la-caja-de-angelita' } },
  });
  assert.deepEqual(porAlias.enlazar, []);
  assert.deepEqual(porAlias.motivosAlias, [{
    archivo,
    motivo: 'el registro trae un campo que la tabla no conoce para bitacoras: portada',
  }]);
  assert.equal(formaDeCampo('bitacoras', 'portada'), null, 'la tabla no conoce `portada`: es exactamente lo que había que rechazar');
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

// --- PORTADA DECLARADA (D4) -------------------------------------------------
// `normalizeProyecto` se niega a derivar la portada de la galería y lo fija un
// teste propio (`la galería se está usando de portada: dos campos diciendo lo
// mismo`), así que la portada de un proyecto solo puede llegar como DATO
// declarado. La declaración vive en la misma fila que escribe la serie — con lo
// que la disputa, el libro de reclamos y la PARTICIÓN no se enteran: un archivo
// sigue teniendo un solo balde y la portada es un segundo enlace de la unidad
// que ya ganó, no un reclamo nuevo.
// -----------------------------------------------------------------------------

test('F2-b la portada declarada en la fila de la serie escribe LOS DOS campos', () => {
  // `nombre` sin relación con ningún archivo: lo único que llega a este registro
  // es lo declarado, así que `ambiguos` vacío prueba que la portada no es un
  // reclamo más que disputarse nada.
  const m = manifesto({
    archivos: GALERIA_AMBALA,
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario Sin Fotos' },
    ],
    alias: {
      p1: {
        endpoint: 'proyecto-meliponarios', campo: 'galeria',
        archivos: GALERIA_AMBALA, portada: GALERIA_AMBALA[0],
      },
    },
  });
  assert.deepEqual(m.enlazar, [
    {
      endpoint: 'proyecto-meliponarios', documentId: 'p1', campo: 'galeria',
      archivos: GALERIA_AMBALA, origen: 'alias',
    },
    {
      endpoint: 'proyecto-meliponarios', documentId: 'p1', campo: 'imagen',
      archivo: GALERIA_AMBALA[0], origen: 'alias',
    },
  ]);
  // Un archivo, un balde: la portada es miembro de la serie y no abre un bucket propio.
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.ambiguos, []);
  assert.deepEqual(m.motivosAlias, []);
});

test('F2-b una portada que no es miembro de sus `archivos` descarta la fila entera', () => {
  // No es "escribe la galería y pierde la portada": la fila dice una cosa
  // inconsistente y no se le cree ninguna.
  const ajena = 'public/images/galeria/proyecto-ambala-9.webp';
  const m = manifesto({
    archivos: GALERIA_AMBALA,
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario Sin Fotos' },
    ],
    alias: {
      p1: { endpoint: 'proyecto-meliponarios', campo: 'galeria', archivos: GALERIA_AMBALA, portada: ajena },
    },
  });
  assert.deepEqual(m.motivosAlias, [
    { archivo: 'p1', motivo: `la portada de p1 no está en sus \`archivos\`: ${ajena}` },
  ]);
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.revisar, []);
  // El motivo es lista de RAZONES: los archivos siguen cayendo a `pendientes`.
  assert.deepEqual(m.pendientes, GALERIA_AMBALA);
});

test('F2-b `portada` solo tiene sentido en la fila que escribe el campo repetible', () => {
  // Una fila de `imagen` ya es una portada: declarar otra encima es un dato que
  // no se puede leer, así que se reporta en vez de ignorarse.
  const m = manifesto({
    archivos: GALERIA_AMBALA,
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario Sin Fotos' },
    ],
    alias: {
      p1: {
        endpoint: 'proyecto-meliponarios', campo: 'imagen',
        archivos: [GALERIA_AMBALA[0]], portada: GALERIA_AMBALA[0],
      },
    },
  });
  assert.deepEqual(m.motivosAlias, [
    {
      archivo: 'p1',
      motivo: 'la fila de p1 declara portada en imagen, que no es el campo repetible de proyecto-meliponarios',
    },
  ]);
  assert.deepEqual(m.enlazar, []);
});

test('F2-b una fila por ruta no declara portada: su clave ya es un archivo', () => {
  // El nombre de la tapa no casaba con ningún slug, así que lo único que escribe
  // esta fila es su declaración: descartada ella, no hay enlace.
  const tapa = 'public/images/bitacora/bitacora-sin-titulo.webp';
  const m = manifesto({
    archivos: [tapa],
    registros: [{ endpoint: 'bitacoras', documentId: 'b1', slug: 'la-miel' }],
    alias: {
      [tapa]: { endpoint: 'bitacoras', slug: 'la-miel', portada: tapa },
    },
  });
  assert.deepEqual(m.motivosAlias, [
    { archivo: tapa, motivo: `una fila por ruta no declara portada: ${tapa}` },
  ]);
  assert.deepEqual(m.enlazar, []);
});

test('F2-b la portada declarada le gana a la que deduciría el nombre', () => {
  // `proyecto-ambala-meliponario.png` no es serie (no trae índice): es una tapa
  // suelta que el `nombre` del proyecto reclamaría para `imagen`. Si se escribiera,
  // el PUT de la portada declarada y el suyo llegarían al mismo slot y ganaría el
  // orden del manifiesto. La declaración humana manda y la suelta queda pendiente.
  const suelta = 'public/images/galeria/proyecto-ambala-meliponario.png';
  const m = manifesto({
    archivos: [...GALERIA_AMBALA, suelta],
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'p1', slug: null, nombre: 'Meliponario I.E. Ambalá' },
    ],
    alias: {
      p1: {
        endpoint: 'proyecto-meliponarios', campo: 'galeria',
        archivos: GALERIA_AMBALA, portada: GALERIA_AMBALA[0],
      },
    },
  });
  assert.deepEqual(m.enlazar, [
    {
      endpoint: 'proyecto-meliponarios', documentId: 'p1', campo: 'galeria',
      archivos: GALERIA_AMBALA, origen: 'alias',
    },
    {
      endpoint: 'proyecto-meliponarios', documentId: 'p1', campo: 'imagen',
      archivo: GALERIA_AMBALA[0], origen: 'alias',
    },
  ]);
  assert.deepEqual(m.pendientes, [suelta]);
  assert.deepEqual(m.revisar, []);
  const nota = m.ambiguos.find((a) => /portada/.test(a.motivo));
  assert.deepEqual(nota, {
    slug: null,
    documentId: 'p1',
    motivo: 'imagen ya lo escribió la portada declarada en p1:galeria',
  });
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

test('F2-a un archivo que reclaman tres productos por `nombre` no se reparte: `producto-caja-1`', () => {
  // Medido otra vez el 2026-09-27 (D5): los tres SÍ tienen `slug` — `caja-af-estandar`,
  // `caja-inpa-con-atril`, `caja-inpa-nogal-cafetero` — y la disputa se mantiene. Es
  // decir: el desempate por largo de slug no es un "si hay slug", es un criterio del
  // nivel REGLA. Acá los tres reclaman con la MISMA coincidencia de tokens (`caja`),
  // así que el largo no informa nada y `idLen` sale 0 para todos: se revisa, no se adivina.
  const m = manifesto({
    archivos: ['public/images/galeria/producto-caja-1.webp'],
    registros: [
      { endpoint: 'productos', documentId: 'caja-af', slug: 'caja-af-estandar', nombre: 'Caja AF Estándar' },
      { endpoint: 'productos', documentId: 'caja-atril', slug: 'caja-inpa-con-atril', nombre: 'Caja INPA con atril' },
      { endpoint: 'productos', documentId: 'caja-nogal', slug: 'caja-inpa-nogal-cafetero', nombre: 'Caja INPA Nogal Cafetero' },
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

test('F2-c el alias declarado le gana al nombre del MISMO registro: `imagen` antes que `galeria`', () => {
  // D5, medido el 2026-09-27 con la fila YA escrita. El reporte decía
  // `enlace (nombre): producto-caja-1.webp → productos/…caja-nogal.galeria` y, contra
  // ese mismo registro, `la tapa ya está asignada a caja-inpa-nogal-cafetero`. Un
  // `galeria` deducible por nombre se había comido el archivo antes de que lo
  // reclamara el `imagen` DECLARADO, solo porque `'galeria' < 'imagen'` alfabéticamente.
  // La prioridad del módulo es «declarado antes que deducible» y tiene que sostenerse
  // entre campos de un mismo registro: la foto de un producto con una sola lámina es su
  // portada, no un álbum de una hoja.
  const caja = 'public/images/galeria/producto-caja-1.webp';
  const m = manifesto({
    archivos: [caja],
    registros: [
      { endpoint: 'productos', documentId: 'caja-af', slug: 'caja-af-estandar', nombre: 'Caja AF Estándar' },
      { endpoint: 'productos', documentId: 'caja-atril', slug: 'caja-inpa-con-atril', nombre: 'Caja INPA con atril' },
      { endpoint: 'productos', documentId: 'caja-nogal', slug: 'caja-inpa-nogal-cafetero', nombre: 'Caja INPA Nogal Cafetero' },
    ],
    alias: { [caja]: { endpoint: 'productos', slug: 'caja-inpa-nogal-cafetero' } },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'productos', documentId: 'caja-nogal', campo: 'imagen', archivo: caja, origen: 'alias',
  }]);
  // La disputa desapareció (el alias es el único reclamo de su nivel) y el archivo no
  // queda ni pendiente ni en revisar: la PARTICIÓN lo tiene que contar una sola vez.
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.motivosAlias, []);
  // Los tres que pierden se nombran y se dice contra quién: dos registros ajenos y el
  // propio `galeria` del ganador, que ya no tiene nada que escribir.
  const perdidas = m.ambiguos.map((a) => a.motivo);
  assert.equal(perdidas.length, 3, JSON.stringify(m.ambiguos));
  for (const motivo of perdidas) {
    assert.match(motivo, /^la tapa ya está asignada a caja-inpa-nogal-cafetero$/);
  }
});

test('F2-c dos filas declaradas parten una serie en disputa: cada producto con su portada, `galeria` sin escribir', () => {
  // La otra mitad de D5. `producto-miel-1/-2.webp` son una SERIE (raíz `producto-miel`
  // en `galeria`) y los dos productos de miel la reclamaban entera por nombre: disputa
  // medida sobre los DOS archivos. Declarar uno por documento no solo reparte la serie —
  // tiene que impedir que el `galeria` deducible escriba después los dos.
  const miel1 = 'public/images/galeria/producto-miel-1.webp';
  const miel2 = 'public/images/galeria/producto-miel-2.webp';
  const registros = [
    { endpoint: 'productos', documentId: 'glaozvmm52qn7nq8nsioheu7', slug: null, nombre: 'Miel Angelita 120ml' },
    { endpoint: 'productos', documentId: 'umydhk4nw9b962o992a83pwr', slug: null, nombre: 'Miel con propóleo 250ml' },
  ];
  const alias = {
    glaozvmm52qn7nq8nsioheu7: { endpoint: 'productos', campo: 'imagen', archivos: [miel1] },
    umydhk4nw9b962o992a83pwr: { endpoint: 'productos', campo: 'imagen', archivos: [miel2] },
  };
  const m = manifesto({ archivos: [miel1, miel2], registros, alias });
  assert.deepEqual(m.enlazar, [
    { endpoint: 'productos', documentId: 'glaozvmm52qn7nq8nsioheu7', campo: 'imagen', archivo: miel1, origen: 'alias' },
    { endpoint: 'productos', documentId: 'umydhk4nw9b962o992a83pwr', campo: 'imagen', archivo: miel2, origen: 'alias' },
  ]);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.motivosAlias, []);
  // Y el orden de entrada no decide: con los registros y el inventario barajados salen
  // los mismos dos enlaces (ordenados por documento, que es lo único que compara).
  const porDoc = (a, b) => (a.documentId < b.documentId ? -1 : 1);
  const alReves = manifesto({
    archivos: [miel2, miel1],
    registros: registros.slice().reverse(),
    alias,
  });
  assert.deepEqual(alReves.enlazar.slice().sort(porDoc), m.enlazar.slice().sort(porDoc));
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
  // `media` en las dos columnas desde `fa240b2`: el esquema ya no guarda rutas.
  assert.equal(esCampoMultiple('productos', 'galeria'), true);
  assert.equal(esCampoMultiple('productos', 'imagen'), false);
  assert.equal(formaDeCampo('productos', 'galeria'), 'media');
  assert.equal(formaDeCampo('productos', 'imagen'), 'media');
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

// ===========================================================================
// I4 — `ENDPOINTS_CON_MEDIO` contra el ESQUEMA REAL.
//
// Por qué un teste y no una revisión: en este repo no hay `tsc` ni `astro check`
// (`astro build` solo borra tipos), así que un `'string'` que debía ser `'media'`
// en esas columnas no rompe nada en el build. Rompe en producción, en el primer
// `--apply`: `valorDeEnlace()` manda una ruta relativa a un campo que pide `id`, o
// un escalar donde va lista. La tabla se desincronizó exactamente así entre
// `643996d` y `fa240b2` (ese commit convirtió portadas y galerías a `media` y la
// tabla no se enteró). Este teste es el candado: cruzar la tabla con los
// `schema.json` es lo único que convierte esa deriva en un `npm test` rojo.
//
// Lee los 22 `strapi/src/api/<ct>/content-types/<ct>/schema.json` desde disco. No
// escribe ni un esquema: el dueño de esa fuente de verdad es el tren de Task 11.
// ===========================================================================

/** Todos los content-types de `src/api`, indexados por su `info.pluralName`. */
function esquemasLeidos() {
  const api = join(dirname(fileURLToPath(import.meta.url)), '..', 'strapi', 'src', 'api');
  const porPlural = new Map();
  const hojas = [];
  for (const modulo of readdirSync(api, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const hoja = join(api, modulo, 'content-types', modulo, 'schema.json');
    if (!existsSync(hoja)) continue;
    const esquema = JSON.parse(readFileSync(hoja, 'utf8'));
    const plural = esquema?.info?.pluralName;
    hojas.push(`${modulo}/${plural ?? '(sin pluralName)'}`);
    if (!plural) continue;
    assert.equal(
      porPlural.has(plural),
      false,
      `dos content-types comparten info.pluralName "${plural}": la tabla nombra endpoints por ese valor y ya no sería unívoco`,
    );
    porPlural.set(plural, { modulo, attrs: esquema.attributes || {} });
  }
  return { porPlural, hojas };
}

const ESQUEMAS = esquemasLeidos();

test('I4 el barrido del esquema no está vacío ni apunta al lado equivocado', () => {
  // Sin esta, un `join` roto daría un barrido de cero archivos y los testes de
  // abajo pasarían por vacíos: el candado se quedaría mirando a otro lado.
  assert.ok(ESQUEMAS.hojas.length >= 20, `se esperaban los 22 content-types de src/api y el barrido trajo ${ESQUEMAS.hojas.length}`);
  assert.equal(ESQUEMAS.hojas.length, 22, 'medido sobre `26393d2`: 22 esquemas en strapi/src/api');
  const faltantes = Object.keys(ENDPOINTS_CON_MEDIO).filter((e) => !ESQUEMAS.porPlural.has(e));
  assert.deepEqual(faltantes, [], `endpoints de la tabla que ningún content-type declara como pluralName: ${faltantes.join(', ')}`);
});

test('I4 ENDPOINTS_CON_MEDIO coincide con el esquema, campo por campo y forma por forma', () => {
  for (const [endpoint, cfg] of Object.entries(ENDPOINTS_CON_MEDIO)) {
    const { modulo, attrs } = ESQUEMAS.porPlural.get(endpoint);
    const donde = `${endpoint} (${modulo}/content-types/${modulo}/schema.json)`;

    // portada: tiene que existir, ser del tipo que la tabla declara, y NO repetible
    const portada = attrs[cfg.campo];
    assert.ok(portada, `${donde}: el atributo ${cfg.campo} desapareció del esquema`);
    assert.equal(portada.type, cfg.campoForma, `${donde}: ${cfg.campo} es "${portada.type}" en el esquema y la tabla dice "${cfg.campoForma}"`);
    assert.equal(!!portada.multiple, false, `${donde}: ${cfg.campo} es multiple en el esquema; la tabla lo usa como portada de una pieza`);

    // campo repetible: existe, es del tipo declarado y SÍ es multiple
    if (cfg.campoMultiple) {
      const rep = attrs[cfg.campoMultiple];
      assert.ok(rep, `${donde}: el atributo ${cfg.campoMultiple} desapareció del esquema`);
      assert.equal(rep.type, cfg.multipleForma, `${donde}: ${cfg.campoMultiple} es "${rep.type}" en el esquema y la tabla dice "${cfg.multipleForma}"`);
      assert.equal(!!rep.multiple, true, `${donde}: ${cfg.campoMultiple} NO es multiple; la tabla escribe listas ahí`);
    } else {
      assert.equal(formaDeCampo(endpoint, cfg.campo), cfg.campoForma, `${donde}: formaDeCampo no responde por la portada`);
    }

    // las dos banderas de lectura tienen que estar respaldadas por un atributo real
    if (cfg.identidadNombre) {
      assert.equal(attrs.nombre?.type, 'string', `${donde}: identidadNombre:true pero no hay atributo \`nombre\` de texto`);
    }
    assert.equal(!!cfg.tieneMarca, !!attrs.marca, `${donde}: tieneMarca="${cfg.tieneMarca}" pero \`marca\` en el esquema es "${attrs.marca ? attrs.marca.type : 'no existe'}"`);

    // al revés: la tabla no puede dejar un campo de medio sin nombrar
    const huespedes = Object.entries(attrs).filter(([, v]) => v?.type === 'media')
      .filter(([k]) => k !== cfg.campo && k !== cfg.campoMultiple)
      .map(([k, v]) => `${k}${v.multiple ? '[]' : ''}`);
    assert.deepEqual(huespedes, [], `${donde}: el esquema declara campos media que la tabla no nombra (${huespedes.join(', ')}); formaDeCampo diría null y el enlace se descarta en silencio`);
  }
});

test('I4 identidadNombre solo donde hay arte producido: el conjunto es {galeria}', () => {
  // Mi2: la justificación vieja ("lo declaran únicamente los content-type que
  // TIENEN un atributo \`nombre\`") era falsa de punto en blanco — medido en los
  // 22 esquemas, \`nombre\` lo tienen además proveedor, item-menu, complemento,
  // anfitrion, cultivo-polinizacion, configuracion-sitio y testimonio: 4 de los 6
  // endpoints de la tabla tienen \`nombre\` y solo 2 lo declaran identidad. El
  // criterio real es el DIRECTORIO con arte producido, y se fija acá.
  const conNombre = [...ESQUEMAS.porPlural.entries()]
    .filter(([, { attrs }]) => attrs.nombre?.type === 'string')
    .map(([plural]) => plural);
  assert.ok(conNombre.length > 4, `la premisa del teste se cayó: ${conNombre.length} endpoints con \`nombre\` (se esperaban más de 4)`);
  assert.deepEqual(
    Object.entries(ENDPOINTS_CON_MEDIO).filter(([, c]) => c.identidadNombre).map(([e, c]) => `${e}:${c.dir}`).sort(),
    ['productos:galeria', 'proyecto-meliponarios:galeria'],
    '`identidadNombre` prende solo en los directorios con arte producido',
  );
  assert.deepEqual(
    [...new Set(Object.values(ENDPOINTS_CON_MEDIO).filter((c) => c.campoMultiple).map((c) => c.dir))].sort(),
    ['galeria'],
    'DIRS_CON_SERIE (la derivación de la tabla) es exactamente {galeria}',
  );
});

// ===========================================================================
// I6 — los mutantes que sobrevivieron a la ronda de revisión.
//
// El reporte (`review-1eed876-643996d-report.md:94-103`) corrió veinte mutantes y
// ocho vivieron al 26/26. Cinco de ellos no necesitan infraestructura nueva: son
// una línea de `normalizar` y tres guardas del bloque de alias. Se fixturean acá,
// uno por mutante, con la línea que hay que romper escrita arriba de cada teste.
// ===========================================================================

const BITACORA_LA_CAJA = 'public/images/bitacora/bitacora-la-caja-de-angelita.webp';

test('I6/M5 los tokens de parada se botan de la identidad: `producto-de-angelita` es Angelita', () => {
  // Mutante: `media-manifest.mjs:325` — fuera `&& !STOP_TOKENS.has(t)` del último
  // `.filter` de `normalizar`. Sin ese filtro la raíz aporta `de` al residuo, y
  // `de` no está en ningún nombre: el nivel `NOMBRE` deja de emparejar y la tapa
  // cae a `pendientes` en silencio. Es el filtro que hace que `de`, `la`, `y` no
  // pesen en una identidad, y hasta ahora ningún fixture lo tocaba.
  const m = manifesto({
    archivos: ['public/images/galeria/producto-de-angelita.webp'],
    registros: [{ endpoint: 'productos', documentId: 'prd5', slug: null, nombre: 'Miel Angelita 120ml' }],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'productos',
    documentId: 'prd5',
    campo: 'imagen',
    archivo: 'public/images/galeria/producto-de-angelita.webp',
    origen: 'nombre',
  }]);
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.revisar, []);
});

test('I6/M6 las iniciales sueltas se botan: `proyecto-i-ambala` es el meliponario I.E. Ambalá', () => {
  // Mutante: `media-manifest.mjs:325` — fuera `!RE_INICIAL_SUELTA.test(t) &&`.
  // El fixture está medido para que SOLO muera ese filtro: la inicial suelta la
  // aporta el NOMBRE DEL ARCHIVO (`proyecto-i-ambala`), y `i` no está en
  // STOP_TOKENS, así que el otro filtro no la cubre. En el nombre de la BD la
  // abreviatura sí llega plegada (`I.E.` → `ie`, testeado arriba) y `ie` es token
  // de parada, o sea `i` no tiene manera de aparecer en el conjunto de identidad.
  const m = manifesto({
    archivos: ['public/images/galeria/proyecto-i-ambala-1.webp'],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'p6', slug: null, nombre: 'Meliponario I.E. Ambalá' }],
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'proyecto-meliponarios',
    documentId: 'p6',
    campo: 'galeria',
    archivo: 'public/images/galeria/proyecto-i-ambala-1.webp',
    origen: 'nombre',
  }]);
  assert.deepEqual(m.pendientes, []);
});

test('I6/M13 dos filas de alias sobre la misma tapa, en el orden de claves que sean, dan la MISMA salida', () => {
  // Mutante: `media-manifest.mjs:525` — fuera el `.sort()` de
  // `Object.keys(alias).sort()`. El comentario de la llave dice "orden de clave,
  // no de autoría"; sin el sort, quién gana depende del orden en que alguien
  // escribió el JSON de alias, y el manifiesto deja de ser función del insumo.
  // Las dos filas apuntan al MISMO registro (`d2`) y al MISMO campo, así que una
  // tiene que perder, y se nota cuál: gana la clave menor (`d2` < `public/…`).
  const porRutaPrimero = {
    [BITACORA_LA_CAJA]: { endpoint: 'bitacoras', slug: 'la-caja-de-angelita' },
    d2: { endpoint: 'bitacoras', campo: 'imagen', archivos: [BITACORA_LA_CAJA] },
  };
  const porIdPrimero = {
    d2: { endpoint: 'bitacoras', campo: 'imagen', archivos: [BITACORA_LA_CAJA] },
    [BITACORA_LA_CAJA]: { endpoint: 'bitacoras', slug: 'la-caja-de-angelita' },
  };
  const registros = [{ endpoint: 'bitacoras', documentId: 'd2', slug: 'la-caja-de-angelita' }];
  const a = manifesto({ archivos: [BITACORA_LA_CAJA], registros, alias: porRutaPrimero });
  const b = manifesto({ archivos: [BITACORA_LA_CAJA], registros, alias: porIdPrimero });
  assert.deepEqual(a, b, 'el manifiesto no puede depender del orden de escritura del alias');
  assert.deepEqual(a.enlazar, [{
    endpoint: 'bitacoras',
    documentId: 'd2',
    campo: 'imagen',
    archivo: BITACORA_LA_CAJA,
    origen: 'alias',
  }], 'la salida fija: gana la clave `d2`, o sea el sort NO es un no-op decorativo');
  assert.deepEqual(a.motivosAlias, [{
    archivo: BITACORA_LA_CAJA,
    motivo: 'el registro ya tiene otra fila de alias para imagen: d2:imagen',
  }]);
});

test('I6/M17 un miembro en disputa no escribe la galería: lo único que sale es la portada declarada', () => {
  // Mutante MEDIDO el 2026-09-27 (D5): `media-manifest.mjs:761` — volver el desempate una
  // salida temprana (`continue;` a secas), o sea «nunca hay disputa». Pone rojos TRES testes
  // (`F2-a un archivo que reclaman tres productos`, `F2-a una serie en disputa no escribe a
  // medias` y este); acá el síntoma exacto es que `-2` desaparece de `revisar`: `[]` contra la
  // fila que lo nombra con sus dos reclamantes. Borrada la detección ya no hay con qué frenar
  // la escritura, que es lo único que este envase no puede hacer a espaldas del dueño.
  //
  // D5 (2026-09-27) movió el orden en que un registro cobra sus campos —declarado antes
  // que deducible, no alfabético—, y acá se ve exactamente qué cambia y qué no: lo que
  // sigue bloqueado es el `galeria` (no se escribe una galería a medias), pero el `-1`
  // declarado ya no espera su turno alfabético y queda como `imagen`. Lo que se protege
  // igual que antes: `-2` no cae a `pendientes` y ningún archivo aparece en dos baldes.
  const uno = 'public/images/galeria/proyecto-valle-1.webp';
  const dos = 'public/images/galeria/proyecto-valle-2.webp';
  const m = manifesto({
    archivos: [uno, dos],
    registros: [
      { endpoint: 'proyecto-meliponarios', documentId: 'A', slug: 'valle', nombre: 'Valle Norte' },
      { endpoint: 'proyecto-meliponarios', documentId: 'B', slug: 'valle', nombre: 'Valle Norte' },
    ],
    alias: { [uno]: { endpoint: 'proyecto-meliponarios', slug: 'valle' } },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'proyecto-meliponarios', documentId: 'A', campo: 'imagen', archivo: uno, origen: 'alias',
  }], 'la serie no se escribe a medias: lo único que sale es la portada declarada');
  assert.deepEqual(m.revisar, [
    {
      archivo: dos,
      endpoint: 'proyecto-meliponarios',
      campo: 'galeria',
      motivo: 'varios registros reclaman el mismo archivo sin que la identidad lo desempate: proyecto-meliponarios/A, proyecto-meliponarios/B',
    },
  ], 'el miembro disputado va a `revisar`… y el salvado no vuelve a aparecer acá');
  assert.deepEqual(m.pendientes, [], 'y no cae a `pendientes`, que `aplicar()` sí escribe');
});

test('I6/M19 una fila de alias con un campo que la tabla no conoce no firma nada', () => {
  // Mutante: `media-manifest.mjs:566` — fuera `|| !campos.includes(campo)`. Sin
  // esa guarda la fila se firma con `campo: 'portada'`, sale en `enlazar`, y
  // `formaDeCampo()` responde `null`: en seco se imprime como enlace prometido y
  // en `--apply` se salta o rebota. El registro no trae `slug`, así que la tapa
  // NO puede enlazarse por regla: lo único que puede producir un enlace acá es la
  // fila de alias, y si la fila es inválida el balde queda vacío.
  const m = manifesto({
    archivos: [BITACORA_LA_CAJA],
    registros: [{ endpoint: 'bitacoras', documentId: 'd2', slug: null, nombre: 'La caja de Angelita' }],
    alias: { d2: { endpoint: 'bitacoras', campo: 'portada', archivos: [BITACORA_LA_CAJA] } },
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.motivosAlias, [{
    archivo: 'd2',
    motivo: 'la fila de d2 declara un campo que la tabla no conoce: portada',
  }]);
  assert.deepEqual(m.pendientes, [BITACORA_LA_CAJA], 'la tapa no se pierde: se reporta la razón y el archivo queda pendiente');
  assert.equal(formaDeCampo('bitacoras', 'portada'), null);
});

test('I6/M20 un archivo declarado en dos filas de alias no se reparte entre los dos registros', () => {
  // Mutante: `media-manifest.mjs:621` — fuera el control `duplicada`. El control estaba
  // escrito DOS veces: acá y dentro del lazo de `fila.archivos` (era `:587`). MEDIDO con
  // `m20-guards.mjs` sobre seis combinaciones: quitar la copia del lazo no cambiaba NADA
  // (0/6), porque al quitarla se va también su `break` y la lista llega igual a `:621`;
  // quitar `:621` sí cambiaba el resultado (2/6). Se borró la copia redundante y quedó un
  // solo control, puesto después de la bifurcación porque es el único que ve la vía por
  // RUTA — esa forma arma `rutas = [clave]` y nunca pasa por el lazo de validación.
  const m = manifesto({
    archivos: [BITACORA_LA_CAJA],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd2', slug: null, nombre: 'La caja de Angelita' },
      { endpoint: 'bitacoras', documentId: 'd9', slug: null, nombre: 'Otra caja' },
    ],
    alias: {
      d2: { endpoint: 'bitacoras', campo: 'imagen', archivos: [BITACORA_LA_CAJA] },
      d9: { endpoint: 'bitacoras', campo: 'imagen', archivos: [BITACORA_LA_CAJA] },
    },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'bitacoras',
    documentId: 'd2',
    campo: 'imagen',
    archivo: BITACORA_LA_CAJA,
    origen: 'alias',
  }]);
  assert.deepEqual(m.motivosAlias, [{
    archivo: 'd9',
    motivo: `${BITACORA_LA_CAJA} ya está declarado en otra fila de alias`,
  }]);
  assert.deepEqual(m.pendientes, []);

  // La forma que el control borrado no podía ver: una fila por ruta y otra por
  // `documentId` sobre la misma tapa. Sin el control, el archivo se reclama DOS VECES
  // desde el mismo registro y la disputa se nombra a sí misma (`A, A`).
  const tapa = 'public/images/galeria/proyecto-valle-1.webp';
  const mixto = manifesto({
    archivos: [tapa, 'public/images/galeria/proyecto-valle-2.webp'],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'A', slug: 'valle', nombre: 'Valle' }],
    alias: {
      A: { endpoint: 'proyecto-meliponarios', campo: 'galeria', archivos: [tapa] },
      [tapa]: { endpoint: 'proyecto-meliponarios', slug: 'valle' },
    },
  });
  assert.deepEqual(mixto.motivosAlias, [{
    archivo: tapa,
    motivo: `${tapa} ya está declarado en otra fila de alias`,
  }], 'la vía por ruta también pasa por el único control que existe');
  assert.deepEqual(mixto.enlazar, [{
    endpoint: 'proyecto-meliponarios', documentId: 'A', campo: 'galeria', archivo: tapa, origen: 'alias',
  }]);
  assert.equal(mixto.revisar.find((r) => /sin que la identidad lo desempate/.test(r.motivo)), undefined,
    'un documento no puede disputarse contra sí mismo');
});

// --- D6: `compartida` — la foto de una familia de ítems es UN archivo con N destinatarios.
// `cafe/menu.astro:361` pinta la imagen EN EL MODAL DE CADA VARIANTE, así que una sola
// declaración por familia deja seis variantes sin foto. Lo que el contrato no permitía
// era escribir el mismo archivo en varios documentos: `aliasPorArchivo` reserva UN dueño
// por archivo y la segunda fila se descarta (I6/M20). `compartida` es la declaración
// humana de que ese reparto es intencional, y solo eso: no afloja la regla de slug, no
// cruza endpoints y no cambia la PARTICIÓN (un archivo sigue en UN balde, aunque salga
// en N entradas de `enlazar`).
const FLORA = 'public/images/cafe-menu/aromatica-flora-nativa.webp';
const VARIANTES_FLORA = [
  { endpoint: 'item-menus', documentId: 'ilaaa6t3n72tmmordbef1a05', slug: 'aromatica-hierbabuena' },
  { endpoint: 'item-menus', documentId: 'p82ytt0sna9cqp7lopdjpbrz', slug: 'aromatica-limoncillo' },
  { endpoint: 'item-menus', documentId: 'p65brn4httpgu5amigxgovrh', slug: 'aromatica-guamo' },
];

test('F2-d la foto de familia declarada `compartida` escribe un enlace por variante', () => {
  const alias = {};
  for (const r of VARIANTES_FLORA) alias[r.documentId] = { endpoint: 'item-menus', campo: 'imagen', archivos: [FLORA], compartida: true };
  const m = manifesto({ archivos: [FLORA], registros: VARIANTES_FLORA, alias });
  assert.deepEqual(m.enlazar, VARIANTES_FLORA.map((r) => ({
    endpoint: 'item-menus', documentId: r.documentId, campo: 'imagen', archivo: FLORA, origen: 'alias',
  })));
  assert.deepEqual(m.motivosAlias, [], 'las tres filas se firmaron');
  assert.deepEqual(m.revisar, [], 'coincidencia declarada no es disputa');
  assert.deepEqual(m.pendientes, []);
});

test('F2-d `compartida` no abre la puerta a otro endpoint', () => {
  const m = manifesto({
    archivos: [FLORA],
    registros: [
      ...VARIANTES_FLORA,
      { endpoint: 'proveedors', documentId: 'upd2jasb6q4ouztydhjwicdl', slug: '' },
    ],
    alias: {
      ...Object.fromEntries(VARIANTES_FLORA.map((r) => [r.documentId, { endpoint: 'item-menus', campo: 'imagen', archivos: [FLORA], compartida: true }])),
      upd2jasb6q4ouztydhjwicdl: { endpoint: 'proveedors', campo: 'foto', archivos: [FLORA], compartida: true },
    },
  });
  assert.equal(m.enlazar.length, 3);
  assert.deepEqual(m.motivosAlias, [{
    archivo: 'upd2jasb6q4ouztydhjwicdl',
    motivo: `${FLORA} ya está declarado en otra fila de alias`,
  }]);
});

test('F2-d una fila compartida sin `compartida` en el otro lado sigue rechazada', () => {
  const m = manifesto({
    archivos: [FLORA],
    registros: VARIANTES_FLORA,
    alias: {
      [VARIANTES_FLORA[0].documentId]: { endpoint: 'item-menus', campo: 'imagen', archivos: [FLORA], compartida: true },
      [VARIANTES_FLORA[1].documentId]: { endpoint: 'item-menus', campo: 'imagen', archivos: [FLORA] },
    },
  });
  assert.deepEqual(m.enlazar, [{
    endpoint: 'item-menus', documentId: VARIANTES_FLORA[0].documentId, campo: 'imagen', archivo: FLORA, origen: 'alias',
  }]);
  assert.deepEqual(m.motivosAlias, [{
    archivo: VARIANTES_FLORA[1].documentId,
    motivo: `${FLORA} ya está declarado en otra fila de alias`,
  }], 'compartir tiene que decirlo las DOS filas');
});

test('F2-d `compartida` en una fila por ruta se descarta con su motivo', () => {
  const m = manifesto({
    archivos: [FLORA],
    registros: [VARIANTES_FLORA[0]],
    alias: { [FLORA]: { endpoint: 'item-menus', slug: 'aromatica-hierbabuena', compartida: true } },
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.motivosAlias, [{
    archivo: FLORA, motivo: `una fila por ruta no declara \`compartida\`: ${FLORA}`,
  }]);
  assert.deepEqual(m.pendientes, [FLORA]);
});

test('F2-d una fila compartida con dos archivos no se firma', () => {
  const m = manifesto({
    archivos: ['public/images/galeria/proyecto-ambala-1.webp', 'public/images/galeria/proyecto-ambala-2.webp'],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'A', slug: 'ambala', nombre: 'Ambalá' }],
    alias: {
      A: {
        endpoint: 'proyecto-meliponarios', campo: 'galeria', compartida: true,
        archivos: ['public/images/galeria/proyecto-ambala-1.webp', 'public/images/galeria/proyecto-ambala-2.webp'],
      },
    },
  });
  assert.deepEqual(m.motivosAlias, [{
    archivo: 'A', motivo: 'una fila compartida declara UN solo archivo: A',
  }]);
  // La fila se descartó, no el registro: la galería deducible por slug se escribe igual
  // (es otro balde de la misma decisión). Lo que no existe es un enlace firmado en alias.
  assert.equal(m.enlazar.find((e) => e.origen === 'alias'), undefined);
});

test('F2-d `compartida` solo vale en el campo de portada del endpoint', () => {
  const tapa = 'public/images/galeria/proyecto-ambala-1.webp';
  const m = manifesto({
    archivos: [tapa],
    registros: [{ endpoint: 'proyecto-meliponarios', documentId: 'A', slug: 'ambala', nombre: 'Ambalá' }],
    alias: { A: { endpoint: 'proyecto-meliponarios', campo: 'galeria', archivos: [tapa], compartida: true } },
  });
  assert.deepEqual(m.motivosAlias, [{
    archivo: 'A', motivo: '`compartida` solo se declara sobre el campo de portada de proyecto-meliponarios (imagen): A',
  }]);
  assert.equal(m.enlazar.find((e) => e.origen === 'alias'), undefined);
  assert.equal(m.enlazar.find((e) => e.campo === 'imagen'), undefined,
    'compartir una galería no es una portada disfrazada');
});

test('F2-d lo declarado compartida le gana a la regla de slug y la nota nombra a los dueños', () => {
  // El cuarto registro se llama exactamente como el archivo (`aromatica-flora-nativa`), así
  // que la REGLA lo reclama sin que nadie lo declare. Antes de `compartida` el archivo tenía
  // un solo dueño y los otros dos variantes se quedaban fuera; ahora los tres declarados
  // escriben y la regla pierde contra la declaración, que es lo que debe pasar.
  const m = manifesto({
    archivos: [FLORA],
    registros: [
      ...VARIANTES_FLORA,
      { endpoint: 'item-menus', documentId: 'ffnqvss36lkvq5s5ih17lc5a', slug: 'aromatica-flora-nativa' },
    ],
    alias: Object.fromEntries(VARIANTES_FLORA.map((r) => [r.documentId, {
      endpoint: 'item-menus', campo: 'imagen', archivos: [FLORA], compartida: true,
    }])),
  });
  assert.equal(m.enlazar.length, 3);
  assert.deepEqual(m.revisar, []);
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [{
    slug: 'aromatica-flora-nativa',
    documentId: 'ffnqvss36lkvq5s5ih17lc5a',
    // `etiqueta` es el `slug` sin prefijo de endpoint (formato del resto de las notas),
    // y el orden es el de procesamiento: empatados a nivel ALIAS, slug más largo primero.
    motivo: 'la tapa ya está asignada a aromatica-hierbabuena, aromatica-limoncillo, aromatica-guamo',
  }]);
});
