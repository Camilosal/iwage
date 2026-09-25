/**
 * Unified bitácora entry fetching from Strapi `bitacoras` collection.
 * Each brand filters by `marca` field.
 */
import { strapiFetch, CACHE_TTL } from './strapi.ts';
import { filasAResumen, filasParaPlantilla, type FilaCrudaDeBitacora, type ResumenBitacora } from './bitacora-resumen.ts';
import type { MediaItem } from './media.ts';

export { conteoDe, type ResumenBitacora } from './bitacora-resumen.ts';

export interface EntradaBitacora {
  id: number;
  documentId: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  contenido: string | null;
  categoria: string | null;
  tiempo_lectura: number | null;
  /**
   * La portada, ya como contrato (`normalizar-medio.ts`). No es un string: en el esquema
   * del repo `bitacora.imagen` es `type: 'media'` desde `fa240b2` —aunque el `dist/` del
   * contenedor en vuelo todavía sirve el string viejo—, así que la fila cruda puede llegar
   * como ruta, como objeto media o como `MediaItem`, y las tres formas convergen acá.
   * Que sea una relación significa dos cosas para quien llame a esta API: hay que pedir
   * `populate: ['imagen']` (si no, Strapi responde sin el campo y esto da `null` con build
   * verde — el C1), y la plantilla pinta `imagen.url` e `imagen.alt`. Una ruta propia sale
   * relativa de sitio porque `mediaSrc()` le quitó el host interno de Docker.
   */
  imagen: MediaItem | null;
  fecha: string | null;
  marca: string;
  destacado: boolean;
  publicado: boolean;
  autor: string | null;
  etiquetas: string[] | null;
  fecha_actualizacion: string | null;
  meta_title: string | null;
  meta_description: string | null;
  subsistema: string | null;
  publishedAt: string;
  updatedAt: string;
}

export type Marca = 'tierras' | 'naturaleza' | 'meliponas' | 'cafe' | 'gestion' | 'granja';

/**
 * Listado de una marca. Las filas que salen de aquí ya son de plantilla
 * (`imagen: MediaItem | null`), y son COPIAS: la normalización se hace DESPUÉS de que
 * `strapiFetch` devuelva la estructura del cache, nunca sobre ella.
 *
 * `populate: ['imagen']` NO es opcional: desde `fa240b2` el atributo `imagen` de
 * `bitacora` es `type: 'media'`, y la REST API de Strapi v5 «by default does not populate
 * any relations, media fields, components, or dynamic zones» (docs de Population & Field
 * Selection). Sin esa clave Strapi responde `200` sin el campo → `normalizarParaPlantilla`
 * ve `undefined` → `imagen: null` en las 112 filas → cero tapas, con build y testes verdes.
 * El precedente del repo es `cafe.ts:154` y `:203`.
 *
 * OJO con la clave de cache (`strapi:bitacoras:<queryString>`): `populate[]` SÍ entra en la
 * queryString (`strapi.ts:95-101`), así que este fix estrena clave → un cold miss de TTL
 * `CACHE_TTL.list` por superficie al desplegar. Conviene barrer `strapi:bitacoras:*` en
 * Redis en el deploy para no servir dos filas vivas.
 */
export async function getBitacoraByMarca(
  marca: Marca,
  opts: { pageSize?: number; page?: number } = {}
): Promise<{ data: EntradaBitacora[]; total: number; fallo: boolean }> {
  try {
    const res = await strapiFetch<FilaCrudaDeBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      populate: ['imagen'],
      filters: { marca: { $eq: marca }, publicado: { $eq: true } },
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: opts.page || 1, pageSize: opts.pageSize || 20 },
    });
    return {
      // `filasParaPlantilla` es total (fila rara → `imagen: null`), así que no puede
      // convertir una fila bien formada en el `fallo: true` de abajo, que es lo que
      // prendería el `noindex` del índice por un dato feo.
      data: filasParaPlantilla(res.data),
      total: res.meta?.pagination?.total || 0,
      fallo: false,
    };
  } catch {
    // `fallo` es lo que permite al índice no quemar su `noindex` por un timeout
    return { data: [], total: 0, fallo: true };
  }
}

/**
 * Campos escalares que necesitan las tiras de resumen; `contenido` queda fuera a propósito.
 * `imagen` sigue listado porque EN EL CONTAINER EN VUELO todavía es un atributo `string`
 * (Task 11 no ha corrido) y `fields[]` es la única forma de pedir un escalar. En cuanto el
 * esquema de `fa240b2` se despliegue, `imagen` pase a ser relación y `fields[]` deja de
 * aplicársele — por eso hace falta además el `populate` de abajo, no en vez de él.
 */
const CAMPOS_RESUMEN = [
  'titulo', 'slug', 'marca', 'fecha', 'extracto', 'imagen', 'categoria', 'tiempo_lectura',
];

/**
 * Una sola pasada a Strapi para todas las superficies que muestran bitácora
 * (hub, 5 landings y BrandFooter). `porMarca`/`recientes` son de post-proceso:
 * no entran al cache key, así que las 7 superficies comparten una única entrada
 * de Redis con TTL `CACHE_TTL.list`.
 * Si Strapi falla, devuelve el resumen vacío: el bloque se degrada a nada, nunca
 * a un 500 en la portada.
 *
 * `fields` y `populate` son dos cosas distintas en Strapi v5 y no se sustituyen: la
 * selección de campos «does not work on relational, media, component, or dynamic zone
 * fields» (Population & Field Selection). Dejar `imagen` en `CAMPOS_RESUMEN` sin
 * `populate` es justo el C1: el hub y las 5 landings se quedan sin tapa en silencio.
 * Este fix también estrena clave de cache (`populate[]` entra en la queryString).
 */
export async function getResumenBitacora(
  opts: { porMarca?: number; recientes?: number } = {}
): Promise<ResumenBitacora> {
  try {
    const res = await strapiFetch<FilaCrudaDeBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      populate: ['imagen'],
      filters: { publicado: { $eq: true } },
      sort: ['fecha:desc', 'publishedAt:desc'],
      pagination: { page: 1, pageSize: 100 },
      fields: CAMPOS_RESUMEN,
    });
    // Se normalizan ANTES de agrupar: `porMarca.ultimas` y `recientes` son las filas que
    // pintan `BitacoraCard` en el hub y en las 5 landings, y la tarjeta ya no sabe de
    // strings. La entrada compartida de Redis (las 7 superficies, una sola clave) sigue
    // guardando la fila cruda.
    return filasAResumen(filasParaPlantilla(res.data), opts);
  } catch (error) {
    // El bloque se degrada a nada, pero el motivo tiene que quedar en el log del
    // contenedor: sin esto, "0 enlaces en la portada" no se distingue de "Strapi caído".
    console.error(`[bitácora] resumen degradado — ${error instanceof Error ? error.message : String(error)}`);
    return filasAResumen([], opts);
  }
}

/**
 * Una ficha. Sale con `imagen: MediaItem | null` por el mismo camino que el listado;
 * `null` solo cuando Strapi falló o no hay artículo, igual que antes.
 * Acá es donde más se veía el C1: sin `populate` la ficha pierde el `<figure>`, el
 * `Article.image` del JSON-LD y el `og:image` propio, y cae al hero de la marca.
 */
export async function getBitacoraBySlug(slug: string): Promise<EntradaBitacora | null> {
  try {
    const res = await strapiFetch<FilaCrudaDeBitacora>('bitacoras', {
      ttl: CACHE_TTL.single,
      populate: ['imagen'],
      filters: { slug: { $eq: slug }, publicado: { $eq: true } },
      pagination: { pageSize: 1 },
    });
    const [fila] = filasParaPlantilla(res.data);
    return fila ?? null;
  } catch {
    return null;
  }
}

/**
 * Get all slugs for static generation (optional, for getStaticPaths)
 *
 * SIN `populate` a propósito, y es la única lectura de bitácora que se lo permite: no
 * construye `EntradaBitacora` ni pasa por `filasParaPlantilla`, mapea solo `slug` y
 * `marca` (dos escalares). Pedir `imagen` acá no lo lee nadie y además estrenaría una
 * clave de cache más para el mismo listado. El gate lo verifica en los dos sentidos:
 * poblar donde hace falta y NO poblar donde no hace falta.
 */
export async function getAllBitacoraSlugs(): Promise<{ slug: string; marca: string }[]> {
  try {
    const res = await strapiFetch<FilaCrudaDeBitacora>('bitacoras', {
      ttl: CACHE_TTL.list,
      filters: { publicado: { $eq: true } },
      pagination: { pageSize: 100 },
      sort: ['fecha:desc'],
    });
    return (res.data || []).map((a) => ({ slug: a.slug, marca: a.marca }));
  } catch {
    return [];
  }
}

/** Format date for display */
export function formatFecha(fecha: string | null): string {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
