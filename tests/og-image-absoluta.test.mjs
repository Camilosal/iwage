/**
 * `og:image` / `twitter:image` / JSON-LD `image`: siempre absolutas.
 *
 * Se prueba el helper puro (`src/lib/og-image.ts`), no el layout: los componentes
 * `.astro` no son importables en `node --test`. La única forma de dejar contrato
 * sobre el layout es leer su texto fuente, y así está marcado más abajo.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ogImageDe } from '../src/lib/og-image.ts';

// El helper hereda de `media.ts` dos dependencias de entorno: `APP_URL` es el origen
// con el que `absUrl()` absolutea, y `STRAPI_URL` define qué host es "este sitio".
// Se fijan acá para que este teste no dependa del entorno ambiente (ni de un .env),
// y se restauran al terminar, como hace `tests/media.test.mjs`.
const AMBIENTE = { APP_URL: process.env.APP_URL, STRAPI_URL: process.env.STRAPI_URL };
process.env.APP_URL = 'https://iwage.co';
process.env.STRAPI_URL = 'http://iwage_strapi:1337';

after(() => {
  for (const [clave, valor] of Object.entries(AMBIENTE)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

function conEntorno(env, cuerpo) {
  const antes = { APP_URL: process.env.APP_URL, STRAPI_URL: process.env.STRAPI_URL };
  Object.assign(process.env, env);
  try {
    return cuerpo();
  } finally {
    for (const [clave, valor] of Object.entries(antes)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
}

test('sin imagen propia, cae en el hero estático absoluto de la marca', () => {
  assert.equal(ogImageDe({ brand: 'meliponas' }), 'https://iwage.co/images/hero-meliponas.webp');
  assert.equal(ogImageDe({ brand: 'cafe' }), 'https://iwage.co/images/hero-cafe.webp');
});

test('una imagen de Strapi relativa se absolutea', () => {
  assert.equal(
    ogImageDe({ brand: 'cafe', imagen: '/uploads/2026/05/x.webp' }),
    'https://iwage.co/uploads/2026/05/x.webp'
  );
});

test('una imagen que llega con el host interno de Docker nunca sale al metadato', () => {
  assert.equal(
    ogImageDe({ brand: 'granja', imagen: 'http://iwage_strapi:1337/uploads/x.webp' }),
    'https://iwage.co/uploads/x.webp'
  );
});

test('un externo ajeno se respeta tal cual', () => {
  assert.equal(
    ogImageDe({ brand: 'tierras', imagen: 'https://cdn.tercero.com/a.jpg' }),
    'https://cdn.tercero.com/a.jpg'
  );
});

// ── Bordes que el bug real producía ──

test('las seis marcas tienen hero; una marca desconocida no inventa un 404', () => {
  for (const brand of ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion', 'granja']) {
    assert.equal(ogImageDe({ brand }), `https://iwage.co/images/hero-${brand}.webp`);
  }
  // El ternario viejo escribía `hero-<slug>.webp` con cualquier slug: un brand mal
  // declarado mandaba un og:image roto. Ahora cae en el hero de la marca por defecto.
  assert.equal(ogImageDe({ brand: 'no-existe' }), 'https://iwage.co/images/hero-meliponas.webp');
  assert.equal(ogImageDe({ brand: '' }), 'https://iwage.co/images/hero-meliponas.webp');
});

test('imagen vacía, nula, en blanco u objeto sin url: todas caen en el hero', () => {
  const hero = ogImageDe({ brand: 'tierras' });
  for (const imagen of [undefined, null, '', '   ', {}, { url: '' }, { url: null }]) {
    assert.equal(ogImageDe({ brand: 'tierras', imagen }), hero, `imagen ${JSON.stringify(imagen)}`);
  }
});

test('el host del propio sitio escrito como absoluto no sale duplicado', () => {
  // `https://iwage.co/uploads/x.webp` es la misma pieza que `/uploads/x.webp`.
  assert.equal(
    ogImageDe({ brand: 'meliponas', imagen: 'https://iwage.co/uploads/x.webp' }),
    'https://iwage.co/uploads/x.webp'
  );
  assert.equal(
    ogImageDe({ brand: 'meliponas', imagen: { url: 'https://www.iwage.co/uploads/x.webp' } }),
    'https://iwage.co/uploads/x.webp'
  );
});

test('cualquier host que sea STRAPI_URL también se reduce antes de absolutea', () => {
  conEntorno({ STRAPI_URL: 'http://127.0.0.1:1338' }, () => {
    assert.equal(
      ogImageDe({ brand: 'cafe', imagen: 'http://127.0.0.1:1338/uploads/x.webp' }),
      'https://iwage.co/uploads/x.webp'
    );
  });
});

test('el origen lo manda APP_URL (no está hardcodeado en el helper)', () => {
  conEntorno({ APP_URL: 'https://ejemplo-iwage.test' }, () => {
    assert.equal(ogImageDe({ brand: 'gestion' }), 'https://ejemplo-iwage.test/images/hero-gestion.webp');
    assert.equal(
      ogImageDe({ brand: 'gestion', imagen: '/uploads/x.webp' }),
      'https://ejemplo-iwage.test/uploads/x.webp'
    );
  });
});

test('invariante: nunca sale una ruta pelada ni un host interno', () => {
  const entradas = [
    undefined, null, '', '/uploads/x.webp', 'uploads/x.webp',
    'http://iwage_strapi:1337/uploads/x.webp',
    'http://strapi_backend:1337/uploads/x.webp',
    'https://iwage.co/uploads/x.webp',
    'https://cdn.tercero.com/a.jpg',
    { url: '/uploads/o.webp' },
  ];
  for (const brand of ['meliponas', 'cafe', 'granja', 'raro']) {
    for (const imagen of entradas) {
      const salida = ogImageDe({ brand, imagen });
      assert.match(salida, /^https?:\/\//, `no absoluta: ${salida}`);
      assert.doesNotMatch(salida, /iwage_strapi|strapi_backend|:1337|:1338/, `host interno: ${salida}`);
    }
  }
});

// ── El layout no es importable: se le lee el texto, y solo lo que fija el contrato ──

const LAYOUT = readFileSync(
  fileURLToPath(new URL('../src/layouts/BrandLayout.astro', import.meta.url)),
  'utf8'
);

test('BrandLayout absolutiza el og:image en el borde, no en cada página', () => {
  assert.match(LAYOUT, /from '@\/lib\/og-image'/, 'falta el import de ogImageDe');
  assert.match(LAYOUT, /const ogImage = ogImageDe\(/, 'ogImage no se deriva de ogImageDe()');
  // El ternario que no hacía nada (`?? \`https://iwage.co/images/hero-...\``) no debe volver.
  assert.doesNotMatch(LAYOUT, /images\/hero-/, 'el hero sigue hardcodeado en el layout');
});

test('las tres etiquetas consumen el valor ya absoluteado', () => {
  assert.match(LAYOUT, /<meta property="og:image" content=\{ogImage\} \/>/);
  assert.match(LAYOUT, /<meta name="twitter:image" content=\{ogImage\} \/>/);
  assert.match(LAYOUT, /imagen: ogImage,/);
});

test('el `image` del Article (que las rutas de bitácora entregan relativo) pasa por el mismo borde', () => {
  // `articuloSchema()` prefiere `article.image` sobre la imagen del layout: si solo
  // se absolutea `ogImage`, las 7 rutas de bitácora dejan JSON-LD con ruta relativa.
  assert.match(LAYOUT, /absUrl\(\s*mediaSrc\(\s*props\.article\.image\s*\)\s*\)/,
    'article.image llega relativo al Article');
});
