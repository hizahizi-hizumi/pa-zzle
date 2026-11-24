import sys, json, random
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
ds = [json.loads(l) for l in open("pool.jsonl")]
bad = 0
for d in ds:
    geo = m.geo_of(d["n"]); g = d["givens"]
    for kw in ({}, {"sync": False}, {"batch": False}, {"memory": True}):
        a = m.read_solve(geo, g, **kw)
        b = G.gsolve(geo, g, **kw)
        ka = [(s["tier"], s["sweeps"], s["cells"]) for s in a["steps"]]
        kb = [(s["tier"], s["sweeps"], s["cells"]) for s in b["steps"]]
        if a["status"] != b["status"] or ka != kb or a.get("start_one") != b.get("start_one"):
            bad += 1
            print("diff", d["id"], kw, a["status"], b["status"])
            break
    # 一般の数え上げ（係数1でも generic 経路）が enumerate_line と一致するか
    rng = random.Random(1)
    for _ in range(3):
        L = rng.choice(geo.lines)
        em = [c for c in L if not g[c]]
        if not em or len(em) > 3: continue
        cand = {c: geo.full & ~sum(1 << v for v in g if v) for c in em}
        r = geo.M - sum(g[c] for c in L)
        x = m.enumerate_line([cand[c] for c in em], r, geo.N, 10**6)
        y = G.enum_unit([(tuple(em), (1,)*len(em), r), (tuple(em), (1,)*len(em), r)], em, cand, geo.N, 10**6)
        if x[:3] != y[:3]:
            print("enum diff", d["id"], x, y); bad += 1
print("checked", len(ds), "bad", bad)
