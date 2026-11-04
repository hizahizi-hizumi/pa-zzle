#!/usr/bin/env python3
"""箱入り娘 難易度の調査コード（/add-puzzle の調査・観点「難易度」）。

標準ライブラリだけで書く。4×5 の盤、駒は娘（2×2）・縦長（1×2）・横長（2×1）・小駒（1×1）。
1手 = 同じ駒の連続した移動（何マス・何回曲がっても1手）。娘の左上が行3・列1に着けばクリア。

やること
  1. 候補空間（駒の組 = 縦長・横長・小駒の数）ごとに、置き方を全部数え上げ、
     ゴールからの多始点 BFS で全状態の最短手数を求める。
  2. 最短解の DAG の上で、解き方の道筋に依らない特徴（最短解のうちの最小・最大）を求める。
  3. つまみの案（A〜E）ごとに、レベル1〜5 の仮の基準表で全候補を分類し、
     分布（B1/B2/B4）・数え方の変種（A3）・素朴な解き方（D1）・収率（E1/E3）・天井（D2）を出す。
  4. 採った案の seed ごとの結果を移植の期待値（.expected.json）に書く。

使い方
  python3 scripts/research/hakoiri_musume_difficulty.py                # 全部（4並列で数分）
  python3 scripts/research/hakoiri_musume_difficulty.py --quick        # 駒の組を間引いた確かめ用
  python3 scripts/research/hakoiri_musume_difficulty.py --write-expected  # 期待値を書き出す
  python3 scripts/research/hakoiri_musume_difficulty.py --check-expected  # 期待値と突き合わせる

結果は JSON で標準出力（--out で保存）。seed は SEED で固定。
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from collections import Counter, deque
from multiprocessing import Pool

SEED = 20261104
W, H = 4, 5
GOAL_RC = (3, 1)
# 駒の種類: 0=娘 1=縦長 2=横長 3=小駒
DIMS = {0: (2, 2), 1: (2, 1), 2: (1, 2), 3: (1, 1)}
POS: dict[int, list[tuple[int, int]]] = {}
MASK: dict[int, list[int]] = {}
ADJ: dict[int, list[list[int]]] = {}
for _t, (_h, _w) in DIMS.items():
    _ps = [(r, c) for r in range(H - _h + 1) for c in range(W - _w + 1)]
    POS[_t] = _ps
    _ix = {p: i for i, p in enumerate(_ps)}
    _ms = []
    for r, c in _ps:
        b = 0
        for a in range(_h):
            for d in range(_w):
                b |= 1 << ((r + a) * W + c + d)
        _ms.append(b)
    MASK[_t] = _ms
    ADJ[_t] = [
        [_ix[(r + dr, c + dc)] for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (r + dr, c + dc) in _ix]
        for r, c in _ps
    ]
GOAL_A = POS[0].index(GOAL_RC)

# 候補空間: (空き, 長い駒の数 = 縦長+横長, 小駒の数)。縦長と横長の分け方はすべて入れる。
FAMILY_SHAPES = [
    (2, 5, 4), (2, 6, 2), (2, 4, 6),
    (3, 5, 3), (3, 6, 1),
    (4, 5, 2), (4, 4, 4), (4, 6, 0),
    (5, 5, 1),
    (6, 5, 0), (6, 4, 2),
]
QUICK_SHAPES = [(2, 5, 4), (3, 5, 3), (4, 5, 2), (5, 5, 1), (6, 5, 0)]


def family(shapes):
    out = []
    for e, k, ns in shapes:
        for nV in range(k + 1):
            out.append((nV, k - nV, ns))
    return out


def empties(ps):
    nV, nH, ns = ps
    return 16 - 2 * (nV + nH) - ns


# ---------------------------------------------------------------- 盤面

def enumerate_states(nV, nH, ns):
    e = 16 - 2 * (nV + nH) - ns
    out = []
    pieces = []

    def rec(occ, i, cnt, ee):
        while i < 20 and occ >> i & 1:
            i += 1
        if i == 20:
            out.append(tuple(sorted(pieces)))
            return
        r, c = divmod(i, W)
        if ee:
            rec(occ | 1 << i, i + 1, cnt, ee - 1)
        for t in range(4):
            if not cnt[t]:
                continue
            hh, ww = DIMS[t]
            if r + hh > H or c + ww > W:
                continue
            pi = POS[t].index((r, c))
            m = MASK[t][pi]
            if occ & m:
                continue
            pieces.append((t, pi))
            cnt[t] -= 1
            rec(occ | m, i + 1, cnt, ee)
            cnt[t] += 1
            pieces.pop()

    if e < 0:
        return []
    rec(0, 0, [1, nV, nH, ns], e)
    return out


def neighbors(st):
    """1手（同じ駒の連続移動。曲がってよい）で行ける状態。"""
    occ = 0
    for t, p in st:
        occ |= MASK[t][p]
    res = set()
    for k, (t, p) in enumerate(st):
        free = ~occ | MASK[t][p]
        seen = {p}
        q = [p]
        m = MASK[t]
        adj = ADJ[t]
        while q:
            x = q.pop()
            for y in adj[x]:
                if y not in seen and not (m[y] & ~free):
                    seen.add(y)
                    q.append(y)
        seen.discard(p)
        for y in seen:
            n = list(st)
            n[k] = (t, y)
            res.add(tuple(sorted(n)))
    return res


def mirror(st):
    out = []
    for t, p in st:
        r, c = POS[t][p]
        w = DIMS[t][1]
        out.append((t, POS[t].index((r, W - w - c))))
    return tuple(sorted(out))


def board_rows(st):
    g = [["."] * W for _ in range(H)]
    letters = iter("bcdefghijklmnopqrstuvwxyz")
    for t, p in sorted(st, key=lambda tp: (POS[tp[0]][tp[1]], tp[0])):
        r, c = POS[t][p]
        ch = "A" if t == 0 else next(letters)
        hh, ww = DIMS[t]
        for a in range(hh):
            for d in range(ww):
                g[r + a][c + d] = ch
    return ["".join(x) for x in g]


def parse_rows(rows):
    cells = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != ".":
                cells.setdefault(ch, []).append((r, c))
    st = []
    for ch, v in cells.items():
        rs = [a for a, _ in v]
        cs = [b for _, b in v]
        hh, ww = max(rs) - min(rs) + 1, max(cs) - min(cs) + 1
        t = {(2, 2): 0, (2, 1): 1, (1, 2): 2, (1, 1): 3}[(hh, ww)]
        st.append((t, POS[t].index((min(rs), min(cs)))))
    return tuple(sorted(st))


# ---------------------------------------------------------------- 分析

def analyze_set(ps):
    """駒の組1つの全状態について、最短手数と特徴を返す。

    特徴（どれも最短解の DAG の上で、最短解の選び方に依らないよう最小（または最大）をとる）
      opt   最短手数
      bmin  娘の遠回りの回数: 娘の手のうち、娘の左上と (3,1) のマンハッタン距離が増える手の数（最短解の中の最小）
      bmax  同じ数の最大（A3: 道筋の選び方の変種）
      brow  娘が上へ戻る手の数（最小。A3: 遠回りの定義の変種。横へのよけを数えない）
      prep  準備の長さ: 娘を動かさずに続ける手の連続の最長（最短解の中の最小）
      prepf 同じ長さを「娘を出口へ近づける手」で区切ったもの（A3: 定義の変種）
      lmin  誘いの局面の数: 娘を出口へ近づける手があるのに、それが最短を縮めない局面の数（最小）
      lsum  同じ誘いを手の数で数えたもの（A3: 数え方の変種）
      dmv   娘を動かす手の数（最小。記録だけ）
      nopt  初手のうち最短手数を縮める手の数（入口の狭さ。記録だけ）
      branch 初手の合法手の数（1か所の重さ・入口の広さ。記録だけ）
    """
    nV, nH, ns = ps
    S = enumerate_states(nV, nH, ns)
    idx = {s: i for i, s in enumerate(S)}
    N = len(S)
    E = [[idx[n] for n in neighbors(s)] for s in S]
    apos = [s[0][1] for s in S]
    ar = [POS[0][p][0] for p in apos]
    ac = [POS[0][p][1] for p in apos]
    adist = [abs(ar[i] - GOAL_RC[0]) + abs(ac[i] - GOAL_RC[1]) for i in range(N)]
    # 連結成分
    comp = [-1] * N
    nc = 0
    for i in range(N):
        if comp[i] >= 0:
            continue
        comp[i] = nc
        q = [i]
        while q:
            u = q.pop()
            for v in E[u]:
                if comp[v] < 0:
                    comp[v] = nc
                    q.append(v)
        nc += 1
    # 最短手数（ゴールからの多始点 BFS）
    d = [-1] * N
    q = deque()
    for i in range(N):
        if apos[i] == GOAL_A:
            d[i] = 0
            q.append(i)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in E[u]:
            if d[v] < 0:
                d[v] = d[u] + 1
                q.append(v)
    INF = 10 ** 6
    f = {k: [0] * N for k in ("bmin", "bmax", "brow", "lmin", "lsum", "dmv", "prep", "prepf", "nopt")}
    front = [None] * N
    frontf = [None] * N

    def pareto(fr):
        fr = sorted(set(fr))
        pf = []
        best = INF
        for r, m in fr:
            if m < best:
                pf.append((r, m))
                best = m
        return pf, best

    for u in order:
        if d[u] == 0:
            front[u] = [(0, 0)]
            frontf[u] = [(0, 0)]
            continue
        du = d[u]
        tempt = 0
        for v in E[u]:
            if adist[v] < adist[u] and d[v] >= du:
                tempt += 1
        b1 = INF; b2 = -1; b3 = INF; l1 = INF; l2 = INF; dm = INF
        fr = []
        frf = []
        nopt = 0
        for v in E[u]:
            if d[v] != du - 1:
                continue
            nopt += 1
            back = 1 if adist[v] > adist[u] else 0
            up = 1 if ar[v] < ar[u] else 0
            dmove = apos[v] != apos[u]
            fwd = adist[v] < adist[u]
            b1 = min(b1, back + f["bmin"][v]); b2 = max(b2, back + f["bmax"][v])
            b3 = min(b3, up + f["brow"][v])
            l1 = min(l1, (1 if tempt else 0) + f["lmin"][v]); l2 = min(l2, tempt + f["lsum"][v])
            dm = min(dm, (1 if dmove else 0) + f["dmv"][v])
            for r, m in front[v]:
                fr.append((0, m) if dmove else (r + 1, max(m, r + 1)))
            for r, m in frontf[v]:
                frf.append((0, m) if fwd else (r + 1, max(m, r + 1)))
        front[u], f["prep"][u] = pareto(fr)
        frontf[u], f["prepf"][u] = pareto(frf)
        f["bmin"][u] = b1; f["bmax"][u] = b2; f["brow"][u] = b3
        f["lmin"][u] = l1; f["lsum"][u] = l2; f["dmv"][u] = dm; f["nopt"][u] = nopt
    f["branch"] = [len(x) for x in E]
    f["ar"] = ar
    return S, idx, E, d, comp, f


# ---------------------------------------------------------------- 案（仮の基準表）
# 空きの範囲は全案で同じ（合意: 易しいほど空きが多い、上は空き2）。隣のレベルと重ねる。
EMPTY_RANGE = {1: (4, 6), 2: (3, 6), 3: (2, 4), 4: (2, 3), 5: (2, 2)}
OPT_FLOOR = 8      # これより短いものは提供範囲外（軽すぎ）
OPT_CEIL = 90      # これより長いものは提供範囲外（長すぎ。合意の天井は横刀立馬 81 手くらい）

PLAN_DESC = {
    "A": "最短手数の帯 + 空きの範囲",
    "B": "娘の遠回りの回数の帯 + 空きの範囲",
    "C": "準備の長さ（娘を動かさずに続ける手の最長）の帯 + 空きの範囲",
    "D": "誘いの局面の数（娘を出口へ近づけられるが最短から外れる局面）の帯 + 空きの範囲",
    "E": "準備の長さの帯 + 娘の遠回りの回数の範囲 + 空きの範囲",
    "E0": "E の閾値違い（レベル2 の遠回りを 0〜1 回まで許す）。別の案ではなく E の境目の比較",
}
BANDS = {
    "A": ("opt", {1: (8, 15), 2: (16, 25), 3: (26, 40), 4: (41, 60), 5: (61, 90)}),
    "B": ("bmin", {1: (0, 0), 2: (1, 1), 3: (2, 2), 4: (3, 3), 5: (4, 99)}),
    "C": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
    "D": ("lmin", {1: (0, 0), 2: (1, 1), 3: (2, 2), 4: (3, 3), 5: (4, 99)}),
    "E": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
    "E0": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
}
BACK_RANGE = {
    "E": {1: (0, 1), 2: (1, 1), 3: (1, 2), 4: (2, 3), 5: (3, 99)},
    "E0": {1: (0, 1), 2: (0, 1), 3: (1, 2), 4: (2, 3), 5: (3, 99)},
}
PLANS = list(PLAN_DESC)
CHOSEN = "E"


def classify(plan, x, sub=None):
    """x: 特徴の dict。sub: 変種で置き換える特徴 {元: 先}。"""
    def g(k):
        if sub and k in sub:
            return x[sub[k]]
        return x[k]
    if x["opt"] < OPT_FLOOR:
        return "too-light"
    if x["opt"] > OPT_CEIL:
        return "too-long"
    key, bands = BANDS[plan]
    v = g(key)
    lvl = None
    for L, (lo, hi) in bands.items():
        if lo <= v <= hi:
            lvl = L
            break
    if lvl is None:
        return "unlisted-combination"
    lo, hi = EMPTY_RANGE[lvl]
    if not lo <= x["e"] <= hi:
        return "unlisted-combination"
    if plan in BACK_RANGE:
        lo, hi = BACK_RANGE[plan][lvl]
        if not lo <= g("bmin") <= hi:
            return "unlisted-combination"
    return lvl


# ---------------------------------------------------------------- 素朴な解き方（D1）
# 見えるのは盤面だけ（正しい手・残り手数は出ない）。待ったは使わない（使っても手数は減らない）。

def naive_play(kind, start, E, d, adist, rng, budget):
    u = start
    visited = {u}
    for step in range(1, budget + 1):
        nb = E[u]
        if kind == "random":
            v = rng.choice(nb)
        else:
            fresh = [v for v in nb if v not in visited]
            if kind == "greedy":
                fw = [v for v in fresh if adist[v] < adist[u]]
                pool = fw or fresh or nb
            else:  # explore
                pool = fresh or nb
            v = rng.choice(pool)
        u = v
        visited.add(u)
        if d[u] == 0:
            return step
    return None


NAIVE_KINDS = ("random", "greedy", "explore")
NAIVE_TRIALS = 3
NAIVE_BUDGET = 1000
SAMPLES_CHOSEN = 8
SAMPLES_OTHER = 1


# ---------------------------------------------------------------- 近い問題（E3）
PACK_RADIUS = 4       # この手数以内で行き来できる2問は近い問題とみなす
PACK_CAP_BALL = 1000  # 駒の組・レベルごとに数える上限（時間のため）
PACK_CAP_STRICT = 300


def pack(lst, E, d, radius, strict, cap):
    """lst の順に採り、採った問題から radius 手以内の状態を除く。
    strict では、採った問題の最短解の上にある状態（最短の子孫）と、
    採った問題を最短解の上に持つ状態（最短の祖先）も除く（解の後半が同じになるため）。"""
    blocked = set()
    picked = 0
    for i in lst:
        if i in blocked:
            continue
        picked += 1
        if picked >= cap:
            break
        frontier = [i]
        blocked.add(i)
        for _ in range(radius):
            nxt = []
            for u in frontier:
                for v in E[u]:
                    if v not in blocked:
                        blocked.add(v)
                        nxt.append(v)
            frontier = nxt
        if strict:
            for sign in (-1, 1):
                q = [i]
                seen = {i}
                while q:
                    u = q.pop()
                    for v in E[u]:
                        if d[v] == d[u] + sign and v not in seen:
                            seen.add(v)
                            q.append(v)
                blocked |= seen
    return picked


# ---------------------------------------------------------------- 1つの駒の組の処理

JOINT = ("opt", "bmin", "prep", "lmin", "branch", "e")
FEATS = ("opt", "bmin", "prep", "lmin", "dmv", "branch", "nopt", "ar", "e")


def process(args):
    ps, seed = args
    t0 = time.time()
    S, idx, E, d, comp, f = analyze_set(ps)
    t1 = time.time()
    e = empties(ps)
    N = len(S)
    rng = random.Random(f"{seed}:{ps}")
    acc = {p: {} for p in PLANS}
    status = {p: Counter() for p in PLANS}
    a3 = {p: Counter() for p in PLANS}
    mirror_mismatch = 0
    samples = {p: {} for p in PLANS}
    seen_n = {p: Counter() for p in PLANS}
    cand = 0
    chosen_idx = {}
    for i in range(N):
        if d[i] <= 0:
            continue
        mi = idx[mirror(S[i])]
        if mi < i:
            # 左右反転は同じ問題。特徴が一致するかだけ確かめる
            for k in ("bmin", "prep", "lmin", "bmax", "prepf"):
                if f[k][i] != f[k][mi]:
                    mirror_mismatch += 1
                    break
            continue
        cand += 1
        x = {k: f[k][i] for k in f}
        x["opt"] = d[i]
        x["e"] = e
        for p in PLANS:
            L = classify(p, x)
            status[p][L] += 1
            if not isinstance(L, int):
                continue
            a = acc[p].setdefault(L, {"n": 0, "comps": set(), "hist": {k: Counter() for k in FEATS},
                                      "joint": Counter()})
            a["n"] += 1
            a["joint"][tuple(x[k] for k in JOINT)] += 1
            if p == CHOSEN:
                chosen_idx.setdefault(L, []).append(i)
            a["comps"].add(comp[i])
            for k in FEATS:
                a["hist"][k][x[k]] += 1
            # A3: 数え方の変種
            subs = {
                "path-max": {"bmin": "bmax"} if p in ("B", "E", "E0") else None,
                "back-row": {"bmin": "brow"} if p in ("B", "E", "E0") else None,
                "prep-forward": {"prep": "prepf"} if p in ("C", "E", "E0") else None,
                "lure-sum": {"lmin": "lsum"} if p == "D" else None,
            }
            for name, sub in subs.items():
                if sub is None:
                    continue
                L2 = classify(p, x, sub)
                a3[p][(name, "n")] += 1
                if L2 != L:
                    a3[p][(name, "changed")] += 1
                    if not isinstance(L2, int):
                        a3[p][(name, "to_out")] += 1
                    elif abs(L2 - L) >= 2:
                        a3[p][(name, "far")] += 1
            # D1 の標本: (案, レベル, 駒の組) ごとに K 問を reservoir で（採った案は多めに）
            K = SAMPLES_CHOSEN if p == CHOSEN else SAMPLES_OTHER
            seen_n[p][L] += 1
            lst = samples[p].setdefault(L, [])
            if len(lst) < K:
                lst.append(i)
            else:
                j = int(rng.random() * seen_n[p][L])
                if j < K:
                    lst[j] = i
    # D1
    naive = {p: {} for p in PLANS}
    adist = [abs(POS[0][s[0][1]][0] - 3) + abs(POS[0][s[0][1]][1] - 1) for s in S]
    for p in PLANS:
        for L, lst in samples[p].items():
            naive[p][L] = []
            for i in sorted(lst):
                res = {}
                for kind in NAIVE_KINDS:
                    res[kind] = [naive_play(kind, i, E, d, adist, rng, NAIVE_BUDGET) for _ in range(NAIVE_TRIALS)]
                naive[p][L].append({"opt": d[i], "rows": board_rows(S[i]), "res": res, "ps": list(ps),
                                    "feat": {k: (d[i] if k == "opt" else e if k == "e" else f[k][i]) for k in FEATS}})
    # E3: 近い問題を除いたときに採れる数（採った案だけ）
    packing = {}
    for L, lst in chosen_idx.items():
        lst = list(lst)
        rng.shuffle(lst)
        packing[L] = {"ball": pack(lst, E, d, PACK_RADIUS, False, PACK_CAP_BALL),
                      "strict": pack(lst, E, d, PACK_RADIUS, True, PACK_CAP_STRICT)}
    # 成分ごとの最大最短手数
    cmax = Counter()
    for i in range(N):
        if d[i] > cmax[comp[i]]:
            cmax[comp[i]] = d[i]
    for p in PLANS:
        for L, a in acc[p].items():
            a["comps"] = len(a["comps"])
            a["hist"] = {k: dict(v) for k, v in a["hist"].items()}
            a["joint"] = dict(a["joint"])
    a3 = {p: {f"{k[0]}|{k[1]}": v for k, v in c.items()} for p, c in a3.items()}
    return {
        "ps": ps, "e": e, "states": N, "solvable": sum(1 for x in d if x >= 0), "cand": cand,
        "maxd": max(d), "comps_ge": {t: sum(1 for v in cmax.values() if v >= t) for t in (40, 60, 70, 80)},
        "acc": acc, "status": {p: {str(k): v for k, v in c.items()} for p, c in status.items()},
        "a3": a3, "packing": packing, "mirror_mismatch": mirror_mismatch, "naive": naive,
        "t_analyze": round(t1 - t0, 2), "t_total": round(time.time() - t0, 2),
    }


# ---------------------------------------------------------------- 集計

def pct(c, ps=(0, 10, 50, 90, 100)):
    items = sorted((int(k), v) for k, v in c.items())
    n = sum(v for _, v in items)
    if n == 0:
        return []
    out = []
    for p in ps:
        t = max(1, -(-n * p // 100)) if p > 0 else 1
        s = 0
        for v, k in items:
            s += k
            if s >= t:
                out.append(v)
                break
    return out


def spearman(joint, i, j):
    def ranks(col):
        c = Counter()
        for k, v in joint.items():
            c[k[col]] += v
        r = {}
        acc = 0
        for val in sorted(c):
            r[val] = acc + (c[val] + 1) / 2
            acc += c[val]
        return r
    ri, rj = ranks(i), ranks(j)
    n = sum(joint.values())
    if n == 0:
        return None
    mi = sum(ri[k[i]] * v for k, v in joint.items()) / n
    mj = sum(rj[k[j]] * v for k, v in joint.items()) / n
    cov = sum((ri[k[i]] - mi) * (rj[k[j]] - mj) * v for k, v in joint.items())
    vi = sum((ri[k[i]] - mi) ** 2 * v for k, v in joint.items())
    vj = sum((rj[k[j]] - mj) ** 2 * v for k, v in joint.items())
    if vi == 0 or vj == 0:
        return None
    return round(cov / (vi * vj) ** 0.5, 2)


def opt_bins(c):
    out = Counter()
    for o, v in c.items():
        b = (int(o) // 5) * 5
        out[f"{b:02d}-{b + 4:02d}"] += v
    return dict(sorted(out.items()))


def merge(results):
    summary = {}
    for p in PLANS:
        lv = {}
        for L in range(1, 6):
            n = 0; comps = 0; hist = {k: Counter() for k in FEATS}; sets = Counter(); by_e = {}
            for r in results:
                a = r["acc"][p].get(L) or r["acc"][p].get(str(L))
                if not a:
                    continue
                n += a["n"]; comps += a["comps"]; sets[str(r["ps"])] += a["n"]
                for k in FEATS:
                    hist[k].update({int(x): y for x, y in a["hist"][k].items()})
                be = by_e.setdefault(r["e"], {"opt": Counter(), "prep": Counter(), "bmin": Counter()})
                for k in ("opt", "prep", "bmin"):
                    be[k].update({int(x): y for x, y in a["hist"][k].items()})
            lv[L] = {
                "states": n, "components": comps, "sets_used": len(sets),
                "top_set_share": round(max(sets.values()) / n, 3) if n else None,
                "pct": {k: pct(hist[k]) for k in FEATS},
                "opt_hist5": opt_bins(hist["opt"]),
                "by_e_p50": {e: {k: pct(v[k], (50,))[0] for k in v} for e, v in sorted(by_e.items())},
            }
        st = Counter()
        a3 = Counter()
        for r in results:
            st.update(r["status"][p])
            a3.update(r["a3"][p])
        a3o = {}
        for key in a3:
            name, kind = key.split("|")
            if kind == "n":
                a3o[name] = {"n": a3[key], "changed": a3.get(f"{name}|changed", 0), "far": a3.get(f"{name}|far", 0),
                              "to_out": a3.get(f"{name}|to_out", 0)}
        # D1
        d1 = {}
        for L in range(1, 6):
            rows = [x for r in results for x in (r["naive"][p].get(L) or [])]
            out = {"samples": len(rows)}
            for kind in NAIVE_KINDS:
                tri = [(x["opt"], s) for x in rows for s in x["res"][kind]]
                ok3 = sum(1 for o, s in tri if s is not None and s <= 3 * o)
                okb = [s / o for o, s in tri if s is not None]
                out[kind] = {
                    "trials": len(tri),
                    "solved_within_3x_opt": round(ok3 / len(tri), 3) if tri else None,
                    "solved_within_budget": round(len(okb) / len(tri), 3) if tri else None,
                    "ratio_p50_when_solved": sorted(okb)[len(okb) // 2] if okb else None,
                }
            d1[L] = out
        # B4: 系統どうしの順位相関（その案で分類された全問）
        joint = Counter()
        for r in results:
            for L in range(1, 6):
                aa = r["acc"][p].get(L)
                if aa:
                    for k, v in aa["joint"].items():
                        joint[tuple(k) + (L,)] += v
        names = JOINT + ("level",)
        corr = {}
        for i1, i2 in ((0, 1), (0, 2), (1, 2), (0, 3), (2, 3), (4, 6), (5, 6), (0, 6), (1, 6), (2, 6)):
            corr[f"{names[i1]}~{names[i2]}"] = spearman(joint, i1, i2)
        # 最短手数をそろえた層（10手幅）の中での level との相関
        strata = {}
        for lo in range(10, 90, 10):
            sub = Counter({k: v for k, v in joint.items() if lo <= k[0] < lo + 10})
            if sum(sub.values()) > 100 and len({k[6] for k in sub}) > 1:
                strata[f"opt{lo}-{lo + 9}"] = {"n": sum(sub.values()),
                                               "levels": dict(sorted(Counter({k[6]: 0 for k in sub}).items())),
                                               "level_share": {L: round(sum(v for k, v in sub.items() if k[6] == L) / sum(sub.values()), 3)
                                                               for L in sorted({k[6] for k in sub})}}
                strata[f"opt{lo}-{lo + 9}"].pop("levels")
        pk = {}
        if p == CHOSEN:
            for L in range(1, 6):
                pk[L] = {kind: sum((r["packing"].get(L) or {}).get(kind, 0) for r in results) for kind in ("ball", "strict")}
        summary[p] = {"desc": PLAN_DESC[p], "levels": lv, "status": dict(st), "a3": a3o, "d1": d1,
                      "corr": corr, "opt_strata": strata, "packing": pk}
    return summary


def run(shapes, procs):
    fam = family(shapes)
    t = time.time()
    with Pool(procs) as pool:
        results = pool.map(process, [(ps, SEED) for ps in fam], chunksize=1)
    per_set = [{"ps": r["ps"], "e": r["e"], "states": r["states"], "cand": r["cand"], "maxd": r["maxd"],
                "comps_ge": r["comps_ge"], "mirror_mismatch": r["mirror_mismatch"],
                "t_analyze": r["t_analyze"], "t_total": r["t_total"], "packing_chosen": r["packing"],
                "levels_chosen": {str(L): (r["acc"][CHOSEN].get(L) or {}).get("n", 0) for L in range(1, 6)}}
               for r in results]
    plans = merge(results)
    return {"seed": SEED, "shapes": shapes, "elapsed_s": round(time.time() - t, 1),
            "per_set": per_set, "plans": plans, "picks": picks(results, plans), "_results": results}


def picks(results, plans):
    """流れ 7 の候補: 代表（特徴が中央値に近い）、境界（同じ空きで隣のレベル）、異常（最短手数が最小・最大）。
    採った案の D1 標本から選ぶ。"""
    lv = plans[CHOSEN]["levels"]
    by = {L: [x for r in results for x in (r["naive"][CHOSEN].get(L) or [])] for L in range(1, 6)}
    out = {"representative": {}, "boundary": {}, "anomaly": {}}
    for L, xs in by.items():
        if not xs:
            continue
        mo = lv[L]["pct"]["opt"][2]
        mp = max(1, lv[L]["pct"]["prep"][2])
        rep = min(xs, key=lambda x: (abs(x["feat"]["opt"] - mo) / mo + abs(x["feat"]["prep"] - mp) / mp, x["rows"]))
        out["representative"][L] = {"rows": rep["rows"], "feat": rep["feat"]}
        lo = min(xs, key=lambda x: (x["feat"]["opt"], x["rows"]))
        hi = max(xs, key=lambda x: (x["feat"]["opt"], x["rows"]))
        out["anomaly"][L] = {"shortest": {"rows": lo["rows"], "feat": lo["feat"]},
                             "longest": {"rows": hi["rows"], "feat": hi["feat"]}}
    for L in range(1, 5):
        best = None
        for a in by.get(L, []):
            for b in by.get(L + 1, []):
                if a["feat"]["e"] != b["feat"]["e"]:
                    continue
                key = (abs(a["feat"]["opt"] - b["feat"]["opt"]), a["rows"], b["rows"])
                if best is None or key < best[0]:
                    best = (key, a, b)
        if best:
            out["boundary"][f"{L}-{L + 1}"] = [{"level": L, "rows": best[1]["rows"], "feat": best[1]["feat"]},
                                               {"level": L + 1, "rows": best[2]["rows"], "feat": best[2]["feat"]}]
    return out


# ---------------------------------------------------------------- 期待値（採った案）

FIXTURES = {
    "easy-example": ["bAAc", "bAAc", "d..f", "dEEf", "g..h"],
    "outou-ritsuba": ["bAAc", "bAAc", "dEEf", "dghf", "i..j"],
}


EXPECTED_PER_SET_LEVEL = 3


def fixture_features(rows):
    st = parse_rows(rows)
    cnt = Counter(t for t, _ in st)
    ps = (cnt[1], cnt[2], cnt[3])
    S, idx, E, d, comp, f = analyze_set(ps)
    i = idx[st]
    x = {k: f[k][i] for k in ("bmin", "bmax", "brow", "prep", "prepf", "lmin", "lsum", "dmv", "branch", "nopt")}
    x["opt"] = d[i]
    x["e"] = empties(ps)
    return ps, x


def expected(out):
    res = out["_results"]
    fixtures = []
    for name, rows in FIXTURES.items():
        ps, x = fixture_features(rows)
        fixtures.append({"name": name, "pieces": ps, "rows": rows, "features": x, "level": classify(CHOSEN, x)})
    for r in res:
        for L in range(1, 6):
            for k, s in enumerate((r["naive"][CHOSEN].get(L) or [])[:EXPECTED_PER_SET_LEVEL]):
                fixtures.append({"name": f"sample-{r['ps']}-L{L}-{k}", "pieces": r["ps"], "rows": s["rows"],
                                 "features": s["feat"], "level": L})
    return {
        "seed": SEED,
        "plan": CHOSEN,
        "criteria": {"opt_floor": OPT_FLOOR, "opt_ceil": OPT_CEIL, "prep": BANDS[CHOSEN][1],
                     "bmin": BACK_RANGE[CHOSEN], "empties": EMPTY_RANGE},
        "per_set_counts": [{"pieces": r["ps"], "states": r["states"], "candidates_mirror_dedup": r["cand"],
                            "levels": {str(L): (r["acc"][CHOSEN].get(L) or {}).get("n", 0) for L in range(1, 6)},
                            "status": r["status"][CHOSEN],
                            "near_duplicate_packing": r["packing"]} for r in res],
        "packing_rule": {"radius": PACK_RADIUS, "cap_ball": PACK_CAP_BALL, "cap_strict": PACK_CAP_STRICT,
                         "order": "seed から作る乱数で候補を並べ替えた順"},
        "fixtures": fixtures,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--out")
    ap.add_argument("--write-expected", action="store_true")
    ap.add_argument("--check-expected", action="store_true")
    a = ap.parse_args()
    out = run(QUICK_SHAPES if a.quick else FAMILY_SHAPES, a.procs)
    exp_path = os.path.splitext(os.path.abspath(__file__))[0] + ".expected.json"
    if a.write_expected or a.check_expected:
        exp = json.loads(json.dumps(expected(out)))
        if a.write_expected:
            with open(exp_path, "w") as fh:
                json.dump(exp, fh, ensure_ascii=False, indent=1)
                fh.write("\n")
            print("wrote", exp_path, file=sys.stderr)
        else:
            with open(exp_path) as fh:
                old = json.load(fh)
            print("expected match:", old == exp, file=sys.stderr)
    out.pop("_results")
    s = json.dumps(out, ensure_ascii=False, indent=1)
    if a.out:
        with open(a.out, "w") as fh:
            fh.write(s)
    else:
        print(s)


if __name__ == "__main__":
    main()
