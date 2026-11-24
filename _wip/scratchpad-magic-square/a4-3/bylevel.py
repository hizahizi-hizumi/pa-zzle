import json, sys, collections
grp, names = sys.argv[1], sys.argv[2:]
cl = {d["id"]: d for d in map(json.loads, open("classified.jsonl")) if d["level"]}
res = {r["id"]: r["r"] for r in map(json.loads, open(f"res_{grp}.jsonl"))}
tot = collections.Counter((d["level"], d["features"]["n"], d["k"] == 12) for d in cl.values())
for nm in names:
    mv = collections.Counter()
    for i, r in res.items():
        d = cl[i]
        if r[nm][0] != d["level"]:
            mv[(d["level"], d["features"]["n"], d["k"] == 12)] += 1
    print(nm, " ".join(f"L{L}/{n}x{n}/{'k12' if p else 'k0-2'} {mv[(L,n,p)]}/{t}" for (L, n, p), t in sorted(tot.items()) if mv[(L,n,p)] or True))
