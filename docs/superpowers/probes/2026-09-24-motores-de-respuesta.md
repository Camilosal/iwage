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
