/**
 * Café Iwagé — Strapi data access layer
 */
import { strapiFetch, strapiSingle, strapiImage, CACHE_TTL } from './strapi';

// ── Types ──────────────────────────────────────────────

export interface CafeConfig {
  titulo: string | null;
  descripcion: string | null;
  horario: string | null;
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  b2b_titulo: string | null;
  b2b_descripcion: string | null;
  b2b_whatsapp: string | null;
  historia: string | null;
  imagen_hero: { url: string } | null;
  mapa_url: string | null;
}

export interface ItemMenu {
  id: number;
  documentId: string;
  nombre: string;
  slug: string | null;
  descripcion: string | null;
  historia: string | null;
  tags: string[] | null;
  precio: string | null;
  destacado: boolean;
  categoria: 'cafe' | 'infusion' | 'acompanamiento' | 'signature' | 'frio' | 'panaderia';
  imagen: { url: string } | null;
  orden: number;
  disponible: boolean;
  temporada: boolean;
  nota_disponibilidad: string | null;
  // ── Variaciones (productos de la misma familia: tamaño, sabor, ...) ──
  /** Clave que agrupa las variaciones de un mismo producto (p.ej. 'cafe-ambala'). */
  familia?: string | null;
  /** Etiqueta legible de esta variación dentro de la familia (p.ej. 'Mediano 12 oz'). */
  etiqueta_variacion?: string | null;
  /** Nombre del eje de variación (p.ej. 'Tamaño', 'Sabor'). */
  eje_variacion?: string | null;
}

export interface ProveedorAnfitrion {
  id: number;
  documentId: string;
  nombre: string;
  slug: string | null;
  especialidad: string | null;
}

export interface ProveedorExperiencia {
  id: number;
  documentId: string;
  titulo: string;
  slug: string | null;
  categoria: string | null;
  resumen: string | null;
}

export interface ProveedorPropiedad {
  id: number;
  documentId: string;
  titulo: string;
  slug: string | null;
  tipo_propiedad: string | null;
  operacion: string | null;
  estado: string | null;
  ubicacion_municipio: string | null;
  area_hectareas: number | null;
  precio: number | null;
}

export interface ProveedorPropiedadGestion {
  id: number;
  documentId: string;
  titulo: string;
  slug: string | null;
  tipo_gestion: string | null;
  estado: string | null;
  ubicacion_municipio: string | null;
  area_hectareas: number | null;
}

export interface Proveedor {
  id: number;
  documentId: string;
  nombre: string;
  slug: string | null;
  producto: string | null;
  ubicacion: string | null;
  distancia_km: number | null;
  historia: string | null;
  foto: { url: string } | null;
  orden: number;
  // ── Ficha extendida (campos opcionales: Strapi puede omitirlos) ──
  publicado?: boolean | null;
  destacado?: boolean | null;
  es_anfitrion?: boolean | null;
  ofrece_experiencias?: boolean | null;
  telefono?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  horario?: string | null;
  direccion?: string | null;
  servicios?: string[] | null;
  anfitriones?: ProveedorAnfitrion[];
  experiencias?: ProveedorExperiencia[];
  propiedades?: ProveedorPropiedad[];
  propiedades_gestion?: ProveedorPropiedadGestion[];
}

export interface HistoriaVisitante {
  id: number;
  documentId: string;
  titulo: string;
  slug: string | null;
  categoria: 'fauna' | 'flora' | 'personas';
  texto_corto: string;
  texto_largo: string;
  imagen: { url: string } | null;
  icono: string | null;
  orden: number;
  destacado: boolean;
}

// ── Queries ────────────────────────────────────────────

export async function getCafeConfig(): Promise<CafeConfig | null> {
  try {
    return await strapiSingle<CafeConfig>('cafe-config', {
      ttl: CACHE_TTL.config,
      populate: ['imagen_hero'],
    });
  } catch {
    return null;
  }
}

export async function getMenuItems(categoria?: string): Promise<ItemMenu[]> {
  try {
    const filters: Record<string, any> = {};
    if (categoria) filters.categoria = { $eq: categoria };

    const res = await strapiFetch<ItemMenu>('item-menus', {
      ttl: CACHE_TTL.list,
      populate: ['imagen'],
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: ['orden:asc', 'nombre:asc'],
      pagination: { pageSize: 100 },
    });
    return (res.data ?? []).map((item) => ({
      ...item,
      disponible: item.disponible !== false,
      temporada: item.temporada === true,
      tags: item.tags ?? [],
      familia: item.familia || null,
      etiqueta_variacion: item.etiqueta_variacion || null,
      eje_variacion: item.eje_variacion || null,
    }));
  } catch {
    return [];
  }
}

export async function getProveedores(): Promise<Proveedor[]> {
  try {
    const res = await strapiFetch<Proveedor>('proveedors', {
      ttl: CACHE_TTL.list,
      populate: ['foto', 'anfitriones', 'experiencias', 'propiedades', 'propiedades_gestion'],
      filters: { publicado: { $eq: true } },
      sort: ['orden:asc', 'distancia_km:asc'],
      pagination: { pageSize: 50 },
    });
    return (res.data ?? []).map((p) => ({
      ...p,
      anfitriones: p.anfitriones ?? [],
      experiencias: p.experiencias ?? [],
      propiedades: p.propiedades ?? [],
      propiedades_gestion: p.propiedades_gestion ?? [],
    }));
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────

export async function getHistoriasVisitantes(categoria?: string): Promise<HistoriaVisitante[]> {
  try {
    const filters: Record<string, any> = {};
    if (categoria) filters.categoria = { $eq: categoria };

    const res = await strapiFetch<HistoriaVisitante>('historia-visitantes', {
      ttl: CACHE_TTL.list,
      populate: ['imagen'],
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: ['orden:asc', 'titulo:asc'],
      pagination: { pageSize: 50 },
    });
    return (res.data ?? []).map((h) => ({
      ...h,
      destacado: h.destacado === true,
    }));
  } catch {
    return [];
  }
}

export function historiaImagen(h: HistoriaVisitante): string | null {
  return strapiImage(h.imagen?.url);
}

// ── Helpers ────────────────────────────────────────────

export const CATEGORIAS_MENU = [
  { slug: 'cafe', label: 'Café', icon: 'coffee' },
  { slug: 'signature', label: 'Signature', icon: 'sparkles' },
  { slug: 'panaderia', label: 'Panadería', icon: 'croissant' },
  { slug: 'infusion', label: 'Infusiones', icon: 'leaf' },
  { slug: 'frio', label: 'Fríos', icon: 'snowflake' },
  { slug: 'acompanamiento', label: 'Acompañamientos', icon: 'candy' },
] as const;

// Mapping of item families/names to local image paths (fallback when Strapi has no image)
const LOCAL_IMAGES: Record<string, string> = {
  'cafe-ambala': '/images/cafe-menu/cafe-origen-ambala.webp',
  'espresso': '/images/cafe-menu/espresso-doble.webp',
  'miel-cafe': '/images/cafe-menu/miel-angelita-cafe.webp',
  'latte-miel': '/images/cafe-menu/latte-miel-canela.webp',
  'aromatica-flora': '/images/cafe-menu/aromatica-flora-nativa.webp',
  'cold-brew': '/images/cafe-menu/cold-brew-ambala.webp',
  'chocolate-local': '/images/cafe-menu/chocolate-cacao-local.webp',
  'pan-yuca': '/images/cafe-menu/pan-yuca-miel.webp',
  'queso-cumbre': '/images/cafe-menu/queso-cumbre-arepa.webp',
  'promo-duos': '/images/cafe-menu/promo-duos-perfectos.webp',
};

export function itemImage(item: ItemMenu): string | null {
  // First try Strapi image
  const strapiImg = strapiImage(item.imagen?.url);
  if (strapiImg) return strapiImg;
  
  // Fall back to local images based on familia or nombre
  if (item.familia && LOCAL_IMAGES[item.familia]) {
    return LOCAL_IMAGES[item.familia];
  }
  
  // Try matching by nombre (for items without familia)
  const nombre = (item.nombre || '').toLowerCase();
  if (nombre.includes('café de origen') || nombre.includes('cafe de origen') || nombre.includes('ambalá') || nombre.includes('ambala')) {
    return LOCAL_IMAGES['cafe-ambala'];
  }
  if (nombre.includes('espresso')) return LOCAL_IMAGES['espresso'];
  if (nombre.includes('miel') && nombre.includes('café')) return LOCAL_IMAGES['miel-cafe'];
  if (nombre.includes('miel') && nombre.includes('cafe')) return LOCAL_IMAGES['miel-cafe'];
  if (nombre.includes('latte') && nombre.includes('miel')) return LOCAL_IMAGES['latte-miel'];
  if (nombre.includes('aromática') || nombre.includes('aromatica')) return LOCAL_IMAGES['aromatica-flora'];
  if (nombre.includes('cold brew')) return LOCAL_IMAGES['cold-brew'];
  if (nombre.includes('chocolate')) return LOCAL_IMAGES['chocolate-local'];
  if (nombre.includes('pan de yuca')) return LOCAL_IMAGES['pan-yuca'];
  if (nombre.includes('queso')) return LOCAL_IMAGES['queso-cumbre'];
  
  return null;
}

export function proveedorFoto(p: Proveedor): string | null {
  return strapiImage(p.foto?.url);
}

/**
 * Icono representativo según el producto del proveedor.
 * Se usa como placeholder cuando no hay foto cargada en Strapi.
 */
export function proveedorIcono(p: { producto?: string | null; nombre?: string }): string {
  const txt = `${p.nombre ?? ''} ${p.producto ?? ''}`.toLowerCase();
  if (txt.includes('miel') || txt.includes('angelita') || txt.includes('melipon')) return 'hexagon';
  if (txt.includes('café') || txt.includes('cafe')) return 'coffee';
  if (txt.includes('leche') || txt.includes('queso')) return 'milk';
  if (txt.includes('cacao') || txt.includes('chocolate')) return 'gift';
  if (txt.includes('pan') || txt.includes('panader')) return 'croissant';
  if (txt.includes('fruta') || txt.includes('verdura') || txt.includes('hortal')) return 'apple';
  if (txt.includes('hierba') || txt.includes('planta') || txt.includes('infus')) return 'leaf';
  return 'sprout';
}
