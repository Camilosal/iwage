/**
 * dom-mini — el DOM justo para ejecutar el `<script>` de cliente de `MediaGallery.astro`.
 *
 * Por qué existe: en el repo no hay jsdom (ni dependencia de tests que lo traiga, y añadir
 * una no es decisión de esta rama) y, sobre todo, porque lo único que prueba que el thumbnail
 * y el visor de la galería no vuelvan a divergir es CORRER el mismo JS que corre en el
 * navegador y mirar el estado resultante. Un teste de texto fuente no puede: el defecto que
 * cachó esta prueba (Reviewer A#8) era invisible en el fuente de los dos archivos.
 *
 * Soporta lo que usa ese script y NADA más, y lanza si le piden un selector que no
 * implementa — un stub que devuelve `[]` por no entender un selector aprobaría la prueba sin
 * haberla medido, que es exactamente el modo de fallo que esta rama viene persiguiendo:
 *  · selectores `[attr]`, `[attr="valor"]` y de etiqueta suelta (`video`, `iframe`, `img`)
 *  · `classList` (add/remove/contains/toggle), `style`, `textContent`, `src`, `alt`
 *  · `appendChild`, `innerHTML = ''` (vaciar, que es lo que hace `show()`)
 *  · `addEventListener` + `dispatch(type)` para simular el click del usuario
 *  · `document.querySelector/All`, `createElement`, `body.style`, listeners en `document`
 */

class ClassList {
  constructor(el) { this.el = el; }
  _set() { return new Set((this.el.attrs.class || '').split(/\s+/).filter(Boolean)); }
  _write(s) { this.el.attrs.class = [...s].join(' '); }
  contains(c) { return this._set().has(c); }
  add(...cs) { const s = this._set(); cs.forEach((c) => s.add(c)); this._write(s); }
  remove(...cs) { const s = this._set(); cs.forEach((c) => s.delete(c)); this._write(s); }
  toggle(c, force) {
    const s = this._set();
    const on = force === undefined ? !s.has(c) : Boolean(force);
    if (on) s.add(c); else s.delete(c);
    this._write(s);
    return on;
  }
}

function soportado(sel) {
  return /^\[[-\w]+(?:=(["']?)[^\]"']*\1)?\]$/.test(sel) || /^[a-zA-Z][\w-]*$/.test(sel);
}

function casa(el, sel) {
  const attr = sel.match(/^\[([-\w]+)(?:=(["']?)([^\]"']*)\2)?\]$/);
  if (attr) {
    const [, nombre, , valor] = attr;
    if (!(nombre in el.attrs)) return false;
    return valor === undefined || String(el.attrs[nombre]) === valor;
  }
  return el.tagName === sel.toUpperCase();
}

export class El {
  constructor(tag, attrs = {}) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.style = {};
    this.textContent = '';
    this.parentNode = null;
    this._listeners = {};
    this.classList = new ClassList(this);
  }

  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }

  // `show()` hace `stage.innerHTML = ''` para vaciar el escenario. Un innerHTML con contenido
  // exigiría parsear HTML, que es justo lo que este stub no hace: si alguien lo necesita,
  // falla acá en vez de ignorarse en silencio.
  set innerHTML(v) {
    if (v === '') { this.children = []; return; }
    throw new Error('dom-mini: innerHTML no soportado con contenido');
  }
  get innerHTML() { return ''; }

  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? String(this.attrs[k]) : null; }
  pause() {}
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  dispatch(type, event = {}) { (this._listeners[type] || []).forEach((fn) => fn(event)); }

  _descendientes() {
    const out = [];
    const caminar = (n) => { for (const c of n.children) { out.push(c); caminar(c); } };
    caminar(this);
    return out;
  }

  querySelectorAll(sel) {
    if (!soportado(sel)) throw new Error(`dom-mini: selector no soportado: ${sel}`);
    return this._descendientes().filter((e) => casa(e, sel));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

/** Documento falso: `nodos` son las raíces que el script debe alcanzar por querySelector. */
export function crearDocumento(...nodos) {
  const raiz = new El('fragmento');
  nodos.forEach((n) => raiz.appendChild(n));
  const doc = {
    body: new El('body'),
    _listeners: {},
    createElement: (tag) => new El(tag),
    querySelector: (sel) => raiz.querySelector(sel),
    querySelectorAll: (sel) => raiz.querySelectorAll(sel),
    addEventListener(type, fn) { (doc._listeners[type] ||= []).push(fn); },
    dispatch(type, event = {}) { (doc._listeners[type] || []).forEach((fn) => fn(event)); },
  };
  return doc;
}

/**
 * Montaje equivalente al HTML que emite `MediaGallery.astro` para `items`.
 * `render` es lo que decide el componente en el servidor: 'img' | 'video' | 'iframe'.
 */
export function montarGaleria(gid, items) {
  const wrapper = new El('div', { 'data-gallery-wrapper': gid });
  const lightbox = new El('div', { 'data-gal-lightbox': gid, class: 'hidden' });
  const stage = new El('div', { 'data-gal-stage': '' });
  const counter = new El('span', { 'data-gal-counter': '' });
  const title = new El('div', { 'data-gal-title': '', class: 'hidden' });
  lightbox.appendChild(stage);
  lightbox.appendChild(counter);
  lightbox.appendChild(title);
  lightbox.appendChild(new El('button', { 'data-gal-prev': '' }));
  lightbox.appendChild(new El('button', { 'data-gal-next': '' }));
  lightbox.appendChild(new El('div', { 'data-gal-close': '' }));

  items.forEach((item, i) => {
    const btn = new El('button', { 'data-gal-open': String(i) });
    if (i === 0 && item.render === 'img') {
      const principal = new El('img', { 'data-gal-main-img': 'true' });
      principal.src = item.url;
      btn.appendChild(principal);
    }
    wrapper.appendChild(btn);

    const tira = new El('button', { 'data-gal-strip': String(i) });
    if (item.render === 'img') {
      const mini = new El('img');
      mini.src = item.url;
      tira.appendChild(mini);
    }
    lightbox.appendChild(tira);
  });

  // El escenario arranca pintado por el servidor solo si items[0] es img (igual que la plantilla).
  if (items[0]?.render === 'img') {
    const visor = new El('img', { 'data-gal-img': '' });
    visor.src = items[0].url;
    stage.appendChild(visor);
  } else {
    stage.appendChild(new El('div', { 'data-gal-img-placeholder': '' }));
  }

  const datos = new El('script', { 'data-gal-items': gid });
  datos.textContent = JSON.stringify(items);

  return { wrapper, lightbox, datos, doc: crearDocumento(wrapper, lightbox, datos) };
}

/** Extrae el cuerpo del `<script define:vars={{ gid }}>` del componente. */
export function guionDelComponente(fuente) {
  const m = fuente.match(/<script\s+define:vars=\{\{\s*gid\s*\}\}>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no se encontró el <script define:vars={{ gid }}> de MediaGallery');
  return m[1];
}
