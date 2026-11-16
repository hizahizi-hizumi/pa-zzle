"""Measure (k_min, slack, H*) and naive-solver win rates over dispatch candidate spaces (#738)."""
from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from collections import Counter
from multiprocessing import Pool

from parking_jam_dispatch_reading import (
    BOARD_SHAPES,
    OPENINGS_BY_NAME,
    DispatchGame,
    Problem,
    board_features,
    decision_features,
    distinct_colors,
    first_branch,
    generate_board,
    geometric_canonical,
    minimum_bays,
    order_request,
    pair_colors,
    reading_profile,
    shuffled_request,
    side_blockers,
    structural_canonical,
)

BOARDS = BOARD_SHAPES
OPENINGS = OPENINGS_BY_NAME
COLOR_MODES = {"pairs": pair_colors, "distinct": distinct_colors}
MAX_HORIZON = 5
NAIVE = ("uniform", "head-first", "fewest-blockers")


def seeded(*parts: object) -> random.Random:
    return random.Random(":".join(map(str, parts)))


def h_bucket(h: int | None) -> str:
    return "5+" if h is None or h >= 5 else str(h)


def h_star_only(game: DispatchGame) -> int | None:
    return next((h for h in range(1, MAX_HORIZON + 1) if game.chunked(game.full, h)[0]), None)


def evaluate(problem: Problem, slack: int, k_min: int, free_k_min: int) -> dict[str, object]:
    bays = k_min + slack
    begun = time.perf_counter()
    game = problem.game(bays)
    profile = reading_profile(game, MAX_HORIZON)
    h_star = profile.h_star
    free = problem.game(bays, geometry=False)
    record = {
        "slack": slack,
        "bays": bays,
        "kMin": k_min,
        "hStar": h_star,
        "rollingHStar": profile.rolling_h_star,
        "pH": {h: round(profile.chunked_probability[h], 6) for h in range(1, 5)},
        "nonMonotoneChunked": profile.non_monotone(profile.chunked_always),
        "nonMonotoneRolling": profile.non_monotone(profile.rolling_always),
        "naive": {policy: round(game.win_probability(policy), 6) for policy in NAIVE},
        "decision": decision_features(game, h_star) if h_star else None,
        "freeKMin": free_k_min,
        "freeHStar": h_star_only(free),
        "structural": repr(structural_canonical(problem.sides, problem.colors, problem.request) + (bays,)),
    }
    record["seconds"] = time.perf_counter() - begun
    return record


def climb(problem: Problem, slack: int, budget: int, rng: random.Random, k_floor: int = 1) -> tuple[Problem, int]:
    """Hill-climb request swaps and color swaps toward min(k_min, k_floor), then H*, then a lower fewest-blockers win rate."""

    def score(candidate: Problem) -> tuple[int, float]:
        k_min = minimum_bays(candidate.sides, candidate.colors, candidate.request)
        game = candidate.game(k_min + slack)
        h_star = h_star_only(game)
        return (min(k_min, k_floor), h_star or MAX_HORIZON + 1, -game.win_probability("fewest-blockers"))

    best = problem
    best_score = score(best)
    evaluations = 1
    n = len(problem.colors)
    while evaluations < budget:
        request = list(best.request)
        colors = list(best.colors)
        i, j = rng.sample(range(n), 2)
        if rng.random() < 0.5:
            request[i], request[j] = request[j], request[i]
        else:
            colors[i], colors[j] = colors[j], colors[i]
        if request == best.request and colors == best.colors:
            continue
        candidate = Problem(best.vehicles, best.size, best.openings, colors, request)
        candidate_score = score(candidate)
        evaluations += 1
        if candidate_score >= best_score:
            best, best_score = candidate, candidate_score
    return best, evaluations


def run_board(task: tuple) -> list[dict[str, object]]:
    seed, n, size, opening, index, request_modes, climb_budget, k_floor = task
    board = generate_board(seeded(seed, "board", n, size, opening, index), n, size, OPENINGS[opening])
    records = []
    for color_mode, make_colors in COLOR_MODES.items():
        colors = make_colors(seeded(seed, "colors", n, size, opening, index, color_mode), n)
        for request_mode in request_modes:
            rng = seeded(seed, "request", n, size, opening, index, color_mode, request_mode)
            base = Problem(board, size, OPENINGS[opening], colors,
                           order_request(rng, side_blockers(board, OPENINGS[opening]), colors)
                           if request_mode == "order" else shuffled_request(rng, colors))
            for slack in (0, 1):
                begun = time.perf_counter()
                problem, evaluations = (climb(base, slack, climb_budget, rng, k_floor) if request_mode == "climb" else (base, 0))
                climb_seconds = time.perf_counter() - begun
                k_min = minimum_bays(problem.sides, problem.colors, problem.request)
                free = problem.game(1, geometry=False)
                free_k_min = minimum_bays(free.sides, problem.colors, problem.request)
                record = evaluate(problem, slack, k_min, free_k_min)
                record.update({
                    "condition": f"{n}cars-{size}x{size}",
                    "opening": opening,
                    "colorMode": color_mode,
                    "requestMode": request_mode,
                    "board": index,
                    "climbEvaluations": evaluations,
                    "climbSeconds": climb_seconds,
                    "boardFeatures": board_features(problem.sides),
                    "geometric": repr(geometric_canonical(board, size, problem.openings, problem.colors, problem.request)
                                      + (record["bays"],)),
                    "problem": problem.to_json(),
                })
                records.append(record)
    return records


def summarize(records: list[dict[str, object]]) -> dict[str, object]:
    joint = Counter(f"kMin={r['kMin']},slack={r['slack']},H*={h_bucket(r['hStar'])}" for r in records)
    decisions = [r["decision"] for r in records if r["decision"]]
    kinds = Counter()
    state_kinds = Counter()
    for d in decisions:
        kinds.update(d["losingChoicesByKind"])
        state_kinds.update(d["decisionStatesByKind"])

    def quantiles(values: list[float]) -> dict[str, float]:
        ordered = sorted(values)
        def pick(q: float) -> float:
            return ordered[min(len(ordered) - 1, int(q * len(ordered)))]

        return {"mean": round(statistics.fmean(ordered), 4), "p10": pick(0.1), "p25": pick(0.25),
                "median": pick(0.5), "p75": pick(0.75), "p90": pick(0.9)}

    return {
        "problems": len(records),
        "joint": dict(sorted(joint.items())),
        "kMin": dict(sorted(Counter(r["kMin"] for r in records).items())),
        "hStar": dict(sorted(Counter(h_bucket(r["hStar"]) for r in records).items())),
        "kMinAtLeast3AndHStarAtLeast2": sum(r["kMin"] >= 3 and (r["hStar"] or 9) >= 2 for r in records),
        "kMin1": sum(r["kMin"] == 1 for r in records),
        "naive": {p: quantiles([r["naive"][p] for r in records]) for p in NAIVE},
        "meanPH": {h: round(statistics.fmean(r["pH"][h] for r in records), 4) for h in range(1, 5)},
        "rollingDisagrees": sum(r["hStar"] != r["rollingHStar"] for r in records),
        "rollingHStar": dict(sorted(Counter(h_bucket(r["rollingHStar"]) for r in records).items())),
        "nonMonotoneChunked": sum(bool(r["nonMonotoneChunked"]) for r in records),
        "nonMonotoneRolling": sum(bool(r["nonMonotoneRolling"]) for r in records),
        "decision": {
            "problemsWithDecision": sum(d["decisionStates"] > 0 for d in decisions),
            "meanDecisionStates": round(statistics.fmean(d["decisionStates"] for d in decisions), 3) if decisions else 0,
            "meanLosingShare": round(statistics.fmean(d["losingShare"] for d in decisions if d["decisionStates"]), 4)
            if any(d["decisionStates"] for d in decisions) else None,
            "losingChoicesByKind": dict(kinds),
            "decisionStatesByKind": dict(state_kinds),
        },
        "counterfactualNoBlocking": {
            "meanKMin": round(statistics.fmean(r["kMin"] for r in records), 3),
            "meanFreeKMin": round(statistics.fmean(r["freeKMin"] for r in records), 3),
            "kMinDrops": sum(r["freeKMin"] < r["kMin"] for r in records),
            "freeHStar": dict(sorted(Counter(h_bucket(r["freeHStar"]) for r in records).items())),
            "hStarDrops": sum((r["freeHStar"] or 9) < (r["hStar"] or 9) for r in records),
            "hStarRises": sum((r["freeHStar"] or 9) > (r["hStar"] or 9) for r in records),
        },
        "board": {key: round(statistics.fmean(r["boardFeatures"][key] for r in records), 3)
                  for key in ("initiallyBlocked", "maxUnblockCost", "meanUnblockCost")},
        "distinctGeometric": len({r["geometric"] for r in records}),
        "distinctStructural": len({r["structural"] for r in records}),
        "meanEvaluationSeconds": round(statistics.fmean(r["seconds"] for r in records), 4),
        "meanClimbSeconds": round(statistics.fmean(r["climbSeconds"] for r in records), 3),
    }


def example(record: dict[str, object]) -> dict[str, object]:
    spec = record["problem"]
    problem = Problem.from_json(spec)
    game = problem.game(record["bays"])
    return {
        key: record[key] for key in ("condition", "opening", "colorMode", "requestMode", "board", "bays", "kMin",
                                     "hStar", "rollingHStar", "naive", "pH")
    } | {"problem": spec, "diagram": problem.diagram(),
         "firstBranch": first_branch(game, record["hStar"]) if record["hStar"] else None}


def run(seed: int, boards: int, climb_boards: int, climb_budget: int, workers: int,
        k_floor: int = 1) -> tuple[dict, list]:
    tasks = []
    for n, size in BOARDS:
        for opening in OPENINGS:
            for index in range(boards):
                modes = ("order", "shuffled", "climb") if index < climb_boards else ("order", "shuffled")
                tasks.append((seed, n, size, opening, index, modes, climb_budget, k_floor))
    begun = time.perf_counter()
    with Pool(workers) as pool:
        records = [r for chunk in pool.map(run_board, tasks, chunksize=1) for r in chunk]
    elapsed = time.perf_counter() - begun
    groups: dict[str, list] = {}
    for r in records:
        key = " | ".join((r["condition"], r["opening"], r["colorMode"], r["requestMode"], f"slack{r['slack']}"))
        groups.setdefault(key, []).append(r)
    summary = {key: summarize(rows) for key, rows in groups.items()}
    candidates = sorted(
        (r for r in records if r["hStar"] is not None and r["hStar"] >= 3 and r["kMin"] >= 3),
        key=lambda r: (-r["hStar"], -r["kMin"], r["naive"]["fewest-blockers"]),
    )
    chosen, used = [], set()
    for r in candidates:
        key = (r["condition"], r["opening"])
        if key in used:
            continue
        used.add(key)
        chosen.append(example(r))
        if len(chosen) == 8:
            break
    return ({"seed": seed, "boardsPerCondition": boards, "climbBoards": climb_boards, "climbBudget": climb_budget,
             "climbKMinFloor": k_floor, "workers": workers, "elapsedSeconds": round(elapsed, 1), "maxHorizon": MAX_HORIZON,
             "summary": summary, "examples": chosen}, records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=738)
    parser.add_argument("--boards", type=int, default=100)
    parser.add_argument("--climb-boards", type=int, default=30)
    parser.add_argument("--climb-budget", type=int, default=200)
    parser.add_argument("--climb-k-floor", type=int, default=1,
                        help="climb toward k_min >= this before raising H*; 1 leaves the k_min term constant (no floor)")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--records", help="write every evaluated problem as JSON to this path")
    args = parser.parse_args()
    result, records = run(args.seed, args.boards, args.climb_boards, args.climb_budget, args.workers, args.climb_k_floor)
    if args.records:
        with open(args.records, "w", encoding="utf-8") as handle:
            json.dump(records, handle, ensure_ascii=False)
    print(json.dumps(result, ensure_ascii=False, indent=1))
