#!/usr/bin/env node
/**
 * Seed Strapi with complete sample experiencias + anfitriones
 * so you can preview the full detail page with ALL sections populated.
 *
 * Usage:
 *   node strapi/scripts/seed-experiencias-demo.mjs
 *
 * Requires Strapi running at STRAPI_URL (default http://localhost:1338)
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

const headers = { 'Content-Type': 'application/json' };
if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upsert(endpoint, slug, payload) {
  // Find existing
  const findRes = await fetch(`${STRAPI_URL}/api/${endpoint}?filters[slug][$eq]=${encodeURIComponent(slug)}`, { headers });
  const findJson = await findRes.json();
  const existing = findJson.data?.[0];

  if (existing) {
    const res = await fetch(`${STRAPI_URL}/api/${endpoint}/${existing.documentId}`, {
      method: 'PUT', headers, body: JSON.stringify({ data: payload }),
    });
    if (!res.ok) { console.error(`  ✗ PUT ${endpoint}/${slug}: ${res.status} ${(await res.text()).slice(0, 200)}`); return null; }
    console.log(`  ✓ Updated ${endpoint}/${slug}`);
    return existing.documentId;
  } else {
    const res = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify({ data: payload }),
    });
    if (!res.ok) { console.error(`  ✗ POST ${endpoint}/${slug}: ${res.status} ${(await res.text()).slice(0, 200)}`); return null; }
    const json = await res.json();
    console.log(`  ✓ Created ${endpoint}/${slug}`);
    return json.data?.documentId || null;
  }
}

// ── DATA ────────────────────────────────────────────────────────────────────

const ANFITRIONES = [
  {
    slug: 'don-hernando-caficultor',
    nombre: 'Don Hernando Martínez',
    especialidad: 'Caficultor y guía de bosque de niebla',
    foto_perfil_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80',
    video_thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=70',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    manifiesto: 'La montaña no se conquista, se escucha. Cada paso que das en mi finca es un paso que da el bosque para respirar.',
    momento_favorito: 'Cuando la niebla se levanta a las 5:40am y los guaduales suenan como un río verde.',
    arraigo: 'Nací en esta vereda. Mi abuelo sembró los primeros cafetos en 1952 y yo sigo aquí, cuidando lo que él empezó.',
    historia_personal: 'Soy tercera generación de caficultores en la vereda La Palma. Después de estudiar agronomía en Ibagué, volví a la finca para transformar el cultivo tradicional en un sistema agroforestal que hoy protege 12 hectáreas de bosque andino. Desde 2019 abrí las puertas de mi finca para que viajeros del mundo entiendan que una taza de café puede salvar un bosque.',
    anos_en_territorio: 58,
    generaciones_familia: 3,
    foto_territorio: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=70',
    galeria_fotos: [
      { url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=70', caption: 'Cafetal bajo sombra', tipo: 'image' },
      { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=70', caption: 'Bosque de niebla', tipo: 'image' },
    ],
    nivel_escalafon: 4,
    nombre_escalafon: 'Guardián',
    descripcion_escalafon: 'Referente territorial con liderazgo en conservación.',
    calificacion_promedio: 4.9,
    numero_resenas: 47,
    impacto_hectareas: 12,
    impacto_hectareas_desc: 'hectáreas de bosque andino protegidas bajo sombra de café',
    impacto_familias: 8,
    impacto_familias_desc: 'familias caficultoras vinculadas al comercio directo',
    impacto_mensaje: 'Cada visitante financia 2 árboles nativos sembrados al año.',
    fondo_impacto_titulo: 'Fondo Semillas de Niebla',
    fondo_impacto_descripcion: 'El 2% de cada experiencia va directo a la siembra de árboles nativos en corredores biológicos de la vereda.',
    sueno_narrativa: 'Sueño con que mis nietos no tengan que irse a la ciudad. Que la finca les dé todo: alimento, propósito y orgullo.',
    insignia_titulo: 'Guardián del Bosque de Niebla',
    insignia_narrativa: 'Reconocido por la Corporación Autónoma Regional del Tolima por la protección de 12 hectáreas de bosque andino.',
    pacto_subtitulo: 'Mi compromiso contigo y con la montaña',
    pacto_items: [
      { titulo: 'Seguridad absoluta', descripcion: 'Conozco cada piedra del camino. 25 años guiando sin un solo incidente.', icono_name: 'shield' },
      { titulo: 'Impacto real', descripcion: 'Tu visita siembra árboles. Te mostraré exactamente dónde.', icono_name: 'leaf' },
      { titulo: 'Autenticidad', descripcion: 'No es un show turístico. Es mi vida, mi finca, mi familia.', icono_name: 'heart' },
    ],
    certificaciones_seguridad: ['Guía certificado FONTUR 2021', 'Primeros auxilios Cruz Roja', 'Póliza de asistencia al viajero'],
    faqs: [
      { pregunta: '¿Puedo ir con niños?', respuesta: 'Sí, la ruta es apta para mayores de 6 años. Tengo un recorrido especial más corto para familias.' },
      { pregunta: '¿Hay señal de celular?', respuesta: 'Hay señal intermitente de Claro en la parte alta. Recomiendo desconectarse y disfrutar.' },
    ],
    resenas: [
      { author: 'María Camila R.', profile: 'Viajera sola', rating: 5, text: 'Don Hernando me hizo sentir en familia. El café que tomamos en su cocina de leña es el mejor que he probado en mi vida.', date: '2025-11-15' },
      { author: 'Thomas & Lisa', profile: 'Pareja de Alemania', rating: 5, text: 'We came for the coffee and left with a friend for life. The forest walk at dawn was magical.', date: '2025-10-02' },
      { author: 'Andrés Felipe G.', profile: 'Fotógrafo de naturaleza', rating: 5, text: 'Las 12 hectáreas de bosque son un paraíso para la fotografía. Vi 3 especies de tangaras que no había registrado.', date: '2025-09-20' },
      { author: 'Carolina M.', profile: 'Familia con niños', rating: 4, text: 'Mis hijos aprendieron más de naturaleza en 4 horas que en todo el año escolar. Volveremos.', date: '2025-08-10' },
    ],
    publicado: true,
    seo_titulo: 'Don Hernando Martínez · Guardián del Bosque de Niebla | Iwagé Naturaleza',
    seo_descripcion: 'Conoce a Don Hernando, caficultor de tercera generación y guardián de 12 hectáreas de bosque andino en el Tolima.',
  },
  {
    slug: 'luz-elenia-herbalista',
    nombre: 'Luz Elenia Rojas',
    especialidad: 'Herbalista y tejedora de saberes ancestrales',
    foto_perfil_url: 'https://images.unsplash.com/photo-1544005516-d186bc47c4e8?w=300&q=80',
    video_thumbnail: null,
    video_url: null,
    manifiesto: 'Las plantas hablan si uno sabe callar. Yo solo traduzco lo que la montaña quiere decir.',
    momento_favorito: 'El atardecer desde el mirador, cuando el valle se vuelve dorado y las abejas vuelven a la colmena.',
    arraigo: 'Mi familia ha vivido en esta montaña por 5 generaciones. Conozco cada planta medicinal del camino.',
    historia_personal: 'Soy herbalista y agricultora regenerativa. Aprendí de mi abuela el uso de más de 80 plantas medicinales del bosque andino. Hoy combino ese saber ancestral con técnicas de permacultura para crear un jardín que alimenta, cura y enseña. Mis caminatas botánicas son un viaje al conocimiento que la montaña guarda.',
    anos_en_territorio: 45,
    generaciones_familia: 5,
    foto_territorio: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70',
    galeria_fotos: [
      { url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=70', caption: 'Jardín medicinal', tipo: 'image' },
    ],
    nivel_escalafon: 3,
    nombre_escalafon: 'Raíz',
    descripcion_escalafon: 'Impacto ambiental demostrado y comunidad fiel.',
    calificacion_promedio: 4.8,
    numero_resenas: 32,
    impacto_hectareas: 5,
    impacto_hectareas_desc: 'hectáreas de jardín medicinal y policultivo',
    impacto_familias: 4,
    impacto_familias_desc: 'familias vinculadas a la red de semillas',
    impacto_mensaje: 'Cada caminata financia el banco comunitario de semillas nativas.',
    fondo_impacto_titulo: 'Banco de Semillas La Palma',
    fondo_impacto_descripcion: 'Preservamos variedades criollas que la agricultura industrial está desapareciendo.',
    sueno_narrativa: 'Que ninguna planta medicinal de esta montaña se pierda. Que mis nietas sepan lo que yo sé.',
    insignia_titulo: 'Tejedora de Saberes',
    insignia_narrativa: 'Reconocida por la Red de Mujeres Rurales del Tolima por la preservación del conocimiento herbal.',
    pacto_subtitulo: 'Lo que te ofrezco en cada caminata',
    pacto_items: [
      { titulo: 'Sabiduría viva', descripcion: 'No es un museo. Es conocimiento que uso todos los días.', icono_name: 'book' },
      { titulo: 'Ritmo de la tierra', descripcion: 'Caminamos sin afán. La montaña dicta el paso.', icono_name: 'sun' },
    ],
    certificaciones_seguridad: ['Guía local certificada', 'Conocimiento de plantas tóxicas y antídotos'],
    faqs: [
      { pregunta: '¿Puedo comprar plantas o semillas?', respuesta: 'Sí, tengo un pequeño vivero. Las semillas criollas se comparten, no se venden.' },
    ],
    resenas: [
      { author: 'Paula V.', profile: 'Bióloga', rating: 5, text: 'Luz Elenia conoce usos de plantas que no están en ningún libro académico. Una experiencia transformadora.', date: '2025-12-01' },
      { author: 'Jorge E.', profile: 'Chef', rating: 5, text: 'Vine buscando ingredientes y encontré una filosofía de vida. La infusión de hierbas al final del recorrido es inolvidable.', date: '2025-10-18' },
    ],
    publicado: true,
    seo_titulo: 'Luz Elenia Rojas · Herbalista del Tolima | Iwagé Naturaleza',
    seo_descripcion: 'Caminatas botánicas con Luz Elenia, guardiana de saberes ancestrales y 80 plantas medicinales del bosque andino.',
  },
];

const EXPERIENCIAS = [
  {
    slug: 'amanecer-en-el-bosque-de-niebla',
    titulo: 'Amanecer en el Bosque de Niebla',
    resumen: 'Una caminata sensorial al alba entre guaduales centenarios y cafetales de sombra, donde la niebla te envuelve y el territorio te cuenta su historia a través de los sentidos.',
    categoria: 'Naturaleza',
    ubicacion: 'Vereda La Palma, Juntas',
    ubicacion_latitud: 4.3582,
    ubicacion_longitud: -75.2145,
    ciudad_referencia: 'Ibagué Centro',
    distancia_km: '28 km',
    tiempo_desde_ciudad: '50 min',
    estado_via: 'Pavimentada hasta Juntas, luego 8 km de placa huella en buen estado',
    ofrece_transporte: true,
    duracion: '5 horas (5:00am - 10:00am)',
    nivel_dificultad: 3,
    tipo_propiedad: 'iwage-managed',
    precio_desde: 185000,
    cupo_maximo_desc: '4 a 6 personas',
    porcentaje_fondo_impacto: 2.5,
    descripcion_fondo_impacto: 'El 2.5% de tu inversión se destina al Fondo Semillas de Niebla para la siembra de árboles nativos en corredores biológicos.',
    es_destacado: true,
    publicado: true,
    imagen_hero_url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
    galeria_urls: [
      { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70', tipo: 'image', titulo: 'Sendero entre guaduales' },
      { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=70', tipo: 'image', titulo: 'Valle al amanecer' },
      { url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=70', tipo: 'image', titulo: 'Cafetal bajo sombra' },
      { url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=70', tipo: 'image', titulo: 'Rayos de sol entre la niebla' },
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tipo: 'video', titulo: 'Recorrido completo' },
      { url: 'https://momento360.com/e/u/demo', tipo: '360', titulo: 'Mirador 360°' },
    ],
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    tour_360_url: 'https://momento360.com/e/u/demo',
    link_drone: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mapa_imagen_url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=70',
    highlights: [
      'Caminata al alba entre niebla y guaduales centenarios',
      'Cata de café de especialidad en cocina de leña',
      'Avistamiento de aves endémicas (tangaras, tucanes)',
      'Baño en cascada natural de agua cristalina',
      'Siembra de un árbol nativo con tu nombre',
      'Desayuno campesino con productos de la finca',
    ],
    requirements: [
      'Botas de trekking o tenis con buen agarre',
      'Impermeable ligero (la niebla moja)',
      'Linterna frontal (salimos antes del amanecer)',
      'Botella de agua reutilable (1 litro mínimo)',
      'Protector solar y repelente',
      'Ropa abrigada para las primeras 2 horas',
    ],
    includes: [
      'Transporte ida y vuelta desde Ibagué',
      'Guía local certificado (Don Hernando)',
      'Desayuno campesino completo',
      'Cata de café de especialidad',
      'Seguro de asistencia al viajero',
      'Árbol nativo sembrado a tu nombre',
      'Fotos del recorrido en alta resolución',
    ],
    excludes: [
      'Almuerzo (opcional con costo adicional)',
      'Gastos personales',
      'Propinas',
    ],
    optional_addons: [
      { nombre: 'Almuerzo campesino en la finca', precio: 45000 },
      { nombre: 'Noche de camping bajo las estrellas', precio: 120000 },
      { nombre: 'Taller de barismo con café de la finca', precio: 65000 },
      { nombre: 'Sesión de yoga al amanecer en el mirador', precio: 35000 },
    ],
    faqs: [
      { pregunta: '¿Necesito experiencia previa en senderismo?', respuesta: 'No. El nivel es moderado pero el ritmo es tranquilo. Don Hernando adapta el paso al grupo. Lo más exigente son los 20 minutos de ascenso inicial.' },
      { pregunta: '¿Qué pasa si llueve?', respuesta: 'La experiencia se realiza con lluvia ligera (es parte de la magia de la niebla). Si hay tormenta eléctrica, se reprograma sin costo.' },
      { pregunta: '¿Puedo llevar mi mascota?', respuesta: 'Sí, siempre que esté acostumbrada a caminar en montaña y con correa. El bosque tiene fauna silvestre que debemos respetar.' },
      { pregunta: '¿Hay baños en el recorrido?', respuesta: 'Hay un baño ecológico en la mitad del sendero y en la finca al inicio y final.' },
    ],
    safety_content: {
      title: 'Tranquilidad total en la montaña',
      description: 'Don Hernando conoce cada piedra de este camino. 25 años guiando sin un solo incidente. El sendero está señalizado y cuenta con puntos de evacuación cada 500 metros.',
      features: ['Guía certificado FONTUR', 'Póliza de asistencia al viajero', 'Botiquín de primeros auxilios', 'Radio de comunicación con base', 'Ruta de evacuación señalizada'],
    },
    etiquetas_personalizadas: { temporada: 'Todo el año', mejor_hora: '5:00am', clima: '12-18°C, niebla matinal' },
    itinerario_sensorial: [
      { time: '5:00 AM', title: 'El despertar del bosque', sense: 'Oído', desc: 'Salimos en silencio. Los primeros sonidos: el río, las chicharras, un búho que se despide.', iconName: '🌙' },
      { time: '5:40 AM', title: 'La niebla te abraza', sense: 'Tacto', desc: 'La humedad se siente en la piel. Los guaduales gotean. Caminamos entre nubes bajas.', iconName: '🌫️' },
      { time: '6:15 AM', title: 'El café que despierta', sense: 'Olfato', desc: 'Llegamos a la cocina de leña. El aroma del café recién tostado llena todo. Cata guiada.', iconName: '☕' },
      { time: '7:00 AM', title: 'Colores del amanecer', sense: 'Vista', desc: 'Desde el mirador, el valle se enciende. Naranjas, rosados, dorados. Las tangaras aparecen.', iconName: '🌅' },
      { time: '8:30 AM', title: 'La cascada secreta', sense: 'Oído + Tacto', desc: 'El sonido del agua crece. Una cascada de 8 metros. Baño opcional en agua a 14°C.', iconName: '💧' },
      { time: '9:30 AM', title: 'Sembrar futuro', sense: 'Tacto + Propósito', desc: 'Cada visitante siembra un árbol nativo. Tu nombre queda en el registro del bosque.', iconName: '🌱' },
      { time: '10:00 AM', title: 'Desayuno de la tierra', sense: 'Gusto', desc: 'Arepas de maíz criollo, huevos de gallinas libres, queso de la vereda, jugo de lulo.', iconName: '🍳' },
    ],
    anfitriones_data: [
      {
        anfitrion_id: 'don-hernando-caficultor',
        precio_personalizado: 185000,
        superpoder_en_esta_ruta: 'Conoce cada ave del bosque por su canto. Puede identificar 40 especies solo escuchando.',
        toque_unico: 'Su café de especialidad tostado en leña de guayabo, receta de su abuelo.',
        url_reservas: 'https://reservas.iwage.co/amanecer-bosque-niebla',
        lema_seccion: 'El bosque no se visita, se habita por un momento.',
        manifiesto_ruta: 'Quiero que sientas lo que yo sentí de niño: que la montaña está viva y nos habla. Solo hay que aprender a escucharla.',
        momento_favorito_ruta: 'Cuando el grupo guarda silencio en el mirador y alguien susurra "no puedo creer que esto exista".',
        destacados_unicos: ['Cafetal de 70 años bajo sombra nativa', 'Nido de tucanes a 20 metros del sendero', 'Cascada privada de la finca'],
        recomendaciones_especificas: ['Llegar con la linterna cargada', 'No usar perfume fuerte (ahuyenta las aves)', 'Traer cuaderno si quieres dibujar'],
        enfoque_de_ruta: 'Contemplación sensorial y conexión con el territorio',
      },
    ],
    iniciativas_impacto: [
      { icono: '🌳', titulo: 'Reforestación activa', descripcion: 'Cada visitante siembra un árbol nativo. Ya van 340 árboles sembrados por viajeros.', estado: 'Activo', metrica: '340 árboles / 2.1 ha restauradas' },
      { icono: '🐦', titulo: 'Corredor biológico', descripcion: 'Conectamos 3 fragmentos de bosque para que las aves migren seguras entre montañas.', estado: 'En progreso', metrica: '12 ha conectadas de 20 ha meta' },
      { icono: '👨‍👩‍👧', titulo: 'Empleo local', descripcion: '8 familias de la vereda participan en la experiencia: guías, cocineras, artesanos.', estado: 'Activo', metrica: '8 familias / 14 empleos directos' },
      { icono: '☕', titulo: 'Café sin intermediarios', descripcion: 'El café que tomas se vende directo al visitante. El productor recibe 3x más que en el mercado.', estado: 'Activo', metrica: '$4.200/kg vs $1.400 mercado' },
    ],
    paquetes_upsell: [
      {
        title: 'Fin de Semana en la Niebla',
        tagline: 'Dos días completos entre café, bosque y estrellas',
        duration: '2 días / 1 noche',
        price: 420000,
        includes: ['Amanecer en el bosque (día 1)', 'Taller de barismo y tueste', 'Noche de camping o cabaña', 'Caminata nocturna con linternas', 'Desayuno + almuerzo + cena campesina', 'Taller de siembra y cuidado del cafetal'],
      },
      {
        title: 'Ruta del Café Completa',
        tagline: 'De la semilla a la taza en 3 días',
        duration: '3 días / 2 noches',
        price: 680000,
        includes: ['Todo lo del Fin de Semana', 'Visita a beneficio ecológico', 'Tostión artesanal de tu propio café', '250g de café tostado para llevar', 'Cena de fogata con historias de la vereda', 'Certificado de "Caficultor por un día"'],
      },
    ],
    seo_titulo: 'Amanecer en el Bosque de Niebla · Juntas, Tolima | Iwagé Naturaleza',
    seo_descripcion: 'Caminata sensorial al alba entre guaduales y cafetales de sombra. Cata de café, cascada, avistamiento de aves. Desde $185.000 COP. Transporte incluido desde Ibagué.',
  },
  {
    slug: 'jardin-medicinal-y-saberes-de-montana',
    titulo: 'Jardín Medicinal y Saberes de Montaña',
    resumen: 'Una caminata botánica con Luz Elenia por su jardín de 80 plantas medicinales, donde el conocimiento ancestral se mezcla con permacultura y cada hoja tiene una historia que contar.',
    categoria: 'Bienestar',
    ubicacion: 'Vereda La Palma, Juntas',
    ubicacion_latitud: 4.3601,
    ubicacion_longitud: -75.2198,
    ciudad_referencia: 'Ibagué Centro',
    distancia_km: '30 km',
    tiempo_desde_ciudad: '55 min',
    estado_via: 'Pavimentada hasta Juntas, luego placa huella',
    ofrece_transporte: false,
    duracion: '4 horas (9:00am - 1:00pm)',
    nivel_dificultad: 2,
    tipo_propiedad: 'local-partner',
    precio_desde: 145000,
    cupo_maximo_desc: '6 a 10 personas',
    porcentaje_fondo_impacto: 2.0,
    descripcion_fondo_impacto: 'El 2% apoya el Banco Comunitario de Semillas de la vereda La Palma.',
    es_destacado: true,
    publicado: true,
    imagen_hero_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
    galeria_urls: [
      { url: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=70', tipo: 'image', titulo: 'Jardín de hierbas' },
      { url: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&q=70', tipo: 'image', titulo: 'Infusión artesanal' },
      { url: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?w=800&q=70', tipo: 'image', titulo: 'Plantas medicinales' },
    ],
    video_url: null,
    tour_360_url: null,
    link_drone: null,
    mapa_imagen_url: null,
    highlights: [
      'Recorrido por 80+ plantas medicinales con usos demostrados',
      'Preparación de tu propia infusión personalizada',
      'Taller de tinturas y ungüentos naturales',
      'Almuerzo con ingredientes del jardín (farm-to-table)',
      'Meditación guiada en el mirador del valle',
      'Kit de semillas criollas para llevar a casa',
    ],
    requirements: [
      'Ropa cómoda para caminar en jardín',
      'Sombrero o gorra (zonas abiertas)',
      'Cuaderno si quieres tomar notas',
      'Botella de agua',
    ],
    includes: [
      'Guía herbalista (Luz Elenia)',
      'Materiales para taller de infusión',
      'Almuerzo vegetariano del jardín',
      'Kit de semillas criollas',
      'Infusión personalizada para llevar',
    ],
    excludes: [
      'Transporte desde Ibagué (se puede coordinar)',
      'Alojamiento',
    ],
    optional_addons: [
      { nombre: 'Sesión de masaje con aceites de la montaña', precio: 80000 },
      { nombre: 'Taller extendido de cosmética natural', precio: 55000 },
      { nombre: 'Caminata nocturna: plantas que florecen de noche', precio: 40000 },
    ],
    faqs: [
      { pregunta: '¿Necesito conocimientos previos de botánica?', respuesta: 'Para nada. Luz Elenia explica todo desde cero. Es una experiencia para curiosos, no para expertos.' },
      { pregunta: '¿El almuerzo tiene opciones veganas?', respuesta: 'Sí, todo el menú es vegetariano por defecto y se adapta a vegano sin problema. Solo avisa al reservar.' },
      { pregunta: '¿Puedo llevarme plantas?', respuesta: 'Semillas sí (se comparten). Plantas vivas solo del vivero con costo adicional.' },
    ],
    safety_content: {
      title: 'Experiencia segura y tranquila',
      description: 'El recorrido es en terreno plano y estable. Luz Elenia conoce cada planta tóxica del camino y las señala como parte del aprendizaje.',
      features: ['Terreno plano y señalizado', 'Guía con conocimiento de plantas tóxicas', 'Botiquín natural y convencional'],
    },
    etiquetas_personalizadas: { temporada: 'Todo el año', mejor_hora: '9:00am', clima: '16-22°C, sol parcial' },
    itinerario_sensorial: [
      { time: '9:00 AM', title: 'Bienvenida con agua de hierbas', sense: 'Gusto', desc: 'Luz Elenia te recibe con una infusión del día. Hoy: limoncillo y menta de su jardín.', iconName: '🍵' },
      { time: '9:30 AM', title: 'El jardín habla', sense: 'Olfato', desc: 'Recorrido entre canteros. Cada planta se huele, se toca, se prueba. 80 especies en 1 hora.', iconName: '🌿' },
      { time: '10:30 AM', title: 'Tu infusión, tu receta', sense: 'Tacto', desc: 'Eliges 3 plantas según lo que tu cuerpo necesita. Preparas tu mezcla personalizada.', iconName: '🫖' },
      { time: '11:30 AM', title: 'Silencio en el mirador', sense: 'Oído', desc: '15 minutos de meditación guiada. El viento, las abejas, el valle. Nada más.', iconName: '🧘' },
      { time: '12:00 PM', title: 'De la tierra al plato', sense: 'Gusto', desc: 'Almuerzo preparado con lo que cosechamos. Ensalada de flores, arroz de hierbas, jugo de uchuva.', iconName: '🥗' },
      { time: '1:00 PM', title: 'Semillas para el futuro', sense: 'Propósito', desc: 'Cada visitante se lleva semillas criollas. El compromiso: sembrarlas y compartir.', iconName: '🌻' },
    ],
    anfitriones_data: [
      {
        anfitrion_id: 'luz-elenia-herbalista',
        precio_personalizado: 145000,
        superpoder_en_esta_ruta: 'Puede curar un dolor de cabeza con 3 hojas del camino y contarte la historia de cada una.',
        toque_unico: 'Su infusión de "buenos días" cambia según la luna. Receta secreta de la abuela.',
        url_reservas: 'https://reservas.iwage.co/jardin-medicinal',
        lema_seccion: 'La farmacia más completa está en la montaña.',
        manifiesto_ruta: 'No te voy a enseñar botánica. Te voy a presentar a mis amigas: las plantas. Ellas hacen el resto.',
        momento_favorito_ruta: 'Cuando alguien huele la hierbaluisa y cierra los ojos. Ahí sé que la planta ya habló.',
        destacados_unicos: ['Colección de 80 plantas medicinales', 'Reloj floral (cada hora florece una especie)', 'Colmenar de abejas meliponas'],
        recomendaciones_especificas: ['Venir con hambre (el almuerzo es abundante)', 'Traer un frasco vacío para la infusión', 'Preguntar todo, no hay preguntas tontas'],
        enfoque_de_ruta: 'Bienestar integral y reconexión con la sabiduría vegetal',
      },
    ],
    iniciativas_impacto: [
      { icono: '🌱', titulo: 'Banco de semillas', descripcion: 'Preservamos 45 variedades criollas que la agricultura industrial está desapareciendo.', estado: 'Activo', metrica: '45 variedades / 3 bancos activos' },
      { icono: '🐝', titulo: 'Polinizadores', descripcion: '3 colmenas de abejas meliponas que polinizan el jardín y producen miel medicinal.', estado: 'Activo', metrica: '3 colmenas / 2L miel/mes' },
      { icono: '👩‍🌾', titulo: 'Red de mujeres', descripcion: '4 mujeres de la vereda participan como co-guías y productoras de tinturas.', estado: 'Activo', metrica: '4 mujeres / ingresos complementarios' },
    ],
    paquetes_upsell: [
      {
        title: 'Día de Bienestar Completo',
        tagline: 'Jardín medicinal + masaje + cena bajo las estrellas',
        duration: '1 día completo',
        price: 280000,
        includes: ['Caminata botánica completa', 'Masaje con aceites de la montaña', 'Cena vegetariana de 5 tiempos', 'Meditación al atardecer', 'Kit completo de semillas + infusión + ungüento'],
      },
    ],
    seo_titulo: 'Jardín Medicinal y Saberes de Montaña · Juntas, Tolima | Iwagé Naturaleza',
    seo_descripcion: 'Caminata botánica con 80 plantas medicinales, taller de infusiones, almuerzo farm-to-table. Con Luz Elenia, herbalista de 5ta generación. Desde $145.000 COP.',
  },
];

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌿 Seed Experiencias Demo → ${STRAPI_URL}\n`);

  // 1. Create anfitriones
  console.log('── Anfitriones ──');
  const anfitrionDocIds = {};
  for (const a of ANFITRIONES) {
    const docId = await upsert('anfitriones', a.slug, a);
    if (docId) anfitrionDocIds[a.slug] = docId;
    await sleep(300);
  }

  // 2. Create experiencias with anfitriones relation
  console.log('\n── Experiencias ──');
  for (const exp of EXPERIENCIAS) {
    const payload = { ...exp };

    // Link anfitriones via relation
    const junctionIds = (exp.anfitriones_data || []).map((j) => j.anfitrion_id).filter(Boolean);
    const relatedDocIds = junctionIds.map((id) => anfitrionDocIds[id]).filter(Boolean);
    if (relatedDocIds.length > 0) {
      payload.anfitriones = { connect: relatedDocIds.map((documentId) => ({ documentId })) };
    }

    await upsert('experiencias', exp.slug, payload);
    await sleep(300);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 URLs to preview:');
  for (const exp of EXPERIENCIAS) {
    console.log(`   /naturaleza/experiencias/${exp.slug}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
