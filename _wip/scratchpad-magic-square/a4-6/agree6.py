"""superset の候補に、部品の2つ・3つの組み合わせ（AGREE_COMBOS）での一致を確かめ、data/agree6.jsonl に書く（続きから）。
python3 -I agree6.py [jobs] [--first id,id,...]（先に確かめる候補）"""
import json
import multiprocessing as mp
import os
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp  # noqa: E402

m = exp.m
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"


def one(d):
    ag = m.agreement_combos(m.geo_of(d["n"]), d["givens"], d["raw"])
    return {"id": d["id"], "bad": ag["bad"], "checked": ag["checked"]}


def main():
    jobs = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    first = []
    if "--first" in sys.argv:
        first = sys.argv[sys.argv.index("--first") + 1].split(",")
    rows = [json.loads(x) for x in open(f"{D}/superset.jsonl") if '"level":null' not in x]
    path = f"{D}/agree6.jsonl"
    done = set()
    if os.path.exists(path):
        done = {json.loads(x)["id"] for x in open(path)}
    rows = [d for d in rows if d["id"] not in done]
    if "--only" in sys.argv:
        keepl = open(sys.argv[sys.argv.index("--only") + 1]).read().split(",")
        pos = {k: i for i, k in enumerate(keepl)}
        rows = sorted([d for d in rows if d["id"] in pos], key=lambda d: pos[d["id"]])
    if first:
        rows.sort(key=lambda d: (d["id"] not in first,))
    with mp.Pool(jobs) as pool, open(path, "a") as fh:
        for r in pool.imap_unordered(one, rows, chunksize=1):
            fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            fh.flush()


if __name__ == "__main__":
    main()
