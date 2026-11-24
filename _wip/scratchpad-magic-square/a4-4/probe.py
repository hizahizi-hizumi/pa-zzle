"""確かめ役の向きを範囲内の問題に当てる。python3 -I probe.py <out.jsonl> <name=json設定> ..."""
import sys, json, collections, multiprocessing as mp
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4")
import msd4 as p

W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
CFG = {}

def lvl(geo, g, kw, virt=True):
    f = p.read_features(geo, g, p.read_solve(geo, g, **kw))
    if geo.n == 4 and virt:
        f["_virtual"] = p.read_features(geo, g, p.read_solve(geo, g, extra_lines=p.VIRTUAL4, **kw))
    lv, why = p.single_level_v4(f, geo.n, p.SIZES_C2, cap=None)
    return (lv if lv else why), [f["entry"], f["first_tier"], f["first_sweeps"], f["d2max"], f["t3"], f["tier_max"]]

def one(d):
    geo = p.geo_of(d["features"]["n"])
    out = {}
    for name, kw in CFG.items():
        out[name] = lvl(geo, d["givens"], kw)
    return {"id": d["id"], "n": d["features"]["n"], "level": d["level"], "r": out}

def init(cfg):
    CFG.update(cfg)

if __name__ == "__main__":
    out = sys.argv[1]
    cfg = {}
    for a in sys.argv[2:]:
        k, v = a.split("=", 1)
        cfg[k] = json.loads(v)
    rows = [json.loads(x) for x in open(W + "/classified.jsonl")]
    acc = [d for d in rows if d["level"]]
    with mp.Pool(3, initializer=init, initargs=(cfg,)) as pool:
        res = pool.map(one, acc, chunksize=4)
    with open(out, "w") as fo:
        for r in res:
            fo.write(json.dumps(r) + "\n")
    for name in cfg:
        ch = [(r["n"], r["level"], r["r"][name][0]) for r in res if r["r"][name][0] != r["level"]]
        byn = collections.Counter(n for n, _, _ in ch)
        tot = collections.Counter(r["n"] for r in res)
        mv = collections.Counter((a, b) for _, a, b in ch)
        print(f"{name}: {len(ch)}/{len(res)} ({len(ch)/len(res):.1%}) "
              + " ".join(f"{n}x{n} {byn[n]}/{tot[n]}" for n in sorted(tot))
              + " | " + ", ".join(f"L{a}->{b} {k}" for (a, b), k in mv.most_common(8)))
