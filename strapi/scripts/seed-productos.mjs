// Seed script for enhanced Productos (tienda online + local)
// Run: node scripts/seed-productos.mjs
// Requires: STRAPI_URL and STRAPI_API_TOKEN env vars

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_TOKEN}`,
};

async function create(data) {
  // Upsert por nombre: si el producto ya existe se actualiza en lugar de duplicar
  const findRes = await fetch(
    `${STRAPI_URL}/api/productos?filters[nombre][$eq]=${encodeURIComponent(data.nombre)}`,
    { headers }
  );
  const existing = findRes.ok ? (await findRes.json()).data : [];

  const isUpdate = existing?.length > 0;
  const url = isUpdate
    ? `${STRAPI_URL}/api/productos/${existing[0].documentId}`
    : `${STRAPI_URL}/api/productos`;

  const res = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`✗ Error ${isUpdate ? 'updating' : 'creating'} "${data.nombre}":`, err?.error?.message || res.statusText);
    return null;
  }
  console.log(`✓ ${isUpdate ? 'Updated' : 'Created'}: ${data.nombre} (${data.sku})`);
  return (await res.json()).data;
}

const productos = [
  // ── Miel ──────────────────────────────────────────────
  {
    nombre: 'Miel Angelita 250ml',
    slug: 'miel-angelita-250ml',
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
    familia: 'miel-angelita',
    etiqueta_variacion: '250 ml',
    eje_variacion: 'Presentación',
    diferenciadores: [
      { titulo: '30% más antioxidantes', descripcion: 'Los meliponinos producen una miel con más minerales y hasta un 30% más de poder antioxidante que la miel convencional.', icono: 'sparkles' },
      { titulo: 'Trazabilidad radical', descripcion: 'La etiqueta indica colmena, fecha de cosecha y flora de temporada. Sabes exactamente de dónde viene cada frasco.', icono: 'qr-code' },
      { titulo: 'Cruda y viva', descripcion: 'Sin calentar ni filtrar en exceso. Conserva enzimas, polen y propiedades intactas. Requiere refrigeración.', icono: 'leaf' },
    ],
    guia_uso: [
      { titulo: 'En infusión', descripcion: 'Reemplaza el azúcar en café o té. Disuelve a menos de 40 °C para preservar sus enzimas.', icono: '🍵' },
      { titulo: 'Con quesos', descripcion: 'Marida con quesos madurados y frescos. El contraste dulce-salado es excepcional.', icono: '🧀' },
      { titulo: 'Cucharadita directa', descripcion: 'Para calmar la tos o como energético natural. Una cucharadita en ayunas.', icono: '🥄' },
      { titulo: 'Mascarilla facial', descripcion: 'Mezcla con avena y aplica 15 minutos. Regeneradora y antibacteriana natural.', icono: '🧴' },
    ],
    faq: [
      { pregunta: '¿Cómo conservar la miel de Angelita?', respuesta: 'Refrigeración constante (4-8 °C). A diferencia de la miel de Apis mellifera, la miel de Angelita tiene mayor humedad y puede fermentar a temperatura ambiente. En nevera se conserva sin cambios.' },
      { pregunta: '¿Por qué cuesta más que la miel común?', respuesta: 'Una colonia de Tetragonisca angustula produce entre 0.5 y 1 litro al año — diez veces menos que una de Apis mellifera. Su perfil nutricional también es distinto: más minerales, más antioxidantes y menor índice glucémico.' },
      { pregunta: '¿Es normal que la miel cristalice?', respuesta: 'Sí, es garantía de pureza. La miel cruda (sin calentar) cristaliza con el tiempo. Para fluidificarla, sumerge el frasco en agua tibia (máx. 40 °C) — nunca en microondas.' },
    ],
    ecosistema: [
      { marca: 'Café Iwagé', titulo: 'Pruébala en café', descripcion: 'Prueba la Miel de Angelita con café ($9.000) o el Pan de yuca y miel ($4.500). Nuestra miel en preparaciones de temporada.', url: '/cafe/menu', emoji: '☕' },
      { marca: 'Iwagé Naturaleza', titulo: 'Producida por anfitriones', descripcion: 'Detrás de cada frasco hay guardianes del territorio que cuentan la historia del corredor Ambalá. Conócelos.', url: '/naturaleza/anfitriones', emoji: '🌿' },
      { marca: 'Nuestro origen', titulo: 'Conoce el meliponario', descripcion: 'El Café Iwagé nació del meliponario. Una historia de abejas, café de 1,400 m y el sabor del territorio.', url: '/cafe/nosotros', emoji: '🍯' },
    ],
  },
  {
    nombre: 'Miel Angelita 500ml',
    slug: 'miel-angelita-500ml',
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
    familia: 'miel-angelita',
    etiqueta_variacion: '500 ml',
    eje_variacion: 'Presentación',
  },
  {
    nombre: 'Miel Angelita 120ml',
    slug: 'miel-angelita-120ml',
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
    familia: 'miel-angelita',
    etiqueta_variacion: '120 ml',
    eje_variacion: 'Presentación',
  },
  {
    nombre: 'Miel con propóleo 250ml',
    slug: 'miel-con-propoleo-250ml',
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
    diferenciadores: [
      { titulo: 'Doble protección', descripcion: 'Blend de miel y propóleo: antimicrobiano natural potenciado para garganta y sistema inmune.', icono: 'shield' },
      { titulo: 'Edición limitada', descripcion: 'Cosecha selecta de pocas colmenas. El propóleo se recolecta a mano en cada revisión.', icono: 'gem' },
      { titulo: 'Sabor intenso', descripcion: 'Notas resinosas y final herbal que lo distinguen de la miel clásica.', icono: 'flame' },
    ],
    guia_uso: [
      { titulo: 'En ayunas', descripcion: 'Una cucharadita en ayunas para reforzar el sistema inmune.', icono: '🌅' },
      { titulo: 'En infusión caliente', descripcion: 'Disuelve en té o agua tibia para aliviar la garganta.', icono: '🍵' },
      { titulo: 'Directa', descripcion: 'Media cucharadita directa para alivio rápido de garganta.', icono: '🥄' },
    ],
    faq: [
      { pregunta: '¿Qué es el propóleo?', respuesta: 'Es una resina que las abejas recolectan de brotes vegetales y transforman con sus enzimas. Es un potente antimicrobiano y antiinflamatorio natural.' },
      { pregunta: '¿Requiere refrigeración?', respuesta: 'Sí, al igual que la miel de Angelita. El blend se conserva mejor refrigerado (4-8 °C).' },
    ],
    ecosistema: [
      { marca: 'Iwagé Naturaleza', titulo: 'Producida por anfitriones', descripcion: 'El propóleo lo recolectan guardianes del territorio en el corredor Ambalá.', url: '/naturaleza/anfitriones', emoji: '🌿' },
    ],
  },

  // ── Cajas INPA (familia caja-inpa · eje Tamaño) ───────
  {
    nombre: 'Caja INPA Pequeña',
    slug: 'caja-inpa-pequena',
    descripcion: 'Modelo INPA en madera de nogal cafetero, tamaño pequeño. Ideal para colonias jóvenes o espacios reducidos. Incluye trampas de forrajeo y base. Diseñada para Tetragonisca angustula con ventilación optimizada.',
    descripcion_corta: 'Caja INPA en nogal cafetero, tamaño pequeño.',
    galeria: [
      { url: '/images/galeria/producto-caja-1.webp', tipo: 'imagen', titulo: 'Caja INPA en nogal cafetero' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Colmena INPA instalada y activa' },
    ],
    sku: 'CAJA-INPA-P',
    precio: 150000,
    presentacion: 'Nogal cafetero · 25×16×12 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 6,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 2800,
    dimensiones: '25×16×12 cm',
    tags: ['inpa', 'nogal', 'trampas-forrajeo'],
    orden: 1,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-inpa',
    etiqueta_variacion: 'Pequeña',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
      { titulo: 'Modelo INPA', descripcion: 'Diseño probado para Tetragonisca angustula con ventilación optimizada.', icono: 'home' },
      { titulo: 'Trampas incluidas', descripcion: 'Trampas de forrajeo y base incluidas. Lista para recibir tu primera colonia.', icono: 'package-check' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Orientación', descripcion: 'La entrada mirando al este para recibir el sol de la mañana.', icono: '🧭' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Necesito experiencia previa?', respuesta: 'No. Las meliponas no pican y el modelo INPA es ideal para principiantes. Recomendamos el Kit Inicio si es tu primera vez.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida (la más vendida) y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },
  {
    nombre: 'Caja INPA Mediana',
    slug: 'caja-inpa-mediana',
    descripcion: 'Modelo INPA en madera de nogal cafetero, tamaño mediano. El formato más vendido: ideal para una colonia establecida de Tetragonisca angustula. Incluye trampas de forrajeo y base, con ventilación optimizada.',
    descripcion_corta: 'Caja INPA en nogal cafetero, tamaño mediano.',
    galeria: [
      { url: '/images/galeria/producto-caja-1.webp', tipo: 'imagen', titulo: 'Caja INPA en nogal cafetero' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Colmena INPA instalada y activa' },
    ],
    sku: 'CAJA-INPA-M',
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
    orden: 2,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-inpa',
    etiqueta_variacion: 'Mediana',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
      { titulo: 'Modelo INPA', descripcion: 'Diseño probado para Tetragonisca angustula con ventilación optimizada.', icono: 'home' },
      { titulo: 'Trampas incluidas', descripcion: 'Trampas de forrajeo y base incluidas. Lista para recibir tu primera colonia.', icono: 'package-check' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Orientación', descripcion: 'La entrada mirando al este para recibir el sol de la mañana.', icono: '🧭' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Necesito experiencia previa?', respuesta: 'No. Las meliponas no pican y el modelo INPA es ideal para principiantes. Recomendamos el Kit Inicio si es tu primera vez.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida (la más vendida) y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },
  {
    nombre: 'Caja INPA Grande',
    slug: 'caja-inpa-grande',
    descripcion: 'Modelo INPA en madera de nogal cafetero, tamaño grande. Para colonias fuertes con miras a cosecha de miel. Incluye trampas de forrajeo y base, con ventilación optimizada para Tetragonisca angustula.',
    descripcion_corta: 'Caja INPA en nogal cafetero, tamaño grande.',
    galeria: [
      { url: '/images/galeria/producto-caja-1.webp', tipo: 'imagen', titulo: 'Caja INPA en nogal cafetero' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen', titulo: 'Colmena INPA instalada y activa' },
    ],
    sku: 'CAJA-INPA-G',
    precio: 210000,
    presentacion: 'Nogal cafetero · 35×24×18 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 4,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 4300,
    dimensiones: '35×24×18 cm',
    tags: ['inpa', 'nogal', 'trampas-forrajeo'],
    orden: 3,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-inpa',
    etiqueta_variacion: 'Grande',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
      { titulo: 'Modelo INPA', descripcion: 'Diseño probado para Tetragonisca angustula con ventilación optimizada.', icono: 'home' },
      { titulo: 'Trampas incluidas', descripcion: 'Trampas de forrajeo y base incluidas. Lista para recibir tu primera colonia.', icono: 'package-check' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Orientación', descripcion: 'La entrada mirando al este para recibir el sol de la mañana.', icono: '🧭' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida (la más vendida) y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },

  // ── Cajas AF (familia caja-af · eje Tamaño) ───────────
  {
    nombre: 'Caja AF Pequeña',
    slug: 'caja-af-pequena',
    descripcion: 'Modelo Augusto Ferreira tamaño pequeño, con piso móvil y tapa de observación. Facilita la inspección sin perturbar la colonia. Ideal para divisiones y colonias jóvenes.',
    descripcion_corta: 'Modelo AF con piso móvil, tamaño pequeño.',
    sku: 'CAJA-AF-P',
    precio: 140000,
    presentacion: 'Nogal cafetero · 24×15×12 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 5,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 2600,
    dimensiones: '24×15×12 cm',
    tags: ['af', 'augusto-ferreira', 'piso-movil'],
    orden: 4,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-af',
    etiqueta_variacion: 'Pequeña',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Piso móvil', descripcion: 'El diseño AF permite revisar la colonia desde abajo sin destapar la cámara de cría.', icono: 'layers' },
      { titulo: 'Tapa de observación', descripcion: 'Observa el interior de la colmena sin perturbar a las abejas.', icono: 'eye' },
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Inspección', descripcion: 'Usa el piso móvil para revisiones rápidas sin abrir la cámara de cría.', icono: '🔍' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Qué diferencia hay entre AF e INPA?', respuesta: 'El modelo AF tiene piso móvil y tapa de observación, pensado para inspección frecuente. El INPA es modular por alzas, ideal para cosecha. Ambos funcionan muy bien con Angelita.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },
  {
    nombre: 'Caja AF Mediana',
    slug: 'caja-af-mediana',
    descripcion: 'Modelo Augusto Ferreira tamaño mediano, con piso móvil y tapa de observación. El formato recomendado para una colonia establecida. Facilita la inspección sin perturbar la colonia.',
    descripcion_corta: 'Modelo AF con piso móvil, tamaño mediano.',
    sku: 'CAJA-AF-M',
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
    orden: 5,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-af',
    etiqueta_variacion: 'Mediana',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Piso móvil', descripcion: 'El diseño AF permite revisar la colonia desde abajo sin destapar la cámara de cría.', icono: 'layers' },
      { titulo: 'Tapa de observación', descripcion: 'Observa el interior de la colmena sin perturbar a las abejas.', icono: 'eye' },
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Inspección', descripcion: 'Usa el piso móvil para revisiones rápidas sin abrir la cámara de cría.', icono: '🔍' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Qué diferencia hay entre AF e INPA?', respuesta: 'El modelo AF tiene piso móvil y tapa de observación, pensado para inspección frecuente. El INPA es modular por alzas, ideal para cosecha. Ambos funcionan muy bien con Angelita.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },
  {
    nombre: 'Caja AF Grande',
    slug: 'caja-af-grande',
    descripcion: 'Modelo Augusto Ferreira tamaño grande, con piso móvil y tapa de observación. Para colonias fuertes y proyectos con inspección frecuente. Facilita la revisión sin perturbar la colonia.',
    descripcion_corta: 'Modelo AF con piso móvil, tamaño grande.',
    sku: 'CAJA-AF-G',
    precio: 195000,
    presentacion: 'Nogal cafetero · 32×22×17 cm',
    categoria: 'caja',
    stock_disponible: true,
    stock_cantidad: 3,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 4000,
    dimensiones: '32×22×17 cm',
    tags: ['af', 'augusto-ferreira', 'piso-movil'],
    orden: 6,
    envio_gratis: true,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    familia: 'caja-af',
    etiqueta_variacion: 'Grande',
    eje_variacion: 'Tamaño',
    diferenciadores: [
      { titulo: 'Piso móvil', descripcion: 'El diseño AF permite revisar la colonia desde abajo sin destapar la cámara de cría.', icono: 'layers' },
      { titulo: 'Tapa de observación', descripcion: 'Observa el interior de la colmena sin perturbar a las abejas.', icono: 'eye' },
      { titulo: 'Nogal cafetero', descripcion: 'Madera noble de la región, durable y con aroma que atrae a las meliponas.', icono: 'tree-deciduous' },
    ],
    guia_uso: [
      { titulo: 'Ubicación', descripcion: 'Instálala a media sombra, protegida de lluvia directa y viento.', icono: '📍' },
      { titulo: 'Altura', descripcion: 'Colócala entre 1 y 1.5 m del suelo, sobre base firme.', icono: '📏' },
      { titulo: 'Inspección', descripcion: 'Usa el piso móvil para revisiones rápidas sin abrir la cámara de cría.', icono: '🔍' },
      { titulo: 'Paciencia', descripcion: 'Las meliponas llegarán solas. No las captures; ellas eligen su hogar.', icono: '🐝' },
    ],
    faq: [
      { pregunta: '¿La caja viene con abejas?', respuesta: 'No. La caja es el hogar; la colonia llega por enjambrazón natural o mediante un trasiego que puedes coordinar con nuestro equipo.' },
      { pregunta: '¿Qué tamaño elijo?', respuesta: 'Pequeña para colonias jóvenes o divisiones, Mediana para una colonia establecida y Grande para colonias fuertes con miras a cosecha.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Asistencia técnica', descripcion: 'Acompañamiento profesional para instalar y mantener tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },

  // ── Accesorios ────────────────────────────────────────
  {
    nombre: 'Atril de guadua',
    slug: 'atril-de-guadua',
    descripcion: 'Atril de guadua inmunizada para montar cualquier caja meliponera (INPA o AF). Altura de 60 cm con base estable y protección contra hormigas. Listo para instalar en jardín o finca.',
    descripcion_corta: 'Soporte de guadua para cualquier caja, con protección anti-hormigas.',
    sku: 'ACC-ATRIL',
    precio: 40000,
    presentacion: 'Guadua inmunizada · 60 cm',
    categoria: 'accesorio',
    stock_disponible: true,
    stock_cantidad: 10,
    destacado: false,
    canal_venta: 'ambos',
    peso_gramos: 1500,
    dimensiones: 'Altura 60 cm',
    tags: ['atril', 'guadua', 'soporte'],
    orden: 1,
    envio_gratis: false,
    tiempo_entrega: '5-7 días hábiles',
    orden_minima: 1,
    diferenciadores: [
      { titulo: 'Guadua inmunizada', descripcion: 'Material local, resistente a la intemperie y de bajo impacto ambiental.', icono: 'tree-deciduous' },
      { titulo: 'Anti-hormigas', descripcion: 'Incluye barrera contra hormigas para proteger la colonia.', icono: 'shield' },
      { titulo: 'Universal', descripcion: 'Compatible con cajas INPA y AF de cualquier tamaño.', icono: 'ruler' },
    ],
    faq: [
      { pregunta: '¿Sirve para cualquier caja?', respuesta: 'Sí. La plataforma soporta cajas INPA y AF de los tres tamaños. Si tienes una caja de otro modelo, escríbenos y lo confirmamos.' },
    ],
  },

  // ── Kits ──────────────────────────────────────────────
  {
    nombre: 'Kit Inicio Meliponicultor',
    slug: 'kit-inicio-meliponicultor',
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
    diferenciadores: [
      { titulo: 'Todo incluido', descripcion: 'Caja INPA, atril de guadua, guía impresa y visita técnica. Cero improvisación.', icono: 'package' },
      { titulo: 'Acompañamiento real', descripcion: 'Una visita técnica presencial para instalar y dejar tu meliponario funcionando.', icono: 'user-check' },
      { titulo: 'Ahorra $40.000', descripcion: 'Precio de kit frente a comprar cada elemento por separado.', icono: 'badge-percent' },
    ],
    guia_uso: [
      { titulo: 'Coordina tu visita', descripcion: 'Tras tu compra, agenda la visita técnica con nuestro equipo.', icono: '📅' },
      { titulo: 'Prepara el espacio', descripcion: 'Elige un lugar a media sombra, con acceso y protegido de lluvia.', icono: '🌳' },
      { titulo: 'Instalación guiada', descripcion: 'El técnico monta caja y atril, y te enseña el manejo básico.', icono: '🔧' },
      { titulo: 'Sigue la guía', descripcion: 'La guía impresa resuelve tus dudas del día a día.', icono: '📖' },
    ],
    faq: [
      { pregunta: '¿La visita técnica tiene costo adicional?', respuesta: 'No. La primera visita está incluida en el kit. Visitas adicionales se pueden contratar como Asistencia Técnica Mensual.' },
      { pregunta: '¿Sirve para cualquier ciudad?', respuesta: 'La visita presencial cubre Ibagué y alrededores. Para otras zonas coordinamos asesoría virtual.' },
    ],
    ecosistema: [
      { marca: 'Iwagé Gestión', titulo: 'Suministros y asistencia', descripcion: 'Continúa tu camino con asistencia mensual y suministros para tu meliponario.', url: '/gestion', emoji: '🛠️' },
    ],
  },
  {
    nombre: 'Kit Educativo PRAE',
    slug: 'kit-educativo-prae',
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
    slug: 'kit-observacion',
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
    slug: 'asistencia-tecnica-mensual',
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
