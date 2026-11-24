import sys, json, collections, functools, itertools
sys.path.insert(0, sys.argv[1])
from common import *
import gread as G
ds = [json.loads(l) for l in open("pool.jsonl")]

# 1. 4×4 L2 と L1 で、全部の一次結合（lin）と仮想の列を足したときの段
print("== 4×4: 仮想の列4本だけ / 一次結合を全部 のときの段（_virtual_ok と同じ扱い）")
def vunits(geo, grid):
    return G.base_units(geo, grid, extra_lines=m.VIRTUAL4)
def vlin(geo, grid):
    out = vunits(geo, grid)
    one = {u["cells"][0] for u in out if u["tier"] == 1}
    for c, v in G.lin_determined(geo, grid).items():
        if c in one or v.denominator != 1: continue
        out.append({"cons": [((c,), (1,), int(v))], "cells": [c], "tier": 1, "key": ("LIN", c)})
    return out
cnt = collections.Counter(); ex = []
for d in ds:
    if d["n"] != 4 or d["level"] is None: continue
    geo = m.geo_of(4)
    fv = m.read_features(geo, d["givens"], G.gsolve(geo, d["givens"], units_fn=vlin, max_tier=3))
    vl = m.reading_level(fv) if fv["status"] == "solved" else None
    if vl is None and fv["status"] == "solved" and m.out_of_range_reason(fv) == "too-light": vl = 1
    ok = vl is None or vl >= d["level"]
    cnt[(d["level"], ok)] += 1
    if not ok: ex.append((d["id"], d["level"], vl, fv["start_one"]))
print(cnt, ex[:10])

# 2. L5 で、最初から（盤面のまま）1マスだけ残る、列2〜4本の ±1 の式があるか
print("== L5・L4 の入口0の問題で、最初から1マスだけ残る列をまたぐ式（列の空き2以上、±1、k本）")
for k in (2, 3, 4):
    c5 = collections.Counter(); exs = []
    for d in ds:
        if d["level"] not in (3, 4, 5): continue
        geo = m.geo_of(d["n"])
        f = m.read_features(geo, d["givens"], m.read_solve(geo, d["givens"]))
        if f["start_one"] != 0: continue
        us = G.combo_units(geo, d["givens"], k=k, max_unknowns=1, max_coef=2, include_base=False)
        us = [u for u in us if u["tier"] == 1]
        c5[(d["level"], bool(us))] += 1
        if us and len(exs) < 4: exs.append((d["id"], d["level"], [(u["key"][1], u["key"][2]) for u in us][:2]))
    print(" k<=", k, dict(c5), exs)

# 3. L1 の入口を列でなくマスで数えたとき
print("== 最初の1マス空きの列を、列の本数でなくマスの数で数えたとき（4×4 の段1）")
cc = collections.Counter()
for d in ds:
    if d["n"] != 4: continue
    geo = m.geo_of(4)
    f = m.read_features(geo, d["givens"], m.read_solve(geo, d["givens"]))
    if f["status"] != "solved" or f["tier_max"] != 1: continue
    cells = {next(c for c in L if not d["givens"][c]) for L in geo.lines if sum(1 for c in L if not d["givens"][c]) == 1}
    a = f["start_one"] <= m.L1_ENTRY_CAP; b = len(cells) <= m.L1_ENTRY_CAP
    cc[(a, b)] += 1
print(" (列で L1, マスで L1):", dict(cc))
