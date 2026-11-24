import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
_, ins = xlib.load_inrange()
c = collections.Counter()
for d in ins:
    if d["level"] not in (4, 5): continue
    n = d["features"]["n"]; g = d["givens"]; geo = m.geo_of(n)
    mx = {}
    for v in m.AGREE:
        f = m.read_features(geo, g, m.read_solve(geo, g, **m.VARIANTS[v]))
        mx[v] = max(f["d2max"], f["d3max"])
    worst = max(mx.values())
    c[(d["level"], d["features"]["d3max"], worst)] += 1
for k, v in sorted(c.items()):
    print(f"L{k[0]} 基準の d3max {k[1]} / 21変種での巡の最大 {k[2]}: {v}")
