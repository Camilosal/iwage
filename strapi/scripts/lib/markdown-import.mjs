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
