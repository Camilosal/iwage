/**
 * Agrupación pura del resumen de bitácoras, sin Strapi ni Redis.
 * Vive aparte de `bitacora.ts` para que `node --test` pueda importarla sobre el
 * repositorio (el host no tiene node_modules y `bitacora.ts` arrastra ioredis).
 *
 * Además de agrupar, es la única puerta por la que una fila cruda de Strapi se vuelve
 * fila de plantilla (`filasParaPlantilla`): `bitacora.ts` la llama en sus tres funciones
 * de lectura, y así el mapeo se puede probar sin Redis ni red — igual que aquí abajo.
 */
import { normalizarParaPlantilla } from './normalizar-medio.ts';
import type { EntradaBitacora, Marca } from './bitacora';

export interface ResumenBitacora {
  total: number;
  porMarca: Partial<Record<Marca, { count: number; ultimas: EntradaBitacora[] }>>;
  recientes: EntradaBitacora[];
}

/**
 * Lo que `strapiFetch` devuelve hoy: `imagen` todavía es el `string` de la BD vieja
 * (Task 11 no ha corrido) y puede venir ya como objeto media o como `MediaItem`.
 * Por eso `unknown`, no `string`: el adaptador es el que decide.
 */
export type FilaCrudaDeBitacora = Omit<EntradaBitacora, 'imagen'> & { imagen?: unknown };

/**
 * Filas crudas → filas para plantilla. Dos propiedades que el resto del sistema necesita:
 *
 *  · **Nunca muta la entrada.** `strapiFetch` devuelve el objeto que sacó de Redis tal
 *    cual (y `inflightFetches` reparte el MISMO objeto entre llamadas concurrentes):
 *    escribir un `MediaItem` sobre esa fila contaminaría la estructura compartida.
 *    Cada fila sale en un objeto nuevo, con el resto de los campos intactos.
 *  · **Es total.** Cualquier fila decodificable de JSON —incluidas `null`, un número o un
 *    string— sale con `imagen: MediaItem | null` sin lanzar. No puede disfrazar un dato
 *    feo de error de Strapi (`fallo: true` prende el `noindex` del índice), ni puede
 *    volver una fila buena en un 500. Se prueba en `tests/normalizar-medio.test.mjs`.
 */
export function filasParaPlantilla(
  filas: readonly (FilaCrudaDeBitacora | null | undefined)[] | null | undefined
): EntradaBitacora[] {
  return (filas ?? []).map(
    (fila) => ({ ...fila, imagen: normalizarParaPlantilla(fila ?? {}).imagen } as EntradaBitacora),
  );
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
