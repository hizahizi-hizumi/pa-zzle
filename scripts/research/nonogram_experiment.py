"""ノノグラムの実装前提調査の試算。

使い方（すべて seed 固定で再現する）:

    python3 scripts/research/nonogram_experiment.py selfcheck
    python3 scripts/research/nonogram_experiment.py supply --out <dir>
    python3 scripts/research/nonogram_experiment.py levels --input <dir>/candidates.csv
    python3 scripts/research/nonogram_experiment.py naive --input <dir>/candidates.csv
    python3 scripts/research/nonogram_experiment.py phone --input <dir>/candidates.csv
    python3 scripts/research/nonogram_experiment.py targeted

supply は図柄の候補を作り、仮置きなしで解けるもの（解は一意）を採って特徴を CSV に書く。
levels は5段階の組み合わせ案で分け、帯ごとの分布と供給の見込みを出す。
naive は「ヒントにちょうど合った行・列だけが分かる」知らせのもとで、試し塗りで押し切れるかを測る。
phone は幅320 / 390 でのマスの大きさを計算する。
targeted は最上位の大きさと生成条件に絞って、レベル5の問題が作れる速さを測る。
"""

from __future__ import annotations

import argparse
import csv
import itertools
import random
import statistics
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from nonogram_core import (
    BLACK,
    UNKNOWN,
    WHITE,
    Image,
    PatternParams,
    Puzzle,
    analyze,
    canonical_key,
    clue_of,
    count_solutions,
    generate_pattern,
    line_solvable,
    pattern_quality,
    solve_line_full,
    solve_line_lr,
    symmetry_variants,
)

SIZES = ((7, 7), (8, 8), (9, 9), (10, 10), (12, 10), (13, 10), (15, 10))  # (高さ, 幅)。表には幅×高さで出す
DENSITIES = (0.45, 0.50, 0.55, 0.60, 0.65)
SMOOTHS = (0, 1, 2)
MIRRORS = (True, False)


# ---------------------------------------------------------------------------
# 図柄の条件（AI判断の仮置き。supply で分布を見て決めた値）
# ---------------------------------------------------------------------------

MIN_BLACK_RATIO = 0.35
MAX_BLACK_RATIO = 0.72
MAX_BLANK_LINES = 1  # 黒の無い行・列の数（縦横合わせて）
MAX_ISOLATED_RATIO = 0.12  # 上下左右に黒の無い黒マスの割合


def passes_pattern_filter(image: Image) -> bool:
    quality = pattern_quality(image)
    return (
        MIN_BLACK_RATIO <= quality.black_ratio <= MAX_BLACK_RATIO
        and quality.blank_rows + quality.blank_cols <= MAX_BLANK_LINES
        and quality.isolated_ratio <= MAX_ISOLATED_RATIO
    )


# ---------------------------------------------------------------------------
# 5段階の組み合わせ案（データ。分類コードに埋め込まない）
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LevelRule:
    level: int
    sizes: tuple[tuple[int, int], ...]
    rounds: tuple[int, int]  # 連鎖の深さ（段数）の範囲（両端を含む）
    max_entry_lines: int  # 最初の段で進められる行・列の数の上限
    min_narrow_rounds: int  # 進められる行・列が2本以下の段の数の下限
    min_full_only: int  # 端寄せの読みでは進まない読みの回数の下限


LEVEL_RULES: tuple[LevelRule, ...] = (
    LevelRule(1, ((7, 7), (8, 8)), (2, 4), 99, 0, 0),
    LevelRule(2, ((8, 8), (9, 9)), (5, 6), 12, 0, 0),
    LevelRule(3, ((9, 9), (10, 10)), (7, 8), 10, 1, 0),
    LevelRule(4, ((10, 10), (12, 10)), (9, 11), 8, 2, 0),
    LevelRule(5, ((12, 10), (13, 10), (15, 10)), (12, 20), 7, 3, 0),
)


def classify(size: tuple[int, int], row: dict[str, float]) -> list[int]:
    """当てはまるレベルの一覧（重なりを見るため複数返す）。"""
    out = []
    for rule in LEVEL_RULES:
        if size not in rule.sizes:
            continue
        if not rule.rounds[0] <= row["rounds"] <= rule.rounds[1]:
            continue
        if row["entry_lines"] > rule.max_entry_lines:
            continue
        if row["narrow_rounds"] < rule.min_narrow_rounds:
            continue
        if row["full_only_lines"] < rule.min_full_only:
            continue
        out.append(rule.level)
    return out


# ---------------------------------------------------------------------------
# selfcheck
# ---------------------------------------------------------------------------


def _brute_line(clue: tuple[int, ...], line: tuple[int, ...]) -> tuple[int, ...] | None:
    n = len(line)
    sols = []
    for bits in itertools.product((WHITE, BLACK), repeat=n):
        if any(line[i] != UNKNOWN and line[i] != bits[i] for i in range(n)):
            continue
        if clue_of(bits) == clue:
            sols.append(bits)
    if not sols:
        return None
    out = []
    for i in range(n):
        values = {s[i] for s in sols}
        out.append(values.pop() if len(values) == 1 else UNKNOWN)
    return tuple(out)


def _brute_count(puzzle: Puzzle) -> int:
    count = 0
    for bits in itertools.product((WHITE, BLACK), repeat=puzzle.height * puzzle.width):
        image = tuple(tuple(bits[r * puzzle.width : (r + 1) * puzzle.width]) for r in range(puzzle.height))
        if Puzzle.from_image(image) == puzzle:
            count += 1
    return count


def run_selfcheck(_: argparse.Namespace) -> None:
    rng = random.Random(20261101)
    # 1. 完全な線の読みは総当たりと一致し、端寄せの読みは完全な読みより強くない。
    lr_weaker = 0
    for _ in range(4000):
        n = rng.randint(1, 12)
        solution = tuple(BLACK if rng.random() < 0.55 else WHITE for _ in range(n))
        clue = clue_of(solution)
        line = tuple(v if rng.random() < 0.3 else UNKNOWN for v in solution)
        if rng.random() < 0.2:
            i = rng.randrange(n)
            line = line[:i] + (1 - solution[i],) + line[i + 1 :]
        expected = _brute_line(clue, line)
        assert solve_line_full(clue, line) == expected, (clue, line)
        lr = solve_line_lr(clue, line)
        if expected is None:
            assert lr is None
            continue
        assert lr is not None
        for i in range(n):
            if lr[i] != UNKNOWN:
                assert lr[i] == expected[i], ("lr unsound", clue, line)
        if lr != expected:
            lr_weaker += 1
    assert lr_weaker > 0, "端寄せの読みが完全な読みと同じになっている"
    # 2. 解の数え上げは総当たりと一致し、仮置きなしで解ける問題は一意。
    for _ in range(150):
        h = rng.randint(2, 4)
        w = rng.randint(2, 4)
        image = tuple(tuple(BLACK if rng.random() < 0.5 else WHITE for _ in range(w)) for _ in range(h))
        puzzle = Puzzle.from_image(image)
        brute = _brute_count(puzzle)
        found, _, aborted = count_solutions(puzzle, limit=99)
        assert not aborted and found == brute, (image, found, brute)
        if line_solvable(puzzle):
            assert brute == 1
    # 3. 既知の例: 2×2 の対角は2解、仮置きなしでは解けない。
    diagonal = Puzzle.from_image(((1, 0), (0, 1)))
    assert count_solutions(diagonal)[0] == 2 and not line_solvable(diagonal)
    # 4. 正規化キーは回転・反転で変わらない。
    image = generate_pattern(10, 10, PatternParams(0.55, 1, False), rng)
    keys = {canonical_key(v) for v in symmetry_variants(image)}
    assert len(keys) == 1
    # 5. 特徴: 全塗りの 5×5 は1段で解ける。
    full = Puzzle.from_image(tuple((1,) * 5 for _ in range(5)))
    features = analyze(full)
    assert features.solvable and features.rounds == 1 and features.entry_lines == 10
    # 6. 素朴なプレイヤーは全塗りを試し塗りなしで解く。
    outcome = naive_play(full_image := tuple((1,) * 5 for _ in range(5)), Puzzle.from_image(full_image), True, 50)
    assert outcome.cleared and outcome.trial_fills == 0
    print("selfcheck ok", f"(端寄せの読みが完全な読みより弱かった行: {lr_weaker}/4000)")


# ---------------------------------------------------------------------------
# supply
# ---------------------------------------------------------------------------

CSV_FIELDS = (
    "height",
    "width",
    "params",
    "seed_index",
    "image",
    "rounds",
    "entry_lines",
    "first_round_ratio",
    "min_progress_lines",
    "narrow_rounds",
    "narrow_ratio",
    "full_only_lines",
    "max_clue_count_row",
    "max_clue_count_col",
    "max_clue_value_col",
    "black_ratio",
    "isolated_ratio",
    "components",
    "mirror",
    "analyze_ms",
)


def run_supply(args: argparse.Namespace) -> None:
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    params_grid = [PatternParams(d, s, m) for d in DENSITIES for s in SMOOTHS for m in MIRRORS]
    summary: dict[tuple[tuple[int, int], str], Counter] = defaultdict(Counter)
    timings: dict[tuple[int, int], list[float]] = defaultdict(list)
    unique_check: dict[tuple[int, int], Counter] = defaultdict(Counter)
    with (out_dir / "candidates.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for size in SIZES:
            height, width = size
            for params in params_grid:
                for index in range(args.per_params):
                    t0 = time.perf_counter()
                    image = generate_pattern(height, width, params, rng)
                    counter = summary[(size, params.key())]
                    counter["candidates"] += 1
                    if not passes_pattern_filter(image):
                        counter["filtered"] += 1
                        timings[size].append(time.perf_counter() - t0)
                        continue
                    puzzle = Puzzle.from_image(image)
                    solvable = line_solvable(puzzle)
                    elapsed = time.perf_counter() - t0
                    timings[size].append(elapsed)
                    if not solvable:
                        counter["needs_guess_or_multi"] += 1
                        # 一部だけ数え上げて、一意だが仮置きが要るものと複数解を分ける。
                        if unique_check[size]["checked"] < args.unique_sample:
                            unique_check[size]["checked"] += 1
                            found, nodes, aborted = count_solutions(puzzle)
                            if aborted:
                                unique_check[size]["aborted"] += 1
                            elif found == 1:
                                unique_check[size]["unique_needs_guess"] += 1
                            else:
                                unique_check[size]["multi"] += 1
                        continue
                    counter["accepted"] += 1
                    t1 = time.perf_counter()
                    features = analyze(puzzle)
                    analyze_ms = (time.perf_counter() - t1) * 1000
                    quality = pattern_quality(image)
                    writer.writerow(
                        {
                            "height": height,
                            "width": width,
                            "params": params.key(),
                            "seed_index": index,
                            "image": "/".join("".join(str(v) for v in row) for row in image),
                            "rounds": features.rounds,
                            "entry_lines": features.entry_lines,
                            "first_round_ratio": f"{features.first_round_ratio:.4f}",
                            "min_progress_lines": features.min_progress_lines,
                            "narrow_rounds": features.narrow_rounds,
                            "narrow_ratio": f"{features.narrow_ratio:.4f}",
                            "full_only_lines": features.full_only_lines,
                            "max_clue_count_row": features.max_clue_count_row,
                            "max_clue_count_col": features.max_clue_count_col,
                            "max_clue_value_col": max((max(c) if c else 0) for c in puzzle.cols),
                            "black_ratio": f"{quality.black_ratio:.4f}",
                            "isolated_ratio": f"{quality.isolated_ratio:.4f}",
                            "components": quality.components,
                            "mirror": int(quality.mirror_symmetric),
                            "analyze_ms": f"{analyze_ms:.2f}",
                        }
                    )
    print("## 供給（大きさごと。全生成条件の合計）")
    print("| 大きさ（幅×高さ） | 候補 | 図柄の条件で除外 | 仮置きなしで解ける（採用） | 採用率 | 1候補の平均ms | 抜き取り: 一意だが仮置きが要る / 複数解 / 打ち切り |")
    print("|---|---:|---:|---:|---:|---:|---|")
    for size in SIZES:
        total = Counter()
        for (s, _), counter in summary.items():
            if s == size:
                total.update(counter)
        u = unique_check[size]
        print(
            f"| {size[1]}×{size[0]} | {total['candidates']} | {total['filtered']} | {total['accepted']} | "
            f"{total['accepted'] / total['candidates']:.1%} | {statistics.mean(timings[size]) * 1000:.1f} | "
            f"{u['unique_needs_guess']} / {u['multi']} / {u['aborted']}（{u['checked']}件中） |"
        )
    print()
    print("## 生成条件ごとの採用率（全大きさの合計）")
    by_params: dict[str, Counter] = defaultdict(Counter)
    for (_, key), counter in summary.items():
        by_params[key].update(counter)
    print("| 生成条件 | 候補 | 除外 | 採用 | 採用率 |")
    print("|---|---:|---:|---:|---:|")
    for key in sorted(by_params):
        c = by_params[key]
        print(f"| {key} | {c['candidates']} | {c['filtered']} | {c['accepted']} | {c['accepted'] / c['candidates']:.1%} |")


# ---------------------------------------------------------------------------
# levels
# ---------------------------------------------------------------------------


def _read(path: str) -> list[dict]:
    rows = []
    with open(path, newline="") as handle:
        for row in csv.DictReader(handle):
            parsed: dict = dict(row)
            for key in CSV_FIELDS:
                if key in ("params", "image"):
                    continue
                parsed[key] = float(row[key])
            parsed["size"] = (int(row["height"]), int(row["width"]))
            rows.append(parsed)
    return rows


def _q(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(p * len(ordered)))]


def _fmt(values: list[float], digits: int = 0) -> str:
    if not values:
        return "-"
    return f"{_q(values, 0.1):.{digits}f} / {_q(values, 0.5):.{digits}f} / {_q(values, 0.9):.{digits}f}"


def _spearman(xs: list[float], ys: list[float]) -> float:
    def ranks(values: list[float]) -> list[float]:
        order = sorted(range(len(values)), key=lambda i: values[i])
        result = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            for t in range(i, j + 1):
                result[order[t]] = (i + j) / 2
            i = j + 1
        return result

    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    vx = sum((a - mx) ** 2 for a in rx) ** 0.5
    vy = sum((b - my) ** 2 for b in ry) ** 0.5
    return cov / (vx * vy) if vx and vy else float("nan")


FEATURES = ("rounds", "entry_lines", "first_round_ratio", "narrow_rounds", "min_progress_lines", "full_only_lines")


def run_levels(args: argparse.Namespace) -> None:
    rows = _read(args.input)
    print("## 大きさごとの特徴（10 / 50 / 90 パーセンタイル）")
    print("| 大きさ（幅×高さ） | 問題数 | 連鎖の深さ | 最初に進められる行・列 | 最初の段で決まる割合 | 細い段の数 | 端寄せで進まない読み | 列ヒントの数の最大 |")
    print("|---|---:|---|---|---|---|---|---|")
    by_size: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for row in rows:
        by_size[row["size"]].append(row)
    for size in SIZES:
        group = by_size[size]
        print(
            f"| {size[1]}×{size[0]} | {len(group)} | {_fmt([r['rounds'] for r in group])} | "
            f"{_fmt([r['entry_lines'] for r in group])} | {_fmt([r['first_round_ratio'] for r in group], 2)} | "
            f"{_fmt([r['narrow_rounds'] for r in group])} | {_fmt([r['full_only_lines'] for r in group])} | "
            f"{_fmt([r['max_clue_count_col'] for r in group])} |"
        )
    print()
    print("## 特徴どうしの順位相関（全問題）")
    names = ("area", "rounds", "entry_lines", "narrow_rounds", "full_only_lines", "black_ratio")
    values = {
        "area": [r["height"] * r["width"] for r in rows],
        **{name: [r[name] for r in rows] for name in names if name != "area"},
    }
    print("| | " + " | ".join(names) + " |")
    print("|---|" + "---:|" * len(names))
    for a in names:
        print(f"| {a} | " + " | ".join(f"{_spearman(values[a], values[b]):.2f}" for b in names) + " |")
    print()
    print("## 生成条件と特徴（10×10）")
    print("| 生成条件 | 問題数 | 連鎖の深さ | 最初に進められる行・列 | 細い段の数 |")
    print("|---|---:|---|---|---|")
    by_params: dict[str, list[dict]] = defaultdict(list)
    for row in by_size[(10, 10)]:
        by_params[row["params"]].append(row)
    for key in sorted(by_params):
        group = by_params[key]
        print(
            f"| {key} | {len(group)} | {_fmt([r['rounds'] for r in group])} | "
            f"{_fmt([r['entry_lines'] for r in group])} | {_fmt([r['narrow_rounds'] for r in group])} |"
        )
    print()
    # 5段階
    classified: dict[int, list[dict]] = defaultdict(list)
    overlap = 0
    unclassified = 0
    for row in rows:
        levels = classify(row["size"], row)
        if len(levels) > 1:
            overlap += 1
        if not levels:
            unclassified += 1
        for level in levels[-1:]:  # 重なったら上のレベルに入れる
            classified[level].append(row)
    print("## 5段階の組み合わせ案")
    print("| レベル | 大きさ（幅×高さ） | 連鎖の深さ | 最初に進められる行・列の上限 | 細い段の数の下限 |")
    print("|---|---|---|---|---|")
    for rule in LEVEL_RULES:
        sizes = "、".join(f"{w}×{h}" for h, w in rule.sizes)
        hi = "以上" if rule.rounds[1] >= 99 else f"〜{rule.rounds[1]}"
        rounds = f"{rule.rounds[0]}{hi}" if rule.rounds[1] >= 99 else f"{rule.rounds[0]}{hi}"
        entry = "―" if rule.max_entry_lines >= 99 else f"{rule.max_entry_lines}"
        narrow = "―" if rule.min_narrow_rounds == 0 else f"{rule.min_narrow_rounds}"
        print(f"| {rule.level} | {sizes} | {rounds} | {entry} | {narrow} |")
    print()
    print("## 帯ごとの分布（10 / 50 / 90 パーセンタイル）")
    print("| レベル | 問題数 | 面積 | 連鎖の深さ | 最初に進められる行・列 | 最初の段で決まる割合 | 細い段の数 | 進められる行・列の最小 | 端寄せの読みでは進まない読みを含む割合 | 特徴の計算 ms（中央値） | 重複（正規化キー） |")
    print("|---|---:|---|---|---|---|---|---|---:|---:|---:|")
    for level in range(1, 6):
        group = classified[level]
        keys = Counter(canonical_key(tuple(tuple(int(ch) for ch in part) for part in r["image"].split("/"))) for r in group)
        dup = sum(c - 1 for c in keys.values() if c > 1)
        print(
            f"| {level} | {len(group)} | {_fmt([r['height'] * r['width'] for r in group])} | "
            f"{_fmt([r['rounds'] for r in group])}（最大 {max((r['rounds'] for r in group), default=0):.0f}） | {_fmt([r['entry_lines'] for r in group])} | "
            f"{_fmt([r['first_round_ratio'] for r in group], 2)} | {_fmt([r['narrow_rounds'] for r in group])} | "
            f"{_fmt([r['min_progress_lines'] for r in group])} | "
            f"{sum(1 for r in group if r['full_only_lines'] > 0) / max(1, len(group)):.0%} | "
            f"{_q([r['analyze_ms'] for r in group], .5):.1f} | {dup} |"
        )
    print(f"\n重なり（2レベル以上に当たる問題）: {overlap}、どのレベルにも入らない: {unclassified} / {len(rows)}")
    if args.candidates_per_size:
        print("\n## 供給の見込み（そのレベルの大きさで作った候補あたり）")
        print("| レベル | 候補 | 当たった問題 | 候補あたり | 500問に要る候補（重複を除く前） |")
        print("|---|---:|---:|---:|---:|")
        for rule in LEVEL_RULES:
            candidates = args.candidates_per_size * len(rule.sizes)
            hit = len(classified[rule.level])
            rate = hit / candidates
            print(f"| {rule.level} | {candidates} | {hit} | {rate:.2%} | {500 / rate if rate else float('inf'):,.0f} |")
    # 上のレベルが下のどの量も下げないか（中央値と10/90パーセンタイル）
    print("\n## 上のレベルが下の量を下げないか（中央値・10・90パーセンタイルを隣り合うレベルで比べる）")
    directions = {
        "area": 1,
        "rounds": 1,
        "entry_lines": -1,
        "first_round_ratio": -1,
        "narrow_rounds": 1,
        "min_progress_lines": -1,
    }
    violations = []
    for name, direction in directions.items():
        for level in range(1, 5):
            lower = classified[level]
            upper = classified[level + 1]
            get = (lambda r: r["height"] * r["width"]) if name == "area" else (lambda r, n=name: r[n])
            for p in (0.1, 0.5, 0.9):
                a = _q([get(r) for r in lower], p)
                b = _q([get(r) for r in upper], p)
                if (b - a) * direction < 0:
                    violations.append(f"{name} p{int(p * 100)}: L{level}={a} → L{level + 1}={b}")
    print("逆転: " + ("なし" if not violations else "; ".join(violations)))
    # 同じレベルの中で広い盤面ほど易しくならないか
    print("\n## 同じレベルの中の大きさごとの中央値（盤面の逆転の確認）")
    print("| レベル | 大きさ（幅×高さ） | 問題数 | 連鎖の深さ | 最初に進められる行・列 | 細い段の数 |")
    print("|---|---|---:|---:|---:|---:|")
    for level in range(1, 6):
        per = defaultdict(list)
        for r in classified[level]:
            per[r["size"]].append(r)
        for size in sorted(per):
            g = per[size]
            print(
                f"| {level} | {size[1]}×{size[0]} | {len(g)} | {_q([r['rounds'] for r in g], .5):.0f} | "
                f"{_q([r['entry_lines'] for r in g], .5):.0f} | {_q([r['narrow_rounds'] for r in g], .5):.0f} |"
            )
    # 供給の見込み: 候補 1000 件あたりの採用数（大きさごと）
    print("\n## 生成条件の偏り（レベルごとに、どの生成条件から来たか。上位3つ）")
    for level in range(1, 6):
        c = Counter(r["params"] for r in classified[level])
        total = sum(c.values())
        top = ", ".join(f"{k} {v / total:.0%}" for k, v in c.most_common(3)) if total else "-"
        print(f"- L{level}（{total}問、生成条件 {len(c)} 種）: {top}")
    if args.write_levels:
        with open(args.write_levels, "w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(("level", "height", "width", "image"))
            for level in range(1, 6):
                for r in classified[level]:
                    writer.writerow((level, int(r["height"]), int(r["width"]), r["image"]))


# ---------------------------------------------------------------------------
# naive: 素朴なプレイヤー
# ---------------------------------------------------------------------------


@dataclass
class NaiveOutcome:
    cleared: bool
    trial_fills: int  # 試しに塗った回数
    reverted_fills: int  # 試しに塗って、後で消した回数
    nodes: int


def _filled_clue(line: list[int]) -> tuple[int, ...]:
    return clue_of([BLACK if v == BLACK else WHITE for v in line])


def _visibly_broken(clue: tuple[int, ...], line: list[int]) -> bool:
    """数えるだけで分かる破綻（行を読み解かなくても見える）。"""
    filled = sum(1 for v in line if v == BLACK)
    unknown = sum(1 for v in line if v == UNKNOWN)
    need = sum(clue)
    if filled > need:
        return True
    if filled + unknown < need:
        return True
    runs = _filled_clue(line)
    if runs and (not clue or max(runs) > max(clue)):
        return True
    if unknown == 0 and runs != clue:
        return True
    return False


def naive_play(solution: Image, puzzle: Puzzle, use_signal: bool, budget: int) -> NaiveOutcome:
    """素朴なプレイヤー。

    読み: 空の行（ヒントが無い）と、何も決まっていない行での重なりだけを最初に使う。以降は行・列を読まない。
    知らせ: use_signal のとき、塗りがヒントにちょうど合った行・列の残りを×にする（知らせを信じる）。
    試し塗り: 行・列の中で黒の足りない数が最も少ない線の、未確定マスを塗ってみる。数えるだけで分かる破綻
    （塗りすぎ・塊が長すぎ・埋まったのに合わない・足りない）が出たら戻して×にする。
    破綻が出ないまま行き詰まったら、最後の試し塗りまで戻る（深さ優先）。塗ったマスの集合が解と一致したらクリア。
    """
    height, width = puzzle.height, puzzle.width
    solution_cells = {(r, c) for r in range(height) for c in range(width) if solution[r][c] == BLACK}
    grid = [[UNKNOWN] * width for _ in range(height)]
    for r in range(height):
        start = solve_line_full(puzzle.rows[r], tuple([UNKNOWN] * width))
        assert start is not None
        for c in range(width):
            if start[c] != UNKNOWN:
                grid[r][c] = start[c]
    for c in range(width):
        start = solve_line_full(puzzle.cols[c], tuple([UNKNOWN] * height))
        assert start is not None
        for r in range(height):
            if start[r] != UNKNOWN and grid[r][c] == UNKNOWN:
                grid[r][c] = start[r]
    trial = 0
    reverted = 0
    nodes = 0

    def lines(g):
        for r in range(height):
            yield puzzle.rows[r], [g[r][c] for c in range(width)], [(r, c) for c in range(width)]
        for c in range(width):
            yield puzzle.cols[c], [g[r][c] for r in range(height)], [(r, c) for r in range(height)]

    def settle(g) -> bool:
        changed = True
        while changed:
            changed = False
            for clue, line, cells in lines(g):
                if _visibly_broken(clue, line):
                    return False
                if use_signal and _filled_clue(line) == clue:
                    for (r, c), v in zip(cells, line):
                        if v == UNKNOWN:
                            g[r][c] = WHITE
                            changed = True
        return True

    def cleared(g) -> bool:
        return {(r, c) for r in range(height) for c in range(width) if g[r][c] == BLACK} == solution_cells

    def choose(g):
        best = None
        for clue, line, cells in lines(g):
            missing = sum(clue) - sum(1 for v in line if v == BLACK)
            if missing <= 0:
                continue
            unknown_cells = [cell for cell, v in zip(cells, line) if v == UNKNOWN]
            if not unknown_cells:
                continue
            # 既に塗ったマスの隣を優先する
            adjacent = [
                cell
                for i, (cell, v) in enumerate(zip(cells, line))
                if v == UNKNOWN and ((i > 0 and line[i - 1] == BLACK) or (i + 1 < len(line) and line[i + 1] == BLACK))
            ]
            pick = adjacent[0] if adjacent else unknown_cells[0]
            score = (missing, len(unknown_cells))
            if best is None or score < best[0]:
                best = (score, pick)
        return None if best is None else best[1]

    def search(g) -> bool:
        nonlocal trial, reverted, nodes
        nodes += 1
        if nodes > budget:
            return False
        if not settle(g):
            return False
        if cleared(g):
            return True
        cell = choose(g)
        if cell is None:
            return False
        r, c = cell
        child = [row[:] for row in g]
        child[r][c] = BLACK
        trial += 1
        if search(child):
            return True
        if nodes > budget:
            return False
        reverted += 1
        child = [row[:] for row in g]
        child[r][c] = WHITE
        return search(child)

    ok = settle(grid) and (cleared(grid) or search(grid))
    return NaiveOutcome(ok, trial, reverted, nodes)


def run_naive(args: argparse.Namespace) -> None:
    rows = _read(args.input)
    rng = random.Random(args.seed)
    classified: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        levels = classify(row["size"], row)
        if levels:
            classified[levels[-1]].append(row)
    print(f"## 素朴なプレイヤー（各レベル {args.sample} 問を抜き取り、試し塗りの上限 {args.budget} 節点）")
    print("| レベル | 知らせ | クリアできた割合 | 試し塗りの回数（10/50/90） | 塗り直し（10/50/90） | 30回以内でクリア |")
    print("|---|---|---:|---|---|---:|")
    for level in range(1, 6):
        group = classified[level]
        sample = rng.sample(group, min(args.sample, len(group)))
        for use_signal in (True, False):
            outcomes = []
            for row in sample:
                image = tuple(tuple(int(ch) for ch in part) for part in row["image"].split("/"))
                outcomes.append(naive_play(image, Puzzle.from_image(image), use_signal, args.budget))
            cleared = [o for o in outcomes if o.cleared]
            quick = sum(1 for o in cleared if o.trial_fills <= 30)
            print(
                f"| {level} | {'あり' if use_signal else 'なし'} | {len(cleared)}/{len(outcomes)} | "
                f"{_fmt([o.trial_fills for o in cleared])} | {_fmt([o.reverted_fills for o in cleared])} | {quick}/{len(outcomes)} |"
            )


# ---------------------------------------------------------------------------
# phone: マスの大きさ
# ---------------------------------------------------------------------------

# 既存のプレイ画面（マインスイーパー）の余白: main の px-2（左右 8px ずつ）、py-3。見出し 28px + 72px。
SIDE_PADDING = 8
CLUE_GAP = 4  # ヒントと盤面の間
CLUE_FONT_RATIO = 0.55  # ヒントの字の大きさ ≒ マスの 0.55 倍（下限 10px）
DIGIT_WIDTH_RATIO = 0.62  # 等幅数字の幅 ≒ 字の大きさの 0.62 倍
CLUE_SPACING = 3  # 数字どうしの間
HEADERS = 28 + 72
MAIN_VERTICAL_PADDING = 24
FOOTER = 112  # 既存ゲームの操作の帯（h-28）


def cell_size(width: int, height: int, row_count: int, row_digits: int, col_count: int, viewport_w: int, viewport_h: int) -> tuple[float, float]:
    """(横幅で決まるマスの大きさ, 縦も収めたときのマスの大きさ)。

    行ヒントは横に並べる。幅10列までは2桁の数（10）は1つだけの行にしか出ないので、1桁 × 個数で幅を見積もる。
    列ヒントは縦に積む。
    """
    best_w = 0.0
    best_h = 0.0
    for tenth in range(80, 700):
        size = tenth / 10
        font = max(10.0, size * CLUE_FONT_RATIO)
        row_clue_width = row_count * (row_digits * font * DIGIT_WIDTH_RATIO + CLUE_SPACING)
        col_clue_height = col_count * (font * 1.1)
        if SIDE_PADDING * 2 + row_clue_width + CLUE_GAP + size * width <= viewport_w:
            best_w = size
            if HEADERS + MAIN_VERTICAL_PADDING + FOOTER + col_clue_height + CLUE_GAP + size * height <= viewport_h:
                best_h = size
    return best_w, best_h


def run_phone(args: argparse.Namespace) -> None:
    rows = _read(args.input) if args.input else []
    by_size: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for row in rows:
        by_size[row["size"]].append(row)
    viewports = ((320, 568), (375, 667), (390, 664), (390, 844))
    print("## マスの大きさ（px）。行ヒントの数は採用問題の95パーセンタイルと理論上の最大")
    print("| 盤面（幅×高さ） | 行ヒントの数 p95 / 最大 | 列ヒントの数 p95 / 最大 | " + " | ".join(f"{w}×{h}" for w, h in viewports) + " |")
    print("|---|---|---|" + "---|" * len(viewports))
    for size in SIZES + ((15, 15),):
        height, width = size
        group = by_size.get(size, [])
        row_p95 = int(_q([r["max_clue_count_row"] for r in group], 0.95)) if group else (width + 1) // 2
        col_p95 = int(_q([r["max_clue_count_col"] for r in group], 0.95)) if group else (height + 1) // 2
        row_max = (width + 1) // 2
        col_max = (height + 1) // 2
        cells = []
        for vw, vh in viewports:
            w95, h95 = cell_size(width, height, row_p95, 1, col_p95, vw, vh)
            wmax, hmax = cell_size(width, height, row_max, 1, col_max, vw, vh)
            cells.append(f"横 {w95:.0f}（最大 {wmax:.0f}）/ 縦も {h95:.0f}（最大 {hmax:.0f}）")
        print(f"| {width}×{height} | {row_p95} / {row_max} | {col_p95} / {col_max} | " + " | ".join(cells) + " |")


def run_targeted(args: argparse.Namespace) -> None:
    """最上位の大きさと生成条件に絞って候補を作り、レベル5に当たる速さと重複を測る。"""
    rng = random.Random(args.seed)
    sizes = ((12, 10), (13, 10), (15, 10))
    params_grid = [PatternParams(d, s, False) for d in (0.45, 0.50) for s in (0, 1)]
    hits: list[str] = []
    candidates = 0
    t0 = time.perf_counter()
    while len(hits) < args.target and candidates < args.max_candidates:
        size = sizes[candidates % len(sizes)]
        params = params_grid[(candidates // len(sizes)) % len(params_grid)]
        candidates += 1
        image = generate_pattern(size[0], size[1], params, rng)
        if not passes_pattern_filter(image):
            continue
        puzzle = Puzzle.from_image(image)
        if not line_solvable(puzzle):
            continue
        features = analyze(puzzle)
        row = {key: float(getattr(features, key)) for key in ("rounds", "entry_lines", "narrow_rounds", "full_only_lines")}
        if 5 in classify(size, row):
            hits.append(canonical_key(image))
    elapsed = time.perf_counter() - t0
    unique = len(set(hits))
    print(
        f"レベル5: {len(hits)}問（重複を除いて {unique}問）/ 候補 {candidates}（{len(hits) / candidates:.2%}）、"
        f"{elapsed:.1f}秒（1問あたり {elapsed / max(1, len(hits)) * 1000:.0f}ms、Python 1コア）"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selfcheck")
    supply = sub.add_parser("supply")
    supply.add_argument("--out", required=True)
    supply.add_argument("--seed", type=int, default=17)
    supply.add_argument("--per-params", type=int, default=60)
    supply.add_argument("--unique-sample", type=int, default=60)
    levels = sub.add_parser("levels")
    levels.add_argument("--input", required=True)
    levels.add_argument("--write-levels")
    levels.add_argument("--candidates-per-size", type=int, default=0)
    naive = sub.add_parser("naive")
    naive.add_argument("--input", required=True)
    naive.add_argument("--seed", type=int, default=5)
    naive.add_argument("--sample", type=int, default=60)
    naive.add_argument("--budget", type=int, default=3000)
    targeted = sub.add_parser("targeted")
    targeted.add_argument("--seed", type=int, default=23)
    targeted.add_argument("--target", type=int, default=500)
    targeted.add_argument("--max-candidates", type=int, default=200000)
    phone = sub.add_parser("phone")
    phone.add_argument("--input")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    {
        "selfcheck": run_selfcheck,
        "supply": run_supply,
        "levels": run_levels,
        "naive": run_naive,
        "phone": run_phone,
        "targeted": run_targeted,
    }[args.command](args)


if __name__ == "__main__":
    main()
