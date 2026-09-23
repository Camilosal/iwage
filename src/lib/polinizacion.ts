/**
 * Polinización Asistida con Meliponas — data layer.
 * Fetches crop sheets from Strapi `cultivo-polinizaciones` with Redis caching.
 * Falls back to local seed data when Strapi is unavailable.
 */
import { strapiFetch, CACHE_TTL, strapiImage } from './strapi';

// ── Types ──────────────────────────────────────────────
export interface GaleriaItem {
  url: string;
  tipo?: 'imagen' | 'video' | '360';
  titulo?: string;
}

export interface EspecieMelipona {
  nombre: string;
  cientifico?: string;
  rol?: string;
}

export interface CasoExito {
  ubicacion?: string;
  cultivo?: string;
  metrica?: string;
  detalle?: string;
  ano?: number;
}

export interface CultivoPolinizacion {
  id: number;
  documentId: string;
  nombre: string;
  slug: string;
  nombre_cientifico: string | null;
  familia_botanica: string | null;
  icono: string | null;
  imagen: string | null;
  galeria: GaleriaItem[] | null;
  descripcion: string | null;
  descripcion_corta: string | null;
  rendimiento: string | null;
  rendimiento_detalle: string | null;
  fuente: string | null;
  especies_meliponas: EspecieMelipona[] | null;
  mecanismo_polinizacion: string | null;
  ventaja_vs_apis: string | null;
  compatibilidad_organica: boolean;
  // Variables operativas (simulador)
  tarifa_por_hectarea: number | null;
  densidad_cajas_ha: number | null;
  dias_alistamiento: number | null;
  dias_en_campo: number | null;
  dias_recuperacion: number | null;
  tasa_desgaste_pct: number | null;
  opex_logistico: number | null;
  multiplicador_distancia: number | null;
  area_minima_ha: number | null;
  area_maxima_ha: number | null;
  // Condiciones ambientales
  meses_floracion: number[] | null;
  altitud_optima_msnm: string | null;
  temperatura_optima: string | null;
  humedad_relativa: string | null;
  requerimiento_flora: string | null;
  // Servicio
  que_incluye: string[] | null;
  que_se_pide: string[] | null;
  condiciones_servicio: string | null;
  restricciones: string[] | null;
  garantia: string | null;
  caso_exito: CasoExito | null;
  destacado: boolean;
  activo: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

// ── Labels ─────────────────────────────────────────────
export const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ICONO_DEFAULT = 'flower-2';

// ── Mapper ─────────────────────────────────────────────
function mapCultivo(raw: any): CultivoPolinizacion {
  const galeria = Array.isArray(raw.galeria)
    ? raw.galeria.map((g: any) =>
        typeof g === 'string' ? { url: strapiImage(g) ?? g, tipo: 'imagen' as const } : { ...g, url: strapiImage(g.url) ?? g.url }
      )
    : null;

  return {
    id: raw.id,
    documentId: raw.documentId,
    nombre: raw.nombre,
    slug: raw.slug ?? '',
    nombre_cientifico: raw.nombre_cientifico ?? null,
    familia_botanica: raw.familia_botanica ?? null,
    icono: raw.icono ?? null,
    imagen: strapiImage(raw.imagen) ?? raw.imagen ?? (galeria?.[0]?.url ?? null),
    galeria,
    descripcion: raw.descripcion ?? null,
    descripcion_corta: raw.descripcion_corta ?? null,
    rendimiento: raw.rendimiento ?? null,
    rendimiento_detalle: raw.rendimiento_detalle ?? null,
    fuente: raw.fuente ?? null,
    especies_meliponas: Array.isArray(raw.especies_meliponas) ? raw.especies_meliponas : null,
    mecanismo_polinizacion: raw.mecanismo_polinizacion ?? null,
    ventaja_vs_apis: raw.ventaja_vs_apis ?? null,
    compatibilidad_organica: raw.compatibilidad_organica ?? true,
    tarifa_por_hectarea: raw.tarifa_por_hectarea ?? null,
    densidad_cajas_ha: raw.densidad_cajas_ha ?? null,
    dias_alistamiento: raw.dias_alistamiento ?? null,
    dias_en_campo: raw.dias_en_campo ?? null,
    dias_recuperacion: raw.dias_recuperacion ?? null,
    tasa_desgaste_pct: raw.tasa_desgaste_pct ?? null,
    opex_logistico: raw.opex_logistico ?? null,
    multiplicador_distancia: raw.multiplicador_distancia ?? null,
    area_minima_ha: raw.area_minima_ha ?? null,
    area_maxima_ha: raw.area_maxima_ha ?? null,
    meses_floracion: Array.isArray(raw.meses_floracion) ? raw.meses_floracion : null,
    altitud_optima_msnm: raw.altitud_optima_msnm ?? null,
    temperatura_optima: raw.temperatura_optima ?? null,
    humedad_relativa: raw.humedad_relativa ?? null,
    requerimiento_flora: raw.requerimiento_flora ?? null,
    que_incluye: Array.isArray(raw.que_incluye) ? raw.que_incluye : null,
    que_se_pide: Array.isArray(raw.que_se_pide) ? raw.que_se_pide : null,
    condiciones_servicio: raw.condiciones_servicio ?? null,
    restricciones: Array.isArray(raw.restricciones) ? raw.restricciones : null,
    garantia: raw.garantia ?? null,
    caso_exito: raw.caso_exito ?? null,
    destacado: raw.destacado ?? false,
    activo: raw.activo ?? true,
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── API ────────────────────────────────────────────────
export async function getCultivos(opts?: { destacado?: boolean }): Promise<CultivoPolinizacion[]> {
  const filters: Record<string, any> = { activo: { $eq: true } };
  if (opts?.destacado) filters.destacado = { $eq: true };

  try {
    const res = await strapiFetch<any>('cultivo-polinizaciones', {
      ttl: CACHE_TTL.list,
      filters,
      sort: ['nombre:asc'],
      pagination: { pageSize: 50 },
    });
    const mapped = (res.data || []).map(mapCultivo);
    if (mapped.length > 0) return mapped;
    return SEED_CULTIVOS.filter((c) => c.activo && (!opts?.destacado || c.destacado));
  } catch {
    return SEED_CULTIVOS.filter((c) => c.activo && (!opts?.destacado || c.destacado));
  }
}

export async function getCultivoBySlug(slug: string): Promise<CultivoPolinizacion | null> {
  try {
    const res = await strapiFetch<any>('cultivo-polinizaciones', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
    });
    const item = res.data?.[0];
    if (item) return mapCultivo(item);
    return SEED_CULTIVOS.find((c) => c.slug === slug) ?? null;
  } catch {
    return SEED_CULTIVOS.find((c) => c.slug === slug) ?? null;
  }
}

// ── Seed fallback ──────────────────────────────────────
const SEED_CULTIVOS: CultivoPolinizacion[] = [
  {
    id: 1, documentId: 'seed-1', nombre: 'Café', slug: 'cafe',
    nombre_cientifico: 'Coffea arabica', familia_botanica: 'Rubiaceae',
    icono: 'coffee', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Polinización cruzada que incrementa amarre de cereza y uniformidad de grano.',
    rendimiento: '+14% amarre', rendimiento_detalle: 'Incremento en amarre de cereza medido en corredor Ambalá.',
    fuente: 'Corredor Ambalá, 2024',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora principal' }],
    mecanismo_polinizacion: 'Vibración floral (buzz pollination) complementaria. Las meliponas visitan flores abiertas y transfieren polen entre plantas, mejorando cuajado en variedades autógamas.',
    ventaja_vs_apis: 'Las meliponas trabajan en condiciones de menor luminosidad bajo sombrío del cafetal, no pican al trabajador y no compiten con polinizadores silvestres.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 750000, densidad_cajas_ha: 6, dias_alistamiento: 5, dias_en_campo: 30, dias_recuperacion: 20,
    tasa_desgaste_pct: 8, opex_logistico: 150000, multiplicador_distancia: 1.1, area_minima_ha: 1, area_maxima_ha: 10,
    meses_floracion: [3, 4, 5, 9, 10], altitud_optima_msnm: '1200–1800', temperatura_optima: '18–24 °C', humedad_relativa: '70–85%',
    requerimiento_flora: 'Guamo, matarratón, arbustos de borde de lote. Sombra diversificada favorece anidación.',
    que_incluye: ['Diagnóstico del cafetal', 'Instalación de colmenas en bordes de lote', 'Monitoreo quincenal de forrajeo', 'Reporte de amarre antes/después', 'Ajuste de densidad según floración'],
    que_se_pide: ['Acceso al predio durante floración', 'No aplicar insecticidas 15 días antes', 'Punto de agua cercano', 'Coordinación con administrador de finca'],
    condiciones_servicio: null, restricciones: ['No aplicar agroquímicos durante servicio'],
    garantia: 'Si no se evidencia mejora en amarre, se extiende el servicio sin costo una temporada adicional.',
    caso_exito: { ubicacion: 'Corredor Ambalá, Ibagué', cultivo: 'Café Caturra', metrica: '+14% amarre de cereza', detalle: '12 colmenas en bordes de lote con flora de guamo.', ano: 2024 },
    destacado: true, activo: true, meta_title: null, meta_description: null,
  },
  {
    id: 2, documentId: 'seed-2', nombre: 'Aguacate', slug: 'aguacate',
    nombre_cientifico: 'Persea americana', familia_botanica: 'Lauraceae',
    icono: 'tree-deciduous', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Polinización dirigida que mejora cuajado en variedades Hass y criollas.',
    rendimiento: '+22% cuajado', rendimiento_detalle: 'Incremento en cuajado de fruto en aguacate Hass.',
    fuente: 'Finca El Carmen, 2024',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora principal' }, { nombre: 'Piquiña', cientifico: 'Scaptotrigona sp.', rol: 'Complementaria' }],
    mecanismo_polinizacion: 'Transferencia de polen entre flores tipo A y B (dicogamia protogínica). Las meliponas visitan ambos tipos en el mismo vuelo, superando la barrera temporal.',
    ventaja_vs_apis: 'Las meliponas son más eficientes en flores pequeñas del aguacate, trabajan a menor temperatura y no ahuyentan polinizadores nativos.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 950000, densidad_cajas_ha: 4, dias_alistamiento: 7, dias_en_campo: 21, dias_recuperacion: 30,
    tasa_desgaste_pct: 12, opex_logistico: 180000, multiplicador_distancia: 1.2, area_minima_ha: 2, area_maxima_ha: 20,
    meses_floracion: [1, 2, 3, 7, 8, 9], altitud_optima_msnm: '1500–2200', temperatura_optima: '16–25 °C', humedad_relativa: '65–80%',
    requerimiento_flora: 'Guayacán, cedro, árboles nativos de borde. Corredores biológicos entre lotes.',
    que_incluye: ['Diagnóstico de estado floral', 'Diseño de distribución de colmenas', 'Instalación estratégica', 'Monitoreo semanal durante floración', 'Reporte de cuajado con datos', 'Asesoría de flora complementaria'],
    que_se_pide: ['Acceso al predio 7 días antes de floración', 'Suspensión de fumigaciones 20 días antes', 'Área de sombra para colmenas', 'Personal de apoyo para logística'],
    condiciones_servicio: null, restricciones: ['No fumigar con neonicotinoides', 'Mantener distancia mínima de 50m a apiarios'],
    garantia: 'Garantía de cuajado medible o extensión gratuita del servicio.',
    caso_exito: { ubicacion: 'Finca El Carmen, Ibagué', cultivo: 'Aguacate Hass', metrica: '+22% cuajado en 1 temporada', detalle: '8 colmenas de T. angustula distribuidas en 2 hectáreas.', ano: 2024 },
    destacado: true, activo: true, meta_title: null, meta_description: null,
  },
  {
    id: 3, documentId: 'seed-3', nombre: 'Mora', slug: 'mora',
    nombre_cientifico: 'Rubus glaucus', familia_botanica: 'Rosaceae',
    icono: 'berry', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Mejora tamaño y uniformidad de fruto en mora de Castilla.',
    rendimiento: '+18% frutos', rendimiento_detalle: 'Mayor número de frutos cuajados por racimo.',
    fuente: 'Vereda El Carmen, 2023',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora principal' }],
    mecanismo_polinizacion: 'Polinización de flores individuales con múltiples carpelos. Visita repetida mejora llenado de drupas.',
    ventaja_vs_apis: 'Las meliponas acceden mejor a la morfología floral de la mora y trabajan en condiciones de invernadero o enramada.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 680000, densidad_cajas_ha: 8, dias_alistamiento: 4, dias_en_campo: 25, dias_recuperacion: 15,
    tasa_desgaste_pct: 10, opex_logistico: 120000, multiplicador_distancia: 1.0, area_minima_ha: 0.5, area_maxima_ha: 5,
    meses_floracion: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], altitud_optima_msnm: '1800–2500', temperatura_optima: '14–22 °C', humedad_relativa: '70–85%',
    requerimiento_flora: 'Flores de borde, arvenses controladas. Floración continua favorece colonias.',
    que_incluye: ['Diagnóstico del cultivo', 'Instalación de colmenas', 'Monitoreo quincenal', 'Reporte de producción'],
    que_se_pide: ['Acceso semanal al cultivo', 'No aplicar fungicidas en floración', 'Tutorado adecuado de plantas'],
    condiciones_servicio: null, restricciones: ['Evitar aspersiones en horas de vuelo'],
    garantia: null,
    caso_exito: { ubicacion: 'Vereda El Carmen, Ibagué', cultivo: 'Mora de Castilla', metrica: '+18% frutos por racimo', detalle: '6 colmenas en enramada de 0.8 ha.', ano: 2023 },
    destacado: false, activo: true, meta_title: null, meta_description: null,
  },
  {
    id: 4, documentId: 'seed-4', nombre: 'Cítricos', slug: 'citricos',
    nombre_cientifico: 'Citrus spp.', familia_botanica: 'Rutaceae',
    icono: 'citrus', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Incremento de calibre y calidad en naranja, mandarina y limón.',
    rendimiento: '+12% calibre', rendimiento_detalle: 'Mejor llenado de fruto y mayor peso promedio.',
    fuente: 'Predio La Esperanza, 2024',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora principal' }],
    mecanismo_polinizacion: 'Polinización cruzada entre variedades. Mejora cuajado en cítricos parcialmente autoincompatibles.',
    ventaja_vs_apis: 'Las meliponas no dañan pétalos delicados, trabajan en floraciones escalonadas y son seguras cerca de viviendas rurales.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 700000, densidad_cajas_ha: 5, dias_alistamiento: 5, dias_en_campo: 28, dias_recuperacion: 20,
    tasa_desgaste_pct: 9, opex_logistico: 140000, multiplicador_distancia: 1.1, area_minima_ha: 1, area_maxima_ha: 15,
    meses_floracion: [2, 3, 4, 8, 9], altitud_optima_msnm: '400–1200', temperatura_optima: '22–30 °C', humedad_relativa: '60–80%',
    requerimiento_flora: 'Guayacán, matarratón, cercas vivas diversificadas.',
    que_incluye: ['Diagnóstico del citrus', 'Instalación de colmenas', 'Monitoreo quincenal', 'Reporte de calibre'],
    que_se_pide: ['Acceso al predio', 'No aplicar insecticidas sistémicos', 'Coordinación de cosecha'],
    condiciones_servicio: null, restricciones: ['No aplicar imidacloprid durante servicio'],
    garantia: null,
    caso_exito: { ubicacion: 'Predio La Esperanza, Coello', cultivo: 'Naranja Valencia', metrica: '+12% calibre promedio', detalle: '10 colmenas en 3 ha de cítricos mixtos.', ano: 2024 },
    destacado: false, activo: true, meta_title: null, meta_description: null,
  },
  {
    id: 5, documentId: 'seed-5', nombre: 'Tomate', slug: 'tomate',
    nombre_cientifico: 'Solanum lycopersicum', familia_botanica: 'Solanaceae',
    icono: 'salad', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Buzz pollination que mejora peso y uniformidad en tomate bajo cubierta.',
    rendimiento: '+9% peso', rendimiento_detalle: 'Mayor peso promedio de fruto en invernadero.',
    fuente: 'Invernadero PRAE, 2024',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora en invernadero' }],
    mecanismo_polinizacion: 'Buzz pollination (vibración). Las meliponas vibran las anteras poricidas del tomate liberando polen de forma eficiente.',
    ventaja_vs_apis: 'Ideales para invernadero: no pican, se adaptan a espacios cerrados, reemplazan la polinización manual con hormonas.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 850000, densidad_cajas_ha: 10, dias_alistamiento: 3, dias_en_campo: 35, dias_recuperacion: 10,
    tasa_desgaste_pct: 15, opex_logistico: 100000, multiplicador_distancia: 1.0, area_minima_ha: 0.2, area_maxima_ha: 3,
    meses_floracion: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], altitud_optima_msnm: '1000–2200', temperatura_optima: '18–28 °C', humedad_relativa: '60–75%',
    requerimiento_flora: 'No requiere flora externa en invernadero. En campo abierto: flores de borde.',
    que_incluye: ['Diagnóstico del invernadero', 'Instalación de colmenas internas', 'Monitoreo semanal', 'Reporte de cuajado'],
    que_se_pide: ['Ventilación controlada del invernadero', 'No usar pesticidas biológicos incompatibles', 'Acceso diario para revisión'],
    condiciones_servicio: null, restricciones: ['Temperatura interna no superior a 35°C'],
    garantia: null,
    caso_exito: { ubicacion: 'Invernadero PRAE, Ibagué', cultivo: 'Tomate chonto', metrica: '+9% peso de fruto', detalle: '4 colmenas en invernadero de 0.3 ha.', ano: 2024 },
    destacado: false, activo: true, meta_title: null, meta_description: null,
  },
  {
    id: 6, documentId: 'seed-6', nombre: 'Fresa', slug: 'fresa',
    nombre_cientifico: 'Fragaria × ananassa', familia_botanica: 'Rosaceae',
    icono: 'cherry', imagen: null, galeria: null,
    descripcion: null, descripcion_corta: 'Mejora uniformidad y reduce deformidad en fresa de exportación.',
    rendimiento: '+15% uniformidad', rendimiento_detalle: 'Reducción de frutos deformes y mayor peso.',
    fuente: 'Finca La Cumbre, 2023',
    especies_meliponas: [{ nombre: 'Angelita', cientifico: 'Tetragonisca angustula', rol: 'Polinizadora principal' }],
    mecanismo_polinizacion: 'Polinización de receptáculo floral. Visita completa a todos los estambres produce fruto simétrico.',
    ventaja_vs_apis: 'Las meliponas visitan más flores por minuto en fresa, no dañan pétalos y trabajan a baja temperatura en invernadero.',
    compatibilidad_organica: true,
    tarifa_por_hectarea: 900000, densidad_cajas_ha: 12, dias_alistamiento: 3, dias_en_campo: 40, dias_recuperacion: 10,
    tasa_desgaste_pct: 14, opex_logistico: 110000, multiplicador_distancia: 1.0, area_minima_ha: 0.3, area_maxima_ha: 4,
    meses_floracion: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], altitud_optima_msnm: '2000–2800', temperatura_optima: '15–22 °C', humedad_relativa: '65–80%',
    requerimiento_flora: 'No requiere en invernadero. En campo: flores de borde como atrayente.',
    que_incluye: ['Diagnóstico del cultivo', 'Instalación de colmenas', 'Monitoreo semanal', 'Reporte de calidad de fruto'],
    que_se_pide: ['Acceso al invernadero/campo', 'No aplicar fungicidas en floración', 'Manejo integrado de plagas'],
    condiciones_servicio: null, restricciones: ['No usar azufre en polvo durante vuelo'],
    garantia: null,
    caso_exito: { ubicacion: 'Finca La Cumbre, Ibagué', cultivo: 'Fresa Albion', metrica: '+15% uniformidad de fruto', detalle: '8 colmenas en invernadero de 0.5 ha.', ano: 2023 },
    destacado: false, activo: true, meta_title: null, meta_description: null,
  },
];
