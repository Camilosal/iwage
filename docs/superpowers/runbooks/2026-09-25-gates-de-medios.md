# Puertas abiertas de la consolidación de medios — runbook

**Para:** el dueño del sitio. Cada puerta es una decisión suya, no de este agente: el código está
escrito y medido, lo que falta es ejecutar sobre infraestructura compartida y sobre datos.

**Estado del trabajo:** `master` en `be6b92c`, **adelantado 91 commits sobre `origin/master`**
(nada publicado). `npm test` 309/309. Censo en tres pasadas
(`docs/superpowers/metrics/2026-09-25-despues.md`). Todo lo de abajo está en el orden correcto; el
orden **no es negociable** en G2 → G3 → G5, y la razón está escrita en cada una.

Cómo se lee cada puerta: *qué desbloquea* → *precondición medible* → *comandos* → *qué debe salir*
→ *rollback*.

## G0 · Antes de nada: rotar credenciales (independiente del resto, y urgente)

`reimport_products.py:28` y `strapi/scripts/sync-experiencias.mjs:29` y `:66` tienen **cadenas
literales largas** donde los demás archivos leen del entorno (clasificado sin imprimir ningún
valor). Los cuatro archivos están versionados y el repo es público.

- Rotar el token de Strapi y la contraseña de base de datos que aparezcan ahí.
- Reemplazar el literal por lectura de entorno, y borrar el valor de la historia si se va a
  publicar el repo tal cual: un `git rm` no borra el valor del historial.
- **No empujar (`git push`) hasta haber rotado.** Con 91 commits locales pendientes, este es el
  momento barato de hacerlo, no después.

## G1 · Volumen durable para `uploads` (F0)

**Desbloquea:** que lo que se suba en G3 sobreviva a cualquier rebuild. Sin esto, G3 y G4 son
esfuerzo que se borra solo.

**Precondición, verificada el 2026-09-25:** `docker inspect iwage_strapi --format '{{json .Mounts}}'`
→ `[]`, y dentro del contenedor `/app/public/uploads` solo tiene `.gitkeep` (0 bytes, 25-jul). No
hay material que rescatar, y concuerda con `files = 0` en la BD. La causa es `strapi/Dockerfile:7`
(`RUN mkdir -p public/uploads`): el directorio vive en la capa escribible de la imagen.

**Comandos** (archivo fuera del repo: `/home/ubuntu/negocio/docker-compose.yml`, servicio
`iwage_strapi`, ~línea 1104):

```yaml
# dentro de iwage_strapi:, entre ports: y environment: (4 espacios)
    volumes:
      - iwage_strapi_uploads:/app/public/uploads

# bloque top-level volumes: (~línea 1437)
  iwage_strapi_uploads:
```

```bash
cd /home/ubuntu/negocio
docker compose up -d iwage_strapi          # reinicia el CMS: ~30 servicios comparten este archivo
```

**Qué debe salir:**

```bash
docker inspect iwage_strapi --format '{{json .Mounts}}'   # un mount → /app/public/uploads
docker volume inspect iwage_strapi_uploads --format '{{.Name}}'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:1338/_health   # 200 tras el start_period
```

Y la premisa de `mediaSrc` (URL relativa de sitio): `nginx.conf:92` del repo ya tiene
`location ^~ /uploads` → `upstream strapi_backend`, verificado por lectura. Falta la prueba con un
archivo real, que es el paso final de G3.

**Rollback:** quitar el bloque `volumes:` y `docker compose up -d iwage_strapi`. El volumen queda
vacío e inofensivo; `docker volume rm negocio_iwage_strapi_uploads` si se quiere borrar.

## G2 · Reconstruir Strapi con los esquemas de `fa240b2`

**Desbloquea:** todo el F2 visible. Hoy el contenedor sirve el esquema **anterior**, así que los
`populate` de los campos que pasaron a `media` contestan `400 Invalid key` y las superficies se
degradan a vacías (bitácora las 7, tienda, proyectos, polinización y las fichas de anfitrión). La
sonda completa está en `populate-runtime-probe.mjs` (directorio SDD). Esto es condición de
despliegue, no de curiosidad: desplegar la rama **antes** de esta puerta deja esas páginas vacías.

**Advertencia medida:** Strapi 5.55.0 **borra la columna** de todo atributo que ya no está en el
esquema, en cada arranque (`@strapi/database/dist/schema/builder.mjs:277-279` → `dropColumn`; el
default de `forceMigration` es `true` y `strapi/config/database.ts` no fija `settings`). Lo que hoy
protege los datos es que el `dist/` del contenedor está viejo.

**Por eso el orden: G1 → dump → G2 → G3.** Con `fa240b2` el riesgo es casi nulo: de las 10 columnas
que toca, 9 tienen 0 valores y la décima (`anfitriones.galeria_fotos` → `galeria`) son 2 filas de
Unsplash que la decisión F1 mandaba quitar igual. El peligro real es el Grupo C (G5), y por eso ese
commit va **después** de G3.

```bash
cd /home/ubuntu/negocio
docker exec -i sostenibilidad_db pg_dump -U admin -d iwage > /home/ubuntu/backup/iwage-pre-rebuild-$(date +%F).sql
docker compose build iwage_strapi && docker compose up -d iwage_strapi
```

**Qué debe salir:** el probe de arriba, repetido, en 200 con `populate`. Medida rápida:

```bash
curl -s 'http://127.0.0.1:1338/api/bitacoras?populate=imagen' | head -c 200   # data[], no 400
curl -s 'http://127.0.0.1:1338/api/cultivo-polinizacions' -o /dev/null -w '%{http_code}\n'   # 200 (hoy 404)
```

**Rollback:** el dump. Y si el arranque cae, `strapi/src/api` al commit anterior y rebuild.

## G3 · Importar y enlazar las 47 piezas huérfanas (`--apply`)

**Desbloquea:** la fila 3 del censo (hoy **0 de 180** registros publicados con un medio enlazado) y
la meta de la fila 1 (≤ 85). Son 36 tapas de bitácora + 11 de `galeria`; en disco hay **48**
archivos entre los dos directorios, y la diferencia es `proyecto-ambala-1.webp`. El censo lo cuenta
como «referenciado» por el grep de `src/`, pero la única coincidencia (`meliponas/index.astro:160`)
está dentro de un bloque comentado `{/* … */}`: no pinta, así que el archivo está huérfano de hecho.
El bloque es materia del Task 15 (¿hay material grabado, o se borra?), no de esta puerta. Las 19 de
`cafe-menu` no cuentan: hoy las pinta una regla por nombre, y eso es G6.

**Primero en seco** (sin flags el script solo hace GET; es el guard de esta herramienta):

```bash
cd /home/ubuntu/negocio/data/app_iwage
STRAPI_URL=http://127.0.0.1:1338 STRAPI_TOKEN=<token> node strapi/scripts/media-import.mjs --dry-run
```

Qué mirar en el reporte: los baldes `alias` / `slug exacto` / `nombre normalizado` / `revisar`, y
que el último **no se enlaza ni con `--apply`**. Los conteos de referencia están en
`docs/superpowers/metrics/2026-09-24-antes.md` (fila 6).

**La parte mecánica ya está hecha, y en el envase correcto.** `strapi/scripts/media-alias-propuesto.json`
trae **33 filas** dentro de `{"aviso": …, "alias": {…}}` — la forma que exige `leerAlias()`; un mapa
directo sin la clave `alias` se aborta antes de la primera petición. Son **27 pares**
archivo→bitácora (forma 1) y **6 series** proyecto→`galeria` (forma 2, clave = `documentId`). La
forma 2 no es un adorno: los 6 `proyecto-meliponarios` tienen `slug: null` medido en 6/6, así que
ninguna regla por nombre los puede firmar. Y el emparejamiento es cerrado — cada raíz de serie
(`ambala`, `bonifacio`, `carmen`, `cumbre`, `esperanza`, `poblado`) comparte tokens con **un solo**
registro y con **ningún** otro (0,33–0,50 contra 0,00 del segundo). Está generado por script, no
transcrito, y `tests/media-alias-propuesto.test.mjs` le verifica rutas existentes, endpoints y
campos de la tabla, ningún destino repetido, ningún archivo declarado dos veces, y que
`manifesto()` firma las 33 sin mandar una a `motivosAlias` — con el inventario tomado **del disco**
(48 archivos), no de la propia lista de la propuesta.

> Para versionar la propuesta una vez decidida: `strapi/scripts/` está ignorado por `.gitignore:36`,
> así que hace falta `git add -f strapi/scripts/media-alias-propuesto.json`. Sin el `-f`, `git add`
> rechaza el lote completo y el commit no corre.

**Lo que sigue siendo decisión del dueño** — las 9 tapas que la propuesta no toca:

- `bitacora-miel-chef.webp` y `bitacora-miel-cocina.webp` se disputan la misma publicación: hay que
  decidir cuál (o escribirlas a registros distintos).
- 7 sin par: `calendario-manejo`, `conservacion-cosecha`, `cosecha-miel`, `modulo6-division`,
  `modulo9-cosecha`, `red-meliponicultores`, `territorio-pijao`.

Sin fila de alias, esas 9 quedan en `pendientes` y no se escriben. Por eso hace falta el alias a
pesar de las reglas: medido en disco, **0 de 36** tapas enlazan por nombre (el archivo trae el slug
recortado y la publicación uno más largo).

**Verificación previa, de solo lectura y sin credenciales** (`GET /api/bitacoras` en el runtime
local, medido el 2026-09-25): la BD tiene **56 bitácoras**, **0 slugs duplicados**, y **los 27
slugs de la propuesta existen los 27**. Los 6 `documentId` de las series salen de la misma clase
de lectura (`GET /api/proyecto-meliponarios`, 6 registros, `slug: null` en 6/6), así que tampoco
pueden caer por «registro que no aparece en la lectura». Es decir: `--apply` con esta propuesta no
puede producir un solo `motivosAlias` por destino inexistente. Lo que queda es decisión de nombre.

Candidato medido para las 9 (similitud de Jaccard sobre tokens, contra las 29 bitácoras que la
propuesta no reclama). **Es pista, no decisión** — el que elige es el dueño:

| tapa | candidato (slug libre) | sim. | lectura |
|---|---|---|---|
| `bitacora-conservacion-cosecha` | `conservacion-y-cosecha-de-miel` | 0,67 | disputada: es también el mejor candidato de otras dos |
| `bitacora-cosecha-miel` | `conservacion-y-cosecha-de-miel` | 0,67 | su otra opción (`…-humedad-frio-fermentacion-y-extraccion`) **ya tiene tapa** propuesta (`bitacora-fermentacion-miel`) |
| `bitacora-modulo9-cosecha` | `conservacion-y-cosecha-de-miel` | 0,25 | tercer reclamante del mismo slug; la alternativa es `lote-l25-05-001-cosecha-mayo` (0,14) |
| `bitacora-miel-chef` | `la-miel-de-angelita-y-el-chef-…-alta-cocina` | 0,29 | disputa de dos sobre un artículo |
| `bitacora-miel-cocina` | `la-miel-de-angelita-y-el-chef-…-alta-cocina` | 0,29 | el mismo, byte por byte |
| `bitacora-territorio-pijao` | `abejas-sin-aguijon-cosmovision-pijao` | 0,17 | el token raro (`pijao`) coincide; el puntaje bajo es por longitud del slug |
| `bitacora-modulo6-division` | `division-colonias-angelita-tetragonisca-angustula` | 0,17 | el único candidato libre **y** no disputado de la lista |
| `bitacora-calendario-manejo` | — | 0,00 | ninguna de las 29 libres comparte un solo token: **no es falta de alias, es falta de artículo** |
| `bitacora-red-meliponicultores` | — | 0,00 | igual que la anterior |

Las dos últimas filas cambian de puerta: una tapa sin artículo no se arregla con `--apply`, se
arregla escribiendo el artículo o retirando la tapa (F3, hueco de contenido que ya está en el
censo de la fila «nos falta»).

**Las otras dos decisiones de esta puerta son de galería, y tampoco están tomadas:**

1. **La portada de los 6 proyectos.** La propuesta escribe las 9 fotos en `galeria` y deja `imagen`
   vacío, porque un archivo no puede declararse en dos filas del mismo envase. Si se quiere portada,
   hay que *sacar* un archivo de su serie y ponerlo en `imagen` — con lo que `ambala`, `carmen` y
   `cumbre` (dos fotos cada una) aceptarían portada, y `bonifacio`, `esperanza` y `poblado` (una
   sola) se quedarían sin galería si esa foto pasa a ser portada. Medido: `imagen` de
   `proyecto-meliponarios` está vacío en 6/6, así que hoy la ficha de proyecto no tiene portada y
   degrada al mosaico del `Icon` (decisión de F1: sin fallback).
2. **Los 3 archivos `producto-*` de `public/images/galeria/`.** No tienen fila y no la van a tener
   hasta decidir: `producto-caja-1.webp` empata con tres productos (`caja-af-estandar`,
   `caja-inpa-con-atril`, `caja-inpa-nogal-cafetero`, los tres con slug), y `producto-miel-1.webp` /
   `producto-miel-2.webp` apuntan a los dos productos que también traen `slug: null`
   (`Miel Angelita 120ml`, `Miel con propóleo 250ml`) — para estos dos hace falta forma 2 con
   `documentId`, y además un orden: cuál es la 1 y cuál la 2.

```bash
# 1) en seco con la propuesta: hay que leer el reporte antes de escribir
STRAPI_URL=http://127.0.0.1:1338 STRAPI_TOKEN=<token> \
  node strapi/scripts/media-import.mjs --dry-run --alias=strapi/scripts/media-alias-propuesto.json
# 2) solo después de la revisión: copiar las filas aceptadas a media-alias.json (hoy vacío) y aplicar
STRAPI_URL=http://127.0.0.1:1338 STRAPI_TOKEN=<token> \
  node strapi/scripts/media-import.mjs --apply --alias=strapi/scripts/media-alias.json
```

**Qué debe salir:**

```sql
select (select count(*) from files) as assets, (select count(*) from files_related_mph) as enlaces;
```
→ `47` y un número de enlaces ≥ 47 (hoy `0|0`). Y en el sitio, una ficha de bitácora con su tapa
servida desde `/uploads/...` — esa prueba cierra la premisa de `mediaSrc` que en G1 solo se pudo
ver en la config de nginx.

**Rollback:** el dump de G2 (los enlaces y los `files` salen con él), y en el CMS se puede
desenlazar a mano. Idempotencia del importador: por **nombre**, así que repetir no duplica; no
detecta re-producción (mismo nombre, bytes distintos).

## G4 · Vaciar Unsplash y placeholders en la base

**Desbloquea:** que el admin no muestre como contenido lo que el sitio ya se niega a pintar.
`esPintable()` dejó de pintarlo en F1, pero el valor sigue en la BD: **12 celdas con 18 URLs** de
Unsplash en 7 columnas de 2 tablas, y **5 celdas con 6 ocurrencias** de embeds placeholder (tres
rickroll, una demo de momento360 y una quinta dentro del json de `experiencias.galeria_urls`).

Verificación en un solo número (debe dar 12 hoy y 0 después):

```sql
select (select count(*) from anfitriones where foto_perfil_url  like '%unsplash%')
     + (select count(*) from anfitriones where foto_territorio::text like '%unsplash%')
     + (select count(*) from anfitriones where galeria_fotos::text   like '%unsplash%')
     + (select count(*) from anfitriones where video_thumbnail::text like '%unsplash%')
     + (select count(*) from experiencias where imagen_hero_url::text like '%unsplash%')
     + (select count(*) from experiencias where galeria_urls::text    like '%unsplash%')
     + (select count(*) from experiencias where mapa_imagen_url::text like '%unsplash%') as celdas;
```

Dos cosas que son **decisión de contenido**, no limpieza:

- `don-hernando-caficultor` y `luz-elenia-herbalista` tienen su retrato puesto con un stock de
  Unsplash, presentados como su cara con nombre y apellido reales. Retirar sin más deja la ficha
  sin foto (el mosaico Icon ya está diseñado para eso); reemplazar pide foto real.
- La quinta celda de placeholder **no se pone a `null`**: hay que reescribir el json quitando los
  dos ítems, porque `galeria_urls` es la única galería que tienen las 2 experiencias publicadas.

Y si en G2 se autorizó el retiro de `galeria_fotos` / `*_url`, esta puerta puede absorberse en el
mismo `UPDATE` posterior a G3 — pero después de G3, nunca antes.

## G5 · Grupo C: retirar del esquema los últimos campos `string`

**Desbloquea:** la fila 4 entera (hoy 41 campos en 4 representaciones; faltan 8 por migrar).
**Ninguno de estos campos puede salir del esquema antes de G3**, o Strapi los abajo en el arranque
y se pierden **49 valores vivos**: `hero_configuracions.imagen` 39 (el Paso H),
`anfitriones.foto_perfil_url` 2, `experiencias.imagen_hero_url` 2 (los twins son contenido, no
basura), `experiencias.galeria_urls` 2, `anfitriones.foto_territorio` 2, `anfitriones.video_thumbnail`
1, `experiencias.mapa_imagen_url` 1. `complementos.imagen_url` está en 0.

Orden: G3 → reescribir los lectores en `src/` a `MediaItem` (lo hacen ya los 26 campos convertidos;
el cambio de cada uno es mecánico y tiene guard) → dump → commit del esquema → rebuild.

## G6 · Café: borrar la regla por nombre (Task 13)

**Condición medida el 2026-09-25, y hoy no se cumple:** el paso 1 del task pide «0 items sin
imagen», y la base tiene `files = 0` con **17** filas en `item_menus` y 4 en `proveedors`. Mientras
no haya assets, `LOCAL_IMAGES` es lo único que pinta el menú: se borra después de G3, cuando el
paso 1 dé 0. (Precisión del plan: son 17 filas, no «las 19 preparaciones».)

## G7 · Permisos de lectura pública

`api::experimento` y `api::historia-visitante` no tienen `find`/`findOne` para el rol Public, así
que sin token el sitio recibe 403 y esas superficies tiran de su relleno. Se cierra en
Settings → Roles Públicos, o sembrando los permisos en `strapi/src/bootstrap`. Es la puerta de que
`getHistoriasVisitantes()` deje de devolver `[]`.

## G8 · Publicar y desplegar

91 commits, 309/309 verdes, build aislado verde y 185/185 en 200 contra un preview local. Antes de
`git push`: G0. Después de G2 y G3, el censo se mide **contra el sitio desplegado** y las filas 1,
2 y 9 dejan de decir «no medible todavía»:

```bash
CRAWL_BASE=https://iwage.co bash docs/superpowers/metrics/censo/censo.sh <dir-del-crawl> --con-bd
```

## Lo que ya está cerrado (para no volver a abrirlo)

F0 contrato de URL (`mediaSrc` relativo, `absUrl` para OG, `try/catch` en `heroes.ts`), F1 contrato
único en `src/lib/media.ts` con `MediaGallery` como única galería y **cero** `strapiImage` y **cero**
URLs de terceros en `src/` (medido también en las 185 páginas servidas), F2 lado del código para 26
de los 41 campos y las fichas leyendo `MediaItem`, F3 lado del código (19 PNG fuera, 3
`populate-*.sql` retirados, slot muerto `fotos_evidencia` borrado con guard). Y una revisión en
fresco del rango `851ff10..HEAD` que trajo seis defectos, los seis cerrados con mutante que prueba
que el guard los ve.
