import json, collections, re
cov=json.load(open('coverage.json')); assets=json.load(open('assets.json'))
crawl=[l.split('|') for l in open('crawl.log').read().strip().split('\n')]
idx={u.replace('https://iwage.co','') or '/':i for i,c,u in crawl}
def own(src): return '/images/' in src and '/perfiles/' not in src
def stock(src): return 'unsplash' in src or 'tienda.iwage.co' in src
rows=[]
for p in cov['pages']:
    sec = '/'+p.strip('/').split('/')[0] if p.strip('/') else '/(home)'
    e_own=sum(1 for e in assets if own(e['src']) and p in e['pages'])
    e_exc=sum(1 for e in assets if own(e['src']) and e['n']==1 and p in e['pages'])
    e_stk=sum(1 for e in assets if stock(e['src']) and p in e['pages'])
    rot=sum(1 for e in assets if '/images/perfiles/' in e['src'] and p in e['pages'])
    rows.append((sec,p,e_own,e_stk,e_exc,rot))
g=collections.defaultdict(lambda:[0,0,0,0,0])
for sec,p,o,s,x,r,*_ in [(a,b,c,d,e,f) for a,b,c,d,e,f in rows]:
    g[sec][0]+=1
    if o>0: g[sec][1]+=1
    if s>0: g[sec][2]+=1
    if x>0: g[sec][3]+=1
print(f"{'sección':28}{'pág':>5}{'con img propia':>16}{'con stock':>11}{'con img exclusiva':>20}")
for sec,(n,o,s,x,_r) in sorted(g.items(), key=lambda k:-k[1][0]):
    print(f"{sec:28}{n:>5}{o:>16}{s:>11}{x:>20}")
print()
print('== páginas con imagen EXCLUSIVA ==')
for sec,p,o,s,x,r in rows:
    if x: print(f'  {p:52} exclusiva={x} propia={o}')
print()
print('== páginas cuya ÚNICA imagen es stock externa (relleno) ==')
n=0
for sec,p,o,s,x,r in rows:
    if s and not o: n+=1; print(f'  {p}')
print('  total:',n)
print()
print('== páginas con referencia ROT ==')
for sec,p,o,s,x,r in rows:
    if r: print(f'  {p}  rotas={r}')
