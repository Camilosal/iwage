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

El hallazgo que gobierna esta fase: `strapiImage()` (`src/lib/strapi.ts:222-227`) antepone `STRAPI_URL`, que en Docker es `http://iwage_strapi:1337`, un host que el navegador no resuelve. Y `iwage_strapi` no tenía ningún volumen montado (`docker inspect iwage_strapi --format '{{json .Mounts}}'` → `[]`), así que lo que se subía al admin se perdía en el siguiente rebuild. Ninguna otra fase tiene sentido antes de cerrar estas dos. **(Cerradas las dos: la primera por el Task 2, la segunda por el Task 1, ejecutado el 2026-09-25; hoy `Mounts` devuelve el volumen `negocio_iwage_strapi_uploads`.)**

### Task 1: Volumen durable para los uploads de Strapi

**EJECUTADO el 2026-09-25 16:33 UTC** por autorización explícita del dueño («abre el gate G1»). El
registro completo, con las mediciones, está en `docs/superpowers/runbooks/2026-09-25-gates-de-medios.md`,
sección G1. Resumen y dos verdades incómodas:

- El `docker compose up -d iwage_strapi` que este task daba por inocuo **no lo era**: el tag
  `negocio-iwage_strapi:latest` apuntaba a un build del 24-sep distinto de la imagen que corría, y la
  imagen del contenedor vivo ya estaba **borrada del store**. Se despejó por medida (md5 del árbol de
  esquemas y de `/app/src`+`/app/config` idénticos entre las dos, y ambas iguales a `ffb0a9c^`, no a
  HEAD) antes de reiniciar: recrear no subía código nuevo ni migraba esquema.
- Step 4, **desviación deliberada y mejor**: en vez del segundo `--force-recreate` (que habría abierto
  otra ventana de caída del CMS) se probó la durabilidad leyendo el archivo **desde el volumen montado
  en otro contenedor**. Es la misma garantía que pide el plan —el dato vive fuera de la capa del
  contenedor— sin pagar dos reinicios. La sonda se retiró y el volumen quedó en 4.0K.
- Step 5 **sí se hizo como estaba**: `https://iwage.co/uploads/g1-probe.txt` → 200 con contenido, y 404
  al borrar la sonda. Cierra la premisa de `mediaSrc` relativo sobre producción, con nginx de por medio.
- Step 6: el comando de respaldo está **documentado** (abajo y en el runbook), pero **no** lo añadí a la
  rutina de backups de `/home/ubuntu/negocio/`: tocar esa rutina es otra decisión del dueño y alcanza a
  otros proyectos. El respaldo de hoy es a mano: un tar de 137 B y, por si acaso, un `pg_dump` de 2,5 MB
  tomado antes de detener el CMS.

**Files:**
- Modify: `/home/ubuntu/negocio/docker-compose.yml` (bloque `iwage_strapi:`, línea ~1104-1141, fuera del repo)
- Modify: `/home/ubuntu/negocio/data/app_iwage/docs/superpowers/plans/2026-09-24-media-strapi-consolidation.md` (este archivo, sección "Registro de cambios de infraestructura")

**Interfaces:**
- Consumes: nada.
- Produces: `/app/public/uploads` persistente entre recreaciones del contenedor. El contrato de URL que firma este task — `/uploads/<archivo>` servido por nginx del sitio— lo consumen `mediaSrc` (Task 2) y el importador (Task 10).

- [x] **Step 1: Verificar el estado actual (evidencia antes y después)**

Run:
```bash
docker inspect iwage_strapi --format '{{json .Mounts}}'
docker exec iwage_strapi sh -c 'ls -la /app/public/uploads | head'
```
Expected: `[]` en mounts, y en el directorio solo `.gitkeep`. Si ya hay archivos, **detenerse**: hay material que todavía no se perdió y hay que copiarlo al volumen antes de montarlo (`docker cp iwage_strapi:/app/public/uploads ./uploads-salvamento`).

- [x] **Step 2: Pedir autorización para editar el compose y recrear el servicio**

Este paso es un bloqueo real: `/home/ubuntu/negocio/docker-compose.yml` es compartido por ~30 servicios y `docker compose up -d iwage_strapi` reinicia el CMS. No se ejecuta sin un "sí" del dueño.

- [x] **Step 3: Añadir el volumen nombrado**

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

- [x] **Step 4: Recrear y verificar la persistencia**

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

- [x] **Step 5: Verificar que nginx sirve /uploads desde el sitio**

```bash
docker exec iwage_strapi sh -c 'printf "iwage" > /app/public/uploads/_probe.txt'
curl -s -o /dev/null -w '%{http_code}\n' https://iwage.co/uploads/_probe.txt
docker exec iwage_strapi rm /app/public/uploads/_probe.txt
```
Expected: `200`. Esto es lo que hace viable `mediaSrc` relativo: `/uploads/x` funciona en el navegador sin conocer el host interno. Si da `404`, **no continuar**: la premisa de F0 no se cumple y hay que revisar `nginx.conf:92` (`location ^~ /uploads` → `upstream strapi_backend` → `iwage_strapi:1337`).

- [x] **Step 6: Sumar el respaldo de uploads al ritual existente de backup**

```bash
ls -la /home/ubuntu/negocio/*.sql /home/ubuntu/negocio/backup* 2>/dev/null
docker volume inspect negocio_iwage_strapi_uploads --format '{{.Name}}'
```
Documentar en la sección de infraestructura de este plan el comando de respaldo, en la misma rutina que los dumps de Postgres:
```bash
docker run --rm -v negocio_iwage_strapi_uploads:/from -v /home/ubuntu/backup:/to alpine \
  sh -c 'cd /from && tar czf /to/iwage-uploads-$(date +%F).tar.gz .'
```

- [x] **Step 7: Commit (docs del repo)**

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

**Gate F1 → F2.** `grep -rn "unsplash\|tienda.iwage.co\|FALLBACK_" src/` vacío. Una sola galería en el repo. Un solo tipo de medio. Sobre la credencial: **la parte que dependía de este repo está hecha el 2026-09-27** —los cuatro scripts que la tenían en claro leen solo del entorno y abortan si falta, y `tests/no-credenciales-en-repo.test.mjs` impide que el valor (o cualquier cadena de conexión, Bearer o apikey literal) vuelva a entrar—. Medido ese día, el valor no era una contraseña de admin de Strapi (`up_users` = 0) sino la del rol `admin` de PostgreSQL, compartido con otros proyectos del host; **rotarlo es decisión de host y sigue abierto** (runbook § G0), y no traba escribir en la BD por API, que es lo que hace F2.

---

# FASE F2 — Strapi como único dueño del esquema

Prerequisito bloqueante: los cuatro scripts con credenciales en claro (`reimport_products.py`,
`strapi/scripts/seed-heroes-pg.mjs`, `sync-experiencias.mjs`, `sync-propiedades.mjs`) **retirados del repo
el 2026-09-27** (leen solo del entorno y abortan si falta; `tests/no-credenciales-en-repo.test.mjs` lo
impide). **Corrección de lo que decía este renglón:** la credencial publicada no era una contraseña de
admin de Strapi —medido: `up_users` está en **0**, el panel no tiene ni un usuario, y el login del script
devuelve 400—, sino la del rol `admin` de **PostgreSQL**, que es superuser de un clúster compartido por
~15 contenedores de otros proyectos. Por eso la rotación de ese valor **no** se ejecutó acá: es una
decisión del host, no de este plan (runbook G0, con el impacto medido). Lo que sí se cerró: `iwage` ya
tiene rol propio no-superuser (`iwage_app`, smoke de DDL y de lectura verificados) y la conmutación queda
escrita para G8. Sobre el historial: el valor fue público y sigue siéndolo; `git rm` no lo borra, y
reescribir la historia no es el fix (runbook G0, párrafo final).

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

> **Cerrado el 2026-09-25 con la puerta G2 ejecutada** (receta y mediciones en
> `docs/superpowers/runbooks/2026-09-25-gates-de-medios.md`, sección G2). Lo que dejó: 11 columnas fuera
> del esquema **borradas de la base** — 10 vacías y `anfitriones.galeria_fotos` con 2 filas Unsplash que
> la decisión F1 ya mandaba quitar — y **0 valores imprevistos perdidos** (censo de medios 55 → 53). El
> `populate` que el código pedía desde `fa240b2` pasó de 4 endpoints en `400` a **0 en 400**, y las 185
> URLs del sitio siguen en 200 con **cero referencias de medio ganadas o perdidas**. Queda abierto el
> Step 5 (re-enlazar lo volcado), que es la puerta G3.


**Files:**
- Modify: `strapi/src/api/bitacora/content-types/bitacora/schema.json` (`imagen`: string → media)
- Modify: idem en `producto`, `lote-miel`, `experimento`, `cultivo-polinizacion`, `proyecto-meliponario` — **6 campos con `bitacora`, los seis medidos vacíos**
- Modify (paso aparte, con gate): `hero-configuracion.imagen`. **No** entra en el grupo anterior: es el único campo de portada con datos (39/39 filas) y sus valores (`/images/hero-*.webp`, 7 archivos) viven en `public/images/` del repo de Astro, no en la librería de Strapi. Convertirlo de tipo los pone a `null` y apaga los 7 hérores del sitio. Primero se suben los 7 archivos y se enlazan (paso H below), después se cambia el tipo.
- Modify: `producto`, `lote-miel`, `cultivo-polinizacion`, `proyecto-meliponario`, `anfitrion` (`galeria*`: json → media multiple)
- Modify: `experiencia.galeria_urls` → media multiple **renombrando a `galeria`** donde hoy `galeria` está vacío. **No borrar `galeria_urls` antes de eso**: medido, `experiencia.galeria` (ya `media multiple`) está VACÍO y `galeria_urls` tiene las 2 únicas galerías del collection. La premisa original ("es la misma lista duplicada") es falsa.
- Modify: `complemento`, `experiencia`, `anfitrion` (fuera los twins `*_url`)
- Modify: `anfitrion`, `experiencia`, `propiedad` (embeds: `video_url`/`tour_360_url`/`tour_virtual_url`/`link_drone` → `embed_video`/`embed_tour`; fuera `video_thumbnail`, `mapa_imagen_url`)

**Interfaces:**
- Consumes: `MediaItem`, `toMediaList` (el código tolera las dos formas desde el Task 2, así que esquema y plantillas pueden avanzar en cualquier orden).
- Produces: en cada content-type con portada, exactamente un campo editable de portada; en cada uno con conjunto, un `galeria` media multiple que admite video.

- [x] **Step 1: Respaldo antes de tocar nada**

```bash
cd /home/ubuntu/negocio
docker exec sostenibilidad_db sh -c 'pg_dump -U "$POSTGRES_USER" iwage' > /home/ubuntu/backup/iwage-pre-f2-$(date +%F).sql
ls -la /home/ubuntu/backup/
```
Expected: un `.sql` del tamaño esperable de la BD. Si `/home/ubuntu/backup` no existe, crearlo. **Sin respaldo no se ejecuta este task.**

- [x] **Step 2: Volcar los valores de los `string` que van a cambiar de tipo**

Un `string` con una ruta no sobrevive a la conversión a media: el campo queda `null`. Por eso el volcado va antes:

```bash
docker exec sostenibilidad_db psql -U admin -d iwage -At -F'|' -c \
  "select id, document_id, slug, imagen from bitacoras where coalesce(imagen,'') <> ''" \
  > /tmp/volcado-bitacoras.txt
wc -l /tmp/volcado-bitacoras.txt
```
Repetir por cada campo de los **7** que cambian de tipo. El `/tmp` es transitorio y **no** se versiona (puede contener rutas internas).

Medido ya (2026-09-25), para que nadie vuelva a adivinar: `bitacoras.imagen` 0/112 · `productos.imagen` 0/28 · `lote_miels.imagen` 0/1 · `experimentos.imagen` 0/20 · `cultivo_polinizacions.imagen` 0/12 · `proyecto_meliponarios.imagen` 0/12 → **el volcado de esos seis es vacío y la conversión no pierde nada**. `anfitriones.foto_territorio` 2/2 con URLs de `images.unsplash.com` → no son material propio: se deciden con el dueño (decisión F1 = sin hotlinks externos), no se convierten en media. La columna real es `document_id`, no `documentid`.

- [x] **Step 3: Cambiar los esquemas, en grupos que se puedan revisar juntos**

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
(aplicar a `producto.imagen`, `lote-miel.imagen`, `experimento.imagen`, `cultivo-polinizacion.imagen`, `proyecto-meliponario.imagen` y `bitacora.imagen`). **`hero-configuracion.imagen` va en el Paso H, y `anfitrion.foto_territorio` no se convierte**: sus 2 valores son hotlinks de Unsplash que la decisión F1 manda retirar, no hospedar. Las cuatro claves del bloque son exactamente las que entiende Strapi v5; no agregar `allowedKinds` ni ninguna otra. Dejar `required: false`: no hay material para el 100% de los registros y un `required` bloquearía publicar.

Grupo B — galerías `json` → `media multiple`, en `producto`, `lote-miel`, `cultivo-polinizacion`, `proyecto-meliponario`, `anfitrion`:

```json
    "galeria": {
      "type": "media",
      "multiple": true,
      "required": false,
      "allowedTypes": ["images", "videos"]
    },
```
Renombrar `galeria_fotos` → `galeria` en `anfitrion`. En `experiencia`, **`galeria_urls` NO es un duplicado**: medido, `experiencia.galeria` (que ya es `media multiple`) está **vacío** y `galeria_urls` contiene las únicas 2 galerías del collection. La orden correcta es: migrar el contenido de `galeria_urls` a la relación `galeria` (paso explícito, con `--apply` o con `connect` por `id`), verificar que la ficha publica las pinta, y **solo entonces** eliminar el campo json. Borrarlo antes borra la única galería de las experiencias.

Lo que hay dentro de `galeria_urls` y de `anfitrion.galeria_fotos` son URLs de `images.unsplash.com` con `tipo`/`titulo`/`caption`: hotlinks externos que la decisión F1 manda retirar. La migración a media multiple no puede ser un copia-y-pega de esas URLs (Strapi no hospeda lo que no sube); exige decidir qué asset propio las reemplaza, o dejar la galería vacía hasta que Task 15 produzca material. **Es una decisión del dueño, no un paso mecánico.**

Grupo C — embeds con allowlist, en `anfitrion`, `experiencia`, `propiedad`:

```json
    "embed_video": { "type": "string", "required": false, "format": "uri" },
    "embed_tour": { "type": "string", "required": false, "format": "uri" },
```
con `link_drone` fusionado en `embed_tour`, `video_thumbnail` eliminado (el `poster` sale de la galería o del propio video; una miniatura duplicada es otro foco de dispersión) y `mapa_imagen_url` eliminado (cero UI que lo consuma — **verificado**: 1 sola aparición en `src/`, la declaración de tipo en `src/lib/naturaleza.ts:41`).

Medido en la BD lo que hay dentro de estos campos, porque cambia el riesgo del grupo: `experiencias.video_url` y `experiencias.link_drone` contienen el mismo `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (placeholder, no contenido del sitio), `experiencias.tour_360_url` es `https://momento360.com/e/u/demo` (demo del proveedor), `mapa_imagen_url` es Unsplash y `video_thumbnail` tiene 1 valor. **Grupo C está jubilando datos de ejemplo, no contenido real**: fusionar o borrar no cuesta nada visible, y por eso puede ir en el mismo commit del esquema. La única pieza que sí necesita material propio es el mapa del café (`cafe-config.mapa_url`, un iframe de Google Maps): queda **fuera** del contrato de media, porque `classify()` no reconoce `maps.google` y normalizarlo a `MediaItem` lo pintaría como tile roto.

La validación de **dominio** no puede expresarse en `schema.json`: se hace en el modelo. Añadir a cada content-type con embed un archivo `src/api/<ct>/content-types/<ct>/lifecycles.ts`... no: Strapi v5 no valida dominios con lifecycle sin escribir el `beforeSave` a mano, y eso es código de CMS que duplica la regla. La decisión es más simple y vive en un solo sitio: **`classify()` de `src/lib/media.ts` ya etiqueta el `provider`, y `MediaGallery` solo abre un `<iframe>` si `provider ∈ {youtube, vimeo, drive}` o `kind === 'tour360'`.** Un valor arbitrario en `embed_video` queda como un tile roto, no como HTML inyectado. Se anota en el Step 6 como límite aceptado del diseño.

- [x] **Step 4: Reconstruir y validar el esquema**

Medido: el contenedor `iwage_strapi` corre `npm run start` con `MOUNTS=[]` y la app en `/app` (el código entra por `COPY . .` del `Dockerfile`, y su línea 14 copia cada `schema.json` de `src/` a `dist/src/`). Consecuencia útil: **los cambios del Step 3 en el árbol están inertes hasta el rebuild**, así que se pueden escribir, commitear y revisar sin tocar el servicio en marcha. Nada de este task afecta a producción hasta que el dueño autorice el rebuild. (Y la misma medida corrige el Step 1 de Task 1: el volumen que hace falta montar es `/app/public/uploads`, no `/opt/app/...`.)

Con autorización (recrea el contenedor):
```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_strapi
sleep 45
docker logs --tail 40 iwage_strapi 2>&1 | grep -iE "error|schema" || echo "sin errores de esquema"
curl -s -o /dev/null -w '%{http_code}\n' -g 'http://127.0.0.1:1338/api/bitacoras?pagination[pageSize]=1'
```
Expected: `sin errores de esquema` y `200` o `403` (403 = endpoint existe pero pide token: el esquema cargó).

- [x] **Step 5: Re-enlazar lo volcado** — respondido y ejecutado el 2026-09-26 (G3)

Con el `--apply` del Task 10 sobre los campos ya convertidos. **Primero, la sonda obligatoria de UN registro** (no se lanza el lote sin su respuesta): `bitacoras` tiene 112 filas para 56 `document_id` — 56 con `published_at not null` (las que sirve la API) y 56 borradores — y el vínculo de media cuelga de `files_related_mph.related_id`, que es **el `id` de la fila**. Hay que comprobar si el `PUT /api/bitacoras/{documentId}` escribe en la fila publicada o solo en el borrador; si es el borrador, el importador necesita el `POST …/publish` detras del mismo guard `--apply`, o un `--apply` "exitoso" no cambia una sola fila de lo que ve un visitante. Anotar la respuesta en el reporte de la tarea.

Nota: `hero_configuracions` tiene **0 borradores** (sus 39 filas entraron por SQL crudo desde `strapi/scripts/seed-heroes-pg.mjs`, salteándose el servicio de documentos). Un `PUT` por `documentId` ahí puede crear la fila borrador que no existe; verificar que no rompe ningún `uid` antes de tocar los hérores.

> **Medido el 2026-09-26, primero con la sonda de un registro y después con el lote.** La pregunta que
> abría este paso se contestó en la base, no en la doc: el `PUT /api/bitacoras/{documentId}` escribe en
> **las dos filas** del documento — `files_related_mph.related_id` 190 (publicada) y 101 (borrador) para el
> mismo `document_id`—, así que **no hace falta ningún `POST …/publish` detrás del `--apply`**, que era el
> riesgo real: 33 enlaces que el visitante nunca vería. El valor que acepta un campo `media` es el **`id`
> numérico** del archivo, y `POST /api/upload` responde 201 **renombrando** el destino
> (`bitacora-inpa-vs-af.webp` → `/uploads/bitacora_inpa_vs_af_2348f58e8c.webp`), lo que confirma que la
> idempotencia solo puede ser por `name`. Lote: **33 enlaces escritos, 0 duplicados**, con 27 bitácoras que
> tienen tapa en su fila publicada y 6/6 proyectos con la serie en el orden declarado; `files` pasó de 0 a
> **37** y `files_related_mph` de 0 a **72** (uno de los 37 archivos quedó sin enlazar a propósito — ver el
> runbook, G3). Lo que no se escribió es decisión de nombre, no mecánica: 9 tapas sin par firme y 3
> `producto-*` en disputa. Esas 9 se resolvieron el 2026-09-27 con D3: 7 enlazadas, 1 reasignación (una tapa
> de G3 estaba en el artículo equivocado) y 2 retiradas —una lámina defectuosa y una cuyo artículo no existe—,
> con lo que `files` pasó de 37 a **44**, los enlaces de 72 a **86** y las bitácoras con tapa de 27 a **34**.
> D4, el mismo día, llenó la portada de los 6 proyectos declarándola en la fila que ya escribía su galería:
> `imagen` sobre `api::proyecto-meliponario` pasó de 0 a **12** filas de enlace (6 documentos × borrador y
> publicado), el total de enlaces de 86 a **98** y `files` siguió en **44** — no se subió ni un archivo, las 6
> portadas son láminas que ya estaban en la librería. Y **D5**, también el 2026-09-27, cerró los 3 `producto-*`
> que eran la única cosa en `revisar`: cada uno quedó declarado en su propia fila como `imagen` de un producto
> (`producto-caja-1` → Caja INPA Nogal Cafetero, `producto-miel-1` → Miel Angelita 120ml, `producto-miel-2` →
> Miel con propóleo 250ml). Cuesta dos cosas que valen la pena escritas: abrir el alcance del token
> (`api::producto.producto.update`, 17 → 18 acciones, con la medición de que el alta en la BD surte en el
> servidor vivo sin reinicio) y arreglar el orden en que un registro cobra sus campos, que hasta acá era
> alfabético y dejaba el `galeria` deducible por encima del `imagen` declarado. Después: `files` **47**
> (subieron los 3 y ninguno dos veces), enlaces **104**, `imagen` sobre `api::producto` **6** filas, y un solo
> archivo sin enlace en toda la librería (`espresso-doble.webp`, que es D6). Y **D6**, el mismo 2026-09-27, cerró
> ese último archivo y cableó el café: las 4 fallas de `espresso-doble` en las corridas anteriores eran el alcance,
> no el plan. Se escribieron 23 filas sobre `cafe-menu/` (15 ítems, 4 proveedores, 4 visitantes), y como la foto de
> una familia es **una** lámina mientras el `slug` es de **variante**, hubo que extender el contrato con `compartida`
> — la misma forma que `portada`: un archivo declarado en varias filas, solo sobre el campo de portada y solo si las
> dos filas lo dicen —. Grant de tres `update` más (18 → **21** acciones, sonda `PUT` con documentId inventado: 403
> → 400, con `lote-miels` — endpoint al que no se le otorgó el permiso — como negativa). Resultado: `files` 47 → **62**, enlaces 104 → **132**, y por
> primera vez **0 fallas** en un `--apply` de este envase. En la API publicada: **16 de los 17** `item_menus` con
> `imagen`, 4/4 `proveedors` con `foto`, 4/9 `historia_visitantes` con `imagen`; las tres variantes de una familia
> devuelven la misma URL de un solo archivo. Lo que **no** cambió es lo que ve un visitante:
> `src/pages/cafe/index.astro:47-50,58-61` y `src/pages/cafe/visitantes.astro:23,30,46,69` siguen pintando literales
> y `LOCAL_IMAGES` sigue debajo — eso es el paso 2 y 3 de G6, o sea **D8**, y el 3 queda bloqueado por huecos de
> contenido (`te-de-guayaba-agria` sin lámina, 5 visitantes sin lámina, `pan-yuca-miel.webp` sin ítem). Los 6 proyectos siguen sin `slug`
> (medido 6/6 también en el endpoint publicado), así que su ficha de detalle es inalcanzable — y D5 midió lo
> mismo en 3 de los 14 productos, dos de ellos justo los que acaban de recibir tapa: es **D11**, contenido y
> URLs, no medios. `hero_configuracions` **no se tocó**: el token de esta corrida no tiene `update`
> en ese endpoint y la puerta de los hérores es G4, así que el aviso de los 0 borradores queda en pie para
> quien la abra.

Verificar en la BD. **La consulta del plan estaba mal**: `files_links` con `parent_id`/`parent_table` no existe en Strapi v5. Tablas medidas: `files`, `files_related_mph(id, file_id, related_id, related_type, field, "order")`, `files_folder_lnk`, `upload_folders`. Y hoy `select count(*) from files` = **0**, o sea la librería está vacía antes de cualquier `--apply`:

```bash
# 1. Cómo escribe v5 el `related_type` en esta instalación (una vez hay un vínculo de prueba)
docker exec sostenibilidad_db psql -U admin -d iwage -Atc \
  "select distinct related_type, field from files_related_mph"

# 2. Entonces contar bitácoras con imagen EN LA FILA PUBLICADA
docker exec sostenibilidad_db psql -U admin -d iwage -Atc \
  "select count(distinct b.document_id) filter (where exists (
      select 1 from files_related_mph r where r.related_id = b.id and r.field = 'imagen'
     ))::text || '|' || count(distinct b.document_id)::text
   from bitacoras b where b.published_at is not null"
```
Expected: `36|56` o más, no `0|56`. Y `count(*) from files` ≥ 36 con `/app/public/uploads` (el volumen del Task 1) conteniendo los archivos — si el volumen no está montado, el `--apply` no corre.

- [ ] **Paso H (gate del dueño): los 7 hérores antes de cambiar su tipo**

`hero_configuracions.imagen` es el único campo de portada con datos: **39/39 filas**, con 7 valores distintos `/images/hero-{cafe,ecosistema,gestion,granja,meliponas,naturaleza,tierras}.webp`. Esos 7 archivos existen, pero en `public/images/` del **repo de Astro** (contados en el inventario del Task 10 dentro del `chrome` de la raíz), no en la librería de Strapi. Por eso el Grupo A no puede tocarlo: cambiar el tipo pone los 39 a `null` y apaga los hérores de las 6 portadas de marca más la home.

Orden forzado, todo detras de una respuesta del dueño:
1. Decidir si el héroe es material de Strapi (decisión F1: Strapi único dueño) o si `/images/hero-*.webp` son parte del *diseño* del sitio y se quedan en el repo. Si se quedan, `hero-configuracion.imagen` **se excluye del contrato de media** y la excepción se anota en la spec — no se elimina el Grupo A entero.
2. Si es de Strapi: montar el volumen de Task 1, subir los 7 `.webp` con el importador, enlazarlos a las 39 filas, verificar la ficha pública.
3. Solo después, cambiar el tipo en `hero-configuracion/content-types/hero-configuracion/schema.json`.

Sin ese paso, el Step 3 deja el sitio con 7 hérores rotos — es el único daño visible que puede causar esta fase.

- [x] **Step 6: Commit**

```bash
cd /home/ubuntu/negocio/data/app_iwage
git add strapi/src/api
git commit -m "refactor(strapi): un campo media por portada, galerías media multiple, embeds uri"
```

### Task 12: Las plantillas de ficha leen media, no string

> **Ejecución en 4 rebanadas revisadas por separado** — 12a bitácora (`bitacora.ts` + sus fichas y tiras), 12b tienda + proyectos + polinización + experimentos de granja, 12c naturaleza + gestión, 12d tierras. Café **no** va aquí: sus reglas por nombre (`LOCAL_IMAGES`, `itemImage`) son el cable que sostiene los 19 `.webp` de `cafe-menu` y las retira el Task 13, que es el task cuyo contrato es ese. Motivo medido: en este repo **no hay compilador de TypeScript** (`node_modules/typescript` no existe; `astro build` solo borra tipos), así que un `imagen: MediaItem` migrado a medias compila verde y pinta `[object Object]` o degrada en silencio. Cada rebanada debe aterrizar con **todos sus consumidores** del dominio, y con el barrido de texto que lo demuestra. La biblioteca afecta a ~66 archivos: un solo diff de ese tamaño no es revisable.

**Files:**
- Modify: `src/lib/bitacora.ts`, `src/pages/meliponas/bitacora/[slug].astro`, `src/pages/granja/bitacora/[slug].astro` y el resto de bitácoras de marca
- Modify: `src/lib/tienda.ts` (`normalizeProducto`), `src/pages/meliponas/tienda/[slug].astro`, `src/pages/granja/tienda/[slug].astro`
- Modify: `src/lib/{proyectos,polinizacion,naturaleza,tierras,gestion,cafe}.ts` y sus fichas
- Test: extensión de `tests/media.test.mjs` o `tests/normalize-media.test.mjs`

**Interfaces:**
- Consumes: `toMediaList`, `mediaSrc` (Task 2); los campos ya `media` (Task 11).
- Produces: en las interfaces de dominio, `imagen: MediaItem | null` y `galeria: MediaItem[]`. Las plantillas pintan `item.url` y `item.alt`.

- [ ] **Step 0: `populate` en cada lector de un campo convertido (obligatorio, y con teste)**

Medido el 2026-09-25 al revisar 12a: `strapiFetch` **no tiene `populate` por default** — solo lo agrega
si el caller lo pasa (`src/lib/strapi.ts:95-100`) —, así que un campo convertido a `media` por el Task 11
deja de viajar en la respuesta si el lector no lo pide. `src/lib/bitacora.ts` no pasaba `populate` en
ninguna de sus cuatro llamadas (`grep -c populate` = 0) y el resultado con schema `media` es `imagen`
vacío en las 112 filas: **cero tapas, build verde, testes verdes**. El precedente de la casa es
`src/lib/cafe.ts:154` y `:203` (`populate: ['imagen']`).

Regla para las cuatro rebanadas: todo `strapiFetch` cuyas filas alimenten un campo de portada o galería
lleva `populate: ['<campo>']` (y `fields: [...]` no sustituye al populate: `fields` filtra escalares,
la relación es otro parámetro). Y cada rebanada deja un **teste de contrato de fuente** que se pone
rojo si el `populate` desaparece, porque sin ese teste el defecto se vuelve a colar exactamente como
se coló ahora. Verificado con `--dry-run` sobre el sitio real no hace falta: la prueba dura es que una
ficha pintada con datos de Strapi tenga `<img>`; si no la hay, el `populate` no está llegando.


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

**Sigue gate, y ahora por medida (2026-09-25, sobre `72f421e`).** El paso 1 pide confirmar «0 items
sin imagen», y la base local contesta `files = 0` con **17** filas en `item_menus` y 4 en
`proveedors`: no hay un solo asset en el CMS (17, no «las 19 preparaciones» que dice el paso 4: la
tabla tiene 17 filas). Borrar `LOCAL_IMAGES` hoy dejaría el menú sin fotos, así que aplica la
propia condición de este task — «si el admin no tiene las imágenes, no se borra la regla» — y se
destraba con el `--apply` del Task 10, cuyo pre-requisito es el volumen de F0.

**Actualizado el 2026-09-27 con D6 — el paso 1 ya casi se cumple, y los pasos 2 y 3 no.** Medido con el paso 1
sobre la API publicada: **16 de los 17** `item_menus` tienen `imagen`, 4/4 `proveedors` tienen `foto` y 4/9
`historia_visitantes` tienen `imagen`. El único ítem sin foto es `te-de-guayaba-agria`, y no le falta cableado sino
lámina. Consecuencia (corregida el mismo día por D8, ver abajo): se escribió «**no se borra `LOCAL_IMAGES` todavía** — los pasos 2 y 3 quedan bloqueados por contenido, no
por alcance, y es la decisión D8 con su gate propio (leer el dato de Strapi en
`src/pages/cafe/index.astro:47-50,58-61` y `src/pages/cafe/visitantes.astro:23,30,46,69`, que hoy pintan
literales).» El paso 4, verificar en el navegador, sigue sin poder ejecutarse en este tree: `npm run build` está
prohibido y publicar es D10. Nota de herramienta para quien repita el paso 1: con los corchetes literales en la URL
`curl` hace glob y no escribe nada (silencioso), y si los escapas mal Strapi responde **400**. La forma con la que
se midió: `curl -sg … '?status=published&pagination%5BpageSize%5D=20&populate=imagen'` — corchetes codificados y
`populate` simple, porque en v5 el populate de un `media` no necesita el `[populate]=*` anidado que pide este paso.

**EJECUTADO el 2026-09-27 con D8 — y el «bloqueado por contenido» de la nota anterior estaba mal medido.** La sonda
leyó la base como la lee el sitio (`strapiFetch` con su serialización `populate[]=imagen`, sin token): 16 de 17
`item_menus` traían `imagen.url` de Strapi, 4 de 4 `proveedors` traían `foto`, y la regla por nombre disparaba para
**0** filas. El único hueco (`te-de-guayaba-agria`) no lo cubría ninguna de las 12 condiciones, así que se servía
`null` antes y se sirve `null` después: jubilar la tabla no dejaba ningún hueco que antes no estuviera. Lo que sí
sigue bloqueado es la mitad de visitantes, y por **G7** (403), no por contenido: `FALLBACK_HISTORIAS_HOME` y el
`FALLBACK` de `visitantes.astro` se dejaron intactos a propósito. Detalle y dientes, en el runbook, § G6 «Resuelto
con D8».

**Corregido el 2026-09-28 con D9.** La cláusula «bloqueado por G7» está mal: el 403 es del rol Public **sin** token,
y el sitio desplegado (`iwage_web`) define `STRAPI_API_TOKEN`. Medido desde ese contenedor sobre la misma ruta:
**200 con token, 403 sin token**; y el HTML que ya servía `:4321/cafe` traía `/uploads/visitante_*.webp`, no
`/images/cafe-menu/visitante-*.webp`. O sea que las cuatro láminas del relleno estaban muertas en producción, y D8 las dejó
citando un camino que no es el de la producción. D9 las jubiló (`imagen: null` en las 8 filas de
los dos archivos, filas de texto conservadas) y la cota de `tests/cafe-lee-de-strapi.test.mjs` pasó de 6 tallos a 2:
no queda ningún `/images/cafe-menu/*` de historia en `src/`. Lo que sí cierra D9 es el otro camino —el sin token—,
que es el de los previews, el CI y el día que la credencial se rote o venza. Detalle en el runbook, § G7.

**Desvío declarado del paso 2 y del paso 3.** Están escritos como «sustituir cada uso de `itemImage(item)` por
`item.imagen?.url ?? null`» y lo mismo con `proveedorFoto`. Hacerlo literalmente saca del camino `mediaSrc()`, que es
lo único que reduce la URL de Strapi a relativa de sitio y filtra el hotlink de tercero — el contrato de F1. Se
conservaron las dos funciones con un cuerpo de una línea (`return mediaSrc(item.imagen?.url)`), que es lo que ya
hacían `historiaImagen()` y `proveedorFoto()`, y `tests/lectura-medios.test.mjs` las sigue contrando igual.

**Files:**
- Modify: `src/lib/cafe.ts` (`LOCAL_IMAGES` ~232-243, `itemImage` ~245-268, `proveedorFoto` ~273-275, `proveedorIcono` ~281-291)
- Modify: `src/pages/cafe/menu.astro`, `src/pages/cafe/visitantes.astro`, `src/pages/cafe/nosotros.astro` y quien consuma esas dos funciones

**Interfaces:**
- Consumes: `item-menu.imagen` y `proveedor.foto` ya poblados por Strapi (condición de este task: si el admin no tiene las imágenes, no se borra la regla).
- Produces: `cafe.ts` sin tablas de imagen hardcoded. `proveedorIcono` se queda: es un icono, no un medio, y su lugar es `Icon`.

- [x] **Step 1: Confirmar que Strapi ya tiene lo que las reglas inventaban**  *(medido el 2026-09-27: 16/17, 4/4 y 403 en visitantes)*

```bash
curl -s -g 'http://127.0.0.1:1338/api/item-menus?populate[imagen][populate]=*' -H "Authorization: Bearer $TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const sin=(j.data||[]).filter(x=>!x.imagen?.url);console.log((j.data||[]).length,"items,",sin.length,"sin imagen");sin.slice(0,12).forEach(x=>console.log("  -",x.slug??x.nombre))})'
```
Expected: 0 sin imagen. Si hay N, volver al Task 10 con ese subconjunto antes de borrar la regla; **no** se deja `itemImage` "por si acaso".

- [x] **Step 2: Borrar `LOCAL_IMAGES`, `itemImage` y su import en las plantillas**  *(tabla y 12 condiciones fuera; `itemImage` queda como lectura de contrato, ver el desvío arriba)*

Sustituir cada uso de `itemImage(item)` por `item.imagen?.url ?? null` (con el adaptador del Task 12, `item.imagen` ya es `MediaItem | null`, así que `item.imagen?.url`).

- [x] **Step 3: Lo mismo con `proveedorFoto`**  *(la función ya leía de Strapi; lo jubilado acá son los 4 literales `foto:` de `pages/cafe/index.astro` y los 17 `imagen:` de `menu.astro`)*

`grep -rn "proveedorFoto" src/` → sustituir por `p.foto?.url ?? null`. `proveedorIcono` se conserva sin cambios.

- [x] **Step 4: Verificar el menú en el navegador**  *(verificado por HTTP, no en navegador y no en el tree vivo: `npm run build` está prohibido acá, así que se construyó en `/tmp/iwage-d8` y se midió contra `astro preview`. Con Strapi real: 9 tarjetas, 8 imágenes de `/uploads/`, 0 de `/images/cafe-menu/`, todas 200. Con Strapi y Redis caídos: 200 y Icon tile en las 9. Tabla completa en el runbook, § G6 «Resuelto con D8».)*

`/cafe/menu`: las 19 preparaciones con su imagen, los 4 proveedores con su foto. Esta es la regresión más probable de todo el plan: si una sola imagen del menú desaparece, se restaura el dato desde Strapi, no la regla de código.

- [x] **Step 5: Commit**  *(el commit de esta ronda es el paso)*

```bash
git add src/lib/cafe.ts src/pages/cafe
git commit -m "refactor(cafe): el menú y sus proveedores salen de Strapi, no de reglas por nombre"
```

**Gate F2 → F3.** Los 41 campos son dos tipos. `36/56` bitácoras con tapa. `0` items de menú sin imagen. La métrica del censo ya debería moverse: se toma una pasada intermedia (Task 15) para no llegar a F3 con la sorpresa de que nada cambió.

**Advertencia medida el 2026-09-25, antes de tocar el esquema en F3: el rebuild de Strapi es destructivo.** Strapi 5.55.0 **borra la columna** de todo atributo que ya no está en el esquema, y lo hace en cada arranque: `node_modules/@strapi/database/dist/schema/builder.mjs:277-279` recorre `table.columns.removed` y llama `dropColumn`, que solo es no-op con `forceMigration` en falso — y el default es `true` (`@strapi/database/dist/index.js:143`) mientras `strapi/config/database.ts` no fija `settings`. Lo que hoy protege los datos es que el `dist/` del contenedor sigue viejo, no el diseño.

Orden obligatorio, entonces: **dump → `--apply` del importador (que lea los `*_url` y el json como fuente) → y recién después el commit que saca campos del esquema**. Nunca al revés, y nunca "el valor queda huérfano e intacto", que es lo que este plan decía antes de medirlo.

Inventario de lo que está en juego, medido con `SELECT` sobre la BD en vivo:
- **Grupo A+B (ya commiteado en `fa240b2`)**: de las 10 columnas que toca (`bitacoras.imagen`, `productos.imagen/galeria`, `proyecto_meliponarios.imagen/galeria`, `cultivo_polinizacions.imagen/galeria`, `lote_miels.imagen/galeria`, `experimentos.imagen`) hay **0 valores no nulos**; la única con datos es el rename `anfitriones.galeria_fotos` → `galeria`: **2 filas publicadas, 3 hotlinks de Unsplash**, que la decisión F1 mandaba quitar igual. O sea: reconstruir hoy no borra más que eso.
- **Grupo C (aún no commiteado)**: **49 valores vivos** se irían abajo si los campos salen del esquema antes de la migración — `hero_configuracions.imagen` **39** (el Paso H), `anfitriones.foto_perfil_url` **2**, `experiencias.imagen_hero_url` **2** (los twins son contenido, no basura), `experiencias.galeria_urls` **2**, `anfitriones.foto_territorio` **2**, `anfitriones.video_thumbnail` **1**, `experiencias.mapa_imagen_url` **1**; `complementos.imagen_url` **0**.

Consecuencia para el dueño, en una línea: autorizar el rebuild con los esquemas de `fa240b2` es hoy de riesgo casi nulo y es **lo único que vuelve visible el F2 en producción**; autorizarlo con los del Grupo C sin haber corrido el `--apply` sí borra 49 valores.

**Medido el 2026-09-25, y cambia el signo del gate: el rebuild ya no es solo "para ver el F2", es condición de despliegue.** El F2 pide `populate` de los campos que `fa240b2` pasó a `media`, pero el contenedor en vuelo sigue sirviendo el esquema `string` viejo, así que Strapi contesta **400 `Invalid key`** y `strapiFetch` lanza (`src/lib/strapi.ts:146`) -> la superficie se degrada a vacía. Sonda contra la API viva, solo `SELECT`/`GET` (`populate-runtime-probe.mjs` en el directorio SDD):

| endpoint | populate que pide el código | sin populate | con populate |
|---|---|---|---|
| `bitacoras` | `imagen` | 200 | **400 Invalid key imagen** |
| `productos` | `imagen`,`galeria` | 200 | **400 Invalid key galeria** |
| `proyecto-meliponarios` | `imagen`,`galeria` | 200 | **400 Invalid key galeria** |
| `cultivo-polinizaciones` | `imagen`,`galeria` | 200 | **400 Invalid key galeria** |
| `anfitriones` | `foto_perfil`,`galeria`(`,experiencias`) | 200 | **400 Invalid key galeria** (Task 12c) |
| `experiencias` | `imagen_hero` | 200 | 200 |
| `experiencias` | los 7 de `POPULATE_EXP` | 200 | 200 |
| `propiedades-gestion` | los 8 de `POPULATE_FIELDS` | 200 | 200 |
| `paquetes` | `imagen_hero`,`imagenes` | 200 | 200 |
| `item-menus` / `proveedors` | `imagen` / `foto,…` | 200 | 200 (el populate funciona: ya son media en el runtime) |
| `experimentos` / `historia-visitantes` | `imagen,…` | 403 | 403 (sin permiso `find`, no medible desde aquí) |

Nota sobre la medición, porque el hueco era de la herramienta: `populate-sweep.mjs`
reconocía solo literales `populate: [...]`, así que las cinco filas declaradas como
constante (`POPULATE_HOST`, `POPULATE_FIELDS`, `POPULATE_EXP`, `POPULATE_PKG`) no
pasaban por la sonda — y justo una de ellas, la de `anfitriones`, es la que trajo la
12c. Las tres de arriba (`experiencias` completo, `propiedades-gestion`, `paquetes`)
se midieron a mano contra la API viva y sí dan 200.

Traducción operativa: desplegar la rama **antes** del rebuild deja vacías la bitácora (las 7 superficies, con su `noindex` encendido por `fallo: true`), la tienda, los proyectos meliponarios, la polinización y las **fichas de anfitriones** (listado y detalle, por `POPULATE_HOST`/`POPULATE_HOST_DETAIL`). `imagen` en `bitacoras` falla por ser todavía `string`; `galeria` en las otras cuatro falla porque la columna **no existe** en el runtime. El `--apply` del importador no es lo que desbloquea esto: lo desbloquea reconstruir con los esquemas ya commiteados.

---

# FASE F3 — lo que sobra y lo que falta

### Task 14: Borrado de duplicados y slots muertos

**EJECUTADO el 2026-09-25 (pasos 1-4) en `b83051f`.** Hecho: los 19 `.png` movidos a
`/home/ubuntu/backup/png-cafe-menu-2026-09-25/` con `MANIFEST-md5.txt` y `RESTORE.txt`
(verificados 19/19 por hash; son git-ignored, por eso no se borraron); los tres
`populate-*.sql` fuera con su contenido extraído a
`.superpowers/sdd/2026-09-24-media-strapi-consolidation/retirados-populate-sql.md`; el
slot `fotos_evidencia` y `VAPEvidenceGallery.astro` fuera, reemplazados por un gate con
dientes medidos (revivir el archivo o volver a mencionar el campo rompe
`tests/normalizar-medio-4.test.mjs`). Premisa reforzada por medición: los scripts **nunca
corrieron** — no solo `count(galeria)=0` en las tres tablas, sino `slug=''` en las 12 de
`proyecto_meliponarios` aunque el script también escribe slugs.
**Queda pendiente y es del dueño, no mío:** vaciar las celdas de Unsplash y de placeholder
(UPDATE sobre datos + decisión de contenido: es la puerta **G4** del runbook, no un paso del `--apply`
de Task 15; recontadas el 2026-09-27 con `galeria_fotos` ya fuera del esquema → 10 celdas / 15 URLs /
6 columnas y 5 celdas / 6 ocurrencias, worklist con `documentId` en G4), y la jubilación
del Grupo C en el esquema. No se hizo `npm run build` como pedía el paso 2: `dist/` está
compartida con otros agentes y 0 referencias a `*.png` en `src/`, `strapi/`, `public/` y
`tests/` es la evidencia de que mover no puede romper render (Astro copia `public/` tal cual).
**Esa laguna se cerró el 2026-09-25 sin tocar `dist/`**: build aislado del HEAD `0d6593f` en
`/tmp` (Complete! en 11,7 s), preview en puerto propio y crawl de las mismas 185 URLs —
**185/185 responden 200** y ninguna de las nueve filas del censo se mueve (`523a89c`). O sea que
el `mv` de los 19 `.png` y el retiro de `VAPEvidenceGallery` no dejaron referencia rota, que era
lo que el paso 2 buscaba probar.

**Files:**
- Delete (solo en el servidor): los 19 `public/images/cafe-menu/*.png` con gemelo `.webp`
- Delete: `strapi/scripts/populate-galerias.sql`, `populate-galerias-productos.sql`, `populate-polinizacion.sql`. **La premisa del plan original ("escriben en la tabla legacy `proyecto_meliponarios` de Flask, no en Strapi") es FALSA, medida el 2026-09-25:** los tres apuntan a tablas vivas de Strapi v5 (`UPDATE proyecto_meliponarios` 6, `UPDATE productos` 11, `UPDATE cultivo_polinizacions` 6, y las tres existen en la BD con `published_at`). Se retiran por otra razón, que es la buena: escriben JSON crudo en la columna `galeria` por `id` de fila sin API ni publish, que es exactamente el mecanismo de dispersión que este plan elimina.
- Modify: `src/pages/tierras/propiedades/[slug].astro` (el slot `fotos_evidencia` que nunca renderiza, ancla `VAPEvidenceGallery`)
- **Null (en la BD, con dump previo): las celdas con hotlinks de `images.unsplash.com`** — **recontado el 2026-09-27: 10 celdas / 15 URLs / 6 columnas**, no 12/18/7; la diferencia son las 2 celdas y 3 URLs de `anfitriones.galeria_fotos`, columna que G2 ya jubiló del esquema (quedaban 3 URLs en `experiencias.galeria_urls`). El recuento que sigue abajo es el de 2026-09-25 y su `galeria_fotos` 2/3 hoy no existe — medidas el 2026-09-25 en el censo de hosts de `4b1b63e`, repartidas en 7 columnas: `anfitriones.foto_perfil_url` 2/2, `anfitriones.foto_territorio` 2/2, `anfitriones.galeria_fotos` 2/3, `anfitriones.video_thumbnail` 1/1, `experiencias.imagen_hero_url` 2/2, `experiencias.galeria_urls` 2/7, `experiencias.mapa_imagen_url` 1/1 (celdas/URLs). `esPintable()` ya no los pinta, pero el valor sigue ahí y el admin los muestra como si fueran contenido. Dos de ellos son el **retrato de stock de dos anfitriones con nombre y apellido reales** (`don-hernando-caficultor`, `luz-elenia-herbalista`) presentado como su cara: hay que decidir con el dueño si se retira y se deja la ficha sin foto (el mosaico Icon ya está diseñado para eso) o si se reemplaza por foto propia.
- **Los placeholders de embed son 5 celdas con 6 ocurrencias**, no 2 (confirmado el 2026-09-27; cuidado al recuentar: `video_url` existe con el mismo nombre en `anfitriones` **y** en `experiencias` y las dos Traen el rickroll): `experiencias.video_url`, `experiencias.link_drone` y `anfitriones.video_url` (los tres rickroll), `experiencias.tour_360_url` (demo de momento360) y una **quinta dentro del json de `experiencias.galeria_urls`**, que mezcla el video rickroll y el tour demo con las 5 fotos. Esa quinta no se pone a `null`: hay que **reescribir la celda** quitando los dos ítems, porque `galeria_urls` es la única galería que tienen las 2 experiencias publicadas (`experiencias.galeria`, la relación media, está vacía: `files = 0`).

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
Expected: el `grep` confirma que los tres escriben en tablas **de Strapi**, no de Flask. Lo que hay que probar antes de borrar es que **ese contenido nunca llegó a la BD** (medido el 2026-09-25 con la comprobación correcta para `jsonb`, que es `count(galeria)` y no una comparación contra `''`): `productos` 0 de 28, `proyecto_meliponarios` 0 de 12, `cultivo_polinizacions` 0 de 12, `lote_miels` 0 de 1 columnas `galeria` no nulas. Con la columna vacía, el script es un cable muerto y se retira; **si alguna columna tuviera valor, no se borra ese archivo** y se reporta, porque entonces es el único lugar donde vive esa galería.

Y como el `git rm` borra el archivo pero no el dato (queda en el historial), el mensaje del commit y el reporte de la tarea tienen que dejar la receta de recuperación, porque estos tres `.sql` son el **único registro del intento editorial**: galerías por proyecto con sus webp locales (`/images/galeria/proyecto-ambala-1.webp` …) y **el único video real documentado del sitio** (`https://www.youtube.com/watch?v=Vv1b4Vvq0fM`, "Meliponas nativas de Colombia", en `populate-galerias.sql:7`) mezclado con un hotlink de Unsplash. Ese par de URLs es insumo directo del Task 15 (la banda de video de `/meliponas`) y de la decisión del dueño sobre los hotlinks; recuperar el archivo: `git show <commit>^:strapi/scripts/populate-galerias.sql`.

- [ ] **Step 4: Quitar el slot muerto de la propiedad**

`fotos_evidencia` no existe en `Propiedad` ni en el esquema: el bloque de `VAPEvidenceGallery` es código inalcanzable. Borrar el bloque y su import. Verificar que `VAPEvidenceGallery` no tenga otro uso:

```bash
grep -rn "VAPEvidenceGallery\|fotos_evidencia" src/
```
Si `VAPEvidenceGallery.astro` queda sin consumidores, se borra el componente también (con `git rm`).

- [ ] **Step 5: Commit**

```bash
# Contradecía la restricción global del plan (línea 15: nunca `git add -A`). Así se hizo:
git commit -q -F - -- 'src/pages/tierras/propiedades/[slug].astro' \
  tests/normalizar-medio-4.test.mjs \
  src/components/tierras/VAPEvidenceGallery.astro \
  strapi/scripts/populate-galerias.sql \
  strapi/scripts/populate-galerias-productos.sql \
  strapi/scripts/populate-polinizacion.sql
git status --short   # confirma que no se llevó WIP ajeno
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

Medido el 2026-09-25, solo `SELECT`, con la única forma permitida de tocar la BD (nunca
cadenas de conexión ni `"$PGUSER"`; la tabla es `propiedades`, no `propiedads`):

```bash
docker exec -i sostenibilidad_db psql -U admin -d iwage -At -F'|' -c "
select 'anfitriones', slug, video_url from anfitriones where video_url is not null and video_url<>''
union all select 'experiencias', slug, video_url from experiencias where video_url is not null and video_url<>''
union all select 'propiedades', slug, video_url from propiedades where video_url is not null and video_url<>''"
```

Resultado íntegro: **2 filas, y las dos son el mismo video.**

| tabla | slug | video_url |
|---|---|---|
| `anfitriones` | `don-hernando-caficultor` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` |
| `experiencias` | `amanecer-en-el-bosque-de-niebla` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` |

`dQw4w9WgXcQ` es el rickroll. Hay una tercera aparición en el mismo registro, dentro de
`experiencias.galeria_urls` de `amanecer-en-el-bosque-de-niebla`, con título
«Recorrido completo», acompañada de `https://momento360.com/e/u/demo` («Mirador 360°»,
tour de demostración de la plataforma). Las otras cuatro entradas de esa galería eran
Unsplash y el contrato de Task 12b ya no las pinta: **los dos únicos elementos de video
y 360 que hoy se pintarían en el sitio son placeholders.** Lo mismo en la otra
experiencia: `galeria_urls` de `jardin-medicinal-y-saberes-de-montana` son 3 Unsplash,
o sea galería vacía.

Consecuencia para este task: la pregunta al dueño deja de ser «¿aceptamos video
externo?» y pasa a ser «¿hay material grabado propio, o retiramos los tres
placeholders?». El único video real documentado en todo el proyecto no está en la BD:
es `youtube/watch?v=Vv1b4Vvq0fM` («Meliponas nativas de Colombia»), en
`populate-galerias.sql:7`, que el Task 14 retira con `git rm` — recuperable con
`git show <commit>^:strapi/scripts/populate-galerias.sql`.

Por cada fila: es material propio → se sube y se pasa a `galeria`; es de terceros y
legítimo → va a `embed_video`; es un video ajeno sin relación con Iwagé → se pone a
`null`. Reportar la lista en el commit.

- [ ] **Step 4: Verificar**

`npm test && npm run build`, y en el navegador la página de meliponas con y sin bloque.

- [ ] **Step 5: Commit**

```bash
git add src/pages/meliponas/index.astro
git commit -m "fix(meliponas): la banda audiovisual o existe o no se promete"
```

### Task 16: Medir, que es como se sabe si funcionó

**EJECUTADO el 2026-09-25 en `886ca4b`** (informe: `docs/superpowers/metrics/2026-09-25-despues.md`,
nombre pareado con `2026-09-24-antes.md` en vez del `-inventario-medios-post` que proponía
este plan). Como `dist/` está compartido y su build es anterior a F1-F3, las filas de HTML se
midieron con la alternativa honesta que el propio Step 1 prevé: copia del árbol en `/tmp`,
build y preview en puerto propio, crawl de las mismas 185 URLs en otro directorio. **Filas 1,
2 y 9 contra un preview local, no contra el sitio desplegado**, y así está dicho en el informe
junto con el «no medible todavía» del después real.

Resultado: fila 7 en **0** y fila 8 en **0** en código y además **0 en las 185 páginas
servidas** (antes había stock en 12 páginas y 5 referencias rotas); fila 5 en **80** archivos
(los 19 PNG ya no están en el servidor); fila 4 con **11 campos convertidos a `media`**
(`ya media` de 15 a 26) y 8 restantes detrás del rebuild; filas 3 y 6 sin moverse, por razones
distintas y cada una explicada en el informe.

**Dos premisas de este plan corrigió la medición.** La fila extra de embeds placeholder no
eran 2 valores sino **4** (el `anfitriones.video_url` también es un rickroll), y el
`video_thumbnail` con Unsplash es columna de `anfitriones`, no de `experiencias` (igual que
`galeria_fotos`, que nunca estuvo en `bitacoras`). Total de Unsplash: 8, confirmado.

**El censo destapó un bug que el build y los 269 testes no podían ver:** `bitacora.ts` mandaba
`imagen` en `fields[]` y en `populate[]` a la vez, con un comentario que afirmaba que así se
cubrían los dos esquemas. Medido: Strapi rechaza un media en `fields[]` con 400 (`param:
fields`), así que la mezcla degradaba las 7 superficies de bitácora **en los dos esquemas**.
Fix y guard nuevo en `886ca4b`. Lección para el plan: la queryString saliente de `strapiFetch`
no la miraba nadie; ahora la mira `tests/bitacora-query.test.mjs`.

**Queda del dueño:** desplegar el esquema (`fa240b2`) y correr `--apply`; sin eso, las filas 1,
2 y 3 no tienen un «después» que medir, y este plan no debe darse por cerrado.

**Tercera pasada, el 2026-09-25 sobre `b3b3d2c`** (tras la ronda de fixes de una revisión en fresco
del rango `851ff10..HEAD`): se volvió a construir y crawlear aparte, las nueve filas están en la
sección «Tercera re-medición» del informe. Ocho no se mueven; la fila 1 sube de 134 a 136 y la
diferencia está atribuida a dos fichas de anfitrión concretas, no heredada ni supuesta.

**Retiro de huérfanas `.webp` — medido el 2026-09-28 y **BLOQUEADO detrás de un redeploy de `iwage_web`**.**
No se borró ningún archivo; el tree sigue en `214147e` y los testes en verde (369/369). Qué se midió y por
qué no toca borrar todavía:

- **Las 65 huérfanas** (fila 6: 36 `bitacora` + 12 `galeria` + 17 `cafe-menu`). Cruzadas contra la media
  library de Strapi (`/tmp/uploads-list.txt`, 310 archivos): **62 tienen gemelo de mismo `stem` en
  `/uploads` y 3 no** — `bitacora-calendario-manejo.webp`, `bitacora-red-meliponicultores.webp` y
  `cafe-menu/pan-yuca-miel.webp`. Los 3 son la **única copia**; jubilarse es decisión de contenido del
  dueño (enlazarlos a Strapi o aceptar el mosaico Icon), no limpieza de duplicados; además los dos
  testes nombrados abajo los exigen en disco.
- **La laguna del md5 se resolvió por píxeles, no por hash.** Los 62 gemelos difieren en bytes (Strapi los
  recodificó al importar) pero son **la misma imagen**: 57 con aHash 8×8 a distancia 0 y dHash 16×16 a 0,
  y los otros 5 con dHash 16×16 ≤ 4/256, dimensiones idénticas (1200×675 / 1200×805) y ratio de tamaño
  0,89–0,98 — huella de un recodificado con pérdida, no de contenido distinto. O sea: son duplicados
  verdaderos; `/uploads` ya sirve esos mismos píxeles. Manifesto completo (md5 de ambas copias, dims,
  distancia) en `/tmp/task16-manifest.json` (no versionado).
- **Referencias.** El **repo** no las pinta: `src/` tiene 0 referencias vivas a las 62 (la única
  coincidencia es `proyecto-ambala-1.webp` dentro del bloque `{/* … */}` de `meliponas/index.astro:152-166`;
  la regla `LOCAL_IMAGES` ya cayó con D8). Pero el **bundle desplegado** (`/app/dist` de `iwage_web`,
  anterior a D8/G5) **todavía las referencia las 65** — medido con `grep -rhoE '/images/(bitacora|galeria|cafe-menu)/…'`
  sobre el contenedor. Por eso la fila 6 no se mueve sin desplegar antes: el sitio en producción las sirve
  desde su capa de imagen horneada, y el retiro tiene que ocurrir con el bundle que ya no las menciona.
- **El gate está escrito y blindado por testes**, no es burocracia: `tests/cafe-lee-de-strapi.test.mjs`
  afirma `readdirSync(public/images/cafe-menu).filter(webp).length === 19` con el mensaje *«se borran
  después del deploy (D10), no con D8»*, y `tests/media-alias-propuesto.test.mjs` hace `existsSync()` sobre
  cada fuente del envase. Borrar ahora pone rojos esos testes y, con un redeploy prematuro, quitaría
  archivos que el bundle vivo aún emite.
- **Receta para cuando el dueño autorice el redeploy** (`docker compose build iwage_web && up -d`): tras
  verificar que el bundle nuevo emite 0 rutas `/images/{huérfanas}` y las 185 URLs siguen 200,
  `git rm` de las 62 (recuperables por `git show <commit>^:ruta` **y** por copia a
  `/home/ubuntu/backup/huerfanas-f3-<fecha>/` con MANIFEST+RESTORE), y en `cafe-lee-de-strapi` voltear la
  guarda de disco de 19 al conteo post-deploy: de las 17 huérfanas de café se retiran las **16 con gemelo**,
  quedan en disco **3** (las 2 `promo-*` que sí se pintan — la otra guarda, `:104`, ya exige «exactamente
  2» en `src/` y no se toca — más `pan-yuca-miel`, consignada). **Consignar las 3 restantes** (2 `bitacora`
  sin gemelo + `pan-yuca-miel`) como decisión de contenido. Nada de esto se ejecutó acá porque un deploy
  requiere 'sí' explícito del dueño.

**Las 3 consignadas sin gemelo — RETIRADAS el 2026-10-03 por decisión del dueño («Opción A en todas»).**
Revisadas una a una antes de decidir: `bitacora-calendario-manejo` está defectuosa (pseudo-texto ilegible
y meses mal escritos, verificado visualmente) y su asunto ya tiene tapa enlazada — medido en vivo: la
ficha de `modulo-5-c2-b7-manejo` sirve `/uploads/bitacora_modulo5_manejo_*.webp` —; `bitacora-red-
meliponicultores` está sana pero no existe el artículo en la BD (0 filas); `pan-yuca-miel` está sana pero
no hay ítem que la reciba (17 `item_menus`, 0 de pan de yuca) **ni producto publicado que la mencione**
(medido sobre la BD viva; el copy «Pan de yuca y miel» solo vive en `seed-productos.mjs`, nunca llegó a
produción). El gate del redeploy **no las aplica**: son las 3 sin gemelo, y un crawl de las 180 URLs del
sitemap con el bundle desplegado midió **0 páginas pintándolas** (las cadenas solo existen en el JS
inerte), a diferencia de las 62 gemelas que el bundle vivo sí emite. Ejecutado: copia a
`/home/ubuntu/backup/retiro-huerfanas-2026-10-03/` con MANIFEST+RESTORE.sh, `git rm` de las 3, y volteadas
las tres guardas que las exigían en disco — `media-alias-propuesto` (`SIN_PROPUESTA` 5→2, inventario
67→64), `cafe-lee-de-strapi` (19→18) y `censo-huerfanas` (bitácora 36→34, total 48→46). Suite:
**368/369**, el único rojo es `founderPersona`, de los cambios sin commitear de otra sección (entity/
schema-bitacora), ajeno a medios. Lo que sigue esperando el redeploy son las **62 gemelas** (16 de
café, 34 de bitácora, 12 de galería) y las 2 `promo-*` se quedan consignadas como hasta ahora.

**El redeploy se ejecutó el 2026-10-03 (autorización del dueño: «commit, push y redeploy») y con él
cayó la última puerta de este plan.** `git push` de los 6 commits (G8) y `docker compose build
iwage_app && up -d` desde `/home/ubuntu/negocio`. Medición después del bundle nuevo: crawl de las
**180 URLs del sitemap — 0 no-200**, 0 referencias a `/images/{bitacora,galeria,cafe-menu}` en el HTML
servido, y las fichas pintan `/uploads/*` (verificado en bitácora, café y anfitriones). Las 2 `promo-*`
siguen en su sitio. Un hallazgo del conteo: el bundle nuevo **sí** contenía las 62 cadenas, pero no
como código — es el manifiesto de `public/` que Astro hornea en `entry.mjs` (`"assets":[...]`), que
enumera lo que está en disco, no lo que se pinta; el gate honesto era (y fue) el crawl del HTML.
**Retiro de las 62 gemelas ejecutado el mismo día**: respaldo en
`/home/ubuntu/backup/huerfanas-f3-2026-10-03/` (62 archivos + MANIFEST con md5 + RESTORE.sh), `git rm`
de las 62, `.gitkeep` en los baldes vacíos, y volteadas las guardas que las exigían en disco:
`cafe-lee-de-strapi` (18 → exactamente las 2 `promo-*`), `censo-huerfanas` sobre el repo real
(46 → 0; el testigo del bloque comentado de `ambala-1` vivía en el disco y la regresión queda cubierta
por los testes con fixtures de ese mismo arquivo) y `media-alias-propuesto` (los `existsSync` se
invierten a «no-volver-a-traer», y el inventario del manifiesto pasa de ser el disco a ser la propuesta
más `espresso-doble.webp` — el único archivo que la regla firma sin fila y que antes entraba por el
inventario). Suite tras el volteo: **369/369** (el rojo de `founderPersona` se cerró aparte, adaptando
su teste a la forma de dos organizaciones que la otra sección le dio a `worksFor`). Con esto, la fila 6
del censo cierra en **0 huérfanas en `public/images/{bitacora,galeria,cafe-menu}`**: todo el material
audiovisual del sitio vive en el volumen `negocio_iwage_strapi_uploads` servido por `/uploads`, que era
el objetivo con el que se abrió este plan.

**Files:**
- Create: `docs/superpowers/metrics/2026-09-XX-inventario-medios-post.md` (fecha del día de ejecución)

- [ ] **Step 1: Repetir el censo con el mismo procedimiento**

Re-crawlear las URLs del sitemap y contar, con el mismo parser que produjo el censo "antes" (no con uno nuevo: si el parser cambia, la comparación no vale):

```bash
curl -s https://iwage.co/sitemap.xml | grep -o 'https://iwage.co/[^<]*' | sort -u > /tmp/post-urls.txt
wc -l /tmp/post-urls.txt
```
Expected: ~185 (puede haber crecido; anotar el número exacto, porque los porcentajes se recalculan con él).

```bash
mkdir -p /home/ubuntu/backup/iwaudit-despues-<fecha> && cd /home/ubuntu/backup/iwaudit-despues-<fecha>
C=/home/ubuntu/negocio/data/app_iwage/docs/superpowers/metrics/censo
cp "$C"/{crawl.sh,parse.mjs,analyze.py,pages.py} .
cp /tmp/post-urls.txt urls.txt
i=0; while read -r u; do i=$((i+1)); bash crawl.sh "$u" "$i" >> crawl.log; done < urls.txt
bash "$C/censo.sh" . --con-bd
```

`censo.sh` corre las diez filas con los mismos comandos de la línea base, cada uno bajo su etiqueta, y existe justamente para que este paso no vuelva a armar un one-liner distinto. Verificado sobre la copia del "antes": reproduce los 185 hashes, 141 de 185, las 4 páginas exclusivas, `0|0` en la base, 41 campos en 4 representaciones y las 47 huérfanas de la herramienta histórica (36 + 11 + 0); con `huerfanas.mjs`, que quita los bloques `{/* … */}` antes de buscar, la misma foto lee **48** (36 + 12 + 0).

Qué es comparable con qué, porque si no se dice, el informe miente: **las filas 3 a 8 miden el repo y la base de datos**, y esas se mueven con este plan aunque nadie despliegue. **Las filas 1, 2, 9 y 10 miden el HTML servido**, o sea el sitio desplegado: con el gate de despliegue cerrado salen idénticas al "antes" y hay que reportarlas como "no medible todavía", no como "no mejoró". La alternativa honesta es correrlas contra un preview local de este commit en otro directorio de crawl y decir cuál de los dos se reportó.

- [ ] **Step 2: Llenar la tabla comparativa**

La tabla es la de `docs/superpowers/metrics/2026-09-24-antes.md`, que ya tiene el comando y el valor medido de cada fila; el informe "después" se llena con la salida de `censo.sh` del Step 1, que son **esos mismos comandos**, no unos nuevos. Antes de comparar, verificar que el crawl mide el mismo sitio de siempre:

```bash
cd /home/ubuntu/backup/iwaudit-antes-2026-09-24
sha256sum -c /home/ubuntu/negocio/data/app_iwage/docs/superpowers/metrics/censo/inputs-antes/html.sha256 \
  | grep -c ': OK'          # esperado 185; si es menor, alguna página ya no es la que se midió
```

| | antes (medido) | después |
|---|---|---|
| Páginas sin ningún `<img>` en `<main>` | 141 de 185 | |
| Páginas con ≥1 imagen propia exclusiva | 4 | |
| Registros publicados con un medio enlazado en Strapi | 0 de 180 | |
| Campos de medio / representaciones en el esquema | 41 / 5 | |
| Archivos en `public/images` (versionados + solo servidor) | 99 (80 + 19) | |
| Piezas producidas y nunca enlazadas | 47 (36 tapas + 11 galería) | |
| Activos en la media library de Strapi | 0 | |
| Ocurrencias de `strapiImage` en `src/` | 57 | |
| URLs de terceros en `src/` | 20 | |
| 404 de producción por imagen | 5 | |
| `og:image` servida que no aterriza en un archivo | 0 de 161 etiquetas (185 páginas, 7 destinos) | |

Dos filas que la tabla original de la spec no tenía y que el después sí tiene que reportar, porque el plan las mueve: los **12 valores de Unsplash que quedaron en columnas de la BD** (18 URLs dentro; F1 limpió `src/` pero no la base de datos) y los **5 embeds placeholder** (6 ocurrencias: tres celdas rickroll, una de tour demo del proveedor y una quinta celda — el json de `experiencias.galeria_urls` — que dentro repite uno de cada; la cuenta por columna está en el Files de la Task 14 y la consulta de verificación en el gate 3 de `metrics/2026-09-25-despues.md`). "0 URLs de terceros" en el código sin decir nada de la BD es un verde que engaña.

- [ ] **Step 3: Escribir el informe con las diferencias no explicadas**

Cada objetivo incumplido lleva una línea de por qué. Ningún número del informe se copia de la spec: todos salen de la medición de este task.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/metrics/
git commit -m "docs(media): censo post-consolidación"
```

## Registro de cambios de infraestructura

Todo lo de esta sección vive fuera del repo: los dos primeros cambios en `/home/ubuntu/negocio/docker-compose.yml`, y los respaldos bajo `/home/ubuntu/backup/`.

| Fecha | Cambio | Reversible con |
|---|---|---|
| 2026-09-25 | `iwage_strapi` gana el volumen `negocio_iwage_strapi_uploads:/app/public/uploads` (`docker-compose.yml` +4 líneas) | `cp docker-compose.yml.bak-g1-2026-09-25-1630 docker-compose.yml && docker compose up -d iwage_strapi`; el volumen sobra inofensivo |
| _pendiente de 'sí' del dueño_ | Respaldo `docker run ... tar czf /home/ubuntu/backup/iwage-uploads-*.tar.gz` añadido a la rutina | n/a (hoy se respaldó a mano: `iwage-uploads-2026-09-25.tar.gz`, 137 B) |
| 2026-09-25 | Dump previo `iwage-pre-f2-2026-09-25.sql` | restaurar el dump |
| 2026-09-25 **ejecutada (G2)** | Reconstrucción del contenedor con los esquemas nuevos (`fa240b2`): imagen `c5d3fc49` en `latest`, arrancando con **drop de 11 columnas**. Dump previo `iwage-pre-rebuild-2026-09-25.sql` (2.515.184 B) | `docker tag negocio-iwage_strapi:pre-fa240b2 negocio-iwage_strapi:latest && docker compose up -d iwage_strapi` revierte código y esquema; **las columnas caídas solo las repone el dump** |
| 2026-09-25 | 19 png movidos a `/home/ubuntu/backup/png-cafe-menu-2026-09-25` | moverlos de vuelta |
| 2026-09-26 **ejecutada (G3)** | Importar y enlazar las 33 unidades aceptadas: 36 archivos a `/uploads` sobre el volumen `negocio_iwage_strapi_uploads`; `files` 0 → **37**, `files_related_mph` 0 → **72**; 27 bitácoras y 6 proyectos con medio en su fila publicada. Token dedicado `media-import-g3-2026-09-26` (`custom`, 17 acciones al nacer —ver la fila del alcance de abajo—, vence 2026-10-03). Dump previo `iwage-pre-g3-2026-09-26.sql` (2.518.525 B) | `psql < iwage-pre-g3-2026-09-26.sql` repone `files` y enlaces; los bytes quedan en el volumen (no los toca un rebuild) y repetir el `--apply` no duplica, porque la identidad es el `name` |
| 2026-09-27 **ejecutado (D5 y D6)** | Alcance del token 5, escrito en la BD y no en el repo: `strapi_api_token_permissions` + `…_token_lnk`. D5 sumó `api::producto.producto.update` (17 → 18, `ord` 4); D6 sumó `item-menu.update`, `proveedor.update` e `historia-visitante.update` (18 → **21**, `ord` 5/6/7, document_ids `6hw4mugws0qctqqzszuhhqov`, `14ji5bw8y4dz81dvvmp99kst`, `q9asbdnw3bwa477c6ji24o6w`). El alta surte en el servidor vivo, sin rebuild ni reinicio | borrar las 4 filas de `lnk` y las 4 de `strapi_api_token_permissions` con esos `document_id` (rollback escrito en `d6-grant.sql`; volcado previo de las 18 en `d6-perms-pre.txt` y en `/home/ubuntu/backup/d5-grant-pre-2026-09-27.sql`) |
| 2026-09-27 **ejecutadas (D3, D4, D5, D6)** | Cuatro `--apply` sobre la base viva, cada uno con su seco y su dump previos: `files` 37 → 44 → 44 → **47** → **62**, `files_related_mph` 72 → 86 → 98 → 104 → **132**. D6 es el primero con **0 fallas**. Ningún nombre repetido en `files` en ninguna corrida | `psql < iwage-pre-g3-2026-09-26.sql` para `files` y enlaces (los bytes ya subidos quedan en el volumen); borrar los archivos y lazos de una corrida a mano es lo único que hace falta si se quiere volver a un punto intermedio, y volver a correr el envase reconstruye el estado final porque el `--apply` es idempotente |
| 2026-10-04 **ejecutada (café: las 6 que faltaban)** | Se generan y enlazan las piezas que faltaban en café: `Té de guayaba agria` (item-menu) y las historias `El carpintero que llegó en enero`, `Las aromáticas del corredor`, `El cafetal de sombra`, `El ingeniero que se quedó a vivir`, `Los niños de la vereda`. `files` 62 → **68**; `item-menu` con imagen 16/17 → **17/17**; `historia-visitante` 4/9 → **9/9**; `proveedor` sigue 4/4. Son además las primeras 6 piezas de la librería con `alternative_text` — las otras 62 lo traen vacío, y en café el `alt` visible sale del nombre de la ficha, no del medio (`visitantes.astro:157`, `menu.astro:402`), así que el texto del admin hoy es metadato, no texto pintado. No pasó por `media-import.mjs`: el importador parte de `public/images/` y de ahí ya se fueron los originales (Task 14/16), así que el lote entró por `POST /api/upload` con `fileInfo` + `PUT` por `documentId` con el token del runner de seeds. Las dos de `personas` se produjeron de espaldas a propósito: son gente real del territorio y una cara generada las suplantaría | `/home/ubuntu/backup/cafe-imagenes-2026-10-04/`: `psql < tablas-afectadas.sql` repone `files`, `files_related_mph`, `item_menus` e `historia_visitantes`; los bytes se retiran con `DELETE /api/upload/files/{71..76}`; los PNG y WEBP de origen quedan en esa carpeta |
| 2026-10-04 **ejecutada (alt de las 62 restantes)** | `alternative_text` de los 62 archivos que venían vacíos (ids 1-62): la librería queda **68/68 con alt, 0 NULL**. Escrito por SQL directo sobre `files`, porque el plugin upload no expone ruta de actualización — `PUT /api/upload/files/:id` responde **405** y el único camino de la API es el campo `fileInfo` al subir, que obligaría a resubir los 62 y revolver ids y urls. Las descripciones se redactaron mirando las imágenes: láminas de contacto de a 6, cada celda rotulada con su `id` y su `name` (efímeras en `/tmp/medios`, ya borradas), porque el proveedor de IA del app no sirve visión (`400 MissingSessionID`, y con sesión inventada `403` de suscripción). Purga: 145 claves `iwage:*`, 3.378 ajenas intactas. Medido sobre el sitemap (209 páginas, 296 `<img>` de `/uploads/`, los 68 archivos pintados): **236** pintan el alt del admin literal, **12** son miniaturas de la tira de galería con `alt=""` deliberado (`MediaGallery.astro:167`, el alt vive en la imagen activa) y **48** son plantillas de café que pintan el nombre de la ficha (`menu.astro:402`, `visitantes.astro:157`, `proveedores/index.astro:69`) — ahí el alt del admin sigue siendo metadato. Trampa de medición: el `stale-while-revalidate=3600` de la app sirve HTML de antes durante una hora, y la primera pasada del crawl dio **0** alt del admin; fue falso negativo, no ausencia de datos | `/home/ubuntu/backup/alt-62-2026-10-04/`: `psql < files-antes.sql` repone `files` tal como estaba (los 62 con `alternative_text` NULL); `alt-62.sql` es el UPDATE aplicado, 62 filas |
| 2026-10-04 **ejecutada (meliponario: 7 fotos de *Apis* sustituidas)** | Inventariadas las 34 piezas fuera de bitácora con su ficha y su campo: **6 graves** (cajas Langstroth con alza y cuadros, abejas con franjas abdominales, pana operculada de *Apis*, letreros en inglés y rótulos en pseudo-latín) y 4 discutibles. Las 6 graves + la portada del producto más vendible se regeneran y se instalan: `55→77` (foto del proveedor Meliponario Iwagé), `29→78` y `30→79` (portada y galería de Ambalá), `34→80` (galería de La Cumbre), `35→81` (portada de San Bonifacio), `45→82` (portada de Caja INPA Nogal Cafetero), `46→83` (portada de Miel Angelita 120 ml). `files` 68 → 75 → **68**: siete altas, siete bajas, **0 huérfanas** y **68/68 con alt**. Conducto por pieza: `POST /api/upload` con el archivo en el campo **`files`** y el metadato en **`fileInfo`** (`-F "fileInfo=<archivo.json"`, porque el JSON con acentos en la línea de órdenes se trunca y el parseo del servidor revienta con 500), volteo de `files_related_mph.file_id` por SQL —**16 filas**, que son 8 relaciones porque cada ficha duplica su lazo en draft y live—, `DELETE /api/upload/files/:id` para que se vayan la fila y los bytes, y purga de `iwage:*`. Criterio que decide cada imagen: la silueta de la caja no sirve, *Apis* y melipona se distinguen por la **entrada** (un solo agujero redondo orlado de un cañón de cerumen, no tabla de vuelo) y por la **ausencia de alzas y cuadros**, y en las abejas por el abdomen **sin franjas**; las tres cosas solo se ven con zoom 2x, así que ninguna pieza pasó sin recorte ampliado. Regla de contenido: la gente real sale de espaldas o a tres cuartos, y no hay letreros legibles salvo la etiqueta del frasco, pedida en español y verificada al zoom («Miel Angelita / 120 ml» salió bien tipografiada). El slot 34 era un letrero con `[ECO-HOTEL LOGO]` y texto en inglés: en vez de intentar generar un QR, se cambió el beat por la cata de miel para huéspedes, que es lo que cuenta la descripción del proyecto. Medición: 340 assets entre `files.url` y `formats`, **340 en disco, 0 faltantes, 0 huérfanos**; las 7 páginas vivas muestran el hash nuevo en la **segunda** pasada (la primera sigue sirviendo el viejo por el `stale-while-revalidate=3600`). Los archivos borrados siguen respondiendo 200 desde el borde de Cloudflare hasta 30 días (`max-age=2592000, immutable`) aunque ya no existan en el origen: inocuo, ninguna página los referencia. Se dejaron para otra pasada los 3 discutibles —`61` pana de *Apis* como guarnición en café, `47` ánforas correctas con etiqueta «JATAÍ», `36` tabla de vuelo con placas de especies bien puestas—, **resueltos en la fila siguiente**, y sigue en pie el mismo defecto en bitácora (`40` es un cuadro operculado; `12` y `21` merecen segunda mirada), excluidos del lote a propósito | `/home/ubuntu/backup/melonino-img-2026-10-04/`: `psql < pre-cambio.sql` repone `files` y `files_related_mph` con los ids viejos (29, 30, 34, 35, 45, 46, 55) y `tar xzf uploads-antes.tar.gz -C /app/public` devuelve los 342 bytes; después hay que retirar por API los siete archivos nuevos (77-83), que el dump no conoce |
| 2026-10-04 **ejecutada (meliponario: las 3 discutibles)** | Cierre del inventario: `36→84` (portada de Finca La Esperanza: la hilera tenía entrada de raja tipo Apis; ahora son cajas de un cuerpo con su agujero redondo orlado de cerumen, y las placas «C.1 Melipona» / «C.2 Tigona» salen bien tipografiadas), `47→85` (portada de Miel con propóleo 250 ml: la etiqueta decía «MELIPONINAE HONEY – JATAÍ», especie brasileña y texto en inglés; ahora «Miel con Propóleo / 250 ml» con propóleo crudo y ánforas de cerumen), `61→86` (item-menu Miel de Angelita con café: la guarnición era pana operculada de *Apis*; ahora un frasco de miel oscura y un trozo de cerumen, sin panales). Mismo conducto que la fila anterior y **el mismo conteo al final: 68 archivos, 68 con alt, 0 huérfanas, 340 assets referenciados = 340 en disco**. Las 10 piezas marcadas en el inventario —6 graves y 4 discutibles— quedan sustituidas. Detalle nuevo del conducto: la subida por `fetch` + `FormData` desde node resuelve el multipart sin las trampas de `curl -F` (el `fileInfo` con acentos en la línea de órdenes se truncaba y devolvía 500). Verificación en dos pasadas sobre 6 páginas: los tres hashes viejos solo aparecen en la pasada 1 (el `stale-while-revalidate` otra vez), cero en la pasada 2 | `/home/ubuntu/backup/melonino-img-2026-10-04/`: `psql < pre-tres.sql` repone el estado de `files` y `files_related_mph` con las siete piezas del lote anterior ya instaladas, y `tar xzf uploads-pre-tres.tar.gz -C /app/public` sus bytes; después hay que retirar por API los tres nuevos (84, 85, 86). Las fuentes PNG y los `antes` retirados quedan en `fuentes/` |
| 2026-10-04 **ejecutada (meliponario: las cajas reales al catálogo)** | El dueño sube dos fotografías reales de las cajas que sí se usan —`public/images/Meliponas/Cajas AF.JPG` (428×422) y `Cajas IMPA.JPG` (446×484)— y con ellas se instalan las dos portadas de producto que faltaban: `87 caja-af-estandar.webp` para `caja-af-estandar` (productos 11 y 34, que hasta ahora pintaban el `Icon` de paquete en el hueco) y `88 caja-inpa-nogal-cafetero.webp` para `caja-inpa-nogal-cafetero` (productos 9 y 42), en cuyo lugar se retira la `82` generada, que mostraba un modelo de caja distinto del real. `files` 68 → **69** (una baja, dos altas), **69/69 con alt, 0 huérfanas, 145 lazos**; **339 assets referenciados = 339 en disco = 339 archivos en `/uploads`**, cero sobrantes. Cero filas con `id=82`, cero lazos a `82`, cero referencias al hash viejo `producto_caja_1_a6fa331f46` en la base y cero en las dos páginas vivas en **ambas** pasadas (`caja_af_estandar_ed55307683` y `caja_inpa_nogal_cafetero_f9646b8815` presentes desde la primera). Las dos fotos son pequeñas (428 y 446 px de lado): `formats` solo les genera `thumbnail`, porque no alcanzan los cortes de 500/750/1000, así que la ficha pinta el original sin recortar. **Corrección de criterio biológico**: el prompt negativo «NO stacked supers» estaba mal para el modelo INPA real, que **sí** es una pila de cuatro módulos de madera clara encastrados en listones de esquina. Lo que separa un meliponario del equipo de *Apis* no es la ausencia de apilamiento sino la **entrada** (un solo agujero redondo y pequeño, orlado de un collar de cerumen abultado, a ras del frente bajo), la **ausencia de cuadros y de tabla de vuelo**, y la **planta cuadrada estrecha** | `/home/ubuntu/backup/melonino-img-2026-10-04/`: `psql < pre-reales.sql` repone `files` y `files_related_mph` con la `82` todavía viva y `tar xzf uploads-pre-reales.tar.gz -C /app/public` sus bytes; para deshacer solo esta fila, `DELETE /api/upload/files/{87,88}` y devolver los lazos de los productos 9/11/34/42 a `82` (que ya no existe: hay que re-subir `fuentes/nuevo-45.png`). Las dos JPG originales quedan intactas en `public/images/Meliponas/`, fuera de git y ajenas a cualquier limpieza |

### Regla de densidad de cajas, auditoría medida y cola de imágenes (2026-10-04)

**La regla, en palabras del dueño:** «En un meliponario abierto real nunca se ven filas muy largas de cajas, máximo 6 o 7, se usan zonas». Operada como criterio de aceptación, son dos condiciones que hay que verificar **por separado**: (a) **conteo** — siete cajas o menos visibles en todo el encuadre; (b) **agrupación** — repartidas en dos o más zonas separadas por vacío visible (sendero, franja de pasto, cambio de sombra). Una hilera continua que se pierde en perspectiva es falsa aunque tenga cinco cajas, y un grupo de nueve apiñadas es falso aunque no forme hilera.

**Trampa de método que hay que registrar:** el primer inventario de densidad se leyó sobre láminas de contacto (`conteo.png`, `densidad.png`, cada celda de ~350 px) y dio tres diagnósticos equivocados: atribuyó la hilera larga a la `31` cuando la hilera larga la tiene la `84`; declaró «reprobados» los dos renders nuevos de `31` y `78`, que cumplen la regla; y dejó por buenas la `33` y la `37`, que son peores que las tres señaladas. Los conteos de la tabla de abajo se hicieron sobre cada pieza a 900-1400 px de ancho y con recortes ampliados de la franja donde corre la hilera. **Ninguna imagen se rechaza ni se aprueba en hoja de contacto.**

**Auditoría de las 13 piezas vivas fuera de bitácora que muestran cajas** (las de `bitacora` quedan excluidas por decisión previa del dueño; `52`, `53`, `54` son de café y no les aplica la regla):

| id | pieza | rol | cajas | composición | veredicto |
|---|---|---|---|---|---|
| 31 | `proyecto-carmen-1` | portada y galería de `finca-el-carmen` | **~30** | **dos hileras continuas que se pierden hasta el horizonte**, letrero legible «Meliponario "Don Luis" Abejas Angelita», campesino mirando a cámara | **rechazada** — viola las dos condiciones y encima rotula un nombre inventado |
| 32 | `proyecto-carmen-2` | galería de `finca-el-carmen` | 1 | caja abierta con frascos de cerumen y meliponas, guantes azules | buena |
| 33 | `proyecto-cumbre-1` | portada y galería de `ecohotel-la-cumbre` | **5** | **una hilera continua a lo largo del pasamanos**; la caja del frente tiene **entrada de raja tipo *Apis***, no agujero redondo; dos placas marrones; la guía y tres turistas **de frente a cámara**; camiseta con logo; un colibrí y tres mariposas de adorno con escala y desenfoque falsos | **rechazada** — viola (b) y arrastra cuatro defectos más |
| 37 | `proyecto-poblado-1` | portada y galería de `jardin-residencial-el-poblado` | 6 | seis minicajas decorativas en un estante-altar con **texto gigante inventado**: «MELIPONARIO JARDÍN DEL ALMA», «ABEJA ÁNGEL», «COLOMBIA» y banderas; familia de cinco **de frente a cámara** riendo | **rechazada** — el conteo pasa pero el mueble no es un meliponario; es lo más grave del lote porque pone marcas falsas |
| 77 | `proveedor-meliponario` | foto del proveedor `Meliponario Iwagé` | 2 | dos cajas sobre poste, entrada redonda con collar de cerumen | **aceptable** — densidad cumple; el modelo de caja no es el AF/INPA real (ver cola) |
| 78 | `proyecto-ambala-1` | portada y galería de `meliponario-ie-ambala` | 6 | **seis cajas en una sola hilera continua** bajo el techo de guadua; estudiantes de espaldas | **rechazada** — el conteo (6) cumple, la agrupación (a) no: es una hilera, no zonas |
| 79 | `proyecto-ambala-2` | galería de `meliponario-ie-ambala` | 1 | primer plano de la entrada redonda orlada de cerumen con meliponas de patas claras | buena |
| 80 | `proyecto-cumbre-2` | galería de `ecohotel-la-cumbre` | 1 | una caja sobre poste con su entrada redonda, cata de miel, visitante de espaldas | buena |
| 81 | `proyecto-bonifacio-1` | portada y galería de `colegio-san-bonifacio` | 1 | una caja, grupo de escolares y profesora de espaldas | buena |
| 84 | `proyecto-esperanza-1` | portada y galería de `finca-la-esperanza` | **10** | **diez cajas en una hilera continua** que se estrecha hasta desaparecer; placas «C.1 Melipona» / «C.2 Tigona» perfectamente legibles; campesino a tres cuartos (eso sí cumple) | **rechazada** — viola (a) y (b) y rotula |

Cuatro piezas rechazadas (`31`, `33`, `37`, `78`) y una opcional (`77`). Las cuatro portadas rechazadas son además `imagen` **y** `galeria` de su propio proyecto, así que cada sustitución arregla los dos sitios de una.

**Lo que ya estaba resuelto sin gastar créditos — **ejecutado la misma tarde del 2026-10-04**.** Los dos renders que corrigen `31` y `78` existen, están revisados y cumplen: `nuevo-31.png` (1536×1024, **cinco** cajas en **dos** grupos separados por un sendero, campesino de espaldas, cero texto) y `nuevo-78.png` (1264×848, **dos grupos de tres** bajo el techo de guadua con el camino de tierra en el medio, cuatro estudiantes de espaldas). Copias de seguridad en `/home/ubuntu/backup/melonino-img-2026-10-04/fuentes/render-31-zonas.png` y `render-78-zonas.png`, porque `vibe_images/` y `.scratch-melonino/` son efímeros y ya han sido borrados por limpiezas. Respaldo del estado previo tomado antes de escribir: `pre-densidad.sql` y `uploads-pre-densidad.tar.gz`. El conducto: `zonas.mjs` sube los dos recortes a 1200×805 con su alt → **`89 proyecto-carmen-1.webp`** (`/uploads/proyecto_carmen_1_ec8816c292.webp`) y **`90 proyecto-ambala-1.webp`** (`/uploads/proyecto_ambala_1_a574437924.webp`); `UPDATE files_related_mph SET file_id=89 WHERE file_id=31` y `…90 WHERE …=78`, **4 filas cada uno** (imagen+galería × draft+live, como estaba previsto); `DELETE /api/upload/files/31` y `/78` → 200; purga de 5 claves `iwage:*`. Medido al cierre: `69 archivos, 0 sin alt, 0 huérfanas`, **339 assets referenciados = 339 en disco = 339 en `/uploads`**, cero filas y cero formatos que mencionen los hashes viejos. Las dos páginas vivas ya pintan el hash nuevo en la **segunda** pasada (`91e0dc50da` y `dc652fcaea` solo en la primera, por el `stale-while-revalidate=3600`). El envase queda documentado por si hay que repetir el ciclo:

```bash
cd /home/ubuntu/negocio/data/app_iwage/.scratch-melonino
T=$(grep -oE "[0-9a-f]{128}" ../scripts/seed-experimentos-via-api.mjs | head -1)   # el token sigue vivo: GET /api/upload/files -> 200
node zonas.mjs "$T"                                  # anota los dos ids nuevos que imprime
```

Si `.scratch-melonino/` ya no existe, la copia duradera del envase y de los dos PNG está en `/home/ubuntu/backup/melonino-img-2026-10-04/fuentes/` (`zonas.mjs`, `render-31-zonas.png`, `render-78-zonas.png`); ahí `sharp` solo se resuelve con `NODE_PATH=/home/ubuntu/negocio/data/app_iwage/node_modules node zonas.mjs "$T"`. Continúa la secuencia:

```bash
docker exec sostenibilidad_db psql -U admin -d iwage -c \
  "UPDATE files_related_mph SET file_id=<N31> WHERE file_id=31;
   UPDATE files_related_mph SET file_id=<N78> WHERE file_id=78;"   # 4 filas cada uno: imagen+galería × draft+live
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:1338/api/upload/files/31
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:1338/api/upload/files/78
docker exec redis_app sh -c "redis-cli --scan --pattern 'iwage:*' | xargs -r -n 50 redis-cli DEL"
```

Verificación debida: `finca-el-carmen` y `meliponario-ie-ambala` en **dos** pasadas (el `stale-while-revalidate=3600` sirve el HTML viejo una hora), conteo de cajas del archivo instalado con zoom, y el par de invariantes —`69 archivos, 0 sin alt, 0 huérfanas` y `assets referenciados = assets en disco`.

**Cola de generación (bloqueada por cuota: `403 {"code":"112"}`, se agotó el día 2026-10-04).** Cuatro piezas, todas a `1536x1024` para recortar a 1200×805 salvo la `77`, que es cuadrada. Los tres prompts llevan la regla de densidad redactada como instrucción positiva (número exacto de cajas y zonas declaradas) y el veto de texto expreso, porque el modelo escribe rótulos si se le deja.

1. **`84` → portada de Finca La Esperanza.** Cinco cajas en dos grupos (tres bajo un cafeto a la izquierda, dos junto a una cerca rústica a la derecha) con pasto vacío y sendero entre los grupos; madera gris envejecida sobre postes lisos; una sola entrada redonda baja con collar de cerumen; lantana y café maduro al frente, cordillera entre nubes. Cero letreros, cero personas.
   `alt`: «Cinco cajas de meliponas de madera envejecida sobre postes, repartidas en dos grupos separados por un sendero de tierra en el cafetal; la caja del primer plano muestra su única entrada redonda orlada de cerumen, con lantana en flor y la cordillera entre nubes al fondo.»
2. **`33` → portada de EcoHotel La Cumbre.** Cuatro cajas en **dos** zonas: un par sobre base baja al borde izquierdo de la terraza de bambú y otro par al borde derecho, con pasamanos y piso vacíos en el medio. Prohibido: hileras a lo largo del pasamanos, entradas de raja, tablas de vuelo, cuadros, alzas, placas, logos en ropa, colibríes y mariposas de adorno. Dos o tres visitantes **de espaldas**.
   `alt`: «Cuatro cajas de meliponas en dos grupos sobre la terraza de bambú de un ecohotel, con la cordillera nublada al fondo; dos visitantes las observan de espaldas y cada caja muestra su única entrada redonda orlada de cerumen.»
3. **`37` → portada de Jardín Residencial El Poblado.** Tres cajas de madera natural con tapa gruesa saliente —las del modelo real, no cajas pintadas— sobre postes de madera en un jardín residencial: dos juntas bajo un guayacán y una sola a varios metros junto al sendero. Prohibido expreso: altares, estantes, banderas, escudos, texto, números, personas de frente. Nadie en el encuadre.
   `alt`: «Tres cajas de meliponas de madera natural con tapa gruesa saliente, dos agrupadas bajo un árbol del jardín residencial y una más lejos junto al sendero de piedra, entre helechos y flores.»
4. **`77` → foto del proveedor Meliponario Iwagé (opcional).** La densidad cumple; el reparo es de fidelidad de modelo: son cubos genéricos, no las AF/INPA que se venden. Si se regenera, describir la silueta real leída de las dos fotografías del dueño: caja alta y estrecha de madera clara, tapa plana gruesa que sobresale por los cuatro lados, dos listones verticales de esquina que continúan por debajo como pies, base de tablas, un solo agujero redondo pequeño abajo en el frente. No hay foto real servible para esta pieza: las dos del dueño son tomas de producto de un solo lado y 428×422 px, demasiado chicas para una portada de proveedor.

**Inventario de bitácora con el mismo criterio (medido por la tarde, ya sin cuota).** El índice se armó por texto alternativo —las 69 piezas ya tienen `alt` propio— filtrando las que mencionan herraje de colmena: **29 piezas en total**, 14 en bitácora y 15 fuera. De las 14 de bitácora, 12 se miraron a 820 px; `13` y `17` quedan solo con la lectura del `alt`. El defecto dominante aquí no es la densidad sino la **especie y el idioma**: son láminas didácticas y siete de ellas enseñan *Apis* o rotulan en inglés.

| id | pieza | qué está mal | peso |
|---|---|---|---|
| 2 | `bitacora-caso-don-manuel` | **hilera en perspectiva de siete cajas Langstroth** con raja de entrada y panal hexagonal asomando en la que él abre; es la historia de un meliponicultor | **grave** |
| 3 | `bitacora-atraer-colonia` | rótulos en inglés «Pheromone Lure» y «Entrance Tunnel» (dos veces) sobre una caja trampa; las abejas que entran tienen abdomen franjado | **grave** |
| 11 | `bitacora-guia-completa` | los cuatro pasos rotulados en inglés («Bait Trap Setup», «Nest Box Installation», «Safe Colony Division», «Sustainable Honey Harvest»); abejas franjadas en los pasos 1 y 3, aunque los interiores de 2 y 4 sí son de melipona | **grave** |
| 21 | `bitacora-modulo8-plagas` | la pieza central es una *Apis* franjada gigante sobre panal hexagonal; alrededor, moscas y hormigas correctas | **grave** |
| 40 | `bitacora-modulo9-cosecha` | **bastidor Langstroth con panal operculado**, abejas franjadas, ahumador y frascos de miel dorada | **grave** |
| 41 | `bitacora-modulo6-division` | dos cajas con **cuadros vistos desde arriba**, hendiduras de mano y raja de vuelo; una *Apis* franjada arriba a la derecha | **grave** |
| 43 | `bitacora-cosecha-miel` | panal hexagonal operculado dentro de una caja y miel clara escurriendo de un trozo de panal; la miel de melipona vive en frascos de cerumen | **grave** |
| 1 | `bitacora-inpa-vs-af` | el interior AF está bien (frascos de cerumen arriba, cría abajo) pero la abeja del centro está franjada y las cotas son inventadas («AF», «2F», «19», «8», «3») | medio |
| 19 | `bitacora-modulo5-manejo` | traje de *Apis* con velo y caja con hendidura de mano; el interior con frascos globosos de cerumen es lo más correcto del lote | medio |
| 24 | `bitacora-meliponario-finca` | cuatro cajas rotuladas **INPA y AF** —los rótulos aciertan con los modelos reales— pero con tabla de vuelo y raja tipo Langstroth en lugar de la silueta verdadera | medio |
| 18 | `bitacora-modulo4-trasiego` | herraje genérico con hendiduras y raja; **las abejas son las correctas** (oscuras, mate, sin franjas) | aceptable con reparo |
| 12 | `bitacora-ruta-miel` | panal en hueco de árbol con cría oscura y coladera, verosímil; la miel sale más clara de lo habitual | aceptable |
| 13 | `bitacora-heroinas-guadua` | no vista a fondo; el `alt` describe un nido de meliponas dentro de la guadua | sin verificar |
| 17 | `bitacora-modulo3-nido` | no vista a fondo; el `alt` describe conducto de entrada de cerumen en tronco hueco | sin verificar |

**Inventario de café con el mismo método (medido después de cerrar bitácora).** Veintidós piezas cuelgan de café —9 historias de visitantes, 9 ítems del menú, 4 proveedores— y el índice salió de los `alt` propios; ocho se miraron a 760 px porque el `alt` o el nombre de la ficha olían a contradicción. Aquí el defecto no es la especie de abeja ni la densidad: es que **la imagen niega lo que dice el nombre de la ficha**.

| id | ficha | qué está mal | peso |
|---|---|---|---|
| 53 | proveedor **Finca La Cumbre** | un **hato de ganado brahman blanco pastando en sabana** con cordillera de fondo: cero café en la portada de un proveedor de café, y el paisaje no es de finca de niebla sino de llano ganadero | **grave** |
| 51 | **Doña Nelly y la receta del pandebono** | el pan de la mesa es un **bollo de trigo con corte en cruz** y hay **granos de trigo esparcidos sobre la mesa**; el pandebono es aro de **almidón de yuca y queso**, sin trigo — la foto contradice la receta que ilustra. Además, cara generada de frente | **grave** |
| 56 | **Aromática de flora nativa** | la jarra lleva **menta y limoncillo**: *Mentha* es europea y *Cymbopogon* asiático-africana, ninguna es flora nativa, y el fondo es **lantana, que es invasora**. El nombre promete nativo y la imagen muestra dos introducidas | **grave** |
| 58 | **Chocolate de cacao local** | taza y platillo de porcelana con **chocolate con leche espolvoreado en cacao y virutas de chocolate** sobre mesa de roble clara: es un chocolate a la taza europeo, y el cacao lo aporta la propia ruta (proveedor `54`, Cacao El Espinal). No hay mazorca, ni tableta, ni jícara, ni queso | **grave** |
| 49 | **Las angelitas del techo** | las «angelitas» son *Tetragonisca angustula*, abeja pequeña de cuerpo **verde oliva pálido con cabeza oscura**; aquí son **abejas negras grandes y lustrosas**. El polen en las patas y el forrajeo sobre bráctea sí corresponden | medio |
| 60 | **Latte de miel y canela** | las **dos ramas de canela** son adorno de café invernal importado, no producto de la finca. La miel dorada y fluida que escurre está **bien**: es la correcta para melipona (ver la corrección más abajo) | aceptable con reparo |
| 48 | El colibrí de garganta azul | verosímil como *Colibri cyanotus* andino, pero el ala sale **demasiado ancha y digitada** para un colibrí y come sobre lantana | aceptable con reparo |
| 72 | El carpintero que llegó en enero | **correcto**: *Piculus chrysochloros* (nuca roja, ventral barrado, dorso verde dorado) sobre poste de guadua con heliconia de fondo | buena |

Sin reparo tras leer el `alt` y el muestreo: `50` guamo centinela, `73` aromáticas del corredor (ahí limoncillo e hierbabuena no se venden como nativos), `74` cafetal de sombra Caturra, `75` ingeniero de espaldas, `76` niños de la vereda con cáscaras de cacao, `28` espresso, `57` café de origen, `59` cold brew, `62` arepa con queso de la Cumbre, `71` té de guayaba agria con panela, `54` cacaotero con mesa de secado.

**Corrección del dueño que revierte un veredicto y abre cuatro piezas más.** Anotado al cierre del día: *la miel de melipona es más dorada y más líquida que la de* Apis. Dos consecuencias, en direcciones opuestas:

- **`60` queda casi absuelta.** El reproche que le hice —«la miel que escurre es jarabe dorado transparente, no miel oscura»— estaba mal planteado: ese dorado fluido **es** el color y la textura correctos. Le queda solo el reparo menor de las dos ramas de canela, que son adorno importado y no producto de la finca. Pasa de *media* a *aceptable con reparo*.
- **`83`, `85`, `86` y `80` quedan mal.** Las cuatro muestran miel **marrón rojiza oscura**, y en `83` además **cargándose en hilo denso sobre el remo**, que es comportamiento de miel de *Apis* madura, no de una miel que la propia bitácora describe como «más fluida, más ácida (pH ~3.26) y más sensible al calor». `83` es la portada del producto más vendido del catálogo de meliponas: la foto insignia contradice el color del producto que se compra. Las cuatro entran a la cola, y el `alt` de las cuatro dice hoy «miel oscura»: **el `alt` describe fielmente la imagen equivocada**, así que se corrige junto con la imagen, no antes.
- **Barrido de la copia escrita:** se buscaron en todas las columnas de texto de `productos`, `item_menus`, `historia_visitantes`, `proyecto_meliponarios`, `bitacoras` y `proveedors` las afirmaciones de color o fluidez de la miel, y **la única que hay es correcta** —la bitácora del perfil sensorial de la miel de Angelita. El error está circunscrito a la foto y a su `alt`; nadie escribió en el sitio que la miel de melipona sea oscura.
- Dato que confirma el criterio y que estaba en la casa: las dos ilustraciones de bitácora que comparan especies —`14` (frasco claro rotulado «Melipona» frente a frasco oscuro con una *Apis* rayada) y `9` (miel clara en la loma verde, oscura en la loma erosionada)— **aciertan**. El lenguaje visual didáctico del sitio ya sabía lo que la fotografía de producto pintó al revés.
- Reparo colateral que salió en la misma mirada: la flor de guarnición en `83` y el fondo de `56` son **lantana, que es invasora**. En la foto de un producto que se vende como miel de flora nativa, la guarnición floral no puede ser la planta que está desplazando esa flora.

**Barrido de caras, con la regla ya extendida a todo el sitio.** Las 15 piezas cuyo `alt` menciona personas, miradas una por una: dan la espalda o a tres cuartos `75`, `76`, `80`, `84`, `89`, `90` y `19` (velo); son solo manos `12`, `32`, `85`. **Miran de frente a cámara `52` (Familia Cardona: tres rostros), `51` (Doña Nelly sonriendo), `33` (la guía y tres turistas) y `37` (la familia del estante).** `51`, `33` y `37` ya estaban en la cola por otros motivos; **`52` entra nueva**, y es la foto que abre la ficha del proveedor más antiguo de la ruta, así que hay que regenerarla con la misma convención que `75` y `76`: la gente real del territorio, de espaldas o a tres cuartos.

**La cola de generación queda entonces en 19 piezas firmes** —tres fuera de bitácora (`84`, `33`, `37`, con `77` opcional), siete graves de bitácora (`2`, `3`, `11`, `21`, `40`, `41`, `43`), cuatro graves de café (`53`, `51`, `56`, `58`), cuatro de color de miel (`83`, `85`, `86`, `80`) y una de caras (`52`)— más cuatro medias (`1`, `19`, `24` de bitácora; `49` de café), tres aceptables con reparo (`48`, `60`, `18`) y dos sin verificar de cerca (`13`, `17`). Las de bitácora son **ilustraciones a 1200×675 en estilo acuarela sobre papel crema**, no fotografías: el prompt tiene que pedir el estilo de la serie para que la lámina nueva no desentone con sus vecinas, y el contenido es un corte didáctico (nido, frascos de cerumen, entrada de cerumen), no una escena de campo. A esto se suma lo que la cuota no dejó empezar: **10 productos sin portada** (siguiente párrafo).

**Backlog medido de catálogo, para la misma sesión de créditos:** de los 14 `slug` distintos en `productos`, **solo 4 tienen portada** (las dos mieles y las dos cajas instaladas hoy). Diez no tienen ninguna: `caja-inpa-con-atril`, `kit-inicio-meliponicultor`, `kit-educativo-prae`, `kit-observacion`, `asistencia-tecnica-mensual`, `huevos-gallina-feliz-docena`, `canasta-hortalizas-temporada`, `plantulas-nativas`, `compost-madurado-bulto`, `granja-visita-guiada`. Todas pintan el `Icon` de paquete en el hueco (`src/pages/meliponas/tienda/[slug].astro:143`).

**Decisiones que siguen abiertas, del dueño:** (1) `caja-inpa-con-atril` no se puede ilustrar con la foto real del INPA porque el atril no aparece — ¿foto propia nueva, render, o dejar el hueco?; (2) las portadas de producto de los nueve kits y artículos de granja entran en la cola de generación o se quedan en el placeholder; (3) si la regla de «sin caras de frente» se extiende a café, caen `52` (Familia Cardona, tres rostros a cámara), `51` (Doña Nelly) y `33` (cuatro), y hoy por hoy solo se aplicó a meliponario; (4) bitácora **ya fue revisada con el mismo criterio** (tabla arriba): siete graves (`2`, `3`, `11`, `21`, `40`, `41`, `43`), tres medias (`1`, `19`, `24`) y dos sin verificar de cerca (`13`, `17`); (5) cuatro commits locales sin empujar (`8364129`, `4f304da`, `2a98ce5`, `f75bb6b`) más el de esta fila.

### Cuatro pedidos del dueño esa misma noche (2026-10-04): cultivos, tarjetas de navegación, la banda y la ficha propia

Cuatro preguntas del dueño al cerrar el día. Una respuesta negativa, un mecanismo nuevo, una mentira de página arreglada y un hueco de inventario que no estaba en la cola.

**(a) «¿Incluiste las fotos que faltan de los cultivos que polinizamos?» — No estaban, y no es un olvido: es un agujero del método.** Medido: `cultivo_polinizacions` tiene **6 fichas publicadas** (`cafe`, `aguacate`, `mora`, `citricos`, `tomate`, `fresa`) y **0 vínculos** en `files_related_mph` con `related_type` de cultivos; la página viva de polinización no sirve ni un solo `/uploads/`. Lo que sí existe son tres láminas de polinización —`25 bitacora-polinizacion-aguacate`, `26 …-maracuya`, `27 …-mora`— pero están hiladas como portadas de bitácora, no como fichas de cultivo, así que aparecen en el sitio sin que ninguna ficha de cultivo las luzca.

**Por qué el barrido no las vio, que es lo que hay que recordar:** las dos colas de la tarde (densidad y café) se construyeron **desde los assets** —los 69 `files` y sus `alt`. Un inventario que arranca en la tabla de medios solo encuentra defectos de medios; los **huecos** son invisibles ahí, porque una colección sin vínculos no produce ninguna fila que abrir. El conteo de cajas y el barrido de caras estaban bien hechos y aun así dejaron fuera la única colección del esquema con cero imágenes. **Regla: todo inventario de calidad visual se camina dos veces, una desde los assets (defectos) y otra desde las colecciones del esquema (huecos).** La segunda es un `select count(*)` por `related_type` contra las colecciones con plantilla de ficha; si da 0 y la plantilla pinta `imagen`, hay agujero.

Entra a la cola como **6 piezas nuevas** (una portada por cultivo, ver el consolidado más abajo). Las tres láminas existentes (`25`, `26`, `27`) son ilustraciones didácticas de la serie bitácora y **no sirven** de retrato de campo para la ficha de un cultivo: se pueden hilar como diagrama dentro del cuerpo, pero la portada pide foto.

**(b) Tarjetas de navegación con imagen de fondo.** El pedido: «las tarjetas que encabezan las páginas que guían la navegación deberían tener una imagen de fondo». El mecanismo son dos piezas y cuatro cableados:

- `src/lib/media.ts` → `cardPhotoStyle(url)`: devuelve `--card-photo: url('<url>')` **solo si** la URL calza `/^\/uploads\/[\w.\-/]+$/`. El filtro no es cosmético: la URL viene de Strapi y se deposita dentro de un atributo `style`, que es un canal de inyección de CSS (una ruta con `)` o `;` cerraría la declaración y abriría propiedades). Con la ruta blanca, lo único que puede salir es una url de upload.
- `src/styles/global.css` → `.card-photo`: `background-image` con un degradado de **dos paradas `color-mix(in srgb, var(--color-surface-raised) 92%→72%, transparent)`** sobre la foto. Se pinta sobre el token de superficie y no sobre negro, así que el scrim **se adapta solo al modo oscuro** sin duplicar la regla. Se eligió `background-image` y no un `<img>` absoluto a propósito: las cuatro rejillas de navegación tienen markups distintos y un `<img>` real habría exigido reestructurar `z-index` y `overflow` en cada tarjeta; con el fondo, ninguna tarjeta cambia de estructura.
- Cableado: `FeatureCard.astro` (prop `image?: string | null`, la tarjeta de `/meliponas`), y en línea las rejillas de `meliponas/proyectos/index.astro`, `cafe/index.astro` y `granja/index.astro`. **El fallback es el estado anterior**: sin foto, la tarjeta conserva su tile de icono, no se queda en blanco.

Medido en el servidor de desarrollo, recuentos de `--card-photo: url(` por hub: **`/meliponas` 2, `/meliponas/proyectos` 4 de 4, `/cafe` 6 de 6, `/granja` 0 de 6.** Los dos de `/meliponas` son Tienda y Proyectos; Polinización sigue con icono porque ningún cultivo tiene foto — es el mismo hueco del punto (a), no un defecto de cableado. `/granja` es el caso inverso y el más barato de cerrar: **0 de 10 experimentos publicados llevan imagen**, así que no hay de dónde tomar; pero las seis claves `subsistema` de los experimentos (`gestion-hidrica`, `energia`, `biorefineria-domestica`, `agroecosistema-productivo`, `gemelo-digital`, `bioarquitectura`) coinciden **exactamente** con las seis tarjetas, de modo que en cuanto suba una imagen por subsistema la rejilla se ilumina 6/6 **sin tocar código**. `retratoDeTipo()` y `retratoDeSubsistema()` toman el primer proyecto/experimento portado del tipo clave, con `pageSize: 100` para no depender del orden de paginación.

**(c) La banda «Conoce el meliponario» decía lo contrario de lo que mostraba.** Medido antes de tocar: la banda se llamaba «Conoce el meliponario», hablaba de «nuestras colmenas», y debajo pintaba un mosaico de **cuatro proyectos de clientes** con cuatro enlaces «Ver proyecto:» a fichas ajenas, un `<video>` muerto y un `<div>` con forma de botón que no llevaba a ninguna parte. Ahora está guardada por `bandaMeliponario`: si no hay ficha propia o no hay al menos una imagen real, **la banda entera se retira** en vez de rellenarse con lo primero que encuentre. Con la ficha creada (punto d), muestra tres láminas del meliponario propio dentro de un único enlace a su detalle, más un `<a>` verdadero «Ver el meliponario». Ocurrencias de «Ver proyecto:» en la banda: **4 → 0**.

**(d) Faltaba la ficha del meliponario propio, y ya está.** `meliponario-central-iwage`, publicada, `tipo: institucional`, filas **73** (borrador) y **76** (vida), portada `77` + galería `87` y `88`, **6 filas** en `files_related_mph` (3 vínculos × 2 etapas) y 0 huérfanas. De paso cierra la pregunta que el Task 11 dejó abierta en la línea 1510 sobre cómo escribe v5 el `related_type` en esta instalación: **`api::proyecto-meliponario.proyecto-meliponario`** (forma compuesta, no el uid a secas). La copia es solo verificable: origen 2021 leído de `src/pages/meliponas/nosotros/index.astro:52`, modelos INPA/AF, la miel «más fluida, más ácida (pH ~3,26)» de la bitácora del perfil sensorial, y flora del corredor Ambalá. **No se inventaron número de colmenas, kilos de producción ni telemetría.** Tres límites de validación que conviene tener a mano antes de armar otra ficha: `descripcion_corta` ≤ 250, `meta_title` ≤ 70, `meta_description` ≤ 160 (los tres devuelven 400 con `ValidationError`, no 403 — la escritura está habilitada).

```bash
# respaldo tomado ANTES de crear la ficha (12 proyectos / 69 files / 145 vínculos)
docker exec -i sostenibilidad_db psql -U admin -d iwage < \
  /home/ubuntu/backup/melonino-img-2026-10-04/pre-meliponario-central.sql
# el envase idempotente (crear → hilar → releer) y el payload:
cp .scratch-melonino/meliponario-central.{mjs,json} /home/ubuntu/backup/melonino-img-2026-10-04/fuentes/
```

**(e) Defecto incidental corregido en el mismo camino.** `jardin-residencial-el-poblado` estaba tipado `empresa`, un valor que ninguna de las cuatro líneas de servicio filtra; por eso la tarjeta «Paisajismo Residencial» no tenía retrato y por eso el bloque «proyectos relacionados» de `/meliponas/proyectos/lineas/paisajismo-residencial` salía vacío. Retipada a `residencial` (respaldo de tabla: `pre-retipo-poblado.sql`). Los dos efectos se verificaron: la cuarta tarjeta ya pinta `proyecto_poblado_1` y el bloque de relacionados ya tiene contenido.

**(f) El mismo barrido de densidad nunca se corrió sobre `public/images/`, y ahí estaba el peor caso.** `hero-meliponas.webp` son **dos hileras continuas de ~14-16 cajas idénticas** que se pierden en perspectiva: viola (a) y (b) a la vez. Su exposición es la más alta del dominio, porque sirve de hero en `/meliponas`, de hero en `/meliponas/proyectos` **y** de `og:image`/`twitter:image` por defecto en `src/layouts/BaseLayout.astro:35,42` — es la imagen que se ve en cada enlace compartido que no tiene og propio. Que esté fuera de la cola tiene la misma causa que (a): el registro de hero de Strapi guarda una **cadena de URL**, no un vínculo de media, así que ningún barrido por `files` ni por `files_related_mph` podía encontrarla. Compañeras del mismo cajón: `hero-ecosistema.webp` (hero del home y og del home) es vector plano con **alzas Langstroth apiladas** y paleta de otoño —la densidad cumple (5 en un grupo), el estilo y el herraje no, y desentona con el resto de héroes que son fotografía. `linea-meliponas.webp` y las otras cinco `linea-*.webp` **no las referencia ningún archivo de `src/`**: son assets muertos, no defectos, y se dejan quietos hasta que el dueño diga.

**Cola consolidada después de esta noche: 32 piezas firmes**, trece más que las 19 de la tarde. El conteo, para que cuadre al abrir los créditos:

- **19 ya contadas** — 3 fuera de bitácora (`84`, `33`, `37`), 7 graves de bitácora (`2`, `3`, `11`, `21`, `40`, `41`, `43`), 4 graves de café (`53`, `51`, `56`, `58`), 4 de color de miel (`83`, `85`, `86`, `80`), 1 de caras (`52`).
- **+6 portadas de cultivo** (`cafe`, `aguacate`, `mora`, `citricos`, `tomate`, `fresa`): campo andino con una espiga de polinización visible, cero texto.
- **+1 héroe estático** (`hero-meliponas.webp`), que es la de mayor exposición del dominio.
- **+6 retratos de subsistema** para `/granja` (`gestion-hidrica`, `energia`, `biorefineria-domestica`, `agroecosistema-productivo`, `gemelo-digital`, `bioarquitectura`), que no son un capricho estético: sin ellos el cableado de esa rejilla queda en 0/6.

Fuera de las firmes quedan **5 medias** (`1`, `19`, `24`, `49` y `hero-ecosistema.webp`), **3 aceptables con reparo** (`48`, `60`, `18`), **2 sin verificar de cerca** (`13`, `17`), **1 opcional** (`77`) y el catálogo de **10 productos sin portada**, que sigue siendo decisión y no defecto. Con ~8 generaciones por día, las 32 firmes son cuatro jornadas.

**(g) Dos cosas encontradas que se dejan sin tocar, porque son del dueño.**

- **El comparador de `proyectosHome` ordena `destacado` al final.** `src/pages/meliponas/index.astro:99` tiene `if (a.destacado !== b.destacado) return b.destacado ? 1 : -1;`, que empuja los destacados a la cola del `slice(0, 4)`: una ficha marcada como destacada **nunca** puede entrar en los cuatro proyectos del home. Se arregla invirtiendo el signo, pero eso cambia qué cuatro proyectos ve el visitante, y cuál se destaca es criterio comercial, no defecto técnico.
- **El meliponario tiene dos nombres, dos direcciones y una promesa sin confirmar.** `src/pages/meliponas/index.astro:116-122` fija «Meliponario Base Iwagé · Vereda El Carmen, Ibagué» con coordenadas duras y un «Visítanos»; la ficha nueva dice «Meliponario Central Iwagé · Corredor Ambalá»; y el proveedor `Meliponario Iwagé` (id 4) tiene `es_anfitrion = false`. Hay que elegir uno, y decidir si de verdad se recibe público antes de seguir prometiendo la visita. También queda sin llenar `iot_activo`, `identidad_digital_colmena` y `prae_alineado` en la ficha nueva, que por eso muestra un «1/5 Modelo Iwagé» honesto y baja.

**Estado al cerrar:** todo lo anterior se midió contra el servidor de desarrollo en `127.0.0.1:4331` (`./node_modules/.bin/astro dev --background --port 4331`; el 4321 es del contenedor), con `npm test` en 388/388 y `npm run build` limpio; el servidor quedó detenido. **Producción no se tocó esta noche**: los dos commits de esta noche (`1831e7c` código, `0b2c06e` registro) están locales, y con estos ya son diez sin empujar. Las Strapi vivas sí cambiaron — la ficha nueva y el retipo son datos, no código. Las capturas de verificación (`hub-*.png`, `crop-*.png`, `banda-meliponario.png`, `ficha-central.png`) son efímeras; la herramienta que las produce ya está guardada en `fuentes/shot.mjs` dentro del respaldo. Conviene conservarla: es un CDP sobre el chromium del sistema que fuerza `.reveal{opacity:1}` antes de disparar, porque en un `--screenshot` estático el ScrollReveal deja la página en negro y uno termina aprobando imágenes que nunca vio.

### Task 1 — evidencia leída y parche preparado (2026-09-25 por la mañana) / **aplicado esa misma tarde**

Step 1, todo por lectura, el 2026-09-25:

- `docker inspect iwage_strapi --format '{{json .Mounts}}'` → `[]`. El contenedor no tiene ningún volumen.
- `docker exec iwage_strapi ls -la /app/public/uploads` → un solo archivo, `.gitkeep` de 0 bytes, fechado el 25-jul. **No hay material que rescatar**: el `docker cp` de salvamento del paso 1 no procede, y concuerda con `files = 0` en la BD.
- La causa está en `strapi/Dockerfile:7` (`RUN mkdir -p public/uploads`): el directorio se crea en la capa escribible de la imagen, así que cada rebuild se va con él lo que Strapi hubiera subido.
- `docker volume ls` / `docker volume inspect iwage_strapi_uploads` → no existe. El plan anterior no dejó un volumen huérfano del que recuperar algo.

El parche, aplicado sobre una copia en memoria y validado con `yaml.safe_load` sobre el archivo real (41 servicios siguen parseando, y el mount queda exclusivamente en `iwage_strapi`):

```yaml
# docker-compose.yml, dentro de iwage_strapi:, entre ports: (línea 1111) y environment:
    volumes:
      - iwage_strapi_uploads:/app/public/uploads

# docker-compose.yml, bloque top-level volumes: (línea 1437)
  iwage_strapi_uploads:
```

Step 2 en adelante **no se habían ejecutado aquí**: editar ese compose y recrear el servicio reinicia
el CMS que comparten ~30 servicios, y hacía falta el 'sí' del dueño. **El 'sí' llegó el mismo 2026-09-25
y el task se ejecutó** — con un hallazgo en el camino que el parche preparado no veía: el tag
`negocio-iwage_strapi:latest` se había desplazado a un build del 24-sep y la imagen del contenedor vivo
ya no existía en el store, así que el `up -d` habría desplegado código ajeno. Se despejó por medida
(esquemas y `/app/src`+`/app/config` byte a byte iguales entre las dos imágenes, ambas iguales a
`ffb0a9c^`) antes de reiniciar. Paso a paso y con las mediciones, en G1 del runbook.

## Self-review de este plan

- **Cobertura de la spec:** F0 → Tasks 1-6 · contrato y dedupe → Task 2 · OG absoluta → Task 4 · `try/catch` de heroes → Task 5 · un solo componente → Task 8 · las 4 copias del tipo → Task 7 · caída de fallbacks → Task 9 (y Task 13 para el caso del café, que por orden de dependencia va en F2) · esquema de los 41 campos → Task 11 · importación y enlace de huérfanos → Task 10 · fichas leyendo media → Task 12 · duplicados y slots muertos → Task 14 · audiovisual → Task 15 · métrica antes/después → Task 16. Sin huecos.
- **Lo que la spec pide y este plan deliberadamente no hace:** no impone un nombre universal de campo de portada en Strapi (`imagen_principal` vs `foto` vs `imagen` conviven). La spec lo decide así en "Nomenclatura"; el plan lo respeta y lo documenta en Task 11.
- **Deuda conocida declarada:** la allowlist de dominios de los `embed_*` no se valida en el CMS sino en `classify()` + `isEmbed()` (Task 11 Step 3). Un valor basura en la BD produce un tile vacío, no HTML inyectado. Si se quiere validación dura, es un `lifecycle` en Strapi y entra como trabajo aparte.
- **Consistencia de tipos:** `MediaItem { url, kind, alt?, caption?, provider? }` se usa con esos mismos nombres en Tasks 2, 3, 7, 8, 10, 12 y 13. El campo viejo `tipo`/`titulo` solo aparece como entrada aceptada por `toMediaItem`, nunca como salida.
- **Bloqueos reales, no burocráticos:** Task 1 Step 2 (recrear el contenedor), Task 5 Step 4 (detener Strapi), Task 11 Step 1 (dump de la BD), Task 15 Step 1 (decisión de producto sobre la banda de video). Cuatro puntos donde hay que hablar con el dueño.
