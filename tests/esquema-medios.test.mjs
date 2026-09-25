/**
 * Candado del esquema consolidado (Task 11).
 *
 * Por qué existe: en este repo no hay `tsc` ni `astro check` (`astro build` solo borra
 * tipos), así que un `schema.json` mal escrito no rompe nada y el error aparece meses
 * después, en el rebuild de Strapi. Este teste no compila ni levanta el CMS: lee los
 * `strapi/src/api/<ct>/content-types/<ct>/schema.json` desde disco y fija, en texto, la
 * forma que ya quedó consolidada. Es la única revisión mecánica posible del esquema sin
 * tocar producción. (Y nada de escribir rutas con comodín de carpeta dentro de estos
 * comentarios: el asterisco seguido de barra cierra el bloque.)
 *
 * Alcance medido (inventario del Task 11, 2026-09-25): once campos.
 *   Grupo A — portada string → media simple:  bitacora, producto, lote-miel,
 *             experimento, cultivo-polinizacion, proyecto-meliponario (los seis `.imagen`).
 *   Grupo B — galería json → media múltiple:  producto, lote-miel, cultivo-polinizacion,
 *             proyecto-meliponario (`.galeria`) y `anfitrion.galeria_fotos` → `galeria`.
 *
 * NO están aquí, a propósito, porque siguen gateados por el dueño:
 *   `hero-configuracion.imagen` (39/39 rutas de `public/images/` del repo de Astro:
 *   cambiar el tipo apaga los 7 hérores) y `anfitrion.foto_territorio` (2 hotlinks de
 *   Unsplash que la decisión F1 manda retirar, no hospedar) → Paso H.
 *   `experiencia.galeria_urls` es la única galería de las 2 experiencias publicadas
 *   (medido: `experiencia.galeria`, ya media múltiple, está vacío) → no se borra aquí.
 *   Grupo C (embeds y twins `*_url`) → Tareas 12b/12c con el `--apply`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = fileURLToPath(new URL('../strapi/src/api', import.meta.url));

/** Grupo A: portadas que pasan a `media` de una sola pieza. */
const GRUPO_A = [
  ['bitacora', 'imagen'],
  ['producto', 'imagen'],
  ['lote-miel', 'imagen'],
  ['experimento', 'imagen'],
  ['cultivo-polinizacion', 'imagen'],
  ['proyecto-meliponario', 'imagen'],
];

/** Grupo B: galerías que pasan a `media` múltiple con video. */
const GRUPO_B = [
  ['producto', 'galeria'],
  ['lote-miel', 'galeria'],
  ['cultivo-polinizacion', 'galeria'],
  ['proyecto-meliponario', 'galeria'],
  ['anfitrion', 'galeria'],
];

const LOS_ONCE = [...GRUPO_A, ...GRUPO_B];

/** Los once, en `ct.campo`, para que cada mensaje de fallo nombre al culpable. */
const id = ([ct, campo]) => `${ct}.${campo}`;

/** Todos los `schema.json` de `src/api`, indexados por el nombre del módulo. */
function esquemas() {
  const salir = new Map();
  for (const modulo of readdirSync(API, { withFileTypes: true })) {
    if (!modulo.isDirectory()) continue;
    const cts = join(API, modulo.name, 'content-types');
    if (!existsSync(cts)) continue;
    for (const ct of readdirSync(cts)) {
      const hoja = join(cts, ct, 'schema.json');
      if (!existsSync(hoja)) continue;
      const esquema = JSON.parse(readFileSync(hoja, 'utf8'));
      salir.set(modulo.name, { hoja, esquema, attrs: esquema.attributes || {} });
    }
  }
  return salir;
}

const ESQUEMAS = esquemas();

/** Atributo de un content-type, o `undefined`. */
function attr(ct, campo) {
  return ESQUEMAS.get(ct)?.attrs[campo];
}

function nombre(ct, campo) {
  return `${ct}/content-types/${ct}/schema.json → "${campo}"`;
}

test('el barrido encuentra los 7 content types que canda el Task 11', () => {
  const haceFalta = new Set([...LOS_ONCE.map(([ct]) => ct)]);
  const faltantes = [...haceFalta].filter((ct) => !ESQUEMAS.has(ct));
  assert.deepEqual(
    faltantes,
    [],
    `falta un content-type barrido (${faltantes.join(', ')}): el candado se quedaría mirando a otro lado`,
  );
});

test('Grupo A: las seis portadas son media simple de imágenes y no required', () => {
  for (const par of GRUPO_A) {
    const [ct, campo] = par;
    const a = attr(ct, campo);
    assert.ok(a, `${nombre(ct, campo)}: desapareció del esquema. Era portada y debe seguir ahí, ahora como media`);
    assert.equal(a.type, 'media', `${id(par)}: sigue en "${a.type}". Grupo A lo quiere "media"`);
    assert.equal(a.multiple, false, `${id(par)}: multiple debe ser exactamente false (portada = una pieza)`);
    assert.equal(a.required, false, `${id(par)}: required false. Con required:true nada se publica hasta subir material`);
    assert.deepEqual(a.allowedTypes, ['images'], `${id(par)}: allowedTypes debe ser exactamente ["images"]`);
  }
});

test('Grupo B: las cinco galerías son media múltiple con imágenes y videos', () => {
  for (const par of GRUPO_B) {
    const [ct, campo] = par;
    const a = attr(ct, campo);
    assert.ok(a, `${nombre(ct, campo)}: no existe. Grupo B lo declara aquí, no en otro lado`);
    assert.equal(a.type, 'media', `${id(par)}: sigue en "${a.type}". Grupo B lo quiere "media"`);
    assert.equal(a.multiple, true, `${id(par)}: multiple debe ser exactamente true (conjunto)`);
    assert.equal(a.required, false, `${id(par)}: required false, el conjunto puede quedar vacío`);
    assert.deepEqual(a.allowedTypes, ['images', 'videos'], `${id(par)}: allowedTypes debe ser exactamente ["images","videos"]`);
  }
});

test('anfitrion: la galería se llama `galeria` y `galeria_fotos` ya no está', () => {
  const attrs = ESQUEMAS.get('anfitrion').attrs;
  assert.ok(attrs.galeria, 'anfitrion.galeria no existe: el rename desde `galeria_fotos` no se hizo');
  assert.equal(
    Object.prototype.hasOwnProperty.call(attrs, 'galeria_fotos'),
    false,
    'anfitrion.galeria_fotos sigue declarado: quedarían dos galerías editables en la misma ficha. ' +
      'Ojo con lo que implica quitarlo: Strapi 5.55.0 BORRA la columna al arrancar ' +
      '(node_modules/@strapi/database/dist/schema/builder.mjs:277-279, y dropColumn solo es no-op ' +
      'con forceMigration falso; el default es true en @strapi/database/dist/index.js:143 y ' +
      'strapi/config/database.ts no fija settings). La única copia de esos 2 valores es el dump ' +
      'iwage-pre-f2-2026-09-25.sql. Son hotlinks de Unsplash que la decisión F1 mandaba quitar, ' +
      'pero el retiro se hace con el dump en la mano, no después.',
  );
});

test('ninguno de los once campos quedó declarado json ni string', () => {
  for (const par of LOS_ONCE) {
    const a = attr(...par);
    assert.ok(a, `${id(par)}: no existe, no se puede candar`);
    assert.ok(
      a.type !== 'json' && a.type !== 'string',
      `${id(par)}: sigue como "${a.type}". Las tres representaciones que había que retirar son string, json y el twin _url`,
    );
  }
});

test('ningún schema.json de src/api usa allowedKinds (las cuatro claves de media, y ninguna más)', () => {
  const culpables = [];
  for (const [modulo, { hoja, attrs }] of ESQUEMAS) {
    const pila = Object.entries(attrs);
    while (pila.length) {
      const [clave, valor] = pila.pop();
      if (valor && typeof valor === 'object') {
        if (Object.prototype.hasOwnProperty.call(valor, 'allowedKinds')) {
          culpables.push(`${modulo}: attribute "${clave}" declara allowedKinds (${hoja})`);
        }
        for (const interna of Object.entries(valor)) pila.push(interna);
      }
    }
  }
  assert.deepEqual(culpables, [], 'Strapi v5 entiende type/multiple/required/allowedTypes; allowedKinds no es una clave de media');
});

/**
 * Regla de un solo campo editable de portada, limitada a los once ya consolidados:
 * no es que en el repo no queden twins `*_url` (complemento.imagen_url,
 * experiencia.imagen_hero_url y anfitrion.foto_perfil_url siguen ahí, son Grupo C y
 * viven en la Tarea 14 con su `--apply`). Lo que se canda aquí es que a un campo
 * convertido no se le vuelva a sembrar un twin en el mismo esquema.
 */
test('ninguno de los once campos convertidos tiene un twin `*_url` en el mismo esquema', () => {
  const culpables = [];
  for (const par of LOS_ONCE) {
    const [ct, campo] = par;
    const twin = `${campo}_url`;
    if (attr(ct, twin)) culpables.push(`${ct}: "${campo}" (media) convive con "${twin}" (portada duplicada)`);
  }
  assert.deepEqual(culpables, [], 'dos campos editables para la misma portada: el mismo foco de dispersión que este task cerró');
});
