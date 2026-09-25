// Fila 10 del censo: integridad de la `og:image` SERVIDA.
//
// `ogImageDe()` arma el destino por interpolación (`/images/hero-${slug}.webp`), así que la
// etiqueta puede salir absoluta y bien formada apuntando a un 404. `tests/og-image-absoluta
// .test.mjs` prueba la FORMA y `tests/medios-literales.test.mjs` prueba la EXISTENCIA de los
// literales del código; esta fila es la que mira el HTML que el sitio efectivamente manda.
// Un script de medición sin testear se cae a silencio —es exactamente como la fila 6 leyó 47
// durante semanas—, y estos casos fijan las cinco clases de destino y los dos falsos positivos
// que ya esquemáticamente evitamos: contar `twitter:image` como og:image, y llamar «fuga de
// host interno» al localhost de un preview local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { medirOgImages } from '../docs/superpowers/metrics/censo/ogimgs.mjs';

/**
 * Fixture: un crawl sintético (`crawl.log` + `html/NNNN.html`) y un repo mínimo con lo que
 * hay en `public/`. Cada HTML pesa una sola cosa, para que un verde signifique lo que dice.
 */
function crawl({ paginas, imagenesPublic, origen = 'https://iwage.co' }) {
  const raiz = mkdtempSync(join(tmpdir(), 'censo-ogimgs-'));
  const dir = join(raiz, 'crawl');
  mkdirSync(join(dir, 'html'), { recursive: true });
  writeFileSync(join(dir, 'crawl.log'),
    paginas.map((p, i) => `${String(i + 1).padStart(4, '0')}|200|${origen}${p.page}`).join('\n') + '\n');
  for (const [i, p] of paginas.entries()) {
    writeFileSync(join(dir, 'html', `${String(i + 1).padStart(4, '0')}.html`),
      `<html><head>${p.tags.join('')}</head><body><main></main></body></html>`);
  }
  const repo = join(raiz, 'repo');
  for (const rel of imagenesPublic) {
    mkdirSync(join(repo, 'public', dirname(rel)), { recursive: true });
    writeFileSync(join(repo, 'public', rel), 'pix');
  }
  return { dir, repo };
}

const OG = (contenido) => `<meta property="og:image" content="${contenido}">`;

test('clasifica los seis destinos que produce el sitio real', () => {
  const f = crawl({
    imagenesPublic: ['/images/hero-meliponas.webp'],
    paginas: [
      { page: '/', tags: [OG('https://iwage.co/images/hero-meliponas.webp')] },
      { page: '/tierras/x/', tags: [OG('https://iwage.co/images/hero-que-no-esta.webp')] },
      { page: '/granja/', tags: [OG('/images/hero-meliponas.webp')] },
      { page: '/cafe/', tags: [OG('http://localhost:1338/uploads/hero-cafe.webp')] },
      { page: '/bitacora/x/', tags: [OG('https://iwage.co/uploads/2026/tapa.webp')] },
      { page: '/naturaleza/', tags: [OG('https://cdn.tercero.com/foto.webp')] },
    ],
  });
  const m = medirOgImages(f);
  assert.equal(m.total, 6);
  assert.equal(m.conOg, 6);
  assert.deepEqual(m.local, [['/images/hero-meliponas.webp', 1]]);
  assert.deepEqual(m.roto.map((r) => [r.ruta, r.motivo]), [
    ['/images/hero-que-no-esta.webp', 'no existe en public/'],
    ['/images/hero-meliponas.webp', 'no es una URL absoluta'],
    ['/uploads/hero-cafe.webp', 'host interno en la etiqueta'],
  ]);
  assert.deepEqual(m.uploads.map((u) => u.url), ['https://iwage.co/uploads/2026/tapa.webp'],
    'un /uploads/ de nuestro propio origen es volumen de Strapi, no un archivo roto');
  assert.deepEqual(m.externo.map((e) => e.url), ['https://cdn.tercero.com/foto.webp']);
});

test('el orden de los atributos no cambia la lectura', () => {
  const f = crawl({
    imagenesPublic: ['/images/hero-cafe.webp'],
    paginas: [{ page: '/cafe/', tags: ['<meta content="https://iwage.co/images/hero-cafe.webp" property="og:image">'] }],
  });
  const m = medirOgImages(f);
  assert.equal(m.conOg, 1);
  assert.deepEqual(m.local, [['/images/hero-cafe.webp', 1]]);
});

test('twitter:image no alimenta la fila; una página sin og:image queda contada', () => {
  const f = crawl({
    imagenesPublic: ['/images/hero-tierras.webp'],
    paginas: [
      { page: '/tierras/', tags: [OG('https://iwage.co/images/hero-tierras.webp')] },
      { page: '/ayuda/equipo/', tags: ['<meta name="twitter:image" content="https://iwage.co/images/hero-tierras.webp">',
        '<meta property="og:title" content="Equipo">'] },
    ],
  });
  const m = medirOgImages(f);
  assert.equal(m.conOg, 1, 'contó twitter:image como og:image');
  assert.deepEqual(m.sinOgPaginas.map((p) => p.page), ['/ayuda/equipo/']);
  assert.deepEqual(m.porSeccion, [['/ayuda/', 1]],
    'las ausencias se agrupan por sección: sin eso, 24 páginas internas se leen como 24 huecos');
});

test('una página con dos og:image se reporta: es la firma de un componente que duplica la etiqueta', () => {
  const f = crawl({
    imagenesPublic: ['/images/hero-gestion.webp', '/images/hero-naturaleza.webp'],
    paginas: [{ page: '/gestion/', tags: [OG('https://iwage.co/images/hero-gestion.webp'),
      OG('https://iwage.co/images/hero-naturaleza.webp')] }],
  });
  const m = medirOgImages(f);
  assert.equal(m.duplicadas.length, 1);
  assert.equal(m.destinos.length, 2);
});

test('un preview local sin SITE_URL no se autoacusa de fuga de host interno', () => {
  // `absUrl()` usa SITE_URL; sin ella el preview emite su propio localhost. Llamar a eso
  // «host interno en la etiqueta» sería un falso positivo que invitaría a «arreglar» algo bien.
  const paginas = [{ page: '/', tags: [OG('http://localhost:4321/images/hero-meliponas.webp')] }];
  const m = medirOgImages(crawl({ paginas, imagenesPublic: ['/images/hero-meliponas.webp'], origen: 'http://localhost:4321' }));
  assert.equal(m.origenInterno, true);
  assert.deepEqual(m.roto, [], 'el origen del propio preview apareció como fuga');
  assert.deepEqual(m.local, [['/images/hero-meliponas.webp', 1]]);

  // El mismo host, cuando el crawl es el sitio real, SÍ es una fuga.
  const prod = medirOgImages(crawl({ paginas, imagenesPublic: ['/images/hero-meliponas.webp'] }));
  assert.equal(prod.origenInterno, false);
  assert.deepEqual(prod.local, [], 'escapado: el localhost del HTML de producción se coló como válido');
});
