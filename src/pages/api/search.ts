import type { APIRoute } from 'astro';
import { searchLimiter, RateLimiter } from '@/lib/ai/rate-limiter';
import { retrieve, detectBrand } from '@/lib/rag/retriever';
import type { Brand, ContentType } from '@/lib/rag/knowledge-index';

/**
 * Site-wide semantic search endpoint.
 * Pure retrieval (no LLM) — returns scored knowledge chunks instantly.
 */

interface SearchResult {
  id: string;
  title: string;
  summary: string;
  url: string;
  brand: Brand;
  type: ContentType;
  score: number;
  metadata: Record<string, any>;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  detectedBrand: string | null;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = RateLimiter.getClientIp(clientAddress, request.headers);

  if (!searchLimiter.check(ip)) {
    return json({ error: 'Demasiadas búsquedas. Espera un momento.' }, 429);
  }

  try {
    const body = await request.json();
    const { query, brand, limit } = body;

    // ── Validation ──────────────────────────────────────────
    if (!query || typeof query !== 'string') {
      return json({ error: 'Consulta inválida.' }, 400);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return json({ results: [], total: 0, detectedBrand: null } satisfies SearchResponse);
    }
    if (trimmed.length > 200) {
      return json({ error: 'Consulta demasiado larga (máx. 200 caracteres).' }, 400);
    }

    // ── Brand detection ─────────────────────────────────────
    const detectedBrand = detectBrand(trimmed, brand) || null;

    // ── Retrieval ───────────────────────────────────────────
    const maxResults = Math.min(Math.max(parseInt(limit) || 12, 1), 30);
    const retrievalResults = await retrieve(trimmed, {
      brand: detectedBrand || brand || undefined,
      maxResults,
      minScore: 0.5,
    });

    // ── Map to response ─────────────────────────────────────
    const results: SearchResult[] = retrievalResults.map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.title,
      summary: chunk.summary,
      url: chunk.url,
      brand: chunk.brand,
      type: chunk.type,
      score,
      metadata: chunk.metadata,
    }));

    return json({
      results,
      total: results.length,
      detectedBrand,
    } satisfies SearchResponse);

  } catch (err: any) {
    console.error('[search]', err.message);
    return json({ error: 'Error en la búsqueda. Intenta de nuevo.' }, 500);
  }
};

// ── Helper ───────────────────────────────────────────────

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
