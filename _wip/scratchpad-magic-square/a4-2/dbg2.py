import sys, json
sys.path.insert(0, sys.argv[1])
import rs2
m = rs2.m
v = {x['id']: x for x in map(json.loads, open(sys.argv[1] + '/classified.jsonl'))}
d = v[sys.argv[2]]
n = d['features']['n']; g = d['givens']; geo = m.geo_of(n); sol = d['solution']
for i in range(n): print(' '.join(f'{x:2d}' if x else ' .' for x in g[i*n:(i+1)*n]), '   ', ' '.join(f'{x:2d}' for x in sol[i*n:(i+1)*n]))
print(g)
r0 = rs2.read_solve2(geo, g); r1 = rs2.read_solve2(geo, g, bounds='range', bounds_tier=2)
print('base', [(s['tier'], s['sweeps'], [divmod(c, n) for c in s['cells']]) for s in r0['steps']][:3])
print('range2', [(s['tier'], s['sweeps'], [divmod(c, n) for c in s['cells']]) for s in r1['steps']][:3])
used = 0
for x in g:
    if x: used |= 1 << x
vals = sorted(m.bits(geo.full & ~used))
print('unused', vals)
for li, em, rr in m._line_states(geo, g, [(L, geo.M) for L in geo.lines]):
    e = len(em)
    if e >= 3:
        lo = rr - sum(vals[-(e - 1):]); hi = rr - sum(vals[:e - 1])
        if lo > vals[0] or hi < vals[-1]:
            print(geo.line_names[li], 'e', e, 'r', rr, 'bound', lo, hi, [divmod(c, n) for c in em])
