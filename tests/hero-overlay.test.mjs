import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pinturaDelHero,
  FONDO_OSCURO,
  FONDO_SUNKEN,
  ESCALA_CON_MEDIO,
  ESCALA_SIN_MEDIO,
} from '../src/lib/hero-overlay.ts';

/**
 * El fondo del header y la densidad del overlay responden a la MISMA pregunta: ¿hay un
 * medio pintando detrás del texto? Hoy responden a dos preguntas distintas
 * (`imagen || embed || poster` en el <header> vs solo `imagen` en el overlay), y el
 * `color_overlay` del autor gana siempre.
 *
 * Medido en producción: las 39 filas de `hero_configuracions` traen `imagen` Y
 * `color_overlay`, así que la escala segura no aplica ninguna vez hoy. El camino que sí
 * se cae es el de la degradación que este proyecto promete (Strapi caído, o el Paso H
 * convirtiendo `imagen` a `media` sin subir los 7 archivos): sin medio, el header pasa a
 * `bg-surface-sunken` (#f2f2ee, L=0.886) y el overlay del autor, calibrado sobre foto,
 * deja el H1 blanco a 2.7:1 en el peor punto de la banda. Con la escala segura son 6.2:1.
 */

const LOS_39 = 'from-black/45 via-black/35 to-black/60';

test('sin medio: fondo de marca y escala segura, aunque el autor pida otra cosa', () => {
  assert.deepEqual(pinturaDelHero({}), { fondo: FONDO_SUNKEN, overlay: ESCALA_SIN_MEDIO });
  assert.deepEqual(pinturaDelHero({ imagen: null, color_overlay: LOS_39 }), {
    fondo: FONDO_SUNKEN,
    overlay: ESCALA_SIN_MEDIO,
  }, 'un color_overlay calibrado sobre foto no puede mandar cuando no hay foto');
});

test('con imagen: header oscuro y la escala de siempre; el autor manda sobre ella', () => {
  assert.deepEqual(pinturaDelHero({ imagen: '/images/hero-cafe.webp' }), {
    fondo: FONDO_OSCURO,
    overlay: ESCALA_CON_MEDIO,
  });
  assert.deepEqual(pinturaDelHero({ imagen: '/images/hero-cafe.webp', color_overlay: LOS_39 }), {
    fondo: FONDO_OSCURO,
    overlay: LOS_39,
  }, 'las 39 filas en producción siguen pintando idéntico');
});

test('la escala del autor solo cuenta si es texto con algo dentro', () => {
  for (const vacia of [null, undefined, '', '   ', 0]) {
    const p = pinturaDelHero({ imagen: '/x.webp', color_overlay: vacia });
    assert.equal(p.overlay, ESCALA_CON_MEDIO, 'valor vacío no debe ganar con ' + typeof vacia);
  }
});

test('embed o poster también son medio: oscurecen el header y piden la escala con medio', () => {
  for (const h of [{ embed: 'https://youtu.be/Vv1b4Vvq0fM' }, { poster: '/p.webp' }]) {
    const p = pinturaDelHero(h);
    assert.equal(p.fondo, FONDO_OSCURO);
    assert.equal(p.overlay, ESCALA_CON_MEDIO);
  }
});

test('las cadenas vacías no cuentan como medio, las no-cadenas tampoco pintan', () => {
  for (const sinNada of ['', '   ', null, undefined]) {
    assert.deepEqual(pinturaDelHero({ imagen: sinNada, embed: sinNada, poster: sinNada }), {
      fondo: FONDO_SUNKEN,
      overlay: ESCALA_SIN_MEDIO,
    });
  }
});

/**
 * El riesgo de sacar los literales de `Hero.astro` a un `.ts` es que Tailwind deje de
 * verlos y la página salga SIN el gradiente: una degradación muda, verde en build y en
 * test. Se comprueba con el escáner real de v4 (el mismo que usa `@tailwindcss/vite`),
 * no con un `includes` del fuente.
 */
test('Tailwind sigue extrayendo las cuatro escalas desde el archivo .ts', async () => {
  const { Scanner } = await import('@tailwindcss/oxide');
  const scanner = new Scanner({ sources: [{ base: 'src', pattern: '**/*', negated: false }] });
  assert.ok(
    scanner.files.some((f) => f.includes('hero-overlay.ts')),
    'el autodetect de v4 (cero @source en src/styles/global.css) debe incluir el .ts',
  );
  const contenido = readFileSync('src/lib/hero-overlay.ts', 'utf-8');
  const candidatos = scanner.scanFiles([
    { file: 'src/lib/hero-overlay.ts', content: contenido, extension: 'ts' },
  ]);
  // Se derivan de los exportados: si mañana se cambia una escala, el teste pide ESA.
  // El escáner devuelve candidatos SUELTO por clase, no la cadena entera del literal.
  const todas = [FONDO_OSCURO, FONDO_SUNKEN, ESCALA_CON_MEDIO, ESCALA_SIN_MEDIO]
    .flatMap((clases) => clases.split(' '));
  assert.equal(todas.length, 8, 'cuatro literales: dos fondos sueltos y dos gradientes de 3 clases');
  for (const clase of todas) {
    assert.ok(candidatos.includes(clase), 'Tailwind no extrae ' + clase + ' del .ts');
  }
});

/** El invariante que estaba roto: las dos clases nunca se contradicen. */
test('fondo y overlay derivan de una sola decisión', () => {
  const valores = ['/x.webp', '', null, undefined, '   '];
  let combinaciones = 0;
  for (const imagen of valores) {
    for (const embed of valores) {
      for (const poster of valores) {
        for (const color_overlay of [LOS_39, null]) {
          const p = pinturaDelHero({ imagen, embed, poster, color_overlay });
          const hayMedio = [imagen, embed, poster].some((v) => typeof v === 'string' && v.trim() !== '');
          assert.equal(p.fondo === FONDO_OSCURO, hayMedio);
          assert.equal(p.overlay === ESCALA_SIN_MEDIO, !hayMedio);
          combinaciones += 1;
        }
      }
    }
  }
  assert.equal(combinaciones, 250, '5x5x5x2: la parrilla completa de entradas alcanzables');
});
