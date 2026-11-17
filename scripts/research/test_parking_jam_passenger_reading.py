"""Checks the compressed passenger search and the reading features against a naive model.

The naive model keeps the rule-lab state (ordered waiting row with car ids and
boarded counts, head index), searches exit sequences without the compression, and
re-derives every reading feature with its own code. Options are told apart by
projecting explicit states to (remaining, head, per-color (length, boarded) rows).
"""
from __future__ import annotations

import random
from collections import Counter
from functools import lru_cache

import pytest
from parking_jam_dispatch_reading import OPENINGS_BY_NAME, unblocked_sides
from parking_jam_passenger_reading import (
    ExplicitPassengerGame,
    PassengerProblem,
    PassengerReading,
    assign_colors,
    canonical,
    generate_board,
    order_queue,
    path_profile,
    project_compressed,
    shuffled_queue,
    structural_canonical,
)


def sample_problems(seed: int, count: int, cars=(6, 7, 8)) -> list[PassengerProblem]:
    rng = random.Random(seed)
    problems = []
    while len(problems) < count:
        openings = OPENINGS_BY_NAME[rng.choice(sorted(OPENINGS_BY_NAME))]
        n = rng.choice(cars)
        board = generate_board(rng, n, 6, openings, rng.choice([0.0, 0.5, 1.0]))
        colors = assign_colors(rng, n, rng.choice(["3", "pairs"]))
        problem = PassengerProblem(board, 6, openings, colors, [])
        problem.queue = (order_queue(rng, problem.sides, colors, problem.lengths) if rng.random() < 0.5
                         else shuffled_queue(rng, colors, problem.lengths))
        problems.append(problem)
    return problems


class NaiveReading:
    """Independent reading model on explicit rule-lab states."""

    def __init__(self, problem: PassengerProblem, bays: int, sides=None):
        self.problem = problem
        self.bays = bays
        self.game = ExplicitPassengerGame(sides or problem.sides, problem.colors, problem.lengths, problem.queue, bays)
        self.wins = lru_cache(None)(self._wins)
        self.reach = lru_cache(None)(self._reach)
        self.survival = lru_cache(None)(self._survival)
        self.orders = {}
        self.every = {}

    def _wins(self, state) -> bool:
        return self.game.won(state) or any(self.wins(self.game.step(state, i)) for i in self.game.moves(state))

    def _reach(self, state) -> int:
        return max([state[2], *(self.reach(self.game.step(state, i)) for i in self.game.moves(state))])

    def alive(self, state) -> bool:
        return not state[0] or len(state[1]) < self.bays

    def plans(self, state) -> list[tuple[frozenset, object, int]]:
        found = {}

        def walk(s, order):
            for i in self.game.moves(s):
                child = self.game.step(s, i)
                if child[2] > state[2]:
                    if self.alive(child):
                        found.setdefault((frozenset(order) | {i}, self.game.project(child)), (child, i, (*order, i)))
                else:
                    walk(child, (*order, i))

        walk(state, ())
        sets = {key[0] for key in found}
        minimal = {e for e in sets if not any(o < e for o in sets)}
        self.orders.update({(id(state), e, self.game.project(child)): order
                            for (e, _), (child, _, order) in found.items()})
        self.every[id(state)] = [(e, child, head) for (e, _), (child, head, _) in found.items()]
        return [(e, child, head) for (e, _), (child, head, _) in found.items() if e in minimal]

    def follow(self, state, natural):
        for options in (natural, self.plans(state), self.every[id(state)]):
            winners = [p for p in options if self.wins(p[1])]
            if winners:
                return winners
        return []

    def swap_type(self, state, loser, winners) -> str:
        """Twin of another capacity, rescued without blocking: does swapping the capacities keep the answer?"""
        lengths = self.problem.lengths
        partners = [w for w in winners if w[2] != loser[2] and lengths[w[2]] != lengths[loser[2]]]
        partner = min(partners, key=lambda w: (w[2], sum(1 << i for i in w[0])))
        swapped_lengths = list(lengths)
        swapped_lengths[loser[2]], swapped_lengths[partner[2]] = lengths[partner[2]], lengths[loser[2]]
        swapped = ExplicitPassengerGame(self.game.sides, self.problem.colors, swapped_lengths, self.problem.queue,
                                        self.bays)

        @lru_cache(None)
        def wins(s) -> bool:
            return swapped.won(s) or any(wins(swapped.step(s, i)) for i in swapped.moves(s))

        results = []
        for exits, child, _ in (partner, loser):
            current = state
            for car in self.orders[(id(state), exits, self.game.project(child))]:
                if car not in swapped.moves(current):
                    return "unplayableSwap"
                current = swapped.step(current, car)
            results.append(wins(current))
        return "positionOnlyTwin" if results == [True, False] else "capacityAndBlocking"

    def natural(self, state):
        plans = self.plans(state)
        smallest = Counter()
        for exits, _, head in plans:
            smallest[head] = min(smallest.get(head, 99), len(exits))
        kept = [p for p in plans if len(p[0]) == smallest[p[2]]]
        head_color = self.problem.queue[state[2]]
        free = {i for i in self.game.moves(state) if self.problem.colors[i] == head_color}
        return [p for p in kept if p[2] in free] if free else kept

    def _survival(self, state):
        children = self.natural(state) if state[0] else []
        if not children:
            return state[2], state[2]
        ends = [self.survival(child) for _, child, _ in children]
        return min(e[0] for e in ends), max(e[1] for e in ends)

    def summary(self) -> dict[str, object]:
        free_game = NaiveReading(self.problem, self.bays, unblocked_sides(len(self.problem.colors)))
        start = self.game.start
        order, seen = [start], {self.game.project(start)}
        forced = free_choice = 0
        decisions = []
        decision_types = {}
        for state in order:
            if not state[0]:
                continue
            natural = self.natural(state)
            winners = [p for p in natural if self.wins(p[1])]
            losers = [p for p in natural if not self.wins(p[1])]
            follow = winners or self.follow(state, natural)
            for _, child, _ in follow:
                if self.game.project(child) not in seen:
                    seen.add(self.game.project(child))
                    order.append(child)
            if not losers:
                if len({self.game.project(p[1]) for p in natural}) <= 1:
                    forced += 1
                else:
                    free_choice += 1
                continue
            items = []
            for exits, child, head in losers:
                if not winners:
                    kind = "other"
                elif any(w[0] == exits for w in winners):
                    kind = "order"
                elif any(w[2] == head for w in winners):
                    kind = "route"
                else:
                    kind = "twin"
                survival = self.survival(child)
                essential = free_game.wins(child)
                same = any(self.problem.lengths[w[2]] == self.problem.lengths[head] for w in follow)
                if kind != "twin":
                    kind_type = kind
                elif same:
                    kind_type = "sameCapacityTwin"
                elif not essential:
                    kind_type = "queueOnlyTwin"
                else:
                    kind_type = self.swap_type(state, (exits, child, head), winners)
                items.append({"kind": kind, "essential": essential, "type": kind_type,
                              "reason": self.reason(exits, child, follow),
                              "distanceMax": survival[1] - state[2],
                              "visible": self.reach(child) - state[2] + 1})
            decisions.append(items)
            decision_types[self.game.project(state)] = {x["type"] for x in items}
        losing = [x for d in decisions for x in d]
        run = self.run_profile(start, decision_types)
        return {
            "decisionsOnRunMin": run[0], "decisionsOnRunMax": run[1],
            "capacityAndBlockingOnRunMin": run[2], "capacityAndBlockingOnRunMax": run[3],
            "pathStates": forced + free_choice + len(decisions),
            "forcedStates": forced,
            "freeChoiceStates": free_choice,
            "decisions": len(decisions),
            "essentialDecisions": sum(all(x["essential"] for x in d) for d in decisions),
            "queueDecisions": sum(not any(x["essential"] for x in d) for d in decisions),
            "essentialOptions": sum(x["essential"] for x in losing),
            "kinds": dict(Counter(x["kind"] for x in losing)),
            "types": dict(Counter(x["type"] for x in losing)),
            "reasons": dict(Counter(x["reason"] for x in losing)),
            "distanceMax": max((x["distanceMax"] for x in losing), default=0),
            "visibleMax": max((x["visible"] for x in losing), default=0),
        }

    def run_profile(self, start, decision_types) -> tuple[int, int, int, int]:
        """Fewest/most decisions and capacity-and-blocking decisions over every run along winning plans."""
        @lru_cache(None)
        def visit(key):
            state = representatives[key]
            if not state[0]:
                return 0, 0, 0, 0
            natural = self.natural(state)
            follow = [c for _, c, _ in self.follow(state, natural)]
            ends = []
            for child in follow:
                representatives.setdefault(self.game.project(child), child)
                ends.append(visit(self.game.project(child)))
            types = decision_types.get(key, set())
            here, capacity = int(key in decision_types), int("capacityAndBlocking" in types)
            return (here + min(e[0] for e in ends), here + max(e[1] for e in ends),
                    capacity + min(e[2] for e in ends), capacity + max(e[3] for e in ends))

        representatives = {self.game.project(start): start}
        return visit(self.game.project(start))

    def reason(self, exits, child, winners) -> str:
        if not winners:
            return "unknown"
        reference = min(winners, key=lambda w: len(w[0] ^ exits))
        left = reference[0] - exits
        direct = False
        if left:
            left_mask = sum(1 << i for i in left)
            cleared = tuple(tuple(s & ~left_mask for s in sides) for sides in self.problem.sides)
            direct = NaiveReading(self.problem, self.bays, cleared).wins(child)
        extra = exits - reference[0]
        extra_waiting = len(child[1]) - len(reference[1][1])
        pressure = False
        if extra or extra_waiting > 0:
            more = max(1, extra_waiting, len(extra))
            pressure = NaiveReading(self.problem, self.bays + more).wins(child)
        return {(True, True): "AB", (True, False): "A", (False, True): "B"}.get((direct, pressure), "unknown")


def naive_minimum_bays(problem: PassengerProblem) -> int | None:
    for bays in range(1, len(problem.colors) + 1):
        if NaiveReading(problem, bays).wins(ExplicitPassengerGame(
                problem.sides, problem.colors, problem.lengths, problem.queue, bays).start):
            return bays
    return None


def solution_count_without_compression(problem: PassengerProblem, bays: int) -> int:
    explicit = problem.explicit(bays)

    @lru_cache(None)
    def count(state) -> int:
        return 1 if explicit.won(state) else sum(count(explicit.step(state, i)) for i in explicit.moves(state))

    return count(explicit.start)


def random_walk_projections(problem: PassengerProblem, seed: int) -> tuple[list, list]:
    rng = random.Random(seed)
    game, explicit = problem.game(len(problem.colors)), problem.explicit(len(problem.colors))
    compressed, rule_lab = [], []
    state, rule_state = game.start, explicit.start
    while state[0]:
        car = rng.choice(game.moves(state))
        state, rule_state = game.step(state, car), explicit.step(rule_state, car)
        compressed.append(project_compressed(game, state))
        rule_lab.append(explicit.project(rule_state))
    return compressed, rule_lab


@pytest.mark.parametrize("problem", sample_problems(739, 40), ids=lambda p: f"{len(p.colors)}台{''.join(p.colors)}")
@pytest.mark.parametrize("bays", [2, 3], ids=["2枠", "3枠"])
def test_圧縮した探索の解の数が比較試作と同じ状態遷移の全探索と一致すること(problem, bays):
    result = problem.game(bays).solution_count()

    assert result == solution_count_without_compression(problem, bays)


@pytest.mark.parametrize("problem", sample_problems(739, 40), ids=lambda p: f"{len(p.colors)}台{''.join(p.colors)}")
def test_最小枠数が枠を1つずつ増やした素朴な探索と一致すること(problem):
    result = problem.minimum_bays()

    assert result == naive_minimum_bays(problem)


@pytest.mark.parametrize("problem", sample_problems(20261116, 20), ids=lambda p: f"{len(p.colors)}台{''.join(p.colors)}")
@pytest.mark.parametrize("seed", range(10), ids=lambda s: f"出庫順{s}")
def test_圧縮した状態が比較試作の状態の射影と出庫ごとに一致すること(problem, seed):
    compressed, rule_lab = random_walk_projections(problem, seed)

    assert compressed == rule_lab


@pytest.fixture
def same_color_cars_of_lengths_two_and_three():
    from parking_jam_passenger_reading import PassengerGame

    game = PassengerGame(unblocked_sides(4), ["A", "A", "B", "C"], [2, 3, 2, 2],
                         ["B", "A", "A", "B", "C", "C", "A", "A", "A"], 4)
    return game


def test_同色で定員の違う2台は先に待機した側から乗るので待機数が到着順で変わること(
        same_color_cars_of_lengths_two_and_three):
    game = same_color_cars_of_lengths_two_and_three

    short_first = game.step(game.step(game.step(game.start, 0), 1), 2)
    long_first = game.step(game.step(game.step(game.start, 1), 0), 2)

    assert short_first[0] == long_first[0]
    assert (game.waiting(short_first), game.waiting(long_first)) == (1, 2)


def favorable_problems_with_decisions(seed: int, count: int) -> list[PassengerProblem]:
    """Mixed capacities, shuffled queue, two adjacent or one open side: where capacity-and-blocking decisions occur."""
    rng = random.Random(seed)
    chosen = []
    while len(chosen) < count:
        openings = OPENINGS_BY_NAME[rng.choice(["adjacent2", "one"])]
        n = rng.choice([7, 8])
        board = generate_board(rng, n, 6, openings, 0.5)
        colors = assign_colors(rng, n, rng.choice(["3", "pairs"]))
        problem = PassengerProblem(board, 6, openings, colors, [])
        problem.queue = shuffled_queue(rng, colors, problem.lengths)
        k_min = problem.minimum_bays()
        if k_min is not None and k_min <= 4 and PassengerReading(problem.game(k_min)).summary()["decisions"]:
            chosen.append(problem)
    return chosen


def problems_with_decisions(seed: int, count: int) -> list[PassengerProblem]:
    """Random 7-8 car problems whose slack-0 reading has a decision, so the comparison is not vacuous."""
    chosen = []
    for problem in sample_problems(seed, 400, cars=(7, 8)):
        k_min = problem.minimum_bays()
        if k_min is not None and k_min <= 4 and PassengerReading(problem.game(k_min)).summary()["decisions"]:
            chosen.append(problem)
        if len(chosen) == count:
            break
    return chosen


@pytest.mark.parametrize("problem", sample_problems(738, 30, cars=(6, 7)) + problems_with_decisions(11, 30)
                         + favorable_problems_with_decisions(12, 30),
                         ids=lambda p: f"{len(p.colors)}台{''.join(p.colors)}")
@pytest.mark.parametrize("extra", [0, 1], ids=["余裕0", "余裕1"])
def test_読み手の判断局面と負ける理由の数え方が素朴な実装と一致すること(problem, extra):
    k_min = problem.minimum_bays()
    if k_min is None:
        pytest.skip("駐車場から全車を出せない")

    reading = PassengerReading(problem.game(k_min + extra))
    summary = {**reading.summary(), **path_profile(reading)}
    naive = NaiveReading(problem, k_min + extra).summary()

    assert {k: summary[k] for k in naive} == naive


@pytest.fixture
def problem_and_variants():
    problem = sample_problems(5, 1)[0]
    names = {c: chr(ord(c) + 3) for c in set(problem.colors)}
    renamed = PassengerProblem(problem.vehicles, problem.size, problem.openings,
                               [names[c] for c in problem.colors], [names[c] for c in problem.queue])
    reversed_cars = PassengerProblem(problem.vehicles[::-1], problem.size, problem.openings, problem.colors[::-1],
                                     problem.queue)
    return problem, renamed, reversed_cars


def test_同型判定が色の名前と車の並びに依らないこと(problem_and_variants):
    problem, renamed, reversed_cars = problem_and_variants

    forms = (canonical(problem), canonical(renamed), structural_canonical(problem), structural_canonical(reversed_cars))

    assert forms[0] == forms[1] and forms[2] == forms[3]


@pytest.fixture
def problem_below_minimum_bays():
    problem = next(p for p in sample_problems(739, 40) if (p.minimum_bays() or 0) >= 3)
    return PassengerReading(problem.game(problem.minimum_bays() - 1))


def test_最小枠数より少ない枠で勝ち筋の判断数を求めると原因の分かるエラーになること(problem_below_minimum_bays):
    with pytest.raises(ValueError, match="below the minimum"):
        path_profile(problem_below_minimum_bays)
