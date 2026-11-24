import sys
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
from examples import EXAMPLES
for k, (g, s) in EXAMPLES.items():
    n = int(len(g) ** 0.5); geo = m.geo_of(n)
    lv, f, res = level(n, g)
    out = [f"{k} L{lv} base " + str([(x['tier'], x['sweeps']) for x in res['steps'] if x['tier'] > 1])]
    for pol in ("fresh3", "shortest"):
        r = G.gsolve_policy(geo, g, policy=pol)
        fv = m.read_features(geo, g, r)
        out.append(f"{pol}: L{G.lvl_of(fv, n)} fs{fv['first_sweeps']} dm{fv['depth_max']} " + str([(x['tier'], x['sweeps']) for x in r['steps'] if x['tier'] > 1]))
    print("\n    ".join(out))
