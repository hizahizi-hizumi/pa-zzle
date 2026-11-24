"""範囲内（部品の2つの組で一致し、L3 以外は3つの組でも一致を確かめたもの）で、読み方ごとに動いた問題を数える。
L3 は 2つの組で一致した数が入力の範囲内の数（5×5 198・6×6 117）と同じなので、全部範囲内とみなす。
python3 -I final.py 名前 名前 ...（res_*.jsonl のどれかにある読み方）"""
import collections
import glob
import json
import sys

D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"
sup = {}
for x in open(f"{D}/superset.jsonl"):
    d = json.loads(x)
    if d["level"]:
        sup[d["id"]] = d
a2 = {json.loads(x)["id"]: json.loads(x) for x in open(f"{D}/agree2.jsonl")}
a6 = {json.loads(x)["id"]: json.loads(x) for x in open(f"{D}/agree6.jsonl")}
ok2 = {i for i, r in a2.items() if not r["bad"]}
inr = {i for i in ok2 if sup[i]["level"] == 3 or (i in a6 and not a6[i]["bad"])}
unk = {i for i in ok2 if i not in inr and i not in a6}
tot = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in inr)
totu = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in unk)
print(f"範囲内と確かめた {len(inr)}（未確認 {len(unk)}）: " + ", ".join(f"{n}x{n} L{L} {k}+{totu[(n, L)]}" for (n, L), k in sorted(tot.items())))
names = sys.argv[1:]
res = collections.defaultdict(dict)
for p in glob.glob(f"{D}/res_*.jsonl"):
    for x in open(p):
        r = json.loads(x)
        if r["v"] in names:
            res[r["v"]][r["id"]] = r
for v in names:
    rs = res[v]
    mv = [i for i in inr if i in rs and rs[i]["lv"] != sup[i]["raw"]]
    mvu = [i for i in unk if i in rs and rs[i]["lv"] != sup[i]["raw"]]
    nb = [i for i in mv if rs[i]["lv"] is not None]
    pn = collections.Counter(sup[i]["n"] for i in mv)
    tn = collections.Counter(sup[i]["n"] for i in inr)
    pl = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in mv)
    tr = collections.Counter((sup[i]["n"], sup[i]["raw"], rs[i]["lv"] or rs[i]["why"]) for i in mv)
    print(f"\n{v}: {len(mv)}/{len(inr)} ({len(mv) / len(inr):.1%})、隣のレベルへ {len(nb)}（{len(nb) / len(inr):.1%}）、未確認で動いた {len(mvu)}")
    print("  盤面: " + " ".join(f"{n}x{n} {pn[n]}/{tn[n]} ({pn[n] / max(tn[n], 1):.1%})" for n in (4, 5, 6)))
    print("  レベル: " + ", ".join(f"{n}x{n} L{L} {pl[(n, L)]}/{k}" for (n, L), k in sorted(tot.items()) if pl[(n, L)]))
    print("  向き: " + ", ".join(f"{n}x{n} L{a}→{b if isinstance(b, str) else 'L' + str(b)} {k}" for (n, a, b), k in sorted(tr.items(), key=str)))
