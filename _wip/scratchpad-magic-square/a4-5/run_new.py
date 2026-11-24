"""S1（単独の部品まで一致した候補）に新しい読み方を当て、レベルが変わる候補を書く。
python3 -I run_new.py pre.jsonl out.jsonl name1 name2 ...   （name は newread.kw_of の形。部品と NEW を + でつなげる）
"""
import json
import sys
import time

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-5")
import newread as nr  # noqa: E402

m = nr.m

if __name__ == "__main__":
    pre, outp = sys.argv[1], sys.argv[2]
    names = sys.argv[3:]
    ds = [json.loads(line) for line in open(pre)]
    ds = [d for d in ds if d["pre_level"] is not None]
    with open(outp, "a") as fh:
        for name in names:
            kw = nr.kw_of(name)
            t = time.time()
            moved = 0
            for d in ds:
                lv, why, f, res = nr.level_of(d["n"], d["givens"], kw, m.SIZES_V6)
                if lv != d["pre_level"]:
                    moved += 1
                    fh.write(json.dumps({"name": name, "id": d["id"], "n": d["n"], "base_level": d["pre_level"],
                                         "level": lv, "why": why,
                                         "f": {k: f[k] for k in ("entry", "first_tier", "first_sweeps", "tier_max",
                                                                  "d2max", "t3", "d3max", "first_hard", "status")},
                                         "steps": [(s["tier"], s["sweeps"], s["cells"]) for s in res["steps"]]},
                                        separators=(",", ":")) + "\n")
                    fh.flush()
            print(f"{name}: {moved}/{len(ds)} moved, {time.time() - t:.0f}s", flush=True)
