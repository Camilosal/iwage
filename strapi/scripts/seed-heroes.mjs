/**
 * Seed hero-configuracion records via Strapi REST API.
 * Run: node strapi/scripts/seed-heroes.mjs
 *
 * Idempotent: re-running will update existing records (matched by slug_ruta)
 * and skip the rest.
 */
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || 'seed-fa03dbbe10c476c3314569470454b90fbb3a18a7';
const ENDPOINT = '/api/hero-configuracions';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

const BRAND_IMAGES = {
  cafe: '/images/hero-cafe.webp',
  meliponas: '/images/hero-meliponas.webp',
  tierras: '/images/hero-tierras.webp',
  naturaleza: '/images/hero-naturaleza.webp',
  gestion: '/images/hero-gestion.webp',
  granja: '/images/hero-granja.webp',
};

const HEROES = [
  // ── Home ──────────────────────────────────────────────
  {
    pagina: 'Inicio (Home)',
    slug_ruta: '/',
    titulo: 'Un ecosistema rural integrado, en el corazón del Tolima',
    subtitulo: 'Meliponicultura, café de origen, turismo regenerativo, gestión de propiedades rurales y un laboratorio vivo: Granja Iwagé. Cada parte alimenta al todo.',
    imagen: '/images/hero-ecosistema.webp',
    label: 'Iwagé Ecosistema',
    color_overlay: 'from-black/60 via-black/50 to-black/75',
    orden: 1,
  },
  // ── Café (5) ─────────────────────────────────────────
  {
    pagina: 'Café — Inicio',
    slug_ruta: '/cafe',
    titulo: 'El territorio en cada taza',
    subtitulo: 'Un café comunitario construido sobre ingredientes nombrados, proveedores a menos de 4 km y un menú donde cada producto es un personaje.',
    imagen: BRAND_IMAGES.cafe,
    label: 'Café Iwagé',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 1,
  },
  {
    pagina: 'Café — Menú',
    slug_ruta: '/cafe/menu',
    titulo: 'Menú de temporada',
    subtitulo: 'Cada producto tiene nombre, historia y proveedor. Café de origen, infusiones de flora nativa, panadería y signatures con miel de Angelita.',
    imagen: BRAND_IMAGES.cafe,
    label: 'Café Iwagé',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 2,
  },
  {
    pagina: 'Café — Proveedores',
    slug_ruta: '/cafe/proveedores',
    titulo: 'Los rostros detrás de cada producto',
    subtitulo: 'Familias productoras a menos de 4 km del café. Cada proveedor tiene nombre, historia y un producto específico que lo distingue.',
    imagen: BRAND_IMAGES.cafe,
    label: 'Café Iwagé',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 3,
  },
  {
    pagina: 'Café — Recetas',
    slug_ruta: '/cafe/recetas',
    titulo: 'Recetas del territorio',
    subtitulo: 'Preparaciones de temporada con ingredientes del corredor Ambalá. Cada receta es una excusa para conectar con el origen.',
    imagen: BRAND_IMAGES.cafe,
    label: 'Café Iwagé',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 4,
  },
  {
    pagina: 'Café — Visitantes',
    slug_ruta: '/cafe/visitantes',
    titulo: 'Visítanos en Ibagué',
    subtitulo: 'Estamos en el corredor Ambalá, a 20 minutos del centro de Ibagué. Ven por un café, quédate por la conversación.',
    imagen: BRAND_IMAGES.cafe,
    label: 'Café Iwagé',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    cta_primario_texto: 'Cómo llegar',
    cta_primario_url: 'https://maps.app.goo.gl/5pTgzr6SNvnU66347',
    cta_secundario_texto: 'Preguntas frecuentes',
    cta_secundario_url: '/cafe/ayuda',
    orden: 5,
  },
  // ── Meliponas (6) ─────────────────────────────────────
  {
    pagina: 'Meliponas — Inicio',
    slug_ruta: '/meliponas',
    titulo: 'Miel de Angelita, cosechada en casa',
    subtitulo: 'Tetragonisca angustula, la abeja sin aguijón que produce una de las mieles más valiosas del mundo. Producida, estudiada y trazada por nuestro equipo.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Meliponario Iwagé',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 1,
  },
  {
    pagina: 'Meliponas — Tienda',
    slug_ruta: '/meliponas/tienda',
    titulo: 'Tienda del Meliponario',
    subtitulo: 'Miel cruda, polen, propóleo y derivados. Trazabilidad hasta la colmena y la fecha de cosecha.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Tienda',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 2,
  },
  {
    pagina: 'Meliponas — Trazabilidad',
    slug_ruta: '/meliponas/trazabilidad',
    titulo: 'Trazabilidad radical, de colmena a frasco',
    subtitulo: 'Cada lote registra colmena, fecha, flora de temporada y responsable. La información va del frasco al consumidor, no al revés.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Trazabilidad',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 3,
  },
  {
    pagina: 'Meliponas — Polinización',
    slug_ruta: '/meliponas/polinizacion',
    titulo: 'Servicios de polinización para fincas',
    subtitulo: 'Alquilamos colmenas de Angelita para aumentar la productividad de cultivos de café, frutales y hortalizas. Contratos mensuales con monitoreo.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Polinización',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    cta_primario_texto: 'Cotizar colmenas',
    cta_primario_url: 'https://wa.me/573026693366',
    orden: 4,
  },
  {
    pagina: 'Meliponas — Proyectos',
    slug_ruta: '/meliponas/proyectos',
    titulo: 'Proyectos de meliponicultura',
    subtitulo: 'Investigación, conservación y educación. Trabajamos con universidades, comunidades y productores para escalar la meliponicultura regenerativa.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Proyectos',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 5,
  },
  {
    pagina: 'Meliponas — Herramientas',
    slug_ruta: '/meliponas/herramientas',
    titulo: 'Herramientas para meliponicultores',
    subtitulo: 'Calculadoras, guías y planillas para diseñar tu meliponario. Recursos abiertos, libres y mejorados por la comunidad.',
    imagen: BRAND_IMAGES.meliponas,
    label: 'Herramientas',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 6,
  },
  // ── Tierras (6) ───────────────────────────────────────
  {
    pagina: 'Tierras — Inicio',
    slug_ruta: '/tierras',
    titulo: 'Tierras rurales con propósito',
    subtitulo: 'Compra, vende o gestiona fincas en el corredor Ambalá. Acompañamos cada transacción con asesoría técnica, legal y operativa.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Iwagé Tierras',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 1,
  },
  {
    pagina: 'Tierras — Comprar',
    slug_ruta: '/tierras/comprar',
    titulo: 'Encuentra tu próxima finca',
    subtitulo: 'Propiedades rurales curadas con información de uso de suelo, agua, accesos, vecindario y potencial productivo. Sin sorpresas.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Comprar',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    cta_primario_texto: 'Ver propiedades',
    cta_primario_url: '/tierras/propiedades/',
    orden: 2,
  },
  {
    pagina: 'Tierras — Vender',
    slug_ruta: '/tierras/vender',
    titulo: 'Vende tu propiedad con acompañamiento',
    subtitulo: 'No somos una inmobiliaria más. Estudiamos la propiedad, la preparamos y conectamos con compradores calificados.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Vender',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    cta_primario_texto: 'Iniciar proceso',
    cta_primario_url: 'https://wa.me/573026693366',
    orden: 3,
  },
  {
    pagina: 'Tierras — Lab (Laboratorio)',
    slug_ruta: '/tierras/lab',
    titulo: 'Lab Iwagé — Investigación aplicada',
    subtitulo: 'Modelos de evaluación multicriterio, valoración con propósito (VAP) y herramientas abiertas para la toma de decisiones sobre tierra rural.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Lab',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 4,
  },
  {
    pagina: 'Tierras — Protocolo VAP',
    slug_ruta: '/tierras/protocolo-vap',
    titulo: 'Protocolo VAP — Valoración con propósito',
    subtitulo: 'Un protocolo abierto para tasar tierras rurales considerando productivo, ecológico, social y cultural. No solo precio por hectárea.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Protocolo',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 5,
  },
  {
    pagina: 'Tierras — Propiedades',
    slug_ruta: '/tierras/propiedades',
    titulo: 'Propiedades disponibles',
    subtitulo: 'Catálogo curado de fincas con información verificada, visitas programadas y acompañamiento legal.',
    imagen: BRAND_IMAGES.tierras,
    label: 'Catálogo',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 6,
  },
  // ── Naturaleza (8) ────────────────────────────────────
  {
    pagina: 'Naturaleza — Inicio',
    slug_ruta: '/naturaleza',
    titulo: 'Turismo regenerativo en el corredor Ambalá',
    subtitulo: 'Experiencias, anfitriones y programas diseñados para que tu visita deje más de lo que se lleva. Naturaleza con propósito.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Iwagé Naturaleza',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 1,
  },
  {
    pagina: 'Naturaleza — Anfitriones',
    slug_ruta: '/naturaleza/anfitriones',
    titulo: 'Anfitriones del territorio',
    subtitulo: 'Familias locales que abren sus puertas, comparten saberes y ofrecen experiencias auténticas. Conoce a los guardianes del corredor Ambalá.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Anfitriones',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 2,
  },
  {
    pagina: 'Naturaleza — Clasificación',
    slug_ruta: '/naturaleza/clasificacion',
    titulo: 'Clasificación de experiencias',
    subtitulo: 'Tipología, duración, dificultad, inversión y retorno social. Comparamos para que elijas bien.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Clasificación',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 3,
  },
  {
    pagina: 'Naturaleza — Escalafón',
    slug_ruta: '/naturaleza/escalafon',
    titulo: 'Escalafón de anfitriones',
    subtitulo: 'Reconocemos el trabajo de quienes construyen turismo regenerativo. Un ranking abierto basado en evaluaciones reales.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Escalafón',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 4,
  },
  {
    pagina: 'Naturaleza — Experiencias',
    slug_ruta: '/naturaleza/experiencias',
    titulo: 'Experiencias disponibles',
    subtitulo: 'Caminatas, avistamiento, talleres y estadías. Cada experiencia es evaluada en cuatro dimensiones: ambiental, social, cultural y económica.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Experiencias',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 5,
  },
  {
    pagina: 'Naturaleza — Impacto',
    slug_ruta: '/naturaleza/impacto',
    titulo: 'Medimos el impacto, no solo las visitas',
    subtitulo: 'Métricas de conservación, empleo local, diversificación económica y bienestar comunitario. Lo que se mide, se puede mejorar.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Impacto',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 6,
  },
  {
    pagina: 'Naturaleza — Programas',
    slug_ruta: '/naturaleza/programas',
    titulo: 'Programas de inmersión',
    subtitulo: 'Estadías de 1 a 4 semanas con anfitriones. Programa educativo, laboral o exploratorio según tu objetivo.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Programas',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    orden: 7,
  },
  {
    pagina: 'Naturaleza — Sé anfitrión',
    slug_ruta: '/naturaleza/se-anfitrion',
    titulo: '¿Quieres ser anfitrión?',
    subtitulo: 'Si tienes una finca, saber o experiencia que vale la pena compartir, te acompañamos a profesionalizar tu oferta y conectar con visitantes.',
    imagen: BRAND_IMAGES.naturaleza,
    label: 'Sé anfitrión',
    color_overlay: 'from-black/45 via-black/35 to-black/60',
    cta_primario_texto: 'Inscribirme',
    cta_primario_url: 'https://wa.me/573026693366',
    orden: 8,
  },
  // ── Gestión (8) ───────────────────────────────────────
  {
    pagina: 'Gestión — Inicio',
    slug_ruta: '/gestion',
    titulo: 'Property management con propósito',
    subtitulo: 'Gestionamos propiedades rurales de terceros bajo modelos de operación turística, finca productiva, segunda residencia o alianzas mixtas.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Iwagé Gestión',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 1,
  },
  {
    pagina: 'Gestión — Alojamientos',
    slug_ruta: '/gestion/alojamientos',
    titulo: 'Alojamientos rurales en gestión',
    subtitulo: 'Cabañas, fincas y casas de campo bajo administración operativa completa. Operación turística con marca Iwagé.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Alojamientos',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 2,
  },
  {
    pagina: 'Gestión — Experiencias',
    slug_ruta: '/gestion/experiencias',
    titulo: 'Experiencias operadas',
    subtitulo: 'Diseño, operación y comercialización de experiencias rurales para propietarios que quieren delegar.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Experiencias',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 3,
  },
  {
    pagina: 'Gestión — Propiedades',
    slug_ruta: '/gestion/propiedades',
    titulo: 'Propiedades en gestión',
    subtitulo: 'Cartera administrada de fincas con distintos modelos. Información de operación, ocupación y retorno.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Cartera',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 4,
  },
  {
    pagina: 'Gestión — Propietarios (index)',
    slug_ruta: '/gestion/propietarios',
    titulo: 'Para propietarios',
    subtitulo: 'Cuatro modelos de gestión según el tipo de propiedad y objetivo del dueño. Encuentra el que mejor te conviene.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Propietarios',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 5,
  },
  {
    pagina: 'Gestión — Finca productiva',
    slug_ruta: '/gestion/propietarios/finca-productiva',
    titulo: 'Modelo finca productiva',
    subtitulo: 'Operamos tu finca como unidad productiva: café, miel, polinización, ganadería regenerativa. Tú recibes retornos.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Finca productiva',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 6,
  },
  {
    pagina: 'Gestión — Operación turística',
    slug_ruta: '/gestion/propietarios/operacion-turistica',
    titulo: 'Modelo operación turística',
    subtitulo: 'Convertimos tu propiedad en un destino operativamente completo. Comercialización, reservas, atención y mantenimiento incluidos.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Operación turística',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 7,
  },
  {
    pagina: 'Gestión — Segunda residencia',
    slug_ruta: '/gestion/propietarios/segunda-residencia',
    titulo: 'Modelo segunda residencia',
    subtitulo: 'Cuidamos tu casa de descanso y la rentamos cuando no la usas. Mantenimiento preventivo y reportes mensuales.',
    imagen: BRAND_IMAGES.gestion,
    label: 'Segunda residencia',
    color_overlay: 'from-black/50 via-black/40 to-black/65',
    orden: 8,
  },
  // ── Granja (5) ────────────────────────────────────────
  {
    pagina: 'Granja — Inicio',
    slug_ruta: '/granja',
    titulo: 'Granja Iwagé — Laboratorio vivo',
    subtitulo: 'Donde documentamos y experimentamos con sistemas regenerativos. Apicultura, agroforestería, compostaje y energía distribuida.',
    imagen: BRAND_IMAGES.granja,
    label: 'Granja Iwagé',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 1,
  },
  {
    pagina: 'Granja — Tienda',
    slug_ruta: '/granja/tienda',
    titulo: 'Tienda de la Granja',
    subtitulo: 'Productos elaborados en la granja o por los sistemas que probamos. Trazabilidad, propósito y precios justos.',
    imagen: BRAND_IMAGES.granja,
    label: 'Tienda',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 2,
  },
  {
    pagina: 'Granja — Servicios',
    slug_ruta: '/granja/servicios',
    titulo: 'Servicios técnicos',
    subtitulo: 'Consultoría, diseño de sistemas regenerativos, instalación de meliponarios y acompañamiento productivo.',
    imagen: BRAND_IMAGES.granja,
    label: 'Servicios',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    cta_primario_texto: 'Cotizar',
    cta_primario_url: 'https://wa.me/573026693366',
    orden: 3,
  },
  {
    pagina: 'Granja — Sistema',
    slug_ruta: '/granja/sistema',
    titulo: 'El sistema Granja',
    subtitulo: 'Cómo se conectan los subsistemas de la granja. Energía, agua, suelo, biodiversidad, conocimiento.',
    imagen: BRAND_IMAGES.granja,
    label: 'Sistema',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    orden: 4,
  },
  {
    pagina: 'Granja — Visitas',
    slug_ruta: '/granja/visitas',
    titulo: 'Visitas a la Granja',
    subtitulo: 'Recorridos guiados, talleres prácticos y estadías de inmersión. Aprende los sistemas viéndolos funcionar.',
    imagen: BRAND_IMAGES.granja,
    label: 'Visitas',
    color_overlay: 'from-black/40 via-black/30 to-black/55',
    cta_primario_texto: 'Reservar',
    cta_primario_url: 'https://wa.me/573026693366',
    orden: 5,
  },
];

async function api(method, path, body) {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function findBySlug(slug) {
  const res = await api('GET', `${ENDPOINT}?filters%5Bslug_ruta%5D%5B%24eq%5D=${encodeURIComponent(slug)}&pagination%5BpageSize%5D=1`);
  return res.data?.[0] ?? null;
}

async function upsert(record) {
  const existing = await findBySlug(record.slug_ruta);
  if (existing) {
    await api('PUT', `${ENDPOINT}/${existing.documentId}`, record);
    return 'updated';
  }
  await api('POST', ENDPOINT, record);
  return 'created';
}

async function main() {
  console.log(`Seeding ${HEROES.length} hero configurations → ${STRAPI_URL}`);
  let created = 0;
  let updated = 0;
  for (const hero of HEROES) {
    try {
      const action = await upsert(hero);
      if (action === 'created') created++; else updated++;
      console.log(`  [${action}] ${hero.slug_ruta} — ${hero.titulo.slice(0, 50)}`);
    } catch (e) {
      console.error(`  [ERROR] ${hero.slug_ruta}: ${e.message}`);
    }
  }
  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
