"""Check the lookahead measures against an explicit game written without state compression.

The explicit game keeps the ordered waiting row with car ids and boarded counts, and
computes blocking from the cells of the cars, not from `side_blockers`.
"""
from __future__ import annotations

import random
from fractions import Fraction
from functools import cache
from itertools import pairwise
from pathlib import Path

import pytest
from parking_jam_passenger_levels import (
    VARIANTS,
    LookaheadModel,
    color_runs,
    example_entry,
    load_json,
    lookahead_profile,
    naive_win_probability,
    reader_win_probability,
)
from parking_jam_passenger_study import build, draw_conditions


class ExplicitLookahead:
    def __init__(self, problem, bays: int, geometry: bool = True):
        self.problem = problem
        self.bays = bays
        self.geometry = geometry
        self.cars = range(len(problem.vehicles))
        self.queue = problem.queue
        self.start = (frozenset(self.cars), (), 0)
        self.cells = [self._cells(v) for v in problem.vehicles]
        self.rays = [self._rays(v) for v in problem.vehicles]
        self._wins: dict = {}
        self._reach: dict = {}

    @staticmethod
    def _cells(v):
        return {(v.row + (j if v.direction == "vertical" else 0), v.column + (j if v.direction == "horizontal" else 0))
                for j in range(v.length)}

    def _rays(self, v):
        size, openings = self.problem.size, self.problem.openings
        rays = []
        if v.direction == "horizontal":
            if "left" in openings:
                rays.append({(v.row, c) for c in range(v.column)})
            if "right" in openings:
                rays.append({(v.row, c) for c in range(v.column + v.length, size)})
        else:
            if "top" in openings:
                rays.append({(r, v.column) for r in range(v.row)})
            if "bottom" in openings:
                rays.append({(r, v.column) for r in range(v.row + v.length, size)})
        return rays

    def blockers(self, car, remaining):
        """Per open ray, the remaining cars standing on it."""
        return [{o for o in remaining if o != car and self.cells[o] & ray} for ray in self.rays[car]]

    def can_exit(self, car, remaining):
        return not self.geometry or any(not b for b in self.blockers(car, remaining))

    def legal(self, state):
        remaining, waiting, _ = state
        if not remaining or len(waiting) >= self.bays:
            return []
        return sorted(c for c in remaining if self.can_exit(c, remaining))

    def step(self, state, car):
        remaining, waiting, head = state
        row = [list(w) for w in waiting] + [[car, 0]]
        colors, lengths = self.problem.colors, self.problem.lengths
        while head < len(self.queue):
            index = next((k for k, (c, _) in enumerate(row) if colors[c] == self.queue[head]), None)
            if index is None:
                break
            row[index][1] += 1
            head += 1
            if row[index][1] == lengths[row[index][0]]:
                row.pop(index)
        return remaining - {car}, tuple(tuple(w) for w in row), head

    def wins(self, state):
        if state not in self._wins:
            self._wins[state] = not state[0] or any(self.wins(self.step(state, c)) for c in self.legal(state))
        return self._wins[state]

    def reach(self, state):
        if state not in self._reach:
            self._reach[state] = max([state[2], *(self.reach(self.step(state, c)) for c in self.legal(state))])
        return self._reach[state]

    def distance(self, state, car):
        return self.reach(self.step(state, car)) - state[2]

    def head_cars(self, state):
        remaining, _, head = state
        return [c for c in remaining if self.problem.colors[c] == self.queue[head]]

    def closure(self, seeds, remaining):
        found = set(seeds)
        while True:
            more = {o for c in found for b in self.blockers(c, remaining) for o in b} - found
            if not more:
                return found
            found |= more

    def cheapest_dig(self, state):
        remaining = state[0]
        targets = self.head_cars(state)
        cost = {c: min(len(b) for b in self.blockers(c, remaining)) for c in targets}
        low = min(cost.values())
        seeds = {o for c in targets if cost[c] == low for b in self.blockers(c, remaining) if len(b) == low for o in b}
        return self.closure(seeds, remaining)

    def tier(self, state, tier):
        remaining, _, head = state
        legal = self.legal(state)
        if tier == "all":
            return legal
        if tier in ("cheapest", "headFirst"):
            direct = [c for c in legal if c in self.head_cars(state)]
            if direct:
                return direct
            if tier == "cheapest":
                dig = self.cheapest_dig(state)
                return [c for c in legal if c in dig]
            tier = "run1"
        colors, seen = set(), 0
        for i in range(head, len(self.queue)):
            if i == head or self.queue[i] != self.queue[i - 1]:
                seen += 1
                if seen > int(tier[3:]):
                    break
            colors.add(self.queue[i])
        found = self.closure({c for c in remaining if self.problem.colors[c] in colors}, remaining)
        return [c for c in legal if c in found]

    def candidates(self, state, variant):
        for tier in variant.tiers:
            options = self.tier(state, tier)
            if any(self.wins(self.step(state, c)) for c in options):
                return options
        raise AssertionError("a winning state has a winning exit")

    def walk(self, variant):
        """States reached by winning candidate exits, with their losing candidates (car, distance)."""
        seen, order, losers = set(), [self.start], {}
        while order:
            state = order.pop()
            if state in seen or not state[0]:
                continue
            seen.add(state)
            losers[state] = []
            for car in self.candidates(state, variant):
                child = self.step(state, car)
                if self.wins(child):
                    order.append(child)
                else:
                    losers[state].append((car, self.distance(state, car)))
        return losers

    def always_wins(self, variant, horizon):
        """Whether the horizon reader can never pick a losing exit (no probabilities involved)."""
        return all(d < horizon for items in self.walk(variant).values() for _, d in items)

    def probability(self, variant, horizon):
        @cache
        def value(state):
            if not state[0]:
                return Fraction(1)
            if not self.wins(state):
                return Fraction(0)
            options = [c for c in self.candidates(state, variant)
                       if self.wins(self.step(state, c)) or self.distance(state, c) >= horizon]
            return sum((value(self.step(state, c)) for c in options), Fraction(0)) / len(options)

        return value(self.start)

    def naive(self):
        colors = self.problem.colors

        @cache
        def value(state):
            if not state[0]:
                return Fraction(1)
            if not self.wins(state):
                return Fraction(0)
            head = state[2]
            options = []
            for c in self.legal(state):
                child = self.step(state, c)
                if not child[0] or len(child[1]) < self.bays:
                    options.append(c)
            if not options:
                return Fraction(0)
            direct = [c for c in options if colors[c] == self.queue[head]]
            if not direct:
                dig = self.cheapest_dig(state)
                direct = [c for c in options if c in dig] or options
            return sum((value(self.step(state, c)) for c in direct), Fraction(0)) / len(direct)

        return value(self.start)


def problems(count: int, seed: int):
    """8-car problems at slack 0 or 1; half of them ones the naive policy can lose."""
    rng = random.Random(seed)
    easy, hard = [], []
    while len(easy) + len(hard) < count:
        conditions = draw_conditions(rng, {"cars": 8, "longShare": rng.choice((0.0, 0.5, 1.0))})
        problem = build(rng, conditions)
        k_min = problem.minimum_bays()
        if k_min is None or not 2 <= k_min <= 4:
            continue
        bays = k_min + rng.choice((0, 0, 1))
        pile = hard if naive_win_probability(problem.game(bays)) < 1 else easy
        if len(pile) < count // 2:
            pile.append((problem, bays))
    return easy + hard


CASES = problems(24, 5150)
RESEARCH = Path(__file__).parent
CASE_IDS = [f"無作為な8台の問題{i}（枠{bays}）" for i, (_, bays) in enumerate(CASES)]
MEASURED = ("lookahead", "lookaheadRuns", "lookaheadBlocking", "lookaheadQueueOnly", "curve")


@pytest.fixture(params=CASES, ids=CASE_IDS)
def case(request):
    return request.param


@pytest.fixture
def explicit(case):
    problem, bays = case
    return ExplicitLookahead(problem, bays)


@pytest.fixture
def expected_measures(case, explicit):
    """Per variant, the measures recomputed on the explicit game."""
    problem, bays = case
    free = ExplicitLookahead(problem, bays, geometry=False)
    result = {}
    for name, variant in VARIANTS.items():
        traps = [(s, c, d) for s, items in explicit.walk(variant).items() for c, d in items]
        blocking = [d for s, c, d in traps if d >= 1 and free.wins(explicit.step(s, c))]
        queue_only = [d for s, c, d in traps if d >= 1 and not free.wins(explicit.step(s, c))]
        lookahead = max((d for *_, d in traps), default=-1) + 1
        result[name] = {
            "lookahead": lookahead,
            "lookaheadRuns": max((color_runs(problem.queue[s[2]:s[2] + d + 1]) for s, _, d in traps), default=0),
            "lookaheadBlocking": max(blocking, default=-1) + 1,
            "lookaheadQueueOnly": max(queue_only, default=-1) + 1,
            "curve": [pytest.approx(float(explicit.probability(variant, h)), abs=1e-6) for h in range(lookahead + 1)],
        }
    return result


@pytest.fixture
def least_always_winning_horizon(case, explicit):
    """Per variant, the least h whose reader can never pick a losing exit, found by trying every h."""
    problem, _ = case
    return {name: next(h for h in range(len(problem.queue) + 2) if explicit.always_wins(variant, h))
            for name, variant in VARIANTS.items()}


@pytest.fixture
def horizons(case):
    problem, _ = case
    return range(len(problem.queue) + 2)


def test_先読みの量と読み手の勝率が順序つきの待機列で数えた値と一致すること(case, expected_measures):
    problem, bays = case
    model = LookaheadModel(problem, bays)

    measured = {name: {k: lookahead_profile(model, v)[k] for k in MEASURED} for name, v in VARIANTS.items()}

    assert measured == expected_measures


def test_必要な先読みがどう選んでも勝つ最小の読みの人数に等しいこと(case, least_always_winning_horizon):
    problem, bays = case
    model = LookaheadModel(problem, bays)

    lookahead = {name: lookahead_profile(model, v)["lookahead"] for name, v in VARIANTS.items()}

    assert lookahead == least_always_winning_horizon


def test_読みの人数を増やしても勝率が下がらず必要な先読みでちょうど1になること(case, horizons):
    problem, bays = case
    model = LookaheadModel(problem, bays)

    curves = {name: [reader_win_probability(model.graph(v), model.game.start, h, exact=True) for h in horizons]
              for name, v in VARIANTS.items()}
    lookahead = {name: lookahead_profile(model, v)["lookahead"] for name, v in VARIANTS.items()}

    for name, curve in curves.items():
        assert all(a <= b for a, b in pairwise(curve))
        assert [p == 1 for p in curve].index(True) == lookahead[name]


def test_素朴な解き方の勝率が順序つきの待機列で数えた値と一致すること(case, explicit):
    problem, bays = case
    model = LookaheadModel(problem, bays)

    probability = naive_win_probability(model.game)

    assert probability == pytest.approx(float(explicit.naive()), abs=1e-9)


@pytest.fixture
def selection():
    return load_json(str(RESEARCH / "parking_jam_passenger_levels.selection.json"))


@pytest.fixture
def published_examples():
    return load_json(str(RESEARCH / "parking_jam_passenger_levels.examples.json"))


def test_問題例の盤面とレベルと特徴が選んだ問題から作り直した値と一致すること(selection, published_examples):
    rebuilt = [example_entry(spec) for spec in selection]

    assert rebuilt == published_examples
