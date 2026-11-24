"""覆面算 採点の前提: 解き方ごとの盤面上の事実（◯の置き方・×の数）を比べる計測。

標準ライブラリだけ。seed 固定。
- 問題: 足し算の覆面算をランダムな数から作り、解が1つの問題だけ残す。
- 推理の近似: 桁ごとに成り立つ組み合わせだけ残す・使い回し禁止・先頭0禁止（10文字なら
  「その数字が入る文字が1つだけ」も）。止まったら場合分けが要るとみなす。
  class0 推理だけで解ける / class1 1段の場合分け（仮に置いて推理で矛盾が出たら消す）の
  繰り返しで解ける / class2 それでも解けない
- 解き方:
  P1 頭の中で決めて◯だけ置く（◯は文字の数だけ、解と違う◯は0）
  P1m 同じ推理で、推理が止まるまでに消した組をすべて×で書く（情報のある×の数）
  P2e 1段の場合分けを盤面で行う。矛盾の出る仮置きのうち、盤面に書く◯が最も少ない
      もの（繰り上がりの場合分けは◯を書かない）を選ぶ。結果は頭の中で追う
  P2 1段の場合分けを盤面で行う。候補の少ない文字・繰り上がりから順に、値を乱順に仮に
     置き、結果まで◯で書く。矛盾が出ても出なくても消して次へ
  P3c 推理が止まったところから、残りを当てずっぽうで◯にし、赤が出たら戻す
  P3a 当てずっぽう: 右の桁から順に、使っていない数字を◯にし、赤（使い回し・先頭0・
      右から埋まった桁の計算違い）が出たら戻す
  P3b 当てずっぽう（足す側だけ当て、答えの文字は桁の計算から置く）
"""
import json
import random
import statistics
import sys
import time

SHAPES = {
    "L1相当 3桁+3桁=4桁 6文字": ([3, 3], 4, 6),
    "中間 4桁+4桁=5桁 8文字": ([4, 4], 5, 8),
    "L5相当 5桁×3=6桁 10文字": ([5, 5, 5], 6, 10),
}
LETTERS = "ABCDEFGHIJ"


def make_problem(rng, lens, rlen, nletters):
    while True:
        nums = [rng.randint(10 ** (l - 1), 10**l - 1) for l in lens]
        s = sum(nums)
        if len(str(s)) != rlen:
            continue
        words = [str(n) for n in nums] + [str(s)]
        digits = []
        for w in words:
            for ch in w:
                if ch not in digits:
                    digits.append(ch)
        if len(digits) != nletters:
            continue
        m = {d: LETTERS[i] for i, d in enumerate(digits)}
        pw = ["".join(m[c] for c in w) for w in words]
        sol = {m[d]: int(d) for d in digits}
        return pw[:-1], pw[-1], sol


def columns(addends, result):
    R = len(result)
    cols = []
    for i in range(R):
        add = [w[-1 - i] for w in addends if len(w) > i]
        cols.append((add, result[-1 - i]))
    return cols


def leading(addends, result):
    return {w[0] for w in addends + [result] if len(w) > 1}


def count_solutions(addends, result, limit=2):
    cols = columns(addends, result)
    lead = leading(addends, result)
    assign = {}
    used = [False] * 10
    count = 0

    def ok(L, d):
        return not used[d] and not (d == 0 and L in lead)

    def col(i, carry):
        nonlocal count
        if count >= limit:
            return
        if i == len(cols):
            if carry == 0:
                count += 1
            return
        add, res = cols[i]
        free = []
        for L in add:
            if L not in assign and L not in free:
                free.append(L)

        def rec(k):
            nonlocal count
            if count >= limit:
                return
            if k == len(free):
                s = sum(assign[L] for L in add) + carry
                r, c = s % 10, s // 10
                if res in assign:
                    if assign[res] == r:
                        col(i + 1, c)
                elif ok(res, r):
                    assign[res] = r
                    used[r] = True
                    col(i + 1, c)
                    used[r] = False
                    del assign[res]
                return
            L = free[k]
            for d in range(10):
                if ok(L, d):
                    assign[L] = d
                    used[d] = True
                    rec(k + 1)
                    used[d] = False
                    del assign[L]

        rec(0)

    col(0, 0)
    return count


class Prop:
    """人間向けの推理の近似: 桁ごとに成り立つ組み合わせを残す・使い回し禁止・先頭0禁止。
    10文字のときは「その数字が入る文字が1つだけ」も使う。"""

    def __init__(self, addends, result):
        self.cols = columns(addends, result)
        self.letters = sorted({c for w in addends + [result] for c in w})
        self.lead = leading(addends, result)
        self.full = len(self.letters) == 10

    def initial(self):
        dom = {L: set(range(1 if L in self.lead else 0, 10)) for L in self.letters}
        R = len(self.cols)
        car = [set([0])] + [set(range(0, len(self.cols[i - 1][0]))) if self.cols[i - 1][0] else {0} for i in range(1, R)] + [set([0])]
        # 繰り上がりの上限: 足す数の個数-1（max carry for k addends is k-1）
        return dom, car

    def propagate(self, dom, car):
        """returns (ok, informative_eliminations) ; informative = 未確定の文字から、確定済み文字の
        使い回し以外の理由で消した (文字,数字)。"""
        info = set()
        changed = True
        while changed:
            changed = False
            fixed = {L: next(iter(d)) for L, d in dom.items() if len(d) == 1}
            # all-different from fixed
            fv = {}
            for L, v in fixed.items():
                if v in fv:
                    return False, info
                fv[v] = L
            for L, d in dom.items():
                if len(d) > 1:
                    rm = d & set(fv)
                    if rm:
                        d -= rm
                        changed = True
                        if not d:
                            return False, info
            if self.full:
                for v in range(10):
                    hold = [L for L, d in dom.items() if v in d]
                    if not hold:
                        return False, info
                    if len(hold) == 1 and len(dom[hold[0]]) > 1:
                        for w in dom[hold[0]] - {v}:
                            info.add((hold[0], w))
                        dom[hold[0]] = {v}
                        changed = True
            for i, (add, res) in enumerate(self.cols):
                distinct = []
                for L in add:
                    if L not in distinct:
                        distinct.append(L)
                sup = {L: set() for L in distinct}
                supr = set()
                supci, supco = set(), set()
                vals = {}

                def rec(k):
                    if k == len(distinct):
                        s0 = sum(vals[L] for L in add)
                        for ci in car[i]:
                            s = s0 + ci
                            r, co = s % 10, s // 10
                            if co not in car[i + 1] or r not in dom[res]:
                                continue
                            if res in vals:
                                if vals[res] != r:
                                    continue
                            elif r in vals.values():
                                continue
                            for L in distinct:
                                sup[L].add(vals[L])
                            supr.add(r)
                            supci.add(ci)
                            supco.add(co)
                        return
                    L = distinct[k]
                    for v in dom[L]:
                        if v in vals.values():
                            continue
                        vals[L] = v
                        rec(k + 1)
                        del vals[L]

                rec(0)
                for L in distinct:
                    if sup[L] != dom[L]:
                        for w in dom[L] - sup[L]:
                            if len(dom[L]) > 1:
                                info.add((L, w))
                        dom[L] = sup[L] & dom[L]
                        changed = True
                        if not dom[L]:
                            return False, info
                if res not in distinct:
                    nr = dom[res] & supr
                    if nr != dom[res]:
                        for w in dom[res] - nr:
                            info.add((res, w))
                        dom[res] = nr
                        changed = True
                        if not nr:
                            return False, info
                if car[i] - supci:
                    car[i] = car[i] & supci
                    changed = True
                if car[i + 1] - supco:
                    car[i + 1] = car[i + 1] & supco
                    changed = True
                if not car[i] or not car[i + 1]:
                    return False, info
        return True, info


def copy_state(dom, car):
    return {L: set(d) for L, d in dom.items()}, [set(c) for c in car]


def solved(dom):
    return all(len(d) == 1 for d in dom.values())


def branch_vars(dom, car):
    """場合分けする候補の順: 候補の少ない順。同数なら繰り上がりを先、右の桁を先。"""
    vs = []
    for i, c in enumerate(car):
        if len(c) > 1:
            vs.append((len(c), 0, i, ("carry", i)))
    for L, d in dom.items():
        if len(d) > 1:
            vs.append((len(d), 1, L, ("letter", L)))
    vs.sort()
    return [v[3] for v in vs]


def assign_var(dom, car, var, v):
    kind, k = var
    if kind == "carry":
        car[k] = {v}
    else:
        dom[k] = {v}


def var_values(dom, car, var):
    kind, k = var
    return sorted(car[k] if kind == "carry" else dom[k])


def remove_value(dom, car, var, v):
    kind, k = var
    (car[k] if kind == "carry" else dom[k]).discard(v)


def depth1_solvable(P, dom, car):
    """1段の場合分け（仮に置いて推理だけで矛盾が出たら消す）を繰り返して解けるか。"""
    dom, car = copy_state(dom, car)
    while not solved(dom):
        progress = False
        for var in branch_vars(dom, car):
            for v in var_values(dom, car, var):
                d2, c2 = copy_state(dom, car)
                assign_var(d2, c2, var, v)
                ok, _ = P.propagate(d2, c2)
                if not ok:
                    remove_value(dom, car, var, v)
                    ok2, _ = P.propagate(dom, car)
                    assert ok2
                    progress = True
                    break
            if progress:
                break
        if not progress:
            return False
    return True


def analyze(addends, result, sol, rng):
    P = Prop(addends, result)
    dom, car = P.initial()
    info_total = set((L, 0) for L in P.lead)
    ok, info = P.propagate(dom, car)
    assert ok
    info_total |= info
    stalled = not solved(dom)
    if not stalled:
        cls = 0
    elif depth1_solvable(P, dom, car):
        cls = 1
    else:
        cls = 2
    # P2: 止まったら、候補の少ない順に変数を選び、値を乱順に仮に置いて結果まで盤面に◯で書く。
    #     推理で矛盾が出たら消して × にする。矛盾が出なければ（決め手にならないので）消して次を試す。
    #     1段で決まらないときは、矛盾が出なかった仮置きの中でさらに1段試す（入れ子）。
    st = {"placed": 0, "wrong": 0, "retracted": 0, "trials": 0}
    onboard = {L for L, d in dom.items() if len(d) == 1}
    st["placed"] += len(onboard)

    def place_new(d, board):
        for L, s in d.items():
            if len(s) == 1 and L not in board:
                board.add(L)
                st["placed"] += 1
                if next(iter(s)) != sol[L]:
                    st["wrong"] += 1

    def try_level(dom, car, board, depth):
        """1段の仮置きで矛盾を探す。消せた値があれば True。"""
        for var in branch_vars(dom, car):
            vals = var_values(dom, car, var)
            rng.shuffle(vals)
            for v in vals:
                st["trials"] += 1
                d2, c2 = copy_state(dom, car)
                assign_var(d2, c2, var, v)
                before = set(board)
                tb = set(board)
                if var[0] == "letter":
                    place_new({var[1]: {v}}, tb)
                okb, _ = P.propagate(d2, c2)
                contradiction = not okb
                if okb:
                    place_new(d2, tb)
                    if depth > 1 and not solved(d2):
                        # 入れ子: 仮置きの中でさらに試して矛盾が出るか
                        contradiction = not search(d2, c2, tb, depth - 1)
                st["retracted"] += len(tb - before)
                if contradiction:
                    remove_value(dom, car, var, v)
                    ok2, _ = P.propagate(dom, car)
                    if not ok2:
                        return None
                    place_new(dom, board)
                    return True
        return False

    def search(dom, car, board, depth):
        """推理と仮置きで、dom の下で解けるか（矛盾なら False）。"""
        while not solved(dom):
            r = None
            for dd in range(1, depth + 1):
                r = try_level(dom, car, board, dd)
                if r is None:
                    return False
                if r:
                    break
            if not r:
                # これ以上消せない: 解けない分岐とは言えないので矛盾なしとする
                return True
        return True

    p2e = efficient_case(P, dom, car, sol) if cls <= 1 else None
    if cls <= 1:
        d, c = copy_state(dom, car)
        board = set(onboard)
        search(d, c, board, 1)
        assert solved(d) and all(next(iter(d[L])) == sol[L] for L in sol)
    return {
        "class": cls,
        "info_x_before_stall": len(info_total),
        "p2": st,
        "p2e": p2e,
        "stall_dom": dom,
    }


def efficient_case(P, dom, car, sol):
    """P2e: 1段の場合分けを、矛盾の出る仮置きのうち盤面に書く◯が最も少ないものから選ぶ。
    返り値: 仮置きの回数、解と違う◯、消した◯。1段で解けないときは None。"""
    dom, car = copy_state(dom, car)
    st = {"trials": 0, "wrong": 0, "retracted": 0}
    while not solved(dom):
        best = None
        for var in branch_vars(dom, car):
            for v in var_values(dom, car, var):
                d2, c2 = copy_state(dom, car)
                assign_var(d2, c2, var, v)
                ok, _ = P.propagate(d2, c2)
                if ok:
                    continue
                # 矛盾が出るまでに書く◯: 分けた文字（文字なら）だけ。結果は頭の中で追う
                written = 1 if var[0] == "letter" else 0
                wrong = written if (var[0] == "letter" and sol[var[1]] != v) else 0
                key = (written, wrong)
                if best is None or key < best[0]:
                    best = (key, var, v)
        if best is None:
            return None
        (written, wrong), var, v = best
        st["trials"] += 1
        st["wrong"] += wrong
        st["retracted"] += written
        remove_value(dom, car, var, v)
        ok, _ = P.propagate(dom, car)
        assert ok
    return st


def partial_guess(addends, result, sol, rng, dom):
    """P3c: 推理が止まったところから、残りの文字を当てずっぽうで◯にし、赤が出たら戻す。"""
    cols = columns(addends, result)
    order = []
    for add, res in cols:
        for L in add + [res]:
            if L not in order:
                order.append(L)
    assign = {L: next(iter(d)) for L, d in dom.items() if len(d) == 1}
    st = {"placed": 0, "wrong": 0}

    def red():
        carry = 0
        for add, res in cols:
            if any(L not in assign for L in add + [res]):
                return False
            s = sum(assign[L] for L in add) + carry
            if s % 10 != assign[res]:
                return True
            carry = s // 10
        return carry != 0

    def dfs():
        L = next((K for K in order if K not in assign), None)
        if L is None:
            return True
        ds = [x for x in dom[L] if x not in assign.values()]
        rng.shuffle(ds)
        for x in ds:
            assign[L] = x
            st["placed"] += 1
            if x != sol[L]:
                st["wrong"] += 1
            if not red() and dfs():
                return True
            del assign[L]
        return False

    assert dfs()
    return st


def guess_and_check(addends, result, sol, rng, compute_result):
    cols = columns(addends, result)
    lead = leading(addends, result)
    order = []
    for add, res in cols:
        for L in add + [res]:
            if L not in order:
                order.append(L)
    result_letters_by_col = [res for _, res in cols]
    assign = {}
    st = {"placed": 0, "wrong": 0, "retracted": 0}

    def red():
        # 使い回し・先頭0 は置く前に避けるので、右から埋まった桁の計算違いだけ見る
        carry = 0
        for add, res in cols:
            if any(L not in assign for L in add + [res]):
                return False
            s = sum(assign[L] for L in add) + carry
            if s % 10 != assign[res]:
                return True
            carry = s // 10
        return carry != 0

    def place(L, d):
        assign[L] = d
        st["placed"] += 1
        if d != sol[L]:
            st["wrong"] += 1

    def unplace(L):
        del assign[L]
        st["retracted"] += 1

    def next_letter():
        for L in order:
            if L not in assign:
                return L
        return None

    def forced_result():
        # P3b: 足す側が右から埋まった桁の答えの文字を、計算で置く
        carry = 0
        for add, res in cols:
            if any(L not in assign for L in add):
                return None
            s = sum(assign[L] for L in add) + carry
            if res not in assign:
                return res, s % 10
            carry = s // 10
        return None

    def dfs():
        if len(assign) == len(sol):
            return True
        if compute_result:
            fr = forced_result()
            if fr is not None:
                L, d = fr
                if d in assign.values() or (d == 0 and L in lead):
                    return False
                place(L, d)
                if not red() and dfs():
                    return True
                unplace(L)
                return False
        L = next_letter()
        ds = [d for d in range(10) if d not in assign.values() and not (d == 0 and L in lead)]
        rng.shuffle(ds)
        for d in ds:
            place(L, d)
            if not red() and dfs():
                return True
            unplace(L)
        return False

    assert dfs()
    assert all(assign[L] == sol[L] for L in sol)
    return st


def summarize(xs):
    if not xs:
        return None
    xs = sorted(xs)
    n = len(xs)
    return {
        "n": n,
        "median": statistics.median(xs),
        "p10": xs[int(n * 0.1)],
        "p90": xs[min(n - 1, int(n * 0.9))],
        "max": xs[-1],
    }


def fmt(s):
    if s is None:
        return "-"
    return f"{s['median']} [{s['p10']}-{s['p90']}] max {s['max']}"


def main():
    n_per = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    out = {}
    for name, (lens, rlen, nl) in SHAPES.items():
        rng = random.Random(20261122)
        probs = []
        tries = 0
        t0 = time.time()
        while len(probs) < n_per:
            tries += 1
            a, r, sol = make_problem(rng, lens, rlen, nl)
            if count_solutions(a, r) == 1:
                probs.append((a, r, sol))
        rows = []
        for idx, (a, r, sol) in enumerate(probs):
            d = analyze(a, r, sol, random.Random(1000 + idx))
            g_a = guess_and_check(a, r, sol, random.Random(2000 + idx), False)
            g_b = guess_and_check(a, r, sol, random.Random(3000 + idx), True)
            g_c = partial_guess(a, r, sol, random.Random(4000 + idx), d["stall_dom"])
            rows.append((d, g_a, g_b, g_c))
        res = {"problems": len(probs), "letters": nl}
        for cls in (0, 1, 2):
            sub = [x for x in rows if x[0]["class"] == cls]
            key = {0: "class0 推理だけ", 1: "class1 1段の場合分け", 2: "class2 2段以上"}[cls]
            r_ = {"count": len(sub)}
            if sub:
                r_["P1m 情報のある×（止まるまで）"] = fmt(summarize([x[0]["info_x_before_stall"] for x in sub]))
                if cls <= 1:
                    r_["P2e 仮置き回数"] = fmt(summarize([x[0]["p2e"]["trials"] for x in sub]))
                    r_["P2e 解と違う◯"] = fmt(summarize([x[0]["p2e"]["wrong"] for x in sub]))
                    r_["P2e 消した◯"] = fmt(summarize([x[0]["p2e"]["retracted"] for x in sub]))
                    r_["P2 仮置き回数"] = fmt(summarize([x[0]["p2"]["trials"] for x in sub]))
                    r_["P2 解と違う◯"] = fmt(summarize([x[0]["p2"]["wrong"] for x in sub]))
                    r_["P2 消した◯"] = fmt(summarize([x[0]["p2"]["retracted"] for x in sub]))
                r_["P3a 解と違う◯"] = fmt(summarize([x[1]["wrong"] for x in sub]))
                r_["P3b 解と違う◯"] = fmt(summarize([x[2]["wrong"] for x in sub]))
                r_["P3c 解と違う◯"] = fmt(summarize([x[3]["wrong"] for x in sub]))
            res[key] = r_
        res["seconds"] = round(time.time() - t0, 1)
        out[name] = res
        print(json.dumps({name: res}, ensure_ascii=False, indent=1), flush=True)


if __name__ == "__main__":
    main()
