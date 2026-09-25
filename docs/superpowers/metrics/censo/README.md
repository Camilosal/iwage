# Censo de medios — procedimiento versionado

Aquí vive **cómo** se mide el censo, no el resultado. El resultado está en
`../2026-09-24-antes.md` (línea base) y en el informe de después que produce la
Tarea 16. La regla del plan: **ningún número se copia de la spec; todos salen de
una comando reproducible.**

## Por qué existe esto

La métrica antes/después se tomó el 2026-09-24 contra el sitio vivo con scripts
sueltos en `/tmp` (volátiles: se pierden en un reinicio) y una de las nueve filas
—«141 de 185 páginas sin `<img>` en `<main>`»— era un one-liner que no quedó en
ningún lado. Sin procedimiento versionado, el "después" no es comparable con el
"antes": sería una medición con reglas distintas que casualmente da otro número.

## Los archivos

| archivo | qué mide | insumo |
|---|---|---|
| `crawl.sh` | baja una URL y deja `indice\|http_code\|url` en `crawl.log` + el HTML en `html/NNNN.html` | la lista de URLs (`urls.txt`, no versionada: 185 rutas del sitio vivo) |
| `parse.mjs` | inventario de activos: toda `src`/`href`/`poster`/`content` de imagen en el HTML | `html/` → `assets.json` |
| `analyze.py` | cobertura por página: imagen propia vs stock vs rota, con el conteo por sección | `assets.json` + `html/` → `coverage.json` |
| `pages.py` | filas 2 y 9: páginas con imagen **exclusiva** y páginas con referencias rotas | `coverage.json` |
| `main-imgs.mjs` | fila 1: páginas cuyo `<main>` no renderiza ningún `<img>` | `crawl.log` + `html/` |
| `huerfanas.mjs` | fila 6: piezas de `public/images/**` que ningún código puede emitir — quita los bloques `{/* … */}` de Astro antes de buscar, porque una cita dentro de un comentario no se pinta | `public/images/` + `src/` |
| `campos-strapi.mjs` | fila 4: campos de medio de los esquemas y sus representaciones | `strapi/src/api/**/schema.json` |
| `censo.sh` | **las nueve filas de una vez**, con estos mismos scripts y en este orden | un directorio de crawl; `--con-bd` agrega la fila 3 (`SELECT` por `docker exec`) y la fila 9 sale contra `CRAWL_BASE` |

## Cómo se corre el censo completo

```bash
# 0. Directorio de trabajo con html/ y urls.txt (ver "La carpeta del crawl")
cd <dir-crawl>

# 1. Crawl de las 185 URLs del sitio vivo (el índice es también el nombre del HTML)
i=0; while read -r u; do i=$((i+1)); bash crawl.sh "$u" "$i" >> crawl.log; done < urls.txt

# 2. Filas 1, 2 y 9 (HTML)
node main-imgs.mjs .
node parse.mjs                # lee crawl.log + html/, escribe assets.json
python3 analyze.py            # imprime la cobertura por sección
python3 pages.py              # páginas exclusivas y rotas

# 3. Filas 4 y 6 (van con el repo; la fila 6 ya no es un grep suelto)
cd <repo> && node docs/superpowers/metrics/censo/campos-strapi.mjs
cd <repo> && node docs/superpowers/metrics/censo/huerfanas.mjs   # fila 6, comentario-consciente
```

## La carpeta del crawl

El HTML de 185 páginas son ~18 MB: **no van en git**. La copia del "antes" está en
`/home/ubuntu/backup/iwaudit-antes-2026-09-24/` y lo que sí se versiona aquí es lo
que la hace verificable sin volver a gatear el sitio:

- `inputs-antes/crawl.log` — los 185 `indice|código|url` (con esto se puede re-crawlear la misma lista).
- `inputs-antes/assets.json`, `inputs-antes/coverage.json` — las dos salidas intermedias.
- `inputs-antes/html.sha256` — 185 hashes, uno por página. Verificado, reproduce 185 `OK` y 0 fallos:

```bash
cd /home/ubuntu/backup/iwaudit-antes-2026-09-24
sha256sum -c /home/ubuntu/negocio/data/app_iwage/docs/superpowers/metrics/censo/inputs-antes/html.sha256 \
  | grep -c ': OK'          # esperado 185; si es menor, alguna página ya no es la que se midió
```

Si ese contejo no da 185, el `html/` que se está midiendo no es el que se midió y el número que se reporte es de otro sitio: hay que decirlo.
`main-imgs.mjs` y `pages.py` piden `html/`, así que corren contra esa copia del
backup, no contra `inputs-antes/`.

## Definiciones, fila por fila

Lo que significa cada fila está escrito donde se midió, con el valor y la
advertencia que le corresponde: **`../2026-09-24-antes.md`**.

## Advertencias que ya costaron un error

- **Un `grep` contra `src/` no prueba que un archivo se pinte.** La fila 6 histórica era
  `grep -rqn "$base" src/`, y eso cuenta cualquier coincidencia — incluida la que vive dentro de un
  bloque comentado `{/* … */}` de Astro. Medido en los dos crawls (185 URLs cada uno):
  `proyecto-ambala-1.webp` aparece una sola vez en `src/`, dentro de un comentario, y en **0** de los
  185 HTML. Ahora mide la fila `huerfanas.mjs`, que quita los bloques comentados antes de buscar:
  lee **48** (36 + 12 + 0) donde el comando histórico leía 47. El `47` queda en las tablas del
  «antes» y del «después» como lo que la herramienta midió entonces; `tests/censo-huerfanas.test.mjs`
  fija el criterio nuevo, incluido el caso real de `meliponas/index.astro:160`.
- **`analyze.py` no es estable en el tiempo.** Su mitad "disco" cruza los nombres
  de `public/images/` contra `src/`; como el F1 se llevó los seeds de `src/lib`, la
  fila 6 baja sola sin que cambie nada en el CMS. Para el "después" hay que medir
  dos veces: contra el HEAD de hoy y contra `781704f^`, y reportar las dos.
- **Las 20 respuestas de API que se guardaron en el crawl (`api_*.json`) son páginas
  404**, no datos: son 6408 bytes idénticos de "Página no encontrada · Iwagé". La
  fila 3 no se midió con ellas y no se puede medir con ellas; se mide con `psql`.
- **`grep -rnE "unsplash" src/` cuenta comentarios.** La fila 8 es URLs literales
  (`grep -oE "https?://…"`); con el regex ingenuo aparece 1 falso hit en
  `src/lib/naturaleza.ts:478`, que es un comentario que dice justamente que no hay
  stock.
- **Barrer los campos de Strapi solo por nombre pierde `experimento.documentos`.**
  Es media múltiple y su nombre no está en el vocabulario del regex. `campos-strapi.mjs`
  captura todo `type: media` por tipo y el resto por nombre; con esa regla salen los
  41 campos y las 5 representaciones de la spec.
