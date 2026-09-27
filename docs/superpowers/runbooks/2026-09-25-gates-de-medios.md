# Puertas abiertas de la consolidación de medios — runbook

**Para:** el dueño del sitio. Cada puerta es una decisión suya, no de este agente: el código está
escrito y medido, lo que falta es ejecutar sobre infraestructura compartida y sobre datos.

**Estado del trabajo:** `master` local, que se lee con `git log -1 --format='%h %s'` (al escribir esto
era `616f8d4`). Conteos como comando, no como número que caduca:
`git rev-list --count origin/master..HEAD` para lo no publicado y
`git rev-list --count ffb0a9c..HEAD` para el rango del plan. `npm test` en la suite de `tests/`.
Censo en tres pasadas (`docs/superpowers/metrics/2026-09-25-despues.md`). Todo lo de abajo está en
el orden correcto; el orden **no es negociable** en G2 → G3 → G5, y la razón está escrita en cada
una. **Ejecutadas: G1 el 2026-09-25 16:33 UTC, G2 esa misma noche (23:40 → 00:02 UTC del 26) y G3 el
2026-09-26 (01:47 → 03:20 UTC)**; cada sección dice qué se midió para verificarla. **G0, a medias el
2026-09-27**: scrub de las cuatro publicaciones, guarda anti-credenciales en la suite y rol propio
`iwage_app` creado y probado; falta la rotación coordinada del host, que no es de esta puerta. Siguen
cerradas: **G4**, **G5**, **G6**, **G7** y **G8** (empujar y desplegar, que nadie autorizó todavía). Que
el `iwage_web` desplegado sea la imagen del 24-09 y el Strapi sea nuevo ya está
medido, no es una sorpresa: ver G2 «Medido después», punto 4 — las 185 URLs sirven exactamente las
mismas referencias de medio con el bundle viejo.

Cómo se lee cada puerta: *qué desbloquea* → *precondición medible* → *comandos* → *qué debe salir*
→ *rollback*.

## G0 · Credenciales publicadas — **medido y scrubado el 2026-09-27; la rotación sigue abierta**

**Qué estaba publicado, en una sola línea:** la contraseña del rol `admin` de PostgreSQL —**superuser del
clúster compartido**— aparecía en 4 archivos trackeados, en 5 formas: valor de `"password"` en un login del
panel (`reimport_products.py:13`), detrás de `process.env.PG_PASSWORD ||`
(`strapi/scripts/sync-experiencias.mjs:20`), dentro de una connection string de respaldo
(`strapi/scripts/seed-heroes-pg.mjs:12`), y dos veces más para una base `inmobiliaria` que ya no existe en
el servidor (`strapi/scripts/sync-propiedades.mjs:8` en el comentario de requisitos y `:15` en el default,
esta vez con el `@` escapado como `%40`). `grep -lF` del valor sobre `git ls-files`: **cero ocurrencias
después del scrub**. El email personal de ese login también estaba literal y hoy se lee del entorno.

**Lo que NO era un secreto, medido antes de afirmarlo.** La lectura rápida del par de login decía
«contraseña del panel en claro». Verificado: el valor coincide byte a byte con `DATABASE_PASSWORD` del
contenedor (por eso lo encontré dos veces), y **aun así no abre el panel**: `POST /admin/login` con ese par
devuelve **400** y `select count(*) from up_users` es **0**. El hallazgo lateral importa para las otras
puertas: **no existe ningún usuario de panel en este Strapi**, así que todo lo que la doc resolvía con
«hacerlo desde Settings → …» (G7, y el desenlazado a mano que ofrecía el rollback de G3) hoy no tiene
quién lo haga; se hace por código o se siembra un usuario.

**Aplicado — scrub y guarda.** Los cuatro archivos leen la credencial solo del entorno y abortan con un
mensaje si falta (`DATABASE_URL`, `PG_PASSWORD`, `FLASK_DB_URL`, `STRAPI_ADMIN_EMAIL` /
`STRAPI_ADMIN_PASSWORD`); ninguno conserva un default con valor, y los cuatro parsean (`node --check`,
`py_compile`). Se agregó `tests/no-credenciales-en-repo.test.mjs`: barre `git ls-files` con tres reglas de
forma — connection string con userinfo, campo de credencial con literal en forma JS, JSON o
`env.X || 'literal'` (la del bug), y bearer/token — más un **digesto sha256 del valor publicado** que lo
reconoce en cualquier forma y en cualquier lado. Dos reglas de falso positivo nacieron de medir:
`apiKey === '…'` y `headers.get('x-api-key')` no cuentan. Dientes probados en las dos mitades: antes del
scrub marcaba exactamente las 5 líneas reales; con el valor metido suelto en un `.md` que ningún patrón
cubre, marca `[digesto-quemado]`. `npm test`: **335/335**.

**Endurecimiento contenido, ya hecho.** Como el valor no se puede retirar del historial sin cortar 15
contenedores (abajo), se le quitó a `iwage` la necesidad de usarlo: rol **`iwage_app`**, `LOGIN`,
`super=false`, `createdb=false`, con `CONNECT` y `CREATE` en la base `iwage`, `USAGE` y `CREATE` en el
esquema `public`, `ALL` sobre tablas y secuencias existentes, y `ALTER DEFAULT PRIVILEGES FOR ROLE admin`
para las futuras — los default privileges son por base de datos, así que no alcanzan a las otras 15.
Verificado sobre TCP con autenticación por contraseña: `CREATE TABLE` con `serial`, `INSERT`, `UPDATE`,
`SELECT`, `ADD`/`DROP COLUMN`, `CREATE INDEX` y `DROP TABLE`, todo dentro de un `BEGIN … ROLLBACK` que no
dejó rastro, y lectura de los datos reales: `bitacoras=112 files=37 enlaces=72 hero=39`. La clave del rol
nuevo está en `/home/ubuntu/backup/d1-rol-iwage-app-2026-09-27.txt` (0600, fuera del repo) y es la única
copia.

**Lo que NO se rotó, y por qué.** `ALTER USER admin PASSWORD …` dejaría sin base a
`sostenibilidad_db` (su propio `POSTGRES_PASSWORD`), `iwage_strapi`, `espacios_plus_web`,
`espacios_plus_strapi`, `marca_personal_web`, `marca_personal_strapi` (dos variables), `reservas_strapi`,
`form_handler`, `sostenty_web`, `n8n_app`, `chatwoot_app`, `chatwoot_sidekiq`, `odoo_erp`,
`listmonk_app`: medido con `docker inspect`, **15 contenedores de otros proyectos llevan el mismo valor**.
Eso es una rotación coordinada del host, no una decisión de esta puerta. Mitigación medida: `5432` solo
escucha en **`127.0.0.1:5432`** (`ss -lntp`; `1338` y `1340` tampoco salen a una interfaz pública), así que
usar el valor exige un pie en la máquina, no una petición desde internet. Aun así el valor está quemado:
para `iwage` deja de servir en cuanto corra la conmutación.

**Conmutación (G8, o cuando el dueño lo diga).** En `/home/ubuntu/negocio/docker-compose.yml`, sección
`iwage_strapi`: `DATABASE_USERNAME=iwage_app` y `DATABASE_PASSWORD=<la del archivo 0600>` → `docker compose
up -d iwage_strapi` → verificar `/_health` 204, `GET /api/bitacoras?populate=imagen` 200, y **sin `error`
en los logs del arranque**: el schema-sync de Strapi crea tablas al subir, y ese es el criterio de que el
rol alcanza, no el 200. Inventario de columnas esperado: 996, igual que al cierre de G2.
**Rollback:** devolver `DATABASE_USERNAME=admin` con el valor viejo, que sigue vivo.

**Historial.** Reescribirlo (`git filter-repo` / BFG) es una decisión aparte y no es el fix: el valor ya
fue público y GitHub cachea. Si se hiciera, es sobre un clon limpio y obliga a re-clonar el trabajo.

## G1 · Volumen durable para `uploads` (F0) — **EJECUTADA el 2026-09-25 16:33 UTC**

**Desbloquea:** que lo que se suba en G3 sobreviva a cualquier rebuild. Sin esto, G3 y G4 son
esfuerzo que se borra solo.

**Precondición, verificada antes de tocar:** `docker inspect iwage_strapi --format '{{json .Mounts}}'`
→ `[]`, y dentro del contenedor `/app/public/uploads` solo tenía `.gitkeep` (0 bytes, 25-jul). No
había material que rescatar, y concordaba con `files = 0` en la BD. La causa es `strapi/Dockerfile:7`
(`RUN mkdir -p public/uploads`): el directorio vive en la capa escribible de la imagen.

### Lo que casi reviente la puerta (y por eso no se corrió el `up -d` a ciegas)

El runbook decía «`docker compose up -d iwage_strapi`» y eso, medido el 2026-09-25, **no era
neutro**: el tag `negocio-iwage_strapi:latest` apuntaba a `f43819fd` (build del 24-sep 03:22)
mientras el contenedor corría sobre `8c5a190d`. Dos hechos distintos, y ambos importan:

- **Recrear = desplegar el build de otra persona sin autorización.** Era G2 disfrazado de G1.
- **La imagen del contenedor vivo ya no existía en el store** (`Error response from daemon: No such
  image: 8c5a190d…`, y watchtower lo reportaba desde el 24-sep como `Reason: container image info
  missing`). O sea: si ese contenedor se detenía, no había forma de volver a arrancarlo con *su*
  código. El CMS estaba sobre una imagen huérfana.

Se resolvió **por medida, no por suposición**: la huella md5 del árbol de esquemas dentro del
contenedor vivo, dentro de `f43819fd` y en `git archive ffb0a9c^ strapi/src/api` es la misma,
`47e98b0f9032cbdb8ae53ecbd373f17c` (HEAD, con el Task 11, es `f251d28d…`: **distinto**). Y `/app/src`
+ `/app/config` completos dan `1ba7daffaaa5b030175231f4cfed4993` en los dos. Conclusión: el build de
ayer es **pre-consolidación, igual al que estaba corriendo**, así que recrear no migra esquema ni
sube código nuevo. Con eso la puerta vuelve a ser G1, y solo G1. Efecto lateral bueno: el contenedor
nuevo apunta a una imagen que **sí existe y está etiquetada**, así que el problema huérfano se cerró
en el mismo movimiento.

Verificado además: **watchtower no puede recrear este servicio** (no tiene lista explícita de
monitoreo, pero cada noche intenta `pull` de `negocio-iwage_strapi:latest` y falla con
`pull access denied` — logs del 22, 23 y 24-sep). No hay riesgo de que alguien lo reinicie solo.

### Seguro tomado antes de reiniciar

```bash
docker exec iwage_strapi sh -c 'tar czf - public/uploads' > /home/ubuntu/backup/iwage-uploads-2026-09-25.tar.gz   # 137 B: .gitkeep
docker exec -i sostenibilidad_db pg_dump -U admin -d iwage > /home/ubuntu/backup/iwage-pre-g1-2026-09-25-1633.sql  # 2,5 MB (BD de 17 MB)
cp /home/ubuntu/negocio/docker-compose.yml /home/ubuntu/negocio/docker-compose.yml.bak-g1-2026-09-25-1630
```

El `pg_dump` no lo pide G1 (no se toca el esquema) y aun así se tomó: la puerta detiene el CMS de un
sitio vivo, y un dump de 17 MB cuesta un segundo.

### Aplicado

Cuatro líneas en `/home/ubuntu/negocio/docker-compose.yml` —**archivo fuera del repo, no versionado**,
así que el cambio no va en ningún commit y su respaldo es el `.bak-g1-2026-09-25-1630`:

```yaml
# iwage_strapi:, entre ports: y environment:
    volumes:
      - iwage_strapi_uploads:/app/public/uploads
# bloque top-level volumes:, después de swetrix-events-data
  iwage_strapi_uploads:
    driver: local
```

Las dos anclas se buscaron por texto exacto y **la edición aborta si alguna aparece ≠ 1 vez**; el
`diff` contra el respaldo devolvió solo esas cuatro líneas. `docker compose config --quiet` → OK; los
dos warnings de `ADMIN_USER`/`ADMIN_PASS` ya estaban en el respaldo (son de otros servicios), no los
introdujo esta edición. Luego `docker compose up -d iwage_strapi`: recreó **una** cosa
(`Volume negocio_iwage_strapi_uploads Created`, `Container iwage_strapi Recreated`);
`sostenibilidad_db` (Up 5 weeks) y `iwage_web` no se tocaron.

### Medido después

```
Mounts            → 1 mount: negocio_iwage_strapi_uploads → /app/public/uploads (rw)
_health           → 204   ← ERRATA: este runbook decía «200». Strapi responde 204 No Content.
estado healthy    → a los ~18 s (ventana real de indisponibilidad del CMS)
env               → mismo conjunto de variables (md5 de nombres 5c2c2c3d… idéntico). El md5 de
                    valores cambia (f014bae7… → e255861c…) y la diferencia es HOSTNAME, que es el
                    id corto del contenedor. Los secretos no se imprimieron nunca.
files (BD)        → 0, como antes
```

**Durabilidad, probada de la forma fuerte** (no «confía en Docker»): se escribió
`/app/public/uploads/.g1-probe` desde Strapi y se leyó **desde el volumen, sin pasar por el
contenedor** — `docker run --rm -v negocio_iwage_strapi_uploads:/v:ro alpine:3 cat /v/.g1-probe`.
Detalle que salió del paso: al montar, Docker copia el contenido que había en la imagen hacia el
volumen nuevo, así que el `.gitkeep` de `strapi/Dockerfile:7` sobrevivió. La sonda se retiró.

**La premisa de `mediaSrc`, cerrada por fin con un archivo real.** El texto anterior decía «`falta la
prueba con un archivo real, que es el paso final de G3»`. Se hizo aquí, que es donde toca:
`https://iwage.co/uploads/g1-probe.txt` → **200 y el contenido**, o sea que la pata de nginx
(`nginx.conf:92`, `location ^~ /uploads` → `upstream strapi_backend`) funciona de punta a punta sobre
una URL relativa de sitio, exactamente la forma que emite `mediaSrc()`. La sonda se borró y esa misma
URL pasó a **404**, y el volumen quedó solo con `.gitkeep` (4.0K). Nada de prueba quedó en producción.

**Inventario de salud del sitio tras la ventana:** `/`, `/meliponas`, `/tierras`, `/gestion`,
`/cafe/menu`, `/ayuda` → 200; fichas `don-hernando-caficultor` y `luz-elenia-herbalista` → 200.
(`/experiencias` y `/bitacora` dan 404 **porque no existen como rutas**: van bajo `/naturaleza/…`; no
son regresión de esta puerta.)

**Para G2, dato útil (medido, no supuesto):** el disco raíz va al **97% con 6,9 G libres** y el
`build` de Strapi cuesta unos 400 MB. **G2 no necesita limpieza previa: hay 17 veces el espacio que
consume.** Los 48 archivos de G3 son 7,3 MB en total (`bitacora` 5,2 M + `galeria` 2,2 M).

Y la frase que estaba escrita aquí («limpieza de imágenes colgantes si hace falta») era **falsa por
inútil y peligrosa a la vez**, medida el 2026-09-25 poco después de G1:

```
docker images -f dangling=true -q | wc -l     → 0     (no hay una sola colgante)
docker system df  → Images 44,7 GB, RECLAIMABLE 87,52 kB (0%)
                → Build Cache 17,83 GB, RECLAIMABLE 2,5 GB
```

La única imagen sin contenedor era `alpine:3` (13,6 MB), la que trajo G1 para leer el volumen. Es
decir: podar colgantes habría liberado **14 MB** y **habría borrado la reversión de G2 en cuanto
existe**. Regla, entonces: podar cache sí (`docker builder prune`, 2,5 GB, no rompe nada: solo
ensombrece la siguiente compilación de alguien); podar imágenes **no**, o gran parte de lo que hoy es
recuperable se va con ellas.

**Rollback:** quitar el bloque `volumes:` (o restaurar el `.bak-g1-2026-09-25-1630`) y
`docker compose up -d iwage_strapi`. El volumen queda inofensivo;
`docker volume rm negocio_iwage_strapi_uploads` si se quiere borrar.

**Cómo se lee el estado del volumen (para no tropezar igual):** el path del host
`/var/lib/docker/volumes/negocio_iwage_strapi_uploads/_data` es `root:root` y un usuario normal no lo
piste (`Permission denied`, y `du` ahí no es fuente fiable). Las dos lecturas válidas son a través del
mount: `docker exec iwage_strapi du -sh /app/public/uploads` o
`docker run --rm -v negocio_iwage_strapi_uploads:/v:ro alpine:3 sh -c 'du -sh /v; ls -a /v'`. Hoy
concuerdan: **4.0K, solo `.gitkeep`**.

## G2 · Reconstruir Strapi con los esquemas de `fa240b2` — **EJECUTADA el 2026-09-25 (23:40 → 00:02 UTC del 26)**

**Desbloquea:** todo el F2 visible. Antes de esta puerta el contenedor servía el esquema **anterior**,
así que los `populate` de los campos que pasaron a `media` contestaban `400 Invalid key` y las
superficies se degradaban a vacías (bitácora las 7, tienda, proyectos, polinización y las fichas de
anfitrión). La sonda completa está en `populate-runtime-probe.mjs` (directorio SDD). Esto era
condición de despliegue, no de curiosidad: desplegar la rama **antes** de esta puerta deja esas
páginas vacías. **Ya no: G2 se ejecutó el 2026-09-25 y el runtime es el esquema de `fa240b2`** (ver
«Medido después» al final de esta sección).

**Advertencia medida:** Strapi 5.55.0 **borra la columna** de todo atributo que ya no está en el
esquema, en cada arranque (`@strapi/database/dist/schema/builder.mjs:277-279` → `dropColumn`; el
default de `forceMigration` es `true` y `strapi/config/database.ts` no fija `settings`). Lo que hoy
protege los datos es que el `dist/` del contenedor está viejo.

**Por eso el orden: G1 → dump → G2 → G3.** Con `fa240b2` el riesgo es casi nulo: de las 10 columnas
que toca, 9 tienen 0 valores y la décima (`anfitriones.galeria_fotos` → `galeria`) son 2 filas de
Unsplash que la decisión F1 mandaba quitar igual. El peligro real es el Grupo C (G5), y por eso ese
commit va **después** de G3.

**Estado medido tras G1 (2026-09-25), que cambia dos cosas de esta puerta:**
- El primer paso del orden **ya está hecho**: `/app/public/uploads` es un volumen nombrado, así que lo
  que suba G3 sobrevive a este rebuild. Era el motivo de G1.
- **Hay a dónde volver, que antes no lo había.** El contenedor quedó recreado sobre
  `negocio-iwage_strapi:latest` = `f43819fd`, cuya huella de `/app/src`+`/app/config`
  (`1ba7daff…`) y de esquemas (`47e98b0f…`, igual a `ffb0a9c^`) es idéntica a lo que corría. O sea: si
  el build de G2 se cae a mitad, `docker compose up -d iwage_strapi` con `strapi/src/api` en el commit
  anterior reconstruye el estado actual **desde una imagen que existe en el store**. Antes no: la
  imagen del contenedor vivo estaba borrada.
- Conviene decirlo sin eufemismos: **este `docker compose build` sí es un cambio de código real**
  (`latest` es pre-consolidación; HEAD trae `fa240b2`), así que el `pg_dump` de arriba no es
  ceremonia — es la única reversión del `dropColumn` que Strapi hace al arrancar.
- Disco: medir `df -h /` antes de arrancar. **La estimación anterior («el build cuesta unos 400 MB»)
  estaba mal por un factor de ~8**: durante el `npm install` la libre cayó de 4,9 G a **1,8 G**, y al
  terminar el build quedó en 4,5 G. El pico transitorio (capas intermedias + `node_modules` + admin
  panel + exportación de la imagen) es de varios GB, no de cientos de MB. A 98% de uso esto es lo que
  puede reventar la puerta, y un `docker compose build` que falla por `ENOSPC` **no** rompe el
  servicio: deja `latest` en la imagen vieja. **No podar imágenes después de este build**: ver G1,
  «Para G2, dato útil». Si hace falta espacio, podar cache de compilación (`docker builder prune`),
  que no deja ningún código irrecuperable.

```bash
cd /home/ubuntu/negocio
docker exec -i sostenibilidad_db pg_dump -U admin -d iwage > /home/ubuntu/backup/iwage-pre-rebuild-$(date +%F).sql
docker compose build iwage_strapi && docker compose up -d iwage_strapi
```

**Qué debe salir:** el probe de arriba, repetido, en 200 con `populate`. Medida rápida:

```bash
curl -s 'http://127.0.0.1:1338/api/bitacoras?populate=imagen' | head -c 200   # data[], no 400
curl -s 'http://127.0.0.1:1338/api/cultivo-polinizaciones' -o /dev/null -w '%{http_code}\n'   # 200 (hoy 404)
```

**Aplicado:** `pg_dump` previo (`/home/ubuntu/backup/iwage-pre-rebuild-2026-09-25.sql`, 2.515.184 B) →
build de `negocio-iwage_strapi` → imagen nueva `c5d3fc49` en `latest`, con la reversión anclada en la
etiqueta `pre-fa240b2` (= `f43819fd`, la que estaba corriendo). `docker compose up -d iwage_strapi` recreó
el contenedor: Strapi **5.55.1**, `Launched in 15679 ms`, `Strapi started successfully`, `/_health` → 204,
`/admin` → 200. En los logs del arranque no hay ni un `error`; lo único que aparece es un
`DeprecationWarning` de `pg` que ya estaba.

**Re-medido el 2026-09-26, sin token** (durante la verificación de G3): `bitacoras`,
`proyecto-meliponarios`, `item-menus` e `cultivo-polinizaciones` → **200**; `experimentos` e
`historia-visitantes` → **403**. El 404 de la línea de arriba era **el path que había escrito yo**, no un
problema de esquema: `cultivo_polinizacions` es el `collectionName` de la tabla y la URL del
content-api sale del `pluralName`, que es `cultivo-polinizaciones`. La predicción de G2 sí se cumplió. Los
dos 403 siguen siendo lectura denegada por permisos públicos: eso es G7, no una regresión de esta puerta.

**Un detalle del build que conviene no tragarse:** `strapi build` imprimió **`Found 8 error(s).`** de TS y
siguió adelante (compila igual, construye el admin panel y sale 0). Los ocho son `env.int`/`env.bool`/
`env.array` en `config/database.ts` y `config/server.ts` (el `env` de Strapi sí los tiene; es el tipado) y
dos `'result' is possibly 'null'` en `src/api/experiencia/controllers/experiencia.ts:65`. Medido con
`git log -1 -- <archivo>`: los tres archivos no se tocan desde julio (`d90e25a`, `0c0c13a`) y `fa240b2` no
los tocó, o sea que **son preexistentes y no son riesgo de esta puerta**. Pero significan que el build de
Strapi no es una barrera de tipos: un error de TS real en un esquema pasaría igual de inadvertido.

**Medido después — la superficie de pérdida fue exactamente la prevista:**

- Inventario de columnas (`information_schema.columns`, 1.007 → 996): **11 borradas, 0 nuevas**. Las 11
  son una por una las que anticipó el diff `ffb0a9c^`→`HEAD`: `anfitriones.galeria_fotos` (retirado) y las
  10 que cambiaron de `string`/`jsonb` a `media`. Que no aparezca ninguna columna nueva es lo esperado en
  v5: el media no es una columna, vive en `files` + `files_related_mph` (relación polimórfica), así que el
  campo nuevo `anfitriones.galeria` **no deja huella en el inventario** y su prueba es por API, no por SQL.
- Censo de los 25 pares (tabla, columna) con valores: **55 → 53**. Las 14 columnas que siguen existiendo
  conservan valor por valor (`NINGUNO` distinto en la comparación programática); los 2 que se perdieron son
  las dos filas Unsplash de `anfitriones.galeria_fotos`, que la decisión F1 mandaba quitar y que están en
  el dump. Cero pérdida imprevista.
- Sonda de `populate`, el mismo comando en los dos lados de la puerta: **4 de 10 endpoints**
  (`bitacoras`, `productos`, `proyecto-meliponarios`, `cultivo-polinizaciones`) contestaban
  `400 Invalid key` con el `populate` que ya pedía el código — valor «antes» registrado en la Ronda 4b
  del ledger de SDD (`.superpowers/sdd/2026-09-24-media-strapi-consolidation/ledger.md`, que no va al
  repo). Después: **0 de 10 en 400**. En la corrida de hoy `bitacoras` sin `populate`
  devuelve una fila con 0 campos de medio y con `populate=imagen` la misma fila devuelve 1, que es
  lo que prueba que el campo existe y se puebla; `anfitriones?populate=galeria` → 200 con
  `galeria: []` (campo nuevo, vacío hasta G3). Siguen los dos `403` (`experimentos`,
  `historia-visitantes`) que ya lo eran antes de esta puerta y no le pertenecen: son permisos
  públicos, o sea G7.

- Sitio servido, que es lo que importa a un visitante: re-crawl de las **mismas 185 URLs** con el mismo
  mapeo índice→URL del «antes» (`/home/ubuntu/backup/iwaudit-post-g2-2026-09-25/`). **185 en 200**;
  comparando los conjuntos de referencias de medio (img/og/srcset/poster) página por página:
  **0 perdidas, 0 nuevas en las 185**. A nivel de bytes, en cambio, `sha256sum -c` da `0 OK`, y eso es el
  refactor de JSON-LD de otro flujo ya desplegado (reordenó claves, p. ej. `"url":"https://iwage.co/"`),
  no G2 — para descartarlo no se asumió: la misma comparación sobre la copia del «antes» da 185 OK, así
  que la máquina compara bien y lo que cambió fue el orden del JSON-LD.
- Fila 3 del censo: `files = 0`, `files_related_mph = 0` (máquina `0|0`). G2 **no enlaza** material; eso
  es G3. Y el volumen de G1 sobrevivió la recreación: `iwage_strapi_uploads -> /app/public/uploads rw=true`,
  `du -sh` 4.0K con su `.gitkeep`.
- `npm test` después del rebuild: **334/334**. El repo no cambió por esta puerta; se corre igual, porque
  el tree es compartido.

**Consecuencia para las siguientes puertas:** la advertencia de Strapi 5.55 («borra la columna que ya no
está en el esquema») quedó **confirmada en producción**: 11 columnas cayeron en un solo arranque. Para G5
(Grupo C, 49 valores vivos en columnas `string`) esto no es una nota: es el procedimiento obligatorio —
dump antes, y si un atributo sale del esquema la columna desaparece con sus valores, sin aviso.

**Rollback:** el dump. Y si el arranque cae, `strapi/src/api` al commit anterior y rebuild. Hoy, con las
dos imágenes en el store, hay además un rollback de un comando:
`docker tag negocio-iwage_strapi:pre-fa240b2 negocio-iwage_strapi:latest && docker compose up -d iwage_strapi`.
Ojo con lo que ese comando **no** revierte: devuelve el código y el esquema, pero no devuelve las 11 columnas
que el arranque nuevo ya borró con sus datos — eso solo lo repone el dump.

## G3 · Importar y enlazar las piezas huérfanas (`--apply`) — **EJECUTADA el 2026-09-26 (01:47 → 03:20 UTC)**

**Desbloqueaba:** la fila 3 del censo, que estaba en **`0|0`** — ni un archivo en la media library, ni
un enlace — y, a través del render, la meta de la fila 1 (≤ 85), que es de bundle y por lo tanto se mueve
con G8, no acá. El título prometía «47 piezas»: **36 tapas de bitácora + 11 de `galeria`**. Lo que esta
puerta podía escribir sin decidir en nombre del dueño eran **36 archivos en 33 enlaces**: 27 tapas y las
9 fotos de las 6 series de proyecto. Quedan 12 afuera — 9 tapas sin par firme y 3 `producto-*` en
disputa —, y los doce están listados abajo como decisión del dueño, no como fallo del importador. (El 47 del plan descontaba `proyecto-ambala-1`, que sí se escribió.) En disco
hay **48**
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

> Para versionar lo que se escriba en esa carpeta, medido: `.gitignore:36` es `scripts/`, que casa
> `strapi/scripts/**` para cualquier archivo **nuevo** (`git check-ignore -v
> strapi/scripts/nuevo-prueba.json` devuelve la regla). Los dos envases de alias, en cambio, ya estaban
> versionados antes de la regla —`git ls-files strapi/scripts` los lista—, así que sus modificaciones sí
> entran al commit: `git add` los stagea y de paso avisa «paths are ignored» y sale con 1. El aviso es
> ruido sobre el directorio, no un rechazo; con `git add -f` desaparece.

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
# 2) solo después de la revisión: copiar las filas aceptadas a media-alias.json y aplicar
STRAPI_URL=http://127.0.0.1:1338 STRAPI_TOKEN=<token> \
  node strapi/scripts/media-import.mjs --apply --alias=strapi/scripts/media-alias.json
```

**Aplicado**, en este orden y con esta evidencia:

1. Seco con la propuesta: `106 registros · 67 archivos · 33 filas de alias` → **34 enlaces**, 3 en
   `revisar`, 27 `pendientes`, 6 ambigüedades y **0 motivos de alias sin firmar**. Recibo:
   `/home/ubuntu/backup/g3-dryrun-2026-09-26.txt`. La corrida reprodujo, número por número, lo que el
   propio `aviso` de la propuesta declaraba (9 tapas sin par, 3 galería en disputa, 6 portadas vacías):
   un seco que coincide con lo predicho es la única revisión humana que este formato admite a distancia,
   y por eso va citada en vez de «leído y aprobado».
2. Dump previo: `iwage-pre-g3-2026-09-26.sql` (2.518.525 B, 0600, fuera del repo). Con `files` y
   `files_related_mph` en 0 el vuelco costaba segundos, y era la única forma de deshacer una escritura
   masiva sobre datos ajenos.
3. **La sonda de un registro, antes del lote** —`.superpowers/sdd/2026-09-24-media-strapi-consolidation/g3-probe.mjs`,
   réplica literal de `aplicar()`— sobre `bitacoras/ihybt6pwuzveeu70kd31u4hb`:
   · `POST /api/upload` → **201**, `id` 1, y Strapi **renombra** en destino:
     `bitacora-inpa-vs-af.webp` pasa a `/uploads/bitacora_inpa_vs_af_2348f58e8c.webp`. La idempotencia
     por **nombre** del importador sigue siendo la clave buena porque `name` conserva el original; por URL
     no se podría comparar.
   · El valor de un campo `media` es el **`id` numérico** y `PUT /api/bitacoras/{documentId}` lo acepta
     (200). Era la variante que el brief dejaba explícitamente sin comprobar.
   · La relación quedó escrita en las **dos** filas del documento (`files_related_mph.related_id` 190 y
     101, publicada y borrador) y el `GET …&status=published` la devuelve populateada. Con 56 publicados y
     56 drafts conviviendo en `bitacoras`, esta era la pregunta que podía dejar el lote en 33 enlaces
     invisibles: **no hace falta ningún paso de publicación después del `--apply`.**
4. `--apply --alias=strapi/scripts/media-alias.json` (el envase aceptado, copia exacta de la propuesta):
   **33 enlaces `ok`, 1 falla, exit 1**. Recibo: `/home/ubuntu/backup/g3-apply-2026-09-26.txt`.

**Medido después — se movió exactamente la fila que había que mover.**

```sql
select (select count(*) from files) as assets, (select count(*) from files_related_mph) as enlaces;
```
1. → **`37|72`** (antes `0|0`). Reparto de los 72: 54 en `api::bitacora.bitacora.imagen` = 27 documentos
   × 2 versiones, y 18 en `api::proyecto-meliponario.galeria` = 6 × 2 versiones × hasta 2 fotos en orden.
   Archivos: 37, de los cuales 36 enlazados y 1 huérfano (se explica en el token).
2. Cobertura sobre lo publicado: **27** bitácoras con `imagen` en su fila publicada (de 56) y **6/6**
   proyectos con la serie completa en `galeria`, en el orden declarado (`proyecto_ambala_1…` antes que
   `…_2`).
3. La API **pública, sin token** ya los sirve con URL relativa: `GET /api/bitacoras?populate=imagen` →
   `/uploads/bitacora_polinizacion_mora_3431e0e589.webp`; `GET /api/proyecto-meliponarios?populate[galeria][populate]=*`
   → las dos URLs, en orden.
4. Servido por nginx: `https://iwage.co/uploads/bitacora_inpa_vs_af_2348f58e8c.webp` → **200, 68 950 B,
   `image/webp`**, byte por byte igual que el `1338` local. Esta es la prueba que en G1 solo se había visto
   en la config: el `mediaSrc` relativo tiene destino real. **Pero** las fichas desplegadas siguen pintando
   el fallback (`og:image` = `hero-meliponas.webp` en las tres URLs medidas): el bundle en producción es el
   del 24-09 y no lee `media`. El cambio visible es de G8, y está medido como tal, no como éxito de G3.
5. Durabilidad: `/app/public/uploads` es el volumen nombrado `negocio_iwage_strapi_uploads`
   (dispositivo 2049, contra 73 de `/app`) — un rebuild no se lleva los 37 archivos.
6. Censo con el **mismo** crawl de G2 y `--con-bd`, para no cambiar de parser entre las dos mitades:
   `/home/ubuntu/backup/g3-censo-2026-09-26.txt`. Diff contra el post-G2: **una sola línea**, la fila 3
   `0|0` → `37|72`. Las otras nueve no se movieron porque el bundle es el mismo.
7. `npm test`: **334/334**. El guard que exigía «el envase sigue vacío» ya no describía una puerta
   autorizada: `tests/media-alias-propuesto.test.mjs` ahora exige que `media-alias.json` sea **igual** a la
   propuesta fila por fila, que sus endpoints sean solo `bitacoras` y `proyecto-meliponarios`, y que la
   fila que sirvió de sonda siga en su destino. Mutación probada: una fila metida directo al envase rompe
   el teste (`# fail 1`).

**Rollback:** `iwage-pre-g3-2026-09-26.sql` (previo a esta escritura) o el dump de G2; los enlaces y los
registros `files` salen con cualquiera de los dos. Los bytes de `/uploads` no están en ningún dump: se
reponen del volumen o del backup de G1, y en el CMS se puede desenlazar a mano. Idempotencia del
importador: por **nombre**, así que repetir no duplica; no detecta re-producción (mismo nombre, bytes
distintos).

### El token con el que corrió G3 — buscado, generado, y qué NO se rotó

La puerta pedía «busca y usa, o genera y rota, y déjalo documentado». Las dos mitades se hicieron; la
rotación se dejó abierta a propósito, por una razón medida.

**Buscado.** En el entorno de `iwage_web` hay un token que el sitio desplegado **sí usa**:
`src/lib/strapi.ts:136` manda `Authorization: Bearer ${STRAPI_API_TOKEN}`, y el digesto de ese valor
(HMAC-SHA512 con `API_TOKEN_SALT`) coincide con la fila 3 de `strapi_api_tokens` — `seed-token`,
`full-access`, creado el 2026-08-09. Con él `/granja/experimentos` responde 200 y sin él 403, así que
**sostiene producción**: no se puede revocar sin repuntar el envase de `iwage_web` y reiniciar el
contenedor, y eso es un despliegue (G8), no una puerta de datos. Las literales del repo, en cambio, están
muertas: el token que aparece en texto claro en `strapi/scripts/seed-heroes.mjs` no digiere contra ninguna
fila de `strapi_api_tokens` (3 filas medidas), o sea que ya no abre nada — pero sigue publicado, que es
motivo de G0, no de esta puerta.

**Generado.** Un token nuevo, `custom`, de alcance mínimo y caducidad corta. Es el que corrió el lote.

| dato | valor |
|---|---|
| nombre / id | `media-import-g3-2026-09-26` / 5 |
| tipo | `custom`, `kind = content-api` |
| vida | 7 días: `lifespan 604800000`, vence `2026-10-03T01:59:28Z` |
| acciones (17) | `find` + `findOne` en los 6 endpoints del inventario; `update` **solo** en `api::bitacora` y `api::proyecto-meliponario`; `plugin::upload.content-api.find` / `.findOne` / `.upload` |
| dónde vive el valor | `/tmp/g3-tok/g3.token`, 0600, **fuera del repo**; la salida del arranque que lo imprimió quedó redactada (`grep -av THEKEY`), así que hay una sola copia |
| cómo se usa | `STRAPI_TOKEN=$(cat /tmp/g3-tok/g3.token)` — nunca en un argumento de comando ni en un archivo versionado |

Para mintear otro sin este agente: `docker compose run --rm --no-deps -T iwage_strapi sh -c 'cd /app && npx
strapi console'` con un script por stdin. Dos cosas que no están en la doc y costaron medirlas: los UIDs
válidos salen de `strapi.contentAPI.permissions.providers.action.keys()` (143 acciones) — **no** del
`actionProvider` de admin, que solo conoce las 64 del panel y no tiene `getAll()`—, y el atributo se llama
`lifespan` y no `duration`, con valores fijos (7/30/90 días). Tercera trampa, esta de ejecución: el REPL
cierra con el EOF del stdin y se lleva por delante la escritura a mitad. Por esa vía quedó el id 4 creado
**sin ninguna fila de permisos y con la `accessKey` perdida** (nunca se imprimió), o sea inutilizable; se
borró esa fila antes de seguir. El arranque bueno fue `{ cat script.js; sleep 90; } | docker compose run …`.

**Alcance verificado en vivo, con control negativa:** `GET /api/upload/files` 200 · `GET /api/bitacoras` 200
· `POST /api/upload` sin archivo **400 «Files are empty»** (pasó autenticación y autorización) ·
`GET /api/proyecto-meliponarios` 200 · `PUT /api/hero-configuracions/x` **403**. Ese 403 es el que dejó el
lote en 33 de 34: el enlace que el manifiesto derivó por `slug` exacto sobre `item-menus` no está en el
alcance de G3, y el token lo rechazó en vez de escribirlo. Es la guarda funcionando, y consigna la
desviación: G3 escribió un enlace menos de los que el seco anunció, y ninguno en un endpoint que no sean
bitácora y meliponario.

**Consecuencia medida de ese rechazo:** el `POST /api/upload` de ese enlace ya había subido
`espresso-doble.webp` antes del `PUT` — el importador sube y después enlaza —, así que la media library
quedó en **37 archivos con 36 enlazados**. El huérfano no se borra: es la foto correcta del ítem correcto,
G6 la va a necesitar, y `plugin::upload.content-api.destroy` tampoco está en el alcance.

**Lo que NO se rotó y por qué.** Fila 3 (`seed-token`, full-access): ver arriba, sostiene producción; su
rotación es repuntar `iwage_web` + reinicio = G8. Filas 1 y 2 (`Read Only`, `Full Access`, las dos por
defecto del 08-09, `last_used_at` vacío): no se revocan acá porque `last_used_at` no se actualiza en toda
llamada autenticada — medido: una llamada 200 a las 01:35:10 dejó el sello en 00:48:22 —, así que «no lo usó
nadie» no es demostrable desde la BD y borrar un token ajeno en producción no entra en esta puerta. Es
inventario para G0, con el digesto como evidencia de cuál es cuál.

**Hallazgo de G0 que salió de esta corrida.** En el contenedor corriendo, `API_TOKEN_SALT`,
`ADMIN_JWT_SECRET`, `APP_KEYS` y `TRANSFER_TOKEN_SALT` son **los valores por defecto publicados en
`docker-compose.yml`**, y `ENCRYPTION_KEY` no está definido. El efecto concreto y medido: al crear el token 5
el log avisó `Encryption key is missing from admin.secrets.encryptionKey configuration` y su columna
`encrypted_key` quedó **NULL** (las filas 1, 2 y 3 tienen 64, 64 y 128). La autenticación no se rompe —el
strategy busca por `access_key = HMAC-SHA512(API_TOKEN_SALT, token)`—, pero el panel no puede volver a
mostrar la clave: un `accessKey` se entrega una sola vez, en la creación. Con salt por defecto y conocido,
cualquiera que lea el dump de `strapi_api_tokens` puede precomputar el digesto de un token candidado y
adivinar cuál es cuál. Rotar `API_TOKEN_SALT` invalida los tokens existentes, así que va atado a la
reemisión del `seed-token`, otra vez G0 → G8.

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

## G6 · Café: borrar la regla por nombre y los seeds literales (Task 13)

**Condición medida el 2026-09-25, y hoy no se cumple:** el paso 1 del task pide «0 items sin
imagen», y la base tiene `files = 0` con **17** filas en `item_menus` y 4 en `proveedors`. Mientras
no haya assets, las reglas por nombre son lo único que pinta el menú: se borran después de G3,
cuando el paso 1 dé 0. (Precisión del plan: son 17 filas, no «las 19 preparaciones».)

**Y no es una sola regla — medido, hay cuatro puntos de verdad para las mismas 19 piezas:**

| dónde | qué | imágenes de `public/images/cafe-menu/` |
|---|---|---|
| `src/lib/cafe.ts:233-269` | `LOCAL_IMAGES`, la regla por nombre | 10 entradas |
| `src/pages/cafe/menu.astro:70` | `fallbackItems` — 17 filas literales, espejo de `item_menus` | 9 |
| `src/pages/cafe/index.astro:46` | `fallbackProveedores` (4 filas) | 4 `proveedor-*.webp` |
| `src/pages/cafe/index.astro:57` | `FALLBACK_HISTORIAS_HOME` (4 visitantes) | 4 `visitante-*.webp` |
| `src/pages/cafe/menu.astro` (plantilla) | dos promos escritas a mano | `promo-duos-perfectos`, `promo-reutilizable` |

Medido contra el crawl de 185 URLs (`analyze.py`, sección «BIBLIOTECA EN DISCO vs RENDERIZADA»):
**14 de las 19 se sirven y 5 no** — `pan-yuca-miel` y los cuatro `proveedor-*`. Los cuatro
proveedores no se sirven porque en producción `proveedors` trae datos y el fallback no corre; o sea,
son seeds muertos que hoy existen solo para el caso «Strapi vacío».

**Orden de la puerta, y qué no hacer:** (1) G3 sube y enlaza las piezas que corresponden a
`productos` / `proveedors` / `historia-visitantes`; (2) se verifican con el paso 1 del task; (3) se
borran `LOCAL_IMAGES` y los **campos de imagen** de los cuatro arreglos — no las filas: quitar
`fallbackItems` entero es una decisión de contenido (la página quedaría sin menú si la base falla),
mientras que quitarle las imágenes es exactamente lo que ya se aprobó: «Strapi único dueño, sin
fallbacks de imagen; con Strapi caído las tarjetas muestran el Icon tile y la página sobrevive».
(4) Las 19 piezas entran al inventario del importador, así que la fila 6 las cuenta: hoy da
`cafe-menu piezas=19 huerfanas=0`, y después de este borrado dará 19 hasta que se cableen.

## G7 · Permisos de lectura pública

`api::experimento` y `api::historia-visitante` no tienen `find`/`findOne` para el rol Public, así
que sin token el sitio recibe 403 y esas superficies tiran de su relleno. Se cierra en
Settings → Roles Públicos, o sembrando los permisos en `strapi/src/bootstrap`. Es la puerta de que
`getHistoriasVisitantes()` deje de devolver `[]`.

## G8 · Publicar y desplegar

Build aislado verde, 334/334 verdes y 185/185 en 200 contra un preview local. El rango del plan se
recuenta con `git rev-list --count ffb0a9c..HEAD` (desde el commit de la spec).
Antes de `git push`: G0. Después de G2 y G3, el censo se mide **contra el sitio desplegado** y las
filas 1, 2, 9 y 10 dejan de decir «no medible todavía»:

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
