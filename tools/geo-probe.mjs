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

/**
 * Los host que el motor cita en su propia prosa, sin contar los nuestros: es la columna que
 * dice quien esta ocupando el lugar que se quiere. Moonshot no siempre devuelve
 * `search_citations`, asi que lo que se puede anotar son los enlaces que escribio en la respuesta.
 */
export function dominiosCitados(texto) {
  if (typeof texto !== 'string') return [];
  const salida = [];
  for (const m of texto.matchAll(/(?:https?:\/\/|www\.)([^\s)\]"'>]+)/gi)) {
    const host = m[1].toLowerCase().split('/')[0];
    if (!host.includes('.') || /(^|\.)iwage\.co$/.test(host)) continue;
    if (!salida.includes(host)) salida.push(host);
  }
  return salida;
}

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

/**
 * `GEO_MODELS` corre la misma serie contra un relay OpenAI-compatible distinto de OpenRouter.
 * No es un adorno: la clave de OpenRouter respondió `401 User not found` al medirla el
 * 2026-09-24, así que sin el relay no hay ninguna medición de visibilidad en IA. La búsqueda
 * hospedada se declara modelo por modelo porque no todos la tienen, y sin `busqueda` lo que se
 * mide es la memoria del modelo, no un motor de respuesta — hay que decirlo en el registro.
 */
export const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export function configDesdeAmbiente(env) {
  if (!env.GEO_MODELS) return { endpoint: ENDPOINT, key: env.OPENROUTER_API_KEY, motores: MOTORES };
  if (!env.GEO_KEY) throw new Error('Falta GEO_KEY en el ambiente. No se hizo ninguna llamada.');
  const endpoint = env.GEO_ENDPOINT ?? ENDPOINT;
  const conBusqueda = new Set((env.GEO_BUSQUEDA ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  // Cada proveedor declara la busqueda hospedada a su manera; con `moonshot` el cuerpo lleva
  // `builtin_function` y la respuesta trae `search_citations`.
  const busquedaFormato = env.GEO_FORMATO_BUSQUEDA ?? (endpoint.includes('moonshot') ? 'moonshot' : 'openrouter');
  const motores = (env.GEO_MODELS ?? '').split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((slug) => ({ slug, engine: slug, busqueda: conBusqueda.has(slug), busquedaFormato, verificado: null }));
  return { endpoint, key: env.GEO_KEY, motores };
}

export function cuerpoDe(motor, pregunta) {
  const cuerpo = { model: motor.slug, messages: [{ role: 'user', content: pregunta }] };
  if (!motor.busqueda) return cuerpo;
  if (motor.busquedaFormato === 'moonshot') {
    cuerpo.tools = [{ type: 'builtin_function', function: { name: '$web_search' } }];
    return cuerpo;
  }
  cuerpo.web_search_options = { search_context_size: 'medium' };
  return cuerpo;
}

/**
 * Moonshot ejecuta `$web_search` del lado del servidor y devuelve el `search_id` dentro de
 * `arguments`: ese `arguments` es la `content` que hay que devolverle. Con `'[]'` el segundo
 * completion responde de memoria y la medicion sale falsa (0 fuentes, sin citas).
 */
export function mensajesTrasHerramienta(mensaje) {
  const llamadas = mensaje?.tool_calls ?? [];
  if (!llamadas.length) return [];
  return [
    mensaje,
    ...llamadas.map((c) => ({
      role: 'tool',
      tool_call_id: c.id,
      name: c.function?.name,
      content: c.function?.arguments ?? '[]',
    })),
  ];
}

/** URLs citadas por el motor: `search_citations` (Moonshot) o `provider_metadata` (OpenRouter). */
export function fuentesDelMensaje(mensaje) {
  const citas = (mensaje?.search_citations ?? []).map((c) => c?.url).filter(Boolean);
  const hospedadas = (mensaje?.provider_metadata?.search_results ?? []).map((r) => r?.url ?? r?.content).filter(Boolean);
  return [...new Set([...citas, ...hospedadas])];
}

async function unaLlamada(motor, mensajes, key, endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...cuerpoDe(motor, mensajes[0].content), messages: mensajes }),
  });
  if (!res.ok) throw new Error(`${motor.slug} respondió ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json())?.choices?.[0]?.message ?? {};
}

async function llamar(motor, pregunta, key, endpoint) {
  let mensaje = await unaLlamada(motor, [{ role: 'user', content: pregunta }], key, endpoint);
  const continuacion = mensajesTrasHerramienta(mensaje);
  if (continuacion.length) {
    mensaje = await unaLlamada(motor, [{ role: 'user', content: pregunta }, ...continuacion], key, endpoint);
  }
  return { texto: mensaje.content ?? '', fuentes: fuentesDelMensaje(mensaje), vacio: !mensaje.content };
}

function parseLista(argv, nombre) {
  const crudo = argv.find((a) => a.startsWith(`--${nombre}=`));
  return crudo ? crudo.slice(nombre.length + 3).split(',').filter(Boolean) : null;
}

async function main(argv = process.argv.slice(2)) {
  const { endpoint, key, motores: disponibles } = configDesdeAmbiente(process.env);
  if (!key) {
    console.error('Falta OPENROUTER_API_KEY (o GEO_KEY con GEO_MODELS) en el ambiente. No se hizo ninguna llamada.');
    process.exit(1);
  }
  const ids = parseLista(argv, 'preguntas')?.map(Number);
  const slugs = parseLista(argv, 'motores');
  const preguntas = ids ? PREGUNTAS.filter((p) => ids.includes(p.id)) : PREGUNTAS;
  const motores = slugs ? disponibles.filter((m) => slugs.includes(m.slug)) : disponibles;
  const filas = [];
  const jsonl = argv.includes('--formato=jsonl');

  for (const p of preguntas) {
    for (const m of motores) {
      let fila;
      try {
        const { texto, fuentes, vacio } = await llamar(m, p.pregunta, key, endpoint);
        fila = {
          id: p.id,
          marca: p.marca,
          motor: m.slug,
          mencion: mencionar(texto).esMencion,
          urls: urlsPropias([texto, ...fuentes]),
          dominios: dominiosCitados(texto),
          fuentes: fuentes.length,
          primeraFuente: fuentes[0] ? safeHost(fuentes[0]) : null,
          ...(vacio ? { textoVacio: true } : {}),
        };
      } catch (e) {
        fila = { id: p.id, marca: p.marca, motor: m.slug, error: e.message };
      }
      filas.push(fila);
      console.error(`#${p.id} ${m.slug} → ${fila.error ?? `${fila.urls?.length ?? 0} URL(s) propia(s) de ${fila.fuentes ?? 0} fuentes`}`);
      // Cada fila se escribe al producirse: una interrupción no borra las preguntas ya respondidas.
      if (jsonl) console.log(JSON.stringify(fila));
    }
  }

  if (jsonl) return filas;
  console.log('| # | motor | menciona | URL propia | fuentes citadas | dominios que si aparecen |');
  console.log('|---|---|---|---|---|---|');
  for (const f of filas) {
    console.log(
      `| ${f.id} | \`${f.motor}\` | ${f.error ? `error: ${f.error}` : f.mencion ? '**sí**' : 'no'} | ` +
        `${(f.urls ?? []).map((u) => `\`${u}\``).join('<br>') || '—'} | ${f.fuentes ?? '—'} | ${(f.dominios ?? []).slice(0, 4).join(', ') || '—'} |`,
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
