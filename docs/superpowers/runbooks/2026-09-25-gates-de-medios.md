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
2026-09-27**: scrub de las cuatro publicaciones, guarda anti-credenciales en la suite, rol propio
`iwage_app` creado y probado, y clave de cifrado del panel definida y cableada (efectiva al recrear, o sea
G8); falta la rotación coordinada del host, que no es de esta puerta. **Y cuatro corridas más de `--apply`
sobre la base viva, todas el 2026-09-27: D3, D4, D5 y D6.** D3 enlazó 7 tapas que G3 dejó sin par y reasignó una mal
asignada — 34 de 56 bitácoras publicadas con tapa—. D4 llenó la portada de los 6 proyectos: `imagen` pasó de 0
a 6 documentos con portada, declarándola en la misma fila del envase que escribe su galería. D5 cerró la única
disputa que todavía caía en `revisar` —los 3 `producto-*`—, y para escribirla hubo que abrir el alcance del token
(`update` sobre `api::producto.producto`) y arreglar el orden en que el manifiesto recorre los campos de un mismo
registro. Cada corrida está documentada en su propia sección bajo G3, con dump previo y verificación medida.
**D6 cables el café**: 23 filas nuevas sobre `cafe-menu/` (15 ítems, 4 proveedores, 4 historias de visitante), y
para poder firmar la foto de una familia en cada variante hubo que **extender el contrato** con una cláusula nueva,
`compartida`, declarada por las dos filas (es la misma forma que `portada` en D4). El grant sumó tres `update` más
(`item-menu`, `proveedor`, `historia-visitante`; 18 → 21 acciones) y con eso **desapareció la falla que arrastraban
G3, D3, D4 y D5** — `espresso-doble.webp` → `item-menus`, que la regla de `slug` firma sola: D6 fue la primera
corrida con 73 enlaces `ok` y **0 fallas**. Esto abre **G6 a medias**: su paso 1 ya se cumple en la base
(16 de los 17 `item_menus` con `imagen`, 4/4 proveedores con `foto`, 4/9 visitantes con `imagen`), pero las
páginas siguen pintando literales hardcodeados (paso 2) y el paso 3 —jubilar `LOCAL_IMAGES`— sigue bloqueado por
huecos de **contenido**, no de cableado: `te-de-guayaba-agria` sin lámina, 5 visitantes sin lámina,
`pan-yuca-miel.webp` sin ítem y las dos `promo-*` sin campo. Sigue abierta una duda de procedencia sobre las
láminas de personas (D7). Siguen cerradas: **G4**, **G5**, **G7** y **G8** (empujar y desplegar, que nadie
autorizó todavía). Abrió una
decisión nueva, **D11**: los 6 proyectos siguen con `slug: null` y por eso su ficha de detalle es inalcanzable — y
D5 midió que **3 de los 14 `productos`** están igual, dos de ellos justo los que acaban de recibir tapa. Es
contenido y URLs, no medios, y lo decide el dueño (está escrito en la sección de D4 y en la de D5). Que
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
cubre, marca `[digesto-quemado]`. `npm test`: **335/335** al cerrar esto (338/338 desde que se sumó la
guarda de `config/admin.ts` del D2, más abajo).

**Endurecimiento contenido, ya hecho.** Como el valor no se puede retirar del historial sin cortar 15
contenedores (abajo), se le quitó a `iwage` la necesidad de usarlo: rol **`iwage_app`**, `LOGIN`,
`super=false`, `createdb=false`, con `CONNECT` y `CREATE` en la base `iwage`, `USAGE` y `CREATE` en el
esquema `public`, `ALL` sobre tablas y secuencias existentes, y `ALTER DEFAULT PRIVILEGES FOR ROLE admin`
para las futuras — los default privileges son por base de datos, así que no alcanzan a las otras 15.
Aviso para la conmutación: el rol se llama igual que el **servicio** `iwage_app` del compose (el que
produce el contenedor `iwage_web`); son cosas distintas.
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

### Resuelto el 2026-09-27 (decisión D2): la clave existe, pero en Strapi 5.55.1 no se define por entorno

**Medido, comparando por sha256 el contenedor vivo contra el compose.** Los cuatro secretos siguen con
el default (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT` → `=default_del_compose?
True`), y se entiende por qué: el compose los pide como `${IWAGE_STRAPI_APP_KEYS:…}` etc., y **esas cuatro
variables no existen en `/home/ubuntu/negocio/.env`** (existen las `STRAPI_*` sin prefijo, del otro
proyecto) → gana el literal del default. `JWT_SECRET`, `DATABASE_PASSWORD` y `RESERVAS_SYNC_TOKEN` sí
vienen del `.env` (coincidencia verificada por sha, no por lectura del valor).

**Dónde estaba publicado el default.** En dos lugares, con distinto alcance: `docker-compose.yml` vive en
el repo padre, que **no tiene remoto** (`git remote -v` vacío) → no está publicado; y
`strapi/config/admin.ts` + `strapi/config/server.ts` viven en este repo, que **sí es público**. Los
literales que cualquiera podía leer eran los de acá: `env('ADMIN_JWT_SECRET', 'iwage-admin-secret')`,
`env('API_TOKEN_SALT', 'iwage-api-salt')`, `env('TRANSFER_TOKEN_SALT', 'iwage-transfer-salt')` y
`env.array('APP_KEYS', ['iwage-key-1','iwage-key-2'])`.

**Por qué no alcanzaba con poner la variable.** Grep sobre `@strapi` instalado (5.55.1): **0** ocurrencias
del nombre `ENCRYPTION_KEY`. Lo único que consume la configuración es
`@strapi/admin/dist/server/server/src/services/encryption.mjs`, que hace
`strapi.config.get('admin.secrets')?.encryptionKey`, avisa `Encryption key is missing…` y **devuelve
`null`** — por eso el token 5 quedó con `encrypted_key` NULL. Grep de `admin\.secrets`: 4 líneas, todas en
ese servicio. O sea: la clave se define en `config/admin.ts` y de ahí va al entorno; al revés no.

**Aplicado (código, en este repo).** `admin.ts` perdió los tres literales y ganó
`secrets: { encryptionKey: env('ENCRYPTION_KEY') }`; `server.ts` perdió el default de `APP_KEYS`. Guarda
nueva `tests/config-admin.test.mjs` (3 contratos: ningún default publicado, cada secreto leído con un solo
argumento, `secrets.encryptionKey` presente): roja antes del cambio sobre las 4 líneas exactas, verde
después, y con dientes probados por mutación —devolver `env('ENCRYPTION_KEY', 'iwage-encryption-default')`
la hace fallar señalando `admin.ts:5`—. Verificación dinámica con `node --experimental-strip-types` sobre
los dos archivos resueltos contra un `env` falso: `secrets.encryptionKey → V(ENCRYPTION_KEY)` y los únicos
defaults que quedan son `HOST` y `STRAPI_URL`, que no son secretos. `npm test` **338/338**.

**Aplicado (host, sin reiniciar nada).** `IWAGE_STRAPI_ENCRYPTION_KEY` generada con `openssl rand -hex 32`
(64 hex, prefijo sha256 `425154d2eb`, **distinta** de la `STRAPI_ENCRYPTION_KEY` del otro proyecto), escrita
en el `.env` (0600, ignorado por `.gitignore:42`, no trackeado) con una copia de respaldo en
`/home/ubuntu/backup/d2-strapi-encryption-key-2026-09-27.txt` (0600). Una línea en el compose de
`iwage_strapi`: `- ENCRYPTION_KEY=${IWAGE_STRAPI_ENCRYPTION_KEY}`, **sin default flojo**; `diff` contra el
respaldo = 1 línea agregada; `docker compose config` la renderiza. precedente: `marca_personal_strapi` ya
tenía ese cableado —a iwage le faltaba—.

**Cuándo hace efecto, y qué NO cambia antes de eso.** El config se compila en la imagen (el contenedor
corre `/app/dist/config/admin.js`), así que necesita `docker compose up -d --build iwage_strapi` = **G8**.
Hasta ese momento, crear un token sigue avisando y dejando `encrypted_key` NULL. Y **no se rotó nada**:
escribir las cuatro `IWAGE_STRAPI_*` en el `.env` sonaría a preparación inofensiva, pero en el próximo
recreate invalidaría los 4 tokens existentes —entre ellos el `seed-token` (fila 3), cuyo `last_used_at` es
hoy— sin avisar. Ese orden es el de G8: reemitir → rotar → verificar.

**Dos afirmaciones del párrafo de arriba que esta medición corrigió.** (a) La tabla no es
`up_permissions_api-token` (no existe) sino **`strapi_api_tokens`**, con `access_key` de 128 hex en las 4
filas (el digesto `HMAC-SHA512(salt, token)`, irreversible) y `encrypted_key` aparte. (b) Las filas 1, 2 y
3 tienen `encrypted_key` en **hex puro, sin el prefijo `v1:`**, y `decrypt()` revisa la versión **antes**
de mirar la clave: lanza `Unsupported encryption version` con clave o sin ella. Como
`GET /admin/api/api-tokens/:id` (`controllers/api-token.mjs:78`) siempre pide `includeDecryptedKey: true`,
abrir el detalle de esos tokens ya falla hoy. Poner la clave no crea ese fallo; lo que cambia es que los
tokens **nuevos** sí quedan re-mostrables en el panel.

### Resuelto el 2026-09-27 (decisión D3): las 9 tapas que G3 dejó sin par

**Qué se decidió y con qué evidencia.** G3 cableó 27 pares y dejó 9 láminas de `public/images/bitacora/`
sin fila, descritas en el `aviso` como «sin par firme». Leyéndolas una por una (los `.webp` se abren y se
ven: no hubo que adivinar por token de nombre), 7 tenían destino, 1 estaba mal asignada y 2 no tienen a
dónde ir. Las 7:

| lámina | destino | cómo se vio |
|---|---|---|
| `bitacora-conservacion-cosecha` | `conservacion-y-cosecha-de-miel` | frascos en repisa con termómetro e higrómetro y el texto «Temperature: 20–25 °C / Humidity: <60 % / Store in Dark, Cool Place» |
| `bitacora-cosecha-miel` | `lote-l25-05-001-cosecha-mayo` | cosecha de un lote |
| `bitacora-modulo9-cosecha` | `conservacion-…-fermentacion-y-extraccion` (Módulo 9) | caja con panales, abejas, frascos y **extractor** (jeringa + espátula) |
| `bitacora-modulo6-division` | `division-colonias-angelita-tetragonisca-angustula` (Módulo 6) | dos cajas y un panal pasándose entre ellas |
| `bitacora-territorio-pijao` | `abejas-sin-aguijon-cosmovision-pijao` | paisaje de bosque de niebla con nidos silvestres en troncos |
| `bitacora-miel-chef` | `la-miel-de-angelita-y-el-chef-…-alta-cocina` | jarra de plata dorado sirviendo miel sobre un **plato emplatado** |
| `bitacora-miel-cocina` | `miel-angelita-recetas-cocteleria-preparaciones` | **copa de cóctel** con miel, limón y menta, pan y fruta en mesa de cocina |

La disputa `miel-chef` / `miel-cocina` no era disputa: son dos artículos distintos y cada lámina pertenece a
uno. Lo que las confundía es que los dos títulos hablan de miel en la cocina.

**La reasignación, que es el yerro de G3 que este lote corrigió.** `bitacora-fermentacion-miel.webp` quedó
sobre el Módulo 9, pero muestra frascos con espuma y burbujas — fermentación. Se fue a
`fermentacion-burbujas-y-un-frasco-que-explota` y el Módulo 9 recibió `bitacora-modulo9-cosecha.webp`. Un
`PUT` reemplaza la relación, así que el enlace viejo desaparece solo; no hubo que borrar nada.

**Las dos que NO se cablean, y por qué no son lo mismo.** `bitacora-calendario-manejo.webp` está defectuosa:
el grabado trae pseudo-texto ilegible (letras que no forman palabras) y su asunto —calendario de manejo— ya
tiene tapa en `bitacora-modulo5-manejo.webp`. `bitacora-red-meliponicultores.webp` está bien dibujada, pero
**no existe ningún artículo** de una red de meliponicultores (medido: `select … where titulo ilike '%red%' or
'%meliponicultor%' or '%calendario%'` devuelve solo `solar-offgrid` y tres del corredor). Retirar una lámina
mala y no cablear una lámina buena sin artículo son dos decisiones distintas, y ninguna de las dos es
«falta de alias».

**Antes de escribir, la cuenta que importa.** Cada uno de los 8 destinos existe como **un** documento
publicado (16 filas = 8 × 2 versiones) y 7 de los 8 no tenían tapa; el octavo era el Módulo 9 con la lámina
equivocada. Medido en `files_related_mph` (la tabla real de enlace en Strapi 5 con postgres; `upload_media`
y `_media_bitacora_links` **no existen** en esta base).

**El token: se reutilizó el de G3, no se emitió uno nuevo.** La fila 5 (`media-import-g3-2026-09-26`,
`custom`, `lifespan` 604 800 000, vence 2026-10-03) ya tenía exactamente lo que D3 necesita, y se verificó en
vivo en vez de suponerlo: `GET /api/upload/files` 200 · `GET /api/bitacoras` 200 ·
`GET /api/proyecto-meliponarios` 200 · `GET /api/hero-configuracions` **403** (la negativa sigue siendo
negativa). Su valor sigue en `/tmp/g3-tok/g3.token` (0600, 256 hex) y nunca entró en un argumento de comando
ni en un archivo versionado. Emitir un token nuevo para el mismo alcance habría dejado dos vivos.

**Corrida.** Seco con la propuesta de 40 filas: `106 registros · 67 archivos · 40 filas de alias` →
**41 enlaces, 3 en revisar, 20 pendientes, 6 ambigüedades, 0 motivos de alias sin firmar**. Las 7 nuevas
aparecen las 7 con `nombre nuevo: hay que subirlo` y ninguna otra. Dump previo de `files`,
`files_related_mph` y `bitacoras` en `/home/ubuntu/backup/d3-pre-2026-09-27.sql` (0600, 1 598 303 B).
`--apply`: **40 `ok` y 1 falla**, exit 1 — la falla es `espresso-doble.webp → item-menus/…`, que derivó la
regla de `slug` exacto del manifiesto (no una fila del envase) y el token rechazó con 403. Es D6/G6, no D3.

**Medido después.** `files` 37 → **44** (+7). Enlaces `files_related_mph` 72 → **86**: +16 (8 documentos ×
2 versiones) −2 (los que reemplazó la reasignación). **34 de 56** bitácoras publicadas con tapa,
**0** archivos enlazados a dos documentos, **0** enlaces huérfanos. Las 7 láminas subieron a
`1200×675 image/webp` y responden 200 en `/uploads/` (43 756 – 171 960 B). Y en la API publicada con
`status=published&populate=imagen`, los dos documentos de la reasignación devuelven cada uno el suyo:
Módulo 9 → `bitacora_modulo9_cosecha_061500b42c.webp`, fermentación →
`bitacora_fermentacion_miel_7b410de327.webp`.

**Un hallazgo de contenido, consignado para el dueño y no arreglado acá.**
`conservacion-y-cosecha-de-miel` y `conservacion-…-fermentacion-y-extraccion` (Módulo 9) son el **mismo
artículo publicado dos veces**: 98,99 % de similitud medida sobre el cuerpo con `difflib`. Cada uno recibió
su tapa y ninguna lámina se escribe dos veces, pero fusionarlos o retirar uno es una decisión sobre el
contenido. Sale del alcance de este envase y queda nombrada en el `aviso`.

**Qué cambió en el repo.** `media-alias-propuesto.json` creció a 40 filas (34 forma 1 + 6 forma 2) y
`media-alias.json` quedó idéntico fila por fila, con el recibo de D3 en su `aviso`. El teste
`tests/media-alias-propuesto.test.mjs` pasó de 27/12 a 34/5 en sus cuentas y en la lista de huérfanos
enumerados; su guarda de igualdad se volvió a probar por mutación (una fila metida directo al envase
aplicado → `not ok 8`, restaurada → 8 pass). `npm test` **338/338**.

### Resuelto el 2026-09-27 (decisión D4): la portada de los 6 proyectos entra como dato declarado

El envase aplicado dejó los 6 `proyecto-meliponarios` con `galeria` completa (9 láminas) y `imagen` vacío:
**0 de 6 con portada**, medido en `files_related_mph`. Las fichas salían sin figura
(`ProjectCard.astro:33` es `{image && (`) y la página de proyecto pintaba un degradado en el hero.

Las dos salidas baratas estaban cerradas, y no por descuido:

· **Derivar la portada desde la plantilla** (`imagen ?? galeria[0]`) lo prohíbe un teste escrito a propósito
en `tests/normalizar-medio-2.test.mjs:180` — «la galería se está usando de portada: dos campos diciendo lo
mismo». Además `src/pages/meliponas/index.astro:235` ya tenía esa regla duplicada en la plantilla, que es
exactamente la dispersión que la consolidación vino a quitar.
· **Declarar el archivo en dos filas** (una para `galeria`, otra para `imagen`) lo rechaza el manifiesto:
`aliasPorArchivo` marca el archivo como ya declarado y la segunda fila se descarta. Y re-clave del libro de
dueños por `(archivo, campo)` habría dejado que dos **documentos distintos** se queden con la misma lámina
para campos distintos — más dispersión, no menos.

**El contrato que se abrió.** Una fila forma 2 puede traer `portada: <ruta>`, que **tiene que ser una de sus
propias `archivos`**. Al ganar esa unidad, escribe los dos enlaces desde el mismo lugar: el campo repetible
con la serie y `imagen` de la tabla con la portada declarada. No es una unidad nueva ni un reclamo nuevo, así
que la detección de disputas, el libro de dueños y la PARTICIÓN siguen viendo un archivo con un solo balde.
Una fila por ruta no puede declararla (su clave ya es un archivo) y declararla en una fila que no escribe el
campo repetible se descarta con su motivo exacto. Cinco testes nuevos en `tests/media-manifest.test.mjs`
(bloque `F2-b`) fijan las cuatro reglas y la precedencia sobre la regla de `nombre`.

**Qué se eligió y cómo.** Las 9 láminas miradas una por una: en los 3 proyectos con dos fotos, la `-1` es la
vista general del proyecto y la `-2` un detalle; en los 3 de una sola foto la portada es esa foto. Criterio
editorial, escrito en el `aviso` del envase en vez de deducido por el código.

**El seco del 2026-09-27** (`--dry-run --alias=…-propuesto.json`, mismo token de G3, 403 de control
negativo ya probado): 106 registros, 67 archivos, 40 filas, **47 enlaces** (40 de fila + 6 portadas + 1 regla
de `slug` sobre `item-menus`), 3 en revisar, 20 pendientes, 6 ambigüedades, 0 motivosAlias. Cero
`POST /api/upload`: las 6 portadas son archivos que ya estaban en la librería.

**El bug que esta corrida encontró — en el reporte, no en la BD.** El primer seco avisó
`archivos: 50 enlazados … = 73 de 67` y encendió `LA PARTICIÓN NO CIERRA`. El manifiesto estaba bien; el que
contaba mal era `imprimir()` de `strapi/scripts/media-import.mjs`, que sumaba las longitudes por enlace y con
una portada contaba dos veces el mismo archivo. Como esa línea es la guarda que dice «esta salida SÍ sirve
como inventario» para las Tareas 11 y 14, un falso positivo ahí es tan caro como un falso negativo: se cuenta
por archivo **distinto**. `tests/media-flags.test.mjs` lo fija corriendo el CLI real contra su stub: la
contabilidad cierra `2 de 2`, el aviso no aparece, se suben **dos** archivos y no tres, y salen dos `PUT`
(`galeria: [900, 901]` y `imagen: 900`).

**`--apply`:** 46 enlaces `ok` y 1 falla — la misma de G3 y D3 (`espresso-doble.webp` → `item-menus`, 403; es
D6). Exit 1 por esa única razón. Backup antes de escribir: `/home/ubuntu/backup/d4-pre-2026-09-27.sql`
(0600, 2.610.637 B).

**Medido después.** `files_related_mph` sobre `api::proyecto-meliponario.proyecto-meliponario`: `imagen` pasó
de 0 a **12 filas** (6 documentos × borrador y publicado) y `galeria` sigue en 18 — reescribir la serie en el
mismo orden no la recortó. `GET /api/proyecto-meliponarios?status=published&populate=imagen,galeria`
devuelve las 6 con portada igual a la `-1` de su serie y galería completa (2+2+2+1+1+1). Servido:
`/uploads/proyecto_ambala_1_c596855ccf.webp` y `/uploads/proyecto_bonifacio_1_d2b2e6a8c9.webp` → 200
`image/webp`. Censo de la librería: 44 archivos, 98 filas de enlace (68 bitácora + 18 galería + 12 portada) y
**un solo archivo sin enlace**, `espresso-doble.webp`. Verificado en BD, API y URL servida; no en navegador,
porque `npm run build` está prohibido en este tree compartido y publicar es D10.

**Hallazgo nuevo, para decidir (D11) y no arreglado acá.** Los 6 proyectos tienen `slug: null` medido en 6/6
también en el endpoint publicado. `getProyectoBySlug` filtra por `slug`, así que la ficha de detalle —el
consumidor principal de la portada que acaba de entrar— es inalcanzable: `ProjectCard.astro:32` ya protege el
`href` (`slug ? … : undefined`) y por eso no se ve un enlace roto, pero el `/meliponas/proyectos/null` que
armaba `meliponas/index.astro:170` nunca existió. Las dos salidas son del dueño: rellenar los `slug` en el
panel (contenido) o rutear por `documentId` (cambia URLs y el sitemap). No es un asunto de medios y no se
resolvió solo.

**Qué cambió en el repo.** `strapi/scripts/lib/media-manifest.mjs` (la clave `portada` y su contrato en el
header), `strapi/scripts/media-import.mjs` (contabilidad por archivo distinto), los dos envases (las 6
`portada` + el `aviso` del recibo con la corrida), `tests/media-manifest.test.mjs` (+5 testes `F2-b`),
`tests/media-flags.test.mjs` (+1 teste de CLI) y `tests/media-alias-propuesto.test.mjs` (cuentas: 40 filas /
6 portadas / 46 enlaces, y la aritmética ahora es por archivo distinto). `npm test` **344/344**. Las tres
mutaciones del contrato nuevo (suprimir la emisión, suprimir el control de pertenencia, suprimir la reserva
del campo) ponen la suite roja. Nada empujado, nada desplegado.

### Resuelto el 2026-09-27 (decisión D5): los tres `producto-*`, y el alcance que hubo que abrir para escribirlos

**Qué estaba abierto.** Después de D4 quedaban en el inventario tres archivos que el manifiesto mandaba a
`revisar` — los únicos que había mandado nunca —: `producto-caja-1.webp`, reclamado por **tres** productos
distintos que coinciden con él por `nombre` (`caja-af-estandar`, `caja-inpa-con-atril`,
`caja-inpa-nogal-cafetero`), y `producto-miel-1/2.webp`. Ninguna regla de nombre los desempata, así que la
única salida honesta era declararlos.

**La decisión editorial, mirando las láminas.** `producto-caja-1` es una caja de madera clara **sin atril** y
sin tapa de observación ni piso móvil, y es la única de las tres fichas marcada `destacado`: se fue a
`Caja INPA Nogal Cafetero` —que además es el título con la que la entró su propio seed—. `producto-miel-1`
(frasco rotulado «NET WT. 110 g») → `Miel Angelita 120ml`; `producto-miel-2` (colando un propóleo) → `Miel con
propóleo 250ml`. Criterio escrito en el `aviso` del envase, no deducido por el código. Y la forma: **`imagen`,
una lámina por producto**, no un `galeria` de un elemento —una galería de uno es justamente el defecto que
estas rondas vinieron a cerrar—.

**El arreglo que hizo falta en el manifiesto.** Declarar `imagen` no alcanzaba: el seco anunciaba
`la tapa ya está asignada a caja-inpa-nogal-cafetero` **contra sí mismo** y el archivo se iba igual al
`galeria`. La causa era el orden de recorrido de los campos de un mismo registro, que era alfabético
(`'galeria' < 'imagen'`): un `galeria` deducible por `nombre` cobraba antes que un `imagen` **declarado** por
alias, al revés de la prioridad que el módulo pregona en todos los demás ejes. Ahora los campos se ordenan por
su mejor nivel de decisión (alias → slug → nombre → sufijo) y el alfabético queda solo como desempate. Medido
con las dos corridas del mismo envase, una con el módulo de `HEAD` y otra con el arreglado: **49 y 50 enlaces,
y el `diff` toca únicamente las tres líneas de producto** —afuera `producto-caja-1 → ….galeria` y un `galeria`
de DOS miel-archivos sobre el mismo producto; adentro los tres con `(alias) → ….imagen`, uno por producto—. Los
otros 47 enlaces salen idénticos, así que el arreglo no mueve nada de lo ya aplicado. Lo fijan los dos testes
nuevos `F2-c` en `tests/media-manifest.test.mjs`.

**Lo que se borró, con la medición encima.** El lazo que arrastraba a `revisar` a los hermanos de una unidad
bloqueada se demostró inalcanzable por construcción: los miembros de una serie comparten raíz, y la raíz
comparte reclamantes —o la disputa los toma a todos en el paso 3, donde ya se nombran, o no toma a ninguno—.
Instrumentado y corrido sobre la suite completa y sobre el seco de la base viva: **cero casos**. La única forma
de partir un conjunto era una fila de alias sobre un subconjunto, y esa fila es nivel ALIAS, o sea que cobra
antes del arreglo de arriba. Se borró la marking muerta y `I6/M17` quedó renombrada con el mutante que sí la
mata (deshacer el desempate de disputa en `media-manifest.mjs:761`: rojos tres testes).

**El `--apply` se rehusó dos veces, y la segunda vez no.** Primera corrida: 46 enlaces `ok` y **4 fallas** —
las 3 de `productos` con `403 a PUT /api/productos/<documentId>`, más la de siempre (`espresso-doble.webp` →
`item-menus`, que es D6)—, exit 1. Como el importador sube y después enlaza, los tres `.webp` ya estaban en la
librería (`files` 44 → **47**, ids 45/46/47) **sin ningún enlace**: la guarda de alcance funcionando y el
desorden por delante.

**Cómo se abrió el alcance, y lo que nadie sabía de esta instalación.** El token 5
(`media-import-g3-2026-09-26`, `custom`) no guarda sus acciones en `strapi_api_tokens` —esa tabla no tiene
ninguna columna de scopes—, sino en `strapi_api_token_permissions` (una fila por acción) enlazada por
`strapi_api_token_permissions_token_lnk`. Se agregó `api::producto.producto.update` (fila 18) enlazada al token
5: **17 → 18 acciones, 0 filas huérfanas**. Volcado previo de las dos tablas en
`/home/ubuntu/backup/d5-grant-pre-2026-09-27.sql` (0600, 11 346 B), que es también el rollback. **Lo medido:**
el alta en la base surte en el servidor vivo, **sin rebuild ni reinicio** — sonda con `PUT` a un documentId
inexistente, que responde 403 sin permiso y 400 con él (misma respuesta que `bitacoras`, ya autorizado):
`productos` pasó de 403 a 400 en la misma llamada. Y en la misma tanda `item-menus` **siguió en 403**, que es
la negativa de control: el alcance no se ensanchó de más ni por accidente. Sirve igual para D6.

**Segunda corrida:** 49 enlaces `ok` y 1 falla (la de siempre). Cero subidas nuevas: los tres nombres ya
estaban y el importador empareja por nombre, así que `files` quedó en **47** con **0 nombres repetidos** —
repito: esta es la prueba de que reintentar un lote a medio terminar no duplica la librería—.

**Medido después.** `files_related_mph` 98 → **104**; las 6 filas nuevas son `field='imagen'` sobre
`api::producto.producto` (3 documentos × borrador y publicado) y cada una apunta al archivo declarado:
`producto-caja-1` → Caja INPA Nogal Cafetero, `producto-miel-1` → Miel Angelita 120ml, `producto-miel-2` → Miel
con propóleo 250ml. Bitácora (68) y proyectos (18 de `galeria` + 12 de `imagen`) sin moverse. **46 de 47
archivos con enlace y uno solo sin él** (`espresso-doble.webp`). En la API publicada
(`status=published&populate=imagen`) los tres devuelven su `/uploads/producto_*_<hash>.webp` a `1024×1024
image/webp`, y las tres URLs responden 200 (88 318 – 106 304 B). Verificado en BD, API y URL servida; no en
navegador: `npm run build` está prohibido en este tree y publicar es D10.

**Hallazgo, para decidir (D11) y no arreglado acá.** La D11 de los proyectos se extendió a la tienda: **3 de
los 14 `productos` tienen `slug: null`**, medido también en la fila publicada, y dos de ellos son justo los que
acaban de recibir tapa (`Miel Angelita 120ml`, `Miel con propóleo 250ml`). Su foto ya está cableada y servida,
pero `getProductoBySlug` (`src/lib/tienda.ts:195`) filtra por `slug`, así que la ficha de detalle sigue
inalcanzable. Mismas dos salidas que con los proyectos: rellenar `slug` en el panel o rutear por `documentId`.

**Qué cambió en el repo.** `strapi/scripts/lib/media-manifest.mjs` (el orden de campos por nivel, y arriba el
contrato reescrito con la medición del arrastre), `strapi/scripts/media-alias-propuesto.json` y
`strapi/scripts/media-alias.json` (las 3 filas de `productos`: **43 filas**, 35 forma 1 + 8 forma 2, y el
recibo en 7 líneas nuevas de `aviso`), `tests/media-manifest.test.mjs` (+2 testes `F2-c`, `I6/M17` renombrado
con su mutante medido, `F2-a producto-caja-1` actualizado a los tres slugs reales de la base) y
`tests/media-alias-propuesto.test.mjs` (cuentas 43/35/8/6 y `SIN_PROPUESTA` reducido a las 2 tapas de bitácora).
`npm test` **346/346**. Nada empujado, nada desplegado.

### Resuelto el 2026-09-27 (decisión D6): el café se cablea, y para hacerlo hubo que extender el contrato

**Qué estaba abierto.** Las 19 piezas de `public/images/cafe-menu/`, que G3 nunca tocó y que G6 tenía como
deuda. La base tiene 17 `item_menus`, 4 `proveedors` y 9 `historia_visitantes` publicados, y hasta hoy ninguno
tenía una sola relación con la librería (`files_related_mph` marcaba 0 filas para los tres tipos).

**Por qué la regla de nombre no alcanzaba, que es el hallazgo de esta ronda.** El `slug` de un ítem es de
**variante** (`cafe-ambala-pequeno`, `-mediano`, `-grande`) y la foto es **una por familia**
(`cafe-origen-ambala.webp`). Seis familias, 14 variantes. Un alias por ruta firma un archivo contra UN registro;
repetir la ruta en tres filas era exactamente lo que el contrato rechazaba como disputa. Lo mismo, por otro
motivo, en `proveedors` e `historia-visitantes`: ninguno tiene campo de identidad por nombre medible
(`ENDPOINTS_CON_MEDIO` no les declara `identidadNombre`), así que la regla solo disparaba sobre `espresso-doble`,
que sí se llama igual que su `slug`. **18 de las 19 piezas no se podían firmar sin declarar.**

**La decisión del dueño, y qué implica.** Ante la opción de poner una foto solo en el registro «representativo»
y heredarla en la vista, o dejar el menú como estaba, se eligió **declararla en cada variante**: cada ítem es un
documento y Strapi es el dueño del dato, así que una variante sin su `imagen` poblada es un hueco real, no un
detalle de presentación. Eso obliga a abrir el contrato, y la apertura se escribió con la misma forma angosta que
`portada` en D4.

**`compartida`, la cláusula nueva.** Solo en fila de forma 2 (clave = `documentId`), solo con **un** archivo, solo
sobre el **campo de portada** del endpoint, y **declarada por las dos partes**: un `compartida` huérfano sobre un
archivo que otro ya declaró sigue rechazándose. Un archivo marcado así sigue cerrado a los reclamos por regla de
nombre, y la PARTICIÓN no se mueve: un archivo vive en un solo balde aunque escriba N enlaces. Consecuencia
medida y admitida en el contrato: `enlazar.length` puede ser mayor que la cuenta de archivos enlazados —acá 73
enlaces sobre 63 archivos—, que es la misma contabilidad que D4 descubrió con las portadas.

**El seco antes de escribir (2026-09-27):** 106 registros en 6 endpoints, 67 archivos, **66 filas**, 73 enlaces,
0 en `revisar`, 5 pendientes, 11 ambigüedades, 0 `motivosAlias`. PARTICIÓN: 62 + 0 + 5 = 67 de 67.

**El alcance, otra vez sin panel y sin reiniciar.** Tres filas nuevas en `strapi_api_token_permissions`
(`item-menu.update`, `proveedor.update`, `historia-visitante.update`) enlazadas al token 5 con `ord` 5, 6 y 7:
**18 → 21 acciones**. Volcado previo (`d6-perms-pre.txt`, no versionado) y SQL con rollback documentado
(`d6-grant.sql`). La sonda que no escribe nada —`PUT /api/<endpoint>/zzz…` con `{}`: 403 sin permiso, 400 con él—
dio 400 en los tres endpoints nuevos, 400 en `bitacoras` (ya autorizado) y **403 en `lote-miels`, al que no se le
otorgó el permiso**: la negativa de control de que el alcance no se ensanchó de más. Reproducido hoy, al cerrar esta
sección.

**El `--apply`: 73 enlaces `ok` y 0 fallas.** Es la primera corrida de este envase sin la falla de siempre:
`espresso-doble.webp` → `item-menus/eco9rlgy…imagen`, el enlace que la regla de `slug` deriva sin fila y que G3,
D3, D4 y D5 vieron morir en 403 cuatro veces seguidas, se escribió. `files` 47 → **62** (15 subidas) y
`files_related_mph` 104 → **132** (+28: 16 en `item-menu.imagen`, 4 en `proveedor.foto`, 8 en
`historia-visitante.imagen` = 4 documentos × borrador y publicado). **0 nombres repetidos** en `files`. Correr el
seco después del apply devuelve el mismo plan, byte a byte: la corrida es idempotente.

**Medido por la API publicada, que es lo que vería el visitante.** 16 de los 17 `item_menus` con `imagen` (falla
`te-de-guayaba-agria`, que no tiene lámina), **4/4** `proveedors` con `foto`, 4 de las 9
`historia_visitantes` con `imagen`. Y lo que era el punto de la decisión, verificado: `cafe-ambala-pequeno`,
`-mediano` y `-grande` devuelven las tres **la misma** `/uploads/cafe_origen_ambala_1694ae1ce5.webp`, y las tres
`aromatica-*` la misma `/uploads/aromatica_flora_nativa_f8082aab07.webp` — una lámina en la librería, no tres
copias. 16 URLs distintas, 16 con 200. Verificado en BD, API y URL servida; **no en navegador**: `npm run build`
está prohibido en este tree y publicar es D10.

**El límite honesto, para que nadie lea esto como «el café ya se gestiona desde Strapi».** Los datos están, la
página todavía no los mira. `src/pages/cafe/index.astro:47-50,58-61` y `src/pages/cafe/visitantes.astro:23,30,46,69`
siguen armando a mano `/images/cafe-menu/proveedor-*.webp` y `visitante-*.webp`, y `itemImage`
(`src/lib/cafe.ts:233-269`) conserva `LOCAL_IMAGES` debajo. Eso es **D8** (pasos 1 y 2 de G6). Y el paso 3 —borrar
`LOCAL_IMAGES`— queda **bloqueado y documentado**, por huecos de contenido: `te-de-guayaba-agria` y 5 visitantes
sin lámina.

**Consignados, no borrados (decisión del dueño: «consignarlos y seguir»).** `pan-yuca-miel.webp` no tiene ítem
que lo reciba; `promo-duos-perfectos.webp` y `promo-reutilizable.webp` los pinta la plantilla
(`src/pages/cafe/index.astro:176` y `:152` — y la clave `'promo-duos'` de `LOCAL_IMAGES`, `src/lib/cafe.ts:243`,
nunca dispara porque ningún ítem tiene esa `familia`) y ningún content-type tiene un campo donde ponerlas. Quedan
nombrados en el
`aviso` de los dos envases y en `SIN_PROPUESTA` del teste, que es donde se ponen rojos si el día de mañana alguien
les abre destino. Y las láminas de personas (`proveedor-*`, `visitante-*`) siguen con la **procedencia sin
resolver**: caras reales con nombre de persona, dos de ellas candidatas a retrato de stock (D7).

**Qué cambió en el repo.** `strapi/scripts/lib/media-manifest.mjs` (la cláusula `compartida`: validación de forma,
reserva de archivo por `Map` en lugar de `Set`, salto de disputa cuando todos los dueños comparten, y el contrato
reescrito arriba con la contabilidad nueva), `strapi/scripts/media-alias-propuesto.json` y
`strapi/scripts/media-alias.json` (**66 filas**: 35 forma 1 + 31 forma 2; el recibo de D6 en 7 líneas nuevas de
`aviso`), `tests/media-manifest.test.mjs` (+7 testes `F2-d`, 48 → 55) y `tests/media-alias-propuesto.test.mjs`
(cuentas 66/35/31/6/14, inventario extendido a `cafe-menu/` —67 archivos—, y la guard de duplicados convertida de
absoluta a «declarada»). `npm test` **353/353**. Nada empujado, nada desplegado.

### Resuelto el 2026-09-27 (decisión D7): las caras son generadas, el hotlink venía de tres seeds, y el conducto se cerró

**Qué estaba abierto.** D6 cerró escribiendo nombres reales sobre láminas generadas y dejó consignado que
las caras de `proveedor-*` / `visitante-*` seguían con procedencia sin resolver. Dos retratos estaban peor:
`don-hernando-caficultor` y `luz-elenia-herbalista` salen en el sitio con nombre y apellido, y su foto es un
banco de imágenes —igual que el territorio de los dos y la miniatura de video de don Hernando. La puerta G4
pone a cero esos valores en la base, pero es `UPDATE` de contenido y **es del dueño**; lo que sí era de esta
ronda era tapar el conducto que los produce.

**La procedencia, medida en los 80 archivos locales.** `0` conservan EXIF y `2` traen ICC. Los lienzos son los
nativos de los generadores: `1024×1024` en 22 archivos y `1376×768` en 7 —el cuadrado y el panorámico de DALL·E
3—, y el resto es redimensionado (`1200×675` en 36, `1200×805`, `1200×896`). Ninguna persona del sitio viene de
una cámara cuyo archivo esté en este repo. Eso no demuestra que nadie sea falso; demuestra que **el repo no
tiene trazabilidad para afirmar que sean reales**, y eso es lo que había que decir antes de seguir poniéndoles
nombre y calificación promedio en el JSON-LD.

**De dónde salía el hotlink — el hallazgo útil de la ronda.** Las 10 celdas no las escribió nadie en el panel:
son el producto de tres seeds versionados. `strapi/scripts/seed-experiencias-demo.mjs` llevaba los ocho valores
soltos (dos retratos, dos territorios, una miniatura, dos heroes, un mapa) más los ítems de galería y el
`link_drone`; `completar-fichas-experiencias.mjs`, dos mapas y seis ítems de galería (uno de ellos en
`s2.wklcdn.com`, el CDN de Unsplash, que ni siquiera es el host que se enlazaba); `seed-proyectos.mjs`, un
hotlink de galería y el rickroll. Mientras los seeds quedaran intactos, cualquier re-run reproducía la deuda
entera. Se borraron 24 + 34 + 2 líneas verificadas una por una, con inserciones `0` salvo las notas.

La regla de escritura fue **omitir la clave, nunca ponerla en `null`**: un `PUT` con `null` desde un re-run
también borraría la foto real que el dueño suba mañana, y eso sería cambiar un footgun por otro. Los cuatro
arreglos de galería quedaron en `[]`.

**Candado: `tests/semillas-sin-hotlinks.test.mjs`.** Barre `strapi/scripts/**/*.mjs`, extrae todo literal
`http(s)://` y muere si coincide con `images.unsplash.com`, `unsplash.com`, `wklcdn.com`, `picsum.photos`,
`placehold.co`, `via.placeholder.com`, `dQw4w9WgXcQ` o `momento360.com/e/u/demo`. Dientes probados con mutante:
reponiendo el ítem de `seed-proyectos.mjs:275` falla nombrando el patrón y la razón. El segundo teste exige que
cada patrón tenga su muestra y que nadie encoja la lista para que pase (`PROHIBIDAS.length === muestra.length`),
y que el barrido no sea vacío (`archivos >= 18`, los tres seeds citados deben existir).

**El allowlist de embeds estaba anclado mal, y ya no.** `HOST_EMBED` era una alternancia sin anclar el final,
así que cualquier tercero cuyo nombre trajera ese trozo pasaba por proveedor: `fotos-panoramicas-360.com` se
pintaba como tour propio y `notyoutube.com` se clasificaba como YouTube. Hoy es lista cerrada con frontera de
dominio (`(^|\.)(…)$`). `classify()` **sigue** razonando por parecido y así se quedó, probado con mutante:
anclarlo también no cambia una sola salida, porque por diseño no le llega nada que no esté en `HOST_EMBED`.
La guard nueva es `tests/media.test.mjs` («proveedor de embed por host exacto, no por parecido del nombre»):
8 proveedores que deben pintar y 6 hosts imitados que no pueden llegar a la plantilla ni por `mediaSrc()` ni
por `toMediaItem()`. Con el allowlist flojo, ese teste falla nombrando `fotos-panoramicas-360.com`.

**Corrección de una cifra que este runbook venía repitiendo mal.** Decía 12 celdas / 18 URLs / 7 columnas de
Unsplash. Recontado columna por columna el 2026-09-27: **10 / 15 / 6**. El error era la columna
`anfitriones.galeria_fotos`, que G2 jubiló del esquema —por ese mismo motivo la consulta de verificación
publicada en G4 reventaba en `psql`— y las 3 URLs descontadas eran las de esa columna. La cifra de
placeholders (**5 celdas / 6 ocurrencias**) sí seguía bien, y conviene cómo la rompí: el primer recuento que
hice dio 4/5 porque dejé `anfitriones.video_url` fuera de la consulta. Son **dos columnas homónimas en dos
tablas** y las dos contienen el rickroll; quien recuente esta puerta tiene que nombrar las dos cada vez.
Worklist con `documentId` y las dos queries que corren: en G4, reescrito en esta misma ronda.

**Qué se sirve hoy, medido por la ruta de lectura y no por deducción.** Sonda contra el Strapi vivo con el token
de G3: los dos heroes, los dos territorios, los dos retratos, la miniatura, el mapa y los 7 ítems de tercero de
las dos galerías salen `null`; `anfitrionFoto()` devuelve `null` para los dos anfitriones. Pero pasan y se pintan los
cinco embeds de ejemplo: el rickroll de `experiencias.video_url`, el de `experiencias.link_drone`, la demo de
`momento360` de `tour_360_url` y los dos que viven dentro de `galeria_urls` (ítems `video` y `tour360` de la
ficha `amanecer-en-el-bosque-de-niebla`); y el rickroll de `anfitriones.video_url`, enlazado en la ficha de don
Hernando. Y en producción (`iwage.co`, bundle previo a G8) aún se sirven las URLs de
Unsplash en el HTML de esas dos fichas: **F1 neutraliza en el bundle nuevo, no en el publicado.** Consecuencia:
al día siguiente de D10 el sitio deja de mentir con las fotos y empieza a montar un video de burla y un tour de
muestra en una ficha publicada. Ese es, exactamente, el trabajo que queda en G4.

**Qué cambió en el repo.** `src/lib/media.ts` (`HOST_EMBED` anclada + el docstring de `esPintable` reescrito con
las cifras medidas y la verdad incómoda de los dos embeds que sí pasan), `tests/media.test.mjs` (+1 teste),
`tests/semillas-sin-hotlinks.test.mjs` (nuevo, 2 testes) y los tres seeds. `npm test` **356/356** (353 antes de
esta ronda). Nada empujado, nada desplegado.

## G4 · Vaciar Unsplash y placeholders en la base

**Desbloquea:** que el admin no muestre como contenido lo que el sitio ya se niega a pintar, y que el día
después de G8 no quede un rickroll montado en una ficha publicada. `esPintable()` dejó de pintar los hotlinks
en F1 y D7 cerró el conducto (los tres seeds que los reproducían ya no tienen ni uno), pero el valor sigue en
la BD. **Recontado columna por columna el 2026-09-27: 10 celdas con 15 URLs de Unsplash en 6 columnas de 2
tablas** (13 URLs distintas, 12 fotos distintas; tres fotos reutilizadas en dos celdas cada una), **y 5 celdas
con 6 ocurrencias de embed de ejemplo** (2 URLs distintas: el rickroll cuatro veces y la demo de momento360 dos;
una de las celdas es `anfitriones.video_url`, columna distinta de la homónima de `experiencias`). La triple de
Unsplash que venía repitiendo este runbook —12/18/7— estaba vieja: contaba la columna `anfitriones.galeria_fotos`,
que G2 jubiló del esquema, y por ese mismo motivo la consulta de verificación publicada aquí reventaba en
`psql`. Las dos queries que sí corren están abajo.

**Worklist Unsplash** (columna · `id` · `documentId` · `slug` · URLs en esa celda):

- `anfitriones.foto_perfil_url` · 1 · `afsqwymyai7ayu422xxk6evh` · don-hernando-caficultor · 1
- `anfitriones.foto_perfil_url` · 2 · `pi5eegjukneax6rgk0ox6y1i` · luz-elenia-herbalista · 1
- `anfitriones.foto_territorio` · 1 · `afsqwymyai7ayu422xxk6evh` · don-hernando-caficultor · 1
- `anfitriones.foto_territorio` · 2 · `pi5eegjukneax6rgk0ox6y1i` · luz-elenia-herbalista · 1
- `anfitriones.video_thumbnail` · 1 · `afsqwymyai7ayu422xxk6evh` · don-hernando-caficultor · 1
- `experiencias.imagen_hero_url` · 1 · `h9ct6yd2cxmwnkusv6gigkh9` · amanecer-en-el-bosque-de-niebla · 1
- `experiencias.imagen_hero_url` · 2 · `b3go6nqasmwpp605ys0waoyg` · jardin-medicinal-y-saberes-de-montana · 1
- `experiencias.galeria_urls` · 1 · `h9ct6yd2cxmwnkusv6gigkh9` · amanecer-en-el-bosque-de-niebla · **4**
- `experiencias.galeria_urls` · 2 · `b3go6nqasmwpp605ys0waoyg` · jardin-medicinal-y-saberes-de-montana · **3**
- `experiencias.mapa_imagen_url` · 1 · `h9ct6yd2cxmwnkusv6gigkh9` · amanecer-en-el-bosque-de-niebla · 1

Total 10 celdas · 15 URLs. **Tres filas concentran 8 de las 10**: `anfitriones` 1 aporta 3,
`anfitriones` 2 aporta 2 y `experiencias` 1 aporta 3; la experiencia 2 cierra con 2.

**Worklist placeholders**: cuatro de las cinco celdas son la misma ficha, `amanecer-en-el-bosque-de-niebla`
(`experiencias` id 1 · `h9ct6yd2cxmwnkusv6gigkh9`), y la quinta es la de don Hernando (`anfitriones` id 1 ·
`afsqwymyai7ayu422xxk6evh`):

- `experiencias.video_url` · 1 · `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `experiencias.link_drone` · 1 · `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `experiencias.tour_360_url` · 1 · `https://momento360.com/e/u/demo`
- `experiencias.galeria_urls` · 1 · contiene **además** el rickroll y la demo, como ítems `video` y `tour360`
- `anfitriones.video_url` · 1 · `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

Las **cinco** se sirven hoy: `video_url`, `link_drone` y `tour_360_url` salen como enlaces clicables en la ficha
de la experiencia, los dos ítems de `galeria_urls` como material de su galería, y el de `anfitriones` como el
enlace de video de la ficha del anfitrión. A `esPintable()` le parecen
legítimos —son YouTube y son momento360—, así que jubilarse con F1 no los toca: `dQw4w9WgXcQ` y
`momento360.com/e/u/demo` pasan y se pintan.

Verificación en dos números (deben dar **10** y **5 celdas / 6 ocurrencias** hoy, y **0** después):

```sql
-- (1) celdas con hotlink de imagen de tercero — hoy 10
with c as (
  select x.col, x.id
  from (
    select 'foto_perfil_url' col, id, coalesce(foto_perfil_url::text,'')  v from anfitriones
    union all select 'foto_territorio', id, coalesce(foto_territorio::text,'')  from anfitriones
    union all select 'video_thumbnail', id, coalesce(video_thumbnail::text,'')  from anfitriones
    union all select 'imagen_hero_url', id, coalesce(imagen_hero_url::text,'')  from experiencias
    union all select 'galeria_urls',    id, coalesce(galeria_urls::text,'')     from experiencias
    union all select 'mapa_imagen_url', id, coalesce(mapa_imagen_url::text,'')  from experiencias
  ) x where x.v ~* 'unsplash|wklcdn|picsum\.photos|placehold'
) select count(*) as celdas from c;

-- (2) celdas y ocurrencias de embed de ejemplo — hoy 5 celdas / 6 ocurrencias
with c as (
  select x.col, x.id, (regexp_matches(x.v,'https?://[^"\\ ,]+','g'))[1] as url
  from (
    select 'video_url' col, id, coalesce(video_url::text,'') v from experiencias
    union all select 'tour_360_url', id, coalesce(tour_360_url::text,'') from experiencias
    union all select 'link_drone', id, coalesce(link_drone::text,'') from experiencias
    union all select 'galeria_urls', id, coalesce(galeria_urls::text,'') from experiencias
    union all select 'anf_video_url', id, coalesce(video_url::text,'')   from anfitriones
  ) x
) select count(distinct (col,id)) as celdas, count(*) as ocurrencias from c
    where url ~* 'dQw4w9WgXcQ|momento360\.com/e/u/demo';
```

Ambas queries son de solo lectura y corren con `docker exec -i sostenibilidad_db psql -U admin -d iwage
-f - < archivo.sql`; el `::text` en `galeria_urls` es obligatorio porque la columna es `jsonb` y sin él
Postgres la tira con `operator does not exist: jsonb ~~*`.

Dos cosas que son **decisión de contenido**, no limpieza:

- `don-hernando-caficultor` y `luz-elenia-herbalista` tienen su retrato puesto con un stock de Unsplash,
  presentados como su cara con nombre y apellido reales. Retirar sin más deja la ficha sin foto (el mosaico
  Icon ya está diseñado para eso); reemplazar pide foto real.
- Las 2 celdas de `galeria_urls` **no se ponen a `null`**: hay que reescribir el json quitando los ítems,
  porque `galeria_urls` es la única galería que tienen las 2 experiencias publicadas.

Y si en G2 se autorizó el retiro de `galeria_fotos` / `*_url`, esta puerta puede absorberse en el mismo
`UPDATE` posterior a G3 — pero después de G3, nunca antes. Antes de tocar cualquier fila: volcado previo
(el `pg_dump` de la puerta), y en el mismo commit la receta de recuperación, porque estos valores son el
único registro de qué había.

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
| `src/pages/cafe/index.astro:152,176` (plantilla) | dos promos escritas a mano | `promo-duos-perfectos`, `promo-reutilizable` — re-medido el 2026-09-27 con D6: eran de `index.astro`, no de `menu.astro` |

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

**Actualizado el 2026-09-27 con D6 — la precondición de arriba quedó vieja.** `files = 0` ya no es el estado: la
librería tiene 62 archivos y las 19 piezas de `cafe-menu/` están en el inventario del importador. Del paso 1, que
pedía «0 ítems sin imagen», **16 de los 17 `item_menus` tienen `imagen` poblada**, y también los 4 `proveedors`
(`foto`) y 4 de las 9 `historia_visitantes` (`imagen`); el único hueco es `te-de-guayaba-agria`, sin lámina. O sea
que la primera fila de la tabla de puntos de verdad (`LOCAL_IMAGES`) y las tres de literales
(`fallbackItems`, `fallbackProveedores`, `FALLBACK_HISTORIAS_HOME`) **siguen siendo los cuatro puntos de verdad de
la página**, porque D6 escribió el dato en Strapi pero nadie cambió la lectura: eso es **D8**, y es el paso 2 de
esta puerta. El paso 3 —borrar `LOCAL_IMAGES` y los campos de imagen de los arreglos— sigue **bloqueado por
contenido**: mientras `te-de-guayaba-agria` y 5 visitantes no tengan lámina, jubilar la regla deja huecos que hoy
no deja. Las dos `promo-*` no tienen campo donde ir (ningún content-type las recibe) y `pan-yuca-miel.webp` no
tiene ítem: quedaron consignados en el `aviso` del envase y en `SIN_PROPUESTA` del teste, no borrados.

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
