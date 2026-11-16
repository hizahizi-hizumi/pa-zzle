"""Level judging and generators, cross-checked against explicit-state brute force."""
from __future__ import annotations

import json
import random
from collections import Counter
from pathlib import Path

import pytest

from parking_jam_dispatch_levels import (
    GENERATORS,
    LEVEL_SHAPE,
    NaturalReading,
    assess,
    level_features,
    level_of,
    match,
    minimum_bays,
    population,
    summarize,
)
from parking_jam_dispatch_levels_examples import build, from_example, frontend_json, load_rows
from test_parking_jam_dispatch_reading import CASES, IDS, ExplicitGame, small_problem


class TransparentGame(ExplicitGame):
    """Explicit game in which some cars never block others."""

    def __init__(self, problem, bays, transparent):
        super().__init__(problem, bays)
        self.transparent = transparent

    def legal(self, remaining):
        solid = frozenset(remaining) - self.transparent
        return [car for car in sorted(remaining) if car in super().legal(solid | {car})]


class ExplicitReader:
    def __init__(self, problem, bays, skip_buried_twin):
        self.problem = problem
        self.game = ExplicitGame(problem, bays)
        self.skip = skip_buried_twin

    def key(self, state):
        return state[0], tuple(sorted(self.problem.colors[w] for w in state[1])), state[2]

    def wins(self, state):
        return self.game.solution_count(state) > 0

    def head_car(self, removed, state):
        return next(c for c in removed if self.problem.colors[c] == self.problem.request[state[2]])

    def natural(self, state):
        if not self.game.ok(state) or not state[0]:
            return {}
        plans = self.game.plans(state, 1)
        smallest = {}
        for removed in plans:
            car = self.head_car(removed, state)
            smallest[car] = min(smallest.get(car, 99), len(removed))
        kept = {r: e for r, e in plans.items() if len(r) == smallest[self.head_car(r, state)]}
        if self.skip:
            free = {c for c in self.game.legal(state[0]) if self.problem.colors[c] == self.problem.request[state[2]]}
            if free:
                kept = {r: e for r, e in kept.items() if self.head_car(r, state) in free}
        return kept

    def path(self):
        order, seen = [self.game.start], {self.key(self.game.start)}
        for state in order:
            if not state[0]:
                continue
            winners = [e for e in self.natural(state).values() if self.wins(e)]
            if not winners:
                winners = [e for e in self.game.plans(state, 1).values() if self.wins(e)]
            for end in winners:
                if self.key(end) not in seen:
                    seen.add(self.key(end))
                    order.append(end)
        return order

    def survival(self, state):
        ends = [self.survival(e) for e in self.natural(state).values()]
        if not ends:
            return state[2], state[2]
        return min(e[0] for e in ends), max(e[1] for e in ends)

    def reason(self, state, removed, end, winners):
        if not winners:
            return "unknown"
        reference = min(winners, key=lambda r: len(r ^ removed))
        left = frozenset(reference - removed)
        extra = removed - reference
        direct = bool(left) and TransparentGame(self.problem, self.game.bays, left).solution_count(end) > 0
        waiting = Counter(self.problem.colors[w] for w in end[1])
        extra_colors = Counter(self.problem.colors[c] for c in extra)
        waiting_extra = sum(min(n, waiting[c]) for c, n in extra_colors.items())
        pressure = False
        if waiting_extra:
            wider = ExplicitGame(self.problem, self.game.bays + waiting_extra)
            pressure = wider.solution_count(end) > 0
        return {(True, True): "AB", (True, False): "A", (False, True): "B"}.get((direct, pressure), "unknown")

    def lures(self, state):
        if not self.game.ok(state):
            return 0
        needed = set().union(*self.game.plans(state, 1)) if self.game.plans(state, 1) else set()
        upcoming = set(self.problem.request[state[2] + 1:state[2] + 3])
        count = 0
        for car in self.game.legal(state[0]):
            child = self.game.step(state, car)
            if (car not in needed and self.problem.colors[car] in upcoming and self.game.ok(child)
                    and not self.wins(child)):
                count += 1
        return count

    def summary(self):
        decisions, lure_states = [], 0
        for state in self.path():
            if not state[0]:
                continue
            lure_states += self.lures(state) > 0
            natural = self.natural(state)
            losing = {r: e for r, e in natural.items() if not self.wins(e)}
            if not losing:
                continue
            winners = [r for r, e in natural.items() if self.wins(e)]
            fallback = winners or [r for r, e in self.game.plans(state, 1).items() if self.wins(e)]
            spans = [self.survival(e) for e in losing.values()]
            winning_cars = {self.head_car(r, state) for r in winners}
            kinds = {"route" if self.head_car(r, state) in winning_cars else "twin" for r in losing}
            kind = "other" if not winners else (kinds.pop() if len(kinds) == 1 else "mixed")
            decisions.append((
                kind,
                state[2],
                min(s[0] for s in spans) - state[2],
                max(s[1] for s in spans) - state[2],
                tuple(sorted(self.reason(state, r, e, fallback) for r, e in losing.items())),
                len(natural),
                max(len(r) - 1 for r in natural),
            ))
        return sorted(decisions), lure_states


@pytest.fixture(params=CASES, ids=IDS)
def problem(request):
    return small_problem(*request.param)


@pytest.fixture(params=[0, 1], ids=["枠が最小", "枠が最小より1多い"])
def bays(request, problem):
    return minimum_bays(problem.sides, problem.colors, problem.request) + request.param


@pytest.fixture(params=[True, False], ids=["埋まった同色車を掘る計画を除く", "埋まった同色車を掘る計画も残す"])
def skip_buried_twin(request):
    return request.param


@pytest.fixture
def explicit_summary(problem, bays, skip_buried_twin):
    return ExplicitReader(problem, bays, skip_buried_twin).summary()


class TestNaturalReading:
    def test_判断局面と帰結までの距離と理由と誘いが総当たりと一致すること(
            self, problem, bays, skip_buried_twin, explicit_summary):
        game = problem.game(bays)

        summary = NaturalReading(game, skip_buried_twin).summary()

        decisions = sorted((d["kind"], d["served"], d["distanceMin"], d["distanceMax"], tuple(d["reasons"]),
                            d["options"], d["chain"]) for d in summary["detail"])
        assert (decisions, summary["lures"]) == explicit_summary


@pytest.fixture
def lv2_features():
    return {"cars": 8, "bays": 2, "k_min": 2, "slack": 0, "decisions": 1, "distanceMax": 2, "hasA": 1, "hasB": 0}


@pytest.fixture
def lv5_features():
    return {"cars": 12, "bays": 3, "k_min": 3, "slack": 0, "decisions": 3, "distanceMax": 3, "hasA": 1, "hasB": 1,
            "headFirstPerfect": 0, "fewestPerfect": 0}


class TestMatch:
    def test_境界内の特徴を受け入れること(self, lv2_features):
        accepted, failed, deficit = match(lv2_features, 2)

        assert (accepted, failed, deficit) == (True, [], 0.0)

    @pytest.mark.parametrize("key,value", [("distanceMax", 3), ("decisions", 2), ("bays", 1), ("bays", 5),
                                           ("hasA", 0), ("slack", 2)],
                             ids=["距離が3", "判断局面が2", "枠が1", "枠が5", "直接の遮断が無い", "余裕が2"])
    def test_境界の外を退けること(self, lv2_features, key, value):
        lv2_features[key] = value

        accepted, failed, _ = match(lv2_features, 2)

        assert not accepted and key in failed

    @pytest.mark.parametrize("bays", [5, 6], ids=["枠が5", "枠が6"])
    def test_どのレベルも枠5以上を受け入れないこと(self, lv5_features, bays):
        lv5_features["bays"] = bays

        result = [match(lv5_features, level)[0] for level in (4, 5)]

        assert result == [False, False]

    def test_Lv3は待機の圧迫を含む判断を受け入れないこと(self):
        features = {"cars": 10, "bays": 3, "slack": 0, "decisions": 2, "distanceMax": 3, "hasB": 1,
                    "headFirstPerfect": 0}

        accepted, failed, _ = match(features, 3)

        assert not accepted and failed == ["hasB"]


class TestLevelOf:
    def test_Lv5を満たす特徴はLv4も満たしレベルは高い方になること(self, lv5_features):
        both = (match(lv5_features, 4)[0], match(lv5_features, 5)[0])

        result = level_of(lv5_features)

        assert both == (True, True) and result == 5

    def test_直接の遮断が無ければLv4になること(self, lv5_features):
        lv5_features["hasA"] = 0

        result = level_of(lv5_features)

        assert result == 4


@pytest.fixture(params=[(g, lv) for g in ("G1", "G2", "G3") for lv in (1, 2, 3, 4, 5)],
                ids=[f"{g}-Lv{lv}" for g in ("G1", "G2", "G3") for lv in (1, 2, 3, 4, 5)])
def accepted_attempt(request):
    generator, level = request.param
    rng = random.Random(f"test:{generator}:{level}")
    for _ in range(3000 if generator != "G3" else 20):
        attempt = GENERATORS[generator](rng, level)
        if attempt.accepted:
            return level, attempt
    pytest.skip(f"{generator} produced no Lv{level} problem within the test budget")


class TestGenerators:
    def test_採用した問題が可解でレベル基準を満たすこと(self, accepted_attempt):
        level, attempt = accepted_attempt

        result = assess(attempt.problem, attempt.bays, level)

        assert attempt.problem.game(attempt.bays).wins(attempt.problem.game(attempt.bays).full)
        assert result.accepted
        assert level_of(result.features) == level
        assert attempt.bays - result.features["k_min"] in LEVEL_SHAPE[level]["slack"]


@pytest.fixture(params=["G1", "G2", "G3"])
def generator(request):
    return request.param


def attempt_signature(attempt):
    problem = attempt.problem
    return (attempt.accepted, attempt.failed, attempt.bays,
            None if problem is None else (problem.vehicles, problem.colors, problem.request))


class TestReproducibility:
    def test_同じseedで同じ問題を生成すること(self, generator):
        first = [attempt_signature(GENERATORS[generator](random.Random("same"), 3)) for _ in range(1)]
        second = [attempt_signature(GENERATORS[generator](random.Random("same"), 3)) for _ in range(1)]

        assert first == second


class TestLevelFeatures:
    def test_枠が最小より少なければ特徴を計算しないこと(self, problem):
        k_min = minimum_bays(problem.sides, problem.colors, problem.request)

        features = level_features(problem, k_min - 1, k_min)

        assert "decisions" not in features


class TestAssess:
    def test_Lv5を満たす問題はLv4として採用しないこと(self, lv5_problem):
        problem, bays = lv5_problem

        result = assess(problem, bays, 4)

        assert not result.accepted and result.failed == ["meets-Lv5"]


@pytest.fixture
def lv5_problem():
    rng = random.Random("lv5 fixture")
    for _ in range(40):
        attempt = GENERATORS["G3"](rng, 5)
        if attempt.accepted:
            return attempt.problem, attempt.bays
    pytest.fail("G3 found no Lv5 problem for the fixture")


class TestPopulation:
    def test_同じseedで同じ集計になること(self):
        first = population(5, 4, 2)
        second = population(5, 4, 2)

        assert first == second


class TestSummarize:
    def test_試行が無くても集計できること(self):
        result = summarize([])

        assert result["attempts"] == 0 and result["distinctStructuralPerCpuMinute"] is None


@pytest.fixture
def same_seed_records(tmp_path):
    paths = []
    for name in ("a.json", "b.json"):
        path = tmp_path / name
        path.write_text(json.dumps({"seed": 1, "rows": []}), encoding="utf-8")
        paths.append(str(path))
    return paths


class TestLoadRows:
    def test_同じseedの記録ファイルを2つ渡すと拒否すること(self, same_seed_records):
        with pytest.raises(ValueError):
            load_rows(same_seed_records)


@pytest.fixture
def stalled_mutation(monkeypatch):
    import parking_jam_dispatch_levels

    monkeypatch.setattr(parking_jam_dispatch_levels, "mutate", lambda rng, problem, pool: None)


class TestGenerateG3:
    def test_変異が作れなくても試行回数の上限で止まること(self, stalled_mutation):
        attempt = GENERATORS["G3"](random.Random("stall"), 4)

        assert attempt.evaluations == 1


@pytest.fixture
def examples_paths():
    root = Path(__file__).resolve().parents[2]
    return (root / "scripts/research/parking_jam_dispatch_levels.examples.json",
            root / "frontend/src/games/parking-jam/rule-lab/dispatch-levels.json")


class TestFrontendJson:
    def test_研究用の問題例からルール比較画面のファイルと同じ内容を書き出すこと(self, examples_paths):
        research, frontend = examples_paths
        examples = json.loads(research.read_text(encoding="utf-8"))

        result = frontend_json(examples)

        assert result == frontend.read_text(encoding="utf-8")


@pytest.fixture
def exported_problem(examples_paths):
    research, _ = examples_paths
    return json.loads(research.read_text(encoding="utf-8"))[0]


class TestFromExample:
    def test_書き出した問題から同じ盤面と指令を復元すること(self, exported_problem):
        problem = from_example(exported_problem)

        assert problem.request == exported_problem["queue"]
        assert [(v.row, v.column, v.direction, v.length) for v in problem.vehicles] == [
            (v["row"], v["column"], v["orientation"], v["length"]) for v in exported_problem["board"]["vehicles"]]
        assert problem.game(exported_problem["bayCount"]).solution_count() == exported_problem["features"]["solutions"]


@pytest.fixture
def committed_selection():
    root = Path(__file__).resolve().parent
    selection = json.loads((root / "parking_jam_dispatch_levels.selection.json").read_text(encoding="utf-8"))
    examples = json.loads((root / "parking_jam_dispatch_levels.examples.json").read_text(encoding="utf-8"))
    return selection, examples


class TestBuild:
    def test_選択一覧だけから問題例を作り直せること(self, committed_selection):
        selection, examples = committed_selection

        result = build(selection)

        assert result == examples

    def test_各問に指定の枠数での解の数が入っていること(self, committed_selection):
        _, examples = committed_selection

        counts = [from_example(e).game(e["bayCount"]).solution_count() for e in examples]

        assert counts == [e["solutions"] for e in examples]
