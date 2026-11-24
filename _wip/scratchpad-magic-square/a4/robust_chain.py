"""鎖の読み（chain2）を基準にしたとき、差・2本一緒・3本の式を足しても段が動くか。"""
import sys, json, collections, functools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G

def both(geo, grid):
    a = G.chain_units(geo, grid)
    keys = {u["key"] for u in a}
    for u in G.combo_units(geo, grid, k=3, max_unknowns=3, max_coef=1, include_base=False):
        a.append(u)
    for u in G.joint_units(geo, grid, max_union=3, include_base=False):
        a.append(u)
    return a

def job(d):
    geo = m.geo_of(d["n"]); g = d["givens"]
    f1 = m.read_features(geo, g, G.gsolve(geo, g, units_fn=G.chain_units, max_tier=3))
    f2 = m.read_features(geo, g, G.gsolve(geo, g, units_fn=both, max_tier=3))
    r1 = G.gsolve_policy(geo, g, policy="fresh3", units_fn=G.chain_units)
    f3 = m.read_features(geo, g, r1)
    return d["id"], d["n"], d["level"], G.lvl_of(f1, d["n"]), G.lvl_of(f2, d["n"]), G.lvl_of(f3, d["n"])

if __name__ == "__main__":
    import multiprocessing as mp
    ds = [json.loads(l) for l in open("pool.jsonl")]
    with mp.Pool(4) as p:
        out = p.map(job, ds, chunksize=4)
    c = collections.Counter(); dist = collections.Counter(); dist0 = collections.Counter(); c3 = collections.Counter()
    for i, n, L0, L1, L2, L3 in out:
        if L0 is None and L1 is None: continue
        dist0[L0] += 1; dist[L1] += 1
        if L1 is not None: c[(L1, L2)] += 1
        c3[(L1, L3)] += 1
    print("基準の段の分布", dict(dist0)); print("鎖を基準にした段の分布", dict(dist))
    print("鎖 → 鎖+3本の式+2本一緒（変わったもの）", {k: v for k, v in c.items() if k[0] != k[1]}, "変わらない", sum(v for k, v in c.items() if k[0] == k[1]))
    print("鎖 → 鎖で段3も盤面から数える（変わったもの）", {k: v for k, v in c3.items() if k[0] != k[1]})
