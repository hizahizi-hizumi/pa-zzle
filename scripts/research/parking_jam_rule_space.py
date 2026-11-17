"""Compare research-only exit-and-wait rule variants on reproducible random boards.

This is a deliberately independent model of the existing departure geometry. Its
sample pool uses exits on all four sides, no fixed obstacles and no official
problem-pool difficulty selection. It does not establish human difficulty.
"""

from __future__ import annotations

from collections import Counter
from functools import lru_cache
import json
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Vehicle:
    row: int
    column: int
    direction: str
    length: int
    occupancy: int
    paths: tuple[int, int]


def positions(board_size: int) -> list[Vehicle]:
    options: list[Vehicle] = []

    def mask(cells: list[tuple[int, int]]) -> int:
        return sum(1 << (r * board_size + c) for r, c in cells)

    for direction in ("horizontal", "vertical"):
        for length in (2, 3):
            for row in range(board_size - (length if direction == "vertical" else 1) + 1):
                for column in range(board_size - (length if direction == "horizontal" else 1) + 1):
                    if direction == "horizontal":
                        occupied = [(row, column + j) for j in range(length)]
                        left = [(row, c) for c in range(column)]
                        right = [(row, c) for c in range(column + length, board_size)]
                    else:
                        occupied = [(row + j, column) for j in range(length)]
                        left = [(r, column) for r in range(row)]
                        right = [(r, column) for r in range(row + length, board_size)]
                    options.append(Vehicle(row, column, direction, length, mask(occupied), (mask(left), mask(right))))
    return options


def legal(vehicles: tuple[Vehicle, ...], remaining: int) -> list[int]:
    occupied = 0
    for index, vehicle in enumerate(vehicles):
        if remaining & (1 << index):
            occupied |= vehicle.occupancy
    return [
        index
        for index, vehicle in enumerate(vehicles)
        if remaining & (1 << index) and any(not (occupied & ray) for ray in vehicle.paths)
    ]


def make_board(rng: random.Random, candidates: list[Vehicle], count: int) -> tuple[Vehicle, ...] | None:
    vehicles: tuple[Vehicle, ...] = ()
    occupied = 0
    for index in range(count):
        options = [vehicle for vehicle in candidates if not (vehicle.occupancy & occupied) and any(not (ray & occupied) for ray in vehicle.paths)]
        if not options:
            return None
        before = set(legal(vehicles, (1 << index) - 1))
        if before and rng.random() < 0.8:
            blocking = [
                vehicle for vehicle in options
                if before - set(legal((*vehicles, vehicle), (1 << (index + 1)) - 1))
            ]
            if blocking:
                options = blocking
        chosen = rng.choice(options)
        vehicles = (*vehicles, chosen)
        occupied |= chosen.occupancy
    return vehicles


def sequence(rng: random.Random, vehicles: tuple[Vehicle, ...]) -> list[int]:
    remaining = (1 << len(vehicles)) - 1
    result = []
    while remaining:
        selected = rng.choice(legal(vehicles, remaining))
        result.append(selected)
        remaining &= ~(1 << selected)
    return result


def make_queue(rng: random.Random, vehicles: tuple[Vehicle, ...], colors: list[str]) -> list[str]:
    batches = [[colors[index]] * vehicles[index].length for index in sequence(rng, vehicles)]
    queue: list[str] = []
    while batches:
        selection = rng.randrange(min(3, len(batches))) if rng.random() < 0.35 else 0
        queue.append(batches[selection].pop())
        if not batches[selection]:
            batches.pop(selection)
    return queue


def make_dispatch_queue(rng: random.Random, vehicles: tuple[Vehicle, ...], colors: list[str]) -> list[str]:
    order = sequence(rng, vehicles)
    result: list[str] = []
    while order:
        selection = rng.randrange(min(3, len(order))) if rng.random() < 0.35 else 0
        result.append(colors[order.pop(selection)])
    return result


def analyze(
    vehicles: tuple[Vehicle, ...],
    colors: list[str],
    mode: str,
    bays: int,
    queue: list[str] | None = None,
    ignore_blocking: bool = False,
    include_decision_depth: bool = False,
) -> dict[str, object]:
    if queue is None:
        queue = []
    full = (1 << len(vehicles)) - 1
    seen: set[tuple[int, tuple[tuple[int, int], ...], int]] = set()

    def settle(waiting: tuple[tuple[int, int], ...], head: int) -> tuple[tuple[tuple[int, int], ...], int]:
        slots = list(waiting)
        if mode == "pair":
            counts = Counter(colors[index] for index, _ in slots)
            return tuple((index, boarded) for index, boarded in slots if counts[colors[index]] != 2), head
        while head < len(queue):
            target = next((slot for slot, (index, _) in enumerate(slots) if colors[index] == queue[head]), None)
            if target is None:
                break
            index, boarded = slots[target]
            boarded += 1
            head += 1
            if boarded == (1 if mode == "dispatch" else vehicles[index].length):
                slots.pop(target)
            else:
                slots[target] = (index, boarded)
        return tuple(slots), head

    def after_departure(mask: int, waiting: tuple[tuple[int, int], ...], head: int, index: int):
        next_waiting, next_head = settle((*waiting, (index, 0)), head)
        return mask & ~(1 << index), next_waiting, next_head

    @lru_cache(None)
    def ways(mask: int, waiting: tuple[tuple[int, int], ...], head: int) -> int:
        seen.add((mask, waiting, head))
        if mask == 0 and not waiting and head == len(queue):
            return 1
        if len(waiting) >= bays:
            return 0
        return sum(
            ways(*after_departure(mask, waiting, head, index))
            for index in available(mask)
        )

    def available(mask: int) -> list[int]:
        return [i for i in range(len(vehicles)) if mask & (1 << i)] if ignore_blocking else legal(vehicles, mask)

    options = available(full)
    winners = [
        ways(*after_departure(full, (), 0, index)) > 0
        for index in options
    ]
    total_solutions = ways(full, (), 0)
    decisions = None
    if include_decision_depth:
        winnable_states = 0
        losing_choice_depths = []
        for mask, waiting, head in seen:
            if ways(mask, waiting, head) == 0:
                continue
            winnable_states += 1
            if len(waiting) >= bays:
                continue
            available_exits = available(mask)
            if len(available_exits) < 2:
                continue
            if any(ways(*after_departure(mask, waiting, head, index)) == 0 for index in available_exits):
                losing_choice_depths.append(len(vehicles) - mask.bit_count())
        decisions = {
            "winnableStates": winnable_states,
            "statesWithLosingChoice": len(losing_choice_depths),
            "firstLosingDecisionDepth": min(losing_choice_depths) if losing_choice_depths else None,
        }
    return {
        "solutions": total_solutions,
        "initialLegal": len(options),
        "winningInitial": winners.count(True),
        "losingInitial": winners.count(False),
        "exploredStates": len(seen),
        "initialOutcome": {index: won for index, won in zip(options, winners)},
        "decisionDepth": decisions,
    }


def run_sample(seed: int = 727, per_size: int = 120) -> list[dict[str, object]]:
    rng = random.Random(seed)
    output: list[dict[str, object]] = []
    for n, board_size, bays in [(8, 7, 2), (12, 8, 3)]:
        pool = positions(board_size)
        candidate = 0
        generated = 0
        analyzed = 0
        pair_solves = 0
        pair_traps = 0
        passenger_solves = 0
        passenger_traps = 0
        dispatch_stats = {b: {"solvable": 0, "hasLosingInitial": 0, "geometryDependent": 0} for b in (2, 3, 4)}
        pair_states = 0
        passenger_states = 0
        sensitivity = {f"{m}{b}": {"solvable": 0, "hasLosingInitial": 0} for m, bs in (("pair", (2, 3)), ("passenger", (2, 3, 4))) for b in bs}
        pair_geometry_traps = 0
        passenger_geometry_traps = 0
        decision_summary = {
            label: {"everLosingChoice": 0, "rootLosingChoice": 0, "earliestLosingChoice": {}, "winnableStates": 0, "choiceStates": 0}
            for label in ("pair2", "pair3", "passenger3")
        }
        while analyzed < per_size:
            candidate += 1
            board = make_board(rng, pool, n)
            if board is None:
                continue
            generated += 1
            colors = [chr(ord("A") + i) for i in range(n // 2) for _ in range(2)]
            rng.shuffle(colors)
            result_pair = analyze(board, colors, "pair", bays)
            dispatch_queue = make_dispatch_queue(random.Random(seed * 100000 + n * 1000 + analyzed), board, colors)
            queue = make_queue(rng, board, colors)
            result_passenger = analyze(board, colors, "queue", 3, queue)
            if result_pair["losingInitial"]:
                pair_without_blockers = analyze(board, colors, "pair", bays, ignore_blocking=True)
                pair_geometry_traps += any(
                    not win and pair_without_blockers["initialOutcome"][i]
                    for i, win in result_pair["initialOutcome"].items()
                )
            if result_passenger["losingInitial"]:
                passenger_without_blockers = analyze(board, colors, "queue", 3, queue, ignore_blocking=True)
                passenger_geometry_traps += any(
                    not win and passenger_without_blockers["initialOutcome"][i]
                    for i, win in result_passenger["initialOutcome"].items()
                )
            for available_bays in (2, 3, 4):
                dispatched = analyze(board, colors, "dispatch", available_bays, dispatch_queue)
                dispatch_stats[available_bays]["solvable"] += bool(dispatched["solutions"])
                dispatch_stats[available_bays]["hasLosingInitial"] += bool(dispatched["solutions"] and dispatched["losingInitial"])
                if dispatched["solutions"] and dispatched["losingInitial"]:
                    unrestricted = analyze(board, colors, "dispatch", available_bays, dispatch_queue, ignore_blocking=True)
                    dispatch_stats[available_bays]["geometryDependent"] += any(
                        not won and unrestricted["initialOutcome"][i]
                        for i, won in dispatched["initialOutcome"].items()
                    )
            for label, mode, available_bays in [
                ("pair2", "pair", 2), ("pair3", "pair", 3),
                ("passenger2", "queue", 2), ("passenger3", "queue", 3),
                ("passenger4", "queue", 4),
            ]:
                r = analyze(
                    board, colors, mode, available_bays,
                    queue if mode == "queue" else None,
                    include_decision_depth=label in decision_summary,
                )
                sensitivity[label]["solvable"] += bool(r["solutions"])
                sensitivity[label]["hasLosingInitial"] += bool(r["solutions"] and r["losingInitial"])
                if label in decision_summary and r["solutions"]:
                    depth = r["decisionDepth"]
                    summary = decision_summary[label]
                    summary["everLosingChoice"] += depth["statesWithLosingChoice"] > 0
                    summary["rootLosingChoice"] += depth["firstLosingDecisionDepth"] == 0
                    first = depth["firstLosingDecisionDepth"]
                    if first is not None:
                        key = str(first)
                        summary["earliestLosingChoice"][key] = summary["earliestLosingChoice"].get(key, 0) + 1
                    summary["winnableStates"] += depth["winnableStates"]
                    summary["choiceStates"] += depth["statesWithLosingChoice"]
            pair_solves += bool(result_pair["solutions"])
            pair_traps += bool(result_pair["solutions"] and result_pair["losingInitial"])
            passenger_solves += bool(result_passenger["solutions"])
            passenger_traps += bool(result_passenger["solutions"] and result_passenger["losingInitial"])
            pair_states += int(result_pair["exploredStates"])
            passenger_states += int(result_passenger["exploredStates"])
            analyzed += 1
        output.append({
            "vehicles": n,
            "board": f"{board_size}×{board_size}",
            "samples": analyzed,
            "candidateAttempts": candidate,
            "pairSolvable": pair_solves,
            "pairWithLosingInitial": pair_traps,
            "pairGeometryDependentLosingInitial": pair_geometry_traps,
            "passengerSolvable": passenger_solves,
            "passengerWithLosingInitial": passenger_traps,
            "passengerGeometryDependentLosingInitial": passenger_geometry_traps,
            "baySensitivity": sensitivity,
            "decisionDepthSummary": decision_summary,
            "dispatchSensitivity": dispatch_stats,
            "meanPairStates": round(pair_states / analyzed, 1),
            "meanPassengerStates": round(passenger_states / analyzed, 1),
            "seed": seed,
            "queueConstruction": "Legal full exit order, with randomized interleaving of up to three passenger color blocks",
        })
    return output


if __name__ == "__main__":
    result = run_sample()
    print(json.dumps(result, ensure_ascii=False, indent=2))
