import type { APIRoute } from 'astro';
import { getPropiedades } from '@/lib/tierras';
import { callLLMJson } from '@/lib/ai/provider';
import { matchLimiter, RateLimiter } from '@/lib/ai/rate-limiter';

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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = RateLimiter.getClientIp(clientAddress, request.headers);
  if (!matchLimiter.check(ip)) {
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
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `CONSULTA DEL USUARIO: "${query}"\n\nPROPIEDADES DISPONIBLES:\n${propsContext}` },
    ];

    const result = await callLLMJson<{ matches: any[]; search_insights: string; user_profile: string }>(messages, {
      temperature: 0.3,
      maxTokens: 3000,
      timeout: 45_000,
    }).catch(() => ({ matches: [], search_insights: 'No pude procesar los resultados.', user_profile: '' }));

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
