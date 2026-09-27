// Guarda anti-credenciales. El repo es público y la medición del 2026-09-27 encontró la contraseña
// de PostgreSQL publicada en 4 archivos trackeados, en cuatro formas distintas: valor de un campo
// en un login, dentro de una connection string de respaldo, en un comentario de documentación y
// detrás de `process.env.X ||`. Cada forma tiene su regla, más un digesto que detecta el valor
// aunque aparezca en un lugar que ningún patrón cubre.
//
// Se mide contra `git ls-files`, no contra el disco: lo que no está trackeado no está publicado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

const EXT = new Set(['.mjs', '.js', '.ts', '.py', '.sh', '.sql', '.json', '.yml', '.yaml', '.md']);
const YO = 'tests/no-credenciales-en-repo.test.mjs';

const patrones = [
  // `://usuario:PASS@host` — el grupo perezoso es porque la contraseña publicada lleva `@` adentro
  ['connection-string', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:(\S{6,}?)@[^\s/]+/gi],
  // Campo de credencial con literal: forma JS, forma JSON (`"password": "…"`) y forma
  // `process.env.X || 'literal'`, que es exactamente cómo quedó publicada la contraseña del DB.
  // El intermedio prohíbe `=` y paréntesis para que una comparación (`apiKey === 'claude'`) o el
  // nombre de una cabecera (`headers.get('x-api-key')`) no cuenten como credencial.
  ['campo-credencial', /(?:PGPASSWORD|password|passwd|clave|contrasena|client_secret|api_?key|access_key)["']?\s*[:=]\s*[^;"'\n=()]{0,48}?["']([^"']{6,})["']/gi],
  ['bearer', /(?:Bearer|STRAPI_TOKEN|API_TOKEN)\s*[:=]?\s*["']?([A-Za-z0-9._-]{20,})["']?/g],
];

// Valores que son literatura o fixture, no secreto.
const FALSOS = /^(password|contrasena|secreto|secret|changeme|cambiar|admin|postgres|root|iwage|strapi|example|dummy|test|null|undefined|true|false|x{6,})$/i;
const FIXTURE = /^(media-\w+-?\w*|iwg-\w+|[a-z]+-fixture-\d+|REDACTADO\w*)$/i;
const REFERENCIA = /^(process\.env|os\.environ|env\(|[A-Z][A-Z0-9_]{5,}$)/;

// sha256 del valor publicado el 2026-09-27 (contraseña de PostgreSQL del servidor compartido).
// Está quemado: el digesto permite reconocerlo sin reproducirlo, y la guarda lo ve reaparecer en
// cualquier forma, en la ruta que sea.
const QUEMADOS = new Set([
  'baa1c561d6887c170275fb3f9ed13c4e013850bf33bddccc46b651de42e5eea6',
]);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function ofensas() {
  const list = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const out = [];
  const candidatos = new Map();
  for (const f of list) {
    if (!EXT.has(extname(f)) || f === YO) continue;
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    txt.split('\n').forEach((l, i) => {
      for (const [nombre, re] of patrones) {
        for (const m of l.matchAll(re)) {
          const v = m[1];
          if (FALSOS.test(v) || FIXTURE.test(v) || REFERENCIA.test(v) || /[<>${}«*]/.test(v)) continue;
          out.push(`${f}:${i + 1} [${nombre}] len=${v.length}`);
        }
      }
      // Candidatos al digesto: todo token de 8+ con un dígito o un símbolo, dentro o fuera de
      // comillas. Solo-comillas no alcanza: el valor publicado escrito suelto debe aparecer.
      for (const m of l.matchAll(/["'`]([^"'`\s]{8,})["'`]/g)) candidatos.set(m[1], `${f}:${i + 1}`);
      for (const m of l.matchAll(/[A-Za-z0-9@#%._+-]{8,}/g)) {
        if (/[0-9]/.test(m[0]) || /[^A-Za-z0-9]/.test(m[0])) candidatos.set(m[0], `${f}:${i + 1}`);
      }
    });
  }
  for (const [v, donde] of candidatos) {
    let decode = v;
    try { decode = decodeURIComponent(v); } catch { /* no es un percent-encoding */ }
    if (QUEMADOS.has(v) || QUEMADOS.has(sha256(v)) || QUEMADOS.has(sha256(decode))) {
      out.push(`${donde} [digesto-quemado] len=${v.length}`);
    }
  }
  return [...new Set(out)].sort();
}

test('el repo no publica credenciales en claro', () => {
  const o = ofensas();
  assert.deepEqual(o, [], `credenciales en archivos trackeados:\n  ${o.join('\n  ')}`);
});
