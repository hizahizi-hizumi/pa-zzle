from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from reflection_difficulty_constraints import (  # noqa: E402
    apply_candidate_consistency,
    clue_specs,
    independent_clue_supports,
    initial_domains,
    inventory_counts,
    propagate_without_assumption,
)
from reflection_supply_experiment import (  # noqa: E402
    ALL_TYPES,
    EMPTY,
    Domain,
    Domains,
    ExactReflectionSolver,
    Grid,
    Signature,
    all_pieces_influence_clues,
    puzzle_signature,
    random_grid,
    sample_inventory,
)


@dataclass(frozen=True)
class Analysis:
    status: str
    highest_level: int | None
    level_singletons: tuple[int, int, int, int, int]
    propagation_rounds: int
    assumption_tests: int
    assumption_eliminations: int
    unresolved_cells: int


@dataclass(frozen=True)
class CorpusRow:
    size: int
    item_count: int
    seed: int
    candidate_attempts: int
    exact_seconds: float
    analysis_seconds: float
    analysis: Analysis


def fixed_nonempty_count(domains: Domains) -> int:
    return sum(
        len(domain) == 1 and next(iter(domain)) != EMPTY
        for domain in domains
    )


def placement_complete(domains: Domains, required: Counter[int]) -> bool:
    fixed = Counter(
        next(iter(domain))
        for domain in domains
        if len(domain) == 1 and next(iter(domain)) != EMPTY
    )
    return all(
        fixed[piece] == count
        for piece, count in required.items()
        if piece != EMPTY
    )


def apply_direct_singletons(
    domains: Domains, supports: list[dict[int, Domain]]
) -> tuple[bool, Domains]:
    updated = list(domains)
    forced: dict[int, set[int]] = {}
    for clue_support in supports:
        for cell, pieces in clue_support.items():
            narrowed = domains[cell] & pieces
            if len(narrowed) == 1:
                forced.setdefault(cell, set()).update(narrowed)
    for cell, pieces in forced.items():
        if len(pieces) != 1:
            return False, domains
        updated[cell] = frozenset(pieces)
    return True, tuple(updated)


def solution_is_allowed(size: int, domains: Domains, solution: Grid) -> bool:
    return all(
        solution[row][col] in domains[row * size + col]
        for row in range(size)
        for col in range(size)
    )


def analyze_problem(
    size: int,
    inventory: tuple[int, ...],
    signature: Signature,
    expected_solution: Grid | None = None,
) -> Analysis:
    clues = clue_specs(size, signature)
    required = inventory_counts(size, inventory)
    initial = initial_domains(size, inventory)
    counts = [0, 0, 0, 0, 0]

    def assert_solution_allowed(domains: Domains) -> None:
        if expected_solution is not None and not solution_is_allowed(
            size, domains, expected_solution
        ):
            raise AssertionError("difficulty analysis eliminated the unique solution")

    feasible, independent = independent_clue_supports(size, initial, clues)
    if not feasible:
        return Analysis("contradiction", None, tuple(counts), 0, 0, 0, size * size)
    feasible, domains = apply_direct_singletons(initial, independent)
    if not feasible:
        return Analysis("contradiction", None, tuple(counts), 0, 0, 0, size * size)
    assert_solution_allowed(domains)
    counts[0] = fixed_nonempty_count(domains)
    if placement_complete(domains, required):
        return Analysis("analyzed", 1, tuple(counts), 0, 0, 0, 0)

    before = fixed_nonempty_count(domains)
    feasible, domains = apply_candidate_consistency(size, domains, clues)
    if not feasible:
        return Analysis("contradiction", None, tuple(counts), 0, 0, 0, size * size)
    assert_solution_allowed(domains)
    counts[1] = max(0, fixed_nonempty_count(domains) - before)
    if placement_complete(domains, required):
        return Analysis("analyzed", 2, tuple(counts), 1, 0, 0, 0)

    propagation_rounds = 1
    before = fixed_nonempty_count(domains)
    while True:
        previous = domains
        feasible, domains = apply_candidate_consistency(size, domains, clues)
        if not feasible:
            return Analysis(
                "contradiction", None, tuple(counts), propagation_rounds, 0, 0, size * size
            )
        assert_solution_allowed(domains)
        if domains == previous:
            break
        propagation_rounds += 1
        if placement_complete(domains, required):
            counts[2] = max(0, fixed_nonempty_count(domains) - before)
            return Analysis("analyzed", 3, tuple(counts), propagation_rounds, 0, 0, 0)
    counts[2] = max(0, fixed_nonempty_count(domains) - before)

    before = fixed_nonempty_count(domains)
    feasible, domains, rounds = propagate_without_assumption(
        size, domains, clues, required
    )
    propagation_rounds += rounds
    if not feasible:
        return Analysis(
            "contradiction", None, tuple(counts), propagation_rounds, 0, 0, size * size
        )
    assert_solution_allowed(domains)
    counts[3] = max(0, fixed_nonempty_count(domains) - before)
    if placement_complete(domains, required):
        return Analysis("analyzed", 4, tuple(counts), propagation_rounds, 0, 0, 0)

    assumption_tests = 0
    assumption_eliminations = 0
    before = fixed_nonempty_count(domains)
    while not placement_complete(domains, required):
        progress = False
        for cell, domain in enumerate(domains):
            if len(domain) <= 1:
                continue
            for piece in sorted(domain):
                assumption_tests += 1
                assumed = list(domains)
                assumed[cell] = frozenset({piece})
                feasible, _result, _rounds = propagate_without_assumption(
                    size, tuple(assumed), clues, required
                )
                if feasible:
                    continue
                narrowed = domains[cell] - {piece}
                if not narrowed:
                    return Analysis(
                        "contradiction",
                        None,
                        tuple(counts),
                        propagation_rounds,
                        assumption_tests,
                        assumption_eliminations,
                        size * size,
                    )
                mutable = list(domains)
                mutable[cell] = frozenset(narrowed)
                domains = tuple(mutable)
                assert_solution_allowed(domains)
                assumption_eliminations += 1
                progress = True
                break
            if progress:
                feasible, domains, rounds = propagate_without_assumption(
                    size, domains, clues, required
                )
                propagation_rounds += rounds
                if not feasible:
                    return Analysis(
                        "contradiction",
                        None,
                        tuple(counts),
                        propagation_rounds,
                        assumption_tests,
                        assumption_eliminations,
                        size * size,
                    )
                assert_solution_allowed(domains)
                break
        if not progress:
            break

    counts[4] = max(0, fixed_nonempty_count(domains) - before)
    unresolved = 0 if placement_complete(domains, required) else sum(
        1
        for domain in domains
        if len(domain) > 1 and any(piece != EMPTY for piece in domain)
    )
    if unresolved:
        return Analysis(
            "unsupported",
            None,
            tuple(counts),
            propagation_rounds,
            assumption_tests,
            assumption_eliminations,
            unresolved,
        )
    return Analysis(
        "analyzed",
        5,
        tuple(counts),
        propagation_rounds,
        assumption_tests,
        assumption_eliminations,
        0,
    )


def generate_unique_problem(
    size: int,
    item_count: int,
    rng: random.Random,
    timeout: float,
    inventory_mode: str,
) -> tuple[Grid, tuple[int, ...], Signature, float, int] | None:
    for attempt in range(1, 501):
        inventory = (
            tuple(rng.choice(ALL_TYPES[1:]) for _ in range(item_count))
            if inventory_mode == "random"
            else tuple(sample_inventory(item_count, rng))
        )
        grid = random_grid(size, inventory, rng)
        signature = puzzle_signature(grid)
        if signature is None or not all_pieces_influence_clues(grid):
            continue
        solver = ExactReflectionSolver(size, inventory, signature)
        solution_count, seconds = solver.count_solutions(timeout_seconds=timeout)
        if not solver.timed_out and solution_count == 1:
            return grid, inventory, signature, seconds, attempt
    return None


def run_corpus(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    rows: list[CorpusRow] = []
    for size, item_count in args.condition:
        accepted = 0
        while accepted < args.samples:
            problem_seed = rng.randrange(2**31)
            generated = generate_unique_problem(
                size,
                item_count,
                random.Random(problem_seed),
                args.timeout,
                args.inventory_mode,
            )
            if generated is None:
                print(f"{size}x{size}/{item_count}: generation_failed seed={problem_seed}")
                continue
            grid, inventory, signature, exact_seconds, attempts = generated
            started = time.perf_counter()
            analysis = analyze_problem(size, inventory, signature, grid)
            analysis_seconds = time.perf_counter() - started
            rows.append(
                CorpusRow(
                    size,
                    item_count,
                    problem_seed,
                    attempts,
                    exact_seconds,
                    analysis_seconds,
                    analysis,
                )
            )
            accepted += 1
            if not args.quiet:
                print(
                    f"{size}x{size}/{item_count} {accepted}/{args.samples}: "
                    f"status={analysis.status} level={analysis.highest_level} "
                    f"singletons={analysis.level_singletons} "
                    f"unresolved={analysis.unresolved_cells} "
                    f"assumptions={analysis.assumption_tests}/{analysis.assumption_eliminations} "
                    f"analysis={analysis_seconds:.4f}s"
                )

    analyzed = [row for row in rows if row.analysis.status == "analyzed"]
    levels = Counter(row.analysis.highest_level for row in analyzed)
    print("\nSUMMARY")
    print(f"total={len(rows)} analyzed={len(analyzed)} unsupported={len(rows)-len(analyzed)}")
    print("levels=" + " ".join(f"L{level}:{levels[level]}" for level in range(1, 6)))
    for size, item_count in args.condition:
        group = [row for row in rows if row.size == size and row.item_count == item_count]
        group_levels = Counter(
            row.analysis.highest_level for row in group if row.analysis.status == "analyzed"
        )
        times = [row.analysis_seconds for row in group]
        print(
            f"{size}x{size}/{item_count}: analyzed={sum(group_levels.values())}/{len(group)} "
            + " ".join(f"L{level}={group_levels[level]}" for level in range(1, 6))
            + f" analysis_median={statistics.median(times):.4f}s"
        )
    if args.json:
        Path(args.json).write_text(
            json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def parse_condition(value: str) -> tuple[int, int]:
    try:
        size_text, item_text = value.split("x", 1)
        size = int(size_text)
        item_count = int(item_text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "condition must be SIZE x ITEM_COUNT, e.g. 7x10"
        ) from exc
    if size < 2 or item_count < 1 or item_count >= size * size:
        raise argparse.ArgumentTypeError("invalid size/item count")
    return size, item_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition", action="append", type=parse_condition)
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--seed", type=int, default=20260928)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument(
        "--inventory-mode", choices=("random", "balanced"), default="random"
    )
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--json")
    args = parser.parse_args()
    if not args.condition:
        args.condition = [(5, 6), (6, 8), (7, 10)]
    return args


def main() -> None:
    args = parse_args()
    if args.samples < 1:
        raise SystemExit("--samples must be at least 1")
    if args.timeout <= 0:
        raise SystemExit("--timeout must be positive")
    run_corpus(args)


if __name__ == "__main__":
    main()
