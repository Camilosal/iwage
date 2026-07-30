import type { APIRoute } from 'astro';
import { enviarNotificacion, tablaDatos, escapeHtml } from '@/lib/mailer';
import { registrarContacto } from '@/lib/contacts';

// Contact form submission endpoint
// Validates, stores lead, sends notification, persists to centralized CRM + Listmonk

interface Lead {
  nombre: string;
  email?: string;
  whatsapp: string;
  municipio?: string;
  tipo_proyecto: string;
  mensaje?: string;
  fecha: string;
}

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
    const { nombre, email, whatsapp, municipio, tipo_proyecto, mensaje } = body;

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

    // Build lead
    const lead: Lead = {
      nombre: nombre.trim(),
      email: (typeof email === 'string' && email.includes('@')) ? email.trim() : undefined,
      whatsapp: whatsapp.trim(),
      municipio: municipio?.trim() || undefined,
      tipo_proyecto,
      mensaje: mensaje?.trim() || undefined,
      fecha: new Date().toISOString(),
    };

    // Notificación por email (SES) — best-effort, no bloquea la respuesta al usuario
    enviarNotificacion({
      asunto: `[Iwagé] Nuevo contacto: ${lead.nombre} — ${lead.tipo_proyecto}`,
      html: `
        <h2 style="font-family:sans-serif;">Nuevo mensaje de contacto en iwage.co</h2>
        ${tablaDatos([
          ['Nombre', lead.nombre],
          ['Email', lead.email],
          ['WhatsApp', lead.whatsapp],
          ['Municipio', lead.municipio],
          ['Tipo de proyecto', lead.tipo_proyecto],
          ['Fecha', lead.fecha],
        ])}
        ${lead.mensaje ? `<p style="font-family:sans-serif;"><strong>Mensaje:</strong><br>${escapeHtml(lead.mensaje)}</p>` : ''}
      `,
      texto: `Nuevo contacto Iwagé\nNombre: ${lead.nombre}\nEmail: ${lead.email || '-'}\nWhatsApp: ${lead.whatsapp}\nMunicipio: ${lead.municipio || '-'}\nTipo: ${lead.tipo_proyecto}\nMensaje: ${lead.mensaje || '-'}`,
    }).catch(() => {});

    // Persistir en sistema centralizado (form-handler DB) + suscribir a Listmonk
    registrarContacto({
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.whatsapp,
      municipio: lead.municipio,
      tipo_proyecto: lead.tipo_proyecto,
      mensaje: lead.mensaje,
      fuente: 'iwage-contacto',
    }).catch(() => {});

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
