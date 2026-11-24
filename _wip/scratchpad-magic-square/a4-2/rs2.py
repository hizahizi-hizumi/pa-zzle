"""確かめ役の変種ソルバー。元の read_solve を写し、読み方・数え方の変種を足したもの（元のコードは変えない）。"""
from __future__ import annotations

import sys

D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード"
sys.path.insert(0, D)
import magic_square_difficulty as m  # noqa: E402
from magic_square_difficulty import bits, popcount, lowest, LineReadCap  # noqa: E402

EXTRA = dict(
    bounds=None,          # None | 'viol'（違反表示: 空きが2以上の列に r 以上は置けない）| 'range'（長い列の上下限）
    bounds_tier=1,        # 上下限を使う最も低い段
    bounds_long=False,    # True なら上下限は、その段で単位として読まない列（空き > 段）からだけ
    chain_lock=True,      # 鎖から「組の数を他で使わない」を使うか
    chain_distinct="all", # 'all'（鎖の全マスが互いに違う）| 'line'（同じ列の中だけ違う）
    chain_mode="full",    # 'full' | 'paths'（分かれ道で1本だけたどる・輪を閉じない: 極大の単純な道ごとに読む）
    pointing=False,       # 数 v の入る所が全部単位の中なら、その単位の入れ方は v を使うものだけ
    lock_scope="all",     # 'all' | 'units'（メモは読んだ単位のマスにだけある: 組の数を他で使わないはそこにだけ書く）
    lock_ephemeral=False, # 組の数を他で使わないで消した数をメモに残さない（その巡の判定にだけ使う）
    hidden=True,          # この数はここだけ を使うか
    big3=False,           # 空き2〜3の列のつながった全部を1つの単位で読む（段3）
    joint_chain3=False,   # 空き3の列と、それに交わる鎖を一緒に読む（段3）
    jointk_dof=99,        # jointk の組のうち、自由度（マス − 式）がこれ以下のものだけ
    jointk=0,             # >0 なら空き2〜3の列のつながった jointk 本までの組を一緒に読む（空き3を含む組だけ。段3）
    short3_sets=0,        # >0 なら段2で、組が short3_sets 通り以下の空き3の列も読む
    count="fresh",        # 'fresh'（定義）| 'carry'（段を上げるとき前の段の結果から続け、上げた段の巡だけ数える）
                          # | 'cum'（前の段の実のある巡も足す）
    combo_k=0,            # >0 なら列を combo_k 本まで ±1 で足し引きした式（空き3以下）
    joint=0,
    lin=False,
)


def enum_all(cells, eqs, cand, N, distinct_groups=None, cap=200000):
    """単位の入れ方を全部（値の並び）。distinct_groups が None なら全マス互いに違う。"""
    e = len(cells)
    pos = {c: i for i, c in enumerate(cells)}
    es = [([pos[c] for c in cc], list(co), r) for cc, co, r in eqs]
    order = []
    left = set(range(e))
    first = min(left, key=lambda i: (popcount(cand[cells[i]]), i))
    order.append(first)
    left.discard(first)
    while left:
        def score(i):
            k = 0
            for vs, co, r in es:
                if i in vs:
                    k += sum(1 for v in vs if v in order)
            return (-k, popcount(cand[cells[i]]), i)
        nxt = min(left, key=score)
        order.append(nxt)
        left.discard(nxt)
    rank = {i: k for k, i in enumerate(order)}
    by_last = {}
    for j, (vs, co, r) in enumerate(es):
        by_last.setdefault(max(rank[v] for v in vs), []).append(j)
    if distinct_groups is None:
        groups_of = {i: [0] for i in range(e)}
        ng = 1
    else:
        groups_of = {i: [] for i in range(e)}
        for gi, grp in enumerate(distinct_groups):
            for c in grp:
                groups_of[pos[c]].append(gi)
        ng = len(distinct_groups)
    val = [0] * e
    out = []
    nodes = [0]
    used = [0] * ng

    def rec(k):
        nodes[0] += 1
        if nodes[0] > cap:
            raise LineReadCap
        if k == e:
            out.append(tuple(val))
            return
        i = order[k]
        forced = None
        for j in by_last.get(k, []):
            vs, co, r = es[j]
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
        msk = cand[cells[i]]
        for g in groups_of[i]:
            msk &= ~used[g]
        if forced is not None:
            opts = [forced] if 1 <= forced <= N and (msk >> forced) & 1 else []
        else:
            opts = list(bits(msk))
        for x in opts:
            val[i] = x
            ok = True
            for j in by_last.get(k, []):
                vs, co, r = es[j]
                if sum(c * val[v] for v, c in zip(vs, co)) != r:
                    ok = False
                    break
            if ok:
                for g in groups_of[i]:
                    used[g] |= 1 << x
                rec(k + 1)
                for g in groups_of[i]:
                    used[g] &= ~(1 << x)
        val[i] = 0

    rec(0)
    return out


def summarize(assigns, e):
    sup = [0] * e
    sets = set()
    req = -1
    for a in assigns:
        s = 0
        for i, x in enumerate(a):
            sup[i] |= 1 << x
            s |= 1 << x
        sets.add(s)
        req &= s
    return sup, (req if assigns else 0), len(sets), len(assigns)


def chain_path_units(geo, grid, lines):
    """鎖を、セルのグラフ（空き2の列が辺）の極大の単純な道ごとに読む。"""
    two = [(li, em, r) for li, em, r in m._line_states(geo, grid, lines) if len(em) == 2]
    adj = {}
    for idx, (li, em, r) in enumerate(two):
        a, b = em
        adj.setdefault(a, []).append((b, idx))
        adj.setdefault(b, []).append((a, idx))
    paths = set()
    cap = [0]

    def dfs(v, visited, edges):
        cap[0] += 1
        if cap[0] > 20000:
            return
        ext = False
        for w, idx in adj[v]:
            if w not in visited:
                ext = True
                dfs(w, visited | {w}, edges + (idx,))
        if not ext and len(edges) >= 2:
            paths.add(frozenset(edges))
    for v in adj:
        dfs(v, frozenset([v]), ())
    out = []
    for p in paths:
        eqs = [(two[i][1], (1, 1), two[i][2]) for i in sorted(p)]
        cells = sorted({c for i in p for c in two[i][1]})
        out.append({"kind": "chain", "cells": cells, "eqs": eqs, "tier": 2,
                    "key": ("KP",) + tuple(sorted(two[i][0] for i in p)), "lines": len(p)})
    return out


def big3_units(geo, grid, lines, joint_chain_only=False):
    st = [(li, em, r) for li, em, r in m._line_states(geo, grid, lines) if 2 <= len(em) <= 3]
    out = []
    if joint_chain_only:
        chains = m.chain_units(geo, grid, lines)
        for li, em, r in st:
            if len(em) != 3:
                continue
            for ch in chains:
                if set(em) & set(ch["cells"]):
                    eqs = [(em, (1, 1, 1), r)] + list(ch["eqs"])
                    cells = sorted(set(em) | set(ch["cells"]))
                    out.append({"kind": "joint", "cells": cells, "eqs": eqs, "tier": 3,
                                "key": ("JC", li) + ch["key"], "lines": 1 + ch["lines"]})
        return out
    parent = list(range(len(st)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i in range(len(st)):
        for j in range(i + 1, len(st)):
            if set(st[i][1]) & set(st[j][1]):
                parent[find(i)] = find(j)
    comps = {}
    for i in range(len(st)):
        comps.setdefault(find(i), []).append(i)
    for comp in comps.values():
        if len(comp) < 2 or all(len(st[i][1]) == 2 for i in comp):
            continue
        eqs = [(st[i][1], (1,) * len(st[i][1]), st[i][2]) for i in comp]
        cells = sorted({c for i in comp for c in st[i][1]})
        out.append({"kind": "joint", "cells": cells, "eqs": eqs, "tier": 3,
                    "key": ("B3",) + tuple(sorted(st[i][0] for i in comp)), "lines": len(comp)})
    return out


def jointk_units(geo, grid, lines, k):
    st = [(li, em, r) for li, em, r in m._line_states(geo, grid, lines) if 2 <= len(em) <= 3]
    idx = list(range(len(st)))
    adj = {i: {j for j in idx if j != i and set(st[i][1]) & set(st[j][1])} for i in idx}
    out = []
    seen = set()
    for kk in range(2, k + 1):
        for sub in m._connected_subsets(idx, adj, kk):
            if all(len(st[i][1]) == 2 for i in sub):
                continue
            if sub in seen:
                continue
            seen.add(sub)
            eqs = [(st[i][1], (1,) * len(st[i][1]), st[i][2]) for i in sub]
            cells = sorted({c for i in sub for c in st[i][1]})
            out.append({"kind": "joint", "cells": cells, "eqs": eqs, "tier": 3,
                        "key": ("JK",) + tuple(sorted(st[i][0] for i in sub)), "lines": kk})
    return out


def build_units2(geo, grid, opt, lines):
    units = m.line_units(geo, grid, lines)
    if opt["chains"]:
        if opt["chain_mode"] == "paths":
            units += chain_path_units(geo, grid, lines)
        else:
            units += m.chain_units(geo, grid, lines, opt["chain_limit"])
    if opt["joint"]:
        units += m.joint_units(geo, grid, lines, opt["joint"])
    if opt["combo_k"]:
        units += m.combo_units(geo, grid, lines, opt["combo_k"])
    if opt["lin"]:
        have = {u["cells"][0] for u in units if u["tier"] == 1}
        units += [u for u in m.lin_units(geo, grid, lines) if u["cells"][0] not in have]
    if opt["big3"]:
        units += big3_units(geo, grid, lines)
    if opt["jointk"]:
        units += [u for u in jointk_units(geo, grid, lines, opt["jointk"])
                  if len(u["cells"]) - len(u["eqs"]) <= opt["jointk_dof"]]
    if opt["joint_chain3"]:
        units += big3_units(geo, grid, lines, joint_chain_only=True)
    return units


def read_unit2(u, src, N, cap, opt, unused, empties):
    cells = u["cells"]
    e = len(cells)
    special = False
    groups = None
    if u["kind"] == "chain" and opt["chain_distinct"] == "line":
        special = True
        groups = [list(cc) for cc, co, r in u["eqs"]]
    if opt["pointing"] and e >= 2:
        special = True
    if not special:
        return m.read_unit(u, src, N, cap)
    if u["kind"] == "line" and e >= 4:
        return m.read_unit(u, src, N, cap)
    assigns = enum_all(cells, u["eqs"], src, N, groups, cap)
    if opt["pointing"] and e >= 2:
        inU = set(cells)
        need = 0
        for v in bits(unused):
            where = [c for c in empties if (src[c] >> v) & 1]
            if where and all(c in inU for c in where):
                need |= 1 << v
        if need:
            assigns = [a for a in assigns if all(any(x == v for x in a) for v in bits(need))]
    return summarize(assigns, e)


def read_solve2(geo, givens, **kw):
    opt = dict(m.DEFAULT_READ)
    opt.update(EXTRA)
    opt.update(kw)
    max_tier = opt["max_tier"]
    N, M = geo.N, geo.M
    lines = [(L, M) for L in geo.lines]
    if opt["extra_lines"]:
        lines += list(opt["extra_lines"])
    grid = list(givens)
    used = 0
    for v in grid:
        if v:
            used |= 1 << v
    unused = geo.full & ~used
    steps = []
    cand = None
    capped_reads = 0
    status = "solved"

    class _Contradiction(Exception):
        pass

    def apply_bounds(src, new, empties, tier):
        if not opt["bounds"] or tier < opt["bounds_tier"]:
            return
        vals = sorted(bits(unused))
        for li, em, r in m._line_states(geo, grid, lines):
            e = len(em)
            if e < 2:
                continue
            if opt["bounds_long"] and e <= tier:
                continue
            if opt["bounds"] == "viol":
                lo, hi = 1, r - 1
            else:
                lo = r - sum(vals[-(e - 1):])
                hi = r - sum(vals[:e - 1])
            mk = geo.range_mask(lo, hi)
            for c in em:
                new[c] &= mk

    def run_tier(tier, cur, units, empties):
        nonlocal capped_reads
        sweeps = 0
        lock_changed = False
        combos_first = []
        chain_first = 0
        first_place = None
        while True:
            sweeps += 1
            new = dict(cur)
            src = cur
            lk = {c: 0 for c in empties}
            lock_hit = False
            unit_cells = set()
            for u in units:
                e = len(u["cells"])
                if u["tier"] > tier:
                    if not (opt["short3_sets"] and tier == 2 and u["kind"] == "line" and e == 3):
                        continue
                if u["kind"] == "line" and e >= 4 and tier < 4:
                    continue
                try:
                    sup, req, nsets, _ = read_unit2(u, src, N, opt["enum_cap"], opt, unused, empties)
                except LineReadCap:
                    capped_reads += 1
                    continue
                if u["tier"] > tier:  # short3
                    if nsets == 0 or nsets > opt["short3_sets"]:
                        continue
                if sweeps == 1 and tier >= 2 and e >= 2:
                    combos_first.append(nsets)
                    if u["kind"] == "chain":
                        chain_first = max(chain_first, u["lines"])
                if nsets == 0:
                    raise _Contradiction
                unit_cells |= set(u["cells"])
                for c, mm in zip(u["cells"], sup):
                    new[c] &= mm
                if tier >= opt["lock_min_tier"] and req:
                    if u["kind"] == "chain" and not opt["chain_lock"]:
                        continue
                    inU = set(u["cells"])
                    for c in empties:
                        if c not in inU:
                            if new[c] & req:
                                lk[c] |= req
                                lock_hit = True
            apply_bounds(src, new, empties, tier)
            # 組の数を他で使わないを書く
            eff = dict(new)
            for c in empties:
                if lk[c]:
                    if opt["lock_scope"] == "units" and c not in unit_cells:
                        continue
                    eff[c] &= ~lk[c]
            if lock_hit:
                lock_changed = True
            placements = {}
            kinds = set()
            for c in empties:
                mm = eff[c]
                if mm == 0:
                    raise _Contradiction
                if mm & (mm - 1) == 0:
                    placements[c] = lowest(mm)
                    kinds.add("one" if tier == 1 else "cross")
            if opt["hidden"] and tier >= opt["hidden_min_tier"]:
                for v in bits(unused):
                    where = [c for c in empties if (eff[c] >> v) & 1]
                    if not where:
                        raise _Contradiction
                    if len(where) == 1:
                        c = where[0]
                        if c in placements and placements[c] != v:
                            raise _Contradiction
                        if c not in placements:
                            kinds.add("hidden")
                        placements[c] = v
            if len(set(placements.values())) != len(placements):
                raise _Contradiction
            nxt = new if opt["lock_ephemeral"] else eff
            changed = nxt != cur
            cur = nxt
            if first_place is None and sweeps == 1:
                first_place = len(placements)
            if placements or not changed:
                return {"placements": placements, "kinds": kinds, "sweeps": sweeps, "lock": lock_changed,
                        "combos": combos_first, "chain": chain_first, "cur": cur, "first_place": first_place}

    while True:
        empties = [c for c in range(N) if not grid[c]]
        if not empties:
            break
        if cand is None or not opt["memory"]:
            cand = {c: unused for c in empties}
        else:
            cand = {c: cand[c] & unused for c in empties}
        units = build_units2(geo, grid, opt, lines)
        stall_start = cand
        chosen = None
        extra_sweeps = 0
        try:
            if opt["tier_choice"] == "fewest":
                r1 = run_tier(1, dict(stall_start), units, empties)
                if r1["placements"]:
                    chosen = (1, r1)
                else:
                    for tier in range(2, min(3, max_tier) + 1):
                        r = run_tier(tier, dict(stall_start), units, empties)
                        if r["placements"] and (chosen is None or r["sweeps"] < chosen[1]["sweeps"]):
                            chosen = (tier, r)
                    if chosen is None and max_tier >= 4:
                        r = run_tier(4, dict(stall_start), units, empties)
                        if r["placements"]:
                            chosen = (4, r)
            else:
                curc = dict(stall_start)
                for tier in range(1, max_tier + 1):
                    start = dict(stall_start) if opt["count"] == "fresh" else dict(curc)
                    r = run_tier(tier, start, units, empties)
                    if r["placements"]:
                        chosen = (tier, r)
                        break
                    if opt["count"] != "fresh":
                        curc = r["cur"]
                        if opt["count"] == "cum" and tier >= 2:
                            extra_sweeps += r["sweeps"] - 1
        except _Contradiction:
            return {"status": "contradiction", "steps": steps}
        if chosen is None:
            status = "stuck"
            break
        tier, r = chosen
        placements = r["placements"]
        found = len(placements)
        if not opt["batch"]:
            c0 = min(placements)
            placements = {c0: placements[c0]}
        cand = r["cur"]
        for c, v in placements.items():
            grid[c] = v
            unused &= ~(1 << v)
        steps.append({
            "tier": tier,
            "sweeps": r["sweeps"] + (extra_sweeps if tier >= 2 else 0),
            "placed": len(placements),
            "found": found if r["sweeps"] == 1 else r["first_place"],
            "kinds": sorted(r["kinds"]),
            "lock": r["lock"],
            "combos": r["combos"],
            "chain": r["chain"],
            "cells": sorted(placements),
        })
    return {"status": status, "steps": steps, "grid": grid,
            "start_one": sum(1 for li, em, r in m._line_states(geo, list(givens), lines) if len(em) == 1),
            "capped_reads": capped_reads}


def level_of(n, g, **kw):
    geo = m.geo_of(n)
    r = read_solve2(geo, g, **kw)
    f = m.read_features(geo, g, r)
    d = {"n": n, "givens": g, "var": {}}
    if n == 4:
        d["var"]["virtual"] = m.read_features(geo, g, read_solve2(geo, g, extra_lines=m.VIRTUAL4, **kw))
    lv, reason = m.level_and_reason(m.PROPOSALS["C2"], f, d)
    return lv, reason, f, r
