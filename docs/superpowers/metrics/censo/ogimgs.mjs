/**
 * Fila 10 del censo — integridad de la `og:image` SERVIDA.
 *
 * Por qué va sobre HTML y no sobre `src/`: por el mismo motivo que hizo que la fila 6 dejara
 * de leerse con `grep`. `ogImageDe()` arma `https://iwage.co/images/hero-<slug>.webp` por
 * interpolación, así que la etiqueta puede salir absoluta y bien formada apuntando a un 404.
 * `tests/og-image-absoluta.test.mjs` prueba la FORMA (que sea absoluta, que no se le escape
 * un host interno); la EXISTENCIA del destino solo la miden este script y el disco.
 *
 * Qué reporta y qué no:
 *   - páginas con / sin og:image, agrupando las ausencias por sección para no volver a contar
 *     como hueco lo que es página interna sin imagen;
 *   - destinos únicos con su conteo, clasificados en `public/` (verificable en disco),
 *     `/uploads/` (volumen de Strapi: «no verificable en disco» no es «roto») o externo;
 *   - los que se declaran de la propia y NO están en `public/` — que es exactamente el
 *     agujero que `tests/medios-literales.test.mjs` cubre en el código y este cubre en el
 *     HTML servido.
 *
 * Uso:  node docs/superpowers/metrics/censo/ogimgs.mjs <dir-crawl> [<repo>] [--list]
 *   <dir-crawl> carpeta con `crawl.log` y `html/NNNN.html` del crawl de las 185 URLs.
 *   <repo>      raíz del repo para resolver `public/`; por defecto el padre de este script.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `property` puede venir antes o después de `content`: se aceptan los dos órdenes.
const OG = /<meta\b[^>]*>/g;
const ES_PROPIEDAD = (tag, nombre) =>
  new RegExp(`\\b(?:property|name)=["']${nombre}["']`).test(tag);
const contentDe = (tag) => tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? null;

// Un og:image con host interno es roto en cualquier crawl, incluso en el preview local donde
// ese host ES el origen: lo prohíbe `esPintable()` en src/lib/media.ts y esta fila lo comprueba
// sobre lo servido.
const INTERNO = /^(https?:)?\/\/([a-z0-9.-]*(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|iwage_strapi|strapi_backend))/i;

function lecturaPaginas(dir) {
  const idx = new Map();
  const lineas = readFileSync(join(dir, 'crawl.log'), 'utf8').trim().split('\n');
  for (const linea of lineas) {
    const [i, code, url] = linea.split('|');
    const { pathname, origin } = new URL(url);
    idx.set(i, { code, page: pathname || '/', origin });
  }
  // El origen se deduce del propio crawl: con `https://iwage.co` quemado, un preview local
  // clasificaría TODAS las og:image como externas.
  const origen = new URL(lineas[0].split('|')[2]).origin;
  const paginas = [];
  for (const f of readdirSync(join(dir, 'html')).filter((x) => x.endsWith('.html')).sort()) {
    const clave = f.replace(/\.html$/, '');
    const { code = '?', page = f } = idx.get(clave) ?? {};
    const html = readFileSync(join(dir, 'html', f), 'utf8');
    const tags = html.match(OG) ?? [];
    paginas.push({
      page,
      code,
      og: tags.filter((t) => ES_PROPIEDAD(t, 'og:image')).map(contentDe).filter(Boolean),
    });
  }
  return { paginas, origen };
}

export function medirOgImages({ dir, repo }) {
  const { paginas, origen } = lecturaPaginas(dir);
  // Un preview local levantado sin SITE_URL emite og:image con su propio localhost. Ahí la
  // fuga de host interno NO es medible, y llamarla «rota» sería un falso positivo.
  const origenInterno = INTERNO.test(origen);
  const conOg = paginas.filter((p) => p.og.length > 0);
  const sinOg = paginas.filter((p) => p.og.length === 0);
  const duplicadas = paginas.filter((p) => p.og.length > 1);

  const destinos = new Map();
  for (const p of conOg) for (const u of p.og) destinos.set(u, (destinos.get(u) ?? 0) + 1);

  const roto = [];
  const uploads = [];
  const externo = [];
  const local = new Map();
  for (const [url, veces] of destinos) {
    let abs;
    try {
      abs = new URL(url);
    } catch {
      // `og:image` tiene que ser absoluta para que la lea el crawler de Facebook: una ruta
      // pelada es un fallo aunque el archivo exista en `public/`.
      roto.push({ url, ruta: url, veces, motivo: 'no es una URL absoluta' });
      continue;
    }
    if (!origenInterno && INTERNO.test(url)) {
      roto.push({ url, ruta: abs.pathname, veces, motivo: 'host interno en la etiqueta' });
      continue;
    }
    if (abs.origin !== origen) {
      externo.push({ url, veces, motivo: `origen ${abs.origin} (el crawl es ${origen})` });
      continue;
    }
    // Los `/uploads/` viven en el volumen de Strapi, no en `public/`: se reportan aparte para
    // que «no verificable en disco» no se lea como «roto».
    if (abs.pathname.startsWith('/uploads/')) {
      uploads.push({ url, veces });
      continue;
    }
    if (existsSync(join(repo, 'public', abs.pathname))) local.set(abs.pathname, veces);
    else roto.push({ url, ruta: abs.pathname, veces, motivo: 'no existe en public/' });
  }

  // Las ausencias se agrupan por la primera sección del path: «24 sin og:image» sin agrupar
  // se lee como 24 huecos, y 24 de 185 son `/ayuda/*` y `/legal/*`.
  const porSeccion = new Map();
  for (const p of sinOg) {
    const seccion = p.page === '/' ? '/' : `/${p.page.split('/')[1] ?? ''}/`;
    porSeccion.set(seccion, (porSeccion.get(seccion) ?? 0) + 1);
  }

  return {
    origen,
    origenInterno,
    total: paginas.length,
    conOg: conOg.length,
    sinOg: sinOg.length,
    sinOgPaginas: sinOg,
    duplicadas,
    destinos: [...destinos].sort((a, b) => b[1] - a[1]),
    local: [...local].sort((a, b) => b[1] - a[1]),
    roto,
    uploads,
    externo,
    porSeccion: [...porSeccion].sort((a, b) => b[1] - a[1]),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, repoArg] = process.argv.slice(2);
  if (!dir) {
    console.error('uso: node docs/superpowers/metrics/censo/ogimgs.mjs <dir-crawl> [<repo>] [--list]');
    process.exit(2);
  }
  const repo = repoArg && !repoArg.startsWith('--')
    ? repoArg
    : join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const m = medirOgImages({ dir, repo });
  console.log(`   TOTAL og:image rotas=${m.roto.length}   (métricas de la fila: lo que el sitio anuncia y no aterriza)`);
  console.log(`   midido contra      = ${m.origen}${m.origenInterno ? '  (preview local: el chequeo de host interno no aplica)' : ''}`);
  console.log(`   páginas            = ${m.total}`);
  console.log(`   con og:image       = ${m.conOg}`);
  console.log(`   sin og:image       = ${m.sinOg}  (${m.porSeccion.map(([s, n]) => `${s}=${n}`).join(', ')})`);
  console.log(`   con >1 og:image    = ${m.duplicadas.length}`);
  console.log(`   destinos únicos    = ${m.destinos.length}`);
  for (const r of m.roto) console.log(`     ROTO    ${r.ruta.padEnd(32)} ${String(r.veces).padEnd(4)} — ${r.motivo}`);
  for (const e of m.externo) console.log(`     externo ${e.url} x${e.veces} — ${e.motivo}`);
  for (const u of m.uploads) console.log(`     subidas ${u.url} x${u.veces} — volumen de Strapi, no verificable en public/`);
  for (const [ruta, veces] of m.local) console.log(`     ok      ${ruta.padEnd(32)} ${veces}`);
  if (process.argv.includes('--list')) for (const p of m.sinOgPaginas) console.log(`       sin og\t${p.page}`);
}
