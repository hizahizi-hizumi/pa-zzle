"""入口を「最初の1回の見回しで置けたマス」で数える（置いたらすぐ盤面に入れて、見回しを続ける）。L1 の上限で割れるか。"""
import json, sys, random, collections
WD = sys.argv[1]
sys.path.insert(0, WD)
import rs2
m = rs2.m

def scan(geo, g, order):
    grid = list(g); placed = 0
    for li in order:
        L = geo.lines[li]
        em = [c for c in L if not grid[c]]
        if len(em) == 1:
            grid[em[0]] = geo.M - sum(grid[c] for c in L)
            placed += 1
    return placed

ds = [json.loads(l) for l in open(f"{WD}/classified.jsonl")]
geo = m.geo_of(4)
nat = list(range(len(geo.lines)))
rng = random.Random(0)
orders = [nat, nat[::-1]] + [rng.sample(nat, len(nat)) for _ in range(20)]
c = collections.Counter(); ex = []
for d in ds:
    f = d["features"]
    if f["n"] != 4 or f["tier_max"] != 1: continue
    if d["level"] != 1 and d["reason"] != "too-light": continue
    e = f["empties"]
    base_tl = 2 * f["entry"] > e
    tl = [2 * scan(geo, d["givens"], o) > e for o in orders]
    key = (d["level"], d["reason"], "nat" if tl[0] != base_tl else "-", "any" if any(t != base_tl for t in tl) else "-")
    c[key] += 1
    if tl[0] != base_tl and len(ex) < 3:
        ex.append((d["id"], d["givens"], f["entry"], scan(geo, d["givens"], nat), e))
for k, v in sorted(c.items(), key=str): print(k, v)
for x in ex: print(x)
