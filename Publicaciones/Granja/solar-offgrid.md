---
id: N-036
audiencia_primaria:
  - Inversores
  - Makers/DIY
audiencia_secundaria: ""
categoria: [Subsistemas Iwagé — Detalle de Diseño]
creado: ""
documentId: etf1isbwzjp6t5rjixqczxcc
formato: ""
nombre: "Sistema solar off-grid: sin red, con todo lo que necesitas"
pregunta_central:
  - CQ-TS-003
  - CQ-TS-011
procedencia: Experiencia propia
pubDate: ""
serie: Iwagé — Sistema Autosustentable
slug: solar-offgrid
status: 🌳 Validado
strapi_audiencia_primaria:
  - inversores
  - makers
strapi_description: Este nodo explica cómo se dimensiona realmente un sistema off-grid para una granja con automatización, qué dice exactamente la Ley 1715 sobre cada uno de sus cuatro beneficios, dónde están los riesgos reales de aplicarla mal, y qué significa
strapi_estado: 🌱 Semilla
strapi_formato: Nodo del jardin
strapi_graph_slug: solar-offgrid
strapi_id: 5253
strapi_orden: 0
strapi_procedencia: Experiencia propia
strapi_pubDate: "2026-07-10T05:00:00.000Z"
strapi_serie: Iwagé — Sistema Autosustentable
strapi_slug: solar-offgrid
strapi_status_bitacora: tree
strapi_ultima_actualizacion: 2026-06-01
tags:
  - Territorio y Sostenibilidad
  - Sistemas Autosustentables Integrados
  - Subsistemas Iwagé — Detalle de Diseño
territorio: Territorio y Sostenibilidad
tipo_grafo: Nodo
ultima_actualizacion: Junio 2026
---

**Relaciones**

**Deriva de:**
*Nodo:*
- [[Publicaciones/N-035 - Sistema autosustentable Iwagé mapa de un proyecto en construcción|Sistema autosustentable Iwagé: mapa de un proyecto en construcción]]

**Sustenta a:**
*Nodo:*
- [[Publicaciones/N-014 - Gestión hídrica de ciclo cerrado el agua que se gana con hábitos|Gestión hídrica de ciclo cerrado: el agua que se gana con hábitos]]


## Abstract

El nodo ancla del sistema autosustentable Iwagé mencionó de pasada un sistema solar de 3.2 kW y unos incentivos tributarios "aproximadamente del 36%". Este nodo abre esa caja: cómo se dimensiona realmente un sistema off-grid para una granja con automatización, qué dice exactamente la Ley 1715 sobre cada uno de sus cuatro beneficios, dónde están los riesgos reales de aplicarla mal, y qué significa —más allá del Excel— dejar de depender de un poste de luz.

---

## La analogía que explica por qué "off-grid" no es lo mismo que "con paneles solares"

**Analogía:** tener paneles solares conectados a la red es como tener una cuenta de ahorros que complementa tu sueldo — sigues dependiendo del banco, solo que necesitas menos. Un sistema off-grid es como vivir completamente de lo que produces: no hay cuenta de respaldo, no hay quien te preste si calculaste mal el mes. Eso no es más romántico ni más sucio — es simplemente una arquitectura distinta, que exige un tipo de precisión que la conexión a red nunca exige, porque la red siempre perdona el error de cálculo. El off-grid no perdona: si dimensionaste mal, la nevera se apaga a las tres de la madrugada del tercer día nublado, no hay a quién reclamarle.

Esa es la primera decisión real detrás del subsistema energético de Iwagé: no fue "poner paneles" — fue aceptar que el sistema completo tendría que sostenerse solo, con toda la disciplina de cálculo que eso exige.

## Cómo se dimensiona un sistema que va a alimentar una granja con sensores, no solo una nevera

El dimensionamiento de cualquier sistema off-grid sigue tres pasos en orden estricto, y el orden importa tanto como los números: primero se calculan los paneles, después las baterías, al final el inversor. Empezar por cualquier otro lado —como comprar primero "un buen inversor" porque suena importante— es la forma más común de sobredimensionar una parte del sistema y subdimensionar otra.

**Paso 1 — el consumo diario real, no el estimado optimista.** Se suma la potencia de cada equipo por las horas reales de uso al día. Para la granja Iwagé eso incluye algo que un hogar convencional no tiene: 18 nodos de sensores ESP32 en modo *deep-sleep*, que —como ya documentamos en el nodo de la granja peri-urbana— consumen apenas 12W diarios en conjunto gracias a las electroválvulas tipo latching que solo piden un pulso de 200 milisegundos para abrir o cerrar. Ese detalle de ingeniería, que parece menor, es el que permite que el sistema de riego automatizado no le robe capacidad al resto de la granja.

**Paso 2 — las baterías, dimensionadas para el peor día, no para el promedio.** La práctica estándar de la industria es dimensionar la reserva para 2 a 3 días de autonomía sin sol, no para un día típico. Se multiplica el consumo diario por esos días de autonomía y se divide entre la profundidad de descarga útil de la batería — con litio (LiFePO₄) se puede usar hasta el 90% de la capacidad sin dañarla; con plomo-ácido, solo el 50%, lo que en la práctica exige el doble de baterías físicas para la misma energía útil. Esa diferencia de tecnología no es un detalle de catálogo — es la razón por la que litio, aunque cuesta 2 a 3 veces más al inicio, termina siendo más barato en el ciclo de vida completo del sistema.

**Paso 3 — el inversor, siempre por encima de la carga pico, nunca de la carga promedio.** Un refrigerador o una bomba de agua no consumen su potencia nominal al arrancar — consumen un pico que puede llegar a ser el doble o el triple durante el primer segundo. Dimensionar el inversor solo para el consumo en régimen normal es la forma más común de que un sistema "bien calculado en papel" falle en la práctica el primer día que arranca la bomba de riego.

El costo por vatio instalado en Colombia se mueve, según el Ministerio de Minas y Energía, entre $2,000 y $3,500 pesos — lo que da una referencia real de presupuesto antes de cualquier incentivo tributario: un sistema de 3.2 kW como el diseñado para Iwagé, sin incentivos, ronda entre $6.4 y $11.2 millones de pesos solo en equipos.

## Los cuatro incentivos de la Ley 1715 — lo que realmente dicen, no lo que el vendedor promete

La Ley 1715 de 2014, modificada y fortalecida por la Ley 2099 de 2021, ofrece cuatro beneficios que se pueden combinar, aunque no siempre de la forma en que la publicidad de instaladores lo simplifica.

**Deducción especial en renta** — permite deducir hasta el 50% del valor de la inversión, con el límite de no exceder el 50% de la renta líquida del contribuyente en ese año. Este es, según análisis especializado del sector, el beneficio de mayor impacto financiero: para una empresa mediana con renta gravable alta, puede reducir el costo efectivo de la inversión entre un 17% y un 20% por sí solo.

**Exclusión de IVA** — aplica a equipos, maquinaria y servicios, nacionales o importados, destinados exclusivamente al proyecto. Sin límite de tamaño de sistema: aplica igual a un proyecto residencial pequeño de 3-5 kWp que a uno industrial.

**Exención de aranceles** — para maquinaria y equipos importados que no se produzcan en el país, sujeta a licencia previa del Ministerio de Comercio, Industria y Turismo con certificación de la UPME.

**Depreciación acelerada** — permite depreciar los activos del proyecto a una tasa de hasta el 20% anual, lo que en la práctica significa depreciar el sistema completo en 5 años en lugar de los 20-25 años típicos de un activo de generación de energía. Eso no reduce el costo total del impuesto — adelanta el beneficio fiscal en el tiempo, lo cual, por el valor del dinero en el tiempo, sigue generando un beneficio financiero real.

Combinados correctamente, estos cuatro incentivos pueden reducir el costo efectivo de un proyecto de energía renovable en Colombia hasta en un 46%, según análisis tributario especializado del sector.

## El riesgo que nadie menciona en la primera reunión de ventas

Aquí es donde este nodo se aparta de cualquier folleto comercial de instalador solar: los incentivos de la Ley 1715 no son automáticos ni están exentos de riesgo.

**Requieren certificación previa, no posterior.** Todos los beneficios están condicionados a obtener la Certificación de Beneficio Ambiental ante la ANLA (o la Corporación Autónoma Regional según la jurisdicción del proyecto) y la certificación técnica de la UPME sobre los equipos específicos. Instalar primero y tramitar después no es una opción — el trámite debe completarse antes o durante la ejecución del proyecto para que los beneficios apliquen.

**Hay que elegir, no acumular con todo.** Un contribuyente que ya se beneficia de la renta exenta del artículo 235-2 del Estatuto Tributario por venta de energía no puede aplicar simultáneamente los beneficios de la Ley 1715 — son mutuamente excluyentes, y elegir mal la combinación puede significar dejar dinero sobre la mesa.

**La documentación incompleta es la causa más común de pérdida del beneficio.** Errores en la aplicación contable de la depreciación acelerada, falta de planeación frente a las limitaciones de renta líquida, o inconsistencias entre el tratamiento contable y el fiscal pueden resultar en la pérdida parcial o total de los incentivos —además de sanciones e intereses moratorios reales, no hipotéticos.

Esto conecta directamente con lo que ya documentamos en el nodo sobre la NSR-10 y la curaduría: la norma no es la pared, la preparación incompleta del expediente sí lo es. Aquí aplica exactamente la misma lógica — el beneficio existe, es real, y también es exactamente el tipo de trámite que un proyecto ejecutado con prisa termina perdiendo por documentación incompleta.

## Lo que significa, más allá del Excel, no necesitarle nada a un poste de luz

Hay una capa de este subsistema que ningún modelo financiero captura bien: la granja Iwagé está en el corredor Ambalá-Calambeo, donde —como ya documentamos en el nodo de n8n en producción— la conectividad a internet es intermitente y poco confiable. En ese mismo contexto, la conexión eléctrica convencional tampoco es garantía de continuidad. Un sistema off-grid no es ahí una preferencia ecológica abstracta — es la misma lógica de resiliencia documentada en el nodo de antifragilidad, aplicada a la energía en lugar de a los datos: ningún subsistema depende de una infraestructura externa que la granja no controla.

**Analogía:** es la diferencia entre alquilar un apartamento y ser dueño de la casa donde vives. En ambos casos tienes techo — pero solo en uno de los dos, nadie más decide si mañana sigues teniendo acceso a él.

## Lo que todavía no está resuelto

El sistema de 3.2 kW está dimensionado y modelado financieramente, pero la instalación física todavía no ha ocurrido — el nodo ancla del sistema autosustentable ya lo declaró así, y sigue siendo cierto en el momento de escribir este nodo. La certificación ante la ANLA y la UPME, requisito previo para acceder a los incentivos de la Ley 1715, todavía no se ha tramitado. Este nodo se actualiza con datos reales de generación, consumo y comportamiento de baterías durante al menos un ciclo climático completo del corredor, en cuanto el sistema esté instalado y operando.

---

## Fuentes citadas

- Ley 1715 de 2014, modificada por Ley 2099 de 2021 — Congreso de la República de Colombia.
- Estudio Legal Hernández (2026). *Incentivos tributarios Ley 1715 energías renovables en Colombia* — reducción efectiva del 46% del costo de inversión, riesgos de aplicación incorrecta.
- DYC Ingenieros (2026). *Ley 1715: los beneficios tributarios que reducen hasta un 40% el costo de instalar paneles solares* — impacto específico de la deducción especial (17-20%) para empresas medianas.
- CR Consultores / DIAN, Oficio 16804 — requisitos de certificación ambiental ANLA/UPME, incompatibilidad con el artículo 235-2 del Estatuto Tributario.
- PwC Colombia (2026). *Beneficios fiscales para bienes y servicios que promuevan proyectos de energías renovables.*
- Ministerio de Minas y Energía — costo promedio por vatio instalado en Colombia ($2,000-$3,500 COP).
- Tienda Solar (2026). *Guía para calcular tu sistema solar Off Grid* — metodología de dimensionamiento en tres pasos.
- Fotovol (2026). *Instalación Solar Aislada: Esquema, Cálculo y Componentes* — comparativa de tecnologías de batería y profundidad de descarga.

---

**Nodos relacionados en el jardín:**
- Gestión hídrica de ciclo cerrado: el agua que se gana con hábitos, no solo con tubería *(publicado — cómo el sol calienta y desinfecta agua sin usar la capacidad fotovoltaica de este subsistema)*
- Sistema autosustentable Iwagé: mapa de un proyecto en construcción *(publicado — el subsistema energético mencionado aquí en su contexto completo)*
- Granja peri-urbana: modelo financiero de un proyecto real *(publicado — los 18 ESP32 y su consumo de 12W diarios, ya documentados)*
- La NSR-10 no es la pared: el domo que casi se frena en la curaduría *(publicado — el mismo patrón de trámite y certificación previa)*
- Antifragilidad en sistemas tecnológicos: lo que Fable 5 demostró *(publicado — la misma lógica de resiliencia aplicada a energía en vez de datos)*
- Automatización con n8n: lo que los tutoriales no muestran *(publicado — la conectividad intermitente del corredor, contexto compartido)*
