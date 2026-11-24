"""延ばした鎖（tchain）の単位を、所ごとに盤面とともに見せる。python3 -I trace_tchain.py <id> ...（pre.jsonl から引く）"""
import json
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-5")
import newread as nr  # noqa: E402

m = nr.m
pre = {}
for line in open("/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-5/pre.jsonl"):
    d = json.loads(line)
    pre[d["id"]] = d


def show(geo, grid):
    n = geo.n
    for r in range(n):
        print("   " + " ".join(f"{grid[r * n + c]:2d}" if grid[r * n + c] else " ." for c in range(n)))


def rc(geo, c):
    return f"({c // geo.n},{c % geo.n})"


for pid in sys.argv[1:]:
    d = pre[pid]
    n, g = d["n"], d["givens"]
    geo = m.geo_of(n)
    print(f"== {pid} level {d['pre_level']}")
    show(geo, g)
    print("base", d["steps"])
    kw = nr.kw_of("tchain3")
    res = nr.read_solve_x(geo, g, **kw)
    print("tchain3", [(s["tier"], s["sweeps"], s["cells"]) for s in res["steps"]])
    # 最初に基準と分かれる所の直前の盤面で、延ばした鎖の単位を出す
    grid = list(g)
    for s_b, s_n in zip(d["steps"], res["steps"]):
        if (s_b[0], s_b[1], s_b[2]) != (s_n["tier"], s_n["sweeps"], s_n["cells"]):
            break
        for c in s_n["cells"]:
            grid[c] = d["solution"][c]
    print(" 分かれる所の盤面")
    show(geo, grid)
    opt = dict(m.DEFAULT_READ)
    opt.update(kw)
    lines = [(L, geo.M) for L in geo.lines]
    us = nr._build_units_x(geo, grid, opt, lines)
    unused = geo.full
    for v in grid:
        if v:
            unused &= ~(1 << v)
    for u in us:
        if u["key"][0] != "TK":
            continue
        cand = {c: unused for c in u["cells"]}
        sup, req, nsets, cnt = m.enumerate_eqs(u["cells"], u["eqs"], cand, geo.N, 10 ** 6)
        sing = {rc(geo, c): next(m.bits(s)) for c, s in zip(u["cells"], sup) if s and s & (s - 1) == 0}
        print("  延ばした鎖:", [(" ".join(rc(geo, c) for c in cc), r) for cc, co, r in u["eqs"]],
              "入れ方", cnt, "決まるマス", sing)
