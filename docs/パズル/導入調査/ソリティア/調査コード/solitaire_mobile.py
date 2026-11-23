"""ソリティア（solitaire）スマホ操作の調査。

ブラウザは使わず、今のプレイ画面の骨格（Tailwind のクラスと定数）から札の大きさと縦の重ね方を計算し、
配り方を生成して列の長さを測り、置き先の指定だけで手が1つに決まるかを確かめる。標準ライブラリだけで動く。

    python3 docs/パズル/導入調査/ソリティア/調査コード/solitaire_mobile.py layout    # 既存ゲームとの比較・札の大きさ・縦の重ね方
    python3 docs/パズル/導入調査/ソリティア/調査コード/solitaire_mobile.py columns   # 列の長さ（理論上の上限・解いた手順・素朴な遊び方）
    python3 docs/パズル/導入調査/ソリティア/調査コード/solitaire_mobile.py moves     # 置き元の山と置き先の山だけで手が1つに決まるか
    python3 docs/パズル/導入調査/ソリティア/調査コード/solitaire_mobile.py all

前提（コードから読んだ値。rem は 16px、spacing 1 は 0.25rem=4px）
- 最小幅: frontend/src/index.css の body に min-w-[320px]。
- index.html の viewport は viewport-fit=cover。ブラウザ表示の縦画面では safe-area-inset は 0 とみなす（推測。末尾の別表で下端 34px も計算する）。
- GamePlayFrame（frontend/src/components/GamePlayFrame.tsx）は fixed inset-0 overflow-hidden の縦の flex。
  上から BrandIdentityHeader compact 1.75rem=28px、PlayHeader h-[4.5rem]=72px、ゲームの main と footer、
  BrowserBottomSurface h-3=12px。
- 待ったの帯: footer grid h-28=112px（ウォーターソート・タクズ・一筆・氷の床・パーキングジャム・橋をかけろ）。
  中は h-14 の行に UndoButton size-12=48px。
  手詰まりの知らせ DeadlockNotice は py-2＋text-play-context 行の高さ 1.25rem＋mt-1＋Button h-9 = 16+20+4+36 = 76px、footer の pb-2 を足して 84px。
- 既存ゲームの盤面（最大の盤面）:
  - マインスイーパー: main px-2 py-3、w-full max-w-[32rem]、格子 p-[8px] gap-[4px]、最大 16行×12列（difficulty.ts）。footer なし。
  - ナンプレ: 盤面 w-[min(96vw,calc(100svh-12rem),38rem)]、枠 border-2、9列。
  - 一筆: main px-4 py-2、aspect-square w-[min(100cqw,100cqh,40rem)]、footer h-28。最大 8×8。
  - タクズ: main px-3 py-2、aspect-square w-[min(100cqw,100cqh,42rem)]、盤面の外側 p-3、枠 border-2、footer h-28。最大 8×8（タクズ導入前提調査）。
  - 橋をかけろ: main px-2 py-2、aspect-square w-[min(100cqw,100cqh)]、10×10 は周りに 0.2マスの海（board-geometry.ts）、footer h-28。
  - ウォーターソート: main px-3 py-2、最大 14本（12色＋空き2本）は 7列×2段、列の間 10px・段の間 34px、
    ボトルの幅/高さ 0.36、選んだボトルの持ち上げ 3.5 spacing=14px、footer h-28。
"""

from __future__ import annotations

import argparse
import math
import random
import statistics
import sys
from collections import Counter

REM = 16
BRAND = 28
HEADER = 72
BOTTOM_SURFACE = 12
FOOTER_STANDARD = 112
DEADLOCK_NOTICE_WITH_PADDING = 84
UNDO_ROW = 64  # h-14 の行（56px）＋pb-2（8px）。待ったの丸 48px だけを置く帯

# 端末の表示領域（CSS px）。幅は index.css の min-w-[320px] と既存の調査（320 / 360 / 375 / 390px）から。
# 「推測の高さ」はツールバーを出した Safari などの表示領域の目安で、橋をかけろの調査（bridges_mobile.py）と同じ値。実機では測っていない。
VIEWPORTS: list[tuple[str, int, int]] = [
    ("iPhone 13 Safari（推測の高さ）", 390, 664),
    ("390×844（画面全体）", 390, 844),
    ("375×667（SE2/3 の画面全体）", 375, 667),
    ("iPhone SE2/3 Safari（推測の高さ）", 375, 548),
    ("Android 360（推測の高さ）", 360, 640),
    ("320×568（SE 第1世代の画面全体）", 320, 568),
    ("320 Safari（推測の高さ）", 320, 460),
]

LONGEST_COLUMN = 19  # 7列目の上の6枚＋K〜A の13枚

# ---------------------------------------------------------------- 既存ゲームの最大盤面の押す対象（px）


def minesweeper_cell(w: int, h: int, cols: int, rows: int) -> tuple[float, bool]:
    side = min(w - 2 * 8, 32 * REM)
    cell = (side - 2 * 8 - 4 * (cols - 1)) / cols
    board_h = rows * cell + 4 * (rows - 1) + 2 * 8
    return cell, board_h <= h - BRAND - HEADER - 2 * 12 - BOTTOM_SURFACE


def nanpure_cell(w: int, h: int) -> float:
    side = min(0.96 * w, h - 12 * REM, 38 * REM)
    return (side - 2 * 2) / 9


def play_area(w: int, h: int, px: int, py: int, footer: int) -> tuple[float, float]:
    """footer つきの骨格で、main の内側（container の幅と高さ）。"""
    return w - 2 * px, h - BRAND - HEADER - 2 * py - footer - BOTTOM_SURFACE


def hitofude_cell(w: int, h: int, n: int = 8) -> float:
    cw, ch = play_area(w, h, 16, 8, FOOTER_STANDARD)
    return min(cw, ch, 40 * REM) / n


def takuzu_cell(w: int, h: int, n: int = 8) -> float:
    cw, ch = play_area(w, h, 12, 8, FOOTER_STANDARD)
    side = min(cw, ch, 42 * REM)
    return (side - 2 * 12 - 2 * 2) / n


def bridges_cell(w: int, h: int, n: int = 10) -> float:
    cw, ch = play_area(w, h, 8, 8, FOOTER_STANDARD)
    return min(cw, ch) / (n + 2 * 0.2)


def water_sort_bottle(w: int, h: int) -> tuple[float, float]:
    """14本（7列×2段）のボトルの幅と高さ。"""
    cw, ch = play_area(w, h, 12, 8, FOOTER_STANDARD)
    cols, rows, col_gap, row_gap, lift, aspect = 7, 2, 10, 34, 14, 0.36
    layout_w = min(cw, max(366, min(0.48 * w, 570)))
    by_h = (ch - lift - row_gap * (rows - 1)) * (aspect * cols / rows) + col_gap * (cols - 1)
    width = min(layout_w, by_h)
    bw = (width - col_gap * (cols - 1)) / cols
    return bw, bw / aspect


# ---------------------------------------------------------------- ソリティアの札の大きさと縦の重ね方


def card_size(w: int, px: int, gap: int, aspect: float) -> tuple[float, float]:
    cw = (w - 2 * px - 6 * gap) / 7
    return cw, cw * aspect


def tableau_offsets(
    w: int,
    h: int,
    *,
    px: int = 8,
    gap: int = 4,
    aspect: float = 1.4,
    py: int = 8,
    row_gap: int = 8,
    footer: int = FOOTER_STANDARD,
    bottom_inset: int = 0,
) -> dict[str, float]:
    """上の段（山札・捨て札・組札）と7列を縦に置いたときの寸法。

    盤面の高さ = 画面の高さ − ブランドの帯 − 見出し − main の上下の余白 − 帯 − 下端の面 − 下端の safe-area。
    列に使える高さ = 盤面の高さ − 上の段の札の高さ − 上の段と列の間。
    n 枚の列は、上の n−1 枚を off ずつずらし、いちばん手前の1枚を札の高さで描く。
    """
    cw, ch = card_size(w, px, gap, aspect)
    board_h = h - BRAND - HEADER - 2 * py - footer - BOTTOM_SURFACE - bottom_inset
    tableau_h = board_h - ch - row_gap
    return {
        "card_w": cw,
        "card_h": ch,
        "board_h": board_h,
        "tableau_h": tableau_h,
        "off19": (tableau_h - ch) / (LONGEST_COLUMN - 1),
        "off13": (tableau_h - ch) / 12,
    }


def max_cards(tableau_h: float, card_h: float, min_off: float) -> int:
    if tableau_h < card_h:
        return 0
    return int(math.floor((tableau_h - card_h) / min_off + 1e-9)) + 1


def index_font(off: float) -> float:
    """ずらした帯に入る札の印（数字とマーク）の字の大きさの目安（推測）。

    帯の上の余白 2px と下の隙間 1px を引き、マークの字面を字の大きさの 0.8 倍とみなす。
    """
    return max(0.0, (off - 3) / 0.8)


def cmd_layout() -> None:
    print("## 既存ゲームの最大盤面の押す対象（px）")
    header = [
        "端末",
        "マインスイーパー12列",
        "マインスイーパー10列",
        "ナンプレ9×9",
        "一筆8×8",
        "タクズ8×8",
        "橋をかけろ10×10",
        "ウォーターソート14本（幅×高さ）",
    ]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for name, w, h in VIEWPORTS:
        c12, f12 = minesweeper_cell(w, h, 12, 16)
        c10, f10 = minesweeper_cell(w, h, 10, 14)
        bw, bh = water_sort_bottle(w, h)
        row = [
            f"{name} {w}×{h}",
            f"{c12:.1f}{'' if f12 else '!'}",
            f"{c10:.1f}{'' if f10 else '!'}",
            f"{nanpure_cell(w, h):.1f}",
            f"{hitofude_cell(w, h):.1f}",
            f"{takuzu_cell(w, h):.1f}",
            f"{bridges_cell(w, h):.1f}",
            f"{bw:.1f}×{bh:.1f}",
        ]
        print("| " + " | ".join(row) + " |")
    print("! はマインスイーパーの最大行数（12列は16行、10列は14行）が縦に収まらない。")
    print()

    print("## 7列の札の幅（px）: 左右の余白 px と列の間 gap ごと")
    combos = [(4, 2), (4, 4), (8, 3), (8, 4), (12, 4), (16, 4), (8, 6)]
    print("| 幅 | " + " | ".join(f"px{p} gap{g}" for p, g in combos) + " |")
    print("|" + "---|" * (len(combos) + 1))
    for wv in (320, 360, 375, 390):
        cells = [f"{card_size(wv, p, g, 1.4)[0]:.1f}" for p, g in combos]
        print(f"| {wv} | " + " | ".join(cells) + " |")
    cw, ch = card_size(320, 8, 4, 1.4)
    print(
        f"320px・px8 gap4: 札 {cw:.1f}×{ch:.1f}px（縦横比 1.4）。列の山を押せる幅は札＋列の間 {cw + 4:.1f}px、"
        f"組札4つの並び {4 * cw + 3 * 4:.1f}×{ch:.1f}px。"
    )
    print()

    footers = [
        ("待ったの帯 112（既存と同じ）", FOOTER_STANDARD),
        ("知らせが入る帯 84", DEADLOCK_NOTICE_WITH_PADDING),
        ("待ったの丸だけの帯 64", UNDO_ROW),
        ("帯なし（待ったを上の段に置く）", 8),
    ]
    for aspect in (1.4, 1.3):
        print(f"## 19枚の列のずらし幅と、ずらし幅ごとに収まる最大枚数（px8 gap4、縦横比 {aspect}、main の上下 8px、上の段と列の間 8px）")
        print("帯なしは footer を pb-2 の 8px だけとした。セルは「19枚のずらし幅 px（帯に入る字の大きさの目安 px）/ 12px・15px・18px で収まる枚数」。")
        print("| 端末 | 札 | " + " | ".join(name for name, _ in footers) + " |")
        print("|" + "---|" * (len(footers) + 2))
        for name, w, h in VIEWPORTS:
            first = tableau_offsets(w, h, aspect=aspect)
            cells = []
            for _, f in footers:
                t = tableau_offsets(w, h, aspect=aspect, footer=f)
                ns = "・".join(str(max_cards(t["tableau_h"], t["card_h"], m)) for m in (12, 15, 18))
                cells.append(f"{t['off19']:.1f}（{index_font(t['off19']):.1f}）/ {ns}")
            print(
                f"| {name} {w}×{h} | {first['card_w']:.1f}×{first['card_h']:.1f} | " + " | ".join(cells) + " |"
            )
        print()

    print("## 下端の safe-area を 34px とした場合（ホーム画面に置いた表示など。推測）: 19枚のずらし幅 px")
    print("| 端末 | " + " | ".join(name for name, _ in footers) + " |")
    print("|" + "---|" * (len(footers) + 1))
    for name, w, h in VIEWPORTS:
        if w < 375:
            continue
        cells = [f"{tableau_offsets(w, h, footer=f, bottom_inset=34)['off19']:.1f}" for _, f in footers]
        print(f"| {name} {w}×{h} | " + " | ".join(cells) + " |")
    print()

    print("## 狙った所に指が入る確率（手ぶれを x・y 独立の正規分布 σ とする。σ 4px / 8px は一筆パズル PoC・橋をかけろの調査と同じ）")
    print("札1枚を選ぶ: ずらした帯の真ん中を狙い、上下の帯の幅に入る確率。山を選ぶ: 列の真ん中を狙い、山を押せる幅（札＋列の間）に入る確率。")

    def inside(half: float, sigma: float) -> float:
        return math.erf(half / (sigma * math.sqrt(2)))

    print("| 対象 | 幅 px | σ4 | σ8 |")
    print("|---|---|---|---|")
    for off in (11.6, 13.1, 14.2, 15.0, 17.3, 21.1):
        print(f"| 札1枚（ずらした帯） | {off} | {inside(off / 2, 4):.1%} | {inside(off / 2, 8):.1%} |")
    for wv in (320, 390):
        pitch = card_size(wv, 8, 4, 1.4)[0] + 4
        print(f"| 山（{wv}px の列の幅） | {pitch:.1f} | {inside(pitch / 2, 4):.1%} | {inside(pitch / 2, 8):.1%} |")
    print()

    print("## 列の枚数ごとのずらし幅（px8 gap4・縦横比 1.4）。ゆとりのあるときは札の高さの 0.3 倍までにし、長い列だけ詰める")
    print("| 端末・帯 | 列に使える高さ | " + " | ".join(f"{n}枚" for n in range(7, 20)) + " |")
    print("|" + "---|" * 15)
    for name, w, h in VIEWPORTS:
        for fname, f in (("帯112", FOOTER_STANDARD), ("帯64", UNDO_ROW)):
            t = tableau_offsets(w, h, footer=f)
            pref = 0.3 * t["card_h"]
            offs = [min(pref, (t["tableau_h"] - t["card_h"]) / (n - 1)) for n in range(7, 20)]
            print(f"| {w}×{h} {fname} | {t['tableau_h']:.0f} | " + " | ".join(f"{o:.1f}" for o in offs) + " |")


# ---------------------------------------------------------------- 配り方と手（認識合わせの試算（リポジトリには置いていない）を写して直したもの）
# card = suit*13 + (rank-1)。suit: 0♠ 1♥ 2♦ 3♣。赤は 1,2。列は全部表向き、山札は1枚ずつ何周でもめくれる。


def rank(c: int) -> int:
    return c % 13 + 1


def suit(c: int) -> int:
    return c // 13


def red(c: int) -> bool:
    return suit(c) in (1, 2)


def deal(seed: int) -> tuple[tuple[tuple[int, ...], ...], tuple[int, ...]]:
    rnd = random.Random(seed)
    d = list(range(52))
    rnd.shuffle(d)
    tab = []
    i = 0
    for n in range(1, 8):
        tab.append(tuple(d[i : i + n]))
        i += n
    return tuple(tab), tuple(d[i:])


def run_start(col: tuple[int, ...]) -> int:
    """手前（末尾）から、赤黒交互・降順に並んだ所が始まる位置。"""
    i = len(col) - 1
    while i > 0:
        a, b = col[i - 1], col[i]
        if rank(a) == rank(b) + 1 and red(a) != red(b):
            i -= 1
        else:
            break
    return i


def can_stack(c: int, onto: int) -> bool:
    return rank(onto) == rank(c) + 1 and red(onto) != red(c)


def safe_auto(c: int, fnd: tuple[int, ...] | list[int]) -> bool:
    r = rank(c)
    if fnd[suit(c)] != r - 1:
        return False
    if r <= 2:
        return True
    opp = (1, 2) if not red(c) else (0, 3)
    return all(fnd[s] >= r - 1 for s in opp)


State = tuple  # (tab, stock, waste, fnd)


def legal_moves(tab, stock, waste, fnd):
    """(優先度, 種類, 置き元, 置き先, 次の局面) の一覧。置き元・置き先は山の名前（('col', i)、('waste',)、('fnd', s)、('stock',)）。"""
    out = []
    for i, col in enumerate(tab):
        if col and fnd[suit(col[-1])] == rank(col[-1]) - 1:
            f = list(fnd)
            f[suit(col[-1])] += 1
            t = list(tab)
            t[i] = col[:-1]
            out.append((0, "to_fnd", ("col", i), ("fnd",), (tuple(t), stock, waste, tuple(f)), 1))
    if waste and fnd[suit(waste[-1])] == rank(waste[-1]) - 1:
        f = list(fnd)
        f[suit(waste[-1])] += 1
        out.append((0, "to_fnd", ("waste",), ("fnd",), (tab, stock, waste[:-1], tuple(f)), 1))
    for i, col in enumerate(tab):
        if not col:
            continue
        s = run_start(col)
        for k in range(s, len(col)):
            c = col[k]
            for j, dst in enumerate(tab):
                if i == j:
                    continue
                if dst:
                    if not can_stack(c, dst[-1]):
                        continue
                elif rank(c) != 13 or k == 0:
                    continue
                t = list(tab)
                t[i] = col[:k]
                t[j] = dst + col[k:]
                pri = 1 if k == s else 3
                out.append((pri, "col_col", ("col", i), ("col", j), (tuple(t), stock, waste, fnd), len(col) - k))
    if waste:
        c = waste[-1]
        for j, dst in enumerate(tab):
            if (dst and can_stack(c, dst[-1])) or (not dst and rank(c) == 13):
                t = list(tab)
                t[j] = dst + (c,)
                out.append((2, "waste_col", ("waste",), ("col", j), (tuple(t), stock, waste[:-1], fnd), 1))
    for s_ in range(4):
        if fnd[s_] >= 1:
            c = s_ * 13 + fnd[s_] - 1
            for j, dst in enumerate(tab):
                if (dst and can_stack(c, dst[-1])) or (not dst and rank(c) == 13):
                    f = list(fnd)
                    f[s_] -= 1
                    t = list(tab)
                    t[j] = dst + (c,)
                    out.append((5, "fnd_col", ("fnd", s_), ("col", j), (tuple(t), stock, waste, tuple(f)), 1))
    if stock:
        out.append((4, "flip", ("stock",), ("stock",), (tab, stock[1:], waste + (stock[0],), fnd), 0))
    elif waste:
        out.append((6, "recycle", ("stock",), ("stock",), (tab, tuple(waste), (), fnd), 0))
    return out


def state_key(st) -> tuple:
    tab, stock, waste, fnd = st
    return (tuple(sorted(tab)), stock, waste, fnd)


def auto_foundation(st):
    tab, stock, waste, fnd = st
    tab = list(tab)
    waste = list(waste)
    fnd = list(fnd)
    moved = True
    while moved:
        moved = False
        for i, col in enumerate(tab):
            if col and safe_auto(col[-1], fnd):
                fnd[suit(col[-1])] += 1
                tab[i] = col[:-1]
                moved = True
        if waste and safe_auto(waste[-1], fnd):
            fnd[suit(waste[-1])] += 1
            waste.pop()
            moved = True
    return (tuple(tab), stock, tuple(waste), tuple(fnd))


def solve_path(tab, stock, limit: int):
    """DFS（安全な札は組札へ自動で送る）。解けたら通った局面と打った手の列を返す。('win'|'lose'|'unknown', path, moves)。"""
    seen: set = set()
    nodes = [0]
    sys.setrecursionlimit(100000)

    def dfs(st):
        st = auto_foundation(st)
        if sum(st[3]) == 52:
            return [st], []
        k = state_key(st)
        if k in seen:
            return None
        seen.add(k)
        nodes[0] += 1
        if nodes[0] > limit:
            raise TimeoutError
        for m in sorted(legal_moves(*st), key=lambda m: m[0]):
            r = dfs(m[4])
            if r is not None:
                r[0].append(st)
                run_len = 0
                if m[1] == "col_col":
                    src_col = st[0][m[2][1]]
                    run_len = len(src_col) - run_start(src_col)
                r[1].append((m[1], m[5], run_len))
                return r
        return None

    try:
        found = dfs((tab, stock, (), (0, 0, 0, 0)))
    except TimeoutError:
        return "unknown", None, None
    if found is None:
        return "lose", None, None
    path, moves = found
    path.reverse()
    moves.reverse()
    return "win", path, moves


def greedy_play(tab, stock, order: str, max_steps: int = 5000):
    """素朴な遊び方。優先順の中から、まだ来ていない局面になる最初の手を打つ。

    order='fnd_first': 組札へ → 列の並びをまとめて動かす → 捨て札から列 → めくる（認識合わせの「置ける所に置き、無ければめくる」）
    order='stack_first': 列の並びをまとめて動かす → 捨て札から列 → めくる → 組札へ（組札へ送るのを後回しにして列に積む遊び方）
    """
    st = (tab, stock, (), (0, 0, 0, 0))
    seen = {state_key(st)}
    path = [st]
    if order == "fnd_first":
        rank_of = {"to_fnd": 0, "col_col": 1, "waste_col": 2, "flip": 3, "recycle": 3}
    else:
        rank_of = {"col_col": 0, "waste_col": 1, "flip": 2, "recycle": 2, "to_fnd": 3}
    for _ in range(max_steps):
        if sum(st[3]) == 52:
            return True, path
        cands = []
        for m in legal_moves(*st):
            kind = m[1]
            if kind == "fnd_col":
                continue
            if kind == "col_col":
                src_col = st[0][m[2][1]]
                # 並びの途中から動かす手と、列ごと空いた列へ動かすだけの手は使わない。
                if m[5] != len(src_col) - run_start(src_col):
                    continue
                if not st[0][m[3][1]] and run_start(src_col) == 0:
                    continue
            cands.append((rank_of[kind], m))
        cands.sort(key=lambda x: x[0])
        moved = False
        for _, m in cands:
            k = state_key(m[4])
            if k in seen:
                continue
            seen.add(k)
            st = m[4]
            path.append(st)
            moved = True
            break
        if not moved:
            return False, path
    return False, path


def longest(path) -> int:
    return max(max(len(c) for c in st[0]) for st in path)


def deal_bound(tab) -> int:
    """その配り方で、ある列が取りうる長さの上限。列 i の下から k 番目の札 c が手前に出たとき、
    下に k−1 枚が残り、c から A までの rank(c) 枚が並びうる。空いた列には K からの13枚まで。"""
    best = 13
    for col in tab:
        for k, c in enumerate(col, start=1):
            best = max(best, k - 1 + rank(c))
    return best


def cmd_columns(args: argparse.Namespace) -> None:
    print(f"## 配り方ごとの列の長さの上限（seed 0〜{args.deals - 1}、{args.deals}回配る）")
    bounds = Counter(deal_bound(deal(s)[0]) for s in range(args.deals))
    total = sum(bounds.values())
    for n in range(19, 12, -1):
        at_least = sum(v for k, v in bounds.items() if k >= n)
        print(f"- 上限 {n} 枚: {bounds.get(n, 0)}回（{bounds.get(n, 0) / total:.1%}）、{n} 枚以上になりうる配り方 {at_least / total:.1%}")
    print()

    print(f"## 解いた手順と素朴な遊び方で、いちばん長くなった列（seed 0〜{args.seeds - 1}、DFS の打ち切り {args.limit} 局面）")
    rows = []
    for seed in range(args.seeds):
        tab, stock = deal(seed)
        res, path, moves = solve_path(tab, stock, args.limit)
        g1_ok, g1 = greedy_play(tab, stock, "fnd_first")
        g2_ok, g2 = greedy_play(tab, stock, "stack_first")
        col_moves = [m for m in (moves or []) if m[0] == "col_col"]
        rows.append(
            {
                "seed": seed,
                "bound": deal_bound(tab),
                "dfs": res,
                "dfs_long": longest(path) if path else None,
                "dfs_col_moves": len(col_moves),
                "dfs_partial": sum(1 for m in col_moves if m[1] < m[2]),
                "dfs_multi": sum(1 for m in col_moves if m[1] >= 2),
                "dfs_moves": len(moves or []),
                "g1_ok": g1_ok,
                "g1_long": longest(g1),
                "g2_ok": g2_ok,
                "g2_long": longest(g2),
                "g2_steps": len(g2),
                "g2_over": [sum(1 for st in g2 if max(len(c) for c in st[0]) >= n) for n in (13, 15, 17)],
            }
        )
    res_count = Counter(r["dfs"] for r in rows)
    print(f"DFS: {dict(res_count)}")

    def dist(values: list[int]) -> str:
        if not values:
            return "なし"
        c = Counter(values)
        body = "、".join(f"{k}枚 {c[k]}" for k in sorted(c))
        ge = lambda n: sum(1 for v in values if v >= n) / len(values)
        return (
            f"中央値 {statistics.median(values)}、最大 {max(values)}（{body}）。"
            f"13枚以上 {ge(13):.0%}、15枚以上 {ge(15):.0%}、17枚以上 {ge(17):.0%}"
        )

    print(f"- 解けた配り方の解いた手順（{res_count['win']}回）: {dist([r['dfs_long'] for r in rows if r['dfs'] == 'win'])}")
    print(f"- 置ける所に置き、無ければめくる（全{len(rows)}回、解けた {sum(r['g1_ok'] for r in rows)}回）: {dist([r['g1_long'] for r in rows])}")
    print(f"- 組札へ送るのを後回しにして列に積む（全{len(rows)}回、解けた {sum(r['g2_ok'] for r in rows)}回）: {dist([r['g2_long'] for r in rows])}")
    print(f"- 解けた配り方だけの、配り方の上限: {dist([r['bound'] for r in rows if r['dfs'] == 'win'])}")
    wins = [r for r in rows if r["dfs"] == "win"]
    cm = sum(r["dfs_col_moves"] for r in wins)
    print(
        f"- 解いた手順の列から列への手 {cm} のうち、2枚以上をまとめて動かす手 {sum(r['dfs_multi'] for r in wins)}"
        f"（{sum(r['dfs_multi'] for r in wins) / max(cm, 1):.0%}）、並びの途中から動かす手 {sum(r['dfs_partial'] for r in wins)}"
        f"（{sum(r['dfs_partial'] for r in wins) / max(cm, 1):.0%}）。途中から動かす手を使った手順 "
        f"{sum(1 for r in wins if r['dfs_partial'] > 0)}/{len(wins)}"
    )
    if wins:
        print(
            f"- 解いた手順の手数（めくるを含み、組札へ自動で送った分を除く）: 中央値 {statistics.median(r['dfs_moves'] for r in wins)}、"
            f"列から列への手 中央値 {statistics.median(r['dfs_col_moves'] for r in wins)}。DFS の手順は遠回りを含むので、手の割合は人の遊び方の値ではない"
        )
    steps = sum(r["g2_steps"] for r in rows)
    overs = [sum(r["g2_over"][i] for r in rows) for i in range(3)]
    print(
        f"- 列に積む遊び方で、局面のうちどれかの列が 13 / 15 / 17 枚以上だった割合: "
        f"{overs[0] / steps:.1%} / {overs[1] / steps:.1%} / {overs[2] / steps:.1%}（全 {steps} 局面）"
    )
    print()

    print(f"## 列を長くする方へ探したときに届いた長さ（上限が 18 枚以上の配り方から {args.reach_deals} 回、打ち切り {args.reach_limit} 局面）")
    found = []
    seed = 0
    while len(found) < args.reach_deals:
        tab, stock = deal(seed)
        b = deal_bound(tab)
        if b >= 18:
            found.append((seed, b, reach_longest(tab, stock, args.reach_limit)))
        seed += 1
    for b in (18, 19):
        sub_rows = [r for r in found if r[1] == b]
        reached = [r[2] for r in sub_rows]
        if reached:
            c = Counter(reached)
            print(
                f"- 上限 {b} 枚の配り方 {len(sub_rows)}回: 届いた長さ "
                + "、".join(f"{k}枚 {c[k]}" for k in sorted(c))
                + f"。上限まで届いた {sum(1 for r in sub_rows if r[2] >= r[1])}回"
            )


def reach_longest(tab, stock, limit: int) -> int:
    """いちばん長い列が長くなる局面を先に広げる探索で、届いたいちばん長い列の枚数。"""
    import heapq

    start = (tab, stock, (), (0, 0, 0, 0))
    best = max(len(c) for c in tab)
    seen = {state_key(start)}
    heap = [(-best, 0, start)]
    counter = 1
    nodes = 0
    while heap and nodes < limit:
        _, _, st = heapq.heappop(heap)
        nodes += 1
        for m in legal_moves(*st):
            nxt = m[4]
            k = state_key(nxt)
            if k in seen:
                continue
            seen.add(k)
            ln = max(len(c) for c in nxt[0])
            best = max(best, ln)
            heapq.heappush(heap, (-ln, counter, nxt))
            counter += 1
        if best >= LONGEST_COLUMN:
            break
    return best


# ---------------------------------------------------------------- 置き元の山と置き先の山だけで手が決まるか


def cmd_moves(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    states = 0
    pairs = 0
    ambiguous = 0
    col_moves = 0
    partial = 0
    sources_with_choices = 0
    sources_movable = 0
    for d in range(args.walks):
        tab, stock = deal(rng.randrange(2**31))
        st = (tab, stock, (), (0, 0, 0, 0))
        for _ in range(args.steps):
            ms = legal_moves(*st)
            states += 1
            by_pair = Counter()
            by_src: dict[tuple, set] = {}
            for m in ms:
                if m[1] in ("flip", "recycle"):
                    continue
                by_pair[(m[2], m[3])] += 1
                by_src.setdefault(m[2], set()).add(m[3])
                if m[1] == "col_col":
                    col_moves += 1
                    src_col = st[0][m[2][1]]
                    if m[5] != len(src_col) - run_start(src_col):
                        partial += 1
            pairs += len(by_pair)
            ambiguous += sum(1 for v in by_pair.values() if v > 1)
            sources_movable += len(by_src)
            sources_with_choices += sum(1 for v in by_src.values() if len(v) >= 2)
            if not ms:
                break
            st = rng.choice(ms)[4]
    print(f"seed={args.seed} 無作為に手を選んで進める {args.walks} 回 × 最大 {args.steps} 手（打てる手を一様に選ぶ）")
    print(f"- 調べた局面 {states}、手のある（置き元の山, 置き先の山）の組 {pairs}")
    print(f"- 同じ組で打てる手が2つ以上あった組: {ambiguous}")
    print(f"- 列から列への手 {col_moves} のうち、並びの途中から動かす手 {partial}（{partial / max(col_moves, 1):.1%}）")
    print(
        f"- 手のある置き元 {sources_movable} のうち、置き先が2つ以上ある置き元 {sources_with_choices}"
        f"（{sources_with_choices / max(sources_movable, 1):.1%}）"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("layout")
    for name in ("columns", "moves", "all"):
        p = sub.add_parser(name)
        p.add_argument("--seed", type=int, default=20261122)
        p.add_argument("--deals", type=int, default=100000)
        p.add_argument("--seeds", type=int, default=200)
        p.add_argument("--limit", type=int, default=30000)
        p.add_argument("--walks", type=int, default=300)
        p.add_argument("--steps", type=int, default=300)
        p.add_argument("--reach-deals", type=int, default=40)
        p.add_argument("--reach-limit", type=int, default=20000)
    args = parser.parse_args()
    if args.command in ("layout", "all"):
        cmd_layout()
        print()
    if args.command in ("columns", "all"):
        cmd_columns(args)
        print()
    if args.command in ("moves", "all"):
        cmd_moves(args)


if __name__ == "__main__":
    main()
