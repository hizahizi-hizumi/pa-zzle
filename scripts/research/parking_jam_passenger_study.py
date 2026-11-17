"""Research-only measurements for the passenger-queue rule (#739).

`survey` draws undirected random problems over the condition grid and records, per
bay count, the reader's decisions split by whether removing all blocking rescues the
losing option. `supply` runs the generators under a CPU budget per worker. `digest`
turns record files into the summary that the study document cites.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from collections import Counter, defaultdict
from multiprocessing import Pool

from parking_jam_dispatch_reading import OPENINGS_BY_NAME, open_rays
from parking_jam_passenger_reading import (
    PassengerProblem,
    PassengerReading,
    assign_colors,
    canonical,
    generate_board,
    order_queue,
    path_profile,
    plan_order,
    shuffled_queue,
    structural_canonical,
)
from parking_jam_rule_space import positions

SIZES = {8: (6, 7), 10: (7,), 12: (7, 8)}
COLOR_SCHEMES = ("3", "4", "pairs")
LONG_SHARES = (0.0, 0.5, 1.0)
QUEUE_METHODS = ("order", "random")
BAYS = (2, 3, 4)
# Named populations. `random` draws every condition; the others hold some fixed. Capacities
# mixed (`longShare` 0.5) with a shuffled queue on two adjacent sides or one side is the
# population most favorable to blocking-decided capacity choices; `all4` and `orderAll4` are controls.
POPULATIONS: dict[str, dict[str, object]] = {
    "random": {},
    "favorableAdjacent2": {"longShare": 0.5, "queueMethod": "random", "opening": "adjacent2"},
    "favorableOne": {"longShare": 0.5, "queueMethod": "random", "opening": "one"},
    "favorableAll4": {"longShare": 0.5, "queueMethod": "random", "opening": "all4"},
    "orderAll4": {"longShare": 0.5, "queueMethod": "order", "opening": "all4"},
}
FAVORABLE = {"longShare": 0.5, "queueMethod": "random", "opening": ["adjacent2", "one"]}


def draw_conditions(rng: random.Random, fixed: dict[str, object] | None = None) -> dict[str, object]:
    cars = rng.choice(sorted(SIZES))
    conditions = {
        "cars": cars,
        "size": rng.choice(SIZES[cars]),
        "opening": rng.choice(sorted(OPENINGS_BY_NAME)),
        "colors": rng.choice(COLOR_SCHEMES),
        "longShare": rng.choice(LONG_SHARES),
        "queueMethod": rng.choice(QUEUE_METHODS),
    }
    for key, value in (fixed or {}).items():
        conditions[key] = rng.choice(value) if isinstance(value, list) else value
    if conditions["size"] not in SIZES[conditions["cars"]]:
        conditions["size"] = rng.choice(SIZES[conditions["cars"]])
    return conditions


def build(rng: random.Random, conditions: dict[str, object]) -> PassengerProblem:
    openings = OPENINGS_BY_NAME[conditions["opening"]]
    board = generate_board(rng, conditions["cars"], conditions["size"], openings, conditions["longShare"])
    colors = assign_colors(rng, conditions["cars"], conditions["colors"])
    problem = PassengerProblem(board, conditions["size"], openings, colors, [])
    problem.queue = (order_queue(rng, problem.sides, colors, problem.lengths) if conditions["queueMethod"] == "order"
                     else shuffled_queue(rng, colors, problem.lengths))
    return problem


def color_runs(passengers: list[str]) -> int:
    return sum(1 for i, c in enumerate(passengers) if i == 0 or passengers[i - 1] != c)


def features(problem: PassengerProblem, bays: int, k_min: int, detail: bool = False) -> dict[str, object]:
    """Reader features at `bays`, plus the same reader on the blocking-free problem."""
    game = problem.game(bays)
    reading = PassengerReading(game)
    summary = reading.summary()
    profile = path_profile(reading)
    free_summary = PassengerReading(problem.game(bays, geometry=False)).summary()
    decisions = summary.pop("detail")
    free_summary.pop("detail")
    row = {
        **summary,
        **profile,
        "bays": bays,
        "slack": bays - k_min,
        "solutions": game.solution_count(),
        "headFirst": game.win_probability("head-first"),
        "freeDecisions": free_summary["decisions"],
        "reach": [[x["visible"], d["remaining"], x["distanceMax"], int(x["blockingEssential"]), x["kind"],
                   color_runs(problem.queue[d["served"]:d["served"] + x["visible"]]), int(x["sameLength"]), x["type"]]
                  for d in decisions for x in d["losing"]],
    }
    if detail:
        row["detail"] = decisions
    return row


def survey_one(args: tuple) -> dict[str, object]:
    """One survey problem; `(seed, index)` or `(seed, index, population)`."""
    seed, index, population = (*args, "random")[:3]
    rng = random.Random(seed * 1_000_003 + index)
    conditions = draw_conditions(rng, POPULATIONS[population])
    begun = time.process_time()
    problem = build(rng, conditions)
    k_min = problem.minimum_bays()
    k_free = problem.minimum_bays(geometry=False)
    rows = []
    if k_min is not None:
        for bays in BAYS:
            if bays >= k_min:
                rows.append(features(problem, bays, k_min))
    lengths = Counter(problem.lengths)
    return {"index": index, "population": population, **conditions, "queueLength": len(problem.queue), "long": lengths[3],
            "kMin": k_min, "kMinFree": k_free, "rows": rows, "seconds": time.process_time() - begun,
            "problem": problem.to_json()}


def run_survey(seed: int, count: int, workers: int, populations: list[str]) -> dict[str, object]:
    with Pool(workers) as pool:
        records = pool.map(survey_one, [(seed, i, name) for name in populations for i in range(count)], chunksize=4)
    return {"seed": seed, "count": count, "populations": populations, "records": records}


# Tentative levels, only for problems whose every decision is blocking-essential, at
# slack 0 with 2-4 bays. Car count is deliberately not a criterion. Reasons A/B are not
# used: B accompanies almost every losing option because the queue alone sets the bays.
def tentative_level(row: dict[str, object] | None, decisions_key: str = "decisions") -> int | None:
    if row is None or not min(BAYS) <= row["bays"] <= max(BAYS) or row["slack"] != 0:
        return None
    if row["queueDecisions"] or row["mixedDecisions"]:
        return None
    decisions, distance = row[decisions_key], row["distanceMax"]
    if decisions == 0:
        return 1
    if decisions == 1:
        return 2 if distance <= 5 else 3
    if decisions == 2:
        return 3
    if decisions <= 4:
        return 4
    return 5 if distance >= 6 else 4


# Tentative levels for the favorable population, read on one run of the reader's winning path
# (fewest decisions any run must face), with capacity-and-blocking decisions as the step up.
# Car count is not a criterion; problems with queue-only or mixed decisions are out of scope.
def run_level(profile: dict[str, object], prefix: str = "") -> int | None:
    if profile.get(f"{prefix}outOfScope", profile.get("outOfScope")):
        return None
    decisions = profile[f"{prefix}decisionsOnRunMin"]
    capacity = profile[f"{prefix}capacityAndBlockingOnRunMin"]
    if capacity >= 2 or (capacity == 1 and decisions >= 3):
        return 5
    if capacity == 1:
        return 4
    if decisions >= 2:
        return 3
    return 2 if decisions == 1 else 1


def run_level_study(profiles: list[dict[str, object]]) -> dict[str, object]:
    by_cars = defaultdict(Counter)
    by_population = defaultdict(Counter)
    moved = Counter()
    total = Counter()
    for p in profiles:
        level = run_level(p)
        by_cars[str(p["cars"])][str(level)] += 1
        by_population[p["population"]][str(level)] += 1
        if level is None:
            continue
        total[level] += 1
        variant = {**p, "variant:outOfScope": p["variantOutOfScope"]}
        moved[f"{level}:keepBuriedTwin"] += run_level(variant, "variant:") != level
        on_max = {**p, "decisionsOnRunMin": p["decisionsOnRunMax"],
                  "capacityAndBlockingOnRunMin": p["capacityAndBlockingOnRunMax"]}
        moved[f"{level}:mostOnRun"] += run_level(on_max) != level
    return {
        "levelByCars": {c: dict(sorted(v.items())) for c, v in sorted(by_cars.items())},
        "levelByPopulation": {c: dict(sorted(v.items())) for c, v in sorted(by_population.items())},
        "levelCounts": dict(sorted((str(k), v) for k, v in total.items())),
        "variantMoved": {k: share(v, total[int(k.split(":")[0])]) for k, v in sorted(moved.items())},
        "headFirstPerfectByLevel": {str(lv): share(sum(p["headFirstPerfect"] for p in profiles if run_level(p) == lv),
                                                   total[lv]) for lv in sorted(total)},
    }


# Targets for supply. `essential`: some decision whose every losing natural option is
# rescued by removing all blocking. `essentialOnly`: decisions exist and all are such,
# and the head-first naive policy does not always win.
def meets(row: dict[str, object], target: str) -> bool:
    if target == "essential":
        return row["essentialDecisions"] >= 1
    if target.startswith("lv"):
        return tentative_level(row) == int(target[2:])
    if target == "essentialOnly":
        return (row["decisions"] >= 1 and row["essentialDecisions"] == row["decisions"]
                and row["headFirst"] < 1 - 1e-9)
    if target.startswith("run"):
        return run_level({**row, "outOfScope": bool(row["queueDecisions"] or row["mixedDecisions"])}) == int(target[3:])
    if target == "essentialOnlyCB":
        return meets(row, "essentialOnly") and row["types"].get("capacityAndBlocking", 0) >= 1
    raise ValueError(target)


def judge(problem: PassengerProblem, target: str) -> tuple[bool, float, dict[str, object] | None]:
    """At slack 0 within 2-4 bays: (accepted, score to climb, features)."""
    k_min = problem.minimum_bays()
    if k_min is None or k_min > max(BAYS):
        return False, -10.0, None
    bays = max(k_min, min(BAYS))
    row = features(problem, bays, k_min)
    score = (2.0 * row["essentialDecisions"] - row["queueDecisions"] - row["mixedDecisions"] - 0.5 * (k_min < min(BAYS))
             + (row["types"].get("capacityAndBlocking", 0) if target == "essentialOnlyCB" else 0))
    return meets(row, target), score, row


def mutate(rng: random.Random, problem: PassengerProblem, pool) -> PassengerProblem | None:
    """Swap two passengers, swap colors of two equal-length cars, or move a car keeping its length."""
    queue, colors, vehicles = list(problem.queue), list(problem.colors), list(problem.vehicles)
    roll = rng.random()
    if roll < 0.45:
        i, j = rng.sample(range(len(queue)), 2)
        queue[i], queue[j] = queue[j], queue[i]
    elif roll < 0.75:
        i, j = rng.sample(range(len(colors)), 2)
        if vehicles[i].length != vehicles[j].length:
            return None
        colors[i], colors[j] = colors[j], colors[i]
    else:
        i = rng.randrange(len(vehicles))
        occupied = 0
        for k, v in enumerate(vehicles):
            if k != i:
                occupied |= v.occupancy
        options = [v for v in pool if v.length == vehicles[i].length and not v.occupancy & occupied
                   and open_rays(v, problem.openings) and v != vehicles[i]]
        if not options:
            return None
        vehicles[i] = rng.choice(options)
    if queue == problem.queue and colors == problem.colors and vehicles == list(problem.vehicles):
        return None
    return PassengerProblem(tuple(vehicles), problem.size, problem.openings, colors, queue)


def generate(rng: random.Random, generator: str, target: str, conditions: dict[str, object],
             deadline: float, budget: int = 80) -> dict[str, object]:
    begun = time.process_time()
    if generator in ("G1", "Grand"):
        conditions = {**conditions, "queueMethod": "order" if generator == "G1" else "random"}
        problem = build(rng, conditions)
        accepted, _, row = judge(problem, target)
        evaluations = 1
    elif generator == "G3":
        conditions = {**conditions, "queueMethod": "random"}
        problem = build(rng, conditions)
        accepted, score, row = judge(problem, target)
        pool = positions(problem.size)
        evaluations = tries = 0
        while not accepted and evaluations < budget and tries < 4 * budget and time.process_time() < deadline:
            tries += 1
            candidate = mutate(rng, problem, pool)
            if candidate is None:
                continue
            ok, candidate_score, candidate_row = judge(candidate, target)
            evaluations += 1
            if candidate_score >= score:
                problem, score, row, accepted = candidate, candidate_score, candidate_row, ok
    else:
        raise ValueError(generator)
    return {"generator": generator, "target": target, **conditions, "accepted": accepted,
            "seconds": time.process_time() - begun, "evaluations": evaluations,
            "features": row, "problem": problem.to_json() if accepted else None}


def supply_worker(args: tuple[int, int, str, str, float, dict]) -> list[dict[str, object]]:
    seed, worker, generator, target, seconds, fixed = args
    rng = random.Random(f"{seed}:{worker}:{generator}:{target}")
    deadline = time.process_time() + seconds
    attempts = []
    while time.process_time() < deadline:
        attempts.append(generate(rng, generator, target, draw_conditions(rng, fixed), deadline))
    return attempts


def run_supply(seed: int, generators: list[str], targets: list[str], seconds: float, workers: int,
               fixed: dict[str, object]) -> dict[str, object]:
    jobs = [(seed, w, g, t, seconds, fixed) for g in generators for t in targets for w in range(workers)]
    with Pool(workers) as pool:
        results = pool.map(supply_worker, jobs, chunksize=1)
    attempts = [a for chunk in results for a in chunk]
    return {"seed": seed, "seconds": seconds, "workers": workers, "fixed": fixed, "attempts": attempts}


def share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


TABLE_COLUMNS = ("rows", "withDecision", "withEssential", "essentialOnlyProblems", "outOfScopeProblems",
                 "decisionStates", "essentialShareOfDecisionStates", "queueShareOfDecisionStates",
                 "twinSameLengthShareOfTwinOptions", "freeDecisionsPerProblem", "headFirstPerfect")


def survey_digest(data: list[dict[str, object]]) -> dict[str, object]:
    """Decision origin by condition, at slack 0 (bays = k_min) and per bay count."""
    rows = []
    for survey in data:
        for record in survey["records"]:
            for row in record["rows"]:
                rows.append({**{k: record[k] for k in ("cars", "opening", "colors", "longShare", "queueMethod",
                                                         "queueLength", "kMin", "kMinFree")}, **row})
    records = [r for s in data for r in s["records"]]

    def block(selected: list[dict[str, object]]) -> dict[str, object]:
        decisions = sum(r["decisions"] for r in selected)
        losing = sum(r["losingOptions"] for r in selected)
        kinds = Counter()
        for r in selected:
            kinds.update(r["kinds"])
        return {
            "rows": len(selected),
            "withDecision": share(sum(r["decisions"] > 0 for r in selected), len(selected)),
            "withEssential": share(sum(r["essentialDecisions"] > 0 for r in selected), len(selected)),
            "essentialOnlyProblems": share(sum(r["decisions"] > 0 and r["essentialDecisions"] == r["decisions"]
                                               for r in selected), len(selected)),
            "decisionStates": decisions,
            "losingOptions": losing,
            "essentialShareOfDecisionStates": share(sum(r["essentialDecisions"] for r in selected), decisions),
            "queueShareOfDecisionStates": share(sum(r["queueDecisions"] for r in selected), decisions),
            "mixedShareOfDecisionStates": share(sum(r["mixedDecisions"] for r in selected), decisions),
            "forcedShareOfPathStates": share(sum(r["forcedStates"] for r in selected),
                                             sum(r["pathStates"] for r in selected)),
            "kindShareOfLosingOptions": {k: share(v, losing) for k, v in sorted(kinds.items())},
            "twinSameLengthShareOfTwinOptions": share(sum(r["twinSameLength"] for r in selected), kinds["twin"]),
            "outOfScopeProblems": share(sum(bool(r["queueDecisions"] or r["mixedDecisions"]) for r in selected),
                                        len(selected)),
            "reasonBShareOfLosingOptions": share(sum(r["reasons"].get("B", 0) + r["reasons"].get("AB", 0)
                                                     for r in selected), losing),
            "freeDecisionsPerProblem": round(statistics.mean(r["freeDecisions"] for r in selected), 3) if selected else None,
            "headFirstPerfect": share(sum(r["headFirst"] > 1 - 1e-9 for r in selected), len(selected)),
        }

    def table(selected: list[dict[str, object]]) -> list[object]:
        b = block(selected)
        return [b[c] for c in TABLE_COLUMNS]

    slack0 = [r for r in rows if r["slack"] == 0]
    by = {"columns": list(TABLE_COLUMNS)}
    for key in ("cars", "opening", "colors", "longShare", "queueMethod", "bays"):
        label = "longPreference" if key == "longShare" else key
        by[label] = {str(v): table([r for r in slack0 if r[key] == v]) for v in sorted({r[key] for r in slack0})}
    by["longPreferenceProblemsWithShortCar"] = {
        str(v): share(sum(r["long"] < r["cars"] for r in records if r["longShare"] == v),
                      sum(1 for r in records if r["longShare"] == v))
        for v in sorted({r["longShare"] for r in records})}
    by["longPreferenceActualLongShare"] = {
        str(v): round(sum(r["long"] for r in records if r["longShare"] == v)
                      / sum(r["cars"] for r in records if r["longShare"] == v), 3)
        for v in sorted({r["longShare"] for r in records})}
    by_bays_all = {"columns": list(TABLE_COLUMNS), **{str(b): table([r for r in rows if r["bays"] == b]) for b in BAYS}}
    by_slack = {"columns": list(TABLE_COLUMNS),
                **{str(s): table([r for r in rows if r["slack"] == s]) for s in sorted({r["slack"] for r in rows})}}

    reach = [x for r in slack0 for x in r["reach"]]
    def reach_block(items):
        if not items:
            return None
        visible = [x[0] for x in items]
        return {"options": len(items), "visibleMedian": statistics.median(visible),
                "visibleP90": sorted(visible)[int(0.9 * (len(visible) - 1))],
                "visibleShareOfRemainingMedian": round(statistics.median(x[0] / x[1] for x in items), 3),
                "distanceMaxMedian": statistics.median(x[2] for x in items),
                "runsMedian": statistics.median(x[5] for x in items),
                "runsP90": sorted(x[5] for x in items)[int(0.9 * (len(items) - 1))],
                "visibleOver6": share(sum(x[0] > 6 for x in items), len(items))}
    reading = {
        "all": reach_block(reach),
        "essential": reach_block([x for x in reach if x[3]]),
        "queueOnly": reach_block([x for x in reach if not x[3]]),
        "byCars": {str(c): reach_block([x for r in slack0 if r["cars"] == c for x in r["reach"]]) for c in SIZES},
        "twinByLengthAndOrigin": {
            f"{'same' if same else 'different'}Length-{'essential' if essential else 'queueOnly'}":
                sum(1 for x in reach if x[4] == "twin" and x[6] == same and x[3] == essential)
            for same in (1, 0) for essential in (1, 0)},
        "kindByOrigin": {f"{kind}-{'essential' if essential else 'queueOnly'}":
                         sum(1 for x in reach if x[4] == kind and x[3] == essential)
                         for kind in ("twin", "route", "order", "other") for essential in (1, 0)},
        "queueLengthByCars": {str(c): statistics.median(r["queueLength"] for r in records if r["cars"] == c)
                              for c in SIZES},
    }
    k_pairs = Counter((r["kMin"], r["kMinFree"]) for r in records)
    solvable = [r for r in records if r["kMin"] is not None]
    return {
        "problems": len(records),
        "clearable": len(solvable),
        "kMinEqualsFree": share(sum(r["kMin"] == r["kMinFree"] for r in solvable), len(solvable)),
        "kMinDistribution": {str(k): v for k, v in sorted(Counter(r["kMin"] for r in solvable).items())},
        "kMinMinusFree": {str(k): v for k, v in sorted(Counter(r["kMin"] - r["kMinFree"] for r in solvable).items())},
        "kPairsTop": [[str(k), v] for k, v in k_pairs.most_common(6)],
        "slack0": block(slack0),
        "bySlack": by_slack,
        "byBaysAllSlack": by_bays_all,
        "byConditionSlack0": by,
        "reading": reading,
        "cpuSecondsPerProblem": round(statistics.mean(r["seconds"] for r in records), 3),
    }


TYPES = ("sameCapacityTwin", "capacityAndBlocking", "positionOnlyTwin", "unplayableSwap", "queueOnlyTwin", "route",
         "other", "order")
CAPACITY_TWIN_TYPES = ("capacityAndBlocking", "positionOnlyTwin", "unplayableSwap", "queueOnlyTwin")


def population_block(records: list[dict[str, object]]) -> dict[str, object]:
    """Slack-0 rows of one population. Units: decision states vs losing options are named apart."""
    rows = [(r, row) for r in records for row in r["rows"] if row["slack"] == 0]
    states = sum(row["decisions"] for _, row in rows)
    options = [x for _, row in rows for x in row["reach"]]
    types = Counter(x[7] for x in options)
    capacity_twins = sum(types[t] for t in CAPACITY_TWIN_TYPES)
    essential_capacity = sum(types[t] for t in CAPACITY_TWIN_TYPES if t != "queueOnlyTwin")
    reasons = Counter()
    for _, row in rows:
        reasons.update(row["reasons"])
    out_of_scope = {str(c): share(sum(bool(row["queueDecisions"] or row["mixedDecisions"]) for r, row in rows
                                      if r["cars"] == c), sum(1 for r, _ in rows if r["cars"] == c)) for c in SIZES}
    type_states = Counter()
    for _, row in rows:
        type_states.update(row["typeStates"])
    essential_only = [(r, row) for r, row in rows if row["decisions"] and not row["queueDecisions"]
                      and not row["mixedDecisions"]]
    clearable = [r for r in records if r["kMin"] is not None]
    with_decisions = [row for _, row in rows if row["decisions"]]
    by_size = sorted((row["decisions"] for _, row in rows), reverse=True)
    return {
        "problems": len(records),
        "slack0Rows": len(rows),
        "decisionStatesPerProblem": round(states / len(rows), 3) if rows else None,
        "essentialShareOfDecisionStates": share(sum(row["essentialDecisions"] for _, row in rows), states),
        "essentialShareMeanPerProblem": round(statistics.mean(row["essentialDecisions"] / row["decisions"]
                                                              for row in with_decisions), 3) if with_decisions else None,
        "topOnePercentProblemsShareOfDecisionStates": share(sum(by_size[:max(1, len(by_size) // 100)]), states),
        "queueShareOfDecisionStates": share(sum(row["queueDecisions"] for _, row in rows), states),
        "mixedShareOfDecisionStates": share(sum(row["mixedDecisions"] for _, row in rows), states),
        "essentialOnlyProblems": share(len(essential_only), len(rows)),
        "outOfScopeProblems": share(sum(bool(row["queueDecisions"] or row["mixedDecisions"]) for _, row in rows),
                                    len(rows)),
        "outOfScopeByCars": out_of_scope,
        "kMinEqualsWithoutBlocking": share(sum(r["kMin"] == r["kMinFree"] for r in clearable), len(clearable)),
        "losingOptions": len(options),
        "losingOptionTypes": {t: types[t] for t in TYPES if types[t]},
        "decisionStatesContainingType": {t: type_states[t] for t in TYPES if type_states[t]},
        "capacityTwinEssentialShare": share(essential_capacity, capacity_twins),
        "capacityMattersShareOfEssentialCapacityTwins": share(types["capacityAndBlocking"], essential_capacity),
        "problemsWithCapacityAndBlocking": share(sum(row["types"].get("capacityAndBlocking", 0) > 0 for _, row in rows),
                                                 len(rows)),
        "essentialOnlyWithCapacityAndBlocking": share(sum(row["types"].get("capacityAndBlocking", 0) > 0
                                                          for _, row in essential_only), len(essential_only)),
        "reasonBShareOfLosingOptions": share(reasons["B"] + reasons["AB"], sum(reasons.values())),
        "reasonAShareOfLosingOptions": share(reasons["A"] + reasons["AB"], sum(reasons.values())),
    }


def reading_block(records: list[dict[str, object]]) -> dict[str, object]:
    """How far ahead the losing options fail, per losing option and per problem (max), in passengers and runs."""
    options = []
    per_problem = []
    for r in records:
        queue = r["problem"]["queue"]
        for row in r["rows"]:
            if row["slack"] != 0 or not row["reach"]:
                continue
            items = []
            for x in row["reach"]:
                served = len(queue) - x[1]
                items.append({"visible": x[0], "distance": x[2], "type": x[7], "visibleRuns": x[5],
                              "distanceRuns": color_runs(queue[served:served + x[2]])})
            options += items
            per_problem.append({"distanceMax": max(i["distance"] for i in items),
                                "distanceRunsMax": max(i["distanceRuns"] for i in items),
                                "essentialOnly": not (row["queueDecisions"] or row["mixedDecisions"])})

    def quantiles(values: list[int]) -> list[float] | None:
        if not values:
            return None
        ordered = sorted(values)
        return [ordered[int(q * (len(ordered) - 1))] for q in (0.1, 0.5, 0.9)]

    return {
        "quantiles": "p10, median, p90",
        "visiblePassengers": quantiles([o["visible"] for o in options]),
        "visibleRuns": quantiles([o["visibleRuns"] for o in options]),
        "distancePassengers": quantiles([o["distance"] for o in options]),
        "distanceRuns": quantiles([o["distanceRuns"] for o in options]),
        "byType": {t: {"options": n, "visiblePassengers": quantiles([o["visible"] for o in options if o["type"] == t]),
                       "visibleRuns": quantiles([o["visibleRuns"] for o in options if o["type"] == t])}
                   for t, n in Counter(o["type"] for o in options).most_common()},
        "perProblemEssentialOnly": {
            "problems": sum(p["essentialOnly"] for p in per_problem),
            "distanceMaxPassengers": dict(sorted(Counter(p["distanceMax"] for p in per_problem
                                                         if p["essentialOnly"]).items())),
            "distanceMaxRuns": dict(sorted(Counter(p["distanceRunsMax"] for p in per_problem
                                                   if p["essentialOnly"]).items())),
        },
    }


def swap_breakdown(record: dict[str, object], bays: int) -> Counter:
    """Capacity-and-blocking losing options by (winner still wins, loser now wins) after the capacity swap."""
    problem = PassengerProblem.from_json(record["problem"])
    reading = PassengerReading(problem.game(bays))
    game = reading.game
    found = Counter()
    for d in reading.summary()["detail"]:
        state = d["state"]
        natural = reading.natural(state)
        winners = [p for p in natural if game.wins(p.outcome)]
        for p in natural:
            if game.wins(p.outcome) or reading.kind(p, winners) != "twin" or not reading.free.wins(p.outcome):
                continue
            if game.lengths[p.head_car] in {game.lengths[w.head_car] for w in winners}:
                continue
            outcome = reading.capacity_swap_outcomes(state, p, winners)
            if isinstance(outcome, tuple) and outcome != (True, False):
                found[{(True, True): "bothWin", (False, True): "reversed", (False, False): "bothLose"}[outcome]] += 1
    return found


def swap_breakdown_worker(args: tuple[dict[str, object], int]) -> Counter:
    return swap_breakdown(*args)


def profile_one(args: tuple[dict[str, object], dict[str, object]]) -> dict[str, object]:
    """Run profile of one in-scope slack-0 row, by default and with buried twins kept, plus the swap breakdown."""
    record, row = args
    problem = PassengerProblem.from_json(record["problem"])
    reading = PassengerReading(problem.game(row["bays"]))
    default = path_profile(reading)
    current = reading.summary()
    changed = any(current[k] != row[k] for k in ("decisions", "essentialDecisions", "queueDecisions", "types"))
    variant_reading = PassengerReading(problem.game(row["bays"]), skip_buried_twin=False)
    variant_summary = variant_reading.summary()
    variant = path_profile(variant_reading)
    return {"population": record["population"], "index": record["index"], "cars": record["cars"],
            "bays": row["bays"], "decisions": row["decisions"], "types": row["types"],
            "outOfScope": bool(row["queueDecisions"] or row["mixedDecisions"]),
            "variantOutOfScope": bool(variant_summary["queueDecisions"] or variant_summary["mixedDecisions"]),
            "headFirstPerfect": row["headFirst"] > 1 - 1e-9, "distanceMax": row["distanceMax"],
            **default, **{f"variant:{k}": v for k, v in variant.items()},
            "swap": dict(swap_breakdown(record, row["bays"])), "changedSinceSurvey": changed}


def run_profiles(surveys: list[dict[str, object]], populations: list[str], workers: int) -> dict[str, object]:
    jobs = [(r, row) for s in surveys for r in s["records"] if r["population"] in populations
            for row in r["rows"] if row["slack"] == 0]
    seeds = [s["seed"] for s in surveys for r in s["records"] if r["population"] in populations
             for row in r["rows"] if row["slack"] == 0]
    with Pool(workers) as pool:
        profiles = pool.map(profile_one, jobs, chunksize=4)
    return {"populations": populations, "profiles": [{**p, "seed": seed} for p, seed in zip(profiles, seeds)]}


def populations_digest(surveys: list[dict[str, object]]) -> dict[str, object]:
    names = surveys[0]["populations"]
    result = {"definitions": {n: POPULATIONS[n] for n in names}, "combined": {}, "bySeed": {}, "reading": {}}
    for name in names:
        records = [r for s in surveys for r in s["records"] if r["population"] == name]
        result["combined"][name] = population_block(records)
        result["bySeed"][name] = {
            str(s["seed"]): {k: v for k, v in population_block([r for r in s["records"] if r["population"] == name]).items()
                             if k in ("decisionStatesPerProblem", "essentialShareOfDecisionStates",
                                      "essentialShareMeanPerProblem", "essentialOnlyProblems",
                                      "capacityTwinEssentialShare", "capacityMattersShareOfEssentialCapacityTwins",
                                      "kMinEqualsWithoutBlocking")}
            for s in surveys}
        result["reading"][name] = reading_block(records)
    return result


def supply_digest(data: list[dict[str, object]]) -> dict[str, object]:
    result = {}
    for supply in data:
        groups = defaultdict(list)
        for a in supply["attempts"]:
            groups[(a["generator"], a["target"])].append(a)
        for (generator, target), attempts in sorted(groups.items()):
            accepted = [a for a in attempts if a["accepted"]]
            cpu = sum(a["seconds"] for a in attempts)
            problems = [PassengerProblem.from_json(a["problem"]) for a in accepted]
            geometric = {canonical(p) for p in problems}
            structural = {structural_canonical(p) for p in problems} if len(problems) <= 3000 else None
            openings = Counter(a["opening"] for a in accepted)
            result[f"{supply['seed']}:{generator}:{target}"] = [
                len(attempts), len(accepted), share(len(accepted), len(attempts)), len(geometric),
                len(structural) if structural is not None else None, round(cpu, 1),
                round(60 * len(accepted) / cpu, 2) if cpu else None,
                round(statistics.median(a["seconds"] for a in attempts), 4),
                dict(sorted(Counter(str(a["cars"]) for a in accepted).items())), dict(sorted(openings.items())),
            ]
    return {"columns": ["attempts", "accepted", "hitRate", "distinctGeometric", "distinctStructural", "cpuSeconds",
                        "acceptedPerCpuMinute", "secondsPerAttemptMedian", "acceptedByCars", "acceptedByOpening"],
            **result}


FRONTEND_SIDE = {"top": "up", "right": "right", "bottom": "down", "left": "left"}


def winning_line(game, state) -> list[int]:
    order = []
    while state[0]:
        car = next(i for i in game.moves(state) if game.wins(game.step(state, i)))
        order.append(car)
        state = game.step(state, car)
    return order


def losing_line(reading: PassengerReading, state) -> list[int]:
    """Natural continuation that stops earliest."""
    order = []
    while True:
        children = reading.natural(state) if state[0] else ()
        if not children:
            return order
        plan = min(children, key=lambda p: reading.survival(p.outcome)[0])
        order += plan_order(reading.game, state, plan.outcome)
        state = plan.outcome


def explain(problem: PassengerProblem, bays: int, decisions: int = 1) -> dict[str, object]:
    """First decisions on the reader's path with winning and losing exit orders."""
    game = problem.game(bays)
    reading = PassengerReading(game)
    summary = {**reading.summary(), **path_profile(reading)}
    items = []
    for d in summary["detail"][:decisions]:
        state = d["state"]
        natural = reading.natural(state)
        before = winning_prefix(reading, state)
        entries = []
        for p in natural:
            line = plan_order(game, state, p.outcome)
            won = game.wins(p.outcome)
            after = winning_line(game, p.outcome) if won else best_losing_line(game, p.outcome)
            entries.append({"exits": [f"v{i}" for i in line], "wins": won,
                            "continuation": [f"v{i}" for i in after],
                            "boardedWhenStuck": None if won else replay_boarded(problem, bays, before + line + after),
                            "waitingAfter": game.waiting(p.outcome),
                            "blockingEssential": None if won else game_free_wins(problem, bays, p.outcome)})
        items.append({"before": [f"v{i}" for i in before], "served": d["served"],
                      "head": problem.queue[d["served"]], "options": entries,
                      "losing": [{k: v for k, v in x.items()} for x in d["losing"]]})
    return {"decisions": items, "summary": {k: v for k, v in summary.items() if k != "detail"}}


def best_losing_line(game, state) -> list[int]:
    """From a lost state, exits that board the most passengers before no exit is left."""
    order = []
    while game.moves(state):
        car = max(game.moves(state), key=lambda i: game.max_reach(game.step(state, i)))
        order.append(car)
        state = game.step(state, car)
    return order


def replay_boarded(problem: PassengerProblem, bays: int, exits: list[int]) -> int:
    """Passengers boarded when the rule-lab transition, replayed from the start, has no exit left."""
    explicit = problem.explicit(bays)
    state = explicit.start
    for car in exits:
        if car not in explicit.moves(state):
            raise ValueError("exit order is not playable")
        state = explicit.step(state, car)
    if explicit.moves(state) or explicit.won(state):
        raise ValueError("the line does not end stuck")
    return state[2]


def game_free_wins(problem: PassengerProblem, bays: int, state) -> bool:
    return problem.game(bays, geometry=False).wins(state)


def winning_prefix(reading: PassengerReading, target) -> list[int]:
    """Exit order along the reader's winning path from the start to `target`."""
    game = reading.game
    parents = {game.start: None}
    for state in reading.path():
        if state == target:
            break
        for p in reading.follow(state):
            parents.setdefault(p.outcome, (state, p.outcome))
    order = []
    node = target
    while parents.get(node) is not None:
        previous, outcome = parents[node]
        order = plan_order(game, previous, outcome) + order
        node = previous
    return [*order]


def example_entry(identifier: str, title: str, kind: str, problem: PassengerProblem, bays: int,
                  note: str) -> dict[str, object]:
    game = problem.game(bays)
    k_min = problem.minimum_bays()
    explained = explain(problem, bays, decisions=2)
    return {
        "id": identifier,
        "title": title,
        "kind": kind,
        "bayCount": bays,
        "solutions": game.solution_count(),
        "queue": problem.queue,
        "board": {
            "width": problem.size, "height": problem.size,
            "vehicles": [{"id": f"v{i}", "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": c} for i, (v, c) in enumerate(zip(problem.vehicles, problem.colors))],
            "fixedAreas": [],
            "roadOpenings": [{"side": FRONTEND_SIDE[s], "startOffset": 0, "length": problem.size}
                             for s in sorted(problem.openings)],
        },
        "kMin": k_min,
        "kMinWithoutBlocking": problem.minimum_bays(geometry=False),
        "features": explained["summary"],
        "firstDecisions": explained["decisions"],
        "solution": [f"v{i}" for i in winning_line(game, game.start)],
        "diagram": problem.diagram(),
        "note": note,
    }


def level_study(surveys: list[dict[str, object]], sample: int, seed: int) -> dict[str, object]:
    """Tentative levels on survey rows, by car count, and how often a counting variant moves them."""
    rows = []
    for survey in surveys:
        for record in survey["records"]:
            for row in record["rows"]:
                if row["slack"] == 0:
                    rows.append((record, row))
    by_cars = defaultdict(Counter)
    for record, row in rows:
        by_cars[str(record["cars"])][str(tentative_level(row))] += 1
    leveled = [(record, row) for record, row in rows if tentative_level(row) is not None]
    rng = random.Random(seed)
    picked = rng.sample(leveled, min(sample, len(leveled)))
    moved = Counter()
    total = Counter()
    for record, row in picked:
        level = tentative_level(row)
        problem = PassengerProblem.from_json(record["problem"])
        variant = PassengerReading(problem.game(row["bays"]), skip_buried_twin=False).summary()
        variant.update({"bays": row["bays"], "slack": row["slack"]})
        by_options = tentative_level(row, "losingOptions")
        total[level] += 1
        moved[f"{level}:keepBuriedTwin"] += tentative_level(variant) != level
        moved[f"{level}:countLosingOptions"] += by_options != level
    return {
        "levelByCars": {c: dict(sorted(v.items())) for c, v in sorted(by_cars.items())},
        "variantSample": dict(sorted((str(k), v) for k, v in total.items())),
        "variantMoved": {k: share(v, total[int(k.split(":")[0])]) for k, v in sorted(moved.items())},
    }


# Notes count passengers as boarded when play stops, replayed through the rule-lab
# transition along the line that boards the most (`boardedWhenStuck`).
EXAMPLES = (
    {"seed": 738, "index": 1456, "population": "random", "bays": 2, "id": "blocking", "title": "遮断が本質の判断",
     "kind": "代表",
     "note": "D の2台のうち定員3の v5 を使うと、残った定員2の v3 が C の v1 の出口を塞ぐ。v1 を出すには v3 を待機させるしかなく、"
             "最善に進めても12人が乗ったところで止まる。遮断を無くすと v1 がすぐ出せて勝つ。定員を入れ替えても正解は変わらず、"
             "位置だけで決まる判断（positionOnlyTwin）。手で追った。"},
    {"seed": 738, "index": 314, "population": "random", "bays": 2, "id": "queue", "title": "列だけで決まる判断",
     "kind": "代表",
     "note": "A の2台はどちらもすぐ出せる。定員3の v2 を使うと A の席が1つ余って待機が続き、D の受付で v0 と並んで枠が埋まる。"
             "最善に進めても10人が乗ったところで止まる。定員2の v6 なら A の受付で出発する。遮断を無くしても同じ選択が負ける。手で追った。"},
    {"seed": 738, "index": 226, "population": "random", "bays": 3, "id": "boundary", "title": "両方を含む境界", "kind": "境界",
     "note": "1つ目の判断（D の定員3の v7 か定員2の v5）は遮断が本質: v7 を使うと残った v5 が A の v3 の出口を塞ぎ、最善でも5人で止まる。"
             "2台の定員を入れ替えると勝ち負けが変わるので「定員と遮断の両方」に数える。2つ目の判断（どちらも定員2の C の v0 と v6 の"
             "どちらを掘り出すか）は列だけ: B の v1 を掘ると B の受付まで待機が続き、最善でも6人で止まる。手で追った。"},
    {"seed": 738, "index": 346, "population": "random", "bays": 4, "id": "counter", "title": "掘る側の選択が列で決まる反例",
     "kind": "反例",
     "note": "上下だけが開く盤面で、D の v1 を上の C（v2）と下の B（v4）のどちらから掘るか。選択肢は遮断から生じるが、"
             "勝ち負けは掘った車の色がいつ受け付けられるかで決まり、遮断を無くしても負けは変わらないので「列だけ」に数える。"
             "最善でも9人で止まる。遮断が選択肢を作っても、分類は遮断が本質とは判定しない例。最初の局面だけ手で追った。"},
    {"seed": 738, "index": 61, "population": "favorableAdjacent2", "bays": 3, "id": "capacity-blocking-1",
     "title": "定員と遮断の両方を読む判断1", "kind": "代表",
     "note": "最初の C は、A の v4 を出して定員3の v3 を使うか、A の v6 を出して定員2の v5 を使うか。v3 は C が3人そろう11人目まで"
             "待機し、しかも v6 が B の v1 の出口に残る。B の受付で v1 を出すには v6 を待機させるしかなく、枠が埋まって8人で止まる。"
             "v5 なら7人目の C で出発し、v6 も同時に片づく。遮断を無くすと v3 側も勝ち、v3 と v5 の定員を入れ替えると勝ち負けが逆転する。手で追った。"},
    {"seed": 738, "index": 241, "population": "favorableAdjacent2", "bays": 3, "id": "capacity-blocking-2",
     "title": "定員と遮断の両方を読む判断2", "kind": "代表",
     "note": "2人目の B を、A の v3 の出口を塞ぐ定員2の v4 で受けるか、どこも塞がない定員3の v6 で受けるか。v6 を使うと v4 が v3 の上に"
             "残り、v6 は3人目の B（11人目）まで待機する。C の v2 と A の v1 を受けたあと、A の v3 を出すには v4 を待機させるしかなく、"
             "最善でも9人で止まる。v4 なら B 2人で出発し v3 も開く。遮断を無くすと v6 側も勝ち、v4 と v6 の定員を入れ替えると両方勝つ。手で追った。"},
    {"seed": 738, "index": 101, "population": "favorableAdjacent2", "bays": 3, "id": "same-capacity",
     "title": "同じ定員の使い分け", "kind": "代表",
     "note": "D の2台はどちらも定員2ですぐ出せる。右上の v2 は C の v1 の出口を塞いでいる。左上の v5 を使うと、次の C の受付で v1 を"
             "出すために v2 を待機させることになり、最善でも4人で止まる。v2 を使えば v1 がそのまま出せる。出庫指令型と同じ型。手で追った。"},
    {"seed": 738, "index": 384, "population": "favorableAdjacent2", "bays": 2, "id": "boundary-queue",
     "title": "列だけの判断が混ざる境界", "kind": "境界",
     "note": "1つ目の判断（A の受付を定員2の v4 か定員3の v6 で受けるか）は列だけで決まり、v4 を選ぶと最善でも14人で止まる（機械の判定のみ、"
             "手では追っていない）。2つ目の判断（B を v3・v0・v7 のどれで受けるか）は遮断が本質: 定員3の v0 を使うと v3 が A の v1 と"
             "C の v2 の出口に残る（14人で止まる）。v7 は v3 と同じ定員2で、使うと v3 が残る（13人で止まる）。2つ目の判断だけ手で追った。"},
)


def rule_lab_case(identifier: str, problem: PassengerProblem, bays: int) -> dict[str, object]:
    """A problem with its bay count, solution count and each first exit's outcome, for the rule-lab test."""
    game = problem.game(bays)
    return {
        "id": identifier,
        "bayCount": bays,
        "queue": problem.queue,
        "board": {
            "width": problem.size, "height": problem.size,
            "vehicles": [{"id": f"v{i}", "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": c} for i, (v, c) in enumerate(zip(problem.vehicles, problem.colors))],
            "fixedAreas": [],
            "roadOpenings": [{"side": FRONTEND_SIDE[s], "startOffset": 0, "length": problem.size}
                             for s in sorted(problem.openings)],
        },
        "solutions": game.solution_count(),
        "firstExits": [{"vehicleId": f"v{i}", "canWin": game.wins(game.step(game.start, i))} for i in game.moves(game.start)],
    }


def build_rule_lab_cases(count: int = 20, seed: int = 739, limit: int = 200_000) -> list[dict[str, object]]:
    """Random 6-10 car problems (solutions at most `limit`, so the rule-lab search stays quick) and the examples."""
    rng = random.Random(seed)
    cases = []
    while len(cases) < count:
        conditions = draw_conditions(rng, {"cars": rng.choice([8, 10])})
        conditions["cars"] = rng.choice([6, 8, 10])
        conditions["size"] = 6 if conditions["cars"] <= 8 else 7
        problem = build(rng, conditions)
        bays = rng.choice(BAYS)
        case = rule_lab_case(f"random-{len(cases)}", problem, bays)
        if case["solutions"] <= limit:
            cases.append(case)
    for spec in EXAMPLES:
        record = survey_one((spec["seed"], spec["index"], spec["population"]))
        cases.append(rule_lab_case(f"example-{spec['id']}", PassengerProblem.from_json(record["problem"]), spec["bays"]))
    return cases


def build_examples() -> list[dict[str, object]]:
    entries = []
    for spec in EXAMPLES:
        record = survey_one((spec["seed"], spec["index"], spec["population"]))
        problem = PassengerProblem.from_json(record["problem"])
        entries.append(example_entry(spec["id"], spec["title"], spec["kind"], problem, spec["bays"], spec["note"]))
    return entries


def load_json(path: str):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def compact_json(value, indent: int = 0, width: int = 240) -> str:
    """Indented JSON that keeps any value fitting in `width` columns on one line."""
    pad = " " * indent
    if isinstance(value, dict):
        value = {str(k): v for k, v in value.items()}
    inline = json.dumps(value, ensure_ascii=False)
    if not isinstance(value, (dict, list)) or len(pad) + len(inline) <= width:
        return inline
    if isinstance(value, dict):
        items = [f"{pad} {json.dumps(str(k), ensure_ascii=False)}: {compact_json(v, indent + 1, width)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    items = [f"{pad} {compact_json(v, indent + 1, width)}" for v in value]
    return "[\n" + ",\n".join(items) + f"\n{pad}]"


def accepted_contents(supplies: list[dict[str, object]]) -> dict[str, object]:
    """What accepted problems are made of, per target, over all seeds and generators."""
    groups = defaultdict(list)
    for supply in supplies:
        for a in supply["attempts"]:
            if a["accepted"]:
                groups[a["target"]].append({**a, "seed": supply["seed"], "fixed": supply.get("fixed", {})})
    result = {}
    for target, accepted in sorted(groups.items()):
        if target not in ("essentialOnly", "essentialOnlyCB", "lv5", "run5"):
            continue
        kinds = Counter()
        for a in accepted:
            kinds.update(a["features"]["kinds"])
        losing = sum(kinds.values())
        result[target] = {
            "accepted": len(accepted),
            "kindShare": {k: share(v, losing) for k, v in sorted(kinds.items())},
            "twinSameLengthShare": share(sum(a["features"]["twinSameLength"] for a in accepted), kinds["twin"]),
            "withDecisionWithoutBlocking": share(sum(a["features"]["freeDecisions"] > 0 for a in accepted), len(accepted)),
            "byLongPreference": dict(sorted(Counter(str(a["longShare"]) for a in accepted).items())),
            "byGeneratorSeedLongPreference": dict(sorted(Counter(
                f"{a['generator']}:{a['seed']}:{a['longShare']}" for a in accepted).items())),
            "losingOptionTypes": dict(sorted(sum((Counter(a["features"].get("types", {})) for a in accepted),
                                                 Counter()).items())),
            "byColors": dict(sorted(Counter(a["colors"] for a in accepted).items())),
            "byBays": dict(sorted(Counter(str(a["features"]["bays"]) for a in accepted).items())),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    survey = sub.add_parser("survey")
    survey.add_argument("--seed", type=int, default=738)
    survey.add_argument("--count", type=int, default=2000)
    survey.add_argument("--workers", type=int, default=4)
    survey.add_argument("--populations", default="random", help=f"comma-separated names from {sorted(POPULATIONS)}")
    survey.add_argument("--output", required=True)
    supply = sub.add_parser("supply")
    supply.add_argument("--seed", type=int, default=738)
    supply.add_argument("--generators", default="G1,Grand,G3")
    supply.add_argument("--targets", default="essential,essentialOnly")
    supply.add_argument("--seconds", type=float, default=30.0, help="CPU seconds per worker and job")
    supply.add_argument("--workers", type=int, default=4)
    supply.add_argument("--fixed", default="{}", help="JSON of conditions to hold fixed, e.g. {\"cars\": 12}")
    supply.add_argument("--output", required=True)
    levels = sub.add_parser("levels")
    levels.add_argument("--surveys", nargs="+", required=True)
    levels.add_argument("--sample", type=int, default=600)
    levels.add_argument("--seed", type=int, default=739)
    levels.add_argument("--output", required=True)
    cases = sub.add_parser("rule-lab-cases")
    cases.add_argument("--output", required=True)
    examples = sub.add_parser("examples")
    examples.add_argument("--output", required=True)
    profiles = sub.add_parser("profiles")
    profiles.add_argument("--surveys", nargs="+", required=True)
    profiles.add_argument("--populations", default="favorableAdjacent2,favorableOne")
    profiles.add_argument("--workers", type=int, default=4)
    profiles.add_argument("--output", required=True)
    digest = sub.add_parser("digest")
    digest.add_argument("--surveys", nargs="*", default=[])
    digest.add_argument("--supplies", nargs="*", default=[])
    digest.add_argument("--population-surveys", nargs="*", default=[])
    digest.add_argument("--profiles")
    digest.add_argument("--dispatch-expected")
    digest.add_argument("--favorable-supplies", nargs="*", default=[])
    digest.add_argument("--levels")
    digest.add_argument("--examples")
    digest.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "survey":
        data = run_survey(args.seed, args.count, args.workers, args.populations.split(","))
    elif args.command == "supply":
        data = run_supply(args.seed, args.generators.split(","), args.targets.split(","), args.seconds, args.workers,
                          json.loads(args.fixed))
    elif args.command == "profiles":
        data = run_profiles([load_json(p) for p in args.surveys], args.populations.split(","), args.workers)
    elif args.command == "examples":
        data = build_examples()
    elif args.command == "rule-lab-cases":
        data = build_rule_lab_cases()
    elif args.command == "levels":
        data = level_study([load_json(p) for p in args.surveys], args.sample, args.seed)
    else:
        surveys = [load_json(p) for p in args.surveys]
        supplies = [load_json(p) for p in args.supplies]
        data = {}
        for s in surveys:
            single = survey_digest([s])
            data[f"survey{s['seed']}"] = {k: single[k] for k in ("problems", "kMinEqualsFree", "kMinDistribution", "slack0")}
        if len(surveys) > 1:
            data["surveyAll"] = survey_digest(surveys)
        if supplies:
            data["supply"] = supply_digest(supplies)
            data["acceptedContents"] = accepted_contents(supplies)
        if args.population_surveys:
            data["populations"] = populations_digest([load_json(p) for p in args.population_surveys])
        if args.profiles:
            profiles = load_json(args.profiles)["profiles"]
            swaps = Counter()
            for profile in profiles:
                swaps.update(profile["swap"])
            data["favorable"] = {
                "populations": sorted({p["population"] for p in profiles}),
                "capacityAndBlockingBySwapOutcome": dict(sorted(swaps.items())),
                "runLevels": run_level_study(profiles),
                "inScopeRunProfileByCars": {
                    str(c): {key: dict(sorted(Counter(min(p[key], 4) for p in profiles
                                                      if p["cars"] == c and not p["outOfScope"]).items()))
                             for key in ("decisionsOnRunMin", "capacityAndBlockingOnRunMin",
                                         "capacityAndBlockingOnRunMax")}
                    for c in SIZES},
            }
        if args.dispatch_expected:
            accepted = load_json(args.dispatch_expected)["accepted"]["byLevel"]
            data["dispatchComparison"] = {
                "source": "parking_jam_dispatch_levels.expected.json accepted.byLevel.*.distanceMax (requests, per problem)",
                "distanceMaxByLevel": {lv: accepted[lv]["distanceMax"] for lv in ("Lv2", "Lv3", "Lv4", "Lv5")},
            }
        if args.favorable_supplies:
            data["favorableSupply"] = supply_digest([load_json(p) for p in args.favorable_supplies])
            data["favorableAcceptedContents"] = accepted_contents([load_json(p) for p in args.favorable_supplies])
        if args.levels:
            data["tentativeLevels"] = load_json(args.levels)
        if args.examples:
            data["examples"] = {e["id"]: {"kind": e["kind"], "bays": e["bayCount"], "solutions": e["solutions"],
                                          "kMin": e["kMin"], "kMinWithoutBlocking": e["kMinWithoutBlocking"],
                                          "decisionStates": e["features"]["decisions"],
                                          "essentialDecisionStates": e["features"]["essentialDecisions"],
                                          "queueDecisionStates": e["features"]["queueDecisions"],
                                          "losingOptionTypes": e["features"]["types"],
                                          "decisionsOnRunMin": e["features"]["decisionsOnRunMin"],
                                          "capacityAndBlockingOnRunMin": e["features"]["capacityAndBlockingOnRunMin"]}
                                for e in load_json(args.examples)}
    with open(args.output, "w", encoding="utf-8") as handle:
        if args.command in ("digest", "rule-lab-cases"):
            handle.write(compact_json(data))
        else:
            json.dump(data, handle, ensure_ascii=False, indent=1 if args.command in ("levels", "examples") else None)
        handle.write("\n")


if __name__ == "__main__":
    main()
