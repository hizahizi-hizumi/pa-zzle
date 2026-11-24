import json, collections, sys
cl = {d["id"]: d for d in map(json.loads, open("classified.jsonl")) if d["level"]}
for grp in ("pairs", "triples", "sw"):
    res = {r["id"]: r["r"] for r in map(json.loads, open(f"res_{grp}.jsonl"))}
    union = set(); unionA = set(); tr = collections.Counter(); why = collections.Counter(); nsets = 0
    for i, r in res.items():
        d = cl[i]
        for nm, x in r.items():
            art = "lock_eph" in nm and ("lock_next" in nm or nm.startswith("weak"))
            if x[0] != d["level"]:
                union.add(i)
                if not art:
                    unionA.add(i); tr[(d["level"], x[0] or x[1])] += 0
                    why[x[1] if x[0] is None else f"L{x[0]}"] += 1
                    if x[1] == "too-deep":
                        why["  (d2>4)" if x[5] > 4 else "  (d3>4)"] += 1
    byL = collections.Counter(cl[i]["level"] for i in unionA)
    byN = collections.Counter(cl[i]["features"]["n"] for i in unionA)
    print(grp, "moved by any:", len(union), "excluding lock_eph×lock_next artifact:", len(unionA), dict(byL), dict(byN), "kinds:", dict(why))
