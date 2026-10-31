"""氷の床迷路（作業名）の問題供給実験。

ルール:
- 格子盤面に駒が1つ、ゴールが1マスある。
- 上下左右を選ぶと、駒は岩か外壁にぶつかるまで止まらずに滑る。
- ゴールのマスで止まったときだけクリア。通過はクリアにならない。

床の種類の比較用に、次のマスも扱う。
- ふつうの床 ``o``: 入ると止まる。
- 穴 ``x``: 入ると落ちて失敗。
- 矢印床 ``^ > v <``: 入ると矢印の向きへ進行方向が変わり、滑り続ける。

Python標準ライブラリだけを使う。乱数はすべて seed から作り、結果を再現可能にする。
"""

from __future__ import annotations

import argparse
import random
import statistics
import time
from collections import Counter, deque
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field

ICE = "."
ROCK = "#"
FLOOR = "o"
HOLE = "x"
ARROWS = "^>v<"

# 方向番号: 0=上, 1=右, 2=下, 3=左
DX = (0, 1, 0, -1)
DY = (-1, 0, 1, 0)
DIR_NAMES = ("上", "右", "下", "左")

STOP = "stop"
FALL = "fall"
LOOP = "loop"
BLOCKED = "blocked"

VARIANTS = {
    "a": "氷と岩だけ",
    "b": "+ふつうの床",
    "c": "+穴",
    "d": "+矢印床",
}


@dataclass(frozen=True)
class Board:
    width: int
    height: int
    cells: str

    def rows(self) -> list[str]:
        return [self.cells[y * self.width : (y + 1) * self.width] for y in range(self.height)]


@dataclass(frozen=True)
class Slide:
    outcome: str
    end: int
    path: tuple[int, ...]
    stopper: int | None  # 移動を止めた、または塞いだ岩のセル。外壁・床で止まった場合は None
    wall_stop: bool


@dataclass
class Reach:
    """開始点から到達できる停止点と、その間の移動。"""

    board: Board
    start: int
    dist: dict[int, int]
    succ: dict[int, list[tuple[int, int]]]  # state -> [(direction, end)]
    slides: dict[tuple[int, int], Slide]
    fall_moves: int
    loop_moves: int


@dataclass
class PuzzleMetrics:
    shortest: int
    shortest_paths: int
    reachable: int
    dead_states: int
    goal_stop_kinds: frozenset[str]
    pass_over_states: int
    irrelevant_rocks: int
    rocks: int
    start_dead_moves: int
    start_moves: int


@dataclass
class Puzzle:
    board: Board
    start: int
    goal: int
    metrics: PuzzleMetrics
    extra: dict[str, float] = field(default_factory=dict)


def slide(board: Board, start: int, direction: int) -> Slide:
    width, height, cells = board.width, board.height, board.cells
    x, y = start % width, start // width
    current = start
    path: list[int] = []
    seen: set[tuple[int, int]] = set()
    while True:
        nx, ny = x + DX[direction], y + DY[direction]
        if not (0 <= nx < width and 0 <= ny < height):
            outcome = STOP if path else BLOCKED
            return Slide(outcome, current, tuple(path), None, True)
        nxt = ny * width + nx
        tile = cells[nxt]
        if tile == ROCK:
            outcome = STOP if path else BLOCKED
            return Slide(outcome, current, tuple(path), nxt, False)
        current = nxt
        x, y = nx, ny
        path.append(nxt)
        if tile == HOLE:
            return Slide(FALL, nxt, tuple(path), None, False)
        if tile == FLOOR:
            return Slide(STOP, nxt, tuple(path), None, False)
        arrow = ARROWS.find(tile)
        if arrow >= 0:
            direction = arrow
            key = (nxt, direction)
            if key in seen:
                return Slide(LOOP, nxt, tuple(path), None, False)
            seen.add(key)


def explore(board: Board, start: int) -> Reach:
    dist = {start: 0}
    succ: dict[int, list[tuple[int, int]]] = {}
    slides: dict[tuple[int, int], Slide] = {}
    queue = deque([start])
    fall_moves = 0
    loop_moves = 0
    while queue:
        state = queue.popleft()
        moves: list[tuple[int, int]] = []
        for direction in range(4):
            result = slide(board, state, direction)
            slides[(state, direction)] = result
            if result.outcome == FALL:
                fall_moves += 1
                continue
            if result.outcome == LOOP:
                loop_moves += 1
                continue
            if result.outcome == BLOCKED or result.end == state:
                continue
            moves.append((direction, result.end))
            if result.end not in dist:
                dist[result.end] = dist[state] + 1
                queue.append(result.end)
        succ[state] = moves
    return Reach(board, start, dist, succ, slides, fall_moves, loop_moves)


def coreachable(reach: Reach, goal: int) -> set[int]:
    pred: dict[int, list[int]] = {state: [] for state in reach.dist}
    for state, moves in reach.succ.items():
        for _, end in moves:
            pred[end].append(state)
    seen = {goal}
    queue = deque([goal])
    while queue:
        state = queue.popleft()
        for prev in pred[state]:
            if prev not in seen:
                seen.add(prev)
                queue.append(prev)
    return seen


def count_shortest_paths(reach: Reach, goal: int) -> int:
    """最短手数で goal に止まる手順（方向列）の数。"""
    order = sorted(reach.dist, key=lambda state: reach.dist[state])
    ways = {reach.start: 1}
    for state in order:
        count = ways.get(state, 0)
        if count == 0:
            continue
        for _, end in reach.succ[state]:
            if reach.dist[end] == reach.dist[state] + 1:
                ways[end] = ways.get(end, 0) + count
    return ways.get(goal, 0)


def relevant_rocks(reach: Reach) -> set[int]:
    """到達できる停止点からの移動を、止めるか塞ぐかする岩。"""
    return {result.stopper for result in reach.slides.values() if result.stopper is not None}


def without_irrelevant_rocks(reach: Reach) -> Board:
    board = reach.board
    keep = relevant_rocks(reach)
    cells = [
        ICE if tile == ROCK and index not in keep else tile
        for index, tile in enumerate(board.cells)
    ]
    return Board(board.width, board.height, "".join(cells))


def measure(reach: Reach, goal: int) -> PuzzleMetrics:
    board = reach.board
    alive = coreachable(reach, goal)
    stop_kinds: set[str] = set()
    pass_over: set[int] = set()
    for (state, _), result in reach.slides.items():
        if result.outcome == STOP and result.end == goal:
            stop_kinds.add("wall" if result.wall_stop else "rock")
        if goal in result.path and not (result.outcome == STOP and result.end == goal):
            pass_over.add(state)
    rocks = sum(1 for tile in board.cells if tile == ROCK)
    start_moves = reach.succ[reach.start]
    return PuzzleMetrics(
        shortest=reach.dist[goal],
        shortest_paths=count_shortest_paths(reach, goal),
        reachable=len(reach.dist),
        dead_states=sum(1 for state in reach.dist if state not in alive),
        goal_stop_kinds=frozenset(stop_kinds),
        pass_over_states=len(pass_over),
        irrelevant_rocks=rocks - len(relevant_rocks(reach)),
        rocks=rocks,
        start_dead_moves=sum(1 for _, end in start_moves if end not in alive),
        start_moves=len(start_moves),
    )


def random_board(
    width: int,
    height: int,
    rng: random.Random,
    rock_density: float,
    variant: str = "a",
    extra_density: float = 0.06,
) -> Board:
    cells: list[str] = []
    for _ in range(width * height):
        roll = rng.random()
        if roll < rock_density:
            cells.append(ROCK)
            continue
        roll = rng.random()
        if variant == "b" and roll < extra_density:
            cells.append(FLOOR)
        elif variant == "c" and roll < extra_density:
            cells.append(HOLE)
        elif variant == "d" and roll < extra_density:
            cells.append(ARROWS[rng.randrange(4)])
        else:
            cells.append(ICE)
    return Board(width, height, "".join(cells))


def ice_cells(board: Board) -> list[int]:
    return [index for index, tile in enumerate(board.cells) if tile == ICE]


def goal_candidates(reach: Reach) -> list[int]:
    """ゴールに置ける停止点。ゴールは氷のマスに限る。"""
    cells = reach.board.cells
    return sorted(state for state in reach.dist if state != reach.start and cells[state] == ICE)


def random_board_candidates(
    width: int,
    height: int,
    rng: random.Random,
    rock_density: float,
    variant: str = "a",
    extra_density: float = 0.06,
) -> tuple[Board, int, Reach] | None:
    """方式G1: ランダム配置して開始点を選び、BFSで到達停止点を求める。"""
    board = random_board(width, height, rng, rock_density, variant, extra_density)
    starts = ice_cells(board)
    if not starts:
        return None
    start = starts[rng.randrange(len(starts))]
    reach = explore(board, start)
    if variant == "d" and reach.loop_moves:
        return None  # 矢印の循環がある盤面は使わない
    return board, start, reach


def reverse_construct(
    width: int,
    height: int,
    rng: random.Random,
    steps: int,
    noise_density: float,
) -> tuple[Board, int, int] | None:
    """方式G2: ゴールから逆向きに止め石と1手前の停止点を置き、意図した手順を構成する。"""
    cells = [ICE] * (width * height)
    reserved: set[int] = set()
    goal = rng.randrange(width * height)
    current = goal
    reserved.add(goal)
    for _ in range(steps):
        options: list[tuple[int, int, list[int]]] = []
        cx, cy = current % width, current // width
        for direction in range(4):
            sx, sy = cx + DX[direction], cy + DY[direction]
            stopper: int | None = None
            if 0 <= sx < width and 0 <= sy < height:
                stopper = sy * width + sx
                if stopper in reserved:
                    continue
            px, py = cx, cy
            passed: list[int] = []
            while True:
                px, py = px - DX[direction], py - DY[direction]
                if not (0 <= px < width and 0 <= py < height):
                    break
                prev = py * width + px
                if cells[prev] == ROCK or prev == stopper:
                    break
                options.append((direction, prev, [*passed, prev]))
                passed.append(prev)
        if not options:
            return None
        direction, prev, passed = options[rng.randrange(len(options))]
        cx, cy = current % width, current // width
        sx, sy = cx + DX[direction], cy + DY[direction]
        if 0 <= sx < width and 0 <= sy < height:
            cells[sy * width + sx] = ROCK
        reserved.update(passed)
        current = prev
    start = current
    if start == goal:
        return None
    for index in range(width * height):
        if index not in reserved and cells[index] == ICE and rng.random() < noise_density:
            cells[index] = ROCK
    return Board(width, height, "".join(cells)), start, goal


def eccentricity(board: Board, start: int) -> tuple[int, Reach]:
    reach = explore(board, start)
    candidates = goal_candidates(reach)
    if not candidates:
        return 0, reach
    return max(reach.dist[state] for state in candidates), reach


def local_search(
    width: int,
    height: int,
    rng: random.Random,
    rock_density: float,
    iterations: int,
) -> tuple[Board, int, Reach]:
    """方式G3: ランダム盤面から岩の追加・除去を繰り返し、最長の最短手数を伸ばす。"""
    board = random_board(width, height, rng, rock_density)
    starts = ice_cells(board)
    start = starts[rng.randrange(len(starts))]
    best, reach = eccentricity(board, start)
    for _ in range(iterations):
        index = rng.randrange(width * height)
        if index == start:
            continue
        cells = list(board.cells)
        cells[index] = ICE if cells[index] == ROCK else ROCK
        candidate = Board(width, height, "".join(cells))
        value, candidate_reach = eccentricity(candidate, start)
        if value >= best:
            board, best, reach = candidate, value, candidate_reach
    return board, start, reach


def transform(board: Board, start: int, goal: int, which: int) -> tuple[str, int, int]:
    """8種類の回転・反転。which // 4 が反転、which % 4 が回転回数。"""
    size = board.width
    rotate_tile = {"^": ">", ">": "v", "v": "<", "<": "^"}
    mirror_tile = {">": "<", "<": ">"}

    def map_index(index: int) -> int:
        x, y = index % size, index // size
        if which // 4:
            x = size - 1 - x
        for _ in range(which % 4):
            x, y = size - 1 - y, x
        return y * size + x

    cells = [ICE] * (size * size)
    for index, tile in enumerate(board.cells):
        if which // 4:
            tile = mirror_tile.get(tile, tile)
        for _ in range(which % 4):
            tile = rotate_tile.get(tile, tile)
        cells[map_index(index)] = tile
    return "".join(cells), map_index(start), map_index(goal)


def transform_rectangle(board: Board, start: int, goal: int, which: int) -> tuple[str, int, int]:
    """長方形の盤面で形を保つ4種類（恒等・左右反転・上下反転・180度回転）。
    which の1ビット目が左右反転、2ビット目が上下反転。90度回転は縦横が入れ替わるので含めない。"""
    width, height = board.width, board.height
    mirror_tile = {">": "<", "<": ">"}
    flip_tile = {"^": "v", "v": "^"}

    def map_index(index: int) -> int:
        x, y = index % width, index // width
        if which & 1:
            x = width - 1 - x
        if which & 2:
            y = height - 1 - y
        return y * width + x

    cells = [ICE] * (width * height)
    for index, tile in enumerate(board.cells):
        if which & 1:
            tile = mirror_tile.get(tile, tile)
        if which & 2:
            tile = flip_tile.get(tile, tile)
        cells[map_index(index)] = tile
    return "".join(cells), map_index(start), map_index(goal)


def canonical_key(board: Board, start: int, goal: int) -> tuple[str, int, int]:
    if board.width != board.height:
        return min(transform_rectangle(board, start, goal, which) for which in range(4))
    return min(transform(board, start, goal, which) for which in range(8))


def render(board: Board, start: int, goal: int) -> list[str]:
    rows = []
    for y in range(board.height):
        row = []
        for x in range(board.width):
            index = y * board.width + x
            if index == start:
                row.append("S")
            elif index == goal:
                row.append("G")
            else:
                row.append(board.cells[index])
        rows.append("".join(row))
    return rows


def percentile(values: Sequence[float], ratio: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    return ordered[min(len(ordered) - 1, int(ratio * len(ordered)))]


def fmt_ms(seconds: float) -> str:
    return f"{seconds * 1000:.2f}ms"


def pct(part: float, whole: float) -> str:
    return f"{100 * part / whole:.1f}%" if whole else "-"


def at_least(threshold: int) -> Callable[[int], bool]:
    return lambda shortest: shortest >= threshold


def pick_goal(
    reach: Reach,
    rng: random.Random,
    accept: Callable[[int], bool],
) -> int | None:
    candidates = [state for state in goal_candidates(reach) if accept(reach.dist[state])]
    if not candidates:
        return None
    return candidates[rng.randrange(len(candidates))]


def run_density(args: argparse.Namespace) -> None:
    """岩密度ごとに、1盤面から取れる最長の最短手数と到達停止点数を見る。"""
    for size in args.sizes:
        print(f"## {size}x{size}")
        for density in (0.10, 0.14, 0.18, 0.22, 0.26, 0.30):
            rng = random.Random(f"{args.seed}-density-{size}-{density}")
            ecc: list[int] = []
            reachable: list[int] = []
            for _ in range(args.samples):
                generated = random_board_candidates(size, size, rng, density)
                assert generated is not None
                _, _, reach = generated
                candidates = goal_candidates(reach)
                ecc.append(max((reach.dist[c] for c in candidates), default=0))
                reachable.append(len(reach.dist))
            print(
                f"density={density:.2f} max_shortest_median={statistics.median(ecc)} "
                f"p90={percentile(ecc, 0.9)} ge8={pct(sum(v >= 8 for v in ecc), len(ecc))} "
                f"ge12={pct(sum(v >= 12 for v in ecc), len(ecc))} "
                f"reachable_median={statistics.median(reachable)}"
            )


BEST_DENSITY = {6: 0.20, 7: 0.20, 8: 0.20, 9: 0.20, 10: 0.20, 11: 0.20, 12: 0.20}


def run_sizes(args: argparse.Namespace) -> None:
    """G1で盤面ごとに最も遠い停止点をゴールにしたときの供給統計。"""
    for size in args.sizes:
        density = args.density or BEST_DENSITY.get(size, 0.18)
        rng = random.Random(f"{args.seed}-sizes-{size}")
        started = time.perf_counter()
        boards = 0
        ecc: list[int] = []
        reachable: list[int] = []
        thresholds = (3, 6, 9, 12, 15)
        at_least = Counter[int]()
        for _ in range(args.samples):
            generated = random_board_candidates(size, size, rng, density)
            assert generated is not None
            _, _, reach = generated
            boards += 1
            candidates = goal_candidates(reach)
            value = max((reach.dist[c] for c in candidates), default=0)
            ecc.append(value)
            reachable.append(len(reach.dist))
            for threshold in thresholds:
                if value >= threshold:
                    at_least[threshold] += 1
        elapsed = time.perf_counter() - started
        print(
            f"{size}x{size} density={density:.2f} boards={boards} "
            f"per_board={fmt_ms(elapsed / boards)} "
            f"reachable_median={statistics.median(reachable)} "
            f"reachable_p10={percentile(reachable, 0.1)} reachable_p90={percentile(reachable, 0.9)} "
            f"max_shortest_median={statistics.median(ecc)} p90={percentile(ecc, 0.9)} max={max(ecc)}"
        )
        print(
            "  boards with goal at >= d: "
            + " ".join(f"d>={t}:{pct(at_least[t], boards)}" for t in thresholds)
        )


def collect_puzzles(
    size: int,
    count: int,
    rng: random.Random,
    density: float,
    min_shortest: int,
    variant: str = "a",
    extra_density: float = 0.06,
    max_boards: int = 1_000_000,
) -> tuple[list[Puzzle], int, float]:
    """G1で1盤面1問、ゴールを min_shortest 手以上の停止点から一様に選ぶ。"""
    puzzles: list[Puzzle] = []
    boards = 0
    started = time.perf_counter()
    while len(puzzles) < count and boards < max_boards:
        boards += 1
        generated = random_board_candidates(size, size, rng, density, variant, extra_density)
        if generated is None:
            continue
        board, start, reach = generated
        goal = pick_goal(reach, rng, lambda d: d >= min_shortest)
        if goal is None:
            continue
        puzzles.append(Puzzle(board, start, goal, measure(reach, goal)))
    return puzzles, boards, time.perf_counter() - started


def summarize_quality(puzzles: Sequence[Puzzle], boards: int, elapsed: float) -> None:
    n = len(puzzles)
    shortest = [p.metrics.shortest for p in puzzles]
    unique = sum(p.metrics.shortest_paths == 1 for p in puzzles)
    rock_only = sum(p.metrics.goal_stop_kinds == frozenset({"rock"}) for p in puzzles)
    wall_only = sum(p.metrics.goal_stop_kinds == frozenset({"wall"}) for p in puzzles)
    mixed = n - rock_only - wall_only
    with_dead = sum(p.metrics.dead_states > 0 for p in puzzles)
    dead_ratio = [p.metrics.dead_states / p.metrics.reachable for p in puzzles]
    start_dead = sum(p.metrics.start_dead_moves > 0 for p in puzzles)
    pass_over = sum(p.metrics.pass_over_states > 0 for p in puzzles)
    irrelevant = [p.metrics.irrelevant_rocks / max(1, p.metrics.rocks) for p in puzzles]
    with_irrelevant = sum(p.metrics.irrelevant_rocks > 0 for p in puzzles)
    print(
        f"  accepted={n}/{boards} boards ({pct(n, boards)}) per_accepted={fmt_ms(elapsed / max(1, n))}"
    )
    print(
        f"  shortest median={statistics.median(shortest)} p10={percentile(shortest, 0.1)} "
        f"p90={percentile(shortest, 0.9)}"
    )
    print(f"  unique_shortest={pct(unique, n)}")
    print(
        f"  goal_stop rock_only={pct(rock_only, n)} wall_only={pct(wall_only, n)} mixed={pct(mixed, n)}"
    )
    print(
        f"  dead_reachable_any={pct(with_dead, n)} dead_state_ratio_mean={statistics.mean(dead_ratio):.3f} "
        f"start_has_dead_move={pct(start_dead, n)}"
    )
    print(f"  goal_pass_over_exists={pct(pass_over, n)}")
    print(
        f"  irrelevant_rock_any={pct(with_irrelevant, n)} irrelevant_rock_ratio_mean={statistics.mean(irrelevant):.3f}"
    )


def run_quality(args: argparse.Namespace) -> None:
    for size in args.sizes:
        density = args.density or BEST_DENSITY.get(size, 0.18)
        rng = random.Random(f"{args.seed}-quality-{size}")
        puzzles, boards, elapsed = collect_puzzles(
            size, args.samples, rng, density, args.min_shortest
        )
        print(f"{size}x{size} density={density:.2f} min_shortest={args.min_shortest}")
        summarize_quality(puzzles, boards, elapsed)


def run_methods(args: argparse.Namespace) -> None:
    """G1・G2・G3で、目標の最短手数以上の問題1問を得る時間と、意図手数との差を比べる。"""
    for size in args.sizes:
        density = args.density or BEST_DENSITY.get(size, 0.18)
        for target in args.targets:
            # G1: ランダム配置 + BFS + 終点選択
            rng = random.Random(f"{args.seed}-g1-{size}-{target}")
            started = time.perf_counter()
            puzzles, boards = 0, 0
            while puzzles < args.samples and boards < args.samples * 2000:
                boards += 1
                generated = random_board_candidates(size, size, rng, density)
                assert generated is not None
                _, _, reach = generated
                if pick_goal(reach, rng, at_least(target)) is not None:
                    puzzles += 1
            elapsed = time.perf_counter() - started
            print(
                f"{size}x{size} target>={target} G1 random+BFS: {puzzles}/{boards} boards "
                f"({pct(puzzles, boards)}) per_puzzle={fmt_ms(elapsed / max(1, puzzles))}"
            )

            # G2: 逆向き構成
            rng = random.Random(f"{args.seed}-g2-{size}-{target}")
            started = time.perf_counter()
            puzzles, attempts = 0, 0
            ratios: list[float] = []
            while puzzles < args.samples and attempts < args.samples * 2000:
                attempts += 1
                built = reverse_construct(size, size, rng, target + 2, args.noise)
                if built is None:
                    continue
                board, start, goal = built
                reach = explore(board, start)
                actual = reach.dist.get(goal)
                if actual is None:
                    continue
                ratios.append(actual / (target + 2))
                if actual >= target:
                    puzzles += 1
            elapsed = time.perf_counter() - started
            print(
                f"{size}x{size} target>={target} G2 reverse(steps={target + 2}): {puzzles}/{attempts} "
                f"({pct(puzzles, attempts)}) per_puzzle={fmt_ms(elapsed / max(1, puzzles))} "
                f"actual/intended median={statistics.median(ratios):.2f}"
            )

            # G3: 局所探索（成功するまで再試行）
            rng = random.Random(f"{args.seed}-g3-{size}-{target}")
            started = time.perf_counter()
            puzzles, runs = 0, 0
            while puzzles < max(1, args.samples // 4) and runs < args.samples * 10:
                runs += 1
                _, _, reach = local_search(size, size, rng, density, args.iterations)
                if pick_goal(reach, rng, at_least(target)) is not None:
                    puzzles += 1
            elapsed = time.perf_counter() - started
            print(
                f"{size}x{size} target>={target} G3 local({args.iterations} it): {puzzles}/{runs} runs "
                f"({pct(puzzles, runs)}) per_puzzle={fmt_ms(elapsed / max(1, puzzles))}"
            )


VARIANT_DENSITY = {"a": 0.20, "b": 0.16, "c": 0.16, "d": 0.16}


def random_walk_trapped(
    reach: Reach, goal: int, alive: set[int], rng: random.Random, limit: int
) -> str:
    """方向を一様に選ぶ素朴なプレイヤーが、ゴール・詰み・落下のどれに先に至るか。"""
    state = reach.start
    for _ in range(limit):
        direction = rng.randrange(4)
        result = reach.slides[(state, direction)]
        if result.outcome == FALL:
            return "fall"
        if result.outcome != STOP:
            continue
        state = result.end
        if state == goal:
            return "goal"
        if state not in alive:
            return "dead"
    return "timeout"


def run_variants(args: argparse.Namespace) -> None:
    size = args.sizes[0]
    for variant in args.variants:
        density = VARIANT_DENSITY[variant]
        rng = random.Random(f"{args.seed}-variant-{variant}-{size}")
        started = time.perf_counter()
        boards = 0
        rejected_loop = 0
        puzzles: list[Puzzle] = []
        ecc: list[int] = []
        branching: list[float] = []
        fall_states = 0
        reachable_total = 0
        walk = Counter[str]()
        single_step = 0
        moves_total = 0
        while len(puzzles) < args.samples and boards < args.samples * 200:
            boards += 1
            board = random_board(size, size, rng, density, variant, args.extra)
            starts = ice_cells(board)
            start = starts[rng.randrange(len(starts))]
            reach = explore(board, start)
            if variant == "d" and reach.loop_moves:
                rejected_loop += 1
                continue
            candidates = goal_candidates(reach)
            if not candidates:
                continue
            ecc.append(max(reach.dist[c] for c in candidates))
            goal = pick_goal(reach, rng, lambda d: d >= args.min_shortest)
            if goal is None:
                continue
            metrics = measure(reach, goal)
            puzzles.append(Puzzle(board, start, goal, metrics))
            moves = [len(m) for m in reach.succ.values()]
            branching.append(statistics.mean(moves))
            for state in reach.dist:
                for direction in range(4):
                    result = reach.slides[(state, direction)]
                    if result.outcome == STOP and result.end != state:
                        moves_total += 1
                        if len(result.path) == 1:
                            single_step += 1
                if any(reach.slides[(state, d)].outcome == FALL for d in range(4)):
                    fall_states += 1
            reachable_total += len(reach.dist)
            alive = coreachable(reach, goal)
            walk[random_walk_trapped(reach, goal, alive, rng, 200)] += 1
        elapsed = time.perf_counter() - started
        print(
            f"## variant {variant} ({VARIANTS[variant]}) {size}x{size} rock={density} extra={args.extra}"
        )
        if variant == "d":
            print(f"  rejected_for_arrow_loop={rejected_loop}/{boards}")
        print(
            f"  max_shortest_per_board median={statistics.median(ecc)} p90={percentile(ecc, 0.9)}"
        )
        print(f"  mean_out_degree={statistics.mean(branching):.2f}")
        print(f"  single_cell_moves={pct(single_step, moves_total)}")
        print(f"  states_with_fall_move={pct(fall_states, reachable_total)}")
        n = len(puzzles)
        print(
            "  random_walk: "
            + " ".join(f"{k}={pct(walk[k], n)}" for k in ("goal", "dead", "fall", "timeout"))
        )
        summarize_quality(puzzles, boards, elapsed)


def run_diversity(args: argparse.Namespace) -> None:
    for size in args.sizes:
        density = args.density or BEST_DENSITY.get(size, 0.18)
        rng = random.Random(f"{args.seed}-diversity-{size}")
        puzzles, boards, _ = collect_puzzles(size, args.samples, rng, density, args.min_shortest)
        exact: set[tuple[str, int, int]] = set()
        canonical: set[tuple[str, int, int]] = set()
        exact_dup = 0
        sym_dup = 0
        board_dup = 0
        board_keys: set[str] = set()
        for puzzle in puzzles:
            key = (puzzle.board.cells, puzzle.start, puzzle.goal)
            if key in exact:
                exact_dup += 1
            exact.add(key)
            ckey = canonical_key(puzzle.board, puzzle.start, puzzle.goal)
            if ckey in canonical:
                sym_dup += 1
            canonical.add(ckey)
            if puzzle.board.cells in board_keys:
                board_dup += 1
            board_keys.add(puzzle.board.cells)
        print(
            f"{size}x{size} min_shortest={args.min_shortest}: puzzles={len(puzzles)} boards={boards} "
            f"exact_dup={exact_dup} symmetry_dup={sym_dup} board_dup={board_dup}"
        )


def run_deadends(args: argparse.Namespace) -> None:
    """詰み（ゴールへ戻れない停止点）の発生頻度と、それが最短手数ごとにどう変わるか。"""
    for size in args.sizes:
        density = args.density or BEST_DENSITY.get(size, 0.18)
        rng = random.Random(f"{args.seed}-dead-{size}")
        puzzles, _, _ = collect_puzzles(size, args.samples, rng, density, args.min_shortest)
        buckets: dict[str, list[Puzzle]] = {}
        for puzzle in puzzles:
            d = puzzle.metrics.shortest
            label = "3-5" if d <= 5 else "6-8" if d <= 8 else "9-11" if d <= 11 else "12+"
            buckets.setdefault(label, []).append(puzzle)
        walk_rng = random.Random(f"{args.seed}-dead-walk-{size}")
        print(f"## {size}x{size}")
        for label in ("3-5", "6-8", "9-11", "12+"):
            group = buckets.get(label, [])
            if not group:
                continue
            n = len(group)
            any_dead = sum(p.metrics.dead_states > 0 for p in group)
            start_dead = sum(p.metrics.start_dead_moves > 0 for p in group)
            walk = Counter[str]()
            for puzzle in group:
                reach = explore(puzzle.board, puzzle.start)
                alive = coreachable(reach, puzzle.goal)
                walk[random_walk_trapped(reach, puzzle.goal, alive, walk_rng, 300)] += 1
            print(
                f"  d={label}: n={n} any_dead={pct(any_dead, n)} start_dead_move={pct(start_dead, n)} "
                f"dead_ratio_mean={statistics.mean(p.metrics.dead_states / p.metrics.reachable for p in group):.3f} "
                f"random_walk_dead_first={pct(walk['dead'], n)} goal_first={pct(walk['goal'], n)}"
            )


def naive_end(board: Board, start: int, direction: int) -> int:
    """氷と岩だけの盤面での1マスずつの移動。slide とは独立に書いた照合用の実装。"""
    x, y = start % board.width, start // board.width
    while True:
        nx, ny = x + DX[direction], y + DY[direction]
        inside = 0 <= nx < board.width and 0 <= ny < board.height
        if not inside or board.cells[ny * board.width + nx] == ROCK:
            return y * board.width + x
        x, y = nx, ny


def run_verify(args: argparse.Namespace) -> None:
    """方向列を depth 手まで総当たりして、BFSの最短手数と一致するか確かめる。"""
    depth = 6
    mismatches = 0
    checked = 0
    strip_changed = 0
    for size in args.sizes:
        rng = random.Random(f"{args.seed}-verify-{size}")
        for _ in range(args.samples):
            board = random_board(size, size, rng, BEST_DENSITY.get(size, 0.20))
            starts = ice_cells(board)
            start = starts[rng.randrange(len(starts))]
            brute: dict[int, int] = {}
            frontier = {start}
            for moves in range(depth + 1):
                for state in frontier:
                    brute.setdefault(state, moves)
                frontier = {naive_end(board, state, d) for state in frontier for d in range(4)}
            reach = explore(board, start)
            expected = {state: d for state, d in reach.dist.items() if d <= depth}
            checked += 1
            if expected != brute:
                mismatches += 1
            stripped = explore(without_irrelevant_rocks(reach), start)
            if stripped.succ != reach.succ:
                strip_changed += 1
    print(
        f"boards={checked} depth<={depth} mismatches={mismatches} "
        f"graph_changed_by_removing_irrelevant_rocks={strip_changed}"
    )


def print_examples(puzzles: Iterable[Puzzle], limit: int) -> None:
    for puzzle in list(puzzles)[:limit]:
        m = puzzle.metrics
        print(
            f"shortest={m.shortest} paths={m.shortest_paths} reachable={m.reachable} "
            f"dead={m.dead_states} stop={sorted(m.goal_stop_kinds)}"
        )
        for row in render(puzzle.board, puzzle.start, puzzle.goal):
            print("  " + row)


def run_examples(args: argparse.Namespace) -> None:
    for variant in args.variants:
        size = args.sizes[0]
        rng = random.Random(f"{args.seed}-examples-{variant}-{size}")
        puzzles, _, _ = collect_puzzles(
            size, 3, rng, VARIANT_DENSITY[variant], args.min_shortest, variant, args.extra
        )
        print(f"## variant {variant}")
        print_examples(puzzles, 3)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "suite",
        choices=(
            "density",
            "sizes",
            "quality",
            "methods",
            "variants",
            "diversity",
            "deadends",
            "verify",
            "examples",
        ),
    )
    parser.add_argument("--sizes", type=int, nargs="+", default=[6, 7, 8, 9, 10, 12])
    parser.add_argument("--samples", type=int, default=500)
    parser.add_argument("--seed", type=int, default=20261031)
    parser.add_argument("--density", type=float, default=0.0, help="0なら既定の岩密度")
    parser.add_argument("--min-shortest", type=int, default=3)
    parser.add_argument("--targets", type=int, nargs="+", default=[6, 10, 14])
    parser.add_argument("--noise", type=float, default=0.10, help="G2で追加する岩の密度")
    parser.add_argument("--iterations", type=int, default=300, help="G3の反復回数")
    parser.add_argument("--variants", nargs="+", default=list(VARIANTS), choices=list(VARIANTS))
    parser.add_argument("--extra", type=float, default=0.06, help="床・穴・矢印の密度")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.samples < 1:
        raise SystemExit("--samples must be at least 1")
    suites: dict[str, Callable[[argparse.Namespace], None]] = {
        "density": run_density,
        "sizes": run_sizes,
        "quality": run_quality,
        "methods": run_methods,
        "variants": run_variants,
        "diversity": run_diversity,
        "deadends": run_deadends,
        "verify": run_verify,
        "examples": run_examples,
    }
    suites[args.suite](args)


if __name__ == "__main__":
    main()
