"""superset の候補に、部品の2つの組み合わせだけで一致を確かめる（速い。3つの組で初めて外れる候補は agree6 で別に確かめる）。"""
import json, multiprocessing as mp, sys
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp
m = exp.m
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"
TWO = [c for c in m.AGREE_COMBOS if c.count("+") == 1]

def one(d):
    geo = m.geo_of(d["n"])
    for c in TWO:
        if m.combo_level(geo, d["givens"], c)[0] != d["raw"]:
            return {"id": d["id"], "bad": [c], "checked2": len(TWO)}
    return {"id": d["id"], "bad": [], "checked2": len(TWO)}

if __name__ == "__main__":
    rows = [json.loads(x) for x in open(f"{D}/superset.jsonl") if '"level":null' not in x]
    with mp.Pool(int(sys.argv[1])) as pool, open(f"{D}/agree2.jsonl", "w") as fh:
        for r in pool.imap_unordered(one, rows, chunksize=2):
            fh.write(json.dumps(r) + "\n"); fh.flush()
    print(len(TWO))
