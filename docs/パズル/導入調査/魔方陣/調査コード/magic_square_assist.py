#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）の「補助と状態の知らせ」の調査コード。

/add-puzzle の調査で、列の合計の知らせ方（あといくつ・今の合計・埋まった列の合否だけ・何も出さない）を
比べるために、代表的な問題を素朴なモデルで解き、プレイヤーが頭の中でする計算の量を数える。
標準ライブラリだけで書き、乱数は seed を固定する。製品のコードはこのファイルに依存しない。

使い方（リポジトリのルートから。結果は JSON で標準出力へ、進み具合は標準エラーへ出す）:
  python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_assist.py all       # 全部（約65秒）
  python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_assist.py problems  # 問題と計算の量だけ（約50秒）
  python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_assist.py check     # 解法器の確かめ（4×4 が 7040 通り）

代表の問題（seed 固定で、種類ごとに PER_TYPE=8 問作る。seed は種類ごとの起点 1000〜6000 から順に試す）:
  4x4-1  4×4。1マスだけ空いた列をたどるだけで解ける（与える数を、たどれる範囲でできるだけ減らす）
  5x5-1  5×5。同じ作り方
  6x6-1  6×6。同じ作り方（盤面の上限を 5×5 に固定しないため、計算の伸びを見る）
  4x4-2  4×4。下の読むモデル（組の読みまで）で解ける範囲で与える数を減らし、最初に1マスだけ空いた列が無いもの
  5x5-2  5×5。同じ作り方
  6x6-2  6×6。同じ作り方
  魔方陣は、完全な解法器（solve_count）に値を試す順を乱して最初の解を取る。

測るもの:
  summary.<種類>.rem_<案>_<記憶>   列の「あと」を得る計算の回数（下の数え方）
  summary.<種類>.combo_<記憶>      組を探す計算の回数（どの案でも同じ）
  summary.<種類>.share_<案>_<記憶> 計算全体に占める「あと」を得る計算の割合
  summary.<種類>.value_shown_ratio 置く瞬間に、そのマスを通る1マスだけ空いた列がある割合（A 案なら置く数が表示に出ている）
  summary.<種類>.wrong_*            解く途中の各局面で答えと違う数を置いたとき、すぐ出る知らせの割合
                                    full_mismatch 埋まって合わない / reach_or_over 空きがあるのに合計に届いた・超えた /
                                    over 超えた / dead_end 1マスだけ空いた列の要る数が数の欄に無い
  summary.<種類>.trial_*            最初の局面で各空きマスに残っている数を順に置き、すぐ出る知らせで消せない数（-2 だけ）
  summary.<種類>.check_but_wrong_ratio  空きが2マスの列を和の合う組で埋めたとき、合った印が付くのに答えと違う埋め方の割合
  summary.<種類>.cells_2to4_max_round   組の読みの回のうち最も多い回の、候補が2〜4個のマスの数（メモに書ける大きさ）
  summary.<種類>.slip_*             D 案で1マスだけ空いた列の計算を1つ間違えたとき、気づくまでに置くマスの数（-1 だけ）

素朴な読むモデル（human_solve）:
  1. 1マスだけ空いた列があれば、行 → 列 → 斜めの順で最初の列を見て、合計の残り（あと）を置く。
  2. 無ければ、空きが2マスの列を全部見て、残っている数から和が「あと」になる組を探し、
     各マスの候補を、通る列の組の和集合の共通部分に絞る。候補が1つになったマスを全部置く。
     それでも決まらなければ、空きが3マスの列まで広げる（それ以上は扱わず、詰まりとして返す）。

計算の数え方（列を1本「見る」たびに、その列の「あと」を得るのに要る計算）:
  A あといくつ   : 0（表示を読む）
  B 今の合計     : 1回（合計 − 表示の数）
  C 埋まった列の合否だけ / D 何も出さない : 置いてある数を足す（置いてある数 − 1 回）＋ 合計から引く1回
  記憶のモデル:
    毎回やり直す   : 列を見るたびに上の計算をする（上限側）
    列ごとに覚える : 一度求めた列の「あと」を覚えておき、その列に数が増えたら1回引いて直す（下限側）
  組を探す計算（どの案でも同じ。読みそのもの）:
    空き2マス: 残っている数 a を小さい順に、a < あと − a の間、あと − a を求めて残っているか見る
    空き3マス: a < b を小さい順に、あと − a − b を求めて残っているか見る
  覚えるモデルの組を探す計算は、見た列のうち状態が変わった列の割合で按分した近似。

限界:
  読むモデルは、組の読みの回ごとに空きが2マス（足りなければ3マス）の列を全部見る。人は見込みのある列から
  見るので、組を探す計算の回数は多めに出る。「あと」を得る計算も同じ回数の列について数えるので、割合の比べ方は揃う。
  計算1回にかかる時間、計算の誤りの起こりやすさは測っていない。
"""

from __future__ import annotations

import itertools
import json
import random
import statistics
import sys
import time

# ---------------------------------------------------------------------------
# 盤面の形
# ---------------------------------------------------------------------------


def magic_sum(n: int) -> int:
    return n * (n * n + 1) // 2


class Geo:
    def __init__(self, n: int):
        self.n = n
        self.N = n * n
        self.S = magic_sum(n)
        rows = [tuple(r * n + c for c in range(n)) for r in range(n)]
        cols = [tuple(r * n + c for r in range(n)) for c in range(n)]
        diag = tuple(i * n + i for i in range(n))
        anti = tuple(i * n + (n - 1 - i) for i in range(n))
        self.lines = rows + cols + [diag, anti]
        self.names = [f"行{r + 1}" for r in range(n)] + [f"列{c + 1}" for c in range(n)] + ["斜め＼", "斜め／"]
        self.cell_lines = [[li for li, L in enumerate(self.lines) if c in L] for c in range(self.N)]


GEOS: dict[int, Geo] = {}


def geo(n: int) -> Geo:
    if n not in GEOS:
        GEOS[n] = Geo(n)
    return GEOS[n]


# ---------------------------------------------------------------------------
# 完全な解法器（解の数を limit まで数える）
# ---------------------------------------------------------------------------


class NodeLimit(Exception):
    pass


def solve_count(n: int, grid: list[int], limit: int = 2, rng: random.Random | None = None,
                node_limit: int | None = None) -> list[list[int]]:
    """grid の 0 を埋めた魔方陣を limit 個まで返す。rng を渡すと値を試す順を乱す。"""
    G = geo(n)
    N, S, L = G.N, G.S, G.lines
    g = list(grid)
    used = [False] * (N + 2)
    for v in g:
        if v:
            used[v] = True
    lsum = [sum(g[c] for c in l) for l in L]
    lemp = [sum(1 for c in l if g[c] == 0) for l in L]
    sols: list[list[int]] = []
    nodes = [0]

    def ok() -> bool:
        unused = [v for v in range(1, N + 1) if not used[v]]
        pre = [0]
        for v in unused:
            pre.append(pre[-1] + v)
        m = len(unused)
        for li in range(len(L)):
            k = lemp[li]
            r = S - lsum[li]
            if k == 0:
                if r != 0:
                    return False
            else:
                if k > m or r < pre[k] or r > pre[m] - pre[m - k]:
                    return False
        return True

    def place(c: int, v: int, sign: int) -> None:
        g[c] = v if sign > 0 else 0
        used[v] = sign > 0
        for li in G.cell_lines[c]:
            lsum[li] += sign * v
            lemp[li] -= sign

    def rec() -> bool:
        nodes[0] += 1
        if node_limit is not None and nodes[0] > node_limit:
            raise NodeLimit
        best = -1
        for li in range(len(L)):
            k = lemp[li]
            if k > 0 and (best < 0 or k < lemp[best]):
                best = li
                if k == 1:
                    break
        if best < 0:
            sols.append(list(g))
            return len(sols) >= limit
        # 空きの少ない列の中で、通る列の空きが最も少ないマスを選ぶ
        cells = [c for c in L[best] if g[c] == 0]
        cell = min(cells, key=lambda c: sum(lemp[li] for li in G.cell_lines[c]))
        if lemp[best] == 1:
            cands = [S - lsum[best]]
        else:
            cands = [v for v in range(1, N + 1) if not used[v]]
            if rng is not None:
                rng.shuffle(cands)
        for v in cands:
            if v < 1 or v > N or used[v]:
                continue
            place(cell, v, 1)
            if ok() and rec():
                place(cell, v, -1)
                return True
            place(cell, v, -1)
        return False

    if ok():
        rec()
    return sols


def random_magic_square(n: int, seed: int, node_limit: int = 2_000_000) -> list[int] | None:
    rng = random.Random(seed)
    try:
        sols = solve_count(n, [0] * (n * n), limit=1, rng=rng, node_limit=node_limit)
    except NodeLimit:
        return None
    return sols[0] if sols else None


# ---------------------------------------------------------------------------
# 素朴な読むモデル
# ---------------------------------------------------------------------------


def singles_only(n: int, grid: list[int]) -> list[int] | None:
    """1マスだけ空いた列をたどるだけで最後まで埋まれば、その盤面を返す。"""
    G = geo(n)
    g = list(grid)
    while 0 in g:
        used = set(g)
        progressed = False
        for l in G.lines:
            e = [c for c in l if g[c] == 0]
            if len(e) == 1:
                v = G.S - sum(g[c] for c in l)
                if v < 1 or v > G.N or v in used:
                    return None
                g[e[0]] = v
                progressed = True
                break
        if not progressed:
            return None
    return g


def find_combos(r: int, k: int, unused: list[int]) -> tuple[list[tuple[int, ...]], int, int]:
    """和が r になる k 個の組（残っている数から）と、人が組を探すときの引き算の回数・見る回数を返す。"""
    uset = set(unused)
    combos: list[tuple[int, ...]] = []
    subs = 0
    looks = 0
    if k == 2:
        for a in unused:
            if a >= r - a:
                break
            subs += 1
            looks += 1
            b = r - a
            if b in uset and b != a:
                combos.append((a, b))
    elif k == 3:
        for i, a in enumerate(unused):
            if 3 * a + 3 > r:
                break
            subs += 1  # r − a
            for b in unused[i + 1:]:
                if a + 2 * b + 1 > r:
                    break
                subs += 1  # (r − a) − b
                looks += 1
                c = r - a - b
                if c > b and c in uset:
                    combos.append((a, b, c))
    else:
        for comb in itertools.combinations(unused, k):
            looks += 1
            if sum(comb) == r:
                combos.append(comb)
        subs = looks
    return combos, subs, looks


def human_solve(n: int, puzzle: list[int], max_k: int = 3) -> dict:
    """素朴な読むモデルで解き、各手で見た列と組の探索を記録する。"""
    G = geo(n)
    N, S, L = G.N, G.S, G.lines
    g = list(puzzle)
    steps: list[dict] = []
    while 0 in g:
        used = set(v for v in g if v)
        unused = [v for v in range(1, N + 1) if v not in used]
        single = None
        for li, l in enumerate(L):
            e = [c for c in l if g[c] == 0]
            if len(e) == 1:
                single = (li, e[0])
                break
        if single is not None:
            li, c = single
            filled = [g[x] for x in L[li] if g[x]]
            v = S - sum(filled)
            if v < 1 or v > N or v in used:
                return {"solved": False, "reason": "contradiction", "steps": steps, "grid": g}
            steps.append({"kind": "single", "placed": [(c, v)], "consults": [(li, filled)],
                          "combo_subs": 0, "combo_subs3": 0, "combo_looks": 0, "combos": 0})
            g[c] = v
            continue
        empties = [c for c in range(N) if g[c] == 0]
        cand = {c: set(unused) for c in empties}
        consults: list[tuple[int, list[int]]] = []
        combo_subs = combo_looks = combo_count = combo_subs3 = 0
        det: list[int] = []
        used_k = 0
        for k in range(2, max_k + 1):
            for li, l in enumerate(L):
                e = [c for c in l if g[c] == 0]
                if len(e) != k:
                    continue
                filled = [g[x] for x in l if g[x]]
                r = S - sum(filled)
                consults.append((li, filled))
                combos, subs, looks = find_combos(r, k, unused)
                combo_subs += subs
                if k == 3:
                    combo_subs3 += subs
                combo_looks += looks
                combo_count += len(combos)
                vals = set(itertools.chain.from_iterable(combos))
                for c in e:
                    cand[c] &= vals
            det = [c for c in empties if len(cand[c]) == 1]
            used_k = k
            if det:
                break
        if not det:
            return {"solved": False, "reason": "stuck", "steps": steps, "grid": g,
                    "cand_sizes": sorted(len(cand[c]) for c in empties)}
        placed = []
        taken = set()
        for c in det:
            v = next(iter(cand[c]))
            if v in taken:
                continue
            taken.add(v)
            placed.append((c, v))
        steps.append({"kind": f"combo{used_k}", "placed": placed, "consults": consults,
                      "combo_subs": combo_subs, "combo_subs3": combo_subs3, "combo_looks": combo_looks,
                      "combos": combo_count, "cand_sizes": sorted(len(cand[c]) for c in empties)})
        for c, v in placed:
            g[c] = v
    return {"solved": True, "steps": steps, "grid": g}


# ---------------------------------------------------------------------------
# 計算の量
# ---------------------------------------------------------------------------


class OpCount:
    def __init__(self) -> None:
        self.ops = 0
        self.two_digit = 0
        self.carry = 0

    def add(self, a: int, b: int) -> int:
        self.ops += 1
        if a >= 10 or b >= 10:
            self.two_digit += 1
        if (a % 10) + (b % 10) >= 10:
            self.carry += 1
        return a + b

    def sub(self, a: int, b: int) -> int:
        self.ops += 1
        if a >= 10 or b >= 10:
            self.two_digit += 1
        if (a % 10) < (b % 10):
            self.carry += 1
        return a - b

    def as_dict(self) -> dict:
        return {"ops": self.ops, "two_digit": self.two_digit, "carry": self.carry}


def remainder_cost(n: int, trace: dict, option: str, memory: str) -> dict:
    """列の「あと」を得るための計算（組を探す計算は含めない）。"""
    S = geo(n).S
    cnt = OpCount()
    known: dict[int, list[int]] = {}  # 列ごとに、覚えている時点の置いてある数
    for step in trace["steps"]:
        for li, filled in step["consults"]:
            if option == "A":
                continue
            if option == "B":
                if memory == "recompute" or known.get(li) != filled:
                    cnt.sub(S, sum(filled))
                known[li] = list(filled)
                continue
            # C / D
            if memory == "recompute" or li not in known:
                if filled:
                    s = filled[0]
                    for x in filled[1:]:
                        s = cnt.add(s, x)
                    cnt.sub(S, s)
            else:
                prev = known[li]
                r = S - sum(prev)
                for x in filled:
                    if x in prev:
                        continue
                    r = cnt.sub(r, x)
            known[li] = list(filled)
    return cnt.as_dict()


def combo_cost(trace: dict, memory: str) -> dict:
    """組を探す計算。毎回やり直すモデルでは毎回、覚えるモデルでは列の状態が変わったときだけ数える。"""
    if memory == "recompute":
        subs = sum(s["combo_subs"] for s in trace["steps"])
        looks = sum(s["combo_looks"] for s in trace["steps"])
        return {"ops": subs, "looks": looks}
    # 覚えるモデル: 列ごとに (置いてある数) が同じなら探し直さない。consult の並びに合わせて按分できないので、
    # 組を探した手のうち、見た列の状態が前の手と全部同じなら 0 とする近似。
    seen: dict[int, list[int]] = {}
    subs = looks = 0
    for s in trace["steps"]:
        if s["kind"] == "single":
            continue
        changed = [li for li, filled in s["consults"] if seen.get(li) != filled]
        frac = len(changed) / max(1, len(s["consults"]))
        subs += round(s["combo_subs"] * frac)
        looks += round(s["combo_looks"] * frac)
        for li, filled in s["consults"]:
            seen[li] = list(filled)
    return {"ops": subs, "looks": looks}


# ---------------------------------------------------------------------------
# 問題を作る
# ---------------------------------------------------------------------------


def reduce_singles(n: int, sol: list[int], rng: random.Random) -> list[int]:
    """1マスだけ空いた列をたどって解ける範囲で、与える数を減らす。"""
    g = list(sol)
    order = list(range(n * n))
    rng.shuffle(order)
    for c in order:
        v = g[c]
        g[c] = 0
        if singles_only(n, g) is None:
            g[c] = v
    return g


def reduce_readable(n: int, sol: list[int], rng: random.Random) -> list[int]:
    """素朴な読むモデル（組の読みまで）で解ける範囲で、与える数を減らす。

    読むモデルの推論は正しい候補を消さないので、読むモデルで解けた問題は答えが1つ。
    """
    g = list(sol)
    order = list(range(n * n))
    rng.shuffle(order)
    for c in order:
        v = g[c]
        g[c] = 0
        tr = human_solve(n, g)
        if not (tr["solved"] and tr["grid"] == sol):
            g[c] = v
    return g


def no_single_line(n: int, g: list[int]) -> bool:
    return all(sum(1 for c in l if g[c] == 0) != 1 for l in geo(n).lines)


PER_TYPE = 8  # 種類ごとに作る問題の数


def make_problems(log, per_type: int = PER_TYPE) -> list[dict]:
    """種類ごとに per_type 問ずつ作る。seed は種類ごとの起点から順に試す。"""
    out = []
    kinds = [(4, 1, 1000), (5, 1, 2000), (6, 1, 3000), (4, 2, 4000), (5, 2, 5000), (6, 2, 6000)]
    for n, kind, seed0 in kinds:
        t0 = time.time()
        made = tried = 0
        seed = seed0
        while made < per_type and seed < seed0 + 400:
            sol = random_magic_square(n, seed)
            seed += 1
            if sol is None:
                continue
            tried += 1
            rng = random.Random(seed - 1)
            if kind == 1:
                p = reduce_singles(n, sol, rng)
            else:
                p = reduce_readable(n, sol, rng)
                if not no_single_line(n, p):
                    continue
            made += 1
            out.append({"id": f"{n}x{n}-{kind}#{made}", "kind": f"{n}x{n}-{kind}", "n": n, "seed": seed - 1,
                        "solution": sol, "puzzle": p})
        log(f"made {made} of {n}x{n}-{kind} (tried {tried}) in {time.time() - t0:.1f}s")
    return out


# ---------------------------------------------------------------------------
# 測る
# ---------------------------------------------------------------------------


def measure_ops(prob: dict) -> dict:
    n = prob["n"]
    tr = human_solve(n, prob["puzzle"])
    assert tr["solved"] and tr["grid"] == prob["solution"], prob["id"]
    steps = tr["steps"]
    placements = sum(len(s["placed"]) for s in steps)
    single_place = sum(len(s["placed"]) for s in steps if s["kind"] == "single")
    consults = sum(len(s["consults"]) for s in steps)
    res = {"id": prob["id"], "n": n, "S": geo(n).S, "givens": sum(1 for v in prob["puzzle"] if v),
           "placements": placements, "single_placements": single_place,
           "combo_rounds": sum(1 for s in steps if s["kind"] != "single"),
           "combo3_rounds": sum(1 for s in steps if s["kind"] == "combo3"),
           "line_consults": consults, "combo3_subs": sum(s["combo_subs3"] for s in steps),
           "remainder": {}, "combo": {}}
    for memory in ("recompute", "remember"):
        res["remainder"][memory] = {opt: remainder_cost(n, tr, opt, memory) for opt in ("A", "B", "C")}
        res["combo"][memory] = combo_cost(tr, memory)
    # 置くたびに表示が変わる列の数（あといくつ・今の合計の表示）
    G = geo(n)
    changes = [len(G.cell_lines[c]) for s in steps for c, _ in s["placed"]]
    res["labels_total"] = len(G.lines)
    res["labels_changed_per_place"] = round(statistics.mean(changes), 2)
    # その数を置くとき、あといくつの表示に置く数そのものが出ていたか（そのマスを通る、1マスだけ空いた列がある）
    g = list(prob["puzzle"])
    shown = 0
    for s in steps:
        for c, v in s["placed"]:
            if any(sum(1 for x in G.lines[li] if g[x] == 0) == 1 for li in G.cell_lines[c]):
                shown += 1
        for c, v in s["placed"]:
            g[c] = v
    res["value_shown_on_label"] = shown
    cs = [s["cand_sizes"] for s in steps if s["kind"] != "single"]
    if cs:
        res["first_combo_cand_sizes"] = cs[0]
        # 組の読みの各回で、候補が2〜4個に絞れたマスの数（マスに書くメモに収まる大きさ）と、5個以上のマスの数
        res["cells_2to4_per_round"] = [sum(1 for x in c if 2 <= x <= 4) for c in cs]
        res["cells_5plus_per_round"] = [sum(1 for x in c if x >= 5) for c in cs]
        res["combos_per_round"] = [s["combos"] for s in steps if s["kind"] != "single"]
    return res


def signals_after(n: int, g: list[int], c: int) -> dict:
    """マス c に数を置いた直後、c を通る列に出る違反・行き止まり。"""
    G = geo(n)
    used = set(v for v in g if v)
    v1 = v2 = v2s = v3 = False
    for li in G.cell_lines[c]:
        l = G.lines[li]
        k = sum(1 for x in l if g[x] == 0)
        r = G.S - sum(g[x] for x in l)
        if k == 0 and r != 0:
            v1 = True
        if k > 0 and r <= 0:
            v2 = True
        if k > 0 and r < 0:
            v2s = True
        if k == 1 and (r < 1 or r > G.N or r in used):
            v3 = True
    return {"full_mismatch": v1, "reach_or_over": v2, "over": v2s, "dead_end": v3}


def measure_wrong_placements(prob: dict) -> dict:
    """解く途中の各局面で、空きマスに答えと違う数を置いたとき、すぐに盤面に出る知らせの割合。"""
    n = prob["n"]
    G = geo(n)
    tr = human_solve(n, prob["puzzle"])
    g = list(prob["puzzle"])
    sol = prob["solution"]
    tally = {"total": 0, "full_mismatch": 0, "reach_or_over": 0, "over": 0, "dead_end": 0,
             "visible_without_dead_end": 0, "visible_with_dead_end": 0}
    for s in tr["steps"]:
        used = set(v for v in g if v)
        unused = [v for v in range(1, G.N + 1) if v not in used]
        for c in range(G.N):
            if g[c] != 0:
                continue
            for v in unused:
                if v == sol[c]:
                    continue
                g[c] = v
                sg = signals_after(n, g, c)
                g[c] = 0
                tally["total"] += 1
                for key in ("full_mismatch", "reach_or_over", "over", "dead_end"):
                    tally[key] += sg[key]
                vis = sg["full_mismatch"] or sg["reach_or_over"]
                tally["visible_without_dead_end"] += vis
                tally["visible_with_dead_end"] += vis or sg["dead_end"]
        for c, v in s["placed"]:
            g[c] = v
    out = {"id": prob["id"], "total": tally["total"]}
    for key, val in tally.items():
        if key != "total":
            out[key] = round(val / tally["total"], 3)
    return out


def measure_trial(prob: dict) -> dict:
    """最初の局面で、各空きマスに残っている数を順に置いて、すぐ出る知らせで消せる数を数える。

    trial_C: 埋まった列の合否と超えた列だけを見る（C 案に違反を足したもの）
    trial_A: それに加え、あといくつと数の欄を見比べて、1マスだけ空いた列の行き止まりにも気づく（A 案）
    reading : 素朴な読むモデルの最初の組の読みで残る候補
    """
    n = prob["n"]
    G = geo(n)
    g = list(prob["puzzle"])
    used = set(v for v in g if v)
    unused = [v for v in range(1, G.N + 1) if v not in used]
    sizes_c, sizes_a = [], []
    for c in range(G.N):
        if g[c] != 0:
            continue
        sc = sa = 0
        for v in unused:
            g[c] = v
            sg = signals_after(n, g, c)
            g[c] = 0
            vis = sg["full_mismatch"] or sg["reach_or_over"]
            if not vis:
                sc += 1
            if not (vis or sg["dead_end"]):
                sa += 1
        sizes_c.append(sc)
        sizes_a.append(sa)
    tr = human_solve(n, prob["puzzle"])
    first = next((s for s in tr["steps"] if s["kind"] != "single"), None)
    rcs = first["cand_sizes"] if first else None
    others = [x for x in rcs if x > 1] if rcs else []
    # 空きが2マスの列を、和が合う組で埋めたとき、合った印が付くのに答えと違う埋め方の割合
    pair_counts = []
    for l in G.lines:
        e = [x for x in l if g[x] == 0]
        if len(e) != 2:
            continue
        combos, _, _ = find_combos(G.S - sum(g[x] for x in l), 2, unused)
        pair_counts.append(len(combos))
    ordered_ok = sum(2 * k for k in pair_counts)
    ordered_right = sum(1 for k in pair_counts if k > 0)
    return {"id": prob["id"], "empties": len(sizes_c), "unused": len(unused),
            "trial_C_median": statistics.median(sizes_c), "trial_C_unique": sum(1 for x in sizes_c if x == 1),
            "trial_A_median": statistics.median(sizes_a), "trial_A_unique": sum(1 for x in sizes_a if x == 1),
            "reading_cand_sizes": rcs,
            "reading_cand_unique": sum(1 for x in rcs if x == 1) if rcs else None,
            "reading_cand_median_other": statistics.median(others) if others else None,
            "two_empty_lines": len(pair_counts), "pairs_per_two_empty_line": pair_counts,
            "check_but_wrong_ratio": round(1 - ordered_right / ordered_ok, 3) if ordered_ok else None}


def measure_slip_propagation(prob: dict) -> dict:
    """D 案（何も出さない）で、1マスだけ空いた列の計算を1つ間違えたとき、気づくまでに何マス置くか。

    間違い: 正しい数 v の代わりに v±1・v±10（1..n² の範囲で、まだ使っていない数）を置く。
    その後も同じ読み方で進め、次のどれかで気づくとみなす:
      詰まる    : 求めた数が範囲外か使用済みで、数の欄に無い
      埋まる    : 全マスが埋まったのにクリアにならない
    C 案・A 案・B 案では、間違えた列が埋まった時点で合わないと出るので、気づくまでに置くマスは 0。
    """
    n = prob["n"]
    G = geo(n)
    tr = human_solve(n, prob["puzzle"])
    g = list(prob["puzzle"])
    results = []
    for s in tr["steps"]:
        if s["kind"] != "single":
            for c, v in s["placed"]:
                g[c] = v
            continue
        c, v = s["placed"][0]
        used = set(x for x in g if x)
        for d in (-10, -1, 1, 10):
            w = v + d
            if w < 1 or w > G.N or w in used:
                continue
            h = list(g)
            h[c] = w
            after = 0
            outcome = None
            while 0 in h:
                u = set(x for x in h if x)
                nxt = None
                for l in G.lines:
                    e = [x for x in l if h[x] == 0]
                    if len(e) == 1:
                        nxt = (e[0], G.S - sum(h[x] for x in l))
                        break
                if nxt is None:
                    outcome = "stuck_no_single"
                    break
                cc, vv = nxt
                if vv < 1 or vv > G.N or vv in u:
                    outcome = "unavailable"
                    break
                h[cc] = vv
                after += 1
            if outcome is None:
                outcome = "full_not_clear"
            results.append((after, outcome))
        g[c] = v
    if not results:
        return {"id": prob["id"], "slips": 0}
    afters = [a for a, _ in results]
    outs = [o for _, o in results]
    return {"id": prob["id"], "slips": len(results), "placed_after_mean": round(statistics.mean(afters), 2),
            "placed_after_max": max(afters),
            "outcome": {k: outs.count(k) for k in sorted(set(outs))}}


def summarize(values: list[float]) -> dict:
    return {"median": statistics.median(values), "min": min(values), "max": max(values)}


def aggregate(probs: list[dict], ops: list[dict], wrong: list[dict], trial: list[dict],
              slip: list[dict]) -> dict:
    kinds = sorted(set(p["kind"] for p in probs), key=lambda k: (k[-1], k))
    out = {}
    for kind in kinds:
        ids = [p["id"] for p in probs if p["kind"] == kind]
        rs = [r for r in ops if r["id"] in ids]
        agg = {"problems": len(rs)}

        def col(f):
            return summarize([f(r) for r in rs])

        agg["givens"] = col(lambda r: r["givens"])
        agg["placements"] = col(lambda r: r["placements"])
        agg["single_placements"] = col(lambda r: r["single_placements"])
        agg["combo_rounds"] = col(lambda r: r["combo_rounds"])
        agg["combo3_rounds"] = col(lambda r: r["combo3_rounds"])
        agg["line_consults"] = col(lambda r: r["line_consults"])
        for mem in ("recompute", "remember"):
            for opt in ("A", "B", "C"):
                agg[f"rem_{opt}_{mem}"] = col(lambda r, o=opt, m=mem: r["remainder"][m][o]["ops"])
            agg[f"rem_C_{mem}_two_digit"] = col(lambda r, m=mem: r["remainder"][m]["C"]["two_digit"])
            agg[f"rem_C_{mem}_carry"] = col(lambda r, m=mem: r["remainder"][m]["C"]["carry"])
            agg[f"combo_{mem}"] = col(lambda r, m=mem: r["combo"][m]["ops"])
            agg[f"share_C_{mem}"] = col(
                lambda r, m=mem: round(r["remainder"][m]["C"]["ops"]
                                       / max(1, r["remainder"][m]["C"]["ops"] + r["combo"][m]["ops"]), 3))
            agg[f"share_B_{mem}"] = col(
                lambda r, m=mem: round(r["remainder"][m]["B"]["ops"]
                                       / max(1, r["remainder"][m]["B"]["ops"] + r["combo"][m]["ops"]), 3))
        agg["combo3_share_of_combo"] = col(lambda r: round(r["combo3_subs"] / max(1, r["combo"]["recompute"]["ops"]), 3))
        # 空きが3マスの列の組探しを人がしないとみなしたとき（空き2マスの組探しだけと比べる）
        agg["combo2_recompute"] = col(lambda r: r["combo"]["recompute"]["ops"] - r["combo3_subs"])
        for opt in ("B", "C"):
            agg[f"share_{opt}_recompute_pairs_only"] = col(
                lambda r, o=opt: round(r["remainder"]["recompute"][o]["ops"]
                                       / max(1, r["remainder"]["recompute"][o]["ops"]
                                             + r["combo"]["recompute"]["ops"] - r["combo3_subs"]), 3))
            agg[f"rem_{opt}_recompute_per_placement"] = col(
                lambda r, o=opt: round(r["remainder"]["recompute"][o]["ops"] / r["placements"], 2))
            tot = sum(r["remainder"]["recompute"][opt]["ops"] for r in rs)
            agg[f"rem_{opt}_recompute_carry_ratio"] = round(
                sum(r["remainder"]["recompute"][opt]["carry"] for r in rs) / max(1, tot), 2)
        agg["combo_looks"] = col(lambda r: r["combo"]["recompute"]["looks"])
        agg["value_shown_ratio"] = col(lambda r: round(r["value_shown_on_label"] / r["placements"], 3))
        if any("cells_2to4_per_round" in r for r in rs):
            agg["cells_2to4_max_round"] = col(lambda r: max(r.get("cells_2to4_per_round", [0])))
            agg["cells_5plus_first_round"] = col(lambda r: r.get("cells_5plus_per_round", [0])[0])
            agg["combos_max_round"] = col(lambda r: max(r.get("combos_per_round", [0])))
        agg["labels_total"] = rs[0]["labels_total"]
        agg["labels_changed_per_place"] = col(lambda r: r["labels_changed_per_place"])
        ws = [w for w in wrong if w["id"] in ids]
        if ws:
            tot = sum(w["total"] for w in ws)
            agg["wrong_total"] = tot
            for key in ("full_mismatch", "reach_or_over", "over", "dead_end",
                        "visible_without_dead_end", "visible_with_dead_end"):
                agg[f"wrong_{key}"] = round(sum(w[key] * w["total"] for w in ws) / tot, 3)
        ts = [t for t in trial if t["id"] in ids]
        if ts:
            agg["trial_C_median"] = summarize([t["trial_C_median"] for t in ts])
            agg["trial_A_median"] = summarize([t["trial_A_median"] for t in ts])
            agg["trial_C_unique"] = summarize([t["trial_C_unique"] for t in ts])
            agg["trial_A_unique"] = summarize([t["trial_A_unique"] for t in ts])
            agg["two_empty_lines"] = summarize([t["two_empty_lines"] for t in ts])
            pcs = [k for t in ts for k in t["pairs_per_two_empty_line"]]
            if pcs:
                agg["pairs_per_two_empty_line"] = summarize(pcs)
                agg["two_empty_lines_with_2plus_pairs"] = round(sum(1 for k in pcs if k >= 2) / len(pcs), 3)
            cw = [t["check_but_wrong_ratio"] for t in ts if t["check_but_wrong_ratio"] is not None]
            if cw:
                agg["check_but_wrong_ratio"] = summarize(cw)
            rc = [t["reading_cand_unique"] for t in ts if t["reading_cand_unique"] is not None]
            if rc:
                agg["reading_unique"] = summarize(rc)
                agg["reading_median_other"] = summarize([t["reading_cand_median_other"] for t in ts
                                                         if t["reading_cand_median_other"] is not None])
        ss = [x for x in slip if x["id"] in ids and x.get("slips")]
        if ss:
            outs: dict = {}
            for x in ss:
                for k, v in x["outcome"].items():
                    outs[k] = outs.get(k, 0) + v
            agg["slip_count"] = sum(x["slips"] for x in ss)
            agg["slip_placed_after_mean"] = round(
                sum(x["placed_after_mean"] * x["slips"] for x in ss) / agg["slip_count"], 2)
            agg["slip_placed_after_max"] = max(x["placed_after_max"] for x in ss)
            agg["slip_outcome"] = outs
        out[kind] = agg
    return out


def check_solver() -> dict:
    """完全な解法器の確かめ: 4×4 の魔方陣を全部数える（7040 通りになるはず）。"""
    t0 = time.time()
    sols = solve_count(4, [0] * 16, limit=10 ** 6)
    G = geo(4)
    assert all(sum(s[c] for c in l) == 34 for s in sols for l in G.lines)
    assert all(sorted(s) == list(range(1, 17)) for s in sols)
    return {"count_4x4": len(sols), "distinct": len(set(map(tuple, sols))), "sec": round(time.time() - t0, 1)}


def run(which: str) -> None:
    t0 = time.time()
    log = lambda m: print(m, file=sys.stderr, flush=True)  # noqa: E731
    report: dict = {}
    if which in ("all", "check"):
        report["solver_check"] = check_solver()
        log(f"solver check {report['solver_check']}")
        if which == "check":
            print(json.dumps(report, ensure_ascii=False, indent=1))
            return
    probs = make_problems(log)
    ops, wrong, trial, slip = [], [], [], []
    for p in probs:
        ops.append(measure_ops(p))
        if which == "all":
            wrong.append(measure_wrong_placements(p))
            if p["kind"].endswith("-2"):
                trial.append(measure_trial(p))
            else:
                slip.append(measure_slip_propagation(p))
    report["summary"] = aggregate(probs, ops, wrong, trial, slip)
    report["examples"] = [{k: p[k] for k in ("id", "n", "seed", "puzzle", "solution")}
                          for p in probs if p["id"].endswith("#1")]
    report["per_problem"] = {"ops": ops, "wrong": wrong, "trial": trial, "slip": slip}
    report["elapsed_sec"] = round(time.time() - t0, 1)
    print(json.dumps(report, ensure_ascii=False, indent=1))


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which not in ("all", "problems", "check"):
        print(__doc__)
        sys.exit(2)
    run(which)


if __name__ == "__main__":
    main()
