"""移植の期待値 research-reference.json を書く。

- 同型・近さ・例の魔方陣: magic_square_supply.expected.json の group_sizes・squares4・cases（level を除く）・
  transformed・near_pairs・examples をそのまま写す。
- 解法器: 調査コード magic_square_difficulty.py の count_solutions（写しは difficulty-functions.py）で、
  cases と transformed の与える数、そこから与える数を外して2解にした盤面、矛盾する盤面、打ち切る盤面を数える。
使い方: python3 make_reference.py <magic_square_supply.expected.json> <出力先>
"""
import json
import sys

import research_solver as r

EXACT_LIMIT = 2
EXACT_NODE_CAP = 2_000_000

supply = json.load(open(sys.argv[1], encoding="utf-8"))


def solve(n, givens, limit=EXACT_LIMIT, node_cap=EXACT_NODE_CAP):
    st = r.count_solutions(r.geo_of(n), givens, limit=limit, node_cap=node_cap)
    return {"count": st["count"], "nodes": st["nodes"], "capped": st["capped"]}


solver = []
for c in supply["cases"]:
    solver.append({"id": c["id"], "n": c["n"], "givens": c["givens"], "limit": EXACT_LIMIT,
                   "nodeCap": EXACT_NODE_CAP, **solve(c["n"], c["givens"])})
for i, t in enumerate(supply["transformed"]):
    n = int(round(len(t["givens"]) ** 0.5))
    solver.append({"id": f"{t['of']}-transformed-{i}", "n": n, "givens": t["givens"], "limit": EXACT_LIMIT,
                   "nodeCap": EXACT_NODE_CAP, **solve(n, t["givens"])})
# 与える数を前から1つずつ外し、初めて2解になった盤面（盤面ごとに最初の2問）
seen = {4: 0, 5: 0, 6: 0}
for c in supply["cases"]:
    n = c["n"]
    if seen[n] >= 2:
        continue
    g = list(c["givens"])
    for i, v in enumerate(c["givens"]):
        if not v:
            continue
        g[i] = 0
        res = solve(n, g)
        if res["count"] >= 2:
            solver.append({"id": f"{c['id']}-ambiguous", "n": n, "givens": list(g), "limit": EXACT_LIMIT,
                           "nodeCap": EXACT_NODE_CAP, **res})
            seen[n] += 1
            break
# 同じ数が2つある盤面と、埋まった列の合計が違う盤面
dup = [0] * 16
dup[0] = 5
dup[5] = 5
solver.append({"id": "duplicate-value-4", "n": 4, "givens": dup, "limit": EXACT_LIMIT, "nodeCap": EXACT_NODE_CAP,
               **solve(4, dup)})
wrong_row = [1, 2, 3, 4] + [0] * 12
solver.append({"id": "wrong-full-row-4", "n": 4, "givens": wrong_row, "limit": EXACT_LIMIT,
               "nodeCap": EXACT_NODE_CAP, **solve(4, wrong_row)})
# 空の盤面: 数え上げを上限で打ち切る
for n, cap in ((5, 3000), (6, 3000)):
    solver.append({"id": f"empty-{n}-capped", "n": n, "givens": [0] * (n * n), "limit": 10 ** 6, "nodeCap": cap,
                   **solve(n, [0] * (n * n), limit=10 ** 6, node_cap=cap)})
full4 = r.count_solutions(r.geo_of(4), [0] * 16, limit=10 ** 6)

out = {
    "about": "魔方陣の問題集の土台（解法器・答えの魔方陣・同型と近さ・例の魔方陣の除外）の移植の期待値。"
             "group_sizes から examples までは magic_square_supply.expected.json の写し（cases の level は版4の分類なので除いた）。"
             "solver は magic_square_difficulty.py の count_solutions で数えた値。",
    "group_sizes": supply["group_sizes"],
    "squares4": {**supply["squares4"], "enumerationNodes": full4["nodes"]},
    "cases": [{k: v for k, v in c.items() if k != "level"} for c in supply["cases"]],
    "transformed": supply["transformed"],
    "near_pairs": supply["near_pairs"],
    "examples": supply["examples"],
    "solver": solver,
}


def dumps(x, ind=0):
    pad = "  " * ind
    if isinstance(x, dict):
        items = [f'{pad}  {json.dumps(k, ensure_ascii=False)}: {dumps(v, ind + 1).lstrip()}' for k, v in x.items()]
        return pad + "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(x, list) and x and all(isinstance(v, (int, bool)) for v in x):
        return pad + json.dumps(x)
    if isinstance(x, list):
        return pad + "[\n" + ",\n".join(dumps(v, ind + 1) for v in x) + "\n" + pad + "]"
    return pad + json.dumps(x, ensure_ascii=False)


open(sys.argv[2], "w", encoding="utf-8").write(dumps(out) + "\n")
print(len(solver), "solver cases;", "squares4 nodes", full4["nodes"])
for s in solver[-8:]:
    print(s["id"], s["count"], s["nodes"], s["capped"])
