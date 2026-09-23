export const SITE_METRICS = {
  colmenasActivas: 12,
  colmenasActivasLabel: 'Colmenas activas',
  lineasAccion: 6,
  modelosCaja: 4,
  kmFloraNativa: 12,
  trazabilidadPorLote: '100%',
  propiedadesGestionadas: '50+',
  kmCorredorBiologico: '12 km',
} as const;

export type SiteMetrics = typeof SITE_METRICS;