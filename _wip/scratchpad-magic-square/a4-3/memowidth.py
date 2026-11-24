"""L4・L5 の問題ごとに、行き詰まりの中の巡の間に覚えるメモの幅を K 個までにしても同じレベルになる最小の K。"""
import sys, os, collections, multiprocessing as mp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib
m = xlib.m
KS = list(range(1, 17))
def need(d):
    n = d["features"]["n"]
    out = None
    for K in reversed(KS):
        lv = xlib.level_of(n, d["givens"], {"memo_max": K})[0]
        if lv != d["level"]:
            return d["id"], d["level"], n, K + 1
    return d["id"], d["level"], n, KS[0]
if __name__ == "__main__":
    _, ins = xlib.load_inrange()
    sel = [d for d in ins if d["level"] in (4, 5)]
    with mp.Pool(4) as p:
        res = p.map(need, sel, chunksize=2)
    for L in (4, 5):
        for n in (5, 6):
            c = collections.Counter(k for i, l, nn, k in res if l == L and nn == n)
            print(f"L{L} {n}x{n}", dict(sorted(c.items())))
