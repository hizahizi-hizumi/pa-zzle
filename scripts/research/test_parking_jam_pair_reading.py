"""Checks the remaining-set pair search against the rule-lab state model and the structural claims.

The explicit model keeps the rule-lab state (remaining ids, ordered waiting ids),
settles departures by color like `settlePairs`, and searches exit sequences
without compression.
"""
from __future__ import annotations

import random
from functools import lru_cache

import pytest
from parking_jam_dispatch_reading import OPENINGS_BY_NAME, generate_board
from parking_jam_pair_reading import (
    ExplicitPairGame,
    GroupGame,
    PairProblem,
    PairReading,
    group_colors,
    minimum_bays,
)

BAYS = (2, 3, 4)


def sample_problems(seed: int, count: int, per_color: int, group: int | None, cars) -> list[PairProblem]:
    rng = random.Random(seed)
    problems = []
    while len(problems) < count:
        openings = OPENINGS_BY_NAME[rng.choice(sorted(OPENINGS_BY_NAME))]
        n = rng.choice(cars)
        board = generate_board(rng, n, 6, openings)
        problems.append(PairProblem(board, 6, openings, group_colors(rng, n, per_color), group))
    return problems


def explicit_search(problem: PairProblem, bays: int) -> tuple[int, dict[int, set[int]]]:
    """(complete exit sequences, waiting counts seen for each remaining mask) on explicit states."""
    game = ExplicitPairGame(problem.sides, problem.colors, bays, problem.group)
    waiting_counts: dict[int, set[int]] = {}

    @lru_cache(None)
    def count(state) -> int:
        waiting_counts.setdefault(sum(1 << i for i in state[0]), set()).add(len(state[1]))
        if game.won(state):
            return 1
        return sum(count(game.step(state, i)) for i in game.moves(state))

    return count(game.start), waiting_counts


def explicit_minimum_bays(problem: PairProblem) -> int | None:
    return next((bays for bays in range(1, len(problem.colors) + 1) if explicit_search(problem, bays)[0]), None)


def compressed_mismatches(problems: list[PairProblem]) -> list[str]:
    found = []
    for index, problem in enumerate(problems):
        for bays in BAYS:
            game = problem.game(bays)
            total, waiting_counts = explicit_search(problem, bays)
            if game.solution_count() != total:
                found.append(f"{index}/{bays}: solutions {game.solution_count()} != {total}")
            for mask, counts in waiting_counts.items():
                if counts != {game.waiting(mask)}:
                    found.append(f"{index}/{bays}: waiting {counts} at {mask}")
        if minimum_bays(problem.sides, problem.colors, problem.group) != explicit_minimum_bays(problem):
            found.append(f"{index}: minimum bays")
    return found


def losing_free_actions(game: GroupGame) -> list[int]:
    lost = []
    for mask in range(1, game.full + 1):
        if not game.alive(mask) or not game.wins(mask):
            continue
        for run in game.free_actions(mask):
            after = mask
            for car in run:
                after &= ~(1 << car)
            if not game.wins(after):
                lost.append(mask)
    return lost


@pytest.fixture
def pair_problems() -> list[PairProblem]:
    return sample_problems(7402, 60, 2, None, (8,))


@pytest.mark.parametrize(
    ("per_color", "group"),
    [(2, None), (3, None), (4, 2)],
    ids=["同色2台がそろうと出発する", "同色3台がそろうと出発する", "同色4台のうち2台がそろうと出発する"],
)
def test_残存集合だけの探索が待機列を順序つきで持つ全探索と一致すること(per_color: int, group: int | None) -> None:
    problems = sample_problems(740 + per_color, 30, per_color, group, (6, 8))

    mismatches = compressed_mismatches(problems)

    assert mismatches == []


def test_1色を他の色を待たせずに片付ける手は勝てる局面を負けにしないこと(pair_problems: list[PairProblem]) -> None:
    lost = [mask for problem in pair_problems for bays in BAYS for mask in losing_free_actions(problem.game(bays))]

    assert lost == []


def test_2枠では読み手の判断局面が無いこと(pair_problems: list[PairProblem]) -> None:
    decisions = [PairReading(p.game(2)).summary()["decisions"] for p in pair_problems if p.minimum_bays() == 2]

    assert set(decisions) == {0}


def test_遮断を無くした盤面では溢れていない局面がすべて解けること(pair_problems: list[PairProblem]) -> None:
    unsolved = [
        mask
        for problem in pair_problems
        for bays in BAYS
        for game in [problem.game(bays, geometry=False)]
        for mask in range(1, game.full + 1)
        if game.alive(mask) and not game.wins(mask)
    ]

    assert unsolved == []
