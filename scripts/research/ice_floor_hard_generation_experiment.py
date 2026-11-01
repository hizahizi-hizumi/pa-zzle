"""氷の床迷路（作業名）の難易度再設計のための生成PoC。

長い問題を局所探索でどこまで作れるか、長いだけで簡単な問題をどの特徴量で見分けられるか、
最適化の目的関数で出てくる問題がどう変わるかを測る。

盤面は氷と岩だけ。乱数はすべて seed と条件名から作り、結果を再現可能にする。
Python標準ライブラリだけを使う。
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
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import (  # noqa: E402
    MAX_LOOKAHEAD,
    TIE_ORDERS,
    Shape,
    analyze,
    manhattan_heuristic,
    parse_shape,
    plan_depth,
    spearman,
    undo_search_moves,
)
from ice_floor_supply_experiment import (  # noqa: E402
    ICE,
    ROCK,
    Board,
    canonical_key,
    count_shortest_paths,
    explore,
    percentile,
    random_board,
    without_irrelevant_rocks,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
PROBLEM_POOL = REPO_ROOT / "frontend/src/games/ice-floor-maze/problem/problem-pool.json"

# 方向番号: 0=上, 1=右, 2=下, 3=左（供給実験と同じ）
DIRECTIONS = range(4)
# 人のモデル（前向き・逆向き・両方向の先読みプレイヤー）が読む手数の上限。解けなければ UNREAD
MAX_READ = 12
UNREAD = MAX_READ + 1
NEAR_PATH_SLACK = 2
NEAR_PATH_CAP = 5000
CHECKPOINTS = (500, 1000, 2000, 4000, 8000, 16000)


# ---------------------------------------------------------------------------
# 盤面と停止点グラフ


def stop_tables(width: int, height: int, rock: Sequence[bool]) -> tuple[list[int], ...]:
    """各マスから上・右・下・左へ滑ったときに止まるマス。すぐ岩・外壁なら自分自身。"""
    n = width * height
    up, right, down, left = [0] * n, [0] * n, [0] * n, [0] * n
    for x in range(width):
        last = -1
        for y in range(height):
            cell = y * width + x
            if rock[cell]:
                last = -1
                continue
            if last < 0:
                last = cell
            up[cell] = last
        last = -1
        for y in range(height - 1, -1, -1):
            cell = y * width + x
            if rock[cell]:
                last = -1
                continue
            if last < 0:
                last = cell
            down[cell] = last
    for y in range(height):
        row = y * width
        last = -1
        for x in range(width):
            cell = row + x
            if rock[cell]:
                last = -1
                continue
            if last < 0:
                last = cell
            left[cell] = last
        last = -1
        for x in range(width - 1, -1, -1):
            cell = row + x
            if rock[cell]:
                last = -1
                continue
            if last < 0:
                last = cell
            right[cell] = last
    return up, right, down, left


def forward_dist(tables: tuple[list[int], ...], start: int) -> dict[int, int]:
    up, right, down, left = tables
    dist = {start: 0}
    queue = [start]
    for state in queue:
        step = dist[state] + 1
        for end in (up[state], right[state], down[state], left[state]):
            if end not in dist:
                dist[end] = step
                queue.append(end)
    return dist


def board_rocks(board: Board) -> list[bool]:
    return [tile == ROCK for tile in board.cells]


def to_board(width: int, height: int, rock: Sequence[bool]) -> Board:
    return Board(width, height, "".join(ROCK if r else ICE for r in rock))


@dataclass
class StopGraph:
    """盤面全体の停止点（岩・外壁に接する氷のマスと開始位置）と、その間の滑り。

    人は到達できるかを知らずにゴールの手前を逆向きに考えるので、逆向きの推論は
    開始位置から到達できない停止点も含めたこのグラフで行う。"""

    board: Board
    succ: dict[int, list[tuple[int, int]]]
    pred: dict[int, list[tuple[int, int]]]
    dist: dict[int, dict[int, int]]  # dist[a][b] は a から b への最少手数
    rdist: dict[int, dict[int, int]]  # rdist[b][a] = dist[a][b]


def stop_graph(board: Board, start: int) -> StopGraph:
    rock = board_rocks(board)
    tables = stop_tables(board.width, board.height, rock)
    nodes = {start}
    for cell, is_rock in enumerate(rock):
        if not is_rock:
            nodes.update(table[cell] for table in tables)
    succ: dict[int, list[tuple[int, int]]] = {}
    pred: dict[int, list[tuple[int, int]]] = {node: [] for node in nodes}
    for node in nodes:
        moves = [(d, tables[d][node]) for d in DIRECTIONS if tables[d][node] != node]
        succ[node] = moves
        for d, end in moves:
            pred[end].append((d, node))
    dist: dict[int, dict[int, int]] = {}
    for node in nodes:
        seen = {node: 0}
        queue = [node]
        for state in queue:
            step = seen[state] + 1
            for _, end in succ[state]:
                if end not in seen:
                    seen[end] = step
                    queue.append(end)
        dist[node] = seen
    rdist: dict[int, dict[int, int]] = {node: {} for node in nodes}
    for a, row in dist.items():
        for b, value in row.items():
            rdist[b][a] = value
    return StopGraph(board, succ, pred, dist, rdist)


def manhattan(width: int, a: int, b: int) -> int:
    return abs(a % width - b % width) + abs(a // width - b // width)


def line_of_sight(board: Board, a: int, b: int) -> bool:
    w = board.width
    ax, ay, bx, by = a % w, a // w, b % w, b // w
    if ax == bx:
        step = w if by > ay else -w
    elif ay == by:
        step = 1 if bx > ax else -1
    else:
        return False
    cell = a + step
    while cell != b:
        if board.cells[cell] == ROCK:
            return False
        cell += step
    return True


# ---------------------------------------------------------------------------
# 人の解き方のモデル


def lookahead_solves(
    succ: dict[int, list[tuple[int, int]]],
    dist: dict[int, dict[int, int]],
    origin: int,
    targets: frozenset[int],
    score_of: Callable[[int], tuple[int, ...]],
    best_within: Callable[[int], tuple[int, ...]],
    depth: int,
    limit: int,
    tie_order: Sequence[int],
) -> bool:
    """難易度PoCの先読みプレイヤーと同じ規則。depth 手先までに targets のどれかがあれば解け、
    無ければ各手の後 depth−1 手以内で最もよい停止点で手を比べる。戻らない・待ったを使わない。"""
    state = origin
    visited = {origin}
    moves = 0
    while moves < limit:
        row = dist[state]
        if any(row.get(t, UNREAD + 99) <= depth for t in targets):
            return True
        best: tuple[tuple[int, ...], tuple[int, ...], int] | None = None
        best_end = -1
        for direction, end in succ[state]:
            if end in visited:
                continue
            key = (best_within(end), score_of(end), tie_order[direction])
            if best is None or key < best:
                best, best_end = key, end
        if best is None:
            return False
        state = best_end
        visited.add(state)
        moves += 1
    return False


def read_depth(
    succ: dict[int, list[tuple[int, int]]],
    dist: dict[int, dict[int, int]],
    origin: int,
    targets_at: Callable[[int], frozenset[int]],
    score_at: Callable[[int], Callable[[int], tuple[int, ...]]],
    limit: int,
) -> int:
    """全同点順位のうち最も少ない読みで解ける手数。MAX_READ でも解けなければ UNREAD。"""
    for depth in range(1, MAX_READ + 1):
        targets = targets_at(depth)
        score_of = score_at(depth)
        cache: dict[int, tuple[int, ...]] = {}

        def best_within(node: int, depth: int = depth, score_of=score_of, cache=cache):
            value = cache.get(node)
            if value is None:
                value = min(score_of(t) for t, d in dist[node].items() if d <= depth - 1)
                cache[node] = value
            return value

        for order in TIE_ORDERS:
            if lookahead_solves(
                succ, dist, origin, targets, score_of, best_within, depth, limit, order
            ):
                return depth
    return UNREAD


def toward(board: Board, target: int, align: bool) -> Callable[[int], tuple[int, ...]]:
    w = board.width
    if align:
        return lambda s: (0 if line_of_sight(board, s, target) else 1, manhattan(w, s, target))
    return lambda s: (manhattan(w, s, target),)


@dataclass(frozen=True)
class Features:
    shortest: int
    density: float
    reachable: int
    stops: int  # 盤面全体の停止点
    optimal_paths: int
    near_paths: int  # 最少手数+2手以内で、同じ停止点を二度通らない道筋の数（上限 NEAR_PATH_CAP）
    goal_preds: int  # 1手でゴールに止まれる、到達できる停止点の数
    goal_preds_global: int  # 同じく、盤面全体の停止点の数（逆向きに考える人が見る入口）
    back_within2: int  # 盤面全体で、ゴールへ2手以内で止まれる停止点の数
    forward_depth: int  # 前向き（近づく・揃える）の先読みで解ける読み手数
    backward_depth: int  # ゴールから逆向きに、開始位置へ近づく先読みで繋がる読み手数
    bidir_depth: int  # ゴールから k 手逆に読んだ停止点の集合を、前向きに k 手読んで目指すときの k
    human_depth: int  # 上の3つの最小。人が最も楽な方向から読んだときの読み手数
    legacy_depth: int  # 現行の計画深さ（6手まで。解けなければ 7）
    trial_moves: int  # 待ったを使い近づく順に試す試行錯誤の手数（現行の試行手数）
    forced_steps: int  # 最短の道筋のうち、戻らない選択肢が1つしかない手
    decisions: int  # 最短の道筋のうち、2手以上の遠回りか詰みになる選択肢がある手
    trap_options: int  # 最短の道筋上で、詰みへ入る選択肢の数
    dead_states: int
    pass_over: int
    fwd_bfs: int  # ゴールを見つけるまでに前向きBFSが調べる停止点
    bwd_bfs: int  # 同じく、ゴールから逆向き（盤面全体）
    bidir_bfs: int  # 小さい方の前線を広げる両方向BFSが、出会うまでに調べる停止点


def near_path_count(graph: StopGraph, start: int, goal: int, budget: int) -> int:
    to_goal = graph.rdist[goal]
    count = 0
    stack: list[tuple[int, int, frozenset[int]]] = [(start, 0, frozenset((start,)))]
    while stack and count < NEAR_PATH_CAP:
        state, used, seen = stack.pop()
        if state == goal:
            count += 1
            continue
        for _, end in graph.succ[state]:
            if end in seen:
                continue
            remaining = to_goal.get(end)
            if remaining is None or used + 1 + remaining > budget:
                continue
            stack.append((end, used + 1, seen | {end}))
    return count


def path_choices(graph: StopGraph, start: int, goal: int) -> tuple[int, int, int]:
    """方向番号の小さい手を優先した最短の道筋で、(forced_steps, decisions, trap_options)。"""
    to_goal = graph.rdist[goal]
    state = start
    prefix = {start}
    forced = decisions = traps = 0
    while state != goal:
        remaining = to_goal[state]
        options = [end for _, end in graph.succ[state] if end not in prefix]
        if len(options) == 1:
            forced += 1
        costly = 0
        for end in options:
            after = to_goal.get(end)
            if after is None:
                traps += 1
                costly += 1
            elif after + 1 - remaining >= 2:
                costly += 1
        if costly:
            decisions += 1
        state = next(end for _, end in graph.succ[state] if to_goal.get(end) == remaining - 1)
        prefix.add(state)
    return forced, decisions, traps


def bidirectional_bfs_cost(graph: StopGraph, start: int, goal: int, shortest: int) -> int:
    forward_layers = Counter(graph.dist[start].values())
    backward_layers = Counter(graph.rdist[goal].values())
    f = b = 0
    cost = 0
    while f + b < shortest:
        if forward_layers[f] <= backward_layers[b]:
            cost += forward_layers[f]
            f += 1
        else:
            cost += backward_layers[b]
            b += 1
    return cost


def pass_over_states(board: Board, graph: StopGraph, reachable: Sequence[int], goal: int) -> int:
    w = board.width
    gx, gy = goal % w, goal // w
    count = 0
    for state in reachable:
        for _, end in graph.succ[state]:
            sx, sy, ex, ey = state % w, state // w, end % w, end // w
            if end == goal:
                continue
            if sx == ex == gx and min(sy, ey) < gy < max(sy, ey):
                count += 1
                break
            if sy == ey == gy and min(sx, ex) < gx < max(sx, ex):
                count += 1
                break
    return count


def legacy_give_up(shortest: int) -> int:
    """難易度PoCのプレイヤーが諦める手数。"""
    return 4 * shortest + 8


def tight_give_up(shortest: int) -> int:
    """読みで解けたとみなす手数の上限。

    4d+8 では、最少手数が20を超えると、戻らないだけの貪欲なプレイヤーが到達できる停止点を
    ほぼ総なめにしてゴールへ行き着き、読みが要らないと判定されてしまう。最短の1.5倍＋2までに抑える。"""
    return shortest + (shortest + 1) // 2 + 2


def features_of(
    board: Board, start: int, goal: int, give_up: Callable[[int], int] = tight_give_up
) -> Features:
    graph = stop_graph(board, start)
    forward = graph.dist[start]
    shortest = forward[goal]
    limit = give_up(shortest)
    reachable = list(forward)
    to_goal = graph.rdist[goal]
    w = board.width

    forward_depth = min(
        read_depth(
            graph.succ,
            graph.dist,
            start,
            lambda _: frozenset((goal,)),
            lambda _, a=align: toward(board, goal, a),
            limit,
        )
        for align in (False, True)
    )
    reverse_succ = {node: list(moves) for node, moves in graph.pred.items()}
    backward_depth = min(
        read_depth(
            reverse_succ,
            graph.rdist,
            goal,
            lambda _: frozenset((start,)),
            lambda _, a=align: toward(board, start, a),
            limit,
        )
        for align in (False, True)
    )

    def approach(depth: int) -> frozenset[int]:
        return frozenset(node for node, d in to_goal.items() if d <= depth)

    def toward_approach(depth: int) -> Callable[[int], tuple[int, ...]]:
        members = approach(depth)
        return lambda s: (min(manhattan(w, s, m) for m in members),)

    bidir_depth = read_depth(graph.succ, graph.dist, start, approach, toward_approach, limit)

    reach = explore(board, start)
    legacy = analyze(reach, goal)
    trial_moves = int(
        statistics.median(
            undo_search_moves(reach, goal, manhattan_heuristic(board, goal), order)
            for order in TIE_ORDERS
        )
    )
    forced, decisions, traps = path_choices(graph, start, goal)
    rocks = sum(1 for tile in board.cells if tile == ROCK)
    return Features(
        shortest=shortest,
        density=round(rocks / len(board.cells), 3),
        reachable=len(reachable),
        stops=len(graph.succ),
        optimal_paths=count_shortest_paths(reach, goal),
        near_paths=near_path_count(graph, start, goal, shortest + NEAR_PATH_SLACK),
        goal_preds=sum(1 for _, s in graph.pred[goal] if s in forward),
        goal_preds_global=len(graph.pred[goal]),
        back_within2=sum(1 for d in to_goal.values() if 1 <= d <= 2),
        forward_depth=forward_depth,
        backward_depth=backward_depth,
        bidir_depth=bidir_depth,
        human_depth=min(forward_depth, backward_depth, bidir_depth),
        legacy_depth=plan_depth(legacy),
        trial_moves=trial_moves,
        forced_steps=forced,
        decisions=decisions,
        trap_options=traps,
        dead_states=sum(1 for s in reachable if goal not in graph.dist[s]),
        pass_over=pass_over_states(board, graph, reachable, goal),
        fwd_bfs=sum(1 for d in forward.values() if d < shortest),
        bwd_bfs=sum(1 for d in to_goal.values() if d < shortest),
        bidir_bfs=bidirectional_bfs_cost(graph, start, goal, shortest),
    )


# ---------------------------------------------------------------------------
# 局所探索による生成


@dataclass(frozen=True)
class SearchSpec:
    width: int
    height: int
    method: str  # random / hc / sa / ga
    objective: str  # length / composite
    iterations: int
    init_density: float = 0.20
    min_density: float = 0.08
    max_density: float = 0.40
    min_shortest: int = 0  # ゴールに選ぶ最少手数の範囲。max_shortest=0 は上限なし
    max_shortest: int = 0
    temperature: float = 1.5  # sa の初期温度


@dataclass
class Generated:
    width: int
    height: int
    cells: str
    start: int
    goal: int
    shortest: int
    score: float
    seconds: float
    trace: dict[int, float]  # 評価回数 -> その時点の最良スコア
    best_shortest_trace: dict[int, int]

    @property
    def board(self) -> Board:
        return Board(self.width, self.height, self.cells)


Evaluation = tuple[float, int, int]  # (スコア, ゴール, 最少手数)


def evaluate_length(
    width: int, height: int, rock: Sequence[bool], start: int, cap: int
) -> Evaluation:
    tables = stop_tables(width, height, rock)
    dist = forward_dist(tables, start)
    best_goal, best = -1, 0
    for state, d in dist.items():
        if cap and d > cap:
            continue
        if d > best or (d == best and state < best_goal):
            best, best_goal = d, state
    return float(best), best_goal, best


def composite_score(
    width: int, tables: tuple[list[int], ...], dist: dict[int, int], start: int, goal: int
) -> float:
    """最少手数＋読みどころ（2手以上の遠回りか詰みになる選択肢がある手）−最短解の多さ。

    到達できる停止点のグラフだけで求め、局所探索の1回の評価を軽く保つ。"""
    succ = {s: [t[s] for t in tables if t[s] != s] for s in dist}
    pred: dict[int, list[int]] = {s: [] for s in dist}
    for s, ends in succ.items():
        for e in ends:
            pred[e].append(s)
    to_goal = {goal: 0}
    queue = [goal]
    for state in queue:
        for prev in pred[state]:
            if prev not in to_goal:
                to_goal[prev] = to_goal[state] + 1
                queue.append(prev)
    shortest = dist[goal]
    ways = {start: 1}
    for state in sorted(dist, key=dist.__getitem__):
        count = ways.get(state, 0)
        if not count:
            continue
        for end in succ[state]:
            if dist[end] == dist[state] + 1:
                ways[end] = ways.get(end, 0) + count
    state = start
    prefix = {start}
    decisions = 0
    while state != goal:
        remaining = to_goal[state]
        nxt = -1
        costly = False
        for end in succ[state]:
            if end in prefix:
                continue
            after = to_goal.get(end)
            if after is None or after + 1 - remaining >= 2:
                costly = True
            if after == remaining - 1 and nxt < 0:
                nxt = end
        decisions += costly
        state = nxt
        prefix.add(state)
    return shortest + decisions - 2.0 * math.log2(ways[goal])


def evaluate_composite(
    width: int, height: int, rock: Sequence[bool], start: int, min_shortest: int, cap: int
) -> Evaluation:
    """範囲内で長い方から6つのゴールを比べる。範囲に届かない盤面は長さだけで比べ、罰を与える。"""
    tables = stop_tables(width, height, rock)
    dist = forward_dist(tables, start)
    in_cap = [d for d in dist.values() if not cap or d <= cap]
    longest = max(in_cap)
    floor = max(min_shortest, longest - 2, 1)
    candidates = sorted(
        (s for s, d in dist.items() if floor <= d and (not cap or d <= cap)),
        key=lambda s: (-dist[s], s),
    )[:6]
    if longest < max(min_shortest, 1) or not candidates:
        return float(longest) - 100.0, start, 0
    best: Evaluation | None = None
    for goal in candidates:
        score = composite_score(width, tables, dist, start, goal)
        if best is None or score > best[0]:
            best = (score, goal, dist[goal])
    assert best is not None
    return best


class Searcher:
    def __init__(self, spec: SearchSpec, rng: random.Random) -> None:
        self.spec = spec
        self.rng = rng
        self.n = spec.width * spec.height
        self.min_rocks = int(spec.min_density * self.n)
        self.max_rocks = int(spec.max_density * self.n)
        self.evaluations = 0
        self.best: tuple[float, list[bool], int, int, int] | None = None
        self.trace: dict[int, float] = {}
        self.shortest_trace: dict[int, int] = {}

    def evaluate(self, rock: list[bool], start: int) -> Evaluation:
        spec = self.spec
        if spec.objective == "length":
            result = evaluate_length(spec.width, spec.height, rock, start, spec.max_shortest)
        else:
            result = evaluate_composite(
                spec.width, spec.height, rock, start, spec.min_shortest, spec.max_shortest
            )
        self.evaluations += 1
        if self.best is None or result[0] > self.best[0]:
            self.best = (result[0], list(rock), start, result[1], result[2])
        if self.evaluations in CHECKPOINTS:
            assert self.best is not None
            self.trace[self.evaluations] = self.best[0]
            self.shortest_trace[self.evaluations] = self.best[4]
        return result

    def initial(self) -> tuple[list[bool], int]:
        rng = self.rng
        rock = [rng.random() < self.spec.init_density for _ in range(self.n)]
        rocks = sum(rock)
        while rocks < self.min_rocks or rocks > self.max_rocks:
            cell = rng.randrange(self.n)
            if rocks < self.min_rocks and not rock[cell]:
                rock[cell] = True
                rocks += 1
            elif rocks > self.max_rocks and rock[cell]:
                rock[cell] = False
                rocks -= 1
        ice = [c for c in range(self.n) if not rock[c]]
        return rock, ice[rng.randrange(len(ice))]

    def mutate(self, rock: list[bool], start: int) -> tuple[list[bool], int]:
        rng = self.rng
        rock = list(rock)
        roll = rng.random()
        if roll < 0.10:
            ice = [c for c in range(self.n) if not rock[c]]
            return rock, ice[rng.randrange(len(ice))]
        rocks = sum(rock)
        cell = rng.randrange(self.n)
        if cell == start:
            return rock, start
        toggles = roll < 0.55
        if toggles and (self.min_rocks < rocks if rock[cell] else rocks < self.max_rocks):
            rock[cell] = not rock[cell]
            return rock, start
        # 岩の数を保ったまま、岩を1つ別の氷のマスへ動かす
        if rock[cell]:
            target = rng.randrange(self.n)
            if not rock[target] and target != start:
                rock[cell], rock[target] = False, True
        else:
            source = rng.randrange(self.n)
            if rock[source]:
                rock[source], rock[cell] = False, True
        return rock, start

    def run(self) -> None:
        method = self.spec.method
        if method == "random":
            for _ in range(self.spec.iterations):
                self.evaluate(*self.initial())
        elif method in ("hc", "sa"):
            self.anneal(temperature=self.spec.temperature if method == "sa" else 0.0)
        elif method == "ga":
            self.evolve()
        else:
            raise ValueError(method)

    def ceiling(self) -> float:
        """上限付きの目的関数がそれ以上よくならない値。0 は上限なし。

        合成の目的関数は、最少手数が範囲の上限で、どの手にも読みどころがあり、最短解が一意のとき最大になる。"""
        cap = self.spec.max_shortest
        if not cap:
            return 0
        return cap if self.spec.objective == "length" else 2 * cap

    def anneal(self, temperature: float, final_temperature: float = 0.05) -> None:
        rock, start = self.initial()
        score = self.evaluate(rock, start)[0]
        iterations = self.spec.iterations
        ceiling = self.ceiling()
        for step in range(1, iterations):
            if ceiling and score >= ceiling:
                break
            candidate, candidate_start = self.mutate(rock, start)
            value = self.evaluate(candidate, candidate_start)[0]
            if value >= score:
                accept = True
            elif temperature > 0:
                t = temperature * (final_temperature / temperature) ** (step / iterations)
                accept = self.rng.random() < math.exp((value - score) / t)
            else:
                accept = False
            if accept:
                rock, start, score = candidate, candidate_start, value

    def evolve(self, population_size: int = 24) -> None:
        rng = self.rng
        population = []
        for _ in range(population_size):
            rock, start = self.initial()
            population.append((self.evaluate(rock, start)[0], rock, start))
        while self.evaluations < self.spec.iterations:
            children = []
            for _ in range(population_size):
                a = max(rng.sample(population, 3), key=lambda p: p[0])
                b = max(rng.sample(population, 3), key=lambda p: p[0])
                cut = rng.randrange(1, self.spec.height) * self.spec.width
                rock = a[1][:cut] + b[1][cut:]
                start = a[2]
                if rock[start]:
                    rock[start] = False
                for _ in range(rng.randrange(1, 4)):
                    rock, start = self.mutate(rock, start)
                if self.evaluations >= self.spec.iterations:
                    break
                children.append((self.evaluate(rock, start)[0], rock, start))
            population = sorted(population + children, key=lambda p: -p[0])[:population_size]


def generate(spec: SearchSpec, seed: str) -> Generated:
    started = time.perf_counter()
    searcher = Searcher(spec, random.Random(seed))
    searcher.run()
    assert searcher.best is not None
    score, rock, start, goal, shortest = searcher.best
    board = to_board(spec.width, spec.height, rock)
    reach = explore(board, start)
    assert reach.dist[goal] == shortest, "fast BFS disagrees with explore()"
    normalized = without_irrelevant_rocks(reach)
    assert explore(normalized, start).dist[goal] == shortest
    return Generated(
        spec.width,
        spec.height,
        normalized.cells,
        start,
        goal,
        shortest,
        score,
        time.perf_counter() - started,
        searcher.trace,
        searcher.shortest_trace,
    )


def generate_task(task: tuple[SearchSpec, str]) -> Generated:
    return generate(*task)


def features_task(task: tuple[str, int, int, str, int, int]) -> tuple[str, Features]:
    label, width, height, cells, start, goal = task
    return label, features_of(Board(width, height, cells), start, goal)


def parallel(fn: Callable, tasks: list, workers: int) -> list:
    if workers <= 1:
        return [fn(task) for task in tasks]
    with ProcessPoolExecutor(max_workers=workers) as executor:
        return list(executor.map(fn, tasks, chunksize=1))


# ---------------------------------------------------------------------------
# 現行の問題集


def decode_pool_entry(seed: str, width: int, height: int) -> tuple[Board, int, int]:
    rocks_hex, start, goal = seed.split("-")
    bits = "".join(f"{int(digit, 16):04b}" for digit in rocks_hex)[: width * height]
    cells = "".join(ROCK if bit == "1" else ICE for bit in bits)
    return Board(width, height, cells), int(start), int(goal)


def load_pool() -> dict[int, list[tuple[Board, int, int]]]:
    data = json.loads(PROBLEM_POOL.read_text())
    return {
        int(level): [decode_pool_entry(seed, w, h) for seed, w, h, _ in entries]
        for level, entries in data["levels"].items()
    }


# ---------------------------------------------------------------------------
# 集計


def summary(values: Sequence[float]) -> str:
    if not values:
        return "-"
    return f"{statistics.median(values):g}/{percentile(values, 0.9):g}/{max(values):g}"


FEATURE_COLUMNS = (
    "shortest",
    "density",
    "reachable",
    "optimal_paths",
    "near_paths",
    "goal_preds",
    "goal_preds_global",
    "back_within2",
    "forward_depth",
    "backward_depth",
    "bidir_depth",
    "human_depth",
    "legacy_depth",
    "trial_moves",
    "forced_steps",
    "decisions",
    "trap_options",
    "dead_states",
    "pass_over",
    "fwd_bfs",
    "bwd_bfs",
    "bidir_bfs",
)


def print_feature_table(groups: dict[str, list[Features]]) -> None:
    """各特徴量の 中央値 / 90%点（human_depth などは UNREAD=13 が読めない）。"""
    labels = list(groups)
    print("feature | " + " | ".join(f"{label} (n={len(groups[label])})" for label in labels))
    for column in FEATURE_COLUMNS:
        cells = []
        for label in labels:
            values = [getattr(f, column) for f in groups[label]]
            if column == "density":
                cells.append(f"{statistics.median(values):.2f}")
            else:
                cells.append(f"{statistics.median(values):g} / {percentile(values, 0.9):g}")
        print(f"{column} | " + " | ".join(cells))
    for label in labels:
        fs = groups[label]
        unique = sum(f.optimal_paths == 1 for f in fs)
        unread = sum(f.human_depth == UNREAD for f in fs)
        depths = Counter(f.human_depth for f in fs)
        print(
            f"  {label}: 最短解一意 {unique}/{len(fs)}, human_depth読めない {unread}/{len(fs)}, "
            f"human_depth の分布 {dict(sorted(depths.items()))}"
        )


# ---------------------------------------------------------------------------
# suites


def parse_method(text: str) -> str:
    if text not in ("random", "hc", "sa", "ga"):
        raise argparse.ArgumentTypeError(text)
    return text


def run_methods(args: argparse.Namespace) -> None:
    """同じ評価回数で、ランダム（G1）・山登り（G3と同じ受理）・焼きなまし・遺伝的を比べる。"""
    for shape in args.sizes:
        tasks = []
        for method in args.methods:
            for run in range(args.runs):
                spec = SearchSpec(
                    shape.width,
                    shape.height,
                    method,
                    "length",
                    args.iterations,
                    temperature=args.temperature,
                )
                tasks.append((spec, f"{args.seed}-methods-{shape.label}-{method}-{run}"))
        results = parallel(generate_task, tasks, args.workers)
        print(f"## {shape.label} iterations={args.iterations} runs={args.runs}")
        for method in args.methods:
            rs = [r for (spec, _), r in zip(tasks, results, strict=True) if spec.method == method]
            ds = [r.shortest for r in rs]
            traces = " ".join(
                f"@{c}:{statistics.median(r.best_shortest_trace.get(c, 0) for r in rs):g}"
                for c in CHECKPOINTS
                if c <= args.iterations
            )
            print(
                f"  {method:6s} 最短手数 中央値/90%/最大={summary(ds)} "
                f"平均時間={statistics.mean(r.seconds for r in rs):.2f}s 途中経過(中央値) {traces}"
            )


def run_density(args: argparse.Namespace) -> None:
    """岩の密度を固定した場合と、範囲内で探索に任せた場合を比べる。"""
    settings = [(d, d, d) for d in args.densities] + [(0.20, 0.08, 0.40)]
    for shape in args.sizes:
        print(f"## {shape.label} method={args.method} iterations={args.iterations}")
        tasks = []
        for init, lo, hi in settings:
            for run in range(args.runs):
                spec = SearchSpec(
                    shape.width,
                    shape.height,
                    args.method,
                    "length",
                    args.iterations,
                    init_density=init,
                    min_density=lo,
                    max_density=hi,
                )
                tasks.append((spec, f"{args.seed}-density-{shape.label}-{lo}-{hi}-{run}"))
        results = parallel(generate_task, tasks, args.workers)
        for _, lo, hi in settings:
            rs = [
                r
                for (spec, _), r in zip(tasks, results, strict=True)
                if (spec.min_density, spec.max_density) == (lo, hi)
            ]
            final = [sum(c == ROCK for c in r.cells) / len(r.cells) for r in rs]
            label = f"固定{lo:.2f}" if lo == hi else f"範囲{lo:.2f}〜{hi:.2f}"
            print(
                f"  {label}: 最短手数={summary([r.shortest for r in rs])} "
                f"正規化後の密度 中央値={statistics.median(final):.2f}"
            )


def run_lengths(args: argparse.Namespace) -> None:
    """盤面ごとに、採用した方式で最短手数をどこまで伸ばせるかと、1問あたりの時間。"""
    for shape in args.sizes:
        tasks = [
            (
                SearchSpec(shape.width, shape.height, args.method, "length", args.iterations),
                f"{args.seed}-lengths-{shape.label}-{run}",
            )
            for run in range(args.runs)
        ]
        results = parallel(generate_task, tasks, args.workers)
        ds = [r.shortest for r in results]
        traces = " ".join(
            f"@{c}:{statistics.median(r.best_shortest_trace.get(c, 0) for r in results):g}"
            f"({percentile([r.best_shortest_trace.get(c, 0) for r in results], 0.9):g})"
            for c in CHECKPOINTS
            if c <= args.iterations
        )
        dens = [sum(c == ROCK for c in r.cells) / len(r.cells) for r in results]
        print(
            f"## {shape.label}: 最短手数 中央値/90%/最大={summary(ds)} "
            f"1問={statistics.mean(r.seconds for r in results):.2f}s "
            f"密度(正規化後)中央値={statistics.median(dens):.2f}"
        )
        print(f"  途中経過 評価回数:中央値(90%点) {traces}")


def pool_feature_tasks(levels: Sequence[int], per_level: int, seed: str) -> list[tuple]:
    pool = load_pool()
    tasks = []
    for level in levels:
        entries = pool[level]
        rng = random.Random(f"{seed}-pool-{level}")
        for board, start, goal in rng.sample(entries, min(per_level, len(entries))):
            tasks.append((f"現行L{level}", board.width, board.height, board.cells, start, goal))
    return tasks


def optimized_feature_tasks(
    shape: Shape, objective: str, runs: int, iterations: int, method: str, seed: str, workers: int
) -> list[tuple]:
    tasks = [
        (
            SearchSpec(shape.width, shape.height, method, objective, iterations),
            f"{seed}-{objective}-{shape.label}-{run}",
        )
        for run in range(runs)
    ]
    generated = parallel(generate_task, tasks, workers)
    label = f"{objective}:{shape.label}"
    return [(label, g.width, g.height, g.cells, g.start, g.goal) for g in generated]


def run_features(args: argparse.Namespace) -> None:
    """現行の問題集と、最短手数だけ／合成の目的関数で最適化した問題の特徴量を比べる。"""
    tasks = pool_feature_tasks((1, 2, 3, 4, 5), args.pool_samples, str(args.seed))
    for shape in args.sizes:
        for objective in ("length", "composite"):
            extra = optimized_feature_tasks(
                shape,
                objective,
                args.runs,
                args.iterations,
                args.method,
                str(args.seed),
                args.workers,
            )
            tasks.extend(extra)
    results = parallel(features_task, tasks, args.workers)
    groups: dict[str, list[Features]] = {}
    for label, features in results:
        groups.setdefault(label, []).append(features)
    print_feature_table(groups)
    everything = [f for fs in groups.values() for f in fs]
    print("## Spearman（全群をまとめて）")
    for column in (
        "human_depth",
        "forward_depth",
        "backward_depth",
        "bidir_depth",
        "trial_moves",
        "decisions",
        "forced_steps",
        "goal_preds_global",
        "bidir_bfs",
        "near_paths",
    ):
        xs = [f.shortest for f in everything]
        ys = [getattr(f, column) for f in everything]
        print(f"  spearman(shortest, {column})={spearman(xs, ys):.3f}")
    optimized = [f for label, fs in groups.items() if not label.startswith("現行") for f in fs]
    print("## 最適化した問題の中で")
    for column in (
        "human_depth",
        "forward_depth",
        "backward_depth",
        "bidir_depth",
        "trial_moves",
        "decisions",
        "forced_steps",
    ):
        xs = [f.shortest for f in optimized]
        ys = [getattr(f, column) for f in optimized]
        print(f"  spearman(shortest, {column})={spearman(xs, ys):.3f}")
    if args.dump:
        Path(args.dump).write_text(
            json.dumps([{"label": label, **asdict(f)} for label, f in results], ensure_ascii=False)
        )


def parse_range(text: str) -> tuple[int, int]:
    low, high = text.split("-")
    return int(low), int(high)


def range_task(task: tuple[SearchSpec, str]) -> tuple[SearchSpec, Generated, Features]:
    spec, seed = task
    generated = generate(spec, seed)
    return spec, generated, features_of(generated.board, generated.start, generated.goal)


def run_objectives(args: argparse.Namespace) -> None:
    """最短手数の範囲を決めたうえで、長さだけ（範囲の上限まで伸ばす）と合成の目的関数を比べる。"""
    tasks = []
    for shape in args.sizes:
        for low, high in args.ranges:
            for objective in ("length", "composite"):
                for run in range(args.runs):
                    spec = SearchSpec(
                        shape.width,
                        shape.height,
                        args.method,
                        objective,
                        args.iterations,
                        min_shortest=low,
                        max_shortest=high,
                    )
                    tasks.append(
                        (
                            spec,
                            f"{args.seed}-objectives-{shape.label}-{low}-{high}-{objective}-{run}",
                        )
                    )
    results = parallel(range_task, tasks, args.workers)
    groups: dict[str, list[Features]] = {}
    seconds: dict[str, list[float]] = {}
    for spec, generated, features in results:
        label = (
            f"{spec.objective}:{spec.width}x{spec.height}:{spec.min_shortest}-{spec.max_shortest}"
        )
        groups.setdefault(label, []).append(features)
        seconds.setdefault(label, []).append(generated.seconds)
    print_feature_table(groups)
    for label, values in seconds.items():
        print(f"  {label}: 生成 平均 {statistics.mean(values):.2f}s")
    if args.dump:
        Path(args.dump).write_text(
            json.dumps(
                [
                    {
                        "label": f"{spec.objective}:{spec.width}x{spec.height}:{spec.min_shortest}-{spec.max_shortest}",
                        "cells": g.cells,
                        "width": g.width,
                        "height": g.height,
                        "start": g.start,
                        "goal": g.goal,
                        **asdict(f),
                    }
                    for spec, g, f in results
                ],
                ensure_ascii=False,
            )
        )


@dataclass(frozen=True)
class LevelPlan:
    level: int
    shape: Shape
    min_shortest: int
    max_shortest: int
    min_human_depth: int
    max_human_depth: int
    objective: str = "composite"
    iterations: int = 2000
    max_forced_share: float = 0.25  # 最短の道筋のうち、選択肢が1つしかない手の割合の上限
    max_optimal_paths: int = 1
    goals_per_board: int = 4  # 条件に合わなければ、同じ盤面で範囲内の別のゴールも試す数

    @property
    def label(self) -> str:
        return (
            f"L{self.level} {self.shape.label} 最少{self.min_shortest}〜{self.max_shortest} "
            f"読み{self.min_human_depth}〜{self.max_human_depth}"
        )


LEVEL_PLANS: tuple[LevelPlan, ...] = (
    LevelPlan(1, Shape(8, 8), 6, 9, 1, 2),
    LevelPlan(2, Shape(10, 10), 9, 13, 2, 3),
    LevelPlan(3, Shape(10, 13), 13, 18, 3, 5),
    LevelPlan(4, Shape(12, 12), 17, 23, 5, 7),
    LevelPlan(5, Shape(12, 14), 22, 30, 8, MAX_READ),
)


def rejections(plan: LevelPlan, features: Features) -> list[str]:
    reasons = []
    if not plan.min_shortest <= features.shortest <= plan.max_shortest:
        reasons.append("最少手数")
    if not plan.min_human_depth <= features.human_depth <= plan.max_human_depth:
        reasons.append("読み深さ" + ("（読めない）" if features.human_depth == UNREAD else ""))
    if features.forced_steps > plan.max_forced_share * features.shortest:
        reasons.append("一本道")
    if features.optimal_paths > plan.max_optimal_paths:
        reasons.append("最短解が複数")
    return reasons


@dataclass
class LevelResult:
    level: int
    generated: Generated
    features: Features
    accepted: bool
    reasons: list[str]
    goals_tried: int


def level_task(task: tuple[LevelPlan, str, int]) -> LevelResult:
    """1回の最適化で1問を作る。最少手数の上限は試行ごとに範囲内で回し、範囲内の長さを散らす。"""
    plan, seed, run = task
    cap = plan.min_shortest + run % (plan.max_shortest - plan.min_shortest + 1)
    spec = SearchSpec(
        plan.shape.width,
        plan.shape.height,
        "hc",
        plan.objective,
        plan.iterations,
        min_shortest=plan.min_shortest,
        max_shortest=cap,
    )
    generated = generate(spec, seed)
    started = time.perf_counter()
    board = generated.board
    reach = explore(board, generated.start)
    goals = [generated.goal] + sorted(
        (
            g
            for g, d in reach.dist.items()
            if g != generated.goal
            and g != generated.start
            and plan.min_shortest <= d <= plan.max_shortest
        ),
        key=lambda g: (-reach.dist[g], g),
    )
    tried = 0
    first: tuple[int, Features, list[str]] | None = None
    chosen: tuple[int, Features, list[str]] | None = None
    for goal in goals[: plan.goals_per_board]:
        tried += 1
        features = features_of(board, generated.start, goal)
        reasons = rejections(plan, features)
        if first is None:
            first = (goal, features, reasons)
        if not reasons:
            chosen = (goal, features, reasons)
            break
    generated.seconds += time.perf_counter() - started
    goal, features, reasons = chosen or first  # type: ignore[misc]
    if goal != generated.goal:
        generated.goal = goal
        generated.shortest = features.shortest
        normalized = without_irrelevant_rocks(explore(board, generated.start))
        generated.cells = normalized.cells
    return LevelResult(plan.level, generated, features, not reasons, reasons, tried)


def plans_for(args: argparse.Namespace) -> list[LevelPlan]:
    plans = [plan for plan in LEVEL_PLANS if plan.level in args.levels]
    if args.objective:
        plans = [LevelPlan(**{**asdict_plan(plan), "objective": args.objective}) for plan in plans]
    if args.plan_iterations:
        plans = [
            LevelPlan(**{**asdict_plan(plan), "iterations": args.plan_iterations}) for plan in plans
        ]
    return plans


def asdict_plan(plan: LevelPlan) -> dict:
    return {name: getattr(plan, name) for name in plan.__dataclass_fields__}


def run_levels(args: argparse.Namespace) -> None:
    """新しい5段階の案ごとに、条件に合う問題が得られる割合と1問あたりの時間。"""
    plans = plans_for(args)
    tasks = [
        (plan, f"{args.seed}-levels-{plan.level}-{run}", run)
        for plan in plans
        for run in range(args.runs)
    ]
    results: list[LevelResult] = parallel(level_task, tasks, args.workers)
    for plan in plans:
        rs = [r for r in results if r.level == plan.level]
        ok = [r for r in rs if r.accepted]
        seconds = [r.generated.seconds for r in rs]
        keys = {canonical_key(r.generated.board, r.generated.start, r.generated.goal) for r in ok}
        rate = len(ok) / len(rs)
        per_problem = statistics.mean(seconds) / rate if rate else float("inf")
        print(
            f"## {plan.label} {plan.objective}: 採用 {len(ok)}/{len(rs)}（同型除き {len(keys)}） "
            f"1回 平均{statistics.mean(seconds):.2f}s（90%点 {percentile(seconds, 0.9):.2f}s） "
            f"→ 1問 {per_problem:.2f}s、試したゴール 平均{statistics.mean(r.goals_tried for r in rs):.1f}"
        )
        fs = [r.features for r in ok] or [r.features for r in rs]
        for column in (
            "shortest",
            "human_depth",
            "forward_depth",
            "backward_depth",
            "bidir_depth",
            "legacy_depth",
            "trial_moves",
            "decisions",
            "forced_steps",
            "near_paths",
            "goal_preds_global",
            "reachable",
            "dead_states",
            "pass_over",
            "density",
        ):
            print(f"  {column}: {summary([getattr(f, column) for f in fs])}")
        print(f"  外れた理由: {dict(Counter(reason for r in rs for reason in r.reasons))}")
        if args.dump:
            with open(args.dump, "a") as out:
                for r in rs:
                    out.write(
                        json.dumps(
                            {
                                "plan": plan.label,
                                "objective": plan.objective,
                                "accepted": r.accepted,
                                "seconds": r.generated.seconds,
                                **asdict(r.features),
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )


def rows_of(board: Board) -> list[str]:
    return [board.cells[y * board.width : (y + 1) * board.width] for y in range(board.height)]


def run_candidates(args: argparse.Namespace) -> None:
    """各レベル案で条件に合った問題を（最少手数, 読み深さ）で並べ、25%・50%・75%点の3問を JSON に書く。"""
    plans = plans_for(args)
    tasks = [
        (plan, f"{args.seed}-candidates-{plan.level}-{run}", run)
        for plan in plans
        for run in range(args.runs)
    ]
    results: list[LevelResult] = parallel(level_task, tasks, args.workers)
    output = []
    for plan in plans:
        seen: set[tuple[str, int, int]] = set()
        ok: list[LevelResult] = []
        for r in results:
            key = canonical_key(r.generated.board, r.generated.start, r.generated.goal)
            if r.level == plan.level and r.accepted and key not in seen:
                seen.add(key)
                ok.append(r)
        if len(ok) < 3:
            print(f"{plan.label}: 条件に合う問題が {len(ok)} 問しかない")
            continue
        ok.sort(key=lambda r: (r.features.shortest, r.features.human_depth, r.features.trial_moves))
        for quantile in (0.25, 0.5, 0.75):
            r = ok[int(quantile * (len(ok) - 1))]
            g, f = r.generated, r.features
            board = g.board
            assert explore(board, g.start).dist[g.goal] == f.shortest
            assert features_of(board, g.start, g.goal) == f
            output.append(
                {
                    "level": plan.level,
                    "width": g.width,
                    "height": g.height,
                    "rows": rows_of(board),
                    "start": [g.start % g.width, g.start // g.width],
                    "goal": [g.goal % g.width, g.goal // g.width],
                    "optimal": f.shortest,
                    "features": asdict(f),
                }
            )
            print(
                f"L{plan.level} {g.width}x{g.height} 最少{f.shortest} 読み{f.human_depth}"
                f"（前{f.forward_depth}/逆{f.backward_depth}/両{f.bidir_depth}） 試行{f.trial_moves} "
                f"一本道{f.forced_steps} 現行の計画深さ{f.legacy_depth}"
            )
            for line in render_marked(board, g.start, g.goal):
                print("    " + line)
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(output)} problems to {args.output}")


def render_marked(board: Board, start: int, goal: int) -> list[str]:
    rows = [list(row) for row in rows_of(board)]
    rows[start // board.width][start % board.width] = "S"
    rows[goal // board.width][goal % board.width] = "G"
    return ["".join(row) for row in rows]


def run_verify(args: argparse.Namespace) -> None:
    """速いBFSと人のモデルの前向きの読みが、供給実験の explore と難易度PoCの analyze に一致するか。"""
    rng = random.Random(f"{args.seed}-verify")
    mismatches = checked = 0
    for _ in range(args.samples):
        shape = args.sizes[rng.randrange(len(args.sizes))]
        board = random_board(shape.width, shape.height, rng, 0.20)
        ice = [c for c, t in enumerate(board.cells) if t == ICE]
        start = ice[rng.randrange(len(ice))]
        reach = explore(board, start)
        fast = forward_dist(stop_tables(board.width, board.height, board_rocks(board)), start)
        if fast != reach.dist:
            mismatches += 1
        goals = [g for g in reach.dist if g != start and reach.dist[g] >= 3]
        if not goals:
            continue
        goal = goals[rng.randrange(len(goals))]
        features = features_of(board, start, goal, legacy_give_up)
        legacy = plan_depth(analyze(reach, goal))
        expected = legacy if legacy <= MAX_LOOKAHEAD else None
        got = features.forward_depth if features.forward_depth <= MAX_LOOKAHEAD else None
        checked += 1
        if expected != got or features.legacy_depth != legacy:
            mismatches += 1
    print(f"checked={checked} mismatches={mismatches}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "suite",
        choices=(
            "verify",
            "methods",
            "density",
            "lengths",
            "features",
            "objectives",
            "levels",
            "candidates",
        ),
    )
    parser.add_argument(
        "--ranges", type=parse_range, nargs="+", default=[(8, 12), (14, 18), (20, 26)]
    )
    parser.add_argument(
        "--sizes",
        type=parse_shape,
        nargs="+",
        default=[Shape(8, 8), Shape(10, 10), Shape(10, 13), Shape(12, 12), Shape(12, 14)],
    )
    parser.add_argument(
        "--methods", type=parse_method, nargs="+", default=["random", "hc", "sa", "ga"]
    )
    parser.add_argument("--method", type=parse_method, default="hc")
    parser.add_argument(
        "--objective",
        choices=("length", "composite"),
        default="",
        help="levels / candidates で、各レベル案の目的関数を置き換える",
    )
    parser.add_argument(
        "--plan-iterations",
        type=int,
        default=0,
        help="levels / candidates で、各レベル案の評価回数を置き換える",
    )
    parser.add_argument(
        "--densities", type=float, nargs="+", default=[0.12, 0.16, 0.20, 0.25, 0.30]
    )
    parser.add_argument("--levels", type=int, nargs="+", default=[1, 2, 3, 4, 5])
    parser.add_argument("--iterations", type=int, default=4000)
    parser.add_argument("--temperature", type=float, default=1.5, help="sa の初期温度")
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--samples", type=int, default=300)
    parser.add_argument("--pool-samples", type=int, default=500)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--dump", default="")
    parser.add_argument("--output", default="/tmp/hard-candidates.json")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    suites: dict[str, Callable[[argparse.Namespace], None]] = {
        "verify": run_verify,
        "methods": run_methods,
        "density": run_density,
        "lengths": run_lengths,
        "features": run_features,
        "objectives": run_objectives,
        "levels": run_levels,
        "candidates": run_candidates,
    }
    suites[args.suite](args)


if __name__ == "__main__":
    main()
