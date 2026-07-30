/**
 * Lifecycle hooks for Propiedad en Gestión — auto-sync to app_reservas.
 * Solo propiedades activas se sincronizan como reservables.
 * Fire-and-forget: no bloquea la operación de Strapi si reservas no responde.
 *
 * Las propiedades con precio_noche se sincronizan como rango_fechas
 * (modelo abierto-salvo-bloqueo, sin slots pre-generados).
 */

const RESERVAS_API = process.env.RESERVAS_API_URL || 'http://reservas_app:4326';
const SYNC_TOKEN = process.env.RESERVAS_SYNC_TOKEN || '';

interface ResultData {
  id?: number;
  documentId?: string;
  slug?: string;
  titulo?: string;
  precio_noche?: number;
  capacidad_huespedes?: number;
  tipo_gestion?: string;
  estado?: string;
}

async function syncToReservas(result: ResultData): Promise<void> {
  if (!result.slug || !result.titulo) return;
  // Solo sincronizar propiedades activas
  if (result.estado && result.estado !== 'activa') return;

  const requierePago = !!result.precio_noche;

  const payload = {
    nombre: result.titulo,
    slug: result.slug,
    tipo: 'propiedad_estancia',
    origen: 'iwage_gestion',
    origen_slug: result.slug,
    requiere_pago: requierePago,
    precio_base: result.precio_noche || null,
    moneda: 'COP',
    capacidad_maxima: result.capacidad_huespedes || 10,
    duracion_minutos: 1440, // 1 noche
    tipo_disponibilidad: requierePago ? 'rango_fechas' : 'bajo_consulta',
    config_disponibilidad: null, // rango_fechas usa modelo abierto-salvo-bloqueo
    url_publica: `https://iwage.co/gestion/propiedades/${result.slug}`,
    metadata: { tipo_gestion: result.tipo_gestion },
  };

  try {
    const res = await fetch(`${RESERVAS_API}/api/admin/recursos/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Token': SYNC_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const strapi = (global as any).strapi;
      strapi?.log?.warn(`[reservas-sync] propiedad-gestion#${result.slug}: HTTP ${res.status}`);
    }
  } catch (e: any) {
    const strapi = (global as any).strapi;
    strapi?.log?.warn(`[reservas-sync] propiedad-gestion#${result.slug}: ${e.message}`);
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
