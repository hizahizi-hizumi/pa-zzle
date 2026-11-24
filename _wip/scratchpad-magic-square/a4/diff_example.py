import sys, json, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
from explain_first import name_unit
rs = [json.loads(l) for l in open('v_main.jsonl')]
ds = {json.loads(l)['id']: json.loads(l) for l in open('pool.jsonl')}
var = sys.argv[2]; frm = int(sys.argv[3]); to = int(sys.argv[4])
hits = [r for r in rs if r['level'] == frm and r['var'][var]['level'] == to and r['var'][var]['first_sweeps'] == 1 and r['n'] == 5]
print(len(hits), [r['id'] for r in hits][:10])
d = ds[hits[int(sys.argv[5]) if len(sys.argv) > 5 else 0]['id']]; g = d['givens']; sol = d['solution']; geo = m.geo_of(5)
r0 = [r for r in rs if r['id'] == d['id']][0]
print(d['id'], 'base', r0['base'], var, r0['var'][var])
for r in range(5):
    print('  ', ' '.join(f"{g[r*5+c] or '.':>2}" for c in range(5)), '   ', ' '.join(f'{sol[r*5+c]:>2}' for c in range(5)))
used = 0
for v in g:
    if v: used |= 1 << v
un = geo.full & ~used; em = [c for c in range(25) if not g[c]]
us = {"diff2u2": functools.partial(G.combo_units, k=2, max_unknowns=2), "joint2": functools.partial(G.joint_units, max_union=3), "chain2": G.chain_units}[var](geo, g)
cand = {c: un for c in em}
r = G._run_tier(geo, g, us, em, un, cand, 2)
print('  残り', sorted(m.bits(un)))
print(f'  {var}: 巡', r[1], '置く', {divmod(c, 5): v for c, v in r[0].items()})
for c in r[0]:
    for u in us:
        if c in u['cells'] and u['key'][0] != 'L':
            sup, req, ns, _ = G.enum_unit(u['cons'], u['cells'], cand, 25)
            mk = sup[u['cells'].index(c)]
            print('   ', divmod(c, 5), name_unit(geo, u), [([divmod(x, 5) for x in cc], co, rr) for cc, co, rr in u['cons']], sorted(m.bits(mk)), '必ず使う', sorted(m.bits(req)) if req else [])
rb = G._run_tier(geo, g, G.base_units(geo, g), em, un, cand, 2)
print('  base: 巡', rb[1], '置く', {divmod(c, 5): v for c, v in rb[0].items()})
