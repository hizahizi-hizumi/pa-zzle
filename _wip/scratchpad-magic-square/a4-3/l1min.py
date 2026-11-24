"""L1（4×4、段1だけで解け、段1で極小）の極小さを、読み方ごとに測り直す。"""
import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
rows, ins = xlib.load_inrange()
L1 = [d for d in ins if d["level"] == 1]
NM = [d for d in rows if d["reason"] == "not-minimal"]
geo = m.geo_of(4)
READ = {name: m.VARIANTS[name] for name in m.AGREE}
READ["virtual"] = {"extra_lines": m.VIRTUAL4}
READ["lin"] = m.VARIANTS["lin"]
READ["range1+virtual"] = {**m.VARIANTS["range1"], "extra_lines": m.VIRTUAL4}

def t1(g, kw):
    return m.read_solve(geo, g, max_tier=1, **kw)["status"] == "solved"

def removable(g, kw):
    return [i for i, v in enumerate(g) if v and t1([0 if j == i else x for j, x in enumerate(g)], kw)]

res = collections.Counter()
ex = {}
for name, kw in READ.items():
    for d in L1:
        g = d["givens"]
        if not t1(g, kw):
            res[(name, "not-solvable")] += 1
            continue
        r = removable(g, kw)
        if r:
            res[(name, "not-minimal")] += 1
            ex.setdefault(name, (d["id"], g, r))
for name in READ:
    a, b = res[(name, "not-minimal")], res[(name, "not-solvable")]
    if a or b:
        print(f"{name}: not-minimal {a}/{len(L1)}, not t1-solvable {b}/{len(L1)}  例 {ex.get(name)}")
print("checked", list(READ))
