/**
 * POST /api/pedido
 * Recibe un pedido de la tienda y lo procesa.
 * Actualmente genera la URL de WhatsApp con el resumen del pedido.
 * Futuro: integrar con pasarela de pago o notificación por email.
 */
import type { APIRoute } from 'astro';

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

    // Build WhatsApp message
    const whatsapp = (process.env.WHATSAPP_NUMBER || '+573001234567').replace(/\+/g, '');
    const lines = items.map((item: any) => `• ${item.nombre} ×${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString('es-CO')}`);
    const clienteInfo = cliente
      ? `\n\nCliente: ${cliente.nombre || ''}${cliente.telefono ? ` · Tel: ${cliente.telefono}` : ''}${cliente.direccion ? ` · Dir: ${cliente.direccion}` : ''}`
      : '';
    const msg = `¡Hola Iwagé! Nuevo pedido:\n\n${lines.join('\n')}\n\nTotal: $${total.toLocaleString('es-CO')}${clienteInfo}`;

    const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`;

    return new Response(JSON.stringify({
      success: true,
      total,
      whatsapp_url: whatsappUrl,
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
