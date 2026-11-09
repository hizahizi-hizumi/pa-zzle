"""Research puzzle branching and parking geometry for competing waiting-bay rules.

The analysis uses the independently implemented departure geometry in
parking_jam_rule_space.py. The baseline deliberately has no hidden information.
"""

from __future__ import annotations

from collections import Counter
from functools import lru_cache
import argparse
import json
import random
from statistics import mean

from parking_jam_rule_space import Vehicle, legal, make_board, make_dispatch_queue, make_queue, positions, sequence


class RuleExplorer:
    def __init__(self, vehicles: tuple[Vehicle, ...], colors: list[str], mode: str, bays: int, queue: list[str] | None = None, block: bool = True):
        self.vehicles = vehicles
        self.colors = colors
        self.mode = mode
        self.bays = bays
        self.queue = queue or []
        self.full_mask = (1 << len(vehicles)) - 1
        self.block = block

    def legal(self, mask: int) -> list[int]:
        return legal(self.vehicles, mask) if self.block else [i for i in range(len(self.vehicles)) if mask & 1 << i]

    def step(self, state: tuple[int, tuple[tuple[int, int], ...], int], pick: int) -> tuple[int, tuple[tuple[int, int], ...], int]:
        mask, waiting, head = state
        slots = [*waiting, (pick, 0)]
        if self.mode == "pair":
            counts = Counter(self.colors[i] for i, _ in slots)
            slots = [(i, n) for i, n in slots if counts[self.colors[i]] < 2]
        else:
            while head < len(self.queue):
                found = next((j for j, (i, _) in enumerate(slots) if self.colors[i] == self.queue[head]), None)
                if found is None:
                    break
                i, filled = slots[found]
                filled += 1
                head += 1
                if filled == (1 if self.mode == "dispatch" else self.vehicles[i].length):
                    slots.pop(found)
                else:
                    slots[found] = (i, filled)
        return mask & ~(1 << pick), tuple(slots), head

    def options(self, state):
        if len(state[1]) >= self.bays:
            return []
        return self.legal(state[0])

    def complete(self, state):
        return state[0] == 0 and not state[1] and state[2] == len(self.queue)

    @lru_cache(None)
    def outcomes(self, state):
        if self.complete(state):
            return 1, 1.0
        moves = self.options(state)
        if not moves:
            return 0, 0.0
        children = [self.outcomes(self.step(state, i)) for i in moves]
        return sum(child[0] for child in children), mean(child[1] for child in children)

    @lru_cache(None)
    def max_progress_from_losing(self, state):
        moves = self.options(state)
        if not moves:
            return 0
        return 1 + max(self.max_progress_from_losing(self.step(state, i)) for i in moves)

    def summary(self, detailed=False):
        start = (self.full_mask, (), 0)
        solutions, random_chance = self.outcomes(start)
        if not detailed:
            return dict(solvable=solutions > 0, initialBad=sum(self.outcomes(self.step(start, i))[0] == 0 for i in self.options(start)), randomWinProb=round(random_chance, 5), numSolutions=solutions)
        if not solutions:
            return dict(solvable=False, initialBad=None, randomWinProb=0, numSolutions=0)
        states = set([start])
        frontier = [start]
        while frontier:
            state = frontier.pop()
            for pick in self.options(state):
                next_state = self.step(state, pick)
                if self.outcomes(next_state)[0] <= 0 or next_state in states:
                    continue
                states.add(next_state)
                frontier.append(next_state)
        bad_options = []
        good_decisions = 0
        crucial_geometry = 0
        delayed_geometry = 0
        without = RuleExplorer(self.vehicles, self.colors, self.mode, self.bays, self.queue, block=False)
        for state in states:
            opts = self.options(state)
            if len(opts) < 2:
                continue
            good = [i for i in opts if self.outcomes(self.step(state, i))[0] > 0]
            bad = [i for i in opts if i not in good]
            if good and bad:
                good_decisions += 1
                for i in bad:
                    child = self.step(state, i)
                    bad_options.append(self.max_progress_from_losing(child))
                    if without.outcomes(child)[0] > 0:
                        crucial_geometry += 1
                        if bad_options[-1] >= 2:
                            delayed_geometry += 1
        return dict(
            solvable=True,
            initialBad=sum(self.outcomes(self.step(start, i))[0] == 0 for i in self.options(start)),
            randomWinProb=round(random_chance, 5), numSolutions=solutions,
            winningReachableStates=len(states),
            losingDecisionStates=good_decisions,
            geometryEssentialBadChoices=crucial_geometry,
            delayedGeometryBadChoices=delayed_geometry,
            badChoices=len(bad_options),
            nontrivialBadChoices=sum(v >= 2 for v in bad_options),
            deepBadChoices=sum(v >= 3 for v in bad_options),
            maxDelayBeforeForcedStall=max(bad_options, default=None),
        )


def run(seed: int = 20261109, per_size: int = 60, details: bool = True):
    rng = random.Random(seed)
    all_rows = []
    for n, side in [(8, 7), (12, 8)]:
        candidates = positions(side)
        selected = 0
        attempts = 0
        stats = {}
        while selected < per_size:
            attempts += 1
            board = make_board(rng, candidates, n)
            if board is None:
                continue
            colors = [chr(ord('A')+i) for i in range(n//2) for _ in (0,1)]
            rng.shuffle(colors)
            queue = make_queue(rng, board, colors)
            dispatch = make_dispatch_queue(rng, board, colors)
            for mode, bays, requests in [("pair",2,[]),("pair",3,[]),("pair",4,[]),("queue",3,queue),("dispatch",2,dispatch),("dispatch",3,dispatch)]:
                key = f"{mode}{bays}"
                expl = RuleExplorer(board, colors, mode, bays, requests)
                item = expl.summary(detailed=details)
                stats.setdefault(key, []).append(item)
            selected += 1
        result = {"size":n,"attempts":attempts,"seed":seed,"sampleCount":selected,"variants":{}}
        for key, items in stats.items():
            solvable = [x for x in items if x["solvable"]]
            result['variants'][key] = {
                'solvable':len(solvable),
                'hasLosingRoot': sum(x['solvable'] and x['initialBad']>0 for x in items),
                'meanRandomWinProbSolvable':round(mean(x['randomWinProb'] for x in solvable),4) if solvable else None,
                'meanRandomWinProbAll':round(mean(x['randomWinProb'] for x in items),4),
            }
            if details:
                result['variants'][key].update({
                    'proxyQualified':sum(x['delayedGeometryBadChoices'] > 0 and 0.03 <= x['randomWinProb'] <= 0.5 for x in solvable),
                    'anyDelayedGeometryBadChoice':sum(x['delayedGeometryBadChoices'] > 0 for x in solvable),
                    'anyGeometryEssential':sum(x['geometryEssentialBadChoices']>0 for x in solvable),
                    'meanGeometryEssentialCount':round(mean(x['geometryEssentialBadChoices'] for x in solvable),2) if solvable else None,
                    'anyNontrivialBadChoice':sum(x['nontrivialBadChoices']>0 for x in solvable),
                    'anyDeepBadChoice':sum(x['deepBadChoices']>0 for x in solvable),
                    'meanDecisionStates':round(mean(x['losingDecisionStates'] for x in solvable),1) if solvable else None,
                })
        all_rows.append(result)
    return all_rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sample', type=int, default=60)
    parser.add_argument('--seed', type=int, default=20261109)
    parser.add_argument('--fast', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run(args.seed,args.sample,not args.fast),indent=2,ensure_ascii=False))
