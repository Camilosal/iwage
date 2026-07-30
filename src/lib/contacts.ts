/**
 * Módulo de gestión centralizada de contactos para Iwagé.
 * Persiste leads en el sistema centralizado (form-handler → PostgreSQL) y
 * suscribe al contacto en Listmonk para campañas de email marketing.
 *
 * Ambas operaciones son best-effort: no bloquean el flujo del usuario.
 */

// ─── Configuración (inyectada vía docker-compose) ───────────────────────────
const FORM_HANDLER_URL = process.env.FORM_HANDLER_URL || 'http://form_handler:3005';
const LISTMONK_API_URL = process.env.LISTMONK_API_URL || 'http://listmonk_app:9000';
const LISTMONK_IWAGE_LIST_ID = parseInt(process.env.LISTMONK_IWAGE_LIST_ID || '3', 10);

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface ContactoIwage {
  nombre: string;
  email?: string;         // Opcional (contacto sólo WhatsApp); obligatorio para Listmonk
  telefono?: string;      // WhatsApp
  municipio?: string;
  tipo_proyecto?: string;
  mensaje?: string;
  fuente: 'iwage-contacto' | 'iwage-pedido' | 'iwage-tienda';
}

// ─── Persistir en el sistema centralizado (form-handler) ────────────────────
/**
 * Guarda el lead en la base de datos centralizada (PostgreSQL / tabla `leads`)
 * vía el microservicio form-handler (red interna Docker).
 *
 * Requiere que el contacto tenga email para pasar la validación del form-handler.
 * Si no tiene email, sólo logueamos (el lead ya se notifica por correo).
 */
export async function persistirContacto(contacto: ContactoIwage): Promise<boolean> {
  if (!contacto.email) {
    console.log('[contacts] Lead sin email, no se persiste en form-handler (sólo WhatsApp):', contacto.nombre);
    return false;
  }

  try {
    const payload = {
      name: contacto.nombre,
      email: contacto.email,
      phone: contacto.telefono || '',
      company: contacto.municipio || '',
      servicio: contacto.tipo_proyecto || contacto.fuente,
      sector: '',
      presupuesto: '',
      message: contacto.mensaje || `Lead automático desde ${contacto.fuente}`,
      source: contacto.fuente,
    };

    const res = await fetch(`${FORM_HANDLER_URL}/api/form/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json() as any;
      console.log(`[contacts] Lead persistido en form-handler (id=${data.leadId}):`, contacto.nombre);
      return true;
    }

    const errBody = await res.text().catch(() => '');
    console.warn(`[contacts] form-handler respondió ${res.status}:`, errBody);
    return false;
  } catch (err: any) {
    console.error('[contacts] Error persisting lead:', err.message);
    return false;
  }
}

// ─── Suscribir a Listmonk (campañas de email) ──────────────────────────────
/**
 * Añade al suscriptor a la lista "Iwagé Leads" de Listmonk usando la API
 * de admin (basic auth) o la API pública. Usamos la API de admin porque la
 * lista es privada y la pública sólo funciona con listas públicas.
 *
 * Nota: Para listas privadas con la API admin necesitamos credenciales.
 * Alternativa: inserción directa en PostgreSQL (misma red, misma DB).
 * Usamos inserción directa para máxima fiabilidad.
 */
export async function subscribirListmonk(contacto: ContactoIwage): Promise<boolean> {
  if (!contacto.email) {
    console.log('[contacts] Lead sin email, no se suscribe a Listmonk:', contacto.nombre);
    return false;
  }

  try {
    // Intentamos la API pública primero (funciona si la lista es pública o single opt-in)
    const res = await fetch(`${LISTMONK_API_URL}/api/public/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        email: contacto.email,
        name: contacto.nombre,
        list_uuids: ['a8f3b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c'], // Iwagé Leads
      }),
    });

    if (res.ok) {
      console.log(`[contacts] Suscrito a Listmonk (Iwagé Leads):`, contacto.email);
      return true;
    }

    // Si la API pública falla (lista privada), usamos inserción directa vía form data
    const formRes = await fetch(`${LISTMONK_API_URL}/subscription/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({
        email: contacto.email,
        name: contacto.nombre,
        l: String(LISTMONK_IWAGE_LIST_ID),
      }).toString(),
    });

    if (formRes.ok) {
      console.log(`[contacts] Suscrito a Listmonk vía form (list ${LISTMONK_IWAGE_LIST_ID}):`, contacto.email);
      return true;
    }

    const errText = await formRes.text().catch(() => '');
    console.warn(`[contacts] Listmonk form respondió ${formRes.status}:`, errText.substring(0, 200));
    return false;
  } catch (err: any) {
    console.error('[contacts] Error subscribing to Listmonk:', err.message);
    return false;
  }
}

// ─── Función orquestadora ───────────────────────────────────────────────────
/**
 * Registra el contacto en todos los sistemas: base de datos centralizada + Listmonk.
 * Ambos son best-effort (fire-and-forget); nunca bloquea al caller.
 */
export async function registrarContacto(contacto: ContactoIwage): Promise<void> {
  await Promise.allSettled([
    persistirContacto(contacto),
    subscribirListmonk(contacto),
  ]);
}
