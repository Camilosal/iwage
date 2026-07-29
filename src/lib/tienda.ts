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
  categoria: 'miel' | 'caja' | 'kit' | 'asistencia' | 'accesorio' | 'propoleo' | 'ceras';
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
  meta_title: string | null;
  meta_description: string | null;
}

export type CategoriaSlug = 'miel' | 'caja' | 'kit' | 'asistencia' | 'accesorio' | 'propoleo' | 'ceras';

export const CATEGORIAS: { id: CategoriaSlug; label: string }[] = [
  { id: 'miel', label: 'Miel' },
  { id: 'caja', label: 'Cajas' },
  { id: 'kit', label: 'Kits' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'accesorio', label: 'Accesorios' },
  { id: 'propoleo', label: 'Propóleo' },
  { id: 'ceras', label: 'Ceras' },
];

// ── Fallback seed data (used when Strapi is down) ──────
const FALLBACK_PRODUCTOS: Producto[] = [
  { id: 1, documentId: 'fb-1', nombre: 'Miel Angelita 250ml', slug: 'miel-angelita-250ml', descripcion: 'Miel pura de Tetragonisca angustula. Cosecha mayo 2025, flora de guamo y café.', descripcion_corta: 'Miel pura de Angelita, cosecha 2025.', sku: 'MIEL-250', precio: 45000, precio_comparativo: null, presentacion: '250 ml · Lote L25-05-001', categoria: 'miel', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 30, destacado: true, canal_venta: 'ambos', peso_gramos: 350, dimensiones: null, variantes: null, tags: ['angelita', 'cosecha-2025'], orden: 1, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 2, documentId: 'fb-2', nombre: 'Miel Angelita 500ml', slug: 'miel-angelita-500ml', descripcion: 'Presentación familiar. Misma cosecha, perfil cítrico con final floral.', descripcion_corta: 'Presentación familiar 500ml.', sku: 'MIEL-500', precio: 78000, precio_comparativo: null, presentacion: '500 ml · Lote L25-05-001', categoria: 'miel', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 20, destacado: false, canal_venta: 'ambos', peso_gramos: 650, dimensiones: null, variantes: null, tags: ['angelita', 'familiar'], orden: 2, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 3, documentId: 'fb-3', nombre: 'Miel Angelita 120ml', slug: 'miel-angelita-120ml', descripcion: 'Presentación degustación. Ideal para regalo o primera experiencia.', descripcion_corta: 'Degustación, ideal para regalo.', sku: 'MIEL-120', precio: 25000, precio_comparativo: null, presentacion: '120 ml · Lote L25-05-001', categoria: 'miel', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 50, destacado: false, canal_venta: 'ambos', peso_gramos: 200, dimensiones: null, variantes: null, tags: ['degustacion', 'regalo'], orden: 3, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 4, documentId: 'fb-4', nombre: 'Miel con propóleo 250ml', slug: 'miel-con-propoleo-250ml', descripcion: 'Blend de miel y propóleo de Angelita. Sabor intenso, notas resinosas.', descripcion_corta: 'Blend miel + propóleo, edición limitada.', sku: 'MIEL-PROP-250', precio: 52000, precio_comparativo: null, presentacion: '250 ml · Edición limitada', categoria: 'miel', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 12, destacado: false, canal_venta: 'ambos', peso_gramos: 350, dimensiones: null, variantes: null, tags: ['propoleo', 'edicion-limitada'], orden: 4, envio_gratis: false, tiempo_entrega: '2-4 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 5, documentId: 'fb-5', nombre: 'Caja INPA Nogal Cafetero', slug: 'caja-inpa-nogal-cafetero', descripcion: 'Modelo INPA en madera de nogal cafetero. Incluye trampas de forrajeo y base.', descripcion_corta: 'Caja INPA en nogal cafetero con trampas.', sku: 'CAJA-INPA', precio: 180000, precio_comparativo: null, presentacion: 'Nogal cafetero · 30×20×15 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 8, destacado: true, canal_venta: 'ambos', peso_gramos: 3500, dimensiones: '30×20×15 cm', variantes: null, tags: ['inpa', 'nogal'], orden: 1, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 6, documentId: 'fb-6', nombre: 'Caja AF Estándar', slug: 'caja-af-estandar', descripcion: 'Modelo Augusto Ferreira con piso móvil y tapa de observación.', descripcion_corta: 'Modelo AF con piso móvil.', sku: 'CAJA-AF', precio: 165000, precio_comparativo: null, presentacion: 'Nogal cafetero · 28×18×14 cm', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 6, destacado: false, canal_venta: 'ambos', peso_gramos: 3200, dimensiones: '28×18×14 cm', variantes: null, tags: ['af', 'augusto-ferreira'], orden: 2, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 7, documentId: 'fb-7', nombre: 'Caja INPA con atril', slug: 'caja-inpa-con-atril', descripcion: 'Caja INPA montada sobre atril de guadua. Lista para instalar.', descripcion_corta: 'INPA + atril de guadua, lista para instalar.', sku: 'CAJA-INPA-AT', precio: 220000, precio_comparativo: null, presentacion: 'Incluye atril · Instalación fácil', categoria: 'caja', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 5, destacado: false, canal_venta: 'ambos', peso_gramos: 5000, dimensiones: '30×20×15 cm + atril 60cm', variantes: null, tags: ['inpa', 'atril', 'guadua'], orden: 3, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
  { id: 8, documentId: 'fb-8', nombre: 'Kit Inicio Meliponicultor', slug: 'kit-inicio-meliponicultor', descripcion: 'Caja INPA + atril + guía impresa + 1 visita técnica de acompañamiento.', descripcion_corta: 'Todo para empezar tu meliponario.', sku: 'KIT-INICIO', precio: 280000, precio_comparativo: 320000, presentacion: 'Todo para empezar', categoria: 'kit', imagen: null, galeria: null, stock_disponible: true, stock_cantidad: 10, destacado: true, canal_venta: 'ambos', peso_gramos: 6000, dimensiones: null, variantes: null, tags: ['inicio', 'visita-tecnica'], orden: 1, envio_gratis: true, tiempo_entrega: '5-7 días hábiles', orden_minima: 1, meta_title: null, meta_description: null },
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
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── Public API ─────────────────────────────────────────

/** Get all published products, optionally filtered by category and channel */
export async function getProductos(opts?: {
  categoria?: CategoriaSlug;
  canal?: 'online' | 'local';
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
export async function getProductosPorCategoria(canal?: 'online' | 'local'): Promise<Record<string, Producto[]>> {
  const productos = await getProductos({ canal });
  const grouped: Record<string, Producto[]> = {};
  for (const p of productos) {
    if (!grouped[p.categoria]) grouped[p.categoria] = [];
    grouped[p.categoria].push(p);
  }
  return grouped;
}
