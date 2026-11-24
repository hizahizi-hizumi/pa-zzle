"""以前の候補（a4/pool.jsonl・a4-2/classified.jsonl）を版 4 で分類し、範囲内の問題に主な反例の読み方を当てる。"""
import sys, os, json, collections, multiprocessing as mp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
SET = {
    "memo<=6": {"memo_max": 6}, "memo<=8": {"memo_max": 8}, "memo<=4": {"memo_max": 4},
    "cum+short3_2": {**m.VARIANTS["cum"], **m.VARIANTS["short3_2"]},
    "cum+range2+short3_2": {**m.VARIANTS["cum"], **m.VARIANTS["range2"], **m.VARIANTS["short3_2"]},
    "weak+short3_2": {**m.VARIANTS["weak"], **m.VARIANTS["short3_2"]},
    "chain>=4@t3": {"chain_tier3_from": 4}, "chain@t3": {"chain_tier3_from": 2},
    "diag_nochain": {"diag_mode": "nochain"},
}
def t1(geo, g, kw):
    return m.read_solve(geo, g, max_tier=1, **kw)["status"] == "solved"
def work(d):
    n = d.get("n") or d["features"]["n"]; g = d["givens"]; geo = m.geo_of(n)
    b, v, mn, _ = m.measure_all(geo, g)
    lv, why = m.classify_v4({"n": n, "base": b, "var": v, "l1_minimal": mn}, m.SIZES_C2)
    out = {"n": n, "level": lv}
    if lv:
        for k, kw in SET.items():
            out[k] = xlib.level_of(n, g, kw)[0]
        if lv == 1:
            out["L1_min_viol1"] = all(not t1(geo, [0 if j == i else x for j, x in enumerate(g)], m.VARIANTS["viol1"]) for i, x in enumerate(g) if x)
            out["L1_min_range1"] = all(not t1(geo, [0 if j == i else x for j, x in enumerate(g)], m.VARIANTS["range1"]) for i, x in enumerate(g) if x)
    return out
if __name__ == "__main__":
    rows = [json.loads(l) for l in open(sys.argv[1])]
    with mp.Pool(4) as p:
        res = p.map(work, rows, chunksize=4)
    ins = [r for r in res if r["level"]]
    print(sys.argv[1], "候補", len(rows), "範囲内", len(ins), dict(collections.Counter((r["n"], r["level"]) for r in ins)))
    for k in SET:
        ch = [r for r in ins if r[k] != r["level"]]
        print(f"  {k}: {len(ch)}/{len(ins)} ({len(ch)/len(ins):.1%})", dict(collections.Counter((r["level"], r[k]) for r in ch).most_common(4)))
    l1 = [r for r in ins if r["level"] == 1]
    if l1:
        print("  L1 の極小さ: viol1 で崩れる", sum(1 for r in l1 if not r["L1_min_viol1"]), "/", len(l1), "range1 で崩れる", sum(1 for r in l1 if not r["L1_min_range1"]), "/", len(l1))
