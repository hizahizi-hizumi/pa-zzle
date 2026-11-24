"""範囲内の候補（基準でレベルがあり、L1 は極小、帯に入り、単独の 34 部品で一致する）を、部品の組み合わせを確かめる前の
集合として書く。組み合わせの一致は、新しい読み方で動いた問題だけ後で確かめる（classify_givens）。
出力: data/superset.jsonl（id, n, level（盤面の割り当てを当てる）, raw（当てない）, givens, features, steps）"""
import json
import multiprocessing as mp
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp  # noqa: E402

m = exp.m
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"


def feats(geo, g, kw):
    f = m.read_features(geo, g, m.read_solve(geo, g, **kw))
    if geo.n == 4:
        f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))
    return f


def one(d):
    n, g = d["n"], d["givens"]
    geo = m.geo_of(n)
    res = m.read_solve(geo, g)
    base = m.read_features(geo, g, res)
    if n == 4:
        base["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4))
    lv, why = m.single_level_v6(base, n, m.SIZES_V6)
    out = {"id": d["id"], "n": n, "givens": g, "solution": d["solution"], "level": None, "why": why}
    if lv is None:
        return out
    if lv == 1 and not (n == 4 and m.is_tier1_minimal(geo, g)):
        out["why"] = "not-minimal"
        return out
    w = m.band_reason(base, lv)
    if w:
        out["why"] = w
        return out
    raw = m.single_level_v6(base, n, None)[0]
    for v in m.AGREE:
        if m.single_level_v6(feats(geo, g, m.VARIANTS[v]), n, m.SIZES_V6, cap=None)[0] != lv:
            out["why"] = "reading-dependent(single:" + v + ")"
            return out
    out.update({"level": lv, "raw": raw, "why": None,
                "features": {k: base[k] for k in m.FEATURE_KEYS},
                "steps": [[s["tier"], s["sweeps"], s["found"], s["cells"], sorted(s["kinds"]), s["lock"], s["chain"]]
                          for s in res["steps"]]})
    return out


def main():
    jobs = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    ds = []
    for name in ("h4", "h5", "r5", "h6", "r6"):
        ds += [json.loads(x) for x in open(f"{D}/{name}.jsonl")]
    with mp.Pool(jobs) as pool, open(f"{D}/superset.jsonl", "w") as fh:
        for r in pool.imap(one, ds, chunksize=4):
            fh.write(json.dumps(r, separators=(",", ":")) + "\n")
    rows = [json.loads(x) for x in open(f"{D}/superset.jsonl")]
    import collections
    c = collections.Counter((r["n"], r["level"]) for r in rows if r["level"])
    print(sorted(c.items()), sum(c.values()))
    print(collections.Counter((r["why"] or "").split("(")[0] for r in rows if not r["level"]))


if __name__ == "__main__":
    main()
