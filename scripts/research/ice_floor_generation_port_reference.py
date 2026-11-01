"""氷の床迷路の生成 v2・v4 を TypeScript へ移した実装と突き合わせるための参照値を書き出す。

生成 v2（ice_floor_tactic_generation_experiment）と v4（ice_floor_hardest_generation_experiment）の
特徴量・目的関数・採用条件・盤面の外への置き換えを、固定の盤面で求めて JSON にする。

- v4: 試遊候補9問（/tmp/v4-candidates.json の盤面。無ければ試遊ページv4.html から読む）と、
  固定 seed のランダム盤面（要素つき）。
- v2: 試遊候補20問（/tmp/v2-candidates.json）と、固定 seed のランダム盤面（氷と岩だけ）。

Python標準ライブラリだけを使う。
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import Shape  # noqa: E402
from ice_floor_dynamic_generation_experiment import Puzzle  # noqa: E402
from ice_floor_hard_generation_experiment import features_of  # noqa: E402
from ice_floor_hardest_generation_experiment import (  # noqa: E402
    DYN_DEPTH_CAP,
    Recipe,
    Weights,
    dynamic_depth,
    evaluate,
    explore,
    hardness,
    measure_puzzle,
    outside_marked,
    random_puzzle,
    rules_of,
    score_of,
    violations,
)
from ice_floor_supply_experiment import ROCK, Board  # noqa: E402
from ice_floor_tactic_generation_experiment import (  # noqa: E402
    LEVELS,
    Weights as TacticWeights,
    board_graph,
    evaluate_tactics,
    shallow_depth,
    tactic_score,
    tactics_of,
    tags_of,
    weights_for,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "frontend/src/games/ice-floor-maze/problem/generation/research-reference.json"
)
PLAYTEST_V4 = REPO_ROOT / "docs/パズル/導入調査/氷の床迷路/作り直し資料/試遊ページv4.html"

VIOLATION_KEYS = {
    "最短手数": "shortest",
    "最短解が複数": "multiple-solutions",
    "条件1: 同じ向きが続く": "repeated-direction",
    "条件1: もろい岩の連鎖": "brittle-chain",
    "条件2: 効かない要素": "irrelevant-element",
    "条件2: おとり不足": "few-decoys",
    "要素の数": "element-count",
    "要素の内訳": "element-mix",
    "使う回数": "few-uses",
    "静的な近道": "static-shortcut",
    "一本道": "forced",
}
TAG_KEYS = {
    "止め石": "stopper",
    "回り込み": "wrap-around",
    "通過の誘い": "pass-lure",
    "入り直し": "reentry",
    "詰みの誘い": "trap-lure",
    "通過で詰む": "pass-trap",
    "知らせのない詰み": "silent-trap",
    "遠回り": "detour",
    "遠回り2回": "double-detour",
    "逆算3段": "backward-funnel",
    "分かれ道": "fork",
}
# TypeScript 側の比較用の生成条件（v4 の両方の盤面 10×10 と同じ範囲）
V4_RECIPE = Recipe("reference", "mixed", Shape(10, 10), 12, 19, 3, 8, min_each=0)


def v4_candidates() -> list[dict]:
    path = Path("/tmp/v4-candidates.json")
    if path.exists():
        return json.loads(path.read_text())
    text = PLAYTEST_V4.read_text()
    found = re.search(r"const PROBLEMS = (\[.*?\]);", text, re.S)
    assert found, "試遊ページv4.html に問題の配列が無い"
    return json.loads(found.group(1))


def puzzle_of(entry: dict) -> Puzzle:
    w = entry["width"]
    sx, sy = entry["start"]
    gx, gy = entry["goal"]
    return Puzzle("mixed", w, entry["height"], "".join(entry["rows"]), sy * w + sx, gy * w + gx)


def metrics_entry(p: Puzzle) -> dict:
    m = measure_puzzle(p)
    assert m is not None
    g = explore(rules_of(p), p.start, p.goal, cap=10**7)
    return {
        "shortest": m.shortest,
        "solutionCount": m.plans,
        "stateCount": m.states,
        "nearExtraStateCount": m.near_extra,
        "deadStateCount": m.dead_states,
        "forcedMoveCount": m.forced,
        "lureCount": m.lures,
        "deadOptionCount": m.dead_options,
        "useCount": m.uses,
        "changedElementCount": m.distinct,
        "elementCount": m.elements,
        "brittleCount": m.brittle,
        "thinCount": m.thin,
        "unusedCellCount": m.unused,
        "roles": [r.replace("_", "-") for r in m.roles],
        "precedenceCount": m.precedence,
        "softPrecedenceCount": m.soft_precedence,
        "orderChain": m.order_chain,
        "orderTrapCount": m.order_traps,
        "orderLureCount": m.order_lures,
        "solutionRepeatCount": m.solution_repeats,
        "nearRepeatCount": m.near_repeats,
        "brittleChainCount": m.chains,
        "repeatMoveCount": m.repeat_moves,
        "liveRepeatMoveCount": m.repeat_live,
        "looks": {"shortest": m.looks.shortest, "passesOriginalRules": m.looks.canonical_valid},
        "other": {"shortest": m.other.shortest, "passesOriginalRules": m.other.canonical_valid},
        "solution": list(m.solution),
        "looksReading": m.looks_class,
        "hardness": round(hardness(m, Weights()), 6),
        "score": round(score_of(m, V4_RECIPE), 6),
        "violations": [VIOLATION_KEYS[v] for v in violations(m, V4_RECIPE)],
        "stateReadingDepth": dynamic_depth(p, DYN_DEPTH_CAP, g),
    }


def outside_entry(p: Puzzle) -> dict:
    q = outside_marked(p)
    return {"width": q.width, "rows": q.rows, "start": q.start, "goal": q.goal}


def v4_reference(seed: int, samples: int) -> dict:
    candidates = []
    for entry in v4_candidates():
        p = puzzle_of(entry)
        candidates.append(
            {
                "id": entry["id"],
                "rows": p.rows,
                "start": p.start,
                "goal": p.goal,
                "metrics": metrics_entry(p),
            }
        )
    rng = random.Random(f"{seed}-port-v4")
    boards = []
    while len(boards) < samples:
        p = random_puzzle(rng, Shape(rng.choice((6, 7, 8)), rng.choice((7, 8, 9))))
        g = explore(rules_of(p), p.start)
        if g is None:
            continue
        n = g.rules.n
        spots = sorted({s % n for s in g.order if p.cells[s % n] == "." and s % n != p.start})
        if not spots:
            continue
        q = replace(p, goal=rng.choice(spots))
        score, goal, _ = evaluate(q, V4_RECIPE)
        boards.append(
            {
                "rows": q.rows,
                "start": q.start,
                "goal": q.goal,
                "metrics": metrics_entry(q),
                "outside": outside_entry(q),
                "evaluation": {"score": round(score, 6), "goal": goal},
            }
        )
    return {
        "recipe": {
            "shortest": [V4_RECIPE.lo, V4_RECIPE.hi],
            "elements": [V4_RECIPE.min_elements, V4_RECIPE.max_elements],
            "minimumEach": V4_RECIPE.min_each,
        },
        "candidates": candidates,
        "boards": boards,
    }


def tactics_entry(board: Board, start: int, goal: int) -> dict:
    rock = [t == ROCK for t in board.cells]
    g = board_graph(board.width, board.height, rock, start)
    t = tactics_of(g, start, goal)
    f = features_of(board, start, goal)
    l1 = LEVELS[0].recipe.search_weights
    return {
        "tactics": {
            "shortest": t.shortest,
            "optimalPathCount": t.optimal_paths,
            "nearStateCount": t.near_states,
            "deadStateCount": t.dead_states,
            "passLureCount": t.pass_lures,
            "passTrapCount": t.pass_traps,
            "passSlideCount": t.pass_slides,
            "trapOptionCount": t.trap_options,
            "trapLureCount": t.trap_lures,
            "silentTrapLureCount": t.silent_trap_lures,
            "reentryCount": t.reentries,
            "wraps": t.wrap,
            "funnelDepth": t.funnel,
            "entryCount": t.entries,
            "forkCount": t.forks,
            "lureStepCount": t.lure_steps,
            "forcedMoveCount": t.forced,
            "falseLeadCount": t.false_leads,
            "detourCount": t.detours,
            "awayRunCount": t.away_runs,
            "goalRockStop": t.goal_rock_stop,
            "rockStopCount": t.rock_stops,
            "relevantRockCount": t.relevant_rocks,
        },
        "tags": [TAG_KEYS[tag] for tag in tags_of(t)],
        "shallowDepth": shallow_depth(g, start, goal, 3),
        "humanDepth": f.human_depth,
        "nearPathCount": f.near_paths,
        "defaultScore": round(tactic_score(t, TacticWeights(), board.width * board.height), 6),
        "levelOneScore": round(tactic_score(t, l1, board.width * board.height), 6),
    }


def v2_reference(seed: int, samples: int) -> dict:
    candidates = []
    for entry in json.loads(Path("/tmp/v2-candidates.json").read_text()):
        w, h = entry["width"], entry["height"]
        board = Board(w, h, "".join(entry["rows"]))
        sx, sy = entry["start"]
        gx, gy = entry["goal"]
        start, goal = sy * w + sx, gy * w + gx
        candidates.append(
            {"id": entry["id"], "rows": entry["rows"], "start": start, "goal": goal}
            | tactics_entry(board, start, goal)
        )
    rng = random.Random(f"{seed}-port-v2")
    weights = weights_for(("止め石", "回り込み"), ("詰みの誘い",))
    boards = []
    while len(boards) < samples:
        w, h = rng.choice(((8, 8), (10, 10), (8, 10)))
        rock = [rng.random() < 0.22 for _ in range(w * h)]
        ice = [c for c in range(w * h) if not rock[c]]
        start = rng.choice(ice)
        score, goal, shortest = evaluate_tactics(w, h, rock, start, 6, 12, weights)
        if not shortest:
            continue
        board = Board(w, h, "".join(ROCK if r else "." for r in rock))
        boards.append(
            {
                "rows": [board.cells[y * w : (y + 1) * w] for y in range(h)],
                "start": start,
                "goal": goal,
                "evaluation": {"score": round(score, 6), "goal": goal, "shortest": shortest},
            }
            | tactics_entry(board, start, goal)
        )
    return {
        "evaluationRecipe": {
            "shortest": [6, 12],
            "required": ["stopper", "wrap-around"],
            "forbidden": ["trap-lure"],
        },
        "candidates": candidates,
        "boards": boards,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--v4-samples", type=int, default=12)
    parser.add_argument("--v2-samples", type=int, default=12)
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    reference = {
        "v4": v4_reference(args.seed, args.v4_samples),
        "v2": v2_reference(args.seed, args.v2_samples),
    }
    Path(args.output).write_text(json.dumps(reference, ensure_ascii=False) + "\n")
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
