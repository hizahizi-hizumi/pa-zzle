import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
cl = {d["id"]: d for d in map(json.loads, open(os.path.join(xlib.HERE, "classified.jsonl")))}
IDS = ["ms4-T1-k0-0", "ms4-T2-k0-41", "ms5-T2-k1-1", "ms5-T2-k0-51", "ms6-T2-k12-26", "ms5-T2-k12-33", "ms5-T2-k12-41",
       "ms6-T3-k12-64", "ms5-T3-k12-13", "ms5-T3-k12-114", "ms6-T3-k12-25"]
S = {"memo<=4": {"memo_max": 4}, "memo<=5": {"memo_max": 5}, "memo<=6": {"memo_max": 6}, "memo<=8": {"memo_max": 8},
     "cum+short3_2": {**m.VARIANTS["cum"], **m.VARIANTS["short3_2"]},
     "cum+range2+short3_2": {**m.VARIANTS["cum"], **m.VARIANTS["range2"], **m.VARIANTS["short3_2"]},
     "chain>=4@t3": {"chain_tier3_from": 4}, "chain@t3": {"chain_tier3_from": 2}, "diag_nochain": {"diag_mode": "nochain"},
     "jk2@t2": {"jointk": 2, "jointk_tier": 2}}
for i in IDS:
    d = cl[i]; n = d["features"]["n"]
    row = []
    for k, kw in S.items():
        lv, why, f = xlib.level_of(n, d["givens"], kw)
        if lv != d["level"]:
            row.append(f"{k}→{lv or why}")
    print(i, f"L{d['level']}", ", ".join(row) or "動かない")
