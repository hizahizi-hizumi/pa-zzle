"""Cross-check the compressed reading model against explicit-state brute force."""
from __future__ import annotations

import random
from itertools import permutations

import pytest

from parking_jam_dispatch_reading import (
    ALL_OPEN,
    DispatchGame,
    Problem,
    classify_choices,
    generate_board,
    geometric_canonical,
    legal_open,
    minimum_bays,
    order_request,
    pair_colors,
    path_states,
    planner_states,
    reading_profile,
    shuffled_request,
    structural_canonical,
)
from parking_jam_dispatch_reading_survey import run_board
from parking_jam_dispatch_structured import DispatchSubsetSolver
from parking_jam_rule_space import legal, make_board, positions


class ExplicitGame:
    """Waiting cars kept as an ordered list; no remaining-set compression."""

    def __init__(self, problem: Problem, bays: int, geometry: bool = True):
        self.vehicles = problem.vehicles
        self.openings = problem.openings
        self.colors = problem.colors
        self.request = problem.request
        self.bays = bays
        self.geometry = geometry
        self.size = problem.size
        self.start = (frozenset(range(len(self.vehicles))), (), 0)
        self.memo = {}

    def remembered(self, name, compute, *key):
        if (name, *key) not in self.memo:
            self.memo[(name, *key)] = compute()
        return self.memo[(name, *key)]

    def legal(self, remaining: frozenset[int]) -> list[int]:
        if not self.geometry:
            return sorted(remaining)
        cells = {cell: i for i in remaining for cell in self.cells(self.vehicles[i])}
        size = self.size
        exits = []
        for i in sorted(remaining):
            vehicle = self.vehicles[i]
            steps = {"horizontal": {"left": (0, -1), "right": (0, 1)},
                     "vertical": {"top": (-1, 0), "bottom": (1, 0)}}[vehicle.direction]
            for side, (dr, dc) in steps.items():
                if side not in self.openings:
                    continue
                r, c = max(self.cells(vehicle)) if (dr, dc) in ((0, 1), (1, 0)) else min(self.cells(vehicle))
                r, c = r + dr, c + dc
                while 0 <= r < size and 0 <= c < size and (r, c) not in cells:
                    r, c = r + dr, c + dc
                if not (0 <= r < size and 0 <= c < size):
                    exits.append(i)
                    break
        return exits

    @staticmethod
    def cells(vehicle):
        return [(vehicle.row + j, vehicle.column) if vehicle.direction == "vertical" else (vehicle.row, vehicle.column + j)
                for j in range(vehicle.length)]

    def step(self, state, car):
        remaining, waiting, head = state
        waiting = [*waiting, car]
        while head < len(self.request):
            match = next((w for w in waiting if self.colors[w] == self.request[head]), None)
            if match is None:
                break
            waiting.remove(match)
            head += 1
        return remaining - {car}, tuple(waiting), head

    def ok(self, state) -> bool:
        return len(state[1]) < self.bays

    def moves(self, state):
        return self.legal(state[0]) if self.ok(state) else []

    def solved(self, state) -> bool:
        return not state[0] and not state[1]

    def solution_count(self, state):
        return self.remembered("count", lambda: int(self.solved(state)) + sum(
            self.solution_count(self.step(state, car)) for car in self.moves(state)), state)

    def runs(self, state, stop):
        """Valid exit orders from state, cut at the first state satisfying stop."""
        if not self.ok(state):
            return
        if stop(state):
            yield (), state
            return
        for car in self.moves(state):
            for rest, end in self.runs(self.step(state, car), stop):
                yield (car, *rest), end

    def plans(self, state, horizon):
        return self.remembered("plans", lambda: self.compute_plans(state, horizon), state, horizon)

    def compute_plans(self, state, horizon):
        target = min(state[2] + horizon, len(self.vehicles))
        ends = {}
        for order, end in self.runs(state, lambda s: s[2] >= target):
            ends.setdefault(frozenset(order), []).append(end)
        minimal = [t for t in ends if not any(o < t for o in ends)]
        result = {}
        for t in minimal:
            normalized = {(e[0], tuple(sorted(self.colors[w] for w in e[1])), e[2]) for e in ends[t]}
            assert len(normalized) == 1
            result[t] = ends[t][0]
        return result

    def chunked(self, state, horizon):
        return self.remembered("chunked", lambda: self.compute_chunked(state, horizon), state, horizon)

    def compute_chunked(self, state, horizon):
        if self.solved(state):
            return True, 1.0
        children = [self.chunked(end, horizon) for end in self.plans(state, horizon).values()]
        if not children:
            return False, 0.0
        return all(a for a, _ in children), sum(p for _, p in children) / len(children)

    def rolling(self, state, horizon):
        return self.remembered("rolling", lambda: self.compute_rolling(state, horizon), state, horizon)

    def compute_rolling(self, state, horizon):
        if self.solved(state):
            return True
        plans = self.plans(state, horizon)
        if not plans:
            return False
        for removed in plans:
            for order in permutations(removed):
                current, replanned = state, None
                for car in order:
                    if car not in self.moves(current):
                        break
                    current = self.step(current, car)
                    if not self.ok(current):
                        break
                    if replanned is None and current[2] > state[2]:
                        replanned = current
                else:
                    if not self.rolling(replanned, horizon):
                        return False
        return True

    def probability(self, state, policy):
        return self.remembered("probability", lambda: self.compute_probability(state, policy), state, policy)

    def compute_probability(self, state, policy):
        if self.solved(state):
            return 1.0
        options = self.policy(state, policy)
        if not options:
            return 0.0
        return sum(self.probability(s, policy) if s is not None else 0.0 for s in options) / len(options)

    def policy(self, state, policy):
        if policy == "uniform":
            return [self.step(state, c) for c in self.moves(state)]
        if policy == "head-first":
            moves = self.moves(state)
            head = [c for c in moves if self.colors[c] == self.request[state[2]]]
            return [self.step(state, c) for c in (head or moves)]
        if not self.ok(state):
            return []
        cheapest = None
        for size in range(1, len(state[0]) + 1):
            found = []
            for order in permutations(sorted(state[0]), size):
                if self.colors[order[-1]] != self.request[state[2]]:
                    continue
                remaining = state[0]
                for car in order:
                    if car not in self.legal(remaining):
                        break
                    remaining = remaining - {car}
                else:
                    found.append(frozenset(order))
            if found:
                cheapest = sorted(set(found), key=sorted)
                break
        outcomes = []
        for removed in cheapest:
            reached = None
            for order in permutations(removed):
                current = state
                for car in order:
                    if car not in self.moves(current):
                        break
                    current = self.step(current, car)
                    if not self.ok(current):
                        break
                else:
                    reached = current
                    break
            outcomes.append(reached)
        return outcomes

    def minimum_bays(self):
        original = self.bays
        try:
            for bays in range(1, len(self.vehicles) + 1):
                self.bays = bays
                self.memo = {}
                if self.solution_count(self.start):
                    return bays
        finally:
            self.bays = original
            self.memo = {}


def small_problem(seed: int, n: int, size: int, openings, request_mode: str) -> Problem:
    rng = random.Random(seed)
    board = generate_board(rng, n, size, openings)
    colors = pair_colors(rng, n)
    sides = Problem(board, size, openings, colors, colors).sides
    request = order_request(rng, sides, colors) if request_mode == "order" else shuffled_request(rng, colors)
    return Problem(board, size, openings, colors, request)


CASES = [
    (seed, n, size, openings, mode)
    for seed, (n, size, openings) in enumerate([
        (6, 5, ALL_OPEN), (6, 5, frozenset({"top", "right"})), (6, 6, frozenset({"top", "bottom"})),
        (6, 5, frozenset({"top"})), (8, 6, ALL_OPEN), (6, 6, frozenset({"left"})),
    ] * 5)
    for mode in ("order", "shuffled")
]
IDS = [f"seed{c[0]}-{c[1]}台-{c[2]}盤-{'+'.join(sorted(c[3]))}-{c[4]}" for c in CASES]


@pytest.fixture(params=CASES, ids=IDS)
def problem(request) -> Problem:
    return small_problem(*request.param)


@pytest.fixture
def k_min(problem) -> int:
    return ExplicitGame(problem, 1).minimum_bays()


@pytest.fixture
def free_k_min(problem) -> int:
    return ExplicitGame(problem, 1, geometry=False).minimum_bays()


class TestMinimumBays:
    def test_総当たりの最小枠数と一致すること(self, problem, k_min):
        result = minimum_bays(problem.sides, problem.colors, problem.request)

        assert result == k_min

    def test_遮断を無視した最小枠数も総当たりと一致すること(self, problem, free_k_min):
        free = problem.game(1, geometry=False)

        result = minimum_bays(free.sides, problem.colors, problem.request)

        assert result == free_k_min


@pytest.fixture(params=[0, 1], ids=["枠が最小", "枠が最小より1多い"])
def bays(request, k_min) -> int:
    return k_min + request.param


@pytest.fixture
def explicit_reading(problem, bays):
    explicit = ExplicitGame(problem, bays)
    chunked = {h: explicit.chunked(explicit.start, h) for h in range(1, 5)}
    rolling = {h: explicit.rolling(explicit.start, h) for h in range(1, 5)}
    return chunked, rolling


class TestReadingProfile:
    def test_読みモデルの必勝とクリア確率が総当たりと一致すること(self, problem, bays, explicit_reading):
        expected, expected_rolling = explicit_reading

        profile = reading_profile(problem.game(bays), 4)

        assert profile.chunked_always == {h: a for h, (a, _) in expected.items()}
        assert profile.chunked_probability == pytest.approx({h: p for h, (_, p) in expected.items()})
        assert profile.rolling_always == expected_rolling


@pytest.fixture(params=["uniform", "head-first", "fewest-blockers"])
def policy(request) -> str:
    return request.param


@pytest.fixture
def explicit_probability(problem, bays, policy) -> float:
    explicit = ExplicitGame(problem, bays)
    return explicit.probability(explicit.start, policy)


class TestWinProbability:
    def test_素朴な解き方のクリア確率が総当たりと一致すること(self, problem, bays, policy, explicit_probability):
        expected = explicit_probability

        result = problem.game(bays).win_probability(policy)

        assert result == pytest.approx(expected)


@pytest.fixture(params=[3, 11, 738, 2026])
def open_board(request):
    rng = random.Random(request.param)
    board = None
    while board is None:
        board = make_board(rng, positions(6), 8)
    colors = pair_colors(rng, 8)
    request_order = list(colors)
    rng.shuffle(request_order)
    return Problem(board, 6, ALL_OPEN, colors, request_order)


class TestDispatchGame:
    @pytest.mark.parametrize("bays", [2, 3, 4])
    def test_既存の状態圧縮探索と解の数が一致すること(self, open_board, bays):
        existing = DispatchSubsetSolver(open_board.vehicles, open_board.colors, bays, open_board.request)

        game = open_board.game(bays)
        count = game.solution_count()

        assert count == existing.outcomes(existing.full)[0]
        assert game.wins(game.full) == (count > 0)

    def test_全開口の合法手が既存の合法手と一致すること(self, open_board):
        masks = range(1 << len(open_board.vehicles))

        result = [legal_open(open_board.vehicles, m, ALL_OPEN) for m in masks]

        assert result == [legal(open_board.vehicles, m) for m in masks]

    def test_総当たりの解の数と一致すること(self, problem, bays):
        explicit = ExplicitGame(problem, bays)
        expected = explicit.solution_count(explicit.start)

        count = problem.game(bays).solution_count()

        assert count == expected


@pytest.fixture
def mirrored(problem):
    size = problem.size
    flip = {"left": "right", "right": "left"}
    vehicles = []
    lookup = {(v.row, v.column, v.direction, v.length): v for v in positions(size)}
    for v in problem.vehicles:
        column = size - v.column - (v.length if v.direction == "horizontal" else 1)
        vehicles.append(lookup[(v.row, column, v.direction, v.length)])
    renamed = {c: c.lower() for c in problem.colors}
    order = list(range(len(vehicles)))[::-1]
    return Problem(tuple(vehicles[i] for i in order), size, frozenset(flip.get(s, s) for s in problem.openings),
                   [renamed[problem.colors[i]] for i in order], [renamed[c] for c in problem.request])


class TestCanonicalForms:
    def test_左右反転と色の付け替えと車の並べ替えで正規形が変わらないこと(self, problem, mirrored):
        forms = [
            (geometric_canonical(p.vehicles, p.size, p.openings, p.colors, p.request),
             structural_canonical(p.sides, p.colors, p.request))
            for p in (problem, mirrored)
        ]

        assert forms[0] == forms[1]


@pytest.fixture
def one_request_states(problem, k_min):
    game = problem.game(k_min)
    explicit = ExplicitGame(problem, k_min)
    states = planner_states(game, 1)
    losing = []
    for mask in states:
        remaining = frozenset(i for i in range(game.n) if mask >> i & 1)
        _, reached = next(explicit.runs(explicit.start, lambda s: s[0] == remaining))
        plans = explicit.plans(reached, 1).values()
        losing.append(sum(explicit.solution_count(end) == 0 for end in plans))
    return game, states, losing


class TestClassifyChoices:
    def test_負ける1指令計画の数が総当たりと一致すること(self, one_request_states):
        game, states, expected = one_request_states

        result = [classify_choices(game, mask) or {} for mask in states]

        assert [sum(r.get(k, 0) for k in ("twin", "route", "other")) for r in result] == expected


@pytest.fixture
def explicit_path_states(problem, k_min):
    explicit = ExplicitGame(problem, k_min)
    found = set()
    expanded = set()
    frontier = [explicit.start]
    while frontier:
        state = frontier.pop()
        for removed, end in explicit.plans(state, 2).items():
            for order in permutations(removed):
                current, visited = state, [state[0]]
                for car in order:
                    if car not in explicit.moves(current):
                        break
                    current = explicit.step(current, car)
                    if not explicit.ok(current):
                        break
                    visited.append(current[0])
                else:
                    found |= set(visited)
                    boundary = (end[0], tuple(sorted(problem.colors[w] for w in end[1])), end[2])
                    if boundary not in expanded:
                        expanded.add(boundary)
                        frontier.append(end)
    return {sum(1 << i for i in remaining) for remaining in found}


class TestPathStates:
    def test_2指令先を読む計画者の通る局面が総当たりと一致すること(self, problem, k_min, explicit_path_states):
        result = path_states(problem.game(k_min), 2)

        assert set(result) == explicit_path_states


@pytest.fixture
def board_task():
    return (738, 8, 6, "adjacent2", 0, ("order", "shuffled", "climb"), 20, 3)


def without_timing(rows):
    return [{k: v for k, v in r.items() if k not in ("seconds", "climbSeconds")} for r in rows]


class TestRunBoard:
    def test_同じseedで同じ計測結果になること(self, board_task):
        first = run_board(board_task)
        second = run_board(board_task)

        assert without_timing(first) == without_timing(second)


@pytest.fixture
def triple_color_structure():
    sides = ((0,), (0b1,), (0b10,), (0,), (0b1000,), (0b1,))
    colors = ["A", "A", "A", "B", "B", "B"]
    request = ["A", "B", "A", "B", "A", "B"]
    renaming = [2, 0, 1, 5, 3, 4]
    renamed_sides = [None] * 6
    for old, new in enumerate(renaming):
        renamed_sides[new] = tuple(sum(1 << renaming[j] for j in range(6) if s >> j & 1) for s in sides[old])
    renamed_colors = [None] * 6
    for old, new in enumerate(renaming):
        renamed_colors[new] = colors[old]
    return (sides, colors, request), (tuple(renamed_sides), renamed_colors, request)


class TestStructuralCanonical:
    def test_同色3台の並べ替えでも正規形が変わらないこと(self, triple_color_structure):
        original, renamed = triple_color_structure

        forms = [structural_canonical(*original), structural_canonical(*renamed)]

        assert forms[0] == forms[1]


class TestDispatchGameColors:
    def test_色の数が台数と合わなければ拒否すること(self):
        with pytest.raises(ValueError):
            DispatchGame(((0,), (0,), (0,)), ["A", "A"], ["A", "A"], 2)


@pytest.fixture
def jammed_sides():
    return ((0b10,), (0b1,))


class TestMinimumBaysOnJammedBoard:
    def test_全車を出せない盤ではNoneを返すこと(self, jammed_sides):
        result = minimum_bays(jammed_sides, ["A", "A"], ["A", "A"])

        assert result is None


class TestProblemFromJson:
    def test_書き出した形から同じ問題を復元すること(self, problem):
        result = Problem.from_json(problem.to_json())

        assert (result.vehicles, result.size, result.openings, result.colors, result.request) == (
            problem.vehicles, problem.size, problem.openings, problem.colors, problem.request)
