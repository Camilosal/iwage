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
