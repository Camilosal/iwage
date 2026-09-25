#!/usr/bin/env bash
# Corre las nueve filas del censo con los MISMOS comandos de ../2026-09-24-antes.md.
#
# Uso:  ./censo.sh <directorio-del-crawl> [--con-bd]
#
# El directorio del crawl es lo que produce `crawl.sh`: `crawl.log`, `urls.txt` y los
# HTML en `html/NNNN.html`. Sirve igual para el sitio vivo que para un preview local:
# lo que mide la fila 1 es el HTML de ese directorio, y su criterio está fijado en
# `main-imgs.mjs` (el bloque `<main>` sin ningún `<img>`).
#
# La regla del plan es que el "después" no use comandos nuevos: si alguien corre otro
# parser, la comparación con la línea base deja de valer. Este script existe para que
# las dos mitades del número salgan del mismo código.
#
# Sin `--con-bd` se omite la fila 3, que hace un `SELECT` a la base de Strapi por
# `docker exec`. Solo lee conteos: nunca escribe, nunca abre conexión con cadena de
# credenciales, nunca imprime un secreto.

set -uo pipefail

CENSO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$CENSO/../../../.." && pwd)"
CRAWL="${1:-}"
CON_BD="${2:-}"
# Origen para la fila 9, que se mide contra el servidor y no contra el crawl.
CRAWL_BASE="${CRAWL_BASE:-https://iwage.co}"

if [ -z "$CRAWL" ]; then
  echo "uso: $0 <directorio-del-crawl> [--con-bd]" >&2
  exit 2
fi
if [ ! -d "$CRAWL/html" ] || [ ! -f "$CRAWL/crawl.log" ]; then
  echo "en $CRAWL no hay html/ ni crawl.log: no es un directorio de crawl" >&2
  exit 2
fi

linea() { printf '\n## %s\n' "$1"; }

linea "paso 0 - re-parsea el crawl (assets.json y coverage.json, mismo parser que el 'antes')"
( cd "$CRAWL" && node "$CENSO/parse.mjs" && python3 "$CENSO/analyze.py" >/dev/null && echo "   assets.json y coverage.json regenerados" )

linea "paso 1 - son las mismas paginas que se midieron?"
# Los 185 hashes de la linea base. Sobre la copia del "antes" debe dar 185.
# Sobre un crawl nuevo este numero dice CUANTAS paginas no cambiaron: no es un fallo,
# es la trazabilidad de que se sigue midiendo el mismo sitio.
( cd "$CRAWL" && sha256sum -c "$CENSO/inputs-antes/html.sha256" 2>/dev/null | grep -c ': OK' )
echo "   esperado 185 en /home/ubuntu/backup/iwaudit-antes-2026-09-24"

linea "fila 1 - paginas cuyo <main> no renderiza ningun <img>"
node "$CENSO/main-imgs.mjs" "$CRAWL"

linea "fila 2 - paginas con imagen propia exclusiva"
( cd "$CRAWL" && python3 "$CENSO/pages.py" )

linea "fila 3 - registros publicados con un medio enlazado en Strapi"
if [ "$CON_BD" = "--con-bd" ]; then
  docker exec sostenibilidad_db psql -U admin -d iwage -Atc \
    "select (select count(*) from files) as files, (select count(*) from files_related_mph) as enlaces"
else
  echo "   omitida (falta --con-bd): hace SELECT sobre la base de Strapi"
fi

linea "fila 4 - campos de medio y representaciones en los esquemas"
( cd "$REPO" && node "$CENSO/campos-strapi.mjs" )

linea "fila 5 - archivos de imagen en public/images"
printf '   versionados (git ls-files)  : %s\n' "$( cd "$REPO" && git ls-files public/images | wc -l )"
printf '   png solo en servidor        : %s\n' "$( ls "$REPO"/public/images/cafe-menu/*.png 2>/dev/null | wc -l )"
du -sh "$REPO"/public/images/bitacora "$REPO"/public/images/galeria "$REPO"/public/images/cafe-menu 2>/dev/null

linea "fila 6 - piezas producidas y nunca enlazadas (fuera de bloques comentados; ver huerfanas.mjs)"
node "$CENSO/huerfanas.mjs"

linea "fila 7 - referencias a strapiImage en src/"
( cd "$REPO" && grep -rn "strapiImage" src/ | wc -l )

linea "fila 8 - URLs de terceros en src/"
( cd "$REPO" && grep -rnoE "https?://[A-Za-z0-9.-]*(unsplash|tienda\.iwage\.co)[^\"')]*" src/ | wc -l )

linea "fila 9 - rutas /images/perfiles/*.jpg (contra $CRAWL_BASE)"
for f in productivo campestre nomada turistico patrimonial; do
  codigo="$( curl -s -o /dev/null -w '%{http_code}' "$CRAWL_BASE/images/perfiles/$f.jpg" 2>/dev/null )"
  printf '   %-12s %s\n' "$f" "${codigo:-sin-red}"
done
printf '   versionadas en public/images/perfiles: %s\n' "$( cd "$REPO" && git ls-files public/images/perfiles | wc -l )"
