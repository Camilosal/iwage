import type { APIRoute } from 'astro';
import { getPropiedadBySlug } from '@/lib/tierras';
import { callLLMJson } from '@/lib/ai/provider';
import { insightsLimiter, RateLimiter } from '@/lib/ai/rate-limiter';

const SYSTEM_PROMPT = `Eres un analista de inteligencia inmobiliaria rural experto en el Tolima, Colombia. Recibes los datos técnicos de una propiedad rural y generas insights estratégicos para un comprador potencial.

Responde EXCLUSIVAMENTE en JSON con esta estructura:
{
  "insights": [
    {"titulo": "...", "descripcion": "...", "valor": "...", "icono": "emoji", "categoria": "..."}
  ]
}

Genera exactamente 4-6 insights cubriendo estas categorías:
- valorizacion: Potencial de valorización del predio
- conectividad: Acceso a internet y vías
- agua: Derechos de agua y disponibilidad hídrica
- energia: Infraestructura energética
- suelo: Vocación del suelo y potencial productivo
- riesgo: Factores de riesgo a considerar

Cada insight debe tener:
- titulo: máximo 4 palabras
- descripcion: 1-2 oraciones específicas basadas en los datos
- valor: dato clave o métrica relevante (ej: "15% anual estimado", "Starlink 150Mbps")
- icono: un emoji relevante
- categoria: una de las categorías listadas

Sé específico y basado en datos. No seas genérico.`;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = RateLimiter.getClientIp(clientAddress, request.headers);
  if (!insightsLimiter.check(ip)) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Espera un momento.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { slug } = await request.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug requerido.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const prop = await getPropiedadBySlug(slug);
    if (!prop) {
      return new Response(JSON.stringify({ error: 'Propiedad no encontrada.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Return cached insights if available
    if (prop.business_insights && Array.isArray(prop.business_insights) && prop.business_insights.length > 0) {
      return new Response(JSON.stringify({ insights: prop.business_insights, cached: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const dr = prop.detalle_rural;
    const context = `PROPIEDAD: ${prop.titulo}
- Tipo: ${prop.tipo_propiedad} | Operación: ${prop.operacion}
- Precio: ${prop.precio ? prop.precio.toLocaleString('es-CO') : 'Consultar'} ${prop.moneda}
- Ubicación: ${prop.ubicacion_municipio}, ${prop.ubicacion_departamento}
- Área: ${prop.area_hectareas || '?'} ha | ${prop.area_total || '?'} m²
- Área construida: ${prop.area_construida || 'N/A'} m²
- Habitaciones: ${prop.numero_habitaciones || 0} | Baños: ${prop.numero_banos || 0}
- Agua: ${dr?.tiene_concesion_agua ? 'Con concesión vigente' : 'Sin concesión'} | Disponibilidad: ${prop.disponibilidad_agua || 'N/A'}
- Internet: ${dr?.cobertura_starlink_verificada ? `Starlink verificado ${dr.velocidad_internet_mbps || '?'} Mbps` : 'No verificado'}
- Vía acceso: ${dr?.tipo_via_acceso || prop.tipo_via || 'N/A'}
- Distancia casco urbano: ${dr?.distancia_casco_urbano_min || prop.distancia_centro_poblado || 'N/A'} min
- Energía trifásica: ${dr?.tiene_energia_trifasica ? 'Sí' : 'No'}
- Topografía: ${dr?.inclinacion_topografica || 'N/A'} | Área plana: ${dr?.porcentaje_area_plana || '?'}%
- Apta glamping: ${dr?.apta_glamping_agroturismo ? 'Sí' : 'No'}
- Vocación PBOT: ${dr?.vocacion_suelo_pbot || 'N/A'}
- Análisis PBOT: ${dr?.analisis_pbot_realizado ? 'Realizado' : 'No realizado'}
- Estado legal: ${dr?.estado_legal || 'N/A'}
- Seguridad sector: ${dr?.seguridad_sector || 'N/A'}
- Sello VAP: ${prop.sello_vap || 'Sin verificar'}`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `Analiza esta propiedad y genera insights estratégicos:\n\n${context}` },
    ];

    const result = await callLLMJson<{ insights: any[] }>(messages, {
      temperature: 0.4,
      maxTokens: 3000,
      timeout: 45_000,
    }).catch(() => ({ insights: [] }));

    return new Response(JSON.stringify({ insights: result.insights || [], cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[business-insights]', err.message);
    return new Response(JSON.stringify({ error: 'Error generando insights.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
