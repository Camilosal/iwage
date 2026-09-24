#!/usr/bin/env node
/**
 * Probe de motores de respuesta — ítem (2) del goal GEO 3-b.
 *
 * Corre las 10 preguntas fijas de la serie contra motores con búsqueda real y anota si
 * iwage.co aparece, con qué URL y con qué fuentes. La lista de preguntas es invariante:
 * cambiarla rompe la comparación entre fechas (ver docs/superpowers/probes/).
 *
 * Uso:
 *   OPENROUTER_API_KEY=… node tools/geo-probe.mjs
 *   node tools/geo-probe.mjs --preguntas=1,7 --motores=perplexity/sonar-pro
 *   node tools/geo-probe.mjs --formato=jsonl
 *
 * Cero dependencias: solo el `fetch` de Node. La API key se lee del ambiente y no se
 * imprime nunca; si falta, para antes de gastar una sola llamada.
 */
import { pathToFileURL } from 'node:url';

export const PREGUNTAS = [
  { id: 1, pregunta: 'qué es la meliponicultura cómo empezar Colombia abejas sin aguijón', marca: 'meliponas' },
  { id: 2, pregunta: 'granja autosustentable diseño clima cálido Tolima Colombia', marca: 'granja' },
  { id: 3, pregunta: 'turismo regenerativo Colombia rutas anfitriones rurales', marca: 'naturaleza' },
  { id: 4, pregunta: 'comprar finca rural cerca de Ibagué qué revisar título agua', marca: 'tierras' },
  { id: 5, pregunta: 'compostaje rural cerrar ciclo de nutrientes finca Colombia', marca: 'granja' },
  { id: 6, pregunta: 'café de origen Tolima Colombia tostador especialidad', marca: 'cafe' },
  { id: 7, pregunta: 'servicio de polinización gestionada abejas nativas sin aguijón Colombia', marca: 'meliponas' },
  { id: 8, pregunta: 'property management fincas rurales Colombia administración de propiedades turísticas', marca: 'gestion' },
  { id: 9, pregunta: 'bioconstrucción bambú adobe clima cálido Colombia técnica', marca: 'granja' },
  { id: 10, pregunta: 'energía solar para finca autosuficiente dimensionamiento paneles Colombia', marca: 'granja' },
];

// Slugs y parámetros leídos del catálogo público de OpenRouter (`/api/v1/models`) el 2026-09-24.
// `busqueda: true` = el modelo declara `web_search_options`, que es lo que obliga a recuperar
// en vez de responder de memoria; sin eso la medición no es de un motor de respuesta.
export const MOTORES = [
  { slug: 'perplexity/sonar-pro', engine: 'Perplexity', busqueda: true, verificado: '2026-09-24' },
  { slug: 'openai/gpt-4o', engine: 'OpenAI (búsqueda hospedada)', busqueda: true, verificado: '2026-09-24' },
];

const CANDIDATOS = /(https?:\/\/)?((?:[a-z0-9-]+\.)*iwage\.co)([^\s<>"'(),;\]]*)/gi;

function* coincidencias(texto) {
  for (const m of texto.matchAll(CANDIDATOS)) {
    const scheme = m[1] ?? '';
    const host = m[2];
    const resto = m[3] ?? '';
    const inicio = (m.index ?? 0) + scheme.length;
    const antes = texto[inicio - 1] ?? '';
    const fin = inicio + host.length;
    const despues = texto[fin] ?? '';
    const despues2 = texto[fin + 1] ?? '';
    // Sin esquema, un `.`/`-`/`/` delante significa que estamos dentro del host o la ruta de otro.
    if (!scheme && /[A-Za-z0-9._\-/]/.test(antes)) continue;
    if (/[A-Za-z0-9-]/.test(despues)) continue;
    if (despues === '.' && /[A-Za-z]/i.test(despues2)) continue;
    const ruta = resto.replace(/[.,;:!?)\]"']+$/, '');
    yield { host, url: `https://${host}${ruta || '/'}` };
  }
}

/**
 * Devuelve si el fragmento menciona el dominio propio y con qué URL.
 *
 * No es un `includes('iwage.co')`: la subcadena aparece dentro de slugs ajenos
 * (`…/meliponario-iwage-subsistema-vivo`) y como prefijo de otro host
 * (`iwage.co.mirror.example`), y las dos cosas inflaron la primera lectura de esta serie.
 */
export function mencionar(texto) {
  if (typeof texto !== 'string') return { esMencion: false, url: null, host: null };
  for (const c of coincidencias(texto)) return { esMencion: true, ...c };
  return { esMencion: false, url: null, host: null };
}

/** Las URLs propias citadas en un conjunto de textos, deduplicadas y en orden de aparición. */
export function urlsPropias(textos) {
  const encontradas = [];
  for (const texto of [].concat(textos)) {
    if (typeof texto !== 'string') continue;
    for (const { url } of coincidencias(texto)) if (!encontradas.includes(url)) encontradas.push(url);
  }
  return encontradas;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

async function llamar(motor, pregunta, key) {
  const cuerpo = { model: motor.slug, messages: [{ role: 'user', content: pregunta }] };
  if (motor.busqueda) cuerpo.web_search_options = { search_context_size: 'medium' };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`${motor.slug} respondió ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const mensaje = data?.choices?.[0]?.message ?? {};
  const fuentes = (mensaje?.provider_metadata?.search_results ?? [])
    .map((r) => r?.url ?? r?.content)
    .filter(Boolean);
  return { texto: mensaje.content ?? '', fuentes };
}

function parseLista(argv, nombre) {
  const crudo = argv.find((a) => a.startsWith(`--${nombre}=`));
  return crudo ? crudo.slice(nombre.length + 3).split(',').filter(Boolean) : null;
}

async function main(argv = process.argv.slice(2)) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('Falta OPENROUTER_API_KEY en el ambiente. No se hizo ninguna llamada.');
    process.exit(1);
  }
  const ids = parseLista(argv, 'preguntas')?.map(Number);
  const slugs = parseLista(argv, 'motores');
  const preguntas = ids ? PREGUNTAS.filter((p) => ids.includes(p.id)) : PREGUNTAS;
  const motores = slugs ? MOTORES.filter((m) => slugs.includes(m.slug)) : MOTORES;
  const filas = [];

  for (const p of preguntas) {
    for (const m of motores) {
      try {
        const { texto, fuentes } = await llamar(m, p.pregunta, key);
        filas.push({
          id: p.id,
          marca: p.marca,
          motor: m.slug,
          mencion: mencionar(texto).esMencion,
          urls: urlsPropias([texto, ...fuentes]),
          fuentes: fuentes.length,
          primeraFuente: fuentes[0] ? safeHost(fuentes[0]) : null,
        });
      } catch (e) {
        filas.push({ id: p.id, marca: p.marca, motor: m.slug, error: e.message });
      }
      console.error(`#${p.id} ${m.slug} → ${filas.at(-1).error ?? `${filas.at(-1).urls?.length ?? 0} URL(s) propia(s) de ${filas.at(-1).fuentes ?? 0} fuentes`}`);
    }
  }

  if (argv.includes('--formato=jsonl')) {
    for (const f of filas) console.log(JSON.stringify(f));
    return filas;
  }
  console.log('| # | motor | menciona | URL propia | fuentes citadas | primera fuente |');
  console.log('|---|---|---|---|---|---|');
  for (const f of filas) {
    console.log(
      `| ${f.id} | \`${f.motor}\` | ${f.error ? `error: ${f.error}` : f.mencion ? '**sí**' : 'no'} | ` +
        `${(f.urls ?? []).map((u) => `\`${u}\``).join('<br>') || '—'} | ${f.fuentes ?? '—'} | ${f.primeraFuente ?? '—'} |`,
    );
  }
  return filas;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return mencionar(url).host ?? String(url).slice(0, 40);
  }
}

// El módulo se importa desde los tests; `main()` solo corre cuando es el programa invocado.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
