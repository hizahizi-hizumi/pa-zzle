"""pre.jsonl のうち単独の部品まで一致した候補に、部品の2つ・3つの組み合わせ（AGREE_COMBOS）での一致を当てる（続きから）。
python3 -I agree_run.py pre.jsonl agree_out.jsonl JOBS
"""
import json
import multiprocessing as mp
import os
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m  # noqa: E402


def one(d):
    ag = m.agreement_combos(m.geo_of(d["n"]), d["givens"], d["raw_level"])
    return {"id": d["id"], "bad": ag["bad"], "checked": ag["checked"]}


if __name__ == "__main__":
    pre, outp, jobs = sys.argv[1], sys.argv[2], int(sys.argv[3])
    done = set()
    if os.path.exists(outp):
        for line in open(outp):
            done.add(json.loads(line)["id"])
    ds = [json.loads(line) for line in open(pre)]
    todo = [d for d in ds if d["pre_level"] is not None and d["id"] not in done]
    # 軽い盤面（4×4）から
    pr = []
    if os.path.exists("priority.txt"):
        pr = [x.strip() for x in open("priority.txt") if x.strip()]
    rank = {x: i for i, x in enumerate(pr)}
    todo.sort(key=lambda d: (0 if d["id"] in rank else 1, d["n"]))
    with mp.Pool(jobs) as pool, open(outp, "a") as fh:
        for r in pool.imap_unordered(one, todo, chunksize=1):
            fh.write(json.dumps(r) + "\n")
            fh.flush()
