/**
 * D8 · el café lee de Strapi y no de `public/`.
 *
 * Cuatro cosas, cada una con sus dientes declarados:
 *
 *  1. `itemImage()` ya no puede tener regla por nombre. Se llama con los mismos pares
 *     (`nombre`, `familia`) que casaban con las 10 entradas y las 10 `nombre.includes(...)` de
 *     `LOCAL_IMAGES`, con `imagen: null`, y tiene que devolver `null`. Con la tabla restaurada
 *     devuelve `/images/cafe-menu/….webp` en los 12 casos. El par de teste 1b es el inverso: sin
 *     regla pero con medio de Strapi, tiene que salir la ruta — si alguien jubila también la
 *     lectura, esto se pone rojo.
 *  2. La cota de lo que a PROPÓSITO sobrevive, medida como CONJUNTO y no como presencia: después
 *     de D8 quedan exactamente 6 archivos de `public/images/cafe-menu/` mencionados en código de
 *     `src/` (los 4 `visitante-*` que todavía se pintan porque `historia-visitantes` responde 403,
 *     y las 2 `promo-*` que ningún content-type tiene campo donde recibir). Un séptimo —por ejemplo
 *     el `proveedor-meliponario.webp` que se acabó de jubilar, o un relleno devuelto a
 *     `menu.astro`— pone rojo el teste; que alguno desaparezca también. Contar el conjunto es la
 *     única forma de que la guarda no se satisfaga sola.
 *  3. El relleno que se decidió CONSERVAR sigue ahí con sus filas: 17 en `fallbackItems` y 4 en
 *     `fallbackProveedores`, con `imagen: null` / `foto: null`. Este teste es la diferencia entre
 *     «jubilé las imágenes» y «jubilé la página»: si alguien borra las filas enteras, se rompe acá.
 *  4. Las únicas piezas de cafe-menu en disco son las 2 `promo-*` consignadas. Eran 19:
 *     `pan-yuca-miel` se retiró el 2026-10-03 por decisión del dueño y las 16 gemelas
 *     se retiraron tras el redeploy de ese día (Task 16), con respaldo en
 *     /home/ubuntu/backup/huerfanas-f3-2026-10-03/.
 *
 * Los comentarios se quitan antes de casar (`tests/helpers/sin-comentarios.mjs`), así que la
 * prosa de este propio repo —que cita estos archivos para explicar por qué ya no están— no puede
 * satisfacer la guarda 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';
import { itemImage, proveedorFoto, historiaImagen } from '../src/lib/cafe.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const fuente = (rel) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

// Aguja armada en dos mitades: el texto de ESTE archivo no contiene la cadena contigua, así que
// una búsqueda futura del patrón sobre el repo no se cuenta a sí misma como uso.
const PIEZA = ['cafe', '-menu/'].join('');
const RE_PIEZA = new RegExp(`/images/${PIEZA}([a-z0-9-]+)\\.webp`, 'g');

/**
 * Los 12 modos en que `LOCAL_IMAGES` resolvía sin que Strapi trajera nada: 6 por `familia` (claves
 * de la tabla) y 6 por `nombre` (las reglas `includes`). Reproducidos como DATOS, no como código,
 * porque lo que se fija es el comportamiento de `itemImage` una vez ida la tabla.
 */
const CASOS_QUE_ANTES_PINTABAN = [
  ['Café de origen Ambalá', 'cafe-ambala'],
  ['Espresso doble', 'espresso'],
  ['Miel de Angelita con café', 'miel-cafe'],
  ['Latte de miel y canela', 'latte-miel'],
  ['Aromática de flora nativa', 'aromatica-flora'],
  ['Cold brew Ambalá', 'cold-brew'],
  ['Chocolate de cacao local', 'chocolate-local'],
  ['Pan de yuca y miel', 'queso-cumbre'],
  ['Queso de la Cumbre con arepa', null],
  ['Café de origen Ambalá', null],
  ['Cold brew de cosecha', null],
  ['Latte con miel', null],
];

test('itemImage: sin medio de Strapi devuelve null aunque el nombre y la familia sean los de la regla vieja', () => {
  for (const [nombre, familia] of CASOS_QUE_ANTES_PINTABAN) {
    assert.equal(
      itemImage({ nombre, familia, imagen: null }),
      null,
      `${nombre} (familia=${familia ?? '—'}) volvió a pintarse con un archivo de public/: la regla por nombre regresó`,
    );
  }
});

test('itemImage: con medio de Strapi devuelve la ruta reducida, y lo externo no se pinta', () => {
  assert.equal(itemImage({ nombre: 'Espresso doble', imagen: { url: '/uploads/espresso.webp' } }), '/uploads/espresso.webp');
  assert.equal(
    itemImage({ nombre: 'Espresso doble', familia: 'espresso', imagen: { url: 'http://iwage_strapi:1337/uploads/2026/05/e.webp' } }),
    '/uploads/2026/05/e.webp',
  );
  assert.equal(
    itemImage({ nombre: 'Café de origen Ambalá', familia: 'cafe-ambala', imagen: { url: 'https://images.unsplash.com/photo-1447933601445?w=800' } }),
    null,
    'un hotlink no se pinta, y sin regla por nombre no hay nada detrás que lo tape',
  );
});

test('proveedorFoto e historiaImagen: leen la relación de Strapi y el vacío es null', () => {
  assert.equal(proveedorFoto({ foto: { url: '/uploads/proveedor-meliponario.webp' } }), '/uploads/proveedor-meliponario.webp');
  assert.equal(proveedorFoto({ foto: null }), null);
  assert.equal(proveedorFoto({}), null);
  assert.equal(historiaImagen({ imagen: { url: 'https://iwage.co/uploads/visitante-colibri.webp' } }), '/uploads/visitante-colibri.webp');
  assert.equal(historiaImagen({ imagen: null }), null);
});

test('cafe.ts no conoce ningún archivo de public/: ni la tabla ni las rutas', () => {
  const codigo = fuente('src/lib/cafe.ts');
  assert.doesNotMatch(codigo, /LOCAL_IMAGES/);
  assert.doesNotMatch(codigo, /\/images\//);
  assert.doesNotMatch(codigo, /nombre\.includes\(/);
});

test('src/ menciona exactamente las 2 piezas de cafe-menu que se consignaron, ni una más ni una menos', () => {
  const usadas = new Set();
  for (const rel of archivosSrc()) {
    for (const m of fuente(rel).matchAll(RE_PIEZA)) usadas.add(m[1]);
  }
  const ESPERADAS = [
    'promo-duos-perfectos',
    'promo-reutilizable',
  ];
  assert.deepEqual(
    [...usadas].sort(),
    ESPERADAS,
    `las 4 proveedor-* y las 9 de ítems se jubilaron con D8, y las 4 visitante-* con D9 (el relleno no se pintaba en producción: el sitio manda token y la BD contesta 200); si vuelven acá es un relleno de imagen, y la decisión aprobada es «Strapi único dueño, sin fallbacks de imagen»`,
  );
  // Y la misma cota sin depender de cómo esté escrita la ruta: los 13 archivos que D8 jubiló no
  // aparecen por su nombre en ningún archivo de `src/`. Un `'/images/cafe-' + 'menu/x.webp'` le
  // escapa al regex de arriba pero no a este, que busca el tallo del archivo.
  const JUBILADAS = [
    'cafe-origen-ambala', 'espresso-doble', 'miel-angelita-cafe', 'latte-miel-canela',
    'aromatica-flora-nativa', 'cold-brew-ambala', 'chocolate-cacao-local', 'pan-yuca-miel',
    'queso-cumbre-arepa',
    'proveedor-meliponario', 'proveedor-familia-cardona', 'proveedor-finca-cumbre', 'proveedor-cacao-espinal',
    'visitante-colibri', 'visitante-angelitas', 'visitante-guamo', 'visitante-dona-nelly',
  ];
  assert.equal(JUBILADAS.length, 17, '9 láminas de ítem + 4 de proveedor + 4 de visitante: si cambia la cuenta, este teste se lee otra vez');
  for (const tallo of JUBILADAS) {
    const vivas = archivosSrc().filter((rel) => fuente(rel).includes(tallo));
    assert.deepEqual(vivas, [], `${tallo}.webp volvió a nombrarse en ${vivas.join(', ')}`);
  }
});

function archivosSrc() {
  const out = [];
  const pila = [join(RAIZ, 'src')];
  while (pila.length) {
    const dir = pila.pop();
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) pila.push(ruta);
      else if (/\.(astro|ts|tsx)$/.test(nombre)) out.push(ruta.slice(RAIZ.length + 1));
    }
  }
  return out;
}

test('el relleno conserva sus filas: 17 preparaciones y 4 proveedores, solo sin imagen', () => {
  const menu = fuente('src/pages/cafe/menu.astro');
  assert.equal([...menu.matchAll(/^  \{ id: \d+, documentId: '\d+'/gm)].length, 17, 'las 17 filas del relleno no son un seed que borrar: con Strapi caído son el menú');
  assert.equal([...menu.matchAll(/imagen: null/g)].length, 17);
  assert.equal([...menu.matchAll(/imagen:\s*\{/g)].length, 0, 'un literal de imagen volvió a fallbackItems');

  const home = fuente('src/pages/cafe/index.astro');
  assert.equal([...home.matchAll(/foto: null/g)].length, 4);
  assert.equal([...home.matchAll(/foto:\s*\{/g)].length, 0, 'un literal de foto volvió a fallbackProveedores');
  assert.equal([...home.matchAll(/^  \{ nombre: '/gm)].length, 4);

  // Las 4 historias del home: D9 jubiló sus láminas (se pintaban desde Strapi, no desde public/),
  // las filas siguen siendo el texto que se sirve con la base caída.
  assert.equal([...home.matchAll(/imagen: null/g)].length, 4, 'FALLBACK_HISTORIAS_HOME perdió o ganó filas');
  assert.equal([...home.matchAll(/imagen:\s*\{/g)].length, 0, 'un literal de imagen volvió a FALLBACK_HISTORIAS_HOME');

  const visitors = fuente('src/pages/cafe/visitantes.astro');
  assert.equal([...visitors.matchAll(/^      imagen: null,$/gm)].length, 9, 'las 9 historias del relleno de visitantes: 3 por categoría');
  assert.equal([...visitors.matchAll(/imagen:\s*'/g)].length, 0, 'un literal de imagen volvió al FALLBACK de visitantes.astro');
});

test('las 2 piezas de cafe-menu que quedan en disco son exactamente las promo-* consignadas', () => {
  const piezas = readdirSync(join(RAIZ, 'public/images/cafe-menu')).filter((f) => /\.webp$/i.test(f));
  // 18 hasta el redeploy del 2026-10-03 (Task 16): verificadas las 16 gemelas —el bundle nuevo
  // no las emite, el crawl de las 180 URLs no las pinta y su par vive en /uploads— se retiraron
  // con respaldo en /home/ubuntu/backup/huerfanas-f3-2026-10-03/. `pan-yuca-miel` había caído
  // el mismo día por decisión del dueño. Quedan las 2 promos, que son contenido servido.
  assert.deepEqual(piezas.sort(), ['promo-duos-perfectos.webp', 'promo-reutilizable.webp'],
    `cafe-menu tiene ${piezas.join(', ')}; las promos se pintan desde la plantilla y no tienen campo en Strapi`);
});
