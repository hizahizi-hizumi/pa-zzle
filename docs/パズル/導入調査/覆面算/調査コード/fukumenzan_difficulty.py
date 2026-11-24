"""覆面算（fukumenzan）の難易度の調査コード。

標準ライブラリだけで、次を測る（seed 固定）。

- 生成: 使う数字の組 D（文字の数 n 個）を先に選び、足す数の各桁を D から引いて和を計算し、
  和の桁がすべて D に入り D を使い切ったものを候補にする。文字は数字ごとに無作為に当てる。
- 一意性: 右の列から繰り上がりつきで当てる完全な探索で解の数を 2 まで数える。
- 読むモデル 版6（決定版。採る案 ADOPTED_V6 = "P50nk18w"。移す流れは classify6）:
    線は版5 と同じ「値を仮に置くか」。版5 からの直しは4つ（コードの「版6」の節の頭に書いた）。
    端の読み手: L6_LO・L6_HI（1列ずつ）、C6_LO＋Fam6Reader(pair_prod_cap=50)（まとめる読みの弱い端）、
      C6_HI と Alg6Reader（強い端。式の持ち回り）、NB6_LO・NB6_HI＋NoBounds6Reader（1列の重さ。消える文字を除く）、
      FactStep6Reader(step_k=18, whole=True)＋seq6(weak_allowed)（場合分けの読み手の弱い端。1つの事実が1手、2列は2手）。
    組: read_class6。段: col_weight6（E1/E2）・split_weight6（B1＝1回、B2＝2回）。提供範囲: provided6（SPLIT_CAP6＝2回まで）。
    レベル: cell6・level6（CELLS6・LETTERS6。L3 は 3s・H1 だけ）。範囲外の理由: scope6（余白・組み合わせ外・文字の数・上限を超える・評価不能）。
    比べた選び方は PLANS6（探す手間24/50、枝の手14/18/22、count/binary/weak）。
    一度だけの当て直し: recheck6・recheck6report。L2 の移り先: l2shift6。k を決めた表: ksweep6。
- 読むモデル 版5（記録。L5_*・C5_*・NB5_*・P5_*・StepProbe5Reader・NoBounds5Reader・seq5・read_class5・cell5・level5・PLANS5・
  FAM5_VARIANTS・JOINT5・OPT5）:
    読みと場合分けの線は「値を仮に置くか」。先読みはみな場合分け。強い端は関係式の持ち回りを3列（組12）で近似する。
    場合分けは1つの変数ずつ数え（seq5）、枝は人の手（1つの規則を1回当てるのを1手。StepProbe5Reader）で数える。
    場合分けの読み手の弱い端は2人（枝を人の手で k 手・同時に読む2段）。族の全員で言えるのは、2人とも言えるとき。
    E1/E2（L1/L2）: 組4（12）より多い列を読まない読み手（NoBounds5Reader）で解ける／止まる。
    B1（L4）: 弱い端の2人とも1つの変数の二択1回で解ける。B2（L5）: 強い端でも二択1回では解けない。
    族の和どおりの案K5 では、L4・L5 が標的生成 5000 候補で 21・14 問しか残らない（計測）。選択肢は OPT5。
- 読むモデル 版4（記録。Fam4Reader・L4_*・C4_*・P4_LO・FAM4_VARIANTS・read_class4・cell4・level4・PLANS4・JOINT4）:
  読み方の解釈の和を族とし、組の言い方を族の端の読み手で決める（軸がどれも単調なので、端で言えれば族の全員で言える）。
    読みの種類: 1列ずつの読み（L。1列と表だけ）／まとめる読み（C。L に2列のまとめと先読みを足す）
    E  : L の弱い端（Llo）で場合分けなしに解ける         mE: Llo では止まり L の強い端（Lhi）なら解ける（余白）
    H1 : Lhi では止まり、C の弱い端（Clo）なら解ける     mH: Clo では止まり C の強い端なら解ける（余白）
    H2 : C の強い端でも場合分けが要る。その中を、場合分けの読み手の下の端の波と強い端の波で B1（二択1回）・B2 に分ける
    提供範囲: 場合分けの読み手の下の端が三択までで解ける
  案 Q・R・T・T5・T3 を比べ、T3 を仮に置いた（A4・F1（版4）で、先読みの手数の線が人に見えないとされた）。
- 読むモデル 版3（記録。FamReader・FAMILY_*・read_class・scale_cell・level_v3・PLANS3）:
  読み手を1人に決めず、強さの順に並ぶ5人（W ≦ W⁺、M ≦ S⁻ ≦ S）で「族の誰でも」「軽い読み手なら」「強い読み手なら」を決める。
    E  : W（1列と表だけ）で場合分けなしに解ける
    H1 : W⁺（2列はつないだ組12まで・先読み2手）でも場合分けが要り、S⁻ なら要らない
    H2 : S でも場合分けが要る
    余白: W では解けず W⁺ なら解ける／S⁻ では要り S なら要らない（どちらも問題集から外す）
    評価不能: M が三択までの場合分けで解けない
  レベルは盤面の規模（2s/2l/3s/3l）と読みの組の組み合わせ（案 PA3 を採る）。
- 読むモデル 版2（Closure・tier_solve・BRACKETS・level_v2）と版1（Reader・PLANS）も記録として残す。
- 素朴な解き方（試すモデル）: 補助を見ながら、右の列から足す文字に試し置きし、赤が出たら戻す深さ優先の試し置き。

条件（盤面の大きさ・件数・打ち切り）は比較実験の条件で、完成仕様ではない:
  生成条件は CONDITIONS の13通り（版3 では4つ足しを使わない）、一意解でない候補は 400 回まで作り直す、
  素朴な解き方は 2000 回で打ち切り。打ち切りの値は人の能力ではない。

使い方（調査の再現手順。seed は固定。<ルート> はリポジトリのルート）:
  F=<ルート>/docs/パズル/導入調査/覆面算/調査コード/fukumenzan_difficulty.py
  python3 $F selfcheck
  python3 $F corpus --out c200.jsonl --per 200                                   # 13条件×200（約110秒、4並列）
  python3 $F corpus --out big.jsonl --per 150 --conds 5,6,10,11,12 --nrange 8,10  # 大きな条件を文字8〜10に寄せる
  python3 $F corpus --out extra.jsonl --per 300 --start 200 --conds 1,2,3,7,8,9   # 追加
  # 版6（決定版）
  python3 $F family6 fam3.jsonl tgt.jsonl --light --out f6c.jsonl                            # コーパスの組と1列の重さ（4並列で約30秒）
  python3 $F family6 sup5_554.jsonl sup5_555.jsonl --out f6_sup.jsonl                         # 標的生成の H2 まで、比べる選び方も測る（時間は記録していない）
      # 途中で止まったら --skip <書けた jsonl> で続きから。seed と f6 だけの行（後から足した読み手）は plans6 が同じ seed に足す
  python3 $F plans6 f6_sup.jsonl f6_supx.jsonl f6_supx2.jsonl f6_alg.jsonl --plan P50nk18w      # 案ごとのレベルと収率・代表
      # ChiA（f6_alg.jsonl）を渡し忘れると read_class6 が止まる（Chi で止まった行を H2 と決めない）
  python3 $F supply6 --conds 0,1,2,7,8,9 --per 1000 --out s6_small.jsonl                       # 採る案だけで生成＋判定（L1〜L3）
  python3 $F supply6 --conds 7,8,9 --start 1000 --per 4000 --out s6_more.jsonl                 # 3s を各5000 にそろえる
  python3 $F supply6report s6_small.jsonl s6_more.jsonl                                        # 合わせて数え直す（範囲外の理由も）
  python3 $F supply6 --conds 10 --nrange 7,9 --per 3000 --out s7_554.jsonl                     # 同（L4・L5。標的生成。4並列で約3分）
  python3 $F supply6 --conds 11 --nrange 7,9 --per 2000 --out s7_555.jsonl
  python3 $F l2shift6 --f5 f5.jsonl f5_x.jsonl --f6 f6.jsonl f6b.jsonl f6c.jsonl f6_alg.jsonl  # 版5 の L2 の移り先
  python3 $F ksweep6                                                                           # F1 の例の、枝の手ごとの場合分けの回数
  python3 $F naive6 s6_small.jsonl s6_more.jsonl s7_554.jsonl s7_555.jsonl                     # 素朴な解き方をレベルごとに
  python3 $F supply6 --conds 10,11 --nrange 10,10 --start 50000 --per 500 --out s7_n10.jsonl   # 10文字だけで作ったときの L4・L5
  python3 $F recheck6 <f6 の jsonl…> --out re6.jsonl                                           # 一度だけの当て直し（4並列で約5分）
  python3 $F recheck6report re6.jsonl <f6 の jsonl…> --sup5 sup5_554.jsonl,sup5_555.jsonl
  python3 $F expected --out fukumenzan_difficulty.expected.json --per 3                       # 移植の期待値（版6）
  # 版5（記録）
  python3 $F expected5 --out <版5 の期待値> --per 3
  python3 $F family5 fam3.jsonl tgt.jsonl --out f5.jsonl                                      # 端の読み手（4並列で約7分）
  python3 $F family5 fam3.jsonl tgt.jsonl --extra-only --variants x --out f5_x.jsonl          # 族の外の解釈
  python3 $F supply5 --conds 10 --nrange 7,9 --per 3000 --out sup5_554.jsonl                   # 標的生成（約5分）
  python3 $F supply5 --conds 11 --nrange 7,9 --per 2000 --out sup5_555.jsonl                   # 標的生成（約10分）
  python3 $F family5 sup5_554.jsonl sup5_555.jsonl --extra-only --only <H2 の seed> --variants <O_ と X_ の名前> --out f5_supx.jsonl
  python3 $F plans5 f5.jsonl ; python3 $F plans5 sup5_554.jsonl sup5_555.jsonl                # 組・提供範囲・案ごとのレベル
  python3 $F options5 sup5_554.jsonl sup5_555.jsonl f5_supx.jsonl                             # 選択肢ごとの L4・L5 の収率
  python3 $F joint5 f5.jsonl f5_x.jsonl ; python3 $F joint5 sup5_554.jsonl sup5_555.jsonl f5_supx.jsonl
  # 版4（記録）
  python3 $F expected4 --out <版4 の期待値> --per 3
  python3 $F corpus --out tgt.jsonl --per 400 --start 1000 --conds 9,10,11 --nrange 9,10       # 大きな条件を文字9〜10に寄せた追加
  python3 $F family4 fam3.jsonl tgt.jsonl --variants diag --out f4.jsonl                      # 族の端と診断の読み手（4並列で約30分）
  python3 $F family4 fam3.jsonl tgt.jsonl --extra-only --variants <X_ のうち _CT で終わらないもの> --out f4_x.jsonl   # 族の外の解釈（約15分）
  python3 $F family4 fam3.jsonl tgt.jsonl --extra-only --variants <X_ の _CT> --only <3l で H2 かつ提供範囲の seed> --out f4_xct.jsonl
  python3 $F plans4 f4.jsonl f4_x.jsonl                                                       # 組・提供範囲・案ごとのレベルと収率
  python3 $F joint4 f4.jsonl f4_x.jsonl f4_xct.jsonl                                          # 族の外の解釈を、持つ端の全員に一緒に当てる
  python3 $F supply4 --conds 10 --nrange 7,9 --per 3000 --out sup554.jsonl                     # 上のレベルの供給（安い順に当てて止める）
  python3 $F supply4 --conds 11 --nrange 7,9 --per 2000 --out sup555.jsonl
  python3 $F family4 sup554.jsonl sup555.jsonl --extra-only --variants x --only <案T の L4・L5 の seed> --out sup_x.jsonl
  python3 $F joint4 sup554.jsonl sup555.jsonl sup_x.jsonl                                     # 供給の L4・L5 で族の外の解釈
  # 版3（記録）
  python3 $F expected3 --out <版3 の期待値> --per 3
  python3 $F family c200.jsonl big.jsonl extra.jsonl --variants "$(python3 -c 'import sys;sys.path.insert(0,"<調査コード>");import fukumenzan_difficulty as f;print(",".join(f.FAM_VARIANTS))')" --out fam3.jsonl
                                                                                   # 族の5人と A4 の解釈（約25分、4並列）
  python3 $F plans3 fam3.jsonl --plan PA3                                         # 案の表・族の端を動かした表・分布・供給・代表
  # 版2・版1（記録）
  python3 $F tiers ... ; python3 $F robust ... ; python3 $F report c200.jsonl ; python3 $F variants c200.jsonl ; python3 $F adopted ...
  # そのほか
  python3 $F givens --per 200 ; python3 $F space --lens 3,3 --n 1500
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from itertools import product
from multiprocessing import Pool

# 読み違いやすい I・O・Q・S・Z は使わない（推測: 0・1・5・2 と見分けにくい）。
LETTER_POOL = "ABCDEFGHJKLMNPRTUVWXY"
SEED_BASE = 20261122

DIGITS = [tuple(d for d in range(10) if m >> d & 1) for m in range(1 << 10)]
POP = [bin(m).count("1") for m in range(1 << 10)]

CONTRA, STUCK = "contradiction", "stuck"

# 生成条件（足す数の桁の並び）。スマホ縦画面で筆算が7列までに収まる範囲。
CONDITIONS: list[tuple[int, ...]] = [
    (3, 3),
    (4, 3),
    (4, 4),
    (5, 4),
    (5, 5),
    (6, 5),
    (6, 6),
    (3, 3, 3),
    (4, 4, 3),
    (4, 4, 4),
    (5, 5, 4),
    (5, 5, 5),
    (4, 4, 4, 4),
]


# ---------------------------------------------------------------- 問題


class Puzzle:
    """足し算の覆面算。addends は足す数（文字列）、result は答え。"""

    def __init__(self, addends: list[str], result: str):
        self.addends = list(addends)
        self.result = result
        letters: list[str] = []
        for w in self.addends + [result]:
            for ch in w:
                if ch not in letters:
                    letters.append(ch)
        self.letters = letters
        self.n = len(letters)
        self.k = len(addends)
        idx = {ch: i for i, ch in enumerate(letters)}
        self.idx = idx
        self.R = len(result)
        cols = []
        for j in range(self.R):
            cnt: Counter[int] = Counter()
            for w in self.addends:
                if j < len(w):
                    cnt[idx[w[-1 - j]]] += 1
            cols.append((tuple(sorted(cnt.items())), idx[result[-1 - j]]))
        self.cols = cols
        self.lead = {idx[w[0]] for w in self.addends + [result] if len(w) > 1}
        # 変数: 文字 0..n-1、繰り上がり n+j（列 j に右から入る繰り上がり、j=0..R）
        self.nvars = self.n + self.R + 1
        self.var_cols: list[list[int]] = [[] for _ in range(self.nvars)]
        for j, (terms, res) in enumerate(cols):
            vs = {t[0] for t in terms} | {res, self.n + j, self.n + j + 1}
            for v in vs:
                self.var_cols[v].append(j)

    def text(self) -> str:
        return " + ".join(self.addends) + " = " + self.result

    def initial_domains(self) -> list[int]:
        dom = []
        for i in range(self.n):
            dom.append(0b1111111110 if i in self.lead else 0b1111111111)
        cmask = (1 << self.k) - 1
        for j in range(self.R + 1):
            if j == 0 or j == self.R:
                dom.append(1)
            else:
                dom.append(cmask)
        return dom


# ---------------------------------------------------------------- 生成


def generate(rng: random.Random, lens: tuple[int, ...], n_range: tuple[int, int], max_tries: int = 4000):
    """lens の桁の足す数で、文字 n 個の候補を1つ作る。戻り値は (Puzzle, 解, 試した回数) か None。"""
    for tries in range(1, max_tries + 1):
        n = rng.randint(*n_range)
        D = rng.sample(range(10), n)
        nz = [d for d in D if d != 0]
        if not nz:
            continue
        nums = []
        for ln in lens:
            ds = [rng.choice(nz)] + [rng.choice(D) for _ in range(ln - 1)]
            nums.append(int("".join(map(str, ds))))
        s = sum(nums)
        used = set()
        for x in nums + [s]:
            used |= set(map(int, str(x)))
        if used != set(D):
            continue
        letters = rng.sample(LETTER_POOL, n)
        m = dict(zip(D, letters))
        addends = ["".join(m[int(c)] for c in str(x)) for x in nums]
        result = "".join(m[int(c)] for c in str(s))
        p = Puzzle(addends, result)
        sol = {m[d]: d for d in D}
        return p, sol, tries
    return None


def count_solutions(p: Puzzle, limit: int = 2) -> int:
    """右の列から繰り上がりつきで当てる完全な探索。解の数を limit まで数える。"""
    n = p.n
    assign = [-1] * n
    used = [False] * 10
    cols = p.cols
    lead = p.lead
    count = 0

    def col(j: int, carry: int, terms_left: list[int], acc: int) -> bool:
        nonlocal count
        if j == p.R:
            if carry == 0:
                count += 1
                return count >= limit
            return False
        terms, res = cols[j]
        if terms_left:
            v = terms_left[0]
            rest = terms_left[1:]
            if assign[v] >= 0:
                return col(j, carry, rest, acc)
            for d in range(10):
                if used[d] or (d == 0 and v in lead):
                    continue
                assign[v] = d
                used[d] = True
                if col(j, carry, rest, acc):
                    return True
                used[d] = False
                assign[v] = -1
            return False
        s = carry + sum(mult * assign[v] for v, mult in terms)
        r, co = s % 10, s // 10
        if assign[res] >= 0:
            if assign[res] != r:
                return False
            return col_start(j + 1, co)
        if used[r] or (r == 0 and res in lead):
            return False
        assign[res] = r
        used[r] = True
        if col_start(j + 1, co):
            return True
        used[r] = False
        assign[res] = -1
        return False

    def col_start(j: int, carry: int) -> bool:
        if j == p.R:
            return col(j, carry, [], 0)
        return col(j, carry, [v for v, _ in cols[j][0]], 0)

    col_start(0, 0)
    return count


# ---------------------------------------------------------------- 読むモデル


class Reader:
    """人間向け解法器。opts で数え方の変種を切り替える（A3）。"""

    def __init__(self, p: Puzzle, opts: dict | None = None):
        self.p = p
        self.opts = opts or {}
        self.col_reads = 0  # 列を読んだ回数（計算量の目安。分類には使わない）

    # 列を読む: 成り立つ組の支え（各変数に残る値）と組の数を返す
    def column(self, j: int, dom: list[int]):
        p = self.p
        terms, res = p.cols[j]
        n = p.n
        ci, co = n + j, n + j + 1
        letters = [v for v, _ in terms]
        mults = [m for _, m in terms]
        sup = [0] * len(letters)
        sres = sci = sco = 0
        tuples = 0
        res_pos = letters.index(res) if res in letters else -1
        lists = [DIGITS[dom[v]] for v in letters]
        cdom_out = dom[co]
        rdom = dom[res]
        self.col_reads += 1
        for c in DIGITS[dom[ci]]:
            for combo in product(*lists):
                if len(set(combo)) != len(combo):
                    continue
                s = c
                for x, m in zip(combo, mults):
                    s += x * m
                r, o = s % 10, s // 10
                if not (cdom_out >> o & 1):
                    continue
                if res_pos >= 0:
                    if combo[res_pos] != r:
                        continue
                else:
                    if not (rdom >> r & 1) or r in combo:
                        continue
                tuples += 1
                for i, x in enumerate(combo):
                    sup[i] |= 1 << x
                sres |= 1 << r
                sci |= 1 << c
                sco |= 1 << o
        if tuples == 0:
            return None, 0
        out = {ci: sci, co: sco, res: sres}
        for v, s_ in zip(letters, sup):
            out[v] = out.get(v, 0b1111111111) & s_ if v in out else s_
        return out, tuples

    def table(self, dom: list[int]) -> dict[int, int] | None:
        """表を読む。決まった文字の数字を他から消す。文字が10個なら隠れた1つも決める。"""
        p = self.p
        n = p.n
        out: dict[int, int] = {}
        fixed = [v for v in range(n) if POP[dom[v]] == 1]
        fixed_mask = 0
        for v in fixed:
            if fixed_mask & dom[v]:
                return None
            fixed_mask |= dom[v]
        for v in range(n):
            if POP[dom[v]] > 1 and dom[v] & fixed_mask:
                out[v] = dom[v] & ~fixed_mask
        if n == 10:
            for d in range(10):
                holders = [v for v in range(n) if dom[v] >> d & 1]
                if not holders:
                    return None
                if len(holders) == 1 and POP[dom[holders[0]]] > 1:
                    v = holders[0]
                    out[v] = out.get(v, dom[v]) & (1 << d)
        if self.opts.get("subsets"):
            # 変種: 組の消去（k 文字の候補の和が k 個なら、その数字を他から消す）
            unfixed = [v for v in range(n) if POP[dom[v]] > 1]
            for size in (2, 3):
                for combo in _combos(unfixed, size):
                    u = 0
                    for v in combo:
                        u |= dom[v]
                    if POP[u] < size:
                        return None
                    if POP[u] == size:
                        for v in unfixed:
                            if v not in combo and dom[v] & u:
                                out[v] = out.get(v, dom[v]) & ~u
        return out

    def propagate(self, dom: list[int], dirty: set[int] | None = None):
        """読みを段で重ねる。戻り値は (状態, 段の数, 盤面, 段ごとの記録)。"""
        p = self.p
        dom = list(dom)
        if dirty is None:
            dirty = set(range(p.R))
        rounds = 0
        log = []
        sequential = self.opts.get("sequential")
        while True:
            new = list(dom)
            heavy = 0
            if sequential:
                # 変種: 右の列から1列ずつ読み、読んだ結果をすぐ使う（1巡を1段と数える）
                for j in sorted(dirty):
                    sup, t = self.column(j, new)
                    if sup is None:
                        return CONTRA, rounds + 1, new, log
                    for v, m in sup.items():
                        nm = new[v] & m
                        if nm != new[v]:
                            heavy = max(heavy, t)
                        new[v] = nm
                        if nm == 0:
                            return CONTRA, rounds + 1, new, log
                tb = self.table(new)
            else:
                for j in dirty:
                    sup, t = self.column(j, dom)
                    if sup is None:
                        return CONTRA, rounds + 1, new, log
                    for v, m in sup.items():
                        nm = new[v] & m
                        if nm != new[v]:
                            heavy = max(heavy, t)
                        new[v] = nm
                tb = self.table(dom)
            if tb is None:
                return CONTRA, rounds + 1, new, log
            for v, m in tb.items():
                new[v] &= m
            changed = [v for v in range(p.nvars) if new[v] != dom[v]]
            if any(x == 0 for x in new):
                return CONTRA, rounds + 1, new, log
            if not changed:
                return STUCK, rounds, dom, log
            rounds += 1
            log.append({"changed": len(changed), "heavy": heavy})
            dom = new
            dirty = set()
            for v in changed:
                dirty.update(p.var_cols[v])
            if not dirty:
                dirty = set()

    def solved(self, dom: list[int]) -> bool:
        return all(POP[dom[v]] == 1 for v in range(self.p.n))

    def solve(self, max_len: int = 99):
        """読みと場合分けで解く。特徴を返す。"""
        p = self.p
        dom = p.initial_domains()
        st, r, dom, log = self.propagate(dom)
        if st == CONTRA:
            return {"status": "contradiction"}
        main_rounds = r
        first_round_changed = log[0]["changed"] if log else 0
        heavy = max([x["heavy"] for x in log], default=0)
        fixed0 = sum(1 for v in range(p.n) if POP[dom[v]] == 1)
        stalls = []
        carry_first = self.opts.get("carry_first")
        apply_all = self.opts.get("apply_all")
        while not self.solved(dom):
            fails = []
            max_width = self.opts.get("max_width", 10)
            for v in range(p.nvars):
                if POP[dom[v]] < 2 or POP[dom[v]] > max_width:
                    continue
                for d in DIGITS[dom[v]]:
                    d2 = list(dom)
                    d2[v] = 1 << d
                    st2, rr, _, _ = self.propagate(d2, set(p.var_cols[v]))
                    if st2 == CONTRA:
                        fails.append((rr, v, d, POP[dom[v]]))
            if not fails:
                return {"status": "deep", "fixed0": fixed0, "stalls": len(stalls)}
            if carry_first:
                cf = [f for f in fails if f[1] >= p.n]
                if cf:
                    fails = cf
            minlen = min(f[0] for f in fails)
            chosen = fails if apply_all else [f for f in fails if f[0] == minlen]
            carry_avail = any(f[1] >= p.n for f in fails)
            carry_min = any(f[1] >= p.n for f in chosen)
            width = min(f[3] for f in chosen)
            stalls.append(
                {
                    "len": minlen,
                    "n_min": len(chosen),
                    "carry_avail": carry_avail,
                    "carry_min": carry_min,
                    "width": width,
                    "n_fail": len(fails),
                }
            )
            changed = set()
            for _, v, d, _ in chosen:
                dom[v] &= ~(1 << d)
                changed.add(v)
            dirty = set()
            for v in changed:
                dirty.update(p.var_cols[v])
            st, r, dom, log = self.propagate(dom, dirty)
            if st == CONTRA:
                return {"status": "error"}
            main_rounds += r
            heavy = max([heavy] + [x["heavy"] for x in log])
        return {
            "status": "ok",
            "rounds": main_rounds,
            "fixed0": fixed0,
            "first": first_round_changed,
            "heavy": heavy,
            "splits": len(stalls),
            "split_len_max": max([s["len"] for s in stalls], default=0),
            "split_len_sum": sum(s["len"] for s in stalls),
            "letter_only_stalls": sum(1 for s in stalls if not s["carry_avail"]),
            "width_max": max([s["width"] for s in stalls], default=0),
            "stalls": stalls,
            "col_reads": self.col_reads,
        }


def _combos(items, size):
    from itertools import combinations

    return combinations(items, size)


# ---------------------------------------------------------------- 読むモデル 版2（閉包）

INF = float("inf")
SOLVED = "solved"


class Closure:
    """読みの閉包。規則はどれも候補を減らすだけの単調な規則なので、適用順に依らず同じ盤面に止まる（導出）。

    - 列を読む（常に）と表を読む（常に）
    - pair_cap: 隣の2列をまとめて読む。2列の組の数の積が pair_cap 以下のときだけ読む（None なら読まない）
    - fl1: すぐ矛盾する仮定を消す（変数1つに値を置き、その変数に触れる列と表を1回読むだけで矛盾したら消す）
    - both: 場合分けの全部の枝で共通に消える候補を消す（SAC の中でだけ使う。closure 自体には入れない）
    - subsets: 組の消去
    """

    def __init__(self, p: Puzzle, pair_cap=None, fl1=False, fl1_width=3, subsets=False, order="lr"):
        self.p = p
        self.pair_cap = pair_cap
        self.fl1 = fl1
        self.fl1_width = fl1_width
        self.subsets = subsets
        self.order = order
        self.helper = Reader(p, {"subsets": subsets})

    def col_tuples(self, j: int, dom: list[int]):
        p = self.p
        terms, res = p.cols[j]
        n = p.n
        ci, co = n + j, n + j + 1
        letters = [v for v, _ in terms]
        mults = [m for _, m in terms]
        res_pos = letters.index(res) if res in letters else -1
        lets = letters + ([] if res_pos >= 0 else [res])
        lists = [DIGITS[dom[v]] for v in letters]
        out = []
        rdom = dom[res]
        cdo = dom[co]
        for c in DIGITS[dom[ci]]:
            for combo in product(*lists):
                if len(set(combo)) != len(combo):
                    continue
                sm = c
                for x, m in zip(combo, mults):
                    sm += x * m
                r, o = sm % 10, sm // 10
                if not (cdo >> o & 1):
                    continue
                if res_pos >= 0:
                    if combo[res_pos] != r:
                        continue
                    vals = combo
                else:
                    if not (rdom >> r & 1) or r in combo:
                        continue
                    vals = combo + (r,)
                mask = 0
                for x in vals:
                    mask |= 1 << x
                out.append((vals, c, o, mask))
        return lets, out

    def _prune(self, dom, vs, sups):
        changed = False
        for v, sp in zip(vs, sups):
            nm = dom[v] & sp
            if nm != dom[v]:
                dom[v] = nm
                changed = True
                if nm == 0:
                    return None
        return changed

    def _columns(self, dom, cols):
        p = self.p
        n = p.n
        changed = False
        cache = {}
        order = sorted(cols) if self.order == "lr" else sorted(cols, reverse=True)
        for j in order:
            lets, tl = self.col_tuples(j, dom)
            if not tl:
                return None, cache
            sup = [0] * len(lets)
            sci = sco = 0
            for vals, c, o, _ in tl:
                for i, x in enumerate(vals):
                    sup[i] |= 1 << x
                sci |= 1 << c
                sco |= 1 << o
            ch = self._prune(dom, lets + [n + j, n + j + 1], sup + [sci, sco])
            if ch is None:
                return None, cache
            changed |= ch
            if not ch:
                cache[j] = (lets, tl)
        return changed, cache

    def _table(self, dom):
        tb = self.helper.table(dom)
        if tb is None:
            return None
        changed = False
        for v, m in tb.items():
            nm = dom[v] & m
            if nm != dom[v]:
                dom[v] = nm
                changed = True
                if nm == 0:
                    return None
        return changed

    def _pairs(self, dom, cache):
        p = self.p
        n = p.n
        changed = False
        for j in range(p.R - 1):
            a = cache.get(j) or self.col_tuples(j, dom)
            b = cache.get(j + 1) or self.col_tuples(j + 1, dom)
            la, ta = a
            lb, tb = b
            if not ta or not tb:
                return None
            if len(ta) * len(tb) > self.pair_cap:
                continue
            shared = [(ia, lb.index(v)) for ia, v in enumerate(la) if v in lb]
            nuniq = len(set(la) | set(lb))
            byc = defaultdict(list)
            for t in tb:
                byc[t[1]].append(t)
            supa = [0] * len(la)
            supb = [0] * len(lb)
            s_ci = s_mid = s_co = 0
            any_ok = False
            for va, ca, oa, ma in ta:
                for vb, cb, ob, mb in byc.get(oa, ()):
                    if any(va[ia] != vb[ib] for ia, ib in shared):
                        continue
                    if POP[ma | mb] != nuniq:
                        continue
                    any_ok = True
                    for i, x in enumerate(va):
                        supa[i] |= 1 << x
                    for i, x in enumerate(vb):
                        supb[i] |= 1 << x
                    s_ci |= 1 << ca
                    s_mid |= 1 << oa
                    s_co |= 1 << ob
            if not any_ok:
                return None
            ch = self._prune(dom, la + lb + [n + j, n + j + 1, n + j + 2], supa + supb + [s_ci, s_mid, s_co])
            if ch is None:
                return None
            if ch:
                return True
        return changed

    def _fl1(self, dom):
        """すぐ矛盾する仮定を消す。変数1つに値を仮に置き、その変数に触れる列と表を、仮定した同じ盤面から1回ずつ読み、
        結果を重ねたときにどこかの候補が空になれば、その値を消す（読む順に依らない）。"""
        p = self.p
        n = p.n
        for v in range(p.nvars):
            w = POP[dom[v]]
            if w < 2 or (v < n and w > self.fl1_width):
                continue
            for d in DIGITS[dom[v]]:
                d2 = list(dom)
                d2[v] = 1 << d
                bad = False
                new = list(d2)
                for j in p.var_cols[v]:
                    lets, tl = self.col_tuples(j, d2)
                    if not tl:
                        bad = True
                        break
                    sup = [0] * len(lets)
                    sci = sco = 0
                    for vals, c, o, _ in tl:
                        for i, x in enumerate(vals):
                            sup[i] |= 1 << x
                        sci |= 1 << c
                        sco |= 1 << o
                    for u, sp in zip(lets + [n + j, n + j + 1], sup + [sci, sco]):
                        new[u] &= sp
                        if new[u] == 0:
                            bad = True
                    if bad:
                        break
                if not bad:
                    tb = self.helper.table(d2)
                    if tb is None:
                        bad = True
                    else:
                        for u, m in tb.items():
                            new[u] &= m
                            if new[u] == 0:
                                bad = True
                if bad:
                    dom[v] &= ~(1 << d)
                    if dom[v] == 0:
                        return None
                    return True
        return False

    def close(self, dom: list[int]):
        p = self.p
        dom = list(dom)
        allc = set(range(p.R))
        while True:
            ch, cache = self._columns(dom, allc)
            if ch is None:
                return CONTRA, dom
            if ch:
                continue
            ch = self._table(dom)
            if ch is None:
                return CONTRA, dom
            if ch:
                continue
            if self.pair_cap is not None:
                ch = self._pairs(dom, cache)
                if ch is None:
                    return CONTRA, dom
                if ch:
                    continue
            if self.fl1:
                ch = self._fl1(dom)
                if ch is None:
                    return CONTRA, dom
                if ch:
                    continue
            return STUCK, dom


def _solved(p, dom):
    return all(POP[dom[v]] == 1 for v in range(p.n))


def sac(p: Puzzle, dom, inner: Closure, allowed, both=False, one_at_a_time=None):
    """場合分けの閉包。allowed(v, w) が真の変数の各値を仮に置き、inner の閉包で矛盾したら消す。

    1波では、今の盤面で矛盾する仮定を全部見つけてまとめて消す。戻り値は (状態, 盤面, 波の数)。
    one_at_a_time を与えると、その順（変数の並べ替えの関数）で最初に矛盾した1つだけを消して読み直す（変種）。
    both が真なら、矛盾しなくても全部の枝で消える候補を消す（変種）。
    """
    waves = 0
    while True:
        st, dom = inner.close(dom)
        if st == CONTRA:
            return CONTRA, dom, waves
        if _solved(p, dom):
            return SOLVED, dom, waves
        vs = [v for v in range(p.nvars) if POP[dom[v]] >= 2 and allowed(v, POP[dom[v]])]
        if one_at_a_time is not None:
            vs = one_at_a_time(vs, dom)
        elim = []
        for v in vs:
            branches = []
            for d in DIGITS[dom[v]]:
                d2 = list(dom)
                d2[v] = 1 << d
                st2, r2 = inner.close(d2)
                if st2 == CONTRA:
                    elim.append((v, d))
                    if one_at_a_time is not None:
                        break
                else:
                    branches.append(r2)
            if one_at_a_time is not None and elim:
                break
            if both and branches:
                for u in range(p.nvars):
                    if u == v:
                        continue
                    common = 0
                    for b in branches:
                        common |= b[u]
                    if dom[u] & ~common:
                        elim.append((u, None, common))
        if not elim:
            return STUCK, dom, waves
        for e in elim:
            if len(e) == 3:
                dom[e[0]] &= e[2]
            else:
                dom[e[0]] &= ~(1 << e[1])
        waves += 1


def tier_solve(p: Puzzle, pair_cap=12, fl1=True, both=False, width_letter=2, subsets=False, order="lr", one_at_a_time=None):
    """読みの段（tier）を返す。1: 1列ずつ読む／2: 2列をまとめる・すぐ矛盾する仮定／3: 繰り上がりの二択／
    4: 文字の二択／5: 繰り上がりの三択（0・1・2）。どれでも解けなければ "deep"。
    width_letter は場合分けしてよい文字の候補の数（基準は 2。3 は変種）。"""
    dom = p.initial_domains()
    base = Closure(p, None, False, subsets=subsets, order=order)
    st, dom = base.close(dom)
    if st == CONTRA:
        return {"tier": "contradiction"}
    if _solved(p, dom):
        return {"tier": 1, "waves": 0}
    inner = Closure(p, pair_cap, fl1, fl1_width=width_letter, subsets=subsets, order=order)
    st, dom = inner.close(dom)
    if _solved(p, dom):
        return {"tier": 2, "waves": 0}
    steps = [
        (3, lambda v, w: v >= p.n and w == 2),
        (4, lambda v, w: (v >= p.n and w == 2) or (v < p.n and w == 2)),
        (5, lambda v, w: (v >= p.n and w <= 3) or (v < p.n and w <= width_letter)),
    ]
    for t, allowed in steps:
        st, dom, waves = sac(p, dom, inner, allowed, both=both, one_at_a_time=one_at_a_time)
        if st == SOLVED:
            return {"tier": t, "waves": waves}
        if st == CONTRA:
            return {"tier": "error"}
    return {"tier": "deep"}


# ---------------------------------------------------------------- 読むモデル 版3（読み手の族）


class FamReader:
    """読み手の族の1人。読みの強さを引数で決める。どの規則も候補が少ないほど多く消せる単調な規則なので、
    引数を強める向きに変えると、閉包は狭くなり、要る段（R）は下がるか同じになる（導出）。

    pair_cap / pair_mode: 隣の2列をまとめて読む上限。mode "product" は2列の組の数の積、"joined" はつないだ後の組の数
    nonadj_cap: 共通の文字を持つ隣でない2列をまとめて読む上限（つないだ後の組の数）
    win3_cap: 隣の3列をまとめて読む上限（途中とつないだ後の組の数）
    fl_depth: すぐ矛盾する値を消す読みの深さ（0: しない、1: 触れる列と表を1回、2: 変わった変数に触れる列をもう1回）
    fl_wl: すぐ矛盾する値を置いてよい文字の候補の数の上限（繰り上がりは候補の数を限らない）
    fl_both: すぐ矛盾する値の読みで、全部の値で消える候補も消す
    hidden: 10文字の表で、1つしか入らない数字を決める
    subsets: 組の消去
    col_cap: 1列を読むのを組の数が col_cap 以下の列だけにする（矛盾の検出は常にする）
    probe: 場合分けの枝の読み。None は同じ読みの閉包、整数はその段数で打ち切る（同時に読む1回を1段）
    both: 場合分けの全部の枝で消える候補も消す
    r2_wl: 段 R2 で場合分けしてよい文字の候補の数の上限
    """

    def __init__(self, p: Puzzle, pair_cap=None, pair_mode="product", pair_join_cap=None, nonadj_cap=None, win3_cap=None,
                 fl_depth=0, fl_wl=2, fl_both=False, hidden=True, subsets=False, col_cap=None, probe=None, both=False, r2_wl=3,
                 probe_reader=None):
        self.p = p
        self.pair_cap, self.pair_mode = pair_cap, pair_mode
        self.nonadj_cap, self.win3_cap = nonadj_cap, win3_cap
        self.fl_depth, self.fl_wl, self.fl_both = fl_depth, fl_wl, fl_both
        self.hidden, self.subsets, self.col_cap = hidden, subsets, col_cap
        self.probe_rounds, self.both, self.r2_wl = probe, both, r2_wl
        self.pair_join_cap = pair_join_cap
        # 場合分けの枝の中だけ別の読み手で読む（変種）
        self.inner = FamReader(p, **probe_reader) if probe_reader else None
        self._c = Closure(p)
        lets = [set(v for v, _ in p.cols[j][0]) | {p.cols[j][1]} for j in range(p.R)]
        self.groups = []
        if pair_cap is not None:
            self.groups += [((j, j + 1), pair_cap, True, pair_mode) for j in range(p.R - 1)]
        if win3_cap is not None:
            self.groups += [((j, j + 1, j + 2), win3_cap, True, "joined") for j in range(p.R - 2)]
        if nonadj_cap is not None:
            for a in range(p.R):
                for b in range(a + 2, p.R):
                    if lets[a] & lets[b]:
                        self.groups.append(((a, b), nonadj_cap, False, "joined"))

    # ---- 部品
    def col_sup(self, j, dom, tl=None):
        p = self.p
        n = p.n
        lets, t = tl if tl is not None else self._c.col_tuples(j, dom)
        if not t:
            return None
        if self.col_cap is not None and len(t) > self.col_cap:
            return {}
        sup = [0] * len(lets)
        sci = sco = 0
        for vals, c, o, _ in t:
            for i, x in enumerate(vals):
                sup[i] |= 1 << x
            sci |= 1 << c
            sco |= 1 << o
        out = {n + j: sci, n + j + 1: sco}
        for v, sp in zip(lets, sup):
            out[v] = sp
        return out

    def table(self, dom):
        p = self.p
        n = p.n
        out = {}
        fixed = 0
        for v in range(n):
            if POP[dom[v]] == 1:
                if fixed & dom[v]:
                    return None
                fixed |= dom[v]
        for v in range(n):
            if POP[dom[v]] > 1 and dom[v] & fixed:
                out[v] = dom[v] & ~fixed
        if n == 10 and self.hidden:
            for d in range(10):
                hs = [v for v in range(n) if dom[v] >> d & 1]
                if not hs:
                    return None
                if len(hs) == 1 and POP[dom[hs[0]]] > 1:
                    out[hs[0]] = out.get(hs[0], dom[hs[0]]) & (1 << d)
        if self.subsets:
            from itertools import combinations

            unf = [v for v in range(n) if POP[dom[v]] > 1]
            for size in (2, 3):
                for combo in combinations(unf, size):
                    u = 0
                    for v in combo:
                        u |= dom[v]
                    if POP[u] < size:
                        return None
                    if POP[u] == size:
                        for v in unf:
                            if v not in combo and dom[v] & u:
                                out[v] = out.get(v, dom[v]) & ~u
        return out

    def join(self, cols, dom, cap, linked, mode, tls=None):
        p = self.p
        n = p.n
        tl = [tls[j] if tls and j in tls else self._c.col_tuples(j, dom) for j in cols]
        for _, t in tl:
            if not t:
                return None
        jcap = cap
        if mode in ("product", "or"):
            prod = 1
            for _, t in tl:
                prod *= len(t)
            if mode == "product" and prod > cap:
                return {}
            if mode == "or":
                if prod <= cap:
                    mode = "all"
                else:
                    mode = "joined"
                    jcap = self.pair_join_cap
        lets0, t0 = tl[0]
        parts = [({v: x for v, x in zip(lets0, vals)}, m, c, (o,)) for vals, c, o, m in t0]
        for k in range(1, len(cols)):
            lets, t = tl[k]
            new = []
            for asg, m, c0, outs in parts:
                for vals, c, o, mm in t:
                    if linked and c != outs[-1]:
                        continue
                    ok = True
                    for v, x in zip(lets, vals):
                        y = asg.get(v)
                        if y is not None and y != x:
                            ok = False
                            break
                    if not ok:
                        continue
                    a2 = dict(asg)
                    for v, x in zip(lets, vals):
                        a2[v] = x
                    m2 = m | mm
                    if POP[m2] != len(a2):
                        continue
                    new.append((a2, m2, c0, outs + (o,)))
                    if mode == "joined" and len(new) > jcap:
                        return {}
            parts = new
            if not parts:
                return None
        sup = defaultdict(int)
        for asg, m, c0, outs in parts:
            for v, x in asg.items():
                sup[v] |= 1 << x
            if linked:
                sup[n + cols[0]] |= 1 << c0
                for k, o in enumerate(outs):
                    sup[n + cols[k] + 1] |= 1 << o
        return dict(sup)

    def _fl_probe(self, dom, v, d):
        """値を置き、触れる列と表を fl_depth 回読む。矛盾なら None、そうでなければ読んだ後の盤面。"""
        p = self.p
        d2 = list(dom)
        d2[v] = 1 << d
        cur = d2
        cols = set(p.var_cols[v])
        for _ in range(self.fl_depth):
            new = list(cur)
            for j in sorted(cols):
                sp = self.col_sup(j, cur)
                if sp is None:
                    return None
                for u, m in sp.items():
                    new[u] &= m
                    if new[u] == 0:
                        return None
            tb = self.table(cur)
            if tb is None:
                return None
            for u, m in tb.items():
                new[u] &= m
                if new[u] == 0:
                    return None
            ch = [u for u in range(p.nvars) if new[u] != cur[u]]
            cols = set()
            for u in ch:
                cols.update(p.var_cols[u])
            cur = new
            if not cols:
                break
        return cur

    def fl_elims(self, dom):
        p = self.p
        n = p.n
        out = {}
        for v in range(p.nvars):
            w = POP[dom[v]]
            if w < 2 or (v < n and w > self.fl_wl) or (v >= n and w > 2 and getattr(self, "fl_c2", False)):
                continue
            keep = 0
            union = None
            for d in DIGITS[dom[v]]:
                r = self._fl_probe(dom, v, d)
                if r is None:
                    continue
                keep |= 1 << d
                if self.fl_both:
                    union = list(r) if union is None else [a | b for a, b in zip(union, r)]
            if keep == 0:
                return None
            if keep != dom[v]:
                out[v] = out.get(v, dom[v]) & keep
            if self.fl_both and union is not None:
                for u in range(p.nvars):
                    if u != v and dom[u] & ~union[u]:
                        out[u] = out.get(u, dom[u]) & union[u]
        return out

    @staticmethod
    def _apply(dom, sup):
        ch = False
        for u, m in sup.items():
            nm = dom[u] & m
            if nm != dom[u]:
                dom[u] = nm
                ch = True
                if nm == 0:
                    return None
        return ch

    # ---- 読みの閉包（読む順に依らない）
    def close(self, dom):
        p = self.p
        dom = list(dom)
        while True:
            ch = False
            for j in range(p.R):
                sp = self.col_sup(j, dom)
                if sp is None:
                    return CONTRA, dom
                r = self._apply(dom, sp)
                if r is None:
                    return CONTRA, dom
                ch |= r
            if ch:
                continue
            tb = self.table(dom)
            if tb is None:
                return CONTRA, dom
            r = self._apply(dom, tb)
            if r is None:
                return CONTRA, dom
            if r:
                continue
            ch = False
            for cols, cap, linked, mode in self.groups:
                sp = self.join(cols, dom, cap, linked, mode)
                if sp is None:
                    return CONTRA, dom
                r = self._apply(dom, sp)
                if r is None:
                    return CONTRA, dom
                if r:
                    ch = True
                    break
            if ch:
                continue
            if self.fl_depth:
                e = self.fl_elims(dom)
                if e is None:
                    return CONTRA, dom
                r = self._apply(dom, e)
                if r is None:
                    return CONTRA, dom
                if r:
                    continue
            return STUCK, dom

    def round_once(self, dom):
        """盤面1つから全部の読みを同時に当てた次の盤面（None は矛盾）。"""
        p = self.p
        new = list(dom)
        sups = []
        tls = {}
        for j in range(p.R):
            t = self._c.col_tuples(j, dom)
            tls[j] = t
            sp = self.col_sup(j, dom, t)
            if sp is None:
                return None
            sups.append(sp)
        tb = self.table(dom)
        if tb is None:
            return None
        sups.append(tb)
        for cols, cap, linked, mode in self.groups:
            sp = self.join(cols, dom, cap, linked, mode, tls)
            if sp is None:
                return None
            sups.append(sp)
        if self.fl_depth:
            e = self.fl_elims(dom)
            if e is None:
                return None
            sups.append(e)
        for sp in sups:
            for u, m in sp.items():
                new[u] &= m
                if new[u] == 0:
                    return None
        return new

    def probe(self, dom):
        if self.inner is not None:
            return self.inner.probe(dom)
        if self.probe_rounds is None:
            return self.close(dom)
        cur = list(dom)
        for _ in range(self.probe_rounds):
            new = self.round_once(cur)
            if new is None:
                return CONTRA, cur
            if new == cur:
                break
            cur = new
        return STUCK, cur

    def sac(self, dom, allowed):
        p = self.p
        waves = 0
        while True:
            st, dom = self.close(dom)
            if st == CONTRA:
                return CONTRA, dom, waves
            if _solved(p, dom):
                return SOLVED, dom, waves
            vs = [v for v in range(p.nvars) if POP[dom[v]] >= 2 and allowed(v, POP[dom[v]])]
            elim = []
            for v in vs:
                branches = []
                for d in DIGITS[dom[v]]:
                    d2 = list(dom)
                    d2[v] = 1 << d
                    st2, r2 = self.probe(d2)
                    if st2 == CONTRA:
                        elim.append((v, d, None))
                    else:
                        branches.append(r2)
                if self.both and branches:
                    for u in range(p.nvars):
                        if u == v:
                            continue
                        common = 0
                        for b in branches:
                            common |= b[u]
                        if dom[u] & ~common:
                            elim.append((u, None, common))
            if not elim:
                return STUCK, dom, waves
            for u, d, common in elim:
                if common is None:
                    dom[u] &= ~(1 << d)
                else:
                    dom[u] &= common
            waves += 1

    def tier(self):
        """R0: 場合分けなしで解ける／R1: 二択（候補2つの繰り上がりか文字）の場合分けで解ける／
        R2: 三択（候補3つの繰り上がりか、候補 r2_wl 以下の文字）まで許すと解ける／deep: それでも解けない。"""
        p = self.p
        n = p.n
        st, dom = self.close(p.initial_domains())
        if st == CONTRA:
            return {"R": "contradiction"}
        if _solved(p, dom):
            return {"R": 0, "waves": 0}
        st, dom, w1 = self.sac(dom, lambda v, w: w == 2)
        if st == SOLVED:
            return {"R": 1, "waves": w1}
        if st == CONTRA:
            return {"R": "error"}
        r2wl = self.r2_wl
        st, dom, w2 = self.sac(dom, lambda v, w: (v >= n and w <= 3) or (v < n and w <= r2wl))
        if st == SOLVED:
            return {"R": 2, "waves": w1 + w2}
        if st == CONTRA:
            return {"R": "error"}
        return {"R": "deep"}


# 版3 の読み手の族。読み方の幅は、2回の A4 で自然さが中〜高とされた範囲（先読み1〜2手、2列は「つないだ組12」〜「積200」、
# 場合分けの枝は3段〜無制限、二択の重さは区別しない、全部の枝で消える候補を使う／使わない）。どの引数も単調なので、
# 強さの順に並べた5人の読み手で、族についての言い方（「族の誰でも」「軽い読み手なら」「強い読み手なら」）が決まる（導出）。
# W: いちばん軽い読み手（1列を読む・表を読むだけ。10文字の隠れた1つも使わない）
FAMILY_W = dict(pair_cap=None, fl_depth=0, hidden=False, subsets=False, probe=None, both=False)
# W⁺: 軽い読み手の上の端（2列はつないだ組12まで、先読み2手、表の隠れた1つと組の消去）
FAMILY_WP = dict(pair_cap=12, pair_mode="joined", fl_depth=2, fl_wl=2, hidden=True, subsets=True, probe=None, both=False)
# S⁻: 強い読み手の下の端（2列は積200かつないだ組50まで、先読み2手で候補3つの文字にも置く、表の隠れた1つと組の消去）
FAMILY_SM = dict(pair_cap=200, pair_mode="or", pair_join_cap=50, fl_depth=2, fl_wl=3, hidden=True, subsets=True, probe=None, both=False)
# S: いちばん強い読み手（S⁻ に、全部の枝で消える候補を使う読みと、共通の文字を持つ隣でない2列（つないだ組50まで）を足す）
FAMILY_S = dict(FAMILY_SM, nonadj_cap=50, fl_both=True, both=True)
# M: 提供範囲（当てずっぽうなしで解けるか）を決める中ほどの読み手（2列は積12まで、先読み1手、場合分けの枝は無制限）
FAMILY_M = dict(pair_cap=12, fl_depth=1, hidden=True, probe=None)


# ---------------------------------------------------------------- 試すモデル


def naive_trial(p: Puzzle, rng: random.Random, cap: int) -> dict:
    """補助を見ながらの深さ優先の試し置き。

    - 右の列から、足す文字に表で空いている数字（先頭は0以外）を無作為な順で置く。
    - 列の足す文字が埋まったら答えの文字を計算して置く。計算した数字が使用中（赤いマス）か、
      答えの文字が既に別の数字（赤い下線）なら、その列の最後の試し置きを戻して次を試す。
    - 置いた回数（試し置きと答えの書き込み）を数え、cap を超えたら打ち切る。
    """
    n = p.n
    assign = [-1] * n
    used = [False] * 10
    placements = 0
    backtracks = 0
    lead = p.lead
    stop = False

    def col(j: int, carry: int, todo: list[int]) -> bool:
        nonlocal placements, backtracks, stop
        if stop:
            return False
        if j == p.R:
            return carry == 0
        terms, res = p.cols[j]
        if todo:
            v = todo[0]
            if assign[v] >= 0:
                return col(j, carry, todo[1:])
            ds = [d for d in range(10) if not used[d] and not (d == 0 and v in lead)]
            rng.shuffle(ds)
            for d in ds:
                placements += 1
                if placements > cap:
                    stop = True
                    return False
                assign[v] = d
                used[d] = True
                if col(j, carry, todo[1:]):
                    return True
                used[d] = False
                assign[v] = -1
                backtracks += 1
                if stop:
                    return False
            return False
        s = carry + sum(m * assign[v] for v, m in terms)
        r, co = s % 10, s // 10
        if assign[res] >= 0:
            if assign[res] != r:
                return False
            return col(j + 1, co, [v for v, _ in p.cols[j + 1][0]] if j + 1 < p.R else [])
        if used[r] or (r == 0 and res in lead):
            return False
        placements += 1
        if placements > cap:
            stop = True
            return False
        assign[res] = r
        used[r] = True
        if col(j + 1, co, [v for v, _ in p.cols[j + 1][0]] if j + 1 < p.R else []):
            return True
        used[r] = False
        assign[res] = -1
        backtracks += 1
        return False

    ok = col(0, 0, [v for v, _ in p.cols[0][0]])
    return {"solved": ok, "placements": placements, "backtracks": backtracks}


# ---------------------------------------------------------------- 1候補の処理


def n_range_for(lens: tuple[int, ...]) -> tuple[int, int]:
    occ = sum(lens) + max(lens) + 1
    return (max(5, max(lens) + 1), min(10, occ - 2))


def make_candidate(task):
    cond_i, i = task[0], task[1]
    nr_override = task[2] if len(task) > 2 else None
    lens = CONDITIONS[cond_i]
    seed = SEED_BASE + cond_i * 100000 + i + (0 if nr_override is None else 50000)
    rng = random.Random(seed)
    nonunique = 0
    gen_tries = 0
    t0 = time.perf_counter()
    for _ in range(400):
        g = generate(rng, lens, nr_override or n_range_for(lens))
        if g is None:
            return {"cond": cond_i, "i": i, "seed": seed, "status": "nogen"}
        p, sol, tries = g
        gen_tries += tries
        if count_solutions(p, 2) == 1:
            break
        nonunique += 1
    else:
        return {"cond": cond_i, "i": i, "seed": seed, "status": "nounique"}
    t_gen = time.perf_counter() - t0
    t1 = time.perf_counter()
    feat = Reader(p).solve()
    t_read = time.perf_counter() - t1
    row = {
        "cond": cond_i,
        "lens": list(lens),
        "i": i,
        "seed": seed,
        "addends": p.addends,
        "result": p.result,
        "solution": "".join(str(sol[ch]) for ch in p.letters),
        "letters": "".join(p.letters),
        "n": p.n,
        "k": p.k,
        "R": p.R,
        "nonunique": nonunique,
        "gen_tries": gen_tries,
        "t_gen": round(t_gen, 4),
        "t_read": round(t_read, 4),
    }
    row.update(feat)
    # 狭い場合分け（候補が3つ以下の文字と繰り上がりだけを場合分けする）。採る案の読み。
    t2 = time.perf_counter()
    row["nar"] = nar_features(Reader(p, {"max_width": 3}).solve())
    row["t_nar"] = round(time.perf_counter() - t2, 4)
    # 素朴な解き方: 3 回、上限 2000 回の置き
    nv = []
    for rep in range(3):
        nv.append(naive_trial(p, random.Random(seed * 7 + rep), 2000))
    row["naive"] = [x["placements"] if x["solved"] else None for x in nv]
    row["naive_back"] = [x["backtracks"] for x in nv]
    return row


NAR_KEYS = ("status", "rounds", "fixed0", "first", "splits", "split_len_max", "split_len_sum", "letter_only_stalls", "width_max", "heavy", "col_reads")


def nar_features(f: dict) -> dict:
    return {k: f.get(k) for k in NAR_KEYS}


def puzzle_of(row) -> Puzzle:
    return Puzzle(row["addends"], row["result"])


# ---------------------------------------------------------------- 案と分類


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def p3(xs):
    if not xs:
        return "-"
    return "/".join(_fmt(pct(xs, q)) for q in (0.1, 0.5, 0.9))


def _fmt(x):
    if x is None:
        return "-"
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.1f}"


def _nar(r):
    x = r.get("nar") or {}
    return x if x.get("status") == "ok" else None


def level_A(r):
    """案A 規模だけ: 足す数の数と桁で分ける（認識合わせの図の L1〜L5 を広げたもの）。読みは見ない。"""
    k, m = r["k"], max(r["lens"])
    if k == 2 and m <= 3:
        return 1
    if k == 2 and m == 4:
        return 2
    if k == 2 and m >= 5:
        return 3
    if k == 3 and m <= 4:
        return 4
    return 5


def level_Bw(r):
    """案Bw 場合分けの回数だけ（広い場合分け: どの文字のどの数字でも仮に置いてよい）。"""
    if r.get("status") != "ok":
        return None
    s = r["splits"]
    return 1 if s == 0 else 2 if s == 1 else 3 if s == 2 else 4 if s <= 4 else 5 if s <= 8 else None


def level_B(r):
    """案B 場合分けの回数だけ（狭い場合分け: 繰り上がりと候補3つ以下の文字だけ）。"""
    x = _nar(r)
    if x is None:
        return None
    s = x["splits"]
    return 1 if s == 0 else 2 if s == 1 else 3 if s == 2 else 4 if s <= 4 else 5


def level_C(r):
    """案C 場合分けの回数 × 長さ × 読みの段（狭い場合分け）。場合分けなしは段の数で L1/L2 に分ける。"""
    x = _nar(r)
    if x is None:
        return None
    s, L, rd = x["splits"], x["split_len_max"], x["rounds"]
    if s == 0:
        return 1 if rd <= 5 else 2
    if s <= 2 and L <= 2:
        return 3
    if s <= 3 and L <= 4:
        return 4
    if s <= 8 and L <= 8:
        return 5
    return None


def level_D(r):
    """案D 読みの段の数だけ（場合分けが要る問題は外す）。"""
    x = _nar(r)
    if x is None or x["splits"] > 0:
        return None
    rd = x["rounds"]
    return 1 if rd <= 3 else 2 if rd <= 5 else 3 if rd <= 7 else 4 if rd <= 9 else 5


def level_E(r):
    """案E 案C ＋ L5 は素朴な試し置きで 20×文字数 回以内に解けた試行が無い問題に限る（ほかは L4 へ）。"""
    c = level_C(r)
    if c == 5 and any(v is not None and v <= 20 * r["n"] for v in r["naive"]):
        return 4
    return c


def level_F(r):
    """案F 案C ＋ L5 は繰り上がりでは止まり、候補の少ない文字で場合分けする手詰まりを含む問題に限る（ほかは L4 へ）。"""
    c = level_C(r)
    if c == 5 and _nar(r)["letter_only_stalls"] == 0:
        return 4
    return c


# 規模の許す範囲（足す数の上限, 文字の数の下限, 文字の数の上限）。上のレベルほど広い盤面を許す。
SCALE_G1 = {1: (2, 5, 6), 2: (3, 5, 7), 3: (3, 5, 8), 4: (4, 5, 10), 5: (4, 5, 10)}
SCALE_G2 = {1: (2, 5, 6), 2: (3, 5, 7), 3: (3, 5, 8), 4: (4, 6, 10), 5: (4, 7, 10)}


def _scaled(r, table):
    c = level_C(r)
    if c is None:
        return None
    kmax, nmin, nmax = table[c]
    if r["k"] > kmax or not (nmin <= r["n"] <= nmax):
        return None
    return c


def level_G1(r):
    """案G1 案C ＋ 規模の上限（L1 は2つ足しで6文字まで、L2 は3つ足し・7文字まで、L3 は8文字まで、L4・L5 は制限なし）。外れた問題は組み合わせ外。"""
    return _scaled(r, SCALE_G1)


def level_G2(r):
    """案G2 案G1 ＋ 規模の下限（L4 は6文字から、L5 は7文字から）。外れた問題は組み合わせ外。"""
    return _scaled(r, SCALE_G2)


# G3: G2 に足す数の下限を足す（足す数の下限, 足す数の上限, 文字の数の下限, 文字の数の上限）
SCALE_G3 = {1: (2, 2, 5, 6), 2: (2, 3, 5, 7), 3: (2, 3, 5, 8), 4: (2, 3, 6, 10), 5: (3, 3, 7, 10)}


def level_G3(r):
    """案G3 案G2 ＋ 足す数（L5 は3つ足しに限り、繰り上がり 0・1・2 を読む。4つ足しは使わない）。外れた問題は組み合わせ外。"""
    c = level_C(r)
    if c is None:
        return None
    kmin, kmax, nmin, nmax = SCALE_G3[c]
    if not (kmin <= r["k"] <= kmax and nmin <= r["n"] <= nmax):
        return None
    return c


PLANS = {"A": level_A, "Bw": level_Bw, "B": level_B, "C": level_C, "D": level_D, "E": level_E, "F": level_F, "G1": level_G1, "G2": level_G2, "G3": level_G3}
ADOPTED = "G3"


def load(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def spearman(xs, ys):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        rk = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for t in range(i, j + 1):
                rk[order[t]] = (i + j) / 2
            i = j + 1
        return rk

    if len(xs) < 3:
        return None
    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return num / den if den else None


def cmd_corpus(args):
    nro = tuple(int(x) for x in args.nrange.split(",")) if args.nrange else None
    tasks = [(c, i, nro) if nro else (c, i) for c in range(len(CONDITIONS)) for i in range(args.start, args.start + args.per)]
    if args.conds:
        keep = {int(x) for x in args.conds.split(",")}
        tasks = [t for t in tasks if t[0] in keep]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool:
        rows = pool.map(make_candidate, tasks, chunksize=2)
    rows.sort(key=lambda r: (r["cond"], r["i"]))
    with open(args.out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(rows)} rows, {time.perf_counter() - t0:.1f}s, jobs={args.jobs}", file=sys.stderr)


def naive_ratio(r):
    nv = [x if x is not None else 2000 for x in r["naive"]]
    return statistics.median(nv) / r["n"]


def naive_within(r, mult):
    return sum(1 for x in r["naive"] if x is not None and x <= mult * r["n"]) / len(r["naive"])


def cond_name(r):
    return "+".join(map(str, r["lens"]))


def cmd_report(args):
    rows = [r for r in load(args.corpus) if "lens" in r]
    print(f"候補（一意解）{len(rows)} 問。条件ごとに {len(rows) // len(CONDITIONS)} 問を seed 固定で作った。")
    print()
    print("## 条件ごとの状態と特徴（狭い場合分けの読み。p10/p50/p90）")
    print("| 条件 | 候補 | 読めた | 範囲外(深い) | 一意解の割合 | 生成の試行/問 p50 | 文字 | 段 | 場合分け | 最長 | 1段目に減る変数 | 素朴 置き/文字 | 1候補の秒 p50/p95 |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for c, lens in enumerate(CONDITIONS):
        rs = [r for r in rows if r["cond"] == c]
        if not rs:
            continue
        o = [r["nar"] for r in rs if _nar(r)]
        deep = len(rs) - len(o)
        uq = len(rs) / max(1, sum(r["nonunique"] + 1 for r in rs))
        tries = statistics.median([r["gen_tries"] for r in rs])
        tt = [r["t_gen"] + r["t_nar"] for r in rs]
        print(
            f"| {'+'.join(map(str, lens))} | {len(rs)} | {len(o)} | {deep} | {uq:.2f} | {_fmt(tries)} | "
            f"{p3([r['n'] for r in rs])} | {p3([x['rounds'] for x in o])} | {p3([x['splits'] for x in o])} | "
            f"{p3([x['split_len_max'] for x in o])} | {p3([x['first'] for x in o])} | "
            f"{p3([naive_ratio(r) for r in rs])} | {pct(tt, 0.5):.3f}/{pct(tt, 0.95):.3f} |"
        )
    ok = [r for r in rows if _nar(r)]
    print()
    print("## 場合分けの回数 × 最長の場合分けの段（狭い場合分けで読めた問題）")
    c2 = Counter((min(r["nar"]["splits"], 9), min(r["nar"]["split_len_max"], 9)) for r in ok)
    print("| 回数＼最長 | " + " | ".join(str(i) if i < 9 else "9+" for i in range(10)) + " |")
    print("|---" * 11 + "|")
    for sp in range(10):
        print(f"| {sp if sp < 9 else '9+'} | " + " | ".join(str(c2[(sp, ln)]) for ln in range(10)) + " |")
    print()
    print("## 広い場合分けと狭い場合分けの比べ")
    wide_ok = sum(1 for r in rows if r.get("status") == "ok")
    print(f"広い場合分けで読めた {wide_ok}/{len(rows)}、狭い場合分けで読めた {len(ok)}/{len(rows)}")
    for name, fn in PLANS.items():
        plan_report(name, fn, rows)


MONO_KEYS = ("splits", "split_len_max", "rounds")


def plan_levels(fn, rows):
    lv = defaultdict(list)
    out = []
    for r in rows:
        L = fn(r)
        if L is None:
            out.append(r)
        else:
            lv[L].append(r)
    return lv, out


def plan_report(name, fn, rows):
    lv, out = plan_levels(fn, rows)
    total = len(rows)
    print()
    print(f"## {fn.__doc__.strip()}")
    print(f"範囲外 {len(out)}/{total}")
    print("| L | 件数 | 候補に占める割合 | 文字 | 足す数 | 段 | 場合分け | 最長 | 文字で場合分けする手詰まりあり | 1段目に減る変数 | 1列の組の数 | 素朴 置き/文字 | 素朴 20n内に解けた試行 |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    stats = {}
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            print(f"| {L} | 0 | 0 |" + " - |" * 10)
            continue
        xs = [r["nar"] if _nar(r) else None for r in v]
        rd = [x["rounds"] for x in xs if x]
        sp = [x["splits"] for x in xs if x]
        ln = [x["split_len_max"] for x in xs if x]
        stats[L] = {"rounds": rd, "splits": sp, "split_len_max": ln}
        lo = sum(1 for x in xs if x and x["letter_only_stalls"] > 0)
        print(
            f"| {L} | {len(v)} | {len(v) / total:.3f} | {p3([r['n'] for r in v])} | {p3([r['k'] for r in v])} | "
            f"{p3(rd)} | {p3(sp)} | {p3(ln)} | {lo / len(v):.2f} | {p3([x['first'] for x in xs if x])} | "
            f"{p3([x['heavy'] for x in xs if x])} | {p3([naive_ratio(r) for r in v])} | "
            f"{statistics.mean(naive_within(r, 20) for r in v):.2f} |"
        )
    inv = []
    for key in MONO_KEYS:
        for L in range(1, 5):
            if L in stats and L + 1 in stats and stats[L][key] and stats[L + 1][key]:
                for q in (0.1, 0.5, 0.9):
                    if pct(stats[L + 1][key], q) < pct(stats[L][key], q):
                        inv.append(f"{key} L{L}>L{L + 1} p{int(q * 100)}")
    print("B1 逆転: " + (", ".join(inv) if inv else "なし"))
    xs = [r["n"] for L, v in lv.items() for r in v]
    ys = [L for L, v in lv.items() for r in v]
    rho = spearman(xs, ys)
    rk = spearman([r["k"] for L, v in lv.items() for r in v], ys)
    rn = spearman([naive_ratio(r) for L, v in lv.items() for r in v], ys)
    print(f"B2/A5 レベルとの順位相関: 文字の数 {_fmt2(rho)}、足す数 {_fmt2(rk)}、素朴な置き/文字 {_fmt2(rn)}")
    by_n = defaultdict(Counter)
    for L, v in lv.items():
        for r in v:
            by_n[(r["k"], r["n"])][L] += 1
    print("B2 同じ規模（足す数, 文字）でのレベル内訳（20問以上の規模）: " + "; ".join(f"{k}:{dict(sorted(c.items()))}" for k, c in sorted(by_n.items()) if sum(c.values()) >= 20))
    by_c = defaultdict(Counter)
    for L, v in lv.items():
        for r in v:
            by_c[L][cond_name(r)] += 1
    print("E2 レベルごとの生成条件の内訳: " + "; ".join(f"L{L}:{dict(by_c[L].most_common(4))}" for L in sorted(by_c)))


def _fmt2(x):
    return "-" if x is None else f"{x:.2f}"


VARIANTS = {
    "subsets": {"subsets": True},
    "sequential": {"sequential": True},
    "apply_all": {"apply_all": True},
    "carry_first": {"carry_first": True},
    "width2": {"max_width": 2},
    "width4": {"max_width": 4},
}


def _variant_task(arg):
    row, vname = arg
    if vname == "swap":
        p = Puzzle(list(reversed(row["addends"])), row["result"])
        f = Reader(p, {"max_width": 3}).solve()
    elif vname == "rename":
        rng = random.Random(row["seed"])
        pool = list(LETTER_POOL)
        rng.shuffle(pool)
        m = dict(zip(row["letters"], pool))
        p = Puzzle(["".join(m[c] for c in w) for w in row["addends"]], "".join(m[c] for c in row["result"]))
        f = Reader(p, {"max_width": 3}).solve()
    else:
        opts = {"max_width": 3}
        opts.update(VARIANTS[vname])
        f = Reader(puzzle_of(row), opts).solve()
    nr = dict(row)
    nr["nar"] = nar_features(f)
    return row["cond"], row["i"], vname, nr


def cmd_variants(args):
    rows = [r for r in load(args.corpus) if "lens" in r]
    rng = random.Random(SEED_BASE)
    if args.sample and len(rows) > args.sample:
        rows = rng.sample(rows, args.sample)
    names = ["swap", "rename", "subsets", "sequential", "apply_all", "carry_first", "width2", "width4"]
    tasks = [(r, v) for r in rows for v in names]
    with Pool(args.jobs) as pool:
        res = pool.map(_variant_task, tasks, chunksize=4)
    base = {(r["cond"], r["i"]): r for r in rows}
    print(f"## A3 数え方の変種でレベルが変わる割合（候補 {len(rows)} 問を seed 固定で抜いた）")
    print("| 変種 | 案 | 変わった | 2段以上 | 範囲内⇔範囲外 |")
    print("|---|---|---|---|---|")
    for v in names:
        for pname in ("B", "C", "E", "F", "G1", "G2", "G3"):
            fn = PLANS[pname]
            tot = ch = ch2 = io = 0
            for c, i, vn, nr in res:
                if vn != v:
                    continue
                l0 = fn(base[(c, i)])
                l1 = fn(nr)
                tot += 1
                if l0 != l1:
                    if l0 is None or l1 is None:
                        io += 1
                    else:
                        ch += 1
                        if abs(l0 - l1) >= 2:
                            ch2 += 1
            print(f"| {v} | {pname} | {ch / tot:.3f} | {ch2 / tot:.3f} | {io / tot:.3f} |")


def _show(r):
    sol = dict(zip(r["letters"], r["solution"]))
    x = r["nar"]
    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
    return (
        f"seed {r['seed']}（{cond_name(r)}）: {' + '.join(r['addends'])} = {r['result']} ／ 文字 {r['n']}・段 {x['rounds']}・"
        f"場合分け {x['splits']}・最長 {x['split_len_max']}・文字で場合分け {x['letter_only_stalls']}・素朴 {r['naive']} ／ 解 {num}"
    )


def cmd_adopted(args):
    """採る案の検査（A1・A5・B4・B5・C1・C2・C3・D1・D2）と、代表・境界・異常な問題。"""
    rows = [r for p in args.corpus for r in load(p) if "lens" in r]
    fn = PLANS[args.plan]
    lv, out = plan_levels(fn, rows)
    print(f"## 案{args.plan} の検査（候補 {len(rows)} 問）")
    plan_report(args.plan, fn, rows)
    deep = sum(1 for r in rows if not _nar(r))
    cap = sum(1 for r in rows if _nar(r) and level_C(r) is None)
    comb = len(out) - deep - cap
    print(f"A1 状態: 評価不能（狭い場合分けで読めない）{deep} ／ 提供範囲外（場合分け 9 回以上か 9 段以上）{cap} ／ 提供範囲外（規模の組み合わせ外）{comb} ／ 分類済み {sum(len(v) for v in lv.values())}")
    for L in range(1, 6):
        v = lv.get(L, [])
        print(f"  L{L}: {len(v)}")
    allv = [r for v in lv.values() for r in v]
    sp = [r["nar"]["splits"] for r in allv]
    ln = [r["nar"]["split_len_max"] for r in allv]
    rd = [r["nar"]["rounds"] for r in allv]
    print(f"B4 順位相関（全問）: 場合分け×最長 {_fmt2(spearman(sp, ln))}、場合分け×段 {_fmt2(spearman(sp, rd))}、最長×段 {_fmt2(spearman(ln, rd))}")
    sv = [r for r in allv if r["nar"]["splits"] > 0]
    sp2 = [r["nar"]["splits"] for r in sv]
    ln2 = [r["nar"]["split_len_max"] for r in sv]
    rd2 = [r["nar"]["rounds"] for r in sv]
    print(f"B4 順位相関（場合分けのある {len(sv)} 問）: 場合分け×最長 {_fmt2(spearman(sp2, ln2))}、場合分け×段 {_fmt2(spearman(sp2, rd2))}、最長×段 {_fmt2(spearman(ln2, rd2))}")
    print("B5 推論の種類の出現（レベルごとの問題の割合）")
    print("| L | 場合分けなし | 繰り上がりの場合分け | 文字の場合分けが要る手詰まり | 文字10個（表の隠れた1つが使える） | 3つ足し（繰り上がり 0・1・2） | 4段以上先まで追う場合分け |")
    print("|---|---|---|---|---|---|---|")
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            continue
        def share(pred):
            return f"{sum(1 for r in v if pred(r)) / len(v):.2f}"
        print(
            f"| {L} | {share(lambda r: r['nar']['splits'] == 0)} | {share(lambda r: r['nar']['splits'] > r['nar']['letter_only_stalls'])} | "
            f"{share(lambda r: r['nar']['letter_only_stalls'] > 0)} | {share(lambda r: r['n'] == 10)} | {share(lambda r: r['k'] == 3)} | "
            f"{share(lambda r: r['nar']['split_len_max'] >= 4)} |"
        )
    print("A5 作業量（文字の数＝◯を付ける数）との重なり: レベルの中での 場合分け と 文字の数 の順位相関")
    for L in range(1, 6):
        v = lv.get(L, [])
        if len(v) >= 3:
            print(f"  L{L}: 場合分け×文字 {_fmt2(spearman([r['nar']['splits'] for r in v], [r['n'] for r in v]))}、段×文字 {_fmt2(spearman([r['nar']['rounds'] for r in v], [r['n'] for r in v]))}")
    print("C1 帯の中: 段 最小/p10/p50/p90/最大、最も弱い問題")
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            continue
        xs = [r["nar"]["rounds"] for r in v]
        weakest = min(v, key=lambda r: (r["nar"]["splits"], r["nar"]["split_len_max"], r["nar"]["rounds"]))
        print(f"  L{L}: {min(xs)}/{_fmt(pct(xs, .1))}/{_fmt(pct(xs, .5))}/{_fmt(pct(xs, .9))}/{max(xs)} 最も弱い {_show(weakest)}")
    print("C2 同じレベルの中で、文字の数ごとの段の中央値（広い盤面ほど易しくなっていないか）")
    for L in range(1, 6):
        v = lv.get(L, [])
        by = defaultdict(list)
        for r in v:
            by[r["n"]].append(r["nar"]["rounds"])
        print(f"  L{L}: " + ", ".join(f"{n}文字 {_fmt(statistics.median(x))}（{len(x)}）" for n, x in sorted(by.items())))
    print("C3 入口（1段目に候補が減る変数の数）: " + "; ".join(f"L{L} {p3([r['nar']['first'] for r in lv.get(L, [])])}" for L in range(1, 6)))
    print("D1 素朴な試し置き（補助あり、上限 2000 回、3 回）")
    print("| L | 置き/文字 p10/p50/p90 | 10n 内 | 20n 内 | 2000 回内 | 戻した回数 p50 |")
    print("|---|---|---|---|---|---|")
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            continue
        allb = [b for r in v for b in r["naive_back"]]
        print(
            f"| {L} | {p3([naive_ratio(r) for r in v])} | {statistics.mean(naive_within(r, 10) for r in v):.2f} | "
            f"{statistics.mean(naive_within(r, 20) for r in v):.2f} | {statistics.mean(naive_within(r, 10000) for r in v):.2f} | {_fmt(statistics.median(allb))} |"
        )
    print("最小〜最大（段・場合分け・最長・文字）: " + "; ".join(
        f"L{L} " + "・".join(f"{min(vals)}〜{max(vals)}" for vals in (
            [r['nar']['rounds'] for r in lv[L]], [r['nar']['splits'] for r in lv[L]], [r['nar']['split_len_max'] for r in lv[L]], [r['n'] for r in lv[L]]))
        for L in range(1, 6) if lv.get(L)))
    print("E1 条件ごとの各レベルの割合（一意解の候補に対する）と1候補の秒（生成＋読み、平均）")
    print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | 範囲外・評価不能 | 秒 |")
    print("|---|---|---|---|---|---|---|---|---|")
    byc = defaultdict(list)
    for r in rows:
        byc[cond_name(r)].append(r)
    for c in CONDITIONS:
        rs = byc.get("+".join(map(str, c)), [])
        if not rs:
            continue
        cnt = Counter(fn(r) for r in rs)
        print(f"| {'+'.join(map(str, c))} | {len(rs)} | " + " | ".join(f"{cnt[L] / len(rs):.3f}" for L in range(1, 6)) + f" | {cnt[None] / len(rs):.2f} | {statistics.mean(r['t_gen'] + r['t_nar'] for r in rs):.3f} |")
    keys = Counter(canonical_key(r["addends"], r["result"]) for r in allv)
    print(f"E3 分類済み {len(allv)} 問のうち、文字の付け替えと足す数の並べ替えで同じ問題の余り {sum(v - 1 for v in keys.values())}")
    print("D2 天井（L5 と L4 の段・場合分け・最長の p50）: " + "; ".join(
        f"L{L} 段 {_fmt(pct([r['nar']['rounds'] for r in lv[L]], .5))}・場合分け {_fmt(pct([r['nar']['splits'] for r in lv[L]], .5))}・最長 {_fmt(pct([r['nar']['split_len_max'] for r in lv[L]], .5))}"
        for L in (4, 5) if lv.get(L)))
    print()
    print("## 代表（各レベルで段・場合分け・最長・文字の数が中央値に近い問題）")
    for L in range(1, 6):
        v = list(lv.get(L, []))
        if not v:
            continue
        med = {k: statistics.median([r["nar"][k] for r in v]) for k in ("rounds", "splits", "split_len_max")}
        mn = statistics.median([r["n"] for r in v])
        v.sort(key=lambda r: (sum(abs(r["nar"][k] - med[k]) for k in med) + abs(r["n"] - mn), r["seed"]))
        print(f"- L{L}: {_show(v[0])}")
    print("## 境界（同じ足す数・文字の数で隣のレベルに分かれた対。段・場合分けが境目に近いもの）")
    for L in range(1, 5):
        lo = lv.get(L, [])
        hi = lv.get(L + 1, [])
        best = None
        for a in lo:
            for b in hi:
                if a["k"] == b["k"] and a["n"] == b["n"] and cond_name(a) == cond_name(b):
                    d = abs(a["nar"]["rounds"] - b["nar"]["rounds"]) + abs(a["nar"]["splits"] - b["nar"]["splits"]) + abs(a["nar"]["split_len_max"] - b["nar"]["split_len_max"])
                    if best is None or d < best[0] or (d == best[0] and (a["seed"], b["seed"]) < (best[1]["seed"], best[2]["seed"])):
                        best = (d, a, b)
        if best:
            print(f"- L{L}/L{L + 1}: {_show(best[1])}")
            print(f"  　　　 {_show(best[2])}")
    print("## 異常")
    v5 = lv.get(5, [])
    if v5:
        quick = min(v5, key=lambda r: (min([x for x in r["naive"] if x is not None], default=10**9) / r["n"], r["seed"]))
        print(f"- L5 で素朴な試し置きが最も早く解けた: {_show(quick)}")
        ext = max(v5, key=lambda r: (r["nar"]["splits"] + r["nar"]["split_len_max"], r["nar"]["rounds"], -r["seed"]))
        print(f"- L5 で場合分けが最も多く長い: {_show(ext)}")
    v1 = lv.get(1, [])
    if v1:
        hv = max(v1, key=lambda r: (naive_ratio(r), -r["seed"]))
        print(f"- L1 で素朴な試し置きが最も長くかかった: {_show(hv)}")


def canonical_key(addends, result) -> str:
    """文字の付け替えと足す数の並べ替えで同じ問題を同じキーにする（E3）。"""
    from itertools import permutations

    best = None
    for perm in permutations(addends):
        m: dict[str, str] = {}
        out = []
        for w in list(perm) + [result]:
            out.append("".join(m.setdefault(c, chr(65 + len(m))) for c in w))
        key = "+".join(out[:-1]) + "=" + out[-1]
        if best is None or key < best:
            best = key
    return best


def cmd_space(args):
    """小さな条件で、一意解の候補を N 問作ったときの、重複を除いた問題の数（候補空間の狭さ）。"""
    lens = tuple(int(x) for x in args.lens.split(","))
    rng = random.Random(5)
    seen = set()
    got = 0
    t0 = time.perf_counter()
    while got < args.n:
        p, _, _ = generate(rng, lens, n_range_for(lens))
        if count_solutions(p, 2) != 1:
            continue
        got += 1
        seen.add(canonical_key(p.addends, p.result))
    print(f"{'+'.join(map(str, lens))}: 一意解の候補 {args.n} 問のうち重複を除くと {len(seen)} 問（{time.perf_counter() - t0:.0f}s）")


# 版2 の読み方の設定（A4 の解釈を閉包の言葉に写したもの）
TIER_SETTINGS = {
    "cap0": {"pair_cap": None},
    "cap12": {"pair_cap": 12},
    "cap50": {"pair_cap": 50},
    "cap200": {"pair_cap": 200},
    "capinf": {"pair_cap": INF},
    "cap12_nofl1": {"pair_cap": 12, "fl1": False},
    "cap0_nofl1": {"pair_cap": None, "fl1": False},
    "cap12_both": {"pair_cap": 12, "both": True},
    "cap0_both": {"pair_cap": None, "both": True},
    "cap50_both": {"pair_cap": 50, "both": True},
    "cap12_w3": {"pair_cap": 12, "width_letter": 3},
    "cap12_subsets": {"pair_cap": 12, "subsets": True},
    "cap12_rl": {"pair_cap": 12, "order": "rl"},
    "cap12_one": {"pair_cap": 12, "one_at_a_time": "fixed"},
    "cap12_rand": {"pair_cap": 12, "one_at_a_time": "random"},
}


def tiers_of(p: Puzzle, names) -> dict:
    out = {}
    for name in names:
        kw = dict(TIER_SETTINGS[name])
        if kw.get("one_at_a_time") == "fixed":
            n = p.n
            # 繰り上がりを右から、次に候補の少ない文字の順で試し、最初に矛盾した1つだけを使う
            kw["one_at_a_time"] = lambda vs, dom, n=n: sorted(vs, key=lambda v: (0 if v >= n else 1, v if v >= n else POP[dom[v]], v))
        elif kw.get("one_at_a_time") == "random":
            rng = random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(p.text())))
            kw["one_at_a_time"] = lambda vs, dom, rng=rng: rng.sample(vs, len(vs))
        r = tier_solve(p, **kw)
        out[name] = [r["tier"], r.get("waves")]
    return out


def _tiers_task(arg):
    row, names = arg
    t0 = time.perf_counter()
    res = tiers_of(puzzle_of(row), names)
    keep = {k: row[k] for k in ("cond", "lens", "i", "seed", "addends", "result", "letters", "solution", "n", "k", "naive", "naive_back") if k in row}
    keep["tiers"] = res
    keep["t_tiers"] = round(time.perf_counter() - t0, 3)
    return keep


def cmd_tiers(args):
    rows = [r for p in args.corpus for r in load(p) if "lens" in r]
    names = args.settings.split(",") if args.settings else list(TIER_SETTINGS)
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool:
        res = pool.map(_tiers_task, [(r, names) for r in rows], chunksize=4)
    with open(args.out, "w", encoding="utf-8") as f:
        for r in res:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(res)} rows, {time.perf_counter() - t0:.1f}s", file=sys.stderr)


# 版2 の案。tiers の出力（設定ごとの読みの段）から決める。
BRACKETS = {
    "none": ["cap12"],
    "pairs12_50": ["cap12", "cap50", "cap12_both", "cap50_both", "cap12_subsets"],
    "pairs0_50": ["cap0", "cap12", "cap50", "cap0_both", "cap12_both", "cap50_both", "cap12_subsets"],
    "pairs0_200": ["cap0", "cap12", "cap50", "cap200", "cap0_both", "cap12_both", "cap50_both", "cap12_subsets"],
}
# 規模の許す範囲（足す数の上限, 文字の数の上限）。下のレベルほど小さい盤面。
SCALE_H = {1: (2, 7), 2: (3, 10), 3: (3, 10), 4: (3, 10), 5: (3, 10)}


def level_v2(r, bracket="pairs0_50", scale=True, setting_override=None):
    """版2 のレベル。読みの段（閉包で決める、どの順・どの道筋でも同じ）を、括りの中の全部の読み方で同じときだけ採る。"""
    names = BRACKETS[bracket]
    ts = r["tiers"]
    if setting_override:
        ts = dict(ts)
        ts.update(setting_override)
    vals = {ts[nm][0] for nm in names}
    if len(vals) != 1:
        return None
    t = vals.pop()
    if not isinstance(t, int):
        return None
    if r["k"] > 3:
        return None
    if scale:
        kmax, nmax = SCALE_H[t]
        if r["k"] > kmax or r["n"] > nmax:
            return None
    return t


V2_PLANS = {
    "H1": dict(bracket="none", scale=True),
    "H2": dict(bracket="pairs12_50", scale=True),
    "H3": dict(bracket="pairs0_50", scale=True),
    "H4": dict(bracket="pairs0_200", scale=True),
}
ADOPTED_V2 = "H3"

# A4 の解釈を版2 の設定に写したもの（行名は A4 の結果の行名）
A4_MAP = [
    ("pairs_12（2列をまとめて読む、積12まで）", "cap12"),
    ("pairs_50", "cap50"),
    ("pairs_200", "cap200"),
    ("pairs（上限なし）", "capinf"),
    ("2列をまとめて読まない", "cap0"),
    ("長さ1の場合分けを場合分けと数える（すぐ矛盾する仮定を読みに入れない）", "cap12_nofl1"),
    ("2列も長さ1も読みに入れない", "cap0_nofl1"),
    ("右から1列ずつ読む・同じ段で表を消す・決まった順に読む（列を読む順を逆にした）", "cap12_rl"),
    ("最短を知らず決まった順で試し、最初の矛盾を1つだけ使う", "cap12_one"),
    ("1つずつ使う（試す順は乱数）", "cap12_rand"),
    ("どの枝でも消える候補を消す（both）", "cap12_both"),
    ("場合分けする文字の候補を3つまで（width3）", "cap12_w3"),
    ("組の消去（subsets）", "cap12_subsets"),
]


def load_tiers(paths):
    """tiers の出力を読み、同じ seed の行の設定を重ねる。"""
    by = {}
    for p in paths:
        for r in load(p):
            key = (r["seed"], r["addends"] and tuple(r["addends"]), r["result"])
            if key in by:
                by[key]["tiers"].update(r["tiers"])
            else:
                by[key] = r
    return list(by.values())


def cmd_robust(args):
    rows = load_tiers(args.tiers)
    print(f"## 版2 の案（{len(rows)} 問）")
    for name, kw in V2_PLANS.items():
        lv = Counter(level_v2(r, **kw) for r in rows)
        print(f"- 案{name}（括り {kw['bracket']}・規模 {kw['scale']}）: " + "、".join(f"L{L} {lv[L]}" for L in range(1, 6)) + f"、外 {lv[None]}")
    print()
    print("## A4 の解釈でレベルが変わる割合（版2）")
    print("各案で分類済みの問題のうち、その解釈の読み方だけでレベルを決め直したとき（その案の規模の条件はそのまま）レベルが変わるか分類から外れる割合。")
    hdr = "| 解釈 | " + " | ".join(f"案{n}" for n in V2_PLANS) + " |"
    print(hdr)
    print("|---" * (len(V2_PLANS) + 1) + "|")
    for label, setting in A4_MAP:
        cells = []
        for name, kw in V2_PLANS.items():
            base = [(r, level_v2(r, **kw)) for r in rows]
            base = [(r, L) for r, L in base if L is not None]
            ch = 0
            byL = Counter()
            totL = Counter()
            for r, L in base:
                t = r["tiers"][setting][0]
                L2 = t if isinstance(t, int) and r["k"] <= 3 else None
                if L2 is not None and kw["scale"]:
                    kmax, nmax = SCALE_H[L2]
                    if r["k"] > kmax or r["n"] > nmax:
                        L2 = None
                totL[L] += 1
                if L2 != L:
                    ch += 1
                    byL[L] += 1
            worst = max((byL[L] / totL[L], L) for L in totL) if totL else (0, 0)
            cells.append(f"{ch / max(1, len(base)):.3f}（最大 L{worst[1]} {worst[0]:.2f}）")
        print(f"| {label} | " + " | ".join(cells) + " |")
    print()
    name = args.plan
    kw = V2_PLANS[name]
    lv = defaultdict(list)
    for r in rows:
        L = level_v2(r, **kw)
        if L is not None:
            lv[L].append(r)
    names_b = BRACKETS[kw["bracket"]]
    st = Counter()
    for r in rows:
        vals = {str(r["tiers"][nm][0]) for nm in names_b}
        if r["k"] > 3:
            st["4つ足し（使わない）"] += 1
        elif len(vals) > 1:
            st["読み方で段が変わる（境の余白で外す）"] += 1
        elif vals == {"deep"}:
            st["評価不能（どの読み方でも解けない）"] += 1
        elif level_v2(r, **kw) is None:
            st["規模の組み合わせ外"] += 1
        else:
            st["分類済み"] += 1
    print(f"## 案{name} の状態: " + "、".join(f"{k} {v}" for k, v in st.items()))
    print(f"## 案{name} の分布")
    print("| L | 件数 | 候補に占める割合 | 文字 | 足す数 | 場合分けの波 | 素朴 置き/文字 | 素朴 20n 内 | 素朴 2000 回内 |")
    print("|---|---|---|---|---|---|---|---|---|")
    ref = BRACKETS[kw["bracket"]][min(1, len(BRACKETS[kw["bracket"]]) - 1)]
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            print(f"| {L} | 0 |" + " - |" * 7)
            continue
        print(
            f"| {L} | {len(v)} | {len(v) / len(rows):.3f} | {p3([r['n'] for r in v])} | {p3([r['k'] for r in v])} | "
            f"{p3([r['tiers'][ref][1] for r in v])} | {p3([naive_ratio(r) for r in v])} | {statistics.mean(naive_within(r, 20) for r in v):.2f} | "
            f"{statistics.mean(naive_within(r, 10000) for r in v):.2f} |"
        )
    allv = [r for v in lv.values() for r in v]
    ys = [L for L, v in lv.items() for r in v]
    print(f"B2 レベルとの順位相関: 文字の数 {_fmt2(spearman([r['n'] for L, v in lv.items() for r in v], ys))}、足す数 {_fmt2(spearman([r['k'] for L, v in lv.items() for r in v], ys))}、素朴な置き/文字 {_fmt2(spearman([naive_ratio(r) for L, v in lv.items() for r in v], ys))}")
    by_n = defaultdict(Counter)
    for L, v in lv.items():
        for r in v:
            by_n[(r["k"], r["n"])][L] += 1
    print("B2 同じ規模（足す数, 文字）でのレベル内訳（20問以上）: " + "; ".join(f"{k}:{dict(sorted(c.items()))}" for k, c in sorted(by_n.items()) if sum(c.values()) >= 20))
    print("A5 レベルの中での 文字の数 の分布は上の表。")
    print("E1 条件ごとの各レベルの割合（一意解の候補に対する）")
    print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | 外 | 読みの秒 p50/p95 |")
    print("|---|---|---|---|---|---|---|---|---|")
    byc = defaultdict(list)
    for r in rows:
        byc[cond_name(r)].append(r)
    for c in CONDITIONS:
        rs = byc.get("+".join(map(str, c)), [])
        if not rs:
            continue
        cnt = Counter(level_v2(r, **kw) for r in rs)
        tt = [r["t_tiers"] for r in rs]
        print(f"| {'+'.join(map(str, c))} | {len(rs)} | " + " | ".join(f"{cnt[L] / len(rs):.3f}" for L in range(1, 6)) + f" | {cnt[None] / len(rs):.2f} | {_fmt(pct(tt, .5))}/{_fmt(pct(tt, .95))} |")
    keys = Counter(canonical_key(r["addends"], r["result"]) for r in allv)
    print(f"E3 分類済み {len(allv)} 問のうち重複の余り {sum(v - 1 for v in keys.values())}")
    print()
    print("## 代表・境界・異常")
    for L in range(1, 6):
        v = sorted(lv.get(L, []), key=lambda r: (abs(r["n"] - statistics.median([x["n"] for x in lv[L]])), abs(naive_ratio(r) - statistics.median([naive_ratio(x) for x in lv[L]])), r["seed"]))
        for r in v[:2]:
            print(f"- L{L} 代表: {_show2(r, ref)}")
    for L in range(1, 5):
        lo, hi = lv.get(L, []), lv.get(L + 1, [])
        pair = None
        for a in sorted(lo, key=lambda r: r["seed"]):
            for b in sorted(hi, key=lambda r: r["seed"]):
                if cond_name(a) == cond_name(b) and a["n"] == b["n"]:
                    pair = (a, b)
                    break
            if pair:
                break
        if pair:
            print(f"- L{L}/L{L + 1} 同じ規模: {_show2(pair[0], ref)} ／ {_show2(pair[1], ref)}")
    v5 = lv.get(5, [])
    if v5:
        q = min(v5, key=lambda r: (min([x for x in r["naive"] if x is not None], default=10**9) / r["n"], r["seed"]))
        print(f"- L5 で素朴な試し置きが最も早く解けた: {_show2(q, ref)}")
    v1 = lv.get(1, [])
    if v1:
        hv = max(v1, key=lambda r: (r["n"], r["k"], -r["seed"]))
        print(f"- L1 で最も大きい: {_show2(hv, ref)}")


def _show2(r, ref):
    sol = dict(zip(r["letters"], r["solution"]))
    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
    return f"seed {r['seed']}（{cond_name(r)}） {' + '.join(r['addends'])} = {r['result']}（文字 {r['n']}・波 {r['tiers'][ref][1]}・素朴 {r['naive']}・解 {num}）"


# ---------------------------------------------------------------- 版3 の案


def scale_cell(r):
    """盤面の規模の細かい組。2s: 2つ足しで4桁まで／2l: 2つ足しで5〜6桁／3s: 3つ足しで4桁まで／3l: 3つ足しで5桁以上。"""
    k, m = r["k"], max(r["lens"])
    if k == 2:
        return "2s" if m <= 4 else "2l"
    if k == 3:
        return "3s" if m <= 4 else "3l"
    return None


def scale_class(r):
    """盤面の規模の組。S1: 2つ足しで4桁まで／S2: 2つ足しで5〜6桁か、3つ足しで4桁まで／S3: 3つ足しで5桁以上。"""
    c = scale_cell(r)
    return {"2s": 1, "2l": 2, "3s": 2, "3l": 3}.get(c)


def read_class(r):
    """読みの組（族の読み手で決める）。
    E: W（1列と表だけ）で解ける。
    H1: W⁺ でも場合分けなしでは解けず、S⁻ なら場合分けなしで解ける。
    mH: W⁺ では場合分けが要り、S⁻ でも要るが、S なら要らない（H1 と H2 の境の余白）。
    H2: S でも場合分けが要る。
    None: W では解けないが W⁺ なら場合分けなしで解ける（E と H の境の余白）か、M が三択までの場合分けで解けない（評価不能）。"""
    f = r["fam"]
    if f["W"] == 0:
        return "E"
    if f["M"] not in (0, 1, 2):
        return None
    if f.get("WP", 1) == 0:
        return None
    if f.get("SM", f["S"]) == 0:
        return "H1"
    if f["S"] == 0:
        return "mH"
    if f["S"] in (1, 2):
        return "H2"
    return None


H_ANY = ("H1", "mH", "H2")


def _plan(cells):
    out = {}
    for (sc, cs), L in cells:
        for c in (H_ANY if cs == "H" else (cs,)):
            out[(sc, c)] = L
    return out


PLANS3 = {
    # 階段1: 規模を先に上げる（1列の重さ → 読み → 桁 → 読み）
    "PA3": _plan([(("2s", "E"), 1), (("3s", "E"), 2), (("3s", "H"), 3), (("3l", "H1"), 4), (("3l", "H2"), 5)]),
    # 階段2: 読みを先に上げる（読み → 1列の重さ → 桁 → 読み）
    "PD": _plan([(("2s", "E"), 1), (("2s", "H"), 2), (("3s", "H"), 3), (("3l", "H1"), 4), (("3l", "H2"), 5)]),
    # 階段2 で、L4 と L5 の境を S だけで引く（S⁻ との余白をとらない）
    "PDw": _plan([(("2s", "E"), 1), (("2s", "H"), 2), (("3s", "H"), 3), (("3l", "H1"), 4), (("3l", "mH"), 4), (("3l", "H2"), 5)]),
    # 斜め: 規模と読みの和
    "PC": _plan([(("2s", "E"), 1), (("3s", "E"), 2), (("2s", "H"), 2), (("2l", "H"), 3), (("3s", "H"), 3), (("3l", "H1"), 4), (("3l", "H2"), 5)]),
}
LETTERS3 = {1: (5, 7), 2: (5, 10), 3: (5, 10), 4: (6, 10), 5: (7, 10)}
ADOPTED_V3 = "PA3"


def level_v3(r, plan=ADOPTED_V3, letters=True, rc=None):
    sc = scale_cell(r)
    c = rc if rc is not None else read_class(r)
    if sc is None or c is None:
        return None
    L = PLANS3[plan].get((sc, c))
    if L is None:
        return None
    if letters:
        lo, hi = LETTERS3[L]
        if not (lo <= r["n"] <= hi):
            return None
    return L


def _fam_task(arg):
    row, extra = arg
    p = puzzle_of(row)
    t0 = time.perf_counter()
    st, dom = FamReader(p, **FAMILY_W).close(p.initial_domains())
    w = 0 if st != CONTRA and _solved(p, dom) else 1
    m = FamReader(p, **FAMILY_M).tier()
    sx = FamReader(p, **FAMILY_S).tier()
    fam = {"W": w, "M": m["R"], "Mw": m.get("waves"), "S": sx["R"]}
    for name in extra:
        kind, kw = FAM_VARIANTS[name]
        rd = FamReader(p, **kw)
        if kind == "W":
            st, dom = rd.close(p.initial_domains())
            fam[name] = 0 if st != CONTRA and _solved(p, dom) else 1
        else:
            fam[name] = rd.tier()["R"]
    keep = {k: row[k] for k in ("cond", "lens", "i", "seed", "addends", "result", "letters", "solution", "n", "k", "naive", "naive_back") if k in row}
    keep["fam"] = fam
    keep["heavy0"] = max(len(Closure(p).col_tuples(j, p.initial_domains())[1]) for j in range(p.R))
    keep["t_fam"] = round(time.perf_counter() - t0, 3)
    return keep


# A4（前回と今回）の解釈を、族のどの端を動かすかで写したもの。種類 W は W を置き換える、M は M を置き換える、S は S を置き換える。
FAM_VARIANTS = {
    "WP": ("WP", FAMILY_WP),
    "SM": ("SM", FAMILY_SM),
    # 族の中（W ≦ 変種 ≦ W⁺）: E と H の境の余白に入るので 0 になるはずのもの
    "W_hidden": ("W", dict(FAMILY_W, hidden=True)),
    "W_subsets": ("W", dict(FAMILY_W, subsets=True)),
    "W_pairs12": ("W", dict(FAMILY_W, pair_cap=12)),
    "W_joined12": ("W", dict(FAMILY_W, pair_cap=12, pair_mode="joined")),
    "W_fl1": ("W", dict(FAMILY_W, fl_depth=1)),
    "W_fl2": ("W", dict(FAMILY_W, fl_depth=2)),
    # 族の外（W より軽い: 1列を読むのを組の少ない列だけにする）
    "W_colcap50": ("W", dict(FAMILY_W, col_cap=50)),
    "W_colcap200": ("W", dict(FAMILY_W, col_cap=200)),
    # 族の外（軽い読み手の上の端をさらに強める）
    "WP_cap50": ("WP", dict(FAMILY_WP, pair_cap=50, pair_mode="or", pair_join_cap=12)),
    "WP_fl3": ("WP", dict(FAMILY_WP, fl_depth=3)),
    # 族の中（S⁻ ≦ 変種 ≦ S）
    "S_noboth": ("S", dict(FAMILY_S, both=False, fl_both=False)),
    "S_nononadj": ("S", dict(FAMILY_S, nonadj_cap=None)),
    "SM_both": ("SM", dict(FAMILY_SM, both=True)),
    # 族の外（強い読み手の下の端を弱める: 族の幅そのものを狭める主張）
    "SM_fl1": ("SM", dict(FAMILY_SM, fl_depth=1)),
    "SM_pairs50": ("SM", dict(FAMILY_SM, pair_cap=50, pair_mode="product", pair_join_cap=None)),
    "SM_nosubsets": ("SM", dict(FAMILY_SM, subsets=False)),
    # 族の外（いちばん強い読み手をさらに強める）
    "S_cap1000": ("S", dict(FAMILY_S, pair_cap=1000, pair_join_cap=200)),
    "S_win3_50": ("S", dict(FAMILY_S, win3_cap=50)),
    "S_win3_200": ("S", dict(FAMILY_S, win3_cap=200)),
    "S_nonadj200": ("S", dict(FAMILY_S, nonadj_cap=200)),
    "S_fl3": ("S", dict(FAMILY_S, fl_depth=3)),
    # 提供範囲を決める読み手 M の解釈
    "M_probe2": ("M", dict(FAMILY_M, probe=2)),
    "M_probe3": ("M", dict(FAMILY_M, probe=3)),
    "M_probe5": ("M", dict(FAMILY_M, probe=5)),
    "M_nofl1": ("M", dict(FAMILY_M, fl_depth=0)),
    "M_cap0": ("M", dict(FAMILY_M, pair_cap=None)),
    "M_fl2": ("M", dict(FAMILY_M, fl_depth=2)),
    "M_joined50": ("M", dict(FAMILY_M, pair_mode="joined", pair_cap=50)),
    "M_both": ("M", dict(FAMILY_M, both=True)),
    "M_r2l2": ("M", dict(FAMILY_M, r2_wl=2)),
    "M_r2l4": ("M", dict(FAMILY_M, r2_wl=4)),
    "M_probe_base": ("M", dict(FAMILY_M, probe_reader=dict(FAMILY_W))),
    "M_nohidden": ("M", dict(FAMILY_M, hidden=False)),
}


def cmd_family(args):
    rows = [r for p in args.corpus for r in load(p) if "lens" in r and r["k"] <= 3]
    extra = args.variants.split(",") if args.variants else []
    if args.only:
        keep = {json.loads(line)["seed"] for line in open(args.only, encoding="utf-8")}
        rows = [r for r in rows if r["seed"] in keep]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool:
        res = pool.map(_fam_task, [(r, extra) for r in rows], chunksize=4)
    with open(args.out, "w", encoding="utf-8") as f:
        for r in res:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(res)} rows, {time.perf_counter() - t0:.1f}s", file=sys.stderr)


def load_fam(paths):
    by = {}
    for p in paths:
        for r in load(p):
            key = r["seed"]
            if key in by:
                by[key]["fam"].update(r["fam"])
            else:
                by[key] = r
    return list(by.values())


def cmd_plans3(args):
    rows = load_fam(args.fam)
    print(f"## 版3（{len(rows)} 問。4つ足しを除く一意解の候補）")
    cell = Counter((scale_cell(r), read_class(r)) for r in rows)
    print("規模 × 読みの組の件数: " + "、".join(f"{sc}・{c}: {v}" for (sc, c), v in sorted(cell.items(), key=lambda x: (str(x[0][0]), str(x[0][1])))))
    for plan in PLANS3:
        lv = Counter(level_v3(r, plan) for r in rows)
        print(f"- 案{plan}: " + "、".join(f"L{L} {lv[L]}" for L in range(1, 6)) + f"、外 {lv[None]}")
    names = [k for k in FAM_VARIANTS if any(k in r["fam"] for r in rows)]
    if names:
        print()
        print("## 族の端を動かしたときにレベルが変わる割合（各案の分類済みのうち、レベルが変わるか外れる割合。括弧は最も動くレベル）")
        print("| 変種 | 動かす端 | " + " | ".join(f"案{p}" for p in PLANS3) + f" | 範囲外から入る（案{ADOPTED_V3}） |")
        print("|---|---|" + "---|" * len(PLANS3) + "---|")
        for nm in names:
            kind = FAM_VARIANTS[nm][0]
            cells = []
            for plan in PLANS3:
                ch = 0
                tot = 0
                byL = Counter()
                totL = Counter()
                for r in rows:
                    L0 = level_v3(r, plan)
                    if L0 is None or nm not in r["fam"]:
                        continue
                    f2 = dict(r["fam"])
                    f2[kind] = r["fam"][nm]
                    r2 = dict(r)
                    r2["fam"] = f2
                    L1 = level_v3(r2, plan)
                    tot += 1
                    totL[L0] += 1
                    if L1 != L0:
                        ch += 1
                        byL[L0] += 1
                worst = max(((byL[L] / totL[L]), L) for L in totL) if totL else (0, 0)
                cells.append(f"{ch / max(1, tot):.3f}（L{worst[1]} {worst[0]:.2f}）")
            inflow = 0
            for r in rows:
                if nm not in r["fam"] or level_v3(r, ADOPTED_V3) is not None:
                    continue
                f2 = dict(r["fam"])
                f2[kind] = r["fam"][nm]
                r2 = dict(r)
                r2["fam"] = f2
                if level_v3(r2, ADOPTED_V3) is not None:
                    inflow += 1
            print(f"| {nm} | {kind} | " + " | ".join(cells) + f" | {inflow} |")
    plan = args.plan
    lv = defaultdict(list)
    for r in rows:
        L = level_v3(r, plan)
        if L is not None:
            lv[L].append(r)
    st = Counter()
    for r in rows:
        c = read_class(r)
        f = r["fam"]
        if c is None and f["W"] != 0 and f["M"] not in (0, 1, 2):
            st["評価不能（M が三択までで解けない）"] += 1
        elif c is None:
            st["E と H の境の余白（W では解けず W⁺ なら場合分けなしで解ける）"] += 1
        elif level_v3(r, plan, letters=False) is None and c == "mH":
            st["H1 と H2 の境の余白か組み合わせ外"] += 1
        elif level_v3(r, plan, letters=False) is None:
            st["規模と読みの組み合わせ外"] += 1
        elif level_v3(r, plan) is None:
            st["文字の数の範囲外"] += 1
        else:
            st["分類済み"] += 1
    print()
    print(f"## 案{plan} の状態: " + "、".join(f"{k} {v}" for k, v in st.items()))
    print(f"## 案{plan} の分布")
    print("| L | 件数 | 候補に占める割合 | 文字 | 足す数 | 最も長い数の桁 | 1列の組の数（最初） | 中ほどの読み手の段 R | 中ほどの読み手の波 | 素朴 置き/文字 | 素朴 20n 内 | 素朴 2000 回内 |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            print(f"| {L} | 0 |" + " - |" * 10)
            continue
        print(
            f"| {L} | {len(v)} | {len(v) / len(rows):.3f} | {p3([r['n'] for r in v])} | {p3([r['k'] for r in v])} | {p3([max(r['lens']) for r in v])} | "
            f"{p3([r['heavy0'] for r in v])} | {p3([r['fam']['M'] for r in v])} | {p3([r['fam']['Mw'] for r in v])} | {p3([naive_ratio(r) for r in v])} | "
            f"{statistics.mean(naive_within(r, 20) for r in v):.2f} | {statistics.mean(naive_within(r, 10000) for r in v):.2f} |"
        )
    ys = [L for L, v in lv.items() for r in v]
    print(f"B2 レベルとの順位相関: 文字の数 {_fmt2(spearman([r['n'] for L, v in lv.items() for r in v], ys))}、素朴な置き/文字 {_fmt2(spearman([naive_ratio(r) for L, v in lv.items() for r in v], ys))}、中ほどの読み手の段 {_fmt2(spearman([r['fam']['M'] for L, v in lv.items() for r in v], ys))}")
    print("A5 同じ読みの組の中で、規模の組が上がると何が変わるか（中ほどの読み手の段と波、1列の組の数の p50）")
    for c in ("E", "H1", "H2"):
        for sc in ("2s", "2l", "3s", "3l"):
            v = [r for r in rows if read_class(r) == c and scale_cell(r) == sc]
            if len(v) >= 10:
                print(f"  {c}・{sc}: {len(v)} 問、M の段 {p3([r['fam']['M'] for r in v])}、M の波 {p3([r['fam']['Mw'] for r in v])}、1列の組の数 {p3([r['heavy0'] for r in v])}、素朴 置き/文字 {p3([naive_ratio(r) for r in v])}")
    print("E1 条件ごとの各レベルの割合（一意解の候補に対する）と1候補の読みの秒（W・M・S）")
    print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | 秒 p50/p95 |")
    print("|---|---|---|---|---|---|---|---|")
    byc = defaultdict(list)
    for r in rows:
        byc[cond_name(r)].append(r)
    for cnd in CONDITIONS:
        rs = byc.get("+".join(map(str, cnd)), [])
        if not rs:
            continue
        cnt = Counter(level_v3(r, plan) for r in rs)
        tt = [r["t_fam"] for r in rs]
        print(f"| {'+'.join(map(str, cnd))} | {len(rs)} | " + " | ".join(f"{cnt[L] / len(rs):.3f}" for L in range(1, 6)) + f" | {_fmt(pct(tt, .5))}/{_fmt(pct(tt, .95))} |")
    allv = [r for v in lv.values() for r in v]
    keys = Counter(canonical_key(r["addends"], r["result"]) for r in allv)
    print(f"E3 分類済み {len(allv)} 問のうち重複の余り {sum(v - 1 for v in keys.values())}")
    print()
    print("## 代表・境界・異常")
    for L in range(1, 6):
        v = lv.get(L, [])
        if not v:
            continue
        mn = statistics.median([r["n"] for r in v])
        mr = statistics.median([naive_ratio(r) for r in v])
        v = sorted(v, key=lambda r: (abs(r["n"] - mn), abs(naive_ratio(r) - mr), r["seed"]))
        for r in v[:2]:
            print(f"- L{L} 代表: {_show3(r)}")
    for L in range(1, 5):
        lo, hi = lv.get(L, []), lv.get(L + 1, [])
        if lo and hi:
            a = min(lo, key=lambda r: (-r["n"], r["seed"]))
            b = min(hi, key=lambda r: (r["n"], r["seed"]))
            print(f"- L{L}/L{L + 1} の境: L{L} で文字が最も多い {_show3(a)} ／ L{L + 1} で文字が最も少ない {_show3(b)}")
    v5 = lv.get(5, [])
    if v5:
        q = min(v5, key=lambda r: (min([x for x in r["naive"] if x is not None], default=10**9) / r["n"], r["seed"]))
        print(f"- L5 で素朴な試し置きが最も早く解けた: {_show3(q)}")
    v3 = lv.get(3, [])
    if v3:
        q = min(v3, key=lambda r: (r["fam"]["M"], r["n"], r["seed"]))
        print(f"- L3 で中ほどの読み手に最も軽い: {_show3(q)}")


def _show3(r):
    sol = dict(zip(r["letters"], r["solution"]))
    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
    f = r["fam"]
    return f"seed {r['seed']}（{cond_name(r)}） {' + '.join(r['addends'])} = {r['result']}（文字 {r['n']}・W {f['W']}・M {f['M']}・S {f['S']}・素朴 {r['naive']}・解 {num}）"


def cmd_givens(args):
    """手がかり（最初から見えている文字）を1つ足すと、一意解でない候補が一意になる割合。"""
    rng = random.Random(SEED_BASE + 7)
    out = []
    for c, lens in enumerate(CONDITIONS):
        tried = made = 0
        for _ in range(args.per):
            g = generate(rng, lens, n_range_for(lens))
            if not g:
                continue
            p, sol, _ = g
            if count_solutions(p, 2) == 1:
                continue
            tried += 1
            ok = False
            for ch in p.letters:
                q = GivenPuzzle(p, {p.idx[ch]: sol[ch]})
                if q.count() == 1:
                    ok = True
                    break
            made += ok
        out.append((lens, tried, made))
        print(f"| {'+'.join(map(str, lens))} | {tried} | {made / max(1, tried):.2f} |")


class GivenPuzzle:
    def __init__(self, p: Puzzle, given: dict[int, int]):
        self.p = p
        self.given = given

    def count(self) -> int:
        # 手がかりの文字の数字を固定して数える（変換して既存の探索に乗せる）
        p = self.p
        sols = 0
        # 単純な全探索: 解を列挙して手がかりに合うものを数える
        n = p.n
        res = []

        def rec(j, carry, todo, assign, used):
            nonlocal sols
            if sols >= 2:
                return
            if j == p.R:
                if carry == 0:
                    sols += 1
                return
            terms, rl = p.cols[j]
            if todo:
                v = todo[0]
                if assign[v] >= 0:
                    rec(j, carry, todo[1:], assign, used)
                    return
                cand = [self.given[v]] if v in self.given else range(10)
                for d in cand:
                    if used >> d & 1 or (d == 0 and v in p.lead):
                        continue
                    if v not in self.given and d in self.given.values():
                        continue
                    assign[v] = d
                    rec(j, carry, todo[1:], assign, used | 1 << d)
                    assign[v] = -1
                return
            s_ = carry + sum(m * assign[v] for v, m in terms)
            r, co = s_ % 10, s_ // 10
            nxt = [v for v, _ in p.cols[j + 1][0]] if j + 1 < p.R else []
            if assign[rl] >= 0:
                if assign[rl] == r:
                    rec(j + 1, co, nxt, assign, used)
                return
            if used >> r & 1 or (r == 0 and rl in p.lead):
                return
            if rl in self.given and self.given[rl] != r:
                return
            if rl not in self.given and r in self.given.values():
                return
            assign[rl] = r
            rec(j + 1, co, nxt, assign, used | 1 << r)
            assign[rl] = -1

        rec(0, 0, [v for v, _ in p.cols[0][0]], [-1] * n, 0)
        return sols


def _fam_of(p: Puzzle) -> dict:
    st, dom = FamReader(p, **FAMILY_W).close(p.initial_domains())
    w = 0 if st != CONTRA and _solved(p, dom) else 1
    m = FamReader(p, **FAMILY_M).tier()
    sx = FamReader(p, **FAMILY_S).tier()
    wp = FamReader(p, **FAMILY_WP).tier()["R"]
    sm = FamReader(p, **FAMILY_SM).tier()["R"]
    return {"W": w, "WP": wp, "M": m["R"], "Mw": m.get("waves"), "SM": sm, "S": sx["R"]}


def cmd_expected3(args):
    """移植の期待値（版3。記録）: seed ごとの生成・一意性と、族の3人の読み手（W・M・S）の結果、案のレベル。"""
    def ser(d):
        return {k: (str(v) if v == INF else v) for k, v in d.items()}

    out = {
        "version": 3,
        "generator": "digit-set-first v1",
        "seedBase": SEED_BASE,
        "seedRule": "seed = seedBase + cond * 100000 + i",
        "plan": ADOPTED_V3,
        "plans": {k: {f"{a}/{b}": L for (a, b), L in v.items()} for k, v in PLANS3.items()},
        "note": "FamReader の段 R（0: 場合分けなし／1: 二択／2: 三択まで／deep）。Mw は M の場合分けの波（分類に使わない）",
        "letters": LETTERS3,
        "readers": {"W": ser(FAMILY_W), "WP": ser(FAMILY_WP), "M": ser(FAMILY_M), "SM": ser(FAMILY_SM), "S": ser(FAMILY_S)},
        "readClass": "E if W solves without case analysis; None if M needs more than ternary splits; None if WP solves without case analysis (margin); "
        "H1 if SM solves without case analysis; mH if only S does (margin); H2 if S needs case analysis",
        "conditions": ["+".join(map(str, c)) for c in CONDITIONS],
        "cases": [],
    }
    for c in range(len(CONDITIONS) - 1):
        for i in range(args.per):
            row = make_candidate((c, i))
            if "lens" not in row:
                out["cases"].append({"cond": c, "i": i, "seed": row["seed"], "status": row["status"]})
                continue
            p = puzzle_of(row)
            r2 = dict(row)
            r2["fam"] = _fam_of(p)
            out["cases"].append(
                {
                    "cond": c,
                    "i": i,
                    "seed": row["seed"],
                    "addends": row["addends"],
                    "result": row["result"],
                    "solution": row["solution"],
                    "letters": row["letters"],
                    "nonunique": row["nonunique"],
                    "gen_tries": row["gen_tries"],
                    "fam": r2["fam"],
                    "scaleCell": scale_cell(r2),
                    "readClass": read_class(r2),
                    "level": level_v3(r2),
                }
            )
    fixed = []
    for adds, res in ((["SEND", "MORE"], "MONEY"), (["EG", "GG"], "EAC"), (["WFX", "TFM"], "CMMW"), (["DUU", "HXU"], "HMHD"),
                      (["GVANK", "FFFGB", "VWNN"], "BGAVKB"), (["YTVRF", "GNFGT", "GNFFY"], "RGFGNY")):
        p = Puzzle(adds, res)
        r2 = {"k": p.k, "n": p.n, "lens": [len(w) for w in adds], "fam": _fam_of(p)}
        fixed.append({"addends": adds, "result": res, "solutions": count_solutions(p, 3), "fam": r2["fam"],
                      "scaleCell": scale_cell(r2), "readClass": read_class(r2), "level": level_v3(r2)})
    out["fixed"] = fixed
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(out['cases'])} cases", file=sys.stderr)


def _f4_full(p: Puzzle) -> dict:
    """期待値に載せる版4 の値（端の読み手と、案R・案T が使う読み手）。"""
    return fam4_of(p, ("P_cloInf", "P_clo5", "P_clo3", "C_T"))


def cmd_expected4(args):
    """移植の期待値（版4。記録）: seed ごとの生成・一意性と、族の端の読み手の結果、読みの組・段・案ごとのレベル。"""
    def ser(d):
        return {k: (str(v) if v == INF else v) for k, v in d.items()}

    out = {
        "version": 4,
        "generator": "digit-set-first v1",
        "seedBase": SEED_BASE,
        "seedRule": "seed = seedBase + cond * 100000 + i",
        "plan": ADOPTED_V4,
        "plans": {k: {"probeReader": v[0], "strongReader": v[1]} for k, v in PLANS4.items()},
        "cells": {f"{a}/{b}": L for (a, b), L in CELLS4.items()},
        "letters": LETTERS4,
        "readers": {k: ser(v) for k, v in READERS4.items()} | {k: ser(FAM4_VARIANTS[k][1]) for k in ("P_cloInf", "P_clo5", "P_clo3", "C_T")},
        "note": "Llo/Lhi/Clo/LT4lo/LT8hi: 0 = solves without case analysis, 1 = stuck. Chi/Plo/P_cloInf/C_T: case-analysis tier R "
        "(0 none / 1 binary / 2 up to ternary / deep) and waves",
        "readClass": "E if Llo solves; mE if only Lhi does; H1 if Lhi is stuck and Clo solves; mH if Clo is stuck and the strong reader solves; "
        "H2 if the strong reader needs case analysis (1 or 2); deep otherwise",
        "conditions": ["+".join(map(str, c)) for c in CONDITIONS],
        "cases": [],
    }

    def entry(r2):
        f = r2["f4"]
        return {
            "f4": f,
            "scaleCell": scale_cell(r2),
            "readClass": {pl: read_class4(f4_view(f, *PLANS4[pl])) for pl in PLANS4},
            "cell": {pl: cell4(r2, pl) for pl in PLANS4},
            "level": {pl: level4(r2, pl) for pl in PLANS4},
        }

    for c in range(len(CONDITIONS) - 1):
        for i in range(args.per):
            row = make_candidate((c, i))
            if "lens" not in row:
                out["cases"].append({"cond": c, "i": i, "seed": row["seed"], "status": row["status"]})
                continue
            p = puzzle_of(row)
            r2 = dict(row)
            r2["f4"] = _f4_full(p)
            e = {k: row[k] for k in ("seed", "addends", "result", "solution", "letters", "nonunique", "gen_tries")}
            e = {"cond": c, "i": i} | e | entry(r2)
            out["cases"].append(e)
    fixed = []
    # 認識合わせの見本、版3 の代表、F1 で手で解いた問題、版4 の案の例
    fixed_src = ["SEND+MORE=MONEY", "EG+GG=EAC", "WFX+TFM=CMMW", "DUU+HXU=HMHD", "GGGN+LYMM+NKY=KNFGN", "BGJL+BBLG+JGJ=JAJL",
                 "CWE+CEE+WFC=EPW", "YTHF+FTFX+CTR=CRRYF", "HXAAX+DHWBW+AXADB=GGGWWW", "PTEAY+PCDTE+DNDG=ECYEAJ",
                 "GVANK+FFFGB+VWNN=BGAVKB", "WJWTT+JJCJF+JCDN=DFJNCD", "PNAAG+RFVAA+GRGV=GVLNLR", "RJJVD+RDVHH+LHRV=HLTLTT",
                 "XXUUC+DXWGX+FXUE=FUEGWD", "GPMEM+GMPXG+XKXK=ECKMPP", "AHGJL+HXJJJ+LRNL=RXAXGR"]
    for src in fixed_src:
        left, res = src.split("=")
        adds = left.split("+")
        p = Puzzle(adds, res)
        r2 = {"k": p.k, "n": p.n, "lens": [len(w) for w in adds], "f4": _f4_full(p)}
        fixed.append({"addends": adds, "result": res, "solutions": count_solutions(p, 3)} | entry(r2))
    out["fixed"] = fixed
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(out['cases'])} cases", file=sys.stderr)


def cmd_selfcheck(args):
    # 既知の問題: SEND + MORE = MONEY（一意解 9567 + 1085 = 10652）
    p = Puzzle(["SEND", "MORE"], "MONEY")
    assert count_solutions(p, 3) == 1
    f = Reader(p).solve()
    assert f["status"] == "ok", f
    g = Reader(p, {"max_width": 3}).solve()
    print("SEND+MORE=MONEY 広い", {k: f[k] for k in ("rounds", "splits", "split_len_max")}, "狭い", {k: g.get(k) for k in ("status", "rounds", "splits", "split_len_max")})
    # 認識合わせの見本
    for a, r in ((["EG", "GG"], "EAC"), (["WFX", "TFM"], "CMMW")):
        p = Puzzle(a, r)
        c = count_solutions(p, 3)
        f = Reader(p).solve()
        g = Reader(p, {"max_width": 3}).solve()
        print(p.text(), "解の数", c, "広い", {k: f.get(k) for k in ("status", "rounds", "splits", "split_len_max")}, "狭い", {k: g.get(k) for k in ("status", "rounds", "splits", "split_len_max")})
    # 読むモデルが解いた値が完全な探索の解と一致すること
    rng = random.Random(1)
    bad = 0
    for _ in range(60):
        lens = rng.choice(CONDITIONS[:8])
        g = generate(rng, lens, n_range_for(lens))
        if not g:
            continue
        p, sol, _ = g
        if count_solutions(p, 2) != 1:
            continue
        rd = Reader(p)
        f = rd.solve()
        if f["status"] != "ok":
            continue
        # 読みの結果を作り直して照合
        dom = p.initial_domains()
        st, _, dom, _ = rd.propagate(dom)
        assert st != CONTRA
        for ch, d in sol.items():
            assert dom[p.idx[ch]] >> d & 1, "読みが解の値を消した"
    # 版2: 閉包は読む順・1つずつ使うかに依らない
    rng = random.Random(2)
    checked = 0
    for _ in range(3000):
        if checked >= 20:
            break
        lens = rng.choice(CONDITIONS[:11])
        g = generate(rng, lens, n_range_for(lens))
        p, sol, _ = g
        if count_solutions(p, 2) != 1:
            continue
        a = tiers_of(p, ["cap12", "cap12_rl", "cap12_one", "cap12_rand"])
        assert len({str(v[0]) for v in a.values()}) == 1, (p.text(), a)
        dom = p.initial_domains()
        st, d = Closure(p, 12, True).close(dom)
        for ch, dg in sol.items():
            assert d[p.idx[ch]] >> dg & 1, "閉包が解の値を消した"
        checked += 1
    print("版2 閉包の順序の確かめ", checked, "問")
    # 版3: 族の読み手の強さの順（W ≧ M ≧ S の段）と、閉包が解を消さないこと
    rng = random.Random(3)
    checked = 0
    rank = {0: 0, 1: 1, 2: 2, "deep": 3}
    for _ in range(3000):
        if checked >= 20:
            break
        lens = rng.choice(CONDITIONS[:12])
        p, sol, _ = generate(rng, lens, n_range_for(lens))
        if count_solutions(p, 2) != 1:
            continue
        rw = FamReader(p, **FAMILY_W).tier()["R"]
        rm = FamReader(p, **FAMILY_M).tier()["R"]
        rwp = FamReader(p, **FAMILY_WP).tier()["R"]
        rsm = FamReader(p, **FAMILY_SM).tier()["R"]
        rs = FamReader(p, **FAMILY_S).tier()["R"]
        assert rank[rw] >= rank[rm] >= rank[rwp] >= rank[rs], (p.text(), rw, rm, rwp, rs)
        assert rank[rm] >= rank[rsm] >= rank[rs], (p.text(), rm, rsm, rs)
        st, d = FamReader(p, **FAMILY_S).close(p.initial_domains())
        for ch, dg in sol.items():
            assert d[p.idx[ch]] >> dg & 1, "族の閉包が解の値を消した"
        checked += 1
    print("版3 族の強さの順の確かめ", checked, "問")
    # 版4: 端の読み手の強さの順（Llo ≦ Lhi、Llo ≦ Clo ≦ C_T ≦ Chi、場合分けは Plo ≧ P_cloInf ≧ Chi）と、
    # 族の中の読み手（版3 の W⁺・S⁻・S）が端のあいだにあること、閉包が解の値を消さないこと
    rng = random.Random(4)
    checked = 0
    rank = {0: 0, 1: 1, 2: 2, "deep": 3}
    for _ in range(3000):
        if checked >= 20:
            break
        lens = rng.choice(CONDITIONS[:12])
        p, sol, _ = generate(rng, lens, n_range_for(lens))
        if count_solutions(p, 2) != 1:
            continue
        cl = {nm: _close_solved(p, kw) for nm, kw in (("Llo", L4_LO), ("Lhi", L4_HI), ("Clo", C4_LO), ("LT4lo", LT4_LO), ("LT8hi", LT4_HI))}
        assert cl["Llo"] >= cl["Lhi"] and cl["Llo"] >= cl["Clo"] and cl["LT4lo"] >= cl["Llo"] and cl["LT4lo"] >= cl["LT8hi"], (p.text(), cl)
        ts = {nm: Fam4Reader(p, **kw).tier() for nm, kw in (("Plo", P4_LO), ("Pc", FAM4_VARIANTS["P_cloInf"][1]), ("CT", FAM4_VARIANTS["C_T"][1]), ("Chi", C4_HI))}
        mid = {nm: FamReader(p, **kw).tier() for nm, kw in (("WP", FAMILY_WP), ("SM", FAMILY_SM), ("S", FAMILY_S))}
        assert rank[ts["Plo"]["R"]] >= rank[ts["Pc"]["R"]] >= rank[ts["CT"]["R"]] >= rank[ts["Chi"]["R"]], (p.text(), ts)
        for nm in ("WP", "SM", "S"):
            assert rank[mid[nm]["R"]] >= rank[ts["Chi"]["R"]], (p.text(), nm, mid, ts)
            assert not (cl["Clo"] == 0 and mid[nm]["R"] != 0), (p.text(), nm, mid, cl)
        if ts["Plo"]["R"] == 1 and ts["Chi"]["R"] == 1:
            assert ts["Chi"]["waves"] <= ts["Pc"]["waves"] <= ts["Plo"]["waves"], (p.text(), ts)
        for kw in (L4_LO, L4_HI, C4_LO, C4_HI, LT4_LO):
            st, d = Fam4Reader(p, **kw).close(p.initial_domains())
            for ch, dg in sol.items():
                assert d[p.idx[ch]] >> dg & 1, "版4 の閉包が解の値を消した"
        checked += 1
    print("版4 端の読み手の強さの順の確かめ", checked, "問")
    # 版5: 端の読み手の強さの順と、1つずつ数えた二択の回数の順、閉包が解の値を消さないこと
    rng = random.Random(5)
    checked = 0
    sq = lambda x: {0: 0, 1: 1, 2: 2, None: 3, "contra": 9}[x]
    for _ in range(3000):
        if checked >= 20:
            break
        lens = rng.choice(CONDITIONS[:12])
        p, sol, _ = generate(rng, lens, n_range_for(lens))
        if count_solutions(p, 2) != 1:
            continue
        cl = {nm: _close_solved(p, kw) for nm, kw in (("Llo", L5_LO), ("Lhi", L5_HI), ("Clo", C5_LO), ("Chi", C5_HI))}
        nb = {nm: (lambda st_dom: 0 if st_dom[0] != CONTRA and _solved(p, st_dom[1]) else 1)(NoBounds5Reader(p, **kw).close(p.initial_domains()))
              for nm, kw in (("NBlo", NB5_LO), ("NBhi", NB5_HI))}
        assert cl["Llo"] >= cl["Lhi"] and cl["Llo"] >= cl["Clo"] >= cl["Chi"], (p.text(), cl)
        assert nb["NBlo"] >= cl["Llo"] and nb["NBlo"] >= nb["NBhi"] >= cl["Lhi"], (p.text(), nb, cl)
        tiers = {"Pr2": Fam4Reader(p, **P5_R2).tier()["R"], "Chi": Fam4Reader(p, **C5_HI).tier()["R"]}
        for k in STEP5_K:
            tiers[f"Ps{k}"] = StepProbe5Reader(p, step_k=k, **P5_STEP).tier()["R"]
        assert rank[tiers["Ps3"]] >= rank[tiers["Ps4"]] >= rank[tiers["Ps5"]] >= rank[tiers["Chi"]], (p.text(), tiers)
        assert rank[tiers["Pr2"]] >= rank[tiers["Chi"]], (p.text(), tiers)
        sc = seq5(Fam4Reader(p, **C5_HI))
        for k in STEP5_K:
            assert sq(seq5(StepProbe5Reader(p, step_k=k, **P5_STEP))) >= sq(sc), (p.text(), k)
        assert sq(seq5(Fam4Reader(p, **P5_R2))) >= sq(sc), p.text()
        for kw in (L5_LO, L5_HI, C5_LO, C5_HI):
            st, d = Fam4Reader(p, **kw).close(p.initial_domains())
            for ch, dg in sol.items():
                assert d[p.idx[ch]] >> dg & 1, "版5 の閉包が解の値を消した"
        checked += 1
    print("版5 端の読み手の強さの順の確かめ", checked, "問")
    # 版6: 端の読み手の強さの順（探す手間の上限は小さいほど弱い、消える文字を除く NB、式の持ち回りは強める）、
    # 1回の場合分けで解けることの順（枝の手が長いほど・枝が閉包なら解けやすい）、閉包が解の値を消さないこと、
    # classify6（安い順に当てて止める）と fam6_of（全部測る）のレベルが同じこと
    rng = random.Random(6)
    checked = split_checked = 0
    fixed_l45 = [("DBRPR+UTTDR+UDDP=DDUURJ", "DBRPUTJ", "1863925"), ("MKCXE+MFCXE+KXXF=YCXMCM", "MKCXEFY", "8265901"),
                 ("AVUCV+AVPPP+AAUG=TVPCVV", "AVUCPGT", "7506821"), ("KBBKC+EAWKB+WWKT=AACEBC", "KBCEAWT", "7294158")]
    for t in range(3000 + len(fixed_l45)):
        if checked >= 24 + len(fixed_l45):
            break
        if t < len(fixed_l45):  # 場合分けの回数の順を確かめるため、L4・L5 の例を先に入れる
            left, res = fixed_l45[t][0].split("=")
            p = Puzzle(left.split("+"), res)
            sol = {ch: int(d) for ch, d in zip(fixed_l45[t][1], fixed_l45[t][2])}
        else:
            lens = rng.choice(CONDITIONS[7:12] if checked % 2 else CONDITIONS[:12])
            p, sol, _ = generate(rng, lens, n_range_for(lens))
        if count_solutions(p, 2) != 1:
            continue
        f = fam6_of(p)
        assert f["Llo"] >= f["Lhi"] and f["Llo"] >= f["Clo24"] >= f["Clo50"] >= f["Clo"], (p.text(), f)
        assert f.get("Chi", 0) >= f.get("ChiA", 0), (p.text(), f)
        if "NB6lo" in f:
            assert f["NB6lo"] >= f["Llo"] and f["NB6lo"] >= f["NB6hi"] >= f["Lhi"], (p.text(), f)
        if f.get("sPN_18") == 1:
            assert f.get("sPN_22") == 1 and f.get("sPcN") == 1, (p.text(), f)
            split_checked += 1
        if f.get("sPN_14") == 1:
            assert f.get("sPN_18") == 1, (p.text(), f)
        rows = {"k": p.k, "n": p.n, "lens": [len(w) for w in p.addends], "f6": f}
        assert classify6(p)["level"] == level6(rows, ADOPTED_V6), (p.text(), f, classify6(p))
        readers = [Fam6Reader(p, pair_prod_cap=24, **C6_LO), NoBounds6Reader(p, **NB6_LO), NoBounds6Reader(p, **NB6_HI), Alg6Reader(p, **C6_HI),
                   FactStep6Reader(p, step_k=18, whole=True, **dict(C6_LO, r2_wl=2))]
        for rd in readers:
            st, d = rd.close(p.initial_domains())
            for ch, dg in sol.items():
                assert d[p.idx[ch]] >> dg & 1, ("版6 の閉包が解の値を消した", type(rd).__name__)
        checked += 1
    print("版6 端の読み手の強さの順の確かめ", checked, "問（うち場合分け1回", split_checked, "問）")
    print("selfcheck ok")


# ---------------------------------------------------------------- 版4（採る）: 解釈の和の族の端で組を決める


def _lin_of(p: Puzzle, j: int) -> dict:
    """列 j の式を「係数 × 変数 の和 = 0」で表す（両辺に同じ係数で出る文字は係数 0 で消える）。"""
    coef: dict[int, int] = defaultdict(int)
    for v, m in p.cols[j][0]:
        coef[v] += m
    coef[p.cols[j][1]] -= 1
    coef[p.n + j] += 1
    coef[p.n + j + 1] -= 10
    return {v: a for v, a in coef.items() if a != 0}


class ClosureNoAD(Closure):
    """1列を読むとき、列の中の違う数字を使わない（違う数字は表でだけ使う）。族の外の解釈を測るためだけに使う。"""

    def col_tuples(self, j, dom):
        p = self.p
        terms, res = p.cols[j]
        n = p.n
        ci, co = n + j, n + j + 1
        letters = [v for v, _ in terms]
        mults = [m for _, m in terms]
        res_pos = letters.index(res) if res in letters else -1
        lets = letters + ([] if res_pos >= 0 else [res])
        lists = [DIGITS[dom[v]] for v in letters]
        out = []
        for c in DIGITS[dom[ci]]:
            for combo in product(*lists):
                sm = c + sum(x * m for x, m in zip(combo, mults))
                r, o = sm % 10, sm // 10
                if not (dom[co] >> o & 1):
                    continue
                if res_pos >= 0:
                    if combo[res_pos] != r:
                        continue
                    vals = combo
                else:
                    if not (dom[res] >> r & 1):
                        continue
                    vals = combo + (r,)
                mask = 0
                for x in vals:
                    mask |= 1 << x
                out.append((vals, c, o, mask))
        return lets, out


class Fam4Reader(FamReader):
    """版4 の読み手。FamReader に、族の軸を足す。どの軸も強める向きに単調（候補が少ないほど多く消せる）。

    col_mode / col_tcap: 1列の読み方。"gac" は組を全部書き出す。"bt" は、決まっていない文字が3つ以上で組が col_tcap より多い列を、
        和の大きさ（最小と最大）だけで読む（col_tcap が None なら、決まっていない文字が3つ以上の列はいつも和の大きさだけ）
    cancel: 2列・3列をまとめる上限を、両辺に同じ係数で出て消える文字を除いた組の数で数える（人が消える文字を消して読む形）
    fl_c2: 先読みで値を置く繰り上がりを、候補2つのものに限る
    noad: 1列の中の違う数字を使わない（族の外。測るためだけ）
    """

    def __init__(self, p, col_mode="gac", col_tcap=None, cancel=False, fl_c2=False, noad=False, **kw):
        super().__init__(p, **kw)
        self.col_mode, self.col_tcap, self.cancel, self.fl_c2 = col_mode, col_tcap, cancel, fl_c2
        if noad:
            self._c = ClosureNoAD(p)
        self.lin = [_lin_of(p, j) for j in range(p.R)]
        self.colvars = [set(v for v, _ in p.cols[j][0]) | {p.cols[j][1]} for j in range(p.R)]
        self._canc_cache: dict = {}

    # ---- 1列（和の大きさだけで読む形）
    def _bounds(self, j, dom):
        p = self.p
        lin = self.lin[j]
        d = {v: dom[v] for v in set(lin) | self.colvars[j] | {p.n + j, p.n + j + 1}}
        for v in d:
            if d[v] == 0:
                return None
        while True:
            ch = False
            lo, hi = {}, {}
            for v, a in lin.items():
                ds = DIGITS[d[v]]
                x0, x1 = a * ds[0], a * ds[-1]
                lo[v], hi[v] = min(x0, x1), max(x0, x1)
            slo, shi = sum(lo.values()), sum(hi.values())
            if slo > 0 or shi < 0:
                return None
            for v, a in lin.items():
                olo, ohi = slo - lo[v], shi - hi[v]
                keep = 0
                for x in DIGITS[d[v]]:
                    if olo <= -a * x <= ohi:
                        keep |= 1 << x
                if keep == 0:
                    return None
                if keep != d[v]:
                    d[v] = keep
                    ch = True
            if not ch:
                break
        return d

    def col_sup(self, j, dom, tl=None):
        if self.col_mode == "bt":
            unf = sum(1 for v in self.colvars[j] if POP[dom[v]] > 1)
            if unf > 2:
                if self.col_tcap is None:
                    return self._bounds(j, dom)
                t = tl if tl is not None else self._c.col_tuples(j, dom)
                if len(t[1]) > self.col_tcap:
                    return self._bounds(j, dom)
                return super().col_sup(j, dom, t)
        return super().col_sup(j, dom, tl)

    # ---- 2列・3列（消える文字を除いて数える形）
    def _canc(self, cols):
        key = tuple(cols)
        if key not in self._canc_cache:
            occ = set()
            for j in cols:
                occ |= self.colvars[j]
            self._canc_cache[key] = {v for v in occ if all(v not in self.lin[j] for j in cols if v in self.colvars[j])}
        return self._canc_cache[key]

    def join(self, cols, dom, cap, linked, mode, tls=None):
        if not self.cancel:
            return super().join(cols, dom, cap, linked, mode, tls)
        p = self.p
        n = p.n
        tl = [tls[j] if tls and j in tls else self._c.col_tuples(j, dom) for j in cols]
        for _, t in tl:
            if not t:
                return None
        canc = self._canc(cols)
        jcap = cap
        if mode in ("product", "or"):
            prod = 1
            for lets, t in tl:
                keep = [i for i, v in enumerate(lets) if v not in canc]
                prod *= len({(tuple(vals[i] for i in keep), c, o) for vals, c, o, _ in t})
            if mode == "product" and prod > cap:
                return {}
            if mode == "or":
                if prod <= cap:
                    mode = "all"
                else:
                    mode = "joined"
                    jcap = self.pair_join_cap
        lets0, t0 = tl[0]
        parts = [({v: x for v, x in zip(lets0, vals)}, m, c, (o,)) for vals, c, o, m in t0]
        for k in range(1, len(cols)):
            lets, t = tl[k]
            new = []
            seen = set()
            for asg, m, c0, outs in parts:
                for vals, c, o, mm in t:
                    if linked and c != outs[-1]:
                        continue
                    ok = True
                    for v, x in zip(lets, vals):
                        y = asg.get(v)
                        if y is not None and y != x:
                            ok = False
                            break
                    if not ok:
                        continue
                    a2 = dict(asg)
                    for v, x in zip(lets, vals):
                        a2[v] = x
                    m2 = m | mm
                    if POP[m2] != len(a2):
                        continue
                    new.append((a2, m2, c0, outs + (o,)))
                    if mode == "joined":
                        seen.add((tuple(sorted((v, x) for v, x in a2.items() if v not in canc)), c0, outs + (o,)))
                        if len(seen) > jcap:
                            return {}
            parts = new
            if not parts:
                return None
        sup = defaultdict(int)
        for asg, m, c0, outs in parts:
            for v, x in asg.items():
                sup[v] |= 1 << x
            if linked:
                sup[n + cols[0]] |= 1 << c0
                for k, o in enumerate(outs):
                    sup[n + cols[k] + 1] |= 1 << o
        return dict(sup)


# 版4 の族。軸ごとに、2回の A4・F1 で自然さが中以上とされた幅をとり、組の言い方は族の端の読み手で決める（端で言えれば、
# 軸の単調さから族の全員で言える。導出）。
#   1列の読み: 組12まで書き出し多い列は和の大きさだけ（いちばん弱い）〜 全部の組を書き出す（いちばん強い）
#   2列をまとめる: つないだ組12・消える文字も数える（弱い）〜 積200かつないだ組50・消える文字を除いて数える（強い）
#   先読み: 1手・候補2つの文字と候補2つの繰り上がりだけ（弱い）〜 3手・候補3つの文字・全部の値の共通部分（強い）
#   3列（組50）・共通の文字を持つ隣でない2列（組50）: なし（弱い）〜 あり（強い）
#   表: 決まった数字を消すだけ（弱い）〜 10文字の隠れた1つと組の消去（強い）
#   場合分け: 枝を3段で打ち切り・三択は繰り上がりだけ（弱い）〜 枝は読みの閉包・三択は候補3つの文字も・全部の枝の共通部分（強い）
# 読みの種類（組の言い方の単位）
#   1列ずつの読み（L）: 1列の読みと表だけ。2列も先読みも使わない
#   まとめる読み（C）: 1列ずつの読みに、2列をまとめる読みと先読みを足したもの（3列・隣でない2列は強い端だけ）
L4_LO = dict(col_mode="bt", col_tcap=12, hidden=False, subsets=False)
L4_HI = dict(col_mode="gac", hidden=True, subsets=True)
C4_LO = dict(col_mode="bt", col_tcap=12, pair_cap=12, pair_mode="joined", cancel=False, fl_depth=1, fl_wl=2, fl_c2=True, hidden=False, subsets=False)
C4_HI = dict(col_mode="gac", pair_cap=200, pair_mode="or", pair_join_cap=50, cancel=True, nonadj_cap=50, win3_cap=50,
             fl_depth=3, fl_wl=3, fl_both=True, hidden=True, subsets=True, both=True, r2_wl=3)
# 場合分けの読み手のいちばん弱い端（提供範囲）: 1列ずつの読みの弱い端で、枝を3段で打ち切り、三択は繰り上がりだけ
P4_LO = dict(L4_LO, probe=3, r2_wl=2)
# 1列の重さ（L1 と L2 を分ける）: 組 t まで書き出し、多い列は和の大きさだけで読む1列ずつの読み
LT4_LO = dict(L4_LO, col_tcap=4)
LT4_HI = dict(L4_HI, col_mode="bt", col_tcap=8)

READERS4 = {"Llo": L4_LO, "Lhi": L4_HI, "Clo": C4_LO, "Chi": C4_HI, "Plo": P4_LO, "LT4lo": LT4_LO, "LT8hi": LT4_HI}


def _close_solved(p, kw) -> int:
    st, dom = Fam4Reader(p, **kw).close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1


def fam4_of(p: Puzzle, extra=(), timing=False, base=True) -> dict:
    """版4 の族の端の読み手の結果。0 は場合分けなしで解ける、1 は解けない。Chi と Plo は場合分けの段 R と波も。
    base=False なら extra の読み手だけ（あとから足す測り）。"""
    out: dict = {}
    tt: dict = {}

    def run(name, fn):
        t0 = time.perf_counter()
        out[name] = fn()
        tt[name] = round(time.perf_counter() - t0, 3)

    if base:
        for nm in ("Llo", "Lhi", "Clo", "LT4lo", "LT8hi"):
            run(nm, lambda nm=nm: _close_solved(p, READERS4[nm]))
        run("Chi_t", lambda: Fam4Reader(p, **C4_HI).tier())
        out["Chi"] = out["Chi_t"]["R"]
        out["ChiW"] = out["Chi_t"].get("waves")
        del out["Chi_t"]
        run("Plo_t", lambda: Fam4Reader(p, **P4_LO).tier())
        out["Plo"] = out["Plo_t"]["R"]
        out["PloW"] = out["Plo_t"].get("waves")
        del out["Plo_t"]
    for nm in extra:
        kind, kw = FAM4_VARIANTS[nm]
        if kind == "close":
            run(nm, lambda kw=kw: _close_solved(p, kw))
        else:
            def f(kw=kw):
                t = Fam4Reader(p, **kw).tier()
                return [t["R"], t.get("waves")]
            run(nm, f)
    if timing:
        out["_t"] = tt
    return out


# 読みの組（版4）
#   E   : 1列ずつの読みの弱い端（Llo）で場合分けなしに解ける
#   mE  : Llo では止まり、1列ずつの読みの強い端（Lhi）なら解ける（余白。外す）
#   H1  : Lhi では止まり、まとめる読みの弱い端（Clo）なら解ける
#   mH  : Clo では止まり、まとめる読みの強い端（Chi）なら解ける（余白。外す）
#   H2  : Chi でも場合分けが要る
# 1列の重さ（E の中）: E1 は組4まで書き出す弱い読み（LT4lo）でも解ける／E2 は組8まで書き出す強い読み（LT8hi）では解けない／間は余白
# 場合分けの重さ（H2 の中。Chi が下の端、Plo が上の端）:
#   B1: Plo が二択の波1つで解ける（Chi も場合分けが要るので、族の全員がちょうど二択の波1つ）
#   B2: Chi でも二択の波1つでは解けない（波2つ以上か三択）。Plo は三択までで解ける
#   間（Chi は波1つで解け、Plo は波2つ以上か三択）は余白
def read_class4(f) -> str | None:
    if f["Llo"] == 0:
        return "E"
    if f["Lhi"] == 0:
        return "mE"
    if f["Clo"] == 0:
        return "H1"
    if f["Chi"] == 0:
        return "mH"
    if f["Chi"] in (1, 2):
        return "H2"
    return "deep"


def provided4(f) -> bool:
    """提供範囲: 場合分けの読み手のいちばん弱い端（Plo）が、三択までの場合分けで解ける。"""
    return f["Plo"] in (0, 1, 2)


def col_weight4(f) -> str | None:
    if f["LT4lo"] == 0:
        return "E1"
    if f["LT8hi"] == 1:
        return "E2"
    return None


def split_weight4(f) -> str | None:
    if f["Plo"] == 1 and f["PloW"] == 1:
        return "B1"
    if f["Chi"] == 2 or (f["Chi"] == 1 and (f["ChiW"] or 0) >= 2):
        return "B2"
    return None


# 族の端を、軸ごとに動かした読み手（"close" は場合分けなしで解けるか、"tier" は段 R と波）。
# 族の外（自然さが低いか、族に入れると言い方が崩れるかを測るためのもの）と、診断（どの軸が効くか）を含む。
FAM4_VARIANTS: dict = {
    # 場合分けの読み手の下の端の選び方（提供範囲）
    "P_clo3": ("tier", dict(C4_LO, probe=3, r2_wl=2)),
    "P_clo5": ("tier", dict(C4_LO, probe=5, r2_wl=2)),
    "P_cloInf": ("tier", dict(C4_LO, probe=None, r2_wl=2)),
    "P_llo5": ("tier", dict(L4_LO, probe=5, r2_wl=2)),
    "P_lloInf": ("tier", dict(L4_LO, probe=None, r2_wl=2)),
    "P_lhi3": ("tier", dict(L4_HI, probe=3, r2_wl=2)),
    "P_m3": ("tier", dict(FAMILY_M, probe=3, r2_wl=2)),
    "P_mInf": ("tier", dict(FAMILY_M, r2_wl=2)),
    # まとめる読みの強い端の、どの軸が H2 を消すか（診断）
    "C_nofb": ("tier", dict(C4_HI, fl_both=False, both=False)),
    "C_fl2": ("tier", dict(C4_HI, fl_depth=2)),
    "C_fl2nofb": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, both=False)),
    "C_now3": ("tier", dict(C4_HI, win3_cap=None)),
    "C_v3S": ("tier", dict(C4_HI, fl_depth=2, win3_cap=None, cancel=False)),
    "C_core": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, both=False, win3_cap=None, nonadj_cap=None)),
    "C_coreB": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, win3_cap=None, nonadj_cap=None)),
    # 3手の先読み・全部の値の共通部分・3列を場合分けに数えたときの、まとめる読みの強い端（案T）
    "C_T": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, win3_cap=None)),
    # 族の外の解釈（同じ読み方を、その読みを持つ端の読み手の全員に一緒に当てる。JOINT4 で組む）
    "X_noad_Llo": ("close", dict(L4_LO, noad=True)),
    "X_noad_LT4lo": ("close", dict(LT4_LO, noad=True)),
    "X_noad_Plo": ("tier", dict(P4_LO, noad=True)),
    "X_noad_Pclo": ("tier", dict(C4_LO, probe=None, r2_wl=2, noad=True)),
    "X_noad_Clo": ("close", dict(C4_LO, noad=True)),
    "X_bnd_Llo": ("close", dict(L4_LO, col_tcap=None)),
    "X_bnd_LT4lo": ("close", dict(LT4_LO, col_tcap=None)),
    "X_bnd_Clo": ("close", dict(C4_LO, col_tcap=None)),
    "X_bnd_Plo": ("tier", dict(P4_LO, col_tcap=None)),
    "X_bnd_Pclo": ("tier", dict(C4_LO, probe=None, r2_wl=2, col_tcap=None)),
    "X_fl1_Lhi": ("close", dict(L4_HI, fl_depth=1, fl_wl=3)),
    "X_fl2_Lhi": ("close", dict(L4_HI, fl_depth=2, fl_wl=3)),
    "X_pair_Lhi": ("close", dict(L4_HI, pair_cap=12, pair_mode="joined", cancel=True)),
    "X_j8_Clo": ("close", dict(C4_LO, pair_cap=8)),
    "X_fl0_Pclo": ("tier", dict(C4_LO, fl_depth=0, probe=None, r2_wl=2)),
    "X_p2_Plo": ("tier", dict(P4_LO, probe=2)),
    "X_p3_Pclo": ("tier", dict(C4_LO, probe=3, r2_wl=2)),
    "X_noad_Pclo3": ("tier", dict(C4_LO, probe=3, r2_wl=2, noad=True)),
    "X_bnd_Pclo3": ("tier", dict(C4_LO, probe=3, r2_wl=2, col_tcap=None)),
    "X_fl0_Pclo3": ("tier", dict(C4_LO, fl_depth=0, probe=3, r2_wl=2)),
    "X_p2_Pclo": ("tier", dict(C4_LO, probe=2, r2_wl=2)),
    "X_plo": ("tier", P4_LO),
    "X_chi": ("tier", C4_HI),
    "X_pairhi": ("close", dict(L4_HI, pair_cap=200, pair_mode="or", pair_join_cap=50, cancel=True, nonadj_cap=50)),
    "X_w3_50_CT": ("tier", dict(C4_HI, fl_depth=2, fl_both=False)),
    "X_t2_LT4lo": ("close", dict(LT4_LO, col_tcap=2)),
    "X_t16_LT8hi": ("close", dict(LT4_HI, col_tcap=16)),
    "X_fl4_CT": ("tier", dict(C4_HI, fl_depth=4, fl_both=False, win3_cap=None)),
    "X_w3_CT": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, win3_cap=12)),
    "X_fb_CT": ("tier", dict(C4_HI, fl_depth=2, win3_cap=None)),
    "X_fl3_CT": ("tier", dict(C4_HI, fl_both=False, win3_cap=None)),
    "X_na0_CT": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, win3_cap=None, nonadj_cap=None)),
    "X_noboth_CT": ("tier", dict(C4_HI, fl_depth=2, fl_both=False, win3_cap=None, both=False)),
    # まとめる読みの弱い端の、どの軸が H1 を決めるか（診断）
    "Clo_fl0": ("close", dict(C4_LO, fl_depth=0)),
    "Clo_p0": ("close", dict(C4_LO, pair_cap=None)),
    "Clo_cancel": ("close", dict(C4_LO, cancel=True)),
    "Clo_gac": ("close", dict(C4_LO, col_mode="gac", hidden=True, subsets=True)),
}


# ---------------------------------------------------------------- 版4 の案


def _r(x):
    """FAM4_VARIANTS の tier の値 [R, 波] と、端の読み手の値をそろえる。"""
    return (x[0], x[1]) if isinstance(x, list) else (x, None)


def f4_view(f, p_key="Plo", c_key="Chi"):
    """案ごとに、場合分けの読み手の下の端（p_key）と、まとめる読みの強い端（c_key）を差し替えた値。"""
    g = dict(f)
    if p_key != "Plo":
        g["Plo"], g["PloW"] = _r(f[p_key])
    if c_key != "Chi" and c_key in f:
        # 強い端を測っていない行（3l 以外。強い端は mH と H2 を分けるだけで、3l 以外のレベルには効かない）は Chi のまま
        g["Chi"], g["ChiW"] = _r(f[c_key])
    return g


SCALE_ORDER4 = {"2s": 0, "2l": 1, "3s": 1, "3l": 2}

# 案: (場合分けの読み手の下の端, まとめる読みの強い端, 規模と読みの組 → レベル, 文字の数の範囲)
PLANS4 = {
    # 指示どおりの族: 提供範囲は1列ずつの読みの弱い端（Llo）で枝3段・三択は繰り上がりだけ
    "Q": ("Plo", "Chi"),
    # 提供範囲を、まとめる読みの弱い端（Clo）で場合分けする読み手で決める（枝は閉包まで・三択は繰り上がりだけ）
    "R": ("P_cloInf", "Chi"),
    # R に加え、3手の先読み・全部の値の共通部分・3列を「場合分け」に数える（まとめる読みの強い端を C_core にする）
    "T": ("P_cloInf", "C_T"),
    # T の提供範囲を、枝を3段・5段で打ち切る読み手で決める
    "T3": ("P_clo3", "C_T"),
    "T5": ("P_clo5", "C_T"),
}
ADOPTED_V4 = "T3"  # 仮。指示どおりの族（案Q）では L4・L5 が作れないため。族をどこまでとるかは人間の判断を待つ（覆面算難易度.md §0）
# 規模と読みの段 → レベル。読みの段は E・H1・B1・B2 の4つしか頑健に作れなかった（E1/E2 は E2 がほぼ空。§版4 の計測）ので、
# L1→L2 だけが規模の段（2つ足し→3つ足し）になる。
CELLS4 = {("2s", "E"): 1, ("3s", "E"): 2, ("3s", "H1"): 3, ("3l", "H1"): 3, ("3l", "B1"): 4, ("3l", "B2"): 5}
LETTERS4 = {1: (5, 7), 2: (5, 10), 3: (5, 10), 4: (6, 10), 5: (7, 10)}


def cell4(r, plan, f=None):
    """読みの段（E・H1・B1・B2）。提供範囲の外と余白は None。f を渡せば、その値（端を差し替えた値）で決める。"""
    if f is None:
        f = f4_view(r["f4"], *PLANS4[plan])
    if not provided4(f):
        return None
    c = read_class4(f)
    if c == "E":
        return "E"
    if c == "H1":
        return "H1"
    if c == "H2":
        return split_weight4(f)
    return None


def level4(r, plan, letters=True, f=None):
    sc = scale_cell(r)
    c = cell4(r, plan, f)
    if sc is None or c is None:
        return None
    L = CELLS4.get((sc, c))
    if L is None:
        return None
    if letters:
        lo, hi = LETTERS4[L]
        if not (lo <= r["n"] <= hi):
            return None
    return L


NEEDED4 = ("Llo", "Lhi", "Clo", "LT4lo", "LT8hi", "Chi_t")


def t_needed4(r, plan):
    """案の分類に要る読み手だけの秒（P_cloInf・C_core は測った variants の秒）。"""
    p_key, c_key = PLANS4[plan]
    t = r["f4"]["_t"]
    s = sum(t[k] for k in ("Llo", "Lhi", "Clo", "LT4lo", "LT8hi"))
    s += t["Plo_t"] if p_key == "Plo" else t[p_key]
    s += t["Chi_t"] if c_key == "Chi" else t.get(c_key, t["Chi_t"])
    return s


def cmd_plans4(args):
    rows = load_fam4(args.fam)
    print(f"## 版4（{len(rows)} 問。4つ足しを除く一意解の候補）")
    print()
    print("### 読みの組 × 規模（提供範囲を見る前）")
    cls = Counter((scale_cell(r), read_class4(r["f4"])) for r in rows)
    cells = ["2s", "2l", "3s", "3l"]
    names = ["E", "mE", "H1", "mH", "H2", "deep"]
    print("| 規模 | " + " | ".join(names) + " |")
    print("|---|" + "---|" * len(names))
    for sc in cells:
        print(f"| {sc} | " + " | ".join(str(cls[(sc, c)]) for c in names) + " |")
    print()
    print("### E の中の1列の重さ（E1: 組4まで書き出す弱い読みで解ける／E2: 組8まで書き出す強い読みでは解けない／余白）")
    cw = Counter((scale_cell(r), col_weight4(r["f4"])) for r in rows if read_class4(r["f4"]) == "E")
    for sc in cells:
        print(f"- {sc}: E1 {cw[(sc, 'E1')]}・E2 {cw[(sc, 'E2')]}・余白 {cw[(sc, None)]}")
    print()
    print("### 提供範囲（場合分けの読み手の下の端の選び方ごとに、三択までの場合分けで解ける数／その組の数）")
    pk = ["Plo", "P_llo5", "P_lloInf", "P_lhi3", "P_clo3", "P_clo5", "P_cloInf", "P_m3", "P_mInf"]
    print("| 組・規模 | 件数 | " + " | ".join(pk) + " |")
    print("|---|---|" + "---|" * len(pk))
    for c in ("E", "H1", "mH", "H2"):
        for sc in cells:
            v = [r for r in rows if read_class4(r["f4"]) == c and scale_cell(r) == sc]
            if not v:
                continue
            print(f"| {c}・{sc} | {len(v)} | " + " | ".join(str(sum(provided4(f4_view(r['f4'], k)) for r in v)) for k in pk) + " |")
    print()
    print("### まとめる読みの強い端の軸ごとに、場合分けが要る（R が 1 か 2）数（3l の全候補）")
    v3l = [r for r in rows if scale_cell(r) == "3l"]
    for k in ("Chi", "C_nofb", "C_fl2", "C_fl2nofb", "C_now3", "C_v3S", "C_core"):
        cnt = Counter(_r(r["f4"][k] if k != "Chi" else [r["f4"]["Chi"], r["f4"]["ChiW"]])[0] for r in v3l)
        print(f"- {k}: R0 {cnt[0]}・R1 {cnt[1]}・R2 {cnt[2]}・deep {cnt['deep']}")
    print()
    print("### まとめる読みの弱い端の軸ごとに、H1 のうち場合分けなしで解ける数")
    h1 = [r for r in rows if read_class4(r["f4"]) == "H1"]
    for k in ("Clo_fl0", "Clo_p0", "Clo_cancel", "Clo_gac"):
        print(f"- {k}: {sum(r['f4'][k] == 0 for r in h1)}/{len(h1)}")
    for plan in PLANS4:
        print()
        print(f"### 案{plan}（場合分けの読み手の下の端 {PLANS4[plan][0]}・まとめる読みの強い端 {PLANS4[plan][1]}）")
        cc = Counter((scale_cell(r), cell4(r, plan)) for r in rows)
        print("規模 × 段: " + "、".join(f"{a}・{b}: {n}" for (a, b), n in sorted(cc.items(), key=lambda x: (str(x[0][0]), str(x[0][1]))) if b))
        lv = Counter(level4(r, plan) for r in rows)
        print("レベル: " + "、".join(f"L{L} {lv[L]}" for L in range(1, 6)) + f"、外 {lv[None]}")
        print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | 分類の秒 p50/p95 | 500問に要る候補（最も多い L） |")
        print("|---|---|---|---|---|---|---|---|---|")
        byc = defaultdict(list)
        for r in rows:
            byc[cond_name(r)].append(r)
        for cnd in sorted(byc, key=lambda x: (len(x.split("+")), x)):
            rs = byc[cnd]
            cnt = Counter(level4(r, plan) for r in rs)
            tt = [t_needed4(r, plan) for r in rs]
            best = max(range(1, 6), key=lambda L: cnt[L])
            need = f"L{best} {500 * len(rs) / cnt[best]:.0f}" if cnt[best] else "-"
            print(f"| {cnd} | {len(rs)} | " + " | ".join(str(cnt[L]) for L in range(1, 6)) + f" | {_fmt(pct(tt, .5))}/{_fmt(pct(tt, .95))} | {need} |")
        lvr = defaultdict(list)
        for r in rows:
            L = level4(r, plan)
            if L is not None:
                lvr[L].append(r)
        for L in range(1, 6):
            v = lvr.get(L, [])
            if v:
                print(f"- L{L}: {len(v)} 問、文字 {p3([r['n'] for r in v])}、1列の組の数（最初） {p3([r['heavy0'] for r in v])}、"
                      f"P の波 {p3([f4_view(r['f4'], PLANS4[plan][0])['PloW'] or 0 for r in v])}、素朴 置き/文字 {p3([naive_ratio(r) for r in v])}")
                for r in sorted(v, key=lambda r: r["seed"])[:2]:
                    print(f"  - 例: {_show4(r, plan)}")


# 同じ読み方を、その読みを持つ端の読み手の全員に一緒に当てる（A4 の測り方）。役 P・C は案の場合分けの読み手の下の端と、
# まとめる読みの強い端。族の中の解釈は、組の言い方が端で決まるので動かない（導出）。ここに並べるのは族の外の解釈。
# 弱める解釈は下の端（Llo・Clo・P）だけを、強める解釈は上の端（Lhi・C）だけを差し替えれば、分類済みの問題の動きは測りきれる
# （上の端を弱めても・下の端を強めても、分類済みの言い方は崩れない。導出）。
JOINT4 = [
    # (案, 名前, 自然さ, {役: 読み手})
    ("T", "1列の中の違う数字を使わない（族の全員）", "低", {"Llo": "X_noad_Llo", "Clo": "X_noad_Clo", "P": "X_noad_Pclo"}),
    ("T", "決まっていない文字が3つ以上の列はいつも和の大きさだけで読む（族の全員）", "低〜中", {"Llo": "X_bnd_Llo", "Clo": "X_bnd_Clo", "P": "X_bnd_Pclo"}),
    ("T", "場合分けの枝を3段で打ち切る", "高", {"P": "P_clo3"}),
    ("T", "場合分けの枝を5段で打ち切る", "高", {"P": "P_clo5"}),
    ("T", "場合分けの枝の中で先読みしない", "中", {"P": "X_fl0_Pclo"}),
    ("T", "提供範囲を1列ずつの読みの弱い端で決める（版4 の指示どおり）", "高", {"P": "Plo"}),
    ("T", "2列をまとめる上限をつないだ組8に下げる", "中", {"Clo": "X_j8_Clo"}),
    ("T", "1列ずつの読みにも1手の先読み（候補3つの文字まで）", "中", {"Lhi": "X_fl1_Lhi"}),
    ("T", "1列ずつの読みにも2手の先読み（候補3つの文字まで）", "中", {"Lhi": "X_fl2_Lhi"}),
    ("T", "1列ずつの読みにも2列（つないだ組12・消える文字を除く）", "中", {"Lhi": "X_pair_Lhi"}),
    ("T", "3手の先読みを読みに数える", "中", {"C": "X_fl3_CT"}),
    ("T", "4手の先読みを読みに数える", "低〜中", {"C": "X_fl4_CT"}),
    ("T", "先読みの全部の値の共通部分を読みに数える", "中", {"C": "X_fb_CT"}),
    ("T", "3列（組12）を読みに数える", "中", {"C": "X_w3_CT"}),
    ("T", "3列（組50）を読みに数える", "低〜中", {"C": "X_w3_50_CT"}),
    ("T", "版4 の指示どおりの強い端（3手・共通部分・3列50をすべて読みに）", "—", {"C": "Chi"}),
    ("T3", "1列の中の違う数字を使わない（族の全員）", "低", {"Llo": "X_noad_Llo", "Clo": "X_noad_Clo", "P": "X_noad_Pclo3"}),
    ("T3", "決まっていない文字が3つ以上の列はいつも和の大きさだけで読む（族の全員）", "低〜中", {"Llo": "X_bnd_Llo", "Clo": "X_bnd_Clo", "P": "X_bnd_Pclo3"}),
    ("T3", "場合分けの枝を2段で打ち切る", "中", {"P": "X_p2_Pclo"}),
    ("T3", "場合分けの枝の中で先読みしない", "中", {"P": "X_fl0_Pclo3"}),
    ("T3", "提供範囲を1列ずつの読みの弱い端で決める（版4 の指示どおり）", "高", {"P": "Plo"}),
    ("T3", "2列をまとめる上限をつないだ組8に下げる", "中", {"Clo": "X_j8_Clo"}),
    ("T3", "1列ずつの読みにも1手の先読み（候補3つの文字まで）", "中", {"Lhi": "X_fl1_Lhi"}),
    ("T3", "1列ずつの読みにも2手の先読み（候補3つの文字まで）", "中", {"Lhi": "X_fl2_Lhi"}),
    ("T3", "1列ずつの読みにも2列（つないだ組12・消える文字を除く）", "中", {"Lhi": "X_pair_Lhi"}),
    ("T3", "3手の先読みを読みに数える", "中", {"C": "X_fl3_CT"}),
    ("T3", "4手の先読みを読みに数える", "低〜中", {"C": "X_fl4_CT"}),
    ("T3", "先読みの全部の値の共通部分を読みに数える", "中", {"C": "X_fb_CT"}),
    ("T3", "3列（組12）を読みに数える", "中", {"C": "X_w3_CT"}),
    ("T3", "3列（組50）を読みに数える", "低〜中", {"C": "X_w3_50_CT"}),
    ("T3", "版4 の指示どおりの強い端（3手・共通部分・3列50をすべて読みに）", "—", {"C": "Chi"}),
    ("Q", "1列の中の違う数字を使わない（族の全員）", "低", {"Llo": "X_noad_Llo", "Clo": "X_noad_Clo", "P": "X_noad_Plo"}),
    ("Q", "決まっていない文字が3つ以上の列はいつも和の大きさだけで読む（族の全員）", "低〜中", {"Llo": "X_bnd_Llo", "Clo": "X_bnd_Clo", "P": "X_bnd_Plo"}),
    ("Q", "場合分けの枝を2段で打ち切る", "中", {"P": "X_p2_Plo"}),
    ("Q", "1列ずつの読みにも1手の先読み（候補3つの文字まで）", "中", {"Lhi": "X_fl1_Lhi"}),
    ("Q", "1列ずつの読みにも2列（つないだ組12・消える文字を除く）", "中", {"Lhi": "X_pair_Lhi"}),
    ("Q", "2列をまとめる上限をつないだ組8に下げる", "中", {"Clo": "X_j8_Clo"}),
]


def joint_view(r, plan, mapping):
    f = r["f4"]
    g = f4_view(f, *PLANS4[plan])
    for role, var in mapping.items():
        if var not in f and {"Plo": "X_plo", "Chi": "X_chi"}.get(var) in f:
            var = {"Plo": "X_plo", "Chi": "X_chi"}[var]
        if var not in f:
            return None
        if role == "P":
            g["Plo"], g["PloW"] = _r(f[var]) if var != "Plo" else (f["Plo"], f["PloW"])
        elif role == "C":
            g["Chi"], g["ChiW"] = _r(f[var]) if var != "Chi" else (f["Chi"], f["ChiW"])
        else:
            g[role] = f[var]
    return g


def cmd_joint4(args):
    rows = load_fam4(args.fam)
    print("| 案 | 解釈（同じ読み方を、その読みを持つ端の全員に） | 自然さ | 測れた分類済み | 別のレベルへ | 範囲外へ | 最も動くレベル | 範囲外から入る |")
    print("|---|---|---|---|---|---|---|---|")
    for plan, name, nat, mapping in JOINT4:
        tot = mv = out = inflow = 0
        byL, totL = Counter(), Counter()
        for r in rows:
            g = joint_view(r, plan, mapping)
            if g is None:
                continue
            try:
                L0 = level4(r, plan)
            except KeyError:  # その案の端を測っていない行（供給の測りの行と案Q など）
                continue
            L1 = level4(r, plan, f=g)
            if L0 is None:
                inflow += L1 is not None
                continue
            tot += 1
            totL[L0] += 1
            if L1 != L0:
                byL[L0] += 1
                if L1 is None:
                    out += 1
                else:
                    mv += 1
        worst = "、".join(f"L{L} {byL[L]}/{totL[L]}" for L in sorted(totL) if byL[L]) or "—"
        print(f"| {plan} | {name} | {nat} | {tot} | {mv} | {out} | {worst} | {inflow} |")


def _show4(r, plan="R"):
    sol = dict(zip(r["letters"], r["solution"]))
    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
    f = f4_view(r["f4"], *PLANS4[plan])
    keys = ("Llo", "Lhi", "Clo", "Chi", "ChiW", "Plo", "PloW")
    return f"seed {r['seed']}（{cond_name(r)}） {' + '.join(r['addends'])} = {r['result']}（文字 {r['n']}・" + "・".join(f"{k} {f[k]}" for k in keys) + f"・解 {num}）"


def load_fam4(paths):
    """seed ごとに重ねる。同じ seed の行は、読み手の結果と秒を足し合わせる（あとから足した測りを含める）。"""
    by = {}
    for p in paths:
        for r in load(p):
            if r["seed"] in by:
                old = by[r["seed"]]["f4"]
                t = dict(old.get("_t", {}))
                t.update(r["f4"].get("_t", {}))
                old.update(r["f4"])
                old["_t"] = t
            else:
                by[r["seed"]] = r
    return [r for r in by.values() if "Llo" in r["f4"]]


# ---------------------------------------------------------------- 版5（今の版）: 「値を仮に置くか」で読みと場合分けを分ける
#
# 読み   : 値を仮に置かずに、制約から事実を出すこと（1列・2列のまとめ・両辺で消える文字・和の大きさ・関係式の持ち回り
#          （3列の組12で近似）・隠れた1つ・組の消去）。先読みは使わない。
# 場合分け: 値を1つ仮に置いて矛盾を見ること。手数によらない（版4 の1〜2手の先読みも、短い場合分けに数える）。
# 場合分けの重さは人が数えられる単位で数える。二択は1つの変数を1回分けることを1回、枝の長さは規則を1つ当てるのを1手。
# 読み手 StepProbe5Reader・NoBounds5Reader・seq5 は、A4（版4）の a4v4/mine/a4v4_readers.py の StepProbeReader・
# NoBoundsReader・seq_info を、この版の端に合わせて取り込んだもの。


class StepProbe5Reader(Fam4Reader):
    """場合分けの枝を、規則を1つずつ当てる手で最短 step_k 手まで追う（幅優先、同じ盤面は1度だけ）。
    1手は、1列・2列（隣・隣でない）・3列・表のどれか1つを1回当てること。矛盾が見つかれば CONTRA。"""

    def __init__(self, p, step_k=4, state_cap=40000, **kw):
        super().__init__(p, **kw)
        self.step_k, self.state_cap, self.cap_hits = step_k, state_cap, 0
        self._base = None
        self.rules = [("col", j, self.colvars[j] | {p.n + j, p.n + j + 1}) for j in range(p.R)]
        for gi, (cols, _cap, _linked, _mode) in enumerate(self.groups):
            tv = set()
            for j in cols:
                tv |= self.colvars[j] | {p.n + j, p.n + j + 1}
            self.rules.append(("grp", gi, tv))
        self.rules.append(("tab", None, set(range(p.n))))

    def _apply_rule(self, dom, kind, arg):
        if kind == "col":
            return self.col_sup(arg, dom)
        if kind == "grp":
            cols, cap, linked, mode = self.groups[arg]
            return self.join(cols, dom, cap, linked, mode)
        return self.table(dom)

    def probe(self, dom):
        start = tuple(dom)
        base = self._base
        ch0 = set(range(self.p.nvars)) if base is None else {u for u in range(self.p.nvars) if start[u] != base[u]}
        frontier = [(start, frozenset(ch0))]
        seen = {start}
        for _ in range(self.step_k):
            nxt = []
            for st, ch in frontier:
                for kind, arg, tv in self.rules:
                    if not (tv & ch):
                        continue
                    sp = self._apply_rule(list(st), kind, arg)
                    if sp is None:
                        return CONTRA, list(dom)
                    if not sp:
                        continue
                    new = list(st)
                    dch = set()
                    for u, m in sp.items():
                        nm = new[u] & m
                        if nm != new[u]:
                            if nm == 0:
                                return CONTRA, list(dom)
                            new[u] = nm
                            dch.add(u)
                    if not dch:
                        continue
                    t = tuple(new)
                    if t in seen:
                        continue
                    seen.add(t)
                    nxt.append((t, ch | dch))
                    if len(seen) > self.state_cap:
                        self.cap_hits += 1
                        return STUCK, list(dom)
            frontier = nxt
            if not frontier:
                break
        return STUCK, list(dom)

    def sac(self, dom, allowed):
        p = self.p
        waves = 0
        while True:
            st, dom = self.close(dom)
            if st == CONTRA:
                return CONTRA, dom, waves
            if _solved(p, dom):
                return SOLVED, dom, waves
            self._base = tuple(dom)
            elim = []
            for v in range(p.nvars):
                if POP[dom[v]] >= 2 and allowed(v, POP[dom[v]]):
                    for d in DIGITS[dom[v]]:
                        d2 = list(dom)
                        d2[v] = 1 << d
                        if self.probe(d2)[0] == CONTRA:
                            elim.append((v, d))
            self._base = None
            if not elim:
                return STUCK, dom, waves
            for u, d in elim:
                dom[u] &= ~(1 << d)
            waves += 1


class NoBounds5Reader(Fam4Reader):
    """組が col_tcap より多い列（決まっていない文字が3つ以上）を読まない1列ずつの読み（矛盾の検出だけはする）。
    「書き出しの少ない列だけで決まるか」を測るための道具（L1 と L2 を分ける）。"""

    def col_sup(self, j, dom, tl=None):
        if sum(1 for v in self.colvars[j] if POP[dom[v]] > 1) > 2:
            t = tl if tl is not None else self._c.col_tuples(j, dom)
            if not t[1]:
                return None
            if len(t[1]) > self.col_tcap:
                return {}
            return FamReader.col_sup(self, j, dom, t)
        return FamReader.col_sup(self, j, dom, tl)


def _one_split5(rd, dom, v):
    """v を1回場合分けした結論（矛盾した値を消し、both なら全部の枝の共通部分も入れる）。何も変わらなければ None。"""
    p = rd.p
    new = list(dom)
    branches = []
    for d in DIGITS[dom[v]]:
        d2 = list(dom)
        d2[v] = 1 << d
        st2, r2 = rd.probe(d2)
        if st2 == CONTRA:
            new[v] &= ~(1 << d)
        else:
            branches.append(r2)
    if rd.both and branches:
        for u in range(p.nvars):
            if u != v:
                common = 0
                for b in branches:
                    common |= b[u]
                new[u] &= common
    return None if new == list(dom) else new


def seq5(rd, kmax=1, width=2):
    """二択（width=3 なら三択まで）を、1つの変数ずつ数える。読みの閉包から、1つの変数の場合分けの結論を入れて読み直すのを
    繰り返し、解けるまでの最短の回数を返す（kmax を超えれば kmax+1、進めなければ None）。"""
    p = rd.p
    st, dom = rd.close(p.initial_domains())
    if st == CONTRA:
        return "contra"
    if _solved(p, dom):
        return 0
    frontier = [tuple(dom)]
    seen = set(frontier)
    for k in range(1, kmax + 1):
        nxt = []
        for s in frontier:
            s = list(s)
            if hasattr(rd, "_base"):
                rd._base = tuple(s)
            for v in range(p.nvars):
                if not (2 <= POP[s[v]] <= width):
                    continue
                new = _one_split5(rd, s, v)
                if new is None:
                    continue
                st2, d2 = rd.close(new)
                if st2 == CONTRA:
                    return "contra"
                if _solved(p, d2):
                    return k
                t = tuple(d2)
                if t not in seen:
                    seen.add(t)
                    nxt.append(t)
        frontier = nxt
        if not frontier:
            return None
    return kmax + 1


# 版5 の端の読み手。族の幅は、版4 の幅に A4（版4）の種類の中の読み（二択を1つずつ数える S1、枝の手数 B3、枝2段 B2、
# 先読みをしない FL0lo、2列の組8 J8、1列の書き出しの上限 4・6 の T4・T6）を足したもの。
L5_LO = dict(col_mode="bt", col_tcap=4, hidden=False, subsets=False)
L5_HI = dict(col_mode="gac", hidden=True, subsets=True)
C5_LO = dict(col_mode="bt", col_tcap=4, pair_cap=8, pair_mode="joined", cancel=False, fl_depth=0, hidden=False, subsets=False)
# 強い端: 関係式の持ち回りを、消える文字を除いて数える3列の組12で近似する
C5_HI = dict(col_mode="gac", pair_cap=200, pair_mode="or", pair_join_cap=50, cancel=True, nonadj_cap=50, win3_cap=12,
             fl_depth=0, hidden=True, subsets=True, both=True, r2_wl=3)
# 1列の重さ（L1 と L2）: 組 t より多い列を読まない1列ずつの読み
NB5_LO = dict(col_mode="bt", col_tcap=4, hidden=False, subsets=False)
NB5_HI = dict(col_mode="bt", col_tcap=12, hidden=True, subsets=True)
# 場合分けの読み手の弱い端（どれも土台は C5_LO。三択は繰り上がりだけ）。弱い端が2人いる（枝を人の手で k 手／同時に読む2段）。
# 族の全員が解けるのは、この2人がどちらも解けるとき（族の誰もが、どちらかより強いので。導出）。
P5_STEP = dict(C5_LO, r2_wl=2)
P5_R2 = dict(C5_LO, probe=2, r2_wl=2)
STEP5_K = (3, 4, 5)


def _step_tier(p, k):
    rd = StepProbe5Reader(p, step_k=k, **P5_STEP)
    t = rd.tier()
    return [t["R"], t.get("waves"), rd.cap_hits]


def _fam5_base(p, out, run):
    for nm, kw in (("Llo", L5_LO), ("Lhi", L5_HI), ("Clo", C5_LO)):
        run(nm, lambda kw=kw: _close_solved(p, kw))
    for nm, kw in (("NBlo", NB5_LO), ("NBhi", NB5_HI)):
        def nb(kw=kw):
            st, dom = NoBounds5Reader(p, **kw).close(p.initial_domains())
            return 0 if st != CONTRA and _solved(p, dom) else 1
        run(nm, nb)
    if out["Clo"] == 1:
        run("Chi", lambda: _close_solved(p, C5_HI))
        if out["Chi"] == 1:
            run("Pr2", lambda: (lambda t: [t["R"], t.get("waves")])(Fam4Reader(p, **P5_R2).tier()))
            for k in STEP5_K:
                run(f"Ps{k}", lambda k=k: _step_tier(p, k))
            if out["Pr2"][0] in (0, 1, 2) or any(out[f"Ps{k}"][0] in (0, 1, 2) for k in STEP5_K):
                run("seqChi", lambda: seq5(Fam4Reader(p, **C5_HI), kmax=1))
                run("seqPr2", lambda: seq5(Fam4Reader(p, **P5_R2), kmax=1))
                for k in STEP5_K:
                    run(f"seqPs{k}", lambda k=k: seq5(StepProbe5Reader(p, step_k=k, **P5_STEP), kmax=1))


def fam5_of(p: Puzzle, timing=False, extra=(), base=True) -> dict:
    """版5 の端の読み手の結果。安い順に当て、要らない読み手は測らない（どの組か決まれば止める）。
    base=False なら extra の読み手だけ（あとから足す測り）。"""
    out: dict = {}
    tt: dict = {}

    def run(name, fn):
        t0 = time.perf_counter()
        out[name] = fn()
        tt[name] = round(time.perf_counter() - t0, 4)

    if base:
        _fam5_base(p, out, run)
    for nm in extra:
        kind, kw = FAM5_VARIANTS[nm]
        if kind == "close":
            run(nm, lambda kw=kw: _close_solved(p, kw))
        elif kind == "tier":
            run(nm, lambda kw=kw: (lambda t: [t["R"], t.get("waves")])(Fam4Reader(p, **kw).tier()))
        elif kind == "seq":
            run(nm, lambda kw=kw: seq5(Fam4Reader(p, **kw), kmax=1))
        elif kind == "steptier":
            k, kw2 = kw
            run(nm, lambda k=k, kw2=kw2: (lambda rd: (lambda t: [t["R"], t.get("waves"), rd.cap_hits])(rd.tier()))(StepProbe5Reader(p, step_k=k, **kw2)))
        elif kind == "stepseq":
            k, kw2 = kw
            run(nm, lambda k=k, kw2=kw2: seq5(StepProbe5Reader(p, step_k=k, **kw2), kmax=1))
    if timing:
        out["_t"] = tt
    return out


# 族の外の解釈（同じ読み方を、その読みを持つ端の全員に一緒に当てる）。名前 → (種類, 引数)
FAM5_VARIANTS: dict = {
    # 弱い端をさらに弱める
    "X_r1": ("tier", dict(C5_LO, probe=1, r2_wl=2)),
    "X_noad_Llo": ("close", dict(L5_LO, noad=True)),
    "X_bnd_Llo": ("close", dict(L5_LO, col_tcap=None)),
    "X_t2_Llo": ("close", dict(L5_LO, col_tcap=2)),
    "X_j6_Clo": ("close", dict(C5_LO, pair_cap=6)),
    "X_t2_Clo": ("close", dict(C5_LO, col_tcap=2)),
    "X_p0_Clo": ("close", dict(C5_LO, pair_cap=None)),
    # 強い端をさらに強める
    "X_w3_50": ("close", dict(C5_HI, win3_cap=50)),
    "X_fl1": ("close", dict(C5_HI, fl_depth=1, fl_wl=3)),
    "X_fl2": ("close", dict(C5_HI, fl_depth=2, fl_wl=3)),
    "X_fl1_Lhi": ("close", dict(L5_HI, fl_depth=1, fl_wl=3)),
    "X_pair_Lhi": ("close", dict(L5_HI, pair_cap=8, pair_mode="joined")),
    "X_seq_w3_50": ("seq", dict(C5_HI, win3_cap=50)),
    "X_seq_r1": ("seq", dict(C5_LO, probe=1, r2_wl=2)),
    "X_seq_fl1": ("seq", dict(C5_HI, fl_depth=1, fl_wl=3)),
    "X_seq_fl2": ("seq", dict(C5_HI, fl_depth=2, fl_wl=3)),
    # 選択肢を比べるための、場合分けの読み手の弱い端の別案（族を狭める向き）
    "O_Pinf": ("tier", dict(C5_LO, probe=None, r2_wl=2)),
    "O_seqPinf": ("seq", dict(C5_LO, probe=None, r2_wl=2)),
    "O_Pr2c12": ("tier", dict(C5_LO, col_tcap=12, pair_cap=12, probe=2, r2_wl=2)),
    "O_seqPr2c12": ("seq", dict(C5_LO, col_tcap=12, pair_cap=12, probe=2, r2_wl=2)),
    "O_Ps5c12": ("steptier", (5, dict(C5_LO, col_tcap=12, pair_cap=12, r2_wl=2))),
    "O_seqPs5c12": ("stepseq", (5, dict(C5_LO, col_tcap=12, pair_cap=12, r2_wl=2))),
    "O_Ps8": ("steptier", (8, P5_STEP)),
    "O_seqPs8": ("stepseq", (8, P5_STEP)),
}


def read_class5(f) -> str | None:
    if f["Llo"] == 0:
        return "E"
    if f["Lhi"] == 0:
        return "mE"
    if f["Clo"] == 0:
        return "H1"
    if f.get("Chi") == 0:
        return "mH"
    return "H2"


def provided5(f, k) -> bool:
    """提供範囲: 場合分けの読み手の弱い端の2人（枝を人の手で k 手、同時に読む2段）が、どちらも三択までの場合分けで解ける。
    H1 以下は、まとめる読みの弱い端が場合分けなしで解くので、どちらも解ける（導出）。"""
    if read_class5(f) in ("E", "mE", "H1"):
        return True
    if "Pr2" not in f:
        return False
    return f["Pr2"][0] in (0, 1, 2) and f[f"Ps{k}"][0] in (0, 1, 2)


def split_weight5(f, k, use_r2=True) -> str | None:
    """H2 の中の段。B1: 弱い端の2人とも、1つの変数の二択1回で解ける（強い端も場合分けが要るので、族の全員がちょうど1回）。
    B2: 強い端でも、1つの変数の二択1回では解けない（二択を重ねるか三択）。間は余白。"""
    if "seqChi" not in f:
        return None
    lo = [f[f"seqPs{k}"]] + ([f["seqPr2"]] if use_r2 else [])
    if all(x == 1 for x in lo):
        return "B1"
    if f["seqChi"] != 1:
        return "B2"
    return None


def col_weight5(f) -> str | None:
    """E の中の1列の重さ。E1: 組4より多い列を読まずに解ける。E2: 組12より多い列を読まなければ解けない。間は余白。"""
    if f["NBlo"] == 0:
        return "E1"
    if f["NBhi"] == 1:
        return "E2"
    return None


# 案（k は枝の手数。r2 は「同時に読む2段」の弱い端を入れるか。e2 は L2 を E2 に寄せるか）
PLANS5 = {
    "K4": dict(k=4, r2=True, e2=True),
    "K5": dict(k=5, r2=True, e2=True),
    "K5n": dict(k=5, r2=False, e2=True),
    "K4e": dict(k=4, r2=True, e2=False),
    "K5e": dict(k=5, r2=True, e2=False),
}
ADOPTED_V5 = "K5"
LETTERS5 = {1: (5, 7), 2: (5, 10), 3: (5, 10), 4: (6, 10), 5: (7, 10)}


def cell5(r, plan, f=None):
    pl = PLANS5[plan]
    f = r["f5"] if f is None else f
    c = read_class5(f)
    sc = scale_cell(r)
    if c == "E":
        if sc == "2s":
            return "E1" if (not pl["e2"] or col_weight5(f) == "E1") else None
        if sc == "3s":
            return "E2" if (not pl["e2"] or col_weight5(f) == "E2") else None
        return None
    if c == "H1":
        return "H1"
    if c == "H2" and pl["r2"] and provided5(f, pl["k"]):
        return split_weight5(f, pl["k"], True)
    if c == "H2" and not pl["r2"] and f.get(f"Ps{pl['k']}", ["deep"])[0] in (0, 1, 2):
        return split_weight5(f, pl["k"], False)
    return None


CELLS5 = {("2s", "E1"): 1, ("3s", "E2"): 2, ("3s", "H1"): 3, ("3l", "H1"): 3, ("3l", "B1"): 4, ("3l", "B2"): 5}


def level5(r, plan, letters=True, f=None):
    c = cell5(r, plan, f)
    if c is None:
        return None
    L = CELLS5.get((scale_cell(r), c))
    if L is None:
        return None
    if letters:
        lo, hi = LETTERS5[L]
        if not (lo <= r["n"] <= hi):
            return None
    return L



# ---------------------------------------------------------------- 版6（決定版）: 版5 の線のまま、数え方を人の手解きにそろえる
#
# 版5 からの直し（A4・F1（版5）を受けて。作り直しはしない）:
#   1. 弱い端の2列は、つないだ後の組（8以下）に加え、探す手間（一つずつの組の数の積。両辺で消える文字を除く）でも上限に数える
#   2. 1列の重さ（E1/E2）は、両辺で消える文字を除いて、決まっていない文字と組を数える
#   3. 枝の手は、1つの事実（1つの変数の候補を減らすか、矛盾を見る）を出すのを1手とし、2列のまとめは2手（3列は3手）
#   4. 場合分けは1つの変数ずつ、二択も三択も1回と数える。提供範囲に回数の上限を置き、L4 と L5 を回数で分ける
# 読み手 FactStep6Reader は A4（版5）の a4v5/mine/a4v5_readers.py の CostStepReader（mode fact と pair2）を一つにしたもの。
# NoBounds6Reader は F1（版5）の a4v5/f1/nbcancel.py の NBCancel を取り込んだもの。


class Fam6Reader(Fam4Reader):
    """pair_prod_cap: 2列をまとめるのを、一つずつの組の数（両辺で消える文字を除いて数える）の積がこれ以下のときだけにする。"""

    def __init__(self, p, pair_prod_cap=None, **kw):
        super().__init__(p, **kw)
        self.pair_prod_cap = pair_prod_cap

    def join(self, cols, dom, cap, linked, mode, tls=None):
        if self.pair_prod_cap is not None and len(cols) == 2:
            canc = self._canc(cols)
            prod = 1
            for j in cols:
                lets, t = tls[j] if tls and j in tls else self._c.col_tuples(j, dom)
                if not t:
                    return None
                keep = [i for i, v in enumerate(lets) if v not in canc]
                prod *= len({(tuple(vals[i] for i in keep), c, o) for vals, c, o, _ in t})
            if prod > self.pair_prod_cap:
                return {}
        return super().join(cols, dom, cap, linked, mode, tls)


class NoBounds6Reader(Fam4Reader):
    """組が col_tcap より多い列（両辺で消える文字を除いて、決まっていない文字が3つ以上）を読まない1列ずつの読み。
    決まっていない文字と組は、どちらも両辺で消える文字を除いて数える（矛盾の検出だけはする）。"""

    def col_sup(self, j, dom, tl=None):
        lin = self.lin[j]
        if sum(1 for v in self.colvars[j] if POP[dom[v]] > 1) > 2:
            t = tl if tl is not None else self._c.col_tuples(j, dom)
            if not t[1]:
                return None
            unf = sum(1 for v in self.colvars[j] if POP[dom[v]] > 1 and v in lin)
            keep = [i for i, v in enumerate(t[0]) if v in lin]
            proj = {(tuple(vals[i] for i in keep), c, o) for vals, c, o, _ in t[1]}
            if unf > 2 and len(proj) > self.col_tcap:
                return {}
            return FamReader.col_sup(self, j, dom, t)
        return FamReader.col_sup(self, j, dom, tl)


class FactStep6Reader(Fam6Reader):
    """場合分けの枝を、人の手で最短 step_k 手まで追う（コストつきの最短探索。同じ盤面は安い方だけ）。
    1手は、1つの規則から1つの変数の候補を減らすこと（1つの事実）。2列のまとめから出す事実は2手、3列は3手、1列と表は1手。
    規則が矛盾を見るのも、その規則の手で数える。"""

    def __init__(self, p, step_k=8, state_cap=200000, whole=False, **kw):
        super().__init__(p, **kw)
        self.step_k, self.state_cap, self.cap_hits = step_k, state_cap, 0
        # whole=True: 1つの規則から出る事実を全部まとめて出す（手はその事実の数×重み）。探す盤面が少なく速いが、
        # 要らない事実も数えるので、手は fact の数え方より多いか同じ（導出）
        self.whole = whole
        self._base = None
        self.rules = [("col", j, self.colvars[j] | {p.n + j, p.n + j + 1}, 1) for j in range(p.R)]
        for gi, (cols, _cap, _linked, _mode) in enumerate(self.groups):
            tv = set()
            for j in cols:
                tv |= self.colvars[j] | {p.n + j, p.n + j + 1}
            self.rules.append(("grp", gi, tv, len(cols)))
        self.rules.append(("tab", None, set(range(p.n)), 1))

    def _apply_rule(self, dom, kind, arg):
        if kind == "col":
            return self.col_sup(arg, dom)
        if kind == "grp":
            cols, cap, linked, mode = self.groups[arg]
            return self.join(cols, dom, cap, linked, mode)
        return self.table(dom)

    def probe(self, dom):
        import heapq

        start = tuple(dom)
        base = self._base
        ch0 = set(range(self.p.nvars)) if base is None else {u for u in range(self.p.nvars) if start[u] != base[u]}
        best = {start: 0}
        cnt = 0
        heap = [(0, cnt, start, frozenset(ch0))]
        k = self.step_k
        while heap:
            cost, _, st, ch = heapq.heappop(heap)
            if best.get(st, 1 << 30) < cost:
                continue
            for kind, arg, tv, w in self.rules:
                if not (tv & ch) or cost + w > k:
                    continue
                sp = self._apply_rule(list(st), kind, arg)
                if sp is None:
                    return CONTRA, list(dom)
                if self.whole:
                    new = list(st)
                    dch = set()
                    for u, m in sp.items():
                        nm = st[u] & m
                        if nm != st[u]:
                            if nm == 0:
                                return CONTRA, list(dom)
                            new[u] = nm
                            dch.add(u)
                    if not dch:
                        continue
                    c2 = cost + w * len(dch)
                    if c2 > k:
                        continue
                    t = tuple(new)
                    if best.get(t, 1 << 30) <= c2:
                        continue
                    best[t] = c2
                    cnt += 1
                    heapq.heappush(heap, (c2, cnt, t, ch | dch))
                    continue
                for u, m in sp.items():
                    nm = st[u] & m
                    if nm == st[u]:
                        continue
                    if nm == 0:
                        return CONTRA, list(dom)
                    new = list(st)
                    new[u] = nm
                    t = tuple(new)
                    c2 = cost + w
                    if best.get(t, 1 << 30) <= c2:
                        continue
                    best[t] = c2
                    cnt += 1
                    heapq.heappush(heap, (c2, cnt, t, ch | {u}))
                    if len(best) > self.state_cap:
                        self.cap_hits += 1
                        return STUCK, list(dom)
        return STUCK, list(dom)


def seq6(rd, allowed, kmax=3, frontier_cap=3000):
    """場合分けを1つの変数ずつ、二択も三択も1回と数えた最短の回数。kmax 回まで調べ尽くして解けなければ kmax+1。
    進めない（許した場合分けがどれも何も消さない）なら None、kmax 回目より前に探す盤面が frontier_cap を超えたら "cap"。
    allowed(v, 候補の数) で、場合分けしてよい変数を決める。"""
    p = rd.p
    st, dom = rd.close(p.initial_domains())
    if st == CONTRA:
        return "contra"
    if _solved(p, dom):
        return 0
    frontier = [tuple(dom)]
    seen = set(frontier)
    for k in range(1, kmax + 1):
        nxt = []
        for s in frontier:
            s = list(s)
            if hasattr(rd, "_base"):
                rd._base = tuple(s)
            for v in range(p.nvars):
                w = POP[s[v]]
                if w < 2 or not allowed(v, w):
                    continue
                new = _one_split5(rd, s, v)
                if new is None:
                    continue
                st2, d2 = rd.close(new)
                if st2 == CONTRA:
                    return "contra"
                if _solved(p, d2):
                    return k
                t = tuple(d2)
                if t not in seen:
                    seen.add(t)
                    nxt.append(t)
        frontier = nxt
        if not frontier:
            return None
        if k < kmax and len(frontier) > frontier_cap:
            return "cap"  # 探す盤面が上限を超えた。次の回数を調べずに打ち切った（評価不能）
    return kmax + 1



def _lin_bounds_enum6(dom, lin, n, enum_k):
    """式 Σ a·x = 0 を読む。決まっていない変数が enum_k 個以下なら書き出し（文字は互いに違う数字）、多ければ和の大きさ。"""
    vs = list(lin)
    for v in vs:
        if dom[v] == 0:
            return None
    unf = [v for v in vs if POP[dom[v]] > 1]
    if len(unf) <= enum_k:
        sup = {v: 0 for v in vs}
        any_ok = False
        for combo in product(*[DIGITS[dom[v]] for v in vs]):
            if sum(lin[v] * x for v, x in zip(vs, combo)) != 0:
                continue
            ls = [x for v, x in zip(vs, combo) if v < n]
            if len(set(ls)) != len(ls):
                continue
            any_ok = True
            for v, x in zip(vs, combo):
                sup[v] |= 1 << x
        return sup if any_ok else None
    d = {v: dom[v] for v in vs}
    while True:
        moved = False
        lo, hi = {}, {}
        for v, a in lin.items():
            ds = DIGITS[d[v]]
            lo[v], hi[v] = min(a * ds[0], a * ds[-1]), max(a * ds[0], a * ds[-1])
        slo, shi = sum(lo.values()), sum(hi.values())
        if slo > 0 or shi < 0:
            return None
        for v, a in lin.items():
            olo, ohi = slo - lo[v], shi - hi[v]
            keep = 0
            for x in DIGITS[d[v]]:
                if olo <= -a * x <= ohi:
                    keep |= 1 << x
            if keep == 0:
                return None
            if keep != d[v]:
                d[v] = keep
                moved = True
        if not moved:
            return d


class Alg6Reader(Fam4Reader):
    """強い端の関係式の持ち回り（式で読む形。A4（版5）の AlgReader を取り込んだもの）。隣り合う2列・3列・全部の列を桁の重みで
    まとめた式と、共通の文字を持つ任意の2列の式の差を、決まっていない変数が3つまでなら書き出し、多ければ和の大きさで読む。"""

    def __init__(self, p, windows=(2, 3), full=True, diff=True, enum_k=3, **kw):
        from itertools import combinations
        super().__init__(p, **kw)
        R = p.R
        self.alg = []
        ws = {w for w in windows if w <= R}
        if full:
            ws.add(R)
        for w in sorted(ws):
            for j in range(R - w + 1):
                lin: dict = {}
                for i in range(w):
                    for v, a in self.lin[j + i].items():
                        lin[v] = lin.get(v, 0) + a * 10 ** i
                self.alg.append({v: a for v, a in lin.items() if a})
        if diff:
            for a, b in combinations(range(R), 2):
                la, lb = self.lin[a], self.lin[b]
                if not ({k for k in la if k < p.n} & {k for k in lb if k < p.n}):
                    continue
                lin = dict(la)
                for v, x in lb.items():
                    lin[v] = lin.get(v, 0) - x
                lin = {v: x for v, x in lin.items() if x}
                if lin:
                    self.alg.append(lin)
        self.enum_k = enum_k

    def close(self, dom):
        dom = list(dom)
        while True:
            st, dom = super().close(dom)
            if st == CONTRA:
                return st, dom
            moved = False
            for lin in self.alg:
                sp = _lin_bounds_enum6(dom, lin, self.p.n, self.enum_k)
                if sp is None:
                    return CONTRA, dom
                r = self._apply(dom, sp)
                if r is None:
                    return CONTRA, dom
                if r:
                    moved = True
                    break
            if not moved:
                return STUCK, dom


def _chi6(p):
    """強い端（C6_HI に式の持ち回り Alg6Reader を足したもの）が場合分けなしで解けるか。"""
    st, dom = Alg6Reader(p, **C6_HI).close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1

# 版6 の端の読み手
L6_LO = dict(L5_LO)
L6_HI = dict(L5_HI)
C6_LO = dict(C5_LO)  # ＋ pair_prod_cap（PROD6）
C6_HI = dict(C5_HI)
NB6_LO = dict(NB5_LO)
NB6_HI = dict(NB5_HI)
PROD6 = (24, 50)  # 比べる探す手間の上限
STEP6_K = (14, 18, 22)  # 比べる枝の手（whole の数え方。1つの規則から出る事実を全部数える）


def weak_allowed(p):
    n = p.n
    return lambda v, w: w == 2 or (w == 3 and v >= n)


def strong_allowed(p):
    return lambda v, w: w <= 3



def _nb6(p, kw):
    st, dom = NoBounds6Reader(p, **kw).close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1


def _close6(p, kw, prod):
    st, dom = Fam6Reader(p, pair_prod_cap=prod, **kw).close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1


def fam6_of(p: Puzzle, timing=False, light=False) -> dict:
    """版6 の端の読み手の結果（安い順に当て、要らない読み手は測らない）。比べる選び方（探す手間の上限 PROD6、枝の手 STEP6_K）を
    一緒に測る。キー: Llo・Lhi・Clo（版5 の弱い端）・Clo24/Clo50（探す手間の上限つき）・NB6lo/NB6hi（消える文字を除く）・
    Chi・sChi（強い端の1つずつの回数。三択も1回）・bChi（二択だけで1回か。版5 の数え方）・
    sPc{prod}（枝は閉包。下の端の比べの上限）・sP{prod}_{k}（枝は人の手 k）・bP{prod}_{k}（二択だけで1回か）"""
    out: dict = {}
    tt: dict = {}

    def run(name, fn):
        t0 = time.perf_counter()
        out[name] = fn()
        tt[name] = round(time.perf_counter() - t0, 4)

    run("Llo", lambda: _close_solved(p, L6_LO))
    run("Lhi", lambda: _close_solved(p, L6_HI))
    run("Clo", lambda: _close_solved(p, C6_LO))
    for pc in PROD6:
        run(f"Clo{pc}", lambda pc=pc: _close6(p, C6_LO, pc))
    if out["Llo"] == 0 or out["Lhi"] == 0:
        run("NB6lo", lambda: _nb6(p, NB6_LO))
        run("NB6hi", lambda: _nb6(p, NB6_HI))
    if all(out[f"Clo{pc}"] == 1 for pc in PROD6):
        run("Chi", lambda: _close_solved(p, C6_HI))
        if out["Chi"] == 1:
            run("ChiA", lambda: _chi6(p))
        if out.get("ChiA") == 1 and not light:
            run("sChi", lambda: seq6(Fam4Reader(p, **C6_HI), strong_allowed(p), kmax=3))
            run("bChi", lambda: seq5(Fam4Reader(p, **C6_HI), kmax=1))
            run("sPcN", lambda: seq6(Fam6Reader(p, **dict(C6_LO, r2_wl=2)), weak_allowed(p), kmax=3, frontier_cap=300))
            if out["sPcN"] in (1, 2, 3):
                for k in STEP6_K:
                    def spn(k=k):
                        rd = FactStep6Reader(p, step_k=k, whole=True, **dict(C6_LO, r2_wl=2))
                        return seq6(rd, weak_allowed(p), kmax=3, frontier_cap=300)
                    run(f"sPN_{k}", spn)
                    if out[f"sPN_{k}"] == 1:
                        def bpn(k=k):
                            return seq5(FactStep6Reader(p, step_k=k, whole=True, **dict(C6_LO, r2_wl=2)), kmax=1)
                        run(f"bPN_{k}", bpn)
            for pc in PROD6:
                run(f"sPc{pc}", lambda pc=pc: seq6(Fam6Reader(p, pair_prod_cap=pc, **dict(C6_LO, r2_wl=2)), weak_allowed(p), kmax=3, frontier_cap=300))
                if out[f"sPc{pc}"] in (1, 2, 3):
                    for k in STEP6_K:
                        def sp(k=k, pc=pc):
                            rd = FactStep6Reader(p, step_k=k, whole=True, pair_prod_cap=pc, **dict(C6_LO, r2_wl=2))
                            return seq6(rd, weak_allowed(p), kmax=3, frontier_cap=300)
                        run(f"sP{pc}_{k}", sp)
                        if out[f"sP{pc}_{k}"] == 1:
                            def bp(k=k, pc=pc):
                                rd = FactStep6Reader(p, step_k=k, whole=True, pair_prod_cap=pc, **dict(C6_LO, r2_wl=2))
                                return seq5(rd, kmax=1)
                            run(f"bP{pc}_{k}", bp)
    if timing:
        out["_t"] = tt
    return out


def _fam6_task(arg):
    row, light = arg
    p = puzzle_of(row)
    t0 = time.perf_counter()
    f = fam6_of(p, timing=True, light=light)
    keep = {k: row[k] for k in KEEP5 if k in row}
    keep["f6"] = f
    keep["t_f6"] = round(time.perf_counter() - t0, 3)
    return keep


def cmd_family6(args):
    rows = [r for p in args.corpus for r in load(p) if "lens" in r and r["k"] <= 3]
    seen, uniq = set(), []
    for r in rows:
        if r["seed"] not in seen:
            seen.add(r["seed"])
            uniq.append(r)
    if args.skip:
        done = {json.loads(line)["seed"] for p in args.skip.split(",") for line in open(p, encoding="utf-8")}
        uniq = [r for r in uniq if r["seed"] not in done]
    uniq.sort(key=lambda r: -sum(r["lens"]))
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for i, res in enumerate(pool.imap_unordered(_fam6_task, [(r, args.light) for r in uniq], chunksize=2)):
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")
            if i % 500 == 0:
                print(i, f"{time.perf_counter() - t0:.0f}s", file=sys.stderr, flush=True)
    print(f"{len(uniq)} rows, {time.perf_counter() - t0:.1f}s", file=sys.stderr)



# 版6 の案: (探す手間の上限, 枝の人の手, L4/L5 の分け方 "count"（1回／2回以上。二択も三択も1回）か "binary"（版5 の二択1回）)
PLANS6 = {f"P{pc}{'s' if sp else 'n'}k{k}{rule[0]}": dict(prod=pc, split_prod=(pc if sp else None), k=k, rule=rule)
          for pc in PROD6 for sp in (True, False) for k in STEP6_K for rule in ("count", "binary", "weak")}
# 採る案: L3 の境の2列は探す手間50まで、場合分けの読み手の土台には探す手間の上限を置かない、枝は人の手18、L4/L5 は弱い端の回数
ADOPTED_V6 = "P50nk18w"
SPLIT_CAP6 = 2  # 提供範囲: 弱い端が、1つずつ数えて2回までの場合分けで解ける（3回と比べた。L4 が供給を縛るので、2回でも時間は同じ）
# L3 は3つ足し・4桁まで（3s）だけ。5桁を含む H1（3l・H1）は組み合わせ外（混ぜると L3 の中で文字の数と読みの量の順位相関が 0.80 になり、
# 図鑑の「文字の数」が難易度の写しに近づく。覆面算図鑑と問題の特徴.md）
CELLS6 = {("2s", "E1"): 1, ("3s", "E2"): 2, ("3s", "H1"): 3, ("3l", "B1"): 4, ("3l", "B2"): 5}
# 文字の数の範囲。問題集は5〜9文字（実装前提調査 D-04）。10文字は、5+5+4・5+5+5 で 1000 候補に L4 0・L5 6 問しか出ない
# （supply6 --nrange 10,10。資料 §8.3）ので入れない
LETTERS6 = {1: (5, 7), 2: (5, 9), 3: (5, 9), 4: (6, 9), 5: (7, 9)}


def read_class6(f, prod):
    if f["Llo"] == 0:
        return "E"
    if f["Lhi"] == 0:
        return "mE"
    if f[f"Clo{prod}"] == 0:
        return "H1"
    if "Chi" not in f:  # Chi を測っていない行は、上限の緩い Clo が解くので Chi も解く（導出）
        return "mH"
    if f["Chi"] == 0:
        return "mH"
    if "ChiA" not in f:  # ChiA（式の読み）を測っていない行を H2 にしない（別のファイルにある ChiA を読み忘れると L4・L5 が増える）
        raise KeyError(f"ChiA が無い（Chi で止まった行。load_fam6 に ChiA の行を渡す）: {f}")
    return "mH" if f["ChiA"] == 0 else "H2"


def col_weight6(f):
    if f.get("NB6lo") == 0:
        return "E1"
    if f.get("NB6hi") == 1:
        return "E2"
    return None


def _sp_key(split_prod, k, kind="s"):
    return f"{kind}P{'N' if split_prod is None else split_prod}_{k}"


def provided6(f, prod, k, split_prod=None):
    """提供範囲: H1 以下は場合分けが要らない。H2 は、場合分けの読み手の弱い端が、枝を人の手 k 手まで追い、
    1つずつ数えて SPLIT_CAP6 回までの場合分けで解ける。"""
    c = read_class6(f, prod)
    if c in ("E", "mE", "H1"):
        return True
    if c == "mH":
        return False  # 余白（レベルに入らない）
    return f.get(_sp_key(split_prod, k)) in tuple(range(1, SPLIT_CAP6 + 1))


def split_weight6(f, prod, k, rule, split_prod=None):
    """H2 の中の段。
    count : B1＝弱い端が1回（族の全員が1回）、B2＝強い端でも2回以上（族の全員が2回以上）。二択も三択も1回
    binary: 版5 の数え方。B1＝弱い端が二択1回、B2＝強い端でも二択1回では解けない
    weak  : B1＝弱い端が1回（族の全員が1回）、B2＝弱い端が2〜SPLIT_CAP6 回（強い読み手は1回で済むことが多い）"""
    if not provided6(f, prod, k, split_prod) or read_class6(f, prod) != "H2":
        return None
    sp = f.get(_sp_key(split_prod, k))
    if rule == "count":
        if sp == 1:
            return "B1"
        return "B2" if f.get("sChi") not in (0, 1) else None
    if rule == "weak":
        return "B1" if sp == 1 else "B2"
    if f.get(_sp_key(split_prod, k, "b")) == 1:
        return "B1"
    return "B2" if f.get("bChi") != 1 else None


def cell6(r, plan, f=None):
    pl = PLANS6[plan]
    f = r["f6"] if f is None else f
    c = read_class6(f, pl["prod"])
    sc = scale_cell(r)
    if c == "E":
        cw = col_weight6(f)
        return "E1" if (sc == "2s" and cw == "E1") else ("E2" if (sc == "3s" and cw == "E2") else None)
    if c == "H1":
        return "H1"
    if c == "H2":
        return split_weight6(f, pl["prod"], pl["k"], pl["rule"], pl["split_prod"])
    return None


def level6(r, plan, letters=True, f=None):
    c = cell6(r, plan, f)
    if c is None:
        return None
    L = CELLS6.get((scale_cell(r), c))
    if L is None:
        return None
    if letters:
        lo, hi = LETTERS6[L]
        if not (lo <= r["n"] <= hi):
            return None
    return L


SCOPES6 = ("レベル", "余白", "組み合わせ外", "文字の数", "上限を超える", "評価不能")


def scope6(r, plan=ADOPTED_V6, f=None):
    """1問がどこに入るか（レベル、または範囲外の理由）。f は classify6 と同じ kmax（SPLIT_CAP6）で測った読み手の結果。
    - 余白: 組の境（mE・mH）か、E1 と E2 のあいだ。評価はできて、端の読み手で言い方が決まらないので出さない
    - 組み合わせ外: 規模と組・段が CELLS6 に無い（2l、3s・E1、2s・H1、3l・H1、2s・3s の H2 など）
    - 文字の数: LETTERS6 の外
    - 上限を超える: 3l の H2 で、枝を閉包で読む人でも2回の場合分けで解けない（sPcN＝上限＋1）か、
      その人なら2回までで解けるが、枝を18手で切る人は解けない（sPN_k が上限＋1 か None）。評価はできて、提供範囲の外
    - 評価不能: 分析を打ち切ったもの。枝を閉包で読む人が、許した場合分けで進めない（sPcN が None）か、
      探す盤面が上限を超えた（sPcN か sPN_k が "cap"）。場合分けの重さを測れない"""
    pl = PLANS6[plan]
    f = r["f6"] if f is None else f
    c = read_class6(f, pl["prod"])
    sc = scale_cell(r)
    if c in ("mE", "mH"):
        return None, "余白"
    if c == "E":
        if sc in ("2s", "3s") and col_weight6(f) is None:
            return None, "余白"
    if c == "H2" and sc == "3l":
        spc, spk = f.get("sPcN"), f.get(_sp_key(pl["split_prod"], pl["k"]))
        if spc is None or spc == "cap" or spk == "cap":
            return None, "評価不能"
        if spc not in range(1, SPLIT_CAP6 + 1) or spk not in range(1, SPLIT_CAP6 + 1):
            return None, "上限を超える"
    cell = cell6(r, plan, f)
    if cell is None or (sc, cell) not in CELLS6:
        return None, "組み合わせ外"
    L = level6(r, plan, f=f)
    return (L, "レベル") if L is not None else (None, "文字の数")


def load_fam6(paths):
    """f6 を持つ行を読む。問題を持たない行（seed と f6 だけ。後から足した読み手の結果）は、同じ seed の問題の行に足す。"""
    by, patches = {}, []
    for p in paths:
        for r in load(p):
            if "f6" not in r:
                continue
            if "lens" not in r:
                patches.append(r)
            elif r["seed"] in by:
                by[r["seed"]]["f6"].update(r["f6"])
            else:
                by[r["seed"]] = r
    for r in patches:
        if r["seed"] in by:
            by[r["seed"]]["f6"].update(r["f6"])
    return list(by.values())


def cmd_plans6(args):
    rows = load_fam6(args.fam)
    byc = defaultdict(list)
    for r in rows:
        byc[cond_name(r)].append(r)
    print(f"## 版6（{len(rows)} 問）")
    cells = ["2s", "2l", "3s", "3l"]
    for pc in PROD6:
        cls = Counter((scale_cell(r), read_class6(r["f6"], pc)) for r in rows)
        print(f"- 探す手間の上限 {pc}: " + "、".join(f"{sc} " + "/".join(str(cls[(sc, c)]) for c in ("E", "mE", "H1", "mH", "H2")) for sc in cells) + "（E/mE/H1/mH/H2）")
    cw = Counter((scale_cell(r), col_weight6(r["f6"])) for r in rows if read_class6(r["f6"], PROD6[0]) == "E")
    print("- E の1列の重さ（消える文字を除く）: " + "、".join(f"{sc} E1 {cw[(sc, 'E1')]}・E2 {cw[(sc, 'E2')]}・余白 {cw[(sc, None)]}" for sc in cells))
    print()
    print("| 案 | L3 の境の探す手間 | 場合分けの土台の探す手間 | 枝の手 | 分け方 | L1 | L2 | L3 | L4 | L5 | 5+5+4 の L4/L5 | 5+5+5 の L4/L5 |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for plan, pl in PLANS6.items():
        lv = Counter(level6(r, plan) for r in rows)
        def c2(cnd):
            rs = byc.get(cnd, [])
            cc = Counter(level6(r, plan) for r in rs)
            return f"{cc[4]}/{cc[5]}（{len(rs)}）"
        print(f"| {plan} | {pl['prod']} | {pl['split_prod'] or 'なし'} | {pl['k']} | {pl['rule']} | " + " | ".join(str(lv[L]) for L in range(1, 6)) + f" | {c2('5+5+4')} | {c2('5+5+5')} |")
    plan = args.plan
    if plan:
        print()
        print(f"### 案{plan}")
        for cnd in sorted(byc, key=lambda x: (len(x.split('+')), x)):
            rs = byc[cnd]
            cc = Counter(level6(r, plan) for r in rs)
            tt = [r.get("t_gen", 0.03) + sum(r["f6"].get("_t", {}).values()) for r in rs]
            print(f"| {cnd} | {len(rs)} | " + " | ".join(str(cc[L]) for L in range(1, 6)) + f" | {statistics.mean(tt):.3f} |")
        for L in range(1, 6):
            v = [r for r in rows if level6(r, plan) == L]
            if v:
                print(f"- L{L}: {len(v)} 問、文字 {p3([r['n'] for r in v])}、条件 {dict(Counter(cond_name(r) for r in v))}")
                for r in sorted(v, key=lambda r: r["seed"])[:3]:
                    sol = dict(zip(r["letters"], r["solution"]))
                    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
                    f = {k: v2 for k, v2 in r["f6"].items() if k != "_t"}
                    print(f"  - seed {r['seed']}（{cond_name(r)}） {' + '.join(r['addends'])} = {r['result']}（文字 {r['n']}・{f}・解 {num}）")



# ---------------------------------------------------------------- 版6 の判定（移植の対象）と供給の測り
# classify6 が、生成した1問のレベルを、採る案の読み手だけを安い順に当てて決める（実装が移す流れ）。
# fam6_of は案を比べるために、採らない選び方（探す手間24、枝の手14・22、二択の数え方）も一緒に測る。


def classify6(p: Puzzle, plan=ADOPTED_V6, timing=False) -> dict:
    """1問のレベル（1〜5、範囲外は None）を決める。読み手は安い順に当て、要らないものは測らない。
    順: Llo →（E なら NB6lo → NB6hi）→ Lhi → Clo{prod} → Chi → ChiA →（3l だけ）sPcN → sPN_{k}。
    sPcN（枝は閉包。sPN_k より強い読み手なので回数は sPN_k 以下）は、上限の回数を超える問題を早く外す前置き。"""
    pl = PLANS6[plan]
    prod, k = pl["prod"], pl["k"]
    r = {"k": p.k, "n": p.n, "lens": [len(w) for w in p.addends]}
    sc = scale_cell(r)
    f: dict = {}
    tt: dict = {}

    def run(name, fn):
        t0 = time.perf_counter()
        f[name] = fn()
        tt[name] = round(time.perf_counter() - t0, 4)
        return f[name]

    if run("Llo", lambda: _close_solved(p, L6_LO)) == 0:
        if sc in ("2s", "3s") and run("NB6lo", lambda: _nb6(p, NB6_LO)) == 1:
            run("NB6hi", lambda: _nb6(p, NB6_HI))
    elif run("Lhi", lambda: _close_solved(p, L6_HI)) == 1 and run(f"Clo{prod}", lambda: _close6(p, C6_LO, prod)) == 1:
        if run("Chi", lambda: _close_solved(p, C6_HI)) == 1 and run("ChiA", lambda: _chi6(p)) == 1 and sc == "3l":
            base = dict(C6_LO, r2_wl=2)
            if run("sPcN", lambda: seq6(Fam6Reader(p, **base), weak_allowed(p), kmax=SPLIT_CAP6, frontier_cap=300)) in range(1, SPLIT_CAP6 + 1):
                run(f"sPN_{k}", lambda: seq6(FactStep6Reader(p, step_k=k, whole=True, **base), weak_allowed(p), kmax=SPLIT_CAP6, frontier_cap=300))
    r["f6"] = f
    out = {"scaleCell": sc, "readClass": read_class6(f, prod) if "Lhi" in f or f["Llo"] == 0 else None, "scope": scope6(r, plan)[1],
           "cell": cell6(r, plan), "level": level6(r, plan), "f6": f}
    if timing:
        out["_t"] = tt
    return out


def _supply6_task(arg):
    cond_i, i, nr, plan = arg
    seed = SUPPLY5_SEED + cond_i * 100000 + i
    rng = random.Random(seed)
    t0 = time.perf_counter()
    for _ in range(400):
        g = generate(rng, CONDITIONS[cond_i], nr or n_range_for(CONDITIONS[cond_i]))
        if g is None:
            return {"cond": cond_i, "seed": seed, "status": "nogen", "t_gen": round(time.perf_counter() - t0, 4)}
        p, sol, _ = g
        if count_solutions(p, 2) == 1:
            break
    else:
        return {"cond": cond_i, "seed": seed, "status": "nounique", "t_gen": round(time.perf_counter() - t0, 4)}
    t_gen = round(time.perf_counter() - t0, 4)
    t1 = time.perf_counter()
    c = classify6(p, plan)
    return {"cond": cond_i, "lens": list(CONDITIONS[cond_i]), "i": i, "seed": seed, "addends": p.addends, "result": p.result,
            "letters": "".join(p.letters), "solution": "".join(str(sol[ch]) for ch in p.letters), "n": p.n, "k": p.k,
            "level": c["level"], "cell": c["cell"], "scope": c["scope"], "f6": c["f6"], "t_gen": t_gen, "t_cls": round(time.perf_counter() - t1, 4)}


def cmd_supply6(args):
    """採る案の判定（classify6）だけで標的生成を回し、条件ごとのレベルの収率と、1候補あたりの秒（生成＋判定）を出す。
    seed は版5 の供給（supply5）と同じ（同じ問題を作る）。--nrange を省くと条件ごとの既定の文字数（n_range_for）。"""
    nr = tuple(int(x) for x in args.nrange.split(",")) if args.nrange else None
    tasks = [(int(c), i, nr, args.plan) for c in args.conds.split(",") for i in range(args.start, args.start + args.per)]
    t0 = time.perf_counter()
    rows = []
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for res in pool.imap_unordered(_supply6_task, tasks, chunksize=2):
            rows.append(res)
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")
    wall = time.perf_counter() - t0
    print(f"{len(tasks)} 候補、{wall:.1f} 秒（{args.jobs} 並列）")
    print_supply6(rows)


def print_supply6(rows):
    """条件ごとのレベルの数と、範囲外の理由（scope6）の数、1候補の秒。"""
    outs = [x for x in SCOPES6 if x != "レベル"]
    print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | " + " | ".join(outs) + " | 一意解が作れない | 1候補の秒（生成＋判定）平均 | p95 |")
    print("|---" * (10 + len(outs)) + "|")
    for c in sorted({r["cond"] for r in rows}):
        rs = [r for r in rows if r["cond"] == c]
        cc = Counter(r.get("level") for r in rs)
        sc = Counter(r.get("scope") for r in rs)
        tt = sorted(r.get("t_gen", 0) + r.get("t_cls", 0) for r in rs)
        print(f"| {'+'.join(map(str, CONDITIONS[c]))} | {len(rs)} | " + " | ".join(str(cc[L]) for L in range(1, 6)) + " | "
              + " | ".join(str(sc[x]) for x in outs) + f" | {sum(1 for r in rs if 'status' in r)}"
              + f" | {statistics.mean(tt):.3f} | {tt[int(0.95 * (len(tt) - 1))]:.3f} |")


def cmd_supply6report(args):
    """supply6 の出力（jsonl。いくつでも）を合わせて、条件ごとのレベルと範囲外の理由を数え直す。"""
    rows = [r for p in args.rows for r in load(p)]
    for r in rows:  # 古い supply6 の行（lens・k・scope が無い）は、条件から補って決め直す。3l の行は回数の上限が今の案で測った行に限る
        if "f6" in r:
            r.setdefault("lens", list(CONDITIONS[r["cond"]]))
            r.setdefault("k", len(r["lens"]))
            r["level"], r["scope"] = scope6(r)
    print(f"{len(rows)} 候補")
    print_supply6(rows)


FIXED6_EXTRA = ["AVUCV+AVPPP+AAUG=TVPCVV", "NNYBU+JNNJU+WJBN=XBXUXN", "XXXGN+TPGTN+TXTA=GPAAYP", "NPAPP+JANJP+CCKJ=NNAJJD",
                   "HMHWM+KKWKK+VKWM=YMXMMV", "MPCM+NPWN+MMNW=CPNWM", "BTJB+JJVC+CCVT=JCTTC"]


def cmd_expected6(args):
    """移植の期待値（版6）: seed ごとの生成・一意性と、classify6 が当てた読み手の結果・組・段・レベル（採る案）。"""
    pl = PLANS6[ADOPTED_V6]
    out = {
        "version": 6,
        "generator": "digit-set-first v1",
        "seedBase": SEED_BASE,
        "seedRule": "seed = seedBase + cond * 100000 + i",
        "plan": ADOPTED_V6,
        "planParams": pl,
        "splitCap": SPLIT_CAP6,
        "cells": {f"{a}/{b}": L for (a, b), L in CELLS6.items()},
        "letters": LETTERS6,
        "readers": {"Llo": L6_LO, "Lhi": L6_HI, f"Clo{pl['prod']}": dict(C6_LO, pair_prod_cap=pl["prod"]), "Chi": C6_HI,
                    "ChiA": dict(C6_HI, reader="Alg6Reader"), "NB6lo": NB6_LO, "NB6hi": NB6_HI,
                    "sPcN": dict(C6_LO, r2_wl=2, split=f"seq6 weak_allowed kmax={SPLIT_CAP6} frontier_cap=300"),
                    f"sPN_{pl['k']}": dict(C6_LO, r2_wl=2, reader=f"FactStep6Reader step_k={pl['k']} whole=True",
                                            split=f"seq6 weak_allowed kmax={SPLIT_CAP6} frontier_cap=300")},
        "note": "Closure keys (Llo/Lhi/Clo*/Chi/ChiA/NB6*): 0 = solves without case analysis, 1 = stuck. "
        f"Split keys (sPcN/sPN_k): number of single-variable splits (binary and ternary both count 1) needed by the weak end; "
        f"{SPLIT_CAP6 + 1} = more than {SPLIT_CAP6} after exhausting {SPLIT_CAP6} splits, \"cap\" = the search frontier exceeded 300 "
        "before the last split (analysis cut off), null = the allowed splits make no progress. "
        "scope: レベル / 余白 (mE, mH, between E1 and E2) / 組み合わせ外 (scale and class not in cells) / 文字の数 / "
        "上限を超える (evaluable, needs more splits or longer branches than promised) / 評価不能 (sPcN null or any \"cap\"). "
        "Keys absent = not measured (classify6 stops at the first decisive reader)",
        "readClass": "E if Llo solves; mE if only Lhi does; H1 if Lhi is stuck and Clo<prod> solves; mH if Clo<prod> is stuck and Chi or ChiA "
        "solves; H2 otherwise",
        "conditions": ["+".join(map(str, c)) for c in CONDITIONS],
        "cases": [],
    }
    for c in range(len(CONDITIONS) - 1):
        for i in range(args.per):
            row = make_candidate((c, i))
            if "lens" not in row:
                out["cases"].append({"cond": c, "i": i, "seed": row["seed"], "status": row["status"]})
                continue
            e = {k: row[k] for k in ("seed", "addends", "result", "solution", "letters", "nonunique", "gen_tries")}
            out["cases"].append({"cond": c, "i": i} | e | classify6(puzzle_of(row)))
    fixed = []
    for src in FIXED5 + FIXED6_EXTRA:
        left, res = src.split("=")
        adds = left.split("+")
        p = Puzzle(adds, res)
        fixed.append({"addends": adds, "result": res, "solutions": count_solutions(p, 3)} | classify6(p))
    out["fixed"] = fixed
    with open(args.out, "w", encoding="utf-8") as fo:
        json.dump(out, fo, ensure_ascii=False, indent=1)
    print(f"wrote {len(out['cases'])} cases, {len(fixed)} fixed", file=sys.stderr)


def cmd_l2shift6(args):
    """版5 の L2（案K5n）が、消える文字を除いて数えた版6 で、どこへ移るか（資料 §3.2）。--f5 に版5 の行、--f6 に版6 の行。"""
    r5 = {r["seed"]: r for r in load_fam5(args.f5)}
    r6 = {r["seed"]: r for r in load_fam6(args.f6)}
    c, ex = Counter(), defaultdict(list)
    for s, r in r5.items():
        if level5(r, "K5n") != 2:
            continue
        if s not in r6:
            c["版6 の行が無い"] += 1
            continue
        g = r6[s]
        key = {"E1": "E1（作業量だけの差）", "E2": "E2（版6 の L2）", None: "余白"}[col_weight6(g["f6"])]
        c[key] += 1
        ex[key].append(" + ".join(r["addends"]) + " = " + r["result"])
    tot = sum(c.values())
    print(f"版5 の L2 {tot} 問の移り先")
    for k, v in c.items():
        print(f"- {k}: {v}（{100 * v / tot:.0f}%）。例 {'、'.join(ex[k][:3])}")
    sc = [g for g in r6.values() if scale_cell(g) == "3s"]
    e3 = Counter(col_weight6(g["f6"]) for g in sc if read_class6(g["f6"], PLANS6[ADOPTED_V6]["prod"]) == "E")
    print(f"- 3s の候補 {len(sc)}、そのうち E は E1 {e3['E1']}・E2 {e3['E2']}・余白 {e3[None]}")


def _naive6_task(r):
    p = Puzzle(r["addends"], r["result"])
    nv = [naive_trial(p, random.Random(r["seed"] * 7 + rep), 2000) for rep in range(3)]
    return {"seed": r["seed"], "level": r["level"], "n": p.n, "naive": [x["placements"] if x["solved"] else None for x in nv]}


def cmd_naive6(args):
    """素朴な解き方（naive_trial。補助ありの試し置き。3回、上限2000回の置き）を、版6 のレベルごとに当てる（資料 §4.1）。
    行は supply6 の出力（レベルは scope6 で今の案から決め直す）。置いた数は、試し置きと答えの書き込みの合計。"""
    rows = [r for p in args.rows for r in load(p) if "f6" in r]
    for r in rows:
        r.setdefault("lens", list(CONDITIONS[r["cond"]]))
        r.setdefault("k", len(r["lens"]))
        r["level"] = scope6(r)[0]
    sel = [r for r in rows if r["level"] is not None]
    with Pool(args.jobs) as pool:
        res = list(pool.imap_unordered(_naive6_task, sel, chunksize=8))
    print("| L | 問題 | 試し | 置いた数 p10/p50/p90（2000 を超えたら 2000 とする） | 置いた数/文字 p50 | 20×文字以内 | 10×文字以内 | 2000回以内 | 3回とも20×文字以内の問題 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for L in range(1, 6):
        rs = [x for x in res if x["level"] == L]
        if not rs:
            continue
        trials = [(v, x["n"]) for x in rs for v in x["naive"]]
        vals = sorted(2000 if v is None else v for v, _ in trials)
        q = lambda a: vals[int(a * (len(vals) - 1))]  # noqa: E731
        per = statistics.median((2000 if v is None else v) / n for v, n in trials)
        w20 = sum(1 for v, n in trials if v is not None and v <= 20 * n) / len(trials)
        w10 = sum(1 for v, n in trials if v is not None and v <= 10 * n) / len(trials)
        w2k = sum(1 for v, _ in trials if v is not None) / len(trials)
        all20 = sum(1 for x in rs if all(v is not None and v <= 20 * x["n"] for v in x["naive"])) / len(rs)
        print(f"| L{L} | {len(rs)} | {len(trials)} | {q(0.1)}/{q(0.5)}/{q(0.9)} | {per:.1f} | {100 * w20:.0f}% | {100 * w10:.0f}% | {100 * w2k:.0f}% | {100 * all20:.0f}% |")


KSWEEP6_EXAMPLES = ["GVANK+FFFGB+VWNN=BGAVKB", "DBRPR+UTTDR+UDDP=DDUURJ", "MKCXE+MFCXE+KXXF=YCXMCM", "KBBKC+EAWKB+WWKT=AACEBC",
                    "XXUUC+DXWGX+FXUE=FUEGWD", "GPMEM+GMPXG+XKXK=ECKMPP", "XGNTD+FGDTE+NKTF=XEHFGK", "WJWTT+JJCJF+JCDN=DFJNCD",
                    "AHGJL+HXJJJ+LRNL=RXAXGR"]


def _ksweep6_task(arg):
    src, ks, kmax = arg
    left, res = src.split("=")
    p = Puzzle(left.split("+"), res)
    base = dict(C6_LO, r2_wl=2)
    out = [seq6(FactStep6Reader(p, step_k=k, whole=True, **base), weak_allowed(p), kmax=kmax, frontier_cap=300) for k in ks]
    out.append(seq6(Fam6Reader(p, **base), weak_allowed(p), kmax=kmax, frontier_cap=300))
    return src, out


def cmd_ksweep6(args):
    """F1 が手で追った例の、枝の手 k ごとの場合分けの回数（資料 §3.3。k を決めた表）。最後の列は枝を閉包で読む人。
    値: 回数、kmax+1＝kmax 回を超える、None＝進まない、"cap"＝探す盤面が上限を超えた。"""
    ks = [int(x) for x in args.ks.split(",")]
    ex = args.examples or KSWEEP6_EXAMPLES
    print("| 問題 | " + " | ".join(f"k={k}" for k in ks) + " | 枝を閉包で読む人 |")
    print("|---" * (len(ks) + 2) + "|")
    with Pool(args.jobs) as pool:
        for src, out in pool.imap(_ksweep6_task, [(s, ks, args.kmax) for s in ex]):
            print(f"| {src} | " + " | ".join(str(v) for v in out) + " |")


# ---------------------------------------------------------------- 版6 の一度だけの当て直し（A4・F1（版5）の行）
# 同じ読み方を、その読みを持つ端の読み手の全員に一緒に当てる。弱める解釈は下の端（Llo・Clo・場合分けの読み手・NB6lo）を、
# 強める解釈は上の端（Lhi・NB6hi・強い端）を差し替え、分類済みの問題が範囲外へ出る数と、別のレベルへ移る数を数える。


def _re6_close(p, kw, cls=None, prod=None):
    cls = cls or Fam6Reader
    rd = cls(p, pair_prod_cap=prod, **kw) if cls is Fam6Reader else cls(p, **kw)
    st, dom = rd.close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1


def _re6_nb(p, kw):
    st, dom = NoBounds6Reader(p, **kw).close(p.initial_domains())
    return 0 if st != CONTRA and _solved(p, dom) else 1


def _re6_seq_weak(p, k, **over):
    rd = FactStep6Reader(p, step_k=k, whole=True, **dict(C6_LO, r2_wl=2, **over))
    return seq6(rd, weak_allowed(p), kmax=3, frontier_cap=300)


def _re6_task(r):
    p = puzzle_of(r)
    L = level6(r, ADOPTED_V6)
    out = {}
    if L in (1, 2):
        out["noad"] = _close_solved(p, dict(L6_LO, noad=True))
        out["bnd"] = _close_solved(p, dict(L6_LO, col_tcap=None))
        out["t2"] = _close_solved(p, dict(L6_LO, col_tcap=2))
        out["nb20"] = _re6_nb(p, dict(NB6_HI, col_tcap=20))
        out["nb30"] = _re6_nb(p, dict(NB6_HI, col_tcap=30))
        out["nblo2"] = _re6_nb(p, dict(NB6_LO, col_tcap=2))
    if L == 3:
        out["j6"] = _re6_close(p, dict(C6_LO, pair_cap=6), prod=PLANS6[ADOPTED_V6]["prod"])
        out["t2c"] = _re6_close(p, dict(C6_LO, col_tcap=2), prod=PLANS6[ADOPTED_V6]["prod"])
        out["p24"] = _re6_close(p, C6_LO, prod=24)
        out["lhifl1"] = _close_solved(p, dict(L6_HI, fl_depth=1, fl_wl=3))
        out["lhipair"] = _close_solved(p, dict(L6_HI, pair_cap=8, pair_mode="joined"))
    if L in (3, 4, 5):  # 1列ずつしか読まない人（2列をまとめない）に約束する（実装前提調査 D-07 の比べた案）
        out["lone"] = seq6(FactStep6Reader(p, step_k=PLANS6[ADOPTED_V6]["k"], whole=True, **dict(L6_LO, r2_wl=2)), weak_allowed(p),
                           kmax=SPLIT_CAP6, frontier_cap=300)
    if L in (4, 5):
        out["k14"] = r["f6"].get("sPN_14")
        out["k10"] = _re6_seq_weak(p, 10)
        out["k22"] = r["f6"].get("sPN_22")
        out["nogrp"] = _re6_seq_weak(p, PLANS6[ADOPTED_V6]["k"], pair_cap=None)
        out["t2s"] = _re6_seq_weak(p, PLANS6[ADOPTED_V6]["k"], col_tcap=2)
        out["chi_w3_50"] = _re6_close(p, dict(C6_HI, win3_cap=50), cls=Alg6Reader)
        out["chi_fl2"] = _re6_close(p, dict(C6_HI, fl_depth=2, fl_wl=3), cls=Alg6Reader)
        out["chi_fl1"] = _re6_close(p, dict(C6_HI, fl_depth=1, fl_wl=3), cls=Alg6Reader)
    return {"seed": r["seed"], "re": out}


def cmd_recheck6_measure(args):
    rows = load_fam6(args.fam)
    sel = [r for r in rows if level6(r, ADOPTED_V6) is not None]
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for res in pool.imap_unordered(_re6_task, sel, chunksize=2):
            fo.write(json.dumps(res) + "\n")
    print(len(sel), file=sys.stderr)


def cmd_recheck6_report(args):
    rows = {r["seed"]: r for r in load_fam6(args.fam)}
    re = {}
    for line in open(args.re, encoding="utf-8"):
        d = json.loads(line)
        re[d["seed"]] = d["re"]
    sup5 = {}
    for path in [x for x in args.sup5.split(",") if x]:
        for line in open(path, encoding="utf-8"):
            d = json.loads(line)
            if "f5" in d:
                sup5[d["seed"]] = d["f5"]
    k = PLANS6[ADOPTED_V6]["k"]
    # (名前, 自然さ, 当てる行のレベル, 範囲外へ出るか（と、移る先）を返す関数)

    def weak_count_rule(val, L0):
        if val not in range(1, SPLIT_CAP6 + 1):
            return None
        return 4 if val == 1 else 5

    items = [
        ("1列の中の違う数字を使わない（Llo）", "低", (1, 2), lambda r, x: None if x["noad"] else "same"),
        ("いつも和の大きさだけで読む（Llo）", "低〜中", (1, 2), lambda r, x: None if x["bnd"] else "same"),
        ("1列の書き出しを組2まで（Llo）", "中", (1, 2), lambda r, x: None if x["t2"] else "same"),
        ("書き出しの少ない列を組2までとみる（NB6lo）", "中", (1,), lambda r, x: None if x["nblo2"] else "same"),
        ("書き出しの多い列を組20より多いとみる（NB6hi）", "低〜中", (2,), lambda r, x: None if x["nb20"] == 0 else "same"),
        ("同 組30（NB6hi）", "低", (2,), lambda r, x: None if x["nb30"] == 0 else "same"),
        ("2列をまとめる上限をつないだ組6に（Clo）", "中", (3,), lambda r, x: None if x["j6"] else "same"),
        ("1列の書き出しを組2まで（Clo）", "中", (3,), lambda r, x: None if x["t2c"] else "same"),
        ("探す手間の上限を24に（Clo）", "中", (3,), lambda r, x: None if x["p24"] else "same"),
        ("1列ずつの読みにも1手の先読み（Lhi。線）", "中", (3,), lambda r, x: None if x["lhifl1"] == 0 else "same"),
        ("1列ずつの読みにも2列（Lhi。線）", "中", (3,), lambda r, x: None if x["lhipair"] == 0 else "same"),
        ("1列ずつしか読まない人に約束する（2列をまとめず、枝は18手・2回まで）", "中", (3, 4, 5),
         lambda r, x: None if x["lone"] not in range(1, SPLIT_CAP6 + 1) else "same"),
        ("枝を人の手14まで（場合分けの弱い端）", "中〜高", (4, 5), lambda r, x: weak_count_rule(x["k14"], None)),
        ("枝を人の手10まで", "中", (4, 5), lambda r, x: weak_count_rule(x["k10"], None)),
        ("枝の中で2列をまとめない", "低〜中", (4, 5), lambda r, x: weak_count_rule(x["nogrp"], None)),
        ("1列の書き出しを組2まで（場合分けの弱い端）", "中", (4, 5), lambda r, x: weak_count_rule(x["t2s"], None)),
        ("三択を二択より重く数える（三択は2回。A4 C3 の逆）", "中", (4,), lambda r, x: "same" if r["f6"].get(_sp_key(None, k, "b")) == 1 else 5),
        ("枝を同時に読む2段で切る人を戻す（A4 A1。版5 の Pr2）", "低〜中", (4, 5),
         lambda r, x: "skip" if r["seed"] not in sup5 else (None if sup5[r["seed"]].get("Pr2", ["deep"])[0] not in (0, 1, 2) else "same")),
        ("強い端が3列（組50）も読む", "低〜中", (4, 5), lambda r, x: None if x["chi_w3_50"] == 0 else "same"),
        ("強い端が1手の先読みを読みに数える（線）", "中", (4, 5), lambda r, x: None if x["chi_fl1"] == 0 else "same"),
        ("強い端が2手の先読みを読みに数える（版4 の線）", "中", (4, 5), lambda r, x: None if x["chi_fl2"] == 0 else "same"),
    ]
    print("| 解釈 | 自然さ | 当てたレベル | 測った問題 | 範囲外へ | 別のレベルへ | レベルごと |")
    print("|---|---|---|---|---|---|---|")
    for name, nat, levels, fn in items:
        tot = out = mv = 0
        byL, totL, outL = Counter(), Counter(), Counter()
        for seed, x in re.items():
            r = rows.get(seed)
            if r is None:
                continue
            L0 = level6(r, ADOPTED_V6)
            if L0 not in levels:
                continue
            try:
                res = fn(r, x)
            except KeyError:
                continue
            if res == "skip":
                continue
            tot += 1
            totL[L0] += 1
            if res == "same" or res == L0:
                continue
            byL[L0] += 1
            if res is None:
                outL[L0] += 1
                out += 1
            else:
                mv += 1
        detail = "、".join(f"L{L} {byL[L]}/{totL[L]}（{100 * byL[L] / totL[L]:.0f}%。範囲外 {outL[L]}・移る {byL[L] - outL[L]}）"
                           for L in sorted(totL) if byL[L]) or "—"
        print(f"| {name} | {nat} | {'・'.join(f'L{L}' for L in levels)} | {tot} | {out} | {mv} | {detail} |")




KEEP5 = ("cond", "lens", "i", "seed", "addends", "result", "letters", "solution", "n", "k", "naive", "nonunique", "t_gen")


def _fam5_task(arg):
    row, extra, base = arg
    p = puzzle_of(row)
    t0 = time.perf_counter()
    f = fam5_of(p, timing=True, extra=extra, base=base)
    keep = {k: row[k] for k in KEEP5 if k in row}
    keep["f5"] = f
    keep["t_f5"] = round(time.perf_counter() - t0, 3)
    return keep


def cmd_family5(args):
    rows = [r for p in args.corpus for r in load(p) if "lens" in r and r["k"] <= 3]
    seen, uniq = set(), []
    for r in rows:
        if r["seed"] not in seen:
            seen.add(r["seed"])
            uniq.append(r)
    if args.only:
        keep = {json.loads(line)["seed"] for line in open(args.only, encoding="utf-8")}
        uniq = [r for r in uniq if r["seed"] in keep]
    groups = {"x": [k for k in FAM5_VARIANTS if k.startswith("X_")], "o": [k for k in FAM5_VARIANTS if k.startswith("O_")]}
    extra = groups[args.variants] if args.variants in groups else [x for x in args.variants.split(",") if x]
    uniq.sort(key=lambda r: -sum(r["lens"]))
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for i, res in enumerate(pool.imap_unordered(_fam5_task, [(r, extra, not args.extra_only) for r in uniq], chunksize=2)):
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")
            if i % 500 == 0:
                print(i, f"{time.perf_counter() - t0:.0f}s", file=sys.stderr, flush=True)
    print(f"{len(uniq)} rows, {time.perf_counter() - t0:.1f}s", file=sys.stderr)


SUPPLY5_SEED = SEED_BASE + 8_000_000  # 版5 の供給の測り（supply5）の seed: SUPPLY5_SEED + 条件番号 × 100000 + i


def _supply5_task(arg):
    cond_i, i, nr = arg
    seed = SUPPLY5_SEED + cond_i * 100000 + i
    rng = random.Random(seed)
    t0 = time.perf_counter()
    nonunique = 0
    for _ in range(400):
        g = generate(rng, CONDITIONS[cond_i], nr)
        if g is None:
            return {"seed": seed, "status": "nogen"}
        p, sol, _ = g
        if count_solutions(p, 2) == 1:
            break
        nonunique += 1
    else:
        return {"seed": seed, "status": "nounique"}
    t_gen = round(time.perf_counter() - t0, 4)
    t1 = time.perf_counter()
    f = fam5_of(p, timing=True)
    return {"cond": cond_i, "lens": list(CONDITIONS[cond_i]), "i": i, "seed": seed, "addends": p.addends, "result": p.result,
            "letters": "".join(p.letters), "solution": "".join(str(sol[ch]) for ch in p.letters), "n": p.n, "k": p.k,
            "nonunique": nonunique, "t_gen": t_gen, "f5": f, "t_f5": round(time.perf_counter() - t1, 3)}


def cmd_supply5(args):
    nr = tuple(int(x) for x in args.nrange.split(","))
    tasks = [(int(c), i, nr) for c in args.conds.split(",") for i in range(args.start, args.start + args.per)]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for res in pool.imap_unordered(_supply5_task, tasks, chunksize=4):
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")
    print(f"{len(tasks)} tasks, {time.perf_counter() - t0:.1f}s, jobs={args.jobs}", file=sys.stderr)


def load_fam5(paths):
    by = {}
    for p in paths:
        for r in load(p):
            if "f5" not in r:
                continue
            if r["seed"] in by:
                old = by[r["seed"]]["f5"]
                t = dict(old.get("_t", {}))
                t.update(r["f5"].get("_t", {}))
                old.update(r["f5"])
                old["_t"] = t
            else:
                by[r["seed"]] = r
    return [r for r in by.values() if "Llo" in r["f5"]]



def _v5(f, key):
    return f.get(key)


def cmd_plans5(args):
    rows = load_fam5(args.fam)
    cells = ["2s", "2l", "3s", "3l"]
    print(f"## 版5（{len(rows)} 問）")
    print()
    print("### 読みの組 × 規模（提供範囲を見る前）")
    names = ["E", "mE", "H1", "mH", "H2"]
    cls = Counter((scale_cell(r), read_class5(r["f5"])) for r in rows)
    print("| 規模 | " + " | ".join(names) + " |")
    print("|---|" + "---|" * len(names))
    for sc in cells:
        print(f"| {sc} | " + " | ".join(str(cls[(sc, c)]) for c in names) + " |")
    print()
    print("### E の中の1列の重さ（E1: 組4より多い列を読まずに解ける／E2: 組12より多い列を読まなければ解けない／余白）")
    cw = Counter((scale_cell(r), col_weight5(r["f5"])) for r in rows if read_class5(r["f5"]) == "E")
    for sc in cells:
        print(f"- {sc}: E1 {cw[(sc, 'E1')]}・E2 {cw[(sc, 'E2')]}・余白 {cw[(sc, None)]}")
    print()
    print("### H2 の提供範囲（三択までの場合分けで解ける数）")
    for sc in cells:
        v = [r["f5"] for r in rows if scale_cell(r) == sc and read_class5(r["f5"]) == "H2"]
        if not v:
            continue
        g = lambda k: sum(1 for f in v if f.get(k, ["deep"])[0] in (0, 1, 2))
        both = lambda k: sum(1 for f in v if f.get(k, ["deep"])[0] in (0, 1, 2) and f.get("Pr2", ["deep"])[0] in (0, 1, 2))
        print(f"- {sc}: H2 {len(v)}、同時2段 {g('Pr2')}、人の手3手 {g('Ps3')}・4手 {g('Ps4')}・5手 {g('Ps5')}、"
              f"同時2段と4手の両方 {both('Ps4')}・5手の両方 {both('Ps5')}")
    for plan in PLANS5:
        pl = PLANS5[plan]
        print()
        print(f"### 案{plan}（枝 {pl['k']} 手、同時2段の弱い端 {'あり' if pl['r2'] else 'なし'}、L2 を E2 に {'寄せる' if pl['e2'] else '寄せない'}）")
        cc = Counter((scale_cell(r), cell5(r, plan)) for r in rows)
        print("規模 × 段: " + "、".join(f"{a}・{b}: {n}" for (a, b), n in sorted(cc.items(), key=lambda x: (str(x[0][0]), str(x[0][1]))) if b))
        lv = Counter(level5(r, plan) for r in rows)
        print("レベル: " + "、".join(f"L{L} {lv[L]}" for L in range(1, 6)) + f"、外 {lv[None]}")
        byc = defaultdict(list)
        for r in rows:
            byc[cond_name(r)].append(r)
        print("| 条件 | 候補 | L1 | L2 | L3 | L4 | L5 | 分類の秒 平均/p95 |")
        print("|---|---|---|---|---|---|---|---|")
        for cnd in sorted(byc, key=lambda x: (len(x.split("+")), x)):
            rs = byc[cnd]
            cnt = Counter(level5(r, plan) for r in rs)
            tt = [sum(r["f5"].get("_t", {}).values()) for r in rs]
            print(f"| {cnd} | {len(rs)} | " + " | ".join(str(cnt[L]) for L in range(1, 6)) + f" | {statistics.mean(tt):.2f}/{_fmt(pct(tt, .95))} |")
        for L in range(1, 6):
            v = [r for r in rows if level5(r, plan) == L]
            if v:
                print(f"- L{L}: {len(v)} 問、文字 {p3([r['n'] for r in v])}、条件 {dict(Counter(cond_name(r) for r in v))}")
                for r in sorted(v, key=lambda r: r["seed"])[:3]:
                    print(f"  - 例: {_show5(r)}")


def _show5(r):
    sol = dict(zip(r["letters"], r["solution"]))
    num = " + ".join("".join(sol[c] for c in w) for w in r["addends"]) + " = " + "".join(sol[c] for c in r["result"])
    f = r["f5"]
    keys = [k for k in ("Llo", "Lhi", "Clo", "NBlo", "NBhi", "Chi", "Pr2", "Ps4", "Ps5", "seqChi", "seqPr2", "seqPs4", "seqPs5") if k in f]
    return f"seed {r['seed']}（{cond_name(r)}） {' + '.join(r['addends'])} = {r['result']}（文字 {r['n']}・" + "・".join(f"{k} {f[k]}" for k in keys) + f"・解 {num}）"


# 族の外の解釈を、その読みを持つ端の全員に一緒に当てる（版5）。{f5 の鍵: 差し替える鍵}。
JOINT5 = [
    ("場合分けの枝を人の手で1手短く（5手→4手）", "中〜高", {"Ps5": "Ps4", "seqPs5": "seqPs4"}, ("K5", "K5n")),
    ("場合分けの枝を人の手で2手短く（5手→3手）", "中", {"Ps5": "Ps3", "seqPs5": "seqPs3"}, ("K5", "K5n")),
    ("場合分けの枝を同時に読む1段で打ち切る（2段の人をさらに弱める）", "中", {"Pr2": "X_r1", "seqPr2": "X_seq_r1"}, ("K5",)),
    ("1列の中の違う数字を使わない（1列ずつの弱い端）", "低", {"Llo": "X_noad_Llo"}, ("K5", "K5n")),
    ("決まっていない文字が3つ以上の列は、いつも和の大きさだけで読む", "低〜中", {"Llo": "X_bnd_Llo"}, ("K5", "K5n")),
    ("1列の書き出しの上限を組2に（1列ずつ・まとめるの弱い端）", "中", {"Llo": "X_t2_Llo", "Clo": "X_t2_Clo"}, ("K5", "K5n")),
    ("2列をまとめる上限をつないだ組6に", "中", {"Clo": "X_j6_Clo"}, ("K5", "K5n")),
    ("3列（組50）も関係式の持ち回りとして読みに数える", "低〜中", {"Chi": "X_w3_50", "seqChi": "X_seq_w3_50"}, ("K5", "K5n")),
    ("1手の先読みを読みに数える（強い端）", "中", {"Chi": "X_fl1", "seqChi": "X_seq_fl1"}, ("K5", "K5n")),
    ("2手の先読みを読みに数える（強い端。版4 の線）", "中", {"Chi": "X_fl2", "seqChi": "X_seq_fl2"}, ("K5", "K5n")),
    ("1列ずつの読みにも1手の先読み", "中", {"Lhi": "X_fl1_Lhi"}, ("K5", "K5n")),
    ("1列ずつの読みにも2列（つないだ組8）", "中", {"Lhi": "X_pair_Lhi"}, ("K5", "K5n")),
    ("まとめる読みの人のうち、2列を使わない人（1列ずつと同じ）", "低〜中", {"Clo": "X_p0_Clo"}, ("K5", "K5n")),
]


def cmd_joint5(args):
    rows = load_fam5(args.fam)
    print("| 案 | 解釈（同じ読み方を、その読みを持つ端の全員に） | 自然さ | 測れた分類済み | 別のレベルへ | 範囲外へ | 最も動くレベル | 範囲外から入る |")
    print("|---|---|---|---|---|---|---|---|")
    for name, nat, mp, plans in JOINT5:
        for plan in plans:
            tot = mv = out = inflow = 0
            byL, totL, inL = Counter(), Counter(), Counter()
            for r in rows:
                f = r["f5"]
                g = dict(f)
                ok = True
                for a, b in mp.items():
                    if a in f and b not in f:
                        ok = False
                        break
                    if b in f:
                        g[a] = f[b]
                if not ok:
                    continue
                if "Chi" in mp and g.get("Chi") == 1 and "Pr2" not in f:
                    continue  # 強い端を強めても止まる行は、弱い端を測っていない（強める解釈は入らない向き）
                L0 = level5(r, plan)
                L1 = level5(r, plan, f=g)
                if L0 is None:
                    if L1 is not None:
                        inflow += 1
                        inL[L1] += 1
                    continue
                tot += 1
                totL[L0] += 1
                if L1 != L0:
                    byL[L0] += 1
                    if L1 is None:
                        out += 1
                    else:
                        mv += 1
            worst = "、".join(f"L{L} {byL[L]}/{totL[L]}" for L in sorted(totL) if byL[L]) or "—"
            ins = "、".join(f"L{L} {inL[L]}" for L in sorted(inL)) or "0"
            print(f"| {plan} | {name} | {nat} | {tot} | {mv} | {out} | {worst} | {ins} |")



FIXED5 = ["SEND+MORE=MONEY", "EG+GG=EAC", "WFX+TFM=CMMW", "DUU+HXU=HMHD", "BYK+KTK=TKHH", "NLU+BDL+BDD=BLNB", "GGGN+LYMM+NKY=KNFGN",
          "LFL+KFG+FKF=LLEK", "GXD+GGP+DXX=PDDT", "BGJL+BBLG+JGJ=JAJL", "CWE+CEE+WFC=EPW", "YTHF+FTFX+CTR=CRRYF",
          "HXAAX+DHWBW+AXADB=GGGWWW", "PTEAY+PCDTE+DNDG=ECYEAJ", "GVANK+FFFGB+VWNN=BGAVKB", "WJWTT+JJCJF+JCDN=DFJNCD",
          "PNAAG+RFVAA+GRGV=GVLNLR", "RJJVD+RDVHH+LHRV=HLTLTT", "AANXN+UUHAP+HNAX=PRNRNN", "XXUUC+DXWGX+FXUE=FUEGWD",
          "GPMEM+GMPXG+XKXK=ECKMPP", "XGNTD+FGDTE+NKTF=XEHFGK", "AHGJL+HXJJJ+LRNL=RXAXGR", "GKHWJ+GYXKX+LCLKX=GHUHKC",
          "NNV+UFN+NTT=NFVT", "NHW+NGN+GWG=NTWG", "DBRPR+UTTDR+UDDP=DDUURJ", "MKCXE+MFCXE+KXXF=YCXMCM", "KBBKC+EAWKB+WWKT=AACEBC"]


def cmd_expected5(args):
    """移植の期待値（版5。記録）: seed ごとの生成・一意性と、族の端の読み手の結果、読みの組・段・案ごとのレベル。"""
    out = {
        "version": 5,
        "generator": "digit-set-first v1",
        "seedBase": SEED_BASE,
        "seedRule": "seed = seedBase + cond * 100000 + i",
        "plan": ADOPTED_V5,
        "plans": PLANS5,
        "cells": {f"{a}/{b}": L for (a, b), L in CELLS5.items()},
        "letters": LETTERS5,
        "readers": {"Llo": L5_LO, "Lhi": L5_HI, "Clo": C5_LO, "Chi": C5_HI, "NBlo": NB5_LO, "NBhi": NB5_HI,
                    "Pr2": P5_R2, "Ps<k>": dict(P5_STEP, step_k="k (human steps; StepProbe5Reader)")},
        "note": "Llo/Lhi/Clo/Chi/NBlo/NBhi: 0 = solves without case analysis, 1 = stuck (NB* never reads columns with more tuples than "
        "col_tcap). Pr2/Ps<k>: case-analysis tier [R, waves(, cap hits)]. seq*: number of single-variable binary splits needed "
        "(0, 1, 2 = more than one, null = binary splits make no progress). Keys absent = not needed (cascade stopped)",
        "readClass": "E if Llo solves; mE if only Lhi does; H1 if Lhi is stuck and Clo solves; mH if Clo is stuck and Chi solves; H2 otherwise",
        "conditions": ["+".join(map(str, c)) for c in CONDITIONS],
        "cases": [],
    }

    def entry(r2):
        f = r2["f5"]
        return {"f5": f, "scaleCell": scale_cell(r2), "readClass": read_class5(f), "colWeight": col_weight5(f) if read_class5(f) == "E" else None,
                "cell": {pl: cell5(r2, pl) for pl in PLANS5}, "level": {pl: level5(r2, pl) for pl in PLANS5}}

    for c in range(len(CONDITIONS) - 1):
        for i in range(args.per):
            row = make_candidate((c, i))
            if "lens" not in row:
                out["cases"].append({"cond": c, "i": i, "seed": row["seed"], "status": row["status"]})
                continue
            r2 = dict(row)
            r2["f5"] = fam5_of(puzzle_of(row))
            e = {k: row[k] for k in ("seed", "addends", "result", "solution", "letters", "nonunique", "gen_tries")}
            out["cases"].append({"cond": c, "i": i} | e | entry(r2))
    fixed = []
    for src in FIXED5:
        left, res = src.split("=")
        adds = left.split("+")
        p = Puzzle(adds, res)
        r2 = {"k": p.k, "n": p.n, "lens": [len(w) for w in adds], "f5": fam5_of(p)}
        fixed.append({"addends": adds, "result": res, "solutions": count_solutions(p, 3)} | entry(r2))
    out["fixed"] = fixed
    with open(args.out, "w", encoding="utf-8") as fo:
        json.dump(out, fo, ensure_ascii=False, indent=1)
    print(f"wrote {len(out['cases'])} cases", file=sys.stderr)



# 比べる選択肢（L4・L5 が細ったときの）。(名前, 案, {f5 の鍵: 差し替える鍵})。差し替える鍵が無い行（H2 でない行）は元のまま。
OPT5 = [
    ("族の和どおり（案K5）", "K5", {}),
    ("同時に読む2段の弱い端を外す（案K5n）", "K5n", {}),
    ("K5n に加え、弱い端の1列・2列の上限を組12に戻す", "K5n", {"Ps5": "O_Ps5c12", "seqPs5": "O_seqPs5c12"}),
    ("K5 に加え、弱い端の2人とも上限を組12に戻す", "K5", {"Ps5": "O_Ps5c12", "seqPs5": "O_seqPs5c12", "Pr2": "O_Pr2c12", "seqPr2": "O_seqPr2c12"}),
    ("K5n に加え、枝を人の手で8手まで約束する", "K5n", {"Ps5": "O_Ps8", "seqPs5": "O_seqPs8"}),
    ("K5n に加え、枝を最後まで追う人に約束する", "K5n", {"Ps5": "O_Pinf", "seqPs5": "O_seqPinf"}),
]


def cmd_options5(args):
    rows = load_fam5(args.fam)
    byc = defaultdict(list)
    for r in rows:
        byc[cond_name(r)].append(r)
    print("| 選択肢 | 条件 | 候補 | L3 | L4 | L5 | L4 の収率 | L5 の収率 | 500問に要る候補（L4・L5 の多い方） | 1候補の秒（生成＋分類） |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for name, plan, mp in OPT5:
        for cnd in ("5+5+4", "5+5+5"):
            rs = byc.get(cnd, [])
            if not rs:
                continue
            cnt = Counter()
            for r in rs:
                g = dict(r["f5"])
                for a, b in mp.items():
                    if b in r["f5"]:
                        g[a] = r["f5"][b]
                cnt[level5(r, plan, f=g)] += 1
            n = len(rs)
            y4, y5 = cnt[4] / n, cnt[5] / n
            need = max(500 / y4 if y4 else float("inf"), 500 / y5 if y5 else float("inf"))
            sec = statistics.mean(r.get("t_gen", 0.03) + sum(v for k, v in r["f5"].get("_t", {}).items() if not k.startswith(("O_", "X_"))) for r in rs)
            print(f"| {name} | {cnd} | {n} | {cnt[3]} | {cnt[4]} | {cnt[5]} | {y4:.4f} | {y5:.4f} | {need:.0f} | {sec:.2f} |")


def _fam4_task(arg):
    row, extra, base = arg
    p = puzzle_of(row)
    t0 = time.perf_counter()
    f = fam4_of(p, extra, timing=True, base=base)
    keep = {k: row[k] for k in ("cond", "lens", "i", "seed", "addends", "result", "letters", "solution", "n", "k", "naive", "naive_back") if k in row}
    keep["f4"] = f
    keep["heavy0"] = max(len(Closure(p).col_tuples(j, p.initial_domains())[1]) for j in range(p.R))
    keep["t_f4"] = round(time.perf_counter() - t0, 3)
    return keep


SUPPLY4_SEED = SEED_BASE + 7_000_000  # 供給の測り（supply4）の seed: SUPPLY4_SEED + 条件番号 × 100000 + i


def _supply4_task(arg):
    """供給の測り: 一意解の候補を1つ作り、上のレベルに要る読み手だけを安い順に当てる（途中で外れたら止める）。"""
    cond_i, i, nr = arg
    seed = SUPPLY4_SEED + cond_i * 100000 + i
    rng = random.Random(seed)
    t0 = time.perf_counter()
    nonunique = 0
    for _ in range(400):
        g = generate(rng, CONDITIONS[cond_i], nr)
        if g is None:
            return {"seed": seed, "status": "nogen"}
        p, sol, _ = g
        if count_solutions(p, 2) == 1:
            break
        nonunique += 1
    else:
        return {"seed": seed, "status": "nounique"}
    t_gen = time.perf_counter() - t0
    f: dict = {}
    tt: dict = {}

    def run(name, fn):
        t1 = time.perf_counter()
        f[name] = fn()
        tt[name] = round(time.perf_counter() - t1, 4)

    for nm in ("Llo", "Lhi", "Clo"):
        run(nm, lambda nm=nm: _close_solved(p, READERS4[nm]))
    if f["Clo"] == 0:
        # まとめる読みの弱い端が場合分けなしで解けるなら、それを土台にした場合分けの読み手も場合分けなしで解ける（導出）
        for nm in ("P_cloInf", "P_clo5", "P_clo3"):
            f[nm] = [0, 0]
    else:
        for nm in ("P_cloInf", "P_clo5", "P_clo3"):
            def tier(nm=nm):
                t = Fam4Reader(p, **FAM4_VARIANTS[nm][1]).tier()
                return [t["R"], t.get("waves")]
            run(nm, tier)
        if f["P_cloInf"][0] in (0, 1, 2):
            def ct():
                t = Fam4Reader(p, **FAM4_VARIANTS["C_T"][1]).tier()
                return [t["R"], t.get("waves")]
            run("C_T", ct)
    f["_t"] = tt
    return {"cond": cond_i, "lens": list(CONDITIONS[cond_i]), "i": i, "seed": seed, "addends": p.addends, "result": p.result,
            "letters": "".join(p.letters), "solution": "".join(str(sol[ch]) for ch in p.letters), "n": p.n, "k": p.k,
            "nonunique": nonunique, "t_gen": round(t_gen, 4), "f4": f, "naive": [None], "heavy0": 0}


def cmd_supply4(args):
    nr = tuple(int(x) for x in args.nrange.split(","))
    tasks = [(int(c), i, nr) for c in args.conds.split(",") for i in range(args.start, args.start + args.per)]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as fo:
        for res in pool.imap_unordered(_supply4_task, tasks, chunksize=4):
            fo.write(json.dumps(res, ensure_ascii=False) + "\n")
    print(f"{len(tasks)} tasks, {time.perf_counter() - t0:.1f}s, jobs={args.jobs}", file=sys.stderr)


def cmd_family4(args):
    rows = [r for p in args.corpus for r in load(p) if "lens" in r and r["k"] <= 3]
    seen = set()
    uniq = []
    for r in rows:
        if r["seed"] in seen:
            continue
        seen.add(r["seed"])
        uniq.append(r)
    if args.skip:
        done = {json.loads(line)["seed"] for p in args.skip.split(",") for line in open(p, encoding="utf-8")}
        uniq = [r for r in uniq if r["seed"] not in done]
    groups = {"all": list(FAM4_VARIANTS), "diag": [k for k in FAM4_VARIANTS if not k.startswith("X_")], "x": [k for k in FAM4_VARIANTS if k.startswith("X_")]}
    extra = groups[args.variants] if args.variants in groups else [x for x in args.variants.split(",") if x]
    t0 = time.perf_counter()
    if args.cells:
        keep = set(args.cells.split(","))
        uniq = [r for r in uniq if scale_cell(r) in keep]
    if args.only:
        keep = {json.loads(line)["seed"] for line in open(args.only, encoding="utf-8")}
        uniq = [r for r in uniq if r["seed"] in keep]
    uniq.sort(key=lambda r: -sum(r["lens"]))
    with Pool(args.jobs) as pool, open(args.out, "w", encoding="utf-8") as f:
        for i, res in enumerate(pool.imap_unordered(_fam4_task, [(r, extra, not args.extra_only) for r in uniq], chunksize=2)):
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            if i % 500 == 0:
                print(i, f"{time.perf_counter() - t0:.0f}s", file=sys.stderr, flush=True)
    print(f"{len(uniq)} rows, {time.perf_counter() - t0:.1f}s", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("corpus")
    a.add_argument("--out", required=True)
    a.add_argument("--per", type=int, default=120)
    a.add_argument("--jobs", type=int, default=4)
    a.add_argument("--conds", default="")
    a.add_argument("--start", type=int, default=0, help="i の始まり（既に作った seed と重ねないため）")
    a.add_argument("--nrange", default="", help="文字の数の範囲を上書きする（例: 8,10）。seed は +50000 ずらす")
    a = sub.add_parser("report")
    a.add_argument("corpus")
    a = sub.add_parser("variants")
    a.add_argument("corpus")
    a.add_argument("--sample", type=int, default=600)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("adopted")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--plan", default=ADOPTED)
    a = sub.add_parser("space")
    a.add_argument("--lens", required=True)
    a.add_argument("--n", type=int, default=1500)
    a = sub.add_parser("tiers")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--settings", default="")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("robust")
    a.add_argument("tiers", nargs="+")
    a.add_argument("--plan", default=ADOPTED_V2)
    a = sub.add_parser("family")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--variants", default="")
    a.add_argument("--only", default="", help="この jsonl にある seed の問題だけを読む")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("plans3")
    a.add_argument("fam", nargs="+")
    a.add_argument("--plan", default=ADOPTED_V3)
    a = sub.add_parser("givens")
    a.add_argument("--per", type=int, default=300)
    a = sub.add_parser("expected")
    a.add_argument("--out", required=True)
    a.add_argument("--per", type=int, default=3)
    a = sub.add_parser("expected5")
    a.add_argument("--out", required=True)
    a.add_argument("--per", type=int, default=3)
    a = sub.add_parser("expected4")
    a.add_argument("--out", required=True)
    a.add_argument("--per", type=int, default=3)
    a = sub.add_parser("expected3")
    a.add_argument("--out", required=True)
    a.add_argument("--per", type=int, default=3)
    a = sub.add_parser("family4")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--variants", default="diag", help="diag（X_ 以外）・x（X_ の族の外の解釈）・all か、カンマ区切りの名前")
    a.add_argument("--skip", default="", help="この jsonl（カンマ区切り）にある seed を飛ばす（続きから測る）")
    a.add_argument("--extra-only", action="store_true", help="端の読み手を測らず、--variants の読み手だけを測る（あとで load_fam4 が seed で重ねる）")
    a.add_argument("--cells", default="", help="この規模の組（2s,2l,3s,3l）の問題だけ")
    a.add_argument("--only", default="", help="この jsonl にある seed の問題だけ")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("plans4")
    a.add_argument("fam", nargs="+")
    a = sub.add_parser("family6")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--skip", default="", help="この jsonl（カンマ区切り）にある seed を飛ばす（続きから測る）")
    a.add_argument("--light", action="store_true", help="場合分けの読み手を測らない（L1〜L3 と組だけを見るとき）")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("supply6")
    a.add_argument("--out", required=True)
    a.add_argument("--conds", required=True)
    a.add_argument("--nrange", default="")
    a.add_argument("--start", type=int, default=0)
    a.add_argument("--per", type=int, default=1000)
    a.add_argument("--plan", default=ADOPTED_V6)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("supply6report")
    a.add_argument("rows", nargs="+")
    a = sub.add_parser("l2shift6")
    a.add_argument("--f5", nargs="+", required=True)
    a.add_argument("--f6", nargs="+", required=True)
    a = sub.add_parser("naive6")
    a.add_argument("rows", nargs="+")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("ksweep6")
    a.add_argument("examples", nargs="*")
    a.add_argument("--ks", default="8,10,12,14,18,22")
    a.add_argument("--kmax", type=int, default=3)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("plans6")
    a.add_argument("fam", nargs="+")
    a.add_argument("--plan", default="")
    a = sub.add_parser("recheck6")
    a.add_argument("fam", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("recheck6report")
    a.add_argument("re")
    a.add_argument("fam", nargs="+")
    a.add_argument("--sup5", default="")
    a = sub.add_parser("family5")
    a.add_argument("corpus", nargs="+")
    a.add_argument("--out", required=True)
    a.add_argument("--variants", default="", help="x（族の外の解釈 X_）・o（選択肢 O_）か、カンマ区切りの名前")
    a.add_argument("--only", default="", help="この jsonl にある seed の問題だけ")
    a.add_argument("--extra-only", action="store_true", help="端の読み手を測らず、--variants の読み手だけを測る（load_fam5 が seed で重ねる）")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("supply5")
    a.add_argument("--out", required=True)
    a.add_argument("--conds", required=True)
    a.add_argument("--nrange", required=True)
    a.add_argument("--start", type=int, default=0)
    a.add_argument("--per", type=int, default=1000)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("plans5")
    a.add_argument("fam", nargs="+")
    a = sub.add_parser("options5")
    a.add_argument("fam", nargs="+")
    a = sub.add_parser("joint5")
    a.add_argument("fam", nargs="+")
    a = sub.add_parser("supply4")
    a.add_argument("--out", required=True)
    a.add_argument("--conds", required=True)
    a.add_argument("--nrange", required=True)
    a.add_argument("--start", type=int, default=0)
    a.add_argument("--per", type=int, default=1000)
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("joint4")
    a.add_argument("fam", nargs="+")
    sub.add_parser("selfcheck")
    args = ap.parse_args()
    {"corpus": cmd_corpus, "report": cmd_report, "variants": cmd_variants, "expected": cmd_expected6, "expected5": cmd_expected5, "givens": cmd_givens, "plans3": cmd_plans3, "family": cmd_family, "robust": cmd_robust, "tiers": cmd_tiers, "space": cmd_space, "adopted": cmd_adopted, "selfcheck": cmd_selfcheck, "family4": cmd_family4, "plans4": cmd_plans4, "joint4": cmd_joint4, "supply4": cmd_supply4, "family6": cmd_family6, "plans6": cmd_plans6, "supply6": cmd_supply6, "supply6report": cmd_supply6report, "l2shift6": cmd_l2shift6, "ksweep6": cmd_ksweep6, "naive6": cmd_naive6, "recheck6": cmd_recheck6_measure, "recheck6report": cmd_recheck6_report, "family5": cmd_family5, "supply5": cmd_supply5, "plans5": cmd_plans5, "joint5": cmd_joint5, "options5": cmd_options5, "expected3": cmd_expected3, "expected4": cmd_expected4}[args.cmd](args)


if __name__ == "__main__":
    main()
