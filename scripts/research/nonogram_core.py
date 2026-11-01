"""ノノグラムの研究用の共通部品。

1本の行・列の読み（線ソルバー）、盤面全体の伝播と難易度特徴、解の数え上げ、図柄の生成、同型の正規化を置く。
`nonogram_experiment.py` から使う。標準ライブラリだけで動く。
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass

UNKNOWN = -1
WHITE = 0
BLACK = 1

Clue = tuple[int, ...]
Line = tuple[int, ...]
Image = tuple[tuple[int, ...], ...]


def clue_of(cells: Sequence[int]) -> Clue:
    """黒の塊の長さを順に並べたヒント。黒が無い行は空の tuple。"""
    out: list[int] = []
    run = 0
    for value in cells:
        if value == BLACK:
            run += 1
        elif run:
            out.append(run)
            run = 0
    if run:
        out.append(run)
    return tuple(out)


def clues_of(image: Image) -> tuple[tuple[Clue, ...], tuple[Clue, ...]]:
    height = len(image)
    width = len(image[0])
    rows = tuple(clue_of(image[r]) for r in range(height))
    cols = tuple(clue_of([image[r][c] for r in range(height)]) for c in range(width))
    return rows, cols


# ---------------------------------------------------------------------------
# 1本の行・列の読み
# ---------------------------------------------------------------------------


def _block_starts(clue: Clue, line: Line) -> tuple[list[list[int]], list[bool]] | None:
    """各塊が置ける開始位置と、各マスが白になれるか（どちらも行全体が成り立つ置き方の中で）。成り立たなければ None。"""
    n = len(line)
    k = len(clue)
    # white_prefix[i]: line[0:i] にある白の数。black_prefix 同様。
    white_prefix = [0] * (n + 1)
    black_prefix = [0] * (n + 1)
    for i, value in enumerate(line):
        white_prefix[i + 1] = white_prefix[i] + (value == WHITE)
        black_prefix[i + 1] = black_prefix[i] + (value == BLACK)

    def no_white(start: int, end: int) -> bool:
        return white_prefix[end] - white_prefix[start] == 0

    def no_black(start: int, end: int) -> bool:
        return black_prefix[end] - black_prefix[start] == 0

    # forward[j][i]: line[0:i] に塊 0..j-1 を収め、残りを白にできる（塊 j-1 の直後の区切りは i 以降）。
    forward = [[False] * (n + 1) for _ in range(k + 1)]
    for i in range(n + 1):
        forward[0][i] = no_black(0, i)
    for j in range(1, k + 1):
        length = clue[j - 1]
        row = forward[j]
        prev = forward[j - 1]
        for i in range(n + 1):
            ok = i > 0 and row[i - 1] and line[i - 1] != BLACK
            if not ok and i >= length:
                start = i - length
                if no_white(start, i):
                    if start == 0:
                        ok = j == 1
                    else:
                        ok = line[start - 1] != BLACK and prev[start - 1]
            row[i] = ok
    if not forward[k][n]:
        return None
    # backward[j][i]: line[i:n] に塊 j..k-1 を収められる。
    backward = [[False] * (n + 1) for _ in range(k + 1)]
    for i in range(n + 1):
        backward[k][i] = no_black(i, n)
    for j in range(k - 1, -1, -1):
        length = clue[j]
        row = backward[j]
        nxt = backward[j + 1]
        for i in range(n, -1, -1):
            ok = i < n and row[i + 1] and line[i] != BLACK
            if not ok and i + length <= n and no_white(i, i + length):
                end = i + length
                if end == n:
                    ok = j == k - 1
                else:
                    ok = line[end] != BLACK and nxt[end + 1]
            row[i] = ok
    starts: list[list[int]] = []
    for j, length in enumerate(clue):
        possible: list[int] = []
        for s in range(0, n - length + 1):
            if not no_white(s, s + length):
                continue
            if s == 0:
                left = j == 0
            else:
                left = line[s - 1] != BLACK and forward[j][s - 1]
            if not left:
                continue
            end = s + length
            if end == n:
                right = j == k - 1
            else:
                right = line[end] != BLACK and backward[j + 1][end + 1]
            if right:
                possible.append(s)
        starts.append(possible)
    # マス i が白になれる ⇔ ある j で、line[0:i] に塊 0..j-1、line[i+1:n] に塊 j..k-1 を収められる。
    can_white = [
        line[i] != BLACK and any(forward[j][i] and backward[j][i + 1] for j in range(k + 1)) for i in range(n)
    ]
    return starts, can_white


_FULL_CACHE: dict[tuple[Clue, Line], Line | None] = {}
_LR_CACHE: dict[tuple[Clue, Line], Line | None] = {}


def solve_line_full(clue: Clue, line: Line) -> Line | None:
    """1本の行・列だけを読んで確定できるマスをすべて確定させる（完全な線の読み）。矛盾なら None。"""
    key = (clue, line)
    if key in _FULL_CACHE:
        return _FULL_CACHE[key]
    n = len(line)
    tables = _block_starts(clue, line)
    if tables is None:
        _FULL_CACHE[key] = None
        return None
    starts, can_white = tables
    can_black = [0] * (n + 1)
    for j, length in enumerate(clue):
        for s in starts[j]:
            can_black[s] += 1
            can_black[s + length] -= 1
    covered = 0
    result = list(line)
    for i in range(n):
        covered += can_black[i]
        if line[i] != UNKNOWN:
            continue
        b = covered > 0
        w = can_white[i]
        if b and not w:
            result[i] = BLACK
        elif w and not b:
            result[i] = WHITE
        elif not b and not w:
            _FULL_CACHE[key] = None
            return None
    out = tuple(result)
    _FULL_CACHE[key] = out
    return out


def solve_line_lr(clue: Clue, line: Line) -> Line | None:
    """左詰めと右詰めの重なりの読み（端寄せの読み）。

    各塊の最も左の位置と最も右の位置を求め、重なるマスを黒、どの塊の届く範囲にも入らないマスを白にする。
    完全な線の読みより弱い。矛盾なら None。
    """
    key = (clue, line)
    if key in _LR_CACHE:
        return _LR_CACHE[key]
    n = len(line)
    tables = _block_starts(clue, line)
    if tables is None:
        _LR_CACHE[key] = None
        return None
    starts = tables[0]
    result = list(line)
    reach = [False] * n
    for j, length in enumerate(clue):
        lo = starts[j][0]
        hi = starts[j][-1]
        for i in range(lo, hi + length):
            reach[i] = True
        for i in range(hi, lo + length):
            if result[i] == UNKNOWN:
                result[i] = BLACK
    for i in range(n):
        if not reach[i] and result[i] == UNKNOWN:
            result[i] = WHITE
    out = tuple(result)
    _LR_CACHE[key] = out
    return out


# ---------------------------------------------------------------------------
# 盤面全体
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Puzzle:
    height: int
    width: int
    rows: tuple[Clue, ...]
    cols: tuple[Clue, ...]

    @staticmethod
    def from_image(image: Image) -> "Puzzle":
        rows, cols = clues_of(image)
        return Puzzle(len(image), len(image[0]), rows, cols)


Grid = list[list[int]]


def empty_grid(puzzle: Puzzle) -> Grid:
    return [[UNKNOWN] * puzzle.width for _ in range(puzzle.height)]


def _row(grid: Grid, r: int) -> Line:
    return tuple(grid[r])


def _col(grid: Grid, c: int) -> Line:
    return tuple(row[c] for row in grid)


def apply_line(puzzle: Puzzle, grid: Grid, axis: int, index: int, solver) -> int | None:
    """1本を読み、新しく決まったマスの数を返す。矛盾なら None。"""
    if axis == 0:
        line = _row(grid, index)
        solved = solver(puzzle.rows[index], line)
    else:
        line = _col(grid, index)
        solved = solver(puzzle.cols[index], line)
    if solved is None:
        return None
    changed = 0
    for i, value in enumerate(solved):
        if line[i] == UNKNOWN and value != UNKNOWN:
            changed += 1
            if axis == 0:
                grid[index][i] = value
            else:
                grid[i][index] = value
    return changed


def propagate(puzzle: Puzzle, grid: Grid, solver=solve_line_full) -> bool:
    """固定点まで行・列を読む。矛盾なら False。"""
    dirty_rows = set(range(puzzle.height))
    dirty_cols = set(range(puzzle.width))
    while dirty_rows or dirty_cols:
        while dirty_rows:
            r = dirty_rows.pop()
            before = _row(grid, r)
            if apply_line(puzzle, grid, 0, r, solver) is None:
                return False
            for c in range(puzzle.width):
                if before[c] != grid[r][c]:
                    dirty_cols.add(c)
        while dirty_cols:
            c = dirty_cols.pop()
            before = _col(grid, c)
            if apply_line(puzzle, grid, 1, c, solver) is None:
                return False
            for r in range(puzzle.height):
                if before[r] != grid[r][c]:
                    dirty_rows.add(r)
    return True


def is_complete(grid: Grid) -> bool:
    return all(value != UNKNOWN for row in grid for value in row)


def count_solutions(puzzle: Puzzle, limit: int = 2, node_limit: int = 20000) -> tuple[int, int, bool]:
    """解を limit 個まで数える。(解の数, 探索した節点数, 打ち切ったか)。

    節点は「伝播してから1マスを仮に決める」1回。打ち切りは移植でも同じ数え方で揃えること。
    """
    nodes = 0
    found = 0
    aborted = False

    def search(grid: Grid) -> None:
        nonlocal nodes, found, aborted
        if found >= limit or aborted:
            return
        nodes += 1
        if nodes > node_limit:
            aborted = True
            return
        if not propagate(puzzle, grid):
            return
        if is_complete(grid):
            found += 1
            return
        # 行優先で最初の未確定マスを黒・白に分ける。
        target = None
        for r in range(puzzle.height):
            for c in range(puzzle.width):
                if grid[r][c] == UNKNOWN:
                    target = (r, c)
                    break
            if target:
                break
        assert target is not None
        r, c = target
        for value in (BLACK, WHITE):
            child = [row[:] for row in grid]
            child[r][c] = value
            search(child)

    search(empty_grid(puzzle))
    return found, nodes, aborted


@dataclass(frozen=True)
class Features:
    """仮置きなしの読みで解いたときの難易度特徴。"""

    solvable: bool
    rounds: int  # 連鎖の深さ: 読める行・列をすべて同時に読む「段」を何段重ねたら解けるか
    entry_lines: int  # 最初の段で進められる行・列の数
    first_round_ratio: float  # 最初の段で決まるマスの割合
    min_progress_lines: int  # 各段で進められる行・列の数の最小
    narrow_rounds: int  # 進められる行・列が2本以下の段の数
    narrow_ratio: float  # narrow_rounds / rounds
    full_only_lines: int  # 端寄せの読みでは進まず、完全な線の読みで初めて進む行・列の読みの回数
    area: int
    max_clue_count_row: int
    max_clue_count_col: int


def analyze(puzzle: Puzzle) -> Features:
    """段ごとに同時に読む伝播で特徴を測る。読みの順序に依らない。"""
    grid = empty_grid(puzzle)
    total = puzzle.height * puzzle.width
    rounds = 0
    entry_lines = 0
    first_fixed = 0
    min_progress = 10**9
    narrow = 0
    while not is_complete(grid):
        updates: list[tuple[int, int, int]] = []
        progressed = 0
        for axis, count in ((0, puzzle.height), (1, puzzle.width)):
            for index in range(count):
                line = _row(grid, index) if axis == 0 else _col(grid, index)
                if UNKNOWN not in line:
                    continue
                clue = puzzle.rows[index] if axis == 0 else puzzle.cols[index]
                solved = solve_line_full(clue, line)
                if solved is None:
                    raise ValueError("contradiction in a consistent puzzle")
                new = [(i, v) for i, v in enumerate(solved) if line[i] == UNKNOWN and v != UNKNOWN]
                if not new:
                    continue
                progressed += 1
                for i, v in new:
                    if axis == 0:
                        updates.append((index, i, v))
                    else:
                        updates.append((i, index, v))
        if progressed == 0:
            return Features(False, rounds, entry_lines, first_fixed / total, min_progress, narrow, 0.0, 0, total,
                            max(len(c) for c in puzzle.rows), max(len(c) for c in puzzle.cols))
        rounds += 1
        changed = 0
        for r, c, v in updates:
            if grid[r][c] == UNKNOWN:
                grid[r][c] = v
                changed += 1
        if rounds == 1:
            entry_lines = progressed
            first_fixed = changed
        min_progress = min(min_progress, progressed)
        if progressed <= 2:
            narrow += 1
    return Features(
        True,
        rounds,
        entry_lines,
        first_fixed / total,
        min_progress if rounds else 0,
        narrow,
        narrow / rounds if rounds else 0.0,
        count_full_only_lines(puzzle),
        total,
        max(len(c) for c in puzzle.rows),
        max(len(c) for c in puzzle.cols),
    )


def count_full_only_lines(puzzle: Puzzle) -> int:
    """端寄せの読みを固定点まで進め、止まったら完全な線の読みを1本だけ使う。その回数。"""
    grid = empty_grid(puzzle)
    uses = 0
    while True:
        if not propagate(puzzle, grid, solve_line_lr):
            raise ValueError("contradiction")
        if is_complete(grid):
            return uses
        progressed = False
        for axis, count in ((0, puzzle.height), (1, puzzle.width)):
            for index in range(count):
                changed = apply_line(puzzle, grid, axis, index, solve_line_full)
                if changed:
                    uses += 1
                    progressed = True
                    break
            if progressed:
                break
        if not progressed:
            return -1


def line_solvable(puzzle: Puzzle) -> bool:
    """仮置きなしで（1本ずつの完全な線の読みだけで）最後まで解けるか。解けるなら解は一意。"""
    grid = empty_grid(puzzle)
    return propagate(puzzle, grid) and is_complete(grid)


# ---------------------------------------------------------------------------
# 図柄の生成
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PatternParams:
    density: float  # 平滑化前に黒にする確率
    smooth: int  # 多数決で平滑化する回数
    mirror: bool  # 左右対称にする

    def key(self) -> str:
        return f"d{self.density:.2f}-s{self.smooth}-{'m' if self.mirror else 'n'}"


def _smooth(cells: list[list[int]], height: int, width: int) -> list[list[int]]:
    out = [[0] * width for _ in range(height)]
    for r in range(height):
        for c in range(width):
            black = 0
            total = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    rr = r + dr
                    cc = c + dc
                    if 0 <= rr < height and 0 <= cc < width:
                        black += cells[rr][cc]
                        total += 1
            if black * 2 > total:
                out[r][c] = 1
            elif black * 2 < total:
                out[r][c] = 0
            else:
                out[r][c] = cells[r][c]
    return out


def generate_pattern(height: int, width: int, params: PatternParams, rng: random.Random) -> Image:
    """図柄の候補。無作為の黒を置き、左右対称にし、多数決で平滑化して塊のまとまりを作る。"""
    half = (width + 1) // 2 if params.mirror else width
    cells = [[1 if rng.random() < params.density else 0 for _ in range(half)] for _ in range(height)]
    if params.mirror:
        cells = [row + row[: width - half][::-1] for row in cells]
    for _ in range(params.smooth):
        cells = _smooth(cells, height, width)
    return tuple(tuple(row) for row in cells)


def symmetry_variants(image: Image) -> list[Image]:
    height = len(image)
    width = len(image[0])
    variants = [
        image,
        tuple(tuple(row[::-1]) for row in image),
        tuple(image[::-1]),
        tuple(tuple(row[::-1]) for row in image[::-1]),
    ]
    if height == width:
        transposed = tuple(tuple(image[r][c] for r in range(height)) for c in range(width))
        variants += [
            transposed,
            tuple(tuple(row[::-1]) for row in transposed),
            tuple(transposed[::-1]),
            tuple(tuple(row[::-1]) for row in transposed[::-1]),
        ]
    return variants


def canonical_key(image: Image) -> str:
    """回転・反転で重なる図柄を同じとみなす正規化キー。"""
    return min("/".join("".join(str(v) for v in row) for row in variant) for variant in symmetry_variants(image))


@dataclass(frozen=True)
class PatternQuality:
    black_ratio: float
    blank_rows: int
    blank_cols: int
    isolated_ratio: float  # 上下左右に黒の無い黒マスの割合
    components: int  # 上下左右でつながる黒の塊の数
    mirror_symmetric: bool


def pattern_quality(image: Image) -> PatternQuality:
    height = len(image)
    width = len(image[0])
    black = [(r, c) for r in range(height) for c in range(width) if image[r][c]]
    isolated = 0
    for r, c in black:
        if not any(
            0 <= r + dr < height and 0 <= c + dc < width and image[r + dr][c + dc]
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
        ):
            isolated += 1
    seen: set[tuple[int, int]] = set()
    components = 0
    for cell in black:
        if cell in seen:
            continue
        components += 1
        stack = [cell]
        seen.add(cell)
        while stack:
            r, c = stack.pop()
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < height and 0 <= cc < width and image[rr][cc] and (rr, cc) not in seen:
                    seen.add((rr, cc))
                    stack.append((rr, cc))
    return PatternQuality(
        black_ratio=len(black) / (height * width),
        blank_rows=sum(1 for row in image if not any(row)),
        blank_cols=sum(1 for c in range(width) if not any(image[r][c] for r in range(height))),
        isolated_ratio=isolated / len(black) if black else 0.0,
        components=components,
        mirror_symmetric=all(tuple(row) == tuple(row[::-1]) for row in image),
    )
