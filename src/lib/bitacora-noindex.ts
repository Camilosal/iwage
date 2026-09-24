/**
 * El robots de un índice de bitácora.
 *
 * El bug que cierra: `getBitacoraByMarca` se traga el error y devuelve `[]`, así que
 * un blip de Strapi dejaba /meliponas/bitacora --con 37 artículos-- respondiendo 200
 * con `noindex, follow`, y nginx lo servía así 120 s. Distinguir "vacío" de "no
 * contestó" es lo único que hace falta para no quemar la indexación por un timeout.
 */
export function noindexDeIndice({ total, fallo = false }: { total: number; fallo?: boolean }): boolean {
  return total === 0 && !fallo;
}
