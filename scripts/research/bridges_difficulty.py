"""ブリッジパズル（橋をかけろ, bridges）の難易度の調査コード。

標準ライブラリだけで、次を測る。

- 生成: 島を1つずつ伸ばして木を作り、余分な橋を足して数字を出す（seed 固定）。
- 一意性: 交差・連結を含む完全な解法器で解の数を2まで数える。
- 人間向け解法器: 推論の段（A1 → A2 → B → C1 → C3 → D → T）を、
  低い段から使い切ってから次の段を使う。1回の手詰まりでは、その段で
  言えることを同時にすべて適用する（適用順に依らない）。
- 素朴な解き方: 局所の本数推論だけ（N1）、局所の本数推論＋試し置き（N2）。
- 連結を無視したときの解の数（つながりを読まないと決まらない問題か）。

段の名前:
  A1 ちょうど（足りた島の残り0、相手の残りで頭打ち、上限の合計が数字と同じ）
  A2 少なくとも・多くとも（他を上限まで使っても足りない分はここに要る）
  B  交差（ここに架けると交差で消える行き先のせいで島が満たせない）
  C1p 2島で閉じない（1-1 をつながない、2=2 を2本にしない）
  C1g 3島以上の組で閉じない
  C3 唯一の通り道（この行き先が無いと全島がつながらない）
  D  1手の先読み（仮に架け、両端の島が埋まった結果どこかが孤立する）
  T  試し置き（仮に決めて A〜D で進めると矛盾する。提供範囲外の判定に使う）

使い方（調査の再現手順。seed は固定）:
  python3 scripts/research/bridges_difficulty.py corpus --out main.jsonl --per 200
  python3 scripts/research/bridges_difficulty.py corpus --set l5 --out l5.jsonl --per 300
  python3 scripts/research/bridges_difficulty.py report main.jsonl
  python3 scripts/research/bridges_difficulty.py l5 main.jsonl l5.jsonl
  python3 scripts/research/bridges_difficulty.py levels --scheme R main.jsonl l5.jsonl
  python3 scripts/research/bridges_difficulty.py selfcheck main.jsonl
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field

DIRS = ((0, 1), (1, 0), (0, -1), (-1, 0))
TIER_ORDER = ("A1", "A2", "B", "C1p", "C1g", "C3", "D", "T")
TIER_RANK = {t: i for i, t in enumerate(TIER_ORDER)}


# ---------------------------------------------------------------------------
# 問題の表現
# ---------------------------------------------------------------------------


@dataclass
class Puzzle:
    w: int
    h: int
    islands: list[tuple[int, int]]
    nums: list[int]
    edges: list[tuple[int, int]] = field(default_factory=list)  # (i, j) i<j
    edge_cells: list[list[tuple[int, int]]] = field(default_factory=list)
    edge_horizontal: list[bool] = field(default_factory=list)
    inc: list[list[int]] = field(default_factory=list)
    cross: list[list[int]] = field(default_factory=list)
    other: list[dict[int, int]] = field(default_factory=list)  # island -> {edge: other island}

    def build(self) -> None:
        pos = {p: k for k, p in enumerate(self.islands)}
        n = len(self.islands)
        self.inc = [[] for _ in range(n)]
        self.other = [dict() for _ in range(n)]
        for i, (r, c) in enumerate(self.islands):
            for dr, dc in ((0, 1), (1, 0)):
                cells = []
                rr, cc = r + dr, c + dc
                while 0 <= rr < self.h and 0 <= cc < self.w:
                    if (rr, cc) in pos:
                        j = pos[(rr, cc)]
                        e = len(self.edges)
                        self.edges.append((i, j))
                        self.edge_cells.append(cells)
                        self.edge_horizontal.append(dr == 0)
                        self.inc[i].append(e)
                        self.inc[j].append(e)
                        self.other[i][e] = j
                        self.other[j][e] = i
                        break
                    cells.append((rr, cc))
                    rr += dr
                    cc += dc
        cell_h: dict[tuple[int, int], int] = {}
        cell_v: dict[tuple[int, int], int] = {}
        for e, cells in enumerate(self.edge_cells):
            for cell in cells:
                (cell_h if self.edge_horizontal[e] else cell_v)[cell] = e
        self.cross = [[] for _ in self.edges]
        for cell, e in cell_h.items():
            f = cell_v.get(cell)
            if f is not None:
                self.cross[e].append(f)
                self.cross[f].append(e)


def puzzle_key(p: Puzzle) -> tuple:
    """回転・反転で正規化した島と数字のキー。"""
    variants = []
    pts = list(zip(p.islands, p.nums))
    w, h = p.w, p.h
    for k in range(8):
        out = []
        for (r, c), v in pts:
            rr, cc, ww = r, c, w
            hh = h
            for _ in range(k % 4):
                rr, cc = cc, hh - 1 - rr
                ww, hh = hh, ww
            if k >= 4:
                cc = ww - 1 - cc
            out.append((rr, cc, v))
        variants.append(tuple(sorted(out)))
    return min(variants)


# ---------------------------------------------------------------------------
# 生成
# ---------------------------------------------------------------------------


def generate(w: int, h: int, target: int, p2: float, p_extra: float, rng: random.Random):
    """島を伸ばして木を作り、余分な橋を足す。戻り値は (Puzzle, 解の橋の本数リスト)。"""
    island_at: dict[tuple[int, int], int] = {}
    islands: list[tuple[int, int]] = []
    bridge_cells: set[tuple[int, int]] = set()
    bridges: dict[tuple[int, int], int] = {}

    def free_for_island(cell: tuple[int, int]) -> bool:
        r, c = cell
        if cell in island_at or cell in bridge_cells:
            return False
        for dr, dc in DIRS:
            if (r + dr, c + dc) in island_at:
                return False
        return True

    start = (rng.randrange(h), rng.randrange(w))
    island_at[start] = 0
    islands.append(start)
    attempts = 0
    while len(islands) < target and attempts < target * 60:
        attempts += 1
        i = rng.randrange(len(islands))
        dr, dc = rng.choice(DIRS)
        r, c = islands[i]
        run = []
        rr, cc = r + dr, c + dc
        while 0 <= rr < h and 0 <= cc < w and (rr, cc) not in island_at and (rr, cc) not in bridge_cells:
            run.append((rr, cc))
            rr += dr
            cc += dc
        if len(run) < 2:
            continue
        options = [k for k in range(1, len(run)) if free_for_island(run[k])]
        if not options:
            continue
        k = rng.choice(options)
        cell = run[k]
        j = len(islands)
        island_at[cell] = j
        islands.append(cell)
        for x in run[:k]:
            bridge_cells.add(x)
        bridges[(i, j)] = 2 if rng.random() < p2 else 1
    if len(islands) < 2:
        return None
    nums_tmp = [0] * len(islands)
    p = Puzzle(w, h, islands, nums_tmp)
    p.build()
    # 余分な橋（輪）
    for e, (i, j) in enumerate(p.edges):
        if (i, j) in bridges or (j, i) in bridges:
            continue
        if rng.random() >= p_extra:
            continue
        if any(x in bridge_cells for x in p.edge_cells[e]):
            continue
        for x in p.edge_cells[e]:
            bridge_cells.add(x)
        bridges[(i, j)] = 2 if rng.random() < p2 else 1
    sol = [0] * len(p.edges)
    for e, (i, j) in enumerate(p.edges):
        sol[e] = bridges.get((i, j), bridges.get((j, i), 0))
    used_pairs = sum(1 for v in sol if v)
    assert used_pairs == len(bridges), "橋が隣接関係から外れた"
    nums = [0] * len(islands)
    for e, (i, j) in enumerate(p.edges):
        nums[i] += sol[e]
        nums[j] += sol[e]
    p.nums = nums
    return p, sol


# ---------------------------------------------------------------------------
# 共通の道具
# ---------------------------------------------------------------------------


class Contradiction(Exception):
    pass


def components_lo(p: Puzzle, lo: list[int]) -> list[int]:
    n = len(p.islands)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e, (i, j) in enumerate(p.edges):
        if lo[e] > 0:
            a, b = find(i), find(j)
            if a != b:
                parent[a] = b
    return [find(x) for x in range(n)]


def potential_connected(p: Puzzle, hi: list[int], skip: int = -1) -> bool:
    n = len(p.islands)
    seen = [False] * n
    stack = [0]
    seen[0] = True
    cnt = 1
    while stack:
        x = stack.pop()
        for e in p.inc[x]:
            if e == skip or hi[e] == 0:
                continue
            y = p.other[x][e]
            if not seen[y]:
                seen[y] = True
                cnt += 1
                stack.append(y)
    return cnt == n


def apply_crossing(p: Puzzle, lo: list[int], hi: list[int]) -> None:
    for e in range(len(p.edges)):
        if lo[e] > 0:
            for f in p.cross[e]:
                if lo[f] > 0:
                    raise Contradiction
                hi[f] = 0


def check_counts(p: Puzzle, lo: list[int], hi: list[int]) -> None:
    for i, inc in enumerate(p.inc):
        n = p.nums[i]
        if sum(lo[e] for e in inc) > n or sum(hi[e] for e in inc) < n:
            raise Contradiction
    for e in range(len(p.edges)):
        if lo[e] > hi[e]:
            raise Contradiction


def closed_component(p: Puzzle, lo: list[int]) -> bool:
    """lo の橋でできた組のうち、全島ではないのに全員の本数が足りた組があるか。"""
    comp = components_lo(p, lo)
    n = len(p.islands)
    sizes = Counter(comp)
    need_left = defaultdict(int)
    for i, inc in enumerate(p.inc):
        need_left[comp[i]] += p.nums[i] - sum(lo[e] for e in inc)
    for root, s in sizes.items():
        if s < n and need_left[root] == 0:
            return True
    return False


# ---------------------------------------------------------------------------
# 完全な解法器（一意性と、連結を無視した解の数）
# ---------------------------------------------------------------------------


def exact_propagate(p: Puzzle, lo: list[int], hi: list[int], use_conn: bool) -> None:
    changed = True
    while changed:
        changed = False
        apply_crossing(p, lo, hi)
        for i, inc in enumerate(p.inc):
            n = p.nums[i]
            slo = 0
            shi = 0
            for e in inc:
                slo += lo[e]
                shi += hi[e]
            if slo > n or shi < n:
                raise Contradiction
            for e in inc:
                nlo = n - (shi - hi[e])
                nhi = n - (slo - lo[e])
                if nlo > lo[e]:
                    lo[e] = nlo
                    changed = True
                if nhi < hi[e]:
                    hi[e] = nhi
                    changed = True
                if lo[e] > hi[e]:
                    raise Contradiction
        if use_conn and not changed:
            if closed_component(p, lo):
                raise Contradiction
            if not potential_connected(p, hi):
                raise Contradiction


def count_solutions(p: Puzzle, limit: int = 2, use_conn: bool = True, node_cap: int = 200000):
    """解の数を limit まで数える。戻り値 (count, nodes, capped)。"""
    E = len(p.edges)
    nodes = 0
    found = 0
    capped = False
    first: list[int] | None = None

    def rec(lo: list[int], hi: list[int]) -> None:
        nonlocal nodes, found, capped, first
        if found >= limit or capped:
            return
        nodes += 1
        if nodes > node_cap:
            capped = True
            return
        try:
            exact_propagate(p, lo, hi, use_conn)
        except Contradiction:
            return
        best = -1
        best_score = None
        for e in range(E):
            if lo[e] < hi[e]:
                i, j = p.edges[e]
                score = (hi[e] - lo[e], len(p.inc[i]) + len(p.inc[j]))
                if best_score is None or score < best_score:
                    best_score = score
                    best = e
        if best < 0:
            if use_conn:
                comp = components_lo(p, lo)
                if len(set(comp)) != 1:
                    return
            found += 1
            if first is None:
                first = lo[:]
            return
        for v in range(hi[best], lo[best] - 1, -1):
            nlo, nhi = lo[:], hi[:]
            nlo[best] = v
            nhi[best] = v
            rec(nlo, nhi)
            if found >= limit or capped:
                return

    lo0 = [0] * E
    hi0 = [min(2, p.nums[i], p.nums[j]) for (i, j) in p.edges]
    rec(lo0, hi0)
    return found, nodes, capped, first


# ---------------------------------------------------------------------------
# 人間向け解法器
# ---------------------------------------------------------------------------


def tighten(ded: dict[int, tuple[int, int]], e: int, lo_v: int, hi_v: int, lo: list[int], hi: list[int]) -> None:
    a, b = ded.get(e, (lo[e], hi[e]))
    ded[e] = (max(a, lo_v), min(b, hi_v))


def tier_A1(p: Puzzle, lo, hi):
    """ちょうど: 足りた島の残りは0。相手の島の残りより多くは架けられない。
    行き先ごとの上限（相手の残りで頭打ち）の合計が数字と同じなら全部上限。"""
    ded: dict[int, tuple[int, int]] = {}
    rem = [p.nums[i] - sum(lo[e] for e in inc) for i, inc in enumerate(p.inc)]
    cap = [min(hi[e], lo[e] + rem[i], lo[e] + rem[j]) for e, (i, j) in enumerate(p.edges)]
    for e in range(len(p.edges)):
        if cap[e] < hi[e]:
            tighten(ded, e, lo[e], cap[e], lo, hi)
    for i, inc in enumerate(p.inc):
        n = p.nums[i]
        slo = sum(lo[e] for e in inc)
        shi = sum(cap[e] for e in inc)
        if shi == n:
            for e in inc:
                if lo[e] < cap[e]:
                    tighten(ded, e, cap[e], cap[e], lo, hi)
    return ded


def tier_A2(p: Puzzle, lo, hi):
    """少なくとも・多くとも: 他の行き先を上限まで使っても足りない分は、この行き先に要る。"""
    ded: dict[int, tuple[int, int]] = {}
    for i, inc in enumerate(p.inc):
        n = p.nums[i]
        slo = sum(lo[e] for e in inc)
        shi = sum(hi[e] for e in inc)
        for e in inc:
            nlo = n - (shi - hi[e])
            nhi = n - (slo - lo[e])
            if nlo > lo[e] or nhi < hi[e]:
                tighten(ded, e, max(lo[e], nlo), min(hi[e], nhi), lo, hi)
    return ded


def tier_B(p: Puzzle, lo, hi):
    """交差: ここに架けると交差する行き先が消え、その島の数字が満たせなくなるなら架けない。"""
    ded: dict[int, tuple[int, int]] = {}
    for e in range(len(p.edges)):
        if lo[e] != 0 or hi[e] == 0:
            continue
        blocked = [f for f in p.cross[e] if hi[f] > 0]
        if not blocked:
            continue
        loss: dict[int, int] = defaultdict(int)
        for f in blocked:
            for k in p.edges[f]:
                loss[k] += hi[f]
        for k, l in loss.items():
            if sum(hi[x] for x in p.inc[k]) - l < p.nums[k]:
                tighten(ded, e, 0, 0, lo, hi)
                break
    return ded


def tier_C1(p: Puzzle, lo, hi, pair_only: bool):
    """閉じた組: 架けると、全島ではない組の本数がすべて足りて閉じるなら、その本数は架けない。"""
    ded: dict[int, tuple[int, int]] = {}
    comp = components_lo(p, lo)
    n_all = len(p.islands)
    members: dict[int, list[int]] = defaultdict(list)
    for i, r in enumerate(comp):
        members[r].append(i)
    need = [p.nums[i] - sum(lo[e] for e in p.inc[i]) for i in range(n_all)]
    comp_need = {r: sum(need[i] for i in ms) for r, ms in members.items()}
    for e, (i, j) in enumerate(p.edges):
        if lo[e] >= hi[e]:
            continue
        ri, rj = comp[i], comp[j]
        size = len(members[ri]) + (len(members[rj]) if ri != rj else 0)
        if size >= n_all:
            continue
        group_size_islands = size
        if pair_only != (group_size_islands == 2):
            continue
        base_need = comp_need[ri] + (comp_need[rj] if ri != rj else 0)
        for v in range(lo[e] + 1, hi[e] + 1):
            # e を v にすると、組の残りは 2*(v-lo) 減る
            if base_need - 2 * (v - lo[e]) == 0:
                tighten(ded, e, lo[e], v - 1, lo, hi)
                break
    return ded


def tier_C3(p: Puzzle, lo, hi):
    """唯一の通り道: この行き先が無いと、架けられる橋だけでは全島がつながらないなら1本は要る。"""
    ded: dict[int, tuple[int, int]] = {}
    for e in range(len(p.edges)):
        if lo[e] == 0 and hi[e] > 0:
            if not potential_connected(p, hi, skip=e):
                tighten(ded, e, 1, hi[e], lo, hi)
    return ded


def hypothetical_fails(p: Puzzle, lo, hi, e: int, set_lo: int | None, set_hi: int | None) -> bool:
    """1手だけの先読み: e を仮に決め、両端の島と交差だけを1段進めて、つながりか本数が破れるか。"""
    lo2, hi2 = lo[:], hi[:]
    if set_lo is not None:
        lo2[e] = set_lo
    if set_hi is not None:
        hi2[e] = set_hi
    if lo2[e] > hi2[e]:
        return True
    if lo2[e] > 0:
        for f in p.cross[e]:
            if lo2[f] > 0:
                return True
            hi2[f] = 0
    i, j = p.edges[e]
    touched = {i, j}
    if lo2[e] > 0:
        for f in p.cross[e]:
            touched.update(p.edges[f])
    for k in touched:
        inc = p.inc[k]
        n = p.nums[k]
        slo = sum(lo2[x] for x in inc)
        shi = sum(hi2[x] for x in inc)
        if slo > n or shi < n:
            return True
    for k in (i, j):
        inc = p.inc[k]
        n = p.nums[k]
        slo = sum(lo2[x] for x in inc)
        shi = sum(hi2[x] for x in inc)
        if slo == n:
            for x in inc:
                hi2[x] = lo2[x]
        elif shi == n:
            for x in inc:
                lo2[x] = hi2[x]
                if lo2[x] > 0:
                    for f in p.cross[x]:
                        if lo2[f] > 0:
                            return True
                        hi2[f] = 0
    if closed_component(p, lo2):
        return True
    if not potential_connected(p, hi2):
        return True
    return False


def tier_D(p: Puzzle, lo, hi):
    """つながりの先読み: 1手だけ仮に決め、両端の島が埋まった結果、どこかが孤立するなら、その手は無い。"""
    ded: dict[int, tuple[int, int]] = {}
    for e in range(len(p.edges)):
        if lo[e] >= hi[e]:
            continue
        # 上を試す: e >= lo+1 が破れるなら hi = lo
        for v in range(lo[e] + 1, hi[e] + 1):
            if hypothetical_fails(p, lo, hi, e, v, None):
                tighten(ded, e, lo[e], v - 1, lo, hi)
                break
        # 下を試す: e <= hi-1 が破れるなら lo = hi
        for v in range(hi[e] - 1, lo[e] - 1, -1):
            if hypothetical_fails(p, lo, hi, e, None, v):
                tighten(ded, e, v + 1, hi[e], lo, hi)
                break
    return ded


TIERS_NO_T = (
    ("A1", tier_A1),
    ("A2", tier_A2),
    ("B", tier_B),
    ("C1p", lambda p, lo, hi: tier_C1(p, lo, hi, True)),
    ("C1g", lambda p, lo, hi: tier_C1(p, lo, hi, False)),
    ("C3", tier_C3),
    ("D", tier_D),
)


def run_tiers(p: Puzzle, lo, hi, max_tier: str, log: list | None):
    """max_tier までの段で、手詰まるか解き切るまで進める。矛盾なら Contradiction。"""
    limit = TIER_RANK[max_tier]
    while True:
        apply_crossing(p, lo, hi)
        check_counts(p, lo, hi)
        if all(lo[e] == hi[e] for e in range(len(p.edges))):
            return True
        progressed = False
        for name, fn in TIERS_NO_T:
            if TIER_RANK[name] > limit:
                break
            ded = fn(p, lo, hi)
            real = {e: v for e, v in ded.items() if v != (lo[e], hi[e])}
            if real:
                for e, (a, b) in real.items():
                    if a > b:
                        raise Contradiction
                    lo[e], hi[e] = a, b
                if log is not None:
                    log.append((name, len(real)))
                progressed = True
                break
        if not progressed:
            if limit >= TIER_RANK["T"]:
                ded = tier_T(p, lo, hi)
                if ded:
                    for e, (a, b) in ded.items():
                        lo[e], hi[e] = a, b
                    if log is not None:
                        log.append(("T", len(ded)))
                    continue
            return False


def tier_T(p: Puzzle, lo, hi):
    """試し置き: 1手を仮に決め、A〜D で進めて矛盾するなら、その手は無い（提供範囲外の判定に使う）。"""
    ded: dict[int, tuple[int, int]] = {}
    for e in range(len(p.edges)):
        if lo[e] >= hi[e]:
            continue
        for v in range(lo[e], hi[e] + 1):
            lo2, hi2 = lo[:], hi[:]
            lo2[e] = hi2[e] = v
            try:
                run_tiers(p, lo2, hi2, "D", None)
                if all(lo2[x] == hi2[x] for x in range(len(p.edges))):
                    if len(set(components_lo(p, lo2))) != 1:
                        raise Contradiction
            except Contradiction:
                a, b = ded.get(e, (lo[e], hi[e]))
                if v == a:
                    a += 1
                if v == b:
                    b -= 1
                ded[e] = (a, b)
        if e in ded:
            # 1本ずつ決める（試し置きは1手ごとに数える）
            return {e: ded[e]}
    return ded


def human_solve(p: Puzzle, max_tier: str = "T"):
    E = len(p.edges)
    lo = [0] * E
    hi = [min(2, p.nums[i], p.nums[j]) for (i, j) in p.edges]
    log: list[tuple[str, int]] = []
    try:
        solved = run_tiers(p, lo, hi, max_tier, log)
    except Contradiction:
        return "contradiction", log, lo, 0.0
    decided = sum(1 for e in range(E) if lo[e] == hi[e])
    return ("solved" if solved else "stuck"), log, lo, decided / E if E else 1.0


def entry_width(p: Puzzle) -> int:
    E = len(p.edges)
    lo = [0] * E
    hi = [min(2, p.nums[i], p.nums[j]) for (i, j) in p.edges]
    ded = tier_A1(p, lo, hi)
    d2 = tier_A2(p, lo, hi)
    keys = {e for e, v in ded.items() if v != (lo[e], hi[e])} | {e for e, v in d2.items() if v != (lo[e], hi[e])}
    return len(keys)


# ---------------------------------------------------------------------------
# 素朴な解き方 N2: 局所の本数推論＋試し置き（盤面が見せるのは島ごとの本数だけ）
# ---------------------------------------------------------------------------


def local_propagate(p: Puzzle, lo, hi) -> None:
    run_tiers(p, lo, hi, "A2", None)


def naive_trial(p: Puzzle, rng: random.Random, node_cap: int = 20000, most_constrained: bool = False):
    """戻り値: (solved, backtracks, disconnected_full)。

    手で選ぶ場所は、まだ決まっていない行き先から無作為。本数も無作為。
    局所の本数推論で進め、本数が破れたら戻す。全島の本数が合ったのに
    つながっていなければ（盤面は全島灰色なのにクリアにならない）、戻す。
    """
    E = len(p.edges)
    backtracks = 0
    disconnected = 0
    nodes = 0

    def rec(lo, hi) -> bool:
        nonlocal backtracks, disconnected, nodes
        nodes += 1
        if nodes > node_cap:
            return False
        try:
            local_propagate(p, lo, hi)
        except Contradiction:
            backtracks += 1
            return False
        und = [e for e in range(E) if lo[e] < hi[e]]
        if not und:
            if len(set(components_lo(p, lo))) == 1:
                return True
            disconnected += 1
            backtracks += 1
            return False
        if most_constrained:
            # 残りの行き先が最も少ない島のまわりから試す（慣れた試し置き）
            def island_slack(k):
                return sum(1 for x in p.inc[k] if lo[x] < hi[x])
            best = min(min(island_slack(i), island_slack(j)) for e2 in und for (i, j) in [p.edges[e2]])
            cand = [e2 for e2 in und if min(island_slack(p.edges[e2][0]), island_slack(p.edges[e2][1])) == best]
            e = rng.choice(cand)
        else:
            e = rng.choice(und)
        vals = list(range(lo[e], hi[e] + 1))
        rng.shuffle(vals)
        for v in vals:
            nlo, nhi = lo[:], hi[:]
            nlo[e] = nhi[e] = v
            if rec(nlo, nhi):
                return True
            if nodes > node_cap:
                return False
        return False

    lo0 = [0] * E
    hi0 = [min(2, p.nums[i], p.nums[j]) for (i, j) in p.edges]
    ok = rec(lo0, hi0)
    return ok, backtracks, disconnected, nodes > node_cap


# ---------------------------------------------------------------------------
# 1候補の分析
# ---------------------------------------------------------------------------


def analyze(cond: dict, seed: int) -> dict:
    rng = random.Random(seed)
    w, h = cond["w"], cond["h"]
    target = max(2, round(cond["density"] * w * h))
    t0 = time.perf_counter()
    g = generate(w, h, target, cond["p2"], cond["extra"], rng)
    row: dict = {"cond": cond, "seed": seed}
    if g is None:
        row["status"] = "gen-fail"
        return row
    p, sol = g
    row["islands"] = [list(x) for x in p.islands]
    row["nums"] = p.nums
    row["n"] = len(p.islands)
    row["edges"] = len(p.edges)
    row["bridges"] = sum(sol)
    row["pairs"] = sum(1 for v in sol if v)
    row["doubles"] = sum(1 for v in sol if v == 2)
    cnt, nodes, capped, _ = count_solutions(p, 2, True)
    row["exact_nodes"] = nodes
    if capped:
        row["status"] = "capped"
        return row
    if cnt != 1:
        row["status"] = "multi"
        return row
    t1 = time.perf_counter()
    status, log, lo, frac = human_solve(p, "T")
    t2 = time.perf_counter()
    if status == "solved" and lo != sol:
        row["status"] = "BUG-mismatch"
        return row
    row["human_status"] = status
    row["log"] = log
    tiers_used = [t for t, _ in log]
    row["max_tier"] = max(tiers_used, key=lambda t: TIER_RANK[t]) if tiers_used else "A1"
    row["tier_rounds"] = dict(Counter(tiers_used))
    adv = [k for t, k in log if TIER_RANK[t] >= TIER_RANK["C1g"]]
    row["conn_rounds"] = len([t for t in tiers_used if t in ("C1p", "C1g", "C3", "D")])
    row["deep_conn_rounds"] = len(adv)
    row["min_adv_breadth"] = min(adv) if adv else None
    row["a2_rounds"] = row["tier_rounds"].get("A2", 0)
    row["crossing_kills"] = sum(
        1 for e in range(len(p.edges)) if sol[e] == 0 and any(sol[f] > 0 for f in p.cross[e])
    )
    # 素朴 N1: 局所の本数推論だけ
    _, _, _, frac_a = human_solve(p, "A2")
    row["a_only_progress"] = round(frac_a, 3)
    _, _, _, frac_b = human_solve(p, "B")
    row["ab_progress"] = round(frac_b, 3)
    row["entry"] = entry_width(p)
    # 連結を無視した解の数
    c_nc, _, cap_nc, _ = count_solutions(p, 20, False, node_cap=100000)
    row["noconn_solutions"] = c_nc
    row["noconn_capped"] = capped or cap_nc
    # 素朴 N2
    trials = []
    for k in range(5):
        ok, bt, disc, cap = naive_trial(p, random.Random(seed * 31 + k))
        trials.append((ok, bt, disc, cap))
    row["naive"] = trials
    row["naive_mc"] = [naive_trial(p, random.Random(seed * 37 + k), most_constrained=True) for k in range(5)]
    row["status"] = "unique"
    row["gen_seconds"] = round(t1 - t0, 4)
    row["human_seconds"] = round(t2 - t1, 4)
    return row


def conditions(name: str = "main") -> list[dict]:
    out = []
    if name == "l5":
        for density in (0.24, 0.30, 0.36):
            for p2 in (0.1, 0.2, 0.3):
                for extra in (0.0, 0.15):
                    out.append({"w": 10, "h": 10, "density": density, "p2": p2, "extra": extra})
        return out
    for size in (6, 7, 8, 9, 10):
        for density in (0.18, 0.24, 0.30):
            for p2 in (0.3, 0.5):
                for extra in (0.0, 0.3):
                    out.append({"w": size, "h": size, "density": density, "p2": p2, "extra": extra})
    return out


def _work(args):
    cond, seed = args
    try:
        return analyze(cond, seed)
    except RecursionError:
        return {"cond": cond, "seed": seed, "status": "recursion"}


def cmd_corpus(a) -> None:
    import multiprocessing as mp

    sys.setrecursionlimit(10000)
    jobs = []
    base = 1_000_000 if a.set == "main" else 2_000_000
    for ci, cond in enumerate(conditions(a.set)):
        for k in range(a.per):
            jobs.append((cond, base + ci * 10_000 + k))
    t0 = time.perf_counter()
    with mp.Pool(a.workers) as pool, open(a.out, "w") as f:
        for row in pool.imap_unordered(_work, jobs, chunksize=2):
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{len(jobs)} candidates in {time.perf_counter() - t0:.1f}s", file=sys.stderr)


# ---------------------------------------------------------------------------
# 集計
# ---------------------------------------------------------------------------


def pct(xs, q):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * q
    lo_i = int(k)
    hi_i = min(lo_i + 1, len(xs) - 1)
    return round(xs[lo_i] + (xs[hi_i] - xs[lo_i]) * (k - lo_i), 2)


def p3(xs):
    return f"{pct(xs, 0.1)} / {pct(xs, 0.5)} / {pct(xs, 0.9)}" if xs else "-"


def spearman(xs, ys):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return round(num / den, 3) if den else None


def load(path):
    with open(path) as f:
        return [json.loads(line) for line in f]


def classify(r: dict) -> str:
    """仮のレベル案 P（report で比べる）。"""
    if r.get("human_status") != "solved" or r["max_tier"] in ("T",):
        return "out:needs-trial" if r.get("human_status") == "solved" else "out:unsupported"
    size = r["cond"]["w"]
    mt = TIER_RANK[r["max_tier"]]
    conn = r["deep_conn_rounds"]
    if size <= 7 and mt <= TIER_RANK["A2"]:
        return "L1" if mt == TIER_RANK["A1"] or size <= 6 else "L2"
    if size in (7, 8) and mt <= TIER_RANK["B"]:
        return "L2"
    if size in (8, 9) and mt <= TIER_RANK["C1p"]:
        return "L3"
    if size in (9, 10) and mt >= TIER_RANK["C1g"] and conn <= 1:
        return "L4"
    if size == 10 and mt >= TIER_RANK["C1g"] and conn >= 2:
        return "L5"
    return "out:combo"


def cmd_report(a) -> None:
    rows = load(a.path)
    print(f"候補 {len(rows)}")
    st = Counter(r["status"] for r in rows)
    print("状態:", dict(st))
    uniq = [r for r in rows if r["status"] == "unique"]
    print("\n## 盤面ごとの一意解の割合と最高段")
    by_size = defaultdict(list)
    for r in rows:
        by_size[r["cond"]["w"]].append(r)
    for s in sorted(by_size):
        rs = by_size[s]
        u = [r for r in rs if r["status"] == "unique"]
        mt = Counter(r["max_tier"] for r in u)
        hs = Counter(r["human_status"] for r in u)
        print(f"{s}x{s}: 候補 {len(rs)} 一意 {len(u)} ({len(u)/len(rs):.0%}) human {dict(hs)} 最高段 "
              + ", ".join(f"{t}:{mt.get(t,0)}" for t in TIER_ORDER))
    print("\n## 盤面 × 密度 ごとの最高段の割合（一意のみ）")
    by = defaultdict(list)
    for r in uniq:
        by[(r["cond"]["w"], r["cond"]["density"])].append(r)
    for k in sorted(by):
        rs = by[k]
        mt = Counter(r["max_tier"] for r in rs)
        conn = sum(1 for r in rs if TIER_RANK[r["max_tier"]] >= TIER_RANK["C1p"] and r["max_tier"] != "T")
        print(f"{k[0]}x{k[0]} d={k[1]}: n={len(rs)} 島 {p3([r['n'] for r in rs])} "
              + " ".join(f"{t}:{mt.get(t,0)/len(rs):.0%}" for t in TIER_ORDER)
              + f" | 連結を使う {conn/len(rs):.0%}")
    print("\n## 段ごとの特徴（一意かつ A〜D で解けたもの）")
    ok = [r for r in uniq if r["human_status"] == "solved" and r["max_tier"] != "T"]
    by_t = defaultdict(list)
    for r in ok:
        by_t[r["max_tier"]].append(r)
    for t in TIER_ORDER:
        rs = by_t.get(t, [])
        if not rs:
            continue
        print(f"{t}: n={len(rs)} 盤面 {dict(Counter(r['cond']['w'] for r in rs))}")
        print(f"   島 {p3([r['n'] for r in rs])} 入口 {p3([r['entry'] for r in rs])} "
              f"A だけの進み {p3([r['a_only_progress'] for r in rs])} A+B の進み {p3([r['ab_progress'] for r in rs])}")
        print(f"   連結の手詰まり {p3([r['conn_rounds'] for r in rs])} 深い連結 {p3([r['deep_conn_rounds'] for r in rs])} "
              f"連結無視の解の数 {p3([r['noconn_solutions'] for r in rs])}")
        nb = [statistics.median([x[1] for x in r['naive']]) for r in rs]
        nd = [sum(x[2] for x in r['naive']) / 5 for r in rs]
        zero = sum(1 for r in rs for x in r['naive'] if x[1] == 0) / (5 * len(rs))
        print(f"   N2 試し置き 戻し {p3(nb)} 全灰色で非連結 {p3(nd)} 戻し0の割合 {zero:.0%}")
    print("\n## 連結を無視すると解が2つ以上ある問題と、解法器の最高段の対応")
    for t in TIER_ORDER:
        rs = by_t.get(t, [])
        if rs:
            m = sum(1 for r in rs if r["noconn_solutions"] >= 2)
            print(f"{t}: {m}/{len(rs)}")
    print("\n## 推論の種類の出現（盤面ごと、一意かつ A〜D で解けたもの）")
    for s in sorted({r['cond']['w'] for r in ok}):
        rs = [r for r in ok if r['cond']['w'] == s]
        print(f"{s}x{s} n={len(rs)}: " + " ".join(
            f"{t}:{sum(1 for r in rs if t in r['tier_rounds'])/len(rs):.0%}" for t in TIER_ORDER))
    print("\n## 系統間の順位相関（一意かつ A〜D で解けたもの）")
    feats = {
        "島の数": [r["n"] for r in ok],
        "盤面": [r["cond"]["w"] for r in ok],
        "最高段": [TIER_RANK[r["max_tier"]] for r in ok],
        "連結の手詰まり": [r["conn_rounds"] for r in ok],
        "深い連結": [r["deep_conn_rounds"] for r in ok],
        "入口": [r["entry"] for r in ok],
        "Aだけの進み": [r["a_only_progress"] for r in ok],
        "N2戻し": [statistics.median([x[1] for x in r['naive']]) for r in ok],
    }
    names = list(feats)
    print("| | " + " | ".join(names) + " |")
    for x in names:
        print(f"| {x} | " + " | ".join(str(spearman(feats[x], feats[y])) for y in names) + " |")
    print("\n## 10x10 の中で（同じ規模）の相関")
    ten = [r for r in ok if r["cond"]["w"] == 10]
    if len(ten) > 5:
        f10 = {k: [v for r, v in zip(ok, feats[k]) if r['cond']['w'] == 10] for k in names}
        for x in ("島の数", "最高段", "連結の手詰まり", "入口", "Aだけの進み", "N2戻し"):
            print(f"{x}: " + ", ".join(f"{y}={spearman(f10[x], f10[y])}" for y in names if y != x and y != "盤面"))
    print("\n## A2 の手詰まり回数（A だけで解ける問題、盤面ごと）")
    for sz in sorted({r['cond']['w'] for r in ok}):
        rs = [r for r in ok if r['cond']['w'] == sz and TIER_RANK[r['max_tier']] <= TIER_RANK['A2']]
        print(f"{sz}x{sz} n={len(rs)} A2回数 {p3([r['a2_rounds'] for r in rs])} 分布 {sorted(Counter(r['a2_rounds'] for r in rs).items())}"
              f" 入口/辺 {p3([round(r['entry']/r['edges'],2) for r in rs])} 交差で消える {p3([r['crossing_kills'] for r in rs])}")
    print("\n## 10x10 の生成条件ごとの、つながりの手詰まり2回以上の割合（一意の中で）")
    for key in sorted({(r['cond']['density'], r['cond']['p2'], r['cond']['extra']) for r in uniq if r['cond']['w'] == 10}):
        rs = [r for r in uniq if r['cond']['w'] == 10 and (r['cond']['density'], r['cond']['p2'], r['cond']['extra']) == key]
        good = [r for r in rs if r['human_status'] == 'solved' and r['max_tier'] != 'T' and r['conn_rounds'] >= 2]
        tot = sum(1 for r in rows if r['cond']['w'] == 10 and (r['cond']['density'], r['cond']['p2'], r['cond']['extra']) == key)
        print(f"d={key[0]} p2={key[1]} extra={key[2]}: 候補 {tot} 一意 {len(rs)} 連結2回以上 {len(good)} ({len(good)/tot:.1%} of 候補)")
    print("\n## 仮のレベル案 P の分類")
    cls = defaultdict(list)
    for r in uniq:
        cls[classify(r)].append(r)
    for k in sorted(cls):
        rs = cls[k]
        line = f"{k}: {len(rs)}"
        if k.startswith("L"):
            nb = [statistics.median([x[1] for x in r['naive']]) for r in rs]
            line += (f" 盤面 {dict(Counter(r['cond']['w'] for r in rs))} 島 {p3([r['n'] for r in rs])}"
                     f" 入口 {p3([r['entry'] for r in rs])} Aだけ {p3([r['a_only_progress'] for r in rs])}"
                     f" 連結手詰まり {p3([r['conn_rounds'] for r in rs])} N2戻し {p3(nb)}"
                     f" 全灰色非連結 {p3([sum(x[2] for x in r['naive'])/5 for r in rs])}")
        print(line)
    print("\n## 時間")
    gs = [r["human_seconds"] for r in uniq]
    print(f"人間向け解法器 秒 p50 {pct(gs,0.5)} p95 {pct(gs,0.95)} max {max(gs) if gs else None}")


def med_bt(r, key="naive"):
    return statistics.median([x[1] for x in r[key]])


def cmd_l5(a) -> None:
    """10x10 で、つながりの読みが要る問題を絞る条件ごとの収率と、素朴な解き方の手応え。"""
    rows = [r for path in a.paths for r in load(path) if r["cond"]["w"] == 10]
    total = len(rows)
    ok = [r for r in rows if r["status"] == "unique" and r["human_status"] == "solved" and r["max_tier"] != "T"]
    out_t = sum(1 for r in rows if r["status"] == "unique" and r["max_tier"] == "T")
    print(f"10x10 候補 {total} 一意で A〜D で解ける {len(ok)} 試し置きが要る {out_t}")
    filters = {
        "全部（A〜D で解ける一意解）": lambda r: True,
        "つながり1回以上": lambda r: r["conn_rounds"] >= 1,
        "つながり1回以上（2島の閉路だけは除く）": lambda r: r["deep_conn_rounds"] >= 1,
        "つながり2回以上": lambda r: r["conn_rounds"] >= 2,
        "つながり3回以上": lambda r: r["conn_rounds"] >= 3,
        "つながり2回以上 かつ 連結無視の解3以上": lambda r: r["conn_rounds"] >= 2 and r["noconn_solutions"] >= 3,
        "つながり2回以上 かつ N2戻し中央値3以上": lambda r: r["conn_rounds"] >= 2 and med_bt(r) >= 3,
        "つながり1回以上 かつ N2戻し中央値3以上": lambda r: r["conn_rounds"] >= 1 and med_bt(r) >= 3,
        "つながり2回以上 かつ 慣れた試し置き戻し中央値2以上": lambda r: r["conn_rounds"] >= 2 and med_bt(r, "naive_mc") >= 2,
    }
    print("| 条件 | 件数 | 候補に対する割合 | 島 | Aだけの進み | つながりの手詰まり | N2戻し | N2全灰色で非連結 | 慣れた試し置き戻し | N2で戻し0の割合 |")
    print("|---|---:|---:|---|---|---|---|---|---|---:|")
    for name, f in filters.items():
        rs = [r for r in ok if f(r)]
        if not rs:
            print(f"| {name} | 0 | 0 | | | | | | | |")
            continue
        zero = sum(1 for r in rs for x in r["naive"] if x[1] == 0) / (5 * len(rs))
        print(f"| {name} | {len(rs)} | {len(rs)/total:.1%} | {p3([r['n'] for r in rs])} | {p3([r['a_only_progress'] for r in rs])} "
              f"| {p3([r['conn_rounds'] for r in rs])} | {p3([med_bt(r) for r in rs])} | {p3([sum(x[2] for x in r['naive'])/5 for r in rs])} "
              f"| {p3([med_bt(r, 'naive_mc') for r in rs])} | {zero:.0%} |")
    print("\n生成条件ごとの「つながり2回以上」の収率（候補に対して）")
    for key in sorted({(r['cond']['density'], r['cond']['p2'], r['cond']['extra']) for r in rows}):
        rs = [r for r in rows if (r['cond']['density'], r['cond']['p2'], r['cond']['extra']) == key]
        g1 = sum(1 for r in ok if (r['cond']['density'], r['cond']['p2'], r['cond']['extra']) == key and r['conn_rounds'] >= 1)
        g2 = sum(1 for r in ok if (r['cond']['density'], r['cond']['p2'], r['cond']['extra']) == key and r['conn_rounds'] >= 2)
        u = sum(1 for r in rs if r['status'] == 'unique')
        print(f"d={key[0]} p2={key[1]} extra={key[2]}: 候補 {len(rs)} 一意 {u/len(rs):.0%} つながり1回以上 {g1/len(rs):.1%} 2回以上 {g2/len(rs):.1%}")
    print("\n推論の種類（つながり1回以上の 10x10 で、各段が1回以上現れる割合）")
    rs = [r for r in ok if r["conn_rounds"] >= 1]
    print(" ".join(f"{t}:{sum(1 for r in rs if t in r['tier_rounds'])/len(rs):.0%}" for t in TIER_ORDER))


def classify_q(r: dict) -> str:
    """レベル案 Q: 規模（盤面）× 推論の種類 × 手詰まりの回数・試し置きでの押し切りにくさ。"""
    if r.get("status") != "unique":
        return "invalid"
    if r.get("human_status") != "solved":
        return "unsupported"
    if r["max_tier"] == "T":
        return "out:needs-trial"
    size = r["cond"]["w"]
    mt = r["max_tier"]
    conn = r["conn_rounds"]
    deep = r["deep_conn_rounds"]
    a2 = r["a2_rounds"]
    if TIER_RANK[mt] <= TIER_RANK["A2"]:
        if size in (6, 7) and a2 <= 1:
            return "L1"
        if size in (7, 8) and a2 >= 2:
            return "L2"
        return "out:combo"
    if size in (8, 9) and conn == 1 and deep == 0:
        return "L3"
    if size in (9, 10) and deep >= 1 and conn == 1:
        return "L4"
    if size == 10 and conn >= 2 and med_bt(r) >= 3:
        return "L5"
    return "out:combo"


def classify_r(r: dict) -> str:
    """レベル案 R: Q の L3/L4 の逆転（数字だけで進む割合）を、数字だけで進む割合の範囲で直したもの。"""
    if r.get("status") != "unique":
        return "invalid"
    if r.get("human_status") != "solved":
        return "unsupported"
    if r["max_tier"] == "T":
        return "out:needs-trial"
    size = r["cond"]["w"]
    mt = r["max_tier"]
    conn = r["conn_rounds"]
    a2 = r["a2_rounds"]
    ao = r["a_only_progress"]
    if TIER_RANK[mt] <= TIER_RANK["A2"]:
        if size in (6, 7) and a2 == 0:
            return "L1"
        if size in (7, 8) and a2 >= 1:
            return "L2"
        return "out:combo"
    if size == 10 and conn >= 2 and ao < 0.4 and med_bt(r) >= 3:
        return "L5"
    if size in (9, 10) and ao < 0.5 and med_bt(r) >= 1:
        return "L4"
    if size in (8, 9) and conn == 1 and ao >= 0.5:
        return "L3"
    return "out:combo"


SCHEMES = {"Q": classify_q, "R": classify_r}


def cmd_levels(a) -> None:
    global classify_q
    rows = [r for path in a.paths for r in load(path)]
    classify_q = SCHEMES[a.scheme]
    cls = defaultdict(list)
    for r in rows:
        cls[classify_q(r)].append(r)
    print(f"候補 {len(rows)}")
    print("| 分類 | 件数 | 盤面の内訳 |")
    print("|---|---:|---|")
    for k in sorted(cls):
        print(f"| {k} | {len(cls[k])} | {dict(sorted(Counter(r['cond']['w'] for r in cls[k]).items()))} |")
    lv = [f"L{i}" for i in range(1, 6)]
    feats = [
        ("島の数", lambda r: r["n"]),
        ("入口（初手で決まる行き先）", lambda r: r["entry"]),
        ("入口 ÷ 行き先の数", lambda r: round(r["entry"] / r["edges"], 2)),
        ("A2 の手詰まり", lambda r: r["a2_rounds"]),
        ("つながりの手詰まり", lambda r: r["conn_rounds"]),
        ("局所の本数推論だけで決まる割合", lambda r: r["a_only_progress"]),
        ("連結を無視した解の数(上限20)", lambda r: r["noconn_solutions"]),
        ("N2 戻し（中央値/問）", lambda r: med_bt(r)),
        ("N2 全灰色で非連結（平均/問）", lambda r: sum(x[2] for x in r["naive"]) / 5),
        ("慣れた試し置き 戻し", lambda r: med_bt(r, "naive_mc")),
        ("2本橋の割合", lambda r: round(r["doubles"] / r["pairs"], 2)),
        ("交差で消える行き先", lambda r: r["crossing_kills"]),
    ]
    print("\n| 特徴（10/50/90） | " + " | ".join(lv) + " |")
    print("|---|" + "---|" * 5)
    for name, f in feats:
        print(f"| {name} | " + " | ".join(p3([f(r) for r in cls.get(l, [])]) for l in lv) + " |")
    print("\nN2 で戻し0（1回目で解けた）の割合: " + ", ".join(
        f"{l} {sum(1 for r in cls.get(l, []) for x in r['naive'] if x[1] == 0) / max(1, 5 * len(cls.get(l, []))):.0%}" for l in lv))
    print("\n推論の種類の出現（各段が1回以上現れる問題の割合）")
    for l in lv:
        rs = cls.get(l, [])
        if rs:
            print(f"{l}: " + " ".join(f"{t}:{sum(1 for r in rs if t in r['tier_rounds'])/len(rs):.0%}" for t in TIER_ORDER))
    print("\n共有する盤面での分かれ方（同じ盤面の中での件数）")
    for sz, pair in ((7, ("L1", "L2")), (8, ("L2", "L3")), (9, ("L3", "L4")), (10, ("L4", "L5"))):
        tot = sum(1 for r in rows if r["cond"]["w"] == sz)
        a_ = sum(1 for r in cls[pair[0]] if r["cond"]["w"] == sz)
        b_ = sum(1 for r in cls[pair[1]] if r["cond"]["w"] == sz)
        print(f"{sz}x{sz}: 候補 {tot} {pair[0]} {a_} {pair[1]} {b_}")
    print("\nレベル内の盤面ごとの中央値（C2: 広い盤面ほど易しくなっていないか）")
    for l in lv:
        for sz in sorted({r['cond']['w'] for r in cls.get(l, [])}):
            rs = [r for r in cls[l] if r['cond']['w'] == sz]
            print(f"{l} {sz}x{sz} n={len(rs)} 島 {pct([r['n'] for r in rs],0.5)} Aだけ {pct([r['a_only_progress'] for r in rs],0.5)}"
                  f" N2戻し {pct([med_bt(r) for r in rs],0.5)} 入口/辺 {pct([r['entry']/r['edges'] for r in rs],0.5)}")
    ok = [r for l in lv for r in cls.get(l, [])]
    lvl = [int(classify_q(r)[1]) for r in ok]
    series = {
        "レベル": lvl,
        "盤面": [r["cond"]["w"] for r in ok],
        "島の数": [r["n"] for r in ok],
        "最高段": [TIER_RANK[r["max_tier"]] for r in ok],
        "手詰まり計": [r["a2_rounds"] + r["conn_rounds"] for r in ok],
        "N2戻し": [med_bt(r) for r in ok],
        "入口/辺": [r["entry"] / r["edges"] for r in ok],
    }
    print("\n系統どうしの順位相関（レベル案 Q に入った問題）")
    names = list(series)
    print("| | " + " | ".join(names) + " |")
    print("|---|" + "---|" * len(names))
    for x in names:
        print(f"| {x} | " + " | ".join(str(spearman(series[x], series[y])) for y in names) + " |")
    print("\nレベルごとの生成条件 p2（2本橋の出やすさ）の内訳")
    for l in lv:
        print(f"{l}: {dict(sorted(Counter(r['cond']['p2'] for r in cls.get(l, [])).items()))}")
    print("\n各レベルの最も弱い問題（N2戻しが最小、Aだけの進みが最大）")
    for l in lv:
        rs = cls.get(l, [])
        if rs:
            r = min(rs, key=lambda r: (med_bt(r), -r["a_only_progress"]))
            print(f"{l}: seed {r['seed']} cond {r['cond']} {r['cond']['w']}x{r['cond']['w']} 島 {r['n']} 段 {r['tier_rounds']} Aだけ {r['a_only_progress']} N2 {[x[1] for x in r['naive']]}")


def selfcheck(a) -> None:
    """(1) 小さな盤面で総当たりと完全な解法器の解の数が一致するか。
    (2) 盤面を回転・反転しても人間向け解法器の段と回数が変わらないか（A3）。"""
    import itertools

    rng = random.Random(7)
    mism = 0
    tested = 0
    while tested < 300:
        g = generate(5, 5, rng.choice((4, 5, 6, 7)), 0.4, 0.3, rng)
        if g is None:
            continue
        p, _ = g
        if len(p.edges) > 11:
            continue
        tested += 1
        brute = 0
        for vals in itertools.product((0, 1, 2), repeat=len(p.edges)):
            if any(vals[e] and vals[f] for e in range(len(p.edges)) for f in p.cross[e]):
                continue
            if any(sum(vals[e] for e in p.inc[i]) != p.nums[i] for i in range(len(p.islands))):
                continue
            if len(set(components_lo(p, list(vals)))) != 1:
                continue
            brute += 1
        cnt, _, _, _ = count_solutions(p, 10, True)
        if min(brute, 10) != cnt:
            mism += 1
    print(f"総当たりとの解の数の不一致 {mism}/{tested}")
    rows = [r for r in load(a.path) if r.get("status") == "unique"][:400]
    changed = 0
    for r in rows:
        w = r["cond"]["w"]
        base = None
        for k in range(8):
            isl = []
            for (rr, cc) in r["islands"]:
                x, y, ww, hh = rr, cc, w, r["cond"]["h"]
                for _ in range(k % 4):
                    x, y = y, hh - 1 - x
                    ww, hh = hh, ww
                if k >= 4:
                    y = ww - 1 - y
                isl.append((x, y))
            p = Puzzle(w, w, isl, list(r["nums"]))
            p.build()
            st, log, _, _ = human_solve(p, "T")
            sig = (st, tuple(sorted(Counter(t for t, _ in log).items())))
            if base is None:
                base = sig
            elif sig != base:
                changed += 1
                break
    print(f"回転・反転で段と回数が変わった問題 {changed}/{len(rows)}")


def cmd_show(a) -> None:
    rows = load(a.path)
    r = rows[a.index]
    w, h = r["cond"]["w"], r["cond"]["h"]
    grid = [["." for _ in range(w)] for _ in range(h)]
    for (rr, cc), v in zip(r["islands"], r["nums"]):
        grid[rr][cc] = str(v)
    print("\n".join(" ".join(row) for row in grid))
    print({k: r.get(k) for k in ("max_tier", "tier_rounds", "log", "noconn_solutions", "naive")})


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("corpus")
    c.add_argument("--out", required=True)
    c.add_argument("--per", type=int, default=40)
    c.add_argument("--workers", type=int, default=4)
    c.add_argument("--set", default="main", choices=["main", "l5"])
    r = sub.add_parser("report")
    r.add_argument("path")
    l5 = sub.add_parser("l5")
    l5.add_argument("paths", nargs="+")
    lq = sub.add_parser("levels")
    lq.add_argument("paths", nargs="+")
    lq.add_argument("--scheme", default="R", choices=["Q", "R"])
    sc = sub.add_parser("selfcheck")
    sc.add_argument("path")
    s = sub.add_parser("show")
    s.add_argument("path")
    s.add_argument("index", type=int)
    a = ap.parse_args()
    {"corpus": cmd_corpus, "report": cmd_report, "show": cmd_show, "l5": cmd_l5, "levels": cmd_levels, "selfcheck": selfcheck}[a.cmd](a)


if __name__ == "__main__":
    main()
