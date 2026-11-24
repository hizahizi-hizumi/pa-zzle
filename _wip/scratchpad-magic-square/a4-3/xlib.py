"""A4-3 の確かめ用: 調査コードの read_solve の写しに、新しい読み方のつまみを足したもの。
新しいつまみを全部切ると m.read_solve と同じ結果になる（selfcheck で確かめる）。"""
from __future__ import annotations

import json
import os
import sys

CODE = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード"
sys.path.insert(0, CODE)
import magic_square_difficulty as m  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
bits, popcount, lowest = m.bits, m.popcount, m.lowest

X_DEFAULT = {
    "memo_max": None,        # メモに書くのは候補が memo_max 個以下のマスだけ（それより多いマスは全部の数に戻す）
    "naked": 0,              # >0: 候補が同じ k 個のマス k 個（k<=naked）から、その数を他の全マスで消す（全体で1回ずつなので）
    "naked_tier": 1,
    "hpair": False,          # 2つの数の入る所が同じ2マスだけなら、その2マスをその2つに絞る
    "hpair_tier": 1,
    "trial": 0,              # >0: 段 trial 以上で、候補2つのマスに仮に置き、段1の置き方と違反の知らせで矛盾する方を消す
    "trial_maxc": 2,         # 仮に置くマスの候補の数の上限
    "chain_tier3_from": 0,   # >0: 列が chain_tier3_from 本以上の鎖を段3に数える
    "jointk_tier": 3,        # jointk の単位の段
    "line_hidden_only": False,  # この数はここだけを、その数を必ず使う列の中でだけ見る（全体では見ない）
    "pair_t1": False,
    "memo_scope": "all",     # memo_max を当てる所: all（巡の間も） / step（置いた後のメモだけ。行き詰まりの中の巡は頭で覚える）        # 段1で、空き2の列の入れ方が1通りしかない列の組の数を、他のマスから消す（段1の読みに足す）
}


def build_units_x(geo, grid, opt, lines):
    dm = opt.get("diag_mode")
    if dm:
        nd = 2 * geo.n  # 行と列の数。これより後ろは斜め（と仮想の列）
        units = m.line_units(geo, grid, lines)
        # 列の単位: 斜めは dm == "t1only" なら空き1のときだけ読む
        units = [u for u in units if not (dm == "t1only" and u["key"][1] in (nd, nd + 1) and len(u["cells"]) >= 2)]
        nodiag = [L for i, L in enumerate(lines) if i not in (nd, nd + 1)]
        if opt["chains"]:
            units += m.chain_units(geo, grid, nodiag, opt["chain_limit"])
        if opt["jointk"]:
            ju = m.jointk_units(geo, grid, nodiag, opt["jointk"], opt["jointk_dof"])
            for u in ju:
                u["tier"] = opt["jointk_tier"]
            units += ju
        return units
    units = m.build_units(geo, grid, {**opt, "jointk": 0}, lines)
    if opt["jointk"]:
        ju = m.jointk_units(geo, grid, lines, opt["jointk"], opt["jointk_dof"])
        for u in ju:
            u["tier"] = opt["jointk_tier"]
        units += ju
    if opt["chain_tier3_from"]:
        for u in units:
            if u["kind"] == "chain" and u["lines"] >= opt["chain_tier3_from"]:
                u["tier"] = 3
    return units


def read_solve_x(geo, givens, **kw):
    opt = dict(m.DEFAULT_READ)
    opt.update(X_DEFAULT)
    opt.update(kw)
    max_tier = opt["max_tier"]
    N, M = geo.N, geo.M
    lines = [(L, M) for L in geo.lines]
    if opt["extra_lines"]:
        lines += list(opt["extra_lines"])
    cell_lines = [[i for i, (L, S) in enumerate(lines) if c in L] for c in range(N)]
    grid = list(givens)
    used = 0
    for v in grid:
        if v:
            used |= 1 << v
    unused = geo.full & ~used
    steps = []
    cand = None
    start_one = sum(1 for li, em, r in m._line_states(geo, grid, lines) if len(em) == 1)
    status = "solved"
    capped_reads = 0

    class _Contradiction(Exception):
        pass

    def memo_filter(d):
        K = opt["memo_max"]
        if K is None:
            return d
        if opt.get("memo_hull"):
            out = {}
            for c, v in d.items():
                if popcount(v) <= K or v == 0:
                    out[c] = v
                else:
                    out[c] = geo.range_mask(lowest(v), v.bit_length() - 1) & unused
            return out
        return {c: (v if popcount(v) <= K else unused) for c, v in d.items()}

    def apply_bounds(new, empties, tier):
        if not opt["bounds"] or tier < opt["bounds_tier"]:
            return
        vals = sorted(bits(unused))
        for li, em, r in m._line_states(geo, grid, lines):
            e = len(em)
            if e < 2 or (opt["bounds_long"] and e <= tier):
                continue
            if opt["bounds"] == "viol":
                lo, hi = 1, r - 1
            else:
                lo = r - sum(vals[-(e - 1):])
                hi = r - sum(vals[:e - 1])
            mk = geo.range_mask(lo, hi)
            for c in em:
                new[c] &= mk

    def trial_ok(c, v, src, empties):
        """c に v を仮に置き、段1（空き1の列・候補1つのマス）を続けて、矛盾（違反の知らせ・候補なし・数の重なり）が出るか。
        出なければ True。"""
        g = list(grid)
        un = unused
        cd = dict(src)
        g[c] = v
        un &= ~(1 << v)
        todo = True
        while todo:
            todo = False
            # 違反
            for (L, S) in lines:
                s = 0
                e = 0
                emc = -1
                for x in L:
                    if g[x]:
                        s += g[x]
                    else:
                        e += 1
                        emc = x
                rr = S - s
                if e == 0 and rr != 0:
                    return False
                if e >= 1 and rr <= 0:
                    return False
                if e == 1:
                    if not (1 <= rr <= N) or not (un >> rr) & 1 or not (cd[emc] >> rr) & 1:
                        return False
                    g[emc] = rr
                    un &= ~(1 << rr)
                    todo = True
                    break
            if todo:
                continue
            for x in empties:
                if g[x]:
                    continue
                mk = cd[x] & un
                if mk == 0:
                    return False
                if mk & (mk - 1) == 0:
                    w = lowest(mk)
                    g[x] = w
                    un &= ~(1 << w)
                    todo = True
                    break
        return True

    def run_tier(tier, cur, units, empties):
        nonlocal capped_reads
        sweeps = 0
        lock_changed = False
        combos_first = []
        chain_first = 0
        pending = []   # lock_next_eph: 前の巡の組の数を他で使わない（この巡の置き場所探しにだけ使う）
        while True:
            sweeps += 1
            new = dict(cur)
            src = cur if opt["sync"] else new
            lk = {}
            unit_cells = set()
            lock_later = []
            line_reqs = []
            for u in units:
                e = len(u["cells"])
                short3 = False
                if u["tier"] > tier:
                    if opt["short3_sets"] and tier == 2 and u["kind"] == "line" and e == 3:
                        short3 = True
                    else:
                        continue
                if u["kind"] == "line" and e >= 4 and tier < 4:
                    continue
                try:
                    sup, req, nsets, _ = m.read_unit(u, src, N, opt["enum_cap"])
                except m.LineReadCap:
                    capped_reads += 1
                    continue
                if short3 and (nsets == 0 or nsets > opt["short3_sets"]):
                    continue
                if sweeps == 1 and tier >= 2 and e >= 2:
                    combos_first.append(nsets)
                    if u["kind"] == "chain":
                        chain_first = max(chain_first, u["lines"])
                if nsets == 0:
                    raise _Contradiction
                unit_cells.update(u["cells"])
                if u["kind"] == "line" and e >= 2 and req:
                    line_reqs.append((u["cells"], req))
                for c, mm in zip(u["cells"], sup):
                    new[c] &= mm
                lock_ok = tier >= opt["lock_min_tier"] or (opt["pair_t1"] and tier == 1 and u["kind"] == "line" and e == 2)
                if lock_ok and req and (u["kind"] != "chain" or opt["chain_lock"]):
                    inU = set(u["cells"])
                    if opt["lock_next"]:
                        lock_later.append((inU, req))
                        continue
                    for c in empties:
                        if c not in inU:
                            if opt["sync"]:
                                lk[c] = lk.get(c, 0) | req
                            elif new[c] & req:
                                new[c] &= ~req
                                lock_changed = True
            if opt["long_sets"] and tier >= 2:
                for u in units:
                    if u["kind"] != "line" or len(u["cells"]) < 4 or tier >= 4:
                        continue
                    try:
                        sup, req, nsets, _ = m.read_unit(u, src, N, 5000)
                    except m.LineReadCap:
                        continue
                    if nsets == 0 or nsets > opt["long_sets"]:
                        continue
                    for c, mm in zip(u["cells"], sup):
                        new[c] &= mm
            apply_bounds(new, empties, tier)
            # 仮置き（候補2つのマス）: 巡の始めの候補から
            if opt["trial"] and tier >= opt["trial"]:
                for c in empties:
                    mk = src[c]
                    if 2 <= popcount(mk) <= opt["trial_maxc"]:
                        for v in list(bits(mk)):
                            if (new[c] >> v) & 1 and not trial_ok(c, v, src, empties):
                                new[c] &= ~(1 << v)
            eff = dict(new) if lk else new
            for c, req in lk.items():
                if opt["lock_scope"] == "units" and c not in unit_cells:
                    continue
                if eff[c] & req:
                    eff[c] &= ~req
                    lock_changed = True
            if opt.get("lock_next_eph") and pending:
                eff = dict(eff)
                for inU, req in pending:
                    for c in empties:
                        if c not in inU and eff[c] & req:
                            eff[c] &= ~req
                            lock_changed = True
            # 同じ候補の k マス（全体）
            if opt["naked"] and tier >= opt["naked_tier"]:
                eff = dict(eff)
                groups = {}
                for c in empties:
                    k = popcount(eff[c])
                    if 2 <= k <= opt["naked"]:
                        groups.setdefault(eff[c], []).append(c)
                for mk, cs in groups.items():
                    if len(cs) == popcount(mk):
                        for c in empties:
                            if c not in cs and eff[c] & mk:
                                eff[c] &= ~mk
            if opt["hpair"] and tier >= opt["hpair_tier"]:
                eff = dict(eff)
                where = {}
                for v in bits(unused):
                    w = tuple(c for c in empties if (eff[c] >> v) & 1)
                    if len(w) == 2:
                        where.setdefault(w, []).append(v)
                for w, vs in where.items():
                    if len(vs) == 2:
                        mk = (1 << vs[0]) | (1 << vs[1])
                        for c in w:
                            eff[c] &= mk
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
                hsrc = cur if opt["hidden_next"] else eff
                if opt["line_hidden_only"] or opt.get("line_hidden_plus"):
                    # その数を必ず使う空きの列（この巡に読んだ列の req）の中で、入る所が1マスだけ
                    for cells_u, req in line_reqs:
                        for v in bits(req):
                            wh = [c for c in cells_u if (eff[c] >> v) & 1]
                            if len(wh) == 1:
                                c = wh[0]
                                if c in placements and placements[c] != v:
                                    raise _Contradiction
                                if c not in placements:
                                    kinds.add("hidden")
                                placements[c] = v
                if not opt["line_hidden_only"]:
                    for v in bits(unused):
                        where = [c for c in empties if (hsrc[c] >> v) & 1]
                        if not where:
                            if opt["hidden_next"]:
                                continue
                            raise _Contradiction
                        if len(where) == 1:
                            c = where[0]
                            if opt["hidden_next"] and not (eff[c] >> v) & 1:
                                continue
                            if c in placements and placements[c] != v:
                                raise _Contradiction
                            if c not in placements:
                                kinds.add("hidden")
                            placements[c] = v
            if len(set(placements.values())) != len(placements):
                raise _Contradiction
            if opt.get("lock_next_eph"):
                sig_old = {(frozenset(a), b) for a, b in pending}
                pending = lock_later
                lock_later = []
                pend_changed = {(frozenset(a), b) for a, b in pending} != sig_old
            else:
                pend_changed = False
            if lock_later:
                eff = dict(eff)
                for inU, req in lock_later:
                    for c in empties:
                        if c not in inU and eff[c] & req:
                            eff[c] &= ~req
                            lock_changed = True
            nxt = new if opt["lock_ephemeral"] else eff
            if opt["memo_scope"] == "all":
                nxt = memo_filter(nxt)
            changed = nxt != cur or pend_changed
            cur = nxt
            if placements or not changed:
                return {"placements": placements, "kinds": kinds, "sweeps": sweeps, "lock": lock_changed,
                        "combos": combos_first, "chain": chain_first, "cur": cur}

    while True:
        empties = [c for c in range(N) if not grid[c]]
        if not empties:
            break
        if cand is None or not opt["memory"]:
            cand = {c: unused for c in empties}
        else:
            cand = {c: cand[c] & unused for c in empties}
        cand = memo_filter(cand)
        units = build_units_x(geo, grid, opt, lines)
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
                curc = stall_start
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
            pick = opt.get("one_pick", "min")
            c0 = min(placements) if pick == "min" else max(placements)
            placements = {c0: placements[c0]}
        cand = r["cur"]
        for c, v in placements.items():
            grid[c] = v
            unused &= ~(1 << v)
        steps.append({
            "tier": tier,
            "sweeps": r["sweeps"] + (extra_sweeps if tier >= 2 else 0),
            "placed": len(placements),
            "found": found,
            "kinds": sorted(r["kinds"]),
            "lock": r["lock"],
            "combos": r["combos"],
            "chain": r["chain"],
            "cells": sorted(placements),
        })
    return {"status": status, "steps": steps, "grid": grid, "start_one": start_one,
            "capped_reads": capped_reads}


def level_of(n, g, setting, use_x=True):
    """設定 setting での1つの読むモデルのレベル（4×4 は同じ読み方に仮想の列を足して下がるかも当てる）。"""
    geo = m.geo_of(n)
    rs = read_solve_x if use_x else m.read_solve
    f = m.read_features(geo, g, rs(geo, g, **setting))
    if n == 4:
        f["_virtual"] = m.read_features(geo, g, rs(geo, g, extra_lines=m.VIRTUAL4, **setting))
    lv, why = m.single_level_v4(f, n, m.SIZES_C2)
    return lv, why, f


def load_inrange(path=None):
    path = path or os.path.join(HERE, "classified.jsonl")
    rows = [json.loads(x) for x in open(path)]
    return rows, [d for d in rows if d["level"]]
