// Seed script for Iwagé Strapi instance
// Run: node scripts/seed.mjs
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
    console.error(`Error creating ${endpoint}:`, err);
    return null;
  }
  const json = await res.json();
  console.log(`✓ Created ${endpoint}: ${data.nombre || data.titulo || data.codigo_lote || data.nombre || 'entry'}`);
  return json.data;
}

async function seed() {
  console.log('🌱 Seeding Iwagé Strapi...\n');

  // Productos - Miel
  await create('productos', { nombre: 'Miel Angelita 250ml', descripcion: 'Miel pura de Tetragonisca angustula. Cosecha mayo 2025, flora de guamo y café.', precio: 45000, presentacion: '250 ml · Lote L25-05-001', categoria: 'miel', destacado: true });
  await create('productos', { nombre: 'Miel Angelita 500ml', descripcion: 'Presentación familiar. Misma cosecha, perfil cítrico con final floral.', precio: 78000, presentacion: '500 ml · Lote L25-05-001', categoria: 'miel' });
  await create('productos', { nombre: 'Miel Angelita 120ml', descripcion: 'Presentación degustación. Ideal para regalo o primera experiencia.', precio: 25000, presentacion: '120 ml · Lote L25-05-001', categoria: 'miel' });
  await create('productos', { nombre: 'Miel con propóleo 250ml', descripcion: 'Blend de miel y propóleo de Angelita. Sabor intenso, notas resinosas.', precio: 52000, presentacion: '250 ml · Edición limitada', categoria: 'miel' });

  // Productos - Cajas
  await create('productos', { nombre: 'Caja INPA Nogal Cafetero', descripcion: 'Modelo INPA en madera de nogal cafetero. Incluye trampas de forrajeo y base.', precio: 180000, presentacion: 'Nogal cafetero · 30×20×15 cm', categoria: 'caja', destacado: true });
  await create('productos', { nombre: 'Caja AF Estándar', descripcion: 'Modelo Augusto Ferreira con piso móvil y tapa de observación.', precio: 165000, presentacion: 'Nogal cafetero · 28×18×14 cm', categoria: 'caja' });
  await create('productos', { nombre: 'Caja INPA con atril', descripcion: 'Caja INPA montada sobre atril de guadua. Lista para instalar.', precio: 220000, presentacion: 'Incluye atril · Instalación fácil', categoria: 'caja' });

  // Productos - Kits
  await create('productos', { nombre: 'Kit Inicio Meliponicultor', descripcion: 'Caja INPA + atril + guía impresa + 1 visita técnica de acompañamiento.', precio: 280000, presentacion: 'Todo para empezar', categoria: 'kit', destacado: true });
  await create('productos', { nombre: 'Kit Educativo PRAE', descripcion: '2 cajas + material didáctico + 3 talleres presenciales para colegio.', precio: 650000, presentacion: 'Para instituciones educativas', categoria: 'kit' });
  await create('productos', { nombre: 'Kit Observación', descripcion: 'Caja con tapa acrílica + lupa + cuaderno de campo. Ideal para niños.', precio: 195000, presentacion: 'Tapa transparente · Seguro', categoria: 'kit' });

  // Productos - Asistencia
  await create('productos', { nombre: 'Asistencia Técnica Mensual', descripcion: 'Visita mensual de revisión, diagnóstico y recomendaciones. Contrato mínimo 3 meses.', precio: 120000, presentacion: 'Por visita · Contrato trimestral', categoria: 'asistencia' });

  // Cultivos
  await create('cultivo-polinizaciones', { nombre: 'Café', nombre_cientifico: 'Coffea arabica', rendimiento: '+14% amarre', fuente: 'Corredor Ambalá, 2024', icono: 'coffee' });
  await create('cultivo-polinizaciones', { nombre: 'Aguacate', nombre_cientifico: 'Persea americana', rendimiento: '+22% cuajado', fuente: 'Finca El Carmen, 2024', icono: 'tree-deciduous' });
  await create('cultivo-polinizaciones', { nombre: 'Mora', nombre_cientifico: 'Rubus glaucus', rendimiento: '+18% frutos', fuente: 'Vereda El Carmen, 2023', icono: 'berry' });
  await create('cultivo-polinizaciones', { nombre: 'Cítricos', nombre_cientifico: 'Citrus sp.', rendimiento: '+12% calibre', fuente: 'Predio La Esperanza, 2024', icono: 'citrus' });
  await create('cultivo-polinizaciones', { nombre: 'Tomate', nombre_cientifico: 'Solanum lycopersicum', rendimiento: '+9% peso', fuente: 'Invernadero PRAE, 2024', icono: 'salad' });
  await create('cultivo-polinizaciones', { nombre: 'Fresa', nombre_cientifico: 'Fragaria × ananassa', rendimiento: '+15% uniformidad', fuente: 'Finca La Cumbre, 2023', icono: 'cherry' });

  // Proyectos
  await create('proyecto-meliponarios', { nombre: 'Meliponario I.E. Ambalá', ubicacion: 'Ibagué, Tolima', tipo: 'club', estado: 'activo', descripcion: 'Proyecto PRAE con 6 colmenas educativas y sendero interpretativo para 400 estudiantes.', colmenas: 6 });
  await create('proyecto-meliponarios', { nombre: 'Finca El Carmen', ubicacion: 'Vereda El Carmen, Ibagué', tipo: 'finca', estado: 'activo', descripcion: 'Polinización de aguacate Hass y producción de miel con 12 colmenas.', colmenas: 12 });
  await create('proyecto-meliponarios', { nombre: 'EcoHotel La Cumbre', ubicacion: 'Cajamarca, Tolima', tipo: 'turismo', estado: 'activo', descripcion: 'Experiencia de observación de meliponas + cata de miel para huéspedes.', colmenas: 4 });
  await create('proyecto-meliponarios', { nombre: 'Colegio San Bonifacio', ubicacion: 'Ibagué, Tolima', tipo: 'club', estado: 'en-proceso', descripcion: 'Instalación de 4 colmenas educativas con material PRAE para primaria.', colmenas: 4 });
  await create('proyecto-meliponarios', { nombre: 'Finca La Esperanza', ubicacion: 'Coello, Tolima', tipo: 'finca', estado: 'activo', descripcion: 'Polinización de café Caturra con 8 colmenas en bordes de lote.', colmenas: 8 });
  await create('proyecto-meliponarios', { nombre: 'Jardín Residencial El Poblado', ubicacion: 'Ibagué, Tolima', tipo: 'empresa', estado: 'en-proceso', descripcion: 'Paisajismo con 3 colmenas ornamentales en zonas comunes del conjunto.', colmenas: 3 });

  // Pilares
  await create('pilar-estandars', { numero: 1, titulo: 'Origen verificado', descripcion: 'Cada lote trazado hasta la colmena y el meliponario de origen.', icono: 'map-pin' });
  await create('pilar-estandars', { numero: 2, titulo: 'Cosecha ética', descripcion: 'Solo se extrae excedente. Nunca se compromete la reserva de la colonia.', icono: 'heart' });
  await create('pilar-estandars', { numero: 3, titulo: 'Cadena de frío', descripcion: 'Refrigeración desde cosecha hasta entrega. Máximo 48h sin refrigerar.', icono: 'thermometer-snowflake' });
  await create('pilar-estandars', { numero: 4, titulo: 'Análisis de laboratorio', descripcion: 'pH, humedad, fenoles y perfil microbiológico en cada lote.', icono: 'flask-conical' });
  await create('pilar-estandars', { numero: 5, titulo: 'Empaque consciente', descripcion: 'Vidrio ámbar, etiqueta con QR de trazabilidad, cero plástico.', icono: 'recycle' });

  // Etapas
  await create('etapa-proyectos', { numero: 1, titulo: 'Diagnóstico', descripcion: 'Evaluación del espacio, flora disponible, condiciones climáticas y objetivos del proyecto.' });
  await create('etapa-proyectos', { numero: 2, titulo: 'Diseño', descripcion: 'Plano de distribución, selección de especies, modelo de caja y calendario de instalación.' });
  await create('etapa-proyectos', { numero: 3, titulo: 'Instalación', descripcion: 'Montaje de colmenas, atriles, señalética y flora complementaria si aplica.' });
  await create('etapa-proyectos', { numero: 4, titulo: 'Acompañamiento', descripcion: 'Visitas de seguimiento, capacitación del equipo local y reportes de actividad.' });

  // Items menú café
  await create('item-menus', { nombre: 'Café de origen Ambalá', historia: 'Cultivado a 1,400 m.s.n.m. por la familia Cardona. Notas de panela y cítricos.', tags: ['Origen único', 'Tueste medio'], precio: '$6.500', destacado: true });
  await create('item-menus', { nombre: 'Miel de Angelita con café', historia: 'Infusión de miel cruda de T. angustula en espresso doble. Dulzor natural sin azúcar.', tags: ['Signature', 'Sin azúcar'], precio: '$9.000', destacado: true });
  await create('item-menus', { nombre: 'Aromática de flora nativa', historia: 'Blend de hierbas del corredor: hierbabuena, limoncillo y flor de guamo.', tags: ['Sin cafeína', 'Herbal'], precio: '$5.500' });
  await create('item-menus', { nombre: 'Chocolate de cacao local', historia: 'Cacao de El Espinal, preparado con leche de la finca La Cumbre.', tags: ['Caliente', 'Local'], precio: '$7.000' });

  // Proveedores
  await create('proveedors', { nombre: 'Familia Cardona', producto: 'Café de origen', ubicacion: 'Vereda El Carmen', distancia_km: 2.3 });
  await create('proveedors', { nombre: 'Finca La Cumbre', producto: 'Leche y quesos', ubicacion: 'Cajamarca', distancia_km: 3.8 });
  await create('proveedors', { nombre: 'Cacao El Espinal', producto: 'Cacao fino', ubicacion: 'El Espinal', distancia_km: 38 });

  // Testimonios
  await create('testimonios', { nombre: 'María Fernanda Gutiérrez', rol: 'Coordinadora Académica', ubicacion: 'I.E. Ambalá', texto: 'Las colmenas de Iwagé transformaron nuestro proyecto PRAE. Los estudiantes ahora entienden la biodiversidad desde la observación directa.', rating: 5 });
  await create('testimonios', { nombre: 'Andrés Restrepo', rol: 'Chef Ejecutivo', ubicacion: 'Restaurante Origen, Bogotá', texto: 'La miel de Angelita tiene un perfil de cata que no encontramos en ningún otro proveedor. Trazabilidad impecable.', rating: 5 });
  await create('testimonios', { nombre: 'Jorge Iván Cardona', rol: 'Caficultor', ubicacion: 'Vereda El Carmen, Ibagué', texto: 'Instalaron 8 colmenas en nuestra finca y la polinización del café mejoró notablemente en una temporada.', rating: 5 });

  // Lote de miel
  await create('lote-miels', { codigo_lote: 'L25-05-001', fecha_cosecha: '2025-05-10', flora: 'Guamo + Café', ph: 3.8, humedad: 22.4, fenolicos: 847, origen_meliponario: 'Meliponario Iwagé', origen_altitud: '1,250 m.s.n.m.', perfil_cata: 'Notas cítricas, final floral. Textura sedosa, acidez media-baja.' });

  console.log('\n✅ Seed complete!');
}

seed().catch(console.error);
