# Consolidación de medios: un solo cableado, Strapi como único dueño — diseño

**Fecha:** 2026-09-24 · **Repositorio:** `data/app_iwage` · **Precede a:** plan `docs/superpowers/plans/2026-09-24-media-strapi-consolidation.md`
**Depende de (prerequisito, no incluido):** rotación coordinada en el host de la credencial que estaba en texto plano en el repo público. Medido el 2026-09-27: no era una contraseña de admin de Strapi (`up_users` = 0) sino la del rol `admin` de PostgreSQL, compartido con otros proyectos. Los cuatro archivos que la contenían ya fueron scrubados a solo-entorno; lo que sigue abierto es rotarla, que no es decisión de este plan (riesgo 4 y runbook § G0).

## El problema, medido

El censo del 2026-09-24 sobre el sitio vivo (185 URLs del sitemap) y el disco dice que el problema no es la falta de material, es que **nada de lo que existe llega a pantalla**:

| Hecho | Valor | Cómo se reproduce |
|---|---|---|
| Páginas que no renderizan ningún `<img>` dentro de `<main>` | **141 de 185 (76%)** | crawl + parser del 2026-09-24 (`/tmp/iwaudit/`) |
| Páginas con al menos una imagen propia (no genérica, no externa) | **4** | ídem |
| Registros publicados con imagen propia | **1 de 103** | `curl` a cada ficha + inspección del HTML |
| Campos de imagen/audiovisual en Strapi | **41 en 17 content-types**, en 5 representaciones distintas | script sobre `strapi/src/api/*/content-types/*/schema.json` |
| Campos que hoy admiten video | **2 de 41** (`experiencia.galeria`, `experimento.documentos`) | ídem |
| Activos en `public/images` | 99 (80 webp versionados + 19 png **solo en el servidor**, ignorados por `.gitignore:32`) | `git ls-files public/images \| wc -l` |
| Piezas producidas y nunca enlazadas | **56 (≈24.6 MB)**, incluidas las 36 tapas de bitácora | grep de cada ruta en `src/` + `strapi/` |
| Referencias a `strapiImage()` | 53 en 19 archivos | `grep -rn strapiImage src/` |
| URLs de Unsplash como relleno | 16 · hotlinks a `tienda.iwage.co` (dominio muerto) | 5 | `grep -rn unsplash src/` |
| 404 de producción por ruta hardcoded | 5 (`/images/perfiles/*.jpg`) | `curl -o /dev/null -w '%{http_code}'` |

### La cadena causal

1. **Ningún activo propio está en la media library de Strapi**, y aunque se subiera hoy, el navegador no lo alcanzaría: `strapiImage()` (`src/lib/strapi.ts:222-227`) antepone `STRAPI_URL`, que en Docker es `http://iwage_strapi:1337` — un host interno. `nginx.conf:92` ya proxya `/uploads` al contenedor, así que la ruta relativa de sitio funciona sin prefijo. Los tres lugares donde las imágenes *sí* se ven son precisamente los que no llaman a `strapiImage()`.
2. **El volumen de uploads no existe.** `iwage_strapi` no declara `volumes:` en el compose (a diferencia de `reservas_strapi`), y `strapi/public/uploads/` solo tiene `.gitkeep`: lo que se sube se pierde en el próximo rebuild. **(Resuelto el 2026-09-25 al ejecutarse G1: `iwage_strapi` declara `negocio_iwage_strapi_uploads:/app/public/uploads`, la durabilidad se probó leyendo el archivo desde el volumen montado en otro contenedor, y un archivo real servido por `https://iwage.co/uploads/…` respondió 200. Registro y medidas: runbook, sección G1.)**
3. **No hay un solo lugar donde subir.** 41 campos, 5 formas de representar "una imagen": `media` simple (10), `media` múltiple (5), `string` (8), `json` libre (6), y el twin `*_url` pegado a su campo media (3), más 9 strings de audiovisual sin ninguna validación. Un editor no puede adivinar cuál.
4. **Las plantillas leen lo que nadie puede llenar.** `bitacora.imagen` y `producto.imagen` son `string`: no hay dónde escribirlos desde el admin. Y `cafe/visitantes.astro:89` fuerza `imagen: null` sobre 9 registros que sí tienen `visitante-*.webp` producido.
5. **Los fallbacks no se activan.** Strapi responde `200` con `galeria: null`, así que los guardas `if (!res.data.length) throw` nunca disparan: la tarjeta se pinta vacía y el `FALLBACK_PRODUCTOS` de `src/lib/tienda.ts:111-127` no llega al HTML.

Consecuencia operativa: arreglar el paso 1 y 2 sin resolver el 3 deja el mismo desorden con un dueño nuevo. Por eso el diseño ataca la representación, no solo el URL.

## Decisión de diseño

**Un contrato en TypeScript, dos clases de campo en Strapi, migración en cuatro fases desplegables por separado.**

El "formato estándar" vive en el código: un único módulo (`src/lib/media.ts`) y un único componente de galería. En Strapi no puede haber un solo tipo de campo, por una razón física: **un video de YouTube no puede vivir en la media library**. Así que el estándar son dos clases, cada una con un solo trabajo:

- **`media`** → activos propios (foto, video, documento). Sube el editor, Strapi sirve `/uploads/...`.
- **`embed`** → enlaces de terceros (YouTube, Vimeo, tour 360, Drive). String con `format: 'uri'` y allowlist de dominios.

Cualquier otro campo de medios es uno de estos dos disfrazado. Los 41 campos se reducen a: 1 retrato `media` por content-type cuando el tipo tiene portada, 1 `galeria` `media` multiple donde hay conjunto, y `embed_*` donde hay material de terceros.

**Qué queda explícitamente fuera:** el *chrome* de marca (`public/images/hero-*.webp`, `linea-*.webp`) no se mueve a Strapi. Son activos de diseño: cambian con los tokens CSS y tienen que desplegar **atomicamente** con ellos; una foto de hero desacompasada del gradiente y las clases de `BrandLayout` se ve rota. Lo que sí pasa a Strapi es la **foto** del hero de cada página (`hero-configuracion.imagen`, hoy `string`: 39 registros sin dónde subir nada). Editor decide foto; código decide marco.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/media.ts` | **nuevo.** `MediaKind`, `MediaItem`, `toMediaItem`, `toMediaList`, `mediaSrc`, `absUrl`. Único punto de verdad |
| `src/lib/strapi.ts` | pierde `strapiImage()` (se va a `mediaSrc`); gana `try/catch` o `safeStrapiFetch` |
| `src/lib/heroes.ts` | `try/catch` en `getHeroes`/`getHeroBySlug`/`getHeroesByPrefix`; `imagen` pasa por el contrato |
| `src/components/shared/MediaGallery.astro` | **única** galería: acepta `MediaItem[]`, lightbox, video, tour 360 |
| `src/components/shared/ProductGallery.astro` | **se borra** (2 consumidoras migran) |
| `src/lib/{tienda,proyectos,polinizacion}.ts` | pierden su copia local del tipo de galería |
| `src/lib/{cafe,naturaleza,tierras,gestion,granja-experimentos}.ts` | pierden fallbacks de imagen y reglas por nombre |
| `src/components/Hero.astro` | props `poster`/`embed` además de `imagen`; caso sin imagen deja de ser negro plano |
| `strapi/src/api/*/content-types/*/schema.json` | 41 campos → retrato/galería/embed canónicos |
| `strapi/scripts/media-import.mjs` | **nuevo, idempotente por checksum:** sube los huérfanos y enlaza por slug |
| `tests/media.test.mjs` | contrato: normalización, dedupe, resolución de URL |

## El contrato

```ts
export type MediaKind = 'imagen' | 'video' | 'tour360';

export interface MediaItem {
  url: string;                                   // '/uploads/...' o https:// externo
  kind: MediaKind;
  alt?: string;
  caption?: string;
  provider?: 'strapi' | 'youtube' | 'vimeo' | 'drive';
}
```

Tres funciones, sin estado:

- `toMediaItem(input)` — acepta un objeto media de Strapi, un string, o las formas viejas (`GaleriaItem`, `GalleryItem`). Devuelve `null` si no hay URL utilizable. `kind` se deriva del `mime` de Strapi o del dominio del embed.
- `toMediaList(input)` — mapea, descarta nulos y **deduplica**. Clave: si el host es `iwage.co` o el interno de Strapi, se reduce a `pathname`; se eliminan `?query` y `#fragmento`. El primero gana y conserva la metadata más rica. Esto es lo que hace que "sin repetidos" sea una propiedad del sistema y no una tarea manual.
- `mediaSrc(item | string | null)` — **nunca** antepone `STRAPI_URL`. `/uploads/...` queda relativo de sitio (nginx lo resuelve), `/images/...` igual, `http(s)://` intacto.

**La trampa que hay que cerrar el mismo día:** `og:image`, `twitter:image` y `image` en JSON-LD exigen URL **absoluta**; `/uploads/x.webp` ahí no funciona. Por eso existe `absUrl(src)`, basado en `APP_URL`, aplicado en `BrandLayout.astro:171-172,199,214`. Sin este par de funciones, arreglar el `<img>` rompe los previews sociales — es un retroceso silencioso.

`MediaGallery` se queda con lo bueno de las dos implementaciones actuales: el soporte de Vimeo de `ProductGallery.astro:32-45` (hoy ausente en `MediaGallery`) y el lightbox de `MediaGallery`. Se borra el `Math.random()` de `ProductGallery.astro:49` (id inestable entre render de servidor y cliente) y se arregla `MediaGallery.astro:105`, que hoy emite `src=""` literal cuando el primer elemento no es imagen.

## Modelo en Strapi

Los 41 campos de hoy, y en qué se convierten:

| Hoy | # | pasa a |
|---|---|---|
| `media` simple con `allowedTypes:["images"]` | 10 | igual, y se les añade `videos` solo donde el concepto lo admite (portada de experiencia) |
| `media` multiple (`paquete.imagenes`, `propiedad.imagenes`, `propiedad-gestion.galeria`, `experiencia.galeria`, `experimento.documentos`) | 5 | nombre canónico `galeria`, `allowedTypes: ["images","videos"]` |
| `string` que debería ser media (`bitacora.imagen`, `producto.imagen`, `lote-miel.imagen`, `experimento.imagen`, `cultivo-polinizacion.imagen`, `proyecto-meliponario.imagen`, `hero-configuracion.imagen`, `anfitrion.foto_territorio`) | 8 | `media` simple |
| `json` libre (`producto.galeria`, `lote-miel.galeria`, `cultivo-polinizacion.galeria`, `proyecto-meliponario.galeria`, `anfitrion.galeria_fotos`, `experiencia.galeria_urls`) | 6 | `galeria` media multiple; los valores externos que aún sirvan se migran a `embed_*` |
| twins `*_url` (`complemento.imagen_url`, `experiencia.imagen_hero_url`, `anfitrion.foto_perfil_url`) | 3 | **se borran**: su homólogo media ya existe |
| strings audiovisuales (`video_url` ×3, `tour_360_url`, `tour_virtual_url`, `link_drone` ×2, `video_thumbnail`, `mapa_imagen_url`) | 9 | `embed_video` / `embed_tour` con `format:'uri'` + allowlist; `link_drone` se fusiona con `embed_tour`; `video_thumbnail` se deriva o se borra; `mapa_imagen_url` se borra (zero UI) |

Nomenclatura: retrato = `imagen_principal` / `foto` donde ya existe y está poblado; no se impone un nombre universal en esta fase porque el costo (renombrar 10 campos poblados + sus `fields[]` y `populate[]`) no compra nada que el contrato no compre ya. Lo que **sí** se unifica de verdad es el tipo de campo y la forma en que el código lo lee.

> Corrección medida (2026-09-25): las **diez** columnas que toca el Grupo A+B de la Tarea 11 (`bitacoras.imagen`, `productos.imagen/galeria`, `proyecto_meliponarios.imagen/galeria`, `cultivo_polinizacions.imagen/galeria`, `lote_miels.imagen/galeria`, `experimentos.imagen`) están **vacías** en la BD en vivo (`count` con el filtro válido para `jsonb`: 0 no nulas y 0 publicadas). Aparte está el rename `anfitriones.galeria_fotos` → `galeria`, que sí tenía **2 filas publicadas con 3 hotlinks de Unsplash**. El argumento del "costo de renombrar" era más chico de lo que decía esta línea; la decisión se mantiene por la razón verdadera: renombrar un campo en Strapi **le borra la columna al arrancar** (ver el gate F2→F3 del plan), así que un rename es una migración de datos, no una cosmética.

## Caída de fallbacks

Se eliminan, no se ajustan (decisión: **Strapi único dueño, sin fallbacks de imagen**):

- `FALLBACK_PRODUCTOS` (`src/lib/tienda.ts:111-127`, 15 productos, 11 con `imagen: null` y 4 apuntando al mismo archivo de un dominio que responde `000`).
- Los 6 proyectos con rutas hardcoded de `src/lib/proyectos.ts:130-278`, ya suplantados por Strapi.
- `LOCAL_IMAGES` y las 16 reglas por nombre de `src/lib/cafe.ts:232-268`. **Ojo con el orden:** hoy ese es el único mecanismo que pinta las 19 imágenes del menú de café, que sí existen y están versionadas. Se elimina en **F2, después** de poblar `item-menu.imagen` en Strapi — no en F1. Lo mismo aplica a `visitantes.astro:89`: primero se quita el `imagen: null` forzado, después se borra el seed.
- Las 16 URLs de Unsplash (`src/lib/naturaleza.ts:498-522`) y los 5 hotlinks a `tienda.iwage.co`.
- Las 5 rutas muertas de `src/pages/tierras/perfiles/index.astro:22-66` (`/images/perfiles/*.jpg` → 404 en producción).
- El `imagen: null` forzado de `src/pages/cafe/visitantes.astro:89`, que devuelve 9 registros que sí tienen foto producida.
- El badge permanente "Imagen de referencia" de `src/pages/tierras/perfiles/index.astro:154`.

**Sin fallback ≠ sin tolerancia.** Con Strapi caído, la tarjeta muestra el mosaico Icon que ya existe (`ProductCard.astro:51-63`) y la página responde 200. Eso hoy **no** es cierto: `strapiFetch` lanza (`src/lib/strapi.ts:149`) y `heroes.ts:71-100` no captura, así que una caída de Strapi es un 500 en las 40 páginas con hero. El `try/catch` es parte de esta decisión, no un extra.

## Cablear lo ya producido

`media-import.mjs` sube los huérfanos a la media library (idempotente por checksum, para poder re-ejecutarlo sin duplicar) y los enlaza por slug. El bloque cierto y medido son las **36 tapas de `public/images/bitacora/`**: hoy cero códigos leen ese directorio, y son 56 bitácoras publicadas. Detrás van, en este orden, los 4 `proveedor-*.webp`, los 9 `visitante-*.webp`, las 11 fotos de `public/images/galeria/` y las 19 webp de `cafe-menu/` — estas últimas solo se considerarán huérfanas en el instante en que cae `LOCAL_IMAGES`, así que su migración a `item-menu.imagen` es el paso previo obligatorio, no posterior. El resto de la lista se fija caso a caso con el reporte del inventario en F2, no de memoria.

Orden obligatorio: **primero cablear, después borrar.** Los 19 png duplicados (28.2 MB) no están en git (`.gitignore:32`): existen solo en el servidor, así que su borrado es una operación de despliegue, no de repo, y su lista se regenera al final de F3 con cero referencias verificadas.

## Audiovisual

Hoy: 0 activos propios, los enlaces de video de la BD apuntando a material ajeno (el listado exacto de registros sale de la consulta de F3, no de memoria) y los slots audiovisuales del esquema vacíos. La única etiqueta `<video>` del repositorio está dentro de un comentario JSX (`src/pages/meliponas/index.astro:152-166`) con `poster` a un archivo que sí existe pero `<source>` a `/videos/meliponario.*`, un directorio que no existe — mientras el copy de la línea 148 promete "sonido".

`Hero.astro:4-22` no tiene ninguna props de video, así que "audiovisual en la ficha" requiere el campo `embed`/`poster` del contrato, no solo subir el archivo. F3 decide, con el dueño, si la banda de meliponario se construye o se borra el bloque; en ambos casos el copy de "sonido" deja de prometer lo que no hay.

## Fases

Cada fase se despliega sola y se revierte sola. El orden importa: F0 es lo que hace que lo demás sea visible.

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **F0** | Volumen `public/uploads` en `iwage_strapi` + backup junto a los dumps de Postgres · `mediaSrc` relativo de sitio + `absUrl` para OG · `try/catch` en `heroes.ts` · `src=""` de `MediaGallery.astro:105` · hero sin imagen de `Hero.astro:46-54` | Un activo subido al admin se ve en el sitio; con Strapi detenido, las 40 páginas con hero responden 200 |
| **F1** | `src/lib/media.ts` · `MediaGallery` única · se borra `ProductGallery` y las 4 copias del tipo · dedupe · caída de los fallbacks **salvo** `LOCAL_IMAGES`/`itemImage()` | `grep -r strapiImage src/` vacío; `npm test` de contrato en verde; build sin errores |
| **F2** | Esquema de los 41 campos · `media-import.mjs` y enlace de los huérfanos · allowlist en los `embed_*` · recién aquí cae `LOCAL_IMAGES` y las 16 reglas por nombre | Cada content-type con portada tiene exactamente un campo editable de portada; las 36 bitácoras muestran su tapa; el menú de café no pierde ninguna imagen al migrar |
| **F3** | Borrado de los 19 png y de los slots muertos (`fotos_evidencia` en `tierras/propiedades/[slug].astro:208-209`, `mapa_imagen_url`) · decisión sobre la banda de video · reemplazo de los enlaces a material ajeno que liste la consulta | 0 rutas de imagen rota en el crawl; 404 de producción en 0 |

## Pruebas y métrica de aceptación

- `node --test` sobre `src/lib/media.ts` (el runner del repo es `node --test tests/*.test.mjs`): `toMediaItem` con las 4 entradas posibles, dedupe entre `/uploads/x`, `https://iwage.co/uploads/x` y `http://iwage_strapi:1337/uploads/x`, `mediaSrc` sin prefijo interno, `absUrl` para OG.
- Test de contrato fallido si algún archivo de `src/` vuelve a importar `strapiImage` (evita la regresión por inercia en 53 llamadas).
- Prueba de resiliencia: Strapi detenido → las 40 páginas con hero y los 4 índices con `FALLBACK_*` eliminado responden 200 con mosaico Icon.
- **La métrica es el mismo censo, antes y después**, con el crawler del 2026-09-24 sobre las 185 URLs:

| | antes | objetivo F3 |
|---|---|---|
| Páginas sin ningún `<img>` en `<main>` | 141 | ≤ 85 |
| Páginas con ≥1 imagen propia | 4 | ≥ 100 |
| Registros publicados con imagen propia | 1 / 103 | ≥ 90 / 103 |
| Activos en la media library de Strapi | 0 | ≥ 56 |
| 404 de producción por imagen | 5 | 0 |
| Representaciones de "imagen" en el esquema | 5 | 2 (`media`, `embed`) |

El objetivo de ≥100 no es una aspiración, es una suma con origen: 36 bitácoras con tapa + 39 heroes de ruta + los listados que montan tarjetas con imagen propia (productos, experiencias, propiedades, proveedores, visitantes, proyectos). Da ~115 páginas sobre 185; se deja margen y **se recalibra al cerrar F2 con el conteo real de registros poblados**, porque las tres fuentes dependen de datos que se llenan en esa fase.

Que queden ~70 páginas sin imagen es correcto y no es una deuda: legales, ayuda, índices vacíos y páginas de texto. La métrica que importa es que baje de 141 y que ninguna página que *debería* tener imagen la tenga rota o rellena con Unsplash.

## Riesgos y coordinación

1. **La media library no es durable hoy.** Sin el volumen de F0, consolidar en Strapi es echar agua en un balde sin fondo. F0 no es negociable ni postergable. **(Cerrado el 2026-09-25: G1 montó `negocio_iwage_strapi_uploads` en `/app/public/uploads` y la durabilidad se midió, no se supuso. El riesgo que sigue vivo es el del riesgo 2 y las puertas G2/G3, que son los datos.)**
2. **Cambiar `imagen: string` a `media` vacía el valor existente** en los registros que ya tienen algo escrito en ese string (pocos, pero hay que volcarlos antes con el script de import, no después).
3. **El tree tiene escritura concurrente.** Este 2026-09-24 hay cambios sin commitear de otro flujo en `src/layouts/BrandLayout.astro`, `src/lib/schema-bitacora.ts`, `src/pages/index.astro` y `tests/schema-bitacora.test.mjs` (refactor de JSON-LD). F0 toca `BrandLayout.astro` (es donde van las `absUrl` de OG). Regla: nunca `git add -A`; revisar `git status` antes de cada edición y coordinar o hacer el trabajo en worktree aislado.
4. **Credenciales — corregido por medición el 2026-09-27: lo publicado no era una contraseña de admin de Strapi.** `reimport_products.py` (raíz, versionado) más `strapi/scripts/{seed-heroes-pg,sync-experiencias,sync-propiedades}.mjs` tenían en claro la contraseña del rol **`admin` de PostgreSQL**, que en este host es superusuario del clúster compartido (`sostenibilidad_db`, 16 bases) y ese mismo literal se repite en 15 contenedores de otros proyectos. En `up_users` hay **0** filas: no existe ningún usuario de panel en este Strapi, así que "rotar la contraseña de admin de Strapi" era una instrucción imposible de ejecutar tal como estaba escrita. Lo que sí se hizo el 2026-09-27: los cuatro archivos leen solo del entorno y abortan si falta; `tests/no-credenciales-en-repo.test.mjs` bloquea que el valor (o cualquier cadena de conexión/Bearer/apikey literal) vuelva a entrar al repo; y se creó un rol propio `iwage_app` (sin superuser) para la conmutación. La rotación del valor publicado es decisión del host, no de este plan, y sigue abierta: ver runbook `docs/superpowers/runbooks/2026-09-25-gates-de-medios.md` § G0. Reescribir el historial de git no es el arreglo — el valor ya estuvo publicado; lo que cierra el riesgo es rotarlo y que nada nuevo lo escriba.
5. **`populate-galerias.sql` apunta a tablas de Strapi, no de Flask — corregido por medición (2026-09-25).** `UPDATE proyecto_meliponarios` / `productos` / `cultivo_polinizacions` son las tablas vivas de Strapi v5 (existen en la BD con `published_at`). Lo que sí es cierto: **ese contenido nunca llegó**, medido con la comprobación válida para `jsonb` (`count(galeria)`, no comparar contra `''`): 0 no-nulas en las cuatro tablas con galería. La razón operativa del retiro cambia y queda mejor: el script escribe JSON crudo en la columna por `id` de fila, sin API y sin `publish` — el mecanismo de dispersión que este plan elimina, no un residuo de otra app. Se retira en F3 con la receta de recuperación en el commit, porque sus dos elementos de video (`populate-galerias.sql:8` = un video real de meliponas; `:27` = el mismo rickroll `dQw4w9WgXcQ` que vive en `experiencias.video_url`) son el único registro del intento editorial.

## Fuera de alcance

Producir material nuevo (sesión de fotos, videos de campo, tours 360): este diseño deja los canales listos y medibles; el relleno de los ~68 huecos que cuantificó el censo es la fase siguiente. Tampoco: CDN para uploads, transformaciones automáticas de Strapi, ni migración de la media a un provider externo (S3/R2) — el contrato `MediaItem` no cambia si algún día se hace.
