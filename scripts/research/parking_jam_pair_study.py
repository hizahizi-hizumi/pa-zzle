"""Measurements for the same-color pair rule (#740): survey, hill climbing, rule variant, examples.

Usage (from scripts/research):
    python3 parking_jam_pair_study.py survey --seed 740 --count 300 --output <survey.json>
    python3 parking_jam_pair_study.py climb --seed 740 --seconds 240 --output <climb.json>
    python3 parking_jam_pair_study.py variant --seed 740 --count 300 --output <variant.json>
    python3 parking_jam_pair_study.py digest <survey.json> <climb.json> <variant.json> --output parking_jam_pair.expected.json
    python3 parking_jam_pair_study.py frontend-cases --output <cases.json>
    python3 parking_jam_pair_study.py examples --climb <climb.json> --output parking_jam_pair_examples.json
"""
from __future__ import annotations

import argparse
import json
import random
import time
from collections import Counter, defaultdict
from itertools import pairwise
from multiprocessing import Pool

from parking_jam_dispatch_reading import OPENINGS_BY_NAME, unblocked_sides
from parking_jam_pair_reading import (
    PairProblem,
    PairReading,
    color_dependencies,
    minimum_bays,
    move_decisions,
    random_problem,
)
from parking_jam_rule_space import positions

CARS = (8, 10, 12)
BAYS = (2, 3, 4)
OPENINGS = tuple(sorted(OPENINGS_BY_NAME))


def features(problem: PairProblem, bays: int, k_min: int) -> dict[str, object]:
    game = problem.game(bays)
    summary = PairReading(game).summary()
    detail = summary.pop("detail")
    moves = move_decisions(game)
    losing = [o for d in detail for o in d["losingOptions"]]
    essential = [o for d in detail if not d["freeAction"] for o in d["losingOptions"]]
    return {
        "bays": bays, "slack": bays - k_min, "solutions": game.solution_count(), **summary,
        "moveStates": moves["states"], "moveDecisionStates": moves["decisionStates"],
        "losingMoves": moves["losingMoves"], "losingMovesByExitsMax": moves["exitsMaxHistogram"],
        "distances": [o["distanceMax"] for o in losing],
        "essentialDistances": [o["distanceMax"] for o in essential],
        "essentialExits": [o["exitsMax"] for o in essential],
        "essentialHeld": [o["held"] for o in essential],
        "essentialWaiting": [d["waiting"] for d in detail if not d["freeAction"]],
    }


def survey_one(args: tuple[int, int, str, int, int | None]) -> dict[str, object]:
    seed, cars, opening, per_color, group = args
    rng = random.Random(seed)
    problem = random_problem(rng, cars, opening, per_color, group=group)
    k_min = problem.minimum_bays()
    return {
        "cars": cars, "opening": opening, "kMin": k_min,
        "kMinUnblocked": minimum_bays(unblocked_sides(cars), problem.colors, group),
        "dependencies": color_dependencies(problem),
        "problem": problem.to_json(),
        "rows": [features(problem, bays, k_min) for bays in BAYS if bays >= k_min],
    }


def run_survey(seed: int, count: int, per_color: int, group: int | None, workers: int) -> list[dict[str, object]]:
    tasks = [(seed * 1_000_003 + cars * 7919 + OPENINGS.index(opening) * 104729 + index, cars, opening, per_color,
              group)
             for cars in CARS for opening in OPENINGS for index in range(count)]
    with Pool(workers) as pool:
        return pool.map(survey_one, tasks, chunksize=8)


def share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def quantiles(values: list[float]) -> list[float] | None:
    if not values:
        return None
    ordered = sorted(values)
    return [ordered[int(q * (len(ordered) - 1))] for q in (0.5, 0.9, 1.0)]


def survey_digest(records: list[dict[str, object]]) -> dict[str, object]:
    k_min = defaultdict(Counter)
    k_min_opening = defaultdict(Counter)
    for r in records:
        k_min[f"{r['cars']}"][str(r["kMin"])] += 1
        k_min_opening[r["opening"]][str(r["kMin"])] += 1
    cells = {}
    grouped = defaultdict(list)
    for r in records:
        for row in r["rows"]:
            if row["slack"] <= 1:
                grouped[(row["bays"], row["slack"])].append((r, row))
    for (bays, slack), items in sorted(grouped.items()):
        rows = [row for _, row in items]
        by_cars = {}
        for cars in CARS:
            sub = [row for r, row in items if r["cars"] == cars]
            by_cars[str(cars)] = {"problems": len(sub),
                                  "withDecision": share(sum(x["decisions"] > 0 for x in sub), len(sub)),
                                  "withEssential": share(sum(x["essentialDecisions"] > 0 for x in sub), len(sub))}
        by_opening = {}
        for opening in OPENINGS:
            sub = [row for r, row in items if r["opening"] == opening]
            by_opening[opening] = {"problems": len(sub),
                                   "withEssential": share(sum(x["essentialDecisions"] > 0 for x in sub), len(sub))}
        exits = Counter()
        for row in rows:
            for span, n in row["losingMovesByExitsMax"].items():
                exits[min(int(span), 5)] += n
        moves_total = sum(exits.values())
        ess_exits = Counter(min(e, 5) for row in rows for e in row["essentialExits"])
        kinds = Counter()
        ess_kinds = Counter()
        for row in rows:
            kinds.update(row["kinds"])
            ess_kinds.update(row["essentialKinds"])
        losing = sum(row["losingOptions"] for row in rows)
        cells[f"{bays}bays/slack{slack}"] = {
            "problems": len(rows),
            "withMoveDecision": share(sum(x["moveDecisionStates"] > 0 for x in rows), len(rows)),
            "withDelayedLosingMove": share(sum(any(int(k) >= 3 for k in x["losingMovesByExitsMax"]) for x in rows),
                                           len(rows)),
            "withDecision": share(sum(x["decisions"] > 0 for x in rows), len(rows)),
            "withEssential": share(sum(x["essentialDecisions"] > 0 for x in rows), len(rows)),
            "essentialCount": dict(sorted(Counter(min(x["essentialDecisions"], 4) for x in rows).items())),
            "byCars": by_cars,
            "byOpening": by_opening,
            "losingMovesExitsMax": {str(k): share(v, moves_total) for k, v in sorted(exits.items())},
            "losingMoves": moves_total,
            "essentialLosingExitsMax": {str(k): share(v, sum(ess_exits.values())) for k, v in sorted(ess_exits.items())},
            "essentialDistanceDeparturesMax": dict(sorted(Counter(d for x in rows for d in x["essentialDistances"]).items())),
            "essentialHeld": dict(sorted(Counter(h for x in rows for h in x["essentialHeld"]).items())),
            "essentialWaitingBefore": dict(sorted(Counter(w for x in rows for w in x["essentialWaiting"]).items())),
            "losingPlanKinds": dict(kinds),
            "essentialLosingPlanKinds": dict(ess_kinds),
            "blockingDecides": share(sum(x["blockingDecides"] for x in rows), losing),
            "widerWins": share(sum(x["widerWins"] for x in rows), losing),
            "solutionsMedian": quantiles([x["solutions"] for x in rows]),
        }
    deps = defaultdict(list)
    for r in records:
        zero = next((row for row in r["rows"] if row["slack"] == 0), None)
        if zero is None:
            continue
        deps[(r["dependencies"]["longestChain"], r["dependencies"]["cyclicColors"] > 0)].append((r["kMin"], zero))
    dependency_table = {
        f"chain{chain}/{'cycle' if cyc else 'acyclic'}": {
            "problems": len(items),
            "kMin": dict(sorted(Counter(k for k, _ in items).items())),
            "withEssential": share(sum(z["essentialDecisions"] > 0 for _, z in items), len(items)),
            "essentialMean": round(sum(z["essentialDecisions"] for _, z in items) / len(items), 3),
        }
        for (chain, cyc), items in sorted(deps.items())
    }
    return {"problems": len(records), "kMinByCars": {c: dict(sorted(v.items())) for c, v in sorted(k_min.items())},
            "kMinByOpening": {o: dict(sorted(v.items())) for o, v in sorted(k_min_opening.items())},
            "kMinUnblocked": dict(Counter(str(r["kMinUnblocked"]) for r in records)),
            "cells": cells, "dependencies": dependency_table}


def depth_score(problem: PairProblem, bays_options=(3, 4)) -> tuple[tuple, dict[str, object] | None]:
    """Hill-climbing objective at zero slack: essential decisions, then their distance."""
    k_min = problem.minimum_bays()
    if k_min is None or k_min not in bays_options:
        return ((-1, 0, 0), None)
    row = features(problem, k_min, k_min)
    return ((row["essentialDecisions"], max(row["essentialDistances"], default=0),
             max(row["essentialExits"], default=0)), row)


def mutate(rng: random.Random, problem: PairProblem, pool) -> PairProblem | None:
    colors = list(problem.colors)
    vehicles = list(problem.vehicles)
    if rng.random() < 0.5:
        i, j = rng.sample(range(len(colors)), 2)
        colors[i], colors[j] = colors[j], colors[i]
    else:
        i = rng.randrange(len(vehicles))
        others = 0
        for j, v in enumerate(vehicles):
            if j != i:
                others |= v.occupancy
        options = [v for v in pool if not v.occupancy & others]
        if not options:
            return None
        vehicles[i] = rng.choice(options)
    candidate = PairProblem(tuple(vehicles), problem.size, problem.openings, colors)
    if candidate.minimum_bays() is None:
        return None
    return candidate


def climb_one(args: tuple[int, int, str, float]) -> list[dict[str, object]]:
    seed, cars, opening, seconds = args
    rng = random.Random(seed)
    results = []
    end = time.process_time() + seconds
    while time.process_time() < end:
        problem = random_problem(rng, cars, opening)
        pool = positions(problem.size)
        score, row = depth_score(problem)
        steps = 0
        for _ in range(150):
            candidate = mutate(rng, problem, pool)
            if candidate is None:
                continue
            steps += 1
            new_score, new_row = depth_score(candidate)
            if new_score >= score:
                problem, score, row = candidate, new_score, new_row
            if time.process_time() >= end:
                break
        if row is not None:
            results.append({"cars": cars, "opening": opening, "score": list(score), "kMin": row["bays"],
                            "dependencies": color_dependencies(problem), "problem": problem.to_json(),
                            "row": {k: v for k, v in row.items() if k != "losingMovesByExitsMax"}})
    return results


def run_climb(seed: int, seconds: float, workers: int) -> list[dict[str, object]]:
    tasks = [(seed * 1009 + i, cars, opening, seconds / (len(CARS) * len(OPENINGS)) * workers)
             for i, (cars, opening) in enumerate((c, o) for c in CARS for o in OPENINGS)]
    with Pool(workers) as pool:
        return [item for chunk in pool.map(climb_one, tasks) for item in chunk]


def climb_digest(items: list[dict[str, object]]) -> dict[str, object]:
    def lv(row) -> str:
        e = row["essentialDecisions"]
        d = max(row["essentialExits"], default=0)
        if e >= 3 and d >= 3:
            return "decisions>=3,exits>=3"
        if e >= 2 and d >= 3:
            return "decisions>=2,exits>=3"
        if e >= 1:
            return "decisions>=1"
        return "none"

    by = defaultdict(Counter)
    for item in items:
        by[f"{item['cars']}/{item['opening']}"][lv(item["row"])] += 1
    best = sorted(items, key=lambda x: x["score"], reverse=True)[:5]
    return {
        "climbs": len(items),
        "reached": {k: dict(v) for k, v in sorted(by.items())},
        "reachedTotal": dict(Counter(lv(i["row"]) for i in items)),
        "kMin": dict(Counter(i["kMin"] for i in items)),
        "essentialDecisionsMax": max((i["row"]["essentialDecisions"] for i in items), default=0),
        "best": [{"cars": b["cars"], "opening": b["opening"], "score": b["score"], "kMin": b["kMin"],
                  "dependencies": b["dependencies"],
                  "essentialKinds": b["row"]["essentialKinds"], "essentialHeld": b["row"]["essentialHeld"],
                  "widerWins": b["row"]["widerWins"], "losingOptions": b["row"]["losingOptions"]} for b in best],
    }


def frontend_cases(seed: int, count: int) -> list[dict[str, object]]:
    """Random small problems with the exact solution count and the first exits that can still win."""
    rng = random.Random(seed)
    cases = []
    while len(cases) < count:
        problem = random_problem(rng, rng.choice((6, 8)), rng.choice(OPENINGS), size=6)
        k_min = problem.minimum_bays()
        bays = rng.choice([b for b in BAYS if b >= k_min - 1])
        game = problem.game(bays)
        cases.append({
            "bayCount": bays, "board": problem.frontend_board(), "solutions": game.solution_count(),
            "exits": {f"v{i}": game.wins(game.full & ~(1 << i)) for i in game.moves(game.full)},
        })
    return cases


def plan_order(game, start: int, goal: int) -> list[int]:
    """A safe exit order that removes exactly start & ~goal."""
    order = []
    while start != goal:
        car = next(i for i in game.safe_moves(start) if not goal >> i & 1
                   and game.can_reach(start & ~(1 << i), goal))
        order.append(car)
        start &= ~(1 << car)
    return order


def winning_tail(game, state: int) -> list[int]:
    """Exits that finish the run from a winning state, completing free pairs first."""
    order = []
    while state:
        moves = [i for i in game.safe_moves(state) if game.wins(state & ~(1 << i))]
        car = next((i for i in moves if game.completes(state, i)), moves[0])
        order.append(car)
        state &= ~(1 << car)
    return order


def losing_tail(game, state: int) -> list[int]:
    """The longest run of safe exits from a losing state before no safe exit remains."""
    order = []
    while game.safe_moves(state):
        car = max(game.safe_moves(state), key=lambda i: game.exit_span(state & ~(1 << i))[1])
        order.append(car)
        state &= ~(1 << car)
    return order


def explain(problem: PairProblem, bays: int, decisions: int = 2) -> dict[str, object]:
    game = problem.game(bays)
    reading = PairReading(game)
    summary = reading.summary()
    parents = {game.full: None}
    for state in reading.path():
        if state == 0:
            continue
        winners = [g for g in reading.natural(state) if game.wins(g)] or [
            g for g in game.plans(state) if game.wins(g)]
        for g in winners:
            parents.setdefault(g, state)

    def prefix(target: int) -> list[int]:
        chain = [target]
        while parents[chain[-1]] is not None:
            chain.append(parents[chain[-1]])
        chain.reverse()
        return [car for a, b in pairwise(chain) for car in plan_order(game, a, b)]

    def names(cars):
        return [f"v{i}" for i in cars]

    explained = []
    for item in [d for d in summary["detail"] if not d["freeAction"]][:decisions]:
        state = item["state"]
        options = []
        for goal in reading.natural(state):
            exits = plan_order(game, state, goal)
            wins = game.wins(goal)
            options.append({
                "exits": names(exits), "color": game.plan_color(state, goal), "wins": wins,
                "continuation": names(winning_tail(game, goal) if wins else losing_tail(game, goal)),
                "waitingAfter": game.waiting_colors(goal),
            })
        explained.append({"before": names(prefix(state)), "waiting": game.waiting_colors(state),
                          "departed": item["departed"], "options": options,
                          "losing": item["losingOptions"]})
    summary.pop("detail")
    return {"summary": summary, "decisions": explained}


def example_entry(identifier: str, title: str, kind: str, problem: PairProblem, bays: int,
                  note: str) -> dict[str, object]:
    game = problem.game(bays)
    explained = explain(problem, bays)
    return {
        "id": identifier, "title": title, "kind": kind, "bayCount": bays,
        "solutions": game.solution_count(), "queue": [], "board": problem.frontend_board(),
        "kMin": problem.minimum_bays(), "features": explained["summary"],
        "moveDecisions": move_decisions(game), "dependencies": color_dependencies(problem),
        "firstDecisions": explained["decisions"],
        "solution": [f"v{i}" for i in winning_tail(game, game.full)],
        "diagram": problem.diagram(), "note": note,
    }


def compact_problem(size: int, openings: list[str], cars: list[tuple]) -> PairProblem:
    orientation = {"h": "horizontal", "v": "vertical"}
    return PairProblem.from_json({"size": size, "openings": openings, "vehicles": [
        {"row": r, "column": c, "orientation": orientation[o], "length": n, "color": color}
        for r, c, o, n, color in cars]})


EXAMPLES = (
    ("two-bays", "2枠：判断が無い", "限界", 2, compact_problem(7, ["right", "top"], [
        (4, 5, "v", 3, "B"), (2, 4, "h", 2, "B"), (0, 6, "v", 3, "C"), (2, 3, "v", 3, "D"), (0, 3, "v", 2, "A"),
        (1, 0, "v", 3, "C"), (3, 5, "h", 2, "D"), (2, 2, "v", 2, "A")]),
     ("最小枠数2。2枠では1台待たせたら次は相方しか出せないので、出せるペアを順に出すだけで解ける。"
     "ペアの順は勝ち負けに関係しない。負ける手は、相方 v3 が A の v4 に塞がれている D の v6 を先に出す手などで、"
     "出した瞬間に次の手が無くなる（その後に出せる車は0台）。手で追った。")),
    ("lure-only", "3枠：負ける手は理由の無い保留だけ", "限界", 3, compact_problem(6, ["right", "top"], [
        (5, 0, "h", 3, "B"), (4, 3, "v", 2, "D"), (2, 3, "v", 2, "C"), (0, 3, "h", 3, "D"), (5, 4, "h", 2, "A"),
        (0, 1, "v", 3, "C"), (1, 2, "v", 3, "A"), (0, 0, "v", 2, "B")]),
     ("最小枠数3・余裕0。B の相方 v0 は D の v1 と A の v4 に塞がれ、v1 は C の v2 と D の v3 に塞がれる。"
     "勝ち筋は v3 と v2 を待たせて v1 を出し（D 出発）、v5 で C を出発させ、A、B と片付ける。"
     "負ける手は、すぐ出せる B の v7 を早く出す1種類だけで、B が1枠を占めたまま D と C を同時に待たせられず、"
     "最大3手後に詰む。1色をそろえる最短の出し方だけを考える読み手は v7 を選ばないので、判断局面は0。手で追った。")),
    ("one-decision", "3枠：判断1つ（典型）", "代表", 3, compact_problem(7, ["right", "top"], [
        (4, 5, "v", 3, "B"), (1, 3, "h", 3, "A"), (1, 6, "v", 3, "D"), (0, 5, "h", 2, "B"), (2, 1, "v", 3, "C"),
        (0, 1, "v", 2, "A"), (0, 0, "v", 3, "D"), (1, 2, "v", 3, "C")]),
     ("最小枠数3・余裕0。初手で、D をそろえる（B の v3 を待たせて v2、v6）か、C をそろえる（A の v5 を待たせて v4、v7）かを選ぶ。"
     "C を先にすると A の v5 が枠に残る。A の相方 v1 は D の v2 に、v2 は B の v3 に塞がれているので、"
     "v3 と v2 を待たせると3枠が埋まり、1手で詰む。D を先にすれば待つのは B の v3 だけで、v1、v0、v5 と順に片付く。"
     "無作為な問題で見つかる判断は、ほぼすべてこの形（待機0台の局面で、2台を待たせる2通りの掘り方のどちらを先にするか、1色出発後に詰む）。手で追った。")),
    ("deepest", "最も深い問題（山登り）", "上限", 4, compact_problem(8, ["right", "top"], [
        (4, 3, "v", 3, "A"), (1, 2, "h", 3, "E"), (2, 4, "h", 3, "A"), (7, 0, "h", 3, "D"), (3, 5, "h", 2, "F"),
        (7, 4, "h", 3, "C"), (1, 0, "v", 3, "E"), (4, 0, "h", 3, "C"), (0, 6, "v", 2, "B"), (2, 2, "h", 2, "F"),
        (2, 1, "v", 2, "D"), (6, 0, "h", 2, "B")]),
     ("12台・最小枠数4・余裕0。山登り689回で判断局面3に届いた唯一の問題。D の v3 は C の v5 に塞がれ、"
      "C の相方 v7 は A の v0 に、v0 は E の v1 と F の v9 に、v1 は B の v8 に、v9 は A の v2 に塞がれる。"
      "勝ち筋は F（v2 を待たせる）、E（v8 を待たせる）を先に出発させて v0 を出し、A、B、C、D の順に片付く。"
      "3つの判断局面はどれも「D を先にそろえるか」で、D を先にすると C の v5 が1枠を占めたまま、"
      "v0 を掘るのに B・E・A・F を同時に待たせる必要が出て、2色出発した後に詰む。判断は3回あるが、読む内容は1つ。手で追った。")),
)


def build_examples() -> list[dict[str, object]]:
    return [example_entry(identifier, title, kind, problem, bays, note)
            for identifier, title, kind, bays, problem, note in EXAMPLES]


def load_json(path: str):
    with open(path) as source:
        return json.load(source)


def write_json(path: str, value, indent: int | None = None) -> None:
    with open(path, "w") as target:
        json.dump(value, target, ensure_ascii=False, indent=indent)
        target.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("survey")
    s.add_argument("--seed", type=int, default=740)
    s.add_argument("--count", type=int, default=300)
    s.add_argument("--per-color", type=int, default=2)
    s.add_argument("--group", type=int, default=None, help="cars of a color that depart together (default: all)")
    s.add_argument("--workers", type=int, default=4)
    s.add_argument("--output", required=True)
    c = sub.add_parser("climb")
    c.add_argument("--seed", type=int, default=740)
    c.add_argument("--seconds", type=float, default=240)
    c.add_argument("--workers", type=int, default=4)
    c.add_argument("--output", required=True)
    f = sub.add_parser("frontend-cases")
    f.add_argument("--seed", type=int, default=740)
    f.add_argument("--count", type=int, default=40)
    f.add_argument("--output", required=True)
    e = sub.add_parser("examples")
    e.add_argument("--output", required=True)
    d = sub.add_parser("digest")
    d.add_argument("survey")
    d.add_argument("climb")
    d.add_argument("variants", nargs="+", help="variant surveys")
    d.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "survey":
        begun = time.time()
        records = run_survey(args.seed, args.count, args.per_color, args.group, args.workers)
        write_json(args.output, {"seed": args.seed, "perColor": args.per_color, "group": args.group,
                                 "wall": time.time() - begun, "records": records})
    elif args.command == "climb":
        write_json(args.output, {"seed": args.seed, "cpuSeconds": args.seconds * args.workers,
                                 "items": run_climb(args.seed, args.seconds, args.workers)})
    elif args.command == "frontend-cases":
        write_json(args.output, frontend_cases(args.seed, args.count))
    elif args.command == "examples":
        write_json(args.output, build_examples(), indent=1)
    elif args.command == "digest":
        survey = load_json(args.survey)
        climb = load_json(args.climb)
        climbed = climb_digest(climb["items"])
        climbed["reachedPerCpuMinute"] = {k: round(v / (climb["cpuSeconds"] / 60), 3)
                                          for k, v in climbed["reachedTotal"].items()}
        out = {"survey": {"seed": survey["seed"], **survey_digest(survey["records"])},
               "climb": {"seed": climb["seed"], "cpuSeconds": climb["cpuSeconds"], **climbed},
               "variants": {}}
        for path in args.variants:
            variant = load_json(path)
            name = f"perColor{variant['perColor']}/group{variant['group'] or 'all'}"
            out["variants"][name] = {"seed": variant["seed"], **survey_digest(variant["records"])}
        write_json(args.output, out, indent=1)


if __name__ == "__main__":
    main()
