/**
 * Qué pinta detrás del texto de un hero.
 *
 * El `<header>` y el gradiente del overlay son dos caras de la misma pregunta —¿hay un
 * medio cubriendo el fondo de marca?—, así que se deciden juntos aquí. Separados fue el
 * defecto: el overlay preguntaba solo por `imagen`, de modo que un hero sin foto pero con
 * `color_overlay` (las 39 filas de `hero_configuracions` lo traen) se quedaba con un
 * degradado calibrado sobre fotografía oscura encima del `bg-surface-sunken` claro.
 *
 * La cuenta es WCAG 1.4.3 sobre el fondo plano del header más el negro alfa del gradiente,
 * sin drop-shadow (fórmula y valores por punto, en el informe del fix round 1 del Task 6):
 *  · CON medio: el medio ya pinta atenuado (`opacity-70`) sobre `bg-[#1a1a17]`, ~19:1 con
 *    texto blanco. Esta rama NO cambia un píxel respecto a lo de hoy.
 *  · SIN medio: el header cae al fondo de marca `bg-surface-sunken` (#f2f2ee, L=0.886). Con
 *    la escala de foto el peor punto de la banda de texto dejaba el H1 blanco a 3.2:1 (4.4:1
 *    en su borde superior) y el subtítulo `text-white/80` a 2.6:1 (3.4:1) — los dos por
 *    debajo de AA. Con la escala sin medio ese mismo peor punto es `via-black/60`: H1 6.2:1
 *    y subtítulo 4.7:1 (texto normal de 16-18px, que exige 4.5:1). Sigue sin ser el slab
 *    plano #1a1a17: el fondo se cuela al 20-40% (rgb 48-97) y conserva el tinte de la marca
 *    —verdoso en `naturaleza`, azulado en `gestion`.
 *
 * Se comprueba acá y no en un teste de texto fuente porque `.astro` no es importable; la
 * extracción sigue el precedente de `bitacora-noindex.ts` y `bitacora-ruta.ts`.
 */

export const FONDO_OSCURO = 'bg-[#1a1a17]';
export const FONDO_SUNKEN = 'bg-surface-sunken';

/** Con un medio atenuado detrás (`opacity-70`), la escala de siempre: no cambia un píxel. */
export const ESCALA_CON_MEDIO = 'from-black/50 via-black/40 to-black/70';
/** Sin medio: el fondo de marca claro se cuela al 20-40%, hace falta más negro. */
export const ESCALA_SIN_MEDIO = 'from-black/70 via-black/60 to-black/80';

interface PropsDelHero {
  imagen?: string | null;
  embed?: string | null;
  poster?: string | null;
  color_overlay?: string | null;
}

function conTexto(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

export function pinturaDelHero(h: PropsDelHero): { fondo: string; overlay: string } {
  const hayMedio = conTexto(h.imagen) || conTexto(h.embed) || conTexto(h.poster);
  if (!hayMedio) return { fondo: FONDO_SUNKEN, overlay: ESCALA_SIN_MEDIO };
  return { fondo: FONDO_OSCURO, overlay: conTexto(h.color_overlay) ? h.color_overlay!.trim() : ESCALA_CON_MEDIO };
}
