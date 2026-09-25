/**
 * Censo de literales de medio: si `src/` escribe una ruta de sitio, el archivo tiene que estar
 * en `public/`.
 *
 * La clase de defecto no es nueva ni teórica. `ogImageDe()` arma `https://iwage.co/images/hero-
 * ${slug}.webp` con cualquier slug que le pasen: la URL sale absoluta, bien formada, y puede
 * apuntar a un 404. `tests/og-image-absoluta.test.mjs` verifica la forma; acá se verifica que el
 * archivo exista. Lo mismo vale para los literales escritos a mano en plantillas —
 * `src/pages/index.astro:58` fija `hero-ecosistema.webp` sin pasar por la función.
 *
 * Por qué se barriendo FUERA de bloques comentados (la lección de la fila 6 del censo, que leía
 * 47 donde había 48): `src/pages/meliponas/index.astro:163-164` declara
 * `/videos/meliponario.{webm,mp4}` dentro de un `{/* … *\/}` y esos archivos no existen. Un
 * barrido tonto contaría dos huecos rotos en una superficie que no se sirve, y el día que el
 * dueño decida el Task 15 el número se movería sin que nadie tocara nada vivo. El bloque es
 * materia de esa decisión, no de esta puerta.
 *
 * Las plantillas no tienen `ts-node` que las revise, así que la única evidencia posible es de
 * texto fuente + disco. Correr: `npm test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fueraDeComentarios } from '../docs/superpowers/metrics/censo/huerfanas.mjs';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

function archivosEn(dir) {
  const out = [];
  for (const entrada of readdirSync(join(RAIZ, dir))) {
    const absoluto = join(join(RAIZ, dir), entrada);
    if (statSync(absoluto).isDirectory()) out.push(...archivosEn(join(dir, entrada)));
    else out.push(relative(RAIZ, absoluto).replace(/\\/g, '/'));
  }
  return out;
}

/** Ruta de sitio de un archivo de medio o video, escrita como literal completo. */
const LITERAL_MEDIO = /["'`](\/(?:images|videos)\/[A-Za-z0-9._/-]*\.(?:webp|png|jpe?g|avif|gif|svg|mp4|webm))["'`]/g;

/**
 * Dientes del barrido: el regex y el recorte de comentarios son parte del contrato. Sin estos
 * dos casos el test podría estar verde por no mirar nada.
 */
test('el barrido ve el literal y lo ve solo si está fuera de comentarios', () => {
  const conLiteral = 'const a = "/images/x.webp";';
  assert.deepEqual([...conLiteral.matchAll(LITERAL_MEDIO)].map((m) => m[1]), ['/images/x.webp']);
  // Un nombre armado por interpolación NO lo agarra este barrido, y está bien que así sea: por
  // eso existe el test de `MARCAS` abajo. Si algún día esto coincide, el regex se ensanchó.
  assert.equal([...'`/images/hero-${slug}.webp`'.match(LITERAL_MEDIO) || []].length, 0,
    'el barrido finge que resuelve una plantilla de nombre');
  assert.equal(fueraDeComentarios('{/* <img src="/images/muerto.webp"> */}').includes('/images/muerto.webp'), false);
  assert.equal(fueraDeComentarios('<img src="/images/vivo.webp">').includes('/images/vivo.webp'), true);

  // El caso real que obliga a la diferencia: en `meliponas/index.astro` el `<video>` del
  // Task 15 está comentado y aponta a `/videos/meliponario.*`, que no existe en `public/`. Sin
  // recorte, ese archivo daría dos huecos rotos en una superficie que no se sirve. Si el dueño
  // resuelve el Task 15 —se graba o se borra el bloque—, `crudos` deja de verlos y este test
  // avisa: hay que actualizar la historia, no dejar el barrido ciego.
  const meliponas = readFileSync(join(RAIZ, 'src/pages/meliponas/index.astro'), 'utf8');
  const crudos = [...meliponas.matchAll(LITERAL_MEDIO)].map((m) => m[1]);
  const vivos = [...fueraDeComentarios(meliponas).matchAll(LITERAL_MEDIO)].map((m) => m[1]);
  assert.ok(crudos.includes('/videos/meliponario.mp4'), 'cambió el bloque comentado del Task 15: actualiza este test');
  assert.ok(!vivos.includes('/videos/meliponario.mp4'), 'el recorte de comentarios no está trabajando');
});

test('barrido: todo literal de /images/ o /videos/ en src/ existe en public/', () => {
  const rotas = [];
  for (const ruta of archivosEn('src')) {
    if (!/\.(astro|tsx|ts)$/.test(ruta)) continue;
    const fuente = fueraDeComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
    for (const m of fuente.matchAll(LITERAL_MEDIO)) {
      if (!existsSync(join(RAIZ, 'public', m[1]))) rotas.push(`${ruta}: ${m[1]}`);
    }
  }
  assert.deepEqual(rotas, [], `literal de medio sin archivo en public/: ${rotas.join(', ')}`);
});

/**
 * `MARCAS` es la única lista que `ogImageDe()` consulta, y el nombre del archivo se arma por
 * interpolación: agregar una marca sin su `hero-*.webp` produce un `og:image` a un 404 con el
 * build verde. Se lee la lista del fonte, no se copia acá, para que la prueba no se congele.
 */
test('cada marca de ogImageDe tiene su hero-*.webp en public/', () => {
  const fuente = readFileSync(join(RAIZ, 'src/lib/og-image.ts'), 'utf8');
  const linea = fuente.match(/const MARCAS = \[([^\]]*)\]/);
  assert.ok(linea, 'cambió la forma de declarar MARCAS: actualiza este test a la nueva forma');
  const marcas = linea[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.ok(marcas.length >= 6, `se esperaban al menos las 6 marcas del sitio, hay ${marcas.length}`);
  const huerfanas = marcas.filter((b) => !existsSync(join(RAIZ, 'public/images', `hero-${b}.webp`)));
  assert.deepEqual(huerfanas, [], `marca sin hero versionado (og:image a un 404): ${huerfanas.join(', ')}`);
});
