"""送迎パーキングの音の観点の計測。標準ライブラリだけで動く。

1. 同梱されている効果音（frontend/src 以下の *.flac。frontend.tsx の import.meta.glob と同じ範囲）の
   本数・合計の大きさ（バイト）・長さを、ゲームごとに数える。長さは FLAC の STREAMINFO から読む。
2. 乗客列型の問題で、1回のタップ（車を出す）に続いて起きる「乗る」「満席で出発」の回数を数える。
   1タップでどれだけの音が続けて鳴りうるかの目安にする。
   - 解き切る手順すべて（厳密に全列挙）の各タップ
   - 初期局面から届く局面すべてでの、出せる車すべてのタップ（詰みに向かう手も含む）

使い方:
  python3 shuttle-parking_sound.py <リポジトリのルート> [問題 JSON のパス]

問題 JSON は、比較用の試作が持つ問題集（mode が "passengers" のものを使う）。
渡さなければ 2 は計測しない。
"""

from __future__ import annotations

import json
import statistics
import sys
from collections import Counter
from pathlib import Path


def read_streaminfo(path: Path) -> dict[str, float | int]:
    data = path.read_bytes()
    if data[:4] != b"fLaC":
        raise ValueError(f"FLAC ではない: {path}")
    # 最初のメタデータブロックは STREAMINFO（34バイト）
    block = data[8 : 8 + 34]
    bits = int.from_bytes(block[10:18], "big")
    sample_rate = bits >> 44
    channels = ((bits >> 41) & 0x7) + 1
    bits_per_sample = ((bits >> 36) & 0x1F) + 1
    total_samples = bits & ((1 << 36) - 1)
    return {
        "bytes": len(data),
        "sample_rate": sample_rate,
        "channels": channels,
        "bits_per_sample": bits_per_sample,
        "seconds": round(total_samples / sample_rate, 3) if sample_rate else 0.0,
    }


def owner_of(path: Path, src: Path) -> str:
    parts = path.relative_to(src).parts
    if parts[0] == "games":
        return parts[1]
    return "app"


def measure_sounds(root: Path) -> dict:
    src = root / "frontend" / "src"
    per_owner: dict[str, list[dict]] = {}
    for path in sorted(src.rglob("*.flac")):
        info = read_streaminfo(path)
        info["name"] = path.name
        per_owner.setdefault(owner_of(path, src), []).append(info)
    owners = {}
    for owner, files in sorted(per_owner.items()):
        owners[owner] = {
            "count": len(files),
            "bytes": sum(f["bytes"] for f in files),
            "longest_seconds": max(f["seconds"] for f in files),
            "formats": sorted(
                {f"{f['channels']}ch/{f['bits_per_sample']}bit/{f['sample_rate']}Hz" for f in files}
            ),
        }
    games = {k: v for k, v in owners.items() if k != "app"}
    counts = [v["count"] for v in games.values()]
    sizes = [v["bytes"] for v in games.values()]
    total_bytes = sum(v["bytes"] for v in owners.values())
    return {
        "owners": owners,
        "total_count": sum(v["count"] for v in owners.values()),
        "total_bytes": total_bytes,
        "game_count": len(games),
        "game_files_median": statistics.median(counts),
        "game_files_min_max": [min(counts), max(counts)],
        "game_bytes_median": statistics.median(sizes),
        "game_bytes_min_max": [min(sizes), max(sizes)],
    }


# --- 乗客列型のルール（試作の logic.js と同じ） ---

AXIS = {"horizontal": ("left", "right"), "vertical": ("up", "down")}


def path_cells(board, v, d):
    r, c, n = v["row"], v["column"], v["length"]
    if d == "left":
        return [(r, x) for x in range(c - 1, -1, -1)]
    if d == "right":
        return [(r, x) for x in range(c + n, board["width"])]
    if d == "up":
        return [(y, c) for y in range(r - 1, -1, -1)]
    return [(y, c) for y in range(r + n, board["height"])]


def is_open(board, v, d):
    offset = v["row"] if v["orientation"] == "horizontal" else v["column"]
    return any(
        o["side"] == d and o["startOffset"] <= offset < o["startOffset"] + o["length"]
        for o in board["roadOpenings"]
    )


def occupied(board, remaining):
    cells = set()
    for v in board["vehicles"]:
        if v["id"] not in remaining:
            continue
        for i in range(v["length"]):
            if v["orientation"] == "horizontal":
                cells.add((v["row"], v["column"] + i))
            else:
                cells.add((v["row"] + i, v["column"]))
    return cells


def legal_exits(problem, state):
    remaining, waiting, _ = state
    if len(waiting) >= problem["bayCount"]:
        return []
    board = problem["board"]
    taken = occupied(board, remaining)
    result = []
    for v in board["vehicles"]:
        if v["id"] not in remaining:
            continue
        if any(
            is_open(board, v, d) and all(cell not in taken for cell in path_cells(board, v, d))
            for d in AXIS[v["orientation"]]
        ):
            result.append(v["id"])
    return result


def exit_car(problem, state, vid):
    """出した後の局面と、そのタップで起きた乗車・出発の回数を返す。"""
    vehicles = {v["id"]: v for v in problem["board"]["vehicles"]}
    remaining, waiting, head = state
    remaining = tuple(x for x in remaining if x != vid)
    waiting = [list(w) for w in waiting] + [[vid, 0]]
    queue = problem["queue"]
    boardings = departures = 0
    while head < len(queue):
        index = next(
            (i for i, w in enumerate(waiting) if vehicles[w[0]]["color"] == queue[head]), -1
        )
        if index < 0:
            break
        waiting[index][1] += 1
        head += 1
        boardings += 1
        if waiting[index][1] == vehicles[waiting[index][0]]["length"]:
            waiting.pop(index)
            departures += 1
    return (remaining, tuple(tuple(w) for w in waiting), head), boardings, departures


def won(problem, state):
    remaining, waiting, head = state
    return not remaining and not waiting and head == len(problem["queue"])


def measure_chains(problems: list[dict]) -> dict:
    win_taps: Counter = Counter()
    win_departures: Counter = Counter()
    any_taps: Counter = Counter()
    any_departures: Counter = Counter()
    final_tap_boardings: Counter = Counter()
    per_problem = []
    for problem in problems:
        start = (tuple(v["id"] for v in problem["board"]["vehicles"]), (), 0)
        # 届く局面すべて
        seen = {start}
        stack = [start]
        while stack:
            state = stack.pop()
            for vid in legal_exits(problem, state):
                nxt, b, d = exit_car(problem, state, vid)
                any_taps[b] += 1
                any_departures[d] += 1
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        # 解き切る手順すべて（局面ごとに勝てる手順の数を数え、重みとして使う）
        memo: dict = {}

        def ways(state):
            if won(problem, state):
                return 1
            if state in memo:
                return memo[state]
            total = sum(ways(exit_car(problem, state, v)[0]) for v in legal_exits(problem, state))
            memo[state] = total
            return total

        def walk(state, weight_in):
            # weight_in: その局面へ来る勝ち手順の数。手ごとに勝ち手順の数を掛けて数える。
            for vid in legal_exits(problem, state):
                nxt, b, d = exit_car(problem, state, vid)
                w = ways(nxt)
                if w == 0:
                    continue
                times = weight_in * w
                win_taps[b] += times
                win_departures[d] += times
                if won(problem, nxt):
                    final_tap_boardings[b] += weight_in
                else:
                    pending.setdefault(nxt, 0)
                    pending[nxt] += weight_in

        # 勝ち手順の重みを局面の順に伝える（手数は車の台数で決まるので層ごとに進める）
        pending: dict = {start: 1}
        while pending:
            layer = pending
            pending = {}
            for state, weight in layer.items():
                walk(state, weight)
        solutions = ways(start)
        per_problem.append(
            {"id": problem["id"], "solutions": solutions, "reachable_states": len(seen)}
        )

    def summarize(counter: Counter) -> dict:
        total = sum(counter.values())
        mean = sum(k * v for k, v in counter.items()) / total
        ordered = sorted(counter.items())
        acc = 0
        p90 = None
        for k, v in ordered:
            acc += v
            if p90 is None and acc >= 0.9 * total:
                p90 = k
        return {
            "distribution": {str(k): v for k, v in ordered},
            "mean": round(mean, 2),
            "p90": p90,
            "max": max(counter),
            "share_zero": round(counter.get(0, 0) / total, 3),
        }

    return {
        "problems": len(problems),
        "per_problem": per_problem,
        "winning_taps_boardings": summarize(win_taps),
        "winning_taps_departures": summarize(win_departures),
        "winning_final_tap_boardings": summarize(final_tap_boardings),
        "any_taps_boardings": summarize(any_taps),
        "any_taps_departures": summarize(any_departures),
    }


def main() -> None:
    root = Path(sys.argv[1])
    result: dict = {"sounds": measure_sounds(root)}
    if len(sys.argv) > 2:
        problems = [
            p for p in json.loads(Path(sys.argv[2]).read_text()) if p["mode"] == "passengers"
        ]
        result["chains"] = measure_chains(problems)
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
