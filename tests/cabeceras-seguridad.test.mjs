// Las siete cabeceras de seguridad estaban declaradas al nivel `server` de `nginx.conf`, y aun
// así NO llegaban a ninguna respuesta con cuerpo. Medido el 2026-10-06 contra el borde:
// `curl -sI https://iwage.co/meliponas/tienda` → cero cabeceras; la réplica con el arreglo → seis.
//
// La causa es la regla de herencia de `add_header` en nginx: un `location` herede los
// `add_header` del bloque envolvente **solo si no declara ningún `add_header` propio**; la
// herencia es todo-o-nada, no se suma. Como los diez locations del archivo declaran al menos uno
// (Cache-Control o X-Cache-Status), perder las cabeceras era el comportamiento correcto del motor.
// La prueba de que la regla era eso y no otra cosa: las puertas 301 legacy, que son los únicos
// locations sin `add_header` propio, SÍ las llevaban.
//
// El arreglo es `nginx/security-headers.conf`, incluido en el `server` y en cada location con
// `add_header` propio. Este archivo guarda lo que el motor no puede: que la próxima vez que
// alguien añada un location con `add_header` y olvide el include, el defecto no vuelva en
// silencio. `nginx -t` pasa igual en los dos casos; la única señal es esta aserción.
//
// Los tres locations que reenvían a Strapi están excluidos a propósito, y la exclusión también
// se prueba: Strapi emite su propia CSP (medido en `:1337`) con `script-src 'self'` y `img-src
// … blob:`. Con dos cabeceras CSP en una misma respuesta el navegador aplica la INTERSECCIÓN,
// así que sumar la nuestra le quitaba `blob:` a las previsualizaciones de la biblioteca de
// medios al panel que usa el dueño. Ahí menos cabeceras es más seguro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

const CONFIG = leer('nginx.conf');
const SNIPPET = leer('nginx/security-headers.conf');
const DOCKERFILE = leer('Dockerfile');
const RUTA = '/etc/nginx/snippets/security-headers.conf';

const CABECERAS = [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'X-XSS-Protection',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Content-Security-Policy',
];

// Locations que reenvían a Strapi: llevan la cabecera desde el propio Strapi.
const LOS_DE_STRAPI = [
  '^~ /admin',
  '~ ^/(content-manager|content-type-builder|upload|users-permissions|i18n|email)(/|$)',
  '^~ /uploads',
];

// Censo medido el 2026-10-06. Mover esta lista es un acto deliberado, no un efecto secundario.
const LOS_CUBIERTOS = [
  '= /api/health',
  '~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$',
  '~* ^/tierras/(propiedades|api)',
  '~* ^/(naturaleza|gestion)/.*(reserva|booking)',
  '~* ^/api/(contacto|lead)',
  '/api/',
  '/',
];

/** `#` abre comentario hasta el fin de línea, salvo dentro de comillas. */
function sinComentario(linea) {
  let dentro = null;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (dentro) {
      if (c === '\\') i += 1;
      else if (c === dentro) dentro = null;
    } else if (c === '"' || c === "'") dentro = c;
    else if (c === '#') return linea.slice(0, i);
  }
  return linea;
}

/**
 * Locaciones del `server`, con su cuerpo.
 *
 * No es un parser de nginx: cuenta llaves por línea después de quitar comentarios. Válido porque
 * en ESTE archivo ninguna cadena contiene llaves (la CSP usa `();` y los regex usan `()|$`, nunca
 * `{}`); si algún día una línea las necesita, esta función devuelve basura y los testes se ponen
 * rojos a la vista, que es como deben fallar.
 */
function locaciones(texto) {
  const out = [];
  let profundidad = 0;
  let actual = null;
  for (const linea of texto.split('\n').map(sinComentario)) {
    const abre = (linea.match(/{/g) || []).length;
    const cierra = (linea.match(/}/g) || []).length;
    const m = /^\s*location\s+(.+?)\s*\{/.exec(linea);
    // La profundidad a la que abre el bloque se anota UNA sola vez, en la apertura: compararla
    // contra la de cada línea haría que ningún bloque cerrara y la lista quedara vacía.
    if (m && !actual) actual = { nombre: m[1], inicio: profundidad, lineas: [] };
    if (actual) actual.lineas.push(linea);
    profundidad += abre - cierra;
    if (actual && profundidad === actual.inicio) {
      out.push({ nombre: actual.nombre, cuerpo: actual.lineas.join('\n') });
      actual = null;
    }
  }
  return out;
}

const LOCS = locaciones(CONFIG);

test('los diez locations con add_header propio están clasificados: cubierto, o de Strapi', () => {
  const declaran = LOCS.filter((l) => /\badd_header\b/.test(l.cuerpo));
  assert.equal(declaran.length, 10, `esperaba 10 locations con add_header, hay ${declaran.length}`);

  const esperados = new Set([...LOS_CUBIERTOS, ...LOS_DE_STRAPI]);
  const noms = declaran.map((l) => l.nombre);
  for (const n of noms) assert.ok(esperados.has(n), `location nuevo sin clasificar: ${n}`);

  for (const l of declaran) {
    if (LOS_DE_STRAPI.includes(l.nombre)) continue;
    assert.ok(l.cuerpo.includes(RUTA), `le faltan las cabeceras a "location ${l.nombre}"`);
  }
});

test('los tres de Strapi NO incluyen el snippet: dos CSP en una respuesta se intersectan', () => {
  for (const nombre of LOS_DE_STRAPI) {
    const l = LOCS.find((x) => x.nombre === nombre);
    assert.ok(l, `desapareció "location ${nombre}"`);
    assert.ok(!l.cuerpo.includes(RUTA), `location ${nombre} recibe nuestra CSP encima de la de Strapi`);
  }
});

test('el nivel server incluye el snippet una sola vez, para los 301 y los errores', () => {
  const dentroDeLoc = LOCS.reduce((acc, l) => acc + l.cuerpo.split(RUTA).length - 1, 0);
  const enTodo = CONFIG.split(RUTA).length - 1;
  assert.equal(
    enTodo - dentroDeLoc,
    1,
    `el include del server debe aparecer exactamente una vez afuera de los locations (hay ${enTodo - dentroDeLoc})`,
  );
});

test('el snippet declara las siete cabeceras, cada una una vez, todas con always', () => {
  const sinC = SNIPPET.split('\n').map(sinComentario).join('\n');
  const declaraciones = [...sinC.matchAll(/add_header\s+"?([A-Za-z-]+)"?/g)].map((m) => m[1]);
  assert.deepEqual(
    declaraciones.slice().sort(),
    CABECERAS.slice().sort(),
    'la lista de cabeceras del snippet cambió respecto de lo medido',
  );
  for (const c of CABECERAS) {
    assert.equal(
      declaraciones.filter((d) => d === c).length,
      1,
      `"${c}" declarada ${declaraciones.filter((d) => d === c).length} veces`,
    );
  }
  // Sin `always`, nginx solo manda la cabecera en 2xx/3xx: las puertas 301 y los 404 se
  // quedarían fuera, que es justo lo que pasó con HSTS y la CSP al principio.
  const sinAlways = sinC
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('add_header') && !/always;$/.test(l));
  assert.deepEqual(sinAlways, [], 'add_header sin `always;` en el snippet');
});

test('el Dockerfile instala el snippet en la ruta exacta que referencia el include', () => {
  // Un config puede pasar `nginx -t` en el repo y no arrancar la imagen si la ruta del include
  // no coincide con el destino del COPY. Aquí se prueba la coincidencia, no la intención.
  const copia = DOCKERFILE.split('\n').find((l) => /^\s*COPY\b.*security-headers\.conf/.test(l));
  assert.ok(copia, 'el Dockerfile no copia el snippet');
  assert.ok(copia.trim().endsWith(RUTA), `el COPY no deja el archivo en ${RUTA}: ${copia.trim()}`);
  assert.ok(copia.includes('nginx/security-headers.conf'), 'el COPY no lee nginx/security-headers.conf');
});

test('lo que no declara add_header propio no necesita el include: los 301 heredan', () => {
  const sinAddHeader = LOCS.filter((l) => !/\badd_header\b/.test(l.cuerpo));
  assert.ok(sinAddHeader.length >= 12, `esperaba al menos 12 locations de retorno, hay ${sinAddHeader.length}`);
  for (const l of sinAddHeader) {
    assert.ok(!l.cuerpo.includes(RUTA), `"location ${l.nombre}" duplica las cabeceras que ya hereda`);
  }
});
