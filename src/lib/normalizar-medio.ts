/**
 * El adaptador que separa "cómo guarda Strapi un medio" de "cómo lo pinta una plantilla".
 *
 * Existe para que las `normalize*` de `src/lib` no abran el objeto media cada una: hoy
 * una portada puede llegar como `string` (la BD vieja: `bitacora.imagen` sigue siendo
 * `type: 'string'` porque Task 11 no ha corrido), como objeto media de Strapi v5, o como
 * un `MediaItem` ya normalizado (porque la fila pasó por dos bordes). Las tres formas
 * convergen aquí y salen como `MediaItem | null` / `MediaItem[]`.
 *
 * Todo el trabajo sucio está en `./media.ts`: `mediaSrc()` reduce lo propio a ruta de
 * sitio (nginx proxya `/uploads`, así que una URL con el host interno del compose
 * pintada tal cual es un roto en el navegador), `toMediaItem()` lee `alternativeText`/`caption` y
 * `toMediaList()` aplana y deduplica el array anidado de una relación `multiple`.
 *
 * Se importa `./media.ts` CON extensión: dentro de un módulo de `src/lib` un import runtime
 * sin extensión solo lo resuelve el bundler de Astro, y `node --test` carga estos
 * archivos directo (`og-image.ts` y `heroes.ts` hacen lo mismo por la misma razón).
 */
import { mediaSrc, toMediaItem, toMediaList, type MediaItem } from './media.ts';

/**
 * `imagen`/`galeria` son `unknown` a propósito: el adaptador es el borde donde un valor
 * que nadie verificó se vuelve plantilla. Nunca lanza; lo que no tiene URL utilizable
 * sale `null`/`[]` (ver `tests/normalizar-medio.test.mjs`).
 */
export function normalizarParaPlantilla<T extends { imagen?: unknown; galeria?: unknown }>(raw: T): {
  imagen: MediaItem | null;
  galeria: MediaItem[];
} {
  return {
    imagen: toMediaItem({ ...(typeof raw.imagen === 'object' && raw.imagen ? raw.imagen : {}), url: mediaSrc(raw.imagen) ?? undefined }),
    galeria: toMediaList(raw.galeria),
  };
}
