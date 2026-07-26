/**
 * Markdown to HTML renderer for bitacora articles.
 * Uses `marked` v18 with custom styling classes for the Iwage design system.
 */
import { marked } from 'marked';

// Configure marked for GFM (tables, strikethrough) and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer with Tailwind classes matching the Iwage design system
const renderer = new marked.Renderer();

renderer.heading = (token: any) => {
  const styles: Record<number, string> = {
    1: 'text-3xl font-bold text-text-primary mt-12 mb-6',
    2: 'text-2xl font-bold text-text-primary mt-10 mb-4',
    3: 'text-xl font-semibold text-text-primary mt-8 mb-3',
    4: 'text-lg font-semibold text-text-primary mt-6 mb-2',
  };
  const cls = styles[token.depth] || styles[4];
  return `<h${token.depth} class="${cls}">${token.text}</h${token.depth}>`;
};

renderer.paragraph = (token: any) => {
  return `<p class="text-text-secondary leading-relaxed mb-4">${token.text}</p>`;
};

// Use regular function so `this.parser` is available for inline rendering
renderer.list = function (token: any) {
  const tag = token.ordered ? 'ol' : 'ul';
  const cls = token.ordered
    ? 'list-decimal list-inside space-y-2 mb-6 text-text-secondary'
    : 'list-disc list-inside space-y-2 mb-6 text-text-secondary';
  const items = (token.items || [])
    .map((item: any) => {
      let rendered = item.text;
      // Try to render inline tokens (bold, links, etc.) within list items
      if (item.tokens && item.tokens.length > 0) {
        try {
          rendered = (this as any).parser.parseInline(item.tokens);
        } catch {
          // Fallback: use raw text if tokens contain block-level elements
          rendered = item.text;
        }
      }
      return `<li class="leading-relaxed">${rendered}</li>`;
    })
    .join('');
  return `<${tag} class="${cls}">${items}</${tag}>`;
};

renderer.blockquote = (token: any) => {
  return `<blockquote class="border-l-4 border-brand/30 bg-brand-muted/20 pl-4 py-3 my-6 rounded-r-lg text-text-secondary italic">${token.text}</blockquote>`;
};

renderer.table = (token: any) => {
  let html = '<div class="overflow-x-auto my-6"><table class="w-full text-sm border-collapse">';
  html += '<thead><tr>';
  for (const cell of token.header || []) {
    html += `<th class="border border-border bg-surface-sunken px-4 py-2.5 text-left font-semibold text-text-primary">${cell.text}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of token.rows || []) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td class="border border-border px-4 py-2.5 text-text-secondary">${cell.text}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
};

renderer.hr = () => {
  return '<hr class="my-8 border-border" />';
};

renderer.link = (token: any) => {
  const external = token.href?.startsWith('http');
  const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${token.href}" class="text-brand font-medium hover:underline"${attrs}>${token.text}</a>`;
};

renderer.image = (token: any) => {
  const alt = token.text || '';
  const caption = alt ? `<figcaption class="text-xs text-text-muted mt-2 text-center">${alt}</figcaption>` : '';
  return `<figure class="my-8"><img src="${token.href}" alt="${alt}" class="rounded-xl w-full object-cover shadow-sm" loading="lazy" />${caption}</figure>`;
};

renderer.strong = (token: any) => {
  return `<strong class="font-semibold text-text-primary">${token.text}</strong>`;
};

renderer.em = (token: any) => {
  return `<em class="italic">${token.text}</em>`;
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
export function renderMarkdown(content: string): string {
  if (!content) return '';
  // Clean up any remaining literal backslash-n sequences from WP migration
  const cleaned = content.replace(/\\n/g, '\n');
  try {
    return marked.parse(cleaned, { renderer }) as string;
  } catch {
    // Fallback: basic paragraph splitting if marked fails on edge-case content
    return cleaned
      .split('\n\n')
      .filter(Boolean)
      .map(block => {
        if (block.startsWith('## ')) return `<h2 class="text-2xl font-bold text-text-primary mt-10 mb-4">${block.slice(3)}</h2>`;
        if (block.startsWith('# ')) return `<h1 class="text-3xl font-bold text-text-primary mt-12 mb-6">${block.slice(2)}</h1>`;
        return `<p class="text-text-secondary leading-relaxed mb-4">${block.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('\n');
  }
}
