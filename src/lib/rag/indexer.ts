/**
 * RAG Indexer — builds the knowledge index from all Strapi data sources.
 * Fetches content from every brand and produces searchable KnowledgeChunks.
 */
import type { KnowledgeChunk } from './knowledge-index';
import { RAG_INDEX_TTL, RAG_CACHE_KEY } from './knowledge-index';
import { getStaticPageChunks } from './url-map';
import { cacheGet, cacheSet } from '../redis';
import { getPropiedades } from '../tierras';
import { getExperiencias, getAnfitriones, getPaquetes } from '../naturaleza';
import { getMenuItems, getProveedores } from '../cafe';
import { getPropiedadesGestion } from '../gestion';
import { getBitacoraByMarca, type Marca } from '../bitacora';
import { strapiFetch, CACHE_TTL } from '../strapi';

// ── Index Builders ───────────────────────────────────────

async function indexPropiedades(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getPropiedades({ pageSize: 100 });
    return data.map((p) => ({
      id: `propiedad:${p.slug}`,
      type: 'propiedad' as const,
      brand: 'tierras' as const,
      title: p.titulo,
      summary: `${p.tipo_propiedad} en ${p.ubicacion_municipio || 'Tolima'}, ${p.area_hectareas ? `${p.area_hectareas} ha` : ''}. ${p.operacion === 'venta' ? 'En venta' : 'En arriendo'}${p.precio ? ` por $${(p.precio / 1_000_000).toFixed(0)}M` : ''}.`,
      keywords: [
        p.tipo_propiedad, p.operacion, p.ubicacion_municipio || '', 'tolima',
        p.perfil_comprador || '', p.sello_vap || '',
        ...(p.detalle_rural?.apta_glamping_agroturismo ? ['glamping', 'turismo'] : []),
        ...(p.detalle_rural?.cobertura_starlink_verificada ? ['internet', 'starlink'] : []),
        ...(p.detalle_rural?.tiene_concesion_agua ? ['agua', 'concesion'] : []),
      ].filter(Boolean).map(k => k.toLowerCase()),
      url: `/tierras/propiedades/${p.slug}`,
      metadata: {
        precio: p.precio,
        moneda: p.moneda,
        tipo: p.tipo_propiedad,
        operacion: p.operacion,
        municipio: p.ubicacion_municipio,
        area_ha: p.area_hectareas,
        sello_vap: p.sello_vap,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexExperiencias(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getExperiencias({ pageSize: 100 });
    return data.map((e) => ({
      id: `experiencia:${e.slug}`,
      type: 'experiencia' as const,
      brand: 'naturaleza' as const,
      title: e.titulo,
      summary: `${e.categoria || 'Experiencia'} en ${e.ubicacion || 'Tolima'}. ${e.resumen || ''}`.slice(0, 200),
      keywords: [
        e.categoria || '', e.ubicacion || '', 'experiencia', 'turismo',
        ...(e.highlights || []).slice(0, 3),
        e.tipo_propiedad || '',
      ].filter(Boolean).map(k => k.toLowerCase()),
      url: `/naturaleza/experiencias/${e.slug}`,
      metadata: {
        categoria: e.categoria,
        precio_desde: e.precio_desde,
        dificultad: e.nivel_dificultad,
        ubicacion: e.ubicacion,
        duracion: e.duracion,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexAnfitriones(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getAnfitriones(1, 50);
    return data.map((a) => ({
      id: `anfitrion:${a.slug}`,
      type: 'anfitrion' as const,
      brand: 'naturaleza' as const,
      title: a.nombre,
      summary: `${a.especialidad || 'Anfitrión local'}. ${a.manifiesto || a.historia_personal || ''}`.slice(0, 200),
      keywords: [
        'anfitrion', 'guia', a.especialidad || '', 'territorio',
        a.nombre_escalafon || '',
      ].filter(Boolean).map(k => k.toLowerCase()),
      url: `/naturaleza/anfitriones/${a.slug}`,
      metadata: {
        especialidad: a.especialidad,
        nivel: a.nivel_escalafon,
        calificacion: a.calificacion_promedio,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexPaquetes(): Promise<KnowledgeChunk[]> {
  try {
    const data = await getPaquetes();
    return data.map((p) => ({
      id: `paquete:${p.slug}`,
      type: 'paquete' as const,
      brand: 'naturaleza' as const,
      title: p.titulo,
      summary: `${p.tagline || ''} ${p.duracion_texto || `${p.duracion_dias} días`}. ${p.descripcion || ''}`.slice(0, 200),
      keywords: [
        'paquete', 'tour', p.categoria || '', 'dias',
        ...(p.incluye || []).slice(0, 3),
      ].filter(Boolean).map(k => k.toLowerCase()),
      url: `/naturaleza/paquetes/${p.slug}`,
      metadata: {
        precio_base: p.precio_base,
        duracion_dias: p.duracion_dias,
        categoria: p.categoria,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexMenu(): Promise<KnowledgeChunk[]> {
  try {
    const items = await getMenuItems();
    return items.map((item) => ({
      id: `menu:${item.slug || item.nombre.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'menu' as const,
      brand: 'cafe' as const,
      title: item.nombre,
      summary: `${item.categoria}: ${item.descripcion || item.historia || ''}`.slice(0, 200),
      keywords: [
        'menu', 'cafe', item.categoria, item.nombre.toLowerCase(),
        ...(item.tags || []).map(t => t.toLowerCase()),
        ...(item.temporada ? ['temporada'] : []),
      ].filter(Boolean),
      url: '/cafe/menu',
      metadata: {
        categoria: item.categoria,
        precio: item.precio,
        disponible: item.disponible,
        temporada: item.temporada,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexProveedores(): Promise<KnowledgeChunk[]> {
  try {
    const data = await getProveedores();
    return data.map((p) => ({
      id: `proveedor:${p.slug || p.nombre.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'proveedor' as const,
      brand: 'cafe' as const,
      title: p.nombre,
      summary: `${p.producto || 'Proveedor local'} en ${p.ubicacion || 'Tolima'}. ${p.historia || ''}`.slice(0, 200),
      keywords: [
        'proveedor', 'local', p.producto || '', p.ubicacion || '',
      ].filter(Boolean).map(k => k.toLowerCase()),
      url: '/cafe/proveedores',
      metadata: {
        producto: p.producto,
        ubicacion: p.ubicacion,
        distancia_km: p.distancia_km,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexPropiedadesGestion(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getPropiedadesGestion({ pageSize: 100 });
    return data.map((p) => ({
      id: `propiedad_gestion:${p.slug}`,
      type: 'propiedad_gestion' as const,
      brand: 'gestion' as const,
      title: p.titulo,
      summary: `${p.tipo_gestion.replace(/_/g, ' ')} en ${p.ubicacion_municipio || 'Tolima'}. ${p.descripcion || ''}`.slice(0, 200),
      keywords: [
        'gestion', p.tipo_gestion, p.modelo_alianza || '',
        p.ubicacion_municipio || '', 'administracion',
        ...(p.amenidades || []).slice(0, 3).map(a => a.toLowerCase()),
      ].filter(Boolean),
      url: `/gestion/propiedades/${p.slug}`,
      metadata: {
        tipo_gestion: p.tipo_gestion,
        precio_noche: p.precio_noche,
        precio_mensual: p.precio_mensual,
        municipio: p.ubicacion_municipio,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexBitacora(): Promise<KnowledgeChunk[]> {
  const marcas: Marca[] = ['meliponas', 'cafe', 'tierras', 'naturaleza', 'gestion'];
  const chunks: KnowledgeChunk[] = [];

  for (const marca of marcas) {
    try {
      const { data } = await getBitacoraByMarca(marca, { pageSize: 30 });
      for (const entry of data) {
        chunks.push({
          id: `bitacora:${entry.slug}`,
          type: 'bitacora',
          brand: marca,
          title: entry.titulo,
          summary: entry.extracto || (entry.contenido || '').slice(0, 150),
          keywords: [
            'bitacora', 'blog', 'articulo', marca,
            entry.categoria || '',
            ...entry.titulo.toLowerCase().split(/\s+/).slice(0, 5),
          ].filter(Boolean),
          url: `/${marca}/bitacora/${entry.slug}`,
          metadata: {
            categoria: entry.categoria,
            fecha: entry.fecha,
            tiempo_lectura: entry.tiempo_lectura,
          },
          updatedAt: entry.publishedAt || new Date().toISOString(),
        });
      }
    } catch { /* skip brand on error */ }
  }
  return chunks;
}

async function indexProductos(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('productos', {
      ttl: CACHE_TTL.list,
      pagination: { pageSize: 50 },
    });
    return (res.data || []).map((p: any) => ({
      id: `producto:${p.slug || p.nombre?.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'producto' as const,
      brand: 'meliponas' as const,
      title: p.nombre || 'Producto',
      summary: `${p.descripcion || ''}`.slice(0, 200),
      keywords: [
        'producto', 'tienda', 'miel', 'meliponas',
        p.nombre?.toLowerCase() || '',
        p.categoria || '',
      ].filter(Boolean),
      url: '/meliponas/tienda',
      metadata: {
        precio: p.precio,
        categoria: p.categoria,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

// ── Main Index Builder ───────────────────────────────────

/**
 * Build the full knowledge index from all data sources.
 * Results are cached in Redis for RAG_INDEX_TTL seconds.
 */
export async function buildKnowledgeIndex(): Promise<KnowledgeChunk[]> {
  // Try cache first
  const cached = await cacheGet<KnowledgeChunk[]>(RAG_CACHE_KEY);
  if (cached && cached.length > 0) return cached;

  // Build index from all sources in parallel
  const [
    propiedades,
    experiencias,
    anfitriones,
    paquetes,
    menu,
    proveedores,
    gestion,
    bitacora,
    productos,
  ] = await Promise.all([
    indexPropiedades(),
    indexExperiencias(),
    indexAnfitriones(),
    indexPaquetes(),
    indexMenu(),
    indexProveedores(),
    indexPropiedadesGestion(),
    indexBitacora(),
    indexProductos(),
  ]);

  const staticPages = getStaticPageChunks();

  const index = [
    ...staticPages,
    ...propiedades,
    ...experiencias,
    ...anfitriones,
    ...paquetes,
    ...menu,
    ...proveedores,
    ...gestion,
    ...bitacora,
    ...productos,
  ];

  // Cache the index
  if (index.length > 0) {
    await cacheSet(RAG_CACHE_KEY, index, RAG_INDEX_TTL);
  }

  console.log(`[rag] Knowledge index built: ${index.length} chunks`);
  return index;
}
