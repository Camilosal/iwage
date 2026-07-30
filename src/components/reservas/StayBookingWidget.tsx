/**
 * StayBookingWidget — reserva de estadías por rango de fechas (alojamientos).
 *
 * A diferencia de BookingWidget (slot_horario), este widget valida en vivo
 * contra /api/disponibilidad/rango (modelo abierto-salvo-bloqueo), calcula
 * el total por noches y permite agregar al carrito o reservar+pagar directo.
 */
import { useState, useEffect } from 'react';
import { addItem } from '../../lib/cart-store';
import type { ReservaResponse } from '../../lib/reservas';

const RESERVAS_API = import.meta.env.PUBLIC_RESERVAS_API || '';
const WHATSAPP = '573026693366';

interface Props {
  recursoSlug: string;
  recursoNombre: string;
  precioNoche: number;
  capacidadMaxima: number;
  origen: string;
  initialCheckin?: string;
  initialCheckout?: string;
  initialHuespedes?: number;
}

interface RangoInfo {
  disponible: boolean;
  noches: number;
  precio_noche: number;
  precio_total: number;
  fechas_bloqueadas: string[];
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Suma días a una fecha ISO usando UTC para evitar corrimientos de zona horaria. */
function sumaDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().split('T')[0];
}

function fmtFecha(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

function fmtCOP(n: number): string {
  return `$${n.toLocaleString('es-CO')}`;
}

export default function StayBookingWidget({
  recursoSlug,
  recursoNombre,
  precioNoche,
  capacidadMaxima,
  origen,
  initialCheckin,
  initialCheckout,
  initialHuespedes,
}: Props) {
  const [checkin, setCheckin] = useState(initialCheckin || '');
  const [checkout, setCheckout] = useState(initialCheckout || '');
  const [huespedes, setHuespedes] = useState(
    initialHuespedes && initialHuespedes >= 1
      ? Math.min(initialHuespedes, capacidadMaxima)
      : 1
  );

  const [rango, setRango] = useState<RangoInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [rangoError, setRangoError] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  // Canal de pago para reserva directa: online (Bold) o en el sitio
  const [metodoPago, setMetodoPago] = useState<'online' | 'en_sitio'>('online');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReservaResponse | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  // Validación en vivo de disponibilidad al cambiar las fechas (con debounce)
  useEffect(() => {
    setRango(null);
    setRangoError(null);
    if (!checkin || !checkout || checkout <= checkin) return;

    setChecking(true);
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ recurso: recursoSlug, desde: checkin, hasta: checkout });
      fetch(`${RESERVAS_API}/api/disponibilidad/rango?${params}`)
        .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
        .then(({ ok, json }) => {
          if (ok && json.data) {
            setRango(json.data as RangoInfo);
          } else {
            setRangoError(json.error || 'No se pudo validar la disponibilidad');
          }
        })
        .catch(() => setRangoError('No se pudo consultar disponibilidad. Intenta de nuevo.'))
        .finally(() => setChecking(false));
    }, 350);

    return () => window.clearTimeout(t);
  }, [recursoSlug, checkin, checkout]);

  const handleCheckinChange = (value: string) => {
    setCheckin(value);
    // La salida siempre debe ser posterior a la llegada
    if (value && (!checkout || checkout <= value)) {
      setCheckout(sumaDias(value, 1));
    }
  };

  const fechasValidas = !!checkin && !!checkout && checkout > checkin;

  const handleAddToCart = () => {
    if (!fechasValidas) {
      setError('Selecciona fechas válidas de llegada y salida.');
      return;
    }
    if (checking || !rango) {
      setError('Estamos validando la disponibilidad, espera un momento.');
      return;
    }
    if (!rango.disponible) {
      setError('El alojamiento no está disponible en esas fechas.');
      return;
    }
    setError(null);

    const brand = origen.replace(/^iwage_/, '');
    addItem({
      recurso_slug: recursoSlug,
      nombre: recursoNombre,
      precio: rango.precio_total || precioNoche * rango.noches,
      cantidad: 1,
      tipo: 'propiedad_estancia',
      tipo_disponibilidad: 'rango_fechas',
      brand,
      origen,
      requiere_pago: true,
      disponibilidad_label: `${fmtFecha(checkin)} → ${fmtFecha(checkout)} · ${rango.noches} noche(s) · ${huespedes} huésped(es)`,
      fecha_checkin: checkin,
      fecha_checkout: checkout,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechasValidas) {
      setError('Selecciona fechas válidas de llegada y salida.');
      return;
    }
    if (!rango?.disponible) {
      setError('Valida la disponibilidad para esas fechas antes de reservar.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${RESERVAS_API}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurso_slug: recursoSlug,
          // 'iwage' es el origen de cliente admitido por el schema; el origen
          // del recurso (iwage_gestion) ya viaja en el recurso_slug
          cliente: { nombre, telefono, email, origen: 'iwage' },
          cantidad_personas: huespedes,
          fecha_checkin: checkin,
          fecha_checkout: checkout,
          metodo_pago: precioNoche > 0 ? metodoPago : undefined,
          origen_url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error creando la reserva');
      setResult(json.data);

      if (json.data.checkout_url) {
        window.location.href = json.data.checkout_url;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de resultado (sin redirect de pago)
  if (result && !result.checkout_url) {
    const esEnSitio = result.metodo_pago === 'en_sitio';
    const waMsg = encodeURIComponent(
      `Hola, acabo de hacer la reserva ${result.codigo} para "${recursoNombre}" ` +
        `(${fmtFecha(checkin)} → ${fmtFecha(checkout)}, ${rango?.noches ?? ''} noches, ` +
        `${huespedes} huésped(es)). Quedo atento(a) para coordinar el pago.`
    );
    return (
      <div
        className={`rounded-xl border p-6 text-center ${
          result.pago_error ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
        }`}
      >
        <h3 className={`text-lg font-semibold ${result.pago_error ? 'text-amber-800' : 'text-green-800'}`}>
          {result.pago_error ? 'Reserva registrada' : 'Reserva confirmada'}
        </h3>
        <p className={`mt-2 ${result.pago_error ? 'text-amber-700' : 'text-green-700'}`}>
          Código: <strong>{result.codigo}</strong>
        </p>
        <p className={`mt-1 text-sm ${result.pago_error ? 'text-amber-600' : 'text-green-600'}`}>
          {result.pago_error ||
            (esEnSitio
              ? `Pagas al llegar: ${fmtCOP(Number(result.precio_total) || 0)} COP (tarjeta, QR, BreB, efectivo o transferencia). Te enviaremos los detalles por WhatsApp.`
              : 'Te enviaremos los detalles por WhatsApp.')}
        </p>
        {result.pago_error && (
          <a
            href={`https://wa.me/${WHATSAPP}?text=${waMsg}`}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-block w-full rounded-full bg-[#52B788] px-6 py-3 text-sm font-bold text-[#0c1520] transition hover:bg-[#7fc4a2]"
          >
            Coordinar pago por WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Llegada
          </label>
          <input
            type="date"
            value={checkin}
            min={hoyISO()}
            onChange={(e) => handleCheckinChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Salida
          </label>
          <input
            type="date"
            value={checkout}
            min={checkin ? sumaDias(checkin, 1) : hoyISO()}
            onChange={(e) => setCheckout(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
            required
          />
        </div>
      </div>

      {/* Huéspedes */}
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Huéspedes
        </label>
        <select
          value={huespedes}
          onChange={(e) => setHuespedes(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
        >
          {Array.from({ length: capacidadMaxima }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} huésped{n > 1 ? 'es' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Disponibilidad en vivo + resumen de precio */}
      {(checking || rango || rangoError) && (
        <div className="rounded-lg border border-gray-100 bg-[#f8f9fb] p-3 text-sm">
          {checking && <span className="text-gray-500">Consultando disponibilidad…</span>}
          {!checking && rangoError && <span className="text-amber-700">{rangoError}</span>}
          {!checking && rango && rango.disponible && (
            <div>
              <span className="mb-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                ✓ Disponible
              </span>
              <p className="text-xs text-gray-600">
                {rango.noches} noche{rango.noches > 1 ? 's' : ''} × {fmtCOP(precioNoche)} ={' '}
                <strong className="text-[#122640]">{fmtCOP(rango.precio_total || precioNoche * rango.noches)}</strong>
              </p>
            </div>
          )}
          {!checking && rango && !rango.disponible && (
            <div>
              <span className="mb-1 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                ✗ No disponible en esas fechas
              </span>
              {rango.fechas_bloqueadas && rango.fechas_bloqueadas.length > 0 && (
                <p className="text-xs text-gray-500">
                  Fechas ocupadas: {rango.fechas_bloqueadas.map(fmtFecha).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Datos de contacto */}
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Nombre completo
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Teléfono (WhatsApp)
        </label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="3001234567"
          className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Email (opcional)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-[#f8f9fb] px-2.5 py-2 text-sm text-[#122640] outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]"
        />
      </div>

      {rango?.disponible && precioNoche > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Total: <strong>{fmtCOP(rango.precio_total || precioNoche * rango.noches)} COP</strong>
          <div className="mt-2 space-y-1.5">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name={`metodo-pago-${recursoSlug}`}
                checked={metodoPago === 'online'}
                onChange={() => setMetodoPago('online')}
                className="mt-0.5 accent-emerald-700"
              />
              <span className="text-xs">
                <strong>Pagar en línea.</strong> Pago seguro con Bold.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name={`metodo-pago-${recursoSlug}`}
                checked={metodoPago === 'en_sitio'}
                onChange={() => setMetodoPago('en_sitio')}
                className="mt-0.5 accent-emerald-700"
              />
              <span className="text-xs">
                <strong>Pagar en el sitio.</strong> Tarjeta, QR, BreB, efectivo o transferencia al llegar.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Primario: agregar al carrito unificado */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={addedToCart}
        className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-70"
      >
        {addedToCart ? '✓ Agregado al carrito' : 'Agregar al carrito'}
      </button>

      {/* Secundario: reserva + pago directo */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
      >
        {loading
          ? 'Procesando...'
          : metodoPago === 'en_sitio'
            ? 'Reservar (pago en el sitio)'
            : 'Reservar y pagar directo'}
      </button>
    </form>
  );
}
