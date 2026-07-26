/**
 * RAG Retriever — keyword-based search and scoring engine.
 * Strategy A: TF-IDF-like scoring with field weighting.
 * No external dependencies required.
 */
import type { KnowledgeChunk, RetrievalResult, Brand } from './knowledge-index';
import { RAG_MAX_CHUNKS } from './knowledge-index';
import { buildKnowledgeIndex } from './indexer';

// ── Text Processing ──────────────────────────────────────

/** Normalize and tokenize a string into searchable terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Common Spanish stop words to ignore
const STOP_WORDS = new Set([
  'que', 'los', 'las', 'una', 'uno', 'del', 'por', 'con', 'para', 'como',
  'mas', 'pero', 'sus', 'este', 'esta', 'son', 'hay', 'fue', 'ser', 'the',
  'and', 'for', 'are', 'was', 'has', 'have', 'not', 'you', 'all', 'can',
  'cual', 'cuales', 'donde', 'cuando', 'cuanto', 'cuanta', 'muy', 'tambien',
  'sobre', 'entre', 'desde', 'hasta', 'hacia', 'sin', 'nos', 'les', 'ese',
  'esa', 'esos', 'esas', 'esto', 'estos', 'estas', 'otro', 'otra', 'otros',
]);

function extractQueryTerms(query: string): string[] {
  return tokenize(query).filter(t => !STOP_WORDS.has(t));
}

// ── Scoring ──────────────────────────────────────────────

interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Score a chunk against query terms using weighted field matching.
 * Title matches: x3, Keyword matches: x2, Summary matches: x1
 */
function scoreChunk(chunk: KnowledgeChunk, queryTerms: string[]): number {
  let score = 0;

  const titleTokens = new Set(tokenize(chunk.title));
  const keywordSet = new Set(chunk.keywords.map(k =>
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  ));
  const summaryTokens = new Set(tokenize(chunk.summary));

  for (const term of queryTerms) {
    // Exact keyword match (highest weight)
    if (keywordSet.has(term)) score += 4;

    // Title match
    if (titleTokens.has(term)) score += 3;

    // Partial keyword match (term contained in keyword)
    for (const kw of keywordSet) {
      if (kw.includes(term) || term.includes(kw)) {
        score += 1.5;
        break;
      }
    }

    // Summary match
    if (summaryTokens.has(term)) score += 1;
  }

  // Boost for multiple term matches (relevance signal)
  const matchedTerms = queryTerms.filter(t =>
    titleTokens.has(t) || keywordSet.has(t) || summaryTokens.has(t)
  );
  if (matchedTerms.length > 1) {
    score *= 1 + (matchedTerms.length - 1) * 0.3;
  }

  return score;
}

// ── Brand Detection ──────────────────────────────────────

const BRAND_KEYWORDS: Record<string, Brand> = {
  // Tierras
  propiedad: 'tierras', propiedades: 'tierras', finca: 'tierras', fincas: 'tierras',
  lote: 'tierras', lotes: 'tierras', terreno: 'tierras', casa_campestre: 'tierras',
  comprar_tierra: 'tierras', inmobiliaria: 'tierras', vap: 'tierras', hectareas: 'tierras',
  predio: 'tierras', escritura: 'tierras', avaluo: 'tierras',
  // Naturaleza
  experiencia: 'naturaleza', experiencias: 'naturaleza', tour: 'naturaleza',
  anfitrion: 'naturaleza', anfitriones: 'naturaleza', paquete: 'naturaleza',
  turismo: 'naturaleza', senderismo: 'naturaleza', aventura: 'naturaleza',
  reserva: 'naturaleza', reservar: 'naturaleza',
  // Meliponas
  miel: 'meliponas', abeja: 'meliponas', abejas: 'meliponas', colmena: 'meliponas',
  colmenas: 'meliponas', meliponas: 'meliponas', meliponario: 'meliponas',
  angelita: 'meliponas', polinizacion: 'meliponas', caja: 'meliponas',
  cajas: 'meliponas', inpa: 'meliponas', trazabilidad: 'meliponas',
  // Café
  cafe: 'cafe', menu: 'cafe', carta: 'cafe', bebida: 'cafe', bebidas: 'cafe',
  infusion: 'cafe', panaderia: 'cafe', proveedor: 'cafe', proveedores: 'cafe',
  taza: 'cafe',
  // Gestión
  gestion: 'gestion', administracion: 'gestion', administrar: 'gestion',
  renta: 'gestion', airbnb: 'gestion', booking: 'gestion',
  property_management: 'gestion', glamping: 'gestion',
};

/**
 * Detect the most likely brand from a query.
 * Returns undefined if no clear brand signal.
 */
export function detectBrand(query: string, explicitBrand?: string): Brand | undefined {
  if (explicitBrand && explicitBrand !== 'general') return explicitBrand as Brand;

  const terms = extractQueryTerms(query);
  const brandScores: Record<string, number> = {};

  for (const term of terms) {
    const brand = BRAND_KEYWORDS[term];
    if (brand) {
      brandScores[brand] = (brandScores[brand] || 0) + 1;
    }
  }

  // Also check multi-word patterns
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('propiedad rural') || lowerQuery.includes('comprar finca')) brandScores['tierras'] = (brandScores['tierras'] || 0) + 2;
  if (lowerQuery.includes('turismo') || lowerQuery.includes('experiencia')) brandScores['naturaleza'] = (brandScores['naturaleza'] || 0) + 1;

  const sorted = Object.entries(brandScores).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= 1) {
    return sorted[0][0] as Brand;
  }
  return undefined;
}

// ── Main Retrieval ───────────────────────────────────────

export interface RetrieveOptions {
  /** Explicit brand context (from widget URL) */
  brand?: string;
  /** Max results to return. Default: RAG_MAX_CHUNKS */
  maxResults?: number;
  /** Minimum score threshold. Default: 1 */
  minScore?: number;
}

/**
 * Retrieve the most relevant knowledge chunks for a query.
 * Uses keyword scoring with brand-aware filtering.
 */
export async function retrieve(query: string, opts: RetrieveOptions = {}): Promise<RetrievalResult[]> {
  const { brand, maxResults = RAG_MAX_CHUNKS, minScore = 1 } = opts;

  const index = await buildKnowledgeIndex();
  if (index.length === 0) return [];

  const queryTerms = extractQueryTerms(query);
  if (queryTerms.length === 0) return [];

  const detectedBrand = detectBrand(query, brand);

  // Score all chunks
  const scored: ScoredChunk[] = index.map(chunk => ({
    chunk,
    score: scoreChunk(chunk, queryTerms),
  }));

  // Apply brand boost (not filter — we still want cross-brand results if relevant)
  if (detectedBrand) {
    for (const item of scored) {
      if (item.chunk.brand === detectedBrand) {
        item.score *= 1.5;
      }
    }
  }

  // Filter by minimum score and sort
  return scored
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ chunk, score }) => ({ chunk, score: Math.round(score * 10) / 10 }));
}
