/**
 * Utilidades puras para importar los borradores de Publicaciones/*.md a Strapi.
 * Sin red ni acceso a disco: todo entra y sale por parámetros, para poder testear.
 */

/** Slug de WordPress a slug-canónico: sin acentos, sin fechas sueltas, guiones simples. */
export function limpiarSlug(input) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/-(?:19|20)\d\d(?:-(?:0[1-9]|[12]\d)(?:-\d{1,2})?)?(?=-|$)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Front matter YAML en el subconjunto que emite el export: scalares y listas en línea. */
export function parseFrontMatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { data: {}, body: texto };
  const data = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linea);
    if (kv) data[kv[1]] = parsearValor(kv[2]);
  }
  return { data, body: texto.slice(m[0].length).replace(/^\r?\n+/, '') };
}

function parsearValor(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const q = /^"([\s\S]*)"|'([\s\S]*)'/.exec(v);
  if (q) return q[1] ?? q[2];
  return v;
}

/** Quita los placeholders de imagen sugerida y las imágenes alojadas en el WordPress borrado. */
export function quitarPlaceholders(cuerpo) {
  return cuerpo
    .replace(/^!\[[^\]]*Imagen sugerida[^\]]*\]\([^)]*\)\s*$/gim, '')
    .replace(/^!\[[^\]]*\]\(https?:\/\/[^)]*tienda\.iwage\.co[^)]*\)\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Primer párrafo utilizable: descarta títulos, imágenes y bloques sueltos de separación. */
export function extraerExtracto(cuerpo, max = 200) {
  for (const bloque of cuerpo.split(/\n{2,}/)) {
    const t = bloque.trim();
    if (!t || /^(#|!\[|\||-{3,}|\* \* \*)/.test(t)) continue;
    const limpio = t
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (limpio.length < 40) continue;
    if (limpio.length <= max) return limpio;
    const corte = limpio.lastIndexOf(' ', max);
    return limpio.slice(0, corte > 60 ? corte : max) + '…';
  }
  return '';
}

export function calcularTiempoLectura(cuerpo) {
  const palabras = (cuerpo.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(palabras / 220));
}
