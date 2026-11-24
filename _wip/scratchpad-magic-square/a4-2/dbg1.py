import sys
sys.path.insert(0, sys.argv[1])
import rs2
m = rs2.m
n=5; g=[0,0,4,25,18,20,0,0,0,0,12,0,0,17,0,0,10,0,0,0,6,23,2,15,19]
geo=m.geo_of(n)
r=rs2.read_solve2(geo,g,bounds='range',bounds_tier=1)
print(r['steps'][0])
sol=r['grid']
# show bounds per cell at the initial board
used=0
for v in g:
    if v: used|=1<<v
unused=geo.full&~used
vals=sorted(m.bits(unused))
print('unused',vals)
cand={c:unused for c in range(25) if not g[c]}
for li,em,rr in m._line_states(geo,g,[(L,geo.M) for L in geo.lines]):
    e=len(em)
    if e<2: continue
    lo=rr-sum(vals[-(e-1):]); hi=rr-sum(vals[:e-1])
    print(geo.line_names[li], 'empties', [divmod(c,5) for c in em], 'r',rr,'range',lo,hi)
    for c in em: cand[c]&=geo.range_mask(lo,hi)
for c in sorted(cand):
    print(divmod(c,5), sorted(m.bits(cand[c])), 'sol', sol[c])
for v in vals:
    w=[divmod(c,5) for c in cand if cand[c]>>v&1]
    if len(w)<=2: print('value',v,'only at',w)
