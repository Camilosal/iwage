/**
 * Fila 1 del censo: páginas cuyo <main> no renderiza ningún <img>.
 *
 * El crawler original del 2026-09-24 hizo esta cuenta como un one-liner suelto y
 * el número (141 de 185) quedó en la spec sin procedimiento versionado. Este
 * archivo es ese mismo criterio, fijado: `<main …>…</main>` no anidado, y una
 * página sin `<main>` cuenta como sin imagen (en el crawl de antes no ocurrió
 * ninguna, así que la rama no cambia el resultado).
 *
 *   node main-imgs.mjs <dir-crawl>       # dir-crawl contiene crawl.log y html/NNNN.html
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('uso: node main-imgs.mjs <dir-crawl>');
  process.exit(1);
}

// crawl.log tiene `indice|http_code|url`; el índice es también el nombre del HTML.
const idx = new Map();
for (const line of readFileSync(join(dir, 'crawl.log'), 'utf8').trim().split('\n')) {
  const [i, code, url] = line.split('|');
  idx.set(i, { code, page: url.replace('https://iwage.co', '') || '/' });
}

let conImg = 0;
let mainSinImg = 0;
let sinMain = 0;
const detalle = [];
const archivos = readdirSync(join(dir, 'html')).filter((f) => f.endsWith('.html')).sort();

for (const f of archivos) {
  const clave = f.replace(/\.html$/, '');
  const { page } = idx.get(clave) ?? { page: f };
  const html = readFileSync(join(dir, 'html', f), 'utf8');
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  if (!main) {
    sinMain += 1;
    detalle.push(`sin <main>\t${page}`);
    continue;
  }
  if (/<img\b/i.test(main[0])) {
    conImg += 1;
  } else {
    mainSinImg += 1;
    detalle.push(`main sin img\t${page}`);
  }
}

console.log(`páginas             = ${archivos.length}`);
console.log(`con <img> en <main> = ${conImg}`);
console.log(`<main> sin <img>    = ${mainSinImg}`);
console.log(`sin <main>          = ${sinMain}`);
console.log(`SIN imagen en main  = ${mainSinImg + sinMain}`);
if (process.argv.includes('--list')) for (const d of detalle) console.log('  ' + d);
