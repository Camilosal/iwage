---
id: N-041
audiencia_primaria:
  - Inversores
  - Makers/DIY
audiencia_secundaria: ""
categoria: [IoT Rural y Sensores de Campo]
creado: ""
documentId: iw5qo2kt803zx76nt04i67w7
formato: ""
nombre: "Edge computing rural: cómo un ESP32 sobrevive meses con dos baterías y sin internet confiable"
pregunta_central:
  - CQ-TS-005
  - CQ-TS-013
procedencia: Experiencia propia
pubDate: ""
serie: Iwagé — Sistema Autosustentable
slug: edge-computing-rural-como-un-esp32-sobrevive-meses-con-dos-baterias-y-sin-internet-confiable
status: 🌳 Validado
strapi_audiencia_primaria:
  - inversores
  - makers
strapi_description: "Este nodo define caja: cómo funciona realmente el ciclo de sueño profundo que hace posible esa eficiencia, qué papel juega la memoria RTC para que el sensor no pierda el hilo entre despertar y despertar, y cómo el Edge Gateway con Redis"
strapi_estado: 🌿 Creciendo
strapi_formato: Nodo del jardin
strapi_graph_slug: edge-computing-rural-como-un-esp32-sobrevive-meses-con-dos-baterias-y-sin-internet-confiable
strapi_id: 5258
strapi_orden: 0
strapi_procedencia: Experiencia propia
strapi_pubDate: "2026-07-25T05:00:00.000Z"
strapi_serie: Iwagé — Sistema Autosustentable
strapi_slug: edge-computing-rural-como-un-esp32-sobrevive-meses-con-dos-baterias-y-sin-internet-confiable
strapi_status_bitacora: tree
strapi_ultima_actualizacion: 2026-06-01
tags:
  - Territorio y Sostenibilidad
  - IoT Rural y Sensores de Campo
territorio: Territorio y Sostenibilidad
tipo_grafo: Nodo
ultima_actualizacion: Junio 2026
---

**Relaciones**

**Deriva de:**
*Nodo:*
- [[Publicaciones/N-035 - Sistema autosustentable Iwagé mapa de un proyecto en construcción|Sistema autosustentable Iwagé: mapa de un proyecto en construcción]]

**Se aplica en:**
*Nodo:*
- [[Publicaciones/N-015 - Granja peri-urbana modelo financiero de un proyecto real|Granja peri-urbana: modelo financiero de un proyecto real]]


# Edge computing rural: cómo un ESP32 sobrevive meses con dos baterías y sin internet confiable

**Territorio:** Territorio y Sostenibilidad
**Serie:** Iwagé — Sistema Autosustentable
**Categoría:** Territorio y Sostenibilidad / Edge Computing · Hardware de Campo
**Audiencia primaria:** Makers/DIY — Audiencia secundaria: Inversores
**Formato:** Nodo del jardín · Estado: 🌿 Creciendo
**Fecha:** Junio 2026

**Nudges:**
| Tipo | Territorio | Texto |
|---|---|---|
| `stat_banner` | territorio-sostenibilidad | Un ESP32 conectado a WiFi consume alrededor de 150 miliamperios. El mismo chip en deep sleep consume menos de 10 microamperios — quince mil veces menos. Esa diferencia, bien programada, es la que separa un sensor que dura un día de uno que dura un año. |
| `insight` | territorio-sostenibilidad | El sensor no está "apagado" cuando duerme — está congelado en el tiempo exacto donde se quedó, con sus variables intactas en una memoria especial que sobrevive al sueño. Al despertar no empieza de cero: recuerda exactamente dónde iba. |

---

## Abstract

Los 18 sensores ESP32 del sistema de riego automatizado, ya mencionados en al menos seis nodos distintos de esta serie, nunca tuvieron su propio desarrollo técnico independiente — solo el dato repetido de "12W diarios en conjunto" y "modo deep-sleep". Este nodo abre esa caja: cómo funciona realmente el ciclo de sueño profundo que hace posible esa eficiencia, qué papel juega la memoria RTC para que el sensor no pierda el hilo entre despertar y despertar, y cómo el Edge Gateway con Redis, ya mencionado en el nodo ancla, resuelve el problema de sincronizar datos cuando la conexión del corredor Ambalá-Calambeo simplemente no está disponible.

---

## La analogía que explica por qué el deep sleep no es solo "apagar el wifi"

**Analogía:** un ESP32 en deep sleep no es como una persona que se queda dormida sin más — es más parecido a alguien que, antes de dormir, escribe una nota con exactamente dónde se quedó, la guarda en un cajón especial que ni el apagón de electricidad puede vaciar, y programa una alarma para despertar en el momento preciso. Al sonar la alarma, no empieza el día desde cero: revisa la nota, retoma exactamente donde iba, hace lo que tiene que hacer, y vuelve a dormir. Esa memoria especial que sobrevive al sueño profundo se llama memoria RTC (Real Time Clock) — es la única parte del chip que sigue alimentada mientras casi todo lo demás se apaga.

## Los números que hacen posible que un ESP32 opere sin batería de auto

Un ESP32 con WiFi activo consume alrededor de 150 a 240 miliamperios en promedio. El mismo chip en deep sleep cae a menos de 10 microamperios — una reducción de más de quince mil veces. Un ejemplo de arquitectura documentado y replicable ilustra el efecto real de esa diferencia: un sensor que se despierta cada 5 minutos, toma 4 segundos en conectarse a WiFi y enviar sus datos, y vuelve a dormir los 296 segundos restantes, alimentado por baterías 18650 de 8,000 mAh combinadas con un panel solar pequeño de apenas 5W, puede operar de forma efectivamente indefinida durante todo el año.

Para los 18 sensores de la granja Iwagé, la arquitectura documentada en el nodo de la granja peri-urbana sigue exactamente este mismo principio: electroválvulas tipo latching que solo requieren un pulso de 200 milisegundos para abrir o cerrar —a diferencia de una electroválvula convencional que necesita corriente sostenida todo el tiempo que permanece abierta— combinadas con ciclos de deep sleep entre lecturas de humedad, es lo que reduce el consumo total de la red completa de sensores a apenas 12W diarios, una fracción mínima de la capacidad de 3.2 kW del sistema solar off-grid ya documentado en su propio nodo.

## Cómo se programa realmente un ciclo de deep sleep, sin simplificar de más

El patrón de código real, documentado de forma consistente en múltiples fuentes técnicas, sigue una secuencia de cuatro pasos que se repite indefinidamente: el chip despierta e identifica primero la causa de su despertar —temporizador, señal externa de un GPIO, o el co-procesador de ultra bajo consumo (ULP) que puede monitorear un sensor incluso con el procesador principal apagado—; luego lee el sensor correspondiente, con reintentos si la primera lectura falla; después se conecta a la red —usando reconexión rápida si guardó en memoria RTC el canal WiFi y la dirección del punto de acceso del ciclo anterior, lo que puede reducir el tiempo de reconexión a menos de 500 milisegundos— y envía los datos vía MQTT, el protocolo estándar para este tipo de comunicación ligera; y finalmente configura el temporizador para el siguiente despertar y vuelve a dormir.

La variable RTC_DATA_ATTR, disponible en el entorno de programación del ESP32, es la que marca qué datos sobreviven ese ciclo de sueño y despertar — sin ella, cada ciclo sería un reinicio completo sin memoria de lo que pasó antes, perdiendo la capacidad de contar ciclos, recordar la última lectura válida en caso de que el sensor falle momentáneamente, o mantener parámetros de conexión que ahorran tiempo y energía.

## Por qué esto no es solo eficiencia energética — es la misma resiliencia documentada en el resto de la serie

El principio de que un ESP32 en modo deep-sleep no apareció "porque es elegante" sino porque era la única forma de que el sistema de riego funcionara con la energía solar disponible y sin conexión constante a internet, ya está declarado en el nodo del meliponario. Este nodo confirma con detalle técnico por qué esa afirmación es literalmente cierta: la arquitectura de duty cycling —períodos cortos de actividad intercalados con largos períodos de sueño— no es solo la forma de ahorrar batería, es también la forma de que el sensor tolere una conexión que no está disponible todo el tiempo. Si el ESP32 necesitara estar permanentemente conectado para funcionar, cualquier caída de red en el corredor Ambalá-Calambeo dejaría al sensor completamente ciego. Con el patrón de despertar, medir, intentar enviar, y volver a dormir sin importar si el envío tuvo éxito, el sensor sigue funcionando —y sigue midiendo— incluso cuando la red falla, acumulando la siguiente lectura válida en memoria RTC hasta que la conexión vuelve.

## El Edge Gateway: dónde van los datos cuando la red simplemente no está

El nodo ancla y el de stack soberano ya mencionaron el Edge Gateway local con Redis como la pieza que bufferiza datos localmente y los sincroniza en masa hacia PostgreSQL cuando la red se restablece. Este nodo lo conecta directamente con la arquitectura de sensores ya descrita: mientras cada ESP32 individual resuelve su propia resiliencia a nivel de dispositivo —durmiendo y reintentando—, el Edge Gateway resuelve la resiliencia a nivel de sistema completo, actuando como un punto de acumulación intermedio entre docenas de sensores dispersos por el terreno y la base de datos central del Hub Soberano.

**Analogía:** si cada ESP32 es un mensajero individual que sale, entrega su mensaje si puede, y regresa a esperar la siguiente ronda sin importar si el mensaje anterior llegó, el Edge Gateway es la oficina de correos local que recibe todos esos mensajes según van llegando y los despacha en lotes hacia la central cuando el camino principal está disponible — nunca depende de que la ruta esté abierta todo el tiempo, solo de que se abra eventualmente.

## Lo que todavía no está resuelto

El nodo de stack soberano ya declaró que el failover automático de modelos no existe a nivel de flujo todavía — el mismo tipo de automatización pendiente aplica aquí a nivel de sensor individual: no existe todavía un mecanismo que detecte automáticamente cuándo un ESP32 específico dejó de reportar por más tiempo del esperado y alerte sobre una posible falla de hardware, distinguiéndola de una simple caída temporal de red. Tampoco se ha medido en campo, con datos reales del corredor Ambalá-Calambeo, cuánto tiempo de vida de batería logran efectivamente los 18 sensores instalados comparado con la proyección teórica de meses o años que la arquitectura de deep sleep promete en condiciones ideales de laboratorio.

---

## Fuentes citadas

- SiliconWit (2026). *Power Management and Deep Sleep* — arquitectura completa de duty cycling, memoria RTC, co-procesador ULP, reconexión rápida WiFi.
- Zbotic (2026). *ESP32 Deep Sleep Mode: Extend Battery Life in IoT Projects* — ejemplo numérico de ciclo de 5 minutos, 4 segundos activos, dos meses de autonomía en baterías 18650.
- MyEmbeddedSystems (2025). *How to Implement ESP32 Deep Sleep Mode for Battery-Efficient IoT Monitoring* — comparación de consumo activo (150-240 mA) vs. deep sleep (~10 µA), técnica de reconexión con canal y BSSID guardados.
- Losant / GitHub (2026). *esp32-deep-sleep-mqtt* — patrón de código de referencia para lectura de sensor, publicación MQTT y ciclo de sueño.
- Voltaic Systems Blog (2022, vigente). *How to Put an ESP32 into Deep Sleep* — modos de energía del ESP32 y uso de RTC_DATA_ATTR.
- Programming Electronics (2023, vigente). *A Practical Guide to ESP32 Deep Sleep Modes* — patrón mínimo de código y consideraciones de tiempo máximo de sueño.

---

**Nodos relacionados en el jardín:**
- Granja peri-urbana: modelo financiero de un proyecto real *(publicado — los 18 ESP32 y las electroválvulas latching que este nodo desarrolla en detalle técnico)*
- Sistema autosustentable Iwagé: mapa de un proyecto en construcción *(publicado — el Edge Gateway y la arquitectura general mencionados aquí)*
- Sistema solar off-grid: el día que la granja deja de necesitarle nada a nadie *(publicado — la capacidad de 3.2 kW que sostiene esta red de sensores)*
- Home Assistant y el gemelo digital de la granja *(publicado — el sistema que integra y automatiza estos mismos sensores)*
- Stack soberano: por qué auto-alojar cambia la ecuación *(publicado — el Edge Gateway con Redis en su arquitectura completa)*
