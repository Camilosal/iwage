/**
 * completar-fichas-experiencias.mjs
 * Completa todos los campos vacíos o incompletos de las dos fichas de
 * experiencia existentes en Strapi (la-ruta-de-la-niebla y la-senda-del-cacao).
 *
 * - Los campos JSON se envían COMPLETOS (Strapi los reemplaza en cada PUT),
 *   por eso cada arreglo incluye los ítems ya existentes más los nuevos.
 * - Conecta la propiedad de Tierras "Finca El Mirador" a ambas experiencias.
 *
 * Uso: node strapi/scripts/completar-fichas-experiencias.mjs
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const TOKEN = process.env.STRAPI_TOKEN || '';

const PROPIEDAD_EL_MIRADOR = 'pki7e30xu0k9ctcy4p2ktmmt'; // Finca El Mirador (Tierras)

const FICHAS = [
  {
    slug: 'la-ruta-de-la-niebla',
    documentId: 'xww1xl0tngq3d807p3t73jgb',
    data: {
      es_destacado: true,
      descripcion_fondo_impacto:
        'El 2% de tu reserva financia el vivero de robles nativos y la protección de los nacimientos de agua de la vereda Ambalá, en el Cañón del Combeima.',
      link_drone: 'https://www.youtube.com/watch?v=F3a3gHtiT1o',
      mapa_imagen_url:
        'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1200',
      seo_titulo: 'La Ruta de la Niebla y el Café · Iwagé Naturaleza',
      seo_descripcion:
        'Camina el bosque de niebla del Cañón del Combeima con anfitriones locales: aves endémicas, botánica ancestral y desayuno campesino a la leña. Desde $85.000 COP.',
      safety_content: {
        title: 'Tranquilidad total en la montaña',
        description:
          'Caminas con anfitriones locales certificados que conocen cada recodo del bosque de niebla. Toda reserva incluye póliza de asistencia médica y las rutas se recorren y evalúan antes de cada salida.',
        features: [
          'Seguro de asistencia médica Colasistencia',
          'Anfitriones certificados en primeros auxilios',
          'Rutas exploradas y evaluadas previamente',
          'Comunicación por radio en toda la ruta',
          'Punto de hidratación y descanso cada 45 minutos',
        ],
      },
      etiquetas_personalizadas: {
        si_incluye: 'Lo que SÍ incluye',
        no_incluye: 'Lo que NO incluye',
        a_tu_medida: 'Hazlo a tu medida',
        cuentas_claras_titulo: 'Cuentas Claras',
      },
      itinerario_sensorial: [
        {
          time: 'Amanecer',
          title: 'Susurros de Niebla',
          sense: 'Vista & Asombro',
          desc: 'Las nubes bajan a saludarte.',
          iconName: 'CloudSun',
        },
        {
          time: 'Media mañana',
          title: 'El Concierto de las Aves',
          sense: 'Oído & Quietud',
          desc: 'Pausa en silencio para escuchar tangaras, colibríes y el barranquero. Tu anfitrión te enseña a distinguir sus cantos.',
          iconName: 'Bird',
        },
        {
          time: 'Mediodía',
          title: 'Botánica que Cura',
          sense: 'Olfato & Tacto',
          desc: 'Taller de plantas medicinales del bosque altoandino: toca, huele y aprende los usos que las abuelas guardan.',
          iconName: 'Leaf',
        },
        {
          time: 'Tarde',
          title: 'Fogón Campesino',
          sense: 'Gusto & Comunidad',
          desc: 'Cierre con desayuno-almuerzo campesino a la leña y café de la finca, mirando el valle despejarse.',
          iconName: 'Flame',
        },
      ],
      galeria_urls: [
        {
          url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=1000',
          tipo: 'image',
          titulo: 'Paisaje andino',
        },
        {
          url: 'https://s2.wklcdn.com/image_31/945142/7307725/4152557Master.jpg',
          tipo: 'image',
          titulo: 'Mirador de Ambala',
        },
        {
          url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1000',
          tipo: 'image',
          titulo: 'Bosque de niebla',
        },
        {
          url: 'https://www.youtube.com/watch?v=F3a3gHtiT1o',
          tipo: 'video',
          titulo: 'La ruta en video',
        },
        {
          url: 'https://roundme.com/tour/318047/view/1042784/',
          tipo: '360',
          titulo: 'Tour 360° del sendero',
        },
      ],
      faqs: [
        { question: '¿Puedo llevar a mi mascota?', answer: '¡Sí! Con correa.' },
        {
          question: '¿Qué pasa si llueve mucho?',
          answer: 'El bosque de niebla es más mágico con lluvia.',
        },
        {
          question: '¿Necesito experiencia en senderismo?',
          answer:
            'No. Es nivel 3/7: cualquier persona con condición física básica la disfruta. Los anfitriones marcan el ritmo con pausas sensoriales.',
        },
        {
          question: '¿El precio cambia según el anfitrión?',
          answer:
            'Sí. Cada anfitrión define su tarifa según su especialidad: con Marina desde $85.000 y con Camilo desde $110.000 por persona.',
        },
      ],
      anfitriones_data: [
        {
          anfitrion_id: 'camilo',
          precio_personalizado: 110000,
          url_reservas: 'https://reservas.iwage.co/es/',
          superpoder_en_esta_ruta: 'Observación de Aves Endémicas',
          toque_unico: 'Trae binoculares para ti y te enseñará a escuchar a las aves.',
          lema_seccion: 'La montaña habla, yo solo traduzco.',
          enfoque_de_ruta: 'La niebla como refugio de aves',
          manifiesto_ruta:
            'Cada amanecer en Ambalá el bosque me regala un canto nuevo. Mi trabajo es que tú también aprendas a escucharlo.',
          momento_favorito_ruta:
            'Cuando la niebla se abre de golpe y aparece el barranquero posado a tres metros de nosotros.',
          destacados_unicos: [
            'Registro de más de 40 especies de aves en la ruta',
            'Binoculares profesionales incluidos para cada visitante',
            'Bitácora de avistamiento de regalo',
          ],
          recomendaciones_especificas:
            'Madruga: los mejores avistamientos ocurren antes de las 8 a.m. Trae ropa de colores neutros para no espantar a las aves.',
        },
        {
          anfitrion_id: 'marina',
          precio_personalizado: 85000,
          url_reservas: 'https://reservas.iwage.co/es/',
          superpoder_en_esta_ruta: 'Conocimiento Botánico Histórico',
          toque_unico: 'Te enseñará a hacer infusiones curativas en el camino.',
          lema_seccion: 'Cada planta guarda una historia de mi abuela.',
          enfoque_de_ruta: 'Botánica ancestral del bosque altoandino',
          manifiesto_ruta:
            'Crecí recolectando hierbas con mi abuela en estas laderas. Caminar contigo es seguir pasando ese saber de mano en mano.',
          momento_favorito_ruta:
            'Preparar la infusión de yerbabuena y flor de saúco justo cuando la niebla envuelve el fogón.',
          destacados_unicos: [
            'Herbario vivo con más de 25 plantas medicinales',
            'Taller de infusiones incluido en la ruta',
            'Recetario botánico artesanal de recuerdo',
          ],
          recomendaciones_especificas:
            'Trae un termo pequeño para llevarte tu infusión favorita y cuaderno si quieres anotar las recetas.',
        },
      ],
      propiedades: { connect: [{ documentId: PROPIEDAD_EL_MIRADOR }] },
    },
  },
  {
    slug: 'la-senda-del-cacao',
    documentId: 'oc8nskxhus79yj28ruzchc66',
    data: {
      es_destacado: true,
      tour_360_url: 'https://roundme.com/tour/318047/view/1042784/',
      link_drone: 'https://www.youtube.com/watch?v=F3a3gHtiT1o',
      mapa_imagen_url:
        'https://images.unsplash.com/photo-1502920514313-52581002a659?auto=format&fit=crop&q=80&w=1200',
      seo_titulo: 'La Senda del Cacao Amazónico · Iwagé Naturaleza',
      seo_descripcion:
        'Vive el cacao fino de aroma desde la mazorca hasta la taza en una finca agroecológica gestionada por Iwagé. Cata de chocolate y bebida ancestral. Desde $110.000 COP.',
      safety_content: {
        title: 'Una finca preparada para recibirte',
        description:
          'La finca es gestionada directamente por Iwagé: senderos delimitados, estaciones techadas y protocolos de higiene certificados en la zona de transformación del cacao. Ideal para familias.',
        features: [
          'Seguro de asistencia médica Colasistencia',
          'Apta para niños desde los 4 años',
          'Senderos planos y delimitados',
          'Zona de transformación con protocolos de higiene',
          'Botiquín y personal de primeros auxilios en finca',
        ],
      },
      paquetes_upsell: [
        {
          title: 'Del Árbol a la Barra (2D/1N)',
          tagline: 'Duerme entre cacaotales y despierta con chocolate recién molido.',
          duration: '2 Días / 1 Noche',
          price: 320000,
          includes: [
            'Alojamiento en la casa de la finca',
            'Cena de la huerta y desayuno campesino',
            'Taller nocturno de tableteo de chocolate',
            'Tu propia barra de cacao 70% para llevar',
          ],
        },
      ],
      itinerario_sensorial: [
        {
          time: 'Mañana',
          title: 'Corazón de Mazorca',
          sense: 'Gusto & Tacto',
          desc: 'Prueba el mucílago fresco.',
          iconName: 'SunDim',
        },
        {
          time: 'Media mañana',
          title: 'El Bosque del Cacao',
          sense: 'Vista & Oído',
          desc: 'Recorrido por el sistema agroforestal: plátano, nogales y cacao conviven con aves que Camilo te ayuda a identificar.',
          iconName: 'TreePine',
        },
        {
          time: 'Mediodía',
          title: 'Fermento y Secado',
          sense: 'Olfato & Asombro',
          desc: 'Descubre el secreto del cacao fino de aroma: cajones de fermentación y marquesinas de secado al sol.',
          iconName: 'Sun',
        },
        {
          time: 'Tarde',
          title: 'La Alquimia del Chocolate',
          sense: 'Gusto & Comunidad',
          desc: 'Tostión, molienda y cata con Marina: del grano a la bebida ancestral y al chocolate que tú mismo preparas.',
          iconName: 'Coffee',
        },
      ],
      galeria_urls: [
        {
          url: 'https://images.unsplash.com/photo-1542840410-3092f99611a3?auto=format&fit=crop&q=80&w=1000',
          tipo: 'image',
          titulo: 'Cosecha cacao',
        },
        {
          url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=1000',
          tipo: 'image',
          titulo: 'Cacao en transformación',
        },
        {
          url: 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?auto=format&fit=crop&q=80&w=1000',
          tipo: 'image',
          titulo: 'Chocolate artesanal',
        },
        {
          url: 'https://www.youtube.com/watch?v=F3a3gHtiT1o',
          tipo: 'video',
          titulo: 'La senda en video',
        },
      ],
      faqs: [
        {
          question: '¿Pueden ir niños?',
          answer: '¡Ideal para familias! Los niños aman el proceso del chocolate.',
        },
        {
          question: '¿Cuánto chocolate me llevo a casa?',
          answer:
            'Cada visitante prepara y se lleva su propia porción de chocolate de mesa. Puedes comprar barras adicionales directamente a la finca.',
        },
        {
          question: '¿El precio cambia según el anfitrión?',
          answer:
            'Sí. Con Marina la senda cuesta desde $110.000 y con Camilo desde $135.000 por persona: cada uno la guía desde su especialidad.',
        },
        {
          question: '¿Es apta para personas con movilidad reducida?',
          answer:
            'La mayor parte del recorrido es plana y por senderos delimitados. Escríbenos antes de reservar y adaptamos la ruta a tu ritmo.',
        },
      ],
      anfitriones_data: [
        {
          anfitrion_id: 'camilo',
          precio_personalizado: 135000,
          url_reservas: 'https://reservas.iwage.co/es/',
          superpoder_en_esta_ruta: 'Conocimiento Agroforestal',
          toque_unico: 'El cacao como refugio para las aves.',
          enfoque_de_ruta: 'El cacao como ecosistema vivo.',
          lema_seccion: 'Un cacaotal sano suena a pájaros.',
          manifiesto_ruta:
            'El cacao no es un cultivo: es un bosque que alimenta. Te muestro cómo cada árbol sostiene la vida que lo rodea.',
          momento_favorito_ruta:
            'Abrir una mazorca madura bajo la sombra de los nogales mientras las tangaras revolotean sobre nosotros.',
          destacados_unicos: [
            'Recorrido por el sistema agroforestal completo',
            'Avistamiento de aves entre cacaotales',
            'Explicación de la certificación agroecológica de la finca',
          ],
          recomendaciones_especificas:
            'Usa repelente natural (en la finca te ofrecemos) y camisa de manga larga: el cacaotal es hogar de muchos insectos benéficos.',
        },
        {
          anfitrion_id: 'marina',
          precio_personalizado: 110000,
          url_reservas: 'https://reservas.iwage.co/es/',
          superpoder_en_esta_ruta: 'Experta en Recetas de Chocolate',
          toque_unico: 'Preparación de bebida de cacao ancestral.',
          enfoque_de_ruta: 'Inmersión en la alquimia del cacao.',
          lema_seccion: 'El chocolate se cocina con memoria.',
          manifiesto_ruta:
            'Del fogón de mi abuela aprendí que el cacao se agradece antes de molerlo. En esta senda cocinamos esa memoria juntos.',
          momento_favorito_ruta:
            'El silencio que se hace cuando todos prueban la bebida ancestral por primera vez, todavía tibia del fogón.',
          destacados_unicos: [
            'Taller de bebida de cacao ancestral en fogón de leña',
            'Cata guiada de tres orígenes de cacao tolimense',
            'Receta familiar de chocolate de mesa para llevar',
          ],
          recomendaciones_especificas:
            'Ven con apetito: entre mucílago, cata y bebida ancestral, el cacao será tu menú del día. Avísanos si tienes alergias alimentarias.',
        },
      ],
      propiedades: { connect: [{ documentId: PROPIEDAD_EL_MIRADOR }] },
    },
  },
];

async function actualizar(ficha) {
  const res = await fetch(`${STRAPI_URL}/api/experiencias/${ficha.documentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ data: ficha.data }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT ${ficha.slug} → HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  console.log(`✔ ${ficha.slug} actualizada (id ${json.data?.id ?? '?'})`);
}

async function main() {
  console.log(`Strapi: ${STRAPI_URL}`);
  for (const ficha of FICHAS) {
    await actualizar(ficha);
  }
  console.log('Listo. Recuerda invalidar la caché Redis (strapi:experiencia:*).');
}

main().catch((err) => {
  console.error('✖ Error:', err.message);
  process.exit(1);
});
