"""範囲内（superset のうち部品の組み合わせで一致したもの。agree6.jsonl）に絞って、読み方ごとに動いた問題を数える。
python3 -I report.py <組の名前> [--all] [--only 名前,名前]"""
import collections
import json
import sys

D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"


def inrange():
    sup = {}
    for x in open(f"{D}/superset.jsonl"):
        d = json.loads(x)
        if d["level"]:
            sup[d["id"]] = d
    ag = {}
    for x in open(f"{D}/agree6.jsonl"):
        r = json.loads(x)
        ag[r["id"]] = r
    return sup, ag


def main():
    setname = sys.argv[1]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    sup, ag = inrange()
    ok = {i for i, r in ag.items() if not r["bad"]}
    unknown = set(sup) - set(ag)
    tot = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in ok)
    print(f"範囲内（確かめ済み）{len(ok)}、未確認 {len(unknown)}: " + ", ".join(f"{n}x{n} L{L} {k}" for (n, L), k in sorted(tot.items())))
    by = collections.defaultdict(list)
    for x in open(f"{D}/res_{setname}.jsonl"):
        r = json.loads(x)
        if only and r["v"] not in only:
            continue
        by[r["v"]].append(r)
    for v, rs in by.items():
        mv = [r for r in rs if r["id"] in ok and r["lv"] != sup[r["id"]]["raw"]]
        mvu = [r for r in rs if r["id"] in unknown and r["lv"] != sup[r["id"]]["raw"]]
        if not mv and not mvu and "--all" not in sys.argv:
            continue
        per = collections.Counter(sup[r["id"]]["n"] for r in mv)
        nt = collections.Counter(sup[i]["n"] for i in ok)
        tr = collections.Counter((sup[r["id"]]["n"], sup[r["id"]]["raw"], r["lv"] or r["why"]) for r in mv)
        nb = sum(1 for r in mv if r["lv"] is not None)
        print(f"{v}: {len(mv)}/{len(ok)} ({len(mv) / max(len(ok), 1):.1%})、隣のレベルへ {nb}、未確認で動いた {len(mvu)} | "
              + " ".join(f"{n}x{n} {per[n]}/{nt[n]}" for n in (4, 5, 6))
              + " | " + ", ".join(f"{n}x{n} L{a}→{b} {k}" for (n, a, b), k in sorted(tr.items(), key=str)))


if __name__ == "__main__":
    main()
