import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Contrato: toda plantilla que dibuja un documento completo (tiene <title> y <slot>)
 * declara la identidad del sitio --`NodosComunes` o un bloque `ld+json` propio--.
 * Medido sobre las 185 URLs del sitemap en producción: 5 rutas de `/legal` salían con
 * cero `application/ld+json` porque su layout nunca pasó ni por `BrandLayout` ni por
 * `NodosComunes`, y ahí es donde se declara `#organization` / `#website`.
 */
function astroBajo(dir) {
  const out = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...astroBajo(ruta));
    else if (entrada.endsWith('.astro')) out.push(ruta);
  }
  return out;
}

test('todo layout que pinta un documento declara WebSite u Organization', () => {
  const culpables = astroBajo('src')
    .filter((ruta) => {
      const fuente = readFileSync(ruta, 'utf-8');
      if (!fuente.includes('<title>') || !/<slot[\s/>]/.test(fuente)) return false;
      return !fuente.includes('NodosComunes') && !fuente.includes('application/ld+json');
    })
    .map((ruta) => relative(process.cwd(), ruta));
  assert.deepEqual(culpables, []);
});
