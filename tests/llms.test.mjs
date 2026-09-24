import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarConteos, seccionBitacora } from '../src/lib/llms.ts';

test('aplicarConteos: sustituye los tres marcadores y no deja llaves sueltas', () => {
  const salida = aplicarConteos('P: {{PROPIEDADES}} · B: {{PUBLICACIONES}} · U: {{URLS}}', {
    propiedades: 0,
    publicaciones: 56,
    urls: 189,
  });
  assert.equal(salida, 'P: 0 · B: 56 · U: 189');
});

test('aplicarConteos: una plantilla sin marcadores sale intacta', () => {
  assert.equal(aplicarConteos('sin nada', {}), 'sin nada');
});

test('seccionBitacora: una línea por publicación con su URL absoluta y el título', () => {
  const salida = seccionBitacora([{ marca: 'granja', slug: 'compost', titulo: 'Compost monitoreado' }]);
  assert.equal(
    salida,
    [
      '## Bitácora',
      '',
      '### granja — 1 publicación',
      'Índice: https://iwage.co/granja/bitacora',
      '- https://iwage.co/granja/bitacora/compost — Compost monitoreado',
    ].join('\n'),
  );
});

test('seccionBitacora: agrupa por marca y ordena por número de publicaciones', () => {
  const salida = seccionBitacora([
    { marca: 'granja', slug: 'g1', titulo: 'G1' },
    { marca: 'meliponas', slug: 'm1', titulo: 'M1' },
    { marca: 'meliponas', slug: 'm2', titulo: 'M2' },
  ]);
  assert.deepEqual(
    salida.split('\n').filter((l) => l.startsWith('### ') || l.startsWith('Índice:')),
    [
      '### meliponas — 2 publicaciones',
      'Índice: https://iwage.co/meliponas/bitacora',
      '### granja — 1 publicación',
      'Índice: https://iwage.co/granja/bitacora',
    ],
  );
});

test('seccionBitacora: sin slug o sin marca no emite URL', () => {
  assert.equal(
    seccionBitacora([{ marca: 'granja', slug: '', titulo: 'X' }, { marca: '', slug: 'y', titulo: 'Y' }]),
    ['## Bitácora', '', '- 0 publicaciones: la lista vive en /sitemap.xml'].join('\n'),
  );
});

test('seccionBitacora: un título con saltos de línea sigue ocupando una sola línea', () => {
  const salida = seccionBitacora([{ marca: 'granja', slug: 's', titulo: 'Uno\n   dos  ' }]);
  assert.ok(salida.includes('- https://iwage.co/granja/bitacora/s — Uno dos'));
});

test('seccionBitacora: sin entradas no queda un encabezado colgando', () => {
  assert.equal(
    seccionBitacora([]),
    ['## Bitácora', '', '- 0 publicaciones: la lista vive en /sitemap.xml'].join('\n'),
  );
});

test('aplicarConteos: {{BITACORA}} se sustituye por la sección y no deja llaves sueltas', () => {
  const salida = aplicarConteos('HEAD\n{{BITACORA}}\nTAIL', { bitacora: '## Bitácora\n\n- x' });
  assert.equal(salida, 'HEAD\n## Bitácora\n\n- x\nTAIL');
});
