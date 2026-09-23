/**
 * RAG Knowledge Index — types and chunk model.
 * Defines the structure for searchable knowledge chunks across all brands.
 */

export type Brand = 'meliponas' | 'cafe' | 'tierras' | 'naturaleza' | 'gestion' | 'granja' | 'general';

export type ContentType =
  | 'propiedad'
  | 'propiedad_gestion'
  | 'experiencia'
  | 'anfitrion'
  | 'paquete'
  | 'menu'
  | 'bitacora'
  | 'producto'
  | 'proveedor'
  | 'lote_miel'
  | 'proyecto'
  | 'cultivo_polinizacion'
  | 'iniciativa'
  | 'complemento'
  | 'historia_visitante'
  | 'pilar_estandar'
  | 'etapa_proyecto'
  | 'subsistema_granja'
  | 'visita_granja'
  | 'servicio_granja'
  | 'servicio'
  | 'pagina';

export interface KnowledgeChunk {
  /** Unique ID, e.g. "propiedad:finca-el-mirador" */
  id: string;
  /** Content type category */
  type: ContentType;
  /** Brand this chunk belongs to */
  brand: Brand;
  /** Human-readable title */
  title: string;
  /** 1-2 sentence description */
  summary: string;
  /** Searchable terms (lowercase) */
  keywords: string[];
  /** Canonical page URL (relative path) */
  url: string;
  /** Additional structured metadata (price, location, category, etc.) */
  metadata: Record<string, any>;
  /** Cross-brand related URLs (e.g. experiences near a property) */
  related?: Array<{ url: string; title: string; type: ContentType }>;
  /** ISO date of last update */
  updatedAt: string;
}

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  score: number;
}

export interface ChatLink {
  label: string;
  url: string;
  type: ContentType | 'pagina';
}

export interface ChatResponse {
  reply: string;
  links: ChatLink[];
  suggestions: string[];
  brand: string;
}

// ── Index configuration ──────────────────────────────────

export const RAG_INDEX_TTL = parseInt(process.env.RAG_INDEX_TTL || '600', 10); // seconds
export const RAG_MAX_CHUNKS = parseInt(process.env.RAG_MAX_CHUNKS || '5', 10);
export const RAG_CACHE_KEY = 'rag:index';
