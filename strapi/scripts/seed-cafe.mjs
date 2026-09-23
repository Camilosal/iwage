/**
 * Seed script for Café Iwagé content types.
 * Usage: node strapi/scripts/seed-cafe.mjs
 * Requires: STRAPI_URL and STRAPI_TOKEN env vars (or defaults to localhost:1337)
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {}),
};

async function api(method, endpoint, body) {
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${endpoint} → ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Data ───────────────────────────────────────────────

const cafeConfig = {
  data: {
    titulo: 'El territorio en cada taza',
    descripcion: 'Un café comunitario construido sobre ingredientes nombrados, proveedores a menos de 4 km y un menú donde cada producto es un personaje.',
    horario: 'Lunes a Sábado\n7:00 am – 5:00 pm\nDomingos: 8:00 am – 1:00 pm',
    direccion: 'Corredor Ambalá, Ibagué, Tolima',
    telefono: '+57 300 123 4567',
    whatsapp: '573001234567',
    instagram: '@cafe.iwage',
    email: 'cafe@iwage.co',
    b2b_titulo: '¿Quieres nuestro café en tu negocio?',
    b2b_descripcion: 'Suministro de café de origen y miel de Angelita para restaurantes, hoteles y tiendas especializadas. Tostamos bajo pedido.',
    b2b_whatsapp: '573001234567',
    mapa_url: 'https://maps.google.com/?q=Corredor+Ambala+Ibague',
  },
};

const menuItems = [
  // ── Café de origen Ambalá: 3 variaciones de tamaño (familia 'cafe-ambala') ──
  { nombre: 'Café de origen Ambalá', slug: 'cafe-ambala-pequeno', historia: 'Cultivado a 1,400 m.s.n.m. por la familia Cardona. Notas de panela y cítricos. Taza de 8 oz.', tags: ['Origen único', 'Tueste medio'], precio: '$5.500', destacado: true, categoria: 'cafe', orden: 1, familia: 'cafe-ambala', etiqueta_variacion: 'Pequeño · 8 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Café de origen Ambalá', slug: 'cafe-ambala-mediano', historia: 'Cultivado a 1,400 m.s.n.m. por la familia Cardona. Notas de panela y cítricos. Taza de 12 oz.', tags: ['Origen único', 'Tueste medio'], precio: '$6.500', destacado: false, categoria: 'cafe', orden: 2, familia: 'cafe-ambala', etiqueta_variacion: 'Mediano · 12 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Café de origen Ambalá', slug: 'cafe-ambala-grande', historia: 'Cultivado a 1,400 m.s.n.m. por la familia Cardona. Notas de panela y cítricos. Taza de 16 oz.', tags: ['Origen único', 'Tueste medio'], precio: '$7.500', destacado: false, categoria: 'cafe', orden: 3, familia: 'cafe-ambala', etiqueta_variacion: 'Grande · 16 oz', eje_variacion: 'Tamaño' },
  // ── Espresso (sin variaciones) ──
  { nombre: 'Espresso doble', historia: 'Doble shot de nuestro blend house. Cuerpo medio, final dulce.', tags: ['Clásico'], precio: '$5.000', destacado: false, categoria: 'cafe', orden: 4 },
  { nombre: 'Café con miel de Angelita', historia: 'Espresso con miel cruda de Tetragonisca angustula. Dulzor floral sin azúcar.', tags: ['De la casa'], precio: '$7.500', destacado: false, categoria: 'cafe', orden: 5 },
  // ── Signature: Miel de Angelita con café (familia 'miel-cafe', eje: Tamaño) ──
  { nombre: 'Miel de Angelita con café', slug: 'miel-cafe-8oz', historia: 'Infusión de miel cruda de T. angustula en espresso doble. Dulzor natural sin azúcar.', tags: ['Signature', 'Sin azúcar'], precio: '$9.000', destacado: true, categoria: 'signature', orden: 1, familia: 'miel-cafe', etiqueta_variacion: 'Taza · 8 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Miel de Angelita con café', slug: 'miel-cafe-12oz', historia: 'Infusión de miel cruda de T. angustula en espresso doble. Dulzor natural sin azúcar.', tags: ['Signature', 'Sin azúcar'], precio: '$11.000', destacado: false, categoria: 'signature', orden: 2, familia: 'miel-cafe', etiqueta_variacion: 'Grande · 12 oz', eje_variacion: 'Tamaño' },
  // ── Signature: Latte de miel y canela (familia 'latte-miel', eje: Tamaño) ──
  { nombre: 'Latte de miel y canela', slug: 'latte-miel-8oz', historia: 'Leche de la Finca La Cumbre, espresso doble, miel de Angelita y canela del Huila.', tags: ['Signature', 'Caliente'], precio: '$9.500', destacado: true, categoria: 'signature', orden: 3, familia: 'latte-miel', etiqueta_variacion: 'Taza · 8 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Latte de miel y canela', slug: 'latte-miel-12oz', historia: 'Leche de la Finca La Cumbre, espresso doble, miel de Angelita y canela del Huila.', tags: ['Signature', 'Caliente'], precio: '$11.500', destacado: false, categoria: 'signature', orden: 4, familia: 'latte-miel', etiqueta_variacion: 'Grande · 12 oz', eje_variacion: 'Tamaño' },
  // ── Aromática de flora nativa (familia 'aromatica-flora', eje: Sabor) ──
  { nombre: 'Aromática de flora nativa', slug: 'aromatica-hierbabuena', historia: 'Blend de hierbas del corredor: hierbabuena, limoncillo y flor de guamo.', tags: ['Sin cafeína', 'Herbal'], precio: '$5.500', destacado: false, categoria: 'infusion', orden: 1, familia: 'aromatica-flora', etiqueta_variacion: 'Hierbabuena', eje_variacion: 'Sabor' },
  { nombre: 'Aromática de flora nativa', slug: 'aromatica-limoncillo', historia: 'Infusión de limoncillo fresco del corredor. Cítrico, refrescante, digestivo.', tags: ['Sin cafeína', 'Herbal'], precio: '$5.500', destacado: false, categoria: 'infusion', orden: 2, familia: 'aromatica-flora', etiqueta_variacion: 'Limoncillo', eje_variacion: 'Sabor' },
  { nombre: 'Aromática de flora nativa', slug: 'aromatica-guamo', historia: 'Flor de guamo recolectada en el corredor. Floral, suave, aromática.', tags: ['Sin cafeína', 'Floral'], precio: '$6.000', destacado: false, categoria: 'infusion', orden: 3, familia: 'aromatica-flora', etiqueta_variacion: 'Flor de guamo', eje_variacion: 'Sabor' },
  { nombre: 'Té de guayaba agria', historia: 'Hojas frescas de guayaba agria del corredor. Digestivo natural.', tags: ['Sin cafeína', 'Digestivo'], precio: '$5.000', destacado: false, categoria: 'infusion', orden: 4 },
  // ── Cold brew Ambalá (familia 'cold-brew', eje: Tamaño) ──
  { nombre: 'Cold brew Ambalá', slug: 'cold-brew-8oz', historia: 'Extracción en frío 18 horas. Suave, dulce, sin amargor. Servido con hielo de la finca.', tags: ['Frío', '18h extracción'], precio: '$8.000', destacado: false, categoria: 'frio', orden: 1, familia: 'cold-brew', etiqueta_variacion: 'Vaso · 8 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Cold brew Ambalá', slug: 'cold-brew-16oz', historia: 'Extracción en frío 18 horas. Suave, dulce, sin amargor. Servido con hielo de la finca.', tags: ['Frío', '18h extracción'], precio: '$11.000', destacado: false, categoria: 'frio', orden: 2, familia: 'cold-brew', etiqueta_variacion: 'Grande · 16 oz', eje_variacion: 'Tamaño' },
  // ── Chocolate de cacao local (familia 'chocolate-local', eje: Tamaño) ──
  { nombre: 'Chocolate de cacao local', slug: 'chocolate-8oz', historia: 'Cacao de El Espinal, preparado con leche de la finca La Cumbre.', tags: ['Caliente', 'Local'], precio: '$7.000', destacado: false, categoria: 'acompanamiento', orden: 1, familia: 'chocolate-local', etiqueta_variacion: 'Taza · 8 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Chocolate de cacao local', slug: 'chocolate-12oz', historia: 'Cacao de El Espinal, preparado con leche de la finca La Cumbre.', tags: ['Caliente', 'Local'], precio: '$9.000', destacado: false, categoria: 'acompanamiento', orden: 2, familia: 'chocolate-local', etiqueta_variacion: 'Grande · 12 oz', eje_variacion: 'Tamaño' },
  { nombre: 'Queso de la Cumbre con arepa', historia: 'Queso fresco del día, arepa de maíz pelado. El desayuno del territorio.', tags: ['Local', 'Desayuno'], precio: '$8.500', destacado: false, categoria: 'acompanamiento', orden: 3 },
];

const proveedores = [
  { nombre: 'Meliponario Iwagé', producto: 'Miel de Angelita', ubicacion: 'Corredor Ambalá', distancia_km: 0.2, historia: 'Nuestra propia miel de Tetragonisca angustula. Cosecha limitada, dulzor floral único.', orden: 0 },
  { nombre: 'Familia Cardona', producto: 'Café de origen', ubicacion: 'Vereda El Carmen', distancia_km: 2.3, historia: 'Tres generaciones cultivando café en las laderas del Ambalá. Tueste medio, notas de panela y cítricos.', orden: 1 },
  { nombre: 'Finca La Cumbre', producto: 'Leche y quesos', ubicacion: 'Cajamarca', distancia_km: 3.8, historia: 'Ganadería regenerativa a pequeña escala. Leche cruda para nuestro chocolate y quesos de temporada.', orden: 2 },
  { nombre: 'Cacao El Espinal', producto: 'Cacao fino de aroma', ubicacion: 'El Espinal', distancia_km: 38, historia: 'La excepción a nuestra regla de 4 km. Cacao fino de aroma del valle del Magdalena, fermentado 5 días.', orden: 3 },
];

const historiaVisitantes = [
  // Fauna
  { titulo: 'El colibrí de garganta azul', categoria: 'fauna', icono: 'bird', texto_corto: 'Aparece cada mañana a las 6:40. Primero al limoncillo de la entrada, luego al guamo del costado.', texto_largo: 'Es un Chlorostilbon mellisugus, colibrí esmeralda. Lleva tres temporadas anidando en las heliconias del corredor. No le asusta la gente: se acerca al vaso mientras tomas café y te mira fijo, como evaluando si tu mesa tiene más néctar que la suya.', orden: 1 },
  { titulo: 'Las angelitas del techo', categoria: 'fauna', icono: 'bug', texto_corto: 'Una colonia de Tetragonisca angustula se instaló en el alero del café hace dos años.', texto_largo: 'No pican. Producen miel que usamos en el signature "Miel de Angelita con café". Los clientes las señalan como si fueran mascotas del local. Un día un niño preguntó: "¿son abejas buenas?" — y sí, lo son. Polinizan el cafetal y el guamo en un radio de 300 metros.', orden: 2 },
  { titulo: 'El carpintero que llegó en enero', categoria: 'fauna', icono: 'bird', texto_corto: 'Un carpintero dorado empezó a percutir el poste de guadua del jardín en enero de 2025.', texto_largo: 'Nadie sabe si anidó o solo estaba marcando territorio. Lo cierto es que cada mañana repite su ritmo: tres golpes, pausa, dos golpes, pausa. Los clientes del desayuno ya lo conocen. Algunos le pusieron nombre: Don Tres-Dos.', orden: 3 },
  // Flora
  { titulo: 'El guamo centinela', categoria: 'flora', icono: 'tree-pine', texto_corto: 'Tiene más de 40 años. Da sombra a la mitad del jardín y flores dulces de diciembre a marzo.', texto_largo: 'Es un Inga spectabilis. Sus vainas contienen una pulpa blanca que los clientes prueban cuando caen al suelo. Las abejas angelitas y los colibríes dependen de él. Cuando florece, el café huele diferente: más dulce, más denso. Es el árbol que marca las estaciones del territorio.', orden: 1 },
  { titulo: 'Las aromáticas del corredor', categoria: 'flora', icono: 'leaf', texto_corto: 'Hierbabuena, limoncillo, albahaca morada y flor de guamo. Todas crecen a menos de 50 metros de la barra.', texto_largo: 'Las usamos frescas en las infusiones de la carta "Aromática de flora nativa". La hierbabuena crece sin control en la zona húmeda; el limoncillo lo plantó Don Manuel hace tres años; la albahaca morada llegó como experimento y se quedó porque los clientes la piden. Cada infusión tiene el sabor exacto del jardín.', orden: 2 },
  { titulo: 'El cafetal de sombra', categoria: 'flora', icono: 'trees', texto_corto: 'Las matas de café crecen bajo el dosel del guamo y los plátanos. No es café de sol.', texto_largo: 'Es un café Caturra sembrado a 1.400 m.s.n.m. por la familia Cardona. Madura lento, produce menos pero con más densidad. Las cerezas se cosechan a mano cuando están completamente rojas. El cafetal no es solo producción: es el hábitat de las 32 especies de aves que visitan el jardín.', orden: 3 },
  // Personas
  { titulo: 'Doña Nelly y la receta del pandebono', categoria: 'personas', icono: 'heart-handshake', texto_corto: 'Llegó un martes de mercado. Probó el pan de yuca y dijo: "así no se hace, pero está rico".', texto_largo: 'Doña Nelly tiene 74 años y vende almojábanas en el mercado de Ibagué desde hace 40. Nos enseñó que el almidón de yuca del Espinal no se amasa igual si hace frío. Su receta no es la nuestra, pero nos dio permiso de llamarlo "Pan de yuca estilo Doña Nelly". Ahora viene cada quince días y siempre pide un café pequeño.', orden: 1 },
  { titulo: 'El ingeniero que se quedó a vivir', categoria: 'personas', icono: 'laptop', texto_corto: 'Vino de Bogotá un fin de semana con su laptop. Se quedó tres meses.', texto_largo: 'Andrés trabaja remoto para una startup de logística. Llegó al café un sábado, pidió un espresso, abrió su computador y no se fue hasta el cierre. Al lunes siguiente ya tenía mesa fija. Ahora vive en Cajamarca, viene al café cada mañana y paga la renta con lo que ahorra de no vivir en Bogotá. Dice que el wifi funciona bien y que el café le cambia el día.', orden: 2 },
  { titulo: 'Los niños de la vereda', categoria: 'personas', icono: 'users', texto_corto: 'Cada sábado llegan 4 o 5 niños de la vereda El Carmen. Piden chocolate y se llevan las cáscaras de cacao.', texto_largo: 'No tienen más de 10 años. Llegan caminando desde la finca de sus padres, algunos descalzos. Piden chocolate con leche de La Cumbre y se sientan en el suelo a dibujar. Las cáscaras de cacao se las llevan para compostar en sus huertas escolares. Un día uno de ellos preguntó: "¿ustedes también son de aquí?" — y sí, también somos de aquí.', orden: 3 },
];

// ── Seed Logic ─────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding Café Iwagé content...\n');

  // 1. Cafe Config (single type — PUT)
  console.log('→ Upserting cafe-config...');
  try {
    await api('PUT', 'cafe-config', cafeConfig);
    console.log('  ✓ cafe-config updated');
  } catch (e) {
    console.error('  ✗ cafe-config failed:', e.message);
  }

  // 2. Menu Items
  console.log('\n→ Seeding item-menus...');
  for (const item of menuItems) {
    try {
      // Check if exists by slug (las variaciones comparten nombre) or nombre
      const filter = item.slug
        ? `item-menus?filters[slug][$eq]=${encodeURIComponent(item.slug)}`
        : `item-menus?filters[nombre][$eq]=${encodeURIComponent(item.nombre)}`;
      const existing = await api('GET', filter);
      if (existing.data?.length > 0) {
        const docId = existing.data[0].documentId;
        await api('PUT', `item-menus/${docId}`, { data: item });
        console.log(`  ✓ Updated: ${item.nombre}`);
      } else {
        await api('POST', 'item-menus', { data: item });
        console.log(`  ✓ Created: ${item.nombre}`);
      }
    } catch (e) {
      console.error(`  ✗ ${item.nombre}:`, e.message);
    }
  }

  // 3. Proveedores
  console.log('\n→ Seeding proveedors...');
  for (const prov of proveedores) {
    try {
      const existing = await api('GET', `proveedors?filters[nombre][$eq]=${encodeURIComponent(prov.nombre)}`);
      if (existing.data?.length > 0) {
        const docId = existing.data[0].documentId;
        await api('PUT', `proveedors/${docId}`, { data: prov });
        console.log(`  ✓ Updated: ${prov.nombre}`);
      } else {
        await api('POST', 'proveedors', { data: prov });
        console.log(`  ✓ Created: ${prov.nombre}`);
      }
    } catch (e) {
      console.error(`  ✗ ${prov.nombre}:`, e.message);
    }
  }

  // 4. Historias Visitantes
  console.log('\n→ Seeding historia-visitantes...');
  for (const h of historiaVisitantes) {
    try {
      const existing = await api('GET', `historia-visitantes?filters[titulo][$eq]=${encodeURIComponent(h.titulo)}`);
      if (existing.data?.length > 0) {
        const docId = existing.data[0].documentId;
        await api('PUT', `historia-visitantes/${docId}`, { data: h });
        console.log(`  ✓ Updated: ${h.titulo}`);
      } else {
        await api('POST', 'historia-visitantes', { data: h });
        console.log(`  ✓ Created: ${h.titulo}`);
      }
    } catch (e) {
      console.error(`  ✗ ${h.titulo}:`, e.message);
    }
  }

  console.log('\n✅ Café seed complete!');
}

seed().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
