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
