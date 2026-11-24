import sys, json, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
ds = [json.loads(l) for l in open("pool.jsonl")]
fns = {"diff2": dict(units_fn=functools.partial(G.combo_units, k=2, max_unknowns=3)),
       "tri3": dict(units_fn=functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=2)),
       "chain2": dict(units_fn=G.chain_units), "lin": dict(units_fn=G.lin_units),
       "joint2": dict(units_fn=functools.partial(G.joint_units, max_union=3))}
bad = {k: 0 for k in fns}; solved = {k: 0 for k in fns}
for d in ds[::3]:
    geo = m.geo_of(d["n"])
    for k, kw in fns.items():
        r = G.gsolve(geo, d["givens"], max_tier=3, **kw)
        if r["status"] == "solved":
            solved[k] += 1
            if r["grid"] != d["solution"]: bad[k] += 1
        elif r["status"] == "contradiction": bad[k] += 1
    for pol in ("fresh3", "shortest"):
        r = G.gsolve_policy(geo, d["givens"], policy=pol)
        if r["status"] == "solved" and r["grid"] != d["solution"]: print("policy bad", pol, d["id"])
print("solved", solved, "bad", bad)
