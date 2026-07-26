// Seed script for Propiedades en Gestión (demo data)
// Run: node scripts/seed-gestion.mjs
// Requires: STRAPI_URL env var pointing to running Strapi instance

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

async function create(endpoint, data) {
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error(`Error creating ${endpoint}:`, JSON.stringify(err, null, 2));
    return null;
  }
  const json = await res.json();
  console.log(`✓ Created ${endpoint}: ${data.titulo}`);
  return json.data;
}

async function seed() {
  console.log('🏡 Seeding Propiedades en Gestión...\n');

  // ─── RENTA CORTA ───────────────────────────────────────────────
  await create('propiedades-gestion', {
    titulo: 'Casa Guamo — Renta Corta Premium',
    slug: 'casa-guamo-renta-corta',
    descripcion: `Casa campestre de arquitectura bioclimática ubicada en el corredor ecológico del río Guamo. Diseñada para huéspedes que buscan desconexión total sin sacrificar confort.\n\nCuenta con piscina infinita con vista al valle, cocina abierta equipada, zona de fogata y sendero privado hacia la quebrada. A 25 minutos de Ibagué por vía pavimentada.\n\n**Incluye:** WiFi satelital (Starlink), smart TV, BBQ, hamacas, bicicletas de montaña y kit de bienvenida con productos locales del Café Iwagé.`,
    tipo_gestion: 'renta_corta',
    modelo_alianza: 'gestion_pura',
    estado: 'activa',
    es_destacado: true,
    publicado: true,
    precio_noche: 450000,
    precio_mensual: null,
    moneda: 'COP',
    ubicacion_municipio: 'San Luis',
    ubicacion_latitud: 4.1283,
    ubicacion_longitud: -75.0942,
    area_hectareas: 1.2,
    numero_habitaciones: 3,
    numero_banos: 2,
    capacidad_huespedes: 8,
    amenidades: ['Piscina infinita', 'WiFi Starlink', 'Cocina equipada', 'Zona BBQ', 'Fogata', 'Sendero privado', 'Bicicletas MTB', 'Hamacas', 'Parqueadero', 'Agua de nacimiento'],
    highlights: ['Vista panorámica al valle del Guamo', 'Arquitectura bioclimática', 'A 25 min de Ibagué', 'Ocupación promedio 78%', 'Rating 4.9 en Airbnb'],
    seo_titulo: 'Casa Guamo · Renta Corta Premium en San Luis, Tolima | Iwagé Gestión',
    seo_descripcion: 'Casa campestre premium para renta corta en San Luis, Tolima. Piscina infinita, WiFi satelital, 3 habitaciones. Gestión integral por Iwagé.',
  });

  // ─── FINCA PRODUCTIVA ──────────────────────────────────────────
  await create('propiedades-gestion', {
    titulo: 'Finca El Carmen — Café y Aguacate',
    slug: 'finca-el-carmen-productiva',
    descripcion: `Finca productiva de 12 hectáreas con cultivo de café Caturra (6 ha) y aguacate Hass (4 ha) en producción. Infraestructura completa: beneficiadero húmedo, secadero solar, bodega de insumos y casa de administración.\n\nProducción anual: 8,500 kg de café pergamino seco y 15 toneladas de aguacate. Cuenta con certificación de buenas prácticas agrícolas y registro ICA vigente.\n\nIwagé Gestión supervisa: labores agronómicas, nómina de 4 trabajadores permanentes, inventarios, comercialización y reportes mensuales de productividad por hectárea.`,
    tipo_gestion: 'finca_productiva',
    modelo_alianza: 'co_inversion',
    estado: 'activa',
    es_destacado: true,
    publicado: true,
    precio_noche: null,
    precio_mensual: 2800000,
    moneda: 'COP',
    ubicacion_municipio: 'Ibagué (Vereda El Carmen)',
    ubicacion_latitud: 4.3981,
    ubicacion_longitud: -75.2106,
    area_hectareas: 12.0,
    numero_habitaciones: 4,
    numero_banos: 2,
    capacidad_huespedes: null,
    amenidades: ['Beneficiadero húmedo', 'Secadero solar', 'Bodega de insumos', 'Casa administración', 'Acueducto veredal', 'Energía trifásica', 'Vía carreteable', 'Reserva hídrica'],
    highlights: ['8,500 kg café/año', '15 ton aguacate Hass/año', 'Certificación BPA vigente', '4 trabajadores permanentes', 'ROI agrícola 14% anual'],
    seo_titulo: 'Finca El Carmen · Gestión de Finca Productiva en Ibagué | Iwagé Gestión',
    seo_descripcion: 'Finca productiva de café y aguacate en Ibagué, Tolima. Gestión agronómica integral, reportes de productividad y supervisión de personal.',
  });

  // ─── SEGUNDA RESIDENCIA ────────────────────────────────────────
  await create('propiedades-gestion', {
    titulo: 'Villa Serena — Segunda Residencia Campestre',
    slug: 'villa-serena-segunda-residencia',
    descripcion: `Residencia campestre de alto valor en condominio cerrado a 15 minutos del centro de Ibagué. Propiedad de familia residente en Bogotá que requiere supervisión permanente y mantenimiento preventivo.\n\nCasa principal de 280 m² con 4 habitaciones, piscina climatizada, jardines ornamentales (2,000 m²) y zona de mascotas. Adicional: casa de mayordomo independiente.\n\n**Servicios de gestión:** Mantenimiento semanal de piscina y jardines, supervisión de mayordomo y jardinero, pago de servicios e impuestos, informes fotográficos mensuales, coordinación de visitas del propietario y control de plagas trimestral.`,
    tipo_gestion: 'segunda_residencia',
    modelo_alianza: 'gestion_pura',
    estado: 'activa',
    es_destacado: false,
    publicado: true,
    precio_noche: null,
    precio_mensual: 1800000,
    moneda: 'COP',
    ubicacion_municipio: 'Ibagué',
    ubicacion_latitud: 4.4389,
    ubicacion_longitud: -75.2322,
    area_hectareas: 0.5,
    numero_habitaciones: 4,
    numero_banos: 3,
    capacidad_huespedes: 10,
    amenidades: ['Piscina climatizada', 'Jardines ornamentales', 'Casa de mayordomo', 'Condominio cerrado', 'Vigilancia 24/7', 'Planta eléctrica', 'Pozo séptico', 'Zona de mascotas', 'Gimnasio', 'Sauna'],
    highlights: ['280 m² construidos', 'Condominio con vigilancia 24/7', 'A 15 min del centro de Ibagué', 'Informes fotográficos mensuales', 'Personal supervisado (2 empleados)'],
    seo_titulo: 'Villa Serena · Administración de Segunda Residencia en Ibagué | Iwagé Gestión',
    seo_descripcion: 'Administración integral de segunda residencia campestre en Ibagué. Mantenimiento, supervisión de personal, informes mensuales. Iwagé Gestión.',
  });

  // ─── OPERACIÓN TURÍSTICA ───────────────────────────────────────
  await create('propiedades-gestion', {
    titulo: 'EcoRetiro Ambalá — Glamping & Experiencias',
    slug: 'ecoretiro-ambala-operacion-turistica',
    descripcion: `Proyecto de ecoturismo en operación con 6 domos geodésicos de lujo, zona de camping premium, restaurante de cocina local y senderos interpretativos en bosque de niebla.\n\nUbicado a 1,800 m.s.n.m. en el corredor ecológico del cañón del Combeima, con acceso a cascadas, avistamiento de aves (120+ especies registradas) y conexión directa con experiencias de Iwagé Naturaleza.\n\n**Modelo de operación compartida:** El propietario aporta la infraestructura, Iwagé opera: branding, marketing digital, gestión de reservas (plataforma propia + OTAs), personal operativo (5 personas), programación de experiencias y mantenimiento.\n\nOcupación promedio: 65% entre semana, 92% fines de semana. ADR: $380,000/noche.`,
    tipo_gestion: 'operacion_turistica',
    modelo_alianza: 'operacion_compartida',
    estado: 'activa',
    es_destacado: true,
    publicado: true,
    precio_noche: 380000,
    precio_mensual: null,
    moneda: 'COP',
    ubicacion_municipio: 'Ibagué (Cañón del Combeima)',
    ubicacion_latitud: 4.4856,
    ubicacion_longitud: -75.2891,
    area_hectareas: 8.5,
    numero_habitaciones: 6,
    numero_banos: 6,
    capacidad_huespedes: 18,
    amenidades: ['6 domos geodésicos', 'Restaurante cocina local', 'Senderos interpretativos', 'Zona camping premium', 'Avistamiento de aves', 'Cascada privada', 'WiFi zonas comunes', 'Parqueadero', 'Zona de yoga', 'Fogatero'],
    highlights: ['1,800 m.s.n.m. bosque de niebla', '120+ especies de aves', 'Ocupación 92% fines de semana', 'ADR $380,000/noche', 'Conexión con experiencias Iwagé Naturaleza', '5 empleos locales generados'],
    seo_titulo: 'EcoRetiro Ambalá · Glamping y Ecoturismo en Combeima, Tolima | Iwagé Gestión',
    seo_descripcion: 'Operación turística integral de glamping en el Cañón del Combeima. 6 domos, restaurante, senderos. Branding, reservas y personal por Iwagé Gestión.',
  });

  console.log('\n✅ Seed de Propiedades en Gestión completo! (4 propiedades, 1 por tipo)');
}

seed().catch(console.error);
