import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarConteos } from '../src/lib/llms.ts';

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
