import { useState, useEffect, useCallback } from 'react';
import {
  getCart,
  removeItem,
  updateCantidad,
  clearCart,
  getTotal,
  getCount,
  formatCOP,
  CART_EVENT,
  type CartItem,
} from '../../lib/cart-store';

const RESERVAS_API = import.meta.env.PUBLIC_RESERVAS_API || '';
const WHATSAPP = '573026693366';

const BRAND_LABELS: Record<string, string> = {
  iwage_meliponas: 'Meliponas',
  iwage_cafe: 'Café',
  iwage_naturaleza: 'Naturaleza',
  iwage_gestion: 'Gestión',
  iwage_tierras: 'Tierras',
  iwage_granja: 'Granja',
  meliponas: 'Meliponas',
  cafe: 'Café',
  naturaleza: 'Naturaleza',
  gestion: 'Gestión',
  tierras: 'Tierras',
  granja: 'Granja',
};

interface OrdenReservaOut {
  codigo: string;
  nombre: string;
  precio_total: number;
  tipo_reserva: string;
}

interface OrdenResponse {
  codigo: string;
  estado: string;
  precio_total: number;
  moneda: string;
  checkout_url: string | null;
  reservas: OrdenReservaOut[];
  /** Canal de pago elegido ('online' | 'en_sitio'), null si no aplica pago */
  metodo_pago?: string | null;
  /** Mensaje de fallback cuando la pasarela de pago no responde (la orden queda registrada) */
  pago_error?: string | null;
}

function groupKey(item: CartItem): string {
  return item.brand || item.origen || 'iwage';
}

function brandLabel(item: CartItem): string {
  return BRAND_LABELS[groupKey(item)] || BRAND_LABELS[item.origen] || 'Iwagé';
}

/* ── Inline SVG icons (no lucide dependency after hydration) ── */

function IconCart({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function IconX({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconCheck({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function UnifiedCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  // Canal de pago del checkout: online (Bold) o en el sitio
  const [metodoPago, setMetodoPago] = useState<'online' | 'en_sitio'>('online');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrdenResponse | null>(null);

  const refresh = useCallback(() => setItems(getCart()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(CART_EVENT, handler);
    return () => window.removeEventListener(CART_EVENT, handler);
  }, [refresh]);

  const count = getCount(items);
  const total = getTotal(items);
  const hasPaidItems = items.some((i) => i.requiere_pago);

  // Group items by brand for display
  const groups = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    const k = groupKey(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});

  const handleRemove = (key: string) => setItems(removeItem(key));

  const handleQty = (key: string, delta: number) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    setItems(updateCantidad(key, item.cantidad + delta));
  };

  const whatsappHref = () => {
    const lines = items.map(
      (i) =>
        `• ${i.nombre} ×${i.cantidad}${i.disponibilidad_label ? ` (${i.disponibilidad_label})` : ''} — ${
          i.requiere_pago ? formatCOP(i.precio * i.cantidad) : 'Gratis'
        }`
    );
    const msg = `¡Hola Iwagé! Quiero hacer un pedido:\n\n${lines.join('\n')}\n\nTotal: ${formatCOP(total)}`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nombre.trim().length < 2) {
      setError('Ingresa tu nombre.');
      return;
    }
    if (telefono.trim().length < 7) {
      setError('Ingresa un número de WhatsApp válido.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cliente: { nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim() || undefined, origen: 'iwage' },
        items: items.map((i) => ({
          recurso_slug: i.recurso_slug,
          cantidad_personas: i.cantidad,
          disponibilidad_id: i.disponibilidad_id || undefined,
          fecha_checkin: i.fecha_checkin || undefined,
          fecha_checkout: i.fecha_checkout || undefined,
        })),
        metodo_pago: hasPaidItems ? metodoPago : undefined,
        origen_url: typeof window !== 'undefined' ? window.location.href : undefined,
      };

      const res = await fetch(`${RESERVAS_API}/api/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error procesando la orden');

      const data = json.data as OrdenResponse;
      setResult(data);

      if (data.checkout_url) {
        // Paid order: redirect to Bold gateway
        clearCart();
        window.location.href = data.checkout_url;
      } else {
        // All-free order: confirmed immediately
        clearCart();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirmation screen (all-free orders, en_sitio orders, or paid orders where the gateway failed)
  if (result && !result.checkout_url) {
    const falloPago = !!result.pago_error;
    const esEnSitio = !falloPago && result.metodo_pago === 'en_sitio';
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setResult(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md bg-surface-raised rounded-2xl shadow-2xl z-[61] p-8 text-center">
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${
              falloPago ? 'bg-amber-100 text-amber-600' : 'bg-brand-muted text-brand'
            }`}
          >
            <IconCheck className="w-7 h-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">
            {falloPago ? 'Pedido registrado' : 'Itinerario confirmado'}
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Código: <strong className="text-text-primary">{result.codigo}</strong>
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {falloPago
              ? result.pago_error
              : esEnSitio
                ? `${result.reservas.length} elemento(s) confirmados. Pagas al llegar: ${formatCOP(result.precio_total)} (tarjeta, QR, BreB, efectivo o transferencia). Te contactaremos por WhatsApp.`
                : `${result.reservas.length} elemento(s) agendados. Te contactaremos por WhatsApp para coordinar los detalles.`}
          </p>
          {falloPago && (
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                `Hola, acabo de hacer el pedido ${result.codigo} por ${formatCOP(result.precio_total)}. Quiero coordinar el pago.`
              )}`}
              target="_blank"
              rel="noopener"
              className="mt-4 block w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-light transition-colors"
            >
              Coordinar pago por WhatsApp
            </a>
          )}
          <button
            onClick={() => {
              setResult(null);
              setOpen(false);
            }}
            className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-light transition-colors"
          >
            Listo
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Floating bar ── */}
      {count > 0 && !open && (
        <div className="fixed bottom-5 inset-x-4 z-50 flex justify-center pointer-events-none">
          <button
            onClick={() => setOpen(true)}
            className="animate-cart-pop pointer-events-auto flex items-center gap-3 rounded-full bg-brand text-white pl-5 pr-6 py-3.5 shadow-2xl shadow-black/25 hover:bg-brand-light hover:scale-[1.03] transition-all"
          >
            <span className="relative">
              <IconCart className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                {count}
              </span>
            </span>
            <span className="text-base font-bold">
              {total > 0 ? formatCOP(total) : `${count} item(s)`}
            </span>
            <span className="text-sm font-semibold opacity-90 border-l border-white/30 pl-3">
              {hasPaidItems ? 'Pagar' : 'Ver itinerario'}
            </span>
          </button>
        </div>
      )}

      {/* ── Drawer ── */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[55]" onClick={() => setOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-sm bg-surface-raised z-[56] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <IconCart className="w-5 h-5" />
                Tu itinerario
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-sunken transition-colors"
                aria-label="Cerrar"
              >
                <IconX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {items.length === 0 && (
                <p className="text-sm text-text-muted text-center py-10">Tu carrito está vacío</p>
              )}

              {Object.entries(groups).map(([key, groupItems]) => (
                <div key={key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                    {brandLabel(groupItems[0])}
                  </p>
                  <div className="space-y-3">
                    {groupItems.map((item) => {
                      const editable = item.tipo_disponibilidad === 'inmediato';
                      return (
                        <div key={item.key} className="flex items-start gap-3 p-3 bg-surface-sunken rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary leading-snug">{item.nombre}</p>
                            {item.disponibilidad_label && (
                              <p className="text-xs text-text-secondary mt-0.5">{item.disponibilidad_label}</p>
                            )}
                            <p className="text-xs text-text-muted mt-1">
                              {item.requiere_pago ? formatCOP(item.precio * item.cantidad) : 'Gratis'}
                            </p>

                            {editable ? (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => handleQty(item.key, -1)}
                                  className="w-6 h-6 rounded-full bg-surface-raised border border-border text-text-secondary flex items-center justify-center hover:bg-brand-muted"
                                  aria-label="Restar"
                                >
                                  −
                                </button>
                                <span className="text-sm font-medium text-text-primary w-6 text-center">{item.cantidad}</span>
                                <button
                                  onClick={() => handleQty(item.key, 1)}
                                  className="w-6 h-6 rounded-full bg-surface-raised border border-border text-text-secondary flex items-center justify-center hover:bg-brand-muted"
                                  aria-label="Sumar"
                                >
                                  +
                                </button>
                              </div>
                            ) : item.tipo_disponibilidad !== 'rango_fechas' ? (
                              <p className="text-xs text-text-muted mt-2">{item.cantidad} persona(s)</p>
                            ) : null}
                          </div>

                          <button
                            onClick={() => handleRemove(item.key)}
                            className="text-text-muted hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            aria-label="Eliminar"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="p-5 border-t border-border space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Total acumulado</span>
                  <span className="text-lg font-bold text-text-primary">{formatCOP(total)}</span>
                </div>

                {!checkout ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setCheckout(true)}
                      className="w-full rounded-full bg-brand text-white px-6 py-3 font-semibold hover:bg-brand-light transition-colors"
                    >
                      {hasPaidItems ? 'Pagar en línea' : 'Confirmar itinerario'}
                    </button>
                    <a
                      href={whatsappHref()}
                      target="_blank"
                      rel="noopener"
                      className="block w-full text-center border border-brand text-brand rounded-full px-6 py-3 font-medium hover:bg-brand-muted transition-colors"
                    >
                      Pedir por WhatsApp
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleCheckout} className="space-y-3">
                    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                    {hasPaidItems && (
                      <div className="rounded-lg bg-surface-sunken p-3 space-y-1.5">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name="metodo-pago-cart"
                            checked={metodoPago === 'online'}
                            onChange={() => setMetodoPago('online')}
                            className="mt-0.5 accent-[#52B788]"
                          />
                          <span className="text-xs text-text-secondary">
                            <strong className="text-text-primary">Pagar en línea.</strong> Pago seguro con Bold.
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name="metodo-pago-cart"
                            checked={metodoPago === 'en_sitio'}
                            onChange={() => setMetodoPago('en_sitio')}
                            className="mt-0.5 accent-[#52B788]"
                          />
                          <span className="text-xs text-text-secondary">
                            <strong className="text-text-primary">Pagar en el sitio.</strong> Tarjeta, QR, BreB, efectivo o transferencia al llegar.
                          </span>
                        </label>
                      </div>
                    )}
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                      required
                    />
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Teléfono (WhatsApp)"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                      required
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email (opcional)"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-full bg-brand text-white px-6 py-3 font-semibold hover:bg-brand-light transition-colors disabled:opacity-50"
                    >
                      {loading
                        ? 'Procesando...'
                        : hasPaidItems
                        ? metodoPago === 'en_sitio'
                          ? `Reservar ${formatCOP(total)} (pago en el sitio)`
                          : `Pagar ${formatCOP(total)}`
                        : 'Confirmar itinerario'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckout(false);
                        setError(null);
                      }}
                      className="w-full text-center text-xs text-text-muted hover:text-text-secondary"
                    >
                      Volver
                    </button>
                    <p className="text-[11px] text-text-muted text-center">
                      {hasPaidItems
                        ? metodoPago === 'en_sitio'
                          ? 'Pagas al llegar con tarjeta, QR, BreB, efectivo o transferencia.'
                          : 'Pago seguro con Bold.'
                        : 'Sin pago — coordinamos por WhatsApp.'}
                    </p>
                  </form>
                )}
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
