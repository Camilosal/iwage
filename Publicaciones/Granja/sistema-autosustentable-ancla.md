---
id: N-035
audiencia_primaria:
  - Inversores
  - Makers/DIY
  - Reclutadores
audiencia_secundaria: ""
categoria:
  - Proyectos
  - Sostenibilidad Real
creado: ""
documentId: oa2dcz39juq4szz90cg0i860
formato: ""
nombre: "Sistema autosustentable Iwagé: mapa de un proyecto en construcción"
pregunta_central:
  - CQ-TS-001
  - CQ-TS-002
  - CQ-TS-003
  - CQ-TS-005
  - CQ-TS-006
  - CQ-TS-008
  - CQ-DT-003
procedencia: Experiencia propia
pubDate: ""
serie:
slug: sistema-autosustentable-ancla
status: 🌳 Validado
strapi_audiencia_primaria:
  - inversores
  - makers
strapi_description: "Un sistema autosustentable no se declara — se construye subsistema por subsistema, con los datos que cada etapa produce. Los nodos de esta serie documentan ese proceso en tiempo real: lo que funciona, lo que falla, y lo que todavía es hipótesis."
strapi_estado: 🌱 Semilla
strapi_formato: Nodo del jardin
strapi_graph_slug: sistema-autosustentable-ancla
strapi_id: 5252
strapi_orden: 0
strapi_procedencia: Experiencia propia
strapi_pubDate: "2026-06-30T05:00:00.000Z"
strapi_slug: sistema-autosustentable-ancla
strapi_status_bitacora: tree
strapi_ultima_actualizacion: 2026-06-01
tags:
  - Territorio y Sostenibilidad
  - Sistemas Autosustentables Integrados
territorio: Territorio y Sostenibilidad
tipo_grafo: Nodo
ultima_actualizacion: Junio 2026
---

**Relaciones**

**Sustenta a:**
*Concepto:*
- [[Conceptos/C-027-tripode-de-estabilidad-vital-regla-de-los-tres-ejes|Trípode de estabilidad vital (Regla de los Tres Ejes)]]

**Aporta a:**
*Temática:*
- [[Tematicas/T-010-sistemas-autosustentables-integrados|Sistemas Autosustentables Integrados]]


## Por qué este es el proyecto que articula todo lo demás

Los otros territorios del portal — Datos y Tecnología, Diseño Tangible y Construcción — no son líneas de negocio paralelas. Son los ejes que, cuando convergen, producen algo que ninguno genera solo: un modelo de vida y producción que sea al mismo tiempo tecnológicamente soberano, físicamente anclado y ambientalmente coherente.

La granja peri-urbana en Tolima es donde esa convergencia ocurre de forma física. El Hub Soberano con sus 25 contenedores Docker gestiona los datos. Espacios Plus construye la infraestructura. Iwagé opera el territorio. Los tres ejes de la Regla de los Tres Ejes no son metáfora aquí — son los tres contratistas del mismo proyecto.

La Regla de los Tres Ejes no dice que los tres territorios avanzan al mismo ritmo. Dice que cuando uno falla, los otros sostienen el sistema. El meliponario en Ambalá avanza. La infraestructura física todavía no se construye. La automatización IoT está diseñada pero no desplegada en campo. El sistema funciona con dos ejes y medio — y eso es suficiente para seguir aprendiendo mientras el tercero se completa.

## Los subsistemas identificados para la Fase 1

La Fase 1 es la vivienda autosustentable como unidad mínima viable del sistema completo. Dos hectáreas, una minicasa, los sistemas necesarios para que esa unidad funcione con dependencia mínima de redes externas.

Estos son los subsistemas identificados con su estado actual:

**Subsistema biológico y productivo**
El meliponario de Tetragonisca angustula es el único subsistema con datos reales de campo. 30 colmenas en operación en el corredor Ambalá-Calambeo, con registro sistemático de comportamiento y producción. Es también el primer ejercicio práctico de modelar variables biológicas no lineales — retrasos de maduración de 6 a 10 meses, tasas de retención del 25 al 40%, dependencia de flora nativa de temporada, sensibilidad a pesticidas de predios vecinos. El simulador Iwagé PRO nació de intentar modelar ese subsistema con honestidad. Hay un nodo dedicado a ese ejercicio en esta serie.

El agroecosistema — cultivos, asociaciones, calendario de siembra para el clima de Ibagué — está en etapa de diseño con base en bibliografía técnica y experiencia de campo con cafetales del corredor. Sin datos propios todavía.

**Subsistema de construcción y bioarquitectura**
El domo geodésico principal de 60 m² está diseñado para implantarse en terreno con pendientes de hasta 15° mediante plataforma articulada de madera laminada — sin movimientos masivos de tierra ni vertidos de concreto. Los materiales identificados incluyen Guadua Angustifolia, tapia pisada y Nogal Cafetero del corredor. El proceso de aprobación bajo NSR-10 para materiales no convencionales está mapeado — Ley 400 de 1997, Título III, Capítulo II — pero no ejecutado. La construcción no ha iniciado.

**Subsistema energético**
Sistema fotovoltaico off-grid de 3.2 kW con almacenamiento en baterías. Los incentivos de la Ley 1715 de 2014 — exención de IVA del 19%, deducción del 50% en renta, aranceles cero, depreciación acelerada en 5 años — hacen que el costo real del sistema para una persona jurídica sea aproximadamente un 36% del valor bruto. El modelo financiero está construido. La instalación no ha ocurrido.

**Subsistema hídrico**
Cosecha de agua lluvia como suministro principal, con capacidad proyectada de 40,000 litros anuales. Tratamiento y recirculación de aguas grises bajo la Resolución 1256 de 2021. Sanitario seco compostero para eliminación del consumo de agua en saneamiento. Los 18 nodos de sensores ESP32 para monitoreo de humedad del suelo ya fueron probados en el corredor con el meliponario — esa experiencia informa el diseño del subsistema hídrico completo.

**Subsistema de ciclo de nutrientes**
Biodigestor tubular para producción de biogás y digestato. Crianza de Mosca Soldado Negra para bioconversión de residuos orgánicos. Compostaje del sanitario seco. Tres flujos que se alimentan entre sí y alimentan el agroecosistema. Diseñado, no construido.

**Subsistema de automatización y monitoreo**
Home Assistant como controlador central sobre arquitectura ARM. Zigbee y Z-Wave para comunicación de baja latencia entre dispositivos. Edge Gateway local con Redis para operar en modo offline durante los períodos de conectividad intermitente del corredor — la misma arquitectura que el Hub Soberano usa para sincronización de datos desde campo. El gemelo digital del metabolismo de la granja — los datos históricos de cada sensor como insumo para refinar las lógicas de automatización — está diseñado. No tiene datos todavía porque la infraestructura no está instalada.

## Por qué el meliponario fue el primer subsistema

No fue una elección estratégica. Fue lo que había.

Las colmenas de angelitas en las columnas de guadua del estadero del tío Gustavo aparecieron antes de que existiera ningún plan. Lo que existía era la voluntad de no perderlas y la disposición de aprender lo necesario para ayudarlas. La primera caja falló. Las abejas se fueron. Eso no terminó el proyecto — lo inició.

Pero también enseñó algo que no estaba en ningún manual: que modelar un subsistema biológico con variables no lineales es radicalmente diferente a modelar un negocio con flujos predecibles. La biología tiene sus propios tiempos. No negocia con los flujos de caja. El retraso de 6 a 10 meses antes de la primera cosecha no es un supuesto — es una restricción del ciclo de vida de la abeja que el modelo financiero tiene que respetar o mentir.

Ese aprendizaje es transferible a todos los subsistemas que vienen. El agroecosistema tiene sus propios retrasos biológicos. El biodigestor tiene sus propias curvas de estabilización. El suelo tiene su propia memoria de los insumos que recibe. Ninguno de esos sistemas responde de forma lineal ni inmediata.

El meliponario fue el primer ejercicio de aprender a modelar con esa honestidad. No el último.

## Lo que este proyecto demuestra que ningún otro nodo puede

Cada nodo del portal documenta una práctica, un sistema o una observación desde un territorio específico. Este proyecto es donde todos convergen al mismo tiempo y en el mismo lugar físico.

La automatización IoT del subsistema hídrico viene del mismo stack que el Hub Soberano. La plataforma articulada del domo usa los mismos principios de diseño con restricciones que Espacios Plus aplica en muebles para espacios reducidos. El modelo financiero del meliponario usa las mismas variables biológicas que el cuaderno de campo. Los datos de los sensores se sincronizan a PostgreSQL con la misma arquitectura que el portal de marca personal.

No es que los proyectos se parezcan. Es que son el mismo proyecto en escalas y materiales distintos. Eso es lo que la Regla de los Tres Ejes produce cuando se sostiene en el tiempo: no diversificación sino coherencia. Cada aprendizaje en un territorio informa a los otros dos.

## El estado honesto del proyecto hoy

**Operativo:** meliponario, 30 colmenas, datos de campo en registro sistemático.

**Diseñado y modelado:** subsistemas energético, hídrico, de nutrientes, de construcción, de automatización. Modelos financieros construidos, regulación mapeada, materiales identificados.

**En proceso:** lote de dos hectáreas en evaluación. Infraestructura física no iniciada. Automatización IoT en campo no desplegada.

## Lo que todavía no está resuelto

El gemelo digital, el agroecosistema productivo y la integración de subsistemas en operación simultánea siguen pendientes de datos propios. La infraestructura física no ha iniciado — ni el domo geodésico, ni la mini casa, ni el sistema solar, ni el biodigestor. La automatización IoT en campo no está desplegada más allá de los 18 ESP32 del riego. Y la certificación ANLA/UPME que activa los beneficios de la Ley 1715 sigue sin tramitarse.

Cada uno de estos frentes es un nodo del jardín. Cuando se resuelvan, este nodo ancla se actualiza.

---

*Un sistema autosustentable no se declara — se construye subsistema por subsistema, con los datos que cada etapa produce. Los nodos de esta serie documentan ese proceso en tiempo real: lo que funciona, lo que falla, y lo que todavía es hipótesis.*

---

**Fuentes citadas en este nodo:**
- DANE Colombia / FIES — inseguridad alimentaria moderada o grave: 28.1% en 2022 a 25.5% en 2024
- Ficha técnica Proyecto Iwagé — ingeniería peri-urbana, corredor Ambalá-Calambeo, 2026
- Documentación técnica Iwagé PRO — arquitectura del simulador financiero-biológico
- Evidencia directa de campo — meliponario Ambalá-Calambeo, 2023–2026
- Ley 1715 de 2014 e incentivos 2025 — energía solar Colombia
- NSR-10 / Ley 400 de 1997 — construcción con materiales no convencionales
- Resolución 1256 de 2021 — reúso de aguas grises Colombia

---

**Nodos de la serie en el jardín:**
- Meliponario Iwagé: el primer ejercicio de modelar un subsistema vivo *(próximo)*
- Cuaderno de campo: cómo documentar una operación de meliponicultura *(próximo)*
- Bioarquitectura en terreno de pendiente: el domo como punto de partida *(próximo)*
- Minicasa ecológica: diseño bioclimático para el trópico andino *(próximo)*
- Sistema solar off-grid: incentivos reales y ROI honesto en Colombia *(próximo)*
- Edge computing rural: automatización con ESP32 y conectividad intermitente *(próximo)*
- Home Assistant y el gemelo digital de la granja *(próximo)*
- Gestión hídrica de ciclo cerrado *(próximo)*
- Bio-refinería doméstica: biodigestor, mosca soldado negra y sanitario seco *(próximo)*
- Agroecosistema productivo: calendario de siembra para Ibagué *(próximo)*
- Marco regulatorio del sistema autosustentable en Colombia *(próximo)*
- Estrategia de financiación por fases *(próximo)*
- ESG sin greenwashing: cómo construir métricas que resisten preguntas *(próximo)*

**Nodos relacionados en el jardín:**
- La Regla de los Tres Ejes: una filosofía de vida antifrágil *(publicado)*
- Trabaja con lo que tienes, no con lo que esperas tener *(publicado)*
- Stack soberano: por qué auto-alojar cambia la ecuación *(publicado)*
- Antifragilidad en sistemas tecnológicos: lo que Fable 5 demostró *(publicado)*
