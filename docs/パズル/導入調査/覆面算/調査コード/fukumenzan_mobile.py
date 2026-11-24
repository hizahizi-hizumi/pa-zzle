"""覆面算（fukumenzan）スマホ操作の調査。

ブラウザは使わず、既存のプレイ画面のレイアウト（Tailwind のクラスと定数）から、
入力の形ごとに「式と操作が一画面に収まるか」「押す所の大きさ」「操作数」を計算する。標準ライブラリだけで動く。

    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_mobile.py layout   # 既存ゲームのマス・入力の形ごとの収まり
    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_mobile.py limits   # 式の大きさ（足す数・桁数）の上限
    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_mobile.py taps     # 押す所の大きさと手ぶれでの命中率
    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_mobile.py ops      # 問題を作って推理を追い、入力の形ごとの操作数
    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_mobile.py all

前提（コードから読んだ値。rem は 16px）
- プレイ画面の外枠 GamePlayFrame は fixed inset-0 overflow-hidden。ブランドの帯 1.75rem=28px、PlayHeader 4.5rem=72px、
  下端の面 BrowserBottomSurface h-3=12px。safe-area はブラウザ表示の縦画面では 0 とみなす。計 112px。
- 待っただけの footer は一筆パズル・タクズ・ブリッジと同じ h-28=112px。
- ナンプレの入力欄 NanpureInputPanel: pt-2 8 + 操作の段 min-h-16 64 + gap-3 12 + 数字の段 h-14 56 + pb-3 12 = 152px、
  左右 px-3、数字の段は grid-cols-9 gap-x-1。
- ナンプレの盤面: w-[min(96vw,calc(100svh-12rem),38rem)]、枠 border-2、9列。
- 一筆パズル: main px-4 py-2、盤面 min(100cqw,100cqh,40rem)、footer h-28。
- タクズ: main px-3 py-2、盤面の外側 p-3、枠 border-2、footer h-28。
- マインスイーパー: main px-2 py-3、w-full max-w-[27rem]、border-l/t 1px、footer なし。
- リフレクション: main px-1 py-2、外周ヒントの帯で両側 2 マス分、footer はストック 60px。

覆面算の入力の形（この調査で置いた仮の寸法。実装の値ではない）
- 式: 演算子の列 20px＋間 4px、文字のタイル t×t を間 4px で並べ、行の間 4px、線 6px。t は 64px で打ち切る。
- A 表: 式の下に間 12px、表（行の見出し 28px、マス c×c を 1px の罫線で 10 列、列の見出し 22px）、footer は待った 112px。
- B 鍵盤: 式の文字を選び、下の数字の鍵盤（0〜9 を1段、ナンプレと同じ入力欄 152px）で入れる。× のメモは鍵盤に重ねる。
- C 札: 0〜9 の札を1枚ずつ持ち、文字へ運んで入れる。札の段は B と同じ 152px（1段）か 2×5 の 2段（212px）。
- D 式に表を重ねる: 式の文字のタイルの中に 0〜9 の小さな候補を 2×5 で描き、そこを直接押す。footer は待った 112px。
"""

from __future__ import annotations

import argparse
import math
import random
import statistics
import time

BRAND = 28
HEADER = 72
BOTTOM = 12
FRAME = BRAND + HEADER + BOTTOM
REM = 16

# 端末の表示領域（CSS px）。幅は index.css の min-w-[320px] と既存の調査（橋をかけろスマホ操作調査）から。
# 高さは推測（ツールバーを出したブラウザの目安）。計算の条件として置き、実機では確かめていない。
VIEWPORTS: list[tuple[str, int, int]] = [
    ("390 Safari（推測の高さ）", 390, 664),
    ("390 全高", 390, 844),
    ("375 SE Safari（推測の高さ）", 375, 548),
    ("360 Android（推測の高さ）", 360, 640),
    ("320 全高", 320, 693),
    ("320 Safari（推測の高さ）", 320, 460),
]

# 式の形: (名前, 足す数 k, 足す数の桁 a, 答えの桁 L, 文字数 n)
SHAPES: list[tuple[str, int, int, int, int]] = [
    ("L1 見本 3+3=4", 2, 3, 4, 6),
    ("4+4=5", 2, 4, 5, 8),
    ("5+5=6", 2, 5, 6, 10),
    ("4+4+4=5", 3, 4, 5, 9),
    ("L5 見本 5+5+5=6", 3, 5, 6, 10),
    ("5×4つ=6", 4, 5, 6, 10),
    ("6+6=7", 2, 6, 7, 10),
    ("6×3つ=7", 3, 6, 7, 10),
    ("7+7=8", 2, 7, 8, 10),
]

T_MAX = 64.0
EQ_GAP = 4
EQ_OP = 24  # 演算子の列 20 + 間 4
EQ_RULE = 6
STACK_GAP = 12
MAIN_PX = 16
MAIN_PY = 16
FOOTER_UNDO = 112
PANEL_ONE_ROW = 8 + 64 + 12 + 56 + 12
PANEL_TWO_ROWS = 8 + 64 + 12 + (56 * 2 + 4) + 12


# ---------------------------------------------------------------- 既存ゲーム


def hitofude_cell(w: int, h: int, n: int) -> float:
    return min(w - 32, h - FRAME - 16 - FOOTER_UNDO, 40 * REM) / n


def takuzu_cell(w: int, h: int) -> float:
    side = min(w - 24, h - FRAME - 16 - FOOTER_UNDO, 42 * REM)
    return (side - 2 * 12 - 2 * 2) / 8


def nanpure_cell(w: int, h: int) -> float:
    side = min(0.96 * w, h - 12 * REM, 38 * REM)
    return (side - 2 * 2) / 9


def nanpure_key(w: int) -> float:
    return (min(w - 24, 36 * REM) - 8 * 4) / 9


def minesweeper_cell(w: int, cols: int) -> float:
    return (min(w - 16, 27 * REM) - 1) / cols


def reflection_cell(w: int, h: int, n: int) -> float:
    side = min(w - 8, h - FRAME - 16 - 60, 44 * REM)
    return side / (n + 2)


# ---------------------------------------------------------------- 覆面算の入力の形


def eq_tile_by_width(w: int, length: int) -> float:
    return (w - 2 * MAIN_PX - EQ_OP - (length - 1) * EQ_GAP) / length


def eq_height(t: float, k: int) -> float:
    return (k + 1) * t + k * EQ_GAP + EQ_RULE


def eq_tile(w: int, avail_h: float, k: int, length: int) -> float:
    by_h = (avail_h - k * EQ_GAP - EQ_RULE) / (k + 1)
    return min(eq_tile_by_width(w, length), by_h, T_MAX)


def table_cell_by_width(w: int) -> float:
    return (w - 2 * MAIN_PX - 28 - 11) / 10


def table_height(c: float, n: int) -> float:
    return 22 + n * c + (n + 1)


def layout_a(
    w: int, h: int, k: int, length: int, n: int, eq_t: float = 32.0, footer: int = FOOTER_UNDO
) -> dict[str, float]:
    """A 表。表のマスは幅で決め、式の文字のタイルを残りの高さに入れる。
    入らないときは、式を eq_t に保って表のマスを高さで縮めた値も返す。footer は待ったの欄の高さ。"""
    c = table_cell_by_width(w)
    rest = h - FRAME - MAIN_PY - footer - STACK_GAP - table_height(c, n)
    t = eq_tile(w, rest, k, length)
    rest_table = h - FRAME - MAIN_PY - footer - STACK_GAP - eq_height(min(eq_t, eq_tile_by_width(w, length)), k)
    c_h = (rest_table - 22 - (n + 1)) / n
    return {"t": t, "c": c, "c_if_eq32": min(c, c_h)}


def layout_panel(w: int, h: int, k: int, length: int, footer: int) -> dict[str, float]:
    """B 鍵盤・C 札。式は footer の上の残りに入れる。"""
    rest = h - FRAME - MAIN_PY - footer
    t = eq_tile(w, rest, k, length)
    return {"t": t, "rest": rest}


def key_one_row(w: int) -> tuple[float, float]:
    return (min(w - 24, 36 * REM) - 9 * 4) / 10, 56.0


def key_two_rows(w: int) -> tuple[float, float]:
    return min(64.0, (min(w - 24, 36 * REM) - 4 * 4) / 5), 56.0


def layout_d(w: int, h: int, k: int, length: int) -> dict[str, float]:
    rest = h - FRAME - MAIN_PY - FOOTER_UNDO
    t = eq_tile(w, rest, k, length)
    # 文字の見出し（上 30%）を除いた所に 2×5 の候補を描く。
    mini_w = (t - 4) / 5
    mini_h = (t * 0.7 - 2) / 2
    return {"t": t, "mini_w": mini_w, "mini_h": mini_h}


def cmd_layout() -> None:
    print("## 既存ゲームの最大盤面のマス幅（px。外枠 112px＝帯 28＋見出し 72＋下端 12 で計算）")
    header = ["端末", "一筆8×8", "タクズ8×8", "ナンプレ9×9", "ナンプレの数字ボタン（幅×56）", "マインスイーパー12列", "リフレクション10×10"]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for name, w, h in VIEWPORTS:
        print(
            f"| {name} {w}×{h} | {hitofude_cell(w, h, 8):.1f} | {takuzu_cell(w, h):.1f} | {nanpure_cell(w, h):.1f} | "
            f"{nanpure_key(w):.1f} | {minesweeper_cell(w, 12):.1f} | {reflection_cell(w, h, 10):.1f} |"
        )
    print()
    print("## 入力の形ごとの大きさ（px）。t=式の文字のタイル、c=表のマス")
    print("A の「t」は表のマスを幅で決めたときの式のタイル（24 未満は読めないとみなし ! を付ける）。")
    print("A の「c（式32）」は式のタイルを 32px に保ったときの表のマス。「待った 64px」は待っただけの欄を 112px から 64px に縮めた場合。")
    print("B/C1 は 1段の鍵盤・札（152px）、C2 は 2×5 の札（212px）、D は式のタイルの中の候補（幅×高さ）。")
    for sname, k, a, length, n in SHAPES:
        print()
        print(f"### {sname}（足す数 {k}、答え {length} 桁、文字 {n}）")
        print("| 端末 | A t | A c | A c（式32） | A t（待った 64px） | B/C1 t | C2 t | D t | D の候補 |")
        print("|---|---|---|---|---|---|---|---|---|")
        for name, w, h in VIEWPORTS:
            la = layout_a(w, h, k, length, n)
            lb = layout_panel(w, h, k, length, PANEL_ONE_ROW)
            lc = layout_panel(w, h, k, length, PANEL_TWO_ROWS)
            ld = layout_d(w, h, k, length)
            la64 = layout_a(w, h, k, length, n, footer=64)
            flag = "!" if la["t"] < 24 else ""
            flag64 = "!" if la64["t"] < 24 else ""
            print(
                f"| {w}×{h} | {la['t']:.1f}{flag} | {la['c']:.1f} | {la['c_if_eq32']:.1f} | {la64['t']:.1f}{flag64} | {lb['t']:.1f} | "
                f"{lc['t']:.1f} | {ld['t']:.1f} | {ld['mini_w']:.1f}×{ld['mini_h']:.1f} |"
            )
    print()
    print("## 鍵盤・札の大きさ（幅×高さ、px）")
    print("| 端末の幅 | 1段 10個 | 2×5 |")
    print("|---|---|---|")
    for w in (390, 375, 360, 320):
        a1 = key_one_row(w)
        a2 = key_two_rows(w)
        print(f"| {w} | {a1[0]:.1f}×{a1[1]:.0f} | {a2[0]:.1f}×{a2[1]:.0f} |")


def cmd_limits() -> None:
    print("## 式の大きさの上限: B/C1（鍵盤 1段 152px）で式のタイル t（px）")
    print("行は 足す数 k、列は 答えの桁 L。* は高さで決まった値。")
    for name, w, h in VIEWPORTS:
        print()
        print(f"### {name} {w}×{h}（式に使える高さ {h - FRAME - MAIN_PY - PANEL_ONE_ROW}px）")
        lengths = list(range(4, 10))
        print("| k \\ L | " + " | ".join(str(x) for x in lengths) + " |")
        print("|" + "---|" * (len(lengths) + 1))
        for k in range(2, 7):
            row = []
            for length in lengths:
                rest = h - FRAME - MAIN_PY - PANEL_ONE_ROW
                by_w = eq_tile_by_width(w, length)
                t = eq_tile(w, rest, k, length)
                row.append(f"{t:.0f}{'*' if t < min(by_w, T_MAX) - 1e-9 else ''}")
            print(f"| {k} | " + " | ".join(row) + " |")
    print()
    print("## A 表で、表のマスを幅で決めたとき式に残る高さ（px）。式 4 行（3つ足す）を 24px で描くには 114px 要る")
    print("| 端末 | 文字 6 | 文字 8 | 文字 10 |")
    print("|---|---|---|---|")
    for name, w, h in VIEWPORTS:
        c = table_cell_by_width(w)
        cells = []
        for n in (6, 8, 10):
            rest = h - FRAME - MAIN_PY - FOOTER_UNDO - STACK_GAP - table_height(c, n)
            cells.append(f"{rest:.0f}")
        print(f"| {name} {w}×{h}（c={c:.1f}） | " + " | ".join(cells) + " |")
    print()
    print(f"参考: 3つ足す式（4行）を t=24 で描く高さ {eq_height(24, 3):.0f}px、t=32 で {eq_height(32, 3):.0f}px。")


# ---------------------------------------------------------------- 押す所の大きさと手ぶれ


def hit_rate(wd: float, ht: float, sigma: float) -> float:
    """中心を狙い、x・y に独立な正規分布のぶれ σ を足したとき、幅 wd×高さ ht の中に落ちる割合。"""
    fx = math.erf(wd / 2 / (sigma * math.sqrt(2)))
    fy = math.erf(ht / 2 / (sigma * math.sqrt(2)))
    return fx * fy


def cmd_taps() -> None:
    print("## 押す所の命中率（中心を狙い、x・y に独立な正規分布のぶれ。一筆パズル PoC・ブリッジ調査と同じ σ4・σ8px）")
    print("| 押す所 | 端末 | 大きさ（px） | σ4 | σ8 |")
    print("|---|---|---|---|---|")
    rows: list[tuple[str, str, float, float]] = []
    for name, w, h in (("375×548", 375, 548), ("320×460", 320, 460), ("390×664", 390, 664)):
        c = table_cell_by_width(w)
        la = layout_a(w, h, 3, 6, 10)
        rows.append(("A 表のマス（幅で決めた値）", name, c, c))
        rows.append(("A 表のマス（式32・10文字）", name, la["c_if_eq32"], la["c_if_eq32"]))
        k1 = key_one_row(w)
        rows.append(("B 鍵盤・C 札 1段", name, k1[0], k1[1]))
        k2 = key_two_rows(w)
        rows.append(("C 札 2×5", name, k2[0], k2[1]))
        lb = layout_panel(w, h, 3, 6, PANEL_ONE_ROW)
        rows.append(("B/C 式の文字（L5 見本 5+5+5=6）", name, lb["t"], lb["t"]))
        ld = layout_d(w, h, 3, 6)
        rows.append(("D 式のタイルの中の候補（L5 見本）", name, ld["mini_w"], ld["mini_h"]))
        rows.append(("参考 ナンプレのマス", name, nanpure_cell(w, h), nanpure_cell(w, h)))
        rows.append(("参考 リフレクション10×10のマス", name, reflection_cell(w, h, 10), reflection_cell(w, h, 10)))
    for label, name, wd, ht in rows:
        print(f"| {label} | {name} | {wd:.1f}×{ht:.1f} | {hit_rate(wd, ht, 4):.3f} | {hit_rate(wd, ht, 8):.3f} |")


# ---------------------------------------------------------------- 問題を作る（一意解の判定つき）

LETTERS = "ABCDEFGHJKLMNPRSTUWXYZ"  # I・O・Q・V は 1・0・0・U と紛れるので外した（仮）


def parse(adds: list[str], res: str):
    length = len(res)
    cols = []
    for i in range(length):
        col_adds = [w[len(w) - 1 - i] for w in adds if len(w) > i]
        cols.append((col_adds, res[length - 1 - i]))
    leads = {w[0] for w in adds + [res] if len(w) > 1}
    letters = sorted({c for w in adds + [res] for c in w})
    return cols, leads, letters


def count_solutions(adds: list[str], res: str, limit: int = 2) -> int:
    cols, leads, _ = parse(adds, res)
    val: dict[str, int] = {}
    used = [False] * 10
    count = 0

    def assign_col(i: int, carry: int, j: int, s: int) -> None:
        nonlocal count
        if count >= limit:
            return
        col_adds, r = cols[i]
        if j < len(col_adds):
            c = col_adds[j]
            if c in val:
                assign_col(i, carry, j + 1, s + val[c])
                return
            for d in range(1 if c in leads else 0, 10):
                if used[d]:
                    continue
                val[c] = d
                used[d] = True
                assign_col(i, carry, j + 1, s + d)
                used[d] = False
                del val[c]
            return
        total = s + carry
        digit, out = total % 10, total // 10
        if r in val:
            if val[r] != digit:
                return
            nxt(i, out)
            return
        if used[digit] or (digit == 0 and r in leads):
            return
        val[r] = digit
        used[digit] = True
        nxt(i, out)
        used[digit] = False
        del val[r]

    def nxt(i: int, out: int) -> None:
        nonlocal count
        if i + 1 == len(cols):
            if out == 0:
                count += 1
            return
        assign_col(i + 1, out, 0, 0)

    assign_col(0, 0, 0, 0)
    return count


def generate(rng: random.Random, k: int, a: int, length: int, n: int, want: int, budget_s: float):
    out = []
    tries = 0
    start = time.time()
    while len(out) < want and time.time() - start < budget_s:
        tries += 1
        nums = [rng.randrange(10 ** (a - 1), 10**a) for _ in range(k)]
        total = sum(nums)
        if len(str(total)) != length:
            continue
        digits = {ch for x in nums + [total] for ch in str(x)}
        if len(digits) != n:
            continue
        letters = rng.sample(LETTERS, n)
        mapping = dict(zip(sorted(digits), letters))
        adds = ["".join(mapping[ch] for ch in str(x)) for x in nums]
        res = "".join(mapping[ch] for ch in str(total))
        if count_solutions(adds, res) != 1:
            continue
        out.append((adds, res, {mapping[ch]: int(ch) for ch in digits}))
    return out, tries


# ---------------------------------------------------------------- 推理を追う（人の解き方の近似）


class Contradiction(Exception):
    pass


class Tracer:
    """候補（文字ごとの 0〜9）と桁の繰り上がりを持ち、次の推理で候補を消す。
    - 先頭の文字は 0 でない。
    - 桁ごとの足し算: その桁の文字と繰り上がりの候補の組み合わせを全部試し、どの組にも出ない候補を消す。
    - 違う文字は違う数字: 決まった文字の数字を他の文字から消す。10 文字の問題では、ある数字が入りうる文字が1つなら決まる。
    - それでも止まったら、1つの文字に1つの数字を仮に当てて上の推理を進め、行き詰まる数字を消す（場合分け 1段）。
    消すたびに記録する。1回の推理で候補が1つに減った文字は ◯ だけを記録し（決まってから入れる）、
    そうでない文字には消した数字ごとに × を記録する。決まった別の文字が使っている数字は記録しない（画面で見える）。"""

    def __init__(self, adds: list[str], res: str, record: bool = True):
        self.cols, self.leads, self.letters = parse(adds, res)
        self.k = len(adds)
        self.dom = {c: set(range(10)) for c in self.letters}
        length = len(self.cols)
        self.carry = [{0}] + [set(range(self.k)) for _ in range(length - 1)] + [{0}]
        self.events: list[tuple[str, str, int]] = []
        self.record = record
        self.hidden = 0  # 「この数字が入りうる文字は1つだけ」で決めた回数（表なら列を見て分かる推理）

    def copy(self) -> "Tracer":
        t = Tracer.__new__(Tracer)
        t.cols, t.leads, t.letters, t.k = self.cols, self.leads, self.letters, self.k
        t.dom = {c: set(v) for c, v in self.dom.items()}
        t.carry = [set(v) for v in self.carry]
        t.events = []
        t.record = False
        t.hidden = 0
        return t

    def placed(self) -> dict[str, int]:
        return {c: next(iter(v)) for c, v in self.dom.items() if len(v) == 1}

    def restrict(self, c: str, new: set[int]) -> bool:
        old = self.dom[c]
        if new >= old:
            return False
        if not new:
            raise Contradiction
        removed = old - new
        if self.record and len(old) > 1:
            if len(new) == 1:
                self.events.append(("o", c, next(iter(new))))
            else:
                used = {d for x, d in self.placed().items() if x != c}
                for d in sorted(removed):
                    if d not in used:
                        self.events.append(("x", c, d))
        self.dom[c] = set(new)
        return True

    def column(self, i: int) -> bool:
        col_adds, r = self.cols[i]
        distinct = sorted(set(col_adds))
        support = {c: set() for c in sorted(set(col_adds) | {r})}
        cin_ok: set[int] = set()
        cout_ok: set[int] = set()

        def rec(j: int, val: dict[str, int]) -> None:
            if j < len(distinct):
                c = distinct[j]
                for d in self.dom[c]:
                    if d in val.values():
                        continue
                    val[c] = d
                    rec(j + 1, val)
                    del val[c]
                return
            s = sum(val[c] for c in col_adds)
            for cin in self.carry[i]:
                total = s + cin
                digit, out = total % 10, total // 10
                if out not in self.carry[i + 1]:
                    continue
                if r in val:
                    if val[r] != digit:
                        continue
                else:
                    if digit not in self.dom[r] or digit in val.values():
                        continue
                for c, d in val.items():
                    support[c].add(d)
                support[r].add(digit)
                cin_ok.add(cin)
                cout_ok.add(out)

        rec(0, {})
        changed = False
        for c, sup in support.items():
            changed |= self.restrict(c, self.dom[c] & sup)
        for idx, ok in ((i, cin_ok), (i + 1, cout_ok)):
            new = self.carry[idx] & ok
            if not new:
                raise Contradiction
            if new != self.carry[idx]:
                self.carry[idx] = new
                changed = True
        return changed

    def alldiff(self) -> bool:
        changed = False
        for c, d in self.placed().items():
            for x in self.letters:
                if x != c and d in self.dom[x]:
                    changed |= self.restrict(x, self.dom[x] - {d})
        if len(self.letters) == 10:
            for d in range(10):
                holders = [x for x in self.letters if d in self.dom[x]]
                if not holders:
                    raise Contradiction
                if len(holders) == 1 and len(self.dom[holders[0]]) > 1:
                    if self.record:
                        self.hidden += 1
                    changed |= self.restrict(holders[0], {d})
        return changed

    def propagate(self) -> None:
        for c in sorted(self.leads):
            self.restrict(c, self.dom[c] - {0})
        while True:
            changed = False
            for i in range(len(self.cols)):
                changed |= self.column(i)
            changed |= self.alldiff()
            if not changed:
                return

    def solved(self) -> bool:
        return all(len(v) == 1 for v in self.dom.values())

    def solve(self) -> tuple[bool, int]:
        """戻り値: (場合分け 1段までで解けたか, 場合分けで消した候補の数)"""
        self.propagate()
        trial_removed = 0
        while not self.solved():
            progress = False
            for c in sorted(self.letters, key=lambda x: (len(self.dom[x]), x)):
                if len(self.dom[c]) == 1:
                    continue
                bad = set()
                for d in sorted(self.dom[c]):
                    t = self.copy()
                    try:
                        t.restrict(c, {d})
                        t.propagate()
                    except Contradiction:
                        bad.add(d)
                if bad:
                    trial_removed += len(bad)
                    self.restrict(c, self.dom[c] - bad)
                    self.propagate()
                    progress = True
                    break
            if not progress:
                return False, trial_removed
        return True, trial_removed


# ---------------------------------------------------------------- 入力の形ごとの操作数


def ops_table(events, x_cost: int, o_cost: int) -> int:
    return sum(x_cost if e[0] == "x" else o_cost for e in events)


def ops_select_mode(events) -> int:
    """B 鍵盤（ナンプレ型）: 文字を選ぶ・× のメモの切り替え・数字の3つ。始めは何も選ばず、メモは切。"""
    sel, memo, n = None, False, 0
    for kind, c, _ in events:
        if sel != c:
            n += 1
            sel = c
        want_memo = kind == "x"
        if memo != want_memo:
            n += 1
            memo = want_memo
        n += 1
    return n


def ops_select_no_mode(events) -> int:
    """B' 鍵盤（切り替えなし）: 数字を軽く押すと ×、長く押すと入れる。選ぶ＋1回。"""
    sel, n = None, 0
    for _, c, _ in events:
        if sel != c:
            n += 1
            sel = c
        n += 1
    return n


def ops_tiles(events) -> int:
    """C 札: × は文字を選んで札を軽く押す。入れるは札を文字へ運ぶ1回（運んだ文字が選ばれた状態になる）。"""
    sel, n = None, 0
    for kind, c, _ in events:
        if kind == "x":
            if sel != c:
                n += 1
            n += 1
        else:
            n += 1
        sel = c
    return n


def group_by_letter(events):
    """同じ推理の結果を文字ごとにまとめて書く人の順（× を書いた文字の ◯ はその文字の × の後に置く）。"""
    order: list[str] = []
    for _, c, _ in events:
        if c not in order:
            order.append(c)
    # 推理の順の中で、文字が続けて現れる区切り（ひとまとまりの推理）ごとに文字順へ並べ替える。
    out = []
    block: list[tuple[str, str, int]] = []
    for e in events:
        if e[0] == "o":
            block.sort(key=lambda x: order.index(x[1]))
            out.extend(block)
            block = []
            out.append(e)
        else:
            block.append(e)
    block.sort(key=lambda x: order.index(x[1]))
    out.extend(block)
    return out


def cmd_ops(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    # 4+4+4=5（9 文字）は、ランダムな数から9文字ちょうどの一意解が打ち切り内にほとんど出ないので外した。
    shapes = [s for s in SHAPES if s[0] in ("L1 見本 3+3=4", "4+4=5", "5+5=6", "L5 見本 5+5+5=6")]
    print(f"seed={args.seed} 形ごとに最大 {args.count} 問・生成の打ち切り {args.budget}秒（ランダムな数から一意解のものだけ残す。難易度の選別はしない）")
    print("推理の近似は Tracer の説明のとおり（桁ごとの足し算・違う数字・先頭の0・場合分け 1段）。")
    print()
    hidden_by_shape: dict[str, list[int]] = {}
    print("| 形 | 問題数（試行） | 場合分け1段で解けた | × の数 中央値 [最小–最大] | ◯ の数 | 場合分けで消した候補 中央値 |")
    print("|---|---|---|---|---|---|")
    results = {}
    for sname, k, a, length, n in shapes:
        puzzles, tries = generate(rng, k, a, length, n, args.count, args.budget)
        traces = []
        ok_count = 0
        trial_counts = []
        hidden_counts = []
        for adds, res, sol in puzzles:
            t = Tracer(adds, res)
            ok, trial = t.solve()
            if ok:
                ok_count += 1
                trial_counts.append(trial)
                hidden_counts.append(t.hidden)
                assert t.placed() == sol
                traces.append(t.events)
        xs = [sum(1 for e in ev if e[0] == "x") for ev in traces]
        os_ = [sum(1 for e in ev if e[0] == "o") for ev in traces]
        results[sname] = (traces, n)
        hidden_by_shape[sname] = hidden_counts
        if traces:
            print(
                f"| {sname} | {len(puzzles)}（{tries}） | {ok_count} | {statistics.median(xs):g} [{min(xs)}–{max(xs)}] | "
                f"{statistics.median(os_):g} | {statistics.median(trial_counts):g} |"
            )
        else:
            print(f"| {sname} | {len(puzzles)}（{tries}） | 0 | - | - | - |")
    print()
    print("## 入力の形ごとの操作数（1問あたりの中央値）")
    print("「× を書く」: 推理で消した候補をすべて × で書き、決まったら入れる人。「入れるだけ」: × を書かず決まった数字だけ入れる人。")
    print("A: 表（◯→×→空白。× は2回押して途中で◯を通る）。A': 表（×→◯→空白）。B: 鍵盤＋× のメモの切り替え（ナンプレ型）。")
    print("B': 鍵盤（軽く押すと×、長く押すと入れる）。C: 札（× は文字を選んで札を軽く押す、入れるは札を文字へ運ぶ）。")
    print("（推理の順 / 文字ごとにまとめた順）")
    print()
    print("| 形 | 書き方 | A | A' | B | B' | C | A で途中に◯を通る回数 |")
    print("|---|---|---|---|---|---|---|---|")
    for sname, (traces, n) in results.items():
        if not traces:
            continue
        for style in ("× を書く", "入れるだけ"):
            cols = {"A": [], "A'": [], "B": [], "B'": [], "C": [], "pass": []}
            colsg = {"B": [], "B'": [], "C": []}
            for ev in traces:
                e = ev if style == "× を書く" else [x for x in ev if x[0] == "o"]
                g = group_by_letter(e)
                cols["A"].append(ops_table(e, 2, 1))
                cols["A'"].append(ops_table(e, 1, 2))
                cols["B"].append(ops_select_mode(e))
                colsg["B"].append(ops_select_mode(g))
                cols["B'"].append(ops_select_no_mode(e))
                colsg["B'"].append(ops_select_no_mode(g))
                cols["C"].append(ops_tiles(e))
                colsg["C"].append(ops_tiles(g))
                cols["pass"].append(sum(1 for x in e if x[0] == "x"))
            med = {key: statistics.median(v) for key, v in cols.items()}
            medg = {key: statistics.median(v) for key, v in colsg.items()}
            print(
                f"| {sname} | {style} | {med['A']:g} | {med["A'"]:g} | {med['B']:g} / {medg['B']:g} | "
                f"{med["B'"]:g} / {medg["B'"]:g} | {med['C']:g} / {medg['C']:g} | {med['pass']:g} |"
            )
    print()
    print("## 文字の切り替え（× を書く人、推理の順）: 続けて同じ文字を書く長さ")
    for sname, (traces, n) in results.items():
        if not traces:
            continue
        runs = []
        for ev in traces:
            prev, run = None, 0
            for _, c, _ in ev:
                if c == prev:
                    run += 1
                else:
                    if prev is not None:
                        runs.append(run)
                    prev, run = c, 1
            runs.append(run)
        print(f"- {sname}: 同じ文字が続く長さ 中央値 {statistics.median(runs):g}、平均 {statistics.mean(runs):.2f}")
    print()
    print("## 「この数字が入りうる文字は1つだけ」で決めた回数（10 文字の問題だけで起きる。表なら数字の列を見れば分かる）")
    for sname, hs in hidden_by_shape.items():
        if hs:
            used = sum(1 for x in hs if x > 0)
            print(f"- {sname}: 1問あたり 中央値 {statistics.median(hs):g}、最大 {max(hs)}、使った問題 {used}/{len(hs)}")
    print()
    print("## 例（最初の問題の推理の記録、先頭 30 件）")
    for sname, (traces, n) in results.items():
        if traces:
            ev = traces[0]
            print(f"- {sname}: " + " ".join(f"{'×' if k == 'x' else '◯'}{c}{d}" for k, c, d in ev[:30]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("layout", "limits", "taps"):
        sub.add_parser(name)
    for name in ("ops", "all"):
        p = sub.add_parser(name)
        p.add_argument("--seed", type=int, default=20261122)
        p.add_argument("--count", type=int, default=30)
        p.add_argument("--budget", type=float, default=120.0)
    args = parser.parse_args()
    if args.command in ("layout", "all"):
        cmd_layout()
        print()
    if args.command in ("limits", "all"):
        cmd_limits()
        print()
    if args.command in ("taps", "all"):
        cmd_taps()
        print()
    if args.command in ("ops", "all"):
        cmd_ops(args)


if __name__ == "__main__":
    main()
