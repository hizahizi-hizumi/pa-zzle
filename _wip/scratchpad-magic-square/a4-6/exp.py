"""A4 6回目の確かめ役の実験。調査コードの read_solve に、新しい読み方のつまみ（x_*）を差し込んだ写しを作る。
調査コードは書き換えない（inspect で取り出した本文に、決まった5か所だけ文字列で差し込んで exec する）。"""
from __future__ import annotations

import inspect
import json
import os
import sys

CODE = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード"
sys.path.insert(0, CODE)
import magic_square_difficulty as m  # noqa: E402

# ---------------------------------------------------------------------------
# 差し込み
# ---------------------------------------------------------------------------

_SRC = inspect.getsource(m.read_solve)
_REPL = [
    ("units = build_units(geo, grid, opt, lines)", "units = X_build_units(geo, grid, opt, lines)"),
    ('''                if opt["chain_late"] and sweeps == 1 and tier >= 2 and u["kind"] == "chain":
                    continue''',
     '''                if opt["chain_late"] and sweeps == 1 and tier >= 2 and u["kind"] == "chain":
                    continue
                if X_skip(u, opt, sweeps, tier):
                    continue'''),
    ('''                unit_cells.update(u["cells"])
                for c, m in zip(u["cells"], sup):
                    new[c] &= m''',
     '''                unit_cells.update(u["cells"])
                for c, m in zip(u["cells"], sup):
                    if X_nomemo(u, c, opt):
                        continue
                    if not X_keep(c, m, new, src, opt):
                        continue
                    new[c] &= m'''),
    ('''and (not opt["lock_unique"] or nsets == 1)):''',
     '''and (not opt["lock_unique"] or nsets == 1) and X_lock_ok(u, opt, nsets)):'''),
    ('''                        if c not in inU:
                            if opt["sync"]:''',
     '''                        if c not in inU and X_lock_target(inU, c, opt, geo):
                            if opt["sync"]:'''),
    ('''        cand = r["cur"]
''',
     '''        cand = r["cur"]
        if opt["x_memo_t2only"] and tier >= 3:
            cand = run_tier(2, dict(stall_start), units, empties)["cur"]
'''),
]
for a, b in _REPL:
    assert _SRC.count(a) == 1, a
    _SRC = _SRC.replace(a, b)
_A = '''                if short3 and (nsets == 0 or nsets > short3):
                    continue'''
assert _SRC.count(_A) == 1
_SRC = _SRC.replace(_A, _A + '''
                if X_cap(u, nsets, opt, tier, sweeps):
                    continue''')
_SRC = _SRC.replace("def read_solve(", "def read_solve_x(", 1)

XDEF = {
    "x_ext_rowcol": False,    # 鎖を延ばす列（延ばした先から辿る空き2の列も）を行と列だけにする
    "x_ext_maxlines": 0,      # >0 なら、空き2の列が K 本以下の鎖だけ延ばす（短い鎖からだけ）
    "x_ext_nolock": False,    # 延ばしたまとまりから組の数を他で使わないをしない
    "x_ext_nomemo": False,    # 延ばしたまとまりの台を、元の鎖のマスにだけ書く（延ばした先のマスのメモを書かない）
    "x_ext_coef": None,       # 延ばす先のマスの t の係数の絶対値の許す集合（例 {1}。2t・3t・定数になる列では延ばさない）
    "x_ext_nocheck": False,   # 全部のマスが中にある列を確かめの式に使わない
    "x_ext_maxcells": 0,      # >0 なら、まとまりのマスが K を超える延ばし方はしない
    "x_ext_late": False,      # 延ばしたまとまりは各段の2巡目から（1巡目は元の鎖）
    "x_ext_t3": False,        # 延ばしたまとまり（空き3以上の列を足したもの）を段3に数える（段2では元の鎖）
    "x_ext_coef2_t3": False,  # 延ばしたまとまりのうち、係数の絶対値が2以上のマスを含むものだけ段3に数える
    "x_lock_line": False,     # 組の数を他で使わないを、単位のマスと同じ列にあるマスにだけ当てる
    "x_lock_maxtier": 0,      # >0 なら、組の数を他で使わないを段がこれ以下の単位からだけ（2 なら空き3の列からは消さない）
    "x_lock_maxsets": 0,      # >0 なら、組の数を他で使わないを、組がこれ以下の単位からだけ
    "x_memo_t2only": False,
    "x_memo_strict": 0,       # >0 なら、巡の中でも、単位の台で絞った候補が K 個以下になるマスだけ書く（巡の始めのメモと比べる。
                              # 頭の中で2つの列の候補を重ねない人。巡の間のメモは memo_max で別に決める）
    "x_cap_line2": 0,         # >0 なら、組が K 通りを超える空き2の列（1本の列）を読まない（候補がメモに書けない列）
    "x_cap_first": False,     # x_cap_line2 を各段の1巡目だけに当てる
    "x_order": None,          # 単位を読む順: few は組の少ない列から（x_memo_seq と重ねる）、rev は逆順
    "x_memo_seq": 0,          # >0 なら、同じ巡で先に書いたメモと重ねて K 個以下になるときだけ書く（読む順に依る）   # 段3以上の所で読んだ結果はメモに書かない（メモは段2を出し切った候補のまま。置いた数は消える）
}
EXT_KEYS = ("x_ext_rowcol", "x_ext_maxlines", "x_ext_nolock", "x_ext_nomemo", "x_ext_coef", "x_ext_nocheck",
            "x_ext_maxcells", "x_ext_late", "x_ext_t3", "x_ext_coef2_t3")

_ROWCOL: dict[int, set] = {}
_PEERS: dict[int, dict] = {}


def _rowcol(geo):
    if geo.n not in _ROWCOL:
        _ROWCOL[geo.n] = {tuple(L) for L in geo.lines[:2 * geo.n]}
    return _ROWCOL[geo.n]


def _peers(geo):
    if geo.n not in _PEERS:
        p = {c: set() for c in range(geo.N)}
        for L in geo.lines:
            for c in L:
                p[c].update(L)
        _PEERS[geo.n] = p
    return _PEERS[geo.n]


def _coefs(orig, eqs):
    coef = {min(orig): 1}
    m._coef_fill(coef, eqs)
    return coef


def extend_x(st, cells, eqs, used, opt, orig, rc):
    E = opt["tchain"]
    coef = _coefs(orig, eqs)
    added = 0
    grow = True
    while grow:
        grow = False
        for li, em, r in st:
            if li in used or not 2 <= len(em) <= E:
                continue
            inside = [c for c in em if c in cells]
            if len(inside) < len(em) - 1:
                continue
            if len(em) == 2 and any(c in orig for c in em):
                continue
            if opt["x_ext_rowcol"] and not rc[li]:
                continue
            if len(inside) == len(em):
                if opt["x_ext_nocheck"]:
                    continue
            else:
                if opt["x_ext_maxcells"] and len(cells) + 1 > opt["x_ext_maxcells"]:
                    continue
                if opt["x_ext_coef"] is not None:
                    if not all(c in coef for c in inside):
                        continue
                    k = -sum(coef[c] for c in inside)
                    if abs(k) not in opt["x_ext_coef"]:
                        continue
            used.add(li)
            eqs.append((em, (1,) * len(em), r))
            cells.update(em)
            m._coef_fill(coef, eqs)
            added += len(em) >= 3
            grow = True
    return added, coef


def tchain_x(geo, grid, clines, chains, opt):
    st = [x for x in m._line_states(geo, grid, clines) if len(x[1]) >= 2]
    rcs = _rowcol(geo)
    rc = {li: tuple(clines[li][0]) in rcs for li, _, _ in st}
    keep_plain = opt["x_ext_late"] or opt["x_ext_t3"] or opt["x_ext_coef2_t3"]
    out = []
    seen: set = set()
    for u in chains:
        if opt["x_ext_maxlines"] and u["lines"] > opt["x_ext_maxlines"]:
            out.append(u)
            continue
        cells, eqs, used = set(u["cells"]), list(u["eqs"]), set(u["key"][1:])
        orig = set(cells)
        if opt["tchain_steps"] or opt["tchain_c0"]:
            # 部品 tchain3_1 などと重ねるときは、延ばし方は部品のまま（x_ext の印だけ付ける）
            added = m.extend_unit(st, cells, eqs, used, opt["tchain"], opt["tchain_steps"], opt["tchain_c0"])
            coef = _coefs(orig, eqs)
        else:
            added, coef = extend_x(st, cells, eqs, used, opt, orig, rc)
        if not added:
            out.append(u)
            continue
        if keep_plain:
            out.append(u)
        key = ("TK",) + tuple(sorted(used))
        if key in seen:
            continue
        seen.add(key)
        eu = {"kind": "chain", "cells": sorted(cells), "eqs": eqs, "tier": u["tier"], "key": key,
              "lines": len(eqs), "ext": True, "orig": orig,
              "cmax": max(abs(v) for v in coef.values()) if coef else 1}
        if opt["x_ext_t3"] or (opt["x_ext_coef2_t3"] and eu["cmax"] >= 2):
            eu["tier"] = 3
            eu["natural"] = 3
        out.append(eu)
    return out


def X_build_units(geo, grid, opt, lines):
    units = _build_units_x(geo, grid, opt, lines)
    if opt["x_order"]:
        if opt["x_order"] == "rev":
            return units[::-1]
        used = 0
        for v in grid:
            if v:
                used |= 1 << v
        unused = geo.full & ~used

        def key(u):
            try:
                ns = m.read_unit(u, {c: unused for c in u["cells"]}, geo.N, 20000)[2]
            except m.LineReadCap:
                ns = 10 ** 6
            return (u["kind"] != "line", ns)
        units = sorted(units, key=key)
    return units


def _build_units_x(geo, grid, opt, lines):
    if not any(opt.get(k) for k in EXT_KEYS):
        return m.build_units(geo, grid, opt, lines)
    units = m.line_units(geo, grid, lines)
    clines = lines if opt["diag_chain"] else [L for i, L in enumerate(lines) if i not in (2 * geo.n, 2 * geo.n + 1)]
    if opt["chains"]:
        ch = m.chain_units(geo, grid, clines, opt["chain_limit"])
        if opt["tchain"]:
            ch = tchain_x(geo, grid, clines, ch, opt)
        if opt["chain_tier3_from"]:
            for u in ch:
                if u["lines"] >= opt["chain_tier3_from"]:
                    u["tier"] = 3
        units += ch
    if opt["joint"]:
        units += m.joint_units(geo, grid, lines, opt["joint"])
    if opt["combo"]:
        units += m.combo_units(geo, grid, lines, opt["combo"])
    if opt["jointk"]:
        units += m.jointk_units(geo, grid, clines, opt["jointk"], opt["jointk_dof"], opt["jointk_tier"])
    if opt["tchain2p"]:
        units += m.tchain2p_units(geo, grid, clines, opt["tchain2p"])
    if opt["dofk"]:
        units += m.dof_units(geo, grid, clines, opt["dofk"], opt["dof_e"])
    if opt["lin"]:
        have = {u["cells"][0] for u in units if u["tier"] == 1}
        units += [u for u in m.lin_units(geo, grid, lines) if u["cells"][0] not in have]
    if not opt["sync"]:
        import random
        if opt["order_seed"] == -1:
            units = units[::-1]
        elif opt["order_seed"] is not None:
            random.Random(opt["order_seed"]).shuffle(units)
    return units


def X_skip(u, opt, sweeps, tier):
    if opt["x_ext_late"] and u.get("ext") and sweeps == 1 and tier >= 2:
        return True
    return False


def X_cap(u, nsets, opt, tier, sweeps):
    """x_cap_line2: 組が K 通りを超える空き2の列（1本の列。鎖は別）を読まない。x_cap_first なら各段の1巡目だけ。"""
    K = opt["x_cap_line2"]
    if K and u["kind"] == "line" and len(u["cells"]) == 2 and nsets > K:
        if not opt["x_cap_first"] or sweeps == 1:
            return True
    return False


def X_keep(c, mk, new, src, opt):
    K = opt["x_memo_strict"]
    if K and (src[c] & mk).bit_count() > K:
        return False
    K = opt["x_memo_seq"]
    if K and (new[c] & mk).bit_count() > K:
        return False
    return True


def X_nomemo(u, c, opt):
    return bool(opt["x_ext_nomemo"] and u.get("ext") and c not in u["orig"])


def X_lock_ok(u, opt, nsets):
    if opt["x_ext_nolock"] and u.get("ext"):
        return False
    if opt["x_lock_maxtier"]:
        t = len(u["cells"]) if u["kind"] == "line" else u["tier"]
        if t > opt["x_lock_maxtier"]:
            return False
    if opt["x_lock_maxsets"] and nsets > opt["x_lock_maxsets"]:
        return False
    return True


def X_lock_target(inU, c, opt, geo):
    if opt["x_lock_line"]:
        pe = _peers(geo)
        return any(c in pe[x] for x in inU)
    return True


_NS = dict(m.__dict__)
_NS.update({"X_cap": X_cap, "X_keep": X_keep, "X_build_units": X_build_units, "X_skip": X_skip, "X_nomemo": X_nomemo, "X_lock_ok": X_lock_ok,
            "X_lock_target": X_lock_target})
exec(compile(_SRC, "<read_solve_x>", "exec"), _NS)
_read_solve_x = _NS["read_solve_x"]


def read_solve_x(geo, givens, **kw):
    o = dict(XDEF)
    o.update(kw)
    return _read_solve_x(geo, givens, **o)


def features_x(geo, g, kw):
    f = m.read_features(geo, g, read_solve_x(geo, g, **kw))
    if geo.n == 4:
        f["_virtual"] = m.read_features(geo, g, read_solve_x(geo, g, extra_lines=m.VIRTUAL4, **kw))
    return f


def level_x(n, g, kw, sizes=None):
    """新しい読み方 kw でのレベル（巡の上限を当てない。sizes が None なら盤面の割り当てを当てない）。"""
    geo = m.geo_of(n)
    f = features_x(geo, g, kw)
    return m.single_level_v6(f, n, sizes, cap=None), f


def kw_of(spec):
    """'部品+部品' と、新しい設定の dict を重ねる。spec は (部品の名前か None, dict)。"""
    name, extra = spec
    kw = m.variant_kw(name, merge=True) if name else {}
    if kw is None:
        return None
    return {**kw, **extra}


if __name__ == "__main__":
    # 自己検査: x_* を付けないときは read_solve と同じ結果になること（範囲内の例と部品で）
    ex = {
        5: [[0, 2, 4, 0, 0, 18, 0, 21, 0, 5, 0, 12, 0, 0, 0, 0, 17, 0, 0, 0, 1, 0, 15, 10, 0],
            [7, 0, 0, 15, 0, 0, 0, 0, 0, 21, 0, 4, 16, 25, 0, 0, 0, 0, 0, 20, 0, 0, 10, 6, 2],
            [0, 0, 10, 0, 24, 0, 23, 0, 0, 7, 0, 5, 0, 0, 0, 0, 3, 0, 15, 0, 20, 0, 0, 8, 14]],
    }
    for n, gs in ex.items():
        geo = m.geo_of(n)
        for g in gs:
            for v in [None, "memo4", "carry+memo4", "chain_late", "tchain_none", "tchain3_1", "diag_nochain", "weak"]:
                kw = m.variant_kw(v, merge=True) if v else {}
                a = m.read_solve(geo, g, **kw)
                b = read_solve_x(geo, g, **kw)
                assert [(s["tier"], s["sweeps"], s["cells"]) for s in a["steps"]] == \
                       [(s["tier"], s["sweeps"], s["cells"]) for s in b["steps"]], v
    print("ok")
