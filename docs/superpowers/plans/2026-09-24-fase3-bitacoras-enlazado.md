# Fase 3 · Bitácoras y enlazado interno — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/` (el hub de iwage.co) enlace las bitácoras con contenido y al menos 6 artículos, y que cada landing muestre su propia fila de bitácora, para que los 56 artículos publicados sean alcanzables en dos saltos desde la portada.

**Architecture:** Una sola pasada a Strapi (`getResumenBitacora()`) produce un resumen en memoria (`filasAResumen()`, pura) que alimentan el hub y las landings; el mismo cache key de Redis sirve a las 7 superficies que consultan bitácora. Todo bloque es *data-driven*: si `count === 0` no se renderiza, así que las 4 bitácoras vacías no ganan enlace ni cambian de aspecto. La degradación es a nada (`catch → filasAResumen([])`), nunca a un 500 en la portada.

**Tech Stack:** Astro 7 (`output: 'server'`, `@astrojs/node` standalone), TypeScript sin `astro check` (solo `astro build`), Tailwind v4 con tokens `--color-surface`/`--color-brand`, Strapi 5 + PostgreSQL, Redis (`iwage:` prefix) → nginx SWR (120 s) → Cloudflare tunnel, `node --test` con type-stripping de Node 22.

**Especificación:** `docs/superpowers/specs/2026-09-24-fase3-bitacoras-enlazado-design.md` (commit `e48eb20`).

---

## Contexto que hay que saber antes de tocar nada

Medido el 2026-09-24 con Search Console: **0 impresiones y 1 sola página indexada** (la portada). El grafo de enlaces lo explica: `/` emite 8 hrefs, **ninguno** a una bitácora; solo 4 de 37 artículos son alcanzables en dos saltos. Con contenido solo hay `meliponas` (37) y `granja` (19); `cafe`/`tierras`/`naturaleza`/`gestion` están vacías y en `noindex`, y no existen borradores para ellas en `Publicaciones/`. La fase 3 por tanto **enlaza, no escribe**.

## Restricciones de este repositorio (no negociables)

1. **El host no tiene `node_modules`** (node v22.23.2 sí está). `npm test` = `node --test tests/*.test.mjs`, y solo puede importar módulos que no arrastren `ioredis`. Por eso `filasAResumen()` vive en `src/lib/bitacora-resumen.ts` (cero imports en tiempo de ejecución; `import type` se borra con el type-stripping) y se **re-exporta** desde `src/lib/bitacora.ts` para que los consumidores sigan importando de `@/lib/bitacora`. Desviación declarada respecto al objetivo ("en `src/lib/bitacora.ts`"): la función es accesible desde ahí, pero se define en un módulo puro para que el test corra sin Docker.
2. **No se puede ensanchar `getBitacoraByMarca()` con `fields`.** `src/lib/rag/indexer.ts:257` lo llama y **necesita `contenido`**. Los `fields` van solo en la consulta nueva.
3. **Despliegue = `docker compose build iwage_app` + `up -d` desde `/home/ubuntu/negocio`** (el contexto de build es `./data/app_iwage`, es decir se construye **desde el árbol local**, sin `git push`). El `npm run build` corre dentro de la imagen: si el build falla, el contenedor viejo sigue arriba. **Requiere CHECKPOINT confirmado por un mensaje de texto del usuario.**
4. **Sin `git push` sin pedirlo.** Los secretos se validan solo por presencia, nunca leyendo valores. Nada de archivos temporales en ninguna parte, incluido `/tmp`: las verificaciones se hacen con tuberías.
5. `security.checkOrigin: true` (`astro.config.mjs:28-30`): cualquier POST sin `Content-Type: application/json` devuelve 403. No aplica a este plan (no hay POSTs), pero es la causa de un fallo pasado.
6. Astro compila el frontmatter en ámbito de módulo: **no usar `return` en el frontmatter** de un componente. La ocultación se hace con `{cond && (…)}`.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/strapi.ts` | Modificar | Soportar `fields?: string[]` (consulta sin `contenido`). |
| `src/lib/bitacora-resumen.ts` | Crear | `ResumenBitacora`, `filasAResumen()`, `conteoDe()`. Puro, testeable en el host. |
| `src/lib/bitacora.ts` | Modificar | `getResumenBitacora()` (única pasada a Strapi) + re-exportar lo puro. |
| `tests/bitacora-resumen.test.mjs` | Crear | 5 tests de la agrupación; el quinto codifica el contrato del grafo con las 56 filas publicadas. |
| `src/components/brand/BitacoraEcosistema.astro` | Crear | Sección del hub: chips de portadas con contenido + tira de 6 recientes. |
| `src/pages/index.astro` | Modificar | `resumen` en frontmatter, pie `"Bitácora · N publicaciones"` por tarjeta, montar la sección. |
| `src/components/brand/UltimasDeBitacora.astro` | Crear | Fila `"Desde la bitácora"` (3 `BitacoraCard`), oculta si la marca está vacía. |
| `src/pages/{cafe,tierras,naturaleza,gestion,granja}/index.astro` | Modificar | Importar y montar `UltimasDeBitacora` antes de `</BrandLayout>`. |
| `src/components/brand/BrandFooter.astro` | Modificar | Enlazar, en la columna Ecosistema, las bitácoras con contenido. |
| `src/config/brands/granja.ts` | Modificar | `/granja/bitacora` en `nav` (hoy 19 artículos indexables sin ruta de menú). |

Commits: 4 de código (uno por bloque de tareas) + 1 de documentación al cerrar. No hay commits por paso suelto.

---

### Task 1: `fields` en `strapiFetch`

**Files:**
- Modify: `src/lib/strapi.ts:41-47` (interfaz `StrapiFetchOptions`)
- Modify: `src/lib/strapi.ts:76-85` (desestructuración de opciones)
- Modify: `src/lib/strapi.ts:89-95` (construcción de `params`)

- [x] **Step 1: Declarar la opción en la interfaz**

En `src/lib/strapi.ts`, localizar el bloque `pagination?: { page?: number; pageSize?: number };` (dentro de `StrapiFetchOptions`) y dejarlo seguido por el miembro nuevo:

```ts
  /** Pagination */
  pagination?: { page?: number; pageSize?: number };
  /**
   * Subconjunto de atributos (Strapi v5 `fields[]`). En colecciones con `contenido`
   * largo evita arrastrar el texto completo al caché de Redis.
   */
  fields?: string[];
```

- [x] **Step 2: Desestructurarla**

En `strapiFetch`, el bloque de desestructuración queda:

```ts
  const {
    ttl = CACHE_TTL.list,
    cacheKey: customKey,
    fetchOptions = {},
    populate,
    filters,
    sort,
    pagination,
    fields,
    publicationState,
  } = options;
```

- [x] **Step 3: Serializarla con la sintaxis de corchetes que ya usa `populate[]`**

Justo después del bloque `if (populate) { … }` (antes de `if (filters)`), añadir:

```ts
  if (fields) fields.forEach((f) => params.append('fields[]', f));
```

- [x] **Step 4: Verificar estáticamente**

Run: `grep -c "fields" src/lib/strapi.ts`
Expected: `4` — las cuatro son, en orden del archivo: la línea del comentario JSDoc que menciona ``fields[]``, la declaración `fields?: string[];`, el `fields,` de la desestructuración y el `if (fields) fields.forEach(...)`. Cualquier otro número deja de este paso: falta una edición o hay una duplicada.

- [x] **Step 5: Verificar que no rompió la suite**

Run: `npm test`
Expected: `fail 0` (ningún test importa `strapi.ts`).

No se commitea todavía: el commit 1 cubre Tasks 1-3.

---

### Task 2: `filasAResumen()` y `conteoDe()` (TDD)

**Files:**
- Create: `tests/bitacora-resumen.test.mjs`
- Create: `src/lib/bitacora-resumen.ts`

- [x] **Step 1: Escribir los 4 tests que fallan**

Crear `tests/bitacora-resumen.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filasAResumen, conteoDe } from '../src/lib/bitacora-resumen.ts';

const fila = (titulo, marca, fecha = '2026-09-01') => ({
  id: 0, documentId: titulo, titulo, slug: titulo, extracto: null, contenido: null,
  categoria: null, tiempo_lectura: null, imagen: null, fecha, marca, destacado: false,
  publicado: true, autor: null, etiquetas: null, fecha_actualizacion: null,
  meta_title: null, meta_description: null, subsistema: null,
  publishedAt: fecha, updatedAt: fecha,
});

test('filasAResumen: sin filas devuelve un resumen vacío, sin marcas fantasma', () => {
  assert.deepEqual(filasAResumen([]), { total: 0, porMarca: {}, recientes: [] });
});

test('filasAResumen: agrupa dos marcas, recorta por `porMarca` y respeta el orden de entrada', () => {
  const r = filasAResumen([
    fila('g1', 'granja'), fila('m1', 'meliponas'), fila('g2', 'granja'),
    fila('m2', 'meliponas'), fila('m3', 'meliponas'), fila('m4', 'meliponas'),
  ]);
  assert.equal(r.total, 6);
  assert.equal(r.porMarca.granja.count, 2);
  assert.equal(r.porMarca.meliponas.count, 4);
  assert.deepEqual(r.porMarca.meliponas.ultimas.map((f) => f.titulo), ['m1', 'm2', 'm3']);
  assert.deepEqual(r.recientes.map((f) => f.titulo), ['g1', 'm1', 'g2', 'm2', 'm3', 'm4']);
  assert.equal(Object.values(r.porMarca).reduce((s, v) => s + v.count, 0), r.total);
});

test('filasAResumen: una marca desconocida no produce enlaces rotos', () => {
  const r = filasAResumen([fila('x', 'desconocida'), fila('m', 'meliponas')]);
  assert.equal(r.total, 1);
  assert.deepEqual(Object.keys(r.porMarca), ['meliponas']);
  assert.deepEqual(r.recientes.map((f) => f.titulo), ['m']);
});

test('conteoDe: 0 sin bitácora, el conteo real con contenido', () => {
  const r = filasAResumen([fila('a', 'granja'), fila('b', 'granja')]);
  assert.equal(conteoDe(r, 'granja'), 2);
  assert.equal(conteoDe(r, 'cafe'), 0);
  assert.equal(conteoDe(r, 'cualquier-cosa'), 0);
});
```

- [x] **Step 2: Correrlos y verlos fallar**

Run: `node --test tests/bitacora-resumen.test.mjs 2>&1 | tail -20`
Expected: `Cannot find module '…/src/lib/bitacora-resumen.ts'`, `pass 0`, `fail 1`.

- [x] **Step 3: Implementar el módulo puro**

Crear `src/lib/bitacora-resumen.ts`:

```ts
/**
 * Agrupación pura del resumen de bitácoras, sin Strapi ni Redis.
 * Vive aparte de `bitacora.ts` para que `node --test` pueda importarla sobre el
 * repositorio (el host no tiene node_modules y `bitacora.ts` arrastra ioredis).
 */
import type { EntradaBitacora, Marca } from './bitacora';

export interface ResumenBitacora {
  total: number;
  porMarca: Partial<Record<Marca, { count: number; ultimas: EntradaBitacora[] }>>;
  recientes: EntradaBitacora[];
}

const MARCAS: string[] = ['tierras', 'naturaleza', 'meliponas', 'cafe', 'gestion', 'granja'];

/**
 * Recibe filas YA ordenadas por fecha descendente y las agrupa: no vuelve a ordenar.
 * Las filas de marca desconocida se descartan, porque su href (`/${marca}/bitacora/…`)
 * sería un 404.
 */
export function filasAResumen(
  filas: EntradaBitacora[],
  { porMarca = 3, recientes = 6 }: { porMarca?: number; recientes?: number } = {}
): ResumenBitacora {
  const validas = filas.filter((f) => MARCAS.includes(f.marca));
  const agrupado: ResumenBitacora['porMarca'] = {};
  for (const fila of validas) {
    const marca = fila.marca as Marca;
    const entrada = agrupado[marca] ?? (agrupado[marca] = { count: 0, ultimas: [] });
    entrada.count += 1;
    if (entrada.ultimas.length < porMarca) entrada.ultimas.push(fila);
  }
  return { total: validas.length, porMarca: agrupado, recientes: validas.slice(0, recientes) };
}

/** Conteo de una marca por slug, aceptando el `slug: string` de BrandConfig. */
export function conteoDe(resumen: ResumenBitacora, slug: string): number {
  return resumen.porMarca[slug as Marca]?.count ?? 0;
}
```

- [x] **Step 4: Correrlos y verlos pasar**

Run: `node --test tests/bitacora-resumen.test.mjs 2>&1 | tail -12`
Expected: `pass 4`, `fail 0`.

- [x] **Step 5: Suite completa**

Run: `npm test 2>&1 | tail -12`
Expected: `fail 0`, con los 4 tests nuevos incluidos.

---

### Task 3: `getResumenBitacora()` y el commit de la capa de datos

**Files:**
- Modify: `src/lib/bitacora.ts:5` (imports)
- Modify: `src/lib/bitacora.ts:52` (después de `getBitacoraByMarca`)

- [x] **Step 1: Importar lo puro y re-exportar lo que consumen las superficies**

En `src/lib/bitacora.ts`, la línea 5 es `import { strapiFetch, CACHE_TTL } from './strapi';`. Reemplazar esa única línea por estas cuatro:

```ts
import { strapiFetch, CACHE_TTL } from './strapi';
import { filasAResumen, type ResumenBitacora } from './bitacora-resumen';

export { conteoDe, type ResumenBitacora } from './bitacora-resumen';
```

`filasAResumen` se importa porque `getResumenBitacora()` la llama abajo, y **no** se re-exporta: ninguna página la invoca, solo la consume `getResumenBitacora()`. Lo que sí sale hacia los componentes es `conteoDe` (hub, `BrandFooter`) y el tipo `ResumenBitacora` (props de `BitacoraEcosistema`). El paso 1 de Task 2 ya demuestra que se puede importar directamente desde `@/lib/bitacora-resumen` si algún día hace falta.

- [x] **Step 2: Añadir la consulta única**

Después del cierre de `getBitacoraByMarca` (la función termina en `}` tras el `catch`), insertar:

```ts
/** Campos que necesitan las tiras de resumen; `contenido` queda fuera a propósito. */
const CAMPOS_RESUMEN = [
  'titulo', 'slug', 'marca', 'fecha', 'extracto', 'imagen', 'categoria', 'tiempo_lectura',
];

/**
 * Una sola pasada a Strapi para todas las superficies que muestran bitácora
 * (hub, 5 landings y BrandFooter). `porMarca`/`recientes` son de post-proceso:
 * no entran al cache key, así que las 7 superficies comparten una única entrada
 * de Redis con TTL `CACHE_TTL.list`.
 * Si Strapi falla, devuelve el resumen vacío: el bloque se degrada a nada, nunca
 * a un 500 en la portada.
 */
export async function getResumenBitacora(
  opts: { porMarca?: number; recientes?: number } = {}
): Promise<ResumenBitacora> {
  try {
    const res = await strapiFetch<EntradaBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      filters: { publicado: { $eq: true } },
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: 1, pageSize: 100 },
      fields: CAMPOS_RESUMEN,
    });
    return filasAResumen(res.data || [], opts);
  } catch {
    return filasAResumen([], opts);
  }
}
```

- [x] **Step 3: Verificar la superficie exportada**

Run: `grep -n "export" src/lib/bitacora.ts`
Expected: las salidas previas más `export { conteoDe, type ResumenBitacora } …` y `export async function getResumenBitacora(`.

- [x] **Step 4: Suite completa otra vez**

Run: `npm test 2>&1 | tail -8`
Expected: `fail 0`.

- [x] **Step 5: Revisar el diff y commit 1**

```bash
cd /home/ubuntu/negocio/data/app_iwage
git diff --stat
git add src/lib/strapi.ts src/lib/bitacora-resumen.ts src/lib/bitacora.ts tests/bitacora-resumen.test.mjs
git commit -m "feat(fase 3): capa de datos del resumen de bitácoras en una sola pasada"
```

Expected en `git diff --stat` antes del `git add`: 4 archivos (3 modificados + 2 nuevos, ninguno fuera de `src/lib/` y `tests/`).

---

### Task 4: Sección del hub `BitacoraEcosistema` y sus dos anclajes en `/`

**Files:**
- Create: `src/components/brand/BitacoraEcosistema.astro`
- Modify: `src/pages/index.astro:10-12` (imports y datos), `:221-223` (pie de tarjeta), `:237` (montaje)

- [x] **Step 1: Crear el componente**

Crear `src/components/brand/BitacoraEcosistema.astro`:

```astro
---
import { brandList } from '@/config/brands';
import Icon from '@/components/shared/Icon.astro';
import { conteoDe, type ResumenBitacora } from '@/lib/bitacora';

interface Props {
  resumen: ResumenBitacora;
}

const { resumen } = Astro.props;

const marcasConContenido = brandList
  .map((brand) => ({ brand, count: conteoDe(resumen, brand.slug) }))
  .filter((entrada) => entrada.count > 0);

const nombreDe = (slug: string) => brandList.find((b) => b.slug === slug)?.name ?? slug;
---

{resumen.recientes.length > 0 && (
  <section class="border-t border-border py-14 px-6">
    <div class="mx-auto max-w-6xl">
      <p class="text-center font-mono text-xs uppercase tracking-widest text-accent">
        Bitácoras del ecosistema
      </p>

      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        {marcasConContenido.map(({ brand, count }) => (
          <a
            href={`/${brand.slug}/bitacora`}
            class="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary transition-all hover:border-brand/40 hover:text-brand"
          >
            <Icon name={brand.icon} class="w-4 h-4 text-brand" />
            {brand.name}
            <span class="font-mono text-[10px] uppercase tracking-widest text-text-muted">{count}</span>
          </a>
        ))}
      </div>

      <ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumen.recientes.map((post) => (
          <li>
            <a
              href={`/${post.marca}/bitacora/${post.slug}`}
              class="group flex h-full flex-col rounded-xl border border-border bg-surface-raised p-5 transition-all hover:border-brand/40 hover:shadow-md"
            >
              <span class="font-mono text-[10px] uppercase tracking-widest text-accent">
                {nombreDe(post.marca)}
              </span>
              <span class="mt-2 text-base font-semibold leading-snug text-text-primary transition-colors group-hover:text-brand">
                {post.titulo}
              </span>
              {post.extracto && (
                <span class="mt-2 line-clamp-2 text-sm text-text-secondary">{post.extracto}</span>
              )}
              <span class="mt-auto pt-3 text-xs text-text-muted">{post.fecha ?? ''}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </section>
)}
```

- [x] **Step 2: Pedir el resumen en el frontmatter del hub**

En `src/pages/index.astro`, tras `import { getHeroBySlug } from '@/lib/heroes';` (línea 10) añadir los dos imports, y tras `const hero = await getHeroBySlug('/');` (línea 12) la nueva constante:

```ts
import { getHeroBySlug } from '@/lib/heroes';
import { getResumenBitacora, conteoDe } from '@/lib/bitacora';
import BitacoraEcosistema from '@/components/brand/BitacoraEcosistema.astro';

const hero = await getHeroBySlug('/');
const resumen = await getResumenBitacora();
```

- [x] **Step 3: Pie "Bitácora · N publicaciones" en cada tarjeta**

Las tarjetas del hub son `<a>` (líneas 196-224), así que el pie **no puede ser un enlace** — sería HTML inválido. Se añade como texto, justo después del `<span>` de `Explorar` (líneas 221-223):

```astro
            <span class="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand group-hover:gap-3 transition-all">
              Explorar <Icon name="arrow-right" class="w-4 h-4" />
            </span>
            {conteoDe(resumen, brand.slug) > 0 && (
              <p class="mt-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Bitácora · {conteoDe(resumen, brand.slug)} publicaciones
              </p>
            )}
```

Los enlaces reales a las portadas de bitácora viven en `BitacoraEcosistema` (paso siguiente), que es lo que satisface el criterio de "≥2 portadas enlazadas".

- [x] **Step 4: Montar la sección bajo el grid de marcas**

`</main>` cierra el grid de tarjetas en la línea 237, antes del comentario `<!-- Cómo se conecta el ecosistema -->`. Insertar entre ambos:

```astro
    </main>

    <BitacoraEcosistema resumen={resumen} />

    <!-- Cómo se conecta el ecosistema -->
```

- [x] **Step 5: Verificar estáticamente**

```bash
grep -n "BitacoraEcosistema\|getResumenBitacora\|conteoDe" src/pages/index.astro
```
Expected: 6 líneas → (1) `import { getResumenBitacora, conteoDe } …`, (2) `import BitacoraEcosistema …`, (3) `const resumen = await getResumenBitacora();`, (4) `{conteoDe(resumen, brand.slug) > 0 && (`, (5) `Bitácora · {conteoDe(resumen, brand.slug)} publicaciones`, (6) `<BitacoraEcosistema resumen={resumen} />`. Si falta alguna, ese paso no se cerró.

- [x] **Step 6: Commit 2**

```bash
git add src/components/brand/BitacoraEcosistema.astro src/pages/index.astro
git commit -m "feat(fase 3): el hub enlaza bitácoras — conteo por marca y tira de recientes"
```

---

### Task 5: Fila "Desde la bitácora" en las 5 landings que no la tienen

**Files:**
- Create: `src/components/brand/UltimasDeBitacora.astro`
- Modify: `src/pages/cafe/index.astro` (import tras la línea 9, montaje tras el `</Section>` final)
- Modify: `src/pages/tierras/index.astro` (import tras la 8)
- Modify: `src/pages/naturaleza/index.astro` (import tras la 7)
- Modify: `src/pages/gestion/index.astro` (import tras la 7)
- Modify: `src/pages/granja/index.astro` (import tras la 12)

- [x] **Step 1: Crear el componente**

Crear `src/components/brand/UltimasDeBitacora.astro`. Reutiliza `BitacoraCard` y lee del mismo resumen compartido (`porMarca[marca].ultimas`, 3 por defecto):

```astro
---
import BitacoraCard from '@/components/BitacoraCard.astro';
import { getResumenBitacora, type Marca } from '@/lib/bitacora';

interface Props {
  marca: Marca;
}

const { marca } = Astro.props;
const resumen = await getResumenBitacora();
const ultimas = resumen.porMarca[marca]?.ultimas ?? [];
---

{ultimas.length > 0 && (
  <section class="bg-surface border-t border-border py-16">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-8 flex items-end justify-between gap-4">
        <div>
          <p class="font-mono text-xs uppercase tracking-widest text-accent">Bitácora</p>
          <h2 class="mt-2 text-2xl font-bold text-text-primary">Desde la bitácora</h2>
        </div>
        <a
          href={`/${marca}/bitacora`}
          class="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-brand transition-all hover:gap-3"
        >
          Ver todo <span aria-hidden="true">→</span>
        </a>
      </div>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ultimas.map((post) => (
          <BitacoraCard
            title={post.titulo}
            excerpt={post.extracto ?? ''}
            category={post.categoria ?? 'General'}
            date={post.fecha ?? ''}
            readTime={String(post.tiempo_lectura ?? 5)}
            href={`/${marca}/bitacora/${post.slug}`}
            image={post.imagen ?? undefined}
          />
        ))}
      </div>
    </div>
  </section>
)}
```

- [x] **Step 2: Montarlo en las 5 landings**

En cada archivo se hacen exactamente dos ediciones: (a) el import, y (b) el montaje como último hijo de `<BrandLayout>`. El import es idéntico en los cinco y va inmediatamente después de la última línea `import …` del frontmatter:

```ts
import UltimasDeBitacora from '@/components/brand/UltimasDeBitacora.astro';
```

Para el montaje, el patrón es el mismo en los cinco: tomar las dos últimas líneas del archivo (el cierre de la última sección y `</BrandLayout>`) e intercalar el componente con el slug **propio de esa marca**:

```astro
  </Section>

  <UltimasDeBitacora marca="meliponas" />
</BrandLayout>
```

Sustituyendo `marca="meliponas"` por el valor de la columna correspondiente y `</Section>` por la etiqueta que realmente cierra en ese archivo:

| Archivo | Última línea | Cierre previo que se conserva | Valor de `marca` |
|---|---|---|---|
| `src/pages/cafe/index.astro` | 442 | `  </Section>` (441) | `"cafe"` |
| `src/pages/tierras/index.astro` | 380 | `  </section>` (379) | `"tierras"` |
| `src/pages/naturaleza/index.astro` | 459 | `  </section>` (458) | `"naturaleza"` |
| `src/pages/gestion/index.astro` | 205 | `  </section>` (204) | `"gestion"` |
| `src/pages/granja/index.astro` | 272 | `  </Section>` (271) | `"granja"` |

Las dos variantes de Mayúsculas/minúsculas son reales: `cafe` y `granja` usan el componente `<Section>`; `tierras`, `naturaleza` y `gestion` cierran un `<section>` a mano. Usar el de cada archivo para no romper el balance de etiquetas.

`src/pages/meliponas/index.astro` **no** se toca: su portada ya enlaza 4 artículos (`src/pages/meliponas/index.astro:250-275`).

- [x] **Step 3: Verificar los 5 montajes**

```bash
grep -n "UltimasDeBitacora" src/pages/*/index.astro
```
Expected: 10 líneas (import + montaje) en cada uno de `cafe`, `gestion`, `granja`, `naturaleza`, `tierras`; **cero** en `meliponas/index.astro`.

- [x] **Step 4: Verificar que ninguna página usa `return` en el frontmatter**

```bash
grep -n "^return\|[^.a-zA-Z]return " src/components/brand/UltimasDeBitacora.astro
```
Expected: sin coincidencias (la ocultación es `{ultimas.length > 0 && (…}`).

- [x] **Step 5: Commit 3**

```bash
git add src/components/brand/UltimasDeBitacora.astro src/pages/cafe/index.astro src/pages/tierras/index.astro src/pages/naturaleza/index.astro src/pages/gestion/index.astro src/pages/granja/index.astro
git commit -m "feat(fase 3): las 5 landings sin bitácora publican su fila 'Desde la bitácora'"
```

---

### Task 6: Pie global y menú de granja

**Files:**
- Modify: `src/components/brand/BrandFooter.astro:1-12` (frontmatter), `:95-104` (lista del ecosistema)
- Modify: `src/config/brands/granja.ts:32-40` (`nav`)

- [x] **Step 1: Consultar el resumen en el pie**

En `src/components/brand/BrandFooter.astro`, el frontmatter termina en `const otherBrands = …` / `const year = …`. Añadir:

```ts
import { getResumenBitacora, conteoDe } from '@/lib/bitacora';

const otherBrands = brandList.filter((b) => b.slug !== brand.slug);
const year = new Date().getFullYear();
const resumen = await getResumenBitacora();
```

(El import va con los demás imports del bloque, y las dos constantes reemplazan a las líneas existentes con el mismo nombre.)

- [x] **Step 2: Enlazar la bitácora debajo de cada marca con contenido**

Reemplazar el `otherBrands.map` de la columna "Ecosistema Iwagé" (líneas 95-104) por:

```astro
          {otherBrands.map((b) => (
            <li>
              <a
                href={`/${b.slug}/`}
                class="inline-flex items-center gap-2 text-sm text-dark-text/60 hover:text-accent transition-colors"
              >
                <Icon name={b.icon} class="w-4 h-4" /> {b.name}
              </a>
              {conteoDe(resumen, b.slug) > 0 && (
                <a
                  href={`/${b.slug}/bitacora`}
                  class="mt-1 block w-fit text-xs text-dark-text/40 hover:text-accent transition-colors"
                >
                  Bitácora · {conteoDe(resumen, b.slug)}
                </a>
              )}
            </li>
          ))}
```

- [x] **Step 3: Menú de granja, con el idioma de las otras 5 marcas**

En `src/config/brands/granja.ts`, el grupo `Recursos` queda exactamente como en `meliponas.ts:35-40` (el `href` del grupo apunta a la bitácora y `Bitácora` es el primer hijo):

```ts
    {
      label: 'Recursos',
      href: '/granja/bitacora',
      children: [
        { label: 'Bitácora', href: '/granja/bitacora' },
        { label: 'Quiénes Somos', href: '/granja/nosotros' },
        { label: 'Ayuda', href: '/granja/ayuda' },
        { label: 'Contacto', href: '/granja/contacto' },
      ],
    },
```

- [x] **Step 4: Verificar**

```bash
grep -n "bitacora" src/config/brands/granja.ts && grep -n "getResumenBitacora\|conteoDe" src/components/brand/BrandFooter.astro
```
Expected: dos coincidencias de `bitacora` en `granja.ts` (grupo + hijo) y cuatro en `BrandFooter.astro` (import, `const resumen`, y dos usos de `conteoDe`).

- [x] **Step 5: Suite completa**

Run: `npm test 2>&1 | tail -8`
Expected: `fail 0`.

- [x] **Step 6: Commit 4**

```bash
git add src/components/brand/BrandFooter.astro src/config/brands/granja.ts
git commit -m "feat(fase 3): pie global enlaza las bitácoras con contenido y granja suma su ruta al menú"
```

---

### Task 7: CHECKPOINT de despliegue y verificación en producción — **hecho, 2026-09-24 14:18Z**

**Files:** ninguno (producción). Todo este task requiere un mensaje de texto del usuario que diga el CHECKPOINT; una respuesta de AskUserQuestion **no** cuenta.

- [x] **Step 1: Presentar el estado y parar**

**CHECKPOINT 1 concedido (2026-09-24, tarde).** El estado se presentó con `git log --oneline -5` y el diff-stat sobre `e48eb20..HEAD` (10 commits de fase), y la parada se respetó: ningún comando del Step 2 en adelante se corrió antes de la respuesta. La autorización llegó por **mensaje de texto** --«Ejecuta la reconstruccion»--, y como el `up -d` es la parte delicada se volvió a preguntar con el radio de acción explícito (build → `up -d iwage_app` dejando `iwage_strapi`/`redis_app`/`sostenibilidad_db` intactos → Steps 4-8 → sin push); la respuesta fue «Sí: desplegar y verificar». Este doc pedía un mensaje de texto y lo hubo: el texto es el «Ejecuta la reconstruccion», y el selector solo acotó el alcance de ese texto.

```bash
cd /home/ubuntu/negocio/data/app_iwage && git log --oneline -5 && git diff --stat e48eb20..HEAD
```

Mostrar los commits de la fase (`git log --oneline e48eb20^..HEAD`, hoy 10) y escribir explícitamente: *CHECKPOINT 1 — desplegar (`docker compose build iwage_app && docker compose up -d iwage_app`) es una acción sobre producción; necesito tu confirmación por mensaje de texto.* No ejecutar nada del Step 2 en adelante hasta que llegue.

**Cómo leer los números del Step 4 al 8 (decidido antes, para no revertir sobre un dato mal leído):**

- **Más de dos índices enlazados o más de dos líneas de pie** (tres portadas, `3 …` de pies): Strapi tiene filas publicadas de una tercera marca y el grafo está haciendo justo lo que se le pidió —las seis superficies se derivan de `conteoDe`, no de una lista fija de marcas—. No es fallo ni motivo de revert: se anota la marca y la suma del Step 8 se lee como "todas las marcas con contenido", no como 19 + 37.
- **Cero píldoras y cero pies con `/` en `200` y el log en `0`**: no es un bug de enlazado, es la degradación diseñada ante una colección que respondió vacía. Antes de tocar nada se comprueba por slug ausente contra `Publicaciones/` (la segunda fuente de los 56).
- **`429` o `5xx` en la ráfaga del Step 7**: el único trigger de revert escrito aquí, porque `location /` no lleva `limit_req` y ese código solo puede venir de la app.
- **`noindex` en un índice que por el Step 8 sí enlaza artículos**: blip de Strapi tragado en `src/lib/bitacora.ts:52-54`, no regresión de esta fase. Se repite la lectura y se contrasta con `grep -c 'resumen degradado'` en el log.
- **El pie de una marca y el conteo real de su índice siempre deben cuadrar** (los dos leen con tope de 100: `pageSize: 100` del resumen y el de `getBitacoraByMarca` en los índices). Lo que delata la deuda del tope es otra señal: que el sitemap tenga más URLs `/<marca>/bitacora/…` de las que dice el pie, porque `fetchAllSlugs` sí pagina sin tope. Si eso aparece, se anota y no se corrige a mitad de despliegue.
- **Ninguno de estos números es una apuesta**: los Steps 4-8 ya se ensayaron contra un Strapi de fixture con las 56 filas del corpus (ver "Rehearsal en local con un Strapi de fixture", al final del documento). Valores esperados exactos: `/` → 2 índices + 6 hrefs de artículo + 2 pies; `/granja/` → 3 artículos y 4 `href="/granja/bitacora"`; `/meliponas/` → 4; las 4 vacías → `0/0`; índices 19 y 37; `noindex, follow` solo en los 4 vacíos; dos saltos = 56; ráfaga `60 200`. Si en producción sale otro, la diferencia solo puede venir de (a) lo que Strapi tenga publicado —las `fecha` del fixture no son las publicadas: cambia el mix de la tira, nunca su tamaño— o (b) el camino nginx → Cloudflare. No del enlazado, que ya está medido sobre el bundle de la fase.

- [x] **Step 2: Construir la imagen (aún no toca el contenedor en marcha)**

**Medido (2026-09-24, poco antes de las 14:18Z del `up -d`).** `EXITO_BUILD=0`, `Image negocio-iwage_app Built`, sin `error` en el `RUN npm run build`. Imagen etiquetada `docker.io/library/negocio-iwage_app:latest`, manifiesto `sha256:a8fa6c5b1ef0448be227f39448791cbdfafa35aa00040e0e6aa31cda168e7666`, manifest list `sha256:a24cee1a2b6a1915a7e1b43b993d894b81d0b8849be38eacd71bfe244e336cd0` --este último es el sha que reporta `docker inspect --format '{{.Image}}'`, y el que hay que comparar contra `bff340657c61…` en el Step 3—. El build no tocó el contenedor en marcha: `iwage_web` siguió `Up … (healthy)` con la imagen vieja hasta el `up -d`.

Un dato que salió del propio log de build y que sirve para leer el Step 4: el `/start.sh` de la imagen (capa de build #22) arranca Astro como usuario `astro`, duerme 5 s y **precieinta 7 rutas HTML contra `127.0.0.1:4321`** (`/`, `/meliponas/`, `/cafe/`, `/tierras/`, `/naturaleza/`, `/gestion/`, `/granja/`) antes de `exec nginx`. Dos consecuencias: (a) el conteo de `resumen degradado` del arranque no empieza en cero sino con 7 renders SSR ya hechos --por eso el `0` del Step 4 es sobre tráfico real de arranque, no sobre un contenedor ocioso—; (b) como el warmup golpea `:4321` y no a nginx, **no** pobla `html_cache`, así que el "la primera petición pública siempre choca contra la aplicación nueva" del Step 5 sigue en pie.

```bash
cd /home/ubuntu/negocio && docker compose build iwage_app 2>&1 | tail -25
```
Expected: `RUN npm run build` termina sin `error` y la imagen se etiqueta. Si el build falla, **abortar aquí**: el contenedor viejo sigue sirviendo, no se hace `up`. Corregir y volver al Step 2.

Pre-flight ya corrido (medido 2026-09-24, sola lectura, `docker compose version` → v5.4.0): `docker compose up -d --dry-run iwage_app` resuelve **4** contenedores en el grafo del servicio --`iwage_web`, `iwage_strapi`, `redis_app` y `sostenibilidad_db`--, y hoy los cuatro imprimen `Running`. Con ese compose de 40 servicios compartidos esto es lo que limita el radio de acción: el `up -d` del Step 3 no reinicia los tres compartidos mientras sigan corriendo y su configuración no cambie; lo único que debe cambiar es `iwage_web`. Y de ahí sale el falso negativo que hay que cerrar: si el recreate no ocurre, el Step 4 devuelve puros `0` --la aplicación vieja no tiene ninguno de los bloques— y ese cuadro es **idéntico** al de la fase rota, así que lo único que separa las dos explicaciones es la comparación de imagen y hora de arranque. **si el dry-run post-build sigue diciendo `Running` en lugar de `Recreate`, la imagen nueva no entró y lo que se mediría sería el despliegue anterior.** Para que la comparación tenga referencia, el estado previo quedó registrado: imagen `sha256:bff340657c610cdbc0faabfef3fe99bb29843a5eef955efcd24cc2198a8231c7`, contenedor creado `2026-09-24T03:34:10Z`. Después del `up -d`, `docker inspect --format '{{.Image}} {{.State.StartedAt}}' iwage_web` tiene que dar otro sha y una hora nueva. Nota para no perder el rumbo: el dry-run imprime dos warnings de `ADMIN_USER` / `ADMIN_PASS` "defaulting to a blank string" --son de otros servicios de este compose, no de iwage, y **no** son motivo para abrir `.env` ni para tocar credenciales—.

- [x] **Step 3: Recrear el servicio**

**Medido (2026-09-24).** El `up -d` imprimió `Container iwage_web Recreate` → `Recreated` → `Started`, y `iwage_strapi` quedó en `Running` (no se reinició). 25 s después: `Up 25 seconds (healthy)`, y al final de la verificación `Up 2 minutes (healthy)`. La comparación que cierra el falso negativo del Step 2 quedó así: imagen `sha256:a24cee1a2b6a1915a7e1b43b993d894b81d0b8849be38eacd71bfe244e336cd0` creada/arrancada `2026-09-24T14:18:28Z`, contra la referencia previa `sha256:bff340657c61…` / `2026-09-24T03:34:10Z` --distinta en las dos cosas: el recreate ocurrió y lo que se midió después es la build de esta fase—. Vecinos sin cascada: `iwage_strapi` `Up 11 hours (healthy)`, `redis_app` `Up 2 days`, `sostenibilidad_db` `Up 5 weeks`.

Los `TypeError: fetch failed` de la carrera de arranque que se observaron en la fase 2 **no aparecieron** esta vez: `docker logs iwage_web | grep -c 'TypeError: fetch failed'` → `0`. El `sleep 25` se mantiene igual; lo que cambia es que el origen ya estaba servible cuando se corrió el Step 4 (los 7 warmups del `/start.sh` se disparan tras su propio `sleep 5`).

```bash
cd /home/ubuntu/negocio && docker compose up -d iwage_app 2>&1 | tail -5 && sleep 25 && docker ps --filter name=iwage_web --format '{{.Status}}'
```
Expected: `Up …`, sin reinicios en cascada. (Los 5 primeros `TypeError: fetch failed` observados en la fase 2 son la carrera de arranque documentada; por eso el `sleep 25`.)

- [x] **Step 4: Verificar en el ORIGEN, antes de mirar ninguna caché intermedia**

**Medido (2026-09-24), las seis líneas, y las seis salen igual que el ensayo con fixture:**

| # | lectura | esperado | medido en `:4321` |
|---|---|---|---|
| 1 | estado y tiempo de `/` | `200` | `200` en `0.035604s` |
| 2 | hrefs de artículo en `/` | ≥ 6 | **6** (`sort -u`) |
| 3 | portadas de índice | las dos justas | `href="/granja/bitacora"`, `href="/meliponas/bitacora"` |
| 4 | pies normalizados | 2 líneas | `1 Bitácora · 19 publicaciones`, `1 Bitácora · 37 publicaciones` |
| 5 | marcador `publicaciones` | 2 (no 6) | **2** |
| 6 | `grep -c 'resumen degradado'` | 0 | **0** |

Tres notas de lectura. (a) El comando 6 sale con **código de salida 1** precisamente porque `grep -c` no encontró nada; si alguien reejecuta la lista y ve `exitCode 1`, ese `0` es el valor deseado, no un fallo. (b) El `0` del log se sostuvo **después** de la ráfaga del Step 7 y de los 7 renders de precarga del `/start.sh` --12 lecturas SSR de HTML servidas desde el arranque, ninguna degradada—, así que el `0` no es "todavía no pasó tráfico". (c) Ninguna de las dos latencias medidas es un render **frío de aplicación**, y conviene decirlo para no sobreinterpretar el número: cuando se corrió el Step 4 el `CACHE_TTL.list` (300 s) ya estaba cargado por las 7 peticiones del warmup de arranque, de ahí los `36 ms`; y el `0.48 s` del Step 5 es el camino **nginx MISS** (la zona `html_cache` murió con el contenedor viejo) más TLS y el salto por Cloudflare, no una app sin caché. El render de `/` con `getResumenBitacora()` golpeando Strapi de verdad no se midió en este despliegue. Es un hueco chico: ese caso solo lo ve un rastreador que llegue en la ventana en que las dos cachés están frías a la vez, y su techo está acotado por el `AbortSignal.timeout(8000)` de `strapiFetch` --peor caso, 8 s y el bloque se degrada a nada, que es la ruta medida en el bloque "Degradación con Strapi devolviendo 400"—, no por el tamaño de la colección.

Astro escucha en `127.0.0.1:4321` **dentro** del contenedor (el puerto publicado 4321 del host es nginx, que tiene su propio SWR de 120 s):

```bash
docker exec iwage_web curl -s -o /dev/null -w 'origen /: %{http_code} %{time_total}s\n' http://127.0.0.1:4321/
docker exec iwage_web curl -s http://127.0.0.1:4321/ | grep -oE 'href="/[a-z]+/bitacora/[^"/]+"' | sort -u | wc -l
docker exec iwage_web curl -s http://127.0.0.1:4321/ | grep -oE 'href="/(meliponas|granja|cafe|tierras|naturaleza|gestion)/bitacora"' | sort -u
docker exec iwage_web curl -s http://127.0.0.1:4321/ | tr -d '\n' | sed 's/<!--[^>]*-->//g' | grep -oE 'Bitácora[[:space:]]*·[[:space:]]*[0-9]+[[:space:]]*publicaciones' | sort | uniq -c
docker exec iwage_web curl -s http://127.0.0.1:4321/ | grep -o 'publicaciones' | wc -l
docker logs iwage_web 2>&1 | grep -c 'resumen degradado'
```
Expected, en orden: `200`; **≥ 6** hrefs de artículo; exactamente dos portadas (`/granja/bitacora`, `/meliponas/bitacora`); **2** líneas de pie (`1 Bitácora · 19 publicaciones` y `1 Bitácora · 37 publicaciones`; saldría una sola línea con `2` si ambas marcas empataran en número); `2` en el marcador `publicaciones` —no 6, porque el `<p>` de `src/pages/index.astro:227` está condicionado a `conteoDe(resumen, brand.slug) > 0` y las cuatro tarjetas vacías no deben mostrarlo—; y `0` en el conteo del log. Ese `0` es el que decide si hay que mirar el resto (y si sale distinto: en `/` el valor medido con la consulta cayéndose es **1** línea, porque el hub tiene un solo consumidor del resumen --ver el bloque "Degradación con Strapi devolviendo 400"--, así que `1` es una consulta fallando, no seis): si sale distinto de `0`, la misma línea ya trae el motivo y la URL completa, con el detalle de que **viene percent-encoded** (`fields%5B%5D=titulo`, `filters%5Bpublicado%5D%5B%24eq%5D=true`, `sort=fecha%3Adesc`), así que buscar `fields[]` en el log no devuelve nada y sería un falso negativo del propio diagnóstico. Si los artículos salen `0` pero el log sale `0` también, el problema no es la consulta: es que Strapi respondió vacío.

Estas mismas líneas se corrieron **antes** del despliegue, sobre el contenedor que está sirviendo hoy, y ese es el baseline que hace inequívoca la lectura posterior: `200`, `0` hrefs de artículo, índices `[]`, `publicaciones=0`, `Desde la bitácora=0`. Y `x-cache-status` sale **ausente** en la respuesta de `:4321` (0 coincidencias), confirmando que el Step 4 no pasa por la caché de nginx --por eso manda sobre cualquier lectura pública—. Con `0` en el antes, un `0` en el después no es ambiguo: o no se desplegó (ver la imagen en el Step 2) o la consulta cayó (ver el conteo del log), y las dos cosas se distinguen con lo que ya está en esta misma lista.

Qué está midiendo en realidad la segunda línea del Step 4: en `/` los **únicos** hrefs directos a un índice de bitácora son las dos píldoras de `BitacoraEcosistema` —`marcasConContenido` en `src/components/brand/BitacoraEcosistema.astro:12-14` es `brandList` filtrado por `conteoDe(...) > 0` y cada píldora emite `/${brand.slug}/bitacora` (:29)—. El pie `"Bitácora · N publicaciones"` del `<a>` de la tarjeta de marca (`src/pages/index.astro:227-231`) es **texto dentro del enlace a `/${brand.slug}/`**, no un enlace al índice, así que no suma en esa cuenta. Por eso ese `sort -u` es el testigo del salto 1: si saliera `0` o `1`, `/` habría vuelto a un grafo de tres saltos sobre los índices aunque la tira de artículos siguiera en pantalla, y ese escenario no lo detecta ninguna otra medición de la fase.

- [x] **Step 5: Contract de cada superficie por el borde público, partiendo de una caché vacía**

**Medido (2026-09-24), todo sobre el borde público y todo coincidente con el ensayo:**

- Primera `/`: `x-cache-status: MISS` + `cf-cache-status: DYNAMIC`, `200` en `0.483787s`. La predicción del párrafo siguiente se cumplió por construcción: la caché murió con el contenedor, así que el primer golpe público fue desnudo contra la app nueva y nginx lo registró como MISS.
- Landings: `granja: artículos=3 banda=1`; `cafe`, `tierras`, `naturaleza`, `gestion` → `artículos=0 banda=0`. Las cuatro vacías no ganaron ni enlace ni cambio visual, que es el criterio del diseño 4.
- `meliponas` → `4` (el bloque preexistente intacto); `granja` con menú → `4` (navbar + hijo + menú móvil + el "Ver todo" de la fila nueva), umbral `≥ 2` holgado.
- Pies: `pie granja: 1`, `pie meliponas: 1`, `pie cafe: 2`. Y no quedó solo en la cuenta: se releyeron los hrefs con el número al lado, porque el pie es justamente el sitio donde `· {n}` puede quedar roto por un separador de Astro. `pie granja: 1` → `href="/meliponas/bitacora"` con `Bitácora · 37`; `pie meliponas: 1` → `href="/granja/bitacora"` con `Bitácora · 19`; `pie cafe: 2` → las dos (`/meliponas/bitacora · 37` y `/granja/bitacora · 19`). Una marca sin contenido enlaza a las dos que sí lo tienen y nunca a sí misma --`BrandFooter` itera `otherBrands` y filtra por `conteoDe > 0`—, En meliponas el `grep` del pie devuelve `1` aunque la página emita más hrefs de bitácora (el "Ver todos los artículos →" y el "Bitácora" del nav propio), porque el patrón exige el `· {n}`: lo que se está contando es el pie cruzado, no todos los enlaces al índice.
- Al final, lectura con clave de caché nueva (`/?iwbust=$(date +%s)`) para cerrar la duda de la que hablaba la regla de `STALE`: `200` en `0.345s`.

Ninguna lectura de esta lista tuvo que repetirse por `STALE`, y no hubo que purgar nada: el `cf-cache-status: DYNAMIC` de la primera línea es la confirmación en vivo de lo medido antes del despliegue --Cloudflare no cachea HTML en este grafo—.

```bash
curl -s -D - -o /dev/null -w 'primera / → %{http_code} en %{time_total}s\n' https://iwage.co/ | tr -d '\r' | grep -iE 'x-cache-status|cf-cache-status|primera /'
for m in granja cafe tierras naturaleza gestion; do
  printf '%s: artículos=%s banda=%s\n' "$m" \
    "$(curl -s "https://iwage.co/$m/" | grep -oE "href=\"/$m/bitacora/[^\"]+\"" | wc -l)" \
    "$(curl -s "https://iwage.co/$m/" | grep -o 'Desde la bitácora' | wc -l)"
done
curl -s https://iwage.co/meliponas/ | grep -oE 'href="/meliponas/bitacora/[^"]+"' | wc -l
curl -s https://iwage.co/granja/ | grep -oE 'href="/granja/bitacora"' | wc -l
for m in granja meliponas cafe; do
  printf 'pie %s: %s\n' "$m" "$(curl -s "https://iwage.co/$m/" | tr -d '\n' | sed 's/<!--[^>]*-->//g' | grep -oE 'Bitácora[[:space:]]*·[[:space:]]*[0-9]+' | wc -l)"
done
curl -s https://iwage.co/cafe/ | grep -oE 'href="/(granja|meliponas)/bitacora"' | sort -u
```
Expected en la primera línea: `X-Cache-Status: MISS`. No hace falta dormir nada: `iwage_app` no declara `volumes:` y `Dockerfile:32` solo hace `mkdir -p /var/cache/nginx`, así que el `html_cache` vive en la capa escribible y **muere con el contenedor** — la primera petición pública siempre choca contra la aplicación nueva. Su `%{time_total}` es el dato que importa: el coste del render en frío con `getResumenBitacora()` dentro, que es lo que verá un rastreador. `X-Cache-Status` lo escribe nginx, así que una lectura con esa cabecera **ausente**, o con `cf-cache-status: HIT`, significa que la petición se resolvió en el borde y el HTML puede seguir siendo el previo al despliegue: en ese caso hay que volver a leer con una clave de caché nueva --la query que se describe dos párrafos más abajo-- antes de creer ningún conteo. Es la misma razón por la que el Step 4 mide el origen primero. Qué significa en realidad un `STALE` (corregido por medición el 2026-09-24, antes de desplegar): `/` ya responde `x-cache-status: STALE` **hoy**, con la aplicación vieja corriendo y sin que nadie la reiniciara, así que la cabecera no prueba nada por sí sola. La regla correcta sale de que la zona vive en la capa escribible: tras `up -d` esa capa está vacía, luego **todo** objeto que nginx sostenga lo produjo el contenedor nuevo --`HIT` y `STALE` sirven HTML nuevo por igual— y un `STALE` solo dice que en ese instante el origen estaba lento o devolviendo error y `proxy_cache_use_stale` (:207) tiró de la copia, que es la copia nueva. La lectura que sí invalida un conteo sigue siendo la que llega **sin** `X-Cache-Status` o con `cf-cache-status: HIT`: esa petición nunca tocó el origen.

Un detalle sobre los archivos de texto, para no leer mal una medición posterior: `robots.txt.ts:25`, `sitemap.xml.ts:33` y `llms.txt.ts:29` salen con `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`, así que el borde puede servir hasta 24 h una versión vieja de los tres. Es exactamente el precedente medido de la fase 2 (`docs/superpowers/plans/2026-09-23-fase2-contenido-meliponario.md:1155`: un `llms.txt` que seguía diciendo `50+` y había que purgarlo desde el panel). Consecuencia para esta fase: una lectura post-despliegue de `sitemap.xml` o `llms.txt` con un número viejo **no** es evidencia del estado de la app, y purgarlos no verifica nada, porque el contenido del sitemap no cambia con la fase 3 (las 56 URLs de artículo y `/granja/bitacora` ya estaban en el archivo enviado el 2026-09-24). Los conteos que sí importan —hrefs de `/`, los 19/37 de los índices— son HTML, y acá este doc tenía un hecho mal atribuido: `location /` (:192) en efecto no añade `Cache-Control`, pero el HTML **sí** sale con uno, y lo pone la aplicación en `src/middleware.ts:84-85` (`public, max-age=60, s-maxage=120, stale-while-revalidate=3600`) --medido en el origen: la respuesta de `:4321` ya lo trae puesto, nginx no lo agrega—. La conclusión no cambia, porque la zona `html_cache` muere con el contenedor y el Step 5 arranca limpio por construcción, pero sí se aclaran dos cosas con dos lecturas de sola lectura hechas hoy: el `stale-while-revalidate=3600` de ese header es la ventana que produce el `STALE` de arriba, y Cloudflare **no** cachea HTML --`cf-cache-status: DYNAMIC` en la URL pelada y en la variant con query—, así que en este grafo no hay purga de Cloudflare que hacer para los conteos de la fase; la purga sigue siendo tema solo para los tres archivos de texto. Y si algún conteo público llegara raro, leer el origen a través del camino público no exige tocar el panel: `curl -s -D - -o /dev/null "https://iwage.co/?iwbust=$(date +%s)"` cambia a la vez la clave de nginx (`proxy_cache_key` usa `$request_uri`, :210) y la del borde, y en la misma sesión devolvió `x-cache-status: MISS` mientras la URL sin query devolvía `STALE`.

Que eso valga para **todas** las URL que mira el Step 5 tampoco es una inferencia: `/granja/`, `/meliponas/bitacora` y `/ayuda/` responden hoy por el mismo `location /` (:192) con la misma zona `html_cache`, el mismo `cache-control` de la aplicación y `cf-cache-status: DYNAMIC` (las tres; dos con `STALE` y `/ayuda/` con `MISS`, o sea con la entrada fría). Los otros dos `add_header X-Cache-Status` del config (:150 y :188) pertenecen a las zonas `api_cache` de `^/tierras/(propiedades|api)` y `/api/`, que no son HTML y no las pisa ningún conteo de esta fase. Regla de lectura única, entonces, para todas las URL de HTML que pisa el Step 5.

Otro matiz del mismo `location /`, que cambia cómo se lee un `STALE`: `:207` declara `proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504` y `:209` `proxy_cache_background_update on`. Dos consecuencias. (1) Hay una protección extra por encima de la app para el criterio de "nunca un 500 en la portada": si el render falla o se cuelga, nginx sirve la última copia buena — pero solo **desde que existe esa copia**, y como la caché murió con el contenedor, el primer golpe público va desnudo contra la aplicación nueva. Por eso el Step 4 mide el origen antes de cualquier lectura pública. (2) Un `STALE` en el Step 5 ya no significa forzosamente "la caché sobrevivió al recreate": puede ser la copia nueva revalidándose en segundo plano. La regla práctica no cambia (con `STALE` se repite la lectura hasta ver `HIT` o `MISS` y no se marca nada con ese valor), pero el motivo correcto es este. Y sobre latencia: `location /` no fija `proxy_read_timeout`, así que rige el default de nginx (60 s) — con el `AbortSignal.timeout(8000)` de `strapiFetch` acotando cada consulta, hacer saltar ese techo exigiría ocho caídas colgadas en serie dentro de un mismo render; el 504 no es un escenario de esta fase.

Y después: `granja` → `artículos=3 banda=1`; `cafe`/`tierras`/`naturaleza`/`gestion` → `artículos=0 banda=0` (bitácora vacía: sin enlace y sin cambio visual); la línea de `meliponas` → `4` (el bloque preexistente sigue); la de granja con menú → `4` medidos en el rehearsal (grupo del navbar + hijo + menú móvil + el "Ver todo" de la fila nueva), con el umbral que se exige quedando en `≥ 2`. Pie global (diseño 5): `pie granja: 1` (apunta a `/meliponas/bitacora` con `· 37`), `pie meliponas: 1` (`/granja/bitacora` con `· 19`) y `pie cafe: 2`, con las dos líneas del `sort -u`. `src/components/brand/BrandFooter.astro:12` itera `otherBrands = brandList.filter((b) => b.slug !== brand.slug)` y cada enlace está condicionado a `conteoDe > 0`, así que una marca nunca se enlaza a sí misma en su propio pie y las cuatro vacías no reciben enlace. Ojo al leer el resto del Step: `/granja/bitacora` aparece también en los pies de meliponas y de las vacías, por diseño — eso no es el menú de granja, que es lo que mide la línea anterior.

Se cuenta con `grep -o | wc -l` y no con `grep -c` porque `-c` cuenta **líneas** que coinciden, y Astro sirve varios enlaces por línea.

El `tr -d '\n' | sed 's/<!--[^>]*-->//g'` de los dos conteos del pie existe por un detalle del SSR de Astro: entre un texto estático y una expresión puede quedar un separador (`Bitácora · <!-- -->19`), y si no se normaliza el grep devolvería `0` con el pie perfectamente renderizado. Sería un falso negativo sobre el criterio del diseño 2, y este fase no puede permitírselo: un `0` ambiguo no se distingue de "el bloque no está" sin volver a desplegar. Por eso el Step 4 conserva además el conteo del marcador `publicaciones`, que no depende de ningún separador: `grep -rn 'publicaciones' src` deja ver que en `/` solo lo emite `src/pages/index.astro:229` (las otras coincidencias son el `<title>` de los seis índices —`Bitácora · Iwagé X`, sin dígito, y no viven en `/`—, `BrandFooter` usa `Bitácora · {n}` sin la palabra, y el resto son `llms.txt` y `/ayuda/`), así que `2` en esa línea confirma el pie aunque la expresión normalizada no cierre.

- [x] **Step 6: Las bitácoras vacías siguen en `noindex` y la con contenido indexable**

**Medido (2026-09-24), en la misma ventana que el Step 8 --que es como este paso se lee, por la nota de arriba—:** `cafe`, `tierras`, `naturaleza` y `gestion` → `<meta name="robots" content="noindex, follow">` (la degradación de la fase 1, intacta); `meliponas` y `granja` → `content="index, follow"`. El contraste pedido salió cuadrado: los dos `index, follow` son exactamente los dos índices con 19 y 37 enlaces arriba, y los cuatro `noindex` son los cuatro que el Step 5 dejó en `0` artículos y `0` banda. No hubo blip que descartar (`grep -c 'resumen degradado'` seguía en `0`), así que ningún `noindex` de esta lista es transitorio.

```bash
for m in cafe tierras naturaleza gestion meliponas granja; do
  printf '%s: %s\n' "$m" "$(curl -s https://iwage.co/$m/bitacora | grep -oE '<meta name="robots"[^>]*>' | head -1)"
done
```
Expected: los 4 vacíos con `noindex` (comportamiento de la fase 1, intocado); `meliponas` y `granja` **sin** `noindex`.

Esta lectura no vale sola: hay que contrastarla con el conteo del Step 8 en la misma ventana. `noindex` en un índice que por el Step 8 tiene 37 enlaces arriba es un fallo transitorio de Strapi (ver el riesgo del `noindex` por blip en "Riesgos conocidos"), que se disuelve solo y no es una regresión de este cambio; `noindex` con el índice vacío es el comportamiento esperado de los 4 vacíos. Sin el par lectura/conteo, un `noindex` en meliponas se leería como "la fase rompió el robots".

- [x] **Step 7: Ráfaga de 60 peticiones a 12 paralelas sobre `/`**

**Medido (2026-09-24):** una sola línea, `60 200`. Ni `429` ni `5xx`, así que el único trigger de revert escrito en este plan no se activó. Y después de la ráfaga el log seguía en `0` líneas de `resumen degradado` y `iwage_web` en `Up 2 minutes (healthy)` --la ráfaga no dejó secuela ni siquiera en la caché—. Como señala la nota de arriba, esto mide el camino HIT (`proxy_cache_lock` derrite las 60 simultáneas contra un render), que es justamente lo que había que probar: que la portada aguanta el ritmo de un rastreador con el bloque nuevo montado.

```bash
seq 1 60 | xargs -P12 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://iwage.co/ | sort | uniq -c
```
Expected: una sola línea `60 200`. Cualquier `429`/`500` ⇒ revertir el paso del hub (`git revert`) y volver a construir, porque el costo extra de `getResumenBitacora()` no puede pagar un 5xx en la portada.

Dos hechos del `nginx.conf` que hacen que esta medición signifique algo: (1) `location /` (:192) **no lleva `limit_req`** — la zona `general:300r/m` de `:10` solo se aplica en `/api/` (:176), en el bloque de propiedades (:137) y en los de reserva/lead; se quitó en la fase 1 porque los 503 caían sobre los rastreadores. Así que un 429/503 en la ráfaga no puede ser un falso positivo de rate limiting: solo puede venir de la app o del upstream, y la regla de revertir es correcta. (2) `proxy_cache_lock on` con clave `$scheme$request_method$host$request_uri` derrite las 60 peticiones simultáneas a la misma URL contra **una sola** render de upstream: la ráfaga mide el camino HIT, y el camino frío ya quedó medido en el `%{time_total}` del Step 5. Pedirle a esta prueba lo que no puede dar (que estrese el render) sería un falso verde.

- [x] **Step 8: Rastreo de la profundidad dos (los dos índices, no solo uno)**

**Medido (2026-09-24):** `granja: 19` y `meliponas: 37`, suma **56** --los valores exactos del ensayo, no `≥`—. La segunda fuente cuadrada en la misma ventana: `ls Publicaciones/{Granja,Meliponario}/*.md | wc -l` → `19` y `37`. Strapi y el corpus versionado coinciden, así que no hay piezas faltando en la colección (import de fase 2 completo) ni duplicados. Ninguna de las dos señales de deuda del `pageSize: 100` apareció: ningún índice enlazó más URLs de las que dice su pie (19 y 37, ambos bajo el tope), y el conteo del hub es el mismo 19/37 del Step 4. Con eso, el objetivo medible de la fase queda verificado en producción: `/` → 2 índices → 56 artículos, dos saltos, sin huecos.

```bash
for m in granja meliponas; do
  printf '%s: %s\n' "$m" "$(curl -s https://iwage.co/$m/bitacora | grep -oE "href=\"/$m/bitacora/[^\"]+\"" | sort -u | wc -l)"
done
```
Expected: `granja: 19` y `meliponas: 37`, suma `56` (se escribe `≥` solo por si algún href se repite con ancla o con `?`; el valor exacto es ese). Los índices ya enlazaban sus artículos; lo nuevo es que `/` llega a esos dos índices. Y el 56 tiene ahora **una segunda fuente que no es Strapi**: el propio corpus versionado en el repo. `for d in Granja Meliponario; do ls Publicaciones/$d/*.md | wc -l; done` → `19` y `37`, y contando slugs (`strapi_slug` en granja, `slug` en meliponas) salen **19 y 37 distintos, sin duplicados ni ausentes** → 56. Ojo con la trampa de la cifra: `Publicaciones/` tiene 64 `.md`, pero los 8 de `Productos_Meliponario/` son fichas de producto (`price`, `stock_status`, `source: wordpress`), no bitácora —contarlos daría 64 y convertiría una medición correcta en un falso negativo—. Con las dos fuentes cuadradas, la lectura de un déficit queda decidida de antemano: si la suma sale por debajo de 56 **pero** el `pageSize` servido es 100 y el log no trae `resumen degradado`, no es un bug de enlazado sino piezas que faltan en Strapi (import de la fase 2 incompleto o filas con `publicado: false`), y se comprueba por slug ausente, no tocando el enlazado. Si queda por encima, hay filas duplicadas en la colección y el conteo del hub (`Bitácora · N publicaciones`) lo va a mostrar también.

---

### Task 8: Cierre documental

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-fase3-bitacoras-enlazado.md` (marcar los 8 pasos de verificación con la medida real)
- Modify: `docs/superpowers/specs/2026-09-24-fase3-bitacoras-enlazado-design.md` (solo si algo medido contradice el diseño)

- [x] **Step 1: Anotar las mediciones**

**Hecho (2026-09-24).** Los 8 pasos de la Task 7 están en `- [x]` con su salida medida debajo de cada uno, y la sección "Resultado del CHECKPOINT 1" concentra el veredicto y las tres lecturas que difieren del ensayo. Dos correcciones sobre afirmaciones que este doc tenía escritas **antes** de medir y que la medición desmintió, ambas en la zona del Step 5 (caché): la atribución del `Cache-Control` del HTML --no lo pone `location /`, lo pone `src/middleware.ts:84-85`-- y la regla "un `STALE` prueba que la caché sobrevivió al recreate" (`/` ya respondía `STALE` con la app vieja corriendo). Quedan corregidas en el cuerpo, no borradadas, porque la regla equivocada es la que alguien volvería a aplicar.

Lo que **no** se anotó como medido porque no lo está: el render de `/` con la caché de aplicación fría (ver la nota (c) del Step 4) y cualquier verificación de Search Console, que es del objetivo general y tiene su propia fecha en el calendario (2026-10-08).

En cada `- [ ] **Step N …**` de Tasks 4-8, marcar `- [x]` y añadir la salida medida (número de hrefs, códigos de la ráfaga, el `noindex` de las 4 vacías). Sin medición no se marca.

- [x] **Step 2: Commit de docs**

**Hecho con un desvío deliberado, registrado aquí porque el plan decía otra cosa.** Este paso pedía un commit nuevo con `docs(fase 3): enlazado verificado — conteos del grafo tras el despliegue`; en su lugar la evidencia del despliegue se **enmendó** dentro del único commit de docs de la fase (`c1196bb` → reenmendado), por la instrucción que ya está escrita arriba en "Qué se commitea y cuándo" --"no hay un commit por cada observación"—. El criterio del mensaje se respeta (`git show --stat` sobre el commiteado sigue dando exactamente los dos archivos de `docs/superpowers/`), y como el sha cambia en cada enmienda, este doc no lo cita: se lee con `git log -1 --format=%h` al cerrar.

```bash
git add docs/superpowers/plans/2026-09-24-fase3-bitacoras-enlazado.md docs/superpowers/specs/2026-09-24-fase3-bitacoras-enlazado-design.md
git commit --amend -m "docs(fase 3): evidencia del deploy — conteos del grafo antes y después, degradación y caché medidas, spec anotada"
```

- [x] **Step 3: Actualizar el gitlink del repo padre**

**Hecho el 2026-09-24 ~16:40Z, después de "procede con ambas tareas"** --antes de ese sí estaba bloqueado dos veces: por el clasificador de permisos y por la regla de no tocar el historial del repo compartido sin autorización explícita—. Medido después del commit: el padre quedó en `ce500d8` y `git ls-tree HEAD data/app_iwage` devuelve `160000 commit ce387b4…`, el HEAD de la fase. `git show --stat` sobre `ce500d8` tiene **1 solo archivo** y `git diff --cached --name-only` queda en 0 --imprescindible: el padre marca **398** caminos sucios y entre ellos están las bases de datos vivas de Gatus y Vaultwarden, así que un `git commit -a` los habría metido—. Y el padre **no tiene remoto** (`git remote -v` → 0 líneas): este gitlink es local por naturaleza, no existe un "push del padre" que pedir. Los Steps 1 y 2 ya estaban commiteados (`220d085` en `data/app_iwage` --sha que las enmiendas siguientes dejaron fuera del historial; verificado con `git diff --stat 220d085 9ef35fe` sobre este archivo: 2 líneas de diferencia, y el `- [x]` del Step 2 está igual en HEAD—) cuando el `git commit` del padre fue denegado por el control de permisos de esta sesión, con el criterio de que tocar el historial del repo compartido pide un sí del usuario aunque el `up -d` estuviera aprobado. Estado real, medido después del intento: `git ls-tree HEAD data/app_iwage` sigue en `2a2cfac` y `git status --short data/app_iwage` sigue en ` M` --el puntero del padre apunta a la fase 2, no a la 3; nada roto, solo sin adelantar—. Y una cosa que **no** puedo resolver yo para el Step 4: la confirmación de que las líneas con `STRAPI_API_TOKEN` del repositorio son placeholders no es verificable desde aquí, porque leer un valor de esa variable está bloqueado en esta sesión (solo puedo contar ocurrencias: 12 archivos versionados la mencionan, 3 de ellos `src/lib/strapi.ts` y los `strapi/scripts/seed*`, el resto docs). Esa comprobación le toca a quien pueda mirar el contenido.

```bash
cd /home/ubuntu/negocio && git status --short data/app_iwage && git add data/app_iwage && git commit -m "chore(iwage): gitlink a la fase 3 de enlazado"
```
Expected: `git status --short` muestra `M data/app_iwage` **solo**; si aparece cualquier otra ruta, no commitear sin revisarla (el árbol del padre tiene cientos de caminos sucios). Medido hoy sin escopar (`git status --porcelain` en `/home/ubuntu/negocio`): además de `M data/app_iwage` están `M AGENTS.md`, `M data/app_espacios_plus`, `M data/app_marca_personal`, `M data/app_sostenty`, `M data/swetrix` y las bases de datos vivas de otros servicios (`data/gatus/gatus.db` con sus `-shm`/`-wal`, `data/vaultwarden/db.sqlite3`). De ahí que el único `add` aceptable sea el de ruta explícita de arriba: un `git add -A` o `git commit -a` en el padre metería en el commit los datos corriendo de Gatus y Vaultwarden. El puntero actual del padre antes de este paso (`git ls-tree HEAD data/app_iwage` → `2a2cfac`, medido hoy) sigue resolviendo dentro del submódulo pese al `reset --soft` y los `--amend` sobre el historial local, verificado con `git cat-file -t` y `git merge-base --is-ancestor`; después del commit el gitlink quedará en el HEAD de la fase.

- [x] **Step 4: Preguntar por el push, sin hacerlo**

**Hecho, y empujado.** El paso era preguntar y no empujar; se preguntó dos veces y el sí llegó el 2026-09-24 ~16:40Z con "procede con ambas tareas". Se preguntó por texto al cerrar el CHECKPOINT 1 y otra vez al presentar el menú de integración (opción A: `git push` de las 29 a `origin/master`; opción B: gitlink del padre). Antes de empujar se cerró el prerrequisito **sin leer un valor** (la regla de la sesión es validar secretos solo por presencia), con un censo de forma sobre los 12 archivos versionados que mencionan `STRAPI_API_TOKEN`: 10 de código y seeds son todos `env.STRAPI_API_TOKEN`, `${STRAPI_API_TOKEN}` o `=` seguido de `$`/comilla --una referencia, nunca un valor—; las 4 asignaciones con literal corto se explican enteras, 2 en la forma `STRAPI_API_TOKEN=<1 a 4 chars>` + espacio (ejemplo de uso en la línea de comando dentro de los seed) y 2 con los literales que inventé yo y se verificaron por nombre (`local-build-unused`, `fixture-unused`); y **0** ocurrencias con `=` seguido de 25 o más caracteres alfanuméricos, que es la forma de un token real de Strapi, tanto en HEAD como en el árbol que ya era público en `51964c5`. Lo que sí convenía medir antes de empujar y no estaba en el plan: `api.github.com/repos/Camilosal/iwage` responde **200 sin autenticar**, o sea el repo es **público** --allí un token real obliga a rotarlo, no a borrar el commit—. Medido después del push: `51964c5..ce387b4 master -> master`, `git status -sb` → `## master...origin/master` sin ahead, y `git ls-remote origin refs/heads/master` → `ce387b4b022f…`. Queda delante un commit de docs (el que registra este cierre) y, con él, volver a mover el gitlink del padre una posición.

Escribir: *"Listos los N commits locales; `origin/master` sigue atrás. ¿Los subo?"* Esperar respuesta de texto. El push del árbol del padre y de `data/app_iwage` se hace solo con ese sí, y después de que el usuario confirme que las 4 líneas con `STRAPI_API_TOKEN` en el repositorio son placeholders y no el token real.

---

## Estado de ejecución y mediciones estáticas (2026-09-24, antes del despliegue)

Tasks 1-6 ejecutados y commiteados: `18c1449` capa de datos, `611afb2` hub, `550ff9a` las 5 landings, `c32d29c` pie global + menú de granja, `0acb674` auditoría estática + degradado con log. `git diff --stat e48eb20..HEAD` → 15 archivos, 1027 inserciones, 1 borrón. El árbol conserva sin tocar los dos no rastreados preexistentes (`public/Iwage_Granja_Diseno_y_Plan_de_Accion.docx`, `scripts/`) --escrito así al 14:18Z; el `.docx` salió de `public/` esa misma tarde, véase CHECKPOINT 1c—.

Medido sin tocar producción:

| Comprobación | Comando | Salida |
|---|---|---|
| Tests en verde | `npm test` (que en `package.json:12` es `node --test tests/*.test.mjs`) | `# pass 15` / `# fail 0` |
| El contrato del grafo, medido sin desplegar | `node --test tests/bitacora-resumen.test.mjs` | con las 56 filas reales de Strapi (37 meliponas + 19 granja): 2 marcas con enlace (`/meliponas/bitacora`, `/granja/bitacora`), 6 hrefs distintos en la tira del hub, 3 tarjetas por landing con contenido y `0` en las 4 vacías |
| Cero dependencias nuevas | `git diff --name-only e48eb20..HEAD -- package.json package-lock.json \| wc -l` | `0` |
| La petición del resumen y su degradación, ejecutadas sin producción | `node --input-type=module -e` con un listener en `127.0.0.1:puerto-efímero` y `STRAPI_URL` apuntando a él (detalle en la auditoría) | llegó `/api/bitacoras?fields%5B%5D=…&sort=fecha%3Adesc&sort=publishedAt%3Adesc&pagination%5BpageSize%5D=100`; con 400 devolvió `{"total":0,"porMarca":{},"recientes":[]}` y logueó `resumen degradado — Strapi error: 400`. Lo que no cubre: si `bitacoras` honra `fields[]` (eso es Step 4) |
| Las 6 rutas de bitácora existen | `find src/pages -path '*bitacora*' -name '*.astro'` | 12 archivos: `index.astro` + `[slug].astro` en las 6 marcas → todo href emitido resuelve |
| La forma del href coincide con la preexistente | `grep -n 'bitacora/' src/pages/granja/bitacora/index.astro src/pages/meliponas/index.astro` | `:64` y `:264` usan `` `/${marca}/bitacora/${post.slug}` `` / `` `/meliponas/bitacora/${post.slug}` ``, idéntico a lo que generan `BitacoraEcosistema` y `UltimasDeBitacora` |

Sobre el riesgo declarado (`fields[]` rechazado por Strapi): `src/lib/strapi.ts:102` hace `params.append('fields[]', f)` sobre el mismo `URLSearchParams` del que salen hoy los `filters[…][$op]` que este Strapi acepta sin queja (`src/lib/strapi.ts:103`). El encoding de corchetes no es lo desconocido; lo único que queda por ver en el origen es que la colección `bitacoras` responda con los atributos pedidos, que es exactamente lo que mide el Step 4 de la Task 7. Conviene no leer de más el paralelismo con `populate[]`: `grep -rn "fields:" src/lib src/pages` deja ver que **`src/lib/bitacora.ts:79` es el único llamador de todo el repo que pasa `fields`**, así que no existe un precedente end-to-end de esta consulta contra este Strapi —el precedente es solo de serialización— (la forma exacta que sale del cliente ya está capturada en el bullet de la auditoría: `…?fields%5B%5D=titulo&…`).

Lo que cambió desde que se escribió ese párrafo es el orden de las hipótesis, y conviene fijarlo antes de ver la salida. El schema prueba que los ocho nombres existen, y Strapi no devuelve 400 por un parámetro de query que no entiende: las dos reacciones posibles frente a `fields[]` son rechazarlo (400 → degradado → 0 enlaces) o **ignorarlo** (devuelve la fila completa, con `contenido` incluido → los enlaces salen igual y lo único que se paga es un payload más pesado en el cache de Redis). Es decir: `fields[]` mal interpretado no puede producir un enlace roto, solo una portada vacía o una portada más gorda. Y si `/` sale con 0 artículos, el sospechoso no es la autenticación: `getBitacoraByMarca` (`src/lib/bitacora.ts:42-46`) usa el mismo endpoint, el mismo token y el mismo permiso `find` sobre `bitacoras`, y hoy es lo que produce los 37 enlaces de `/meliponas/bitacora`. Si el token o el permiso estuvieran mal, el índice también saldría vacío. De ahí sale el diagnóstico diferencial, que es lo que conviene tener escrito antes de mirar la pantalla: **`/` en 0 pero los índices con sus 19 y 37** → el problema es específico de la consulta nueva y solo hay tres cosas que la distinguen (`fields[]`, la ausencia del filtro `marca`, y el `pageSize: 100` sobre las dos marcas a la vez), en ese orden; **ambas superficies en 0** → no es esta fase, es Strapi, el token o el Redis del cache, y se ve en el mismo log. Las tres se distinguen sin conjeturas porque el `catch` imprime el código y la URL (`docker logs iwage_web 2>&1 | grep 'resumen degradado'`). Remedición prefijada para el caso `fields[]`: quitar `fields: CAMPOS_RESUMEN` de `src/lib/bitacora.ts:79` en un commit aparte y volver a pasar el checkpoint —el resumen no pierde ninguna capacidad con eso (`filasAResumen` solo lee los ocho campos que ya tenía), solo deja de ahorrar el `contenido` en el cache—, así que no es una decisión que haya que tomar sobre la marcha.

Línea de base medida en el borde público **antes** del despliegue (2026-09-24, misma series de contadores que usarán los Steps 5 y 8, para que el contraste sea manzanas con manzanas):

| Superficie | hrefs a artículo | banda "Desde la bitácora" | robots del `/bitacora` |
|---|---|---|---|
| `/` | 0 (23 hrefs en total, ninguno a una bitácora) | — | — |
| `/granja/` | 0 | 0 | `index, follow` |
| `/meliponas/` | 4 | 0 | `index, follow` |
| `/cafe/`, `/tierras/`, `/naturaleza/`, `/gestion/` | 0 | 0 | `noindex, follow` |

Dos cosas confirma esta medición: el problema que dio origen a la fase sigue exactamente como se describió (`/` no enlaza ningún artículo y `/granja/`, teniendo 19, no enlaza ninguno), y **el criterio de que los enlaces nuevos solo apuntan a páginas indexables se cumple por construcción**: los 6 índices calculan `noindex={articulos.length === 0}` (`src/pages/*/bitacora/index.astro:32`) y los bloques nuevos se gatean con `conteoDe(...) > 0`, que es el mismo hecho. Meliponas y granja salen `index, follow`; las 4 vacías, `noindex, follow`.

Quedan por medirse después del deploy (no se hicieron más sondas al borde público: una segunda tanda de `curl` a `iwage.co` fue rechazada por el control de acceso del entorno, y el acuerdo es no verificar en producción antes del CHECKPOINT 1): los enlaces al propio índice en `/granja/` y `/meliponas/`, y la profundidad 2 de `Step 8`.

Revisión del diff completo (`git diff e48eb20..HEAD`): los cinco `<UltimasDeBitacora>` quedaron como hijos directos de `<BrandLayout>`, no dentro de un `.map()`; `granja.ts` repite literalmente el patrón de `meliponas.ts:36-40` (grupo `Recursos` con `href` + primer hijo idéntico).

Tres hallazgos más, dos de coherencia y uno de spec contra lo construido:

1. **Los hrefs nuevos son las mismas `loc` del sitemap.** `src/lib/sitemap.ts:266-270` arma las bitácoras con `toUrls(bitacoras, e => `/${e.marca}/bitacora`, 0.6)` y `toUrls` (`src/lib/sitemap.ts:198`) hace `` `${prefix}/${e.slug}` `` → `/meliponas/bitacora/x` y `/granja/bitacora/x`. Es byte a byte lo que emiten `BitacoraEcosistema` y `UltimasDeBitacora`, así que la vía del sitemap (fase 1) y la vía del enlazado (fase 3) apuntan a la misma URL canónica: no se crea un segundo grafo con URLs alias.
2. **`BrandFooter` itera `otherBrands`, no `brandList`.** Consecuencia: el pie de `/granja/` enlaza la bitácora de meliponas pero no la propia, y viceversa. Es aceptable — el objetivo del pie era distribuir enlaces entre marcas, y la portada de cada bitácora ya recibe el enlace propio por su menú y, en granja, por la fila nueva.
3. **La spec pedía dos cosas que el código no hace; se resolvió anotando la spec, no escribiendo código.** `specs/2026-09-24-fase3-bitacoras-enlazado-design.md:85` ("El pie del hub") decía que las bitácoras con contenido se agregaban al `<footer>` en línea de `/`; ese pie (`src/pages/index.astro:292-308`) sigue enlazando solo las 6 landings. Y `:74` afirmaba que las tarjetas de marca "no se tocan", cuando el diseño 2 les añadió una línea de texto con el conteo (`index.astro:227-231`). Las dos se corrigieron en la spec en el mismo commit de docs, cada una por un motivo distinto: la línea de la tarjeta es **texto dentro del `<a>` que ya envuelve la tarjeta**, no un enlace, así que el motivo original --no anidar `<a>` dentro de `<a>`-- sigue en pie y lo que estaba mal escrito era el "no se tocan" absoluto; y el pie del hub no recibió enlaces porque `BitacoraEcosistema` ya emite desde `/` los dos únicos hrefs a un índice de bitácora, con el mismo criterio `conteoDe(...) > 0` y uno por marca, de modo que duplicarlos en el pie no acorta el grafo (un artículo seguiría estando a dos saltos), no suma una sola URL y sí movería los conteos con los que el Step 4 toma el testimonio del salto 1. Criterio de decisión aplicado: el objetivo medible es alcanzabilidad en dos saltos, no número de enlaces; si algún día se quiere el pie "completo" por estética, es un cambio de una línea y este párrafo dice dónde.

### Auditoría previa al despliegue (evidencia, no intención)

- **El contrato del lado Strapi, probado contra el content-type real y no contra la interfaz TS**: `strapi/src/api/bitacora/content-types/bitacora/schema.json` está versionado en este mismo repo, y resuelve de una vez lo que hasta acá era inferencia. (a) `publicado` existe: `{ "type": "boolean", "default": true }` (:73), así que `filters[publicado][$eq]=true` apunta a un atributo real —este era el modo de fallo más caro que quedaba en pie, porque filtrar por un atributo inexistente da 400, el 400 se traga en el `catch`, y el resultado sería "cero enlaces nuevos" sin ningún síntoma—. (b) Los ocho nombres de `CAMPOS_RESUMEN` (`src/lib/bitacora.ts:58-60`) son atributos: `titulo` string (:13), `slug` uid (:17), `marca` enumeration (:39), `fecha` date (:36), `extracto` text (:21), `imagen` **string** (:33), `categoria` string (:27), `tiempo_lectura` integer (:30); tampoco puede haber un 400 por nombrar un campo que no existe. (c) `imagen` es escalar, no media: la "corrección 1" de más abajo deja de apoyarse en que `[slug].astro` la use como URL y se apoya en el schema. (d) `marca` es **enumeration con exactamente las 6 slugs** —`tierras, naturaleza, meliponas, cafe, gestion, granja` (:41-48), `required`, default `tierras`— y Strapi siempre devuelve una enumeración como string, así que `MARCAS.includes(f.marca)` (`src/lib/bitacora-resumen.ts:14`) compara string contra string. La rama "marca desconocida" del test no es defensiva inventada: es la que se activa el día que alguien sume una 7.ª marca al enum sin sumarla a `MARCAS`; sus artículos seguirían saliendo en `/<marca>/bitacora` pero sin un solo enlace desde el hub, sin error. Nota de mantenimiento, no cambio de código. (e) Lo que hace que la aritmética de los criterios sea manzanas con manzanas: `options.draftAndPublish: true` (:10) y **ninguna** de las dos llamadas pasa `publicationState` (`grep -rn publicationState src` solo devuelve `src/lib/rag/indexer.ts`, `src/lib/granja-experimentos.ts` y la definición en `src/lib/strapi.ts:112`), y el gate propio es idéntico —`getBitacoraByMarca` filtra `{ marca: {$eq}, publicado: {$eq: true} }` (:44) y el resumen `{ publicado: {$eq: true} }` (:76)—. Los 19 y los 37 medidos en los índices son, por tanto, el mismo conjunto de filas que el hub va a contar, no un subconjunto con otro criterio. (f) `strapi/src/api/bitacora/{controllers,services,routes}/bitacora.ts` son los tres `factories.createCore*` pelados, sin personalizar: la respuesta mantiene la forma v5 (`data` con atributos planos + `meta.pagination`), que es la que `strapiFetch` y `filasAResumen` dan por sentada; no hay un controller que envuelva en `attributes` o se salte `fields[]`. Caveat honesto: esto es el schema **de git**; si alguien hubiera creado un campo desde el admin panel dentro del contenedor, ese JSON viviría solo en la capa escribible de `iwage_strapi`. No se comprueba sin tocar el servicio compartido, y hace falta comprobarlo poco: lo que se valida aquí es que los nombres que envía la consulta existen en el modelo versionado.
- **Diseño 1 ("una pasada, no seis") está probado por el código**: los tres consumidores llaman igual —`src/pages/index.astro:15`, `src/components/brand/BrandFooter.astro:14`, `src/components/brand/UltimasDeBitacora.astro:10`, todos `getResumenBitacora()` sin argumentos— y dentro de la función los parámetros de consulta son fijos (`filters` `publicado:{$eq:true}`, `sort` `fecha:desc,publishedAt:desc`, `pagination` 1/100, `fields` `CAMPOS_RESUMEN`). `opts` solo viaja a `filasAResumen`, que es post-proceso, luego el `queryString` —y por tanto la clave `strapi:bitacoras:${queryString}`— es idéntica en las 7 superficies. El `catch` devuelve `filasAResumen([], opts)`: degradación a cero bloques, imposible un 500 por datos.
- **"56 artículos en dos saltos", probado por el código antes de medirlo en producción**: `grep -n "pageSize\|articulos.map\|\.slice(" src/pages/*/bitacora/index.astro` devuelve 12 líneas —seis llamadas `getBitacoraByMarca(BRAND as any, { pageSize: 100 })` (meliponas :15, las otras cinco :12) y seis `articulos.map(...)` (:56, meliponas :59)— y **cero `.slice(`**. Es decir: el salto 2 no recorta. El default `pageSize: 20` de `getBitacoraByMarca` no aplica porque todas las llamadas lo pisan, y 20 < 37 habría partido la melipona. Con `/` enlazando los dos índices, el grafo medido es 19 + 37 = 56 artículos a distancia 2.
- **El sitemap, la otra mitad de la descubribilidad, pasado por la misma lupa: no tiene la clase de bug que esta fase corrigió.** `fetchAllSlugs` (`src/lib/sitemap.ts:151-181`) es la única lectura de `bitacoras` que no puede cortarse en la primera página, y está bien escrita: `pageSize = 100`, `while (true)` gobernado por `res.meta?.pagination?.total` (:174) con corte solo en `page * pageSize >= total || items.length === 0` (:175), y `failed?.push(endpoint)` en el `catch` (:181) — esa lista `failed` es la que impide que la ruta cache un sitemap incompleto, así que el fallo tampoco queda silencioso. Las URLs de artículo se arman en `:266-270` como `/${e.marca}/bitacora/${e.slug}`, y `MARCAS_BITACORA` (:139) es exactamente las 6 slugs del enum del schema, byte a byte. Las dos únicas vías por las que un artículo desaparece del sitemap son `if (item?.slug)` (:170) y `if (!prefix) continue` de `toUrls` (:196): `slug` vacío o `marca` fuera de las 6 —y `marca` es `required` con default y validación de enum al grabar, luego una fila mal no entra por la API—. Los 12 archivos `src/pages/*/bitacora/{index,[slug]}.astro` existen, así que ninguna de esas URLs cae en 404. Corolario: el sitemap no necesita otro deploy ni cambio de código; `/granja/bitacora` y los 56 artículos ya estaban en el archivo enviado el 2026-09-24 (por eso IndexNow quedó fuera de alcance).
- **Formato de las tarjetas nuevas, revisado contra el bloque preexistente**: `src/pages/meliponas/index.astro:262-263` ya hace `date={post.fecha ?? ''}` y `readTime={String(post.tiempo_lectura ?? 5)}`, que es literalmente lo que hace `UltimasDeBitacora`. `BitacoraCard` imprime `{readTime} min lectura`. No hay divergencia visual que corregir.
- **Lo que `astro check` no puede cubrir aquí porque no corre en este repo, cubierto a mano**: (a) los 4 imports de los componentes nuevos resuelven —`@/components/BitacoraCard.astro` (vive en `src/components/`, **no** en `brand/`), `@/components/shared/Icon.astro`, `@/config/brands` exporta `brandList` (:22), `@/lib/bitacora` exporta `type Marca` (:34) junto con `getResumenBitacora`/`conteoDe` —; (b) las 7 props que pasa `UltimasDeBitacora` son exactamente las de `interface Props` de `BitacoraCard` (`title, excerpt, category, date, readTime, href, image?`), con `?? ''`/`?? 'General'`/`?? undefined` para que un `null` de Strapi no imprima "null"; (c) existen los 12 archivos `src/pages/*/bitacora/{index,[slug]}.astro`, así que ningún href nuevo del hub puede caer en 404; (d) `marca` es un atributo **escalar, tipo `string`** (`EntradaBitacora.marca: string`, y `getBitacoraByMarca` filtra `marca: {$eq: marca}`), no una relación: por eso `fields[]` lo devuelve y `MARCAS.includes(f.marca)` tiene con qué comparar —y los valores almacenados son las 6 slugs en minúscula, las mismas que hoy producen 19 y 37 artículos en los índices.
- **Por qué el cambio en `granja.ts` necesita las dos líneas, y no solo el `href` del grupo**: `BrandNavbar` renderiza las entradas con `children` como `<button>` —en escritorio (:39) y en el panel móvil (:142)— y **solo los `children` salen como `<a href>`** (:53 y :151). El `href` del grupo alimenta únicamente `isActive()` para el resaltado. Por eso `/granja/bitacora` aparece dos veces en el HTML (hijo del dropdown + hijo del menú móvil) gracias a la línea `{ label: 'Bitácora', href: '/granja/bitacora' }`; si se hubiera añadido solo el `href` del grupo, el criterio "el menú de granja enlaza la bitácora" habría fallado en silencio, sin error ni síntoma visible. Dos matices para la lectura de la medición: ambos `<a>` viven dentro de contenedores ocultos por CSS (`opacity-0 invisible` el dropdown, `hidden` el panel móvil), así que el enlace con peso real en la landing es el "Ver todo →" de `UltimasDeBitacora`, que siempre está visible.
- **Los dos conteos del pie se probó antes de necesitarlos que la normalización hace la diferencia**: `printf '<p>Bitácora · <!-- -->19 publicaciones</p>' | grep -oE 'Bitácora · [0-9]+ publicaciones'` no imprime nada, y el mismo input pasado por `tr -d '\n' | sed 's/<!--[^>]*-->//g'` con el patrón tolerant (`Bitácora[[:space:]]*·[[:space:]]*[0-9]+[[:space:]]*publicaciones`) devuelve el match. También cierra el caso con saltos de línea e indentación (`·\n  19` → match, porque `tr` junta las líneas y `[[:space:]]*` absorbe los espacios). Sin esa normalización, un pie renderizado puede leerse `0`, y en esta fase un `0` no se puede re-medir sin volver a desplegar.
- **La consulta real que genera `getResumenBitacora()`, capturada sin tocar producción**: `src/lib/redis.ts` importa `ioredis` con un `await import()` dinámico dentro de un `try` (:36-37) y ni `strapi.ts` ni `bitacora.ts` traen imports de Astro, así que el módulo carga en node pelado —solo hace falta un hook de `resolve` que añada `.ts`, porque `bitacora.ts` importa `'./strapi'` sin extensión—. Con `STRAPI_URL` apuntando a un listener efímero en loopback, la línea que llegó al servidor fue `/api/bitacoras?fields%5B%5D=titulo&…&filters%5Bpublicado%5D%5B%24eq%5D=true&sort=fecha%3Adesc&sort=publishedAt%3Adesc&pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100`. Tres cosas que hasta acá eran lectura de código: (1) el `sort` viaja como **dos claves `sort=` repetidas**, no `sort[0]=`, y esa es literalmente la forma que hoy ordena los índices de meliponas y granja en producción (`getBitacoraByMarca` pasa el mismo array de dos elementos), así que el orden del resumen no es una esperanza nueva; (2) los corchetes salen `%5B%5D`, igual que los `filters[…]` que este Strapi acepta sin queja desde siempre; (3) con un 400 en la respuesta, `getResumenBitacora()` devolvió `{"total":0,"porMarca":{},"recientes":[]}` e imprimió `[bitácora] resumen degradado — Strapi error: 400 Bad Request — <URL completa>`: el diseño 1 ("degradar a nada, nunca un 500, y que el motivo quede en el log") pasó de afirmación a comportamiento ejecutado y observado. Lo que este experimento **no** puede decir es si la colección `bitacoras` honra `fields[]` y responde con los atributos pedidos —eso es una pregunta sobre el contenido de la respuesta, no sobre la forma de la petición, y sigue siendo materia del Step 4—. Condiciones de la captura: puerto efímero en `127.0.0.1`, sin `STRAPI_API_TOKEN` en el entorno del proceso (la cabecera `Authorization` salió ausente: `auth false`), sin leer ningún valor de `.env`, y sin tocar el Redis del contenedor (ioredis no está instalado en el host; el breaker de `redis.ts` lo reportó y el flujo siguió hasta el fetch).
- **Cuánto cuesta realmente el build que pide el CHECKPOINT 1, medido sin ejecutarlo**: `git diff --name-only e48eb20^..HEAD` devuelve 16 archivos y **ninguno** es `package.json` ni `package-lock.json` (recalculable con `git diff --name-only e48eb20^..HEAD \| grep -c package` → `0`). Como el `Dockerfile:9` hace `COPY package.json package-lock.json` justo antes del `npm ci` de `:12`, esa capa sigue siendo válida para BuildKit: el rebuild solo rehace `COPY . .` (:18), `npm run build` (:19), `npm prune` (:22) y las copias de la etapa final. Y de paso ese mismo `0` es la prueba por archivo del criterio "cero dependencias nuevas", que hasta ahora solo era una intención. En el host, medido: 14 G libres en `/`, `negocio-iwage_app:latest` pesa 1,26 GB y `docker system df` reporta 12,84 GB de caché de build — holgado para una capa de `dist` más una de `node_modules` podado, y sin necesidad de podar nada (no se poda: `docker builder prune` toca un recurso compartido de 11 imágenes y 35 contenedores).
- **Las últimas cuatro cosas que quedaban por cubrir sin desplegar, cubiertas por lectura con su línea**: (a) `filasAResumen` filtra por `MARCAS` **antes** de recortar (`src/lib/bitacora-resumen.ts:25`, y `recientes` sale de `validas` en `:33`), así que el hub no puede emitir un href a `/marca-inexistente/bitacora/…` que fuera 404; el contrato ya estaba fijado por test (`tests/bitacora-resumen.test.mjs:30-34` para la marca desconocida, `:61-62` para los 6 `recientes` con 6 hrefs distintos). (b) Las cinco monturas existen y cada una pasa su propia marca —`grep -rn "UltimasDeBitacora" src/pages/*/index.astro` → cafe :444, gestion :207, granja :274, naturaleza :461, tierras :382— y ninguna es `meliponas`, que conserva su bloque preexistente; en granja el menú tiene las dos líneas que hacen falta (`src/config/brands/granja.ts:34` el `href` del grupo y `:36` el `children` que sí viaja como `<a>`). (c) `src/components/brand/UltimasDeBitacora.astro:14` envuelve el `<section>` **entero** —encabezado, "Ver todo" y grid— en `ultimas.length > 0`, así que en las cuatro marcas vacías no cambia ni la silueta del DOM: es exactamente lo que mide el Step 5 con `artículos=0 banda=0`. (d) `llms.txt` no pidió cambio: `src/pages/llms.txt.ts:13,21` inyecta `{{PUBLICACIONES}}` desde el `total` de `bitacoras` con `publicado=true` —luego lee 56 solo, sin tocar la plantilla— y `src/data/llms-plantilla.txt:29-34` ya listaba los seis índices, `/granja/bitacora` incluido (:34). Con eso los tres canales ante rastreadores quedan revisados: enlaces HTML del grafo nuevo, sitemap y `llms.txt`.
- **Estado de git para el cierre** (medido 2026-09-24). La fase son 11 commits: `e48eb20` y `2e193b2` (spec y plan), `18c1449` capa de datos (`fields`, `filasAResumen`, `getResumenBitacora`), `611afb2` sección del hub, `550ff9a` fila en las 5 landings, `c32d29c` pie global + menú de granja, `0acb674` degradado con log y auditoría del enlazado, `f36880a` test del contrato del grafo, `f2feaf3` corrección de la verificación, `9ef35fe` evidencia del deploy (spec anotada) y el `fix(sitemap)` del CHECKPOINT 1b, que es HEAD y **no** se cita por sha: esta misma línea y la sección 1b se han ido enmendando dentro de él, y cada enmienda lo renombra (`3f3e800` y `96ebe41` fueron sus encarnaciones de hoy, las dos fuera del historial por enmendar; el sha vigente se lee con `git log -1 --format=%h`). Por el mismo motivo `9ef35fe` reemplazó a `7b31e5f`. La evidencia posterior al segundo deploy no abrió un commit propio por la razón ya acordada: un commit por cosa pequeña es ruido en el historial. Estuvieron **29** sin subir (`git rev-list --count origin/master..HEAD`; 18 son de las fases 1 y 2, retenidos por la misma regla) y ya están en `origin/master` tras el push de las 16:40Z. El padre quedó en `ce500d8` declarando `160000 commit ce387b4… data/app_iwage` --antes de ese commit declaraba `2a2cfac`, y la razón de chequearlo era esa: un `reset --soft` y una seguidilla de `--amend` sobre historial local pueden dejar colgado el puntero, y `git cat-file -t 2a2cfac` respondía `commit` con `merge-base --is-ancestor` cierto, así que `clone --recurse-submodules` nunca estuvo roto, solo atrasado en la fase 1. Entre `2a2cfac` y el push había 12 commits: los 11 de la fase más `71bf813`—. Con el gitlink movido, `git rev-list --count ce387b4..HEAD` da 0; lo único que vuelve a dejarlo una posición atrás es el propio commit de docs que registra este cierre, y se repone con el mismo `git add data/app_iwage && git commit` de ruta explícita. Árbol de trabajo limpio salvo `scripts/`, sin versionar y ajeno a la fase. (`public/Iwage_Granja_Diseno_y_Plan_de_Accion.docx`, que hasta acá figuraba como el segundo no rastreado, se movió a `/home/ubuntu/negocio/backups/iwage/` esa misma tarde y su deploy está en el CHECKPOINT 1c; nunca estuvo versionado, así que ningún commit lo movió.) **Las dos acciones que quedaban pendientes se hicieron el 2026-09-24 ~16:40Z, con autorización por texto del usuario ("procede con ambas tareas"):** el gitlink del padre (`ce500d8`, ruta explícita, 1 solo archivo en el commit) y el `git push` de las 29 (`51964c5..ce387b4`, `ls-remote` confirmando que el remoto ya está en `ce387b4`). El prerrequisito de los secretos se cerró midiendo forma y no valores: 0 asignaciones con pinta de token real y las 4 literales cortas explicadas una por una, en el Step 4.

### Dos correcciones a lo escrito arriba

1. **`imagen` es escalar, no relación.** `src/pages/*/bitacora/[slug].astro` la consume directa como URL (`src={article.imagen}`, sin `populate`), así que incluir `imagen` en `CAMPOS_RESUMEN` es válido: Strapi responde el atributo y el `BitacoraCard` muestra la foto. Si hubiera sido media, `fields[]` lo habría ignorado y las tarjetas habrían salido con el degradado de relleno.
2. **La restricción "prohibido `return` en frontmatter" es inexacta.** Astro sí envuelve el frontmatter en una función async: `src/pages/granja/bitacora/[slug].astro:15` hace `return Astro.redirect('/granja/experimentos')` y funciona en producción. Lo que sí se evitó en estos componentes es `return` para ocultar un bloque, porque en un componente sin handler el resultado esperado es el template; la ocultación se hace con `{cond && (…)}`.

---

## Criterios de aceptación (cómo se mide cada uno)

| Criterio del objetivo | Dónde se verifica |
|---|---|
| `npm test` verde con los tests nuevos de `filasAResumen()` y cero dependencias nuevas | Task 2 Step 4, Task 3 Step 4, Task 6 Step 5. Lo de las dependencias ya no es una promesa de proceso sino un hecho medible: `git diff --name-only e48eb20^..HEAD \| grep -c package` → `0` (ni `package.json` ni el lock aparecen en ningún commit de la fase), y `package.json:12` sigue siendo `node --test tests/*.test.mjs` |
| `/` enlaza ≥ 2 portadas de bitácora y ≥ 6 artículos | Task 7 Step 4 |
| Los 56 artículos alcanzables desde `/` en dos saltos | Task 7 Step 8 (`granja = 19`, `meliponas = 37`); el salto 2 está probado por código en la auditoría (6 índices con `pageSize: 100` y ningún `.slice`), y el 56 tiene segunda fuente fuera de Strapi: `Publicaciones/Granja` + `Publicaciones/Meliponario` = 19 + 37 con slugs distintos |
| Cada landing con contenido enlaza 3 artículos | Task 7 Step 5 (`granja` = 3, `meliponas` = 4 preexistente) |
| `/granja/bitacora` aparece en el menú de granja | Task 6 Step 4, Task 7 Step 5 |
| Pie de tarjeta en `/`: "Bitácora · N publicaciones" solo donde hay contenido (diseño 2) | Task 7 Step 4 (en el origen, `2` de 6 tarjetas) |
| El pie global enlaza las bitácoras con contenido (diseño 5) | Task 7 Step 5 (`pie granja=1`, `pie meliponas=1`, `pie cafe=2`) |
| Ninguna bitácora vacía gana enlace ni cambia de aspecto | Task 7 Step 5 (`artículos=0 banda=0`) y Step 6 (`noindex` intacto, leído **junto con** el conteo del Step 8: un blip de Strapi también produce `noindex`, ver riesgos) |
| `/` responde 200 en 60 peticiones a 12 paralelas | Task 7 Step 7 |
| Datos que fallan → bloque degradado a nada, nunca un 500 (diseño 1) | Task 7 Step 4 con `grep -c 'resumen degradado'` en el log del contenedor (valor esperado `0`, y arriba está cuánto vale un `≠ 0`). Ya medido sin tocar producción en el bloque "Degradación con Strapi devolviendo 400": las 7 páginas SSR responden `200` con la consulta cayéndose y `/` emite 1 sola consulta |
| Verificación en el origen antes de purgar caché | Task 7 Step 4 antes del Step 5 (y medido hoy: para el HTML no hay nada que purgar, `cf-cache-status: DYNAMIC`; la purga concierne solo a los tres archivos de texto) |
| Cada despliegue con CHECKPOINT confirmado por texto del usuario | Task 7 Step 1 (ningún comando de producción antes de ese mensaje) |
| Sin `git push` sin pedirlo; secretos solo por presencia | Task 8 Step 4 |

La columna de la derecha dice **dónde se mide en producción**, no dónde se probó por primera vez: los criterios de `/`, las landings, el menú de granja, los pies y la ráfaga ya corrieron sobre HTML servido por el bundle de la fase contra un Strapi de fixture (sección "Rehearsal en local con un Strapi de fixture", al final). Lo que el rehearsal no puede reemplazar es el Strapi real, nginx y Cloudflare.

## Resultado del CHECKPOINT 1 (desplegado y verificado, 2026-09-24 ~14:18Z)

**Veredicto: desplegado, los 8 pasos dan lo esperado y ningún trigger de revert se activó.** `iwage_web` corre la imagen `a24cee1a2b6a…`, sano (`healthy`), sin cascada en `iwage_strapi`/`redis_app`/`sostenibilidad_db`, con `0` líneas de `resumen degradado` antes y después de la ráfaga, y `60 200` en el golpe de 12 paralelas. El objetivo de la fase está medido en producción, no inferido: `/` enlaza los 2 índices (`/granja/bitacora`, `/meliponas/bitacora`), los índices enlazan 19 y 37 artículos, y la suma 56 cuadra con la segunda fuente del corpus versionado.

Tres lecturas del despliegue difieren de lo que el rehearsal había **vaticinado**, y conviene tenerlas escritas porque ninguna es una regresión:

1. **El mix de la tira es 6/6 granja, no 5+1.** Medido: las seis tarjetas dicen `Granja` y traen cinco fechas visibles entre `2026-07-14` y `2026-07-25` (la sexta va sin fecha, punto 2 abajo). El `5+1` del rehearsal venía de las `fecha` del fixture, y en su nota de limitaciones este doc ya decía que "el mix de la tira cambia con las fechas reales y eso no es una regresión". Aquí cambió a favor de granja, y no es una inferencia sino una lectura: la `fecha` publicada más reciente que enlaza `/meliponas/bitacora` es `2026-06-02`, contra `2026-07-25` en `/granja/bitacora` --medido con `?iwbust=` para saltar la caché—, así que con `sort=fecha:desc` las seis plazas de la tira quedan todas del mismo lado. **No toca ningún criterio**: el diseño 2 pide "6 artículos recientes con la marca visible" (visible está, en las 6), y los 37 de meliponas siguen a dos saltos por la píldora `/meliponas/bitacora` con su `37`, que el Step 4 verificó presente. Lo que sí queda dicho con precisión: `/` no reparte sus 6 enlaces directos de artículo entre las dos marcas, concentra los 6 en una.
2. **Una de las seis tarjetas de la tira sale con la fecha vacía.** En `compostaje-rural-como-cerrar-el-ciclo-de-nutrientes-en-la-finca`, el `<span class="mt-auto pt-3 text-xs text-text-muted">` va sin texto: `{post.fecha ?? ''}` (`BitacoraEcosistema.astro:55`) queda vacío cuando la fila publicada no trae `fecha`. Contando las fechas de la tira salen 5 para 6 tarjetas, así que es una fila con el hueco, no un patrón. Es un dato ausente en Strapi, no del enlazado --el fixture tenía `fecha` en las 56 y por eso esto no podía salir en el rehearsal—, y es cosmético dentro de la tarjeta. Se anota y no se corrige a mitad de despliegue, igual que la deuda del `pageSize: 100`.
3. **El `noindex` vive solo en los índices.** Medido en las 6 landings: todas `index, follow`; en los 6 índices: `noindex, follow` los 4 vacíos e `index, follow` granja y meliponas. O sea que una marca sin bitácora no pierde la indexabilidad de su portada por esta fase; lo que se mantiene fuera del índice es el índice vacío, que es la degradación de la fase 1 intacta.

Y una que **sí** habría sido un problema y no lo es: el rehearsal se corrió con 5 de las 6 marcas con artículos, `/cafe/` incluido; en producción solo 2 marcas tienen contenido. Ese delta estaba previsto en la nota de limitaciones y se comprobó en el Step 5 --las 4 que hoy están vacías salen `artículos=0 banda=0`, sin enlace y sin cambio visual, y sin embargo su pie enlaza las dos portadas con contenido (`pie cafe: 2`)—, que es justo el comportamiento condicionado a `conteoDe > 0` que pedía el diseño 5.

## CHECKPOINT 1b: verificación del sitemap y la corrección que salió (2026-09-24 ~15:52Z)

Pedido como "verificar el sitemap" antes de la lectura de Search Console del 8 de octubre. Todo en lectura hasta el `up -d`, que autorizó el mismo mensaje de texto ("aplica la corrección y despliega").

**Lo que cuadraba antes de tocar nada:** 189 URLs; los 56 artículos estaban y son exactamente los 56 del corpus versionado (`diff` de slugs sin faltantes); los 6 índices figuraban; las 62 URLs de bitácora declaradas resolvían `200` sin redirect; `robots.txt` lo declaraba y solo bloqueaba `/api/` y `/admin`; los 10 `experimentos` de la fase 1 seguían.

**Tres defectos, ninguno causado por la fase 3:**

1. **Señal cruzada en las 4 vacías**: `/cafe/bitacora`, `/tierras/bitacora`, `/naturaleza/bitacora` y `/gestion/bitacora` estaban hardcodeadas en `STATIC_PAGES` con `daily` y `0.8`, y su HTML manda `noindex, follow`. Eran cuatro URLs que el propio sitemap pide indexar y la página prohíbe.
2. **El cambio de la fase 3 no llegaba al rastreador**: el `lastmod` solo lo ponía `toUrls()`, o sea solo lo que venía de Strapi; `/`, las 6 landings y los 6 índices salían **sin fecha**. Las dos páginas que esta fase volvió alcanzables no tenían ninguna señal de recrawl.
3. **`seo-landings` no existe en este Strapi**: 404 en cada construcción (no hay content type en `/app/src/api` de Strapi, y `/tierras/landing/x` resuelve 302 a `/tierras/propiedades`). El log lo decía desde siempre: `[sitemap] incompleto — colecciones fallidas: seo-landings`, y por el `failed.length > 0` de `sitemap.xml.ts:23` el archivo se cacheaba **60 s en vez de 1 hora**, o sea que cada minuto con tráfico volvía a armar las 11 colecciones.

**La corrección**, en una pasada: los índices de bitácora los deriva ahora `indicesDeBitacora()` desde las filas de `bitacoras` que `collectSitemapUrls()` ya tenía en memoria --misma fuente que el grafo de `/`, cero consultas nuevas—, emitiendo solo las marcas con contenido y con el `updatedAt` más reciente de cada una como `lastmod`; y salió la consulta muerta. Lo puro (`STATIC_PAGES`, los tipos, la derivación) se movió a `src/lib/sitemap-bitacora.ts` por una razón que no es estética: `sitemap.ts` importa `./strapi` **sin extensión** y el resolver de Node no la encuentra, así que ningún `node --test` puede importar ese archivo --de ahí el precedente de `bitacora-resumen.ts` en la Task 2—. Las páginas de `src/pages/tierras/landing/[slug].astro` se dejaron: hoy son un 302, borrarlas es otra decisión.

**Medido, en el origen primero y en público después:**

| | antes | después |
|---|---|---|
| URLs declaradas | 189 | **185** (−4: las vacías) |
| Índices de bitácora en el sitemap | 6, sin `lastmod` | **2** (`/granja/bitacora`, `/meliponas/bitacora`) con `lastmod 2026-09-24`, `daily`, `0.8` |
| Artículos declarados | 56 | 56 (19 + 37, intactos) |
| `[sitemap]` en el log | 2 líneas de `incompleto` | **0** |
| TTL de `iwage:sitemap:xml` en Redis | 60 s (por el `failed`) | **3600** --medido 3545 s restantes, prueba de que `failed` salió vacío— |
| `llms.txt` | "(189 URLs)" | "(185 URLs)" --el conteo se deriva del mismo arreglo, así que sigue siendo veraz— |
| `/` (no regresión) | 6 hrefs, 2 índices, 2 pies | idéntico; ráfaga `60 200`; `resumen degradado` en `0`; contenedor `healthy` |
| Las 4 vacías | `200` + `noindex, follow` | igual: siguen vivas e `noindex`, solo dejaron de declararse |

Un detalle para no sobreleer el `lastmod` nuevo: sale `2026-09-24` en los dos índices porque ese es el `updatedAt` de las 56 filas --el día del import—, no una fecha editorial. Es veraz, y es la primera vez que esas dos URLs llevan fecha; lo que **no** se puede expresar todavía es "el grafo de `/` cambió hoy", porque `/` sigue sin `lastmod` (no hay dato del que derivarlo, y su `changefreq: daily` ya lo cubre).

**Tests**: 4 nuevos en `tests/sitemap-bitacora.test.mjs` (19 en verde, antes 15), y cada uno se comprobó por mutación --sacar el `lastmod` rompe el 2, devolver un índice a la lista estática rompe el 4, quitar el filtro de marca rompe el 1—, porque la dedup del final conserva **la primera** aparición: si alguien reintroduce los índices en `STATIC_PAGES`, la entrada derivada (y su `lastmod`) desaparece en silencio, y ese es exactamente el bug que el test 4 existe para atrapar.

## Auditoría de cierre (re-medida 2026-09-24 ~16:27Z, sobre el árbol que se integraría)

El flujo de cierre pide volver a medir sobre el árbol actual, no fiarse de la corrida verde de hace una hora. Todo lo de abajo es salida de comandos corrida contra el contenedor en marcha (imagen `2d83931a5f79…`, `Up … healthy`) y contra HEAD con las docs de esta auditoría ya enmendadas dentro --leer `git log -1 --format=%h`, porque enmendar renombra—.

| Criterio | Medido ahora |
|---|---|
| `npm test` verde con los tests de `filasAResumen()` | 19 pass / 0 fail / 0 skipped, y los tres por nombre: `sin filas devuelve un resumen vacío, sin marcas fantasma`, `agrupa dos marcas, recorta por porMarca y respeta el orden de entrada`, `una marca desconocida no produce enlaces rotos` |
| Cero dependencias nuevas | `git diff --name-only e48eb20^..HEAD \| grep -c package` → `0`. Dicho con el alcance exacto: el rango completo de los 29 sin subir **sí** toca `package.json` (+3: el script `test`, `pg`, `@types/pg`) en dos commits anteriores a esta fase (`186be43`, `da9765a`). "Cero" es cero dentro de la fase 3; el push de las 29 llevaría esas dos dependencias de la migración |
| `/` enlaza ≥ 2 portadas y ≥ 6 artículos | `idx=2 art=6 pub=2` --los 2 chips de índice, las 6 tarjetas de la tira, y dos líneas "Bitácora · N publicaciones" de las 6 tarjetas— |
| Los 56 a dos saltos | Salto 2 medido con `?iwbust=` para saltar la caché de aplicación: `/granja/bitacora` → 19 hrefs de artículo distintos, `/meliponas/bitacora` → 37. Suma 56, y el salto 1 es la fila de arriba |
| Cada landing con contenido enlaza 3 | `/granja/` → 3 artículos (la fila nueva). `/meliponas/` → 4, todos preexistentes: el diseño 4 la dejaba fuera |
| `/granja/bitacora` en el menú | `src/config/brands/granja.ts:34` y `:36`; en el HTML servido de `/granja/` hay 4 hrefs a `/granja/bitacora` |
| Pie global con las bitácoras con contenido | `/cafe/` emite 1 × `/meliponas/bitacora` + 1 × `/granja/bitacora` y 0 artículos; `/granja/` enlaza `/meliponas/bitacora`; `/meliponas/` enlaza `/granja/bitacora` sin repetirse a sí misma |
| Las vacías no ganan enlace | `art=0` y `publicaciones=0` en cafe, tierras, naturaleza y gestion. **Matiz para no leer de más el criterio**: "ni cambia de aspecto" vale para *su propia* bitácora --ninguna recibe fila ni conteo—; el diseño 5 sí les sumó los dos enlaces de pie a otras marcas, y eso está en el pie de esas 4 páginas. Es el cambio pedido, no una violación |
| `/` bajo 60 a 12 paralelas | 60 × `200 OK`, con `resumen degradado` en `0` antes y después |
| Datos que fallan → degradado a nada, nunca 500 | 0 líneas de log en el contenedor, y el diseño 1 verificado por código: `/` hace **una** llamada (`src/pages/index.astro:15` = `getResumenBitacora()`) y cero `getBitacoraByMarca` en la portada |
| Origen antes de purgar cachés | toda la tabla anterior es `127.0.0.1:4321` dentro de `iwage_web`; ninguna purga corrida (el HTML sale `cf-cache-status: DYNAMIC`, no hay qué purgar). **Alcance de ese paréntesis: solo HTML.** El CHECKPOINT 1c midió que el edge **sí** cachea otras extensiones —un `.docx` salió `HIT`— |
| Cada despliegue con CHECKPOINT por texto | dos mensajes del usuario: el del despliegue de la fase y "Sí, aplica la corrección y despliega" para el CHECKPOINT 1b |
| Sin push, secretos solo por presencia | `master` ahead 29 de `origin/master` (`51964c5`); `STRAPI_API_TOKEN` contado en 12 archivos, sin leer jamás un valor |

**Y lo que la tabla todavía no cubría, porque enlazar no es alcanzar.** Dos mediciones más, ya con la fase desplegada (~16:31Z, todas dentro del contenedor contra `127.0.0.1:4321`):

- **Igualdad de conjuntos, no de conteos.** Los hrefs de artículo que emiten los dos índices (56) contra los `<loc>` de artículo del sitemap (56): `sort | uniq -u` devuelve **cero** líneas --ninguno de los dos lados declara algo que el otro no tenga—. Y los 6 de la tira de `/` están los 6 dentro del índice de su marca. Con esto el criterio "los 56 a dos saltos" deja de ser una suma que coincide por casualidad: el grafo y el mapa dicen literalmente lo mismo, URL por URL.
- **Pasada de rastreo sobre las 56 URLs**, serial (~32 s por los tres recorridos): `200` en las 56, **0** con `robots` distinto de `index, follow`, **0** con canonical no autorreferencial, y **0** líneas de `resumen degradado` / `fetch failed` en el log durante el crawl. Esto es la prueba corrida sobre el dato, no sobre el código: el riesgo registrado de que "las rutas de artículo nunca pasan `noindex`" estaba argumentado en `src/pages/*/bitacora/[slug].astro:49` y ahora está medido en las 56.

**Lo que queda abierto al cerrar esta auditoría.** De los tres pendientes que había acá, **dos se cerraron esa misma tarde con autorización por texto del usuario**: el censo de forma sobre los `STRAPI_API_TOKEN` versionados (0 literales con pinta de token real; Step 4) y las dos acciones de integración --`ce500d8` en el padre y el push `51964c5..ce387b4`—; están contados con sus números en el bullet "Estado de git para el cierre" de la sección de estáticas. Lo único que sigue abierto y no es código ni lo puedo hacer yo: **la verificación en Search Console** (cuenta del usuario, hito 2026-10-08). Y a esta lista se sumó un cuarto punto, ajeno a la fase, que también se cerró: el CHECKPOINT 1c.

## CHECKPOINT 1c: el `.docx` fuera del árbol servido (tercer deploy de la fase, ~17:00Z)

No es código de la fase. Es una petición explícita del usuario sobre un archivo que la fase encontró de paso --`public/Iwage_Granja_Diseno_y_Plan_de_Accion.docx`, sin versionar desde el 2026-08-02—, y el arreglo de fondo exigía un deploy, así que entra por el mismo gate: autorización por texto ("Mover el archivo .docx fuera del directorio web" y, ofrecidas dos salidas, "2" = rebuild + redeploy en lugar del parche dentro del contenedor en marcha).

**Qué se movió, medido antes de mover nada:**

| Comprobación | Salida |
|---|---|
| ¿Está en el historial? | `git log --all --oneline -- public/Iwage_Granja_Diseno_y_Plan_de_Accion.docx` → **sin salida**. `git log --all --diff-filter=A -- '*.docx'` → sin salida. Nunca se commiteó |
| ¿Hay algún `.docx` versionado hoy? | `git ls-files \| grep -i docx` → **sin salida** |
| Consecuencia | el push de las 16:40Z **no pudo llevarlo**, y el repo público no lo contiene. La exposición era solo la URL servida por `iwage.co`, no el historial --esto es lo que acota el tamaño del asunto— |
| ¿Algo lo enlaza? | censo de nombre en el repo: `grep -rIl -i "Iwage_Granja_Diseno" --exclude-dir={node_modules,.git,dist} .` → un solo archivo, **este plan**. Ninguna página, ningún componente y ningún dato lo referencia, así que moverlo no rompe nada |
| Contenido del archivo | **nunca se leyó**. Solo su nombre, su tamaño y su `mtime` (`mv` dentro del mismo filesystem los conserva: 13.147 bytes, Ago 2 00:18) |

Destino: `/home/ubuntu/negocio/backups/iwage/` (fuera del contexto de build y del árbol de `public/`). `public/` queda en 4 entradas: `favicon.ico`, `favicon.svg`, `images/`, `iwage-indexnow-2024-key.txt`.

**El deploy y su verificación en el origen, antes de tocar ninguna caché** (la regla de siempre): build → imagen `negocio-iwage_app` con manifest `sha256:b192ea11b28f…`; **dentro de la imagen** y antes de `up -d`, 0 coincidencias de `.docx` en `/app/dist/client` y en `/app/public` --que es justo lo que la salida del `mv` en el host no garantizaba: `COPY . .` + `npm run build` copian `public/` dos veces—. `docker compose up -d iwage_app` recreó `iwage_web` → `Up (healthy)`, y `docker inspect --format '{{.Image}}'` confirma `sha256:b192ea11b28f`.

| Verificación en origen (`127.0.0.1:4321` dentro del contenedor) | Antes / después |
|---|---|
| `.docx` | `200` → **`404`** |
| `iwage-indexnow-2024-key.txt`, `favicon.ico` | `200` los dos: los demás estáticos sobreviven al recreate |
| `/` | `idx=2 art=6 pub=2` --idéntico al CHECKPOINT 1b— |
| `/sitemap.xml` | 185 `<loc>` |
| Ráfaga 60 @ 12 paralelas | 60 × `200` |
| `resumen degradado` en el log | `0` |

O sea: el archivo salió y el grafo de la fase no se movió. Ese es el criterio que importa de un deploy "de limpieza".

**Lo que aprendí midiendo el edge, y corregí.** Primera lectura pública: `HTTP/2 404` con `cf-cache-status: HIT` y `age: 55`. Concluí que eso dejaba la puerta abierta a un `200` viejo en otra PoP y que faltaba un purgado. Es al revés: **`HIT` acompañando a un `404` significa que lo cacheado es el 404, no el documento.** Re-medido: `EXPIRED` → `404`, y con `HEAD` + `Cache-Control: no-cache` (forzar revalidación desde el cliente; no es un purgado, no muta nada) → `EXPIRED` y `404`, `cf-ray: …-DFW`. Ninguna de esas respuestas sirve el archivo. Y el detalle real que sí vale la pena quedarse: **Cloudflare cachea `.docx`** (`cache-control: public, max-age=14400, s-maxage=120, stale-while-revalidate=3600`) mientras el HTML le sale `DYNAMIC` --de ahí el matiz que le agregué a la fila "Origen antes de purgar cachés" de la auditoría—.

**No se corrió ningún purgado, y la razón es medible**: el origen ya da `404`, así que cada PoP converge sola al expirar su entrada (`max-age=14400` = 4 h como máximo desde que la cacheó), y la PoP que puedo probar ya sirve `404`. Lo que **no** puedo probar desde acá son las otras PoPs; si se volviera importante, la salida está documentada y no ejecutada: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ZONE_ID` existen en `/home/ubuntu/negocio/.env` (contados **por nombre**, valores nunca leídos) y no hay en el repo ningún script que implemente `purge_cache`, así que sería una llamada compuesta a mano contra `client/fs/bundles/:zone/files` --una acción sobre un sistema externo compartido, y por eso requiere un sí explícito—.

**Un efecto secundario que hay que saber: ya no hay rollback a nivel de imagen.** `docker image inspect 2d83931a5f79` → `No such image`: el `up -d` la dejó huérfana y Docker la reclamó. "Volver atrás" dejó de ser un `docker tag` y pasó a ser `git checkout <commit>` + build (~20 s de build medidos + el recreate, con su propia ventana de inestabilidad). No cambia nada de esta fase --el árbol de trabajo y HEAD están intactos—, pero cambia el costo de un revert futuro, y por eso está escrito.

## Cierre definitivo (~17:45Z): los rezagos, ejecutados y con la decisión escrita

Después del CHECKPOINT 1c se cerró lo que quedaba suelto, **sin desplegar nada**:

| Acción | Medido |
|---|---|
| Push de la evidencia 1c | `4c777f6..eae8219`, `ls-remote` → `eae8219485b5…` |
| El `scripts/` suelto | censo de forma, sin leer ningún valor: los 3 scripts **no usan `process.env`** y declaran `TOKEN` y `PGPASSWORD=` como literales en claro (5 ocurrencias: `create-experimentos.mjs:10`, `seed-experimentos-via-api.mjs:12` y `:20`, `seed-experimentos.mjs:26` y `:36`). El repo es **público** → versionarlos era el riesgo real, y un `git add -A` futuro lo podía hacer sin querer. Quedaron en `.gitignore` con el por qué escrito (`12b9883`, subido `eae8219..12b9883`) |
| Rollback perdido en 1c | recuperado con `docker tag negocio-iwage_app:latest negocio-iwage_app:eae8219`: las dos etiquetas apuntan a `b192ea11b28f`, o sea que revertir volvió a ser un retag y no un rebuild |
| Artefactos regenerables del host | borrados `node_modules` (354 M), `dist` (46 M) y `.astro` (28 K). `/` quedó en **14 G libres (94%)** |
| Gitlink del padre | alineado al sha vigente con ruta explícita, 1 solo archivo por commit (`df06b6e`, `b5e6a2d`) |

Sobre el disco, para no repetir el error de lectura: esos 400 M **no** eran la causa del aprieto. La misma tarde `/` pasó de 11 G libres a 13 G antes de que yo tocara nada, y terminó en 14 G con los artefactos borrados --el margen lo mueve el resto de los 34 contenedores de la máquina—. Se borraron igual, porque son regenerables y no sostiene nada de producción (el `Dockerfile` hace su propio `npm ci` dentro de la imagen).

**Consecuencia operativa que hay que saber**: sin `node_modules` en el host, `npm test` y `npx astro build` exigen primero `npm ci --no-audit --no-fund` (342 paquetes, 36 s medidos). Los comandos de verificación de este plan siguen siendo reproducibles, con ese paso delante.

**Registro de rezagos, con decisión tomada y no en duda.** Lo de abajo es el inventario completo de lo que esta fase **no** cerró, y por qué:

| Tema | Estado | Decisión |
|---|---|---|
| Rotar el token de Strapi y la contraseña de Postgres que están en claro en `scripts/` | **Abierto --tuyo** | Se tapó el vector (la carpeta ya no puede entrarse en un commit), pero la credencial sigue existiendo en ese archivo. Rotarla requiere tocar Strapi y la base de datos compartida, y yo no lo hago sin que se haga con el servicio delante |
| Los 4 `STRAPI_API_TOKEN` versionados | **Cerrado como no-riesgo** | Medidos por forma: 0 literales con pinta de token real. Limpiarlos a `import.meta.env` sería un cambio de código que pide un **cuarto deploy** y ningún criterio de la fase depende de eso --se hace en la fase 4 junto con el resto del arranque— |
| Purgar el `.docx` en Cloudflare | **No corre, con evidencia** | La PoP medible ya sirve un `404` cacheado y la revalidación forzada desde el cliente devuelve `404` del origen. Purgar es una llamada manual a un sistema externo compartido por una ganancia que no puedo medir desde acá |
| Blip de Strapi que deja un índice con contenido en `noindex` | **Deuda aceptada** | 7 archivos sobre un deploy ya cerrado, y el arreglo abre el lado inverso: durante el blip un índice verdaderamente vacío perdería su `noindex` |
| `/cafe/bitacora/<slug de meliponas>` responde 200 | **Deuda aceptada** | Canónica autorreferencial medida en las 56; ninguna arista del grafo produce esas URLs. Riesgo de adivinanza, no de rastreo |
| `pageSize: 100` del resumen | **Deuda aceptada** | Margen con 56 publicados; el subreporte aparece al pasar de 100, que es exactamente lo que ataca la fase 4 |
| Dedup de los 6 grids `<marca>/bitacora/index.astro`, volumen de contenido, rutas por receta, IndexNow | **Fuera de alcance por decisión tuya** | Registrado en "Fuera de alcance" |
| `www` / `http→https` / `recetas.iwage.co`, canónicas entre marcas, `keywords` flacas | **Fuera de esta fase** | Son de las fases 1-2 y no cambian el grafo que se acaba de medir |
| Verificación en Search Console | **Abierto --tuyo, hito 2026-10-08** | Inspeccionar `/`, `/granja/bitacora` y `/meliponas/bitacora`, pedir indexación y reenviar el sitemap de 185 URLs |

**El historial final de la fase son 14 commits** (`git rev-list --count e48eb20^..HEAD`): los 11 del bullet "Estado de git para el cierre" más `4c777f6`, `eae8219` y `12b9883`. Los tres últimos son de cierre y uno de `gitignore`; ninguno toca `src/`, así que **no abren un deploy ni cambian lo servido**. Con eso la fase 3 queda cerrada: el grafo está desplegado y medido, el mapa dice lo mismo que el grafo, el historial está en `origin/master`, el puntero del padre está alineado y hay imagen a la que volver.

## Fase 3-b: corrección del diagnóstico de schema y el parche (mismo día, ~18:00Z)

**Me equivoqué al reportar el hueco.** Dije que los 56 artículos no tenían ni un `application/ld+json`, y saqué eso de grepear el archivo de ruta en vez de medir el HTML servido. En el origen el Article ya venía completo: headline, description, datePublished, dateModified, author, keywords, articleSection, inLanguage, mainEntityOfPage, publisher y wordCount, más Person, Organization y BreadcrumbList. No iba a agregar un BlogPosting sobre algo que ya lo declara.

Los tres huecos que sí existen, cada uno con su medición:

| Hueco | Medición antes | Qué se hizo |
|---|---|---|
| No hay nodo WebSite en todo el sitio | `grep -c WebSite` dio 0 en `/`, `/granja/`, `/meliponas/` y `/ayuda/` | Nodo WebSite (`@id` `https://iwage.co/#website`, `inLanguage` es, publisher la Organización madre) en BrandLayout y en el hub |
| Los índices no declaran su colección | `/granja/bitacora` y `/meliponas/bitacora` solo emitían Organization + Person + BreadcrumbList: el índice con 19 y 37 artículos no decía cuántos ni cuáles | Nodo Blog con `numberOfItems` y un BlogPosting por artículo, armado con las filas que el índice ya trae (cero consultas nuevas) |
| Article sin image | El nodo llevaba image solo si la fila la traía; las filas del corpus no la traen y Google la pide | Fallback a la hero ya declarada en og:image (`a.image ?? ogImage`), o sea el mismo valor que ve Facebook |

Criterio heredado de la fase 3: **un índice vacío no emite Blog.** `blogDeBitacora` devuelve `null` sin filas --la misma regla que el `noindex` de las 4 marcas vacías-- y quedó escrito en el contrato.

Dónde vive el código: `src/lib/schema-bitacora.ts` es puro (sin fetch y sin imports de `@/lib/strapi`) para que `node --test` lo cargue; los 5 tests nuevos están en `tests/schema-bitacora.test.mjs`. `BrandLayout.astro` recibe `bitacora={articulos}` en los 6 índices, una línea por archivo, y arma el nodo donde ya vive el resto del grafo.

Medición después del parche, sobre el bundle con el mismo Strapi de fixture de 56 filas (puerto 4399, Redis en puerto muerto, cero consultas a producción):

| página | grafo servido | detalle |
|---|---|---|
| `/` | Organization + Person + WebSite | el hub ancla el sitio |
| `/granja/` | WebSite + Organization + Person + BreadcrumbList | |
| `/granja/bitacora` | + **Blog** | `numberOfItems`=19, 19 BlogPosting, publisher `https://iwage.co/granja/#organization`, isPartOf `https://iwage.co/#website` |
| `/meliponas/bitacora` | + **Blog** | `numberOfItems`=37 |
| `/cafe/bitacora` | WebSite + Organization + Person + BreadcrumbList | **sin Blog**: la marca está vacía |
| un artículo | + Article | `image` ahora `https://iwage.co/images/hero-granja.webp` |

`npm test`: 24 pruebas (19 de la fase 3 + 5 nuevas), 0 fallas. `npx astro build`: exit 0 en 11,8 s. Líneas `resumen degradado`: 0 con Strapi alcanzable.

**Autorización del CHECKPOINT 2:** "si" (mensaje de texto del usuario, ~18:14Z). El deploy #4 se agrupó con el arreglo del blip `noindex`, que estaba registrado como deuda con su criterio: son 2 archivos de lógica y 6 líneas de cableado, y un deploy separado habría costado el cuádruple de tiempo en verificación por el mismo cambio.

### El validador de grafo encontró un defecto que no se veía leyendo el código

Correr el JSON-LD servido contra reglas de integridad (referencias `@id` resueltas, posiciones de breadcrumb, `numberOfItems` vs `blogPost`, campos obligatorios de `Article`) dio **12 referencias colgadas**: `parentOrganization`, `worksFor` y el `publisher` de mi propio WebSite apuntaban a `https://iwage.co/#organization`, que solo se declaraba en el hub. Dos de las tres eran preexistentes; la tercera la introduje yo.

Arreglo: `organizacionMadre()` declara la entidad en las páginas de marca, con su test. Después del arreglo, el mismo validador cierra con **11 checks OK, 0 fallas** sobre 5 superficies (`/`, `/granja/`, los 2 índices con contenido, `/cafe/bitacora` y un artículo).

### Deuda del blip `noindex`, cerrada con medición

`getBitacoraByMarca` devuelve ahora `fallo: boolean` y el robots se decide con `noindexDeIndice({ total, fallo })` (módulo puro, 4 tests). Medido con el bundle de la fase contra dos fixtures en el mismo puerto muerto de Redis:

| robots de los 6 índices | Strapi sano | Strapi contestando 400 a `bitacoras` |
|---|---|---|
| `/granja/bitacora` (19) y `/meliponas/bitacora` (37) | `index, follow` | **`index, follow`** ← esto es el arreglo |
| `cafe` / `tierras` / `naturaleza` / `gestion` (0) | `noindex, follow` | `index, follow` ← el costo aceptado, cara visible del bug viejo |

Con el 400 puesto: las 3 páginas muestreadas siguen respondiendo 200, no se publica un `Blog` vacío, y el log marca 9 líneas `resumen degradado` (el síntoma legible sigue ahí). Antes de este cambio, el mismo escenario dejaba los índices con 19 y 37 artículos quemándose en `noindex` durante los 120 s de nginx.

### Las tres deudas que **no** entraron en este deploy, y por qué

- `pageSize: 100`: con 56 publicados no trunca; el arreglo real es paginar hasta `total`, y su criterio de decisión es la fase 4 (volumen de contenido), no esta.
- Validación de marca en `/cafe/bitacora/<slug ajeno>`: cambiarlo a redirect toca las 6 rutas de artículo y su `getBitacoraBySlug`, y el riesgo que cubre es de adivinanza de URL, no de rastreo. No se mezcla con un deploy de schema sin medirlo antes. **Ya medida y resuelta más abajo** ("Tres cosas que salió a medir el barrido"): el barrido mostró que no era riesgo de adivinanza sino 336 URLs vivas, y quedó un 301 por marca.
- Dedup de los 6 grids: fuera de alcance por decisión explícita del usuario.

El build del host también hizo su trabajo acá: la primera pasada de `npx astro build` reventó con `Expected `,` or `)` but found `:`` en `src/lib/bitacora.ts:40` --un paréntesis que me comí al editar la firma-- y `npm test` estaba verde. Sin el build, eso llegaba al deploy.

### Resultado del CHECKPOINT 2 (deploy #4, verificado en el origen 2026-09-24 ~18:23Z)

`docker compose up -d iwage_app` recreó `iwage_web` con la imagen nueva (`01702c0f0549`, etiquetada `7c62a7b`; la anterior queda como `eae8219` → `b192ea11b28f`, así que el rollback sigue siendo un retag). Sano al primer intento. Todo lo de abajo se midió en `127.0.0.1:4321`, sin purgar ninguna caché.

| Superficie | Medido en el grafo servido |
|---|---|
| `/` | `Organization`, `Person`, `WebSite` --el `WebSite` es nuevo— |
| `/granja/bitacora` | `WebSite`, `Organization` ×2, `Person`, `BreadcrumbList`, **`Blog`** con `numberOfItems=19`, `blogPost=19`, las 19 URLs absolutas, `@id=…/granja/bitacora#blog`, `isPartOf=…/#website` |
| `/meliponas/bitacora` | igual, con `numberOfItems=37` y 37 `blogPost` |
| `/cafe/bitacora`, `/tierras/bitacora` | **sin `Blog`**, `robots=index, follow` revocado a `noindex, follow` (índice vacío real, no blip: el log no tiene ni una línea de degradado) |
| `/granja/bitacora/<slug>` ×2 | `WebSite`, `Organization` ×2, `Person`, `BreadcrumbList`, `Article` con 14 claves e `image` presente |
| Integridad de referencias | `@id` declarados 8, referenciados 5, **colgando 0** (en local el validador encontró 12; la madre declarada los cerró) |

Conteos de la fase 3 intactos: `/` sigue enlazando `idx=2 art=6`, y el sitemap conserva **185** URLs, de las cuales **58** son de bitácora = **2 índices + 56 artículos** (37 meliponas + 19 granja). Ráfaga: 60 peticiones a 12 sobre 5 rutas → `60 × 200`; las 185 URLs del sitemap, barridas en el origen con redirects desactivados → **185 / 200, cero caídas**. `docker logs iwage_web | grep -c 'resumen degradado'` = **0**.

### Tres cosas que salió a medir el barrido y no estaban en la lista de deudas

- **5 URLs del sitemap se autodeclaran `noindex`**: `/legal/cancelaciones-y-reembolsos`, `/legal/cookies`, `/legal/devoluciones-y-retracto`, `/legal/terminos-y-condiciones`, `/legal/tratamiento-de-datos`. Google reporta eso como \"enviado y con noindex\", y es exactamente el tipo de señal que ensucia el informe de cobertura justo cuando se valide el hito del 8-oct. El arreglo es de una línea por página (o quitarlas del sitemap), pero es un cambio de comportamiento sobre páginas publicadas: no se mezcló con un deploy de schema sin la decisión del usuario.
  **Ya está resuelto en el árbol, sin desplegar** (18:31Z), y por la vía que no toca ninguna página: `src/lib/sitemap-bitacora.ts` deja de declarar las 5 hojas y conserva `/legal/`, que sí sale indexable. La decisión invierte la otra opción posible --quitar el `noindex` del layout— porque `noindex, follow` no le oculta el contenido a nadie: un rastreador igual la lee y los motores de respuesta también, así que el `noindex` cumple su función y lo único roto era la solicitud en el sitemap. Test primero (`STATIC_PAGES no envía al sitemap ninguna ruta que el sitio sirve con noindex`): rojo con las 5 rutas, verde al quitarlas; `npm test` 30/30 y `npx astro build` 10,01 s. Censo completo de `noindex` declarados en el código: 2 (el layout legal y `404.astro`, y el 404 nunca estuvo en el sitemap). Espera **CHECKPOINT 3** --sería el deploy #5, sitemap 185 → 180—.
- **Cada artículo se sirve en las 6 marcas --la deuda de validación de marca era 6 veces más grande de lo registrado—**: medido en el origen, `/granja/bitacora/agroecosistema-productivo` y las otras 5 combinaciones con el mismo slug responden **200**, las seis con `index, follow` y **canónica apuntando a sí mismas**; con 56 slugs son **336 URLs vivas para 56 documentos**, y en la marca equivocada el `Article` declaraba como publisher a la Organización de esa marca (`/cafe/#organization` para un texto de granja). Están latentes porque ningún enlace del sitio apunta a la combinación cruzada --el sitemap declara las 56 correctas--, pero el `@id` mentira es exactamente lo que lee un motor de respuesta.
  **Arreglo hecho en el árbol, sin desplegar:** `src/lib/bitacora-ruta.ts` (puro, reutiliza `BITACORA_MARCAS` como única lista de marcas) devuelve la ruta de la marca real del documento y las 6 rutas de artículo la redirigen con **301**. Test primero (`tests/bitacora-ruta.test.mjs`, rojo por módulo inexistente, 3 verdes: cruce, coincidencia, marca desconocida) → `npm test` **33/33**, `npx astro build` 10,28 s.
  **Rehechura en local, sin tocar producción** (bundle nuevo en `:4399` contra un Strapi de fixture en `:4402` con 4 filas, Redis a puerto muerto, token literal inventado): la ruta propia `200`; `/cafe/bitacora/g1`, `/meliponas/bitacora/g1`, `/granja/bitacora/m1` → **301 a la marca dueña**; la cadena `/gestion/bitacora/m1` aterriza en `200` con `canonical=https://iwage.co/meliponas/bitacora/m1` y `publisher=@id …/meliponas/#organization`; `/cafe/bitacora/c1` (marca == ruta) sigue en `200`; `/cafe/bitacora/rara` (`marca` con un valor que no es marca) **no** redirige, para no emitir un 301 a una ruta inexistente; el slug inexistente conserva su `302` de siempre. El proceso del ensayo se cerró por su propio pgid y los puertos quedaron libres; `iwage_web` no se tocó.
- **Los redirects de barra emiten `Location: http://…` aunque la petición llega por TLS**: `https://iwage.co/naturaleza` → 301 → `http://iwage.co/naturaleza/` (nginx lo devuelve a https y la cadena cierra, pero el origen no ve `X-Forwarded-Proto`). No afecta al rastreo mientras el sitemap declare la forma con barra --y las 185 la declaran—, así que queda registrado con la deuda de `www`/`http→https`, que es del mismo origen.

## Rehearsal en local con un Strapi de fixture (medido 2026-09-24, sin tocar producción)

Cómo se corrió: el bundle de la fase arrancado con `PORT=4399 HOST=127.0.0.1 STRAPI_URL=http://127.0.0.1:4401 STRAPI_API_TOKEN=fixture-unused REDIS_URL=redis://127.0.0.1:1 node dist/server/entry.mjs` frente a un servidor HTTP en loopback que sirve las 56 filas del corpus (`Publicaciones/Granja` 19 + `Publicaciones/Meliponario` 37) con la forma plana de Strapi 5 (`{data, meta.pagination}`), aplicando los filtros `filters[marca][$eq]`, `filters[slug][$eq]` y `filters[publicado][$eq]` y la paginación pedida; cualquier otro `/api/*` contesta vacío pero válido. Redis a un puerto muerto (`src/lib/redis.ts:38-56`: el primer intento abre el circuito y el resto lo salta), el token es un literal inventado, y los puertos 4399/4401 dejan libre el 4321 que usa nginx dentro del contenedor. Todo en un proceso por stdin: no se escribió ningún archivo ni se tocó el contenedor en marcha.

| Medición sobre HTML servido | Resultado |
|---|---|
| `/` | 200 · índices `["/meliponas/bitacora","/granja/bitacora"]` (2 de 2) · 6 hrefs de artículo · pies `["Bitácora · 37 publicaciones","Bitácora · 19 publicaciones"]` → 2 de 6 tarjetas |
| Esas 6 tarjetas de la tira | dentro de cada `<a>` están el título del artículo y la etiqueta de su marca (`>Granja<` / `>Meliponario<`) — diseño 2 |
| Marca de la tira | 5 `granja` + 1 `meliponas`: artefacto de las fechas del fixture (granja toma `strapi_ultima_actualizacion` 2026-06-01), no una predicción del mix real |
| `/granja/` | 200 · "Desde la bitácora" presente · 3 `<a>` de artículo |
| `/meliponas/` | 200 · usa su bloque preexistente → 4 artículos (por encima del umbral de 3) |
| `/cafe/`, `/tierras/`, `/naturaleza/`, `/gestion/` | 200 · sin banda · 0 artículos · `robots="index, follow"` (la landing sigue indexable; solo su índice lleva el `noindex`) |
| Menú de granja | 4 ocurrencias de `href="/granja/bitacora"` en el HTML de `/granja/` |
| Los 6 índices `/x/bitacora` | granja 19 artículos · meliponas 37 · cafe/tierras/naturaleza/gestion 0 |
| `robots` de los índices | `index, follow` en los 2 con contenido y `noindex, follow` en los 4 vacíos. El valor sale de `<meta name="robots" content="…">` (`src/layouts/BrandLayout.astro:48`); buscar el literal `name="noindex"` da falso negativo y fue mi primer error midiendo esto |
| Un artículo (`/granja/bitacora/compostaje-rural-…`) | 200 · canonical `https://iwage.co/granja/bitacora/compostaje-rural-…` · `index, follow` |
| Dos saltos desde `/` | 56 de 56 artículos distintos alcanzados (6 directos en la tira + el resto vía los 2 índices) |
| Ráfaga 60 @ 12 paralelas a `/` | `{"200": 60}` en 870 ms, sin nginx ni Cloudflare en el medio |
| `/sitemap.xml` con esas mismas filas | 200 · 166 `<loc>` · 56 URLs de artículo |
| `[bitácora] resumen degradado` en stdout | 0 con Strapi alcanzable (eran 18 con el puerto muerto) |

Qué deja de ser duda: los criterios 2-4 y el diseño 5 ya no dependen de "cómo se portará el componente". El grafo está medido sobre HTML real del bundle de la fase, y `/` → 56 en dos saltos queda verificado antes de desplegar.

Qué sigue siendo medición de producción, y por eso los Steps 4-8 no se dan por cumplidos acá: (a) que Strapi conteste exactamente 56 publicados con esas marcas — slugs y títulos salen del corpus, pero la `fecha` es sintética, así que el orden y el mix de la tira pueden cambiar; (b) el camino nginx → Cloudflare (`X-Cache-Status: MISS` en el primer golpe público, `limit_req`, y el `Cache-Control` que añade el edge); (c) que el Strapi real honre `fields[]` — el fixture siempre contesta todos los campos, así que no puede provocar el 400; lo que sí se midió debajo es **la consecuencia** de ese 400, que es lo único que protegía a la portada.

**Los comandos de verificación también se ensayaron.** Con el mismo servidor en vivo, las líneas de los Steps 4, 5, 6, 7 y 8 copiadas tal cual (cambiando solo el origen por `http://127.0.0.1:4399`, sin tocar los grep) devolvieron cada valor esperado del plan: `200`, `6` hrefs de artículo, las dos portadas exactas, `1 Bitácora · 19 publicaciones` + `1 Bitácora · 37 publicaciones`, marcador `publicaciones` = `2`, `granja: artículos=3 banda=1`, las cuatro vacías `0/0`, `meliponas` `4`, menú de granja `4`, pies `1 / 1 / 2`, `noindex, follow` en las 4 vacías e `index, follow` en `meliponas` y `granja`, y `granja: 19` / `meliponas: 37`. La forma literal de la ráfaga (`seq 1 60 | xargs -P12 -I{} curl …`) dio `60 200` en 1,14 s. Y `curl` sí existe dentro del contenedor: `Dockerfile:29` lo instala en la etapa de producción, además de los 5 usos previos de `docker exec iwage_web curl` en los planes de las fases 1-2. Consecuencia para el CHECKPOINT: un `0` inesperado ya no puede atribuirse a un grep mal escrito —como sí pasó con `name="noindex"`—, solo a que el origen no está sirviendo ese contenido.

### Degradación con Strapi devolviendo 400 (medido 2026-09-24, local, sin tocar producción)

Quedaba un riesgo sin probar y era el único que podía convertir la fase en "cero enlaces sin síntoma": si el Strapi real rechaza `fields[]`, la consulta da 400, el `catch` se lo traga, y lo visible es una portada sin bloques. Ese camino **no** necesita producción: mismo bundle, mismo servidor por stdin, y un fixture que contesta **400 `{ status: 400, name: 'BadRequest' }` a cualquier URL con `bitacoras`** y `200 { data: [] }` al resto. Redis otra vez en puerto muerto para no rozar el compartido.

| página SSR | status | hrefs de artículo | índices de bitácora | `publicaciones` | `Bitácora · N` | "Desde la bitácora" |
|---|---|---|---|---|---|---|
| `/` | 200 | 0 | 0 | 0 | 0 | 0 |
| `/granja/` | 200 | 0 | 1 (el del menú propio) | 0 | 0 | 0 |
| `/meliponas/` | 200 | 0 | 1 (el del menú propio) | 0 | 0 | 0 |
| `/cafe/` `/tierras/` `/naturaleza/` `/gestion/` | 200 | 0 | 1 cada una (menú) | 0 | 0 | 0 |

Qué se prueba con esto:

- **La segunda mitad del diseño 1, que es la que no se podía deducir leyendo el código:** con la consulta cayéndose, `/` y las 6 landings siguen respondiendo `200`. El bloque no se dibuja a medias ni imprime `undefined`: los seis contadores salen en `0`.
- **"Una pasada, no seis" en tiempo de ejecución, no solo en el código:** `/` emite **1** consulta a `bitacoras` y **1** línea `resumen degradado` teniendo 6 tarjetas delante. El `getResumenBitacora()` del frontmatter alimenta tarjetas y tira por props; es la verificación dinámica del argumento estático de la auditoría.
- **Cuánto vale un `≠ 0` en el Step 4 -- esto es lo que hace legible el CHECKPOINT.** Las 7 páginas SSR suman **12** líneas de degradado, y la descomposición cierra sin resto: `1` en `/` (un consumidor) + `5 × 2` en las landings con fila nueva (`UltimasDeBitacora` y `BrandFooter`) + `1` en meliponas (solo el pie, porque ahí la fila no se monta) = 12. Así que una línea en `/` es **una** consulta fallando, no seis; y dos líneas en una landing son dos consumidores, no dos fallos. El contador de HTTP no sirve para esa lectura: midió 7 consultas en 4 páginas, a veces más que las líneas (`/granja/`: 3 consultas con 2 líneas, porque la URL `bitacoras` también la pisa `getBitacoraByMarca` de la fila) y a veces menos (`/cafe/`: 1 consulta con 2 líneas, por el coalescing de peticiones en vuelo). La cifra robusta es la de líneas: **1 por consumidor**.
- **La degradación no es nueva de esta fase:** con la consulta caída, `/meliponas/` pierde también sus 4 hrefs de siempre, porque su bloque preexistente lee el mismo endpoint. Si algún día se ve ese cuadro en producción, lo que falla es Strapi, no el enlazado de la fase 3.

Qué sigue siendo medición de producción: si el `grep -c 'resumen degradado'` del Step 4 sale `0`, el `fields[]` del Strapi real fue aceptado y el riesgo se cierra ahí. Si sale `1` en `/`, la portada está servida y degradada --no caída--, y la misma línea trae la URL con el `fields%5B%5D=` que provocó el rechazo, tal como salió acá.

## Fuera de alcance (por decisión del usuario)

Deduplicar el grid copiado en los 6 `<marca>/bitacora/index.astro`, subir volumen de contenido, rutas por receta, y IndexNow (no nacen URLs nuevas: `/granja/bitacora` y los 56 artículos ya están en el sitemap enviado el 2026-09-24).

## Riesgos conocidos

- **Que `fields[]` sea rechazado**: Strapi 5 respondería 400 y `getResumenBitacora()` se degradaría a vacío. El antecedente dice que no: `populate` viaja serializado igual, con `params.append('populate[]', p)` en `src/lib/strapi.ts:97`, y esa forma funciona en producción en decenas de consultas. Si materializarse significa algo grave, ya no es una incógnita: el bloque "Degradación con Strapi devolviendo 400" midió el escenario contra el bundle --`200` en las 7 páginas SSR, cero enlaces nuevos, 1 línea de log por consumidor-- y el Step 4 diría cuál es cuál. Y ya no es un fallo silencioso —la degradación deja una línea en stdout del contenedor—, así que el síntoma se lee con `docker logs iwage_web 2>&1 | grep 'resumen degradado'` antes de tocar nada. Si aun así apareciera, la corrección es quitar `fields` de la consulta.
- **El precedente del 500 por ICON**: un componente nuevo con un import mal roto revienta el build dentro de la imagen, no en producción — por eso el Step 2 construye antes de `up -d`.
- **El `pageSize: 100` del resumen**: con 56 publicados hay margen; al pasar de 100 artículos publicados el hub subreportaría. Se anota como deuda, no se resuelve aquí.
- **Disco del host durante el build** (medido 2026-09-24; la cifra del cierre está en el bullet de abajo, ya que pasó de 14G a 11G y volvió a 14G por causas ajenas a esta fase): `/` en 180G usados de 194G, **14G libres (93%)**; `negocio-iwage_app:latest` pesa 1,26GB y el contexto de build son 60MB (`.dockerignore` deja fuera `node_modules`, `dist`, `.git` y `*.md`). El BuildKit cache mount de `npm ci` ya está caliente (12,8GB de caché de build), así que el paso que más espacio pide tiende a reutilizar capas. Conclusión: hay margen para `build` + `up -d` y **no se poda nada** — un `docker builder prune` tocaría el espacio compartido de los otros 34 contenedores de la máquina por una comodidad que no hace falta. Si el build fallara por ENOSPC, el contenedor en marcha no se enteraría (el Step 3 solo corre si el Step 2 terminó).

- **Un blip de Strapi convierte un índice con contenido en `noindex`** (preexistente; esta fase lo mide, no lo toca). `getBitacoraByMarca` se traga el error y devuelve `{ data: [], total: 0 }` (`src/lib/bitacora.ts:52-54`) y los 6 índices deciden el robots con `noindex={articulos.length === 0}` (meliponas :35, las otras cinco :32). Un timeout de 8 s o un rotado de token justo en el render que ve Googlebot deja `/meliponas/bitacora` respondiendo 200 con `noindex, follow`, y nginx lo sirve así 120 s. El alcance está acotado: la bandera solo puede aparecer en los 2 índices; las 56 páginas de artículo nunca pasan `noindex` (`src/pages/*/bitacora/[slug].astro:49` no lo recibe), así que los artículos siguen indexables aunque su índice quede marcado. La corrección puntual queda propuesta y no ejecutada —un `fallo: boolean` en el retorno más `noindex={articulos.length === 0 && !fallo}` en 6 archivos— por dos razones: 7 archivos tocados por una probabilidad baja sobre un deploy ya gated, y el arreglo abre el lado inverso (durante el blip, un índice verdaderamente vacío perdería su `noindex` y quedaría indexable, justo lo que la fase 1 decidió no exponer). Deuda registrada con su criterio de decisión.
- **Las rutas de artículo no comprueban la marca** (preexistente, fuera de alcance). `src/pages/meliponas/bitacora/[slug].astro:17` llama a `getBitacoraBySlug(slug!)` sin filtro de `marca`, así que `/cafe/bitacora/<slug de meliponas>` responde 200 con el mismo contenido; el canonical es autorreferencial (`src/layouts/BrandLayout.astro:45` sobre `Astro.url.pathname`, impreso en :175), de modo que cada variante se canónica a sí misma en vez de canibalizar hacia la URL buena. No hay nada que las produzca: las migas, los "relacionados" y las tres tiras nuevas arman el href con la marca de la fila, y el sitemap emite solo la correcta (`src/lib/sitemap.ts:268`). Riesgo de adivinanza de URL, no de rastreo.
- **Lo que valida el build en el host, y lo que no** (medido 2026-09-24, sin tocar producción): `npm ci --no-audit --no-fund` instaló 342 paquetes en 36 s (354MB en `node_modules`, ignorado por `.gitignore:7`) y `STRAPI_URL=http://127.0.0.1:1 STRAPI_API_TOKEN=local-build-unused npx astro build` cerró con `[build] Complete!`, exit 0, 19 s (46MB en `dist`, `.gitignore:2`). El token es un literal inventado: no se leyó `.env` ni el valor real, y aun así el repo queda limpio porque ambos directorios están ignorados.
  - Qué prueba: que las plantillas de la fase **compilan** (el precedente del 500 por ICON no se repite) y que la degradación a nada funciona bajo el renderizador real — las 18 páginas con `prerender = true` imprimieron `[bitácora] resumen degradado — fetch failed` en stdout (`src/lib/bitacora.ts:85`) y ninguna reventó.
  - Prueba en HTML generado: `dist/client/tierras/herramientas/evaluacion-vap/index.html` conserva 3 `href="/tierras/bitacora"` (2 del navbar, 1 de la columna "Recursos"; los tres preexistentes) y **0** ocurrencias de `publicaciones`. Con el resumen vacío el bloque nuevo no emite ni un enlace — es el criterio "ninguna bitácora vacía gana enlace" observado desde el lado inverso.
  - Qué **no** prueba: `/`, las 6 landings y las rutas de bitácora no llevan `prerender` (no existe `dist/client/index.html`), así que se renderizan por petición y sus conteos servidos —criterios 2, 3 y 4— siguen dependiendo del Step 4 en el origen. Un build con Strapi muerto tampoco dice si Strapi honra `fields[]`.
  - Costo medido: los 400MB de artefactos movieron `/` de 93% a 94% (14G libres). Ambos directorios son regenerables en 19 s y se pueden borrar cuando cierre la fase; por ahora sostienen la render-fixture local opcional.
