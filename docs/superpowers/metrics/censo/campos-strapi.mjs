/**
 * Fila 4 del censo: campos de medio declarados en los esquemas de Strapi, cuántos
 * son y en cuántas representaciones distintas viven.
 *
 * Regla de captura (medida, no deducida de la prosa de la spec):
 *   - TODO campo `type: media` entra, se llame como se llame. Barrer solo por nombre
 *     perdía `experimento.documentos` (media multiple) y con él el 5º de esa forma.
 *   - Los que no son `media` entran por nombre, porque ahí es donde está la dispersión
 *     que hay que convertir (string, json).
 *   - Dos nombres pasan el regex y NO son medios; van en EXCLUIDOS con su motivo.
 *
 * Con esta regla: 41 campos en 5 representaciones, que es exactamente el número de la
 * spec. La diferencia con el barrido ingenuo por nombre (42) son los 2 excluidos, que
 * entran, y `documentos`, que sale.
 *
 *   node docs/superpowers/metrics/censo/campos-strapi.mjs [raiz]
 * `raiz` por defecto: strapi/src (relativo a donde se ejecuta).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const raiz = process.argv[2] || 'strapi/src';

// Nombres con pinta de medio: los candidatos a convertir.
const NOMBRE_MEDIO = /imagen|foto|galeria|image|video|tour|drone|thumbnail|mapa|hero|portada|evidencia|preview/i;

// Falsos positivos medidos, cada uno con su motivo.
const EXCLUIDOS = new Map([
  ['configuracion-sitio.hero_text', 'es `type: text`: el texto del hero, no una pieza audiovisual'],
  ['cafe-config.mapa_url', 'enlace de Google Maps que `cafe/index.astro` mete en un iframe; es mapa, no medio (decisión (a) del inventario del Task 11)'],
]);

function esquemas(dir, modo) {
  const salir = [];
  if (!existsSync(dir)) return salir;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const ruta = join(dir, entrada.name);
    if (modo === 'api') {
      for (const ct of existsSync(join(ruta, 'content-types')) ? readdirSync(join(ruta, 'content-types')) : []) {
        const hoja = join(ruta, 'content-types', ct, 'schema.json');
        if (existsSync(hoja)) salir.push([entrada.name, hoja]);
      }
    } else {
      for (const archivo of readdirSync(ruta)) {
        if (archivo.endsWith('.json')) salir.push([entrada.name, join(ruta, archivo)]);
      }
    }
  }
  return salir;
}

const archivos = [...esquemas(join(raiz, 'api'), 'api'), ...esquemas(join(raiz, 'components'), 'components')];

function representacion(a) {
  if (a.type === 'media') return a.multiple ? 'media multiple' : 'media simple';
  return `${a.type}${a.format ? `:${a.format}` : ''}`;
}

// Rol dentro del plan: qué paso del Task 11 le toca. Se deduce del nombre y del
// contexto del esquema, no de una lista a mano: así el "después" usa la misma regla.
function rol(campo, a, vecinosMedia) {
  if (a.type === 'media') return 'ya media';
  if (campo.endsWith('_url') && vecinosMedia.has(campo.slice(0, -4))) return 'twin de un media (borrar)';
  if (/^(video_url|tour.*_url|link_drone)$/.test(campo)) return 'embed';
  if (/thumbnail$/.test(campo) || /^mapa_/.test(campo)) return 'residual (borrar)';
  if (a.type === 'json') return 'galería json';
  if (/^(imagen|foto_territorio|portada|preview)$/.test(campo)) return 'portada string';
  return 'revisar';
}

const filas = [];
const omisiones = [];
for (const [modulo, ruta] of archivos) {
  const esquema = JSON.parse(readFileSync(ruta, 'utf8'));
  const attrs = esquema.attributes || {};
  const vecinosMedia = new Set(Object.entries(attrs).filter(([, a]) => a.type === 'media').map(([k]) => k));
  for (const [campo, a] of Object.entries(attrs)) {
    const id = `${modulo}.${campo}`;
    if (EXCLUIDOS.has(id)) {
      if (NOMBRE_MEDIO.test(campo) || a.type === 'media') omisiones.push(`${id} — ${EXCLUIDOS.get(id)}`);
      continue;
    }
    if (a.type !== 'media' && !NOMBRE_MEDIO.test(campo)) continue;
    filas.push({ id, representacion: representacion(a), rol: rol(campo, a, vecinosMedia) });
  }
}

const porRep = {};
const porRol = {};
for (const f of filas) {
  porRep[f.representacion] = (porRep[f.representacion] || 0) + 1;
  porRol[f.rol] = (porRol[f.rol] || 0) + 1;
}

console.log(`esquemas barridos   = ${archivos.length}`);
console.log(`campos de medio     = ${filas.length}`);
console.log(`representaciones    = ${Object.keys(porRep).length}`);
for (const [k, v] of Object.entries(porRep).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);
console.log('roles');
for (const [k, v] of Object.entries(porRol).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v}`);
console.log('excluidos del conteo');
for (const o of omisiones) console.log(`  ${o}`);
console.log('detalle');
for (const f of filas.sort((a, b) => a.id.localeCompare(b.id))) {
  console.log(`  ${f.id.padEnd(42)} ${f.representacion.padEnd(16)} ${f.rol}`);
}
