import type { APIRoute } from 'astro';
import { getPropiedadBySlug } from '@/lib/tierras';

const PERFILES: Record<string, string> = {
  productor: 'Productor Agrícola',
  campestre: 'Vivienda Campestre',
  nomada: 'Nómada Digital',
  turistico: 'Emprendedor Turístico',
  patrimonial: 'Inversionista Patrimonial',
};

const SYSTEM_PROMPT = `Eres un storyteller inmobiliario experto en el Tolima, Colombia. Recibes los datos de una propiedad rural y un perfil de comprador. Tu trabajo es escribir una narrativa emocional y específica (máximo 120 palabras) que conecte esa propiedad con los sueños de ese perfil de comprador.

Responde EXCLUSIVAMENTE en JSON:
{
  "narrativa": "texto narrativo en segunda persona, evocador, específico",
  "gancho": "frase de apertura impactante (máx 10 palabras)"
}

Reglas:
- Escribe en segunda persona ("imagina tu...", "aquí podrás...")
- Sé específico: menciona datos reales de la propiedad
- Conecta con la aspiración del perfil
- Tono: cálido, inspirador, pero grounded (no exagerado)
- Incluye un detalle sensorial (sonido, olor, vista)
- NO uses clichés genéricos tipo "tu sueño hecho realidad"`;

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
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { slug, perfil } = await request.json();
    if (!slug || !perfil || !PERFILES[perfil]) {
      return new Response(JSON.stringify({ error: 'Slug y perfil válidos requeridos.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const prop = await getPropiedadBySlug(slug);
    if (!prop) {
      return new Response(JSON.stringify({ error: 'Propiedad no encontrada.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Check cached narratives
    if (prop.narrativas && prop.narrativas[perfil]) {
      return new Response(JSON.stringify({ ...prop.narrativas[perfil], cached: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const dr = prop.detalle_rural;
    const context = `PROPIEDAD: ${prop.titulo}
- Tipo: ${prop.tipo_propiedad} | Precio: ${prop.precio ? prop.precio.toLocaleString('es-CO') : 'Consultar'} ${prop.moneda}
- Ubicación: ${prop.ubicacion_municipio}, ${prop.ubicacion_departamento}
- Área: ${prop.area_hectareas || '?'} ha
- Agua: ${dr?.tiene_concesion_agua ? 'Con concesión' : prop.disponibilidad_agua || 'N/A'}
- Internet: ${dr?.cobertura_starlink_verificada ? `Starlink ${dr.velocidad_internet_mbps}Mbps` : 'No verificado'}
- Vía: ${dr?.tipo_via_acceso || 'N/A'} | Distancia: ${dr?.distancia_casco_urbano_min || prop.distancia_centro_poblado || '?'} min
- Topografía: ${dr?.inclinacion_topografica || 'N/A'} | Área plana: ${dr?.porcentaje_area_plana || '?'}%
- Apta glamping: ${dr?.apta_glamping_agroturismo ? 'Sí' : 'No'}
- Vocación PBOT: ${dr?.vocacion_suelo_pbot || 'N/A'}
- Descripción: ${(prop.descripcion || '').slice(0, 300)}`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `PERFIL DEL COMPRADOR: ${PERFILES[perfil]}\n\n${context}` },
    ];

    const provider = process.env.AI_PROVIDER || 'openai';
    let content: string;

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      const body = {
        contents: [{ role: 'user', parts: [{ text: messages[1].content }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
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
        body: JSON.stringify({ model, messages, max_tokens: 400, temperature: 0.7 }),
      });
      if (!res.ok) throw new Error(`AI error: ${res.status}`);
      const data = await res.json();
      content = data.choices[0]?.message?.content || '{}';
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { narrativa: '', gancho: '' };

    return new Response(JSON.stringify({ ...result, perfil: PERFILES[perfil], cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[storytelling]', err.message);
    return new Response(JSON.stringify({ error: 'Error generando narrativa.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
