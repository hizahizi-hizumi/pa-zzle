#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）の難易度の調査コード。

/add-puzzle の調査の「難易度」の観点で、つまみの案を比べるために使った。
標準ライブラリだけで書き、乱数は seed を固定する。製品のコードはこのファイルに依存しない。

サブコマンド（使い方は docs/パズル/導入調査/魔方陣/魔方陣難易度.md の付録 A）:
  enum4       4×4 の魔方陣を全部数える
  identities  列の式の和で決まる、列ではないマスの組（仮想の列）を探す
  corpus      候補を作り、読むモデル・素朴な解き方・変種で測って JSONL に書く
  report      corpus の結果から、案ごとの表を出す（読むモデルの特徴は与える数から測り直す）
  sizes       盤面の大きさごとの値（収率・生成時間・一意性の確かめの重さ）を出す
  classify    候補ごとのレベルと特徴を JSONL に書く（問題供給・図鑑の観点の入口）
  expected    採った案の、seed ごとの結果を移植の期待値（JSON）に書く
  agree       読み方の部品の組み合わせでの一致を確かめ、書き置き（--cache）に足す（重いので先に分けて走らせる）

採った案は版 5 の C2（PROPOSALS["C2"]。レベルは classify_v5、1つの読み方でのレベルは level_v4_raw と
single_level_v4、盤面の割り当ては SIZES_C2、一致を求める読み方の部品は AGREE、その組み合わせは AGREE_COMBOS）。
比較した案の境目は、比較実験の条件として置いた値。版 4 の分類（classify_v4・AGREE_V4）と版 3 までの分類
（reading_level・out_of_range_reason）は、案の比較のために残している。
読むモデルの定義（読む単位・巡・段・1巡に入る読み）は「読むモデル」の節の注釈、変種は VARIANTS と A3_GROUPS。
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import random
import statistics
import sys
import time
from fractions import Fraction

# ---------------------------------------------------------------------------
# 盤面の形
# ---------------------------------------------------------------------------


class Geometry:
    """n×n の盤面。マスは行優先の番号 0..n²-1、数は 1..n²。"""

    def __init__(self, n: int):
        self.n = n
        self.N = n * n
        self.M = n * (n * n + 1) // 2
        rows = [tuple(r * n + c for c in range(n)) for r in range(n)]
        cols = [tuple(r * n + c for r in range(n)) for c in range(n)]
        diag = tuple(i * n + i for i in range(n))
        anti = tuple(i * n + (n - 1 - i) for i in range(n))
        self.lines: list[tuple[int, ...]] = rows + cols + [diag, anti]
        self.line_names = [f"r{r}" for r in range(n)] + [f"c{c}" for c in range(n)] + ["d", "a"]
        self.cell_lines = [[li for li, L in enumerate(self.lines) if c in L] for c in range(self.N)]
        self.full = 0
        for v in range(1, self.N + 1):
            self.full |= 1 << v

    def range_mask(self, lo: int, hi: int) -> int:
        lo = max(lo, 1)
        hi = min(hi, self.N)
        if lo > hi:
            return 0
        return ((1 << (hi + 1)) - 1) ^ ((1 << lo) - 1)

    def symmetries(self) -> list[list[int]]:
        """回転と裏返しの8通り。perm[c] = 写した先のマス。"""
        n = self.n
        out = []
        for k in range(8):
            perm = []
            for c in range(self.N):
                r, q = divmod(c, n)
                for _ in range(k % 4):
                    r, q = q, n - 1 - r
                if k >= 4:
                    q = n - 1 - q
                perm.append(r * n + q)
            out.append(perm)
        return out


GEOS: dict[int, Geometry] = {}


def geo_of(n: int) -> Geometry:
    if n not in GEOS:
        GEOS[n] = Geometry(n)
    return GEOS[n]


def bits(m: int):
    while m:
        low = m & -m
        yield low.bit_length() - 1
        m ^= low


def popcount(m: int) -> int:
    return m.bit_count()


def lowest(m: int) -> int:
    return (m & -m).bit_length() - 1


# ---------------------------------------------------------------------------
# 完全な解法器（解の数を上限まで数える）
# ---------------------------------------------------------------------------


def line_allowed_masks(geo: Geometry, grid: list[int], unused: int) -> list[int] | None:
    """列ごとに、空きの1マスに入りうる数の範囲（緩めた上下限）。成り立たない列があれば None。"""
    vals = sorted(bits(unused))
    pre = [0]
    for v in vals:
        pre.append(pre[-1] + v)
    suf = [0]
    for v in reversed(vals):
        suf.append(suf[-1] + v)
    out = []
    M = geo.M
    for L in geo.lines:
        s = 0
        k = 0
        for c in L:
            v = grid[c]
            if v:
                s += v
            else:
                k += 1
        r = M - s
        if k == 0:
            if r != 0:
                return None
            out.append(0)
            continue
        if k > len(vals):
            return None
        if r < pre[k] or r > suf[k]:
            return None
        if k == 1:
            if 1 <= r <= geo.N and (unused >> r) & 1:
                out.append(1 << r)
            else:
                return None
        else:
            lo = r - suf[k - 1]
            hi = r - pre[k - 1]
            out.append(geo.range_mask(lo, hi))
    return out


def count_solutions(geo: Geometry, grid0: list[int], limit: int = 2, node_cap: int | None = None,
                    rng: random.Random | None = None, collect: bool = False):
    """解の数（limit で止める）と探索した節点の数。node_cap に達したら capped=True。

    探索: 各節点で、列ごとの上下限から全空きマスの候補を作り、候補の最も少ないマスを分ける。
    rng を渡すと、分ける数の順を乱数で並べ替える（乱択の魔方陣を作るときに使う）。
    """
    grid = list(grid0)
    used = 0
    for v in grid:
        if v:
            if (used >> v) & 1:
                return {"count": 0, "nodes": 0, "capped": False, "solutions": []}
            used |= 1 << v
    unused = geo.full & ~used
    state = {"count": 0, "nodes": 0, "capped": False, "solutions": []}

    def rec(unused: int):
        if state["count"] >= limit or state["capped"]:
            return
        state["nodes"] += 1
        if node_cap is not None and state["nodes"] > node_cap:
            state["capped"] = True
            return
        allowed = line_allowed_masks(geo, grid, unused)
        if allowed is None:
            return
        best = -1
        best_mask = 0
        best_cnt = 10 ** 9
        for c in range(geo.N):
            if grid[c]:
                continue
            m = unused
            for li in geo.cell_lines[c]:
                m &= allowed[li]
            cnt = popcount(m)
            if cnt < best_cnt:
                best_cnt = cnt
                best = c
                best_mask = m
                if cnt == 0:
                    return
        if best < 0:
            state["count"] += 1
            if collect:
                state["solutions"].append(list(grid))
            return
        vs = list(bits(best_mask))
        if rng is not None:
            rng.shuffle(vs)
        for v in vs:
            grid[best] = v
            rec(unused & ~(1 << v))
            grid[best] = 0
            if state["count"] >= limit or state["capped"]:
                return

    rec(unused)
    return state


def random_magic_square(n: int, rng: random.Random, node_cap: int = 200000) -> tuple[list[int], int]:
    """乱択の深さ優先探索で魔方陣を1つ作る。打ち切ったらやり直す。(盤面, 使った節点の合計)"""
    geo = geo_of(n)
    total = 0
    while True:
        st = count_solutions(geo, [0] * geo.N, limit=1, node_cap=node_cap, rng=rng, collect=True)
        total += st["nodes"]
        if st["solutions"]:
            return st["solutions"][0], total


def is_magic(geo: Geometry, grid: list[int]) -> bool:
    if sorted(grid) != list(range(1, geo.N + 1)):
        return False
    return all(sum(grid[c] for c in L) == geo.M for L in geo.lines)


def canonical_key(geo: Geometry, grid: list[int]) -> tuple[int, ...]:
    return min(tuple(grid[p.index(c)] for c in range(geo.N)) for p in geo.symmetries())




# ---------------------------------------------------------------------------
# 読むモデル（人間向けの解法器）
# ---------------------------------------------------------------------------
#
# 盤面に見えるのは置いた数・列ごとの今の合計（と合計の定数）・候補のメモ。列の残り r は引き算で分かる。
# 読む単位（unit）は次の2つ。どちらも「その単位の空きマスに、残っている数（メモの候補）を互いに違うように入れて
# 式を満たす入れ方」を全部考える。
#   - 列: 空きが e マスの列（段 e）
#   - 鎖: 空きが2マスの列が同じマスでつながったまとまり（2本以上、つながった全部）。1つのマスの数を決めると、
#         つながった列の相手が順に決まる。段2
# 単位を読んだ結果は2つで、どちらもその巡の結果に入る。
#   - 台: 単位の各マスの候補を、どれかの入れ方で入る数に絞る
#   - 組の数を他で使わない: どの入れ方でも単位の中で使う数を、その巡に読んだ単位のマスのうち単位の外のマスの
#     候補から消す（段2以上。lock_scope="units"。単位の外の全マスから消すのは変種 lock_all）
# 1巡 = 段 t 以下の単位を全部、巡の始めの候補（同じ写し）から読み、結果を全部重ねること。重ねた候補で、
# 候補が1つのマスと、入る所が1マスだけになった数（この数はここだけ）を、その巡で決まったマスとする。
# k 巡目は k−1 巡目までの結果だけを使うので、巡の数は「1マスを置くのに要る読みの依存の段数」の最小になる
# （読む順に依らない）。単位を順に読んで結果をすぐ使う数え方（sync=False）は走査の回数で、別の量。
# 行き詰まり（段1で置けない所）では、段2・段3・段4の順に、どの段も行き詰まりの始めの候補から読み直し、
# 決まったマスが出るまでの巡を数える（count="fresh"）。置ける最も低い段を使う。段3の巡には、段3に要る段2の読みの
# 巡も入る。下の段を出し切った候補から続ける数え方（carry・cum）は変種で、版 4 の分類は段3の巡をレベルの条件に
# 使わず、上限（DEPTH_CAP）にだけ使う。
# 段1 = 空き1マスの列・メモで候補が1つのマス・この数はここだけ（組の数を他で使わないは段2から）。
# 1巡で決まったマスは全部置く。候補のメモがある前提で、置いた後も絞った候補を残す（memory=True）。
# 基準はメモの数に上限を置かない（頭で覚える分も使う）。ゲームのメモは1マス4つまでなので、候補が5つ以上のマスを
# 巡の間で覚えない人（memo_max=4、変種 memo4）を一致を求める部品に入れる。
# 入口（entry）は最初の盤面の段1の1巡で決まるマスの数で、置き方（batch）に依らない。


class LineReadCap(Exception):
    pass


def enumerate_line(masks: list[int], r: int, N: int, cap: int):
    """列の空きマスの候補 masks と残り r から、(台, 必ず使う数, 数の組の数, 入れ方の数)。
    入れ方が無ければ台は全部 0。cap を超える節点を使ったら LineReadCap。"""
    e = len(masks)
    sup = [0] * e
    sets: set[int] = set()
    count = 0
    if e == 1:
        if 1 <= r <= N and (masks[0] >> r) & 1:
            return [1 << r], 1 << r, 1, 1
        return [0], 0, 0, 0
    if e == 2:
        A, B = masks
        req = -1
        for v in bits(A):
            w = r - v
            if w != v and 1 <= w <= N and (B >> w) & 1:
                sup[0] |= 1 << v
                sup[1] |= 1 << w
                s = (1 << v) | (1 << w)
                sets.add(s)
                req &= s
                count += 1
        return sup, (req if count else 0), len(sets), count
    if e == 3:
        A, B, C = masks
        req = -1
        for v in bits(A):
            for w in bits(B & ~(1 << v)):
                x = r - v - w
                if x != v and x != w and 1 <= x <= N and (C >> x) & 1:
                    sup[0] |= 1 << v
                    sup[1] |= 1 << w
                    sup[2] |= 1 << x
                    s = (1 << v) | (1 << w) | (1 << x)
                    sets.add(s)
                    req &= s
                    count += 1
        return sup, (req if count else 0), len(sets), count
    # 4マス以上: 候補の少ないマスから深さ優先。和の上下限で枝を切る。
    order = sorted(range(e), key=lambda i: popcount(masks[i]))
    om = [masks[i] for i in order]
    osup = [0] * e
    req = [-1]
    nodes = [0]
    cnt = [0]
    chosen = [0] * e

    def rec(i: int, rem: int, used: int):
        nodes[0] += 1
        if nodes[0] > cap:
            raise LineReadCap
        if i == e - 1:
            if 1 <= rem <= N and not (used >> rem) & 1 and (om[i] >> rem) & 1:
                chosen[i] = rem
                s = used | (1 << rem)
                for j in range(e):
                    osup[j] |= 1 << chosen[j]
                sets.add(s)
                req[0] &= s
                cnt[0] += 1
            return
        k = e - i - 1  # この後のマスの数
        rest = 0
        for j in range(i + 1, e):
            rest |= om[j]
        rest &= ~used
        rv = sorted(bits(rest))
        if len(rv) < k:
            return
        lo_rest = sum(rv[:k])
        hi_rest = sum(rv[-k:])
        for v in bits(om[i] & ~used):
            left = rem - v
            if left < lo_rest:
                break
            if left > hi_rest:
                continue
            chosen[i] = v
            rec(i + 1, left, used | (1 << v))

    rec(0, r, 0)
    for idx, i in enumerate(order):
        sup[i] = osup[idx]
    return sup, (req[0] if cnt[0] else 0), len(sets), cnt[0]


def enumerate_eqs(cells: list[int], eqs: list[tuple[tuple[int, ...], tuple[int, ...], int]],
                  cand: dict[int, int], N: int, cap: int):
    """一般の単位（式がいくつか）の入れ方を全部考える。eqs は (マス, 係数, 右辺)。
    返り値は enumerate_line と同じ形（台はマスの並び順）。値は単位の中で互いに違う数。"""
    e = len(cells)
    pos = {c: i for i, c in enumerate(cells)}
    es = [([pos[c] for c in cc], list(co), r) for cc, co, r in eqs]
    # 並べ方: 候補の最も少ないマスから始め、決まったマスと同じ式に多く入るマスを次にする
    order: list[int] = []
    left = set(range(e))
    first = min(left, key=lambda i: popcount(cand[cells[i]]))
    order.append(first)
    left.discard(first)
    while left:
        def score(i):
            k = 0
            for vs, co, r in es:
                if i in vs:
                    k += sum(1 for v in vs if v in order)
            return (-k, popcount(cand[cells[i]]))
        nxt = min(left, key=score)
        order.append(nxt)
        left.discard(nxt)
    rank = {i: k for k, i in enumerate(order)}
    by_last: dict[int, list[int]] = {}
    for j, (vs, co, r) in enumerate(es):
        by_last.setdefault(max(rank[v] for v in vs), []).append(j)
    val = [0] * e
    sup = [0] * e
    sets: set[int] = set()
    req = [-1]
    cnt = [0]
    nodes = [0]

    def rec(k: int, used: int):
        nodes[0] += 1
        if nodes[0] > cap:
            raise LineReadCap
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
        m = cand[cells[i]] & ~used
        if forced is not None:
            opts = [forced] if 1 <= forced <= N and (m >> forced) & 1 else []
        else:
            opts = list(bits(m))
        for x in opts:
            val[i] = x
            ok = True
            for j in by_last.get(k, []):
                vs, co, r = es[j]
                if sum(c * val[v] for v, c in zip(vs, co)) != r:
                    ok = False
                    break
            if ok:
                rec(k + 1, used | (1 << x))

    rec(0, 0)
    return sup, (req[0] if cnt[0] else 0), len(sets), cnt[0]


def _line_states(geo: Geometry, grid: list[int], lines):
    out = []
    for li, (L, S) in enumerate(lines):
        s = 0
        em = []
        for c in L:
            v = grid[c]
            if v:
                s += v
            else:
                em.append(c)
        out.append((li, tuple(em), S - s))
    return out


def line_units(geo: Geometry, grid: list[int], lines) -> list[dict]:
    out = []
    for li, em, r in _line_states(geo, grid, lines):
        if em:
            out.append({"kind": "line", "cells": list(em), "eqs": [(em, (1,) * len(em), r)], "tier": len(em),
                        "key": ("L", li), "lines": 1})
    return out


def _connected_subsets(comp: list[int], adj: dict[int, set[int]], k: int) -> list[tuple[int, ...]]:
    """comp の中で、つながった k 本の組を全部。"""
    out: set[tuple[int, ...]] = set()

    def grow(cur: frozenset):
        if len(cur) == k:
            out.add(tuple(sorted(cur)))
            return
        frontier = set()
        for x in cur:
            frontier |= adj[x]
        for y in frontier - cur:
            if y > min(cur):
                grow(cur | {y})
    for s in comp:
        grow(frozenset([s]))
    return sorted(out)


def chain_units(geo: Geometry, grid: list[int], lines, limit: int = 0) -> list[dict]:
    """空きが2マスの列が同じマスでつながったまとまり（2本以上）。
    limit>0 なら、limit 本より長い鎖は、つながった limit 本ずつに分けて読む（A3/A4 の変種）。"""
    two = [(li, em, r) for li, em, r in _line_states(geo, grid, lines) if len(em) == 2]
    parent = list(range(len(two)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i in range(len(two)):
        for j in range(i + 1, len(two)):
            if set(two[i][1]) & set(two[j][1]):
                parent[find(i)] = find(j)
    comps: dict[int, list[int]] = {}
    for i in range(len(two)):
        comps.setdefault(find(i), []).append(i)
    out = []
    for comp in comps.values():
        if len(comp) < 2:
            continue
        parts = [tuple(comp)]
        if limit and len(comp) > limit:
            adj = {i: {j for j in comp if j != i and set(two[i][1]) & set(two[j][1])} for i in comp}
            parts = _connected_subsets(comp, adj, limit)
        for part in parts:
            eqs = [(two[i][1], (1, 1), two[i][2]) for i in part]
            cells = sorted({c for i in part for c in two[i][1]})
            out.append({"kind": "chain", "cells": cells, "eqs": eqs, "tier": 2,
                        "key": ("K",) + tuple(sorted(two[i][0] for i in part)), "lines": len(part)})
    return out


def joint_units(geo: Geometry, grid: list[int], lines, max_union: int = 3) -> list[dict]:
    """交わる2本の列を一緒に読む単位（空きの和集合が max_union 以下、どちらも空き2以上）。A3/A4 の変種。"""
    st = _line_states(geo, grid, lines)
    out = []
    for a in range(len(st)):
        for b in range(a + 1, len(st)):
            la, ea, ra = st[a]
            lb, eb, rb = st[b]
            if len(ea) < 2 or len(eb) < 2 or not set(ea) & set(eb):
                continue
            U = sorted(set(ea) | set(eb))
            if len(U) > max_union:
                continue
            out.append({"kind": "joint", "cells": U, "eqs": [(ea, (1,) * len(ea), ra), (eb, (1,) * len(eb), rb)],
                        "tier": max(len(ea), len(eb)), "key": ("J", la, lb), "lines": 2})
    return out


def combo_units(geo: Geometry, grid: list[int], lines, k: int = 2, max_unknowns: int = 3) -> list[dict]:
    """列を k 本まで ±1 で足し引きした式のうち、空きが max_unknowns 以下で係数が ±1 のもの。A3/A4 の変種。
    空き1マスの列は使わない（段1を続けて読むのと同じ）。"""
    st = [(li, {c: 1 for c in em}, r) for li, em, r in _line_states(geo, grid, lines) if len(em) >= 2]
    out = []
    seen = set()
    for kk in range(2, k + 1):
        for comb in itertools.combinations(range(len(st)), kk):
            for signs in itertools.product((1, -1), repeat=kk - 1):
                sg = (1,) + signs
                co: dict[int, int] = {}
                rhs = 0
                for idx, sgn in zip(comb, sg):
                    li, d, r = st[idx]
                    rhs += sgn * r
                    for c, a_ in d.items():
                        co[c] = co.get(c, 0) + sgn * a_
                co = {c: a_ for c, a_ in co.items() if a_}
                if not co or len(co) > max_unknowns or max(abs(a_) for a_ in co.values()) > 1:
                    continue
                cells = sorted(co)
                coefs = tuple(co[c] for c in cells)
                if coefs[0] < 0:
                    coefs = tuple(-a_ for a_ in coefs)
                    rhs = -rhs
                key = (tuple(cells), coefs, rhs)
                if key in seen:
                    continue
                seen.add(key)
                out.append({"kind": "combo", "cells": cells, "eqs": [(tuple(cells), coefs, rhs)],
                            "tier": len(cells), "key": ("C",) + key, "lines": kk})
    return out


def lin_units(geo: Geometry, grid: list[int], lines) -> list[dict]:
    """列の式の一次結合で値が決まる空きマス（段1として読む）。A3/A4 の変種。"""
    em = [c for c in range(geo.N) if not grid[c]]
    if not em:
        return []
    col = {c: i for i, c in enumerate(em)}
    rows = []
    for li, ec, r in _line_states(geo, grid, lines):
        row = [Fraction(0)] * (len(em) + 1)
        for c in ec:
            row[col[c]] = Fraction(1)
        row[-1] = Fraction(r)
        rows.append(row)
    piv = []
    ri = 0
    ne = len(em)
    for j in range(ne):
        sel = next((i for i in range(ri, len(rows)) if rows[i][j] != 0), None)
        if sel is None:
            continue
        rows[ri], rows[sel] = rows[sel], rows[ri]
        pv = rows[ri][j]
        rows[ri] = [x / pv for x in rows[ri]]
        for i in range(len(rows)):
            if i != ri and rows[i][j] != 0:
                f = rows[i][j]
                rows[i] = [a_ - f * b_ for a_, b_ in zip(rows[i], rows[ri])]
        piv.append(j)
        ri += 1
    out = []
    for i, j in enumerate(piv):
        r = rows[i]
        if all(r[k2] == 0 for k2 in range(ne) if k2 != j) and r[-1].denominator == 1:
            c = em[j]
            out.append({"kind": "lin", "cells": [c], "eqs": [((c,), (1,), int(r[-1]))], "tier": 1,
                        "key": ("LIN", c), "lines": 0})
    return out


DEFAULT_READ = {
    "max_tier": 4,          # 読む列の空きの上限（4 は 4マス以上も読む）
    "memory": True,         # 置いた後も絞った候補を残すか（候補のメモがある前提で True）
    "sync": True,           # 全ての単位を同じ写しから同時に読むか（False は単位の順に読み、すぐ反映。A3 の変種）
    "order_seed": None,     # sync=False のとき単位を読む順を乱数で並べ替える seed（None は作った順、-1 は逆順）
    "count": "fresh",       # 段を上げた所の巡: fresh（行き詰まりの始めから）/ carry / cum（A3 の変種）
    "chains": True,         # 空き2マスの列の鎖を読む単位に入れるか
    "chain_limit": 0,       # >0 なら、鎖をつながった chain_limit 本ずつに分けて読む（A3/A4 の変種）
    "tier_choice": "lowest",  # 行き詰まりで使う段: lowest は置ける最も低い段、fewest は巡の最も少ない段（A3 の変種）
    "joint": 0,             # >0 なら交わる2本の列を一緒に読む単位を足す（空きの和集合の上限。A3/A4 の変種）
    "combo": 0,             # >0 なら列を combo 本まで ±1 で足し引きした式を足す（空き3以下。A3/A4 の変種）
    "lin": False,           # 列の式の一次結合で決まるマスを段1で読む（A3/A4 の変種）
    "hidden_min_tier": 1,   # 「この数はここだけ」を使う最も低い段
    "lock_min_tier": 2,     # 「組の数を他で使わない」を使う最も低い段
    "extra_lines": None,    # 仮想の列 [(マスの組, 合計)]。D3 の近道の測定に使う
    "enum_cap": 200000,     # 4マス以上の列・一般の単位を読むときの節点の上限（計算を止めるためのもの）
    "long_sets": 0,         # >0 なら、段2以上で、組が long_sets 通り以下の4マス以上の列も読む（A3/A4 の変種）
    "batch": True,          # 1巡で決まったマスを全部置くか（False は番号の最も小さい1マスだけ置く。A3 の変種）
    "lock_next": False,     # True なら「組の数を他で使わない」で消す数を次の巡から効かせる（A3 の変種）
    "hidden_next": False,   # True なら「この数はここだけ」を巡の始めの候補で見る（次の巡から効く。A3 の変種）
    "hidden": True,         # 「この数はここだけ」を使うか
    "chain_lock": True,     # 鎖から「組の数を他で使わない」を使うか
    "lock_scope": "units",  # 組の数を他で使わないで消すマス: units（その巡に読んだ単位のマスだけ）/ all（単位の外の全マス）
    "lock_ephemeral": False,  # True なら組の数を他で使わないで消した数をメモに残さない（その巡の判定にだけ使う）
    "bounds": None,         # 列の上下限を読む: None / range（長い列の上下限）/ viol（違反の知らせで分かる上限）
    "bounds_tier": 2,       # 上下限を使う最も低い段
    "bounds_long": False,   # True なら上下限は、その段で単位として読まない列（空き > 段）からだけ
    "short3_sets": 0,       # >0 なら段2で、組が short3_sets 通り以下の空き3の列も読む
    "jointk": 0,            # >0 なら空き2〜3の列のつながった jointk 本までの組（空き3の列を含む）を段3で一緒に読む
    "jointk_dof": 99,       # jointk の組のうち、自由度（マスの数 − 式の数）がこれ以下のものだけ
    "jointk_tier": 3,       # jointk の組の段（2 は段の付け方の別案）
    "memo_max": None,       # メモに書けるのは候補が memo_max 個以下のマスだけ（それより多いマスは巡の間で全部の数に戻る）
    "memo_hull": False,     # memo_max を超えるマスは、候補の最小〜最大の範囲だけ覚える（A4 の3回目の向き）
    "chain_tier3_from": 0,  # >0 なら、列が chain_tier3_from 本以上の鎖を段3に数える
    "diag_chain": True,     # 斜めの列を鎖（と jointk の組）につなぐか
    # --- 確かめ役（A4 の4回目）の向き ---
    "esc": None,            # hi: 段2の1巡で置けなければ段3へ上げ、所は段3と数える / lo: 巡ごとに段2で置けるかを先に見る
    "sets_cap": 0,          # >0 なら、組が sets_cap 通りより多い段2の単位（空き2の列・鎖）は読まない
    "sets_cap_all": False,  # True なら空き2以上の全部の単位に sets_cap を当てる
    "lock_unique": False,   # 組の数を他で使わないを、組が1通りの単位からだけ
    "memo_excl": False,     # memo_max を超えるマスでも、消した数が memo_max 個以下なら覚える
    "chain_late": False,    # 段2以上の各段の1巡目は鎖を読まない（列を1本ずつ読んでから鎖をつなぐ）
    "short_joint_sets": 0,  # >0 なら段2で、組が short_joint_sets 通り以下の jointk の組も読む
    "pair1": False,         # True なら段1で、組が1通りの空き2の列も読む（49 = 24 + 25 のような列）
    "pair1_lock": True,     # pair1 の列から段1でも組の数を他で使わない
    "pair1_raw": False,     # True なら組が1通りかを、メモでなく残っている数だけで見る
    "pair1_umax": 0,        # >0 なら残っている数がこれ以下のときだけ pair1
    "pair1_one": False,     # True なら段1を1巡だけ読む（pair1 の読みを段1の中で重ねない）
    "pair1_ext": False,     # True なら組が残っている数の大きい2つか小さい2つのときだけ pair1
    "memo_line_max": 0,     # >0 なら、メモを残すのは空きが memo_line_max 以下の列にあるマスだけ（ほかは巡の間で全部の数に戻る）
    "mrange": 0,            # >0 なら、この段から、メモの最小・最大で列の上下限を取る（ほかのマスのメモの最大の和・最小の和）
    "mrange_e": 3,          # mrange を当てる列の空きの下限
}


def jointk_units(geo: Geometry, grid: list[int], lines, k: int, max_dof: int = 99, tier: int = 3) -> list[dict]:
    """空き2〜3の列のつながった2〜k本の組（空き3の列を含むもの）を一緒に読む単位。段3。A3/A4 の変種。"""
    st = [(li, em, r) for li, em, r in _line_states(geo, grid, lines) if 2 <= len(em) <= 3]
    idx = list(range(len(st)))
    adj = {i: {j for j in idx if j != i and set(st[i][1]) & set(st[j][1])} for i in idx}
    out = []
    seen: set[tuple[int, ...]] = set()
    for kk in range(2, k + 1):
        for sub in _connected_subsets(idx, adj, kk):
            if all(len(st[i][1]) == 2 for i in sub) or sub in seen:
                continue
            seen.add(sub)
            eqs = [(st[i][1], (1,) * len(st[i][1]), st[i][2]) for i in sub]
            cells = sorted({c for i in sub for c in st[i][1]})
            if len(cells) - len(eqs) > max_dof:
                continue
            out.append({"kind": "joint", "cells": cells, "eqs": eqs, "tier": tier,
                        "key": ("JK",) + tuple(sorted(st[i][0] for i in sub)), "lines": kk})
    return out


def build_units(geo: Geometry, grid: list[int], opt: dict, lines) -> list[dict]:
    units = line_units(geo, grid, lines)
    # 鎖と jointk の組をつなぐ列。diag_chain=False なら斜めの2本（geo.lines の 2n・2n+1 番目）を外す
    clines = lines if opt["diag_chain"] else [L for i, L in enumerate(lines) if i not in (2 * geo.n, 2 * geo.n + 1)]
    if opt["chains"]:
        ch = chain_units(geo, grid, clines, opt["chain_limit"])
        if opt["chain_tier3_from"]:
            for u in ch:
                if u["lines"] >= opt["chain_tier3_from"]:
                    u["tier"] = 3
        units += ch
    if opt["joint"]:
        units += joint_units(geo, grid, lines, opt["joint"])
    if opt["combo"]:
        units += combo_units(geo, grid, lines, opt["combo"])
    if opt["jointk"]:
        units += jointk_units(geo, grid, clines, opt["jointk"], opt["jointk_dof"], opt["jointk_tier"])
    if opt["lin"]:
        have = {u["cells"][0] for u in units if u["tier"] == 1}
        units += [u for u in lin_units(geo, grid, lines) if u["cells"][0] not in have]
    if not opt["sync"]:
        if opt["order_seed"] == -1:
            units = units[::-1]
        elif opt["order_seed"] is not None:
            r = random.Random(opt["order_seed"])
            r.shuffle(units)
    return units


def read_unit(u: dict, src: dict[int, int], N: int, cap: int):
    if u["kind"] == "line":
        cells = u["cells"]
        return enumerate_line([src[c] for c in cells], u["eqs"][0][2], N, cap)
    return enumerate_eqs(u["cells"], u["eqs"], src, N, cap)


def read_solve(geo: Geometry, givens: list[int], **kw):
    opt = dict(DEFAULT_READ)
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
    cand: dict[int, int] | None = None
    start_one = sum(1 for li, em, r in _line_states(geo, grid, lines) if len(em) == 1)
    status = "solved"
    capped_reads = 0
    class _Contradiction(Exception):
        pass

    def memo_filter(d):
        """メモの上限（memo_max）: 候補が memo_max 個より多いマスは書けないので、全部の数に戻る
        （memo_hull なら候補の最小〜最大の範囲だけ覚える）。"""
        K = opt["memo_max"]
        if opt["memo_line_max"]:
            em_ = {}
            for L in geo.lines:
                e_ = sum(1 for c in L if not grid[c])
                for c in L:
                    em_[c] = min(em_.get(c, 99), e_)
            d = {c: (v if v == 0 or em_[c] <= opt["memo_line_max"] else unused) for c, v in d.items()}
        if K is None:
            return d
        out = {}
        for c, v in d.items():
            if v == 0 or popcount(v) <= K:
                out[c] = v
            elif opt["memo_excl"] and popcount(unused & ~v) <= K:
                out[c] = v
            elif opt["memo_hull"]:
                out[c] = geo.range_mask(lowest(v), v.bit_length() - 1) & unused
            else:
                out[c] = unused
        return out

    def apply_bounds(new, empties, tier):
        """列の上下限（A3 の変種）: 空き e の列の各マスは、残り − 残っている数の大きい e−1 個の和以上、
        残り − 小さい e−1 個の和以下。viol は違反の知らせで分かる上限（残り − 1）だけ。"""
        if not opt["bounds"] or tier < opt["bounds_tier"]:
            return
        vals = sorted(bits(unused))
        for li, em, r in _line_states(geo, grid, lines):
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

    def pair1_ok(u):
        r_ = u["eqs"][0][2]
        uv = sorted(bits(unused))
        if opt["pair1_umax"] and len(uv) > opt["pair1_umax"]:
            return False
        if opt["pair1_ext"]:
            return len(uv) >= 2 and r_ in (uv[-1] + uv[-2], uv[0] + uv[1])
        if opt["pair1_raw"]:
            return enumerate_line([unused, unused], r_, N, 10 ** 6)[2] == 1
        return True

    def run_tier(tier: int, cur: dict[int, int], units, empties, max_sweeps: int = 0):
        """段 tier 以下の単位を、置けるか動かなくなるまで巡ごとに読む。"""
        nonlocal capped_reads
        sweeps = 0
        lock_changed = False
        combos_first: list[int] = []
        chain_first = 0
        # lock_next と lock_ephemeral を一緒に使うとき: 前の巡の組の数を他で使わないを、この巡の置き場所探しにだけ使う
        lock_next_eph = opt["lock_next"] and opt["lock_ephemeral"]
        pending: list = []
        while True:
            sweeps += 1
            new = dict(cur)
            src = cur if opt["sync"] else new
            lk: dict[int, int] = {}
            unit_cells: set[int] = set()
            lock_later = []
            for u in units:
                e = len(u["cells"])
                short3 = False
                if u["tier"] > tier:
                    if opt["short3_sets"] and tier == 2 and u["kind"] == "line" and e == 3:
                        short3 = opt["short3_sets"]
                    elif opt["short_joint_sets"] and tier == 2 and u["kind"] == "joint":
                        short3 = opt["short_joint_sets"]
                    elif opt["pair1"] and tier == 1 and u["kind"] == "line" and e == 2 and pair1_ok(u):
                        short3 = 1
                    else:
                        continue
                if opt["chain_late"] and sweeps == 1 and tier >= 2 and u["kind"] == "chain":
                    continue
                if u["kind"] == "line" and e >= 4 and tier < 4:
                    continue
                try:
                    sup, req, nsets, _ = read_unit(u, src, N, opt["enum_cap"])
                except LineReadCap:
                    capped_reads += 1
                    continue
                if short3 and (nsets == 0 or nsets > short3):
                    continue
                if opt["sets_cap"] and e >= 2 and (u["tier"] == 2 or opt["sets_cap_all"]) and nsets > opt["sets_cap"]:
                    continue
                if sweeps == 1 and tier >= 2 and e >= 2:
                    combos_first.append(nsets)
                    if u["kind"] == "chain":
                        chain_first = max(chain_first, u["lines"])
                if nsets == 0:
                    raise _Contradiction
                unit_cells.update(u["cells"])
                for c, m in zip(u["cells"], sup):
                    new[c] &= m
                if ((tier >= opt["lock_min_tier"] or (short3 and tier == 1 and opt["pair1_lock"]))
                        and req and (u["kind"] != "chain" or opt["chain_lock"])
                        and (not opt["lock_unique"] or nsets == 1)):
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
            # 4マス以上の列で、組が少ない列も読む変種
            if opt["long_sets"] and tier >= 2:
                for u in units:
                    if u["kind"] != "line" or len(u["cells"]) < 4 or tier >= 4:
                        continue
                    try:
                        sup, req, nsets, _ = read_unit(u, src, N, 5000)
                    except LineReadCap:
                        continue
                    if nsets == 0 or nsets > opt["long_sets"]:
                        continue
                    for c, m in zip(u["cells"], sup):
                        new[c] &= m
            apply_bounds(new, empties, tier)
            if opt["mrange"] and tier >= opt["mrange"]:
                vals_ = sorted(bits(unused))
                for li_, em_, r_ in _line_states(geo, grid, lines):
                    e_ = len(em_)
                    if e_ < opt["mrange_e"] or e_ < 2:
                        continue
                    if any(src[x] == 0 for x in em_):
                        continue
                    gl_hi = sum(vals_[-(e_ - 1):])
                    gl_lo = sum(vals_[:e_ - 1])
                    for c_ in em_:
                        oth = [src[x] for x in em_ if x != c_]
                        shi = min(sum(mm.bit_length() - 1 for mm in oth), gl_hi)
                        slo = max(sum(lowest(mm) for mm in oth), gl_lo)
                        new[c_] &= geo.range_mask(r_ - shi, r_ - slo)
            # 組の数を他で使わない: 単位の外のマスのメモから消す（lock_scope=units は読んだ単位のマスだけ）
            eff = dict(new) if lk else new
            for c, req in lk.items():
                if opt["lock_scope"] == "units" and c not in unit_cells:
                    continue
                if opt["lock_scope"] == "memo" and c not in unit_cells and cur[c] == unused:
                    continue
                if eff[c] & req:
                    eff[c] &= ~req
                    lock_changed = True
            if lock_next_eph and pending:
                eff = dict(eff)
                for inU, req in pending:
                    for c in empties:
                        if c not in inU and eff[c] & req:
                            eff[c] &= ~req
                            lock_changed = True
            placements: dict[int, int] = {}
            kinds: set[str] = set()
            for c in empties:
                m = eff[c]
                if m == 0:
                    raise _Contradiction
                if m & (m - 1) == 0:
                    placements[c] = lowest(m)
                    kinds.add("one" if tier == 1 else "cross")
            if opt["hidden"] and tier >= opt["hidden_min_tier"]:
                hsrc = cur if opt["hidden_next"] else eff
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
            pend_changed = False
            if lock_next_eph:
                old = {(frozenset(a), b) for a, b in pending}
                pending, lock_later = lock_later, []
                pend_changed = {(frozenset(a), b) for a, b in pending} != old
            if lock_later:
                eff = dict(eff)
                for inU, req in lock_later:
                    for c in empties:
                        if c not in inU and eff[c] & req:
                            eff[c] &= ~req
                            lock_changed = True
            nxt = memo_filter(new if opt["lock_ephemeral"] else eff)
            changed = nxt != cur or pend_changed
            cur = nxt
            if placements or not changed or (max_sweeps and sweeps >= max_sweeps):
                return {"placements": placements, "kinds": kinds, "sweeps": sweeps, "lock": lock_changed,
                        "combos": combos_first, "chain": chain_first, "cur": cur, "changed": changed}

    while True:
        empties = [c for c in range(N) if not grid[c]]
        if not empties:
            break
        if cand is None or not opt["memory"]:
            cand = {c: unused for c in empties}
        else:
            cand = {c: cand[c] & unused for c in empties}
        cand = memo_filter(cand)
        units = build_units(geo, grid, opt, lines)
        stall_start = cand
        chosen = None
        extra_sweeps = 0
        try:
            if opt["esc"]:
                r1 = run_tier(1, dict(stall_start), units, empties)
                if r1["placements"]:
                    chosen = (1, r1)
                elif opt["esc"] in ("hi", "hif"):
                    r2 = run_tier(2, dict(stall_start), units, empties, max_sweeps=1)
                    if r2["placements"]:
                        chosen = (2, r2)
                    else:
                        r3 = run_tier(3, dict(r2["cur"] if opt["esc"] == "hi" else stall_start), units, empties)
                        if r3["placements"]:
                            r3 = dict(r3)
                            r3["sweeps"] += 1 if (r2["changed"] and opt["esc"] == "hi") else 0
                            chosen = (3, r3)
                        elif max_tier >= 4:
                            r = run_tier(4, dict(stall_start), units, empties)
                            if r["placements"]:
                                chosen = (4, r)
                else:  # lo: 巡ごとに、段2で置けるかを先に見て、置けなければ段3も同じ写しで読む
                    cur_l = dict(stall_start)
                    s = 0
                    while chosen is None:
                        s += 1
                        r2 = run_tier(2, dict(cur_l), units, empties, max_sweeps=1)
                        if r2["placements"]:
                            r2 = dict(r2); r2["sweeps"] = s
                            chosen = (2, r2)
                            break
                        r3 = run_tier(3, dict(cur_l), units, empties, max_sweeps=1)
                        if r3["placements"]:
                            r3 = dict(r3); r3["sweeps"] = s
                            chosen = (3, r3)
                            break
                        if not r3["changed"]:
                            break
                        cur_l = r3["cur"]
                    if chosen is None and max_tier >= 4:
                        r = run_tier(4, dict(stall_start), units, empties)
                        if r["placements"]:
                            chosen = (4, r)
            elif opt["tier_choice"] == "fewest":
                # 段1で置けなければ、段2・段3のうち巡の最も少ない段（同じなら低い段）。どちらも置けなければ段4
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
                # count: fresh はどの段も行き詰まりの始めから数える。carry は下の段を出し切った候補から続け、
                # 上げた段の巡だけ数える。cum は carry に、下の段で候補が動いた巡を足す
                curc = stall_start
                for tier in range(1, max_tier + 1):
                    start = dict(stall_start) if opt["count"] == "fresh" else dict(curc)
                    r = run_tier(tier, start, units, empties, max_sweeps=(1 if (tier == 1 and opt["pair1_one"]) else 0))
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
            "found": found,
            "kinds": sorted(r["kinds"]),
            "lock": r["lock"],
            "combos": r["combos"],
            "chain": r["chain"],
            "cells": sorted(placements),
        })
    return {"status": status, "steps": steps, "grid": grid, "start_one": start_one,
            "capped_reads": capped_reads}


def read_features(geo: Geometry, givens: list[int], res) -> dict:
    steps = res["steps"]
    hard = [s for s in steps if s["tier"] >= 2]
    combos = [x for s in hard for x in s["combos"]]
    f = {
        "status": res["status"],
        "n": geo.n,
        "givens": sum(1 for v in givens if v),
        "empties": sum(1 for v in givens if not v),
        "start_one": res.get("start_one", 0),
        "entry": steps[0]["found"] if steps and steps[0]["tier"] == 1 else 0,  # 置き方に依らない（1巡で見つかる数）
        "first_tier": steps[0]["tier"] if steps else 0,
        "first_sweeps": steps[0]["sweeps"] if steps else 0,
        "tier_max": max((s["tier"] for s in steps), default=0),
        "batches": len(steps),
        "hard": len(hard),
        "t3": sum(1 for s in steps if s["tier"] >= 3),
        "t4": sum(1 for s in steps if s["tier"] >= 4),
        "depth_max": max((s["sweeps"] for s in hard), default=0),
        "deep": sum(1 for s in hard if s["sweeps"] >= 2),
        "deep3": sum(1 for s in hard if s["sweeps"] >= 3),
        "sweeps_hard": sum(s["sweeps"] for s in hard),
        "hidden": sum(1 for s in steps if s["kinds"] == ["hidden"]),
        "lock": sum(1 for s in hard if s["lock"]),
        "chain_max": max((s.get("chain", 0) for s in hard), default=0),
        "placed_by_one": sum(s["placed"] for s in steps if s["tier"] == 1),
        "combos_med": statistics.median(combos) if combos else 0,
        "combos_max": max(combos) if combos else 0,
        "capped_reads": res.get("capped_reads", 0),
        # 版 4 の特徴: 段2の所の巡の最大・段3以上の所の巡の最大（段3の巡は数え方で揺れるので上限にだけ使う）
        "d2max": max((s["sweeps"] for s in steps if s["tier"] == 2), default=0),
        "d3max": max((s["sweeps"] for s in steps if s["tier"] >= 3), default=0),
        "t1depth": len(steps) if steps and max(s["tier"] for s in steps) == 1 else 0,
        "first_hard": int(bool(steps) and (steps[0]["tier"] >= 3 or (steps[0]["tier"] == 2 and steps[0]["sweeps"] >= 2))),
    }
    f["is_deep"] = int(f["d2max"] >= 2 or f["t3"] >= 1)     # 深い読み（版 4）
    f["is_vdeep"] = int(f["d2max"] >= 3 or f["t3"] >= 1)    # 段2で3巡以上か段3（版 4 の L5 の条件の1つ）
    return f


# ---------------------------------------------------------------------------
# 仮想の列（列の式を足し引きすると合計が決まる、列ではないマスの組）
# ---------------------------------------------------------------------------

PRIME = 1_000_003


def _rref_mod(rows: list[list[int]], p: int = PRIME):
    rows = [list(r) for r in rows]
    piv = []
    ri = 0
    ncol = len(rows[0])
    for col in range(ncol):
        sel = None
        for i in range(ri, len(rows)):
            if rows[i][col] % p:
                sel = i
                break
        if sel is None:
            continue
        rows[ri], rows[sel] = rows[sel], rows[ri]
        inv = pow(rows[ri][col], p - 2, p)
        rows[ri] = [(x * inv) % p for x in rows[ri]]
        for i in range(len(rows)):
            if i != ri and rows[i][col] % p:
                f = rows[i][col]
                rows[i] = [(a - f * b) % p for a, b in zip(rows[i], rows[ri])]
        piv.append(col)
        ri += 1
    return rows[:ri], piv


def _in_span(basis, piv, vec, p: int = PRIME) -> bool:
    v = list(vec)
    for row, col in zip(basis, piv):
        if v[col] % p:
            f = v[col]
            v = [(a - f * b) % p for a, b in zip(v, row)]
    return all(x % p == 0 for x in v)


def _span_sum(geo: Geometry, cells: tuple[int, ...]) -> int:
    """cells の和を、列の式と全体の和の一次結合として Fraction で解いて返す。"""
    vecs = []
    for L in geo.lines:
        vecs.append([Fraction(1 if c in L else 0) for c in range(geo.N)])
    vecs.append([Fraction(1)] * geo.N)
    sums = [Fraction(geo.M)] * len(geo.lines) + [Fraction(geo.N * (geo.N + 1) // 2)]
    target = [Fraction(1 if c in cells else 0) for c in range(geo.N)]
    # 最小二乗ではなく、拡大係数行列で解く（列ベクトルが vecs）
    m = len(vecs)
    A = [[vecs[j][i] for j in range(m)] + [target[i]] for i in range(geo.N)]
    rows = len(A)
    col_piv = []
    r = 0
    for col in range(m):
        sel = None
        for i in range(r, rows):
            if A[i][col] != 0:
                sel = i
                break
        if sel is None:
            continue
        A[r], A[sel] = A[sel], A[r]
        pv = A[r][col]
        A[r] = [x / pv for x in A[r]]
        for i in range(rows):
            if i != r and A[i][col] != 0:
                f = A[i][col]
                A[i] = [a - f * b for a, b in zip(A[i], A[r])]
        col_piv.append(col)
        r += 1
    coef = [Fraction(0)] * m
    for i, col in enumerate(col_piv):
        coef[col] = A[i][m]
    total = sum(c * s for c, s in zip(coef, sums))
    assert total.denominator == 1
    return int(total)


def find_identities(n: int, sizes: tuple[int, ...]) -> list[tuple[tuple[int, ...], int]]:
    geo = geo_of(n)
    vecs = [[1 if c in L else 0 for c in range(geo.N)] for L in geo.lines]
    vecs.append([1] * geo.N)
    basis, piv = _rref_mod(vecs)
    real = {tuple(sorted(L)) for L in geo.lines}
    out = []
    for k in sizes:
        for comb in itertools.combinations(range(geo.N), k):
            if comb in real:
                continue
            vec = [0] * geo.N
            for c in comb:
                vec[c] = 1
            if _in_span(basis, piv, vec):
                out.append((comb, _span_sum(geo, comb)))
    return out


# ---------------------------------------------------------------------------
# 素朴な解き方（D1）
# ---------------------------------------------------------------------------
#
# 表示の種類（補助と状態の知らせの観点が決める。ここでは引数）:
#   remain : 列の今の合計（または あと r）と違反（空きがあるのに合計に届いた・超えた列、埋まったのに合わない列）。
#            採った表示（今の合計と合計の定数を出し、違反を出す）は、素朴な解き方に返すことがこれと同じ
#   filled : 埋まった列の合否だけ（✓ か赤）。あと r は自分で足し算する
#   none   : 何も出さない。全部埋めてクリアにならなければ、最後の試し置きから戻す
# どちらでも、空きが1マスの列はその数を入れる（足し算は読みではないとみなす）。
# 入れた数が使用済み・範囲外なら、その場で矛盾に気づく（remain では表示で、filled では計算で）。
# 試し置き: 空きの最も少ない列（2マス以上）のマスを無作為に1つ選び、残っている数を無作為な順に試す。
#   pair=True（慣れた試し置き）: そのマスの列に空きが2マスなら、相手のマスに残る数（r-v）が残っている
#   数だけを試す。赤になったら戻し、試す数が尽きたら1つ前の試し置きまで戻す。


def _violation(geo: Geometry, grid: list[int], cell: int, display: str, unused: int) -> bool:
    M = geo.M
    if display == "none":
        return False
    for li in geo.cell_lines[cell]:
        L = geo.lines[li]
        s = 0
        e = 0
        for c in L:
            v = grid[c]
            if v:
                s += v
            else:
                e += 1
        if e == 0:
            if s != M:
                return True
        elif display == "remain":
            if s >= M:
                return True
    return False


def naive_solve(geo: Geometry, givens: list[int], rng: random.Random, display: str = "remain",
                pair: bool = False, cap_moves: int = 20000) -> dict:
    N, M = geo.N, geo.M
    grid = list(givens)
    unused = geo.full
    for v in grid:
        if v:
            unused &= ~(1 << v)
    moves = 0
    trials = 0
    undos = 0

    def forced() -> tuple[list[int], bool]:
        nonlocal unused, moves
        placed = []
        while True:
            hit = False
            for L in geo.lines:
                s = 0
                emp = -1
                e = 0
                for c in L:
                    v = grid[c]
                    if v:
                        s += v
                    else:
                        e += 1
                        emp = c
                if e != 1:
                    continue
                r = M - s
                if not (1 <= r <= N) or not (unused >> r) & 1:
                    return placed, False
                grid[emp] = r
                unused &= ~(1 << r)
                placed.append(emp)
                moves += 1
                if _violation(geo, grid, emp, display, unused):
                    return placed, False
                hit = True
                break
            if not hit:
                return placed, True

    def undo(cells: list[int]):
        nonlocal unused
        for c in cells:
            unused |= 1 << grid[c]
            grid[c] = 0

    p0, ok = forced()
    if not ok:
        return {"solved": False, "moves": moves, "trials": 0, "undos": 0, "reason": "bad-givens"}

    def choose_frame():
        best_e = 10 ** 9
        pool = []
        for L in geo.lines:
            e = sum(1 for c in L if not grid[c])
            if e >= 2:
                if e < best_e:
                    best_e = e
                    pool = [L]
                elif e == best_e:
                    pool.append(L)
        if not pool:
            # 空きが残るのは列に属さないマスだけ（起こらない）
            cells = [c for c in range(N) if not grid[c]]
            cell = rng.choice(cells)
        else:
            L = rng.choice(pool)
            cell = rng.choice([c for c in L if not grid[c]])
        vals = list(bits(unused))
        if pair:
            keep = []
            for v in vals:
                good = True
                for li in geo.cell_lines[cell]:
                    L = geo.lines[li]
                    s = sum(grid[c] for c in L)
                    emp = [c for c in L if not grid[c]]
                    if len(emp) == 2:
                        w = M - s - v
                        if w == v or not (1 <= w <= N) or not (unused >> w) & 1:
                            good = False
                            break
                    elif s + v >= M:
                        good = False
                        break
                if good:
                    keep.append(v)
            vals = keep
        rng.shuffle(vals)
        return {"cell": cell, "vals": vals, "i": 0, "placed": []}

    stack = []
    while True:
        if all(grid) and (display != "none" or is_magic(geo, grid)):
            return {"solved": True, "moves": moves, "trials": trials, "undos": undos}
        if all(grid):
            # 表示なし: 全部埋めてもクリアにならない。最後の試し置きから戻す
            fr = None
        else:
            fr = choose_frame()
        if moves > cap_moves:
            return {"solved": False, "moves": moves, "trials": trials, "undos": undos, "reason": "cap"}
        if fr is not None:
            stack.append(fr)
        while stack:
            fr = stack[-1]
            if fr["placed"]:
                undo(fr["placed"])
                fr["placed"] = []
                undos += 1
            if fr["i"] >= len(fr["vals"]):
                stack.pop()
                continue
            v = fr["vals"][fr["i"]]
            fr["i"] += 1
            c = fr["cell"]
            grid[c] = v
            unused &= ~(1 << v)
            moves += 1
            trials += 1
            fr["placed"] = [c]
            if _violation(geo, grid, c, display, unused):
                continue
            more, ok = forced()
            fr["placed"] += more
            if not ok:
                continue
            break
        if not stack:
            return {"solved": False, "moves": moves, "trials": trials, "undos": undos, "reason": "exhausted"}


# ---------------------------------------------------------------------------
# 候補の生成
# ---------------------------------------------------------------------------
#
# 1. 魔方陣を1つ作る（4×4 は全 7040 通りから一様に、5×5 以上は乱択の深さ優先探索）
# 2. マスを無作為な順に1つずつ空け、読むモデル（段 T まで）で解けなくなるなら戻す（極小の問題）
# 3. k < 10: 空けたマスのうち k マスを無作為に戻す（与える数を増やした易しめの候補）
#    k >= 10: 戻さずに、(k-10)*100 回、与える数を入れ替えて上のレベル向けに磨く（polish_givens）
# 生成条件は (n, T, k)。seed は ((n*10+T)*100+k)*10000 + 候補番号。

_SQUARES4: list[list[int]] | None = None


def all_squares4() -> list[list[int]]:
    global _SQUARES4
    if _SQUARES4 is None:
        st = count_solutions(geo_of(4), [0] * 16, limit=10 ** 6, collect=True)
        _SQUARES4 = st["solutions"]
    return _SQUARES4


def candidate_seed(n: int, T: int, k: int, i: int) -> int:
    return ((n * 10 + T) * 100 + k) * 10_000 + i


def reduce_givens(geo: Geometry, solution: list[int], rng: random.Random, T: int, read_kw=None,
                  log: dict | None = None) -> tuple[list[int], int]:
    read_kw = read_kw or {}
    g = list(solution)
    order = list(range(geo.N))
    rng.shuffle(order)
    calls = 0
    kept = []
    for c in order:
        v = g[c]
        g[c] = 0
        calls += 1
        if read_solve(geo, g, max_tier=T, **read_kw)["status"] != "solved":
            g[c] = v
            kept.append(c)
    if log is not None:
        log["removal_order"] = order
        log["kept"] = kept
    return g, calls


def generate_candidate(n: int, T: int, k: int, i: int, log: dict | None = None) -> dict:
    geo = geo_of(n)
    seed = candidate_seed(n, T, k, i)
    rng = random.Random(seed)
    t0 = time.time()
    if n == 4:
        sol = list(rng.choice(all_squares4()))
        sq_nodes = 0
    else:
        sol, sq_nodes = random_magic_square(n, rng)
    t1 = time.time()
    g, calls = reduce_givens(geo, sol, rng, T, log=log)
    if log is not None:
        log["minimal_givens"] = list(g)
    removed = [c for c in range(geo.N) if not g[c]]
    polish_calls = 0
    if k >= 10:
        # k = 10 + 回数/100: 戻さずに、上のレベル向けに磨く
        g, _, polish_calls = polish_givens(geo, sol, g, rng, iters=(k - 10) * 100, max_tier=T)
    else:
        back = rng.sample(removed, min(k, len(removed))) if k else []
        for c in back:
            g[c] = sol[c]
    t2 = time.time()
    return {"id": f"ms{n}-T{T}-k{k}-{i}", "n": n, "T": T, "k": k, "seed": seed, "givens": g,
            "solution": sol, "square_nodes": sq_nodes, "reduce_calls": calls, "polish_calls": polish_calls,
            "t_square": round(t1 - t0, 4), "t_reduce": round(t2 - t1, 4)}


DEPTH_CAP = 4  # 1か所の巡の上限。基準の読むモデルで測る作り方の決まり（版 5。読み方での一致は上限を外したレベルで比べる）。
               # 磨かずに作った段2以上の問題の 95〜98% が収まる長さ（資料 §4.4）


# 磨くときに一致を確かめる読み方（版 5）。範囲内を外す数の多い部品と、組み合わせの被覆（資料 §6.1）
POLISH_KEY_VARIANTS = ("cum", "lock_next", "weak", "strong", "lock_eph", "memo4", "diag_nochain",
                       "lock_eph+short3_2+memo4", "lock_eph+nohidden+diag_nochain")
POLISH_PENALTY = 15  # 上の変種で基準とレベルが違うごとに引く点
POLISH_KEY_VARIANTS_V4 = ("cum", "lock_next", "weak", "strong", "lock_eph")  # 版 4 の磨き方（corpus --polish v4）
POLISH_CAP: int | None = None  # 変種のレベルに当てる巡の上限（版 5 は当てない。版 4 の磨き方は DEPTH_CAP）


def polish_score(f) -> float:
    """上のレベル向けに磨くときの点。最初から1マス空きの列が無く、最初の1マスから絞り直しが要り、
    絞り直しか3マス空きの列の組を読む所がある盤面を高くする。巡が3を超える分は引く（数え方で上限を超えやすいため）。
    巡が DEPTH_CAP を超える盤面と段4が要る盤面には進まない。"""
    if f["status"] != "solved" or f["depth_max"] > DEPTH_CAP or f["tier_max"] >= 4:
        return -1e9
    return (6 * min(f["first_sweeps"], 2) * (f["entry"] == 0) + 4 * min(f["depth_max"], 3)
            - 3 * max(f["depth_max"] - 3, 0) + 3 * min(f["t3"], 2) + 2 * min(f["deep"], 3) + min(f["hard"], 6)
            - 8 * min(f["entry"], 3))


def _polish_value(geo: Geometry, g: list[int], f) -> tuple[float, int]:
    """polish_score から、POLISH_KEY_VARIANTS でレベル（巡の上限を当てない）が基準と違う数 × POLISH_PENALTY を
    引いた点と、解いた回数。"""
    s = polish_score(f)
    if s <= -1e8:
        return s, 0
    lv = level_v4_raw(read_features(geo, g, read_solve(geo, g)))[0]
    bad = sum(1 for v in POLISH_KEY_VARIANTS
              if level_v4_raw(read_features(geo, g, read_solve(geo, g, **variant_kw(v))), POLISH_CAP)[0] != lv)
    return s - POLISH_PENALTY * bad, 1 + len(POLISH_KEY_VARIANTS)


def polish_givens(geo: Geometry, solution: list[int], givens: list[int], rng: random.Random,
                  iters: int, max_tier: int = 3) -> tuple[list[int], dict, int]:
    """与える数の入れ替え（1つ外して別の1マスを与える）・外す・足すで、点を下げない向きに磨く。
    読むモデル（段 max_tier まで）で解けない盤面には進まない。(盤面, 特徴, 解いた回数)"""
    cur = list(givens)
    cur_f = read_features(geo, cur, read_solve(geo, cur, max_tier=max_tier))
    cur_s, k = _polish_value(geo, cur, cur_f)
    calls = 1 + k
    for _ in range(iters):
        gv = [c for c in range(geo.N) if cur[c]]
        em = [c for c in range(geo.N) if not cur[c]]
        new = list(cur)
        x = rng.random()
        if x < 0.7 and gv and em:
            new[rng.choice(gv)] = 0
            c = rng.choice(em)
            new[c] = solution[c]
        elif x < 0.9 and gv:
            new[rng.choice(gv)] = 0
        elif em:
            c = rng.choice(em)
            new[c] = solution[c]
        res = read_solve(geo, new, max_tier=max_tier)
        calls += 1
        if res["status"] != "solved":
            continue
        f = read_features(geo, new, res)
        s, k = _polish_value(geo, new, f)
        calls += k
        if s >= cur_s:
            cur, cur_f, cur_s = new, f, s
    return cur, cur_f, calls


VARIANTS = {
    # 意味を変えない数え方
    "memoryless": {"memory": False},          # 候補のメモを使わない（置くたびに盤面から読み直す）
    "one": {"batch": False},                  # 1巡で決まったマスを1つずつ置く
    # 単位を読む順（巡ではなく走査の回数を数えることになる）
    "seq_nat": {"sync": False},
    "seq_rev": {"sync": False, "order_seed": -1},
    "seq_r1": {"sync": False, "order_seed": 1},
    "seq_r2": {"sync": False, "order_seed": 2},
    "seq_r3": {"sync": False, "order_seed": 3},
    # 人が使いうる、列をまたぐ読み（A4 の反例の向き）
    "joint3": {"joint": 3},                   # 交わる2本を一緒に読む（空き3マスまで）
    "joint4": {"joint": 4},                   # 同（空き4マスまで）
    "combo2": {"combo": 2},                   # 2本の列の差・和（空き3マスまで）
    "combo3": {"combo": 3},                   # 3本の列の ±1 の式（空き3マスまで）
    "lin": {"lin": True},                     # 列の式の一次結合で決まるマス
    "allx": {"joint": 4, "combo": 3, "lin": True},
    "long3": {"long_sets": 3},                # 組が3通りまでの長い列も読む
    # 定義を変える前の数え方（比べるため）
    # 段を上げた所の巡の数え方（A4 の2回目）
    "carry": {"count": "carry"},              # 下の段を出し切った候補から続け、上げた段の巡だけ数える
    "cum": {"count": "cum"},                  # carry に、下の段で候補が動いた巡を足す
    # メモの書き方（A4 の2回目）
    "lock_all": {"lock_scope": "all"},        # 組の数を他で使わないで、単位の外の全マスのメモから消す（版 3）
    "lock_eph": {"lock_ephemeral": True},     # 組の数を他で使わないで消した数をメモに残さない
    # 安い読み（A4 の2回目）
    "range1": {"bounds": "range", "bounds_tier": 1},   # 列の上下限を段1から使う
    "range2": {"bounds": "range", "bounds_tier": 2},   # 列の上下限を段2から使う
    "viol1": {"bounds": "viol", "bounds_tier": 1},     # 違反の知らせで分かる上限（残り − 1）を段1から
    "viol2": {"bounds": "viol", "bounds_tier": 2},     # 同、段2から
    "short3_1": {"short3_sets": 1},           # 組が1通りの空き3の列を段2で読む
    "short3_2": {"short3_sets": 2},           # 組が2通りまでの空き3の列を段2で読む
    "jointk2": {"jointk": 2},                 # 空き3の列と交わる列を一緒に読む（2本）
    "jointk3d2": {"jointk": 3, "jointk_dof": 2},  # 3本まで、自由度2以下
    # 読みを減らす人（A4 の2回目）
    "nohidden": {"hidden": False},            # この数はここだけを使わない
    "chain_nolock": {"chain_lock": False},    # 鎖から組の数を他で使わないをしない
    # 組み合わせ（上の変種をまとめて当てる人）
    "strong": {"bounds": "range", "bounds_tier": 1, "short3_sets": 2, "jointk": 2, "count": "carry", "lock_scope": "all"},
    "weak": {"count": "cum", "lock_next": True, "chain_limit": 2, "hidden": False, "chain_lock": False, "memory": False},
    "chain2": {"chain_limit": 2},             # 鎖を2本ずつに分けて読む（長い鎖を一度に読まない人）
    "chain3": {"chain_limit": 3},             # 鎖を3本ずつに分けて読む
    "fewest": {"tier_choice": "fewest"},      # 行き詰まりで、巡の最も少ない段を使う
    "nochain": {"chains": False},
    "v3": {"lock_scope": "all"},              # 版 3 の読むモデル（lock_all と同じ）
    "v1": {"chains": False, "memory": False, "count": "carry", "lock_scope": "all"},  # 版 2 の読むモデル
    # 読む範囲
    "nolock": {"lock_min_tier": 99},
    "hidden2": {"hidden_min_tier": 2},
    # 1巡に入る読みの区切り方
    "lock_next": {"lock_next": True},
    "hidden_next": {"hidden_next": True},
    # メモの上限（A4 の3回目。ゲームのメモは1マス4つまで）
    "memo4": {"memo_max": 4},                 # 候補が4つ以下のマスだけメモに書く（ゲームの画面そのもの）
    "memo3": {"memo_max": 3},
    "memo5": {"memo_max": 5},
    "memo6": {"memo_max": 6},
    "memo8": {"memo_max": 8},
    "hull4": {"memo_max": 4, "memo_hull": True},   # 候補が5つ以上のマスは最小〜最大の範囲だけ覚える
    # 段の付け方の別案（A4 の3回目）
    "chain4t3": {"chain_tier3_from": 4},      # 4本以上の列の鎖を段3に数える
    "chain3t3": {"chain_tier3_from": 3},
    "chaint3": {"chain_tier3_from": 2},       # 鎖を全部段3に数える
    "jk2t2": {"jointk": 2, "jointk_tier": 2},  # 空き3の列と交わる列を一緒に読むのを段2に数える
    "diag_nochain": {"diag_chain": False},    # 斜めの列を鎖につながない
    "lock_next_eph": {"lock_next": True, "lock_ephemeral": True},  # 組の数を他で使わないを次の巡の置き場所探しにだけ使う
}

VIRTUAL4 = [((0, 3, 12, 15), 34), ((1, 2, 13, 14), 34), ((4, 7, 8, 11), 34), ((5, 6, 9, 10), 34)]


def rotate_givens(geo: Geometry, givens: list[int], perm: list[int]) -> list[int]:
    out = [0] * geo.N
    for c in range(geo.N):
        out[perm[c]] = givens[c]
    return out


def analyze_candidate(cand: dict, naive_runs: int = 3) -> dict:
    n = cand["n"]
    geo = geo_of(n)
    g = cand["givens"]
    t0 = time.time()
    ex = count_solutions(geo, g, limit=2, node_cap=2_000_000)
    t1 = time.time()
    res = read_solve(geo, g)
    t2 = time.time()
    base = read_features(geo, g, res)
    base["trace"] = [[s["tier"], s["sweeps"], s["placed"], "".join(k[0] for k in s["kinds"]), int(s["lock"])]
                     for s in res["steps"]]
    var = {}  # 変種は report の refresh_features で測る
    # 回転・裏返しで変わらないことの確かめ（1つだけ）
    perm = geo.symmetries()[5]
    var["mirror"] = read_features(geo, rotate_givens(geo, g, perm), read_solve(geo, rotate_givens(geo, g, perm)))
    if n == 4:
        var["virtual"] = read_features(geo, g, read_solve(geo, g, extra_lines=VIRTUAL4))
    t3 = time.time()
    naive = {}
    cap = 20 * base["empties"]
    for key, disp, pair in (("rn", "remain", False), ("rp", "remain", True), ("fp", "filled", True),
                            ("np", "none", True)):
        runs = []
        for r in range(naive_runs):
            out = naive_solve(geo, g, random.Random(cand["seed"] * 10 + r), display=disp, pair=pair, cap_moves=cap)
            runs.append([int(out["solved"]), out["undos"], out["moves"]])
        naive[key] = runs
    t4 = time.time()
    out = dict(cand)
    out.update({"exact": {"count": ex["count"], "nodes": ex["nodes"], "capped": ex["capped"]},
                "base": base, "var": var, "naive": naive,
                "t_exact": round(t1 - t0, 4), "t_read": round(t2 - t1, 4),
                "t_variants": round(t3 - t2, 4), "t_naive": round(t4 - t3, 4)})
    if n == 4:
        out["canon"] = list(canonical_key(geo, cand["solution"]))
    return out


def _job(args):
    n, T, k, i = args
    return analyze_candidate(generate_candidate(n, T, k, i))


def set_polish(mode: str):
    """磨き方を選ぶ。v4 は版 4 の磨き方（5つの変種、変種のレベルにも巡の上限を当てる）。"""
    global POLISH_KEY_VARIANTS, POLISH_CAP
    if mode == "v4":
        POLISH_KEY_VARIANTS, POLISH_CAP = POLISH_KEY_VARIANTS_V4, DEPTH_CAP


def cmd_corpus(a):
    set_polish(a.polish)
    jobs = []
    for n in a.sizes:
        for T in a.tiers:
            for k in a.addback:
                for i in range(a.per):
                    jobs.append((n, T, k, i))
    done = set()
    if os.path.exists(a.out) and a.resume:
        with open(a.out) as fh:
            for line in fh:
                d = json.loads(line)
                done.add((d["n"], d["T"], d["k"], int(d["id"].rsplit("-", 1)[1])))
    jobs = [j for j in jobs if j not in done]
    t0 = time.time()
    mode = "a" if a.resume else "w"
    with open(a.out, mode) as fh:
        if a.jobs > 1:
            import multiprocessing as mp
            with mp.Pool(a.jobs) as pool:
                for d in pool.imap(_job, jobs, chunksize=1):
                    fh.write(json.dumps(d, separators=(",", ":")) + "\n")
                    fh.flush()
        else:
            for j in jobs:
                d = _job(j)
                fh.write(json.dumps(d, separators=(",", ":")) + "\n")
    print(f"{len(jobs)} candidates in {time.time() - t0:.1f}s ({a.jobs} processes)", file=sys.stderr)


def cmd_enum4(a):
    t = time.time()
    sq = all_squares4()
    geo = geo_of(4)
    keys = {canonical_key(geo, g) for g in sq}
    print(json.dumps({"squares": len(sq), "classes": len(keys), "seconds": round(time.time() - t, 1),
                      "virtual_lines_hold": all(sum(g[c] for c in L) == S for g in sq for L, S in VIRTUAL4)}))


def cmd_identities(a):
    for n in a.sizes:
        sizes = tuple(range(2, a.max_size + 1)) if n > 4 else tuple(range(2, 9))
        ids = find_identities(n, sizes)
        print(json.dumps({"n": n, "sizes": list(sizes), "count": len(ids),
                          "size_n": [list(c) for c, s in ids if len(c) == n]}))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("enum4")
    q.set_defaults(fn=cmd_enum4)
    q = sub.add_parser("identities")
    q.add_argument("--sizes", type=int, nargs="+", default=[4, 5, 6])
    q.add_argument("--max-size", type=int, default=5)
    q.set_defaults(fn=cmd_identities)
    q = sub.add_parser("corpus")
    q.add_argument("--sizes", type=int, nargs="+", default=[4, 5, 6])
    q.add_argument("--tiers", type=int, nargs="+", default=[1, 2, 3, 4])
    q.add_argument("--addback", type=int, nargs="+", default=[0, 1, 2])
    q.add_argument("--per", type=int, default=40)
    q.add_argument("--jobs", type=int, default=4)
    q.add_argument("--out", required=True)
    q.add_argument("--resume", action="store_true")
    q.add_argument("--polish", choices=["v5", "v4"], default="v5", help="磨くときに一致を確かめる変種（v4 は版 4 の磨き方）")
    q.set_defaults(fn=cmd_corpus)
    _register_report(sub)
    a = p.parse_args(argv)
    if getattr(a, "cache", None):
        load_agree_cache(a.cache)
    a.fn(a)




# ---------------------------------------------------------------------------
# 集計の道具
# ---------------------------------------------------------------------------


def pct(xs, f):
    xs = sorted(xs)
    if not xs:
        return None
    return xs[min(len(xs) - 1, int(f * (len(xs) - 1) + 0.5))]


def q3(xs) -> str:
    if not xs:
        return "-"
    a, b, c = pct(xs, 0.1), pct(xs, 0.5), pct(xs, 0.9)

    def fmt(x):
        return f"{x:g}" if isinstance(x, (int, float)) else str(x)
    return f"{fmt(a)} / {fmt(b)} / {fmt(c)}"


def ranks(xs):
    idx = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[idx[j + 1]] == xs[idx[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[idx[k]] = avg
        i = j + 1
    return r


def spearman(xs, ys):
    if len(xs) < 3:
        return None
    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.fmean(rx), statistics.fmean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return None if den == 0 else round(num / den, 2)


def load(paths):
    out = []
    for p in paths:
        with open(p) as fh:
            for line in fh:
                out.append(json.loads(line))
    return out


def naive_med(d, key="rp", idx=1):
    return statistics.median(r[idx] for r in d["naive"][key])


def naive_rate(d, key="rp", cond=lambda r: r[0] == 1):
    rs = d["naive"][key]
    return sum(1 for r in rs if cond(r)) / len(rs)


# ---------------------------------------------------------------------------
# つまみの案（比較実験の条件。境目は検討時点の仮の値）
# ---------------------------------------------------------------------------
#
# 各案は (特徴, 候補) からレベル 1..5 か None（どのレベルにも当たらない）を返す。
# 特徴は read_features の値。rp は慣れた試し置き（pair=True, remain）の戻した回数の中央値。
# どの案も、読むモデルの段 3 までで解けない問題（4マス以上の列を読む・試し置きが要る）と、
# 1か所の読み直しが DEPTH_CAP 巡を超える問題は提供しない（out_of_range_reason）。


def _rp(d):
    return naive_med(d, "rp", 1)


def out_of_range_reason(f) -> str | None:
    """提供範囲の外になる理由。範囲の内なら None。"""
    if f["status"] != "solved":
        return "requires-trial"
    if f["tier_max"] >= 4:
        return "long-line"
    if f["depth_max"] > DEPTH_CAP:
        return "too-deep"
    if f["tier_max"] == 1 and 2 * f["entry"] > f["empties"]:
        # 最初の1巡で空きの半分より多くが置ける: 1マス空きの列を探す読みがほとんど要らない
        return "too-light"
    return None


def _virtual_ok(d, lv, P):
    """4×4 は、仮想の列（四隅・中央の4マスなどの合計も34）を使うとレベルが下がる問題を除く。
    仮想の列で入口が広すぎる（too-light）だけになったものは L1 のままとみなす（L1 より下は無い）。"""
    if d["n"] != 4 or lv is None or "virtual" not in d["var"]:
        return True
    fv = d["var"]["virtual"]
    if fv["status"] != "solved":
        return True
    vl = P(fv, d, check_virtual=False)
    if vl is None and out_of_range_reason(fv) == "too-light":
        vl = 1
    return vl is None or vl >= lv


def prop_A(f, d, check_virtual=True):
    """規模 × 段: 認識合わせの例をそのまま読んだ案（4×4 と 5×5）。"""
    if out_of_range_reason(f):
        return None
    n, t = f["n"], f["tier_max"]
    lv = None
    if n == 4:
        lv = {1: 1, 2: 2}.get(t)
    elif n == 5:
        if t == 2:
            lv = 3 if f["start_one"] >= 1 else 4
        elif t == 3:
            lv = 5
    if check_virtual and not _virtual_ok(d, lv, prop_A):
        return None
    return lv


def reading_level(f):
    """版 3 の、盤面に依らない読みの段（1..5）。範囲外は None。案の比較（§13.1）のために残す。採った版 4 は level_v4_raw。

    回数（突き合わせの回数・絞り直しの回数）は、メモの使い方・置き方・列をまたぐ読みで揺れ、作業量にも近いので
    分類に使わない。使うのは揺れない量（A3/A4 の計測。資料の §5.3）:
      入口: 最初の1巡に1マス空きの列で置けるマスがあるか
      深い読み: いちばん深い所の巡が2以上か、段3（3マス空きの列の組）が要るか
      最初の1マスの巡、いちばん深い所の巡が3以上か
    上のレベルは、どの系統（入口・深い読み・最初の1マス）も下のレベルより易しい側に戻らない。
    1: 段1だけで解ける
    2: 入口があり、段2まで、どこも1巡で決まる
    3: 入口が無く、段2まで、どこも1巡で決まる
    4: 入口が無く、深い読みがある（5 に当たらないもの）
    5: 入口が無く、最初の1マスに2巡以上要り、3巡以上の所か段3がある
    入口があって深い読みもある問題は、入口の系統で L3 より易しく、深い読みの系統で L3 より難しいので、
    どのレベルにも入れない（unlisted-combination）。
    """
    if out_of_range_reason(f):
        return None
    if f["tier_max"] == 1:
        return 1
    entry = f["entry"] >= 1
    deep = f["depth_max"] >= 2 or f["t3"] >= 1
    if entry:
        return None if deep else 2
    if not deep:
        return 3
    if f["first_sweeps"] >= 2 and (f["depth_max"] >= 3 or f["t3"] >= 1):
        return 5
    return 4


def _sized(lv, n, allowed):
    if lv is None:
        return None
    return lv if n in allowed[lv] else None


SIZES_B = {1: (4,), 2: (4, 5), 3: (5,), 4: (5,), 5: (5,)}
SIZES_C = {1: (4,), 2: (4, 5), 3: (5,), 4: (5, 6), 5: (6,)}
SIZES_C2 = {1: (4,), 2: (4, 5), 3: (5, 6), 4: (5, 6), 5: (5, 6)}
SIZES_H = {1: (4,), 2: (5,), 3: (5,), 4: (5, 6), 5: (5, 6)}


def prop_B(f, d, check_virtual=True):
    """段 × 巡 × 入口（4×4 と 5×5）。"""
    lv = _sized(reading_level(f), f["n"], SIZES_B)
    return lv if not check_virtual or _virtual_ok(d, lv, prop_B) else None


def prop_C(f, d, check_virtual=True):
    """段 × 巡 × 入口、L4 で 6×6 を許し、L5 は 6×6 だけ。"""
    lv = _sized(reading_level(f), f["n"], SIZES_C)
    return lv if not check_virtual or _virtual_ok(d, lv, prop_C) else None


def prop_C2v3(f, d, check_virtual=True):
    """版 3 の C2（段 × 巡 × 入口、L3 から 5×5 と 6×6 を重ねて許す）。比べるために残す。"""
    lv = _sized(reading_level(f), f["n"], SIZES_C2)
    return lv if not check_virtual or _virtual_ok(d, lv, prop_C2v3) else None


# ---------------------------------------------------------------------------
# 版 4 の分類（比べるために残す。採った版 5 は下の classify_v5）
# ---------------------------------------------------------------------------
#
# 読み方・数え方の自然な変種（AGREE_V4）のどれで測っても同じレベルになる問題だけにレベルを付ける。
# 1つでも違うレベル（範囲外を含む）になる問題は reading-dependent として出さない。これがレベルの帯の間の空きになる。
# 段3の所の巡は数え方（fresh・carry・cum）で揺れるので、レベルの条件には段2の所の巡と、段3があるかだけを使う。
# L1 は、段1だけで解け、与える数が極小（どの1つを外しても段1だけでは解けない）な問題。入口の数では分けない。

AGREE = ["carry", "cum", "lock_all", "lock_eph", "memoryless", "one", "fewest", "hidden_next", "lock_next",
         "range2", "viol2", "short3_1", "short3_2", "range1", "viol1", "jointk2", "chain2", "nohidden",
         "chain_nolock", "strong", "weak"]


def is_tier1_minimal(geo: Geometry, givens: list[int]) -> bool:
    """段1だけで解け、どの与える数を1つ外しても段1だけでは解けないか。"""
    def t1(g):
        return read_solve(geo, g, max_tier=1)["status"] == "solved"
    if not t1(givens):
        return False
    return all(not t1([0 if j == i else v for j, v in enumerate(givens)]) for i, v in enumerate(givens) if v)


def level_v4_raw(f, cap: int | None = DEPTH_CAP) -> tuple[int | None, str | None]:
    """盤面に依らない、1つの読むモデルでのレベル（版 4 の梯子）。cap=None なら巡の上限を当てない。"""
    if f["status"] != "solved":
        return None, "requires-trial"
    if f["tier_max"] >= 4:
        return None, "long-line"
    if cap is not None and (f["d2max"] > cap or f["d3max"] > cap):
        return None, "too-deep"
    if f["tier_max"] == 1:
        return 1, None
    entry = f["entry"] >= 1
    deep = f["d2max"] >= 2 or f["t3"] >= 1
    if entry:
        return (None, "unlisted-combination") if deep else (2, None)
    if not deep:
        return 3, None
    hard_first = f["first_tier"] >= 3 or (f["first_tier"] == 2 and f["first_sweeps"] >= 2
                                          and (f["d2max"] >= 3 or f["t3"] >= 1))
    return (5, None) if hard_first else (4, None)


def single_level_v4(f, n: int, sizes=None, cap: int | None = DEPTH_CAP) -> tuple[int | None, str | None]:
    """1つの読むモデルの特徴 f でのレベル。4×4 は f["_virtual"]（同じ読み方に仮想の列を足した特徴）で下がる問題を除く。"""
    lv, why = level_v4_raw(f, cap)
    if lv is None:
        return None, why
    if sizes is not None and n not in sizes[lv]:
        return None, "size-not-allowed"
    vf = f.get("_virtual")
    if n == 4 and vf is not None and vf["status"] == "solved":
        vl, _ = level_v4_raw(vf, cap)
        if vl is not None and vl < lv:
            return None, "virtual-shortcut"
    return lv, None


def classify_v4(d, sizes=None) -> tuple[int | None, str | None]:
    """版 4 のレベルと範囲外の理由。d は refresh_features の後の候補（base・var・l1_minimal を持つ）。"""
    f = d["base"]
    lv, why = single_level_v4(f, d["n"], sizes)
    if lv is None:
        return None, why
    if lv == 1 and not d.get("l1_minimal", False):
        return None, "not-minimal"
    for v in AGREE_V4:
        if single_level_v4(d["var"][v], d["n"], sizes)[0] != lv:
            return None, "reading-dependent"
    return lv, None


# ---------------------------------------------------------------------------
# 版 5 の分類（採った案）
# ---------------------------------------------------------------------------
#
# 版 4 の 21 の変種に、ゲームのメモ（1マス4つまで）に書ける分だけ覚える人（memo4）・長い鎖を段3に数える人
# （chain4t3）・斜めの列を鎖につながない人（diag_nochain）を足した 24 を「読み方の部品」（AGREE）とし、
# 部品の1つ・2つ・3つの組み合わせ（AGREE_COMBOS。設定がぶつかる組と、strong・weak に含まれて設定が変わらない組は除く）
# のどれで測っても基準と同じレベル（範囲外を含む）になる問題だけにレベルを付ける。
# 比べるレベルには巡の上限を当てない（cap=None）。巡の上限（DEPTH_CAP）と L1 の段1での極小は、基準の読むモデルで
# 測る作り方の決まりで、読み方で値を比べない。

AGREE_V4 = list(AGREE)
AGREE = AGREE_V4 + ["memo4", "chain4t3", "diag_nochain"]


def variant_kw(name: str) -> dict | None:
    """変種の名前（"a+b+c" は組み合わせ）を read_solve の設定にする。設定がぶつかれば None。"""
    kw: dict = {}
    for part in name.split("+"):
        for k, v in VARIANTS[part].items():
            if k in kw and kw[k] != v:
                return None
            kw[k] = v
    return kw


def agree_combos(items=None, max_k: int = 3) -> list[str]:
    """一致を求める読み方: 部品の1つ・2つ・3つの組み合わせ（ぶつかる組と、足しても設定が変わらない組を除く）。"""
    items = AGREE if items is None else items
    out = []
    for r in range(1, max_k + 1):
        for t in itertools.combinations(items, r):
            name = "+".join(t)
            kw = variant_kw(name)
            if kw is None or (r > 1 and any(kw == VARIANTS[x] for x in t)):
                continue
            out.append(name)
    return out


AGREE_COMBOS = agree_combos()
AGREE_CODE_VERSION = "v5-1"   # 一致の確かめの結果を書き置く（--cache）ときの版。読むモデルや変種を変えたら上げる


def combo_level(geo: Geometry, g: list[int], name: str, sizes=None) -> tuple[int | None, str | None]:
    """組み合わせ name の読み方での、巡の上限を当てないレベル。4×4 は同じ読み方に仮想の列を足したときも当てる。"""
    kw = variant_kw(name)
    f = read_features(geo, g, read_solve(geo, g, **kw))
    if geo.n == 4:
        f["_virtual"] = read_features(geo, g, read_solve(geo, g, extra_lines=VIRTUAL4, **kw))
    return single_level_v4(f, geo.n, sizes, cap=None)


def agreement_combos(geo: Geometry, g: list[int], base_level: int, full: bool = False) -> dict:
    """部品の2つ・3つの組み合わせが、基準のレベル base_level（盤面の割り当てを当てない）と同じかを確かめる。
    違う組を見つけたら止める（full なら全部）。単独の部品は measure_all の var で確かめる。"""
    bad = []
    checked = 0
    for name in AGREE_COMBOS:
        if "+" not in name:
            continue
        checked += 1
        if combo_level(geo, g, name)[0] != base_level:
            bad.append(name)
            if not full:
                break
    return {"bad": bad, "checked": checked}


_AGREE_CACHE: dict = {}
AGREE_CACHE_PATH = os.environ.get("MSD_AGREE_CACHE")


def _cache_key(d) -> str:
    return f"{AGREE_CODE_VERSION}|{d['n']}|{','.join(map(str, d['givens']))}"


def load_agree_cache(path: str | None):
    global AGREE_CACHE_PATH
    AGREE_CACHE_PATH = path
    _AGREE_CACHE.clear()
    if path and os.path.exists(path):
        for line in open(path):
            x = json.loads(line)
            _AGREE_CACHE[x["key"]] = x["agree"]


def needs_combos(d) -> int | None:
    """組み合わせを確かめる必要がある候補なら、基準のレベル（盤面の割り当てを当てない）を返す。"""
    lv, _ = single_level_v4(d["base"], d["n"], None)
    if lv is None:
        return None
    for v in AGREE:
        if single_level_v4(d["var"][v], d["n"], None, cap=None)[0] != lv:
            return None
    return lv


def classify_v5(d, sizes=None) -> tuple[int | None, str | None]:
    """版 5 のレベルと範囲外の理由。d は refresh_features の後の候補（base・var・l1_minimal・agree を持つ）。"""
    f = d["base"]
    lv, why = single_level_v4(f, d["n"], sizes)
    if lv is None:
        return None, why
    if lv == 1 and not d.get("l1_minimal", False):
        return None, "not-minimal"
    for v in AGREE:
        if single_level_v4(d["var"][v], d["n"], sizes, cap=None)[0] != lv:
            return None, "reading-dependent"
    ag = d.get("agree")
    if ag is None:
        ag = agreement_combos(geo_of(d["n"]), d["givens"], single_level_v4(f, d["n"], None)[0])
        d["agree"] = ag
    if ag["bad"]:
        return None, "reading-dependent"
    return lv, None


def _make_v4(sizes, doc, classify=None):
    classify = classify or classify_v5
    def prop(f, d, check_virtual=True):
        if f is d.get("base"):
            return classify(d, sizes)[0]
        return single_level_v4(f, d["n"], sizes, cap=None)[0]
    prop.__doc__ = doc
    prop.v4 = True
    prop.sizes = sizes
    prop.classify = classify
    return prop


def prop_D(f, d, check_virtual=True):
    """段 × 巡 × 入口を 5×5 だけで（規模を使わない）。"""
    return reading_level(f) if f["n"] == 5 else None


def prop_E(f, d, check_virtual=True):
    """試し置きの戻しを主なつまみにする（4×4〜6×6）。"""
    if out_of_range_reason(f):
        return None
    if f["tier_max"] == 1:
        return 1 if f["n"] == 4 else None
    u = _rp(d)
    lv = 2 if u <= 2 else 3 if u <= 9 else 4 if u <= 29 else 5
    return lv if not check_virtual or _virtual_ok(d, lv, prop_E) else None


def prop_F(f, d, check_virtual=True):
    """1か所を読む重さ（読んだ列の組の数の最大）と段（4×4〜6×6）。"""
    if out_of_range_reason(f):
        return None
    t = f["tier_max"]
    if t == 1:
        return 1 if f["n"] == 4 else None
    cm = f["combos_max"]
    lv = 2 if cm <= 2 else 3 if cm <= 4 else 4 if cm <= 7 else 5
    return lv if not check_virtual or _virtual_ok(d, lv, prop_F) else None


prop_C2 = _make_v4(SIZES_C2, "版 5: 入口 × 段2の巡 × 段3 × 最初の1マス、L3 から 5×5 と 6×6 を重ね、読み方の部品の3つまでの組み合わせで一致する問題だけ。")
prop_Cv4 = _make_v4(SIZES_C, "版 5 の分類で、L3 は 5×5、L4 は 5×5・6×6、L5 は 6×6 だけ（2番手）。")
prop_C2v4 = _make_v4(SIZES_C2, "版 4 の C2（21 の変種の単独で一致、巡の上限はどの変種でも）。比べるために残す。", classify=classify_v4)


def prop_G(f, d, check_virtual=True):
    """案 C2 に、L5 の慣れた試し置きの戻しの下限（30回）を足す。"""
    lv = prop_C2(f, d, check_virtual)
    if lv == 5 and _rp(d) < 30:
        return None
    return lv


def prop_H(f, d, check_virtual=True):
    """案 C2 で、4×4 を L1 だけにする（L2 から 5×5）。"""
    return _sized(reading_level(f), f["n"], SIZES_H)


PROPOSALS = {"A": prop_A, "B": prop_B, "C": prop_C, "C2": prop_C2, "D": prop_D, "E": prop_E,
             "F": prop_F, "G": prop_G, "H": prop_H, "C2v3": prop_C2v3, "C2v4": prop_C2v4, "Cv4": prop_Cv4}


MONO_UP = ["tier_max", "is_deep", "first_hard", "is_vdeep"]  # 分類に使う特徴（版 4）
RECORD_UP = ["d2max", "t3", "hard", "deep"]                    # 記録だけの特徴
MONO_DOWN = ["entry"]


def level_and_reason(P, f, d):
    """(レベル, 範囲外の理由)。理由は requires-trial / long-line / too-deep / too-light / virtual-shortcut /
    size-not-allowed（読みのレベルはあるが、その盤面の大きさを許していない）/ unlisted-combination。"""
    if getattr(P, "v4", False):
        if f is d.get("base"):
            return P.classify(d, P.sizes)
        return single_level_v4(f, d["n"], P.sizes, cap=None if P.classify is classify_v5 else DEPTH_CAP)
    if f["status"] != "solved":
        return None, "requires-trial"
    lv = P(f, d)
    if lv:
        return lv, None
    r = out_of_range_reason(f)
    if r:
        return None, r
    if P(f, d, check_virtual=False):
        return None, "virtual-shortcut"
    if reading_level(f) is not None:
        return None, "size-not-allowed"
    return None, "unlisted-combination"


def classify_all(P, ds, key="base"):
    out = []
    for d in ds:
        f = d["base"] if key == "base" else d["var"].get(key)
        if f is None or f["status"] != "solved":
            out.append(None)
            continue
        out.append(P(f, d))
    return out


def givens_key(d):
    geo = geo_of(d["n"])
    return canonical_key(geo, d["givens"])


def fingerprint(d):
    return tuple(tuple(s[:2]) for s in d["base"]["trace"])


def layout_key(d):
    geo = geo_of(d["n"])
    mask = [1 if v else 0 for v in d["givens"]]
    return canonical_key(geo, mask)


A3_GROUPS = (
    ("一致を求める部品（AGREE。範囲内では 0%）", AGREE),
    ("意味を変えない変種", ["mirror"]),
    ("列をまたぐ重い読み", ["joint3", "joint4", "combo2", "combo3", "jointk3d2", "long3", "lin", "allx"]),
    ("メモの上限の別案", ["memo3", "memo5", "memo6", "hull4"]),
    ("段の付け方の別案", ["chain3t3", "chaint3", "jk2t2"]),
    ("1巡の区切り方の組み合わせ", ["lock_next_eph"]),
    ("鎖を短く分けて読む", ["chain3"]),
    ("単位を決まった順に読み、すぐ反映する数え方（巡ではなく走査の回数になる）",
     ["seq_nat", "seq_rev", "seq_r1", "seq_r2", "seq_r3"]),
    ("読む範囲を狭める変種", ["nolock", "hidden2"]),
    ("定義を直す前のモデル", ["nochain", "v3", "v1"]),
)


def report_proposal(name, ds, conds, lines_out, detail=True):
    P = PROPOSALS[name]
    lv = classify_all(P, ds)
    W = lines_out.append
    W(f"## 案 {name}: {P.__doc__.strip()}")
    by = {L: [d for d, l in zip(ds, lv) if l == L] for L in range(1, 6)}
    W("| レベル | 件数 | 盤面の内訳 | 与える数 | 入口のマス | 最初の1マスの巡 | 段2の所の巡の最大 | 3マス空きの列を読む回数 | 組の突き合わせ（段2以上の回数） | 絞り直し（2巡以上の回数） | 鎖の列の数（最大） | 慣れた試し置きの戻し | 戻さず解けた割合 | 無作為の試し置きが上限内に解けた割合 |")
    W("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for L in range(1, 6):
        g = by[L]
        if not g:
            W(f"| {L} | 0 | | | | | | | | | | | | |")
            continue
        sizes = {}
        for d in g:
            sizes[d["n"]] = sizes.get(d["n"], 0) + 1
        sz = " ".join(f"{k}×{k}:{v}" for k, v in sorted(sizes.items()))
        b = [d["base"] for d in g]
        first = statistics.fmean(naive_rate(d, "rp", lambda r: r[0] == 1 and r[1] == 0) for d in g)
        rn = statistics.fmean(naive_rate(d, "rn") for d in g)
        W(f"| {L} | {len(g)} | {sz} | {q3([x['givens'] for x in b])} | {q3([x['entry'] for x in b])} | "
          f"{q3([x['first_sweeps'] for x in b])} | {q3([x['d2max'] for x in b])} | {q3([x['t3'] for x in b])} | "
          f"{q3([x['hard'] for x in b])} | {q3([x['deep'] for x in b])} | {q3([x['chain_max'] for x in b])} | "
          f"{q3([_rp(d) for d in g])} | {first:.2f} | {rn:.2f} |")
    # 範囲外の理由
    reasons = {}
    for d, l in zip(ds, lv):
        if l is None:
            r = level_and_reason(P, d["base"], d)[1]
            reasons[r] = reasons.get(r, 0) + 1
    W(f"- 当たらない候補: {dict(sorted(reasons.items()))}")
    # B1 逆転
    inv = []
    rec = []
    for feat in MONO_UP + MONO_DOWN + ["rp"] + RECORD_UP:
        for L in range(1, 5):
            a, b = by[L], by[L + 1]
            if not a or not b:
                continue
            xa = [(_rp(d) if feat == "rp" else d["base"][feat]) for d in a]
            xb = [(_rp(d) if feat == "rp" else d["base"][feat]) for d in b]
            for p in (0.1, 0.5, 0.9):
                pa, pb = pct(xa, p), pct(xb, p)
                if (feat in MONO_DOWN and pb > pa) or (feat not in MONO_DOWN and pb < pa):
                    (rec if feat in RECORD_UP else inv).append(f"{feat} L{L}/L{L+1} p{int(p*100)} ({pa}→{pb})")
    W(f"- B1 逆転（分類に使う特徴と試し置きの戻し）: {', '.join(inv) if inv else '無し'}")
    W(f"- B1 逆転（記録だけの特徴）: {', '.join(rec) if rec else '無し'}")
    # B2 同じ盤面での分かれ方 / C2 同じレベルの盤面ごと
    parts = []
    for n in (4, 5, 6, 7):
        row = []
        for L in range(1, 6):
            g = [d for d in by[L] if d["n"] == n]
            if len(g) >= 3:
                row.append(f"L{L} 組{statistics.median(d['base']['hard'] for d in g):g}・絞り直し{statistics.median(d['base']['deep'] for d in g):g}・戻し{statistics.median(_rp(d) for d in g):g}")
        if len(row) >= 2:
            parts.append(f"{n}×{n}: " + " / ".join(row))
    allc = [(d["n"], l) for d, l in zip(ds, lv) if l]
    W(f"- B2 同じ盤面（中央値）: {'; '.join(parts) if parts else '共有する盤面なし'}")
    W(f"- B2 盤面とレベルの順位相関: {spearman([a for a, b in allc], [b for a, b in allc])}")
    # A3
    for title, names in A3_GROUPS:
        a3 = []
        for var in names:
            vl = classify_all(P, ds, key=var)
            pairs = [(a, b) for a, b, d in zip(lv, vl, ds) if a is not None and (var != "virtual" or d["n"] == 4)]
            if not pairs:
                continue
            ch = sum(1 for a, b in pairs if a != b)
            ch2 = sum(1 for a, b in pairs if b is None or abs(a - b) >= 2)
            into = sum(1 for a, b in zip(lv, vl) if a is None and b is not None)
            a3.append(f"{var} {ch}/{len(pairs)} ({ch/len(pairs):.1%}; 2段以上か範囲外へ {ch2}; 範囲外から入る {into})")
        W(f"- A3 {title}でレベルが変わる: {'; '.join(a3)}")
    if getattr(P, "v4", False):
        # 一致を求めることで外した問題（1つの読むモデルではレベルがあるが、変種で違うレベルになる）
        single = []
        for d in ds:
            x = single_level_v4(d["base"], d["n"], P.sizes)[0]
            if x == 1 and not d.get("l1_minimal", False):
                x = None
            single.append(x)
        v5 = P.classify is classify_v5
        items = AGREE if v5 else AGREE_V4
        vcap = None if v5 else DEPTH_CAP
        ex = []
        for v in items:
            k = sum(1 for d, x in zip(ds, single)
                    if x is not None and single_level_v4(d["var"][v], d["n"], P.sizes, cap=vcap)[0] != x)
            ex.append(f"{v} {k}")
        W(f"- 一致を求めて外した問題（基準のモデルで範囲内 {sum(1 for x in single if x)}、外した数）: {', '.join(ex)}")
        if v5:
            only = [d for d, x, l in zip(ds, single, lv) if x is not None and l is None and d.get("agree", {}).get("bad")
                    and all(single_level_v4(d["var"][v], d["n"], P.sizes, cap=None)[0] == x for v in AGREE)]
            first = {}
            for d in only:
                first[d["agree"]["bad"][0]] = first.get(d["agree"]["bad"][0], 0) + 1
            W(f"- 単独の部品では一致し、2つ・3つの組み合わせ（{sum(1 for c in AGREE_COMBOS if '+' in c)} 通り）で外した問題: {len(only)}"
              f"（最初に見つかった組: {dict(sorted(first.items(), key=lambda kv: -kv[1])[:8])}）")
        span = {}
        for d, x, l in zip(ds, single, lv):
            if x is not None and l is None:
                levels = {x} | {single_level_v4(d["var"][v], d["n"], P.sizes, cap=vcap)[0] for v in items}
                key = "/".join(str(y) if y else "範囲外" for y in sorted(levels, key=lambda y: (y is None, y or 0)))
                span[key] = span.get(key, 0) + 1
        W(f"- 外した問題が変種でとるレベルの組: {dict(sorted(span.items(), key=lambda kv: -kv[1]))}")
        per = {}
        for d, x, l in zip(ds, single, lv):
            if x:
                c = per.setdefault((d["n"], x), [0, 0])
                c[0] += 1
                c[1] += 1 if l else 0
        W("- 盤面とレベルごとの残る割合（一致を求めた後 / 基準のモデル）: " + ", ".join(
            f"{n}×{n} L{x} {c[1]}/{c[0]}" for (n, x), c in sorted(per.items())))
    if not detail:
        W("")
        return lv
    # A5
    a5 = []
    for L in range(1, 6):
        g = by[L]
        if len(g) >= 10:
            a5.append(f"L{L} 絞り直し〜空き {spearman([d['base']['deep'] for d in g], [d['base']['empties'] for d in g])}・組の読み〜空き {spearman([d['base']['hard'] for d in g], [d['base']['empties'] for d in g])}")
    lv_e = [(d["base"]["empties"], l) for d, l in zip(ds, lv) if l]
    W(f"- A5 レベル内の順位相関: {'; '.join(a5)}。レベルと空きの数 {spearman([a for a, b in lv_e], [b for a, b in lv_e])}")
    strata = {}
    for d, l in zip(ds, lv):
        if l:
            strata.setdefault((d["n"], d["base"]["empties"]), []).append(l)
    st = []
    for (n, e), ls in sorted(strata.items()):
        if len(ls) >= 20 and len(set(ls)) >= 2:
            st.append(f"{n}×{n} 空き{e}: " + " ".join(f"L{L}:{ls.count(L)}" for L in range(1, 6) if ls.count(L)))
    W(f"- A5 空きの数をそろえた層でのレベルの内訳: {'; '.join(st) if st else '無し'}")
    # B4
    cl = [d for d, l in zip(ds, lv) if l]
    if len(cl) > 10:
        feats = ["entry", "first_hard", "is_vdeep", "d2max", "t3", "hard", "empties"]
        cols = {k: [d["base"][k] for d in cl] for k in feats}
        cols["rp"] = [_rp(d) for d in cl]
        pairs = []
        keys = list(cols)
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                pairs.append(f"{keys[i]}-{keys[j]} {spearman(cols[keys[i]], cols[keys[j]])}")
        W(f"- B4 特徴どうしの順位相関（分類された問題）: {', '.join(pairs)}")
    # B5
    kinds = [("組の突き合わせ", lambda b: b["hard"] >= 1), ("鎖を読む", lambda b: b["chain_max"] >= 2),
             ("組の数を他で使わない", lambda b: b["lock"] >= 1),
             ("この数はここだけ", lambda b: b["hidden"] >= 1), ("3マス空きの列", lambda b: b["t3"] >= 1),
             ("段2の絞り直し", lambda b: b["d2max"] >= 2), ("段2で3巡以上", lambda b: b["d2max"] >= 3),
             ("最初から組を読む", lambda b: b["entry"] == 0),
             ("最初の1マスに段3か2巡以上", lambda b: b["first_hard"] >= 1)]
    W("- B5 推論の種類が現れる割合: " + "; ".join(
        f"L{L} " + ", ".join(f"{k} {sum(1 for d in by[L] if fn(d['base']))/len(by[L]):.0%}" for k, fn in kinds)
        for L in range(1, 6) if by[L]))
    # C1 帯の中の最も弱い問題 / C2 盤面ごと
    c1 = []
    for L in range(1, 6):
        g = by[L]
        if g:
            c1.append(f"L{L} 組の読み 最小{min(d['base']['hard'] for d in g)}・最大{max(d['base']['hard'] for d in g)}, 戻し 最小{min(_rp(d) for d in g):g}・最大{max(_rp(d) for d in g):g}")
    W(f"- C1 帯の中の幅: {'; '.join(c1)}")
    c2 = []
    for L in range(1, 6):
        row = []
        for n in (4, 5, 6, 7):
            g = [d for d in by[L] if d["n"] == n]
            if len(g) >= 3:
                row.append(f"{n}×{n} 組{statistics.median(d['base']['hard'] for d in g):g}・絞り直し{statistics.median(d['base']['deep'] for d in g):g}・段2の巡{statistics.median(d['base']['d2max'] for d in g):g}・戻し{statistics.median(_rp(d) for d in g):g}")
        if len(row) >= 2:
            c2.append(f"L{L}: " + " / ".join(row))
    W(f"- C2 同じレベルの盤面ごとの中央値: {'; '.join(c2) if c2 else '1つの盤面だけ'}")
    # D1 表示ごと
    d1 = []
    for L in range(1, 6):
        g = by[L]
        if g:
            d1.append(f"L{L} あと表示 {statistics.median(_rp(d) for d in g):g}・合否だけ {statistics.median(naive_med(d, 'fp') for d in g):g}・表示なし {statistics.median(naive_med(d, 'np') for d in g):g}"
                      f"（表示なしで上限内 {statistics.fmean(naive_rate(d, 'np') for d in g):.0%}）")
    W(f"- D1 慣れた試し置きの戻し（中央値）を表示ごとに: {'; '.join(d1)}")
    # E1 収率
    e1 = []
    for L in range(1, 6):
        best = []
        for c, cnt in conds.items():
            k = sum(1 for d, l in zip(ds, lv) if l == L and (d["n"], d["T"], d["k"]) == c)
            if k:
                best.append((k / cnt, c))
        best.sort(reverse=True)
        e1.append(f"L{L} " + ", ".join(f"{c[0]}×{c[0]} T{c[1]} k{c[2]} {r:.0%}" for r, c in best[:3]))
    W(f"- E1 収率（当たりやすい生成条件の上位3つ）: {'; '.join(e1)}")
    # E3 重複・指紋・4×4 の多様さ
    e3 = []
    for L in range(1, 6):
        g = by[L]
        if not g:
            continue
        keys = {}
        for d in g:
            k = givens_key(d)
            keys[k] = keys.get(k, 0) + 1
        dup = sum(v - 1 for v in keys.values())
        fps = {}
        for d in g:
            fps[fingerprint(d)] = fps.get(fingerprint(d), 0) + 1
        top = max(fps.values())
        extra = ""
        g4 = [d for d in g if d["n"] == 4]
        if g4:
            extra = (f"、4×4 {len(g4)}問で魔方陣 {len({tuple(d['canon']) for d in g4})}種・"
                     f"与える数の置き場所 {len({layout_key(d) for d in g4})}種")
        e3.append(f"L{L} 重複{dup}・解く手順の指紋{len(fps)}種（最多{top/len(g):.0%}）{extra}")
    W(f"- E3: {'; '.join(e3)}")
    W("")
    return lv


def measure_all(geo: Geometry, g: list[int]):
    """1問を、基準の読むモデル・全部の変種・向き違いで測る。4×4 は読み方ごとに仮想の列を足した特徴も付ける。
    (基準の特徴, 変種ごとの特徴, 段1で極小か, 基準の read_solve の結果)"""
    res = read_solve(geo, g)
    base = read_features(geo, g, res)
    base["trace"] = [[s["tier"], s["sweeps"], s["placed"], "".join(k[0] for k in s["kinds"]), int(s["lock"])]
                     for s in res["steps"]]
    var = {}
    for name, kw in VARIANTS.items():
        var[name] = read_features(geo, g, read_solve(geo, g, **kw))
        if geo.n == 4:
            var[name]["_virtual"] = read_features(geo, g, read_solve(geo, g, extra_lines=VIRTUAL4, **kw))
    perm = geo.symmetries()[5]
    gm = rotate_givens(geo, g, perm)
    var["mirror"] = read_features(geo, gm, read_solve(geo, gm))
    if geo.n == 4:
        var["virtual"] = read_features(geo, g, read_solve(geo, g, extra_lines=VIRTUAL4))
        base["_virtual"] = var["virtual"]
        var["mirror"]["_virtual"] = read_features(geo, gm, read_solve(geo, gm, extra_lines=VIRTUAL4))
    minimal = geo.n == 4 and base["tier_max"] == 1 and is_tier1_minimal(geo, g)
    return base, var, minimal, res


def _refresh_one(d):
    base, var, minimal, _ = measure_all(geo_of(d["n"]), d["givens"])
    return base, var, minimal


def _agree_one(d):
    lv = needs_combos(d)
    if lv is None:
        return {"bad": [], "checked": 0, "skipped": True}
    return agreement_combos(geo_of(d["n"]), d["givens"], lv)


def refresh_features(ds, jobs: int = 4, combos: bool = True):
    """読むモデルの特徴を、今のコードで与える数から測り直す（素朴な解き方の結果はそのまま）。
    combos なら、単独の部品で一致した候補の、部品の組み合わせでの一致も確かめる（AGREE_CACHE_PATH があれば書き置きを使い、
    足りない分を測って書き足す）。"""
    import multiprocessing as mp
    if jobs > 1:
        with mp.Pool(jobs) as pool:
            out = pool.map(_refresh_one, ds, chunksize=8)
    else:
        out = [_refresh_one(d) for d in ds]
    for d, (base, var, minimal) in zip(ds, out):
        d["base"] = base
        d["var"] = var
        d["l1_minimal"] = minimal
    if not combos:
        return
    if AGREE_CACHE_PATH and not _AGREE_CACHE:
        load_agree_cache(AGREE_CACHE_PATH)
    todo = []
    for d in ds:
        hit = _AGREE_CACHE.get(_cache_key(d))
        if hit is not None:
            d["agree"] = hit
        else:
            todo.append(d)
    if not todo:
        return
    fh = open(AGREE_CACHE_PATH, "a") if AGREE_CACHE_PATH else None

    def put(d, ag):
        d["agree"] = ag
        _AGREE_CACHE[_cache_key(d)] = ag
        if fh:
            fh.write(json.dumps({"key": _cache_key(d), "id": d.get("id"), "agree": ag}, separators=(",", ":")) + "\n")
            fh.flush()
    if jobs > 1:
        with mp.Pool(jobs) as pool:
            for d, ag in zip(todo, pool.imap(_agree_one, todo, chunksize=1)):
                put(d, ag)
    else:
        for d in todo:
            put(d, _agree_one(d))
    if fh:
        fh.close()


def cmd_agree(a):
    """部品の組み合わせでの一致を確かめ、書き置き（--cache）に足す。--limit 件ずつ続きから測れる。"""
    load_agree_cache(a.cache)
    ds = load(a.inputs)
    left = [d for d in ds if _cache_key(d) not in _AGREE_CACHE]
    if a.limit:
        left = left[:a.limit]
    t = time.time()
    refresh_features(left)
    print(f"{len(left)} 候補を測った（残り {len(ds) - len(_AGREE_CACHE)} 前後）。{time.time() - t:.0f} 秒", file=sys.stderr)


def cmd_report(a):
    ds = load(a.inputs)
    refresh_features(ds)
    conds = {}
    for d in ds:
        c = (d["n"], d["T"], d["k"])
        conds[c] = conds.get(c, 0) + 1
    out = []
    bad = [d["id"] for d in ds if d["exact"]["count"] != 1]
    out.append(f"候補 {len(ds)}（一意解でないもの {len(bad)}）。読むモデルで解けたもの {sum(1 for d in ds if d['base']['status']=='solved')}")
    for name in a.proposals:
        report_proposal(name, ds, conds, out, detail=not a.brief)
    print("\n".join(out))


def cmd_sizes(a):
    """盤面の大きさごとの値（読みの段ごとの収率・生成時間・解の数え上げの重さ・素朴な解き方）。"""
    ds = load(a.inputs)
    refresh_features(ds)
    print("| 盤面 | 候補 | 1候補を作る時間 p50 / p95（秒） | 一意性の確かめの節点 p50 / p95 / 最大 | 与える数 | 空き | "
          "読みの段 1 / 2 / 3 / 4 / 5 / 範囲外（件） | 段5 の慣れた試し置きの戻し | 段5 の戻さず解けた割合 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for n in sorted({d["n"] for d in ds}):
        g = [d for d in ds if d["n"] == n]
        tg = [d["t_square"] + d["t_reduce"] for d in g]
        nodes = [d["exact"]["nodes"] for d in g]
        lv = [classify_v5(d)[0] for d in g]  # 盤面に依らない版 5 のレベル（部品の組み合わせで一致するもの）
        cnt = [sum(1 for x in lv if x == L) for L in range(1, 6)] + [sum(1 for x in lv if x is None)]
        g5 = [d for d, x in zip(g, lv) if x == 5]
        r5 = q3([_rp(d) for d in g5]) if g5 else "-"
        f5 = f"{statistics.fmean(naive_rate(d, 'rp', lambda r: r[0] == 1 and r[1] == 0) for d in g5):.2f}" if g5 else "-"
        print(f"| {n}×{n} | {len(g)} | {pct(tg, .5):.2f} / {pct(tg, .95):.2f} | {pct(nodes, .5)} / {pct(nodes, .95)} / {max(nodes)} | "
              f"{q3([d['base']['givens'] for d in g])} | {q3([d['base']['empties'] for d in g])} | "
              f"{' / '.join(map(str, cnt))} | {r5} | {f5} |")


def cmd_classify(a):
    """候補ごとのレベルと主な特徴を JSONL で書く（問題供給・図鑑の観点の入口）。"""
    P = PROPOSALS[a.proposal]
    ds = load(a.inputs)
    refresh_features(ds)
    with open(a.out, "w") as fh:
        for d in ds:
            f = d["base"]
            lv, reason = level_and_reason(P, f, d)
            keep = {k: f[k] for k in FEATURE_KEYS}
            fh.write(json.dumps({"id": d["id"], "seed": d["seed"], "T": d["T"], "k": d["k"], "level": lv,
                                 "reason": reason, "agree_bad": (d.get("agree") or {}).get("bad", []),
                                 "features": keep, "naive_rp_undos": _rp(d),
                                 "givens": d["givens"], "solution": d["solution"]},
                                separators=(",", ":")) + "\n")


FEATURE_KEYS = ("n", "givens", "empties", "entry", "first_tier", "first_sweeps", "first_hard", "is_deep", "is_vdeep",
                "tier_max", "d2max",
                "d3max", "depth_max", "t3", "t1depth", "hard", "deep", "deep3", "lock", "hidden", "chain_max",
                "combos_med", "combos_max")

EXPECTED_CASES = list(dict.fromkeys([
    # (n, T, k, 候補番号) 生成条件ごとに2つずつ
    *[(n, T, k, i) for n in (4, 5, 6) for T in (1, 2, 3) for k in (0, 2) for i in (0, 1)],
    *[(n, T, 12, i) for n in (5, 6) for T in (2, 3) for i in (0, 1)],
    # 資料 §7 の代表・最も弱い問題と、範囲外の理由ごとの例（4×4〜6×6 の各レベルが入るように）
    (4, 2, 1, 14), (4, 2, 1, 30), (5, 2, 1, 1), (5, 2, 1, 13), (5, 2, 0, 51), (5, 2, 0, 11),
    (6, 2, 12, 26), (6, 2, 2, 38), (5, 3, 12, 5), (5, 2, 12, 85), (6, 3, 12, 16), (6, 2, 12, 18),
    (5, 3, 12, 105), (5, 3, 12, 71), (6, 3, 12, 47), (6, 3, 12, 79),
    (4, 1, 1, 0), (5, 3, 0, 20), (5, 2, 0, 12), (4, 2, 1, 1), (5, 2, 0, 1),
    # メモ4つまでの人だけで外れる問題と、部品の組み合わせだけで外れる問題
    (5, 3, 0, 5), (5, 2, 0, 54), (5, 2, 12, 11),
]))


def cmd_expected(a):
    """採った案の、seed ごとの結果を移植の期待値に書く（検査 F2）。"""
    P = PROPOSALS[a.proposal]
    cases = []
    for n, T, k, i in EXPECTED_CASES:
        log: dict = {}
        cand = generate_candidate(n, T, k, i, log=log)
        geo = geo_of(n)
        g = cand["givens"]
        ex = count_solutions(geo, g, limit=2, node_cap=2_000_000)
        base, var, minimal, res = measure_all(geo, g)
        d = {"n": n, "givens": g, "base": base, "var": var, "l1_minimal": minimal, "naive": {"rp": [[1, 0, 0]]}}
        lv, reason = level_and_reason(P, base, d)
        variants = {}
        for v in AGREE:
            r2 = read_solve(geo, g, **VARIANTS[v])
            item = {"status": r2["status"], "steps": [[st["tier"], st["sweeps"], st["found"], st["cells"]]
                                                      for st in r2["steps"]],
                    "level": single_level_v4(var[v], n, SIZES_C2, cap=None)[0]}
            if n == 4:
                item["virtual_level"] = level_v4_raw(var[v]["_virtual"], None)[0]
            variants[v] = item
        bl = needs_combos(d)
        combos = (agreement_combos(geo, g, bl) if bl is not None else {"bad": [], "checked": 0, "skipped": True})
        cases.append({
            "id": cand["id"], "n": n, "T": T, "k": k, "index": i, "seed": cand["seed"],
            "solution": cand["solution"], "givens": g,
            "reduce": {"removal_order": log["removal_order"], "kept": log["kept"],
                       "minimal_givens": log["minimal_givens"], "read_calls": cand["reduce_calls"]},
            "polish_calls": cand["polish_calls"],
            "exact": {"count": ex["count"], "nodes": ex["nodes"]},
            "read": {"status": res["status"],
                     "steps": [{"tier": st["tier"], "sweeps": st["sweeps"], "cells": st["cells"],
                                "values": [res.get("grid", g)[c] for c in st["cells"]],
                                "found": st["found"],
                                "kinds": st["kinds"], "lock": st["lock"], "combos": st["combos"],
                                "chain": st["chain"]}
                               for st in res["steps"]]},
            "features": {k2: base[k2] for k2 in FEATURE_KEYS},
            "tier1_minimal": minimal,
            "virtual_level": (level_v4_raw(var["virtual"])[0] if n == 4 else None),
            "single_level": single_level_v4(base, n, SIZES_C2)[0],
            "variants": variants,
            "combos": combos,
            "level": lv,
            "reason": reason,
        })
    out = {
        "about": "魔方陣の難易度の調査コード（magic_square_difficulty.py）の移植の期待値（版 5）。"
                 "読むモデル（基準と、一致を求める部品とその組み合わせ）・完全な解法器・極小化の採否を、同じ盤面で突き合わせるために使う。"
                 "variants は部品ごとの記録とレベル（巡の上限を当てない）、combos は部品の2つ・3つの組み合わせ（agree_combos の順）"
                 "で基準とレベルが違った最初の組（bad。無ければ全部一致）と確かめた数（checked）。"
                 "魔方陣と空ける順は Python の random で作ったもので、移植したコードの乱数とは一致しない。",
        "proposal": a.proposal,
        "depth_cap": DEPTH_CAP,
        "depth_cap_rule": "基準の読むモデルだけで測る（作り方の決まり）。一致は巡の上限を当てないレベルで比べる",
        "read_defaults": {k2: v for k2, v in DEFAULT_READ.items() if k2 != "extra_lines"},
        "agree_variants": {v: VARIANTS[v] for v in AGREE},
        "agree_combos": [c for c in AGREE_COMBOS if "+" in c],
        "polish_key_variants": list(POLISH_KEY_VARIANTS),
        "virtual_lines_4x4": [list(L) for L, _ in VIRTUAL4],
        "cases": cases,
    }
    with open(a.out, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"{len(cases)} cases -> {a.out}", file=sys.stderr)


def _register_report(sub):
    cache_help = "部品の組み合わせでの一致の書き置き（JSONL）。無い分は測って書き足す"
    q = sub.add_parser("agree")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--cache", required=True, help=cache_help)
    q.add_argument("--limit", type=int, default=0)
    q.set_defaults(fn=cmd_agree)
    q = sub.add_parser("sizes")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--cache", help=cache_help)
    q.set_defaults(fn=cmd_sizes)
    q = sub.add_parser("classify")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--proposal", default="C2")
    q.add_argument("--out", required=True)
    q.add_argument("--cache", help=cache_help)
    q.set_defaults(fn=cmd_classify)
    q = sub.add_parser("expected")
    q.add_argument("--proposal", default="C2")
    q.add_argument("--out", required=True)
    q.set_defaults(fn=cmd_expected)
    q = sub.add_parser("report")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--proposals", nargs="+", default=list(PROPOSALS))
    q.add_argument("--brief", action="store_true")
    q.add_argument("--cache", help=cache_help)
    q.set_defaults(fn=cmd_report)


if __name__ == "__main__":
    main()
