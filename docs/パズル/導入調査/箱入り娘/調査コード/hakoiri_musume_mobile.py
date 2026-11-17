"""箱入り娘 調査: スマホ操作。

標準ライブラリだけで、次を計算・模擬する。

1. レイアウト計算: 既存のプレイ画面の外枠（GamePlayFrame）の寸法から、4×5 の盤の1マスの大きさを求める。
   ブラウザーで描いた値ではなく、クラス名の寸法から出した計算値。
2. 最短解の手のうち、1手の中で曲がる・2マス以上動く手の割合（なぞって曲がる操作がどれだけ要るか）。
3. なぞりの入力処理の3案を、合成した指の軌跡で比べる。
   A: 認識合わせの見本（押した時点の到達先のうち、指の位置に最も近い所へ置く）
   B: 追いかけ（指の位置へ1マスずつ寄せ、塞がれた軸は別の軸を試す。塞がれている間の指の動きは捨てない）
   C: 隣接だけ（ハミルトン路の finger-trace と同じく、指のいるマスを不感帯つきで1マスずつ追い、
      駒はそのマスが隣（斜めは角経由）で空いているときだけ移る。回り込ませない）
4. 押し間違い: 狙った駒の内側を押したつもりの指が、別の駒や空きマスに落ちる割合。

合成の指は人の指の動きそのものではない。条件は各節の出力に書く。
"""

from __future__ import annotations

import json
import math
import random
import sys
from collections import deque

W, H = 4, 5

PUZZLES = {
    # 認識合わせの易しい例（最短13手）と横刀立馬（最短81手）
    "easy": ["bAAc", "bAAc", "d..f", "dEEf", "g..h"],
    "yokogatana": ["bAAc", "bAAc", "dEEf", "dghf", "i..j"],
}

# ---------------------------------------------------------------- 盤と解法


def parse(rows):
    cells = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != ".":
                cells.setdefault(ch, []).append((r, c))
    ps = []
    for k, v in sorted(cells.items()):
        rs = [a for a, _ in v]
        cs = [b for _, b in v]
        ps.append((max(rs) - min(rs) + 1, max(cs) - min(cs) + 1, min(rs), min(cs)))
    return tuple(ps)


def shape_key(ps):
    g = [["."] * W for _ in range(H)]
    for h, w, r, c in ps:
        t = {(2, 2): "A", (2, 1): "V", (1, 2): "H", (1, 1): "s"}[(h, w)]
        for i in range(h):
            for j in range(w):
                g[r + i][c + j] = t
    return "".join("".join(x) for x in g)


def occupied(ps, skip):
    o = set()
    for i, (h, w, r, c) in enumerate(ps):
        if i == skip:
            continue
        for a in range(h):
            for b in range(w):
                o.add((r + a, c + b))
    return o


def fits(h, w, r, c, occ):
    if r < 0 or c < 0 or r + h > H or c + w > W:
        return False
    return not any((r + a, c + b) in occ for a in range(h) for b in range(w))


def piece_reach(ps, i):
    """駒 i が1手で行ける位置と、そこまでの最短の道（駒の左上の列）。BFS の順に並ぶ。"""
    h, w, r, c = ps[i]
    occ = occupied(ps, i)
    par = {(r, c): None}
    q = deque([(r, c)])
    order = [(r, c)]
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (y + dy, x + dx)
            if n in par or not fits(h, w, n[0], n[1], occ):
                continue
            par[n] = (y, x)
            q.append(n)
            order.append(n)
    return order, par


def path_to(par, dest):
    p = []
    x = dest
    while x is not None:
        p.append(x)
        x = par[x]
    return p[::-1]


def successors(ps):
    for i in range(len(ps)):
        order, _ = piece_reach(ps, i)
        h, w, _, _ = ps[i]
        for pos in order[1:]:
            n = list(ps)
            n[i] = (h, w, pos[0], pos[1])
            yield tuple(n)


def goal(ps):
    return any(h == 2 and w == 2 and r == 3 and c == 1 for h, w, r, c in ps)


def bfs_all(ps0):
    """連結成分を全部たどる。状態（駒の並び）・最短解の道を返す。"""
    k0 = shape_key(ps0)
    seen = {k0: None}
    rep = {k0: ps0}
    q = deque([ps0])
    goal_key = None
    while q:
        p = q.popleft()
        kp = shape_key(p)
        if goal_key is None and goal(p):
            goal_key = kp
        for n in successors(p):
            kn = shape_key(n)
            if kn not in seen:
                seen[kn] = kp
                rep[kn] = n
                q.append(n)
    sol = []
    x = goal_key
    while x is not None:
        sol.append(rep[x])
        x = seen[x]
    return list(rep.values()), sol[::-1]


def turns(path):
    t = 0
    for a, b, c in zip(path, path[1:], path[2:]):
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
            t += 1
    return t


# ---------------------------------------------------------------- 1. レイアウト

REM = 16
BRAND = 1.75 * REM  # BrandIdentityHeader compact
HEADER = 4.5 * REM  # PlayHeader h-[4.5rem]
FOOTER = 7 * REM  # footer h-28（待ったのボタン）
MAIN_PY = 2 * 0.5 * REM  # main py-2


def board_cell(vw, vh, cols, rows, pad_x, extra_w=0.0, extra_h=0.0, footer=FOOTER, main_py=MAIN_PY):
    """盤面を main の内側に縦横比を保って最大に置いたときの1マス。extra は枠・出口の分（マス幅に対する割合）。"""
    avail_w = vw - 2 * pad_x
    avail_h = vh - BRAND - HEADER - footer - main_py
    return min(avail_w / (cols + extra_w), avail_h / (rows + extra_h))


def layout():
    viewports = [
        (320, 460, "320×568 端末で Safari のバーが出た状態の目安（推測）"),
        (320, 568, "iPhone SE 第1世代の画面"),
        (320, 640, "ハミルトン路の画面確認と同じ"),
        (360, 640, "Android の小さい機種"),
        (375, 548, "iPhone SE 第2・3世代で Safari のバーが出た状態の目安（推測）"),
        (375, 667, "iPhone SE 第2・3世代の画面"),
        (390, 664, "iPhone 12〜15 で Safari のバーが出た状態の目安（推測）"),
        (390, 844, "iPhone 12〜15 の画面"),
        (430, 932, "iPhone Pro Max の画面"),
    ]
    frames = {
        "枠なし": (0.0, 0.0),
        # 枠をマス幅の0.15ずつ四方に、出口の口を下に0.3足した案
        "枠0.15+出口0.3": (0.3, 0.6),
    }
    out = []
    for vw, vh, note in viewports:
        row = {"viewport": f"{vw}×{vh}", "note": note}
        for name, (ew, eh) in frames.items():
            for pad in (12, 16):
                c = board_cell(vw, vh, 4, 5, pad, ew, eh)
                cw = (vw - 2 * pad) / (4 + ew)
                row[f"{name}/px{pad}"] = {
                    "cell": round(c, 1),
                    "limited_by": "高さ" if c < cw - 1e-9 else "幅",
                }
        # 既存ゲームとの比較（同じ式で計算）
        row["hitofude8x8/px16"] = round(board_cell(vw, vh, 8, 8, 16), 1)
        # スライドパズルは footer 無し、main は pt-2 pb-6、px-3
        row["slide5x5/px12"] = round(
            board_cell(vw, vh, 5, 5, 12, footer=0, main_py=0.5 * REM + 1.5 * REM), 1
        )
        out.append(row)
    return out


# ---------------------------------------------------------------- 2. 最短解の手の形


def solution_shapes():
    res = {}
    for name, rows in PUZZLES.items():
        _, sol = bfs_all(parse(rows))
        stats = {"moves": len(sol) - 1, "straight1": 0, "straight_multi": 0, "turn": 0, "max_cells": 0}
        for a, b in zip(sol, sol[1:]):
            i = next(k for k in range(len(a)) if a[k] != b[k])
            _, par = piece_reach(a, i)
            p = path_to(par, (b[i][2], b[i][3]))
            n = len(p) - 1
            stats["max_cells"] = max(stats["max_cells"], n)
            if turns(p) > 0:
                stats["turn"] += 1
            elif n >= 2:
                stats["straight_multi"] += 1
            else:
                stats["straight1"] += 1
        res[name] = stats
    return res


# ---------------------------------------------------------------- 3. なぞりの入力処理


HYST = 0.15  # ハミルトン路の CELL_SWITCH_INSET と同じ
TRACE_STEP = 1 / 6  # ハミルトン路の FINGER_TRACE_STEP と同じ


def algo_nearest(ps, i, events):
    """A: 認識合わせの見本。押した時点の到達先から、指の位置に最も近い所。"""
    order, _ = piece_reach(ps, i)
    r0, c0 = ps[i][2], ps[i][3]
    pos = (r0, c0)
    visited = [pos]
    for ty, tx in events:
        best, bd = None, 1e9
        for q in order:
            d = (q[0] - ty) ** 2 + (q[1] - tx) ** 2
            if d < bd - 1e-9:
                bd, best = d, q
        if best != pos:
            pos = best
            visited.append(pos)
    return pos, visited


def interpolate(events, start):
    prev = start
    for e in events:
        dy, dx = e[0] - prev[0], e[1] - prev[1]
        n = max(1, math.ceil(math.hypot(dy, dx) / TRACE_STEP))
        for k in range(1, n + 1):
            yield (prev[0] + dy * k / n, prev[1] + dx * k / n)
        prev = e


def algo_chase(ps, i, events):
    """B: 追いかけ。指の位置へ1マスずつ寄せる。塞がれた軸は別の軸を試す。"""
    h, w, r0, c0 = ps[i]
    occ = occupied(ps, i)
    p = (r0, c0)
    visited = [p]
    th = 0.5 + HYST
    for ty, tx in interpolate(events, (r0, c0)):
        for _ in range(8):
            oy, ox = ty - p[0], tx - p[1]
            cands = []
            if abs(oy) >= th:
                cands.append((abs(oy), (1 if oy > 0 else -1, 0)))
            if abs(ox) >= th:
                cands.append((abs(ox), (0, 1 if ox > 0 else -1)))
            cands.sort(reverse=True)
            moved = False
            for _, (dy, dx) in cands:
                n = (p[0] + dy, p[1] + dx)
                if fits(h, w, n[0], n[1], occ):
                    p = n
                    visited.append(p)
                    moved = True
                    break
            if not moved:
                break
    return p, visited


def step_offset(v, start):
    if v <= start - 0.5 - HYST:
        return -1
    if v >= start + 0.5 + HYST:
        return 1
    return 0


def algo_adjacent(ps, i, events):
    """C: 隣接だけ。指のマスを不感帯つきで追い、駒はそのマスが隣（斜めは角経由）で空いているときだけ移る。"""
    h, w, r0, c0 = ps[i]
    occ = occupied(ps, i)
    p = (r0, c0)
    f = (r0, c0)
    visited = [p]
    prev = (r0, c0)
    for ty, tx in interpolate(events, (r0, c0)):
        nf = (f[0] + step_offset(ty, f[0]), f[1] + step_offset(tx, f[1]))
        # 盤の外の指は縁にあるとみなす（駒の左上が取れる範囲に収める）
        nf = (min(max(nf[0], 0), H - h), min(max(nf[1], 0), W - w))
        f = nf
        dy, dx = f[0] - p[0], f[1] - p[1]
        if (dy, dx) == (0, 0) or abs(dy) > 1 or abs(dx) > 1:
            prev = (ty, tx)
            continue
        if dy != 0 and dx != 0:
            horizontal_first = abs(tx - prev[1]) >= abs(ty - prev[0])
            corners = [(p[0], p[1] + dx), (p[0] + dy, p[1])]
            if not horizontal_first:
                corners.reverse()
            for cr in corners:
                if fits(h, w, cr[0], cr[1], occ) and fits(h, w, f[0], f[1], occ):
                    p = cr
                    visited.append(p)
                    p = f
                    visited.append(p)
                    break
            else:
                for cr in corners:
                    if fits(h, w, cr[0], cr[1], occ):
                        p = cr
                        visited.append(p)
                        break
        elif fits(h, w, f[0], f[1], occ):
            p = f
            visited.append(p)
        prev = (ty, tx)
    return p, visited


ALGOS = {"A_nearest": algo_nearest, "B_chase": algo_chase, "C_adjacent": algo_adjacent}


def smooth_polyline(points, rho):
    """角を半径 rho（マス）の2次曲線で丸める。指は角を内側へ切って曲がる。"""
    if len(points) < 3 or rho <= 0:
        return points
    out = [points[0]]
    for a, b, c in zip(points, points[1:], points[2:]):
        din = (b[0] - a[0], b[1] - a[1])
        dout = (c[0] - b[0], c[1] - b[1])
        if din == dout:
            out.append(b)
            continue
        p0 = (b[0] - din[0] * rho, b[1] - din[1] * rho)
        p2 = (b[0] + dout[0] * rho, b[1] + dout[1] * rho)
        for k in range(0, 9):
            t = k / 8
            out.append(
                (
                    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1],
                )
            )
    out.append(points[-1])
    return out


def resample(points, spacing):
    out = []
    acc = 0.0
    for a, b in zip(points, points[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if seg == 0:
            continue
        d = spacing - acc
        while d <= seg:
            t = d / seg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            d += spacing
        acc = seg - (d - spacing)
    out.append(points[-1])
    return out


def make_events(path, rng, spacing, sigma, end_sigma, rho):
    """駒の左上の道 path に沿った指の軌跡（押した点からのずれを、駒の左上の座標に足した値）。"""
    pts = [(float(y), float(x)) for y, x in path]
    pts = smooth_polyline(pts, rho)
    ev = resample(pts, spacing)
    noisy = [(y + rng.gauss(0, sigma), x + rng.gauss(0, sigma)) for y, x in ev[:-1]]
    ly, lx = ev[-1]
    noisy.append((ly + rng.gauss(0, end_sigma), lx + rng.gauss(0, end_sigma)))
    return noisy


def sample_cases(states, rng, n, kind):
    cases = []
    tries = 0
    while len(cases) < n and tries < n * 200:
        tries += 1
        ps = rng.choice(states)
        i = rng.randrange(len(ps))
        order, par = piece_reach(ps, i)
        r0, c0 = ps[i][2], ps[i][3]
        if kind == "intended":
            if len(order) < 2:
                continue
            dest = rng.choice(order[1:])
            cases.append((ps, i, path_to(par, dest), dest))
        elif kind == "blocked":
            h, w, _, _ = ps[i]
            occ = occupied(ps, i)
            dirs = [d for d in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not fits(h, w, r0 + d[0], c0 + d[1], occ)]
            # 塞がれた向きのうち、回り道ならその向きのマスへ行けるもの（見本が跳ぶ余地があるもの）を優先
            if not dirs or len(order) < 2:
                continue
            d = rng.choice(dirs)
            length = rng.uniform(0.6, 1.8)
            cases.append((ps, i, [(r0, c0), (r0 + d[0] * length, c0 + d[1] * length)], (r0, c0)))
        elif kind == "blocked_turn":
            # 塞がれた向きへ 1.2〜2.2 マス押し込み、そのまま直角に1マス曲がる指。意図はどちらとも取れる
            h, w, _, _ = ps[i]
            occ = occupied(ps, i)
            dirs = [d for d in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not fits(h, w, r0 + d[0], c0 + d[1], occ)]
            if not dirs or len(order) < 2:
                continue
            d = rng.choice(dirs)
            perp = rng.choice([(d[1], d[0]), (-d[1], -d[0])])
            length = rng.uniform(1.2, 2.2)
            a = (r0 + d[0] * length, c0 + d[1] * length)
            b = (a[0] + perp[0], a[1] + perp[1])
            cases.append((ps, i, [(r0, c0), a, b], (r0, c0)))
        elif kind == "diagonal":
            # 斜め隣へ、角を通らず真っすぐ斜めになぞる指。角のどちらかが空いていれば着くのを正とする
            reach = set(order)
            diag = [
                (r0 + dy, c0 + dx)
                for dy in (-1, 1)
                for dx in (-1, 1)
                if (r0 + dy, c0 + dx) in reach and ((r0 + dy, c0) in reach or (r0, c0 + dx) in reach)
            ]
            if not diag:
                continue
            dest = rng.choice(diag)
            cases.append((ps, i, [(r0, c0), dest], dest))
        elif kind == "tap":
            cases.append((ps, i, [(r0, c0), (r0, c0)], (r0, c0)))
    return cases


def simulate(states_by_puzzle, cell_px, seed, n_per):
    rng = random.Random(seed)
    states = [s for v in states_by_puzzle.values() for s in v]
    conds = [
        # (名前, 事象の間隔[マス], 手ぶれσ[px], 離す位置のσ[マス], 角を切る半径[マス])
        ("ゆっくり", 0.15, 3.0, 0.12, 0.3),
        ("ふつう", 0.35, 4.0, 0.15, 0.4),
        ("速い", 0.8, 6.0, 0.2, 0.45),
        ("荒い", 0.35, 8.0, 0.25, 0.5),
    ]
    result = {}
    intended = sample_cases(states, rng, n_per, "intended")
    blocked = sample_cases(states, rng, n_per, "blocked")
    taps = sample_cases(states, rng, n_per, "tap")
    blocked_turn = sample_cases(states, rng, n_per, "blocked_turn")
    diagonal = sample_cases(states, rng, n_per, "diagonal")
    for cname, spacing, sig_px, end_sig, rho in conds:
        sig = sig_px / cell_px
        res = {a: {"ok": 0, "wrong": 0, "none": 0, "ok_turn": 0, "n_turn": 0, "detour": 0} for a in ALGOS}
        for ps, i, path, dest in intended:
            ev = make_events(path, rng, spacing, sig, end_sig, rho)
            t = turns(path) > 0
            for a, f in ALGOS.items():
                final, _ = f(ps, i, ev)
                r = res[a]
                if final == dest:
                    r["ok"] += 1
                    r["ok_turn"] += t
                elif final == (ps[i][2], ps[i][3]):
                    r["none"] += 1
                else:
                    r["wrong"] += 1
                r["n_turn"] += t
        for ps, i, path, _ in blocked:
            ev = make_events(path, rng, spacing, sig, end_sig, 0)
            for a, f in ALGOS.items():
                final, _ = f(ps, i, ev)
                if final != (ps[i][2], ps[i][3]):
                    res[a]["detour"] += 1
        bt = {a: {"moved": 0, "cells": 0, "far": 0} for a in ALGOS}
        for ps, i, path, _ in blocked_turn:
            ev = make_events(path, rng, spacing, sig, end_sig, rho)
            start = (ps[i][2], ps[i][3])
            for a, f in ALGOS.items():
                final, visited = f(ps, i, ev)
                if final != start:
                    bt[a]["moved"] += 1
                    bt[a]["cells"] += len(visited) - 1
                    # 指の終点（押し込みを除いた直角の1マス）より遠くへ行ったもの
                    if abs(final[0] - start[0]) + abs(final[1] - start[1]) >= 2:
                        bt[a]["far"] += 1
        dg = {a: 0 for a in ALGOS}
        for ps, i, path, dest in diagonal:
            ev = make_events(path, rng, spacing, sig, end_sig, 0)
            for a, f in ALGOS.items():
                final, _ = f(ps, i, ev)
                if final == dest:
                    dg[a] += 1
        a_jump = []
        for ps, i, path, _ in blocked:
            ev = make_events(path, rng, spacing, sig, end_sig, 0)
            final, _ = algo_nearest(ps, i, ev)
            if final != (ps[i][2], ps[i][3]):
                _, par = piece_reach(ps, i)
                a_jump.append(len(path_to(par, final)) - 1)
        tap_moves = {a: 0 for a in ALGOS}
        for ps, i, path, _ in taps:
            ev = [(ps[i][2] + rng.gauss(0, 4 / cell_px), ps[i][3] + rng.gauss(0, 4 / cell_px)) for _ in range(5)]
            for a, f in ALGOS.items():
                final, _ = f(ps, i, ev)
                if final != (ps[i][2], ps[i][3]):
                    tap_moves[a] += 1
        result[cname] = {
            "cond": {"event_spacing_cell": spacing, "jitter_px": sig_px, "release_sigma_cell": end_sig, "corner_cut_cell": rho},
            "intended_n": len(intended),
            "blocked_n": len(blocked),
            "tap_n": len(taps),
            "blocked_turn_n": len(blocked_turn),
            "diagonal_n": len(diagonal),
            "A_blocked_jump_path_cells": {str(k): a_jump.count(k) for k in sorted(set(a_jump))},
            "algos": {
                a: {
                    "ok_rate": round(r["ok"] / len(intended), 4),
                    "wrong_rate": round(r["wrong"] / len(intended), 4),
                    "none_rate": round(r["none"] / len(intended), 4),
                    "ok_rate_turning": round(r["ok_turn"] / max(1, r["n_turn"]), 4),
                    "turning_n": r["n_turn"],
                    "blocked_moved_rate": round(r["detour"] / len(blocked), 4),
                    "tap_moved_rate": round(tap_moves[a] / len(taps), 4),
                    "blocked_turn_moved_rate": round(bt[a]["moved"] / len(blocked_turn), 4),
                    "blocked_turn_far_rate": round(bt[a]["far"] / len(blocked_turn), 4),
                    "diagonal_ok_rate": round(dg[a] / len(diagonal), 4),
                }
                for a, r in res.items()
            },
        }
    return result


# ---------------------------------------------------------------- 4. 押し間違い


def misgrab(states, cell_px, seed, n, sigmas_px):
    """狙った駒の内側（縁からマス幅の inset 内側）を一様に狙い、着地を正規分布でずらす。別の駒・空きに落ちる割合。"""
    rng = random.Random(seed)
    out = {}
    for inset in (0.15, 0.3):
        for s in sigmas_px:
            other = empty = outside = 0
            for _ in range(n):
                ps = rng.choice(states)
                i = rng.randrange(len(ps))
                h, w, r, c = ps[i]
                ay = r + inset + rng.random() * (h - 2 * inset)
                ax = c + inset + rng.random() * (w - 2 * inset)
                ly = ay + rng.gauss(0, s / cell_px)
                lx = ax + rng.gauss(0, s / cell_px)
                cy, cx = math.floor(ly), math.floor(lx)
                if not (0 <= cy < H and 0 <= cx < W):
                    outside += 1
                    continue
                hit = None
                for k, (hh, ww, rr, cc) in enumerate(ps):
                    if rr <= cy < rr + hh and cc <= cx < cc + ww:
                        hit = k
                if hit is None:
                    empty += 1
                elif hit != i:
                    other += 1
            out[f"inset{inset}/sigma{s}px"] = {
                "other_piece": round(other / n, 4),
                "empty": round(empty / n, 4),
                "outside": round(outside / n, 4),
            }
    return out


def expected(seeds=(1, 2, 3), n=500, vectors=8):
    """採った案（C: 隣接だけ）の seed ごとの結果と、移植の確かめに使う具体的な入力と出力。"""
    states = {name: bfs_all(parse(rows))[0] for name, rows in PUZZLES.items()}
    out = {"algo": "C_adjacent", "hysteresis": HYST, "trace_step": TRACE_STEP, "seeds": {}, "vectors": []}
    for sd in seeds:
        sim = simulate(states, 60, sd, n)["ふつう"]
        out["seeds"][str(sd)] = {"cond": sim["cond"], "n": sim["intended_n"], **sim["algos"]["C_adjacent"]}
    rng = random.Random(seeds[0])
    allst = [x for v in states.values() for x in v]
    kinds = ["intended", "blocked", "blocked_turn", "diagonal"]
    for k in range(vectors):
        kind = kinds[k % len(kinds)]
        ps, i, path, _ = sample_cases(allst, rng, 1, kind)[0]
        ev = make_events(path, rng, 0.35, 4.0 / 60, 0.15, 0.4 if kind != "blocked" else 0)
        ev = [(round(y, 3), round(x, 3)) for y, x in ev]
        final, visited = algo_adjacent(ps, i, ev)
        out["vectors"].append(
            {
                "kind": kind,
                "board": shape_key(ps),
                "pieces": [list(p) for p in ps],
                "piece": i,
                "events_anchor_rc": [list(e) for e in ev],
                "final": list(final),
                "visited": [list(v) for v in visited],
            }
        )
    return out


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--expected":
        print(json.dumps(expected(), ensure_ascii=False, indent=1))
        return
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 20261104
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
    states = {}
    for name, rows in PUZZLES.items():
        allst, _ = bfs_all(parse(rows))
        states[name] = allst
    report = {
        "seed": seed,
        "n_per_kind": n,
        "state_counts": {k: len(v) for k, v in states.items()},
        "layout": layout(),
        "solution_shapes": solution_shapes(),
    }
    sims = {}
    for cell_px in (60, 75):
        sims[f"cell{cell_px}px"] = simulate(states, cell_px, seed, n)
    report["simulate"] = sims
    allst = [s for v in states.values() for s in v]
    report["misgrab_cell60px"] = misgrab(allst, 60, seed, n * 5, (4, 8, 12))
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
