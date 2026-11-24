#!/usr/bin/env python3
"""魔方陣の難易度の調査コードの補助の集計（資料 魔方陣難易度.md の表を再現する）。

magic_square_difficulty.py の関数を呼ぶだけで、読むモデルや分類は持たない。標準ライブラリだけで書く。
分類は採った案（版 7 の C2: classify_v6 を版 7 の読みで、盤面の割り当て SIZES_V6。MSD_READ_VERSION=6 なら版 6）。
部品の組み合わせでの一致は、--cache の書き置き
（magic_square_difficulty.py agree で作る）を使い、無い分は測って書き足す。並べるプロセスは JOBS（3）。

サブコマンド:
  tables   corpus の結果から、B3・§11 の表・盤面ごとの D1・巡の分布・E1 の時間・E2・E3 の近い重複を出す
  wide     corpus の 5×5・6×6 の範囲内の問題に、空き5マスまでの交わる2本・空き4マスまでの3本の式・4本の式を当てる
  recheck  別の候補（{"id", "n" か "features": {"n"}, "givens"} の JSONL。反例探しの確かめ役の候補）を測り直す
  picks    classify の結果から、レベル × 盤面ごとの代表・最も弱い問題と範囲外の例を盤面と手順つきで書く（§7）
  four     範囲内の問題に、部品の3つ・4つの組み合わせを無作為に選んで当てる（一致を求めた2つより先の揺れ。--size）
  stack    classify の結果のうち基準で範囲内か reading-dependent・too-deep の問題に、版 5 の部品の1〜3つの組み合わせを
           全部当てて書く（続きから。--limit 件ずつ。版 5 の比較）
  stackopts stack の結果から、巡の上限と一致の求め方の案（余裕・組み合わせ・基準だけの上限）を比べる（資料 §4.4、版 5）
  designs-measure  版 5 の分類（classify --proposal C2v5）の結果のうち基準で範囲内か reading-dependent・too-deep の問題に、
           基準・版 5 の部品・A4 の4回目の向き・その一段先・2つの組（ぶつかる組は除く）を当てて特徴を書く（続きから）
  designs  designs-measure の結果から、版 6 の決め方（部品を足す・帯・梯子）を比べ、4回目の向きと一段先で動く割合を出す
  designs7 候補ごとに、版 7 の決め方（--design R: 基準の鎖を閉じるまで延ばす、A: 版 6 の読みのまま延ばす人を部品に足す）で
           範囲内か（部品の1〜2つの組み合わせまでの近似）を決め、範囲内に A4 の5回目の向きとその一段先を当てて書く
  designs7-sum  designs7 の結果ごとに、範囲内の件数と、5回目の向きとその一段先で動く割合を出す
           （版 7 の比べ合いの再現は MSD_READ_VERSION=7 で走らせる）
  designs8 候補ごとに、版 8 の決め方（V7: 版 7 のまま、L: 梯子 W3 と上下に余裕を取る帯、P: capL4f_late を部品に足す）で
           範囲内か（部品の1〜2つの組み合わせまでの近似）を決め、範囲内に A4 の6回目の向きとその一段先を当てて書く
  designs8-sum  designs8 の結果を決め方ごとに並べる（隣のレベルへ移るものと範囲外へ出るものを分ける）
  premises 範囲内の問題に、モデルの前提（PREMISES）をはずす向きの読み方を当て、上へ・下へ・範囲外へ動く数を出す
           （--compare なら、反例探しで見つかった系統（COMPARE）を当て、版ごとに同じ物差しで比べる行を出す）
  timing   生成条件ごとに候補を作り直し、生成と分類（部品と組み合わせの一致まで）の時間を測る
  l1       L1 と、段1だけで解けるが極小でない問題（not-minimal）を、遊ぶ人から見える量で比べる
"""

from __future__ import annotations

import argparse
import collections
import functools
import itertools
import json
import multiprocessing as mp
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import magic_square_difficulty as m  # noqa: E402


def five(xs):
    xs = sorted(xs)
    return " / ".join(f"{v:g}" for v in (xs[0], m.pct(xs, .1), m.pct(xs, .5), m.pct(xs, .9), xs[-1]))


JOBS = 3


def _classified(paths):
    ds = m.load(paths)
    m.refresh_features(ds)
    lv = [m.classify_v6(d, m.SIZES_V6) for d in ds]
    return ds, lv


def _steps(d):
    return m.read_solve(m.geo_of(d["n"]), d["givens"])["steps"]


def cmd_tables(a):
    ds, lr = _classified(a.inputs)
    lv = [x[0] for x in lr]
    by = {L: [d for d, x in zip(ds, lv) if x == L] for L in range(1, 6)}
    with mp.Pool(JOBS) as pool:
        st = pool.map(_steps, ds, chunksize=16)
    steps = {d["id"]: s for d, s in zip(ds, st)}
    print("## B3 いちばん重い単位の組の数・鎖の列の数の最大（10 / 50 / 90）")
    for L in range(2, 6):
        cm, ch = [], []
        for d in by[L]:
            hs = [s for s in steps[d["id"]] if s["tier"] >= 2]
            cm.append(max([max(s["combos"]) for s in hs if s["combos"]] or [0]))
            ch.append(max([s["chain"] for s in hs] or [0]))
        if cm:
            print(f"L{L} 組の数 {m.q3(cm)} | 鎖の列の数 {m.q3(ch)}")
    print("## §11 最小 / 10 / 50 / 90 / 最大")
    feats = [("空き", "empties"), ("与える数", "givens"), ("入口のマス", "entry"), ("最初の1マスの巡", "first_sweeps"),
             ("段2の所の巡の最大", "d2max"), ("段3の所の数", "t3"), ("組の突き合わせ", "hard"), ("絞り直し", "deep"),
             ("組の数を他で使わない", "lock")]
    print("| レベル | 件数 | " + " | ".join(k for k, _ in feats) + " | 慣れた試し置きの戻し | 手数 ÷ 空き |")
    for L in range(1, 6):
        g = by[L]
        if not g:
            continue
        ratio = [round(statistics.median(r[2] for r in d["naive"]["rp"]) / d["base"]["empties"], 1) for d in g]
        print(f"| {L} | {len(g)} | " + " | ".join(five([d["base"][k] for d in g]) for _, k in feats)
              + f" | {five([m._rp(d) for d in g])} | {five(ratio)} |")
    print("## 盤面ごとの D1（慣れた試し置きの戻し 10 / 50 / 90、1度も戻さずに解けた割合）")
    for L in range(1, 6):
        for n in (4, 5, 6):
            g = [d for d in by[L] if d["n"] == n]
            if g:
                first = statistics.fmean(m.naive_rate(d, "rp", lambda r: r[0] == 1 and r[1] == 0) for d in g)
                rn = statistics.fmean(m.naive_rate(d, "rn") for d in g)
                print(f"L{L} {n}×{n} {len(g)}問 戻し {m.q3([m._rp(d) for d in g])} 1度で {first:.2f} 無作為が上限内 {rn:.2f}")
    print("## 巡の分布（段2以上が要る問題。磨かない k=0〜2）: 段2の所の巡の最大・段3の所の巡の最大（fresh / cum）")
    for n in (4, 5, 6):
        g = [d for d in ds if d["n"] == n and d["k"] < 10 and 2 <= d["base"]["tier_max"] <= 3]
        if not g:
            continue
        c2 = collections.Counter(d["base"]["d2max"] for d in g)
        c3 = collections.Counter(d["base"]["d3max"] for d in g if d["base"]["t3"])
        c3c = collections.Counter(d["var"]["cum"]["d3max"] for d in g if d["var"]["cum"]["t3"])
        le = sum(1 for d in g if d["base"]["d2max"] <= m.DEPTH_CAP and d["base"]["d3max"] <= m.DEPTH_CAP) / len(g)
        lec = sum(1 for d in g if d["var"]["cum"]["d2max"] <= m.DEPTH_CAP and d["var"]["cum"]["d3max"] <= m.DEPTH_CAP) / len(g)
        print(f"{n}×{n} {len(g)}問 段2 {dict(sorted(c2.items()))} 段3 fresh {dict(sorted(c3.items()))} cum {dict(sorted(c3c.items()))}"
              f" | 上限内 fresh {le:.1%} cum {lec:.1%}")
    for n in (5, 6):
        g = [d for d, x in zip(ds, lr) if d["n"] == n and x[1] == "too-deep"]
        if g:
            print(f"too-deep {n}×{n} {len(g)}問 慣れた試し置きの戻しの中央値 {statistics.median(m._rp(d) for d in g):g}")
    print("## 範囲外の理由")
    print(dict(collections.Counter(x[1] for x in lr if x[1])))
    print("## E1 1問あたりの時間（当たる割合の上位3つ）・E2 生成条件の偏り")
    conds = collections.Counter((d["n"], d["T"], d["k"]) for d in ds)
    tsum = collections.Counter()
    for d in ds:
        tsum[(d["n"], d["T"], d["k"])] += d["t_square"] + d["t_reduce"] + d["t_read"]
    for L in range(1, 6):
        best = []
        for c, cnt in conds.items():
            k = sum(1 for d, x in zip(ds, lv) if x == L and (d["n"], d["T"], d["k"]) == c)
            if k:
                best.append((k / cnt, tsum[c] / k, c))
        best.sort(reverse=True)
        c2 = collections.Counter((d["n"], d["T"], d["k"]) for d in by[L])
        tot = sum(c2.values())
        if not tot:
            continue
        pol = sum(1 for d in by[L] if d["k"] >= 10)
        print(f"L{L} E1 " + ", ".join(f"{c[0]}×{c[0]} T{c[1]} k{c[2]} {r:.0%} {t:.2f}秒" for r, t, c in best[:3])
              + " | E2 " + ", ".join(f"{n}×{n} T{T} k{k} {v / tot:.0%}" for (n, T, k), v in c2.most_common(3))
              + f" | 磨いた候補 {pol / tot:.0%}")
    print("## E3 同じ魔方陣を使う組と、与える数の置き場所が2マス以内しか違わない組")
    near = same = 0
    for n in (4, 5, 6):
        canon = {}
        geo = m.geo_of(n)
        for d, x in zip(ds, lv):
            if not x or d["n"] != n:
                continue
            best = min((tuple(d["solution"][p.index(c)] for c in range(geo.N)),
                        tuple(d["givens"][p.index(c)] for c in range(geo.N))) for p in geo.symmetries())
            canon.setdefault(best[0], []).append(best[1])
        for items in canon.values():
            for p1, p2 in itertools.combinations(items, 2):
                same += 1
                if sum(1 for x, y in zip(p1, p2) if (x != 0) != (y != 0)) <= 2:
                    near += 1
    print(f"同じ魔方陣の組 {same}、うち置き場所が2マス以内しか違わない組 {near}")


WIDE = {"joint5": {"joint": 5}, "combo3u4": {"combo": 3}, "combo4": {"combo": 4}}
_COMBO = m.combo_units


def _wide(d):
    g = m.geo_of(d["n"])
    out = {}
    for k, kw in WIDE.items():
        m.combo_units = functools.partial(_COMBO, max_unknowns=4) if k == "combo3u4" else _COMBO
        out[k] = m.read_features(g, d["givens"], m.read_solve(g, d["givens"], **kw))
    m.combo_units = _COMBO
    return out


def cmd_wide(a):
    ds, lr = _classified(a.inputs)
    sel = [(d, x[0]) for d, x in zip(ds, lr) if x[0] and d["n"] >= 5]
    with mp.Pool(JOBS) as pool:
        res = pool.map(_wide, [d for d, _ in sel], chunksize=4)
    for k in WIDE:
        t = collections.Counter()
        for (d, lv), x in zip(sel, res):
            q = m.single_level_v6(x[k], d["n"], m.SIZES_V6, cap=None)[0]
            if q != lv:
                t[(lv, q)] += 1
        ch = sum(t.values())
        print(f"{k} {ch}/{len(sel)} ({ch / len(sel):.1%})", dict(t.most_common(6)))


def _refresh(d):
    return m._refresh_one(d)


def cmd_recheck(a):
    rows = [json.loads(line) for line in open(a.pool)]
    for d in rows:
        d["n"] = d.get("n") or d["features"]["n"]
    m.refresh_features(rows)
    lr = [m.classify_v6(d, m.SIZES_V6) for d in rows]
    cnt = collections.Counter(x[0] for x in lr)
    print(f"候補 {len(rows)}。版 6: " + ", ".join(f"L{L} {cnt[L]}" for L in range(1, 6))
          + f", 範囲外 {cnt[None]} {dict(collections.Counter(x[1] for x in lr if x[1]))}")
    print("| 変種 | 範囲内で変わった | 2段以上か範囲外へ | 主な動き |")
    print("|---|---|---|---|")
    for _, names in m.A3_GROUPS:
        for var in names:
            pairs = [(x[0], m.single_level_v6(d["var"][var], d["n"], m.SIZES_V6, cap=None)[0]) for d, x in zip(rows, lr) if x[0]]
            ch = sum(1 for x, y in pairs if x != y)
            ch2 = sum(1 for x, y in pairs if y is None or abs(x - y) >= 2)
            mv = collections.Counter((x, y) for x, y in pairs if x != y).most_common(4)
            print(f"| {var} | {ch}/{len(pairs)} ({ch / len(pairs):.1%}) | {ch2} | "
                  + ", ".join(f"L{x}→{'範囲外' if y is None else 'L' + str(y)} {k}" for (x, y), k in mv) + " |")
    if a.ids:
        print("| 例 | 基準のモデル（入口, 最初の段・巡, 段2の巡の最大, 段3の所の数） | 1つのモデルのレベル | 版 6 のレベル |")
        print("|---|---|---|---|")
        byid = {d["id"]: (d, x) for d, x in zip(rows, lr)}
        for e in a.ids:
            d, x = byid[e]
            b = d["base"]
            single = m.single_level_v6(b, d["n"], m.SIZES_V6)
            print(f"| {e} | ({b['entry']}, {b['first_tier']}・{b['first_sweeps']}, {b['d2max']}, {b['t3']}) | "
                  f"{single[0] or single[1]} | {x[0] if x[0] else x[1]} |")


def _grid(d):
    n = d["features"]["n"]
    g, s = d["givens"], d["solution"]
    return "\n".join(" ".join(f"{g[r * n + c]:>2}" if g[r * n + c] else " ." for c in range(n)) + "    "
                     + " ".join(f"{s[r * n + c]:>2}" for c in range(n)) for r in range(n))


def _trace(d):
    n = d["features"]["n"]
    res = m.read_solve(m.geo_of(n), d["givens"])
    parts = []
    for st in res["steps"]:
        cells = ",".join(f"({c // n},{c % n})={res['grid'][c]}" for c in st["cells"])
        parts.append(f"段{st['tier']}・{st['sweeps']}巡" + (f"・鎖（{st['chain']}本）" if st["chain"] >= 2 else "")
                     + ("・組の数を他で使わない" if st["lock"] else "")
                     + ("・この数はここだけ" if "hidden" in st["kinds"] else "") + f": {cells}")
    return parts


def _show(title, d):
    f = d["features"]
    print(f"#### {title}: `{d['id']}`（{f['n']}×{f['n']}、与える数 {f['givens']}・空き {f['empties']}）\n")
    print(f"- 特徴: 入口 {f['entry']}・最初の所 段{f['first_tier']}・{f['first_sweeps']}巡・段2の巡の最大 {f['d2max']}・"
          f"段3の所 {f['t3']}・突き合わせ {f['hard']}・鎖の最大 {f['chain_max']}本・慣れた試し置きの戻し {d['naive_rp_undos']:g}"
          + (f"・範囲外の理由 {d['reason']}" if d["reason"] else "") + "\n")
    print("```text\n" + _grid(d) + "\n```\n")
    print("- 手順（基準の読むモデル）: " + " / ".join(_trace(d)) + "\n")


def cmd_picks(a):
    rows = [json.loads(line) for line in open(a.classified)]
    keys = ("first_sweeps", "d2max", "t3", "hard", "chain_max")
    seen = set()
    for L in range(1, 6):
        g = [d for d in rows if d["level"] == L]
        for n in sorted({d["features"]["n"] for d in g}):
            gn = [d for d in g if d["features"]["n"] == n]
            med = {k: statistics.median(d["features"][k] for d in gn) for k in keys}
            mu = statistics.median(d["naive_rp_undos"] for d in gn)
            rep = min(gn, key=lambda d: (sum(abs(d["features"][k] - med[k]) for k in med)
                                         + abs(d["naive_rp_undos"] - mu) / max(mu, 1), d["id"]))
            weak = min(gn, key=lambda d: (d["naive_rp_undos"], d["features"]["hard"], d["id"]))
            for title, d in ((f"L{L} {n}×{n} 代表（{len(gn)}問の中央に近い）", rep),
                             (f"L{L} {n}×{n} 最も弱い（慣れた試し置きの戻しが最も少ない）", weak)):
                if d["id"] not in seen:
                    seen.add(d["id"])
                    _show(title, d)
    for reason in a.reasons:
        g = [d for d in rows if d["reason"] == reason]
        if g:
            _show(f"範囲外 {reason}", min(g, key=lambda d: (d["features"]["n"] != 5, d["id"])))


def _four_one(args):
    d, names = args
    geo = m.geo_of(d["features"]["n"])
    out = []
    for n in names:
        lv, why = m.combo_level(geo, d["givens"], n)
        if lv != d["level"]:
            out.append((n, f"L{lv}" if lv else why))
    return out


def cmd_four(a):
    """範囲内の問題（a.problems なら無作為にその数）に、部品の a.size 個の組み合わせ（ぶつかる組と、1つ少ない組と
    設定が同じ組を除く。設定は版 6 の重ね方）を無作為に a.k 通り（組み合わせの数より多ければ全部）当てる。"""
    import random
    rows = [json.loads(x) for x in open(a.classified)]
    acc = [d for d in rows if d["level"]]
    allf = []
    for t in itertools.combinations(m.AGREE, a.size):
        name = "+".join(t)
        kw = m.variant_kw(name, merge=True)
        if kw is not None and not any(kw == m.VARIANTS[x] for x in t) and all(
                m.variant_kw("+".join(u), merge=True) != kw for u in itertools.combinations(t, a.size - 1)):
            allf.append(name)
    pick = random.Random(a.seed).sample(allf, min(a.k, len(allf)))
    if a.problems:
        acc = random.Random(a.seed + 1).sample(acc, min(a.problems, len(acc)))
    with mp.Pool(JOBS) as pool:
        res = pool.map(_four_one, [(d, pick) for d in acc], chunksize=2)
    moved = [(d, r) for d, r in zip(acc, res) if r]
    cnt = collections.Counter(n for _, r in moved for n, _ in r)
    mv = collections.Counter((d["features"]["n"], d["level"]) for d, _ in moved)
    to = collections.Counter(f"L{d['level']}→{lv}" for d, r in moved for _, lv in r)
    parts = collections.Counter(p for _, r in moved for n, _ in r for p in n.split("+"))
    print(f"{a.size}つの組み合わせ {len(allf)} 通りから {len(pick)} 通り（seed {a.seed}）。範囲内 {len(acc)} のうち動いた問題 "
          f"{len(moved)}（{len(moved) / len(acc):.1%}）。盤面・レベル {dict(sorted(mv.items()))}")
    print("多い組:", cnt.most_common(8))
    print("動いた向き（組み合わせの数）:", dict(sorted(to.items())))
    print("動いた組に入る部品:", parts.most_common(12))
    for d, r in moved:
        print(" ", d["id"], f"L{d['level']}", len(r), "通り。例", r[:3])


def _l1_one(d):
    geo = m.geo_of(d["n"])
    g = d["givens"]
    out = {}
    for name, kw in (("基準", {}), ("viol1", m.VARIANTS["viol1"]), ("range1", m.VARIANTS["range1"])):
        r = m.read_solve(geo, g, max_tier=1, **kw)
        st = r["steps"]
        out[name] = (r["status"] == "solved", len(st), st[0]["found"] if st else 0)
    return out


def cmd_l1(a):
    """L1（段1で極小）と not-minimal（段1だけで解けるが極小でない）を、与える数・入口・段1の巡の回数・素朴な解き方で比べる。"""
    ds = m.load(a.inputs)
    m.refresh_features(ds, combos=False)
    lr = [m.classify_v6(d, m.SIZES_V6) for d in ds]
    grp = {"L1": [d for d, x in zip(ds, lr) if x[0] == 1],
           "not-minimal": [d for d, x in zip(ds, lr) if x[1] == "not-minimal"]}
    with mp.Pool(JOBS) as pool:
        meas = {k: pool.map(_l1_one, v) for k, v in grp.items()}
    for k, g in grp.items():
        if not g:
            continue
        print(f"{k} {len(g)}問: 与える数 {m.q3([d['base']['givens'] for d in g])}、空き {m.q3([d['base']['empties'] for d in g])}、"
              f"慣れた試し置きの戻し {m.q3([m._rp(d) for d in g])}、手数 ÷ 空き {m.q3([m.naive_med(d, 'rp', 2) / d['base']['empties'] for d in g])}")
        for name in ("基準", "viol1", "range1"):
            xs = [x[name] for x in meas[k]]
            print(f"  {name}: 入口のマス {m.q3([x[2] for x in xs])}、段1の置く回の数 {m.q3([x[1] for x in xs])}、"
                  f"入口が空きの半分を超える {sum(1 for x, d in zip(xs, g) if x[2] * 2 > d['base']['empties'])}/{len(g)}")


def _stack_one(d):
    n = d["features"]["n"]
    geo = m.geo_of(n)
    g = d["givens"]

    def rec(kw):
        f = m.read_features(geo, g, m.read_solve(geo, g, **kw))
        if n == 4:
            f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))
        lv, why = m.single_level_v4(f, n, m.SIZES_C2, cap=None)
        return [lv if lv else why, f["d2max"], f["d3max"]]
    return {"id": d["id"], "n": n, "k": d["k"], "base": rec({}),
            "c": {name: rec(m.variant_kw(name)) for name in m.AGREE_V5_COMBOS}}


def cmd_stack(a):
    rows = [json.loads(x) for x in open(a.classified)]
    sel = [d for d in rows if d["level"] or d["reason"] in ("reading-dependent", "too-deep")]
    done = {json.loads(x)["id"] for x in open(a.out)} if os.path.exists(a.out) else set()
    left = [d for d in sel if d["id"] not in done][:a.limit or None]
    with mp.Pool(JOBS) as pool, open(a.out, "a") as fo:
        for o in pool.imap(_stack_one, left, chunksize=1):
            fo.write(json.dumps(o, separators=(",", ":")) + "\n")
            fo.flush()
    print(f"{len(left)} 問を測った。残り {len(sel) - len(done) - len(left)}", file=sys.stderr)


def cmd_stackopts(a):
    rows = [json.loads(x) for x in open(a.stack)]
    canon = {frozenset(c.split("+")): c for c in m.AGREE_V5_COMBOS}
    for r in rows:  # 組み合わせの名前を AGREE_V5_COMBOS の並びにそろえる
        r["c"] = {canon.get(frozenset(k.split("+")), k): v for k, v in r["c"].items()}
    pairs = [c for c in m.AGREE_V5_COMBOS if c.count("+") == 1]
    triples = [c for c in m.AGREE_V5_COMBOS if c.count("+") == 2]

    def lvl(r, cap):
        lv, d2, d3 = r
        if not isinstance(lv, int):
            return lv
        return "too-deep" if cap is not None and (d2 > cap or d3 > cap) else lv

    def accept(r, items, cap_cmp, base_cap=m.DEPTH_CAP, margin=None):
        b = lvl(r["base"], base_cap)
        if not isinstance(b, int):
            return None
        for v in items:
            x = r["c"][v]
            if lvl(x, cap_cmp) != b or (margin is not None and max(x[1], x[2]) > margin):
                return None
        if margin is not None and max(r["base"][1], r["base"][2]) > margin:
            return None
        return b
    singles, singles21 = list(m.AGREE_V5), list(m.AGREE_V4)
    opts = [("21 の部品（版 4）、上限はどの部品でも 4", dict(items=singles21, cap_cmp=m.DEPTH_CAP)),
            ("24 の部品、上限はどの部品でも 4", dict(items=singles, cap_cmp=m.DEPTH_CAP)),
            ("24 の部品、どの部品でも巡 3 まで（余裕 1）", dict(items=singles, cap_cmp=m.DEPTH_CAP, margin=3)),
            ("24 の部品と2つの組、上限はどれでも 4", dict(items=singles + pairs, cap_cmp=m.DEPTH_CAP)),
            ("24 の部品と2つ・3つの組、上限はどれでも 4", dict(items=singles + pairs + triples, cap_cmp=m.DEPTH_CAP)),
            ("24 の部品、上限は基準だけ", dict(items=singles, cap_cmp=None)),
            ("24 の部品と2つ・3つの組、上限は基準だけ（版 5）", dict(items=singles + pairs + triples, cap_cmp=None)),
            ("24 の部品と2つ・3つの組、上限なし", dict(items=singles + pairs + triples, cap_cmp=None, base_cap=None))]
    print("| 案 | 範囲内 | L1 / L2 / L3 / L4 / L5 | 5×5 L4・L5 | 6×6 L4・L5 | 2つの組で動く | 2〜3つの組で動く |")
    print("|---|---|---|---|---|---|---|")
    for name, o in opts:
        acc = [(r, accept(r, **o)) for r in rows]
        acc = [(r, b) for r, b in acc if b]
        cnt = collections.Counter(b for _, b in acc)
        cn = collections.Counter((r["n"], b) for r, b in acc)
        cap = o["cap_cmp"]
        mv2 = sum(1 for r, b in acc if any(lvl(r["c"][c], cap) != b for c in pairs))
        mv3 = sum(1 for r, b in acc if any(lvl(r["c"][c], cap) != b for c in pairs + triples))
        print(f"| {name} | {len(acc)} | {' / '.join(str(cnt[L]) for L in range(1, 6))} | {cn[(5, 4)]}・{cn[(5, 5)]} | "
              f"{cn[(6, 4)]}・{cn[(6, 5)]} | {mv2}（{mv2 / len(acc):.1%}） | {mv3}（{mv3 / len(acc):.1%}） |")


# ---------------------------------------------------------------------------
# 版 6 の決め方の比較（資料 §4.4・§13.1）
# ---------------------------------------------------------------------------

D_NEW = ["short3_3", "short3_4", "jointk2_s1", "jointk2_s2", "mrange2", "mrange1", "chain_late", "pair1"]
D_SYSTEMS = {"A 組3〜4通りの空き3を段2": ["short3_3", "short3_4"], "B 交わる2本の組を段2": ["jointk2_s1", "jointk2_s2"],
             "C メモの上下限": ["mrange2", "mrange1"], "D 鎖を遅れてつなぐ": ["chain_late"], "E 組1通りの空き2を段1": ["pair1"]}
D_NEXT = {"A' 組5〜8通り": ["short3_5", "short3_6", "short3_8"], "B' 2本・入れ方3〜4通り": ["jointk2_s3", "jointk2_s4"],
          "B'' 3本の組を段2": ["jointk3_s1", "jointk3_s2"], "C' 空き2の列にも": ["mrange2e2"], "D' 鎖を2本ずつ": ["chain_late2"],
          "E' 残り8個以下": ["pair1_u8"]}


def _design_readings():
    """基準・版 5 の部品・4回目の向き・一段先・部品と4回目の向きの2つの組（ぶつかる組と変わらない組は除く）。"""
    items = list(m.AGREE_V5) + D_NEW
    R = {"base": {}}
    for v in items + [x for xs in D_NEXT.values() for x in xs]:
        R[v] = m.VARIANTS[v]
    for x, y in itertools.combinations(items, 2):
        kw = m.variant_kw(x + "+" + y)
        if kw is not None and not any(kw == m.VARIANTS[z] for z in (x, y)):
            R[x + "+" + y] = kw
    return R


_DR = _design_readings()


def _design_rec(geo, g, kw):
    def one(f):
        return [f["status"] == "solved", f["tier_max"], f["entry"], f["first_tier"], f["first_sweeps"], f["d2max"],
                f["t3"], f["d3max"]]
    out = one(m.read_features(geo, g, m.read_solve(geo, g, **kw)))
    if geo.n == 4:
        out.append(one(m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))))
    return out


def _design_one(d):
    geo = m.geo_of(d["features"]["n"])
    return {"id": d["id"], "n": d["features"]["n"], "k": d["k"], "T": d["T"], "rp": d["naive_rp_undos"],
            "minimal": d["reason"] != "not-minimal", "r": {k: _design_rec(geo, d["givens"], kw) for k, kw in _DR.items()}}


def cmd_designs_measure(a):
    rows = [json.loads(x) for x in open(a.classified)]
    sel = [d for d in rows if d["level"] or d["reason"] in ("reading-dependent", "too-deep")]
    done = {json.loads(x)["id"] for x in open(a.out)} if os.path.exists(a.out) else set()
    left = [d for d in sel if d["id"] not in done][:a.limit or None]
    with mp.Pool(JOBS) as pool, open(a.out, "a") as fo:
        for o in pool.imap(_design_one, left, chunksize=1):
            fo.write(json.dumps(o, separators=(",", ":")) + "\n")
            fo.flush()
    print(f"{len(_DR)} 通りの読み方で {len(left)} 問を測った。残り {len(sel) - len(done) - len(left)}", file=sys.stderr)


def _d_raw(rec, ladder):
    solved, tm, en, ft, fs, d2, t3, _ = rec[:8]
    if not solved:
        return "requires-trial"
    if tm >= 4:
        return "long-line"
    if tm == 1:
        return 1
    deep = d2 >= 2 or t3 >= 1
    if en:
        return 2 if not deep else "unlisted"
    if not deep:
        return 3
    if ladder == "V5":
        first = ft >= 3 or (ft == 2 and fs >= 2 and (d2 >= 3 or t3 >= 1))
    else:
        first = ft >= 3 or (ft == 2 and fs >= 2)
    return 5 if first else 4


def _d_level(r, k, ladder, sizes):
    rec = r["r"][k]
    lv = _d_raw(rec, ladder)
    if not isinstance(lv, int):
        return lv
    if r["n"] not in sizes[lv]:
        return "size"
    if r["n"] == 4:
        v = _d_raw(rec[8], ladder)
        if isinstance(v, int) and v < lv:
            return "virtual"
    return lv


def _d_base(r, ladder, band, sizes):
    lv = _d_level(r, "base", ladder, sizes)
    if not isinstance(lv, int):
        return None
    _, _, _, ft, fs, d2, t3, d3 = r["r"]["base"][:8]
    if d2 > m.DEPTH_CAP or d3 > m.DEPTH_CAP or (lv == 1 and not r["minimal"]):
        return None
    if band == "c45" and ((lv == 4 and t3 < 1) or (lv == 5 and not (ft == 3 and fs >= 3))):
        return None
    if band == "w45" and ((lv == 4 and not (t3 >= 1 or d2 >= 3)) or (lv == 5 and not ((ft == 3 and fs >= 2) or (ft == 2 and fs >= 3)))):
        return None
    if band == "w45b" and ((lv == 4 and not (t3 >= 1 or d2 >= 3)) or (lv == 5 and not ((ft == 3 and fs >= 3) or (ft == 2 and fs >= 3)))):
        return None
    return lv


def cmd_designs(a):
    rows = [json.loads(x) for x in open(a.feat)]
    sizes = m.SIZES_C2
    keys = list(rows[0]["r"])
    v5 = list(m.AGREE_V5)
    p24 = [k for k in keys if "+" in k and all(x in v5 for x in k.split("+"))]
    p32 = [k for k in keys if "+" in k]
    a24, a32 = v5 + p24, v5 + D_NEW + p32
    designs = [("版 5（梯子 V5、24 と2つの組）", "V5", None, a24),
               ("帯 c45（V5、24 と2つの組）", "V5", "c45", a24),
               ("梯子 W2（24 と2つの組）", "W2", None, a24),
               ("梯子 W2＋帯 w45（24 と2つの組）", "W2", "w45", a24),
               ("部品を足す（V5、32 と2つの組）", "V5", None, a32),
               ("帯 c45＋部品を足す（V5、32 と2つの組）", "V5", "c45", a32),
               ("梯子 W2＋部品を足す（32 と2つの組）", "W2", None, a32),
               ("梯子 W2＋帯 w45＋部品を足す（32 と2つの組。版 6）", "W2", "w45", a32),
               ("梯子 W2＋帯 w45b＋部品を足す（32 と2つの組）", "W2", "w45b", a32)]
    print(f"{len(rows)} 問（版 5 の基準で範囲内か reading-dependent・too-deep）。読み方 {len(keys)} 通り")
    print("| 案 | 範囲内 | L1 / L2 / L3 / L4 / L5 | 4×4 L2・5×5 L2 | 5×5 L4・6×6 L4 | 5×5 L5・6×6 L5 | 5系統（4回目） | "
          + " | ".join(D_SYSTEMS) + " | 一段先 | " + " | ".join(D_NEXT) + " |")
    print("|---" * (8 + len(D_SYSTEMS) + len(D_NEXT)) + "|")
    for name, ladder, band, agree in designs:
        acc = []
        for r in rows:
            lv = _d_base(r, ladder, band, sizes)
            if lv and all(_d_level(r, k, ladder, sizes) == lv for k in agree):
                acc.append((r, lv))
        c = collections.Counter(lv for _, lv in acc)
        cn = collections.Counter((r["n"], lv) for r, lv in acc)

        def moved(ks):
            k = sum(1 for r, lv in acc if any(_d_level(r, x, ladder, sizes) != lv for x in ks))
            return f"{k}（{k / len(acc):.1%}）"
        allsys = [x for xs in D_SYSTEMS.values() for x in xs]
        allnext = [x for xs in D_NEXT.values() for x in xs]
        print(f"| {name} | {len(acc)} | {' / '.join(str(c[L]) for L in range(1, 6))} | {cn[(4, 2)]}・{cn[(5, 2)]} | "
              f"{cn[(5, 4)]}・{cn[(6, 4)]} | {cn[(5, 5)]}・{cn[(6, 5)]} | {moved(allsys)} | "
              + " | ".join(moved(ks) for ks in D_SYSTEMS.values()) + f" | {moved(allnext)} | "
              + " | ".join(moved(ks) for ks in D_NEXT.values()) + " |")
    # 版 6 で残る B''（3本の組を段2で読む）の動き
    acc = [(r, _d_base(r, "W2", "w45", sizes)) for r in rows]
    acc = [(r, lv) for r, lv in acc if lv and all(_d_level(r, k, "W2", sizes) == lv for k in a32)]
    for k in D_NEXT["B'' 3本の組を段2"]:
        mv = collections.Counter((r["n"], lv, _d_level(r, k, "W2", sizes)) for r, lv in acc if _d_level(r, k, "W2", sizes) != lv)
        print(f"{k}: {sum(mv.values())} 問 " + ", ".join(f"{n}×{n} L{x}→{y} {v}" for (n, x, y), v in sorted(mv.items())))
    # 磨くときに確かめる読み方の選び方: 版 6 の帯に入る L4・L5 のうち一致で外れる問題を、読み方で貪欲に被覆する
    rej = []
    for r in rows:
        lv = _d_base(r, "W2", "w45", sizes)
        if lv in (4, 5):
            bad = {k for k in a32 if _d_level(r, k, "W2", sizes) != lv}
            if bad:
                rej.append(bad)
    left, chosen = list(range(len(rej))), []
    while left and len(chosen) < 10:
        best = max(a32, key=lambda k: sum(1 for i in left if k in rej[i]))
        cov = [i for i in left if best in rej[i]]
        chosen.append((best, len(cov)))
        left = [i for i in left if i not in cov]
    print(f"帯に入る L4・L5 で一致から外れる {len(rej)} 問の被覆: {chosen}、残り {len(left)}")


def _timing_one(d):
    import time
    t = time.time()
    lv, why = m.classify_givens(d["n"], d["givens"])
    return d["id"], lv, why, time.time() - t


def cmd_timing(a):
    """生成条件ごとに、corpus の候補の先頭 a.per 個を、問題を作るときの形（classify_givens。違う読み方が見つかった所で
    止める）で分類し直して時間を測る。1候補の時間 = 生成（魔方陣と極小化・磨き）＋一意性の確かめ＋分類。
    当たる割合は全候補の classify の結果（a.classified）から取り、1問あたりの時間 = 1候補の時間 ÷ 当たる割合。"""
    ds = m.load(a.inputs)
    cls = {json.loads(x)["id"]: json.loads(x) for x in open(a.classified)}
    by = collections.defaultdict(list)
    for d in ds:
        by[(d["n"], d["T"], d["k"])].append(d)
    sample = []
    for c in sorted(by):
        if a.conds and f"{c[0]}-{c[1]}-{c[2]}" not in a.conds:
            continue
        sample += sorted(by[c], key=lambda d: int(d["id"].rsplit("-", 1)[1]))[:a.per]
    with mp.Pool(JOBS) as pool:
        res = pool.map(_timing_one, sample, chunksize=1)
    t_cls = {i: t for i, _, _, t in res}
    same = sum(1 for i, lv, why, _ in res if (cls[i]["level"], cls[i]["reason"] if not cls[i]["level"] else None) == (lv, why if not lv else None))
    print(f"分類し直した {len(res)} 候補のうち、classify と同じレベル {sum(1 for i, lv, _, _ in res if cls[i]['level'] == lv)}"
          f"（範囲外の理由まで同じ {same}）")
    print("| 生成条件 | 候補 | 1候補の時間（生成 + 一意性 + 分類、秒） | L1 / L2 / L3 / L4 / L5 の当たる割合 | 1問あたりの時間（秒） |")
    print("|---|---:|---|---|---|")
    for c in sorted(by):
        g = by[c]
        smp = [d for d in g if d["id"] in t_cls]
        if not smp:
            continue
        gen = statistics.fmean(d["t_square"] + d["t_reduce"] for d in smp)
        ex = statistics.fmean(d["t_exact"] for d in smp)
        cl = statistics.fmean(t_cls[d["id"]] for d in smp)
        tot = gen + ex + cl
        hits = collections.Counter(cls[d["id"]]["level"] for d in g)
        rates = [hits[L] / len(g) for L in range(1, 6)]
        per = ", ".join(f"L{L} {tot / r:.1f}" for L, r in zip(range(1, 6), rates) if r)
        print(f"| {c[0]}×{c[0]} T{c[1]} k{c[2]} | {len(g)}（測った {len(smp)}） | {tot:.2f}（{gen:.2f} + {ex:.2f} + {cl:.2f}） | "
              + " / ".join(f"{r:.0%}" for r in rates) + f" | {per} |")


# 版 7 の決め方の比べ合い（A4 の5回目の向き A「鎖を空き3の列で延ばす」への直し方）
# R（本命）: 基準の鎖を閉じるまで延ばし（版 7 の読み）、延ばさない人・1回だけ延ばす人を部品にする
# A（代案）: 版 6 の読みのまま、空き3の列で延ばす人（閉じるまで・1回だけ）を部品に足す（MSD_READ_VERSION=6 で走らせる）
D7_PARTS = {"R": m.AGREE_V6 + ["tchain_none", "tchain3_1"], "A": m.AGREE_V6 + ["tchain3", "tchain3_1"]}
D7_NEXT = {"R": ["tchain3", "tchain4", "tchain3_2", "tchain4_1", "tchain_c0", "tchain2p", "dof3", "dof4"],
           "A": ["tchain4", "tchainA", "tchain3_2", "tchain4_1", "tchain_c0", "tchain2p", "dof3", "dof4"]}


def _d7_one(args):
    d, design = args
    n = d["n"]
    geo = m.geo_of(n)
    g = d["givens"]
    f = m.read_features(geo, g, m.read_solve(geo, g))
    if n == 4:
        f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4))
    out = {"id": d["id"], "n": n, "k": d["k"], "level": None, "reason": None, "moved": {}}
    lv, why = m.single_level_v6(f, n, m.SIZES_V6)
    if lv is None:
        out["reason"] = why
        return out
    if lv == 1 and not m.is_tier1_minimal(geo, g):
        out["reason"] = "not-minimal"
        return out
    why = m.band_reason(f, lv)
    if why:
        out["reason"] = why
        return out
    raw = m.single_level_v6(f, n, None, cap=None)[0]
    names = m.agree_combos(D7_PARTS[design], 2, merge=True, dedupe=True)
    for nm in names:
        if m.combo_level(geo, g, nm)[0] != raw:
            out["reason"] = "reading-dependent"
            out["bad"] = nm
            return out
    out["level"] = lv
    for nm in D7_NEXT[design]:
        x, w = m.combo_level(geo, g, nm)
        if x != raw:
            out["moved"][nm] = f"L{x}" if x else w
    return out


def cmd_designs7(a):
    """版 7 の決め方の比べ合い。候補ごとに、基準・帯・部品の1〜2つの組み合わせで範囲内かを確かめ（3つの組み合わせは
    当てない近似）、範囲内の問題に A4 の5回目の向きとその一段先を当てて書く。--design R は版 7 の読み、A は
    MSD_READ_VERSION=6 で走らせる。"""
    ds = m.load(a.inputs)
    with mp.Pool(JOBS) as pool:
        res = pool.map(_d7_one, [(d, a.design) for d in ds], chunksize=4)
    with open(a.out, "w") as fh:
        for r in res:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    acc = [r for r in res if r["level"]]
    print(f"{a.design}: 範囲内 {len(acc)}", dict(sorted(collections.Counter((r['n'], r['level']) for r in acc).items())))


# 版 8 の決め方の比べ合い（A4 の6回目）。V7 は版 7 のまま（梯子 W2・34 の部品）、L は梯子 W3 と上下に余裕を取る帯
# （本命）、P は W2 のまま、1巡の中で重ねる量に限りがある人（capL4f_late）を部品に足す（代案）。
D8 = {"V7": ("w2", m.AGREE), "L": ("w3", m.AGREE), "P": ("w2", m.AGREE + ["capL4f_late"])}
D8_NEXT = ["capL3f_late", "capL4f_late", "capL5f_late", "capL4f_diag", "memo6s_late", "memo8s_late", "memo10s_late",
           "memo8q_late", "memo4q_few_late", "memo4s", "memo4q", "lock_line", "lock_t2", "capall3", "capall4"]
_D8_NAMES: dict = {}


def _d8_names(design):
    if design not in _D8_NAMES:
        _D8_NAMES[design] = m.agree_combos(D8[design][1], 2, merge=True, dedupe=True)
    return _D8_NAMES[design]


def _d8_one(d):
    n = d["n"]
    geo = m.geo_of(n)
    g = d["givens"]
    cache: dict = {}

    def feats(name):
        if name not in cache:
            kw = m.variant_kw(name, merge=True) if name else {}
            f = m.read_features(geo, g, m.read_solve(geo, g, **kw))
            if n == 4:
                f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))
            cache[name] = f
        return cache[name]
    f0 = feats(None)
    out = {"id": d["id"], "n": n, "T": d["T"], "k": d["k"], "designs": {}}
    minimal = None
    for dn, (lad, _) in D8.items():
        r = {"level": None, "reason": None, "moved": {}}
        out["designs"][dn] = r
        lv, why = m.single_level_v6(f0, n, m.SIZES_V6, ladder=lad)
        if lv is None:
            r["reason"] = why
            continue
        if lv == 1:
            if minimal is None:
                minimal = m.is_tier1_minimal(geo, g)
            if not minimal:
                r["reason"] = "not-minimal"
                continue
        why = m.band_reason(f0, lv, lad)
        if why:
            r["reason"] = why
            continue
        raw = m.single_level_v6(f0, n, None, cap=None, ladder=lad)[0]
        bad = next((nm for nm in _d8_names(dn)
                    if m.single_level_v6(feats(nm), n, None, cap=None, ladder=lad)[0] != raw), None)
        if bad:
            r["reason"] = "reading-dependent"
            r["bad"] = bad
            continue
        r["level"] = lv
        for nm in D8_NEXT:
            x, w = m.single_level_v6(feats(nm), n, None, cap=None, ladder=lad)
            if x != raw:
                r["moved"][nm] = f"L{x}" if x else w
    return out


def cmd_designs8(a):
    """版 8 の決め方の比べ合い。候補ごとに、3つの決め方（V7・L・P）で、基準・帯・部品の1〜2つの組み合わせで範囲内かを
    確かめ（3つの組み合わせは当てない近似）、範囲内の問題に A4 の6回目の向きとその一段先を当てて書く。"""
    ds = m.load(a.inputs)
    with mp.Pool(JOBS) as pool:
        res = pool.map(_d8_one, ds, chunksize=2)
    with open(a.out, "w") as fh:
        for r in res:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    for dn in D8:
        acc = [r for r in res if r["designs"][dn]["level"]]
        print(f"{dn}: 範囲内 {len(acc)}", dict(sorted(collections.Counter((r['n'], r['designs'][dn]['level']) for r in acc).items())))


def cmd_designs8_sum(a):
    """designs8 の結果を、決め方ごとに並べる（--designs で選ぶ）。動いた問題は、隣のレベルへ移るもの（範囲内の別のレベル）と
    範囲外へ出るものに分ける。"""
    for path in a.results:
        rs = [json.loads(x) for x in open(path)]
        for dn in a.designs:
            acc = [r for r in rs if r["designs"][dn]["level"]]
            lv = collections.Counter(r["designs"][dn]["level"] for r in acc)
            nb = collections.Counter((r["n"], r["designs"][dn]["level"]) for r in acc)
            print(f"## {path} {dn}: 範囲内 {len(acc)}（L1〜L5 {[lv[L] for L in range(1, 6)]}、盤面 "
                  f"{dict(sorted(collections.Counter(r['n'] for r in acc).items()))}）")
            for nm in D8_NEXT:
                mv = [r for r in acc if nm in r["designs"][dn]["moved"]]
                lev = [r for r in mv if r["designs"][dn]["moved"][nm].startswith("L")]
                tr = collections.Counter(f"{r['n']}x{r['n']} L{r['designs'][dn]['level']}→{r['designs'][dn]['moved'][nm]}"
                                         for r in lev)
                print(f"- {nm}: {len(mv)}（{len(mv) / max(1, len(acc)):.1%}）、うち隣など別のレベルへ {len(lev)}"
                      f"（{len(lev) / max(1, len(acc)):.1%}） {dict(sorted(tr.items()))}")
            print("- 範囲外の理由:", dict(collections.Counter(r["designs"][dn]["reason"] for r in rs
                                                          if not r["designs"][dn]["level"])))
            print("- 盤面とレベル:", dict(sorted(nb.items())))


# 版 8: 定義が置いている前提（モデルの前提）ごとに、それをはずす向きの読み方。* は部品（範囲内では定義により 0%）
PREMISES = [
    ("P1 読む単位は列と、閉じるまで延ばした鎖", "強める（列をまたぐ組・段3の延長・順に決まらない組）",
     ["jointk2*", "joint3", "joint4", "combo2", "combo3", "jointk3d2", "tchain2p", "dof3", "dof4", "long3", "lin"]),
    ("P1 読む単位は列と、閉じるまで延ばした鎖", "弱める（鎖を読まない・分ける・延ばさない・遅らせる）",
     ["nochain", "chain2*", "chain3", "diag_nochain*", "chain_late*", "chain_late2", "tchain_none*", "tchain3_1*",
      "tchain3", "tchain4", "tchain3_2", "tchain4_1", "tchain_c0"]),
    ("P2 段はマスの数 − 式の数 + 1 で単位に付け、近道は要る所でだけ1つ上の段", "軽く数える（近道）",
     ["short3_4*", "short3_8", "jointk2_s2*", "jointk2_s4", "jointk3_s2", "pair1*", "jk2t2"]),
    ("P2 段はマスの数 − 式の数 + 1 で単位に付け、近道は要る所でだけ1つ上の段", "重く数える（長い鎖を段3）",
     ["chain4t3*", "chain3t3", "chaint3"]),
    ("P3 1巡の中では単位の台をメモの数に関わらず全部重ねる", "弱める（1巡の中で重ねる量に限り）",
     ["capL3f_late", "capL4f_late", "capL5f_late", "capL4f_diag", "memo6s_late", "memo8s_late", "memo10s_late",
      "memo8q_late", "memo4q_few_late", "memo4s", "memo4q"]),
    ("P4 1巡の結果は巡の終わりにまとめて効く（巡は読む順に依らない）", "遅らせる（次の巡から）",
     ["lock_next*", "hidden_next*", "lock_next_eph"]),
    ("P4 1巡の結果は巡の終わりにまとめて効く（巡は読む順に依らない）", "すぐ効かせる（読む順に依る）",
     ["seq_nat", "seq_rev", "seq_r1", "seq_r2", "seq_r3"]),
    ("P5 巡の間のメモに上限は無い（候補を全部覚える）", "弱める（書ける数・書く所を減らす）",
     ["memo4*", "memoryless*", "memo3", "hull4", "memo_line2"]),
    ("P5 巡の間のメモに上限は無い（候補を全部覚える）", "強める側の別案（上限を5・6に）", ["memo5", "memo6"]),
    ("P6 行き詰まりでは低い段から、どの段も行き詰まりの始めから巡を数える", "数え方・段の選び方を変える",
     ["carry*", "cum*", "fewest*", "esc_hi", "esc_lo"]),
    ("P7 組の数を他で使わないは、その巡に読んだ段2以上の単位のマスに当てる", "広げる", ["lock_all*"]),
    ("P7 組の数を他で使わないは、その巡に読んだ段2以上の単位のマスに当てる", "狭める",
     ["lock_eph*", "chain_nolock*", "lock_unique", "lock_line", "lock_t2", "nolock"]),
    ("P8 段1は空き1の列・候補1つのマス・この数はここだけ", "足す（上下限・組1通り）",
     ["range1*", "viol1*", "mrange1*", "mrange1e2", "pair1_memo"]),
    ("P8 段1は空き1の列・候補1つのマス・この数はここだけ", "減らす", ["nohidden*", "hidden2"]),
    ("P9 段は入れ方（組）の数に依らない", "組の多い単位を読まない", ["sets_cap3", "capall3", "capall4"]),
    ("P10 1巡で決まったマスは全部置く", "1つずつ置く", ["one*"]),
    ("P11 盤面の向きに依らない", "回転・裏返し", ["mirror"]),
]


# 版 6・版 7・版 8 を同じ物差しで比べる行（反例探しで見つかった系統。版は MSD_READ_VERSION で選ぶ）
COMPARE = [
    ("4回目 A 組3〜4通りの空き3の列を段2で読む", ["short3_3", "short3_4"]),
    ("4回目 B 空き3の列と交わる列の組を段2で読む", ["jointk2_s1", "jointk2_s2"]),
    ("4回目 C メモの最小・最大で上下限", ["mrange2", "mrange1"]),
    ("4回目 D 鎖を遅れてつなぐ", ["chain_late"]),
    ("4回目 E 組1通りの空き2の列を段1で読む", ["pair1"]),
    ("5回目 A 鎖を空き3の列で延ばす（閉じるまで・1回だけ）", ["tchain3", "tchain3_1"]),
    ("6回目 A 1巡目に候補8個を超える空き2の列を読まない（鎖は遅れてつなぐ）", ["capL4f_late"]),
    ("6回目 A 巡の中でも候補8個以下のマスにだけ書く（同）", ["memo8s_late"]),
    ("6回目 A の限り6・10", ["capL3f_late", "capL5f_late"]),
    ("6回目 B 巡の中でもメモ4つまで（範囲外へ出るだけ）", ["memo4s", "memo4q"]),
    ("6回目 B 組の数を他で使わないを同じ列だけ・空き3の列からしない（同）", ["lock_line", "lock_t2"]),
    ("6回目 B 組が3〜4通りを超える単位を読まない（同）", ["capall3", "capall4"]),
]


def _premise_one(args):
    d, names = args
    n = d["features"]["n"]
    geo = m.geo_of(n)
    g = d["givens"]
    f0 = m.read_features(geo, g, m.read_solve(geo, g))
    if n == 4:
        f0["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4))
    raw = m.single_level_v6(f0, n, None, cap=None)[0]
    out = {}
    for nm in names:
        if nm == "mirror":
            gm = m.rotate_givens(geo, g, geo.symmetries()[5])
            f = m.read_features(geo, gm, m.read_solve(geo, gm))
        else:
            kw = m.VARIANTS[nm]
            f = m.read_features(geo, g, m.read_solve(geo, g, **kw))
            if n == 4:
                f["_virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **kw))
        x, w = m.single_level_v6(f, n, None, cap=None)
        if x != raw:
            out[nm] = ("up" if x > raw else "down") if x else "out:" + w
    return d["id"], n, d["level"], out


def cmd_premises(a):
    """範囲内の問題（classify の結果）に、モデルの前提をはずす向きの読み方を当て、上へ・下へ・範囲外へ動く数を出す（版 8）。"""
    rows = [json.loads(x) for x in open(a.classified)]
    rows = [r for r in rows if r["level"]]
    if a.compare:
        names = list(dict.fromkeys(v for _, vs in COMPARE for v in vs))
    else:
        names = list(dict.fromkeys(v.rstrip("*") for _, _, vs in PREMISES for v in vs))
    with mp.Pool(JOBS) as pool:
        res = pool.map(_premise_one, [(r, names) for r in rows], chunksize=4)
    N = len(res)
    if a.compare:
        boards = collections.Counter(n for _, n, _, _ in res)
        print(f"版 {m.READ_VERSION}（梯子 {m.LADDER}）: 範囲内 {N} 問（盤面 {dict(sorted(boards.items()))}、"
              f"L1〜L5 {[sum(1 for x in res if x[2] == L) for L in range(1, 6)]}）")
        print("| 系統 | 読み方 | 部品か | 隣のレベルへ | 範囲外へ |")
        print("| --- | --- | --- | --- | --- |")
        for label, vs in COMPARE:
            for nm in vs:
                mv = [(n, L, o[nm]) for _, n, L, o in res if nm in o]
                nb = [x for x in mv if not x[2].startswith("out")]
                ot = [x for x in mv if x[2].startswith("out")]
                tr = collections.Counter(f"{n}×{n} L{L}{'↑' if d == 'up' else '↓'}" for n, L, d in nb)
                print(f"| {label} | `{nm}` | {'部品' if nm in m.AGREE else '測るだけ'} | {len(nb)}（{len(nb) / N:.1%}）"
                      f"{' ' + str(dict(sorted(tr.items()))) if tr else ''} | {len(ot)}（{len(ot) / N:.1%}） |")
        if a.out:
            with open(a.out, "w") as fh:
                for i, n, L, o in res:
                    fh.write(json.dumps({"id": i, "n": n, "level": L, "moved": o}, ensure_ascii=False) + "\n")
        return
    print(f"範囲内 {N} 問（盤面 {dict(sorted(collections.Counter(n for _, n, _, _ in res).items()))}）。"
          "上へ・下へは隣のレベルへ（入口があって深い所もある・試し置きなどは範囲外へ）")
    print("| 前提 | はずす向き | 読み方 | 上へ | 下へ | 範囲外へ |")
    print("| --- | --- | --- | ---: | ---: | --- |")
    for prem, way, vs in PREMISES:
        for v in vs:
            nm = v.rstrip("*")
            mv = [(i, n, L, o[nm]) for i, n, L, o in res if nm in o]
            up = sum(1 for x in mv if x[3] == "up")
            dn = sum(1 for x in mv if x[3] == "down")
            outs = collections.Counter(x[3][4:] for x in mv if x[3].startswith("out"))
            print(f"| {prem} | {way} | `{nm}`{'（部品）' if v.endswith('*') else ''} | {up} | {dn} | "
                  f"{sum(outs.values())} {dict(outs) if outs else ''} |")
    if a.out:
        with open(a.out, "w") as fh:
            for i, n, L, o in res:
                fh.write(json.dumps({"id": i, "n": n, "level": L, "moved": o}, ensure_ascii=False) + "\n")


def cmd_designs7_sum(a):
    """designs7 の結果（R・A）を並べる。"""
    for path in a.results:
        rs = [json.loads(x) for x in open(path)]
        acc = [r for r in rs if r["level"]]
        lv = collections.Counter(r["level"] for r in acc)
        moved = [r for r in acc if r["moved"]]
        print(f"## {path}: 範囲内 {len(acc)}（L1〜L5 {[lv[L] for L in range(1, 6)]}）。一段先のどれかで動く {len(moved)}"
              f"（{len(moved) / max(1, len(acc)):.1%}）")
        names = sorted({k for r in acc for k in r["moved"]} | set(D7_NEXT["R"]) | set(D7_NEXT["A"]))
        for nm in names:
            mv = [r for r in acc if nm in r["moved"]]
            if not any(nm in D7_NEXT[x] for x in ("R", "A")):
                continue
            to = collections.Counter(f"L{r['level']}→{r['moved'][nm]}" for r in mv)
            print(f"- {nm}: {len(mv)}（{len(mv) / max(1, len(acc)):.1%}） {dict(sorted(to.items()))}")
        bad = collections.Counter(r.get("bad") for r in rs if r.get("bad"))
        print("- 範囲外の理由:", dict(collections.Counter(r["reason"] for r in rs if not r["level"])))
        print("- 外した最初の組（多い順）:", bad.most_common(8))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(required=True)
    q = sub.add_parser("tables")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--cache")
    q.set_defaults(fn=cmd_tables)
    q = sub.add_parser("wide")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--cache")
    q.set_defaults(fn=cmd_wide)
    q = sub.add_parser("recheck")
    q.add_argument("pool")
    q.add_argument("--ids", nargs="*", default=[])
    q.add_argument("--cache")
    q.set_defaults(fn=cmd_recheck)
    q = sub.add_parser("four")
    q.add_argument("classified")
    q.add_argument("--k", type=int, default=300)
    q.add_argument("--seed", type=int, default=5)
    q.add_argument("--size", type=int, default=4)
    q.add_argument("--problems", type=int, default=0, help="範囲内から無作為に選ぶ問題の数（0 なら全部。seed は --seed + 1）")
    q.set_defaults(fn=cmd_four)
    q = sub.add_parser("stack")
    q.add_argument("classified")
    q.add_argument("--out", required=True)
    q.add_argument("--limit", type=int, default=0)
    q.set_defaults(fn=cmd_stack)
    q = sub.add_parser("stackopts")
    q.add_argument("stack")
    q.set_defaults(fn=cmd_stackopts)
    q = sub.add_parser("designs7")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--design", choices=["R", "A"], required=True)
    q.add_argument("--out", required=True)
    q.set_defaults(fn=cmd_designs7)
    q = sub.add_parser("designs8")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--out", required=True)
    q.set_defaults(fn=cmd_designs8)
    q = sub.add_parser("designs8-sum")
    q.add_argument("results", nargs="+")
    q.add_argument("--designs", nargs="+", default=["V7", "L", "P"])
    q.set_defaults(fn=cmd_designs8_sum)
    q = sub.add_parser("premises")
    q.add_argument("classified")
    q.add_argument("--out")
    q.add_argument("--compare", action="store_true", help="版を比べる行（COMPARE）だけを当てる")
    q.set_defaults(fn=cmd_premises)
    q = sub.add_parser("designs7-sum")
    q.add_argument("results", nargs="+")
    q.set_defaults(fn=cmd_designs7_sum)
    q = sub.add_parser("designs-measure")
    q.add_argument("classified")
    q.add_argument("--out", required=True)
    q.add_argument("--limit", type=int, default=0)
    q.set_defaults(fn=cmd_designs_measure)
    q = sub.add_parser("designs")
    q.add_argument("feat")
    q.set_defaults(fn=cmd_designs)
    q = sub.add_parser("timing")
    q.add_argument("inputs", nargs="+")
    q.add_argument("--classified", required=True)
    q.add_argument("--per", type=int, default=12)
    q.add_argument("--conds", nargs="*", default=[], help="n-T-k の形で生成条件を絞る")
    q.set_defaults(fn=cmd_timing)
    q = sub.add_parser("l1")
    q.add_argument("inputs", nargs="+")
    q.set_defaults(fn=cmd_l1)
    q = sub.add_parser("picks")
    q.add_argument("classified")
    q.add_argument("--reasons", nargs="*", default=["not-minimal", "too-deep", "unlisted-combination",
                                                    "virtual-shortcut", "reading-dependent"])
    q.set_defaults(fn=cmd_picks)
    a = ap.parse_args(argv)
    if getattr(a, "cache", None):
        m.load_agree_cache(a.cache)
    a.fn(a)


if __name__ == "__main__":
    main()
