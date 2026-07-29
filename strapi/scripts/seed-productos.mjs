// Seed script for enhanced Productos (tienda online + local)
// Run: node scripts/seed-productos.mjs
// Requires: STRAPI_URL and STRAPI_API_TOKEN env vars

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

async function create(data) {
  const res = await fetch(`${STRAPI_URL}/api/productos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`✗ Error creating "${data.nombre}":`, err?.error?.message || res.statusText);
    return null;
  }
  console.log(`✓ Created: ${data.nombre} (${data.sku})`);
  return (await res.json()).data;
}

const productos = [
  // ── Miel ──────────────────────────────────────────────
  {
    nombre: 'Miel Angelita 250ml',
    descripcion: 'Miel pura de Tetragonisca angustula. Cosecha mayo 2025, flora de guamo y café. Perfil cítrico con final floral y notas de panela.',
    descripcion_corta: 'Miel pura de Angelita, cosecha 2025.',
    galeria: [
      { url: '/images/galeria/producto-miel-1.webp', tipo: 'imagen', titulo: 'Miel de angelita en frasco de vidrio' },
      { url: '/images/galeria/producto-miel-2.webp', tipo: 'imagen', titulo: 'Proceso de cosecha y filtrado' },
    ],
    sku: 'MIEL-250',
    precio: 45000,
    presentacion: '250 ml · Lote L25-05-001',
    categoria: 'miel',
    stock_disponible: true,
    stock_cantidad: 30,
    destacado: true,
    canal_venta: 'ambos',
    peso_gramos: 350,
    tags: ['angelita', 'cosecha-2025', 'trazabilidad'],
    orden: 1,
    envio_gratis: false,
    tiempo_entrega: '2-4 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Miel Angelita 500ml',
    descripcion: 'Presentación familiar. Misma cosecha, perfil cítrico con final floral. Ideal para consumo diario.',
    descripcion_corta: 'Presentación familiar 500ml.',
    galeria: [
      { url: '/images/galeria/producto-miel-2.webp', tipo: 'imagen', titulo: 'Presentación 500ml' },
      { url: '/images/galeria/producto-miel-1.webp', tipo: 'imagen', titulo: 'Miel dorada de meliponas' },
    ],
    sku: 'MIEL-500',
    precio: 78000,
    presentacion: '500 ml · Lote L25-05-001',
    categoria: 'miel',
    stock_disponible: true,
    stock_cantidad: 20,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 650,
    tags: ['angelita', 'familiar'],
    orden: 2,
    envio_gratis: false,
    tiempo_entrega: '2-4 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Miel Angelita 120ml',
    descripcion: 'Presentación degustación. Ideal para regalo o primera experiencia con miel de Angelita.',
    descripcion_corta: 'Degustación, ideal para regalo.',
    sku: 'MIEL-120',
    precio: 25000,
    presentacion: '120 ml · Lote L25-05-001',
    categoria: 'miel',
    stock_disponible: true,
    stock_cantidad: 50,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 200,
    tags: ['degustacion', 'regalo'],
    orden: 3,
    envio_gratis: false,
    tiempo_entrega: '2-4 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Miel con propóleo 250ml',
    descripcion: 'Blend de miel y propóleo de Angelita. Sabor intenso, notas resinosas. Edición limitada de cosecha selecta.',
    descripcion_corta: 'Blend miel + propóleo, edición limitada.',
    galeria: [
      { url: '/images/galeria/producto-miel-2.webp', tipo: 'imagen', titulo: 'Miel infusionada con propóleo' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Propóleo en la entrada de la colmena' },
    ],
    sku: 'MIEL-PROP-250',
    precio: 52000,
    presentacion: '250 ml · Edición limitada',
    categoria: 'miel',
    stock_disponible: true,
    stock_cantidad: 12,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 350,
    tags: ['propoleo', 'edicion-limitada'],
    orden: 4,
    envio_gratis: false,
    tiempo_entrega: '2-4 días hábiles',
    orden_minima: 1,
  },

  // ── Cajas ─────────────────────────────────────────────
  {
    nombre: 'Caja INPA Nogal Cafetero',
    descripcion: 'Modelo INPA en madera de nogal cafetero. Incluye trampas de forrajeo y base. Diseñada para Tetragonisca angustula con ventilación optimizada.',
    descripcion_corta: 'Caja INPA en nogal cafetero con trampas.',
    galeria: [
      { url: '/images/galeria/producto-caja-1.webp', tipo: 'imagen', titulo: 'Caja INPA en nogal cafetero' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Colmena INPA instalada y activa' },
    ],
    sku: 'CAJA-INPA',
    precio: 180000,
    presentacion: 'Nogal cafetero · 30×20×15 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 8,
    destacado: true,
    canal_venta: 'ambos',
    peso_gramos: 3500,
    dimensiones: '30×20×15 cm',
    tags: ['inpa', 'nogal', 'trampas-forrajeo'],
    orden: 1,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Caja AF Estándar',
    descripcion: 'Modelo Augusto Ferreira con piso móvil y tapa de observación. Facilita la inspección sin perturbar la colonia.',
    descripcion_corta: 'Modelo AF con piso móvil.',
    sku: 'CAJA-AF',
    precio: 165000,
    presentacion: 'Nogal cafetero · 28×18×14 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 6,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 3200,
    dimensiones: '28×18×14 cm',
    tags: ['af', 'augusto-ferreira', 'piso-movil'],
    orden: 2,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Caja INPA con atril',
    descripcion: 'Caja INPA montada sobre atril de guadua. Lista para instalar en jardín o finca. Protección contra hormigas.',
    descripcion_corta: 'INPA + atril de guadua, lista para instalar.',
    sku: 'CAJA-INPA-AT',
    precio: 220000,
    presentacion: 'Incluye atril · Instalación fácil',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 5,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 5000,
    dimensiones: '30×20×15 cm + atril 60cm',
    tags: ['inpa', 'atril', 'guadua'],
    orden: 3,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
  },

  // ── Kits ──────────────────────────────────────────────
  {
    nombre: 'Kit Inicio Meliponicultor',
    descripcion: 'Caja INPA + atril + guía impresa + 1 visita técnica de acompañamiento. Todo lo necesario para iniciar tu meliponario con acompañamiento profesional.',
    descripcion_corta: 'Todo para empezar tu meliponario.',
    galeria: [
      { url: '/images/galeria/producto-caja-1.webp', tipo: 'imagen', titulo: 'Contenido del kit de inicio' },
      { url: '/images/galeria/proyecto-carmen-1.webp', tipo: 'imagen', titulo: 'Meliponario montado con el kit' },
    ],
    sku: 'KIT-INICIO',
    precio: 280000,
    precio_comparativo: 320000,
    presentacion: 'Todo para empezar',
    categoria: 'kit',
    stock_disponible: true,
    stock_cantidad: 10,
    destacado: true,
    canal_venta: 'ambos',
    peso_gramos: 6000,
    tags: ['inicio', 'visita-tecnica', 'guia'],
    orden: 1,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
  },
  {
    nombre: 'Kit Educativo PRAE',
    descripcion: '2 cajas + material didáctico + 3 talleres presenciales para colegio. Diseñado para proyectos ambientales escolares (PRAE).',
    descripcion_corta: 'Para instituciones educativas.',
    sku: 'KIT-PRAE',
    precio: 650000,
    presentacion: 'Para instituciones educativas',
    categoria: 'kit',
    stock_disponible: true,
    stock_cantidad: 4,
    destacado: false,
    canal_venta: 'local',
    peso_gramos: 12000,
    tags: ['prae', 'educativo', 'colegio', 'talleres'],
    orden: 2,
    envio_gratis: false,
    tiempo_entrega: 'Coordinar con equipo',
    orden_minima: 1,
  },
  {
    nombre: 'Kit Observación',
    descripcion: 'Caja con tapa acrílica + lupa + cuaderno de campo. Ideal para niños y educación ambiental. Seguro y sin riesgo de picadura.',
    descripcion_corta: 'Tapa transparente, seguro para niños.',
    galeria: [
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Colmena de observación activa' },
      { url: '/images/galeria/proyecto-poblado-1.webp', tipo: 'imagen', titulo: 'Observación familiar' },
    ],
    sku: 'KIT-OBS',
    precio: 195000,
    presentacion: 'Tapa transparente · Seguro',
    categoria: 'kit',
    stock_disponible: true,
    stock_cantidad: 7,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 4000,
    tags: ['observacion', 'ninos', 'educacion'],
    orden: 3,
    envio_gratis: false,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
  },

  // ── Asistencia ────────────────────────────────────────
  {
    nombre: 'Asistencia Técnica Mensual',
    descripcion: 'Visita mensual de revisión, diagnóstico y recomendaciones. Incluye informe escrito. Contrato mínimo 3 meses.',
    descripcion_corta: 'Visita mensual, contrato trimestral.',
    sku: 'ASIST-MES',
    precio: 120000,
    presentacion: 'Por visita · Contrato trimestral',
    categoria: 'asistencia',
    stock_disponible: true,
    stock_cantidad: null,
    destacado: false,
    canal_venta: 'local',
    peso_gramos: null,
    tags: ['tecnica', 'mensual', 'diagnostico'],
    orden: 1,
    envio_gratis: false,
    tiempo_entrega: 'Coordinar visita',
    orden_minima: 3,
  },
];

async function seed() {
  console.log('🐝 Seeding Productos (tienda online + local)...\n');
  console.log(`   Target: ${STRAPI_URL}\n`);

  let created = 0;
  for (const p of productos) {
    const result = await create(p);
    if (result) created++;
  }

  console.log(`\n✅ Done: ${created}/${productos.length} productos creados.`);
}

seed().catch(console.error);
