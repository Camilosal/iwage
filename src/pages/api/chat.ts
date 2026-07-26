import type { APIRoute } from 'astro';

// Provider-agnostic AI chat endpoint
// Supports: openai, openrouter, gemini via AI_PROVIDER env var

const SYSTEM_PROMPTS: Record<string, string> = {
  concierge: `Eres el asistente virtual de Iwagé Meliponario, un centro de meliponicultura en Ibagué, Tolima, Colombia.
Ayudas a visitantes con información sobre: productos de la tienda (miel de Angelita, cajas INPA/AF, kits), servicios de polinización, proyectos de meliponarios, y el café comunitario.
Tono: cálido, knowledgeable, conciso. Responde en español. Si no sabes algo, sugiere contactar por WhatsApp.`,
  tecnico: `Eres el asistente técnico de Iwagé Meliponario, especializado en meliponicultura de Tetragonisca angustula.
Ayudas con: manejo de colmenas, cosecha de miel, identificación de plagas, flora melífera, y protocolos del Estándar Iwagé.
Tono: técnico pero accesible. Responde en español. Cita fuentes cuando sea relevante.`,
};

// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.reset) {
    rateLimit.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function callOpenAI(messages: any[], apiKey: string, baseUrl: string, model: string) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 500, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`AI provider error: ${res.status}`);
  const data = await res.json();
  return data.choices[0]?.message?.content || 'No pude generar una respuesta.';
}

async function callGemini(messages: any[], apiKey: string) {
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const systemMsg = messages.find((m: any) => m.role === 'system');
  const body: any = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Espera un momento.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, context = 'concierge', history = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Mensaje inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.concierge;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6),
      { role: 'user', content: message },
    ];

    const provider = process.env.AI_PROVIDER || 'openai';
    let reply: string;

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      reply = await callGemini(messages, apiKey);
    } else if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
      reply = await callOpenAI(messages, apiKey, 'https://openrouter.ai/api/v1', process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct');
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
      reply = await callOpenAI(messages, apiKey, process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_MODEL || 'gpt-4o-mini');
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[chat]', err.message);
    return new Response(JSON.stringify({ error: 'Error del asistente. Intenta de nuevo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
