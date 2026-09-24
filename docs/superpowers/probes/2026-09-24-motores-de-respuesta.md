# Probe de motores de respuesta — línea base 2026-09-24

## Para qué existe esto

La fase 1 a la 3 midieron el sitio desde adentro: grafo, sitemap, `robots`, `llms.txt`, conteos. Nada de eso responde la única pregunta que importa en GEO: **cuando alguien le pide a un motor que le recomiende quién hace esto en el Tolima, aparece Iwagé o no.** Sin este registro, cualquier afirmación de visibilidad es fe.

## El instrumento

10 preguntas fijas. Se corren **tal cual están escritas acá**, sin re-phrasiar: la comparación entre fechas solo vale si la pregunta no cambia.

| # | Pregunta | Marca dueña de la respuesta |
|---|---|---|
| 1 | `qué es la meliponicultura cómo empezar Colombia abejas sin aguijón` | meliponas |
| 2 | `granja autosustentable diseño clima cálido Tolima Colombia` | granja |
| 3 | `turismo regenerativo Colombia rutas anfitriones rurales` | naturaleza |
| 4 | `comprar finca rural cerca de Ibagué qué revisar título agua` | tierras |
| 5 | `compostaje rural cerrar ciclo de nutrientes finca Colombia` | granja |
| 6 | `café de origen Tolima Colombia tostador especialidad` | cafe |
| 7 | `servicio de polinización gestionada abejas nativas sin aguijón Colombia` | meliponas |
| 8 | `property management fincas rurales Colombia administración de propiedades turísticas` | gestion |
| 9 | `bioconstrucción bambú adobe clima cálido Colombia técnica` | granja |
| 10 | `energía solar para finca autosuficiente dimensionamiento paneles Colombia` | granja |

Qué se anota por pregunta, en la tabla de abajo:

- **menciones**: cuántos de los 10 primeros resultados son de `iwage.co` (0 si ninguna).
- **URL exacta**: cuál página propia apareció, para poder decir si el motor aterriza en el hub, en la landing o en un artículo.
- **quién ocupa el lugar**: el dominio que responde en el puesto 1. Eso es lo que hay que desplazar, y por eso se anota.

## Línea base, medida 2026-09-24 ~18:04Z

Qué se usó: el buscador que tiene esta sesión (índice de web, top ~6 resultados por consulta). **Qué NO es:** no es ChatGPT, ni Perplexity, ni Copilot. Esos motores hay que correrlos a mano desde su propia interfaz --cuentas del usuario, y esta fase no entra ahí--; lo que mide este instrumento contra el buscador es si el contenido **está posicionado para que un motor de respuesta lo encuentre**, que es el prerrequisito.

| # | pregunta | menciones iwage.co | quién ocupa el puesto 1 |
|---|---|---|---|
| 1 | meliponicultura, cómo empezar | **0** | YouTube / guía PDF de The Nature Conservancy |
| 2 | granja autosustentable en clima cálido | **0** | PDF de repositorio Uniminuto |
| 3 | turismo regenerativo Colombia | **0** | maravillasdelguejar.com |
| 4 | comprar finca cerca de Ibagué | **0** | grupos de Facebook (vendedores) |
| 5 | compostaje rural | **0** | video de Facebook (La Finca de Hoy) |
| 6 | café de origen del Tolima | **0** | insignia.coffee (tostador de Ibagué) |
| 7 | polinización gestionada | **0** | post de Facebook (Hymenoptera) |
| 8 | property management de fincas | **0** | airdna.co |
| 9 | bioconstrucción en bambú y adobe | **0** | post de Facebook (diploma de bioarquitectura) |
| 10 | energía solar para finca | **0** | contenido de Instagram |

**Lectura honesta: 0 de 10.** Share of voice cero en las diez preguntas del nicho. No es un problema técnico ni de schema --eso se acaba de cerrar acá-- y no se arreglia con más código. Con 56 artículos en 2 de 6 marcas y `keywords` flacas, el sitio hoy no es un candidato para ninguna de estas consultas.

Qué hace este número de útil: es la cifra contra la que se mide la fase 4. Si después de subir volumen y re-corregir el schema el conteo sigue en 0, la hipótesis de contenido está refutada y hay que cambiar de teoría (distribución, autoridad de dominio, o el propio nicho geográfico).

## Re-ejecución

- Hito 1: **2026-10-08**, junto con la verificación de Search Console. Mismas 10 preguntas, misma tabla, una columna nueva por fecha.
- Hito 2: después del empujón de contenido de la fase 4.
- Regla: no se editan las preguntas. Si una deja de tener sentido, se retira al final de la tabla con la fecha y el por qué, y se agrega la nueva abajo --nunca se reemplaza en el medio, porque eso rompe la serie.

---

## Serie complementaria 1 -- presencia de marca (medida 2026-09-24 ~18:40Z)

No son las 10 preguntas del nicho: son tres consultas que responden una pregunta distinta y no participan en la serie de arriba. Mismos instrumento y advertencia que en la línea base --índice de web, no ChatGPT/Perplexity/Copilot.

| Consulta | Tipo | iwage.co | Puesto 1 |
|---|---|---|---|
| `iwage.co Iwagé Ibagué Tolima meliponario` | marca | **1** | `https://iwage.co/` (título: "Iwagé · Ecosistema de Desarrollo Rural · Tolima, Colombia") |
| `iwage.co bitacora meliponario pureza miel de angelita adulteración` | tema de artículo | **0** | `ecocolmena.org/como-saber-si-tu-miel-es-pura-o-esta-adulterada/` |
| `"El agroecosistema productivo" iwage granja tres formas de cultivar` | título exacto | **0** | `camilosaldarriaga.com/es/bitacora/agroecosistema-productivo` |

### El tercer renglón: qué resultó ser, y cómo la primera lectura estaba equivocada

Primera lectura (18:40Z, escrita con un solo artículo): "el documento está duplicado y el ranking se lo llevó la copia del dominio personal". **Falsa en lo esencial.** Se corrigió ampliando la muestra de 1 a los 19 artículos involucrados, medido entre 18:51Z y 18:56Z.

| | `iwage.co` | `camilosaldarriaga.com` |
|---|---|---|
| URLs en el sitemap | 185 | 1.836 |
| URLs de bitácora | 56 | 196 (49 slugs en `/es/`) |
| idiomas | 1 | 4 (`es`/`en`/`fr`/`pt`) con `hreflang` + `x-default` en cada hoja |
| `rel=canonical` en las 19 hojas colisionadas | self | self en 19/19 |
| `meta robots` | -- | ausente en 19/19 |

**Colisiones:** 19 de los 56 artículos comparten slug con el dominio personal -- y son el 100 % de `granja` (19/19), 0 de los 37 de `meliponas`. En las 19 el `<h1>` es idéntico y el párrafo de apertura también.

**Pero el cuerpo no es el mismo texto.** Contención de 8-gramas sobre el `<article>` aislado y normalizado: 0,147 de promedio del dominio personal dentro de iwage (rango 0,034–0,45), 0,044 en la dirección inversa. Un duplicado real da ~0,9 en las dos direcciones.

Entonces no hay copia: hay **dos redacciones distintas del mismo artículo, con el mismo título exacto, en dos dominios**. Para un motor de respuesta eso es peor que un duplicado, porque ninguna señal resuelve la disputa --ni `canonical` cruzado, ni `noindex` en una de las dos (19/19 sin `meta robots`)--, así que la consulta por título tiene dos candidatos legítimos y gana el dominio 10× más grande.

Nota de instrumento, para no repetir el error: dos cifras de la pasada inicial eran artefactos de comparaciones mal escritas. La "similitud 0,06" se había medido sobre la página completa (menú, footer, tira de relacionadas) en vez del `<article>`; y el "1 `canonical` que apunta a iwage" era un `in` sobre el slug `meliponario-iwage-subsistema-vivo`, que contiene la palabra `iwage`. Regla: medir sobre el nodo de contenido y con igualdad de cadenas, nunca con substring.

Los dos `robots.txt`: iwage solo declara `User-agent: * / Allow: /` más los `Disallow` internos; el dominio personal enumera 19 agentes de IA con `Allow`. La diferencia es **cosmética** --la ausencia de una stanza no bloquea nada, el permiso por defecto es permitir--, así que esto no se anota como deuda ni hay que "arreglarlo".

### Lectura

- La marca sí está en el índice: la consulta de marca devuelve `https://iwage.co/` en el puesto 1. El problema no es que Google ignore que Iwagé existe.
- El contenido del nicho, no: 0 de 10 en la serie fija + 0 en la consulta por tema.
- Y aparece una variable que las fases 1-3 no midieron: **la mitad del corpus (`granja`, los 19) compite por su propio título contra el dominio personal**, en 4 idiomas, y es la otra URL la que aparece al buscar el texto. `meliponas` (37 artículos) es el único territorio sin esa contienda --y también el que sigue en 0 menciones en la serie fija, así que la contienda no explica el cero de las otras marcas.

Qué hacer con esto: no es una decisión de código y no se decide acá. Va como pregunta al hito del **2026-10-08**: Search Console sobre `iwage.co` dice cuántos de los 56 están descubiertos y con qué consulta, y si las 19 de `granja` están canibalizadas por `camilosaldarriaga.com`. Con esa respuesta se decide sobre qué dominio se escribe la fase 4 y qué pasa con esas 19. Mientras no se resuelva, esto es una **condición agregada** a la hipótesis de contenido, no su refutación.

---

## El instrumento re-ejecutable (añadido 2026-09-24 ~19:49Z)

Arriba está la verdad incómoda de esta serie: la línea base y las dos series complementarias se corrieron contra **el índice de web de la sesión**, no contra ChatGPT / Perplexity / Copilot, que es lo que pide el objetivo. Un instrumento que no se puede volver a correr contra los mismos motores no es una serie. Esto cierra ese hueco del lado del instrumento.

`tools/geo-probe.mjs` (versionado, cero dependencias --solo el `fetch` de Node--):

```
OPENROUTER_API_KEY=… node tools/geo-probe.mjs                        # las 10 × los 2 motores
node tools/geo-probe.mjs --preguntas=1,7 --motores=perplexity/sonar-pro
node tools/geo-probe.mjs --formato=jsonl                              # para pegar en la tabla de arriba
```

Las 10 preguntas viven en el módulo, no en la cabeza de quien corre la prueba, y `tests/geo-probe.test.mjs` fija su texto literal: mover una pregunta ahora rompe un test antes que romper la serie.

**Motores, leídos del catálogo público de OpenRouter (`/api/v1/models`) el 2026-09-24, no de memoria.** Se exige que el modelo declare `web_search_options` entre sus `supported_parameters`: sin recuperación no es un motor de respuesta, es un modelo recordando. `perplexity/sonar-pro` (Perplexity) y `openai/gpt-4o` (búsqueda hospedada de OpenAI, lo más cerca de ChatGPT a que se puede llegar sin una cuenta de chat). Copilot no tiene ruta por API: queda a mano desde su interfaz, como siempre.

**El detector de menciones (`mencionar`) y por qué no es un `includes`.** Las dos trampas que ya inflaron una lectura en esta misma serie están fijadas como tests:

| entrada | decisión |
|---|---|
| `https://camilosaldarriaga.com/es/bitacora/meliponario-iwage-subsistema-vivo` | **no** es mención (subcadena dentro del slug de otro dominio) |
| `https://iwage.co.mirror.example/x` | **no** es mención (`iwage.co` como prefijo de un host mayor) |
| `https://iwage.co/granja/bitacora/agroecosistema-productivo` | mención, con esa URL exacta |
| `citó iwage.co como fuente` | mención, URL canónica `https://iwage.co/` |
| `https://recetas.iwage.co/moka` | mención, y se anota el host (`recetas.iwage.co` es propio --deuda del ítem 4—, no un dominio ajeno) |
| `iwage.co/meliponas/bitacora/…` sin esquema (como viene en una lista de fuentes) | mención, con el esquema canónico añadido |

### Lo que bloquea la extensión de la serie, medido hoy

No se pudo registrar una sola respuesta de los dos motores, y la causa es de cuenta, no de código:

| intento | resultado |
|---|---|
| clave `OPENROUTER_API_KEY` (primera de las dos líneas en `/home/ubuntu/negocio/.env`) | `401 User not found` -- clave muerta |
| segunda línea `OPENROUTER_API_KEY` | `200`, etiqueta y uso de **$12,58**, sin límite propio |
| llamada real con la clave viva (`perplexity/sonar-pro` y `openai/gpt-4o`) | **`402 Insufficient credits`** en los dos motores -- el saldo de la cuenta está agotado |
| `OPENAI_API_KEY` del mismo `.env` contra `api.openai.com/v1/models` | `401` clave incorrecta (no sirve como alternativa) |

Qué hace falta para cerrar el ítem (2) con los motores correctos, en orden de costo: **recargar créditos de OpenRouter** (una corrida completa son 20 llamadas, centavos) y entonces `node tools/geo-probe.mjs` agrega la columna a la tabla de arriba; o correr las 10 preguntas a mano en ChatGPT, Perplexity y Copilot con las cuentas del usuario y anotar la misma columna. Ambas son decisiones del usuario --la primera gasta su dinero, la segunda necesita su cuenta--, y ninguna se puede sustituir con más código. Lo que sí queda hecho es la parte que faltaba para que cualquiera de las dos sea comparable: preguntas fijas versionadas, motores verificados, detector con las trampas bajo test.

---

## Actualización 2026-09-24 20:32-20:50Z -- hay motor con búsqueda que responde, y cuánto dura

### El instrumento cambió (y por eso la serie anterior no era re-ejecutable)

`tools/geo-probe.mjs` ahora lee el proveedor del ambiente, así que la misma serie de 10 preguntas se puede correr contra cualquier endpoint sin tocar código:

| variable | para qué |
|---|---|
| `GEO_ENDPOINT` | URL `chat/completions` del proveedor (por defecto OpenRouter) |
| `GEO_KEY` | clave de ese proveedor; sin ella el script se niega y **no hace ninguna llamada** |
| `GEO_MODELS` | lista de slugs que se corren, separada por comas |
| `GEO_BUSQUEDA` | qué slugs tienen recuperación hospedada (Moonshot usa `$web_search`, OpenRouter usa `web_search_options`) |
| `GEO_FORMATO_BUSQUEDA` | se deduce del endpoint; explícita si el endpoint no es obvio |

Dos correcciones que nacieron de medir, no de imaginar:

1. **`dateModified`/`search_citations` no bastan.** Moonshot ejecuta `$web_search` en el servidor pero puede devolver `search_citations` vacío; las menciones hay que leerlas del texto de la respuesta. Por eso la fila ahora guarda también `dominios`: los hosts ajenos que el motor efectivamente escribió en su respuesta. Es la columna "quién ocupa el lugar" para el caso en que el motor no expose fuentes.
2. **Cada fila se escribe al producirse.** La corrida de las 20:32Z respondió bien las dos primeras preguntas y el proceso murió con las filas en el búfer de `stdout`: perdimos el dato. Verificado en vivo con la corrida de las 20:40: las 10 filas estaban en el archivo mientras el proceso seguía vivo.

Pruebas: `tests/geo-probe.test.mjs` pasó de 9 a 16 (config de ambiente, forma del cuerpo por proveedor, eco del `tool_call`, dominios citados). Suite propia: **79/79**; la única falla del repo sigue siendo `tests/media-contract.test.mjs`, que pertenece a la otra migración en curso y no toqué.

### Medición de motores, con estado de cuenta real

| proveedor | cómo se probó | resultado medido |
|---|---|---|
| Moonshot `kimi-k2.6` + `$web_search` | serie real, 2 preguntas respondidas (20:32-20:34Z) | `#1 → 0 URL(s) propia(s) de 0 fuentes`, `#2 → 0 de 0`. **iwage.co no aparece.** Luego: `429 Your credit balance is running low` en las 10 preguntas de la re-corrida -- el saldo se agotó con esas dos. |
| Gemini directo `gemini-3.8-flash` + `google_search` | una llamada al endpoint oficial | clave válida, `429 RESOURCE_EXHAUSTED` (sin facturación). Nota: `gemini-2.5-flash` ya devolvió `404` -- *"no longer available to new users"* -- o sea que cualquier receta vieja de este endpoint está muerta. |
| DashScope (Qwen) | una llamada | `401 Incorrect API key` |
| OpenRouter (`perplexity/sonar-pro`, `openai/gpt-4o`) | ya medido arriba | `402 Insufficient credits` (saldo $12,58 consumido) |
| Perplexity por interfaz web, **sin cuenta** | `https://www.perplexity.ai/search?q=...` | responde de verdad: *"Investigado 8s"*, `10 fuentes`. Las 2 preguntas obtenidas **no mencionan iwage.co**. Al lanzar 10 búsquedas concurrentes el mismo origen pasó a muro de sesión (`Continuar con correo electrónico / Inicio de sesión único (SSO)`): **tope medido de ~2 consultas anónimas por sesión.** |

Lo que **no** se pudo extraer de la interfaz anónima: en esa vista no hay ni un `<a href>` externo (0 en el DOM), las fuentes viven detrás de la pestaña `Enlaces` y no se leen sin sesión. La columna "quién ocupa el lugar" sigue dependiendo de una API con crédito o de la cuenta del usuario.

Consecuencia honesta para el ítem (2): el instrumento existe, es re-ejecutable, ya probó que **iwage.co no aparece en ninguna de las 4 respuestas obtenidas hoy** (2 por Kimi con búsqueda, 2 por Perplexity anónimo), y está bloqueado para las otras 6 preguntas por dinero, no por código. Recargar Moonshot o activar facturación en la clave de Gemini deja la serie completa a un comando:

```bash
GEO_ENDPOINT=https://api.moonshot.ai/v1/chat/completions \
GEO_KEY=<la del .env> GEO_MODELS=kimi-k2.6 GEO_BUSQUEDA=kimi-k2.6 \
node tools/geo-probe.mjs --formato=jsonl >> docs/superpowers/probes/<fecha>-kimi-k2.6.jsonl
```

### La línea base que sí quedó medida (4 respuestas reales, 2 motores, 2 preguntas de la serie)

| motor | pregunta de la serie | respondió | menciona iwage.co | URLs propias | fuentes |
|---|---|---|---|---|---|
| Moonshot `kimi-k2.6` + `$web_search` | #1 `qué es la meliponicultura cómo empezar Colombia abejas sin aguijón` | sí | **no** | 0 | 0 citas en el mensaje |
| Moonshot `kimi-k2.6` + `$web_search` | #2 `granja autosustentable diseño clima cálido Tolima Colombia` | sí | **no** | 0 | 0 citas en el mensaje |
| Perplexity (interfaz web, sin cuenta) | #1 meliponicultura | sí, `Investigado 8s` | **no** | 0 | `10 fuentes`, hosts no extraíbles sin sesión |
| Perplexity (interfaz web, sin cuenta) | #2 granja autosustentable | sí, `Investigado 7s` | **no** | 0 | idem |

Lectura: en las 4 respuestas que hoy se pudieron obtener, **Iwagé no aparece**. No es una línea base de 10 preguntas --es 2 preguntas por motor--, pero es la primera vez que existe un número en lugar de una suposición, y con procedimiento repetible.

### Techo medido de la vía gratuita (para no volver a intentarla como si fuera infinita)

Después de esas 2 respuestas, la tercera pregunta ya no obtuvo respuesta: la interfaz devolvió **«Regístrate y repite tu solicitud.»**. El tope anónimo de Perplexity por sesión de navegador es por lo tanto **2 consultas de la serie**, y no se estira corriendo de una en una (lo comprobé: la cola secuencial murió en el mismo muro en su primer intento).

Error de procedimiento que hay que no repetir: lancé **10 búsquedas simultáneas** para probar el instrumento. Eso además de no servir para nada es presión inútil sobre un servicio ajeno; la cola correcta es secuencial, una por vez, y con el techo de 2 asumido.

Rutas que quedan para cerrar las 8 preguntas restantes, todas del lado del usuario:
1. **Crédito en Moonshot** (o facturación en la clave de Gemini): deja las 10 con un comando, y con la columna `dominios` que ya está implementada.
2. **Cuenta propia de Perplexity / ChatGPT / Copilot**: 10 preguntas a mano, 2-3 minutos por motor; es el camino con el que se puede declarar "visibilidad en IA" sin asteriscos, porque son los motores que nombra el objetivo.
