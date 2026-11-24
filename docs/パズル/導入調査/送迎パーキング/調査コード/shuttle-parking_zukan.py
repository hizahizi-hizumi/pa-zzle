"""送迎パーキング（shuttle-parking）の図鑑の「問題の特徴」の候補を測る調査コード。

標準ライブラリだけで書き、乱数は文字列の seed で固定する。製品のコードではない。
問題の生成・レベルの判定は難易度の調査コード `shuttle-parking_difficulty.py`（案F）をそのまま使う（変更しない）。
難易度の境目が後で変わっても、`measure` を流し直せば同じ手順で引き直せる。

候補の特徴（始めたときの盤面で分かるもの。GAME-009「問題の特徴」）:
  bays         待機枠の数
  passengers   乗客の人数（列の長さ。= 座席の合計）
  colors       色の数
  size         盤面の一辺のマスの数（6・7。正方形だけ）
  openSides    出口のある辺の数（1・2）
  seats3       3人乗りの台数（2人乗りは 車の台数 − これ）
  startMovable 最初に出せる車の数
  queueRuns    列の色の切り替わりの数 + 1（同じ色が続く区間の数）
  headReady    列の先頭の色の車が最初から出せるか（0/1）
難易度の写しになりやすい量（難易度の観点 out/difficulty.md の 7.）:
  h90・h50（先回りする人。先頭に合わせる人とは相関 1.0）と、素朴な規則の勝率の最大（pmax）、レベル。

サブコマンド:
  measure  --seed S --count N --workers W --output O   N 個の候補を作り、分類された行の特徴と難易度の量を JSON Lines で書く
  digest   --inputs ... --output O                     レベルごとの値の分布、特徴どうし・難易度との順位相関
  expected --output O                                  難易度の期待値（shuttle-parking_difficulty.expected.json）の
                                                       問題ごとの特徴の値（移植の期待値）
再現:
  measure --seed 988 --count 25000 --workers 2 / --seed 2026 同じ（並列数は結果を変えない）
  digest --inputs <上の2つ>
  expected
"""
from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
from collections import Counter, defaultdict
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("difficulty", os.path.join(HERE, "shuttle-parking_difficulty.py"))
difficulty = importlib.util.module_from_spec(_spec)
sys.modules["difficulty"] = difficulty
_spec.loader.exec_module(difficulty)

FEATURES = ("bays", "passengers", "colors", "size", "openSides", "seats3", "startMovable", "queueRuns", "headReady")
DIFFICULTY = ("level", "h90", "h50", "pmax")


def features_of(problem, bays: int) -> dict:
    full = (1 << len(problem.vehicles)) - 1
    movable = difficulty.legal_open(problem.vehicles, full, problem.openings)
    queue = problem.queue
    return {
        "bays": bays,
        "passengers": len(queue),
        "colors": len(set(problem.colors)),
        "size": problem.size,
        "openSides": len(problem.openings),
        "seats3": sum(1 for v in problem.vehicles if v.length == 3),
        "startMovable": len(movable),
        "queueRuns": sum(1 for i, c in enumerate(queue) if i == 0 or queue[i - 1] != c),
        "headReady": int(any(problem.colors[i] == queue[0] for i in movable)),
    }


def measure_one(args):
    seed, index, cars = args
    rng = random.Random(f"shuttle-zukan:{seed}:{cars}:{index}")
    cond = difficulty.draw_supply(rng, cars)
    problem = difficulty.build(rng, cond)
    _, found = difficulty.assess_chosen(problem)
    out = []
    for f in found:
        if f["level"] is None:
            continue
        out.append({"seed": seed, "index": index, "key": problem.key(), **features_of(problem, f["bays"]),
                    "level": f["level"], "slack": f["slack"],
                    "h90": f["window"]["h90"], "h50": f["window"]["h50"],
                    "headH90": f["head"]["h90"], "headH50": f["head"]["h50"],
                    "pmax": max(f["policies"].values())})
    return out


def cmd_measure(args):
    jobs = [(args.seed, i, args.cars) for i in range(args.count)]
    with Pool(args.workers) as pool, open(args.output, "w", encoding="utf-8") as out:
        for rows in pool.imap(measure_one, jobs, chunksize=16):
            for row in rows:
                out.write(json.dumps(row, ensure_ascii=False) + "\n")


def spearman(xs, ys):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2
            i = j + 1
        return r

    if len(xs) < 3 or len(set(xs)) < 2 or len(set(ys)) < 2:
        return None
    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.fmean(rx), statistics.fmean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return round(num / den, 3)


def balanced(rows, per_level, seed):
    """レベルごとに同じ数（少ないレベルは全部）を取り、問題集に近い母集団にする（問題集は各レベル同数の見込み）。"""
    rng = random.Random(f"shuttle-zukan-balance:{seed}")
    by = defaultdict(list)
    for r in rows:
        by[r["level"]].append(r)
    n = min(per_level, *(len(v) for v in by.values()))
    out = []
    for lv in sorted(by):
        out.extend(rng.sample(by[lv], n))
    return out, n


def cmd_digest(args):
    rows = []
    seen = set()
    for path in args.inputs:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                r = json.loads(line)
                k = (r["key"], r["bays"])
                if k in seen:
                    continue
                seen.add(k)
                rows.append(r)
    by = defaultdict(list)
    for r in rows:
        by[r["level"]].append(r)
    data = {"rows": len(rows), "perLevel": {str(lv): len(by[lv]) for lv in sorted(by)}}
    # 1. レベルごとの値の種類と、各値の割合（%）
    dist = {}
    for f in FEATURES:
        dist[f] = {}
        for lv in sorted(by):
            c = Counter(r[f] for r in by[lv])
            total = len(by[lv])
            dist[f][str(lv)] = {"kinds": len(c), "top": round(100 * c.most_common(1)[0][1] / total, 1),
                                "share": {str(v): round(100 * c[v] / total, 1) for v in sorted(c)}}
    data["distribution"] = dist
    # 2. 順位相関: 各レベル同数に揃えた母集団（全レベルを通して）と、レベルの中（Lv2〜5 の平均）
    bal, n = balanced(rows, args.per_level, args.seed)
    data["balancedPerLevel"] = n
    cols = FEATURES + DIFFICULTY
    data["pooled"] = {a: {b: spearman([r[a] for r in bal], [r[b] for r in bal]) for b in cols} for a in FEATURES}
    within = {}
    for a in FEATURES:
        within[a] = {}
        for b in cols:
            if b == "level":
                continue
            vals = [spearman([r[a] for r in by[lv]], [r[b] for r in by[lv]]) for lv in (2, 3, 4, 5)]
            within[a][b] = {"perLevel": vals,
                            "mean": round(statistics.fmean([v for v in vals if v is not None]), 3)
                            if any(v is not None for v in vals) else None}
    data["withinLevel"] = within
    # 3. 値ごとのレベルの割合（同数母集団）: ある値が特定のレベルにだけ出ていないか
    by_value = {}
    for f in FEATURES:
        by_value[f] = {}
        groups = defaultdict(Counter)
        for r in bal:
            groups[r[f]][r["level"]] += 1
        for v in sorted(groups):
            total = sum(groups[v].values())
            by_value[f][str(v)] = {"n": total, "levels": {str(lv): round(100 * groups[v][lv] / total, 1)
                                                         for lv in range(1, 6)}}
    data["levelsByValue"] = by_value
    # 4. 組み合わせ: 待機枠 × 乗客（範囲3人）× 盤面で、1つのレベルに何通りあり、最も多い組は何%か
    combos = {}
    for lv in sorted(by):
        c = Counter((r["bays"], r["passengers"] // 3, r["size"]) for r in by[lv])
        combos[str(lv)] = {"kinds": len(c), "top": round(100 * c.most_common(1)[0][1] / len(by[lv]), 1)}
    data["combosBaysPassengers3Size"] = combos
    # 5. 乗客の人数をまとめる幅（製品の図鑑と同じく floor(値 / 幅) で組にする）ごとの、レベル内の各範囲の割合
    ranges = {}
    for width in (2, 3, 4):
        ranges[str(width)] = {}
        for lv in sorted(by):
            groups = defaultdict(list)
            for r in by[lv]:
                groups[r["passengers"] // width].append(r["passengers"])
            total = len(by[lv])
            ranges[str(width)][str(lv)] = {f"{min(v)}-{max(v)}": round(100 * len(v) / total, 1)
                                           for _, v in sorted(groups.items())}
    data["passengerRanges"] = ranges
    text = json.dumps(data, ensure_ascii=False, indent=1)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(text + "\n")
    print(text)


def cmd_expected(args):
    """難易度の期待値の問題ごとに、行（待機枠）ごとの特徴の値を書く。移植した特徴の計算を突き合わせる用。"""
    with open(os.path.join(HERE, "shuttle-parking_difficulty.expected.json"), encoding="utf-8") as handle:
        source = json.load(handle)
    entries = []
    for e in source["entries"]:
        problem = difficulty.Problem.from_json(e["problem"])
        for row in e["rows"]:
            entries.append({"seed": e["seed"], "bays": row["bays"], "level": row["level"],
                            "features": features_of(problem, row["bays"])})
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump({"features": list(FEATURES), "entries": entries}, handle, ensure_ascii=False)
        handle.write("\n")


def main():
    parser = argparse.ArgumentParser(description="shuttle-parking zukan feature research")
    sub = parser.add_subparsers(dest="command", required=True)
    m = sub.add_parser("measure")
    m.add_argument("--seed", required=True)
    m.add_argument("--count", type=int, required=True)
    m.add_argument("--cars", type=int, default=8)
    m.add_argument("--workers", type=int, default=3)
    m.add_argument("--output", required=True)
    d = sub.add_parser("digest")
    d.add_argument("--inputs", nargs="+", required=True)
    d.add_argument("--per-level", type=int, default=100000)
    d.add_argument("--seed", default="1")
    d.add_argument("--output")
    e = sub.add_parser("expected")
    e.add_argument("--output", default=os.path.join(HERE, "shuttle-parking_zukan.expected.json"))
    args = parser.parse_args()
    {"measure": cmd_measure, "digest": cmd_digest, "expected": cmd_expected}[args.command](args)


if __name__ == "__main__":
    main()
