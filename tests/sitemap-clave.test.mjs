import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION_SITEMAP, claveSitemap } from '../src/lib/sitemap-bitacora.ts';

/**
 * El XML del sitemap se cachea entero en el Redis compartido, que sobrevive al rebuild del
 * contenedor. Medido 2026-09-24: el origen seguía sirviendo 185 URLs con las 5 hojas de
 * `/legal` que el código ya no declaraba desde `9f5e831`, porque la caché vieja (TTL 3600)
 * nunca se invalidó. La clave con versión es la salida: cambiar la lógica sube
 * `VERSION_SITEMAP` y el proceso nuevo escribe en una clave que nadie ha poblado.
 */
test('claveSitemap: lleva la versión al final, no el literal desnudo', () => {
  assert.equal(claveSitemap(), `sitemap:xml:v${VERSION_SITEMAP}`);
});

test('VERSION_SITEMAP: entero >= 2 (la v1 es la clave que quedó envenenada en producción)', () => {
  assert.equal(Number.isInteger(VERSION_SITEMAP), true);
  assert.ok(VERSION_SITEMAP >= 2, 'la clave sin sufijo ya tiene XML viejo en Redis');
});

test('la ruta del sitemap usa claveSitemap() y no reincroduce el literal', () => {
  const fuente = readFileSync('src/pages/sitemap.xml.ts', 'utf-8');
  assert.ok(fuente.includes('claveSitemap'), 'debe derivar la clave del módulo puro');
  assert.equal(
    /['"`]sitemap:xml['"`]/.test(fuente),
    false,
    'un literal sin versión en la ruta revive el bug de la caché vieja',
  );
});
