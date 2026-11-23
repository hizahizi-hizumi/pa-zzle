#!/usr/bin/env python3
"""ソリティア（PZL-013）難易度の観点の調査コード。

ルール（合意 Version 2）:
- 52枚・7列（左から1〜7枚）。列の札は全部表向き。山札24枚は裏向きで、1枚ずつめくり、何周でもめくれる。
- 列には赤黒交互・降順に重ねる。並んだ所はまとめて動かせる。空いた列には K とその下に並んだ札だけ。
- 組札はマークごとに A から。組札の札も列へ戻せる。

読むモデル（人間向け解法器）: 山札を「いつでも取れる札の集まり」として扱う。
  1枚ずつ何周でもめくれるので、山札と捨て札のどの札もめくり進めれば捨て札の一番上に出せ、
  1枚取っても残りの巡回の順は変わらない。列は全部表なので、山札の中身は見えている札の残りとして分かる。
  したがって山札の並びは、解けるかどうかと読みの中身に効かず、めくる回数（作業量）にだけ効く。
試すモデル（素朴な解き方）: 実際の山札の順でめくり、捨て札の一番上だけを使う。

札の番号: card = suit * 13 + (rank - 1)。suit: 0=S(♠) 1=H(♥) 2=D(♦) 3=C(♣)。赤は H と D。
列の並び: col[0] が一番奥、col[-1] が一番上（手前）。山札: stock[0] が次にめくる札。

特徴の定義は版1〜7 がある。今の定義は版7（features_v7 → classify_v7。段 T × 罠の後の進み G を1手の区切り方の両端で求める）。
版5 は版4 と同じ定義を、規則の手をすべて使う読むモデル（Solver(bc=True)・AliveOracle(bc=True)）で求める。
版6 は版5 と同じ読むモデル・同じ札で、G を規則の1手で区切った端（G_f。版5 の G）と、選びとその後の強制手を1手にまとめた端（G_b）で求め、
両端の段がそろう問題だけを分類する（fatal_depths_grouping・g_stage_v6）。版6 の特徴は版5 の特徴に _grp の鍵を足しただけなので、版5 の値は変わらない。
版7 は版6 のまとめる側の端の選ぶ所を、手の行き先が違う所（本当の選ぶ所。real_choices）に替え、安全な札をすぐ送る網を
どの順でも打てる網（restrict_safe_all）にしたもの（fatal_depths_v7・g_stage_v7）。版7 の特徴は版6 の特徴に _v7 の鍵を足しただけなので、版6 の値は変わらない。
版1〜6 の関数とコマンドは、資料 §14 の再現のために残してある。版1〜4 の読むモデルは bc=False のままなので、値は変わらない。
状態の知らせの判定 foundation_progress_reachable は版5 で直した（直す前は foundation_progress_reachable_v1）。
  版1 の notify コマンドは直した関数を呼ぶので、資料 §2.3 の版1 の値（34・20・6）とは違う値（31・24・5）を出す。
  版1 の値は foundation_progress_reachable_v1 に替えると出る。分類に使う量（期待値ファイルの値）は、この関数を使わない。

標準ライブラリだけで書き、乱数はすべて seed を固定する。
使い方は末尾の main を参照。
"""
from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
import time

sys.setrecursionlimit(20000)

RANK = [c % 13 + 1 for c in range(52)]
SUIT = [c // 13 for c in range(52)]
RED = [SUIT[c] in (1, 2) for c in range(52)]
RANK_TEXT = {1: "A", 11: "J", 12: "Q", 13: "K"}
SUIT_TEXT = "SHDC"
ALL_CARDS = (1 << 52) - 1


def card_text(c: int) -> str:
    return RANK_TEXT.get(RANK[c], str(RANK[c])) + SUIT_TEXT[SUIT[c]]


def parse_card(t: str) -> int:
    r = {"A": 1, "J": 11, "Q": 12, "K": 13}.get(t[:-1])
    if r is None:
        r = int(t[:-1])
    return SUIT_TEXT.index(t[-1]) * 13 + r - 1


# STK[c][x]: c を x の上に置ける（x より1小さく、色が違う）
STK = [[RANK[x] == RANK[c] + 1 and RED[x] != RED[c] for x in range(52)] for c in range(52)]
# ONTO[c]: c を置ける2枚。UNDER[x]: x の上に置ける2枚
ONTO = [tuple(x for x in range(52) if STK[c][x]) for c in range(52)]
UNDER = [tuple(u for u in range(52) if STK[u][x]) for x in range(52)]
# TWIN[c]: 同じ数・同じ色のもう1枚
TWIN = [next(t for t in range(52) if t != c and RANK[t] == RANK[c] and RED[t] == RED[c]) for c in range(52)]


def deal(seed: int):
    """seed から配る。列 i に i+1 枚、残り24枚が山札（stock[0] が次にめくる札）。"""
    rnd = random.Random(seed)
    d = list(range(52))
    rnd.shuffle(d)
    tab = []
    i = 0
    for n in range(1, 8):
        tab.append(tuple(d[i:i + n]))
        i += n
    return tuple(tab), tuple(d[28:])


def deal_text(tab, stock) -> dict:
    return {
        "columns": [" ".join(card_text(c) for c in col) for col in tab],
        "stock": " ".join(card_text(c) for c in stock),
    }


def run_start(col) -> int:
    """一番上から続く並び（赤黒交互・降順）の始まりの位置。"""
    i = len(col) - 1
    while i > 0 and STK[col[i]][col[i - 1]]:
        i -= 1
    return i


def safe_to_foundation(c: int, fnd) -> bool:
    """組札へ運んでも解ける見込みを失わない札（列へ戻す手があっても成り立つ条件）。

    rank<=2、または相手色の組札が両方 rank-1 以上で、同じ色のもう一方が rank-2 以上。
    このとき c の上に乗り得る札（c より小さい札の鎖）はすべて組札にあり、c を列に残す理由が無い。
    """
    r = RANK[c]
    s = SUIT[c]
    if fnd[s] != r - 1:
        return False
    if r <= 2:
        return True
    if RED[c]:
        o1, o2, same = 0, 3, (2 if s == 1 else 1)
    else:
        o1, o2, same = 1, 2, (3 if s == 0 else 0)
    return fnd[o1] >= r - 1 and fnd[o2] >= r - 1 and fnd[same] >= r - 2


def pool_of(tab, fnd) -> int:
    m = ALL_CARDS
    for col in tab:
        for c in col:
            m &= ~(1 << c)
    for s in range(4):
        for r in range(fnd[s]):
            m &= ~(1 << (s * 13 + r))
    return m


class Limit(Exception):
    pass


class Solver:
    """読むモデルの解法器（山札は「いつでも取れる札」）。

    手の種類（kind）:
      F  列の一番上か山札の札を組札へ（安全な組札送り safe_to_foundation は auto で先に済ませる）
      R  並びの始まりから上を丸ごと動かす（下の札が出る）
      E  列の一番奥から始まる並び（K 以外）を丸ごと動かして列を空ける
      P  並びの途中から上を動かす（partial=True のとき）
    動かす先は、ほかの列の一番上、空いた列（K だけ）、または山札の札・組札の一番上（back=True のとき）を
    先に列へ置いて作った足場（chain。下から順に (札, 'S'=山札 / 'B'=組札)）。
    山札・組札の札を列へ置く手は、その上へ列の札を動かす手と一続きにだけ打つ。山札・組札の札を列へ置く
    理由は上に札を乗せることだけなので、乗せる直前まで遅らせた解き方がいつも残る（遅延の議論）。
    足場の長さは chain_depth 枚まで。
    eager=True のときは、組札へ運べる札はすぐ運ぶ（組札へ運ぶのを待つ手を許さない）。
    bc=True のとき（版5 の読むモデル）は、組札の一番上を、山札・組札の札の足場の上へ戻す手（BC）も打つ。
      版4 までは、足場の上に乗せるのは列の札だけで、組札から戻す手は列の一番上へ直接置くものだけだった。
      そのため「山札の札を足場に並べ、その上へ組札の一番上を戻す」手順の要る局面を解けないとしていた（版4 に当てた反例探し）。

    そのほかの枝刈り:
      E は、空いた列へ入れられる K（並びの中の奥でない K、山札の K、組札の K）があるときだけ。
      P は、出てくる札が組札へ行けるか、動かす札と同じ数・同じ色の札が動かせる所にあるか、
      出てくる札がほかの列へ動けるときだけ（遅延の議論で、使う直前まで遅らせられる）。
      行き止まり: 並びの始まりの札 x（K 以外）が、同じ列のより奥に同じマークの小さい札を持ち、
      x を置ける2枚がどちらも同じ列のより奥にある（back=False なら組札にあるものも）とき、その局面は解けない。
    状態の同一視: 列の並び替え（列は入れ替えても同じ）と組札。山札の中身は列と組札から決まる。
    """

    def __init__(self, partial=True, back=True, eager=False, limit=200_000, want_path=False, chain_depth=12, pfilter="v1", bc=False):
        # pfilter: 並びの途中から動かす手の枝刈り。v1 は版1 の調査で使ったもの。v2 は版2 で使う、より強い枝刈り
        # （出てくる札がほかの列へ動ける場合を外し、同じ数・同じ色の札が山札か組札にあるときは、その札の上に乗せる札が
        # 今あるときだけ打つ。どちらも遅延の議論で、使う直前まで遅らせた解き方が残る）
        self.pfilter = pfilter
        self.partial = partial
        self.back = back
        self.eager = eager
        self.limit = limit
        self.want_path = want_path
        self.chain_depth = chain_depth
        self.bc = bc
        self._fnd_tops = 0

    def auto(self, tab, fnd, pool):
        tab = list(tab)
        fnd = list(fnd)
        moved = True
        log = []
        while moved:
            moved = False
            for i in range(7):
                col = tab[i]
                if col:
                    c = col[-1]
                    if fnd[SUIT[c]] == RANK[c] - 1 and (self.eager or safe_to_foundation(c, fnd)):
                        fnd[SUIT[c]] += 1
                        tab[i] = col[:-1]
                        moved = True
                        log.append(("F", c, i, -1, ()))
            for s in range(4):
                if fnd[s] < 13:
                    c = s * 13 + fnd[s]
                    if pool >> c & 1 and (self.eager or safe_to_foundation(c, fnd)):
                        fnd[s] += 1
                        pool &= ~(1 << c)
                        moved = True
                        log.append(("F", c, -2, -1, ()))
        return tuple(tab), tuple(fnd), pool, log

    def dead(self, tab, fnd):
        for col in tab:
            n = len(col)
            for k in range(1, n):
                x = col[k]
                if RANK[x] == 13 or STK[x][col[k - 1]]:
                    continue
                s = SUIT[x]
                r = RANK[x]
                lower_below = False
                below = set()
                for k2 in range(k):
                    d = col[k2]
                    below.add(d)
                    if SUIT[d] == s and RANK[d] < r:
                        lower_below = True
                if not lower_below:
                    continue
                ok = False
                for y in ONTO[x]:
                    if y in below:
                        continue
                    if not self.back and fnd[SUIT[y]] >= RANK[y]:
                        continue
                    ok = True
                    break
                if not ok:
                    return True
        return False

    def landings(self, c, i, tops, first_empty, fnd, pool, depth):
        """c をほかの列へ置く先。戻り値: [(列, 足場)]。"""
        if RANK[c] == 13:
            return [(first_empty, ())] if first_empty >= 0 else []
        res = []
        for y in ONTO[c]:
            j = tops.get(y)
            if j is not None:
                if j != i:
                    res.append((j, ()))
                continue
            if depth <= 0:
                continue
            if pool >> y & 1:
                src = "S"
            elif self.back and fnd[SUIT[y]] == RANK[y]:
                src = "B"
            else:
                continue
            for j2, ch in self.landings(y, i, tops, first_empty, fnd, pool, depth - 1):
                res.append((j2, ch + ((y, src),)))
        return res

    def _has_user(self, y, movable, reserve, memo, depth=0):
        """y（山札か組札の札）の上に、今動かせる列の札か、同じ条件を満たす山札・組札の札を乗せられるか。"""
        if y in memo:
            return memo[y]
        memo[y] = False
        ok = False
        for u in UNDER[y]:
            if movable >> u & 1:
                ok = True
                break
            if self.bc and self._fnd_tops >> u & 1:
                # 版5: 組札の一番上は、足場の上へ戻す手（BC）で y の上に乗せられる
                ok = True
                break
            if depth < 13 and reserve >> u & 1 and self._has_user(u, movable, reserve, memo, depth + 1):
                ok = True
                break
        memo[y] = ok
        return ok

    def moves(self, tab, fnd, pool):
        out = []
        starts = [run_start(col) if col else 0 for col in tab]
        first_empty = next((j for j in range(7) if not tab[j]), -1)
        tops = {}
        for j, col in enumerate(tab):
            if col:
                tops[col[-1]] = j
        movable = 0
        for i, col in enumerate(tab):
            if col:
                if self.partial:
                    for k in range(starts[i], len(col)):
                        movable |= 1 << col[k]
                else:
                    movable |= 1 << col[starts[i]]
        fnd_tops = 0
        if self.back:
            for s in range(4):
                if fnd[s] > 0:
                    fnd_tops |= 1 << (s * 13 + fnd[s] - 1)
        self._fnd_tops = fnd_tops
        # F: 組札へ（安全でないもの）
        if not self.eager:
            for i, col in enumerate(tab):
                if col:
                    c = col[-1]
                    if fnd[SUIT[c]] == RANK[c] - 1:
                        t = list(tab)
                        t[i] = col[:-1]
                        f = list(fnd)
                        f[SUIT[c]] += 1
                        out.append((0, 0, ("F", c, i, -1, ()), tuple(t), tuple(f), pool))
            for s in range(4):
                if fnd[s] < 13:
                    c = s * 13 + fnd[s]
                    if pool >> c & 1:
                        f = list(fnd)
                        f[s] += 1
                        out.append((0, 0, ("F", c, -2, -1, ()), tab, tuple(f), pool & ~(1 << c)))
        king_available = None
        for i, col in enumerate(tab):
            if not col:
                continue
            st = starts[i]
            ks = range(st, len(col)) if self.partial else (st,)
            for k in ks:
                c = col[k]
                if k > st:
                    below = col[k - 1]
                    useful = fnd[SUIT[below]] == RANK[below] - 1
                    if self.pfilter == "v1":
                        if not useful:
                            useful = bool((movable | pool | fnd_tops) >> TWIN[c] & 1)
                        if not useful:
                            for y in ONTO[below]:
                                j = tops.get(y)
                                if j is not None and j != i:
                                    useful = True
                    else:
                        if not useful:
                            tw = TWIN[c]
                            if movable >> tw & 1:
                                useful = True
                            elif self.bc and fnd_tops >> tw & 1:
                                # 版5: もう1枚が組札の一番上なら、下に出る札の上へ戻して、その下の組札の札を出す使い道もある
                                useful = True
                            elif (pool | fnd_tops) >> tw & 1:
                                useful = self._has_user(tw, movable, pool | fnd_tops, {})
                    if not useful:
                        continue
                    kind = "P"
                elif k == 0:
                    if RANK[c] == 13:
                        continue
                    if king_available is None:
                        king_available = False
                        for i2, col2 in enumerate(tab):
                            for k2 in range(starts[i2], len(col2)) if col2 else ():
                                if RANK[col2[k2]] == 13 and k2 > 0:
                                    king_available = True
                        for s in range(4):
                            kc = s * 13 + 12
                            if pool >> kc & 1 or (self.back and fnd[s] == 13):
                                king_available = True
                    if not king_available:
                        continue
                    kind = "E"
                else:
                    kind = "R"
                for j, ch in self.landings(c, i, tops, first_empty, fnd, pool, self.chain_depth):
                    t = list(tab)
                    f = fnd
                    p = pool
                    if ch:
                        f = list(fnd)
                        for y, src in ch:
                            if src == "S":
                                p &= ~(1 << y)
                            else:
                                f[SUIT[y]] -= 1
                        f = tuple(f)
                    t[i] = col[:k]
                    t[j] = tab[j] + tuple(y for y, _ in ch) + col[k:]
                    prio = {"R": 1, "E": 4, "P": 5}[kind] + (1 if ch else 0)
                    sub = RANK[col[k - 1]] if k > 0 else 0
                    out.append((prio, sub, (kind, c, i, j, ch), tuple(t), f, p))
        if self.back and self.pfilter != "v1":
            # 組札の一番上を、足場としてではなく、その下の組札の札を出すために列へ戻す手（版2 で足した）。
            # その組札の山のどれかの札の上に、今動かせる列の札（か同じ条件の山札・組札の札）を乗せられるときだけ打つ
            # （遅延の議論: 戻す理由は、戻した札か、その下から出てくる札の上に札を乗せることだけ）。
            # 「役に立ち得る札」: 今動かせる列の札を乗せられる札と、役に立ち得る山札・組札の札を乗せられる札を、
            # 組札の重なり順を無視して広げた集まり（本当に役立つ札を必ず含む緩めた判定）
            fnd_all = 0
            for s in range(4):
                for r in range(fnd[s]):
                    fnd_all |= 1 << (s * 13 + r)
            reserve = pool | fnd_all
            useful_set = 0
            frontier = movable
            while frontier:
                new_cards = 0
                f2 = frontier
                while f2:
                    u = (f2 & -f2).bit_length() - 1
                    f2 &= f2 - 1
                    for x in ONTO[u]:
                        if not useful_set >> x & 1:
                            new_cards |= 1 << x
                useful_set |= new_cards
                frontier = new_cards & reserve
            for s in range(4):
                if fnd[s] == 0:
                    continue
                pile = 0
                for r in range(fnd[s]):
                    pile |= 1 << (s * 13 + r)
                if not useful_set & pile and not self.bc:
                    # 版5（bc=True）では絞らない
                    continue
                y = s * 13 + fnd[s] - 1
                for j in range(7):
                    dst = tab[j]
                    if dst:
                        if not STK[y][dst[-1]]:
                            continue
                    elif RANK[y] != 13 or j != first_empty:
                        continue
                    t = list(tab)
                    t[j] = dst + (y,)
                    f = list(fnd)
                    f[s] -= 1
                    out.append((6, 0, ("B", y, -1, j, ()), tuple(t), tuple(f), pool))
        if self.back and self.bc:
            # 版5: 組札の一番上 y を、山札・組札の札の足場の上へ戻す手（BC）。足場なしで戻す手は上の B にある。
            # 遅延の議論の「足場の上に乗せるもの」に、列の札だけでなく組札から戻す札も入れるために足した。枝刈りはしない
            for s in range(4):
                if fnd[s] == 0:
                    continue
                y = s * 13 + fnd[s] - 1
                f1 = list(fnd)
                f1[s] -= 1
                f1 = tuple(f1)
                for j, ch in self.landings(y, -1, tops, first_empty, f1, pool, self.chain_depth):
                    if not ch:
                        continue
                    t = list(tab)
                    f = list(f1)
                    p = pool
                    for c, src in ch:
                        if src == "S":
                            p &= ~(1 << c)
                        else:
                            f[SUIT[c]] -= 1
                    t[j] = tab[j] + tuple(c for c, _ in ch) + (y,)
                    out.append((7, 0, ("BC", y, -1, j, ch), tuple(t), tuple(f), p))
        out.sort(key=lambda m: (m[0], m[1]))
        return out

    def solve(self, tab, fnd=(0, 0, 0, 0), pool=None):
        """戻り値: (status, nodes, path)。status は win / lose / unknown（打ち切り）。"""
        if pool is None:
            pool = pool_of(tab, fnd)
        self.seen = set()
        self.nodes = 0
        path = []

        def dfs(tab, fnd, pool):
            tab, fnd, pool, log = self.auto(tab, fnd, pool)
            if fnd == (13, 13, 13, 13):
                if self.want_path:
                    path.extend(reversed(log))
                return True
            key = (tuple(sorted(tab)), fnd)
            if key in self.seen:
                return False
            self.seen.add(key)
            self.nodes += 1
            if self.nodes > self.limit:
                raise Limit
            if self.dead(tab, fnd):
                return False
            for m in self.moves(tab, fnd, pool):
                if dfs(m[3], m[4], m[5]):
                    if self.want_path:
                        path.append(m[2])
                        path.extend(reversed(log))
                    return True
            return False

        try:
            ok = dfs(tuple(tab), tuple(fnd), pool)
        except Limit:
            return "unknown", self.nodes, None
        if ok:
            path.reverse()
            return "win", self.nodes, path
        return "lose", self.nodes, None


# ---------------------------------------------------------------------------
# 試すモデル: 「置ける所に置き、無ければめくる」（実際の山札の順）


def naive_candidates(tab, fnd, waste, include_empty_moves=True):
    out = []  # (class, move)
    for i, col in enumerate(tab):
        if col:
            c = col[-1]
            if fnd[SUIT[c]] == RANK[c] - 1:
                out.append((0, ("TF", i)))
    if waste:
        w = waste[-1]
        if fnd[SUIT[w]] == RANK[w] - 1:
            out.append((0, ("WF",)))
    first_empty = next((j for j in range(7) if not tab[j]), -1)
    for i, col in enumerate(tab):
        if not col:
            continue
        st = run_start(col)
        c = col[st]
        if st == 0 and (RANK[c] == 13 or not include_empty_moves):
            continue
        for j in range(7):
            if j == i:
                continue
            dst = tab[j]
            if dst:
                if STK[c][dst[-1]]:
                    out.append((1 if st > 0 else 3, ("TT", i, st, j)))
            elif RANK[c] == 13 and j == first_empty:
                out.append((1, ("TT", i, st, j)))
    if waste:
        w = waste[-1]
        for j in range(7):
            dst = tab[j]
            if dst:
                if STK[w][dst[-1]]:
                    out.append((2, ("WT", j)))
            elif RANK[w] == 13 and j == first_empty:
                out.append((2, ("WT", j)))
    return out


def naive_play(tab0, stock0, rnd=None, mode="random", record=False, include_empty_moves=True, choices=None):
    """試すモデル。mode: random（置ける手から無作為）/ priority（組札→列の札→捨て札の順）。

    戻り値: dict(win, placements, draws, path)。path は (手, 状態, 置ける手の数, 選んだ番号) の列（record=True のとき）。
    choices を渡すと、乱数の代わりにその番号の列で選ぶ（移植の突き合わせ用。番号は naive_candidates の並び）。
    詰み: 置く手が無いまま山札を1周めくっても置く手が出ない。
    """
    choice_iter = iter(choices) if choices is not None else None
    tab = [tuple(c) for c in tab0]
    stock_rev = list(reversed(stock0))  # 末尾が次にめくる札
    waste = []
    fnd = [0, 0, 0, 0]
    flips_since = 0
    placements = 0
    draws = 0
    path = []
    while True:
        if fnd == [13, 13, 13, 13]:
            return {"win": True, "placements": placements, "draws": draws, "path": path}
        cands = naive_candidates(tab, fnd, waste, include_empty_moves)
        if cands:
            if mode == "priority":
                cands.sort(key=lambda m: m[0])
                idx = 0
            elif choice_iter is not None:
                idx = next(choice_iter)
            else:
                idx = rnd.randrange(len(cands))
            mv = cands[idx][1]
            if record:
                path.append((mv, (tuple(tab), tuple(fnd), pool_mask(stock_rev, waste)), len(cands), idx))
            if mv[0] == "TF":
                c = tab[mv[1]][-1]
                tab[mv[1]] = tab[mv[1]][:-1]
                fnd[SUIT[c]] += 1
            elif mv[0] == "WF":
                c = waste.pop()
                fnd[SUIT[c]] += 1
            elif mv[0] == "TT":
                _, i, st, j = mv
                tab[j] = tab[j] + tab[i][st:]
                tab[i] = tab[i][:st]
            elif mv[0] == "WT":
                tab[mv[1]] = tab[mv[1]] + (waste.pop(),)
            placements += 1
            flips_since = 0
        else:
            total = len(stock_rev) + len(waste)
            if total == 0 or flips_since > total + 1:
                if record:
                    path.append((("STUCK",), (tuple(tab), tuple(fnd), pool_mask(stock_rev, waste)), 0, -1))
                return {"win": False, "placements": placements, "draws": draws, "path": path}
            if stock_rev:
                waste.append(stock_rev.pop())
            else:
                stock_rev = list(reversed(waste))
                waste = []
            flips_since += 1
            draws += 1


def pool_mask(stock_rev, waste):
    m = 0
    for c in stock_rev:
        m |= 1 << c
    for c in waste:
        m |= 1 << c
    return m


def naive_rate(tab, stock, trials, seed):
    rnd = random.Random(seed)
    wins = 0
    for _ in range(trials):
        if naive_play(tab, stock, rnd, "random")["win"]:
            wins += 1
    return wins / trials


# ---------------------------------------------------------------------------
# 試すモデル: 1手ずつの試し置きと待った（山札はいつでも取れる扱い。置ける手だけを打つ）


def natural_moves_free(tab, fnd, pool):
    out = []
    for i, col in enumerate(tab):
        if col:
            c = col[-1]
            if fnd[SUIT[c]] == RANK[c] - 1:
                t = list(tab)
                t[i] = col[:-1]
                f = list(fnd)
                f[SUIT[c]] += 1
                out.append((tuple(t), tuple(f), pool))
    for s in range(4):
        if fnd[s] < 13:
            c = s * 13 + fnd[s]
            if pool >> c & 1:
                f = list(fnd)
                f[s] += 1
                out.append((tab, tuple(f), pool & ~(1 << c)))
    first_empty = next((j for j in range(7) if not tab[j]), -1)
    for i, col in enumerate(tab):
        if not col:
            continue
        st = run_start(col)
        c = col[st]
        if st == 0 and RANK[c] == 13:
            continue
        for j in range(7):
            if j == i:
                continue
            dst = tab[j]
            if dst:
                if not STK[c][dst[-1]]:
                    continue
            elif not (RANK[c] == 13 and j == first_empty):
                continue
            t = list(tab)
            t[j] = dst + col[st:]
            t[i] = col[:st]
            out.append((tuple(t), fnd, pool))
    p = pool
    while p:
        y = (p & -p).bit_length() - 1
        p &= p - 1
        for j in range(7):
            dst = tab[j]
            if dst:
                if not STK[y][dst[-1]]:
                    continue
            elif not (RANK[y] == 13 and j == first_empty):
                continue
            t = list(tab)
            t[j] = dst + (y,)
            out.append((tuple(t), fnd, pool & ~(1 << y)))
    return out


def trial_and_undo(tab, stock, seed, undo_budget):
    """置ける手を無作為に打ち、置ける手が無くなったら1手ずつ待ったで戻る（同じ局面には戻らない）。

    戻り値: (win, undos)。undo_budget を超えたら (False, undo_budget+1)。
    """
    rnd = random.Random(seed)
    fnd = (0, 0, 0, 0)
    pool = pool_of(tab, fnd)
    seen = set()
    undos = 0
    stack = []

    def push(state):
        k = (tuple(sorted(state[0])), state[1])
        if k in seen:
            return False
        seen.add(k)
        ms = natural_moves_free(*state)
        rnd.shuffle(ms)
        stack.append(ms)
        return True

    state = (tuple(tab), fnd, pool)
    push(state)
    states = [state]
    while stack:
        if states[-1][1] == (13, 13, 13, 13):
            return True, undos
        ms = stack[-1]
        advanced = False
        while ms:
            nxt = ms.pop()
            if push(nxt):
                states.append(nxt)
                advanced = True
                break
        if not advanced:
            stack.pop()
            states.pop()
            undos += 1
            if undos > undo_budget:
                return False, undos
    return False, undos


# ---------------------------------------------------------------------------
# 試すモデル: 「置ける所に置き、無ければめくる」に待ったを足したもの（実際の山札の順）


def _naive_apply(mv, state):
    tab, fnd, stock_rev, waste = state
    tab = list(tab)
    fnd = list(fnd)
    if mv[0] == "TF":
        c = tab[mv[1]][-1]
        tab[mv[1]] = tab[mv[1]][:-1]
        fnd[SUIT[c]] += 1
    elif mv[0] == "WF":
        c = waste[-1]
        waste = waste[:-1]
        fnd[SUIT[c]] += 1
    elif mv[0] == "TT":
        _, i, st, j = mv
        tab[j] = tab[j] + tab[i][st:]
        tab[i] = tab[i][:st]
    elif mv[0] == "WT":
        tab[mv[1]] = tab[mv[1]] + (waste[-1],)
        waste = waste[:-1]
    return tuple(tab), tuple(fnd), stock_rev, waste


def _naive_advance(state, include_empty_moves=True):
    tab, fnd, stock_rev, waste = state
    flips = 0
    while True:
        if fnd == (13, 13, 13, 13):
            return (tab, fnd, stock_rev, waste), "win", flips
        cands = naive_candidates(tab, fnd, waste, include_empty_moves)
        if cands:
            return (tab, fnd, stock_rev, waste), [m for _, m in cands], flips
        total = len(stock_rev) + len(waste)
        if total == 0 or flips > total + 1:
            return (tab, fnd, stock_rev, waste), None, flips
        if stock_rev:
            waste = waste + (stock_rev[-1],)
            stock_rev = stock_rev[:-1]
        else:
            stock_rev = tuple(reversed(waste))
            waste = ()
        flips += 1


def naive_undo(tab0, stock0, rnd, budget=300, include_empty_moves=True):
    """置ける手を無作為に打ち、詰んだら待ったで直前の分かれ道まで戻って別の手を試す。

    戻り値: (win, undone, backtracks)。undone は待ったで戻した置く手の数（めくりは数えない）。
    budget を超えたら打ち切って win=False。同じ局面（山札の位置を含む）には二度入らない。
    """
    s0, c0, _ = _naive_advance((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()), include_empty_moves)
    if c0 == "win":
        return True, 0, 0
    if c0 is None:
        return False, 0, 0
    visited = {s0}
    c0 = list(c0)
    rnd.shuffle(c0)
    stack = [[s0, c0, 0]]
    undone = 0
    backtracks = 0
    while stack:
        fr = stack[-1]
        if not fr[1]:
            stack.pop()
            continue
        mv = fr[1].pop()
        s2, c2, _ = _naive_advance(_naive_apply(mv, fr[0]), include_empty_moves)
        newp = fr[2] + 1
        if c2 == "win":
            return True, undone, backtracks
        if c2 is None or s2 in visited:
            backtracks += 1
            while stack and not stack[-1][1]:
                stack.pop()
            if not stack:
                return False, undone, backtracks
            undone += newp - stack[-1][2]
            if undone > budget:
                return False, undone, backtracks
            continue
        visited.add(s2)
        c2 = list(c2)
        rnd.shuffle(c2)
        stack.append([s2, c2, newp])
    return False, undone, backtracks


def naive_space(tab0, stock0, limit=300_000, include_empty_moves=True):
    """「置ける所に置き、無ければめくる」の手だけで、どの順に置けば解けるか（置く順の選び方をすべて試す）。

    戻り値: ("win" | "dead" | "unknown", 調べた分かれ道の局面数)。dead は「置ける手をどの順で打っても詰む」。
    分かれ道の局面は、めくりを済ませた後の (列, 組札, 山札, 捨て札)。順序は固定（候補の並び順）。
    """
    s0, c0, _ = _naive_advance((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()), include_empty_moves)
    if c0 == "win":
        return "win", 0
    if c0 is None:
        return "dead", 0
    seen = {s0}
    stack = [(s0, list(c0))]
    while stack:
        st, cands = stack[-1]
        if not cands:
            stack.pop()
            continue
        mv = cands.pop()
        s2, c2, _ = _naive_advance(_naive_apply(mv, st), include_empty_moves)
        if c2 == "win":
            return "win", len(seen)
        if c2 is None or s2 in seen:
            continue
        seen.add(s2)
        if len(seen) > limit:
            return "unknown", len(seen)
        stack.append((s2, list(c2)))
    return "dead", len(seen)


def _move_source(mv):
    """どの札を動かす手か（札を先に選び、置き場所を後に選ぶ数え方の変種で使う）。"""
    if mv[0] == "TT":
        return ("T", mv[1])
    if mv[0] == "TF":
        return ("T", mv[1])
    return ("W",)


def naive_exact(tab0, stock0, include_empty_moves=True, card_first=False):
    """置ける手から等しい確率で選ぶ素朴な解き方の、解ける確率（めくりは実際の山札の順）を正確に求める。

    戻り値: dict(win_prob, states, fatal_decisions)。
      fatal_decisions: 解ける見込みがある局面（確率>0）で、打つと素朴な手だけでは解けなくなる（確率0）手の数。
    """
    memo = {}
    fatal = set()

    def rec(st, cands):
        if st in memo:
            return memo[st]
        total = 0.0
        children = []
        for mv in cands:
            s2, c2, _ = _naive_advance(_naive_apply(mv, st), include_empty_moves)
            if c2 == "win":
                v = 1.0
            elif c2 is None:
                v = 0.0
            else:
                v = rec(s2, c2)
            children.append((mv, v))
            total += v
        if card_first:
            groups = {}
            for mv, v in children:
                groups.setdefault(_move_source(mv), []).append(v)
            val = sum(sum(vs) / len(vs) for vs in groups.values()) / len(groups)
        else:
            val = total / len(cands)
        memo[st] = val
        if val > 0:
            for mv, v in children:
                if v == 0:
                    fatal.add((st, mv))
        return val

    s0, c0, _ = _naive_advance((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()), include_empty_moves)
    if c0 == "win":
        return {"win_prob": 1.0, "states": 0, "fatal_decisions": 0}
    if c0 is None:
        return {"win_prob": 0.0, "states": 0, "fatal_decisions": 0}
    p = rec(s0, c0)
    return {"win_prob": p, "states": len(memo), "fatal_decisions": len(fatal)}


def savvy_play(tab, rnd, partial=False, back=False):
    """定石を知った素朴な解き方: 山札の札は、上に列の札を乗せるときだけ列へ出す（読むモデルの手の集まり）。

    安全な組札送りは自動で行い、残りの手（組札へ・列の移動・山札からの足場・列を空ける）から無作為に1つ選ぶ。
    戻らない。戻り値: 解けたか。
    """
    sv = Solver(partial=partial, back=back)
    t, f, p = tuple(tab), (0, 0, 0, 0), pool_of(tab, (0, 0, 0, 0))
    seen = set()
    for _ in range(2000):
        t, f, p, _ = sv.auto(t, f, p)
        if f == (13, 13, 13, 13):
            return True
        key = (tuple(sorted(t)), f)
        if key in seen:
            return False
        seen.add(key)
        ms = sv.moves(t, f, p)
        if not ms:
            return False
        m = ms[rnd.randrange(len(ms))]
        t, f, p = m[3], m[4], m[5]
    return False


def savvy_undo(tab, rnd, budget=300, partial=False, back=False):
    """定石つきの素朴な解き方に待ったを足したもの: 読むモデルの手（置かずに先にめくる・組札へ運ぶのを待つを含む）を
    無作為な順で打ち、行き止まりなら直前の分かれ道へ戻る。戻した手の合計が budget を超えたら打ち切る。

    戻り値: (win, undone)。
    """
    sv = Solver(partial=partial, back=back)
    seen = set()

    def node(t, f, p):
        t, f, p, _ = sv.auto(t, f, p)
        return t, f, p

    t, f, p = node(tuple(tab), (0, 0, 0, 0), pool_of(tab, (0, 0, 0, 0)))
    if f == (13, 13, 13, 13):
        return True, 0
    seen.add((tuple(sorted(t)), f))
    ms = sv.moves(t, f, p)
    rnd.shuffle(ms)
    stack = [[ms, 0]]
    undone = 0
    while stack:
        fr = stack[-1]
        if not fr[0]:
            stack.pop()
            continue
        m = fr[0].pop()
        t2, f2, p2 = node(m[3], m[4], m[5])
        depth = fr[1] + 1
        if f2 == (13, 13, 13, 13):
            return True, undone
        key = (tuple(sorted(t2)), f2)
        ms2 = [] if key in seen or sv.dead(t2, f2) else sv.moves(t2, f2, p2)
        if not ms2:
            while stack and not stack[-1][0]:
                stack.pop()
            if not stack:
                return False, undone
            undone += depth - stack[-1][1]
            if undone > budget:
                return False, undone
            continue
        seen.add(key)
        rnd.shuffle(ms2)
        stack.append([ms2, depth])
    return False, undone


def savvy_push_rate(tab, seed, runs=10, budget=100):
    """定石つき+待ったで、戻した手の合計 budget 以内に解けた回の割合（runs 回。乱数は seed*101+k）。"""
    return sum(1 for k in range(runs) if savvy_undo(tab, random.Random(seed * 101 + k), budget=budget)[0]) / runs


def savvy_rate(tab, trials, seed, **kw):
    rnd = random.Random(seed)
    return sum(1 for _ in range(trials) if savvy_play(tab, rnd, **kw)) / trials


# ---------------------------------------------------------------------------
# 状態の知らせ「どう動かしても組札へ運べなくなった」の判定（基準とするプレイ条件の確かめ用）


def foundation_progress_reachable_v1(tab, fnd, pool, limit=200_000):
    """版1〜4 の状態の知らせの判定（誤りがあり、版5 で foundation_progress_reachable に直した。§14 の再現用に残す）。

    探索の中で組札へ送る手を打たず、各局面で「1枚送れば今より多くなるか」だけを見ていた。そのため、組札から一度戻して
    並びを動かし、戻した札と下から出た札を送り直すと増える局面（版4 に当てた反例探しの seed 200・256 の詰み）で「増やせない」と答える。
    """
    base = sum(fnd)
    seen = set()
    stack = [(tuple(tab), tuple(fnd), pool)]
    nodes = 0
    while stack:
        t, f, p = stack.pop()
        key = (tuple(sorted(t)), f)
        if key in seen:
            continue
        seen.add(key)
        nodes += 1
        if nodes > limit:
            return None, nodes
        # 組札へ運べる札があるか
        for col in t:
            if col and f[SUIT[col[-1]]] == RANK[col[-1]] - 1 and sum(f) + 1 > base:
                return True, nodes
        for s_ in range(4):
            if f[s_] < 13 and p >> (s_ * 13 + f[s_]) & 1 and sum(f) + 1 > base:
                return True, nodes
        first_empty = next((j for j in range(7) if not t[j]), -1)
        # 列から列（途中から含む）
        for i, col in enumerate(t):
            if not col:
                continue
            st = run_start(col)
            for k in range(st, len(col)):
                c = col[k]
                for j in range(7):
                    if j == i:
                        continue
                    dst = t[j]
                    if dst:
                        if not STK[c][dst[-1]]:
                            continue
                    elif not (RANK[c] == 13 and k > 0 and j == first_empty):
                        continue
                    t2 = list(t)
                    t2[i] = col[:k]
                    t2[j] = dst + col[k:]
                    stack.append((tuple(t2), f, p))
        # 山札から列
        q = p
        while q:
            y = (q & -q).bit_length() - 1
            q &= q - 1
            for j in range(7):
                dst = t[j]
                if dst:
                    if not STK[y][dst[-1]]:
                        continue
                elif not (RANK[y] == 13 and j == first_empty):
                    continue
                t2 = list(t)
                t2[j] = dst + (y,)
                stack.append((tuple(t2), f, p & ~(1 << y)))
        # 組札から列
        for s_ in range(4):
            if f[s_] == 0:
                continue
            y = s_ * 13 + f[s_] - 1
            for j in range(7):
                dst = t[j]
                if dst:
                    if not STK[y][dst[-1]]:
                        continue
                elif not (RANK[y] == 13 and j == first_empty):
                    continue
                t2 = list(t)
                t2[j] = dst + (y,)
                f2 = list(f)
                f2[s_] -= 1
                stack.append((tuple(t2), tuple(f2), p))
    return False, nodes


def foundation_progress_reachable(tab, fnd, pool, limit=200_000):
    """状態の知らせの判定（版5）: 今より多くの札を組札に置ける局面へ、どれかの規則の手順で行けるか。

    規則の手をすべて1手ずつ使う（plain_legal: 組札へ送る手、並びのどこからでも列から列、山札の札を列へ、組札の一番上を列へ）。
    枝刈りはしない。組札から戻した札を送り直す手順も探す。
    戻り値: (True / False / None（打ち切り）, 調べた局面数)。False のとき知らせを出す。
    """
    base = sum(fnd)
    seen = set()
    stack = [(tuple(tab), tuple(fnd), pool)]
    nodes = 0
    while stack:
        t, f, p = stack.pop()
        key = (tuple(sorted(t)), f)
        if key in seen:
            continue
        seen.add(key)
        nodes += 1
        if nodes > limit:
            return None, nodes
        for t2, f2, p2 in plain_legal(t, f, p):
            if sum(f2) > base:
                return True, nodes
            stack.append((t2, f2, p2))
    return False, nodes


def max_foundation_reachable(tab, fnd, pool, limit=200_000):
    """どれかの規則の手順で行ける局面の、組札の枚数の最大（枝刈りなし）。戻り値: (最大, 探し切ったか, 調べた局面数)。"""
    best = sum(fnd)
    seen = set()
    stack = [(tuple(tab), tuple(fnd), pool)]
    while stack:
        t, f, p = stack.pop()
        key = (tuple(sorted(t)), f)
        if key in seen:
            continue
        seen.add(key)
        best = max(best, sum(f))
        if best == 52:
            return 52, True, len(seen)
        if len(seen) > limit:
            return best, False, len(seen)
        stack.extend(plain_legal(t, f, p))
    return best, True, len(seen)


# ---------------------------------------------------------------------------
# 静的な特徴（配った盤面から数える）


def static_features(tab, stock):
    pos = {}
    for i, col in enumerate(tab):
        for k, c in enumerate(col):
            pos[c] = (i, k)
    # 組札へ直接行けない札: 同じ列のより奥に、同じマークでより小さい札がある
    self_block = 0
    for i, col in enumerate(tab):
        for k, c in enumerate(col):
            for k2 in range(k):
                d = col[k2]
                if SUIT[d] == SUIT[c] and RANK[d] < RANK[c]:
                    self_block += 1
                    break
    # 列の切れ目（並びになっていない境目）の数
    breaks = 0
    for col in tab:
        for k in range(1, len(col)):
            if not STK[col[k]][col[k - 1]]:
                breaks += 1
    # 奥に埋まった低い札: A〜3 の上に乗っている札の数の合計
    buried_low = 0
    for c, (i, k) in pos.items():
        if RANK[c] <= 3:
            buried_low += len(tab[i]) - 1 - k
    kings_not_bottom = sum(1 for c, (i, k) in pos.items() if RANK[c] == 13 and k > 0)
    return {
        "self_block": self_block,
        "breaks": breaks,
        "buried_low": buried_low,
        "kings_not_bottom": kings_not_bottom,
        "stock_kings": sum(1 for c in stock if RANK[c] == 13),
    }


# ---------------------------------------------------------------------------
# 解き筋の確かめ（解法器が返した手順を、配った盤面から1手ずつ合法か確かめる）


def validate_path(tab0, path, fnd0=(0, 0, 0, 0), pool0=None):
    tab = [tuple(c) for c in tab0]
    fnd = list(fnd0)
    pool = pool_of(tab, fnd) if pool0 is None else pool0
    for mv in path:
        kind, c, i, j, ch = mv
        if kind == "F":
            if fnd[SUIT[c]] != RANK[c] - 1:
                return False, ("F order", mv)
            if i == -2:
                if not pool >> c & 1:
                    return False, ("F pool", mv)
                pool &= ~(1 << c)
            else:
                if not tab[i] or tab[i][-1] != c:
                    return False, ("F top", mv)
                tab[i] = tab[i][:-1]
            fnd[SUIT[c]] += 1
            continue
        if kind == "BC":
            # 版5: 組札の一番上 c を、足場（山札・組札の札）の上へ戻す
            if fnd[SUIT[c]] != RANK[c]:
                return False, ("BC top", mv)
            fnd[SUIT[c]] -= 1
            for y, src in ch:
                if src == "S":
                    if not pool >> y & 1:
                        return False, ("BC chain pool", mv)
                    pool &= ~(1 << y)
                else:
                    if fnd[SUIT[y]] != RANK[y]:
                        return False, ("BC chain fnd", mv)
                    fnd[SUIT[y]] -= 1
                dst = tab[j]
                if dst:
                    if not STK[y][dst[-1]]:
                        return False, ("BC chain stk", mv)
                elif RANK[y] != 13:
                    return False, ("BC chain empty", mv)
                tab[j] = dst + (y,)
            dst = tab[j]
            if dst:
                if not STK[c][dst[-1]]:
                    return False, ("BC stk", mv)
            elif RANK[c] != 13:
                return False, ("BC empty", mv)
            tab[j] = dst + (c,)
            continue
        if kind == "B":
            if fnd[SUIT[c]] != RANK[c]:
                return False, ("B top", mv)
            dst = tab[j]
            if dst:
                if not STK[c][dst[-1]]:
                    return False, ("B stk", mv)
            elif RANK[c] != 13:
                return False, ("B empty", mv)
            fnd[SUIT[c]] -= 1
            tab[j] = dst + (c,)
            continue
        col = tab[i]
        if c not in col:
            return False, ("src", mv)
        k = col.index(c)
        if k < run_start(col):
            return False, ("not in run", mv)
        for y, src in ch:
            if src == "S":
                if not pool >> y & 1:
                    return False, ("chain pool", mv)
                pool &= ~(1 << y)
            else:
                if fnd[SUIT[y]] != RANK[y]:
                    return False, ("chain fnd", mv)
                fnd[SUIT[y]] -= 1
            dst = tab[j]
            if dst:
                if not STK[y][dst[-1]]:
                    return False, ("chain stk", mv)
            elif RANK[y] != 13:
                return False, ("chain empty", mv)
            tab[j] = dst + (y,)
        dst = tab[j]
        if dst:
            if not STK[c][dst[-1]]:
                return False, ("stk", mv)
        elif RANK[c] != 13:
            return False, ("empty", mv)
        tab[j] = dst + col[k:]
        tab[i] = col[:k]
    return fnd == [13, 13, 13, 13], ("end", fnd)


def path_summary(path):
    moves = [m for m in path if m[0] != "F"]
    return {
        "moves": len(moves),
        "fnd_moves": sum(1 for m in path if m[0] == "F"),
        "chain_pool": sum(1 for m in path for _, s in m[4] if s == "S"),
        "chain_back": sum(1 for m in path for _, s in m[4] if s == "B"),
        "partial": sum(1 for m in path if m[0] == "P"),
        "empty_moves": sum(1 for m in path if m[0] == "E"),
    }


# ---------------------------------------------------------------------------
# 1つの配り方を調べる


SOLVER_SPACES = {
    # 名前: (partial, back, eager)
    "eager": (False, False, True),   # 組札へ運べる札はすぐ運ぶ・途中から動かさない・組札から戻さない
    "fwd": (False, False, False),    # 組札へ運ぶのを待ってよい
    "nop": (False, True, False),     # 組札から列へ戻してよい
    "nob": (True, False, False),     # 並びの途中から動かしてよい
    "full": (True, True, False),     # すべての手
}
SPACE_LIMIT = {"eager": 60_000, "fwd": 60_000, "nop": 60_000, "nob": 60_000, "full": 100_000}


def survey_one(seed, naive_trials=32, undo_budget=200, undo_runs=3, spaces_limit=None):
    lim = dict(SPACE_LIMIT)
    if spaces_limit:
        lim.update(spaces_limit)
    tab, stock = deal(seed)
    out = {"seed": seed}
    out.update(static_features(tab, stock))
    res = {}
    path = None
    t0 = time.time()
    for name in ("eager", "fwd", "nop"):
        p, b, e = SOLVER_SPACES[name]
        st, n, pth = Solver(partial=p, back=b, eager=e, limit=lim[name], want_path=True).solve(tab)
        res[name] = (st, n)
        if st == "win" and path is None:
            path = pth
    if res["fwd"][0] != "win" and res["nop"][0] != "win":
        for name in ("nob", "full"):
            p, b, e = SOLVER_SPACES[name]
            st, n, pth = Solver(partial=p, back=b, eager=e, limit=lim[name], want_path=True).solve(tab)
            res[name] = (st, n)
            if st == "win" and path is None:
                path = pth
            if st == "win":
                break
    out["solve_sec"] = round(time.time() - t0, 3)
    out["spaces"] = {k: list(v) for k, v in res.items()}
    if path is not None:
        ok, why = validate_path(tab, path)
        if not ok:
            raise RuntimeError(f"invalid path seed={seed} {why}")
        out["status"] = "win"
        out.update(path_summary(path))
    elif res.get("full", ("", 0))[0] == "lose":
        out["status"] = "lose"
    else:
        out["status"] = "unknown"
    # 必要な手筋の段
    if out["status"] == "win":
        if res["eager"][0] == "win":
            tier = "E"
        elif res["fwd"][0] == "win":
            tier = "H"
        elif res["nop"][0] == "win" and res["fwd"][0] == "lose":
            tier = "B"
        elif res["fwd"][0] == "lose" and res["nop"][0] == "lose":
            tier = "P" if res.get("nob", ("", 0))[0] == "win" else ("PB" if res.get("nob", ("", 0))[0] == "lose" else "P?")
        else:
            tier = "?"
        # eager が打ち切りで判定できないとき
        if tier == "H" and res["eager"][0] == "unknown":
            tier = "H?"
        out["tier"] = tier
    # 試すモデル
    rnd = random.Random(seed * 7919 + 1)
    wins = 0
    placements = []
    draws = []
    for _ in range(naive_trials):
        r = naive_play(tab, stock, rnd, "random")
        if r["win"]:
            wins += 1
            placements.append(r["placements"])
            draws.append(r["draws"])
    out["naive_rate"] = wins / naive_trials
    out["naive_placements_med"] = statistics.median(placements) if placements else None
    out["naive_draws_med"] = statistics.median(draws) if draws else None
    out["naive_priority"] = naive_play(tab, stock, None, "priority")["win"]
    rnd2 = random.Random(seed * 7919 + 2)
    w2 = 0
    for _ in range(naive_trials):
        if naive_play(tab, stock, rnd2, "random", include_empty_moves=False)["win"]:
            w2 += 1
    out["naive_rate_noE"] = w2 / naive_trials
    # 試し置きと待った
    tu = []
    for r_ in range(undo_runs):
        win, undos = trial_and_undo(tab, stock, seed * 1009 + r_, undo_budget)
        tu.append(undos if win else None)
    out["trial_undo"] = tu
    out["sec"] = round(time.time() - t0, 3)
    return out


# ---------------------------------------------------------------------------
# 罠の分析: 素朴な解き方が詰んだ道筋で、どの手で解けなくなり、そこから何手で詰みに気づくか


ALIVE_SPACES = ("eager", "nop")


def alive(state, limit=20_000, spaces=ALIVE_SPACES):
    """その局面から解けるか（読むモデル。並びの途中から動かす手は使わない空間で判定）。

    True / False / None（打ち切り）。
    """
    t, f, p = state
    unknown = False
    for name in spaces:
        pa, b, e = SOLVER_SPACES[name]
        st, _, _ = Solver(partial=pa, back=b, eager=e, limit=limit).solve(t, f, p)
        if st == "win":
            return True
        if st == "unknown":
            unknown = True
    return None if unknown else False


def move_kind(mv, state):
    tab = state[0]
    if mv[0] == "TF":
        return "foundation"
    if mv[0] == "WF":
        return "foundation"
    if mv[0] == "TT":
        _, i, st, j = mv
        if not tab[j]:
            return "king-to-empty"
        if st == 0:
            return "empty-column"
        return "run-move"
    if mv[0] == "WT":
        return "stock-to-column" if tab[mv[1]] else "king-to-empty"
    return "other"


def move_text(mv, state):
    tab = state[0]
    if mv[0] == "TF":
        return "TF " + card_text(tab[mv[1]][-1])
    if mv[0] == "WF":
        return "WF"
    if mv[0] == "TT":
        _, i, st, j = mv
        tgt = card_text(tab[j][-1]) if tab[j] else "empty"
        return f"TT {card_text(tab[i][st])}{'(E)' if st == 0 else ''} -> {tgt}"
    if mv[0] == "WT":
        tgt = card_text(tab[mv[1]][-1]) if tab[mv[1]] else "empty"
        return f"WT -> {tgt}"
    return str(mv)


def trap_one(tab, stock, rnd, mode="random", limit=20_000, spaces=ALIVE_SPACES, include_empty_moves=True):
    """素朴な解き方を1回打ち、詰んだら罠の手を二分探索で探す。

    戻り値: None（解けた）か dict。
      fatal_at: 罠の手の前に置いた回数。horizon: 罠の手の後、詰むまでに置いた回数（めくりは数えない）。
      解法器が打ち切った局面は、解けない側に倒した結果（horizon）と解ける側に倒した結果（horizon_alt）の両方を返す。
      stuck_alive: 詰んだ局面が読むモデルではまだ解ける（組札から戻す手などで続けられる）。
    """
    r = naive_play(tab, stock, rnd, mode, record=True, include_empty_moves=include_empty_moves)
    if r["win"]:
        return None
    states = [x[1] for x in r["path"]]
    last = len(states) - 1
    cache = {}

    def al(i):
        if i not in cache:
            cache[i] = alive(states[i], limit, spaces)
        return cache[i]

    a_last = al(last)
    if a_last is True:
        return {"stuck_alive": True, "unknown": False}

    def search(unknown_as):
        lo, hi = 0, last
        while hi - lo > 1:
            mid = (lo + hi) // 2
            v = al(mid)
            if v is None:
                v = unknown_as
            if v:
                lo = mid
            else:
                hi = mid
        return lo, hi

    lo, hi = search(False)
    unknown = any(v is None for v in cache.values())
    lo2, hi2 = search(True) if unknown else (lo, hi)
    if a_last is None and lo2 == last - 1:
        # 詰んだ局面そのものが判定できない
        hi2 = last
    mv = r["path"][lo][0]
    return {
        "stuck_alive": False,
        "unknown": unknown,
        "fatal_at": lo,
        "horizon": last - hi,
        "horizon_alt": last - hi2,
        # 罠の手の後、置ける手が2つ以上あった所だけを数えた手数（強制手を除いた変種）
        "horizon_choice": sum(1 for k in range(hi, last) if r["path"][k][2] >= 2),
        "kind": move_kind(mv, states[lo]),
        "text": move_text(mv, states[lo]),
        "fatal_key": [list(map(list, states[lo][0])), list(states[lo][1]), str(mv)],
        "choices": [x[3] for x in r["path"][:-1]],
    }


def trap_features(seed, trials=32, analyze=8, mode="random", limit=20_000, spaces=ALIVE_SPACES,
                  include_empty_moves=True, rng_salt=3):
    tab, stock = deal(seed)
    rnd = random.Random(seed * 7919 + rng_salt)
    res = []
    wins = 0
    t0 = time.time()
    for _ in range(trials):
        if len([x for x in res if x is not None]) >= analyze:
            # 残りは勝ち負けだけ数える
            if naive_play(tab, stock, rnd, mode, include_empty_moves=include_empty_moves)["win"]:
                wins += 1
            else:
                res.append(None)
            continue
        x = trap_one(tab, stock, rnd, mode, limit, spaces, include_empty_moves)
        if x is None:
            wins += 1
        else:
            res.append(x)
    traps = [x for x in res if x and not x["stuck_alive"]]
    out = {
        "seed": seed,
        "trap_trials": trials,
        "trap_wins": wins,
        "analyzed": len(traps),
        "stuck_alive": sum(1 for x in res if x and x["stuck_alive"]),
        "unknown": sum(1 for x in res if x and x["unknown"]),
        "horizons": [x["horizon"] for x in traps],
        "horizons_alt": [x["horizon_alt"] for x in traps],
        "horizons_choice": [x["horizon_choice"] for x in traps],
        "trials": [{"choices": x["choices"], "fatal_at": x["fatal_at"], "horizon": x["horizon"]} for x in traps],
        "fatal_ats": [x["fatal_at"] for x in traps],
        "kinds": [x["kind"] for x in traps],
        "texts": [x["text"] for x in traps],
        "distinct_traps": len({json.dumps(x["fatal_key"]) for x in traps}),
        "sec": round(time.time() - t0, 2),
    }
    return out


def _trap_worker(args):
    seed, kw = args
    try:
        return trap_features(seed, **kw)
    except Exception as e:  # noqa: BLE001
        return {"seed": seed, "error": repr(e)}


def run_jobs(worker, seeds, out_path, procs=4, **kw):
    import multiprocessing as mp

    done = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["seed"])
                except Exception:  # noqa: BLE001
                    pass
    seeds = [s for s in seeds if s not in done]
    t0 = time.time()
    with mp.Pool(procs) as pool, open(out_path, "a", encoding="utf-8") as fh:
        for i, row in enumerate(pool.imap_unordered(worker, [(s, kw) for s in seeds], chunksize=1)):
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            if (i + 1) % 20 == 0:
                print(f"{i + 1}/{len(seeds)} {time.time() - t0:.0f}s", flush=True)
    print("done", len(seeds), f"{time.time() - t0:.0f}s")


def extra_features(seed, undo_runs=3, undo_budget=300, trials=32):
    """試し置きと待った（実際の山札の順）・山札の並びを変えたときの素朴な解き方・分かれ道の多さ。"""
    tab, stock = deal(seed)
    out = {"seed": seed}
    us = []
    for k in range(undo_runs):
        win, undone, bt = naive_undo(tab, stock, random.Random(seed * 31 + k), undo_budget)
        us.append([win, undone, bt])
    out["naive_undo"] = us
    ns, nn = naive_space(tab, stock)
    out["naive_space"] = ns
    out["naive_space_states"] = nn
    ex = naive_exact(tab, stock)
    out["naive_win_prob"] = round(ex["win_prob"], 6)
    out["naive_fatal_decisions"] = ex["fatal_decisions"]
    ex2 = naive_exact(tab, stock, include_empty_moves=False)
    out["naive_win_prob_noE"] = round(ex2["win_prob"], 6)
    # 山札の並びだけを変える（列は同じ）。読むモデルでは同じ問題
    rs = random.Random(seed * 104729 + 7)
    st2 = list(stock)
    rs.shuffle(st2)
    out["naive_rate_restock"] = naive_rate(tab, tuple(st2), trials, seed * 7 + 11)
    out["naive_win_prob_restock"] = round(naive_exact(tab, tuple(st2))["win_prob"], 6)
    out["naive_space_restock"] = naive_space(tab, tuple(st2))[0]
    out["savvy_rate"] = savvy_rate(tab, trials, seed * 13 + 5)
    out["savvy_undo"] = [list(savvy_undo(tab, random.Random(seed * 37 + k))) for k in range(3)]
    out["savvy_push"] = savvy_push_rate(tab, seed)
    # 数え方の変種: 動かす札を先に等しい確率で選び、置き場所を後に選ぶ
    out["naive_win_prob_card_first"] = round(naive_exact(tab, stock, card_first=True)["win_prob"], 6)
    out["naive_win_prob_card_first_noE"] = round(naive_exact(tab, stock, include_empty_moves=False, card_first=True)["win_prob"], 6)
    # 分かれ道: 素朴な解き方の道筋での、置ける手の数
    rnd = random.Random(seed * 7919 + 9)
    branch = []
    first = []
    for _ in range(8):
        r = naive_play(tab, stock, rnd, "random", record=True)
        cs = [x[2] for x in r["path"] if x[2] > 0]
        if cs:
            first.append(cs[0])
            branch.append(statistics.mean(cs))
    out["branch_mean"] = round(statistics.mean(branch), 3) if branch else None
    out["entry_moves"] = statistics.median(first) if first else None
    # 初手で置ける手（めくる前）の数
    out["entry_now"] = len(naive_candidates(tab, (0, 0, 0, 0), ()))
    return out


def _extra_worker(args):
    seed, kw = args
    try:
        return extra_features(seed, **kw)
    except Exception as e:  # noqa: BLE001
        return {"seed": seed, "error": repr(e)}


def _survey_worker(args):
    seed, kw = args
    try:
        return survey_one(seed, **kw)
    except Exception as e:  # noqa: BLE001
        return {"seed": seed, "error": repr(e)}


def survey(n0, n1, out_path, procs=4, **kw):
    import multiprocessing as mp

    done = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["seed"])
                except Exception:  # noqa: BLE001
                    pass
    seeds = [s for s in range(n0, n1) if s not in done]
    t0 = time.time()
    with mp.Pool(procs) as pool, open(out_path, "a", encoding="utf-8") as fh:
        for i, row in enumerate(pool.imap_unordered(_survey_worker, [(s, kw) for s in seeds], chunksize=1)):
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            if (i + 1) % 20 == 0:
                print(f"{i + 1}/{len(seeds)} {time.time() - t0:.0f}s", flush=True)
    print("done", len(seeds), f"{time.time() - t0:.0f}s")


# ---------------------------------------------------------------------------
# 案の比較（キャッシュした JSONL から）と、採った案（案2）の分類


# 採った案（案2: 罠の割合 × 気づくまでの手数）の暫定の境目
TRAP_LIGHT = 0.1      # 罠の割合がこれ未満（0 を除く）は「罠がほぼ踏まれない」として提供範囲外
HORIZON_SHORT = 10    # 気づくまでの手数（中央値）がこれ以下は「すぐ気づく」
HORIZON_LONG = 20     # これを超えると「気づくのがかなり遅い」
PUSH_LIMIT = 0.5      # レベル5の止め: 定石つき+待った（10回、戻した手100まで）でこの割合以上解けたら押し切れるとして外す


def horizon_level(h):
    return 1 if h <= HORIZON_SHORT else (2 if h <= HORIZON_LONG else 3)


def classify_plan2(f):
    """f: 特徴の dict（status, tier, t, t_noE, dead, h, h_status）。戻り値: (状態, レベルか理由)。

    状態は classified / out-of-range / unsupported / invalid（game-structure.md の状態名）。
    """
    if f["status"] != "win":
        return "invalid", "not-proven-solvable"
    t = f["t"]
    if t == 0:
        if f["t_noE"] == 0:
            return "classified", 1
        return "out-of-range", "natural-only-with-emptying"
    if f["tier"] in ("P", "P?", "PB", "?"):
        return "unsupported", "needs-partial-or-unresolved"
    if f.get("h") is None:
        return "unsupported", "horizon-undefined"
    if t < TRAP_LIGHT:
        return "out-of-range", "trap-too-rare"
    h = f["h"]
    hl = horizon_level(h)
    if f.get("h_alt") is not None and horizon_level(f["h_alt"]) != hl:
        # 解法器の打ち切りで、罠の手の位置が段をまたいで決まらない
        return "unsupported", "horizon-unresolved"
    tl = 3 if f["dead"] else 2
    lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((tl, hl))
    if lv is None:
        return "out-of-range", "unlisted-combination"
    if lv == 5 and f.get("push") is not None and f["push"] >= PUSH_LIMIT:
        # 素朴な解き方は止める向きにだけ使う: 最上位を試し置きで押し切れる問題を外す
        return "out-of-range", "trial-pushable"
    return "classified", lv


def _load_jsonl(path):
    out = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                r = json.loads(line)
                out[r["seed"]] = r
    return out


def load_features(cache_dir, prefix="random"):
    """survey / traps / extra の JSONL を1つの特徴の表にする。traps_<prefix>_big.jsonl があれば上書きに使う。"""
    S = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    T = _load_jsonl(os.path.join(cache_dir, f"traps_{prefix}.jsonl"))
    T.update(_load_jsonl(os.path.join(cache_dir, f"traps_{prefix}_big.jsonl")))
    T5 = _load_jsonl(os.path.join(cache_dir, f"traps_{prefix}_salt5.jsonl"))
    X = _load_jsonl(os.path.join(cache_dir, f"extra_{prefix}.jsonl"))
    rows = []
    for seed, r in sorted(S.items()):
        f = dict(r)
        x = X.get(seed)
        if r.get("status") == "win" and x:
            f["t"] = round(1 - x["naive_win_prob"], 6)
            f["t_noE"] = round(1 - x["naive_win_prob_noE"], 6)
            f["t_restock"] = round(1 - x["naive_win_prob_restock"], 6)
            f["dead"] = x["naive_space"] == "dead"
            f["dead_restock"] = x["naive_space_restock"] == "dead"
            f["savvy"] = x.get("savvy_rate")
            f["push"] = x.get("savvy_push")
            if "savvy_undo" in x:
                f["savvy_undo_win"] = sum(1 for w, _ in x["savvy_undo"] if w)
                f["savvy_undo_undone"] = statistics.median(u for _, u in x["savvy_undo"])
            f["naive_undo_win"] = sum(1 for w, _, _ in x["naive_undo"] if w)
            f["branch"] = x["branch_mean"]
            f["entry"] = x["entry_now"]
            f["fatal_decisions"] = x["naive_fatal_decisions"]
            f["t_mc32"] = 1 - r["naive_rate"]
            if "naive_win_prob_card_first" in x:
                f["t_card_first"] = round(1 - x["naive_win_prob_card_first"], 6)
                f["t_card_first_noE"] = round(1 - x["naive_win_prob_card_first_noE"], 6)
            tr = T.get(seed)
            if f["t"] == 0:
                f.update(h=0, h_alt=0, hc=0, h5=0, h5_alt=0, h_mean=0, h_alt_mean=0, fa=None, kinds=[], h_unknown=0, analyzed=0)
            elif tr:
                hz = tr["horizons"]
                f["h"] = statistics.median(hz) if hz else None
                ha = tr.get("horizons_alt")
                f["h_alt"] = statistics.median(ha) if ha else None
                f["hc"] = statistics.median(tr["horizons_choice"]) if hz else None
                f["h_mean"] = statistics.mean(hz) if hz else None
                f["h_alt_mean"] = statistics.mean(ha) if ha else None
                f["fa"] = statistics.median(tr["fatal_ats"]) if hz else None
                f["kinds"] = tr["kinds"]
                f["h_unknown"] = tr["unknown"]
                f["analyzed"] = tr["analyzed"]
                t5 = T5.get(seed)
                if t5:
                    f["h5"] = statistics.median(t5["horizons"]) if t5["horizons"] else None
                    a5 = t5.get("horizons_alt") or t5["horizons"]
                    f["h5_alt"] = statistics.median(a5) if a5 else None
            else:
                f.update(h=None, hc=None, h5=None, h_mean=None, fa=None, kinds=[], h_unknown=0, analyzed=0)
        rows.append(f)
    return rows


def _q(xs):
    xs = sorted(x for x in xs if x is not None)
    n = len(xs)
    if not n:
        return None
    return (xs[int(n * 0.1)], xs[n // 2], xs[min(n - 1, int(n * 0.9))])


def _rank(xs):
    idx = sorted(range(len(xs)), key=lambda i: xs[i])
    rk = [0.0] * len(xs)
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[idx[j + 1]] == xs[idx[i]]:
            j += 1
        for k in range(i, j + 1):
            rk[idx[k]] = (i + j) / 2
        i = j + 1
    return rk


def spearman(a, b):
    pairs = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(pairs) < 3:
        return float("nan")
    ra = _rank([p[0] for p in pairs])
    rb = _rank([p[1] for p in pairs])
    n = len(pairs)
    ma = sum(ra) / n
    mb = sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va = sum((x - ma) ** 2 for x in ra)
    vb = sum((y - mb) ** 2 for y in rb)
    return cov / (va * vb) ** 0.5 if va and vb else float("nan")


def _tl(f):
    return 1 if f["t"] == 0 else (3 if f["dead"] else 2)


def plan_trap_only(f):
    """案1: 罠の割合だけ。"""
    if f["status"] != "win":
        return "invalid"
    t = f["t"]
    if t == 0:
        return 1
    if f["dead"]:
        return 5
    return 2 if t < 0.4 else (3 if t < 0.8 else 4)


def _chain(f, second):
    """罠の割合（T: 0 / 0<t<1 / 素朴な手では解けない）と2本目のつまみ（1〜3）の組から、1段ずつ上げる鎖で選ぶ。"""
    if f["status"] != "win":
        return "invalid"
    T = _tl(f)
    if T == 1:
        return 1
    if second is None:
        return "unsupported"
    return {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, second), "unlisted")


def plan_trap_horizon(f, key="h", a=HORIZON_SHORT, b=HORIZON_LONG):
    """案2: 罠の割合 × 気づくまでの手数（比べるときの素の形。採った形は classify_plan2）。"""
    h = f.get(key)
    return _chain(f, None if h is None else (1 if h <= a else (2 if h <= b else 3)))


def plan_trap_static(f):
    """案3: 罠の割合 × 静的な掘り出しの重さ（同じ列で同じマークの小さい札の上の札 + A〜3 の上の札の数）。"""
    g = f["self_block"] + f["buried_low"]
    return _chain(f, 1 if g <= 14 else (2 if g <= 20 else 3))


def plan_trap_tier(f):
    """案4: 罠の割合 × 手筋（組札へ運ぶのを待つ手が要るか）。"""
    if f["status"] != "win":
        return "invalid"
    T = _tl(f)
    if T == 1:
        return 1
    k = 1 if f["tier"] == "E" else 2
    return {(2, 1): 2, (2, 2): 3, (3, 1): 4, (3, 2): 5}[(T, k)]


PLANS = {
    "案1 罠の割合だけ": plan_trap_only,
    "案2 罠の割合×気づくまでの手数": plan_trap_horizon,
    "案3 罠の割合×静的な掘り出し": plan_trap_static,
    "案4 罠の割合×手筋（待つ手）": plan_trap_tier,
    "採用形 classify_plan2": lambda f: (lambda st: st[1] if st[0] == "classified" else st[1])(classify_plan2(f)),
}
COMPARE_FEATS = ["t", "h", "hc", "savvy", "fwd_nodes", "moves", "branch", "entry", "self_block", "buried_low", "fa"]


def compare(cache_dir, prefix="random"):
    rows = [f for f in load_features(cache_dir, prefix) if f.get("status") == "win"]
    for f in rows:
        f["fwd_nodes"] = f["spaces"]["fwd"][1] if f["spaces"]["fwd"][0] == "win" else None
    print(f"解けると確かめた配り方: {len(rows)}")
    for name, fn in PLANS.items():
        lv = {}
        for f in rows:
            lv.setdefault(fn(f), []).append(f)
        print(f"\n== {name}")
        print("  件数:", {str(k): len(v) for k, v in sorted(lv.items(), key=lambda kv: str(kv[0]))})
        for feat in COMPARE_FEATS:
            print(f"  {feat:12s}", " | ".join(str(_q([f.get(feat) for f in lv.get(L, [])])) for L in (1, 2, 3, 4, 5)))
        print("  素朴+待ったで解けた割合（3回のうち1回でも）:",
              [round(sum(1 for f in lv.get(L, []) if f["naive_undo_win"] > 0) / max(1, len(lv.get(L, []))), 2) for L in (1, 2, 3, 4, 5)])
        print("  定石つき+待ったで3回とも解けた割合（戻した手300まで）:",
              [round(sum(1 for f in lv.get(L, []) if f.get("savvy_undo_win", 0) == 3) / max(1, len(lv.get(L, []))), 2) for L in (1, 2, 3, 4, 5)])
        print("  定石つき+待ったの戻した手（中央値の10/50/90）:", [_q([f.get("savvy_undo_undone") for f in lv.get(L, [])]) for L in (1, 2, 3, 4, 5)])
        print("  定石つきの素朴な解き方の成功率が0.5以上の割合:",
              [round(sum(1 for f in lv.get(L, []) if (f["savvy"] or 0) >= 0.5) / max(1, len(lv.get(L, []))), 2) for L in (1, 2, 3, 4, 5)])

        # A3: 数え方の変種でレベルが変わる割合
        def changed(variant):
            n = ch = far = lost = 0
            for f in rows:
                a = fn(f)
                if not isinstance(a, int):
                    continue
                b = fn(variant(f))
                n += 1
                if a != b:
                    ch += 1
                    if not isinstance(b, int):
                        lost += 1
                    elif abs(a - b) >= 2:
                        far += 1
            return f"{ch}/{n}（2段以上 {far}、範囲外へ {lost}）"

        def v(**kw):
            def g(f):
                f2 = dict(f)
                for k, src in kw.items():
                    f2[k] = f.get(src)
                return f2
            return g

        def v_noE(f):
            f2 = dict(f)
            f2["t"] = f["t_noE"]
            f2["dead"] = f["t_noE"] == 1
            f2["t_noE"] = f["t_noE"]
            return f2

        def v_mc(f):
            f2 = dict(f)
            f2["t"] = f["t_mc32"]
            f2["dead"] = f["t_mc32"] == 1
            return f2

        def v_restock(f):
            f2 = dict(f)
            f2["t"] = f["t_restock"]
            f2["dead"] = f["dead_restock"]
            return f2

        t1_ = [f for f in rows if f["t"] > 0 and f.get("h") is not None and f.get("hc") is not None]
        hs = sorted(f["h"] for f in t1_)
        hcs = sorted(f["hc"] for f in t1_)
        fa_ = sum(1 for h in hs if h <= HORIZON_SHORT) / len(hs)
        fb_ = sum(1 for h in hs if h <= HORIZON_LONG) / len(hs)
        ca = hcs[max(0, int(fa_ * len(hcs)) - 1)]
        cb = hcs[max(0, int(fb_ * len(hcs)) - 1)]

        def v_hc(f):
            f2 = dict(f)
            hc = f.get("hc")
            if hc is None:
                f2["h"] = None
                f2["h_alt"] = None
                return f2
            # 強制手を除いた手数を、同じ割合の境目で「気づくまでの手数」の尺度へ写す
            f2["h"] = 0 if hc <= ca else (HORIZON_SHORT + 1 if hc <= cb else HORIZON_LONG + 1)
            f2["h_alt"] = f2["h"]
            return f2

        def v_card(f):
            f2 = dict(f)
            if "t_card_first" in f:
                f2["t"] = f["t_card_first"]
                f2["t_noE"] = f["t_card_first_noE"]
            return f2

        print("  A3 罠の割合を32回の無作為試行で数える:", changed(v_mc))
        print("  A3 罠の割合を「札を先に選び、置き場所を後に選ぶ」確率で数える:", changed(v_card))
        print("  A3 列を空ける手を素朴な手に入れない:", changed(v_noE))
        print("  A3 気づくまでの手数を別の乱数の8回で数える:", changed(v(h="h5", h_alt="h5_alt")))
        print("  A3 気づくまでの手数を平均で数える:", changed(v(h="h_mean", h_alt="h_alt_mean")))
        print("  A5 気づくまでの手数を強制手を除いて数える（境目は同じ割合になる値へ写す）:", changed(v_hc))
        print("  参考 山札の並びだけを変える（読むモデルでは同じ問題）:", changed(v_restock))
    t1 = [f for f in rows if f["t"] > 0 and f.get("h") is not None]
    print("\nB4 罠の割合と気づくまでの手数の順位相関（罠あり）:", round(spearman([f["t"] for f in t1], [f["h"] for f in t1]), 2))
    print("A5 気づくまでの手数と、強制手を除いた手数の順位相関:", round(spearman([f["h"] for f in t1], [f["hc"] for f in t1]), 2))
    print("A5 気づくまでの手数と解き筋の手数の順位相関:", round(spearman([f["h"] for f in t1], [f["moves"] for f in t1]), 2))


# ---------------------------------------------------------------------------
# 確かめ用: 枝刈りなしの素直な解法器（すべての合法手を1手ずつ。自動の組札送りもしない）


def plain_legal(tab, fnd, pool):
    out = []
    fe = next((j for j in range(7) if not tab[j]), -1)
    for i, col in enumerate(tab):
        if col:
            c = col[-1]
            if fnd[SUIT[c]] == RANK[c] - 1:
                t = list(tab)
                t[i] = col[:-1]
                f = list(fnd)
                f[SUIT[c]] += 1
                out.append((tuple(t), tuple(f), pool))
    for s_ in range(4):
        if fnd[s_] < 13:
            c = s_ * 13 + fnd[s_]
            if pool >> c & 1:
                f = list(fnd)
                f[s_] += 1
                out.append((tab, tuple(f), pool & ~(1 << c)))
    for i, col in enumerate(tab):
        if not col:
            continue
        st = run_start(col)
        for k in range(st, len(col)):
            c = col[k]
            for j in range(7):
                if j == i:
                    continue
                d = tab[j]
                if d:
                    if not STK[c][d[-1]]:
                        continue
                elif RANK[c] != 13 or k == 0 or j != fe:
                    continue
                t = list(tab)
                t[i] = col[:k]
                t[j] = d + col[k:]
                out.append((tuple(t), fnd, pool))
    p = pool
    while p:
        y = (p & -p).bit_length() - 1
        p &= p - 1
        for j in range(7):
            d = tab[j]
            if d:
                if not STK[y][d[-1]]:
                    continue
            elif RANK[y] != 13 or j != fe:
                continue
            t = list(tab)
            t[j] = d + (y,)
            out.append((tuple(t), fnd, pool & ~(1 << y)))
    for s_ in range(4):
        if fnd[s_] > 0:
            y = s_ * 13 + fnd[s_] - 1
            for j in range(7):
                d = tab[j]
                if d:
                    if not STK[y][d[-1]]:
                        continue
                elif RANK[y] != 13 or j != fe:
                    continue
                t = list(tab)
                t[j] = d + (y,)
                f = list(fnd)
                f[s_] -= 1
                out.append((tuple(t), tuple(f), pool))
    return out


def _safe_auto_plain(t, f, p):
    t = list(t)
    f = list(f)
    moved = True
    while moved:
        moved = False
        for i in range(7):
            col = t[i]
            if col:
                c = col[-1]
                if f[SUIT[c]] == RANK[c] - 1 and safe_to_foundation(c, f):
                    f[SUIT[c]] += 1
                    t[i] = col[:-1]
                    moved = True
        for s_ in range(4):
            if f[s_] < 13:
                c = s_ * 13 + f[s_]
                if p >> c & 1 and safe_to_foundation(c, f):
                    f[s_] += 1
                    p &= ~(1 << c)
                    moved = True
    return tuple(t), tuple(f), p


def plain_solve(tab, limit=300_000, fnd=(0, 0, 0, 0), pool=None, auto=False):
    """win / lose / unknown と調べた局面数。Solver の枝刈り（遅延の議論・行き止まり・安全な組札送り）を使わない。

    auto=True（版5 の確かめの2回目）のときだけ、安全な組札送り（safe_to_foundation）を先に済ませる。
    """
    seen = set()
    if pool is None:
        pool = pool_of(tab, fnd)
    stack = [(tuple(tab), tuple(fnd), pool)]
    while stack:
        t, f, p = stack.pop()
        if auto:
            t, f, p = _safe_auto_plain(t, f, p)
        if f == (13, 13, 13, 13):
            return "win", len(seen)
        key = (tuple(sorted(t)), f)
        if key in seen:
            continue
        seen.add(key)
        if len(seen) > limit:
            return "unknown", len(seen)
        stack.extend(reversed(plain_legal(t, f, p)))
    return "lose", len(seen)


def crosscheck_lose(cache_dir, prefix="random", limit=300_000, budget_sec=560):
    S = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    t0 = time.time()
    res = {}
    for seed in sorted(s for s, r in S.items() if r["status"] == "lose"):
        if time.time() - t0 > budget_sec:
            break
        st, n = plain_solve(deal(seed)[0], limit)
        res[seed] = (st, n)
        print(seed, st, n, flush=True)
    print("素直な解法器の結果:", {k: sum(1 for v in res.values() if v[0] == k) for k in ("lose", "unknown", "win")})


def notify_cost(cache_dir, prefix="random", n=60, limit=200_000):
    """素朴な解き方が詰んだ局面で、状態の知らせの判定（組札の札を増やせる局面へ行けるか）にかかる量。"""
    S = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    seeds = [s for s, r in sorted(S.items()) if r["status"] == "win" and r["naive_rate"] < 1][:n]
    cnt = {True: 0, False: 0, None: 0}
    nodes = []
    secs = []
    for seed in seeds:
        tab, stock = deal(seed)
        rnd = random.Random(seed * 17 + 1)
        r = None
        for _ in range(32):
            r = naive_play(tab, stock, rnd, "random", record=True)
            if not r["win"]:
                break
        if r["win"]:
            continue
        t, f, p = r["path"][-1][1]
        a = time.time()
        v, k = foundation_progress_reachable(t, f, p, limit)
        secs.append(time.time() - a)
        nodes.append(k)
        cnt[v] += 1
    nodes.sort()
    secs.sort()
    print("詰んだ局面", sum(cnt.values()), "知らせない（組札を増やせる）", cnt[True], "知らせる", cnt[False], f"決まらない（{limit}局面）", cnt[None])
    print("局面数 p50/p90/最大", nodes[len(nodes) // 2], nodes[int(len(nodes) * 0.9)], nodes[-1],
          "秒 p50/p90/最大", round(secs[len(secs) // 2], 3), round(secs[int(len(secs) * 0.9)], 2), round(secs[-1], 2))


# ---------------------------------------------------------------------------
# 移植の期待値（検査 F2）: 採った案の、seed ごとの結果を書き出す


def features_fresh(seed):
    """キャッシュを使わず、1つの配り方の特徴を最初から求める（期待値の書き出し用）。"""
    sv = survey_one(seed)
    f = dict(sv)
    tab, stock = deal(seed)
    if sv["status"] != "win":
        return f, None, None
    ex = naive_exact(tab, stock)
    ex2 = naive_exact(tab, stock, include_empty_moves=False)
    ns = naive_space(tab, stock)
    f["t"] = round(1 - ex["win_prob"], 6)
    f["t_noE"] = round(1 - ex2["win_prob"], 6)
    f["dead"] = ns[0] == "dead"
    f["push"] = savvy_push_rate(tab, seed)
    tr = None
    if f["t"] == 0:
        f["h"] = 0
        f["h_alt"] = 0
    else:
        tr = trap_features(seed)
        f["h"] = statistics.median(tr["horizons"]) if tr["horizons"] else None
        f["h_alt"] = statistics.median(tr["horizons_alt"]) if tr["horizons_alt"] else None
    return f, {"exact": ex, "exact_noE": ex2, "space": ns}, tr


def write_expected(seeds, out_path):
    items = []
    for seed in seeds:
        t0 = time.time()
        f, nv, tr = features_fresh(seed)
        tab, stock = deal(seed)
        st, why = classify_plan2(f) if f["status"] == "win" else ("invalid", "not-proven-solvable")
        item = {
            "seed": seed,
            "deal": deal_text(tab, stock),
            "deal_cards": {"columns": [list(c) for c in tab], "stock": list(stock)},
            "solver": {
                "limits": SPACE_LIMIT,
                "spaces": f["spaces"],
                "status": f["status"],
                "tier": f.get("tier"),
            },
            "assessment": {"state": st, "value": why},
        }
        if nv:
            item["natural"] = {
                "win_prob": round(nv["exact"]["win_prob"], 6),
                "states": nv["exact"]["states"],
                "fatal_decisions": nv["exact"]["fatal_decisions"],
                "win_prob_without_emptying": round(nv["exact_noE"]["win_prob"], 6),
                "space": nv["space"][0],
                "space_states": nv["space"][1],
            }
            item["features"] = {"t": f["t"], "t_noE": f["t_noE"], "dead": f["dead"], "h": f["h"], "h_alt": f["h_alt"], "push": f["push"]}
        if tr:
            item["traps"] = {
                "alive_spaces": list(ALIVE_SPACES),
                "alive_limit": 20_000,
                "trials_run": tr["trap_trials"],
                "trial_wins": tr["trap_wins"],
                "stuck_alive": tr["stuck_alive"],
                "unknown": tr["unknown"],
                "trials": tr["trials"],
                "horizons": tr["horizons"],
                "horizons_alt": tr["horizons_alt"],
                "kinds": tr["kinds"],
            }
        item["sec"] = round(time.time() - t0, 2)
        items.append(item)
        print(seed, st, why, item["sec"], flush=True)
    doc = {
        "about": "ソリティア難易度の調査コード solitaire_difficulty.py の、採った案（案2）の seed ごとの結果。検査 F2 で移植したコードと突き合わせる。",
        "rules": "52枚・7列（1〜7枚）、列は全部表、山札24枚は1枚ずつ何周でも。deal(seed) は Python の random.Random(seed).shuffle で並べ、列 i に i+1 枚、残りが山札（stock[0] が次にめくる札）。札の番号は suit*13+rank-1（S,H,D,C）",
        "thresholds": {"TRAP_LIGHT": TRAP_LIGHT, "HORIZON_SHORT": HORIZON_SHORT, "HORIZON_LONG": HORIZON_LONG, "PUSH_LIMIT": PUSH_LIMIT},
        "notes": [
            "solver.spaces の nodes は、同じ手の並び順・枝刈り・状態の同一視で一致する。採否に関わる量（打ち切りの上限 limits で unknown になるか）も比べる",
            "natural.win_prob・states・space_states は乱数を使わない（置ける手から等しい確率で選ぶ素朴な解き方の正確な値）",
            "traps.trials[].choices は naive_candidates の並びでの選んだ番号。移植では同じ番号で打ち直し、fatal_at と horizon を比べる（乱数の実装が違っても突き合わせられる）",
            "features.push は Python の random.Random に依る（savvy_undo の手の並べ替え）。移植では同じ定義で測り直し、レベル5の止めの判定が大きく変わらないかを分布で比べる",
        ],
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


# ===========================================================================
# 版2: 反例探し（A4）を受けて、道筋・乱数・数え方に依らない定義へ作り直したもの
#
# 版1（上の trap_features・classify_plan2・savvy_push_rate など）は、作り直す前の定義として残す。
# 版2 では次をすべて「あり得るすべての道筋の上の存在・最大・最小」で定義し、乱数を使わない。
#   - 素朴な解き方の手の集まり N（置ける所に置き、無ければめくる）を、並びの途中から上を動かして
#     下の札を組札へ送る手（PF）まで含めて決め、N の手で行ける局面の全体（分かれ道の網）を作る。
#   - 読むモデルの「解ける／解けない」は、規則で打てる手をすべて使う解法器（AliveOracle）で判定する。
#   - 罠の手は「分かれ道で選んだ手」の単位で区切る（置ける手が1つだけの所は選んでいないので罠にしない）。
#   - 段 1（どの道筋でも勝てる）と段 3（どの道筋でも勝てない）は、素朴な手の4つの変種すべてで同じときだけ使う。
# 分類に使う関数: features_v2 → classify_v2。確かめ用: verify_oracle_dead・symmetry_check・
#   natural_class_general・natural_reach_win・natural_freeflip_search（手の種類を足す）・natural_class_policy（優先順位）・d1_check。
# ===========================================================================


NAT_FULL = {"empty": True, "pf": True}      # 列を空ける手と、途中から動かして組札へ送る手を含む
NAT_VARIANTS = {
    "full": {"empty": True, "pf": True},
    "noE": {"empty": False, "pf": True},
    "noPF": {"empty": True, "pf": False},
    "basic": {"empty": False, "pf": False},
}


def nat_candidates(tab, fnd, waste, empty=True, pf=True, allpartial=False, back=False):
    """素朴な解き方の置ける手（版2）。並びは naive_candidates と同じで、末尾に PF を足す。

    手: ("TF", i) 列の一番上を組札へ / ("WF",) 捨て札を組札へ /
        ("TT", i, st, j) 並びの始まり st から上を列 j へ（st=0 の K 以外は列を空ける手。empty=False なら除く）/
        ("WT", j) 捨て札を列 j へ /
        ("PF", i, k, j) 並びの途中 k（k > st）から上を列 j へ動かし、出てきた col[k-1] を組札へ送る（pf=True のとき）
    """
    out = [m for _, m in naive_candidates(tab, fnd, waste, empty)]
    if pf:
        for i, col in enumerate(tab):
            if not col:
                continue
            st = run_start(col)
            for k in range(st + 1, len(col)):
                below = col[k - 1]
                if fnd[SUIT[below]] != RANK[below] - 1:
                    continue
                c = col[k]
                for j in range(7):
                    if j != i and tab[j] and STK[c][tab[j][-1]]:
                        out.append(("PF", i, k, j))
    if allpartial:
        # 変種（確かめ用）: 並びの途中から上を、目的を問わずほかの列へ動かす手も置ける手に数える
        for i, col in enumerate(tab):
            if not col:
                continue
            st = run_start(col)
            for k in range(st + 1, len(col)):
                c = col[k]
                for j in range(7):
                    if j != i and tab[j] and STK[c][tab[j][-1]]:
                        out.append(("PT", i, k, j))
    if back:
        # 変種（確かめ用）: 組札の一番上を列へ戻す手も置ける手に数える
        first_empty = next((j for j in range(7) if not tab[j]), -1)
        for s_ in range(4):
            if fnd[s_] == 0:
                continue
            y = s_ * 13 + fnd[s_] - 1
            for j in range(7):
                if tab[j]:
                    if STK[y][tab[j][-1]]:
                        out.append(("BT", s_, j))
                elif RANK[y] == 13 and j == first_empty:
                    out.append(("BT", s_, j))
    return out


def _nat_apply(mv, state):
    if mv[0] == "PT":
        tab, fnd, stock_rev, waste = state
        tab = list(tab)
        _, i, k, j = mv
        tab[j] = tab[j] + tab[i][k:]
        tab[i] = tab[i][:k]
        return tuple(tab), fnd, stock_rev, waste
    if mv[0] == "BT":
        tab, fnd, stock_rev, waste = state
        tab = list(tab)
        fnd = list(fnd)
        _, s_, j = mv
        tab[j] = tab[j] + (s_ * 13 + fnd[s_] - 1,)
        fnd[s_] -= 1
        return tuple(tab), tuple(fnd), stock_rev, waste
    if mv[0] != "PF":
        return _naive_apply(mv, state)
    tab, fnd, stock_rev, waste = state
    tab = list(tab)
    fnd = list(fnd)
    _, i, k, j = mv
    col = tab[i]
    tab[j] = tab[j] + col[k:]
    below = col[k - 1]
    tab[i] = col[:k - 1]
    fnd[SUIT[below]] += 1
    return tuple(tab), tuple(fnd), stock_rev, waste


def _nat_advance(state, empty=True, pf=True, allpartial=False, back=False):
    """置ける手が出るまでめくる。戻り値: (局面, 置ける手の列 | "win" | None（詰み）)。"""
    tab, fnd, stock_rev, waste = state
    flips = 0
    while True:
        if fnd == (13, 13, 13, 13):
            return (tab, fnd, stock_rev, waste), "win"
        cands = nat_candidates(tab, fnd, waste, empty, pf, allpartial, back)
        if cands:
            return (tab, fnd, stock_rev, waste), cands
        total = len(stock_rev) + len(waste)
        if total == 0 or flips > total + 1:
            return (tab, fnd, stock_rev, waste), None
        if stock_rev:
            waste = waste + (stock_rev[-1],)
            stock_rev = stock_rev[:-1]
        else:
            stock_rev = tuple(reversed(waste))
            waste = ()
        flips += 1


WIN = "WIN"


def _nat_canon_advance(state, empty=True, pf=True):
    """めくりを済ませ、列を並べ替えた形（列は入れ替えても同じ局面）にして返す。"""
    st, c = _nat_advance(state, empty, pf)
    tab, fnd, stock_rev, waste = st
    st = (tuple(sorted(tab)), fnd, stock_rev, waste)
    if isinstance(c, list):
        c = nat_candidates(st[0], fnd, waste, empty, pf)
    return st, c


def natural_graph(tab0, stock0, empty=True, pf=True, limit=400_000):
    """素朴な解き方で行ける局面の網（版2）。

    節点: 置ける手が1つ以上ある局面（めくりを済ませた後の (列, 組札, 山札, 捨て札)）。
    子: 置ける手ごとに、次の節点・WIN・("STUCK", 詰んだ局面) のどれか。
    素朴な手は打つたびに「組札の枚数×3 + 正しく重なった組 − 正しくない組 + 列の札の数」が増えるので、網は輪を持たない（DAG）。
    戻り値: dict(root, nodes={key: [(手, 子), ...]}, complete)。root が WIN / STUCK のこともある。
    """
    s0, c0 = _nat_canon_advance((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()), empty, pf)
    if c0 == "win":
        return {"root": WIN, "nodes": {}, "complete": True}
    if c0 is None:
        return {"root": ("STUCK", s0), "nodes": {}, "complete": True}
    nodes = {}
    stack = [(s0, c0)]
    pending = {s0: c0}
    complete = True
    while stack:
        st, cands = stack.pop()
        if st in nodes:
            continue
        ch = []
        got = set()
        for mv in cands:
            s2, c2 = _nat_canon_advance(_nat_apply(mv, st), empty, pf)
            if c2 == "win":
                child = WIN
            elif c2 is None:
                child = ("STUCK", s2)
            else:
                child = s2
                if s2 not in nodes and s2 not in pending:
                    pending[s2] = c2
                    stack.append((s2, c2))
            # 同じ局面（列の並び替えで同じものを含む）になる手は1つの手として数える
            if child in got:
                continue
            got.add(child)
            ch.append((mv, child))
        nodes[st] = ch
        if len(nodes) > limit:
            complete = False
            break
    return {"root": s0, "nodes": nodes, "complete": complete}


def _gen_canon(s):
    return (tuple(sorted(s[0])), s[1], s[2], s[3])


def _gen_successors(st, empty, pf, allpartial, back, free_flip):
    """natural_class_general・natural_reach_win の次の局面（めくり1枚ごと。勝ちは WIN）。"""
    tab, fnd, stock_rev, waste = st
    base = nat_candidates(tab, fnd, waste, empty, pf)
    allc = nat_candidates(tab, fnd, waste, empty, pf, allpartial, back)
    nxt = [_nat_apply(mv, st) for mv in allc]
    if (not base or free_flip) and (stock_rev or waste):
        if stock_rev:
            nxt.append((tab, fnd, stock_rev[:-1], waste + (stock_rev[-1],)))
        else:
            nxt.append((tab, fnd, tuple(reversed(waste)), ()))
    return [WIN if s2[1] == (13, 13, 13, 13) else _gen_canon(s2) for s2 in nxt]


def natural_reach_win(tab0, stock0, empty=True, pf=True, allpartial=False, back=False, free_flip=False, limit=400_000):
    """確かめ用: natural_class_general と同じ手の範囲で、配った局面から勝ちへ行けるか（True / False / None（打ち切り））。

    勝ちが見つかった所で止めるので、段 3 が崩れるか（どの道筋でも勝てない、が手を足すと勝てるようになるか）を安く確かめられる。
    """
    s0 = _gen_canon((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()))
    stack = [s0]
    seen = {s0}
    while stack:
        st = stack.pop()
        for s2 in _gen_successors(st, empty, pf, allpartial, back, free_flip):
            if s2 == WIN:
                return True
            if s2 not in seen:
                seen.add(s2)
                stack.append(s2)
                if len(seen) > limit:
                    return None
    return False


def natural_freeflip_search(tab0, target, empty=True, pf=True, limit=400_000):
    """確かめ用: 素朴な手に「置ける手があっても、置かずにめくってよい」を足した遊び方で、target へ行けるか。

    target: "win"（勝ちへ行けるか。段 3 が崩れるかを見る）か "stuck"（どの山札の札でも置ける手が無い局面へ行けるか。段 1 が崩れるかを見る）。
    いつでもめくれると、山札の札はどれも捨て札の一番上に出せ、1枚取っても残りの巡回の順は変わらない（§2.2 と同じ導出）。
    そこで山札を「いつでも取れる札の集まり」とし、局面を（列, 組札）で表す。捨て札の手は山札のどの札でも打てる。
    行ける局面を全部たどる網は打ち切りに当たって作れなかったので、見つかった所で止める探索にしている。
    戻り値: True / False / None（打ち切り）。
    """
    full = (1 << 52) - 1

    def pool_of(tab, fnd):
        m = full
        for col in tab:
            for c in col:
                m &= ~(1 << c)
        for s_ in range(4):
            for r in range(fnd[s_]):
                m &= ~(1 << (s_ * 13 + r))
        return m

    def succ(tab, fnd):
        out = []
        for mv in nat_candidates(tab, fnd, (), empty, pf):
            t2, f2, _, _ = _nat_apply(mv, (tab, fnd, (), ()))
            out.append((t2, f2))
        p = pool_of(tab, fnd)
        while p:
            low = p & -p
            c = low.bit_length() - 1
            p ^= low
            for mv in nat_candidates(tab, fnd, (c,), empty, pf):
                if mv[0] in ("WF", "WT"):
                    t2, f2, _, _ = _nat_apply(mv, (tab, fnd, (), (c,)))
                    out.append((t2, f2))
        return [(tuple(sorted(t2)), f2) for t2, f2 in out]

    s0 = (tuple(sorted(tuple(c) for c in tab0)), (0, 0, 0, 0))
    stack = [s0]
    seen = {s0}
    while stack:
        st = stack.pop()
        if st[1] == (13, 13, 13, 13):
            if target == "win":
                return True
            continue
        ch = succ(*st)
        if not ch and target == "stuck":
            return True
        for s2 in ch:
            if s2 not in seen:
                seen.add(s2)
                stack.append(s2)
                if len(seen) > limit:
                    return None
    return False


def natural_class_general(tab0, stock0, empty=True, pf=True, allpartial=False, back=False, free_flip=False, limit=400_000):
    """輪のある変種でも使える、段 T の判定（確かめ用）。

    素朴な手（empty・pf で決まる手）に、変種の手（allpartial: 並びの途中から上を目的を問わず動かす手、
    back: 組札の一番上を列へ戻す手）を足す。めくってよいのは、素朴な手が無いとき（free_flip=True ならいつでも）。
    変種の手はいつでも打てるので、「置ける手が無ければめくる」を変種の手で判定すると、めくらずに同じ所を回り続ける。
    そこで、めくれるかは素朴な手だけで決める（反例探しの役が使った決め方と同じ。そのスクリプトはリポジトリに置いていない）。
    局面はめくり1枚ごとに分け（列は並べ替えた形）、行ける局面を全部たどる。
    段: 1 = 行けるどの局面からも勝ちへ行ける、2 = 根からは勝ちへ行けるが、勝ちへ行けない局面にも入れる、3 = 根から勝ちへ行けない。
    戻り値: 段（1/2/3）か None（打ち切り）。
    """
    s0 = _gen_canon((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()))
    children = {}
    stack = [s0]
    seen = {s0}
    while stack:
        st = stack.pop()
        ch = _gen_successors(st, empty, pf, allpartial, back, free_flip)
        for s2 in ch:
            if s2 != WIN and s2 not in seen:
                seen.add(s2)
                stack.append(s2)
                if len(seen) > limit:
                    return None
        children[st] = ch
    parents = {}
    for v, ch in children.items():
        for c in ch:
            parents.setdefault(c, []).append(v)
    canwin = set()
    q = [WIN]
    while q:
        x = q.pop()
        for p_ in parents.get(x, ()):
            if p_ not in canwin:
                canwin.add(p_)
                q.append(p_)
    if s0 not in canwin:
        return 3
    if any(v not in canwin for v in children):
        return 2
    return 1


def _topo_order(g):
    """根から行ける節点を、子が親より後に来る順で返す（DAG）。"""
    nodes = g["nodes"]
    order = []
    state = {}
    root = g["root"]
    if root not in nodes:
        return order
    stack = [(root, 0)]
    while stack:
        v, i = stack.pop()
        if i == 0:
            if state.get(v) == 2:
                continue
            state[v] = 1
        ch = nodes[v]
        if i < len(ch):
            stack.append((v, i + 1))
            c = ch[i][1]
            if c in nodes and state.get(c) is None:
                stack.append((c, 0))
        else:
            state[v] = 2
            order.append(v)
    order.reverse()
    return order


def natural_class(g):
    """素朴な解き方の段 T（版2）: 1 = どの道筋でも勝てる、2 = 勝てる道筋と勝てない道筋がある、3 = どの道筋でも勝てない。

    「勝てない道筋」は、詰むか、勝てる見込みの無い局面へ入る道筋（輪が無いので、どの道筋も勝ちか詰みで終わる）。
    戻り値: (段, 勝てる確率（置ける手から等しい確率で選ぶとき。記録だけ）)。
    """
    nodes = g["nodes"]
    root = g["root"]
    if root == WIN:
        return 1, 1.0
    if root not in nodes:
        return 3, 0.0
    if not g["complete"]:
        return None, None  # 網をたどり切れない（打ち切り）
    order = _topo_order(g)
    winp = {}
    all_win = {}
    for v in reversed(order):
        ps = []
        aw = True
        for _, c in nodes[v]:
            if c == WIN:
                ps.append(1.0)
            elif c in nodes:
                ps.append(winp[c])
                aw = aw and all_win[c]
            else:
                ps.append(0.0)
                aw = False
        winp[v] = sum(ps) / len(ps)
        all_win[v] = aw
    if all_win[root]:
        return 1, 1.0
    if winp[root] == 0:
        return 3, 0.0
    return 2, winp[root]


class AliveOracle:
    """読むモデルの「解ける／解けない」（版2）。規則で打てる手をすべて使う解法器（Solver(partial=True, back=True)）。

    同じ配り方の中で、解けないと確かめた局面（探し切って勝ちが無かった探索で訪れた局面はすべて解けない）と、
    勝ちへ続く道の上の局面を覚え、次の問い合わせの探索を省く。1回の問い合わせは limit 局面で打ち切り、None を返す。
    """

    def __init__(self, limit=40_000, budget=4_000_000, cache_unknown=False, bc=False):
        # bc=True が版5 の読むモデル（組札の一番上を足場の上へ戻す手 BC を足した解法器）。版2〜4 は bc=False
        self.sv = Solver(partial=True, back=True, pfilter="v2", bc=bc)
        self.dead_keys = set()
        self.alive_keys = set()
        self.limit = limit
        self.budget = budget
        self.used = 0
        self.queries = 0
        self.unknown = 0
        # 版3: 打ち切った局面を覚え、同じ局面をもう一度探さない（版2 は覚えない。版2 の値を変えないため既定は False）
        self.cache_unknown = cache_unknown
        self.unknown_keys = set()

    def query(self, tab, fnd, pool):
        sv = self.sv
        t, f, p, _ = sv.auto(tuple(tab), tuple(fnd), pool)
        if f == (13, 13, 13, 13):
            return True
        k0 = (tuple(sorted(t)), f)
        if k0 in self.dead_keys:
            return False
        if k0 in self.alive_keys:
            return True
        if self.cache_unknown and k0 in self.unknown_keys:
            return None
        self.queries += 1
        if self.used > self.budget:
            self.unknown += 1
            if self.cache_unknown:
                self.unknown_keys.add(k0)
            return None
        local = set()
        path = []
        nodes = [0]
        limit = self.limit

        def dfs(t, f, p):
            t, f, p, _ = sv.auto(t, f, p)
            if f == (13, 13, 13, 13):
                return True
            k = (tuple(sorted(t)), f)
            if k in self.alive_keys:
                path.append(k)
                return True
            if k in self.dead_keys or k in local:
                return False
            local.add(k)
            nodes[0] += 1
            if nodes[0] > limit:
                raise Limit
            if sv.dead(t, f):
                return False
            for m in sv.moves(t, f, p):
                if dfs(m[3], m[4], m[5]):
                    path.append(k)
                    return True
            return False

        try:
            ok = dfs(t, f, p)
        except Limit:
            self.used += nodes[0]
            self.unknown += 1
            if self.cache_unknown:
                self.unknown_keys.add(k0)
            return None
        self.used += nodes[0]
        if ok:
            self.alive_keys.update(path)
            return True
        self.dead_keys.update(local)
        return False


def _reader_state(st):
    tab, fnd, stock_rev, waste = st
    return tab, fnd, pool_mask(stock_rev, waste)


def trap_analysis_v2(g, oracle):
    """分かれ道の網の上で、罠の分かれ道と、罠から詰むまでの深さを求める（版2）。

    1. 根から、読むモデルで解ける節点だけをたどり、各子が解けるかを問い合わせる（解けない節点の先は解けない）。
    2. 罠の分かれ道: 解ける節点 u で置ける手が2つ以上あり、ある手 m の後、置ける手が1つだけの所を進んだ先
       （次の分かれ道・詰み）が解けないとき、(u, m) を罠とする。
    3. 深さ: 罠の先の局面から、素朴な解き方のどの続け方でも詰むまでに出会う分かれ道の数の最大（Lmax）と最小（Lmin）。
       組札があと何枚進むか（Fmax）も記録する。
    打ち切り（None）は「解ける側」と「解けない側」の両方に倒して求める。
    戻り値: dict(traps, Dmax, Dmin, ...（倒し方ごと）, queries, unknown)。
    """
    nodes = g["nodes"]
    root = g["root"]
    if root not in nodes:
        return {"traps": 0, "unknown_nodes": 0}
    order = _topo_order(g)
    # 素朴な手だけで勝ちへ行ける節点は、読むモデルでも解ける（問い合わせない）
    anywin = {}
    for v in reversed(order):
        anywin[v] = any(c == WIN or (c in nodes and anywin[c]) for _, c in nodes[v])
    # 1. 解けるかの札付け（解けない節点の子は問い合わせない。打ち切りの節点の子は、解ける側に倒すときのために問い合わせる）
    label = {}
    stuck_label = {}
    label[root] = True
    for v in order:
        if v not in label:
            continue  # 解けない節点からしか来ない節点
        if label[v] is False:
            continue
        for _, c in nodes[v]:
            if c == WIN:
                continue
            if c in nodes:
                if c not in label:
                    label[c] = True if anywin[c] else oracle.query(*_reader_state(c))
            else:
                skey = c[1]
                if skey not in stuck_label:
                    stuck_label[skey] = oracle.query(*_reader_state(skey))
    # 解けない節点の子孫は解けない（札の無い節点は解けない扱い）

    def is_alive(c, unknown_as):
        if c == WIN:
            return True
        if c in nodes:
            v = label.get(c, False)
        else:
            v = stuck_label.get(c[1], False)
        return unknown_as if v is None else v

    # 2. 深さ（構造だけで決まる）: Lmax / Lmin（分かれ道の数）, Fmax（組札の最大枚数）
    lmax = {}
    lmin = {}
    fmax = {}
    for v in reversed(order):
        dec = 1 if len(nodes[v]) >= 2 else 0
        mx = None
        mn = None
        fm = v[1] and sum(v[1])
        for _, c in nodes[v]:
            if c == WIN:
                a = b = 0
                fc = 52
            elif c in nodes:
                a, b, fc = lmax[c], lmin[c], fmax[c]
            else:
                a = b = 0
                fc = sum(c[1][1])
            mx = a if mx is None else max(mx, a)
            mn = b if mn is None else min(mn, b)
            fm = max(fm, fc)
        lmax[v] = dec + mx
        lmin[v] = dec + mn
        fmax[v] = fm

    def depth_of(c):
        if c in nodes:
            return lmax[c], lmin[c], fmax[c]
        return 0, 0, sum(c[1][1])

    def succ(c):
        """置ける手が1つだけの節点を進んだ先（分かれ道か終わり）と、途中の節点。"""
        chain = []
        while c in nodes and len(nodes[c]) == 1:
            chain.append(c)
            c = nodes[c][0][1]
        return c, chain

    out = {}
    for unknown_as in (False, True):
        traps = []

        def alive_chain(c, chain):
            for x in chain:
                if not is_alive(x, unknown_as):
                    return False
            return is_alive(c, unknown_as)

        for v in order:
            if not is_alive(v, unknown_as):
                continue
            if len(nodes[v]) < 2:
                continue
            for mv, c in nodes[v]:
                w, chain = succ(c)
                if not alive_chain(w, chain):
                    # 罠の先の深さは、手の直後の局面から数える（その間の強制手は分かれ道ではないので数えに入らない）
                    a, b, fc = depth_of(c)
                    traps.append((a, b, fc - sum(v[1]), mv[0]))
        tag = "alt" if unknown_as else "base"
        out[f"traps_{tag}"] = len(traps)
        if traps:
            out[f"Dmax_{tag}"] = max(t[0] for t in traps)
            out[f"Dmin_{tag}"] = min(t[1] for t in traps)
            out[f"Dmaxmin_{tag}"] = max(t[1] for t in traps)
            out[f"Dminmax_{tag}"] = min(t[0] for t in traps)
            out[f"Fmax_{tag}"] = max(t[2] for t in traps)
            out[f"Fmin_{tag}"] = min(t[2] for t in traps)
            out[f"kinds_{tag}"] = sorted({t[3] for t in traps})
        else:
            for k in ("Dmax", "Dmin", "Dmaxmin", "Dminmax", "Fmax", "Fmin"):
                out[f"{k}_{tag}"] = None
            out[f"kinds_{tag}"] = []
    out["unknown_nodes"] = sum(1 for v in label.values() if v is None) + sum(1 for v in stuck_label.values() if v is None)
    out["alive_nodes"] = sum(1 for v in label.values() if v)
    out["stuck_alive"] = sum(1 for v in stuck_label.values() if v)
    return out


def verify_oracle_dead(seeds, per_seed=6, limit=300_000, budget_sec=540):
    """確かめ用: AliveOracle が「解けない」とした罠の先の局面を、枝刈りなしの素直な解法器（plain_solve）で解き直す。

    素直な解法器が勝ちを見つけたら、読むモデルの「解けない」が誤り。戻り値: {"lose": n, "unknown": n, "win": n}。
    """
    t0 = time.time()
    cnt = {"lose": 0, "unknown": 0, "win": 0}
    wins = []
    for seed in seeds:
        if time.time() - t0 > budget_sec:
            break
        tab, stock = deal(seed)
        g = natural_graph(tab, stock)
        if not g["complete"] or g["root"] not in g["nodes"]:
            continue
        T, _ = natural_class(g)
        if T is None or T < 2:
            continue
        oracle = AliveOracle()
        trap_analysis_v2(g, oracle)
        nodes = g["nodes"]
        picked = 0
        for v, ch in nodes.items():
            if picked >= per_seed:
                break
            for _, c in ch:
                if c in nodes:
                    st = _reader_state(c)
                    t, f, p, _ = oracle.sv.auto(*st)
                    if (tuple(sorted(t)), f) in oracle.dead_keys:
                        r, _ = plain_solve(t, limit, f, p)
                        cnt[r] += 1
                        if r == "win":
                            wins.append(seed)
                        picked += 1
                        break
    return cnt, wins


def features_v2(seed, oracle_limit=40_000, oracle_budget=2_000_000, graph_limit=400_000, deal_override=None):
    """版2 の特徴を1つの配り方について最初から求める（乱数を使わない）。deal_override で (列, 山札) を直接渡せる。"""
    t0 = time.time()
    tab, stock = deal_override if deal_override is not None else deal(seed)
    f = {"seed": seed}
    for name, var in NAT_VARIANTS.items():
        g = natural_graph(tab, stock, var["empty"], var["pf"], graph_limit)
        T, p = natural_class(g)
        f[f"T_{name}"] = T
        f[f"p_{name}"] = round(p, 6) if p is not None else None
        f[f"graph_{name}"] = len(g["nodes"])
        f[f"graph_complete_{name}"] = g["complete"]
        if name == "full":
            gfull = g
    f["graph_sec"] = round(time.time() - t0, 3)
    nd = gfull["nodes"]
    decs = [len(ch) for ch in nd.values() if len(ch) >= 2]
    f["decision_nodes"] = len(decs)
    f["branch_dec"] = round(statistics.mean(decs), 3) if decs else None
    f["root_cands"] = len(nd[gfull["root"]]) if gfull["root"] in nd else 0
    t1 = time.time()
    if f["T_full"] is not None and f["T_full"] >= 2:
        oracle = AliveOracle(oracle_limit, oracle_budget)
        tr = trap_analysis_v2(gfull, oracle)
        f.update(tr)
        f["oracle_queries"] = oracle.queries
        f["oracle_nodes"] = oracle.used
        f["oracle_unknown"] = oracle.unknown
    f["trap_sec"] = round(time.time() - t1, 3)
    return f


# 版2 の分類（採った案: 素朴な解き方の段 T × 罠の深さ D）
D_SHORT = 1   # D がこれ以下: 罠を踏むと、すぐ（分かれ道1つ以内で）行き詰まりが見える
D_LONG = 4    # D がこれを超える: 罠を踏んでも、5つ以上の分かれ道を過ぎるまで行き詰まりが見えない


def d_band(d):
    return 1 if d <= D_SHORT else (2 if d <= D_LONG else 3)


T_KEYS = ("full", "noE", "noPF", "basic")


def t_stage(f, primary="full", robust=True):
    """段 T を分類に使える形で返す。戻り値: (段, None) か (None, (状態, 理由))。

    段 1（どの道筋でも勝てる）と段 3（どの道筋でも勝てない）は「すべての道筋」についての約束なので、
    素朴な手の4つの変種（列を空ける手・途中から動かして組札へ送る手の有無）のどれでも同じ段のときだけ使う（robust）。
    段 2 は変種で 1 にも 3 にも動くので、変種を問わない（素朴な手すべて full で決める）。
    """
    T = f.get(f"T_{primary}")
    if T is None or any(f.get(f"T_{k}") is None for k in T_KEYS):
        return None, ("unsupported", "natural-graph-too-large")
    if robust and T in (1, 3) and not all(f.get(f"T_{k}") == T for k in T_KEYS):
        return None, ("out-of-range", "natural-depends-on-move-types")
    return T, None


def classify_v2(f, primary="full", robust=True):
    """版2 の分類。f は features_v2 の出力に survey の status を足したもの。

    戻り値: (状態, レベルか理由)。打ち切りを両側に倒して段が変わるなら評価不能。
    """
    if f.get("status") != "win":
        return "invalid", "not-proven-solvable"
    T, why = t_stage(f, primary, robust)
    if why:
        return why
    if T == 1:
        return "classified", 1

    def one(tag):
        if not f.get(f"traps_{tag}"):
            return "out-of-range", "no-true-trap"
        d = f.get(f"Dmaxmin_{tag}")
        lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, d_band(d)))
        if lv is None:
            return "out-of-range", "unlisted-combination"
        return "classified", lv

    a = one("base")
    b = one("alt")
    if a != b:
        return "unsupported", "oracle-unresolved"
    return a


def suit_swap(tab, stock):
    """確かめ用: ♠と♣、♥と♦を入れ替えた配り方（同じ問題）。"""
    sw = {0: 3, 3: 0, 1: 2, 2: 1}

    def m(c):
        return sw[SUIT[c]] * 13 + RANK[c] - 1

    return tuple(tuple(m(c) for c in col) for col in tab), tuple(m(c) for c in stock)


def symmetry_check(seeds):
    """確かめ用: マークの入れ替えと、列の並べ替えで、版2 の特徴が変わらないか。"""
    keys = ("T_full", "T_noE", "T_noPF", "T_basic", "traps_base", "Dmaxmin_base", "Dmaxmin_alt", "Dmax_base", "Fmax_base")
    diff = []
    for seed in seeds:
        tab, stock = deal(seed)
        a = features_v2(seed)
        b = features_v2(seed, deal_override=suit_swap(tab, stock))
        c = features_v2(seed, deal_override=(tuple(reversed(tab)), stock))
        for k in keys:
            if not (a.get(k) == b.get(k) == c.get(k)):
                diff.append((seed, k, a.get(k), b.get(k), c.get(k)))
    return diff


def load_v2(cache_dir, prefix="random", name="v2d"):
    S = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    V = _load_jsonl(os.path.join(cache_dir, f"{name}_{prefix}.jsonl"))
    rows = []
    for seed, r in sorted(S.items()):
        f = {"seed": seed, "status": r["status"], "tier": r.get("tier"), "moves": r.get("moves"),
             "self_block": r["self_block"], "buried_low": r["buried_low"]}
        if seed in V and "error" not in V[seed]:
            f.update(V[seed])
        rows.append(f)
    return rows


def _band_chain(f, key, a, b, tag, primary="full", robust=True):
    if f.get("status") != "win":
        return "invalid"
    T, why = t_stage(f, primary, robust)
    if why:
        return "unsupported" if why[0] == "unsupported" else "oor-moves"
    if T == 1:
        return 1
    if not f.get(f"traps_{tag}"):
        return "oor-no-trap"
    x = f.get(f"{key}_{tag}")
    band = 1 if x <= a else (2 if x <= b else 3)
    return {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, band), "unlisted")


def plan_v2(key, a, b, primary="full", robust=True):
    def fn(f):
        x = _band_chain(f, key, a, b, "base", primary, robust)
        y = _band_chain(f, key, a, b, "alt", primary, robust)
        return x if x == y else "unresolved"
    return fn


def plan_v2_tier(f):
    if f.get("status") != "win":
        return "invalid"
    T, why = t_stage(f)
    if why:
        return "unsupported" if why[0] == "unsupported" else "oor-moves"
    if T == 1:
        return 1
    k = 1 if f.get("tier") == "E" else 2
    return {(2, 1): 2, (2, 2): 3, (3, 1): 4, (3, 2): 5}[(T, k)]


PLANS_V2 = {
    "案A 段T × 罠の深さD（最短の続きの分かれ道、罠の中の最大）": plan_v2("Dmaxmin", D_SHORT, D_LONG),
    "案B 段T × 最長の続きの分かれ道（罠の中の最大）": plan_v2("Dmax", 2, 7),
    "案C 段T × 罠の後に組札が進む枚数（罠の中の最大）": plan_v2("Fmax", 3, 9),
    "案D 段T × 罠の数": plan_v2("traps", 3, 12),
    "案E 段T × 手筋（組札へ運ぶのを待つ手が要るか）": plan_v2_tier,
}


def compare_v2(cache_dir, prefix="random", name="v2d"):
    rows = load_v2(cache_dir, prefix, name)
    win = [f for f in rows if f["status"] == "win"]
    print(f"解けると確かめた配り方: {len(win)} / {len(rows)}")
    print("段 T（素朴な手すべて）:", {str(k): sum(1 for f in win if f.get("T_full") == k) for k in (1, 2, 3, None)})
    for t_ in (1, 3):
        print(f"段 {t_}: 素朴な手すべてで", sum(1 for f in win if f.get("T_full") == t_),
              "／ 4つの変種すべてで", sum(1 for f in win if all(f.get(f"T_{k}") == t_ for k in T_KEYS)))
    base = PLANS_V2[next(iter(PLANS_V2))]
    lv_base = {f["seed"]: base(f) for f in win}
    for pname, fn in PLANS_V2.items():
        lv = {}
        for f in win:
            lv.setdefault(fn(f), []).append(f)
        print(f"\n== {pname}")
        print("  件数:", {str(k): len(v) for k, v in sorted(lv.items(), key=lambda kv: str(kv[0]))})
        for feat in ("Dmaxmin_base", "Dmax_base", "Fmax_base", "traps_base", "Dmin_base", "p_full", "moves", "branch_dec", "root_cands"):
            print(f"  {feat:14s}", " | ".join(str(_q([f.get(feat) for f in lv.get(L, [])])) for L in (1, 2, 3, 4, 5)))
        print("  素朴な解き方の上限: T=3 の割合", [round(sum(1 for f in lv.get(L, []) if f.get("T_full") == 3) / max(1, len(lv.get(L, []))), 2) for L in (1, 2, 3, 4, 5)])
        if fn is not base:
            n = ch = far = 0
            for f in win:
                a_ = lv_base[f["seed"]]
                if not isinstance(a_, int):
                    continue
                b_ = fn(f)
                n += 1
                if a_ != b_:
                    ch += 1
                    if isinstance(b_, int) and abs(a_ - b_) >= 2:
                        far += 1
            print(f"  案A と比べてレベルか状態が変わる問題: {ch}/{n}（2段以上 {far}）")

    def changed(fn2):
        n = ch = far = 0
        for f in win:
            a_ = lv_base[f["seed"]]
            if not isinstance(a_, int):
                continue
            b_ = fn2(f)
            n += 1
            if a_ != b_:
                ch += 1
                if isinstance(b_, int) and abs(a_ - b_) >= 2:
                    far += 1
        return f"{ch}/{n}（2段以上 {far}）"

    print("\n案A の感度（レベルか状態が変わる問題 / 案A で分類済みの問題）")
    for a_, b_ in ((D_SHORT - 1, D_LONG), (D_SHORT + 1, D_LONG), (D_SHORT, D_LONG - 1), (D_SHORT, D_LONG + 1)):
        print(f"  境目 {a_} / {b_}:", changed(plan_v2("Dmaxmin", a_, b_)))
    print("  罠の中の最大でなく最小（すべての罠が深い）:", changed(plan_v2("Dmin", D_SHORT, D_LONG)))
    a0 = plan_v2("Dmaxmin", D_SHORT, D_LONG, robust=False)
    lv0 = {}
    for f in win:
        lv0.setdefault(a0(f), []).append(f)
    print("  段 3 を変種で確かめない（段 1 も確かめない。案A0）:", changed(a0),
          "件数", {str(k): len(v) for k, v in sorted(lv0.items(), key=lambda kv: str(kv[0]))})
    for k in ("noE", "noPF", "basic"):
        print(f"  段 T を素朴な手の {k} で決める（D は替えない）:", changed(plan_v2("Dmaxmin", D_SHORT, D_LONG, primary=k)))
    print("  打ち切りで段が決まらない問題:", sum(1 for f in win if base(f) == "unresolved"))
    t = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win]
    print("  1候補の時間（素朴な網と罠の分析、Python 1プロセス）: 中央値", round(statistics.median(t), 2), "秒・95パーセンタイル",
          round(sorted(t)[int(len(t) * 0.95)], 1), "秒・最大", round(max(t), 1), "秒・合計", round(sum(t)), "秒")
    for L in (1, 2, 3, 4, 5):
        sub = [f for f in win if lv_base[f["seed"]] == L]
        tt = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in sub]
        print(f"    L{L}: 中央値 {round(statistics.median(tt), 2) if tt else None} 秒・最大 {round(max(tt), 1) if tt else None} 秒")
    win_d1 = [f for f in win if isinstance(lv_base[f["seed"]], int)]
    return lv_base, win_d1


def _d1_worker(args):
    seed, kw = args
    runs, budget = kw["runs"], kw["budget"]
    tab, _ = deal(seed)
    fwd = sum(1 for k in range(runs) if savvy_undo(tab, random.Random(seed * 101 + k), budget=budget)[0]) / runs
    full = sum(1 for k in range(runs) if savvy_undo(tab, random.Random(seed * 101 + k), budget=budget, partial=True, back=True)[0]) / runs
    return {"seed": seed, "push": fwd, "push_full": full}


def d1_check(cache_dir, out_path, prefix="random", name="v2d", runs=10, budget=100, procs=4):
    """D1: 定石つき＋待った（読むモデルの手を無作為な順で打ち、行き止まりで戻る）の押し切り率を、案ごと・レベルごとに測る（確かめ用。分類には使わない）。

    乱数は random.Random(seed*101+k)（k = 0..runs-1）。押し切り率は乱数に依るので、分類には使わない。
    """
    rows = load_v2(cache_dir, prefix, name)
    win = [f for f in rows if f["status"] == "win"]
    lv = {pname: {f["seed"]: fn(f) for f in win} for pname, fn in PLANS_V2.items()}
    seeds = sorted({s_ for m in lv.values() for s_, v in m.items() if isinstance(v, int)})
    run_jobs(_d1_worker, seeds, out_path, procs, runs=runs, budget=budget)
    res = _load_jsonl(out_path)
    for pname, m in lv.items():
        print(f"== {pname}")
        for L in (1, 2, 3, 4, 5):
            sub = [res[s_] for s_, v in m.items() if v == L and s_ in res]
            r1 = [r["push"] for r in sub]
            r2 = [r["push_full"] for r in sub]
            print(f"  L{L} 件数 {len(sub)}: 押し切り率（待つ手・山札の足場まで）10/50/90 {_q(r1)}・0.5以上 {sum(1 for r in r1 if r >= 0.5)}"
                  f"／ すべての手 10/50/90 {_q(r2)}・0.5以上 {sum(1 for r in r2 if r >= 0.5)}")


def write_expected_v2(seeds, out_path):
    """移植の期待値（版2）。乱数を使わない量だけを書く。"""
    items = []
    for seed in seeds:
        t0 = time.time()
        tab, stock = deal(seed)
        sv = survey_one(seed)
        f = {"status": sv["status"], "tier": sv.get("tier")}
        if sv["status"] == "win":
            f.update(features_v2(seed))
        st, why = classify_v2(f)
        item = {
            "seed": seed,
            "deal": deal_text(tab, stock),
            "deal_cards": {"columns": [list(c) for c in tab], "stock": list(stock)},
            "solver": {"limits": SPACE_LIMIT, "spaces": sv["spaces"], "status": sv["status"]},
            "assessment": {"state": st, "value": why},
        }
        if sv["status"] == "win":
            item["natural"] = {k: f.get(k) for k in (
                "T_full", "T_noE", "T_noPF", "T_basic", "p_full", "graph_full", "graph_noE", "graph_noPF", "graph_basic",
                "decision_nodes", "branch_dec", "root_cands")}
            item["traps"] = {k: f.get(k) for k in (
                "traps_base", "traps_alt", "Dmaxmin_base", "Dmaxmin_alt", "Dmax_base", "Dmin_base", "Fmax_base",
                "kinds_base", "unknown_nodes", "alive_nodes", "stuck_alive", "oracle_queries", "oracle_nodes", "oracle_unknown")}
            item["traps"]["oracle_limit"] = 40_000
            item["traps"]["oracle_budget"] = 2_000_000
        item["sec"] = round(time.time() - t0, 2)
        items.append(item)
        print(seed, st, why, item["sec"], flush=True)
    doc = {
        "about": "ソリティア難易度の調査コード solitaire_difficulty.py の、版2（段 T × 罠の深さ D）の seed ごとの結果。検査 F2 で移植したコードと突き合わせる。",
        "rules": "52枚・7列（1〜7枚）、列は全部表、山札24枚は1枚ずつ何周でも。deal(seed) は Python の random.Random(seed).shuffle で並べ、列 i に i+1 枚、残りが山札（stock[0] が次にめくる札）。札の番号は suit*13+rank-1（S,H,D,C）",
        "thresholds": {"D_SHORT": D_SHORT, "D_LONG": D_LONG},
        "notes": [
            "分類は classify_v2。段 1 と段 3 は、natural.T_full・T_noE・T_noPF・T_basic がすべて同じ段のときだけ使い、違えば out-of-range（natural-depends-on-move-types）",
            "乱数を使う量は無い。移植では deal_cards から同じ盤面を作って比べる（deal の乱数は Python の random に依る）",
            "natural.graph_* は素朴な手の網の節点の数（列を並べ替えて同じ局面は1つ。同じ局面になる手は1つ）。T_* と一緒に一致させる",
            "traps.oracle_queries・oracle_nodes・oracle_unknown は読むモデルの解法器の問い合わせの量。手の並び順・枝刈り・覚えた局面の使い方が同じなら一致する。採否（打ち切りで評価不能になるか）に関わる",
        ],
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


MOVEVAR = {
    "PT": {"allpartial": True},   # 並びの途中から上を、目的を問わずほかの列へ動かす手を足す
    "BT": {"back": True},         # 組札の一番上を列へ戻す手を足す
    "FF": {"free_flip": True},    # 置ける手があっても、置かずにめくってよい
}


def _movevar_worker(args):
    """確かめ用: 素朴な手に手の種類を足したとき、段が崩れるか。

    段 1 の問題: PT・BT は足した手の範囲で、行けるどの局面からも勝ちへ行けるか（natural_class_general。1 / 2）。
      FF は詰む局面へ行けるか（natural_freeflip_search(…, "stuck")。行ければ 2、行けなければ 1）。
    段 3 の問題: 足した手の範囲で、勝ちへ行けるようになるか（PT・BT は natural_reach_win、FF は natural_freeflip_search(…, "win")。
      行ければ 2、行けなければ 3）。
    段 2 の問題: 手を足しても根から勝ちへ行けることは変わらない（導出）ので測らない。
    """
    seed, kw = args
    t0 = time.time()
    tab, stock = deal(seed)
    T = kw["T"][str(seed)]
    limit = kw.get("limit", 300_000)
    row = {"seed": seed, "T_full": T}
    for name, var in MOVEVAR.items():
        if name == "FF":
            r = natural_freeflip_search(tab, "stuck" if T == 1 else "win", limit=limit)
            row[name] = None if r is None else (2 if r else T)
        elif T == 1:
            row[name] = natural_class_general(tab, stock, limit=limit, **var)
        elif T == 3:
            r = natural_reach_win(tab, stock, limit=limit, **var)
            row[name] = None if r is None else (2 if r else 3)
    row["sec"] = round(time.time() - t0, 2)
    return row


def _move_class(mv, st):
    """手の分類（優先順位の変種用）: F 組札へ（TF・WF・PF）/ T 並びを列へ（列を空ける手を除く）/ W 捨て札を列へ / E 列を空ける。"""
    k = mv[0]
    if k in ("TF", "WF", "PF"):
        return "F"
    if k == "WT":
        return "W"
    if k == "TT":
        _, i, s_, _ = mv
        col = st[0][i]
        if s_ == 0 and RANK[col[0]] != 13:
            return "E"
        return "T"
    return "?"


POLICIES = {
    "fnd_first": ("F",),                  # 組札へ運べる手があれば、その中から選ぶ
    "class_prio": ("F", "T", "W", "E"),   # 組札へ → 並びを列へ → 捨て札を列へ → 列を空ける、の順で、ある分類の中から選ぶ
}


def natural_class_policy(g, policy):
    """確かめ用: 素朴な手の網を、優先順位を持つ遊び方の道筋に絞ったときの段 T（1/2/3）。

    優先順位は、置ける手の分類のうち最も先にあるものだけを残す。残った手からどれを選ぶかは問わない（段は道筋の有無で決まる）。
    段 1 と段 3 は、道筋を絞っても変わらない（導出）。段 2 の問題だけが、絞り方で 1 や 3 に動き得る。
    """
    nodes = g["nodes"]
    root = g["root"]
    if root == WIN:
        return 1
    if root not in nodes:
        return 3
    prio = POLICIES[policy]
    memo = {}

    def keep(v):
        ch = nodes[v]
        for cls in prio:
            sel = [c for mv, c in ch if _move_class(mv, v) == cls]
            if sel:
                return sel
        return [c for _, c in ch]

    order = _topo_order(g)
    for v in reversed(order):
        aw = True
        aw_any = False
        for c in keep(v):
            if c == WIN:
                aw_any = True
            elif c in nodes:
                a, b = memo.get(c, (False, False))
                aw = aw and a
                aw_any = aw_any or b
            else:
                aw = False
        memo[v] = (aw, aw_any)
    a, b = memo[root]
    return 1 if a else (2 if b else 3)


def _policy_worker(args):
    seed, kw = args
    tab, stock = deal(seed)
    g = natural_graph(tab, stock)
    return {"seed": seed, **{p: natural_class_policy(g, p) for p in POLICIES}}


def policy_check(cache_dir, out_path, prefix="random", name="v2d", procs=4):
    rows = load_v2(cache_dir, prefix, name)
    lv = {}
    for f in rows:
        st, v = classify_v2(f)
        if st == "classified" and v in (2, 3):
            lv[f["seed"]] = v
    run_jobs(_policy_worker, sorted(lv), out_path, procs)
    res = _load_jsonl(out_path)
    for L in (2, 3):
        sub = [res[s] for s in lv if lv[s] == L and s in res]
        print(f"L{L} 件数 {len(sub)}:", {p: {str(t): sum(1 for r in sub if r[p] == t) for t in (1, 2, 3)} for p in POLICIES})


def movevar_check(cache_dir, out_path, prefix="random", name="v2d", procs=4, limit=300_000):
    rows = load_v2(cache_dir, prefix, name)
    lv = {}
    T = {}
    for f in rows:
        st, v = classify_v2(f)
        if st == "classified" and v in (1, 4, 5):
            lv[f["seed"]] = v
            T[str(f["seed"])] = f["T_full"]
    run_jobs(_movevar_worker, sorted(lv), out_path, procs, T=T, limit=limit)
    res = _load_jsonl(out_path)
    for L in (1, 4, 5):
        sub = [res[s] for s in lv if lv[s] == L and s in res]
        print(f"L{L} 件数 {len(sub)}:", {k: dict(sorted(((str(x), sum(1 for r in sub if r.get(k) == x)) for x in {r.get(k) for r in sub}))) for k in MOVEVAR})


def _v2_worker(args):
    seed, kw = args
    try:
        return features_v2(seed, **kw)
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


# ===========================================================================
# 版3: 版2 に当てた2回目の反例探し（A4）を受けた直し
#
#   - 分かれ道は「どの手を選ぶかで、行ける終わり（勝ち・詰んだ局面）の集まりが変わる節点」だけを数える。
#     並べ方だけが違う手（4S と 4D のどちらを先に組札へ）や、先が変わらない手（組札へ送るか列へ置くか）は分かれ道にしない。
#   - 安全な組札送りを先に打つ遊び方（アプリが安全な札を自動で組札へ送るときの網と同じ）の網も作る（restrict_safe）。
#   - 打ち切った局面は、あり得るすべての札付けの上で D の幅を取る（確かな罠 ⊆ 本当の罠 ⊆ あり得る罠）。
#     幅で段が1つに決まらなければ評価不能。札は、解ける子を持つ節点は解ける、解けない節点の子は解けない、で絞る。
# 分類に使う関数: features_v3 → classify_v3（採用形は rule="none"、境目は D_SHORT_V3・D_LONG_V3）。
# ===========================================================================


def is_safe_fnd_move(mv, st):
    """安全な組札送り（読むモデルの auto と同じ条件）か。PF は含めない。"""
    tab, fnd, _, waste = st
    if mv[0] == "TF":
        return safe_to_foundation(tab[mv[1]][-1], fnd)
    if mv[0] == "WF":
        return safe_to_foundation(waste[-1], fnd)
    return False


def restrict_safe(g):
    """安全な組札送りがある節点では、それ（最初の1つ）だけを打つ網に絞る。

    安全な札を必ず先に組札へ送る遊び方の道筋で、アプリが安全な札を自動で組札へ送るときの網と同じ
    （送る節点は置ける手が1つの節点になり、分かれ道にも罠の置き場所にもならない）。
    道筋の一部だけを残すので、段 1 と段 3 は変わらない（導出）。
    """
    nodes = g["nodes"]
    out = {}
    for v, ch in nodes.items():
        keep = None
        for mv, c in ch:
            if is_safe_fnd_move(mv, v):
                keep = [(mv, c)]
                break
        out[v] = keep if keep else ch
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


def label_graph(g, oracle, known=None):
    """網の節点と詰んだ局面に、読むモデルで解けるかの札（True / False / None = 打ち切り）を付ける。

    1. 根（解けると確かめた配り方）から、解ける・打ち切りの節点の子に問い合わせる（素朴な手だけで勝ちへ行ける節点は問わない）。
    2. 問い合わせなかった節点は、解けない節点からしか来ないので解けない。
    3. 打ち切りを絞る: 解ける子を持つ節点は解ける（素朴な手は規則の手）。解けない節点の子は解けない。
    known: 別の網で付けた札 (label, stuck) を使い回す（札は局面だけで決まる）。
    戻り値: (順, label, stuck, 食い違い)。食い違いは、解けない節点の子が解けると問い合わせで出た数（読むモデルの誤りの印）。
    """
    nodes = g["nodes"]
    root = g["root"]
    order = _topo_order(g)
    anywin = {}
    for v in reversed(order):
        anywin[v] = any(c == WIN or (c in nodes and anywin[c]) for _, c in nodes[v])
    kl, ks = known if known else ({}, {})
    label = {root: True}
    stuck = {}
    for v in order:
        if label.get(v, False) is False:
            continue
        for _, c in nodes[v]:
            if c == WIN:
                continue
            if c in nodes:
                if c not in label:
                    if anywin[c]:
                        label[c] = True
                    elif c in kl:
                        label[c] = kl[c]
                    else:
                        label[c] = oracle.query(*_reader_state(c))
            else:
                k = c[1]
                if k not in stuck:
                    stuck[k] = ks[k] if k in ks else oracle.query(*_reader_state(k))
    for v in order:
        if v not in label:
            label[v] = False
    for v in reversed(order):
        if label[v] is None and any(
                c == WIN or (c in nodes and label[c] is True) or (c not in nodes and stuck.get(c[1]) is True)
                for _, c in nodes[v]):
            label[v] = True
    conflicts = 0
    for v in order:
        if label[v] is False:
            for _, c in nodes[v]:
                if c == WIN:
                    conflicts += 1
                elif c in nodes:
                    if label[c] is None:
                        label[c] = False
                    elif label[c] is True:
                        conflicts += 1
                else:
                    if stuck.get(c[1]) is None:
                        stuck[c[1]] = False
                    elif stuck[c[1]] is True:
                        conflicts += 1
    return order, label, stuck, conflicts


def _term_decisions(nodes, sub_order):
    """sub_order（子孫で閉じた節点の集まり、子が親より後）の各節点が、終わりの集まりで見て分かれ道か（1 / 0）。

    終わり: 勝ち、または詰んだ局面（列, 組札）。子の「行ける終わりの集まり」が2通り以上ある節点だけを分かれ道とする。
    """
    ids = {}

    def tid(c):
        k = WIN if c == WIN else (c[1][0], c[1][1])
        if k not in ids:
            ids[k] = len(ids)
        return 1 << ids[k]

    reach = {}
    for v in reversed(sub_order):
        m = 0
        for _, c in nodes[v]:
            m |= reach[c] if c in nodes else tid(c)
        reach[v] = m
    dec = {}
    for v in sub_order:
        ch = nodes[v]
        if len(ch) < 2:
            dec[v] = 0
        else:
            sets = {reach[c] if c in nodes else tid(c) for _, c in ch}
            dec[v] = 1 if len(sets) >= 2 else 0
    return dec


def trap_intervals(g, order, label, stuck, dec_mode="term"):
    """罠と罠の深さを、打ち切りのあらゆる札付けの上の幅で求める（版3）。

    罠の置き場所: 解けるか打ち切りの節点のうち、違う局面へ進む手が2つ以上あるもの（版2 と同じ）。
    確かな罠: 置き場所が確かに解け、手の後の強制手の続きのどこかが確かに解けない。
    あり得る罠: 置き場所が解けないと決まっておらず、続きのどこかが解けると決まっていない。
    続きの長さ: dec_mode が "term" なら終わりの集まりで見た分かれ道、"succ" なら違う局面へ進む手が2つ以上の節点を数える。
    戻り値: dict（n_sure, n_poss, D_lo, D_hi, Dmax_lo, Dmax_hi, F_lo, F_hi, D_base, D_alt, n_base, n_alt, kinds）。
      D_lo = 確かな罠の Lmin の最大、D_hi = あり得る罠の Lmin の最大（本当の D はこの間）。
      D_base・D_alt は版2 と同じ「打ち切りを解けない側／解ける側に倒した」値（比べる用）。
    """
    nodes = g["nodes"]

    def lab(c):
        if c == WIN:
            return True
        if c in nodes:
            return label.get(c, False)
        return stuck.get(c[1], False)

    cand = []
    for v in order:
        lv = label.get(v, False)
        if lv is False or len(nodes[v]) < 2:
            continue
        for mv, c in nodes[v]:
            labs = []
            w = c
            while w in nodes and len(nodes[w]) == 1:
                labs.append(lab(w))
                w = nodes[w][0][1]
            labs.append(lab(w))
            if all(x is True for x in labs):
                continue
            has_false = any(x is False for x in labs)
            cand.append((v, mv, c, lv is True and has_false, lv is True, has_false))
    region = set()
    stack = [c for _, _, c, _, _, _ in cand if c in nodes]
    while stack:
        x = stack.pop()
        if x in region:
            continue
        region.add(x)
        for _, y in nodes[x]:
            if y in nodes and y not in region:
                stack.append(y)
    sub = [v for v in order if v in region]
    if dec_mode == "term":
        dec = _term_decisions(nodes, sub)
    else:
        dec = {v: (1 if len(nodes[v]) >= 2 else 0) for v in sub}
    lmin, lmax, fmax = {}, {}, {}
    for v in reversed(sub):
        mn = mx = None
        fm = sum(v[1])
        for _, c in nodes[v]:
            if c == WIN:
                a = b = 0
                fc = 52
            elif c in nodes:
                a, b, fc = lmin[c], lmax[c], fmax[c]
            else:
                a = b = 0
                fc = sum(c[1][1])
            mn = a if mn is None else min(mn, a)
            mx = b if mx is None else max(mx, b)
            fm = max(fm, fc)
        lmin[v] = dec[v] + mn
        lmax[v] = dec[v] + mx
        fmax[v] = fm

    def depth(v, c):
        if c in nodes:
            return lmin[c], lmax[c], fmax[c] - sum(v[1])
        return 0, 0, sum(c[1][1]) - sum(v[1])

    sure = [depth(v, c) + (mv[0],) for v, mv, c, s, _, _ in cand if s]
    poss = [depth(v, c) + (mv[0],) for v, mv, c, _, _, _ in cand]
    base = [depth(v, c) for v, mv, c, _, vt, _ in cand if vt]          # 打ち切りを解けない側に倒す
    alt = [depth(v, c) for v, mv, c, _, _, hf in cand if hf]            # 打ち切りを解ける側に倒す（置き場所の打ち切りは解ける）

    def mx(xs, i):
        return max(x[i] for x in xs) if xs else None

    return {
        "n_sure": len(sure), "n_poss": len(poss), "n_base": len(base), "n_alt": len(alt),
        "D_lo": mx(sure, 0), "D_hi": mx(poss, 0), "Dmax_lo": mx(sure, 1), "Dmax_hi": mx(poss, 1),
        "F_lo": mx(sure, 2), "F_hi": mx(poss, 2), "D_base": mx(base, 0), "D_alt": mx(alt, 0),
        "Dmin_lo": min((x[0] for x in sure), default=None),
        "kinds": sorted({x[3] for x in sure}),
        "decisions": sum(dec.values()), "region": len(sub),
    }


V3_PLAYS = ("all", "safe")
V3_DECS = ("succ", "term")


def features_v3(seed, oracle_limit=40_000, oracle_budget=2_000_000, graph_limit=400_000, deal_override=None, variants=True):
    """版3 の特徴を1つの配り方について最初から求める（乱数を使わない）。

    鍵の名前: T_<遊び方>_<変種>（遊び方 all = 素朴な手すべて、safe = 安全な組札送りを先に打つ）、
    <量>_<遊び方>_<変種>_<数え方>（数え方 succ = 版2 の分かれ道、term = 終わりの集まりで見た分かれ道）。
    variants=False なら、変種（noE・noPF・basic）の網の罠は求めない。
    """
    t0 = time.time()
    tab, stock = deal_override if deal_override is not None else deal(seed)
    f = {"seed": seed}
    graphs = {}
    for name, var in NAT_VARIANTS.items():
        g = natural_graph(tab, stock, var["empty"], var["pf"], graph_limit)
        graphs[name] = g
        f[f"graph_{name}"] = len(g["nodes"])
        f[f"graph_complete_{name}"] = g["complete"]
        for play in V3_PLAYS:
            gg = g if play == "all" else restrict_safe(g)
            T, p = natural_class(gg)
            f[f"T_{play}_{name}"] = T
            f[f"p_{play}_{name}"] = round(p, 6) if p is not None else None
    gf = graphs["full"]
    nd = gf["nodes"]
    decs = [len(ch) for ch in nd.values() if len(ch) >= 2]
    f["decision_nodes"] = len(decs)
    f["branch_dec"] = round(statistics.mean(decs), 3) if decs else None
    f["root_cands"] = len(nd[gf["root"]]) if gf["root"] in nd else 0
    f["graph_sec"] = round(time.time() - t0, 3)
    t1 = time.time()
    oracle = AliveOracle(oracle_limit, oracle_budget, cache_unknown=True)
    known = None
    if any(f[f"T_{play}_full"] in (2, 3) for play in V3_PLAYS):
        order, label, stuck, conf = label_graph(gf, oracle)
        known = (label, stuck)
        f["label_conflicts_full"] = conf
        f["unknown_full"] = sum(1 for x in label.values() if x is None) + sum(1 for x in stuck.values() if x is None)
        for play in V3_PLAYS:
            if f[f"T_{play}_full"] not in (2, 3):
                continue
            gg = gf if play == "all" else restrict_safe(gf)
            oo = order if play == "all" else _topo_order(gg)
            for dm in V3_DECS:
                for k, val in trap_intervals(gg, oo, label, stuck, dm).items():
                    f[f"{k}_{play}_full_{dm}"] = val
        f["oracle_queries"] = oracle.queries
        f["oracle_nodes"] = oracle.used
        f["oracle_unknown"] = oracle.unknown
    f["trap_sec"] = round(time.time() - t1, 3)
    if variants:
        t2 = time.time()
        oracle.budget = oracle.used + oracle_budget
        for name in ("noE", "noPF", "basic"):
            g = graphs[name]
            if not any(f[f"T_{play}_{name}"] in (2, 3) for play in V3_PLAYS):
                continue
            order, label, stuck, conf = label_graph(g, oracle, known)
            f[f"label_conflicts_{name}"] = conf
            for play in V3_PLAYS:
                if f[f"T_{play}_{name}"] not in (2, 3):
                    continue
                gg = g if play == "all" else restrict_safe(g)
                oo = order if play == "all" else _topo_order(gg)
                for k, val in trap_intervals(gg, oo, label, stuck, "term").items():
                    f[f"{k}_{play}_{name}_term"] = val
        f["variant_sec"] = round(time.time() - t2, 3)
    return f


def _v3_worker(args):
    seed, kw = args
    try:
        return features_v3(seed, **kw)
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


# 版3 の境目（終わりの集まりで見た分かれ道の数）。D がこれ以下 / これ以下 / これを超える で段 1 / 2 / 3
D_SHORT_V3 = 0   # 罠の後、選ぶ所を1つも過ぎずに詰む続け方がある
D_LONG_V3 = 1    # 罠の後、どう続けても選ぶ所を2つ以上過ぎるまで詰まない、を段 3 とする


def d_band3(d):
    return 1 if d <= D_SHORT_V3 else (2 if d <= D_LONG_V3 else 3)


def d_level(T, d):
    return {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, d_band3(d)))


def depth_stage(f, play, name, dm, lo="D_lo", hi="D_hi", n_lo="n_sure", n_hi="n_poss", bands=None):
    """罠の深さの段を、幅で決める。戻り値: ("ok", 段) / ("no-true-trap", None) / ("unresolved", None)。"""
    sfx = f"_{play}_{name}_{dm}"
    if f.get("n_poss" + sfx) is None:
        return "unresolved", None
    if not f.get(n_hi + sfx):
        return "no-true-trap", None
    if not f.get(n_lo + sfx):
        return "unresolved", None
    band = bands or d_band3
    a = band(f[lo + sfx])
    b = band(f[hi + sfx])
    if a != b:
        return "unresolved", None
    return "ok", a


def classify_v3(f, rule="none", dm="term", check_play=True, check_variants=False, robust=True, interval=True):
    """版3 の分類。f は features_v3 の出力に survey の status を足したもの。

    rule: 網を作る遊び方。"none" = 組札への自動送りなし（素朴な手すべて。採用形）、"safe" = 安全な札を自動で組札へ送るルール（比べる用）。
    check_play: rule="none" のとき、安全な組札送りを先に打つ遊び方でも D の段が同じことを求める（違えば提供範囲外）。
    check_variants: 段 3 の問題で、素朴な手の4つの変種すべてで D の段が同じことを求める。
    interval: False なら版2 と同じく打ち切りを両側に倒す（比べる用）。
    戻り値: (状態, レベルか理由)。
    """
    if f.get("status") != "win":
        return "invalid", "not-proven-solvable"
    play = "all" if rule == "none" else "safe"
    Ts = {k: f.get(f"T_{play}_{k}") for k in T_KEYS}
    if any(v is None for v in Ts.values()):
        return "unsupported", "natural-graph-too-large"
    T = Ts["full"]
    if robust and T in (1, 3) and not all(v == T for v in Ts.values()):
        return "out-of-range", "natural-depends-on-move-types"
    if T == 1:
        return "classified", 1

    def stage(pl, name):
        if interval:
            return depth_stage(f, pl, name, dm)
        sfx = f"_{pl}_{name}_{dm}"
        if f.get("n_poss" + sfx) is None:
            return "unresolved", None
        a = ("no-true-trap", None) if not f.get("n_base" + sfx) else ("ok", d_band3(f["D_base" + sfx]))
        b = ("no-true-trap", None) if not f.get("n_alt" + sfx) else ("ok", d_band3(f["D_alt" + sfx]))
        return a if a == b else ("unresolved", None)

    st, band = stage(play, "full")
    if st == "unresolved":
        return "unsupported", "oracle-unresolved"
    if st == "no-true-trap":
        return "out-of-range", "no-true-trap"
    others = []
    if rule == "none" and check_play and f.get("T_safe_full") == T:
        others.append(("safe", "full"))
    if check_variants and T == 3:
        others += [(play, k) for k in ("noE", "noPF", "basic")]
    for pl, name in others:
        s2, b2 = stage(pl, name)
        if s2 == "unresolved":
            return "unsupported", "oracle-unresolved"
        if s2 != "ok" or b2 != band:
            return "out-of-range", "trap-depth-depends-on-play"
    lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, band))
    if lv is None:
        return "out-of-range", "unlisted-combination"
    return "classified", lv


def load_v3(cache_dir, prefix="random", name="v3"):
    S = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    V = _load_jsonl(os.path.join(cache_dir, f"{name}_{prefix}.jsonl"))
    rows = []
    for seed, r in sorted(S.items()):
        f = {"seed": seed, "status": r["status"], "tier": r.get("tier"), "moves": r.get("moves")}
        if seed in V and "error" not in V[seed]:
            f.update(V[seed])
        rows.append(f)
    return rows


def _changed(rows, fa, fb):
    n = ch = far = 0
    for f in rows:
        a = fa(f)
        if a[0] != "classified" or a[1] < 2:
            continue
        b = fb(f)
        n += 1
        if a != b:
            ch += 1
            if b[0] == "classified" and abs(a[1] - b[1]) >= 2:
                far += 1
    return f"{ch}/{n}（2段以上 {far}）"


def _counts(rows, fn):
    c = {}
    for f in rows:
        k = fn(f)
        key = f"L{k[1]}" if k[0] == "classified" else f"{k[0]}:{k[1]}"
        c[key] = c.get(key, 0) + 1
    return dict(sorted(c.items()))


def _plan_v3(key_lo, key_hi, a, b, rule="none", n_lo="n_sure", n_hi="n_poss"):
    """案B〜D 用: 2つ目のつまみを替えた分類（段 T・幅の扱いは classify_v3 と同じ。D の代わりに key の幅で段を決める）。"""
    def band(x):
        return 1 if x <= a else (2 if x <= b else 3)

    def fn(f):
        base = classify_v3(f, rule=rule)
        if base[0] in ("invalid",) or base[1] in ("natural-graph-too-large", "natural-depends-on-move-types") or base == ("classified", 1):
            return base
        play = "all" if rule == "none" else "safe"
        T = f.get(f"T_{play}_full")
        st, bd = depth_stage(f, play, "full", "term", key_lo, key_hi, n_lo, n_hi, band)
        if st == "unresolved":
            return "unsupported", "oracle-unresolved"
        if st == "no-true-trap":
            return "out-of-range", "no-true-trap"
        lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, bd))
        return ("classified", lv) if lv else ("out-of-range", "unlisted-combination")
    return fn


def _plan_v3_tier(rule="none"):
    def fn(f):
        base = classify_v3(f, rule=rule)
        if base[0] == "invalid" or base[1] in ("natural-graph-too-large", "natural-depends-on-move-types") or base == ("classified", 1):
            return base
        play = "all" if rule == "none" else "safe"
        T = f.get(f"T_{play}_full")
        k = 1 if f.get("tier") == "E" else 2
        return "classified", {(2, 1): 2, (2, 2): 3, (3, 1): 4, (3, 2): 5}[(T, k)]
    return fn


def plans_v3(rule="none"):
    return {
        "案A 段T × 罠の深さD（終わりの集まりで見た分かれ道）": lambda f: classify_v3(f, rule=rule),
        "案B 段T × 最長の続き": _plan_v3("Dmax_lo", "Dmax_hi", 0, 2, rule),
        "案C 段T × 罠の後に組札が進む枚数": _plan_v3("F_lo", "F_hi", 3, 8, rule),
        "案D 段T × 罠の数": _plan_v3("n_sure", "n_poss", 2, 8, rule, "n_sure", "n_poss"),
        "案E 段T × 手筋": _plan_v3_tier(rule),
    }


def compare_v3(cache_dir, prefix="random", name="v3"):
    """版3 の比較。採用形は (a) 自動送りなし（安全な札をすぐ送る網でも D の段が同じことを求める）。(b) は比べる用。"""
    rows = load_v3(cache_dir, prefix, name)
    win = [f for f in rows if f["status"] == "win"]
    print(f"解けると確かめた配り方: {len(win)} / {len(rows)}")
    for play in V3_PLAYS:
        print(f"段 T（{play}）:", {str(k): sum(1 for f in win if f.get(f"T_{play}_full") == k) for k in (1, 2, 3, None)},
              "／ 4変種で段1", sum(1 for f in win if all(f.get(f"T_{play}_{k}") == 1 for k in T_KEYS)),
              "・段3", sum(1 for f in win if all(f.get(f"T_{play}_{k}") == 3 for k in T_KEYS)))
    print("段 T が all と safe で違う:", sum(1 for f in win if f.get("T_all_full") != f.get("T_safe_full")))
    print("読むモデルの食い違い（解けない節点の子が解ける）:", sum(f.get(f"label_conflicts_{k}", 0) for f in win for k in T_KEYS))
    A = lambda f: classify_v3(f, rule="none")  # noqa: E731
    B = lambda f: classify_v3(f, rule="safe")  # noqa: E731
    models = {
        "(a) 自動送りなし・安全な札をすぐ送る網でも D の段が同じ（採用）": A,
        "(b) 安全な札を自動で組札へ送る": B,
        "(a') 自動送りなし・確かめなし": lambda f: classify_v3(f, rule="none", check_play=False),
        "版2 の数え方（succ・両側に倒す・自動送りなし・境目 1/4）": _with_bands_v2,
    }
    for mname, fn in models.items():
        print(f"== {mname}")
        print("  件数:", _counts(win, fn))
    print("\n(a) で分類済みの L2〜L5 のうち変わる問題")
    print("  (b) にする:", _changed(win, A, B), "／ (b) を基準に (a):", _changed(win, B, A))
    print("  (a') を基準に、安全な札をすぐ送る網で求めた D に替える:",
          _changed(win, models["(a') 自動送りなし・確かめなし"], lambda f: _as_play(f, "safe") if f.get("T_safe_full") == f.get("T_all_full") else classify_v3(f, rule="none", check_play=False)))
    print("  数え方を succ（版2）に戻す:", _changed(win, A, lambda f: classify_v3(f, rule="none", dm="succ")))
    print("  打ち切りを両側に倒す（版2 の扱い）:", _changed(win, A, lambda f: classify_v3(f, rule="none", interval=False)),
          "件数", _counts(win, lambda f: classify_v3(f, rule="none", interval=False)))
    print("  段3 に D の4変種一致を求める:", _changed(win, A, lambda f: classify_v3(f, rule="none", check_variants=True)),
          "件数", _counts(win, lambda f: classify_v3(f, rule="none", check_variants=True)))
    for k in ("noE", "noPF", "basic"):
        print(f"  D を変種 {k} の網で求める（段 T は元のまま）:", _changed(win, A, lambda f, k=k: _as_name(f, "all", k)))
    for a_, b_ in ((0, 2), (0, 3), (1, 2), (1, 1)):
        print(f"  境目 {a_}/{b_}:", _changed(win, A, lambda f, a_=a_, b_=b_: _with_bands(f, a_, b_, "none")),
              "件数", _counts(win, lambda f, a_=a_, b_=b_: _with_bands(f, a_, b_, "none")))
    for rule in ("none", "safe"):
        play = "all" if rule == "none" else "safe"
        print(f"\n案の比較（rule={rule}）")
        P = plans_v3(rule)
        base = P[next(iter(P))]
        for pname, fn in P.items():
            lv = {}
            for f in win:
                lv.setdefault(fn(f), []).append(f)
            print(f"== {pname}")
            print("  件数:", _counts(win, fn))
            for feat in (f"D_lo_{play}_full_term", f"Dmax_lo_{play}_full_term", f"F_lo_{play}_full_term", f"n_sure_{play}_full_term", f"p_{play}_full", "moves", "branch_dec"):
                print(f"  {feat:24s}", " | ".join(str(_q([f.get(feat) for f in lv.get(("classified", L), [])])) for L in (1, 2, 3, 4, 5)))
            if fn is not base:
                print("  案A と比べて変わる:", _changed(win, base, fn))
    t = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win]
    tv = [f.get("variant_sec", 0) for f in win]
    print("\n1候補の時間（網と罠の分析、変種の罠を除く）: 中央値", round(statistics.median(t), 2), "・p95", round(sorted(t)[int(len(t) * 0.95)], 1),
          "・最大", round(max(t), 1), "・合計", round(sum(t)), "秒。変種の罠の分析: 合計", round(sum(tv)), "秒")
    for L in (1, 2, 3, 4, 5):
        tt = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win if A(f) == ("classified", L)]
        if tt:
            print(f"    L{L}: 中央値 {round(statistics.median(tt), 2)} 秒・最大 {round(max(tt), 1)} 秒")


def _with_bands_v2(f):
    global D_SHORT_V3, D_LONG_V3
    old = (D_SHORT_V3, D_LONG_V3)
    D_SHORT_V3, D_LONG_V3 = D_SHORT, D_LONG
    try:
        return classify_v3(f, rule="none", dm="succ", check_play=False, interval=False)
    finally:
        D_SHORT_V3, D_LONG_V3 = old


def _as_play(f, play):
    g = dict(f)
    for k in list(f):
        if k.endswith("_safe_full_term"):
            g[k.replace("_safe_", "_all_")] = f[k]
    return classify_v3(g, rule="none", check_play=False)


def _as_name(f, play, name):
    g = dict(f)
    for k in list(f):
        if k.endswith(f"_{play}_{name}_term"):
            g[k.replace(f"_{play}_{name}_", f"_{play}_full_")] = f[k]
    if f"n_poss_{play}_{name}_term" not in f:
        # 変種の網で段 1 になり罠が無い（または網が大きすぎる）
        for k in ("n_poss", "n_sure", "n_base", "n_alt"):
            g[f"{k}_{play}_full_term"] = 0 if f.get(f"T_{play}_{name}") == 1 else None
    return classify_v3(g, rule="safe" if play == "safe" else "none", check_play=False)


def _with_bands(f, a, b, rule="none"):
    global D_SHORT_V3, D_LONG_V3
    old = (D_SHORT_V3, D_LONG_V3)
    D_SHORT_V3, D_LONG_V3 = a, b
    try:
        return classify_v3(f, rule=rule)
    finally:
        D_SHORT_V3, D_LONG_V3 = old


def _move_id(mv, st):
    """手を札で表す（どちらを先に打っても同じかを調べる用。反例探しの a4lib.move_id と同じ）。"""
    tab, fnd, stock_rev, waste = st
    k = mv[0]
    if k == "TF":
        return ("TF", tab[mv[1]][-1])
    if k == "WF":
        return ("WF", waste[-1])
    if k == "TT":
        _, i, s_, j = mv
        return ("TT", tab[i][s_], tab[j][-1] if tab[j] else None)
    if k == "WT":
        j = mv[1]
        return ("WT", waste[-1], tab[j][-1] if tab[j] else None)
    if k == "PF":
        _, i, kk, j = mv
        return ("PF", tab[i][kk], tab[j][-1])
    raise ValueError(mv)


def _apply_id(mid, st):
    for mv in nat_candidates(st[0], st[1], st[3]):
        if _move_id(mv, st) == mid:
            return _nat_apply(mv, st)
    return None


def _commute(v, a, b):
    sa = _nat_apply(a, v)
    sb = _nat_apply(b, v)
    sab = _apply_id(_move_id(b, v), sa)
    sba = _apply_id(_move_id(a, v), sb)
    if sab is None or sba is None:
        return False
    return (tuple(sorted(sab[0])), sab[1], sab[2], sab[3]) == (tuple(sorted(sba[0])), sba[1], sba[2], sba[3])


def depth_variants_check(seed, rule="none", oracle_limit=40_000, oracle_budget=2_000_000):
    """確かめ用: 採った数え方（終わりの集まりで見た分かれ道）に、反例探しの向きの数え方を重ねたときの D の幅。

    term_full: 詰んだ局面を山札の位置まで含めて見分ける（反例探しの term と同じ）
    term_comm: 終わりの集まりが同じ節点に加えて、どの2手もどちらを先に打っても同じ局面になる節点も分かれ道にしない
    term_trap: 罠の置き場所も、終わりの集まりで見た分かれ道に限る
    """
    tab, stock = deal(seed)
    g = natural_graph(tab, stock)
    if rule == "safe":
        g = restrict_safe(g)
    T, _ = natural_class(g)
    out = {"seed": seed, "T": T}
    if T not in (2, 3):
        return out
    oracle = AliveOracle(oracle_limit, oracle_budget, cache_unknown=True)
    gfull = natural_graph(tab, stock)
    order0, label, stuck, _ = label_graph(gfull, oracle)
    order = _topo_order(g)
    nodes = g["nodes"]
    base = trap_intervals(g, order, label, stuck, "term")
    out["term"] = (base["n_sure"], base["n_poss"], base["D_lo"], base["D_hi"])

    def run(dec, trap_site=None):
        def lab(c):
            if c == WIN:
                return True
            return label.get(c, False) if c in nodes else stuck.get(c[1], False)
        lmin = {}
        for v in reversed(order):
            lmin[v] = dec(v) + min((lmin[c] if c in nodes else 0) for _, c in nodes[v])
        sure, poss = [], []
        for v in order:
            lv = label.get(v, False)
            if lv is False or len(nodes[v]) < 2 or (trap_site and not trap_site(v)):
                continue
            for mv, c in nodes[v]:
                labs = []
                w = c
                while w in nodes and len(nodes[w]) == 1:
                    labs.append(lab(w))
                    w = nodes[w][0][1]
                labs.append(lab(w))
                if all(x is True for x in labs):
                    continue
                d = lmin[c] if c in nodes else 0
                poss.append(d)
                if lv is True and any(x is False for x in labs):
                    sure.append(d)
        return (len(sure), len(poss), max(sure) if sure else None, max(poss) if poss else None)

    tdec = _term_decisions(nodes, order)
    # 詰んだ局面を山札の位置まで含めて見分ける
    ids = {}
    reach = {}

    def tid(c):
        k = WIN if c == WIN else c[1]
        if k not in ids:
            ids[k] = len(ids)
        return 1 << ids[k]
    for v in reversed(order):
        m = 0
        for _, c in nodes[v]:
            m |= reach[c] if c in nodes else tid(c)
        reach[v] = m
    tfull = {v: (1 if len(nodes[v]) >= 2 and len({reach[c] if c in nodes else tid(c) for _, c in nodes[v]}) >= 2 else 0) for v in order}
    cm = {}

    def comm_dec(v):
        if v not in cm:
            ch = nodes[v]
            r = 0
            if len(ch) >= 2:
                for i in range(len(ch)):
                    for j in range(i + 1, len(ch)):
                        if not _commute(v, ch[i][0], ch[j][0]):
                            r = 1
                            break
                    if r:
                        break
            cm[v] = r
        return cm[v]

    out["term_full"] = run(lambda v: tfull[v])
    out["term_comm"] = run(lambda v: tdec[v] and comm_dec(v))
    out["term_trap"] = run(lambda v: tdec[v], trap_site=lambda v: tdec[v] == 1)
    return out


def _dvc_worker(args):
    seed, kw = args
    try:
        return depth_variants_check(seed, **kw)
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def depth_variants_summary(cache_dir, out_path, prefix="random", procs=4, rule="none"):
    rows = load_v3(cache_dir, prefix)
    lv = {}
    for f in rows:
        st, v = classify_v3(f, rule=rule)
        if st == "classified" and v >= 2:
            lv[f["seed"]] = v
    run_jobs(_dvc_worker, sorted(lv), out_path, procs, rule=rule)
    res = _load_jsonl(out_path)

    def cls(T, r):
        ns, np_, lo, hi = r
        if not np_:
            return ("out-of-range", "no-true-trap")
        if not ns or d_band(lo) != d_band(hi):
            return ("unsupported", "oracle-unresolved")
        lvl = d_level(T, lo)
        return ("classified", lvl) if lvl else ("out-of-range", "unlisted-combination")

    for name in ("term_full", "term_comm", "term_trap"):
        n = ch = 0
        for s_, L in lv.items():
            r = res.get(s_)
            if not r or "error" in r or name not in r:
                continue
            n += 1
            if cls(r["T"], r[name]) != ("classified", L):
                ch += 1
        print(f"{name}: 分類が変わる {ch}/{n}")


def d1_check_v3(cache_dir, out_path, prefix="random", runs=10, budget=100, procs=4):
    """D1（版3）: 案ごと・ルールごとに、定石つき＋待ったの押し切り率をレベル別に出す（分類には使わない）。"""
    rows = load_v3(cache_dir, prefix)
    win = [f for f in rows if f["status"] == "win"]
    sets = {}
    for rule in ("safe", "none"):
        for pname, fn in plans_v3(rule).items():
            sets[f"{rule} {pname}"] = {f["seed"]: fn(f) for f in win}
    seeds = sorted({s_ for m in sets.values() for s_, v in m.items() if v[0] == "classified"})
    run_jobs(_d1_worker, seeds, out_path, procs, runs=runs, budget=budget)
    res = _load_jsonl(out_path)
    for name, m in sets.items():
        print(f"== {name}")
        for L in (1, 2, 3, 4, 5):
            sub = [res[s_] for s_, v in m.items() if v == ("classified", L) and s_ in res]
            r1 = [r["push"] for r in sub]
            r2 = [r["push_full"] for r in sub]
            print(f"  L{L} 件数 {len(sub)}: 押し切り率 10/50/90 {_q(r1)}・0.5以上 {sum(1 for r in r1 if r >= 0.5)}"
                  f"／ すべての手 {_q(r2)}・0.5以上 {sum(1 for r in r2 if r >= 0.5)}")


def _policy3_worker(args):
    seed, kw = args
    tab, stock = deal(seed)
    g = natural_graph(tab, stock)
    if kw.get("rule") == "safe":
        g = restrict_safe(g)
    return {"seed": seed, **{p: natural_class_policy(g, p) for p in POLICIES}}


def policy_check_v3(cache_dir, out_path, prefix="random", procs=4, rule="none"):
    rows = load_v3(cache_dir, prefix)
    lv = {}
    for f in rows:
        st, v = classify_v3(f, rule=rule)
        if st == "classified" and v in (2, 3):
            lv[f["seed"]] = v
    run_jobs(_policy3_worker, sorted(lv), out_path, procs, rule=rule)
    res = _load_jsonl(out_path)
    for L in (2, 3):
        sub = [res[s_] for s_ in lv if lv[s_] == L and s_ in res]
        print(f"L{L} 件数 {len(sub)}:", {p: {str(t): sum(1 for r in sub if r[p] == t) for t in (1, 2, 3)} for p in POLICIES})


def movevar_check_v3(cache_dir, out_path, prefix="random", procs=4, limit=200_000, rule="none"):
    """§8.2 の手を足す確かめを、版3 の L1・L4・L5 に当てる（網は自動送りなしの素朴な手。足す手も自動送りなし）。"""
    rows = load_v3(cache_dir, prefix)
    lv = {}
    T = {}
    for f in rows:
        st, v = classify_v3(f, rule=rule)
        if st == "classified" and v in (1, 4, 5):
            lv[f["seed"]] = v
            T[str(f["seed"])] = f["T_all_full"]
    run_jobs(_movevar_worker, sorted(lv), out_path, procs, T=T, limit=limit)
    res = _load_jsonl(out_path)
    for L in (1, 4, 5):
        sub = [res[s_] for s_ in lv if lv[s_] == L and s_ in res]
        print(f"L{L} 件数 {len(sub)}（自動送りなしの段 {dict((str(t), sum(1 for r in sub if r['T_full'] == t)) for t in (1, 2, 3))}）:",
              {k: dict(sorted(((str(x), sum(1 for r in sub if r.get(k) == x)) for x in {r.get(k) for r in sub}))) for k in MOVEVAR})


def restrict_policy(g, policy):
    """網を、優先順位（POLICIES）に合う手だけの道筋に絞る（natural_class_policy と同じ絞り方）。"""
    nodes = g["nodes"]
    prio = POLICIES[policy]
    out = {}
    for v, ch in nodes.items():
        keep = ch
        for cls in prio:
            sel = [(mv, c) for mv, c in ch if _move_class(mv, v) == cls]
            if sel:
                keep = sel
                break
        out[v] = keep
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


def _policyD_worker(args):
    """確かめ用: 遊び方を絞った網（安全な組札送りを先に・組札優先・分類の順）で、段と D の幅を求める。読むモデルの札は素朴な手すべての網で付ける。"""
    seed, kw = args
    try:
        tab, stock = deal(seed)
        g = natural_graph(tab, stock)
        oracle = AliveOracle(40_000, 2_000_000, cache_unknown=True)
        order, label, stuck, _ = label_graph(g, oracle)
        row = {"seed": seed}
        for name, gg in (("all", g), ("safe", restrict_safe(g)), ("fnd_first", restrict_policy(g, "fnd_first")),
                         ("class_prio", restrict_policy(g, "class_prio"))):
            T, _ = natural_class(gg)
            r = {"T": T}
            if T in (2, 3):
                iv = trap_intervals(gg, _topo_order(gg), label, stuck, "term")
                r.update({k: iv[k] for k in ("n_sure", "n_poss", "D_lo", "D_hi")})
            row[name] = r
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def policyD_check(cache_dir, out_path, prefix="random", procs=4, rule="none"):
    """遊び方を絞ったとき D の段が変わるか（rule の分類で L2〜L5 の問題）。"""
    rows = load_v3(cache_dir, prefix)
    lv = {}
    for f in rows:
        st, v = classify_v3(f, rule=rule)
        if st == "classified" and v >= 2:
            lv[f["seed"]] = v
    run_jobs(_policyD_worker, sorted(lv), out_path, procs)
    res = _load_jsonl(out_path)

    def band_of(r):
        if r.get("T") not in (2, 3):
            return ("T", r.get("T"))
        if not r.get("n_poss"):
            return ("no-trap",)
        if not r.get("n_sure") or d_band3(r["D_lo"]) != d_band3(r["D_hi"]):
            return ("unresolved",)
        return ("band", d_band3(r["D_lo"]))

    for name in ("safe", "fnd_first", "class_prio"):
        same_T = changed = t_changed = unres = 0
        for s_ in lv:
            r = res.get(s_)
            if not r or "error" in r:
                continue
            a, b = r["all"], r[name]
            if b["T"] != a["T"]:
                t_changed += 1
                continue
            same_T += 1
            x, y = band_of(a), band_of(b)
            if y == ("unresolved",) or x == ("unresolved",):
                unres += 1
            elif x != y:
                changed += 1
        print(f"{name}: 段が変わる {t_changed}／段が同じ {same_T} のうち D の段が変わる {changed}・決まらない {unres}")


def write_expected_v3(seeds, out_path):
    """移植の期待値（版3）。乱数を使わない量だけを書く。分類は2つのルール（安全な札の自動送りあり / なし）の両方。"""
    items = []
    for seed in seeds:
        t0 = time.time()
        tab, stock = deal(seed)
        sv = survey_one(seed)
        f = {"status": sv["status"], "tier": sv.get("tier")}
        if sv["status"] == "win":
            f.update(features_v3(seed, variants=False))
        item = {
            "seed": seed,
            "deal": deal_text(tab, stock),
            "deal_cards": {"columns": [list(c) for c in tab], "stock": list(stock)},
            "solver": {"limits": SPACE_LIMIT, "spaces": sv["spaces"], "status": sv["status"]},
            "assessment": {rule: dict(zip(("state", "value"), classify_v3(f, rule=rule))) for rule in ("safe", "none")},
        }
        if sv["status"] == "win":
            item["natural"] = {k: f.get(k) for k in sorted(f) if k.startswith(("T_", "p_", "graph_")) and not k.endswith("_sec")}
            item["natural"].update({k: f.get(k) for k in ("decision_nodes", "branch_dec", "root_cands")})
            item["traps"] = {k: f.get(k) for k in sorted(f) if k.split("_")[0] in ("n", "D", "Dmax", "F", "Dmin", "kinds", "decisions", "region")
                             and k.endswith(("_full_term", "_full_succ"))}
            item["traps"].update({k: f.get(k) for k in ("unknown_full", "label_conflicts_full", "oracle_queries", "oracle_nodes", "oracle_unknown")})
            item["traps"]["oracle_limit"] = 40_000
            item["traps"]["oracle_budget"] = 2_000_000
        item["sec"] = round(time.time() - t0, 2)
        items.append(item)
        print(seed, item["assessment"], item["sec"], flush=True)
    doc = {
        "about": "ソリティア難易度の調査コード solitaire_difficulty.py の、版3（段 T × 罠の深さ D。分かれ道は終わりの集まりで数え、打ち切りは幅で扱う）の seed ごとの結果。検査 F2 で移植したコードと突き合わせる。",
        "rules": "52枚・7列（1〜7枚）、列は全部表、山札24枚は1枚ずつ何周でも。deal(seed) は Python の random.Random(seed).shuffle で並べ、列 i に i+1 枚、残りが山札（stock[0] が次にめくる札）。札の番号は suit*13+rank-1（S,H,D,C）",
        "thresholds": {"D_SHORT": D_SHORT_V3, "D_LONG": D_LONG_V3},
        "notes": [
            "分類は classify_v3。assessment.safe は安全な札を自動で組札へ送るルール（網は restrict_safe）、assessment.none は自動送りなし（安全な札を先に送る遊び方でも D の段が同じことを求める）",
            "段 1 と段 3 は、natural.T_<遊び方>_full・_noE・_noPF・_basic がすべて同じ段のときだけ使う",
            "traps の鍵は <量>_<遊び方>_full_<数え方>。数え方 term が分類に使う数え方（終わりの集まりで見た分かれ道）、succ は版2 の数え方（比べる用）",
            "D_lo と D_hi は打ち切りのあらゆる札付けの上の幅。n_sure が確かな罠、n_poss があり得る罠の数。D_base・D_alt は版2 と同じ両側に倒した値（比べる用）",
            "乱数を使う量は無い。移植では deal_cards から同じ盤面を作って比べる（deal の乱数は Python の random に依る）",
            "traps.oracle_queries・oracle_nodes・oracle_unknown は読むモデルの問い合わせの量。手の並び順・枝刈り・覚えた局面の使い方が同じなら一致する。採否（打ち切りで評価不能になるか）に関わる",
        ],
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def symmetry_check_v3(seeds):
    """確かめ用: マークの入れ替えと列の並べ替えで、版3 の特徴（時間と問い合わせの量を除く）が変わらないか。"""
    skip = ("_sec", "oracle_")
    diff = []
    for seed in seeds:
        tab, stock = deal(seed)
        a = features_v3(seed, variants=False)
        b = features_v3(seed, deal_override=suit_swap(tab, stock), variants=False)
        c = features_v3(seed, deal_override=(tuple(reversed(tab)), stock), variants=False)
        for k in a:
            if k == "seed" or any(x in k for x in skip) or k.startswith("kinds"):
                continue
            if not (a.get(k) == b.get(k) == c.get(k)):
                diff.append((seed, k, a.get(k), b.get(k), c.get(k)))
    return diff


# ===========================================================================
# 版4: 版3 に当てた3回目の反例探し（A4）を受けた直し
#
# 版1〜3 の D は、どれも「何を1つと数えるか」（1手の単位・分かれ道・終わりの見分け方）に自由度が残り、反例になった。
# 版4 は数える単位を持たない量で、段の中を分ける。
#   - 致命の手: 素朴な手の網の辺 x → y で、x は読むモデルで解け、y は解けないもの（解ける局面から解けない局面へ移る手）。
#     局面の単位で決めるので、手の区切り方・分かれ道の数え方・終わりの見分け方に依らない。
#   - 罠の後の進み G: 致命の手 x → y の後、素朴な解き方でどう続けても、詰むまでに組札へ置かれる札の枚数の最小
#     （組札の枚数(詰み) − 組札の枚数(x)）。組札の枚数は札の枚数そのもので、数え方の自由度が無い。
#   - 問題の値: すべての致命の手の G の最大（「踏んでもどう続けても組札が G 枚以上進んでから詰む致命の手がある」）。
#   - 打ち切りは版3 と同じく、確かな致命の手・あり得る致命の手の上の幅で扱う。
# 分類に使う関数: features_v4 → classify_v4（採用形は rule="none"）。
# ===========================================================================


def _min_max_fnd(g, order):
    """各節点から、素朴な解き方で行ける終わりの組札の枚数の最小・最大（勝ちは52）。"""
    nodes = g["nodes"]
    mn, mx = {}, {}
    for v in reversed(order):
        a = b = None
        for _, c in nodes[v]:
            if c == WIN:
                x = y = 52
            elif c in nodes:
                x, y = mn[c], mx[c]
            else:
                x = y = sum(c[1][1])
            a = x if a is None else min(a, x)
            b = y if b is None else max(b, y)
        mn[v], mx[v] = a, b
    return mn, mx


def fatal_depths(g, order, label, stuck, mode="all", fnd_mm=None, base="x"):
    """致命の手と、罠の後の進み G の幅（版4）。

    mode: "all" = 解ける局面から解けない局面へ移る素朴な手すべて（採用形）。
          "alt" = 同じ局面に、打っても解けるままの別の素朴な手があるものだけ（比べる用）。
    確かな致命の手: x が確かに解け、y が確かに解けない。あり得る致命の手: x が解けないと決まっておらず、y が解けると決まっていない。
    本当の G は［確かな致命の手の G の最大, あり得る致命の手の G の最大］に入る（導出）。
    戻り値: dict（n_sure, n_poss, G_lo, G_hi, Gx_lo, Gx_hi, Gmin_lo, n_noreturn）。
      Gx は続け方の最大で数えた進み（比べる用）、Gmin_lo は確かな致命の手の G の最小（比べる用）。
      n_noreturn は、確かな致命の手のうち、x の素朴な手がどれも解けなくなるもの（置かない判断が要る所）の数。
    base: "x" = 致命の手の前の局面 x の組札の枚数から数える（採用形）。"y" = 致命の手の後の局面 y から数える（比べる用）。
    """
    nodes = g["nodes"]
    mn, mx = fnd_mm if fnd_mm else _min_max_fnd(g, order)

    def lab(c):
        if c == WIN:
            return True
        if c in nodes:
            return label.get(c, False)
        return stuck.get(c[1], False)

    def ends(c):
        if c == WIN:
            return 52, 52
        if c in nodes:
            return mn[c], mx[c]
        s_ = sum(c[1][1])
        return s_, s_

    sure, poss = [], []
    noreturn = 0
    for v in order:
        lv = label.get(v, False)
        if lv is False:
            continue
        ch = nodes[v]
        labs = [lab(c) for _, c in ch]
        f0 = sum(v[1])
        for i, (mv, c) in enumerate(ch):
            lc = labs[i]
            if lc is True:
                continue
            others = [labs[j] for j in range(len(ch)) if j != i]
            if mode == "alt":
                alt_sure = any(o is True for o in others)
                alt_poss = any(o is not False for o in others)
            else:
                alt_sure = alt_poss = True
            a, b = ends(c)
            f1 = f0 if base == "x" else (sum(c[1]) if c in nodes else sum(c[1][1]))
            item = (a - f1, b - f1)
            if lv is True and lc is False and alt_sure:
                sure.append(item)
                if all(o is False for o in others):
                    noreturn += 1
            if alt_poss:
                poss.append(item)

    def mxi(xs, i):
        return max(x[i] for x in xs) if xs else None

    return {"n_sure": len(sure), "n_poss": len(poss), "G_lo": mxi(sure, 0), "G_hi": mxi(poss, 0),
            "Gx_lo": mxi(sure, 1), "Gx_hi": mxi(poss, 1), "Gmin_lo": min((x[0] for x in sure), default=None),
            "n_noreturn": noreturn}


def restrict_eager(g):
    """組札へ送れる札（TF・WF）があれば必ず送る遊び方の網（安全かどうかを問わない。比べる用）。"""
    nodes = g["nodes"]
    out = {}
    for v, ch in nodes.items():
        keep = [(mv, c) for mv, c in ch if mv[0] in ("TF", "WF")]
        out[v] = keep[:1] if keep else ch
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


V4_PLAYS = ("all", "safe")
V4_MODES = ("all", "alt")


def features_v4(seed, oracle_limit=40_000, oracle_budget=2_000_000, graph_limit=400_000, deal_override=None, variants=False,
                bc=False, verify=False, verify_sec=60, grouping=False, v7=False):
    """版4 の特徴を1つの配り方について最初から求める（乱数を使わない）。

    鍵: T_<遊び方>_<変種>、<量>_<遊び方>_<数え方>（量は n_sure・n_poss・G_lo・G_hi ほか、数え方は all / alt）。
    比べる用に、版3 の D（v3_D_lo_all ほか）、優先順位で絞った網（_pol_<名前>）、素朴な解き方で勝てるかを「解ける」とした G（_natlab）、
    素朴な解き方の詰みまでの組札の枚数（R_min・R_max: 根からのすべての道筋の上の最小・最大）も求める。
    grouping=True（版6）なら、1手の区切り方の両端（規則の1手 / 選びとその後の強制手）の G の幅も求める（鍵 <量>_<遊び方>_grp）。
    v7=True（版7）なら、本当の選ぶ所（手の行き先が違う所）で区切った G と、比べる用の量も求める（鍵 <量>_<遊び方>_v7。features_v7 を参照）。
    """
    t0 = time.time()
    tab, stock = deal_override if deal_override is not None else deal(seed)
    f = {"seed": seed}
    graphs = {}
    for name, var in NAT_VARIANTS.items():
        g = natural_graph(tab, stock, var["empty"], var["pf"], graph_limit)
        graphs[name] = g
        f[f"graph_{name}"] = len(g["nodes"])
        f[f"graph_complete_{name}"] = g["complete"]
        for play in V4_PLAYS:
            gg = g if play == "all" else restrict_safe(g)
            T, p = natural_class(gg)
            f[f"T_{play}_{name}"] = T
            f[f"p_{play}_{name}"] = round(p, 6) if p is not None else None
    gf = graphs["full"]
    nd = gf["nodes"]
    decs = [len(ch) for ch in nd.values() if len(ch) >= 2]
    f["decision_nodes"] = len(decs)
    f["branch_dec"] = round(statistics.mean(decs), 3) if decs else None
    f["root_cands"] = len(nd[gf["root"]]) if gf["root"] in nd else 0
    if gf["complete"] and gf["root"] in nd:
        order0 = _topo_order(gf)
        mn, mx = _min_max_fnd(gf, order0)
        # 詰みまでの組札の枚数（勝ちを除く）: 根から行ける詰みの組札の枚数の最小・最大
        stuck_f = [sum(c[1][1]) for v in order0 for _, c in nd[v] if c != WIN and c not in nd]
        f["R_min"] = min(stuck_f) if stuck_f else None
        f["R_max"] = max(stuck_f) if stuck_f else None
    f["graph_sec"] = round(time.time() - t0, 3)
    t1 = time.time()
    oracle = AliveOracle(oracle_limit, oracle_budget, cache_unknown=True, bc=bc)
    if any(f[f"T_{play}_full"] in (2, 3) for play in V4_PLAYS):
        order, label, stuck, conf = label_graph(gf, oracle)
        f["label_conflicts_full"] = conf
        f["unknown_full"] = sum(1 for x in label.values() if x is None) + sum(1 for x in stuck.values() if x is None)
        for play in V4_PLAYS:
            if f[f"T_{play}_full"] not in (2, 3):
                continue
            gg = gf if play == "all" else restrict_safe(gf)
            oo = order if play == "all" else _topo_order(gg)
            mm = _min_max_fnd(gg, oo)
            for mode in V4_MODES:
                for k, val in fatal_depths(gg, oo, label, stuck, mode, mm).items():
                    f[f"{k}_{play}_{mode}"] = val
            if grouping:
                for k, val in fatal_depths_grouping(gg, oo, label, stuck, mm).items():
                    f[f"{k}_{play}_grp"] = val
            iv = trap_intervals(gg, oo, label, stuck, "term")
            for k in ("n_sure", "n_poss", "D_lo", "D_hi"):
                f[f"v3_{k}_{play}"] = iv[k]
        # 比べる用: 優先順位で絞った網（組札優先・分類の順・送れる札は必ず送る）
        for pol, gg in (("fnd_first", restrict_policy(gf, "fnd_first")), ("class_prio", restrict_policy(gf, "class_prio")),
                        ("eager", restrict_eager(gf))):
            T, _ = natural_class(gg)
            f[f"T_pol_{pol}"] = T
            if T in (2, 3):
                oo = _topo_order(gg)
                for k, val in fatal_depths(gg, oo, label, stuck, "all").items():
                    f[f"{k}_pol_{pol}"] = val
        # 比べる用: 「解ける」を、素朴な解き方で勝ちへ行けるか（網の上で厳密）に替える（段 2 だけ意味がある）
        if f["T_all_full"] == 2:
            anywin = {}
            for v in reversed(order):
                anywin[v] = any(c == WIN or (c in nd and anywin[c]) for _, c in nd[v])
            nl = {v: anywin[v] for v in order}
            ns = {k: False for k in stuck}
            for _, ch in nd.items():
                for _, c in ch:
                    if c != WIN and c not in nd:
                        ns[c[1]] = False
            for k, val in fatal_depths(gf, order, nl, ns, "all").items():
                f[f"{k}_natlab"] = val
        if v7:
            f.update(v7_features_from_labels(gf, order, label, stuck, f))
        f["oracle_queries"] = oracle.queries
        f["oracle_nodes"] = oracle.used
        f["oracle_unknown"] = oracle.unknown
        if variants:
            oracle.budget = oracle.used + oracle_budget
            for name in ("noE", "noPF", "basic"):
                g = graphs[name]
                if f[f"T_all_{name}"] not in (2, 3):
                    continue
                o2, l2, s2, c2 = label_graph(g, oracle, (label, stuck))
                f[f"label_conflicts_{name}"] = c2
                for k, val in fatal_depths(g, o2, l2, s2, "all").items():
                    f[f"{k}_var_{name}"] = val
    f["trap_sec"] = round(time.time() - t1, 3)
    if verify and f.get("unknown_full") is not None:
        f.update(verify_fatal_dead(gf, order, label, stuck, budget_sec=verify_sec))
    return f


def features_v5(seed, **kw):
    """版5 の特徴: 版4 と同じ定義（段 T × 罠の後の進み G）を、規則の手をすべて使う読むモデル（bc=True）で求める。"""
    kw.setdefault("bc", True)
    return features_v4(seed, **kw)


# ---------------------------------------------------------------------------
# 版6: 1手の区切り方の両端で G の段がそろうことを求める
#
# 版5 の G は、致命の手の直前の局面 x（網の節点。置ける手が1つだけの局面も含む）から数えた。
# 1手を「選ぶ所での選びと、その後に続く強制手（置ける手が1つだけの局面の手）」とまとめると、数え始めは x より前の選ぶ所 x0 に動く。
# 素朴な手は組札を減らさないので、数え始めを x と x0 の間のどこに置いても G は G(x) 以上 G(x0) 以下になる（区切り方に対して単調）。
# 版6 は、この両端（規則の1手で区切った G_f と、選びと強制手をまとめた G_b）の G の段が同じ問題だけを分類する。


# 版6 の境目。G_SHORT は版4・版5 と同じ。G_LONG は版6 の分類の分布で置き直した（L2〜L5 がおおよそ揃う所。資料 §4.2）
G_LONG_V6 = 6   # 罠の後、どう続けても組札が7枚以上進んでから詰む、を段 3 とする


def g_band_v6(x):
    return 1 if x <= G_SHORT else (2 if x <= G_LONG_V6 else 3)


def decision_chains(g, order):
    """版6: 選ぶ所ごとに、選んだ手とその後の強制手の鎖をたどる。

    選ぶ所は、違う局面へ進む素朴な手が2つ以上ある節点と、根（置ける手が1つでも）。強制手は、選ぶ所でない節点のただ1つの手。
    戻り値: [(d, dest, last)]。d は選ぶ所、dest は鎖の行き先（次の選ぶ所・勝ち・詰み）、last は dest の直前の局面（鎖が無ければ d）。
    """
    nodes = g["nodes"]
    root = g["root"]
    out = []
    for d in order:
        ch = nodes[d]
        if len(ch) < 2 and d != root:
            continue
        seen = set()
        for _, c in ch:
            last, cur = d, c
            while cur in nodes and len(nodes[cur]) == 1:
                last, cur = cur, nodes[cur][0][1]
            if (cur, last) in seen:
                continue
            seen.add((cur, last))
            out.append((d, cur, last))
    return out


def fatal_depths_grouping(g, order, label, stuck, fnd_mm=None):
    """版6: 1手の区切り方の両端での G の幅。

    G_lo_f・G_hi_f: 規則の1手で区切った G（版5 の G と同じ数え方）。下端は、確かな致命の手の G の最大と、
      確かな致命の選び（下の G_b）の鎖の中にある本当の致命の手の G の下限（dest の詰みの最小 − last の組札）の大きい方。
      鎖の両端が確かに解ける・解けないなら、鎖の中のどこかに本当の致命の手があり、その G は鎖の最後の局面から数えた値以上（導出）。
    G_lo_b・G_hi_b: 選びとその後の強制手を1手にまとめた G（選ぶ所 d が解け、鎖の行き先が解けない選びを致命の選びとし、d の組札から数える）。
    n_forced_sure: 確かな致命の手のうち、置ける手が1つだけの局面の手の数（記録だけ）。
    """
    nodes = g["nodes"]
    mn, mx = fnd_mm if fnd_mm else _min_max_fnd(g, order)
    fine = fatal_depths(g, order, label, stuck, "all", (mn, mx))

    def lab(c):
        if c == WIN:
            return True
        if c in nodes:
            return label.get(c, False)
        return stuck.get(c[1], False)

    def low_end(c):
        if c == WIN:
            return 52
        if c in nodes:
            return mn[c]
        return sum(c[1][1])

    sure, poss, chain_lb = [], [], []
    for d, dest, last in decision_chains(g, order):
        lv = label.get(d, False)
        if lv is False:
            continue
        lc = lab(dest)
        if lc is True:
            continue
        m = low_end(dest)
        poss.append(m - sum(d[1]))
        if lv is True and lc is False:
            sure.append(m - sum(d[1]))
            chain_lb.append(m - sum(last[1]))
    forced = 0
    for v in order:
        if label.get(v, False) is True and len(nodes[v]) == 1 and lab(nodes[v][0][1]) is False:
            forced += 1
    lo_f = max([x for x in [fine["G_lo"]] + chain_lb if x is not None], default=None)
    return {"n_sure_f": fine["n_sure"], "n_poss_f": fine["n_poss"], "G_lo_f": lo_f, "G_hi_f": fine["G_hi"],
            "G_chainlb": max(chain_lb, default=None),
            "n_sure_b": len(sure), "n_poss_b": len(poss), "G_lo_b": max(sure, default=None), "G_hi_b": max(poss, default=None),
            "n_forced_sure": forced}


def features_v6(seed, **kw):
    """版6 の特徴: 版5 の特徴に、1手の区切り方の両端の G の幅（<量>_<遊び方>_grp）を足したもの。"""
    kw.setdefault("bc", True)
    kw["grouping"] = True
    return features_v4(seed, **kw)


def g_stage_v6(f, play, band=None, ends="env"):
    """版6: 区切り方の両端と打ち切りの幅で G の段を決める。

    ends="env"（採用形）: 本当の G は、どの区切り方でも［G_lo_f, G_hi_b］に入る（導出）。
      G_hi_f の段 < G_lo_b の段なら、区切り方で段が変わると決まる（"grouping"）。G_lo_f と G_hi_b の段が同じなら "ok"。どちらでもなければ "unresolved"。
    ends="fine"・"branch"（比べる用）: 片方の端だけで決める。
    戻り値: ("ok", 段) / ("grouping", None) / ("no-true-trap", None) / ("unresolved", None)。
    """
    sfx = f"_{play}_grp"
    n_poss = f.get("n_poss_f" + sfx)
    if n_poss is None:
        return "unresolved", None
    if not n_poss:
        return "no-true-trap", None
    bd = band or g_band_v6
    lo_f, hi_f, lo_b, hi_b = (f.get(k + sfx) for k in ("G_lo_f", "G_hi_f", "G_lo_b", "G_hi_b"))
    if ends == "fine":
        lo, hi = lo_f, hi_f
    elif ends == "branch":
        lo, hi = lo_b, hi_b
    else:
        if lo_b is not None and hi_f is not None and bd(hi_f) < bd(lo_b):
            return "grouping", None
        lo, hi = lo_f, hi_b
    if lo is None or hi is None or bd(lo) != bd(hi):
        return "unresolved", None
    return "ok", bd(lo)


def classify_v6(f, rule="none", check_play=True, band=None, ends="env", robust=True):
    """版6 の分類。段 T の扱いは classify_v4 と同じ。G の段は g_stage_v6（区切り方の両端と打ち切りの幅。境目は G_SHORT・G_LONG_V6）で決める。"""
    if f.get("status") != "win":
        return "invalid", "not-proven-solvable"
    play = "all" if rule == "none" else "safe"
    Ts = {k: f.get(f"T_{play}_{k}") for k in T_KEYS}
    if any(v is None for v in Ts.values()):
        return "unsupported", "natural-graph-too-large"
    T = Ts["full"]
    if robust and T in (1, 3) and not all(v == T for v in Ts.values()):
        return "out-of-range", "natural-depends-on-move-types"
    if T == 1:
        return "classified", 1
    st, bd = g_stage_v6(f, play, band, ends)
    if st == "unresolved":
        return "unsupported", "oracle-unresolved"
    if st == "no-true-trap":
        return "out-of-range", "no-true-trap"
    if st == "grouping":
        return "out-of-range", "trap-depth-depends-on-grouping"
    if rule == "none" and check_play and f.get("T_safe_full") == T:
        s2, b2 = g_stage_v6(f, "safe", band, ends)
        if s2 == "unresolved":
            return "unsupported", "oracle-unresolved"
        if s2 == "grouping":
            return "out-of-range", "trap-depth-depends-on-grouping"
        if s2 != "ok" or b2 != bd:
            return "out-of-range", "trap-depth-depends-on-play"
    lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, bd))
    if lv is None:
        return "out-of-range", "unlisted-combination"
    return "classified", lv


# ---------------------------------------------------------------------------
# 版7: 選ぶ所を「手の行き先が違う所」（本当の選ぶ所）に限る
#
# 版6 の選ぶ所（違う局面へ進む素朴な手が2つ以上ある節点）には、どの手を選んでも、ほかの選びを経ずに同じ局面へ合流する
# 見かけの選ぶ所（組札へ送る順番の入れ替え、寄り道）が多い。版7 は、手ごとの行き先（次の本当の選ぶ所か終わり）が2つ以上
# 違う節点だけを本当の選ぶ所とし、1手は本当の選ぶ所で始まる。選ぶ所を粗く同一視するほど数え始めは前に動くので、
# G は G_f（規則の1手）以上、G_b7（本当の選ぶ所から）以下に入る（資料 §3.5）。

G_LONG_V7 = 6   # 版7 の境目（G_SHORT は版4 から同じ）。資料 §4.2


def g_band_v7(x):
    return 1 if x <= G_SHORT else (2 if x <= G_LONG_V7 else 3)


def restrict_safe_all(g):
    """版7: 安全な組札送りがある節点では、安全な組札送りだけを打つ網（2つ以上あれば、どれを先に打ってもよい）。

    安全な組札送りは互いに妨げない（送っても別の安全な札は安全なまま、置き場所も変わらない）ので、どの順で送っても
    送り終えた局面は同じ（導出）。restrict_safe（最初の1つだけを残す）と、行ける本当の選ぶ所・終わり・段・G は同じになる。
    """
    nodes = g["nodes"]
    out = {}
    for v, ch in nodes.items():
        keep = [(mv, c) for mv, c in ch if is_safe_fnd_move(mv, v)]
        out[v] = keep if keep else ch
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


def real_choices(g, order, proj=None):
    """版7: 本当の選ぶ所と、各節点の行き先。

    網の後ろから、手の行き先を決める。子 c が終わり（勝ち・詰み）か本当の選ぶ所なら行き先は c、そうでなければ c の行き先。
    手の行き先が2つ以上違う節点が本当の選ぶ所（根は数え始めとしていつも使う）。本当の選ぶ所でない節点では、どの手も
    同じ行き先へ、ほかの本当の選びを経ずに合流する（見かけの選ぶ所と強制手）。
    proj を渡すと、局面をその像で同じとみなして合流を見る（比べる用。山札の位置を見ない、など）。
    戻り値: (本当の選ぶ所の集合, {節点: 行き先})。本当の選ぶ所の行き先はそれ自身（proj があればその像）。
    """
    nodes = g["nodes"]
    dest = {}
    real = set()

    def key(c):
        if c == WIN:
            return WIN
        if c in nodes:
            return dest[c]
        return ("STUCK", proj(c[1])) if proj else c

    for v in reversed(order):
        ds = {key(c) for _, c in nodes[v]}
        if len(ds) >= 2:
            real.add(v)
            dest[v] = proj(v) if proj else v
        else:
            dest[v] = next(iter(ds))
    return real, dest


def endset_choices(g, order, limit=50_000):
    """比べる用（版7）: 手ごとに行ける終わり（勝ち・詰み）の集まりが違う節点。網が limit を超えれば None。"""
    nodes = g["nodes"]
    if len(order) > limit:
        return None
    tid = {}
    es = {}

    def bit(c):
        if c not in tid:
            tid[c] = len(tid)
        return 1 << tid[c]

    for v in reversed(order):
        m = 0
        for _, c in nodes[v]:
            m |= es[c] if c in nodes else bit(c)
        es[v] = m
    return {v for v in order if len({es[c] if c in nodes else bit(c) for _, c in nodes[v]}) >= 2}


def fatal_depths_S(g, order, label, stuck, S, fnd_mm=None):
    """比べる用（版7）: 数え始めを、選ぶ所の集合 S（と根）のうち致命の手 x 以前で最後のものに置いた G の幅。

    道筋が何本もあるときは、数え始めの組札の最小を取る（G の大きい側）。致命の手の先の詰みの最小は区切り方に依らない。
    """
    nodes = g["nodes"]
    root = g["root"]
    mn = (fnd_mm or _min_max_fnd(g, order))[0]
    inb = {}
    sure, poss = [], []
    for v in order:
        b = sum(v[1]) if (v in S or v == root) else inb[v]
        lv = label.get(v, False)
        for _, c in nodes[v]:
            if c in nodes and (c not in inb or b < inb[c]):
                inb[c] = b
            if lv is False:
                continue
            if c == WIN:
                continue
            lc = label.get(c, False) if c in nodes else stuck.get(c[1], False)
            if lc is True:
                continue
            gv = (mn[c] if c in nodes else sum(c[1][1])) - b
            poss.append(gv)
            if lv is True and lc is False:
                sure.append(gv)
    return {"n_sure": len(sure), "n_poss": len(poss), "G_lo": max(sure, default=None), "G_hi": max(poss, default=None)}


def fatal_depths_v7(g, order, label, stuck, fnd_mm=None, extras=True):
    """版7: 規則の1手で区切った G_f と、本当の選ぶ所から数えた G_b7 の幅、比べる用の量。

    G_f の下端は版6 と同じく鎖からの下限も使う（fatal_depths_grouping）。G_b7: 本当の選ぶ所 d の手ごとの行き先 D について、
    d が解け D が解けないものを致命の選びとし、G_b7 = D から行ける詰みの組札の最小 − d の組札。D までのどの道筋も D を通るので、
    致命の手 x → y が d と D の間のどこにあっても、y から行ける詰みの最小は D からの最小と同じ（導出）。
    extras=True なら比べる用の量も求める: 続け方の最大（Gx）、選んだ手の後・致命の手の後から数える（Gy）、致命の手の中の最小（Gmin。
    lo = あり得るものの最小、hi = 確かなものの最小）、別の手が解けるままの所だけ（Galt）、版6 の選ぶ所（b6）、行ける終わりの集まりで
    選ぶ所を決める（bend）、山札の位置を見ずに合流を見る（bns）、本当の選ぶ所を数え始めにした道筋ごとの計算（b7dp。G_hi_b7 と同じになるはず）。
    """
    nodes = g["nodes"]
    root = g["root"]
    mm = fnd_mm or _min_max_fnd(g, order)
    mn, mx = mm
    grp = fatal_depths_grouping(g, order, label, stuck, mm)
    out = {"n_sure_f": grp["n_sure_f"], "n_poss_f": grp["n_poss_f"], "G_lo_f": grp["G_lo_f"], "G_hi_f": grp["G_hi_f"],
           "G_lo_b6": grp["G_lo_b"], "G_hi_b6": grp["G_hi_b"], "n_forced_sure": grp["n_forced_sure"]}

    def lab(c):
        if c == WIN:
            return True
        if c in nodes:
            return label.get(c, False)
        return stuck.get(c[1], False)

    def low(c):
        return 52 if c == WIN else (mn[c] if c in nodes else sum(c[1][1]))

    def high(c):
        return 52 if c == WIN else (mx[c] if c in nodes else sum(c[1][1]))

    def fnd_of(c):
        return 52 if c == WIN else (sum(c[1]) if c in nodes else sum(c[1][1]))

    real, dest = real_choices(g, order)
    if root in nodes:
        real.add(root)
    out["n_real"] = len(real)
    out["n_choice6"] = sum(1 for v in order if len(nodes[v]) >= 2)
    keys = ("G", "Gx", "Gy", "Galt")
    acc = {k: ([], []) for k in keys}
    gmin_s, gmin_p = [], []
    for d in order:
        if d not in real:
            continue
        lv = label.get(d, False)
        if lv is False:
            continue
        opts = {}
        for _, c in nodes[d]:
            D = c if (c == WIN or c not in nodes) else dest[c]
            fc = fnd_of(c)
            opts[D] = fc if D not in opts else min(opts[D], fc)
        labs = {D: lab(D) for D in opts}
        f0 = sum(d[1])
        for D, fc in opts.items():
            lc = labs[D]
            if lc is True:
                continue
            others = [labs[E] for E in opts if E != D]
            m = low(D)
            vals = {"G": m - f0, "Gx": high(D) - f0, "Gy": m - fc}
            is_sure = lv is True and lc is False
            for k, val in vals.items():
                acc[k][1].append(val)
                if is_sure:
                    acc[k][0].append(val)
            gmin_p.append(vals["G"])
            if is_sure:
                gmin_s.append(vals["G"])
            if any(o is not False for o in others):
                acc["Galt"][1].append(vals["G"])
                if is_sure and any(o is True for o in others):
                    acc["Galt"][0].append(vals["G"])
    out["n_sure_b7"] = len(acc["G"][0])
    out["n_poss_b7"] = len(acc["G"][1])
    for k in keys:
        out[f"{k}_lo_b7"] = max(acc[k][0], default=None)
        out[f"{k}_hi_b7"] = max(acc[k][1], default=None)
    out["n_poss_alt_b7"] = len(acc["Galt"][1])
    out["Gmin_lo_b7"] = min(gmin_p, default=None)
    out["Gmin_hi_b7"] = min(gmin_s, default=None)
    if not extras:
        return out
    # 規則の1手の側の比べる用の量
    facc = {k: ([], []) for k in keys}
    fmin_s, fmin_p = [], []
    for x in order:
        lv = label.get(x, False)
        if lv is False:
            continue
        ch = nodes[x]
        labs = [lab(c) for _, c in ch]
        fx = sum(x[1])
        for i, (_, c) in enumerate(ch):
            lc = labs[i]
            if lc is True:
                continue
            others = [labs[j] for j in range(len(ch)) if j != i]
            m = low(c)
            vals = {"G": m - fx, "Gx": high(c) - fx, "Gy": m - fnd_of(c)}
            is_sure = lv is True and lc is False
            for k, val in vals.items():
                facc[k][1].append(val)
                if is_sure:
                    facc[k][0].append(val)
            fmin_p.append(vals["G"])
            if is_sure:
                fmin_s.append(vals["G"])
            if any(o is not False for o in others):
                facc["Galt"][1].append(vals["G"])
                if is_sure and any(o is True for o in others):
                    facc["Galt"][0].append(vals["G"])
    for k in ("Gx", "Gy", "Galt"):
        out[f"{k}_lo_f"] = max(facc[k][0], default=None)
        out[f"{k}_hi_f"] = max(facc[k][1], default=None)
    out["n_poss_alt_f"] = len(facc["Galt"][1])
    out["Gmin_lo_f"] = min(fmin_p, default=None)
    out["Gmin_hi_f"] = min(fmin_s, default=None)
    # 選ぶ所の決め方を替えた形（道筋ごとの計算）
    dp = fatal_depths_S(g, order, label, stuck, real, mm)
    out["G_hi_b7dp"] = dp["G_hi"]
    ns_real, _ = real_choices(g, order, proj=lambda st: (st[0], st[1]))
    out["n_real_ns"] = len(ns_real)
    dp = fatal_depths_S(g, order, label, stuck, ns_real, mm)
    out["G_lo_bns"], out["G_hi_bns"] = dp["G_lo"], dp["G_hi"]
    es = endset_choices(g, order)
    out["n_real_end"] = None if es is None else len(es)
    if es is not None:
        dp = fatal_depths_S(g, order, label, stuck, es, mm)
        out["G_lo_bend"], out["G_hi_bend"] = dp["G_lo"], dp["G_hi"]
    else:
        out["G_lo_bend"] = out["G_hi_bend"] = None
    return out


V7_MAIN = ("n_poss_f", "G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7")


def v7_features_from_labels(gf, order, label, stuck, f):
    """版7 の量を、素朴な手すべての網 gf と札から求める（features_v4(v7=True) から呼ぶ）。

    鍵: <量>_all_v7（素朴な手すべての網）、<量>_safe_v7（安全な札をすぐ送る網。restrict_safe_all）、
    比べる用に <量>_safe1_v7（restrict_safe。最初の1つだけ）、<量>_natlab_v7（「解ける」を素朴な解き方で勝てるかに。段2 だけ）、
    <量>_dead_v7・<量>_alive_v7（打ち切りを全部解けない・全部解けるに倒す）、<量>_pol_<名前>_v7（優先順位で絞った網）。
    T_safeall_full は restrict_safe_all の網の段。
    """
    out = {}
    nd = gf["nodes"]
    sa = restrict_safe_all(gf)
    T_sa, _ = natural_class(sa)
    out["T_safeall_full"] = T_sa
    plays = {"all": (gf, order)}
    if T_sa in (2, 3):
        plays["safe"] = (sa, _topo_order(sa))
    if f.get("T_safe_full") in (2, 3):
        s1 = restrict_safe(gf)
        plays["safe1"] = (s1, _topo_order(s1))
    for play, (gg, oo) in plays.items():
        if play == "all" and f.get("T_all_full") not in (2, 3):
            continue
        mm = _min_max_fnd(gg, oo)
        res = fatal_depths_v7(gg, oo, label, stuck, mm, extras=(play in ("all", "safe")))
        for k, val in res.items():
            if play == "safe1" and k not in V7_MAIN:
                continue
            out[f"{k}_{play}_v7"] = val
    if f.get("T_all_full") not in (2, 3):
        return out
    mm = _min_max_fnd(gf, order)
    # 打ち切りを両側に倒す
    for name, val in (("dead", False), ("alive", True)):
        l2 = {v: (val if x is None else x) for v, x in label.items()}
        s2 = {k: (val if x is None else x) for k, x in stuck.items()}
        res = fatal_depths_v7(gf, order, l2, s2, mm, extras=False)
        for k in V7_MAIN:
            out[f"{k}_{name}_v7"] = res[k]
    # 「解ける」を素朴な解き方で勝てるかに（段2 だけ）
    if f.get("T_all_full") == 2:
        anywin = {}
        for v in reversed(order):
            anywin[v] = any(c == WIN or (c in nd and anywin[c]) for _, c in nd[v])
        nl = {v: anywin[v] for v in order}
        ns = {k: False for k in stuck}
        for _, ch in nd.items():
            for _, c in ch:
                if c != WIN and c not in nd:
                    ns[c[1]] = False
        res = fatal_depths_v7(gf, order, nl, ns, mm, extras=False)
        for k in V7_MAIN:
            out[f"{k}_natlab_v7"] = res[k]
    # 優先順位で絞った網
    for pol, gg in (("fnd_first", restrict_policy(gf, "fnd_first")), ("class_prio", restrict_policy(gf, "class_prio")),
                    ("eager", restrict_eager(gf))):
        T, _ = natural_class(gg)
        if T in (2, 3):
            oo = _topo_order(gg)
            res = fatal_depths_v7(gg, oo, label, stuck, _min_max_fnd(gg, oo), extras=False)
            for k in V7_MAIN:
                out[f"{k}_pol_{pol}_v7"] = res[k]
    return out


def features_v7(seed, **kw):
    """版7 の特徴: 版6 の特徴に、本当の選ぶ所で区切った G と比べる用の量（<量>_<遊び方>_v7）を足したもの。"""
    kw.setdefault("bc", True)
    kw["grouping"] = True
    kw["v7"] = True
    return features_v4(seed, **kw)


V7_FAMILIES = {
    # 名前: (規則の1手の端の lo, hi, まとめた端の lo, hi, あり得る致命の手の数)
    "G": ("G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7", "n_poss_f"),
    "b6": ("G_lo_f", "G_hi_f", "G_lo_b6", "G_hi_b6", "n_poss_f"),
    "bend": ("G_lo_f", "G_hi_f", "G_lo_bend", "G_hi_bend", "n_poss_f"),
    "bns": ("G_lo_f", "G_hi_f", "G_lo_bns", "G_hi_bns", "n_poss_f"),
    "Gx": ("Gx_lo_f", "Gx_hi_f", "Gx_lo_b7", "Gx_hi_b7", "n_poss_f"),
    "Gy": ("Gy_lo_f", "Gy_hi_f", "Gy_lo_b7", "Gy_hi_b7", "n_poss_f"),
    "Gmin": ("Gmin_lo_f", "Gmin_hi_f", "Gmin_lo_b7", "Gmin_hi_b7", "n_poss_f"),
    "Galt": ("Galt_lo_f", "Galt_hi_f", "Galt_lo_b7", "Galt_hi_b7", "n_poss_alt_f"),
}


def g_stage_v7(f, play, band=None, ends="env", fam="G"):
    """版7: g_stage_v6 と同じ決め方（区切り方の両端と打ち切りの幅）を、量の組 fam で行う。

    lo・hi はそれぞれ、本当の値の下限・上限（最大を取る量では 確かなものの最大・あり得るものの最大、最小を取る量では
    あり得るものの最小・確かなものの最小）。どの区切り方でも本当の値は［規則の1手の端の lo, まとめた端の hi］に入る。
    """
    lo_f, hi_f, lo_b, hi_b, npk = (f.get(f"{k}_{play}_v7") for k in V7_FAMILIES[fam])
    if npk is None:
        return "unresolved", None
    if not npk:
        return "no-true-trap", None
    bd = band or g_band_v7
    if ends == "fine":
        lo, hi = lo_f, hi_f
    elif ends == "branch":
        lo, hi = lo_b, hi_b
    else:
        if lo_b is not None and hi_f is not None and bd(hi_f) < bd(lo_b):
            return "grouping", None
        lo, hi = lo_f, hi_b
    if lo is None or hi is None or bd(lo) != bd(hi):
        return "unresolved", None
    return "ok", bd(lo)


def classify_v7(f, rule="none", check_play=True, band=None, ends="env", fam="G", play_key=None, robust=True):
    """版7 の分類。段 T の扱いは classify_v4 と同じ。G の段は g_stage_v7（本当の選ぶ所で区切った端と、規則の1手の端）で決める。

    安全な札をすぐ送る網は restrict_safe_all。その網で段が同じなら、その網でも G の段が同じことを求め、その網に罠が無いとき・
    区切り方で段が変わるとき・G の段が違うときは範囲外（無いときと違うときは trap-depth-depends-on-play）。
    play_key を渡すと、遊び方の網の鍵をその名前（"natlab"・"dead"・"pol_fnd_first" など）に替えて分類する（比べる用。check_play は使わない）。
    """
    if f.get("status") != "win":
        return "invalid", "not-proven-solvable"
    play = "all" if rule == "none" else "safe"
    tplay = "all" if rule == "none" else "safe"
    Ts = {k: f.get(f"T_{tplay}_{k}") for k in T_KEYS}
    if any(v is None for v in Ts.values()):
        return "unsupported", "natural-graph-too-large"
    T = Ts["full"]
    if rule == "safe":
        T = f.get("T_safeall_full", T)
    if robust and T in (1, 3) and not all(v == T for v in Ts.values()):
        return "out-of-range", "natural-depends-on-move-types"
    if T == 1:
        return "classified", 1
    if play_key:
        play = play_key
        check_play = False
    st, bd = g_stage_v7(f, play, band, ends, fam)
    if st == "unresolved":
        return "unsupported", "oracle-unresolved"
    if st == "no-true-trap":
        return "out-of-range", "no-true-trap"
    if st == "grouping":
        return "out-of-range", "trap-depth-depends-on-grouping"
    if rule == "none" and check_play and f.get("T_safeall_full") == T:
        s2, b2 = g_stage_v7(f, "safe", band, ends, fam)
        if s2 == "unresolved":
            return "unsupported", "oracle-unresolved"
        if s2 == "grouping":
            return "out-of-range", "trap-depth-depends-on-grouping"
        if s2 != "ok" or b2 != bd:
            return "out-of-range", "trap-depth-depends-on-play"
    lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, bd))
    if lv is None:
        return "out-of-range", "unlisted-combination"
    return "classified", lv


def verify_fatal_dead(g, order, label, stuck, budget_sec=60, limit1=20_000, limit2=100_000, e_limit=50_000):
    """R1 の確かめ（版5）: 致命の手の先で読むモデルが「解けない」とした局面を、枝刈りなしの別実装（plain_solve）で解き直す。

    対象: 解けないと決まっていない節点 x から出る手の先 y のうち、読むモデルが解けないとしたもの（確かな・あり得る致命の手の先。
    局面で重ねない）。y は確かな致命の手の先から順に解き直し、budget_sec 秒を超えたら残りを数えるだけにする。
      1回目: plain_solve（枝刈りなし、limit1 局面）。打ち切りなら 2回目: 安全な組札送りだけを先に済ませる plain_solve（limit2 局面）。
    さらに、y から素朴な手で行く詰み e（読むモデルが解けないとしたもの）を、同じく枝刈りなしで解き直す（limit は e_limit）。
    勝ちが見つかれば、読むモデルの「解けない」が誤り（chk_*_win）。
    """
    t0 = time.time()
    nodes = g["nodes"]
    ys = {}
    for v in order:
        lv = label.get(v, False)
        if lv is False:
            continue
        for _, c in nodes[v]:
            if c == WIN:
                continue
            if c in nodes:
                if label.get(c) is not False:
                    continue
                st = c
            else:
                if stuck.get(c[1]) is not False:
                    continue
                st = c[1]
            rs = _reader_state(st)
            k = (tuple(sorted(rs[0])), rs[1])
            sure = lv is True
            if k not in ys or (sure and not ys[k][2]):
                ys[k] = (rs, c, sure)
    out = {"chk_y": len(ys), "chk_y_sure": sum(1 for x in ys.values() if x[2])}
    cnt = {"lose1": 0, "lose2": 0, "unknown": 0, "win": 0, "skipped": 0}
    ecnt = {"lose": 0, "unknown": 0, "win": 0}
    wins = []
    done_e = set()
    for k, (rs, c, sure) in sorted(ys.items(), key=lambda kv: not kv[1][2]):
        if time.time() - t0 > budget_sec:
            cnt["skipped"] += 1
            continue
        r, _ = plain_solve(rs[0], limit1, rs[1], rs[2])
        if r == "unknown":
            r, _ = plain_solve(rs[0], limit2, rs[1], rs[2], auto=True)
            r = {"lose": "lose2"}.get(r, r)
        else:
            r = {"lose": "lose1"}.get(r, r)
        cnt[r] += 1
        if r == "win":
            wins.append(("y", sum(rs[1]), sure))
        # y から素朴な手で行く詰み e
        ends = set()
        if c in nodes:
            stck = [c]
            seen = set()
            while stck:
                v = stck.pop()
                if v in seen:
                    continue
                seen.add(v)
                for _, d in nodes[v]:
                    if d == WIN:
                        continue
                    if d in nodes:
                        stck.append(d)
                    else:
                        ends.add(d[1])
        else:
            ends.add(c[1])
        for e in ends:
            if e in done_e or stuck.get(e) is not False:
                continue
            done_e.add(e)
            es = _reader_state(e)
            re_, _ = plain_solve(es[0], e_limit, es[1], es[2])
            if re_ == "unknown":
                re_, _ = plain_solve(es[0], e_limit, es[1], es[2], auto=True)
            ecnt[re_] += 1
            if re_ == "win":
                wins.append(("e", sum(es[1]), sure))
    out.update({f"chk_y_{k_}": v_ for k_, v_ in cnt.items()})
    out.update({f"chk_e_{k_}": v_ for k_, v_ in ecnt.items()})
    out["chk_wins"] = wins[:10]
    out["chk_sec"] = round(time.time() - t0, 2)
    return out


def _v4_worker(args):
    seed, kw = args
    try:
        return features_v4(seed, **kw)
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


# 版4 の境目（罠の後の進み G、組札の枚数）。G がこれ以下 / これ以下 / これを超える で段 1 / 2 / 3
G_SHORT = 2   # 罠の後、組札が2枚以下しか進まずに詰む続け方がある（すぐ行き詰まる）
G_LONG = 5    # 罠の後、どう続けても組札が6枚以上進んでから詰む、を段 3 とする


def g_band(x):
    return 1 if x <= G_SHORT else (2 if x <= G_LONG else 3)


def g_stage(f, sfx, lo="G_lo", hi="G_hi", band=None):
    """幅で G の段を決める。戻り値: ("ok", 段) / ("no-true-trap", None) / ("unresolved", None)。"""
    if f.get("n_poss" + sfx) is None:
        return "unresolved", None
    if not f.get("n_poss" + sfx):
        return "no-true-trap", None
    if not f.get("n_sure" + sfx):
        return "unresolved", None
    bd = band or g_band
    a, b = bd(f[lo + sfx]), bd(f[hi + sfx])
    if a != b:
        return "unresolved", None
    return "ok", a


def classify_v4(f, rule="none", mode="all", check_play=True, lo="G_lo", hi="G_hi", band=None, robust=True):
    """版4 の分類。f は features_v4 の出力に survey の status を足したもの。戻り値: (状態, レベルか理由)。"""
    if f.get("status") != "win":
        return "invalid", "not-proven-solvable"
    play = "all" if rule == "none" else "safe"
    Ts = {k: f.get(f"T_{play}_{k}") for k in T_KEYS}
    if any(v is None for v in Ts.values()):
        return "unsupported", "natural-graph-too-large"
    T = Ts["full"]
    if robust and T in (1, 3) and not all(v == T for v in Ts.values()):
        return "out-of-range", "natural-depends-on-move-types"
    if T == 1:
        return "classified", 1
    st, bd = g_stage(f, f"_{play}_{mode}", lo, hi, band)
    if st == "unresolved":
        return "unsupported", "oracle-unresolved"
    if st == "no-true-trap":
        return "out-of-range", "no-true-trap"
    if rule == "none" and check_play and f.get("T_safe_full") == T:
        s2, b2 = g_stage(f, f"_safe_{mode}", lo, hi, band)
        if s2 == "unresolved":
            return "unsupported", "oracle-unresolved"
        if s2 != "ok" or b2 != bd:
            return "out-of-range", "trap-depth-depends-on-play"
    lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, bd))
    if lv is None:
        return "out-of-range", "unlisted-combination"
    return "classified", lv


def load_v4(cache_dir, prefix="random", name="v4"):
    S_ = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    V = _load_jsonl(os.path.join(cache_dir, f"{name}_{prefix}.jsonl"))
    rows = []
    for seed, r in sorted(S_.items()):
        f = {"seed": seed, "status": r["status"], "tier": r.get("tier"), "moves": r.get("moves")}
        if seed in V and "error" not in V[seed]:
            f.update(V[seed])
        rows.append(f)
    return rows


def _safe_loose(c, fnd):
    """比べる用: 安全な組札送りの条件から「同じ色のもう1組が2つ下まで」を外したもの。"""
    r = RANK[c]
    s_ = SUIT[c]
    if fnd[s_] != r - 1:
        return False
    if r <= 2:
        return True
    opp = (1, 2) if not RED[c] else (0, 3)
    return all(fnd[o] >= r - 1 for o in opp)


def restrict_pred(g, pred):
    """組札へ送る手（TF・WF）のうち pred を満たす札があれば、それ（最初の1つ）だけを打つ網に絞る。"""
    nodes = g["nodes"]
    out = {}
    for v, ch in nodes.items():
        tab, fnd, _, waste = v
        keep = None
        for mv, c in ch:
            card = tab[mv[1]][-1] if mv[0] == "TF" else (waste[-1] if mv[0] == "WF" else None)
            if card is not None and pred(card, fnd):
                keep = [(mv, c)]
                break
        out[v] = keep if keep else ch
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


def _v4sens_worker(args):
    """確かめ用（版4）: 変種の網・安全な札の条件を緩めた網での G の幅。読むモデルの札は素朴な手すべての網で付け、変種の網では足りない札を問い合わせる。"""
    seed, kw = args
    try:
        tab, stock = deal(seed)
        graphs = {name: natural_graph(tab, stock, var["empty"], var["pf"]) for name, var in NAT_VARIANTS.items()}
        g = graphs["full"]
        oracle = AliveOracle(40_000, 2_000_000, cache_unknown=True, bc=kw.get("bc", False))
        order, label, stuck, _ = label_graph(g, oracle)
        row = {"seed": seed}
        gl = restrict_pred(g, _safe_loose)
        T, _ = natural_class(gl)
        row["safe_loose"] = {"T": T}
        if T in (2, 3):
            row["safe_loose"].update(fatal_depths(gl, _topo_order(gl), label, stuck, "all"))
        # 打ち切りを両側に倒した札（版2 の扱い。比べる用）
        for tag, val in (("twosided_dead", False), ("twosided_alive", True)):
            lb = {k: (val if v is None else v) for k, v in label.items()}
            sb = {k: (val if v is None else v) for k, v in stuck.items()}
            row[tag] = fatal_depths(g, order, lb, sb, "all")
        oracle.budget = oracle.used + 2_000_000
        for name in ("noE", "noPF", "basic"):
            gv = graphs[name]
            T, _ = natural_class(gv)
            r = {"T": T}
            if T in (2, 3):
                o2, l2, s2, c2 = label_graph(gv, oracle, (label, stuck))
                r.update(fatal_depths(gv, o2, l2, s2, "all"))
                r["conflicts"] = c2
            row[name] = r
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def _band_fn(a, b):
    return lambda x: 1 if x <= a else (2 if x <= b else 3)


def _swap_keys(f, src_sfx, dst_sfx, keys=("n_sure", "n_poss", "G_lo", "G_hi", "Gx_lo", "Gx_hi", "Gmin_lo")):
    g = dict(f)
    for k in keys:
        g[k + dst_sfx] = f.get(k + src_sfx)
    return g


def _plan_v4_generic(value_fn, a, b, rule="none"):
    """案D 用: 罠を使わず、配り方ごとの値 value_fn(f) を2つ目のつまみにする分類（段 T の扱いは classify_v4 と同じ）。"""
    band = _band_fn(a, b)

    def fn(f):
        base = classify_v4(f, rule=rule)
        if base[0] == "invalid" or base[1] in ("natural-graph-too-large", "natural-depends-on-move-types") or base == ("classified", 1):
            return base
        T = f.get("T_all_full" if rule == "none" else "T_safe_full")
        x = value_fn(f)
        if x is None:
            return "unsupported", "no-value"
        lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, band(x)))
        return ("classified", lv) if lv else ("out-of-range", "unlisted-combination")
    return fn


def _plan_v4_v3D(rule="none"):
    """案C 用: 版3 の D（終わりの集まりで見た分かれ道。境目 0 / 1）。"""
    band = _band_fn(0, 1)

    def fn(f):
        base = classify_v4(f, rule=rule)
        if base[0] == "invalid" or base[1] in ("natural-graph-too-large", "natural-depends-on-move-types") or base == ("classified", 1):
            return base
        play = "all" if rule == "none" else "safe"
        T = f.get(f"T_{play}_full")
        n_s, n_p = f.get(f"v3_n_sure_{play}"), f.get(f"v3_n_poss_{play}")
        if not n_p:
            return "out-of-range", "no-true-trap"
        if not n_s or band(f[f"v3_D_lo_{play}"]) != band(f[f"v3_D_hi_{play}"]):
            return "unsupported", "oracle-unresolved"
        lv = {(2, 1): 2, (2, 2): 3, (3, 2): 4, (3, 3): 5}.get((T, band(f[f"v3_D_lo_{play}"])))
        return ("classified", lv) if lv else ("out-of-range", "unlisted-combination")
    return fn


def _plan_v4_tier(rule="none"):
    def fn(f):
        base = classify_v4(f, rule=rule)
        if base[0] == "invalid" or base[1] in ("natural-graph-too-large", "natural-depends-on-move-types") or base == ("classified", 1):
            return base
        T = f.get("T_all_full" if rule == "none" else "T_safe_full")
        k = 1 if f.get("tier") == "E" else 2
        return "classified", {(2, 1): 2, (2, 2): 3, (3, 1): 4, (3, 2): 5}[(T, k)]
    return fn


def plans_v4(rule="none"):
    return {
        "案A 段T × 罠の後の進み G（致命の手すべて、続け方の最小）": lambda f: classify_v4(f, rule=rule),
        "案A' 段T × G（素朴な手に正しい手が残る致命の手だけ）": lambda f: classify_v4(f, rule=rule, mode="alt"),
        "案B 段T × 罠の後の進みの最大（続け方の最大）": lambda f: classify_v4(f, rule=rule, lo="Gx_lo", hi="Gx_hi", band=_band_fn(2, 6)),
        "案C 段T × 版3 の D": _plan_v4_v3D(rule),
        "案D 段T × 素朴な解き方が詰むまでの組札の枚数（根からのすべての道筋の最小。読むモデルを使わない）": _plan_v4_generic(lambda f: f.get("R_min"), 5, 9, rule),
        "案E 段T × 手筋 tier": _plan_v4_tier(rule),
    }


def compare_v4(cache_dir, prefix="random", name="v4"):
    """版4 の比較。採用形は (a) 自動送りなし（安全な札をすぐ送る網でも G の段が同じことを求める）。"""
    rows = load_v4(cache_dir, prefix, name)
    win = [f for f in rows if f["status"] == "win"]
    print(f"解けると確かめた配り方: {len(win)} / {len(rows)}")
    print("読むモデルの食い違い:", sum(f.get("label_conflicts_full", 0) for f in win))
    A = lambda f: classify_v4(f, rule="none")  # noqa: E731
    models = {
        "(a) 自動送りなし（採用）": A,
        "(b) 安全な札を自動で組札へ送る": lambda f: classify_v4(f, rule="safe"),
        "(a') 自動送りなし・安全な札をすぐ送る網での確かめなし": lambda f: classify_v4(f, rule="none", check_play=False),
    }
    for mname, fn in models.items():
        print(f"== {mname}")
        print("  件数:", _counts(win, fn))
    print("\n(a) で分類済みの L2〜L5 のうち変わる問題（定義の選択・感度）")
    print("  (b) にする:", _changed(win, A, models["(b) 安全な札を自動で組札へ送る"]))
    print("  罠を「素朴な手に正しい手が残る」ものに限る（alt）:", _changed(win, A, lambda f: classify_v4(f, mode="alt")))
    print("  続け方の最大で数える（Gx、境目は同じ 2/5）:", _changed(win, A, lambda f: classify_v4(f, lo="Gx_lo", hi="Gx_hi")))
    print("  致命の手の中の最小で取る（すべての致命の手が深い）:", _changed(win, A, lambda f: classify_v4(f, lo="Gmin_lo", hi="Gmin_lo")))
    print("  段2 で「解ける」を素朴な解き方で勝てるかにする:",
          _changed(win, A, lambda f: classify_v4(_swap_keys(f, "_natlab", "_all_all"), check_play=False) if f.get("T_all_full") == 2 else A(f)))
    for pol in ("fnd_first", "class_prio", "eager"):
        same = [f for f in win if f.get(f"T_pol_{pol}") == f.get("T_all_full")]
        print(f"  網を {pol} に絞る: 段が変わる {sum(1 for f in win if A(f)[0] == 'classified' and A(f)[1] >= 2 and f.get(f'T_pol_{pol}') != f.get('T_all_full'))}"
              "／段が同じ問題で G の段が変わる", _changed(same, A, lambda f, pol=pol: classify_v4(_swap_keys(f, f"_pol_{pol}", "_all_all"), check_play=False)))
    for a_, b_ in ((1, 5), (3, 5), (2, 4), (2, 6)):
        print(f"  境目 {a_}/{b_}:", _changed(win, A, lambda f, a_=a_, b_=b_: classify_v4(f, band=_band_fn(a_, b_))),
              "件数", _counts(win, lambda f, a_=a_, b_=b_: classify_v4(f, band=_band_fn(a_, b_))))
    print("  版3 の D に戻す:", _changed(win, A, _plan_v4_v3D()))
    for rule in ("none", "safe"):
        play = "all" if rule == "none" else "safe"
        print(f"\n案の比較（rule={rule}）")
        P = plans_v4(rule)
        base = P[next(iter(P))]
        for pname, fn in P.items():
            lv = {}
            for f in win:
                lv.setdefault(fn(f), []).append(f)
            print(f"== {pname}")
            print("  件数:", _counts(win, fn))
            for feat in (f"G_lo_{play}_all", f"Gx_lo_{play}_all", f"v3_D_lo_{play}", "R_min", f"p_{play}_full", "moves", "branch_dec"):
                print(f"  {feat:18s}", " | ".join(str(_q([f.get(feat) for f in lv.get(("classified", L), [])])) for L in (1, 2, 3, 4, 5)))
            if fn is not base:
                print("  案A と比べて変わる:", _changed(win, base, fn))
    t = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win]
    print("\n1候補の時間（網と致命の手の分析）: 中央値", round(statistics.median(t), 2), "・p95", round(sorted(t)[int(len(t) * 0.95)], 1),
          "・最大", round(max(t), 1), "・合計", round(sum(t)), "秒")
    for L in (1, 2, 3, 4, 5):
        tt = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win if A(f) == ("classified", L)]
        if tt:
            print(f"    L{L}: 中央値 {round(statistics.median(tt), 2)} 秒・最大 {round(max(tt), 1)} 秒")



def load_v6(cache_dir, prefix="random", big=""):
    """版6 のキャッシュ。big に上限を大きくした v6 の出力を渡すと、その行で置き換える（打ち切りの2回目）。"""
    rows = load_v4(cache_dir, prefix, "v6")
    if big:
        B = _load_jsonl(os.path.join(cache_dir, big))
        for f in rows:
            r = B.get(f["seed"])
            if r and "error" not in r:
                f.update(r)
                f["status"] = "win"
    return rows


def compare_v6(cache_dir, prefix="random", big=""):
    """版6 の比較。採用形は (a) 自動送りなし・区切り方の両端（ends="env"）。版5（classify_v4）と片方の端だけの分類も並べる。"""
    import collections
    rows = load_v6(cache_dir, prefix, big)
    win = [f for f in rows if f["status"] == "win"]
    print(f"解けると確かめた配り方: {len(win)} / {len(rows)}" + (f"（{big} で置き換え）" if big else ""))
    A = lambda f: classify_v6(f)  # noqa: E731
    V5 = lambda f: classify_v4(f)  # noqa: E731
    b25 = _band_fn(2, 5)
    models = {
        "(a) 版6 自動送りなし・区切り方の両端（採用。境目 2/6）": A,
        "(b) 版6 安全な札を自動で組札へ送る": lambda f: classify_v6(f, rule="safe"),
        "版5（規則の1手。classify_v4、境目 2/5）": V5,
        "規則の1手の端だけ（鎖からの下限つき、2/6）": lambda f: classify_v6(f, ends="fine"),
        "選びと強制手をまとめた端だけ（2/6）": lambda f: classify_v6(f, ends="branch"),
        "(a) 版6 区切り方の両端・境目 2/5": lambda f: classify_v6(f, band=b25),
        "規則の1手の端だけ（2/5）": lambda f: classify_v6(f, ends="fine", band=b25),
        "選びと強制手をまとめた端だけ（2/5）": lambda f: classify_v6(f, ends="branch", band=b25),
    }
    d1path = os.path.join(cache_dir, f"d1v5_{prefix}.jsonl")
    D1 = _load_jsonl(d1path) if os.path.exists(d1path) else {}
    for mname, fn in models.items():
        print(f"== {mname}")
        print("  件数:", _counts(win, fn))
        l5 = [f["seed"] for f in win if fn(f) == ("classified", 5)]
        got = [D1[s_]["push"] for s_ in l5 if s_ in D1]
        print(f"  L5 の押し切り率 0.5 以上: {sum(1 for x in got if x >= 0.5)}/{len(got)}（キャッシュに無い {len(l5) - len(got)}）",
              "・G_lo_f の中央値 L2〜L5:", [_q([f.get("G_lo_f_all_grp") for f in win if fn(f) == ("classified", L)]) for L in (2, 3, 4, 5)])
    print("\n版5 で L2〜L5 の問題のうち、変わる問題")
    for mname, fn in models.items():
        if fn is not V5:
            print(f"  {mname}:", _changed(win, V5, fn))
    print("版6 (a) で L2〜L5 の問題のうち、ほかの形で変わる問題")
    for mname, fn in models.items():
        if fn is not A:
            print(f"  {mname}:", _changed(win, A, fn))
    tr = collections.Counter()
    for f in win:
        a, b = V5(f), A(f)
        if a != b:
            tr[(f"L{a[1]}" if a[0] == "classified" else str(a[1]), f"L{b[1]}" if b[0] == "classified" else str(b[1]))] += 1
    print("版5 → 版6 (a) の移り方:", dict(sorted(tr.items(), key=lambda x: -x[1])))
    trb = collections.Counter()
    for f in win:
        a, b = V5(f), classify_v6(f, ends="branch")
        if a[0] == "classified" and a[1] >= 2 and a != b:
            trb[(f"L{a[1]}", f"L{b[1]}" if b[0] == "classified" else str(b[1]))] += 1
    print("版5 → まとめた端だけ（L2〜L5 から）:", dict(sorted(trb.items(), key=lambda x: -x[1])))
    print("版6 (a) と (b) で、(a) の L2〜L5 が変わる:", _changed(win, A, models["(b) 版6 安全な札を自動で組札へ送る"]))
    # 強制手の致命の手
    l25 = [f for f in win if V5(f)[0] == "classified" and V5(f)[1] >= 2]
    ns = sum(f.get("n_sure_f_all_grp") or 0 for f in l25)
    nf = sum(f.get("n_forced_sure_all_grp") or 0 for f in l25)
    anyf = sum(1 for f in l25 if (f.get("n_forced_sure_all_grp") or 0) > 0)
    allf = sum(1 for f in l25 if f.get("n_sure_f_all_grp") and f.get("n_forced_sure_all_grp") == f.get("n_sure_f_all_grp"))
    print(f"版5 の L2〜L5 {len(l25)} 件: 確かな致命の手 {ns} のうち置ける手が1つだけの局面の手 {nf}。それを含む問題 {anyf}、すべてそれの問題 {allf}")
    d = collections.Counter()
    for f in l25:
        a, b = f.get("G_lo_f_all_grp"), f.get("G_lo_b_all_grp")
        if a is not None and b is not None:
            d[b - a] += 1
    print("版5 の L2〜L5 で G_lo_b − G_lo_f:", dict(sorted(d.items())))
    chain = sum(1 for f in win if f.get("G_lo_f_all_grp") is not None and f.get("G_lo_all_all") is None)
    print("規則の1手の端の下端が、鎖からの下限で初めて決まる問題:", chain)
    # 収率・時間
    cnt = collections.Counter(A(f) for f in win)
    print("収率（/" + str(len(rows)) + "）:", {f"L{L}": f"{cnt[('classified', L)]}（{100 * cnt[('classified', L)] / len(rows):.2f}%）" for L in (1, 2, 3, 4, 5)})
    t = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win]
    print("1候補の時間（網と致命の手の分析）: 中央値", round(statistics.median(t), 2), "・p95", round(sorted(t)[int(len(t) * 0.95)], 1),
          "・最大", round(max(t), 1), "・合計", round(sum(t)), "秒")
    for L in (1, 2, 3, 4, 5):
        tt = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win if A(f) == ("classified", L)]
        if tt:
            print(f"    L{L}: 中央値 {round(statistics.median(tt), 2)} 秒・最大 {round(max(tt), 1)} 秒")
    # レベルごとの特徴
    lv = collections.defaultdict(list)
    for f in win:
        c = A(f)
        if c[0] == "classified":
            lv[c[1]].append(f)
    print("\nレベルごとの特徴（10/50/90）: L1 | L2 | L3 | L4 | L5")
    for feat in ("G_lo_f_all_grp", "G_hi_b_all_grp", "G_lo_b_all_grp", "Gx_lo_all_all", "Gmin_lo_all_all", "v3_D_lo_all", "n_sure_all_all",
                 "p_all_full", "graph_full", "decision_nodes", "branch_dec", "root_cands", "R_min", "oracle_nodes", "moves"):
        print(f"  {feat:18s}", " | ".join(str(_q([f.get(feat) for f in lv.get(L, [])])) for L in (1, 2, 3, 4, 5)))
    for L in (2, 3, 4, 5):
        sub = lv.get(L, [])
        nr_all = sum(1 for f in sub if f.get("n_sure_all_all") and f.get("n_noreturn_all_all") == f.get("n_sure_all_all"))
        nr_any = sum(1 for f in sub if (f.get("n_noreturn_all_all") or 0) > 0)
        fs = sum(1 for f in sub if (f.get("n_forced_sure_all_grp") or 0) > 0)
        print(f"  L{L}: 確かな致命の手がすべて後戻りの無い所 {nr_all}/{len(sub)}・後戻りの無い所が1つ以上 {nr_any}/{len(sub)}・置ける手が1つだけの局面の致命の手を含む {fs}/{len(sub)}")
    # 感度: 境目と ±1
    for a_, b_ in ((2, 5), (1, 6), (3, 6), (2, 7), (1, 5), (1, 7), (3, 7), (2, 4)):
        print(f"  境目 {a_}/{b_}:", _changed(win, A, lambda f, a_=a_, b_=b_: classify_v6(f, band=_band_fn(a_, b_))),
              "件数", _counts(win, lambda f, a_=a_, b_=b_: classify_v6(f, band=_band_fn(a_, b_))))
    keep1 = keep2 = n = 0
    for f in win:
        c = A(f)
        if c[0] != "classified" or c[1] < 2:
            continue
        n += 1
        ok = {1: True, 2: True}
        for dlt in (1, 2):
            for sgn in (-1, 1):
                g2 = dict(f)
                for play in ("all", "safe"):
                    for k in ("G_lo_f", "G_hi_f", "G_lo_b", "G_hi_b"):
                        if g2.get(f"{k}_{play}_grp") is not None:
                            g2[f"{k}_{play}_grp"] = g2[f"{k}_{play}_grp"] + sgn * dlt
                if A(g2) != c:
                    ok[dlt] = False
        keep1 += ok[1]
        keep2 += ok[2]
    print(f"G を ±1 動かしても変わらない {keep1}/{n}・±2 で {keep2}/{n}")
    # 確かめのキャッシュ（版5 の d1・policy・movevar。配り方だけで決まる）を版6 のレベルで集計
    for nm in ("d1v5", "policy5", "movevar5"):
        path = os.path.join(cache_dir, f"{nm}_{prefix}.jsonl")
        if not os.path.exists(path):
            continue
        R = _load_jsonl(path)
        print(f"== {nm}（版6 のレベル。キャッシュに無い問題の数も出す）")
        for L in (1, 2, 3, 4, 5):
            sub = [R[f["seed"]] for f in lv.get(L, []) if f["seed"] in R]
            miss = len(lv.get(L, [])) - len(sub)
            if not sub:
                continue
            if nm == "d1v5":
                r1 = [r["push"] for r in sub]
                r2 = [r["push_full"] for r in sub]
                print(f"  L{L} {len(sub)}（無い {miss}）: 押し切り率 {_q(r1)}・0.5以上 {sum(1 for r in r1 if r >= 0.5)}／すべての手 {_q(r2)}・0.5以上 {sum(1 for r in r2 if r >= 0.5)}")
            elif nm == "policy5" and L in (2, 3):
                print(f"  L{L} {len(sub)}（無い {miss}）:", {p_: {str(t_): sum(1 for r in sub if r.get(p_) == t_) for t_ in (1, 2, 3)} for p_ in POLICIES})
            elif nm == "movevar5" and L in (1, 4, 5):
                print(f"  L{L} {len(sub)}（無い {miss}）:", {k: dict(sorted(((str(x), sum(1 for r in sub if r.get(k) == x)) for x in {r.get(k) for r in sub}))) for k in MOVEVAR})
    un = sorted((f.get("graph_sec", 0) + f.get("trap_sec", 0), f["seed"]) for f in win if A(f) == ("unsupported", "oracle-unresolved"))
    print("評価不能（軽い順）:", ",".join(str(s_) for _, s_ in un))



def load_v7(cache_dir, prefix="random", big=""):
    """版7 のキャッシュ。big に上限を大きくした v7 の出力を渡すと、その行で置き換える（打ち切りの2回目）。"""
    rows = load_v4(cache_dir, prefix, "v7")
    if big:
        B = _load_jsonl(os.path.join(cache_dir, big))
        for f in rows:
            r = B.get(f["seed"])
            if r and "error" not in r:
                f.update(r)
                f["status"] = "win"
    return rows


def _lvtext(c):
    return f"L{c[1]}" if c[0] == "classified" else str(c[1])


def compare_v7(cache_dir, prefix="random", big=""):
    """版7 の比較。採用形は (a) 自動送りなし・本当の選ぶ所で区切った端と規則の1手の端の両端（fam="G"）。"""
    import collections
    rows = load_v7(cache_dir, prefix, big)
    win = [f for f in rows if f["status"] == "win"]
    print(f"解けると確かめた配り方: {len(win)} / {len(rows)}" + (f"（{big} で置き換え）" if big else ""))
    A = lambda f: classify_v7(f)  # noqa: E731
    V6 = lambda f: classify_v6(f)  # noqa: E731
    models = {"(a) 版7 自動送りなし（採用）": A, "(b) 版7 安全な札を自動で組札へ送る": lambda f: classify_v7(f, rule="safe"),
              "版6（classify_v6）": V6, "版7 で版6 の選ぶ所（b6）": lambda f: classify_v7(f, fam="b6"),
              "版7 の規則の1手の端だけ": lambda f: classify_v7(f, ends="fine"), "版7 の本当の選ぶ所の端だけ": lambda f: classify_v7(f, ends="branch")}
    for a_, b_ in ((2, 5), (2, 7), (2, 8), (1, 6), (1, 7), (3, 7), (3, 8)):
        models[f"(a) 境目 {a_}/{b_}"] = (lambda f, a_=a_, b_=b_: classify_v7(f, band=_band_fn(a_, b_)))
    d1path = os.path.join(cache_dir, f"d1v5_{prefix}.jsonl")
    D1 = _load_jsonl(d1path) if os.path.exists(d1path) else {}
    for mname, fn in models.items():
        lvl = [fn(f) for f in win]
        l5 = [f["seed"] for f, c in zip(win, lvl) if c == ("classified", 5)]
        got = [D1[s_]["push"] for s_ in l5 if s_ in D1]
        print(f"== {mname}: {_counts(win, fn)}")
        print(f"   L5 の押し切り率 0.5 以上 {sum(1 for x in got if x >= 0.5)}/{len(got)}（無い {len(l5) - len(got)}）・G_lo_f の中央値 L2〜L5",
              [_q([f.get("G_lo_f_all_v7") for f, c in zip(win, lvl) if c == ("classified", L)]) for L in (2, 3, 4, 5)])
    print("\n版6 で L2〜L5 の問題のうち、版7 の形で変わる:")
    for mname, fn in models.items():
        if fn is not V6:
            print(f"  {mname}:", _changed(win, V6, fn))
    tr = collections.Counter((_lvtext(V6(f)), _lvtext(A(f))) for f in win if V6(f) != A(f))
    print("版6 → 版7 (a):", dict(sorted(tr.items(), key=lambda x: -x[1])))
    print("(a) と (b) で (a) の L2〜L5 が変わる:", _changed(win, A, models["(b) 版7 安全な札を自動で組札へ送る"]))
    # 選ぶ所の数・値の動き
    l25_6 = [f for f in win if V6(f)[0] == "classified" and V6(f)[1] >= 2]
    n6 = sum(f.get("n_choice6_all_v7") or 0 for f in l25_6)
    n7 = sum(f.get("n_real_all_v7") or 0 for f in l25_6)
    print(f"版6 の L2〜L5 {len(l25_6)} 件の網: 版6 の選ぶ所 {n6}、本当の選ぶ所（根を含む） {n7}")
    dv = collections.Counter((f.get("G_hi_b7_all_v7") or 0) - (f.get("G_hi_b6_all_v7") or 0) for f in l25_6)
    print("  G_hi_b7 − G_hi_b6:", dict(sorted(dv.items())))
    mism = [f["seed"] for f in win if f.get("G_hi_b7_all_v7") != f.get("G_hi_b7dp_all_v7")]
    print("本当の選ぶ所の端: 行き先で求めた値と道筋ごとの計算の食い違い（上端）:", len(mism), mism[:10])
    ord_bad = [f["seed"] for f in win if f.get("G_hi_b7_all_v7") is not None and f.get("G_hi_b6_all_v7") is not None
               and f["G_hi_b7_all_v7"] < f["G_hi_b6_all_v7"]]
    print("G_hi_b7 < G_hi_b6 の問題（導出では無いはず）:", ord_bad)
    t23 = [f for f in win if f.get("T_all_full") in (2, 3)]
    sd = [f["seed"] for f in t23 if f.get("T_safeall_full") != f.get("T_safe_full")]
    s1 = [f["seed"] for f in t23 if any(f.get(f"{k}_safe_v7") != f.get(f"{k}_safe1_v7") for k in ("G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7"))]
    s2 = [f["seed"] for f in t23 if f.get("n_poss_f_safe_v7") != f.get("n_poss_f_safe1_v7")]
    c1 = sum(1 for f in win if classify_v7(f) != classify_v7(dict(f, **{f"{k}_safe_v7": f.get(f"{k}_safe1_v7") for k in V7_MAIN})))
    print(f"安全な組札送りをどの順でも打てる網と最初の1つだけの網（段2・段3 の {len(t23)} 件）: 段が違う", sd, "・G の両端が違う", s1,
          "・あり得る致命の手の数だけ違う", s2, "・分類が変わる", c1)
    # 収率・時間
    cnt = collections.Counter(A(f) for f in win)
    print("収率（/" + str(len(rows)) + "）:", {f"L{L}": f"{cnt[('classified', L)]}（{100 * cnt[('classified', L)] / len(rows):.2f}%）" for L in (1, 2, 3, 4, 5)})
    t = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in win]
    print("1候補の時間: 中央値", round(statistics.median(t), 2), "・p95", round(sorted(t)[int(len(t) * 0.95)], 1), "・最大", round(max(t), 1), "・合計", round(sum(t)), "秒")
    lv = collections.defaultdict(list)
    for f in win:
        c = A(f)
        if c[0] == "classified":
            lv[c[1]].append(f)
    for L in (1, 2, 3, 4, 5):
        tt = [f.get("graph_sec", 0) + f.get("trap_sec", 0) for f in lv.get(L, [])]
        if tt:
            print(f"    L{L}: 中央値 {round(statistics.median(tt), 2)} 秒・最大 {round(max(tt), 1)} 秒")
    print("\nレベルごとの特徴（10/50/90）: L1 | L2 | L3 | L4 | L5")
    for feat in ("G_lo_f_all_v7", "G_hi_b7_all_v7", "G_hi_b6_all_v7", "Gx_lo_all_all", "Gmin_lo_all_all", "v3_D_lo_all", "n_sure_all_all",
                 "p_all_full", "graph_full", "decision_nodes", "n_real_all_v7", "branch_dec", "root_cands", "R_min", "oracle_nodes", "moves"):
        print(f"  {feat:18s}", " | ".join(str(_q([f.get(feat) for f in lv.get(L, [])])) for L in (1, 2, 3, 4, 5)))
    for L in (2, 3, 4, 5):
        sub = lv.get(L, [])
        nr_all = sum(1 for f in sub if f.get("n_sure_all_all") and f.get("n_noreturn_all_all") == f.get("n_sure_all_all"))
        nr_any = sum(1 for f in sub if (f.get("n_noreturn_all_all") or 0) > 0)
        fs = sum(1 for f in sub if (f.get("n_forced_sure_all_v7") or 0) > 0)
        print(f"  L{L}: すべて後戻りの無い所 {nr_all}/{len(sub)}・1つ以上 {nr_any}/{len(sub)}・置ける手が1つだけの局面の致命の手を含む {fs}/{len(sub)}")
    uc = collections.Counter()
    for f in win:
        if A(f) == ("out-of-range", "unlisted-combination"):
            uc[(f.get("T_all_full"), g_stage_v7(f, "all")[1])] += 1
    print("組に当たらない:", dict(uc))
    # 定義の範囲の感度（版7 の L2〜L5 で変わる数）
    print("\n感度（版7 (a) の L2〜L5 で変わる数）:")
    sens = {}
    for fam in ("bend", "bns", "Gx", "Gy", "Gmin", "Galt"):
        sens[f"量の組 {fam}"] = lambda f, fam=fam: (classify_v7(f, fam=fam) if (fam != "bend" or f.get("G_hi_bend_all_v7") is not None) else A(f))
    for pk in ("natlab", "dead", "alive"):
        sens[f"札 {pk}"] = lambda f, pk=pk: (classify_v7(f, play_key=pk) if f.get(f"n_poss_f_{pk}_v7") is not None else A(f))
    for nm, fn in sens.items():
        print(f"  {nm}:", _changed(win, A, fn), dict(collections.Counter((_lvtext(A(f)), _lvtext(fn(f))) for f in win
                                                                         if A(f)[0] == "classified" and A(f)[1] >= 2 and fn(f) != A(f))))
    nb = sum(1 for f in win if A(f)[0] == "classified" and A(f)[1] >= 2 and f.get("G_hi_bend_all_v7") is None)
    print("  （bend は網が5万節点を超える問題で求めていない:", nb, "件は版7 の値のまま数えた）")
    for pol in ("fnd_first", "class_prio", "eager"):
        same = [f for f in win if f.get(f"T_pol_{pol}") == f.get("T_all_full") and A(f)[0] == "classified" and A(f)[1] >= 2]
        tch = sum(1 for f in win if A(f)[0] == "classified" and A(f)[1] >= 2 and f.get(f"T_pol_{pol}") != f.get("T_all_full"))
        gch = sum(1 for f in same if classify_v7(f, play_key=f"pol_{pol}") != A(f))
        print(f"  網を {pol} に絞る: 段が変わる {tch}・段が同じ {len(same)} 件のうち G の段が変わる {gch}")
    keep1 = keep2 = n = 0
    for f in win:
        c = A(f)
        if c[0] != "classified" or c[1] < 2:
            continue
        n += 1
        ok = {1: True, 2: True}
        for dlt in (1, 2):
            for sgn in (-1, 1):
                g2 = dict(f)
                for play in ("all", "safe"):
                    for k in ("G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7"):
                        if g2.get(f"{k}_{play}_v7") is not None:
                            g2[f"{k}_{play}_v7"] = g2[f"{k}_{play}_v7"] + sgn * dlt
                if A(g2) != c:
                    ok[dlt] = False
        keep1 += ok[1]
        keep2 += ok[2]
    print(f"G を ±1 動かしても変わらない {keep1}/{n}・±2 で {keep2}/{n}")
    for nm in ("d1v5", "policy5", "movevar5"):
        path = os.path.join(cache_dir, f"{nm}_{prefix}.jsonl")
        if not os.path.exists(path):
            continue
        R = _load_jsonl(path)
        print(f"== {nm}（版7 のレベル）")
        for L in (1, 2, 3, 4, 5):
            sub = [R[f["seed"]] for f in lv.get(L, []) if f["seed"] in R]
            miss = [f["seed"] for f in lv.get(L, []) if f["seed"] not in R]
            if nm == "d1v5" and sub:
                r1 = [r["push"] for r in sub]
                r2 = [r["push_full"] for r in sub]
                print(f"  L{L} {len(sub)}（無い {miss}）: {_q(r1)}・0.5以上 {sum(1 for r in r1 if r >= 0.5)}／すべての手 {_q(r2)}・0.5以上 {sum(1 for r in r2 if r >= 0.5)}")
            elif nm == "policy5" and L in (2, 3):
                print(f"  L{L} {len(sub)}（無い {miss}）:", {p_: {str(t_): sum(1 for r in sub if r.get(p_) == t_) for t_ in (1, 2, 3)} for p_ in POLICIES})
            elif nm == "movevar5" and L in (1, 4, 5):
                print(f"  L{L} {len(sub)}（無い {miss}）:", {k: dict(sorted(((str(x), sum(1 for r in sub if r.get(k) == x)) for x in {r.get(k) for r in sub}))) for k in MOVEVAR})
        if nm == "split5":
            pass
    sp = os.path.join(cache_dir, f"split5_{prefix}.jsonl")
    if os.path.exists(sp):
        R = _load_jsonl(sp)
        ch = tot = 0
        for f in win:
            c = A(f)
            r = R.get(f["seed"])
            if c[0] != "classified" or not r or not r.get("split_complete") or "error" in r:
                continue
            tot += 1
            g2 = dict(f)
            for play, key in (("all", "split_all"), ("safe", "split_safe")):
                g2[f"G_hi_f_{play}_v7"] = r[key].get("G_hi")
                g2[f"G_lo_f_{play}_v7"] = max([x for x in (r[key].get("G_lo"), f.get(f"G_lo_f_{play}_v7")) if x is not None], default=None)
                g2[f"n_poss_f_{play}_v7"] = r[key].get("n_poss")
            g2["T_all_full"] = r["split_all"]["T"]
            ch += A(g2) != c
        print(f"PF の2手化（split5 の G_f を規則の1手の端に使う）: 版7 の L1〜L5 のうち split5 にある {tot} 件で変わる {ch}")
    un = sorted((f.get("graph_sec", 0) + f.get("trap_sec", 0), f["seed"]) for f in win if A(f) == ("unsupported", "oracle-unresolved"))
    print("評価不能（軽い順）:", ",".join(str(s_) for _, s_ in un))


def _notify7_worker(args):
    """確かめ用（版7）: 数え終わりを「知らせが出る所」にしたときの、規則の1手の端と本当の選ぶ所の端の G の幅。

    詰み e ごとの R(e)（どれかの規則の手順で行ける組札の最大。知らせが出る e では e の組札）は _notify5_worker と同じ。
    """
    seed, kw = args
    t0 = time.time()
    try:
        tab, stock = deal(seed)
        g = natural_graph(tab, stock)
        nodes = g["nodes"]
        oracle = AliveOracle(kw.get("oracle_limit", 40_000), kw.get("oracle_budget", 2_000_000), cache_unknown=True, bc=True)
        order, label, stuck, _ = label_graph(g, oracle)
        lim = kw.get("limit", 200_000)
        rlim = kw.get("rlimit", 50_000)
        R = {}

        def lab(c):
            if c == WIN:
                return True
            if c in nodes:
                return label.get(c, False)
            return stuck.get(c[1], False)

        def r_of(e):
            if e in R:
                return R[e]
            es = _reader_state(e)
            fp, n = foundation_progress_reachable(es[0], es[1], es[2], lim)
            base = sum(e[1])
            if fp is False:
                lo, hi = base, base
            else:
                best, done, n2 = max_foundation_reachable(es[0], es[1], es[2], rlim)
                lo, hi = best, (best if done else 51)
            R[e] = (lo, hi, fp)
            return R[e]

        row = {"seed": seed}
        for play, gg in (("all", g), ("safe", restrict_safe_all(g))):
            nd = gg["nodes"]
            oo = order if play == "all" else _topo_order(gg)
            starts = []
            for v in oo:
                if label.get(v, False) is False:
                    continue
                for _, c in nd[v]:
                    if lab(c) is not True:
                        starts.append(c)
            rel = _relevant_from(nd, starts)
            mlo, mhi = {}, {}
            for v in reversed(oo):
                if v not in rel:
                    continue
                a = b = None
                for _, c in nd[v]:
                    if c == WIN:
                        x = y = 52
                    elif c in nd:
                        x, y = mlo[c], mhi[c]
                    else:
                        x, y = r_of(c[1])[:2]
                    a = x if a is None else min(a, x)
                    b = y if b is None else min(b, y)
                mlo[v], mhi[v] = a, b

            def ends_of(c):
                if c in nd:
                    return mlo[c], mhi[c]
                return r_of(c[1])[:2]

            fs, fp_ = [], []
            for v in oo:
                lv = label.get(v, False)
                if lv is False:
                    continue
                f0 = sum(v[1])
                for _, c in nd[v]:
                    lc = lab(c)
                    if lc is True:
                        continue
                    lo_, hi_ = ends_of(c)
                    if lv is True and lc is False:
                        fs.append(lo_ - f0)
                    fp_.append(hi_ - f0)
            real, dest = real_choices(gg, oo)
            if gg["root"] in nd:
                real.add(gg["root"])
            bs, bp = [], []
            for d in oo:
                if d not in real:
                    continue
                lv = label.get(d, False)
                if lv is False:
                    continue
                f0 = sum(d[1])
                for D in {(c if (c == WIN or c not in nd) else dest[c]) for _, c in nd[d]}:
                    lc = lab(D)
                    if lc is True:
                        continue
                    lo_, hi_ = ends_of(D)
                    if lv is True and lc is False:
                        bs.append(lo_ - f0)
                    bp.append(hi_ - f0)
            row[f"n_poss_f_{play}_v7"] = len(fp_)
            row[f"G_lo_f_{play}_v7"] = max(fs, default=None)
            row[f"G_hi_f_{play}_v7"] = max(fp_, default=None)
            row[f"G_lo_b7_{play}_v7"] = max(bs, default=None)
            row[f"G_hi_b7_{play}_v7"] = max(bp, default=None)
        vals = list(R.values())
        row["ends"] = len(vals)
        row["ends_progress"] = sum(1 for x in vals if x[2] is True)
        row["ends_undecided"] = sum(1 for x in vals if x[2] is None)
        row["ends_r_cut"] = sum(1 for x in vals if x[1] == 51 and x[0] < 51)
        row["sec"] = round(time.time() - t0, 2)
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def notify_end_v7(cache_dir, out_path, prefix="random", procs=4, big=""):
    """確かめ用（版7）: (a) の L2〜L5 で、数え終わりを知らせが出る所にすると分類がどう変わるか（両端とも延ばす）。

    下端: 知らせまでで数えた G は、致命の手・致命の選びごとに素朴な詰みで数えた G 以上なので（資料 §3.9）、問題の値の下端には
    _notify7_worker の確かな致命の手・選びから求めた値と、素朴な詰みで数えた下端（G_lo_f は鎖からの下限を含む）の大きい方を使う。
    big に上限5倍の出力を渡すと、その行で分類したうえで、置き換えた問題は上限5倍の読むモデルで求める。
    """
    import collections
    rows = load_v7(cache_dir, prefix, big)
    byseed = {f["seed"]: f for f in rows}
    lv = {f["seed"]: classify_v7(f) for f in rows}
    bigset = set(_load_jsonl(os.path.join(cache_dir, big))) if big else set()
    seeds = sorted(s_ for s_, c in lv.items() if c[0] == "classified" and c[1] >= 2)
    run_jobs(_notify7_worker, [s_ for s_ in seeds if s_ not in bigset], out_path, procs)
    if bigset:
        run_jobs(_notify7_worker, [s_ for s_ in seeds if s_ in bigset], out_path, procs, oracle_limit=200_000, oracle_budget=10_000_000)
    res = _load_jsonl(out_path)
    ch = collections.Counter()
    ex = []
    tot = collections.Counter()
    for s_ in seeds:
        r = res.get(s_)
        if not r or "error" in r:
            continue
        g2 = dict(byseed[s_])
        for k, v in r.items():
            if k.endswith("_v7"):
                g2[k] = v
        for play in ("all", "safe"):
            for k in ("G_lo_f", "G_lo_b7"):
                key = f"{k}_{play}_v7"
                xs = [x for x in (r.get(key), byseed[s_].get(key)) if x is not None]
                g2[key] = max(xs, default=None)
        new = classify_v7(g2)
        tot["n"] += 1
        for k in ("ends", "ends_progress", "ends_undecided", "ends_r_cut"):
            tot[k] += r[k]
        if new != lv[s_]:
            ch[(_lvtext(lv[s_]), _lvtext(new))] += 1
            ex.append((s_, _lvtext(lv[s_]), _lvtext(new), [g2.get(f"{k}_all_v7") for k in ("G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7")]))
    print(f"L2〜L5 {tot['n']} 件のうち分類が変わる {sum(ch.values())}:", dict(ch))
    for x in ex:
        print("  ", x)
    print("致命の手の先の詰み:", tot["ends"], "・知らせが出ない", tot["ends_progress"], "・決まらない", tot["ends_undecided"], "・R(e) の打ち切り", tot["ends_r_cut"])


def _v7sens_worker(args):
    """確かめ用（版7）: 素朴な手の変種（noE・noPF・basic）の網での段と、その網の本当の選ぶ所で求めた両端の G の幅。

    札は素朴な手すべての網で付け、変種の網で足りない札を問い合わせる（_v4sens_worker と同じ）。
    """
    seed, kw = args
    t0 = time.time()
    try:
        tab, stock = deal(seed)
        graphs = {name: natural_graph(tab, stock, var["empty"], var["pf"]) for name, var in NAT_VARIANTS.items()}
        g = graphs["full"]
        budget = kw.get("oracle_budget", 2_000_000)
        oracle = AliveOracle(kw.get("oracle_limit", 40_000), budget, cache_unknown=True, bc=True)
        _order, label, stuck, _ = label_graph(g, oracle)
        oracle.budget = oracle.used + budget
        row = {"seed": seed}
        for name in ("noE", "noPF", "basic"):
            gv = graphs[name]
            T, _ = natural_class(gv)
            row[f"T_{name}"] = T
            if T in (2, 3):
                o2, l2, s2, c2 = label_graph(gv, oracle, (label, stuck))
                res = fatal_depths_v7(gv, o2, l2, s2, _min_max_fnd(gv, o2), extras=False)
                for k in V7_MAIN:
                    row[f"{k}_{name}_v7"] = res[k]
                row[f"conflicts_{name}"] = c2
        row["sec"] = round(time.time() - t0, 2)
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def sens_v7(cache_dir, out_path, prefix="random", procs=4):
    """確かめ用（版7）: (a) の L2〜L5 で、G を素朴な手の変種の網で求めたときの段と G の段の変わり方（一致は求めない。資料 §3.7）。"""
    rows = load_v7(cache_dir, prefix)
    byseed = {f["seed"]: f for f in rows}
    lv = {f["seed"]: classify_v7(f) for f in rows}
    seeds = sorted(s_ for s_, c in lv.items() if c[0] == "classified" and c[1] >= 2)
    run_jobs(_v7sens_worker, seeds, out_path, procs)
    res = _load_jsonl(out_path)
    for name in ("noE", "noPF", "basic"):
        n = tch = ch = und = 0
        for s_ in seeds:
            r = res.get(s_)
            if not r or "error" in r:
                continue
            n += 1
            if r[f"T_{name}"] != byseed[s_]["T_all_full"]:
                tch += 1
                continue
            g2 = dict(byseed[s_])
            for k in V7_MAIN:
                g2[f"{k}_{name}_v7"] = r.get(f"{k}_{name}_v7")
            new = classify_v7(g2, play_key=name)
            if new != lv[s_]:
                ch += 1
                und += new == ("unsupported", "oracle-unresolved")
        print(f"{name}: {n} 件のうち段が変わる {tch}・段が同じ {n - tch} 件のうち G の段が変わる {ch}（うち決まらない {und}）")
    print("変種の網の札の食い違い:", sum(r.get(f"conflicts_{k}", 0) for r in res.values() for k in ("noE", "noPF", "basic")))


def sens_v4(cache_dir, sens_path, prefix="random", name="v4"):
    """v4sens の結果（変種の網・安全な札の条件を緩めた網・両側に倒した札）での G の段の変わり方。name="v5" で版5。"""
    rows = load_v4(cache_dir, prefix, name)
    res = _load_jsonl(sens_path)
    A = {f["seed"]: classify_v4(f) for f in rows}
    F = {f["seed"]: f for f in rows}

    def cls_from(f, r, T):
        g = dict(f)
        for k in ("n_sure", "n_poss", "G_lo", "G_hi"):
            g[k + "_all_all"] = r.get(k)
        g["T_all_full"] = T
        return classify_v4(g, check_play=False)

    for key in ("twosided_dead", "twosided_alive", "safe_loose", "noE", "noPF", "basic"):
        n = ch = tch = 0
        for s_, r in res.items():
            if "error" in r or key not in r:
                continue
            a = A[s_]
            n += 1
            rr = r[key]
            T = rr.get("T", F[s_]["T_all_full"])
            if T != F[s_]["T_all_full"]:
                tch += 1
                ch += 1
                continue
            if cls_from(F[s_], rr, T) != a:
                ch += 1
        print(f"{key}: 分類が変わる {ch}/{n}（うち段が変わる {tch}）")
    print("変種の網の札の食い違い:", sum(r.get(k, {}).get("conflicts", 0) for r in res.values() for k in ("noE", "noPF", "basic") if isinstance(r.get(k), dict)))


def d1_check_v4(cache_dir, out_path, prefix="random", runs=10, budget=100, procs=4, name="v4"):
    """D1（版4・版5）: 案ごとに、定石つき＋待ったの押し切り率をレベル別に出す（分類には使わない）。

    定石つきの解き方は savvy_undo（Solver の手。BC を含まない版4 までの読むモデルの手）で、押し切り率は配り方だけで決まる。
    """
    rows = load_v4(cache_dir, prefix, name)
    win = [f for f in rows if f["status"] == "win"]
    sets = {pname: {f["seed"]: fn(f) for f in win} for pname, fn in plans_v4("none").items()}
    seeds = sorted({s_ for m in sets.values() for s_, v in m.items() if v[0] == "classified"})
    run_jobs(_d1_worker, seeds, out_path, procs, runs=runs, budget=budget)
    res = _load_jsonl(out_path)
    for name, m in sets.items():
        print(f"== {name}")
        for L in (1, 2, 3, 4, 5):
            sub = [res[s_] for s_, v in m.items() if v == ("classified", L) and s_ in res]
            r1 = [r["push"] for r in sub]
            r2 = [r["push_full"] for r in sub]
            print(f"  L{L} 件数 {len(sub)}: 押し切り率 10/50/90 {_q(r1)}・0.5以上 {sum(1 for r in r1 if r >= 0.5)}"
                  f"／ すべての手 {_q(r2)}・0.5以上 {sum(1 for r in r2 if r >= 0.5)}")


def level_check_v4(cache_dir, out_path, kind, prefix="random", procs=4, limit=200_000, name="v4"):
    """版4・版5 のレベルに、優先順位の段の確かめ（kind="policy"、L2・L3）か手を足す確かめ（kind="movevar"、L1・L4・L5）を当てる。"""
    rows = load_v4(cache_dir, prefix, name)
    lv = {}
    T = {}
    for f in rows:
        st, v = classify_v4(f)
        if st == "classified" and (v in (2, 3) if kind == "policy" else v in (1, 4, 5)):
            lv[f["seed"]] = v
            T[str(f["seed"])] = f["T_all_full"]
    if kind == "policy":
        run_jobs(_policy3_worker, sorted(lv), out_path, procs, rule="none")
        res = _load_jsonl(out_path)
        for L in (2, 3):
            sub = [res[s_] for s_ in lv if lv[s_] == L and s_ in res]
            print(f"L{L} 件数 {len(sub)}:", {p: {str(t): sum(1 for r in sub if r[p] == t) for t in (1, 2, 3)} for p in POLICIES})
    else:
        run_jobs(_movevar_worker, sorted(lv), out_path, procs, T=T, limit=limit)
        res = _load_jsonl(out_path)
        for L in (1, 4, 5):
            sub = [res[s_] for s_ in lv if lv[s_] == L and s_ in res]
            print(f"L{L} 件数 {len(sub)}:", {k: dict(sorted(((str(x), sum(1 for r in sub if r.get(k) == x)) for x in {r.get(k) for r in sub}))) for k in MOVEVAR})


def write_expected_v4(seeds, out_path, bc=False, v6=False, v7=False):
    """移植の期待値（版4。bc=True で版5、v6=True で版6、v7=True で版7）。乱数を使わない量だけを書く。分類は2つのルール（安全な札の自動送りなし / あり）の両方。"""
    items = []
    for seed in seeds:
        t0 = time.time()
        tab, stock = deal(seed)
        sv = survey_one(seed)
        f = {"status": sv["status"], "tier": sv.get("tier")}
        if sv["status"] == "win":
            f.update(features_v4(seed, bc=bc, grouping=v6 or v7, v7=v7))
        cls = classify_v7 if v7 else (classify_v6 if v6 else classify_v4)
        item = {
            "seed": seed,
            "deal": deal_text(tab, stock),
            "deal_cards": {"columns": [list(c) for c in tab], "stock": list(stock)},
            "solver": {"limits": SPACE_LIMIT, "spaces": sv["spaces"], "status": sv["status"]},
            "assessment": {rule: dict(zip(("state", "value"), cls(f, rule=rule))) for rule in ("none", "safe")},
        }
        if sv["status"] == "win":
            item["natural"] = {k: f.get(k) for k in sorted(f) if k.startswith(("T_", "p_", "graph_", "R_")) and not k.endswith("_sec")}
            item["natural"].update({k: f.get(k) for k in ("decision_nodes", "branch_dec", "root_cands")})
            heads = ("n", "G", "Gx", "Gmin", "v3") + (("Gy", "Galt") if v7 else ())
            item["fatal"] = {k: f.get(k) for k in sorted(f) if k.split("_")[0] in heads}
            item["fatal"].update({k: f.get(k) for k in ("unknown_full", "label_conflicts_full", "oracle_queries", "oracle_nodes", "oracle_unknown")})
            item["fatal"]["oracle_limit"] = 40_000
            item["fatal"]["oracle_budget"] = 2_000_000
        item["sec"] = round(time.time() - t0, 2)
        items.append(item)
        print(seed, item["assessment"], item["sec"], flush=True)
    ver = "版5（版4 と同じ定義を、規則の手をすべて使う読むモデル（組札の一番上を足場の上へ戻す手 BC を足した解法器）で求めたもの）" if bc else "版4"
    if v6:
        ver = "版6（版5 の G を、1手の区切り方の両端（規則の1手 / 選びとその後の強制手）で求め、両端の段がそろう問題だけを分類するもの）"
    if v7:
        ver = "版7（1手の区切り方の両端のうち、まとめる側を本当の選ぶ所（手の行き先が違う所）から数え、両端の段がそろう問題だけを分類するもの）"
    doc = {
        "about": f"ソリティア難易度の調査コード solitaire_difficulty.py の、{ver}（段 T × 罠の後の進み G。G は致命の手の後、素朴な解き方で詰むまでに組札が進む枚数で、打ち切りは幅で扱う）の seed ごとの結果。検査 F2 で移植したコードと突き合わせる。",
        "rules": "52枚・7列（1〜7枚）、列は全部表、山札24枚は1枚ずつ何周でも。deal(seed) は Python の random.Random(seed).shuffle で並べ、列 i に i+1 枚、残りが山札（stock[0] が次にめくる札）。札の番号は suit*13+rank-1（S,H,D,C）",
        "thresholds": {"G_SHORT": G_SHORT, "G_LONG": G_LONG_V7 if v7 else (G_LONG_V6 if v6 else G_LONG)},
        "notes": [
            ("分類は classify_v7（版7）。" if v7 else ("分類は classify_v6（版6）。" if v6 else "分類は classify_v4。")) + "assessment.none が採用形（組札への自動送りなし。安全な札をすぐ送る網でも G の段が同じことを求める）、assessment.safe は安全な札を自動で組札へ送るルール（比べる用）",
            "段 1 と段 3 は、natural.T_<遊び方>_full・_noE・_noPF・_basic がすべて同じ段のときだけ使う",
            "fatal の鍵は <量>_<遊び方>_<数え方>。遊び方 all は素朴な手すべての網、safe は安全な札をすぐ送る網。数え方 all が採用形（致命の手すべて）、alt は比べる用",
            "G_lo と G_hi は打ち切りのあらゆる札付けの上の幅。n_sure が確かな致命の手、n_poss があり得る致命の手の数",
            "_pol_<名前> は優先順位で絞った網、_natlab は「解ける」を素朴な解き方で勝てるかにしたもの、v3_ は版3 の D（どれも比べる用）",
            "乱数を使う量は無い。移植では deal_cards から同じ盤面を作って比べる（deal の乱数は Python の random に依る）",
        ] + ([
            "_grp の鍵（版6）: G_lo_f・G_hi_f は規則の1手で区切った G の幅（下端は確かな致命の選びの鎖からの下限も使う）、G_lo_b・G_hi_b は選びとその後の強制手を1手にまとめた G の幅、"
            "n_sure_f・n_poss_f・n_sure_b・n_poss_b はそれぞれの確かな・あり得る致命の手の数、G_chainlb は鎖からの下限の最大、n_forced_sure は置ける手が1つだけの局面の確かな致命の手の数",
        ] if v6 or v7 else []) + ([
            "_v7 の鍵（版7）: <量>_<遊び方>_v7。G_lo_f・G_hi_f は規則の1手の端（_grp と同じ）、G_lo_b7・G_hi_b7 は本当の選ぶ所（手の行き先が違う所）から数えた端、"
            "G_lo_b6・G_hi_b6 は版6 の選ぶ所から数えた端。遊び方 safe は restrict_safe_all（安全な組札送りをどの順でも打てる網）、safe1 は restrict_safe（比べる用）。"
            "Gx・Gy・Gmin・Galt・bend・bns・natlab・dead・alive・pol_<名前> は比べる用（資料 §3.9）。T_safeall_full は restrict_safe_all の網の段",
        ] if v7 else []),
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def symmetry_check_v4(seeds, bc=False, grouping=False, v7=False):
    """確かめ用: マークの入れ替えと列の並べ替えで、版4 の特徴（時間と問い合わせの量を除く）が変わらないか。bc・grouping は版5・版6。"""
    skip = ("_sec", "oracle_")
    diff = []
    for seed in seeds:
        tab, stock = deal(seed)
        a = features_v4(seed, bc=bc, grouping=grouping, v7=v7)
        b = features_v4(seed, deal_override=suit_swap(tab, stock), bc=bc, grouping=grouping, v7=v7)
        c = features_v4(seed, deal_override=(tuple(reversed(tab)), stock), bc=bc, grouping=grouping, v7=v7)
        for k in a:
            if k == "seed" or any(x in k for x in skip):
                continue
            if not (a.get(k) == b.get(k) == c.get(k)):
                diff.append((seed, k, a.get(k), b.get(k), c.get(k)))
    return diff


def _split_candidates(tab, fnd, waste):
    return [("PT",) + m[1:] if m[0] == "PF" else m for m in nat_candidates(tab, fnd, waste, True, True)]


def _split_advance(state):
    """_nat_canon_advance と同じだが、PF を PT（並びの途中から上を動かすだけ）に替えた手で、置ける手が出るまでめくる。"""
    tab, fnd, stock_rev, waste = state
    flips = 0
    while True:
        if fnd == (13, 13, 13, 13):
            return (tab, fnd, stock_rev, waste), "win"
        if _split_candidates(tab, fnd, waste):
            st = (tuple(sorted(tab)), fnd, stock_rev, waste)
            return st, _split_candidates(st[0], fnd, waste)
        total = len(stock_rev) + len(waste)
        if total == 0 or flips > total + 1:
            return (tuple(sorted(tab)), fnd, stock_rev, waste), None
        if stock_rev:
            waste = waste + (stock_rev[-1],)
            stock_rev = stock_rev[:-1]
        else:
            stock_rev = tuple(reversed(waste))
            waste = ()
        flips += 1


def natural_graph_split(tab0, stock0, limit=400_000):
    """確かめ用（版4）: PF を「並びの途中から上を動かす」（PT）と「出た札を組札へ」（TF）の2手に分けた網。

    間の局面ではどの素朴な手も打てる（出た札をすぐ組札へ送らなくてよい）。並びを往復できるので輪ができ得る。
    """
    s0, c0 = _split_advance((tuple(tab0), (0, 0, 0, 0), tuple(reversed(stock0)), ()))
    if c0 == "win":
        return {"root": WIN, "nodes": {}, "complete": True}
    if c0 is None:
        return {"root": ("STUCK", s0), "nodes": {}, "complete": True}
    nodes = {}
    stack = [(s0, c0)]
    pending = {s0: c0}
    complete = True
    while stack:
        st, cs = stack.pop()
        if st in nodes:
            continue
        ch = []
        got = set()
        for mv in cs:
            s2, c2 = _split_advance(_nat_apply(mv, st))
            if c2 == "win":
                child = WIN
            elif c2 is None:
                child = ("STUCK", s2)
            else:
                child = s2
                if s2 not in nodes and s2 not in pending:
                    pending[s2] = c2
                    stack.append((s2, c2))
            if child in got:
                continue
            got.add(child)
            ch.append((mv, child))
        nodes[st] = ch
        if len(nodes) > limit:
            complete = False
            break
    return {"root": s0, "nodes": nodes, "complete": complete}


def _scc(nodes, root):
    """根から行ける節点の強連結成分（Tarjan、再帰なし）。戻り値: (comp: 節点→番号, comps: 成分の列。子の成分が先)。"""
    index, low, onstack, st, comp, comps = {}, {}, set(), [], {}, []
    if root not in nodes:
        return comp, comps
    counter = 0
    index[root] = low[root] = counter
    counter += 1
    st.append(root)
    onstack.add(root)
    work = [(root, 0)]
    while work:
        v, i = work.pop()
        ch = nodes[v]
        if i < len(ch):
            work.append((v, i + 1))
            c = ch[i][1]
            if c not in nodes:
                continue
            if c not in index:
                index[c] = low[c] = counter
                counter += 1
                st.append(c)
                onstack.add(c)
                work.append((c, 0))
            elif c in onstack:
                low[v] = min(low[v], index[c])
        else:
            if low[v] == index[v]:
                members = []
                while True:
                    w = st.pop()
                    onstack.discard(w)
                    comp[w] = len(comps)
                    members.append(w)
                    if w == v:
                        break
                comps.append(members)
            if work:
                u = work[-1][0]
                low[u] = min(low[u], low[v])
    return comp, comps


def fatal_depths_cyclic(g, oracle, known=None):
    """輪のある網でも使える段 T と、致命の手の G の幅（版4 の fatal_depths と同じ定義。確かめ用）。

    札: 根から、解ける・打ち切りの節点の子に問い合わせ、解ける子を持つ節点は解ける・解けない節点の子は解けない、を動かなくなるまで繰り返す。
    組札の枚数の最小・最大は、強連結成分を縮めて求める（素朴な手は組札を減らさないので、輪の中の局面は組札の枚数が同じ）。
    抜け出せない輪は、その組札の枚数で詰む終わりとして扱う。
    """
    nodes = g["nodes"]
    root = g["root"]
    out = {}
    if root not in nodes:
        out["T"] = 1 if root == WIN else 3
        return out, None
    comp, comps = _scc(nodes, root)
    mn, mx, haswin, hasstuck = [], [], [], []
    for ci, members in enumerate(comps):
        a = b = None
        w = s_ = False
        for v in members:
            for _, c in nodes[v]:
                if c == WIN:
                    x = y = 52
                    w = True
                elif c in nodes:
                    cc = comp[c]
                    if cc == ci:
                        continue
                    x, y = mn[cc], mx[cc]
                    w = w or haswin[cc]
                    s_ = s_ or hasstuck[cc]
                else:
                    x = y = sum(c[1][1])
                    s_ = True
                a = x if a is None else min(a, x)
                b = y if b is None else max(b, y)
        if a is None:
            a = b = sum(members[0][1])
            s_ = True
        mn.append(a)
        mx.append(b)
        haswin.append(w)
        hasstuck.append(s_)
    r = comp[root]
    out["T"] = 1 if not hasstuck[r] else (3 if not haswin[r] else 2)
    out["graph"] = len(comp)
    out["cycle"] = any(len(m) > 1 for m in comps)
    if out["T"] == 1:
        return out, None
    kl, ks = known if known else ({}, {})
    anywin = {v: haswin[comp[v]] for v in comp}
    label = {root: True}
    stuck = {}
    seen = {root}
    q = [root]
    while q:
        v = q.pop()
        if label.get(v) is False:
            continue
        for _, c in nodes[v]:
            if c == WIN:
                continue
            if c in nodes:
                if c not in label:
                    label[c] = True if anywin[c] else (kl[c] if c in kl else oracle.query(*_reader_state(c)))
                if c not in seen:
                    seen.add(c)
                    q.append(c)
            else:
                k = c[1]
                if k not in stuck:
                    stuck[k] = ks[k] if k in ks else oracle.query(*_reader_state(k))
    for v in comp:
        if v not in label:
            label[v] = False
    changed = True
    while changed:
        changed = False
        for v in comp:
            if label[v] is None and any(c == WIN or (c in nodes and label[c] is True) or (c not in nodes and stuck.get(c[1]) is True)
                                        for _, c in nodes[v]):
                label[v] = True
                changed = True
    conflicts = 0
    changed = True
    while changed:
        changed = False
        for v in comp:
            if label[v] is False:
                for _, c in nodes[v]:
                    if c == WIN:
                        continue
                    if c in nodes:
                        if label[c] is None:
                            label[c] = False
                            changed = True
                    elif stuck.get(c[1]) is None:
                        stuck[c[1]] = False
    for v in comp:
        if label[v] is False:
            for _, c in nodes[v]:
                if c == WIN or (c in nodes and label[c] is True) or (c not in nodes and stuck.get(c[1]) is True):
                    conflicts += 1
    out["conflicts"] = conflicts

    def lab(c):
        if c == WIN:
            return True
        if c in nodes:
            return label.get(c, False)
        return stuck.get(c[1], False)

    def ends(c):
        if c == WIN:
            return 52, 52
        if c in nodes:
            return mn[comp[c]], mx[comp[c]]
        s_ = sum(c[1][1])
        return s_, s_

    sure, poss = [], []
    for v in comp:
        lv = label[v]
        if lv is False:
            continue
        f0 = sum(v[1])
        for _, c in nodes[v]:
            lc = lab(c)
            if lc is True:
                continue
            a, b = ends(c)
            if lv is True and lc is False:
                sure.append(a - f0)
            poss.append(a - f0)
    out.update({"n_sure": len(sure), "n_poss": len(poss), "G_lo": max(sure) if sure else None, "G_hi": max(poss) if poss else None})
    return out, (label, stuck)


def restrict_safe_last(g):
    """restrict_safe と同じだが、安全な組札送りが2つ以上あるとき最後の1つを残す（同点の選び方の確かめ）。"""
    nodes = g["nodes"]
    out = {}
    for v, ch in nodes.items():
        keep = None
        for mv, c in ch:
            if is_safe_fnd_move(mv, v):
                keep = [(mv, c)]
        out[v] = keep if keep else ch
    return {"root": g["root"], "nodes": out, "complete": g["complete"]}


def _split4_worker(args):
    """確かめ用（版4）: PF の2手化（間でどの素朴な手も打てる）・安全な組札送りの同点の選び方で、段 T と G の幅が変わるか。"""
    seed, kw = args
    t0 = time.time()
    try:
        tab, stock = deal(seed)
        oracle = AliveOracle(40_000, 2_000_000, cache_unknown=True, bc=kw.get("bc", False))
        g = natural_graph(tab, stock)
        row = {"seed": seed}
        # 輪のある網用の計算が、元の網で fatal_depths と同じ値になることを確かめる
        base, kn = fatal_depths_cyclic(g, oracle)
        for play, gg in (("all", g), ("safe", restrict_safe(g)), ("safe_last", restrict_safe_last(g))):
            r, _ = fatal_depths_cyclic(gg, oracle, kn) if kn else fatal_depths_cyclic(gg, oracle)
            row[f"base_{play}"] = r
        gs = natural_graph_split(tab, stock, kw.get("limit", 400_000))
        row["split_complete"] = gs["complete"]
        if gs["complete"]:
            oracle.budget = oracle.used + 2_000_000
            for play, gg in (("all", gs), ("safe", restrict_safe(gs))):
                r, _ = fatal_depths_cyclic(gg, oracle, kn)
                row[f"split_{play}"] = r
        row["sec"] = round(time.time() - t0, 2)
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def split_check_v4(cache_dir, out_path, prefix="random", procs=4, skip=(), limit=400_000, name="v4", bc=False):
    """確かめ用（版4）: (a) の L1〜L5 に、PF の2手化と安全な組札送りの同点の選び方を当てて、分類が変わるかを数える。"""
    rows = load_v4(cache_dir, prefix, name)
    byseed = {f["seed"]: f for f in rows}
    lv = {}
    for f in rows:
        st, v = classify_v4(f)
        if st == "classified":
            lv[f["seed"]] = v
    run_jobs(_split4_worker, sorted(s_ for s_ in lv if s_ not in skip), out_path, procs, limit=limit, bc=bc)
    res = _load_jsonl(out_path)
    keys = ("n_sure", "n_poss", "G_lo", "G_hi")
    bad_base = []
    out = {"base_same": 0, "base_diff": 0}
    cnt = {"split": [], "safe_last": []}
    cyc = 0
    for s_, r in sorted(res.items(), key=lambda x: int(x[0])):
        s_ = int(s_)
        if "error" in r or s_ not in lv:
            continue
        f = byseed[s_]
        same = r["base_all"]["T"] == f["T_all_full"] and r["base_safe"]["T"] == f["T_safe_full"] and all(
            r["base_all"].get(k) == f.get(f"{k}_all_all") and r["base_safe"].get(k) == f.get(f"{k}_safe_all") for k in keys
            if r["base_all"]["T"] != 1)
        out["base_same" if same else "base_diff"] += 1
        if not same:
            bad_base.append(s_)
        g2 = dict(f)
        for k in keys:
            g2[f"{k}_safe_all"] = r["base_safe_last"].get(k)
        g2["T_safe_full"] = r["base_safe_last"]["T"]
        new = classify_v4(g2)
        cnt["safe_last"].append((s_, ("classified", lv[s_]), new))
        if r.get("split_complete"):
            cyc += bool(r["split_all"].get("cycle"))
            g3 = dict(f)
            g3["T_all_full"] = r["split_all"]["T"]
            g3["T_safe_full"] = r["split_safe"]["T"]
            for k in keys:
                g3[f"{k}_all_all"] = r["split_all"].get(k)
                g3[f"{k}_safe_all"] = r["split_safe"].get(k)
            new = classify_v4(g3)
            cnt["split"].append((s_, ("classified", lv[s_]), new, (f.get("G_lo_all_all"), f.get("G_hi_all_all")),
                                 (r["split_all"].get("G_lo"), r["split_all"].get("G_hi")), r["split_all"].get("conflicts")))
        else:
            cnt["split"].append((s_, ("classified", lv[s_]), ("unsupported", "natural-graph-too-large"), None, None, None))
    print("輪のある網用の計算と fatal_depths の一致:", out, "違う seed:", bad_base[:20])
    for name, xs in cnt.items():
        ch = [x for x in xs if x[1] != x[2]]
        print(f"== {name}: 件数 {len(xs)}・分類が変わる {len(ch)}")
        for x in ch:
            print("  ", x)
    sp = [x for x in cnt["split"] if x[3] is not None]
    print("2手化で輪ができた網:", cyc, "/", len(sp))
    print("2手化で G の幅が変わった:", sum(1 for x in sp if x[3] != x[4]), "・食い違い:", sum(x[5] or 0 for x in sp))
    for x in sp:
        if x[3] != x[4]:
            print("   G", x[0], x[3], "->", x[4], x[1], "->", x[2])


def _v4base_worker(args):
    """確かめ用（版4）: G を致命の手の後の局面 y の組札の枚数から数えたとき（比べる用）。"""
    seed, kw = args
    try:
        tab, stock = deal(seed)
        g = natural_graph(tab, stock)
        oracle = AliveOracle(40_000, 2_000_000, cache_unknown=True, bc=kw.get("bc", False))
        order, label, stuck, _ = label_graph(g, oracle)
        row = {"seed": seed}
        for play, gg in (("all", g), ("safe", restrict_safe(g))):
            o2 = order if play == "all" else _topo_order(gg)
            row[f"x_{play}"] = fatal_depths(gg, o2, label, stuck, "all")
            row[f"y_{play}"] = fatal_depths(gg, o2, label, stuck, "all", base="y")
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def base_check_v4(cache_dir, out_path, prefix="random", procs=4, name="v4", bc=False):
    """確かめ用（版4）: (a) の L2〜L5 で、G を y から数えると分類が変わるか。x から数えた値がキャッシュと同じことも確かめる。"""
    rows = load_v4(cache_dir, prefix, name)
    byseed = {f["seed"]: f for f in rows}
    lv = {f["seed"]: classify_v4(f) for f in rows}
    seeds = sorted(s_ for s_, c in lv.items() if c[0] == "classified" and c[1] >= 2)
    run_jobs(_v4base_worker, seeds, out_path, procs, bc=bc)
    res = _load_jsonl(out_path)
    keys = ("n_sure", "n_poss", "G_lo", "G_hi")
    same_x = 0
    ch = []
    for s_ in seeds:
        r = res.get(str(s_)) or res.get(s_)
        if not r or "error" in r:
            continue
        f = byseed[s_]
        same_x += all(r[f"x_{p}"].get(k) == f.get(f"{k}_{p}_all") for p in ("all", "safe") for k in keys)
        g2 = dict(f)
        for p in ("all", "safe"):
            for k in keys:
                g2[f"{k}_{p}_all"] = r[f"y_{p}"].get(k)
        new = classify_v4(g2)
        if new != lv[s_]:
            ch.append((s_, lv[s_], new, f.get("G_lo_all_all"), r["y_all"].get("G_lo")))
    print(f"x から数えた G がキャッシュと同じ: {same_x}/{len(seeds)}")
    print(f"y から数えると分類が変わる: {len(ch)}/{len(seeds)}")
    for x in ch:
        print("  ", x)


# ===========================================================================
# 版5: 版4 に当てた4回目の反例探し（A4）を受けた直し
#
# 1. 読むモデルを、規則の手をすべて使うものに直した（Solver(bc=True)。組札の一番上を山札・組札の札の足場の上へ戻す手 BC）。
#    features_v5 は版4 と同じ定義を bc=True の読むモデルで求める。R1 の確かめ（verify_fatal_dead）も同時に求める。
# 2. G の終わりを「素朴な解き方の詰み」と明記した。知らせが出る所（どの規則の手順でも組札を増やせない所）までで数えた G は、
#    定義の範囲を変えたときの感度として notify_end_v5 で測る。状態の知らせの判定 foundation_progress_reachable も直した。
# ===========================================================================


def _relevant_from(nodes, starts):
    """starts（網の子）から素朴な手で行ける節点の集まり。"""
    seen = set()
    stack = [c for c in starts if c in nodes]
    while stack:
        v = stack.pop()
        if v in seen:
            continue
        seen.add(v)
        for _, c in nodes[v]:
            if c in nodes and c not in seen:
                stack.append(c)
    return seen


def _notify5_worker(args):
    """確かめ用（版5）: G の終わりを「知らせが出る所」へ延ばしたときの G の幅と、致命の手の先の詰みでの知らせの判定の重さ。

    詰み e ごとに、直した foundation_progress_reachable（上限 limit 局面）で知らせが出るかを決め、出ない（組札をまだ増やせる）ときは
    max_foundation_reachable（上限 rlimit 局面）で、どれかの規則の手順で行ける組札の枚数の最大 R(e) を求める（打ち切りは［見つけた最大, 51］）。
    知らせまでの G(x → y) = y から素朴な手で行く詰み e の R(e) の最小 − x の組札の枚数。問題の値は版4 と同じく致命の手の中の最大で、幅で扱う。
    """
    seed, kw = args
    t0 = time.time()
    try:
        tab, stock = deal(seed)
        g = natural_graph(tab, stock)
        nodes = g["nodes"]
        oracle = AliveOracle(40_000, 2_000_000, cache_unknown=True, bc=True)
        order, label, stuck, _ = label_graph(g, oracle)
        lim = kw.get("limit", 200_000)
        rlim = kw.get("rlimit", 50_000)
        R = {}

        def lab(c):
            if c == WIN:
                return True
            if c in nodes:
                return label.get(c, False)
            return stuck.get(c[1], False)

        def r_of(e):
            if e in R:
                return R[e]
            es = _reader_state(e)
            a = time.time()
            fp, n = foundation_progress_reachable(es[0], es[1], es[2], lim)
            base = sum(e[1])
            if fp is False:
                lo, hi = base, base
            else:
                best, done, n2 = max_foundation_reachable(es[0], es[1], es[2], rlim)
                lo, hi = best, (best if done else 51)
                n += n2
            R[e] = (lo, hi, fp, n, round(time.time() - a, 3))
            return R[e]

        row = {"seed": seed}
        for play, gg in (("all", g), ("safe", restrict_safe(g))):
            nd = gg["nodes"]
            oo = order if play == "all" else _topo_order(gg)
            starts = []
            for v in oo:
                if label.get(v, False) is False:
                    continue
                for _, c in nd[v]:
                    if lab(c) is not True:
                        starts.append(c)
            rel = _relevant_from(nd, starts)
            mlo, mhi = {}, {}
            for v in reversed(oo):
                if v not in rel:
                    continue
                a = b = None
                for _, c in nd[v]:
                    if c == WIN:
                        x = y = 52
                    elif c in nd:
                        x, y = mlo[c], mhi[c]
                    else:
                        rr = r_of(c[1])
                        x, y = rr[0], rr[1]
                    a = x if a is None else min(a, x)
                    b = y if b is None else min(b, y)
                mlo[v], mhi[v] = a, b
            sure, poss = [], []
            for v in oo:
                lv = label.get(v, False)
                if lv is False:
                    continue
                f0 = sum(v[1])
                for _, c in nd[v]:
                    lc = lab(c)
                    if lc is True:
                        continue
                    if c in nd:
                        lo_, hi_ = mlo[c], mhi[c]
                    else:
                        rr = r_of(c[1])
                        lo_, hi_ = rr[0], rr[1]
                    if lv is True and lc is False:
                        sure.append((lo_ - f0, hi_ - f0))
                    poss.append((lo_ - f0, hi_ - f0))
            row[f"n_sure_{play}"] = len(sure)
            row[f"n_poss_{play}"] = len(poss)
            row[f"G_lo_{play}"] = max(x[0] for x in sure) if sure else None
            row[f"G_hi_{play}"] = max(x[1] for x in poss) if poss else None
        vals = list(R.values())
        row["ends"] = len(vals)
        row["ends_progress"] = sum(1 for x in vals if x[2] is True)
        row["ends_notify"] = sum(1 for x in vals if x[2] is False)
        row["ends_undecided"] = sum(1 for x in vals if x[2] is None)
        row["ends_r_cut"] = sum(1 for x in vals if x[1] == 51 and x[0] < 51)
        row["gain_max"] = max((x[0] - sum(e[1]) for e, x in R.items()), default=0)
        row["fpr_nodes"] = sorted(x[3] for x in vals)
        row["fpr_secs"] = sorted(x[4] for x in vals)
        row["sec"] = round(time.time() - t0, 2)
        return row
    except Exception as e:  # noqa: BLE001
        import traceback
        return {"seed": seed, "error": repr(e), "tb": traceback.format_exc()[-800:]}


def notify_end_v5(cache_dir, out_path, prefix="random", procs=4, limit=200_000, rlimit=50_000):
    """確かめ用（版5）: (a) の L2〜L5 で、G の終わりを知らせが出る所に延ばすと分類がどう変わるか、致命の手の先の詰みで知らせの判定がどれだけ重いか。"""
    rows = load_v4(cache_dir, prefix, "v5")
    byseed = {f["seed"]: f for f in rows}
    lv = {f["seed"]: classify_v4(f) for f in rows}
    seeds = sorted(s_ for s_, c in lv.items() if c[0] == "classified" and c[1] >= 2)
    run_jobs(_notify5_worker, seeds, out_path, procs, limit=limit, rlimit=rlimit)
    res = _load_jsonl(out_path)
    import collections
    ch = collections.Counter()
    ex = []
    tot = collections.Counter()
    nodes_all, secs_all = [], []
    for s_ in seeds:
        r = res.get(s_)
        if not r or "error" in r:
            continue
        g2 = dict(byseed[s_])
        for play in ("all", "safe"):
            for k in ("n_sure", "n_poss", "G_lo", "G_hi"):
                g2[f"{k}_{play}_all"] = r.get(f"{k}_{play}")
        new = classify_v4(g2)
        tot["n"] += 1
        for k in ("ends", "ends_progress", "ends_notify", "ends_undecided", "ends_r_cut"):
            tot[k] += r[k]
        tot["seeds_with_progress"] += r["ends_progress"] > 0
        nodes_all += r["fpr_nodes"]
        secs_all += r["fpr_secs"]
        if new != lv[s_]:
            ch[(lv[s_][1], new[1] if new[0] == "classified" else new[1])] += 1
            ex.append((s_, lv[s_][1], new, (byseed[s_].get("G_lo_all_all"), byseed[s_].get("G_hi_all_all")), (r.get("G_lo_all"), r.get("G_hi_all"))))
    print(f"L2〜L5 {tot['n']} 件のうち分類が変わる {sum(ch.values())}:", dict(ch))
    for x in ex:
        print("  ", x)
    print("致命の手の先の詰み（素朴な手が尽きた局面。重ねない）:", tot["ends"], "・知らせが出ない（組札をまだ増やせる）", tot["ends_progress"],
          "・知らせが出る", tot["ends_notify"], f"・{limit}局面で決まらない", tot["ends_undecided"], "・R(e) の打ち切り", tot["ends_r_cut"],
          "・知らせが出ない詰みのある問題", tot["seeds_with_progress"])
    nodes_all.sort()
    secs_all.sort()
    if nodes_all:
        print("判定と R(e) の局面数 p50/p90/最大", _q(nodes_all), nodes_all[-1], "秒 p50/p90/最大", _q(secs_all), secs_all[-1])


def notify_compare(cache_dir, prefix="random", n=60, limit=200_000):
    """状態の知らせの判定を、版1〜4 の関数と直した関数で、素朴な解き方（版1 の手の範囲）が詰んだ局面 n 件に当てて比べる。"""
    S_ = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    seeds = [s for s, r in sorted(S_.items()) if r["status"] == "win" and r["naive_rate"] < 1][:n]
    res = {"v1": [], "v5": []}
    for seed in seeds:
        tab, stock = deal(seed)
        rnd = random.Random(seed * 17 + 1)
        r = None
        for _ in range(32):
            r = naive_play(tab, stock, rnd, "random", record=True)
            if not r["win"]:
                break
        if r["win"]:
            continue
        t, f, p = r["path"][-1][1]
        for name, fn in (("v1", foundation_progress_reachable_v1), ("v5", foundation_progress_reachable)):
            a = time.time()
            v, k = fn(t, f, p, limit)
            res[name].append((v, k, time.time() - a))
    for name, xs in res.items():
        cnt = {True: 0, False: 0, None: 0}
        for v, _, _ in xs:
            cnt[v] += 1
        nodes = sorted(x[1] for x in xs)
        secs = sorted(x[2] for x in xs)
        print(name, "詰んだ局面", len(xs), "知らせない（組札を増やせる）", cnt[True], "知らせる", cnt[False], f"決まらない（{limit}局面）", cnt[None],
              "局面数 p50/p90/最大", nodes[len(nodes) // 2], nodes[int(len(nodes) * 0.9)], nodes[-1],
              "秒 p50/p90/最大", round(secs[len(secs) // 2], 3), round(secs[int(len(secs) * 0.9)], 2), round(secs[-1], 2))
    diff = sum(1 for a, b in zip(res["v1"], res["v5"]) if a[0] != b[0])
    print("2つの関数で答えが違う局面:", diff)


def verify_summary_v5(cache_dir, prefix="random", v6=False, v7=False):
    """R1 の確かめ（版5）の集計: 致命の手の先の解き直しの結果を、分類ごとに数える。

    v6=True なら、版6 の分類（v6 のキャッシュ）で分ける。版6 は版5 と同じ読むモデル・同じ札を使い、分類に効く「解けない」の札は
    版5 の確かめの対象（致命の手の先 y）に含まれる（導出）ので、版5 の解き直しの結果をそのまま使う。
    """
    rows = load_v4(cache_dir, prefix, "v5")
    import collections
    cls6 = {f["seed"]: classify_v6(f) for f in load_v4(cache_dir, prefix, "v6")} if v6 else None
    if v7:
        cls6 = {f["seed"]: classify_v7(f) for f in load_v4(cache_dir, prefix, "v7")}
        v6 = True
    tot = collections.Counter()
    by = collections.defaultdict(collections.Counter)
    wins = []
    secs = []
    for f in rows:
        if "chk_y" not in f:
            continue
        c = cls6.get(f["seed"], ("missing", None)) if v6 else classify_v4(f)
        grp = f"L{c[1]}" if c[0] == "classified" else c[0]
        for k in ("chk_y", "chk_y_sure", "chk_y_lose1", "chk_y_lose2", "chk_y_unknown", "chk_y_win", "chk_y_skipped", "chk_e_lose", "chk_e_unknown", "chk_e_win"):
            tot[k] += f.get(k, 0)
            by[grp][k] += f.get(k, 0)
        by[grp]["seeds"] += 1
        tot["seeds"] += 1
        tot["seeds_skipped"] += f.get("chk_y_skipped", 0) > 0
        secs.append(f.get("chk_sec", 0))
        if f.get("chk_wins"):
            wins.append((f["seed"], c, f["chk_wins"]))
    print("全体:", dict(tot))
    for grp in sorted(by):
        print(" ", grp, dict(by[grp]))
    print("勝ちが見つかった:", wins)
    secs.sort()
    print("確かめの時間 p50/p90/最大/合計", _q(secs), secs[-1] if secs else None, round(sum(secs)))


def resurvey_v5(cache_dir, prefix="random", limit=200_000):
    """確かめ用（版5）: 解けると確かめられなかった配り方を、BC を足した解法器（全部の手の空間）で解き直す。勝ちは手順を確かめ直す。"""
    S_ = _load_jsonl(os.path.join(cache_dir, f"survey_{prefix}.jsonl"))
    out = {}
    for seed, r in sorted(S_.items()):
        if r["status"] == "win":
            continue
        tab, _ = deal(seed)
        a = time.time()
        st, n, path = Solver(partial=True, back=True, pfilter="v2", bc=True, limit=limit, want_path=True).solve(tab)
        ok = validate_path(tab, path)[0] if st == "win" else None
        out[seed] = (r["status"], st, n, ok, round(time.time() - a, 1))
        print(seed, out[seed], flush=True)
    import collections
    print(collections.Counter((v[0], v[1]) for v in out.values()))


# ---------------------------------------------------------------------------


def quick(n0, n1, limit):
    t0 = time.time()
    rows = []
    for seed in range(n0, n1):
        tab, stock = deal(seed)
        a = time.time()
        st, nodes, _ = Solver(limit=limit).solve(tab)
        ts = time.time() - a
        g = naive_rate(tab, stock, 16, seed)
        pr = naive_play(tab, stock, None, "priority")["win"]
        rows.append((seed, st, nodes, round(ts, 2), g, pr))
        print(seed, st, nodes, round(ts, 2), g, pr, flush=True)
    print("total", time.time() - t0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd")
    ap.add_argument("--n0", type=int, default=0)
    ap.add_argument("--n1", type=int, default=20)
    ap.add_argument("--limit", type=int, default=200_000)
    ap.add_argument("--out", default="survey.jsonl")
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--seeds-from", default="")
    ap.add_argument("--mode", default="random")
    ap.add_argument("--salt", type=int, default=3)
    ap.add_argument("--no-empty", action="store_true")
    ap.add_argument("--spaces", default="")
    ap.add_argument("--alive-limit", type=int, default=0)
    ap.add_argument("--cache", default=".")
    ap.add_argument("--prefix", default="random")
    ap.add_argument("--only", default="")
    ap.add_argument("--skip", default="")
    ap.add_argument("--oracle-limit", type=int, default=0)
    ap.add_argument("--oracle-budget", type=int, default=0)
    ap.add_argument("--rule", default="none")
    ap.add_argument("--no-variants", action="store_true")
    ap.add_argument("--with-variants", action="store_true")
    ap.add_argument("--no-verify", action="store_true")
    ap.add_argument("--big", default="")
    a = ap.parse_args()
    if a.cmd == "quick":
        quick(a.n0, a.n1, a.limit)
    elif a.cmd == "survey":
        survey(a.n0, a.n1, a.out, a.procs)
    elif a.cmd == "v2":
        seeds = list(range(a.n0, a.n1))
        if a.seeds_from:
            ok = set()
            with open(a.seeds_from, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if r.get("status") == "win":
                        ok.add(r["seed"])
            seeds = [s for s in seeds if s in ok]
        if a.only:
            only = {int(x) for x in a.only.split(",")}
            seeds = [s for s in seeds if s in only]
        kw = {}
        if a.oracle_limit:
            kw["oracle_limit"] = a.oracle_limit
        if a.oracle_budget:
            kw["oracle_budget"] = a.oracle_budget
        run_jobs(_v2_worker, seeds, a.out, a.procs, **kw)
    elif a.cmd == "v3":
        seeds = list(range(a.n0, a.n1))
        if a.seeds_from:
            ok = set()
            with open(a.seeds_from, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if r.get("status") == "win":
                        ok.add(r["seed"])
            seeds = [s_ for s_ in seeds if s_ in ok]
        if a.only:
            only = [int(x) for x in a.only.split(",")]
            seeds = [s_ for s_ in only if s_ in set(seeds)]
        kw = {}
        if a.oracle_limit:
            kw["oracle_limit"] = a.oracle_limit
        if a.oracle_budget:
            kw["oracle_budget"] = a.oracle_budget
        if a.no_variants:
            kw["variants"] = False
        run_jobs(_v3_worker, seeds, a.out, a.procs, **kw)
    elif a.cmd in ("v4", "v5", "v6", "v7"):
        seeds = list(range(a.n0, a.n1))
        if a.seeds_from:
            ok = set()
            with open(a.seeds_from, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if r.get("status") == "win":
                        ok.add(r["seed"])
            seeds = [s_ for s_ in seeds if s_ in ok]
        if a.only:
            only = [int(x) for x in a.only.split(",")]
            seeds = [s_ for s_ in only if s_ in set(seeds)]
        kw = {}
        if a.oracle_limit:
            kw["oracle_limit"] = a.oracle_limit
        if a.oracle_budget:
            kw["oracle_budget"] = a.oracle_budget
        if a.with_variants:
            kw["variants"] = True
        if a.cmd == "v5":
            # 版5: 規則の手をすべて使う読むモデル（BC を足した解法器）。R1 の確かめ（致命の手の先の解き直し）も同時に求める
            kw["bc"] = True
            kw["verify"] = not a.no_verify
        if a.cmd == "v6":
            # 版6: 版5 の特徴に、1手の区切り方の両端の G の幅を足す。読むモデルと札は版5 と同じなので、R1 の確かめは版5 の結果を使う
            kw["bc"] = True
            kw["grouping"] = True
        if a.cmd == "v7":
            # 版7: 版6 の特徴に、本当の選ぶ所で区切った G と比べる用の量を足す。読むモデルと札は版5 と同じ
            kw["bc"] = True
            kw["grouping"] = True
            kw["v7"] = True
        run_jobs(_v4_worker, seeds, a.out, a.procs, **kw)
    elif a.cmd == "verify7":
        verify_summary_v5(a.cache, a.prefix, v7=True)
    elif a.cmd == "compare7":
        compare_v7(a.cache, a.prefix, big=a.big)
    elif a.cmd == "expected7":
        write_expected_v4([int(x) for x in a.only.split(",")], a.out, bc=True, v7=True)
    elif a.cmd == "symmetry7":
        d = symmetry_check_v4([int(x) for x in a.only.split(",")], bc=True, grouping=True, v7=True)
        print("違い:", len(d))
        for x in d[:30]:
            print(x)
    elif a.cmd == "notify7":
        notify_end_v7(a.cache, a.out, a.prefix, procs=a.procs, big=a.big)
    elif a.cmd == "sens7":
        sens_v7(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "verify6":
        verify_summary_v5(a.cache, a.prefix, v6=True)
    elif a.cmd == "compare6":
        compare_v6(a.cache, a.prefix, big=a.big)
    elif a.cmd == "expected6":
        write_expected_v4([int(x) for x in a.only.split(",")], a.out, bc=True, v6=True)
    elif a.cmd == "symmetry6":
        d = symmetry_check_v4([int(x) for x in a.only.split(",")], bc=True, grouping=True)
        print("違い:", len(d))
        for x in d[:30]:
            print(x)
    elif a.cmd == "notify5":
        notify_end_v5(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "notifycmp":
        notify_compare(a.cache, a.prefix)
    elif a.cmd == "verify5":
        verify_summary_v5(a.cache, a.prefix)
    elif a.cmd == "resurvey5":
        resurvey_v5(a.cache, a.prefix)
    elif a.cmd == "compare5":
        compare_v4(a.cache, a.prefix, name="v5")
    elif a.cmd == "v5sens":
        rows = load_v4(a.cache, a.prefix, "v5")
        seeds = [f["seed"] for f in rows if classify_v4(f)[0] == "classified" and classify_v4(f)[1] >= 2]
        run_jobs(_v4sens_worker, seeds, a.out, a.procs, bc=True)
    elif a.cmd == "sens5":
        sens_v4(a.cache, a.out, a.prefix, name="v5")
    elif a.cmd == "split5":
        split_check_v4(a.cache, a.out, a.prefix, procs=a.procs, skip=tuple(int(x) for x in a.skip.split(",")) if a.skip else (),
                       name="v5", bc=True)
    elif a.cmd == "base5":
        base_check_v4(a.cache, a.out, a.prefix, procs=a.procs, name="v5", bc=True)
    elif a.cmd == "d1v5":
        d1_check_v4(a.cache, a.out, a.prefix, procs=a.procs, name="v5")
    elif a.cmd == "policy5":
        level_check_v4(a.cache, a.out, "policy", a.prefix, procs=a.procs, name="v5")
    elif a.cmd == "movevar5":
        level_check_v4(a.cache, a.out, "movevar", a.prefix, procs=a.procs, limit=a.limit, name="v5")
    elif a.cmd == "symmetry5":
        d = symmetry_check_v4([int(x) for x in a.only.split(",")], bc=True)
        print("違い:", len(d))
        for x in d[:30]:
            print(x)
    elif a.cmd == "expected5":
        write_expected_v4([int(x) for x in a.only.split(",")], a.out, bc=True)
    elif a.cmd == "symmetry4":
        d = symmetry_check_v4([int(x) for x in a.only.split(",")])
        print("違い:", len(d))
        for x in d[:30]:
            print(x)
    elif a.cmd == "base4":
        base_check_v4(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "split4":
        split_check_v4(a.cache, a.out, a.prefix, procs=a.procs, skip=tuple(int(x) for x in a.skip.split(",")) if a.skip else ())
    elif a.cmd == "d1v4":
        d1_check_v4(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "policy4":
        level_check_v4(a.cache, a.out, "policy", a.prefix, procs=a.procs)
    elif a.cmd == "movevar4":
        level_check_v4(a.cache, a.out, "movevar", a.prefix, procs=a.procs, limit=a.limit)
    elif a.cmd == "expected4":
        write_expected_v4([int(x) for x in a.only.split(",")], a.out)
    elif a.cmd == "compare4":
        compare_v4(a.cache, a.prefix)
    elif a.cmd == "sens4":
        sens_v4(a.cache, a.out, a.prefix)
    elif a.cmd == "v4sens":
        rows = load_v4(a.cache, a.prefix)
        seeds = [f["seed"] for f in rows if classify_v4(f)[0] == "classified" and classify_v4(f)[1] >= 2]
        run_jobs(_v4sens_worker, seeds, a.out, a.procs)
    elif a.cmd == "compare3":
        compare_v3(a.cache, a.prefix)
    elif a.cmd == "d1v3":
        d1_check_v3(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "policy3":
        policy_check_v3(a.cache, a.out, a.prefix, procs=a.procs, rule=a.rule)
    elif a.cmd == "movevar3":
        movevar_check_v3(a.cache, a.out, a.prefix, procs=a.procs, limit=a.limit, rule=a.rule)
    elif a.cmd == "policyD":
        policyD_check(a.cache, a.out, a.prefix, procs=a.procs, rule=a.rule)
    elif a.cmd == "symmetry3":
        print("違いのあった特徴:", symmetry_check_v3([int(x) for x in a.only.split(",")]))
    elif a.cmd == "depthvar":
        depth_variants_summary(a.cache, a.out, a.prefix, procs=a.procs, rule=a.rule)
    elif a.cmd == "expected3":
        write_expected_v3([int(x) for x in a.only.split(",")], a.out)
    elif a.cmd == "expected2":
        write_expected_v2([int(x) for x in a.only.split(",")], a.out)
    elif a.cmd == "compare2":
        compare_v2(a.cache, a.prefix)
    elif a.cmd == "d1":
        d1_check(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "movevar":
        movevar_check(a.cache, a.out, a.prefix, procs=a.procs, limit=a.limit)
    elif a.cmd == "policy":
        policy_check(a.cache, a.out, a.prefix, procs=a.procs)
    elif a.cmd == "symmetry":
        print("違いのあった特徴:", symmetry_check([int(x) for x in a.only.split(",")]))
    elif a.cmd == "verify-oracle":
        cnt, wins = verify_oracle_dead([int(x) for x in a.only.split(",")])
        print("素直な解法器で解き直した結果:", cnt, "勝ちが見つかった配り方:", wins)
    elif a.cmd == "crosscheck":
        crosscheck_lose(a.cache, a.prefix)
    elif a.cmd == "notify":
        notify_cost(a.cache, a.prefix)
    elif a.cmd == "expected":
        write_expected([int(x) for x in a.only.split(",")], a.out)
    elif a.cmd == "compare":
        compare(a.cache, a.prefix)
    elif a.cmd == "extra":
        seeds = list(range(a.n0, a.n1))
        if a.seeds_from:
            ok = set()
            with open(a.seeds_from, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if r.get("status") == "win":
                        ok.add(r["seed"])
            seeds = [s for s in seeds if s in ok]
        run_jobs(_extra_worker, seeds, a.out, a.procs)
    elif a.cmd == "traps":
        seeds = list(range(a.n0, a.n1))
        if a.seeds_from:
            ok = set()
            with open(a.seeds_from, encoding="utf-8") as fh:
                for line in fh:
                    r = json.loads(line)
                    if r.get("status") == "win" and r.get("naive_rate", 1) < 1:
                        ok.add(r["seed"])
            seeds = [s for s in seeds if s in ok]
        kw = {}
        if a.mode != "random":
            kw["mode"] = a.mode
        if a.salt != 3:
            kw["rng_salt"] = a.salt
        if a.no_empty:
            kw["include_empty_moves"] = False
        if a.spaces:
            kw["spaces"] = tuple(a.spaces.split(","))
        if a.alive_limit:
            kw["limit"] = a.alive_limit
        if a.only:
            only = {int(x) for x in a.only.split(",")}
            seeds = [s for s in seeds if s in only]
        run_jobs(_trap_worker, seeds, a.out, a.procs, **kw)


if __name__ == "__main__":
    main()
