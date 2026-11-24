"""読み方・数え方の変種ごとに、特徴と段（C2）がどう動くかを測る。"""
import sys, json, random, itertools, collections, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G

KEYS = ("start_one", "first_tier", "first_sweeps", "tier_max", "hard", "depth_max", "deep", "t3")


def short(f):
    return {k: f[k] for k in KEYS}


def run_variant(name, geo, g):
    n = geo.n
    if name == "seq_nat":
        res = G.gsolve(geo, g, sync=False, max_tier=3)
    elif name == "seq_rev":
        res = G.gsolve(geo, g, sync=False, order_key=lambda u: -u["key"][1], max_tier=3)
    elif name.startswith("seq_r"):
        seed = int(name[5:])
        rng = random.Random(seed)
        perm = list(range(2 * n + 2))
        rng.shuffle(perm)
        res = G.gsolve(geo, g, sync=False, order_key=lambda u: perm[u["key"][1]], max_tier=3)
    elif name == "one":
        res = G.gsolve(geo, g, batch=False, max_tier=3)
    elif name == "one_max":
        res = G.gsolve(geo, g, batch=False, choose=max, max_tier=3)
    elif name == "memory":
        res = G.gsolve(geo, g, memory=True, max_tier=3)
    elif name == "diff2":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=2, max_unknowns=3), max_tier=3)
    elif name == "diff2m":  # 差だけ（和は足さない）
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=2, max_unknowns=3, plus=False), max_tier=3)
    elif name == "tri3":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=2), max_tier=3)
    elif name == "joint2":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.joint_units, max_union=3, tier_of="max"), max_tier=3)
    elif name == "joint2u":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.joint_units, max_union=3, tier_of="union"), max_tier=3)
    elif name == "lin":
        res = G.gsolve(geo, g, units_fn=G.lin_units, max_tier=3)
    elif name == "tri3c1":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=3, max_unknowns=3, max_coef=1), max_tier=3)
    elif name == "diff2u2":  # 2本の差で、空きが2マス以下になる式だけ
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=2, max_unknowns=2), max_tier=3)
    elif name == "chain2":
        res = G.gsolve(geo, g, units_fn=G.chain_units, max_tier=3)
    elif name in ("pol_base", "fresh3", "shortest"):
        res = G.gsolve_policy(geo, g, policy={"pol_base": "base"}.get(name, name))
    elif name == "combo4u2":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=4, max_unknowns=2, max_coef=1), max_tier=3)
    elif name == "combo3u2":
        res = G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=3, max_unknowns=2, max_coef=1), max_tier=3)
    elif name in ("pairs", "parity", "hall", "allglob"):
        rule = {"pairs": G.rule_pairs, "parity": G.rule_parity, "hall": G.rule_hall, "allglob": G.rule_all}[name]
        res = G.gsolve(geo, g, extra_rule=rule, max_tier=3)
    elif name in ("hidden_lag", "lock_lag"):
        flag = G.HIDDEN_LAG if name == "hidden_lag" else G.LOCK_LAG
        flag[0] = True
        try:
            res = G.gsolve_policy(geo, g, policy="base")
        finally:
            flag[0] = False
    elif name == "base3":
        res = G.gsolve(geo, g, max_tier=3)
    else:
        raise KeyError(name)
    return G.feats_of(geo, g, res)


def job(args):
    d, names = args
    n = d["n"]
    geo = m.geo_of(n)
    g = d["givens"]
    base = m.read_features(geo, g, m.read_solve(geo, g))
    out = {"id": d["id"], "n": n, "level": d["level"], "base": short(base) | {"status": base["status"]}, "var": {}}
    for nm in names:
        f = run_variant(nm, geo, g)
        out["var"][nm] = short(f) | {"status": f["status"], "level": G.lvl_of(f, n)}
    return out


if __name__ == "__main__":
    import multiprocessing as mp
    names = sys.argv[3].split(",")
    ds = [json.loads(l) for l in open("pool.jsonl")]
    with mp.Pool(4) as p, open(sys.argv[2], "w") as fh:
        for r in p.imap(job, [(d, names) for d in ds], chunksize=4):
            fh.write(json.dumps(r) + "\n")
