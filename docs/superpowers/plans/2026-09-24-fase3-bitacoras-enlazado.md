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

### Task 7: CHECKPOINT de despliegue y verificación en producción

**Files:** ninguno (producción). Todo este task requiere un mensaje de texto del usuario que diga el CHECKPOINT; una respuesta de AskUserQuestion **no** cuenta.

- [ ] **Step 1: Presentar el estado y parar**

```bash
cd /home/ubuntu/negocio/data/app_iwage && git log --oneline -5 && git diff --stat e48eb20..HEAD
```

Mostrar los 4 commits y escribir explícitamente: *CHECKPOINT 1 — desplegar (`docker compose build iwage_app && docker compose up -d iwage_app`) es una acción sobre producción; necesito tu confirmación por mensaje de texto.* No ejecutar nada del Step 2 en adelante hasta que llegue.

- [ ] **Step 2: Construir la imagen (aún no toca el contenedor en marcha)**

```bash
cd /home/ubuntu/negocio && docker compose build iwage_app 2>&1 | tail -25
```
Expected: `RUN npm run build` termina sin `error` y la imagen se etiqueta. Si el build falla, **abortar aquí**: el contenedor viejo sigue sirviendo, no se hace `up`. Corregir y volver al Step 2.

- [ ] **Step 3: Recrear el servicio**

```bash
cd /home/ubuntu/negocio && docker compose up -d iwage_app 2>&1 | tail -5 && sleep 25 && docker ps --filter name=iwage_web --format '{{.Status}}'
```
Expected: `Up …`, sin reinicios en cascada. (Los 5 primeros `TypeError: fetch failed` observados en la fase 2 son la carrera de arranque documentada; por eso el `sleep 25`.)

- [ ] **Step 4: Verificar en el ORIGEN, antes de mirar ninguna caché intermedia**

Astro escucha en `127.0.0.1:4321` **dentro** del contenedor (el puerto publicado 4321 del host es nginx, que tiene su propio SWR de 120 s):

```bash
docker exec iwage_web curl -s -o /dev/null -w 'origen /: %{http_code} %{time_total}s\n' http://127.0.0.1:4321/
docker exec iwage_web curl -s http://127.0.0.1:4321/ | grep -oE 'href="/[a-z]+/bitacora/[^"/]+"' | sort -u | wc -l
docker exec iwage_web curl -s http://127.0.0.1:4321/ | grep -oE 'href="/(meliponas|granja|cafe|tierras|naturaleza|gestion)/bitacora"' | sort -u
```
Expected: `200`; **≥ 6** hrefs de artículo; y exactamente dos portadas (`/granja/bitacora`, `/meliponas/bitacora`). Si los artículos salen `0`, el `fields[]` está siendo rechazado por Strapi (400 → `catch` → degradación a nada): revisar Step 3 de Task 1 antes de seguir.

- [ ] **Step 5: Contract de cada superficie por el borde público, partiendo de una caché vacía**

```bash
curl -s -D - -o /dev/null -w 'primera / → %{http_code} en %{time_total}s\n' https://iwage.co/ | tr -d '\r' | grep -iE 'x-cache-status|cf-cache-status|primera /'
for m in granja cafe tierras naturaleza gestion; do
  printf '%s: artículos=%s banda=%s\n' "$m" \
    "$(curl -s "https://iwage.co/$m/" | grep -oE "href=\"/$m/bitacora/[^\"]+\"" | wc -l)" \
    "$(curl -s "https://iwage.co/$m/" | grep -o 'Desde la bitácora' | wc -l)"
done
curl -s https://iwage.co/meliponas/ | grep -oE 'href="/meliponas/bitacora/[^"]+"' | wc -l
curl -s https://iwage.co/granja/ | grep -oE 'href="/granja/bitacora"' | wc -l
```
Expected en la primera línea: `X-Cache-Status: MISS`. No hace falta dormir nada: `iwage_app` no declara `volumes:` y `Dockerfile:32` solo hace `mkdir -p /var/cache/nginx`, así que el `html_cache` vive en la capa escribible y **muere con el contenedor** — la primera petición pública siempre choca contra la aplicación nueva. Su `%{time_total}` es el dato que importa: el coste del render en frío con `getResumenBitacora()` dentro, que es lo que verá un rastreador. `X-Cache-Status` lo escribe nginx, así que una lectura con esa cabecera **ausente**, o con `cf-cache-status: HIT`, significa que la petición no llegó al origen y el HTML puede seguir siendo el previo al despliegue: en ese caso hay que purgar esa URL en Cloudflare antes de creer ningún conteo. Es la misma razón por la que el Step 4 mide el origen primero. Si en la primera línea saliera `HIT` o `STALE` con `X-Cache-Status` presente, la caché sobrevivió al recreate y **ningún conteo de este Step es válido**: invalidar y repetir.

Y después: `granja` → `artículos=3 banda=1`; `cafe`/`tierras`/`naturaleza`/`gestion` → `artículos=0 banda=0` (bitácora vacía: sin enlace y sin cambio visual); la línea de `meliponas` → `4` (el bloque preexistente sigue); la de granja con menú → `≥ 2` (cabecera + fila nueva). Se cuenta con `grep -o | wc -l` y no con `grep -c` porque `-c` cuenta **líneas** que coinciden, y Astro sirve varios enlaces por línea.

- [ ] **Step 6: Las bitácoras vacías siguen en `noindex` y la con contenido indexable**

```bash
for m in cafe tierras naturaleza gestion meliponas granja; do
  printf '%s: %s\n' "$m" "$(curl -s https://iwage.co/$m/bitacora | grep -oE '<meta name="robots"[^>]*>' | head -1)"
done
```
Expected: los 4 vacíos con `noindex` (comportamiento de la fase 1, intocado); `meliponas` y `granja` **sin** `noindex`.

- [ ] **Step 7: Ráfaga de 60 peticiones a 12 paralelas sobre `/`**

```bash
seq 1 60 | xargs -P12 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://iwage.co/ | sort | uniq -c
```
Expected: una sola línea `60 200`. Cualquier `429`/`500` ⇒ revertir el paso del hub (`git revert`) y volver a construir, porque el costo extra de `getResumenBitacora()` no puede pagar un 5xx en la portada.

Dos hechos del `nginx.conf` que hacen que esta medición signifique algo: (1) `location /` (:192) **no lleva `limit_req`** — la zona `general:300r/m` de `:10` solo se aplica en `/api/` (:176), en el bloque de propiedades (:137) y en los de reserva/lead; se quitó en la fase 1 porque los 503 caían sobre los rastreadores. Así que un 429/503 en la ráfaga no puede ser un falso positivo de rate limiting: solo puede venir de la app o del upstream, y la regla de revertir es correcta. (2) `proxy_cache_lock on` con clave `$scheme$request_method$host$request_uri` derrite las 60 peticiones simultáneas a la misma URL contra **una sola** render de upstream: la ráfaga mide el camino HIT, y el camino frío ya quedó medido en el `%{time_total}` del Step 5. Pedirle a esta prueba lo que no puede dar (que estrese el render) sería un falso verde.

- [ ] **Step 8: Rastreo de la profundidad dos (los dos índices, no solo uno)**

```bash
for m in granja meliponas; do
  printf '%s: %s\n' "$m" "$(curl -s https://iwage.co/$m/bitacora | grep -oE "href=\"/$m/bitacora/[^\"]+\"" | sort -u | wc -l)"
done
```
Expected: `granja: ≥ 19` y `meliponas: ≥ 37`, suma `≥ 56`. Los índices ya enlazaban sus artículos; lo nuevo es que `/` llega a esos dos índices. Si la suma queda por debajo de 56, medir antes el `pageSize` real servido antes de tocar el enlazado.

---

### Task 8: Cierre documental

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-fase3-bitacoras-enlazado.md` (marcar los 8 pasos de verificación con la medida real)
- Modify: `docs/superpowers/specs/2026-09-24-fase3-bitacoras-enlazado-design.md` (solo si algo medido contradice el diseño)

- [ ] **Step 1: Anotar las mediciones**

En cada `- [ ] **Step N …**` de Tasks 4-8, marcar `- [x]` y añadir la salida medida (número de hrefs, códigos de la ráfaga, el `noindex` de las 4 vacías). Sin medición no se marca.

- [ ] **Step 2: Commit de docs**

```bash
git add docs/superpowers/plans/2026-09-24-fase3-bitacoras-enlazado.md docs/superpowers/specs/2026-09-24-fase3-bitacoras-enlazado-design.md
git commit -m "docs(fase 3): enlazado verificado — conteos del grafo tras el despliegue"
```

- [ ] **Step 3: Actualizar el gitlink del repo padre**

```bash
cd /home/ubuntu/negocio && git status --short data/app_iwage && git add data/app_iwage && git commit -m "chore(iwage): gitlink a la fase 3 de enlazado"
```
Expected: `git status --short` muestra `M data/app_iwage` **solo**; si aparece cualquier otra ruta, no commitear sin revisarla (el árbol del padre tiene cientos de caminos sucios).

- [ ] **Step 4: Preguntar por el push, sin hacerlo**

Escribir: *"Listos los N commits locales; `origin/master` sigue atrás. ¿Los subo?"* Esperar respuesta de texto. El push del árbol del padre y de `data/app_iwage` se hace solo con ese sí, y después de que el usuario confirme que las 4 líneas con `STRAPI_API_TOKEN` en el repositorio son placeholders y no el token real.

---

## Estado de ejecución y mediciones estáticas (2026-09-24, antes del despliegue)

Tasks 1-6 ejecutados y commiteados: `18c1449` capa de datos, `611afb2` hub, `550ff9a` las 5 landings, `c32d29c` pie global + menú de granja, `0acb674` auditoría estática + degradado con log. `git diff --stat e48eb20..HEAD` → 15 archivos, 1027 inserciones, 1 borrón. El árbol conserva sin tocar los dos no rastreados preexistentes (`public/Iwage_Granja_Diseno_y_Plan_de_Accion.docx`, `scripts/`).

Medido sin tocar producción:

| Comprobación | Comando | Salida |
|---|---|---|
| Tests en verde | `npm test` (que en `package.json:12` es `node --test tests/*.test.mjs`) | `# pass 15` / `# fail 0` |
| El contrato del grafo, medido sin desplegar | `node --test tests/bitacora-resumen.test.mjs` | con las 56 filas reales de Strapi (37 meliponas + 19 granja): 2 marcas con enlace (`/meliponas/bitacora`, `/granja/bitacora`), 6 hrefs distintos en la tira del hub, 3 tarjetas por landing con contenido y `0` en las 4 vacías |
| Cero dependencias nuevas | `git diff --name-only e48eb20..HEAD -- package.json package-lock.json \| wc -l` | `0` |
| Las 6 rutas de bitácora existen | `find src/pages -path '*bitacora*' -name '*.astro'` | 12 archivos: `index.astro` + `[slug].astro` en las 6 marcas → todo href emitido resuelve |
| La forma del href coincide con la preexistente | `grep -n 'bitacora/' src/pages/granja/bitacora/index.astro src/pages/meliponas/index.astro` | `:64` y `:264` usan `` `/${marca}/bitacora/${post.slug}` `` / `` `/meliponas/bitacora/${post.slug}` ``, idéntico a lo que generan `BitacoraEcosistema` y `UltimasDeBitacora` |

Sobre el riesgo declarado (`fields[]` rechazado por Strapi): `src/lib/strapi.ts:102` hace `params.append('fields[]', f)` sobre el mismo `URLSearchParams` del que salen hoy los `filters[…][$op]` que este Strapi acepta sin queja (`src/lib/strapi.ts:103`). El encoding de corchetes no es lo desconocido; lo único que queda por ver en el origen es que la colección `bitacoras` responda con los atributos pedidos, que es exactamente lo que mide el Step 4 de la Task 7.

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

Dos hallazgos más, ambos de coherencia:

1. **Los hrefs nuevos son las mismas `loc` del sitemap.** `src/lib/sitemap.ts:266-270` arma las bitácoras con `toUrls(bitacoras, e => `/${e.marca}/bitacora`, 0.6)` y `toUrls` (`src/lib/sitemap.ts:198`) hace `` `${prefix}/${e.slug}` `` → `/meliponas/bitacora/x` y `/granja/bitacora/x`. Es byte a byte lo que emiten `BitacoraEcosistema` y `UltimasDeBitacora`, así que la vía del sitemap (fase 1) y la vía del enlazado (fase 3) apuntan a la misma URL canónica: no se crea un segundo grafo con URLs alias.
2. **`BrandFooter` itera `otherBrands`, no `brandList`.** Consecuencia: el pie de `/granja/` enlaza la bitácora de meliponas pero no la propia, y viceversa. Es aceptable — el objetivo del pie era distribuir enlaces entre marcas, y la portada de cada bitácora ya recibe el enlace propio por su menú y, en granja, por la fila nueva.

### Auditoría previa al despliegue (evidencia, no intención)

- **Diseño 1 ("una pasada, no seis") está probado por el código**: los tres consumidores llaman igual —`src/pages/index.astro:15`, `src/components/brand/BrandFooter.astro:14`, `src/components/brand/UltimasDeBitacora.astro:10`, todos `getResumenBitacora()` sin argumentos— y dentro de la función los parámetros de consulta son fijos (`filters` `publicado:{$eq:true}`, `sort` `fecha:desc,publishedAt:desc`, `pagination` 1/100, `fields` `CAMPOS_RESUMEN`). `opts` solo viaja a `filasAResumen`, que es post-proceso, luego el `queryString` —y por tanto la clave `strapi:bitacoras:${queryString}`— es idéntica en las 7 superficies. El `catch` devuelve `filasAResumen([], opts)`: degradación a cero bloques, imposible un 500 por datos.
- **"56 artículos en dos saltos", probado por el código antes de medirlo en producción**: `grep -n "pageSize\|articulos.map\|\.slice(" src/pages/*/bitacora/index.astro` devuelve 12 líneas —seis llamadas `getBitacoraByMarca(BRAND as any, { pageSize: 100 })` (meliponas :15, las otras cinco :12) y seis `articulos.map(...)` (:56, meliponas :59)— y **cero `.slice(`**. Es decir: el salto 2 no recorta. El default `pageSize: 20` de `getBitacoraByMarca` no aplica porque todas las llamadas lo pisan, y 20 < 37 habría partido la melipona. Con `/` enlazando los dos índices, el grafo medido es 19 + 37 = 56 artículos a distancia 2.
- **Formato de las tarjetas nuevas, revisado contra el bloque preexistente**: `src/pages/meliponas/index.astro:262-263` ya hace `date={post.fecha ?? ''}` y `readTime={String(post.tiempo_lectura ?? 5)}`, que es literalmente lo que hace `UltimasDeBitacora`. `BitacoraCard` imprime `{readTime} min lectura`. No hay divergencia visual que corregir.
- **Lo que `astro check` no puede cubrir aquí porque no corre en este repo, cubierto a mano**: (a) los 4 imports de los componentes nuevos resuelven —`@/components/BitacoraCard.astro` (vive en `src/components/`, **no** en `brand/`), `@/components/shared/Icon.astro`, `@/config/brands` exporta `brandList` (:22), `@/lib/bitacora` exporta `type Marca` (:34) junto con `getResumenBitacora`/`conteoDe` —; (b) las 7 props que pasa `UltimasDeBitacora` son exactamente las de `interface Props` de `BitacoraCard` (`title, excerpt, category, date, readTime, href, image?`), con `?? ''`/`?? 'General'`/`?? undefined` para que un `null` de Strapi no imprima "null"; (c) existen los 12 archivos `src/pages/*/bitacora/{index,[slug]}.astro`, así que ningún href nuevo del hub puede caer en 404; (d) `marca` es un atributo **escalar, tipo `string`** (`EntradaBitacora.marca: string`, y `getBitacoraByMarca` filtra `marca: {$eq: marca}`), no una relación: por eso `fields[]` lo devuelve y `MARCAS.includes(f.marca)` tiene con qué comparar —y los valores almacenados son las 6 slugs en minúscula, las mismas que hoy producen 19 y 37 artículos en los índices.
- **Por qué el cambio en `granja.ts` necesita las dos líneas, y no solo el `href` del grupo**: `BrandNavbar` renderiza las entradas con `children` como `<button>` —en escritorio (:39) y en el panel móvil (:142)— y **solo los `children` salen como `<a href>`** (:53 y :151). El `href` del grupo alimenta únicamente `isActive()` para el resaltado. Por eso `/granja/bitacora` aparece dos veces en el HTML (hijo del dropdown + hijo del menú móvil) gracias a la línea `{ label: 'Bitácora', href: '/granja/bitacora' }`; si se hubiera añadido solo el `href` del grupo, el criterio "el menú de granja enlaza la bitácora" habría fallado en silencio, sin error ni síntoma visible. Dos matices para la lectura de la medición: ambos `<a>` viven dentro de contenedores ocultos por CSS (`opacity-0 invisible` el dropdown, `hidden` el panel móvil), así que el enlace con peso real en la landing es el "Ver todo →" de `UltimasDeBitacora`, que siempre está visible.
- **Estado de git para el cierre**: la fase son 7 commits —`e48eb20` y `2e193b2` (spec y plan), `18c1449` capa de datos (`fields`, `filasAResumen`, `getResumenBitacora`), `611afb2` sección del hub, `550ff9a` fila en las 5 landings, `c32d29c` pie global + menú de granja, y el de esta auditoría (degradado con log + plan)— más el de docs del Task 8. El número de commits locales sin subir se recalcula al cerrar con `git rev-list --count origin/master..HEAD` (estaba en 24 antes de este commit; 18 son de las fases 1 y 2, retenidos por la misma regla) y el gitlink del padre en `2a2cfac`.

### Dos correcciones a lo escrito arriba

1. **`imagen` es escalar, no relación.** `src/pages/*/bitacora/[slug].astro` la consume directa como URL (`src={article.imagen}`, sin `populate`), así que incluir `imagen` en `CAMPOS_RESUMEN` es válido: Strapi responde el atributo y el `BitacoraCard` muestra la foto. Si hubiera sido media, `fields[]` lo habría ignorado y las tarjetas habrían salido con el degradado de relleno.
2. **La restricción "prohibido `return` en frontmatter" es inexacta.** Astro sí envuelve el frontmatter en una función async: `src/pages/granja/bitacora/[slug].astro:15` hace `return Astro.redirect('/granja/experimentos')` y funciona en producción. Lo que sí se evitó en estos componentes es `return` para ocultar un bloque, porque en un componente sin handler el resultado esperado es el template; la ocultación se hace con `{cond && (…)}`.

---

## Criterios de aceptación (cómo se mide cada uno)

| Criterio del objetivo | Dónde se verifica |
|---|---|
| `npm test` verde con los tests nuevos de `filasAResumen()` y cero dependencias nuevas | Task 2 Step 4, Task 3 Step 4, Task 6 Step 5. `package.json` no se toca en ningún task. |
| `/` enlaza ≥ 2 portadas de bitácora y ≥ 6 artículos | Task 7 Step 4 |
| Los 56 artículos alcanzables desde `/` en dos saltos | Task 7 Step 8 (`granja ≥ 19`, `meliponas ≥ 37`); el salto 2 está probado por código en la auditoría (6 índices con `pageSize: 100` y ningún `.slice`) |
| Cada landing con contenido enlaza 3 artículos | Task 7 Step 5 (`granja` = 3, `meliponas` = 4 preexistente) |
| `/granja/bitacora` aparece en el menú de granja | Task 6 Step 4, Task 7 Step 5 |
| Ninguna bitácora vacía gana enlace ni cambia de aspecto | Task 7 Step 5 (`artículos=0 banda=0`) y Step 6 (`noindex` intacto) |
| `/` responde 200 en 60 peticiones a 12 paralelas | Task 7 Step 7 |
| Verificación en el origen antes de purgar caché | Task 7 Step 4 antes del Step 5 |
| Cada despliegue con CHECKPOINT confirmado por texto del usuario | Task 7 Step 1 (ningún comando de producción antes de ese mensaje) |
| Sin `git push` sin pedirlo; secretos solo por presencia | Task 8 Step 4 |

## Fuera de alcance (por decisión del usuario)

Deduplicar el grid copiado en los 6 `<marca>/bitacora/index.astro`, subir volumen de contenido, rutas por receta, y IndexNow (no nacen URLs nuevas: `/granja/bitacora` y los 56 artículos ya están en el sitemap enviado el 2026-09-24).

## Riesgos conocidos

- **Que `fields[]` sea rechazado**: Strapi 5 respondería 400 y `getResumenBitacora()` se degradaría a vacío. El antecedente dice que no: `populate` viaja serializado igual, con `params.append('populate[]', p)` en `src/lib/strapi.ts:97`, y esa forma funciona en producción en decenas de consultas. Y ya no es un fallo silencioso —la degradación deja una línea en stdout del contenedor—, así que el síntoma se lee con `docker logs iwage_web 2>&1 | grep 'resumen degradado'` antes de tocar nada. Si aun así apareciera, la corrección es quitar `fields` de la consulta.
- **El precedente del 500 por ICON**: un componente nuevo con un import mal roto revienta el build dentro de la imagen, no en producción — por eso el Step 2 construye antes de `up -d`.
- **El `pageSize: 100` del resumen**: con 56 publicados hay margen; al pasar de 100 artículos publicados el hub subreportaría. Se anota como deuda, no se resuelve aquí.
- **Disco del host durante el build** (medido 2026-09-24): `/` en 180G usados de 194G, **14G libres (93%)**; `negocio-iwage_app:latest` pesa 1,26GB y el contexto de build son 60MB (`.dockerignore` deja fuera `node_modules`, `dist`, `.git` y `*.md`). El BuildKit cache mount de `npm ci` ya está caliente (12,8GB de caché de build), así que el paso que más espacio pide tiende a reutilizar capas. Conclusión: hay margen para `build` + `up -d` y **no se poda nada** — un `docker builder prune` tocaría el espacio compartido de los otros 34 contenedores de la máquina por una comodidad que no hace falta. Si el build fallara por ENOSPC, el contenedor en marcha no se enteraría (el Step 3 solo corre si el Step 2 terminó).
- **Por qué no se validaron las plantillas `.astro` en el host**: haría falta `npm ci` (~500MB sobre un disco al 93%) y el `astro build` local no produce el HTML de estas rutas (`output: 'server'` renderiza por petición), así que no cubriría los criterios 2-4 de todos modos. La verificación real es en el origen después del `up -d` (Step 4).
