"""範囲内（単独の部品と組み合わせで一致）の問題に絞って、読み方ごとのレベルの動きを数える。
python3 -I analyze.py new*.jsonl
"""
import collections
import json
import sys

A = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-5/"
pre = {}
for line in open(A + "pre.jsonl"):
    d = json.loads(line)
    pre[d["id"]] = d
ag = {}
for line in open(A + "agree_out.jsonl"):
    x = json.loads(line)
    ag[x["id"]] = x
s1 = [d for d in pre.values() if d["pre_level"] is not None]
done = [d for d in s1 if d["id"] in ag]
inr = {d["id"] for d in done if not ag[d["id"]]["bad"]}
pending = {d["id"] for d in s1 if d["id"] not in ag}
tot = collections.Counter((pre[i]["n"], pre[i]["pre_level"]) for i in inr)
print(f"範囲内 {len(inr)}（組み合わせを確かめた {len(done)} / {len(s1)}、未確認 {len(pending)}）", dict(sorted(tot.items())))
rs = []
for p in sys.argv[1:]:
    for line in open(p):
        rs.append(json.loads(line))
names = list(dict.fromkeys(r["name"] for r in rs))
for name in names:
    mv = [r for r in rs if r["name"] == name and r["id"] in inr]
    pend = [r for r in rs if r["name"] == name and r["id"] in pending]
    tr = collections.Counter((r["n"], r["base_level"], r["level"] if r["level"] else r["why"]) for r in mv)
    byn = collections.Counter(r["n"] for r in mv)
    totn = collections.Counter(pre[i]["n"] for i in inr)
    pct = " ".join(f"{n}×{n} {byn[n]}/{totn[n]}" for n in sorted(totn))
    print(f"{name:26s} 範囲内で動く {len(mv):3d}/{len(inr)} ({100 * len(mv) / max(len(inr), 1):.1f}%)  {pct}  未確認 {len(pend)}")
    for k, v in sorted(tr.items(), key=lambda kv: (kv[0][0], kv[0][1], str(kv[0][2]))):
        print(f"      {k[0]}×{k[0]} L{k[1]} -> {k[2]}: {v}（L{k[1]} の {100 * v / tot[(k[0], k[1])]:.1f}%）")
