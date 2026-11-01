"""氷の床迷路（作業名）の生成 v4: もろい岩・薄い氷でどこまで難しくできるかを測る実験。

生成 v3（ice_floor_dynamic_generation_experiment）は要素を1種類ずつ段に分けて作った。v4 は
もろい岩だけ・薄い氷だけ・両方の3種類で、難しさを最大にする方向へ山登りする。

規則（盤面の文字）:
- ``#`` 岩、``x`` 盤面の外、外壁: 止め役。``.`` 氷: 滑れる。
- ``b`` もろい岩: 止め役。駒が滑ってきてその手前で止まると、その滑りの後で崩れて氷になる。
- ``c`` 薄い氷: 滑れる。滑りの出発マスと途中で通過したマスのうち薄い氷だったものは、その滑りの
  後で水面（止め役）になる。止まったマスは次にそこから動いた滑りの後で水面になる。
- 動かない入力は手にならない（もろい岩も薄い氷も変化しない）。

生成の条件:
- 同じ向きへ続けて動かす手: 最短+2手以内のどの道筋にも無く、崩した直後に同じ向きでもう一度
  もろい岩を崩せる配置（連鎖）は到達できるどの状態にも無い。
- 要素はどれも、中立の形（もろい岩→岩、薄い氷→氷）に置き換えると、最短解・最短解の上の
  選択肢（もっともらしいか・詰みか・遠回りか）のどれかが変わる。解で使わないが、最短解の上で
  もっともらしい選択肢が触れると詰むか遠回りになる「おとり」を要素の2割以上含める。

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
from itertools import pairwise
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import Shape  # noqa: E402
from ice_floor_dynamic_generation_experiment import (  # noqa: E402
    DIRECTION_WORDS,
    Graph,
    Puzzle,
    StaticResult,
    canonical_solution,
    count_plans,
    dynamic_depth,
    replay,
    reverse_layers,
    touched_elements,
    used_cells,
    with_goal,
)
from ice_floor_hard_generation_experiment import features_of, parallel, stop_tables  # noqa: E402
from ice_floor_supply_experiment import DX, DY, ICE, ROCK, Board  # noqa: E402

BRITTLE = "b"
THIN = "c"
WATER = "w"  # 薄い氷が割れた後。初期盤面には現れず、1マスずつの検証の実装だけが使う
OUTSIDE = "x"
NEUTRAL = {BRITTLE: ROCK, THIN: ICE}
VARIANTS = ("brittle", "thin", "mixed")
VARIANT_TILES = {"brittle": (BRITTLE,), "thin": (THIN,), "mixed": (BRITTLE, THIN)}
VARIANT_LABEL = {"brittle": "もろい岩", "thin": "薄い氷", "mixed": "両方"}
STOPPERS = (ROCK, OUTSIDE, BRITTLE, WATER)
NEAR_SLACK = 2
# 見た目どおりの読みの解が元の規則でも通るとき、これ以上長ければ「大きく遠回り」
DETOUR = 4
# 最短解の上の選択肢が、最短より FALSE_LEAD_COST 手以上の遠回りになれば「遠回り」（v2 と同じ）
FALSE_LEAD_COST = 3
MAX_GOALS = 4
STATE_CAP = 20000
POLISH_EVERY = 400  # 山登りの何回ごとにおとりの候補をすべて試すか
STATIC_SOLUTION_CAP = 200
DYN_DEPTH_CAP = 8


# ---------------------------------------------------------------------------
# 規則


class Rules:
    """状態は mask * n + 駒の位置。mask のビット j は要素 j が変化した（もろい岩が崩れた・薄い氷が
    水面になった）こと。手は方向番号（0=上, 1=右, 2=下, 3=左）。

    v3 の BFS・最短解・再生の関数（Graph を使うもの）にそのまま渡せる形にしてある。"""

    variant = "v4"

    def __init__(self, width: int, height: int, cells: str) -> None:
        self.width = width
        self.height = height
        self.n = n = width * height
        self.cells = cells
        self.base_rock = [tile in (ROCK, OUTSIDE) for tile in cells]
        self.elements = [c for c, t in enumerate(cells) if t in (BRITTLE, THIN)]
        self.kinds = [cells[c] for c in self.elements]
        self.element_of = [-1] * n
        for j, cell in enumerate(self.elements):
            self.element_of[cell] = j
        self.brittle_bits = sum(1 << j for j, k in enumerate(self.kinds) if k == BRITTLE)
        self.thin_bits = sum(1 << j for j, k in enumerate(self.kinds) if k == THIN)
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

    def tables(self, mask: int) -> tuple[list[int], ...]:
        found = self._tables.get(mask)
        if found is None:
            rock = list(self.base_rock)
            for j, cell in enumerate(self.elements):
                changed = bool(mask >> j & 1)
                if self.kinds[j] == BRITTLE:
                    rock[cell] = not changed
                else:
                    rock[cell] = changed
            found = self._tables[mask] = stop_tables(self.width, self.height, rock)
        return found

    def initial(self, start: int, partner: int = -1) -> int:
        return start

    def moves(self, state: int) -> list[tuple[int, int]]:
        n = self.n
        pos, mask = state % n, state // n
        tables = self.tables(mask)
        element_of, kinds = self.element_of, self.kinds
        out = []
        for d in range(4):
            end = tables[d][pos]
            if end == pos:
                continue
            after = mask
            hit = self.beyond[d][end]
            if hit >= 0:
                j = element_of[hit]
                if j >= 0 and kinds[j] == BRITTLE:
                    after |= 1 << j
            if self.thin_bits:
                cell, step = pos, self.delta[d]
                while cell != end:
                    j = element_of[cell]
                    if j >= 0 and kinds[j] == THIN:
                        after |= 1 << j
                    cell += step
            out.append((d, after * n + end))
        return out

    def events(self, state: int, move: int, target: int) -> list[str]:
        """1手の出来事。break: 崩す、pass_broken: 崩れた跡を通る・止まる、crack: 割る、
        stop_on_water: 水面で止まる。"""
        n = self.n
        pos, end, mask = state % n, target % n, state // n
        d = move
        path = [pos]
        while path[-1] != end:
            path.append(path[-1] + self.delta[d])
        found = []
        hit = self.beyond[d][end]
        j = self.element_of[hit] if hit >= 0 else -1
        if j >= 0 and self.kinds[j] == BRITTLE and not mask >> j & 1:
            found.append(f"break:{j}")
        if j >= 0 and self.kinds[j] == THIN and mask >> j & 1:
            found.append(f"stop_on_water:{j}")
        for c in path[1:]:
            j = self.element_of[c]
            if j >= 0 and self.kinds[j] == BRITTLE and mask >> j & 1:
                found.append(f"pass_broken:{j}")
        for c in path[:-1]:
            j = self.element_of[c]
            if j >= 0 and self.kinds[j] == THIN:
                found.append(f"crack:{j}")
        return found


USE_EVENTS = ("break", "pass_broken", "stop_on_water")


def rules_of(p: Puzzle) -> Rules:
    return Rules(p.width, p.height, p.cells)


def explore(rules: Rules, start: int, goal: int = -1, cap: int = STATE_CAP) -> Graph | None:
    """v3 の explore_states に状態の数の上限を足したもの。上限を超えれば None。"""
    n = rules.n
    dist = {start: 0}
    order = [start]
    succ: dict[int, list[tuple[int, int]]] = {}
    for state in order:
        if state % n == goal:
            succ[state] = []
            continue
        out = rules.moves(state)
        succ[state] = out
        step = dist[state] + 1
        for _, nxt in out:
            if nxt not in dist:
                dist[nxt] = step
                order.append(nxt)
                if len(order) > cap:
                    return None
    return Graph(rules, start, goal, dist, order, succ)


def neutral_cells(cells: str, only: int = -1) -> str:
    """要素を中立の形（もろい岩→岩、薄い氷→氷）に置き換えた盤面。only を与えるとそのマスだけ。"""
    if only >= 0:
        return cells[:only] + NEUTRAL[cells[only]] + cells[only + 1 :]
    return "".join(NEUTRAL.get(t, t) for t in cells)


# ---------------------------------------------------------------------------
# もっともらしい手（v2 の定義を、今の状態の盤面で測る）


def plausibility(rules: Rules, goal: int) -> Callable[[int, int, int], bool]:
    """滑った先がゴール・ゴールへ近づく・ゴールと見通しで揃う、または滑りがゴールを通過する手。"""
    w, n = rules.width, rules.n
    gx, gy = goal % w, goal // w

    def gap(c: int) -> int:
        return abs(c % w - gx) + abs(c // w - gy)

    def toward(c: int) -> int:
        x, y = c % w, c // w
        if x == gx and y != gy:
            return 0 if gy < y else 2
        if y == gy and x != gx:
            return 1 if gx > x else 3
        return -1

    def sees(c: int, tables: tuple[list[int], ...]) -> bool:
        d = toward(c)
        if d < 0:
            return False
        end = tables[d][c]
        ex, ey = end % w, end // w
        return (ey <= gy, ex >= gx, ey >= gy, ex <= gx)[d]

    def plausible(state: int, d: int, target: int) -> bool:
        s, e = state % n, target % n
        if e == goal or gap(e) < gap(s) or sees(e, rules.tables(target // n)):
            return True
        tables = rules.tables(state // n)
        return d == toward(s) and sees(s, tables) and tables[d][s] != goal

    return plausible


# ---------------------------------------------------------------------------
# 特徴量


@dataclass(frozen=True)
class Option:
    """最短解の上の状態から1手、または解でない手の後にもう1手指した選択肢。kind は、その手の後の
    最短で着く手数が、分かれた状態から最短で着く手数より何手長いか: 0 は FALSE_LEAD_COST 手未満、
    1 はそれ以上（遠回り）、2 は詰み。"""

    move: int
    source: int
    target: int
    kind: int
    plausible: bool
    then: tuple[Option, ...] = ()


def solution_options(
    g: Graph, to_goal: dict[int, int], solution: Sequence[int], goal: int
) -> list[tuple[int, list[Option]]] | None:
    """最短解の各手の前の状態と、そこでの全選択肢（解でない手には、続く1手の選択肢も付ける）。
    solution が g で通らなければ None。"""
    plausible = plausibility(g.rules, goal)
    n = g.rules.n

    def option(source: int, d: int, t: int, remaining: int, spent: int, then=()) -> Option:
        after = to_goal.get(t)
        kind = 2 if after is None else int(after + spent - remaining >= FALSE_LEAD_COST)
        return Option(d, source, t, kind, plausible(source, d, t), then)

    state = g.start
    out = []
    for move in solution:
        remaining = to_goal.get(state)
        succ = g.succ.get(state)
        if remaining is None or not succ:
            return None
        options = []
        for d, t in succ:
            then: tuple[Option, ...] = ()
            if d != move and t % n != goal:
                then = tuple(option(t, d2, t2, remaining, 2) for d2, t2 in g.succ[t])
            options.append(option(state, d, t, remaining, 1, then))
        out.append((state, options))
        nxt = dict(succ).get(move)
        if nxt is None:
            return None
        state = nxt
    if state % n != goal:
        return None
    return out


def option_profile(steps: list[tuple[int, list[Option]]] | None) -> tuple | None:
    """選択肢の性質（向き・詰みか遠回りか・もっともらしいか）を2手先まで。状態の符号は盤面ごとに
    違うので使わない。"""
    if steps is None:
        return None
    return tuple(
        tuple(
            (o.move, o.kind, o.plausible, tuple((t.move, t.kind, t.plausible) for t in o.then))
            for o in options
        )
        for _, options in steps
    )


@dataclass(frozen=True)
class Effect:
    """要素1つを中立の形に置き換えたときに変わるもの。"""

    shortest: bool
    solution: bool
    options: bool

    @property
    def relevant(self) -> bool:
        return self.shortest or self.solution or self.options


@dataclass(frozen=True)
class Metrics:
    shortest: int
    plans: int
    states: int
    near_extra: int  # 最短+NEAR_SLACK 手以内の道筋に乗り、どの最短解にも乗らない状態
    dead_states: int
    forced: int  # 最短解のうち、まだ訪れていない状態へ行く手が1つしかない手
    lures: int  # 最短解の上の、もっともらしいが詰みか遠回りになる選択肢
    dead_options: int  # 最短解の上の、詰みになる選択肢
    uses: int
    distinct: int  # 最短解で変化させた要素の数
    events: dict[str, int]
    elements: int
    brittle: int
    thin: int
    unused: int
    roles: tuple[str, ...]  # used / decoy / weak_decoy / other / irrelevant
    effects: tuple[Effect, ...]
    precedence: int  # 最短解で使う順を入れ替えると解けなくなる要素の組
    soft_precedence: int  # 入れ替えると FALSE_LEAD_COST 手以上長くなる組
    order_chain: int  # その順序の最も長い連なり（要素の数）
    order_traps: int  # 最短解が後で使う要素を先に変化させ、詰みか遠回りになる選択肢
    order_lures: int  # そのうち、もっともらしいもの
    solution_repeats: int  # 最短解で同じ向きが続く手
    near_repeats: int  # 最短+NEAR_SLACK 手以内の道筋に乗る、同じ向きが続く2手の組
    chains: int  # 崩した直後に同じ向きでもう一度もろい岩を崩せる2手の組（全状態）
    repeat_moves: int  # 同じ向きが続けられる2手の組（全状態）
    repeat_live: int  # そのうち、続けた後もゴールへ行ける組
    looks: StaticResult  # 見た目どおり（もろい岩→岩、薄い氷→氷）の盤面
    other: StaticResult  # もう一方（もろい岩→氷、薄い氷→岩）の盤面
    solution: tuple[int, ...]

    @property
    def decoys(self) -> int:
        return self.roles.count("decoy")

    @property
    def weak_decoys(self) -> int:
        return self.roles.count("weak_decoy")

    @property
    def irrelevant(self) -> int:
        return self.roles.count("irrelevant")

    @property
    def looks_class(self) -> str:
        looks = self.looks
        if looks.shortest is None:
            return "unsolvable"
        if not looks.canonical_valid:
            return "misleading"
        if looks.shortest >= self.shortest + DETOUR:
            return "detour"
        return "shortcut"

    @property
    def static_shortcut(self) -> bool:
        other = self.other
        return self.looks_class == "shortcut" or (
            other.shortest is not None
            and other.canonical_valid
            and other.shortest <= self.shortest + NEAR_SLACK
        )


def static_result(free: Graph | None, goal: int, rules: Rules, start: int) -> StaticResult:
    if free is None:
        return StaticResult(None, False)
    g = with_goal(free, goal)
    to_goal = reverse_layers(g)
    if g.start not in to_goal:
        return StaticResult(None, False)
    moves = canonical_solution(g, to_goal)
    return StaticResult(len(moves), replay(rules, start, moves, goal))


def repeat_stats(g: Graph, to_goal: dict[int, int], shortest: int, brittle_bits: int):
    """同じ向きが続く2手 s→t→u。最短+NEAR_SLACK 以内の道筋に乗るのは dist(s)+2+to_goal(u) が
    最短+NEAR_SLACK 以下のとき（同じ状態を二度通る道筋も含む）。"""
    n = g.rules.n
    near = chains = moves = live = 0
    for s in g.order:
        for d, t in g.succ[s]:
            u = dict(g.succ.get(t, ())).get(d)
            if u is None:
                continue
            moves += 1
            live += u in to_goal
            if u in to_goal and g.dist[s] + to_goal[u] <= shortest:
                near += 1
            first = (t // n) & ~(s // n) & brittle_bits
            second = (u // n) & ~(t // n) & brittle_bits
            chains += bool(first and second)
    return near, chains, moves, live


def precedence_of(g: Graph, first_change: dict[int, int], shortest: int) -> tuple[int, int, int]:
    """最短解で a を b より先に変化させる要素の組について、b より先に a を変化させる手を除いた
    盤面で解けなくなる組（順序の依存）の数、FALSE_LEAD_COST 手以上長くなる組の数、順序の依存の
    最も長い連なり（要素の数）。"""
    n = g.rules.n
    goal = g.goal
    used = sorted(first_change, key=first_change.__getitem__)
    strict: list[tuple[int, int]] = []
    soft = 0
    for i, a in enumerate(used):
        for b in used[i + 1 :]:
            if first_change[a] == first_change[b]:
                continue
            dist = {g.start: 0}
            queue = [g.start]
            reached = None
            for s in queue:
                if s % n == goal:
                    reached = dist[s]
                    break
                for _, t in g.succ[s]:
                    tm = t // n
                    if tm >> a & 1 and not (s // n) >> a & 1 and not tm >> b & 1:
                        continue
                    if t not in dist:
                        dist[t] = dist[s] + 1
                        queue.append(t)
            if reached is None:
                strict.append((a, b))
            elif reached >= shortest + FALSE_LEAD_COST:
                soft += 1
    chain = {j: 1 for j in used}
    for a, b in sorted(strict, key=lambda ab: first_change[ab[0]]):
        chain[b] = max(chain[b], chain[a] + 1)
    return len(strict), soft, max(chain.values(), default=0)


def measure(
    p: Puzzle,
    g: Graph,
    neutral_free: Sequence[Graph | None],
    looks_free: Graph | None,
    other_free: Graph | None,
) -> Metrics | None:
    """p.goal の問題の特徴量。g は p.goal を終わりにした BFS、neutral_free は要素 j だけを中立の形に
    した盤面のゴールによらない BFS（上限超えは None）。解けなければ None。"""
    rules: Rules = g.rules
    n = rules.n
    start = g.start
    to_goal = reverse_layers(g)
    if start not in to_goal:
        return None
    shortest = to_goal[start]
    solution = canonical_solution(g, to_goal)
    plans = count_plans(g, to_goal, shortest)
    steps = solution_options(g, to_goal, solution, p.goal)
    assert steps is not None
    events: Counter[str] = Counter()
    first_change: dict[int, int] = {}
    state = start
    for i, move in enumerate(solution):
        target = dict(g.succ[state])[move]
        for e in rules.events(state, move, target):
            events[e.split(":")[0]] += 1
        newly = (target // n) & ~(state // n)
        for j in range(len(rules.elements)):
            if newly >> j & 1:
                first_change.setdefault(j, i)
        state = target
    final_mask = state // n
    uses = sum(events[k] for k in USE_EVENTS)

    visited = {start}
    forced = lures = dead_options = order_traps = order_lures = 0
    decoy_any: set[int] = set()
    decoy_plausible: set[int] = set()
    for i, (s, options) in enumerate(steps):
        fresh = [o for o in options if o.target not in visited]
        forced += len(fresh) == 1
        nxt = {o.move: o.target for o in options}[solution[i]]
        for o in options:
            if o.move == solution[i]:
                continue
            bad = o.kind > 0
            lures += bad and o.plausible
            dead_options += o.kind == 2
            newly = (o.target // n) & ~(s // n)
            early = [j for j, step in first_change.items() if step > i and newly >> j & 1]
            if bad and early:
                order_traps += 1
                order_lures += o.plausible
            # おとり: 解で変化させない要素を、解から外れた1手目か2手目で変化させ、その手の後が
            # 詰みか遠回りになる。もっともらしい手だけでたどれるものを「おとり」とする
            branches = [(o, o.plausible)] + [(t, o.plausible and t.plausible) for t in o.then]
            for step, tempting in branches:
                if step.kind == 0:
                    continue
                changed = (step.target // n) & ~(step.source // n) & ~final_mask
                for j in range(len(rules.elements)):
                    if changed >> j & 1:
                        decoy_any.add(j)
                        if tempting:
                            decoy_plausible.add(j)
        visited.add(nxt)

    profile = option_profile(steps)
    effects = []
    for j, cell in enumerate(rules.elements):
        free = neutral_free[j]
        if free is None:
            effects.append(Effect(True, True, True))
            continue
        ng = with_goal(free, p.goal)
        nt = reverse_layers(ng)
        if ng.start not in nt:
            effects.append(Effect(True, True, True))
            continue
        n_short = nt[ng.start]
        n_solution = canonical_solution(ng, nt)
        n_plans = count_plans(ng, nt, n_short)
        n_profile = option_profile(solution_options(ng, nt, solution, p.goal))
        effects.append(
            Effect(
                n_short != shortest,
                n_plans != plans or tuple(n_solution) != tuple(solution),
                n_profile != profile,
            )
        )
    roles = []
    for j, effect in enumerate(effects):
        if not effect.relevant:
            roles.append("irrelevant")
        elif final_mask >> j & 1:
            roles.append("used")
        elif j in decoy_plausible:
            roles.append("decoy")
        elif j in decoy_any:
            roles.append("weak_decoy")
        else:
            roles.append("other")

    near = sum(
        1
        for s, d in g.dist.items()
        if s in to_goal and shortest < d + to_goal[s] <= shortest + NEAR_SLACK
    )
    near_rep, chains, rep_moves, rep_live = repeat_stats(g, to_goal, shortest, rules.brittle_bits)
    precedence, soft_precedence, chain = precedence_of(g, first_change, shortest)
    solution_repeats = sum(1 for a, b in pairwise(solution) if a == b)
    used = used_cells(g)
    unused = sum(
        1 for c, t in enumerate(p.cells) if t not in (ROCK, OUTSIDE, BRITTLE) and c not in used
    )
    return Metrics(
        shortest=shortest,
        plans=plans,
        states=len(g.dist),
        near_extra=near,
        dead_states=sum(1 for s in g.dist if s not in to_goal),
        forced=forced,
        lures=lures,
        dead_options=dead_options,
        uses=uses,
        distinct=len(first_change),
        events=dict(events),
        elements=len(rules.elements),
        brittle=rules.kinds.count(BRITTLE),
        thin=rules.kinds.count(THIN),
        unused=unused,
        roles=tuple(roles),
        effects=tuple(effects),
        precedence=precedence,
        soft_precedence=soft_precedence,
        order_chain=chain,
        order_traps=order_traps,
        order_lures=order_lures,
        solution_repeats=solution_repeats,
        near_repeats=near_rep,
        chains=chains,
        repeat_moves=rep_moves,
        repeat_live=rep_live,
        looks=static_result(looks_free, p.goal, rules, start),
        other=static_result(other_free, p.goal, rules, start),
        solution=tuple(solution),
    )


@dataclass
class Context:
    """1つの盤面と開始位置について、ゴールによらない BFS。"""

    rules: Rules
    free: Graph | None
    neutral_free: list[Graph | None]
    looks_free: Graph | None
    other_free: Graph | None


def context_of(p: Puzzle) -> Context:
    rules = rules_of(p)
    free = explore(rules, p.start)
    neutral: list[Graph | None] = []
    if free is not None:
        for cell in rules.elements:
            nr = Rules(p.width, p.height, neutral_cells(p.cells, cell))
            neutral.append(explore(nr, p.start))
    looks_rules = Rules(p.width, p.height, neutral_cells(p.cells))
    other_cells = "".join({BRITTLE: ICE, THIN: ROCK}.get(t, t) for t in p.cells)
    other_rules = Rules(p.width, p.height, other_cells)
    return Context(
        rules, free, neutral, explore(looks_rules, p.start), explore(other_rules, p.start)
    )


def measure_puzzle(p: Puzzle, ctx: Context | None = None) -> Metrics | None:
    ctx = ctx or context_of(p)
    if ctx.free is None:
        return None
    g = with_goal(ctx.free, p.goal)
    return measure(p, g, ctx.neutral_free, ctx.looks_free, ctx.other_free)


def looks_puzzle(p: Puzzle) -> Puzzle:
    return replace(p, cells=neutral_cells(p.cells).replace(OUTSIDE, ROCK))


def static_solutions(p: Puzzle) -> list[list[int]]:
    """見た目どおりの盤面の最短解（STATIC_SOLUTION_CAP まで）。"""
    sp = looks_puzzle(p)
    g = explore(rules_of(sp), sp.start, sp.goal)
    assert g is not None
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


def static_depth(p: Puzzle) -> int | None:
    """見た目どおりの盤面に v1/v2 の読み深さモデルを当てた深さ。解なしは None。"""
    sp = looks_puzzle(p)
    g = explore(rules_of(sp), sp.start, sp.goal)
    assert g is not None
    if sp.goal not in {s % g.rules.n for s in g.dist}:
        return None
    return features_of(Board(sp.width, sp.height, sp.cells), sp.start, sp.goal).human_depth


# ---------------------------------------------------------------------------
# 目的関数と山登り


@dataclass(frozen=True)
class Weights:
    looks_unsolvable: float = 5.0  # 見た目どおりの盤面が解なし
    looks_mislead: float = 6.0  # 見た目どおりの盤面の最短解が元の規則で通らない
    looks_detour: float = 3.0  # 見た目どおりの解は通るが DETOUR 手以上の遠回り
    use: float = 0.8
    cap_use: int = 10
    distinct: float = 1.0
    cap_distinct: int = 6
    precedence: float = 1.0
    soft_precedence: float = 0.5
    cap_precedence: int = 8
    chain: float = 1.5  # 使う順序の連なり（2以上で加点）
    cap_chain: int = 4
    order_trap: float = 1.0
    cap_order_trap: int = 4
    decoy: float = 3.0
    cap_decoy: int = 3
    # 解で変化させず、もっともらしくない選択肢でだけ詰み・遠回りになる要素。おとりへ山登りで
    # 近づけるよう、おとりより小さく加点する
    weak_decoy: float = 1.0
    lure: float = 0.5
    cap_lure: int = 4
    read: float = 1.5
    read_cap: int = 4
    forced: float = 1.5
    near: float = 0.3
    cap_near: int = 60
    plans: float = 2.0
    unused: float = 0.3
    constraint: float = 6.0


@dataclass(frozen=True)
class Recipe:
    name: str
    variant: str
    shape: Shape
    lo: int
    hi: int
    min_elements: int
    max_elements: int
    min_each: int = 0  # mixed: もろい岩・薄い氷それぞれの下限
    min_uses: int = 3
    decoy_share: float = 0.2
    iterations: int = 1500
    max_density: float = 0.30
    weights: Weights = field(default_factory=Weights)

    @property
    def label(self) -> str:
        return (
            f"{VARIANT_LABEL[self.variant]} {self.shape.label} {self.lo}〜{self.hi}手 "
            f"要素{self.min_elements}〜{self.max_elements}個"
        )

    def decoys_needed(self, elements: int) -> int:
        return max(1, math.ceil(self.decoy_share * elements - 1e-9))


def violations(m: Metrics, r: Recipe) -> list[str]:
    """採用条件（条件1・2を含む）を満たさない理由。最短手数の範囲と一意性もここで見る。"""
    reasons = []
    if not r.lo <= m.shortest <= r.hi:
        reasons.append("最短手数")
    if m.plans > 1:
        reasons.append("最短解が複数")
    if m.solution_repeats or m.near_repeats:
        reasons.append("条件1: 同じ向きが続く")
    if m.chains:
        reasons.append("条件1: もろい岩の連鎖")
    if m.irrelevant:
        reasons.append("条件2: 効かない要素")
    if m.decoys < r.decoys_needed(m.elements):
        reasons.append("条件2: おとり不足")
    if not r.min_elements <= m.elements <= r.max_elements:
        reasons.append("要素の数")
    if r.variant == "mixed" and min(m.brittle, m.thin) < r.min_each:
        reasons.append("要素の内訳")
    if m.uses < r.min_uses:
        reasons.append("使う回数")
    if m.static_shortcut:
        reasons.append("静的な近道")
    if m.forced > 0.25 * m.shortest:
        reasons.append("一本道")
    return reasons


def shortfall(m: Metrics, r: Recipe) -> float:
    return (
        (m.plans > 1)
        + min(m.near_repeats, 3)
        + min(m.chains, 3)
        + m.irrelevant
        + max(0, r.decoys_needed(m.elements) - m.decoys)
        + max(0, m.elements - r.max_elements, r.min_elements - m.elements)
        + (max(0, r.min_each - min(m.brittle, m.thin)) if r.variant == "mixed" else 0)
        + (m.uses < r.min_uses)
        + m.static_shortcut
        + (m.forced > 0.25 * m.shortest)
    )


def hardness(m: Metrics, w: Weights) -> float:
    """難しさの点（読み深さを除く）。"""
    looks = {
        "unsolvable": w.looks_unsolvable,
        "misleading": w.looks_mislead,
        "detour": w.looks_detour,
        "shortcut": 0.0,
    }[m.looks_class]
    return (
        looks
        + w.use * min(m.uses, w.cap_use)
        + w.distinct * min(m.distinct, w.cap_distinct)
        + w.precedence * min(m.precedence, w.cap_precedence)
        + w.soft_precedence * min(m.soft_precedence, w.cap_precedence)
        + w.chain * max(0, min(m.order_chain, w.cap_chain) - 1)
        + w.order_trap * min(m.order_traps, w.cap_order_trap)
        + w.decoy * min(m.decoys, w.cap_decoy)
        + w.weak_decoy * min(m.weak_decoys, max(0, w.cap_decoy - m.decoys))
        + w.lure * min(m.lures, w.cap_lure)
    )


def score_of(m: Metrics, r: Recipe) -> float:
    w = r.weights
    return (
        hardness(m, w)
        - w.forced * m.forced
        - w.near * min(m.near_extra, w.cap_near)
        - w.plans * math.log2(max(m.plans, 1))
        - w.unused * m.unused
        - w.constraint * shortfall(m, r)
    )


Evaluation = tuple[float, int, Metrics | None]


def evaluate(p: Puzzle, r: Recipe, floor: float = -math.inf) -> Evaluation:
    """範囲 [lo, hi] の最短手数で駒が止まれる氷のマスのうち、点が最もよいゴール。読み深さは重いので、
    読み深さの点を足しても floor に届かないゴールでは求めない。"""
    ctx = context_of(p)
    if ctx.free is None:
        return -1000.0, -1, None
    free = ctx.free
    n = ctx.rules.n
    first: dict[int, int] = {}
    for s in free.order:
        first.setdefault(s % n, free.dist[s])
    candidates = sorted(
        (c for c, d in first.items() if r.lo <= d <= r.hi and p.cells[c] == ICE and c != p.start),
        key=lambda c: (-first[c], c),
    )[:MAX_GOALS]
    if not candidates:
        return max(first.values(), default=0) - 100.0, -1, None
    scored = []
    for goal in candidates:
        g = with_goal(free, goal)
        m = measure(replace(p, goal=goal), g, ctx.neutral_free, ctx.looks_free, ctx.other_free)
        assert m is not None
        scored.append((score_of(m, r), goal, m, g))
    scored.sort(key=lambda item: -item[0])
    w = r.weights
    best: Evaluation | None = None
    read_bonus = w.read * (w.read_cap + 1)
    for score, goal, m, g in scored:
        if best is not None and score + read_bonus <= best[0]:
            break
        if w.read and score + read_bonus >= floor:
            score += w.read * dynamic_depth(replace(p, goal=goal), w.read_cap, g)
        if best is None or score > best[0]:
            best = (score, goal, m)
    assert best is not None
    return best


class Searcher:
    """v1〜v3 の山登り（悪くならなければ受理）。近傍は岩の追加・削除・入れ替え、開始位置の移動、
    要素の追加・削除・移動、おとりの候補の置き方。"""

    def __init__(self, recipe: Recipe, rng: random.Random) -> None:
        self.r = recipe
        self.rng = rng
        self.w, self.h = recipe.shape.width, recipe.shape.height
        self.n = self.w * self.h
        self.tiles = VARIANT_TILES[recipe.variant]
        self.max_rocks = int(recipe.max_density * self.n)
        self.min_rocks = int(0.08 * self.n)

    def hosts(self, cells: list[str], start: int, tile: str) -> list[int]:
        allowed = (ICE, ROCK) if tile == BRITTLE else (ICE,)
        return [c for c, t in enumerate(cells) if t in allowed and c != start]

    def pick_tile(self, cells: list[str]) -> str:
        if self.r.variant != "mixed":
            return self.tiles[0]
        counts = {t: cells.count(t) for t in self.tiles}
        short = [t for t in self.tiles if counts[t] < self.r.min_each]
        return self.rng.choice(short or list(self.tiles))

    def initial(self) -> Puzzle:
        rng, r = self.rng, self.r
        cells = [ROCK if rng.random() < 0.18 else ICE for _ in range(self.n)]
        ice = [c for c, t in enumerate(cells) if t == ICE]
        start = ice[rng.randrange(len(ice))]
        for _ in range((r.min_elements + r.max_elements) // 2):
            tile = self.pick_tile(cells)
            cells[rng.choice(self.hosts(cells, start, tile))] = tile
        return Puzzle(r.variant, self.w, self.h, "".join(cells), start)

    def mutate(self, p: Puzzle) -> Puzzle:
        rng = self.rng
        cells = list(p.cells)
        start = p.start
        roll = rng.random()
        if roll < 0.08:
            free = [c for c, t in enumerate(cells) if t == ICE and c != start]
            if free:
                start = rng.choice(free)
        elif roll < 0.40:
            self.mutate_elements(cells, start)
        else:
            self.mutate_rocks(cells, start)
        return replace(p, cells="".join(cells), start=start)

    def mutate_elements(self, cells: list[str], start: int) -> None:
        rng, r = self.rng, self.r
        placed = [c for c, t in enumerate(cells) if t in self.tiles]
        op = rng.random()
        if (op < 0.3 or not placed) and len(placed) < r.max_elements:
            tile = self.pick_tile(cells)
            hosts = self.hosts(cells, start, tile)
            if hosts:
                cells[rng.choice(hosts)] = tile
        elif op < 0.5 and len(placed) > r.min_elements:
            cell = rng.choice(placed)
            cells[cell] = rng.choice((ICE, ROCK)) if cells[cell] == BRITTLE else ICE
        elif placed:
            source = rng.choice(placed)
            tile = cells[source]
            if r.variant == "mixed" and rng.random() < 0.2:
                tile = THIN if tile == BRITTLE else BRITTLE
            cells[source] = ROCK if cells[source] == BRITTLE and rng.random() < 0.5 else ICE
            hosts = self.hosts(cells, start, tile)
            if hosts:
                cells[rng.choice(hosts)] = tile

    def lure_spots(self, p: Puzzle, solution: Sequence[int]) -> list[tuple[int, str]]:
        """おとりになりうる置き方: 最短解から外れた1手目・2手目の滑りを止める岩をもろい岩にする、
        その滑りが通る氷をもろい岩・薄い氷にする。ランダムに置いた要素はほとんど効かないので、
        おとりの候補を直接作る。"""
        rules = rules_of(p)
        n = rules.n
        slides: set[tuple[int, int, int]] = set()
        state = p.start
        for move in solution:
            options = rules.moves(state)
            for d, t in options:
                if d == move:
                    continue
                slides.add((state % n, d, t % n))
                if t % n != p.goal:
                    slides.update((t % n, d2, t2 % n) for d2, t2 in rules.moves(t))
            state = dict(options)[move]
        spots: set[tuple[int, str]] = set()
        for origin, d, end in slides:
            stopper = rules.beyond[d][end]
            if BRITTLE in self.tiles and stopper >= 0 and p.cells[stopper] == ROCK:
                spots.add((stopper, BRITTLE))
            cell = origin
            while cell != end:
                cell += rules.delta[d]
                if p.cells[cell] == ICE and cell not in (p.start, p.goal):
                    spots.update((cell, tile) for tile in self.tiles)
        return sorted(spots)

    def polish(self, p: Puzzle, score: float, solution: Sequence[int]):
        """おとりの候補をすべて試し、点が最も上がるものを受け入れる。上がらなくなるまで繰り返す。"""
        found = None
        while sum(1 for t in p.cells if t in self.tiles) < self.r.max_elements:
            best = None
            for cell, tile in self.lure_spots(p, solution):
                q = replace(p, cells=p.cells[:cell] + tile + p.cells[cell + 1 :])
                value, goal, m = evaluate(q, self.r, score)
                if m is not None and value > score and (best is None or value > best[0]):
                    best = (value, replace(q, goal=goal), m)
            if best is None:
                break
            score, p, m = best
            solution = m.solution
            found = best
        return found

    def mutate_rocks(self, cells: list[str], start: int) -> None:
        rng = self.rng
        rocks = cells.count(ROCK)
        cell = rng.randrange(self.n)
        if cell == start or cells[cell] not in (ICE, ROCK):
            return
        if rng.random() < 0.5:
            if cells[cell] == ROCK and rocks > self.min_rocks:
                cells[cell] = ICE
            elif cells[cell] == ICE and rocks < self.max_rocks:
                cells[cell] = ROCK
            return
        other = rng.randrange(self.n)
        if other == start or cells[other] not in (ICE, ROCK):
            return
        cells[cell], cells[other] = cells[other], cells[cell]

    def run(self) -> tuple[float, Puzzle, Metrics | None]:
        p = self.initial()
        score, goal, m = evaluate(p, self.r)
        p = replace(p, goal=goal)
        best = (score, p, m)
        solution = m.solution if m else ()
        for i in range(1, self.r.iterations):
            if i % POLISH_EVERY == 0 and solution:
                polished = self.polish(p, score, solution)
                if polished is not None:
                    score, p, m = polished
                    solution = m.solution
                    if score >= best[0]:
                        best = polished
                continue
            q = self.mutate(p)
            value, q_goal, q_m = evaluate(q, self.r, score)
            if value >= score:
                p, score = replace(q, goal=q_goal), value
                solution = q_m.solution if q_m else ()
                if value >= best[0]:
                    best = (value, p, q_m)
        return best


# ---------------------------------------------------------------------------
# 盤面の外（x）への置き換え


def outside_marked(p: Puzzle) -> Puzzle:
    """駒が一度も通らない氷・薄い氷と、そのマスにしか接していない岩・もろい岩を x にし、外周の
    x だけの行・列を切り落とす。どの状態でも崩れないもろい岩は岩にする。"""
    rules = rules_of(p)
    g = explore(rules, p.start, p.goal, cap=10**7)
    assert g is not None
    used = used_cells(g)
    touched = touched_elements(g)
    w, h = p.width, p.height
    cells = list(p.cells)
    for c, t in enumerate(p.cells):
        if c in used:
            continue
        if t in (ROCK, BRITTLE):
            x, y = c % w, c // w
            near = [
                (y + DY[d]) * w + x + DX[d]
                for d in range(4)
                if 0 <= x + DX[d] < w and 0 <= y + DY[d] < h
            ]
            if not any(cell in used for cell in near):
                cells[c] = OUTSIDE
            elif t == BRITTLE and rules.element_of[c] not in touched:
                cells[c] = ROCK
        else:
            cells[c] = OUTSIDE
    rows = ["".join(cells[y * w : (y + 1) * w]) for y in range(h)]
    keep_rows = [y for y, row in enumerate(rows) if set(row) != {OUTSIDE}]
    keep_cols = [x for x in range(w) if any(rows[y][x] != OUTSIDE for y in range(h))]
    y0, y1, x0, x1 = keep_rows[0], keep_rows[-1], keep_cols[0], keep_cols[-1]
    nw = x1 - x0 + 1

    def moved(c: int) -> int:
        return (c // w - y0) * nw + (c % w - x0)

    cropped = "".join(rows[y][x0 : x1 + 1] for y in range(y0, y1 + 1))
    return Puzzle(p.variant, nw, y1 - y0 + 1, cropped, moved(p.start), moved(p.goal))


def same_game(a: Puzzle, b: Puzzle) -> bool:
    """x への置き換えで、状態の数・最短手数・最短解の数・最短解の手が変わらない。"""
    ma, mb = measure_puzzle(a), measure_puzzle(b)
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
    recipe: Recipe
    puzzle: Puzzle  # x への置き換え後
    raw: Puzzle
    score: float
    seconds: float
    metrics: Metrics
    dyn_depth: int
    reasons: list[str]

    @property
    def variant(self) -> str:
        return self.recipe.variant

    @property
    def accepted(self) -> bool:
        return not self.reasons

    @property
    def hardness(self) -> float:
        """候補を比べる点: 難しさの点に、状態の読み深さ（DYN_DEPTH_CAP まで）を足したもの。"""
        w = self.recipe.weights
        return hardness(self.metrics, w) + w.read * self.dyn_depth


def make(recipe: Recipe, seed: str) -> Made | None:
    started = time.perf_counter()
    score, raw, _ = Searcher(recipe, random.Random(seed)).run()
    if raw.goal < 0:
        return None
    puzzle = outside_marked(raw)
    assert same_game(raw, puzzle), f"{recipe.name}: x への置き換えで解が変わった"
    m = measure_puzzle(puzzle)
    if m is None:
        return None
    rules = rules_of(puzzle)
    g = explore(rules, puzzle.start, puzzle.goal, cap=10**7)
    depth = dynamic_depth(puzzle, DYN_DEPTH_CAP, g)
    return Made(
        recipe,
        puzzle,
        raw,
        score,
        time.perf_counter() - started,
        m,
        depth,
        violations(m, recipe),
    )


def make_task(task: tuple[Recipe, str]) -> Made | None:
    return make(*task)


SHAPES = (
    (Shape(8, 8), 12, 15),
    (Shape(10, 10), 14, 19),
    (Shape(10, 12), 17, 22),
)
ELEMENT_RANGE = {"brittle": (3, 7, 0), "thin": (3, 7, 0), "mixed": (4, 8, 2)}


def plan_for(variant: str) -> list[Recipe]:
    lo_el, hi_el, each = ELEMENT_RANGE[variant]
    return [
        Recipe(
            f"{variant}-{shape.width}x{shape.height}",
            variant,
            shape,
            lo,
            hi,
            min_elements=lo_el,
            max_elements=hi_el,
            min_each=each,
        )
        for shape, lo, hi in SHAPES
    ]


# ---------------------------------------------------------------------------
# 検証


def slow_moves(p: Puzzle, grid: list[str], pos: int) -> list[tuple[int, list[str], int]]:
    """1マスずつ進めて盤面の文字を書き換える独立の実装（崩れたもろい岩は ``.``、割れた薄い氷は
    ``w``）。"""
    w, h = p.width, p.height
    out = []
    for d in range(4):
        cur = pos
        path = [cur]
        while True:
            x, y = cur % w + DX[d], cur // w + DY[d]
            if not (0 <= x < w and 0 <= y < h) or grid[y * w + x] in STOPPERS:
                break
            cur = y * w + x
            path.append(cur)
        if cur == pos:
            continue
        new = list(grid)
        x, y = cur % w + DX[d], cur // w + DY[d]
        if 0 <= x < w and 0 <= y < h and new[y * w + x] == BRITTLE:
            new[y * w + x] = ICE
        for c in path[:-1]:
            if new[c] == THIN:
                new[c] = WATER
        out.append((d, new, cur))
    return out


def encode(rules: Rules, grid: list[str], pos: int) -> int:
    mask = sum(1 << j for j, cell in enumerate(rules.elements) if grid[cell] != rules.kinds[j])
    return mask * rules.n + pos


def check_slow(p: Puzzle, limit: int = 3000) -> int:
    """到達できる状態（limit まで）で、速い実装の手と1マスずつの実装の手が食い違う状態の数。"""
    rules = rules_of(p)
    queue = [(list(p.cells), p.start)]
    seen = {encode(rules, *queue[0])}
    mismatches = 0
    for grid, pos in queue:
        if len(seen) > limit:
            break
        fast = sorted(rules.moves(encode(rules, grid, pos)))
        slow = slow_moves(p, grid, pos)
        mismatches += fast != sorted((d, encode(rules, g2, p2)) for d, g2, p2 in slow)
        for _, g2, p2 in slow:
            key = encode(rules, g2, p2)
            if key not in seen:
                seen.add(key)
                queue.append((g2, p2))
    return mismatches


def slow_replay(p: Puzzle, moves: Sequence[int]) -> tuple[bool, list[str]]:
    """1マスずつの実装で解を再生する。最後の手で初めてゴールに止まれば真。最後の盤面も返す。"""
    grid, pos = list(p.cells), p.start
    for i, move in enumerate(moves):
        options = {d: (g2, p2) for d, g2, p2 in slow_moves(p, grid, pos)}
        if move not in options:
            return False, grid
        grid, pos = options[move]
        if pos == p.goal and i < len(moves) - 1:
            return False, grid
    return pos == p.goal, grid


def run_hand_checks() -> None:
    def rules(rows: list[str]) -> Rules:
        return Rules(len(rows[0]), len(rows), "".join(rows))

    def go(r: Rules, state: int, move: int) -> int:
        return dict(r.moves(state))[move]

    def split(r: Rules, state: int) -> tuple[int, int]:
        return state % r.n, state // r.n

    r = rules(["....b."])
    s = go(r, 0, 1)
    assert split(r, s) == (3, 1), "もろい岩の手前で止まり、崩れる"
    s = go(r, go(r, s, 3), 1)
    assert split(r, s) == (5, 1), "崩れた跡を通って右端へ"
    r = rules([".b", ".."])
    assert 1 not in dict(r.moves(0)), "隣のもろい岩へ動かない入力は手にならず、崩さない"

    r = rules([".c.#.."])
    s = go(r, 0, 1)
    assert split(r, s) == (2, 1), "薄い氷を通過して岩の手前で止まり、薄い氷が水面になる"
    assert 3 not in dict(r.moves(s)), "水面があるので左へ動けない"
    r = rules(["c.", ".."])
    s = go(r, 1, 3)
    assert split(r, s) == (0, 0), "薄い氷で止まっている間は割れない"
    assert 0 not in dict(r.moves(s)) and 3 not in dict(r.moves(s)), "動かない入力は割らない"
    s = go(r, s, 2)
    assert split(r, s) == (2, 1), "止まっていた薄い氷を離れると水面になる"
    s = go(r, go(r, s, 1), 0)
    assert split(r, s) == (1, 1)
    assert 3 not in dict(r.moves(s)), "水面は止め役"

    r = rules([".c..b."])
    s = go(r, 0, 1)
    assert split(r, s) == (3, 0b11), "1手で薄い氷を割り、もろい岩を崩す"
    s = go(r, s, 3)
    assert split(r, s) == (2, 0b11), "割れた薄い氷で止まる"
    r = rules(["..x.."])
    assert dict(r.moves(0))[1] == 1, "x は外壁と同じ止め役"
    print("hand checks: ok")


def random_puzzle(rng: random.Random, shape: Shape) -> Puzzle:
    w, h = shape.width, shape.height
    cells = [ROCK if rng.random() < 0.2 else ICE for _ in range(w * h)]
    start = rng.choice([c for c, t in enumerate(cells) if t == ICE])
    pool = [c for c in range(w * h) if c != start]
    for c in rng.sample(pool, rng.randrange(2, 8)):
        cells[c] = BRITTLE if rng.random() < 0.5 or cells[c] == ROCK else THIN
    return Puzzle("mixed", w, h, "".join(cells), start)


def run_verify(args: argparse.Namespace) -> None:
    """手で作った盤面の遷移、ランダム盤面での速い実装と1マスずつの実装の一致、x への置き換えで
    解が変わらないこと、条件1の数え方（薄い氷だけなら同じ向きが続く手は無い）。"""
    run_hand_checks()
    rng = random.Random(f"{args.seed}-v4-verify")
    mismatches = marked = changed = 0
    for _ in range(args.samples):
        p = random_puzzle(rng, Shape(rng.choice((5, 6, 7)), rng.choice((5, 6, 7))))
        mismatches += check_slow(p)
        rules = rules_of(p)
        g = explore(rules, p.start, cap=10**7)
        assert g is not None
        n = rules.n
        spots = sorted({s % n for s in g.order if p.cells[s % n] == ICE and s % n != p.start})
        if not spots:
            continue
        q = replace(p, goal=rng.choice(spots))
        marked += 1
        changed += not same_game(q, outside_marked(q))
    print(
        f"両方の要素: samples={args.samples} 速い実装との不一致={mismatches} "
        f"x 置き換え {marked} 問で解が変わった={changed}"
    )
    repeats = 0
    for _ in range(args.samples):
        p = random_puzzle(rng, Shape(6, 6))
        p = replace(p, cells=p.cells.replace(BRITTLE, ROCK))
        g = explore(rules_of(p), p.start, cap=10**7)
        assert g is not None
        repeats += repeat_stats(g, {}, 0, 0)[2]
    print(f"薄い氷だけの盤面 {args.samples} 問で、同じ向きが続けられる2手の組={repeats}")


# ---------------------------------------------------------------------------
# 出力


def move_names(moves: Sequence[int]) -> list[str]:
    return [DIRECTION_WORDS[m] for m in moves]


def render(p: Puzzle) -> list[str]:
    rows = [list(row) for row in p.rows]
    w = p.width
    rows[p.start // w][p.start % w] = "S"
    rows[p.goal // w][p.goal % w] = "G"
    return ["".join(row) for row in rows]


LOOKS_LABEL = {
    "unsolvable": "解なし",
    "misleading": "解が通らない",
    "detour": "遠回り",
    "shortcut": "近道",
}


def looks_label(m: Metrics) -> str:
    if m.looks.shortest is None:
        return "解なし"
    return f"{m.looks.shortest}手・{'通る' if m.looks.canonical_valid else '通らない'}"


def verify_candidate(made: Made) -> dict:
    """候補の独立な検証: 1マスずつの実装での再生、最短手数（ゴールに着く状態の BFS）、条件1・2、
    初期盤面の文字。"""
    p, m = made.puzzle, made.metrics
    ok, _ = slow_replay(p, m.solution)
    assert ok, "解を1マスずつ再生してもゴールで止まらない"
    assert set(p.cells) <= {ICE, ROCK, BRITTLE, THIN, OUTSIDE}
    assert p.cells[p.start] == ICE and p.cells[p.goal] == ICE
    assert check_slow(p, limit=10**6) == 0
    queue, seen = [(list(p.cells), p.start, 0)], {"".join(p.cells) + str(p.start)}
    slow_shortest = None
    for grid, pos, d in queue:
        if pos == p.goal:
            slow_shortest = d
            break
        for _, g2, p2 in slow_moves(p, grid, pos):
            key = "".join(g2) + str(p2)
            if key not in seen:
                seen.add(key)
                queue.append((g2, p2, d + 1))
    assert slow_shortest == m.shortest, (slow_shortest, m.shortest)
    condition1 = m.solution_repeats == 0 and m.near_repeats == 0 and m.chains == 0
    condition2 = m.irrelevant == 0 and m.decoys >= made.recipe.decoys_needed(m.elements)
    return {"condition1": condition1, "condition2": condition2, "slow_shortest": slow_shortest}


def candidate_entry(made: Made) -> dict:
    p, m = made.puzzle, made.metrics
    check = verify_candidate(made)
    rules = rules_of(p)
    w = p.width
    sols = static_solutions(p)
    valid = sum(replay(rules, p.start, s, p.goal) for s in sols)
    return {
        "variant": p.variant,
        "width": p.width,
        "height": p.height,
        "rows": p.rows,
        "start": [p.start % w, p.start // w],
        "goal": [p.goal % w, p.goal // w],
        "optimal": m.shortest,
        "solution": move_names(m.solution),
        "features": {
            "recipe": made.recipe.name,
            "elements": [
                {"at": [c % w, c // w], "kind": rules.kinds[j], "role": m.roles[j]}
                for j, c in enumerate(rules.elements)
            ],
            "brittle": m.brittle,
            "thin": m.thin,
            "decoys": m.decoys,
            "weak_decoys": m.weak_decoys,
            "uses": m.uses,
            "distinct": m.distinct,
            "events": m.events,
            "precedence_pairs": m.precedence,
            "soft_precedence_pairs": m.soft_precedence,
            "order_chain": m.order_chain,
            "order_traps": m.order_traps,
            "order_lures": m.order_lures,
            "lures": m.lures,
            "dead_options": m.dead_options,
            "looks": m.looks_class,
            "static_looks": m.looks.shortest,
            "static_looks_valid": m.looks.canonical_valid,
            "static_looks_valid_solutions": [valid, len(sols)],
            "static_looks_depth": static_depth(p),
            "static_other": m.other.shortest,
            "static_other_valid": m.other.canonical_valid,
            "dynamic_depth": made.dyn_depth,
            "plans": m.plans,
            "states": m.states,
            "near_extra": m.near_extra,
            "dead_states": m.dead_states,
            "forced": m.forced,
            "solution_repeats": m.solution_repeats,
            "near_repeats": m.near_repeats,
            "brittle_chains": m.chains,
            "repeat_moves_all": m.repeat_moves,
            "repeat_moves_live": m.repeat_live,
            "condition1": check["condition1"],
            "condition2": check["condition2"],
            "hardness": round(made.hardness, 2),
            "outside_cells": p.cells.count(OUTSIDE),
            "raw_size": [made.raw.width, made.raw.height],
            "seconds": round(made.seconds, 2),
        },
    }


def med(values: Sequence[float]) -> str:
    return f"{statistics.median(values):g}" if values else "-"


def summarize(variant: str, made: Sequence[Made]) -> None:
    ok = [m for m in made if m.accepted]
    seconds = [m.seconds for m in made]
    print(
        f"# {VARIANT_LABEL[variant]}: 採用 {len(ok)}/{len(made)} 1回 平均"
        f"{statistics.mean(seconds):.1f}s"
    )
    print(f"  外れた理由: {dict(Counter(r for m in made for r in m.reasons))}")
    group = ok or list(made)
    looks = Counter(m.metrics.looks_class for m in group)
    ms = [m.metrics for m in group]
    print(
        f"  {'採用' if ok else '全体'}{len(group)}問の中央値: 最短 {med([m.shortest for m in ms])} "
        f"状態 {med([m.states for m in ms])} 要素 {med([m.elements for m in ms])} "
        f"使う {med([m.uses for m in ms])} 変化させる要素 {med([m.distinct for m in ms])} "
        f"おとり {med([m.decoys for m in ms])} 順序の組 {med([m.precedence for m in ms])} "
        f"順序の連なり {med([m.order_chain for m in ms])} 順序の罠 "
        f"{med([m.order_traps for m in ms])} 誘い {med([m.lures for m in ms])} "
        f"読み深さ(状態) {med([m.dyn_depth for m in group])} 近い状態 "
        f"{med([m.near_extra for m in ms])} 難しさ {med([m.hardness for m in group])}"
    )
    print(f"  見た目どおりの読み: {dict(looks)}")


def traits(m: Made) -> dict[str, object]:
    return {"shape": m.recipe.shape, "looks": m.metrics.looks_class}


def choose(made: Sequence[Made], count: int) -> list[Made]:
    """難しさの点の上位から、盤面の大きさと見た目どおりの読みの結果がなるべく重ならないように選ぶ。
    両方が既に選んだ問題と違うもの、大きさだけ違うもの、読みの結果だけ違うもの、の順に緩める。"""
    ranked = sorted((m for m in made if m.accepted), key=lambda m: -m.hardness)
    chosen: list[Made] = []
    for keys in (("shape", "looks"), ("shape",), ("looks",), ()):
        for m in ranked:
            if len(chosen) >= count:
                return chosen
            mine = traits(m)
            if m not in chosen and all(mine[k] != traits(c)[k] for c in chosen for k in keys):
                chosen.append(m)
    return chosen


def interleave(groups: list[list[Made]], rng: random.Random) -> list[Made]:
    """種類を混ぜた順。各巡で種類の順を混ぜ、巡の境目で同じ種類が続かないようにする。"""
    out: list[Made] = []
    for round_index in range(max(len(g) for g in groups)):
        members = [g[round_index] for g in groups if round_index < len(g)]
        for _ in range(20):
            rng.shuffle(members)
            if not out or members[0].variant != out[-1].variant:
                break
        out += members
    return out


def run_candidates(args: argparse.Namespace) -> None:
    recipes = [replace(r, iterations=args.iterations) for v in args.variants for r in plan_for(v)]
    tasks = [
        (recipe, f"{args.seed}-v4-{recipe.name}-{run}")
        for recipe in recipes
        for run in range(args.runs)
    ]
    made = [m for m in parallel(make_task, tasks, args.workers) if m is not None]
    groups = []
    for variant in args.variants:
        mine = [m for m in made if m.variant == variant]
        summarize(variant, mine)
        for recipe in (r for r in recipes if r.variant == variant):
            ms = [m for m in mine if m.recipe.name == recipe.name]
            print(
                f"  {recipe.label}: 採用 {sum(m.accepted for m in ms)}/{len(ms)} "
                f"難しさ {med([m.hardness for m in ms if m.accepted])}"
            )
        groups.append(choose(mine, args.per_variant))
    output = []
    for number, m in enumerate(interleave(groups, random.Random(f"{args.seed}-v4-order")), 1):
        entry = {"id": f"w{number:02d}", **candidate_entry(m)}
        output.append(entry)
        f = entry["features"]
        valid, total = f["static_looks_valid_solutions"]
        print(
            f"\n{entry['id']} {VARIANT_LABEL[m.variant]} {m.puzzle.width}x{m.puzzle.height} "
            f"最短{m.metrics.shortest} 難しさ{f['hardness']} 要素{m.metrics.elements}"
            f"（b{m.metrics.brittle} c{m.metrics.thin}） 役割{Counter(m.metrics.roles)}\n"
            f"  出来事{m.metrics.events} 順序の組{m.metrics.precedence} "
            f"連なり{m.metrics.order_chain} 順序の罠{m.metrics.order_traps} "
            f"誘い{m.metrics.lures} 読み深さ(状態){m.dyn_depth}\n"
            f"  見た目どおり {looks_label(m.metrics)}（最短解 {valid}/{total} が通る、"
            f"読み深さ {f['static_looks_depth']}） 状態{m.metrics.states} "
            f"近い状態{m.metrics.near_extra} 同じ向きが続けられる組 {m.metrics.repeat_moves}"
            f"（続けても解ける{m.metrics.repeat_live}） 条件1 {f['condition1']} "
            f"条件2 {f['condition2']}"
        )
        for line in render(m.puzzle):
            print("    " + line)
        print("    解: " + " ".join(entry["solution"]))
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(output)} problems to {args.output}")


def run_probe(args: argparse.Namespace) -> None:
    """1つの種類・盤面を --runs 回作り、分布を見る（重みの調整用）。"""
    recipe = replace(plan_for(args.variants[0])[args.shape], iterations=args.iterations)
    if args.max_elements:
        recipe = replace(recipe, max_elements=args.max_elements)
    tasks = [(recipe, f"{args.seed}-probe-{recipe.name}-{run}") for run in range(args.runs)]
    made = [m for m in parallel(make_task, tasks, args.workers) if m is not None]
    summarize(recipe.variant, made)
    for m in made:
        mt = m.metrics
        print(
            f"  hard={m.hardness:.1f} score={m.score:.1f} 最短{mt.shortest} 要素{mt.elements} "
            f"役割{dict(Counter(mt.roles))} 使う{mt.uses} 順序{mt.precedence}/{mt.soft_precedence}/{mt.order_chain} "
            f"罠{mt.order_traps} 誘い{mt.lures} 読み{m.dyn_depth} looks={mt.looks_class} "
            f"解{mt.plans} 近い{mt.near_extra} 繰り返し{mt.near_repeats}/{mt.chains} "
            f"{m.seconds:.0f}s {m.reasons}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("verify", "probe", "candidates"))
    parser.add_argument("--variants", nargs="+", default=list(VARIANTS), choices=VARIANTS)
    parser.add_argument("--shape", type=int, default=1, help="probe の盤面（0〜2、SHAPES の番号）")
    parser.add_argument("--iterations", type=int, default=3000)
    parser.add_argument(
        "--max-elements", type=int, default=0, help="probe の要素の数の上限（0 は既定）"
    )
    parser.add_argument("--runs", type=int, default=8)
    parser.add_argument("--per-variant", type=int, default=3)
    parser.add_argument("--samples", type=int, default=100)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--output", default="/tmp/v4-candidates.json")
    args = parser.parse_args()
    {"verify": run_verify, "probe": run_probe, "candidates": run_candidates}[args.suite](args)


if __name__ == "__main__":
    main()
