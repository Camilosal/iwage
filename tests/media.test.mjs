import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMediaItem, toMediaList, mediaSrc, absUrl, embedSrc } from '../src/lib/media.ts';

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
  assert.equal(toMediaItem('https://my.matterport.com/show/?m=XXXX').kind, 'tour360');
});

test('toMediaItem: entiende la forma vieja { url, tipo, titulo }', () => {
  const m = toMediaItem({ url: 'https://vimeo.com/123456', tipo: 'video', titulo: 'Recorrido' });
  assert.equal(m.provider, 'vimeo');
  assert.equal(m.caption, 'Recorrido');
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

test('toMediaList: conserva la metadata más rica del duplicado', () => {
  const list = toMediaList([
    '/uploads/x.webp',
    { url: 'https://iwage.co/uploads/x.webp', titulo: 'Miel de Angelita' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].caption, 'Miel de Angelita');
});

test('toMediaList: ignora nulos y vacío', () => {
  assert.deepEqual(toMediaList([null, '', undefined, '/uploads/a.webp']), [{ url: '/uploads/a.webp', kind: 'imagen', provider: 'strapi' }]);
  assert.deepEqual(toMediaList(null), []);
});

test('embedSrc: convierte YouTube y Vimeo a su reproductible', () => {
  assert.equal(embedSrc('https://www.youtube.com/watch?v=abc12345678'), 'https://www.youtube.com/embed/abc12345678');
  assert.equal(embedSrc('https://youtu.be/abc12345678'), 'https://www.youtube.com/embed/abc12345678');
  assert.equal(embedSrc('https://vimeo.com/12345678'), 'https://player.vimeo.com/video/12345678');
  assert.equal(embedSrc('/uploads/x.mp4'), '/uploads/x.mp4');
});
