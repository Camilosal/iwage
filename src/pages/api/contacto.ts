import type { APIRoute } from 'astro';

// Contact form submission endpoint
// Validates, stores lead (in-memory for now, Strapi in production), sends notification

interface Lead {
  nombre: string;
  whatsapp: string;
  municipio?: string;
  tipo_proyecto: string;
  mensaje?: string;
  fecha: string;
}

// In-memory store (replace with Strapi/DB in production)
const leads: Lead[] = [];

// Simple rate limiter
const rateLimit = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.reset) {
    rateLimit.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
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
    const body = await request.json();
    const { nombre, whatsapp, municipio, tipo_proyecto, mensaje } = body;

    // Validation
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'El nombre es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!whatsapp || typeof whatsapp !== 'string' || whatsapp.trim().length < 7) {
      return new Response(JSON.stringify({ error: 'El número de WhatsApp es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!tipo_proyecto || typeof tipo_proyecto !== 'string') {
      return new Response(JSON.stringify({ error: 'Selecciona un tipo de proyecto.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store lead
    const lead: Lead = {
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim(),
      municipio: municipio?.trim() || undefined,
      tipo_proyecto,
      mensaje: mensaje?.trim() || undefined,
      fecha: new Date().toISOString(),
    };
    leads.push(lead);

    // TODO: In production, store in Strapi and/or send email notification
    // await strapiClient.create('leads', lead);
    // await sendEmailNotification(lead);

    console.log('[contacto] New lead:', lead.nombre, '-', lead.tipo_proyecto);

    return new Response(JSON.stringify({ success: true, message: 'Mensaje recibido correctamente.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Error al procesar la solicitud.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
