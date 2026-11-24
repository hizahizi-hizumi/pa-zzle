"""L1 の極小さが読み方で崩れる例の再現。"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
geo = m.geo_of(4)
g = [0,0,4,0,0,3,13,6,0,2,0,0,10,15,1,0]   # ms4-T1-k0-0（L1）
print("base L1 minimal:", m.is_tier1_minimal(geo, g))
for name, kw in (("viol1", m.VARIANTS["viol1"]), ("range1", m.VARIANTS["range1"]), ("virtual", {"extra_lines": m.VIRTUAL4})):
    for i in [i for i, v in enumerate(g) if v]:
        h = [0 if j == i else v for j, v in enumerate(g)]
        r = m.read_solve(geo, h, max_tier=1, **kw)
        if r["status"] == "solved":
            rb = m.read_solve(geo, h, max_tier=1)
            print(f"{name}: 外す ({i//4},{i%4})={g[i]} -> 段1だけで解ける。手順 {[(s['tier'], s['sweeps'], s['kinds'], [(c//4, c%4) for c in s['cells']]) for s in r['steps']]}; 基準の段1では {rb['status']}")
            break
