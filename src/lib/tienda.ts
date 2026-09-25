/**
 * Tienda Meliponario — product data layer.
 * Fetches from Strapi `productos` collection with Redis caching.
 * Strapi es el único dueño del catálogo: si no responde o no tiene filas, las
 * consultas devuelven [] y la tarjeta pinta el mosaico Icon. Nunca un seed.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import { mediaSrc, toMediaList, type MediaItem } from './media.ts';

// ── Types ──────────────────────────────────────────────
// El único tipo de galería del sitio es `MediaItem` (./media.ts). Se re-exporta desde
// aquí para no romper importaciones que pedían el tipo a esta capa de datos.
export type { MediaItem };

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
  galeria: MediaItem[] | null;
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
    imagen: raw.imagen ? mediaSrc(raw.imagen) : null,
    galeria: Array.isArray(raw.galeria) ? toMediaList(raw.galeria) : null,
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

    return (res.data ?? []).map(normalizeProducto);
  } catch {
    // Con Strapi caído no hay catálogo que mostrar: [] y la card pinta el mosaico
    // Icon. Un seed aquí inventaría existencias y precios que nadie verificó.
    return [];
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

    const first = res.data?.[0];
    return first ? normalizeProducto(first) : null;
  } catch {
    return null;
  }
}

/** Get all slugs for static generation */
export async function getProductoSlugs(): Promise<string[]> {
  // getProductos() ya es la frontera tolerante: devuelve [] con Strapi caído.
  const productos = await getProductos();
  return productos.map((p) => p.slug);
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
    return (res.data ?? []).map(normalizeProducto);
  } catch {
    return [];
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
