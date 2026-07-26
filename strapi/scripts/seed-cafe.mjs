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
  { nombre: 'Café de origen Ambalá', historia: 'Cultivado a 1,400 m.s.n.m. por la familia Cardona. Notas de panela y cítricos.', tags: ['Origen único', 'Tueste medio'], precio: '$6.500', destacado: true, categoria: 'cafe', orden: 1 },
  { nombre: 'Espresso doble', historia: 'Doble shot de nuestro blend house. Cuerpo medio, final dulce.', tags: ['Clásico'], precio: '$5.000', destacado: false, categoria: 'cafe', orden: 2 },
  { nombre: 'Café con miel de Angelita', historia: 'Espresso con miel cruda de Tetragonisca angustula. Dulzor floral sin azúcar.', tags: ['De la casa'], precio: '$7.500', destacado: false, categoria: 'cafe', orden: 3 },
  { nombre: 'Miel de Angelita con café', historia: 'Infusión de miel cruda de T. angustula en espresso doble. Dulzor natural sin azúcar.', tags: ['Signature', 'Sin azúcar'], precio: '$9.000', destacado: true, categoria: 'signature', orden: 1 },
  { nombre: 'Latte de miel y canela', historia: 'Leche de la Finca La Cumbre, espresso doble, miel de Angelita y canela del Huila.', tags: ['Signature', 'Caliente'], precio: '$9.500', destacado: true, categoria: 'signature', orden: 2 },
  { nombre: 'Aromática de flora nativa', historia: 'Blend de hierbas del corredor: hierbabuena, limoncillo y flor de guamo.', tags: ['Sin cafeína', 'Herbal'], precio: '$5.500', destacado: false, categoria: 'infusion', orden: 1 },
  { nombre: 'Té de guayaba agria', historia: 'Hojas frescas de guayaba agria del corredor. Digestivo natural.', tags: ['Sin cafeína', 'Digestivo'], precio: '$5.000', destacado: false, categoria: 'infusion', orden: 2 },
  { nombre: 'Cold brew Ambalá', historia: 'Extracción en frío 18 horas. Suave, dulce, sin amargor. Servido con hielo de la finca.', tags: ['Frío', '18h extracción'], precio: '$8.000', destacado: false, categoria: 'frio', orden: 1 },
  { nombre: 'Chocolate de cacao local', historia: 'Cacao de El Espinal, preparado con leche de la finca La Cumbre.', tags: ['Caliente', 'Local'], precio: '$7.000', destacado: false, categoria: 'acompanamiento', orden: 1 },
  { nombre: 'Queso de la Cumbre con arepa', historia: 'Queso fresco del día, arepa de maíz pelado. El desayuno del territorio.', tags: ['Local', 'Desayuno'], precio: '$8.500', destacado: false, categoria: 'acompanamiento', orden: 2 },
];

const proveedores = [
  { nombre: 'Meliponario Iwagé', producto: 'Miel de Angelita', ubicacion: 'Corredor Ambalá', distancia_km: 0.2, historia: 'Nuestra propia miel de Tetragonisca angustula. Cosecha limitada, dulzor floral único.', orden: 0 },
  { nombre: 'Familia Cardona', producto: 'Café de origen', ubicacion: 'Vereda El Carmen', distancia_km: 2.3, historia: 'Tres generaciones cultivando café en las laderas del Ambalá. Tueste medio, notas de panela y cítricos.', orden: 1 },
  { nombre: 'Finca La Cumbre', producto: 'Leche y quesos', ubicacion: 'Cajamarca', distancia_km: 3.8, historia: 'Ganadería regenerativa a pequeña escala. Leche cruda para nuestro chocolate y quesos de temporada.', orden: 2 },
  { nombre: 'Cacao El Espinal', producto: 'Cacao fino de aroma', ubicacion: 'El Espinal', distancia_km: 38, historia: 'La excepción a nuestra regla de 4 km. Cacao fino de aroma del valle del Magdalena, fermentado 5 días.', orden: 3 },
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
      // Check if exists by nombre
      const existing = await api('GET', `item-menus?filters[nombre][$eq]=${encodeURIComponent(item.nombre)}`);
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

  console.log('\n✅ Café seed complete!');
}

seed().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
