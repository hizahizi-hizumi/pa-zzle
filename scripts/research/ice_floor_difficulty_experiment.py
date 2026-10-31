"""氷の床迷路（作業名）の難易度PoC。

問題成立性（到達可能性・最短手数）は ice_floor_supply_experiment の BFS で確かめ、
難易度の特徴量は人間の解き方を模した素朴なプレイヤーモデルから別に求める。
Python標準ライブラリだけを使う。
"""

from __future__ import annotations

import argparse
import random
import statistics
import sys
import time
from collections import Counter, deque
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_supply_experiment import (  # noqa: E402
    BEST_DENSITY,
    DIR_NAMES,
    ROCK,
    STOP,
    VARIANT_DENSITY,
    VARIANTS,
    Board,
    Reach,
    canonical_key,
    coreachable,
    count_shortest_paths,
    explore,
    goal_candidates,
    local_search,
    percentile,
    random_board_candidates,
    render,
)

MAX_LOOKAHEAD = 6
UNSOLVED = MAX_LOOKAHEAD + 1
# 評価不能（計画深さ7以上）の中身を調べるときだけ、読み手数をここまで伸ばす
EXTENDED_LOOKAHEAD = 10
MAX_PROVIDED_SHORTEST = 14
# 方向番号 (上, 右, 下, 左) ごとの同点時の優先順位
DEFAULT_TIE_ORDER = (0, 1, 2, 3)
TIE_ORDERS = ((0, 1, 2, 3), (3, 2, 1, 0), (1, 3, 0, 2), (2, 0, 3, 1))

Heuristic = Callable[[int], tuple[int, ...]]


@dataclass(frozen=True)
class Shape:
    """盤面の大きさ。width は列数、height は行数。縦長の盤面は height > width。"""

    width: int
    height: int

    @property
    def label(self) -> str:
        return f"{self.width}x{self.height}"

    @property
    def seed_label(self) -> str:
        # 正方形は一辺だけを seed に使う。正方形だけを扱っていたときの結果を変えないため。
        return str(self.width) if self.width == self.height else self.label

    @property
    def density(self) -> float:
        return BEST_DENSITY.get(self.width, 0.20) if self.width == self.height else 0.20


def parse_shape(text: str) -> Shape:
    """`8` は8x8、`9x12` は幅9・高さ12。"""
    parts = text.lower().split("x")
    if len(parts) == 1:
        size = int(parts[0])
        return Shape(size, size)
    if len(parts) == 2:
        return Shape(int(parts[0]), int(parts[1]))
    raise argparse.ArgumentTypeError(f"invalid shape: {text}")


@dataclass(frozen=True)
class Features:
    shortest: int
    shortest_paths: int
    reachable: int
    lookahead: int  # 先読み貪欲プレイヤーが解ける最小の読み手数。解けなければ UNSOLVED
    align_lookahead: int  # 「ゴールの行・列に揃える」方針での同じ値
    greedy_solves: bool  # 1手読みで最も近づく手を選ぶだけで解けるか
    search_moves: int  # Undo を使う貪欲な試行錯誤で、ゴールに着くまでに実際に動かす手数
    detour: int  # 最短手順のうち、ゴールからのマンハッタン距離を縮めない手の最小数
    pass_over: int  # ゴールを通過してしまう移動を持つ停止点の数
    dead_states: int
    goal_reach_dirs: int  # ゴールに止まれる進入方向の数


@dataclass(frozen=True)
class Rated:
    board: Board
    start: int
    goal: int
    features: Features
    level: int  # 0 は提供範囲外、-1 は評価不能


def manhattan(board: Board, a: int, b: int) -> int:
    w = board.width
    return abs(a % w - b % w) + abs(a // w - b // w)


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


def manhattan_heuristic(board: Board, goal: int) -> Heuristic:
    return lambda state: (manhattan(board, state, goal),)


def align_heuristic(board: Board, goal: int) -> Heuristic:
    """ゴールの行・列に揃い、間に岩がない位置を優先し、次に近さを見る。"""
    return lambda state: (
        0 if line_of_sight(board, state, goal) else 1,
        manhattan(board, state, goal),
    )


def within(reach: Reach, origin: int, depth: int) -> dict[int, int]:
    seen = {origin: 0}
    queue = deque([origin])
    while queue:
        state = queue.popleft()
        if seen[state] == depth:
            continue
        for _, end in reach.succ[state]:
            if end not in seen:
                seen[end] = seen[state] + 1
                queue.append(end)
    return seen


def lookahead_player(
    reach: Reach,
    goal: int,
    depth: int,
    heuristic: Heuristic,
    limit: int,
    tie_order: Sequence[int] = DEFAULT_TIE_ORDER,
) -> int | None:
    """depth 手先までを読み、ゴールが見えればそこへ行く。見えなければ、読める範囲で最もよい
    停止点へ向かう手を選ぶ。一度止まった点へは戻らない。Undo は使わない。解けた手数を返す。"""
    state = reach.start
    visited = {state}
    moves = 0
    while moves < limit:
        horizon = within(reach, state, depth)
        if goal in horizon:
            return moves + horizon[goal]
        best: tuple[tuple[int, ...], tuple[int, ...], int] | None = None
        best_end = -1
        for direction, end in reach.succ[state]:
            if end in visited:
                continue
            frontier = within(reach, end, depth - 1)
            score = min(heuristic(s) for s in frontier)
            key = (score, heuristic(end), tie_order[direction])
            if best is None or key < best:
                best, best_end = key, end
        if best is None:
            return None
        state = best_end
        visited.add(state)
        moves += 1
    return None


def required_lookahead(
    reach: Reach,
    goal: int,
    heuristic: Heuristic,
    limit: int,
    tie_order: Sequence[int] = DEFAULT_TIE_ORDER,
    max_lookahead: int = MAX_LOOKAHEAD,
) -> int:
    """max_lookahead 手読んでも解けなければ max_lookahead + 1 を返す。"""
    for depth in range(1, max_lookahead + 1):
        if lookahead_player(reach, goal, depth, heuristic, limit, tie_order) is not None:
            return depth
    return max_lookahead + 1


def undo_search_moves(
    reach: Reach,
    goal: int,
    heuristic: Heuristic,
    tie_order: Sequence[int] = DEFAULT_TIE_ORDER,
) -> int:
    """1手読みで近づく順に試し、行き止まり（未訪問の行き先がない）なら Undo で戻る深さ優先探索。
    Undo で戻る操作も1手として数える。"""
    visited = {reach.start}
    stack = [reach.start]
    moves = 0
    while stack:
        state = stack[-1]
        if state == goal:
            return moves
        options = sorted(
            (heuristic(end), tie_order[direction], end)
            for direction, end in reach.succ[state]
            if end not in visited
        )
        if options:
            _, _, end = options[0]
            visited.add(end)
            stack.append(end)
        else:
            stack.pop()
        moves += 1
    return moves


def min_detour(reach: Reach, goal: int) -> int:
    board = reach.board
    order = sorted(reach.dist, key=lambda state: reach.dist[state])
    best = {reach.start: 0}
    for state in order:
        if state not in best:
            continue
        for _, end in reach.succ[state]:
            if reach.dist[end] != reach.dist[state] + 1:
                continue
            away = manhattan(board, end, goal) >= manhattan(board, state, goal)
            value = best[state] + int(away)
            if value < best.get(end, 1 << 30):
                best[end] = value
    return best[goal]


def analyze(
    reach: Reach,
    goal: int,
    tie_orders: Sequence[Sequence[int]] = TIE_ORDERS,
    max_lookahead: int = MAX_LOOKAHEAD,
) -> Features:
    """同点の手をどちらから試すかで結果が揺れないよう、読み手数は全優先順位での最小値、
    試行手数は中央値を使う。"""
    board = reach.board
    shortest = reach.dist[goal]
    limit = 4 * shortest + 8
    manhattan_h = manhattan_heuristic(board, goal)
    align_h = align_heuristic(board, goal)
    pass_over = set()
    reach_dirs = set()
    for (state, direction), result in reach.slides.items():
        stops_on_goal = result.outcome == STOP and result.end == goal
        if stops_on_goal:
            reach_dirs.add(direction)
        elif goal in result.path:
            pass_over.add(state)
    alive = coreachable(reach, goal)
    return Features(
        shortest=shortest,
        shortest_paths=count_shortest_paths(reach, goal),
        reachable=len(reach.dist),
        lookahead=min(
            required_lookahead(reach, goal, manhattan_h, limit, order, max_lookahead)
            for order in tie_orders
        ),
        align_lookahead=min(
            required_lookahead(reach, goal, align_h, limit, order, max_lookahead)
            for order in tie_orders
        ),
        greedy_solves=any(
            lookahead_player(reach, goal, 1, manhattan_h, limit, order) is not None
            for order in tie_orders
        ),
        search_moves=int(
            statistics.median(
                undo_search_moves(reach, goal, manhattan_h, order) for order in tie_orders
            )
        ),
        detour=min_detour(reach, goal),
        pass_over=len(pass_over),
        dead_states=sum(1 for state in reach.dist if state not in alive),
        goal_reach_dirs=len(reach_dirs),
    )


def plan_depth(features: Features) -> int:
    """素朴な2方針のうち、少ない読みで解ける方を人間の計画深さの代理値にする。"""
    return min(features.lookahead, features.align_lookahead)


def classify(features: Features) -> int:
    """仮の5段階。主軸は計画深さ、補助に最短手数を使う。
    0 は提供範囲外（自明・長すぎ）、-1 は評価不能（素朴モデルが6手読みでも解けない）。"""
    d = features.shortest
    depth = plan_depth(features)
    if d <= 2 or d > MAX_PROVIDED_SHORTEST:
        return 0
    if depth > MAX_LOOKAHEAD:
        return -1
    if depth == 1:
        return 1 if d <= 4 else 2
    if depth == 2:
        return 2
    if depth == 3:
        return 3
    if depth == 4:
        return 4
    return 5


def spearman(xs: Sequence[float], ys: Sequence[float]) -> float:
    def ranks(values: Sequence[float]) -> list[float]:
        order = sorted(range(len(values)), key=lambda i: values[i])
        result = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            rank = (i + j) / 2
            for k in range(i, j + 1):
                result[order[k]] = rank
            i = j + 1
        return result

    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry, strict=True))
    vx = sum((a - mx) ** 2 for a in rx)
    vy = sum((b - my) ** 2 for b in ry)
    return cov / (vx * vy) ** 0.5 if vx and vy else float("nan")


def pool(
    shape: Shape,
    count: int,
    rng: random.Random,
    min_shortest: int,
    max_lookahead: int = MAX_LOOKAHEAD,
) -> list[Rated]:
    """G1で1盤面1問、ゴールを最短 min_shortest 手以上の停止点から一様に選ぶ。"""
    rated: list[Rated] = []
    while len(rated) < count:
        generated = random_board_candidates(shape.width, shape.height, rng, shape.density)
        assert generated is not None
        board, start, reach = generated
        candidates = [g for g in goal_candidates(reach) if reach.dist[g] >= min_shortest]
        if not candidates:
            continue
        goal = candidates[rng.randrange(len(candidates))]
        features = analyze(reach, goal, max_lookahead=max_lookahead)
        rated.append(Rated(board, start, goal, features, classify(features)))
    return rated


def run_features(args: argparse.Namespace) -> None:
    """特徴量の分布と、最短手数と先読み深さ・試行量が別の量かを確かめる。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-features-{shape.seed_label}")
        started = time.perf_counter()
        rated = pool(shape, args.samples, rng, 3)
        elapsed = time.perf_counter() - started
        fs = [r.features for r in rated]
        d = [f.shortest for f in fs]
        depth = [plan_depth(f) for f in fs]
        search = [f.search_moves for f in fs]
        print(f"## {shape.label} n={len(fs)} analyze_per_puzzle={elapsed / len(fs) * 1000:.2f}ms")
        print(
            f"  spearman(d, plan_depth)={spearman(d, depth):.3f} "
            f"spearman(d, search_moves)={spearman(d, search):.3f} "
            f"spearman(d, detour)={spearman(d, [f.detour for f in fs]):.3f} "
            f"spearman(plan_depth, search_moves)={spearman(depth, search):.3f}"
        )
        print(
            f"  greedy(1手読み)で解ける={100 * sum(f.greedy_solves for f in fs) / len(fs):.1f}% "
            f"manhattan_vs_align_differs="
            f"{100 * sum(f.lookahead != f.align_lookahead for f in fs) / len(fs):.1f}%"
        )
        table: dict[int, Counter[int]] = {}
        for f in fs:
            table.setdefault(f.shortest, Counter())[plan_depth(f)] += 1
        header = " ".join(f"k={k}" for k in range(1, MAX_LOOKAHEAD + 1)) + " unsolved"
        print(f"  d \\ plan_depth: {header}")
        for shortest in sorted(table):
            row = table[shortest]
            cells = " ".join(f"{row[k]:4d}" for k in range(1, UNSOLVED + 1))
            print(f"  d={shortest:2d} n={sum(row.values()):4d}: {cells}")
        by_d: dict[int, list[int]] = {}
        for f in fs:
            by_d.setdefault(f.shortest, []).append(f.search_moves)
        print(
            "  search_moves by d (median/p90): "
            + " ".join(
                f"d{k}={statistics.median(v):.0f}/{percentile(v, 0.9):.0f}"
                for k, v in sorted(by_d.items())
                if len(v) >= 5
            )
        )


def run_levels(args: argparse.Namespace) -> None:
    """1盤面1問の一様抽出での仮レベル分布と、レベル内の特徴量の範囲。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-levels-{shape.seed_label}")
        rated = pool(shape, args.samples, rng, 3)
        counts = Counter(r.level for r in rated)
        n = len(rated)
        print(f"## {shape.label} n={n}")
        for level in (0, -1, 1, 2, 3, 4, 5):
            group = [r.features for r in rated if r.level == level]
            if not group:
                print(f"  level {level}: 0")
                continue
            print(
                f"  level {level}: {counts[level]} ({100 * counts[level] / n:.1f}%) "
                f"d={statistics.median(f.shortest for f in group):.0f}"
                f"[{min(f.shortest for f in group)}-{max(f.shortest for f in group)}] "
                f"depth_median={statistics.median(plan_depth(f) for f in group):.0f} "
                f"search_median={statistics.median(f.search_moves for f in group):.0f} "
                f"detour_median={statistics.median(f.detour for f in group):.0f} "
                f"unique={100 * sum(f.shortest_paths == 1 for f in group) / len(group):.0f}% "
                f"dead_any={100 * sum(f.dead_states > 0 for f in group) / len(group):.0f}% "
                f"pass_over_any={100 * sum(f.pass_over > 0 for f in group) / len(group):.0f}%"
            )


def run_supply(args: argparse.Namespace) -> None:
    """各盤面のゴール候補をすべて分析し、目的レベルの問題を1問得るのに要する盤面数と時間。
    1盤面から各レベル1問までを採り、同型（回転・反転）の重複も数える。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-supply-{shape.seed_label}")
        boards_with = Counter[int]()
        keys: dict[int, set[tuple[str, int, int]]] = {}
        duplicates = Counter[int]()
        started = time.perf_counter()
        for _ in range(args.samples):
            generated = random_board_candidates(shape.width, shape.height, rng, shape.density)
            assert generated is not None
            board, start, reach = generated
            first_goal: dict[int, int] = {}
            for goal in goal_candidates(reach):
                first_goal.setdefault(classify(analyze(reach, goal)), goal)
            for level, goal in first_goal.items():
                boards_with[level] += 1
                key = canonical_key(board, start, goal)
                seen = keys.setdefault(level, set())
                if key in seen:
                    duplicates[level] += 1
                seen.add(key)
        elapsed = time.perf_counter() - started
        per_board = elapsed / args.samples
        print(f"## {shape.label} boards={args.samples} per_board={per_board * 1000:.1f}ms")
        for level in (1, 2, 3, 4, 5, -1):
            hit = boards_with[level]
            rate = hit / args.samples
            cost = per_board / rate if rate else float("inf")
            print(
                f"  level {level}: boards_with_level={hit} ({100 * rate:.1f}%) "
                f"time_per_puzzle={cost * 1000:.1f}ms symmetry_dup={duplicates[level]}"
            )


def run_local_supply(args: argparse.Namespace) -> None:
    """G3（最長の最短手数を伸ばす局所探索）で、高レベルの問題が得やすくなるか。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-local-{shape.seed_label}")
        hits = Counter[int]()
        too_long = 0
        started = time.perf_counter()
        for _ in range(args.samples):
            _, _, reach = local_search(
                shape.width, shape.height, rng, shape.density, args.iterations
            )
            features = [analyze(reach, g) for g in goal_candidates(reach)]
            for level in {classify(f) for f in features}:
                hits[level] += 1
            too_long += any(f.shortest > MAX_PROVIDED_SHORTEST for f in features)
        elapsed = time.perf_counter() - started
        print(
            f"## {shape.label} G3 runs={args.samples} "
            f"per_run={elapsed / args.samples * 1000:.0f}ms "
            + " ".join(f"L{level}={hits[level]}" for level in (1, 2, 3, 4, 5, -1))
            + f" longer_than_{MAX_PROVIDED_SHORTEST}={too_long}"
        )


def run_variants(args: argparse.Namespace) -> None:
    """床の種類ごとに、1盤面1問の一様抽出での仮レベル分布を比べる。"""
    shape = args.sizes[0]
    for variant in VARIANTS:
        rng = random.Random(f"{args.seed}-variants-{variant}-{shape.seed_label}")
        counts = Counter[int]()
        n = 0
        boards = 0
        while n < args.samples:
            boards += 1
            generated = random_board_candidates(
                shape.width, shape.height, rng, VARIANT_DENSITY[variant], variant, args.extra
            )
            if generated is None:
                continue
            _, _, reach = generated
            candidates = [g for g in goal_candidates(reach) if reach.dist[g] >= 3]
            if not candidates:
                continue
            goal = candidates[rng.randrange(len(candidates))]
            counts[classify(analyze(reach, goal))] += 1
            n += 1
        print(
            f"{variant} ({VARIANTS[variant]}) {shape.label} n={n} boards={boards} "
            + " ".join(
                f"L{level}={100 * counts[level] / n:.1f}%" for level in (1, 2, 3, 4, 5, -1, 0)
            )
        )


def run_robustness(args: argparse.Namespace) -> None:
    """同点時の方向優先順位を1つに固定した場合に、全優先順位を使う判定からどれだけずれるか。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-robust-{shape.seed_label}")
        rated = pool(shape, args.samples, rng, 3)
        same = 0
        spread = Counter[int]()
        for item in rated:
            reach = explore(item.board, item.start)
            levels = [classify(analyze(reach, item.goal, (order,))) for order in TIE_ORDERS]
            provided = [level for level in levels if level >= 1]
            if all(level == item.level for level in levels):
                same += 1
            if len(provided) == len(levels):
                spread[max(provided) - min(provided)] += 1
            else:
                spread[-1] += 1
        n = len(rated)
        print(
            f"{shape.label} n={n} single_orders_match_combined={100 * same / n:.1f}% "
            f"spread0={spread[0]} spread1={spread[1]} "
            f"spread2+={sum(v for k, v in spread.items() if k >= 2)} "
            f"involves_unsolved_or_out={spread[-1]}"
        )


def shortest_solution(reach: Reach, goal: int) -> list[str]:
    parent: dict[int, tuple[int, int]] = {}
    order = sorted(reach.dist, key=lambda state: (reach.dist[state], state))
    for state in order:
        for direction, end in reach.succ[state]:
            if reach.dist[end] == reach.dist[state] + 1 and end not in parent:
                parent[end] = (state, direction)
    moves: list[str] = []
    state = goal
    while state != reach.start:
        state, direction = parent[state]
        moves.append(DIR_NAMES[direction])
    return moves[::-1]


def describe(rated: Rated) -> str:
    f = rated.features
    solution = shortest_solution(explore(rated.board, rated.start), rated.goal)
    return (
        f"level={rated.level} d={f.shortest} plan_depth={plan_depth(f)} "
        f"(manhattan={f.lookahead}, align={f.align_lookahead}) search_moves={f.search_moves} "
        f"detour={f.detour} paths={f.shortest_paths} reachable={f.reachable} "
        f"dead={f.dead_states} pass_over={f.pass_over} goal_dirs={f.goal_reach_dirs} "
        f"solution={''.join(solution)}"
    )


def run_examples(args: argparse.Namespace) -> None:
    """各レベルの代表問題を固定 seed から取り出す。"""
    shape = args.sizes[0]
    rng = random.Random(f"{args.seed}-examples-{shape.seed_label}")
    rated = pool(shape, args.samples, rng, 3)
    for level in (1, 2, 3, 4, 5, -1, 0):
        group = [r for r in rated if r.level == level]
        if not group:
            continue
        group.sort(
            key=lambda r: (r.features.shortest, plan_depth(r.features), r.features.search_moves)
        )
        chosen = group[len(group) // 2]
        print(describe(chosen))
        for row in render(chosen.board, chosen.start, chosen.goal):
            print("  " + row)


def run_contrast(args: argparse.Namespace) -> None:
    """同じ最短手数で、計画深さが異なる問題の組を示す。"""
    shape = args.sizes[0]
    rng = random.Random(f"{args.seed}-contrast-{shape.seed_label}")
    rated = pool(shape, args.samples, rng, 3)
    target = args.contrast_d
    group = [r for r in rated if r.features.shortest == target]
    if not group:
        print("no puzzle")
        return
    group.sort(key=lambda r: (plan_depth(r.features), r.features.search_moves))
    for chosen in (group[0], group[-1]):
        print(describe(chosen))
        for row in render(chosen.board, chosen.start, chosen.goal):
            print("  " + row)


def pct(part: float, whole: float) -> str:
    return f"{100 * part / whole:.1f}%" if whole else "-"


def run_shapes(args: argparse.Namespace) -> None:
    """盤面の大きさ・形ごとに、計画深さ・最短手数・試行手数の分布と仮レベルを比べる。
    正方形は levels と同じ乱数を使うので、仮レベルの分布は levels と一致する。
    評価不能の中身を見るため読み手数を EXTENDED_LOOKAHEAD まで伸ばすが、分類は変えない。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-levels-{shape.seed_label}")
        started = time.perf_counter()
        rated = pool(shape, args.samples, rng, 3, EXTENDED_LOOKAHEAD)
        elapsed = time.perf_counter() - started
        fs = [r.features for r in rated]
        n = len(fs)
        depth = [plan_depth(f) for f in fs]
        shortest = [f.shortest for f in fs]
        print(
            f"## {shape.label} n={n} analyze_per_puzzle={elapsed / n * 1000:.2f}ms "
            f"reachable_median={statistics.median(f.reachable for f in fs):.0f}"
        )
        histogram = Counter(depth)
        print(
            "  plan_depth: "
            + " ".join(f"{k}={pct(histogram[k], n)}" for k in range(1, EXTENDED_LOOKAHEAD + 1))
            + f" >{EXTENDED_LOOKAHEAD}={pct(histogram[EXTENDED_LOOKAHEAD + 1], n)}"
        )
        print(
            f"  plan_depth>=3={pct(sum(k >= 3 for k in depth), n)} "
            f">=5={pct(sum(k >= 5 for k in depth), n)} "
            f">=7={pct(sum(k >= 7 for k in depth), n)} "
            f"spearman(d, plan_depth)={spearman(shortest, depth):.3f}"
        )
        print(
            f"  shortest median={statistics.median(shortest):.0f} p90={percentile(shortest, 0.9)} "
            f"max={max(shortest)} over_{MAX_PROVIDED_SHORTEST}="
            f"{pct(sum(d > MAX_PROVIDED_SHORTEST for d in shortest), n)}"
        )
        for level in (1, 2, 3, 4, 5, -1, 0):
            group = [r.features for r in rated if r.level == level]
            if not group:
                print(f"  level {level}: 0")
                continue
            print(
                f"  level {level}: {pct(len(group), n)} "
                f"d={statistics.median(f.shortest for f in group):.0f}"
                f"[{min(f.shortest for f in group)}-{max(f.shortest for f in group)}] "
                f"search_median={statistics.median(f.search_moves for f in group):.0f} "
                f"search_p90={percentile([f.search_moves for f in group], 0.9)} "
                f"reachable_median={statistics.median(f.reachable for f in group):.0f} "
                f"dead_any={pct(sum(f.dead_states > 0 for f in group), len(group))}"
            )


def strongly_connected(reach: Reach) -> dict[int, int]:
    """停止点ごとの強連結成分の代表点（Kosaraju）。"""
    finished: list[int] = []
    seen: set[int] = set()
    for root in reach.dist:
        if root in seen:
            continue
        seen.add(root)
        stack = [(root, iter(reach.succ[root]))]
        while stack:
            state, moves = stack[-1]
            move = next(moves, None)
            if move is None:
                stack.pop()
                finished.append(state)
                continue
            _, end = move
            if end not in seen:
                seen.add(end)
                stack.append((end, iter(reach.succ[end])))
    pred: dict[int, list[int]] = {state: [] for state in reach.dist}
    for state, moves in reach.succ.items():
        for _, end in moves:
            pred[end].append(state)
    component: dict[int, int] = {}
    for root in reversed(finished):
        if root in component:
            continue
        component[root] = root
        pending = [root]
        while pending:
            state = pending.pop()
            for prev in pred[state]:
                if prev not in component:
                    component[prev] = root
                    pending.append(prev)
    return component


@dataclass(frozen=True)
class TrapStructure:
    """閉じ込め: 今の位置から行けるどの位置も今の位置へ戻れ、その中にゴールが無い状態。
    ウォーターソート（SPEC-009）の手詰まりと同じ線引きで、強連結成分が出口を持たず
    ゴールを含まないことにあたる。"""

    dead: frozenset[int]
    trapped: frozenset[int]
    wandering_dead: frozenset[int]  # 詰みだが、出口のある循環の中にいて閉じ込めにならない位置
    trap_sizes: tuple[int, ...]


def trap_structure(reach: Reach, goal: int) -> TrapStructure:
    component = strongly_connected(reach)
    members: dict[int, list[int]] = {}
    for state, root in component.items():
        members.setdefault(root, []).append(state)
    has_exit = {
        component[state]
        for state, moves in reach.succ.items()
        for _, end in moves
        if component[end] != component[state]
    }
    alive = coreachable(reach, goal)
    dead = frozenset(state for state in reach.dist if state not in alive)
    trap_roots = {root for root in members if root not in has_exit and root != component[goal]}
    trapped = frozenset(state for state in dead if component[state] in trap_roots)
    wandering = frozenset(state for state in dead - trapped if len(members[component[state]]) > 1)
    return TrapStructure(dead, trapped, wandering, tuple(len(members[root]) for root in trap_roots))


def walk_into_trap(
    reach: Reach, goal: int, structure: TrapStructure, rng: random.Random, limit: int
) -> tuple[str, int | None, int | None]:
    """方向を一様に選ぶプレイヤーが、ゴール・閉じ込めのどちらに先に至るか。
    返す値は (結果, 詰みに入った手数, 閉じ込められた手数)。成立しない方向は手数に数えない。"""
    state = reach.start
    moves = 0
    entered_dead: int | None = None
    for _ in range(4 * limit):
        if moves >= limit:
            break
        result = reach.slides[(state, rng.randrange(4))]
        if result.outcome != STOP or result.end == state:
            continue
        state = result.end
        moves += 1
        if state == goal:
            return "goal", entered_dead, None
        if entered_dead is None and state in structure.dead:
            entered_dead = moves
        if state in structure.trapped:
            return "trapped", entered_dead, moves
    return "timeout", entered_dead, None


def run_traps(args: argparse.Namespace) -> None:
    """詰みのうち、ウォーターソートと同じ線引きで知らせる「閉じ込め」がどれだけ起きるか。
    正方形は levels と同じ乱数で問題を選ぶ。"""
    for shape in args.sizes:
        rng = random.Random(f"{args.seed}-levels-{shape.seed_label}")
        rated = pool(shape, args.samples, rng, 3)
        walk_rng = random.Random(f"{args.seed}-traps-walk-{shape.seed_label}")
        by_level: dict[int, list[tuple[TrapStructure, str, int | None, int | None]]] = {}
        dead_total = trapped_total = wandering_total = 0
        trap_sizes: list[int] = []
        start_into_trap = 0
        for item in rated:
            reach = explore(item.board, item.start)
            structure = trap_structure(reach, item.goal)
            dead_total += len(structure.dead)
            trapped_total += len(structure.trapped)
            wandering_total += len(structure.wandering_dead)
            trap_sizes.extend(structure.trap_sizes)
            start_into_trap += any(end in structure.trapped for _, end in reach.succ[reach.start])
            outcome, dead_at, trapped_at = walk_into_trap(
                reach, item.goal, structure, walk_rng, 300
            )
            by_level.setdefault(item.level, []).append((structure, outcome, dead_at, trapped_at))
        n = len(rated)
        print(f"## {shape.label} n={n}")
        print(
            f"  dead_states={dead_total} trapped={pct(trapped_total, dead_total)} "
            f"wandering_dead={pct(wandering_total, dead_total)} "
            f"trap_size median={statistics.median(trap_sizes) if trap_sizes else '-'} "
            f"p90={percentile(trap_sizes, 0.9)} "
            f"start_move_into_trap={pct(start_into_trap, n)}"
        )
        for level in (1, 2, 3, 4, 5, -1, 0, None):
            rows = (
                [row for group in by_level.values() for row in group]
                if level is None
                else by_level.get(level, [])
            )
            if not rows:
                continue
            m = len(rows)
            dead_first = [row for row in rows if row[2] is not None]
            delays = [row[3] - row[2] for row in dead_first if row[3] is not None]
            label = "all" if level is None else f"level {level}"
            print(
                f"  {label}: n={m} has_trap={pct(sum(bool(row[0].trapped) for row in rows), m)} "
                f"walk goal={pct(sum(row[1] == 'goal' for row in rows), m)} "
                f"entered_dead={pct(len(dead_first), m)} "
                f"trapped={pct(sum(row[1] == 'trapped' for row in rows), m)} "
                f"timeout={pct(sum(row[1] == 'timeout' for row in rows), m)} "
                f"dead_to_trap median={statistics.median(delays) if delays else '-'} "
                f"p90={percentile(delays, 0.9)} "
                f"immediate={pct(sum(d == 0 for d in delays), len(delays))}"
            )


# スマホ操作PoCのプレイ画面の枠（ブランドの帯28px・見出し72px・盤面の領域の上下余白16px・
# 操作欄112px、左右余白24px）と、盤面の内側の縁6px。PoCの4つの viewport の実測値を再現する。
FRAME_HORIZONTAL_PX = 24
FRAME_VERTICAL_PX = 228
BOARD_INSET_PX = 6
VIEWPORTS = ((320, 568), (360, 640), (375, 667), (360, 780), (390, 844), (412, 915))
MIN_READABLE_CELL_PX = 24


def cell_px(shape: Shape, viewport: tuple[int, int]) -> float:
    width, height = viewport
    return min(
        (width - FRAME_HORIZONTAL_PX - BOARD_INSET_PX) / shape.width,
        (height - FRAME_VERTICAL_PX - BOARD_INSET_PX) / shape.height,
    )


def run_cells(args: argparse.Namespace) -> None:
    """盤面の形ごとの1マスの幅（px）。* は MIN_READABLE_CELL_PX 未満。"""
    print("shape " + " ".join(f"{w}x{h}" for w, h in VIEWPORTS))
    for shape in args.sizes:
        cells = []
        for viewport in VIEWPORTS:
            value = cell_px(shape, viewport)
            mark = "*" if value < MIN_READABLE_CELL_PX else ""
            cells.append(f"{value:.1f}{mark}")
        print(f"{shape.label} " + " ".join(cells))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "suite",
        choices=(
            "features",
            "levels",
            "supply",
            "local",
            "variants",
            "robustness",
            "examples",
            "contrast",
            "shapes",
            "traps",
            "cells",
        ),
    )
    parser.add_argument(
        "--sizes",
        type=parse_shape,
        nargs="+",
        default=[Shape(8, 8), Shape(10, 10)],
        help="`8` は8x8、`9x12` は幅9・高さ12",
    )
    parser.add_argument("--samples", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20261031)
    parser.add_argument("--iterations", type=int, default=300)
    parser.add_argument("--extra", type=float, default=0.06, help="床・穴・矢印の密度")
    parser.add_argument("--contrast-d", type=int, default=7)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.samples < 1:
        raise SystemExit("--samples must be at least 1")
    suites: dict[str, Callable[[argparse.Namespace], None]] = {
        "features": run_features,
        "levels": run_levels,
        "supply": run_supply,
        "local": run_local_supply,
        "variants": run_variants,
        "robustness": run_robustness,
        "examples": run_examples,
        "contrast": run_contrast,
        "shapes": run_shapes,
        "traps": run_traps,
        "cells": run_cells,
    }
    suites[args.suite](args)


if __name__ == "__main__":
    main()
