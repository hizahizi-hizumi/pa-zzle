"""Compare single-draw and multi-draw dispatch request construction on identical boards.

This is a research-only feasibility proxy, not a human difficulty or good-puzzle label.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
import random
import time

from parking_jam_choice_quality import RuleExplorer
from parking_jam_rule_space import legal, make_board, make_dispatch_queue, positions, sequence
from parking_jam_selection_poc import has_early_delayed_geometry_choice


def propose_queues(rng, vehicles, colors, count):
    initial_mask = (1 << len(vehicles)) - 1
    initial_legal = set(legal(vehicles, initial_mask))
    blocked_colors = [
        color for color in sorted(set(colors))
        if all(index not in initial_legal for index, candidate in enumerate(colors) if candidate == color)
    ]
    queues = []
    seen = set()
    attempts = 0
    while len(queues) < count and attempts < count * 20:
        attempts += 1
        order = sequence(rng, vehicles)
        origin = 'blocked-first' if attempts % 2 == 0 and blocked_colors else 'random'
        if origin == 'blocked-first':
            target = rng.choice(blocked_colors)
            queue = [target]
            remaining = [colors[i] for i in order]
            remaining.remove(target)
            queue.extend(remaining)
        else:
            queue = make_dispatch_queue(rng, vehicles, colors)
        key = tuple(queue)
        if key not in seen:
            seen.add(key)
            queues.append((queue, origin))
    return queues


def run(seed: int, boards_per_size: int, queues_per_board: int) -> dict:
    rng = random.Random(seed)
    sizes = [(8, 7), (12, 8)]
    result = []
    for n, side in sizes:
        stats = Counter()
        candidate_positions = positions(side)
        beginning = time.monotonic()
        candidate_approved = {bays: 0 for bays in (2, 3, 4, 5)}
        examples = []
        for _ in range(boards_per_size):
            board = None
            while board is None:
                stats['boardAttempts'] += 1
                board = make_board(rng, candidate_positions, n)
            colors = [chr(65 + j) for j in range(n // 2) for _ in range(2)]
            rng.shuffle(colors)
            queues = propose_queues(rng, board, colors, queues_per_board)
            stats['uniqueRequestQueues'] += len(queues)
            qualified_bays_this_board = set()
            for qi, (request, origin) in enumerate(queues):
                for bays in (2, 3, 4, 5):
                    stats[f'{bays}:examined'] += 1
                    stats[f'{bays}:evaluated:{origin}'] += 1
                    explorer = RuleExplorer(board, colors, 'dispatch', bays, request)
                    summary = explorer.summary()
                    if summary['solvable']:
                        stats[f'{bays}:solvable'] += 1
                    if not summary['solvable'] or not (0.05 <= summary['randomWinProb'] <= 0.5):
                        continue
                    stats[f'{bays}:tolerance'] += 1
                    if has_early_delayed_geometry_choice(explorer):
                        stats[f'{bays}:proxyQualified'] += 1
                        stats[f'{bays}:qualified:{origin}'] += 1
                        qualified_bays_this_board.add(bays)
                        if qi == 0:
                            stats[f'{bays}:firstQueueQualified'] += 1
                        if len(examples) < 6:
                            examples.append({
                                'bays': bays, 'candidateIndex': qi, 'origin': origin,
                                'randomWinProb': summary['randomWinProb'],
                                'vehicles': [{'row': v.row, 'column': v.column,
                                              'orientation': v.direction, 'length': v.length}
                                             for v in board],
                                'colors': colors, 'requestQueue': request,
                            })
            for bays in qualified_bays_this_board:
                candidate_approved[bays] += 1
        result.append({
            'vehicles': n, 'side': side, 'boards': boards_per_size,
            'requestedQueuesPerBoard': queues_per_board,
            'distinctQueuesTotal': stats['uniqueRequestQueues'],
            'candidateAttempts': stats['boardAttempts'],
            'qualifiedExamples': examples,
            'runtimeSeconds': round(time.monotonic() - beginning, 2),
            'byBays': {str(bays): {
                'evaluated': stats[f'{bays}:examined'],
                'solvable': stats[f'{bays}:solvable'],
                'inTolerance': stats[f'{bays}:tolerance'],
                'proxyQualified': stats[f'{bays}:proxyQualified'],
                'byConstruction': {origin: {
                    'evaluated': stats[f'{bays}:evaluated:{origin}'],
                    'qualified': stats[f'{bays}:qualified:{origin}'],
                } for origin in ('random', 'blocked-first')},
                'singleDrawBoardsWithQualified': stats[f'{bays}:firstQueueQualified'],
                'searchedBoardsWithQualified': candidate_approved[bays],
            } for bays in (2, 3, 4, 5)},
        })
    return {'seed':seed,'criterion': '5-50% random-legal win, early delayed geometry-dependent bad choice', 'results':result}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--seed', type=int, default=20261109)
    p.add_argument('--boards', type=int, default=12)
    p.add_argument('--queues', type=int, default=8)
    args = p.parse_args()
    print(json.dumps(run(args.seed,args.boards,args.queues),ensure_ascii=False,indent=2))
