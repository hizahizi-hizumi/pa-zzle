import sys, json, itertools
from fractions import Fraction
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
ds = {json.loads(l)["id"]: json.loads(l) for l in open("pool.jsonl")}
geo = m.geo_of(4)
LINES = [(tuple(L), 34, nm) for L, nm in zip(geo.lines, geo.line_names)] + [(L, S, f"v{i}") for i, (L, S) in enumerate(m.VIRTUAL4)]

def det_with(grid, S):
    em = [c for c in range(16) if not grid[c]]
    rows = []
    for i in S:
        L, T, _ = LINES[i]
        r = [Fraction(1 if (c in L) else 0) for c in em] + [Fraction(T - sum(grid[c] for c in L))]
        rows.append(r)
    ne = len(em); piv = []; ri = 0
    for j in range(ne):
        sel = next((i for i in range(ri, len(rows)) if rows[i][j] != 0), None)
        if sel is None: continue
        rows[ri], rows[sel] = rows[sel], rows[ri]
        pv = rows[ri][j]; rows[ri] = [x / pv for x in rows[ri]]
        for i in range(len(rows)):
            if i != ri and rows[i][j] != 0:
                f = rows[i][j]; rows[i] = [a - f * b for a, b in zip(rows[i], rows[ri])]
        piv.append(j); ri += 1
    out = {}
    for i, j in enumerate(piv):
        if all(rows[i][k] == 0 for k in range(ne) if k != j): out[em[j]] = rows[i][-1]
    return out

for gid in sys.argv[2].split(","):
    d = ds[gid]; g = d["givens"]
    print(gid, "与える数"); [print("  ", " ".join(f"{g[r*4+c] or '.':>2}" for c in range(4))) for r in range(4)]
    singles = {c for L, T, nm in LINES if sum(1 for x in L if not g[x]) == 1 for c in L if not g[c]}
    print("  1マス空き（仮想の列を含む）のマス:", sorted(divmod(c, 4) for c in singles))
    done = set(singles)
    for k in range(2, 5):
        for S in itertools.combinations(range(len(LINES)), k):
            if any(sum(1 for x in LINES[i][0] if not g[x]) < 2 for i in S): continue
            for c, v in det_with(g, S).items():
                if c in done: continue
                done.add(c)
                print(f"  マス{divmod(c,4)}={v}（解 {d['solution'][c]}）: {k}本 {[LINES[i][2] for i in S]}  空き {[[divmod(x,4) for x in LINES[i][0] if not g[x]] for i in S]}")
