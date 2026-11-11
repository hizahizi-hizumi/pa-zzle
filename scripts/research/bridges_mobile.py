"""ブリッジパズル（bridges）スマホ操作の調査。

ブラウザは使わず、既存のプレイ画面のレイアウト（Tailwind のクラスと定数）から盤面のマスの大きさを計算し、
島の間をタップで押し分けられるかを、島の配置を生成して幾何と手ぶれの模擬で測る。標準ライブラリだけで動く。

    python3 scripts/research/bridges_mobile.py layout   # 既存ゲームとのマスの大きさ・縦長盤面の収まり
    python3 scripts/research/bridges_mobile.py taps     # タップの押し分け（安全半径と手ぶれ σ ごとの成功率）
    python3 scripts/research/bridges_mobile.py crossings  # 交わる候補で押せる範囲が狭くなる候補の割合
    python3 scripts/research/bridges_mobile.py all

前提（コードから読んだ値。rem は 16px）
- プレイ画面の外枠 GamePlayFrame は fixed inset-0 overflow-hidden。ブランドの帯 1.75rem=28px、PlayHeader 4.5rem=72px。
- index.html の viewport に viewport-fit=cover が無いので、ブラウザ表示では safe-area-inset は 0 とみなす。
- 一筆パズル: main px-4 py-2、盤面は aspect-square w-[min(100cqw,100cqh,40rem)]、footer h-28（待った）。
- タクズ: main py-2（左右余白なし）、盤面の外側 p-3、枠 border-2、footer h-28。
- ナンプレ: 盤面 w-[min(96vw,calc(100svh-12rem),38rem)]、枠 border-2、9列。
- マインスイーパー: main px-2 py-3、w-full max-w-[27rem]、border-l/t 1px、footer なし。
- リフレクション: main px-1 py-2、aspect-square、外周ヒントの帯 0.8＋隙間 0.2（両側で 2 マス分）、
  footer はストック h-11＋p-1＋pb-2=60px。
- ブリッジパズル（仮）: 一筆パズルと同じ骨格（main px-4 py-2、footer h-28 に待った）とする。
"""

from __future__ import annotations

import argparse
import math
import random
import statistics
from dataclasses import dataclass

BRAND = 28
HEADER = 72
REM = 16

# 端末の表示領域（CSS px）。幅は既存の調査と index.css の min-w-[320px] から。
# 高さは推測（Safari のツールバーを出した状態の目安）。計算の条件として置き、実機では確かめていない。
VIEWPORTS: list[tuple[str, int, int]] = [
    ("iPhone 13 Safari（推測の高さ）", 390, 664),
    ("390×844（既存の調査の条件）", 390, 844),
    ("iPhone SE2/3 Safari（推測の高さ）", 375, 548),
    ("Android 360（推測の高さ）", 360, 640),
    ("320×693（一筆パズル PoC の条件）", 320, 693),
    ("320 Safari（推測の高さ）", 320, 460),
]


def hitofude_like(width: int, height: int, cols: int, rows: int) -> tuple[float, bool]:
    """一筆パズルの骨格で cols×rows を置いたときのマス幅と、高さで決まるか。"""
    avail_w = width - 2 * 16
    avail_h = height - BRAND - HEADER - 2 * 8 - 112
    by_w = min(avail_w, 40 * REM) / cols
    by_h = avail_h / rows
    return min(by_w, by_h), by_h < by_w


def takuzu_cell(width: int, height: int) -> float:
    avail_h = height - BRAND - HEADER - 2 * 8 - 112
    side = min(width, avail_h, 42 * REM)
    return (side - 2 * 12 - 2 * 2) / 8


def nanpure_cell(width: int, height: int) -> float:
    side = min(0.96 * width, height - 12 * REM, 38 * REM)
    return (side - 2 * 2) / 9


def minesweeper_cell(width: int, height: int, cols: int, rows: int) -> tuple[float, bool]:
    side = min(width - 2 * 8, 27 * REM)
    cell = (side - 1) / cols
    fits = rows * cell + 1 <= height - BRAND - HEADER - 2 * 12
    return cell, fits


def reflection_cell(width: int, height: int, size: int) -> float:
    avail_h = height - BRAND - HEADER - 2 * 8 - 60
    side = min(width - 2 * 4, avail_h, 44 * REM)
    return side / (size + 2)


def cmd_layout() -> None:
    print("## 既存ゲームの最大盤面とブリッジパズルのマス幅（px）")
    header = [
        "端末",
        "一筆8×8",
        "タクズ8×8",
        "ナンプレ9×9",
        "マインスイーパー12列",
        "マインスイーパー10列",
        "リフレクション10×10",
        "ブリッジ7×7",
        "ブリッジ8×8",
        "ブリッジ9×9",
        "ブリッジ10×10",
    ]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for name, w, h in VIEWPORTS:
        row = [f"{name} {w}×{h}"]
        c, hb = hitofude_like(w, h, 8, 8)
        row.append(f"{c:.1f}{'*' if hb else ''}")
        row.append(f"{takuzu_cell(w, h):.1f}")
        row.append(f"{nanpure_cell(w, h):.1f}")
        c12, f12 = minesweeper_cell(w, h, 12, 16)
        row.append(f"{c12:.1f}{'' if f12 else '!'}")
        c10, f10 = minesweeper_cell(w, h, 10, 14)
        row.append(f"{c10:.1f}{'' if f10 else '!'}")
        row.append(f"{reflection_cell(w, h, 10):.1f}")
        for n in (7, 8, 9, 10):
            c, hb = hitofude_like(w, h, n, n)
            row.append(f"{c:.1f}{'*' if hb else ''}")
        print("| " + " | ".join(row) + " |")
    print("* は高さで決まった値（幅だけなら大きくできる）。! はマインスイーパーの最大行数（12列は16行、10列は14行）が画面に収まらない。")
    print()
    print("## ブリッジパズルの縦長盤面（列×行）のマス幅")
    shapes = [(10, 10), (10, 11), (10, 12), (10, 13), (10, 14), (9, 12), (8, 12)]
    header = ["端末", "盤面の高さの余裕"] + [f"{c}×{r}" for c, r in shapes]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for name, w, h in VIEWPORTS:
        avail_h = h - BRAND - HEADER - 2 * 8 - 112
        row = [f"{name} {w}×{h}", f"{avail_h}px"]
        base, _ = hitofude_like(w, h, 10, 10)
        for c, r in shapes:
            cell, hb = hitofude_like(w, h, c, r)
            row.append(f"{cell:.1f}{'*' if hb else ''}")
        print("| " + " | ".join(row) + " |")
    print("* は高さで決まった値。")
    print()
    print("## 高さが決め手にならない最大行数（10列、幅で決まるマス幅のまま入る行数）")
    for name, w, h in VIEWPORTS:
        avail_h = h - BRAND - HEADER - 2 * 8 - 112
        cell_w = (w - 32) / 10
        print(f"- {name} {w}×{h}: マス {cell_w:.1f}px、盤面に使える高さ {avail_h}px → {math.floor(avail_h / cell_w)} 行")


# ---------------------------------------------------------------- 島の配置とタップの押し分け

DIRS = ((0, 1), (1, 0), (0, -1), (-1, 0))


def generate_islands(
    rng: random.Random, cols: int, rows: int, density: float, allow_adjacent: bool
) -> list[tuple[int, int]]:
    """島を1つ置き、既存の島から縦横へ伸ばして次の島を置く（橋のマスは横切らない）。返すのは (row, col)。

    allow_adjacent=False は bridges_supply.py の生成器と同じく、縦横に隣り合う島を作らない。
    True は間のマスが0の組（隣り合う島）も作る。
    """
    target = max(2, round(density * cols * rows))
    islands = [(rng.randrange(rows), rng.randrange(cols))]
    island_set = set(islands)
    bridge_cells: set[tuple[int, int]] = set()
    min_len = 1 if allow_adjacent else 2
    failures = 0
    while len(islands) < target and failures < 400:
        sr, sc = islands[rng.randrange(len(islands))]
        dr, dc = DIRS[rng.randrange(4)]
        max_len = (cols - 1 - sc) if dc > 0 else sc if dc < 0 else (rows - 1 - sr) if dr > 0 else sr
        if max_len < min_len:
            failures += 1
            continue
        length = rng.randint(min_len, min(max_len, max(min_len, min(cols, rows) // 2 + 1)))
        path = [(sr + dr * k, sc + dc * k) for k in range(1, length)]
        dest = (sr + dr * length, sc + dc * length)
        bad = dest in island_set or dest in bridge_cells
        bad = bad or any(p in island_set or p in bridge_cells for p in path)
        if not bad and not allow_adjacent:
            bad = any((dest[0] + a, dest[1] + b) in island_set for a, b in DIRS)
        if bad:
            failures += 1
            continue
        failures = 0
        islands.append(dest)
        island_set.add(dest)
        bridge_cells.update(path)
    return islands


@dataclass(frozen=True)
class Segment:
    """橋を架けられる島の組。座標はマス幅を1とし、島の中心は (col+0.5, row+0.5)。"""

    horizontal: bool
    fixed: float  # 横なら y、縦なら x
    lo: float  # 長さの向きの始まり（島の中心）
    hi: float


def list_segments(islands: list[tuple[int, int]]) -> list[Segment]:
    island_set = set(islands)
    rows = max(r for r, _ in islands) + 1
    cols = max(c for _, c in islands) + 1
    segs: list[Segment] = []
    for r, c in islands:
        for cc in range(c + 1, cols):
            if (r, cc) in island_set:
                segs.append(Segment(True, r + 0.5, c + 0.5, cc + 0.5))
                break
        for rr in range(r + 1, rows):
            if (rr, c) in island_set:
                segs.append(Segment(False, c + 0.5, r + 0.5, rr + 0.5))
                break
    return segs


def hit_test(
    x: float,
    y: float,
    centers: list[tuple[float, float]],
    segs: list[Segment],
    radius: float,
    cap: float,
) -> int:
    """押した位置の判定。島の丸の中なら -1（島。なぞりの始点）、橋の候補なら番号、どれでもなければ -2。

    規則（仮）: 島の丸を先に見る。次に、長さの向きの範囲に入っている候補のうち、線までの距離が最も短いものを選ぶ。
    距離が cap を超えるなら何も選ばない。同じ距離なら選ばない（-2）。
    """
    for cx, cy in centers:
        if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius:
            return -1
    best = -2
    best_d = cap
    tie = False
    for i, s in enumerate(segs):
        along, across = (x, y) if s.horizontal else (y, x)
        if not (s.lo < along < s.hi):
            continue
        d = abs(across - s.fixed)
        if d < best_d - 1e-12:
            best, best_d, tie = i, d, False
        elif abs(d - best_d) <= 1e-12:
            tie = True
    return -2 if tie else best


def crossing_positions(seg: Segment, segs: list[Segment]) -> list[float]:
    """seg と交わる（長さの向きの内側で直交する）候補の位置。"""
    out = []
    for o in segs:
        if o.horizontal == seg.horizontal:
            continue
        if seg.lo < o.fixed < seg.hi and o.lo < seg.fixed < o.hi:
            out.append(o.fixed)
    return out


def best_target(
    seg: Segment, segs: list[Segment], radius: float, cap: float, ignore_crossings: bool
) -> tuple[float, float]:
    """線の上で、ほかの判定の領域から最も遠い点（長さの向きの座標）と、その距離（安全半径、マス幅単位）。

    線の上の点 p からの距離: 両端の島の丸の縁まで |p-端|-radius、上下の打ち切り cap、
    直交して交わる候補との境界（|dx|=|dy| の斜線）まで |p-交点|/√2。平行な候補との境界は 0.5 以上離れ cap に含まれる。
    """
    crosses = [] if ignore_crossings else crossing_positions(seg, segs)
    best_p, best_m = seg.lo, -1.0
    steps = max(2, int((seg.hi - seg.lo) / 0.005))
    for k in range(steps + 1):
        p = seg.lo + (seg.hi - seg.lo) * k / steps
        m = min(cap, p - seg.lo - radius, seg.hi - p - radius)
        for q in crosses:
            m = min(m, abs(p - q) / math.sqrt(2))
        if m > best_m:
            best_p, best_m = p, m
    return best_p, best_m


def cmd_taps(args: argparse.Namespace) -> None:
    rng_master = random.Random(args.seed)
    configs = [
        # (列, 行, 密度, 隣り合う島を許すか)
        (7, 7, 0.25, False),
        (10, 10, 0.25, False),
        (10, 10, 0.30, False),
        (10, 12, 0.25, False),
        (10, 10, 0.25, True),
    ]
    radii = [0.35, 0.40, 0.45]
    cap = 0.5
    # 指が押す位置のぶれ（標準偏差、CSS px）。一筆パズル PoC と同じ 4px・8px。
    sigmas = [4.0, 8.0]
    widths = [390, 320]

    print(f"seed={args.seed} 盤面ごとの配置数={args.boards} 候補ごとのタップ数={args.taps} 打ち切り cap={cap}マス")
    print("安全半径: 狙う点から、ほかの判定（島の丸・別の候補・何もない所）の境界までの距離。")
    print("「交差あり」は橋が1本も無い盤面（交わる2候補のどちらも選べる）。「交差なし」は交わる候補の一方に橋があり、")
    print("その交点では橋のある候補を選ぶ規則にした場合（交わる候補との境界を無視）。")
    print()
    for cols, rows, density, adj in configs:
        boards = []
        for _ in range(args.boards):
            seed = rng_master.randrange(2**31)
            islands = generate_islands(random.Random(seed), cols, rows, density, adj)
            boards.append(islands)
        island_counts = [len(b) for b in boards]
        print(
            f"### {cols}×{rows} 密度{density} {'隣り合う島あり' if adj else '隣り合う島なし'}"
            f"（島の数 中央値{statistics.median(island_counts)}、最小{min(island_counts)}、最大{max(island_counts)}）"
        )
        print(
            "| 島の丸の半径 | 交差 | 候補数 | 安全半径の最小（マス） | 下位5%（マス） | 中央値（マス） | "
            + " | ".join(f"{w}px 最小/下位5%（px）" for w in widths)
            + " | "
            + " | ".join(f"{w}px σ{s:g} 成功率 全体/最悪の候補" for w in widths for s in sigmas)
            + " |"
        )
        print("|" + "---|" * (6 + len(widths) + len(widths) * len(sigmas)))
        for radius in radii:
            for ignore in (False, True):
                margins: list[float] = []
                hits = {(w, s): [0, 0] for w in widths for s in sigmas}
                worst = {(w, s): 1.0 for w in widths for s in sigmas}
                tap_rng = random.Random(args.seed + int(radius * 100) + (7 if ignore else 0))
                for islands in boards:
                    centers = [(c + 0.5, r + 0.5) for r, c in islands]
                    segs = list_segments(islands)
                    for idx, seg in enumerate(segs):
                        p, m = best_target(seg, segs, radius, cap, ignore)
                        margins.append(m)
                        tx, ty = (p, seg.fixed) if seg.horizontal else (seg.fixed, p)
                        if ignore:
                            cross_at = set(crossing_positions(seg, segs))
                            sub = [
                                o
                                for o in segs
                                if not (
                                    o.horizontal != seg.horizontal
                                    and o.fixed in cross_at
                                    and o.lo < seg.fixed < o.hi
                                )
                            ]
                        for w in widths:
                            cell_px = (w - 32) / cols
                            for s in sigmas:
                                ok = 0
                                sd = s / cell_px
                                for _ in range(args.taps):
                                    x = tx + tap_rng.gauss(0, sd)
                                    y = ty + tap_rng.gauss(0, sd)
                                    if ignore:
                                        # 交わる候補の一方に橋がある場合を、交わる候補を外した判定で模す。
                                        got = hit_test(x, y, centers, sub, radius, cap)
                                        ok += got >= 0 and sub[got] == seg
                                    else:
                                        ok += hit_test(x, y, centers, segs, radius, cap) == idx
                                hits[(w, s)][0] += ok
                                hits[(w, s)][1] += args.taps
                                worst[(w, s)] = min(worst[(w, s)], ok / args.taps)
                margins.sort()
                p5 = margins[int(len(margins) * 0.05)]
                cells = []
                for w in widths:
                    cell_px = (w - 32) / cols
                    cells.append(f"{margins[0] * cell_px:.1f} / {p5 * cell_px:.1f}")
                rates = []
                for w in widths:
                    for s in sigmas:
                        a, b = hits[(w, s)]
                        rates.append(f"{a / b:.3f} / {worst[(w, s)]:.2f}")
                print(
                    f"| {radius} | {'交差なし' if ignore else '交差あり'} | {len(margins)} | {margins[0]:.3f} | {p5:.3f} | "
                    f"{statistics.median(margins):.3f} | " + " | ".join(cells) + " | " + " | ".join(rates) + " |"
                )
        print()

    print("### 島の丸の大きさ（直径、px）と線を押せる幅（上下の打ち切り 2×cap マス、px）")
    print("| 端末の幅 | 盤面 | マス | 丸の直径 r=0.35 / 0.40 / 0.45 | 線を押せる幅 | 隣り合う島の間に見える線の長さ（r=0.40） | 間に1マスある島の間（r=0.40） |")
    print("|---|---|---|---|---|---|---|")
    for w in (390, 375, 360, 320):
        for n in (7, 8, 10):
            c = (w - 32) / n
            dia = " / ".join(f"{2 * r * c:.1f}" for r in radii)
            print(
                f"| {w} | {n}×{n} | {c:.1f} | {dia} | {2 * cap * c:.1f} | {(1 - 0.8) * c:.1f} | {(2 - 0.8) * c:.1f} |"
            )


def cmd_crossings(args: argparse.Namespace) -> None:
    """安全半径が 0.5 マスを下回る候補（交わる候補との境界が近いもの）の割合と、その形。"""
    rng_master = random.Random(args.seed)
    print(f"seed={args.seed} 盤面ごとの配置数={args.boards}（島の丸の半径 0.40、打ち切り 0.5）")
    print("| 盤面 | 密度 | 候補数 | 安全半径<0.5 の候補 | うち間が1マスの組 | 1問あたりの該当数 中央値/最大 |")
    print("|---|---|---|---|---|---|")
    for cols, rows, density in ((7, 7, 0.25), (8, 8, 0.25), (9, 9, 0.25), (10, 10, 0.25), (10, 10, 0.30), (10, 12, 0.25)):
        total = low = low_short = 0
        per_board = []
        for _ in range(args.boards):
            islands = generate_islands(random.Random(rng_master.randrange(2**31)), cols, rows, density, False)
            segs = list_segments(islands)
            n = 0
            for seg in segs:
                total += 1
                _, m = best_target(seg, segs, 0.40, 0.5, False)
                if m < 0.5 - 1e-9:
                    low += 1
                    n += 1
                    low_short += seg.hi - seg.lo < 2.5
            per_board.append(n)
        print(
            f"| {cols}×{rows} | {density} | {total} | {low}（{low / total:.1%}） | {low_short} | "
            f"{statistics.median(per_board)} / {max(per_board)} |"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("layout")
    for name in ("taps", "all", "crossings"):
        p = sub.add_parser(name)
        p.add_argument("--seed", type=int, default=20261102)
        p.add_argument("--boards", type=int, default=30)
        p.add_argument("--taps", type=int, default=100)
    args = parser.parse_args()
    if args.command in ("layout", "all"):
        cmd_layout()
        print()
    if args.command in ("taps", "all"):
        cmd_taps(args)
    if args.command == "crossings":
        cmd_crossings(args)


if __name__ == "__main__":
    main()
