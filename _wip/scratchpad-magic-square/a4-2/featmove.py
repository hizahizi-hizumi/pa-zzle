import json, sys, collections
WD = sys.argv[1]
def load(name):
    return {x["id"]: x for x in map(json.loads, open(f"{WD}/var_{name}.jsonl"))}
base = load("base")
inr = [i for i, x in base.items() if x["level"]]
lvc = collections.Counter(base[i]["level"] for i in inr)
for name in sys.argv[2:]:
    v = load(name)
    out = {}
    for k in ("entry", "first_sweeps", "depth_max", "t3", "tier_max"):
        c = collections.Counter()
        for i in inr:
            a = base[i]["f"][k]; b = v[i]["f"][k]
            if k == "entry": a, b = min(a, 1), min(b, 1)
            if k == "t3": a, b = min(a, 1), min(b, 1)
            if a != b: c[(a, b)] += 1
        out[k] = dict(sorted(c.items(), key=lambda kv: -kv[1])[:5])
    per = collections.Counter(base[i]["level"] for i in inr if v[i]["level"] != base[i]["level"])
    print(name, {L: f"{per[L]}/{lvc[L]}" for L in sorted(lvc)})
    for k, c in out.items():
        if c: print("    ", k, c)
