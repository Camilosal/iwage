// Anclas dinámicas: un `href={`/pagina#${expr}`}` solo funciona si la página de destino emite
// un `id=` que produzca ESA MISMA cadena. Medido en la BD de Strapi (2026-09-25): `slug` está
// vacío en el 100 % de las filas — 0 de 4 en `proveedors` y 0 de 9 documentos en
// `historia_visitantes` — así que los cuatro enlaces `/cafe/proveedores#${prov.slug}` apuntaban
// a `#` vacío y el de visitantes a un `documentId` que la página destino ni siquiera proyecta.
//
// La causa raíz no es cada enlace: es que la derivación del identificador estaba copiada cuatro
// veces (tres copias idénticas y una en `menu.astro` que además no plegaba acentos) y NINGUNA de
// ellas se usaba para las anclas. Este archivo mide eso, no los cuatro casos: la regla es que la
// derivación del `#${expr}` aparezca entre los `id=` de la página destino, y que `slugify` sea
// una sola. Las dos pruebas de inventario son centinelas: avisan cuando el censo se mueve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(RAIZ, 'src');
const PAGES = join(SRC, 'pages');

function archivosEn(dir) {
  const out = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const st = statSync(ruta);
    if (st.isDirectory()) out.push(...archivosEn(ruta));
    else if (/\.(astro|tsx?|jsx|js|mjs)$/.test(entrada)) out.push(ruta);
  }
  return out;
}

const enPages = (f) => relative(SRC, f).split('\\').join('/');

/**
 * Destino de un fragmento. `''` (misma página), `/cafe/menu` → `pages/cafe/menu.astro`,
 * `/cafe/proveedores` → `pages/cafe/proveedores/index.astro`. `null` = URL absoluta, que no es
 * una página de este sitio y por tanto no tiene ningún `id=` que exigir.
 */
function paginaDestino(path, origen) {
  if (/^[a-z]+:\/\//i.test(path) || path.startsWith('//')) return null;
  if (path === '') return origen;
  const limpio = path.replace(/\$\{[^`]*\}/g, '').replace(/\/+$/, '');
  if (!limpio.startsWith('/') || limpio.includes('${')) return undefined;
  const base = join(PAGES, limpio);
  for (const candidato of [`${base}/index.astro`, `${base}.astro`]) {
    if (existsSync(candidato)) return candidato;
  }
  return undefined;
}

/** Todo `href={`/ruta#${expr}`}` del árbol, con su destino resuelto y su expresión de ancla. */
function fragmentosDinamicos() {
  const hits = [];
  for (const archivo of archivosEn(PAGES)) {
    sinComentarios(readFileSync(archivo, 'utf8')).split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/href=\{`([^`]*)`\}/g)) {
        const plantilla = m[1];
        const [antesDelHash, ...resto] = plantilla.split('#');
        if (resto.length === 0) continue;
        const ancla = resto.join('#');
        if (!ancla.includes('${')) continue; // ancla literal: no la deriva el código
        const destino = paginaDestino(antesDelHash, archivo);
        if (destino === null) continue; // URL absoluta: no es una página de este sitio
        hits.push({
          sitio: `${enPages(archivo)}:${i + 1}`,
          destino,
          destinoTexto: antesDelHash,
          ancla,
        });
      }
    });
  }
  return hits;
}

test('el inventario de fragmentos dinámicos sigue midiendo lo que medimos', () => {
  // 3 × /cafe/proveedores#… + /cafe/menu#… + /cafe/visitantes#… + dos anclas dentro de la misma
  // página (clasificacion y perfiles). Si alguien añade un `#${expr}` más, esto se mueve.
  const todos = fragmentosDinamicos();
  assert.ok(
    todos.length >= 7,
    `se esperaban los 7 fragmentos dinámicos del censo (3 proveedores + menu + visitantes + 2 de página); hay ${todos.length}:\n${todos.map((h) => `    ${h.sitio} → ${h.destinoTexto}`).join('\n')}`,
  );
});

/**
 * Derivación de una expresión de ancla, sin el nombre de la variable del bucle: el enlace y la
 * ficha viven en archivos distintos y llaman `prov`, `p` o `item` a lo mismo. Lo que tiene que
 * coincidir es la cuenta, no el apellido.
 */
function derivacion(expr) {
  return expr
    .replace(/`/g, '')
    .replace(/\$\{([^{}]*)\}/g, '$1')
    .replace(/[A-Za-z_$][\w$]*\s*(?=\))/g, '_') // argumento de función
    .replace(/[A-Za-z_$][\w$]*(\??\.)+/g, '_$1') // receptor de acceso a propiedad
    .replace(/\s+/g, '');
}

/** Todo `id=` dinámico que una página emite, ya reducido a su derivación. */
function anclasDe(fuente) {
  const ids = new Set();
  const asignados = new Map();
  for (const m of fuente.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+?)\s*;?\s*$/gm)) {
    asignados.set(m[1], m[2]);
  }
  for (const m of fuente.matchAll(/id=\{((?:\$\{[^{}]*\}|[^{}])*)\}/g)) {
    let expr = m[1].trim();
    for (let i = 0; i < 3 && !expr.includes('(') && asignados.has(expr); i += 1) expr = asignados.get(expr).trim();
    ids.add(derivacion(expr));
  }
  return ids;
}

test('todo fragmento dinámico encuentra en su destino un ancla con la misma derivación', () => {
  const culpa = [];
  for (const hit of fragmentosDinamicos()) {
    if (!hit.destino) {
      culpa.push(`    ${hit.sitio}: destino "${hit.destinoTexto}" no resuelve a una página`);
      continue;
    }
    const fuente = sinComentarios(readFileSync(hit.destino, 'utf8'));
    const anclas = anclasDe(fuente);
    if (!anclas.has(derivacion(hit.ancla))) {
      culpa.push(
        `    ${hit.sitio}: #${hit.ancla.trim()} → ${enPages(hit.destino)} solo emite anclas [${[...anclas].join(' | ')}]`,
      );
    }
  }
  assert.equal(
    culpa.join('\n'),
    '',
    `ancla y destino calculan identificadores distintos:\n${culpa.join('\n')}`,
  );
});

test('slugify se declara una sola vez en src/', () => {
  const declaraciones = archivosEn(SRC)
    .filter((f) => /\bfunction\s+slugify\s*\(|\bslugify\s*=\s*\(/.test(sinComentarios(readFileSync(f, 'utf8'))))
    .map((f) => relative(SRC, f).split('\\').join('/'));
  assert.deepEqual(
    declaraciones,
    ['lib/cafe.ts'],
    'la derivación del identificador volvió a copiarse: anclas y rutas [slug] pueden discrepar',
  );
});

test('las historias de relleno de la portada existen en la página de destino', () => {
  // Con `slug` vacío en todas las filas, la ancla se deriva del título. Si la portada renombrara
  // un título que la página destino no tiene, el deep link moriría sin error visible: los dos
  // literales de relleno tienen que decir lo mismo.
  const Titulos = (archivo, desde, hasta) => {
    const fuente = readFileSync(join(SRC, archivo), 'utf8');
    const ini = fuente.indexOf(desde);
    assert.notEqual(ini, -1, `${archivo} perdió el literal "${desde}"`);
    const fin = fuente.indexOf(hasta, ini);
    assert.notEqual(fin, -1, `${archivo} no cierra el literal "${desde}"`);
    return [...fuente.slice(ini, fin).matchAll(/titulo:\s*'([^']+)'/g)].map((m) => m[1]);
  };
  const home = Titulos('pages/cafe/index.astro', 'FALLBACK_HISTORIAS_HOME', '\n];');
  const destino = Titulos('pages/cafe/visitantes.astro', 'const FALLBACK:', '\n};');
  assert.ok(home.length > 0 && destino.length > 0, 'algún inventario de relleno quedó vacío');
  const huerfanas = home.filter((t) => !destino.includes(t));
  assert.deepEqual(
    huerfanas,
    [],
    `la portada enlaza historias que /cafe/visitantes no cuenta: ${huerfanas.join(' | ')}`,
  );
});
