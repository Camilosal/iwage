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

export const CATEGORIAS_MENU = [
  { slug: 'cafe', label: 'Café', icon: '☕' },
  { slug: 'signature', label: 'Signature', icon: '✨' },
  { slug: 'panaderia', label: 'Panadería', icon: '🥐' },
  { slug: 'infusion', label: 'Infusiones', icon: '🌿' },
  { slug: 'frio', label: 'Fríos', icon: '🧊' },
  { slug: 'acompanamiento', label: 'Acompañamientos', icon: '🍫' },
] as const;

export function itemImage(item: ItemMenu): string | null {
  return strapiImage(item.imagen?.url);
}

export function proveedorFoto(p: Proveedor): string | null {
  return strapiImage(p.foto?.url);
}
