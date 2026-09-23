import type { APIRoute } from 'astro';
import { callLLM } from '@/lib/ai/provider';
import { chatLimiter, RateLimiter } from '@/lib/ai/rate-limiter';
import { retrieve, detectBrand } from '@/lib/rag/retriever';
import { buildSystemPrompt, extractLinks, generateSuggestions } from '@/lib/rag/context';
import type { ChatResponse } from '@/lib/rag/knowledge-index';
import { SITE } from '@/config/site';

/**
 * RAG-powered multi-brand chat endpoint.
 * Pipeline: brand detection → retrieval → context assembly → LLM → structured response
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = RateLimiter.getClientIp(clientAddress, request.headers);

  if (!chatLimiter.check(ip)) {
    return json({ error: 'Demasiadas solicitudes. Espera un momento.' }, 429);
  }

  try {
    const { message, history = [], brand, page } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return json({ error: 'Mensaje inválido.' }, 400);
    }

    const query = message.trim();

    // ── Intent: Navigational shortcuts ──────────────────────
    const navResult = handleNavigationalIntent(query);
    if (navResult) return json(navResult);

    // ── Intent: WhatsApp escalation ─────────────────────────
    if (isWhatsAppIntent(query)) {
      return json({
        reply: `¡Con gusto! Puedes escribirnos directamente por WhatsApp al ${SITE.whatsapp}. Un asesor de Iwagé te atenderá en menos de 24 horas. 🌱`,
        links: [{ label: '💬 Escribir por WhatsApp', url: `https://wa.me/${SITE.whatsapp.replace('+', '')}`, type: 'pagina' }],
        suggestions: ['Ver propiedades disponibles', 'Conocer experiencias'],
        brand: brand || 'general',
      } satisfies ChatResponse);
    }

    // ── Brand Detection ─────────────────────────────────────
    const detectedBrand = detectBrand(query, brand) || 'general';

    // ── RAG Retrieval ───────────────────────────────────────
    const results = await retrieve(query, { brand: detectedBrand, maxResults: 5 });

    // ── Context Assembly ────────────────────────────────────
    const systemPrompt = buildSystemPrompt(detectedBrand, results);
    const links = extractLinks(results);
    const suggestions = generateSuggestions(detectedBrand, results);

    // ── LLM Call ────────────────────────────────────────────
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.slice(-8).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || m.text || '',
      })),
      { role: 'user' as const, content: query },
    ];

    const llmResult = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 45_000,
    });

    const reply = llmResult.content || 'Disculpa, no pude procesar tu consulta. Intenta reformular tu pregunta.';

    return json({
      reply,
      links,
      suggestions,
      brand: detectedBrand,
    } satisfies ChatResponse);

  } catch (err: any) {
    console.error('[chat]', err.message);
    const isQuota = /quota|exhausted|429|402|rate.?limit/i.test(err?.message || '');
    const userMsg = isQuota
      ? 'El asistente está temporalmente fuera de servicio por límites de uso. Usa el menú para navegar o escríbenos por WhatsApp.'
      : 'Error del asistente. Intenta de nuevo.';
    return json({ error: userMsg }, 500);
  }
};

// ── Helpers ──────────────────────────────────────────────

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle simple navigational intents without calling the LLM.
 * Returns a ChatResponse if the query is purely navigational, null otherwise.
 */
function handleNavigationalIntent(query: string): ChatResponse | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const navPatterns: Array<{ pattern: RegExp; reply: string; links: ChatResponse['links']; brand: string }> = [
    {
      pattern: /donde (veo|encuentro|busco) (propiedades|fincas|lotes|tierras)/,
      reply: 'Puedes explorar todas nuestras propiedades rurales verificadas en el catálogo de Iwagé Tierras. Cada propiedad tiene Sello VAP de verificación legal.',
      links: [{ label: '🏡 Catálogo de Propiedades', url: '/tierras/propiedades', type: 'pagina' }],
      brand: 'tierras',
    },
    {
      pattern: /donde (veo|encuentro|busco) (experiencias|tours|actividades)/,
      reply: 'Descubre todas nuestras experiencias de turismo regenerativo en el catálogo de Iwagé Naturaleza. Hay opciones de naturaleza, cultura, bienestar, aventura y gastronomía.',
      links: [{ label: '🌿 Ver Experiencias', url: '/naturaleza/experiencias', type: 'pagina' }],
      brand: 'naturaleza',
    },
    {
      pattern: /donde (veo|encuentro) (el menu|la carta|que hay de comer)/,
      reply: 'El menú del Café Iwagé incluye café de origen, infusiones, panadería artesanal y bebidas signature. Todo con ingredientes de proveedores a menos de 4km.',
      links: [{ label: '☕ Ver Menú del Café', url: '/cafe/menu', type: 'pagina' }],
      brand: 'cafe',
    },
    {
      pattern: /donde (veo|compro|encuentro) (miel|productos|cajas)/,
      reply: 'En la tienda de Iwagé Meliponas encontrarás miel de Angelita con trazabilidad, cajas INPA/AF en Nogal Cafetero y kits de meliponicultura.',
      links: [{ label: '🍯 Ir a la Tienda', url: '/meliponas/tienda', type: 'pagina' }],
      brand: 'meliponas',
    },
    {
      pattern: /como (llego|contacto|hablo)/,
      reply: `Puedes contactarnos por WhatsApp al ${SITE.whatsapp} o por email a ${SITE.email}. Estamos en el Corredor Ambalá, Ibagué, Tolima.`,
      links: [
        { label: '💬 WhatsApp', url: `https://wa.me/${SITE.whatsapp.replace('+', '')}`, type: 'pagina' },
        { label: '📄 Página de Contacto', url: '/meliponas/contacto', type: 'pagina' },
      ],
      brand: 'general',
    },
  ];

  for (const { pattern, reply, links, brand } of navPatterns) {
    if (pattern.test(q)) {
      return { reply, links, suggestions: ['Hablar con un asesor', 'Conocer el ecosistema Iwagé'], brand };
    }
  }

  return null;
}

/** Detect if user explicitly wants WhatsApp/human contact */
function isWhatsAppIntent(query: string): boolean {
  const q = query.toLowerCase();
  return /whatsapp|hablar con (alguien|humano|asesor)|contactar (persona|humano)|llamar|telefono/.test(q);
}
