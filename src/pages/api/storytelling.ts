import type { APIRoute } from 'astro';
import { getPropiedadBySlug } from '@/lib/tierras';
import { callLLMJson } from '@/lib/ai/provider';
import { storytellingLimiter, RateLimiter } from '@/lib/ai/rate-limiter';

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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = RateLimiter.getClientIp(clientAddress, request.headers);
  if (!storytellingLimiter.check(ip)) {
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
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `PERFIL DEL COMPRADOR: ${PERFILES[perfil]}\n\n${context}` },
    ];

    const result = await callLLMJson<{ narrativa: string; gancho: string }>(messages, {
      temperature: 0.7,
      maxTokens: 400,
    }).catch(() => ({ narrativa: '', gancho: '' }));

    return new Response(JSON.stringify({ ...result, perfil: PERFILES[perfil], cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[storytelling]', err.message);
    return new Response(JSON.stringify({ error: 'Error generando narrativa.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
