#!/usr/bin/env python3
"""魔方陣（ゲーム ID magic-square）の問題供給の調査コード。

/add-puzzle の調査の「問題供給」の観点で、問題集の件数・並び・生成時間・重複と近さ・大きさを測るために使った。
難易度の分類と候補の生成は magic_square_difficulty.py（版 4 の C2）をそのまま呼ぶ。標準ライブラリだけで書き、
乱数は seed を固定する（候補の seed は magic_square_difficulty.candidate_seed）。製品のコードはこのファイルに依存しない。

サブコマンド:
  groups      列の構造を保つマスの並べ替え（自己同型）を作り、数と、4×4 の魔方陣の同型の類の数を確かめる
  check       classify_fast（早く打ち切る分類）が magic_square_difficulty の classify_v4 と同じ結果になるかを確かめる
  pool        レベルごとの生成条件を巡回して候補を番号順に調べ、決めた件数の問題集を作る（候補はキャッシュして再開できる）
  analyze     pool の結果から、収率・時間・重複と近さ・同じ答え・同じ置き場所・指紋・問題集の大きさを出す
  invariance  範囲内の問題を、回転・裏返し・列の並べ替え・補数で写して分類し直し、レベルが変わる割合を出す
  recheck     キャッシュの候補を seed から作り直し、時間を除いて同じ結果になるかを確かめる
  examples    遊び方とチュートリアルの例の魔方陣と、問題集から除く形（同型の類）を出す
  expected    移植の期待値（同型のキー・近さ・例の除外・問題集の採否の規則）を JSON に書く

調査で流したコマンド（キャッシュと結果は作業ディレクトリに書く。4プロセスで、v0 は CPU 約1時間、v1 はキャッシュがあれば数分）:
  python3 magic_square_supply.py groups
  python3 magic_square_supply.py check --per 8
  python3 magic_square_supply.py pool --per-level 500 --l2-four 100 --cache cache.jsonl --out pool-v0.json
      # v0: 規則なし（重複だけ除く）、L2 の 4×4 100・5×5 400
  python3 magic_square_supply.py pool --per-level 500 --near 4 --unique-d4-answer4 --cache cache.jsonl --out pool-v1.json
      # v1: 推奨の規則、L2 の 4×4・5×5 250 ずつ
  python3 magic_square_supply.py analyze --pool pool-v1.json --cache cache.jsonl
  python3 magic_square_supply.py invariance --cache cache.jsonl --per 40 --seed 1
  python3 magic_square_supply.py recheck --cache cache.jsonl --n 40 --seed 3
  python3 magic_square_supply.py examples --pool pool-v1.json --cache cache.jsonl
  python3 magic_square_supply.py expected --pool pool-v1.json --cache cache.jsonl --out magic_square_supply.expected.json

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

SIZES = md.SIZES_C2

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
# 分類（classify_v4 と同じ結果を、範囲外と分かった所で打ち切って出す）
# ---------------------------------------------------------------------------


def _features(geo, g, kw):
    res = md.read_solve(geo, g, **kw)
    f = md.read_features(geo, g, res)
    if geo.n == 4:
        f["_virtual"] = md.read_features(geo, g, md.read_solve(geo, g, extra_lines=md.VIRTUAL4, **kw))
    return f, res


def classify_fast(n: int, g: list[int]):
    """(レベル, 範囲外の理由, 基準の特徴, 基準の read_solve の結果)。classify_v4(measure_all) と同じ値を返す。
    基準で範囲外なら変種を読まず、変種は AGREE の順に読んで、基準と違うレベルが出た所で止める。"""
    geo = md.geo_of(n)
    base, res = _features(geo, g, {})
    lv, why = md.single_level_v4(base, n, SIZES)
    if lv is None:
        return None, why, base, res
    if lv == 1 and not (n == 4 and base["tier_max"] == 1 and md.is_tier1_minimal(geo, g)):
        return None, "not-minimal", base, res
    for v in md.AGREE:
        f, _ = _features(geo, g, md.VARIANTS[v])
        if md.single_level_v4(f, n, SIZES)[0] != lv:
            return None, "reading-dependent", base, res
    return lv, None, base, res


FEAT = ("givens", "empties", "entry", "first_tier", "first_sweeps", "tier_max", "d2max", "d3max", "t3",
        "depth_max", "hard", "deep")


def evaluate(job) -> dict:
    """1候補を作り、分類し、答えの数を数える。時間は CPU 時間（ほかの処理と並んでも変わりにくい）。"""
    n, T, k, i = job
    if n == 4 and md._SQUARES4 is None:
        md.all_squares4()  # 4×4 の全 7,040 通りを一度だけ数える（時間に入れない）
    t0 = time.process_time()
    cand = md.generate_candidate(n, T, k, i)
    t1 = time.process_time()
    g = cand["givens"]
    lv, why, base, res = classify_fast(n, g)
    t2 = time.process_time()
    ex = md.count_solutions(md.geo_of(n), g, limit=2, node_cap=2_000_000)
    t3 = time.process_time()
    out = {"job": [n, T, k, i], "id": cand["id"], "seed": cand["seed"], "givens": g, "solution": cand["solution"],
           "level": lv, "reason": why, "exact": [ex["count"], ex["nodes"], int(ex["capped"])],
           "cpu": [round(t1 - t0, 4), round(t2 - t1, 4), round(t3 - t2, 4)],
           "f": {x: base[x] for x in FEAT},
           "trace": [[s["tier"], s["sweeps"]] for s in res["steps"]]}
    if lv is not None:
        out["keys"] = {a: list(b) for a, b in problem_keys(g, cand["solution"]).items()}
    return out


# ---------------------------------------------------------------------------
# 例の魔方陣（遊び方・チュートリアル）
# ---------------------------------------------------------------------------

# 4×4: 実装のチュートリアル（tutorial/tutorial.ts）と遊び方の図（figure-boards.ts）が使っている魔方陣
EXAMPLE4 = [14, 4, 5, 11, 9, 2, 7, 16, 8, 13, 12, 1, 3, 15, 10, 6]
# 5×5: 問題集の流れが届かない候補番号（9000 台）で作った L3 の候補 ms5-T2-k0-9009 の答え。最初から1マス空きの列が無く、
# 初手が2マス空きの列の組を交わる列と突き合わせる読みなので、遊び方の「組を探す」図に使える。難易度の資料の試遊用の問題
# （§7）とは別の魔方陣にして、遊び方で見た盤面が試遊の問題と重ならないようにした。
EXAMPLE5_ID = (5, 2, 0, 9009)


def example_squares() -> dict[int, list[int]]:
    return {4: list(EXAMPLE4), 5: md.generate_candidate(*EXAMPLE5_ID)["solution"]}


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
# 生成条件は難易度の資料 §6.2（版 4）の当たる割合から、そのレベルに当たる条件を選んだ。
PLAN = {
    1: {"quota": {4: 500}, "conds": [(4, 1, 0)]},
    2: {"quota": {4: 250, 5: 250}, "conds": [(5, 2, 1), (4, 2, 0), (5, 2, 2), (4, 2, 1), (5, 2, 0), (4, 3, 1)]},
    3: {"quota": {5: 250, 6: 250}, "conds": [(5, 2, 12), (6, 2, 12)]},
    4: {"quota": {5: 250, 6: 250}, "conds": [(6, 3, 12), (5, 2, 12), (6, 2, 12), (5, 3, 12)]},
    5: {"quota": {5: 250, 6: 250}, "conds": [(5, 3, 12), (6, 3, 12)]},
}


def scaled_plan(per_level: int, l2_four: int | None) -> dict:
    plan = json.loads(json.dumps({str(k): v for k, v in PLAN.items()}))
    out = {}
    for L, p in plan.items():
        L = int(L)
        q = {int(n): c for n, c in p["quota"].items()}
        total = sum(q.values())
        nq = {n: per_level * c // total for n, c in q.items()}
        if L == 2 and l2_four is not None:
            nq = {4: l2_four, 5: per_level - l2_four}
        # 端数は大きい盤面へ
        diff = per_level - sum(nq.values())
        if diff:
            nq[max(nq)] += diff
        out[L] = {"quota": {n: c for n, c in nq.items() if c > 0}, "conds": [tuple(c) for c in p["conds"]]}
    return out


class Cache:
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


def _eval_many(jobs, cache: Cache, pool):
    todo = [j for j in jobs if j not in cache.d]
    if not todo:
        return
    it = pool.imap(evaluate, todo, chunksize=1) if pool else map(evaluate, todo)
    for r in it:
        cache.add(r)


def assemble(plan, cache: Cache, pool=None, batch: int = 32, near: int = 0, layout_cap: int = 0,
             answer_cap: int = 0, exclude_examples: bool = True, unique_d4_answer4: bool = False):
    """レベルごとに生成条件を巡回して候補を番号順に調べ、採る。

    採る条件（上から当てる）: そのレベルに分類される / その盤面の件数が埋まっていない / 例の魔方陣と答えが同じ類でない /
    問題のキー（G × 補数）が採った問題（レベルをまたぐ）と同じでない / near > 0 なら、答えが同じ類の採った問題との
    近さが near 以下でない / layout_cap > 0 なら、同じレベルで同じ置き場所のキーの問題が layout_cap 問に届いていない /
    answer_cap > 0 なら、同じレベルで同じ答えのキーの問題が answer_cap 問に届いていない /
    unique_d4_answer4 なら、4×4 で、答えを回転・裏返しで同じとみなしたキーが採った問題（レベルをまたぐ）と同じでない。
    候補の調べは pool で並べて行い、採る順は1つずつ調べたときと同じにする（batch は先読みの数）。
    """
    accepted = {L: [] for L in plan}
    seen_pk: dict[tuple, str] = {}
    seen_sk8: dict[tuple, str] = {}
    by_sk: dict[tuple, list[dict]] = collections.defaultdict(list)
    log = []
    visits = {L: collections.Counter() for L in plan}
    for L in sorted(plan):
        quota = plan[L]["quota"]
        conds = plan[L]["conds"]
        nexti = {c: 0 for c in conds}
        ptr = 0
        cnt = collections.Counter()
        lk_cnt = collections.Counter()
        sk_cnt = collections.Counter()

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

        while active():
            seq = next_seq(ptr, nexti, batch)
            _eval_many(seq, cache, pool)
            act_before = active()
            for job in seq:
                c = job[:3]
                # 実際の巡回で次に来る条件まで ptr を進める
                while conds[ptr % len(conds)] != c or conds[ptr % len(conds)] not in act_before:
                    ptr += 1
                ptr += 1
                nexti[c] += 1
                r = cache.d[job]
                visits[L][c] += 1
                dec, partner = _decide(L, r, cnt, quota, seen_pk, by_sk, lk_cnt, sk_cnt, near, layout_cap,
                                       answer_cap, exclude_examples, seen_sk8 if unique_d4_answer4 else None)
                log.append((L, job, dec, partner))
                if dec == "accept":
                    n = job[0]
                    cnt[n] += 1
                    keys = r["keys"]
                    seen_pk[tuple(keys["pk"])] = r["id"]
                    if n == 4:
                        seen_sk8.setdefault(tuple(keys["sk8"]), r["id"])
                    by_sk[tuple(keys["sk"])].append(r)
                    lk_cnt[tuple(keys["lk"])] += 1
                    sk_cnt[tuple(keys["sk"])] += 1
                    accepted[L].append(r)
                if active() != act_before:
                    break  # 巡回する条件が変わったので、先読みをやり直す
    return accepted, log, visits


def _decide(L, r, cnt, quota, seen_pk, by_sk, lk_cnt, sk_cnt, near, layout_cap, answer_cap, exclude_examples,
            seen_sk8=None):
    """(採否, 当たった相手)。相手は重複・近さ・同じ答えで除いたときの、先に採った問題の [ID, 近さ]。"""
    if r["level"] != L:
        return ("other-level" if r["level"] is not None else (r["reason"] or "out")), None
    if r["exact"][0] != 1:
        return "not-unique", None
    n = r["job"][0]
    if cnt[n] >= quota.get(n, 0):
        return "size-full", None
    keys = r["keys"]
    sk = tuple(keys["sk"])
    if exclude_examples and sk in example_keys():
        return "example", None
    if tuple(keys["pk"]) in seen_pk:
        return "duplicate", [seen_pk[tuple(keys["pk"])], 0]
    if seen_sk8 is not None and n == 4 and tuple(keys["sk8"]) in seen_sk8:
        return "same-answer-d4", [seen_sk8[tuple(keys["sk8"])], None]
    if near > 0:
        for o in by_sk.get(sk, ()):
            d = near_distance(o["givens"], o["solution"], r["givens"], r["solution"])
            if d is not None and d <= near:
                return "near", [o["id"], d]
    if layout_cap > 0 and lk_cnt[tuple(keys["lk"])] >= layout_cap:
        return "layout-cap", None
    if answer_cap > 0 and sk_cnt[sk] >= answer_cap:
        return "answer-cap", None
    return "accept", None


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
    ex = example_squares()
    out["examples"] = {n: {"square": ex[n], "is_magic": md.is_magic(md.geo_of(n), ex[n]),
                           "orbit_size_G_complement": len({tuple(transform(ex[n], m, c)) for m in line_group(n)
                                                           for c in (False, True)})}
                       for n in ex}
    print(json.dumps(out, ensure_ascii=False, indent=1))


def _check_job(job):
    cand = md.generate_candidate(*job)
    n = job[0]
    geo = md.geo_of(n)
    g = cand["givens"]
    t0 = time.process_time()
    b, v, mn, _ = md.measure_all(geo, g)
    t1 = time.process_time()
    ref = md.classify_v4({"n": n, "base": b, "var": v, "l1_minimal": mn}, SIZES)
    t2 = time.process_time()
    lv, why, _, _ = classify_fast(n, g)
    t3 = time.process_time()
    return {"job": list(job), "ref": list(ref), "fast": [lv, why], "t_ref": t1 - t0, "t_fast": t3 - t2}


def cmd_check(a):
    conds = sorted({c for p in PLAN.values() for c in p["conds"]} | {(n, T, k) for n in (4, 5, 6) for T in (1, 2, 3)
                                                                      for k in (0, 1, 2)})
    jobs = [(n, T, k, 50_000 + i) for (n, T, k) in conds for i in range(a.per)]
    import multiprocessing as mp
    with mp.Pool(a.jobs) as pool:
        rs = pool.map(_check_job, jobs, chunksize=1)
    bad = [r for r in rs if r["ref"] != r["fast"]]
    lv = collections.Counter(tuple(r["ref"]) for r in rs)
    print(json.dumps({"candidates": len(rs), "mismatch": len(bad), "examples_of_mismatch": bad[:5],
                      "levels": {str(k): v for k, v in sorted(lv.items(), key=str)},
                      "cpu_ref_total": round(sum(r["t_ref"] for r in rs), 1),
                      "cpu_fast_total": round(sum(r["t_fast"] for r in rs), 1)}, ensure_ascii=False, indent=1))


def cmd_pool(a):
    plan = scaled_plan(a.per_level, a.l2_four)
    if a.levels:
        plan = {L: v for L, v in plan.items() if L in a.levels}  # 下のレベルから順に組むので、途中までの結果は全部と同じ
    cache = Cache(a.cache)
    import multiprocessing as mp
    pool = mp.Pool(a.jobs) if a.jobs > 1 else None
    t0 = time.time()
    try:
        accepted, log, visits = assemble(plan, cache, pool, batch=a.batch, near=a.near, layout_cap=a.layout_cap,
                                         answer_cap=a.answer_cap, unique_d4_answer4=a.unique_d4_answer4)
    finally:
        if pool:
            pool.close()
            pool.join()
    wall = time.time() - t0
    out = {"plan": {L: {"quota": p["quota"], "conds": p["conds"]} for L, p in plan.items()},
           "options": {"near": a.near, "layout_cap": a.layout_cap, "answer_cap": a.answer_cap,
                       "unique_d4_answer4": a.unique_d4_answer4},
           "wall_seconds": round(wall, 1), "jobs": a.jobs,
           "levels": {L: [e["id"] for e in order_level(accepted[L])] for L in accepted},
           "log": [[L, list(job), dec, partner] for L, job, dec, partner in log]}
    with open(a.out, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"pool -> {a.out} ({wall:.0f}s wall, {len(cache.d)} candidates cached)", file=sys.stderr)


def _load_pool(path, cache_path):
    p = json.load(open(path))
    cache = Cache(None)
    with open(cache_path) as fh:
        for line in fh:
            r = json.loads(line)
            cache.d[tuple(r["job"])] = r
    by_id = {r["id"]: r for r in cache.d.values()}
    levels = {int(L): [by_id[i] for i in ids] for L, ids in p["levels"].items()}
    return p, cache, levels


def _q(xs, qs=(0.5, 0.95)):
    if not xs:
        return "-"
    s = sorted(xs)
    return " / ".join(f"{s[min(len(s) - 1, int(q * (len(s) - 1) + 0.5))]:.2f}" for q in qs)


def cmd_analyze(a):
    p, cache, levels = _load_pool(a.pool, a.cache)
    log = p["log"]
    out = []
    # 収率と時間（レベルの流れで調べた候補。候補は流れの間で共有するので、全体の時間は重ねずに数える）
    out.append("## 収率と時間（CPU 秒は研究用 Python 1プロセスの CPU 時間）")
    out.append("| レベル | 盤面 | 生成条件 | 調べた候補 | そのレベルに当たった | 採った | 当たる割合 | 1候補の CPU p50 / p95 | 採った1問あたりの CPU |")
    out.append("|---|---|---|---|---|---|---|---|---|")
    per_level_cpu = {}
    for L in sorted(levels):
        rows = collections.defaultdict(lambda: [0, 0, 0, []])
        for L2, job, dec, *_ in log:
            if L2 != L:
                continue
            r = cache.d[tuple(job)]
            key = tuple(job[:3])
            rows[key][0] += 1
            rows[key][1] += int(r["level"] == L)
            rows[key][2] += int(dec == "accept")
            rows[key][3].append(sum(r["cpu"]))
        tot_cpu = 0.0
        for key in sorted(rows, key=lambda c: (c[0], c[1], c[2])):
            v, hit, acc, cpus = rows[key]
            tot_cpu += sum(cpus)
            out.append(f"| {L} | {key[0]}×{key[0]} | T{key[1]} k{key[2]} | {v} | {hit} | {acc} | {hit / v:.0%} | "
                       f"{_q(cpus)} | {sum(cpus) / max(acc, 1):.2f} |")
        per_level_cpu[L] = tot_cpu
    visited = {tuple(job) for _, job, *_ in log}
    uniq_cpu = sum(sum(cache.d[j]["cpu"]) for j in visited)
    out.append("")
    out.append("レベルごとの CPU 秒（そのレベルの流れで調べた候補の合計。別のレベルと共有した候補も含む）: "
               + "、".join(f"L{L} {per_level_cpu[L]:.0f}" for L in sorted(per_level_cpu))
               + f"。調べた候補 {len(visited)}（重ねずに数えて CPU {uniq_cpu:.0f} 秒）。壁時計 {p['wall_seconds']} 秒"
               f"（{p['jobs']} プロセス、ほかの計測と CPU を分け合った）")
    dec = collections.Counter((L, d) for L, _, d, *_ in log)
    out.append("")
    out.append("採らなかった理由（レベルの流れごと）: " + "; ".join(
        f"L{L}: " + ", ".join(f"{d} {c}" for (L2, d), c in sorted(dec.items()) if L2 == L) for L in sorted(levels)))
    # 一意解
    allr = [cache.d[j] for j in visited]
    out.append("")
    out.append(f"一意解: 調べた候補 {len(allr)} のうち答えが1つ {sum(1 for r in allr if r['exact'][0] == 1)}、"
               f"打ち切り {sum(r['exact'][2] for r in allr)}。採った問題 {sum(len(v) for v in levels.values())} は全部 "
               f"{'一意解' if all(r['exact'][0] == 1 for v in levels.values() for r in v) else '一意解でないものを含む'}")
    acc = [r for v in levels.values() for r in v]
    out.append(f"採った問題を分類し直して答えを数える CPU（--verify の目安）: 合計 {sum(r['cpu'][1] + r['cpu'][2] for r in acc):.0f} 秒"
               f"（1問 p50 / p95 {_q([r['cpu'][1] + r['cpu'][2] for r in acc])} 秒）")
    nodes = {n: [r["exact"][1] for v in levels.values() for r in v if r["job"][0] == n] for n in (4, 5, 6)}
    out.append("一意性の確かめの節点（採った問題）: " + "、".join(
        f"{n}×{n} p50 {statistics.median(xs):.0f}・最大 {max(xs)}" for n, xs in nodes.items() if xs))
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
    lv2, why2, _, _ = classify_fast(n, g2)
    return {"id": rid, "n": n, "which": which, "level": lv, "level2": lv2, "reason2": why2}


def cmd_invariance(a):
    if a.pool:
        _, _, levels = _load_pool(a.pool, a.cache)
    else:  # キャッシュの範囲内の候補から選ぶ（候補番号の順）
        levels = collections.defaultdict(list)
        with open(a.cache) as fh:
            for line in fh:
                r = json.loads(line)
                if r["level"] is not None and r["exact"][0] == 1:
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
        rs = pool.map(_inv_job, jobs, chunksize=2)
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


def cmd_recheck(a):
    """キャッシュの候補を作り直し、時間を除いて同じ結果になるかを確かめる（seed の再現）。"""
    cache = Cache(None)
    with open(a.cache) as fh:
        for line in fh:
            r = json.loads(line)
            cache.d[tuple(r["job"])] = r
    rng = random.Random(a.seed)
    jobs = sorted(cache.d)
    pick = rng.sample(jobs, min(a.n, len(jobs)))
    import multiprocessing as mp
    with mp.Pool(a.jobs) as pool:
        rs = pool.map(evaluate, pick, chunksize=1)
    bad = [r["id"] for r in rs if {k: v for k, v in r.items() if k != "cpu"}
           != {k: v for k, v in cache.d[tuple(r["job"])].items() if k != "cpu"}]
    print(json.dumps({"rechecked": len(rs), "mismatch": bad,
                      "by_condition": dict(collections.Counter(f"{j[0]}-{j[1]}-{j[2]}" for j in pick))},
                     ensure_ascii=False))


def cmd_examples(a):
    ex = example_squares()
    out = {}
    for n, sq in ex.items():
        orbit = {tuple(transform(sq, m, c)) for m in line_group(n) for c in (False, True)}
        rec = {"square": sq, "rows": [sq[r * n:(r + 1) * n] for r in range(n)], "orbit_G_complement": len(orbit),
               "orbit_D4": len({tuple(transform(sq, m)) for m in d4_group(n)})}
        if n == 4:
            sq4 = md.all_squares4()
            rec["share_of_4x4_squares"] = f"{sum(1 for s in sq4 if tuple(s) in orbit)}/{len(sq4)}"
        if n == 5:
            cand = md.generate_candidate(*EXAMPLE5_ID)
            lv, why, base, res = classify_fast(5, cand["givens"])
            rec["teaching_board"] = {"id": cand["id"], "givens": cand["givens"], "level": lv,
                                     "first_steps": [{"tier": s["tier"], "sweeps": s["sweeps"], "cells": s["cells"],
                                                      "kinds": s["kinds"]} for s in res["steps"][:3]]}
        out[n] = rec
    if a.cache and a.pool:
        p, cache, levels = _load_pool(a.pool, a.cache)
        hit = collections.Counter()
        for L, job, dec, *_ in p["log"]:
            if dec == "example":
                hit[(L, job[0])] += 1
        out["excluded_in_pool_run"] = {f"L{L} {n}x{n}": c for (L, n), c in sorted(hit.items())}
    print(json.dumps(out, ensure_ascii=False, indent=1))


def cmd_expected(a):
    """移植の期待値（検査 F2）。製品の乱数は Python と一致しないので、問題ごとの値（同型のキー・近さ・例の除外・
    分類）と、与えた候補の列からの採否（組み立ての規則）を固定する。"""
    p, cache, levels = _load_pool(a.pool, a.cache)
    rng = random.Random(a.seed)
    cases = []
    picked = []
    for L in sorted(levels):
        for n in (4, 5, 6):
            es = [r for r in levels[L] if r["job"][0] == n]
            if es:
                picked += rng.sample(es, min(a.per, len(es)))
    for r in picked:
        n = r["job"][0]
        cases.append({"id": r["id"], "n": n, "givens": r["givens"], "solution": r["solution"], "level": r["level"],
                      "problem_key": r["keys"]["pk"], "problem_key_d4": r["keys"]["pk8"],
                      "solution_key": r["keys"]["sk"], "solution_key_d4": r["keys"]["sk8"],
                      "layout_key": r["keys"]["lk"]})
    # 写した問題: 同じキーになることの確かめ
    transformed = []
    for r in picked[: a.per * 3]:
        n = r["job"][0]
        G = line_group(n)
        m = G[rng.randrange(1, len(G))]
        comp = bool(rng.randrange(2))
        g2 = transform(r["givens"], m, comp)
        s2 = transform(r["solution"], m, comp)
        transformed.append({"of": r["id"], "map": list(m), "complement": comp, "givens": g2, "solution": s2,
                            "problem_key": list(canon(g2, "G", True)), "solution_key": list(canon(s2, "G", True))})
    # 近さ: 同じ答えの類の組（4×4）と、1つの与える数を動かした組
    near_pairs = []
    four = [r for L in (1, 2) for r in levels[L] if r["job"][0] == 4]
    groups = collections.defaultdict(list)
    for r in four:
        groups[tuple(r["keys"]["sk"])].append(r)
    for grp in list(groups.values()):
        for x, y in itertools.combinations(grp, 2):
            near_pairs.append({"a": x["id"], "b": y["id"], "a_givens": x["givens"], "a_solution": x["solution"],
                               "b_givens": y["givens"], "b_solution": y["solution"],
                               "distance": near_distance(x["givens"], x["solution"], y["givens"], y["solution"])})
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
        near_pairs.append({"a": r["id"], "b": r["id"] + "-moved", "a_givens": r["givens"], "a_solution": r["solution"],
                           "b_givens": g2, "b_solution": r["solution"],
                           "distance": near_distance(r["givens"], r["solution"], g2, r["solution"])})
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
        elif dec in ("example", "duplicate", "same-answer-d4", "near") and rule[dec] < a.trace // 4:
            rule[dec] += 1
            trace.append(item(L, job, dec, partner))
    out = {
        "about": "魔方陣の問題供給の調査コード（magic_square_supply.py）の移植の期待値。同型のキー（列の構造の自己同型 G × 補数）・"
                 "近さ・例の魔方陣の除外・問題集の組み立ての採否を、同じ盤面で突き合わせるために使う。候補の盤面は Python の random で"
                 "作ったもので、移植したコードの乱数とは一致しない。assembly_trace は、レベルの流れごとの最初の候補と、採否の規則で除いた候補"
                 "（partner は先に採った相手）。solutions_counted と exact_nodes は完全な解法器（2解で止める、200万節点で打ち切り）の値。",
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
                         for L, v in levels.items()},
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
    q.add_argument("--per", type=int, default=8)
    q.add_argument("--jobs", type=int, default=4)
    q.set_defaults(fn=cmd_check)
    q = sub.add_parser("pool")
    q.add_argument("--per-level", type=int, default=500)
    q.add_argument("--l2-four", type=int, default=None, help="L2 の 4×4 の件数（既定は PLAN の比。v0 は 100）")
    q.add_argument("--near", type=int, default=0, help="答えが同じ類で近さがこれ以下の問題を採らない（0 で当てない）")
    q.add_argument("--layout-cap", type=int, default=0)
    q.add_argument("--answer-cap", type=int, default=0)
    q.add_argument("--unique-d4-answer4", action="store_true",
                   help="4×4 の答えを、回転・裏返しで同じとみなして問題集の中で1度だけ使う")
    q.add_argument("--cache", required=True, help="候補のキャッシュ（JSONL。あれば読んで続きから）")
    q.add_argument("--out", required=True)
    q.add_argument("--jobs", type=int, default=4)
    q.add_argument("--batch", type=int, default=32)
    q.add_argument("--levels", type=int, nargs="*", default=None, help="組むレベル（試すとき。既定は全部）")
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
    q.add_argument("--jobs", type=int, default=4)
    q.set_defaults(fn=cmd_invariance)
    q = sub.add_parser("recheck")
    q.add_argument("--cache", required=True)
    q.add_argument("--n", type=int, default=40)
    q.add_argument("--seed", type=int, default=3)
    q.add_argument("--jobs", type=int, default=4)
    q.set_defaults(fn=cmd_recheck)
    q = sub.add_parser("examples")
    q.add_argument("--pool", default=None)
    q.add_argument("--cache", default=None)
    q.set_defaults(fn=cmd_examples)
    q = sub.add_parser("expected")
    q.add_argument("--pool", required=True)
    q.add_argument("--cache", required=True)
    q.add_argument("--out", required=True)
    q.add_argument("--per", type=int, default=4)
    q.add_argument("--trace", type=int, default=40)
    q.add_argument("--seed", type=int, default=7)
    q.set_defaults(fn=cmd_expected)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
