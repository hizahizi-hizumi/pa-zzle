"""4×4 の範囲内の問題に、仮想の列の一部だけを知っている読み方を当てる。"""
import sys, json, itertools, collections, multiprocessing as mp
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m
W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
SUBS = [s for r in (1, 2, 3, 4) for s in itertools.combinations(range(4), r)]
READS = ["base"] + list(m.AGREE)

def one(d):
    geo = m.geo_of(4)
    g = d["givens"]
    out = {}
    for rd in READS:
        kw = {} if rd == "base" else m.variant_kw(rd)
        full = m.level_v4_raw(m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw)), None)[0]
        for s in SUBS:
            lines = [m.VIRTUAL4[i] for i in s]
            f = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=lines, **kw))
            out[f"{rd}|{''.join(map(str, s))}"] = [m.level_v4_raw(f, None)[0] or m.level_v4_raw(f, None)[1], full]
    return {"id": d["id"], "level": d["level"], "r": out}

if __name__ == "__main__":
    rows = [json.loads(x) for x in open(W + "/classified.jsonl")]
    acc = [d for d in rows if d["level"] and d["features"]["n"] == 4]
    with mp.Pool(3) as pool:
        res = pool.map(one, acc, chunksize=2)
    with open(W + "/res_v4sub.jsonl", "w") as fo:
        for r in res:
            fo.write(json.dumps(r) + "\n")
    for s in SUBS:
        key = "base|" + "".join(map(str, s))
        ch = collections.Counter((r["level"], r["r"][key][0]) for r in res if r["r"][key][0] != r["level"])
        print("subset", s, sum(ch.values()), "/", len(res), dict(ch))
    anyr = collections.Counter()
    for r in res:
        mv = [k for k, v in r["r"].items() if v[0] != r["level"]]
        if mv:
            anyr[r["level"]] += 1
    print("any reading x subset moves:", dict(anyr))
    low = collections.Counter()
    for r in res:
        mv = [k for k, v in r["r"].items() if isinstance(v[0], int) and v[0] < r["level"]]
        if mv:
            low[r["level"]] += 1
            print(r["id"], r["level"], mv[:6])
    print("lowered:", dict(low))
