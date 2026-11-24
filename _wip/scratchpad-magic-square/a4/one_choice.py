"""段2以上で決まったマスを1つずつ置く（どれを置くかは全部試す）ときの、組の突き合わせの回数の最小・最大。"""
import sys, json, collections
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G

def closure1(geo, grid):
    """段1だけで置けるだけ置く。"""
    grid = list(grid)
    while True:
        used = 0
        for v in grid:
            if v: used |= 1 << v
        unused = geo.full & ~used
        empties = [c for c in range(geo.N) if not grid[c]]
        if not empties: return grid
        units = G.base_units(geo, grid)
        pl = G._run_tier(geo, grid, units, empties, unused, {c: unused for c in empties}, 1)[0]
        if not pl: return grid
        for c, v in pl.items(): grid[c] = v

def hard_step(geo, grid):
    used = 0
    for v in grid:
        if v: used |= 1 << v
    unused = geo.full & ~used
    empties = [c for c in range(geo.N) if not grid[c]]
    units = G.base_units(geo, grid)
    cand = {c: unused for c in empties}
    for t in (2, 3):
        r = G._run_tier(geo, grid, units, empties, unused, cand, t)
        if r[0]: return t, r[1], r[0]
        cand = r[5]
    return None

def explore(geo, g, cap=20000):
    memo = {}
    cnt = [0]
    def rec(grid):
        grid = closure1(geo, grid)
        if all(grid): return (0, 0)
        key = tuple(grid)
        if key in memo: return memo[key]
        cnt[0] += 1
        if cnt[0] > cap: raise RuntimeError("cap")
        hs = hard_step(geo, grid)
        if hs is None:
            memo[key] = (99, 99); return memo[key]
        t, sw, pl = hs
        lo, hi = 99, -1
        for c, v in pl.items():
            ng = list(grid); ng[c] = v
            a, b = rec(ng)
            lo = min(lo, a + 1); hi = max(hi, b + 1)
        memo[key] = (lo, hi)
        return memo[key]
    return rec(list(g))

if __name__ == "__main__":
    ds = [json.loads(l) for l in open("pool.jsonl")]
    stats = collections.Counter(); tot = collections.Counter(); ex = {}
    for d in ds:
        if d["level"] not in (2, 3): continue
        geo = m.geo_of(d["n"])
        f = m.read_features(geo, d["givens"], m.read_solve(geo, d["givens"]))
        try:
            lo, hi = explore(geo, d["givens"])
        except RuntimeError:
            stats[(d["level"], "cap")] += 1; continue
        tot[d["level"]] += 1
        # L2: hard<=2、L3: hard>=3（入口0は L3 のまま）
        so = f["start_one"]
        def lv(h):
            if so >= 1 and h <= 2: return 2
            return 3
        a, b = lv(lo), lv(hi)
        stats[(d["level"], f"base{f['hard']}->min{lo}/max{hi}")] += 1
        if a != d["level"]: stats[(d["level"], "min変わる")] += 1
        if b != d["level"]: stats[(d["level"], "max変わる")] += 1; ex.setdefault(d["level"], []).append((d["id"], f["hard"], lo, hi))
    print("件数", dict(tot))
    for k, v in sorted(stats.items(), key=str): print(k, v)
    for L, xs in ex.items(): print(L, xs[:8])
