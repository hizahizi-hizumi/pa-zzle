import sys
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
import variants as V
from examples import EXAMPLES
names = sys.argv[2].split(",")
for k, (g, s) in EXAMPLES.items():
    n = int(len(g) ** 0.5); geo = m.geo_of(n)
    lv, f, res = level(n, g)
    row = [f"{k} L{lv} so{f['start_one']} fs{f['first_sweeps']} dm{f['depth_max']} h{f['hard']} t3={f['t3']}"]
    for nm in names:
        fv = V.run_variant(nm, geo, g)
        L2 = G.lvl_of(fv, n)
        mark = "*" if L2 != lv else " "
        row.append(f"{mark}{nm}:L{L2} so{fv['start_one']} fs{fv['first_sweeps']} dm{fv['depth_max']} h{fv['hard']} t3={fv['t3']}")
    print(" | ".join(row))
