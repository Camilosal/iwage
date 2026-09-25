/**
 * Parte pura del importador: qué tapa se enlaza a qué registro y qué queda pendiente.
 * Se testea aquí porque es la única decisión que no puede revertirse después:
 * un enlace equivocado en la BD se ve en el sitio.
 *
 * Los tres primeros testes son los de la brief (task-10-brief.md, Step 1) y sus
 * aserciones no se aflojan ni se tocan: son byte-idénticos a los de la brief, y eso
 * es propiedad revisada.
 *
 * Los diez siguientes fijan lo que la brief no decía o decía mal, resuelto en el
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
 *     y sale etiquetado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifesto } from '../strapi/scripts/lib/media-manifest.mjs';

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

test('un alias que no se puede firmar no escribe: va a revisar con el motivo exacto', () => {
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
  assert.equal(sinRegistro.revisar.length, 1);
  assert.match(sinRegistro.revisar[0].motivo, /ningún registro de la lectura trae bitacoras\/chef-de-miel/);

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
  assert.deepEqual(fuera.revisar, [{
    archivo: 'public/images/galeria/proyecto-ambala-1.webp',
    motivo: 'el alias saca public/images/galeria/proyecto-ambala-1.webp del directorio de bitacoras (bitacora)',
  }]);
});
