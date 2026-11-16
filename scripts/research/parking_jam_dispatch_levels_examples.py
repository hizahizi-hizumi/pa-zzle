"""List level-example candidates from measured records and export a chosen selection for the rule lab.

`candidates` ranks accepted problems per level (typical ones first, then boundary
cases); `explain` prints one problem's first decisions with the continuation that
overflows; `export` writes the hand-picked selection as rule-lab JSON.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics

from parking_jam_dispatch_levels import LEVEL_TABLES, NaturalReading, level_features, level_of, match
from parking_jam_dispatch_reading import Problem, exit_order, iter_bits, minimum_bays

FRONTEND_SIDE = {"top": "up", "right": "right", "bottom": "down", "left": "left"}
RESEARCH_SIDE = {v: k for k, v in FRONTEND_SIDE.items()}
FRONTEND_KEYS = ("id", "title", "level", "kind", "bayCount", "solutions", "queue", "board")


def load_rows(paths: list[str]) -> dict[str, dict[str, object]]:
    """Accepted rows keyed `seed:index`; two record files with the same seed are refused."""
    rows = {}
    seeds = set()
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        if data["seed"] in seeds:
            raise ValueError(f"two record files share seed {data['seed']}: {path}")
        seeds.add(data["seed"])
        for index, row in enumerate(data["rows"]):
            if row["accepted"]:
                rows[f"{data['seed']}:{index}"] = row
    return rows


def load(spec: dict[str, object]) -> Problem:
    return Problem.from_json(spec)


def from_example(example: dict[str, object]) -> Problem:
    """The research problem behind an exported example, keeping its car order and color names."""
    board = example["board"]
    return Problem.from_json({
        "size": board["width"],
        "openings": [RESEARCH_SIDE[o["side"]] for o in board["roadOpenings"]],
        "vehicles": board["vehicles"],
        "request": example["queue"],
    })


def relabel(problem: Problem, rng: random.Random) -> Problem:
    """Shuffle car order so ids do not reveal a solution; colors renamed by first request."""
    order = list(range(len(problem.colors)))
    rng.shuffle(order)
    names: dict[str, str] = {}
    for c in problem.request:
        names.setdefault(c, chr(65 + len(names)))
    return Problem(tuple(problem.vehicles[i] for i in order), problem.size, problem.openings,
                   [names[problem.colors[i]] for i in order], [names[c] for c in problem.request])


def candidates(rows: dict[str, dict[str, object]], per_kind: int) -> dict[str, list[dict[str, object]]]:
    keys = ("decisions", "distanceMax", "chainMax")
    result = {}
    for level in LEVEL_TABLES["v3"]:
        accepted = {k: r for k, r in rows.items() if r["level"] == level}
        if not accepted:
            continue
        medians = {k: statistics.median(r["features"][k] for r in accepted.values()) for k in keys}

        def typicality(item):
            features = item[1]["features"]
            return (sum(abs(features[k] - m) for k, m in medians.items()), features["cars"], features["solutions"])

        def brief(key, row):
            f = row["features"]
            return {"row": key, "generator": row["generator"], "opening": row["opening"],
                    **{k: f[k] for k in ("cars", "bays", "k_min", "decisions", "distanceMax", "reasons",
                                         "headFirst", "fewestBlockers", "solutions")},
                    "keepBuriedTwinLevel": row["comparison"].get("keepBuriedTwinLevel")}

        typical = sorted(accepted.items(), key=typicality)
        boundary = [(k, r) for k, r in accepted.items() if r["comparison"].get("keepBuriedTwinLevel") != level]
        neighbours = sorted(accepted.items(), key=lambda item: min(
            match(item[1]["features"], other)[2] for other in (level - 1, level + 1) if other in LEVEL_TABLES["v3"]))
        result[f"Lv{level}"] = {
            "typical": [brief(k, r) for k, r in typical[:per_kind]],
            "variantBoundary": [brief(k, r) for k, r in boundary[:per_kind]],
            "nearNeighbour": [brief(k, r) for k, r in neighbours[:per_kind]],
        }
    return result


def describe_state(problem: Problem, game, state: int) -> str:
    removed = [i for i in iter_bits(game.full & ~state)]
    served = game.progress(state)
    return (f"exited={removed} served={served} next={''.join(problem.request[served:served + 4])} "
            f"waiting={game.waiting(state)}")


def explain(problem: Problem, bays: int, limit: int = 3) -> list[str]:
    """First decisions: each natural plan, whether it wins, and the longest natural continuation of a loser."""
    game = problem.game(bays)
    reading = NaturalReading(game)
    lines = [problem.diagram(), "colors " + " ".join(f"{i}:{c}" for i, c in enumerate(problem.colors)),
             "request " + "".join(problem.request), f"bays {bays}"]
    summary = reading.summary()
    for decision in sorted(summary["detail"], key=lambda d: -d["state"].bit_count())[:limit]:
        state = decision["state"]
        lines.append(f"-- decision at {describe_state(problem, game, state)} reasons={decision['reasons']}"
                     f" distance={decision['distanceMin']}..{decision['distanceMax']}")
        lines.append(f"   reached by {exit_order(game, game.full, state)}")
        for goal in reading.natural(state):
            verdict = "wins" if game.wins(goal) else "loses"
            lines.append(f"   plan {exit_order(game, state, goal)} {verdict}")
            if not game.wins(goal):
                lines.extend("      " + step for step in longest_survival(problem, reading, goal))
    return lines


def longest_survival(problem: Problem, reading: NaturalReading, state: int) -> list[str]:
    game = reading.game
    steps = []
    while True:
        children = reading.natural(state)
        if not children:
            stuck = [i for i in iter_bits(state)]
            free = [i for i in game.geometric_moves(state)]
            steps.append(f"stuck: {describe_state(problem, game, state)} remaining={stuck} exitable={free}")
            return steps
        child = max(children, key=lambda g: reading.survival(g)[1])
        steps.append(f"then {exit_order(game, state, child)} -> {describe_state(problem, game, child)}")
        state = child


def entry(identifier: str, title: str, level: int, kind: str, problem: Problem, bays: int,
          generator: str, opening: str) -> dict:
    k_min = minimum_bays(problem.sides, problem.colors, problem.request)
    game = problem.game(bays)
    features = {k: v for k, v in level_features(problem, bays, k_min, reference=True).items() if k != "detail"}
    features["level"] = level_of(features)
    features["levelKeepingBuriedTwin"] = level_of(level_features(problem, bays, k_min, skip_buried_twin=False))
    features["solutionsOneBayFewer"] = problem.game(bays - 1).solution_count()
    features["generator"] = generator
    features["opening"] = opening
    reading = NaturalReading(game)
    detail = sorted(reading.summary()["detail"], key=lambda d: -d["state"].bit_count())
    ids = [f"v{i}" for i in range(len(problem.colors))]

    def named(plan: list[int]) -> list[str]:
        return [ids[i] for i in plan]

    first = None
    if detail:
        state = detail[0]["state"]
        first = {
            "before": named(exit_order(game, game.full, state)),
            "served": game.progress(state),
            "waiting": game.waiting(state),
            "winning": [named(exit_order(game, state, g)) for g in reading.natural(state) if game.wins(g)]
            or [named(exit_order(game, state, g)) for g in game.plans(state, 1) if game.wins(g)],
            "losing": [named(exit_order(game, state, g)) for g in reading.natural(state) if not game.wins(g)],
            "reasons": detail[0]["reasons"],
            "distance": [detail[0]["distanceMin"], detail[0]["distanceMax"]],
        }
    return {
        "id": identifier,
        "title": title,
        "level": level,
        "kind": kind,
        "bayCount": bays,
        "solutions": game.solution_count(),
        "queue": problem.request,
        "board": {
            "width": problem.size,
            "height": problem.size,
            "vehicles": [{"id": ids[i], "row": v.row, "column": v.column, "orientation": v.direction,
                          "length": v.length, "color": problem.colors[i]} for i, v in enumerate(problem.vehicles)],
            "fixedAreas": [],
            "roadOpenings": [{"side": FRONTEND_SIDE[side], "startOffset": 0, "length": problem.size}
                             for side in ("top", "right", "bottom", "left") if side in problem.openings],
        },
        "features": features,
        "firstDecision": first,
        "solution": named(exit_order(game, game.full, 0)),
        "diagram": problem.diagram(),
    }


def relabelled(row: dict[str, object], identifier: str, seed: int) -> Problem:
    return relabel(load(row["problem"]), random.Random(f"{seed}:{identifier}"))


def frontend_json(examples: list[dict[str, object]]) -> str:
    """The rule-lab file: two-space indent, arrays of scalars on one line when they fit in 80 columns."""
    def render(value, indent: int, prefix: int) -> str:
        pad = "  " * indent
        if isinstance(value, dict):
            if not value:
                return "{}"
            items = []
            for key, item in value.items():
                head = f"{pad}  {json.dumps(key, ensure_ascii=False)}: "
                items.append(head + render(item, indent + 1, len(head)))
            return "{\n" + ",\n".join(items) + f"\n{pad}}}"
        if isinstance(value, list):
            if not value:
                return "[]"
            inline = "[" + ", ".join(json.dumps(v, ensure_ascii=False) for v in value) + "]"
            if all(not isinstance(v, (dict, list)) for v in value) and prefix + len(inline) + 1 <= 80:
                return inline
            items = [f"{pad}  " + render(v, indent + 1, len(pad) + 2) for v in value]
            return "[\n" + ",\n".join(items) + f"\n{pad}]"
        return json.dumps(value, ensure_ascii=False)

    return render([{k: e[k] for k in FRONTEND_KEYS} for e in examples], 0, 0) + "\n"


def write_examples(examples: list[dict[str, object]], output: str, frontend_output: str | None) -> None:
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(examples, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    if frontend_output:
        with open(frontend_output, "w", encoding="utf-8") as handle:
            handle.write(frontend_json(examples))


def selection_entry(example: dict[str, object]) -> dict[str, object]:
    """A self-contained selection item: the exported problem itself, so no record file is needed to rebuild it."""
    return {**{k: example[k] for k in ("id", "title", "level", "kind", "bayCount")},
            "generator": example["features"]["generator"], "opening": example["features"]["opening"],
            "problem": from_example(example).to_json()}


def build(selection: list[dict[str, object]]) -> list[dict[str, object]]:
    return [entry(s["id"], s["title"], s["level"], s["kind"], Problem.from_json(s["problem"]), s["bayCount"],
                  s["generator"], s["opening"]) for s in selection]


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("candidates")
    listing.add_argument("records", nargs="+")
    listing.add_argument("--per-kind", type=int, default=8)
    detail = commands.add_parser("explain")
    detail.add_argument("records", nargs="+")
    detail.add_argument("--row", required=True)
    detail.add_argument("--id", required=True, help="example id, so the relabelling matches the export")
    detail.add_argument("--seed", type=int, default=738)
    export = commands.add_parser("export", help="pick recorded rows, relabel them and write the examples")
    export.add_argument("records", nargs="+")
    export.add_argument("--rows", required=True, help="JSON list of {id, title, level, kind, row}")
    export.add_argument("--seed", type=int, default=738)
    export.add_argument("--output", default="parking_jam_dispatch_levels.examples.json")
    export.add_argument("--frontend-output", help="also write the rule-lab file")
    export.add_argument("--selection-output", default="parking_jam_dispatch_levels.selection.json",
                        help="self-contained selection that `build` reads")
    rebuild = commands.add_parser("build", help="rebuild the examples from a self-contained selection")
    rebuild.add_argument("--selection", default="parking_jam_dispatch_levels.selection.json")
    rebuild.add_argument("--output", default="parking_jam_dispatch_levels.examples.json")
    rebuild.add_argument("--frontend-output", help="also write the rule-lab file")
    args = parser.parse_args()
    if args.command == "build":
        with open(args.selection, encoding="utf-8") as handle:
            write_examples(build(json.load(handle)), args.output, args.frontend_output)
        return
    rows = load_rows(args.records)
    if args.command == "candidates":
        print(json.dumps(candidates(rows, args.per_kind), ensure_ascii=False, indent=1))
    elif args.command == "explain":
        row = rows[args.row]
        print("\n".join(explain(relabelled(row, args.id, args.seed), row["features"]["bays"])))
    else:
        with open(args.rows, encoding="utf-8") as handle:
            chosen = json.load(handle)
        examples = []
        for item in chosen:
            row = rows[item["row"]]
            examples.append(entry(item["id"], item["title"], item["level"], item["kind"],
                                  relabelled(row, item["id"], args.seed), row["features"]["bays"],
                                  row["generator"], row["opening"]))
        write_examples(examples, args.output, args.frontend_output)
        with open(args.selection_output, "w", encoding="utf-8") as handle:
            json.dump([selection_entry(e) for e in examples], handle, ensure_ascii=False, indent=1)
            handle.write("\n")


if __name__ == "__main__":
    main()
