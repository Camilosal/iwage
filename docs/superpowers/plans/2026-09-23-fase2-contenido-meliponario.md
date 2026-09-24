# Fase 2 — Contenido indexable (Meliponario) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar los 37 borradores de `Publicaciones/Meliponario/` como entradas de bitácora en `/meliponas/bitacora/`, con los datos estructurados que la portada ya no puede inventarse, y dejar `llms.txt` dizendo números verdaderos.

**Architecture:** Los `.md` se parsean con un módulo puro y testeable (`strapi/scripts/lib/markdown-import.mjs`), se suben a Strapi por REST con un CLI idempotente en modo `publicado: false`, y solo se publican al final. La capa de lectura (`src/lib/bitacora.ts`) filtra por `publicado`, así que nada toca la SERP hasta el último paso. `llms.txt` pasa de archivo estático a ruta generada, con los conteos calculados.

**Tech Stack:** Astro 7 (`output: 'server'`) + `@astrojs/node`, Strapi 5 (PostgreSQL `iwage`), Redis (`redis_app`, prefijo `iwage:`), nginx en contenedor con `proxy_cache`, Cloudflare Tunnel. Node 22 con `node --test` — **el repo no tiene runner de tests y no se agrega ninguno**.

---

## Estado verificado al escribir este plan

Medido el 2026-09-23 contra producción, no asumido:

- `curl http://127.0.0.1:1338/api/bitacoras` → **19 entradas, todas `marca=granja`**. Meliponas tiene **cero** artículos, y por eso `/meliponas/bitacora` responde hoy `noindex, follow` (comportamiento puesto en la fase 1). Al importar, esa portada se voltea sola a `index, follow`.
- `/sitemap.xml` hoy: **152 URLs**, de las cuales **19** llevan `/bitacora/` (los artículos). El objetivo de la fase 2 es **189** y **56**, y son números que la Tarea 13 comprueba, no deseos.
- Propiedades publicadas: `propiedades` (Tierras) **0**, `propiedades-gestion` **4**. La suma es **4**, no 0 — la línea de `llms.txt` habla de "portafolio (Tierras + Gestión)", así que tiene que sumar las dos colecciones. (Corrige el "0 propiedades" que se había anotado antes mirando solo una.)
- `Publicaciones/` está en el repo y trackeado: **Meliponario 37**, **Granja 19**, **Productos_Meliponario 8** `.md`.
- Los 19 de Granja **ya están importados**: la intersección de slugs con Strapi es 19/19. Por lo tanto el contenido nuevo real de esta fase son **37 artículos**, y el importador tiene que ser idempotente por slug.
- Todos los 37 tienen front matter con `title`, `date`, `slug`, `categories`. `tags` solo en **21/37**.
- **12/37** contienen un placeholder `![Imagen sugerida: …]` (instrucción para generar imagen, no una imagen).
- **2/37** referencian imágenes reales, y están rotas: el host `tienda.iwage.co` ya no resuelve (`curl` → `HTTP 000`, exit 6). No hay nada que redirigir; se descartan.
- Categorías más frecuentes: `Curso de meliponicultura` (7), `Miel · propiedades y usos` (6), `Guías técnicas` (6), `Polinización y cultivos` (5), `Sin categoría` (4). Dos artículos traen `Café Iwagé` y uno `Territorio Pijao` — **la marca la define la carpeta, no `categories`**.
- `src/lib/bitacora.ts:1-24`: `EntradaBitacora` **no declara `updatedAt`**, pero `src/pages/meliponas/bitacora/[slug].astro:36` lee `article.updatedAt` → hoy `dateModified` del JSON-LD siempre cae a `fecha`. Bug real que se arregla en la Tarea 8.
- `publicado` **no existe** en el esquema de bitácora; sí existe en otras colecciones (`propiedades`, `experiencias`) y el sitemap ya filtra por él. Se adopta el mismo nombre por consistencia.
- `iwage_app` (contenedor `iwage_web`) y `iwage_strapi` se construyen con `build:` desde el árbol de trabajo y **no tienen volúmenes montados**: editar el repo no toca producción hasta `docker compose up -d --build`. La excepción es `data/app_cafeteria`, que sí monta `public/` — y no participa en este plan.

## Desviaciones respecto a la spec aprobada (y por qué)

- **`faq` se cae del esquema.** No hay ninguna sección de preguntas frecuentes en los 64 borradores (buscado: solo dos H2 sueltos que son prosa, no Q&A). Crear el campo ahora sería diseña para un caso que no existe; cuando haya FAQs, se agrega con su extractor.
- **Los 8 `Productos_Meliponario` no van a bitácora.** Son fichas de producto, y la colección correspondiente (`productos`) ya existe con otro esquema. Es trabajo de `tienda`, aparte.
- **Las rutas por receta server-rendered (`data/app_cafeteria`) se van a un plan propio.** Es otro repositorio, otro stack y otro despliegue (con `public/` montado en vivo); mezclarlo aquí solo fragmentaría la verificación.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `strapi/scripts/lib/markdown-import.mjs` | crear | Parsear y limpiar un `.md` de WordPress: front matter, slug, placeholder de imagen, extracto, tiempo de lectura, mapeo a registro Strapi. Puro, sin red ni fs. |
| `strapi/scripts/importar-bitacora.mjs` | crear | CLI: lee la carpeta, pide slugs existentes, crea los que faltan con `publicado:false`, o publica con `--publicar`. Único punto que habla con Strapi. |
| `tests/markdown-import.test.mjs` | crear | Tests del módulo puro con `node --test` (fixtures como cadenas literales, sin archivos temporales). |
| `package.json` | modificar | Script `"test": "node --test tests/*.test.mjs"`. |
| `strapi/src/api/bitacora/content-types/bitacora/schema.json` | modificar | +`publicado`, `autor`, `etiquetas`, `fecha_actualizacion`, `meta_title`, `meta_description`. |
| `src/lib/bitacora.ts` | modificar | Interfaz enriquecida, `publicado:true` en los tres fetchers, `fields` explícitos. |
| `src/lib/sitemap.ts` | modificar | Las bitácoras del sitemap solo publicaciones. |
| `src/config/bitacora-marcas.ts` | crear | Constantes por marca (nombre, autor, lugar, icono) para no repetir 6 veces la página de artículo. |
| `src/pages/{cafe,gestion,granja,meliponas,naturaleza,tierras}/bitacora/[slug].astro` | modificar | Consumir la config compartida y pasar los metadatos nuevos a `BrandLayout`. |
| `src/layouts/BrandLayout.astro` | modificar | `ArticleMeta` + `keywords`/`author` reales en el JSON-LD. |
| `src/lib/llms.ts` | crear | `aplicarConteos(plantilla, conteos)`: puro y testeable. |
| `src/content/llms-plantilla.txt` | crear (mover desde `public/llms.txt`) | La prosa, con marcadores `{{…}}` donde va un número. Se guarda como `.txt` importado con `?raw`, para no depender de cómo trate Astro un `.md` dentro de `src/`. |
| `src/pages/llms.txt.ts` | crear | Ruta que calcula los conteos y sirve la plantilla. |
| `public/llms.txt` | borrar | Lo estático mentía; una ruta lo reemplaza. |
| `src/middleware.ts` | modificar | 301 `/gestion/propiedades*` → `/gestion/alojamientos*`. |

**Ordén estricto.** Las tareas 1–4 son código puro sin efectos. La 5 y la 6 preparan destino. La 7 escribe en la base de datos. La 8 y 9 hacen visible. La 10 es el único punto sin retorno (publica). 11–13 son señal y limpieza.

---

## Tarea 1: Runner de tests y normalización de slugs

**Files:**
- Modify: `package.json` (bloque `scripts`)
- Create: `strapi/scripts/lib/markdown-import.mjs`
- Create: `tests/markdown-import.test.mjs`

- [x] **Step 1: Crear `tests/markdown-import.test.mjs` con el primer test fallando**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarSlug } from '../strapi/scripts/lib/markdown-import.mjs';

test('limpiarSlug: minúsculas, sin acentos, sin tramos de fecha de WordPress', () => {
  assert.equal(limpiarSlug('Cosecha-Mayo-2026-Lote-L25-05-001'), 'cosecha-mayo-lote-l25-05-001');
  assert.equal(limpiarSlug('  Meliponas__de_Ángel  '), 'meliponas-de-angel');
  assert.equal(limpiarSlug('melipona-2026-05-17-la-reina'), 'melipona-la-reina');
  assert.equal(limpiarSlug(''), '');
});
```

- [x] **Step 2: Ejecutar y ver que falla**

Run: `cd /home/ubuntu/negocio/data/app_iwage && node --test tests/*.test.mjs`
Expected: `Cannot find module '.../strapi/scripts/lib/markdown-import.mjs'` (o `ERR_MODULE_NOT_FOUND`). Si en su lugar aparece un éxito, el runner no está corriendo el archivo: detener y revisar la ruta.

- [x] **Step 3: Implementar el mínimo**

Crear `strapi/scripts/lib/markdown-import.mjs`:

```js
/**
 * Utilidades puras para importar borradores de Publicaciones/*.md a Strapi.
 * Sin red ni acceso a disco: todo entra y sale por parámetros, para poder testear.
 */

/** Slug de WordPress a slug-canónico: sin acentos, sin fechas sueltas, guiones simples. */
export function limpiarSlug(input) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/-(?:19|20)\d\d(?:-(?:0[1-9]|[12]\d)(?:-\d{1,2})?)?(?=-|$)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [x] **Step 4: Ejecutar y ver que pasa**

Run: `node --test tests/*.test.mjs`
Expected: `pass 1` / `fail 0`.

- [x] **Step 5: Registrar el script en `package.json`**

En el bloque `scripts` de `package.json`, después de `"preview"`:

```json
    "test": "node --test tests/*.test.mjs"
```

Run: `npm test` → Expected: lo mismo del paso 4.

- [x] **Step 6: Commit**

```bash
git add package.json tests/markdown-import.test.mjs strapi/scripts/lib/markdown-import.mjs
git commit -m "test(importacion): runner con node --test y normalizacion de slugs"
```

---

## Tarea 2: Parser del front matter

**Files:**
- Modify: `tests/markdown-import.test.mjs`
- Modify: `strapi/scripts/lib/markdown-import.mjs`

- [x] **Step 1: Test fallante con el front matter real de un borrador**

Adjuntar a `tests/markdown-import.test.mjs` (añadir `parseFrontMatter` al `import` de arriba):

```js
test('parseFrontMatter: scalares y listas en línea del export de WordPress', () => {
  const bruto = `---
title: "Caso: La finca de Don Manuel"
date: 2026-05-25
slug: caso-la-finca-de-don-manuel
categories: ["Proyectos Realizados"]
tags: ["meliponas", "finca tolima"]
source: wordpress
---

# Caso: La finca de Don Manuel
`;
  const { data, body } = parseFrontMatter(bruto);
  assert.equal(data.title, 'Caso: La finca de Don Manuel');
  assert.equal(data.date, '2026-05-25');
  assert.equal(data.slug, 'caso-la-finca-de-don-manuel');
  assert.deepEqual(data.categories, ['Proyectos Realizados']);
  assert.deepEqual(data.tags, ['meliponas', 'finca tolima']);
  assert.ok(body.startsWith('# Caso'), 'el cuerpo conserva el H1');
});

test('parseFrontMatter: sin front matter devuelve el texto intacto', () => {
  const { data, body } = parseFrontMatter('Solo un párrafo.');
  assert.deepEqual(data, {});
  assert.equal(body, 'Solo un párrafo.');
});
```

- [x] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/*.test.mjs`
Expected: `parseFrontMatter is not exported` / `SyntaxError` de import. 

- [x] **Step 3: Implementar**

Añadir a `strapi/scripts/lib/markdown-import.mjs`:

```js
/** Front matter YAML en el subconjunto que emite el export: scalares y listas en línea. */
export function parseFrontMatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { data: {}, body: texto };
  const data = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linea);
    if (kv) data[kv[1]] = parsearValor(kv[2]);
  }
  return { data, body: texto.slice(m[0].length) };
}

function parsearValor(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const q = /^"([\s\S]*)"|'([\s\S]*)'/.exec(v);
  if (q) return q[1] ?? q[2];
  return v;
}
```

- [x] **Step 4: Ejecutar y ver que pasa**

Run: `node --test tests/*.test.mjs` → Expected: `pass 3`.

- [x] **Step 5: Commit**

```bash
git add tests/markdown-import.test.mjs strapi/scripts/lib/markdown-import.mjs
git commit -m "feat(importacion): parser de front matter del export de WordPress"
```

---

## Tarea 3: Limpieza del cuerpo, extracto y tiempo de lectura

**Files:**
- Modify: `tests/markdown-import.test.mjs`
- Modify: `strapi/scripts/lib/markdown-import.mjs`

- [x] **Step 1: Tests fallantes**

Añadir al test (extender el `import` con `quitarPlaceholders`, `extraerExtracto`, `calcularTiempoLectura`):

```js
test('quitarPlaceholders: borra el aviso de imagen sugerida y los hotlinks muertos', () => {
  const bruto = [
    'Párrafo uno que habla del corredor y sus nidos.',
    '',
    '![Imagen sugerida: vista general de la finca de Don Manuel. Sin personas.]()',
    '',
    '![caja de cria](https://tienda.iwage.co/wp-content/uploads/2026/05/img_3091.jpeg)',
    '',
    'Párrafo dos, el que sigue después de lo que sobraba.',
  ].join('\n');
  const limpio = quitarPlaceholders(bruto);
  assert.ok(!/Imagen sugerida/i.test(limpio));
  assert.ok(!/tienda\.iwage\.co/.test(limpio));
  assert.ok(limpio.includes('Párrafo uno') && limpio.includes('Párrafo dos'));
  assert.ok(!/\n{3,}/.test(limpio), 'sin saltos triples');
});

test('extraerExtracto: primer párrafo real, sin títulos ni liga, cortado en palabra', () => {
  const bruto =
    '# Título\n\n![Imagen sugerida: x]()\n\n' +
    'Don Manuel llega a la finca algunas mañanas de la semana y camina la hectárea que es suya, ' +
    'entre el cafetal con sombrío de guamo y el bosque nativo que bordea el río.';
  const e = extraerExtracto(bruto, 120);
  assert.ok(e.length <= 121, `corto (${e.length})`);
  assert.ok(!e.includes('#'));
  assert.ok(e.endsWith('…'));
});

test('calcularTiempoLectura: 220 palabras por minuto, mínimo 1', () => {
  assert.equal(calcularTiempoLectura('una dos tres'), 1);
  assert.equal(calcularTiempoLectura(Array(441).fill('pal').join(' ')), 2);
});
```

- [x] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/*.test.mjs` → Expected: 3 fallos por exportaciones inexistentes.

- [x] **Step 3: Implementar**

```js
/** Quita los placeholders de imagen sugerida y las imágenes alojadas en el WordPress borrado. */
export function quitarPlaceholders(cuerpo) {
  return cuerpo
    .replace(/^!\[[^\]]*Imagen sugerida[^\]]*\]\([^)]*\)\s*$/gim, '')
    .replace(/^!\[[^\]]*\]\(https?:\/\/[^)]*tienda\.iwage\.co[^)]*\)\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Primer párrafo utilizable: descarta títulos, imágenes y bloques sueltos de separación. */
export function extraerExtracto(cuerpo, max = 200) {
  for (const bloque of cuerpo.split(/\n{2,}/)) {
    const t = bloque.trim();
    if (!t || /^(#|!\[|\||-{3,}|\* \* \*)/.test(t)) continue;
    const limpio = t
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (limpio.length < 40) continue;
    if (limpio.length <= max) return limpio;
    const corte = limpio.lastIndexOf(' ', max);
    return limpio.slice(0, corte > 60 ? corte : max) + '…';
  }
  return '';
}

export function calcularTiempoLectura(cuerpo) {
  const palabras = (cuerpo.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(palabras / 220));
}
```

`tienda.iwage.co` queda literal en la segunda expresión regular: es el dominio del WordPress que ya no resuelve. Si algún día se recupera una de esas dos imágenes, la regla correcta es subirla a `public/images/bitacora/` como `.webp`, no reactivar el hotlink.

- [x] **Step 4: Ejecutar y ver que pasa**

Run: `node --test tests/*.test.mjs` → Expected: `pass 6`.

- [x] **Step 5: Commit**

```bash
git add tests/markdown-import.test.mjs strapi/scripts/lib/markdown-import.mjs
git commit -m "feat(importacion): limpieza de placeholders, extracto y tiempo de lectura"
```

---

## Tarea 4: Mapeo de borrador a registro Strapi

**Files:**
- Modify: `tests/markdown-import.test.mjs`
- Modify: `strapi/scripts/lib/markdown-import.mjs`

- [x] **Step 1: Tests fallantes**

`aRegistroBitacora(texto, marca)` es la única función que conoce el esquema de Strapi; todo lo demás son piezas. El slug se toma del `slug:` del front matter y no del título: `limpiarSlug` solo le quita la fecha de WordPress. Son 37 slugs únicos en `Meliponario` (verificado con `grep -h '^slug:' | uniq -d` → vacío) y los títulos sí se repiten, así que derivar el slug del título sería arriesgarse a choques. La Tarea 4 Step 5 comprueba que la normalización no los vuelva contra una colisión.

```js
test('aRegistroBitacora: carpeta manda la marca, no la categoría', () => {
  const texto = `---
title: "Método de extracción en frío"
date: 2026-04-11
slug: cafe-frio-2026-04-11
categories: ["Café Iwagé"]
tags: ["cold brew"]
source: wordpress
---

# Método de extracción en frío

El cold brew no es café frío: es una extracción distinta, y la molienda manda.
`;
  const r = aRegistroBitacora(texto, 'meliponas');
  assert.equal(r.slug, 'cafe-frio');
  assert.ok(!r.contenido.startsWith('#'), 'el H1 del .md no se repite en el contenido');
  assert.equal(r.marca, 'meliponas');
  assert.equal(r.categoria, 'Café Iwagé');
  assert.equal(r.fecha, '2026-04-11');
  assert.deepEqual(r.etiquetas, ['cold brew']);
  assert.equal(r.publicado, false);
  assert.ok(!r.contenido.startsWith('---'));
});

test('aRegistroBitacora: Sin categoría queda null y sin tags no hay etiquetas', () => {
  const texto = '---\ntitle: "X"\ndate: 2026-01-02\nslug: x\ncategories: ["Sin categoría"]\nsource: wordpress\n---\n\n# X\n\nUn párrafo que mide más de cuarenta caracteres para que sirva de extracto real.';
  const r = aRegistroBitacora(texto, 'meliponas');
  assert.equal(r.categoria, null);
  assert.equal(r.slug, 'x');
  assert.ok(Array.isArray(r.etiquetas) && r.etiquetas.length === 0);
});
```

- [x] **Step 2: Ejecutar y ver que falla** → Expected: `aRegistroBitacora is not exported`.

- [x] **Step 3: Implementar**

```js
/** Convierte el texto de un .md exportado en el payload de `bitacoras`. */
export function aRegistroBitacora(texto, marca) {
  const { data, body } = parseFrontMatter(texto);
  const contenido = quitarPlaceholders(body)
    .replace(/^#\s+.*\n+/, '')            // el H1 lo pone la plantilla; en el cuerpo duplica
    .trim();
  const categorias = (data.categories ?? []).filter((c) => c && c !== 'Sin categoría');
  const titulo = (data.title || data.slug || '').trim();
  return {
    titulo,
    slug: limpiarSlug(data.slug || titulo),
    extracto: extraerExtracto(contenido),
    contenido,
    categoria: categorias[0] ?? null,
    tiempo_lectura: calcularTiempoLectura(contenido),
    imagen: null,
    fecha: data.date || null,
    marca,
    destacado: false,
    publicado: false,
    etiquetas: (data.tags ?? []).slice(0, 8),
    meta_title: titulo.slice(0, 60),
    meta_description: extraerExtracto(contenido).slice(0, 155),
  };
}
```

- [x] **Step 4: Ejecutar y ver que pasa** → Expected: `pass 8`.

- [x] **Step 5: Prueba contra los 37 archivos reales** (sin escribir nada, sin red)

Run:
```bash
cd /home/ubuntu/negocio/data/app_iwage && node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
import { aRegistroBitacora } from "./strapi/scripts/lib/markdown-import.mjs";
const marca = new Map([["Meliponario","meliponas"],["Granja","granja"]]);
const vistos = new Map();
let n = 0;
for (const [carpeta, m] of marca) {
  for (const f of readdirSync(`Publicaciones/${carpeta}`).filter((x) => x.endsWith(".md"))) {
    const r = aRegistroBitacora(readFileSync(`Publicaciones/${carpeta}/${f}`, "utf8"), m);
    const fallos = [];
    if (!r.titulo) fallos.push("sin titulo");
    if (!r.slug) fallos.push("sin slug");
    if (!r.extracto) fallos.push("sin extracto");
    if (r.slug !== r.slug.toLowerCase()) fallos.push("slug mayusculas");
    if (/\s/.test(r.slug)) fallos.push("slug con espacios");
    if (fallos.length) console.log(`  ${f}: ${fallos.join(", ")}`);
    if (vistos.has(r.slug)) console.log(`  COLISIÓN ${r.slug}: ${vistos.get(r.slug)} y ${carpeta}/${f}`);
    else vistos.set(r.slug, `${carpeta}/${f}`);
    n += 1;
  }
}
console.log(`${n} archivos revisados, ${vistos.size} slugs distintos`);'
```
Expected: `56 archivos revisados, 56 slugs distintos` y ninguna línea de fallo ni de colisión. Esta es la comprobación que no se pudo hacer al escribir el plan (el módulo todavía no existía): si `vistos.size` sale menor que `n`, dos borradores chocan después de quitarles la fecha y hay que desambiguar uno a mano en el front matter antes de importar nada. Con `sin extracto`, afilar `extraerExtracto` contra ese archivo antes de seguir — es la señal de que ese borrador empieza con algo que la regla no contempla.

- [x] **Step 6: Commit**

```bash
git add tests/markdown-import.test.mjs strapi/scripts/lib/markdown-import.mjs
git commit -m "feat(importacion): mapeo de borrador a registro de bitácora"
```

---

## Tarea 5: Ampliar el esquema de `bitacora` en Strapi

**Files:**
- Modify: `strapi/src/api/bitacora/content-types/bitacora/schema.json`

Sin tests: es un cambio de esquema. La verificación es contra la API y la base de datos.

- [x] **Step 1: Añadir los campos**

En `attributes`, después de `"experimento"` (respetar el JSON existente; no reordenar nada):

```json
    "publicado": { "type": "boolean", "default": true },
    "autor": { "type": "string" },
    "etiquetas": { "type": "json" },
    "fecha_actualizacion": { "type": "date" },
    "meta_title": { "type": "string" },
    "meta_description": { "type": "text" }
```

`publicado` con `default: true` es deliberado: las 19 entradas de granja que ya existen deben seguir visibles después de la migración. Un `default: false` las escondería del sitemap sin que nadie lo pida.

- [x] **Step 2: Reconstruir y reiniciar Strapi — CHECKPOINT**

Strapi valida el esquema al arrancar. **Pedir confirmación al usuario antes de ejecutar**: reinicia un servicio compartido.

```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_strapi
```

- [x] **Step 3: Verificar que el esquema aplicó y que nada se escondió**

```bash
curl -s "http://127.0.0.1:1338/api/bitacoras?pagination%5BpageSize%5D=100&fields%5B0%5D=slug&fields%5B1%5D=publicado" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).data;console.log(`${d.length} entradas, ${d.filter(e=>e.publicado!==false).length} con publicado!=false`)})'
```
Expected: `19 entradas, 19 con publicado!=false`. Si salen `publicado: undefined` en las 19, la columna existe pero quedó `null` para los registros viejos: aplicar el backfill del paso 4. Si salen 0 visibles, **detenerse**: la portada de granja desaparecería de la SERP.

**Verificado en producción (2026-09-24, tras `docker compose up -d --build iwage_strapi`):** el esquema aplicó, la API pública devuelve las 19 entradas, pero todas con `publicado: null` — Strapi aplica `default` solo al crear, nunca sobre filas que ya existían. El backfill del paso 4 **sí** hace falta, y mientras no corra, el filtro de la Tarea 8 no puede ser `publicado: true` porque escondería la bitácora de granja completa de la SERP.

- [x] **Step 4: Backfill explícito solo si hace falta**

El token se saca del `.env` del despliegue y se usa **dentro** del contenedor de la app, que ya lo tiene en su entorno: nunca se imprime ni va en la línea de comandos.

```bash
cd /home/ubuntu/negocio && docker exec -i iwage_web node --input-type=module -e '
const t = process.env.STRAPI_API_TOKEN;
if (!t || t.length < 20) { console.error("STRAPI_API_TOKEN ausente o corto: no continúe"); process.exit(1); }
const h = { "Content-Type": "application/json", Authorization: "Bearer " + t };
const u = "http://iwage_strapi:1337/api/bitacoras";
const lista = await (await fetch(u + "?pagination%5BpageSize%5D=100&fields%5B0%5D=documentId&fields%5B1%5D=slug&fields%5B2%5D=publicado", { headers: h })).json();
let n = 0;
for (const e of lista.data) {
  if (e.publicado === true) continue;
  const r = await fetch(u + "/" + e.documentId, { method: "PUT", headers: h, body: JSON.stringify({ data: { publicado: true } }) });
  if (r.ok) n += 1; else console.error("falló", e.slug, r.status);
}
console.log("backfill a publicado=true en", n, "de", lista.data.length);
'
```

Volver al paso 3 y confirmar `19 entradas, 19 con publicado!=false`.

- [x] **Step 5: Commit**

```bash
git add strapi/src/api/bitacora/content-types/bitacora/schema.json
git commit -m "feat(strapi): bitacora gana publicado, autor, etiquetas y metadatos SEO"
```

---

## Tarea 6: CLI de importación idempotente

> **Corregido tras ver el esquema:** `bitacora` tiene `draftAndPublish: true`, así que `crear` manda además `publishedAt` en el payload, el truco ya probado en `strapi/scripts/seed-granja.mjs:139`. Sin eso los registros quedarían en borrador de Strapi, y con el token actual los borradores no se vuelven a leer (`?status=draft` devuelve los mismos 19) ni hay forma probada de publicarlos. Quién esconde el artículo es `publicado: false`, no el estado de Strapi.

**Files:**
- Create: `strapi/scripts/importar-bitacora.mjs`

- [x] **Step 1: Escribir el script**

```js
/**
 * Importa Publicaciones/<carpeta>/*.md a la colección `bitacoras` de Strapi.
 *
 *   STRAPI_URL=http://127.0.0.1:1338 STRAPI_API_TOKEN=… \
 *     node strapi/scripts/importar-bitacora.mjs Meliponario --marca meliponas [--dry-run|--publicar]
 *
 * Idempotente por slug: lo que ya existe no se toca (ni su contenido ni su `publicado`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { aRegistroBitacora } from './lib/markdown-import.mjs';

const argv = process.argv.slice(2);
const carpeta = argv.find((a) => !a.startsWith('--'));
const marca = argv[argv.indexOf('--marca') + 1];
const modoPublicar = argv.includes('--publicar');
const dryRun = argv.includes('--dry-run');
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1338';
const TOKEN = process.env.STRAPI_API_TOKEN || '';

if (!carpeta || !marca) {
  console.error('uso: importar-bitacora.mjs <carpeta> --marca <slug> [--dry-run|--publicar]');
  process.exit(2);
}
if (!dryRun && TOKEN.length < 20) {
  console.error('STRAPI_API_TOKEN no está en el entorno (se mide la longitud, nunca se imprime)');
  process.exit(2);
}

const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function slugsExistentes() {
  const vistos = new Set();
  for (let page = 1; ; page += 1) {
    const res = await fetch(
      `${STRAPI_URL}/api/bitacoras?pagination%5Bpage%5D=${page}&pagination%5BpageSize%5D=100&fields%5B0%5D=slug`,
      { headers: cabeceras },
    );
    if (!res.ok) throw new Error(`lectura falló: HTTP ${res.status}`);
    const json = await res.json();
    (json.data || []).forEach((e) => vistos.add(e.slug));
    if (page * 100 >= (json.meta?.pagination?.total ?? 0)) break;
  }
  return vistos;
}

async function crear(data) {
  const res = await fetch(`${STRAPI_URL}/api/bitacoras`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ data: { ...data, publishedAt: new Date().toISOString() } }),
  });
  if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 180)}` };
  return { ok: true, documentId: (await res.json()).data.documentId };
}

async function publicar(documentId) {
  const res = await fetch(`${STRAPI_URL}/api/bitacoras/${documentId}`, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify({ data: { publicado: true } }),
  });
  return res.ok;
}

/** --publicar no crea nada: saca del escondite lo que ya importamos oculto. */
async function publicarPendientes(slugsCarpeta) {
  const lista = await (
    await fetch(
      `${STRAPI_URL}/api/bitacoras?pagination%5BpageSize%5D=100&filters%5Bmarca%5D%5B%24eq%5D=${marca}&filters%5Bpublicado%5D%5B%24eq%5D=false&fields%5B0%5D=slug&fields%5B1%5D=documentId`,
      { headers: cabeceras },
    )
  ).json();
  const pendientes = (lista.data || []).filter((e) => slugsCarpeta.has(e.slug));
  let ok = 0;
  for (const e of pendientes) {
    if (dryRun) {
      console.log(`  [dry] publicaría ${e.slug}`);
      continue;
    }
    if (await publicar(e.documentId)) ok += 1;
    else console.error(`  ✗ ${e.slug}`);
  }
  console.log(`\npublicadas=${ok} pendientes=${pendientes.length} en Strapi sin publicar para ${marca}`);
  if (!dryRun && ok !== pendientes.length) process.exit(1);
  return;
}

const slugsCarpeta = new Set(
  readdirSync(`Publicaciones/${carpeta}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => aRegistroBitacora(readFileSync(`Publicaciones/${carpeta}/${f}`, 'utf8'), marca).slug),
);

if (modoPublicar) {
  await publicarPendientes(slugsCarpeta);
  process.exit(0);
}

const existentes = await slugsExistentes();
const archivos = readdirSync(`Publicaciones/${carpeta}`).filter((f) => f.endsWith('.md')).sort();
console.log(`${archivos.length} archivos en Publicaciones/${carpeta}, ${existentes.size} entradas en Strapi`);

let creados = 0, omitidos = 0, fallidos = 0;
for (const archivo of archivos) {
  const registro = aRegistroBitacora(readFileSync(`Publicaciones/${carpeta}/${archivo}`, 'utf8'), marca);
  if (existentes.has(registro.slug)) {
    omitidos += 1;
    continue;
  }
  if (dryRun) {
    console.log(`  [dry] ${registro.slug} · ${registro.tiempo_lectura} min · ${registro.etiquetas.length} tags · extracto ${registro.extracto.length} car`);
    creados += 1;
    continue;
  }
  const r = await crear(registro);
  if (!r.ok) {
    fallidos += 1;
    console.error(`  ✗ ${registro.slug}: ${r.error}`);
    continue;
  }
  creados += 1;
  console.log(`  ✓ ${registro.slug} (sin publicar)`);
}

console.log(`\ncreados=${creados} omitidos=${omitidos} fallidos=${fallidos}`);
if (fallidos > 0) process.exit(1);
```

`crear` siempre manda `publicado: false` porque `aRegistroBitacora` ya lo trae: no hay una ruta del script que publique por accidente sin `--publicar`.

- [x] **Step 2: Dry run — no toca nada**

Run:
```bash
cd /home/ubuntu/negocio && set -a && . ./.env && set +a && cd data/app_iwage && \
  STRAPI_API_TOKEN="$IWAGE_STRAPI_API_TOKEN" node strapi/scripts/importar-bitacora.mjs Meliponario --marca meliponas --dry-run
```
El `--dry-run` no escribe, pero sí lee los slugs existentes por la API, y esa lectura va autenticada: por eso el token va igual. No se imprime en ningún momento.

Expected: `37 archivos en Publicaciones/Meliponario, 19 entradas en Strapi`, 37 líneas `[dry]`, y `creados=37 omitidos=0 fallidos=0`. Cualquier `omitidos>0` aquí significa colisión de slug con granja: detener y revisar antes de crear nada.

- [x] **Step 3: Dry run sobre Granja, que debe ser vacío**

Run: `cd /home/ubuntu/negocio && set -a && . ./.env && set +a && cd data/app_iwage && STRAPI_API_TOKEN="$IWAGE_STRAPI_API_TOKEN" node strapi/scripts/importar-bitacora.mjs Granja --marca granja --dry-run`
Expected: `creados=0 omitidos=19 fallidos=0`. Esta línea es la prueba de seguridad de todo el plan: `limpiarSlug` tiene que ser no-op sobre un slug ya limpio, porque los 19 de granja están en Strapi con el slug exacto del export. Si sale `creados>0`, la normalización está deformando slugs y el importador duplicaría contenido existente — detener y arreglar la función, no publicar.

- [x] **Step 4: Commit**

```bash
git add strapi/scripts/importar-bitacora.mjs
git commit -m "feat(importacion): CLI idempotente para pasar borradores a bitacoras"
```

---

## Tarea 7: Importar los 37 en modo oculto

> **Orden corregido:** esta tarea se ejecuta DESPUÉS de la Tarea 8. El filtro que respeta `publicado` vive en la app; si se importa primero, `getBitacoraByMarca` (aún sin filtro) metería los 37 en el índice y en el sitemap.

**Files:** ninguno (datos).

- [x] **Step 1: Verificar que la portada de meliponas sigue vacía antes de empezar**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://iwage.co/meliponas/bitacora?cb=$RANDOM"` y `curl -s "https://iwage.co/meliponas/bitacora?cb=$RANDOM" | grep -o 'content="[^"]*"' | head -1`
Expected: `200` y `content="noindex, follow"`. Es la línea base: al final debe ser `index, follow`.

- [x] **Step 2: Importar — CHECKPOINT**

Escribe en la base de datos de producción (aunque con `publicado: false`, no visible). **Confirmar con el usuario.**

```bash
cd /home/ubuntu/negocio && set -a && . ./.env && set +a && cd data/app_iwage && \
  STRAPI_API_TOKEN="$IWAGE_STRAPI_API_TOKEN" node strapi/scripts/importar-bitacora.mjs Meliponario --marca meliponas
```
Expected: `creados=37 omitidos=0 fallidos=0`. El token se referencia por nombre de variable, no por valor: no se imprime, no queda en el historial de la shell y no aparece en `ps`.

- [x] **Step 3: Verificar en la API, filtrando por publicado**

Run:
```bash
curl -s "http://127.0.0.1:1338/api/bitacoras?pagination%5BpageSize%5D=100&filters%5Bmarca%5D%5B%24eq%5D=meliponas" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).data;
  console.log(`${d.length} meliponas, ocultas=${d.filter(e=>e.publicado===false).length}, con extracto=${d.filter(e=>e.extracto).length}, con tags=${d.filter(e=>(e.etiquetas||[]).length).length}, sin slug roto=${d.filter(e=>/^https?:|\.md$|\s/.test(e.slug)).length}`)})'
```
Expected: `37 meliponas, ocultas=37, con extracto=37, con tags=21, sin slug roto=0`.

- [x] **Step 4: Confirmar que la calle sigue igual**

Run: `curl -s "https://iwage.co/sitemap.xml?cb=$RANDOM" | grep -c "<loc>"`

Aquí hay dos resultados posibles y ambos informan, porque no está resuelto si el token de API de Strapi ve o no contenido sin publicar:

- **`152`** — Strapi ya está filtrando lo no publicado. El filtro de la Tarea 8 es higiene, y se puede publicar cuando toque.
- **`189`** — Strapi está sirviendo las 37 ocultas al token y la Tarea 8 deja de ser opcional: **no ejecutar la Tarea 10** hasta desplegar el filtro, y entonces volver a medir aquí para confirmar que bajó a 152.

Cualquier otro número es un fallo real y hay que detenerse.

- [x] **Step 5: Commit** (no hay código; se ancla el estado del repo)

El ancla ya está puesta con `52107ac` (tareas 5 a 9 ejecutadas, 37 importadas ocultas), así que no hace falta un commit vacío aparte.

```bash
git commit --allow-empty -m "docs(importacion): 37 borradores de meliponas cargados como no publicados"
```

---

## Tarea 8: Que la capa de lectura respete `publicado` (y arreglar `dateModified`)

> **Pasa a ser la primera tarea con efectos:** su despliegue debe estar arriba antes de que exista un solo registro con `publicado: false`, y requiere hecho el backfill de la Tarea 5 paso 4.

**Files:**
- Modify: `src/lib/bitacora.ts:7-21` (interfaz), `:27-44`, `:48-58`, `:62-73`
- Modify: `src/lib/sitemap.ts` (fuente `bitacoras`)

- [x] **Step 1: Extender la interfaz**

En `EntradaBitacora`, después de `destacado: boolean;`:

```ts
  publicado: boolean;
  autor: string | null;
  etiquetas: string[] | null;
  fecha_actualizacion: string | null;
  meta_title: string | null;
  meta_description: string | null;
  updatedAt: string;
```

`updatedAt` faltaba y ya se leía en `meliponas/bitacora/[slug].astro:36` — por eso `dateModified` del JSON-LD caía siempre a `fecha`.

- [x] **Step 2: Filtrar en los tres fetchers**

En `getBitacoraByMarca`, el objeto `filters`:

```ts
      filters: { marca: { $eq: marca }, publicado: { $eq: true } },
```

En `getBitacoraBySlug`:

```ts
      filters: { slug: { $eq: slug }, publicado: { $eq: true } },
```

En `getAllBitacoraSlugs`:

```ts
      filters: { publicado: { $eq: true } },
```

- [x] **Step 3: Mismo filtro en la fuente del sitemap**

En `src/lib/sitemap.ts`, la llamada a `fetchAllSlugs('bitacoras', …)` pasa de `void 0` a filtro explícito, para que el criterio no dependa de que Strapi publique solo:

```ts
    fetchAllSlugs('bitacoras', { publicado: { $eq: true } }, failed),
```

- [x] **Step 4: Compilar**

Run: `cd /home/ubuntu/negocio && docker compose build iwage_app`
Expected: `astro build` termina sin errores. Si `tsc`/`astro check` no está disponible en la imagen, el build es la verificación — no declarar un chequeo de tipos que no se corrió.

- [x] **Step 5: Desplegar y verificar en la calle — CHECKPOINT**

Recrea `iwage_app`. **Pedir confirmación.**

```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_app && sleep 10
docker exec redis_app redis-cli --scan --pattern 'iwage:*' | xargs -r -n50 docker exec -i redis_app redis-cli DEL > /dev/null
printf "portada meliponas : %s\n" "$(curl -s -o /dev/null -w '%{http_code}' 'https://iwage.co/meliponas/bitacora?cb=1')"
printf "artículo oculto   : %s -> %s\n" "$(curl -s -o /dev/null -w '%{http_code}' 'https://iwage.co/meliponas/bitacora/caso-la-finca-de-don-manuel?cb=1')" \
  "$(curl -s -o /dev/null -w '%{redirect_url}' 'https://iwage.co/meliponas/bitacora/caso-la-finca-de-don-manuel?cb=1')"
printf "artículo de granja: %s\n" "$(curl -s -o /dev/null -w '%{http_code}' 'https://iwage.co/granja/bitacora/cuaderno-campo?cb=1')"
```
Expected: portada `200`, oculto `302 -> https://iwage.co/meliponas/bitacora` (`getBitacoraBySlug` devuelve null y la página hace `Astro.redirect` a la portada: no es un 404, y es el comportamiento correcto), y granja `200`. Si el oculto da `200`, el filtro `publicado` no está aplicando: **no publicar todavía** y volver al paso 2.

- [x] **Step 5b: Comprobar que el filtro llega al sitemap**

Run: `curl -s "https://iwage.co/sitemap.xml?cb=$RANDOM" | grep -c "<loc>"`
Expected: `152`. Este es el control duro: las 37 existen en la base de datos pero no deben aparecer en ningún listado público.

- [x] **Step 6: Commit**

```bash
git add src/lib/bitacora.ts src/lib/sitemap.ts
git commit -m "fix(bitacora): respeta publicado y expone los metadatos nuevos (dateModified real)"
```

---

## Tarea 9: Metadatos por marca y JSON-LD completo

**Files:**
- Create: `src/config/bitacora-marcas.ts`
- Modify: `src/pages/{cafe,gestion,granja,meliponas,naturaleza,tierras}/bitacora/[slug].astro` (las 6, mismo cambio)
- Modify: `src/layouts/BrandLayout.astro:12-21` (`ArticleMeta`) y `:139-160` (nodo `Article`)

- [x] **Step 1: Config compartida**

```ts
/** Constantes de la bitácora por marca. Una fila por marca, seis páginas la consumen. */
export interface BitacoraMarca {
  slug: string;
  nombre: string;
  autor: string;
  lugar: string;
  icono: string;
}

export const BITACORA_MARCAS: Record<string, BitacoraMarca> = {
  meliponas: { slug: 'meliponas', nombre: 'Iwagé Meliponario', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Pijao, Quindío, Colombia', icono: 'hexagon' },
  cafe: { slug: 'cafe', nombre: 'Café Iwagé', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Ambalá, Ibagué, Tolima, Colombia', icono: 'coffee' },
  granja: { slug: 'granja', nombre: 'Iwagé Granja', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Ambalá, Ibagué, Tolima, Colombia', icono: 'leaf' },
  tierras: { slug: 'tierras', nombre: 'Iwagé Tierras', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Ambalá, Ibagué, Tolima, Colombia', icono: 'map' },
  naturaleza: { slug: 'naturaleza', nombre: 'Iwagé Naturaleza', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Ambalá, Ibagué, Tolima, Colombia', icono: 'tree-pine' },
  gestion: { slug: 'gestion', nombre: 'Iwagé Gestión', autor: 'Manuel Camilo Saldarriaga Acosta', lugar: 'Ibagué, Tolima, Colombia', icono: 'building' },
};
```

Antes de escribir el archivo, abrir una de las 6 páginas y **copiar los valores que ya usa cada una** (`BRAND_NAME`, `AUTHOR`, `LOCATION`, `ICON`): si alguna marca tiene otro autor u otro lugar, ese valor manda en la tabla. El icono debe ser un nombre que exista en `src/components/shared/Icon.astro`.

- [x] **Step 2: `ArticleMeta` con lo nuevo**

En `src/layouts/BrandLayout.astro`, dentro de `interface ArticleMeta`, tras `wordCount?: number;`:

```ts
  keywords?: string[];
  authorUrl?: string;
  authorPlace?: string;
```

Y dentro del nodo `Article` del `jsonLdGraph`, sustituir el bloque `author` fijo y añadir lo que faltaba:

```ts
    "author": {
      "@type": "Person",
      "name": a.author || "Manuel Camilo Saldarriaga Acosta",
      "url": a.authorUrl || "https://camilosaldarriaga.com",
      ...(a.authorPlace && { "address": { "@type": "PostalAddress", "addressLocality": a.authorPlace } })
    },
    ...(a.keywords?.length && { "keywords": a.keywords.join(', ') }),
```

- [x] **Step 3: Las 6 páginas leen la config**

En cada `src/pages/<marca>/bitacora/[slug].astro`, reemplazar las cinco constantes literales (`BRAND`, `BRAND_NAME`, `AUTHOR`, `LOCATION`, `ICON`) por:

```ts
import { BITACORA_MARCAS } from '@/config/bitacora-marcas';
const MARCA = BITACORA_MARCAS['<marca>'];
const BRAND = MARCA.slug;
```

y actualizar los usos (`BRAND_NAME` → `MARCA.nombre`, `AUTHOR` → `MARCA.autor`, `LOCATION` → `MARCA.lugar`, `ICON` → `MARCA.icono`).

- [x] **Step 4: Pasar lo nuevo en `articleMeta`**

En el objeto `articleMeta` de cada página, reemplazar las dos líneas rotas y añadir los tags:

```ts
  dateModified: article.fecha_actualizacion || article.updatedAt || article.fecha,
  author: article.autor || MARCA.autor,
  authorPlace: MARCA.lugar,
  keywords: (article.etiquetas ?? []).slice(0, 8),
```

Y en el `<BrandLayout …>` de esas páginas, usar los metadatos si existen:

```ts
  title={`${article.meta_title || article.titulo} · ${MARCA.nombre}`}
  description={article.meta_description || article.extracto || article.titulo}
```

- [x] **Step 5: Compilar y ver el HTML de un artículo publicado**

Sin publicar todavía no hay artículo meliponas que renderizar; usar uno de granja:

```bash
cd /home/ubuntu/negocio && docker compose build iwage_app && docker compose up -d iwage_app
sleep 8 && curl -s "https://iwage.co/granja/bitacora/meliponario-iwage-subsistema-vivo?cb=$RANDOM" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const m=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(s);
  const g=JSON.parse(m[1]);
  const a=(g['@graph']||[g]).find((x)=>x['@type']==='Article');
  console.log('Article en el graph:', a?'sí':'NO');
  console.log('  dateModified:', a?.dateModified);
  console.log('  author.name :', a?.author?.name, '· locality:', a?.author?.address?.addressLocality);
})'
```
Expected: `Article en el graph: sí` y un `dateModified` distinto de `undefined` (sale de `updatedAt`).

**Ojo al verificar (aprendido ejecutando):** `BrandLayout` no emite un solo `@graph`, son cuatro bloques `ld+json` sueltos (Organization, Person, BreadcrumbList, Article). Leer el primer bloque da `Article en el graph: NO` aunque esté. El `Article` es el ultimo bloque, o el unico que trae `headline`.


**Desviaciones ejecutadas (2026-09-24), las dos a favor de no tocar lo que ya funciona:**

1. El paso 3 se aplicó solo en `meliponas` y `granja`. El supuesto de que las seis páginas son idénticas es falso: `cafe` renderiza `{ICON}` como texto (muestra la palabra "coffee" en el avatar), `granja` no tiene `ICON`, y autor y lugar difieren por marca. Convertir las otras cuatro en lectoras de la config era mover código que ningún criterio de aceptación pide. Las cuatro siguen con sus constantes literales y la config es la fuente para las dos marcas que publican en esta fase.

2. El paso 4 no reemplaza el autor del JSON-LD por el nombre del equipo: `author` sigue siendo la persona (`article.autor || 'Manuel Camilo Saldarriaga Acosta'`) porque un `Person` con nombre real y `url` vale más para E-E-A-T que "Equipo Iwagé Meliponario". El byline visible de la página sí sigue con `MARCA.autor`.
- [x] **Step 6: Commit**

```bash
git add src/config/bitacora-marcas.ts src/layouts/BrandLayout.astro src/pages/*/bitacora/\[slug\].astro
git commit -m "feat(bitacora): metadatos por marca compartidos y Article con autor, lugar y keywords"
```

---

## Tarea 10: Publicar y avisar a los rastreadores

- [ ] **Step 1: Publicar los 37 — CHECKPOINT**

Es el punto sin retorno: entran a la SERP. **Confirmar con el usuario.**

Primero el ensayo, que no escribe:

```bash
cd /home/ubuntu/negocio && set -a && . ./.env && set +a && cd data/app_iwage && \
  STRAPI_API_TOKEN="$IWAGE_STRAPI_API_TOKEN" node strapi/scripts/importar-bitacora.mjs Meliponario --marca meliponas --publicar --dry-run
```
Expected: 37 líneas `[dry] publicaría …` y `publicadas=0 pendientes=37 …`. En seco no publica nada, así que el conteo de publicadas queda en 0 por definición.

Y entonces, **con confirmación del usuario**, el mismo comando sin `--dry-run`:
Expected: `publicadas=37 pendientes=37 en Strapi sin publicar para meliponas`.

- [ ] **Step 2: Purgar las cachés intermedias**

```bash
docker exec redis_app redis-cli --scan --pattern 'iwage:*' | xargs -r -n50 docker exec -i redis_app redis-cli DEL >/dev/null
docker exec iwage_web find /var/cache/nginx -name '*' -type f -delete 2>/dev/null
curl -s -o /dev/null -w "origen: %{http_code}\n" "http://127.0.0.1:4321/sitemap.xml"
```
Expected: `origen: 200`. Si la ruta de caché de nginx es otra, listar antes con `docker exec iwage_web ls /var/cache/nginx` en vez de borrar a ciegas.

- [ ] **Step 3: Comprobar los números finales**

```bash
echo -n "URLs sitemap: " && curl -s "https://iwage.co/sitemap.xml?cb=$RANDOM" | grep -c "<loc>"
echo -n "portada meliponas: " && curl -s "https://iwage.co/meliponas/bitacora?cb=$RANDOM" | grep -o 'name="robots" content="[^"]*"'
echo -n "artículo meliponas: " && curl -s -o /dev/null -w "%{http_code}\n" "https://iwage.co/meliponas/bitacora/caso-la-finca-de-don-manuel"
```
Expected: `189` (152 + 37), `content="index, follow"` (la portada se volteó sola, sin tocar código) y `200`.

> **Medido:** `189` y `56` en el sitemap sí, pero `/meliponas/bitacora` respondía **500 desde el origen**. La tarjeta de la portada usaba `<Icon name={ICON}>` y `ICON` nunca estuvo definido en `src/pages/meliponas/bitacora/index.astro` (arrastre de `da9765a`). Con el índice vacío el `.map` no corría nunca, así que la fase 1 --justo el estado "noindex porque no hay nada"-- tapó el fallo durante todo este tiempo. Arreglado en `6b26abb` tomando el icono de `BITACORA_MARCAS`, la misma fuente de la página de artículo.

- [ ] **Step 4: IndexNow directo y reindex del RAG**

El proxy propio `/api/indexnow` **no** sirve para esto: medido en el contenedor, `INDEXNOW_SECRET` y `INDEXNOW_KEY` vienen en longitud 0, o sea que su guardia cae en el valor por defecto que está escrito en `src/pages/api/indexnow.ts:15-16`. Usar ese default es parte de la deuda de la fase 3, no una solución. Se envía a `api.indexnow.org` con la llave que el propio sitio publica en `https://iwage.co/iwage-indexnow-2024-key.txt` (verificado: `HTTP 200`, 24 bytes):

```bash
cd /home/ubuntu/negocio/data/app_iwage && \
node --input-type=module -e '
const sm = await (await fetch("https://iwage.co/sitemap.xml")).text();
const urls = [...sm.matchAll(/<loc>(https:\/\/iwage\.co\/meliponas\/bitacora\/[^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length !== 37) { console.error("se esperaban 37 URLs, hay " + urls.length); process.exit(1); }
const r = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: "iwage.co",
    key: "iwage-indexnow-2024-key",
    keyLocation: "https://iwage.co/iwage-indexnow-2024-key.txt",
    urlList: urls,
  }),
});
console.log("IndexNow:", r.status, urls.length, "URLs");
process.exit(r.ok ? 0 : 1);
' && curl -s -o /dev/null -w "reindex RAG: %{http_code}\n" -X POST "https://iwage.co/api/reindex"
```
Expected: `IndexNow: 200 37 URLs` y `reindex RAG: 200`. El reindex le cuenta a la búsqueda interna y al índice RAG del sitio que existen 37 artículos nuevos; sin él, `/api/search` y el chat se quedan describiendo un Meliponario vacío.

- [ ] **Step 4b: Nota para la fase 3**

Anotar en el issue de la fase 3: `INDEXNOW_SECRET` y `REINDEX_SECRET` no están en `docker-compose.yml`, así que `/api/indexnow` se protege con un literal del repositorio y `/api/reindex` corre sin ninguna validación (reconstruye el índice quien lo pida). Endurecer ambos antes de abrir ningún otro endpoint.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "docs(contenido): 37 artículos de meliponas publicados, sitemap en 189 URLs"
```

---

## Tarea 11: `llms.txt` con números que salen de la base de datos

**Files:**
- Create: `src/content/llms-plantilla.txt` (desde `public/llms.txt`)
- Create: `src/lib/llms.ts`
- Create: `src/pages/llms.txt.ts`
- Delete: `public/llms.txt`
- Test: `tests/llms.test.mjs`

Hoy el archivo miente en tres líneas exactas: `125:- 50+ propiedades en portafolio (Tierras + Gestión)`, `128:- 76+ publicaciones en bitácora …`, `139:- Sitemap dinámico en /sitemap.xml (188+ URLs)`. Valores reales al cierre de la fase 2: **4 propiedades** (0 de `propiedades` + 4 de `propiedades-gestion`), **56 publicaciones**, **189 URLs**.

- [x] **Step 1: Mover y marcar la plantilla**

> **Ejecución — dos desviaciones del plan.** La plantilla quedó en `src/data/llms-plantilla.txt`, no en `src/content/`: ese directorio es el que Astro reserva para content collections, aquí no se usa ninguna, y un `.txt` suelto dentro solo siembra confusión. Y `total()` pide `CACHE_TTL.list` (300 s) en lugar del `3600` escrito a mano, porque la constante ya existe en `src/lib/strapi.ts`.

```bash
git mv public/llms.txt src/content/llms-plantilla.txt
```
Editar las tres líneas para que ya no afirmen nada:

```
- {{PROPIEDADES}} propiedades en portafolio (Tierras + Gestión)
- {{PUBLICACIONES}} publicaciones en bitácora (guías técnicas, territorio, sostenibilidad)
- Sitemap dinámico en /sitemap.xml ({{URLS}} URLs)
```

- [x] **Step 2: Test fallante del reemplazo**

`tests/llms.test.mjs`:

```js
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
```

Run: `npm test` → Expected: fallo por módulo inexistente. Que el test importe un `.ts` desde un `.mjs` no pide ningún flag: Node 22.23 en esta máquina trae el type stripping activado (verificado: `node --help` solo expone `--no-experimental-strip-types` como opt-out).

- [x] **Step 3: Implementar `src/lib/llms.ts`**

```ts
export interface ConteosLlms {
  propiedades: number;
  publicaciones: number;
  urls: number;
}

export function aplicarConteos(plantilla: string, c: ConteosLlms | Partial<ConteosLlms>): string {
  return plantilla
    .replace(/\{\{PROPIEDADES\}\}/g, String(c.propiedades ?? 0))
    .replace(/\{\{PUBLICACIONES\}\}/g, String(c.publicaciones ?? 0))
    .replace(/\{\{URLS\}\}/g, String(c.urls ?? 0));
}
```

Run: `npm test` → Expected: `pass 10`.

- [x] **Step 4: La ruta**

`src/pages/llms.txt.ts`:

```ts
/**
 * llms.txt generado: los conteos salen de Strapi en cada construcción, así que
 * no pueden volver a quedarse atrás como pasaba con la copia estática.
 */
import type { APIRoute } from 'astro';
import plantilla from '@/content/llms-plantilla.txt?raw';
import { aplicarConteos } from '@/lib/llms';
import { strapiFetch } from '@/lib/strapi';
import { collectSitemapUrls } from '@/lib/sitemap';

export const GET: APIRoute = async () => {
  const [bitacoras, tierras, gestion, urls] = await Promise.all([
    total('bitacoras', { publicado: { $eq: true } }),
    total('propiedades', { publicado: { $eq: true } }),
    total('propiedades-gestion', { publicado: { $eq: true } }),
    collectSitemapUrls().then((r) => r.urls.length),
  ]);
  return new Response(
    aplicarConteos(plantilla, {
      publicaciones: bitacoras,
      propiedades: tierras + gestion, // la línea del archivo habla de "portafolio (Tierras + Gestión)"
      urls,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
};

async function total(endpoint: string, filters: Record<string, unknown>): Promise<number> {
  try {
    const res = await strapiFetch<any>(endpoint, {
      ttl: 3600,
      cacheKey: `llms:total:${endpoint}`,
      filters,
      pagination: { page: 1, pageSize: 1 },
    });
    return res.meta?.pagination?.total ?? 0;
  } catch {
    return 0;
  }
}
```

`total()` devuelve 0 si Strapi falla: el archivo sale con un número bajo en vez de un 500. Es un compromiso consciente — preferible a no servir nada.

- [ ] **Step 5: Compilar, desplegar y verificar — CHECKPOINT** (recrea `iwage_web`)

```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_app && sleep 8
curl -s "https://iwage.co/llms.txt" | grep -nE "propiedades en portafolio|publicaciones en bitácora|sitemap.xml \(" && \
curl -s -o /dev/null -w "llms.txt: %{http_code} · content-type %{content_type}\n" "https://iwage.co/llms.txt"
```
Expected: las tres líneas con `4 propiedades`, `56 publicaciones`, `189 URLs`, y `200 text/plain`. Si sigue mostrando `50+`, es la caché de Cloudflare sobre el archivo viejo: purgar esa URL desde el panel.

- [ ] **Step 6: Commit**

```bash
git add src/content/llms-plantilla.txt src/lib/llms.ts src/pages/llms.txt.ts tests/llms.test.mjs package.json
git commit -m "fix(llms): llms.txt generado con conteos reales en lugar de cifras fijas falsas"
```

---

## Tarea 12: 301 de las rutas viejas de gestión

**Files:**
- Modify: `src/middleware.ts:14-23`

El sitemap de la fase 1 ya no anuncia `/gestion/propiedades`; las páginas se movieron a `/gestion/alojamientos`. Pero los enlaces viejos (y lo que Google llegó a tener) siguen pidiendo la ruta antigua y hoy mueren en 404.

- [x] **Step 1: Comprobar el estado actual**

Run:
```bash
for u in /gestion/propiedades /gestion/propiedades/alguna-cosa /gestion/alojamientos; do
  printf "%-34s %s\n" "$u" "$(curl -s -o /dev/null -w "%{http_code}" "https://iwage.co$u")"
done
```
Expected: `404 / 404 / 200`. Si el primero da 301 o 200, no hace falta nada: cerrar la tarea sin tocar código.

- [x] **Step 2: Añadir las dos reglas**

En `DYNAMIC_REDIRECTS`, justo antes del comentario de `/cafe/:anything`:

```ts
  // /gestion/propiedades → /gestion/alojamientos (las páginas se movieron en la migración)
  [/^\/gestion\/propiedades\/?$/, () => '/gestion/alojamientos'],
  [/^\/gestion\/propiedades\/([^/]+)\/?$/, (m) => `/gestion/alojamientos/${m[1]}`],
```

- [ ] **Step 3: Compilar y verificar — CHECKPOINT**

```bash
cd /home/ubuntu/negocio && docker compose up -d --build iwage_app && sleep 8
curl -s -o /dev/null -w "%{http_code} -> %header{location}\n" "https://iwage.co/gestion/propiedades"
```
Expected: `301 -> https://iwage.co/gestion/alojamientos`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "fix(redirects): /gestion/propiedades apunta a /gestion/alojamientos con 301"
```

---

## Tarea 13: Verificación integral y línea base de medición

Sin código nuevo: cerrar con números, para que la medición de 2–4 semanas tenga un antes y un después.

- [ ] **Step 1: Suite de tests verde**

Run: `npm test` → Expected: `pass 10`, `fail 0`.

- [ ] **Step 2: Los seis contratos de la fase 2, en una pasada**

```bash
chequear() { # $1 nombre · $2 esperado · $3 comando
  real=$(eval "$3" 2>/dev/null | tr -d '[:space:]')
  exp=$(printf '%s' "$2" | tr -d '[:space:]')
  if [ "$real" = "$exp" ]; then printf "  ok   %-26s %s\n" "$1" "$real"
  else printf "  MAL  %-26s esperaba %s · llegó %s\n" "$1" "$exp" "$real"; fi
}
cd /home/ubuntu/negocio/data/app_iwage
chequear "URLs en sitemap"        189          "curl -s 'https://iwage.co/sitemap.xml?cb=2' | grep -c '<loc>'"
chequear "artículos en sitemap"   56           "curl -s 'https://iwage.co/sitemap.xml?cb=2' | grep -c '/bitacora/'"
chequear "robots meliponas"      'name="robots" content="index, follow"' "curl -s 'https://iwage.co/meliponas/bitacora?cb=2' | grep -o 'name=\"robots\" content=\"[^\"]*\"'"
chequear "llms publicaciones"     "56 publicaciones" "curl -s 'https://iwage.co/llms.txt?cb=2' | grep -oE '[0-9]+ publicaciones'"
chequear "llms propiedades"       "4 propiedades"    "curl -s 'https://iwage.co/llms.txt?cb=2' | grep -oE '[0-9]+ propiedades'"
chequear "/gestion/propiedades"   301          "curl -s -o /dev/null -w '%{http_code}' https://iwage.co/gestion/propiedades"
chequear "feed google-merchant"   200          "curl -s -o /dev/null -w '%{http_code}' https://iwage.co/feed/google-merchant.xml"
```

`/feed` no existe en esta app (medido: 404 en `/feed`, `/rss.xml`, `/atom.xml` y `/feed.xml`); la única ruta de feed real es `src/pages/feed/google-merchant.xml.ts`. La comprobación apunta ahí en lugar de a un fantasma.

Expected: siete líneas `ok`. Un `MAL` en `robots meliponas` con `content="noindex, follow"` significa que la portada sigue vacía para la app — o sea, el despliegue de la Tarea 9 no corrió o Strapi no publicó.

- [ ] **Step 3: Ráfaga sin 503 (regresión de la fase 1)**

Run: `seq 60 | xargs -P12 -I{} curl -s -o /dev/null -w "%{http_code}\n" "https://iwage.co/meliponas/bitacora?cb={}" | sort | uniq -c`
Expected: `60 200`.

- [ ] **Step 4: Repos limpios**

Run: `git status --porcelain && git log --oneline -14` (en `data/app_iwage`) y lo mismo en `/home/ubuntu/negocio` para el gitlink.
Expected: árbol limpio salvo las dos exclusiones ya conocidas (`scripts/`, el `.docx`). Actualizar el gitlink del repo padre con el último commit de esta fase, con su propio commit que no arrastre otros proyectos.

- [ ] **Step 5: Fijar la línea base**

Anotar en `docs/superpowers/plans/2026-09-23-fase2-contenido-meliponario.md`, al final: fecha de publicación de los 37, las 189 URLs, y las impresiones de Search Console de ese día leídas por el usuario en `https://iwage.co/`. La comparación se hace a las 2 y a las 4 semanas.

---

## Criterios de aceptación

1. `curl -I` a cualquier artículo meliponas → `200`, con `<meta name="robots" content="index, follow">`.
2. `/meliponas/bitacora` pasa a `index, follow` **sin editar una línea de código** (es la consecuencia de la fase 1, y su prueba de que quedó bien).
3. Sitemap en 189 URLs, de ellas 56 bajo `/bitacora/`.
4. Ningún artículo aparece antes del paso 10: el filtro `publicado` se comprueba con un 404 en Step 4 de la tarea 8 y con `152` en Step 4 de la tarea 7.
5. `llms.txt` sin una sola cifra que no se pueda reproducir desde la base de datos.
6. `npm test` en verde y cero dependencias nuevas.
7. Cada CHECKPOINT ejecutado con confirmación explícita del usuario, y `iwage_strapi` nunca reconstruido con `--no-deps` roto: si Strapi no levanta, se detiene la fase, no se fuerza el build de la app.
