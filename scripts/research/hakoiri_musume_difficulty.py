#!/usr/bin/env python3
"""箱入り娘 難易度の調査コード（/add-puzzle の調査・観点「難易度」）。

標準ライブラリだけで書く。4×5 の盤、駒は娘（2×2）・縦長（1×2）・横長（2×1）・小駒（1×1）。
1手 = 同じ駒の連続した移動（何マス・何回曲がっても1手）。娘の左上が行3・列1に着けばクリア。

やること
  1. 候補空間（駒の組 = 縦長・横長・小駒の数）ごとに、置き方を全部数え上げ、
     ゴールからの多始点 BFS で全状態の最短手数を求める。
  2. 最短解の DAG の上で、解き方の道筋に依らない特徴（最短解のうちの最小・最大）を求め、
     どんな長さの解でも崩れない準備の長さ（記録の更新で区切る rprep、後で超えない前進で区切る pprep）と娘の遠回り（adet）を求める。
  3. つまみの案（A〜G）ごとに、レベル1〜5 の仮の基準表で全候補を分類し、
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
    (2, 5, 4), (2, 6, 2), (2, 4, 6), (2, 3, 8), (2, 2, 10),
    (3, 5, 3), (3, 6, 1), (3, 4, 5), (3, 3, 7),
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


def board_text(st):
    """ゲームの盤面の20文字（`A` 娘、`v`/`w` 縦長、`h`/`i` 横長、`s` 小駒、`.` 空き）。"""
    g = ["."] * (W * H)
    for t, p in st:
        r, c = POS[t][p]
        i = r * W + c
        if t == 0:
            for a in (0, 1, W, W + 1):
                g[i + a] = "A"
        elif t == 1:
            g[i], g[i + W] = "v", "w"
        elif t == 2:
            g[i], g[i + 1] = "h", "i"
        else:
            g[i] = "s"
    return "".join(g)


def fnv(text):
    """ゲームの `hashProblemSeed`（FNV-1a 32bit）と同じ値。候補を見る順と左右反転の向きをゲームとそろえるのに使う。"""
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def chosen_orientation(seed, text, mirrored_text):
    first, second = sorted((text, mirrored_text))
    return first if fnv(f"{seed}:orientation:{first}") % 2 == 0 else second


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
    f["rprep"] = record_preparation(E, d, adist)
    peaks = slide_peaks(S, E)
    f["pprep"] = permanent_preparation(E, d, adist, peaks)
    f["adet"] = any_detour(E, d, adist)
    hprep, f["ldet"] = permanent_preparation_detour(E, d, adist, peaks)
    assert hprep == f["pprep"]
    f["sprep"], _ = permanent_preparation_detour(E, d, adist, peaks, max_counted=-1, shortest_only=True)
    f["jprep"], f["jdet"] = advance_preparation_detour(E, d, adist, peaks)
    f["jsprep"], _ = advance_preparation_detour(E, d, adist, peaks, max_counted=-1, shortest_only=True)
    return S, idx, E, d, comp, f


def record_preparation(E, d, adist):
    """準備の長さ（記録の更新で区切る、任意の長さの解での最小）。

    娘が出口の前へ今までで最も近づく手（距離が今までの最小を下回る手）を「前進」とし、前進と前進のあいだの手の数の最長を、
    どんな長さの解でもよく、最も小さくなる解で数える。距離 r の盤面の値は、距離 r 以上の盤面だけを通って、距離が r より小さい
    盤面へ動ける盤面 w までの手の数と、その先の値 c の max の最小。閾値 T を 0 から上げ、c が T の w を起点に足しながら
    起点からの手の数を幅優先で更新する。運べなければ -1。"""
    N = len(E)
    INF = 10 ** 9
    rp = [-1] * N
    for i in range(N):
        if d[i] == 0:
            rp[i] = 0
    for r in range(1, 5):
        steps = [INF] * N
        exits = {}
        for w in range(N):
            if adist[w] < r:
                continue
            best = INF
            for v in E[w]:
                if adist[v] < r and rp[v] >= 0 and rp[v] < best:
                    best = rp[v]
            if best < INF:
                exits.setdefault(best, []).append(w)
        pending = {i for i in range(N) if adist[i] == r and d[i] > 0}
        buckets = {}
        T = 0
        while pending and T < N:
            q = deque()
            for w in exits.get(T, ()):
                if steps[w] > 0:
                    steps[w] = 0
                    q.append(w)
            while q:
                u = q.popleft()
                su = steps[u]
                if adist[u] == r and u in pending and su <= T:
                    rp[u] = T
                    pending.discard(u)
                elif adist[u] == r and u in pending:
                    buckets.setdefault(su, []).append(u)
                for x in E[u]:
                    if adist[x] >= r and su + 1 < steps[x]:
                        steps[x] = su + 1
                        q.append(x)
            for u in buckets.pop(T, ()):
                if u in pending and steps[u] <= T:
                    rp[u] = T
                    pending.discard(u)
            T += 1
    return rp


def anchor_distance(p):
    r, c = POS[0][p]
    return abs(r - GOAL_RC[0]) + abs(c - GOAL_RC[1])


def slide_peaks(S, E):
    """辺ごとの、その1手で娘が通る位置の距離の最大（娘を動かさない手は -1）。ほかの駒を止めたまま娘の左上が動ける
    位置をたどり、始めから終わりへ行ける道のうち、通る距離の最大が最も小さい道の値を取る。"""
    out = []
    for u, nbrs in enumerate(E):
        st = S[u]
        a = st[0][1]
        occ = 0
        for t, p in st[1:]:
            occ |= MASK[t][p]
        row = []
        for v in nbrs:
            b = S[v][0][1]
            if a == b:
                row.append(-1)
                continue
            peak = max(anchor_distance(a), anchor_distance(b))
            while True:
                seen = {a}
                q = [a]
                while q:
                    x = q.pop()
                    for y in ADJ[0][x]:
                        if y not in seen and not (MASK[0][y] & occ) and anchor_distance(y) <= peak:
                            seen.add(y)
                            q.append(y)
                if b in seen:
                    break
                peak += 1
            row.append(peak)
        out.append(row)
    return out


def permanent_preparation(E, d, adist, peaks):
    """準備の長さ（後で超えない前進で区切る、任意の長さの解での最小）。

    娘の距離が今までの最小を下回り、その後の解で二度と上回らない手を「前進」とし、前進の手を除いた手を前進と前進のあいだで
    数えた最長を、どんな長さの解でもよく、最も小さくなる解で数える。前進した距離を上限として以後の距離を縛り、上限 c の区間を
    （盤面, 今までの最小の距離 r）の組の上でたどる。区間の始めの値は、r を下回る盤面へ前進できる組までの手の数と、その先の
    区間の値の max の最小で、閾値 T を 0 から上げて起点を足しながら幅優先で更新する。上限の小さい区間から順に求め、始めの盤面は
    上限 4、今までの最小をその盤面の距離として求める。1手の途中で娘が上限より遠い位置を通る手（peaks）は、その区間では
    使えない。運べなければ -1。"""
    N = len(E)
    INF = 10 ** 9
    K = 5
    pp = [-1] * N
    after = [-1] * N
    for i in range(N):
        if d[i] == 0:
            pp[i] = 0
            after[i] = 0
    for c in range(1, 5):
        last = c == 4
        steps = [INF] * (N * K)
        seeds = {}
        for u in range(N):
            if adist[u] > c:
                continue
            if d[u] == 0:
                for r in range(adist[u] + 1):
                    seeds.setdefault(0, []).append(u * K + r)
                continue
            for r in range(1, adist[u] + 1):
                best = INF
                for v, pk in zip(E[u], peaks[u]):
                    if adist[v] < r and after[v] >= 0 and after[v] < best and pk <= c:
                        best = after[v]
                if best < INF:
                    seeds.setdefault(best, []).append(u * K + r)
        pending = [i for i in range(N) if d[i] > 0 and (adist[i] <= c if last else adist[i] == c)]
        top = max(seeds) if seeds else -1
        T = 0
        while pending and T <= top:
            q = deque()
            for s in seeds.get(T, ()):
                if steps[s] != 0:
                    steps[s] = 0
                    q.append(s)
            while q:
                s = q.popleft()
                u, r = divmod(s, K)
                ns = steps[s] + 1
                for p, pk in zip(E[u], peaks[u]):
                    dp = adist[p]
                    if dp > c or dp < r or pk > c:
                        continue
                    hi_r = min(c, dp) if r == adist[u] else r
                    for pr in range(r, hi_r + 1):
                        t = p * K + pr
                        if ns < steps[t]:
                            steps[t] = ns
                            q.append(t)
            rest = []
            for i in pending:
                r = adist[i] if last else c
                if steps[i * K + r] <= T:
                    (pp if last else after)[i] = T
                else:
                    rest.append(i)
            pending = rest
            T += 1
        for i in pending:
            r = adist[i] if last else c
            if steps[i * K + r] < INF:
                (pp if last else after)[i] = steps[i * K + r]
    return pp


MAX_COUNTED_DETOUR = 2   # 遠回りを数えきる回数（基準表の遠回りの上限のうち、上限の無いものを除いた最大）
UNLIMITED_SLOT = MAX_COUNTED_DETOUR + 1


def permanent_preparation_detour(E, d, adist, peaks, max_counted=None, shortest_only=False):
    """準備の長さと、同じ解の上の遠回り（案 H）。

    permanent_preparation と同じ区間のたどり方に、遠回り（娘の距離が増える手）の残りの回数 b（0〜MAX_COUNTED_DETOUR）と、
    遠回りを縛らない枠を足し、枠ごとに準備の長さを求める。準備の長さは縛らない枠の値。遠回りは、準備の長さを最も小さくする
    解の中で最も少ない回数で、縛らない枠と同じ値になる最も少ない b（MAX_COUNTED_DETOUR を超えるなら MAX_COUNTED_DETOUR + 1）。
    運べなければどちらも -1。shortest_only なら最短手数が1つ減る手だけをたどり、最短の解だけで数える（案 I の sprep）。"""
    N = len(E)
    INF = 10 ** 9
    K = 5
    if max_counted is None:
        max_counted = MAX_COUNTED_DETOUR
    unlimited = max_counted + 1
    B = unlimited + 1

    def usable(a, b):
        return not shortest_only or d[b] == d[a] - 1

    pp = [-1] * (N * B)
    after = [-1] * (N * B)
    for i in range(N):
        if d[i] == 0:
            for b in range(B):
                pp[i * B + b] = 0
                after[i * B + b] = 0
    for c in range(1, 5):
        last = c == 4
        steps = [INF] * (N * K * B)
        seeds = {}
        for u in range(N):
            if adist[u] > c:
                continue
            if d[u] == 0:
                for r in range(adist[u] + 1):
                    for b in range(B):
                        seeds.setdefault(0, []).append((u * K + r) * B + b)
                continue
            for r in range(1, adist[u] + 1):
                for b in range(B):
                    best = INF
                    for v, pk in zip(E[u], peaks[u]):
                        av = after[v * B + b]
                        if adist[v] < r and av >= 0 and av < best and pk <= c and usable(u, v):
                            best = av
                    if best < INF:
                        seeds.setdefault(best, []).append((u * K + r) * B + b)
        pending = [i * B + b for i in range(N) if d[i] > 0 and (adist[i] <= c if last else adist[i] == c)
                   for b in range(B)]

        def start_state(pair):
            i, b = divmod(pair, B)
            return ((i * K) + (adist[i] if last else c)) * B + b

        top = max(seeds) if seeds else -1
        T = 0
        while pending and T <= top:
            q = deque()
            for s in seeds.get(T, ()):
                if steps[s] != 0:
                    steps[s] = 0
                    q.append(s)
            while q:
                s = q.popleft()
                ur, b = divmod(s, B)
                u, r = divmod(ur, K)
                ns = steps[s] + 1
                for p, pk in zip(E[u], peaks[u]):
                    dp = adist[p]
                    if dp > c or dp < r or pk > c or not usable(p, u):
                        continue
                    pb = b
                    if b != unlimited:
                        pb = b + (1 if adist[u] > dp else 0)
                        if pb > max_counted:
                            continue
                    hi_r = min(c, dp) if r == adist[u] else r
                    for pr in range(r, hi_r + 1):
                        t = (p * K + pr) * B + pb
                        if ns < steps[t]:
                            steps[t] = ns
                            q.append(t)
            rest = []
            for pair in pending:
                if steps[start_state(pair)] <= T:
                    (pp if last else after)[pair] = T
                else:
                    rest.append(pair)
            pending = rest
            T += 1
        for pair in pending:
            st = steps[start_state(pair)]
            if st < INF:
                (pp if last else after)[pair] = st
    prep = [pp[i * B + unlimited] for i in range(N)]
    det = []
    for i in range(N):
        if prep[i] < 0:
            det.append(-1)
            continue
        b = 0
        while b < unlimited and pp[i * B + b] != prep[i]:
            b += 1
        det.append(b)
    return prep, det


def advance_preparation_detour(E, d, adist, peaks, max_counted=None, shortest_only=False):
    """準備の長さと、同じ解の上の遠回り（案 J）。運べなければどちらも -1。

    前進は、娘の距離を減らし、直前の前進の距離（始めは始めの盤面の距離）を下回り、その後の解で（滑りの途中を含めて）二度と
    上回らない手。区間は上限 limit としきい値 threshold で決まり、距離 c へ前進した後の区間はどちらも c、始めの区間は上限 4・
    しきい値が始めの距離。遠回りの残りの回数の枠は permanent_preparation_detour と同じ。shortest_only なら最短の解だけで数える。
    娘を続けて動かすのは同じ1手なので、解の上で娘の手（辺）を続けて2つ使わない。状態に直前の手が娘の手か（f）を持つ。
    娘の続けての移動はグラフの1辺に含まれるので、これで失う解は無い。前進は娘の手なので、前進した直後は f = 1。"""
    N = len(E)
    INF = 10 ** 9
    if max_counted is None:
        max_counted = MAX_COUNTED_DETOUR
    unlimited = max_counted + 1
    B = unlimited + 1

    def usable(a, b):
        return not shortest_only or d[b] == d[a] - 1

    def key(i, f, b):
        return (i * 2 + f) * B + b

    pp = [-1] * (N * 2 * B)
    after = [-1] * (N * 2 * B)
    for i in range(N):
        if d[i] == 0:
            for f in range(2):
                for b in range(B):
                    after[key(i, f, b)] = 0

    def segment(limit, threshold, starts, values):
        steps = [INF] * (N * 2 * B)
        seeds = {}
        for u in range(N):
            if adist[u] > limit or d[u] <= 0:
                continue
            for b in range(B):
                best = INF
                for v, pk in zip(E[u], peaks[u]):
                    av = after[key(v, 1, b)]
                    if adist[v] < threshold and adist[v] < adist[u] and av >= 0 and av < best and pk <= limit and usable(u, v):
                        best = av
                if best < INF:
                    seeds.setdefault(best, []).append(key(u, 0, b))
        pending = [key(i, f, b) for i in starts for f in range(2) for b in range(B)]
        top = max(seeds) if seeds else -1
        T = 0
        while pending and T <= top:
            q = deque()
            for st in seeds.get(T, ()):
                if steps[st] != 0:
                    steps[st] = 0
                    q.append(st)
            while q:
                st = q.popleft()
                uf, b = divmod(st, B)
                u, f = divmod(uf, 2)
                ns = steps[st] + 1
                for p, pk in zip(E[u], peaks[u]):
                    moves_daughter = 1 if pk >= 0 else 0
                    if moves_daughter != f:
                        continue
                    if adist[p] > limit or d[p] <= 0 or pk > limit or not usable(p, u):
                        continue
                    pb = b
                    if b != unlimited:
                        pb = b + (1 if adist[u] > adist[p] else 0)
                        if pb > max_counted:
                            continue
                    for pf in ((0,) if moves_daughter else (0, 1)):
                        t = key(p, pf, pb)
                        if ns < steps[t]:
                            steps[t] = ns
                            q.append(t)
            rest = []
            for pair in pending:
                if steps[pair] <= T:
                    values[pair] = T
                else:
                    rest.append(pair)
            pending = rest
            T += 1
        for pair in pending:
            if steps[pair] < INF:
                values[pair] = steps[pair]

    def boards_at(c):
        return [i for i in range(N) if d[i] > 0 and adist[i] == c]

    for c in range(1, 4):
        segment(c, c, boards_at(c), after)
    for c in range(1, 5):
        segment(4, c, boards_at(c), pp)
    prep = []
    det = []
    for i in range(N):
        if d[i] == 0:
            prep.append(0); det.append(0); continue
        u = pp[key(i, 0, unlimited)]
        prep.append(u)
        if u < 0:
            det.append(-1); continue
        b = 0
        while b < unlimited and pp[key(i, 0, b)] != u:
            b += 1
        det.append(b)
    return prep, det


def any_detour(E, d, adist):
    """娘の遠回り（任意の長さの解での最小）。出口の前から逆にたどる 0-1 の幅優先探索。運べなければ -1。"""
    N = len(E)
    INF = 10 ** 9
    dt = [INF] * N
    q = deque()
    for i in range(N):
        if d[i] == 0:
            dt[i] = 0
            q.append(i)
    while q:
        v = q.popleft()
        for x in E[v]:
            w = 1 if adist[v] > adist[x] else 0
            if dt[v] + w < dt[x]:
                dt[x] = dt[v] + w
                if w:
                    q.append(x)
                else:
                    q.appendleft(x)
    return [x if x < INF else -1 for x in dt]


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
    "F": "E の準備の長さと遠回りを、どんな長さの解でも崩れない数え方にしたもの（準備: 娘が今までで最も出口に近づく手で区切る、"
         "遠回り: 任意の長さの解での最小）+ 空きの範囲。山場2の確かめ（F1）の所見で E から作り直した",
    "G": "F の準備の長さを、後で超えない前進（その後の解で娘の距離が上回らない前進）だけで区切るようにしたもの。"
         "一時的に娘を前へ出して戻す手でも、1手の滑りの途中で遠い位置を通る手でも区切れない。"
         "F1 の再確認・再々確認の所見で F から作り直した",
    "H": "G の遠回りを、準備の長さを最も小さくする解の中で最も少ない回数にし（2つの特徴を同じ解の上で取る）、"
         "準備の長さが最短手数 − 1 の問題（前進が出口の前に着く手だけで、準備の長さが作業の量の言い換えになる）を"
         "レベル2 以上に出さないもの。レベル1 の遠回りは 0〜1 回。main の難易度の Skill の検査 A5 と流れ 3 に合わせて G から作り直した",
    "I": "H の区切れない準備の除外を、最短の解だけで数えた準備の長さ（sprep）÷ 最短手数 ≤ 0.87 をレベル2 以上に求める形にしたもの。"
         "最短より長い解で前進を挟んで準備の長さを下げ、除外を逃れる問題と、上のレベルほど準備の長さが最短手数に近づく問題を外す。"
         "H の独立の確かめ（A4 の反例と A5）の所見で H から作り直した",
    "J": "I の前進を、今までの最小ではなく直前の前進の距離（始めは始めの距離）を下回り、その手で娘の距離が減り、以後上回らない手に"
         "したもの（jprep・jdet・jsprep）。娘を一時的に前へ出して戻すと後の前進が前進でなくなり、準備が膨らむ所見で I から作り直した",
}
BANDS = {
    "A": ("opt", {1: (8, 15), 2: (16, 25), 3: (26, 40), 4: (41, 60), 5: (61, 90)}),
    "B": ("bmin", {1: (0, 0), 2: (1, 1), 3: (2, 2), 4: (3, 3), 5: (4, 99)}),
    "C": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
    "D": ("lmin", {1: (0, 0), 2: (1, 1), 3: (2, 2), 4: (3, 3), 5: (4, 99)}),
    "E": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
    "E0": ("prep", {1: (0, 4), 2: (5, 7), 3: (8, 11), 4: (12, 16), 5: (17, 99)}),
    "F": ("rprep", {1: (0, 8), 2: (9, 15), 3: (16, 22), 4: (23, 29), 5: (30, 999)}),
    "G": ("pprep", {1: (0, 8), 2: (9, 15), 3: (16, 22), 4: (23, 29), 5: (30, 999)}),
    "H": ("pprep", {1: (0, 8), 2: (9, 15), 3: (16, 22), 4: (23, 29), 5: (30, 999)}),
    "I": ("pprep", {1: (0, 8), 2: (9, 15), 3: (16, 22), 4: (23, 29), 5: (30, 999)}),
    "J": ("jprep", {1: (0, 8), 2: (9, 15), 3: (16, 22), 4: (23, 29), 5: (30, 999)}),
}
BACK_RANGE = {
    "E": {1: (0, 1), 2: (1, 1), 3: (1, 2), 4: (2, 3), 5: (3, 99)},
    "E0": {1: (0, 1), 2: (0, 1), 3: (1, 2), 4: (2, 3), 5: (3, 99)},
    "F": {1: (0, 0), 2: (0, 1), 3: (1, 2), 4: (1, 2), 5: (2, 99)},
    "G": {1: (0, 0), 2: (0, 1), 3: (1, 2), 4: (1, 2), 5: (2, 99)},
    "H": {1: (0, 1), 2: (0, 1), 3: (1, 2), 4: (1, 2), 5: (2, 99)},
    "I": {1: (0, 1), 2: (0, 1), 3: (1, 2), 4: (1, 2), 5: (2, 99)},
    "J": {1: (0, 1), 2: (0, 1), 3: (1, 2), 4: (1, 2), 5: (2, 99)},
}
# 遠回りの範囲を確かめる特徴。F・G はどんな長さの解でも崩れない遠回り。
BACK_KEY = {"F": "adet", "G": "adet", "H": "ldet", "I": "ldet", "J": "jdet"}
# 最短の解の準備の長さ ÷ 最短手数の上限（案 I）。レベル1 は縛らない。
SHORTEST_SHARE = {"I": {1: 1.0, 2: 0.87, 3: 0.87, 4: 0.87, 5: 0.87},
                  "J": {1: 1.0, 2: 0.87, 3: 0.87, 4: 0.87, 5: 0.87}}
SHORTEST_KEY = {"I": "sprep", "J": "jsprep"}
# 準備の長さが最短手数 − 1 の問題（区切れない準備）を出すレベル。H はレベル1 だけ。
UNDIVIDED_LEVELS = {"H": (1,)}
PLANS = list(PLAN_DESC)
CHOSEN = "J"


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
        if not lo <= g(BACK_KEY.get(plan, "bmin")) <= hi:
            return "unlisted-combination"
    if plan in UNDIVIDED_LEVELS and lvl not in UNDIVIDED_LEVELS[plan] and g(key) == x["opt"] - 1:
        return "unlisted-combination"
    if plan in SHORTEST_SHARE and x[SHORTEST_KEY[plan]] > SHORTEST_SHARE[plan][lvl] * x["opt"]:
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
PACK_MERGE_SHARE = 0.75  # 2問の最短解が合流し、共通の後半が短い方の最短手数のこの割合以上なら近い問題とみなす
PACK_CAP_BALL = 1000  # 駒の組・レベルごとに数える上限（時間のため）
PACK_CAP_STRICT = 500 # ゲームの問題集の生成と同じ（1レベルの問題数の上限）
NO_OWNER = 2 ** 31 - 1


def pack(lst, E, d, radius, strict, cap):
    """lst の順に採り、採った問題から radius 手以内の状態を除く（手数の探索は採った問題ごとに、前の印で止めずにたどる）。
    strict では、採った問題を最短解の上に持つ状態（最短の祖先）と、最短解が採った問題の最短解と合流して共通の後半が
    PACK_MERGE_SHARE 以上になる状態（採った問題の最短解の上にある状態を含む）も除く。
    ゲームの問題集の生成（`pool-selection.ts`）と同じ規則。"""
    near = set()
    ancestors = set()
    owner = {}  # 最短の子孫 -> そこを通る採った問題の最短手数の最小
    shortest_taken = NO_OWNER
    picked = 0

    def merges(i):
        if shortest_taken == NO_OWNER:
            return False
        own = d[i]
        floor = PACK_MERGE_SHARE * min(own, shortest_taken)
        seen = {i}
        q = [i]
        while q:
            u = q.pop()
            if u in owner and d[u] >= PACK_MERGE_SHARE * min(own, owner[u]):
                return True
            for v in E[u]:
                if d[v] == d[u] - 1 and d[v] >= floor and v not in seen:
                    seen.add(v)
                    q.append(v)
        return False

    for i in lst:
        if i in near or (strict and (i in ancestors or merges(i))):
            continue
        picked += 1
        if picked >= cap:
            break
        seen = {i}
        frontier = [i]
        for _ in range(radius):
            nxt = []
            for u in frontier:
                for v in E[u]:
                    if v not in seen:
                        seen.add(v)
                        nxt.append(v)
            frontier = nxt
        near |= seen
        if strict:
            ancestors.add(i)
            q = [i]
            while q:
                u = q.pop()
                for v in E[u]:
                    if d[v] == d[u] + 1 and v not in ancestors:
                        ancestors.add(v)
                        q.append(v)
            own = d[i]
            owner[i] = min(owner.get(i, NO_OWNER), own)
            q = [i]
            while q:
                u = q.pop()
                for v in E[u]:
                    if d[v] == d[u] - 1 and owner.get(v, NO_OWNER) > own:
                        owner[v] = own
                        q.append(v)
            shortest_taken = min(shortest_taken, own)
    return picked


# ---------------------------------------------------------------- 1つの駒の組の処理

JOINT = ("opt", "bmin", "prep", "lmin", "branch", "e")
FEATS = ("opt", "bmin", "prep", "lmin", "dmv", "branch", "nopt", "ar", "e", "rprep", "pprep", "adet", "ldet", "sprep", "jprep", "jdet", "jsprep")


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
    texts = [board_text(st) for st in S]
    for i in range(N):
        if d[i] <= 0:
            continue
        mi = idx[mirror(S[i])]
        if chosen_orientation(seed, texts[i], texts[mi]) != texts[i]:
            # 左右反転は同じ問題。特徴が一致するかだけ確かめる
            for k in ("bmin", "prep", "lmin", "bmax", "prepf", "rprep", "pprep", "adet", "ldet", "sprep", "jprep", "jdet", "jsprep"):
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
        lst = sorted(lst, key=lambda i: (fnv(f"{seed}:{texts[i]}"), texts[i]))
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
    x = {k: f[k][i] for k in ("bmin", "bmax", "brow", "prep", "prepf", "lmin", "lsum", "dmv", "branch", "nopt", "rprep", "pprep", "adet", "ldet", "sprep", "jprep", "jdet", "jsprep")}
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
                     "bmin": BACK_RANGE[CHOSEN], "empties": EMPTY_RANGE,
                     "shortest_preparation_share": SHORTEST_SHARE[CHOSEN]},
        "per_set_counts": [{"pieces": r["ps"], "states": r["states"], "candidates_mirror_dedup": r["cand"],
                            "levels": {str(L): (r["acc"][CHOSEN].get(L) or {}).get("n", 0) for L in range(1, 6)},
                            "status": r["status"][CHOSEN],
                            "near_duplicate_packing": r["packing"]} for r in res],
        "packing_rule": {"radius": PACK_RADIUS, "merge_share": PACK_MERGE_SHARE, "cap_ball": PACK_CAP_BALL,
                         "cap_strict": PACK_CAP_STRICT, "order": "fnv(seed:盤面) の小さい順、同じなら盤面の順"},
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
