/**
 * RAG Indexer — builds the knowledge index from all Strapi data sources.
 * Fetches content from every brand and produces searchable KnowledgeChunks.
 */
import type { KnowledgeChunk } from './knowledge-index';
import { RAG_INDEX_TTL, RAG_CACHE_KEY } from './knowledge-index';
import { getStaticPageChunks } from './url-map';
import { cacheGet, cacheSet } from '../redis';
import { getPropiedades } from '../tierras';
import { getExperiencias, getAnfitriones, getPaquetes, getIniciativas } from '../naturaleza';
import { getMenuItems, getProveedores, getHistoriasVisitantes } from '../cafe';
import { getPropiedadesGestion } from '../gestion';
import { getBitacoraByMarca, type Marca } from '../bitacora';
import { getExperimentos, type Experimento } from '../granja-experimentos';
import { strapiFetch, CACHE_TTL } from '../strapi';

// ── Index Builders ───────────────────────────────────────

async function indexPropiedades(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getPropiedades({ pageSize: 100 });
    const seen = new Set<string>();
    return data
      .filter((p) => {
        if (!p.slug || seen.has(p.slug)) return false;
        seen.add(p.slug);
        return true;
      })
      .map((p) => ({
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
    const seen = new Set<string>();
    return data
      .filter((e) => {
        if (!e.slug || seen.has(e.slug)) return false;
        seen.add(e.slug);
        return true;
      })
      .map((e) => ({
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
    const seen = new Set<string>();
    return data
      .filter((a) => {
        if (!a.slug || seen.has(a.slug)) return false;
        seen.add(a.slug);
        return true;
      })
      .map((a) => ({
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
    const seen = new Set<string>();
    return data
      .filter((p) => {
        if (!p.slug || seen.has(p.slug)) return false;
        seen.add(p.slug);
        return true;
      })
      .map((p) => ({
        id: `paquete:${p.slug}`,
        type: 'paquete' as const,
        brand: 'naturaleza' as const,
        title: p.titulo,
        summary: `${p.tagline || ''} ${p.duracion_texto || `${p.duracion_dias} días`}. ${p.descripcion || ''}`.slice(0, 200),
        keywords: [
          'paquete', 'tour', p.categoria || '', 'dias',
          ...(p.incluye || []).slice(0, 3),
        ].filter(Boolean).map(k => k.toLowerCase()),
        url: `/naturaleza/programas/${p.slug}`,
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
    const seen = new Set<string>();
    return items
      .filter((item) => {
        const k = item.slug || item.nombre.toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((item) => ({
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
    const seen = new Set<string>();
    return data
      .filter((p) => {
        const k = p.slug || p.nombre.toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((p) => ({
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
    const seen = new Set<string>();
    return data
      .filter((p) => {
        if (!p.slug || seen.has(p.slug)) return false;
        seen.add(p.slug);
        return true;
      })
      .map((p) => ({
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
        url: `/gestion/alojamientos/${p.slug}`,
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
      // Dedupe by slug (Strapi v5 returns draft+published rows for same slug)
      const seen = new Set<string>();
      for (const entry of data) {
        if (!entry.slug || seen.has(entry.slug)) continue;
        seen.add(entry.slug);
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

async function indexExperimentos(): Promise<KnowledgeChunk[]> {
  try {
    const { data } = await getExperimentos({ pageSize: 100 });
    const seen = new Set<string>();
    return data
      .filter((e) => {
        if (!e.slug || seen.has(e.slug)) return false;
        seen.add(e.slug);
        return true;
      })
      .map((e) => ({
        id: `experimento:${e.slug}`,
        type: 'experimento' as const,
        brand: 'granja' as const,
        title: e.titulo,
        summary: e.extracto || (e.origen || '').slice(0, 150),
        keywords: [
          'experimento', 'laboratorio', 'vivo', 'granja',
          e.subsistema || '', e.estado_experimento || '',
          ...e.titulo.toLowerCase().split(/\s+/).slice(0, 5),
        ].filter(Boolean),
        url: `/granja/experimentos/${e.slug}`,
        metadata: {
          subsistema: e.subsistema,
          estado: e.estado_experimento,
          fecha: e.fecha,
          tiempo_lectura: e.tiempo_lectura,
        },
        updatedAt: e.updatedAt || new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexProductos(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('productos', {
      ttl: CACHE_TTL.list,
      pagination: { pageSize: 50 },
      publicationState: 'live',
    });
    const data = res.data || [];
    const seen = new Set<string>();
    return data
      .filter((p: any) => {
        const k = p.slug || p.nombre?.toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((p: any) => ({
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

async function indexProyectos(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('proyecto-meliponarios', {
      ttl: CACHE_TTL.list,
      filters: { estado: { $ne: 'pausado' } },
      sort: ['orden:asc', 'nombre:asc'],
      pagination: { pageSize: 100 },
      publicationState: 'live',
    });
    const proyectos = (res.data || []);
    // Deduplicate by slug (Strapi v5 + i18n can return multiple locale rows)
    const seen = new Set<string>();
    const unique = proyectos.filter((p: any) => {
      if (!p.slug || seen.has(p.slug)) return false;
      seen.add(p.slug);
      return true;
    });
    return unique.map((p: any) => ({
      id: `proyecto:${p.slug}`,
      type: 'proyecto' as const,
      brand: 'meliponas' as const,
      title: p.nombre,
      summary: `${p.tipo} ${p.estado && p.estado !== 'en-proceso' ? `(${p.estado})` : ''} en ${p.municipio || p.ubicacion || 'Tolima'}. ${p.colmenas ? `${p.colmenas} colmenas. ` : ''}${p.descripcion_corta || (p.descripcion || '').slice(0, 120)}`.slice(0, 220),
      keywords: [
        'proyecto', 'meliponario', p.tipo, p.estado,
        p.municipio || '', 'tolima',
        ...(Array.isArray(p.tags) ? p.tags : []),
        p.cliente_tipo || '',
        ...(p.especies ? p.especies.split(',').map((s: string) => s.trim().toLowerCase()) : []),
        ...(p.modelo_caja ? [p.modelo_caja.toLowerCase()] : []),
        ...(p.prae_alineado ? ['prae', 'educativo'] : []),
      ].filter(Boolean).map(k => String(k).toLowerCase()),
      url: `/meliponas/proyectos/${p.slug}`,
      metadata: {
        tipo: p.tipo,
        estado: p.estado,
        municipio: p.municipio,
        vereda: p.vereda,
        colmenas: p.colmenas,
        modelo_caja: p.modelo_caja,
        cliente_tipo: p.cliente_tipo,
        iot_activo: p.iot_activo,
        prae_alineado: p.prae_alineado,
        destacado: p.destacado,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexCultivosPolinizacion(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('cultivo-polinizaciones', {
      ttl: CACHE_TTL.list,
      sort: ['nombre:asc'],
      pagination: { pageSize: 50 },
      publicationState: 'live',
    });
    const cultivos = (res.data || []);
    // Deduplicate by slug
    const seen = new Set<string>();
    const unique = cultivos.filter((c: any) => {
      if (!c.slug || seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });
    return unique.map((c: any) => ({
      id: `cultivo_polinizacion:${c.slug}`,
      type: 'cultivo_polinizacion' as const,
      brand: 'meliponas' as const,
      title: `Polinización de ${c.nombre}`,
      summary: `${c.descripcion_corta || c.rendimiento || c.descripcion || 'Servicio de polinización asistida con meliponas'}. ${c.familia_botanica ? `Familia ${c.familia_botanica}.` : ''} ${c.tarifa_por_hectarea ? `Tarifa: $${c.tarifa_por_hectarea.toLocaleString('es-CO')}/ha.` : ''}`.slice(0, 220),
      keywords: [
        'polinizacion', 'cultivo', 'meliponas', 'servicio',
        c.nombre.toLowerCase(),
        c.nombre_cientifico?.toLowerCase() || '',
        c.familia_botanica?.toLowerCase() || '',
        ...(Array.isArray(c.especies_meliponas) ? c.especies_meliponas.map((e: any) => e.nombre?.toLowerCase() || '').filter(Boolean) : []),
        ...(Array.isArray(c.meses_floracion) ? ['floracion'] : []),
      ].filter(Boolean).map(k => String(k).toLowerCase()),
      url: `/meliponas/polinizacion/${c.slug}`,
      metadata: {
        nombre_cientifico: c.nombre_cientifico,
        familia_botanica: c.familia_botanica,
        rendimiento: c.rendimiento,
        tarifa_por_hectarea: c.tarifa_por_hectarea,
        area_minima_ha: c.area_minima_ha,
        area_maxima_ha: c.area_maxima_ha,
        compatibilidad_organica: c.compatibilidad_organica,
        altitud_optima: c.altitud_optima_msnm,
        destacado: c.destacado,
      },
      updatedAt: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function indexLotesMiel(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('lote-miels', {
      ttl: CACHE_TTL.list,
      sort: ['fecha_cosecha:desc'],
      pagination: { pageSize: 50 },
      publicationState: 'live',
    });
    const data = res.data || [];
    const seen = new Set<string>();
    return data
      .filter((l: any) => {
        const k = l.codigo_lote || String(l.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((l: any) => ({
        id: `lote_miel:${l.codigo_lote || l.id}`,
        type: 'lote_miel' as const,
        brand: 'meliponas' as const,
        title: `Lote ${l.codigo_lote || l.id}${l.flora ? ` — ${l.flora}` : ''}`,
        summary: `${l.origen_meliponario ? `Origen: ${l.origen_meliponario}.` : ''} ${l.origen_altitud ? `Altitud: ${l.origen_altitud}.` : ''} ${l.perfil_cata || l.humedad || l.ph ? `Perfil: ${l.perfil_cata || 'miel cosechada'}.` : 'Lote de miel con trazabilidad verificable.'}`.slice(0, 220),
        keywords: [
          'lote', 'miel', 'trazabilidad', 'cosecha', 'meliponas',
          l.codigo_lote?.toLowerCase() || '',
          l.flora?.toLowerCase() || '',
          l.origen_meliponario?.toLowerCase() || '',
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/meliponas/trazabilidad',
        metadata: {
          codigo_lote: l.codigo_lote,
          fecha_cosecha: l.fecha_cosecha,
          flora: l.flora,
          humedad: l.humedad,
          ph: l.ph,
          altitud: l.origen_altitud,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexIniciativas(): Promise<KnowledgeChunk[]> {
  try {
    const iniciativas = await getIniciativas();
    const seen = new Set<string>();
    return iniciativas
      .filter((i) => {
        const k = i.documentId || String(i.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((i) => ({
        id: `iniciativa:${i.documentId || i.id}`,
        type: 'iniciativa' as const,
        brand: 'naturaleza' as const,
        title: i.titulo,
        summary: `${i.descripcion || ''} ${i.metrica ? `Métrica: ${i.metrica}.` : ''} ${i.estado ? `Estado: ${i.estado}.` : ''}`.slice(0, 220),
        keywords: [
          'iniciativa', 'impacto', 'naturaleza', 'fondo',
          i.titulo.toLowerCase(),
          i.estado?.toLowerCase() || '',
          i.icono || '',
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/naturaleza/impacto',
        metadata: {
          estado: i.estado,
          metrica: i.metrica,
          progreso: i.progreso,
          orden: i.orden,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexComplementos(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('complementos', {
      ttl: CACHE_TTL.list,
      filters: { disponible: { $eq: true } },
      sort: ['categoria:asc', 'nombre:asc'],
      pagination: { pageSize: 50 },
      publicationState: 'live',
    });
    const data = res.data || [];
    const seen = new Set<string>();
    return data
      .filter((c: any) => {
        const k = c.slug || c.documentId || String(c.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((c: any) => ({
        id: `complemento:${c.slug || c.documentId}`,
        type: 'complemento' as const,
        brand: 'gestion' as const,
        title: c.nombre,
        summary: `${c.categoria}: ${c.descripcion || 'Servicio complementario'}. Desde $${Number(c.precio || 0).toLocaleString('es-CO')} ${c.moneda || 'COP'} por ${c.precio_por || 'persona'}.`.slice(0, 220),
        keywords: [
          'complemento', 'servicio', 'adicional', c.categoria,
          c.nombre.toLowerCase(),
          c.categoria,
          ...(c.categoria === 'comida' ? ['cena', 'almuerzo', 'comida', 'gastronomia'] : []),
          ...(c.categoria === 'espectaculo' ? ['musica', 'fogata', 'cuenteria', 'show'] : []),
          ...(c.categoria === 'transporte' ? ['transporte', 'traslado', 'recogida'] : []),
          ...(c.categoria === 'compra_local' ? ['producto', 'compra', 'local', 'café', 'miel'] : []),
          ...(c.categoria === 'actividad' ? ['actividad', 'caminata', 'senderismo', 'cabalgata'] : []),
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/gestion/alojamientos',
        metadata: {
          categoria: c.categoria,
          precio: c.precio,
          moneda: c.moneda,
          precio_por: c.precio_por,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexHistoriasVisitantes(): Promise<KnowledgeChunk[]> {
  try {
    const historias = await getHistoriasVisitantes();
    const seen = new Set<string>();
    return historias
      .filter((h) => {
        const k = h.slug || h.documentId || String(h.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((h) => ({
        id: `historia_visitante:${h.slug || h.documentId}`,
        type: 'historia_visitante' as const,
        brand: 'cafe' as const,
        title: h.titulo,
        summary: `${h.categoria}: ${h.texto_corto || (h.texto_largo || '').slice(0, 130)}`.slice(0, 220),
        keywords: [
          'visitante', 'historia', 'cafe', h.categoria,
          h.titulo.toLowerCase(),
          ...(h.categoria === 'fauna' ? ['animal', 'ave', 'pajaro', 'fauna', 'silvestre'] : []),
          ...(h.categoria === 'flora' ? ['planta', 'arbol', 'flor', 'flora', 'nativa'] : []),
          ...(h.categoria === 'personas' ? ['persona', 'gente', 'cliente', 'visitante'] : []),
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/cafe/visitantes',
        metadata: {
          categoria: h.categoria,
          destacado: h.destacado,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexPilaresEstandar(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('pilar-estandars', {
      ttl: CACHE_TTL.list,
      sort: ['numero:asc'],
      pagination: { pageSize: 20 },
      publicationState: 'live',
    });
    const data = res.data || [];
    const seen = new Set<string>();
    return data
      .filter((p: any) => {
        const k = p.documentId || String(p.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((p: any) => ({
        id: `pilar_estandar:${p.documentId || p.id}`,
        type: 'pilar_estandar' as const,
        brand: 'tierras' as const,
        title: `Pilar ${p.numero}: ${p.titulo}`,
        summary: (p.descripcion || 'Pilar del estándar de verificación VAP para propiedades rurales.').slice(0, 220),
        keywords: [
          'pilar', 'vap', 'verificacion', 'estandar', 'tierras', 'propiedad',
          p.titulo.toLowerCase(),
          p.icono || '',
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/tierras/vap',
        metadata: {
          numero: p.numero,
          icono: p.icono,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

async function indexEtapasProyecto(): Promise<KnowledgeChunk[]> {
  try {
    const res = await strapiFetch<any>('etapa-proyectos', {
      ttl: CACHE_TTL.list,
      sort: ['numero:asc'],
      pagination: { pageSize: 20 },
      publicationState: 'live',
    });
    const data = res.data || [];
    const seen = new Set<string>();
    return data
      .filter((e: any) => {
        const k = e.documentId || String(e.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((e: any) => ({
        id: `etapa_proyecto:${e.documentId || e.id}`,
        type: 'etapa_proyecto' as const,
        brand: 'meliponas' as const,
        title: `Etapa ${e.numero}: ${e.titulo}`,
        summary: (e.descripcion || 'Etapa del proceso de diseño e instalación de un meliponario.').slice(0, 220),
        keywords: [
          'etapa', 'proceso', 'meliponario', 'proyecto', 'instalacion',
          e.titulo.toLowerCase(),
          'diagnostico', 'diseno', 'instalacion', 'seguimiento',
        ].filter(Boolean).map(k => String(k).toLowerCase()),
        url: '/meliponas/proyectos',
        metadata: {
          numero: e.numero,
        },
        updatedAt: new Date().toISOString(),
      }));
  } catch { return []; }
}

// ── Cross-Brand Linking ──────────────────────────────────

/**
 * Enrich chunks with cross-brand references.
 * Links properties to nearby experiences, experiences to their anfitriones, etc.
 */
function enrichCrossReferences(index: KnowledgeChunk[]): void {
  const byMunicipio = new Map<string, KnowledgeChunk[]>();

  // Group chunks by municipio/location for geographic cross-linking
  for (const chunk of index) {
    const municipio = (chunk.metadata.municipio || chunk.metadata.ubicacion || '').toLowerCase().trim();
    if (municipio) {
      const group = byMunicipio.get(municipio) || [];
      group.push(chunk);
      byMunicipio.set(municipio, group);
    }
  }

  // For properties: link to experiences and gestion in same municipio
  for (const chunk of index) {
    if (chunk.type === 'propiedad' || chunk.type === 'propiedad_gestion') {
      const municipio = (chunk.metadata.municipio || '').toLowerCase().trim();
      if (!municipio) continue;

      const nearby = byMunicipio.get(municipio) || [];
      const related = nearby
        .filter(c => c.id !== chunk.id && (c.type === 'experiencia' || c.type === 'anfitrion' || c.type === 'propiedad_gestion'))
        .slice(0, 3)
        .map(c => ({ url: c.url, title: c.title, type: c.type }));

      if (related.length > 0) chunk.related = related;
    }

    // For experiences: link to anfitriones and propiedades in same area
    if (chunk.type === 'experiencia') {
      const ubicacion = (chunk.metadata.ubicacion || '').toLowerCase().trim();
      if (!ubicacion) continue;

      const nearby = byMunicipio.get(ubicacion) || [];
      const related = nearby
        .filter(c => c.id !== chunk.id && (c.type === 'propiedad' || c.type === 'anfitrion' || c.type === 'proveedor'))
        .slice(0, 3)
        .map(c => ({ url: c.url, title: c.title, type: c.type }));

      if (related.length > 0) chunk.related = related;
    }
  }
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
    experimentos,
    productos,
    proyectos,
    cultivos,
    lotesMiel,
    iniciativas,
    complementos,
    historias,
    pilares,
    etapas,
  ] = await Promise.all([
    indexPropiedades(),
    indexExperiencias(),
    indexAnfitriones(),
    indexPaquetes(),
    indexMenu(),
    indexProveedores(),
    indexPropiedadesGestion(),
    indexBitacora(),
    indexExperimentos(),
    indexProductos(),
    indexProyectos(),
    indexCultivosPolinizacion(),
    indexLotesMiel(),
    indexIniciativas(),
    indexComplementos(),
    indexHistoriasVisitantes(),
    indexPilaresEstandar(),
    indexEtapasProyecto(),
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
    ...experimentos,
    ...productos,
    ...proyectos,
    ...cultivos,
    ...lotesMiel,
    ...iniciativas,
    ...complementos,
    ...historias,
    ...pilares,
    ...etapas,
  ];

  // ── Cross-brand linking (Phase 5.2) ────────────────────────
  enrichCrossReferences(index);

  // Cache the index
  if (index.length > 0) {
    await cacheSet(RAG_CACHE_KEY, index, RAG_INDEX_TTL);
  }

  console.log(`[rag] Knowledge index built: ${index.length} chunks`);
  return index;
}
