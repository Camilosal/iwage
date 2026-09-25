import { mediaSrc, absUrl } from './media.ts';

const MARCAS = ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion', 'granja'] as const;
type Marca = (typeof MARCAS)[number];

/**
 * og:image / twitter:image / JSON-LD image: siempre absolutas.
 * El chrome de marca (hero-*.webp) es un activo de diseño versionado en public/,
 * no un contenido de Strapi: cambian con el CSS y despliegan con él.
 *
 * `imagen` es lo que la página recibió de Strapi, en cualquiera de sus formas históricas
 * (ruta relativa, absoluta propia, o con el host interno de Docker). `mediaSrc()` reduce
 * lo propio a ruta de sitio y DESCARTA lo que no es nuestro ni proveedor de video/360
 * conocido (`esPintable`): un hotlink de stock no puede anunciarse como la imagen de
 * nuestra página en Facebook. `absUrl()` le pone el origen al resto. Ninguna de las dos
 * deja salir un host interno, y ninguna ruta pelada sobrevive el par.
 *
 * El parámetro es `unknown`, no `string | null`, por una razón medida: desde la Task 12
 * `EntradaBitacora.imagen` es un `MediaItem`, y esta es la única frontera donde ese
 * objeto puede llegar por error —lo hace cuando una página olvida el `.url`— sin que
 * nadie lo revise. `rawOf()` ya sabe leer un objeto media, así que el valor sale
 * absoluto y correcto; con el tipo viejo (`string`) el error era silencioso:
 * `content="[object Object]"` en `og:image` con `astro build` verde. Que el tipo diga
 * `unknown` convierte el olvido en un caso con nombre, y ese caso está testeado en
 * `tests/normalizar-medio.test.mjs`.
 *
 * Se prueba en `tests/og-image-absoluta.test.mjs`. Importa `./media.ts` con
 * extensión para que `node --test` pueda cargarlo (sin extensión, el ESM de Node no
 * resuelve el módulo; `src/lib/bitacora-ruta.ts` hace lo mismo).
 */
export function ogImageDe({ brand, imagen }: { brand: string; imagen?: unknown }): string {
  const propia = absUrl(mediaSrc(imagen));
  if (propia) return propia;
  const slug: Marca = (MARCAS as readonly string[]).includes(brand) ? (brand as Marca) : 'meliponas';
  return absUrl(`/images/hero-${slug}.webp`)!;
}
