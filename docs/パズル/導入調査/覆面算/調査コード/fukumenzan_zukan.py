"""覆面算（fukumenzan）の図鑑と問題の特徴の調査コード。

標準ライブラリだけで、始めたときの盤面で分かる特徴の案ごとに、次の3つを測る（seed 固定の問題で）。

- レベルの中で値が分かれるか: 1つのレベルの値の種類と、各値の問題の数
- ほかの案の特徴と重ならないか: レベルの中の、特徴どうしの Spearman 順位相関
- 難易度の写しにならないか: レベルとの順位相関（全レベルを通して）と、レベルの中の「読みの量」との順位相関

レベルは難易度の調査コード（fukumenzan_difficulty.py。版6・案 P50nk18w）の classify6 / level6 で決めたもの。
問題は、難易度の観点が残した供給の測り（supply6 の出力と、family6 の標的生成の出力）から読む。

読みの量（この調査で定めた近似。難易度の資料 §2.2 の「1手」の数え方に合わせた）:
  そのレベルを決めた弱い端の読み手が、始めの盤面から解き終えるまでに出す事実の数。
  1つの規則（1列・表・2列のまとめ）を当てるたびに、候補が減った変数の数 × 重み（1列と表は1、2列は2）を足す。
  L1 は NB6lo、L2 は Llo、L3 は Clo50 の閉包。L4・L5 は、場合分けの土台（C6_LO, r2_wl=2。探す手間の上限なし）の閉包に、
  場合分け（weak_allowed。2回まで）の各枝を閉包で読む事実と、場合分けの結論を入れて読み直す事実を足し、回数の少ない道の中で最小のもの。
  閉包は読む順（列 → 表 → 2列）に依るので、人の最短の手ではない。枝は閉包で読む（sPcN と同じ）ので、L5 でも1回で解ける道があればそれを使う。

使い方（<ルート> はリポジトリのルート。入力の jsonl は難易度の調査コードの出力）:
  D=<ルート>/docs/パズル/導入調査/覆面算/調査コード/fukumenzan_difficulty.py
  Z=<ルート>/docs/パズル/導入調査/覆面算/調査コード/fukumenzan_zukan.py
  python3 $D supply6 --conds 0,1,2,7,8,9 --per 1000 --out s6_small.jsonl                     # L1〜L3（3s）。難易度の観点の出力
  python3 $D supply6 --conds 10,11 --nrange 7,9 --per 1000 --out s6_big.jsonl                # 同（L3〜L5）。f6_sup と同じ seed の問題
  python3 $D supply6 --conds 10,11 --nrange 7,9 --per 2500 --start 3000 --out s6_extra.jsonl # この調査で足した 5000 候補（4並列で約15分）
  # f6_sup.jsonl と、同じ seed に読み手を足した f6_supx・f6_supx2・f6_alg は、難易度の資料 §3.4 の標的生成 5000（family6 の出力）
  python3 $Z measure --supply s6_small.jsonl s6_big.jsonl s6_extra.jsonl --fam f6_sup.jsonl f6_supx.jsonl f6_supx2.jsonl f6_alg.jsonl --out zk.jsonl
  python3 $Z report zk.jsonl
  python3 $Z expected --out fukumenzan_zukan.expected.json
  supply6 の行の level は出力した時点の SPLIT_CAP6 で決まるので、measure は f6 から今の採る案で決め直す（_level_now）。

条件（件数・打ち切り）は比較実験の条件で、完成仕様ではない。
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
from collections import Counter, defaultdict
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fukumenzan_difficulty as fd  # noqa: E402

# ---------------------------------------------------------------- 特徴（始めたときの盤面で分かるもの）

FEATURES = {
    "addends": "足す数の数",
    "maxLen": "いちばん長い足す数の桁",
    "resultLen": "答えの桁",
    "grows": "答えの桁が足す数より増える（0/1）",
    "cells": "文字のマスの数（足す数と答えの桁の合計）",
    "letters": "文字の数（＝◯を付ける数）",
    "unusedDigits": "使われない数字の数（10−文字の数）",
    "leadLetters": "先頭に来る文字の数（0にならない文字）",
    "maxOccurrence": "いちばん多く出る文字の回数",
    "onceLetters": "1回だけ出る文字の数",
    "resultOnlyLetters": "答えにだけ出る文字の数",
    "repeatColumns": "同じ文字が2回以上出る列の数",
    "repeatWords": "同じ文字を2回以上含む数の数",
    "repeatCells": "2回目以降に出る文字のマスの数（マス−文字）",
}


def features_of(addends: list[str], result: str) -> dict:
    words = list(addends) + [result]
    occ: Counter[str] = Counter("".join(words))
    letters = len(occ)
    cells = sum(len(w) for w in words)
    R = len(result)
    cols = []
    for j in range(R):
        col = [w[-1 - j] for w in words if j < len(w)]
        cols.append(col)
    in_addends = set("".join(addends))
    return {
        "addends": len(addends),
        "maxLen": max(len(w) for w in addends),
        "resultLen": R,
        "grows": int(R > max(len(w) for w in addends)),
        "cells": cells,
        "letters": letters,
        "unusedDigits": 10 - letters,
        "leadLetters": len({w[0] for w in words if len(w) > 1}),
        "maxOccurrence": max(occ.values()),
        "onceLetters": sum(1 for c in occ.values() if c == 1),
        "resultOnlyLetters": len(set(result) - in_addends),
        "repeatColumns": sum(1 for col in cols if len(set(col)) < len(col)),
        "repeatWords": sum(1 for w in words if len(set(w)) < len(w)),
        "repeatCells": cells - letters,
    }


def shape_of(addends: list[str], result: str) -> str:
    return "+".join(str(len(w)) for w in addends) + "=" + str(len(result))


# ---------------------------------------------------------------- 読みの量（事実の数）


class _Count:
    """規則を当てるたびに、候補が減った変数の数 × 重み（1列と表は1、2列は2、3列は3）を steps に足す。"""

    steps = 0
    _w = 1

    def col_sup(self, j, dom, tl=None):
        self._w = 1
        return super().col_sup(j, dom, tl)

    def table(self, dom):
        self._w = 1
        return super().table(dom)

    def join(self, cols, dom, cap, linked, mode, tls=None):
        w = len(cols)
        r = super().join(cols, dom, cap, linked, mode, tls)
        self._w = w
        return r

    def _apply(self, dom, sup):
        ch = False
        for u, m in sup.items():
            nm = dom[u] & m
            if nm != dom[u]:
                dom[u] = nm
                ch = True
                self.steps += self._w
                if nm == 0:
                    return None
        return ch


class CountNB6(_Count, fd.NoBounds6Reader):
    pass


class CountFam4(_Count, fd.Fam4Reader):
    pass


class CountFam6(_Count, fd.Fam6Reader):
    pass


def _close_steps(rd, dom):
    rd.steps = 0
    st, d = rd.close(dom)
    return st, d, rd.steps


def rounds_of(rd, dom, cap=60):
    """全部の読みを同時に当てる1回を1段として、解き終えるまでの段の数（読む順に依らない、読みの量の2つ目の近似）。"""
    cur = list(dom)
    for i in range(1, cap + 1):
        new = rd.round_once(cur)
        if new is None or new == cur:
            return None
        cur = new
        if fd._solved(rd.p, cur):
            return i
    return None


def read_amount(p: fd.Puzzle, level: int, frontier_cap: int = 300) -> dict:
    """レベルを決めた弱い端の読み手で、解き終えるまでの事実の数。L4・L5 は場合分けの回数（閉包で枝を読む）も返す。"""
    init = p.initial_domains()
    if level in (1, 2, 3):
        rd = {1: lambda: CountNB6(p, **fd.NB6_LO), 2: lambda: CountFam4(p, **fd.L6_LO),
              3: lambda: CountFam6(p, pair_prod_cap=50, **fd.C6_LO)}[level]()
        st, d, s = _close_steps(rd, init)
        return {"steps": s if fd._solved(p, d) else None, "rounds": rounds_of(rd, init)}
    rd = CountFam6(p, **dict(fd.C6_LO, r2_wl=2))
    allowed = fd.weak_allowed(p)
    st, d0, root = _close_steps(rd, init)
    if st == fd.CONTRA:
        return {"steps": None}
    if fd._solved(p, d0):
        return {"steps": root, "splits": 0}
    frontier = {tuple(d0): root}
    for depth in range(1, fd.SPLIT_CAP6 + 1):
        nxt: dict = {}
        best = None
        for s, cost in frontier.items():
            s = list(s)
            for v in range(p.nvars):
                w = fd.POP[s[v]]
                if w < 2 or not allowed(v, w):
                    continue
                c = cost
                new = list(s)
                for dgt in fd.DIGITS[s[v]]:
                    d2 = list(s)
                    d2[v] = 1 << dgt
                    st2, _, k2 = _close_steps(rd, d2)
                    c += k2
                    if st2 == fd.CONTRA:
                        new[v] &= ~(1 << dgt)
                if new == s:
                    continue
                st3, d3, k3 = _close_steps(rd, new)
                c += k3
                if st3 == fd.CONTRA:
                    continue
                if fd._solved(p, d3):
                    best = c if best is None else min(best, c)
                    continue
                t = tuple(d3)
                if t not in nxt or nxt[t] > c:
                    nxt[t] = c
        if best is not None:
            return {"steps": best, "splits": depth}
        if not nxt or len(nxt) > frontier_cap:
            return {"steps": None}
        frontier = nxt
    return {"steps": None}


# ---------------------------------------------------------------- 問題の読み込み


def _level_now(r) -> int | None:
    """supply6 の行のレベルを、行に残った読み手の結果（f6）から今の採る案（level6・SPLIT_CAP6）で決め直す。
    行の level は、出力した時点の SPLIT_CAP6 で決まっている（s6_big.jsonl は上限3回のときの出力で、3回の問題を L5 に入れている）。"""
    q = {"k": len(r["addends"]), "n": r["n"], "lens": [len(w) for w in r["addends"]], "f6": r["f6"]}
    return fd.level6(q, fd.ADOPTED_V6)


def load_levelled(supply_paths, fam_paths) -> list[dict]:
    """レベルの付いた問題を seed ごとに1つ読む。supply6 の行は f6 から level6（採る案）で決め直し、family6 の行も level6 で決める。
    同じ seed が両方にあれば、レベルが一致するかを数える。"""
    by: dict[int, dict] = {}
    relabel = Counter()
    for path in supply_paths:
        for r in fd.load(path):
            if "addends" not in r:
                continue
            L = _level_now(r)
            if L != r["level"]:
                relabel[(r["level"], L)] += 1
            by[r["seed"]] = {"seed": r["seed"], "cond": r["cond"], "addends": r["addends"], "result": r["result"], "level": L,
                             "src": os.path.basename(path)}
    print(f"supply6 の行で、出力時のレベルと今の採る案のレベルが違うもの: {dict(relabel)}", file=sys.stderr)
    agree = disagree = 0
    if fam_paths:
        for r in fd.load_fam6(fam_paths):
            L = fd.level6(r, fd.ADOPTED_V6)
            if r["seed"] in by:
                if by[r["seed"]]["level"] == L:
                    agree += 1
                else:
                    disagree += 1
                continue
            by[r["seed"]] = {"seed": r["seed"], "cond": r["cond"], "addends": r["addends"], "result": r["result"], "level": L,
                             "src": "fam6"}
    print(f"seed の重なり: レベル一致 {agree}・不一致 {disagree}", file=sys.stderr)
    return [r for r in by.values() if r["level"] is not None]


def _measure_task(r):
    p = fd.Puzzle(r["addends"], r["result"])
    out = dict(r)
    out["shape"] = shape_of(r["addends"], r["result"])
    out["features"] = features_of(r["addends"], r["result"])
    out["read"] = read_amount(p, r["level"])
    return out


def cmd_measure(args):
    rows = load_levelled(args.supply, args.fam)
    print(f"{len(rows)} 問: " + "、".join(f"L{L} {c}" for L, c in sorted(Counter(r['level'] for r in rows).items())), file=sys.stderr)
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for res in pool.imap_unordered(_measure_task, rows, chunksize=4):
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- 報告

GROUP_WIDTH = {"cells": 3, "repeatCells": 3}  # 値の種類が9以上のときの、まとめる幅の候補（zukan-filter の決まりで試す）
MAX_EXACT = 8  # frontend/src/features/zukan/zukan-filter.ts の MAX_EXACT_COUNT_OPTION_COUNT


def options_of(values, width):
    distinct = sorted(set(values))
    if len(distinct) <= MAX_EXACT or width is None:
        return [(v, v) for v in distinct]
    groups: dict[int, list[int]] = defaultdict(list)
    for v in distinct:
        groups[v // width].append(v)
    return [(g[0], g[-1]) for g in groups.values()]


def _f2(x):
    return "—" if x is None else f"{x:.2f}"


def pool_view(rows, L, l3_mode):
    v = [r for r in rows if r["level"] == L]
    if L == 3 and l3_mode == "3s":
        v = [r for r in v if r["features"]["addends"] == 3 and r["features"]["maxLen"] <= 4]
    return v


def cmd_report(args):
    rows = fd.load(args.zk)
    rows.sort(key=lambda r: r["seed"])
    keys = list(FEATURES)
    print(f"# 図鑑と問題の特徴（{len(rows)} 問）\n")
    for l3_mode in ("3s", "mix"):
        if l3_mode == "mix":
            print("\n（以下、L3 に 3l を混ぜた場合）\n")
        for L in range(1, 6):
            if l3_mode == "mix" and L != 3:
                continue
            v = pool_view(rows, L, l3_mode)
            if not v:
                continue
            steps = [r["read"]["steps"] for r in v]
            ok = [i for i, s in enumerate(steps) if s is not None]
            print(f"## L{L}（{len(v)} 問、L3 は {l3_mode}）")
            print(f"- 形: {dict(sorted(Counter(r['shape'] for r in v).items(), key=lambda x: -x[1]))}")
            st_ok = [steps[i] for i in ok]
            if st_ok:
                print(f"- 読みの量（事実）: 中央値 {statistics.median(st_ok)}・最小 {min(st_ok)}・最大 {max(st_ok)}（測れた {len(ok)} 問）")
            if L >= 4:
                print(f"- 閉包で枝を読んだ場合分けの回数: {dict(Counter(r['read'].get('splits') for r in v))}")
            # 2つ目の近似: L1〜L3 は同時に読む段の数、L4・L5 は閉包で枝を読んだ場合分けの回数
            second = [r["read"].get("rounds") if L <= 3 else r["read"].get("splits") for r in v]
            ok2 = [i for i, s in enumerate(second) if s is not None]
            name2 = "段の数" if L <= 3 else "閉包で枝を読んだ回数"
            print(f"\n| 特徴 | 値の種類 | 値ごとの問題の数 | 最も多い値の割合 | 読みの量（事実）との順位相関 | {name2}との順位相関 |")
            print("|---|---|---|---|---|---|")
            for k in keys:
                vals = [r["features"][k] for r in v]
                cnt = Counter(vals)
                top = max(cnt.values()) / len(vals)
                rho = fd.spearman([vals[i] for i in ok], [steps[i] for i in ok]) if len(set(vals)) > 1 else None
                rho2 = fd.spearman([vals[i] for i in ok2], [second[i] for i in ok2]) if len(set(vals)) > 1 else None
                dist = "・".join(f"{a}:{b}" for a, b in sorted(cnt.items()))
                print(f"| {k} | {len(cnt)} | {dist} | {top:.0%} | {_f2(rho)} | {_f2(rho2)} |")
            print()
            sel = [k for k in keys if len({r['features'][k] for r in v}) > 1]
            print("特徴どうしの順位相関（このレベルで値が分かれるものだけ）\n")
            print("| | " + " | ".join(sel) + " |")
            print("|---|" + "---|" * len(sel))
            for a in sel:
                xa = [r["features"][a] for r in v]
                cells = []
                for b in sel:
                    xb = [r["features"][b] for r in v]
                    cells.append(_f2(fd.spearman(xa, xb)))
                print(f"| {a} | " + " | ".join(cells) + " |")
            print()
    # レベルとの順位相関（全レベル。L3 は 3s）
    allv = [r for L in range(1, 6) for r in pool_view(rows, L, "3s")]
    print("## レベルとの順位相関（L1〜L5 を各レベル同じ数に揃えずに通したもの。L3 は 3s）\n")
    print("| 特徴 | 順位相関 |")
    print("|---|---|")
    lv = [r["level"] for r in allv]
    for k in keys:
        print(f"| {k} | {_f2(fd.spearman([r['features'][k] for r in allv], lv))} |")
    # 各レベルを同じ数に揃えた順位相関（各レベル min(件数) を seed 順に）
    m = min(len(pool_view(rows, L, "3s")) for L in range(1, 6))
    eq = [r for L in range(1, 6) for r in pool_view(rows, L, "3s")[:m]]
    print(f"\n各レベル {m} 問に揃えたとき: " + "、".join(f"{k} {_f2(fd.spearman([r['features'][k] for r in eq], [r['level'] for r in eq]))}" for k in keys))
    # まとめた選択肢
    print("\n## 絞り込みの選択肢（zukan-filter の決まり: 値の種類が8以下なら値ごと、9以上なら幅でまとめる）\n")
    for k in ("letters", "cells", "repeatCells", "maxOccurrence", "repeatColumns", "onceLetters", "resultOnlyLetters"):
        parts = []
        for L in range(1, 6):
            v = pool_view(rows, L, "3s")
            vals = [r["features"][k] for r in v]
            opts = options_of(vals, GROUP_WIDTH.get(k))
            cnt = []
            for lo, hi in opts:
                cnt.append(f"{lo}" + ("" if lo == hi else f"〜{hi}") + f":{sum(1 for x in vals if lo <= x <= hi)}")
            parts.append(f"L{L} " + "・".join(cnt))
        print(f"- {k}: " + " / ".join(parts))


# ---------------------------------------------------------------- 移植の期待値

FIXED = ["EG+GG=EAC", "WFX+TFM=CMMW", "BYK+KTK=TKHH", "NNV+UFN+NTT=NFVT", "YFL+YAD+ADY=YLYY", "GHL+LGF+FFF=GHFW",
         "NPAPP+JANJP+CCKJ=NNAJJD", "DBRPR+UTTDR+UDDP=DDUURJ", "GVANK+FFFGB+VWNN=BGAVKB", "MKCXE+MFCXE+KXXF=YCXMCM",
         "AVUCV+AVPPP+AAUG=TVPCVV", "KBBKC+EAWKB+WWKT=AACEBC", "XXXGN+TPGTN+TXTA=GPAAYP", "SEND+MORE=MONEY"]


def cmd_expected(args):
    cases = []
    for src in FIXED:
        left, res = src.split("=")
        adds = left.split("+")
        cases.append({"addends": adds, "result": res, "features": features_of(adds, res)})
    out = {"version": 1, "features": FEATURES, "note": "Features visible on the starting board. letters = distinct letters; "
           "repeatColumns counts columns (addends and result, right-aligned) where a letter appears twice or more.", "cases": cases}
    with open(args.out, "w", encoding="utf-8") as fo:
        json.dump(out, fo, ensure_ascii=False, indent=1)
    print(f"wrote {len(cases)} cases", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("measure")
    a.add_argument("--supply", nargs="*", default=[])
    a.add_argument("--fam", nargs="*", default=[])
    a.add_argument("--out", required=True)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("report")
    a.add_argument("zk")
    a = sub.add_parser("expected")
    a.add_argument("--out", required=True)
    args = ap.parse_args()
    {"measure": cmd_measure, "report": cmd_report, "expected": cmd_expected}[args.cmd](args)


if __name__ == "__main__":
    main()
