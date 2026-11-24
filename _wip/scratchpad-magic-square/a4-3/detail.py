import json, sys, collections
grp, names = sys.argv[1], sys.argv[2:]
cl = {d["id"]: d for d in map(json.loads, open("classified.jsonl")) if d["level"]}
res = {r["id"]: r["r"] for r in map(json.loads, open(f"res_{grp}.jsonl"))}
for nm in names:
    print("==", nm)
    via = collections.Counter()
    for i, r in res.items():
        d = cl[i]; x = r[nm]
        if x[0] != d["level"]:
            f = d["features"]
            b = (f["entry"], f["first_tier"], f["first_sweeps"], f["d2max"], f["t3"], f["d3max"], f["tier_max"])
            v = tuple(x[2:])
            why = x[1]
            if why == "too-deep":
                why += "(d2)" if x[5] > 4 else "(d3)"
            via[(d["level"], x[0] or why)] += 1
            if len(sys.argv) > 0 and via[(d["level"], x[0] or why)] <= 2:
                print(f"  {i} L{d['level']} -> {x[0] or why}  base(entry,ft,fs,d2,t3,d3,tmax)={b} var={v}")
    print("  ", dict(via))
