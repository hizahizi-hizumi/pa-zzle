import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
rows, ins = xlib.load_inrange()
bad = 0
for d in rows:
    n = d["features"]["n"]; geo = m.geo_of(n); g = d["givens"]
    for v in [None] + m.AGREE + ["jointk3d2", "nochain", "chain3", "nolock"]:
        kw = m.VARIANTS[v] if v else {}
        a = m.read_solve(geo, g, **kw); b = xlib.read_solve_x(geo, g, **kw)
        if a["status"] != b["status"] or a["steps"] != b["steps"]:
            bad += 1
print("rows", len(rows), "mismatch", bad)
