import { useState, useEffect } from 'react';
import type { SlotDisponible, CrearReservaInput, ReservaResponse } from '../../lib/reservas';
import { addItem } from '../../lib/cart-store';

export interface AnfitrionOption {
  slug: string;
  nombre: string;
  precio_personalizado?: number | null;
}

interface Props {
  recursoSlug: string;
  recursoNombre: string;
  precioBase: number;
  capacidadMaxima: number;
  requierePago: boolean;
  origen: string;
  anfitriones?: AnfitrionOption[];
}

export default function BookingWidget({
  recursoSlug,
  recursoNombre,
  precioBase,
  capacidadMaxima,
  requierePago,
  origen,
  anfitriones,
}: Props) {
  const [slots, setSlots] = useState<SlotDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [personas, setPersonas] = useState(1);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [anfitrionSel, setAnfitrionSel] = useState<string>('');
  const [result, setResult] = useState<ReservaResponse | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const hoy = new Date();
    const desde = hoy.toISOString().split('T')[0];
    const hasta = new Date(hoy.getTime() + 30 * 86400000).toISOString().split('T')[0];

    fetch(`${import.meta.env.PUBLIC_RESERVAS_API || ''}/api/disponibilidad?recurso=${recursoSlug}&desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((json) => setSlots(json.data || []))
      .catch(() => setSlots([]));
  }, [recursoSlug]);

  // Allow external vanilla JS (e.g. "Reservar con X" buttons) to pre-select an anfitrión.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.recursoSlug === recursoSlug && detail.anfitrionSlug) {
        setAnfitrionSel(detail.anfitrionSlug);
      }
    };
    document.addEventListener('iwage:preselect-anfitrion', handler);
    return () => document.removeEventListener('iwage:preselect-anfitrion', handler);
  }, [recursoSlug]);

  const selectedSlotObj = slots.find((s) => s.documentId === selectedSlot);

  const handleAddToCart = () => {
    if (slots.length > 0 && !selectedSlot) {
      setError('Selecciona un horario para agregar al carrito.');
      return;
    }
    setError(null);
    const brand = origen.replace(/^iwage_/, '');
    addItem({
      recurso_slug: recursoSlug,
      nombre: recursoNombre,
      precio: precioBase,
      cantidad: personas,
      tipo: 'reserva',
      tipo_disponibilidad: 'slot_horario',
      brand,
      origen,
      requiere_pago: requierePago,
      disponibilidad_id: selectedSlot || undefined,
      disponibilidad_label: selectedSlotObj
        ? `${selectedSlotObj.fecha} — ${selectedSlotObj.hora_inicio} a ${selectedSlotObj.hora_fin}`
        : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const anfitrionNombre = anfitriones?.find((a) => a.slug === anfitrionSel)?.nombre;
    const notas = anfitrionNombre ? `Anfitrión de preferencia: ${anfitrionNombre}` : undefined;

    const payload: CrearReservaInput = {
      recurso_slug: recursoSlug,
      disponibilidad_id: selectedSlot || undefined,
      cliente: { nombre, telefono, email, origen },
      cantidad_personas: personas,
      notas,
      origen_url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    try {
      const res = await fetch(`${import.meta.env.PUBLIC_RESERVAS_API || ''}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
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

  if (result && !result.checkout_url) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <h3 className="text-lg font-semibold text-green-800">Reserva confirmada</h3>
        <p className="mt-2 text-green-700">
          Codigo: <strong>{result.codigo}</strong>
        </p>
        <p className="mt-1 text-sm text-green-600">
          Te enviaremos los detalles por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {slots.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
          <select
            value={selectedSlot || ''}
            onChange={(e) => setSelectedSlot(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Selecciona un horario</option>
            {slots.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.fecha} — {s.hora_inicio} a {s.hora_fin} ({s.capacidad_disponible} cupos)
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Personas</label>
        <input
          type="number"
          min={1}
          max={capacidadMaxima}
          value={personas}
          onChange={(e) => setPersonas(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono (WhatsApp)</label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="3001234567"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {anfitriones && anfitriones.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anfitrión de preferencia (opcional)</label>
          <select
            id={`anfitrion-select-${recursoSlug}`}
            value={anfitrionSel}
            onChange={(e) => setAnfitrionSel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin preferencia</option>
            {anfitriones.map((a) => (
              <option key={a.slug} value={a.slug} data-slug={a.slug}>
                {a.nombre}
                {a.precio_personalizado ? ` — $${a.precio_personalizado.toLocaleString('es-CO')}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {requierePago && precioBase > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Total: <strong>${(precioBase * personas).toLocaleString('es-CO')} COP</strong>
          <br />
          <span className="text-xs">Se te redirigira a la pasarela de pago Bold.</span>
        </div>
      )}

      {/* Primary: add to unified cart */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={addedToCart}
        className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-70"
      >
        {addedToCart ? '✓ Agregado al carrito' : 'Agregar al carrito'}
      </button>

      {/* Secondary: direct reservation + payment */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
      >
        {loading ? 'Procesando...' : requierePago ? 'Reservar y pagar directo' : 'Reservar gratis directo'}
      </button>
    </form>
  );
}
