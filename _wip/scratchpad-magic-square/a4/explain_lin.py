import sys, itertools
from fractions import Fraction
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
from examples import EXAMPLES

def solve_comb(geo, grid, S, x):
    """S の列の一次結合で、空きマスのうち x だけが残る係数を探す（有理数）。"""
    em = [c for c in range(geo.N) if not grid[c]]
    # 未知数: 係数 a_i (i in S)。式: 各空きマス c について Σ a_i [c in L_i] = [c==x]
    A = []
    for c in em:
        A.append([Fraction(1 if c in geo.lines[i] else 0) for i in S] + [Fraction(1 if c == x else 0)])
    # ガウス消去
    rows = [r[:] for r in A]; k = len(S); piv = []; ri = 0
    for j in range(k):
        sel = next((i for i in range(ri, len(rows)) if rows[i][j] != 0), None)
        if sel is None: continue
        rows[ri], rows[sel] = rows[sel], rows[ri]
        pv = rows[ri][j]; rows[ri] = [v / pv for v in rows[ri]]
        for i in range(len(rows)):
            if i != ri and rows[i][j] != 0:
                f = rows[i][j]; rows[i] = [a - f * b for a, b in zip(rows[i], rows[ri])]
        piv.append(j); ri += 1
    for r in rows[ri:]:
        if r[-1] != 0: return None
    a = [Fraction(0)] * k
    for i, j in enumerate(piv): a[j] = rows[i][-1]
    return a

def explain(name, g, maxk=6):
    n = int(len(g) ** 0.5); geo = m.geo_of(n)
    det = G.lin_determined(geo, g)
    one = {L[[g[c] for c in L].index(0)] for L in geo.lines if sum(1 for c in L if not g[c]) == 1}
    print(name, "線形に決まるマス:", {divmod(c, n): str(v) for c, v in det.items()}, "1マス空きの列のマス:", [divmod(c,n) for c in one])
    for x in det:
        if x in one: continue
        for k in range(1, maxk + 1):
            found = None
            for S in itertools.combinations(range(len(geo.lines)), k):
                a = solve_comb(geo, g, S, x)
                if a is not None:
                    found = (S, a); break
            if found:
                S, a = found
                terms = " ".join(f"{'+' if c > 0 else '-'}{abs(c) if abs(c)!=1 else ''}{geo.line_names[i]}" for i, c in zip(S, a) if c)
                empt = {geo.line_names[i]: [divmod(c, n) for c in geo.lines[i] if not g[c]] for i in S}
                print(f"   マス{divmod(x,n)}={det[x]}: {k}本 {terms}  各列の空き {empt}")
                break

for nm in sys.argv[2].split(","):
    explain(nm, EXAMPLES[nm][0])
