#!/usr/bin/env python3
"""ソリティア（PZL-013）図鑑と問題の特徴の観点の調査コード。

問い: 始めたときの盤面で分かる特徴（GAME-009「問題の特徴」）のうち、遊ぶ人が次の1問を選ぶ切り口になるもの。
案ごとに3つを測る。
  1. レベルの中で値が分かれるか（1つのレベルの値の種類と、各値の問題の数）
  2. ほかの案の特徴と重ならないか（特徴どうしの順位相関）
  3. 難易度の写しにならないか（難易度の版7 の段 T・罠の後の進み G・分類したレベルとの順位相関）
あわせて、採る特徴の値をまとめる幅を、多数の配り方の分布から決める。

難易度の分類は版7（solitaire_difficulty.py の classify_v7。組札への自動送りなし）を import して使うだけで、定義は変えない。
レベルは難易度の観点の400配りのキャッシュ（v7_random.jsonl を v7big_random.jsonl で置き換えたもの）から求める。新しい解法器・網の計算はしない。
値をまとめる幅の分布だけは、解かずに配るだけの配り方（seed 0〜N-1）で求める（特徴は列の28枚だけで決まり、解く必要が無い）。

盤面の向き: col[0] が列の一番奥、col[-1] が一番上（手前）。山札は裏向きで並びは見えない。

標準ライブラリだけで書き、乱数はすべて seed を固定する。

使い方:
  python3 solitaire_zukan.py measure --cache <difficulty-tmp>          # 3つの計測と幅の比べ
  python3 solitaire_zukan.py expected --cache <difficulty-tmp> --out <solitaire_zukan.expected.json>
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import solitaire_difficulty as sd  # noqa: E402
from solitaire_difficulty import RANK, SUIT, STK  # noqa: E402

BIG = "v7big_random.jsonl"
BOOT_SEED = 20261124
BOOT_N = 1000
# 図鑑の絞り込みの決まり（frontend/src/features/zukan/zukan-filter.ts の MAX_EXACT_COUNT_OPTION_COUNT）
MAX_EXACT = 8


# ---------------------------------------------------------------------------
# 候補の特徴（列の28枚だけで決まる。山札の中身は「見えている札の残り」なので、列の数え方と同じ情報になる）


def card_above_ace(tab):
    """A の上の札（採る案）: 列ごとに、一番奥の A より上（手前）にある札の数を足す。同じ札は1回だけ数える。"""
    n = 0
    for col in tab:
        ks = [k for k, c in enumerate(col) if RANK[c] == 1]
        if ks:
            n += len(col) - 1 - min(ks)
    return n


def card_below_king(tab):
    """K の下の札（採る案）: 列ごとに、一番上（手前）の K より下（奥）にある札の数を足す。同じ札は1回だけ数える。"""
    n = 0
    for col in tab:
        ks = [k for k, c in enumerate(col) if RANK[c] == 13]
        if ks:
            n += max(ks)
    return n


def card_above_ace_each(tab):
    """比べる用: A ごとに上の札を数えて足す（同じ列に A が2枚あると重ねて数える）。"""
    return sum(len(col) - 1 - k for col in tab for k, c in enumerate(col) if RANK[c] == 1)


def card_below_king_each(tab):
    """比べる用: K ごとに下の札を数えて足す。"""
    return sum(k for col in tab for k, c in enumerate(col) if RANK[c] == 13)


def buried_ace(tab):
    """埋まった A: 列にあって、上に札が乗っている A の数。"""
    return sum(1 for col in tab for k, c in enumerate(col) if RANK[c] == 1 and k < len(col) - 1)


def king_not_bottom(tab):
    """下に札がある K: 列の一番奥にない K の数（solitaire_difficulty.static_features の kings_not_bottom）。"""
    return sum(1 for col in tab for k, c in enumerate(col) if RANK[c] == 13 and k > 0)


def tab_ace(tab):
    """列の A（山札の A は 4 − これ）。"""
    return sum(1 for col in tab for c in col if RANK[c] == 1)


def tab_king(tab):
    """列の K（山札の K は 4 − これ）。"""
    return sum(1 for col in tab for c in col if RANK[c] == 13)


def bottom_king(tab):
    """一番奥が K の列の数。"""
    return sum(1 for col in tab if RANK[col[0]] == 13)


def deepest_ace(tab):
    """一番深い A の上の札（列の A のうち最大。列に A が無ければ 0）。"""
    return max([len(col) - 1 - k for col in tab for k, c in enumerate(col) if RANK[c] == 1], default=0)


def card_above_low2(tab):
    """A・2 の上の札（A と 2 ごとに数えて足す）。"""
    return sum(len(col) - 1 - k for col in tab for k, c in enumerate(col) if RANK[c] <= 2)


def card_above_low3(tab):
    """A〜3 の上の札（static_features の buried_low）。"""
    return sum(len(col) - 1 - k for col in tab for k, c in enumerate(col) if RANK[c] <= 3)


def self_block(tab):
    """同じマークの小さい札より上にある札（static_features の self_block）。"""
    n = 0
    for col in tab:
        for k, c in enumerate(col):
            if any(SUIT[d] == SUIT[c] and RANK[d] < RANK[c] for d in col[:k]):
                n += 1
    return n


def seq_pair(tab):
    """並んだ所: 列の中で、赤黒交互・降順に重なっている隣どうしの数（21 − static_features の breaks）。"""
    return sum(1 for col in tab for k in range(1, len(col)) if STK[col[k]][col[k - 1]])


def top_move(tab):
    """始めに列で動かせる手: 列の並びの始まりから上を別の列の一番上へ動かす手と、列の一番上の A を組札へ送る手の数。山札は数えない。"""
    n = 0
    for i, col in enumerate(tab):
        c = col[sd.run_start(col)]
        n += sum(1 for j, col2 in enumerate(tab) if j != i and STK[c][col2[-1]])
        n += RANK[col[-1]] == 1
    return n


# 名前: (図鑑の見出しの案, 関数, 一目で分かるか)
CANDIDATES = {
    "card_above_ace": ("A の上の札", card_above_ace, "数える"),
    "card_below_king": ("K の下の札", card_below_king, "数える"),
    "card_above_ace_each": ("A の上の札（A ごと）", card_above_ace_each, "数える"),
    "card_below_king_each": ("K の下の札（K ごと）", card_below_king_each, "数える"),
    "buried_ace": ("埋まった A", buried_ace, "一目"),
    "king_not_bottom": ("下に札がある K", king_not_bottom, "一目"),
    "tab_ace": ("列の A", tab_ace, "一目"),
    "tab_king": ("列の K", tab_king, "一目"),
    "bottom_king": ("一番奥が K の列", bottom_king, "一目"),
    "deepest_ace": ("一番深い A の上の札", deepest_ace, "数える"),
    "card_above_low2": ("A・2 の上の札", card_above_low2, "数える"),
    "card_above_low3": ("A〜3 の上の札", card_above_low3, "数える"),
    "self_block": ("同じマークの小さい札の上の札", self_block, "数える"),
    "seq_pair": ("並んだ所", seq_pair, "一目"),
    "top_move": ("始めに列で動かせる手", top_move, "探す"),
}
ADOPTED = ("card_above_ace", "card_below_king")
# 始めたときには分からない量（比べる用。図鑑の特徴にはしない）
HIDDEN = {
    "moves": "解き筋の手数（解法器の1本。組札送りを除く）",
    "root_cands": "初手で置ける手（山札の順でめくった後）",
}


def board_features(tab):
    return {k: fn(tab) for k, (_, fn, _) in CANDIDATES.items()}


# ---------------------------------------------------------------------------
# 読み込み


def load(cache, big=True):
    rows = sd.load_v7(cache, big=BIG if big else "")
    S = sd._load_jsonl(os.path.join(cache, "survey_random.jsonl"))
    for f in rows:
        c = sd.classify_v7(f)
        f["level"] = c[1] if c[0] == "classified" else None
        tab, _ = sd.deal(f["seed"])
        f.update(board_features(tab))
        s = S.get(f["seed"], {})
        f["empty_moves"] = s.get("empty_moves")
    return rows


# ---------------------------------------------------------------------------
# 計測


def rho(rows, a, b):
    return sd.spearman([r.get(a) for r in rows], [r.get(b) for r in rows])


def boot_ci(rows, a, b, seed=BOOT_SEED, n=BOOT_N):
    rnd = random.Random(seed)
    xs = [r.get(a) for r in rows]
    ys = [r.get(b) for r in rows]
    vals = []
    for _ in range(n):
        idx = [rnd.randrange(len(rows)) for _ in rows]
        v = sd.spearman([xs[i] for i in idx], [ys[i] for i in idx])
        if v == v:
            vals.append(v)
    vals.sort()
    return vals[int(len(vals) * 0.025)], vals[int(len(vals) * 0.975) - 1]


def options(values, width):
    """図鑑の絞り込みの選択肢（zukan-filter.ts の listCountOptions と同じ決め方）。[(min, max, 問題の数)]"""
    cnt = collections.Counter(values)
    distinct = sorted(cnt)
    if len(distinct) <= MAX_EXACT or width is None:
        return [(v, v, cnt[v]) for v in distinct]
    groups = collections.OrderedDict()
    for v in distinct:
        groups.setdefault(v // width, []).append(v)
    return [(g[0], g[-1], sum(cnt[v] for v in g)) for g in groups.values()]


def fmt_opts(opts):
    return " ".join((f"{a}" if a == b else f"{a}〜{b}") + f":{n}" for a, b, n in opts)


def measure(cache, deals):
    rows = load(cache)
    win = [r for r in rows if r["status"] == "win"]
    cl = [r for r in win if r["level"]]
    l25 = [r for r in cl if r["level"] >= 2]
    b23 = [r for r in cl if r["level"] in (2, 3)]
    b45 = [r for r in cl if r["level"] in (4, 5)]
    lv = {L: [r for r in cl if r["level"] == L] for L in range(1, 6)}
    print(f"400配り（seed 0〜399）。解けると確かめた {len(win)}、分類済み {len(cl)}（L1〜L5: "
          + " / ".join(str(len(lv[L])) for L in range(1, 6)) + f"。版7 (a)、{BIG} で置き換えた後）")

    print("\n## 1. レベルの中で値が分かれるか（分類済み。値: 問題の数。最多の値の割合）")
    for k, (label, _, glance) in CANDIDATES.items():
        print(f"- {k}（{label}・{glance}）")
        for L in range(1, 6):
            vals = [r[k] for r in lv[L]]
            cnt = collections.Counter(vals)
            mode = max(cnt.values()) / len(vals)
            print(f"    L{L} n={len(vals)} 値の種類 {len(cnt)} 最多 {mode:.0%}: " + " ".join(f"{v}:{c}" for v, c in sorted(cnt.items())))

    print("\n## 2・3. 難易度との順位相関（Spearman）")
    print("  level: 分類済み、CI はブートストラップ 95%（" + f"{BOOT_N} 回、Random({BOOT_SEED})）。T: 解ける {len(win)}。"
          + f"G_f・G_b: L2〜L5 {len(l25)}。L2/L3・L4/L5: 同じ段 T の中で G の段だけが違うレベルの対（{len(b23)}・{len(b45)}）")
    print(f"  {'特徴':22} {'level':>6} {'CI':>15} {'T':>6} {'G_f':>6} {'G_b':>6} {'L2/L3':>6} {'L4/L5':>6} {'CI(L4/L5)':>15} | {'手数':>6} {'空ける':>6}")
    for k in list(CANDIDATES) + list(HIDDEN):
        lo, hi = boot_ci(cl, k, "level")
        lo45, hi45 = boot_ci(b45, k, "level")
        print(f"  {k:22} {rho(cl, k, 'level'):6.2f} [{lo:5.2f},{hi:5.2f}] {rho(win, k, 'T_all_full'):6.2f} "
              f"{rho(l25, k, 'G_lo_f_all_v7'):6.2f} {rho(l25, k, 'G_hi_b7_all_v7'):6.2f} {rho(b23, k, 'level'):6.2f} "
              f"{rho(b45, k, 'level'):6.2f} [{lo45:5.2f},{hi45:5.2f}] | {rho(win, k, 'moves'):6.2f} {rho(win, k, 'empty_moves'):6.2f}")
    print("  （手数: 解き筋の手数 moves。空ける: 解き筋の中の列を空ける手 empty_moves。どちらも解法器の1本で、難易度ではなく作業の向きを見る参考）")
    print("\n  レベルごとの中央値（10/50/90）:")
    for k in ADOPTED + ("buried_ace", "king_not_bottom"):
        print(f"    {k:18}", " | ".join(f"L{L} {sd._q([r[k] for r in lv[L]])}" for L in range(1, 6)))
    print("\n  1つのレベルの中での G との相関（G_f / G_b。そのレベルの中で特徴が帯の中の強弱を表すか）:")
    for k in ADOPTED + ("buried_ace", "king_not_bottom"):
        print(f"    {k:18}", " | ".join(f"L{L}(n={len(lv[L])}) {rho(lv[L], k, 'G_lo_f_all_v7'):5.2f} / {rho(lv[L], k, 'G_hi_b7_all_v7'):5.2f}"
                                       for L in range(2, 6)))
    cl0 = [r for r in load(cache, big=False) if r["status"] == "win" and r["level"]]
    print(f"  上限5倍の2回目の前の分類（{len(cl0)} 件）での level との相関:",
          ", ".join(f"{k} {rho(cl0, k, 'level'):.2f}" for k in ADOPTED + ("buried_ace", "king_not_bottom")))

    print(f"\n## 2. 特徴どうしの順位相関（解ける {len(win)} 件）")
    ks = list(CANDIDATES)
    print("  " + " " * 22 + " ".join(f"{i:>5}" for i in range(len(ks))))
    for i, a in enumerate(ks):
        print(f"  {i:2} {a:19}" + " ".join(f"{rho(win, a, b):5.2f}" for b in ks))
    print(f"  採る2つの相関: 解ける {rho(win, *ADOPTED):.2f}・分類済み {rho(cl, *ADOPTED):.2f}・配るだけの {deals} 件は下")

    print(f"\n## 幅: 配るだけの配り方 seed 0〜{deals - 1} の分布（解かない。分類済みとの違いは下の比べ）")
    D = {k: [] for k in ADOPTED + ("buried_ace", "king_not_bottom")}
    for s in range(deals):
        tab, _ = sd.deal(s)
        for k in D:
            D[k].append(CANDIDATES[k][1](tab))
    print(f"  採る2つの相関: {sd.spearman(D[ADOPTED[0]][:5000], D[ADOPTED[1]][:5000]):.2f}（seed 0〜4999）")
    for k, vals in D.items():
        cnt = collections.Counter(vals)
        print(f"  {k}: " + " ".join(f"{v}:{100 * c / deals:.1f}%" for v, c in sorted(cnt.items())))
    print("\n  1レベルの問題の数 N ごとの選択肢（N 件を配るだけの分布から無作為に取る 200 回。Random(seed=N*100+幅)。"
          "選択肢の数の中央値・最も少ない選択肢の問題の数の中央値・最も多い選択肢の割合の中央値）")
    for k in ADOPTED:
        vals = D[k]
        for w in (2, 3, 4, 5, 6):
            line = []
            for N in (100, 300, 500, 1000):
                rnd = random.Random(N * 100 + w)
                no, mn, mx = [], [], []
                for _ in range(200):
                    sample = [vals[rnd.randrange(len(vals))] for _ in range(N)]
                    o = options(sample, w)
                    no.append(len(o))
                    mn.append(min(n for _, _, n in o))
                    mx.append(max(n for _, _, n in o) / N)
                line.append(f"N={N}: {statistics.median(no):.0f} 個・最少 {statistics.median(mn):.0f}・最多 {statistics.median(mx):.0%}")
            full = options(vals, w)
            print(f"  {k} 幅 {w}: " + " / ".join(line))
            print(f"      {deals} 件の選択肢: {fmt_opts(full)}")

    print("\n  分類済みのレベルごとの選択肢（幅 3。8種類以下は値ごと）と、配るだけの分布を幅 3 でまとめた割合")
    for k in ADOPTED:
        full = options(D[k], 3)
        print(f"  {k} 配るだけ: " + " ".join(f"{a}〜{b}:{100 * n / deals:.0f}%" for a, b, n in full))
        for L in range(1, 6):
            vals = [r[k] for r in lv[L]]
            grouped = options(vals, 3) if len(set(vals)) > MAX_EXACT else None
            shares = collections.Counter(v // 3 for v in vals)
            print(f"    L{L} n={len(vals)} 絞り込みに出る選択肢: {fmt_opts(options(vals, 3))}"
                  + ("" if grouped else "（8種類以下なので値ごと）")
                  + "｜幅3 の割合: " + " ".join(f"{3 * g}〜{3 * g + 2}:{100 * c / len(vals):.0f}%" for g, c in sorted(shares.items())))


# ---------------------------------------------------------------------------
# 移植の期待値


def write_expected(cache, out, deals=20000):
    rows = load(cache)
    cases = []
    seen = set()
    for r in rows:
        if r["status"] == "win" and r["level"]:
            tab, stock = sd.deal(r["seed"])
            cases.append({"seed": r["seed"], "why": f"L{r['level']}", **sd.deal_text(tab, stock),
                          "features": {k: CANDIDATES[k][1](tab) for k in ADOPTED}})
            seen.add(r["seed"])
    # 値の端: 配るだけの配り方で、採る特徴の値ごとに最初の seed
    first = {}
    for s in range(deals):
        tab, _ = sd.deal(s)
        for k in ADOPTED:
            v = CANDIDATES[k][1](tab)
            first.setdefault((k, v), s)
    for (k, v), s in sorted(first.items()):
        if s in seen:
            continue
        tab, stock = sd.deal(s)
        cases.append({"seed": s, "why": f"{k}={v} の最初の配り方（配るだけ。解けるかは確かめていない）", **sd.deal_text(tab, stock),
                      "features": {kk: CANDIDATES[kk][1](tab) for kk in ADOPTED}})
        seen.add(s)
    data = {
        "description": "ソリティア（PZL-013）図鑑の問題の特徴。columns は列ごとに一番奥から一番上へ、stock は次にめくる札から。"
                       "札は <数><マーク>（A・J・Q・K、S♠ H♥ D♦ C♣）。",
        "features": {
            "card_above_ace": "A の上の札: 列ごとに、一番奥の A より上にある札の数を足したもの（同じ札は1回）。列に A が無ければ 0",
            "card_below_king": "K の下の札: 列ごとに、一番上の K より下にある札の数を足したもの（同じ札は1回）。列に K が無ければ 0",
        },
        "filter": {"max_exact_option_count": MAX_EXACT, "range_width": 3},
        "levels": "版7 (a)。難易度の観点の400配りのキャッシュを v7big_random.jsonl で置き換えた分類",
        "cases": cases,
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"{len(cases)} 件を {out} に書いた")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("measure")
    m.add_argument("--cache", required=True)
    m.add_argument("--deals", type=int, default=20000)
    e = sub.add_parser("expected")
    e.add_argument("--cache", required=True)
    e.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "measure":
        measure(a.cache, a.deals)
    else:
        write_expected(a.cache, a.out)


if __name__ == "__main__":
    main()
