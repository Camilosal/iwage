/**
 * POST /api/pedido
 * Recibe un pedido de la tienda y lo procesa.
 * Persiste la orden en app_reservas (visible en /mi-cuenta/pedidos), notifica por
 * email (SES) y genera la URL de WhatsApp con el resumen del pedido como confirmación.
 * Futuro: integrar con pasarela de pago.
 */
import type { APIRoute } from 'astro';
import { enviarNotificacion, tablaDatos, escapeHtml } from '@/lib/mailer';
import { registrarContacto } from '@/lib/contacts';

const RESERVAS_API = import.meta.env.RESERVAS_API_URL || 'http://reservas_app:4326';

/** Registra el pedido como orden en app_reservas (best-effort, no bloquea el flujo WhatsApp). */
async function persistirOrden(items: any[], cliente: any, origenUrl: string | null): Promise<string | null> {
  if (!cliente?.nombre || (!cliente?.telefono && !cliente?.email)) return null;
  try {
    const res = await fetch(`${RESERVAS_API}/api/ordenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: cliente.nombre,
          telefono: cliente.telefono || null,
          email: cliente.email || null,
          origen: 'iwage',
        },
        pedido_items: items.map((item: any) => ({
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
        })),
        notas: cliente.direccion ? `Dirección de entrega: ${cliente.direccion}` : null,
        origen_url: origenUrl,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.codigo || null;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { items, cliente } = body;

    // Validate
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El pedido debe tener al menos un producto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate total
    const total = items.reduce((sum: number, item: any) => sum + (item.precio * item.cantidad), 0);

    // Persistir la orden en app_reservas para que aparezca en /mi-cuenta/pedidos
    const ordenCodigo = await persistirOrden(items, cliente, request.headers.get('referer'));

    // Notificación por email (SES) — best-effort, no bloquea la respuesta al usuario
    const itemsHtml = items
      .map((item: any) => `<li>${escapeHtml(String(item.nombre))} ×${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es-CO')}</li>`)
      .join('');
    enviarNotificacion({
      asunto: `[Iwagé] Nuevo pedido${ordenCodigo ? ` ${ordenCodigo}` : ''} — $${total.toLocaleString('es-CO')} COP`,
      html: `
        <h2 style="font-family:sans-serif;">Nuevo pedido en la tienda de iwage.co</h2>
        ${tablaDatos([
          ['Código', ordenCodigo || 'Sin código (no se registró en reservas)'],
          ['Cliente', cliente?.nombre],
          ['Teléfono', cliente?.telefono],
          ['Email', cliente?.email],
          ['Dirección', cliente?.direccion],
          ['Total', `$${total.toLocaleString('es-CO')} COP`],
        ])}
        <h3 style="font-family:sans-serif;">Productos</h3>
        <ul style="font-family:sans-serif;">${itemsHtml}</ul>
      `,
      texto: `Nuevo pedido Iwagé${ordenCodigo ? ` (${ordenCodigo})` : ''}\nCliente: ${cliente?.nombre || '-'}\nTotal: $${total.toLocaleString('es-CO')} COP\nItems: ${items.length}`,
      replyTo: cliente?.email || undefined,
    }).catch(() => {});

    // Registrar cliente en sistema centralizado (form-handler DB) + Listmonk
    if (cliente?.nombre) {
      registrarContacto({
        nombre: cliente.nombre,
        email: cliente.email || undefined,
        telefono: cliente.telefono || undefined,
        mensaje: `Pedido${ordenCodigo ? ` ${ordenCodigo}` : ''}: ${items.length} producto(s) por $${total.toLocaleString('es-CO')} COP`,
        tipo_proyecto: 'Pedido tienda',
        fuente: 'iwage-pedido',
      }).catch(() => {});
    }

    // Build WhatsApp message
    const whatsapp = (process.env.WHATSAPP_NUMBER || '+573026693366').replace(/\+/g, '');
    const lines = items.map((item: any) => `• ${item.nombre} ×${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es-CO')}`);
    const clienteInfo = cliente
      ? `\n\nCliente: ${cliente.nombre || ''}${cliente.telefono ? ` · Tel: ${cliente.telefono}` : ''}${cliente.direccion ? ` · Dir: ${cliente.direccion}` : ''}`
      : '';
    const referencia = ordenCodigo ? `\nPedido: ${ordenCodigo}` : '';
    const msg = `¡Hola Iwagé! Nuevo pedido:\n\n${lines.join('\n')}\n\nTotal: $${total.toLocaleString('es-CO')}${referencia}${clienteInfo}`;

    const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`;

    return new Response(JSON.stringify({
      success: true,
      total,
      whatsapp_url: whatsappUrl,
      orden_codigo: ordenCodigo,
      resumen: {
        items: items.length,
        total,
        moneda: 'COP',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error al procesar el pedido' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
