"""読むモデルの写し（一般化）。読む単位を差し替えられるようにして、read_solve と同じ数え方で測る。

単位 = (式のリスト, 未知のマスの並び, 段)。式 = (マス, 係数, 右辺)。
基準の単位は「空きのある列」1本ずつ（係数は全部1、段は空きの数）。
"""
import itertools
import collections
import random
from common import m

bits, popcount, lowest = m.bits, m.popcount, m.lowest


def enum_unit(cons, cells, cand, N, cap=200000):
    """単位の解を全部数える。(台, 必ず使う数, 数の組の数, 解の数)。"""
    if len(cons) == 1 and all(a == 1 for a in cons[0][1]) and tuple(cons[0][0]) == tuple(cells):
        return m.enumerate_line([cand[c] for c in cells], cons[0][2], N, cap)
    e = len(cells)
    idx = {c: i for i, c in enumerate(cells)}
    cs = [([idx[c] for c in cc], co, r) for cc, co, r in cons]
    order = sorted(range(e), key=lambda i: popcount(cand[cells[i]]))
    pos = {i: k for k, i in enumerate(order)}
    # 式ごとに、最後に決まるマス（順で最も後）
    last = []
    for vs, co, r in cs:
        last.append(max(pos[v] for v in vs))
    by_last = {}
    for j, L in enumerate(last):
        by_last.setdefault(L, []).append(j)
    val = [0] * e
    sup = [0] * e
    sets = set()
    req = [-1]
    cnt = [0]
    nodes = [0]

    def rec(k, used):
        nodes[0] += 1
        if nodes[0] > cap:
            raise m.LineReadCap
        if k == e:
            s = 0
            for i in range(e):
                sup[i] |= 1 << val[i]
                s |= 1 << val[i]
            sets.add(s)
            req[0] &= s
            cnt[0] += 1
            return
        i = order[k]
        # この順で i が最後になる式があれば、その式から値を決める
        forced = None
        for j in by_last.get(k, []):
            vs, co, r = cs[j]
            acc = r
            ci = 0
            for v, c in zip(vs, co):
                if v == i:
                    ci += c
                else:
                    acc -= c * val[v]
            if ci == 0:
                continue
            if acc % ci:
                return
            x = acc // ci
            if forced is None:
                forced = x
            elif forced != x:
                return
        if forced is not None:
            opts = [forced] if 1 <= forced <= N and (cand[cells[i]] >> forced) & 1 and not (used >> forced) & 1 else []
        else:
            opts = list(bits(cand[cells[i]] & ~used))
        for x in opts:
            val[i] = x
            # この順で i が最後になる式で、係数が0だったものを確かめる
            ok = True
            for j in by_last.get(k, []):
                vs, co, r = cs[j]
                if sum(c * val[v] for v, c in zip(vs, co)) != r:
                    ok = False
                    break
            if ok:
                rec(k + 1, used | (1 << x))

    rec(0, 0)
    return sup, (req[0] if cnt[0] else 0), len(sets), cnt[0]


def base_units(geo, grid, extra_lines=None):
    out = []
    lines = [(L, geo.M) for L in geo.lines] + list(extra_lines or [])
    for li, (L, S) in enumerate(lines):
        s = 0
        empt = []
        for c in L:
            if grid[c]:
                s += grid[c]
            else:
                empt.append(c)
        if empt:
            out.append({"cons": [(tuple(empt), (1,) * len(empt), S - s)], "cells": empt, "tier": len(empt),
                        "key": ("L", li)})
    return out


def gsolve(geo, givens, units_fn=base_units, max_tier=4, memory=False, sync=True, order_key=None,
           batch=True, choose=None, hidden_min_tier=1, lock_min_tier=2, enum_cap=200000, extra_rule=None,
           tier_mode="lowest"):
    """read_solve と同じ骨組み。units_fn(geo, grid) が読む単位を返す。
    order_key: sync=False のとき単位を読む順のキー。choose: batch=False のとき置くマスを選ぶ関数。
    extra_rule(geo, new, empties, unused, tier) -> bool(変わったか): 段の中の追加の読み。
    tier_mode: "lowest"（基準）"""
    N = geo.N
    grid = list(givens)
    used = 0
    for v in grid:
        if v:
            used |= 1 << v
    unused = geo.full & ~used
    steps = []
    cand = None
    units0 = units_fn(geo, grid)
    start_one = sum(1 for u in units0 if u["tier"] == 1)
    status = "solved"
    while True:
        empties = [c for c in range(N) if not grid[c]]
        if not empties:
            break
        if cand is None or not memory:
            cand = {c: unused for c in empties}
        else:
            cand = {c: cand[c] & unused for c in empties}
        units = units_fn(geo, grid)
        if order_key is not None:
            units = sorted(units, key=order_key)
        progressed = False
        for tier in range(1, max_tier + 1):
            sweeps = 0
            lock_changed = False
            combos_first = []
            while True:
                sweeps += 1
                new = dict(cand)
                src = cand if sync else new
                lock_hit = False
                for u in units:
                    if u["tier"] > tier:
                        continue
                    try:
                        sup, req, nsets, _ = enum_unit(u["cons"], u["cells"], src, N, enum_cap)
                    except m.LineReadCap:
                        continue
                    if sweeps == 1 and tier >= 2 and len(u["cells"]) >= 2:
                        combos_first.append(nsets)
                    if nsets == 0:
                        return {"status": "contradiction", "steps": steps}
                    for c, mk in zip(u["cells"], sup):
                        new[c] &= mk
                    if tier >= lock_min_tier and req:
                        inL = set(u["cells"])
                        for c in empties:
                            if c not in inL:
                                nm = new[c] & ~req
                                if nm != new[c]:
                                    new[c] = nm
                                    lock_hit = True
                if extra_rule is not None and extra_rule(geo, new, empties, unused, tier):
                    lock_hit = True
                if lock_hit:
                    lock_changed = True
                placements = {}
                kinds = set()
                for c in empties:
                    mk = new[c]
                    if mk == 0:
                        return {"status": "contradiction", "steps": steps}
                    if mk & (mk - 1) == 0:
                        placements[c] = lowest(mk)
                        kinds.add("one" if tier == 1 else "cross")
                if tier >= hidden_min_tier:
                    for v in bits(unused):
                        where = [c for c in empties if (new[c] >> v) & 1]
                        if not where:
                            return {"status": "contradiction", "steps": steps}
                        if len(where) == 1:
                            c = where[0]
                            if c in placements and placements[c] != v:
                                return {"status": "contradiction", "steps": steps}
                            if c not in placements:
                                kinds.add("hidden")
                            placements[c] = v
                if len(set(placements.values())) != len(placements):
                    return {"status": "contradiction", "steps": steps}
                changed = new != cand
                cand = new
                if placements and not batch:
                    c0 = choose(placements) if choose else min(placements)
                    placements = {c0: placements[c0]}
                if placements:
                    for c, v in placements.items():
                        grid[c] = v
                        unused &= ~(1 << v)
                    steps.append({"tier": tier, "sweeps": sweeps, "placed": len(placements),
                                  "kinds": sorted(kinds), "lock": lock_changed, "combos": combos_first,
                                  "cells": sorted(placements)})
                    progressed = True
                    break
                if not changed:
                    break
            if progressed:
                break
        if not progressed:
            status = "stuck"
            break
    return {"status": status, "steps": steps, "grid": grid, "start_one": start_one, "capped_reads": 0}


# ---------------------------------------------------------------------------
# 列をまたぐ式
# ---------------------------------------------------------------------------

def _line_eqs(geo, grid):
    """列ごとの (空きマスの係数の辞書, 右辺)。"""
    out = []
    for L in geo.lines:
        s = sum(grid[c] for c in L)
        out.append(({c: 1 for c in L if not grid[c]}, geo.M - s))
    return out


def combo_units(geo, grid, k=2, max_unknowns=3, max_coef=2, include_base=True, plus=True, min_empty=2):
    """列を k 本まで ±1 で足し引きした式のうち、空きマスが max_unknowns 以下のもの。
    min_empty: 足し引きに使う列の空きの下限（1マス空きの列を使う式は、段1を続けて読むのと同じなので除く）。"""
    eqs = _line_eqs(geo, grid)
    out = base_units(geo, grid) if include_base else []
    seen = set()
    for u in out:
        seen.add(tuple(sorted(u["cons"][0][0])) + ("=",))
    nL = len(eqs)
    for kk in range(2, k + 1):
        for comb in itertools.combinations(range(nL), kk):
            if any(len(eqs[li][0]) < min_empty for li in comb):
                continue
            for signs in itertools.product((1, -1), repeat=kk - 1):
                sg = (1,) + signs
                if not plus and all(s == 1 for s in sg):
                    continue
                co = {}
                rhs = 0
                for li, s in zip(comb, sg):
                    d, r = eqs[li]
                    rhs += s * r
                    for c, a in d.items():
                        co[c] = co.get(c, 0) + s * a
                co = {c: a for c, a in co.items() if a}
                if not co or len(co) > max_unknowns:
                    continue
                if max(abs(a) for a in co.values()) > max_coef:
                    continue
                cells = sorted(co)
                # 符号をそろえて重複を除く
                coefs = tuple(co[c] for c in cells)
                if coefs[0] < 0:
                    coefs = tuple(-a for a in coefs)
                    rhs2 = -rhs
                else:
                    rhs2 = rhs
                key = (tuple(cells), coefs, rhs2)
                if key in seen:
                    continue
                seen.add(key)
                out.append({"cons": [(tuple(cells), coefs, rhs2)], "cells": cells, "tier": len(cells),
                            "key": ("C", comb, sg)})
    return out


def joint_units(geo, grid, max_union=3, tier_of="max", include_base=True):
    """交わる2本の列を一緒に読む単位（空きの和集合が max_union 以下）。"""
    out = base_units(geo, grid) if include_base else []
    lines = geo.lines
    info = []
    for li, L in enumerate(lines):
        s = sum(grid[c] for c in L)
        em = tuple(c for c in L if not grid[c])
        info.append((em, geo.M - s))
    for a, b in itertools.combinations(range(len(lines)), 2):
        ea, ra = info[a]
        eb, rb = info[b]
        if not ea or not eb:
            continue
        if not set(ea) & set(eb):
            continue
        if len(ea) < 2 or len(eb) < 2:
            continue
        U = sorted(set(ea) | set(eb))
        if len(U) > max_union:
            continue
        tier = max(len(ea), len(eb)) if tier_of == "max" else len(U)
        out.append({"cons": [(ea, (1,) * len(ea), ra), (eb, (1,) * len(eb), rb)], "cells": U, "tier": tier,
                    "key": ("J", a, b)})
    return out


def feats_of(geo, givens, res):
    return m.read_features(geo, givens, res)


def lvl_of(f, n):
    """仮想の列の確かめを除いた C2 の段（盤面で絞る）。"""
    if f["status"] != "solved":
        return None
    return m._sized(m.reading_level(f), n, m.SIZES_C2)


def lin_determined(geo, grid):
    """列の式（空きマスだけに直したもの）の一次結合で値が決まる空きマス {マス: 値}。"""
    from fractions import Fraction
    em = [c for c in range(geo.N) if not grid[c]]
    if not em:
        return {}
    col = {c: i for i, c in enumerate(em)}
    rows = []
    for L in geo.lines:
        r = [Fraction(0)] * (len(em) + 1)
        s = 0
        for c in L:
            if grid[c]:
                s += grid[c]
            else:
                r[col[c]] = Fraction(1)
        r[-1] = Fraction(geo.M - s)
        rows.append(r)
    # RREF
    piv = []
    ri = 0
    ne = len(em)
    for j in range(ne):
        sel = None
        for i in range(ri, len(rows)):
            if rows[i][j] != 0:
                sel = i
                break
        if sel is None:
            continue
        rows[ri], rows[sel] = rows[sel], rows[ri]
        pv = rows[ri][j]
        rows[ri] = [x / pv for x in rows[ri]]
        for i in range(len(rows)):
            if i != ri and rows[i][j] != 0:
                f = rows[i][j]
                rows[i] = [a - f * b for a, b in zip(rows[i], rows[ri])]
        piv.append(j)
        ri += 1
    out = {}
    for i, j in enumerate(piv):
        r = rows[i]
        if all(r[k] == 0 for k in range(ne) if k != j):
            out[em[j]] = r[-1]
    return out


def lin_units(geo, grid):
    out = base_units(geo, grid)
    one = {u["cells"][0] for u in out if u["tier"] == 1}
    for c, v in lin_determined(geo, grid).items():
        if c in one:
            continue
        if v.denominator != 1:
            continue
        out.append({"cons": [((c,), (1,), int(v))], "cells": [c], "tier": 1, "key": ("LIN", c)})
    return out


# ---------------------------------------------------------------------------
# 段の使い方を変えた数え方
# ---------------------------------------------------------------------------

class _Contra(Exception):
    pass


HIDDEN_LAG = [False]
LOCK_LAG = [False]


def _run_tier(geo, grid, units, empties, unused, cand, tier, lock_min_tier=2, hidden_min_tier=1, sync=True):
    """1つの段で、置けるまで巡を重ねる。(置き場, 巡, 種類, lock, combos, 最後の候補)。置けなければ置き場は空。"""
    N = geo.N
    sweeps = 0
    lock_changed = False
    combos_first = []
    while True:
        sweeps += 1
        new = dict(cand)
        src = cand if sync else new
        lock_hit = False
        lock_later = []
        for u in units:
            if u["tier"] > tier:
                continue
            sup, req, nsets, _ = enum_unit(u["cons"], u["cells"], src, N)
            if sweeps == 1 and tier >= 2 and len(u["cells"]) >= 2:
                combos_first.append(nsets)
            if nsets == 0:
                raise _Contra
            for c, mk in zip(u["cells"], sup):
                new[c] &= mk
            if tier >= lock_min_tier and req:
                if LOCK_LAG[0]:
                    lock_later.append((set(u["cells"]), req))
                    continue
                inL = set(u["cells"])
                for c in empties:
                    if c not in inL:
                        nm = new[c] & ~req
                        if nm != new[c]:
                            new[c] = nm
                            lock_hit = True
        if lock_hit:
            lock_changed = True
        placements = {}
        kinds = set()
        for c in empties:
            mk = new[c]
            if mk == 0:
                raise _Contra
            if mk & (mk - 1) == 0:
                placements[c] = lowest(mk)
                kinds.add("one" if tier == 1 else "cross")
        if tier >= hidden_min_tier:
            hsrc = cand if HIDDEN_LAG[0] else new
            for v in bits(unused):
                where = [c for c in empties if (hsrc[c] >> v) & 1]
                if not where:
                    raise _Contra
                if len(where) == 1:
                    c = where[0]
                    if c not in placements:
                        kinds.add("hidden")
                    placements[c] = v
        for inL, req in lock_later:  # 次の巡から効く
            for c in empties:
                if c not in inL and new[c] & req:
                    new[c] &= ~req
                    lock_changed = True
        changed = new != cand
        cand = new
        if placements:
            return placements, sweeps, kinds, lock_changed, combos_first, cand
        if not changed:
            return {}, sweeps, kinds, lock_changed, combos_first, cand


def gsolve_policy(geo, givens, policy="base", units_fn=base_units, max_tier=3):
    """policy:
    base     … read_solve と同じ（段3は段2の動かなくなった候補から読み、巡は段3の分だけ数える）
    fresh3   … 段3も盤面から作り直した候補から読み、巡を最初から数える（段2の連なりも巡に入れる）
    shortest … 段2と段3（作り直した候補から）を両方読み、巡の少ない方で置く（同じなら段2）
    """
    N = geo.N
    grid = list(givens)
    used = 0
    for v in grid:
        if v:
            used |= 1 << v
    unused = geo.full & ~used
    steps = []
    start_one = sum(1 for u in units_fn(geo, grid) if u["tier"] == 1)
    try:
        while True:
            empties = [c for c in range(N) if not grid[c]]
            if not empties:
                break
            units = units_fn(geo, grid)
            fresh = {c: unused for c in empties}
            got = None
            r1 = _run_tier(geo, grid, units, empties, unused, fresh, 1)
            if r1[0]:
                got = (1, r1)
            else:
                cand1 = r1[5]
                r2 = _run_tier(geo, grid, units, empties, unused, cand1, 2)
                if policy == "base":
                    if r2[0]:
                        got = (2, r2)
                    else:
                        r3 = _run_tier(geo, grid, units, empties, unused, r2[5], 3)
                        if r3[0]:
                            got = (3, r3)
                else:
                    r3 = _run_tier(geo, grid, units, empties, unused, cand1, 3)
                    if policy == "fresh3":
                        if r2[0]:
                            got = (2, r2)
                        elif r3[0]:
                            got = (3, r3)
                    elif policy == "shortest":
                        if r2[0] and (not r3[0] or r2[1] <= r3[1]):
                            got = (2, r2)
                        elif r3[0]:
                            got = (3, r3)
            if got is None:
                return {"status": "stuck", "steps": steps, "start_one": start_one}
            tier, (pl, sw, kinds, lk, cf, _) = got
            for c, v in pl.items():
                grid[c] = v
                unused &= ~(1 << v)
            steps.append({"tier": tier, "sweeps": sw, "placed": len(pl), "kinds": sorted(kinds), "lock": lk,
                          "combos": cf, "cells": sorted(pl)})
    except _Contra:
        return {"status": "contradiction", "steps": steps, "start_one": start_one}
    return {"status": "solved", "steps": steps, "grid": grid, "start_one": start_one, "capped_reads": 0}


def chain_units(geo, grid, include_base=True):
    """空きが2マスの列をつないだ鎖（同じマスを持つ列のまとまり）を、1つの数で表して一緒に読む単位。段2。"""
    out = base_units(geo, grid) if include_base else []
    two = []
    for li, L in enumerate(geo.lines):
        em = tuple(c for c in L if not grid[c])
        if len(em) == 2:
            two.append((li, em, geo.M - sum(grid[c] for c in L)))
    # まとまり
    parent = list(range(len(two)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i, j in itertools.combinations(range(len(two)), 2):
        if set(two[i][1]) & set(two[j][1]):
            parent[find(i)] = find(j)
    comps = {}
    for i in range(len(two)):
        comps.setdefault(find(i), []).append(i)
    for comp in comps.values():
        if len(comp) < 2:
            continue
        cons = [(two[i][1], (1, 1), two[i][2]) for i in comp]
        cells = sorted({c for i in comp for c in two[i][1]})
        out.append({"cons": cons, "cells": cells, "tier": 2, "key": ("K", tuple(two[i][0] for i in comp))})
    return out


# ---------------------------------------------------------------------------
# 盤面全体で数を数える読み（段2以上で、列を読んだ後に使う）
# ---------------------------------------------------------------------------

def rule_pairs(geo, new, empties, unused, tier):
    if tier < 2:
        return False
    ch = False
    # 候補が同じ2つの2マス（列が違ってもよい）
    two = collections.defaultdict(list)
    for c in empties:
        if popcount(new[c]) == 2:
            two[new[c]].append(c)
    for mk, cs in two.items():
        if len(cs) == 2:
            for c in empties:
                if c not in cs and new[c] & mk:
                    new[c] &= ~mk
                    ch = True
    # 入る所が同じ2マスだけの2つの数
    where = {}
    for v in bits(unused):
        w = tuple(c for c in empties if (new[c] >> v) & 1)
        if len(w) == 2:
            where.setdefault(w, []).append(v)
    for w, vs in where.items():
        if len(vs) == 2:
            mk = (1 << vs[0]) | (1 << vs[1])
            for c in w:
                if new[c] & ~mk:
                    new[c] &= mk
                    ch = True
    return ch


def _hall_classes(geo, unused, classes, new, empties):
    ch = False
    for mk in classes:
        mk &= unused
        k = popcount(mk)
        if k == 0:
            continue
        inside = [c for c in empties if new[c] and not (new[c] & ~mk)]
        if len(inside) == k:
            for c in empties:
                if c not in inside and new[c] & mk:
                    new[c] &= ~mk
                    ch = True
        touch = [c for c in empties if new[c] & mk]
        if len(touch) == k:
            for c in touch:
                if new[c] & ~mk:
                    new[c] &= mk
                    ch = True
    return ch


def rule_parity(geo, new, empties, unused, tier):
    if tier < 2:
        return False
    odd = sum(1 << v for v in range(1, geo.N + 1, 2))
    even = geo.full & ~odd
    return _hall_classes(geo, unused, [odd, even], new, empties)


def rule_hall(geo, new, empties, unused, tier):
    """残っている数の、大きい方・小さい方の区間ごとの数え上げ（入る所の数と数の数が同じなら、そこに限る）。"""
    if tier < 2:
        return False
    vs = sorted(bits(unused))
    classes = []
    for i in range(len(vs)):
        for j in range(i, len(vs)):
            mk = 0
            for v in vs[i:j + 1]:
                mk |= 1 << v
            classes.append(mk)
    return _hall_classes(geo, unused, classes, new, empties)


def rule_all(geo, new, empties, unused, tier):
    a = rule_pairs(geo, new, empties, unused, tier)
    b = rule_parity(geo, new, empties, unused, tier)
    c = rule_hall(geo, new, empties, unused, tier)
    return a or b or c
