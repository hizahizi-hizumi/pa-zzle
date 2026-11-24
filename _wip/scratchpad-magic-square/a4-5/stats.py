"""読み方ごとに、範囲内（組み合わせまで一致を確かめた）で動いた問題を数える。分母は入力の範囲内 866 問。
python3 -I stats.py name1 name2 ...（new*.jsonl から）
"""
import collections
import json
import sys

A = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-5/"
DEN = {(4, 1): 68, (4, 2): 26, (5, 2): 98, (5, 3): 192, (5, 4): 115, (5, 5): 108, (6, 3): 119, (6, 4): 76, (6, 5): 64}
pre = {json.loads(line)["id"]: json.loads(line) for line in open(A + "pre.jsonl")}
ag = {json.loads(line)["id"]: json.loads(line) for line in open(A + "agree_out.jsonl")}
rs = [json.loads(line) for f in ("new1.jsonl", "new2.jsonl", "new3.jsonl", "new4.jsonl") for line in open(A + f)]
denn = collections.Counter()
for (n, lv), v in DEN.items():
    denn[n] += v
for name in sys.argv[1:]:
    mv = [r for r in rs if r["name"] == name]
    unk = [r for r in mv if r["id"] not in ag]
    mv = [r for r in mv if r["id"] in ag and not ag[r["id"]]["bad"]]
    byn = collections.Counter(r["n"] for r in mv)
    tr = collections.Counter((r["n"], r["base_level"], r["level"] if r["level"] else r["why"]) for r in mv)
    print(f"{name}: {len(mv)}/866 ({100 * len(mv) / 866:.1f}%)  "
          + "  ".join(f"{n}×{n} {byn[n]}/{denn[n]} ({100 * byn[n] / denn[n]:.1f}%)" for n in (4, 5, 6))
          + (f"  組み合わせ未確認 {len(unk)}" if unk else ""))
    for k, v in sorted(tr.items(), key=lambda kv: (kv[0][0], kv[0][1], str(kv[0][2]))):
        print(f"    {k[0]}×{k[0]} L{k[1]} → {k[2]}: {v}/{DEN[(k[0], k[1])]} ({100 * v / DEN[(k[0], k[1])]:.1f}%)")
