from __future__ import annotations

import argparse
import random
import statistics
import time
from collections import Counter
from collections.abc import Iterator, Sequence
from dataclasses import dataclass

EMPTY = 0
SLASH = 1
BACKSLASH = 2
VERTICAL_DOUBLE = 3
HORIZONTAL_DOUBLE = 4
SQUARE_REFLECTOR = 5
BLACK_HOLE = 6

TRANSITIONS = {
    EMPTY: (0, 1, 2, 3),
    SLASH: (1, 0, 3, 2),
    BACKSLASH: (3, 2, 1, 0),
    VERTICAL_DOUBLE: (0, 3, 2, 1),
    HORIZONTAL_DOUBLE: (2, 1, 0, 3),
    SQUARE_REFLECTOR: (2, 3, 0, 1),
    BLACK_HOLE: (-1, -1, -1, -1),
}
ROW_STEP = (-1, 0, 1, 0)
COL_STEP = (0, 1, 0, -1)
ALL_TYPES = tuple(TRANSITIONS)
TRANSITION_TYPES = {
    (incoming, outgoing): frozenset(
        piece for piece in ALL_TYPES if TRANSITIONS[piece][incoming] == outgoing
    )
    for incoming in range(4)
    for outgoing in (-1, 0, 1, 2, 3)
}

Grid = tuple[tuple[int, ...], ...]
Clue = tuple[str, int]
Signature = tuple[Clue, ...]
Domain = frozenset[int]
Domains = tuple[Domain, ...]


def entry_state(size: int, side: int, index: int) -> tuple[int, int, int]:
    if side == 0:
        return 0, index, 2
    if side == 1:
        return index, size - 1, 3
    if side == 2:
        return size - 1, index, 0
    return index, 0, 1


def exit_position(size: int, row: int, col: int) -> tuple[int, int] | None:
    if row < 0:
        return 0, col
    if row >= size:
        return 2, col
    if col < 0:
        return 3, row
    if col >= size:
        return 1, row
    return None


def trace_laser(grid: Grid, side: int, index: int) -> Clue | None:
    size = len(grid)
    row, col, direction = entry_state(size, side, index)
    distance = 1
    visited: set[tuple[int, int, int]] = set()

    while True:
        state = (row, col, direction)
        if state in visited:
            return None
        visited.add(state)

        next_direction = TRANSITIONS[grid[row][col]][direction]
        if next_direction < 0:
            return "a", distance

        row += ROW_STEP[next_direction]
        col += COL_STEP[next_direction]
        exit_at = exit_position(size, row, col)
        if exit_at is not None:
            outcome = "r" if exit_at == (side, index) else "s"
            return outcome, distance

        direction = next_direction
        distance += 1


def puzzle_signature(grid: Grid) -> Signature | None:
    size = len(grid)
    clues: list[Clue] = []
    for side in range(4):
        for index in range(size):
            clue = trace_laser(grid, side, index)
            if clue is None:
                return None
            clues.append(clue)
    return tuple(clues)


def random_grid(size: int, inventory: Sequence[int], rng: random.Random) -> Grid:
    cells = [EMPTY] * (size * size)
    for position, piece in zip(
        rng.sample(range(size * size), len(inventory)), inventory, strict=True
    ):
        cells[position] = piece
    return tuple(
        tuple(cells[row * size : (row + 1) * size]) for row in range(size)
    )


def all_pieces_influence_clues(grid: Grid) -> bool:
    expected = puzzle_signature(grid)
    if expected is None:
        return False

    mutable = [list(row) for row in grid]
    size = len(grid)
    for row in range(size):
        for col in range(size):
            piece = mutable[row][col]
            if piece == EMPTY:
                continue
            mutable[row][col] = EMPTY
            removed = tuple(tuple(current_row) for current_row in mutable)
            if puzzle_signature(removed) == expected:
                mutable[row][col] = piece
                return False
            mutable[row][col] = piece
    return True


def sample_inventory(
    item_count: int, rng: random.Random, movable_types: Sequence[int] = ALL_TYPES[1:]
) -> list[int]:
    required = [
        piece
        for piece in (SLASH, BACKSLASH, VERTICAL_DOUBLE, HORIZONTAL_DOUBLE)
        if piece in movable_types
    ]
    inventory = required[:item_count]
    while len(inventory) < item_count:
        inventory.append(rng.choice(movable_types))
    rng.shuffle(inventory)
    return inventory


class ExactReflectionSolver:
    def __init__(self, size: int, inventory: Sequence[int], signature: Signature):
        self.size = size
        self.signature = signature
        self.counts = Counter(inventory)
        self.counts[EMPTY] = size * size - len(inventory)
        allowed = frozenset(piece for piece, count in self.counts.items() if count > 0)
        self.initial_domains: Domains = tuple(allowed for _ in range(size * size))
        result_rank = {"r": 0, "a": 1, "s": 2}
        self.clues = [
            (side, index, *signature[side * size + index])
            for side in range(4)
            for index in range(size)
        ]
        self.clues.sort(key=lambda clue: (clue[3], result_rank[clue[2]]))
        self.solutions: list[Grid] = []
        self.timed_out = False

    def inventory_is_feasible(self, domains: Domains) -> bool:
        fixed = Counter()
        possible = Counter()
        for domain in domains:
            if len(domain) == 1:
                fixed[next(iter(domain))] += 1
            for piece in domain:
                possible[piece] += 1
        return all(
            fixed[piece] <= count <= possible[piece]
            for piece, count in self.counts.items()
        )

    def clue_paths(
        self, domains: Domains, clue: tuple[int, int, str, int]
    ) -> Iterator[dict[int, Domain]]:
        side, index, outcome, target_distance = clue
        start_row, start_col, start_direction = entry_state(self.size, side, index)

        def visit(
            row: int,
            col: int,
            direction: int,
            distance: int,
            changes: dict[int, Domain],
        ) -> Iterator[dict[int, Domain]]:
            cell = row * self.size + col
            current_domain = changes.get(cell, domains[cell])
            outgoing_directions = (
                (-1,)
                if outcome == "a" and distance == target_distance
                else (0, 1, 2, 3)
            )

            for next_direction in outgoing_directions:
                allowed = current_domain & TRANSITION_TYPES[(direction, next_direction)]
                if not allowed:
                    continue

                next_changes = changes
                if allowed != current_domain:
                    next_changes = changes.copy()
                    next_changes[cell] = allowed

                if next_direction < 0:
                    if distance == target_distance and outcome == "a":
                        yield next_changes
                    continue

                next_row = row + ROW_STEP[next_direction]
                next_col = col + COL_STEP[next_direction]
                exit_at = exit_position(self.size, next_row, next_col)
                if exit_at is not None:
                    if distance != target_distance or outcome == "a":
                        continue
                    actual_outcome = "r" if exit_at == (side, index) else "s"
                    if actual_outcome == outcome:
                        yield next_changes
                    continue

                if distance < target_distance:
                    yield from visit(
                        next_row,
                        next_col,
                        next_direction,
                        distance + 1,
                        next_changes,
                    )

        yield from visit(start_row, start_col, start_direction, 1, {})

    @staticmethod
    def apply_changes(domains: Domains, changes: dict[int, Domain]) -> Domains:
        updated = list(domains)
        for index, domain in changes.items():
            updated[index] = domain
        return tuple(updated)

    def complete_assignments(self, domains: Domains, limit: int) -> Iterator[Grid]:
        remaining = dict(self.counts)
        assignment: list[int | None] = [None] * len(domains)
        variable_cells: list[int] = []

        for index, domain in enumerate(domains):
            if len(domain) == 1:
                piece = next(iter(domain))
                assignment[index] = piece
                remaining[piece] -= 1
                if remaining[piece] < 0:
                    return
            else:
                variable_cells.append(index)

        found = 0

        def assign(cells: list[int]) -> Iterator[Grid]:
            nonlocal found
            if found >= limit:
                return
            if not cells:
                if all(count == 0 for count in remaining.values()):
                    grid = tuple(
                        tuple(
                            int(piece)
                            for piece in assignment[
                                row * self.size : (row + 1) * self.size
                            ]
                        )
                        for row in range(self.size)
                    )
                    if puzzle_signature(grid) == self.signature:
                        found += 1
                        yield grid
                return

            best_offset = min(
                range(len(cells)),
                key=lambda offset: sum(
                    remaining.get(piece, 0) > 0
                    for piece in domains[cells[offset]]
                ),
            )
            cell = cells[best_offset]
            rest = cells[:best_offset] + cells[best_offset + 1 :]

            for piece in domains[cell]:
                if remaining.get(piece, 0) <= 0:
                    continue
                assignment[cell] = piece
                remaining[piece] -= 1
                feasible = all(
                    count >= 0
                    and (
                        count == 0
                        or sum(piece_type in domains[index] for index in rest) >= count
                    )
                    for piece_type, count in remaining.items()
                )
                if feasible:
                    yield from assign(rest)
                remaining[piece] += 1
                assignment[cell] = None
                if found >= limit:
                    return

        yield from assign(variable_cells)

    def count_solutions(
        self, limit: int = 2, timeout_seconds: float = 5.0
    ) -> tuple[int, float]:
        started = time.perf_counter()

        def search(clue_index: int, domains: Domains) -> None:
            if len(self.solutions) >= limit:
                return
            if time.perf_counter() - started > timeout_seconds:
                raise TimeoutError
            if clue_index == len(self.clues):
                for solution in self.complete_assignments(
                    domains, limit - len(self.solutions)
                ):
                    if solution not in self.solutions:
                        self.solutions.append(solution)
                return

            seen_domains: set[Domains] = set()
            for changes in self.clue_paths(domains, self.clues[clue_index]):
                next_domains = self.apply_changes(domains, changes)
                if next_domains in seen_domains:
                    continue
                seen_domains.add(next_domains)
                if self.inventory_is_feasible(next_domains):
                    search(clue_index + 1, next_domains)
                if len(self.solutions) >= limit:
                    return

        try:
            search(0, self.initial_domains)
        except TimeoutError:
            self.timed_out = True
        return len(self.solutions), time.perf_counter() - started


@dataclass(frozen=True)
class SampleResult:
    solution_count: int
    seconds: float
    timed_out: bool


def percentile(values: Sequence[float], percentile_value: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * percentile_value
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def collect_supply_samples(
    size: int,
    item_count: int,
    samples: int,
    seed: int,
    timeout_seconds: float,
    movable_types: Sequence[int] = ALL_TYPES[1:],
) -> tuple[list[SampleResult], int]:
    rng = random.Random(seed)
    results: list[SampleResult] = []
    attempts = 0
    while len(results) < samples and attempts < samples * 100:
        attempts += 1
        inventory = sample_inventory(item_count, rng, movable_types)
        grid = random_grid(size, inventory, rng)
        signature = puzzle_signature(grid)
        if signature is None or not all_pieces_influence_clues(grid):
            continue
        solver = ExactReflectionSolver(size, inventory, signature)
        count, seconds = solver.count_solutions(timeout_seconds=timeout_seconds)
        results.append(SampleResult(count, seconds, solver.timed_out))
    return results, attempts


def piece_name(piece: int) -> str:
    return {
        EMPTY: ".",
        SLASH: "/",
        BACKSLASH: "\\",
        VERTICAL_DOUBLE: "||",
        HORIZONTAL_DOUBLE: "=",
        SQUARE_REFLECTOR: "square",
        BLACK_HOLE: "black-hole",
    }[piece]


def summarize_supply(
    size: int, item_count: int, results: Sequence[SampleResult], attempts: int
) -> None:
    durations = [result.seconds for result in results]
    unique = sum(
        result.solution_count == 1 and not result.timed_out for result in results
    )
    multiple = sum(
        result.solution_count >= 2 and not result.timed_out for result in results
    )
    timed_out = sum(result.timed_out for result in results)
    print(
        f"{size}x{size}/{item_count}: accepted={len(results)}/{attempts} "
        f"unique={unique} multiple={multiple} timeout={timed_out} "
        f"median={statistics.median(durations):.4f}s "
        f"p90={percentile(durations, 0.9):.4f}s max={max(durations):.4f}s"
    )


def run_supply(args: argparse.Namespace) -> None:
    configurations = (
        (5, 6),
        (5, 8),
        (6, 8),
        (6, 10),
        (7, 8),
        (7, 10),
        (7, 12),
        (8, 8),
        (8, 10),
    )
    for size, item_count in configurations:
        results, attempts = collect_supply_samples(
            size,
            item_count,
            args.samples,
            args.seed + size * 100 + item_count,
            args.timeout,
        )
        summarize_supply(size, item_count, results, attempts)


def run_variants(args: argparse.Namespace) -> None:
    variants = (
        ("core", (SLASH, BACKSLASH, VERTICAL_DOUBLE, HORIZONTAL_DOUBLE)),
        (
            "square",
            (SLASH, BACKSLASH, VERTICAL_DOUBLE, HORIZONTAL_DOUBLE, SQUARE_REFLECTOR),
        ),
        (
            "black-hole",
            (SLASH, BACKSLASH, VERTICAL_DOUBLE, HORIZONTAL_DOUBLE, BLACK_HOLE),
        ),
        ("all", ALL_TYPES[1:]),
    )
    for offset, (name, movable_types) in enumerate(variants):
        results, attempts = collect_supply_samples(
            7,
            10,
            args.samples,
            args.seed + offset,
            args.timeout,
            movable_types,
        )
        print(f"{name}: types={','.join(piece_name(piece) for piece in movable_types)}")
        summarize_supply(7, 10, results, attempts)


def rotate_clockwise(grid: Grid) -> Grid:
    type_rotation = {
        EMPTY: EMPTY,
        SLASH: BACKSLASH,
        BACKSLASH: SLASH,
        VERTICAL_DOUBLE: HORIZONTAL_DOUBLE,
        HORIZONTAL_DOUBLE: VERTICAL_DOUBLE,
        SQUARE_REFLECTOR: SQUARE_REFLECTOR,
        BLACK_HOLE: BLACK_HOLE,
    }
    size = len(grid)
    return tuple(
        tuple(type_rotation[grid[size - 1 - col][row]] for col in range(size))
        for row in range(size)
    )


def mirror_left_right(grid: Grid) -> Grid:
    type_mirror = {
        EMPTY: EMPTY,
        SLASH: BACKSLASH,
        BACKSLASH: SLASH,
        VERTICAL_DOUBLE: VERTICAL_DOUBLE,
        HORIZONTAL_DOUBLE: HORIZONTAL_DOUBLE,
        SQUARE_REFLECTOR: SQUARE_REFLECTOR,
        BLACK_HOLE: BLACK_HOLE,
    }
    return tuple(
        tuple(type_mirror[piece] for piece in reversed(row)) for row in grid
    )


def serialize_grid(grid: Grid) -> tuple[int, ...]:
    return tuple(piece for row in grid for piece in row)


def canonical_grid(grid: Grid) -> tuple[int, ...]:
    rotations = [grid]
    for _ in range(3):
        rotations.append(rotate_clockwise(rotations[-1]))
    transforms = rotations + [mirror_left_right(current) for current in rotations]
    return min(serialize_grid(current) for current in transforms)


def run_diversity(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    clue_signatures: set[Signature] = set()
    canonical_grids: set[tuple[int, ...]] = set()
    clue_duplicates = 0
    symmetry_duplicates = 0
    accepted = 0
    attempts = 0
    durations: list[float] = []

    while accepted < args.samples and attempts < args.samples * 100:
        attempts += 1
        inventory = sample_inventory(10, rng)
        grid = random_grid(7, inventory, rng)
        signature = puzzle_signature(grid)
        if signature is None or not all_pieces_influence_clues(grid):
            continue
        solver = ExactReflectionSolver(7, inventory, signature)
        solution_count, seconds = solver.count_solutions(timeout_seconds=args.timeout)
        if solver.timed_out or solution_count != 1:
            continue

        accepted += 1
        durations.append(seconds)
        if signature in clue_signatures:
            clue_duplicates += 1
        clue_signatures.add(signature)
        canonical = canonical_grid(grid)
        if canonical in canonical_grids:
            symmetry_duplicates += 1
        canonical_grids.add(canonical)

    print(
        f"7x7/10: unique_accepted={accepted}/{attempts} "
        f"clue_duplicates={clue_duplicates} symmetry_duplicates={symmetry_duplicates} "
        f"median={statistics.median(durations):.4f}s "
        f"p90={percentile(durations, 0.9):.4f}s"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("suite", choices=("supply", "variants", "diversity"))
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--seed", type=int, default=20260928)
    parser.add_argument("--timeout", type=float, default=5.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.samples < 1:
        raise SystemExit("--samples must be at least 1")
    if args.timeout <= 0:
        raise SystemExit("--timeout must be positive")
    if args.suite == "supply":
        run_supply(args)
    elif args.suite == "variants":
        run_variants(args)
    else:
        run_diversity(args)


if __name__ == "__main__":
    main()
