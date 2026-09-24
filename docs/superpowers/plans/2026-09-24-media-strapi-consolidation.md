# Consolidación de medios (Strapi único dueño) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo activo audiovisual del sitio tenga un solo dueño (Strapi), un solo formato (`MediaItem`) y cero duplicados, cableando los 56+ activos ya producidos que hoy no referencia ningún código.

**Architecture:** Un módulo `src/lib/media.ts` resuelve, clasifica y deduplica medios; una única `MediaGallery.astro` los renderiza. En Strapi cada concepto pasa a ser o bien un campo `media` (activo propio) o bien un `embed` con allowlist (material de tercero). Cuatro fases (F0-F3) desplegables y reversibles por separado: F0 hace visible lo existente, F1 unifica el formato, F2 normaliza el esquema y enlaza los huérfanos, F3 borra lo muerto.

**Tech Stack:** Astro 7 (SSR, `output: 'server'`), Node 22.12+, TypeScript sin compilador propio (type-stripping de Node en testes), `node --test`, Docker Compose (proyecto `negocio`), nginx como reversa, Strapi v5 con `@strapi/provider-upload-local`.

**Spec:** `docs/superpowers/specs/2026-09-24-media-strapi-consolidation-design.md` — leerla antes de tocar nada; este plan argumenta sobre ella.

## Global Constraints

- **Nunca `git add -A` ni `git commit -a`.** Hay trabajo de otro flujo sin commitear en `src/layouts/BrandLayout.astro`, `src/lib/schema-bitacora.ts`, `src/pages/index.astro`, `tests/schema-bitacora.test.mjs`. Antes de cada edición: `git status --short`. Si uno de esos cuatro archivos aparece modificado y hay que tocarlo, **preguntar antes de editar**.
- **No hay push ni deploy sin confirmación explícita del dueño.** Los tasks que requieren recrear contenedores o tocar `/home/ubuntu/negocio/docker-compose.yml` se detienen en el paso y piden autorización.
- `docker-compose.yml` vive en `/home/ubuntu/negocio/`, **fuera del repo**: sus cambios no se versionan aquí. Registrar cada cambio en el commit del repo como texto.
- Los scripts de este repo son públicos. **Prohibido** escribir en cualquier archivo una contraseña, token o cadena de conexión con credenciales. `reimport_products.py` y `strapi/scripts/{seed-heroes-pg,sync-experiencias,sync-propiedades}.mjs` ya las contienen: se rotan y se retiran, no se copian.
- Test runner: `npm test` → `node --test tests/*.test.mjs`. Los testes importan TypeScript directamente (`../src/lib/x.ts`), así que **todo archivo bajo `src/lib/` que se teste debe ser borrable de tipos**: sin `enum`, sin namespaces, sin parameter properties.
- `src/lib/media.ts` **no puede importar `./strapi.ts`** (arrastra `./redis.ts` → `ioredis`, que abre conexiones al importar). Lee `process.env` por su cuenta.
- Las rutas de imagen en el HTML son **relativas de sitio** (`/uploads/...`, `/images/...`). Absolutas solo en metadatos: `og:image`, `twitter:image`, JSON-LD.
- Copy en español, tono del sitio. Ningún texto nuevo promete material que no esté en pantalla.
- Línea de referencia de cada archivo en la spec puede haberse movido por el WIP concurrente: **localizar por patrón (`grep -n`), no por número de línea.**

---

# FASE F0 — que lo existente se vea y el sitio no se caiga

El hallazgo que gobierna esta fase: `strapiImage()` (`src/lib/strapi.ts:222-227`) antepone `STRAPI_URL`, que en Docker es `http://iwage_strapi:1337`, un host que el navegador no resuelve. Y `iwage_strapi` no tiene ningún volumen montado (`docker inspect iwage_strapi --format '{{json .Mounts}}'` → `[]`), así que lo que se sube al admin se pierde en el siguiente rebuild. Ninguna otra fase tiene sentido antes de cerrar estas dos.

### Task 1: Volumen durable para los uploads de Strapi

**Files:**
- Modify: `/home/ubuntu/negocio/docker-compose.yml` (bloque `iwage_strapi:`, línea ~1104-1141, fuera del repo)
- Modify: `/home/ubuntu/negocio/data/app_iwage/docs/superpowers/plans/2026-09-24-media-strapi-consolidation.md` (este archivo, sección "Registro de cambios de infraestructura")

**Interfaces:**
- Consumes: nada.
- Produces: `/app/public/uploads` persistente entre recreaciones del contenedor. El contrato de URL que firma este task — `/uploads/<archivo>` servido por nginx del sitio— lo consumen `mediaSrc` (Task 2) y el importador (Task 10).

- [ ] **Step 1: Verificar el estado actual (evidencia antes y después)**

Run:
```bash
docker inspect iwage_strapi --format '{{json .Mounts}}'
docker exec iwage_strapi sh -c 'ls -la /app/public/uploads | head'
```
Expected: `[]` en mounts, y en el directorio solo `.gitkeep`. Si ya hay archivos, **detenerse**: hay material que todavía no se perdió y hay que copiarlo al volumen antes de montarlo (`docker cp iwage_strapi:/app/public/uploads ./uploads-salvamento`).

- [ ] **Step 2: Pedir autorización para editar el compose y recrear el servicio**

Este paso es un bloqueo real: `/home/ubuntu/negocio/docker-compose.yml` es compartido por ~30 servicios y `docker compose up -d iwage_strapi` reinicia el CMS. No se ejecuta sin un "sí" del dueño.

- [ ] **Step 3: Añadir el volumen nombrado**

En el bloque `iwage_strapi:`, insertar después de `ports:` (mismo nivel de sangría, 4 espacios):

```yaml
    volumes:
      - iwage_strapi_uploads:/app/public/uploads
```

Y al final del archivo, en el bloque top-level `volumes:` (si no existe, crearlo al mismo nivel que `services:`):

```yaml
volumes:
  iwage_strapi_uploads:
```

Validar sin tocar contenedores:
```bash
cd /home/ubuntu/negocio && docker compose config --quiet && echo OK
docker compose config | grep -A3 "iwage_strapi_uploads"
```
Expected: `OK`, y el volumen resuelto con nombre `negocio_iwage_strapi_uploads`.

- [ ] **Step 4: Recrear y verificar la persistencia**

```bash
cd /home/ubuntu/negocio && docker compose up -d iwage_strapi
docker inspect iwage_strapi --format '{{json .Mounts}}'
```
Expected: un mount con `Type: volume`, `Destination: /app/public/uploads`.

Prueba de fuego — que sobreviva a una recreación:
```bash
docker exec iwage_strapi sh -c 'echo prueba > /app/public/uploads/_persistencia.txt'
docker compose -f /home/ubuntu/negocio/docker-compose.yml up -d --force-recreate iwage_strapi
docker exec iwage_strapi cat /app/public/uploads/_persistencia.txt
```
Expected: `prueba`. Luego limpiar: `docker exec iwage_strapi rm /app/public/uploads/_persistencia.txt`.

- [ ] **Step 5: Verificar que nginx sirve /uploads desde el sitio**

```bash
docker exec iwage_strapi sh -c 'printf "iwage" > /app/public/uploads/_probe.txt'
curl -s -o /dev/null -w '%{http_code}\n' https://iwage.co/uploads/_probe.txt
docker exec iwage_strapi rm /app/public/uploads/_probe.txt
```
Expected: `200`. Esto es lo que hace viable `mediaSrc` relativo: `/uploads/x` funciona en el navegador sin conocer el host interno. Si da `404`, **no continuar**: la premisa de F0 no se cumple y hay que revisar `nginx.conf:92` (`location ^~ /uploads` → `upstream strapi_backend` → `iwage_strapi:1337`).

- [ ] **Step 6: Sumar el respaldo de uploads al ritual existente de backup**

```bash
ls -la /home/ubuntu/negocio/*.sql /home/ubuntu/negocio/backup* 2>/dev/null
docker volume inspect negocio_iwage_strapi_uploads --format '{{.Name}}'
```
Documentar en la sección de infraestructura de este plan el comando de respaldo, en la misma rutina que los dumps de Postgres:
```bash
docker run --rm -v negocio_iwage_strapi_uploads:/from -v /home/ubuntu/backup:/to alpine \
  sh -c 'cd /from && tar czf /to/iwage-uploads-$(date +%F).tar.gz .'
```

- [ ] **Step 7: Commit (docs del repo)**

```bash
cd /home/ubuntu/negocio/data/app_iwage
git add docs/superpowers/plans/2026-09-24-media-strapi-consolidation.md
git commit -m "chore(infra): volumen durable para uploads de iwage_strapi"
```
El compose no está en el repo: por eso el commit es solo el registro.

### Task 2: `src/lib/media.ts` — el contrato único

**Files:**
- Create: `src/lib/media.ts`
- Test: `tests/media.test.mjs`

**Interfaces:**
- Consumes: variables de entorno `APP_URL` (default `https://iwage.co`) y `STRAPI_URL`.
- Produces: `MediaKind`, `MediaProvider`, `MediaItem`, `StrapiMedia`, `toMediaItem(unknown): MediaItem | null`, `toMediaList(unknown): MediaItem[]`, `mediaSrc(unknown): string | null`, `absUrl(string | null): string | null`, `embedSrc(string): string`, `isEmbed(MediaItem): boolean`. Los consumen Task 3 (todos los llamadores de `strapiImage`), Task 4 (OG), Task 8 (`MediaGallery`), Task 12 (plantillas de ficha).

- [ ] **Step 1: Escribir los testes que fallan**

`tests/media.test.mjs`:

```js
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
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd /home/ubuntu/negocio/data/app_iwage && node --test tests/media.test.mjs`
Expected: `Cannot find module '../src/lib/media.ts'`.

- [ ] **Step 3: Implementar `src/lib/media.ts`**

```ts
/**
 * Contrato único de medios del sitio.
 *
 * Todo lo que es imagen, video o recorrido 360 llega aquí y sale como MediaItem.
 * Regla de oro: la URL que se pinta en el HTML es relativa de sitio (/uploads/...),
 * porque nginx ya proxya /uploads hacia Strapi. Las absolutas existen solo para
 * og:image, twitter:image y JSON-LD, que no aceptan rutas relativas.
 *
 * No importa ./strapi.ts: arrastra ioredis y abre conexiones al cargarse.
 */

export type MediaKind = 'imagen' | 'video' | 'tour360';
export type MediaProvider = 'strapi' | 'youtube' | 'vimeo' | 'drive' | 'otro';

export interface MediaItem {
  url: string;
  kind: MediaKind;
  alt?: string;
  caption?: string;
  provider?: MediaProvider;
}

/** Forma del objeto media de Strapi v5 (solo lo que usamos). */
export interface StrapiMedia {
  id?: number;
  documentId?: string;
  url?: string | null;
  mime?: string | null;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Formas históricas de galería repartidas por src/lib. */
interface LegacyItem {
  url?: string | null;
  tipo?: string;
  titulo?: string;
  alt?: string;
  caption?: string;
  kind?: string;
  mime?: string;
}

const SITE_URL = () => process.env.APP_URL || 'https://iwage.co';

function safeUrl(raw: string): URL | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try { return new URL(raw); } catch { return null; }
}

/** Hosts que en realidad son este mismo sitio dicho de otra manera. */
function isSelfHost(host: string): boolean {
  if (host === 'iwage.co' || host === 'www.iwage.co' || host === 'iwage_strapi' || host === 'strapi_backend') return true;
  const strapi = safeUrl(process.env.STRAPI_URL || '');
  return !!strapi && strapi.hostname === host;
}

function rawOf(input: unknown): string | null {
  if (typeof input === 'string') {
    const t = input.trim();
    return t || null;
  }
  if (!input || typeof input !== 'object') return null;
  const o = input as StrapiMedia & LegacyItem;
  const u = (o.url || '').trim();
  return u || null;
}

function classify(url: string): { kind: MediaKind; provider: MediaProvider } {
  const u = safeUrl(url);
  const host = u ? u.hostname : '';
  if (/youtu\.?be/.test(host)) return { kind: 'video', provider: 'youtube' };
  if (/vimeo/.test(host)) return { kind: 'video', provider: 'vimeo' };
  if (/drive\.google/.test(host)) return { kind: 'imagen', provider: 'drive' };
  if (/(matterport|kuula|360|pano|tourmkr)/.test(host + url)) return { kind: 'tour360', provider: 'otro' };
  const path = url.split(/[?#]/)[0];
  if (/\.(mp4|webm|mov|m4v|m4a|mp3|ogg|wav)$/i.test(path)) return { kind: 'video', provider: 'strapi' };
  return { kind: 'imagen', provider: 'strapi' };
}

const TIPO_VIEJO: Record<string, MediaKind> = {
  imagen: 'imagen', image: 'imagen', video: 'video', '360': 'tour360', tour360: 'tour360', tour: 'tour360',
};

export function mediaSrc(input: unknown): string | null {
  const raw = rawOf(input);
  if (!raw) return null;
  const u = safeUrl(raw);
  if (u && isSelfHost(u.hostname)) return u.pathname;
  return raw;
}

export function absUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, SITE_URL()).toString(); } catch { return null; }
}

export function toMediaItem(input: unknown): MediaItem | null {
  const raw = rawOf(input);
  if (!raw) return null;
  const url = mediaSrc(raw)!;
  const clas = classify(url);

  let kind = clas.kind;
  let provider = clas.provider;
  let alt: string | undefined;
  let caption: string | undefined;

  if (input && typeof input === 'object') {
    const o = input as StrapiMedia & LegacyItem;
    if (o.mime && /^video\//.test(o.mime)) kind = 'video';
    if (o.tipo) kind = TIPO_VIEJO[o.tipo] ?? kind;
    if (o.kind && TIPO_VIEJO[o.kind]) kind = TIPO_VIEJO[o.kind];
    alt = o.alternativeText ?? o.alt ?? undefined;
    caption = o.caption ?? o.titulo ?? undefined;
  }

  return { url, kind, provider, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) };
}

/** Clave de dedupe: la misma pieza escrita de cualquier forma converge. */
function canonicalKey(url: string): string {
  const u = safeUrl(url);
  return (u ? u.pathname : url).toLowerCase();
}

const RIQUEZA = (m: MediaItem) => (m.alt ? 2 : 0) + (m.caption ? 1 : 0);

export function toMediaList(input: unknown): MediaItem[] {
  const arr = Array.isArray(input) ? input : input == null ? [] : [input];
  const seen = new Map<string, MediaItem>();
  for (const entry of arr) {
    // Un array anidado es la forma en que Strapi devuelve una relación multiple.
    const nodes = Array.isArray(entry) ? entry : [entry];
    for (const node of nodes) {
      const item = toMediaItem(node);
      if (!item) continue;
      const key = canonicalKey(item.url);
      const prev = seen.get(key);
      if (!prev || RIQUEZA(item) > RIQUEZA(prev)) seen.set(key, item);
    }
  }
  return [...seen.values()];
}

export function isEmbed(item: MediaItem): boolean {
  return item.provider === 'youtube' || item.provider === 'vimeo'
    || item.provider === 'drive' || item.kind === 'tour360';
}

/** URL reproducible en <iframe>. Imagen y video propio pasan intactas. */
export function embedSrc(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }
  if (/vimeo\.com/.test(url)) {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  if (/drive\.google\.com\/file\/d\/(.+)/.test(url)) {
    const m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
  }
  return url;
}
```

- [ ] **Step 4: Correr los testes**

Run: `node --test tests/media.test.mjs`
Expected: 13 testes, todos en verde.

- [ ] **Step 5: Verificar que no rompió la suite ni el build**

Run: `npm test && npm run build`
Expected: `pass`, build sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/media.ts tests/media.test.mjs
git commit -m "feat(media): contrato único MediaItem con resolución relativa de sitio"
```

### Task 3: Sustituir `strapiImage()` por `mediaSrc()` en los 19 archivos

**Files:**
- Modify: los 19 archivos de `src/` que referencian `strapiImage` (lista en el Step 1)
- Modify: `src/lib/strapi.ts` (borrar la función, líneas ~216-227)
- Modify: `src/lib/heroes.ts`, `src/pages/naturaleza/anfitriones/[slug].astro`, `src/lib/gestion.ts`, `src/pages/feed/google-merchant.xml.ts` (los que hoy pintan la ruta cruda y por eso sí funcionan)
- Test: `tests/media-contract.test.mjs`

**Interfaces:**
- Consumes: `mediaSrc`, `absUrl` de `src/lib/media.ts` (Task 2).
- Produces: `strapiImage` deja de existir. Todo medio que pinta en HTML pasa por `mediaSrc`; todo medio que va a metadatos o a un feed pasa por `absUrl(mediaSrc(...))`.

- [ ] **Step 1: Obtener la lista real, no de memoria**

```bash
cd /home/ubuntu/negocio/data/app_iwage
grep -rln "strapiImage" src/ | sort | tee /tmp/strapi-image-files.txt
grep -rn "strapiImage" src/ | wc -l
```
Expected: 20 archivos (19 consumidores + `src/lib/strapi.ts`) y ~53 referencias. Si el número cambió desde que se escribió este plan, la lista de `/tmp/strapi-image-files.txt` manda.

- [ ] **Step 2: Escribir el teste de contrato que falla**

`tests/media-contract.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function archivosEn(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivosEn(p));
    else if (/\.(astro|ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

test('nadie vuelve a importar strapiImage: la resolución de URLs es mediaSrc', () => {
  const culpables = archivosEn('src')
    .filter((f) => /strapiImage/.test(readFileSync(f, 'utf8')))
    .join(', ');
  assert.equal(culpables, '', `still referencing strapiImage: ${culpables}`);
});

test('ninguna URL interna de Strapi puede llegar al HTML', () => {
  const culpables = archivosEn('src/pages')
    .filter((f) => /iwage_strapi:1337/.test(readFileSync(f, 'utf8')))
    .join(', ');
  assert.equal(culpables, '', `hardcoded internal host in pages: ${culpables}`);
});
```

- [ ] **Step 3: Correr para ver fallar**

Run: `node --test tests/media-contract.test.mjs`
Expected: FAIL, con la lista de archivos en el mensaje.

- [ ] **Step 4: Migración mecánica de import y de llamada**

```bash
cd /home/ubuntu/negocio/data/app_iwage
for f in $(grep -rl "strapiImage" src/ | grep -v "src/lib/strapi.ts"); do
  perl -0pi -e "s/\bstrapiImage\b/mediaSrc/g" "\$f"
done
git diff --stat
```
Luego, a mano en cada archivo migrado, ajustar el `import`: la línea debe quedar con `mediaSrc` **desde `@/lib/media`** (o `./media` en `src/lib/`), no desde `strapi`. Ejemplo en `src/lib/naturaleza.ts`:

```ts
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc } from './media';
```

Y en los `.astro`/`.ts` de `src/pages`:

```ts
import { mediaSrc } from '@/lib/media';
```

- [ ] **Step 5: Cubrir los cuatro sitios que pintaban la ruta cruda**

Estos hoy se ven bien justo porque no llaman a `strapiImage`; al pasarlos por `mediaSrc` siguen viéndose bien y quedan consistentes:

- `src/lib/heroes.ts` en `normalize()`: `imagen: mediaSrc(rec.imagen)`. Cambiar el tipo del campo a `string | null` explícito si el TS lo pide.
- `src/pages/naturaleza/anfitriones/[slug].astro`: donde se pinte `foto_perfil` / `galeria_fotos` crudos, envolver con `mediaSrc(...)`.
- `src/lib/gestion.ts`: mismo criterio en el campo de portada.
- `src/pages/feed/google-merchant.xml.ts`: `image_link` de un feed **debe ser absoluto** → `absUrl(mediaSrc(p.imagen))`. Lo mismo para cualquier `<image>` de `sitemap`/RSS que exista en `src/pages/feed/`.

```bash
grep -rn "absUrl" src/pages/feed/ ; grep -rn "imagen" src/pages/feed/*.ts | head
```
Expected: los feeds usan `absUrl(mediaSrc(...))`, nunca `mediaSrc` solo.

- [ ] **Step 6: Borrar `strapiImage` de `src/lib/strapi.ts`**

Eliminar la función y su bloque de comentario (líneas ~216-227, localizar con `grep -n "strapiImage" src/lib/strapi.ts`). No dejar un shim de compatibilidad: si queda, alguien lo seguirá usando.

- [ ] **Step 7: Verificar**

```bash
node --test tests/media-contract.test.mjs && npm test && npm run build
```
Expected: contrato en verde, suite completa en verde, build sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/ tests/media-contract.test.mjs
git status --short   # revisar que no se colaron archivos del otro flujo
git commit -m "fix(media): resuelve URLs de Strapi relativas de sitio en todo el sitio"
```

### Task 4: `og:image` y JSON-LD con URL absoluta

**Files:**
- Modify: `src/layouts/BrandLayout.astro` — anclas `const ogImage =`, `<meta property="og:image"`, `<meta name="twitter:image"`, `"image": a.image ?? ogImage`
- Test: `tests/og-image-absoluta.test.mjs`

**Interfaces:**
- Consumes: `absUrl`, `mediaSrc` (Task 2).
- Produces: `ogImage` siempre absoluto o ausente; `hero-<slug>.webp` deja de ser un ternario que no hace nada.

**Atención:** `BrandLayout.astro` es uno de los cuatro archivos con WIP de otro flujo. Antes de editar: `git status --short`. Si aparece modificado y el diff ajeno toca la zona de OG, detenerse y preguntar.

- [ ] **Step 1: El teste que falla**

`tests/og-image-absoluta.test.mjs` — se prueba el helper puro nuevo, no el layout (Astro no se importa en testes):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ogImageDe } from '../src/lib/og-image.ts';

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
```

Run: `node --test tests/og-image-absoluta.test.mjs`
Expected: FAIL — `og-image.ts` no existe.

- [ ] **Step 2: Implementar `src/lib/og-image.ts`**

```ts
import { mediaSrc, absUrl } from './media';

const MARCAS = ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion', 'granja'] as const;
type Marca = (typeof MARCAS)[number];

/**
 * og:image / twitter:image / JSON-LD image: siempre absolutas.
 * El chrome de marca (hero-*.webp) es un activo de diseño versionado en public/,
 * no un contenido de Strapi: cambian con el CSS y despliegan con él.
 */
export function ogImageDe({ brand, imagen }: { brand: string; imagen?: string | null }): string {
  const propia = absUrl(mediaSrc(imagen));
  if (propia) return propia;
  const slug = (MARCAS as readonly string[]).includes(brand) ? brand as Marca : 'meliponas';
  return absUrl(`/images/hero-${slug}.webp`)!;
}
```

- [ ] **Step 3: Correr el teste**

Run: `node --test tests/og-image-absoluta.test.mjs`
Expected: 4 testes verdes.

- [ ] **Step 4: Usarlo en el layout**

En `BrandLayout.astro`, reemplazar la asignación de `ogImage` (hoy un ternario que devuelve lo mismo en las dos ramas) por:

```ts
import { ogImageDe } from '@/lib/og-image';
// ...
const ogImage = ogImageDe({ brand: brandConfig.slug, imagen: props.ogImage ?? null });
```

Las tres etiquetas (`og:image`, `twitter:image`, `"image"` del Article) ya consumen `ogImage`, así que no se tocan. Si `props.ogImage` llegaba ya absoluto de un externo, `ogImageDe` lo deja intacto.

- [ ] **Step 5: Verificar en el HTML servido**

```bash
npm run build && npm run preview -- --port 4331 &
sleep 6
for r in /meliponas/ /cafe/ /tierras/ /gestion/ /naturaleza/ /granja/; do
  printf '%s ' "$r"
  curl -s "http://127.0.0.1:4331$r" | grep -o 'property="og:image" content="[^"]*"' | head -1
done
```
Expected: seis URLs que empiezan por `https://iwage.co/`, ninguna con `iwage_strapi`, ninguna `/images/hero-.webp` pelada. Matar el preview al terminar.

- [ ] **Step 6: Commit**

```bash
git add src/lib/og-image.ts src/layouts/BrandLayout.astro tests/og-image-absoluta.test.mjs
git commit -m "fix(seo): og:image absoluta derivada del medio resuelto"
```

### Task 5: Que la caída de Strapi no sea un 500 en las 40 páginas con hero

**Files:**
- Modify: `src/lib/heroes.ts` (las tres funciones públicas)
- Test: `tests/heroes-resilencia.test.mjs`

**Interfaces:**
- Consumes: `strapiFetch` actual, `mediaSrc`.
- Produces: `getHeroes(): Promise<HeroConfig[]>`, `getHeroBySlug(): Promise<HeroConfig | null>`, `getHeroesByPrefix(): Promise<HeroConfig[]>` — mismos nombres y firmas, pero **nunca rechazan**: en fallo devuelven `[]` / `null`. Lo consumen las ~40 páginas con hero y Task 6.

- [ ] **Step 1: El teste que falla**

`tests/heroes-resilencia.test.mjs`. Dos cosas hay que aislar antes de importar: Redis (para no escribir en la caché real) y `fetch` (para simular Strapi caído). El entorno se fija **antes** del `import()` dinámico, porque `redis.ts` lee `REDIS_URL` al cargarse:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // puerto enano: el breaker abre y cacheGet devuelve null
process.env.APP_URL = 'https://iwage.co';

const { getHeroes, getHeroBySlug, getHeroesByPrefix } = await import('../src/lib/heroes.ts');

const registro = {
  data: [{
    id: 1, documentId: 'd1', pagina: 'Café', slug_ruta: '/cafe', titulo: 'Café de origen',
    subtitulo: null, imagen: 'http://iwage_strapi:1337/uploads/hero-cafe.webp',
    label: null, cta_primario_texto: null, cta_primario_url: null,
    cta_secundario_texto: null, cta_secundario_url: null, color_overlay: null, orden: 1,
  }],
  meta: {},
};

test('Strapi caído: getHeroes devuelve [] y no rechaza', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    assert.deepEqual(await getHeroes(), []);
    assert.equal(await getHeroBySlug('/cafe'), null);
    assert.deepEqual(await getHeroesByPrefix('/cafe'), []);
  } finally {
    globalThis.fetch = real;
  }
});

test('Strapi con 503: tampoco se propaga', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('oops', { status: 503 });
  try {
    assert.deepEqual(await getHeroes(), []);
  } finally {
    globalThis.fetch = real;
  }
});

test('Strapi sano: el hero normaliza y la imagen queda relativa de sitio', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(registro), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
  try {
    const hero = await getHeroBySlug('/cafe');
    assert.equal(hero.imagen, '/uploads/hero-cafe.webp');
    assert.equal(hero.titulo, 'Café de origen');
  } finally {
    globalThis.fetch = real;
  }
});
```

Run: `node --test tests/heroes-resilencia.test.mjs`
Expected: los dos primeros testes fallan (rechazan con `ECONNREFUSED` / `Strapi error: 503`); el tercero falla por la URL con host interno.

- [ ] **Step 2: Implementar la tolerancia**

En `src/lib/heroes.ts`, añadir arriba del todo el import y un único envoltorio, y usarlo en las tres funciones:

```ts
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc } from './media';

/**
 * Strapi puede estar caído; una landing de marca no puede ser un 500 por eso.
 * El costo de fallar blando es un hero sin foto, no una página fuera de línea.
 */
async function fetchSeguro<T>(endpoint: string, options: Parameters<typeof strapiFetch>[1]) {
  try {
    return await strapiFetch<T>(endpoint, options);
  } catch (err) {
    console.warn(`[heroes] Strapi no responde para ${endpoint}:`, (err as Error).message);
    return { data: [], meta: {} } as Awaited<ReturnType<typeof strapiFetch<T>>>;
  }
}
```

Sustituir las tres llamadas `await strapiFetch<StrapiHeroRecord>(ENDPOINT, {...})` por `await fetchSeguro<StrapiHeroRecord>(ENDPOINT, {...})`.

Y en `normalize()`:

```ts
    imagen: mediaSrc(rec.imagen),
```

- [ ] **Step 3: Correr los testes**

Run: `node --test tests/heroes-resilencia.test.mjs`
Expected: 3 verdes. (El aviso `[redis] Connection failed` en la salida es esperado: es el breaker del entorno de teste.)

- [ ] **Step 4: Verificar de punta a punta con Strapi detenido**

Con autorización del dueño (esto interrumpe el CMS unos segundos):

```bash
docker stop iwage_strapi && sleep 3
for u in / /meliponas/ /cafe/ /tierras/ /granja/ /naturaleza/ /gestion/; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' https://iwage.co$u)" "$u"
done
docker start iwage_strapi
```
Expected antes de F0: varios `500`. Después: `200` en las siete. Si no hay autorización para detener el contenedor, el teste unitario del Step 3 es la evidencia y se anota que la prueba en vivo quedó pendiente.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heroes.ts tests/heroes-resilencia.test.mjs
git commit -m "fix(heroes): la caída de Strapi degrada a hero sin foto, no a 500"
```

### Task 6: Cerrar los dos agujeros visibles de las plantillas de hero y galería

**Files:**
- Modify: `src/components/shared/MediaGallery.astro` (ancla `<img data-gal-img`)
- Modify: `src/components/Hero.astro` (ancla `bg-[#1a1a17]` y el bloque `{imagen && ...}`)
- Test: ninguno nuevo en este task (son componentes de Astro; se verifican por build + HTML servido). La lógica que introduce ya está cubierta por Task 2.

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `MediaGallery` que no emite `src=""`; `Hero` que sin imagen no es un rectángulo negro y acepta `poster`/`embed`. Task 8 reescribe `MediaGallery` completa; este arreglo es el que hace que F0 sea desplegable sin esperar a F1.

- [ ] **Step 1: Quitar el `src=""` del escenario del lightbox**

Hoy, si el primer elemento es un video, se renderiza `<img data-gal-img src="" alt="">`. Cambiar el `<img data-gal-img ...>` por un render condicionado:

```astro
    {items[0].tipo === 'imagen' ? (
      <img data-gal-img src={items[0].url} alt="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
    ) : (
      <div data-gal-img-placeholder class="w-full max-w-4xl aspect-video rounded-lg bg-surface-sunken"></div>
    )}
```

Y en el `<script define:vars>` de `show()`, donde hoy se hace `stage.innerHTML = ''; stage.appendChild(img);`, cubrir el caso en que `img` no exista:

```js
      } else {
        stage.innerHTML = '';
        if (img) {
          img.src = item.url;
          img.alt = item.titulo || '';
          img.style.display = '';
          stage.appendChild(img);
        } else {
          const el = document.createElement('img');
          el.src = item.url;
          el.alt = item.titulo || '';
          el.className = 'max-w-full max-h-full object-contain rounded-lg shadow-2xl';
          stage.appendChild(el);
        }
      }
```

- [ ] **Step 2: Verificar el HTML**

```bash
npm run build && grep -c 'src=""' dist/**/*.astro.mjs 2>/dev/null; \
  grep -rn 'src=""' src/components/shared/MediaGallery.astro
```
Expected: cero coincidencias en el segundo comando.

- [ ] **Step 3: `Hero` sin imagen deja de ser negro plano**

`Hero.astro` hoy pinta `<header class="... bg-[#1a1a17]">` y, si no hay `imagen`, solo el gradiente sobre ese gris casi negro. Añadir fondo de marca cuando no hay foto y una props de medio:

```ts
interface Props {
  // ... las existentes
  /** Video o recorrido embebido como medio del hero (alternativa a imagen) */
  embed?: string | null;
  poster?: string | null;
}
```

y en el `<header>`:

```astro
  class:list={[
    'relative overflow-hidden min-h-[38vh] flex items-center',
    imagen || embed || poster ? 'bg-[#1a1a17]' : 'bg-surface-sunken',
    isCenter && 'justify-center',
  ]}
```

El `poster` se pinta igual que `imagen` (es un `<img>` de fondo), y `embed` se renderiza debajo del overlay como `<video>` si es un archivo propio o `<iframe>` si es un embed:

```astro
  {poster && !imagen && (
    <img src={poster} alt="" aria-hidden="true"
      class="absolute inset-0 h-full w-full object-cover opacity-70 dark:opacity-50" loading="eager" />
  )}
```

- [ ] **Step 4: Verificar una página sin hero**

```bash
npm run build
grep -o 'class="relative overflow-hidden[^"]*"' dist/_astro/*.js 2>/dev/null | head -3
```
Y en el preview (Task 4 Step 5), confirmar que una ruta cuyo hero no tenga imagen se ve con fondo de superficie, no negra.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/MediaGallery.astro src/components/Hero.astro
git commit -m "fix(ui): galería sin src vacío y hero sin imagen deja de ser negro"
```

**Gate F0 → F1.** Antes de seguir: un activo subido al admin se ve en `https://iwage.co/uploads/...`; con Strapi detenido las 7 rutas clave responden 200; `npm test` y `npm run build` verdes. Si el volumen del Task 1 no quedó montado, no se avanza: F1 y F2 asumen que lo subido persiste.

---

# FASE F1 — un solo formato, un solo componente

F0 hace que el medio se vea. F1 hace que solo haya una manera de decirlo. Aquí se borran las cuatro copias del tipo de galería, los dos componentes incompatibles y los seeds que se hacían pasar por datos.

### Task 7: `MediaItem` canónico y desaparición de las cuatro copias del tipo

**Files:**
- Modify: `src/lib/tienda.ts:9-13` (`export interface GaleriaItem`)
- Modify: `src/lib/proyectos.ts:17-21`
- Modify: `src/lib/polinizacion.ts:9-13`
- Modify: `src/components/shared/MediaGallery.astro:9-13` (`export interface GalleryItem`)
- Modify: los consumidores de esos tipos (`ProductGallery.astro:11,14`, y quienes declaren `galeria:` en las interfaces de `Producto`, `ProyectoMeliponario`, `CultivoPolinizacion`, `Experiencia`, `Anfitrion`)

**Interfaces:**
- Consumes: `MediaItem` de Task 2.
- Produces: `MediaItem` como único tipo de galería en todo `src/`. Firma de los campos de galería en las interfaces de dato: `galeria: MediaItem[] | null`. Task 8 y Task 12 dependen de que ya no exista `GaleriaItem` ni `GalleryItem`.

- [ ] **Step 1: Contar los consumidores antes de tocar**

```bash
cd /home/ubuntu/negocio/data/app_iwage
grep -rn "GaleriaItem\|GalleryItem" src/ | sort
```
Guardar la salida: es la lista de edición de este paso. Si aparece algún importador no previsto, se incluye.

- [ ] **Step 2: Reemplazar tipo por tipo**

En `src/lib/tienda.ts`, borrar `export interface GaleriaItem {...}` y reemplazar por:

```ts
import type { MediaItem } from './media';
export type { MediaItem };
```

Hacer lo mismo en `proyectos.ts` y `polinizacion.ts`. En `MediaGallery.astro`, eliminar la exportación de `GalleryItem` y pasar a importar el tipo de `@/lib/media` (Task 8 reescribe el componente entero, así que aquí basta con dejar de exportar el duplicado).

`type` en el import: son tipos, no deben arrastrar el módulo a runtime dentro de un componente Astro.

- [ ] **Step 3: Cambiar las firmas de los campos**

Donde una interfaz declare `galeria: GaleriaItem[] | null` o `galeria: Array<{ url: string; tipo?: string; titulo?: string }>` (hay un inline así en `naturaleza.ts`, función `experienciaGaleria`), dejar `galeria: MediaItem[] | null`.

- [ ] **Step 4: Compilar**

```bash
npx astro check 2>&1 | tail -30 || npm run build
```
Expected: los errores que queden están todos en la lista del Step 1: cada `tipo` → `kind`, cada `titulo` → `caption`. Se corrigen en el sitio de consumo con `caption: item.titulo` o directamente renombrando. No se deja un shim que acepte `tipo` y `kind` a la vez.

- [ ] **Step 5: Verificar y commit**

```bash
grep -rn "GaleriaItem\|GalleryItem" src/ ; npm test && npm run build
git add -u src/lib src/components && git add tests/
git status --short
git commit -m "refactor(media): MediaItem único, fuera las cuatro copias del tipo de galería"
```
Expected: el `grep` no devuelve nada. `git add -u` acotado a `src/lib src/components`, nunca `-A`.

### Task 8: `MediaGallery` única; `ProductGallery` se borra

**Files:**
- Modify: `src/components/shared/MediaGallery.astro` (reescribir sobre la base actual)
- Delete: `src/components/shared/ProductGallery.astro`
- Modify: `src/pages/meliponas/tienda/[slug].astro:~138`, `src/pages/granja/tienda/[slug].astro:~139`
- Modify: las 4 páginas que hoy usan `MediaGallery` (localizar con grep, no de memoria)

**Interfaces:**
- Consumes: `MediaItem`, `toMediaList`, `embedSrc`, `isEmbed` (Task 2).
- Produces: `<MediaGallery items={MediaItem[]} title={string} columns={4|3|2} />`. Las fichas de producto y las fichas de experiencia/granja consumen este único componente.

- [ ] **Step 1: Inventariar consumidoras reales**

```bash
grep -rln "ProductGallery\|MediaGallery" src/pages src/components | sort
```
Expected: 2 de `ProductGallery` + 4 de `MediaGallery`. Anotar las rutas: hay que verificar las 6 al final del task.

- [ ] **Step 2: Reescribir `MediaGallery.astro`**

Cambios sobre el archivo actual, manteniendo su estructura de lightbox (que ya funciona) y absorbiendo lo único que `ProductGallery` hacía mejor:

1. Props: `items: (MediaItem | string | unknown)[]` normalizado internamente con `toMediaList`, para que las plantillas viejas que pasan `string[]` sigan sirviendo sin tocarlas.
2. Borrar el `export interface GalleryItem` y el `if (items.length === 0) return;` duplicado del normalize: queda `const items = toMediaList(Astro.props.items);` y el guard temprano.
3. Reemplazar los `Math.random()` de `gid` por un id determinista derivado del propio contenido y del pathname, para que servidor y cliente coincidan:
   ```ts
   const gid = `gal-${Buffer.from(`${Astro.url.pathname}:${items.map((i) => i.url).join('')}`).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 10)}`;
   ```
   (Si `Buffer` molesta en el entorno edge, usar `Array.from(new TextEncoder().encode(x)).reduce(...)` — lo importante es que sea determinista, no la fórmula.)
4. Renombrar el campo discriminante en todo el componente: `item.tipo` → `item.kind`, `item.titulo` → `item.caption`, con `'360'` → `'tour360'`.
5. Unificar los helpers de embebido: importar `embedSrc` y `isEmbed` de `@/lib/media` y **eliminar** las copias locales de `isYouTube`/`ytEmbed` (hay dos, una en el frontmatter y otra dentro del `<script>`). El `<script>` del navegador no puede importar el módulo TS, así que la lista de items que se serializa ya debe llevar el `embed` resuelto en el servidor:
   ```ts
   const serializables = items.map((i) => ({ ...i, embed: isEmbed(i) ? embedSrc(i.url) : i.url }));
   ```
   y `<script data-gal-items={gid} type="application/json" set:html={JSON.stringify(serializables)} />`. En el `<script>` cliente, usar `item.embed` en lugar de recalcular. Esto cierra de paso el `<iframe src="${embedUrl}">` construido a mano en el JS, que hoy es terreno fértil para inyección: `embedSrc` corre solo contra dominios esperados, y el `src` del iframe se asigna por propiedad, no con `innerHTML` con interpolación.
6. Donde `ProductGallery` tenía el indicador `Video`/`360°` sobre el visor principal, conservar el equivalente en la tira de miniaturas (ya existe: `data-gal-open`).

- [ ] **Step 3: Migrar las dos fichas de producto**

```bash
grep -n "ProductGallery" src/pages/meliponas/tienda/[slug].astro src/pages/granja/tienda/[slug].astro
```
En cada una: cambiar el import por `MediaGallery` y la llamada por `items={producto.galeria ?? (producto.imagen ? [producto.imagen] : [])}`. La firma `title={producto.nombre}` se conserva.

- [ ] **Step 4: Borrar `ProductGallery.astro`**

```bash
git rm src/components/shared/ProductGallery.astro
grep -rn "ProductGallery" src/ ; echo "rc=$?"
```
Expected: grep sin coincidencias.

- [ ] **Step 5: Verificar las 6 consumidoras en el navegador**

```bash
npm run build && npm run preview -- --port 4331 &
sleep 6
for u in /meliponas/tienda/<slug-real> /granja/tienda/<slug-real> /naturaleza/experiencias/<slug> /tierras/propiedades/<slug>; do
  echo "== $u"; curl -s "https://iwage.co$u" | grep -o 'data-gallery-wrapper="[^"]*"' | head -2
done
```
Reemplazar `<slug-real>` por slugs que existan (`curl -s https://iwage.co/meliponas/tienda | grep -o '/meliponas/tienda/[a-z0-9-]*' | head`). Comprobar a mano: miniaturas, clic que abre lightbox, flechas, Escape, y que **no** quede un `src=""` en el HTML. Con las galerías hoy vacías en Strapi, el componente no debe renderizarse (guard `items.length === 0`) — eso también es parte de la verificación: ausencia limpia, no marco vacío.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/MediaGallery.astro src/pages/
git commit -m "refactor(media): una sola galería; se va ProductGallery"
```

### Task 9: Fuera los seeds que se hacían pasar por datos

**Files:**
- Modify: `src/lib/tienda.ts` (bloque `FALLBACK_PRODUCTOS`, ancla `// ── Fallback seed data`, y sus 4 usos en las funciones de consulta)
- Modify: `src/lib/proyectos.ts` (bloque `FALLBACK_PROYECTOS`)
- Modify: `src/lib/naturaleza.ts` (`FALLBACK_COMPLEMENTOS_EXP`, `FALLBACK_EXPERIENCIAS`, y las 16 URLs de Unsplash en `experienciaImagen` / `anfitrionFoto`)
- Modify: `src/pages/tierras/perfiles/index.astro` (5 rutas `/images/perfiles/*.jpg` que son 404, y el badge "Imagen de referencia")
- Modify: `src/pages/cafe/visitantes.astro` (el `imagen: null` forzado)
- Modify: `src/pages/granja/bitacora/index.astro` y los 6 `ogImage` que caen en el hero genérico

**Interfaces:**
- Consumes: nada nuevo.
- Produces: todas las funciones de datos devuelven lo que hay en Strapi, o `[]`. Ninguna URL de terceros en `src/lib` salvo las que vengan de un campo `embed` de la BD.

- [ ] **Step 1: Confirmar qué es Unsplash y qué es hotlink muerto**

```bash
cd /home/ubuntu/negocio/data/app_iwage
grep -rn "unsplash" src/ | wc -l
grep -rn "tienda.iwage.co" src/ | wc -l
curl -s -o /dev/null -w 'tienda.iwage.co %{http_code}\n' --max-time 8 https://tienda.iwage.co/
```
Expected: 16 y 5, y el `curl` sin éxito (000/timeout): confirma que los hotlinks están muertos antes de borrarlos. Si respondiera 200, detenerse y preguntar: alguien los está sirviendo.

- [ ] **Step 2: Borrar los bloques de fallback**

En cada archivo, eliminar la constante y **sus usos**, no solo la declaración (TS fallaría por símbolo inexistente, pero el error es menos claro que la lectura). Patrón de reemplazo en `tienda.ts`, donde hoy dice algo como:

```ts
    let items = FALLBACK_PRODUCTOS;
    try { const res = await strapiFetch(...); if (res.data.length) items = res.data.map(normalizeProducto); }
    catch { /* keep fallback */ }
```

debe quedar en:

```ts
    const res = await strapiFetch<ProductRaw>(ENDPOINT, { ... });
    return (res.data ?? []).map(normalizeProducto);
```

Aplicado a las cuatro funciones que hoy referencian `FALLBACK_PRODUCTOS` (localizar con `grep -n "FALLBACK_PRODUCTOS" src/lib/tienda.ts`). Repetir el mismo cambio estructural en `proyectos.ts` y `naturaleza.ts`.

- [ ] **Step 3: Las funciones de imagen dejan de inventarse contenido**

`experienciaImagen` en `naturaleza.ts` tiene hoy una cadena de 5 caídas que termina en Unsplash. Debe quedar:

```ts
export function experienciaImagen(exp: Experiencia): string | null {
  return mediaSrc(exp.imagen_hero ?? exp.imagen_hero_url) ?? toMediaList(exp.galeria)[0]?.url ?? null;
}
```

y el mismo criterio para `anfitrionFoto`: `mediaSrc(host.foto_perfil ?? host.foto_perfil_url) ?? null`, sin Unsplash. Los llamadores deben aceptar `null` y pintar el mosaico Icon que ya existe (patrones en `ProductCard.astro`, `BitacoraCard.astro`) en lugar de `<img src="">`. Cambiar el tipo de retorno de `string` a `string | null` en la firma **es** el mecanismo que fuerza a actualizar todos los llamadores: no se admite un `?? ''`.

```bash
grep -rn "experienciaImagen\|anfitrionFoto\|experienciaGaleria" src/ | grep -v "naturaleza.ts"
```

- [ ] **Step 4: Rutas muertas y badges**

- `tierras/perfiles/index.astro`: borrar los 5 valores `/images/perfiles/*.jpg` de `PERFILES_EXTENDED` (dejar `imagen: null`) y quitar el badge "Imagen de referencia" que hoy se pinta siempre.
- `cafe/visitantes.astro`: eliminar el `return FALLBACK[categoria].map(h => ({ ...h, imagen: null }))` para que los 9 registros con `visitante-*.webp` producido vuelvan a tener imagen. **Ojo:** esto es el paso previo del Task 12; aquí se quita el `null` forzado y se apunta al `FALLBACK` con el archivo real mientras Strapi no tenga el dato, y el Task 12 borra el `FALLBACK` cuando `historia-visitante` esté poblado.

- [ ] **Step 5: Verificar que no se perdió ninguna página**

```bash
npm test && npm run build
```
Y en el preview, las rutas afectadas: `/meliponas/tienda`, `/meliponas/proyectos`, `/naturaleza/experiencias`, `/naturaleza/anfitriones`, `/tierras/perfiles`, `/cafe/visitantes`. Esperado: 200 en todas, con mosaico Icon donde no haya dato — **nunca** `<img>` roto, nunca `src=""`.

```bash
curl -s http://127.0.0.1:4331/meliponas/tienda | grep -c 'src=""'
```
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add -u src/lib src/pages
git status --short
git commit -m "refactor(data): Strapi es el único dueño; fuera seeds, Unsplash y hotlinks muertos"
```

**Gate F1 → F2.** `grep -rn "unsplash\|tienda.iwage.co\|FALLBACK_" src/` vacío. Una sola galería en el repo. Un solo tipo de medio. Antes de entrar a F2 hay que haber **rotado la contraseña de admin de Strapi** y haber sacado del repo los cuatro scripts que la contienen en claro: F2 es el primer paso que escribe en la BD.

---

# FASE F2 — Strapi como único dueño del esquema

Prerequisito bloqueante: **contraseña de admin de Strapi rotada** y los cuatro scripts con credenciales en claro (`reimport_products.py`, `strapi/scripts/seed-heroes-pg.mjs`, `sync-experiencias.mjs`, `sync-propiedades.mjs`) retirados del repo y del historial reciente. Sin eso no se escribe en la BD.

Regla de la fase: un cambio de `schema.json` en Strapi v5 se aplica reconstruyendo el contenedor (`docker compose up -d --build iwage_strapi`), y **no migra datos por sí solo**. Cada task de esquema lleva su propio paso de volcado de los valores existentes.

### Task 10: Inventario accionable e importador idempotente

**Files:**
- Create: `strapi/scripts/media-import.mjs`
- Create: `strapi/scripts/lib/media-manifest.mjs` (el mapeo puro, para poder testearlo)
- Test: `tests/media-manifest.test.mjs`

**Interfaces:**
- Consumes: `mediaSrc` para razonar sobre URLs; el sistema de archivos de `public/images/`; la API REST de Strapi con un token de solo lectura/escritura pasado **por variable de entorno**, nunca por argumento de línea ni literal en el archivo.
- Produces: `manifesto({ archivos, registros }): { subir: [...], enlazar: [{ endpoint, documentId, campo, url }] }` pura; y el script que la ejecuta contra Strapi.

- [ ] **Step 1: El teste de la parte pura**

`tests/media-manifest.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifesto } from '../strapi/scripts/lib/media-manifest.mjs';

const tapas = [
  'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  'public/images/bitacora/granja-el-cercado-de-piedra.webp',
];

test('asocia cada tapa de bitácora con su artículo por slug', () => {
  const m = manifesto({
    archivos: tapas,
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-caja-de-angelita', marca: 'meliponas' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'el-cercado-de-piedra', marca: 'granja' },
    ],
  });
  assert.equal(m.enlazar.length, 2);
  assert.deepEqual(m.enlazar[0], {
    endpoint: 'bitacoras', documentId: 'd1', campo: 'imagen',
    archivo: 'public/images/bitacora/meliponas-la-caja-de-angelita.webp',
  });
});

test('un archivo sin registro equivalente no se sube: queda en pendientes', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/meliponas-huerfana.webp'],
    registros: [],
  });
  assert.deepEqual(m.enlazar, []);
  assert.deepEqual(m.pendientes, ['public/images/bitacora/meliponas-huerfana.webp']);
});

test('dos registros que reclaman la misma tapa: gana el slug más largo y el otro queda pendiente', () => {
  const m = manifesto({
    archivos: ['public/images/bitacora/la-miel.webp'],
    registros: [
      { endpoint: 'bitacoras', documentId: 'd1', slug: 'la-miel' },
      { endpoint: 'bitacoras', documentId: 'd2', slug: 'miel' },
    ],
  });
  assert.equal(m.enlazar.length, 1);
  assert.equal(m.enlazar[0].documentId, 'd1');
  assert.deepEqual(m.pendientes, []);
  assert.deepEqual(m.ambiguos, [{ slug: 'miel', documentId: 'd2', motivo: 'la tapa ya está asignada a la-miel' }]);
});
```

Run: `node --test tests/media-manifest.test.mjs` → FAIL (módulo inexistente).

- [ ] **Step 2: Implementar el mapeo puro**

`strapi/scripts/lib/media-manifest.mjs`:

```js
/**
 * Mapeo huérfano → registro. Puro y sin red a propósito: es la parte que
 * decide qué se sube y a quién se le asigna, y eso hay que poder revisarlo
 * antes de tocar la base de datos.
 *
 * Convención de nombre de las tapas producidas: <marca>-<slug>.webp
 */
const PREFIJO_POR_ENDPOINT = {
  bitacoras: 'bitacora',
  'historia-visitantes': 'visitante',
  proveedores: 'proveedor',
  'item-menus': 'cafe-menu',
  proyectos: 'galeria',
};

export function manifesto({ archivos, registros }) {
  const enlazar = [];
  const ambiguos = [];
  const usados = new Set();

  const porSlug = [...registros].sort((a, b) => (b.slug?.length ?? 0) - (a.slug?.length ?? 0));

  for (const reg of porSlug) {
    const dir = PREFIJO_POR_ENDPOINT[reg.endpoint];
    if (!dir || !reg.slug) continue;
    const candidatos = archivos.filter(
      (a) => a.startsWith(`public/images/${dir}/`) &&
        new RegExp(`/${reg.slug}\\.(webp|png|jpg)$`).test(a) &&
        !usados.has(a)
    );
    if (!candidatos.length) continue;
    const exactos = candidatos.filter((c) => c === `public/images/${dir}/${reg.marca ? `${reg.marca}-` : ''}${reg.slug}.webp`);
    const archivo = exactos[0] ?? candidatos[0];
    usados.add(archivo);
    enlazar.push({ endpoint: reg.endpoint, documentId: reg.documentId, campo: reg.campo, archivo });
    for (const descarte of candidatos.filter((c) => c !== archivo)) {
      ambiguos.push({ slug: reg.slug, documentId: reg.documentId, motivo: `descartada por ambigüedad: ${descarte}` });
    }
  }

  const pendientes = archivos.filter((a) => !usados.has(a) && !/\.gitkeep$/.test(a));
  return { enlazar, pendientes, ambiguos };
}
```

- [ ] **Step 3: Correr el teste y ajustar hasta que pase sin aflojar las aserciones**

Run: `node --test tests/media-manifest.test.mjs`
Expected: 3 verdes. Si el regex de ruta resulta frágil, se arregla el regex, no el teste.

- [ ] **Step 4: Escribir el script ejecutable**

`strapi/scripts/media-import.mjs` — con `--dry-run` por defecto y `--apply` explícito. Nunca lee credenciales de un literal:

```js
/**
 * Sube los assets huérfanos a la media library de Strapi y los enlaza.
 * Idempotente por sha256: re-ejecutarlo no duplica.
 *
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs --dry-run
 *   STRAPI_URL=... STRAPI_TOKEN=... node strapi/scripts/media-import.mjs --apply
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { manifesto } from './lib/media-manifest.mjs';

const BASE = process.env.STRAPI_URL;
const TOKEN = process.env.STRAPI_TOKEN;
const APPLY = process.argv.includes('--apply');
if (!BASE || !TOKEN) {
  console.error('Faltan STRAPI_URL o STRAPI_TOKEN en el entorno. Aborto sin tocar nada.');
  process.exit(1);
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const archivos = ['bitacora', 'cafe-menu', 'galeria']
  .flatMap((d) => readdirSync(`public/images/${d}`, { withFileTypes: true })
    .filter((e) => /\.(webp|png|jpe?g)$/.test(e.name))
    .map((e) => `public/images/${d}/${e.name}`));

// 1. Índice de lo que ya está en la media library, para no subir dos veces.
const existentes = await (await fetch(`${BASE}/api/upload/files?pagination[pageSize]=200`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
})).json();
const porNombre = new Map((Array.isArray(existentes) ? existentes : []).map((f) => [f.name, f.url]));

// 2. Registros candidatos (bitácoras, visitantes, proveedores, menú, proyectos).
const consultas = [
  ['bitacoras', 'imagen'], ['historia-visitantes', 'imagen'], ['proveedores', 'foto'],
  ['item-menus', 'imagen'], ['proyecto-meliponarios', 'imagen'],
];
const registros = [];
for (const [endpoint, campo] of consultas) {
  const j = await (await fetch(`${BASE}/api/${endpoint}?pagination[pageSize]=200&fields[0]=slug&fields[1]=marca&fields[2]=titulo`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })).json();
  for (const d of j.data ?? []) registros.push({ endpoint, campo, documentId: d.documentId, slug: d.slug, marca: d.marca });
}

const m = manifesto({ archivos, registros });
console.log(`${m.enlazar.length} enlaces · ${m.pendientes.length} pendientes · ${m.ambiguos.length} ambiguos`);
for (const p of m.pendientes) console.log('  pendiente:', p);
for (const a of m.ambiguos) console.log('  ambiguo:', a.slug, '·', a.motivo);

if (!APPLY) {
  console.log('\ndry-run: no subí nada ni toqué registros. Repetir con --apply.');
  process.exit(0);
}

for (const { endpoint, documentId, campo, archivo } of m.enlazar) {
  const nombre = archivo.split('/').pop();
  let url = porNombre.get(nombre);
  if (!url) {
    const form = new FormData();
    form.append('files', new Blob([readFileSync(archivo)], { type: nombre.endsWith('.png') ? 'image/png' : 'image/webp' }), nombre);
    const sub = await (await fetch(`${BASE}/api/upload`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    url = Array.isArray(sub) ? sub[0]?.url : sub?.data?.[0]?.url;
    if (!url) { console.warn('  sin URL al subir', archivo); continue; }
    porNombre.set(nombre, url);
  }
  await fetch(`${BASE}/api/${endpoint}/${documentId}?fields[0]=${campo}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { [campo]: url } }),
  });
  console.log('  ok', endpoint, documentId, campo, '←', nombre);
}
```

`sha` queda declarada para el Step 5: si el dry-run muestra que Strapi ya tiene un archivo con el mismo nombre pero distinto contenido (re-producción de una tapa), se compara por hash antes de decidir si se reemplaza. Si al llegar ahí no aparece ningún caso, se borra la función: no se deja código sin usar.

**Nota de diseño:** el endpoint `/api/upload` es el de archivos de Strapi; la asignación del media a un registro se hace por **URL** (Strapi la resuelve al subir). Si en la versión instalada el campo media exige `connect` por `id` en lugar de URL, se cambia el `body` del `PUT` a `{ data: { [campo]: { connect: [{ id }] } } }` y se guarda el `id` devuelto en el `Map`. Esa variante se comprueba con un solo registro antes de lanzar el lote.

- [ ] **Step 5: Dry-run contra la BD real y lectura de la salida**

```bash
cd /home/ubuntu/negocio/data/app_iwage/strapi
STRAPI_URL=http://127.0.0.1:1338 STRAPI_TOKEN='<token del admin, del gestor de contraseñas>' \
  node scripts/media-import.mjs --dry-run
```
Expected: las 36 tapas de bitácora enlazadas o declaradas pendientes con motivo. **Ningún pendiente sin explicación** antes de pasar a `--apply`. El token es un secreto: se pega en la terminal, nunca se escribe en un archivo del repo ni en el commit.

- [ ] **Step 6: Commit del mapeo y del script**

```bash
git add strapi/scripts/media-import.mjs strapi/scripts/lib/media-manifest.mjs tests/media-manifest.test.mjs
git commit -m "feat(media): importador idempotente de assets huérfanos con mapeo testeable"
```

### Task 11: Esquema: de cinco representaciones a dos

**Files:**
- Modify: `strapi/src/api/bitacora/content-types/bitacora/schema.json` (`imagen`: string → media)
- Modify: idem en `producto`, `lote-miel`, `experimento`, `cultivo-polinizacion`, `proyecto-meliponario`, `hero-configuracion`, `anfitrion` (`foto_territorio`)
- Modify: `producto`, `lote-miel`, `cultivo-polinizacion`, `proyecto-meliponario`, `anfitrion` (`galeria*`: json → media multiple), `experiencia.galeria_urls`
- Modify: `complemento`, `experiencia`, `anfitrion` (fuera los twins `*_url`)
- Modify: `anfitrion`, `experiencia`, `propiedad` (embeds: `video_url`/`tour_360_url`/`tour_virtual_url`/`link_drone` → `embed_video`/`embed_tour`; fuera `video_thumbnail`, `mapa_imagen_url`)

**Interfaces:**
- Consumes: `MediaItem`, `toMediaList` (el código tolera las dos formas desde el Task 2, así que esquema y plantillas pueden avanzar en cualquier orden).
- Produces: en cada content-type con portada, exactamente un campo editable de portada; en cada uno con conjunto, un `galeria` media multiple que admite video.

- [ ] **Step 1: Respaldo antes de tocar nada**

```bash
cd /home/ubuntu/negocio
docker exec sostenibilidad_db sh -c 'pg_dump -U "$POSTGRES_USER" iwage' > /home/ubuntu/backup/iwage-pre-f2-$(date +%F).sql
ls -la /home/ubuntu/backup/
```
Expected: un `.sql` del tamaño esperable de la BD. Si `/home/ubuntu/backup` no existe, crearlo. **Sin respaldo no se ejecuta este task.**

- [ ] **Step 2: Volcar los valores de los `string` que van a cambiar de tipo**

Un `string` con una ruta no sobrevive a la conversión a media: el campo queda `null`. Por eso el volcado va antes:

```bash
docker exec sostenibilidad_db psql -U "$PGUSER" -d iwage -At -F'|' -c \
  "select id, documentid, slug, imagen from bitacoras where imagen is not null and imagen <> ''" \
  > /tmp/volcado-bitacoras.txt
wc -l /tmp/volcado-bitacoras.txt
```
Repetir por cada campo de los 8 que cambian de tipo. El `/tmp` es transitorio y **no** se versiona (puede contener rutas internas).

- [ ] **Step 3: Cambiar los esquemas, en grupos que se puedan revisar juntos**

Grupo A — portadas `string` → `media`. En `bitacora/schema.json`, sustituir:

```json
    "imagen": { "type": "string" },
```
por:
```json
    "imagen": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
```
(aplicar a `producto.imagen`, `lote-miel.imagen`, `experimento.imagen`, `cultivo-polinizacion.imagen`, `proyecto-meliponario.imagen`, `hero-configuracion.imagen`, `anfitrion.foto_territorio`). Las cuatro claves del bloque son exactamente las que entiende Strapi v5; no agregar `allowedKinds` ni ninguna otra. Dejar `required: false`: no hay material para el 100% de los registros y un `required` bloquearía publicar.

Grupo B — galerías `json` → `media multiple`, en `producto`, `lote-miel`, `cultivo-polinizacion`, `proyecto-meliponario`, `anfitrion`:

```json
    "galeria": {
      "type": "media",
      "multiple": true,
      "required": false,
      "allowedTypes": ["images", "videos"]
    },
```
Renombrar `galeria_fotos` → `galeria` en `anfitrion` y eliminar `experiencia.galeria_urls` (su contenido es la misma lista duplicada; lo que sea externo vive en `embed_video`/`embed_tour`). Unificar el nombre en B **sí** aplica, porque el campo estaba en JSON libre y no hay consumidores que dependan del nombre de columna de una relación media.

Grupo C — embeds con allowlist, en `anfitrion`, `experiencia`, `propiedad`:

```json
    "embed_video": { "type": "string", "required": false, "format": "uri" },
    "embed_tour": { "type": "string", "required": false, "format": "uri" },
```
con `link_drone` fusionado en `embed_tour`, `video_thumbnail` eliminado (el `poster` sale de la galería o del propio video; una miniatura duplicada es otro foco de dispersión) y `mapa_imagen_url` eliminado (cero UI que lo consuma — verificar con `grep -rn "mapa_imagen_url" src/`).

La validación de **dominio** no puede expresarse en `schema.json`: se hace en el modelo. Añadir a cada content-type con embed un archivo `src/api/<ct>/content-types/<ct>/lifecycles.ts`... no: Strapi v5 no valida dominios con lifecycle sin escribir el `beforeSave` a mano, y eso es código de CMS que duplica la regla. La decisión es más simple y vive en un solo sitio: **`classify()` de `src/lib/media.ts` ya etiqueta el `provider`, y `MediaGallery` solo abre un `<iframe>` si `provider ∈ {youtube, vimeo, drive}` o `kind === 'tour360'`.** Un valor arbitrario en `embed_video` queda como un tile roto, no como HTML inyectado. Se anota en el Step 6 como límite aceptado del diseño.

- [ ] **Step 4: Reconstruir y validar el esquema**

Con autorización (recrea el contenedor):
```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_strapi
sleep 45
docker logs --tail 40 iwage_strapi 2>&1 | grep -iE "error|schema" || echo "sin errores de esquema"
curl -s -o /dev/null -w '%{http_code}\n' -g 'http://127.0.0.1:1338/api/bitacoras?pagination[pageSize]=1'
```
Expected: `sin errores de esquema` y `200` o `403` (403 = endpoint existe pero pide token: el esquema cargó).

- [ ] **Step 5: Re-enlazar lo volcado**

Con el `--apply` del Task 10 sobre los campos ya convertidos. Y verificar en la BD:

```bash
docker exec sostenibilidad_db psql -U "$PGUSER" -d iwage -Atc \
  "select (select count(*) from bitacoras b where exists (select 1 from files_links fl join files f on f.id=fl.file_id where fl.parent_id=b.id and fl.parent_table='bitacoras')) as con_imagen, count(*) from bitacoras"
```
Expected: `36|56` o más, no `0|56`.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/negocio/data/app_iwage
git add strapi/src/api
git commit -m "refactor(strapi): un campo media por portada, galerías media multiple, embeds uri"
```

### Task 12: Las plantillas de ficha leen media, no string

**Files:**
- Modify: `src/lib/bitacora.ts`, `src/pages/meliponas/bitacora/[slug].astro`, `src/pages/granja/bitacora/[slug].astro` y el resto de bitácoras de marca
- Modify: `src/lib/tienda.ts` (`normalizeProducto`), `src/pages/meliponas/tienda/[slug].astro`, `src/pages/granja/tienda/[slug].astro`
- Modify: `src/lib/{proyectos,polinizacion,naturaleza,tierras,gestion,cafe}.ts` y sus fichas
- Test: extensión de `tests/media.test.mjs` o `tests/normalize-media.test.mjs`

**Interfaces:**
- Consumes: `toMediaList`, `mediaSrc` (Task 2); los campos ya `media` (Task 11).
- Produces: en las interfaces de dominio, `imagen: MediaItem | null` y `galeria: MediaItem[]`. Las plantillas pintan `item.url` y `item.alt`.

- [ ] **Step 1: Teste de normalización que falla**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarParaPlantilla } from '../src/lib/normalizar-medio.ts';

test('un media object de Strapi llega como MediaItem con alt', () => {
  const r = normalizarParaPlantilla({
    imagen: { id: 7, url: '/uploads/bitacora/la-caja.webp', mime: 'image/webp', alternativeText: 'Caja de Angelita' },
    galeria: [{ url: '/uploads/galeria/a.webp', mime: 'image/webp' }, { url: '/uploads/galeria/a.webp', mime: 'image/webp' }],
  });
  assert.equal(r.imagen.url, '/uploads/bitacora/la-caja.webp');
  assert.equal(r.imagen.alt, 'Caja de Angelita');
  assert.equal(r.galeria.length, 1);
});

test('un string suelto (BD vieja) sigue funcionando', () => {
  const r = normalizarParaPlantilla({ imagen: '/uploads/x.webp', galeria: ['/uploads/y.webp'] });
  assert.equal(r.imagen.url, '/uploads/x.webp');
  assert.equal(r.galeria[0].url, '/uploads/y.webp');
});

test('null en ambos: la plantilla recibe null y [], no undefined', () => {
  const r = normalizarParaPlantilla({ imagen: null, galeria: null });
  assert.equal(r.imagen, null);
  assert.deepEqual(r.galeria, []);
});
```

`src/lib/normalizar-medio.ts` es un adaptador de 6 líneas, y existe para que las 12 funciones `normalize*` de `src/lib` lo llamen en lugar de abrir el objeto media cada una:

```ts
import { mediaSrc, toMediaItem, toMediaList, type MediaItem } from './media';

export function normalizarParaPlantilla<T extends { imagen?: unknown; galeria?: unknown }>(raw: T): {
  imagen: MediaItem | null;
  galeria: MediaItem[];
} {
  return {
    imagen: toMediaItem({ ...(typeof raw.imagen === 'object' && raw.imagen ? raw.imagen : {}), url: mediaSrc(raw.imagen) ?? undefined }),
    galeria: toMediaList(raw.galeria),
  };
}
```

- [ ] **Step 2: Aplicar el adaptador en las funciones `normalize*`**

En cada `src/lib/*.ts` con una `normalizeX`, usarlo para los campos de portada y galería, y ajustar la interfaz del dominio a `imagen: MediaItem | null`. Localizar los puntos:

```bash
grep -rn "function normalize" src/lib/ | cat
```

- [ ] **Step 3: Plantillas**

Donde hoy hay `<img src={producto.imagen}>`, pasar a `<img src={producto.imagen.url} alt={producto.imagen.alt ?? producto.nombre}>` con el guard `{producto.imagen && (...)}`. Donde se pasaba `producto.galeria` a la galería, ya es `MediaItem[]` y `MediaGallery` lo acepta directo. Para bitácora, la tapa vuelve a existir: es el bloque que hace 30 líneas de las tarjetas de `BitacoraCard.astro`.

```bash
grep -rn "imagen" src/pages/*/*/*/[slug].astro | grep -v "imagen_hero" | head -30
```

- [ ] **Step 4: Poblar desde el importador y verificar visualmente**

`--apply` del Task 10 para visitantes, proveedores, menú de café y proyectos. Abrir en el navegador, no en el HTML: `/meliponas/bitacora`, `/cafe/menu`, `/cafe/visitantes`, `/granja/experimentos`, `/meliponas/proyectos`. Comprobar portada, galería y que ninguna tarjeta cae al mosaico Icon por un dato que sí existe en el admin.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/pages tests/
git commit -m "refactor(media): fichas y listados consumen MediaItem normalizado"
```

### Task 13: Café sin reglas por nombre

**Files:**
- Modify: `src/lib/cafe.ts` (`LOCAL_IMAGES` ~232-243, `itemImage` ~245-268, `proveedorFoto` ~273-275, `proveedorIcono` ~281-291)
- Modify: `src/pages/cafe/menu.astro`, `src/pages/cafe/visitantes.astro`, `src/pages/cafe/nosotros.astro` y quien consuma esas dos funciones

**Interfaces:**
- Consumes: `item-menu.imagen` y `proveedor.foto` ya poblados por Strapi (condición de este task: si el admin no tiene las imágenes, no se borra la regla).
- Produces: `cafe.ts` sin tablas de imagen hardcoded. `proveedorIcono` se queda: es un icono, no un medio, y su lugar es `Icon`.

- [ ] **Step 1: Confirmar que Strapi ya tiene lo que las reglas inventaban**

```bash
curl -s -g 'http://127.0.0.1:1338/api/item-menus?populate[imagen][populate]=*' -H "Authorization: Bearer $TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const sin=(j.data||[]).filter(x=>!x.imagen?.url);console.log((j.data||[]).length,"items,",sin.length,"sin imagen");sin.slice(0,12).forEach(x=>console.log("  -",x.slug??x.nombre))})'
```
Expected: 0 sin imagen. Si hay N, volver al Task 10 con ese subconjunto antes de borrar la regla; **no** se deja `itemImage` "por si acaso".

- [ ] **Step 2: Borrar `LOCAL_IMAGES`, `itemImage` y su import en las plantillas**

Sustituir cada uso de `itemImage(item)` por `item.imagen?.url ?? null` (con el adaptador del Task 12, `item.imagen` ya es `MediaItem | null`, así que `item.imagen?.url`).

- [ ] **Step 3: Lo mismo con `proveedorFoto`**

`grep -rn "proveedorFoto" src/` → sustituir por `p.foto?.url ?? null`. `proveedorIcono` se conserva sin cambios.

- [ ] **Step 4: Verificar el menú en el navegador**

`/cafe/menu`: las 19 preparaciones con su imagen, los 4 proveedores con su foto. Esta es la regresión más probable de todo el plan: si una sola imagen del menú desaparece, se restaura el dato desde Strapi, no la regla de código.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cafe.ts src/pages/cafe
git commit -m "refactor(cafe): el menú y sus proveedores salen de Strapi, no de reglas por nombre"
```

**Gate F2 → F3.** Los 41 campos son dos tipos. `36/56` bitácoras con tapa. `0` items de menú sin imagen. La métrica del censo ya debería moverse: se toma una pasada intermedia (Task 15) para no llegar a F3 con la sorpresa de que nada cambió.

---

# FASE F3 — lo que sobra y lo que falta

### Task 14: Borrado de duplicados y slots muertos

**Files:**
- Delete (solo en el servidor): los 19 `public/images/cafe-menu/*.png` con gemelo `.webp`
- Delete: `strapi/scripts/populate-galerias.sql`, `populate-galerias-productos.sql`, `populate-polinizacion.sql` (escriben en la tabla legacy `proyecto_meliponarios` de Flask, no en Strapi)
- Modify: `src/pages/tierras/propiedades/[slug].astro` (el slot `fotos_evidencia` que nunca renderiza, ancla `VAPEvidenceGallery`)

- [ ] **Step 1: Verificar cero referencias antes de borrar, otra vez, ahora**

```bash
cd /home/ubuntu/negocio/data/app_iwage
for p in $(ls public/images/cafe-menu/*.png); do
  base="/${p#public/}"; sinext="${base%.*}"
  n=$(grep -rl -- "$base" src/ strapi/ 2>/dev/null | wc -l)
  m=$(grep -rl -- "$sinext." src/ strapi/ 2>/dev/null | wc -l)
  printf '%s refs=%s base=%s\n' "$p" "$n" "$m"
done
```
Expected: `refs=0` y `base=0` en los 19. Si alguno da distinto, ese archivo **no** se borra y se reporta.

- [ ] **Step 2: Borrar en una copia, no en vivo**

```bash
mkdir -p /home/ubuntu/backup/png-cafe-menu-$(date +%F)
mv public/images/cafe-menu/*.png /home/ubuntu/backup/png-cafe-menu-$(date +%F)/
npm run build && grep -rl "cafe-menu" dist/ | head
```
Expected: build sin errores y ninguna referencia rota en `dist/`. Se deja en `backup`, no se hace `rm -rf`: 28.2 MB no valen una irreversibilidad.

- [ ] **Step 3: Retirar los tres `populate-*.sql` legacy**

```bash
grep -n "proyecto_meliponarios\|meliponarios" strapi/scripts/populate-*.sql
git rm strapi/scripts/populate-galerias.sql strapi/scripts/populate-galerias-productos.sql strapi/scripts/populate-polinizacion.sql
```
Expected: el `grep` confirma que escriben en la tabla Flask. Si alguna sentencia apunta a una tabla `strapi` (`bitacoras`, `productos`), **no** se borra ese archivo y se reporta: sería el último cable vivo de un seed.

- [ ] **Step 4: Quitar el slot muerto de la propiedad**

`fotos_evidencia` no existe en `Propiedad` ni en el esquema: el bloque de `VAPEvidenceGallery` es código inalcanzable. Borrar el bloque y su import. Verificar que `VAPEvidenceGallery` no tenga otro uso:

```bash
grep -rn "VAPEvidenceGallery\|fotos_evidencia" src/
```
Si `VAPEvidenceGallery.astro` queda sin consumidores, se borra el componente también (con `git rm`).

- [ ] **Step 5: Commit**

```bash
git add -A strapi/scripts src/pages/tierras src/components
git status --short
git commit -m "chore(media): fuera duplicados png, seeds legacy de Flask y slots inalcanzables"
```

### Task 15: Audiovisual, con los pies en la tierra

**Files:**
- Modify: `src/pages/meliponas/index.astro` (la banda comentada de `<video>`, ancla `meliponario-immersive`)
- Modify: `public/videos/` (no existe) o el bloque que lo referencia

- [ ] **Step 1: Decisión explícita con el dueño, no por defecto**

La banda promete "sonido, vuelo y territorio" con un `<video>` comentado que apunta a `/videos/meliponario.webm`, un directorio que no existe. Dos salidas y **solo dos**: (a) hay material grabado en algún disco y lo subimos a Strapi con el importador del Task 10; (b) no lo hay, y se borra el bloque comentado y se reescribe el copy de la línea 148 para que no ofrezca audio. Preguntar y registrar la respuesta en el commit.

- [ ] **Step 2: Ejecutar la salida elegida**

Si (a): subir a `/app/public/uploads` con `media-import.mjs`, asignar a `experiencia.embed_video` o a la `galeria` de `proyecto-meliponario` (que desde Task 11 admite video), y descomentar el bloque adaptado a `MediaGallery` con `kind: 'video'`.
Si (b): `git rm` del bloque comentado + cambio de copy, con el mismo nivel de escrutinio que un cambio de código:

```bash
grep -n "sonido" src/pages/meliponas/index.astro
```

- [ ] **Step 3: Revisar los enlaces a material ajeno**

```bash
docker exec sostenibilidad_db psql -U "$PGUSER" -d iwage -At -F'|' -c \
  "select 'anfitriones', slug, video_url from anfitrions where video_url is not null and video_url<>''
   union all select 'experiencias', slug, video_url from experiencias where video_url is not null and video_url<>''
   union all select 'propiedades', slug, video_url from propiedads where video_url is not null and video_url<>''"
```
(Adaptar nombres de tabla/columna al estado real posterior al Task 11: `select table_name from information_schema.tables where table_schema='public' and table_name ilike '%anfitr%'`.)
Por cada fila: es material propio → se sube y se pasa a `galeria`; es de terceros y legitimo → va a `embed_video`; es un video ajeno sin relación con Iwagé → se pone a `null`. Reportar la lista en el commit.

- [ ] **Step 4: Verificar**

`npm test && npm run build`, y en el navegador la página de meliponas con y sin bloque.

- [ ] **Step 5: Commit**

```bash
git add src/pages/meliponas/index.astro
git commit -m "fix(meliponas): la banda audiovisual o existe o no se promete"
```

### Task 16: Medir, que es como se sabe si funcionó

**Files:**
- Create: `docs/superpowers/metrics/2026-09-XX-inventario-medios-post.md` (fecha del día de ejecución)

- [ ] **Step 1: Repetir el censo con el mismo procedimiento**

Re-crawlear las URLs del sitemap y contar, con el mismo parser que produjo el censo "antes" (no con uno nuevo: si el parser cambia, la comparación no vale):

```bash
curl -s https://iwage.co/sitemap.xml | grep -o 'https://iwage.co/[^<]*' | sort -u > /tmp/post-urls.txt
wc -l /tmp/post-urls.txt
```
Expected: ~185 (puede haber crecido; anotar el número exacto, porque los porcentajes se recalculan con él).

- [ ] **Step 2: Llenar la tabla comparativa**

| | antes | después |
|---|---|---|
| Páginas sin ningún `<img>` en `<main>` | 141 | |
| Páginas con ≥1 imagen propia | 4 | |
| Registros publicados con imagen propia | 1 / 103 | |
| Activos en la media library | 0 | |
| 404 de producción por imagen | 5 | |
| Representaciones de "imagen" en el esquema | 5 | |
| URLs de terceros en `src/lib` | 21 | |

- [ ] **Step 3: Escribir el informe con las diferencias no explicadas**

Cada objetivo incumplido lleva una línea de por qué. Ningún número del informe se copia de la spec: todos salen de la medición de este task.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/metrics/
git commit -m "docs(media): censo post-consolidación"
```

## Registro de cambios de infraestructura

No versionados en el repo (viven en `/home/ubuntu/negocio/docker-compose.yml`):

| Fecha | Cambio | Reversible con |
|---|---|---|
| _completar en Task 1_ | `iwage_strapi` gana `iwage_strapi_uploads:/app/public/uploads` | `docker compose down iwage_strapi` + quitar el bloque `volumes:` |
| _completar en Task 1_ | Respaldo `docker run ... tar czf /home/ubuntu/backup/iwage-uploads-*.tar.gz` añadido a la rutina | n/a |
| _completar en Task 11_ | Respaldo previo `iwage-pre-f2-*.sql` | restaurar el dump |
| _completar en Task 11_ | Reconstrucción del contenedor con los esquemas nuevos | checkout de `strapi/src/api` + rebuild |
| _completar en Task 14_ | 19 png movidos a `/home/ubuntu/backup/png-cafe-menu-*` | moverlos de vuelta |

## Self-review de este plan

- **Cobertura de la spec:** F0 → Tasks 1-6 · contrato y dedupe → Task 2 · OG absoluta → Task 4 · `try/catch` de heroes → Task 5 · un solo componente → Task 8 · las 4 copias del tipo → Task 7 · caída de fallbacks → Task 9 (y Task 13 para el caso del café, que por orden de dependencia va en F2) · esquema de los 41 campos → Task 11 · importación y enlace de huérfanos → Task 10 · fichas leyendo media → Task 12 · duplicados y slots muertos → Task 14 · audiovisual → Task 15 · métrica antes/después → Task 16. Sin huecos.
- **Lo que la spec pide y este plan deliberadamente no hace:** no impone un nombre universal de campo de portada en Strapi (`imagen_principal` vs `foto` vs `imagen` conviven). La spec lo decide así en "Nomenclatura"; el plan lo respeta y lo documenta en Task 11.
- **Deuda conocida declarada:** la allowlist de dominios de los `embed_*` no se valida en el CMS sino en `classify()` + `isEmbed()` (Task 11 Step 3). Un valor basura en la BD produce un tile vacío, no HTML inyectado. Si se quiere validación dura, es un `lifecycle` en Strapi y entra como trabajo aparte.
- **Consistencia de tipos:** `MediaItem { url, kind, alt?, caption?, provider? }` se usa con esos mismos nombres en Tasks 2, 3, 7, 8, 10, 12 y 13. El campo viejo `tipo`/`titulo` solo aparece como entrada aceptada por `toMediaItem`, nunca como salida.
- **Bloqueos reales, no burocráticos:** Task 1 Step 2 (recrear el contenedor), Task 5 Step 4 (detener Strapi), Task 11 Step 1 (dump de la BD), Task 15 Step 1 (decisión de producto sobre la banda de video). Cuatro puntos donde hay que hablar con el dueño.
