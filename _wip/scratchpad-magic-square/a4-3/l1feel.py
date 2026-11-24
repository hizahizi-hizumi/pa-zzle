import sys, os, collections, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
rows, ins = xlib.load_inrange()
geo = m.geo_of(4)
grp = {"L1": [d for d in ins if d["level"] == 1], "not-minimal": [d for d in rows if d["reason"] == "not-minimal"]}
def feel(d):
    g = d["givens"]
    r = m.read_solve(geo, g)
    st = r["steps"]
    return {"givens": d["features"]["givens"], "entry": d["features"]["entry"], "rounds": len(st),
            "max_batch": max(s["found"] for s in st), "min_batch": min(s["found"] for s in st),
            "rp": d["naive_rp_undos"]}
for k, ds in grp.items():
    fs = [feel(d) for d in ds]
    print(k, len(ds))
    for key in fs[0]:
        c = collections.Counter(f[key] for f in fs)
        print("  ", key, dict(sorted(c.items())))
