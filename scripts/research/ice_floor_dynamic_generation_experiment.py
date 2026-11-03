"""氷の床迷路（作業名）の生成 v3: 盤面の状態が変わる要素を足した問題を作る実験。

駒1つ・静的な盤面は停止点のグラフが小さく、人が最初の数秒で読み切れる。止め役が動く・消える・
現れる要素を1種類ずつ足し、状態（駒の位置と変化したマスの集合）の BFS で解き、
v2（ice_floor_tactic_generation_experiment）と同じ山登りで問題を作る。

要素（盤面の文字）:
- duo: 駒が2つ。主駒 A（ゴールへ運ぶ）と相棒 B を1手ずつ選んで滑らせる。もう一方の駒も止め役。
- brittle ``b``: 止め役。駒が滑ってぶつかって止まると、その滑りの後で崩れて氷になる。
- cracked ``c``: 氷。駒がいたマスは、駒が離れた滑りの後で岩になる。
- snow ``s``: 滑って入った駒をそこで止める。駒がそこから動くと氷になる。
- ``x``: 盤面の外。外壁と同じ止め役。出力時に、駒が一度も通らない氷と、そのマスにしか
  接していない岩をこれに置き換える。

Python標準ライブラリだけを使う。乱数はすべて seed と条件名から作り、結果を再現可能にする。
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import sys
import time
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field, replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import TIE_ORDERS, Shape  # noqa: E402
from ice_floor_hard_generation_experiment import features_of, parallel, stop_tables  # noqa: E402
from ice_floor_supply_experiment import DX, DY, FLOOR, ICE, ROCK, Board  # noqa: E402
from ice_floor_tactic_generation_experiment import lookahead_solves  # noqa: E402

OUTSIDE = "x"
VARIANTS = ("duo", "brittle", "cracked", "snow")
ELEMENT_TILE = {"brittle": "b", "cracked": "c", "snow": "s"}
VARIANT_LABEL = {"duo": "相棒の駒", "brittle": "もろい岩", "cracked": "割れる氷", "snow": "雪の床"}
DIRECTION_WORDS = ("up", "right", "down", "left")
# 要素を変化しないマスに置き換えた静的盤面。looks は初期盤面の見た目どおり、other はもう一方の
# ふつうのマス。duo の looks は B を岩とみなして A だけを動かす盤面、other は B を除いた盤面
STATIC_TILES = {
    "brittle": {"looks": ROCK, "other": ICE},
    "cracked": {"looks": ICE, "other": ROCK},
    "snow": {"looks": FLOOR, "other": ICE},
}
NEAR_SLACK = 2
# 静的盤面の最短手数がこれ以上長いと「大きく遠回り」
DETOUR = 4
PLAN_CAP = 64
STATIC_SOLUTION_CAP = 200
MAX_GOALS = 4


# ---------------------------------------------------------------------------
# 規則


@dataclass(frozen=True)
class Puzzle:
    variant: str
    width: int
    height: int
    cells: str
    start: int
    goal: int = -1
    partner: int = -1  # duo の B。それ以外は -1

    @property
    def rows(self) -> list[str]:
        w = self.width
        return [self.cells[y * w : (y + 1) * w] for y in range(self.height)]


@dataclass(frozen=True)
class Step:
    """1手の詳細。path は動いた駒の滑る前の位置から止まった位置まで。"""

    move: int
    state: int
    path: tuple[int, ...]
    events: tuple[str, ...]


class Rules:
    """状態を整数で表す。単駒の要素は mask * n + 駒の位置（mask は変化した要素のビット）、
    duo は B の位置 * n + A の位置。どちらも state % n が主駒の位置。

    手は方向番号（0=上, 1=右, 2=下, 3=左）。duo は B の手を 4+方向で表す。
    その場から動かない入力は手にならない（本番の「成立しない向きの入力」と同じ）。"""

    def __init__(self, variant: str, width: int, height: int, cells: str) -> None:
        self.variant = variant
        self.width = width
        self.height = height
        self.n = n = width * height
        self.cells = cells
        self.base_rock = [tile in (ROCK, OUTSIDE) for tile in cells]
        self.floor = [tile == FLOOR for tile in cells]
        tile = ELEMENT_TILE.get(variant)
        self.elements = [c for c, t in enumerate(cells) if t == tile] if tile else []
        self.element_of = [-1] * n
        for j, cell in enumerate(self.elements):
            self.element_of[cell] = j
        self.beyond = [
            [
                (y + DY[d]) * width + x + DX[d]
                if 0 <= x + DX[d] < width and 0 <= y + DY[d] < height
                else -1
                for y in range(height)
                for x in range(width)
            ]
            for d in range(4)
        ]
        self.delta = tuple(DY[d] * width + DX[d] for d in range(4))
        self._tables: dict[int, tuple[list[int], ...]] = {}
        self.moves: Callable[[int], list[tuple[int, int]]] = {
            "plain": self._moves_plain,
            "duo": self._moves_duo,
            "brittle": self._moves_brittle,
            "cracked": self._moves_cracked,
            "snow": self._moves_snow,
        }[variant]

    def tables(self, mask: int) -> tuple[list[int], ...]:
        found = self._tables.get(mask)
        if found is None:
            rock = list(self.base_rock)
            floor = self.floor
            for j, cell in enumerate(self.elements):
                changed = bool(mask >> j & 1)
                if self.variant == "brittle" and not changed:
                    rock[cell] = True
                elif self.variant == "cracked" and changed:
                    rock[cell] = True
            if self.variant == "snow":
                floor = list(self.floor)
                for j, cell in enumerate(self.elements):
                    floor[cell] = not mask >> j & 1
            found = self._tables[mask] = stop_tables(self.width, self.height, rock, floor)
        return found

    def initial(self, start: int, partner: int = -1) -> int:
        return partner * self.n + start if self.variant == "duo" else start

    def on_segment(self, origin: int, d: int, end: int, cell: int) -> bool:
        """cell が origin から d へ end まで滑る間（origin を除き end を含む）にある。"""
        w = self.width
        ox, oy, ex, ey, cx, cy = origin % w, origin // w, end % w, end // w, cell % w, cell // w
        if d == 0:
            return cx == ox and ey <= cy < oy
        if d == 1:
            return cy == oy and ox < cx <= ex
        if d == 2:
            return cx == ox and oy < cy <= ey
        return cy == oy and ex <= cx < ox

    def _moves_plain(self, state: int) -> list[tuple[int, int]]:
        tables = self.tables(0)
        return [(d, tables[d][state]) for d in range(4) if tables[d][state] != state]

    def _blocked_end(self, origin: int, d: int, other: int, tables: tuple[list[int], ...]) -> int:
        end = tables[d][origin]
        if end != origin and self.on_segment(origin, d, end, other):
            end = other - self.delta[d]
        return end

    def _moves_duo(self, state: int) -> list[tuple[int, int]]:
        n = self.n
        a, b = state % n, state // n
        tables = self.tables(0)
        out = []
        for d in range(4):
            end = self._blocked_end(a, d, b, tables)
            if end != a:
                out.append((d, b * n + end))
        for d in range(4):
            end = self._blocked_end(b, d, a, tables)
            if end != b:
                out.append((4 + d, end * n + a))
        return out

    def _moves_brittle(self, state: int) -> list[tuple[int, int]]:
        n = self.n
        pos, mask = state % n, state // n
        tables = self.tables(mask)
        out = []
        for d in range(4):
            end = tables[d][pos]
            if end == pos:
                continue
            hit = self.beyond[d][end]
            j = self.element_of[hit] if hit >= 0 else -1
            out.append((d, (mask | (1 << j) if j >= 0 else mask) * n + end))
        return out

    def _moves_cracked(self, state: int) -> list[tuple[int, int]]:
        n = self.n
        pos, mask = state % n, state // n
        tables = self.tables(mask)
        out = []
        for d in range(4):
            end = tables[d][pos]
            if end == pos:
                continue
            after = mask
            for j, cell in enumerate(self.elements):
                left_behind = cell == pos or (cell != end and self.on_segment(pos, d, end, cell))
                if left_behind and not mask >> j & 1:
                    after |= 1 << j
            out.append((d, after * n + end))
        return out

    def _moves_snow(self, state: int) -> list[tuple[int, int]]:
        n = self.n
        pos, mask = state % n, state // n
        tables = self.tables(mask)
        j = self.element_of[pos]
        after = mask | (1 << j) if j >= 0 else mask
        return [(d, after * n + tables[d][pos]) for d in range(4) if tables[d][pos] != pos]

    def step(self, state: int, move: int) -> Step | None:
        """手の詳細（滑った道と要素の出来事）。動かない入力は None。"""
        target = dict(self.moves(state)).get(move)
        if target is None:
            return None
        n = self.n
        d = move % 4
        if self.variant == "duo":
            moved_b = move >= 4
            origin = state // n if moved_b else state % n
            end = target // n if moved_b else target % n
        else:
            origin, end = state % n, target % n
        path = [origin]
        cell = origin
        while cell != end:
            cell += self.delta[d]
            path.append(cell)
        events: list[str] = []
        hit = self.beyond[d][end]
        mask = state // n
        if self.variant == "duo":
            if move >= 4:
                events.append("B")
            elif hit == state // n:
                events.append("stop_on_B")
        elif self.variant == "brittle":
            j = self.element_of[hit] if hit >= 0 else -1
            if j >= 0 and not mask >> j & 1:
                events.append(f"break:{j}")
            for c in path[1:]:
                j = self.element_of[c]
                if j >= 0 and mask >> j & 1:
                    events.append(f"pass_broken:{j}")
        elif self.variant == "cracked":
            j = self.element_of[hit] if hit >= 0 else -1
            if j >= 0 and mask >> j & 1:
                events.append(f"stop_on_crack:{j}")
            for c in path[:-1]:
                j = self.element_of[c]
                if j >= 0 and not mask >> j & 1:
                    events.append(f"crack:{j}")
        elif self.variant == "snow":
            j = self.element_of[end]
            if j >= 0 and not mask >> j & 1:
                events.append(f"snow_stop:{j}")
            for c in path[1:-1]:
                j = self.element_of[c]
                if j >= 0 and mask >> j & 1:
                    events.append(f"pass_melted:{j}")
        return Step(move, target, tuple(path), tuple(events))


# 要素を「使った」とみなす出来事。duo の B の手は別に数える
USE_EVENTS = {
    "duo": ("stop_on_B",),
    "brittle": ("break", "pass_broken"),
    "cracked": ("stop_on_crack",),
    "snow": ("snow_stop", "pass_melted"),
}


def rules_of(p: Puzzle) -> Rules:
    return Rules(p.variant, p.width, p.height, p.cells)


def move_name(variant: str, move: int) -> str:
    word = DIRECTION_WORDS[move % 4]
    if variant == "duo":
        return ("B:" if move >= 4 else "A:") + word
    return word


# ---------------------------------------------------------------------------
# 状態の BFS


@dataclass
class Graph:
    """開始状態から到達できる状態。goal を与えると、主駒がゴールで止まった状態は終わり
    （手が無い）。"""

    rules: Rules
    start: int
    goal: int
    dist: dict[int, int]
    order: list[int]
    succ: dict[int, list[tuple[int, int]]]


def explore_states(rules: Rules, start: int, goal: int = -1) -> Graph:
    n = rules.n
    dist = {start: 0}
    order = [start]
    succ: dict[int, list[tuple[int, int]]] = {}
    moves = rules.moves
    for state in order:
        if state % n == goal:
            succ[state] = []
            continue
        out = moves(state)
        succ[state] = out
        step = dist[state] + 1
        for _, nxt in out:
            if nxt not in dist:
                dist[nxt] = step
                order.append(nxt)
    return Graph(rules, start, goal, dist, order, succ)


def with_goal(free: Graph, goal: int) -> Graph:
    """ゴールを持たない BFS から、主駒がゴールで止まった状態を終わりにした BFS を作る。"""
    n = free.rules.n
    dist = {free.start: 0}
    order = [free.start]
    succ: dict[int, list[tuple[int, int]]] = {}
    for state in order:
        out = [] if state % n == goal else free.succ[state]
        succ[state] = out
        step = dist[state] + 1
        for _, nxt in out:
            if nxt not in dist:
                dist[nxt] = step
                order.append(nxt)
    return Graph(free.rules, free.start, goal, dist, order, succ)


def goal_states(g: Graph) -> list[int]:
    n = g.rules.n
    return [s for s in g.order if s % n == g.goal]


def reverse_layers(g: Graph) -> dict[int, int]:
    pred: dict[int, list[int]] = {}
    for s, out in g.succ.items():
        for _, t in out:
            pred.setdefault(t, []).append(s)
    to_goal = {s: 0 for s in goal_states(g)}
    queue = list(to_goal)
    for s in queue:
        for prev in pred.get(s, ()):
            if prev not in to_goal:
                to_goal[prev] = to_goal[s] + 1
                queue.append(prev)
    return to_goal


def canonical_solution(g: Graph, to_goal: dict[int, int]) -> list[int]:
    """手の番号の小さい手を優先した最短解。"""
    state, moves = g.start, []
    while to_goal[state]:
        move, state = next((m, t) for m, t in g.succ[state] if to_goal.get(t) == to_goal[state] - 1)
        moves.append(move)
    return moves


def count_plans(g: Graph, to_goal: dict[int, int], shortest: int) -> int:
    """最短解の数。duo は A の手の列と B の手の列の組で数え、独立な手の入れ替えを同じ解とみなす。"""
    on = sorted(
        (s for s in g.dist if s in to_goal and g.dist[s] + to_goal[s] == shortest),
        key=g.dist.__getitem__,
    )
    on_set = set(on)
    ends = [s for s in on if to_goal[s] == 0]
    if g.rules.variant != "duo":
        ways = {g.start: 1}
        for s in on:
            for _, t in g.succ[s]:
                if t in on_set and g.dist[t] == g.dist[s] + 1:
                    ways[t] = ways.get(t, 0) + ways.get(s, 0)
        return sum(ways.get(s, 0) for s in ends)
    plans: dict[int, set[tuple[tuple[int, ...], tuple[int, ...]]]] = {g.start: {((), ())}}
    for s in on:
        here = plans.get(s, set())
        for m, t in g.succ[s]:
            if t not in on_set or g.dist[t] != g.dist[s] + 1:
                continue
            bucket = plans.setdefault(t, set())
            for a, b in here:
                if len(bucket) >= PLAN_CAP:
                    break
                bucket.add((a + (m,), b) if m < 4 else (a, b + (m,)))
    found: set = set()
    for s in ends:
        found |= plans.get(s, set())
    return min(len(found), PLAN_CAP)


def replay(rules: Rules, start: int, moves: Sequence[int], goal: int) -> bool:
    """手を順に入力し、主駒がゴールで止まればクリア。動かない入力は何も起こさない。"""
    state = start
    n = rules.n
    for move in moves:
        target = dict(rules.moves(state)).get(move)
        if target is not None:
            state = target
            if state % n == goal:
                return True
    return False


def solution_events(rules: Rules, start: int, moves: Sequence[int]) -> list[Step]:
    steps = []
    state = start
    for move in moves:
        step = rules.step(state, move)
        assert step is not None
        steps.append(step)
        state = step.state
    return steps


def used_cells(g: Graph) -> set[int]:
    """到達できる全状態で、駒が通過・停止するマス。"""
    n, rules = g.rules.n, g.rules
    segments: set[tuple[int, int, int]] = set()
    for s, out in g.succ.items():
        for m, t in out:
            if rules.variant == "duo" and m >= 4:
                segments.add((s // n, m % 4, t // n))
            else:
                segments.add((s % n, m % 4, t % n))
    used: set[int] = set()
    for origin, d, end in segments:
        cell = origin
        used.add(cell)
        while cell != end:
            cell += rules.delta[d]
            used.add(cell)
    return used


def touched_elements(g: Graph) -> set[int]:
    """到達できるどこかの状態で変化する要素（duo は空）。"""
    n = g.rules.n
    found = 0
    for s in g.order:
        found |= s // n
    return {j for j in range(len(g.rules.elements)) if found >> j & 1}


# ---------------------------------------------------------------------------
# 要素を置き換えた静的盤面


def static_puzzle(p: Puzzle, which: str) -> Puzzle:
    """要素を変化しないマスに置き換えた単駒の盤面（variant は plain）。x は岩にする。"""
    cells = list(p.cells.replace(OUTSIDE, ROCK))
    if p.variant == "duo":
        if which == "looks":
            cells[p.partner] = ROCK
    else:
        tile = ELEMENT_TILE[p.variant]
        cells = [STATIC_TILES[p.variant][which] if t == tile else t for t in cells]
    return Puzzle("plain", p.width, p.height, "".join(cells), p.start, p.goal)


@dataclass(frozen=True)
class StaticResult:
    shortest: int | None  # None は解なし
    canonical_valid: bool  # 静的盤面の最短解（番号の小さい手を優先）が、元の規則でもクリアになる


def solve_static(p: Puzzle, which: str, dynamic: Rules, dynamic_start: int) -> StaticResult:
    sp = static_puzzle(p, which)
    rules = rules_of(sp)
    g = explore_states(rules, sp.start, sp.goal)
    to_goal = reverse_layers(g)
    if sp.start not in to_goal:
        return StaticResult(None, False)
    moves = canonical_solution(g, to_goal)
    return StaticResult(len(moves), replay(dynamic, dynamic_start, moves, p.goal))


def static_solutions(p: Puzzle, which: str) -> list[list[int]]:
    """静的盤面の最短解（STATIC_SOLUTION_CAP まで）。"""
    sp = static_puzzle(p, which)
    g = explore_states(rules_of(sp), sp.start, sp.goal)
    to_goal = reverse_layers(g)
    if sp.start not in to_goal:
        return []
    found: list[list[int]] = []
    stack: list[tuple[int, list[int]]] = [(sp.start, [])]
    while stack and len(found) < STATIC_SOLUTION_CAP:
        state, moves = stack.pop()
        if not to_goal[state]:
            found.append(moves)
            continue
        for m, t in g.succ[state]:
            if to_goal.get(t) == to_goal[state] - 1:
                stack.append((t, [*moves, m]))
    return found


# ---------------------------------------------------------------------------
# 特徴量


@dataclass(frozen=True)
class Metrics:
    shortest: int
    plans: int  # 最短解の数（duo は独立な手の入れ替えを同じとみなす）
    states: int  # 到達できる状態の数
    near_extra: int  # 最短+NEAR_SLACK 手以内の道筋に乗り、どの最短解にも乗らない状態
    dead_states: int  # ゴールへ二度と行けない状態
    forced: int  # 最短解のうち、まだ訪れていない状態へ行く手が1つしかない手
    trap_options: int  # 最短解の各手で、詰みの状態へ入る選択肢
    uses: int  # 最短解で要素を使った回数（USE_EVENTS）
    distinct: int  # 最短解で使った要素の数（duo は B の手の数）
    switches: int  # duo: 最短解で動かす駒が替わる回数
    events: dict[str, int]
    unused: int  # 駒が一度も通過・停止しない、岩でないマス
    idle_elements: int  # 到達できるどの状態でも変化しない要素
    elements: int
    looks: StaticResult  # 初期盤面の見た目どおり、要素が変化しないとみなした盤面
    other: StaticResult  # 要素をもう一方のふつうのマスに置き換えた盤面
    solution: tuple[int, ...]

    def need(self, detour: int, count_looks: bool = True) -> float:
        """要素を置き換えた静的盤面（2通り）が解けない（1）・元の規則で通らないか detour 手以上の
        遠回り（0.5）の合計。count_looks が偽なら、もう一方の盤面だけで数える。"""
        total = 0.0
        for result in (self.looks, self.other) if count_looks else (self.other,):
            if result.shortest is None:
                total += 1.0
            elif result.shortest >= self.shortest + detour or not result.canonical_valid:
                total += 0.5
        return total

    @property
    def misleads(self) -> bool:
        """見た目どおりの静的盤面では解けるが、その最短解が元の規則ではクリアにならない。"""
        return self.looks.shortest is not None and not self.looks.canonical_valid

    def looks_trap(self, detour: int) -> bool:
        """見た目どおりの静的盤面に解はあるが、元の規則では通らないか detour 手以上の遠回り。
        初期盤面から読んだ道筋が誤りになる。"""
        looks = self.looks
        return looks.shortest is not None and (
            not looks.canonical_valid or looks.shortest >= self.shortest + detour
        )

    def static_shortcut(self, detour: int) -> bool:
        """要素を変化しないとみなして解いた静的な解が、元の規則でも通り、最短から遠回りでない。
        見た目どおりの盤面は detour 手未満、もう一方は NEAR_SLACK 手以下の遠回りを近道とみなす。"""
        looks, other = self.looks, self.other
        return (
            looks.shortest is not None
            and looks.canonical_valid
            and looks.shortest < self.shortest + detour
        ) or (
            other.shortest is not None
            and other.canonical_valid
            and other.shortest <= self.shortest + NEAR_SLACK
        )


def measure(p: Puzzle, g: Graph | None = None) -> Metrics | None:
    """p.goal の問題の特徴量。解けなければ None。g は p.goal を終わりにした BFS。"""
    rules = g.rules if g else rules_of(p)
    start = rules.initial(p.start, p.partner)
    g = g or explore_states(rules, start, p.goal)
    to_goal = reverse_layers(g)
    if start not in to_goal:
        return None
    shortest = to_goal[start]
    solution = canonical_solution(g, to_goal)
    steps = solution_events(rules, start, solution)
    events = Counter(e.split(":")[0] for step in steps for e in step.events)
    used_kinds = USE_EVENTS[p.variant]
    uses = sum(events[k] for k in used_kinds)
    if p.variant == "duo":
        distinct = events["B"]
        movers = [m >= 4 for m in solution]
        switches = sum(1 for a, b in zip(movers, movers[1:], strict=False) if a != b)
    else:
        distinct = len(
            {e.split(":")[1] for st in steps for e in st.events if e.split(":")[0] in used_kinds}
        )
        switches = 0
    state, visited = start, {start}
    forced = traps = 0
    for move in solution:
        options = [t for _, t in g.succ[state] if t not in visited]
        forced += len(options) == 1
        traps += sum(1 for t in options if t not in to_goal)
        state = dict(g.succ[state])[move]
        visited.add(state)
    near = sum(
        1
        for s, d in g.dist.items()
        if s in to_goal and shortest < d + to_goal[s] <= shortest + NEAR_SLACK
    )
    used = used_cells(g)
    unused = sum(
        1 for c, t in enumerate(p.cells) if t not in (ROCK, OUTSIDE, "b") and c not in used
    )
    idle = len(rules.elements) - len(touched_elements(g))
    return Metrics(
        shortest=shortest,
        plans=count_plans(g, to_goal, shortest),
        states=len(g.dist),
        near_extra=near,
        dead_states=sum(1 for s in g.dist if s not in to_goal),
        forced=forced,
        trap_options=traps,
        uses=uses,
        distinct=distinct,
        switches=switches,
        events=dict(events),
        unused=unused,
        idle_elements=idle,
        elements=len(rules.elements),
        looks=solve_static(p, "looks", rules, start),
        other=solve_static(p, "other", rules, start),
        solution=tuple(solution),
    )


def dynamic_depth(p: Puzzle, max_depth: int, g: Graph | None = None) -> int:
    """v1 の読み深さのうち前向きと両方向のモデルを、状態のグラフに当てた深さ（規則を知って先を
    読む人）。逆向きのモデルは、状態が分からないゴール側からは辿れないので使わない。
    max_depth でも読めなければ max_depth + 1。"""
    rules = g.rules if g else rules_of(p)
    start = rules.initial(p.start, p.partner)
    g = g or explore_states(rules, start, p.goal)
    to_goal = reverse_layers(g)
    shortest = to_goal[start]
    limit = shortest + (shortest + 1) // 2 + 2
    n, w = rules.n, p.width
    gx, gy = p.goal % w, p.goal // w
    targets = frozenset(goal_states(g))
    orders = [tuple(order) + tuple(4 + r for r in order) for order in TIE_ORDERS]

    def to_goal_gap(s: int) -> tuple[int, ...]:
        a = s % n
        return (abs(a % w - gx) + abs(a // w - gy),)

    for depth in range(1, max_depth + 1):
        members = frozenset(s for s, d in to_goal.items() if d <= depth)
        spots = {s % n for s in members}

        def to_members(s: int, spots: set[int] = spots) -> tuple[int, ...]:
            a = s % n
            return (min(abs(a % w - c % w) + abs(a // w - c // w) for c in spots),)

        for chosen, score in ((targets, to_goal_gap), (members, to_members)):
            for order in orders:
                if lookahead_solves(g.succ, start, chosen, score, depth, limit, order):
                    return depth
    return max_depth + 1


def static_depth(p: Puzzle) -> int | None:
    """見た目どおりの静的盤面に v1/v2 の読み深さモデル（前向き・逆向き・両方向）を当てた深さ。
    静的盤面で解けなければ None。"""
    sp = static_puzzle(p, "looks")
    board = Board(sp.width, sp.height, sp.cells)
    g = explore_states(rules_of(sp), sp.start, sp.goal)
    if sp.goal not in g.dist:
        return None
    return features_of(board, sp.start, sp.goal).human_depth


# 要素が効くかを測る置き換え。雪の床は溶けない床に読んでも最短手数が変わらない
# （SNOW_LOOKS_DETOUR）ので、氷に置き換えて止め役として要るかを測る
ESSENTIAL_READING = {"snow": "other"}


def essential_elements(p: Puzzle, shortest: int) -> int:
    """要素を1つずつ見た目どおりの変化しないマス（ESSENTIAL_READING）に置き換えると、解けなくなる・
    最短手数が変わる要素の数。

    短くなるのは、変化しないなら使える止め役・通り道を変化のせいで使えない（もろい岩で2度止まれない、
    割れた氷を2度通れない）場合で、これも変化が効いている。
    duo は B を岩にした盤面で同じことを測る（0 か 1）。"""
    if p.variant == "duo":
        r = rules_of(p)
        result = solve_static(p, "looks", r, r.initial(p.start, p.partner))
        return int(result.shortest != shortest)
    count = 0
    looks = STATIC_TILES[p.variant][ESSENTIAL_READING.get(p.variant, "looks")]
    tile = ELEMENT_TILE[p.variant]
    for cell, t in enumerate(p.cells):
        if t != tile:
            continue
        cells = p.cells[:cell] + looks + p.cells[cell + 1 :]
        q = replace(p, cells=cells)
        rules = rules_of(q)
        g = explore_states(rules, rules.initial(q.start, q.partner), q.goal)
        to_goal = reverse_layers(g)
        start = rules.initial(q.start, q.partner)
        count += start not in to_goal or to_goal[start] != shortest
    return count


# ---------------------------------------------------------------------------
# 目的関数と山登り


@dataclass(frozen=True)
class Weights:
    need: float = 4.0  # 要素を置き換えた静的盤面（2通り）が解けない・大きく遠回り
    essential: float = 2.0  # 1つだけ見た目どおりにすると解けない・長くなる要素
    cap_essential: int = 4
    mislead: float = 2.0  # 見た目どおりの静的盤面の解が元の規則で通らない
    use: float = 1.5
    cap_use: int = 6
    distinct: float = 1.5
    cap_distinct: int = 4
    switch: float = 0.5  # duo: 駒の替わり
    cap_switch: int = 6
    trap: float = 1.0
    cap_trap: int = 3
    forced: float = 1.5
    near: float = 0.3
    cap_near: int = 60
    plans: float = 2.0
    unused: float = 0.3  # 駒が通らないマス1つあたり
    idle: float = 2.0  # 変化しない要素1つあたり
    read: float = 1.5
    read_cap: int = 3
    constraint: float = 6.0


@dataclass(frozen=True)
class Recipe:
    name: str
    variant: str
    shape: Shape
    lo: int
    hi: int
    min_elements: int = 2
    max_elements: int = 6
    min_uses: int = 2
    min_distinct: int = 2  # duo は B の手の数
    min_essential: int = 1
    min_dynamic_depth: int = 2
    # 見た目どおりの静的盤面の解が元の規則でも通るとき、それを近道とみなさない遠回りの手数
    looks_detour: int = DETOUR
    # 見た目どおりの静的盤面に、元の規則では誤りになる解があることを求める（looks_trap）
    looks_trap: bool = False
    iterations: int = 1500
    max_density: float = 0.30
    weights: Weights = field(default_factory=Weights)

    @property
    def label(self) -> str:
        if self.variant == "duo":
            parts = f"Bの手{self.min_distinct}以上"
        else:
            parts = f"要素{self.min_elements}〜{self.max_elements}個"
        return (
            f"{VARIANT_LABEL[self.variant]} {self.shape.label} {self.lo}〜{self.hi}手 "
            f"{parts} 使う{self.min_uses}回以上"
        )


# looks_trap の段で、見た目どおりの盤面が解けないときの不足。誤りにならない読み（近道）の不足
# （最大1）より重くし、解けない盤面から近道を経て遠回り・誤りの読みへ山登りが進めるようにする
TRAP_UNSOLVABLE_SHORTFALL = 1.5


def looks_shortfall(m: Metrics, r: Recipe) -> float:
    """見た目どおりの静的盤面の読みについての不足。looks_trap の段は、読みが誤りになるまでの
    遠回りの手数の不足に比例させる。"""
    looks = m.looks
    shortcut = (
        looks.shortest is not None
        and looks.canonical_valid
        and looks.shortest < m.shortest + r.looks_detour
    )
    if not r.looks_trap:
        return float(shortcut)
    if looks.shortest is None:
        return TRAP_UNSOLVABLE_SHORTFALL
    if not looks.canonical_valid:
        return 0.0
    return max(0, m.shortest + r.looks_detour - looks.shortest) / r.looks_detour


def shortfalls(m: Metrics, r: Recipe, essential: int) -> float:
    other = m.other
    return (
        (m.uses < r.min_uses)
        + (essential < r.min_essential)
        + (m.distinct < r.min_distinct)
        + (m.need(r.looks_detour) < 1)
        + looks_shortfall(m, r)
        + (
            other.shortest is not None
            and other.canonical_valid
            and other.shortest <= m.shortest + NEAR_SLACK
        )
        + (r.variant != "duo" and m.elements > r.max_elements)
    )


def score_of(m: Metrics, r: Recipe, essential: int) -> float:
    wt = r.weights
    return (
        wt.need * m.need(r.looks_detour, count_looks=not r.looks_trap)
        + wt.essential * min(essential, wt.cap_essential)
        + wt.mislead * m.misleads
        + wt.use * min(m.uses, wt.cap_use)
        + wt.distinct * min(m.distinct, wt.cap_distinct)
        + wt.switch * min(m.switches, wt.cap_switch)
        + wt.trap * min(m.trap_options, wt.cap_trap)
        - wt.forced * m.forced
        - wt.near * min(m.near_extra, wt.cap_near)
        - wt.plans * math.log2(max(m.plans, 1))
        - wt.unused * m.unused
        - wt.idle * m.idle_elements
        - wt.constraint * shortfalls(m, r, essential)
    )


Evaluation = tuple[float, int, Metrics | None]


def evaluate(p: Puzzle, r: Recipe, floor: float = -math.inf) -> Evaluation:
    """範囲 [lo, hi] の最短手数で主駒が止まれる氷のマスのうち、点が最もよいゴール。

    読み深さは重いので、読み深さの点を足しても floor（山登りの今の点）に届かないゴールでは
    求めない。"""
    rules = rules_of(p)
    start = rules.initial(p.start, p.partner)
    free = explore_states(rules, start)
    n = rules.n
    first: dict[int, int] = {}
    for s in free.order:
        first.setdefault(s % n, free.dist[s])
    candidates = sorted(
        (
            c
            for c, d in first.items()
            if r.lo <= d <= r.hi and p.cells[c] == ICE and c not in (p.start, p.partner)
        ),
        key=lambda c: (-first[c], c),
    )[:MAX_GOALS]
    if not candidates:
        return max(first.values(), default=0) - 100.0, -1, None
    scored = []
    for goal in candidates:
        q = replace(p, goal=goal)
        g = with_goal(free, goal)
        m = measure(q, g)
        assert m is not None
        essential = essential_elements(q, m.shortest)
        scored.append((score_of(m, r, essential), goal, m, g))
    scored.sort(key=lambda item: -item[0])
    wt = r.weights
    best: Evaluation | None = None
    for score, goal, m, g in scored:
        read_bonus = wt.read * (wt.read_cap + 1)
        if best is not None and score + read_bonus <= best[0]:
            break
        if wt.read and score + read_bonus >= floor:
            score += wt.read * dynamic_depth(replace(p, goal=goal), wt.read_cap, g)
        if best is None or score > best[0]:
            best = (score, goal, m)
    assert best is not None
    return best


class Searcher:
    """v1/v2 の山登り（悪くならなければ受理）に、要素と相棒の駒の近傍を足したもの。"""

    def __init__(self, recipe: Recipe, rng: random.Random) -> None:
        self.r = recipe
        self.rng = rng
        self.w, self.h = recipe.shape.width, recipe.shape.height
        self.n = self.w * self.h
        self.tile = ELEMENT_TILE.get(recipe.variant)
        self.max_rocks = int(recipe.max_density * self.n)
        self.min_rocks = int(0.08 * self.n)

    def free_cells(self, cells: list[str], p_start: int, partner: int) -> list[int]:
        return [c for c, t in enumerate(cells) if t == ICE and c not in (p_start, partner)]

    def initial(self) -> Puzzle:
        rng, r = self.rng, self.r
        cells = [ROCK if rng.random() < 0.18 else ICE for _ in range(self.n)]
        ice = [c for c, t in enumerate(cells) if t == ICE]
        start = ice[rng.randrange(len(ice))]
        partner = -1
        if r.variant == "duo":
            partner = rng.choice([c for c in ice if c != start])
        if self.tile:
            count = (r.min_elements + r.max_elements) // 2
            pool = self.free_cells(cells, start, partner)
            if r.variant == "brittle":
                pool += [c for c, t in enumerate(cells) if t == ROCK]
            for cell in rng.sample(pool, count):
                cells[cell] = self.tile
        return Puzzle(r.variant, self.w, self.h, "".join(cells), start, -1, partner)

    def mutate(self, p: Puzzle) -> Puzzle:
        rng, r = self.rng, self.r
        cells = list(p.cells)
        start, partner = p.start, p.partner
        roll = rng.random()
        free = self.free_cells(cells, start, partner)
        if roll < 0.08 and free:
            start = rng.choice(free)
        elif r.variant == "duo" and roll < 0.18 and free:
            partner = rng.choice(free)
        elif self.tile and roll < 0.38:
            self.mutate_elements(cells, start, partner)
        else:
            self.mutate_rocks(cells, start, partner)
        return replace(p, cells="".join(cells), start=start, partner=partner)

    def mutate_elements(self, cells: list[str], start: int, partner: int) -> None:
        rng, r, tile = self.rng, self.r, self.tile
        assert tile is not None
        placed = [c for c, t in enumerate(cells) if t == tile]
        hosts = self.free_cells(cells, start, partner)
        if r.variant == "brittle":
            hosts += [c for c, t in enumerate(cells) if t == ROCK]
        op = rng.random()
        if (op < 0.3 or not placed) and len(placed) < r.max_elements and hosts:
            cells[rng.choice(hosts)] = tile
        elif op < 0.5 and len(placed) > r.min_elements:
            cells[rng.choice(placed)] = rng.choice((ICE, ROCK)) if r.variant == "brittle" else ICE
        elif placed and hosts:
            source = rng.choice(placed)
            cells[source] = ICE if r.variant != "brittle" or rng.random() < 0.5 else ROCK
            cells[rng.choice(hosts)] = tile

    def mutate_rocks(self, cells: list[str], start: int, partner: int) -> None:
        rng = self.rng
        rocks = cells.count(ROCK)
        cell = rng.randrange(self.n)
        if cell in (start, partner) or cells[cell] not in (ICE, ROCK):
            return
        if rng.random() < 0.5:
            if cells[cell] == ROCK and rocks > self.min_rocks:
                cells[cell] = ICE
            elif cells[cell] == ICE and rocks < self.max_rocks:
                cells[cell] = ROCK
            return
        other = rng.randrange(self.n)
        if other in (start, partner) or cells[other] not in (ICE, ROCK):
            return
        if cells[cell] != cells[other]:
            cells[cell], cells[other] = cells[other], cells[cell]

    def run(self) -> tuple[float, Puzzle, Metrics | None]:
        p = self.initial()
        score, goal, m = evaluate(p, self.r)
        best = (score, replace(p, goal=goal), m)
        for _ in range(1, self.r.iterations):
            q = self.mutate(p)
            value, q_goal, q_m = evaluate(q, self.r, score)
            if value >= score:
                p, score = q, value
                if value >= best[0]:
                    best = (value, replace(q, goal=q_goal), q_m)
        return best


# ---------------------------------------------------------------------------
# 盤面の外（x）への置き換え


def outside_marked(p: Puzzle) -> Puzzle:
    """駒が一度も通らない氷・要素のマスと、そのマスにしか接していない岩を x にし、外周の x だけの
    行・列を切り落とす。どの状態でも崩れないもろい岩は岩にする。"""
    rules = rules_of(p)
    g = explore_states(rules, rules.initial(p.start, p.partner), p.goal)
    used = used_cells(g)
    touched = touched_elements(g)
    w, h = p.width, p.height
    cells = list(p.cells)
    for c, t in enumerate(p.cells):
        if c in used:
            continue
        if t in (ROCK, ELEMENT_TILE["brittle"]):
            x, y = c % w, c // w
            near = [
                (y + DY[d]) * w + x + DX[d]
                for d in range(4)
                if 0 <= x + DX[d] < w and 0 <= y + DY[d] < h
            ]
            if not any(cell in used for cell in near):
                cells[c] = OUTSIDE
            elif t == ELEMENT_TILE["brittle"] and rules.element_of[c] not in touched:
                cells[c] = ROCK
        else:
            cells[c] = OUTSIDE
    rows = ["".join(cells[y * w : (y + 1) * w]) for y in range(h)]
    keep_rows = [y for y, row in enumerate(rows) if set(row) != {OUTSIDE}]
    keep_cols = [x for x in range(w) if any(rows[y][x] != OUTSIDE for y in range(h))]
    y0, y1, x0, x1 = keep_rows[0], keep_rows[-1], keep_cols[0], keep_cols[-1]
    nw, nh = x1 - x0 + 1, y1 - y0 + 1

    def moved(c: int) -> int:
        return -1 if c < 0 else (c // w - y0) * nw + (c % w - x0)

    cropped = "".join(rows[y][x0 : x1 + 1] for y in range(y0, y1 + 1))
    return Puzzle(p.variant, nw, nh, cropped, moved(p.start), moved(p.goal), moved(p.partner))


def same_game(a: Puzzle, b: Puzzle) -> bool:
    """x への置き換えで、状態の数・最短手数・最短解の数・最短解の手が変わらない。"""
    ma, mb = measure(a), measure(b)
    if ma is None or mb is None:
        return False
    return (ma.states, ma.shortest, ma.plans, ma.solution) == (
        mb.states,
        mb.shortest,
        mb.plans,
        mb.solution,
    )


# ---------------------------------------------------------------------------
# 生成と採用


@dataclass
class Made:
    recipe: str
    variant: str
    puzzle: Puzzle  # x への置き換え後
    raw: Puzzle  # 置き換え前
    score: float
    seconds: float
    metrics: Metrics
    dyn_depth: int
    essential: int
    reasons: list[str]

    @property
    def accepted(self) -> bool:
        return not self.reasons


DYN_DEPTH_CAP = 8


def rejections(r: Recipe, m: Metrics, dyn_depth: int, essential: int) -> list[str]:
    reasons = []
    if not r.lo <= m.shortest <= r.hi:
        reasons.append("最短手数")
    if m.plans > 1:
        reasons.append("最短解が複数")
    if m.uses < r.min_uses:
        reasons.append("使う回数")
    if m.distinct < r.min_distinct:
        reasons.append("使う要素の数" if r.variant != "duo" else "Bの手")
    if m.need(r.looks_detour) < 1:
        reasons.append("要素が要らない")
    if r.looks_trap and not m.looks_trap(r.looks_detour):
        reasons.append("見た目どおりの読みが誤りにならない")
    if m.static_shortcut(r.looks_detour):
        reasons.append("静的な近道")
    if essential < r.min_essential:
        reasons.append("要素の変化が効かない")
    if m.forced > 0.25 * m.shortest:
        reasons.append("一本道")
    if dyn_depth < r.min_dynamic_depth:
        reasons.append("読み深さ")
    if m.idle_elements:
        reasons.append("変化しない要素")
    return reasons


def make(recipe: Recipe, seed: str) -> Made | None:
    started = time.perf_counter()
    score, raw, _ = Searcher(recipe, random.Random(seed)).run()
    if raw.goal < 0:
        return None
    puzzle = outside_marked(raw)
    assert same_game(raw, puzzle), f"{recipe.name}: x への置き換えで解が変わった"
    m = measure(puzzle)
    assert m is not None
    depth = dynamic_depth(puzzle, DYN_DEPTH_CAP)
    essential = essential_elements(puzzle, m.shortest)
    return Made(
        recipe.name,
        recipe.variant,
        puzzle,
        raw,
        score,
        time.perf_counter() - started,
        m,
        depth,
        essential,
        rejections(recipe, m, depth, essential),
    )


def make_task(task: tuple[Recipe, str]) -> Made | None:
    return make(*task)


# 雪の床を溶けない床とみなした解は、元の規則でも必ず通り、最短手数も変わらない（静的な最短の
# 道筋は同じ停止点へ二度止まらないので、溶けた雪で振る舞いが変わる滑りを含まない。溶けた雪を
# 通り抜けて縮む道筋も verify のランダム盤面で一度も出ない）。見た目どおりに読んでも最短で
# 解けるので、雪の床では見た目どおりの盤面を近道とみなさない
SNOW_LOOKS_DETOUR = 0
LOOKS_DETOUR = {"snow": SNOW_LOOKS_DETOUR}
# 見た目どおりの静的盤面に誤った解があることを求める段と要素。ほかの段は見た目どおりでは解けない
# 盤面がほとんどになる。duo は B を岩とみなした解が元の規則でも必ず通り、誤りは遠回りだけになるが、
# B を3手以上動かす最短解と両立する遠回りの読みは山登りでほぼ作れない（2手以上の遠回りでも8回中0）
LOOKS_TRAP_STEPS = (2, 4)
LOOKS_TRAP_VARIANTS = ("brittle", "cracked")
# 見た目どおりの読みが誤りになる盤面は採用率が低いので、その段は --runs のこの倍だけ作る
TRAP_RUN_FACTOR = 3


def plan_for(variant: str) -> list[Recipe]:
    """1つの要素の5段（難しさの幅）。要素の数・使う回数・読み深さの下限を段ごとに上げる。"""
    duo = variant == "duo"
    steps = (
        (Shape(8, 8), 12, 13, 2, 3, 2, 2, 2, 2),
        (Shape(8, 8), 13, 15, 2, 4, 2, 2, 2, 3),
        (Shape(10, 10), 15, 17, 3, 5, 3, 2, 2, 3),
        (Shape(10, 10), 17, 20, 3, 6, 3, 3, 2, 4),
        (Shape(10, 12), 20, 24, 4, 6, 4, 3, 3, 4),
    )
    recipes = []
    for index, (shape, lo, hi, min_el, max_el, uses, distinct, essential, depth) in enumerate(
        steps, 1
    ):
        recipes.append(
            Recipe(
                f"{variant}-{index}",
                variant,
                shape,
                lo,
                hi,
                min_elements=0 if duo else min_el,
                max_elements=0 if duo else max_el,
                min_uses=uses,
                min_distinct=distinct + 1 if duo else distinct,
                min_essential=1 if duo else essential,
                min_dynamic_depth=depth,
                looks_detour=LOOKS_DETOUR.get(variant, DETOUR),
                looks_trap=variant in LOOKS_TRAP_VARIANTS and index in LOOKS_TRAP_STEPS,
            )
        )
    return recipes


# ---------------------------------------------------------------------------
# 検証


def slow_moves(variant: str, p: Puzzle, grid: list[str], pieces: list[int]) -> list[tuple]:
    """1マスずつ進める独立の実装。grid は今のマス（崩れた岩は氷、割れた氷は岩、溶けた雪は氷）。"""
    w, h = p.width, p.height
    out = []
    movers = (0, 1) if variant == "duo" else (0,)
    for who in movers:
        for d in range(4):
            origin = pieces[who]
            cur = origin
            path = [cur]
            while True:
                x, y = cur % w + DX[d], cur // w + DY[d]
                if not (0 <= x < w and 0 <= y < h):
                    break
                nxt = y * w + x
                if grid[nxt] in (ROCK, OUTSIDE, "b") or nxt in pieces:
                    break
                cur = nxt
                path.append(cur)
                if grid[nxt] == "s":
                    break
            if cur == origin:
                continue
            new = list(grid)
            x, y = cur % w + DX[d], cur // w + DY[d]
            if 0 <= x < w and 0 <= y < h and new[y * w + x] == "b":
                new[y * w + x] = ICE
            for c in path[:-1]:
                if new[c] == "c":
                    new[c] = ROCK
            if new[origin] == "s":
                new[origin] = ICE
            moved = list(pieces)
            moved[who] = cur
            out.append((who * 4 + d, new, moved))
    return out


def encode(rules: Rules, p: Puzzle, grid: list[str], pieces: list[int]) -> int:
    if p.variant == "duo":
        return pieces[1] * rules.n + pieces[0]
    tile = ELEMENT_TILE[p.variant]
    mask = sum(1 << j for j, cell in enumerate(rules.elements) if grid[cell] != tile)
    return mask * rules.n + pieces[0]


def check_slow(p: Puzzle, limit: int = 3000) -> int:
    """到達できる状態（limit まで）で、速い実装の手と 1マスずつの実装の手が食い違う状態の数。"""
    rules = rules_of(p)
    pieces = [p.start, p.partner] if p.variant == "duo" else [p.start]
    queue = [(list(p.cells), pieces)]
    seen = {encode(rules, p, *queue[0])}
    mismatches = 0
    for grid, pcs in queue:
        if len(seen) > limit:
            break
        state = encode(rules, p, grid, pcs)
        fast = sorted(rules.moves(state))
        slow = slow_moves(p.variant, p, grid, pcs)
        expected = sorted((m, encode(rules, p, g2, p2)) for m, g2, p2 in slow)
        mismatches += fast != expected
        for _, g2, p2 in slow:
            key = encode(rules, p, g2, p2)
            if key not in seen:
                seen.add(key)
                queue.append((g2, p2))
    return mismatches


def run_hand_checks() -> None:
    """手で作った小盤面で、要素ごとの遷移が規則どおりになるか。"""

    def rules(variant: str, rows: list[str]) -> Rules:
        return Rules(variant, len(rows[0]), len(rows), "".join(rows))

    def go(r: Rules, state: int, move: int) -> int:
        return dict(r.moves(state))[move]

    def split(r: Rules, state: int) -> tuple[int, int]:
        return state % r.n, state // r.n

    r = rules("brittle", ["....b."])
    s = go(r, 0, 1)  # 右: b の手前で止まり、b が崩れる
    assert split(r, s) == (3, 1), s
    s = go(r, s, 3)
    assert split(r, s) == (0, 1)
    s = go(r, s, 1)  # 右: 崩れた b を通って右端へ
    assert split(r, s) == (5, 1)
    r = rules("brittle", [".b", ".."])
    assert 1 not in dict(r.moves(0)), "隣のもろい岩へ動かない入力は手にならず、崩さない"
    s = go(r, 0, 2)
    assert split(r, s) == (2, 0)

    r = rules("cracked", [".c.#.."])
    s = go(r, 0, 1)  # 右: c を通過して岩の手前で止まり、c が岩になる
    assert split(r, s) == (2, 1)
    assert 3 not in dict(r.moves(s)), "割れて岩になった c があるので左へ動けない"
    r = rules("cracked", [".#", "c.", ".."])
    s = go(r, 0, 2)  # 下: c を通過して最下段へ
    assert split(r, s) == (4, 1)
    assert 0 not in dict(r.moves(s)), "割れた c の下から上へ動けない"
    r = rules("cracked", ["c.", ".."])
    s = go(r, 1, 3)  # 左: c で止まる（外壁）。まだ割れない
    assert split(r, s) == (0, 0)
    s = go(r, s, 2)  # 下: c を離れたので割れる
    assert split(r, s) == (2, 1)
    assert 0 not in dict(r.moves(s)), "割れた c は止め役"
    s = go(r, go(r, s, 1), 0)  # 右・上: 右上へ
    assert split(r, s) == (1, 1)
    assert 3 not in dict(r.moves(s)), "割れた c があるので左へ動けない"

    r = rules("snow", ["..s.."])
    s = go(r, 0, 1)  # 右: 雪で止まる
    assert split(r, s) == (2, 0)
    s = go(r, s, 1)  # 右: 雪を離れたので溶ける
    assert split(r, s) == (4, 1)
    s = go(r, s, 3)  # 左: 溶けた雪を通過して左端へ
    assert split(r, s) == (0, 1)
    r = rules("snow", ["s.s.."])
    s = go(r, 4, 3)  # 左: 手前の雪（2）で止まる
    assert split(r, s) == (2, 0)

    r = rules("duo", ["....."])
    state = 3 * r.n + 0  # A=0, B=3
    s = go(r, state, 1)  # A 右: B の手前
    assert split(r, s) == (2, 3)
    assert 7 not in dict(r.moves(s)), "B は隣の A へ動けない"
    s = go(r, s, 5)  # B 右: 右端
    assert split(r, s) == (2, 4)
    s = go(r, s, 1)  # A 右: B の手前
    assert split(r, s) == (3, 4)
    p = Puzzle("duo", 5, 1, ".....", 0, 3, 2)  # A=0, B=2, ゴール=3: B を退かしてから A
    m = measure(p)
    assert m is not None and m.shortest == 2 and m.solution == (5, 1), m

    r = rules("plain", ["..x.."])
    assert dict(r.moves(0))[1] == 1, "x は外壁と同じ止め役"
    print("hand checks: ok")


def random_puzzle(variant: str, rng: random.Random, shape: Shape) -> Puzzle:
    w, h = shape.width, shape.height
    cells = [ROCK if rng.random() < 0.2 else ICE for _ in range(w * h)]
    ice = [c for c, t in enumerate(cells) if t == ICE]
    start = rng.choice(ice)
    partner = -1
    if variant == "duo":
        partner = rng.choice([c for c in ice if c != start])
    tile = ELEMENT_TILE.get(variant)
    if tile:
        pool = [c for c in range(w * h) if c not in (start, partner)]
        if variant != "brittle":
            pool = [c for c in pool if cells[c] == ICE]
        for c in rng.sample(pool, rng.randrange(2, 7)):
            cells[c] = tile
    return Puzzle(variant, w, h, "".join(cells), start, -1, partner)


def run_verify(args: argparse.Namespace) -> None:
    """手で作った盤面の遷移、ランダム盤面での速い実装と 1マスずつの実装の一致、x への置き換えで
    解が変わらないこと。"""
    run_hand_checks()
    rng = random.Random(f"{args.seed}-dynamic-verify")
    for variant in VARIANTS:
        mismatches = marked = changed = 0
        for _ in range(args.samples):
            p = random_puzzle(variant, rng, Shape(rng.choice((5, 6, 7)), rng.choice((5, 6, 7))))
            mismatches += check_slow(p)
            rules = rules_of(p)
            g = explore_states(rules, rules.initial(p.start, p.partner))
            n = rules.n
            spots = sorted(
                {
                    s % n
                    for s in g.order
                    if p.cells[s % n] == ICE and s % n not in (p.start, p.partner)
                }
            )
            if not spots:
                continue
            q = replace(p, goal=rng.choice(spots))
            marked += 1
            changed += not same_game(q, outside_marked(q))
        print(
            f"{variant}: samples={args.samples} 速い実装との不一致={mismatches} "
            f"x 置き換え {marked} 問で解が変わった={changed}"
        )
    pairs, shorter, invalid = snow_floor_equivalence(rng, args.samples * 10)
    print(
        f"雪の床を溶けない床とみなす: {pairs} 組（盤面・ゴール）で、元の規則の方が短い={shorter} "
        f"静的な最短解が元の規則で通らない={invalid}"
    )


def snow_floor_equivalence(rng: random.Random, samples: int) -> tuple[int, int, int]:
    """雪の床を溶けない床とみなした静的盤面と元の規則で、最短手数と静的な最短解の可否を比べる。"""
    pairs = shorter = invalid = 0
    for _ in range(samples):
        p = random_puzzle("snow", rng, Shape(rng.choice((6, 7, 8)), rng.choice((6, 7, 8))))
        rules = rules_of(p)
        n = rules.n
        g = explore_states(rules, p.start)
        first: dict[int, int] = {}
        for s in g.order:
            first.setdefault(s % n, g.dist[s])
        for goal, d in first.items():
            if p.cells[goal] != ICE or goal == p.start:
                continue
            pairs += 1
            looks = solve_static(replace(p, goal=goal), "looks", rules, p.start)
            shorter += looks.shortest is None or looks.shortest > d
            invalid += looks.shortest is not None and not looks.canonical_valid
    return pairs, shorter, invalid


# ---------------------------------------------------------------------------
# 出力


def element_list(p: Puzzle) -> list[list[int]]:
    tile = ELEMENT_TILE.get(p.variant)
    w = p.width
    return [[c % w, c // w] for c, t in enumerate(p.cells) if t == tile] if tile else []


def render(p: Puzzle) -> list[str]:
    rows = [list(row) for row in p.rows]
    w = p.width
    rows[p.start // w][p.start % w] = "A" if p.variant == "duo" else "S"
    rows[p.goal // w][p.goal % w] = "G"
    if p.partner >= 0:
        rows[p.partner // w][p.partner % w] = "B"
    return ["".join(row) for row in rows]


def static_label(result: StaticResult, shortest: int) -> str:
    if result.shortest is None:
        return "解なし"
    valid = "通る" if result.canonical_valid else "通らない"
    return f"{result.shortest}手（{valid}）"


def static_validity(p: Puzzle) -> tuple[int, int]:
    """見た目どおりの静的盤面の最短解（上限 STATIC_SOLUTION_CAP）のうち、元の規則でも通る数。"""
    rules = rules_of(p)
    start = rules.initial(p.start, p.partner)
    sols = static_solutions(p, "looks")
    return sum(replay(rules, start, s, p.goal) for s in sols), len(sols)


def candidate_entry(made: Made) -> dict:
    p, m = made.puzzle, made.metrics
    rules = rules_of(p)
    start = rules.initial(p.start, p.partner)
    assert replay(rules, start, m.solution, p.goal), "解を再生してもクリアにならない"
    w = p.width
    entry: dict = {
        "variant": p.variant,
        "width": p.width,
        "height": p.height,
        "rows": p.rows,
        "start": [p.start % w, p.start // w],
    }
    if p.variant == "duo":
        entry["partner"] = [p.partner % w, p.partner // w]
    entry |= {
        "goal": [p.goal % w, p.goal // w],
        "optimal": m.shortest,
        "solution": [move_name(p.variant, move) for move in m.solution],
    }
    valid, total = static_validity(p)
    depth = static_depth(p)
    entry["features"] = {
        "recipe": made.recipe,
        "elements": element_list(p),
        "uses": m.uses,
        "distinct": m.distinct,
        "events": m.events,
        "essential": made.essential,
        "switches": m.switches,
        "dynamic_depth": made.dyn_depth,
        "static_looks": m.looks.shortest,
        "static_looks_valid": m.looks.canonical_valid,
        "static_looks_valid_solutions": [valid, total],
        "static_looks_depth": depth,
        "static_other": m.other.shortest,
        "static_other_valid": m.other.canonical_valid,
        "plans": m.plans,
        "states": m.states,
        "near_extra": m.near_extra,
        "dead_states": m.dead_states,
        "trap_options": m.trap_options,
        "forced": m.forced,
        "unused_before_x": m.unused,
        "outside_cells": p.cells.count(OUTSIDE),
        "raw_size": [made.raw.width, made.raw.height],
        "seconds": round(made.seconds, 2),
    }
    return entry


def summarize(variant: str, made: Sequence[Made]) -> None:
    ok = [m for m in made if m.accepted]
    seconds = [m.seconds for m in made]
    rate = len(ok) / len(made) if made else 0
    per = statistics.mean(seconds) / rate if rate else float("inf")
    print(
        f"# {VARIANT_LABEL[variant]}: 採用 {len(ok)}/{len(made)} "
        f"1回 平均{statistics.mean(seconds):.1f}s → 1問 {per:.1f}s"
    )
    print(f"  外れた理由: {dict(Counter(r for m in made for r in m.reasons))}")
    group = ok or list(made)
    looks_none = sum(m.metrics.looks.shortest is None for m in group)
    other_none = sum(m.metrics.other.shortest is None for m in group)
    misleads = sum(m.metrics.misleads for m in group)

    def med(values: Sequence[float]) -> str:
        return f"{statistics.median(values):g}" if values else "-"

    print(
        f"  {'採用' if ok else '全体'}{len(group)}問: "
        f"最短 {med([m.metrics.shortest for m in group])} "
        f"使う {med([m.metrics.uses for m in group])} 効く要素 {med([m.essential for m in group])} "
        f"状態 {med([m.metrics.states for m in group])} 近い状態 "
        f"{med([m.metrics.near_extra for m in group])} 読み深さ(状態) "
        f"{med([m.dyn_depth for m in group])} 見た目どおりで解なし {looks_none} "
        f"見た目どおりの解が通らない {misleads} 置き換え(他方)で解なし {other_none} "
        f"未使用マス {med([m.metrics.unused for m in group])} "
        f"x {med([m.puzzle.cells.count(OUTSIDE) for m in group])}"
    )


def run_candidates(args: argparse.Namespace) -> None:
    """各要素の5段を --runs 回ずつ作り、段ごとに採用した問題のうち点が最もよいものを試遊候補にする。
    採用が無い段は、外れた理由の少ない順・点の順で最もよいものを採り、そのことを表示する。"""
    variants = args.variants
    recipes = [r for v in variants for r in plan_for(v)]
    recipes = [replace(r, iterations=args.iterations) for r in recipes]
    tasks = [
        (recipe, f"{args.seed}-v3-{recipe.name}-{run}")
        for recipe in recipes
        for run in range(args.runs * (TRAP_RUN_FACTOR if recipe.looks_trap else 1))
    ]
    results: list[Made | None] = parallel(make_task, tasks, args.workers)
    made = [m for m in results if m is not None]
    chosen: list[Made] = []
    for variant in variants:
        summarize(variant, [m for m in made if m.variant == variant])
        for recipe in (r for r in recipes if r.variant == variant):
            ms = [m for m in made if m.recipe == recipe.name]
            ranked = sorted(ms, key=lambda m: (len(m.reasons), -m.score))
            ok = sum(m.accepted for m in ms)
            print(
                f"  {recipe.name} {recipe.label}: 採用 {ok}/{len(ms)} "
                f"外れた理由 {dict(Counter(r for m in ms for r in m.reasons))}"
            )
            if ranked:
                chosen.append(ranked[0])
    order = list(range(len(chosen)))
    random.Random(f"{args.seed}-v3-order").shuffle(order)
    output = []
    for number, index in enumerate(order, 1):
        m = chosen[index]
        entry = {"id": f"v{number:02d}", **candidate_entry(m)}
        output.append(entry)
        f = entry["features"]
        valid, total = f["static_looks_valid_solutions"]
        note = "" if m.accepted else f" 未採用({'・'.join(m.reasons)})"
        print(
            f"\n{entry['id']} {VARIANT_LABEL[m.variant]} {m.puzzle.width}x{m.puzzle.height}"
            f"（元 {m.raw.width}x{m.raw.height}） 最短{m.metrics.shortest} {m.recipe}{note}\n"
            f"  要素{len(f['elements'])} 使う{m.metrics.uses} 効く{m.essential} "
            f"出来事{m.metrics.events} 読み深さ(状態){m.dyn_depth} "
            f"見た目どおり {static_label(m.metrics.looks, m.metrics.shortest)}"
            f"（最短解 {valid}/{total} が通る、読み深さ {f['static_looks_depth']}） "
            f"置き換え {static_label(m.metrics.other, m.metrics.shortest)} "
            f"近い状態{m.metrics.near_extra} 詰みの選択肢{m.metrics.trap_options} "
            f"未使用{m.metrics.unused}→x{f['outside_cells']}"
        )
        for line in render(m.puzzle):
            print("    " + line)
        print("    解: " + " ".join(entry["solution"]))
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(output)} problems to {args.output}")


def run_probe(args: argparse.Namespace) -> None:
    """1つの要素の1段を --runs 回作り、分布を見る（重みの調整用）。"""
    recipe = replace(plan_for(args.variants[0])[args.step - 1], iterations=args.iterations)
    tasks = [(recipe, f"{args.seed}-probe-{recipe.name}-{run}") for run in range(args.runs)]
    made = [m for m in parallel(make_task, tasks, args.workers) if m is not None]
    summarize(recipe.variant, made)
    for m in made:
        print(
            f"  score={m.score:.1f} 最短{m.metrics.shortest} 使う{m.metrics.uses} "
            f"効く{m.essential} "
            f"解{m.metrics.plans} 近い{m.metrics.near_extra} 読み{m.dyn_depth} "
            f"looks={static_label(m.metrics.looks, m.metrics.shortest)} "
            f"other={static_label(m.metrics.other, m.metrics.shortest)} 未使用{m.metrics.unused} "
            f"{m.reasons}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("verify", "probe", "candidates"))
    parser.add_argument("--variants", nargs="+", default=list(VARIANTS), choices=VARIANTS)
    parser.add_argument("--step", type=int, default=3, help="probe の段（1〜5）")
    parser.add_argument("--iterations", type=int, default=1500)
    parser.add_argument("--runs", type=int, default=8)
    parser.add_argument("--samples", type=int, default=100)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--output", default="/tmp/v3-candidates.json")
    args = parser.parse_args()
    {"verify": run_verify, "probe": run_probe, "candidates": run_candidates}[args.suite](args)


if __name__ == "__main__":
    main()
