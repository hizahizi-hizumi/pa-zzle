import sys
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
import variants as V
from examples import EXAMPLES
names = sys.argv[2].split(",")
print("問題 | 基準 | " + " | ".join(names))
for k, (g, s) in EXAMPLES.items():
    n = int(len(g) ** 0.5); geo = m.geo_of(n)
    lv, f, res = level(n, g)
    cells = [f"L{lv}({f['start_one']},{f['first_sweeps']},{f['depth_max']},{f['hard']},{f['t3']})"]
    for nm in names:
        fv = V.run_variant(nm, geo, g)
        L2 = G.lvl_of(fv, n)
        cells.append(("*" if L2 != lv else "") + f"L{L2}({fv['start_one']},{fv['first_sweeps']},{fv['depth_max']},{fv['hard']},{fv['t3']})")
    print(k, "|", " | ".join(cells))
