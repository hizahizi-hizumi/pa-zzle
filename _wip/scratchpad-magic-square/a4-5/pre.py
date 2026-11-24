"""候補ごとに、基準の特徴・単独の部品での一致まで（組み合わせの前）の版 6 のレベルを出す。
python3 -I pre.py out.jsonl in1.jsonl ...
"""
import json
import multiprocessing as mp
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m  # noqa: E402


def feats(geo, g, kw):
    res = m.read_solve(geo, g, **kw)
    f = m.read_features(geo, g, res)
    f["_steps"] = [(s["tier"], s["sweeps"], s["cells"]) for s in res["steps"]]
    if geo.n == 4:
        f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))
    return f


def one(d):
    n = d["n"]
    g = d["givens"]
    geo = m.geo_of(n)
    base = feats(geo, g, {})
    lv, why = m.single_level_v6(base, n, m.SIZES_V6)
    raw = m.single_level_v6(base, n, None)[0]
    out = {"id": d["id"], "n": n, "T": d["T"], "k": d["k"], "givens": g, "solution": d["solution"],
           "base": {k: base[k] for k in m.FEATURE_KEYS}, "steps": base["_steps"], "raw_level": raw}
    if lv is not None and lv == 1 and not (n == 4 and m.is_tier1_minimal(geo, g)):
        lv, why = None, "not-minimal"
    if lv is not None:
        why = m.band_reason(base, lv)
        if why:
            lv = None
    if lv is not None:
        for v in m.AGREE:
            if m.single_level_v6(feats(geo, g, m.VARIANTS[v]), n, m.SIZES_V6, cap=None)[0] != lv:
                lv, why = None, "reading-dependent:" + v
                break
    out["pre_level"] = lv
    out["reason"] = why
    return out


if __name__ == "__main__":
    outp = sys.argv[1]
    ds = []
    for p in sys.argv[2:]:
        for line in open(p):
            ds.append(json.loads(line))
    with mp.Pool(3) as pool, open(outp, "w") as fh:
        for r in pool.imap(one, ds, chunksize=4):
            fh.write(json.dumps(r, separators=(",", ":")) + "\n")
