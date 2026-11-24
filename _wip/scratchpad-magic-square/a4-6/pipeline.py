"""corpus -> agree -> classify を 2 プロセスで回す（調査コードは書き換えない）。"""
import json
import os
import sys
import time

CODE = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード"
OUT = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"
sys.path.insert(0, CODE)
import magic_square_difficulty as m  # noqa: E402

JOBS = int(os.environ.get("JOBS", "2"))
SPECS = [
    ("h4", [4], [1, 2, 3], [0, 1, 2], 60),
    ("h5", [5], [1, 2, 3], [0, 1, 2], 60),
    ("r5", [5], [2, 3], [12, 13], 120),
    ("h6", [6], [1, 2, 3], [0, 1, 2], 40),
    ("r6", [6], [2, 3], [12, 13], 80),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    stage = sys.argv[1]
    files = [f"{OUT}/{s[0]}.jsonl" for s in SPECS]
    if stage == "corpus":
        for name, sizes, tiers, ab, per in SPECS:
            args = ["corpus", "--sizes", *map(str, sizes), "--tiers", *map(str, tiers), "--addback", *map(str, ab),
                    "--per", str(per), "--out", f"{OUT}/{name}.jsonl", "--jobs", str(JOBS), "--resume"]
            t = time.time()
            m.main(args)
            print(name, "done", round(time.time() - t), flush=True)
    elif stage == "agree":
        cache = f"{OUT}/agree.jsonl"
        m.load_agree_cache(cache)
        ds = m.load(files)
        left = [d for d in ds if m._cache_key(d) not in m._AGREE_CACHE]
        print("left", len(left), flush=True)
        step = 200
        for i in range(0, len(left), step):
            t = time.time()
            m.refresh_features(left[i:i + step], jobs=JOBS)
            print(i + step, round(time.time() - t), flush=True)
    elif stage == "classify":
        cache = f"{OUT}/agree.jsonl"
        m.load_agree_cache(cache)
        ds = m.load(files)
        m.refresh_features(ds, jobs=JOBS)
        P = m.PROPOSALS["C2"]
        with open(f"{OUT}/classified.jsonl", "w") as fh:
            for d in ds:
                f = d["base"]
                lv, reason = m.level_and_reason(P, f, d)
                keep = {k: f[k] for k in m.FEATURE_KEYS}
                fh.write(json.dumps({"id": d["id"], "seed": d["seed"], "T": d["T"], "k": d["k"], "level": lv,
                                     "reason": reason, "agree_bad": (d.get("agree") or {}).get("bad", []),
                                     "features": keep, "trace": f.get("trace"),
                                     "givens": d["givens"], "solution": d["solution"]},
                                    separators=(",", ":")) + "\n")
        print("classified", len(ds), flush=True)


if __name__ == "__main__":
    main()
