import sys, json, collections
rs = [json.loads(l) for l in open(sys.argv[1])]
names = list(rs[0]["var"])
print("変種 | 盤面 | L1 | L2 | L3 | L4 | L5 | 計")
for nm in names:
    for n in (4, 5, 6, "all"):
        tot = collections.Counter(); chg = collections.Counter()
        for r in rs:
            if r["level"] is None or (n != "all" and r["n"] != n): continue
            tot[r["level"]] += 1
            if r["var"][nm]["level"] != r["level"]: chg[r["level"]] += 1
        if not tot: continue
        cells = [f"{chg[L]}/{tot[L]}" if tot[L] else "-" for L in range(1, 6)]
        print(f"{nm} | {n} | " + " | ".join(cells) + f" | {sum(chg.values())}/{sum(tot.values())} ({sum(chg.values())/sum(tot.values()):.1%})")
# 値の幅
print()
for nm in ("one", "diff2u2", "joint2", "chain2", "fresh3", "seq_nat", "memory"):
    for L, key in ((5, "first_sweeps"), (5, "depth_max"), (4, "depth_max"), (2, "hard"), (3, "hard")):
        c = collections.Counter()
        for r in rs:
            if r["level"] != L: continue
            c[(r["base"][key], r["var"][nm][key])] += 1
        moved = {k: v for k, v in c.items() if k[0] != k[1]}
        if moved:
            print(nm, f"L{L}", key, "（基準→変種: 件数）", dict(sorted(moved.items())), "動かない", sum(v for k, v in c.items() if k[0] == k[1]))
    # seq の向きの幅
seqs = ["seq_nat", "seq_rev", "seq_r1", "seq_r2", "seq_r3"]
span = collections.Counter()
for r in rs:
    if r["level"] != 5: continue
    v = [r["var"][s]["first_sweeps"] for s in seqs]
    span[(r["base"]["first_sweeps"], min(v), max(v))] += 1
print("seq 5通りの順での L5 の最初の1マスの巡 (基準, 最小, 最大):", dict(sorted(span.items())))
lv = collections.Counter()
for r in rs:
    if r["level"] is None: continue
    ls = {r["var"][s]["level"] for s in seqs}
    lv[(r["level"], len(ls) > 1)] += 1
print("seq の順だけで段が割れる問題 (段, 割れる):", dict(sorted(lv.items())))
