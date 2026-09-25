// Fila 6 del censo — «piezas producidas y nunca enlazadas».
//
// Por qué existe este archivo y no un `grep` en `censo.sh`: el comando histórico era
// `grep -rqn "$base" src/`, y eso cuenta como «enlazada» cualquier coincidencia, incluida
// la que vive dentro de un bloque comentado de Astro (`{/* … */}`), que no se pinta nunca.
// Medido en los dos crawls del censo (185 URLs cada uno, `/home/ubuntu/backup/iwaudit-*`):
// `proyecto-ambala-1.webp` aparece en `src/` una sola vez, en `meliponas/index.astro:160`,
// dentro de un bloque comentado, y en 0 de los 185 HTML. Con el grep viejo la fila leía 47;
// fuera de los comentarios lee 48.
//
// Qué NO es esta medida: «enlazada» acá significa «algún camino de código puede emitir el
// archivo». Después de F1/F2 el dueño de las piezas es Strapi, así que el cableado real se
// ve en la fila 3 (registros publicados con un medio), no acá. Esta fila sirve para saber
// cuántas piezas hay esperando `--apply`, y para ver el tránsito cuando la Tarea 13 quite
// las reglas por nombre de `cafe-menu`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ES_IMAGEN = /\.(webp|png|jpe?g|avif|gif)$/i;
// No glotón y multilínea: dos bloques consecutivos se quitan de a uno, y lo de en medio queda.
const BLOQUE_COMENTADO = /\{\/\*[\s\S]*?\*\/\}/g;

export function fueraDeComentarios(texto) {
  return texto.replace(BLOQUE_COMENTADO, ' ');
}

export function puedePintarse(nombre, texto) {
  return fueraDeComentarios(texto).includes(nombre);
}

function textoDeFuentes(dir) {
  const pila = [dir];
  const partes = [];
  while (pila.length) {
    const actual = pila.pop();
    for (const nombre of readdirSync(actual)) {
      const ruta = join(actual, nombre);
      const st = statSync(ruta);
      if (st.isDirectory()) pila.push(ruta);
      else if (st.isFile()) partes.push(fueraDeComentarios(readFileSync(ruta, 'utf8')));
    }
  }
  return partes.join('\n');
}

export function medirHuerfanas({ repo, dirs }) {
  const fuentes = textoDeFuentes(join(repo, 'src'));
  const porDir = {};
  let total = 0;
  for (const dir of dirs) {
    const base = join(repo, 'public', 'images', dir);
    const piezas = existsSync(base)
      ? readdirSync(base).filter((f) => ES_IMAGEN.test(f)).sort()
      : [];
    const nombres = piezas.filter((f) => !fuentes.includes(f));
    porDir[dir] = {
      total: piezas.length,
      huerfanas: nombres.length,
      nombres: nombres.map((f) => `${dir}/${f}`),
    };
    total += nombres.length;
  }
  return { porDir, total };
}

const DIRECTORIOS = ['bitacora', 'galeria', 'cafe-menu'];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const conNombres = process.argv.includes('--nombres');
  const m = medirHuerfanas({ repo, dirs: DIRECTORIOS });
  for (const dir of DIRECTORIOS) {
    const d = m.porDir[dir];
    console.log(`   ${dir.padEnd(10)} piezas=${String(d.total).padEnd(3)} huerfanas=${d.huerfanas}`);
    if (conNombres) for (const n of d.nombres) console.log(`     - ${n}`);
  }
  console.log(`   TOTAL huerfanas=${m.total}`);
}
