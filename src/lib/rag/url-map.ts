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
  { url: '/', brand: 'general', title: 'Inicio Iwagé', desc: 'Ecosistema de 6 marcas: Meliponas, Café, Tierras, Naturaleza, Gestión y Granja.', keywords: ['inicio', 'home', 'iwage', 'ecosistema', 'marcas'] },

  // ── Meliponas ────────────────────────────────────────────
  { url: '/meliponas', brand: 'meliponas', title: 'Meliponario Iwagé', desc: 'Centro de meliponicultura en Ibagué, Tolima. Miel de Angelita, cajas tecnificadas y polinización.', keywords: ['meliponas', 'miel', 'angelita', 'abejas', 'meliponario', 'colmenas'] },
  { url: '/meliponas/tienda', brand: 'meliponas', title: 'Tienda Meliponas', desc: 'Miel de Angelita pura, cajas INPA/AF en Nogal Cafetero, kits de meliponicultura.', keywords: ['tienda', 'comprar', 'miel', 'cajas', 'inpa', 'af', 'kits', 'productos', 'precio'] },
  { url: '/meliponas/polinizacion', brand: 'meliponas', title: 'Polinización Gestionada', desc: 'Catálogo de servicios de polinización con meliponas para café, aguacate, mora, cítricos, tomate y fresa.', keywords: ['polinizacion', 'cultivos', 'aguacate', 'cafe', 'mora', 'citricos', 'tomate', 'fresa', 'servicio'] },
  { url: '/meliponas/proyectos', brand: 'meliponas', title: 'Proyectos de Meliponarios', desc: 'Diseño, instalación y acompañamiento de meliponarios para colegios, fincas, empresas y centros turísticos.', keywords: ['proyectos', 'meliponario', 'colegios', 'prae', 'fincas', 'instalacion', 'diseno', 'etapas'] },
  { url: '/meliponas/proyectos/lineas/fincas-productivas', brand: 'meliponas', title: 'Línea Fincas Productivas', desc: 'Meliponarios para fincas agropecuarias con polinización de café, aguacate y cítricos.', keywords: ['fincas', 'productivas', 'linea', 'polinizacion', 'cafe', 'aguacate'] },
  { url: '/meliponas/proyectos/lineas/paisajismo-residencial', brand: 'meliponas', title: 'Línea Paisajismo Residencial', desc: 'Meliponarios ornamentales para conjuntos residenciales y jardines privados.', keywords: ['paisajismo', 'residencial', 'ornamental', 'conjunto', 'jardin'] },
  { url: '/meliponas/proyectos/lineas/prae-educativo', brand: 'meliponas', title: 'Línea PRAE Educativo', desc: 'Proyectos escolares con meliponarios pedagógicos y senderos interpretativos.', keywords: ['prae', 'educativo', 'colegio', 'escuela', 'pedagogia', 'sendero'] },
  { url: '/meliponas/proyectos/lineas/turismo-naturaleza', brand: 'meliponas', title: 'Línea Turismo y Naturaleza', desc: 'Experiencias turísticas con observación de meliponas, catas y senderos interpretativos.', keywords: ['turismo', 'naturaleza', 'experiencia', 'cata', 'observacion', 'sendero'] },
  { url: '/meliponas/trazabilidad', brand: 'meliponas', title: 'Trazabilidad Iwagé', desc: 'Estándares verificables de miel, cajas IoT y polinización con QR de origen.', keywords: ['trazabilidad', 'estandar', 'iot', 'qr', 'calidad', 'laboratorio', 'lote'] },
  { url: '/meliponas/trazabilidad/miel', brand: 'meliponas', title: 'Trazabilidad de Miel', desc: 'Lotes de miel con código, flora, altitud, perfil de cata y resultados fisicoquímicos.', keywords: ['trazabilidad', 'miel', 'lote', 'cata', 'perfil', 'humedad', 'ph'] },
  { url: '/meliponas/trazabilidad/cajas', brand: 'meliponas', title: 'Trazabilidad de Cajas', desc: 'Cajas tecnificadas con identidad digital y sensores IoT.', keywords: ['trazabilidad', 'caja', 'inpa', 'af', 'iot', 'identidad', 'digital'] },
  { url: '/meliponas/trazabilidad/polinizacion', brand: 'meliponas', title: 'Trazabilidad de Polinización', desc: 'Servicio de polinización con métricas de cuajado, producción y biodiversidad.', keywords: ['trazabilidad', 'polinizacion', 'metrica', 'cuajado', 'produccion'] },
  { url: '/meliponas/herramientas', brand: 'meliponas', title: 'Herramientas del Meliponario', desc: 'Panel de herramientas: trazabilidad, Modelador Técnico Financiero e Intranet.', keywords: ['herramientas', 'modelador', 'financiero', 'intranet', 'panel', 'simulador'] },
  { url: '/meliponas/bitacora', brand: 'meliponas', title: 'Bitácora Meliponas', desc: 'Guías técnicas, flora nativa, territorio Pijao y producción agroecológica.', keywords: ['bitacora', 'blog', 'guias', 'flora', 'pijao', 'agroecologia'] },
  { url: '/meliponas/nosotros', brand: 'meliponas', title: 'Quiénes Somos', desc: 'Historia del proyecto, identidad Pijao y economía local sin extractivismo.', keywords: ['nosotros', 'historia', 'pijao', 'equipo', 'mision'] },
  { url: '/meliponas/ayuda', brand: 'meliponas', title: 'Ayuda Meliponas', desc: 'Preguntas frecuentes y centro de ayuda del meliponario.', keywords: ['ayuda', 'faq', 'preguntas', 'soporte'] },
  { url: '/meliponas/contacto', brand: 'meliponas', title: 'Contacto Meliponas', desc: 'Formulario de contacto y WhatsApp del meliponario.', keywords: ['contacto', 'whatsapp', 'escribir', 'hablar'] },

  // ── Café ─────────────────────────────────────────────────
  { url: '/cafe', brand: 'cafe', title: 'Café Iwagé', desc: 'Café comunitario con ingredientes nombrados, proveedores a menos de 4km.', keywords: ['cafe', 'comunitario', 'taza', 'territorio'] },
  { url: '/cafe/menu', brand: 'cafe', title: 'Menú del Café', desc: 'Carta de café, infusiones, panadería, signature y acompañamientos.', keywords: ['menu', 'carta', 'bebidas', 'panaderia', 'infusiones', 'signature', 'comida'] },
  { url: '/cafe/proveedores', brand: 'cafe', title: 'Proveedores del Café', desc: 'Proveedores locales a menos de 4km con historia y producto.', keywords: ['proveedores', 'locales', 'origen', 'producto', 'historia'] },
  { url: '/cafe/recetas', brand: 'cafe', title: 'Recetas del Café', desc: 'Recetas con café, panadería de autor y técnicas de barismo.', keywords: ['recetas', 'cafe', 'panaderia', 'barismo', 'cocina'] },
  { url: '/cafe/visitantes', brand: 'cafe', title: 'Historias de Visitantes', desc: 'Fauna, flora y personas que llegan al Café Iwagé.', keywords: ['visitantes', 'historias', 'fauna', 'flora', 'personas', 'cafe'] },
  { url: '/cafe/nosotros', brand: 'cafe', title: 'Nosotros Café', desc: 'Historia del café comunitario, equipo y propósito.', keywords: ['nosotros', 'cafe', 'historia', 'equipo'] },
  { url: '/cafe/bitacora', brand: 'cafe', title: 'Bitácora Café', desc: 'Artículos y novedades del café comunitario.', keywords: ['bitacora', 'blog', 'cafe', 'articulos'] },
  { url: '/cafe/ayuda', brand: 'cafe', title: 'Ayuda Café', desc: 'Preguntas frecuentes del café.', keywords: ['ayuda', 'cafe', 'faq'] },
  { url: '/cafe/contacto', brand: 'cafe', title: 'Contacto Café', desc: 'Contacto y ubicación del café.', keywords: ['contacto', 'cafe', 'ubicacion', 'horario'] },

  // ── Tierras ──────────────────────────────────────────────
  { url: '/tierras', brand: 'tierras', title: 'Iwagé Tierras', desc: 'Plataforma de propiedades rurales en el Tolima con verificación VAP.', keywords: ['tierras', 'propiedades', 'rural', 'inmobiliaria', 'fincas', 'lotes'] },
  { url: '/tierras/propiedades', brand: 'tierras', title: 'Catálogo de Propiedades', desc: 'Todas las propiedades rurales disponibles: fincas, lotes, casas campestres.', keywords: ['propiedades', 'catalogo', 'fincas', 'lotes', 'casas', 'comprar', 'arriendo', 'venta'] },
  { url: '/tierras/perfiles', brand: 'tierras', title: 'Perfiles de Comprador', desc: 'Encuentra propiedades según tu perfil: productivo, campestre, nómada, turístico o patrimonial.', keywords: ['compradores', 'perfiles', 'productivo', 'campestre', 'nomada', 'turistico', 'patrimonial'] },
  { url: '/tierras/perfiles/productivo', brand: 'tierras', title: 'Perfil Productivo', desc: 'Fincas para producción agropecuaria con agua, energía y vías.', keywords: ['perfil', 'productivo', 'agropecuario', 'finca', 'agua'] },
  { url: '/tierras/perfiles/campestre', brand: 'tierras', title: 'Perfil Campestre', desc: 'Casas campestres y fincas de descanso con naturaleza.', keywords: ['perfil', 'campestre', 'casa', 'descanso', 'finca'] },
  { url: '/tierras/perfiles/nomada', brand: 'tierras', title: 'Perfil Nómada Digital', desc: 'Propiedades con internet, energía y amenidades para vivir y trabajar remoto.', keywords: ['perfil', 'nomada', 'digital', 'internet', 'starlink'] },
  { url: '/tierras/perfiles/turistico', brand: 'tierras', title: 'Perfil Turístico', desc: 'Propiedades con potencial turístico: glamping, ecoturismo, retiros.', keywords: ['perfil', 'turistico', 'glamping', 'ecoturismo', 'retiro'] },
  { url: '/tierras/perfiles/patrimonial', brand: 'tierras', title: 'Perfil Patrimonial', desc: 'Propiedades para inversión patrimonial de largo plazo.', keywords: ['perfil', 'patrimonial', 'inversion', 'largo', 'plazo'] },
  { url: '/tierras/comprar', brand: 'tierras', title: 'Cómo comprar', desc: 'Guía paso a paso para comprar una propiedad rural con Iwagé Tierras.', keywords: ['comprar', 'guia', 'pasos', 'asesor', 'tierras'] },
  { url: '/tierras/vender', brand: 'tierras', title: 'Cómo vender', desc: 'Vendemos tu propiedad rural con verificación VAP y difusión curada.', keywords: ['vender', 'publicar', 'vap', 'tierras', 'captacion'] },
  { url: '/tierras/lab', brand: 'tierras', title: 'Iwagé Lab Tierras', desc: 'Laboratorio de ideas y prototipos para el mercado rural.', keywords: ['lab', 'laboratorio', 'ideas', 'prototipos', 'tierras'] },
  { url: '/tierras/protocolo-vap', brand: 'tierras', title: 'Protocolo VAP', desc: 'Estándar de verificación VAP para propiedades rurales: pilares y niveles.', keywords: ['protocolo', 'vap', 'verificacion', 'estandar', 'oro', 'plata', 'bronce'] },
  { url: '/tierras/vap', brand: 'tierras', title: 'Verificación VAP', desc: 'Sistema de verificación de propiedades: Sello Oro, Plata, Bronce con pilares VAP.', keywords: ['vap', 'verificacion', 'sello', 'oro', 'plata', 'bronce', 'legal', 'titulos', 'pilar'] },
  { url: '/tierras/herramientas/calculadora-notarial', brand: 'tierras', title: 'Calculadora Notarial', desc: 'Calcula los costos notariales y de registro para tu compra rural.', keywords: ['calculadora', 'notarial', 'costos', 'registro', 'compra'] },
  { url: '/tierras/herramientas/evaluacion-vap', brand: 'tierras', title: 'Evaluación VAP', desc: 'Autoevaluación VAP para tu propiedad según los pilares del estándar.', keywords: ['evaluacion', 'vap', 'autoevaluacion', 'pilar', 'estandar'] },
  { url: '/tierras/herramientas/roi-calculator', brand: 'tierras', title: 'Calculadora ROI', desc: 'Calcula el retorno de inversión de tu propiedad rural.', keywords: ['roi', 'calculadora', 'retorno', 'inversion', 'renta'] },
  { url: '/tierras/bitacora', brand: 'tierras', title: 'Bitácora Tierras', desc: 'Conocimiento territorial del Tolima: guías, análisis y mercado.', keywords: ['bitacora', 'blog', 'tierras', 'territorio', 'mercado'] },
  { url: '/tierras/nosotros', brand: 'tierras', title: 'Nosotros Tierras', desc: 'Quiénes somos y el propósito del marketplace rural.', keywords: ['nosotros', 'tierras', 'historia', 'equipo'] },
  { url: '/tierras/ayuda', brand: 'tierras', title: 'Ayuda Tierras', desc: 'Preguntas frecuentes sobre comprar, vender y verificar.', keywords: ['ayuda', 'tierras', 'faq', 'comprar', 'vender'] },
  { url: '/tierras/contacto', brand: 'tierras', title: 'Contacto Tierras', desc: 'Habla con un asesor inmobiliario rural.', keywords: ['contacto', 'tierras', 'asesor', 'whatsapp'] },

  // ── Naturaleza ───────────────────────────────────────────
  { url: '/naturaleza', brand: 'naturaleza', title: 'Iwagé Naturaleza', desc: 'Turismo regenerativo en el Tolima: experiencias curadas con anfitriones locales.', keywords: ['naturaleza', 'turismo', 'regenerativo', 'experiencias'] },
  { url: '/naturaleza/experiencias', brand: 'naturaleza', title: 'Experiencias', desc: 'Catálogo de experiencias: naturaleza, cultura, bienestar, aventura y gastronomía.', keywords: ['experiencias', 'tours', 'actividades', 'naturaleza', 'cultura', 'bienestar', 'aventura', 'gastronomia'] },
  { url: '/naturaleza/anfitriones', brand: 'naturaleza', title: 'Anfitriones', desc: 'Guías locales y guardianes del territorio con historia y arraigo.', keywords: ['anfitriones', 'guias', 'locales', 'guardianes', 'territorio'] },
  { url: '/naturaleza/anfitriones/hub', brand: 'naturaleza', title: 'Hub de Anfitriones', desc: 'Comunidad de anfitriones con escalafón, certificaciones y pacto Iwagé.', keywords: ['hub', 'anfitriones', 'escalafon', 'pacto', 'comunidad'] },
  { url: '/naturaleza/escalafon', brand: 'naturaleza', title: 'Escalafón del Anfitrión', desc: 'Niveles del escalafón Iwagé: Semilla, Brote, Raíz, Guardián y Sabio Ancestral.', keywords: ['escalafon', 'niveles', 'semilla', 'brote', 'raiz', 'guardian', 'sabio', 'ancestral'] },
  { url: '/naturaleza/clasificacion', brand: 'naturaleza', title: 'Clasificación de Experiencias', desc: 'Cómo clasificamos las experiencias: dificultad, tipo, duración y categorías.', keywords: ['clasificacion', 'categoria', 'dificultad', 'tipo', 'experiencia'] },
  { url: '/naturaleza/impacto', brand: 'naturaleza', title: 'Impacto y Fondo de Restauración', desc: 'Métricas de impacto territorial, iniciativas y fondo de restauración.', keywords: ['impacto', 'fondo', 'restauracion', 'metrica', 'iniciativa'] },
  { url: '/naturaleza/se-anfitrion', brand: 'naturaleza', title: 'Sé Anfitrión', desc: 'Únete al programa de anfitriones Iwagé: comparte tu territorio.', keywords: ['ser', 'anfitrion', 'unirse', 'programa', 'territorio'] },
  { url: '/naturaleza/programas', brand: 'naturaleza', title: 'Programas & Paquetes Turísticos', desc: 'Paquetes multi-experiencia de varios días con todo incluido.', keywords: ['paquetes', 'programas', 'tours', 'dias', 'incluido', 'multi'] },
  { url: '/naturaleza/bitacora', brand: 'naturaleza', title: 'Bitácora Naturaleza', desc: 'Historias del territorio, biodiversidad y turismo consciente.', keywords: ['bitacora', 'blog', 'naturaleza', 'biodiversidad'] },
  { url: '/naturaleza/nosotros', brand: 'naturaleza', title: 'Nosotros Naturaleza', desc: 'Equipo, propósito y filosofía del turismo regenerativo.', keywords: ['nosotros', 'naturaleza', 'regenerativo', 'equipo'] },
  { url: '/naturaleza/ayuda', brand: 'naturaleza', title: 'Ayuda Naturaleza', desc: 'Preguntas frecuentes sobre reservas y experiencias.', keywords: ['ayuda', 'naturaleza', 'faq', 'reservas'] },
  { url: '/naturaleza/contacto', brand: 'naturaleza', title: 'Contacto Naturaleza', desc: 'Reserva experiencias o habla con nuestro equipo.', keywords: ['contacto', 'naturaleza', 'reservar', 'reserva'] },

  // ── Gestión ──────────────────────────────────────────────
  { url: '/gestion', brand: 'gestion', title: 'Iwagé Gestión', desc: 'Administración de propiedades: renta corta, finca productiva, segunda residencia y operación turística.', keywords: ['gestion', 'administracion', 'propiedades', 'renta', 'airbnb', 'booking'] },
  { url: '/gestion/alojamientos', brand: 'gestion', title: 'Alojamientos para Huéspedes', desc: 'Catálogo de alojamientos y propiedades gestionadas por Iwagé: fincas, cabañas, domos y glamping.', keywords: ['alojamientos', 'huespedes', 'finca', 'cabana', 'domo', 'glamping', 'reservar', 'propiedades', 'gestionadas'] },
  { url: '/gestion/experiencias', brand: 'gestion', title: 'Experiencias con Alojamiento', desc: 'Experiencias de naturaleza, cultura, bienestar, aventura y gastronomía conectadas a alojamientos.', keywords: ['experiencias', 'alojamiento', 'naturaleza', 'aventura', 'gastronomia', 'bienestar', 'cultura'] },

  { url: '/gestion/propietarios', brand: 'gestion', title: 'Modelos de Gestión para Propietarios', desc: 'Renta corta, finca productiva, segunda residencia y operación turística.', keywords: ['servicios', 'renta corta', 'finca productiva', 'segunda residencia', 'operacion turistica', 'glamping', 'propietarios', 'modelos'] },
  { url: '/gestion/propietarios/renta-corta', brand: 'gestion', title: 'Modelo Renta Corta', desc: 'Administración de renta corta tipo Airbnb y Booking con operación completa.', keywords: ['renta', 'corta', 'airbnb', 'booking', 'administracion', 'modelo'] },
  { url: '/gestion/propietarios/finca-productiva', brand: 'gestion', title: 'Modelo Finca Productiva', desc: 'Gestión agropecuaria con producción, trazabilidad y comercialización.', keywords: ['finca', 'productiva', 'agropecuaria', 'produccion', 'trazabilidad'] },
  { url: '/gestion/propietarios/segunda-residencia', brand: 'gestion', title: 'Modelo Segunda Residencia', desc: 'Supervisión, mantenimiento y cuidado de tu segunda casa.', keywords: ['segunda', 'residencia', 'supervision', 'mantenimiento', 'cuidado'] },
  { url: '/gestion/propietarios/operacion-turistica', brand: 'gestion', title: 'Modelo Operación Turística', desc: 'Glamping, ecoturismo y retiros con operación turística integral.', keywords: ['operacion', 'turistica', 'glamping', 'ecoturismo', 'retiro', 'modelo'] },
  { url: '/gestion/propietarios/modelo-alianzas', brand: 'gestion', title: 'Modelo de Alianzas', desc: 'Tres modelos de alianza: gestión pura, co-inversión y operación compartida.', keywords: ['alianza', 'co-inversion', 'gestion', 'pura', 'compartida', 'modelo'] },
  { url: '/gestion/bitacora', brand: 'gestion', title: 'Bitácora Gestión', desc: 'Consejos de property management y rentabilidad rural.', keywords: ['bitacora', 'blog', 'gestion', 'management'] },
  { url: '/gestion/nosotros', brand: 'gestion', title: 'Nosotros Gestión', desc: 'Equipo de gestión de propiedades y propósito.', keywords: ['nosotros', 'gestion', 'equipo', 'propiedades'] },
  { url: '/gestion/ayuda', brand: 'gestion', title: 'Ayuda Gestión', desc: 'Preguntas frecuentes sobre gestión de propiedades.', keywords: ['ayuda', 'gestion', 'faq', 'propietarios'] },
  { url: '/gestion/contacto', brand: 'gestion', title: 'Contacto Gestión', desc: 'Solicita una valoración de tu propiedad.', keywords: ['contacto', 'gestion', 'valoracion', 'propiedad'] },

  // ── Granja ───────────────────────────────────────────────
  { url: '/granja', brand: 'granja', title: 'Iwagé Granja', desc: 'Granja sostenible con 6 subsistemas integrados: hídrica, energía, bio-refinería, agroecosistema, monitoreo y biodiversidad.', keywords: ['granja', 'sostenible', 'subsistema', 'permacultura', 'agroecologia'] },
  { url: '/granja/sistema', brand: 'granja', title: 'Sistemas de la Granja', desc: '6 subsistemas: hídrica, energía, bio-refinería, agroecosistema, monitoreo, biodiversidad.', keywords: ['sistema', 'subsistema', 'hidrica', 'energia', 'biorefineria', 'agroecosistema', 'monitoreo', 'biodiversidad'] },
  { url: '/granja/sistema/gestion-hidrica', brand: 'granja', title: 'Gestión Hídrica', desc: 'Ciclo cerrado de agua: captación de lluvia, reutilización de grises y hábitos.', keywords: ['hidrica', 'agua', 'lluvia', 'ciclo', 'cerrado', 'reutilizacion'] },
  { url: '/granja/sistema/energia', brand: 'granja', title: 'Energía Solar', desc: 'Sistema solar off-grid y generación distribuida para la granja.', keywords: ['energia', 'solar', 'off-grid', 'fotovoltaica', 'renovable'] },
  { url: '/granja/sistema/biorefineria-domestica', brand: 'granja', title: 'Bio-refinería Doméstica', desc: 'Compost, biodigestión y ciclos de nutrientes cerrados.', keywords: ['biorefineria', 'compost', 'biodigestion', 'residuos', 'ciclo', 'nutrientes'] },
  { url: '/granja/sistema/agroecosistema-productivo', brand: 'granja', title: 'Agroecosistema Productivo', desc: 'Huerta intensiva, agroforestería y producción animal integrada.', keywords: ['agroecosistema', 'huerta', 'agroforesteria', 'animal', 'produccion'] },
  { url: '/granja/tienda', brand: 'granja', title: 'Tienda de la Granja', desc: 'Productos frescos y elaborados de la granja: miel, huerta, panadería.', keywords: ['tienda', 'granja', 'productos', 'frescos', 'miel', 'huerta'] },
  { url: '/granja/visitas', brand: 'granja', title: 'Visitas a la Granja', desc: 'Programa de visitas educativas y turísticas a la granja.', keywords: ['visitas', 'granja', 'educativa', 'turistica', 'recorrido'] },
  { url: '/granja/servicios', brand: 'granja', title: 'Servicios de la Granja', desc: 'Asesoría, diseño, instalación y acompañamiento para granjas regenerativas.', keywords: ['servicios', 'granja', 'asesoria', 'diseno', 'instalacion', 'regenerativa'] },
  { url: '/granja/experimentos', brand: 'granja', title: 'Experimentos Granja', desc: 'Fichas de experimento del laboratorio vivo: origen, hipótesis, proceso, resultado y lección de cada experimento.', keywords: ['experimentos', 'laboratorio', 'vivo', 'granja', 'ficha', 'origen', 'hipotesis', 'proceso', 'resultado', 'leccion'] },
  { url: '/granja/nosotros', brand: 'granja', title: 'Nosotros Granja', desc: 'Filosofía, equipo y propósito de la granja.', keywords: ['nosotros', 'granja', 'filosofia', 'equipo'] },
  { url: '/granja/ayuda', brand: 'granja', title: 'Ayuda Granja', desc: 'Preguntas frecuentes sobre la granja y sus subsistemas.', keywords: ['ayuda', 'granja', 'faq'] },
  { url: '/granja/contacto', brand: 'granja', title: 'Contacto Granja', desc: 'Visitas, asesoría y consultas sobre la granja.', keywords: ['contacto', 'granja', 'visitas', 'asesoria'] },

  // ── Centro de Ayuda ──────────────────────────────────────
  { url: '/ayuda', brand: 'general', title: 'Centro de Ayuda', desc: 'Centro de ayuda con guías para usuarios y para el equipo interno.', keywords: ['ayuda', 'centro', 'soporte', 'guia'] },
  { url: '/ayuda/usuarios', brand: 'general', title: 'Ayuda para Usuarios', desc: 'Guías para usuarios: explorar, marcas, tienda, carrito, pedidos, reservas, mi cuenta, herramientas.', keywords: ['ayuda', 'usuarios', 'tienda', 'pedidos', 'reservas', 'cuenta', 'herramientas'] },
  { url: '/ayuda/usuarios/explorar-plataforma', brand: 'general', title: 'Explorar la plataforma', desc: 'Cómo recorrer las marcas y los módulos del ecosistema Iwagé.', keywords: ['explorar', 'plataforma', 'marcas', 'modulos', 'ecosistema'] },
  { url: '/ayuda/usuarios/marcas', brand: 'general', title: 'Marcas y módulos', desc: 'Meliponas, Café, Tierras, Naturaleza, Gestión y Granja: qué hace cada una.', keywords: ['marcas', 'modulos', 'meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion', 'granja'] },
  { url: '/ayuda/usuarios/tienda', brand: 'general', title: 'Tienda y pagos', desc: 'Cómo comprar en la tienda, métodos de pago y seguimiento.', keywords: ['tienda', 'comprar', 'pagos', 'metodos', 'pedido'] },
  { url: '/ayuda/usuarios/carrito', brand: 'general', title: 'Carrito', desc: 'Gestión del carrito de compras, variantes y cupones.', keywords: ['carrito', 'compra', 'variantes', 'cupones'] },
  { url: '/ayuda/usuarios/pedidos', brand: 'general', title: 'Mis pedidos', desc: 'Cómo ver el estado, el envío y la garantía de un pedido.', keywords: ['pedidos', 'estado', 'envio', 'garantia'] },
  { url: '/ayuda/usuarios/reservas', brand: 'general', title: 'Mis reservas', desc: 'Cómo gestionar tus reservas de experiencias y alojamientos.', keywords: ['reservas', 'gestionar', 'experiencia', 'alojamiento'] },
  { url: '/ayuda/usuarios/mi-cuenta', brand: 'general', title: 'Mi cuenta', desc: 'Gestiona tu cuenta, datos personales y preferencias.', keywords: ['cuenta', 'perfil', 'datos', 'preferencias'] },
  { url: '/ayuda/usuarios/herramientas', brand: 'general', title: 'Herramientas', desc: 'Calculadoras, simuladores y modelos del ecosistema.', keywords: ['herramientas', 'calculadoras', 'simuladores', 'modelos'] },
  { url: '/ayuda/equipo', brand: 'general', title: 'Ayuda para el equipo', desc: 'Guías internas para el equipo: contenido, pagos, configuración, reservas, portal aliados.', keywords: ['ayuda', 'equipo', 'interno', 'cms', 'pagos'] },
  { url: '/ayuda/equipo/strapi-cms', brand: 'general', title: 'Strapi CMS', desc: 'Cómo gestionar contenido en Strapi: tipos, publicaciones, traducciones.', keywords: ['strapi', 'cms', 'contenido', 'publicar', 'traducciones'] },
  { url: '/ayuda/equipo/contenido-tipos', brand: 'general', title: 'Tipos de contenido', desc: 'Referencia de tipos de contenido: productos, propiedades, experiencias, etc.', keywords: ['tipos', 'contenido', 'producto', 'propiedad', 'experiencia'] },
  { url: '/ayuda/equipo/pagos', brand: 'general', title: 'Pagos', desc: 'Configuración de pagos, conciliaciones y reportes.', keywords: ['pagos', 'conciliacion', 'reportes', 'configuracion'] },
  { url: '/ayuda/equipo/ordenes', brand: 'general', title: 'Órdenes', desc: 'Gestión de órdenes, devoluciones y reembolsos.', keywords: ['ordenes', 'devoluciones', 'reembolsos'] },
  { url: '/ayuda/equipo/configuracion', brand: 'general', title: 'Configuración', desc: 'Configuración general del sitio, integraciones y variables.', keywords: ['configuracion', 'sitio', 'integraciones', 'variables'] },
  { url: '/ayuda/equipo/gestion-reservas', brand: 'general', title: 'Gestión de reservas', desc: 'Calendario, disponibilidad y bloqueos.', keywords: ['reservas', 'calendario', 'disponibilidad', 'bloqueos'] },
  { url: '/ayuda/equipo/reservas-admin', brand: 'general', title: 'Reservas admin', desc: 'Panel administrativo de reservas, pagos y huéspedes.', keywords: ['reservas', 'admin', 'panel', 'huespedes'] },
  { url: '/ayuda/equipo/sincronizacion', brand: 'general', title: 'Sincronización', desc: 'Sincronización entre Strapi, frontend y servicios externos.', keywords: ['sincronizacion', 'strapi', 'frontend', 'externos'] },
  { url: '/ayuda/equipo/portal-aliados', brand: 'general', title: 'Portal de aliados', desc: 'Acceso y gestión del portal de aliados y anfitriones.', keywords: ['portal', 'aliados', 'anfitriones', 'gestion'] },

  // ── Legal ────────────────────────────────────────────────
  { url: '/legal', brand: 'general', title: 'Información Legal', desc: 'Documentos legales: términos, privacidad, cookies, cancelaciones y devoluciones.', keywords: ['legal', 'terminos', 'privacidad', 'cookies', 'cancelaciones', 'devoluciones'] },
  { url: '/legal/terminos-y-condiciones', brand: 'general', title: 'Términos y Condiciones', desc: 'Términos y condiciones de uso del ecosistema Iwagé.', keywords: ['terminos', 'condiciones', 'uso'] },
  { url: '/legal/tratamiento-de-datos', brand: 'general', title: 'Tratamiento de Datos', desc: 'Política de tratamiento de datos personales según Habeas Data Colombia.', keywords: ['datos', 'personales', 'habeas', 'data', 'privacidad'] },
  { url: '/legal/cookies', brand: 'general', title: 'Política de Cookies', desc: 'Tipos de cookies usadas en el sitio y cómo gestionarlas.', keywords: ['cookies', 'politica', 'gestion'] },
  { url: '/legal/cancelaciones-y-reembolsos', brand: 'general', title: 'Cancelaciones y Reembolsos', desc: 'Política de cancelaciones, reembolsos y cambios de reservas.', keywords: ['cancelaciones', 'reembolsos', 'cambios', 'reservas'] },
  { url: '/legal/devoluciones-y-retracto', brand: 'general', title: 'Devoluciones y Derecho de Retracto', desc: 'Política de devoluciones y derecho de retracto para compras.', keywords: ['devoluciones', 'retracto', 'derecho', 'compras'] },
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
