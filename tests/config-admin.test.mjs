// Los secretos del panel y del runtime se definen en `strapi/config/admin.ts` y
// `strapi/config/server.ts`, que Strapi resuelve en el arranque. La prueba es de texto sobre el
// fuente (en el sitio no hay compilador de TS, así que es contrato de lectura como el resto).
//
// 1. Ningún `env('X', default)` para una variable de secreto. Un default publicado en un repo
//    público deja de ser default: es la contraseña con la que corre el servicio cuando la variable
//    falta. Medido el 2026-09-27 comparando por sha256 contra el contenedor vivo: `APP_KEYS`,
//    `API_TOKEN_SALT`, `ADMIN_JWT_SECRET` y `TRANSFER_TOKEN_SALT` estaban corriendo con exactamente
//    los literales de estos dos archivos; `JWT_SECRET` y `DATABASE_PASSWORD` no (esos sí vienen del
//    entorno del host).
// 2. `secrets.encryptionKey` definido en admin.ts. Sin él, @strapi/admin/…/services/encryption.mjs
//    avisa `Encryption key is missing from admin.secrets.encryptionKey configuration` y su
//    `encrypt()` devuelve null: por eso la columna `encrypted_key` del token 5
//    (`media-import-g3-2026-09-26`) quedó NULL y el panel no puede volver a mostrar esa clave. El
//    valor solo puede entrar por esta vía: medido por grep sobre `@strapi`, en 5.55.1 ningún código
//    lee un nombre de entorno `ENCRYPTION_KEY`, y lo único que consume `admin.secrets` es ese
//    servicio (grep sobre `admin\.secrets`: 4 líneas, todas en encryption.{mjs,js}).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

// Nombre de la variable → archivo donde se resuelve.
const SECRETOS = [
  ['ADMIN_JWT_SECRET', 'strapi/config/admin.ts'],
  ['API_TOKEN_SALT', 'strapi/config/admin.ts'],
  ['TRANSFER_TOKEN_SALT', 'strapi/config/admin.ts'],
  ['ENCRYPTION_KEY', 'strapi/config/admin.ts'],
  ['APP_KEYS', 'strapi/config/server.ts'],
];

test('ninguna variable de secreto lleva un default en el código (repo público)', () => {
  const ofensas = [];
  for (const [nombre, archivo] of SECRETOS) {
    const fuente = leer(archivo);
    const re = new RegExp(`env(?:\\.\\w+)?\\(\\s*['"]${nameExp(nombre)}['"]\\s*,`, 'g');
    for (const m of fuente.matchAll(re)) {
      ofensas.push(`${archivo}:${lineaDe(fuente, m.index)} ${nombre} con default`);
    }
  }
  assert.deepEqual(ofensas, [], ofensas.join(' · '));
});

test('cada secreto del panel se lee del entorno con un solo argumento', () => {
  const faltan = [];
  for (const [nombre, archivo] of SECRETOS) {
    const fuente = leer(archivo);
    if (!new RegExp(`env(?:\\.\\w+)?\\(\\s*['"]${nameExp(nombre)}['"]\\s*\\)`).test(fuente)) {
      faltan.push(`${archivo} no lee ${nombre}`);
    }
  }
  assert.deepEqual(faltan, [], faltan.join(' · '));
});

test('admin.ts define secrets.encryptionKey, que es lo que lee el servicio de cifrado', () => {
  assert.match(
    leer('strapi/config/admin.ts'),
    /secrets\s*:\s*\{[^}]*encryptionKey\s*:\s*env\(\s*['"]ENCRYPTION_KEY['"]\s*\)/,
    'falta secrets.encryptionKey: los tokens nuevos nacen con encrypted_key NULL'
  );
});

const nameExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineaDe = (txt, i) => txt.slice(0, i).split('\n').length;
