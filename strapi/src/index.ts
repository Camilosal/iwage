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
  'complemento',
  'hero-configuracion',
];

export default {
  register({ strapi }: { strapi: any }) {
    // ─── PATCH: relations modal shows published records ──────────────────
    // Strapi v5's content-manager relations controller defaults to status='draft'
    // when no status query param is provided, which filters out records that only
    // have a published version (no draft). Must be in 'register' (not 'bootstrap')
    // so it runs BEFORE routes are bound.
    try {
      const ctrl = (strapi as any).plugin('content-manager').controller('relations') as any;
      if (ctrl && typeof ctrl.findAvailable === 'function') {
        const origFindAvailable = ctrl.findAvailable.bind(ctrl);
        ctrl.findAvailable = async function (ctx: any) {
          ctx.request.query = ctx.request.query || {};
          if (!ctx.request.query.status) {
            ctx.request.query.status = 'published';
          }
          return await origFindAvailable(ctx);
        };
        strapi.log.info('[register] Relations controller patched: findAvailable defaults to status=published');
      }
    } catch (e: any) {
      strapi.log.warn(`[register] Could not patch relations controller: ${e.message}`);
    }
  },

  async bootstrap({ strapi }: { strapi: any }) {
    // ─── PATCH: content-manager defaults to status="published" ────────────
    // Strapi v5 admin panel calls the API without ?status=, which causes
    // the server to default to status=draft and return 0 items (and "Untitled"
    // when opening a document). We override the document-manager service to
    // inject status='published' for content-types with draftAndPublish=true.
    try {
      const docManager = (strapi.plugin('content-manager') as any).service('document-manager');
      const hasDraftAndPublish = (uid: string) => {
        const model: any = (strapi as any).getModel(uid);
        return model?.options?.draftAndPublish === true;
      };
      const withStatus = (opts: any) =>
        opts && opts.status ? opts : { ...(opts || {}), status: 'published' };

      // findPage(opts, uid) — opts is first arg
      if (typeof docManager.findPage === 'function') {
        const orig = docManager.findPage.bind(docManager);
        docManager.findPage = async (opts: any, uid: string) =>
          orig(hasDraftAndPublish(uid) ? withStatus(opts) : opts, uid);
      }
      // findOne(id, uid, opts) — id is first, uid second, opts third
      if (typeof docManager.findOne === 'function') {
        const orig = docManager.findOne.bind(docManager);
        docManager.findOne = async (id: any, uid: string, opts: any = {}) =>
          orig(id, uid, hasDraftAndPublish(uid) ? withStatus(opts) : opts);
      }
      // findFirst(opts, uid) — same as findPage
      if (typeof docManager.findFirst === 'function') {
        const orig = docManager.findFirst.bind(docManager);
        docManager.findFirst = async (opts: any, uid: string) =>
          orig(hasDraftAndPublish(uid) ? withStatus(opts) : opts, uid);
      }
      // countDraftRelations(id, uid, locale) — when the admin panel doesn't pass
      // a locale, the query becomes WHERE locale IS NULL and filters everything.
      // Fall back to the first configured locale; return zeros if it still fails.
      if (typeof docManager.countDraftRelations === 'function') {
        const orig = docManager.countDraftRelations.bind(docManager);
        docManager.countDraftRelations = async (id: any, uid: string, locale: any) => {
          try {
            let fallback = 'en';
            try {
              const locales: any[] = await (strapi as any)
                .plugin('i18n')
                .service('locales')
                .find();
              const def: any = locales?.find((l: any) => l.isDefault) || locales?.[0];
              if (def?.code) fallback = def.code;
            } catch {
              // keep 'en' fallback
            }
            return await orig(id, uid, locale || fallback);
          } catch {
            return { unpublishedRelations: 0, draftM2mLinks: 0 };
          }
        };
      }

      strapi.log.info('[bootstrap] Content Manager patched: defaults to status=published');
    } catch (e: any) {
      strapi.log.warn(`[bootstrap] Could not patch document-manager: ${e.message}`);
    }

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
