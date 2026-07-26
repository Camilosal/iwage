const RESERVAS_API = import.meta.env.RESERVAS_API_URL || 'http://reservas_app:4326';

export interface SlotDisponible {
  documentId: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  capacidad_total: number;
  capacidad_disponible: number;
  precio_override: number | null;
}

export interface CrearReservaInput {
  recurso_slug: string;
  disponibilidad_id?: string;
  cliente: {
    nombre: string;
    email?: string;
    telefono?: string;
    documento_tipo?: string;
    documento_numero?: string;
    origen?: string;
  };
  cantidad_personas?: number;
  notas?: string;
  origen_url?: string;
}

export interface ReservaResponse {
  codigo: string;
  estado: string;
  tipo_reserva: string;
  precio_total: number;
  checkout_url: string | null;
  expira_en: string | null;
}

export async function getDisponibilidad(
  recursoSlug: string,
  desde: string,
  hasta: string
): Promise<SlotDisponible[]> {
  const params = new URLSearchParams({ recurso: recursoSlug, desde, hasta });
  const res = await fetch(`${RESERVAS_API}/api/disponibilidad?${params}`);
  if (!res.ok) throw new Error(`Error consultando disponibilidad: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function crearReserva(payload: CrearReservaInput): Promise<ReservaResponse> {
  const res = await fetch(`${RESERVAS_API}/api/reservas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Error creando reserva: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function getReserva(codigo: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${RESERVAS_API}/api/reservas/${codigo}`);
  if (!res.ok) throw new Error(`Error consultando reserva: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function cancelarReserva(codigo: string, motivo: string): Promise<void> {
  const res = await fetch(`${RESERVAS_API}/api/reservas/${codigo}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Error cancelando reserva: ${res.status}`);
  }
}

export async function getEstadoPago(referenceId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${RESERVAS_API}/api/pagos/${referenceId}/estado`);
  if (!res.ok) throw new Error(`Error consultando pago: ${res.status}`);
  const json = await res.json();
  return json.data;
}
