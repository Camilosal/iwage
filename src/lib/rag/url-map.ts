/**
 * Central registry of all site URLs with descriptions.
 * Used by the RAG system to provide navigation links and by the indexer for static pages.
 */
import type { Brand, KnowledgeChunk } from './knowledge-index';

export interface SitePage {
  url: string;
  brand: Brand;
  title: string;
  desc: string;
  keywords: string[];
}

export const URL_MAP: SitePage[] = [
  // ── General ──────────────────────────────────────────────
  { url: '/', brand: 'general', title: 'Inicio Iwagé', desc: 'Ecosistema de 5 marcas: Meliponas, Café, Tierras, Naturaleza y Gestión.', keywords: ['inicio', 'home', 'iwage', 'ecosistema', 'marcas'] },

  // ── Meliponas ────────────────────────────────────────────
  { url: '/meliponas', brand: 'meliponas', title: 'Meliponario Iwagé', desc: 'Centro de meliponicultura en Ibagué, Tolima. Miel de Angelita, cajas tecnificadas y polinización.', keywords: ['meliponas', 'miel', 'angelita', 'abejas', 'meliponario', 'colmenas'] },
  { url: '/meliponas/tienda', brand: 'meliponas', title: 'Tienda Meliponas', desc: 'Miel de Angelita pura, cajas INPA/AF en Nogal Cafetero, kits de meliponicultura.', keywords: ['tienda', 'comprar', 'miel', 'cajas', 'inpa', 'af', 'kits', 'productos', 'precio'] },
  { url: '/meliponas/polinizacion', brand: 'meliponas', title: 'Polinización Gestionada', desc: 'Servicio de polinización con Apis mellifera y meliponas para aguacate, café, mora y cítricos.', keywords: ['polinizacion', 'cultivos', 'aguacate', 'cafe', 'mora', 'citricos', 'servicio'] },
  { url: '/meliponas/proyectos', brand: 'meliponas', title: 'Proyectos de Meliponarios', desc: 'Diseño, instalación y acompañamiento de meliponarios para colegios, fincas y centros turísticos.', keywords: ['proyectos', 'meliponario', 'colegios', 'prae', 'fincas', 'instalacion', 'diseno'] },
  { url: '/meliponas/trazabilidad', brand: 'meliponas', title: 'Trazabilidad Iwagé', desc: 'Estándares verificables de miel, cajas IoT y polinización con QR de origen.', keywords: ['trazabilidad', 'estandar', 'iot', 'qr', 'calidad', 'laboratorio'] },
  { url: '/meliponas/herramientas', brand: 'meliponas', title: 'Herramientas del Meliponario', desc: 'Panel de herramientas: trazabilidad, Modelador Financiero Pro e Intranet.', keywords: ['herramientas', 'modelador', 'financiero', 'intranet', 'panel'] },
  { url: '/meliponas/bitacora', brand: 'meliponas', title: 'Bitácora Meliponas', desc: 'Guías técnicas, flora nativa, territorio Pijao y producción agroecológica.', keywords: ['bitacora', 'blog', 'guias', 'flora', 'pijao', 'agroecologia'] },
  { url: '/meliponas/nosotros', brand: 'meliponas', title: 'Quiénes Somos', desc: 'Historia del proyecto, identidad Pijao y economía local sin extractivismo.', keywords: ['nosotros', 'historia', 'pijao', 'equipo', 'mision'] },
  { url: '/meliponas/ayuda', brand: 'meliponas', title: 'Ayuda Meliponas', desc: 'Preguntas frecuentes y centro de ayuda del meliponario.', keywords: ['ayuda', 'faq', 'preguntas', 'soporte'] },
  { url: '/meliponas/contacto', brand: 'meliponas', title: 'Contacto Meliponas', desc: 'Formulario de contacto y WhatsApp del meliponario.', keywords: ['contacto', 'whatsapp', 'escribir', 'hablar'] },

  // ── Café ─────────────────────────────────────────────────
  { url: '/cafe', brand: 'cafe', title: 'Café Iwagé', desc: 'Café comunitario con ingredientes nombrados, proveedores a menos de 4km.', keywords: ['cafe', 'comunitario', 'taza', 'territorio'] },
  { url: '/cafe/menu', brand: 'cafe', title: 'Menú del Café', desc: 'Carta de café, infusiones, panadería, signature y acompañamientos.', keywords: ['menu', 'carta', 'bebidas', 'panaderia', 'infusiones', 'signature', 'comida'] },
  { url: '/cafe/proveedores', brand: 'cafe', title: 'Proveedores del Café', desc: 'Proveedores locales a menos de 4km con historia y producto.', keywords: ['proveedores', 'locales', 'origen', 'producto', 'historia'] },
  { url: '/cafe/bitacora', brand: 'cafe', title: 'Bitácora Café', desc: 'Artículos y novedades del café comunitario.', keywords: ['bitacora', 'blog', 'cafe', 'articulos'] },
  { url: '/cafe/contacto', brand: 'cafe', title: 'Contacto Café', desc: 'Contacto y ubicación del café.', keywords: ['contacto', 'cafe', 'ubicacion', 'horario'] },

  // ── Tierras ──────────────────────────────────────────────
  { url: '/tierras', brand: 'tierras', title: 'Iwagé Tierras', desc: 'Plataforma de propiedades rurales en el Tolima con verificación VAP.', keywords: ['tierras', 'propiedades', 'rural', 'inmobiliaria', 'fincas', 'lotes'] },
  { url: '/tierras/propiedades', brand: 'tierras', title: 'Catálogo de Propiedades', desc: 'Todas las propiedades rurales disponibles: fincas, lotes, casas campestres.', keywords: ['propiedades', 'catalogo', 'fincas', 'lotes', 'casas', 'comprar', 'arriendo', 'venta'] },
  { url: '/tierras/compradores', brand: 'tierras', title: 'Perfiles de Comprador', desc: 'Encuentra propiedades según tu perfil: productivo, campestre, nómada, turístico o patrimonial.', keywords: ['compradores', 'perfiles', 'productivo', 'campestre', 'nomada', 'turistico', 'patrimonial'] },
  { url: '/tierras/vap', brand: 'tierras', title: 'Verificación VAP', desc: 'Sistema de verificación de propiedades: Sello Oro, Plata, Bronce.', keywords: ['vap', 'verificacion', 'sello', 'oro', 'plata', 'bronce', 'legal', 'titulos'] },
  { url: '/tierras/bitacora', brand: 'tierras', title: 'Bitácora Tierras', desc: 'Conocimiento territorial del Tolima: guías, análisis y mercado.', keywords: ['bitacora', 'blog', 'tierras', 'territorio', 'mercado'] },
  { url: '/tierras/contacto', brand: 'tierras', title: 'Contacto Tierras', desc: 'Habla con un asesor inmobiliario rural.', keywords: ['contacto', 'tierras', 'asesor', 'whatsapp'] },

  // ── Naturaleza ───────────────────────────────────────────
  { url: '/naturaleza', brand: 'naturaleza', title: 'Iwagé Naturaleza', desc: 'Turismo regenerativo en el Tolima: experiencias curadas con anfitriones locales.', keywords: ['naturaleza', 'turismo', 'regenerativo', 'experiencias'] },
  { url: '/naturaleza/experiencias', brand: 'naturaleza', title: 'Experiencias', desc: 'Catálogo de experiencias: naturaleza, cultura, bienestar, aventura y gastronomía.', keywords: ['experiencias', 'tours', 'actividades', 'naturaleza', 'cultura', 'bienestar', 'aventura', 'gastronomia'] },
  { url: '/naturaleza/anfitriones', brand: 'naturaleza', title: 'Anfitriones', desc: 'Guías locales y guardianes del territorio con historia y arraigo.', keywords: ['anfitriones', 'guias', 'locales', 'guardianes', 'territorio'] },
  { url: '/naturaleza/paquetes', brand: 'naturaleza', title: 'Paquetes Turísticos', desc: 'Paquetes multi-experiencia de varios días con todo incluido.', keywords: ['paquetes', 'tours', 'dias', 'incluido', 'multi'] },
  { url: '/naturaleza/bitacora', brand: 'naturaleza', title: 'Bitácora Naturaleza', desc: 'Historias del territorio, biodiversidad y turismo consciente.', keywords: ['bitacora', 'blog', 'naturaleza', 'biodiversidad'] },
  { url: '/naturaleza/contacto', brand: 'naturaleza', title: 'Contacto Naturaleza', desc: 'Reserva experiencias o habla con nuestro equipo.', keywords: ['contacto', 'naturaleza', 'reservar', 'reserva'] },

  // ── Gestión ──────────────────────────────────────────────
  { url: '/gestion', brand: 'gestion', title: 'Iwagé Gestión', desc: 'Administración de propiedades: renta corta, finca productiva, segunda residencia y operación turística.', keywords: ['gestion', 'administracion', 'propiedades', 'renta', 'airbnb'] },
  { url: '/gestion/propiedades', brand: 'gestion', title: 'Propiedades Gestionadas', desc: 'Portafolio de propiedades bajo administración Iwagé.', keywords: ['propiedades', 'gestionadas', 'portafolio', 'renta', 'noche'] },
  { url: '/gestion/servicios', brand: 'gestion', title: 'Servicios de Gestión', desc: 'Renta corta, finca productiva, segunda residencia y operación turística.', keywords: ['servicios', 'renta corta', 'finca productiva', 'segunda residencia', 'operacion turistica', 'glamping'] },
  { url: '/gestion/bitacora', brand: 'gestion', title: 'Bitácora Gestión', desc: 'Consejos de property management y rentabilidad rural.', keywords: ['bitacora', 'blog', 'gestion', 'management'] },
  { url: '/gestion/contacto', brand: 'gestion', title: 'Contacto Gestión', desc: 'Solicita una valoración de tu propiedad.', keywords: ['contacto', 'gestion', 'valoracion', 'propiedad'] },
];

/** Convert static pages to KnowledgeChunks for the index */
export function getStaticPageChunks(): KnowledgeChunk[] {
  return URL_MAP.map((page) => ({
    id: `pagina:${page.url}`,
    type: 'pagina' as const,
    brand: page.brand,
    title: page.title,
    summary: page.desc,
    keywords: page.keywords,
    url: page.url,
    metadata: {},
    updatedAt: new Date().toISOString(),
  }));
}
