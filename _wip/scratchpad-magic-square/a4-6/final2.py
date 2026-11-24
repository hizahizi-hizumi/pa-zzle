"""2つの組で一致した 869 問（範囲内 850 + 3つの組で初めて外れる 19）で、読み方ごとに動いた問題を数える。
3つの組まで確かめた問題（agree6）は、外れたものを除く。python3 -I final2.py 名前 ..."""
import collections, glob, json, sys
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"
sup = {}
for x in open(f"{D}/superset.jsonl"):
    d = json.loads(x)
    if d["level"]:
        sup[d["id"]] = d
a2 = {json.loads(x)["id"]: json.loads(x) for x in open(f"{D}/agree2.jsonl")}
a6 = {json.loads(x)["id"]: json.loads(x) for x in open(f"{D}/agree6.jsonl")}
base = {i for i, r in a2.items() if not r["bad"] and not (i in a6 and a6[i]["bad"])}
ver = {i for i in base if sup[i]["level"] == 3 or i in a6}
tot = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in base)
print(f"母数 {len(base)}（3つの組まで確かめた・L3 {len(ver)}）: " + ", ".join(f"{n}x{n} L{L} {k}" for (n, L), k in sorted(tot.items())))
names = sys.argv[1:]
res = collections.defaultdict(dict)
for p in glob.glob(f"{D}/res_*.jsonl"):
    for x in open(p):
        r = json.loads(x)
        if r["v"] in names:
            res[r["v"]][r["id"]] = r
for v in names:
    rs = res[v]
    mv = [i for i in base if i in rs and rs[i]["lv"] != sup[i]["raw"]]
    nb = [i for i in mv if rs[i]["lv"] is not None]
    unv = [i for i in mv if i not in ver]
    pn = collections.Counter(sup[i]["n"] for i in mv)
    tn = collections.Counter(sup[i]["n"] for i in base)
    tr = collections.Counter((sup[i]["n"], sup[i]["raw"], rs[i]["lv"] or rs[i]["why"]) for i in mv)
    pl = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in mv)
    print(f"\n{v}: {len(mv)}/{len(base)} ({len(mv) / len(base):.1%})、隣のレベルへ {len(nb)}（{len(nb) / len(base):.1%}）、うち3つの組を確かめていない {len(unv)}")
    print("  盤面: " + " ".join(f"{n}x{n} {pn[n]}/{tn[n]} ({pn[n] / max(tn[n], 1):.1%})" for n in (4, 5, 6)))
    print("  レベル: " + ", ".join(f"{n}x{n} L{L} {pl[(n, L)]}/{k} ({pl[(n, L)] / k:.0%})" for (n, L), k in sorted(tot.items()) if pl[(n, L)]))
    print("  向き: " + ", ".join(f"{n}x{n} L{a}→{b if isinstance(b, str) else 'L' + str(b)} {k}" for (n, a, b), k in sorted(tr.items(), key=str)))
