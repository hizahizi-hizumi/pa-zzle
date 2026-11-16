"""Research-only exact search and reading model for the passenger-queue rule (#739).

Rule (rule-lab `passengers` mode): a car leaves the lot when one of its rays toward
an open side is free and fewer than `bays` cars wait. The car joins the waiting
row; while the queue head's color matches a waiting car, the first such car in the
row takes one passenger and departs once it holds as many as its length.

State compression (derived in `PassengerGame`, checked against `ExplicitPassengerGame`):

1. Passengers of color c only board color-c cars, and a waiting car always has a
   free seat, so a color-c car waits exactly while the color-c seats supplied by
   exited cars exceed the color-c passengers boarded. The head therefore advances
   while `capacity_c(exited) > boarded_c`, which depends on the exited set only:
   the head index, and the free seats per color, are functions of the remaining mask.
2. Within one color, the first waiting car in the row takes every passenger until
   it is full, so color-c cars fill one after another in arrival order (FIFO).
3. The row order across colors never matters, and a waiting car is off the board,
   so its identity does not matter either; only its length does.

Hence a state is (remaining mask, per color the lengths of waiting cars in arrival
order); the front car's boarded count follows from the free seats. Unlike the
dispatch rule, the waiting count is not a function of the remaining mask alone: two
same-color cars of lengths 2 and 3 empty the row at different times depending on
which arrived first.

The reader serves the queue one advance at a time. A plan is an inclusion-minimal
set of exits after which the head advances; its last exit is the head-color car.
It is a model for comparing candidate problems, not a measurement of human play.
"""
from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from functools import cached_property
from itertools import permutations, product

from parking_jam_dispatch_reading import (
    geometric_canonical,
    iter_bits,
    legal_open,
    legal_sequence,
    open_rays,
    side_blockers,
    unblocked_sides,
)
from parking_jam_rule_space import Vehicle, positions

State = tuple[int, tuple[tuple[int, ...], ...]]


class PassengerGame:
    """Exact passenger-queue game on compressed states."""

    def __init__(self, sides, colors: list[str], lengths: list[int], queue: list[str], bays: int):
        if not (len(sides) == len(colors) == len(lengths)):
            raise ValueError("sides, colors and lengths describe the same cars")
        capacity = Counter()
        for color, length in zip(colors, lengths):
            capacity[color] += length
        if capacity != Counter(queue):
            raise ValueError("each color needs as many passengers as its cars' seats")
        self.sides = sides
        self.colors = list(colors)
        self.lengths = list(lengths)
        self.queue = list(queue)
        self.bays = bays
        self.n = len(sides)
        self.full = (1 << self.n) - 1
        self.palette = sorted(capacity)
        self.color_of = [self.palette.index(c) for c in colors]
        self.queue_colors = [self.palette.index(c) for c in queue]
        self.color_mask = [sum(1 << i for i, c in enumerate(self.color_of) if c == k) for k in range(len(self.palette))]
        self.start: State = (self.full, tuple(() for _ in self.palette))
        self._info: dict[int, tuple[int, tuple[int, ...]]] = {}
        self._legal: dict[int, tuple[int, ...]] = {}
        self._win: dict[State, bool] = {}
        self._reach: dict[State, int] = {}

    def info(self, mask: int) -> tuple[int, tuple[int, ...]]:
        """(head index, free seats per color) after the cars outside `mask` have exited."""
        cached = self._info.get(mask)
        if cached is None:
            supply = [0] * len(self.palette)
            for i in iter_bits(self.full & ~mask):
                supply[self.color_of[i]] += self.lengths[i]
            head = 0
            for c in self.queue_colors:
                if not supply[c]:
                    break
                supply[c] -= 1
                head += 1
            cached = (head, tuple(supply))
            self._info[mask] = cached
        return cached

    def progress(self, state: State) -> int:
        return self.info(state[0])[0]

    @staticmethod
    def waiting(state: State) -> int:
        return sum(len(row) for row in state[1])

    def alive(self, state: State) -> bool:
        return state[0] == 0 or self.waiting(state) < self.bays

    def boarded_front(self, state: State) -> tuple[int, ...]:
        free = self.info(state[0])[1]
        return tuple(sum(row) - free[c] if row else 0 for c, row in enumerate(state[1]))

    def step(self, state: State, car: int) -> State:
        mask, rows = state
        child = mask & ~(1 << car)
        free = self.info(child)[1]
        settled = []
        for c, row in enumerate(rows):
            if c == self.color_of[car]:
                row = (*row, self.lengths[car])
            consumed = sum(row) - free[c]
            start = 0
            while start < len(row) and consumed >= row[start]:
                consumed -= row[start]
                start += 1
            settled.append(row[start:])
        return child, tuple(settled)

    def geometric_moves(self, mask: int) -> tuple[int, ...]:
        cached = self._legal.get(mask)
        if cached is None:
            cached = tuple(i for i in iter_bits(mask) if any(not s & mask for s in self.sides[i]))
            self._legal[mask] = cached
        return cached

    def moves(self, state: State) -> tuple[int, ...]:
        if state[0] == 0 or self.waiting(state) >= self.bays:
            return ()
        return self.geometric_moves(state[0])

    def wins(self, state: State) -> bool:
        cached = self._win.get(state)
        if cached is None:
            cached = state[0] == 0 or any(self.wins(self.step(state, i)) for i in self.moves(state))
            self._win[state] = cached
        return cached

    def solution_count(self, state: State | None = None) -> int:
        cache: dict[State, int] = {}

        def count(s: State) -> int:
            if s[0] == 0:
                return 1
            if s not in cache:
                cache[s] = sum(count(self.step(s, i)) for i in self.moves(s))
            return cache[s]

        return count(self.start if state is None else state)

    def max_reach(self, state: State) -> int:
        """Largest head index some continuation reaches without overflowing."""
        cached = self._reach.get(state)
        if cached is None:
            cached = max([self.progress(state), *(self.max_reach(self.step(state, i)) for i in self.moves(state))])
            self._reach[state] = cached
        return cached

    def win_probability(self, policy: str) -> float:
        """Uniform choice among moves; `head-first` prefers head-color cars that can exit."""
        if policy not in ("uniform", "head-first"):
            raise ValueError(policy)
        cache: dict[State, float] = {}

        def visit(s: State) -> float:
            if s[0] == 0:
                return 1.0
            if s in cache:
                return cache[s]
            options = self.moves(s)
            if policy == "head-first" and options:
                head = self.queue_colors[self.progress(s)]
                options = [i for i in options if self.color_of[i] == head] or options
            value = sum(visit(self.step(s, i)) for i in options) / len(options) if options else 0.0
            cache[s] = value
            return value

        return visit(self.start)


def minimum_bays(sides, colors, lengths, queue) -> int | None:
    """1 + min over complete runs of the max waiting count; None when the lot cannot be cleared."""
    probe = PassengerGame(sides, colors, lengths, queue, len(sides) + 1)
    stuck = len(sides) + 1
    cache: dict[State, int] = {}

    def peak(s: State) -> int:
        if s[0] == 0:
            return 0
        cached = cache.get(s)
        if cached is None:
            values = []
            for i in probe.geometric_moves(s[0]):
                child = probe.step(s, i)
                values.append(max(probe.waiting(child) if child[0] else 0, peak(child)))
            cached = min(values, default=stuck)
            cache[s] = cached
        return cached

    value = peak(probe.start)
    return None if value >= stuck else value + 1


class ExplicitPassengerGame:
    """The rule-lab transition, state for state: ordered waiting row with car ids and boarded counts."""

    def __init__(self, sides, colors, lengths, queue, bays):
        self.sides, self.colors, self.lengths, self.queue, self.bays = sides, colors, lengths, queue, bays
        self.n = len(sides)
        self.start = (tuple(range(self.n)), (), 0)

    def moves(self, state):
        remaining, waiting, _ = state
        if not remaining or len(waiting) >= self.bays:
            return []
        mask = sum(1 << i for i in remaining)
        return [i for i in remaining if any(not s & mask for s in self.sides[i])]

    def step(self, state, car):
        remaining, waiting, head = state
        docked = [list(w) for w in (*waiting, (car, 0))]
        while head < len(self.queue):
            index = next((k for k, (i, _) in enumerate(docked) if self.colors[i] == self.queue[head]), None)
            if index is None:
                break
            docked[index][1] += 1
            head += 1
            if docked[index][1] == self.lengths[docked[index][0]]:
                docked.pop(index)
        return tuple(i for i in remaining if i != car), tuple(tuple(w) for w in docked), head

    def won(self, state):
        return not state[0] and not state[1] and state[2] == len(self.queue)

    def project(self, state) -> tuple:
        """Remaining cars, head, and per color the (length, boarded) of waiting cars in row order."""
        remaining, waiting, head = state
        rows = {c: tuple((self.lengths[i], b) for i, b in waiting if self.colors[i] == c) for c in sorted(set(self.colors))}
        return sum(1 << i for i in remaining), head, tuple(rows.values())


def project_compressed(game: PassengerGame, state: State) -> tuple:
    front = game.boarded_front(state)
    rows = tuple(tuple((length, front[c] if k == 0 else 0) for k, length in enumerate(row))
                 for c, row in enumerate(state[1]))
    return state[0], game.progress(state), rows


@dataclass(frozen=True)
class Plan:
    outcome: State
    exits: int
    head_car: int


class PassengerReading:
    """Decisions of a reader who advances the queue head one plan at a time.

    Natural plans: inclusion-minimal plans, smallest for their head-color car, and,
    while some head-color car can exit at once, only plans that exit such a car.
    The reader follows winning natural plans, or any winning plan when no natural
    plan wins. A losing option is a natural plan outcome from which no run wins.
    """

    def __init__(self, game: PassengerGame, free_game: PassengerGame | None = None, skip_buried_twin: bool = True,
                 with_reasons: bool = True):
        self.game = game
        self.free = free_game or PassengerGame(unblocked_sides(game.n), game.colors, game.lengths, game.queue, game.bays)
        self.skip_buried_twin = skip_buried_twin
        self.with_reasons = with_reasons
        self._plans: dict[State, tuple[Plan, ...]] = {}
        self._natural: dict[State, tuple[Plan, ...]] = {}
        self._survival: dict[State, tuple[int, int]] = {}

    def plans(self, state: State) -> tuple[Plan, ...]:
        cached = self._plans.get(state)
        if cached is not None:
            return cached
        game = self.game
        base = game.progress(state)
        seen = {state}
        frontier = [state]
        hits: dict[State, int] = {}
        while frontier:
            following = []
            for s in frontier:
                for i in game.moves(s):
                    child = game.step(s, i)
                    if child in seen:
                        continue
                    seen.add(child)
                    if game.progress(child) > base:
                        if game.alive(child):
                            hits[child] = state[0] & ~child[0]
                    else:
                        following.append(child)
            frontier = following
        exit_sets = set(hits.values())
        minimal = {e for e in exit_sets if not any(o != e and o & e == o for o in exit_sets)}
        head = game.color_mask[game.queue_colors[base]]
        result = tuple(sorted(
            (Plan(outcome, exits, (exits & head).bit_length() - 1) for outcome, exits in hits.items() if exits in minimal),
            key=lambda p: (p.exits, p.outcome)))
        self._plans[state] = result
        return result

    def natural(self, state: State) -> tuple[Plan, ...]:
        cached = self._natural.get(state)
        if cached is None:
            plans = self.plans(state)
            smallest: dict[int, int] = {}
            for p in plans:
                smallest[p.head_car] = min(smallest.get(p.head_car, self.game.n), p.exits.bit_count())
            cached = tuple(p for p in plans if p.exits.bit_count() == smallest[p.head_car])
            if self.skip_buried_twin and cached:
                head = self.game.color_mask[self.game.queue_colors[self.game.progress(state)]]
                free = {i for i in self.game.geometric_moves(state[0]) if head >> i & 1}
                if free:
                    cached = tuple(p for p in cached if p.head_car in free)
            self._natural[state] = cached
        return cached

    def path(self) -> list[State]:
        game = self.game
        order = [game.start]
        seen = {game.start}
        for state in order:
            if state[0] == 0:
                continue
            winners = [p.outcome for p in self.natural(state) if game.wins(p.outcome)]
            for child in winners or [p.outcome for p in self.plans(state) if game.wins(p.outcome)]:
                if child not in seen:
                    seen.add(child)
                    order.append(child)
        return order

    def survival(self, state: State) -> tuple[int, int]:
        """(min, max) head index at which natural play from `state` stops."""
        cached = self._survival.get(state)
        if cached is None:
            children = self.natural(state) if state[0] else ()
            if not children:
                served = self.game.progress(state)
                cached = (served, served)
            else:
                ends = [self.survival(p.outcome) for p in children]
                cached = (min(e[0] for e in ends), max(e[1] for e in ends))
            self._survival[state] = cached
        return cached

    def kind(self, loser: Plan, winners: list[Plan]) -> str:
        """twin: another car of the head color; route: same car, other cars dug;
        order: same exits as a winner, other arrival order; other: no natural plan wins."""
        if not winners:
            return "other"
        if any(w.exits == loser.exits for w in winners):
            return "order"
        if any(w.head_car == loser.head_car for w in winners):
            return "route"
        return "twin"

    def reason(self, state: State, loser: Plan, winners: list[Plan]) -> str:
        """A: the cars the losing plan leaves block a later exit; B: its extra waiting cars take bays."""
        game = self.game
        if not winners:
            return "unknown"
        reference = min(winners, key=lambda p: (p.exits ^ loser.exits).bit_count())
        left = reference.exits & ~loser.exits
        extra = loser.exits & ~reference.exits
        direct = False
        if left:
            cleared = tuple(tuple(side & ~left for side in sides) for sides in game.sides)
            direct = PassengerGame(cleared, game.colors, game.lengths, game.queue, game.bays).wins(loser.outcome)
        extra_waiting = sum(1 for row in loser.outcome[1] for _ in row) - sum(1 for row in reference.outcome[1] for _ in row)
        pressure = False
        if extra or extra_waiting > 0:
            more = max(1, extra_waiting, extra.bit_count())
            pressure = PassengerGame(game.sides, game.colors, game.lengths, game.queue, game.bays + more).wins(loser.outcome)
        return {(True, True): "AB", (True, False): "A", (False, True): "B"}.get((direct, pressure), "unknown")

    def decision(self, state: State) -> dict[str, object] | None:
        game = self.game
        natural = self.natural(state)
        outcomes = {p.outcome for p in natural}
        winners = [p for p in natural if game.wins(p.outcome)]
        losers = [p for p in natural if not game.wins(p.outcome)]
        if not losers:
            return None
        fallback = winners or [p for p in self.plans(state) if game.wins(p.outcome)]
        base = game.progress(state)
        remaining = len(game.queue) - base
        items = []
        for p in losers:
            survival = self.survival(p.outcome)
            twin_lengths = {game.lengths[w.head_car] for w in fallback}
            items.append({
                "kind": self.kind(p, winners),
                "sameLength": game.lengths[p.head_car] in twin_lengths,
                "blockingEssential": self.free.wins(p.outcome),
                "reason": self.reason(state, p, fallback) if self.with_reasons else None,
                "distanceMin": survival[0] - base,
                "distanceMax": survival[1] - base,
                "visible": game.max_reach(p.outcome) - base + 1,
            })
        return {
            "state": state,
            "served": base,
            "remaining": remaining,
            "options": len(outcomes),
            "winningNatural": len(winners),
            "losing": items,
        }

    def summary(self) -> dict[str, object]:
        forced = free_choice = 0
        decisions = []
        for state in self.path():
            if state[0] == 0:
                continue
            outcomes = {p.outcome for p in self.natural(state)}
            item = self.decision(state)
            if item is not None:
                decisions.append(item)
            elif len(outcomes) <= 1:
                forced += 1
            else:
                free_choice += 1
        losing = [x for d in decisions for x in d["losing"]]
        essential_states = sum(all(x["blockingEssential"] for x in d["losing"]) for d in decisions)
        queue_states = sum(not any(x["blockingEssential"] for x in d["losing"]) for d in decisions)
        return {
            "pathStates": forced + free_choice + len(decisions),
            "forcedStates": forced,
            "freeChoiceStates": free_choice,
            "decisions": len(decisions),
            "essentialDecisions": essential_states,
            "queueDecisions": queue_states,
            "mixedDecisions": len(decisions) - essential_states - queue_states,
            "losingOptions": len(losing),
            "essentialOptions": sum(x["blockingEssential"] for x in losing),
            "kinds": dict(Counter(x["kind"] for x in losing)),
            "kindsEssential": dict(Counter(x["kind"] for x in losing if x["blockingEssential"])),
            "twinSameLength": sum(x["kind"] == "twin" and x["sameLength"] for x in losing),
            "reasons": dict(Counter(x["reason"] for x in losing)),
            "hasA": int(any(x["reason"] in ("A", "AB") for x in losing)),
            "hasB": int(any(x["reason"] in ("B", "AB") for x in losing)),
            "distanceMax": max((x["distanceMax"] for x in losing), default=0),
            "visibleMax": max((x["visible"] for x in losing), default=0),
            "onlyUnnaturalWins": sum(d["winningNatural"] == 0 for d in decisions),
            "detail": decisions,
        }


@dataclass
class PassengerProblem:
    vehicles: tuple[Vehicle, ...]
    size: int
    openings: frozenset[str]
    colors: list[str]
    queue: list[str]

    @cached_property
    def sides(self):
        return side_blockers(self.vehicles, self.openings)

    @property
    def lengths(self) -> list[int]:
        return [v.length for v in self.vehicles]

    def game(self, bays: int, geometry: bool = True) -> PassengerGame:
        sides = self.sides if geometry else unblocked_sides(len(self.vehicles))
        return PassengerGame(sides, self.colors, self.lengths, self.queue, bays)

    def explicit(self, bays: int, geometry: bool = True) -> ExplicitPassengerGame:
        sides = self.sides if geometry else unblocked_sides(len(self.vehicles))
        return ExplicitPassengerGame(sides, self.colors, self.lengths, self.queue, bays)

    def minimum_bays(self, geometry: bool = True) -> int | None:
        sides = self.sides if geometry else unblocked_sides(len(self.vehicles))
        return minimum_bays(sides, self.colors, self.lengths, self.queue)

    def diagram(self) -> str:
        names = "0123456789ab"
        grid = [["." for _ in range(self.size)] for _ in range(self.size)]
        for index, v in enumerate(self.vehicles):
            for j in range(v.length):
                grid[v.row + (j if v.direction == "vertical" else 0)][v.column + (j if v.direction == "horizontal" else 0)] = names[index]

        def edge(side: str, mark: str) -> str:
            return mark if side in self.openings else "#"

        rows = [edge("left", ">") + "".join(row) + edge("right", "<") for row in grid]
        return "\n".join([" " + edge("top", "v") * self.size + " ", *rows, " " + edge("bottom", "^") * self.size + " "])

    def to_json(self) -> dict[str, object]:
        return {
            "size": self.size,
            "openings": sorted(self.openings),
            "vehicles": [{"car": i, "row": v.row, "column": v.column, "orientation": v.direction, "length": v.length,
                          "color": c} for i, (v, c) in enumerate(zip(self.vehicles, self.colors))],
            "queue": self.queue,
        }

    @classmethod
    def from_json(cls, spec: dict[str, object]) -> PassengerProblem:
        lookup = {(v.row, v.column, v.direction, v.length): v for v in positions(spec["size"])}
        vehicles = tuple(lookup[(c["row"], c["column"], c["orientation"], c["length"])] for c in spec["vehicles"])
        return cls(vehicles, spec["size"], frozenset(spec["openings"]), [c["color"] for c in spec["vehicles"]],
                   list(spec["queue"]))


def make_board_lengths(rng: random.Random, candidates: list[Vehicle], count: int, openings: frozenset[str],
                       long_share: float) -> tuple[Vehicle, ...] | None:
    """`make_board_open` that draws each car's length first (3 with `long_share`)."""
    candidates = [v for v in candidates if open_rays(v, openings)]
    vehicles: tuple[Vehicle, ...] = ()
    occupied = 0
    for index in range(count):
        options = [v for v in candidates if not v.occupancy & occupied
                   and any(not ray & occupied for ray in open_rays(v, openings))]
        if not options:
            return None
        length = 3 if rng.random() < long_share else 2
        options = [v for v in options if v.length == length] or options
        before = set(legal_open(vehicles, (1 << index) - 1, openings))
        if before and rng.random() < 0.8:
            blocking = [v for v in options
                        if before - set(legal_open((*vehicles, v), (1 << (index + 1)) - 1, openings))]
            if blocking:
                options = blocking
        chosen = rng.choice(options)
        vehicles = (*vehicles, chosen)
        occupied |= chosen.occupancy
    return vehicles


def generate_board(rng: random.Random, n: int, size: int, openings: frozenset[str], long_share: float,
                   attempts: int = 200) -> tuple[Vehicle, ...]:
    pool = positions(size)
    for _ in range(attempts):
        board = make_board_lengths(rng, pool, n, openings, long_share)
        if board is not None:
            return board
    raise RuntimeError(f"no board with {n} cars on {size}x{size} for {sorted(openings)}")


def assign_colors(rng: random.Random, n: int, scheme: str) -> list[str]:
    """`pairs`: n/2 colors twice each; `3` or `4`: that many colors, counts differing by at most one."""
    count = n // 2 if scheme == "pairs" else int(scheme)
    colors = [chr(65 + j % count) for j in range(n)]
    rng.shuffle(colors)
    return colors


def order_queue(rng: random.Random, sides, colors, lengths) -> list[str]:
    """`make_queue`: passengers of a legal exit order, batches interleaved among the next three cars."""
    batches = [[colors[i]] * lengths[i] for i in legal_sequence(sides, rng)]
    queue = []
    while batches:
        selection = rng.randrange(min(3, len(batches))) if rng.random() < 0.35 else 0
        queue.append(batches[selection].pop())
        if not batches[selection]:
            batches.pop(selection)
    return queue


def shuffled_queue(rng: random.Random, colors, lengths) -> list[str]:
    queue = [c for c, length in zip(colors, lengths) for _ in range(length)]
    rng.shuffle(queue)
    return queue


def canonical(problem: PassengerProblem) -> tuple:
    """Same problem under the 8 board symmetries and color renaming (lengths ride on the cars)."""
    return geometric_canonical(problem.vehicles, problem.size, problem.openings, problem.colors, problem.queue)


def structural_canonical(problem: PassengerProblem) -> tuple:
    """Blocking antichains, colors, lengths and queue up to renaming cars of the same color and length."""
    labels: dict[str, int] = {}
    for c in problem.queue:
        labels.setdefault(c, len(labels))
    groups: dict[tuple[int, int], list[int]] = {}
    for i, (c, length) in enumerate(zip(problem.colors, problem.lengths)):
        groups.setdefault((labels[c], length), []).append(i)
    order = [groups[k] for k in sorted(groups)]
    best = None
    for arrangement in product(*(permutations(m) for m in order)):
        sequence = [car for members in arrangement for car in members]
        rename = {car: position for position, car in enumerate(sequence)}
        cars = []
        for car in sequence:
            renamed = sorted({sum(1 << rename[j] for j in iter_bits(s)) for s in problem.sides[car]})
            antichain = tuple(s for s in renamed if not any(o != s and o & s == o for o in renamed))
            cars.append((labels[problem.colors[car]], problem.lengths[car], antichain))
        form = tuple(cars)
        if best is None or form < best:
            best = form
    return best, tuple(labels[c] for c in problem.queue)

