/**
 * Parte pura del sitemap: el tipo, la lista estática y la derivación de los
 * índices de bitácora. Vive aparte de `sitemap.ts` para que `node --test`
 * pueda importarla --ese arrastra `./strapi` sin extensión, que el resolver de
 * Node no resuelve—.
 */
export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SlugEntry {
  slug: string;
  marca?: string;
  updatedAt?: string;
}

export const MARCAS_BITACORA = new Set(['tierras', 'naturaleza', 'meliponas', 'cafe', 'gestion', 'granja']);

// ── Páginas estáticas (rutas de src/pages sin parámetros) ──
// Los índices de bitácora NO están acá: los deriva `indicesDeBitacora()` desde
// las filas publicadas, que es lo único que sabe si una marca tiene contenido.
export const STATIC_PAGES: Array<[path: string, priority: number, changefreq: SitemapUrl['changefreq']]> = [
  // Hub
  ['/', 1.0, 'daily'],

  // Meliponas
  ['/meliponas/', 0.9, 'daily'],
  ['/meliponas/tienda', 0.9, 'daily'],
  ['/meliponas/polinizacion', 0.8, 'weekly'],
  ['/meliponas/proyectos', 0.8, 'weekly'],
  ['/meliponas/proyectos/lineas/fincas-productivas', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/paisajismo-residencial', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/prae-educativo', 0.7, 'monthly'],
  ['/meliponas/proyectos/lineas/turismo-naturaleza', 0.7, 'monthly'],
  ['/meliponas/herramientas', 0.6, 'monthly'],
  ['/meliponas/trazabilidad', 0.7, 'monthly'],
  ['/meliponas/trazabilidad/cajas', 0.6, 'monthly'],
  ['/meliponas/trazabilidad/miel', 0.6, 'monthly'],
  ['/meliponas/trazabilidad/polinizacion', 0.6, 'monthly'],
  ['/meliponas/nosotros', 0.6, 'monthly'],
  ['/meliponas/ayuda', 0.5, 'monthly'],
  ['/meliponas/contacto', 0.6, 'monthly'],

  // Café
  ['/cafe/', 0.9, 'daily'],
  ['/cafe/menu', 0.8, 'weekly'],
  ['/cafe/recetas', 0.7, 'weekly'],
  ['/cafe/proveedores', 0.7, 'weekly'],
  ['/cafe/nosotros', 0.6, 'monthly'],
  ['/cafe/ayuda', 0.5, 'monthly'],
  ['/cafe/contacto', 0.6, 'monthly'],

  // Tierras
  ['/tierras/', 0.9, 'daily'],
  ['/tierras/propiedades', 0.9, 'daily'],
  ['/tierras/comprar', 0.7, 'monthly'],
  ['/tierras/vender', 0.7, 'monthly'],
  ['/tierras/protocolo-vap', 0.7, 'monthly'],
  ['/tierras/lab', 0.6, 'monthly'],
  ['/tierras/perfiles', 0.7, 'monthly'],
  ['/tierras/herramientas/calculadora-notarial', 0.6, 'monthly'],
  ['/tierras/herramientas/evaluacion-vap', 0.6, 'monthly'],
  ['/tierras/herramientas/roi-calculator', 0.6, 'monthly'],
  ['/tierras/nosotros', 0.6, 'monthly'],
  ['/tierras/ayuda', 0.5, 'monthly'],
  ['/tierras/contacto', 0.6, 'monthly'],

  // Naturaleza
  ['/naturaleza/', 0.9, 'daily'],
  ['/naturaleza/experiencias', 0.9, 'daily'],
  ['/naturaleza/anfitriones', 0.8, 'weekly'],
  ['/naturaleza/anfitriones/hub', 0.6, 'monthly'],
  ['/naturaleza/programas', 0.8, 'weekly'],
  ['/naturaleza/clasificacion', 0.6, 'monthly'],
  ['/naturaleza/escalafon', 0.6, 'monthly'],
  ['/naturaleza/se-anfitrion', 0.7, 'monthly'],
  ['/naturaleza/impacto', 0.6, 'monthly'],
  ['/naturaleza/ayuda', 0.5, 'monthly'],
  ['/naturaleza/contacto', 0.6, 'monthly'],

  // Gestión
  ['/gestion/', 0.9, 'daily'],
  ['/gestion/alojamientos', 0.8, 'weekly'],
  ['/gestion/experiencias', 0.7, 'weekly'],
  ['/gestion/propietarios', 0.7, 'monthly'],
  ['/gestion/propietarios/modelo-alianzas', 0.6, 'monthly'],
  ['/gestion/propietarios/renta-corta', 0.6, 'monthly'],
  ['/gestion/propietarios/finca-productiva', 0.6, 'monthly'],
  ['/gestion/propietarios/segunda-residencia', 0.6, 'monthly'],
  ['/gestion/propietarios/operacion-turistica', 0.6, 'monthly'],
  ['/gestion/ayuda', 0.5, 'monthly'],
  ['/gestion/contacto', 0.6, 'monthly'],

  // Granja
  ['/granja/', 0.9, 'daily'],
  ['/granja/sistema', 0.8, 'weekly'],
  ['/granja/tienda', 0.9, 'daily'],
  ['/granja/visitas', 0.8, 'weekly'],
  ['/granja/experimentos', 0.8, 'daily'],
  ['/granja/nosotros', 0.6, 'monthly'],
  ['/granja/ayuda', 0.5, 'monthly'],
  ['/granja/contacto', 0.6, 'monthly'],

  // Ayuda global
  ['/ayuda/', 0.5, 'monthly'],
  ['/ayuda/usuarios/', 0.4, 'monthly'],
  ['/ayuda/usuarios/explorar-plataforma', 0.4, 'monthly'],
  ['/ayuda/usuarios/marcas', 0.4, 'monthly'],
  ['/ayuda/usuarios/tienda', 0.4, 'monthly'],
  ['/ayuda/usuarios/carrito', 0.4, 'monthly'],
  ['/ayuda/usuarios/pedidos', 0.4, 'monthly'],
  ['/ayuda/usuarios/reservas', 0.4, 'monthly'],
  ['/ayuda/usuarios/herramientas', 0.4, 'monthly'],
  ['/ayuda/usuarios/mi-cuenta', 0.4, 'monthly'],
  ['/ayuda/equipo/', 0.3, 'monthly'],
  ['/ayuda/equipo/configuracion', 0.3, 'monthly'],
  ['/ayuda/equipo/contenido-tipos', 0.3, 'monthly'],
  ['/ayuda/equipo/gestion-reservas', 0.3, 'monthly'],
  ['/ayuda/equipo/ordenes', 0.3, 'monthly'],
  ['/ayuda/equipo/pagos', 0.3, 'monthly'],
  ['/ayuda/equipo/portal-aliados', 0.3, 'monthly'],
  ['/ayuda/equipo/reservas-admin', 0.3, 'monthly'],
  ['/ayuda/equipo/sincronizacion', 0.3, 'monthly'],
  ['/ayuda/equipo/strapi-cms', 0.3, 'monthly'],

  // Legal
  ['/legal/', 0.3, 'yearly'],
  ['/legal/terminos-y-condiciones', 0.3, 'yearly'],
  ['/legal/tratamiento-de-datos', 0.3, 'yearly'],
  ['/legal/cookies', 0.3, 'yearly'],
  ['/legal/cancelaciones-y-reembolsos', 0.3, 'yearly'],
  ['/legal/devoluciones-y-retracto', 0.3, 'yearly'],
];

/**
 * Una URL de índice por marca que tenga filas publicadas, con el `updatedAt`
 * más reciente de esa marca como `lastmod`. Las marcas sin contenido no emiten:
 * su `/bitacora` sale `noindex, follow` y declararlo sería una señal cruzada.
 */
export function indicesDeBitacora(entries: SlugEntry[]): SitemapUrl[] {
  const marcas = new Set<string>();
  const ultima = new Map<string, string>();

  for (const e of entries) {
    if (!e.marca || !MARCAS_BITACORA.has(e.marca)) continue;
    marcas.add(e.marca);
    if (!e.updatedAt) continue;
    const actual = ultima.get(e.marca);
    if (!actual || e.updatedAt > actual) ultima.set(e.marca, e.updatedAt);
  }

  return [...marcas].map((marca) => ({
    loc: `/${marca}/bitacora`,
    lastmod: ultima.get(marca)?.slice(0, 10),
    changefreq: 'daily' as const,
    priority: 0.8,
  }));
}
