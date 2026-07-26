import { useState, useEffect } from 'react';

interface Props {
  codigo: string;
}

export default function ReservationConfirmed({ codigo }: Props) {
  const [reserva, setReserva] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codigo) return;
    fetch(`${import.meta.env.PUBLIC_RESERVAS_API || ''}/api/reservas/${codigo}`)
      .then((r) => r.json())
      .then((json) => setReserva(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Consultando reserva...</div>;
  }

  if (!reserva) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No se encontro la reserva con codigo {codigo}</p>
      </div>
    );
  }

  const estado = reserva.estado as string;
  const estadoStyles: Record<string, string> = {
    confirmada: 'bg-green-100 text-green-800',
    pendiente_pago: 'bg-amber-100 text-amber-800',
    cancelada: 'bg-red-100 text-red-800',
    expirada: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border p-6 text-center">
      <div className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${estadoStyles[estado] || 'bg-gray-100'}`}>
        {estado.replace('_', ' ')}
      </div>
      <h2 className="mt-4 text-xl font-bold">Codigo: {codigo}</h2>
      {reserva.fecha_reserva && (
        <p className="mt-2 text-gray-600">
          Fecha: {reserva.fecha_reserva as string} {reserva.hora_inicio ? `— ${reserva.hora_inicio}` : ''}
        </p>
      )}
      <p className="mt-2 text-sm text-gray-500">
        {reserva.cantidad_personas as number} persona(s)
      </p>
    </div>
  );
}
