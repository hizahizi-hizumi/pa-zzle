"""ブリッジパズル（bridges）の製品コードの解法器を、研究用の解法器と突き合わせるための盤面と答えを書き出す。

`bridges_difficulty.py` の生成器で盤面を作り、島を行優先に並べ直して（製品コードと同じ辺の並びにして）から、
完全な解法器（解の数と探索した局面の数）と人間向け解法器（段と回数、数字の読みだけで決まる割合、入口）の結果を残す。
一意解でない盤面も含める（解法器は数字だけを見るので、どの盤面でも結果が一致するはず）。

使い方（seed は固定）:
  python3 scripts/research/bridges_parity_cases.py frontend/src/games/bridges/problem/generation/research-solver-cases.json
  bun run --cwd frontend format
"""

from __future__ import annotations

import json
import random
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
sys.setrecursionlimit(10000)

import bridges_difficulty as B  # noqa: E402

CASE_COUNT = 100
RARE_TIERS = ("C3", "D", "T")


def build_case(size: int, density: float, p2: float, extra: float, rng: random.Random) -> dict | None:
    generated = B.generate(size, size, max(2, round(density * size * size)), p2, extra, rng)
    if generated is None:
        return None
    raw, _ = generated
    order = sorted(range(len(raw.islands)), key=lambda i: raw.islands[i])
    p = B.Puzzle(size, size, [raw.islands[i] for i in order], [raw.nums[i] for i in order])
    p.build()
    count, nodes, capped, _ = B.count_solutions(p, 2, True)
    unconnected, unconnected_nodes, _, _ = B.count_solutions(p, 20, False, node_cap=100000)
    status, log, _, _ = B.human_solve(p, "T")
    _, _, _, count_only = B.human_solve(p, "A2")
    grid = [["."] * size for _ in range(size)]
    for (r, c), n in zip(p.islands, p.nums):
        grid[r][c] = str(n)
    return {
        "board": "/".join("".join(row) for row in grid),
        "solutionCount": count,
        "nodeCount": nodes,
        "exceededNodeLimit": capped,
        "unconnectedSolutionCount": unconnected,
        "unconnectedNodeCount": unconnected_nodes,
        "status": status,
        "rounds": " ".join(f"{tier}:{k}" for tier, k in log),
        "countReasoningDecidedRatio": round(count_only, 6),
        "openingEdgeCount": B.entry_width(p),
    }


def main() -> None:
    master = random.Random(20261102)
    conditions = [
        (s, d, p2, ex)
        for s in (6, 7, 8, 9, 10)
        for d in (0.24, 0.30)
        for p2 in (0.1, 0.3)
        for ex in (0.0, 0.15)
    ]
    rare: list[dict] = []
    common: list[dict] = []
    for index in range(600):
        case = build_case(*conditions[index % len(conditions)], random.Random(master.randrange(1 << 30)))
        if case is None:
            continue
        if any(f"{tier}:" in case["rounds"] for tier in RARE_TIERS):
            rare.append(case)
        else:
            common.append(case)
    cases = (rare[: CASE_COUNT // 2] + common)[:CASE_COUNT]
    with open(sys.argv[1], "w") as f:
        json.dump(cases, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tiers = sorted({step.split(":")[0] for case in cases for step in case["rounds"].split()})
    print(f"{len(cases)} cases, tiers {tiers}, unique {sum(1 for c in cases if c['solutionCount'] == 1)}")


if __name__ == "__main__":
    main()
