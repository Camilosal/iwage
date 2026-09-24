import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMediaItem, toMediaList, mediaSrc, absUrl, embedSrc, isEmbed } from '../src/lib/media.ts';

test('mediaSrc: ruta interna de Strapi queda relativa de sitio', () => {
  assert.equal(mediaSrc('/uploads/2026/05/miel.webp'), '/uploads/2026/05/miel.webp');
});

test('mediaSrc: nunca devuelve el host interno de Docker', () => {
  assert.equal(mediaSrc('http://iwage_strapi:1337/uploads/x.webp'), '/uploads/x.webp');
});

test('mediaSrc: el host del sitio también se reduce a ruta relativa', () => {
  assert.equal(mediaSrc('https://iwage.co/uploads/x.webp'), '/uploads/x.webp');
});

test('mediaSrc: un externo real se queda intacto', () => {
  assert.equal(
    mediaSrc('https://images.unsplash.com/photo-1470071459604?w=800'),
    'https://images.unsplash.com/photo-1470071459604?w=800'
  );
});

test('mediaSrc: acepta objeto media de Strapi y cadena vacía', () => {
  assert.equal(mediaSrc({ url: '/uploads/a.webp', mime: 'image/webp' }), '/uploads/a.webp');
  assert.equal(mediaSrc(''), null);
  assert.equal(mediaSrc(null), null);
  assert.equal(mediaSrc({}), null);
});

test('mediaSrc: el host de STRAPI_URL también es este sitio', () => {
  const antes = process.env.STRAPI_URL;
  process.env.STRAPI_URL = 'http://127.0.0.1:1337';
  try {
    assert.equal(mediaSrc('http://127.0.0.1:1337/uploads/x.webp'), '/uploads/x.webp');
    // La comparación es por hostname: otro host del mismo puerto sigue siendo externo.
    assert.equal(mediaSrc('http://localhost:1337/uploads/x.webp'), 'http://localhost:1337/uploads/x.webp');
    assert.equal(mediaSrc('https://cdn-a.com/i.jpg'), 'https://cdn-a.com/i.jpg');
  } finally {
    if (antes === undefined) delete process.env.STRAPI_URL;
    else process.env.STRAPI_URL = antes;
  }
});

test('absUrl: lo relativo se absolutea con APP_URL, lo absoluto no se toca', () => {
  assert.equal(absUrl('/uploads/x.webp'), 'https://iwage.co/uploads/x.webp');
  assert.equal(absUrl('https://iwage.co/y.webp'), 'https://iwage.co/y.webp');
  assert.equal(absUrl(null), null);
});

test('toMediaItem: clasifica imagen, video propio, YouTube y tour 360', () => {
  assert.equal(toMediaItem('/uploads/x.webp').kind, 'imagen');
  assert.equal(toMediaItem('/videos/meliponario.mp4').kind, 'video');
  assert.deepEqual(
    { kind: toMediaItem('https://youtu.be/abc12345678').kind, provider: toMediaItem('https://youtu.be/abc12345678').provider },
    { kind: 'video', provider: 'youtube' }
  );
  const tour = toMediaItem('https://my.matterport.com/show/?m=XXXX');
  assert.equal(tour.kind, 'tour360');
  assert.equal(tour.provider, 'otro');
  // tour360 lo decide el HOST: `embed` son enlaces de terceros, nunca una ruta propia.
  const pano = toMediaItem('/uploads/panorama-miel.webp');
  assert.equal(pano.kind, 'imagen');
  assert.equal(pano.provider, 'strapi');
  assert.equal(isEmbed(pano), false);
  const recorrido = toMediaItem('/videos/recorrido-360.mp4');
  assert.equal(recorrido.kind, 'video');
  assert.equal(isEmbed(recorrido), false);
  // isEmbed: terceros sí, material propio no (lo reproduce <video>/<img>, no <iframe>).
  assert.equal(isEmbed(tour), true);
  assert.equal(isEmbed(toMediaItem('https://youtu.be/abc12345678')), true);
  assert.equal(isEmbed(toMediaItem('https://vimeo.com/123456')), true);
  assert.equal(isEmbed(toMediaItem('https://drive.google.com/file/d/1AbC-xyz_12345/view')), true);
  assert.equal(isEmbed(toMediaItem('/uploads/x.webp')), false);
});

test('toMediaItem: entiende la forma vieja { url, tipo, titulo }', () => {
  const m = toMediaItem({ url: 'https://vimeo.com/123456', tipo: 'video', titulo: 'Recorrido' });
  assert.equal(m.provider, 'vimeo');
  assert.equal(m.caption, 'Recorrido');
  // La mitad `tipo`: con un .webp propio classify() diría `imagen`; si TIPO_VIEJO no se
  // aplica, estos tres asserts caen.
  const v = toMediaItem({ url: '/uploads/x.webp', tipo: 'video' });
  assert.equal(v.kind, 'video');
  assert.equal(v.provider, 'strapi');
  assert.equal(toMediaItem({ url: '/uploads/x.webp', tipo: 'imagen' }).kind, 'imagen');
  // Un `tipo` que no está en la tabla no inventa nada: manda classify().
  assert.equal(toMediaItem({ url: '/uploads/x.webp', tipo: 'whatever' }).kind, 'imagen');
});

test('toMediaItem: el mime de Strapi sube a video y alternativeText es el alt', () => {
  assert.equal(toMediaItem({ url: '/uploads/x.webp', mime: 'video/mp4' }).kind, 'video');
  assert.equal(toMediaItem({ url: '/uploads/x.webp', mime: 'image/webp' }).kind, 'imagen');
  // Un mime que no es video no baja lo que ya dicta la extensión.
  assert.equal(toMediaItem({ url: '/videos/x.mp4', mime: 'image/png' }).kind, 'video');
  // `alt` de Strapi llega en alternativeText; la forma vieja usa alt.
  assert.equal(toMediaItem({ url: '/uploads/x.webp', alternativeText: 'Panal de miel' }).alt, 'Panal de miel');
  assert.equal(toMediaItem({ url: '/uploads/x.webp', alt: 'forma vieja' }).alt, 'forma vieja');
});

test('toMediaItem: null con basura', () => {
  assert.equal(toMediaItem(null), null);
  assert.equal(toMediaItem({}), null);
  assert.equal(toMediaItem('   '), null);
});

test('toMediaList: deduplica la misma pieza escrita de tres maneras', () => {
  const list = toMediaList([
    '/uploads/x.webp',
    'https://iwage.co/uploads/x.webp?q=1',
    'http://iwage_strapi:1337/uploads/x.webp',
    '/uploads/y.webp',
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].url, '/uploads/x.webp');
});

test('toMediaList: la clave de dedupe no distingue mayúsculas', () => {
  const list = toMediaList(['/uploads/X.webp', 'https://iwage.co/uploads/x.webp']);
  assert.equal(list.length, 1);
  // El primero gana: sin el toLowerCase() de canonicalKey serían dos piezas.
  assert.equal(list[0].url, '/uploads/X.webp');
});

test('toMediaList: dos externos que comparten ruta son piezas distintas', () => {
  const list = toMediaList(['https://cdn-a.com/i.jpg', 'https://cdn-b.com/i.jpg']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((m) => m.url), ['https://cdn-a.com/i.jpg', 'https://cdn-b.com/i.jpg']);
  // La misma URL externa escrita dos veces sí deduplica.
  assert.equal(toMediaList(['https://cdn-a.com/i.jpg', 'https://cdn-a.com/i.jpg?utm=1']).length, 1);
});

test('toMediaList: conserva la metadata más rica del duplicado', () => {
  const list = toMediaList([
    '/uploads/x.webp',
    { url: 'https://iwage.co/uploads/x.webp', titulo: 'Miel de Angelita' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].caption, 'Miel de Angelita');
});

test('toMediaList: alt pesa más que caption al elegir el duplicado rico', () => {
  const list = toMediaList([
    { url: '/uploads/x.webp', caption: 'caption pesa 1' },                       // 1
    { url: 'https://iwage.co/uploads/x.webp', alternativeText: 'alt pesa 2' },   // 2
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].alt, 'alt pesa 2');
  assert.equal('caption' in list[0], false);
});

test('toMediaList: acepta el array anidado de una relación multiple', () => {
  const list = toMediaList([['/uploads/a.webp', '/uploads/b.webp'], '/uploads/a.webp']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((m) => m.url), ['/uploads/a.webp', '/uploads/b.webp']);
  // Objeto suelto: entra como lista de uno.
  assert.equal(toMediaList({ url: '/uploads/c.webp' }).length, 1);
});

test('toMediaList: ignora nulos y vacío', () => {
  assert.deepEqual(toMediaList([null, '', undefined, '/uploads/a.webp']), [{ url: '/uploads/a.webp', kind: 'imagen', provider: 'strapi' }]);
  assert.deepEqual(toMediaList(null), []);
});

test('embedSrc: convierte YouTube, Vimeo y Drive a su reproductible', () => {
  assert.equal(embedSrc('https://www.youtube.com/watch?v=abc12345678'), 'https://www.youtube.com/embed/abc12345678');
  assert.equal(embedSrc('https://youtu.be/abc12345678'), 'https://www.youtube.com/embed/abc12345678');
  assert.equal(embedSrc('https://vimeo.com/12345678'), 'https://player.vimeo.com/video/12345678');
  assert.equal(embedSrc('https://vimeo.com/video/12345678'), 'https://player.vimeo.com/video/12345678');
  // Drive: de /view a /preview, que es lo único que cabe en un <iframe>.
  assert.equal(
    embedSrc('https://drive.google.com/file/d/1AbC-xyz_12345/view?usp=sharing'),
    'https://drive.google.com/file/d/1AbC-xyz_12345/preview'
  );
  // Lo que no es de las tres pasarelas pasa intacto.
  assert.equal(embedSrc('/uploads/x.mp4'), '/uploads/x.mp4');
  assert.equal(embedSrc('https://docs.google.com/spreadsheets/d/1AbC'), 'https://docs.google.com/spreadsheets/d/1AbC');
});
