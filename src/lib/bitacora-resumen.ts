/**
 * Agrupación pura del resumen de bitácoras, sin Strapi ni Redis.
 * Vive aparte de `bitacora.ts` para que `node --test` pueda importarla sobre el
 * repositorio (el host no tiene node_modules y `bitacora.ts` arrastra ioredis).
 */
import type { EntradaBitacora, Marca } from './bitacora';

export interface ResumenBitacora {
  total: number;
  porMarca: Partial<Record<Marca, { count: number; ultimas: EntradaBitacora[] }>>;
  recientes: EntradaBitacora[];
}

const MARCAS: string[] = ['tierras', 'naturaleza', 'meliponas', 'cafe', 'gestion', 'granja'];

/**
 * Recibe filas YA ordenadas por fecha descendente y las agrupa: no vuelve a ordenar.
 * Las filas de marca desconocida se descartan, porque su href (`/${marca}/bitacora/…`)
 * sería un 404.
 */
export function filasAResumen(
  filas: EntradaBitacora[],
  { porMarca = 3, recientes = 6 }: { porMarca?: number; recientes?: number } = {}
): ResumenBitacora {
  const validas = filas.filter((f) => MARCAS.includes(f.marca));
  const agrupado: ResumenBitacora['porMarca'] = {};
  for (const fila of validas) {
    const marca = fila.marca as Marca;
    const entrada = agrupado[marca] ?? (agrupado[marca] = { count: 0, ultimas: [] });
    entrada.count += 1;
    if (entrada.ultimas.length < porMarca) entrada.ultimas.push(fila);
  }
  return { total: validas.length, porMarca: agrupado, recientes: validas.slice(0, recientes) };
}

/** Conteo de una marca por slug, aceptando el `slug: string` de BrandConfig. */
export function conteoDe(resumen: ResumenBitacora, slug: string): number {
  return resumen.porMarca[slug as Marca]?.count ?? 0;
}
