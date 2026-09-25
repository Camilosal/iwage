/**
 * Candado del LECTOR: qué pide cada llamada a Strapi y si eso cubre lo que la fila consume.
 *
 * Por qué existe. Desde `fa240b2` los campos de portada y galería son `type: 'media'`, y la
 * REST API de Strapi v5 «by default does not populate any relations, media fields,
 * components, or dynamic zones». Si la clave `populate` falta, Strapi responde `200` sin el
 * campo, el adaptador ve `undefined` y la tapa desaparece del sitio — con `astro build` y
 * `npm test` verdes, porque ningún teste de normalización puede ver un campo que nunca llegó
 * (ese fue el C1, y la bitácora vivió así 112 filas).
 *
 * `tests/normalizar-medio.test.mjs` ya cierra ese hueco para la bitácora, que es el carril por
 * el que entró el defecto. Este archivo cierra los otros once módulos: la regla es la misma,
 * aplicada a las 45 llamadas que hay en el repo, leídas sobre el código SIN comentarios para
 * que la prosa no las satisfaga (la lección del mutante MT4).
 *
 * Qué NO intenta hacer, y por qué. La tentación era derivar «qué lee cada llamada» buscando los
 * nombres del esquema dentro del cuerpo y del mapeador que invoca. Medido sobre este mismo
 * repo: la derivación subinforma (`getProyectos` y `getProductos` salieron con «leen = []»
 * cuando sí poblan galería e imagen), o sea produciría un candado que se satisface solo. Un
 * verde que no puede ponerse rojo no es una guarda, es decoración. Por eso la expectativa de
 * qué se pobla está escrita a mano, fila por fila, y lo mecánico es el contraste contra el
 * esquema: una clave que deja de existir, o que se pide por la vía equivocada, revienta acá.
 *
 * Alcance medido el 2026-09-25: 45 llamadas `strapiFetch(` en `src/**` (32 estaban en el
 * barrido original de `populate-sweep.mjs`, que solo recorría `src/lib/*.ts` a profundidad 1 y
 * por eso se perdió las 7 del índice RAG, las 2 de `seo-landings` y el envase de `llms.txt`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './helpers/sin-comentarios.mjs';

// `IWAGE_SRC` apunta el candado a una COPIA del árbol: es la única forma de medir sus dientes
// sin tocar el tree compartido (misma puerta que en `normalizar-medio*.test.mjs`).
const RAIZ = (process.env.IWAGE_SRC
  ? resolve(process.env.IWAGE_SRC)
  : fileURLToPath(new URL('..', import.meta.url))
).replace(/\/+$/, '');
const API = join(RAIZ, 'strapi/src/api');

// ── Verdad del esquema, leída de disco ───────────────────────────────────────

/** content-type → { atributos: Set, medios: [clave…] } */
const ESQUEMAS = {};
for (const carpeta of readdirSync(API)) {
  const ct = join(API, carpeta, 'content-types');
  if (!existsSync(ct)) continue;
  for (const tipo of readdirSync(ct)) {
    const p = join(ct, tipo, 'schema.json');
    if (!existsSync(p)) continue;
    const attrs = JSON.parse(readFileSync(p, 'utf8')).attributes ?? {};
    ESQUEMAS[tipo] = {
      atributos: new Set(Object.keys(attrs)),
      pueblables: new Set(
        Object.entries(attrs)
          .filter(([, a]) => a.type === 'media' || a.type === 'relation')
          .map(([k]) => k),
      ),
      medios: Object.entries(attrs)
        .filter(([, a]) => a.type === 'media')
        .map(([k]) => k)
        .sort(),
    };
  }
}

/**
 * Endpoint REST → content-type. Explícito a propósito: `propiedades-gestion` no se
 * singulariza con la regla ingenua de quitar la `s`, y un mapa aproximado dejaría de
 * cruzarse contra el esquema sin decir nada.
 */
const TIPO_DE = {
  'anfitriones': 'anfitrion',
  'bitacoras': 'bitacora',
  'cafe-configs': 'cafe-config',
  'complementos': 'complemento',
  'cultivo-polinizaciones': 'cultivo-polinizacion',
  'etapa-proyectos': 'etapa-proyecto',
  'experiencias': 'experiencia',
  'experimentos': 'experimento',
  'hero-configuracions': 'hero-configuracion',
  'historia-visitantes': 'historia-visitante',
  'iniciativas': 'iniciativa',
  'item-menus': 'item-menu',
  'lote-miels': 'lote-miel',
  'paquetes': 'paquete',
  'pilar-estandars': 'pilar-estandar',
  'productos': 'producto',
  'propiedades': 'propiedad',
  'propiedades-gestion': 'propiedad-gestion',
  'proveedors': 'proveedor',
  'proyecto-meliponarios': 'proyecto-meliponario',
  'testimonios': 'testimonio',
  // Colección que la página consulta pero que no existe en ninguna parte del repo ni de la
  // base: ver el teste «la sombra de /tierras/landing».
  'seo-landings': null,
};

// ── Contractos esperados, por archivo y en orden de aparición ────────────────

/**
 * `poblar` = las claves de MEDIA (no relaciones) que la llamada pide poblar, ordenadas.
 * `[]` significa «pide cero media a propósito»: siempre va acompañado de su `motivo`, y el
 * teste comprueba que el cuerpo no menciona ninguna clave de media del tipo.
 */
const CONTRATOS = {
  'src/lib/bitacora.ts': [
    { ep: 'bitacoras', poblar: ['imagen'] },
    { ep: 'bitacoras', poblar: ['imagen'] },
    { ep: 'bitacoras', poblar: ['imagen'] },
    { ep: 'bitacoras', poblar: [], motivo: 'getAllBitacoraSlugs mapea solo `slug` y `marca`' },
  ],
  'src/lib/cafe.ts': [
    { ep: 'item-menus', poblar: ['imagen'] },
    { ep: 'proveedors', poblar: ['foto'] },
    { ep: 'historia-visitantes', poblar: ['imagen'] },
  ],
  'src/lib/gestion.ts': [
    { ep: 'propiedades-gestion', poblar: ['galeria', 'imagen_principal'] },
    { ep: 'propiedades-gestion', poblar: ['galeria', 'imagen_principal'] },
    { ep: 'propiedades-gestion', poblar: [], motivo: 'getAllPropiedadGestionSlugs solo devuelve slugs' },
    { ep: 'experiencias', poblar: ['imagen_hero'], motivo: 'la tarjeta cross-sell no pinta galería' },
  ],
  'src/lib/granja-experimentos.ts': [
    { ep: 'experimentos', poblar: ['documentos', 'imagen'] },
    { ep: 'experimentos', poblar: ['documentos', 'imagen'] },
    { ep: 'experimentos', poblar: ['imagen'], motivo: 'el listado por subsistema no pinta documentos' },
    { ep: 'experimentos', poblar: [], motivo: 'getAllExperimentoSlugs solo devuelve slugs' },
  ],
  'src/lib/heroes.ts': [
    { ep: '«endpoint»', envase: true, motivo: 'fetchSeguro(endpoint, options) reenvía: el populate decide en las 3 llamadas de abajo' },
  ],
  'src/lib/naturaleza.ts': [
    { ep: 'experiencias', poblar: ['galeria', 'imagen_hero'] },
    { ep: 'experiencias', poblar: ['galeria', 'imagen_hero'] },
    { ep: 'anfitriones', poblar: ['foto_perfil', 'galeria'] },
    { ep: 'anfitriones', poblar: ['foto_perfil', 'galeria'] },
    { ep: 'paquetes', poblar: ['imagen_hero', 'imagenes'] },
    { ep: 'paquetes', poblar: ['imagen_hero', 'imagenes'] },
    { ep: 'iniciativas', poblar: [], motivo: 'iniciativa no tiene ningún atributo media' },
  ],
  'src/lib/polinizacion.ts': [
    { ep: 'cultivo-polinizaciones', poblar: ['galeria', 'imagen'] },
    { ep: 'cultivo-polinizaciones', poblar: ['galeria', 'imagen'] },
  ],
  'src/lib/proyectos.ts': [
    { ep: 'proyecto-meliponarios', poblar: ['galeria', 'imagen'] },
    { ep: 'proyecto-meliponarios', poblar: ['galeria', 'imagen'] },
  ],
  'src/lib/rag/indexer.ts': [
    { ep: 'productos', poblar: [], motivo: 'el índice RAG solo indexa texto: no hay una sola mención a un campo de media en el archivo' },
    { ep: 'proyecto-meliponarios', poblar: [], motivo: 'íd.' },
    { ep: 'cultivo-polinizaciones', poblar: [], motivo: 'íd.' },
    { ep: 'lote-miels', poblar: [], motivo: 'íd.' },
    { ep: 'complementos', poblar: [], motivo: 'íd.' },
    { ep: 'pilar-estandars', poblar: [], motivo: 'íd.' },
    { ep: 'etapa-proyectos', poblar: [], motivo: 'íd.' },
  ],
  'src/lib/sitemap.ts': [
    { ep: '«endpoint»', envase: true, motivo: 'fetchAllSlugs(endpoint) solo lee `slug`, `marca` y `updatedAt`' },
  ],
  'src/lib/tienda.ts': [
    { ep: 'productos', poblar: ['galeria', 'imagen'] },
    { ep: 'productos', poblar: ['galeria', 'imagen'] },
    { ep: 'productos', poblar: ['galeria', 'imagen'] },
  ],
  'src/lib/tierras.ts': [
    { ep: 'propiedades', poblar: ['imagen_principal', 'imagenes'] },
    { ep: 'propiedades', poblar: ['imagen_principal', 'imagenes'] },
    { ep: 'propiedades', poblar: [], motivo: 'getAllPropiedadSlugs solo devuelve slugs' },
  ],
  'src/pages/llms.txt.ts': [
    { ep: '«endpoint»', envase: true, motivo: 'total(endpoint) cuenta filas, no pinta media' },
    { ep: 'bitacoras', poblar: [], motivo: 'filasDeBitacora arma texto con `titulo` y `extracto`' },
  ],
  'src/pages/tierras/landing/[slug].astro': [
    { ep: 'seo-landings', poblar: [], motivo: 'no hay content-type `seo-landing`: la ruta es una sombra (teste 5)' },
    { ep: 'seo-landings', poblar: [], motivo: 'segunda llamada de la misma sombra, con filtro por slug' },
  ],
};

// ── Lector mínimo de las llamadas ────────────────────────────────────────────

/** El objeto de opciones: de la primera `{` balanceada después del paréntesis. */
function objetoOpciones(fuente, desdeParentesis) {
  let i = fuente.indexOf('{', desdeParentesis);
  if (i === -1) return '';
  let profundidad = 0;
  for (let j = i; j < fuente.length; j += 1) {
    if (fuente[j] === '{') profundidad += 1;
    else if (fuente[j] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return fuente.slice(i + 1, j);
    }
  }
  return null; // nunca cerrar: la guarda avisa en vez de leer un trozo
}

function constantesDeListas(fuente) {
  const map = {};
  for (const m of fuente.matchAll(/\bconst\s+([A-Z][A-Z_0-9]*)\s*=\s*\[([^\]]*)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return map;
}

function clavesDe(opciones, clave, constantes, archivo) {
  const inline = opciones.match(new RegExp(`\\b${clave}:\\s*\\[([^\\]]*)\\]`));
  if (inline) return [...inline[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const porNombre = opciones.match(new RegExp(`\\b${clave}:\\s*([A-Z][A-Z_0-9]*)`));
  if (porNombre) {
    assert.ok(
      constantes[porNombre[1]],
      `${archivo} pide ${clave}: ${porNombre[1]} y esta guarda no sabe resolver esa constante: ` +
        'o cambió de forma o es nueva; extendé `constantesDeListas` en vez de mirar hacia otro lado',
    );
    return constantes[porNombre[1]];
  }
  return null;
}

function llamar(fuente) {
  const sitios = [];
  for (const m of fuente.matchAll(/strapiFetch\s*(?:<[^>]*>)?\s*\(\s*(?:'([^']+)'|([A-Za-z_]\w*))/g)) {
    const opciones = objetoOpciones(fuente, m.index + m[0].length - 1);
    assert.notEqual(opciones, null, `objeto de opciones sin cerrar en la llamada a ${m[1] ?? m[2]}`);
    sitios.push({ endpoint: m[1] ?? `«${m[2]}»`, opciones });
  }
  return sitios;
}

const TODOS = Object.keys(CONTRATOS);

function archivosConLlamadas() {
  const vistos = new Set();
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (!/(node_modules|dist|\.astro)/.test(p)) andar(p);
      } else if (/\.(ts|astro|tsx)$/.test(e.name) && !p.endsWith(join('src', 'lib', 'strapi.ts'))) {
        // Se cuentan los SITIOS, no las menciones: `src/pages/ayuda/equipo/strapi-cms.astro`
        // escribe «strapiFetch()» dentro de un `<code>` para explicarle a alguien cómo se
        // consume el CMS, y tomar la palabra por la llamada habría convertido esa
        // documentación en un consumidor fantasma al que exigirle un contrato.
        if (llamar(sinComentarios(readFileSync(p, 'utf8'))).length) {
          vistos.add(relative(RAIZ, p).split('\\').join('/'));
        }
      }
    }
  };
  andar(join(RAIZ, 'src'));
  return [...vistos].sort();
}

// ── 1. Cobertura: ninguna llamada se queda sin clasificar ────────────────────

test('las 45 llamadas a Strapi del repo están clasificadas, ni una más ni una menos', () => {
  const encontrados = archivosConLlamadas().sort();
  assert.deepEqual(
    encontrados,
    TODOS.slice().sort(),
    'cambió el conjunto de archivos que llaman a Strapi: esta guarda es la que pone rojo cuando ' +
      'aparece un consumidor nuevo (o cuando uno se muda de archivo). Clasificalo en `CONTRATOS` ' +
      'con su populate y su motivo, en vez de sacar el teste.',
  );

  let total = 0;
  for (const archivo of TODOS) {
    const fuente = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    const sitios = llamar(fuente);
    const esperados = CONTRATOS[archivo];
    total += sitios.length;
    assert.deepEqual(
      sitios.map((s) => s.endpoint),
      esperados.map((e) => e.ep),
      `${archivo}: las llamadas encontradas ya no son las del contrato (orden y endpoint). ` +
        'Una llamada nueva sin contrato es exactamente el C1 esperando a pasar.',
    );
  }
  assert.equal(total, 45, `se esperaban 45 llamadas en todo src/ y hay ${total}`);
});

// ── 2. C1: lo que la fila consume está pedido ────────────────────────────────

test('cada llamada pobla exactamente las claves de media que le corresponden (C1)', () => {
  for (const archivo of TODOS) {
    const fuente = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    const constantes = constantesDeListas(fuente);
    const sitios = llamar(fuente);

    sitios.forEach((sitio, i) => {
      const esperado = CONTRATOS[archivo][i];
      if (esperado.envase) return;
      const tipo = TIPO_DE[esperado.ep];
      const delTipo = tipo ? ESQUEMAS[tipo].medios : [];
      const pedidas = clavesDe(sitio.opciones, 'populate', constantes, archivo) ?? [];
      const mediaPoblada = pedidas.filter((k) => delTipo.includes(k)).sort();

      assert.deepEqual(
        mediaPoblada,
        esperado.poblar,
        `${archivo} #${i + 1} · ${esperado.ep}: pobla media [${mediaPoblada}] y el contrato dice ` +
          `[${esperado.poblar}]. Si sobra, se paga un populate que nadie lee; si falta, Strapi ` +
          `responde 200 sin el campo y la tapa desaparece con build verde (el C1).`,
      );

      if (esperado.poblar.length === 0) {
        assert.ok(
          esperado.motivo,
          `${archivo} #${i + 1} · ${esperado.ep} no pobla media y no tiene motivo: la excepción sin explicación es el hueco`,
        );
      }
    });
  }
});

// ── 3. Las claves pedidas existen, y se piden por la vía correcta ────────────

test('toda clave de `populate` existe en el esquema y es media o relación (C2 y familia)', () => {
  for (const archivo of TODOS) {
    const fuente = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    const constantes = constantesDeListas(fuente);
    for (const [i, sitio] of llamar(fuente).entries()) {
      const esperado = CONTRATOS[archivo][i];
      if (esperado.envase || !TIPO_DE[esperado.ep]) continue;
      const esquema = ESQUEMAS[TIPO_DE[esperado.ep]];
      const pedidas = clavesDe(sitio.opciones, 'populate', constantes, archivo) ?? [];

      for (const k of pedidas) {
        assert.ok(
          esquema.atributos.has(k),
          `${archivo} #${i + 1} · ${esperado.ep}: populate pide «${k}», que no es atributo de ` +
            `${TIPO_DE[esperado.ep]}. Un campo renombrado o retirado (el Grupo C) se ve acá, no en producción.`,
        );
        assert.ok(
          esquema.pueblables.has(k),
          `${archivo} #${i + 1} · ${esperado.ep}: populate pide el escalar «${k}». Strapi v5 ` +
            'responde `400 ValidationError … param: "populate"` y el 400 tumba la superficie entera.',
        );
      }

      // Y el revés, que es el C2 medido: un media en `fields[]` da 400 con `param: "fields"`.
      const fields = clavesDe(sitio.opciones, 'fields', constantes, archivo) ?? [];
      for (const f of fields) {
        assert.ok(
          !esquema.medios.includes(f),
          `${archivo} · ${esperado.ep}: «${f}» está en fields[] y además es ` +
            `type: 'media' en ${TIPO_DE[esperado.ep]}. Strapi lo rechaza con 400 ` +
            '(`param: "fields"`), `strapiFetch` lanza y la superficie sale vacía con build verde.',
        );
      }
    }
  }
});

// ── 4. Las excepciones siguen siendo excepciones ────────────────────────────

test('quien no pobla media tampoco la menciona en sus opciones', () => {
  for (const archivo of TODOS) {
    const fuente = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    const sitios = llamar(fuente);
    for (const [i, sitio] of sitios.entries()) {
      const esperado = CONTRATOS[archivo][i];
      if (esperado.envase || esperado.poblar.length) continue;
      const tipo = TIPO_DE[esperado.ep];

      assert.ok(
        esperado.motivo,
        `${archivo} #${i + 1} · ${esperado.ep}: excepción sin motivo`,
      );

      if (!tipo) continue;

      // Sin `populate`, la única forma legítima de que el nombre de un media aparezca en las
      // opciones es que la lectura sí lo consuma (un `filter` o un `sort` sobre la relación).
      // Ahí es cuando `poblar: []` deja de ser cierto.
      const sinPoblar = sitio.opciones.replace(/\bpopulate:\s*(\[[^\]]*\]|[A-Z][A-Z_0-9]*)/, '');
      for (const k of ESQUEMAS[tipo].medios) {
        assert.ok(
          !new RegExp(`\\b${k}\\b`).test(sinPoblar),
          `${archivo} #${i + 1} · ${esperado.ep} no pobla «${k}» pero la menciona en sus opciones: ` +
            'o se volvió a consumir o quedó un resto; en los dos casos hay que relecturar el contrato.',
        );
      }
    }
  }
});

// ── 5. La sombra que quedó documentada, documentada se mantiene ─────────────

test('la sombra de /tierras/landing: se consulta una colección que no existe en ninguna parte', () => {
  const pagina = join(RAIZ, 'src/pages/tierras/landing/[slug].astro');
  const fuente = sinComentarios(readFileSync(pagina, 'utf8'));
  assert.match(
    fuente,
    /strapiFetch<\w*>\(\s*'seo-landings'/,
    'la página dejó de consultar `seo-landings`: actualizá este teste y el contrato',
  );
  assert.ok(
    !existsSync(join(API, 'seo-landing')),
    'existe un content-type `seo-landing` en el repo: la sombra ya no es tal. Cablear la ruta ' +
      'de verdad (populate de sus media, si los tiene) y sacar la excepción de `TIPO_DE`.',
  );
  // Medido el 2026-09-25 contra el CMS en vuelo: `GET /api/seo-landings` responde 404 y en la
  // base no hay tabla `seo_landings`. La página sobrevive porque el `catch` redirige a
  // /tierras/propiedades, o sea: la ruta existe, el contenido no, y nadie lo sabe.
});
