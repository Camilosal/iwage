import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El candado de D7 (2026-09-27).
 *
 * Medido: el hotlink de stock y los placeholders que hoy están en la BD de Strapi no salieron del
 * admin ni de una migración —salieron de tres semillas del repo, que escribían
 * `images.unsplash.com…` en `anfitriones.foto_perfil_url` (la cara de dos personas con nombre y
 * apellido reales) y `https://www.youtube.com/watch?v=dQw4w9WgXcQ` en `video_url`. `esPintable()`
 * frena la imagen de tercero, pero el placeholder vive en un host de embed permitido: la única
 * puerta es que la semilla no lo escriba. Mientras estas líneas estuvieron ahí, volver a correr
 * una semilla deshacía la puerta G4 del dueño sin que nadie la autorizara.
 *
 * La lista es ENUMERADA, no derivada: no pretende conocer todos los hosts de stock del mundo, sino
 * los que dejaron huella medida en este proyecto. Si alguien abre un destino nuevo a Unsplash, esto
 * se pone rojo y esa persona lee el porqué.
 */
const SCRIPTS = 'strapi/scripts';
const PROHIBIDAS = [
  ['images.unsplash.com', 'retrato/paisaje de stock hotlinkeado: fuera del control del dueño y se cae un día'],
  ['unsplash.com', 'hotlink de Unsplash (la forma sin `images.`)'],
  ['wklcdn.com', 'hotlink de otro CDN de stock (medido en completar-fichas-experiencias.mjs)'],
  ['picsum.photos', 'placeholder de imágenes aleatorias'],
  ['placehold.co', 'placeholder de imágenes'],
  ['via.placeholder.com', 'placeholder de imágenes'],
  ['dQw4w9WgXcQ', 'el rickroll: no es contenido, es una broma con el nombre de un anfitrión encima'],
  ['momento360.com/e/u/demo', 'la demo del proveedor: un recorrido que no existe'],
];

function archivosScript(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...archivosScript(p));
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out.sort();
}

// Solo literales de URL: así las notas que EXPLICAN esta regla (que nombran los hosts sin escribir
// la URL) no cuentan como violación.
const URL = /https?:\/\/[^\s"'`\\)\]},]+/g;

test('las semillas no escriben hotlinks de stock ni placeholders conocidos', () => {
  const archivos = archivosScript(SCRIPTS);
  assert.ok(archivos.length >= 18, `el barrido se quedó corto (${archivos.length}): alguien cambió la ruta y el candado pasa vacío`);
  const faltantes = ['seed-experiencias-demo.mjs', 'seed-proyectos.mjs', 'completar-fichas-experiencias.mjs']
    .filter((n) => !archivos.some((p) => p.endsWith(n)));
  assert.deepEqual(faltantes, [], 'estas tres son las que trajeron el material de tercero a la BD; si se jubilan, se jubila también el candado y hay que decirlo');
  const rompe = [];
  let urls = 0;
  for (const p of archivos) {
    for (const m of readFileSync(p, 'utf8').matchAll(URL)) {
      urls += 1;
      const hit = PROHIBIDAS.find(([s]) => m[0].includes(s));
      if (hit) rompe.push(`${p}: ${m[0].slice(0, 92)} — ${hit[1]}`);
    }
  }
  assert.ok(urls > 0, 'no se leyó una sola URL: el candado está mirando a otro lado');
  assert.deepEqual(rompe, [], `\n${rompe.join('\n')}`);
});

test('la lista prohibida no es decorativa: cada patrón está anclado a lo que se midió', () => {
  // Un patrón que no coincida con NADA de lo que este teste busca (ni siquiera en su propia
  // muestra) es un adorno. Medido el 2026-09-27 sobre las versiones previas de las tres semillas.
  const muestra = [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80',
    'https://unsplash.com/photos/x',
    'https://s2.wklcdn.com/image_31/945142/7307725/4152557Master.jpg',
    'https://picsum.photos/200',
    'https://placehold.co/600',
    'https://via.placeholder.com/600',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://momento360.com/e/u/demo',
  ];
  for (const [patron, porQue] of PROHIBIDAS) {
    assert.ok(muestra.some((u) => u.includes(patron)), `patrón sin muestra donde se pruebe: ${patron} (${porQue})`);
  }
  assert.equal(PROHIBIDAS.length, muestra.length, 'a una URL de la muestra no le corresponde ningún patrón, o un patrón cubre dos');
});
