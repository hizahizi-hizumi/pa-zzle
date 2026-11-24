"""変種ごとに全候補のレベルを測り、JSONL に書く。 使い方: run_variants.py <作業ディレクトリ> <変種名...>"""
import json
import multiprocessing as mp
import sys
import time

WD = sys.argv[1]
sys.path.insert(0, WD)
import rs2  # noqa: E402

VAR = {
    "base": {},
    "viol1": {"bounds": "viol", "bounds_tier": 1},
    "range1": {"bounds": "range", "bounds_tier": 1},
    "range2": {"bounds": "range", "bounds_tier": 2},
    "range2L": {"bounds": "range", "bounds_tier": 2, "bounds_long": True},
    "range1L": {"bounds": "range", "bounds_tier": 1, "bounds_long": True},
    "viol2": {"bounds": "viol", "bounds_tier": 2},
    "chain_nolock": {"chain_lock": False},
    "chain_dline": {"chain_distinct": "line"},
    "chain_paths": {"chain_mode": "paths"},
    "pointing": {"pointing": True},
    "lock_units": {"lock_scope": "units"},
    "lock_eph": {"lock_ephemeral": True},
    "nohidden": {"hidden": False},
    "hidden2": {"hidden_min_tier": 2},
    "nolock": {"lock_min_tier": 99},
    "big3": {"big3": True},
    "jchain3": {"joint_chain3": True},
    "short3_1": {"short3_sets": 1},
    "short3_2": {"short3_sets": 2},
    "carry": {"count": "carry"},
    "cum": {"count": "cum"},
    "combo4": {"combo_k": 4},
    "jointk2": {"jointk": 2},
    "jointk3": {"jointk": 3},
    "jointk4": {"jointk": 4},
    "jointk4d2": {"jointk": 4, "jointk_dof": 2},
    "jointk4d3": {"jointk": 4, "jointk_dof": 3},
    "jointk3d2": {"jointk": 3, "jointk_dof": 2},
}


def job(args):
    name, d = args
    kw = VAR[name]
    t = time.time()
    try:
        lv, reason, f, r = rs2.level_of(d["features"]["n"], d["givens"], **kw)
        out = {"id": d["id"], "v": name, "level": lv, "reason": reason,
               "f": {k: f[k] for k in rs2.m.FEATURE_KEYS + ("start_one", "status")},
               "steps": [(s["tier"], s["sweeps"], s["found"]) for s in r["steps"]],
               "t": round(time.time() - t, 3)}
    except Exception as ex:  # noqa: BLE001
        out = {"id": d["id"], "v": name, "error": repr(ex)}
    return out


if __name__ == "__main__":
    ds = [json.loads(l) for l in open(f"{WD}/classified.jsonl")]
    names = sys.argv[2:]
    for name in names:
        t0 = time.time()
        with mp.Pool(4) as pool:
            res = pool.map(job, [(name, d) for d in ds], chunksize=4)
        with open(f"{WD}/var_{name}.jsonl", "w") as fh:
            for x in res:
                fh.write(json.dumps(x, separators=(",", ":")) + "\n")
        print(name, round(time.time() - t0, 1), "s", file=sys.stderr, flush=True)
