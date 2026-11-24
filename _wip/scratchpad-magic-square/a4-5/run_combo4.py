"""動きやすいと言われた組を含む、部品の4つの組み合わせを S1 に当てる（あとで範囲内に絞る）。
python3 -I run_combo4.py pre.jsonl out.jsonl
"""
import itertools
import json
import random
import sys
import time

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m  # noqa: E402


def key_of(kw):
    return tuple(sorted((k, repr(v)) for k, v in kw.items()))


def combos():
    seen = {key_of(m.variant_kw(c, merge=True)) for c in m.AGREE_COMBOS}
    out = []
    bases3 = ["one+range1+mrange1", "strong+mrange1+pair1", "strong+mrange2+pair1"]
    bases2 = ["range1+mrange1", "memo4+chain_late"]
    cand = []
    for b in bases3:
        for p in m.AGREE:
            if p not in b.split("+"):
                cand.append(b + "+" + p)
    for b in bases2:
        rest = [p for p in m.AGREE if p not in b.split("+")]
        for p, q in itertools.combinations(rest, 2):
            cand.append(b + "+" + p + "+" + q)
    rest = [p for p in m.AGREE if p != "chain_late"]
    trip = list(itertools.combinations(rest, 3))
    random.Random(11).shuffle(trip)
    for t in trip[:300]:
        cand.append("chain_late+" + "+".join(t))
    for c in cand:
        kw = m.variant_kw(c, merge=True)
        if kw is None:
            continue
        k = key_of(kw)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out


if __name__ == "__main__":
    pre, outp = sys.argv[1], sys.argv[2]
    ds = [json.loads(line) for line in open(pre)]
    ds = [d for d in ds if d["pre_level"] is not None]
    cs = combos()
    print(len(cs), "combos", flush=True)
    t = time.time()
    with open(outp, "w") as fh:
        for i, c in enumerate(cs):
            moved = 0
            for d in ds:
                lv = m.combo_level(m.geo_of(d["n"]), d["givens"], c)[0]
                if lv != d["raw_level"]:
                    moved += 1
                    fh.write(json.dumps({"combo": c, "id": d["id"], "base": d["raw_level"], "level": lv}) + "\n")
                    fh.flush()
            if i % 20 == 0:
                print(i, c, moved, f"{time.time() - t:.0f}s", flush=True)
    print("done", flush=True)
