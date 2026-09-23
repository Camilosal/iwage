/**
 * Proyectos Meliponario — data layer.
 * Fetches project sheets from Strapi with Redis caching.
 * Falls back to local seed data when Strapi is unavailable.
 */
import { strapiFetch, CACHE_TTL, strapiImage } from './strapi';

// ── Types ──────────────────────────────────────────────
export type TipoProyecto = 'finca' | 'empresa' | 'club' | 'cultivo' | 'turismo' | 'residencial' | 'institucional';
export type EstadoProyecto = 'diagnostico' | 'diseno' | 'instalacion' | 'activo' | 'en-proceso' | 'pausado' | 'finalizado';
export type ModeloCaja = 'inpa' | 'af' | 'inpa-atril' | 'mixto' | 'otro';
export type EstadoPago = 'pendiente' | 'parcial' | 'pagado' | 'no-aplica';
export type TipoContrato = 'unico' | 'acompanamiento-mensual' | 'convenio' | 'donacion';
export type SaludColonias = 'excelente' | 'buena' | 'regular' | 'critica';
export type ClienteTipo = 'colegio' | 'finca' | 'empresa' | 'hotel' | 'particular' | 'ong' | 'gobernacion';

export interface GaleriaItem {
  url: string;
  tipo?: 'imagen' | 'video' | '360';
  titulo?: string;
}

export interface ProyectoMeliponario {
  id: number;
  documentId: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  imagen: string | null;
  galeria: GaleriaItem[] | null;

  // Clasificación
  tipo: TipoProyecto;
  estado: EstadoProyecto;

  // Ubicación
  ubicacion: string | null;
  municipio: string | null;
  vereda: string | null;
  altitud_msnm: number | null;
  coordenadas: string | null;
  area_m2: number | null;

  // Técnico
  colmenas: number | null;
  modelo_caja: ModeloCaja | null;
  especies: string | null;
  flora_melifera: string[] | null;
  fecha_instalacion: string | null;
  fecha_ultima_visita: string | null;
  proxima_visita: string | null;

  // Comercial
  cliente_nombre: string | null;
  cliente_tipo: ClienteTipo | null;
  cliente_contacto: string | null;
  valor_contrato: number | null;
  estado_pago: EstadoPago | null;
  tipo_contrato: TipoContrato | null;
  servicios_incluidos: string[] | null;

  // Modelo Iwagé
  iot_activo: boolean;
  iot_sensores: Array<{ tipo: string; valor?: string }> | null;
  trazabilidad_qr: boolean;
  identidad_digital_colmena: boolean;

  // Producción e impacto
  produccion_miel_ml: number | null;
  produccion_cosechas: number | null;
  indice_biodiversidad: number | null;
  mejora_polinizacion_pct: number | null;
  salud_colonias: SaludColonias | null;

  // Impacto social
  impacto_familias: number | null;
  impacto_estudiantes: number | null;
  impacto_empleos: number | null;
  prae_alineado: boolean;
  componente_ancestral: string | null;

  // Meta
  metricas: Record<string, any> | null;
  notas_tecnicas: string | null;
  tags: string[] | null;
  orden: number;
  destacado: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

// ── Labels ─────────────────────────────────────────────
export const TIPO_LABELS: Record<TipoProyecto, string> = {
  finca: 'Finca productiva',
  empresa: 'Empresa',
  club: 'Club / PRAE',
  cultivo: 'Cultivo',
  turismo: 'Turismo',
  residencial: 'Residencial',
  institucional: 'Institucional',
};

export const ESTADO_LABELS: Record<EstadoProyecto, { label: string; color: string }> = {
  diagnostico: { label: 'Diagnóstico', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  diseno: { label: 'Diseño', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  instalacion: { label: 'Instalación', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  activo: { label: 'Activo', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  'en-proceso': { label: 'En proceso', color: 'bg-accent-muted text-accent' },
  pausado: { label: 'Pausado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  finalizado: { label: 'Finalizado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export const MODELO_CAJA_LABELS: Record<ModeloCaja, string> = {
  inpa: 'INPA',
  af: 'Augusto Ferreira',
  'inpa-atril': 'INPA con atril',
  mixto: 'Mixto',
  otro: 'Otro',
};

export const SALUD_LABELS: Record<SaludColonias, { label: string; color: string }> = {
  excelente: { label: 'Excelente', color: 'text-green-600 dark:text-green-400' },
  buena: { label: 'Buena', color: 'text-emerald-600 dark:text-emerald-400' },
  regular: { label: 'Regular', color: 'text-amber-600 dark:text-amber-400' },
  critica: { label: 'Crítica', color: 'text-red-600 dark:text-red-400' },
};

// ── Fallback data ──────────────────────────────────────
const FALLBACK_PROYECTOS: ProyectoMeliponario[] = [
  {
    id: 1, documentId: 'prj-1', nombre: 'Meliponario I.E. Ambalá', slug: 'meliponario-ie-ambala',
    descripcion: 'Proyecto PRAE con 6 colmenas educativas y sendero interpretativo para 400 estudiantes. Las colmenas se integran al currículo de ciencias naturales y ética ambiental.',
    descripcion_corta: 'Proyecto PRAE con 6 colmenas educativas y sendero interpretativo.',
    imagen: '/images/galeria/proyecto-ambala-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-ambala-1.webp', tipo: 'imagen' },
      { url: '/images/galeria/proyecto-ambala-2.webp', tipo: 'imagen' },
    ],
    tipo: 'club', estado: 'activo',
    ubicacion: 'Ibagué, Tolima', municipio: 'Ibagué', vereda: 'Ambalá', altitud_msnm: 1300, coordenadas: '4.4389,-75.2322', area_m2: 200,
    colmenas: 6, modelo_caja: 'inpa-atril', especies: 'Tetragonisca angustula', flora_melifera: ['Guamo', 'Café', 'Arrayán', 'Mano de oso'],
    fecha_instalacion: '2024-03-15', fecha_ultima_visita: '2025-06-20', proxima_visita: '2025-07-20',
    cliente_nombre: 'Institución Educativa Ambalá', cliente_tipo: 'colegio', cliente_contacto: 'Rectoría',
    valor_contrato: 1800000, estado_pago: 'pagado', tipo_contrato: 'convenio',
    servicios_incluidos: ['Diagnóstico', 'Diseño', 'Instalación', 'Material didáctico', '3 talleres', 'Acompañamiento 6 meses'],
    iot_activo: true, iot_sensores: [{ tipo: 'Temperatura' }, { tipo: 'Humedad' }],
    trazabilidad_qr: true, identidad_digital_colmena: true,
    produccion_miel_ml: 1200, produccion_cosechas: 2, indice_biodiversidad: 7.8, mejora_polinizacion_pct: 18,
    salud_colonias: 'excelente',
    impacto_familias: 12, impacto_estudiantes: 400, impacto_empleos: 1, prae_alineado: true,
    componente_ancestral: 'Vinculación con sabedores Pijao del territorio para talleres de identidad y relación con las abejas nativas.',
    metricas: null, notas_tecnicas: null, tags: ['prae', 'educativo', 'sendero'], orden: 1, destacado: true,
    meta_title: null, meta_description: null,
  },
  {
    id: 2, documentId: 'prj-2', nombre: 'Finca El Carmen', slug: 'finca-el-carmen',
    descripcion: 'Polinización de aguacate Hass y producción de miel con 12 colmenas distribuidas en bordes de lote y zonas de bosque secundario.',
    descripcion_corta: 'Polinización de aguacate Hass y producción de miel con 12 colmenas.',
    imagen: '/images/galeria/proyecto-carmen-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-carmen-1.webp', tipo: 'imagen' },
      { url: '/images/galeria/proyecto-carmen-2.webp', tipo: 'imagen' },
    ],
    tipo: 'finca', estado: 'activo',
    ubicacion: 'Vereda El Carmen, Ibagué', municipio: 'Ibagué', vereda: 'El Carmen', altitud_msnm: 1450, coordenadas: '4.4612,-75.2890', area_m2: 5000,
    colmenas: 12, modelo_caja: 'inpa', especies: 'Tetragonisca angustula, Melipona eburnea', flora_melifera: ['Aguacate', 'Guamo', 'Café', 'Carbonero'],
    fecha_instalacion: '2023-11-10', fecha_ultima_visita: '2025-07-01', proxima_visita: '2025-08-01',
    cliente_nombre: 'Familia Rodríguez', cliente_tipo: 'finca', cliente_contacto: 'Jorge Rodríguez',
    valor_contrato: 3200000, estado_pago: 'pagado', tipo_contrato: 'acompanamiento-mensual',
    servicios_incluidos: ['Diagnóstico', 'Diseño', 'Instalación', 'Asistencia mensual', 'Cosecha asistida'],
    iot_activo: true, iot_sensores: [{ tipo: 'Temperatura' }, { tipo: 'Humedad' }, { tipo: 'Peso colmena' }],
    trazabilidad_qr: true, identidad_digital_colmena: true,
    produccion_miel_ml: 4500, produccion_cosechas: 4, indice_biodiversidad: 8.2, mejora_polinizacion_pct: 22,
    salud_colonias: 'excelente',
    impacto_familias: 3, impacto_estudiantes: 0, impacto_empleos: 2, prae_alineado: false,
    componente_ancestral: null,
    metricas: null, notas_tecnicas: null, tags: ['aguacate', 'polinizacion', 'produccion'], orden: 2, destacado: true,
    meta_title: null, meta_description: null,
  },
  {
    id: 3, documentId: 'prj-3', nombre: 'EcoHotel La Cumbre', slug: 'ecohotel-la-cumbre',
    descripcion: 'Experiencia de observación de meliponas + cata de miel para huéspedes. Sendero interpretativo de 200m con 4 estaciones.',
    descripcion_corta: 'Experiencia de observación y cata de miel para huéspedes.',
    imagen: '/images/galeria/proyecto-cumbre-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-cumbre-1.webp', tipo: 'imagen' },
      { url: '/images/galeria/proyecto-cumbre-2.webp', tipo: 'imagen' },
    ],
    tipo: 'turismo', estado: 'activo',
    ubicacion: 'Cajamarca, Tolima', municipio: 'Cajamarca', vereda: 'La Cumbre', altitud_msnm: 1600, coordenadas: '4.4450,-75.4320', area_m2: 800,
    colmenas: 4, modelo_caja: 'inpa-atril', especies: 'Tetragonisca angustula', flora_melifera: ['Mano de oso', 'Arrayán', 'Mortino'],
    fecha_instalacion: '2024-06-01', fecha_ultima_visita: '2025-05-15', proxima_visita: '2025-08-15',
    cliente_nombre: 'EcoHotel La Cumbre SAS', cliente_tipo: 'hotel', cliente_contacto: 'Administración',
    valor_contrato: 2400000, estado_pago: 'pagado', tipo_contrato: 'unico',
    servicios_incluidos: ['Diagnóstico', 'Diseño experiencia', 'Instalación', 'Señalética', 'Guía de experiencia', 'Capacitación personal'],
    iot_activo: false, iot_sensores: null,
    trazabilidad_qr: true, identidad_digital_colmena: false,
    produccion_miel_ml: 600, produccion_cosechas: 1, indice_biodiversidad: 7.1, mejora_polinizacion_pct: null,
    salud_colonias: 'buena',
    impacto_familias: 2, impacto_estudiantes: 0, impacto_empleos: 3, prae_alineado: false,
    componente_ancestral: 'Interpretación del rol de las abejas en la cosmovisión Pijao como parte de la experiencia turística.',
    metricas: null, notas_tecnicas: null, tags: ['turismo', 'experiencia', 'cata'], orden: 3, destacado: false,
    meta_title: null, meta_description: null,
  },
  {
    id: 4, documentId: 'prj-4', nombre: 'Colegio San Bonifacio', slug: 'colegio-san-bonifacio',
    descripcion: 'Instalación de 4 colmenas educativas con material PRAE para primaria. En fase de instalación con primer taller realizado.',
    descripcion_corta: '4 colmenas educativas con material PRAE para primaria.',
    imagen: '/images/galeria/proyecto-bonifacio-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-bonifacio-1.webp', tipo: 'imagen' },
    ],
    tipo: 'club', estado: 'en-proceso',
    ubicacion: 'Ibagué, Tolima', municipio: 'Ibagué', vereda: null, altitud_msnm: 1280, coordenadas: null, area_m2: 120,
    colmenas: 4, modelo_caja: 'inpa-atril', especies: 'Tetragonisca angustula', flora_melifera: ['Guamo', 'Café'],
    fecha_instalacion: '2025-07-10', fecha_ultima_visita: '2025-07-10', proxima_visita: '2025-08-10',
    cliente_nombre: 'Colegio San Bonifacio', cliente_tipo: 'colegio', cliente_contacto: 'Coordinación académica',
    valor_contrato: 1200000, estado_pago: 'parcial', tipo_contrato: 'convenio',
    servicios_incluidos: ['Diagnóstico', 'Instalación', 'Material didáctico', '3 talleres'],
    iot_activo: false, iot_sensores: null,
    trazabilidad_qr: false, identidad_digital_colmena: false,
    produccion_miel_ml: null, produccion_cosechas: null, indice_biodiversidad: null, mejora_polinizacion_pct: null,
    salud_colonias: 'buena',
    impacto_familias: 0, impacto_estudiantes: 250, impacto_empleos: 0, prae_alineado: true,
    componente_ancestral: null,
    metricas: null, notas_tecnicas: null, tags: ['prae', 'educativo', 'primaria'], orden: 4, destacado: false,
    meta_title: null, meta_description: null,
  },
  {
    id: 5, documentId: 'prj-5', nombre: 'Finca La Esperanza', slug: 'finca-la-esperanza',
    descripcion: 'Polinización de café Caturra con 8 colmenas en bordes de lote. Sistema agroforestal con sombra de guamo y carbonero.',
    descripcion_corta: 'Polinización de café Caturra con 8 colmenas en bordes de lote.',
    imagen: '/images/galeria/proyecto-esperanza-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-esperanza-1.webp', tipo: 'imagen' },
    ],
    tipo: 'finca', estado: 'activo',
    ubicacion: 'Coello, Tolima', municipio: 'Coello', vereda: 'La Esperanza', altitud_msnm: 1100, coordenadas: '4.2900,-74.9100', area_m2: 8000,
    colmenas: 8, modelo_caja: 'mixto', especies: 'Tetragonisca angustula', flora_melifera: ['Café', 'Guamo', 'Carbonero', 'Bucaro'],
    fecha_instalacion: '2024-01-20', fecha_ultima_visita: '2025-06-28', proxima_visita: '2025-07-28',
    cliente_nombre: 'Asociación Caficultores Coello', cliente_tipo: 'finca', cliente_contacto: 'Presidente asociación',
    valor_contrato: 2800000, estado_pago: 'pagado', tipo_contrato: 'acompanamiento-mensual',
    servicios_incluidos: ['Diagnóstico', 'Diseño', 'Instalación', 'Asistencia mensual'],
    iot_activo: true, iot_sensores: [{ tipo: 'Temperatura' }, { tipo: 'Humedad' }],
    trazabilidad_qr: true, identidad_digital_colmena: true,
    produccion_miel_ml: 3200, produccion_cosechas: 3, indice_biodiversidad: 7.5, mejora_polinizacion_pct: 14,
    salud_colonias: 'buena',
    impacto_familias: 8, impacto_estudiantes: 0, impacto_empleos: 1, prae_alineado: false,
    componente_ancestral: null,
    metricas: null, notas_tecnicas: null, tags: ['cafe', 'polinizacion', 'agroforestal'], orden: 5, destacado: false,
    meta_title: null, meta_description: null,
  },
  {
    id: 6, documentId: 'prj-6', nombre: 'Jardín Residencial El Poblado', slug: 'jardin-residencial-el-poblado',
    descripcion: 'Paisajismo con 3 colmenas ornamentales en zonas comunes del conjunto. Cajas con tapa acrílica para observación segura.',
    descripcion_corta: 'Paisajismo con 3 colmenas ornamentales en zonas comunes.',
    imagen: '/images/galeria/proyecto-poblado-1.webp',
    galeria: [
      { url: '/images/galeria/proyecto-poblado-1.webp', tipo: 'imagen' },
    ],
    tipo: 'residencial', estado: 'en-proceso',
    ubicacion: 'Ibagué, Tolima', municipio: 'Ibagué', vereda: null, altitud_msnm: 1250, coordenadas: null, area_m2: 60,
    colmenas: 3, modelo_caja: 'inpa', especies: 'Tetragonisca angustula', flora_melifera: ['Cayena', 'Trinitaria', 'Bougainvillea'],
    fecha_instalacion: '2025-08-01', fecha_ultima_visita: null, proxima_visita: '2025-08-01',
    cliente_nombre: 'Conjunto Residencial El Poblado', cliente_tipo: 'empresa', cliente_contacto: 'Administración',
    valor_contrato: 900000, estado_pago: 'pendiente', tipo_contrato: 'unico',
    servicios_incluidos: ['Diagnóstico', 'Instalación', 'Señalética informativa'],
    iot_activo: false, iot_sensores: null,
    trazabilidad_qr: false, identidad_digital_colmena: false,
    produccion_miel_ml: null, produccion_cosechas: null, indice_biodiversidad: null, mejora_polinizacion_pct: null,
    salud_colonias: null,
    impacto_familias: 45, impacto_estudiantes: 0, impacto_empleos: 0, prae_alineado: false,
    componente_ancestral: null,
    metricas: null, notas_tecnicas: null, tags: ['paisajismo', 'ornamental', 'residencial'], orden: 6, destacado: false,
    meta_title: null, meta_description: null,
  },
];

// ── Normalizer ─────────────────────────────────────────
function normalizeProyecto(raw: any): ProyectoMeliponario {
  const galeria = Array.isArray(raw.galeria)
    ? raw.galeria.map((g: any) =>
        typeof g === 'string' ? { url: strapiImage(g) ?? g, tipo: 'imagen' as const } : { ...g, url: strapiImage(g.url) ?? g.url }
      )
    : null;

  return {
    id: raw.id,
    documentId: raw.documentId ?? String(raw.id),
    nombre: raw.nombre,
    slug: raw.slug,
    descripcion: raw.descripcion ?? null,
    descripcion_corta: raw.descripcion_corta ?? null,
    imagen: raw.imagen ? strapiImage(raw.imagen) : (galeria?.[0]?.url ?? null),
    galeria,
    tipo: raw.tipo,
    estado: raw.estado ?? 'en-proceso',
    ubicacion: raw.ubicacion ?? null,
    municipio: raw.municipio ?? null,
    vereda: raw.vereda ?? null,
    altitud_msnm: raw.altitud_msnm ?? null,
    coordenadas: raw.coordenadas ?? null,
    area_m2: raw.area_m2 ?? null,
    colmenas: raw.colmenas ?? null,
    modelo_caja: raw.modelo_caja ?? null,
    especies: raw.especies ?? null,
    flora_melifera: raw.flora_melifera ?? null,
    fecha_instalacion: raw.fecha_instalacion ?? null,
    fecha_ultima_visita: raw.fecha_ultima_visita ?? null,
    proxima_visita: raw.proxima_visita ?? null,
    cliente_nombre: raw.cliente_nombre ?? null,
    cliente_tipo: raw.cliente_tipo ?? null,
    cliente_contacto: raw.cliente_contacto ?? null,
    valor_contrato: raw.valor_contrato ?? null,
    estado_pago: raw.estado_pago ?? null,
    tipo_contrato: raw.tipo_contrato ?? null,
    servicios_incluidos: raw.servicios_incluidos ?? null,
    iot_activo: raw.iot_activo ?? false,
    iot_sensores: raw.iot_sensores ?? null,
    trazabilidad_qr: raw.trazabilidad_qr ?? false,
    identidad_digital_colmena: raw.identidad_digital_colmena ?? false,
    produccion_miel_ml: raw.produccion_miel_ml ?? null,
    produccion_cosechas: raw.produccion_cosechas ?? null,
    indice_biodiversidad: raw.indice_biodiversidad ?? null,
    mejora_polinizacion_pct: raw.mejora_polinizacion_pct ?? null,
    salud_colonias: raw.salud_colonias ?? null,
    impacto_familias: raw.impacto_familias ?? null,
    impacto_estudiantes: raw.impacto_estudiantes ?? null,
    impacto_empleos: raw.impacto_empleos ?? null,
    prae_alineado: raw.prae_alineado ?? false,
    componente_ancestral: raw.componente_ancestral ?? null,
    metricas: raw.metricas ?? null,
    notas_tecnicas: raw.notas_tecnicas ?? null,
    tags: raw.tags ?? null,
    orden: raw.orden ?? 0,
    destacado: raw.destacado ?? false,
    meta_title: raw.meta_title ?? null,
    meta_description: raw.meta_description ?? null,
  };
}

// ── Public API ─────────────────────────────────────────

/** Get all published projects, optionally filtered */
export async function getProyectos(opts?: {
  tipo?: TipoProyecto;
  estado?: EstadoProyecto;
}): Promise<ProyectoMeliponario[]> {
  try {
    const filters: Record<string, any> = {};
    if (opts?.tipo) filters.tipo = { $eq: opts.tipo };
    if (opts?.estado) filters.estado = { $eq: opts.estado };

    const res = await strapiFetch<ProyectoMeliponario>('proyecto-meliponarios', {
      ttl: CACHE_TTL.list,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: ['orden:asc', 'nombre:asc'],
      pagination: { pageSize: 100 },
    });

    if (!res.data || res.data.length === 0) throw new Error('Empty');
    return res.data.map(normalizeProyecto);
  } catch {
    let items = FALLBACK_PROYECTOS;
    if (opts?.tipo) items = items.filter((p) => p.tipo === opts.tipo);
    if (opts?.estado) items = items.filter((p) => p.estado === opts.estado);
    return items;
  }
}

/** Get a single project by slug */
export async function getProyectoBySlug(slug: string): Promise<ProyectoMeliponario | null> {
  try {
    const res = await strapiFetch<ProyectoMeliponario>('proyecto-meliponarios', {
      ttl: CACHE_TTL.single,
      filters: { slug: { $eq: slug } },
      pagination: { pageSize: 1 },
    });

    if (!res.data || res.data.length === 0) throw new Error('Not found');
    return normalizeProyecto(res.data[0]);
  } catch {
    return FALLBACK_PROYECTOS.find((p) => p.slug === slug) ?? null;
  }
}
