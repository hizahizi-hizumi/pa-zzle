"""魔方陣（magic-square）の導入判断の調査用スクリプト。標準ライブラリだけで動き、seed を固定する。

研究用のコードで、製品コードの性能を表すものではない。

台帳 PUZZLE-011 の評価理由「繰返しの解き味と高難度の多様性が弱い可能性」に答える材料を測る。

ルール（合意）: n×n のマスに 1〜n² を1回ずつ置き、縦・横・斜め2本のどの列も合計 n(n²+1)/2 にする。
いくつかの数は最初から置いてある。答えは1つで、推理だけで解ける。

粗い解法器（導入判断の目安。難易度の観点の分類とは揃えていない）。どの推理も健全なので、
全マスが埋まれば答えは1つと言える（解の数え上げは要らない）。
  段階1 1マスだけ空いた列: 残りの1マスは「合計 − 置いた数の和」
  段階2 空きが2マスの列の組: 残っている数から足して「あと」になる組だけを候補に残し、交わる列と突き合わせる。
        候補が1つになったマス・その数が入りうるマスが1つになった数を置く
  段階3 空きが3マスの列の組: 段階2を3マスの組に広げる
  段階4 隠れた列: 縦・横・斜め以外で、列の条件から合計が決まるマスの組（4×4 の四隅・中央の4マスなど）も
        列として段階1〜3を当てる
  段階5 空き4マスの列の組: 段階2を4マスの組に広げる（人が頭の中でやるには重い。どこまで深い問題があるかの目安）
  段階は低いものから試し、問題を解き切るのに要った一番高い段階をその問題の段階とする。

サブコマンド:
  count      3×3・4×4 の魔方陣を全部数え、回転・裏返し（8通り）と、列の構造を保つ並べ替え・補数（x→n²+1−x）で
             同じとみなした数も出す
  structure  4×4〜6×6 の列の構造の自己同型の数と、隠れた列（合計が決まるマスの組）・2組の和が等しい関係の数。
             段階1だけで解ける与える数の位置の数（4×4 は全部の組、5×5 は乱択）
  sample4    4×4 の (答え, 与える数の位置) を乱択し、答えが1つの割合（全解との照合で厳密）と段階の分かれ方
  selfcheck  粗い解法器が、4×4 で答えが2つ以上ある問題を解けたと言わず、解けた問題は元の答えに一致するか
  reduce     乱択の魔方陣から、指定の段階（--max-stage）までで解ける限り与える数を減らした問題の、
             与える数・段階・解き方の内訳
  all        既定の条件で selfcheck・count・structure・sample4（各4,000件）・reduce（4×4 300盤・5×5 200盤・6×6 40盤を、
             段階4までと段階5までの2通り）を順に

例: python3 magic_square_adoption.py all（seed 1）

限界: 段階5でも空きが4マス以下の列しか見ず、範囲（最小・最大の和）の推理や仮置きは無いので、盤が大きいほど
与える数が多めに残る。乱択の魔方陣は一様な乱択ではない。reduce の問題は「指定の段階までで解ける」最小で、
答えが1つになる最小の与える数ではない。
"""

from __future__ import annotations

import argparse
import itertools
import json
import random
import statistics
import sys
import time
from collections import Counter
from fractions import Fraction


def magic_sum(n: int) -> int:
    return n * (n * n + 1) // 2


def real_lines(n: int) -> list[tuple[int, ...]]:
    """縦・横・斜め2本。マスは r*n+c。"""
    lines = [tuple(r * n + c for c in range(n)) for r in range(n)]
    lines += [tuple(r * n + c for r in range(n)) for c in range(n)]
    lines.append(tuple(i * n + i for i in range(n)))
    lines.append(tuple(i * n + (n - 1 - i) for i in range(n)))
    return lines


# ---------------------------------------------------------------- 全数え上げ


def enumerate_3() -> list[tuple[int, ...]]:
    out = []
    for p in itertools.permutations(range(1, 10)):
        if all(sum(p[i] for i in line) == 15 for line in real_lines(3)):
            out.append(p)
    return out


def enumerate_4() -> list[tuple[int, ...]]:
    """4×4 の魔方陣を全部挙げる。対角線2本を先に決め、残りを列の和で埋める。"""
    S = 34
    quads = [q for q in itertools.combinations(range(1, 17), 4) if sum(q) == S]
    perms = [p for q in quads for p in itertools.permutations(q)]
    out = []
    g = [0] * 16
    for d in perms:  # (0,0),(1,1),(2,2),(3,3)
        dset = set(d)
        for a in perms:  # (0,3),(1,2),(2,1),(3,0)
            if dset.intersection(a):
                continue
            g[0], g[5], g[10], g[15] = d
            g[3], g[6], g[9], g[12] = a
            used = dset | set(a)
            rest = [v for v in range(1, 17) if v not in used]
            # 1行目の (0,1),(0,2)
            need0 = S - g[0] - g[3]
            for v01 in rest:
                v02 = need0 - v01
                if v02 == v01 or v02 not in rest:
                    continue
                # 4行目の (3,1),(3,2)
                need3 = S - g[12] - g[15]
                rest1 = [v for v in rest if v != v01 and v != v02]
                for v31 in rest1:
                    v32 = need3 - v31
                    if v32 == v31 or v32 not in rest1:
                        continue
                    # 2列目・3列目は埋まった
                    if v01 + g[5] + g[9] + v31 != S or v02 + g[6] + g[10] + v32 != S:
                        continue
                    rest2 = [v for v in rest1 if v != v31 and v != v32]
                    # 残り4マス (1,0),(2,0),(1,3),(2,3) は rest2 の4つ
                    need10_20 = S - g[0] - g[12]
                    for v10 in rest2:
                        v20 = need10_20 - v10
                        if v20 == v10 or v20 not in rest2:
                            continue
                        v13 = S - v10 - g[5] - g[6]
                        v23 = S - v20 - g[9] - g[10]
                        if sorted((v10, v20, v13, v23)) != sorted(rest2):
                            continue
                        if g[3] + v13 + v23 + g[15] != S:
                            continue
                        sq = list(g)
                        sq[1], sq[2], sq[13], sq[14] = v01, v02, v31, v32
                        sq[4], sq[8], sq[7], sq[11] = v10, v20, v13, v23
                        out.append(tuple(sq))
    return out


def check_magic(n: int, sq) -> bool:
    if sorted(sq) != list(range(1, n * n + 1)):
        return False
    S = magic_sum(n)
    return all(sum(sq[i] for i in line) == S for line in real_lines(n))


# ---------------------------------------------------------------- 構造


def reversal_commuting_perms(n: int) -> list[tuple[int, ...]]:
    """r(i)=n-1-i と交換する並べ替え σ（σ(n-1-i) = n-1-σ(i)）。"""
    return [s for s in itertools.permutations(range(n)) if all(s[n - 1 - i] == n - 1 - s[i] for i in range(n))]


def line_automorphisms(n: int, brute: bool) -> list[tuple[int, ...]]:
    """縦・横・斜めの列の集まりを列の集まりへ移すマスの並べ替えを全部挙げる。

    n≥4 では、互いに交わらない n 本の列の組は「全部の横」か「全部の縦」だけ（斜めはどの横・縦とも交わる）。
    よって自己同型は (横の並べ替え σ, 縦の並べ替え τ, 転置するか) で表せる。brute=True ならその全部を
    確かめる（n=4・5）。False なら斜めを保つ条件 τ=σ か τ=r∘σ（σ は r と交換）だけから作る。
    """
    lines = set(frozenset(line) for line in real_lines(n))
    out = []
    if brute:
        perms = list(itertools.permutations(range(n)))
        pairs = [(s, t) for s in perms for t in perms]
    else:
        rc = reversal_commuting_perms(n)
        rev = tuple(n - 1 - i for i in range(n))
        pairs = [(s, s) for s in rc] + [(s, tuple(rev[s[i]] for i in range(n))) for s in rc]
    for transpose in (False, True):
        for s, t in pairs:
            m = [0] * (n * n)
            for r in range(n):
                for c in range(n):
                    rr, cc = s[r], t[c]
                    if transpose:
                        rr, cc = cc, rr
                    m[r * n + c] = rr * n + cc
            if all(frozenset(m[i] for i in line) in lines for line in lines):
                out.append(tuple(m))
    return out


def nullspace_int(rows: list[list[int]], ncols: int) -> list[list[int]]:
    """有理数の行基本変形で零空間の基底を求め、整数倍にそろえて返す。"""
    A = [[Fraction(x) for x in row] for row in rows]
    pivots = []
    r = 0
    for c in range(ncols):
        pr = next((i for i in range(r, len(A)) if A[i][c] != 0), None)
        if pr is None:
            continue
        A[r], A[pr] = A[pr], A[r]
        pv = A[r][c]
        A[r] = [x / pv for x in A[r]]
        for i in range(len(A)):
            if i != r and A[i][c] != 0:
                f = A[i][c]
                A[i] = [a - f * b for a, b in zip(A[i], A[r])]
        pivots.append(c)
        r += 1
        if r == len(A):
            break
    free = [c for c in range(ncols) if c not in pivots]
    basis = []
    for fc in free:
        v = [Fraction(0)] * ncols
        v[fc] = Fraction(1)
        for i, pc in enumerate(pivots):
            v[pc] = -A[i][fc]
        den = 1
        for x in v:
            den = den * x.denominator // _gcd(den, x.denominator)
        basis.append([int(x * den) for x in v])
    return basis


def _gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def siamese(n: int) -> list[int]:
    """奇数 n のシャム法（参照用の魔方陣を1つ作る）。"""
    g = [0] * (n * n)
    r, c = 0, n // 2
    for v in range(1, n * n + 1):
        g[r * n + c] = v
        nr, nc = (r - 1) % n, (c + 1) % n
        if g[nr * n + nc]:
            nr, nc = (r + 1) % n, c
        r, c = nr, nc
    return g


def reference_square(n: int, rng: random.Random) -> list[int]:
    if n % 2 == 1:
        return siamese(n)
    return random_magic(n, rng)[0]


def hidden_lines(n: int, max_size: int, rng: random.Random):
    """列の条件（と全体の和）から合計が決まるマスの組のうち、縦・横・斜めでないもの（大きさ max_size 以下）。

    合計が決まる ⇔ 組の指示ベクトルが列の条件の行空間にある ⇔ 零空間のどのベクトルとも直交する。
    合計の値は参照用の魔方陣1つから読む（どの魔方陣でも同じ値になる）。
    戻り値: (隠れた列の一覧 [(マスの組, 合計)], 階数, 2組の和が等しい関係の数)
    """
    N2 = n * n
    rows = []
    for line in real_lines(n):
        row = [0] * N2
        for i in line:
            row[i] = 1
        rows.append(row)
    rows.append([1] * N2)
    K = nullspace_int(rows, N2)
    rank = N2 - len(K)
    col = [tuple(K[j][i] for j in range(len(K))) for i in range(N2)]
    ref = reference_square(n, rng)
    assert check_magic(n, ref)
    real = set(frozenset(line) for line in real_lines(n))
    found = []
    zero = tuple(0 for _ in K)
    for size in range(1, max_size + 1):
        for comb in itertools.combinations(range(N2), size):
            acc = [0] * len(K)
            for i in comb:
                ci = col[i]
                for j in range(len(K)):
                    acc[j] += ci[j]
            if tuple(acc) == zero and frozenset(comb) not in real:
                found.append((comb, sum(ref[i] for i in comb)))
    # a+b = c+d（2組の和が等しい）関係: 2マスの組の零空間での像が等しい、交わらない2組
    pair_img: dict[tuple[int, ...], list[tuple[int, int]]] = {}
    for a, b in itertools.combinations(range(N2), 2):
        key = tuple(col[a][j] + col[b][j] for j in range(len(K)))
        pair_img.setdefault(key, []).append((a, b))
    eq_pairs = 0
    for group in pair_img.values():
        for (a, b), (c, d) in itertools.combinations(group, 2):
            if len({a, b, c, d}) == 4:
                eq_pairs += 1
    return found, rank, eq_pairs


# ---------------------------------------------------------------- 乱択の魔方陣


def random_magic(n: int, rng: random.Random, node_limit: int = 200_000):
    """制約を刈り込みながら乱択で魔方陣を1つ作る（一様な乱択ではない）。戻り値: (盤, 試した回数)"""
    S = magic_sum(n)
    N2 = n * n
    lines = real_lines(n)
    cell_lines = [[li for li, line in enumerate(lines) if p in line] for p in range(N2)]
    tries = 0
    while True:
        tries += 1
        g = [0] * N2
        used = [False] * (N2 + 1)
        sums = [0] * len(lines)
        empt = [n] * len(lines)
        nodes = [0]

        def feasible() -> bool:
            rem = [v for v in range(1, N2 + 1) if not used[v]]
            pref = [0]
            for v in rem:
                pref.append(pref[-1] + v)
            tot = pref[-1]
            for li in range(len(lines)):
                k = empt[li]
                need = S - sums[li]
                if k == 0:
                    if need != 0:
                        return False
                    continue
                if pref[k] > need or tot - pref[len(rem) - k] < need:
                    return False
            return True

        def rec() -> bool:
            nodes[0] += 1
            if nodes[0] > node_limit:
                return False
            # 空きの一番少ない列の、空いたマスを1つ選ぶ
            best_li, best_k = -1, n + 1
            for li in range(len(lines)):
                if 0 < empt[li] < best_k:
                    best_li, best_k = li, empt[li]
            if best_li < 0:
                return True
            empties = [p for p in lines[best_li] if g[p] == 0]
            p = empties[rng.randrange(len(empties))]
            if best_k == 1:
                vals = [S - sums[best_li]]
                if not (1 <= vals[0] <= N2) or used[vals[0]]:
                    return False
            else:
                vals = [v for v in range(1, N2 + 1) if not used[v]]
                rng.shuffle(vals)
            for v in vals:
                g[p] = v
                used[v] = True
                for li in cell_lines[p]:
                    sums[li] += v
                    empt[li] -= 1
                if feasible() and rec():
                    return True
                for li in cell_lines[p]:
                    sums[li] -= v
                    empt[li] += 1
                used[v] = False
                g[p] = 0
                if nodes[0] > node_limit:
                    return False
            return False

        if rec():
            assert check_magic(n, g)
            return g, tries


# ---------------------------------------------------------------- 粗い解法器

STAGE_NAMES = {1: "1マスだけ空いた列", 2: "空き2マスの列の組", 3: "空き3マスの列の組", 4: "隠れた列"}


def solve(n: int, givens, hidden: list[tuple[tuple[int, ...], int]], max_stage: int):
    """戻り値: (解けたか, 盤, 技の回数 Counter, 要った一番高い段階)。0 は空き。"""
    N2 = n * n
    S = magic_sum(n)
    g = list(givens)
    lines = [(line, S) for line in real_lines(n)]
    extra = hidden if max_stage >= 4 else []
    rem = set(range(1, N2 + 1)) - {v for v in g if v}
    cand = {p: set(rem) for p in range(N2) if g[p] == 0}
    stats: Counter = Counter()
    top = 0

    def place(p: int, v: int) -> None:
        g[p] = v
        del cand[p]
        rem.discard(v)
        for cs in cand.values():
            cs.discard(v)

    def singles(line_set) -> int:
        """1マスだけ空いた列。置いたら 1、矛盾なら -1、無ければ 0。"""
        for cells, T in line_set:
            empties = [p for p in cells if g[p] == 0]
            if len(empties) == 1:
                p = empties[0]
                v = T - sum(g[q] for q in cells if g[q])
                if v not in cand[p]:
                    return -1
                place(p, v)
                return 1
            if not empties and sum(g[q] for q in cells) != T:
                return -1
        return 0

    def combo_filter(line_set, k: int) -> bool:
        """空きがちょうど k マスの列で、組にならない候補を外す。外したら True。"""
        changed = False
        for cells, T in line_set:
            empties = [p for p in cells if g[p] == 0]
            if len(empties) != k:
                continue
            need = T - sum(g[q] for q in cells if g[q])
            if k == 2:
                a, b = empties
                ca, cb = cand[a], cand[b]
                na = {v for v in ca if (need - v) in cb and need - v != v}
                nb = {v for v in cb if (need - v) in ca and need - v != v}
                sup = [na, nb]
            elif k == 4:
                a, b, c, d = empties
                ca, cb, cc, cd = cand[a], cand[b], cand[c], cand[d]
                sa, sb, sc, sd = set(), set(), set(), set()
                for v in ca:
                    for w in cb:
                        if w == v:
                            continue
                        for x in cc:
                            if x == v or x == w:
                                continue
                            u = need - v - w - x
                            if u != v and u != w and u != x and u in cd:
                                sa.add(v)
                                sb.add(w)
                                sc.add(x)
                                sd.add(u)
                sup = [sa, sb, sc, sd]
            else:
                a, b, c = empties
                ca, cb, cc = cand[a], cand[b], cand[c]
                sa, sb, sc = set(), set(), set()
                for v in ca:
                    for w in cb:
                        if w == v:
                            continue
                        u = need - v - w
                        if u != v and u != w and u in cc:
                            sa.add(v)
                            sb.add(w)
                            sc.add(u)
                sup = [sa, sb, sc]
            for p, s in zip(empties, sup):
                if len(s) < len(cand[p]):
                    cand[p] = s
                    changed = True
        return changed

    def cand_singles() -> int:
        for p, cs in cand.items():
            if not cs:
                return -1
            if len(cs) == 1:
                place(p, next(iter(cs)))
                return 1
        for v in sorted(rem):
            ps = [p for p, cs in cand.items() if v in cs]
            if not ps:
                return -1
            if len(ps) == 1:
                place(ps[0], v)
                return 1
        return 0

    while cand:
        r = singles(lines)
        if r < 0:
            return False, g, stats, top
        if r > 0:
            stats["single"] += 1
            top = max(top, 1)
            continue
        if max_stage < 2:
            return False, g, stats, top
        r = cand_singles()
        if r < 0:
            return False, g, stats, top
        if r > 0:
            stats["cand_single"] += 1
            continue
        if combo_filter(lines, 2):
            stats["pair"] += 1
            top = max(top, 2)
            continue
        if max_stage >= 3 and combo_filter(lines, 3):
            stats["triple"] += 1
            top = max(top, 3)
            continue
        if max_stage >= 4:
            r = singles(extra)
            if r < 0:
                return False, g, stats, top
            if r > 0:
                stats["hidden_single"] += 1
                top = max(top, 4)
                continue
            if combo_filter(extra, 2) or combo_filter(extra, 3):
                stats["hidden_combo"] += 1
                top = max(top, 4)
                continue
        if max_stage >= 5 and (combo_filter(lines, 4) or combo_filter(extra, 4)):
            stats["quad"] += 1
            top = max(top, 5)
            continue
        return False, g, stats, top
    return True, g, stats, top


def min_stage(n: int, givens, hidden, top_stage: int = 5) -> tuple[int | None, Counter]:
    """解き切れる一番低い段階（1〜top_stage）。top_stage でも解けなければ None。"""
    for st in range(1, top_stage + 1):
        ok, _, stats, top = solve(n, givens, hidden, st)
        if ok:
            return st, stats
    return None, Counter()


def single_blank_at_start(n: int, givens) -> bool:
    return any(sum(1 for p in line if givens[p] == 0) == 1 for line in real_lines(n))


# ---------------------------------------------------------------- サブコマンド


def cmd_count(args) -> dict:
    t0 = time.time()
    sq3 = enumerate_3()
    t3 = time.time() - t0
    t0 = time.time()
    sq4 = enumerate_4()
    t4 = time.time() - t0
    assert all(check_magic(4, s) for s in sq4)
    assert len(set(sq4)) == len(sq4)
    res = {}
    for n, sqs, secs in ((3, sq3, t3), (4, sq4, t4)):
        auts = line_automorphisms(n, brute=True) if n >= 4 else None
        d4 = dihedral(n)
        N2 = n * n

        def orbits(group, complement: bool) -> int:
            seen = set()
            count = 0
            for s in sqs:
                if s in seen:
                    continue
                count += 1
                variants = []
                for m in group:
                    t = [0] * N2
                    for i in range(N2):
                        t[m[i]] = s[i]
                    variants.append(tuple(t))
                    if complement:
                        variants.append(tuple(N2 + 1 - x for x in t))
                seen.update(variants)
            return count

        entry = {
            "total": len(sqs),
            "orbits_rotation_reflection": orbits(d4, False),
            "seconds": round(secs, 1),
        }
        if auts is not None:
            entry["line_automorphisms"] = len(auts)
            entry["orbits_line_automorphisms"] = orbits(auts, False)
            entry["orbits_line_automorphisms_and_complement"] = orbits(auts, True)
        res[str(n)] = entry
    return res


def dihedral(n: int) -> list[tuple[int, ...]]:
    out = []
    for transpose in (False, True):
        for fr in (False, True):
            for fc in (False, True):
                m = [0] * (n * n)
                for r in range(n):
                    for c in range(n):
                        rr = n - 1 - r if fr else r
                        cc = n - 1 - c if fc else c
                        if transpose:
                            rr, cc = cc, rr
                        m[r * n + c] = rr * n + cc
                out.append(tuple(m))
    return out


def single_chain_fills(n: int, filled: set[int]) -> bool:
    """段階1（1マスだけ空いた列）だけで全マスが埋まるか。数の値によらず、与える数の位置だけで決まる。"""
    f = set(filled)
    lines = real_lines(n)
    changed = True
    while changed and len(f) < n * n:
        changed = False
        for line in lines:
            empties = [p for p in line if p not in f]
            if len(empties) == 1:
                f.add(empties[0])
                changed = True
    return len(f) == n * n


def cmd_structure(args) -> dict:
    rng = random.Random(args.seed)
    res = {}
    # 段階1だけで解ける与える数の位置: 4×4 は全部の組、5×5 は乱択
    chain = {"4": {}, "5": {}}
    for k in (7, 8, 9):
        combs = list(itertools.combinations(range(16), k))
        chain["4"][str(k)] = {"positions": len(combs), "single_chain": sum(single_chain_fills(4, set(c)) for c in combs)}
    for k in (13, 14, 15, 16):
        trials = 20000
        hit = sum(single_chain_fills(5, set(rng.sample(range(25), k))) for _ in range(trials))
        chain["5"][str(k)] = {"sampled_positions": trials, "single_chain": hit}
    res["single_chain_positions"] = chain
    for n, max_size in ((4, 4), (5, 5), (6, 6)):
        t0 = time.time()
        auts_brute = line_automorphisms(n, brute=True) if n <= 5 else None
        auts = line_automorphisms(n, brute=False)
        if auts_brute is not None:
            assert set(auts_brute) == set(auts), (n, len(auts_brute), len(auts))
        found, rank, eq_pairs = hidden_lines(n, max_size, rng)
        by_size = Counter(len(c) for c, _ in found)
        res[str(n)] = {
            "line_automorphisms": len(auts),
            "automorphisms_checked_by_brute_force": auts_brute is not None,
            "rank_of_line_conditions": rank,
            "free_dimensions": n * n - rank,
            "hidden_lines_by_size": dict(sorted(by_size.items())),
            "hidden_lines_examples": [
                {"cells": [[p // n, p % n] for p in c], "sum": s} for c, s in found[:12]
            ],
            "equal_pair_sum_relations": eq_pairs,
            "seconds": round(time.time() - t0, 1),
        }
    return res


def cmd_sample4(args) -> dict:
    rng = random.Random(args.seed)
    sqs = enumerate_4()
    n, N2 = 4, 16
    # (マス, 数) ごとに、その数がそのマスにある魔方陣の集合をビット列で持つ
    index = [[0] * (N2 + 1) for _ in range(N2)]
    for i, s in enumerate(sqs):
        bit = 1 << i
        for p in range(N2):
            index[p][s[p]] |= bit
    hidden, _, _ = hidden_lines(n, 4, rng)
    res = {}
    for k in args.ks:
        t0 = time.time()
        unique = 0
        stages: Counter = Counter()
        no_single_start = Counter()
        for _ in range(args.samples):
            s = sqs[rng.randrange(len(sqs))]
            mask = rng.sample(range(N2), k)
            bits = -1
            for p in mask:
                bits &= index[p][s[p]]
            if bits.bit_count() != 1:
                continue
            unique += 1
            givens = [s[p] if p in mask else 0 for p in range(N2)]
            st, _ = min_stage(n, givens, hidden)
            stages[st if st is not None else "none"] += 1
            if not single_blank_at_start(n, givens):
                no_single_start[st if st is not None else "none"] += 1
        res[str(k)] = {
            "samples": args.samples,
            "unique": unique,
            "unique_rate": round(unique / args.samples, 4),
            "stage_counts_among_unique": {str(a): b for a, b in sorted(stages.items(), key=lambda x: str(x[0]))},
            "no_single_blank_line_at_start": {
                str(a): b for a, b in sorted(no_single_start.items(), key=lambda x: str(x[0]))
            },
            "seconds": round(time.time() - t0, 1),
        }
    return res


def cmd_selfcheck(args) -> dict:
    """粗い解法器の健全さ: 4×4 で答えが2つ以上の問題を「解けた」と言わず、解けた問題は元の答えに一致する。"""
    rng = random.Random(args.seed)
    sqs = enumerate_4()
    index = [[0] * 17 for _ in range(16)]
    for i, s in enumerate(sqs):
        for p in range(16):
            index[p][s[p]] |= 1 << i
    hidden, _, _ = hidden_lines(4, 4, rng)
    multi = claimed = solved = wrong = 0
    for _ in range(args.samples):
        s = sqs[rng.randrange(len(sqs))]
        k = rng.choice([3, 4, 5, 6])
        mask = rng.sample(range(16), k)
        bits = -1
        for p in mask:
            bits &= index[p][s[p]]
        g = [s[p] if p in mask else 0 for p in range(16)]
        ok, filled, _, _ = solve(4, g, hidden, 5)
        if bits.bit_count() > 1:
            multi += 1
            claimed += ok
        elif ok:
            solved += 1
            wrong += tuple(filled) != s
    assert claimed == 0 and wrong == 0
    return {"samples": args.samples, "multi_solution": multi, "claimed_solved_on_multi": claimed, "unique_solved": solved, "wrong_fill": wrong}


def reduce_givens(n: int, square, hidden, rng: random.Random, max_stage: int):
    N2 = n * n
    g = list(square)
    order = list(range(N2))
    rng.shuffle(order)
    for p in order:
        v = g[p]
        g[p] = 0
        ok, filled, _, _ = solve(n, g, hidden, max_stage)
        if ok:
            assert filled == list(square)
        else:
            g[p] = v
    return g


def cmd_reduce(args) -> dict:
    n = args.n
    rng = random.Random(args.seed * 1000 + n)
    hidden, _, _ = hidden_lines(n, n, random.Random(args.seed))
    if n == 4:
        all4 = enumerate_4()
    rows = []
    t0 = time.time()
    gen_secs = []
    for _ in range(args.squares):
        if time.time() - t0 > args.budget:
            break
        tg = time.time()
        if n == 4:
            sq = list(all4[rng.randrange(len(all4))])
        else:
            sq, _ = random_magic(n, rng)
        gen_secs.append(time.time() - tg)
        g = reduce_givens(n, sq, hidden, rng, args.max_stage)
        st, stats = min_stage(n, g, hidden, args.max_stage)
        rows.append(
            {
                "clues": sum(1 for v in g if v),
                "stage": st,
                "no_single_blank_line_at_start": not single_blank_at_start(n, g),
                "steps": dict(stats),
            }
        )
    clues = [r["clues"] for r in rows]
    stage_c = Counter(r["stage"] for r in rows)
    sig = Counter(
        (
            r["stage"],
            r["steps"].get("pair", 0) > 0,
            r["steps"].get("triple", 0) > 0,
            r["steps"].get("hidden_single", 0) + r["steps"].get("hidden_combo", 0) > 0,
            r["steps"].get("quad", 0) > 0,
        )
        for r in rows
    )
    hard = [r for r in rows if r["no_single_blank_line_at_start"]]
    filt_rounds = [r["steps"].get("pair", 0) + r["steps"].get("triple", 0) + r["steps"].get("hidden_combo", 0) for r in rows]
    # 置いた数のうち「1マスだけ空いた列」の引き算で置いた割合（機械的な引き算がどれだけを占めるか）
    single_share = []
    for r in rows:
        placed = r["steps"].get("single", 0) + r["steps"].get("cand_single", 0) + r["steps"].get("hidden_single", 0)
        if placed:
            single_share.append(round(r["steps"].get("single", 0) / placed, 2))
    return {
        "n": n,
        "max_stage": args.max_stage,
        "squares": len(rows),
        "clues": summarize(clues),
        "clue_histogram": dict(sorted(Counter(clues).items())),
        "stage_counts": {str(a): b for a, b in sorted(stage_c.items(), key=lambda x: str(x[0]))},
        "no_single_blank_line_at_start": len(hard),
        "stage_counts_no_single_start": {
            str(a): b for a, b in sorted(Counter(r["stage"] for r in hard).items(), key=lambda x: str(x[0]))
        },
        "filter_rounds": summarize(filt_rounds),
        "single_blank_share_of_placements": summarize(single_share),
        "technique_signatures": {
            f"stage{a}/pair={b}/triple={c}/hidden={d}/quad={e}": v
            for (a, b, c, d, e), v in sorted(sig.items(), key=lambda x: str(x[0]))
        },
        "square_generation_seconds": summarize([round(x, 2) for x in gen_secs]),
        "seconds": round(time.time() - t0, 1),
    }


def summarize(xs):
    if not xs:
        return {}
    return {
        "min": min(xs),
        "median": statistics.median(xs),
        "max": max(xs),
        "mean": round(statistics.mean(xs), 2),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("count")
    p.set_defaults(func=cmd_count)
    p = sub.add_parser("structure")
    p.add_argument("--seed", type=int, default=1)
    p.set_defaults(func=cmd_structure)
    p = sub.add_parser("sample4")
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--samples", type=int, default=4000)
    p.add_argument("--ks", type=int, nargs="+", default=[4, 5, 6, 7, 8, 9])
    p.set_defaults(func=cmd_sample4)
    p = sub.add_parser("selfcheck")
    p.add_argument("--seed", type=int, default=99)
    p.add_argument("--samples", type=int, default=6000)
    p.set_defaults(func=cmd_selfcheck)
    p = sub.add_parser("reduce")
    p.add_argument("--n", type=int, required=True)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--squares", type=int, default=40)
    p.add_argument("--max-stage", type=int, default=4)
    p.add_argument("--budget", type=float, default=500.0, help="この秒数を超えたら新しい盤を始めない")
    p.set_defaults(func=cmd_reduce)
    p = sub.add_parser("all")
    p.add_argument("--seed", type=int, default=1)
    p.set_defaults(func=None)
    args = ap.parse_args()
    if args.cmd == "all":
        out = {
            "selfcheck": cmd_selfcheck(argparse.Namespace(seed=99, samples=6000)),
            "count": cmd_count(args),
            "structure": cmd_structure(args),
            "sample4": cmd_sample4(argparse.Namespace(seed=args.seed, samples=4000, ks=[4, 5, 6, 7, 8, 9])),
        }
        for n, sq in ((4, 300), (5, 200), (6, 40)):
            for st in (4, 5):
                out[f"reduce{n}_stage{st}"] = cmd_reduce(
                    argparse.Namespace(n=n, seed=args.seed, squares=sq, max_stage=st, budget=120.0)
                )
    else:
        out = args.func(args)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    main()
