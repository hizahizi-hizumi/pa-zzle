"""1問の最初の行き詰まりを、基準と新しい読み方で見比べる。python3 -I trace.py <id>"""
import json, sys
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp
m = exp.m
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"
pid = sys.argv[1]
d = next(json.loads(x) for x in open(f"{D}/superset.jsonl") if json.loads(x)["id"] == pid)
n, g, sol = d["n"], d["givens"], d["solution"]
geo = m.geo_of(n)
print(pid, "n", n, "givens", g)
for r in range(n):
    print(" ".join(f"{g[r*n+c]:>2}" if g[r*n+c] else " ." for c in range(n)) + "    " + " ".join(f"{sol[r*n+c]:>2}" for c in range(n)))
used = 0
for v in g:
    if v: used |= 1 << v
unused = sorted(m.bits(geo.full & ~used))
print("unused", unused)
for li, em, r in m._line_states(geo, g, [(L, geo.M) for L in geo.lines]):
    if len(em) == 2:
        sup, req, ns, cnt = m.enumerate_line([geo.full & ~used] * 2, r, geo.N, 10**6)
        print(f"  2-line {geo.line_names[li]} cells {[(c//n, c%n) for c in em]} r={r} pairs={ns} cand={sorted(m.bits(sup[0]))}")
specs = [("base", {}), ("chain_late", m.VARIANTS["chain_late"]), ("cap2_4+chain_late", {"sets_cap": 4, "chain_late": True}),
         ("memo8s+chain_late", {"memo_max": 8, "x_memo_strict": 8, "chain_late": True}),
         ("memo4s+chain_late", {"memo_max": 4, "x_memo_strict": 4, "chain_late": True})] + [(a, json.loads(b)) for a, b in zip(sys.argv[2::2], sys.argv[3::2])]
for name, kw in specs:
    res = exp.read_solve_x(geo, g, **kw)
    f = m.read_features(geo, g, res)
    if n == 4:
        f["_virtual"] = m.read_features(geo, g, exp.read_solve_x(geo, g, extra_lines=m.VIRTUAL4, **kw))
    lv = m.single_level_v6(f, n, None, cap=None)
    print(f"{name}: level {lv}  steps " + " ".join(f"[段{s['tier']}・{s['sweeps']}巡 {[(c//n, c%n) for c in s['cells']]}]" for s in res["steps"][:3]))
