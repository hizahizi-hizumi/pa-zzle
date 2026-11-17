"""Reproducible, provisional selection-yield proxy for dispatch-and-wait puzzles.

These criteria are NOT a measured proxy for fun or human difficulty. They ask
whether a reasonably forgiving puzzle contains an early, geometry-dependent
mistake whose consequence is delayed.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
import random
from parking_jam_choice_quality import RuleExplorer
from parking_jam_rule_space import make_board, make_dispatch_queue, positions


def has_early_delayed_geometry_choice(exp: RuleExplorer, depth_limit: int = 3) -> bool:
    start = (exp.full_mask, (), 0)
    if exp.outcomes(start)[0] <= 0:
        return False
    without = RuleExplorer(exp.vehicles, exp.colors, exp.mode, exp.bays, exp.queue, block=False)
    seen = {start}
    frontier = [(start, 0)]
    while frontier:
        state, depth = frontier.pop()
        choices = exp.options(state)
        valid = [(move, exp.step(state, move)) for move in choices]
        if not any(exp.outcomes(child)[0] for _, child in valid):
            continue
        for _, child in valid:
            if exp.outcomes(child)[0]:
                if depth < depth_limit and child not in seen:
                    seen.add(child)
                    frontier.append((child, depth + 1))
            elif exp.max_progress_from_losing(child) >= 2 and without.outcomes(child)[0] > 0:
                return True
    return False


def sample(seed: int, per_size: int) -> list[dict[str, object]]:
    rng = random.Random(seed)
    results = []
    for vehicle_count, board_size in ((8, 7), (12, 8)):
        boards = 0
        attempts = 0
        counts = defaultdict(lambda: dict(solvable=0, forgiving=0, earlyPlanning=0, both=0))
        available = positions(board_size)
        while boards < per_size:
            attempts += 1
            board = make_board(rng, available, vehicle_count)
            if board is None:
                continue
            colors = [chr(ord("A") + index) for index in range(vehicle_count // 2) for _ in range(2)]
            rng.shuffle(colors)
            dispatch = make_dispatch_queue(rng, board, colors)
            for bays in (2, 3, 4, 5):
                result = counts[bays]
                exp = RuleExplorer(board, colors, "dispatch", bays, dispatch)
                info = exp.summary(detailed=False)
                if not info['solvable']:
                    continue
                result['solvable'] += 1
                forgiving = 0.05 <= info['randomWinProb'] <= 0.5
                result['forgiving'] += forgiving
                early = has_early_delayed_geometry_choice(exp)
                result['earlyPlanning'] += early
                result['both'] += forgiving and early
            boards += 1
        results.append(dict(vehicleCount=vehicle_count, board=f'{board_size}x{board_size}', tried=attempts, acceptedBoardGeometry=boards, variants=counts))
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=20261109)
    parser.add_argument('--sample', type=int, default=20)
    args = parser.parse_args()
    print(json.dumps(sample(args.seed, args.sample), ensure_ascii=False, indent=2))
