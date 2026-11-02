"""氷の床迷路の押し出す雪・滑る氷の塊（生成 v5・v6）を TypeScript へ移した実装と突き合わせる参照値を書き出す。

ice_floor_persistent_generation_experiment（v6 の規則: 押し出す雪・押し進む滑る岩）の規則・状態のグラフ・特徴量・
自作依存の点・盤面の外への置き換えを、固定の盤面で求めて JSON にする。

- 試遊候補（v6 の q01〜q10 と、v5 の滑る岩の候補5問）。盤面はこのファイルに書き写してある。
- 固定 seed のランダム盤面（雪・滑る岩・薄い氷の組み合わせ）。ゴールは、開始位置から最も遠い手数で止まれる氷のマス。

Python標準ライブラリだけを使う。
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import Shape  # noqa: E402
from ice_floor_dynamic_generation_experiment import Puzzle  # noqa: E402
from ice_floor_persistent_generation_experiment import (  # noqa: E402
    ICE,
    SLIDER,
    SNOW,
    THIN,
    explore,
    measure_puzzle,
    outside_marked,
    random_puzzle,
    rules_of,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = (
    REPO_ROOT / "frontend/src/games/ice-floor-maze/problem/generation/persistent-reference.json"
)

# 試遊候補（id, 種類, 盤面, 開始位置 [x, y], ゴール [x, y]）。滑る岩の文字 m は製品の滑る氷の塊と同じ。
CANDIDATES = [
    ("q01", "snow", ["........", ".#..#...", "s...ss..", ".#.#..s.", "##.s....", ".#.s....", "......#.", "######x#"], (6, 4), (2, 0)),
    ("q02", "slider", ["..m..#x", "..#.m.#", ".....m#", "..#....", "##.....", "#.##...", "..m..m."], (4, 4), (4, 2)),
    ("q03", "snow_thin", [".###.##", ".#.s...", "...c.#.", "c...#..", ".#..cc#", "c##..c.", "...s.##"], (0, 6), (4, 5)),
    ("q04", "slider_thin", ["###..##", "...#...", "....c#c", ".cm..#m", ".mc....", "##.#.#.", "....c.."], (6, 1), (6, 4)),
    ("q05", "snow", ["x##.s...", "#..s...#", "##...s.#", ".#s.....", "...s..##", ".....s..", "##......", "xx#.s..."], (6, 3), (3, 7)),
    ("q06", "slider", ["##..##..", ".##.##..", "..m..#..", "..m...m.", "#.#.#..#", "#.#.#...", ".....m..", "..m....."], (1, 6), (2, 6)),
    ("q07", "snow", [".......#..", ".##..#.#.#", ".#...#.#.#", ".......#..", "..........", "#s...s..#.", "...s....s.", "...s.##...", "##.###....", ".........#"], (1, 6), (4, 6)),
    ("q08", "slider_thin", ["###x##....", ".c.#....m.", "c.###c##.#", "..#......#", "......###.", "..###.#...", ".....#..#.", "..c....##.", ".m....c..#", ".c........"], (5, 4), (1, 2)),
    ("q09", "slider", [".#x#.#....", "..#..#....", "..#.##.##.", "....m.....", "#....m.m..", "#.....#...", "..##.....#", "m...m....#", ".###.#.##x", "..#....#xx"], (0, 9), (8, 0)),
    ("q10", "snow_thin", ["...c....#.", "....c.....", "s....####.", ".#..#.##..", "#....s##..", ".#..#c....", "c....c##.#", "##.s..#...", "#.........", "x#..#....#"], (3, 4), (1, 6)),
    ("p01", "slider_thin", ["#....#.m..", "........#.", ".....####c", "....#.....", ".m.......c", "..#m#..#..", ".m.....#..", "....###.#c", "#.....#...", "...c.#x##."], (3, 0), (2, 0)),
    ("p04", "slider", ["....#..#..", "#...#....#", "##.#x##...", "....###.#.", "....m.....", "....###...", "...#.#.#..", "#......#.#", "#...m.....", "#.m...mm..", "#...#.....", "x#..#.#..."], (3, 4), (1, 5)),
    ("p07", "slider_thin", [".c......", "..#c..m.", ".#.....#", "...mm...", ".....#c#", "..c.m..#", "###....#", "#...###x"], (6, 3), (0, 2)),
    ("p08", "slider", [".#......", "m..m.#..", "..#m##.#", ".m..##..", ".##.....", ".##m.##.", "..#...##", "........"], (3, 7), (0, 3)),
    ("p10", "slider", [".#.m.....#", "........#.", "..m...#...", "...mm.....", "#.......#.", "#.m..##.#.", "........##", ".#.#.#....", "#...##.#..", "x###x#.###"], (7, 7), (2, 1)),
]  # fmt: skip

RANDOM_TILES = (
    ("snow", (SNOW,)),
    ("slider", (SLIDER,)),
    ("snow_thin", (SNOW, THIN)),
    ("slider_thin", (SLIDER, THIN)),
    ("snow_slider_thin", (SNOW, SLIDER, THIN)),
)
ROLE_KEYS = {"weak_decoy": "weak-decoy"}


def puzzle_of(variant: str, rows: list[str], start: tuple[int, int], goal: tuple[int, int]):
    width = len(rows[0])
    return Puzzle(
        variant,
        width,
        len(rows),
        "".join(rows),
        start[1] * width + start[0],
        goal[1] * width + goal[0],
    )


def entry_of(name: str, p: Puzzle) -> dict:
    m = measure_puzzle(p)
    assert m is not None, name
    dep = m.dep
    marked = outside_marked(p)
    return {
        "id": name,
        "rows": list(p.rows),
        "start": p.start,
        "goal": p.goal,
        "metrics": {
            "shortest": m.shortest,
            "solutionCount": m.plans,
            "stateCount": m.states,
            "nearExtraStateCount": m.near_extra,
            "deadStateCount": m.dead_states,
            "forcedMoveCount": m.forced,
            "lureCount": m.lures,
            "deadOptionCount": m.dead_options,
            "changedElementCount": m.distinct,
            "elementCount": m.elements,
            "unusedCellCount": m.unused,
            "roles": [ROLE_KEYS.get(role, role) for role in m.roles],
            "precedenceCount": m.precedence,
            "softPrecedenceCount": m.soft_precedence,
            "orderChain": m.order_chain,
            "orderTrapCount": m.order_traps,
            "orderLureCount": m.order_lures,
            "solutionRepeatCount": m.solution_repeats,
            "nearRepeatCount": m.near_repeats,
            "elementChainCount": m.chains,
            "repeatMoveCount": m.repeat_moves,
            "liveRepeatMoveCount": m.repeat_live,
            "solution": list(m.solution),
        },
        "dependence": {
            "selfMadeDependence": dep.score,
            "distantStopCount": dep.varied_stop,
            "variedUseCount": dep.varied_use,
            "quickReturnCount": dep.quick_return,
            "goalStopsOnSelfMade": bool(dep.goal_stop_self),
            "selfMadeUseCount": dep.uses,
            "shortSlideCount": dep.one_cell,
        },
        "outside": {
            "width": marked.width,
            "rows": list(marked.rows),
            "start": marked.start,
            "goal": marked.goal,
        },
    }


def farthest_goal(p: Puzzle) -> int | None:
    graph = explore(rules_of(p), p.start)
    if graph is None:
        return None
    n = p.width * p.height
    first: dict[int, int] = {}
    for state in graph.order:
        first.setdefault(state % n, graph.dist[state])
    spots = [c for c in first if p.cells[c] == ICE and c != p.start]
    return max(spots, key=lambda c: (first[c], -c)) if spots else None


def random_entries(seed: int, samples: int) -> list[dict]:
    rng = random.Random(f"{seed}-persistent-port")
    entries = []
    for variant, tiles in RANDOM_TILES:
        made = 0
        while made < samples:
            shape = Shape(rng.choice((5, 6, 7)), rng.choice((5, 6, 7)))
            p = replace(random_puzzle(rng, shape, tiles), variant=variant)
            goal = farthest_goal(p)
            if goal is None:
                continue
            entries.append(entry_of(f"{variant}-{made}", replace(p, goal=goal)))
            made += 1
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20261102)
    parser.add_argument("--samples", type=int, default=6)
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    reference = {
        "candidates": [
            entry_of(name, puzzle_of(variant, rows, start, goal))
            for name, variant, rows, start, goal in CANDIDATES
        ],
        "boards": random_entries(args.seed, args.samples),
    }
    Path(args.output).write_text(json.dumps(reference, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
