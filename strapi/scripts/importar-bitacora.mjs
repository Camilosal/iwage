/**
 * Importa Publicaciones/<carpeta>/*.md a la colección `bitacoras` de Strapi.
 *
 *   STRAPI_URL=http://127.0.0.1:1338 STRAPI_API_TOKEN=… \
 *     node strapi/scripts/importar-bitacora.mjs Meliponario --marca meliponas [--dry-run|--publicar]
 *
 * Idempotente por slug: lo que ya existe no se toca (ni su contenido ni su `publicado`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { aRegistroBitacora } from './lib/markdown-import.mjs';

const argv = process.argv.slice(2);
const carpeta = argv.find((a) => !a.startsWith('--'));
const marca = argv[argv.indexOf('--marca') + 1];
const modoPublicar = argv.includes('--publicar');
const dryRun = argv.includes('--dry-run');
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1338';
const TOKEN = process.env.STRAPI_API_TOKEN || '';

if (!carpeta || !marca) {
  console.error('uso: importar-bitacora.mjs <carpeta> --marca <slug> [--dry-run|--publicar]');
  process.exit(2);
}
if (!dryRun && TOKEN.length < 20) {
  console.error('STRAPI_API_TOKEN no está en el entorno (se mide la longitud, nunca se imprime)');
  process.exit(2);
}

const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function slugsExistentes() {
  const vistos = new Set();
  for (let page = 1; ; page += 1) {
    const res = await fetch(
      `${STRAPI_URL}/api/bitacoras?pagination%5Bpage%5D=${page}&pagination%5BpageSize%5D=100&fields%5B0%5D=slug`,
      { headers: cabeceras },
    );
    if (!res.ok) throw new Error(`lectura falló: HTTP ${res.status}`);
    const json = await res.json();
    (json.data || []).forEach((e) => vistos.add(e.slug));
    if (page * 100 >= (json.meta?.pagination?.total ?? 0)) break;
  }
  return vistos;
}

async function crear(data) {
  const res = await fetch(`${STRAPI_URL}/api/bitacoras`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ data: { ...data, publishedAt: new Date().toISOString() } }),
  });
  if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 180)}` };
  return { ok: true, documentId: (await res.json()).data.documentId };
}

async function publicar(documentId) {
  const res = await fetch(`${STRAPI_URL}/api/bitacoras/${documentId}`, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify({ data: { publicado: true } }),
  });
  return res.ok;
}

/** --publicar no crea nada: saca del escondite lo que ya importamos oculto. */
async function publicarPendientes(slugsCarpeta) {
  const lista = await (
    await fetch(
      `${STRAPI_URL}/api/bitacoras?pagination%5BpageSize%5D=100&filters%5Bmarca%5D%5B%24eq%5D=${marca}&filters%5Bpublicado%5D%5B%24eq%5D=false&fields%5B0%5D=slug&fields%5B1%5D=documentId`,
      { headers: cabeceras },
    )
  ).json();
  const pendientes = (lista.data || []).filter((e) => slugsCarpeta.has(e.slug));
  let ok = 0;
  for (const e of pendientes) {
    if (dryRun) {
      console.log(`  [dry] publicaría ${e.slug}`);
      continue;
    }
    if (await publicar(e.documentId)) ok += 1;
    else console.error(`  ✗ ${e.slug}`);
  }
  console.log(`\npublicadas=${ok} pendientes=${pendientes.length} en Strapi sin publicar para ${marca}`);
  if (!dryRun && ok !== pendientes.length) process.exit(1);
  return;
}

const slugsCarpeta = new Set(
  readdirSync(`Publicaciones/${carpeta}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => aRegistroBitacora(readFileSync(`Publicaciones/${carpeta}/${f}`, 'utf8'), marca).slug),
);

if (modoPublicar) {
  await publicarPendientes(slugsCarpeta);
  process.exit(0);
}

const existentes = await slugsExistentes();
const archivos = readdirSync(`Publicaciones/${carpeta}`).filter((f) => f.endsWith('.md')).sort();
console.log(`${archivos.length} archivos en Publicaciones/${carpeta}, ${existentes.size} entradas en Strapi`);

let creados = 0, omitidos = 0, fallidos = 0;
for (const archivo of archivos) {
  const registro = aRegistroBitacora(readFileSync(`Publicaciones/${carpeta}/${archivo}`, 'utf8'), marca);
  if (existentes.has(registro.slug)) {
    omitidos += 1;
    continue;
  }
  if (dryRun) {
    console.log(`  [dry] ${registro.slug} · ${registro.tiempo_lectura} min · ${registro.etiquetas.length} tags · extracto ${registro.extracto.length} car`);
    creados += 1;
    continue;
  }
  const r = await crear(registro);
  if (!r.ok) {
    fallidos += 1;
    console.error(`  ✗ ${registro.slug}: ${r.error}`);
    continue;
  }
  creados += 1;
  console.log(`  ✓ ${registro.slug} (sin publicar)`);
}

console.log(`\ncreados=${creados} omitidos=${omitidos} fallidos=${fallidos}`);
if (fallidos > 0) process.exit(1);
