"""両側の余裕の梯子（深い = 段3の所か段2で3巡以上）にしたとき、範囲内の問題が 34 の部品で基準と違うレベルになるかを数える
（梯子を替えると一致の決まりも替わるので、その代わりに失う問題の数の目安）。帯も1つ上げた案（L4: 段3か段2で4巡以上、
L5: 最初の所が段3で2巡以上か段2で4巡以上）で基準が帯に入るかも数える。"""
import collections, json, multiprocessing as mp, sys
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp
from altladder import alt, base, sup
m = exp.m


def one(i):
    d = sup[i]
    geo = m.geo_of(d["n"])
    out = []
    for v in m.AGREE:
        f = m.read_features(geo, d["givens"], m.read_solve(geo, d["givens"], **m.VARIANTS[v]))
        if alt(f) != d["raw"]:
            out.append(v)
    return i, out


if __name__ == "__main__":
    ids = sorted(i for i in base if sup[i]["n"] > 4)
    with mp.Pool(int(sys.argv[1])) as pool:
        res = dict(pool.map(one, ids, chunksize=4))
    bad = {i: v for i, v in res.items() if v}
    c = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in bad)
    t = collections.Counter((sup[i]["n"], sup[i]["level"]) for i in ids)
    print(f"部品で両側の余裕の梯子のレベルが違う {len(bad)}/{len(ids)}: " + ", ".join(f"{n}x{n} L{L} {c[(n, L)]}/{k}" for (n, L), k in sorted(t.items())))
    print(collections.Counter(v for vs in bad.values() for v in vs).most_common(10))
    f = lambda i: sup[i]["features"]
    band4 = sum(1 for i in ids if sup[i]["level"] == 4 and (f(i)["t3"] >= 1 or f(i)["d2max"] >= 4))
    band5 = sum(1 for i in ids if sup[i]["level"] == 5 and ((f(i)["first_tier"] == 3 and f(i)["first_sweeps"] >= 2) or (f(i)["first_tier"] == 2 and f(i)["first_sweeps"] >= 4)))
    print("帯を1つ上げても入る: L4", band4, "/", sum(1 for i in ids if sup[i]["level"] == 4), " L5", band5, "/", sum(1 for i in ids if sup[i]["level"] == 5))
