#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）スマホ操作の調査コード。

/add-puzzle の調査の「スマホ操作」の観点で使った。ブラウザは使わず、既存のプレイ画面のレイアウト
（Tailwind のクラスと定数）から、盤面のマス・数の欄のボタン・列の端の欄の大きさを計算する。
標準ライブラリだけで書き、乱数は seed を固定する。製品のコードはこのファイルに依存しない。

    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py existing  # 既存ゲームのマスとボタンの大きさ
    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py layout    # 盤面の大きさごとのマス・数の欄・列の端の欄
    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py limit     # 目安ごとの盤面の上限
    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py taps      # 手ぶれでの押し間違いの割合（解析解）
    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py ops       # 入れ方の案ごとの押す回数・指の移動
    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_mobile.py all
    （--bh 40 でボタンの高さ、--inset-bottom 34 で下の safe-area を変えて同じ表を出せる）

前提（コードから読んだ値。rem は 16px）
- プレイ画面の外枠 GamePlayFrame は fixed inset-0 overflow-hidden の縦の flex。
  上からブランドの帯 1.75rem=28px（BrandIdentityHeader compact）、PlayHeader 4.5rem=72px、
  ゲームの中身（flex-1）、下端の面 BrowserBottomSurface h-3=12px。合わせて 112px を盤面と操作に使えない。
- index.html の viewport は viewport-fit=cover。Playwright の iPhone 13（playtest-driver.mjs の iphone）では
  safe-area は 0。実機の Safari でツールバーが畳まれたときの下の余白（34px）は --inset-bottom で足せる（推測の値）。
- 最小幅は 320px（frontend/src/index.css の body の min-w-[320px]）。
- 魔方陣の配置（仮）: main は px-2 py-2（左右 8px・上下 8px）。盤面は縦横比を保って main に収める。
  footer は pt-2 pb-2（上下 8px）・左右 8px で、数の欄（ボタンの間 4px＝gap-1）と待ったを置く。待ったの置き方は3つを比べる。
    row: 数の欄の下に待ったの行（UndoButton の 48px の丸と、欄との間 8px で 56px）
    slot: 数の欄の最後の数の後ろの枠に置く（枠が足りなければ1行増える）
    lead: 数の欄の左に置く（48px と間 8px の 56px 分、欄の幅が減る。詰将棋が持駒の台の端に待ったを置く形）
  盤面を戻すは見出しのメニュー（PlayMenu）にあるので場所を取らない。置いた数を外すのは盤面のマスを押す操作にし、ボタンを置かない。
- 端末の高さは、390×664（playtest-driver.mjs の iphone ＝ Playwright の iPhone 13）のほかは推測の値。
"""

from __future__ import annotations

import argparse
import math
import random
import statistics

BRAND = 28
HEADER = 72
BOTTOM = 12
CHROME = BRAND + HEADER + BOTTOM
REM = 16

# 端末の表示領域（CSS px）。390×664 だけがコードの中の値（playtest-driver.mjs の iphone）。ほかの高さは推測。
VIEWPORTS: list[tuple[str, int, int]] = [
    ("iPhone 13 相当（試遊の端末）", 390, 664),
    ("iPhone SE 2/3 の Safari（推測）", 375, 548),
    ("Android 360 幅（推測）", 360, 640),
    ("320 幅・高め（推測）", 320, 568),
    ("320 幅・短い（推測）", 320, 460),
]

# 盤面の外の余白（仮）
MAIN_X = 8  # main の左右（px-2）
MAIN_Y = 16  # main の上下の合計（py-2）
FOOT_X = 8  # footer の左右
FOOT_Y = 16  # footer の上下の合計（pt-2 pb-2）
PAD_GAP = 4  # 数の欄のボタンの間（gap-1）
UNDO_ROW = 56  # 待ったの行（UndoButton size-12 = 48px と、数の欄との間 8px）
UNDO_LEAD = 56  # 待ったを数の欄の左に置くときに使う幅（48px と間 8px）
UNDO_CHOICES = ("row", "slot", "lead")
UNDO_LABELS = {"row": "下の行", "slot": "最後の枠", "lead": "左"}

# 列の端の欄のうち、数字を置けない間（リフレクションの外周ヒントの帯 0.8 と隙間 0.2 にならい、隙間を 0.2 マスとする）
STRIP_GAP = 0.2
# 数字1字の幅（em）。等幅の数字（tabular-nums）のゴシック体でおよそ 0.55〜0.6。推測の値で、大きい側を使う。
DIGIT_EM = 0.6
# 行の高さ（em）。縦の列の欄の高さに使う。
LINE_EM = 1.25

COL_CHOICES = range(4, 13)


def magic_constant(n: int) -> int:
    return n * (n * n + 1) // 2


def label_chars(n: int) -> int:
    """列の端の欄に出す「あと いくつ」の最大の字数（何も置いていない列の n(n²+1)/2）。超えた分を「−」つきで出すなら1字増える。"""
    return len(str(magic_constant(n)))


# ---------------------------------------------------------------------------- 既存ゲーム


def existing_rows(width: int, height: int) -> list[tuple[str, float, str]]:
    """既存ゲームの最大盤面のマス幅（と数を選ぶボタン）。(名前, 値, 備考)。式は各 Play のクラスから。"""
    rows: list[tuple[str, float, str]] = []
    # ナンプレ: main px-2 pt-1、盤面 w-[min(96vw,calc(100svh-12rem),38rem)] border-2、9列。
    # footer: pt-2 + 操作の行 min-h-16 + gap-3 + 数字の欄 h-14 + pb-3 = 152px。数字の欄は max-w-xl（36rem）・9列・gap-x-1。
    side = min(0.96 * width, height - 12 * REM, 38 * REM)
    total = CHROME + 4 + side + 152
    rows.append(("ナンプレ 9×9 マス", (side - 4) / 9, "" if total <= height else f"{total - height:.0f}px はみ出す"))
    pad_w = min(width - 24, 36 * REM)
    rows.append(("ナンプレ 数字のボタンの幅（高さ 56）", (pad_w - 8 * 4) / 9, ""))
    # タクズ: main px-3 py-2、盤面 min(100cqw,100cqh,42rem)、内側 p-3 と border-2、footer h-28。
    avail_h = height - CHROME - 16 - 112
    side = min(width - 24, avail_h, 42 * REM)
    rows.append(("タクズ 8×8 マス", (side - 24 - 4) / 8, ""))
    # 一筆パズル: main px-4 py-2、盤面 min(100cqw,100cqh,40rem)、footer h-28。
    side = min(width - 32, avail_h, 40 * REM)
    rows.append(("一筆パズル 8×8 マス", side / 8, ""))
    # ブリッジ: main px-2 py-2、盤面 min(100cqw,100cqh)、footer h-28。マスの間隔として 盤面/10。
    side = min(width - 16, avail_h)
    rows.append(("ブリッジ 10×10 マスの間隔", side / 10, ""))
    # リフレクション: main px-1 py-2、盤面 min(100cqw,100cqh,44rem)、外周ヒントで両側に 1 マス分（0.8+0.2）、
    # footer はストック h-11 + p-1 + pb-2 = 60px。ストックのボタンは h-11（44px）。
    side = min(width - 8, height - CHROME - 16 - 60, 44 * REM)
    rows.append(("リフレクション 10×10 マス", side / 12, ""))
    # マインスイーパー: main px-2 py-3、w-full max-w-[32rem]、12列×16行。
    side = min(width - 16, 32 * REM)
    cell = side / 12
    fits = 16 * cell <= height - CHROME - 24
    rows.append(("マインスイーパー 12列 マス", cell, "" if fits else "16行が入らない"))
    return rows


def cmd_existing() -> None:
    print("## 既存ゲームの最大盤面のマスと、数を選ぶボタンの幅（px）")
    names = [r[0] for r in existing_rows(390, 664)]
    print("| 端末 | " + " | ".join(names) + " |")
    print("|" + "---|" * (len(names) + 1))
    for label, w, h in VIEWPORTS:
        cells = []
        for _, value, note in existing_rows(w, h):
            cells.append(f"{value:.1f}" + (f"（{note}）" if note else ""))
        print(f"| {label} {w}×{h} | " + " | ".join(cells) + " |")


# ---------------------------------------------------------------------------- 魔方陣の配置


def layout(
    width: int,
    height: int,
    n: int,
    *,
    cols: int,
    bh: float,
    undo: str = "row",
    labels: str = "none",
    s: float = 0.8,
    label_font: float | None = None,
    count: int | None = None,
    inset_bottom: float = 0.0,
) -> dict:
    """1つの配置の寸法。

    labels（列の端の「あと いくつ」の欄）:
      none: 欄なし。
      right: 右に行の欄、下に縦の列の欄、右下の角に左上→右下の斜め、右上の角（上に1段）に右上→左下の斜め。
      sides: 右に行の欄、下に縦の列の欄、右下と左下の角に斜め（左に1列）。
    欄の幅は s×マス。label_font を渡すと、その大きさの字が label_chars(n) 字入る幅（と1行の高さ）を下限にする。
    count は数の欄に並べる数の個数（既定は n²）。
    """
    count = n * n if count is None else count
    slots = count + (1 if undo == "slot" else 0)
    rows = math.ceil(slots / cols)
    pad_h = rows * bh + (rows - 1) * PAD_GAP
    footer_h = FOOT_Y + pad_h + (UNDO_ROW if undo == "row" else 0)
    board_h = height - CHROME - inset_bottom - MAIN_Y - footer_h
    board_w = width - 2 * MAIN_X
    pad_left = FOOT_X + (UNDO_LEAD if undo == "lead" else 0)
    bw = (width - FOOT_X - pad_left - (cols - 1) * PAD_GAP) / cols
    chars = label_chars(n)

    def side(c: float) -> float:  # 行の欄の幅
        v = s * c
        if label_font is not None:
            v = max(v, STRIP_GAP * c + 4 + DIGIT_EM * label_font * chars)
        return v

    def band(c: float) -> float:  # 縦の列の欄の高さ
        v = s * c
        if label_font is not None:
            v = max(v, STRIP_GAP * c + LINE_EM * label_font + 2)
        return v

    def need(c: float) -> tuple[float, float]:
        if labels == "none":
            return n * c, n * c
        if labels == "right":
            return n * c + side(c), n * c + 2 * band(c)
        if labels == "sides":
            return n * c + 2 * side(c), n * c + band(c)
        raise ValueError(labels)

    lo, hi = 0.0, max(0.0, min(board_w, board_h) / n)
    for _ in range(60):
        mid = (lo + hi) / 2
        wn, hn = need(mid)
        if wn <= board_w and hn <= board_h:
            lo = mid
        else:
            hi = mid
    cell = lo
    wn, hn = need(cell)
    return {
        "cell": cell,
        "by_height": (board_h - hn) <= (board_w - wn),
        "bw": bw,
        "bh": bh,
        "rows": rows,
        "spare": rows * cols - slots,
        "footer_h": footer_h,
        "board_h": board_h,
        "board_w": board_w,
        "board_px": (wn, hn),
        "label_w": side(cell) - STRIP_GAP * cell if labels != "none" else 0.0,
        "cols": cols,
        "undo": undo,
        "pad_left": pad_left,
    }


def best_layout(width: int, height: int, n: int, *, bh: float, **kw) -> dict:
    """数の欄の列数と待ったの置き方を変え、盤面のマスとボタンの幅の小さい方が最も大きくなる配置。"""
    best = None
    for cols in COL_CHOICES:
        for undo in UNDO_CHOICES:
            lay = layout(width, height, n, cols=cols, bh=bh, undo=undo, **kw)
            key = (min(lay["cell"], lay["bw"]), lay["cell"])
            if best is None or key > best[0]:
                best = (key, lay)
    assert best is not None
    return best[1]


# 盤面の大きさごとに数の欄の列数を1つに決めるときに、どれでも小さくなりすぎないかを見る端末（高さがコードから分かる 390×664 と、
# 幅 360・320 の推測の高さ）。高さの短い 375×548・320×460 は、決めた配置で測るだけにする。
ROBUST_VIEWPORTS = [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[3]]


def robust_config(n: int, *, bh: float, inset_bottom: float = 0.0, undo_choices=UNDO_CHOICES) -> tuple[int, str]:
    """盤面の大きさ n ごとに、数の欄の列数と待ったの置き方を1つに決める。
    ROBUST_VIEWPORTS のどれでも min(マス, ボタンの幅) が最も大きく残るもの。"""
    best = None
    for cols in COL_CHOICES:
        for undo in undo_choices:
            worst = min(
                min(lay["cell"], lay["bw"])
                for lay in (
                    layout(w, h, n, cols=cols, bh=bh, undo=undo, inset_bottom=inset_bottom)
                    for _, w, h in ROBUST_VIEWPORTS
                )
            )
            if best is None or worst > best[0]:
                best = (worst, cols, undo)
    assert best is not None
    return best[1], best[2]


def font_cap(px: float, chars: int) -> float:
    """幅 px に chars 字の数字を入れられる最大の字の大きさ（左右 2px ずつ空ける）。"""
    return max(0.0, (px - 4) / (DIGIT_EM * chars))


def given_count(n: int) -> int:
    """最初から置いてある数の個数（仮）。5×5 で 11 個の試作（共通.md）の割合 0.44 を、ほかの大きさにも当てた推測の値。"""
    return round(0.44 * n * n)


def cmd_layout(args: argparse.Namespace) -> None:
    sizes = (4, 5, 6, 7, 8)
    print(f"条件: 数の欄のボタンの高さ {args.bh:g}px、ボタンの間 {PAD_GAP}px、main の左右 {MAIN_X}px、下の safe-area {args.inset_bottom:g}px")
    print()
    print("## 端末ごとに最もよい数の欄（列の端の欄なし）")
    print("数の欄の列数（4〜12）と待ったの置き方（下の行・最後の枠・左）を、マスとボタンの幅の小さい方が最も大きくなるように選んだ。")
    print("値は マス（px）／ボタン 幅×高さ（px）／欄の列×行・待った。")
    print("| 端末 | " + " | ".join(f"{n}×{n}（1〜{n * n}）" for n in sizes) + " |")
    print("|" + "---|" * (len(sizes) + 1))
    for label, w, h in VIEWPORTS:
        cells = []
        for n in sizes:
            lay = best_layout(w, h, n, bh=args.bh, inset_bottom=args.inset_bottom)
            cells.append(
                f"{lay['cell']:.1f}{'*' if lay['by_height'] else ''} ／ {lay['bw']:.1f}×{lay['bh']:.0f} ／ "
                f"{lay['cols']}×{lay['rows']}・{UNDO_LABELS[lay['undo']]}"
            )
        print(f"| {label} {w}×{h} | " + " | ".join(cells) + " |")
    print("* は高さで決まった値（幅だけならもっと大きくできる）。")
    print()

    print("## 数の欄の列数ごとのマス／ボタンの幅（px）。列の端の欄なし、待ったは下の行")
    for label, w, h in (VIEWPORTS[0], VIEWPORTS[3]):
        print(f"### {label} {w}×{h}")
        print("| 盤面 | " + " | ".join(f"{c}列" for c in COL_CHOICES) + " |")
        print("|" + "---|" * (len(COL_CHOICES) + 1))
        for n in sizes:
            cells = []
            for c in COL_CHOICES:
                lay = layout(w, h, n, cols=c, bh=args.bh, inset_bottom=args.inset_bottom)
                cells.append(f"{lay['cell']:.0f}/{lay['bw']:.0f}（{lay['rows']}行）")
            print(f"| {n}×{n} | " + " | ".join(cells) + " |")
        print()

    print("## 盤面の大きさごとに1つに決めた数の欄（列の端の欄なし）")
    print("390×664・360×640・320×568 のどれでも min(マス, ボタンの幅) が最も大きく残る列数と待ったの置き方。値は マス / ボタンの幅（px）。")
    print("| 盤面 | 欄の列数・待った | " + " | ".join(f"{w}×{h}" for _, w, h in VIEWPORTS) + " |")
    print("|" + "---|" * (len(VIEWPORTS) + 2))
    for n in sizes:
        cols, undo = robust_config(n, bh=args.bh, inset_bottom=args.inset_bottom)
        cells = []
        rows_count = 0
        for _, w, h in VIEWPORTS:
            lay = layout(w, h, n, cols=cols, bh=args.bh, undo=undo, inset_bottom=args.inset_bottom)
            rows_count = lay["rows"]
            cells.append(f"{lay['cell']:.1f} / {lay['bw']:.1f}")
        print(f"| {n}×{n} | {cols}列×{rows_count}行・{UNDO_LABELS[undo]} | " + " | ".join(cells) + " |")
    print()
    print("### 同じ列数で待ったの置き方だけを変えたとき（マス / ボタンの幅、390×664 と 320×568）")
    print("| 盤面 | 列数 | 下の行 | 最後の枠 | 左 |")
    print("|---|---|---|---|---|")
    for n in sizes:
        cols, _ = robust_config(n, bh=args.bh, inset_bottom=args.inset_bottom)
        cells = []
        for undo in UNDO_CHOICES:
            vals = []
            for _, w, h in (VIEWPORTS[0], VIEWPORTS[3]):
                lay = layout(w, h, n, cols=cols, bh=args.bh, undo=undo, inset_bottom=args.inset_bottom)
                vals.append(f"{lay['cell']:.1f}/{lay['bw']:.1f}")
            cells.append(" ・ ".join(vals))
        print(f"| {n}×{n} | {cols} | " + " | ".join(cells) + " |")
    print()

    print("## 列の端に「あと いくつ」の欄を出したときのマス（px）と、欄に入る字の大きさ")
    print("数の欄は上の「1つに決めた数の欄」に揃え、欄の有無と形だけを変えた。")
    print("right: 右と下に欄・右上に1段（幅 n+s、高さ n+2s）。sides: 右と下に欄・左下の角に1列（幅 n+2s、高さ n+s）。s=0.8 はマスに対する比")
    print("（数字の入らない隙間 0.2 を含む。リフレクションの外周ヒントと同じ）。「sides 12px」は、12px（text-play-meta と同じ大きさ）の字が")
    print(f"{', '.join(f'{n}×{n} は {label_chars(n)}字（{magic_constant(n)}）' for n in (4, 5, 6, 7))} 入る幅を欄の下限にしたもの。")
    print("「sides 最小」は s=0 とし、12px の字が入る幅と1行の高さ（0.2 マスの隙間を含む）だけを欄に取ったもの。")
    print("字の大きさは、s=0.8 の行の欄に入る最大（px）。")
    print("| 端末 | 盤面 | 欄なし | right s=0.8 | sides s=0.8 | sides 12px | sides 最小 | 欄なしとの差（sides 12px / sides 最小） | 字の大きさ right / sides（s=0.8） |")
    print("|---|---|---|---|---|---|---|---|---|")
    for label, w, h in VIEWPORTS:
        for n in (4, 5, 6, 7):
            cols, undo = robust_config(n, bh=args.bh, inset_bottom=args.inset_bottom)
            common = {"cols": cols, "bh": args.bh, "undo": undo, "inset_bottom": args.inset_bottom}
            base = layout(w, h, n, **common)
            right = layout(w, h, n, labels="right", **common)
            sides = layout(w, h, n, labels="sides", **common)
            fitted = layout(w, h, n, labels="sides", label_font=12.0, **common)
            minimal = layout(w, h, n, labels="sides", s=0.0, label_font=12.0, **common)
            diff = fitted["cell"] - base["cell"]
            diff_min = minimal["cell"] - base["cell"]
            chars = label_chars(n)
            print(
                f"| {label} {w}×{h} | {n}×{n} | {base['cell']:.1f}{'*' if base['by_height'] else ''} | "
                f"{right['cell']:.1f} | {sides['cell']:.1f}{'*' if sides['by_height'] else ''} | "
                f"{fitted['cell']:.1f}{'*' if fitted['by_height'] else ''} | "
                f"{minimal['cell']:.1f}{'*' if minimal['by_height'] else ''} | "
                f"{diff:+.1f}（{diff / base['cell']:+.0%}） / {diff_min:+.1f}（{diff_min / base['cell']:+.0%}） | "
                f"{font_cap(right['label_w'], chars):.1f} / {font_cap(sides['label_w'], chars):.1f} |"
            )
    print("* は高さで決まった値。")
    print()

    print("## 数の欄に、最初から置いてある数を並べない場合（残りの数だけを小さい順に並べる。1問の間は並びが変わらない）")
    print(f"最初から置いてある数の個数は 0.44×n² と置いた（{', '.join(f'{n}×{n}: {given_count(n)}' for n in (4, 5, 6, 7))}。推測の値）。")
    print("値は マス（1〜n² をすべて並べた「端末ごとに最もよい数の欄」との差）／ボタンの幅・欄の列×行。")
    print("| 端末 | " + " | ".join(f"{n}×{n}（{n * n - given_count(n)}個）" for n in (4, 5, 6, 7)) + " |")
    print("|" + "---|" * 5)
    for label, w, h in VIEWPORTS:
        cells = []
        for n in (4, 5, 6, 7):
            full = best_layout(w, h, n, bh=args.bh, inset_bottom=args.inset_bottom)
            lay = best_layout(w, h, n, bh=args.bh, count=n * n - given_count(n), inset_bottom=args.inset_bottom)
            cells.append(f"{lay['cell']:.1f}（{lay['cell'] - full['cell']:+.1f}）／{lay['bw']:.1f}・{lay['cols']}×{lay['rows']}")
        print(f"| {label} {w}×{h} | " + " | ".join(cells) + " |")
    print()

    print("## 1〜n² の欄を持たない案との比べ（列の端の欄なし）")
    print("0〜9 のキー: ナンプレと同じ footer（操作の行 64 と数字の行 56、計 152px）。キーは 10 個を1行（幅 (W−24−36)/10）。")
    print("盤面の上に出す選び窓: footer は待ったの行だけ（16+48=64px）。盤面は大きいが、選ぶ間は窓が盤面を覆う。")
    print("| 端末 | 盤面 | 1〜n² の欄（1つに決めた数の欄）: マス | 0〜9 のキー: マス／キーの幅 | 選び窓: マス |")
    print("|---|---|---|---|---|")
    for label, w, h in VIEWPORTS:
        for n in (5, 7):
            cols, undo = robust_config(n, bh=args.bh, inset_bottom=args.inset_bottom)
            pad = layout(w, h, n, cols=cols, bh=args.bh, undo=undo, inset_bottom=args.inset_bottom)
            board_h = h - CHROME - args.inset_bottom - MAIN_Y - 152
            keypad_cell = min(w - 2 * MAIN_X, board_h) / n
            key_w = (w - 24 - 9 * 4) / 10
            board_h2 = h - CHROME - args.inset_bottom - MAIN_Y - 64
            popup_cell = min(w - 2 * MAIN_X, board_h2) / n
            print(f"| {label} {w}×{h} | {n}×{n} | {pad['cell']:.1f} | {keypad_cell:.1f}／{key_w:.1f} | {popup_cell:.1f} |")


# ---------------------------------------------------------------------------- 盤面の上限

TIERS = [
    # (名前, マスの下限, ボタンの幅の下限, ボタンの高さ)
    ("下限（既存ゲームの 320px 幅並み）", 30.0, 29.0, 40.0),
    ("標準（ナンプレの 390px 幅並み）", 40.0, 36.0, 44.0),
]


def cmd_limit(args: argparse.Namespace) -> None:
    print("目安を満たす配置（数の欄の列数・待ったの置き方を選ぶ）がある最大の盤面（4×4〜10×10）。数の欄には 1〜n² をすべて並べる。")
    print("下限: マス 30px 以上・ボタン 29px 幅以上・高さ 40px。320px 幅で、ナンプレの数字のボタンは 29.3px、")
    print("ブリッジ 10×10 のマスの間隔は 30.4px、マインスイーパー 12列のマスは 25.3px。")
    print("標準: マス 40px 以上・ボタン 36px 幅以上・高さ 44px。390px 幅で、ナンプレはマス 41.2px・ボタン 37.1px。")
    print("値は 上限（その配置のマス・ボタンの幅・欄の列数・待った）。")
    print()
    for labels_title, labels, font in (("列の端の欄なし", "none", None), ("列の端の欄あり（sides 12px）", "sides", 12.0)):
        print(f"### {labels_title}")
        print("| 端末 | " + " | ".join(t[0] for t in TIERS) + " |")
        print("|---|---|---|")
        for label, w, h in VIEWPORTS:
            cells = []
            for _, cmin, bwmin, bh in TIERS:
                best: tuple[int, dict] | None = None
                for n in range(4, 11):
                    chosen = None
                    for cols in COL_CHOICES:
                        for undo in UNDO_CHOICES:
                            lay = layout(
                                w, h, n, cols=cols, bh=bh, undo=undo, labels=labels, label_font=font,
                                inset_bottom=args.inset_bottom,
                            )
                            if lay["cell"] >= cmin and lay["bw"] >= bwmin and (chosen is None or lay["cell"] > chosen["cell"]):
                                chosen = lay
                    if chosen is not None:
                        best = (n, chosen)
                if best is None:
                    cells.append("4×4 も満たさない")
                else:
                    n, lay = best
                    cells.append(
                        f"{n}×{n}（マス {lay['cell']:.1f}・ボタン {lay['bw']:.1f}・{lay['cols']}列・{UNDO_LABELS[lay['undo']]}）"
                    )
            print(f"| {label} {w}×{h} | " + " | ".join(cells) + " |")
        print()


# ---------------------------------------------------------------------------- 押し間違い（解析解)


def phi(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def tap_outcome(w: float, h: float, gap: float, sigma: float) -> tuple[float, float, float]:
    """格子に並ぶ的の中心を狙い、x・y に独立な正規分布のぶれ（標準偏差 sigma）が乗ったときの
    (狙った的, ほかの的, どの的でもない所) の割合。周りに同じ大きさの的が続く内側の的を想定する。"""

    def one_d(size: float) -> tuple[float, float]:
        pitch = size + gap
        target = phi(size / 2 / sigma) - phi(-size / 2 / sigma)
        other = 0.0
        for k in range(1, 6):
            lo = k * pitch - size / 2
            hi = k * pitch + size / 2
            other += 2 * (phi(hi / sigma) - phi(lo / sigma))
        return target, other

    tx, ox = one_d(w)
    ty, oy = one_d(h)
    target = tx * ty
    any_button = (tx + ox) * (ty + oy)
    return target, any_button - target, 1 - any_button


def cmd_taps(args: argparse.Namespace) -> None:
    print("狙った所の中心を押し、x・y に独立な正規分布のぶれを足した（標準偏差 σ=4px・8px。一筆パズル PoC・ブリッジの調査と同じ値）。")
    print("盤面のマスは間 0（罫線の上は隣と半分ずつ）、数の欄のボタンは間 4px。周りに同じ大きさの的が続く内側の的を想定した解析解。")
    print("魔方陣の値は「1つに決めた数の欄」（列の端の欄なし）の配置。")
    print()
    print("| 的 | 大きさ（px） | σ4: 狙いどおり / 隣 / 空き | σ8: 狙いどおり / 隣 / 空き |")
    print("|---|---|---|---|")
    targets = []
    for _, w, h in (VIEWPORTS[0], VIEWPORTS[3]):
        for n in (4, 5, 6, 7):
            cols, undo = robust_config(n, bh=44, inset_bottom=args.inset_bottom)
            lay = layout(w, h, n, cols=cols, bh=44, undo=undo, inset_bottom=args.inset_bottom)
            targets.append((f"{w}×{h} {n}×{n} マス", lay["cell"], lay["cell"], 0.0))
            targets.append((f"{w}×{h} {n}×{n} 数の欄", lay["bw"], lay["bh"], PAD_GAP))
    targets.append(("ナンプレ 390px 数字のボタン", 37.1, 56.0, 4.0))
    targets.append(("ナンプレ 320px 数字のボタン", 29.3, 56.0, 4.0))
    targets.append(("0〜9 のキー 390px", (390 - 24 - 36) / 10, 56.0, 4.0))
    targets.append(("0〜9 のキー 320px", (320 - 24 - 36) / 10, 56.0, 4.0))
    for label, w, h, gap in targets:
        r4 = tap_outcome(w, h, gap, 4.0)
        r8 = tap_outcome(w, h, gap, 8.0)
        print(
            f"| {label} | {w:.1f}×{h:.1f} | {r4[0]:.3f} / {r4[1]:.3f} / {r4[2]:.3f} | {r8[0]:.3f} / {r8[1]:.3f} / {r8[2]:.3f} |"
        )


# ---------------------------------------------------------------------------- 入れ方の案


def siamese(n: int) -> list[list[int]]:
    grid = [[0] * n for _ in range(n)]
    i, j = 0, n // 2
    for k in range(1, n * n + 1):
        grid[i][j] = k
        ni, nj = (i - 1) % n, (j + 1) % n
        if grid[ni][nj]:
            ni, nj = (i + 1) % n, j
        i, j = ni, nj
    return grid


def doubly_even(n: int) -> list[list[int]]:
    grid = [[i * n + j + 1 for j in range(n)] for i in range(n)]
    for i in range(n):
        for j in range(n):
            if i % 4 == j % 4 or (i % 4) + (j % 4) == 3:
                grid[i][j] = n * n + 1 - grid[i][j]
    return grid


def singly_even(n: int) -> list[list[int]]:
    """Strachey の方法。"""
    m = n // 2
    a = siamese(m)
    k = (n - 2) // 4
    grid = [[0] * n for _ in range(n)]
    for i in range(m):
        for j in range(m):
            v = a[i][j]
            grid[i][j] = v
            grid[i + m][j + m] = v + m * m
            grid[i][j + m] = v + 2 * m * m
            grid[i + m][j] = v + 3 * m * m
    for i in range(m):
        cols = range(1, k + 1) if i == m // 2 else range(k)
        for j in cols:
            grid[i][j], grid[i + m][j] = grid[i + m][j], grid[i][j]
        for j in range(n - k + 1, n):
            grid[i][j], grid[i + m][j] = grid[i + m][j], grid[i][j]
    return grid


def magic_square(n: int, rng: random.Random) -> list[int]:
    """古典的な作り方の魔方陣に、回転・裏返し・補数（v → n²+1−v）を乱数でかけたもの（行優先）。"""
    if n % 2 == 1:
        grid = siamese(n)
    elif n % 4 == 0:
        grid = doubly_even(n)
    else:
        grid = singly_even(n)
    for _ in range(rng.randrange(4)):
        grid = [list(row) for row in zip(*grid[::-1])]
    if rng.random() < 0.5:
        grid = [row[::-1] for row in grid]
    if rng.random() < 0.5:
        grid = [[n * n + 1 - v for v in row] for row in grid]
    flat = [v for row in grid for v in row]
    m = magic_constant(n)
    assert sorted(flat) == list(range(1, n * n + 1))
    assert all(sum(grid[i]) == m for i in range(n))
    assert all(sum(grid[i][j] for i in range(n)) == m for j in range(n))
    assert sum(grid[i][i] for i in range(n)) == m and sum(grid[i][n - 1 - i] for i in range(n)) == m
    return flat


def keypad_taps(k: int, total: int) -> int:
    """0〜9 のキーで k を打つ押す回数（マスを選ぶ1回を含む）。1桁で、後ろに数字を足すと別の数になりうるときは決定を1回足す。"""
    digits = len(str(k))
    ambiguous = digits == 1 and 10 * k <= total
    return 1 + digits + (1 if ambiguous else 0)


def fitts_id(distance: float, size: float) -> float:
    return math.log2(distance / size + 1)


def cmd_ops(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    print(f"seed={args.seed} 盤面ごとの問題 {args.problems}（古典的な魔方陣に回転・裏返し・補数を乱数でかけ、最初から置く数は 0.44×n² を乱数で選ぶ）。")
    print("置く順は空きマスを乱数で並べた順（解く順の模型ではなく、指の移動の幾何の目安）。指の移動は 390×664・列の端の欄なし・")
    print("「1つに決めた数の欄」の配置で測った。押す回数は間違えずに全部置くまでの回数。")
    print("0〜9 のキーは、1桁で後ろに足すと別の数になりうる数（4×4 の 1 など）だけ決定を押す。")
    print("指の移動の難しさは Fitts の式 log2(距離/的の小さい辺 + 1)（ビット）の和。時間への換算はしていない。")
    print()
    print("| 盤面 | 置く数（中央値） | マス→数 / 数→マス: 押す回数 | なぞって運ぶ: なぞる回数 | 0〜9 のキー: 押す回数 | 1つ置く間の指の移動（px, 平均） | 1つ置く間の難しさ（ビット, 平均） | 0〜9 のキー: 難しさ（ビット, 平均） |")
    print("|---|---|---|---|---|---|---|---|")
    w, h = VIEWPORTS[0][1], VIEWPORTS[0][2]
    for n in (4, 5, 6, 7):
        cols, undo = robust_config(n, bh=44, inset_bottom=args.inset_bottom)
        lay = layout(w, h, n, cols=cols, bh=44, undo=undo, inset_bottom=args.inset_bottom)
        cell = lay["cell"]
        board_side = cell * n
        board_left = (w - board_side) / 2
        main_top = BRAND + HEADER
        main_h = lay["board_h"] + MAIN_Y
        board_top = main_top + (main_h - board_side) / 2
        footer_top = h - BOTTOM - args.inset_bottom - lay["footer_h"]
        bw, bh, pad_left = lay["bw"], lay["bh"], lay["pad_left"]

        def cell_xy(c: int) -> tuple[float, float]:
            r, q = divmod(c, n)
            return board_left + (q + 0.5) * cell, board_top + (r + 0.5) * cell

        def pad_xy(v: int) -> tuple[float, float]:
            r, q = divmod(v - 1, cols)
            return pad_left + q * (bw + PAD_GAP) + bw / 2, footer_top + 8 + r * (bh + PAD_GAP) + bh / 2

        # 0〜9 のキー（ナンプレと同じ footer。数字の行が下、決定は上の操作の行の右端に置くとした）
        key_w = (w - 24 - 9 * 4) / 10
        key_top = h - BOTTOM - args.inset_bottom - 12 - 56
        keypad_board_h = h - CHROME - args.inset_bottom - MAIN_Y - 152
        kcell = min(w - 2 * MAIN_X, keypad_board_h) / n
        kleft = (w - kcell * n) / 2
        ktop = main_top + (keypad_board_h + MAIN_Y - kcell * n) / 2

        def key_xy(d: int) -> tuple[float, float]:
            idx = 9 if d == 0 else d - 1
            return 12 + idx * (key_w + 4) + key_w / 2, key_top + 28

        confirm_xy = (w - 12 - (w - 24) / 6, key_top - 12 - 32)

        def kcell_xy(c: int) -> tuple[float, float]:
            r, q = divmod(c, n)
            return kleft + (q + 0.5) * kcell, ktop + (r + 0.5) * kcell

        placed_counts = []
        taps_ab = []
        taps_drag = []
        taps_key = []
        dists = []
        ids = []
        key_ids = []
        for _ in range(args.problems):
            sol = magic_square(n, rng)
            givens = set(rng.sample(range(n * n), given_count(n)))
            empties = [c for c in range(n * n) if c not in givens]
            rng.shuffle(empties)
            placed_counts.append(len(empties))
            taps_ab.append(2 * len(empties))
            taps_drag.append(len(empties))
            taps_key.append(sum(keypad_taps(sol[c], n * n) for c in empties))
            pos = pad_xy(sol[empties[0]])  # 最初は数の欄の上に指があるとする
            kpos = key_xy(1)
            for c in empties:
                # マス→数: 前の数のボタン → マス → 数のボタン（数→マス・なぞって運ぶも同じ道のりをたどる）
                cx, cy = cell_xy(c)
                px, py = pad_xy(sol[c])
                d1 = math.dist(pos, (cx, cy))
                d2 = math.dist((cx, cy), (px, py))
                dists.append(d1 + d2)
                ids.append(fitts_id(d1, cell) + fitts_id(d2, min(bw, bh)))
                pos = (px, py)
                # 0〜9 のキー: 前のキー → マス → 1桁目 → 2桁目 → （決定）
                route = [kcell_xy(c)] + [key_xy(int(ch)) for ch in str(sol[c])]
                if keypad_taps(sol[c], n * n) > 1 + len(str(sol[c])):
                    route.append(confirm_xy)
                total = 0.0
                prev = kpos
                for i, p in enumerate(route):
                    size = kcell if i == 0 else (48.0 if p == confirm_xy else key_w)
                    total += fitts_id(max(1.0, math.dist(prev, p)), size)
                    prev = p
                key_ids.append(total)
                kpos = prev
        print(
            f"| {n}×{n} | {statistics.median(placed_counts):.0f} | {statistics.mean(taps_ab):.1f} | "
            f"{statistics.mean(taps_drag):.1f} | {statistics.mean(taps_key):.1f} | {statistics.mean(dists):.0f} | "
            f"{statistics.mean(ids):.2f} | {statistics.mean(key_ids):.2f} |"
        )
    print()
    print("0〜9 のキーの押す回数（1つ置くあたり、1〜n² を一様に置くとき。マスを選ぶ1回を含む）")
    for n in (4, 5, 6, 7):
        total = n * n
        vals = [keypad_taps(k, total) for k in range(1, total + 1)]
        amb = [k for k in range(1, 10) if 10 * k <= total]
        print(f"- {n}×{n}: 平均 {statistics.mean(vals):.2f} 回。決定が要る数: {amb}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("existing", "layout", "limit", "taps", "ops", "all"):
        p = sub.add_parser(name)
        p.add_argument("--bh", type=float, default=44.0, help="数の欄のボタンの高さ（px）")
        p.add_argument("--inset-bottom", type=float, default=0.0, help="下の safe-area（px）")
        p.add_argument("--seed", type=int, default=20261122)
        p.add_argument("--problems", type=int, default=200)
    args = parser.parse_args()
    if args.command in ("existing", "all"):
        cmd_existing()
        print()
    if args.command in ("layout", "all"):
        cmd_layout(args)
        print()
    if args.command in ("limit", "all"):
        cmd_limit(args)
        print()
    if args.command in ("taps", "all"):
        cmd_taps(args)
        print()
    if args.command in ("ops", "all"):
        cmd_ops(args)


if __name__ == "__main__":
    main()
