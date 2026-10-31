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
MAX_PROVIDED_SHORTEST = 14
# 方向番号 (上, 右, 下, 左) ごとの同点時の優先順位
DEFAULT_TIE_ORDER = (0, 1, 2, 3)
TIE_ORDERS = ((0, 1, 2, 3), (3, 2, 1, 0), (1, 3, 0, 2), (2, 0, 3, 1))

Heuristic = Callable[[int], tuple[int, ...]]


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
) -> int:
    for depth in range(1, MAX_LOOKAHEAD + 1):
        if lookahead_player(reach, goal, depth, heuristic, limit, tie_order) is not None:
            return depth
    return UNSOLVED


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


def analyze(reach: Reach, goal: int, tie_orders: Sequence[Sequence[int]] = TIE_ORDERS) -> Features:
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
            required_lookahead(reach, goal, manhattan_h, limit, order) for order in tie_orders
        ),
        align_lookahead=min(
            required_lookahead(reach, goal, align_h, limit, order) for order in tie_orders
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
    if depth == UNSOLVED:
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


def pool(size: int, count: int, rng: random.Random, min_shortest: int) -> list[Rated]:
    """G1で1盤面1問、ゴールを最短 min_shortest 手以上の停止点から一様に選ぶ。"""
    density = BEST_DENSITY.get(size, 0.20)
    rated: list[Rated] = []
    while len(rated) < count:
        generated = random_board_candidates(size, size, rng, density)
        assert generated is not None
        board, start, reach = generated
        candidates = [g for g in goal_candidates(reach) if reach.dist[g] >= min_shortest]
        if not candidates:
            continue
        goal = candidates[rng.randrange(len(candidates))]
        features = analyze(reach, goal)
        rated.append(Rated(board, start, goal, features, classify(features)))
    return rated


def run_features(args: argparse.Namespace) -> None:
    """特徴量の分布と、最短手数と先読み深さ・試行量が別の量かを確かめる。"""
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-features-{size}")
        started = time.perf_counter()
        rated = pool(size, args.samples, rng, 3)
        elapsed = time.perf_counter() - started
        fs = [r.features for r in rated]
        d = [f.shortest for f in fs]
        depth = [plan_depth(f) for f in fs]
        search = [f.search_moves for f in fs]
        print(f"## {size}x{size} n={len(fs)} analyze_per_puzzle={elapsed / len(fs) * 1000:.2f}ms")
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
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-levels-{size}")
        rated = pool(size, args.samples, rng, 3)
        counts = Counter(r.level for r in rated)
        n = len(rated)
        print(f"## {size}x{size} n={n}")
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
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-supply-{size}")
        density = BEST_DENSITY.get(size, 0.20)
        boards_with = Counter[int]()
        keys: dict[int, set[tuple[str, int, int]]] = {}
        duplicates = Counter[int]()
        started = time.perf_counter()
        for _ in range(args.samples):
            generated = random_board_candidates(size, size, rng, density)
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
        print(f"## {size}x{size} boards={args.samples} per_board={per_board * 1000:.1f}ms")
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
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-local-{size}")
        density = BEST_DENSITY.get(size, 0.20)
        hits = Counter[int]()
        too_long = 0
        started = time.perf_counter()
        for _ in range(args.samples):
            _, _, reach = local_search(size, size, rng, density, args.iterations)
            features = [analyze(reach, g) for g in goal_candidates(reach)]
            for level in {classify(f) for f in features}:
                hits[level] += 1
            too_long += any(f.shortest > MAX_PROVIDED_SHORTEST for f in features)
        elapsed = time.perf_counter() - started
        print(
            f"## {size}x{size} G3 runs={args.samples} "
            f"per_run={elapsed / args.samples * 1000:.0f}ms "
            + " ".join(f"L{level}={hits[level]}" for level in (1, 2, 3, 4, 5, -1))
            + f" longer_than_{MAX_PROVIDED_SHORTEST}={too_long}"
        )


def run_variants(args: argparse.Namespace) -> None:
    """床の種類ごとに、1盤面1問の一様抽出での仮レベル分布を比べる。"""
    size = args.sizes[0]
    for variant in VARIANTS:
        rng = random.Random(f"{args.seed}-variants-{variant}-{size}")
        counts = Counter[int]()
        n = 0
        boards = 0
        while n < args.samples:
            boards += 1
            generated = random_board_candidates(
                size, size, rng, VARIANT_DENSITY[variant], variant, args.extra
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
            f"{variant} ({VARIANTS[variant]}) {size}x{size} n={n} boards={boards} "
            + " ".join(
                f"L{level}={100 * counts[level] / n:.1f}%" for level in (1, 2, 3, 4, 5, -1, 0)
            )
        )


def run_robustness(args: argparse.Namespace) -> None:
    """同点時の方向優先順位を1つに固定した場合に、全優先順位を使う判定からどれだけずれるか。"""
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-robust-{size}")
        rated = pool(size, args.samples, rng, 3)
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
            f"{size}x{size} n={n} single_orders_match_combined={100 * same / n:.1f}% "
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
    size = args.sizes[0]
    rng = random.Random(f"{args.seed}-examples-{size}")
    rated = pool(size, args.samples, rng, 3)
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
    size = args.sizes[0]
    rng = random.Random(f"{args.seed}-contrast-{size}")
    rated = pool(size, args.samples, rng, 3)
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
        ),
    )
    parser.add_argument("--sizes", type=int, nargs="+", default=[8, 10])
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
    }
    suites[args.suite](args)


if __name__ == "__main__":
    main()
