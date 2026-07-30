import { factories } from '@strapi/strapi';

/**
 * Controller de Experiencia + receptor del sync inverso de app_reservas.
 * POST /api/experiencias/sync-aliado — upsert por slug de la experiencia
 * espejo de un recurso de aliado (tipo_propiedad: local-partner).
 */
export default factories.createCoreController('api::experiencia.experiencia', () => ({
  async syncAliado(ctx) {
    const token = ctx.request.header['x-sync-token'];
    const expected = process.env.RESERVAS_SYNC_TOKEN;
    if (!expected || token !== expected) {
      return ctx.unauthorized('Token de sincronización inválido');
    }

    const body = ctx.request.body || {};
    const exp = body.experiencia;
    if (!exp?.slug || !exp?.titulo) {
      return ctx.badRequest('experiencia.slug y experiencia.titulo son requeridos');
    }

    const publicado = body.publicado !== false;

    const data: Record<string, unknown> = {
      titulo: exp.titulo,
      slug: exp.slug,
      categoria: exp.categoria || 'Naturaleza',
      precio_desde: exp.precio_desde ?? null,
      duracion: exp.duracion || null,
      tipo_propiedad: 'local-partner',
      imagen_hero_url: exp.imagen_hero_url || null,
      galeria_urls: Array.isArray(exp.galeria_urls) ? exp.galeria_urls : [],
      seo_descripcion: exp.seo_descripcion || null,
      highlights: Array.isArray(exp.highlights) ? exp.highlights : [],
      publicado,
      etiquetas_personalizadas: {
        origen: 'app_reservas',
        recurso_slug: exp.slug,
        aliado: exp.etiquetas_personalizadas?.aliado || null,
        ...(exp.etiquetas_personalizadas || {}),
      },
    };
    if (exp.cupo_maximo_desc) data.cupo_maximo_desc = exp.cupo_maximo_desc;

    const documents = strapi.documents('api::experiencia.experiencia');
    const existentes = await documents.findMany({
      filters: { slug: { $eq: exp.slug } },
      limit: 1,
    });

    let result;
    let action: 'created' | 'updated';
    if (existentes.length) {
      result = await documents.update({
        documentId: existentes[0].documentId,
        data: data as any,
      });
      action = 'updated';
    } else {
      result = await documents.create({ data: data as any });
      action = 'created';
    }

    strapi.log.info(`[sync-aliado] Experiencia ${action}: ${exp.slug} (publicado=${publicado})`);
    ctx.body = { data: { documentId: result.documentId, slug: result.slug }, action };
  },
}));
