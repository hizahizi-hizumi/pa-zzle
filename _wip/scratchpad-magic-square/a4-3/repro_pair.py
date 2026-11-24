import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
cl = {d["id"]: d for d in map(json.loads, open(os.path.join(xlib.HERE, "classified.jsonl")))}
pid = sys.argv[1]
sets = sys.argv[2:]
d = cl[pid]; n = d["features"]["n"]; g = d["givens"]; geo = m.geo_of(n)
print(pid, "level", d["level"], "givens", g)
def kw_of(s):
    kw = {}
    for part in s.split("+"):
        if part == "base": continue
        if part.startswith("memo<="):
            kw["memo_max"] = int(part[6:]); continue
        kw.update(m.VARIANTS[part])
    return kw
for s in sets:
    kw = kw_of(s)
    r = xlib.read_solve_x(geo, g, **kw)
    f = m.read_features(geo, g, r)
    lv = m.single_level_v4(f, n, m.SIZES_C2)
    print(f"{s}: level {lv} | (段,巡) {[(st['tier'], st['sweeps']) for st in r['steps']]} status {r['status']}")
