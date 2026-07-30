/**
 * Ruta custom: POST /api/experiencias/sync-aliado
 * Receptor del sync inverso desde app_reservas (recursos de aliados aprobados).
 * Autenticación por header X-Sync-Token (validado en el controller).
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/experiencias/sync-aliado',
      handler: 'experiencia.syncAliado',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
