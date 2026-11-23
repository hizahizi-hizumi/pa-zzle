#!/usr/bin/env python3
"""ソリティア（PZL-013）問題供給の観点の調査コード。

難易度の観点の調査コード solitaire_difficulty.py（版7。features_v7 → classify_v7、ルールは組札への自動送りなし）を
import して使う。特徴と分類の定義は変えない。

コマンド:
- stats: 難易度の観点が400配り（seed 0〜399）で求めたキャッシュ（survey_random.jsonl・v7_random.jsonl・
  v7big_random.jsonl・resurvey5_log.txt）だけを読み、レベルごとの収率、段ごとの時間、生成の仕方ごとの1問あたりの
  CPU 秒、件数ごとの生成時間の見積もり、打ち切りの上限と静的な特徴で寄せたときの偏りを出す。新しい分類はしない。
  --ratio-t2・--ratio-t3 で、段2・4変種とも段3 の読むモデルと致命の手の時間（features_v7 の trap_sec）に、
  minimal で測った比（分類に要る量だけの時間 ÷ trap_sec）を掛けた見積もりを出す。
- minimal: 分類に要る量だけを求める流れ（段 T で先に振り分け、読むモデルは段2 と、4変種とも段3 の配り方だけ。
  比べる用の量は求めない）と、features_v7（比べる用の量を含む）を同じ配り方・同じプロセスで続けて流し、
  結果を JSONL に書く。止めても同じコマンドで続きから流せる。
- mincmp: minimal の結果から、分類の一致と時間の比を出す。
- poolsize: 問題集の1問の表し方（候補番号・札の並びの文字列・並びの番号の base64url）ごとに、JSON と gzip の大きさを
  求め、既存ゲームの問題集と比べる。

標準ライブラリだけで書き、乱数はすべて seed を固定する。時間は Python 3 の1プロセスの CPU 秒（実時間）で、
環境に依る。
"""
from __future__ import annotations

import argparse
import base64
import collections
import gzip
import json
import math
import os
import random
import re
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import solitaire_difficulty as D  # noqa: E402

LEVELS = (1, 2, 3, 4, 5)
V7_MAIN = D.V7_MAIN  # ("n_poss_f", "G_lo_f", "G_hi_f", "G_lo_b7", "G_hi_b7")

# 札の並びの文字列: 札の番号 c（suit*13+rank-1、S,H,D,C）を1文字にする。
# 列1〜7 を左から、各列は奥から手前へ、続けて山札を次にめくる札から並べた52文字。
CARD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def encode_deal(tab, stock) -> str:
    seq = [c for col in tab for c in col] + list(stock)
    assert sorted(seq) == list(range(52))
    return "".join(CARD_ALPHABET[c] for c in seq)


def decode_deal(code: str):
    seq = [CARD_ALPHABET.index(ch) for ch in code]
    assert sorted(seq) == list(range(52))
    tab, i = [], 0
    for n in range(1, 8):
        tab.append(tuple(seq[i:i + n]))
        i += n
    return tuple(tab), tuple(seq[28:])


def lehmer_b64(tab, stock) -> str:
    """並びを順列の番号（Lehmer 符号）にし、226 ビットを base64url（38文字、= なし）にする。"""
    seq = [c for col in tab for c in col] + list(stock)
    rest = list(range(52))
    n = 0
    for c in seq:
        i = rest.index(c)
        n = n * len(rest) + i
        rest.pop(i)
    raw = n.to_bytes(29, "big")  # 52! < 2^226 < 2^232
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


# ---------------------------------------------------------------------------
# キャッシュの読み込み


def _cache_rows(cache):
    S = D._load_jsonl(os.path.join(cache, "survey_random.jsonl"))
    rows_def = {f["seed"]: f for f in D.load_v7(cache)}
    rows_big = {f["seed"]: f for f in D.load_v7(cache, big="v7big_random.jsonl")}
    B = D._load_jsonl(os.path.join(cache, "v7big_random.jsonl"))
    resurvey = {}
    path = os.path.join(cache, "resurvey5_log.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^(\d+) \((.*)\)$", line.strip())
                if m:
                    parts = [p.strip().strip("'") for p in m.group(2).split(",")]
                    resurvey[int(m.group(1))] = float(parts[-1])
    return S, rows_def, rows_big, B, resurvey


def t_class(f):
    """段 T による振り分け。T1r: 4変種とも段1（L1 の候補）、T2: 段2（L2・L3 の候補）、T3r: 4変種とも段3（L4・L5 の候補）、
    T1x・T3x: 変種で段が変わる（範囲外。読むモデルは要らない）、big: 網が大きすぎる、inv: 解き筋が無い。"""
    if f.get("status") != "win":
        return "inv"
    Ts = [f.get(f"T_all_{k}") for k in D.T_KEYS]
    if any(v is None for v in Ts):
        return "big"
    T = Ts[0]
    if T == 2:
        return "T2"
    robust = all(v == T for v in Ts)
    return f"T{T}{'r' if robust else 'x'}"


def lv_of(f):
    c = D.classify_v7(f)
    return c[1] if c[0] == "classified" else c[1]


def _q(xs, ps=(0.1, 0.5, 0.9)):
    if not xs:
        return None
    s = sorted(xs)
    return tuple(s[min(len(s) - 1, int(p * len(s)))] for p in ps)


def fmt_h(sec):
    return f"{sec / 3600:,.1f}"


def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h


# ---------------------------------------------------------------------------
# stats


def cmd_stats(cache, ratio2=1.0, ratio3=1.0):
    S, rows_def, rows_big, B, resurvey = _cache_rows(cache)
    seeds = sorted(S)
    n = len(seeds)
    print(f"候補: seed {seeds[0]}〜{seeds[-1]} の {n} 配り（無作為）")
    cls = {s: t_class(rows_def[s]) for s in seeds}
    lv_def = {s: lv_of(rows_def[s]) for s in seeds}
    lv_big = {s: lv_of(rows_big[s]) for s in seeds}
    print("段 T による振り分け:", dict(collections.Counter(cls.values())))
    for name, lv in (("既定の上限", lv_def), ("上限5倍の2回目の後", lv_big)):
        c = collections.Counter(lv.values())
        print(f"  {name}: " + "・".join(f"L{L} {c[L]}（{100 * c[L] / n:.2f}%）" for L in LEVELS),
              f"・評価不能 {c['oracle-unresolved'] + c['natural-graph-too-large']}")
    print("  振り分けとレベル（既定の上限）:")
    for k in ("T1r", "T1x", "T2", "T3r", "T3x", "big", "inv"):
        ss = [s for s in seeds if cls[s] == k]
        print(f"    {k} {len(ss)}: {dict(collections.Counter(lv_def[s] for s in ss))}")

    # 段ごとの時間
    solve = {s: S[s].get("solve_sec", 0.0) + resurvey.get(s, 0.0) for s in seeds}
    survey_full = {s: S[s].get("sec", 0.0) for s in seeds}
    graph = {s: rows_def[s].get("graph_sec", 0.0) or 0.0 for s in seeds}
    trap = {s: rows_def[s].get("trap_sec", 0.0) or 0.0 for s in seeds}
    print("\n段ごとの時間（Python 1プロセス、4並列で流した値。秒）:")
    print(f"  解法器（survey の解法器の部分 solve_sec ＋ BC つきの解き直し {len(resurvey)} 件）: 合計 {sum(solve.values()):.0f}・"
          f"中央値 {statistics.median(solve.values()):.2f}・最大 {max(solve.values()):.1f}")
    print(f"  survey 全体（試すモデルの比べる用の量を含む）: 合計 {sum(survey_full.values()):.0f}")
    print(f"  網（4変種と段 T。graph_sec）: 合計 {sum(graph.values()):.0f}・中央値 {statistics.median([graph[s] for s in seeds if cls[s] != 'inv']):.2f}・"
          f"最大 {max(graph.values()):.1f}")
    for k in ("T1r", "T1x", "T2", "T3r", "T3x"):
        ss = [s for s in seeds if cls[s] == k]
        tt = [trap[s] for s in ss]
        if tt:
            print(f"  読むモデルと致命の手（trap_sec）{k} {len(ss)} 件: 合計 {sum(tt):.0f}・中央値 {statistics.median(tt):.2f}・"
                  f"p90 {_q(tt)[2]:.1f}・最大 {max(tt):.1f}")
    unres = [s for s in seeds if lv_def[s] == "oracle-unresolved"]
    print(f"  既定の上限で評価不能 {len(unres)} 件の振り分け: {dict(collections.Counter(cls[s] for s in unres))}・"
          f"trap_sec 合計 {sum(trap[s] for s in unres):.0f}")
    rerun = sorted(B)
    rerun_cost = {s: (B[s].get("graph_sec", 0) or 0) + (B[s].get("trap_sec", 0) or 0) for s in rerun if "error" not in B[s]}
    stopped = {50: 590.0}  # 590 秒の区切りの内に終わらず止めた（難易度の資料 §6）
    print(f"  上限5倍の2回目: 流し終えた {len(rerun_cost)} 件 合計 {sum(rerun_cost.values()):.0f} 秒"
          f"（中央値 {statistics.median(rerun_cost.values()):.0f}・最大 {max(rerun_cost.values()):.0f}）＋止めた 50 の 590 秒。"
          f"流していない {len(unres) - len(rerun_cost) - len(stopped)} 件")
    print("    流し終えた件の結果:", dict(collections.Counter(lv_big[s] for s in rerun_cost)),
          "・振り分け", dict(collections.Counter(cls[s] for s in rerun_cost)))
    def_tot = {s: graph[s] + trap[s] for s in seeds}
    ran = sorted(def_tot[s] for s in rerun_cost)
    notran = sorted(def_tot[s] for s in unres if s not in rerun_cost and s not in stopped)
    print(f"    既定の上限での時間: 流した件 {ran[0]:.0f}〜{ran[-1]:.0f} 秒・流していない件 {notran[0]:.0f}〜{notran[-1]:.0f} 秒")

    # 生成の仕方ごとの1問あたりの CPU 秒
    print("\n1問を得るのに要る CPU 秒（Python。400配りの合計 ÷ そのレベルの件数）:")
    T2s = [s for s in seeds if cls[s] == "T2"]
    T3s = [s for s in seeds if cls[s] == "T3r"]
    win = [s for s in seeds if cls[s] != "inv"]
    full_all = sum(survey_full.values()) + sum(graph[s] + trap[s] for s in win)
    base = sum(solve.values()) + sum(graph[s] for s in win)
    gate23 = sum(trap[s] for s in T2s)
    gate45 = sum(trap[s] for s in T3s)
    r23 = sum(rerun_cost.get(s, 0) + stopped.get(s, 0) for s in unres if cls[s] == "T2")
    r45 = sum(rerun_cost.get(s, 0) + stopped.get(s, 0) for s in unres if cls[s] == "T3r")
    cd = collections.Counter(lv_def.values())
    cb = collections.Counter(lv_big.values())
    print(f"  (A) 全候補をすべて分析（難易度の観点の求め方。survey 全体＋features_v7）: 400配りで {full_all:.0f} 秒")
    print(f"  (B) 段 T で振り分け、読むモデルは振り分けの合う候補だけ: 共通（解法器＋網）{base:.0f} 秒、"
          f"段2 の読むモデル {gate23:.0f} 秒、4変種とも段3 の読むモデル {gate45:.0f} 秒")
    print(f"  (C) (B) に上限5倍の2回目（流した分）: 段2 に {r23:.0f} 秒、段3 に {r45:.0f} 秒")
    per = {}
    for L in LEVELS:
        a = full_all / cd[L]
        extra = 0 if L == 1 else (gate23 if L in (2, 3) else gate45)
        b = (base + extra) / cd[L]
        rr = 0 if L == 1 else (r23 if L in (2, 3) else r45)
        c = (base + extra + rr) / cb[L]
        per[L] = (a, b, c)
        print(f"    L{L}: (A) {a:,.0f}・(B) そのレベルだけを狙う {b:,.0f}・(C) {c:,.0f}（件数 既定 {cd[L]}・2回目の後 {cb[L]}）")
    print("    （(B)(C) の読むモデルの時間は features_v7 の trap_sec で、比べる用の量を含む。minimal の比で縮む）")

    # 収率の幅（400配りの小ささ）
    print("\n収率の 95% 区間（Wilson。400配り）:")
    for name, c in (("既定の上限", cd), ("上限5倍の2回目の後", cb)):
        print(f"  {name}: " + "・".join(f"L{L} {100 * wilson(c[L], n)[0]:.1f}〜{100 * wilson(c[L], n)[1]:.1f}%" for L in LEVELS))

    # 件数ごとの生成時間
    print(f"\n件数ごとの生成時間（全レベルを1回の流れで集める。読むモデルは段 T の振り分けの合う候補だけで、そのレベルが埋まったら止める。"
          f"読むモデルと致命の手の時間は trap_sec × 段2 {ratio2}・段3 {ratio3}）:")
    plans = {
        "各100": dict.fromkeys(LEVELS, 100),
        "各200": dict.fromkeys(LEVELS, 200),
        "各300": dict.fromkeys(LEVELS, 300),
        "各500": dict.fromkeys(LEVELS, 500),
        "各1000": dict.fromkeys(LEVELS, 1000),
        "500/500/500/300/300": {1: 500, 2: 500, 3: 500, 4: 300, 5: 300},
    }
    c_base = base / n
    lv_mix = {s: (lv_big[s] if cls[s] == "T3r" else lv_def[s]) for s in seeds}
    cm = collections.Counter(lv_mix.values())
    # 流していない段3 の評価不能: 上限5倍で既定の5倍の時間がかかり、1問も決まらないとみなす（悲観）
    left45 = [s for s in unres if cls[s] == "T3r" and s not in rerun_cost and s not in stopped]
    pess45 = sum(5 * def_tot[s] for s in left45)
    print(f"  （段3 で流していない評価不能 {len(left45)} 件: 既定の上限で {sum(def_tot[s] for s in left45):.0f} 秒。悲観の見込みでは5倍の {pess45:.0f} 秒かかり、1問も決まらない）")
    policies = {
        "(i) 既定の上限だけ": ({L: cd[L] / n for L in LEVELS}, gate23 / n, gate45 / n),
        "(ii) 評価不能を上限5倍で流し直す（流した分）": ({L: cb[L] / n for L in LEVELS}, (gate23 + r23) / n, (gate45 + r45) / n),
        "(iii) 段3 の評価不能だけを上限5倍で流し直す（流した分）": ({L: cm[L] / n for L in LEVELS}, gate23 / n, (gate45 + r45) / n),
        "(iii') (iii) に流していない段3 の評価不能の悲観の時間を足す": ({L: cm[L] / n for L in LEVELS}, gate23 / n, (gate45 + r45 + pess45) / n),
    }
    for pname, (y, c23, c45) in policies.items():
        print(f"  {pname}:")
        for name, N in plans.items():
            n_all = max(N[L] / y[L] for L in LEVELS)
            n23 = max(N[2] / y[2], N[3] / y[3])
            n45 = max(N[4] / y[4], N[5] / y[5])
            bind = max(LEVELS, key=lambda L: N[L] / y[L])
            bind45 = 4 if N[4] / y[4] >= N[5] / y[5] else 5
            o23, o45 = n23 * c23 * ratio2, n45 * c45 * ratio3
            tot = n_all * c_base + o23 + o45
            part = f"共通 {fmt_h(n_all * c_base)}・段2 {fmt_h(o23)}・段3 {fmt_h(o45)}（L{bind45} が決める）"
            print(f"    {name}: 候補 {n_all:,.0f}（L{bind} が決める）・Python CPU {fmt_h(tot)} 時間（{part}）"
                  f"・TS 3倍速で {fmt_h(tot / 3)}・10倍速で {fmt_h(tot / 10)} CPU 時間")

    # --verify（問題集の全問を分析し直す）の時間
    print("\n--verify の見込み（問題集の全問を、決まったときの上限で分析し直す。Python。graph_sec＋trap_sec の平均 × 件数）:")
    for name, lvmap, rows in (("(i)", lv_def, rows_def), ("(iii)", lv_mix, rows_big)):
        means = {}
        for L in LEVELS:
            ss = [s for s in seeds if lvmap[s] == L]
            means[L] = statistics.mean((rows[s].get("graph_sec") or 0) + (rows[s].get("trap_sec") or 0) for s in ss)
        tot500 = sum(500 * means[L] * (1 if L == 1 else ratio2 if L in (2, 3) else ratio3) for L in LEVELS)
        print(f"  {name}: 1問の平均 " + "・".join(f"L{L} {means[L]:.1f}" for L in LEVELS) + f" 秒・各500問で {fmt_h(tot500)} CPU 時間")

    # 打ち切りの上限で決まるレベルの性質
    print("\n打ち切りの上限で決まった問題の特徴（既定の上限で決まった / 上限5倍で初めて決まった）:")
    for L in (4, 5):
        a = [s for s in seeds if lv_def[s] == L]
        b = [s for s in seeds if lv_big[s] == L and lv_def[s] != L]
        for key in ("G_lo_f_all_v7", "G_hi_b7_all_v7", "graph_full", "n_real_all_v7"):
            va = [rows_big[s].get(key) for s in a if rows_big[s].get(key) is not None]
            vb = [rows_big[s].get(key) for s in b if rows_big[s].get(key) is not None]
            print(f"  L{L} {key}: 既定 {len(a)} 件 {sorted(va)} / 5倍 {len(b)} 件 {sorted(vb)}")
        va = [rows_def[s].get("oracle_nodes") for s in a]
        vb = [rows_big[s].get("oracle_nodes") for s in b]
        print(f"  L{L} 読むモデルの局面数: 既定 中央値 {statistics.median(va):,.0f} / 5倍 中央値 {statistics.median(vb):,.0f}")
        ma = [S[s].get("moves") for s in a if S[s].get("moves") is not None]
        mb = [S[s].get("moves") for s in b if S[s].get("moves") is not None]
        print(f"  L{L} 解き筋の手数: 既定 {sorted(ma)} / 5倍 {sorted(mb)}")
    L5 = [s for s in seeds if lv_big[s] == 5]
    pairs = [(rows_big[s]["G_lo_f_all_v7"], (rows_def[s].get("oracle_nodes") or 0)) for s in L5]
    print("  L5（2回目の後）の G_lo_f と既定の上限での読むモデルの局面数の順位相関:",
          round(D.spearman([p[0] for p in pairs], [p[1] for p in pairs]), 2))

    # 静的な特徴で寄せる
    print("\n静的な特徴（配った時に分かる量）で候補を絞ったとき（400配り、上限5倍の2回目の後の分類）:")
    feats = ("kings_not_bottom", "buried_low", "self_block", "breaks", "stock_kings")
    for key in feats:
        vals = sorted({S[s].get(key) for s in seeds if S[s].get(key) is not None})
        for thr in vals:
            keep = [s for s in seeds if (S[s].get(key) or 0) >= thr]
            if len(keep) in (0, n) or len(keep) < 40:
                continue
            c = collections.Counter(lv_big[s] for s in keep)
            share = {L: (c[L] / len(keep)) / (cb[L] / n) if cb[L] else 0 for L in LEVELS}
            kept = {L: c[L] / cb[L] for L in LEVELS}
            if max(share[4], share[5]) < 1.25:
                continue
            print(f"  {key} ≥ {thr}: 残す候補 {len(keep)}・L1〜L5 {[c[L] for L in LEVELS]}・収率の倍率 "
                  + "/".join(f"{share[L]:.2f}" for L in LEVELS) + "・残るレベルの割合 "
                  + "/".join(f"{kept[L]:.2f}" for L in LEVELS))
    for L in LEVELS:
        ss = [s for s in seeds if lv_big[s] == L]
        print(f"  L{L} の静的な特徴（10/50/90）: " + "・".join(f"{k} {_q([S[s].get(k) for s in ss])}" for k in feats))

    # 遊ぶ人から見た件数（ランダム出題で新しい問題に当たる割合）
    print("\nランダム出題（全状態を対象、均等）で k 回遊んだ後、次の1問がまだ遊んでいない問題である確率:")
    for N in (100, 200, 300, 500, 1000):
        cells = []
        for k in (30, 60, 100, 200, 300):
            seen = N * (1 - (1 - 1 / N) ** k)
            cells.append(f"k={k}: {1 - seen / N:.0%}")
        print(f"  N={N}: " + "・".join(cells))


# ---------------------------------------------------------------------------
# minimal


def classify_minimal(seed, oracle_limit=40_000, oracle_budget=2_000_000, graph_limit=400_000, targets=LEVELS):
    """分類に要る量だけを求める（features_v7 と同じ関数を同じ順で呼び、比べる用の量を除く）。

    段 T（4変種）と安全な札をすぐ送る網の段を先に求め、読むモデル（label_graph）は、段2 で L2・L3 を狙うときと、
    4変種とも段3 で L4・L5 を狙うときだけ呼ぶ。戻り値: (分類, 段ごとの時間, 振り分け)。
    """
    tm = {}
    t0 = time.time()
    tab, stock = D.deal(seed)
    f = {"seed": seed, "status": "win"}
    graphs = {}
    for name, var in D.NAT_VARIANTS.items():
        g = D.natural_graph(tab, stock, var["empty"], var["pf"], graph_limit)
        graphs[name] = g
        T, _ = D.natural_class(g)
        f[f"T_all_{name}"] = T
    tm["graph"] = time.time() - t0
    k = t_class(f)
    gf = graphs["full"]
    t1 = time.time()
    need = (k == "T2" and bool({2, 3} & set(targets))) or (k == "T3r" and bool({4, 5} & set(targets)))
    if k in ("T2", "T3r"):
        sa = D.restrict_safe_all(gf)
        T_sa, _ = D.natural_class(sa)
        f["T_safeall_full"] = T_sa
    tm["safe_graph"] = time.time() - t1
    if need:
        t2 = time.time()
        oracle = D.AliveOracle(oracle_limit, oracle_budget, cache_unknown=True, bc=True)
        order, label, stuck, _ = D.label_graph(gf, oracle)
        tm["oracle"] = time.time() - t2
        t3 = time.time()
        res = D.fatal_depths_v7(gf, order, label, stuck, D._min_max_fnd(gf, order), extras=False)
        for key in V7_MAIN:
            f[f"{key}_all_v7"] = res[key]
        if f["T_safeall_full"] in (2, 3):
            oo = D._topo_order(sa)
            res = D.fatal_depths_v7(sa, oo, label, stuck, D._min_max_fnd(sa, oo), extras=False)
            for key in V7_MAIN:
                f[f"{key}_safe_v7"] = res[key]
        tm["fatal"] = time.time() - t3
        f["oracle_nodes"] = oracle.used
    tm["total"] = time.time() - t0
    return D.classify_v7(f), tm, k


def _minimal_worker(args):
    seed, kw = args
    c_min, tm, k = classify_minimal(seed, **kw)
    t0 = time.time()
    full = D.features_v7(seed)
    full_sec = time.time() - t0
    full["status"] = "win"
    c_full = D.classify_v7(full)
    return {"seed": seed, "class_min": list(c_min), "class_full": list(c_full), "t_class": k,
            "min_sec": {a: round(b, 3) for a, b in tm.items()}, "full_sec": round(full_sec, 3),
            "full_graph_sec": full.get("graph_sec"), "full_trap_sec": full.get("trap_sec")}


def pick_sample(cache, budget_sec=1300.0):
    """minimal の比べに使う配り方: L1・L4・L5（既定の上限）の全件、4変種で段が変わる段1・段3 の数件、
    段2 から既定の時間の順に均等に選んだもの。キャッシュの時間の合計が budget_sec ほどになるまで。"""
    S, rows_def, _, _, _ = _cache_rows(cache)
    sec = {s: (f.get("graph_sec") or 0) + (f.get("trap_sec") or 0) for s, f in rows_def.items()}
    lv = {s: lv_of(f) for s, f in rows_def.items()}
    cls = {s: t_class(f) for s, f in rows_def.items()}
    pick = [s for s in sorted(rows_def) if lv[s] in (1, 4, 5)]
    for k in ("T1x", "T3x"):
        ss = sorted((s for s in rows_def if cls[s] == k), key=lambda s: sec[s])
        pick += ss[:: max(1, len(ss) // 4)][:4]
    t2 = sorted((s for s in rows_def if cls[s] == "T2" and lv[s] != "oracle-unresolved" and sec[s] < 200), key=lambda s: sec[s])
    used = sum(sec[s] for s in pick)
    step = 3
    for s in t2[::step]:
        if used + sec[s] > budget_sec:
            continue
        pick.append(s)
        used += sec[s]
    return pick, used


def cmd_minimal(cache, out, procs, only):
    import multiprocessing as mp

    if only:
        seeds = [int(x) for x in only.split(",")]
    else:
        seeds, used = pick_sample(cache)
        print(f"選んだ {len(seeds)} 件（キャッシュの網と致命の手の時間の合計 {used:.0f} 秒）: {','.join(map(str, seeds))}", flush=True)
    done = set()
    if os.path.exists(out):
        with open(out, encoding="utf-8") as fh:
            done = {json.loads(line)["seed"] for line in fh if line.strip()}
    todo = [s for s in seeds if s not in done]
    _, rows_def, _, _, _ = _cache_rows(cache)
    todo.sort(key=lambda s: -((rows_def[s].get("graph_sec") or 0) + (rows_def[s].get("trap_sec") or 0)))
    t0 = time.time()
    with mp.Pool(procs) as pool, open(out, "a", encoding="utf-8") as fh:
        for i, row in enumerate(pool.imap_unordered(_minimal_worker, [(s, {}) for s in todo], chunksize=1)):
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            if (i + 1) % 10 == 0:
                print(f"{i + 1}/{len(todo)} {time.time() - t0:.0f}s", flush=True)
    print("done", len(todo), f"{time.time() - t0:.0f}s")


def cmd_mincmp(cache, path):
    _, rows_def, _, _, _ = _cache_rows(cache)
    R = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    print(f"minimal と features_v7 を同じプロセスで続けて流した {len(R)} 件")
    mism = [r["seed"] for r in R if r["class_min"] != r["class_full"] and r["class_min"][0] != "unsupported"]
    gated = [r for r in R if "oracle" not in r["min_sec"]]
    cache_mism = [r["seed"] for r in R if tuple(r["class_full"]) != D.classify_v7(rows_def[r["seed"]])]
    print("  分類が features_v7 と違う（読むモデルを呼ばずに範囲外と決めたものを除く）:", mism)
    print("  features_v7 の分類がキャッシュと違う:", cache_mism)
    print("  読むモデルを呼ばなかった:", len(gated), dict(collections.Counter(r["t_class"] for r in gated)),
          "・その分類（features_v7）:", dict(collections.Counter(lv_of_c(r["class_full"]) for r in gated)))
    by = collections.defaultdict(list)
    for r in R:
        by[r["t_class"]].append(r)
    tot_min = sum(r["min_sec"]["total"] for r in R)
    tot_full = sum(r["full_sec"] for r in R)
    print(f"  時間の合計: minimal {tot_min:.0f} 秒・features_v7 {tot_full:.0f} 秒（比 {tot_min / tot_full:.2f}）")
    for k, rr in sorted(by.items()):
        a = sum(r["min_sec"]["total"] for r in rr)
        b = sum(r["full_sec"] for r in rr)
        o = sum(r["min_sec"].get("oracle", 0) for r in rr)
        g = sum(r["min_sec"]["graph"] for r in rr)
        fa = sum(r["min_sec"].get("fatal", 0) for r in rr)
        ft = sum((r["full_trap_sec"] or 0) for r in rr)
        print(f"    {k} {len(rr)} 件: minimal {a:.0f} 秒（網 {g:.0f}・読むモデル {o:.0f}・致命の手 {fa:.0f}）・features_v7 {b:.0f} 秒"
              f"（trap_sec {ft:.0f}）・比 {a / b:.2f}・読むモデルの比 {o / ft if ft else float('nan'):.2f}")
    for L in LEVELS:
        rr = [r for r in R if r["class_full"] == ["classified", L]]
        if rr:
            a = sum(r["min_sec"]["total"] for r in rr)
            b = sum(r["full_sec"] for r in rr)
            print(f"    L{L} {len(rr)} 件: minimal {a:.0f}・features_v7 {b:.0f}・比 {a / b:.2f}")
    sec_now = sum(r["full_sec"] for r in R)
    sec_cache = sum((rows_def[r["seed"]].get("graph_sec") or 0) + (rows_def[r["seed"]].get("trap_sec") or 0) for r in R)
    print(f"  features_v7 の時間: 今回 {sec_now:.0f} 秒・キャッシュ {sec_cache:.0f} 秒（比 {sec_now / sec_cache:.2f}）")


def lv_of_c(c):
    return f"L{c[1]}" if c[0] == "classified" else c[1]


# ---------------------------------------------------------------------------
# poolsize


def cmd_poolsize(n, games_dir):
    rnd = random.Random(20261124)
    deals = []
    for _ in range(n):
        d = list(range(52))
        rnd.shuffle(d)
        tab, i = [], 0
        for m in range(1, 8):
            tab.append(tuple(d[i:i + m]))
            i += m
        deals.append((tuple(tab), tuple(d[28:])))
    for tab, stock in deals[:50]:
        assert decode_deal(encode_deal(tab, stock)) == (tab, stock)
    per = n // 5

    def measure(name, entry_fn):
        levels = {str(L): [entry_fn(i, deals[i]) for i in range((L - 1) * per, L * per)] for L in LEVELS}
        raw = json.dumps({"generatorVersion": "1", "levels": levels}, ensure_ascii=False, separators=(",", ":")).encode()
        gz = gzip.compress(raw, compresslevel=9, mtime=0)
        print(f"  {name}: JSON {len(raw):,} bytes・gzip {len(gz):,} bytes（1問あたり {len(raw) / n:.1f} / {len(gz) / n:.1f}）")

    rnd2 = random.Random(7)
    feats = [(rnd2.randint(0, 16), rnd2.randint(0, 16), rnd2.randint(7, 19), rnd2.randint(0, 4)) for _ in range(n)]
    print(f"{n} 問（各レベル {per} 問）の問題集の大きさ（区切りなしの JSON）:")
    measure("候補番号だけ [番号]", lambda i, d: [rnd.randint(0, 40000)])
    measure("札の並びの文字列だけ [52文字]", lambda i, d: [encode_deal(*d)])
    measure("並びの番号の base64url だけ [38文字]", lambda i, d: [lehmer_b64(*d)])
    measure("札の並びの文字列＋小さな整数4つ", lambda i, d: [encode_deal(*d), *feats[i]])
    measure("候補番号＋小さな整数4つ", lambda i, d: [rnd.randint(0, 40000), *feats[i]])
    print("既存ゲームの問題集（そのままの JSON と gzip）:")
    for g in sorted(os.listdir(games_dir)):
        p = os.path.join(games_dir, g, "problem", "problem-pool.json")
        if os.path.exists(p):
            raw = open(p, "rb").read()
            d = json.loads(raw)
            cnt = sum(len(v) for v in d["levels"].values())
            print(f"  {g}: {cnt} 問・JSON {len(raw):,}・gzip {len(gzip.compress(raw, compresslevel=9, mtime=0)):,} bytes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=("stats", "minimal", "mincmp", "poolsize"))
    ap.add_argument("--cache", default=".")
    ap.add_argument("--out", default="")
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--only", default="")
    ap.add_argument("--n", type=int, default=2500)
    ap.add_argument("--games-dir", default="")
    ap.add_argument("--ratio-t2", type=float, default=1.0)
    ap.add_argument("--ratio-t3", type=float, default=1.0)
    a = ap.parse_args()
    if a.cmd == "stats":
        cmd_stats(a.cache, a.ratio_t2, a.ratio_t3)
    elif a.cmd == "minimal":
        cmd_minimal(a.cache, a.out, a.procs, a.only)
    elif a.cmd == "mincmp":
        cmd_mincmp(a.cache, a.out)
    elif a.cmd == "poolsize":
        cmd_poolsize(a.n, a.games_dir)


if __name__ == "__main__":
    main()
