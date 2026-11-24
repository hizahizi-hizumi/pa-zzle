"""基準で2巡以上かかった段の状態で、変種の読みが1巡目に何を決めるかを示す。"""
import sys, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
from examples import EXAMPLES
from explain_first import name_unit

FN = {"diff2u2": functools.partial(G.combo_units, k=2, max_unknowns=2),
      "joint2": functools.partial(G.joint_units, max_union=3),
      "chain2": G.chain_units,
      "tri3c1": functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=1)}

def show(nm, var):
    g, sol = EXAMPLES[nm]; n = int(len(g) ** 0.5); geo = m.geo_of(n)
    res = m.read_solve(geo, g)
    grid = list(g)
    for st in res["steps"]:
        if st["tier"] >= 2 and st["sweeps"] >= 2:
            used = 0
            for v in grid:
                if v: used |= 1 << v
            unused = geo.full & ~used
            empties = [c for c in range(geo.N) if not grid[c]]
            units = FN[var](geo, grid)
            cand = {c: unused for c in empties}
            r = G._run_tier(geo, grid, units, empties, unused, cand, 1)
            r = G._run_tier(geo, grid, units, empties, unused, r[5], st["tier"])
            print(f"{nm}: 基準は段{st['tier']}で{st['sweeps']}巡、置くマス {[divmod(c,n) for c in st['cells']]}。{var} では {r[1]}巡、置くマス {[divmod(c,n) for c in r[0]]}")
            if r[1] == 1:
                for c in r[0]:
                    for u in units:
                        if c not in u["cells"] or u["key"][0] == "L": continue
                        sup, req, ns, _ = G.enum_unit(u["cons"], u["cells"], cand, geo.N)
                        mk = sup[u["cells"].index(c)]
                        if mk != unused:
                            cons = [(tuple(divmod(x, n) for x in cc), co, rr) for cc, co, rr in u["cons"]]
                            print("    マス", divmod(c, n), "=", sol[c], "←", name_unit(geo, u), sorted(m.bits(mk)), "式", cons)
        for c in st["cells"]:
            grid[c] = sol[c]

for a in sys.argv[3].split(","):
    show(a, sys.argv[2])
