import sys, json, collections, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
ds = {json.loads(l)["id"]: json.loads(l) for l in open("pool.jsonl")}
d = ds["ms5-T3-k2-47"]; geo = m.geo_of(5); g = d["givens"]
for nm, r in [("base", m.read_solve(geo, g)), ("pairs", G.gsolve(geo, g, extra_rule=G.rule_pairs, max_tier=3)),
              ("tri3c1", G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=1), max_tier=3))]:
    f = m.read_features(geo, g, r)
    print(nm, "L", G.lvl_of(f, 5), "so", f["start_one"], [(s["tier"], s["sweeps"], s["placed"]) for s in r["steps"]])
print("givens"); [print("  ", " ".join(f"{g[r*5+c] or '.':>2}" for c in range(5))) for r in range(5)]
# 4マス以上で組が少ない列も読む（long_sets）
print("== long_sets")
for k in (1, 2, 3):
    tot = collections.Counter(); chg = collections.Counter()
    for d in ds.values():
        if d["level"] is None: continue
        geo = m.geo_of(d["n"])
        f = m.read_features(geo, d["givens"], m.read_solve(geo, d["givens"], long_sets=k))
        L2 = G.lvl_of(f, d["n"])
        tot[d["level"]] += 1
        if L2 != d["level"]: chg[(d["level"], L2)] += 1
    print(k, dict(chg), "/", dict(tot))
