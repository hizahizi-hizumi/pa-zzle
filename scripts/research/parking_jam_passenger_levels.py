"""Research-only lookahead measures and levels for the passenger-queue rule.

Move-level measures on top of `PassengerGame` (definitions; the identities are derived
here and checked in `test_parking_jam_passenger_levels.py` against an explicit game):

- A legal exit m at state s is losing when no continuation from step(s, m) wins. Its
  distance d(s, m) = max_reach(step(s, m)) - progress(s): how many passengers, counted
  from the head at s, best play still boards after m. A losing exit's stuck passenger
  is queue[progress(s) + d], so seeing that loss needs a window of d + 1 passengers.
- The h-reader avoids losing candidate exits with d < h and picks uniformly among its
  other candidates. Winning exits are never avoided, so until it loses it walks the
  states R reachable by winning candidate exits, whatever h is. It always wins iff no
  losing candidate on R has d >= h, so the needed lookahead L = 1 + max d over losing
  candidates on R (0 when there is none), and "always wins" is monotone in h. The
  winning probability p_h is monotone too: raising h only removes options whose value is 0.
- Candidates (variants, see `Variant`): nested tiers from head-color exits (else digging
  toward the head color) up to every legal exit. Where no candidate of a tier wins, the
  reader widens to the next tier (counted as `fallbackStates`).
- A losing exit is queue-only when it still loses on the blocking-free board (every
  car can always exit), and blocking-decided otherwise.

Levels (`level_of`) read the main reader's curve p_h: h90 (least h with p_h >= 0.9) sets
the band, Lv5 is a deep band where h50 is large too, and problems whose deepest trap lies
in a deeper band than h90, or that the naive policy wins too often, get no level.

It is a model for comparing candidate problems, not a measurement of human play.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
from dataclasses import dataclass
from fractions import Fraction
from multiprocessing import Pool

from parking_jam_dispatch_reading import iter_bits
from parking_jam_passenger_reading import PassengerGame, PassengerProblem, State, canonical, structural_canonical
from parking_jam_passenger_study import FRONTEND_SIDE, build, draw_conditions, mutate
from parking_jam_rule_space import positions

BAYS = (2, 3, 4)
SLACKS = (0, 1)
TRAP_THRESHOLDS = (1, 2, 3, 4, 6, 8)
FAVORABLE_OPENINGS = ("adjacent2", "one")


TIERS = ("cheapest", "headFirst", "run1", "run2", "run3", "all")


@dataclass(frozen=True)
class Variant:
    """A reader's candidate exits: the first tier, in order, that holds a winning exit.

    Tiers widen: `cheapest` (head-color exits, else digging toward the head-color car with
    the fewest direct blockers), `headFirst` (head-color exits, else `run1`), `runR` (cars
    of the next R color runs and their blockers), `all` (every legal exit).
    """
    name: str
    tiers: tuple[str, ...]


VARIANTS = {name: Variant(name, TIERS[TIERS.index(first):]) for name, first in (
    ("naive", "cheapest"), ("run1head", "headFirst"), ("run1", "run1"), ("run2", "run2"), ("run3", "run3"),
    ("all", "all"))}


def color_runs(passengers) -> int:
    return sum(1 for i, c in enumerate(passengers) if i == 0 or passengers[i - 1] != c)


def window_colors(queue_colors: list[int], head: int, runs: int) -> set[int]:
    colors: set[int] = set()
    seen_runs = 0
    for i in range(head, len(queue_colors)):
        if i == head or queue_colors[i] != queue_colors[i - 1]:
            seen_runs += 1
            if seen_runs > runs:
                break
        colors.add(queue_colors[i])
    return colors


def blocker_closure(sides, mask: int, seeds: int) -> int:
    """`seeds` plus every remaining car that blocks a ray of a car already in the set."""
    found = seeds
    frontier = seeds
    while frontier:
        added = 0
        for car in iter_bits(frontier):
            for ray in sides[car]:
                added |= ray & mask
        frontier = added & ~found
        found |= frontier
    return found


@dataclass(frozen=True)
class Node:
    winners: tuple[State, ...]
    losers: tuple[tuple[int, int, bool], ...]  # (car, distance, queue-only)
    fallback: bool


class LookaheadModel:
    def __init__(self, problem: PassengerProblem, bays: int):
        self.problem = problem
        self.bays = bays
        self.game = problem.game(bays)
        self.free = problem.game(bays, geometry=False)
        self.sides = self.game.sides

    def distance(self, state: State, car: int) -> int:
        return self.game.max_reach(self.game.step(state, car)) - self.game.progress(state)

    def tier(self, state: State, tier: str) -> tuple[int, ...]:
        game = self.game
        legal = game.moves(state)
        if tier == "all":
            return legal
        mask = state[0]
        head = game.progress(state)
        head_mask = game.color_mask[game.queue_colors[head]] & mask
        if tier in ("cheapest", "headFirst"):
            direct = tuple(i for i in legal if head_mask >> i & 1)
            if direct:
                return direct
            if tier == "cheapest":
                return tuple(i for i in legal if cheapest_dig(self.sides, mask, head_mask) >> i & 1)
            tier = "run1"
        colors = window_colors(game.queue_colors, head, int(tier[3:]))
        targets = sum(game.color_mask[c] for c in colors) & mask
        relevant = blocker_closure(self.sides, mask, targets)
        return tuple(i for i in legal if relevant >> i & 1)

    def candidates(self, state: State, variant: Variant) -> tuple[tuple[int, ...], bool]:
        """The variant's candidate exits at `state`, and whether a wider tier than its first was needed."""
        game = self.game
        for depth, tier in enumerate(variant.tiers):
            options = self.tier(state, tier)
            if any(game.wins(game.step(state, i)) for i in options):
                return options, depth > 0
        raise ValueError("candidates are asked only at winning states")

    def node(self, state: State, variant: Variant) -> Node:
        game = self.game
        options, fallback = self.candidates(state, variant)
        winners, losers = [], []
        for car in options:
            child = game.step(state, car)
            if game.wins(child):
                winners.append(child)
            else:
                losers.append((car, self.distance(state, car), not self.free.wins(child)))
        return Node(tuple(winners), tuple(losers), fallback)

    def graph(self, variant: Variant) -> dict[State, Node]:
        """Reader nodes on R, the winning states reachable from the start by winning candidate exits."""
        game = self.game
        if not game.wins(game.start):
            raise ValueError("the problem is not solvable with these bays")
        nodes: dict[State, Node] = {}
        order = [game.start]
        while order:
            state = order.pop()
            if state in nodes or state[0] == 0:
                continue
            nodes[state] = self.node(state, variant)
            order.extend(c for c in nodes[state].winners if c not in nodes)
        return nodes


def reader_win_probability(nodes: dict[State, Node], start: State, horizon: int, exact: bool = False):
    cache: dict[State, object] = {}
    one = Fraction(1) if exact else 1.0

    def value(state: State):
        if state[0] == 0:
            return one
        cached = cache.get(state)
        if cached is None:
            node = nodes[state]
            options = len(node.winners) + sum(1 for _, d, _ in node.losers if d >= horizon)
            cached = sum((value(c) for c in node.winners), 0 * one) / options
            cache[state] = cached
        return cached

    return value(start)


def run_distribution(nodes: dict[State, Node], start: State, marked: set[State]) -> dict[int, float]:
    """Distribution of marked states met on one run when winners are chosen uniformly."""
    cache: dict[State, dict[int, float]] = {}

    def visit(state: State) -> dict[int, float]:
        if state[0] == 0:
            return {0: 1.0}
        cached = cache.get(state)
        if cached is None:
            here = int(state in marked)
            children = nodes[state].winners
            merged: dict[int, float] = defaultdict(float)
            for child in children:
                for k, p in visit(child).items():
                    merged[k + here] += p / len(children)
            cached = dict(merged)
            cache[state] = cached
        return cached

    return visit(start)


def distribution_summary(distribution: dict[int, float]) -> dict[str, float]:
    keys = sorted(distribution)
    total = 0.0
    median = keys[-1]
    for k in keys:
        total += distribution[k]
        if total >= 0.5 - 1e-12:
            median = k
            break
    return {"min": keys[0], "median": median, "max": keys[-1],
            "mean": round(sum(k * p for k, p in distribution.items()), 4)}


def first_horizon(curve: list[float], level: float) -> int:
    return next(h for h, p in enumerate(curve) if p >= level - 1e-12)


def lookahead_profile(model: LookaheadModel, variant: Variant) -> dict[str, object]:
    game = model.game
    nodes = model.graph(variant)
    start = game.start
    queue = model.problem.queue
    traps = [(state, car, d, queue_only) for state, node in nodes.items() for car, d, queue_only in node.losers]
    distances = [d for _, _, d, _ in traps]
    lookahead = max(distances) + 1 if distances else 0
    curve = [round(reader_win_probability(nodes, start, h), 6) for h in range(lookahead + 1)]

    def window_runs(state: State, d: int) -> int:
        head = game.progress(state)
        return color_runs(queue[head:head + d + 1])

    def deepest(selected) -> int:
        return max((d for _, _, d, _ in selected), default=-1) + 1

    real = [t for t in traps if t[2] >= 1]
    queue_only = [t for t in real if t[3]]
    blocking = [t for t in real if not t[3]]
    trap_runs = {}
    for theta in TRAP_THRESHOLDS:
        marked = {s for s, node in nodes.items() if any(d >= theta for _, d, _ in node.losers)}
        trap_runs[str(theta)] = distribution_summary(run_distribution(nodes, start, marked))
    decision_states = {s for s, node in nodes.items() if any(d >= 1 for _, d, _ in node.losers)}
    blocking_states = {s for s in decision_states if all(not q for _, d, q in nodes[s].losers if d >= 1)}
    queue_states = {s for s in decision_states if all(q for _, d, q in nodes[s].losers if d >= 1)}
    return {
        "lookahead": lookahead,
        "lookaheadRuns": max((window_runs(s, d) for s, _, d, _ in traps), default=0),
        "lookaheadBlocking": deepest(blocking),
        "lookaheadQueueOnly": deepest(queue_only),
        "curve": curve,
        "h50": first_horizon(curve, 0.5),
        "h90": first_horizon(curve, 0.9),
        "states": len(nodes),
        "fallbackStates": sum(n.fallback for n in nodes.values()),
        "traps": len(real),
        "queueOnlyTraps": len(queue_only),
        "immediateTraps": len(traps) - len(real),
        "decisionStates": len(decision_states),
        "blockingDecisionStates": len(blocking_states),
        "queueDecisionStates": len(queue_states),
        "trapsOnRun": trap_runs,
    }


def immediate_stuck(game: PassengerGame, state: State, car: int) -> bool:
    return not game.alive(game.step(state, car))


def cheapest_dig(sides, mask: int, head_mask: int) -> int:
    """Cars that block, directly or through other blockers, the cheapest rays of the
    head-color cars with the fewest direct blockers."""
    costs = {car: min((ray & mask).bit_count() for ray in sides[car]) for car in iter_bits(head_mask)}
    cheapest = min(costs.values())
    seeds = 0
    for car, cost in costs.items():
        if cost == cheapest:
            for ray in sides[car]:
                if (ray & mask).bit_count() == cheapest:
                    seeds |= ray & mask
    return blocker_closure(sides, mask, seeds)


def naive_options(game: PassengerGame, state: State) -> tuple[int, ...]:
    """Avoid exits that leave the lot stuck at once; exit a head-color car if one can go;
    otherwise dig toward the head-color car with the fewest direct blockers."""
    options = tuple(i for i in game.moves(state) if not immediate_stuck(game, state, i))
    if not options:
        return ()
    mask = state[0]
    head_mask = game.color_mask[game.queue_colors[game.progress(state)]] & mask
    direct = tuple(i for i in options if head_mask >> i & 1)
    if direct:
        return direct
    dig = cheapest_dig(game.sides, mask, head_mask)
    return tuple(i for i in options if dig >> i & 1) or options


def naive_win_probability(game: PassengerGame) -> float:
    cache: dict[State, float] = {}

    def value(state: State) -> float:
        if state[0] == 0:
            return 1.0
        if not game.wins(state):
            return 0.0
        cached = cache.get(state)
        if cached is None:
            options = naive_options(game, state)
            cached = sum(value(game.step(state, i)) for i in options) / len(options) if options else 0.0
            cache[state] = cached
        return cached

    return value(game.start)


def problem_row(problem: PassengerProblem, bays: int, k_min: int, variants=tuple(VARIANTS)) -> dict[str, object]:
    model = LookaheadModel(problem, bays)
    game = model.game
    return {
        "bays": bays,
        "slack": bays - k_min,
        "solutions": game.solution_count(),
        "naive": round(naive_win_probability(game), 6),
        "headFirst": round(game.win_probability("head-first"), 6),
        "variants": {name: lookahead_profile(model, VARIANTS[name]) for name in variants},
    }


# ---------------------------------------------------------------- survey

POPULATIONS: dict[str, dict[str, object]] = {
    "random": {},
    "favorable": {"longShare": 0.5, "queueMethod": "random", "opening": list(FAVORABLE_OPENINGS)},
}


def favorable(record: dict[str, object]) -> bool:
    return (record["longShare"] == 0.5 and record["queueMethod"] == "random"
            and record["opening"] in FAVORABLE_OPENINGS)


def survey_one(args: tuple[int, int, str]) -> dict[str, object]:
    seed, index, population = args
    begun = time.process_time()
    rng = random.Random(f"levels:{seed}:{population}:{index}")
    conditions = draw_conditions(rng, POPULATIONS[population])
    problem = build(rng, conditions)
    k_min = problem.minimum_bays()
    rows = []
    if k_min is not None:
        for slack in SLACKS:
            bays = k_min + slack
            if min(BAYS) <= bays <= max(BAYS):
                rows.append(problem_row(problem, bays, k_min))
    return {"index": index, "population": population, **conditions, "queueLength": len(problem.queue),
            "queueRuns": color_runs(problem.queue), "long": problem.lengths.count(3), "kMin": k_min,
            "kMinFree": problem.minimum_bays(geometry=False), "rows": rows,
            "seconds": round(time.process_time() - begun, 4), "problem": problem.to_json()}


def run_survey(seed: int, counts: dict[str, int], workers: int) -> dict[str, object]:
    jobs = [(seed, i, name) for name, count in counts.items() for i in range(count)]
    with Pool(workers) as pool:
        records = pool.map(survey_one, jobs, chunksize=8)
    return {"seed": seed, "counts": counts, "records": records}


# ---------------------------------------------------------------- levels

MAIN_VARIANT = "run1head"
# The readers whose level must agree with the main reader's for a problem to count as robust.
ROBUST_VARIANTS = ("naive", "run1")
STABILITY_VARIANTS = ("naive", "run1", "run2", "run3", "all")
# Lower bounds of h90 (passengers the natural reader must see to win at least 90%) for Lv2, Lv3, Lv4.
H90_CUTS = (1, 5, 8)
# Lv5: deep (Lv4) and a reader who sees fewer than this many passengers wins less than half the time.
LV5_H50 = 5
NAIVE_CEILING = 0.8
LEVEL_PHRASES = {
    1: "列の先頭に合う車を出していけば、まず解ける",
    2: "罠はあるが、帰結は1〜4人先に出る。すぐ先を読めば避けられる",
    3: "罠の帰結が5〜7人先に出る。数台分先まで列を読む",
    4: "罠の帰結が8人以上先に出る。列の大部分を読む",
    5: "深い罠が重なる。5人先まで読んでも半分も勝てない",
}


def horizon(curve: list[float], level: float) -> int:
    return first_horizon(curve, level)


def level_of(profile: dict[str, object], naive: float) -> int | None:
    """None when the problem fits no level: its deepest trap lies in a deeper band than the
    trap the natural reader meets at least one time in ten (a rare deep trap would make the
    level depend on which choices a player happens to prefer), or the naive policy wins too
    often for Lv3 and up."""
    curve = profile["curve"]
    h90 = horizon(curve, 0.9)
    level = 1 + sum(h90 >= cut for cut in H90_CUTS)
    if 1 + sum(profile["lookahead"] >= cut for cut in H90_CUTS) > level:
        return None
    if level == 4 and horizon(curve, 0.5) >= LV5_H50:
        level = 5
    if level >= 3 and naive >= NAIVE_CEILING:
        return None
    return level


def row_level(row: dict[str, object], variant: str = MAIN_VARIANT) -> int | None:
    return level_of(row["variants"][variant], row["naive"])


def naive_capped(row: dict[str, object]) -> bool:
    profile = row["variants"][MAIN_VARIANT]
    band = 1 + sum(horizon(profile["curve"], 0.9) >= cut for cut in H90_CUTS)
    deepest = 1 + sum(profile["lookahead"] >= cut for cut in H90_CUTS)
    return deepest <= band and band >= 3 and row["naive"] >= NAIVE_CEILING


def row_robust(row: dict[str, object]) -> bool:
    level = row_level(row)
    return all(row_level(row, v) == level for v in ROBUST_VARIANTS)


def row_queue_only(row: dict[str, object]) -> bool:
    return row["variants"][MAIN_VARIANT]["queueOnlyTraps"] > 0


def survey_rows(records: list[dict[str, object]]):
    for record in records:
        for row in record["rows"]:
            yield record, row


def share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def quantiles(values: list[float]) -> list[float] | None:
    if not values:
        return None
    if len(values) == 1:
        return [values[0]] * 3
    q = statistics.quantiles(values, n=4, method="inclusive")
    return [round(x, 3) for x in q]


def change_rates(rows, levels_main, variant: str) -> dict[str, object]:
    other = [row_level(row, variant) for _, row in rows]
    per = {}
    for level in sorted({lv for lv in levels_main if lv is not None}):
        selected = [(a, b) for a, b in zip(levels_main, other) if a == level]
        per[str(level)] = share(sum(a != b for a, b in selected), len(selected))
    scoped = [(a, b) for a, b in zip(levels_main, other) if a is not None]
    return {"all": share(sum(a != b for a, b in scoped), len(scoped)), "byLevel": per}


def level_features(selected) -> dict[str, object]:
    profiles = [(r, row, row["variants"][MAIN_VARIANT]) for r, row in selected]
    traps = sum(p["traps"] for *_, p in profiles)
    decisions = sum(p["decisionStates"] for *_, p in profiles)
    return {
        "count": len(profiles),
        "cars": dict(sorted(Counter(str(r["cars"]) for r, *_ in profiles).items())),
        "slack1": share(sum(row["slack"] == 1 for _, row, _ in profiles), len(profiles)),
        "bays": dict(sorted(Counter(str(row["bays"]) for _, row, _ in profiles).items())),
        "lookahead": quantiles([p["lookahead"] for *_, p in profiles]),
        "lookaheadRuns": quantiles([p["lookaheadRuns"] for *_, p in profiles]),
        "h90": quantiles([horizon(p["curve"], 0.9) for *_, p in profiles]),
        "h50": quantiles([horizon(p["curve"], 0.5) for *_, p in profiles]),
        "p1": quantiles([p["curve"][min(1, len(p["curve"]) - 1)] for *_, p in profiles]),
        "naive": quantiles([row["naive"] for _, row, _ in profiles]),
        "headFirst": quantiles([row["headFirst"] for _, row, _ in profiles]),
        "deepTrapsOnRunMean": quantiles([p["trapsOnRun"]["3"]["mean"] for *_, p in profiles]),
        "deepTrapsOnEveryRun": dict(sorted(Counter(str(min(p["trapsOnRun"]["3"]["min"], 3))
                                                   for *_, p in profiles).items())),
        "queueLength": quantiles([r["queueLength"] for r, *_ in profiles]),
        "withQueueOnlyTrap": share(sum(p["queueOnlyTraps"] > 0 for *_, p in profiles), len(profiles)),
        "blockingShareOfTraps": share(traps - sum(p["queueOnlyTraps"] for *_, p in profiles), traps),
        "blockingShareOfDecisionStates": share(sum(p["blockingDecisionStates"] for *_, p in profiles), decisions),
        "queueShareOfDecisionStates": share(sum(p["queueDecisionStates"] for *_, p in profiles), decisions),
        "deepestTrapIsBlocking": share(sum(p["lookaheadBlocking"] >= p["lookahead"] for *_, p in profiles),
                                       len(profiles)),
        "robust": share(sum(row_robust(row) for _, row, _ in profiles), len(profiles)),
    }


PAIR_INDICATORS = {
    "lookahead": lambda r, row, p: p["lookahead"],
    "lookaheadRuns": lambda r, row, p: p["lookaheadRuns"],
    "h90": lambda r, row, p: horizon(p["curve"], 0.9),
    "h50": lambda r, row, p: horizon(p["curve"], 0.5),
    "naiveLoss": lambda r, row, p: 1 - row["naive"],
    "headFirstLoss": lambda r, row, p: 1 - row["headFirst"],
    "deepTrapsOnRunMean": lambda r, row, p: p["trapsOnRun"]["3"]["mean"],
    "queueLength": lambda r, row, p: r["queueLength"],
}


def ordering(lower, upper, key) -> float | None:
    """P(indicator of an upper-level problem > a lower-level one), ties counted half."""
    if not lower or not upper:
        return None
    a = sorted(key(*x) for x in lower)
    total = 0.0
    for x in upper:
        value = key(*x)
        total += bisect_left(a, value) + 0.5 * (bisect_right(a, value) - bisect_left(a, value))
    return round(total / (len(a) * len(upper)), 3)


def pair_block(selected) -> dict[str, object]:
    by: dict[tuple[int, int], list] = defaultdict(list)
    for r, row in selected:
        level = row_level(row)
        if level is not None:
            by[(r["cars"], level)].append((r, row, row["variants"][MAIN_VARIANT]))
    result = {}
    for cars in (8, 10, 12):
        for level in range(1, 5):
            lower, upper = by[(cars, level)], by[(cars, level + 1)]
            result[f"{cars}:{level}-{level + 1}"] = {
                "counts": [len(lower), len(upper)],
                **{name: ordering(lower, upper, key) for name, key in PAIR_INDICATORS.items()}}
    return result


def survey_digest(surveys: list[dict[str, object]]) -> dict[str, object]:
    groups = {"favorable": lambda r: favorable(r), "other": lambda r: not favorable(r)}
    result: dict[str, object] = {}
    for group, accept in groups.items():
        rows = [(r, row) for s in surveys for r, row in survey_rows(s["records"]) if accept(r)]
        block: dict[str, object] = {}
        for slack in SLACKS:
            selected = [(r, row) for r, row in rows if row["slack"] == slack]
            block[f"slack{slack}"] = {
                "rows": len(selected),
                "levelsByCars": {str(c): dict(sorted(Counter(str(row_level(row)) for r, row in selected
                                                             if r["cars"] == c).items())) for c in (8, 10, 12)},
            }
        levels = [row_level(row) for _, row in rows]
        block["stability"] = {v: change_rates(rows, levels, v) for v in STABILITY_VARIANTS}
        block["stabilityBySeed"] = {
            str(s["seed"]): {v: change_rates(sel, [row_level(row) for _, row in sel], v)["byLevel"]
                             for v in ("naive", "run1")}
            for s in surveys for sel in [[(r, row) for r, row in survey_rows(s["records"]) if accept(r)]]}
        robust = [(r, row) for r, row in rows if row_robust(row)]
        block["stabilityOfRobust"] = {
            v: change_rates(robust, [row_level(row) for _, row in robust], v) for v in ("run2", "run3", "all")}
        excluded = [(r, row) for r, row in rows if not row_queue_only(row)]
        block["stabilityWithoutQueueOnly"] = {
            v: change_rates(excluded, [row_level(row) for _, row in excluded], v) for v in ("naive", "run1", "run2")}
        block["features"] = {str(level): level_features([(r, row) for r, row in rows if row_level(row) == level])
                             for level in range(1, 6)}
        block["featuresWithoutQueueOnly"] = {
            str(level): {k: v for k, v in level_features([(r, row) for r, row in excluded
                                                          if row_level(row) == level]).items()
                         if k in ("count", "cars", "lookahead", "h90", "naive", "robust")}
            for level in range(1, 6)}
        block["outOfScope"] = {
            "rows": len(rows), "rareDeepTrap": sum(row_level(row) is None and not naive_capped(row) for _, row in rows),
            "naiveCeiling": sum(naive_capped(row) for _, row in rows)}
        block["pairs"] = pair_block(rows)
        result[group] = block
    return result


# ---------------------------------------------------------------- supply

SUPPLY_VARIANTS = ("run1head", "naive", "run1")


def assess(problem: PassengerProblem, slack: int) -> dict[str, object] | None:
    k_min = problem.minimum_bays()
    if k_min is None or not min(BAYS) <= k_min + slack <= max(BAYS):
        return None
    row = problem_row(problem, k_min + slack, k_min, variants=SUPPLY_VARIANTS)
    profile = row["variants"][MAIN_VARIANT]
    return {"bays": row["bays"], "slack": slack, "level": row_level(row), "robust": row_robust(row),
            "queueOnly": row_queue_only(row), "h90": horizon(profile["curve"], 0.9),
            "h50": horizon(profile["curve"], 0.5), "lookahead": profile["lookahead"], "naive": row["naive"]}


def climb_score(verdict: dict[str, object] | None, target: int) -> float:
    if verdict is None or verdict["level"] is None:
        return -100.0
    gap = verdict["level"] - target
    toward = min(verdict["h90"], 16) * (1 if gap < 0 else -1 if gap > 0 else 0)
    bonus = min(verdict["h50"], 10) if target == 5 else 0
    return -10.0 * abs(gap) + 0.1 * toward + 0.1 * bonus


def supply_attempt(rng: random.Random, generator: str, target: int | None, deadline: float,
                   budget: int = 80) -> list[dict[str, object]]:
    begun = time.process_time()
    conditions = draw_conditions(rng, POPULATIONS["favorable"])
    problem = build(rng, conditions)
    if generator == "random":
        found = []
        for slack in SLACKS:
            verdict = assess(problem, slack)
            if verdict is not None and verdict["level"] is not None:
                found.append({"generator": generator, **conditions, **verdict, "problem": problem.to_json()})
        seconds = time.process_time() - begun
        return [{"seconds": seconds, "accepted": found, "generator": generator, "target": None}]
    verdict = assess(problem, 0)
    score = climb_score(verdict, target)
    pool = positions(problem.size)
    evaluations = tries = 0
    while (verdict is None or verdict["level"] != target) and evaluations < budget and tries < 4 * budget \
            and time.process_time() < deadline:
        tries += 1
        candidate = mutate(rng, problem, pool)
        if candidate is None:
            continue
        evaluations += 1
        candidate_verdict = assess(candidate, 0)
        candidate_score = climb_score(candidate_verdict, target)
        if candidate_score >= score:
            problem, verdict, score = candidate, candidate_verdict, candidate_score
    accepted = []
    if verdict is not None and verdict["level"] == target:
        accepted.append({"generator": generator, **conditions, **verdict, "problem": problem.to_json()})
    return [{"seconds": time.process_time() - begun, "accepted": accepted, "generator": generator,
             "target": target, "evaluations": evaluations}]


def supply_worker(args: tuple[int, int, str, int | None, float]) -> list[dict[str, object]]:
    seed, worker, generator, target, seconds = args
    rng = random.Random(f"levels-supply:{seed}:{worker}:{generator}:{target}")
    deadline = time.process_time() + seconds
    attempts = []
    while time.process_time() < deadline:
        attempts.extend(supply_attempt(rng, generator, target, deadline))
    return attempts


def run_supply(seed: int, seconds: float, climb_seconds: float, workers: int) -> dict[str, object]:
    jobs = [(seed, w, "random", None, seconds) for w in range(workers)]
    jobs += [(seed, w, "climb", t, climb_seconds) for t in (2, 3, 4, 5) for w in range(workers)]
    with Pool(workers) as pool:
        results = pool.map(supply_worker, jobs, chunksize=1)
    return {"seed": seed, "seconds": seconds, "climbSeconds": climb_seconds, "workers": workers,
            "attempts": [a for chunk in results for a in chunk]}


SUPPLY_FILTERS = {
    "all": lambda a: True,
    "robust": lambda a: a["robust"],
    "withoutQueueOnly": lambda a: not a["queueOnly"],
    "robustWithoutQueueOnly": lambda a: a["robust"] and not a["queueOnly"],
}


def supply_digest(supplies: list[dict[str, object]]) -> dict[str, object]:
    result = {}
    for data in supplies:
        block = {}
        for generator, target in [("random", None), *(("climb", t) for t in (2, 3, 4, 5))]:
            attempts = [a for a in data["attempts"] if a["generator"] == generator and a["target"] == target]
            minutes = sum(a["seconds"] for a in attempts) / 60
            accepted = [x for a in attempts for x in a["accepted"]]
            levels = (1, 2, 3, 4, 5) if target is None else (target,)
            entry = {"cpuMinutes": round(minutes, 2), "attempts": len(attempts)}
            for name, keep in SUPPLY_FILTERS.items():
                per = {}
                for level in levels:
                    chosen = [x for x in accepted if x["level"] == level and keep(x)]
                    unique = {(canonical(PassengerProblem.from_json(x["problem"])), x["bays"]) for x in chosen}
                    per[str(level)] = round(len(unique) / minutes, 2) if minutes else None
                entry[name] = per
            chosen = [x for x in accepted if x["level"] in levels]
            entry["structuralDuplicates"] = len(chosen) - len({
                (structural_canonical(PassengerProblem.from_json(x["problem"])), x["bays"]) for x in chosen})
            entry["acceptedByCars"] = {str(lv): dict(sorted(Counter(str(x["cars"]) for x in chosen
                                                                    if x["level"] == lv).items())) for lv in levels}
            entry["acceptedByOpening"] = {str(lv): dict(sorted(Counter(x["opening"] for x in chosen
                                                                       if x["level"] == lv).items()))
                                          for lv in levels}
            if target is not None:
                entry["meanSecondsPerAttempt"] = round(minutes * 60 / max(len(attempts), 1), 3)
                entry["successShare"] = share(sum(bool(a["accepted"]) for a in attempts), len(attempts))
            block[f"{generator}{'' if target is None else target}"] = entry
        result[str(data["seed"])] = block
    return result


# ---------------------------------------------------------------- examples


def winning_order(game: PassengerGame) -> list[int]:
    state, order = game.start, []
    while state[0]:
        car = next(i for i in game.moves(state) if game.wins(game.step(state, i)))
        order.append(car)
        state = game.step(state, car)
    return order


def deepest_trap(model: LookaheadModel) -> dict[str, object] | None:
    """The deepest losing candidate of the main reader, with a winning exit order leading to it."""
    game = model.game
    nodes = model.graph(VARIANTS[MAIN_VARIANT])
    parents: dict[State, tuple[State, int] | None] = {game.start: None}
    order = [game.start]
    for state in order:
        if state[0] == 0:
            continue
        for car in model.candidates(state, VARIANTS[MAIN_VARIANT])[0]:
            child = game.step(state, car)
            if (child in nodes or child[0] == 0) and child not in parents:
                parents[child] = (state, car)
                order.append(child)
    best = None
    for state in order:
        if state[0] == 0:
            continue
        for car, d, queue_only in nodes[state].losers:
            if best is None or d > best[2]:
                best = (state, car, d, queue_only)
    if best is None:
        return None
    state, car, d, queue_only = best
    prefix, node = [], state
    while parents[node] is not None:
        node, previous_car = parents[node]
        prefix.append(previous_car)
    prefix.reverse()
    head = game.progress(state)
    winners = [i for i in model.candidates(state, VARIANTS[MAIN_VARIANT])[0] if game.wins(game.step(state, i))]
    return {"before": [f"v{i}" for i in prefix], "served": head, "losing": f"v{car}", "distance": d,
            "stuckAt": head + d, "queueOnly": queue_only, "winning": [f"v{i}" for i in winners]}


def example_entry(spec: dict[str, object]) -> dict[str, object]:
    problem = PassengerProblem.from_json(spec["problem"])
    bays = spec["bays"]
    k_min = problem.minimum_bays()
    row = problem_row(problem, bays, k_min)
    model = LookaheadModel(problem, bays)
    profile = row["variants"][MAIN_VARIANT]
    return {
        "id": spec["id"], "title": spec["title"], "kind": spec["kind"], "level": row_level(row),
        "bayCount": bays, "solutions": row["solutions"], "queue": problem.queue,
        "board": problem.frontend_board(FRONTEND_SIDE),
        "features": {
            "cars": len(problem.vehicles), "openings": sorted(problem.openings), "kMin": k_min,
            "slack": row["slack"], "queueLength": len(problem.queue), "queueRuns": color_runs(problem.queue),
            "lookahead": profile["lookahead"], "lookaheadRuns": profile["lookaheadRuns"],
            "h90": horizon(profile["curve"], 0.9), "h50": horizon(profile["curve"], 0.5),
            "curve": profile["curve"], "naive": row["naive"], "headFirst": row["headFirst"],
            "traps": profile["traps"], "queueOnlyTraps": profile["queueOnlyTraps"],
            "deepTrapsOnRun": profile["trapsOnRun"]["3"], "robust": row_robust(row),
            "levelsByVariant": {v: row_level(row, v) for v in VARIANTS},
        },
        "deepestTrap": deepest_trap(model),
        "solution": [f"v{i}" for i in winning_order(model.game)],
        "diagram": problem.diagram(),
        "note": spec.get("note", ""),
    }


def load_json(path: str):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    survey = commands.add_parser("survey")
    survey.add_argument("--seed", type=int, required=True)
    survey.add_argument("--random", type=int, default=1500)
    survey.add_argument("--favorable", type=int, default=1500)
    survey.add_argument("--workers", type=int, default=4)
    survey.add_argument("--output", required=True)
    supply = commands.add_parser("supply")
    supply.add_argument("--seed", type=int, required=True)
    supply.add_argument("--seconds", type=float, default=45, help="CPU seconds per worker for the random generator")
    supply.add_argument("--climb-seconds", type=float, default=30, help="CPU seconds per worker and target level")
    supply.add_argument("--workers", type=int, default=4)
    supply.add_argument("--output", required=True)
    examples = commands.add_parser("examples")
    examples.add_argument("--selection", required=True)
    examples.add_argument("--output", required=True)
    digest = commands.add_parser("digest")
    digest.add_argument("--surveys", nargs="+", required=True)
    digest.add_argument("--supplies", nargs="*", default=[])
    digest.add_argument("--examples")
    digest.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "survey":
        write_json(args.output, run_survey(args.seed, {"random": args.random, "favorable": args.favorable},
                                           args.workers))
    elif args.command == "supply":
        write_json(args.output, run_supply(args.seed, args.seconds, args.climb_seconds, args.workers))
    elif args.command == "examples":
        entries = [example_entry(spec) for spec in load_json(args.selection)]
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=1)
            handle.write("\n")
    elif args.command == "digest":
        data = {
            "definitions": {"mainVariant": MAIN_VARIANT, "robustVariants": list(ROBUST_VARIANTS),
                            "h90Cuts": list(H90_CUTS), "lv5H50": LV5_H50, "naiveCeiling": NAIVE_CEILING,
                            "phrases": {str(k): v for k, v in LEVEL_PHRASES.items()},
                            "variants": {k: list(v.tiers) for k, v in VARIANTS.items()}},
            "survey": survey_digest([load_json(p) for p in args.surveys]),
        }
        if args.supplies:
            data["supply"] = supply_digest([load_json(p) for p in args.supplies])
        if args.examples:
            data["examples"] = [{"id": e["id"], "title": e["title"], "level": e["level"],
                                 **{k: e["features"][k] for k in ("cars", "lookahead", "h90", "h50", "naive",
                                                                  "queueOnlyTraps", "robust")}}
                                for e in load_json(args.examples)]
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(compact(data))
            handle.write("\n")


def compact(value, indent: int = 0, width: int = 220) -> str:
    """JSON with short containers kept on one line, so the summary stays a few hundred lines."""
    flat = json.dumps(value, ensure_ascii=False)
    if len(flat) + indent <= width or not isinstance(value, (dict, list)):
        return flat
    pad = " " * (indent + 2)
    if isinstance(value, dict):
        items = [f"{pad}{json.dumps(k, ensure_ascii=False)}: {compact(v, indent + 2, width)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n" + " " * indent + "}"
    items = [pad + compact(v, indent + 2, width) for v in value]
    return "[\n" + ",\n".join(items) + "\n" + " " * indent + "]"


if __name__ == "__main__":
    main()
