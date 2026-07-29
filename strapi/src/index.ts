const PUBLIC_APIS = [
  'producto',
  'cultivo-polinizacion',
  'proyecto-meliponario',
  'lote-miel',
  'articulo',
  'testimonio',
  'item-menu',
  'proveedor',
  'etapa-proyecto',
  'pilar-estandar',
  'cafe-config',
  'configuracion-sitio',
  'propiedad',
  'experiencia',
  'anfitrion',
  'paquete',
  'bitacora',
  'propiedad-gestion',
  'iniciativa',
];

export default {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }: { strapi: any }) {
    // Grant the Public role read access (find/findOne) on all public content types
    // so the Astro frontend can query them without an API token.
    try {
      const publicRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' } });

      if (!publicRole) return;

      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findMany({ where: { role: publicRole.id } });
      const existingActions = new Set(existing.map((p: any) => p.action));

      const toCreate: string[] = [];
      for (const api of PUBLIC_APIS) {
        for (const action of ['find', 'findOne']) {
          const actionId = `api::${api}.${api}.${action}`;
          if (!existingActions.has(actionId)) toCreate.push(actionId);
        }
      }

      for (const action of toCreate) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
        });
      }

      if (toCreate.length) {
        strapi.log.info(`[bootstrap] Granted public read permissions: ${toCreate.length} actions`);
      }
    } catch (e) {
      strapi.log.warn(`[bootstrap] Could not set public permissions: ${(e as Error).message}`);
    }
  },

  destroy(/* { strapi } */) {},
};
