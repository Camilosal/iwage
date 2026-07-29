/**
 * Lifecycle hooks for Experiencia — auto-sync to app_reservas.
 * Fire-and-forget: no bloquea la operación de Strapi si reservas no responde.
 */

const RESERVAS_API = process.env.RESERVAS_API_URL || 'http://reservas_app:4326';

interface ResultData {
  id?: number;
  documentId?: string;
  slug?: string;
  titulo?: string;
  precio_desde?: number;
  duracion?: string;
  cupo_maximo_desc?: string;
  publicado?: boolean;
}

function parseDurationMinutes(dur?: string): number | null {
  if (!dur) return null;
  const lower = String(dur).toLowerCase();
  const nums = lower.match(/\d+/g);
  if (!nums) return null;
  if (lower.includes('hora')) {
    const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.round(avg * 60);
  }
  if (lower.includes('día') || lower.includes('dia')) {
    const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.round(avg * 24 * 60);
  }
  return null;
}

async function syncToReservas(result: ResultData): Promise<void> {
  if (!result.slug || !result.titulo) return;
  // Solo sincronizar experiencias publicadas
  if (result.publicado === false) return;

  const durMin = parseDurationMinutes(result.duracion);
  const capacidad = parseInt(result.cupo_maximo_desc || '') || 8;

  const payload = {
    nombre: result.titulo,
    slug: result.slug,
    tipo: 'experiencia',
    origen: 'iwage_naturaleza',
    origen_slug: result.slug,
    requiere_pago: true,
    precio_base: result.precio_desde || null,
    moneda: 'COP',
    capacidad_maxima: capacidad,
    duracion_minutos: durMin,
    tipo_disponibilidad: 'slot_horario',
    config_disponibilidad: {
      dias_semana: [1, 2, 3, 4, 5, 6, 7],
      hora_apertura: '06:00',
      hora_cierre: '18:00',
      duracion_slot_minutos: durMin || 300,
      intervalo_entre_slots_minutos: 30,
      capacidad_por_slot: capacidad,
      anticipacion_minima_horas: 24,
      max_reservas_por_cliente: 3,
      bloqueos: [],
    },
    url_publica: `https://iwage.co/naturaleza/experiencias/${result.slug}`,
  };

  try {
    const res = await fetch(`${RESERVAS_API}/api/admin/recursos/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const strapi = (global as any).strapi;
      strapi?.log?.warn(`[reservas-sync] experiencia#${result.slug}: HTTP ${res.status}`);
    }
  } catch (e: any) {
    const strapi = (global as any).strapi;
    strapi?.log?.warn(`[reservas-sync] experiencia#${result.slug}: ${e.message}`);
  }
}

export default {
  async afterCreate(event: { result: ResultData }) {
    setImmediate(() => syncToReservas(event.result));
  },
  async afterUpdate(event: { result: ResultData }) {
    setImmediate(() => syncToReservas(event.result));
  },
};
