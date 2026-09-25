import json, re, os, collections
assets = json.load(open('assets.json'))
crawl = [l.split('|') for l in open('crawl.log').read().strip().split('\n')]
urls = {i:u for i,c,u in crawl}
pages = sorted(u.replace('https://iwage.co','') or '/' for u in urls.values())

def origin(src):
    if 'analitica.camilosaldarriaga' in src: return 'excluido:pixel'
    if src.endswith('favicon.svg'): return 'genérico:favicon'
    if '/images/perfiles/' in src and src.endswith('.jpg'): return 'roto:referencia'
    if '/images/' in src: return 'propio:public'
    if '/uploads/' in src: return 'propio:strapi'
    if 'unsplash' in src or 'tienda.iwage.co' in src: return 'externo:stock/hotlink'
    if 'openstreetmap' in src or 'maps.google' in src: return 'externo:mapa'
    return 'otro'

# 1. census
by_orig = collections.Counter()
for e in assets: by_orig[origin(e['src'])]+=1
print('== CENSO DE URLs DE MEDIA RENDERIZADAS (únicas) ==')
for k,v in sorted(by_orig.items(), key=lambda x:-x[1]): print(f'  {v:4d}  {k}')

# 2. reused vs exclusive (own public assets only)
own = [e for e in assets if origin(e['src'])=='propio:public']
reused = [e for e in own if e['n']>1]
excl   = [e for e in own if e['n']==1]
print(f'\n== MEDIA PROPIOS ({len(own)} únicos) ==')
print(f'  reutilizados en >1 página (genéricos): {len(reused)}')
for e in sorted(reused,key=lambda x:-x['n']): print(f'    {e["n"]:4d}p  {e["src"].split(".co")[-1]}')
print(f'  exclusivos de 1 página: {len(excl)}')
for e in sorted(excl,key=lambda x:x['src']): print(f'    1p  {e["src"].split(".co")[-1]}')

# 3. per page coverage with NON-generic, non-reused own images
perpage_excl = collections.Counter(); perpage_any = collections.Counter()
for e in own:
    for p in e['pages']:
        perpage_any[p]+=1
        if e['n']==1: perpage_excl[p]+=1
with_excl = {p for p in pages if perpage_excl[p]>0}
with_any  = {p for p in pages if perpage_any[p]>0}
print(f'\n== COBERTURA POR PÁGINA ({len(pages)} URLs del sitemap) ==')
print(f'  con >=1 imagen propia (aunque sea reutilizada): {len(with_any)}')
print(f'  con >=1 imagen EXCLUSIVA/dedicada:              {len(with_excl)}')
print(f'  SIN ninguna imagen propia:                      {len(pages)-len(with_any)}')

# 4. dead assets on disk
disk = set()
for r,d,f in os.walk('/home/ubuntu/negocio/data/app_iwage/public'):
    for x in f:
        p='/'+os.path.relpath(os.path.join(r,x), '/home/ubuntu/negocio/data/app_iwage/public')
        if os.path.splitext(x)[1].lower() in ('.webp','.png','.jpg','.jpeg','.avif','.gif','.svg'): disk.add(p)
used = {e['src'].replace('https://iwage.co','') for e in assets if '/images/' in e['src']}
print(f'\n== BIBLIOTECA EN DISCO (public/) vs RENDERIZADA ==')
print(f'  archivos de imagen en public/: {len(disk)}')
print(f'  usados en el sitio vivo:       {len(used & disk)}')
dead = sorted(disk - used)
print(f'  MUERTOS (existen, no se sirven en ninguna página): {len(dead)}')
groups=collections.Counter(d.split('/')[2] if d.count('/')>2 else '(raíz)' for d in dead)
for k,v in groups.most_common(): print(f'    {v:4d}  {k}')
missing = sorted(used - disk)
print(f'  referenciados pero AUSENTES en disco: {len(missing)}')
for m in missing: print(f'    {m}')

# 5. pages with no imagery at all (excluding pixel/favicon)
noin=[p for p in pages if perpage_any[p]==0]
print(f'\n== {len(noin)} PÁGINAS SIN IMAGEN PROPIA ==')
for p in noin: print('   ',p)
json.dump({'pages':pages,'perpage_any':dict(perpage_any),'perpage_excl':dict(perpage_excl)},open('coverage.json','w'))
