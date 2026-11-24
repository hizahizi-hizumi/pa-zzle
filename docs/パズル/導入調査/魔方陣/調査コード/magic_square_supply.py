#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）の問題供給の調査コード。

/add-puzzle の調査の「問題供給」の観点で、問題集の件数・並び・生成時間・重複と近さ・大きさを測るために使った。
難易度の分類と候補の生成は magic_square_difficulty.py（版 8 の C2）をそのまま呼ぶ。標準ライブラリだけで書き、
乱数は seed を固定する（候補の seed は magic_square_difficulty.candidate_seed）。製品のコードはこのファイルに依存しない。

版 8 への追従（版 4 から変えたこと）:
  - 分類は magic_square_difficulty.classify_givens（版 8。違う読み方が見つかった所で止める）、盤面の割り当ては SIZES_V6。
  - 生成条件は版 8 の当たる割合から選び直した（PLAN）。L4 は k = 13（L4 向けに磨いた候補）、L5 は k = 12 から作る。
  - 候補は2段で調べる。先に作ってキー（同型の類）を出し、問題集の規則（例・重複・同じ答え・近さ）で除かれない候補だけを
    分類する。版 8 の分類は1候補 0.01〜20 秒と重いので、答えが使用済みの 4×4 を分類しない。採る問題は規則を当てる順に
    依らない（どの条件も「採る」の側では全部満たす必要があるので）。
  - 例の魔方陣は 4×4 だけにした。5×5 の例（版 4 の EXAMPLE5_V4）は、遊び方で 5×5 の図を使わないと決めたので除外を外した。
  - レベルを組む順（--level-order）と、レベルごとの件数（--level-quota）、流れごとの候補の上限（--max-visits）を選べる。

サブコマンド:
  groups      列の構造を保つマスの並べ替え（自己同型）を作り、数と、4×4 の魔方陣の同型の類の数を確かめる
  check       この観点で分類した候補が、難易度の観点の classify の結果（classified.jsonl）と同じかを確かめる
  pool        レベルごとの生成条件を巡回して候補を番号順に調べ、決めた件数の問題集を作る（候補はキャッシュして再開できる）
  analyze     pool の結果から、収率・時間・重複と近さ・同じ答え・同じ置き場所・指紋・問題集の大きさを出す
  invariance  範囲内の問題を、回転・裏返し・列の並べ替え・補数で写して分類し直し、レベルが変わる割合を出す
  recheck     キャッシュの候補を seed から作り直し、時間を除いて同じ結果になるかを確かめる
  examples    遊び方とチュートリアルの例の魔方陣と、問題集から除く形（同型の類）を出す
  expected    移植の期待値（同型のキー・近さ・例の除外・問題集の採否の規則）を JSON に書く

調査で流したコマンド（版 8。キャッシュと結果は作業ディレクトリに書く。2プロセス。D は調査コードのディレクトリ）:
  python3 $D/magic_square_supply.py groups
  python3 $D/magic_square_supply.py pool --levels 1 2 --near 4 --unique-d4-answer4 --jobs 2 --cache cache.jsonl --out pool-v8-L12.json
      # 推奨: L1 から組む。L2 の 4×4・5×5 250 ずつ
  python3 $D/magic_square_supply.py pool --levels 1 2 --level-order 2 1 --near 4 --unique-d4-answer4 --jobs 2 --cache cache.jsonl --out pool-v8-L21.json
      # 比べた案: L2 から組む
  python3 $D/magic_square_supply.py pool --level-quota 3=100 4=100 5=100 --near 4 --unique-d4-answer4 --jobs 2 --cache cache.jsonl --out pool-v8.json
      # L1・L2 は 500 ずつ、L3〜L5 は標本（盤面ごとに 50）
  python3 $D/magic_square_supply.py analyze --pool pool-v8.json --cache cache.jsonl
  python3 $D/magic_square_supply.py check --cache cache.jsonl --classified classified.jsonl   # 難易度の観点の版 8 の候補
  python3 $D/magic_square_supply.py invariance --pool pool-v8.json --cache cache.jsonl --per 8 --seed 1 --jobs 2
  python3 $D/magic_square_supply.py recheck --cache cache.jsonl --n 40 --seed 3 --jobs 2
  python3 $D/magic_square_supply.py examples --pool pool-v8.json --cache cache.jsonl
  python3 $D/magic_square_supply.py expected --pool pool-v8.json --cache cache.jsonl --cases-from expected-v4.json \\
      --out $D/magic_square_supply.expected.json   # expected-v4.json は版 4 の期待値の写し（cases・transformed・near_pairs の盤面を保つ）

同型の扱い:
  - 列の構造の自己同型 G: 縦・横・斜めの列の集まりを列の集まりへ移すマスの並べ替え。4×4・5×5 は 32、6×6 は 192。
    回転・裏返しの8通り（D4）を含む。
  - 補数: 置いた数 v を n²+1−v にする。魔方陣は魔方陣に、問題は答えの同じ形の問題に移る。
  - 問題のキー: G × 補数 で写した「与える数（空きは 0）を行優先に並べた列」の辞書順の最小。
  - 答えのキー: 同じく答えの魔方陣の最小。置き場所のキー: 与える数のある所（0/1）の G での最小。
  - 近さ: 答えのキーが同じ2問で、一方の答えを他方へ写す変換のうち、与える数のある所の対称差 |A△B| の最小。
"""

from __future__ import annotations

import argparse
import collections
import gzip
import itertools
import json
import os
import random
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import magic_square_difficulty as md  # noqa: E402

SIZES = md.SIZES_V6

# ---------------------------------------------------------------------------
# 同型
# ---------------------------------------------------------------------------


def _cell_map(n: int, s, t, transpose: bool) -> tuple[int, ...]:
    """横の並べ替え s・縦の並べ替え t・転置で、マス (r, c) の写す先。m[マス] = 写した先のマス。"""
    m = [0] * (n * n)
    for r in range(n):
        for c in range(n):
            rr, cc = s[r], t[c]
            if transpose:
                rr, cc = cc, rr
            m[r * n + c] = rr * n + cc
    return tuple(m)


def _preserves_lines(geo, m) -> bool:
    lines = {frozenset(L) for L in geo.lines}
    return all(frozenset(m[i] for i in L) in lines for L in lines)


_GROUPS: dict[int, list[tuple[int, ...]]] = {}


def line_group(n: int) -> list[tuple[int, ...]]:
    """列の構造の自己同型（恒等を先頭に、辞書順）。

    n ≥ 4 では、互いに交わらない n 本の列の組は全部の横か全部の縦だけ（斜めはどの横・縦とも交わる）なので、
    自己同型は (横の並べ替え s, 縦の並べ替え t, 転置) で表せる。斜めを斜めへ移すには t = s か t = r∘s
    （r は i → n−1−i）で、s が r と交換する必要がある。その全部を作って、列を列へ移すものだけを残す。
    """
    if n in _GROUPS:
        return _GROUPS[n]
    geo = md.geo_of(n)
    rev = tuple(n - 1 - i for i in range(n))
    rc = [s for s in itertools.permutations(range(n)) if all(s[n - 1 - i] == n - 1 - s[i] for i in range(n))]
    pairs = [(s, s) for s in rc] + [(s, tuple(rev[s[i]] for i in range(n))) for s in rc]
    out = set()
    for tr in (False, True):
        for s, t in pairs:
            m = _cell_map(n, s, t, tr)
            if _preserves_lines(geo, m):
                out.add(m)
    _GROUPS[n] = sorted(out)
    return _GROUPS[n]


def line_group_brute(n: int) -> list[tuple[int, ...]]:
    """確かめ用: (s, t, 転置) を全部試す（n = 4・5）。"""
    geo = md.geo_of(n)
    perms = list(itertools.permutations(range(n)))
    out = set()
    for tr in (False, True):
        for s in perms:
            for t in perms:
                m = _cell_map(n, s, t, tr)
                if _preserves_lines(geo, m):
                    out.add(m)
    return sorted(out)


def d4_group(n: int) -> list[tuple[int, ...]]:
    return sorted(tuple(p) for p in md.geo_of(n).symmetries())


_INV: dict[tuple[int, str], list[tuple[int, ...]]] = {}


def _inverses(n: int, which: str) -> list[tuple[int, ...]]:
    k = (n, which)
    if k not in _INV:
        grp = line_group(n) if which == "G" else d4_group(n)
        out = []
        for m in grp:
            inv = [0] * len(m)
            for c, d in enumerate(m):
                inv[d] = c
            out.append(tuple(inv))
        _INV[k] = out
    return _INV[k]


def transform(cells, m, complement: bool = False) -> list[int]:
    """m で写し、complement なら置いた数を n²+1−v にする。0（空き）は 0 のまま。"""
    N = len(cells)
    out = [0] * N
    for c in range(N):
        v = cells[c]
        out[m[c]] = (N + 1 - v) if (complement and v) else v
    return out


def canon(cells, which: str = "G", complement: bool = True) -> tuple[int, ...]:
    """同型の類の代表（辞書順の最小）。which は "G"（列の構造の自己同型）か "D4"（回転・裏返し）。"""
    N = len(cells)
    n = int(round(N ** 0.5))
    comp = [0] + [N + 1 - v for v in range(1, N + 1)]
    best = None
    for inv in _inverses(n, which):
        t = tuple(cells[inv[j]] for j in range(N))
        if best is None or t < best:
            best = t
        if complement:
            tc = tuple(comp[x] for x in t)
            if tc < best:
                best = tc
    return best


def layout_key(givens, which: str = "G") -> tuple[int, ...]:
    return canon([1 if v else 0 for v in givens], which, complement=False)


def problem_keys(givens, solution) -> dict:
    return {
        "pk": canon(givens, "G", True),       # 問題のキー（G × 補数）
        "pk8": canon(givens, "D4", False),    # 問題のキー（回転・裏返しだけ）
        "sk": canon(solution, "G", True),     # 答えのキー（G × 補数）
        "sk8": canon(solution, "D4", False),  # 答えのキー（回転・裏返しだけ）
        "lk": layout_key(givens, "G"),        # 置き場所のキー（G）
    }


def near_distance(a_givens, a_sol, b_givens, b_sol) -> int | None:
    """答えが同じ類の2問で、a の答えを b の答えへ写す変換（G × 補数）のうち、与える数のある所の対称差の最小。
    答えが別の類なら None。"""
    N = len(a_sol)
    n = int(round(N ** 0.5))
    bpos = {c for c in range(N) if b_givens[c]}
    best = None
    for m in line_group(n):
        for comp in (False, True):
            if transform(a_sol, m, comp) != list(b_sol):
                continue
            apos = {m[c] for c in range(N) if a_givens[c]}
            d = len(apos ^ bpos)
            if best is None or d < best:
                best = d
    return best


# ---------------------------------------------------------------------------
# 分類（版 8）
# ---------------------------------------------------------------------------


def classify_fast(n: int, g: list[int]):
    """(レベル, 範囲外の理由, 基準の特徴, 基準の read_solve の結果)。レベルと理由は md.classify_givens（版 8。
    基準で範囲外か帯の外なら変種を読まず、部品と部品の1〜3つの組み合わせを順に読んで、基準と違うレベルが出た所で止める。
    measure_all → classify_v6 と同じ結果になることは難易度の観点が確かめた）。基準の特徴は記録（指紋・特徴）のために読み直す。"""
    lv, why = md.classify_givens(n, g, SIZES)
    geo = md.geo_of(n)
    res = md.read_solve(geo, g)
    return lv, why, md.read_features(geo, g, res), res


FEAT = ("givens", "empties", "entry", "first_tier", "first_sweeps", "tier_max", "d2max", "d3max", "t3",
        "depth_max", "hard", "deep", "capped_reads")


def generate_job(job) -> dict:
    """1候補を作り、同型のキーを出す（分類はしない）。時間は CPU 時間（ほかの処理と並んでも変わりにくい）。"""
    n, T, k, i = job
    if n == 4 and md._SQUARES4 is None:
        md.all_squares4()  # 4×4 の全 7,040 通りを一度だけ数える（時間に入れない）
    t0 = time.process_time()
    cand = md.generate_candidate(n, T, k, i)
    t1 = time.process_time()
    g = cand["givens"]
    return {"job": [n, T, k, i], "id": cand["id"], "seed": cand["seed"], "givens": g, "solution": cand["solution"],
            "keys": {a: list(b) for a, b in problem_keys(g, cand["solution"]).items()},
            "cpu": [round(t1 - t0, 4), 0.0, 0.0]}


def classify_record(r: dict) -> dict:
    """generate_job の結果を分類し、答えの数を数える。cpu は [作る, 分類, 答えを数える]。"""
    n = r["job"][0]
    g = r["givens"]
    t1 = time.process_time()
    lv, why, base, res = classify_fast(n, g)
    t2 = time.process_time()
    ex = md.count_solutions(md.geo_of(n), g, limit=2, node_cap=2_000_000)
    t3 = time.process_time()
    out = dict(r)
    out.update({"level": lv, "reason": why, "exact": [ex["count"], ex["nodes"], int(ex["capped"])],
                "cpu": [r["cpu"][0], round(t2 - t1, 4), round(t3 - t2, 4)],
                "f": {x: base[x] for x in FEAT},
                "trace": [[s["tier"], s["sweeps"]] for s in res["steps"]]})
    return out


def is_classified(r: dict) -> bool:
    return "level" in r


# ---------------------------------------------------------------------------
# 例の魔方陣（遊び方・チュートリアル）
# ---------------------------------------------------------------------------

# 4×4: 実装のチュートリアル（tutorial/tutorial.ts）と遊び方の図（figure-boards.ts）が使っている魔方陣
EXAMPLE4 = [14, 4, 5, 11, 9, 2, 7, 16, 8, 13, 12, 1, 3, 15, 10, 6]
# 版 4 の 5×5 の例（候補 ms5-T2-k0-9009 の答え）。遊び方で 5×5 の図を使わないと決めたので、版 8 では問題集から除かない。
# 除外を外しても問題集が変わらないことを確かめるためだけに残す（analyze）。
EXAMPLE5_V4 = [1, 9, 8, 24, 23, 21, 15, 10, 3, 16, 25, 17, 12, 5, 6, 11, 20, 13, 19, 2, 7, 4, 22, 14, 18]


def example_squares() -> dict[int, list[int]]:
    return {4: list(EXAMPLE4)}


_EXAMPLE_KEYS: set[tuple[int, ...]] | None = None


def example_keys() -> set[tuple[int, ...]]:
    global _EXAMPLE_KEYS
    if _EXAMPLE_KEYS is None:
        _EXAMPLE_KEYS = {canon(sq, "G", True) for sq in example_squares().values()}
    return _EXAMPLE_KEYS


# ---------------------------------------------------------------------------
# 問題集の組み立て
# ---------------------------------------------------------------------------

# レベルごとの盤面の件数（推奨: 2つの盤面を許すレベルは半分ずつ）と、巡回する生成条件 (n, T, k)。
# 生成条件は難易度の資料 §6.2（版 8）の当たる割合から、そのレベルに当たる条件を選んだ。
#   L2: 4×4 T2 k0 15%・T3 k1 10%・T2 k1 8%、5×5 T2 k1 52%・T2 k2 38%・T2 k0 23%（版 4 と同じ6条件）
#   L3: 5×5 T2 k12 60%・T2 k13 57%、6×6 T2 k12 54%・T2 k13 56%
#   L4: 5×5 T3 k13 68%、6×6 T3 k13 70%（版 4 の T2 k12・T3 k12 は版 8 で L4 に 0〜11%）
#   L5: 5×5 T3 k12 70%、6×6 T3 k12 56%
PLAN = {
    1: {"quota": {4: 500}, "conds": [(4, 1, 0)]},
    2: {"quota": {4: 250, 5: 250}, "conds": [(5, 2, 1), (4, 2, 0), (5, 2, 2), (4, 2, 1), (5, 2, 0), (4, 3, 1)]},
    3: {"quota": {5: 250, 6: 250}, "conds": [(5, 2, 12), (6, 2, 12), (5, 2, 13), (6, 2, 13)]},
    4: {"quota": {5: 250, 6: 250}, "conds": [(5, 3, 13), (6, 3, 13)]},
    5: {"quota": {5: 250, 6: 250}, "conds": [(5, 3, 12), (6, 3, 12)]},
}


def scaled_plan(per_level: int, l2_four: int | None, level_quota: dict[int, int] | None = None) -> dict:
    plan = json.loads(json.dumps({str(k): v for k, v in PLAN.items()}))
    out = {}
    for L, p in plan.items():
        L = int(L)
        total_L = (level_quota or {}).get(L, per_level)
        q = {int(n): c for n, c in p["quota"].items()}
        total = sum(q.values())
        nq = {n: total_L * c // total for n, c in q.items()}
        if L == 2 and l2_four is not None:
            nq = {4: l2_four, 5: total_L - l2_four}
        # 端数は大きい盤面へ
        diff = total_L - sum(nq.values())
        if diff:
            nq[max(nq)] += diff
        out[L] = {"quota": {n: c for n, c in nq.items() if c > 0}, "conds": [tuple(c) for c in p["conds"]]}
    return out


class Cache:
    """候補の記録（JSONL。同じ候補の行が複数あれば後の行。分類した行は分類する前の行を上書きする）。"""

    def __init__(self, path: str | None):
        self.path = path
        self.d: dict[tuple, dict] = {}
        if path and os.path.exists(path):
            with open(path) as fh:
                for line in fh:
                    r = json.loads(line)
                    self.d[tuple(r["job"])] = r
        self.fh = open(path, "a") if path else None

    def add(self, r):
        self.d[tuple(r["job"])] = r
        if self.fh:
            self.fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            self.fh.flush()


def _gen_many(jobs, cache: Cache, pool):
    todo = [j for j in jobs if j not in cache.d]
    if not todo:
        return
    it = pool.imap(generate_job, todo, chunksize=1) if pool else map(generate_job, todo)
    for r in it:
        cache.add(r)


def _cls_many(jobs, cache: Cache, pool):
    todo = [cache.d[j] for j in jobs if not is_classified(cache.d[j])]
    if not todo:
        return
    it = pool.imap(classify_record, todo, chunksize=1) if pool else map(classify_record, todo)
    for r in it:
        cache.add(r)


RULE_DECISIONS = ("example", "duplicate", "same-answer-d4", "near")


def _rule_decision(r, st, near: int, exclude_examples: bool, unique_d4_answer4: bool):
    """問題集の規則（分類に依らない）での (採否, 相手)。規則に当たらなければ (None, None)。
    相手は重複・同じ答え・近さで除いたときの、先に採った問題の [ID, 近さ]。"""
    keys = r["keys"]
    n = r["job"][0]
    sk = tuple(keys["sk"])
    if exclude_examples and sk in example_keys():
        return "example", None
    pk = tuple(keys["pk"])
    if pk in st["pk"]:
        return "duplicate", [st["pk"][pk], 0]
    if unique_d4_answer4 and n == 4 and tuple(keys["sk8"]) in st["sk8"]:
        return "same-answer-d4", [st["sk8"][tuple(keys["sk8"])], None]
    if near > 0:
        for o in st["by_sk"].get(sk, ()):
            d = near_distance(o["givens"], o["solution"], r["givens"], r["solution"])
            if d is not None and d <= near:
                return "near", [o["id"], d]
    return None, None


def _level_decision(L, r, cnt, quota, lk_cnt, sk_cnt, layout_cap, answer_cap):
    """分類に依る採否。"""
    if r["level"] != L:
        return "other-level" if r["level"] is not None else (r["reason"] or "out")
    if r["exact"][0] != 1:
        return "not-unique"
    n = r["job"][0]
    if cnt[n] >= quota.get(n, 0):
        return "size-full"
    keys = r["keys"]
    if layout_cap > 0 and lk_cnt[tuple(keys["lk"])] >= layout_cap:
        return "layout-cap"
    if answer_cap > 0 and sk_cnt[tuple(keys["sk"])] >= answer_cap:
        return "answer-cap"
    return "accept"


def assemble(plan, cache: Cache, pool=None, batch: int = 32, near: int = 0, layout_cap: int = 0,
             answer_cap: int = 0, exclude_examples: bool = True, unique_d4_answer4: bool = False,
             order: list[int] | None = None, max_visits: int = 0, progress: bool = False):
    """レベルごとに生成条件を巡回して候補を番号順に調べ、採る。

    採る条件（上から当てる。どれも満たした候補だけを採るので、採る問題は当てる順に依らない）:
      問題集の規則（分類に依らない）: 例の魔方陣と答えが同じ類でない / 問題のキー（G × 補数）が採った問題（レベルをまたぐ）と
      同じでない / unique_d4_answer4 なら、4×4 で、答えを回転・裏返しで同じとみなしたキーが採った問題（レベルをまたぐ）と同じで
      ない / near > 0 なら、答えが同じ類の採った問題との近さが near 以下でない。
      分類に依る条件: そのレベルに分類される / 答えが1つ / その盤面の件数が埋まっていない / layout_cap > 0 なら、同じレベルで
      同じ置き場所のキーの問題が layout_cap 問に届いていない / answer_cap > 0 なら、同じレベルで同じ答えのキーの問題が
      answer_cap 問に届いていない。
    候補はまず作ってキーを出し、規則に当たらない候補だけを分類する。作る・分類するは pool で並べて行い、採る順は1つずつ
    調べたときと同じにする（batch は先読みの数）。order はレベルを組む順（既定は 1 から）。max_visits > 0 なら、
    1つのレベルの流れで調べる候補をその数で打ち切る（作り切れないときの止め）。
    """
    accepted = {L: [] for L in plan}
    st = {"pk": {}, "sk8": {}, "by_sk": collections.defaultdict(list)}
    log = []
    visits = {L: collections.Counter() for L in plan}
    stalled = {}
    t_start = time.time()
    for L in (order or sorted(plan)):
        if L not in plan:
            continue
        quota = plan[L]["quota"]
        conds = plan[L]["conds"]
        nexti = {c: 0 for c in conds}
        ptr = 0
        cnt = collections.Counter()
        lk_cnt = collections.Counter()
        sk_cnt = collections.Counter()
        nvis = 0

        def active():
            return [c for c in conds if cnt[c[0]] < quota.get(c[0], 0)]

        def next_seq(p, ni, k):
            act = set(active())
            seq = []
            ni = dict(ni)
            while len(seq) < k:
                c = conds[p % len(conds)]
                p += 1
                if c not in act:
                    continue
                seq.append((c[0], c[1], c[2], ni[c]))
                ni[c] += 1
            return seq

        rule_args = (near, exclude_examples, unique_d4_answer4)
        while active():
            if max_visits and nvis >= max_visits:
                stalled[L] = {"visits": nvis, "accepted_by_size": dict(cnt)}
                break
            seq = next_seq(ptr, nexti, batch)
            _gen_many(seq, cache, pool)
            # 今の状態で規則に当たらない候補だけを分類する（後で当たるようになった候補の分類は無駄になるが、採否は変わらない）
            _cls_many([j for j in seq if _rule_decision(cache.d[j], st, *rule_args)[0] is None], cache, pool)
            act_before = active()
            for job in seq:
                c = job[:3]
                # 実際の巡回で次に来る条件まで ptr を進める
                while conds[ptr % len(conds)] != c or conds[ptr % len(conds)] not in act_before:
                    ptr += 1
                ptr += 1
                nexti[c] += 1
                nvis += 1
                r = cache.d[job]
                visits[L][c] += 1
                dec, partner = _rule_decision(r, st, *rule_args)
                if dec is None:
                    if not is_classified(r):
                        r = classify_record(r)
                        cache.add(r)
                    dec = _level_decision(L, r, cnt, quota, lk_cnt, sk_cnt, layout_cap, answer_cap)
                log.append((L, job, dec, partner))
                if dec == "accept":
                    n = job[0]
                    cnt[n] += 1
                    keys = r["keys"]
                    st["pk"][tuple(keys["pk"])] = r["id"]
                    if n == 4:
                        st["sk8"].setdefault(tuple(keys["sk8"]), r["id"])
                    st["by_sk"][tuple(keys["sk"])].append(r)
                    lk_cnt[tuple(keys["lk"])] += 1
                    sk_cnt[tuple(keys["sk"])] += 1
                    accepted[L].append(r)
                if active() != act_before or (max_visits and nvis >= max_visits):
                    break  # 巡回する条件が変わったので、先読みをやり直す
            if progress:
                print(f"L{L} {dict(cnt)} visits {nvis} cached {len(cache.d)} {time.time() - t_start:.0f}s",
                      file=sys.stderr, flush=True)
    return accepted, log, visits, stalled


def order_level(entries: list[dict]) -> list[dict]:
    """レベルの並び: 盤面ごとに採った順を保ち、盤面の件数の比で均等に混ぜる（j 番目の位置 (j+0.5)/件数 の順）。"""
    groups = collections.OrderedDict()
    for e in entries:
        groups.setdefault(e["job"][0], []).append(e)
    keyed = []
    for n, grp in groups.items():
        for j, e in enumerate(grp):
            keyed.append(((j + 0.5) / len(grp), n, j, e))
    keyed.sort(key=lambda x: (x[0], x[1], x[2]))
    return [x[3] for x in keyed]


def entry_string(givens) -> str:
    """実装の問題集の1問の形（problem-pool.ts の MagicSquareProblemPoolEntry）: 与える数を行優先で . でつなぎ、空きは 0。"""
    return ".".join(str(v) for v in givens)


def pool_json(levels: dict[int, list[dict]], workload: bool = False) -> str:
    """既存の問題集と同じ書き方（2字下げ、1問1行）で問題集の JSON を作る（大きさを測るため）。"""
    lines = ["{", '  "generatorVersion": "1",', '  "levels": {']
    Ls = sorted(levels)
    for li, L in enumerate(Ls):
        lines.append(f'    "{L}": [')
        es = levels[L]
        for j, e in enumerate(es):
            if workload:
                f = e["f"]
                item = json.dumps([entry_string(e["givens"]), f["empties"], f["entry"], f["hard"], f["depth_max"]],
                                  separators=(",", ":"))
            else:
                item = json.dumps(entry_string(e["givens"]))
            lines.append("      " + item + ("," if j + 1 < len(es) else ""))
        lines.append("    ]" + ("," if li + 1 < len(Ls) else ""))
    lines += ["  }", "}"]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# コマンド
# ---------------------------------------------------------------------------


def cmd_groups(a):
    out = {}
    for n in (4, 5, 6):
        g = line_group(n)
        d4 = d4_group(n)
        rec = {"line_automorphisms": len(g), "d4_in_group": all(p in set(g) for p in d4),
               "identity_first": g[0] == tuple(range(n * n))}
        gs = set(g)
        rec["closed_under_composition"] = all(tuple(b[a[c]] for c in range(n * n)) in gs for a in g for b in g)
        if n in (4, 5):
            rec["brute_force_equal"] = line_group_brute(n) == g
        if n == 4:
            vl = {frozenset(L) for L, _ in md.VIRTUAL4}
            rec["virtual_lines_preserved"] = all({frozenset(m[c] for c in L) for L in vl} == vl for m in g)
        out[n] = rec
    t = time.time()
    sq = md.all_squares4()
    out["squares4"] = {
        "total": len(sq),
        "classes_d4": len({canon(s, "D4", False) for s in sq}),
        "classes_d4_complement": len({canon(s, "D4", True) for s in sq}),
        "classes_G": len({canon(s, "G", False) for s in sq}),
        "classes_G_complement": len({canon(s, "G", True) for s in sq}),
        "seconds": round(time.time() - t, 1),
    }
    # G × 補数 の類ごとの大きさ（一様に選んだ答えが類に当たる重み）
    sizes = collections.Counter(canon(s, "G", True) for s in sq)
    out["squares4"]["class_size_distribution"] = dict(sorted(collections.Counter(sizes.values()).items()))
    # 回転・裏返しの類の大きさ（全部 8 なら、一様に選んだ答えは 880 類に一様に当たる）
    out["squares4"]["d4_class_sizes"] = dict(collections.Counter(collections.Counter(
        canon(s, "D4", False) for s in sq).values()))
    ex = example_squares()
    out["examples"] = {n: {"square": ex[n], "is_magic": md.is_magic(md.geo_of(n), ex[n]),
                           "orbit_size_G_complement": len({tuple(transform(ex[n], m, c)) for m in line_group(n)
                                                           for c in (False, True)})}
                       for n in ex}
    print(json.dumps(out, ensure_ascii=False, indent=1))


def cmd_check(a):
    """この観点のキャッシュで分類した候補と、難易度の観点の classify の結果（classified.jsonl）を、同じ候補 ID で比べる。
    候補の seed は生成条件と候補番号だけで決まるので、候補番号の小さい候補は両方にある。"""
    cache = Cache(None)
    with open(a.cache) as fh:
        for line in fh:
            r = json.loads(line)
            cache.d[tuple(r["job"])] = r
    ref = {}
    with open(a.classified) as fh:
        for line in fh:
            d = json.loads(line)
            ref[d["id"]] = d
    both = [r for r in cache.d.values() if is_classified(r) and r["id"] in ref]
    same_g = sum(1 for r in both if r["givens"] == ref[r["id"]]["givens"])
    same_lv = sum(1 for r in both if r["level"] == ref[r["id"]]["level"])
    same_why = sum(1 for r in both if (r["level"], r["reason"]) == (ref[r["id"]]["level"], ref[r["id"]]["reason"]))
    bad = [(r["id"], r["level"], r["reason"], ref[r["id"]]["level"], ref[r["id"]]["reason"]) for r in both
           if r["level"] != ref[r["id"]]["level"]]
    by = collections.Counter(f"{r['job'][0]}-{r['job'][1]}-{r['job'][2]}" for r in both)
    print(json.dumps({"compared": len(both), "same_givens": same_g, "same_level": same_lv,
                      "same_level_and_reason": same_why, "level_mismatch": bad[:10],
                      "by_condition": dict(sorted(by.items()))}, ensure_ascii=False, indent=1))


def cmd_pool(a):
    lq = {int(x.split("=")[0]): int(x.split("=")[1]) for x in (a.level_quota or [])}
    plan = scaled_plan(a.per_level, a.l2_four, lq)
    if a.levels:
        plan = {L: v for L, v in plan.items() if L in a.levels}
    order = a.level_order or sorted(plan)
    order = [L for L in order if L in plan] + [L for L in sorted(plan) if L not in order]
    cache = Cache(a.cache)
    import multiprocessing as mp
    pool = mp.Pool(a.jobs) if a.jobs > 1 else None
    t0 = time.time()
    try:
        accepted, log, visits, stalled = assemble(
            plan, cache, pool, batch=a.batch, near=a.near, layout_cap=a.layout_cap, answer_cap=a.answer_cap,
            unique_d4_answer4=a.unique_d4_answer4, order=order, max_visits=a.max_visits, progress=a.progress)
    finally:
        if pool:
            pool.close()
            pool.join()
    wall = time.time() - t0
    out = {"plan": {L: {"quota": p["quota"], "conds": p["conds"]} for L, p in plan.items()},
           "order": order,
           "options": {"near": a.near, "layout_cap": a.layout_cap, "answer_cap": a.answer_cap,
                       "unique_d4_answer4": a.unique_d4_answer4, "examples": sorted(example_squares()),
                       "max_visits": a.max_visits},
           "stalled": {str(k): v for k, v in stalled.items()},
           "wall_seconds": round(wall, 1), "jobs": a.jobs,
           "levels": {L: [e["id"] for e in order_level(accepted[L])] for L in accepted},
           "log": [[L, list(job), dec, partner] for L, job, dec, partner in log]}
    with open(a.out, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"pool -> {a.out} ({wall:.0f}s wall, {len(cache.d)} candidates cached, stalled {stalled})", file=sys.stderr)


def _load_cache(cache_path) -> Cache:
    cache = Cache(None)
    with open(cache_path) as fh:
        for line in fh:
            r = json.loads(line)
            cache.d[tuple(r["job"])] = r
    return cache


def _load_pool(path, cache_path):
    p = json.load(open(path))
    cache = _load_cache(cache_path)
    by_id = {r["id"]: r for r in cache.d.values()}
    levels = {int(L): [by_id[i] for i in ids] for L, ids in p["levels"].items()}
    return p, cache, levels


def _q(xs, qs=(0.5, 0.95)):
    if not xs:
        return "-"
    s = sorted(xs)
    return " / ".join(f"{s[min(len(s) - 1, int(q * (len(s) - 1) + 0.5))]:.2f}" for q in qs)


def _spent(r, dec) -> float:
    """その組み立てで要った CPU: 作る時間と、規則で除かなかった候補なら分類と答えを数える時間。"""
    c = r["cpu"]
    return c[0] + (0.0 if dec in RULE_DECISIONS else c[1] + c[2])


def cmd_analyze(a):
    p, cache, levels = _load_pool(a.pool, a.cache)
    log = p["log"]
    out = []
    # 収率と時間（レベルの流れで調べた候補）
    out.append("## 収率と時間（CPU 秒は研究用 Python 1プロセスの CPU 時間）")
    out.append(f"組んだ順: {p.get('order')}。打ち切った流れ: {p.get('stalled') or 'なし'}")
    out.append("")
    out.append("| レベル | 盤面 | 生成条件 | 調べた候補 | 規則で除いた | 分類した | そのレベルに当たった | 採った | 当たる割合 | "
               "分類した1候補の CPU p50 / p95 | 採った1問あたりの CPU |")
    out.append("|---|---|---|---|---|---|---|---|---|---|---|")
    per_level_cpu = {}
    for L in sorted(levels):
        rows = collections.defaultdict(lambda: [0, 0, 0, 0, 0, [], 0.0])
        for L2, job, dec, *_ in log:
            if L2 != L:
                continue
            r = cache.d[tuple(job)]
            key = tuple(job[:3])
            row = rows[key]
            row[0] += 1
            if dec in RULE_DECISIONS:
                row[1] += 1
            else:
                row[2] += 1
                row[3] += int(r["level"] == L)
                row[5].append(sum(r["cpu"]))
            row[4] += int(dec == "accept")
            row[6] += _spent(r, dec)
        tot_cpu = 0.0
        for key in sorted(rows, key=lambda c: (c[0], c[1], c[2])):
            v, ruled, ncls, hit, acc, cpus, spent = rows[key]
            tot_cpu += spent
            out.append(f"| {L} | {key[0]}×{key[0]} | T{key[1]} k{key[2]} | {v} | {ruled} | {ncls} | {hit} | {acc} | "
                       f"{hit / max(ncls, 1):.0%} | {_q(cpus)} | {spent / max(acc, 1):.2f} |")
        per_level_cpu[L] = tot_cpu
    visited = {}
    for _, job, dec, *_ in log:
        visited.setdefault(tuple(job), dec)
        if dec not in RULE_DECISIONS:
            visited[tuple(job)] = dec
    uniq_cpu = sum(_spent(cache.d[j], d) for j, d in visited.items())
    out.append("")
    out.append("レベルごとの CPU 秒（そのレベルの流れで調べた候補の、作る時間と、規則で除かなかった候補の分類・答えを数える時間）: "
               + "、".join(f"L{L} {per_level_cpu[L]:.0f}" for L in sorted(per_level_cpu))
               + f"。調べた候補 {len(visited)}（重ねずに数えて CPU {uniq_cpu:.0f} 秒）。壁時計 {p['wall_seconds']} 秒"
               f"（{p['jobs']} プロセス、ほかの計測と CPU を分け合った。キャッシュにあった候補は作り直していない）")
    dec = collections.Counter((L, d) for L, _, d, *_ in log)
    out.append("")
    out.append("採らなかった理由（レベルの流れごと）: " + "; ".join(
        f"L{L}: " + ", ".join(f"{d} {c}" for (L2, d), c in sorted(dec.items()) if L2 == L) for L in sorted(levels)))
    by_size = collections.Counter((L, job[0], d) for L, job, d, *_ in log if d in RULE_DECISIONS)
    out.append("規則で除いた候補の盤面ごとの内訳: " + "、".join(
        f"L{L} {n}×{n} {d} {c}" for (L, n, d), c in sorted(by_size.items())))
    # 流れの進み方: 盤面ごとに、採った数で4つに分けた区間ごとの、調べた候補・規則で除いた割合・分類した候補の当たる割合
    out.append("")
    out.append("流れの区間ごと（盤面ごとに採った数で4つに分けた。調べた候補 / 規則で除いた割合 / 分類した候補の当たる割合）:")
    for L in sorted(levels):
        for n in (4, 5, 6):
            q = sum(1 for r in levels[L] if r["job"][0] == n)
            if not q:
                continue
            seg = [[0, 0, 0, 0] for _ in range(4)]
            acc_n = 0
            for L2, job, d, *_ in log:
                if L2 != L or job[0] != n:
                    continue
                s = seg[min(3, acc_n * 4 // q)]
                s[0] += 1
                if d in RULE_DECISIONS:
                    s[1] += 1
                else:
                    s[2] += 1
                    s[3] += int(cache.d[tuple(job)]["level"] == L)
                acc_n += int(d == "accept")
            out.append(f"- L{L} {n}×{n}（{q}問）: " + "、".join(
                f"{i * q // 4}〜{(i + 1) * q // 4}問目 {s[0]} / {s[1] / max(s[0], 1):.0%} / {s[3] / max(s[2], 1):.0%}"
                for i, s in enumerate(seg)))
    # 一意解
    allr = [cache.d[j] for j, d in visited.items() if d not in RULE_DECISIONS]
    out.append("")
    out.append(f"一意解: 分類した候補 {len(allr)} のうち答えが1つ {sum(1 for r in allr if r['exact'][0] == 1)}、"
               f"打ち切り {sum(r['exact'][2] for r in allr)}。採った問題 {sum(len(v) for v in levels.values())} は全部 "
               f"{'一意解' if all(r['exact'][0] == 1 for v in levels.values() for r in v) else '一意解でないものを含む'}")
    acc = [r for v in levels.values() for r in v]
    out.append(f"採った問題を分類し直して答えを数える CPU（--verify の目安）: 合計 {sum(r['cpu'][1] + r['cpu'][2] for r in acc):.0f} 秒"
               f"（1問 p50 / p95 {_q([r['cpu'][1] + r['cpu'][2] for r in acc])} 秒）。レベル・盤面ごと: " + "、".join(
                   f"L{L} {n}×{n} 合計 {sum(r['cpu'][1] + r['cpu'][2] for r in levels[L] if r['job'][0] == n):.0f} 秒"
                   f"（1問 p50 / p95 {_q([r['cpu'][1] + r['cpu'][2] for r in levels[L] if r['job'][0] == n])}）"
                   for L in sorted(levels) for n in (4, 5, 6) if any(r["job"][0] == n for r in levels[L])))
    nodes = {n: [r["exact"][1] for v in levels.values() for r in v if r["job"][0] == n] for n in (4, 5, 6)}
    out.append("一意性の確かめの節点（採った問題）: " + "、".join(
        f"{n}×{n} p50 {statistics.median(xs):.0f}・最大 {max(xs)}" for n, xs in nodes.items() if xs))
    caps = sum(1 for r in acc if r["f"].get("capped_reads", 0))
    out.append(f"読むモデルの単位の読みの打ち切りがあった採った問題: {caps}")
    # 4×4 の答えの使い方
    four = [r for v in levels.values() for r in v if r["job"][0] == 4]
    if four:
        out.append(f"4×4 の採った問題 {len(four)}: 答えの類 回転・裏返し {len({tuple(r['keys']['sk8']) for r in four})}・"
                   f"G × 補数 {len({tuple(r['keys']['sk']) for r in four})}（880 類・166 類のうち）")
    # 版 4 の 5×5 の例の魔方陣と答えが同じ類の候補（除外を外したときに問題集が変わるか）
    ex5 = canon(EXAMPLE5_V4, "G", True)
    five = [cache.d[j] for j in visited if j[0] == 5]
    out.append(f"版 4 の 5×5 の例の魔方陣と答えが同じ類の候補: 調べた 5×5 の候補 {len(five)} のうち "
               f"{sum(1 for r in five if tuple(r['keys']['sk']) == ex5)}")
    # 生成条件の内訳（E2）
    out.append("")
    out.append("## 生成条件と盤面の内訳（E2）")
    for L in sorted(levels):
        c = collections.Counter(tuple(r["job"][:3]) for r in levels[L])
        out.append(f"- L{L}（{len(levels[L])}問）: " + "、".join(
            f"{k[0]}×{k[0]} T{k[1]} k{k[2]} {v}（{v / len(levels[L]):.0%}）" for k, v in sorted(c.items())))
    # 重複と近さ（E3）
    out.append("")
    out.append("## 重複・同じ答え・近さ・同じ置き場所・指紋（E3）")
    out.append("| レベル | 盤面 | 問題 | 問題の重複 D4 / G×補数 | 答えの類 D4 / G×補数 | 同じ答え（G×補数）の問題 | 1つの答えの最多 | 同じ答えの組 | 近さ ≤2 / ≤4 / ≤6 の組 | 置き場所の類 | 1つの置き場所の最多 | 指紋 | 1つの指紋の最多 |")
    out.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    near_rows = []
    for L in sorted(levels):
        for n in (4, 5, 6):
            es = [r for r in levels[L] if r["job"][0] == n]
            if not es:
                continue
            out.append(_dup_row(f"{L}", n, es, near_rows))
    es = [r for L in (1, 2) if L in levels for r in levels[L] if r["job"][0] == 4]
    if es:
        out.append(_dup_row("1+2", 4, es, near_rows))
    for n in (5, 6):
        es = [r for L in levels for r in levels[L] if r["job"][0] == n]
        if es:
            out.append(_dup_row("全", n, es, near_rows))
    if near_rows:
        out.append("")
        out.append("近さ ≤4 の組（レベル, 盤面, 2問の ID, 近さ, 与える数の数）: " + "; ".join(near_rows[:12]))
    # 指紋の最多の形
    for L in sorted(levels):
        for n in (4, 5, 6):
            es = [r for r in levels[L] if r["job"][0] == n]
            if es:
                fp = collections.Counter(json.dumps(r["trace"]) for r in es).most_common(1)[0]
                out.append(f"- L{L} {n}×{n} の最多の指紋: {fp[0]}（{fp[1]}問）")
    # 5×5・6×6 の答えどうしの近さ（乱択の探索の偏りで、似た魔方陣が多く出ていないか）
    out.append("")
    for n in (5, 6):
        sols = {}
        for v in levels.values():
            for r in v:
                if r["job"][0] == n:
                    sols.setdefault(tuple(r["keys"]["sk"]), r["solution"])
        if len(sols) < 2:
            continue
        agree = [_best_agreement(x, y) for x, y in _sample_pairs(list(sols.values()), 1500, seed=n)]
        top = _nearest_answers(list(sols.values()))
        out.append(f"- {n}×{n} の答え {len(sols)} 類: 無作為の 1,500 組で、写して一致するマスの最多 p50 {statistics.median(agree):.0f}"
                   f"・p99 {sorted(agree)[int(0.99 * (len(agree) - 1))]}・最大 {max(agree)}（全 {n * n} マス）。"
                   f"全部の組で代表の形どうしが一致するマスの最大 {top[0]}、そのうち写して一致するマスの最多 {top[1]}")
    # 大きさ（E4）
    out.append("")
    out.append("## 問題集の大きさ（E4）")
    for wl in (False, True):
        s = pool_json(levels, workload=wl).encode()
        gz = len(gzip.compress(s, 9))
        nprob = sum(len(v) for v in levels.values())
        out.append(f"- {'与える数の文字列＋作業の量4つ' if wl else '与える数の文字列だけ（今の実装の形）'}: "
                   f"{len(s):,} B（gzip -9 {gz:,} B、1問あたり {len(s) / nprob:.0f} B）")
    out.append("- レベル・盤面ごとの1問の文字列の長さ（引用符・字下げ・改行を含む行の長さ）の平均と、与える数の数の p50: " + "、".join(
        f"L{L} {n}×{n} {statistics.fmean(len(json.dumps(entry_string(r['givens']))) + 8 for r in levels[L] if r['job'][0] == n):.1f} B"
        f"・{statistics.median(r['f']['givens'] for r in levels[L] if r['job'][0] == n):.0f}"
        for L in sorted(levels) for n in (4, 5, 6) if any(r["job"][0] == n for r in levels[L])))
    if a.write_json:
        with open(a.write_json, "w") as fh:
            fh.write(pool_json(levels))
    print("\n".join(out))


def _best_agreement(x, y) -> int:
    """x を G × 補数で写して y と一致するマスの数の最大。"""
    n = int(round(len(x) ** 0.5))
    best = 0
    for m in line_group(n):
        for comp in (False, True):
            t = transform(x, m, comp)
            best = max(best, sum(1 for a, b in zip(t, y) if a == b))
    return best


def _sample_pairs(xs, k, seed):
    rng = random.Random(seed)
    return [tuple(rng.sample(xs, 2)) for _ in range(k)]


def _nearest_answers(sols):
    """代表の形（canon）どうしで一致するマスが最も多い組と、その組を写して一致するマスの最多。"""
    cs = [canon(s, "G", True) for s in sols]
    best, pair = -1, None
    for i in range(len(cs)):
        for j in range(i + 1, len(cs)):
            a = sum(1 for p, q in zip(cs[i], cs[j]) if p == q)
            if a > best:
                best, pair = a, (i, j)
    return best, _best_agreement(sols[pair[0]], sols[pair[1]])


def _dup_row(label, n, es, near_rows):
    pk = collections.Counter(tuple(r["keys"]["pk"]) for r in es)
    pk8 = collections.Counter(tuple(r["keys"]["pk8"]) for r in es)
    sk = collections.Counter(tuple(r["keys"]["sk"]) for r in es)
    sk8 = collections.Counter(tuple(r["keys"]["sk8"]) for r in es)
    lk = collections.Counter(tuple(r["keys"]["lk"]) for r in es)
    fp = collections.Counter(json.dumps(r["trace"]) for r in es)
    dup8 = sum(c - 1 for c in pk8.values())
    dupG = sum(c - 1 for c in pk.values())
    shared = sum(c for c in sk.values() if c > 1)
    groups = collections.defaultdict(list)
    for r in es:
        groups[tuple(r["keys"]["sk"])].append(r)
    pairs = 0
    near = collections.Counter()
    for grp in groups.values():
        for x, y in itertools.combinations(grp, 2):
            pairs += 1
            d = near_distance(x["givens"], x["solution"], y["givens"], y["solution"])
            for th in (2, 4, 6):
                if d is not None and d <= th:
                    near[th] += 1
            if d is not None and d <= 4:
                near_rows.append(f"({label}, {n}×{n}, {x['id']} / {y['id']}, {d}, {x['f']['givens']}・{y['f']['givens']})")
    return (f"| {label} | {n}×{n} | {len(es)} | {dup8} / {dupG} | {len(sk8)} / {len(sk)} | {shared} | "
            f"{max(sk.values())} | {pairs} | {near[2]} / {near[4]} / {near[6]} | {len(lk)} | {max(lk.values())} | "
            f"{len(fp)} | {max(fp.values())} |")


def _inv_job(args):
    rid, n, g, lv, which, seed = args
    rng = random.Random(seed)
    G = line_group(n)
    D4 = set(d4_group(n))
    if which == "d4":
        m = rng.choice([x for x in sorted(D4) if x != tuple(range(n * n))])
        comp = False
    elif which == "line":
        m = rng.choice([x for x in G if x not in D4])
        comp = False
    elif which == "complement":
        m = tuple(range(n * n))
        comp = True
    else:
        m = rng.choice(G[1:])
        comp = True
    g2 = transform(g, m, comp)
    t = time.process_time()
    lv2, why2 = md.classify_givens(n, g2, SIZES)
    return {"id": rid, "n": n, "which": which, "level": lv, "level2": lv2, "reason2": why2,
            "cpu": time.process_time() - t}


def cmd_invariance(a):
    if a.pool:
        _, _, levels = _load_pool(a.pool, a.cache)
    else:  # キャッシュの範囲内の候補から選ぶ（候補番号の順）
        levels = collections.defaultdict(list)
        with open(a.cache) as fh:
            for line in fh:
                r = json.loads(line)
                if is_classified(r) and r["level"] is not None and r["exact"][0] == 1:
                    levels[r["level"]].append(r)
        for v in levels.values():
            v.sort(key=lambda r: tuple(r["job"]))
    rng = random.Random(a.seed)
    jobs = []
    for L in sorted(levels):
        for n in (4, 5, 6):
            es = [r for r in levels[L] if r["job"][0] == n]
            if not es:
                continue
            pick = rng.sample(es, min(a.per, len(es)))
            for r in pick:
                for which in ("d4", "line", "complement", "line+complement"):
                    jobs.append((r["id"], n, r["givens"], L, which, rng.randrange(1 << 30)))
    import multiprocessing as mp
    with mp.Pool(a.jobs) as pool:
        rs = pool.map(_inv_job, jobs, chunksize=1)
    tab = collections.defaultdict(lambda: [0, 0])
    moved = collections.Counter()
    for r in rs:
        k = (r["level"], r["n"], r["which"])
        tab[k][0] += 1
        tab[k][1] += int(r["level2"] != r["level"])
        if r["level2"] != r["level"]:
            moved[(r["which"], r["level"], r["level2"], r["reason2"])] += 1
    print("| レベル | 盤面 | 写し方 | 問題 | レベルが変わった |")
    print("|---|---|---|---|---|")
    for k in sorted(tab):
        print(f"| {k[0]} | {k[1]}×{k[1]} | {k[2]} | {tab[k][0]} | {tab[k][1]} |")
    tot = collections.defaultdict(lambda: [0, 0])
    for (L, n, w), (c, m) in tab.items():
        tot[w][0] += c
        tot[w][1] += m
    print()
    print("写し方ごとの合計: " + "、".join(f"{w} {m}/{c}" for w, (c, m) in sorted(tot.items())))
    print("変わった先: " + "; ".join(f"{w} L{a_}→{b}（{why}）{c}" for (w, a_, b, why), c in sorted(moved.items(), key=str)))
    print(f"分類の CPU 合計 {sum(r['cpu'] for r in rs):.0f} 秒")


def cmd_recheck(a):
    """キャッシュの候補を作り直し（分類した候補は分類もし直し）、時間を除いて同じ結果になるかを確かめる（seed の再現）。"""
    cache = _load_cache(a.cache)
    rng = random.Random(a.seed)
    jobs = sorted(j for j, r in cache.d.items() if is_classified(r))
    pick = rng.sample(jobs, min(a.n, len(jobs)))
    import multiprocessing as mp
    with mp.Pool(a.jobs) as pool:
        gen = pool.map(generate_job, pick, chunksize=1)
        rs = pool.map(classify_record, gen, chunksize=1)
    bad = [r["id"] for r in rs if {k: v for k, v in r.items() if k != "cpu"}
           != {k: v for k, v in cache.d[tuple(r["job"])].items() if k != "cpu"}]
    print(json.dumps({"rechecked": len(rs), "mismatch": bad,
                      "by_condition": dict(collections.Counter(f"{j[0]}-{j[1]}-{j[2]}" for j in pick))},
                     ensure_ascii=False))


def cmd_examples(a):
    ex = dict(example_squares())
    out = {}
    for n, sq in list(ex.items()) + [(5, EXAMPLE5_V4)]:
        orbit = {tuple(transform(sq, m, c)) for m in line_group(n) for c in (False, True)}
        rec = {"square": sq, "rows": [sq[r * n:(r + 1) * n] for r in range(n)], "orbit_G_complement": len(orbit),
               "orbit_D4": len({tuple(transform(sq, m)) for m in d4_group(n)}),
               "excluded_from_pool": n in ex}
        if n == 4:
            sq4 = md.all_squares4()
            rec["share_of_4x4_squares"] = f"{sum(1 for s in sq4 if tuple(s) in orbit)}/{len(sq4)}"
        out[n] = rec
    if a.cache and a.pool:
        p, cache, levels = _load_pool(a.pool, a.cache)
        hit = collections.Counter()
        for L, job, dec, *_ in p["log"]:
            if dec == "example":
                hit[(L, job[0])] += 1
        out["excluded_in_pool_run"] = {f"L{L} {n}x{n}": c for (L, n), c in sorted(hit.items())}
    print(json.dumps(out, ensure_ascii=False, indent=1))


def _case_of(cid, n, g, s):
    """期待値の1問: 同型のキーと版 8 の分類。"""
    lv, why = md.classify_givens(n, g, SIZES)
    keys = problem_keys(g, s)
    return {"id": cid, "n": n, "givens": g, "solution": s, "level": lv, "reason": why,
            "problem_key": list(keys["pk"]), "problem_key_d4": list(keys["pk8"]),
            "solution_key": list(keys["sk"]), "solution_key_d4": list(keys["sk8"]),
            "layout_key": list(keys["lk"])}


def cmd_expected(a):
    """移植の期待値（検査 F2）。製品の乱数は Python と一致しないので、問題ごとの値（同型のキー・近さ・例の除外・
    分類）と、与えた候補の列からの採否（組み立ての規則）を固定する。

    --cases-from を渡すと、cases・transformed・near_pairs はその期待値の盤面を保ち、値（キー・近さ）をこのコードで
    出し直し、cases の level（と範囲外の理由 reason）を版 8 の分類にする。渡さなければ pool から選ぶ。"""
    p, cache, levels = _load_pool(a.pool, a.cache)
    rng = random.Random(a.seed)
    cases = []
    transformed = []
    near_pairs = []

    def near_pair_of(x):
        return {"a": x["a"], "b": x["b"], "a_givens": x["a_givens"], "a_solution": x["a_solution"],
                "b_givens": x["b_givens"], "b_solution": x["b_solution"],
                "distance": near_distance(x["a_givens"], x["a_solution"], x["b_givens"], x["b_solution"])}

    if a.cases_from:
        old = json.load(open(a.cases_from))
        import multiprocessing as mp
        with mp.Pool(a.jobs) as pool:
            cases = pool.starmap(_case_of, [(c["id"], c["n"], c["givens"], c["solution"]) for c in old["cases"]],
                                 chunksize=1)
        for t in old["transformed"]:
            transformed.append({"of": t["of"], "map": t["map"], "complement": t["complement"],
                                "givens": transform(next(c["givens"] for c in old["cases"] if c["id"] == t["of"]),
                                                    t["map"], t["complement"]),
                                "solution": transform(next(c["solution"] for c in old["cases"] if c["id"] == t["of"]),
                                                      t["map"], t["complement"]),
                                "problem_key": None, "solution_key": None})
            x = transformed[-1]
            x["problem_key"] = list(canon(x["givens"], "G", True))
            x["solution_key"] = list(canon(x["solution"], "G", True))
        near_pairs = [near_pair_of(x) for x in old["near_pairs"]]
        same = {
            "cases": [{k: v for k, v in c.items() if k not in ("level", "reason")} for c in cases]
            == [{k: v for k, v in c.items() if k != "level"} for c in old["cases"]],
            "transformed": transformed == old["transformed"], "near_pairs": near_pairs == old["near_pairs"]}
        print(f"--cases-from と同じ値（level を除く）: {same}", file=sys.stderr)
    else:
        picked = []
        for L in sorted(levels):
            for n in (4, 5, 6):
                es = [r for r in levels[L] if r["job"][0] == n]
                if es:
                    picked += rng.sample(es, min(a.per, len(es)))
        cases = [_case_of(r["id"], r["job"][0], r["givens"], r["solution"]) for r in picked]
        for r in picked[: a.per * 3]:
            n = r["job"][0]
            G = line_group(n)
            m = G[rng.randrange(1, len(G))]
            comp = bool(rng.randrange(2))
            g2 = transform(r["givens"], m, comp)
            s2 = transform(r["solution"], m, comp)
            transformed.append({"of": r["id"], "map": list(m), "complement": comp, "givens": g2, "solution": s2,
                                "problem_key": list(canon(g2, "G", True)), "solution_key": list(canon(s2, "G", True))})
        four = [r for L in (1, 2) if L in levels for r in levels[L] if r["job"][0] == 4]
        groups = collections.defaultdict(list)
        for r in four:
            groups[tuple(r["keys"]["sk"])].append(r)
        for grp in list(groups.values()):
            for x, y in itertools.combinations(grp, 2):
                near_pairs.append(near_pair_of({"a": x["id"], "b": y["id"], "a_givens": x["givens"],
                                                "a_solution": x["solution"], "b_givens": y["givens"],
                                                "b_solution": y["solution"]}))
                if len(near_pairs) >= a.per * 4:
                    break
            if len(near_pairs) >= a.per * 4:
                break
        for r in picked[:4]:
            g2 = list(r["givens"])
            gv = [c for c in range(len(g2)) if g2[c]]
            em = [c for c in range(len(g2)) if not g2[c]]
            c_out, c_in = gv[0], em[-1]
            g2[c_out] = 0
            g2[c_in] = r["solution"][c_in]
            near_pairs.append(near_pair_of({"a": r["id"], "b": r["id"] + "-moved", "a_givens": r["givens"],
                                            "a_solution": r["solution"], "b_givens": g2, "b_solution": r["solution"]}))
    ex = example_squares()
    sq4 = md.all_squares4()
    ex_orbit4 = {tuple(transform(ex[4], m, c)) for m in line_group(4) for c in (False, True)}
    example_cases = {
        "squares": {str(n): sq for n, sq in ex.items()},
        "solution_keys": {str(n): list(canon(sq, "G", True)) for n, sq in ex.items()},
        "excluded_4x4_squares": sorted(list(s) for s in ex_orbit4),
        "excluded_4x4_count": sum(1 for s in sq4 if tuple(s) in ex_orbit4),
    }
    # 組み立ての規則: pool の記録の、レベルの流れごとの最初の候補と、採否の規則（例・重複・同じ答え・近さ）で
    # 除いた候補（先に採った相手と一緒に）
    by_id = {r["id"]: r for r in cache.d.values()}

    def item(L, job, dec, partner):
        r = cache.d[tuple(job)]
        if not is_classified(r):  # 規則で除いて分類しなかった候補も、期待値には分類を書く
            r = classify_record(r)
        x = {"level_stream": L, "candidate": r["id"], "seed": r["seed"], "n": job[0], "givens": r["givens"],
             "solution": r["solution"], "solutions_counted": r["exact"][0], "exact_nodes": r["exact"][1],
             "classified_level": r["level"], "reason": r["reason"], "decision": dec}
        if partner:
            o = by_id[partner[0]]
            x["partner"] = {"id": o["id"], "givens": o["givens"], "solution": o["solution"], "distance": partner[1]}
        return x

    trace = []
    per = collections.Counter()
    rule = collections.Counter()
    for L, job, dec, *rest in p["log"]:
        partner = rest[0] if rest else None
        if per[L] < a.trace:
            per[L] += 1
            trace.append(item(L, job, dec, partner))
        elif dec in RULE_DECISIONS and rule[dec] < a.trace // 4:
            rule[dec] += 1
            trace.append(item(L, job, dec, partner))
    out = {
        "about": "魔方陣の問題供給の調査コード（magic_square_supply.py、難易度は版 8）の移植の期待値。同型のキー（列の構造の自己同型"
                 " G × 補数）・近さ・例の魔方陣の除外・問題集の組み立ての採否を、同じ盤面で突き合わせるために使う。候補の盤面は Python の"
                 " random で作ったもので、移植したコードの乱数とは一致しない。cases・transformed・near_pairs の盤面は版 4 の期待値と同じで"
                 "（ID は版 4 の候補。版 8 の生成器で同じ ID から作る盤面とは違うことがある）、level と reason は版 8 の分類"
                 "（classify_givens。範囲外なら level は null で reason に理由）。assembly_trace は版 8 の問題集の組み立てで、"
                 "レベルの流れごとの最初の候補と、採否の規則で除いた候補（partner は先に採った相手）。規則（例・重複・同じ答え・近さ）は"
                 "分類より先に当てる。solutions_counted と exact_nodes は完全な解法器（2解で止める、200万節点で打ち切り）の値。"
                 "pool_summary は組んだ問題集（plan の件数。L3〜L5 は標本）。",
        "group_sizes": {str(n): len(line_group(n)) for n in (4, 5, 6)},
        "group_generator": "横の並べ替え s（s(n-1-i) = n-1-s(i)）、縦の並べ替え t = s か t = r∘s（r(i) = n-1-i）、転置の有無。"
                           "そのうち縦・横・斜めの列を列へ移すもの。m[マス] = 写した先のマス、写した盤面 out[m[c]] = cells[c]",
        "key_definition": "写した盤面（G の各元、補数あり・なし）を行優先の数の列にして、辞書順で最小のもの。空きは 0。補数は v → n²+1−v",
        "near_definition": "答えのキーが同じ2問で、a の答えを b の答えへ写す変換（G × 補数）のうち、a の与える数のある所を写した集合と"
                           " b の与える数のある所の対称差の大きさの最小",
        "squares4": {"total": len(sq4), "classes_d4": len({canon(s, "D4", False) for s in sq4}),
                     "classes_G_complement": len({canon(s, "G", True) for s in sq4})},
        "plan": {str(L): {"quota": {str(n): c for n, c in v["quota"].items()}, "conds": [list(c) for c in v["conds"]]}
                 for L, v in p["plan"].items()},
        "order": p.get("order"),
        "options": p["options"],
        "order_rule": "レベルの中は盤面ごとに採った順を保ち、j 番目（0 始まり）に (j+0.5)/その盤面の件数 を付け、"
                      "(その値, 盤面の一辺, j) の小さい順に並べる",
        "cases": cases,
        "transformed": transformed,
        "near_pairs": near_pairs,
        "examples": example_cases,
        "assembly_trace": trace,
        "pool_summary": {str(L): {"count": len(v), "by_size": {str(n): sum(1 for r in v if r["job"][0] == n)
                                                               for n in (4, 5, 6) if any(r["job"][0] == n for r in v)},
                                  "first_ids": [r["id"] for r in v[:10]]}
                         for L, v in sorted(levels.items())},
    }
    with open(a.out, "w") as fh:
        fh.write(_dumps_compact(out) + "\n")
    print(f"{len(cases)} cases, {len(transformed)} transformed, {len(near_pairs)} near pairs, {len(trace)} trace -> {a.out}",
          file=sys.stderr)


def _dumps_compact(x, ind: int = 0) -> str:
    """辞書は1字下げで開き、数と文字列だけの配列は1行に書く（差分を読みやすくするため）。"""
    pad = " " * ind
    if isinstance(x, dict):
        if not x:
            return "{}"
        items = [f'{pad} {json.dumps(str(k), ensure_ascii=False)}: {_dumps_compact(v, ind + 1)}' for k, v in x.items()]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(x, (list, tuple)):
        if all(not isinstance(v, (dict, list, tuple)) for v in x):
            return json.dumps(list(x), ensure_ascii=False, separators=(",", ":"))
        items = [pad + " " + _dumps_compact(v, ind + 1) for v in x]
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    return json.dumps(x, ensure_ascii=False)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("groups")
    q.set_defaults(fn=cmd_groups)
    q = sub.add_parser("check")
    q.add_argument("--cache", required=True)
    q.add_argument("--classified", required=True, help="難易度の観点の classify の出力（classified.jsonl）")
    q.set_defaults(fn=cmd_check)
    q = sub.add_parser("pool")
    q.add_argument("--per-level", type=int, default=500)
    q.add_argument("--level-quota", nargs="*", default=None, help="レベルごとの件数（例 3=100）。盤面の比は PLAN のまま")
    q.add_argument("--l2-four", type=int, default=None, help="L2 の 4×4 の件数（既定は PLAN の比）")
    q.add_argument("--near", type=int, default=0, help="答えが同じ類で近さがこれ以下の問題を採らない（0 で当てない）")
    q.add_argument("--layout-cap", type=int, default=0)
    q.add_argument("--answer-cap", type=int, default=0)
    q.add_argument("--unique-d4-answer4", action="store_true",
                   help="4×4 の答えを、回転・裏返しで同じとみなして問題集の中で1度だけ使う")
    q.add_argument("--cache", required=True, help="候補のキャッシュ（JSONL。あれば読んで続きから）")
    q.add_argument("--out", required=True)
    q.add_argument("--jobs", type=int, default=2)
    q.add_argument("--batch", type=int, default=32)
    q.add_argument("--levels", type=int, nargs="*", default=None, help="組むレベル（試すとき。既定は全部）")
    q.add_argument("--level-order", type=int, nargs="*", default=None, help="レベルを組む順（既定は 1 から）")
    q.add_argument("--max-visits", type=int, default=0, help="1つのレベルの流れで調べる候補の上限（0 で無し）")
    q.add_argument("--progress", action="store_true")
    q.set_defaults(fn=cmd_pool)
    q = sub.add_parser("analyze")
    q.add_argument("--pool", required=True)
    q.add_argument("--cache", required=True)
    q.add_argument("--write-json", default=None)
    q.set_defaults(fn=cmd_analyze)
    q = sub.add_parser("invariance")
    q.add_argument("--pool", default=None)
    q.add_argument("--cache", required=True)
    q.add_argument("--per", type=int, default=40)
    q.add_argument("--seed", type=int, default=1)
    q.add_argument("--jobs", type=int, default=2)
    q.set_defaults(fn=cmd_invariance)
    q = sub.add_parser("recheck")
    q.add_argument("--cache", required=True)
    q.add_argument("--n", type=int, default=40)
    q.add_argument("--seed", type=int, default=3)
    q.add_argument("--jobs", type=int, default=2)
    q.set_defaults(fn=cmd_recheck)
    q = sub.add_parser("examples")
    q.add_argument("--pool", default=None)
    q.add_argument("--cache", default=None)
    q.set_defaults(fn=cmd_examples)
    q = sub.add_parser("expected")
    q.add_argument("--pool", required=True)
    q.add_argument("--cache", required=True)
    q.add_argument("--out", required=True)
    q.add_argument("--cases-from", default=None, help="cases・transformed・near_pairs の盤面を保つ前の期待値")
    q.add_argument("--per", type=int, default=4)
    q.add_argument("--trace", type=int, default=40)
    q.add_argument("--seed", type=int, default=7)
    q.add_argument("--jobs", type=int, default=2)
    q.set_defaults(fn=cmd_expected)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
