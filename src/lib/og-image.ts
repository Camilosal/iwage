import { mediaSrc, absUrl } from './media.ts';

const MARCAS = ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion', 'granja'] as const;
type Marca = (typeof MARCAS)[number];

/**
 * og:image / twitter:image / JSON-LD image: siempre absolutas.
 * El chrome de marca (hero-*.webp) es un activo de diseño versionado en public/,
 * no un contenido de Strapi: cambian con el CSS y despliegan con él.
 *
 * `imagen` es lo que la página recibió de Strapi, en cualquiera de sus tres formas
 * históricas (ruta relativa, absoluta propia, o con el host interno de Docker), más
 * los externos reales. `mediaSrc()` reduce lo propio a ruta de sitio y deja intacto
 * lo ajeno; `absUrl()` le pone el origen. Ninguna de las dos deja salir un host
 * interno, y ninguna ruta pelada sobrevive el par.
 *
 * Se prueba en `tests/og-image-absoluta.test.mjs`. Importa `./media.ts` con
 * extensión para que `node --test` pueda cargarlo (sin extensión, el ESM de Node no
 * resuelve el módulo; `src/lib/bitacora-ruta.ts` hace lo mismo).
 */
export function ogImageDe({ brand, imagen }: { brand: string; imagen?: string | null }): string {
  const propia = absUrl(mediaSrc(imagen));
  if (propia) return propia;
  const slug: Marca = (MARCAS as readonly string[]).includes(brand) ? (brand as Marca) : 'meliponas';
  return absUrl(`/images/hero-${slug}.webp`)!;
}
