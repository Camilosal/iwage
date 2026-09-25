/**
 * `sinComentarios(fuente)` — el código sin su prosa, para los contratos de fuente.
 *
 * Estos testes leen `src/` como texto porque en el repo no hay compilador de tipos: cuando
 * la línea de una declaración pasa de `imagen: MediaItem | null` a `imagen: string | null`
 * no lo detecta nadie en tiempo de compilación, y la única guarda es una aserción sobre esa
 * línea. Para que no la satisfaga un comentario que copia la cadena, hay que quitar los
 * comentarios **sin quitar código**.
 *
 * La versión que reemplaza aquí (cinco copias casi idénticas repartidas por `tests/`)
 * encadenaba un `replace` de comentario de bloque, otro de comentario HTML y otro de resto de
 * línea con lookbehind. Eso no sabe que existen las cadenas ni los literales de regex, y falla
 * en los dos sentidos. Medido el 2026-09-25 sobre los 311 `.ts`/`.astro` versionados: tres
 * líneas de código real desaparecían en `src/lib/media.ts` (49, 134 y 154) porque un literal
 * de regex que casa `https://` abre ahí un comentario fantasma y el `replace` no anclado se
 * lleva todo hasta el siguiente `//` de la línea. `src/lib/media.ts` es justamente uno de los
 * archivos bajo contrato: un guarda que borra código puede ponerse verde porque borró la línea
 * que lo negaba.
 *
 * Aquí se recorre la fuente carácter a carácter con estados: comentario de línea, comentario
 * de bloque, comentario HTML, cadena con comillas simples o dobles, template literal con sus
 * interpolaciones (que vuelven a ser código y pueden anidar plantillas), y literal de regex con
 * banderas. El regex se distingue de la división por el último carácter significativo y la
 * última palabra, el criterio de siempre.
 *
 * Dos reglas que parecen en conflicto y no lo están:
 *
 * - **Cadenas, plantillas y regex se copian tal cual.** Se reconocen para no confundir su
 *   contenido con un delimitador de comentario, no para vaciarlo: los contratos leen justamente
 *   ese contenido (el endpoint en `strapiFetch('bitacoras', …)`, las claves de `populate`).
 *   Borrarlas sería borrar la evidencia.
 * - **Un `<!--` es prosa también dentro de una plantilla.** En `app.innerHTML = `␣<!-- Paso 1 -->`
 *   el comentario no es un dato que un contrato deba ver; la versión anterior lo borraba y aquí
 *   se sigue borrando. `//` y `/*` dentro de una cadena, en cambio, sí se respetan: ahí viven
 *   las URL.
 *
 * Los comentarios se sustituyen por espacios conservando sus saltos de línea, así la salida
 * mide lo mismo que la entrada y las aserciones ancladas con `^…$` más la bandera `m` siguen
 * hablando de la misma línea.
 *
 * No es un parser de JS y no lo intenta: si una ambigüedad rara se resuelve mal, el resultado
 * es un contrato que se pone rojo a la vista — ruidoso, que es como deben fallar estas guardas.
 */

const PALABRAS_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

/** ¿El `/` de aquí abre un literal de regex o es una división? */
function abreRegex(prev, palabra) {
  if (prev === '') return true;
  if (/[\w$]/.test(prev)) return PALABRAS_REGEX.has(palabra);
  return prev !== ')' && prev !== ']';
}

export function sinComentarios(fuente) {
  const n = fuente.length;
  const out = fuente.split('');
  const blanco = (desde, hasta) => {
    for (let k = desde; k < Math.min(hasta, n); k += 1) if (out[k] !== '\n') out[k] = ' ';
  };

  let i = 0;
  let prev = ''; // último carácter significativo de código
  let palabra = ''; // última palabra: `return /re/` abre regex, `x / 2` no
  const pila = [{ tipo: 'codigo', llaves: 0 }];

  while (i < n) {
    const c = fuente[i];
    const s = fuente[i + 1];
    const marco = pila[pila.length - 1];

    if (marco.tipo === 'texto') {
      // Dentro de un template literal todo es texto salvo la barra invertida, la
      // interpolación y el cierre. Los `${ … }` sí se recorren como código (apilan un marco),
      // para que un comentario abierto ahí no engañe al resto del escaneo.
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { pila.pop(); i += 1; prev = '`'; continue; }
      if (c === '$' && s === '{') {
        pila.push({ tipo: 'codigo', llaves: 0 });
        i += 2;
        prev = '{';
        palabra = '';
        continue;
      }
      if (c === '<' && fuente.startsWith('<!--', i)) {
        const fin = fuente.indexOf('-->', i + 4);
        const hasta = fin === -1 ? n : fin + 3;
        blanco(i, hasta);
        i = hasta;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === '/' && s === '/') {
      const fin = fuente.indexOf('\n', i);
      const hasta = fin === -1 ? n : fin;
      blanco(i, hasta);
      i = hasta;
      continue;
    }
    if (c === '/' && s === '*') {
      const fin = fuente.indexOf('*/', i + 2);
      const hasta = fin === -1 ? n : fin + 2;
      blanco(i, hasta);
      i = hasta;
      continue;
    }
    if (c === '<' && fuente.startsWith('<!--', i)) {
      const fin = fuente.indexOf('-->', i + 4);
      const hasta = fin === -1 ? n : fin + 3;
      blanco(i, hasta);
      i = hasta;
      continue;
    }
    if (c === "'" || c === '"') {
      // Solo es cadena si cierra en la misma línea. Si no, es un apóstrofo suelto en prosa
      // (frecuente en markup Astro) y tratarlo como apertura dejaría el resto de la línea sin
      // escanear, con comentarios que ya no se quitan.
      let j = i + 1;
      let cerrada = false;
      while (j < n) {
        if (fuente[j] === '\n') break;
        if (fuente[j] === '\\') { j += 2; continue; }
        if (fuente[j] === c) { j += 1; cerrada = true; break; }
        j += 1;
      }
      if (cerrada) {
        i = j;
        prev = c;
        palabra = '';
        continue;
      }
    }
    if (c === '`') {
      pila.push({ tipo: 'texto' });
      i += 1;
      prev = '`';
      palabra = '';
      continue;
    }
    if (c === '/' && abreRegex(prev, palabra)) {
      let j = i + 1;
      let clase = false;
      let cerrado = false;
      while (j < n) {
        const r = fuente[j];
        if (r === '\n') break;
        if (r === '\\') { j += 2; continue; }
        if (clase) { if (r === ']') clase = false; j += 1; continue; }
        if (r === '[') { clase = true; j += 1; continue; }
        if (r === '/') { j += 1; cerrado = true; break; }
        j += 1;
      }
      if (cerrado) {
        while (j < n && /[a-z]/i.test(fuente[j])) j += 1;
        i = j;
        prev = '/';
        palabra = '';
        continue;
      }
      // No cerró en la línea: era división. Se copia un carácter y se sigue.
    }

    if (c === '{') marco.llaves += 1;
    if (c === '}') {
      if (marco.llaves === 0 && pila.length > 1) {
        pila.pop(); // cierre de una interpolación: vuelve el texto de la plantilla
        i += 1;
        prev = '}';
        palabra = '';
        continue;
      }
      marco.llaves -= 1;
    }

    if (!/\s/.test(c)) prev = c;
    palabra = /[\w$]/.test(c) ? palabra + c : '';
    i += 1;
  }

  return out.join('');
}
