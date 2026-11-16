"""Research-only reading model for the dispatch-request rule (#738).

Rule: a car leaves the lot when one of its two rays toward an open side is
free; it then waits until the request head asks for its color. A run fails when
the waiting count reaches the bay capacity after an exit. Because each car is
served once, the remaining-car set alone determines the served prefix and the
waiting count, so every search below uses that set as its state.

The "h-request reader" plans an inclusion-minimal set of exits that serves the
next h requests, executes it, and plans again. It is a model for comparing
candidate problems, not a measurement of human difficulty.
"""
from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from functools import cached_property
from itertools import permutations, product

from parking_jam_rule_space import Vehicle, positions

SIDES = ("top", "right", "bottom", "left")
ALL_OPEN = frozenset(SIDES)
OUTWARD = {"top": (-1, 0), "right": (0, 1), "bottom": (1, 0), "left": (0, -1)}
OPENINGS_BY_NAME = {
    "all4": ALL_OPEN,
    "adjacent2": frozenset({"top", "right"}),
    "opposite2": frozenset({"top", "bottom"}),
    "one": frozenset({"top"}),
}
BOARD_SHAPES = ((8, 6), (8, 7), (10, 7), (12, 7), (12, 8))


def ray_sides(vehicle: Vehicle) -> tuple[str, str]:
    return ("left", "right") if vehicle.direction == "horizontal" else ("top", "bottom")


def open_rays(vehicle: Vehicle, openings: frozenset[str]) -> list[int]:
    return [ray for ray, side in zip(vehicle.paths, ray_sides(vehicle)) if side in openings]


def legal_open(vehicles: tuple[Vehicle, ...], remaining: int, openings: frozenset[str]) -> list[int]:
    occupied = 0
    for index, vehicle in enumerate(vehicles):
        if remaining & (1 << index):
            occupied |= vehicle.occupancy
    return [
        index for index, vehicle in enumerate(vehicles)
        if remaining & (1 << index) and any(not occupied & ray for ray in open_rays(vehicle, openings))
    ]


def make_board_open(
    rng: random.Random, candidates: list[Vehicle], count: int, openings: frozenset[str],
) -> tuple[Vehicle, ...] | None:
    """`make_board` restricted to rays toward open sides.

    Each car is placed with a free open ray among the cars placed before it, so
    the reverse placement order is always a legal complete exit order.
    """
    candidates = [vehicle for vehicle in candidates if open_rays(vehicle, openings)]
    vehicles: tuple[Vehicle, ...] = ()
    occupied = 0
    for index in range(count):
        options = [
            vehicle for vehicle in candidates
            if not vehicle.occupancy & occupied
            and any(not ray & occupied for ray in open_rays(vehicle, openings))
        ]
        if not options:
            return None
        before = set(legal_open(vehicles, (1 << index) - 1, openings))
        if before and rng.random() < 0.8:
            blocking = [
                vehicle for vehicle in options
                if before - set(legal_open((*vehicles, vehicle), (1 << (index + 1)) - 1, openings))
            ]
            if blocking:
                options = blocking
        chosen = rng.choice(options)
        vehicles = (*vehicles, chosen)
        occupied |= chosen.occupancy
    return vehicles


def side_blockers(vehicles: tuple[Vehicle, ...], openings: frozenset[str]) -> tuple[tuple[int, ...], ...]:
    """For each car, the car-index masks blocking each of its open rays."""
    return tuple(
        tuple(
            sum(1 << j for j, other in enumerate(vehicles) if j != i and other.occupancy & ray)
            for ray in open_rays(vehicle, openings)
        )
        for i, vehicle in enumerate(vehicles)
    )


def unblocked_sides(count: int) -> tuple[tuple[int, ...], ...]:
    return tuple((0,) for _ in range(count))


def legal_sequence(sides: tuple[tuple[int, ...], ...], rng: random.Random) -> list[int]:
    remaining = (1 << len(sides)) - 1
    order = []
    while remaining:
        choice = rng.choice([i for i in iter_bits(remaining) if any(not s & remaining for s in sides[i])])
        order.append(choice)
        remaining &= ~(1 << choice)
    return order


def iter_bits(mask: int):
    while mask:
        low = mask & -mask
        yield low.bit_length() - 1
        mask ^= low


class DispatchGame:
    """Exact dispatch game on remaining-car masks, with reading-model queries."""

    def __init__(self, sides: tuple[tuple[int, ...], ...], colors: list[str], request: list[str], bays: int):
        if len(colors) != len(sides):
            raise ValueError("every car needs exactly one color")
        if Counter(colors) != Counter(request):
            raise ValueError("request must be a permutation of the car colors")
        self.sides = sides
        self.colors = list(colors)
        self.request = list(request)
        self.bays = bays
        self.n = len(sides)
        self.full = (1 << self.n) - 1
        self.color_mask = {c: sum(1 << i for i, x in enumerate(colors) if x == c) for c in set(colors)}
        self._progress: dict[int, int] = {}
        self._legal: dict[int, tuple[int, ...]] = {}
        self._win: dict[int, bool] = {}
        self._plans: dict[tuple[int, int], tuple[int, ...]] = {}
        self._chunked: dict[tuple[int, int], tuple[bool, float]] = {}
        self._rolling: dict[tuple[int, int], bool] = {}
        self._reach: dict[tuple[int, int], bool] = {}

    def progress(self, mask: int) -> int:
        cached = self._progress.get(mask)
        if cached is None:
            removed = self.full & ~mask
            supply = {c: (removed & bits).bit_count() for c, bits in self.color_mask.items()}
            cached = 0
            for c in self.request:
                if not supply[c]:
                    break
                supply[c] -= 1
                cached += 1
            self._progress[mask] = cached
        return cached

    def waiting(self, mask: int) -> int:
        return (self.full ^ mask).bit_count() - self.progress(mask)

    def alive(self, mask: int) -> bool:
        return self.waiting(mask) < self.bays

    def geometric_moves(self, mask: int) -> tuple[int, ...]:
        cached = self._legal.get(mask)
        if cached is None:
            cached = tuple(i for i in iter_bits(mask) if any(not s & mask for s in self.sides[i]))
            self._legal[mask] = cached
        return cached

    def moves(self, mask: int) -> tuple[int, ...]:
        return self.geometric_moves(mask) if self.alive(mask) else ()

    def wins(self, mask: int) -> bool:
        cached = self._win.get(mask)
        if cached is None:
            cached = mask == 0 or any(self.wins(mask & ~(1 << i)) for i in self.moves(mask))
            self._win[mask] = cached
        return cached

    def solution_count(self) -> int:
        cache: dict[int, int] = {0: 1}

        def count(mask: int) -> int:
            if mask not in cache:
                cache[mask] = sum(count(mask & ~(1 << i)) for i in self.moves(mask))
            return cache[mask]

        return count(self.full)

    def plans(self, mask: int, horizon: int) -> tuple[int, ...]:
        """M_h: remaining masks after each inclusion-minimal plan (as maximal masks)."""
        key = (mask, horizon)
        cached = self._plans.get(key)
        if cached is not None:
            return cached
        target = min(self.progress(mask) + horizon, self.n)
        seen = {mask}
        frontier = [mask]
        hits = []
        while frontier:
            following = []
            for state in frontier:
                for i in self.moves(state):
                    child = state & ~(1 << i)
                    if child in seen:
                        continue
                    seen.add(child)
                    if self.progress(child) >= target:
                        if self.alive(child) or child == 0:
                            hits.append(child)
                    else:
                        following.append(child)
            frontier = following
        hits.sort(key=lambda m: -m.bit_count())
        minimal: list[int] = []
        for hit in hits:
            if not any(kept & hit == hit for kept in minimal):
                minimal.append(hit)
        result = tuple(minimal)
        self._plans[key] = result
        return result

    def chunked(self, mask: int, horizon: int) -> tuple[bool, float]:
        """(always wins, win probability under a uniform plan choice) for the chunked reader."""
        key = (mask, horizon)
        cached = self._chunked.get(key)
        if cached is None:
            if mask == 0:
                cached = (True, 1.0)
            else:
                outcomes = [self.chunked(child, horizon) for child in self.plans(mask, horizon)]
                cached = (all(w for w, _ in outcomes), sum(p for _, p in outcomes) / len(outcomes)) if outcomes else (False, 0.0)
            self._chunked[key] = cached
        return cached

    def can_reach(self, start: int, goal: int) -> bool:
        """A non-failing exit order removes exactly start & ~goal."""
        key = (start, goal)
        cached = self._reach.get(key)
        if cached is None:
            if start == goal:
                cached = True
            else:
                cached = any(
                    self.can_reach(start & ~(1 << i), goal)
                    for i in self.moves(start) if not goal & (1 << i)
                    and (self.alive(start & ~(1 << i)) or start & ~(1 << i) == 0)
                )
            self._reach[key] = cached
        return cached

    def first_advances(self, mask: int, goal: int) -> set[int]:
        """States where some valid execution of the plan mask→goal first serves a new request."""
        base = self.progress(mask)
        found = set()
        seen = {mask}
        stack = [mask]
        while stack:
            state = stack.pop()
            for i in self.moves(state):
                if goal & (1 << i):
                    continue
                child = state & ~(1 << i)
                if child in seen or not (self.alive(child) or child == 0) or not self.can_reach(child, goal):
                    continue
                seen.add(child)
                if self.progress(child) > base:
                    found.add(child)
                else:
                    stack.append(child)
        return found

    def rolling(self, mask: int, horizon: int) -> bool:
        """Always wins when the reader replans as soon as the served count grows."""
        key = (mask, horizon)
        cached = self._rolling.get(key)
        if cached is None:
            if mask == 0:
                cached = True
            else:
                plans = self.plans(mask, horizon)
                cached = bool(plans) and all(
                    self.rolling(state, horizon)
                    for goal in plans for state in self.first_advances(mask, goal)
                )
            self._rolling[key] = cached
        return cached

    def win_probability(self, policy: str) -> float:
        cache: dict[int, float] = {}

        def visit(mask: int) -> float:
            if mask == 0:
                return 1.0
            if mask in cache:
                return cache[mask]
            choices = self.policy_choices(mask, policy)
            value = sum(visit(child) if ok else 0.0 for child, ok in choices) / len(choices) if choices else 0.0
            cache[mask] = value
            return value

        return visit(self.full)

    def policy_choices(self, mask: int, policy: str) -> list[tuple[int, bool]]:
        """Equally likely (next mask, executed without failure) for a naive policy."""
        if policy == "uniform":
            return [(mask & ~(1 << i), True) for i in self.moves(mask)]
        if policy == "head-first":
            options = self.moves(mask)
            if not options:
                return []
            head = self.color_mask[self.request[self.progress(mask)]]
            preferred = [i for i in options if head & (1 << i)]
            return [(mask & ~(1 << i), True) for i in (preferred or options)]
        if policy == "fewest-blockers":
            if not self.alive(mask):
                return []
            return [(goal, self.can_reach(mask, goal)) for goal in self.cheapest_head_plans(mask)]
        raise ValueError(policy)

    def cheapest_head_plans(self, mask: int) -> list[int]:
        """Minimum-size exit sets, ignoring bays, that end by exiting a head-color car."""
        head = self.color_mask[self.request[self.progress(mask)]]
        level = {mask}
        while level:
            goals = {state & ~(1 << i) for state in level for i in self.geometric_moves(state) if head & (1 << i)}
            if goals:
                return sorted(goals)
            level = {state & ~(1 << i) for state in level for i in self.geometric_moves(state) if not head & (1 << i)}
        raise ValueError("a head-color car must be reachable on a board with a legal exit order")


def minimum_bays(sides, colors, request) -> int | None:
    """Smallest capacity with a complete run: 1 + min over runs of the max waiting count.

    None when no capacity helps because the cars cannot all leave the lot.
    """
    probe = DispatchGame(sides, colors, request, len(sides) + 1)
    stuck = len(sides) + 1
    cache: dict[int, int] = {0: 0}

    def peak(mask: int) -> int:
        if mask in cache:
            return cache[mask]
        value = min((max(probe.waiting(mask & ~(1 << i)), peak(mask & ~(1 << i))) for i in probe.geometric_moves(mask)),
                    default=stuck)
        cache[mask] = value
        return value

    value = peak(probe.full)
    return None if value >= stuck else value + 1


@dataclass
class ReadingProfile:
    bays: int
    chunked_always: dict[int, bool]
    chunked_probability: dict[int, float]
    rolling_always: dict[int, bool]

    @property
    def h_star(self) -> int | None:
        return next((h for h in sorted(self.chunked_always) if self.chunked_always[h]), None)

    @property
    def rolling_h_star(self) -> int | None:
        return next((h for h in sorted(self.rolling_always) if self.rolling_always[h]), None)

    @staticmethod
    def non_monotone(always: dict[int, bool]) -> list[tuple[int, int]]:
        hs = sorted(always)
        return [(a, b) for a in hs for b in hs if a < b and always[a] and not always[b]]


def reading_profile(game: DispatchGame, max_horizon: int = 5, rolling: bool = True) -> ReadingProfile:
    chunked = {h: game.chunked(game.full, h) for h in range(1, max_horizon + 1)}
    rolled = {h: game.rolling(game.full, h) for h in range(1, max_horizon + 1)} if rolling else {}
    return ReadingProfile(game.bays, {h: a for h, (a, _) in chunked.items()},
                          {h: p for h, (_, p) in chunked.items()}, rolled)


def planner_states(game: DispatchGame, horizon: int, limit: int = 20000) -> list[int]:
    """Chunk boundaries the chunked reader can visit, in breadth-first order."""
    order = [game.full]
    seen = {game.full}
    for state in order:
        if len(order) >= limit:
            break
        for child in game.plans(state, horizon):
            if child not in seen:
                seen.add(child)
                order.append(child)
    return order


def path_states(game: DispatchGame, horizon: int) -> list[int]:
    """Every state on some execution of the chunked reader's plans, including inside a chunk."""
    found = set()
    for boundary in planner_states(game, horizon):
        found.add(boundary)
        for goal in game.plans(boundary, horizon):
            seen = {boundary}
            stack = [boundary]
            while stack:
                state = stack.pop()
                for i in game.moves(state):
                    child = state & ~(1 << i)
                    if (goal & (1 << i) or child in seen or not (game.alive(child) or child == 0)
                            or not game.can_reach(child, goal)):
                        continue
                    seen.add(child)
                    stack.append(child)
            found |= seen
    return sorted(found, key=lambda m: (-m.bit_count(), m))


def head_car(game: DispatchGame, mask: int, goal: int) -> int:
    removed = mask & ~goal & game.color_mask[game.request[game.progress(mask)]]
    return removed.bit_length() - 1


def classify_choices(game: DispatchGame, mask: int) -> dict[str, int] | None:
    """Losing one-request plans at a state, by what separates them from winning ones.

    `twin`: no winning plan uses the same head-color car. `route`: a winning
    plan uses the same car with other blockers. `other`: no one-request plan wins.
    """
    plans = game.plans(mask, 1)
    winners = [goal for goal in plans if game.wins(goal)]
    losers = [goal for goal in plans if not game.wins(goal)]
    if not losers:
        return None
    winning_cars = {head_car(game, mask, goal) for goal in winners}
    kinds = Counter()
    for goal in losers:
        if not winners:
            kinds["other"] += 1
        elif head_car(game, mask, goal) in winning_cars:
            kinds["route"] += 1
        else:
            kinds["twin"] += 1
    return {"choices": len(plans), "losing": len(losers), **kinds}


def decision_features(game: DispatchGame, horizon: int) -> dict[str, object]:
    states = [s for s in path_states(game, horizon) if s]
    decisions = [c for c in (classify_choices(game, s) for s in states) if c]
    kinds = Counter()
    state_kinds = Counter()
    for item in decisions:
        for kind in ("twin", "route", "other"):
            kinds[kind] += item.get(kind, 0)
            state_kinds[kind] += kind in item
    return {
        "pathStates": len(states),
        "decisionStates": len(decisions),
        "losingShare": sum(d["losing"] for d in decisions) / sum(d["choices"] for d in decisions) if decisions else 0.0,
        "losingChoicesByKind": dict(kinds),
        "decisionStatesByKind": dict(state_kinds),
    }


def exit_order(game: DispatchGame, start: int, goal: int) -> list[int]:
    order = []
    while start != goal:
        i = next(i for i in game.moves(start) if not goal & (1 << i)
                 and (game.alive(start & ~(1 << i)) or start & ~(1 << i) == 0)
                 and game.can_reach(start & ~(1 << i), goal))
        order.append(i)
        start &= ~(1 << i)
    return order


def first_branch(game: DispatchGame, h_star: int) -> dict[str, object] | None:
    """First H*-reader state where an (H*-1)-request plan loses outright."""
    shallow = max(1, h_star - 1)
    for state in planner_states(game, h_star):
        losing = [g for g in game.plans(state, shallow) if not game.wins(g)]
        if not losing:
            continue
        return {
            "removed": sorted(iter_bits(game.full & ~state)),
            "served": game.progress(state),
            "waiting": game.waiting(state),
            "shallowHorizon": shallow,
            "shallowWinning": [exit_order(game, state, g) for g in game.plans(state, shallow) if game.wins(g)],
            "shallowLosing": [exit_order(game, state, g) for g in losing],
            "deepPlans": [exit_order(game, state, g) for g in game.plans(state, h_star)],
        }
    return None


def unblock_costs(sides: tuple[tuple[int, ...], ...]) -> list[int]:
    """Per car, the fewest other exits (in a legal order) before it can exit."""
    n = len(sides)
    full = (1 << n) - 1
    costs = [None] * n
    level = {full}
    depth = 0
    while level and None in costs:
        for state in level:
            for i in iter_bits(state):
                if costs[i] is None and any(not s & state for s in sides[i]):
                    costs[i] = depth
        level = {state & ~(1 << i) for state in level for i in iter_bits(state) if any(not s & state for s in sides[i])}
        depth += 1
    return costs


def board_features(sides) -> dict[str, object]:
    costs = unblock_costs(sides)
    return {"initiallyBlocked": sum(c > 0 for c in costs), "maxUnblockCost": max(costs),
            "meanUnblockCost": sum(costs) / len(costs)}


SYMMETRIES = (
    lambda r, c, s: (r, c), lambda r, c, s: (c, s - 1 - r), lambda r, c, s: (s - 1 - r, s - 1 - c),
    lambda r, c, s: (s - 1 - c, r), lambda r, c, s: (r, s - 1 - c), lambda r, c, s: (s - 1 - r, c),
    lambda r, c, s: (c, r), lambda r, c, s: (s - 1 - c, s - 1 - r),
)


def color_labels(request: list[str]) -> dict[str, int]:
    labels: dict[str, int] = {}
    for c in request:
        labels.setdefault(c, len(labels))
    return labels


def geometric_canonical(vehicles, size: int, openings: frozenset[str], colors, request) -> tuple:
    """Canonical form under the 8 board symmetries (openings move along) and color renaming."""
    labels = color_labels(request)
    forms = []
    for op in SYMMETRIES:
        mapped_openings = []
        for side in openings:
            dr, dc = OUTWARD[side]
            ar, ac = op(1, 1, 3)
            br, bc = op(1 + dr, 1 + dc, 3)
            mapped_openings.append(next(s for s, v in OUTWARD.items() if v == (br - ar, bc - ac)))
        cars = []
        for vehicle, color in zip(vehicles, colors):
            cells = [(vehicle.row + (j if vehicle.direction == "vertical" else 0),
                      vehicle.column + (j if vehicle.direction == "horizontal" else 0)) for j in range(vehicle.length)]
            moved = [op(r, c, size) for r, c in cells]
            rows = {r for r, _ in moved}
            cars.append((min(rows), min(c for _, c in moved), "horizontal" if len(rows) == 1 else "vertical",
                         vehicle.length, labels[color]))
        forms.append((tuple(sorted(mapped_openings)), tuple(sorted(cars))))
    return (size, min(forms), tuple(labels[c] for c in request))


def structural_canonical(sides, colors, request) -> tuple:
    """Exact canonical form of (blocking antichains, colors, request) under car renaming.

    Colors are fixed by first appearance in the request, so only same-color
    cars can be exchanged; every ordering within every color is tried.
    """
    labels = color_labels(request)
    groups: dict[int, list[int]] = {}
    for i, c in enumerate(colors):
        groups.setdefault(labels[c], []).append(i)
    order = [groups[label] for label in sorted(groups)]
    best = None
    for arrangement in product(*(permutations(members) for members in order)):
        sequence = [car for members in arrangement for car in members]
        rename = {car: position for position, car in enumerate(sequence)}
        cars = []
        for car in sequence:
            renamed = sorted({sum(1 << rename[j] for j in iter_bits(s)) for s in sides[car]})
            antichain = tuple(s for s in renamed if not any(o != s and o & s == o for o in renamed))
            cars.append((labels[colors[car]], antichain))
        form = tuple(cars)
        if best is None or form < best:
            best = form
    return (best, tuple(labels[c] for c in request))


@dataclass
class Problem:
    vehicles: tuple[Vehicle, ...]
    size: int
    openings: frozenset[str]
    colors: list[str]
    request: list[str]

    @cached_property
    def sides(self):
        return side_blockers(self.vehicles, self.openings)

    def game(self, bays: int, geometry: bool = True) -> DispatchGame:
        return DispatchGame(self.sides if geometry else unblocked_sides(len(self.vehicles)), self.colors, self.request, bays)

    def diagram(self) -> str:
        names = "0123456789ab"
        grid = [["." for _ in range(self.size)] for _ in range(self.size)]
        for index, v in enumerate(self.vehicles):
            for j in range(v.length):
                r = v.row + (j if v.direction == "vertical" else 0)
                c = v.column + (j if v.direction == "horizontal" else 0)
                grid[r][c] = names[index]
        def edge(side: str, mark: str) -> str:
            return mark if side in self.openings else "#"

        top = " " + edge("top", "v") * self.size + " "
        bottom = " " + edge("bottom", "^") * self.size + " "
        rows = [edge("left", ">") + "".join(row) + edge("right", "<") for row in grid]
        return "\n".join([top, *rows, bottom])

    @classmethod
    def from_json(cls, spec: dict[str, object]) -> Problem:
        """Inverse of `to_json`."""
        lookup = {(v.row, v.column, v.direction, v.length): v for v in positions(spec["size"])}
        vehicles = tuple(lookup[(c["row"], c["column"], c["orientation"], c["length"])] for c in spec["vehicles"])
        return cls(vehicles, spec["size"], frozenset(spec["openings"]), [c["color"] for c in spec["vehicles"]],
                   list(spec["request"]))

    def to_json(self) -> dict[str, object]:
        return {
            "size": self.size,
            "openings": sorted(self.openings),
            "vehicles": [{"car": i, "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": c} for i, (v, c) in enumerate(zip(self.vehicles, self.colors))],
            "request": self.request,
        }


def pair_colors(rng: random.Random, n: int) -> list[str]:
    colors = [chr(65 + j) for j in range(n // 2) for _ in range(2)]
    rng.shuffle(colors)
    return colors


def distinct_colors(rng: random.Random, n: int) -> list[str]:
    colors = [chr(65 + j) for j in range(n)]
    rng.shuffle(colors)
    return colors


def order_request(rng: random.Random, sides, colors) -> list[str]:
    """`make_dispatch_queue` over a legal exit order of the given geometry."""
    order = legal_sequence(sides, rng)
    result = []
    while order:
        selection = rng.randrange(min(3, len(order))) if rng.random() < 0.35 else 0
        result.append(colors[order.pop(selection)])
    return result


def shuffled_request(rng: random.Random, colors) -> list[str]:
    request = list(colors)
    rng.shuffle(request)
    return request


def generate_board(rng: random.Random, n: int, size: int, openings: frozenset[str], attempts: int = 200):
    pool = positions(size)
    for _ in range(attempts):
        board = make_board_open(rng, pool, n, openings)
        if board is not None:
            return board
    raise RuntimeError(f"no board with {n} cars on {size}x{size} for openings {sorted(openings)}")
