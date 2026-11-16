"""Research-only, obstruction-first construction of dispatch request sequences.

A target is made the next requested color *before* its minimum set of
removable blockers. This is a construction, not a difficulty or quality model.
The generated sequence is derived from a legal exit sequence so at least one
completion exists when the waiting capacity accommodates the motif.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
import json
import random
import time

from parking_jam_rule_space import legal, make_board, make_dispatch_queue, positions


class DispatchSubsetSolver:
    """Exact solver: for one-pass dispatch, the removed-car subset is the state.

    The request prefix already served is the longest prefix whose per-color
    demands can be supplied by the removed cars. Waiting cars with the same
    color are equivalent, since each boards once and never re-enters the lot.
    """

    def __init__(self, vehicles, colors, bays, request, geometry=True):
        self.vehicles = vehicles
        self.colors = colors
        self.bays = bays
        self.request = request
        self.geometry = geometry
        self.full = (1 << len(vehicles)) - 1
        self.color_masks = {
            c: sum(1 << i for i, color in enumerate(colors) if color == c)
            for c in set(colors)
        }
        self.progress_cache = {}
        self.outcome_cache = {}
        self.delay_cache = {}

    def progress(self, mask):
        cached = self.progress_cache.get(mask)
        if cached is not None:
            return cached
        removed = self.full & ~mask
        available = {c: (removed & bits).bit_count()
                     for c, bits in self.color_masks.items()}
        head = 0
        for c in self.request:
            if available.get(c, 0) == 0:
                break
            available[c] -= 1
            head += 1
        self.progress_cache[mask] = head
        return head

    def options(self, mask):
        waiting = (self.full ^ mask).bit_count() - self.progress(mask)
        if waiting >= self.bays:
            return []
        if self.geometry:
            return legal(self.vehicles, mask)
        return [i for i in range(len(self.vehicles)) if mask & (1 << i)]

    def outcomes(self, mask):
        cached = self.outcome_cache.get(mask)
        if cached is not None:
            return cached
        if mask == 0:
            answer = (int(self.progress(mask) == len(self.request)),
                      float(self.progress(mask) == len(self.request)))
        else:
            moves = self.options(mask)
            children = [self.outcomes(mask & ~(1 << i)) for i in moves]
            answer = (sum(x[0] for x in children),
                      sum(x[1] for x in children) / len(children) if children else 0.)
        self.outcome_cache[mask] = answer
        return answer

    def max_progress_from_losing(self, mask):
        if mask in self.delay_cache:
            return self.delay_cache[mask]
        moves = self.options(mask)
        answer = 1 + max(self.max_progress_from_losing(mask & ~(1 << i)) for i in moves) if moves else 0
        self.delay_cache[mask] = answer
        return answer

    def early_geometry_witness(self, depth_limit=3):
        """One reproducible choice: a winnable state with a delayed bad exit."""
        if self.outcomes(self.full)[0] == 0:
            return None
        unrestricted = DispatchSubsetSolver(self.vehicles, self.colors,
                                            self.bays, self.request, geometry=False)
        frontier = deque([(self.full, ())])
        seen = {self.full}
        while frontier:
            mask, path = frontier.popleft()
            steps = [(i, mask & ~(1 << i)) for i in self.options(mask)]
            good = [i for i, child in steps if self.outcomes(child)[0] > 0]
            if not good:
                continue
            for move, child in steps:
                if self.outcomes(child)[0] > 0:
                    if len(path) < depth_limit and child not in seen:
                        seen.add(child)
                        frontier.append((child, (*path, move)))
                elif (self.max_progress_from_losing(child) >= 2
                      and unrestricted.outcomes(child)[0] > 0):
                    return {
                        'correctPrefix': list(path),
                        'badExit': move,
                        'goodExit': good[0],
                        'lostAfterAtMostAdditionalMoves': self.max_progress_from_losing(child),
                        'requestHead': self.progress(mask),
                        'waitingBefore': (self.full ^ mask).bit_count() - self.progress(mask),
                    }
        return None

    def has_early_geometry_choice(self, depth_limit=3):
        return self.early_geometry_witness(depth_limit) is not None


def prerequisite_path(vehicles, mask, target, limit):
    """Find a shortest legal exit prefix that unblocks target."""
    if not mask & (1 << target):
        return None
    seen = {mask}
    frontier = deque([(mask, ())])
    while frontier:
        remaining, prefix = frontier.popleft()
        available = legal(vehicles, remaining)
        if target in available:
            return prefix
        if len(prefix) >= limit:
            continue
        for vehicle in available:
            next_mask = remaining & ~(1 << vehicle)
            if next_mask not in seen:
                seen.add(next_mask)
                frontier.append((next_mask, (*prefix, vehicle)))
    return None


def complete_order(vehicles, start_mask, rng):
    result = []
    remaining = start_mask
    while remaining:
        choices = legal(vehicles, remaining)
        if not choices:
            raise ValueError('board construction must preserve solvability')
        selected = rng.choice(choices)
        result.append(selected)
        remaining &= ~(1 << selected)
    return result


def construct_queue(rng, vehicles, colors, bays, motifs):
    """Build a sequence with one or two explicit blocked-request episodes."""
    mask = (1 << len(vehicles)) - 1
    request = []
    descriptors = []
    for _ in range(motifs):
        legal_now = set(legal(vehicles, mask))
        targets = []
        for target in range(len(vehicles)):
            if not mask & (1 << target) or target in legal_now:
                continue
            # A paired color already exposed would satisfy the request without
            # revealing the obstruction; such motifs are not counted as designed.
            if any(colors[i] == colors[target] for i in legal_now):
                continue
            path = prerequisite_path(vehicles, mask, target, bays - 1)
            if path:
                targets.append((target, path))
        if not targets:
            break
        # Sample from the actual obstruction motifs, rather than drawing an
        # arbitrary complete exit order and rearranging a color sequence.
        target, prefix = rng.choice(targets)
        request.extend((colors[target], *(colors[i] for i in prefix)))
        descriptors.append({'target': target, 'prerequisites': list(prefix)})
        for index in (*prefix, target):
            mask &= ~(1 << index)
    if len(descriptors) != motifs:
        return None
    request.extend(colors[i] for i in complete_order(vehicles, mask, rng))
    return request, descriptors


def distinct_sequences(rng, vehicles, colors, bays, count, motifs):
    found = {}
    for _ in range(count):
        candidate = construct_queue(rng, vehicles, colors, bays, motifs)
        if candidate is not None:
            request, structure = candidate
            found.setdefault(tuple(request), structure)
        if len(found) >= count:
            break
    return list(found.items())


def geometry_colors(rng, vehicles, bays):
    """Reserve a color for two initially blocked cars before pairing the rest."""
    full = (1 << len(vehicles)) - 1
    available = set(legal(vehicles, full))
    blocked = [i for i in range(len(vehicles)) if i not in available
               and prerequisite_path(vehicles, full, i, bays - 1)]
    if len(blocked) < 2:
        return None
    rng.shuffle(blocked)
    blocked.sort(key=lambda i: len(prerequisite_path(vehicles, full, i, bays - 1)), reverse=True)
    targets = blocked[:2]
    remaining = [i for i in range(len(vehicles)) if i not in targets]
    rng.shuffle(remaining)
    colors = [''] * len(vehicles)
    for i in targets:
        colors[i] = 'A'
    for pair_index in range(len(remaining) // 2):
        for i in remaining[2 * pair_index:2 * pair_index + 2]:
            colors[i] = chr(66 + pair_index)
    return colors


def measure(rng, vehicles, colors, bays, count, construction):
    if construction in ('random', 'geometry-colors-only'):
        requests = []
        seen = set()
        for _ in range(count):
            q = tuple(make_dispatch_queue(rng, vehicles, colors))
            if q not in seen:
                seen.add(q)
                requests.append((q, []))
            if len(requests) >= count:
                break
    else:
        requests = distinct_sequences(rng, vehicles, colors, bays, count,
                                     1 if construction == 'single-target' else 2)
    counters = Counter()
    examples = []
    qualified_contexts = []
    qualified_motifs = []
    for request, structure in requests:
        counters['evaluated'] += 1
        solver = DispatchSubsetSolver(vehicles, colors, bays, list(request))
        solutions, random_win = solver.outcomes(solver.full)
        if not solutions:
            counters['unsolvable'] += 1
            continue
        counters['solvable'] += 1
        if not 0.05 <= random_win <= 0.5:
            continue
        counters['tolerance'] += 1
        witness = solver.early_geometry_witness()
        if witness is not None:
            counters['proxyQualified'] += 1
            qualified_contexts.append((tuple(witness['correctPrefix']), witness['badExit']))
            qualified_motifs.append(tuple((part['target'], tuple(part['prerequisites']))
                                           for part in structure))
            if len(examples) < 2:
                bad_initial = sum(solver.outcomes(solver.full & ~(1 << i))[0] == 0
                                  for i in solver.options(solver.full))
                examples.append({'request': list(request), 'motifs': structure,
                                 'witness': witness,
                                 'randomWinProb': round(random_win, 5),
                                 'initialBad': bad_initial})
    return {'attempted': count, **{key: counters[key] for key in
            ('evaluated', 'solvable', 'unsolvable', 'tolerance', 'proxyQualified')},
            'examples': examples, 'qualifiedContexts': qualified_contexts,
            'qualifiedMotifs': qualified_motifs}


def run(seed, boards_per_size, requests_per_board):
    result = []
    for n, side, bays in ((8, 7, 3), (8, 7, 4), (12, 8, 4), (12, 8, 5)):
        pool = positions(side)
        methods = ('random', 'geometry-colors-only', 'single-target', 'double-target')
        records = {name: [] for name in methods}
        begun = time.monotonic()
        for board_index in range(boards_per_size):
            rng = random.Random(seed + 100_003 * n + 7_919 * bays + board_index)
            board = None
            while board is None:
                board = make_board(rng, pool, n)
            colors = [chr(65 + j) for j in range(n // 2) for _ in range(2)]
            rng.shuffle(colors)
            motif_colors = geometry_colors(random.Random(seed + 23_011 * n + 19_991 * bays + board_index), board, bays)
            for method in records:
                local_rng = random.Random(seed + 100_003 * n + 7_919 * bays + 101 * board_index + 1_009 * methods.index(method))
                sampled_colors = colors if method == 'random' else motif_colors
                measured = (measure(local_rng, board, sampled_colors, bays, requests_per_board, method)
                            if sampled_colors is not None else
                            {'evaluated': 0, 'solvable': 0, 'unsolvable': 0, 'tolerance': 0,
                             'proxyQualified': 0, 'examples': [],
                             'qualifiedContexts': [], 'qualifiedMotifs': []})
                measured['boardIndex'] = board_index
                measured['colors'] = sampled_colors
                measured['vehicles'] = [{'row': v.row, 'column': v.column,
                                         'orientation': v.direction, 'length': v.length}
                                        for v in board]
                records[method].append(measured)
        result.append({'vehicles': n, 'board': f'{side}×{side}', 'bays': bays,
                       'boards': boards_per_size, 'budgetPerBoard': requests_per_board,
                       'runtimeSeconds': round(time.monotonic() - begun, 2),
                       'byMethod': {method: {
                           **{field: sum(row[field] for row in rows) for field in
                              ('evaluated', 'solvable', 'unsolvable', 'tolerance', 'proxyQualified')},
                           'boardsWithQualified': sum(row['proxyQualified'] > 0 for row in rows),
                           'boardsWithAnyCandidate': sum(row['evaluated'] > 0 for row in rows),
                           'uniqueObservedDecisionContexts': len({(row['boardIndex'], tuple(path), bad)
                               for row in rows for path, bad in row['qualifiedContexts']}),
                           'uniqueConstructedMotifs': len({(row['boardIndex'], repr(motif))
                               for row in rows for motif in row['qualifiedMotifs']}),
                           'examples': [{'boardIndex': row['boardIndex'],
                                         'vehicles': row['vehicles'], 'colors': row['colors'], **example}
                                        for row in rows for example in row['examples']][:4],
                       } for method, rows in records.items()}})
    return {'seed': seed, 'criterion': '5-50% random-legal win and early delayed geometry-dependent losing choice',
            'results': result}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=738)
    parser.add_argument('--boards', type=int, default=8)
    parser.add_argument('--requests', type=int, default=5)
    args = parser.parse_args()
    print(json.dumps(run(args.seed, args.boards, args.requests), ensure_ascii=False, indent=2))
