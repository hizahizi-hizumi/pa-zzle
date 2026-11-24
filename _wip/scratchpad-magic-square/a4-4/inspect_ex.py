"""1問を基準と変種で解いた手順を出す。python3 -I inspect_ex.py <id> '<json設定>'"""
import sys, json
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4")
import msd4 as p
W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
pid, kw = sys.argv[1], json.loads(sys.argv[2])
d = next(json.loads(x) for x in open(W + "/classified.jsonl") if json.loads(x)["id"] == pid)
n = d["features"]["n"]; geo = p.geo_of(n); g = d["givens"]; sol = d["solution"]
print(pid, "level", d["level"], "givens", g)
for r in range(n):
    print(" ".join(f"{g[r*n+c]:>2}" if g[r*n+c] else " ." for c in range(n)) + "    " + " ".join(f"{sol[r*n+c]:>2}" for c in range(n)))
for name, k in (("base", {}), ("var", kw)):
    res = p.read_solve(geo, g, **k)
    f = p.read_features(geo, g, res)
    if n == 4:
        f["_virtual"] = p.read_features(geo, g, p.read_solve(geo, g, extra_lines=p.VIRTUAL4, **k))
    print(name, p.single_level_v4(f, n, p.SIZES_C2, cap=None), {x: f[x] for x in ("entry", "first_tier", "first_sweeps", "d2max", "t3", "tier_max")})
    print("  ", " / ".join(f"t{s['tier']}x{s['sweeps']}:" + ",".join(f"({c//n},{c%n})={res['grid'][c] if res.get('grid') else '?'}" for c in s["cells"]) for s in res["steps"]))
