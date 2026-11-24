"""部品の4つ以上の組み合わせを範囲内の問題に当てる。python3 -I probe_combos.py <out> <mode>"""
import sys, json, itertools, collections, multiprocessing as mp, random
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m
W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
SP = {"memo4", "weak", "lock_eph", "diag_nochain", "chain4t3"}

def valid(t):
    kw = m.variant_kw("+".join(t))
    if kw is None or any(kw == m.VARIANTS[x] for x in t):
        return False
    return all(m.variant_kw("+".join(u)) != kw for u in itertools.combinations(t, len(t) - 1))

def names(mode):
    if mode == "c4s2":
        return ["+".join(t) for t in itertools.combinations(m.AGREE, 4) if valid(t) and len(SP & set(t)) >= 2]
    if mode == "c5s3":
        return ["+".join(t) for t in itertools.combinations(m.AGREE, 5) if valid(t) and len(SP & set(t)) >= 3]
    if mode == "c4s1rest":
        allf = []
        for t in itertools.combinations(m.AGREE, 4):
            name = "+".join(t)
            kw = m.variant_kw(name)
            if kw is not None and not any(kw == m.VARIANTS[x] for x in t) and all(
                    m.variant_kw("+".join(u)) != kw for u in itertools.combinations(t, 3)):
                allf.append(name)
        done = set(random.Random(6).sample(allf, 1000))
        return [x for x in allf if x not in done and len(SP & set(x.split("+"))) == 1]
    if mode == "c6s4":
        return ["+".join(t) for t in itertools.combinations(m.AGREE, 6) if len(SP & set(t)) >= 4 and valid(t)]
    raise SystemExit(mode)

NAMES = []
def init(ns):
    NAMES.extend(ns)

def one(d):
    geo = m.geo_of(d["features"]["n"])
    return d["id"], [x for x in NAMES if m.combo_level(geo, d["givens"], x)[0] != d["level"]]

if __name__ == "__main__":
    out, mode = sys.argv[1], sys.argv[2]
    ns = names(mode)
    rows = [json.loads(x) for x in open(W + "/classified.jsonl")]
    acc = [d for d in rows if d["level"]]
    print(mode, len(ns), "combos x", len(acc), file=sys.stderr, flush=True)
    with mp.Pool(3, initializer=init, initargs=(ns,)) as pool, open(out, "w") as fo:
        for i, (pid, bad) in enumerate(pool.imap_unordered(one, acc, chunksize=1)):
            fo.write(json.dumps({"id": pid, "bad": bad}) + "\n"); fo.flush()
    res = [json.loads(x) for x in open(out)]
    lv = {d["id"]: (d["features"]["n"], d["level"]) for d in acc}
    moved = [r for r in res if r["bad"]]
    print(f"{mode}: {len(ns)} combos; moved {len(moved)}/{len(res)}",
          dict(collections.Counter(lv[r["id"]] for r in moved)),
          collections.Counter(x for r in moved for x in r["bad"]).most_common(10))
