"""Cross-check constructive dispatch research against the independent full solver."""

import random
from collections import Counter

import pytest

from parking_jam_choice_quality import RuleExplorer
from parking_jam_dispatch_structured import (
    construct_queue,
    DispatchSubsetSolver,
    geometry_colors,
    prerequisite_path,
    run,
)
from parking_jam_rule_space import analyze, legal, make_board, positions


@pytest.fixture
def problem():
    rng = random.Random(738)
    pool = positions(7)
    for _ in range(100):
        board = make_board(rng, pool, 8)
        if board is None:
            continue
        colors = geometry_colors(rng, board, 4)
        if colors is not None and construct_queue(random.Random(738), board, colors, 4, 2) is not None:
            return board, colors
    pytest.fail("test fixture could not construct a blocked pair")


class TestPrerequisitePath:
    def test_遮断車を合法な出庫だけで解放できること(self, problem):
        board, _colors = problem
        full = (1 << len(board)) - 1
        blocked = next(i for i in range(len(board)) if i not in legal(board, full))
        path = prerequisite_path(board, full, blocked, 6)

        assert path is not None
        for vehicle in path:
            assert vehicle in legal(board, full)
            full &= ~(1 << vehicle)
        assert blocked in legal(board, full)


class TestGeometryColors:
    def test_色数が保持され初期に出庫できない同色2台があること(self, problem):
        board, colors = problem
        full = (1 << len(board)) - 1
        available = set(legal(board, full))

        assert sorted(Counter(colors).values()) == [2, 2, 2, 2]
        assert colors.count("A") == 2
        assert all(colors[i] != "A" for i in available)


class TestConstructQueue:
    @pytest.mark.parametrize("motifs", [1, 2])
    def test_構造を指定した指令が独立探索でも可解になること(self, problem, motifs):
        board, colors = problem
        rng = random.Random(738 + motifs)
        queue = None
        for _ in range(100):
            queue = construct_queue(rng, board, colors, 4, motifs)
            if queue:
                break
        assert queue is not None
        requests, described = queue
        solver = RuleExplorer(board, colors, "dispatch", 4, requests)
        independently = analyze(board, colors, "dispatch", 4, requests)

        assert Counter(requests) == Counter(colors)
        assert len(described) == motifs
        assert solver.outcomes((solver.full_mask, (), 0))[0] > 0
        assert solver.outcomes((solver.full_mask, (), 0))[0] == independently["solutions"]
        optimized = DispatchSubsetSolver(board, colors, 4, requests)
        ways, probability = optimized.outcomes(optimized.full)
        assert ways == independently["solutions"]
        assert abs(probability - solver.outcomes((solver.full_mask, (), 0))[1]) < 1e-9
        RuleExplorer.outcomes.cache_clear()
        RuleExplorer.max_progress_from_losing.cache_clear()


class TestRun:
    def test_同じseedで研究条件と計測結果が再現すること(self):
        first = run(738, 1, 2)
        second = run(738, 1, 2)

        for row in first["results"]:
            row.pop("runtimeSeconds")
        for row in second["results"]:
            row.pop("runtimeSeconds")
        assert first == second


class TestDispatchSubsetSolver:
    @pytest.mark.parametrize("seed", [7, 20, 738, 2026])
    def test_退出順の違いを状態へ混同せず独立探索と一致すること(self, seed):
        rng = random.Random(seed)
        pool = positions(7)
        board = make_board(rng, pool, 8)
        assert board is not None
        colors = [chr(65 + i) for i in range(4) for _ in range(2)]
        rng.shuffle(colors)
        from parking_jam_rule_space import make_dispatch_queue
        request = make_dispatch_queue(rng, board, colors)
        optimized = DispatchSubsetSolver(board, colors, 3, request)
        independent = analyze(board, colors, "dispatch", 3, request)
        original = RuleExplorer(board, colors, "dispatch", 3, request)

        ways, probability = optimized.outcomes(optimized.full)
        assert ways == independent["solutions"]
        assert abs(probability - original.outcomes((original.full_mask, (), 0))[1]) < 1e-9
        RuleExplorer.outcomes.cache_clear()
        RuleExplorer.max_progress_from_losing.cache_clear()


@pytest.fixture
def fixed_examples():
    from pathlib import Path
    import json

    path = Path(__file__).with_name("parking_jam_dispatch_structured.expected.json")
    return json.loads(path.read_text(encoding="utf-8"))["examples"]


class TestFixedExamples:
    @pytest.mark.parametrize("case_index", [0, 1, 2, 3])
    def test_保存した分岐例が別実装でも再現できること(self, fixed_examples, case_index):
        example = fixed_examples[case_index]
        assert example is not None
        side = 7 if example["vehicles"] == 8 else 8
        candidates = {(p.row, p.column, p.direction, p.length): p for p in positions(side)}
        board = tuple(candidates[(item["row"], item["column"], item["orientation"], item["length"])]
                      for item in example["vehicles"])
        colors = example["colors"]
        requests = example["request"]
        bays = example["bays"]
        witness = example["witness"]
        solver = DispatchSubsetSolver(board, colors, bays, requests)
        independent = analyze(board, colors, "dispatch", bays, requests)
        remaining = solver.full
        for index in witness["correctPrefix"]:
            assert index in solver.options(remaining)
            remaining &= ~(1 << index)
        wrong = remaining & ~(1 << witness["badExit"])
        right = remaining & ~(1 << witness["goodExit"])
        unconstrained = DispatchSubsetSolver(board, colors, bays, requests, geometry=False)

        assert solver.outcomes(solver.full)[0] == independent["solutions"]
        assert witness["badExit"] in solver.options(remaining)
        assert witness["goodExit"] in solver.options(remaining)
        assert solver.outcomes(wrong)[0] == 0
        assert solver.outcomes(right)[0] > 0
        assert solver.max_progress_from_losing(wrong) >= 2
        assert unconstrained.outcomes(wrong)[0] > 0

    def test_同じ退出済み集合なら待機車の並びにかかわらず指令消化数が一致すること(self, fixed_examples):
        example = fixed_examples[0]
        candidates = {(p.row, p.column, p.direction, p.length): p for p in positions(7)}
        board = tuple(candidates[(item["row"], item["column"], item["orientation"], item["length"])]
                      for item in example["vehicles"])
        original = RuleExplorer(board, example["colors"], "dispatch", example["bays"], example["request"])
        compressed = DispatchSubsetSolver(board, example["colors"], example["bays"], example["request"])
        states = [(original.full_mask, (), 0)]
        for state in states:
            if len(states) > 1800:
                break
            for i in original.options(state):
                states.append(original.step(state, i))
        checked = 0
        for mask, waiting, head in states:
            assert compressed.progress(mask) == head
            assert (compressed.full ^ mask).bit_count() - head == len(waiting)
            checked += 1
        assert checked > 10
