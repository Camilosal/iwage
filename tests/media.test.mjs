import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMediaItem, toMediaList, mediaSrc, absUrl, embedSrc, isEmbed, esPintable } from '../src/lib/media.ts';

test('mediaSrc: ruta interna de Strapi queda relativa de sitio', () => {
  assert.equal(mediaSrc('/uploads/2026/05/miel.webp'), '/uploads/2026/05/miel.webp');
});

test('mediaSrc: nunca devuelve el host interno de Docker', () => {
  assert.equal(mediaSrc('http://iwage_strapi:1337/uploads/x.webp'), '/uploads/x.webp');
});

test('mediaSrc: el host del sitio también se reduce a ruta relativa', () => {
  assert.equal(mediaSrc('https://iwage.co/uploads/x.webp'), '/uploads/x.webp');
});

/**
 * Política del contrato, cambiada acá y fijada por este teste: la imagen de un tercero
 * NO se pinta. Medido en la BD de Strapi: 12 filas con `images.unsplash.com` repartidas
 * en 7 columnas, dos de ellas como retrato de un anfitrión real con nombre y apellido.
 * Decisión aprobada: «Strapi único dueño, sin hotlinks de imagen».
 *
 * Dientes: el mismo teste exige que lo externo que SÍ es contenido legítimo (el video de
 * YouTube del censo y un recorrido 360) pase intacto. No se pasan suprimiendo todo lo absoluto.
 */
test('mediaSrc: el hotlink de stock no se pinta; el embed conocido sí', () => {
  assert.equal(mediaSrc('https://images.unsplash.com/photo-1470071459604?w=800'), null);
  assert.equal(mediaSrc({ url: 'https://images.unsplash.com/photo-1506794778202?w=300' }), null);
  assert.equal(
    mediaSrc('https://www.youtube.com/watch?v=Vv1b4Vvq0fM'),
    'https://www.youtube.com/watch?v=Vv1b4Vvq0fM',
  );
  assert.equal(mediaSrc('https://momento360.com/e/u/abc123'), 'https://momento360.com/e/u/abc123');
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
    // El mismo equipo dicho de otra manera. Desde `esPintable` esto dejó de ser cosmético:
    // no reconocer `localhost` cuando el `.env` dice `127.0.0.1` borra TODAS las imágenes
    // del entorno local.
    assert.equal(mediaSrc('http://localhost:1337/uploads/x.webp'), '/uploads/x.webp');
    // La comparación sigue siendo por hostname, no por puerto: otro host en el mismo
    // puerto no es este equipo, y además ya no se pinta.
    assert.equal(mediaSrc('http://host.docker.internal:1337/uploads/x.webp'), null);
    assert.equal(mediaSrc('https://cdn-a.com/i.jpg'), null);
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
  // La mitad `tipo`, corregida el 2026-09-25: la etiqueta a mano re-etiqueta material propio
  // SOLO cuando el nombre del archivo no dice nada (`/uploads/clip`). Con extensión conocida
  // manda el nombre, en los dos sentidos.
  const sinExtension = toMediaItem({ url: '/uploads/clip', tipo: 'video' });
  assert.equal(sinExtension.kind, 'video', 'sin extensión el `tipo` es la única señal y se pierde');
  assert.equal(sinExtension.provider, 'strapi');
  assert.equal(toMediaItem({ url: '/uploads/x.webp', tipo: 'imagen' }).kind, 'imagen');
  assert.equal(
    toMediaItem({ url: '/uploads/clip.mp4', tipo: 'imagen' }).kind,
    'video',
    'un `tipo:\'imagen\'` bajaba un .mp4 propio a <img>: MediaGallery pedía un códec donde hay un JPG',
  );
  assert.equal(
    toMediaItem({ url: '/uploads/foto.webp', tipo: 'video' }).kind,
    'imagen',
    'el mismo poder en sentido inverso subía una foto a <video>, que es la otra forma de elemento roto',
  );
  // Un `tipo` que no está en la tabla no inventa nada: manda classify().
  assert.equal(toMediaItem({ url: '/uploads/x.webp', tipo: 'whatever' }).kind, 'imagen');
});

/**
 * Dientes medidos el 2026-09-25 ejecutando el módulo: `toMediaItem({ url:'/uploads/pano.webp',
 * tipo:'360' })` devolvía `{ kind:'tour360', provider:'strapi' }`, `isEmbed()` daba `true` y
 * `MediaGallery.astro` elegía `render:'iframe'` → `<iframe src="/uploads/pano.webp">`: un
 * `<img>` vestido de tercero, pidiendo al navegador un reproductor donde hay un códec.
 * La regla la escribió el comentario de `classify()` («tour360 solo si el HOST es proveedor de
 * recorridos») pero la rompía la línea de abajo, la del `TIPO_VIEJO`. Acá queda fijada.
 */
test('toMediaItem: lo embebible lo decide la URL, nunca el campo heredado', () => {
  const pano = toMediaItem({ url: '/uploads/pano.webp', tipo: '360' });
  assert.equal(pano.kind, 'imagen');
  assert.equal(isEmbed(pano), false);

  const videoMentiroso = toMediaItem({ url: '/uploads/recorrido.mp4', kind: 'tour360' });
  assert.equal(videoMentiroso.kind, 'video'); // la extensión manda: `<video>`, no `<iframe>`
  assert.equal(isEmbed(videoMentiroso), false);

  // Y al revés tampoco: un tercero es tour por host, y `tipo:'imagen'` no lo convierte en
  // `<img>` (sería un `<img>` apuntando a la página HTML de matterport).
  const tour = toMediaItem({ url: 'https://my.matterport.com/show/?m=XXXX', tipo: 'imagen' });
  assert.equal(tour.kind, 'tour360');
  assert.equal(isEmbed(tour), true);
});

/**
 * `esPintable` razonaba «si no es http(s), es nuestra». Un tercero SIN PROTOCOLO pasa por ahí:
 * medido en el módulo, `mediaSrc('//cdn.tercero.com/a.jpg')` devolvía la cadena intacta y
 * `absUrl()` la convertía en `https://cdn.tercero.com/a.jpg` — la forma exacta en que un
 * hotlink ajeno llega a `og:image` (`BrandLayout.astro` y `og-image.ts` absolutean lo que
 * sale de `mediaSrc`). La decisión aprobada fue «sin hotlinks de imagen»; esta es la puerta.
 */
test('esPintable: relativa de sitio es UN solo "/" inicial; lo demás no se pinta', () => {
  assert.equal(esPintable('/uploads/a.webp'), true);
  assert.equal(esPintable('/images/a.webp'), true);
  assert.equal(mediaSrc('//cdn.tercero.com/a.jpg'), null);
  assert.equal(absUrl(mediaSrc('//cdn.tercero.com/a.jpg')), null); // og: imagen de tercero: no
  assert.equal(toMediaItem({ url: '//cdn.tercero.com/a.jpg' }), null);
  assert.equal(esPintable('//localhost/uploads/a.webp'), false);
  assert.equal(esPintable('javascript:alert(1)'), false);
  assert.equal(esPintable('data:text/html,<b>h</b>'), false);
  // Sin `/` inicial no es ruta de sitio: el navegador la resuelve contra la página y da 404.
  assert.equal(esPintable('uploads/a.webp'), false);
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

test('toMediaList: la clave es host + ruta, no solo ruta', () => {
  // Dos piezas distintas que casualmente comparten ruta NO son un duplicado. Escrito con
  // proveedores de recorrido (pintables): con hotlinks de imagen este teste sería vacío,
  // porque `esPintable` los tira antes de llegar al dedupe.
  const list = toMediaList(['https://momento360.com/tour', 'https://matterport.com/tour']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((m) => m.url), ['https://momento360.com/tour', 'https://matterport.com/tour']);
  // La misma pieza escrita con query distinto sí deduplica: la clave ignora la consulta.
  assert.equal(toMediaList(['https://momento360.com/tour', 'https://momento360.com/tour?utm=1']).length, 1);
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
