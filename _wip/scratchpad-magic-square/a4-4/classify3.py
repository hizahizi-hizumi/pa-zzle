import sys, json, time
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m
W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
m.load_agree_cache(W + "/agree.jsonl")
ds = m.load([W + "/" + x for x in ("h4.jsonl", "h5.jsonl", "q5.jsonl", "h6.jsonl", "q6.jsonl")])
t = time.time()
m.refresh_features(ds, jobs=3)
print("refreshed", time.time() - t, file=sys.stderr)
P = m.PROPOSALS["C2"]
with open(W + "/classified.jsonl", "w") as fh:
    for d in ds:
        f = d["base"]
        lv, reason = m.level_and_reason(P, f, d)
        keep = {k: f[k] for k in m.FEATURE_KEYS}
        fh.write(json.dumps({"id": d["id"], "seed": d["seed"], "T": d["T"], "k": d["k"], "level": lv,
                             "reason": reason, "agree_bad": (d.get("agree") or {}).get("bad", []),
                             "features": keep, "naive_rp_undos": m._rp(d),
                             "givens": d["givens"], "solution": d["solution"]}, separators=(",", ":")) + "\n")
print("done", time.time() - t, file=sys.stderr)
