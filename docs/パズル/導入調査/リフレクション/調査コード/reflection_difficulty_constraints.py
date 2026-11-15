from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from reflection_supply_experiment import (
    COL_STEP,
    EMPTY,
    ROW_STEP,
    TRANSITIONS,
    Domain,
    Domains,
    Signature,
    entry_state,
    exit_position,
)


@dataclass(frozen=True)
class ClueSpec:
    side: int
    index: int
    outcome: str
    distance: int


def clue_specs(size: int, signature: Signature) -> tuple[ClueSpec, ...]:
    return tuple(
        ClueSpec(side, index, *signature[side * size + index])
        for side in range(4)
        for index in range(size)
    )


def initial_domains(size: int, inventory: tuple[int, ...]) -> Domains:
    allowed = frozenset({EMPTY, *inventory})
    return tuple(allowed for _ in range(size * size))


def inventory_counts(size: int, inventory: tuple[int, ...]) -> Counter[int]:
    counts = Counter(inventory)
    counts[EMPTY] = size * size - len(inventory)
    return counts


def inventory_feasible(domains: Domains, required: Counter[int]) -> bool:
    fixed = Counter()
    possible = Counter()
    for domain in domains:
        if not domain:
            return False
        if len(domain) == 1:
            fixed[next(iter(domain))] += 1
        for piece in domain:
            possible[piece] += 1
    return all(fixed[piece] <= count <= possible[piece] for piece, count in required.items())


def terminal_matches(
    size: int, clue: ClueSpec, row: int, col: int, outgoing: int, depth: int
) -> bool:
    if outgoing < 0:
        return clue.outcome == "a" and depth == clue.distance
    next_row = row + ROW_STEP[outgoing]
    next_col = col + COL_STEP[outgoing]
    exit_at = exit_position(size, next_row, next_col)
    if exit_at is None or depth != clue.distance or clue.outcome == "a":
        return False
    actual = "r" if exit_at == (clue.side, clue.index) else "s"
    return actual == clue.outcome


def internal_next_state(
    size: int,
    row: int,
    col: int,
    outgoing: int,
    depth: int,
    target_distance: int,
) -> tuple[int, int, int] | None:
    if outgoing < 0 or depth >= target_distance:
        return None
    next_row = row + ROW_STEP[outgoing]
    next_col = col + COL_STEP[outgoing]
    if exit_position(size, next_row, next_col) is not None:
        return None
    return next_row, next_col, outgoing


def clue_supported_domains(
    size: int, domains: Domains, clue: ClueSpec
) -> tuple[bool, dict[int, Domain]]:
    start_row, start_col, start_direction = entry_state(size, clue.side, clue.index)
    start_state = (start_row, start_col, start_direction)
    layers: list[set[tuple[int, int, int]]] = [set() for _ in range(clue.distance + 1)]
    layers[1].add(start_state)
    transitions: dict[
        tuple[int, tuple[int, int, int]],
        list[tuple[int, tuple[int, int, int] | None, bool]],
    ] = {}

    for depth in range(1, clue.distance + 1):
        for state in layers[depth]:
            row, col, incoming = state
            cell = row * size + col
            options = []
            for piece in domains[cell]:
                outgoing = TRANSITIONS[piece][incoming]
                terminal = terminal_matches(size, clue, row, col, outgoing, depth)
                next_state = internal_next_state(
                    size, row, col, outgoing, depth, clue.distance
                )
                if terminal:
                    options.append((piece, None, True))
                elif next_state is not None:
                    options.append((piece, next_state, False))
                    layers[depth + 1].add(next_state)
            transitions[(depth, state)] = options

    viable: list[set[tuple[int, int, int]]] = [set() for _ in range(clue.distance + 1)]
    viable_transitions: dict[
        tuple[int, tuple[int, int, int]],
        list[tuple[int, tuple[int, int, int] | None, bool]],
    ] = {}
    for depth in range(clue.distance, 0, -1):
        for state in layers[depth]:
            options = [
                option
                for option in transitions[(depth, state)]
                if option[2] or (option[1] is not None and option[1] in viable[depth + 1])
            ]
            if options:
                viable[depth].add(state)
                viable_transitions[(depth, state)] = options
    if start_state not in viable[1]:
        return False, {}

    prefix_must: list[dict[tuple[int, int, int], set[int]]] = [
        {} for _ in range(clue.distance + 1)
    ]
    prefix_must[1][start_state] = {start_row * size + start_col}
    complete_must: set[int] | None = None
    supported: dict[int, set[int]] = {}
    for depth in range(1, clue.distance + 1):
        for state, must_cells in prefix_must[depth].items():
            row, col, _incoming = state
            cell = row * size + col
            for piece, next_state, terminal in viable_transitions[(depth, state)]:
                supported.setdefault(cell, set()).add(piece)
                if terminal:
                    complete_must = (
                        set(must_cells)
                        if complete_must is None
                        else complete_must & must_cells
                    )
                    continue
                if next_state is None:
                    continue
                next_row, next_col, _ = next_state
                next_must = set(must_cells)
                next_must.add(next_row * size + next_col)
                existing = prefix_must[depth + 1].get(next_state)
                if existing is None:
                    prefix_must[depth + 1][next_state] = next_must
                else:
                    existing.intersection_update(next_must)
    if complete_must is None:
        return False, {}

    result = {}
    for cell in complete_must:
        pieces = domains[cell] & frozenset(supported.get(cell, ()))
        if not pieces:
            return False, {}
        if pieces != domains[cell]:
            result[cell] = pieces
    return True, result


def clue_is_feasible_with_forced_candidate(
    size: int,
    domains: Domains,
    clue: ClueSpec,
    cell_to_force: int,
    piece_to_force: int,
) -> bool:
    start_row, start_col, start_direction = entry_state(size, clue.side, clue.index)
    states = {(start_row, start_col, start_direction)}
    for depth in range(1, clue.distance + 1):
        next_states: set[tuple[int, int, int]] = set()
        terminal_found = False
        for row, col, incoming in states:
            cell = row * size + col
            domain = domains[cell]
            if cell == cell_to_force:
                domain &= frozenset({piece_to_force})
            for piece in domain:
                outgoing = TRANSITIONS[piece][incoming]
                if terminal_matches(size, clue, row, col, outgoing, depth):
                    terminal_found = True
                    continue
                next_state = internal_next_state(
                    size, row, col, outgoing, depth, clue.distance
                )
                if next_state is not None:
                    next_states.add(next_state)
        if depth == clue.distance:
            return terminal_found
        if not next_states:
            return False
        states = next_states
    return False


def apply_candidate_consistency(
    size: int, domains: Domains, clues: tuple[ClueSpec, ...]
) -> tuple[bool, Domains]:
    updated = []
    for cell, domain in enumerate(domains):
        supported = frozenset(
            piece
            for piece in domain
            if all(
                clue_is_feasible_with_forced_candidate(size, domains, clue, cell, piece)
                for clue in clues
            )
        )
        if not supported:
            return False, domains
        updated.append(supported)
    return True, tuple(updated)


def independent_clue_supports(
    size: int, domains: Domains, clues: tuple[ClueSpec, ...]
) -> tuple[bool, list[dict[int, Domain]]]:
    all_supports = []
    for clue in clues:
        feasible, supports = clue_supported_domains(size, domains, clue)
        if not feasible:
            return False, []
        all_supports.append(supports)
    return True, all_supports


def apply_inventory(domains: Domains, required: Counter[int]) -> tuple[bool, Domains]:
    if not inventory_feasible(domains, required):
        return False, domains
    updated = list(domains)
    changed = True
    while changed:
        changed = False
        fixed = Counter(next(iter(domain)) for domain in updated if len(domain) == 1)
        possible = {
            piece: [index for index, domain in enumerate(updated) if piece in domain]
            for piece in required
        }
        for piece, count in required.items():
            if fixed[piece] > count or len(possible[piece]) < count:
                return False, domains
            if fixed[piece] == count:
                for index, domain in enumerate(updated):
                    if len(domain) <= 1 or piece not in domain:
                        continue
                    narrowed = domain - {piece}
                    if not narrowed:
                        return False, domains
                    if narrowed != domain:
                        updated[index] = frozenset(narrowed)
                        changed = True
            elif len(possible[piece]) == count:
                for index in possible[piece]:
                    singleton = frozenset({piece})
                    if updated[index] != singleton:
                        updated[index] = singleton
                        changed = True
    result = tuple(updated)
    return inventory_feasible(result, required), result


def propagate_without_assumption(
    size: int,
    start_domains: Domains,
    clues: tuple[ClueSpec, ...],
    required: Counter[int],
) -> tuple[bool, Domains, int]:
    domains = start_domains
    rounds = 0
    while True:
        before = domains
        feasible, domains = apply_candidate_consistency(size, domains, clues)
        if not feasible:
            return False, domains, rounds
        feasible, domains = apply_inventory(domains, required)
        if not feasible:
            return False, domains, rounds
        if domains == before:
            return True, domains, rounds
        rounds += 1
