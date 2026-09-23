/**
 * Data access layer for Granja experimentos.
 * Fetches from Strapi `experimentos` collection — a dedicated content type
 * for the Laboratorio Vivo methodology (structured 6-section fichas).
 * Each experiment links to supporting bitácora articles as documentation.
 */
import { strapiFetch, CACHE_TTL } from './strapi';
import type { EntradaBitacora } from './bitacora';

export interface ExperimentoMedia {
  id: number;
  documentId: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface Experimento {
  id: number;
  documentId: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  subsistema: string | null;
  estado_experimento: string | null;
  fecha: string | null;
  imagen: string | null;
  origen: string | null;
  hipotesis: string | null;
  proceso: string | null;
  resultado: string | null;
  leccion: string | null;
  servicio_derivado: string | null;
  fuentes_inspiracion: string | null;
  destacado: boolean;
  tags: string | null;
  tiempo_lectura: number | null;
  bitacoras?: EntradaBitacora[];
  documentos?: ExperimentoMedia[];
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Subsystem metadata for display (shared with sistema pages) */
export const SUBSISTEMA_META: Record<string, { label: string; icon: string; estado: string }> = {
  'gestion-hidrica': { label: 'Gestión hídrica', icon: 'droplets', estado: 'operando' },
  'energia': { label: 'Energía', icon: 'zap', estado: 'operando' },
  'biorefineria-domestica': { label: 'Bio-refinería doméstica', icon: 'flask-conical', estado: 'construccion' },
  'agroecosistema-productivo': { label: 'Agroecosistema productivo', icon: 'sprout', estado: 'construccion' },
  'gemelo-digital': { label: 'Gemelo digital', icon: 'cpu', estado: 'operando' },
  'bioarquitectura': { label: 'Bioarquitectura', icon: 'home', estado: 'diseno' },
};

/** Experiment state display config */
export const ESTADO_EXPERIMENTO: Record<string, { label: string; class: string }> = {
  idea: { label: 'Idea', class: 'bg-gray-100 text-gray-600' },
  en_curso: { label: 'En curso', class: 'bg-blue-100 text-blue-700' },
  con_resultados: { label: 'Con resultados', class: 'bg-amber-100 text-amber-700' },
  validado: { label: 'Validado', class: 'bg-emerald-100 text-emerald-700' },
  descartado: { label: 'Descartado', class: 'bg-red-100 text-red-600' },
};

/** Section definitions for the Laboratorio Vivo ficha */
export const SECTIONS = [
  { key: 'origen' as const, field: 'origen', heading: 'Origen', icon: 'target', desc: '¿Qué necesidad real del territorio inició este experimento?' },
  { key: 'hipotesis' as const, field: 'hipotesis', heading: 'Hipótesis', icon: 'lightbulb', desc: '¿Qué esperábamos que pasara?' },
  { key: 'proceso' as const, field: 'proceso', heading: 'Proceso', icon: 'wrench', desc: '¿Qué se hizo, paso a paso?' },
  { key: 'resultado' as const, field: 'resultado', heading: 'Resultado', icon: 'bar-chart-3', desc: '¿Qué pasó realmente? (bueno o malo)' },
  { key: 'leccion' as const, field: 'leccion', heading: 'Lección', icon: 'book-open', desc: '¿Qué aprendimos?' },
  { key: 'servicio_derivado' as const, field: 'servicio_derivado', heading: 'Servicio derivado', icon: 'package', desc: 'Si funcionó, ¿qué servicio se derivó?' },
  { key: 'fuentes_inspiracion' as const, field: 'fuentes_inspiracion', heading: 'Fuentes de inspiración', icon: 'sparkles', desc: 'Referencias, lecturas, proyectos o personas que inspiraron este experimento.' },
];

export type SectionKey = typeof SECTIONS[number]['key'];

/** Fetch all published experiments, with optional filters */
export async function getExperimentos(
  opts: {
    pageSize?: number;
    page?: number;
    subsistema?: string;
    estado?: string;
    destacado?: boolean;
  } = {}
): Promise<{ data: Experimento[]; total: number }> {
  try {
    const filters: Record<string, any> = {};
    if (opts.subsistema) filters.subsistema = { $eq: opts.subsistema };
    if (opts.estado) filters.estado_experimento = { $eq: opts.estado };
    if (opts.destacado !== undefined) filters.destacado = { $eq: opts.destacado };

    const res = await strapiFetch<Experimento>('experimentos', {
      ttl: CACHE_TTL.list,
      filters,
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: opts.page || 1, pageSize: opts.pageSize || 20 },
      publicationState: 'live',
      populate: ['bitacoras', 'documentos'],
    });
    return {
      data: res.data || [],
      total: res.meta?.pagination?.total || 0,
    };
  } catch {
    return { data: [], total: 0 };
  }
}

/** Fetch a single experiment by slug, with bitacoras and documentos populated */
export async function getExperimentoBySlug(slug: string): Promise<Experimento | null> {
  try {
    const res = await strapiFetch<Experimento>('experimentos', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
      publicationState: 'live',
      populate: ['bitacoras', 'documentos'],
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

/** Fetch experiments for a specific subsystem */
export async function getExperimentosBySubsistema(
  subsistema: string,
  opts: { pageSize?: number } = {}
): Promise<Experimento[]> {
  try {
    const res = await strapiFetch<Experimento>('experimentos', {
      ttl: CACHE_TTL.list,
      filters: { subsistema: { $eq: subsistema } },
      sort: ['fecha:desc'],
      pagination: { pageSize: opts.pageSize || 20 },
      publicationState: 'live',
    });
    return res.data || [];
  } catch {
    return [];
  }
}

/** Get all slugs for static generation */
export async function getAllExperimentoSlugs(): Promise<string[]> {
  try {
    const res = await strapiFetch<Experimento>('experimentos', {
      ttl: CACHE_TTL.list,
      pagination: { pageSize: 100 },
      sort: ['fecha:desc'],
      publicationState: 'live',
    });
    return (res.data || []).map((e) => e.slug);
  } catch {
    return [];
  }
}

/** Format date for display (shared util) */
export function formatFecha(fecha: string | null): string {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
