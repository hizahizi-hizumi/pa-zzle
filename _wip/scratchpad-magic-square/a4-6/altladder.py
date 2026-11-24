"""梯子の「深い」を帯と同じ「段3の所か段2で3巡以上」にしたとき（両側の余裕）、読み方で動く問題が残るかを数える。
4×4 の仮想の列は見ない（4×4 は動いていない）。python3 -I altladder.py 名前 ..."""
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


def alt(f, D2=3):
    if f["status"] != "solved":
        return "requires-trial"
    if f["tier_max"] >= 4:
        return "long-line"
    if f["tier_max"] == 1:
        return 1
    deep = f["d2max"] >= D2 or f["t3"] >= 1
    first_hard = f["first_tier"] >= 3 or (f["first_tier"] == 2 and f["first_sweeps"] >= D2)
    if f["entry"] >= 1:
        return "unlisted-combination" if deep else 2
    if not deep:
        return 3
    return 5 if first_hard else 4


names = sys.argv[1:]
res = collections.defaultdict(dict)
for p in glob.glob(f"{D}/res_*.jsonl"):
    for x in open(p):
        r = json.loads(x)
        if r["v"] in names:
            res[r["v"]][r["id"]] = r
for v in names:
    rs = res[v]
    bad = [i for i in base if i in rs and alt(rs[i]["f"]) != alt(sup[i]["features"] | {"status": "solved", "tier_max": sup[i]["features"]["tier_max"]})]
    chk = sum(1 for i in base if alt(sup[i]["features"] | {"status": "solved"}) != sup[i]["raw"])
    tr = collections.Counter((sup[i]["n"], sup[i]["raw"], alt(rs[i]["f"])) for i in bad)
    print(f"{v}: 両側の余裕の梯子で動く {len(bad)}/{len(base)}（基準の梯子と違う範囲内 {chk}）: " + ", ".join(f"{n}x{n} L{a}→{b} {k}" for (n, a, b), k in sorted(tr.items(), key=str)))
