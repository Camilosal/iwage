import fs from 'node:fs';
const map = new Map(fs.readFileSync('crawl.log','utf8').trim().split('\n').map(l=>{const [i,c,u]=l.split('|');return [i,u];}));
const acc = new Map(); // src -> {pages:Set, alts:Set, kinds:Set}
function add(src, page, kind, alt=''){
  if(!src) return;
  src = src.trim().replace(/&amp;/g,'&');
  if(!src || src.startsWith('data:') || src.startsWith('{')) return;
  let e = acc.get(src);
  if(!e){ e={pages:new Set(),alts:new Set(),kinds:new Set()}; acc.set(src,e); }
  e.pages.add(page); e.kinds.add(kind);
  if(alt) e.alts.add(alt);
}
const abs = (u, base) => { try { return new URL(u, base).href; } catch { return u; } };
for(const [i,url] of map){
  const html = fs.readFileSync(`html/${i}.html`,'utf8');
  const page = url.replace('https://iwage.co','') || '/';
  // <img>
  for(const m of html.matchAll(/<img\b([^>]*)>/gi)){
    const at = m[1];
    const g = (n)=>{const r=new RegExp(n+'\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i').exec(at); return r?(r[2]??r[3]??r[4]):null;};
    const alt = g('alt')||'';
    const src = g('src'); if(src) add(abs(src,url),page,'img',alt);
    const ss = g('srcset');
    if(ss) for(const cand of ss.split(',')){ const u2=cand.trim().split(/\s+/)[0]; if(u2) { const a=abs(u2,url); if(!acc.has(a)) add(a,page,'srcset'); else {acc.get(a).pages.add(page); acc.get(a).kinds.add('srcset');} } }
  }
  // <source>
  for(const m of html.matchAll(/<source\b[^>]*\bsrcset\s*=\s*"([^"]*)"/gi))
    for(const cand of m[1].split(',')){ const u2=cand.trim().split(/\s+/)[0]; if(u2){ const a=abs(u2,url); if(!acc.has(a)){add(a,page,'source');} else {acc.get(a).pages.add(page); acc.get(a).kinds.add('source');} } }
  // media tags
  for(const k of ['video','audio','iframe','embed','object'])
    for(const m of html.matchAll(new RegExp(`<${k}\\b[^>]*?\\b(?:src|data-src)\\s*=\\s*"([^"]*)"`,`gi`))) add(abs(m[1],url),page,k);
  for(const m of html.matchAll(/poster\s*=\s*"([^"]+)"/gi)) add(abs(m[1],url),page,'poster');
  // css background-image
  for(const m of html.matchAll(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/gi)) add(abs(m[2],url),page,'css-bg');
  // inline style background shorthand
  for(const m of html.matchAll(/background\s*:\s*[^;"']*url\((['"]?)([^'")]+)\1\)/gi)) add(abs(m[2],url),page,'css-bg');
  // og / twitter image
  for(const m of html.matchAll(/<meta\b[^>]*(?:property|name)\s*=\s*"(?:og:image|twitter:image)(?:1|:url)?"[^>]*>/gi))
    for(const c of m[0].matchAll(/content\s*=\s*"([^"]*)"/gi)) add(abs(c[1],url),page,'meta-og');
  // icons / manifests
  for(const m of html.matchAll(/<link\b[^>]*rel\s*=\s*"(icon|shortcut icon|apple-touch-icon|mask-icon|manifest)"[^>]*>/gi))
    for(const c of m[0].matchAll(/href\s*=\s*"([^"]*)"/gi)) add(abs(c[1],url),page,'icon');
  // JSON-LD image
  for(const m of html.matchAll(/<script[^>]*type\s*=\s*"application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
    for(const c of m[1].matchAll(/"(?:image|thumbnailUrl|contentUrl|logo)"\s*:\s*"([^"]+)"/g)) add(abs(c[1],url),page,'jsonld');
    for(const c of m[1].matchAll(/"@type"\s*:\s*"(VideoObject|AudioObject|ImageObject|MediaObject)"/g)) add('TAG:'+c[1],page,'schema-type');
  }
}
fs.writeFileSync('assets.json', JSON.stringify([...acc.entries()].map(([src,e])=>({src,pages:[...e.pages].sort(),n:e.pages.size,kinds:[...e.kinds].sort(),alts:[...e.alts].slice(0,3)})).sort((a,b)=>b.n-a.n),null,1));
const byKind={}; for(const [src,e] of acc) for(const k of e.kinds) byKind[k]=(byKind[k]||0)+1;
console.log('URLs únicos con media:',acc.size);
console.log('por tipo:',byKind);
