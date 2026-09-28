/**
 * Café Iwagé — Strapi data access layer
 */
import { strapiFetch, strapiSingle, CACHE_TTL } from './strapi.ts';
import { mediaSrc } from './media.ts';

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
  return mediaSrc(h.imagen?.url);
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

/**
 * Lo que pinta la tarjeta de una preparación: la URL propia ya reducida a relativa de sitio, o
 * `null` para que el template muestre el Icon tile.
 *
 * Ya no hay regla por nombre acá: `LOCAL_IMAGES` (10 rutas, 12 condiciones —1 por `familia`, 11
 * por `nombre`) se cayó el 2026-09-27 con la decisión aprobada «Strapi único dueño, sin fallbacks
 * de imagen». Se midió antes de tocarla: leyendo `item_menus` publicado **sin token**, como lo hace
 * el sitio, 16 de 17 traían `imagen.url` de Strapi, 1 (`te-de-guayaba-agria`) no tiene lámina, y la
 * regla por nombre disparaba para **0** filas — no estaba cubriendo nada que hoy se pierda. Las 19
 * piezas de `public/images/cafe-menu/` siguen en disco porque el bundle desplegado aún las
 * referencia; se jubilan después del deploy, no antes.
 */
export function itemImage(item: ItemMenu): string | null {
  return mediaSrc(item.imagen?.url);
}

/**
 * Lo que pinta la tarjeta: la URL ya reducida a relativa de sitio, o null.
 *
 * El parámetro es estructural (`{ foto?: { url } | null }`) y no `Proveedor`, porque el
 * relleno de `pages/cafe/index.astro` es una lista a mano sin el resto de campos del modelo:
 * con `Proveedor` tenía que llamar con `as any`, que es la forma de un cast que esconde que
 * acá solo se lee `foto.url`.
 */
export function proveedorFoto(p: { foto?: { url?: string | null } | null }): string | null {
  return mediaSrc(p.foto?.url);
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

/**
 * Identidad de URL. Estaba copiada en cuatro páginas (`cafe/index`, `cafe/menu`,
 * `cafe/proveedores/index`, `cafe/proveedores/[slug]`) y la de `menu.astro` no plegaba
 * acentos: `Café Doble` habría dado `caf-doble` donde las demás dan `cafe-doble`. No se
 * notaba porque los 17 `item_menus` traen `slug` lleno, pero la rama de reserva existía.
 * Un solo cuerpo cierra el asunto: anclas y rutas `[slug]` tienen que producir la MISMA
 * cadena en las dos puntas del enlace.
 */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** `slug` es nullable en Strapi y está vacío en 0 de 4 proveedores: el nombre es la identidad. */
export function proveedorSlug(p: { slug?: string | null; nombre?: string | null }): string {
  return p.slug || slugify(p.nombre ?? '');
}

/** Igual con las historias: 0 de 9 documentos tienen `slug`, y los 9 títulos son distintos. */
export function historiaSlug(h: { slug?: string | null; titulo?: string | null }): string {
  return h.slug || slugify(h.titulo ?? '');
}
