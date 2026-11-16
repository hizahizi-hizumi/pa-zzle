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
    shuffled_queue,
    structural_canonical,
)
from parking_jam_rule_space import positions

SIZES = {8: (6, 7), 10: (7,), 12: (7, 8)}
COLOR_SCHEMES = ("3", "4", "pairs")
LONG_SHARES = (0.0, 0.5, 1.0)
QUEUE_METHODS = ("order", "random")
BAYS = (2, 3, 4)


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
    conditions.update(fixed or {})
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
    summary = PassengerReading(game).summary()
    free_summary = PassengerReading(problem.game(bays, geometry=False)).summary()
    decisions = summary.pop("detail")
    free_summary.pop("detail")
    row = {
        **summary,
        "bays": bays,
        "slack": bays - k_min,
        "solutions": game.solution_count(),
        "headFirst": game.win_probability("head-first"),
        "freeDecisions": free_summary["decisions"],
        "reach": [[x["visible"], d["remaining"], x["distanceMax"], int(x["blockingEssential"]), x["kind"],
                   color_runs(problem.queue[d["served"]:d["served"] + x["visible"]]), int(x["sameLength"])]
                  for d in decisions for x in d["losing"]],
    }
    if detail:
        row["detail"] = decisions
    return row


def survey_one(args: tuple[int, int]) -> dict[str, object]:
    seed, index = args
    rng = random.Random(seed * 1_000_003 + index)
    conditions = draw_conditions(rng)
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
    return {"index": index, **conditions, "queueLength": len(problem.queue), "long": lengths[3],
            "kMin": k_min, "kMinFree": k_free, "rows": rows, "seconds": time.process_time() - begun,
            "problem": problem.to_json()}


def run_survey(seed: int, count: int, workers: int) -> dict[str, object]:
    with Pool(workers) as pool:
        records = pool.map(survey_one, [(seed, i) for i in range(count)], chunksize=4)
    return {"seed": seed, "count": count, "records": records}


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
    raise ValueError(target)


def judge(problem: PassengerProblem, target: str) -> tuple[bool, float, dict[str, object] | None]:
    """At slack 0 within 2-4 bays: (accepted, score to climb, features)."""
    k_min = problem.minimum_bays()
    if k_min is None or k_min > max(BAYS):
        return False, -10.0, None
    bays = max(k_min, min(BAYS))
    row = features(problem, bays, k_min)
    score = 2.0 * row["essentialDecisions"] - row["queueDecisions"] - row["mixedDecisions"] - 0.5 * (k_min < min(BAYS))
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


TABLE_COLUMNS = ("rows", "withDecision", "withEssential", "essentialOnlyProblems", "decisions", "essentialShare",
                 "queueShare", "twinSameLengthShare", "freeDecisionsPerProblem", "headFirstPerfect")


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
            "decisions": decisions,
            "essentialShare": share(sum(r["essentialDecisions"] for r in selected), decisions),
            "queueShare": share(sum(r["queueDecisions"] for r in selected), decisions),
            "mixedShare": share(sum(r["mixedDecisions"] for r in selected), decisions),
            "forcedShareOfPath": share(sum(r["forcedStates"] for r in selected), sum(r["pathStates"] for r in selected)),
            "kindShare": {k: share(v, losing) for k, v in sorted(kinds.items())},
            "twinSameLengthShare": share(sum(r["twinSameLength"] for r in selected), kinds["twin"]),
            "freeDecisionsPerProblem": round(statistics.mean(r["freeDecisions"] for r in selected), 3) if selected else None,
            "headFirstPerfect": share(sum(r["headFirst"] > 1 - 1e-9 for r in selected), len(selected)),
        }

    def table(selected: list[dict[str, object]]) -> list[object]:
        b = block(selected)
        return [b[c] for c in TABLE_COLUMNS]

    slack0 = [r for r in rows if r["slack"] == 0]
    by = {"columns": list(TABLE_COLUMNS)}
    for key in ("cars", "opening", "colors", "longShare", "queueMethod", "bays"):
        by[key] = {str(v): table([r for r in slack0 if r[key] == v]) for v in sorted({r[key] for r in slack0})}
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


def plan_order(game, state, outcome) -> list[int]:
    """One exit order from `state` to the plan outcome `outcome`."""
    parents = {state: None}
    frontier = [state]
    while frontier:
        following = []
        for s in frontier:
            for i in game.moves(s):
                child = game.step(s, i)
                if child in parents:
                    continue
                parents[child] = (s, i)
                if child == outcome:
                    order = []
                    while parents[child] is not None:
                        child, car = parents[child]
                        order.append(car)
                    return order[::-1]
                if game.progress(child) == game.progress(state):
                    following.append(child)
        frontier = following
    raise ValueError("outcome is not reachable within one plan")


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
    summary = reading.summary()
    items = []
    for d in summary["detail"][:decisions]:
        state = d["state"]
        natural = reading.natural(state)
        before = winning_prefix(reading, state)
        entries = []
        for p in natural:
            line = plan_order(game, state, p.outcome)
            won = game.wins(p.outcome)
            after = winning_line(game, p.outcome) if won else losing_line(reading, p.outcome)
            entries.append({"exits": [f"v{i}" for i in line], "wins": won,
                            "continuation": [f"v{i}" for i in after],
                            "stuckAtPassenger": None if won else reading.survival(p.outcome)[0],
                            "waitingAfter": game.waiting(p.outcome),
                            "blockingEssential": None if won else game_free_wins(problem, bays, p.outcome)})
        items.append({"before": [f"v{i}" for i in before], "served": d["served"],
                      "head": problem.queue[d["served"]], "options": entries,
                      "losing": [{k: v for k, v in x.items()} for x in d["losing"]]})
    return {"decisions": items, "summary": {k: v for k, v in summary.items() if k != "detail"}}


def game_free_wins(problem: PassengerProblem, bays: int, state) -> bool:
    return problem.game(bays, geometry=False).wins(state)


def winning_prefix(reading: PassengerReading, target) -> list[int]:
    """Exit order along the reader's winning path from the start to `target`."""
    game = reading.game
    parents = {game.start: None}
    for state in reading.path():
        if state == target:
            break
        winners = [p for p in reading.natural(state) if game.wins(p.outcome)] or [
            p for p in reading.plans(state) if game.wins(p.outcome)]
        for p in winners:
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


EXAMPLES = (
    {"seed": 738, "index": 1456, "bays": 2, "id": "blocking", "title": "遮断が本質の判断", "kind": "代表",
     "note": "D の2台のうち定員3の v5 を使うと、残った定員2の v3 が C の v1 の出口を塞ぐ。v1 を出すには v3 を待機させるしかなく、"
             "C の受付中に枠が溢れる（12人目で停止）。遮断を無くすと v1 がすぐ出せて勝つ。手で追った。"},
    {"seed": 738, "index": 314, "bays": 2, "id": "queue", "title": "列だけで決まる判断", "kind": "代表",
     "note": "A の2台はどちらもすぐ出せる。定員3の v2 を使うと A の席が1つ余って待機が続き、次の D の受付で v0 と並んで枠が溢れる"
             "（8人目で停止）。定員2の v6 なら A の受付で出発する。遮断を無くしても同じ選択が負ける。手で追った。"},
    {"seed": 738, "index": 226, "bays": 3, "id": "boundary", "title": "両方を含む境界", "kind": "境界",
     "note": "1つ目の判断（D の v7 か v5）は遮断が本質: v7 を使うと残った v5 が A の v3 の出口を塞ぐ。"
             "2つ目の判断（C を掘る側）は列だけ: B の v1 を掘ると B の受付まで待機が続き枠が溢れる。手で追った。"},
    {"seed": 738, "index": 346, "bays": 4, "id": "counter", "title": "掘る側の選択が列で決まる反例", "kind": "反例",
     "note": "上下だけが開く盤面で、D の v1 を上の C（v2）と下の B（v4）のどちらから掘るか。選択肢は遮断から生じるが、"
             "勝ち負けは掘った車の色がいつ受け付けられるかで決まり、遮断を無くしても負けは変わらないので「列だけ」に数える。"
             "遮断が選択肢を作っても、分類は遮断が本質とは判定しない例。最初の局面だけ手で追った。"},
)


def build_examples() -> list[dict[str, object]]:
    entries = []
    for spec in EXAMPLES:
        record = survey_one((spec["seed"], spec["index"]))
        problem = PassengerProblem.from_json(record["problem"])
        entries.append(example_entry(spec["id"], spec["title"], spec["kind"], problem, spec["bays"], spec["note"]))
    return entries


def load_json(path: str):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def compact_json(value, indent: int = 0, width: int = 160) -> str:
    """Indented JSON that keeps any value fitting in `width` columns on one line."""
    pad = " " * indent
    inline = json.dumps(value, ensure_ascii=False)
    if not isinstance(value, (dict, list)) or len(pad) + len(inline) <= width:
        return inline
    if isinstance(value, dict):
        items = [f"{pad} {json.dumps(k, ensure_ascii=False)}: {compact_json(v, indent + 1, width)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    items = [f"{pad} {compact_json(v, indent + 1, width)}" for v in value]
    return "[\n" + ",\n".join(items) + f"\n{pad}]"


def accepted_contents(supplies: list[dict[str, object]]) -> dict[str, object]:
    """What accepted problems are made of, per target, over all seeds and generators."""
    groups = defaultdict(list)
    for supply in supplies:
        for a in supply["attempts"]:
            if a["accepted"]:
                groups[a["target"]].append(a)
    result = {}
    for target, accepted in sorted(groups.items()):
        kinds = Counter()
        for a in accepted:
            kinds.update(a["features"]["kinds"])
        losing = sum(kinds.values())
        result[target] = {
            "accepted": len(accepted),
            "kindShare": {k: share(v, losing) for k, v in sorted(kinds.items())},
            "twinSameLengthShare": share(sum(a["features"]["twinSameLength"] for a in accepted), kinds["twin"]),
            "withDecisionWithoutBlocking": share(sum(a["features"]["freeDecisions"] > 0 for a in accepted), len(accepted)),
            "byLongShare": dict(sorted(Counter(str(a["longShare"]) for a in accepted).items())),
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
    examples = sub.add_parser("examples")
    examples.add_argument("--output", required=True)
    digest = sub.add_parser("digest")
    digest.add_argument("--surveys", nargs="*", default=[])
    digest.add_argument("--supplies", nargs="*", default=[])
    digest.add_argument("--levels")
    digest.add_argument("--examples")
    digest.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "survey":
        data = run_survey(args.seed, args.count, args.workers)
    elif args.command == "supply":
        data = run_supply(args.seed, args.generators.split(","), args.targets.split(","), args.seconds, args.workers,
                          json.loads(args.fixed))
    elif args.command == "examples":
        data = build_examples()
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
        if args.levels:
            data["tentativeLevels"] = load_json(args.levels)
        if args.examples:
            data["examples"] = {e["id"]: {"kind": e["kind"], "bays": e["bayCount"], "solutions": e["solutions"],
                                          "kMin": e["kMin"], "kMinWithoutBlocking": e["kMinWithoutBlocking"],
                                          **{k: e["features"][k] for k in ("decisions", "essentialDecisions",
                                                                           "queueDecisions", "kinds", "distanceMax")}}
                                for e in load_json(args.examples)}
    with open(args.output, "w", encoding="utf-8") as handle:
        if args.command == "digest":
            handle.write(compact_json(data))
        else:
            json.dump(data, handle, ensure_ascii=False, indent=1 if args.command in ("levels", "examples") else None)
        handle.write("\n")


if __name__ == "__main__":
    main()
