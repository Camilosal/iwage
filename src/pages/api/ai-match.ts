import type { APIRoute } from 'astro';
import { getPropiedades } from '@/lib/tierras';

const SYSTEM_PROMPT = `Eres un agente inmobiliario rural experto en el Tolima, Colombia. Recibes una consulta en lenguaje natural y una lista de propiedades disponibles. Tu trabajo:
1. Identificar los criterios implícitos del usuario (tipo de proyecto, presupuesto, ubicación, características)
2. Seleccionar las propiedades que mejor coinciden
3. Explicar brevemente POR QUÉ cada propiedad es buena opción

Responde EXCLUSIVAMENTE en JSON con esta estructura:
{
  "matches": [{"slug": "...", "titulo": "...", "match_score": 0-100, "match_reason": "..."}],
  "search_insights": "Resumen de lo que encontré y recomendación general",
  "user_profile": "Perfil detectado del usuario (ej: Productor agrícola, Inversionista, etc.)"
}

Reglas:
- Máximo 5 matches
- match_score: 0-100 basado en qué tan bien cumple los criterios
- Si ninguna propiedad coincide bien, devuelve matches vacío y explica en search_insights
- match_reason: 1-2 oraciones específicas sobre por qué esa propiedad sirve
- NO inventes propiedades que no estén en la lista`;

// Rate limiter
const rateLimit = new Map<string, { count: number; reset: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.reset) { rateLimit.set(ip, { count: 1, reset: now + 60000 }); return true; }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: 'Demasiadas búsquedas. Espera un momento.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { query } = await request.json();
    if (!query || typeof query !== 'string' || query.length < 5) {
      return new Response(JSON.stringify({ error: 'Describe lo que buscas con más detalle.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Fetch all published properties
    const { data: properties } = await getPropiedades({ pageSize: 50 });
    if (properties.length === 0) {
      return new Response(JSON.stringify({ matches: [], search_insights: 'No hay propiedades disponibles en este momento.', user_profile: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Build context
    const propsContext = properties.map(p => {
      const dr = p.detalle_rural;
      return `PROPIEDAD: ${p.titulo}
- Slug: ${p.slug}
- Tipo: ${p.tipo_propiedad} | Operación: ${p.operacion}
- Precio: ${p.precio ? p.precio.toLocaleString('es-CO') : 'Consultar'} ${p.moneda}
- Ubicación: ${p.ubicacion_municipio}, ${p.ubicacion_departamento}
- Área: ${p.area_hectareas || '?'} ha | ${p.area_total || '?'} m²
- Habitaciones: ${p.numero_habitaciones || 0} | Baños: ${p.numero_banos || 0}
- Agua: ${dr?.tiene_concesion_agua ? 'Con concesión' : p.disponibilidad_agua || 'N/A'}
- Internet: ${dr?.cobertura_starlink_verificada ? `Starlink ${dr.velocidad_internet_mbps}Mbps` : 'No verificado'}
- Vía: ${dr?.tipo_via_acceso || p.tipo_via || 'N/A'}
- Topografía: ${dr?.inclinacion_topografica || 'N/A'} | Área plana: ${dr?.porcentaje_area_plana || '?'}%
- Apta glamping: ${dr?.apta_glamping_agroturismo ? 'Sí' : 'No'}
- Vocación PBOT: ${dr?.vocacion_suelo_pbot || 'N/A'}
- Sello VAP: ${p.sello_vap}`;
    }).join('\n\n');

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `CONSULTA DEL USUARIO: "${query}"\n\nPROPIEDADES DISPONIBLES:\n${propsContext}` },
    ];

    // Call LLM
    const provider = process.env.AI_PROVIDER || 'openai';
    let content: string;

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      const body = {
        contents: [{ role: 'user', parts: [{ text: messages[1].content }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
      };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
      const data = await res.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else {
      const apiKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
      const baseUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
      const model = provider === 'openrouter' ? (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct') : (process.env.OPENAI_MODEL || 'gpt-4o-mini');
      if (!apiKey) throw new Error('API key not configured');
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.3 }),
      });
      if (!res.ok) throw new Error(`AI error: ${res.status}`);
      const data = await res.json();
      content = data.choices[0]?.message?.content || '{}';
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { matches: [], search_insights: 'No pude procesar los resultados.', user_profile: '' };

    // Enrich matches with property data
    const enriched = (result.matches || []).map((m: any) => {
      const prop = properties.find(p => p.slug === m.slug);
      return {
        ...m,
        precio: prop?.precio || null,
        moneda: prop?.moneda || 'COP',
        ubicacion_municipio: prop?.ubicacion_municipio || '',
        area_hectareas: prop?.area_hectareas || null,
        tipo_propiedad: prop?.tipo_propiedad || '',
      };
    });

    return new Response(JSON.stringify({ ...result, matches: enriched }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[ai-match]', err.message);
    return new Response(JSON.stringify({ error: 'Error en la búsqueda inteligente. Intenta de nuevo.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
