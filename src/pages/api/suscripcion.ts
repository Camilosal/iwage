import type { APIRoute } from 'astro';
import { subscribirListmonk } from '@/lib/contacts';

/**
 * POST /api/suscripcion
 * Alta en la lista de campañas desde las bandas de suscripción del sitio.
 * Sólo pide el correo: la lista es de interés (no de leads comerciales), así que
 * el email basta para dar de alta al suscriptor.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) return json({ error: 'Demasiadas solicitudes. Espera un momento.' }, 429);

  let email = '';
  let marca = '';
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    marca = typeof body.marca === 'string' ? body.marca.trim() : '';
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  if (!EMAIL.test(email)) return json({ error: 'Escribe un correo válido.' }, 400);

  const suscrito = await subscribirListmonk({
    nombre: email.split('@')[0],
    email,
    marca: marca || undefined,
    fuente: 'iwage-contacto',
  });
  if (!suscrito) return json({ error: 'No pudimos registrarte. Intenta de nuevo.' }, 502);

  console.log('[suscripcion] Alta:', email, marca ? `(${marca})` : '');
  return json({ success: true, message: 'Listo, ya estás en la lista.' }, 200);
};
