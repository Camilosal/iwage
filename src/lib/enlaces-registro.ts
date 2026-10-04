/**
 * Registro vivo para la reparación de enlaces internos (`enlaces-interiores.ts`).
 * Vive separado porque toca Strapi/Redis: el módulo puro se teste sin stubs y
 * acá solo se cablece la fuente de los slugs.
 *
 * TTL en proceso de 10 minutos: los slugs publicados no cambian a esa escala,
 * y una caída de Strapi no puede tumbar la página — en ese caso el registro
 * vacío deja los enlaces como venían (degradación, no quiebre).
 */
import { strapiFetch } from './strapi.ts';
import { getAllBitacoraSlugs } from './bitacora.ts';
import type { RegistroEnlaces } from './enlaces-interiores.ts';

const TTL_MS = 10 * 60 * 1000;
let cache: { valor: RegistroEnlaces; hasta: number } | null = null;

interface FilaProducto { slug?: string | null; marca?: string | null }

export async function obtenerRegistroDeEnlaces(): Promise<RegistroEnlaces> {
  if (cache && Date.now() < cache.hasta) return cache.valor;
  const vacio: RegistroEnlaces = { bitacoras: [], productos: [] };
  try {
    const [bitacoras, res] = await Promise.all([
      getAllBitacoraSlugs(),
      strapiFetch<FilaProducto>('productos', {
        publicationState: 'live',
        fields: ['slug', 'marca'],
        pagination: { page: 1, pageSize: 100 },
      }),
    ]);
    const productos = (res.data ?? [])
      .map((d) => ({ ...(d.attributes ?? (d as unknown as FilaProducto)) }))
      .filter((p): p is { slug: string; marca: string } => Boolean(p.slug))
      .map((p) => ({ slug: p.slug, marca: p.marca || 'meliponas' }));
    const valor: RegistroEnlaces = {
      bitacoras: bitacoras.filter((b) => b.slug && b.marca),
      productos,
    };
    cache = { valor, hasta: Date.now() + TTL_MS };
    return valor;
  } catch {
    return vacio;
  }
}
