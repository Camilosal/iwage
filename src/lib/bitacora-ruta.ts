/**
 * `getBitacoraBySlug` busca por slug sin filtrar por marca, así que las 6 rutas
 * de artículo servían cualquier slug en cualquier marca: 336 URLs vivas para 56
 * documentos, cada una canonicándose a sí misma y declarando como publisher la
 * Organización de la marca solicitada. La marca real del documento es la única
 * que puede sostener ese `@id`, así que las demás se redirecten.
 */
import { BITACORA_MARCAS } from '../config/bitacora-marcas.ts';

export function rutaDeLaMarcaDelArticulo({ marcaRuta, marcaArticulo, slug }: {
  marcaRuta: string;
  marcaArticulo: string | null;
  slug: string;
}): string | null {
  if (!marcaArticulo || marcaArticulo === marcaRuta) return null;
  if (!(marcaArticulo in BITACORA_MARCAS)) return null;
  return `/${marcaArticulo}/bitacora/${slug}`;
}
