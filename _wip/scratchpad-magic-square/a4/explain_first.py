"""最初の段で、1巡目に候補を1つにした単位（列か、列をまたぐ式）を示す。"""
import sys, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
from examples import EXAMPLES

def name_unit(geo, u):
    k = u["key"]
    if k[0] == "L": return geo.line_names[k[1]]
    if k[0] == "C": return "".join(("+" if s > 0 else "-") + geo.line_names[i] for i, s in zip(k[1], k[2]))
    if k[0] == "J": return geo.line_names[k[1]] + "&" + geo.line_names[k[2]]
    return str(k)

def first_sweep_units(nm, units_fn, tier=None):
    g = EXAMPLES[nm][0]; n = int(len(g) ** 0.5); geo = m.geo_of(n)
    sol = EXAMPLES[nm][1]
    used = 0
    for v in g:
        if v: used |= 1 << v
    unused = geo.full & ~used
    empties = [c for c in range(geo.N) if not g[c]]
    cand = {c: unused for c in empties}
    units = units_fn(geo, g)
    for t in (1, 2, 3):
        new = dict(cand)
        hits = []
        for u in units:
            if u["tier"] > t: continue
            sup, req, ns, _ = G.enum_unit(u["cons"], u["cells"], cand, geo.N)
            for c, mk in zip(u["cells"], sup):
                new[c] &= mk
                if mk & (mk - 1) == 0 and mk:
                    hits.append((name_unit(geo, u), divmod(c, n), m.lowest(mk), u["cons"]))
            if t >= 2 and req:
                for c in empties:
                    if c not in u["cells"]: new[c] &= ~req
        single = {divmod(c, n): m.lowest(new[c]) for c in empties if new[c] & (new[c] - 1) == 0}
        if single or hits:
            print(nm, f"段{t} 1巡目で1つになるマス", single, "（解", {k: sol[k[0]*n+k[1]] for k in single}, ")")
            for h in hits[:6]:
                cons = [(tuple(divmod(c, n) for c in cc), co, r) for cc, co, r in h[3]]
                print("    ", h[0], "→ マス", h[1], "=", h[2], " 式", cons)
            for cell in single:
                c = cell[0] * n + cell[1]
                for u in units:
                    if u["tier"] > t or c not in u["cells"]: continue
                    sup, req, ns, _ = G.enum_unit(u["cons"], u["cells"], cand, geo.N)
                    mk = sup[u["cells"].index(c)]
                    if mk != unused:
                        cons = [(tuple(divmod(x, n) for x in cc), co, r) for cc, co, r in u["cons"]]
                        print("     マス", cell, "←", name_unit(geo, u), sorted(m.bits(mk)), "式", cons)
            return
    print(nm, "1巡目では決まらない")

which = sys.argv[2] if len(sys.argv) > 2 else "base"
fn = {"chain2": G.chain_units, "base": G.base_units, "tri3c1": functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=1),
      "diff2u2": functools.partial(G.combo_units, k=2, max_unknowns=2),
      "joint2": functools.partial(G.joint_units, max_union=3)}.get(which)
if __name__ == "__main__":
  for nm in sys.argv[3].split(","):
    first_sweep_units(nm, fn)
