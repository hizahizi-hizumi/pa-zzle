"""L5 の最初の行き詰まりで、1つだけ足すと最初の1マスが1巡で決まる結合単位の最小（自由度・本数）を探す。"""
import json, sys, collections
import multiprocessing as mp
WD = sys.argv[1]
sys.path.insert(0, WD)
import rs2
m = rs2.m

def first_step_with(geo, g, unit):
    orig = rs2.build_units2
    def bu(geo_, grid, opt, lines):
        us = orig(geo_, grid, opt, lines)
        if list(grid) == list(g):
            us = us + [unit]
        return us
    rs2.build_units2 = bu
    try:
        r = rs2.read_solve2(geo, g, max_tier=3)
    finally:
        rs2.build_units2 = orig
    return r["steps"][0] if r["steps"] else None

def job(d):
    n = d["features"]["n"]; g = d["givens"]; geo = m.geo_of(n)
    lines = [(L, geo.M) for L in geo.lines]
    us = rs2.jointk_units(geo, g, lines, 4)
    us.sort(key=lambda u: (len(u["cells"]) - len(u["eqs"]), u["lines"], len(u["cells"])))
    for u in us:
        s = first_step_with(geo, g, u)
        if s and s["sweeps"] == 1:
            names = [geo.line_names[k] for k in u["key"][1:]]
            return d["id"], (len(u["cells"]) - len(u["eqs"]), u["lines"], len(u["cells"])), names, s["cells"]
    return d["id"], None, None, None

if __name__ == "__main__":
    ds = [json.loads(l) for l in open(f"{WD}/classified.jsonl")]
    ds = [d for d in ds if d["level"] == 5]
    with mp.Pool(4) as p:
        res = p.map(job, ds)
    c = collections.Counter(r[1] for r in res)
    for k, v in sorted(c.items(), key=lambda kv: str(kv[0])): print(k, v)
    print(len(res))
    for r in res:
        if r[0] in ("ms5-T3-k12-4", "ms5-T3-k0-27", "ms6-T3-k12-8"): print(r)
    json.dump(res, open(f"{WD}/minjoint.json", "w"))
