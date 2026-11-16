"""Research-only level judging and three level-targeted generators for the dispatch rule (#738).

G1 draws reverse-placed boards with a request derived from a legal exit order.
G2 writes an intended solution from tactic episodes and places cars to realise
the blocking relations the episodes need. G3 hill-climbs random problems toward
a target level. All three are accepted by the same judge, `assess`, which reads
the v3 level table (the v2 table is kept for comparison). `population` measures
how often the judged features occur on undirected random problems.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from collections import Counter
from dataclasses import dataclass, field
from multiprocessing import Pool

from parking_jam_dispatch_reading import (
    BOARD_SHAPES,
    OPENINGS_BY_NAME,
    DispatchGame,
    Problem,
    geometric_canonical,
    head_car,
    iter_bits,
    minimum_bays,
    open_rays,
    order_request,
    pair_colors,
    reading_profile,
    shuffled_request,
    side_blockers,
    structural_canonical,
)
from parking_jam_dispatch_reading import (
    generate_board as generate_open_board,
)
from parking_jam_rule_space import Vehicle, positions

Range = tuple[int | float | None, int | float | None]


def within(value: float | None, bounds: Range) -> bool:
    low, high = bounds
    if value is None:
        return high is None
    return (low is None or value >= low) and (high is None or value <= high)


def distance(value: float | None, bounds: Range) -> float:
    low, high = bounds
    if value is None:
        return 0.0 if high is None else 1.0 + (high or 0)
    if low is not None and value < low:
        return low - value
    if high is not None and value > high:
        return value - high
    return 0.0


LEVEL_SHAPE = {
    1: {"cars": (8,), "sizes": (6, 7), "slack": (1,)},
    2: {"cars": (8,), "sizes": (6, 7), "slack": (0, 1)},
    3: {"cars": (10,), "sizes": (7,), "slack": (0,)},
    4: {"cars": (10, 12), "sizes": (7, 8), "slack": (0,)},
    5: {"cars": (12,), "sizes": (7, 8), "slack": (0,)},
}


@dataclass
class Assessment:
    level: int
    accepted: bool
    features: dict[str, object]
    failed: list[str] = field(default_factory=list)
    deficit: float = 0.0


class Checker:
    def __init__(self) -> None:
        self.failed: list[str] = []
        self.deficit = 0.0

    def check(self, name: str, value, bounds: Range, weight: float = 1.0) -> None:
        if not within(value, bounds):
            self.failed.append(name)
            self.deficit += weight * distance(value, bounds)


class NaturalReading:
    """Decisions of a reader who serves one request at a time with natural plans.

    Natural plans are the minimal one-request plans that are not dominated by a
    smaller plan for the same head-color car. With `skip_buried_twin`, plans that
    dig a head-color car are also dropped while another head-color car can exit
    at once. The reader's path follows winning natural plans, or any winning
    one-request plan where no natural plan wins.
    """

    def __init__(self, game: DispatchGame, skip_buried_twin: bool = True, lure_lookahead: int = 2):
        self.game = game
        self.skip_buried_twin = skip_buried_twin
        self.lure_lookahead = lure_lookahead
        self._natural: dict[int, list[int]] = {}
        self._survival: dict[int, tuple[int, int]] = {}

    def natural(self, mask: int) -> list[int]:
        cached = self._natural.get(mask)
        if cached is None:
            game = self.game
            smallest: dict[int, int] = {}
            plans = game.plans(mask, 1)
            for goal in plans:
                car = head_car(game, mask, goal)
                smallest[car] = min(smallest.get(car, game.n), (mask & ~goal).bit_count())
            cached = [g for g in plans if (mask & ~g).bit_count() == smallest[head_car(game, mask, g)]]
            if self.skip_buried_twin:
                head = game.color_mask[game.request[game.progress(mask)]]
                free = {i for i in game.geometric_moves(mask) if head >> i & 1}
                if free:
                    cached = [g for g in cached if head_car(game, mask, g) in free]
            self._natural[mask] = cached
        return cached

    def path(self) -> list[int]:
        game = self.game
        order = [game.full]
        seen = {game.full}
        for state in order:
            if state == 0:
                continue
            winners = [g for g in self.natural(state) if game.wins(g)]
            for child in winners or [g for g in game.plans(state, 1) if game.wins(g)]:
                if child not in seen:
                    seen.add(child)
                    order.append(child)
        return order

    def survival(self, mask: int) -> tuple[int, int]:
        """(min, max) served count at which natural play from a lost state can no longer serve the next request."""
        cached = self._survival.get(mask)
        if cached is None:
            children = self.natural(mask) if mask else []
            if not children:
                served = self.game.progress(mask)
                cached = (served, served)
            else:
                ends = [self.survival(child) for child in children]
                cached = (min(e[0] for e in ends), max(e[1] for e in ends))
            self._survival[mask] = cached
        return cached

    def reason(self, mask: int, losing: int, winners: list[int]) -> str:
        """A: the losing plan leaves a car on another car's exit; B: its extra cars take bays."""
        game = self.game
        if not winners:
            return "unknown"
        reference = min(winners, key=lambda g: ((mask & ~g) ^ (mask & ~losing)).bit_count())
        left = (mask & ~reference) & losing
        extra = (mask & ~losing) & reference
        blocking_cleared = tuple(
            tuple(side & ~left for side in sides) for sides in game.sides)
        direct = bool(left) and DispatchGame(blocking_cleared, game.colors, game.request, game.bays).wins(losing)
        removed = game.full & ~losing
        served = Counter(game.request[:game.progress(losing)])
        waiting_extra = 0
        for color, bits in game.color_mask.items():
            waiting_color = (removed & bits).bit_count() - served[color]
            waiting_extra += min((extra & bits).bit_count(), max(0, waiting_color))
        pressure = waiting_extra > 0 and DispatchGame(
            game.sides, game.colors, game.request, game.bays + waiting_extra).wins(losing)
        return {(True, True): "AB", (True, False): "A", (False, True): "B"}.get((direct, pressure), "unknown")

    def kind(self, mask: int, winners: list[int], losing: list[int]) -> str:
        """twin: every losing plan uses a head-color car no winning plan uses; route: every losing
        plan uses a car some winning plan uses, with other blockers; other: no natural plan wins."""
        if not winners:
            return "other"
        winning_cars = {head_car(self.game, mask, g) for g in winners}
        kinds = {"route" if head_car(self.game, mask, g) in winning_cars else "twin" for g in losing}
        return kinds.pop() if len(kinds) == 1 else "mixed"

    def lures(self, mask: int) -> list[int]:
        """Immediately legal, non-overflowing exits outside every one-request plan that lose."""
        game = self.game
        if not game.alive(mask):
            return []
        served = game.progress(mask)
        upcoming = set(game.request[served + 1:served + 1 + self.lure_lookahead])
        needed = 0
        for goal in game.plans(mask, 1):
            needed |= mask & ~goal
        result = []
        for car in game.geometric_moves(mask):
            child = mask & ~(1 << car)
            if (needed >> car & 1 or game.colors[car] not in upcoming or not game.alive(child)
                    or game.wins(child)):
                continue
            result.append(car)
        return result

    def summary(self) -> dict[str, object]:
        game = self.game
        decisions = []
        lure_states = 0
        for state in self.path():
            if state == 0:
                continue
            lure_states += bool(self.lures(state))
            natural = self.natural(state)
            losing = [g for g in natural if not game.wins(g)]
            if not losing:
                continue
            winners = [g for g in natural if game.wins(g)]
            fallback = winners or [g for g in game.plans(state, 1) if game.wins(g)]
            base = game.progress(state)
            spans = [self.survival(g) for g in losing]
            decisions.append({
                "kind": self.kind(state, winners, losing),
                "state": state,
                "served": base,
                "options": len(natural),
                "losing": len(losing),
                "winningNatural": len(winners),
                "distanceMin": min(s[0] for s in spans) - base,
                "distanceMax": max(s[1] for s in spans) - base,
                "reasons": sorted(self.reason(state, g, fallback) for g in losing),
                "chain": max((state & ~g).bit_count() - 1 for g in natural),
            })
        reasons = Counter(r for d in decisions for r in d["reasons"])
        return {
            "decisionKinds": dict(Counter(d["kind"] for d in decisions)),
            "decisions": len(decisions),
            "distanceMax": max((d["distanceMax"] for d in decisions), default=0),
            "distanceMin": min((d["distanceMin"] for d in decisions), default=0),
            "reasons": dict(reasons),
            "hasA": int(any(r in ("A", "AB") for r in reasons)),
            "hasB": int(any(r in ("B", "AB") for r in reasons)),
            "lures": lure_states,
            "chainMax": max((d["chain"] for d in decisions), default=0),
            "optionsMax": max((d["options"] for d in decisions), default=0),
            "onlyUnnaturalWins": sum(d["winningNatural"] == 0 for d in decisions),
            "detail": decisions,
        }


NOT_PERFECT = {"headFirstPerfect": (0, 0), "fewestPerfect": (0, 0)}
LEVEL_TABLES: dict[str, dict[int, list[dict[str, Range]]]] = {
    "v3": {
        1: [{"cars": (8, 8), "bays": (2, 4), "slack": (1, None), "decisions": (0, 0)}],
        2: [{"cars": (8, 8), "bays": (2, 4), "slack": (0, 1), "decisions": (1, 1), "distanceMax": (1, 2),
             "hasA": (1, 1)}],
        3: [{"cars": (10, 10), "bays": (2, 4), "slack": (0, 0), "decisions": (1, 2), "distanceMax": (2, None),
             "hasB": (0, 0), "headFirstPerfect": (0, 0)}],
        4: [{"cars": (10, 12), "bays": (3, 4), "slack": (0, 0), "decisions": (2, None), "hasB": (1, 1),
             "distanceMax": (3, None), **NOT_PERFECT}],
        5: [{"cars": (12, 12), "bays": (3, 4), "slack": (0, 0), "decisions": (3, None), "hasA": (1, 1),
             "hasB": (1, 1), "distanceMax": (3, None), **NOT_PERFECT}],
    },
    "v2": {
        1: [{"cars": (8, 8), "bays": (2, None), "slack": (1, None), "decisions": (0, 0), "lures": (0, 0)}],
        2: [{"cars": (8, 8), "bays": (2, None), "slack": (1, 1), "decisions": (1, 1), "distanceMax": (1, 2),
             "hasA": (1, 1), "lures": (0, 0)}],
        3: [{"cars": (10, 10), "bays": (2, None), "slack": (0, 0), "decisions": (1, 2), "distanceMax": (2, 3),
             "headFirstPerfect": (0, 0)},
            {"cars": (10, 10), "bays": (2, None), "slack": (0, 0), "decisions": (0, 2), "lures": (1, None),
             "headFirstPerfect": (0, 0)}],
        4: [{"cars": (10, 12), "bays": (3, 4), "slack": (0, 0), "decisions": (2, None), "hasB": (1, 1),
             "distanceMax": (3, None), **NOT_PERFECT}],
        5: [{"cars": (12, 12), "bays": (3, 4), "slack": (0, 0), "decisions": (3, None), "hasA": (1, 1),
             "hasB": (1, 1), "lures": (1, None), **NOT_PERFECT}],
    },
}
CHEAP_KEYS = ("cars", "bays", "slack")


def level_features(problem: Problem, bays: int, k_min: int, skip_buried_twin: bool = True,
                   reference: bool = False) -> dict[str, object]:
    """Every feature the level tables read, plus naive-solver rates and the solution count."""
    game = problem.game(bays)
    features: dict[str, object] = {"cars": len(problem.colors), "bays": bays, "k_min": k_min, "slack": bays - k_min}
    if bays < k_min:
        return features
    head_first = game.win_probability("head-first")
    fewest = game.win_probability("fewest-blockers")
    features.update({"headFirst": head_first, "fewestBlockers": fewest,
                     "headFirstPerfect": int(head_first > 1 - 1e-9), "fewestPerfect": int(fewest > 1 - 1e-9),
                     "solutions": game.solution_count()})
    features.update(NaturalReading(game, skip_buried_twin).summary())
    if reference:
        profile = reading_profile(game, 5)
        features["rollingHStarCapped5"] = profile.rolling_h_star
        features["chunkedHStarCapped5"] = profile.h_star
    return features


def match(features: dict[str, object], level: int, table: str = "v3") -> tuple[bool, list[str], float]:
    best: tuple[bool, list[str], float] | None = None
    for clause in LEVEL_TABLES[table][level]:
        checker = Checker()
        for key, bounds in clause.items():
            checker.check(key, features.get(key), bounds, 10 if key in CHEAP_KEYS else 1)
        outcome = (not checker.failed, checker.failed, checker.deficit)
        if best is None or outcome[2] < best[2]:
            best = outcome
    return best


def matched_levels(features: dict[str, object], table: str = "v3") -> list[int]:
    return [lv for lv in LEVEL_TABLES[table] if match(features, lv, table)[0]]


def level_of(features: dict[str, object], table: str = "v3") -> int | None:
    """The highest level whose criteria the features meet."""
    return max(matched_levels(features, table), default=None)


def assess(problem: Problem, bays: int, level: int, k_min: int | None = None, table: str = "v3",
           skip_buried_twin: bool = True) -> Assessment:
    """Accept when `level` is the highest level met; `deficit` guides G3 toward it."""
    k_min = minimum_bays(problem.sides, problem.colors, problem.request) if k_min is None else k_min
    cheap = {"cars": len(problem.colors), "bays": bays, "slack": bays - k_min, "k_min": k_min}
    clauses = LEVEL_TABLES[table][level]
    if bays < k_min or not any(all(within(cheap[k], c[k]) for k in CHEAP_KEYS if k in c) for c in clauses):
        _, failed, deficit = match(cheap, level, table)
        return Assessment(level, False, cheap, failed or ["unsolvable"], deficit + 10)
    features = level_features(problem, bays, k_min, skip_buried_twin)
    accepted, failed, deficit = match(features, level, table)
    higher = [lv for lv in matched_levels(features, table) if lv > level]
    if accepted and higher:
        return Assessment(level, False, features, [f"meets-Lv{max(higher)}"], 1.0)
    return Assessment(level, accepted, features, failed, deficit)


def level_shape(rng: random.Random, level: int) -> tuple[int, int, str]:
    shape = LEVEL_SHAPE[level]
    return rng.choice(shape["cars"]), rng.choice(shape["sizes"]), rng.choice(sorted(OPENINGS_BY_NAME))


@dataclass
class Attempt:
    generator: str
    level: int
    opening: str
    accepted: bool
    solvable: bool
    seconds: float
    evaluations: int
    failed: list[str]
    problem: Problem | None = None
    bays: int | None = None
    features: dict[str, object] | None = None
    note: str | None = None


def judge(problem: Problem, level: int) -> tuple[int, Assessment]:
    """v3 at each slack the level allows; the accepted one, else the closest."""
    k_min = minimum_bays(problem.sides, problem.colors, problem.request)
    results = [(k_min + slack, assess(problem, k_min + slack, level, k_min)) for slack in LEVEL_SHAPE[level]["slack"]]
    return min(results, key=lambda item: (not item[1].accepted, item[1].deficit))


def conclude(generator: str, level: int, opening: str, problem: Problem, begun: float, judged: tuple[int, Assessment],
             evaluations: int = 1, note: str | None = None) -> Attempt:
    bays, result = judged
    features = {k: v for k, v in result.features.items() if k != "detail"}
    return Attempt(generator, level, opening, result.accepted, True, time.process_time() - begun, evaluations,
                   result.failed, problem, bays, features, note)


def compare(attempt: Attempt) -> dict[str, object]:
    """Comparison-only verdicts for an accepted problem, computed outside the generator's timing."""
    k_min = attempt.features["k_min"]
    variant = level_features(attempt.problem, attempt.bays, k_min, skip_buried_twin=False)
    return {"v2": match(attempt.features, attempt.level, "v2")[0], "keepBuriedTwinLevel": level_of(variant)}


def generate_g1(rng: random.Random, level: int, deadline: float | None = None) -> Attempt:
    begun = time.process_time()
    cars, size, opening = level_shape(rng, level)
    board = generate_open_board(rng, cars, size, OPENINGS_BY_NAME[opening])
    colors = pair_colors(rng, cars)
    problem = Problem(board, size, OPENINGS_BY_NAME[opening], colors,
                      order_request(rng, side_blockers(board, OPENINGS_BY_NAME[opening]), colors))
    return conclude("G1", level, opening, problem, begun, judge(problem, level))


def geometrically_clearable(vehicles: tuple[Vehicle, ...], openings) -> bool:
    sides = side_blockers(vehicles, openings)
    remaining = (1 << len(vehicles)) - 1
    while remaining:
        free = [i for i in iter_bits(remaining) if any(not s & remaining for s in sides[i])]
        if not free:
            return False
        for i in free:
            remaining &= ~(1 << i)
    return True


def mutate(rng: random.Random, problem: Problem, pool: list[Vehicle]) -> Problem | None:
    request, colors, vehicles = list(problem.request), list(problem.colors), list(problem.vehicles)
    roll = rng.random()
    i, j = rng.sample(range(len(colors)), 2)
    if roll < 0.45:
        request[i], request[j] = request[j], request[i]
    elif roll < 0.75:
        colors[i], colors[j] = colors[j], colors[i]
    else:
        occupied = 0
        for index, vehicle in enumerate(vehicles):
            if index != i:
                occupied |= vehicle.occupancy
        options = [v for v in pool if not v.occupancy & occupied and open_rays(v, problem.openings)
                   and v != vehicles[i]]
        if not options:
            return None
        vehicles[i] = rng.choice(options)
        if not geometrically_clearable(tuple(vehicles), problem.openings):
            return None
    if request == problem.request and colors == problem.colors and vehicles == list(problem.vehicles):
        return None
    return Problem(tuple(vehicles), problem.size, problem.openings, colors, request)


def generate_g3(rng: random.Random, level: int, deadline: float | None = None, budget: int = 120) -> Attempt:
    """Climb until accepted, `budget` evaluations, 4×`budget` mutation tries, or the CPU `deadline`."""
    begun = time.process_time()
    cars, size, opening = level_shape(rng, level)
    openings = OPENINGS_BY_NAME[opening]
    board = generate_open_board(rng, cars, size, openings)
    colors = pair_colors(rng, cars)
    current = Problem(board, size, openings, colors, shuffled_request(rng, colors))
    pool = [v for v in positions(size) if open_rays(v, openings)]
    best = judge(current, level)
    evaluations = 1
    tries = 0
    while (not best[1].accepted and evaluations < budget and tries < 4 * budget
           and (deadline is None or time.process_time() < deadline)):
        tries += 1
        candidate = mutate(rng, current, pool)
        if candidate is None:
            continue
        result = judge(candidate, level)
        evaluations += 1
        if result[1].deficit <= best[1].deficit:
            current, best = candidate, result
    return conclude("G3", level, opening, current, begun, best, evaluations)


@dataclass
class Role:
    name: str
    twin: str | None = None
    free_rays: int | None = None
    two_rays: bool = False
    covers: str | None = None
    protect_from: str | None = None


@dataclass
class Script:
    """An intended solution: exit order and service order of named roles."""

    roles: dict[str, Role] = field(default_factory=dict)
    exits: list[str] = field(default_factory=list)
    serves: list[str] = field(default_factory=list)
    later: list[tuple[int, list[tuple[str, str]]]] = field(default_factory=list)
    episodes: list[str] = field(default_factory=list)
    clock: int = 0

    def add(self, role: Role) -> str:
        self.roles[role.name] = role
        return role.name

    def fresh(self, prefix: str) -> str:
        return f"{prefix}{len(self.roles)}"

    def run(self, actions: list[tuple[str, str]]) -> None:
        for kind, name in actions:
            (self.exits if kind == "exit" else self.serves).append(name)

    def tick(self) -> None:
        self.clock += 1
        due = [item for item in self.later if item[0] <= self.clock]
        self.later = [item for item in self.later if item[0] > self.clock]
        for _, actions in due:
            self.run(actions)

    def defer(self, delay: int, actions: list[tuple[str, str]]) -> None:
        self.later.append((self.clock + delay, actions))

    def filler(self) -> None:
        name = self.add(Role(self.fresh("F")))
        self.run([("exit", name), ("serve", name)])
        self.episodes.append("filler")

    def dig(self, rng: random.Random, two_rays: bool = False) -> None:
        """T1/T3: a blocked target whose single free ray is covered by a car that waits."""
        target = self.add(Role(self.fresh("X"), free_rays=1, two_rays=two_rays))
        blocker = self.add(Role(self.fresh("Y"), covers=target))
        self.run([("exit", blocker), ("exit", target), ("serve", target)])
        self.defer(rng.randint(2, 4), [("serve", blocker)])
        self.episodes.append("T3" if two_rays else "T1")

    def deep_dig(self, rng: random.Random) -> None:
        """T1 twice over: the blocker is itself buried, so two cars wait at once."""
        target = self.add(Role(self.fresh("X"), free_rays=1))
        middle = self.add(Role(self.fresh("Y"), free_rays=1, covers=target))
        outer = self.add(Role(self.fresh("Y"), covers=middle))
        self.run([("exit", outer), ("exit", middle), ("exit", target), ("serve", target)])
        self.defer(rng.randint(2, 4), [("serve", middle)])
        self.defer(rng.randint(2, 4), [("serve", outer)])
        self.episodes.append("T1x2")

    def twin(self, rng: random.Random, delay: int, decoy: bool = False) -> None:
        """T2/T5: the twin to use sits on a later car's only free ray; the other twin stays free.

        With `decoy`, the right twin is itself buried behind a waiting car, so the
        free twin is the cheaper-looking wrong choice.
        """
        group = self.fresh("pair")
        later_car = self.add(Role(self.fresh("Z"), free_rays=1))
        free_twin = self.add(Role(self.fresh("A"), twin=group))
        used_twin = self.add(Role(self.fresh("A"), twin=group, covers=later_car, free_rays=1 if decoy else None))
        start = used_twin
        if decoy:
            blocker = self.add(Role(self.fresh("Y"), covers=used_twin))
            self.run([("exit", blocker)])
            self.defer(rng.randint(1, 2), [("serve", blocker)])
            start = blocker
        self.roles[free_twin].protect_from = start
        self.run([("exit", used_twin), ("serve", used_twin)])
        self.defer(delay, [("exit", later_car), ("serve", later_car)])
        self.defer(delay + rng.randint(1, 2), [("exit", free_twin), ("serve", free_twin)])
        self.episodes.append("T5" if decoy else "T2")

    def finish(self) -> None:
        while self.later:
            self.tick()


EPISODES = {
    1: ("dig",),
    2: ("twin1", "deep"),
    3: ("twin2", "deep", "dig3"),
    4: ("decoy3", "deep", "twin2"),
    5: ("decoy3", "twin3", "deep", "dig3"),
}
EPISODE_CARS = {"dig": 2, "dig3": 2, "deep": 3, "twin": 3, "decoy": 4}


def write_script(rng: random.Random, level: int, cars: int, openings) -> Script:
    episodes = EPISODES[level]
    two_ray_capable = any(len({side for side in openings if side in pair}) == 2
                          for pair in (("left", "right"), ("top", "bottom")))
    script = Script()
    used = sum(EPISODE_CARS[e.rstrip("0123456789")] for e in episodes)
    plan = list(episodes) + ["filler"] * max(0, cars - used)
    rng.shuffle(plan)
    for episode in plan:
        if episode == "dig":
            script.dig(rng)
        elif episode == "deep":
            script.deep_dig(rng)
        elif episode == "dig3":
            script.dig(rng, two_rays=two_ray_capable)
        elif episode.startswith("twin"):
            script.twin(rng, int(episode[-1]))
        elif episode.startswith("decoy"):
            script.twin(rng, int(episode[-1]), decoy=True)
        else:
            script.filler()
        script.tick()
    script.finish()
    return script


def place(rng: random.Random, script: Script, size: int, openings) -> dict[str, Vehicle] | str:
    """Place roles in reverse exit order so each car has a free ray when its turn comes."""
    pool = [v for v in positions(size) if open_rays(v, openings)]
    exit_index = {name: i for i, name in enumerate(script.exits)}
    placed: dict[str, Vehicle] = {}
    occupied = 0
    reserved: dict[str, int] = {}
    clean: dict[str, list[int]] = {}
    to_cover = {role.covers for role in script.roles.values() if role.covers}
    for name in reversed(script.exits):
        role = script.roles[name]
        options = []
        for vehicle in pool:
            if vehicle.occupancy & occupied:
                continue
            rays = open_rays(vehicle, openings)
            free = [ray for ray in rays if not ray & occupied]
            if not free or (role.two_rays and len(rays) != 2):
                continue
            if role.free_rays is not None and len(free) != role.free_rays:
                continue
            if name in to_cover and min(ray.bit_count() for ray in free) < 2:
                continue
            if role.covers is not None and not vehicle.occupancy & reserved[role.covers]:
                continue
            if any(vehicle.occupancy & ray for target, ray in reserved.items() if target != role.covers):
                continue
            if not keeps_protected_free(script, exit_index, name, vehicle, clean):
                continue
            options.append((vehicle, free))
        if not options:
            return f"no position for {name} ({describe_role(role)})"
        blocking = [o for o in options if role.covers is None and any(
            o[0].occupancy & ray for other in placed.values() for ray in open_rays(other, openings))]
        vehicle, free = rng.choice(blocking if blocking and rng.random() < 0.6 else options)
        placed[name] = vehicle
        occupied |= vehicle.occupancy
        reserved.pop(role.covers, None)
        if role.free_rays == 1:
            reserved[name] = free[0]
        if script.roles[name].protect_from is not None:
            clean[name] = list(free)
        for target, rays in clean.items():
            if target != name:
                clean[target] = [ray for ray in rays if not ray & vehicle.occupancy]
    return placed


def keeps_protected_free(script, exit_index, name, vehicle, clean) -> bool:
    for target, rays in clean.items():
        start = exit_index[script.roles[target].protect_from]
        if start <= exit_index[name] < exit_index[target] and not any(not ray & vehicle.occupancy for ray in rays):
            return False
    return True


def describe_role(role: Role) -> str:
    parts = [f"free_rays={role.free_rays}"] if role.free_rays else []
    parts += ["two_rays"] if role.two_rays else []
    parts += [f"covers={role.covers}"] if role.covers else []
    parts += [f"protect_from={role.protect_from}"] if role.protect_from else []
    return ",".join(parts) or "filler"


def script_colors(rng: random.Random, script: Script) -> dict[str, str]:
    groups: dict[str, list[str]] = {}
    singles = []
    for role in script.roles.values():
        if role.twin:
            groups.setdefault(role.twin, []).append(role.name)
        else:
            singles.append(role.name)
    rng.shuffle(singles)
    pairs = list(groups.values()) + [singles[i:i + 2] for i in range(0, len(singles), 2)]
    labels = [chr(65 + i) for i in range(len(pairs))]
    rng.shuffle(labels)
    return {name: label for label, pair in zip(labels, pairs) for name in pair}


def generate_g2(rng: random.Random, level: int, deadline: float | None = None) -> Attempt:
    begun = time.process_time()
    cars, size, opening = level_shape(rng, level)
    openings = OPENINGS_BY_NAME[opening]
    script = write_script(rng, level, cars, openings)
    if len(script.roles) != cars or len(script.roles) % 2:
        return Attempt("G2", level, opening, False, False, time.process_time() - begun, 0, ["script-size"],
                       note=f"script uses {len(script.roles)} cars, level needs {cars}")
    placed = place(rng, script, size, openings)
    if isinstance(placed, str):
        return Attempt("G2", level, opening, False, False, time.process_time() - begun, 0, ["placement"],
                       note=placed)
    order = list(script.exits)
    names = list(order)
    rng.shuffle(names)
    color = script_colors(rng, script)
    problem = Problem(tuple(placed[n] for n in names), size, openings, [color[n] for n in names],
                      [color[n] for n in script.serves])
    intended = [names.index(n) for n in order]
    if not follows_legal_exits(problem, intended):
        raise AssertionError("placement broke the intended exit order")
    return conclude("G2", level, opening, problem, begun, judge(problem, level), note="+".join(script.episodes))


def follows_legal_exits(problem: Problem, order: list[int]) -> bool:
    remaining = (1 << len(order)) - 1
    for car in order:
        if not any(not s & remaining for s in problem.sides[car]):
            return False
        remaining &= ~(1 << car)
    return True


GENERATORS = {"G1": generate_g1, "G2": generate_g2, "G3": generate_g3}


def board_key(problem: Problem) -> str:
    return repr(geometric_canonical(problem.vehicles, problem.size, problem.openings,
                                    ["A"] * len(problem.vehicles), ["A"] * len(problem.vehicles))[:2])


def run_task(task: tuple) -> list[dict[str, object]]:
    seed, generator, level, worker, seconds = task
    rng = random.Random(f"{seed}:{generator}:{level}:{worker}")
    rows = []
    deadline = time.process_time() + seconds
    while time.process_time() < deadline:
        attempt = GENERATORS[generator](rng, level, deadline=deadline)
        row = {"generator": generator, "level": level, "opening": attempt.opening, "accepted": attempt.accepted,
               "solvable": attempt.solvable, "seconds": attempt.seconds, "evaluations": attempt.evaluations,
               "failed": attempt.failed, "note": attempt.note}
        if attempt.problem is not None:
            p = attempt.problem
            row["features"] = attempt.features
            if attempt.accepted:
                row["comparison"] = compare(attempt)
                row["problem"] = p.to_json()
                row["geometric"] = repr(geometric_canonical(p.vehicles, p.size, p.openings, p.colors, p.request)
                                        + (attempt.bays,))
                row["structural"] = repr(structural_canonical(p.sides, p.colors, p.request) + (attempt.bays,))
                row["boardKey"] = board_key(p)
        rows.append(row)
    return rows


def summarize(rows: list[dict[str, object]]) -> dict[str, object]:
    accepted = [r for r in rows if r["accepted"]]
    times = sorted(r["seconds"] for r in rows)
    cpu_seconds = sum(times)
    per_accept = sum(times) / len(accepted) if accepted else None
    boards = Counter(r["boardKey"] for r in accepted)
    return {
        "attempts": len(rows),
        "solvableShare": round(sum(r["solvable"] for r in rows) / len(rows), 4) if rows else None,
        "accepted": len(accepted),
        "hitRate": round(len(accepted) / len(rows), 4) if rows else None,
        "distinctGeometric": len({r["geometric"] for r in accepted}),
        "distinctStructural": len({r["structural"] for r in accepted}),
        "distinctBoards": len(boards),
        "largestBoardCluster": max(boards.values()) if boards else 0,
        "meanAttemptSeconds": round(statistics.fmean(times), 4) if times else None,
        "p95AttemptSeconds": round(times[int(0.95 * (len(times) - 1))], 4) if times else None,
        "cpuSecondsPerAccepted": round(per_accept, 3) if per_accept else None,
        "acceptedPerCpuMinute": round(60 * len(accepted) / cpu_seconds, 2) if cpu_seconds else None,
        "distinctStructuralPerCpuMinute": (round(60 * len({r["structural"] for r in accepted}) / cpu_seconds, 2)
                                           if cpu_seconds else None),
        "acceptedByOpening": dict(Counter(r["opening"] for r in accepted)),
        "attemptsByOpening": dict(Counter(r["opening"] for r in rows)),
        "failedFirst": dict(Counter(r["failed"][0] if r["failed"] else "-" for r in rows if not r["accepted"])),
        "notes": dict(Counter(r["note"] for r in rows if r["note"] and not r["solvable"]).most_common(6)),
    }


def run(seed: int, generators: list[str], levels: list[int], seconds: float, workers: int) -> tuple[dict, list]:
    tasks = [(seed, g, lv, w, seconds) for g in generators for lv in levels for w in range(workers)]
    begun = time.perf_counter()
    with Pool(workers) as pool:
        chunks = pool.map(run_task, tasks, chunksize=1)
    rows = [r for chunk in chunks for r in chunk]
    summary = {}
    for g in generators:
        for lv in levels:
            subset = [r for r in rows if r["generator"] == g and r["level"] == lv]
            summary[f"{g} Lv{lv}"] = summarize(subset)
    elapsed = round(time.perf_counter() - begun, 1)
    return {"seed": seed, "cpuSecondsPerCell": seconds * workers, "elapsedSeconds": elapsed, "summary": summary}, rows


def lure_states(game: DispatchGame, lookahead: int) -> int:
    reading = NaturalReading(game, True, lookahead)
    return sum(bool(reading.lures(state)) for state in reading.path() if state)


def population_task(task: tuple) -> list[dict[str, object]]:
    seed, cars, size, chunk, count = task
    rng = random.Random(f"population:{seed}:{cars}:{size}:{chunk}")
    rows = []
    for _ in range(count):
        opening = rng.choice(sorted(OPENINGS_BY_NAME))
        openings = OPENINGS_BY_NAME[opening]
        board = generate_open_board(rng, cars, size, openings)
        colors = pair_colors(rng, cars)
        mode = rng.choice(("order", "shuffled"))
        request = (order_request(rng, side_blockers(board, openings), colors) if mode == "order"
                   else shuffled_request(rng, colors))
        problem = Problem(board, size, openings, colors, request)
        k_min = minimum_bays(problem.sides, colors, request)
        for slack in (0, 1):
            bays = k_min + slack
            if bays < 2:
                continue
            features = level_features(problem, bays, k_min)
            rows.append({
                "cars": cars, "opening": opening, "mode": mode, "slack": slack, "bays": bays,
                **{k: features[k] for k in ("decisions", "distanceMax", "hasA", "hasB", "headFirst",
                                            "fewestBlockers", "lures")},
                "lures1": lure_states(problem.game(bays), 1),
                "level": level_of(features),
                "levels": matched_levels(features),
            })
    return rows


def share(rows: list[dict[str, object]], predicate) -> float | None:
    return round(sum(bool(predicate(r)) for r in rows) / len(rows), 4) if rows else None


def summarize_population(rows: list[dict[str, object]]) -> dict[str, object]:
    by_shape = {}
    for cars in sorted({r["cars"] for r in rows}):
        for slack in (0, 1):
            subset = [r for r in rows if r["cars"] == cars and r["slack"] == slack]
            by_shape[f"{cars}cars slack{slack}"] = {
                "problems": len(subset),
                "decisions": dict(sorted(Counter(min(r["decisions"], 3) for r in subset).items())),
                "decisionsExactly1Share": share(subset, lambda r: r["decisions"] == 1),
                "decisionsAtLeast1Share": share(subset, lambda r: r["decisions"] >= 1),
                "lureShareNext1Request": share(subset, lambda r: r["lures1"]),
                "lureShareNext2RequestsDefault": share(subset, lambda r: r["lures"]),
                "hasAShare": share(subset, lambda r: r["hasA"]),
                "hasBShare": share(subset, lambda r: r["hasB"]),
                "headFirstByDecisions": {
                    d: round(statistics.fmean(r["headFirst"] for r in subset if min(r["decisions"], 3) == d), 3)
                    for d in sorted({min(r["decisions"], 3) for r in subset})},
            }
    hits = {}
    for level, clauses in LEVEL_TABLES["v3"].items():
        low, high = clauses[0]["cars"]
        eligible = [r for r in rows if low <= r["cars"] <= high]
        hits[f"Lv{level}"] = {"eligible": len(eligible), "highestLevel": sum(r["level"] == level for r in eligible),
                              "share": share(eligible, lambda r, lv=level: r["level"] == lv),
                              "byOpening": dict(Counter(r["opening"] for r in eligible if r["level"] == level))}
    return {"byShape": by_shape, "levelHits": hits,
            "levelSets": {"+".join(map(str, k)) or "none": v
                          for k, v in sorted(Counter(tuple(r["levels"]) for r in rows).items())}}


POPULATION_CHUNK = 100


def population(seed: int, per_shape: int, workers: int) -> tuple[dict, list]:
    """Chunks of a fixed size carry their own random streams, so the result does not depend on `workers`."""
    tasks = [(seed, cars, size, start // POPULATION_CHUNK, min(POPULATION_CHUNK, per_shape - start))
             for cars, size in BOARD_SHAPES for start in range(0, per_shape, POPULATION_CHUNK)]
    with Pool(workers) as pool:
        rows = [r for chunk in pool.map(population_task, tasks, chunksize=1) for r in chunk]
    return {"seed": seed, "boardsPerShape": per_shape, **summarize_population(rows)}, rows


def quartiles(values: list[float]) -> list[float]:
    ordered = sorted(values)
    return [round(ordered[int(q * (len(ordered) - 1))], 4) for q in (0, 0.25, 0.5, 0.75, 1)]


def accepted_profile(rows: list[dict[str, object]]) -> dict[str, object]:
    """Feature distributions of accepted problems per level, and features whose ranges split adjacent levels."""
    profile = {}
    ranges = {}
    keys = ("cars", "bays", "k_min", "slack", "decisions", "distanceMax", "hasA", "hasB", "chainMax")
    for level in LEVEL_TABLES["v3"]:
        accepted = [r["features"] for r in rows if r["accepted"] and r["level"] == level]
        if not accepted:
            continue
        reasons = Counter()
        kinds = Counter()
        for f in accepted:
            reasons.update(f["reasons"])
            kinds.update(f["decisionKinds"])
        joint = Counter(f"{f['decisions']}x{f['distanceMax']}" for f in accepted)
        profile[f"Lv{level}"] = {
            "accepted": len(accepted),
            **{k: dict(sorted(Counter(f[k] for f in accepted).items())) for k in keys},
            "reasons": dict(reasons),
            "unknownReasonChoices": reasons.get("unknown", 0),
            "decisionStatesByKind": dict(kinds),
            "problemsWithOnlyUnnaturalWins": sum(f["onlyUnnaturalWins"] > 0 for f in accepted),
            "statesWithOnlyUnnaturalWins": sum(f["onlyUnnaturalWins"] for f in accepted),
            "decisionsByDistanceMax": dict(sorted(joint.items())),
            "headFirstQuartiles": quartiles([f["headFirst"] for f in accepted]),
            "fewestBlockersQuartiles": quartiles([f["fewestBlockers"] for f in accepted]),
            "solutionsQuartiles": quartiles([f["solutions"] for f in accepted]),
            "lureStatesQuartiles": quartiles([f["lures"] for f in accepted]),
        }
        ranges[level] = {k: (min(f[k] for f in accepted), max(f[k] for f in accepted)) for k in keys}
    separation = {}
    for level in ranges:
        if level + 1 in ranges:
            low, high = ranges[level], ranges[level + 1]
            separation[f"Lv{level}-Lv{level + 1}"] = [
                k for k in keys if low[k][1] < high[k][0] or high[k][1] < low[k][0]]
    return {"byLevel": profile, "disjointFeatures": separation}


def compact_summary(summary: dict[str, object]) -> dict[str, object]:
    keys = ("attempts", "solvableShare", "accepted", "hitRate", "distinctGeometric", "distinctStructural",
            "largestBoardCluster", "meanAttemptSeconds", "p95AttemptSeconds", "acceptedPerCpuMinute",
            "acceptedByOpening", "failedFirst")
    return {k: summary[k] for k in keys}


def digest(record_paths: list[str], population_path: str, output: str) -> None:
    measured = {}
    pooled = []
    for path in record_paths:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        seed, rows = data["seed"], data["rows"]
        if any(key.startswith(f"seed {seed} ") for key in measured):
            raise ValueError(f"two record files share seed {seed}: {path}")
        pooled.extend(rows)
        for generator in sorted({r["generator"] for r in rows}):
            for level in sorted({r["level"] for r in rows}):
                subset = [r for r in rows if r["generator"] == generator and r["level"] == level]
                if subset:
                    measured[f"seed {seed} {generator} Lv{level}"] = compact_summary(summarize(subset))
    overlap = {}
    for level in LEVEL_TABLES["v3"]:
        accepted = [r for r in pooled if r["accepted"] and r["level"] == level]
        overlap[f"Lv{level}"] = {"accepted": len(accepted),
                                 "distinctGeometric": len({r["geometric"] for r in accepted}),
                                 "distinctStructural": len({r["structural"] for r in accepted})}
    rejected_k_min = {}
    for level in (4, 5):
        rejected = [r for r in pooled if r["generator"] == "G1" and r["level"] == level and not r["accepted"]
                    and r.get("features")]
        rejected_k_min[f"G1 Lv{level}"] = dict(sorted(Counter(r["features"]["k_min"] for r in rejected).items()))
    comparison = {}
    for level in LEVEL_TABLES["v3"]:
        accepted = [r for r in pooled if r["accepted"] and r["level"] == level and r.get("comparison")]
        comparison[f"Lv{level}"] = {
            "accepted": len(accepted),
            "v2AlsoAccepts": sum(bool(r["comparison"].get("v2")) for r in accepted),
            "sameLevelKeepingBuriedTwin": sum(r["comparison"].get("keepBuriedTwinLevel") == level for r in accepted),
        }
    with open(population_path, encoding="utf-8") as handle:
        population_summary = json.load(handle)
    result = {"note": "Research-only summary for #738; counts from CPU-time-limited runs vary with machine speed.",
              "measure": measured, "acrossSeedsAndGenerators": overlap, "rejectedKMin": rejected_k_min,
              "accepted": accepted_profile(pooled), "variants": comparison,
              "population": population_summary}
    with open(output, "w", encoding="utf-8") as handle:
        handle.write(two_level_json(result))


def two_level_json(value: dict[str, object]) -> str:
    """JSON with one line per second-level entry, so the cited summary stays short and diffable."""
    def compact(item) -> str:
        return json.dumps(item, ensure_ascii=False, separators=(",", ":"))

    lines = ["{"]
    for i, (key, section) in enumerate(value.items()):
        tail = "," if i < len(value) - 1 else ""
        if isinstance(section, dict) and section:
            lines.append(f" {compact(key)}: {{")
            for j, (inner, item) in enumerate(section.items()):
                lines.append(f"  {compact(inner)}: {compact(item)}{',' if j < len(section) - 1 else ''}")
            lines.append(" }" + tail)
        else:
            lines.append(f" {compact(key)}: {compact(section)}{tail}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    measure = commands.add_parser("measure", help="run generators for a CPU budget and summarise supply")
    measure.add_argument("--seed", type=int, default=738)
    measure.add_argument("--generators", default="G1,G2,G3")
    measure.add_argument("--levels", default="1,2,3,4,5")
    measure.add_argument("--seconds", type=float, default=30, help="CPU seconds per worker for each generator x level")
    measure.add_argument("--workers", type=int, default=4)
    measure.add_argument("--records", help="write the seed and every attempt as JSON to this path")
    survey = commands.add_parser("population", help="feature frequencies on undirected random problems")
    survey.add_argument("--seed", type=int, default=738)
    survey.add_argument("--boards", type=int, default=1200, help="boards per (cars, size) shape")
    survey.add_argument("--workers", type=int, default=4, help="does not change the result")
    survey.add_argument("--rows", help="write every problem's features to this path")
    summary = commands.add_parser("digest", help="write the small summary cited by the research notes")
    summary.add_argument("records", nargs="+")
    summary.add_argument("--population", required=True)
    summary.add_argument("--output", default="parking_jam_dispatch_levels.expected.json")
    args = parser.parse_args()
    if args.command == "measure":
        result, rows = run(args.seed, args.generators.split(","), [int(x) for x in args.levels.split(",")],
                           args.seconds, args.workers)
        if args.records:
            with open(args.records, "w", encoding="utf-8") as handle:
                json.dump({"seed": args.seed, "rows": rows}, handle, ensure_ascii=False)
        print(json.dumps(result, ensure_ascii=False, indent=1))
    elif args.command == "population":
        result, rows = population(args.seed, args.boards, args.workers)
        if args.rows:
            with open(args.rows, "w", encoding="utf-8") as handle:
                json.dump(rows, handle)
        print(json.dumps(result, ensure_ascii=False, indent=1))
    else:
        digest(args.records, args.population, args.output)


if __name__ == "__main__":
    main()
