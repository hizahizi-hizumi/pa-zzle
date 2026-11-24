import sys, os
CODE = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード"
sys.path.insert(0, CODE)
sys.dont_write_bytecode = True
import magic_square_difficulty as m

def parse(txt):
    rows = [r for r in txt.strip("\n").split("\n") if r.strip()]
    giv, sol = [], []
    for r in rows:
        t = r.split()
        n = len(t) // 2
        for x in t[:n]:
            giv.append(0 if x == "." else int(x))
        for x in t[n:]:
            sol.append(int(x))
    return giv, sol

def feats(n, g, **kw):
    geo = m.geo_of(n)
    res = m.read_solve(geo, g, **kw)
    return m.read_features(geo, g, res), res

def level(n, g, **kw):
    f, res = feats(n, g, **kw)
    d = {"n": n, "var": {}}
    if n == 4:
        d["var"]["virtual"] = m.read_features(m.geo_of(4), g, m.read_solve(m.geo_of(4), g, extra_lines=m.VIRTUAL4))
    return m.prop_C2(f, d) if f["status"] == "solved" else None, f, res
