/**
 * Markdown to HTML renderer for bitacora articles.
 * Uses `marked` v18 with custom styling classes for the Iwage design system.
 */
import { marked } from 'marked';
import { repararEnlaceInterno, type RegistroEnlaces } from './enlaces-interiores.ts';

export interface OpcionesRender {
  /**
   * Registro vivo de slugs para reparar enlaces heredados de la migración WP
   * (`/producto/...` y cross-links de raíz que daban 404 medido en producción).
   */
  registro?: RegistroEnlaces;
  /** Marca de la página que renderiza; decide el balde de fallback. */
  marca?: string;
}

// `marked.parse` con renderer propio corre SINCRÓNICO acá, así que el contexto
// vive entre el set y el clear sin ventana de intercalado en el hilo único.
let contexto: { registro: RegistroEnlaces; marca: string } | null = null;

// Configure marked for GFM (tables, strikethrough) and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer with Tailwind classes matching the Iwage design system
const renderer = new marked.Renderer();

// Use regular functions so `this.parser` is available: marked hands the RAW
// markdown text in `token.text`, so inline tokens (links, bold, italic) only
// become HTML when we parse them ourselves. Medido en producción 2026-10-04:
// 33 de 56 artículos publicados tenían `[texto](/ruta)` visible al lector por
// omitir este paso, y los que sobrevivían dentro de `<li>` mostraban `**txt**`.
function inline(ctx: any, token: any): string {
  if (token?.tokens?.length && ctx?.parser) {
    try {
      return ctx.parser.parseInline(token.tokens);
    } catch {
      return token.text ?? '';
    }
  }
  return token.text ?? '';
}

renderer.heading = function (token: any) {
  const styles: Record<number, string> = {
    1: 'text-3xl font-bold text-text-primary mt-12 mb-6',
    2: 'text-2xl font-bold text-text-primary mt-10 mb-4',
    3: 'text-xl font-semibold text-text-primary mt-8 mb-3',
    4: 'text-lg font-semibold text-text-primary mt-6 mb-2',
  };
  const cls = styles[token.depth] || styles[4];
  return `<h${token.depth} class="${cls}">${inline(this, token)}</h${token.depth}>`;
};

renderer.paragraph = function (token: any) {
  return `<p class="text-text-secondary leading-relaxed mb-4">${inline(this, token)}</p>`;
};

renderer.list = function (token: any) {
  const tag = token.ordered ? 'ol' : 'ul';
  const cls = token.ordered
    ? 'list-decimal list-inside space-y-2 mb-6 text-text-secondary'
    : 'list-disc list-inside space-y-2 mb-6 text-text-secondary';
  const items = (token.items || [])
    .map((item: any) => `<li class="leading-relaxed">${inline(this, item)}</li>`)
    .join('');
  return `<${tag} class="${cls}">${items}</${tag}>`;
};

renderer.blockquote = function (token: any) {
  const body = token?.tokens?.length && this.parser?.parse
    ? this.parser.parse(token.tokens)
    : (token.text ?? '');
  return `<blockquote class="border-l-4 border-brand/30 bg-brand-muted/20 pl-4 py-3 my-6 rounded-r-lg text-text-secondary italic">${body}</blockquote>`;
};

renderer.table = function (token: any) {
  let html = '<div class="overflow-x-auto my-6"><table class="w-full text-sm border-collapse">';
  html += '<thead><tr>';
  for (const cell of token.header || []) {
    html += `<th class="border border-border bg-surface-sunken px-4 py-2.5 text-left font-semibold text-text-primary">${inline(this, cell)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of token.rows || []) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td class="border border-border px-4 py-2.5 text-text-secondary">${inline(this, cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
};

renderer.hr = () => {
  return '<hr class="my-8 border-border" />';
};

renderer.link = function (token: any) {
  let href = token.href;
  if (contexto && typeof href === 'string') {
    const reparado = repararEnlaceInterno(href, contexto.registro, contexto.marca);
    if (reparado) href = reparado;
  }
  const external = href?.startsWith('http');
  const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${href}" class="text-brand font-medium hover:underline"${attrs}>${inline(this, token)}</a>`;
};

renderer.image = (token: any) => {
  const alt = token.text || '';
  return `<img src="${token.href}" alt="${alt}" class="rounded-xl max-w-full object-cover shadow-sm my-4" loading="lazy" />`;
};

renderer.strong = function (token: any) {
  return `<strong class="font-semibold text-text-primary">${inline(this, token)}</strong>`;
};

renderer.em = function (token: any) {
  return `<em class="italic">${inline(this, token)}</em>`;
};

renderer.code = (token: any) => {
  const lang = token.lang || 'text';
  return `<pre class="bg-dark-bg text-dark-text rounded-xl p-4 my-6 overflow-x-auto text-sm"><code class="language-${lang}">${token.text}</code></pre>`;
};

/**
 * Render markdown content to styled HTML.
 * Handles: headings, paragraphs, lists, tables, blockquotes, links, images,
 * inline bold/italic, code blocks, horizontal rules.
 */
export function renderMarkdown(content: string, opciones?: OpcionesRender): string {
  if (!content) return '';
  // Limpieza de la migración WP: secuencias `\n` literales y los placeholders
  // de imagen huérfanos (`![prompt larguísimo]` SIN URL — 13 de 56 artículos
  // publicados los llevan; ninguno tiene imagen con ruta). Sin URL no hay
  // imagen posible, y el lector veía el prompt crudo en la página.
  const cleaned = content
    .replace(/\\n/g, '\n')
    .replace(/!\[[^\]]*\](?!\()/g, '');
  const anterior = contexto;
  if (opciones?.registro) {
    contexto = { registro: opciones.registro, marca: opciones.marca || 'meliponas' };
  }
  try {
    return marked.parse(cleaned, { renderer }) as string;
  } catch (err: any) {
    // El fallback de párrafos-crudos fue exactamente lo que dejó invisible el
    // bug del en línea sin-parseado durante meses: sin grito no hay aviso.
    console.warn('[renderMarkdown] fell back a texto plano:', err?.message);
    return cleaned
      .split('\n\n')
      .filter(Boolean)
      .map(block => {
        if (block.startsWith('## ')) return `<h2 class="text-2xl font-bold text-text-primary mt-10 mb-4">${block.slice(3)}</h2>`;
        if (block.startsWith('# ')) return `<h1 class="text-3xl font-bold text-text-primary mt-12 mb-6">${block.slice(2)}</h1>`;
        return `<p class="text-text-secondary leading-relaxed mb-4">${block.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('\n');
  } finally {
    contexto = anterior;
  }
}
