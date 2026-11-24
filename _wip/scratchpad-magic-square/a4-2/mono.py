import json, sys
WD = sys.argv[1]
def load(name):
    return {x["id"]: x for x in map(json.loads, open(f"{WD}/var_{name}.jsonl"))}
base = load("base")
for name in sys.argv[2:]:
    v = load(name)
    up = []; lvup = []
    for i, b in base.items():
        if b["f"]["status"] != "solved": continue
        x = v[i]
        if x["f"]["status"] != "solved":
            up.append(i); continue
        if any(x["f"][k] > b["f"][k] for k in ("tier_max", "depth_max", "first_sweeps")) and b["f"]["tier_max"] >= 2:
            up.append(i)
        if b["level"] and x["level"] and x["level"] > b["level"]:
            lvup.append(i)
    print(name, "harder-somewhere", len(up), "level-up(in-range)", len(lvup), lvup[:6])
