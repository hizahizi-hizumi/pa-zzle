import sys, json
sys.path.insert(0, sys.argv[1])
import rs2
m = rs2.m
ds = [json.loads(l) for l in open(sys.argv[2])]
bad = 0
for d in ds:
    n = d['features']['n']; g = d['givens']; geo = m.geo_of(n)
    f1 = m.read_features(geo, g, m.read_solve(geo, g))
    f2 = m.read_features(geo, g, rs2.read_solve2(geo, g))
    k = [x for x in m.FEATURE_KEYS if x not in ('lock',)]
    if any(f1[x] != f2[x] for x in k) or f1['status'] != f2['status']:
        bad += 1
        if bad < 5: print(d['id'], [(x, f1[x], f2[x]) for x in k if f1[x] != f2[x]])
print('diff', bad, 'of', len(ds))
