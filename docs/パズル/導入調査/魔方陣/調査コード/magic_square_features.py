#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）の図鑑の問題の特徴の調査コード。

/add-puzzle の調査の「図鑑と問題の特徴」の観点で、始めたときの盤面で分かる特徴の案を比べるために使った。
標準ライブラリだけで書き、乱数は seed を固定する。製品のコードはこのファイルに依存しない。
読むモデル・分類・候補の生成は magic_square_difficulty.py（版 8 の C2。分類は classify_givens、
盤面の割り当ては SIZES_V6）を呼ぶだけで、ここには持たない。

サブコマンド:
  sample4   4×4 の候補を difficulty の続きの番号で作り、版 8 で分類して JSONL に書く（L1・L2 の 4×4 を増やす）。
            範囲内の問題には、慣れた試し置きの戻し（classify の naive_rp_undos と同じ乱数）も書く
  undos     戻しを持たない sample4 の結果に、範囲内の問題の戻しを書き足す
  measure   classify の結果（と sample4 の結果）の範囲内の問題で、特徴の案ごとに
            (1) レベルの中の値の分かれ方、(2) 特徴どうしの順位相関、(3) 難易度（レベル・読みの量）との順位相関、
            (4) 問題集の同型の判定（回転・裏返し 8通り / 列の構造を保つ並べ替え × 補数）で値が変わらないか、
            (5) 問題集に近い形（問題を作る生成条件だけ・2つの盤面を半分ずつ）での推奨の3つの選択肢、を表にする
  examples  遊び方・チュートリアルの例の魔方陣が、同型の判定ごとに何通りの 4×4 の魔方陣を問題集から除くか

再現の仕方（版 8）:
  D=docs/パズル/導入調査/魔方陣/調査コード
  （難易度の資料の付録 A.2 の「版 8 の候補」の corpus 5本・agree・classify で classified.jsonl を作る）
  python3 $D/magic_square_features.py sample4 --l1 500 --l2 400 --out s4v8.jsonl   # 1プロセスで約47分
  python3 $D/magic_square_features.py measure classified.jsonl --extra s4v8.jsonl             # 最初の数を2個ごと（約10秒）
  python3 $D/magic_square_features.py measure classified.jsonl --extra s4v8.jsonl --width 3   # 3個ごと（比べた幅）
  python3 $D/magic_square_features.py examples
  （戻しを書く前の sample4 で作った結果は、undos s4v8.jsonl --out s4v8u.jsonl で戻しを足してから measure に渡す）

measure の入力は classify の形の JSONL（id・T・k・level・features（FEATURE_KEYS）・givens・naive_rp_undos）。
範囲内（level が null でない）の問題だけを使う。4×4 は本文の候補と sample4 を合わせ、同じ与える数を1つにして数える。
measure は、入力の features が今のコードの読むモデルで測り直した値と同じかも数える（classify を作った後に
読むモデルが変わっていないかの確かめ）。
"""

from __future__ import annotations

import argparse
import collections
import json
import multiprocessing as mp
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import magic_square_difficulty as m  # noqa: E402
from magic_square_adoption import line_automorphisms  # noqa: E402

# ---------------------------------------------------------------------------
# 始めたときの盤面で分かる特徴の案（与える数だけから数える）
# ---------------------------------------------------------------------------

# 案の名前 → (表示名, 単位, 図鑑の値の形にそのまま載るか)
CANDIDATES = {
    "size": ("盤面", "", True),
    "givens": ("最初の数", "個", True),
    "empties": ("空き", "マス", True),
    "one_empty_lines": ("1マスだけ空いた列", "本", True),
    "two_empty_lines": ("2マス空いた列", "本", True),
    "full_lines": ("埋まった列", "本", True),
    "empty_lines": ("空きだけの列", "本", True),
    "min_open_line": ("いちばん埋まった列の空き", "マス", True),
    "diag_empties": ("斜めの空き", "マス", True),
    "corner_givens": ("角の数", "個", True),
    "extremes": ("1 と n² のうち置いてある数", "個", True),
    "large_givens": ("大きい数（n²/2 より大きい）", "個", True),
    "imbalance": ("大きい数と小さい数の差", "個", True),
    "layout_sym": ("配置が回転・裏返しで重なる", "", False),
    "rot_pair_share": ("点対称の位置にも数がある割合", "", False),
    "entry": ("最初の1巡で決まるマス（難易度の入口）", "マス", True),
}
FEATURES = list(CANDIDATES)
CHOSEN = ("size", "givens", "empty_lines")  # 前の回（版 4）に決めた3つ

# 難易度の読みの量（magic_square_difficulty.py の read_features。資料 §3・§11 の「巡・段3・突き合わせ」と、
# 版 8 の梯子と帯に使う段2の巡の最大・3巡以上の所・最初の所の巡）
READ_KEYS = ("hard", "sweeps_hard", "t3", "deep", "deep3", "d2max", "first_sweeps", "t1depth")
READ_LABELS = {"hard": "組の突き合わせの回数", "sweeps_hard": "段2以上の所の巡の合計", "t3": "段3の所の数",
               "deep": "段2以上で2巡以上の所の数", "deep3": "段2以上で3巡以上の所の数", "d2max": "段2の所の巡の最大",
               "first_sweeps": "最初の所の巡", "t1depth": "段1の巡の数（段1だけで解ける問題）",
               "undos": "慣れた試し置きの戻し"}

# 問題集を作る生成条件（推測: 難易度の資料 §6.2 の当たる割合の高い条件。問題供給の観点が決める）
# (レベル, 盤面) → 許す (T, k) の集まり。None は制限しない。
POOL_CONDS = {
    (1, 4): {(1, 0)},
    (2, 4): {(2, 0), (2, 1), (3, 1)},
    (2, 5): {(T, k) for T in (2, 3) for k in (0, 1, 2)},
    (3, 5): {(2, 12), (2, 13)}, (3, 6): {(2, 12), (2, 13)},
    (4, 5): {(3, 13)}, (4, 6): {(3, 13)},
    (5, 5): {(3, 12)}, (5, 6): {(3, 12)},
}


def board_features(n: int, givens: list[int]) -> dict:
    geo = m.geo_of(n)
    N = geo.N
    lines = geo.lines
    empt = [sum(1 for c in L if not givens[c]) for L in lines]
    vals = [v for v in givens if v]
    mid = (N + 1) / 2
    gset = {c for c in range(N) if givens[c]}
    syms = geo.symmetries()
    rot180 = syms[2]
    large = sum(1 for v in vals if v > mid)
    small = sum(1 for v in vals if v < mid)
    diag_cells = set(lines[-2]) | set(lines[-1])
    return {
        "size": n,
        "givens": len(vals),
        "empties": N - len(vals),
        "one_empty_lines": sum(1 for e in empt if e == 1),
        "two_empty_lines": sum(1 for e in empt if e == 2),
        "full_lines": sum(1 for e in empt if e == 0),
        "empty_lines": sum(1 for e in empt if e == n),
        "min_open_line": min(e for e in empt if e > 0),
        "diag_empties": sum(1 for c in diag_cells if not givens[c]),
        "corner_givens": sum(1 for c in (0, n - 1, N - n, N - 1) if givens[c]),
        "extremes": sum(1 for v in (1, N) if v in vals),
        "large_givens": large,
        "imbalance": abs(large - small),
        "layout_sym": int(any({p[c] for c in gset} == gset for p in syms[1:])),
        "rot_pair_share": round(sum(1 for c in gset if rot180[c] in gset) / len(gset), 3),
    }


# ---------------------------------------------------------------------------
# 同型の判定（回転・裏返し 8通り / 列の構造を保つ並べ替え × 補数）
# ---------------------------------------------------------------------------

_AUTS: dict[int, list[tuple[int, ...]]] = {}


def structure_perms(n: int) -> list[tuple[int, ...]]:
    """列の集まりを列の集まりへ移すマスの並べ替え（4×4・5×5 は 32、6×6 は 192）。perm[c] = 写した先のマス。"""
    if n not in _AUTS:
        _AUTS[n] = line_automorphisms(n, brute=False)
    return _AUTS[n]


def transform(givens: list[int], perm, N: int, complement: bool) -> list[int]:
    out = [0] * N
    for c, v in enumerate(givens):
        out[perm[c]] = (N + 1 - v if complement and v else v)
    return out


def invariance(n: int, givens: list[int], base: dict) -> dict:
    """特徴ごとに、8通りと（並べ替え × 補数）の全部で値が変わらないか（1 / 0）。entry は除く。"""
    geo = m.geo_of(n)
    keys = [k for k in base if k in CANDIDATES and k != "entry"]
    geo8 = geo.symmetries()
    out = {}
    for name, perms, comp in (("geo8", geo8, (False,)), ("struct64", structure_perms(n), (False, True))):
        same = {k: 1 for k in keys}
        for p in perms:
            for c in comp:
                f = board_features(n, transform(givens, p, geo.N, c))
                for k in keys:
                    if f[k] != base[k]:
                        same[k] = 0
        out[name] = same
    return out


# ---------------------------------------------------------------------------
# 図鑑の絞り込みの選択肢（frontend/src/features/zukan/zukan-filter.ts の listCountOptions と同じまとめ方）
# ---------------------------------------------------------------------------

MAX_EXACT = 8  # MAX_EXACT_COUNT_OPTION_COUNT


def options(values: list, width: int | None, force: bool = False) -> list[tuple[int, int, int]]:
    """(最小, 最大, 問題の数) の並び。値の種類が8以下か幅が無ければまとめない。
    force なら8種以下でもまとめる（問題集で値の種類が8を超えたときの見込み）。"""
    distinct = sorted(set(values))
    cnt = collections.Counter(values)
    if (len(distinct) <= MAX_EXACT and not force) or width is None:
        return [(v, v, cnt[v]) for v in distinct]
    groups: dict[int, list] = {}
    for v in distinct:
        groups.setdefault(int(v // width), []).append(v)
    return [(g[0], g[-1], sum(cnt[v] for v in g)) for g in groups.values()]


def fmt_options(opts) -> str:
    total = sum(c for _, _, c in opts)
    parts = []
    for lo, hi, c in opts:
        key = f"{lo:g}" if lo == hi else f"{lo:g}〜{hi:g}"
        parts.append(f"{key}: {c}")
    top = max(c for _, _, c in opts) / total if total else 0
    return f"{len(opts)}種（{'・'.join(parts)}）最多 {top:.0%}"


# ---------------------------------------------------------------------------
# 問題を集める
# ---------------------------------------------------------------------------


def _remeasure(args):
    """今のコードの読むモデルで特徴を測り直す（sweeps_hard を足し、入力の features と同じかを確かめる）。"""
    n, g = args
    geo = m.geo_of(n)
    return m.read_features(geo, g, m.read_solve(geo, g))


def collect(paths: list[str], jobs: int = 1) -> tuple[list[dict], dict]:
    """範囲内の問題を集める。返り値の2つ目は、入力の features と測り直した値が違った問題の数（鍵ごと）。"""
    rows = []
    for p in paths:
        with open(p) as fh:
            for line in fh:
                d = json.loads(line)
                if d.get("level") is None:
                    continue
                f = d["features"]
                n = f["n"]
                r = {"id": d["id"], "n": n, "level": d["level"], "givens_list": d["givens"],
                     "T": d.get("T"), "k": d.get("k"), "src": os.path.basename(p), "_stored": f}
                r.update(board_features(n, d["givens"]))
                r["entry"] = f["entry"]
                for k in READ_KEYS:
                    if k in f:
                        r[k] = f[k]
                r["undos"] = d.get("naive_rp_undos")
                rows.append(r)
    args = [(r["n"], r["givens_list"]) for r in rows]
    if jobs > 1:
        with mp.Pool(jobs) as pool:
            fs = pool.map(_remeasure, args, chunksize=8)
    else:
        fs = [_remeasure(a) for a in args]
    diff: dict[str, int] = collections.Counter()
    for r, f in zip(rows, fs):
        r["sweeps_hard"] = f["sweeps_hard"]
        for k, v in r.pop("_stored").items():
            if f.get(k) != v:
                diff[k] += 1
    return rows, dict(diff)


def pool_like(r) -> bool:
    conds = POOL_CONDS.get((r["level"], r["n"]))
    return conds is None or (r["T"], r["k"]) in conds


# ---------------------------------------------------------------------------
# sample4: 4×4 の候補を増やす
# ---------------------------------------------------------------------------


def naive_rp_undos(n: int, givens: list[int], seed: int) -> float:
    """慣れた試し置きの戻し（magic_square_difficulty.py の analyze_candidate の rp と同じ乱数で3回、中央値）。"""
    geo = m.geo_of(n)
    cap = 20 * sum(1 for v in givens if not v)
    return statistics.median(
        m.naive_solve(geo, givens, random.Random(seed * 10 + r), display="remain", pair=True, cap_moves=cap)["undos"]
        for r in range(3))


def _sample_job(args):
    T, k, i = args
    cand = m.generate_candidate(4, T, k, i)
    geo = m.geo_of(4)
    g = cand["givens"]
    lv, reason = m.classify_givens(4, g)  # 版 8（盤面の割り当ては SIZES_V6）
    base = m.read_features(geo, g, m.read_solve(geo, g))
    return {"id": cand["id"], "seed": cand["seed"], "T": T, "k": k, "level": lv, "reason": reason,
            "features": {key: base[key] for key in m.FEATURE_KEYS},
            "naive_rp_undos": naive_rp_undos(4, g, cand["seed"]) if lv is not None else None,
            "givens": g, "solution": cand["solution"]}


def cmd_undos(a):
    """sample4 の結果の範囲内の問題に、慣れた試し置きの戻しを書き足す（戻しを持たない古い sample4 の結果を直す）。"""
    with open(a.input) as fh, open(a.out, "w") as out:
        for line in fh:
            d = json.loads(line)
            if d.get("level") is not None and d.get("naive_rp_undos") is None:
                d["naive_rp_undos"] = naive_rp_undos(d["features"]["n"], d["givens"], d["seed"])
            out.write(json.dumps(d, separators=(",", ":")) + "\n")


def cmd_sample4(a):
    m.all_squares4()
    start = a.start
    conds = [tuple(int(x) for x in c.split("-")) for c in a.l2_conds]
    jobs = [(1, 0, i) for i in range(start, start + a.l1)]
    # L2 の生成条件は候補番号ごとに巡回する（途中で止めても条件ごとの数がそろう）
    jobs += [(T, k, i) for i in range(start, start + a.l2) for T, k in conds]
    with open(a.out, "w") as fh:
        if a.jobs > 1:
            with mp.Pool(a.jobs, initializer=m.all_squares4) as pool:
                it = pool.imap(_sample_job, jobs, chunksize=4)
                for d in it:
                    fh.write(json.dumps(d, separators=(",", ":")) + "\n")
        else:
            for job in jobs:
                fh.write(json.dumps(_sample_job(job), separators=(",", ":")) + "\n")
                fh.flush()
    print(f"{len(jobs)} candidates", file=sys.stderr)


# ---------------------------------------------------------------------------
# measure
# ---------------------------------------------------------------------------


def sp(xs, ys):
    if len(set(xs)) < 2 or len(set(ys)) < 2:
        return None
    return m.spearman(xs, ys)


def fsp(x) -> str:
    return "—" if x is None else f"{x:+.2f}"


def half_weighted(groups: list[list], width: int | None,
                  force: bool = False) -> tuple[list[tuple[int, int]], list[float]]:
    """盤面ごとの値の並び groups を、盤面を同じ数ずつにしたとしてまとめる。選択肢（最小, 最大）と割合の並び。"""
    allv = [v for g in groups for v in g]
    opts = options(allv, width, force)
    shares = []
    for lo, hi, _ in opts:
        shares.append(statistics.fmean(sum(1 for v in g if lo <= v <= hi) / len(g) for g in groups))
    return [(lo, hi) for lo, hi, _ in opts], shares


def cmd_measure(a):
    main_rows, diff_main = collect(a.inputs, a.jobs)
    extra_rows, diff_extra = collect(a.extra, a.jobs) if a.extra else ([], {})
    out = []
    P = out.append

    def levels(rows):
        return sorted({r["level"] for r in rows})

    # 4×4 は本文の候補と追加の候補を合わせ、同じ与える数は1つにする（L1・L2 の 4×4 の分かれ方を pool の大きさで見る）
    seen = set()
    rows4 = []
    for r in [r for r in main_rows if r["n"] == 4] + [r for r in extra_rows if r["n"] == 4]:
        key = tuple(r["givens_list"])
        if key in seen:
            continue
        seen.add(key)
        rows4.append(r)
    rows = main_rows

    def layer(L, n):
        """同じレベル・同じ盤面の層。4×4 は追加の候補を合わせた問題（追加があるとき）。"""
        return [r for r in (rows4 if (n == 4 and extra_rows) else rows) if r["level"] == L and r["n"] == n]

    P(f"範囲内の問題: 本文の候補 {len(main_rows)}（" + "・".join(
        f"L{L} {sum(1 for r in rows if r['level'] == L)}" for L in levels(rows)) + "）")
    if extra_rows:
        P(f"4×4 を合わせた問題: {len(rows4)}（" + "・".join(
            f"L{L} {sum(1 for r in rows4 if r['level'] == L)}" for L in (1, 2)) + "）")
    P(f"入力の features と、今のコードで測り直した読むモデルの特徴が違った問題: 本文 {diff_main or 'なし'}"
      + (f"・追加 {diff_extra or 'なし'}" if a.extra else ""))
    P("")

    # (1) レベルの中の分かれ方
    P("## (1) レベルの中の値の分かれ方（本文の候補。図鑑の絞り込みと同じまとめ方: 値が8種以下はそのまま、超えたら幅で）")
    P("")
    widths = {"givens": a.width, "empties": a.width}
    for L in levels(rows):
        g = [r for r in rows if r["level"] == L]
        sizes = sorted({r["n"] for r in g})
        P(f"### L{L}（{len(g)}問: " + "・".join(f"{n}×{n} {sum(1 for r in g if r['n'] == n)}" for n in sizes) + "）")
        P("")
        P("| 特徴 | レベル全体 | " + " | ".join(f"{n}×{n}" for n in sizes) + " |")
        P("|---|---|" + "---|" * len(sizes))
        for k in FEATURES:
            w = widths.get(k)
            cells = [fmt_options(options([r[k] for r in g], w))]
            for n in sizes:
                cells.append(fmt_options(options([r[k] for r in g if r["n"] == n], w)))
            P(f"| {k} | " + " | ".join(cells) + " |")
        P("")
    if extra_rows:
        P("### 4×4 を合わせた L1・L2 の 4×4")
        P("")
        P("| 特徴 | L1 | L2 の 4×4 |")
        P("|---|---|---|")
        for k in FEATURES:
            w = widths.get(k)
            P(f"| {k} | " + " | ".join(fmt_options(options([r[k] for r in rows4 if r["level"] == L], w))
                                     for L in (1, 2)) + " |")
        P("")

    # 最初の数のまとめ幅の比べ（レベル全体の選択肢）
    P("## 最初の数・空きのまとめ幅（レベル全体の選択肢の数と最多の割合）")
    P("")
    P("| 特徴 | 幅 | " + " | ".join(f"L{L}" for L in levels(rows)) + " |")
    P("|---|---|" + "---|" * len(levels(rows)))
    for k in ("givens", "empties"):
        for w in (None, 2, 3, 4, 5):
            cells = []
            for L in levels(rows):
                opts = options([r[k] for r in rows if r["level"] == L], w)
                total = sum(c for _, _, c in opts)
                cells.append(f"{len(opts)}種・最多 {max(c for _, _, c in opts) / total:.0%}・"
                             + "/".join((f"{lo}" if lo == hi else f"{lo}-{hi}") for lo, hi, _ in opts))
            P(f"| {k} | {w or 'なし'} | " + " | ".join(cells) + " |")
    P("")
    P("同じ幅で、盤面を選んだ後に残る選択肢（レベル全体でまとめた選択肢を盤面ごとに数える。種類・最多の割合）:")
    P("")
    P("| 特徴 | 幅 | " + " | ".join(f"L{L} {n}×{n}" for L in levels(rows)
                                    for n in sorted({r['n'] for r in rows if r['level'] == L})) + " |")
    P("|---|---|" + "---|" * sum(len({r['n'] for r in rows if r['level'] == L}) for L in levels(rows)))
    for k in ("givens",):
        for w in (None, 2, 3, 4):
            cells = []
            for L in levels(rows):
                g = [r for r in rows if r["level"] == L]
                opts = options([r[k] for r in g], w)
                for n in sorted({r["n"] for r in g}):
                    sub = [r[k] for r in g if r["n"] == n]
                    cnt = [sum(1 for v in sub if lo <= v <= hi) for lo, hi, _ in opts]
                    cnt = [c for c in cnt if c]
                    cells.append(f"{len(cnt)}種・{max(cnt) / len(sub):.0%}")
            P(f"| {k} | {w or 'なし'} | " + " | ".join(cells) + " |")
    P("")
    # 盤面と組み合わせたときに、最初の数の選択肢が盤面をまたぐか
    P("最初の数・空きの選択肢（幅あり）のうち、2つの盤面の問題が入る選択肢:")
    for k in ("givens", "empties"):
        for L in levels(rows):
            g = [r for r in rows if r["level"] == L]
            opts = options([r[k] for r in g], widths.get(k))
            mixed = []
            for lo, hi, _ in opts:
                ns = sorted({r["n"] for r in g if lo <= r[k] <= hi})
                if len(ns) > 1:
                    mixed.append(f"{lo}-{hi}（" + "・".join(f"{n}×{n} {sum(1 for r in g if lo <= r[k] <= hi and r['n'] == n)}" for n in ns) + "）")
            P(f"- {k} L{L}: " + ("なし" if not mixed else "、".join(mixed)))
    P("")

    # (2) 特徴どうしの順位相関
    P("## (2) 特徴どうしの順位相関（レベルごと・盤面ごとに測り、順位相関の絶対値の最大を出す。値が1種の組は除く。"
      "4×4 は追加の候補を合わせた層）")
    P("")
    strata = [(L, n) for L in levels(rows) for n in sorted({r["n"] for r in rows if r["level"] == L})]
    keys = [k for k in FEATURES if k != "size"]
    P("| 特徴 | " + " | ".join(keys) + " |")
    P("|---|" + "---|" * len(keys))
    for i, k1 in enumerate(keys):
        cells = []
        for j, k2 in enumerate(keys):
            if j <= i:
                cells.append("")
                continue
            vals = []
            for L, n in strata:
                g = layer(L, n)
                if len(g) < 20:
                    continue
                v = sp([r[k1] for r in g], [r[k2] for r in g])
                if v is not None:
                    vals.append(v)
            cells.append(f"{max(vals, key=abs):+.2f}" if vals else "—")
        P(f"| {k1} | " + " | ".join(cells) + " |")
    P("")
    P("最初の数 × 空きだけの列の、層ごとの順位相関（4×4 は追加の候補を合わせた数）:")
    P("")
    cells = []
    for L, n in strata:
        g = layer(L, n)
        cells.append(f"L{L} {n}×{n} {fsp(sp([r['givens'] for r in g], [r['empty_lines'] for r in g]))}（{len(g)}問）")
    P("- " + "、".join(cells))
    P("")
    P("盤面をまたいだレベルごとの、盤面との順位相関（同じレベルに2つの盤面があるとき）:")
    P("")
    P("| 特徴 | " + " | ".join(f"L{L}" for L in levels(rows) if len({r['n'] for r in rows if r['level'] == L}) > 1) + " |")
    P("|---|" + "---|" * sum(1 for L in levels(rows) if len({r['n'] for r in rows if r['level'] == L}) > 1))
    for k in keys:
        cells = []
        for L in levels(rows):
            g = [r for r in rows if r["level"] == L]
            if len({r["n"] for r in g}) < 2:
                continue
            cells.append(fsp(sp([r[k] for r in g], [r["n"] for r in g])))
        P(f"| {k} | " + " | ".join(cells) + " |")
    P("")

    # (3) 難易度との順位相関
    P("## (3) 難易度との順位相関")
    P("")
    P("レベルとの順位相関（全レベル、5×5 だけ（L2〜L5）、6×6 だけ（L3〜L5））と、"
      "同じレベル・同じ盤面の中での読みの量との順位相関の絶対値の最大（どの量・どの層で最大かを括弧に。"
      "4×4 は追加の候補を合わせた層）。")
    P("")
    P("| 特徴 | レベル（全体） | レベル（5×5） | レベル（6×6） | 読みの量（同じレベル・盤面の中、絶対値最大） | 試し置きの戻し（同） |")
    P("|---|---|---|---|---|---|")
    for k in FEATURES:
        lv_all = sp([r[k] for r in rows], [r["level"] for r in rows])
        lv5 = sp([r[k] for r in rows if r["n"] == 5], [r["level"] for r in rows if r["n"] == 5])
        lv6 = sp([r[k] for r in rows if r["n"] == 6], [r["level"] for r in rows if r["n"] == 6])
        best = None
        best_u = None
        for L, n in strata:
            g = layer(L, n)
            if len(g) < 20:
                continue
            for q in READ_KEYS:
                v = sp([r[k] for r in g], [r[q] for r in g])
                if v is not None and (best is None or abs(v) > abs(best[0])):
                    best = (v, q, L, n)
            us = [r for r in g if r["undos"] is not None]
            v = sp([r[k] for r in us], [r["undos"] for r in us])
            if v is not None and (best_u is None or abs(v) > abs(best_u[0])):
                best_u = (v, L, n)
        bs = "—" if best is None else f"{best[0]:+.2f}（{best[1]}、L{best[2]} {best[3]}×{best[3]}）"
        bu = "—" if best_u is None else f"{best_u[0]:+.2f}（L{best_u[1]} {best_u[2]}×{best_u[2]}）"
        P(f"| {k} | {fsp(lv_all)} | {fsp(lv5)} | {fsp(lv6)} | {bs} | {bu} |")
    P("")
    P("層ごとの順位相関（決める候補の特徴だけ。層は20問以上。4×4 は追加の候補を合わせた数）:")
    P("")
    qs = ("givens",) + READ_KEYS + ("undos",)
    layer_list = []
    for L, n in strata:
        g = layer(L, n)
        if len(g) >= 20:
            layer_list.append((f"L{L} {n}×{n}", g))
    for k in a.focus:
        P(f"**{k}**")
        P("")
        P("| 層 | 問題 | " + " | ".join(qs) + " |")
        P("|---|---|" + "---|" * len(qs))
        for name, g in layer_list:
            cells = []
            for q in qs:
                us = [r for r in g if r.get(q) is not None]
                cells.append(fsp(sp([r[k] for r in us], [r[q] for r in us])))
            P(f"| {name} | {len(g)} | " + " | ".join(cells) + " |")
        P("")
    P("2つの特徴を合わせたときの選択肢（盤面 × 候補。レベルごとの、選択肢の組ごとの問題の数）:")
    P("")
    for k in a.focus:
        if k == "givens":
            continue
        P(f"- {k}: " + " / ".join(
            f"L{L} " + "・".join(
                f"{n}×{n}[" + ",".join(f"{v}:{c}" for v, c in sorted(collections.Counter(
                    r[k] for r in layer(L, n)).items())) + "]"
                for n in sorted({r["n"] for r in rows if r["level"] == L}))
            for L in levels(rows)))
    P("")
    P("レベルごとの値の 10 / 50 / 90 パーセンタイル（盤面ごと。4×4 は追加の候補を合わせた層）:")
    P("")
    P("| 特徴 | " + " | ".join(f"L{L} {n}×{n}" for L, n in strata) + " |")
    P("|---|" + "---|" * len(strata))
    for k in FEATURES + list(READ_KEYS) + ["undos"]:
        cells = []
        for L, n in strata:
            cells.append(m.q3([r[k] for r in layer(L, n) if r.get(k) is not None]))
        P(f"| {k} | " + " | ".join(cells) + " |")
    P("")
    P("最初の数の、盤面ごと・レベルごとの値の数（隣のレベルとの重なりを見る）:")
    P("")
    for n in sorted({r["n"] for r in rows}):
        P(f"- {n}×{n}: " + " / ".join(
            f"L{L} [" + ",".join(f"{v}:{c}" for v, c in sorted(collections.Counter(
                r["givens"] for r in layer(L, n)).items())) + "]"
            for L in levels(rows) if any(r["level"] == L and r["n"] == n for r in rows)))
    P("")

    # (4) 同型の判定で値が変わらないか
    P("## (4) 同型の判定で値が変わらないか（値が変わらない問題の割合）")
    P("")
    inv = [invariance(r["n"], r["givens_list"], r) for r in rows]
    P("| 特徴 | 回転・裏返し 8通り | 列の構造を保つ並べ替え × 補数 |")
    P("|---|---|---|")
    for k in FEATURES:
        if k == "entry":
            continue
        g8 = statistics.fmean(x["geo8"][k] for x in inv)
        s64 = statistics.fmean(x["struct64"][k] for x in inv)
        P(f"| {k} | {g8:.0%} | {s64:.0%} |")
    P("")

    # (5) 問題集に近い形
    P("## (5) 問題集に近い形（問題を作る生成条件だけ（POOL_CONDS）・2つの盤面を半分ずつにしたときの推奨の3つ）")
    P("")
    pool_rows = [r for r in rows4 if pool_like(r)] + [r for r in rows if r["n"] != 4 and pool_like(r)]
    P("問題: " + "・".join(
        f"L{L} " + "+".join(f"{n}×{n} {sum(1 for r in pool_rows if r['level'] == L and r['n'] == n)}"
                            for n in sorted({r['n'] for r in pool_rows if r['level'] == L}))
        for L in levels(pool_rows)))
    P("")
    P("幅の「!」は、値の種類が8以下でもまとめたとき（問題集で値の種類が8を超えたときの見込み）。")
    P("")
    P("| レベル | 特徴 | 幅 | 盤面ごと | 半分ずつのレベル全体（選択肢: 割合） |")
    P("|---|---|---|---|---|")
    for L in levels(pool_rows):
        g = [r for r in pool_rows if r["level"] == L]
        sizes = sorted({r["n"] for r in g})
        for k in CHOSEN[1:]:
            ws = ((None, False), (2, False), (3, False), (2, True), (3, True)) if k == "givens" else ((None, False),)
            for w, force in ws:
                if force and len({r[k] for r in g}) > MAX_EXACT:
                    continue  # もうまとめている
                per = [[r[k] for r in g if r["n"] == n] for n in sizes]
                opts, shares = half_weighted(per, w, force)
                per_s = []
                for n, vals in zip(sizes, per):
                    cnt = [sum(1 for v in vals if lo <= v <= hi) for lo, hi in opts]
                    nz = [c for c in cnt if c]
                    per_s.append(f"{n}×{n}: " + ",".join(
                        f"{lo if lo == hi else f'{lo}-{hi}'}:{c}" for (lo, hi), c in zip(opts, cnt) if c)
                        + f"（{len(nz)}種・最多 {max(nz) / len(vals):.0%}）")
                lvl = ",".join(f"{lo if lo == hi else f'{lo}-{hi}'}:{s:.0%}" for (lo, hi), s in zip(opts, shares))
                wl = f"{w}!" if force else f"{w or 'なし'}"
                P(f"| L{L} | {k} | {wl} | {' / '.join(per_s)} | {len(opts)}種（{lvl}）最多 {max(shares):.0%} |")
    P("")
    print("\n".join(out))


# ---------------------------------------------------------------------------
# examples: 例の魔方陣が除く 4×4 の魔方陣の数
# ---------------------------------------------------------------------------

EXAMPLE4 = [14, 4, 5, 11, 9, 2, 7, 16, 8, 13, 12, 1, 3, 15, 10, 6]  # 遊び方・チュートリアルの例（frontend の figure-boards.ts）


def cmd_examples(a):
    geo = m.geo_of(4)
    assert m.is_magic(geo, EXAMPLE4)
    squares = {tuple(s) for s in m.all_squares4()}
    orb8 = {tuple(transform(EXAMPLE4, p, 16, False)) for p in geo.symmetries()}
    orb64 = {tuple(transform(EXAMPLE4, p, 16, c)) for p in structure_perms(4) for c in (False, True)}
    print(json.dumps({"example4": EXAMPLE4, "is_magic": True,
                      "orbit_geo8": len(orb8), "orbit_struct64": len(orb64),
                      "all_in_7040": all(s in squares for s in orb64),
                      "struct_perms": {n: len(structure_perms(n)) for n in (4, 5, 6)}}, ensure_ascii=False))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("sample4")
    q.add_argument("--l1", type=int, default=500, help="4×4 T1 k0 の候補の数")
    q.add_argument("--l2", type=int, default=400, help="L2 の 4×4 の生成条件ごとの候補の数")
    q.add_argument("--l2-conds", nargs="+", default=["2-0", "2-1", "3-1"],
                   help="L2 の 4×4 の生成条件 T-k（難易度の資料 §6.2 で L2 の 4×4 に当たる割合の高い3つ）")
    q.add_argument("--start", type=int, default=1000, help="候補番号の始め（corpus の 0〜59 と重ならない番号）")
    q.add_argument("--jobs", type=int, default=1)
    q.add_argument("--out", required=True)
    q.set_defaults(fn=cmd_sample4)
    q = sub.add_parser("undos")
    q.add_argument("input")
    q.add_argument("--out", required=True)
    q.set_defaults(fn=cmd_undos)
    q = sub.add_parser("measure")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--extra", nargs="*", default=[])
    q.add_argument("--width", type=int, default=2, help="最初の数・空きのまとめ幅")
    q.add_argument("--jobs", type=int, default=1)
    q.add_argument("--focus", nargs="+",
                   default=["givens", "empty_lines", "diag_empties", "two_empty_lines", "extremes", "one_empty_lines"])
    q.set_defaults(fn=cmd_measure)
    q = sub.add_parser("examples")
    q.set_defaults(fn=cmd_examples)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
