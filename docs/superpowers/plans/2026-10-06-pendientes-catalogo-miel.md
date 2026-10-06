# Pendientes de catálogo, miel e infraestructura — plan de ejecución (2026-10-06)

**Goal:** cerrar los 14 frentes abiertos en un orden que no vuelva a dejar deudas: primero la miel (donde la corrección #67 dejó contradicciones propias), después lo que depende de decisiones del dueño, al final la infraestructura. Y publicar las tres imágenes del gotero de 25 ml **solo después de sanear los datos que inventan**.

**Architecture:** tres carriles que no se pisan entre sí. (A) Contenido de la miel en Strapi — F1–F2, se revierte con el respaldo por `document_id`. (B) Código y layout — F3–F4, se revierte con `git revert`. (C) Infraestructura — F5, vive fuera del repo (Cloudflare, nginx del compose) y por eso pide autorización expresa. La foto (F0) alimenta A pero se decide aparte, porque su problema no es técnico: es que lo que se lee en la imagen contradice lo que dice la ficha.

**Tech Stack:** Astro 5 SSR (`output: 'server'`), Strapi v5 sobre Postgres (`iwage`), `node --test` (398 testes), Docker Compose proyecto `negocio`, nginx en la imagen, Redis compartido `redis_app`.

## Global Constraints

- **Toda escritura a base de datos lleva respaldo y archivo de restauración antes del primer `UPDATE`/`PUT`.** Restauración por `document_id` + estado publicado, nunca por id de fila: el `PUT` sobre `?status=published` **reemplaza** la fila (medido: 77→90→93).
- **Redis `redis_app` es compartido: solo se borran claves `iwage:*`.**
- **`public/images/Meliponas/` es material del dueño:** no se borra, no se versiona, y se respalda fuera de git antes de cualquier conversión. Las conversiones salen a `.scratch-melonino/`, nunca encima del original.
- **No se inventan datos.** Peso, condiciones de envío, registro INVIMA, número de lote y fecha de cosecha solo entran si el dueño los afirma.
- **No hay push sin autorización.** Hay **10 commits locales** esperando (`990cd65`…`b94ff61`).
- Verificación **sobre la hoja servida** (contenedor `iwage_web`, `127.0.0.1:4321`), no sobre el fuente; y en dos pasadas para distinguir MISS de HIT.
- Sin navegador headless en la máquina: **toda afirmación de píxeles se etiqueta como cálculo a partir de las clases**.
- Antes de cada lote de edición: `git status --short`. Commits nuevos, nunca `--amend`.

---

## FASE F0 — Las tres imágenes del gotero: revisar antes de publicar (bloqueante)

Archivos entregados por el dueño el 2026-10-06 03:14 en `public/images/Meliponas/`:

| archivo | px | qué muestra | encaja en |
|---|---|---|---|
| `Gotero Miel de 25 ml.png` | 944×920 | gotero ámbar con etiqueta + tarjeta de trazabilidad | portada de la ficha (`aspect-square`) |
| `Ficha Gotero Miel de 25 ml.png` | 944×705 | arte de la etiqueta: tabla nutricional, INVIMA, QR | segundo ítem de galería (`aspect-[4/3]`) |
| `Tarjeta Gotero Miel de 25 ml.png` | 887×915 | tarjeta de agradecimiento con QR y lote | tercer ítem, recortado a 4:3 |

Los tres defectos que **impiden** publicarlas tal cual:

- [ ] **F0.1 Datos de trazabilidad que se contradicen entre sí y con la ficha.** La foto del gotero dice `Lote: ANG-001 | Cosecha: Mayo 2026`; la etiqueta dice `LOTE: [ANG-IWAGÉ-001] | DIC 2026`; la tarjeta repite `[ANG-IWAGÉ-001]` **con corchetes de placeholder**. La ficha publicada dice `Lote L25-05-001`. Son tres códigos y dos fechas distintas para un mismo producto. Esto empata con **#64** (la cosecha es mayo 2025 o 2026): el dueño elige el lote y la fecha **una sola vez**, y las tres piezas se regeneran con ese par.
- [ ] **F0.2 La etiqueta nutricional es falsa y el registro INVIMA está en blanco.** `Ficha Gotero…png` muestra `INVIMA Reg. San. N°: XXXXXXXX` (placeholder visible), `Azúcares 0 g` y `Carbohidratos 4 g` cuando una porción de 25 ml de miel son ~35 g y casi 30 g de azúcares, `Energía 150 kJ` cuando corresponden ~450 kJ, `Sodio` repetido dos veces, `Calceium` mal escrito, una columna llamada `Plausible Aprox.`, y el lema `MEDICINA ANCESTRAL` como afirmación sanitaria sobre un alimento. **Ninguna de estas piezas sale a producción**: publicar un registro sanitario en `XXXX` es anunciar una habilitación que no existe.
- [ ] **F0.3 Marca y contacto que no son los del sitio.** La foto del gotero tiene etiqueta `MELIPONARIO TOLIMA` mientras la etiqueta y la tarjeta dicen `MELIPONARIO IWAGÉ`. Y al pie de la tarjeta asoman `meliponario@iwage.co` y `(371) 552 2756`: 371 no es un prefijo móvil colombiano asignado (lo son 300–305, 310–319, 320–324, 330–333, 350–351) y el único contacto publicado del sitio es `+57 302 669 3366` / `info@iwage.co`. Un teléfono inventado en una foto impresa es peor que un teléfono ausente.

- [ ] **F0.4 Decisión del dueño (requiere F0.1–F0.3).** Opciones: **(a)** regenerar las tres piezas con el lote, la fecha, la marca y el contacto que él confirme, dejando la tabla nutricional fuera del encuadre; **(b)** publicar solo la foto del gotero recortada para que no se lea la tarjeta de trazabilidad, y posponer etiqueta y tarjeta; **(c)** usar las tres como referencia visual y que yo produzca las definitivas. Recomiendo **(a)**: es la única que deja el envase photographed y la ficha diciendo lo mismo.
- [ ] **F0.5 Saneamiento técnico (después de F0.4).** Pipeline ya probado (`.scratch-melonino/instalar.mjs`): `sharp` → `rotate()` → resize al lienzo del slot (portada 1024×1024; galería 1024×768) → `webp` calidad 85 → `POST /api/upload` con `alternativeText` → hilar con `PUT /api/productos/:documentId?status=published`. Los originales no se tocan; los rendidos van a `.scratch-melonino/` y de ahí a Strapi.
- [ ] **F0.6 Alt text honesto.** Describir lo que hay en el cuadro, sin prometer escaneo: si el QR no resuelve, el alt no dice «escaneable». Medir antes si el QR de la tarjeta apunta a algo.

**Criterio de terminado F0:** cero piezas publicadas con placeholder, con lote y fecha idénticos a los de la ficha, y con la marca del sitio. Si el dueño no responde F0.4, la familia miel queda como está hoy (foto prestada) y se registra el porqué.

---

## FASE F1 — Coherencia de la miel en Strapi (#68, #70, #71)

- [ ] **F1.1 Rehiilar `files` 91 a `MIEL-120`** (`document_id mvcuo3syqy41dti0s3cokyms`). Su propio `alternative_text` se describe como «frasco de vidrio de 120 ml … etiqueta que dice "Miel Angelita 120 ml"»: hoy es la portada del gotero de $25.000 y el frasco de $78.000 no tiene foto. Si F0.4 produce la foto propia del gotero, este paso es limpio; si no, F1.1 se hace igual (deja la verdad en la ficha correcta) y el gotero vuelve al placeholder hasta F0.
- [ ] **F1.2 Corregir el texto heredado del envase equivocado (#70).** Medido con `regexp_matches` sobre los jsonb: en `MIEL-25` y `MIEL-60` aparecen tres «frasco» en cada una — `faq`: «sumerge **el frasco** en agua tibia (máx. 40 °C)»; `diferenciadores` → «de dónde viene cada frasco»; `ecosistema` → «Detrás de cada frasco hay guardianes…». La de `faq` es una instrucción de uso, no una figura retórica: se redacta por envase (gotero: baño maría con el gotero separado; botella: botella cerrada) y las otras dos pasan a «cada envase»/«cada lote». La `descripcion` del gotero que menciona «el frasco de 120 ml» **no se toca**: es una referencia cruzada deliberada y correcta.
- [ ] **F1.3 `src/lib/tienda.ts:232` (#71).** El docstring de `getProductosPorFamilia` sigue diciendo «Miel Angelita 120/250/500 ml». Una línea.
- [ ] **F1.4 Respaldo y restauración.** Copia `--column-inserts` de `productos` + `files_related_mph` + `files`, y `restaurar.sh` con modo `parcial` (reversión por `document_id`) y `total`, en `/home/ubuntu/backup/miel-angelita-<fecha-2>/`. Validar el archivo de reversión dentro de `BEGIN; … ROLLBACK;` antes del primer `PUT`.
- [ ] **F1.5 Test que fije la regla.** Ninguna ficha de la miel puede nombrar un envase que no sea el suyo en `faq`/`guia_uso`: se parsea el JSON servido y se compara contra `presentacion`. La guarda genérica de destinos no habría cazado #67; esta sí caza una recaída.

**Criterio de terminado F1:** las tres fichas 200, cada una nombrando su propio envase, `MIEL-120` con la foto que sí lo representa, 398+ testes verdes.

---

## FASE F2 — Pesos y envío (#63, #69): no se resuelve solo

- [ ] **F2.1 Dejar constancia medida.** `MIEL-60` = 350 g y `MIEL-120` = 650 g son números asignados cuando esas fichas se creían de 250 ml y de 500 ml; `MIEL-25` = NULL. Las dos medianas con foto (`CAJA-AF-M`, `CAJA-INPA-M`) están en NULL mientras sus hermanas cargan 2600/4000 y 2800/4300. Y `envio_gratis`: `true` en las cuatro cajas chica/grande, `false` en las dos medianas — o sea el selector de variaciones **apaga** la insignia «Envío gratis a todo Colombia» (`meliponas/tienda/[slug].astro:236-238`) al elegir Mediana, y alimenta `shippingDetails` del JSON-LD.
- [ ] **F2.2 Lo que sí puedo hacer sin inventar:** mover `Bulto 40 kg` a `peso_gramos = 40000` (es un dato publicado en la `presentacion`, mismo criterio que ya se usó con `dimensiones`). **No** la canasta: dice `~5 kg`, y una tilde no es una medición.
- [ ] **F2.3 Pregunta al dueño, por escrito y con las tres opciones por producto:** (i) confirmar el peso real de cada miel y de cada mediana, (ii) dejar NULL, o (iii) autorizar **retirar** los 350/650 g heredados de las etiquetas falsas. Recomiendo (iii) para las dos mieles: un número que se sabe errático publicado es peor que un vacío. El envío es una promesa comercial y no se toca sin que él la haga.

**Criterio de terminado F2:** ningún peso publicado que el dueño no afirme, y la insignia de envío idéntica entre variaciones de una misma familia o claramente distinta por motivo explicado.

---

## FASE F3 — Layout restante (#72, #73)

- [ ] **F3.1 `ProductCard.astro:99` sigue con `truncate`** en la línea de presentación. Calculado con las clases (`Section` default `max-w-6xl` → 1104 px; rejilla `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`): en escritorio la card es de ~258 px y el texto de ~218 px → ~37 caracteres a 12 px. Recortan «Canasta ~5 kg · según cosecha de la semana» (42) y «Por persona · ~2 horas · grupos de máx. 10» (42); en móvil de 2 columnas (~19 caracteres) recorta casi todas. Arreglo: quitar `truncate` y dejar `line-clamp-2` con `min-h`, coherente con lo que se hizo para la descripción en #62.
- [ ] **F3.2 Verificar en el navegador servido, no en el fuente:** capturar `/granja/tienda` y medir si el `…` desapareció; sin navegador, la prueba es que la clase `truncate` ya no está en el HTML de la card.
- [ ] **F3.3 Decisión de alcance (#73), no defecto.** El ancho completo se aplicó solo en las dos fichas que el dueño señaló. Siguen a 768 px seis artículos de bitácora (`meliponas:56`, `granja:51`, `cafe:50`, `gestion:51`, `naturaleza:51`, `tierras:51`), `legal/_layout.astro:143` y los componentes compartidos `Section.astro:23` / `Hero.astro:42,132`. En prosa de lectura 768 px es una medida defendible y **propongo dejarla**; las preguntas frecuentes de la ficha también se quedaron a 768 a propósito. Si el dueño quiere uniformidad, son seis líneas y se vuelve a medir el aire entre secciones.

**Criterio de terminado F3:** ninguna línea de la card recortada en escritorio, y el alcance del ancho escrito en el runbook para que no se reabra.

---

## FASE F4 — El atril retirado sigue vendiéndose (#65, #56, #43)

- [ ] **F4.1 Medido: diez apariciones en siete archivos**, no dos. `src/lib/proyectos.ts:14` (el tipo `'inpa-atril'`) y `:118` (su etiqueta); `meliponas/proyectos/lineas/fincas-productivas.astro:25,32`; `prae-educativo.astro:24,31,41`; `turismo-naturaleza.astro:25,31`; `paisajismo-residencial.astro:33`; `proyectos/index.astro:51`. No es adorno: es el entregable que se compromete a montar, y el atril de guadua salió del catálogo el 2026-10-05 con su 301 hacia `casa-techada-pedestal`.
- [ ] **F4.2 Preguntar cuál es el entregable real** de cada línea: «pedestal», «soporte a medida» o «casa techada». Con la respuesta, editar las diez y retirar el miembro `'inpa-atril'` del tipo (o renombrarlo), que hoy es una opción de menú que no corresponde a ninguna SKU.
- [ ] **F4.3 Reaprovechar la decisión #56** (qué anuncia el kit de inicio ahora que el atril no existe) en el mismo lote, porque tocan el mismo inventario de piezas.

**Criterio de terminado F4:** `grep -rin atril src/` sin coincidencias fuera del 301 y de los comentarios que explican el retiro.

---

## FASE F5 — Infraestructura (#52, #54, #44)

- [ ] **F5.1 #52 — el sitio sigue respondiendo 200 por http.** Medido hoy: `http://iwage.co/meliponas/tienda` → 200. No es nginx: es Cloudflare sin *Always Use HTTPS*. Es un toggle del panel, fuera de este repo: **se pide autorización y se hace con el dueño mirando**, y se verifica con `curl -sI http://iwage.co/` esperando 301. Las 301 internas ya salen relativas (verificado: `location: /meliponas/tienda/miel-angelita-120ml-frasco`), así que no hay riesgo de bucle http↔https.
- [ ] **F5.2 #54 — ninguna cabecera de seguridad llega al HTML.** Medido: `curl -sI https://iwage.co/` no devuelve HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni CSP. Primero diagnosticar por qué (directivas `add_header` sin `always`, o en el `server` que no sirve HTML, o tragadas por la caché) y después aplicar; sin diagnóstico no se toca el compose.
- [ ] **F5.3 #44 — la integración con reservas: reencuadrada.** Sondeada esta pasada: `http://reservas_app:4326/api/recursos` responde **500** (envuelve un 401 de Strapi), pero `recursos_reservables` de la base `reservas` tiene **0 filas**. Es decir: arreglar el token no cambia nada, y el rebautizo de la miel no rompió ninguna asignación porque no había ninguna — la tienda ya usa el fallback `meliponas-<slug>` (`src/lib/catalogo.ts:37`, `meliponas/tienda/[slug].astro:293`). Opciones para el dueño: (i) dejar el `catch` silencioso y cerrar la tarea como «sin datos que devolver», (ii) quitar la llamada hasta que reservas tenga recursos, para no pagar un fetch fallando en cada ficha. Recomiendo (ii) con nota.

**Criterio de terminado F5:** http 301, cuatro cabeceras presentes en una hoja servida, y #44 cerrado o silenciado con el motivo escrito.

---

## FASE F6 — Cola de fotos (#22, #26, #31, #32, #35, #23)

- [ ] **F6.1 Estado real medido: 15 de 22 productos publicados sin portada** (la tarea decía 18; el censo por `files_related_mph` con `field='imagen'` da 7 con y 15 sin). Las 15: trampa, las cuatro cajas chica/grande, los cinco productos de granja, los tres kits, y **las dos fichas nuevas de la miel** (`MIEL-60`, `MIEL-120`), que abren con el icono `package` y prestan el `og:image` del hero de marca.
- [ ] **F6.2 Orden por exposición comercial, no por facilidad:** 1) botella 60 ml y frasco 120 ml (las dos que el dueño acaba de corregir), 2) los tres kits, 3) las cuatro cajas, 4) granja. Reglas de contenido ya fijadas: miel más dorada y líquida que la de *Apis*; máximo 6–7 cajas por vista; sin rostros frontales de personas.
- [ ] **F6.3 Las demás colas siguen abiertas y no compiten:** #26 (6 fichas de cultivos sin foto), #31 (`hero-meliponas.webp` grave — es el que prestan las fichas sin portada), #32 (6 retratos de subsistema), #35 (tarjeta del frente I+D), #23 (bitácoras 1, 19 y 24 frenadas por cuota).

**Criterio de terminado F6:** cada ficha publicada con foto propia o con la decisión de placeholder escrita; y si #31 se atiende, el `og:image` prestado deja de apuntar a un hero que está en la cola de reemplazo.

---

## FASE F7 — Cierre de cada lote

- [x] `npm test` verde (hoy 398) antes de construir.
- [x] `cd /home/ubuntu/negocio && docker compose build iwage_app && docker compose up -d iwage_app` — **con autorización**, porque recrea el contenedor y muere la caché de nginx.
- [x] Purgar solo `iwage:*` en `redis_app`, en dos pasadas MISS→HIT.
- [x] Verificar sobre la hoja servida: status, las secciones nuevas, `og:image`, JSON-LD (`name`, `sku`, `image`, `offers`), y que el sitemap dinámico liste los slugs vigentes.
- [x] Runbook con el antes y el después, y con lo que **no** se hizo y por qué. Quedó en este mismo archivo («Registro de ejecución» y «Despliegue y push»), no en `2026-09-24-media-strapi-consolidation.md` como decía el casillero: el frente es de este plan y partir el relato entre dos documentos lo vuelve ilegible.
- [x] Commit por frente, sin `--amend`. Push hecho con autorización: `b623230..f08e7a7`, 14 commits.

---

## Orden de ejecución y dependencias

| # | frente | depende de | bloquea a |
|---|---|---|---|
| F0.4 | lote, fecha, marca, contacto de las imágenes | **respuesta del dueño** | F0.5, F0.6, F1.1, #64 |
| F1 | coherencia de la miel | respaldo F1.4 | F6.2 (las fotos nuevas) |
| F2 | pesos y envío | **respuesta del dueño** | — |
| F3 | `truncate` de la card y alcance del ancho | — | — |
| F4 | atril en proyectos | **respuesta del dueño** (entregable real) | #56, #43 |
| F5 | http 200, cabeceras, reservas | **autorización** (Cloudflare / compose) | — |
| F6 | cola de fotos | F0 (definir el estilo del envase) | #31 |
| F7 | cierre | todo lo anterior | push |

F3 y F1.3 son mecánicas y no esperan a nadie: se pueden ejecutar mientras el dueño responde F0.4, F2.3 y F4.2.

## Self-review de este plan

- **No confuevo las dos clases de pendiente.** Seis frentes (F0.4, F2.3, F4.2, F5.1, F5.2, F5.3) piden una decisión o una autorización; solo tres (F1, F3, parte de F6) son ejecutables ya. Escribir «atender todos los pendientes» sin esa distinción me llevaría a inventar un lote o a regalar envío gratis, que es exactamente el error que produjo #67.
- **Lo más valioso de la revisión no es lo técnico:** las tres imágenes traen un registro INVIMA en `XXXXXXXX`, una tabla nutricional que dice `Azúcares 0 g` para la miel, dos fechas de cosecha, un lote entre corchetes, otra marca (`Tolima`) y un teléfono con un prefijo que no existe en Colombia. Publicarlas tal cual pondría el sitio a prometer cosas que el producto no tiene. Van en la fase 0, antes que cualquier hilado.
- **Corregí sobre la marcha dos cifras que venía arrastrando mal:** los productos sin portada son 15, no 17 ni 18; y #44 no está «rompiendo la tienda» — la tabla que consulta está vacía, así que su 500 hoy no se nota. Lo uno y lo otro quedaron escritos en las tareas para que la próxima pasada no vuelva a repetir el número viejo.
- **Riesgo que dejo dicho:** F1.1 (rehiilar la foto al frasco) es reversible con el respaldo, pero si el dueño decide en F0.4 que la foto del gotero se regenera, el orden óptimo cambia — conviene F0.4 antes de F1.1, y por eso F1.1 está marcado como condicional.

---

## Registro de ejecución (2026-10-06)

### F0 — imágenes: ejecutado, pero con las piezas del dueño descartadas

Las tres imágenes adjuntas **no se publicaron**. Los cuatro defectos que encontró la revisión se
confirmaron al leerlas (INVIMA en `XXXXXXXX`, `Azúcares 0 g` en la tabla nutricional de una miel,
dos fechas de cosecha distintas, teléfono con prefijo inexistente). Con los hechos que dio el dueño
se regeneraron tres piezas nuevas, y las tres pasaron la regla de aceptación: cero placeholders,
lote y fecha idénticos a los de la ficha, marca del sitio.

Piezas instaladas en la ficha del gotero (`imagen` es medio único; `galeria` sí es lista):

| archivo | id | slot | texto que muestra |
|---|---|---|---|
| `miel-gotero-25ml-portada.webp` | 116 | `imagen` | MELIPONARIO IWAGÉ · MIEL DE ANGELITA · Tetragonisca angustula · 25 ml / Lote: ANG-001 · Cosecha: Septiembre 2026 · Flora: Guamo & Café |
| `miel-gotero-25ml-etiqueta.webp` | 117 | `galeria[1]` | Corredor Ambalá · Tolima, Colombia / Contenido neto: 25 ml / Lote ANG-001 · Cosecha: septiembre 2026 / Manténgase refrigerada (4 °C – 8 °C) |
| `miel-gotero-25ml-tarjeta.webp` | 118 | `galeria[2]` | GRACIAS / Lote ANG-001 / Cosecha septiembre 2026 / +57 302 669 3366 / info@iwage.co |

Dos correcciones que salieron al redactar, no al medir: la primera etiqueta decía **Ibagué** y el
sitio entero vende el origen como **corredor Ambalá** (Ibagué solo aparece como ciudad de pago
contra entrega); y la etiqueta no llevaba el lote, que es justo lo que la ficha promete
("La etiqueta indica colmena, fecha de cosecha y flora de temporada").

### F1 — coherencia de la miel: ejecutado

Cuatro documentos por Strapi con guarda de SKU contra respaldo y conteo exacto de reemplazos
(`.scratch-melonino/aplicar-lote.mjs`): SKUs `MIEL-25`/`MIEL-60`/`MIEL-120`/`GRA-ABO-040`, lote
ANG-001, cosecha septiembre 2026, y "frasco" sustituido por "envase" donde la ficha no es un frasco.
Respaldo en `/home/ubuntu/negocio/backup/miel-lote-2026-10-06/`.

El #68 obligó a una decisión que el plan no previó: la foto del gotero era `files` 91, un frasco de
vidrio **transparente** rotulado "120 ml". Rehiilarlo al MIEL-120 habría cambiado una mentira por
otra, porque esa ficha dice "Frasco ámbar" y dedica un párrafo a por qué el ámbar importa. Se
generaron dos piezas nuevas sí (botella 60 ml y frasco 120 ml, ámbar real, texto exacto → ids 119 y
120) y el 91 quedó **huérfano**, sin borrar: es un render de la cola anterior, cuya falla conocida
era el color del vidrio.

Verificado en producción tras purga de Redis y expiración del `html_cache` de nginx (120 s): las
tres fichas muestran su propia foto y `producto_miel_1` aparece **cero veces**. Productos sin
portada: 15 → **13**.

### F3 — layout: ejecutado

`truncate` → `line-clamp-2` en la línea de presentación de la card. Medido: la presentación más
larga tiene 68 caracteres y la columna admite ~37 a `text-xs`, así que recortaba seis productos.

### F4 — atril: ejecutado

Nueve apariciones de copy en cinco páginas de proyectos reescritas con el criterio del dueño. Antes
de tocar nada se midió el enum: `modelo_caja` está vacío en 12 proyectos y es `mixto` en 2, y cero
filas contienen "atril" — o sea que `inpa-atril` en `proyectos.ts` no miente en pantalla y jubilarse
toca el esquema de Strapi, lo que queda aparte.

### Lo que NO cierra este paso

1. **F2 (pesos y envío) sin tocar**: #63 necesita los pesos y condiciones reales.
2. **F5 (infra) sin tocar**: #52, #54, #44 piden Cloudflare y `docker-compose.yml`.
3. **Las cuatro bitácoras** que narran la cosecha de mayo bajo el lote viejo siguen intactas. No es
   olvido: reescribirlas depende de si esa cosecha existió, y eso solo lo dice el dueño.
4. **La guarda que el plan proponía** (ninguna ficha de miel nombra un envase que no es el suyo) se
   descartó a propósito: la suite `npm test` es hermética y prueba código, no contenido de Strapi.
   Escribirla exigía inventar infra de auditoría sobre datos vivos para un caso que ya no está en
   los datos.
5. **`files` 91** (el frasco transparente de 120 ml) quedó huérfano, no borrado. Borrar medios no es
   reversible con el respaldo SQL: las filas vuelven, los bytes no.

### Despliegue y push (mismo día, con autorización del dueño)

`docker compose build iwage_app && docker compose up -d iwage_app`. Imagen nueva, contenedor
recreado, Redis purgado (`iwage:*`, 30 claves). El `html_cache` de nginx venía vacío por el
recreado, así que no hubo que esperar los 120 s.

Medido en el borde después del deploy:

| qué | antes | después |
|---|---|---|
| `/meliponas/trazabilidad/miel` | "L25-05-001" ×2, "Mayo 2025" | "ANG-001" ×2, "Septiembre 2026" ×1, cero del lote viejo |
| el visor QR | "código QR del frasco" | "código QR de la etiqueta" |
| `/meliponas/proyectos` + las cuatro líneas | "atril" en las cinco | cero en las cinco |
| cards de `/meliponas/tienda` | 8 × `truncate` | 8 × `line-clamp-2` |

Barrido de humo: 16 rutas clave devuelven 200, `/naturaleza` su 301 de barra final, `/api/contacto`
vivo (400 con payload inválida a propósito), y las tres puertas de la miel —`miel-angelita-120ml`,
`-250ml`, `-500ml`— devuelven 301 cada una a su ficha correcta. La primera vez las probé con las
rutas sin `ml` y me devolvieron 302: error de quien prueba, no del sitio.

Push: `b623230..f08e7a7`, 14 commits, `master` sincronizado con `origin/master`.
