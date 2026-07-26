/**
 * RAG Context Assembler — formats retrieved chunks into LLM-ready context
 * and builds the multi-brand system prompt.
 */
import type { KnowledgeChunk, RetrievalResult, ChatLink, Brand } from './knowledge-index';
import { SITE } from '../../config/site';

// ── Brand Personas ───────────────────────────────────────

const BRAND_INFO: Record<string, { name: string; desc: string; icon: string }> = {
  meliponas: { name: 'Iwagé Meliponas', desc: 'Centro de meliponicultura: miel de Angelita, cajas INPA/AF, polinización y proyectos.', icon: '🐝' },
  cafe: { name: 'Café Iwagé', desc: 'Café comunitario con proveedores locales a menos de 4km.', icon: '☕' },
  tierras: { name: 'Iwagé Tierras', desc: 'Propiedades rurales verificadas en el Tolima con Sello VAP.', icon: '🏡' },
  naturaleza: { name: 'Iwagé Naturaleza', desc: 'Turismo regenerativo con experiencias curadas y anfitriones locales.', icon: '🌿' },
  gestion: { name: 'Iwagé Gestión', desc: 'Administración de propiedades: renta corta, fincas productivas y operación turística.', icon: '🔑' },
  general: { name: 'Iwagé', desc: 'Ecosistema de 5 marcas rurales en el Tolima, Colombia.', icon: '🌱' },
};

// ── System Prompt Builder ────────────────────────────────

/**
 * Build a dynamic system prompt with brand context and retrieved knowledge.
 */
export function buildSystemPrompt(brand: string, results: RetrievalResult[]): string {
  const brandInfo = BRAND_INFO[brand] || BRAND_INFO.general;

  const basePrompt = `Eres el asistente virtual de Iwagé, un ecosistema de 5 marcas rurales en Ibagué, Tolima, Colombia:
- 🐝 Meliponas: meliponicultura, miel de Angelita, cajas INPA/AF, polinización
- ☕ Café: café comunitario con proveedores locales
- 🏡 Tierras: propiedades rurales verificadas con Sello VAP
- 🌿 Naturaleza: turismo regenerativo con experiencias y anfitriones
- 🔑 Gestión: administración de propiedades (renta corta, fincas, turismo)

Contexto actual: ${brandInfo.icon} ${brandInfo.name} — ${brandInfo.desc}`;

  const contextSection = results.length > 0
    ? `\n\nINFORMACIÓN RECUPERADA DE NUESTRA PLATAFORMA (usa SOLO esta información para responder):\n${formatChunksForPrompt(results)}`
    : '\n\nNo se encontró información específica en nuestra plataforma para esta consulta.';

  const rules = `

REGLAS:
1. Responde en español, tono cálido y conciso (máximo 150 palabras).
2. USA SOLO la información recuperada. NO inventes precios, datos o disponibilidad.
3. Si la información recuperada no responde la pregunta, di honestamente que no tienes ese dato y sugiere contactar por WhatsApp (${SITE.whatsapp}) o visitar la página relevante.
4. Siempre que menciones un producto, propiedad, experiencia o artículo, indica que pueden verlo en el enlace correspondiente.
5. Si no hay información relevante, sugiere páginas de navegación útiles.
6. Para consultas complejas o de negociación, siempre sugiere contactar por WhatsApp.`;

  return basePrompt + contextSection + rules;
}

// ── Chunk Formatting ─────────────────────────────────────

function formatChunksForPrompt(results: RetrievalResult[]): string {
  return results.map(({ chunk }, i) => {
    const meta = formatMetadata(chunk);
    return `[${i + 1}] ${chunk.title} (${chunk.brand})
    URL: ${chunk.url}
    Resumen: ${chunk.summary}${meta ? `\n    Datos: ${meta}` : ''}`;
  }).join('\n\n');
}

function formatMetadata(chunk: KnowledgeChunk): string {
  const parts: string[] = [];
  const m = chunk.metadata;

  if (m.precio) parts.push(`Precio: $${Number(m.precio).toLocaleString('es-CO')} ${m.moneda || 'COP'}`);
  if (m.precio_desde) parts.push(`Desde: $${Number(m.precio_desde).toLocaleString('es-CO')}`);
  if (m.precio_noche) parts.push(`$${Number(m.precio_noche).toLocaleString('es-CO')}/noche`);
  if (m.municipio) parts.push(`Ubicación: ${m.municipio}`);
  if (m.tipo) parts.push(`Tipo: ${m.tipo}`);
  if (m.operacion) parts.push(`Operación: ${m.operacion}`);
  if (m.area_ha) parts.push(`Área: ${m.area_ha} ha`);
  if (m.categoria) parts.push(`Categoría: ${m.categoria}`);
  if (m.sello_vap) parts.push(`Sello VAP: ${m.sello_vap}`);
  if (m.duracion) parts.push(`Duración: ${m.duracion}`);
  if (m.dificultad) parts.push(`Dificultad: ${m.dificultad}/7`);

  return parts.join(' | ');
}

// ── Link Extraction ──────────────────────────────────────

/**
 * Extract actionable links from retrieval results.
 */
export function extractLinks(results: RetrievalResult[]): ChatLink[] {
  const seen = new Set<string>();
  const links: ChatLink[] = [];

  for (const { chunk } of results) {
    if (seen.has(chunk.url)) continue;
    seen.add(chunk.url);

    links.push({
      label: buildLinkLabel(chunk),
      url: chunk.url,
      type: chunk.type,
    });
  }

  return links.slice(0, 4); // max 4 links per response
}

function buildLinkLabel(chunk: KnowledgeChunk): string {
  const m = chunk.metadata;
  const icons: Record<string, string> = {
    propiedad: '🏡',
    propiedad_gestion: '🔑',
    experiencia: '🌿',
    anfitrion: '👤',
    paquete: '📦',
    menu: '☕',
    bitacora: '📖',
    producto: '🍯',
    proveedor: '🧑‍🌾',
    pagina: '📄',
  };

  const icon = icons[chunk.type] || '🔗';
  let label = `${icon} ${chunk.title}`;

  // Add price info if available
  if (m.precio) label += ` — $${(Number(m.precio) / 1_000_000).toFixed(0)}M`;
  else if (m.precio_desde) label += ` — desde $${(Number(m.precio_desde) / 1_000_000).toFixed(0)}M`;
  else if (m.precio_noche) label += ` — $${Number(m.precio_noche).toLocaleString('es-CO')}/noche`;

  return label;
}

// ── Suggestions ──────────────────────────────────────────

/**
 * Generate follow-up suggestions based on brand and results.
 */
export function generateSuggestions(brand: string, results: RetrievalResult[]): string[] {
  const suggestions: string[] = [];

  if (results.length === 0) {
    suggestions.push('¿Qué marcas tiene Iwagé?');
    suggestions.push('Hablar con un asesor por WhatsApp');
    return suggestions;
  }

  const types = new Set(results.map(r => r.chunk.type));

  if (types.has('propiedad')) {
    suggestions.push('Ver más propiedades similares');
    suggestions.push('¿Cómo funciona el Sello VAP?');
  }
  if (types.has('experiencia')) {
    suggestions.push('Ver paquetes turísticos');
    suggestions.push('¿Cómo reservo una experiencia?');
  }
  if (types.has('menu')) {
    suggestions.push('Ver el menú completo');
    suggestions.push('¿Quiénes son los proveedores?');
  }
  if (types.has('bitacora')) {
    suggestions.push('Ver más artículos');
  }
  if (types.has('producto')) {
    suggestions.push('¿Cómo hago un pedido?');
    suggestions.push('¿Hacen envíos?');
  }

  // Always add contact option
  suggestions.push('Contactar por WhatsApp');

  return suggestions.slice(0, 3);
}
