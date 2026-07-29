import type { APIRoute } from 'astro';
import { buildKnowledgeIndex } from '@/lib/rag/indexer';
import { redisInvalidate } from '@/lib/redis';
import { RAG_CACHE_KEY } from '@/lib/rag/knowledge-index';

/**
 * POST /api/reindex
 * Webhook endpoint for Strapi to trigger knowledge index rebuild on content change.
 * Can also be called manually to force a fresh index.
 * 
 * Optional body: { "secret": "..." } for basic auth via REINDEX_SECRET env var.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Optional secret validation
    const secret = process.env.REINDEX_SECRET;
    if (secret) {
      const body = await request.json().catch(() => ({}));
      if (body.secret !== secret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Invalidate existing cache
    await redisInvalidate(RAG_CACHE_KEY);

    // Rebuild index
    const index = await buildKnowledgeIndex();

    return new Response(JSON.stringify({
      success: true,
      chunks: index.length,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[reindex]', err.message);
    return new Response(JSON.stringify({ error: 'Reindex failed', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
