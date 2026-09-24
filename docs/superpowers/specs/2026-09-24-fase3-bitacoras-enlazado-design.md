# Fase 3 (parte 1): bitácoras enlazadas desde el hub --diseño

**Fecha:** 2026-09-24 · **Repositorio:** `data/app_iwage` · **Precede a:** plan `docs/superpowers/plans/2026-09-24-fase3-bitacoras-enlazado.md`

## El problema, medido

Cerrada la fase 2 (37 artículos de Meliponario publicados, sitemap en 189 URLs), Search Console seguía en **0 impresiones y 1 sola página indexada: la portada**. La causa no es el contenido ni el `noindex` --eso se arregló en la fase 1-- sino que **Google no tiene por dónde bajar**:

| Hecho | Valor | Cómo se reproduce |
|---|---|---|
| Enlaces desde `/` | 8, de los cuales 6 son las landings de marca y 2 son un `.svg` y un `.css` | `curl -s https://iwage.co/ \| grep -o 'href="/[^"]*"' \| sort -u` |
| Enlaces desde `/` a cualquier bitácora | **0** | el mismo HTML, filtrando `bitacora` |
| Artículos alcanzables en 2 saltos desde `/` | **4 de 37** | recorrido desde `/` → 6 landings → sus enlaces |
| Landings de marca que enlazan artículos | solo `/meliponas/` (4); las otras cinco, 0 | ídem |
| Bitácoras con contenido publicado | meliponas 37, granja 19 (56 en total) | `curl -s https://iwage.co/sitemap.xml \| grep -c '/bitacora/'` |
| Bitácoras vacías | cafe, tierras, naturaleza, gestion: `200` + `noindex, follow` | `curl -s https://iwage.co/<b>/bitacora \| grep robots` |

Y no hay material para llenar las cuatro vacías: en `Publicaciones/` solo hay `Granja/` (19 `.md`), `Meliponario/` (37) y `Productos_Meliponario/` (8 fichas de producto). O sea que enlazar las 4 vacías sería ofrecerle a un rastreador una página que no enlaza a nada, y ofrecerle a una persona una sección sin contenido.

## Decisión de diseño

**Un resumen de bitácoras por marca, calculado con una sola pasada a Strapi, y enlaces que solo existen donde hay contenido.**

Cuando Cafe publique su primer artículo, su bitácora pasa sola de `noindex` a `index, follow` (eso ya lo hace la fase 1) y su enlace aparece solo en el hub y en el pie (esto). Ningún paso de este diseño se repite para la fase 4.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/strapi.ts` | gana `fields?: string[]` en `StrapiOptions` (seleccionar atributos) |
| `src/lib/bitacora.ts` | `filasAResumen()` pura + `getResumenBitacora()` que consulta |
| `src/components/brand/BitacoraEcosistema.astro` | la sección nueva del hub: pie de bitácoras + tira de recientes |
| `src/components/brand/UltimasDeBitacora.astro` | una fila "Desde la bitácora" para una marca, reutilizando `BitacoraCard` |
| `src/pages/index.astro` | monta `BitacoraEcosistema` y enlaza bitácoras en su pie en línea |
| `src/pages/{cafe,tierras,naturaleza,gestion,granja}/index.astro` | montan `UltimasDeBitacora` |
| `src/components/brand/BrandFooter.astro` | enlaza las bitácoras de las otras marcas con contenido |
| `src/config/brands/granja.ts` | `brand.nav` gana `/granja/bitacora` |
| `tests/bitacora-resumen.test.mjs` | contrato de la función pura |

## Los datos

`src/lib/bitacora.ts` agrega dos cosas. La primera es pura y es la única con lógica:

```ts
export interface ResumenBitacora {
  total: number;
  porMarca: Partial<Record<Marca, { count: number; ultimas: EntradaBitacora[] }>>;
  recientes: EntradaBitacora[];
}

/** Recibe filas YA ordenadas por fecha descendente y las agrupa. No vuelve a ordenar. */
export function filasAResumen(
  filas: EntradaBitacora[],
  { porMarca = 3, recientes = 6 }: { porMarca?: number; recientes?: number } = {}
): ResumenBitacora
```

No ordena a propósito: el orden lo decide Strapi (`fecha:desc, publishedAt:desc`, el mismo de `getBitacoraByMarca:42`). Volver a ordenar con otra clave en el cliente es la receta para que la tira del hub y la portada de la bitácora muestren órdenes distintos y nadie se explique por cuál.

La segunda es la única que toca I/O:

```ts
export async function getResumenBitacora(opts?): Promise<ResumenBitacora>
```

Una petición, no seis: `bitacoras` con `filters {publicado: {$eq: true}}`, `sort ['fecha:desc','publishedAt:desc']`, `pagination {page: 1, pageSize: 100}` y `fields ['titulo','slug','marca','fecha','extracto','imagen','categoria','tiempo_lectura']`. Cincuenta y seis documentos hoy, techo de cien. Sale `filasAResumen([])` cuando la consulta falla --el mismo `try/catch → vacío` de `getBitacoraByMarca:49`--, así que un Strapi caído vacía el bloque en vez de tumbar la página.

El `fields` es la razón de tocar `src/lib/strapi.ts`. Sin él, la consulta arrastra `contenido` con los artículos completos: 56 documentos de markdown largo meterían cientos de kilobytes en Redis y cada render del pie las deserializaría otra vez. La caché existe (`strapi:bitacoras:<queryString>`, TTL `CACHE_TTL.list` = 300 s) y es compartida por todo el sitio, así que el costo real es una consulta cada 5 minutos, pero el objeto cacheado debe ser pequeño porque se lee en cada página.

## Lo que se renderiza

**Flujo de datos.** `src/pages/index.astro` llama a `getResumenBitacora()` **una vez** en su frontmatter y pasa el resultado por props a la sección nueva y a su propio pie: dos llamadas desde dos componentes serían dos deserializaciones de la misma caché en el mismo render. `BrandFooter` sí consulta por su cuenta --es un componente que se monta en las páginas de cada marca y nadie le pasa ese dato--, y ahí la caché compartida hace que sigan siendo una consulta cada 5 minutos para todo el sitio.

**El hub (`/`).** Las tarjetas de marca **no se tocan**: cada una es un `<a href="/marca/">` que envuelve toda la tarjeta (`index.astro:196-224`), y meterle dentro un enlace a la bitácora sería anidar un `<a>` dentro de otro --HTML inválido y comportamiento de hover roto. En su lugar, una sección nueva debajo del grid, con `BitacoraEcosistema`:

- Una línea por marca con contenido: `Meliponario · 37 publicaciones →` a `/meliponas/bitacora`, y `Granja · 19 publicaciones →` a `/granja/bitacora`. Sin filas para las cuatro vacías.
- Una tira de 6 artículos recientes entre todas las marcas, cada uno con el nombre de la marca visible y enlace directo al artículo.

Los 6 artículos recientes no se eligen por marca sino globalmente: el hub es un directorio, y su trabajo es repartir, no competir con las landings.

**Las 5 landings sin bloque de bitácora.** Fila "Desde la bitácora" con 3 tarjetas (componente `UltimasDeBitacora`, que usa `getBitacoraByMarca(marca, {pageSize: 3})` --ya existe-- y `BitacoraCard` --ya existe, usado solo en meliponas:250-271--). Con `total = 0` la fila no se dibuja: cafe, tierras, naturaleza y gestion quedan idénticas a hoy, byte por byte. `meliponas` no se toca: su bloque ya cumple la función.

**El pie global (`BrandFooter`).** A las 5 landings de otras marcas que ya enlaza (`BrandFooter.astro:95-104`) se suman las bitácoras con contenido de esas mismas marcas, excluyendo la marca de la página (para no duplicar el enlace que ya está en el menú). Este es el cambio que más páginas toca --todo el sitio--, y el único que añade una consulta a plantillas que no la tenían.

**El pie del hub.** `/` no usa `BrandFooter`, tiene su propio `<footer>` en línea (`index.astro:282-298`) que solo enlaza las 6 landings. Ahí se agregan las bitácoras con contenido, mismo criterio.

**El menú de granja.** `src/config/brands/granja.ts:20-39` no tiene entrada de bitácora, aunque granja aporta 19 de las 56 URLs indexables. Se agrega `/granja/bitacora` a `brand.nav`, como ya tienen cafe (28), gestion (36), meliponas (37), naturaleza (43) y tierras (44).

## Fuera de alcance

- Deduplicar el grid de tarjetas copiado a mano en los 6 `<marca>/bitacora/index.astro:55-93`. Son 6 archivos tocados para cero ganancia de rastreo.
- Contenido nuevo para cafe, tierras, naturaleza y gestion: no hay de qué. Es la fase 4 y depende de escribir, no de código.
- Las rutas SSR por receta y el resto del plomería GEO de la fase 3 (fichas de producto, `Productos_Meliponario`).
- El `.docx` público, `www.iwage.co`, `http→https` y la rotación de credenciales: siguen pendientes del lado del usuario.

## Fallos que hay que cubrir

| Fallo | Qué se ve |
|---|---|
| Strapi caído o lento en el render del hub | bloque ausente, `/` sigue en 200 con su contenido de siempre |
| Marca con `total = 0` | ni pie de bitácora ni fila de recientes; la landing no cambia |
| Artículo sin `extracto` o sin `imagen` | `BitacoraCard` ya admite `image?` y texto vacío; sin arte nuevo |
| `fecha` nula en una fila | entra igual; el orden lo puso Strapi, el reductor no compara fechas |

## Prueba

**Unitaria**, en `tests/bitacora-resumen.test.mjs`, sobre `filasAResumen()` (función pura, Node 22 le puede importar el `.ts` como el resto, sin dependencias nuevas):

```js
test('sin filas: resumen vacío, no nulo', () => {
  expect(filasAResumen([])).toEqual({ total: 0, porMarca: {}, recientes: [] });
});
test('agrupa por marca y corta a 3 por marca y 6 recientes', () => { /* 4 meliponas + 2 granja */ });
test('respeta el orden que llega, no vuelve a ordenar', () => { /* fecha vieja primero sigue primero */ });
```

**En producción, después del deploy** (no son tests, son el contrato de la fase):

```bash
# el hub ya tiene por dónde bajar
curl -s "https://iwage.co/?cb=$RANDOM" | grep -c 'href="/[a-z]*/bitacora"'          # ≥ 2
curl -s "https://iwage.co/?cb=$RANDOM" | grep -c 'href="/[a-z]*/bitacora/[^"]*"'    # ≥ 6
# una landing con contenido y una vacía
curl -s "https://iwage.co/granja/?cb=$RANDOM" | grep -c 'href="/granja/bitacora/'   # ≥ 3
curl -s "https://iwage.co/cafe/?cb=$RANDOM" | grep -c 'Desde la bitácora'           # 0
# granja ya llega a su bitácora por el menú
curl -s "https://iwage.co/granja/?cb=$RANDOM" | grep -c 'href="/granja/bitacora"'   # ≥ 1
# la portada no se cae bajo concurrencia
seq 60 | xargs -P12 -I{} curl -s -o /dev/null -w "%{http_code}\n" "https://iwage.co/?cb={}" | sort | uniq -c   # 60 200
```

Y antes de purgar ninguna caché, la verificación se hace en el origen (`127.0.0.1:4321` dentro de `iwage_web`), que es cómo se descubrió que `/meliponas/bitacora` daba 500 mientras el borde servía la versión vieja.

## Riesgo principal

`/` es lo único que Google indexó en la vida del dominio. Un error ahí vale más que todo el enlazado ganado --el precedente es `ICON` sin definir, que estuvo invisible meses porque la bitácora estaba vacía y en cuanto hubo artículos dejó la portada en 500 (`6b26abb`). De ahí las tres reglas: el bloque se degrada a nada, se verifica en el origen antes de tocar cachés, y el despliegue entra por CHECKPOINT con confirmación escrita del usuario.
