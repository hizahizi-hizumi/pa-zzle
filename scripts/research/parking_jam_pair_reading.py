"""Research-only reading model for the same-color pair rule (#740).

Rule (rule-lab `pairs` mode): a car leaves the lot when one of its rays toward an
open side is free and enters the waiting bays. When every car of a color is
waiting, they all depart and free their bays. A run fails when the waiting count
reaches the bay capacity. With two cars per color this is the pair rule; larger
color groups are the "group" variant measured as a rule change.

The waiting cars are exactly the cars of colors that have left the lot only in
part, so the remaining-car set alone determines the waiting count and the
departed colors. Every search below uses that set as its state.

The reader works one departure at a time: it picks an inclusion-minimal set of
exits that makes one more color depart (a plan). This mirrors the one-request
reader of the dispatch study, with "a color departs" in place of "a request is
served".
"""
from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from functools import cached_property

from parking_jam_dispatch_reading import (
    BOARD_SHAPES,
    OPENINGS_BY_NAME,
    generate_board,
    iter_bits,
    side_blockers,
    unblocked_sides,
)
from parking_jam_rule_space import Vehicle, positions

FRONTEND_SIDE = {"top": "up", "right": "right", "bottom": "down", "left": "left"}
COLOR_NAMES = "ABCDEF"


class GroupGame:
    """Exact pair (or color-group) game on remaining-car masks."""

    def __init__(self, sides: tuple[tuple[int, ...], ...], colors: list[str], bays: int, group: int | None = None):
        if len(colors) != len(sides):
            raise ValueError("every car needs exactly one color")
        counts = Counter(colors)
        self.group = {c: group or n for c, n in counts.items()}
        if any(n % self.group[c] for c, n in counts.items()):
            raise ValueError("every color count must be a multiple of the departure group")
        self.sides = sides
        self.colors = list(colors)
        self.bays = bays
        self.n = len(sides)
        self.full = (1 << self.n) - 1
        self.color_mask = {c: sum(1 << i for i, x in enumerate(colors) if x == c) for c in sorted(set(colors))}
        self._info: dict[int, tuple[int, int]] = {}
        self._legal: dict[int, tuple[int, ...]] = {}
        self._win: dict[int, bool] = {}
        self._plans: dict[int, tuple[int, ...]] = {}
        self._exit_span: dict[int, tuple[int, int]] = {}

    def info(self, mask: int) -> tuple[int, int]:
        """(waiting cars, departed groups)."""
        cached = self._info.get(mask)
        if cached is None:
            removed = self.full & ~mask
            waiting = departed = 0
            for color, bits in self.color_mask.items():
                out = (removed & bits).bit_count()
                departed += out // self.group[color]
                waiting += out % self.group[color]
            cached = (waiting, departed)
            self._info[mask] = cached
        return cached

    def waiting(self, mask: int) -> int:
        return self.info(mask)[0]

    def departed(self, mask: int) -> int:
        return self.info(mask)[1]

    def waiting_colors(self, mask: int) -> list[str]:
        removed = self.full & ~mask
        return [c for c, bits in self.color_mask.items() if (removed & bits).bit_count() % self.group[c]]

    def alive(self, mask: int) -> bool:
        return self.waiting(mask) < self.bays

    def geometric_moves(self, mask: int) -> tuple[int, ...]:
        cached = self._legal.get(mask)
        if cached is None:
            cached = tuple(i for i in iter_bits(mask) if any(not s & mask for s in self.sides[i]))
            self._legal[mask] = cached
        return cached

    def moves(self, mask: int) -> tuple[int, ...]:
        """Legal exits, including ones whose bays then overflow (the run stops there)."""
        return self.geometric_moves(mask) if self.alive(mask) else ()

    def safe_moves(self, mask: int) -> tuple[int, ...]:
        """Exits after which the bays do not overflow."""
        return tuple(i for i in self.moves(mask) if self.alive(mask & ~(1 << i)))

    def wins(self, mask: int) -> bool:
        cached = self._win.get(mask)
        if cached is None:
            cached = mask == 0 or any(self.wins(mask & ~(1 << i)) for i in self.safe_moves(mask))
            self._win[mask] = cached
        return cached

    def solution_count(self, start: int | None = None) -> int:
        cache: dict[int, int] = {0: 1}

        def count(mask: int) -> int:
            if mask not in cache:
                cache[mask] = sum(count(mask & ~(1 << i)) for i in self.safe_moves(mask))
            return cache[mask]

        return count(self.full if start is None else start)

    def completes(self, mask: int, car: int) -> bool:
        """The exit makes cars of its color depart."""
        color = self.colors[car]
        out = (self.full & ~mask & self.color_mask[color]).bit_count()
        return (out + 1) % self.group[color] == 0

    def free_actions(self, mask: int) -> list[tuple[int, ...]]:
        """Exit runs that clear every remaining car of one color without holding any other color.

        Moving such a run to the front of any winning order keeps the order legal
        and never raises the waiting count, so it is always safe.
        """
        actions = []
        if not self.alive(mask):
            return actions
        for bits in self.color_mask.values():
            if not mask & bits:
                continue
            state = mask
            run = []
            while state & bits:
                ready = [i for i in self.geometric_moves(state) if bits >> i & 1]
                if not ready:
                    break
                state &= ~(1 << ready[0])
                run.append(ready[0])
                if state & bits and not self.alive(state):
                    break
            if not state & bits:
                actions.append(tuple(run))
        return actions

    def plans(self, mask: int) -> tuple[int, ...]:
        """Remaining masks after each inclusion-minimal exit set that makes one more color depart."""
        cached = self._plans.get(mask)
        if cached is not None:
            return cached
        base = self.departed(mask)
        seen = {mask}
        frontier = [mask]
        hits = []
        while frontier:
            following = []
            for state in frontier:
                for i in self.safe_moves(state):
                    child = state & ~(1 << i)
                    if child in seen:
                        continue
                    seen.add(child)
                    if self.departed(child) > base:
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
        self._plans[mask] = result
        return result

    def plan_color(self, mask: int, goal: int) -> str:
        before = self.full & ~mask
        after = self.full & ~goal
        for color, bits in self.color_mask.items():
            if (after & bits).bit_count() // self.group[color] > (before & bits).bit_count() // self.group[color]:
                return color
        raise ValueError("a plan makes one color depart")

    def exit_span(self, mask: int) -> tuple[int, int]:
        """(fewest, most) further safe exits before no safe exit remains, from a losing state."""
        cached = self._exit_span.get(mask)
        if cached is None:
            children = [mask & ~(1 << i) for i in self.safe_moves(mask)]
            if not children:
                cached = (0, 0)
            else:
                spans = [self.exit_span(child) for child in children]
                cached = (1 + min(s[0] for s in spans), 1 + max(s[1] for s in spans))
            self._exit_span[mask] = cached
        return cached

    def can_reach(self, start: int, goal: int) -> bool:
        if start == goal:
            return True
        return any(self.can_reach(start & ~(1 << i), goal) for i in self.safe_moves(start) if not goal >> i & 1)


def minimum_bays(sides, colors, group: int | None = None) -> int | None:
    """Smallest capacity with a complete run: 1 + min over runs of the max waiting count."""
    probe = GroupGame(sides, colors, len(sides) + 1, group)
    stuck = len(sides) + 1
    cache: dict[int, int] = {0: 0}

    def peak(mask: int) -> int:
        if mask in cache:
            return cache[mask]
        value = min((max(probe.waiting(mask & ~(1 << i)), peak(mask & ~(1 << i)))
                     for i in probe.geometric_moves(mask)), default=stuck)
        cache[mask] = value
        return value

    value = peak(probe.full)
    return None if value >= stuck else value + 1


class ExplicitPairGame:
    """Rule-lab `pairs` semantics on explicit states: (remaining ids, ordered waiting ids)."""

    def __init__(self, sides, colors, bays, group: int | None = None):
        self.sides = sides
        self.colors = list(colors)
        self.bays = bays
        self.size = {c: group or n for c, n in Counter(colors).items()}
        self.start = (tuple(range(len(sides))), ())

    def moves(self, state):
        remaining, waiting = state
        if len(waiting) >= self.bays:
            return []
        occupied = sum(1 << i for i in remaining)
        return [i for i in remaining if any(not s & occupied for s in self.sides[i])]

    def step(self, state, car):
        remaining, waiting = state
        waiting = [*waiting, car]
        for color in COLOR_NAMES:
            matching = [w for w in waiting if self.colors[w] == color]
            if matching and len(matching) == self.size[color]:
                waiting = [w for w in waiting if self.colors[w] != color]
        return tuple(i for i in remaining if i != car), tuple(waiting)

    def won(self, state):
        return not state[0] and not state[1]


@dataclass
class PairProblem:
    vehicles: tuple[Vehicle, ...]
    size: int
    openings: frozenset[str]
    colors: list[str]
    group: int | None = None

    @cached_property
    def sides(self):
        return side_blockers(self.vehicles, self.openings)

    def game(self, bays: int, geometry: bool = True) -> GroupGame:
        return GroupGame(self.sides if geometry else unblocked_sides(len(self.vehicles)), self.colors, bays,
                         self.group)

    def minimum_bays(self) -> int | None:
        return minimum_bays(self.sides, self.colors, self.group)

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

    def to_json(self) -> dict[str, object]:
        return {
            "size": self.size,
            "openings": sorted(self.openings),
            "group": self.group,
            "vehicles": [{"car": i, "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": c} for i, (v, c) in enumerate(zip(self.vehicles, self.colors))],
        }

    @classmethod
    def from_json(cls, spec: dict[str, object]) -> PairProblem:
        lookup = {(v.row, v.column, v.direction, v.length): v for v in positions(spec["size"])}
        vehicles = tuple(lookup[(c["row"], c["column"], c["orientation"], c["length"])] for c in spec["vehicles"])
        return cls(vehicles, spec["size"], frozenset(spec["openings"]), [c["color"] for c in spec["vehicles"]],
                   spec.get("group"))

    def frontend_board(self) -> dict[str, object]:
        return {
            "width": self.size, "height": self.size,
            "vehicles": [{"id": f"v{i}", "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": c} for i, (v, c) in enumerate(zip(self.vehicles, self.colors))],
            "fixedAreas": [],
            "roadOpenings": [{"side": FRONTEND_SIDE[s], "startOffset": 0, "length": self.size}
                             for s in sorted(self.openings)],
        }


def group_colors(rng: random.Random, n: int, group: int = 2) -> list[str]:
    """Colors in groups of `group` cars (the last group takes the remainder, at least 2)."""
    sizes = []
    left = n
    while left:
        take = group if left - group == 0 or left - group >= 2 else left
        sizes.append(take)
        left -= take
    colors = [COLOR_NAMES[j] for j, s in enumerate(sizes) for _ in range(s)]
    rng.shuffle(colors)
    return colors


def random_problem(rng: random.Random, n: int, opening: str, per_color: int = 2, size: int | None = None,
                   group: int | None = None) -> PairProblem:
    """`per_color` cars share each color; `group` waiting cars of a color depart together (default: all)."""
    size = size or rng.choice([s for cars, s in BOARD_SHAPES if cars == n])
    openings = OPENINGS_BY_NAME[opening]
    board = generate_board(rng, n, size, openings)
    return PairProblem(board, size, openings, group_colors(rng, n, per_color), group)


class PairReading:
    """Decisions of a reader who makes one color depart at a time with natural plans.

    Natural plans are, for each color, the plans that make it depart with the
    fewest exits. The path follows winning natural plans, or any winning plan
    where no natural plan wins. A decision state is a path state where some
    natural plan loses.
    """

    def __init__(self, game: GroupGame):
        self.game = game
        self._natural: dict[int, list[int]] = {}
        self._survival: dict[int, tuple[int, int]] = {}
        group = None if len(set(game.group.values())) > 1 else next(iter(game.group.values()))
        self.free_game = GroupGame(unblocked_sides(game.n), game.colors, game.bays, group)
        self.wider_game = GroupGame(game.sides, game.colors, game.bays + 1, group)

    def natural(self, mask: int) -> list[int]:
        cached = self._natural.get(mask)
        if cached is None:
            game = self.game
            plans = game.plans(mask)
            smallest: dict[str, int] = {}
            for goal in plans:
                color = game.plan_color(mask, goal)
                smallest[color] = min(smallest.get(color, game.n), (mask & ~goal).bit_count())
            cached = [g for g in plans if (mask & ~g).bit_count() == smallest[game.plan_color(mask, g)]]
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
            for child in winners or [g for g in game.plans(state) if game.wins(g)]:
                if child not in seen:
                    seen.add(child)
                    order.append(child)
        return order

    def survival(self, mask: int) -> tuple[int, int]:
        """(min, max) departed colors at which natural play from a lost state stops."""
        cached = self._survival.get(mask)
        if cached is None:
            children = self.natural(mask) if mask else []
            if not children:
                done = self.game.departed(mask)
                cached = (done, done)
            else:
                ends = [self.survival(child) for child in children]
                cached = (min(e[0] for e in ends), max(e[1] for e in ends))
            self._survival[mask] = cached
        return cached

    def kind(self, mask: int, winners: list[int], loser: int) -> str:
        """color: no winning natural plan departs the same color; route: one does, holding other cars."""
        if not winners:
            return "other"
        colors = {self.game.plan_color(mask, g) for g in winners}
        return "route" if self.game.plan_color(mask, loser) in colors else "color"

    def summary(self) -> dict[str, object]:
        game = self.game
        decisions = []
        path = self.path()
        for state in path:
            if state == 0:
                continue
            natural = self.natural(state)
            losing = [g for g in natural if not game.wins(g)]
            if not losing:
                continue
            winners = [g for g in natural if game.wins(g)]
            base = game.departed(state)
            free = bool(game.free_actions(state))
            options = []
            for g in losing:
                lo, hi = self.survival(g)
                exits_lo, exits_hi = game.exit_span(g)
                options.append({
                    "kind": self.kind(state, winners, g),
                    "held": (state & ~g).bit_count() - 1,
                    "distanceMin": lo - base, "distanceMax": hi - base,
                    "exitsMin": exits_lo, "exitsMax": exits_hi,
                    "blockingDecides": self.free_game.wins(g),
                    "widerWins": self.wider_game.wins(g),
                })
            decisions.append({
                "state": state,
                "departed": base,
                "waiting": game.waiting(state),
                "freeAction": free,
                "options": len(natural),
                "losing": len(losing),
                "winningNatural": len(winners),
                "losingOptions": options,
                "chain": max((state & ~g).bit_count() - 1 for g in natural),
            })
        essential = [d for d in decisions if not d["freeAction"]]
        losing_all = [o for d in decisions for o in d["losingOptions"]]
        losing_essential = [o for d in essential for o in d["losingOptions"]]
        return {
            "pathStates": sum(1 for s in path if s),
            "decisions": len(decisions),
            "essentialDecisions": len(essential),
            "distanceMax": max((o["distanceMax"] for o in losing_all), default=0),
            "essentialDistanceMax": max((o["distanceMax"] for o in losing_essential), default=0),
            "essentialExitsMax": max((o["exitsMax"] for o in losing_essential), default=0),
            "kinds": dict(Counter(o["kind"] for o in losing_all)),
            "essentialKinds": dict(Counter(o["kind"] for o in losing_essential)),
            "blockingDecides": sum(o["blockingDecides"] for o in losing_all),
            "widerWins": sum(o["widerWins"] for o in losing_all),
            "losingOptions": len(losing_all),
            "essentialLosingOptions": len(losing_essential),
            "chainMax": max((d["chain"] for d in decisions), default=0),
            "onlyUnnaturalWins": sum(d["winningNatural"] == 0 for d in decisions),
            "detail": decisions,
        }


def move_decisions(game: GroupGame) -> dict[str, object]:
    """Move-level view: every state on some winning exit order, every non-overflowing exit."""
    states = [game.full]
    seen = {game.full}
    for state in states:
        for i in game.safe_moves(state):
            child = state & ~(1 << i)
            if child and game.wins(child) and child not in seen:
                seen.add(child)
                states.append(child)
    decision_states = 0
    spans = Counter()
    losing_total = 0
    options_total = 0
    for state in states:
        moves = game.safe_moves(state)
        options_total += len(moves)
        losing = [state & ~(1 << i) for i in moves if not game.wins(state & ~(1 << i))]
        if losing:
            decision_states += 1
        for child in losing:
            losing_total += 1
            spans[game.exit_span(child)[1]] += 1
    return {"states": len(states), "decisionStates": decision_states, "safeMoves": options_total,
            "losingMoves": losing_total, "exitsMaxHistogram": dict(sorted(spans.items()))}


def color_dependencies(problem: PairProblem) -> dict[str, object]:
    """Color X needs color Y when every open ray of some X car holds a Y car."""
    edges: set[tuple[str, str]] = set()
    sides = problem.sides
    for i, rays in enumerate(sides):
        for color in set(problem.colors):
            if color == problem.colors[i]:
                continue
            bits = sum(1 << j for j, c in enumerate(problem.colors) if c == color)
            if rays and all(ray & bits for ray in rays):
                edges.add((problem.colors[i], color))
    colors = sorted(set(problem.colors))
    reach = {c: {b for a, b in edges if a == c} for c in colors}
    changed = True
    while changed:
        changed = False
        for c in colors:
            extra = set().union(*(reach[d] for d in reach[c])) - reach[c] if reach[c] else set()
            if extra:
                reach[c] |= extra
                changed = True
    cyclic = sum(c in reach[c] for c in colors)
    def longest(c: str, stack: frozenset[str]) -> int:
        nexts = [b for a, b in edges if a == c and b not in stack]
        return max((1 + longest(b, stack | {b}) for b in nexts), default=0)

    chain = max((longest(c, frozenset({c})) for c in colors), default=0)
    return {"edges": len(edges), "cyclicColors": cyclic, "longestChain": chain}
