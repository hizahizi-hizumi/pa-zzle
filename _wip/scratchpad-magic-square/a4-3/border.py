import json, sys, collections, glob, os
cl = {d["id"]: d for d in map(json.loads, open("classified.jsonl")) if d["level"]}
def cat(d):
    f = d["features"]; L = d["level"]; out = []
    if L == 4 and f["t3"] == 0 and f["d2max"] == 2: out.append("L4:d2=2,t3=0")
    if L == 4 and f["t3"] >= 1 and f["d2max"] <= 1: out.append("L4:t3only")
    if L == 5 and f["first_tier"] == 2 and f["first_sweeps"] == 2: out.append("L5:first=t2x2")
    if L == 5 and f["first_tier"] == 3: out.append("L5:first=t3")
    if L == 5 and f["t3"] == 0 and f["d2max"] == 3: out.append("L5:d2=3,t3=0")
    if L in (4, 5) and (f["d2max"] == 4 or f["d3max"] == 4): out.append("L4/5:cap=4")
    if L in (4, 5) and (f["d3max"] == 3): out.append("L4/5:d3=3")
    return out
cnt = collections.Counter(c for d in cl.values() for c in cat(d))
print("borderline counts:", dict(cnt))
moved = collections.defaultdict(collections.Counter)
for p in sorted(glob.glob("res_*.jsonl")):
    grp = os.path.basename(p)[4:-6]
    if grp == "selfcheck": continue
    for r in map(json.loads, open(p)):
        d = cl[r["id"]]
        for nm, x in r["r"].items():
            if x[0] != d["level"]:
                for c in cat(d) or ["(not border)"]:
                    moved[c][f"{grp}:{nm}"] += 1
for c in list(cnt) + ["(not border)"]:
    tot = cnt.get(c)
    print(f"== {c} ({tot})")
    for k, v in moved[c].most_common(12):
        print(f"   {k} {v}")
