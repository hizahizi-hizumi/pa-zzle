"""パーキングジャム（クラシック）の問題集を、新ルール候補と同じ物差しで測る研究用スクリプト（#727）。

正式な問題集・生成器・判定は変更しない。

サブコマンド:
  dump     本番コードで問題集の全問を復元し、盤面と本番の難易度特徴を JSON Lines で書き出す（bun を使う）。
  analyze  dump の出力を、本番コードを呼ばない独立モデルで解析し、レベル別の集計を JSON で書き出す。
  boards   dump の出力から、指定した問題IDの盤面を文字で描く。

独立モデルの要点:
  車 v の方向 d への出庫は「向きが合う」「その車線に開口がある」「進路に固定物がない」（どれも盤面に固定）
  と「進路に残っている車がない」の積で決まる。前者を静的な可否、後者を遮断車の集合 B(v,d) と呼ぶ。
  残りの車の集合 S で合法 ⇔ 静的に可 かつ B(v,d) ∩ S = ∅。S が減るほど合法手は増えるだけなので、
  合法な出庫で別の車の合法手が消えることはない（単調性）。analyze はこれを全到達状態で数え直す。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from statistics import median

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "frontend"

DIRECTIONS = ("up", "right", "down", "left")

DUMP_SCRIPT = r"""
import { listParkingJamPoolEntries, toParkingJamPoolIdentity, listParkingJamPoolProblemIds } from "@/games/parking-jam/problem/problem-pool";
import { restoreParkingJamProblemWithoutAnalysis } from "@/games/parking-jam/problem/generator";
import { analyzeParkingJamDifficulty } from "@/games/parking-jam/problem/difficulty-analysis";
import { analyzeParkingJamSolvability } from "@/games/parking-jam/problem/generation/solvability";
import { assessParkingJamDifficulty, calculateParkingJamChallengeLevers } from "@/games/parking-jam/difficulty";
const withFeatures = process.env.PJ_WITH_FEATURES === "1";
const lines: string[] = [];
for (const level of [1, 2, 3, 4, 5] as const) {
  const entries = listParkingJamPoolEntries(level);
  const ids = listParkingJamPoolProblemIds(level);
  entries.forEach((entry, index) => {
    const identity = toParkingJamPoolIdentity(entry);
    const { problem } = restoreParkingJamProblemWithoutAnalysis(identity);
    const row: Record<string, unknown> = { level, ordinal: index + 1, problemId: ids[index], entry, conditions: identity.conditions, board: problem.board };
    if (withFeatures) {
      const analysis = analyzeParkingJamDifficulty(problem.board, analyzeParkingJamSolvability(problem.board));
      const f = analysis.features;
      row.features = {
        dependencyDepth: f.dependencyDepth,
        maximumPrerequisiteVehicleCount: f.maximumPrerequisiteVehicleCount,
        misreadInducingVehicleCount: f.misreadInducingVehicleCount,
        adjacentLaneOpeningVehicleCount: f.adjacentLaneOpeningVehicleCount,
        directionChoiceVehicleCount: f.directionChoiceVehicleCount,
        farBlockedVehicleCount: f.farBlockedVehicleCount,
        initialLegalVehicleCount: f.initialLegalVehicleCount,
        averageLegalVehicleRatio: f.averageLegalVehicleRatio,
        minimumLegalVehicleRatio: f.minimumLegalVehicleRatio,
        forcedChoiceStateRatio: f.forcedChoiceStateRatio,
        reachableStateCount: f.reachableStateCount,
        legalOrderCount: f.legalOrderCount,
      };
      row.levers = calculateParkingJamChallengeLevers(f);
      row.assessment = assessParkingJamDifficulty(analysis);
    }
    lines.push(JSON.stringify(row));
  });
}
process.stdout.write(lines.join("\n") + "\n");
"""


def dump(output: Path, with_features: bool) -> None:
    env = dict(os.environ)
    env["PJ_WITH_FEATURES"] = "1" if with_features else "0"
    result = subprocess.run(
        ["bun", "-e", DUMP_SCRIPT],
        cwd=FRONTEND,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr)
    output.write_text(result.stdout)


# ---------------------------------------------------------------- 独立モデル


def vehicle_cells(v: dict) -> list[tuple[int, int]]:
    if v["orientation"] == "horizontal":
        return [(v["row"], v["column"] + i) for i in range(v["length"])]
    return [(v["row"] + i, v["column"]) for i in range(v["length"])]


def path_cells(board: dict, v: dict, d: str) -> list[tuple[int, int]]:
    r, c, n = v["row"], v["column"], v["length"]
    if d == "left":
        return [(r, x) for x in range(c - 1, -1, -1)]
    if d == "right":
        return [(r, x) for x in range(c + n, board["width"])]
    if d == "up":
        return [(y, c) for y in range(r - 1, -1, -1)]
    return [(y, c) for y in range(r + n, board["height"])]


def fixed_cells(board: dict) -> set[tuple[int, int]]:
    cells = set()
    for a in board["fixedAreas"]:
        for dy in range(a["height"]):
            for dx in range(a["width"]):
                cells.add((a["row"] + dy, a["column"] + dx))
    return cells


def has_opening(board: dict, v: dict, d: str) -> bool:
    offset = v["row"] if v["orientation"] == "horizontal" else v["column"]
    return any(
        o["side"] == d and o["startOffset"] <= offset < o["startOffset"] + o["length"]
        for o in board["roadOpenings"]
    )


def axis_directions(v: dict) -> tuple[str, str]:
    return ("left", "right") if v["orientation"] == "horizontal" else ("up", "down")


class Model:
    """車ごと・方向ごとの静的な可否と遮断車ビットマスク。"""

    def __init__(self, board: dict):
        self.board = board
        self.vehicles = board["vehicles"]
        self.n = len(self.vehicles)
        fixed = fixed_cells(board)
        owner: dict[tuple[int, int], int] = {}
        for i, v in enumerate(self.vehicles):
            for cell in vehicle_cells(v):
                owner[cell] = i
        # exits[i] = [(direction, static_kind, blocker_mask)]
        # static_kind: "open"（静的に可）/ "wall"（開口なし）/ "fixed"（開口はあるが固定物）
        self.exits: list[list[tuple[str, str, int]]] = []
        for i, v in enumerate(self.vehicles):
            row = []
            for d in axis_directions(v):
                path = path_cells(board, v, d)
                mask = 0
                for cell in path:
                    j = owner.get(cell)
                    if j is not None and j != i:
                        mask |= 1 << j
                if not has_opening(board, v, d):
                    kind = "wall"
                elif any(cell in fixed for cell in path):
                    kind = "fixed"
                else:
                    kind = "open"
                row.append((d, kind, mask))
            self.exits.append(row)
        self.open_masks = [[m for (_, k, m) in row if k == "open"] for row in self.exits]
        self.full = (1 << self.n) - 1

    def legal_moves(self, s: int) -> list[tuple[int, int]]:
        """状態 s（残っている車のビット集合）での合法手 (車, 方向番号)。"""
        moves = []
        for i in range(self.n):
            if not (s >> i) & 1:
                continue
            for k, (d, kind, mask) in enumerate(self.exits[i]):
                if kind == "open" and mask & s == 0:
                    moves.append((i, k))
        return moves

    def legal_vehicles(self, s: int) -> list[int]:
        return [
            i
            for i in range(self.n)
            if (s >> i) & 1 and any(m & s == 0 for m in self.open_masks[i])
        ]


def popcount(x: int) -> int:
    return bin(x).count("1")


def analyze_problem(row: dict) -> dict:
    model = Model(row["board"])
    n = model.n
    full = model.full

    # 到達状態の列挙（合法な出庫だけで到達できる残存集合）
    reachable = {full}
    frontier = [full]
    legal_cache: dict[int, list[int]] = {}
    while frontier:
        nxt = []
        for s in frontier:
            lv = model.legal_vehicles(s)
            legal_cache[s] = lv
            for i in lv:
                t = s & ~(1 << i)
                if t not in reachable:
                    reachable.add(t)
                    nxt.append(t)
        frontier = nxt

    # 詰み局面: 車が残っているのに合法手がない到達状態
    dead_states = sum(1 for s in reachable if s and not legal_cache[s])
    # 判断局面（新ルール候補と同じ定義）: 合法な選択肢の中に、選ぶと解けなくなるものがある到達状態
    solvable = {0: True}
    for s in sorted(reachable, key=popcount):
        if s == 0:
            continue
        solvable[s] = any(solvable[s & ~(1 << i)] for i in legal_cache[s])
    judgment_states = sum(
        1
        for s in reachable
        if s and solvable[s] and any(not solvable[s & ~(1 << i)] for i in legal_cache[s])
    )
    # 単調性: 合法な車 v を出した後、出す前に合法だった他の車がすべてまだ合法か
    monotonicity_violations = 0
    for s in reachable:
        if not s:
            continue
        before = set(legal_cache[s])
        for i in legal_cache[s]:
            after = set(legal_cache[s & ~(1 << i)])
            if not (before - {i}) <= after:
                monotonicity_violations += 1

    # 合法手を等確率で選ぶプレイヤーの、各手番の指標の期待値（厳密なDP）
    prob: dict[int, float] = {full: 1.0}
    exp_legal_ratio = 0.0  # 残りの車のうち出せる車の割合（手番平均）
    exp_tap_success = 0.0  # 残りの車と、その車軸の2方向から無作為に1つ押したときに出せる確率（手番平均）
    exp_single_steps = 0.0  # 出せる車が1台だけの手番の数
    for s in sorted(reachable, key=popcount, reverse=True):
        p = prob.get(s, 0.0)
        if not s or p == 0.0:
            continue
        lv = legal_cache[s]
        r = popcount(s)
        moves = model.legal_moves(s)
        exp_legal_ratio += p * len(lv) / r
        exp_tap_success += p * len(moves) / (2 * r)
        if len(lv) == 1:
            exp_single_steps += p
        for i in lv:
            t = s & ~(1 << i)
            prob[t] = prob.get(t, 0.0) + p / len(lv)
    exp_legal_ratio /= n
    exp_tap_success /= n

    # 並列削除の層（本番の段数に当たる）
    layers = []
    s = full
    while s:
        lv = model.legal_vehicles(s)
        if not lv:
            break
        layers.append(len(lv))
        for i in lv:
            s &= ~(1 << i)

    # 静的な特徴
    wall_dirs = sum(1 for row_ in model.exits for (_, k, _) in row_ if k == "wall")
    fixed_dirs = sum(1 for row_ in model.exits for (_, k, _) in row_ if k == "fixed")
    two_way = sum(1 for row_ in model.open_masks if len(row_) == 2)
    initial_legal = len(model.legal_vehicles(full))
    initial_moves = len(model.legal_moves(full))
    return {
        "level": row["level"],
        "problemId": row["problemId"],
        "n": n,
        "cells": row["board"]["width"] * row["board"]["height"],
        "fixedAreas": len(row["board"]["fixedAreas"]),
        "openings": len(row["board"]["roadOpenings"]),
        "reachable": len(reachable),
        "deadStates": dead_states,
        "judgmentStates": judgment_states,
        "monotonicityViolations": monotonicity_violations,
        "depth": len(layers),
        "layers": layers,
        "initialLegal": initial_legal,
        "initialLegalRatio": initial_legal / n,
        "initialTapSuccess": initial_moves / (2 * n),
        "randomLegalRatio": exp_legal_ratio,
        "randomTapSuccess": exp_tap_success,
        "randomSingleLegalSteps": exp_single_steps,
        "wallDirections": wall_dirs,
        "fixedDirections": fixed_dirs,
        "staticOpenDirections": sum(len(m) for m in model.open_masks),
        "twoWayVehicles": two_way,
        "features": row.get("features"),
        "levers": row.get("levers"),
    }


def quantiles(values: list[float]) -> list[float]:
    xs = sorted(values)
    if not xs:
        return []

    def q(p: float) -> float:
        return xs[min(len(xs) - 1, int(p * (len(xs) - 1) + 0.5))]

    return [round(q(0.1), 3), round(median(xs), 3), round(q(0.9), 3)]


def first_layer(row: dict) -> int:
    """最初から出せる車の数。出せる車が無い盤面では 0。"""
    return row["layers"][0] if row["layers"] else 0


def summarize(results: list[dict]) -> dict:
    out: dict = {"total": len(results)}
    out["allLevels"] = {
        "deadStates": sum(r["deadStates"] for r in results),
        "judgmentStates": sum(r["judgmentStates"] for r in results),
        "monotonicityViolations": sum(r["monotonicityViolations"] for r in results),
        "reachableStates": sum(r["reachable"] for r in results),
        "problemsWithFixedArea": sum(1 for r in results if r["fixedAreas"] > 0),
        "problemsWithWallDirection": sum(1 for r in results if r["wallDirections"] > 0),
        "problemsWithFixedDirection": sum(1 for r in results if r["fixedDirections"] > 0),
    }
    by_level = {}
    for level in range(1, 6):
        rs = [r for r in results if r["level"] == level]
        feats = [r["features"] for r in rs if r["features"]]
        lv = {
            "n": len(rs),
            "vehicles": dict(sorted(Counter(r["n"] for r in rs).items())),
            "cells": dict(sorted(Counter(r["cells"] for r in rs).items())),
            "depth": dict(sorted(Counter(r["depth"] for r in rs).items())),
            "deadStates": sum(r["deadStates"] for r in rs),
            "judgmentStates": sum(r["judgmentStates"] for r in rs),
            "initialLegal_p10_med_p90": quantiles([r["initialLegal"] for r in rs]),
            "initialLegalRatio_p10_med_p90": quantiles([r["initialLegalRatio"] for r in rs]),
            "initialTapSuccess_p10_med_p90": quantiles([r["initialTapSuccess"] for r in rs]),
            "randomLegalRatio_p10_med_p90": quantiles([r["randomLegalRatio"] for r in rs]),
            "randomTapSuccess_p10_med_p90": quantiles([r["randomTapSuccess"] for r in rs]),
            "randomSingleLegalSteps_p10_med_p90": quantiles([r["randomSingleLegalSteps"] for r in rs]),
            "wallDirectionsPerVehicle_p10_med_p90": quantiles([r["wallDirections"] / r["n"] for r in rs]),
            "twoWayVehicleRatio_p10_med_p90": quantiles([r["twoWayVehicles"] / r["n"] for r in rs]),
            "fixedDirectionProblems": sum(1 for r in rs if r["fixedDirections"] > 0),
            "firstLayerShare_p10_med_p90": quantiles([first_layer(r) / r["n"] for r in rs]),
            # 依存の深い車は、すぐ出せる車を出し尽くした後の少数の残りに現れる
            "remainingAfterFirstLayer_p10_med_p90": quantiles([r["n"] - first_layer(r) for r in rs]),
            "remainingAfterSecondLayer_p10_med_p90": quantiles([r["n"] - sum(r["layers"][:2]) for r in rs]),
        }
        if feats:
            lv["prodDepthMatches"] = sum(
                1 for r in rs if r["features"] and r["features"]["dependencyDepth"] == r["depth"]
            )
            lv["prodInitialLegalMatches"] = sum(
                1 for r in rs if r["features"] and r["features"]["initialLegalVehicleCount"] == r["initialLegal"]
            )
            lv["misreadRatio_p10_med_p90"] = quantiles(
                [r["features"]["misreadInducingVehicleCount"] / r["n"] for r in rs if r["features"]]
            )
            lv["maxPrereq_p10_med_p90"] = quantiles([f["maximumPrerequisiteVehicleCount"] for f in feats])
            lv["prodAverageLegalRatio_p10_med_p90"] = quantiles([f["averageLegalVehicleRatio"] for f in feats])
        by_level[str(level)] = lv
    out["byLevel"] = by_level

    # 同じ車両数・盤面での、レベル間の比較（規模を揃えたときに何が変わるか）
    strata = {}
    for key in sorted({(r["cells"], r["n"]) for r in results}):
        cells, n = key
        row = {}
        for level in range(1, 6):
            rs = [r for r in results if r["level"] == level and (r["cells"], r["n"]) == key]
            if len(rs) < 20:
                continue
            row[str(level)] = {
                "count": len(rs),
                "randomLegalRatioMedian": round(median(r["randomLegalRatio"] for r in rs), 3),
                "randomTapSuccessMedian": round(median(r["randomTapSuccess"] for r in rs), 3),
                "depthMedian": median(r["depth"] for r in rs),
                "initialLegalMedian": median(r["initialLegal"] for r in rs),
            }
        if len(row) >= 2:
            strata[f"{cells}cells_{n}vehicles"] = row
    out["sameScaleByLevel"] = strata
    return out


def load_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def analyze(dump_path: Path, output: Path, per_problem: Path | None, workers: int) -> None:
    rows = load_rows(dump_path)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(analyze_problem, rows, chunksize=20))
    summary = summarize(results)
    output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    if per_problem:
        slim = [{k: v for k, v in r.items() if k not in ("features", "levers")} for r in results]
        per_problem.write_text("\n".join(json.dumps(r) for r in slim) + "\n")


# ---------------------------------------------------------------- 盤面の描画


def render(board: dict) -> str:
    """車を英字（横は大文字、縦は小文字）、固定物を #、空きを . で描き、開口を外周の = / | で示す。"""
    w, h = board["width"], board["height"]
    grid = [["." for _ in range(w)] for _ in range(h)]
    for cell in fixed_cells(board):
        grid[cell[0]][cell[1]] = "#"
    for i, v in enumerate(board["vehicles"]):
        ch = chr(ord("A") + i)
        if v["orientation"] == "vertical":
            ch = ch.lower()
        for r, c in vehicle_cells(v):
            grid[r][c] = ch

    def opened(side: str, offset: int) -> bool:
        return any(
            o["side"] == side and o["startOffset"] <= offset < o["startOffset"] + o["length"]
            for o in board["roadOpenings"]
        )

    lines = ["+" + "".join("=" if opened("up", c) else "-" for c in range(w)) + "+"]
    for r in range(h):
        left = "|" if not opened("left", r) else " "
        right = "|" if not opened("right", r) else " "
        lines.append(left + "".join(grid[r]) + right)
    lines.append("+" + "".join("=" if opened("down", c) else "-" for c in range(w)) + "+")
    return "\n".join(lines)


def boards(dump_path: Path, ids: list[str]) -> None:
    rows = {r["problemId"]: r for r in load_rows(dump_path)}
    for pid in ids:
        row = rows.get(pid)
        if not row:
            print(f"{pid}: not found")
            continue
        r = analyze_problem(row)
        print(
            f"== {pid} Lv{row['level']} No.{row['ordinal']} {row['board']['width']}x{row['board']['height']} "
            f"vehicles={r['n']} depth={r['depth']} layers={r['layers']} initialLegal={r['initialLegal']} "
            f"randomLegalRatio={r['randomLegalRatio']:.2f} tapSuccess(initial/random)={r['initialTapSuccess']:.2f}/{r['randomTapSuccess']:.2f} "
            f"deadStates={r['deadStates']} judgmentStates={r['judgmentStates']}"
        )
        if row.get("features"):
            f = row["features"]
            print(
                f"   prod: depth={f['dependencyDepth']} maxPrereq={f['maximumPrerequisiteVehicleCount']} "
                f"misread={f['misreadInducingVehicleCount']} (adjLane={f['adjacentLaneOpeningVehicleCount']} "
                f"dirChoice={f['directionChoiceVehicleCount']} far={f['farBlockedVehicleCount']}) levers={row.get('levers')}"
            )
        print(render(row["board"]))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("dump")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--with-features", action="store_true")
    p = sub.add_parser("analyze")
    p.add_argument("dump", type=Path)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--per-problem", type=Path)
    p.add_argument("--workers", type=int, default=4)
    p = sub.add_parser("boards")
    p.add_argument("dump", type=Path)
    p.add_argument("ids", nargs="+")
    args = parser.parse_args(argv)
    if args.command == "dump":
        dump(args.output, args.with_features)
    elif args.command == "analyze":
        analyze(args.dump, args.output, args.per_problem, args.workers)
    else:
        boards(args.dump, args.ids)
    return 0


if __name__ == "__main__":
    sys.exit(main())
