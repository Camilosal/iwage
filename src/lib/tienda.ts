/**
 * Tienda Meliponario — product data layer.
 * Fetches from Strapi `productos` collection with Redis caching.
 * Falls back to local seed data when Strapi is unavailable.
 */
import { strapiFetch, CACHE_TTL, strapiImage } from './strapi';

// ── Types ──────────────────────────────────────────────
export interface GaleriaItem {
  url: string;
  tipo?: 'imagen' | 'video' | '360';
  titulo?: string;
}

/** Elemento clave o diferenciador del producto (máx. 3). */
export interface Diferenciador {
  titulo: string;
  descripcion: string;
  /** Nombre de icono Lucide (p.ej. "sparkles") o emoji. */
  icono?: string;
}

/** Paso o tip de la mini-guía de uso (máx. 4). */
export interface GuiaUsoItem {
  titulo: string;
  descripcion?: string;
  /** Emoji o nombre de icono Lucide. */
  icono?: string;
}

/** Pregunta frecuente específica del producto. */
export interface FAQItem {
  pregunta: string;
  respuesta: string;
}

/** Conexión del producto con otra marca/espacio del ecosistema Iwagé. */
export interface EcosistemaItem {
  marca: string;
  titulo: string;
  descripcion: string;
  url: string;
  emoji?: string;
}

export interface Producto {
  id: number;
  documentId: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  sku: string | null;
  precio: number;
  precio_comparativo: number | null;
  presentacion: string | null;
  categoria: 'miel' | 'caja' | 'kit' | 'asistencia' | 'accesorio' | 'propoleo' | 'ceras' | 'cosecha' | 'huevos' | 'plantas' | 'abono' | 'experiencia';
  /** Marca dueña del producto ('meliponas' por defecto; 'granja' para la tienda de la granja). */
  marca?: 'meliponas' | 'granja';
  imagen: string | null;
  galeria: GaleriaItem[] | null;
  stock_disponible: boolean;
  stock_cantidad: number | null;
  destacado: boolean;
  canal_venta: 'online' | 'local' | 'ambos';
  peso_gramos: number | null;
  dimensiones: string | null;
  variantes: Array<{ nombre: string; opciones: string[] }> | null;
  tags: string[] | null;
  orden: number;
  envio_gratis: boolean;
  tiempo_entrega: string | null;
  orden_minima: number;
  /** Clave de agrupación de variaciones (p.ej. "miel-angelita"). Productos con la misma familia son variaciones entre sí. */
  familia: string | null;
  /** Etiqueta corta de la variación para el selector (p.ej. "250 ml"). */
  etiqueta_variacion: string | null;
  /** Nombre del eje de variación para el selector (p.ej. "Presentación", "Tamaño", "Estilo"). */
  eje_variacion: string | null;
  diferenciadores: Diferenciador[] | null;
  guia_uso: GuiaUsoItem[] | null;
  faq: FAQItem[] | null;
  ecosistema: EcosistemaItem[] | null;
  meta_title: string | null;
  meta_description: string | null;
}

export type CategoriaSlug = 'miel' | 'caja' | 'kit' | 'asistencia' | 'accesorio' | 'propoleo' | 'ceras' | 'cosecha' | 'huevos' | 'plantas' | 'abono' | 'experiencia';

export const CATEGORIAS: { id: CategoriaSlug; label: string }[] = [
  { id: 'miel', label: 'Miel' },
  { id: 'caja', label: 'Cajas' },
  { id: 'kit', label: 'Kits' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'accesorio', label: 'Accesorios' },
  { id: 'propoleo', label: 'Propóleo' },
  { id: 'ceras', label: 'Ceras' },
];

/** Categorías propias de la tienda de la Granja Autosustentable. */
export const CATEGORIAS_GRANJA: { id: CategoriaSlug; label: string }[] = [
  { id: 'cosecha', label: 'Cosecha' },
  { id: 'huevos', label: 'Huevos' },
  { id: 'plantas', label: 'Plantas' },
  { id: 'abono', label: 'Abonos' },
  { id: 'miel', label: 'Miel' },
  { id: 'experiencia', label: 'Experiencias' },
];

// ── Fallback seed data (used when Strapi is down) ──────
const FALLBACK_PRODUCTOS: Producto[] = [
  { id: 1, documentId: 'fb-1', nombre: 'Miel Angelita 250ml', slug: 'miel-angelita-250ml', descripcion: 'Miel pura y cruda de **Tetragonisca angustula** — abeja nativa sin aguijón. Cosecha mayo 2025, flora de guamo y café del corredor Ambalá.\n\n**Por qué es diferente:** Los meliponinos producen una miel con menos azúcares, más minerales y hasta un 30 % más de poder antioxidante que la miel convencional. Cada colonia rinde entre 0.5 y 1 litro al año.\n\n**Perfil de cata:** Sabor frutal-mineral con acidez cítrica que recuerda al maracuyá, color ámbar oscuro, alta fluidez.\n\n**Trazabilidad radical:** La etiqueta indica el nombre de la colmena, la fecha de cosecha y la flora de temporada. Sabrás exactamente de dónde viene cada frasco.\n\n**Requiere refrigeración** para preservar sus propiedades enzimáticas.', descripcion_corta: 'Miel pura de Angelita, cosecha 2025. Alto poder antioxidante.', sku: 'MIEL-250', precio: 45000, precio_comparativo: null, familia: 'miel-angelita', etiqueta_variacion: '250 ml', eje_variacion: 'Presentación', presentacion: '250 ml · Lote L25-05-001', categoria: 'miel', imagen: 'https://tienda.iwage.co/wp-content/uploads/2026/05/Presentacion-Miel-Gotero.png', galeria: null, stock_disponible: true, stock_cantidad: 30, destacado: true, canal_venta: 'ambos', peso_gramos: 350, dimensiones: null, variantes: null, tags: ['angelita', 'cosecha-2025', 'meliponas'], orden: 1, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, diferenciadores: [{ titulo: '30% más antioxidantes', descripcion: 'Los meliponinos producen una miel con más minerales y hasta un 30% más de poder antioxidante que la miel convencional.', icono: 'sparkles' }, { titulo: 'Trazabilidad radical', descripcion: 'La etiqueta indica colmena, fecha de cosecha y flora de temporada. Sabes exactamente de dónde viene cada frasco.', icono: 'qr-code' }, { titulo: 'Cruda y viva', descripcion: 'Sin calentar ni filtrar en exceso. Conserva enzimas, polen y propiedades intactas. Requiere refrigeración.', icono: 'leaf' }], guia_uso: [{ titulo: 'En infusión', descripcion: 'Reemplaza el azúcar en café o té. Disuelve a menos de 40 °C para preservar sus enzimas.', icono: '🍵' }, { titulo: 'Con quesos', descripcion: 'Marida con quesos madurados y frescos. El contraste dulce-salado es excepcional.', icono: '🧀' }, { titulo: 'Cucharadita directa', descripcion: 'Para calmar la tos o como energético natural. Una cucharadita en ayunas.', icono: '🥄' }, { titulo: 'Mascarilla facial', descripcion: 'Mezcla con avena y aplica 15 minutos. Regeneradora y antibacteriana natural.', icono: '🧴' }], faq: [{ pregunta: '¿Cómo conservar la miel de Angelita?', respuesta: 'Refrigeración constante (4-8 °C). A diferencia de la miel de Apis mellifera, la miel de Angelita tiene mayor humedad y puede fermentar a temperatura ambiente. En nevera se conserva sin cambios.' }, { pregunta: '¿Por qué cuesta más que la miel común?', respuesta: 'Una colonia de Tetragonisca angustula produce entre 0.5 y 1 litro al año — diez veces menos que una de Apis mellifera. Su perfil nutricional también es distinto: más minerales, más antioxidantes y menor índice glucémico.' }, { pregunta: '¿Es normal que la miel cristalice?', respuesta: 'Sí, es garantía de pureza. La miel cruda (sin calentar) cristaliza con el tiempo. Para fluidificarla, sumerge el frasco en agua tibia (máx. 40 °C) — nunca en microondas.' }], ecosistema: [{ marca: 'Café Iwagé', titulo: 'Pruébala en café', descripcion: 'Prueba la Miel de Angelita con café ($9.000) o el Pan de yuca y miel ($4.500). Nuestra miel en preparaciones de temporada.', url: '/cafe/menu', emoji: '☕' }, { marca: 'Iwagé Naturaleza', titulo: 'Producida por anfitriones', descripcion: 'Detrás de cada frasco hay guardianes del territorio que cuentan la historia del corredor Ambalá. Conócelos.', url: '/naturaleza/anfitriones', emoji: '🌿' }, { marca: 'Nuestro origen', titulo: 'Conoce el meliponario', descripcion: 'El Café Iwagé nació del meliponario. Una historia de abejas, café de 1,400 m y el sabor del territorio.', url: '/cafe/nosotros', emoji: '🍯' }], meta_title: null, meta_description: null },
  { id: 2, documentId: 'fb-2', nombre: 'Miel Angelita 500ml', slug: 'miel-angelita-500ml', descripcion: 'Presentación familiar de nuestra miel de **Tetragonisca angustula**. Misma cosecha, perfil cítrico con final floral.\n\n**Trazabilidad por colmena y cosecha.** Producida en el meliponario del corredor Ambalá, Ibagué. Cada frasco tiene etiqueta con origen verificable.\n\n**Conservación:** Refrigeración constante (4-8 °C). Fuera de nevera se conserva semanas en lugar fresco y sin luz directa.\n\n**Usos:** Ideal para gastronomía, repostería, endulzar infusiones y maridar con quesos madurados.', descripcion_corta: 'Presentación familiar 500ml. Perfil cítrico.', sku: 'MIEL-500', precio: 78000, precio_comparativo: null, familia: 'miel-angelita', etiqueta_variacion: '500 ml', eje_variacion: 'Presentación', presentacion: '500 ml · Lote L25-05-001', categoria: 'miel', imagen: 'https://tienda.iwage.co/wp-content/uploads/2026/05/Presentacion-Miel-Gotero.png', galeria: null, stock_disponible: true, stock_cantidad: 20, destacado: false, canal_venta: 'ambos', peso_gramos: 650, dimensiones: null, variantes: null, tags: ['angelita', 'familiar', 'meliponas'], orden: 2, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 3, documentId: 'fb-3', nombre: 'Miel Angelita 120ml', slug: 'miel-angelita-120ml', descripcion: 'Presentación degustación de miel de **Tetragonisca angustula**. Ideal para regalo o primera experiencia.\n\n**Perfil frutal-ácido** con notas a maracuyá, color ámbar oscuro. Alto poder antioxidante y menor índice glucémico que la miel convencional.\n\n**Trazabilidad completa.** En cada frasco: nombre de colmena, fecha de cosecha, flora de temporada.\n\n**Requiere refrigeración.**', descripcion_corta: 'Degustación, ideal para regalo.', sku: 'MIEL-120', precio: 25000, precio_comparativo: null, familia: 'miel-angelita', etiqueta_variacion: '120 ml', eje_variacion: 'Presentación', presentacion: '120 ml · Lote L25-05-001', categoria: 'miel', imagen: 'https://tienda.iwage.co/wp-content/uploads/2026/05/Presentacion-Miel-Gotero.png', galeria: null, stock_disponible: true, stock_cantidad: 50, destacado: false, canal_venta: 'ambos', peso_gramos: 200, dimensiones: null, variantes: null, tags: ['degustacion', 'regalo', 'meliponas'], orden: 3, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 4, documentId: 'fb-4', nombre: 'Miel con propóleo 250ml', slug: 'miel-con-propoleo-250ml', descripcion: 'Blend artesanal de miel de Angelita y propóleo de meliponas. Sabor intenso con notas resinosas y final herbal.\n\nEl propóleo es un potente antimicrobiano natural que las abejas producen a partir de resinas vegetales. Combinado con la miel de Angelita, potencia sus propiedades para cuidado de garganta y sistema inmune.\n\n**Usos recomendados:** Una cucharadita en ayunas, en infusión caliente o directamente para alivio de garganta.\n\n**Requiere refrigeración.**', descripcion_corta: 'Blend miel + propóleo, edición limitada.', sku: 'MIEL-PROP-250', precio: 52000, precio_comparativo: null, presentacion: '250 ml · Edición limitada', categoria: 'miel', imagen: 'https://tienda.iwage.co/wp-content/uploads/2026/05/Presentacion-Miel-Gotero.png', galeria: null, stock_disponible: true, stock_cantidad: 12, destacado: false, canal_venta: 'ambos', peso_gramos: 350, dimensiones: null, variantes: null, tags: ['propoleo', 'edicion-limitada', 'meliponas'], orden: 4, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, diferenciadores: [{ titulo: 'Doble protección', descripcion: 'Blend de miel y propóleo: antimicrobiano natural potenciado para garganta y sistema inmune.', icono: 'shield' }, { titulo: 'Edición limitada', descripcion: 'Cosecha selecta de pocas colmenas. El propóleo se recolecta a mano en cada revisión.', icono: 'gem' }, { titulo: 'Sabor intenso', descripcion: 'Notas resinosas y final herbal que lo distinguen de la miel clásica.', icono: 'flame' }], guia_uso: [{ titulo: 'En ayunas', descripcion: 'Una cucharadita en ayunas para reforzar el sistema inmune.', icono: '🌅' }, { titulo: 'En infusión caliente', descripcion: 'Disuelve en té o agua tibia para aliviar la garganta.', icono: '🍵' }, { titulo: 'Directa', descripcion: 'Media cucharadita directa para alivio rápido de garganta.', icono: '🥄' }], faq: [{ pregunta: '¿Qué es el propóleo?', respuesta: 'Es una resina que las abejas recolectan de brotes vegetales y transforman con sus enzimas. Es un potente antimicrobiano y antiinflamatorio natural.' }, { pregunta: '¿Requiere refrigeración?', respuesta: 'Sí, al igual que la miel de Angelita. El blend se conserva mejor refrigerado (4-8 °C).' }], ecosistema: [{ marca: 'Iwagé Naturaleza', titulo: 'Producida por anfitriones', descripcion: 'El propóleo lo recolectan guardianes del territorio en el corredor Ambalá.', url: '/naturaleza/anfitriones', emoji: '🌿' }], meta_title: null, meta_description: null },
  { id: 5, documentId: 'fb-5', nombre: 'Caja INPA Pequeña', slug: 'caja-inpa-pequena', descripcion: 'Modelo INPA en nogal cafetero, tamaño pequeño. Ideal para colonias jóvenes. Incluye trampas de forrajeo y base.', descripcion_corta: 'Caja INPA en nogal cafetero, tamaño pequeño.', sku: 'CAJA-INPA-P', precio: 150000, precio_comparativo: null, familia: 'caja-inpa', etiqueta_variacion: 'Pequeña', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 25×16×12 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 6, destacado: false, canal_venta: 'ambos', peso_gramos: 2800, dimensiones: '25×16×12 cm', variantes: null, tags: ['inpa', 'nogal'], orden: 1, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 6, documentId: 'fb-6', nombre: 'Caja INPA Mediana', slug: 'caja-inpa-mediana', descripcion: 'Modelo INPA en nogal cafetero, tamaño mediano. El formato más vendido para una colonia establecida. Incluye trampas de forrajeo y base.', descripcion_corta: 'Caja INPA en nogal cafetero, tamaño mediano.', sku: 'CAJA-INPA-M', precio: 180000, precio_comparativo: null, familia: 'caja-inpa', etiqueta_variacion: 'Mediana', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 30×20×15 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 8, destacado: true, canal_venta: 'ambos', peso_gramos: 3500, dimensiones: '30×20×15 cm', variantes: null, tags: ['inpa', 'nogal'], orden: 2, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, diferenciadores: [{ titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' }, { titulo: 'Modelo INPA', descripcion: 'Diseño probado para Tetragonisca angustula con ventilación optimizada.', icono: 'home' }, { titulo: 'Trampas incluidas', descripcion: 'Trampas de forrajeo y base incluidas. Lista para recibir tu primera colonia.', icono: 'package-check' }], guia_uso: [{ titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' }, { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' }, { titulo: 'Orientación', descripcion: 'La entrada mirando al este para recibir el sol de la mañana.', icono: '🧭' }, { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' }], faq: [{ pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' }, { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida (la más vendida) y Grande para colonias fuertes con miras a cosecha.' }], ecosistema: [{ marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' }], meta_title: null, meta_description: null },
  { id: 7, documentId: 'fb-7', nombre: 'Caja INPA Grande', slug: 'caja-inpa-grande', descripcion: 'Modelo INPA en nogal cafetero, tamaño grande. Para colonias fuertes con miras a cosecha. Incluye trampas de forrajeo y base.', descripcion_corta: 'Caja INPA en nogal cafetero, tamaño grande.', sku: 'CAJA-INPA-G', precio: 210000, precio_comparativo: null, familia: 'caja-inpa', etiqueta_variacion: 'Grande', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 35×24×18 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 4, destacado: false, canal_venta: 'ambos', peso_gramos: 4300, dimensiones: '35×24×18 cm', variantes: null, tags: ['inpa', 'nogal'], orden: 3, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 12, documentId: 'fb-12', nombre: 'Caja AF Pequeña', slug: 'caja-af-pequena', descripcion: 'Modelo Augusto Ferreira tamaño pequeño, con piso móvil y tapa de observación. Ideal para divisiones y colonias jóvenes.', descripcion_corta: 'Modelo AF con piso móvil, tamaño pequeño.', sku: 'CAJA-AF-P', precio: 140000, precio_comparativo: null, familia: 'caja-af', etiqueta_variacion: 'Pequeña', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 24×15×12 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 5, destacado: false, canal_venta: 'ambos', peso_gramos: 2600, dimensiones: '24×15×12 cm', variantes: null, tags: ['af', 'piso-movil'], orden: 4, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 13, documentId: 'fb-13', nombre: 'Caja AF Mediana', slug: 'caja-af-mediana', descripcion: 'Modelo Augusto Ferreira tamaño mediano, con piso móvil y tapa de observación. El formato recomendado para una colonia establecida.', descripcion_corta: 'Modelo AF con piso móvil, tamaño mediano.', sku: 'CAJA-AF-M', precio: 165000, precio_comparativo: null, familia: 'caja-af', etiqueta_variacion: 'Mediana', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 28×18×14 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 6, destacado: false, canal_venta: 'ambos', peso_gramos: 3200, dimensiones: '28×18×14 cm', variantes: null, tags: ['af', 'piso-movil'], orden: 5, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 14, documentId: 'fb-14', nombre: 'Caja AF Grande', slug: 'caja-af-grande', descripcion: 'Modelo Augusto Ferreira tamaño grande, con piso móvil y tapa de observación. Para colonias fuertes y proyectos con inspección frecuente.', descripcion_corta: 'Modelo AF con piso móvil, tamaño grande.', sku: 'CAJA-AF-G', precio: 195000, precio_comparativo: null, familia: 'caja-af', etiqueta_variacion: 'Grande', eje_variacion: 'Tamaño', presentacion: 'Nogal cafetero · 32×22×17 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 3, destacado: false, canal_venta: 'ambos', peso_gramos: 4000, dimensiones: '32×22×17 cm', variantes: null, tags: ['af', 'piso-movil'], orden: 6, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 15, documentId: 'fb-15', nombre: 'Atril de guadua', slug: 'atril-de-guadua', descripcion: 'Atril de guadua inmunizada para montar cualquier caja meliponera (INPA o AF). Altura de 60 cm con base estable y protección contra hormigas.', descripcion_corta: 'Soporte de guadua para cualquier caja, con protección anti-hormigas.', sku: 'ACC-ATRIL', precio: 40000, precio_comparativo: null, presentacion: 'Guadua inmunizada · 60 cm', categoria: 'accesorio', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 10, destacado: false, canal_venta: 'ambos', peso_gramos: 1500, dimensiones: 'Altura 60 cm', variantes: null, tags: ['atril', 'guadua', 'soporte'], orden: 1, envio_gratis: false, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 8, documentId: 'fb-8', nombre: 'Kit Inicio Meliponicultor', slug: 'kit-inicio-meliponicultor', descripcion: 'Caja INPA + atril + guía impresa + 1 visita técnica de acompañamiento.', descripcion_corta: 'Todo para empezar tu meliponario.', sku: 'KIT-INICIO', precio: 280000, precio_comparativo: 320000, presentacion: 'Todo para empezar', categoria: 'kit', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 10, destacado: true, canal_venta: 'ambos', peso_gramos: 6000, dimensiones: null, variantes: null, tags: ['inicio', 'visita-tecnica'], orden: 1, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, diferenciadores: [{ titulo: 'Todo incluido', descripcion: 'Caja INPA, atril de guadua, guía impresa y visita técnica. Cero improvisación.', icono: 'package' }, { titulo: 'Acompañamiento real', descripcion: 'Una visita técnica presencial para instalar y dejar tu meliponario funcionando.', icono: 'user-check' }, { titulo: 'Ahorra $40.000', descripcion: 'Precio de kit frente a comprar cada elemento por separado.', icono: 'badge-percent' }], guia_uso: [{ titulo: 'Coordina tu visita', descripcion: 'Tras tu compra, agenda la visita técnica con nuestro equipo.', icono: '📅' }, { titulo: 'Prepara el espacio', descripcion: 'Elige un lugar a media sombra, con acceso y protegido de lluvia.', icono: '🌳' }, { titulo: 'Instalación guiada', descripcion: 'El técnico monta caja y atril, y te enseña el manejo básico.', icono: '🔧' }, { titulo: 'Sigue la guía', descripcion: 'La guía impresa resuelve tus dudas del día a día.', icono: '📖' }], faq: [{ pregunta: '¿La visita técnica tiene costo adicional?', respuesta: 'No. La primera visita está incluida en el kit. Visitas adicionales se pueden contratar como Asistencia Técnica Mensual.' }, { pregunta: '¿Sirve para cualquier ciudad?', respuesta: 'La visita presencial cubre Ibagué y alrededores. Para otras zonas coordinamos asesoría virtual.' }], ecosistema: [{ marca: 'Iwagé Gestión', titulo: 'Suministros y asistencia', descripcion: 'Continúa tu camino con asistencia mensual y suministros para tu meliponario.', url: '/gestion', emoji: '🛠️' }], meta_title: null, meta_description: null },
  { id: 9, documentId: 'fb-9', nombre: 'Kit Educativo PRAE', slug: 'kit-educativo-prae', descripcion: '2 cajas + material didáctico + 3 talleres presenciales para colegio.', descripcion_corta: 'Para instituciones educativas.', sku: 'KIT-PRAE', precio: 650000, precio_comparativo: null, presentacion: 'Para instituciones educativas', categoria: 'kit', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 4, destacado: false, canal_venta: 'local', peso_gramos: 12000, dimensiones: null, variantes: null, tags: ['prae', 'educativo', 'colegio'], orden: 2, envio_gratis: false, tiempo_entrega: 'Coordinar con equipo', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 10, documentId: 'fb-10', nombre: 'Kit Observación', slug: 'kit-observacion', descripcion: 'Caja con tapa acrílica + lupa + cuaderno de campo. Ideal para niños.', descripcion_corta: 'Tapa transparente, seguro para niños.', sku: 'KIT-OBS', precio: 195000, precio_comparativo: null, presentacion: 'Tapa transparente · Seguro', categoria: 'kit', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 7, destacado: false, canal_venta: 'ambos', peso_gramos: 4000, dimensiones: null, variantes: null, tags: ['observacion', 'ninos'], orden: 3, envio_gratis: false, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 11, documentId: 'fb-11', nombre: 'Asistencia Técnica Mensual', slug: 'asistencia-tecnica-mensual', descripcion: 'Visita mensual de revisión, diagnóstico y recomendaciones. Contrato mínimo 3 meses.', descripcion_corta: 'Visita mensual, contrato trimestral.', sku: 'ASIST-MES', precio: 120000, precio_comparativo: null, presentacion: 'Por visita · Contrato trimestral', categoria: 'asistencia', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: null, destacado: false, canal_venta: 'local', peso_gramos: null, dimensiones: null, variantes: null, tags: ['tecnica', 'mensual'], orden: 1, envio_gratis: false, tiempo_entrega: 'Coordinar visita', orden_minima: 3, meta_title: null, meta_description: null },
];

// ── Helpers ────────────────────────────────────────────
function normalizeProducto(raw: any): Producto {
  return {
    id: raw.id,
    documentId: raw.documentId ?? String(raw.id),
    nombre: raw.nombre,
    slug: raw.slug,
    descripcion: raw.descripcion ?? null,
    descripcion_corta: raw.descripcion_corta ?? null,
    sku: raw.sku ?? null,
    precio: raw.precio,
    precio_comparativo: raw.precio_comparativo ?? null,
    presentacion: raw.presentacion ?? null,
    categoria: raw.categoria,
    marca: raw.marca ?? 'meliponas',
    imagen: raw.imagen ? strapiImage(raw.imagen) : null,
    galeria: Array.isArray(raw.galeria)
      ? raw.galeria.map((g: any) =>
          typeof g === 'string' ? { url: strapiImage(g) ?? g, tipo: 'imagen' as const } : { ...g, url: strapiImage(g.url) ?? g.url }
        )
      : null,
    stock_disponible: raw.stock_disponible ?? true,
    stock_cantidad: raw.stock_cantidad ?? null,
    destacado: raw.destacado ?? false,
    canal_venta: raw.canal_venta ?? 'ambos',
    peso_gramos: raw.peso_gramos ?? null,
    dimensiones: raw.dimensiones ?? null,
    variantes: raw.variantes ?? null,
    tags: raw.tags ?? null,
    orden: raw.orden ?? 0,
    envio_gratis: raw.envio_gratis ?? false,
    tiempo_entrega: raw.tiempo_entrega ?? null,
    orden_minima: raw.orden_minima ?? 1,
    familia: raw.familia ?? null,
    etiqueta_variacion: raw.etiqueta_variacion ?? null,
    eje_variacion: raw.eje_variacion ?? null,
    // Secciones de la ficha de producto (límites defensivos: 3 diferenciadores, 4 tips)
    diferenciadores: Array.isArray(raw.diferenciadores) ? raw.diferenciadores.filter((d: any) => d?.titulo).slice(0, 3) : null,
    guia_uso: Array.isArray(raw.guia_uso) ? raw.guia_uso.filter((g: any) => g?.titulo).slice(0, 4) : null,
    faq: Array.isArray(raw.faq) ? raw.faq.filter((f: any) => f?.pregunta && f?.respuesta) : null,
    ecosistema: Array.isArray(raw.ecosistema) ? raw.ecosistema.filter((e: any) => e?.titulo && e?.url) : null,
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── Public API ─────────────────────────────────────────

/** Get all published products, optionally filtered by category, channel and brand */
export async function getProductos(opts?: {
  categoria?: CategoriaSlug;
  canal?: 'online' | 'local';
  marca?: 'meliponas' | 'granja';
}): Promise<Producto[]> {
  try {
    const filters: Record<string, any> = {};
    if (opts?.categoria) filters.categoria = { $eq: opts.categoria };
    if (opts?.canal) {
      filters.$or = [
        { canal_venta: { $eq: opts.canal } },
        { canal_venta: { $eq: 'ambos' } },
      ];
    }
    if (opts?.marca === 'granja') {
      filters.marca = { $eq: 'granja' };
    } else if (opts?.marca === 'meliponas') {
      // Productos históricos sin marca cuentan como meliponas
      filters.$and = [{ $or: [{ marca: { $eq: 'meliponas' } }, { marca: { $null: true } }] }];
    }

    const res = await strapiFetch<Producto>('productos', {
      ttl: CACHE_TTL.list,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: ['categoria:asc', 'orden:asc', 'nombre:asc'],
      pagination: { pageSize: 100 },
    });

    if (!res.data || res.data.length === 0) {
      throw new Error('Empty response');
    }

    return res.data.map(normalizeProducto);
  } catch {
    // Fallback to local data
    let items = FALLBACK_PRODUCTOS;
    if (opts?.categoria) items = items.filter((p) => p.categoria === opts.categoria);
    if (opts?.canal) items = items.filter((p) => p.canal_venta === opts.canal || p.canal_venta === 'ambos');
    if (opts?.marca) items = items.filter((p) => (p.marca ?? 'meliponas') === opts.marca);
    return items;
  }
}

/** Get a single product by slug */
export async function getProductoBySlug(slug: string): Promise<Producto | null> {
  try {
    const res = await strapiFetch<Producto>('productos', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
    });

    if (!res.data || res.data.length === 0) {
      throw new Error('Not found');
    }

    return normalizeProducto(res.data[0]);
  } catch {
    return FALLBACK_PRODUCTOS.find((p) => p.slug === slug) ?? null;
  }
}

/** Get all slugs for static generation */
export async function getProductoSlugs(): Promise<string[]> {
  try {
    const productos = await getProductos();
    return productos.map((p) => p.slug);
  } catch {
    return FALLBACK_PRODUCTOS.map((p) => p.slug);
  }
}

/** Group products by category for the tienda page */
export async function getProductosPorCategoria(canal?: 'online' | 'local', marca?: 'meliponas' | 'granja'): Promise<Record<string, Producto[]>> {
  const productos = await getProductos({ canal, marca });
  const grouped: Record<string, Producto[]> = {};
  for (const p of productos) {
    if (!grouped[p.categoria]) grouped[p.categoria] = [];
    grouped[p.categoria].push(p);
  }
  return grouped;
}

/**
 * Get all variations (products) that belong to the same family.
 * Products sharing a `familia` key are variations of each other
 * (p.ej. Miel Angelita 120/250/500 ml). Sorted by price ascending so
 * sizes/models display from smallest to largest.
 */
export async function getProductosPorFamilia(familia: string | null): Promise<Producto[]> {
  if (!familia) return [];
  try {
    const res = await strapiFetch<Producto>('productos', {
      ttl: CACHE_TTL.list,
      filters: { familia: { $eq: familia } },
      sort: ['precio:asc'],
      pagination: { pageSize: 50 },
    });
    if (!res.data || res.data.length === 0) {
      throw new Error('Empty response');
    }
    return res.data.map(normalizeProducto);
  } catch {
    return FALLBACK_PRODUCTOS
      .filter((p) => p.familia === familia)
      .sort((a, b) => a.precio - b.precio);
  }
}

// ── Agrupación por familia (listado de tienda) ───────

/** Card agrupada del listado: un producto representante + metadatos de su familia. */
export interface ProductoAgrupado {
  /** Producto representante de la familia (destacado > más barato) o el producto suelto. */
  producto: Producto;
  /** Número de variaciones de la familia (1 si es producto suelto). */
  numVariaciones: number;
  /** Precio más bajo entre las variaciones. */
  precioDesde: number;
  /** Nombre para la card: prefijo común de la familia (p.ej. "Miel Angelita") o el nombre del producto. */
  nombre: string;
  /** Eje de variación de la familia (p.ej. "Presentación", "Tamaño"). */
  eje: string | null;
  /** Etiquetas de las variaciones (p.ej. ["Pequeña", "Mediana", "Grande"]); vacío si es producto suelto. */
  etiquetas: string[];
}

/** Longest common prefix of family member names, trimmed of separators. */
function nombreComun(nombres: string[]): string {
  let prefix = nombres[0] ?? '';
  for (const n of nombres.slice(1)) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const limpio = prefix.replace(/[\s\u00b7\-–]+$/, '').trim();
  // Si el prefijo quedó muy corto (nombres poco uniformes), usa el nombre del primero
  return limpio.length >= 4 ? limpio : nombres[0];
}

/**
 * Collapse a product list into one entry per familia so the listing
 * shows a single card per product family (variations grouped).
 * Products without familia pass through untouched. Order is preserved
 * by first appearance.
 */
export function agruparPorFamilia(productos: Producto[]): ProductoAgrupado[] {
  const grupos = new Map<string, Producto[]>();
  const resultado: ProductoAgrupado[] = [];

  for (const p of productos) {
    if (!p.familia) {
      resultado.push({ producto: p, numVariaciones: 1, precioDesde: p.precio, nombre: p.nombre, eje: null, etiquetas: [] });
      continue;
    }
    const grupo = grupos.get(p.familia);
    if (grupo) {
      grupo.push(p);
    } else {
      const nuevo = [p];
      grupos.set(p.familia, nuevo);
      // Placeholder que se completa al final, preservando la posición del primer miembro
      resultado.push({ producto: p, numVariaciones: 1, precioDesde: p.precio, nombre: p.nombre, eje: p.eje_variacion, etiquetas: [] });
    }
  }

  // Completa las entradas de familia con representante, conteo y precio mínimo
  for (const entry of resultado) {
    const familia = entry.producto.familia;
    if (!familia) continue;
    const miembros = grupos.get(familia)!;
    if (miembros.length === 1) continue;
    const representante =
      miembros.find((m) => m.destacado) ??
      miembros.reduce((min, m) => (m.precio < min.precio ? m : min), miembros[0]);
    entry.producto = representante;
    entry.numVariaciones = miembros.length;
    entry.precioDesde = Math.min(...miembros.map((m) => m.precio));
    entry.nombre = nombreComun(miembros.map((m) => m.nombre));
    entry.eje = representante.eje_variacion ?? miembros.find((m) => m.eje_variacion)?.eje_variacion ?? null;
    entry.etiquetas = miembros
      .slice()
      .sort((a, b) => a.precio - b.precio)
      .map((m) => m.etiqueta_variacion)
      .filter((e): e is string => Boolean(e));
  }

  return resultado;
}
