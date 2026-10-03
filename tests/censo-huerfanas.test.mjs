// Fila 6 del censo: «piezas producidas y nunca enlazadas».
//
// El comando histórico era `grep -rqn "$base" src/`, y medía mal: un nombre citado dentro de un
// bloque comentado de Astro (`{/* … */}`) no se pinta nunca, pero el grep lo contaba como
// «referenciado». Medido en los dos crawls del censo (185 URLs, `/home/ubuntu/backup/iwaudit-*`):
// `proyecto-ambala-1.webp` no aparece en ningún HTML. La herramienta se queda sin ese falso
// positivo y este archivo es la prueba de que sigue sin tenerlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fueraDeComentarios, puedePintarse, medirHuerfanas } from '../docs/superpowers/metrics/censo/huerfanas.mjs';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

test('fueraDeComentarios quita el bloque y deja lo que hay entre dos bloques', () => {
  const texto = 'A {/* uno */} B {/* dos */} C';
  assert.equal(fueraDeComentarios(texto).replace(/\s+/g, ' ').trim(), 'A B C');
});

test('el multilínea se quita entero: un nombre atrapado en el bloque no sobrevive', () => {
  const texto = [
    '<div>',
    '  {/*',
    '    <video poster="/images/galeria/proyecto-ambala-1.webp"></video>',
    '  */}',
    '  <img src="/images/galeria/proyecto-cumbre-1.webp" />',
    '</div>',
  ].join('\n');
  const limpio = fueraDeComentarios(texto);
  assert.ok(!limpio.includes('proyecto-ambala-1'), 'el bloque comentado no se quitó');
  assert.ok(limpio.includes('proyecto-cumbre-1'), 'se llevó por delante lo que sí pinta');
});

test('puedePintarse: solo en comentario no pinta; en comentario Y en código sí pinta', () => {
  const n = 'x.webp';
  assert.equal(puedePintarse(n, `const p = "/images/${n}"`), true);
  assert.equal(puedePintarse(n, `{/* ver ${n} más tarde */}`), false);
  assert.equal(puedePintarse(n, `{/* ${n} */}\n<img src="/images/${n}" />`), true,
    'un comentario no anula una referencia real de la misma fuente');
  assert.equal(puedePintarse(n, 'nada que ver'), false);
});

// Fixture: un repo mínimo con dos directorios de imágenes y cuatro fuentes posibles.
function repositorio({ imagenes, fuentes }) {
  const raiz = mkdtempSync(join(tmpdir(), 'censo-huerfanas-'));
  for (const [rel] of imagenes) {
    mkdirSync(join(raiz, 'public', 'images', dirname(rel)), { recursive: true });
    writeFileSync(join(raiz, 'public', 'images', rel), 'pix');
  }
  for (const [rel, texto] of fuentes) {
    mkdirSync(join(raiz, 'src', dirname(rel)), { recursive: true });
    writeFileSync(join(raiz, 'src', rel), texto);
  }
  return { repo: raiz, dirs: ['bitacora', 'galeria'] };
}

test('medirHuerfanas: el caso medido — comentario Astro = huérfano de hecho', () => {
  const r = repositorio({
    imagenes: [
      ['bitacora/viva.webp'],
      ['bitacora/muerta.webp'],
      ['galeria/ambala-1.webp'],
      ['galeria/cumbre-1.webp'],
      ['galeria/.gitkeep'],
    ],
    fuentes: [
      ['pages/index.astro', '<img src="/images/bitacora/viva.webp" />'],
      ['pages/proyectos.astro', '{/* <video poster="/images/galeria/ambala-1.webp"> */}'],
      ['pages/otras.astro', '<img src="/images/galeria/cumbre-1.webp" />'],
    ],
  });
  const m = medirHuerfanas(r);
  assert.deepEqual(m.porDir.bitacora, { total: 2, huerfanas: 1, nombres: ['bitacora/muerta.webp'] });
  assert.deepEqual(m.porDir.galeria, { total: 2, huerfanas: 1, nombres: ['galeria/ambala-1.webp'] },
    '.gitkeep no es una pieza producida, y un nombre dentro de {/* … */} no está enlazado');
  assert.equal(m.total, 2);
});

test('medirHuerfanas: png y jpeg son piezas, y lo que se nombra sale de lo que se cuenta', () => {
  const r = repositorio({
    imagenes: [['bitacora/a.webp'], ['bitacora/b.png'], ['galeria/c.jpeg']],
    fuentes: [['x.astro', '<img src="/images/bitacora/a.webp" />']],
  });
  const m = medirHuerfanas(r);
  assert.deepEqual(m.porDir.bitacora, { total: 2, huerfanas: 1, nombres: ['bitacora/b.png'] });
  assert.deepEqual(m.porDir.galeria, { total: 1, huerfanas: 1, nombres: ['galeria/c.jpeg'] });
  for (const [dir, d] of Object.entries(m.porDir)) {
    assert.equal(d.huerfanas, d.nombres.length, `${dir}: el conteo y la lista no coinciden`);
    assert.ok(d.nombres.every((n) => n.startsWith(`${dir}/`)), `${dir}: nombra archivos de otro balde`);
    assert.ok(d.nombres.every((n) => !n.includes('a.webp')), 'lo que sí se pinta no puede salir como huérfano');
  }
});

// Regresión sobre el repo real: fija el número que este trabajo dejó medido.
test('en el repo real, ambala-1 está huérfano y la cuenta es 46, no 48', () => {
  const m = medirHuerfanas({ repo: RAIZ, dirs: ['bitacora', 'galeria'] });
  // 36/48 hasta el 2026-10-03: `bitacora-calendario-manejo` (lámina defectuosa, su asunto ya
  // tiene tapa en `modulo5-manejo`) y `bitacora-red-meliponicultores` (sin artículo en la BD)
  // se retiraron por decisión del dueño — Opción A de Task 16. Copias en
  // /home/ubuntu/backup/retiro-huerfanas-2026-10-03/.
  assert.equal(m.porDir.bitacora.total, 34, 'las tapas cambiaron de número: hay que recountar');
  assert.equal(m.porDir.galeria.total, 12);
  assert.equal(m.total, 46);
  assert.ok(m.porDir.galeria.nombres.includes('galeria/proyecto-ambala-1.webp'),
    'si aparece enlazada, es que el grep volvió a contar el bloque comentado de meliponas/index.astro');
  assert.ok(!m.porDir.galeria.nombres.some((n) => n.includes('hero-')),
    'los hero-*.webp no viven en estos baldes y no deben colarse');
});
