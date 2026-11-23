"""ソリティア 採点の前提の計測（標準ライブラリだけ、seed 固定）。

card = suit*13 + (rank-1)。suit: 0♠ 1♥ 2♦ 3♣。赤は 1,2。
配り方は認識合わせの試算と同じ: random.Random(seed) で 52 枚を混ぜ、
1〜7 枚の列（全部表）、残り 24 枚が山札（裏向き、stock[0] が次にめくる札）。
山札は1枚ずつ、何周でもめくれる。組札から列へ戻せる。

使い方:
  validate START END LIMIT_ORDER LIMIT_ABS
                          山札の順番を持つ解法器（元の順番・混ぜ直した順番）と、山札を集合として扱う解法器の判定を比べる
  rows START END LIMIT    seed ごとの計測を1行の JSON で出す（判定・手の内訳・素朴な解き方が詰む位置・組札から戻す手）
  agg                     rows の出力を標準入力から読んでまとめる
  greedy_perm N PERMS     素朴な解き方で解けるかが、山札の順番を混ぜ直すと変わるか
"""
import json
import random
import statistics
import sys
import time

sys.setrecursionlimit(20000)


def rank(c): return c % 13 + 1
def suit(c): return c // 13
def red(c): return suit(c) in (1, 2)


def deal(seed):
    rnd = random.Random(seed)
    d = list(range(52))
    rnd.shuffle(d)
    tab, i = [], 0
    for n in range(1, 8):
        tab.append(tuple(d[i:i + n]))
        i += n
    return tuple(tab), tuple(d[i:])


def can_stack(c, onto):
    return rank(onto) == rank(c) + 1 and red(onto) != red(c)


def run_start(col):
    i = len(col) - 1
    while i > 0 and can_stack(col[i], col[i - 1]):
        i -= 1
    return i


def safe_auto(c, fnd):
    """組札へ置いても、どの読みも損なわない札（反対色の1つ小さい札が組札に出揃っている）"""
    r = rank(c)
    if fnd[suit(c)] != r - 1:
        return False
    if r <= 2:
        return True
    opp = (1, 2) if not red(c) else (0, 3)
    return all(fnd[s] >= r - 1 for s in opp)


def mask(cards):
    m = 0
    for c in cards:
        m |= 1 << c
    return m


class Limit(Exception):
    pass


# ---------- 山札を集合として扱う解法器 ----------
# 1枚めくり・何周でもなら、山札と捨て札に残る札はどれでも、めくり進めれば捨て札の右端に出せる。
# そこで山札と捨て札を「いつでも1枚ずつ取れる札の集合」として扱う。

def auto_abs(tab, sm, fnd, ops=None):
    tab, fnd = list(tab), list(fnd)
    moved = True
    while moved:
        moved = False
        for i, col in enumerate(tab):
            if col and safe_auto(col[-1], fnd):
                c = col[-1]
                fnd[suit(c)] += 1
                tab[i] = col[:-1]
                moved = True
                if ops is not None:
                    ops.append(('t2f', c, True))
        for s in range(4):
            r = fnd[s]
            if r < 13:
                c = s * 13 + r
                if sm >> c & 1 and safe_auto(c, fnd):
                    fnd[s] += 1
                    sm &= ~(1 << c)
                    moved = True
                    if ops is not None:
                        ops.append(('s2f', c, True))
    return tuple(tab), sm, tuple(fnd)


def moves_abs(tab, sm, fnd, f2t=True, prune=True):
    """prune: 山札の札・組札の札を列へ置く手は、その上へすぐ置ける札（反対色で1つ小さい、
    動かせる札）があるときだけ作る。山札の札は何周でも取れるので、置くのを遅らせて損はない。
    組札の札も同じく、上へ置く札が無いうちに列へ戻しても何も開かない。"""
    out = []
    avail = sm
    if prune:
        for col in tab:
            if col:
                for c in col[run_start(col):]:
                    avail |= 1 << c
        for s in range(4):
            if fnd[s] >= 1:
                avail |= 1 << (s * 13 + fnd[s] - 1)

    def has_child(c):
        if not prune:
            return True
        r = rank(c) - 1
        if r < 1:
            return False
        for s in ((0, 3) if red(c) else (1, 2)):
            if avail >> (s * 13 + r - 1) & 1:
                return True
        return False
    for i, col in enumerate(tab):
        if col and fnd[suit(col[-1])] == rank(col[-1]) - 1:
            out.append((0, ('t2f', i)))
    for s in range(4):
        r = fnd[s]
        if r < 13 and sm >> (s * 13 + r) & 1:
            out.append((0, ('s2f', s * 13 + r)))
    empty = [j for j, d in enumerate(tab) if not d]
    e0 = empty[0] if empty else None
    for i, col in enumerate(tab):
        if not col:
            continue
        st = run_start(col)
        for k in range(st, len(col)):
            c = col[k]
            pri = 1 if k == st else 3
            if rank(c) == 13:
                if k > 0 and e0 is not None:
                    out.append((pri, ('t2t', i, k, e0)))
                continue
            for j, dst in enumerate(tab):
                if j != i and dst and can_stack(c, dst[-1]):
                    out.append((pri, ('t2t', i, k, j)))
    for j, dst in enumerate(tab):
        if dst:
            r = rank(dst[-1]) - 1
            if r >= 1:
                for s in ((0, 3) if red(dst[-1]) else (1, 2)):
                    c = s * 13 + r - 1
                    if sm >> c & 1 and has_child(c):
                        out.append((2, ('s2t', c, j)))
    if e0 is not None:
        for s in range(4):
            c = s * 13 + 12
            if sm >> c & 1 and has_child(c):
                out.append((2, ('s2t', c, e0)))
    if f2t:
        for s in range(4):
            if fnd[s] >= 3:
                c = s * 13 + fnd[s] - 1
                if not has_child(c):
                    continue
                for j, dst in enumerate(tab):
                    if dst and can_stack(c, dst[-1]):
                        out.append((5, ('f2t', c, j)))
    return out


def apply_abs(tab, sm, fnd, mv):
    t, f = list(tab), list(fnd)
    kind = mv[0]
    if kind == 't2f':
        i = mv[1]
        c = t[i][-1]
        t[i] = t[i][:-1]
        f[suit(c)] += 1
        op = ('t2f', c, False)
    elif kind == 's2f':
        c = mv[1]
        sm &= ~(1 << c)
        f[suit(c)] += 1
        op = ('s2f', c, False)
    elif kind == 't2t':
        _, i, k, j = mv
        op = ('t2t', len(t[i]) - k, False)
        t[j] = t[j] + t[i][k:]
        t[i] = t[i][:k]
    elif kind == 's2t':
        _, c, j = mv
        sm &= ~(1 << c)
        t[j] = t[j] + (c,)
        op = ('s2t', c, False)
    else:  # f2t
        _, c, j = mv
        f[suit(c)] -= 1
        t[j] = t[j] + (c,)
        op = ('f2t', c, False)
    return tuple(t), sm, tuple(f), op


def solve_abs(tab, sm, fnd=(0, 0, 0, 0), limit=100000, f2t=True, rng=None):
    """戻り値: (判定 'win'/'lose'/'unknown', 探索した局面数, 解の手の並び or None)"""
    seen = set()
    nodes = [0]

    def dfs(tab, sm, fnd):
        ops = []
        tab, sm, fnd = auto_abs(tab, sm, fnd, ops)
        if sum(fnd) == 52:
            return ops
        key = (tuple(sorted(tab)), sm, fnd)
        if key in seen:
            return None
        seen.add(key)
        nodes[0] += 1
        if nodes[0] > limit:
            raise Limit
        ms = moves_abs(tab, sm, fnd, f2t)
        if rng is not None:
            rng.shuffle(ms)
        ms.sort(key=lambda m: m[0])
        for _, mv in ms:
            t2, s2, f2, op = apply_abs(tab, sm, fnd, mv)
            sub = dfs(t2, s2, f2)
            if sub is not None:
                return ops + [op] + sub
        return None

    try:
        path = dfs(tab, sm, fnd)
        return ('win' if path is not None else 'lose'), nodes[0], path
    except Limit:
        return 'unknown', nodes[0], None


def progress_possible(tab, sm, fnd, limit=50000):
    """どう動かしても組札の枚数を今より増やせないなら False（「組札へ運べない」の知らせの条件の一つの読み方）"""
    base = sum(fnd)
    seen = set()
    nodes = [0]

    def dfs(tab, sm, fnd):
        tab, sm, fnd = auto_abs(tab, sm, fnd)
        if sum(fnd) > base:
            return True
        key = (tuple(sorted(tab)), sm, fnd)
        if key in seen:
            return False
        seen.add(key)
        nodes[0] += 1
        if nodes[0] > limit:
            raise Limit
        for _, mv in moves_abs(tab, sm, fnd, True):
            if mv[0] in ('t2f', 's2f') and sum(fnd) + 1 > base:
                return True
            t2, s2, f2, _ = apply_abs(tab, sm, fnd, mv)
            if dfs(t2, s2, f2):
                return True
        return False

    try:
        return ('yes' if dfs(tab, sm, fnd) else 'no'), nodes[0]
    except Limit:
        return 'unknown', nodes[0]


# ---------- 山札の順番を持つ解法器（認識合わせの試算と同じ考え方。検算用） ----------

def solve_order(tab, stock, limit=30000):
    seen = set()
    nodes = [0]

    def auto(tab, waste, fnd):
        tab, waste, fnd = list(tab), list(waste), list(fnd)
        moved = True
        while moved:
            moved = False
            for i, col in enumerate(tab):
                if col and safe_auto(col[-1], fnd):
                    fnd[suit(col[-1])] += 1
                    tab[i] = col[:-1]
                    moved = True
            if waste and safe_auto(waste[-1], fnd):
                fnd[suit(waste[-1])] += 1
                waste.pop()
                moved = True
        return tuple(tab), tuple(waste), tuple(fnd)

    def moves(tab, stock, waste, fnd):
        out = []
        # 列・組札の手は集合版と同じ。捨て札は右端の1枚だけ使える
        top = waste[-1] if waste else None
        sm = mask([top]) if top is not None else 0
        for pri, mv in moves_abs(tab, sm, fnd, True, prune=False):
            t2, s2, f2, _ = apply_abs(tab, sm, fnd, mv)
            w2 = waste[:-1] if (mv[0] in ('s2f', 's2t')) else waste
            out.append((pri, t2, stock, w2, f2))
        if stock:
            out.append((4, tab, stock[1:], waste + (stock[0],), fnd))
        elif waste:
            out.append((6, tab, tuple(waste), (), fnd))
        out.sort(key=lambda m: m[0])
        return out

    def dfs(tab, stock, waste, fnd):
        tab, waste, fnd = auto(tab, waste, fnd)
        if sum(fnd) == 52:
            return True
        key = (tuple(sorted(tab)), stock, waste, fnd)
        if key in seen:
            return False
        seen.add(key)
        nodes[0] += 1
        if nodes[0] > limit:
            raise Limit
        for m in moves(tab, stock, waste, fnd):
            if dfs(*m[1:]):
                return True
        return False

    try:
        return ('win' if dfs(tab, stock, (), (0, 0, 0, 0)) else 'lose'), nodes[0]
    except Limit:
        return 'unknown', nodes[0]


# ---------- 実際の操作へ直す ----------

def count_flips(stock_order, ops):
    """解の手の並びのとおりに山札の札を取るとき、要るめくりの回数と、山札を戻す回数"""
    S, W = list(stock_order), []
    flips = redeals = 0
    for op in ops:
        if op[0] in ('s2f', 's2t'):
            c = op[1]
            while not (W and W[-1] == c):
                if S:
                    W.append(S.pop(0))
                    flips += 1
                else:
                    S, W = W, []
                    redeals += 1
            W.pop()
    return flips, redeals


def op_counts(ops):
    d = {'t2f': 0, 's2f': 0, 't2t': 0, 's2t': 0, 'f2t': 0, 'auto': 0}
    for op in ops:
        d[op[0]] += 1
        if op[2]:
            d['auto'] += 1
    d['non_flip'] = sum(d[k] for k in ('t2f', 's2f', 't2t', 's2t', 'f2t'))
    return d


# ---------- 素朴な解き方（L1 の「置ける所に置き、無ければめくる」） ----------

def greedy_path(tab, stock):
    """組札へ置けるなら置く → 列を丸ごと動かす → 捨て札を列へ → めくる → 山札を戻す。
    同じ局面に戻ったら、そこで手詰まりとする（その周回のめくりは数えない）。
    戻り値: (解けたか, 手の種類の並び, 各手の後の局面（山札+捨て札を集合にしたもの）)"""
    tab, waste, fnd = list(tab), (), [0] * 4
    seen = {}
    kinds = []
    states = [(tuple(tab), mask(stock), tuple(fnd))]
    while True:
        if sum(fnd) == 52:
            return True, kinds, states
        k = (tuple(sorted(tab)), stock, waste, tuple(fnd))
        if k in seen:
            n = seen[k]
            return False, kinds[:n], states[:n + 1]
        seen[k] = len(kinds)
        kind = None
        for i, col in enumerate(tab):
            if col and fnd[suit(col[-1])] == rank(col[-1]) - 1:
                fnd[suit(col[-1])] += 1
                tab[i] = col[:-1]
                kind = 't2f'
                break
        if kind is None and waste and fnd[suit(waste[-1])] == rank(waste[-1]) - 1:
            fnd[suit(waste[-1])] += 1
            waste = waste[:-1]
            kind = 's2f'
        if kind is None:
            for i, col in enumerate(tab):
                if not col:
                    continue
                s = run_start(col)
                c = col[s]
                for j, dst in enumerate(tab):
                    if i == j:
                        continue
                    if (dst and can_stack(c, dst[-1])) or (not dst and rank(c) == 13 and s > 0):
                        tab[j] = dst + col[s:]
                        tab[i] = col[:s]
                        kind = 't2t'
                        break
                if kind:
                    break
        if kind is None and waste:
            c = waste[-1]
            for j, dst in enumerate(tab):
                if (dst and can_stack(c, dst[-1])) or (not dst and rank(c) == 13):
                    tab[j] = dst + (c,)
                    waste = waste[:-1]
                    kind = 's2t'
                    break
        if kind is None and stock:
            waste = waste + (stock[0],)
            stock = stock[1:]
            kind = 'flip'
        if kind is None and waste:
            stock, waste = waste, ()
            kind = 'redeal'
        if kind is None:
            return False, kinds, states
        kinds.append(kind)
        states.append((tuple(tab), mask(stock) | mask(waste), tuple(fnd)))


def first_true(lo, hi, pred):
    """pred は lo..hi で単調（False…False True…True）。最初の True の位置。hi も False なら None"""
    if not pred(hi):
        return None
    while lo < hi:
        mid = (lo + hi) // 2
        if pred(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo


def q(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(len(xs) * p))] if xs else None


def summary(xs):
    if not xs:
        return None
    return {'n': len(xs), 'min': min(xs), 'median': statistics.median(xs), 'p90': q(xs, 0.9), 'max': max(xs)}


# ---------- 計測 ----------

def cmd_validate(start, end, limit_order, limit_abs):
    rows = []
    t0 = time.time()
    for seed in range(start, end):
        tab, stock = deal(seed)
        vo, _ = solve_order(tab, stock, limit_order)
        perm = list(stock)
        random.Random(10_000 + seed).shuffle(perm)
        vp, _ = solve_order(tab, tuple(perm), limit_order)
        va, na, _ = solve_abs(tab, mask(stock), limit=limit_abs)
        rows.append((seed, vo, vp, va, na))
    agg = {}
    for _, vo, vp, va, _ in rows:
        agg[(vo, va)] = agg.get((vo, va), 0) + 1
    contra = [r for r in rows if {'win', 'lose'} <= {r[1], r[2], r[3]}]
    print(json.dumps({
        'seeds': [start, end - 1], 'limit_order': limit_order, 'limit_abs': limit_abs,
        'order_vs_abs': {f'{a}/{b}': v for (a, b), v in sorted(agg.items())},
        'order_win': sum(r[1] == 'win' for r in rows),
        'perm_win': sum(r[2] == 'win' for r in rows),
        'abs': {v: sum(r[3] == v for r in rows) for v in ('win', 'lose', 'unknown')},
        'contradictions': contra,
        'abs_nodes_decided': summary([r[4] for r in rows if r[3] != 'unknown']),
        'sec': round(time.time() - t0, 1),
    }, ensure_ascii=False))


def survey_row(seed, limit):
    t_start = time.time()
    tab, stock = deal(seed)
    sm0 = mask(stock)
    v, nodes, path = solve_abs(tab, sm0, limit=limit)
    row = {'seed': seed, 'verdict': v, 'nodes': nodes}
    g_ok, g_kinds, g_states = greedy_path(tab, stock)
    row['greedy'] = g_ok
    if v == 'win':
        oc = op_counts(path)
        fl, rd = count_flips(stock, path)
        perm_flips = []
        for r in range(20):
            p = list(stock)
            random.Random(1000 * seed + r).shuffle(p)
            perm_flips.append(count_flips(p, path)[0])
        row['dfs'] = {**oc, 'flips': fl, 'redeals': rd,
                      'flips_perm_min': min(perm_flips), 'flips_perm_max': max(perm_flips)}
        variants = []
        for r in range(3):
            vv, _, pp = solve_abs(tab, sm0, limit=limit, rng=random.Random(seed * 7 + r))
            if vv == 'win':
                variants.append({'non_flip': op_counts(pp)['non_flip'], 'flips': count_flips(stock, pp)[0]})
        row['variants'] = variants
        row['without_f2t'] = solve_abs(tab, sm0, limit=limit, f2t=False)[0]
        row['f2t_in_dfs'] = oc['f2t']
    if g_ok:
        gk = {k: g_kinds.count(k) for k in ('t2f', 's2f', 't2t', 's2t', 'flip', 'redeal')}
        gk['non_flip'] = gk['t2f'] + gk['s2f'] + gk['t2t'] + gk['s2t']
        row['greedy_ops'] = gk
    elif v == 'win':
        # 素朴な解き方が手詰まりになった配り方で、解けなくなった手の位置と、手詰まりまでの手
        probes = []

        def verdict_at(i):
            st = g_states[i]
            t = time.time()
            vv, nn, _ = solve_abs(st[0], st[1], st[2], limit=limit)
            probes.append({'i': i, 'v': vv, 'nodes': nn, 'sec': round(time.time() - t, 3)})
            return vv
        end = len(g_kinds)
        ret = {'end': end, 'end_non_flip': sum(k in ('t2f', 's2f', 't2t', 's2t') for k in g_kinds)}
        ve = verdict_at(end)
        if ve == 'win':
            ret['lost'] = False
        elif ve == 'unknown':
            ret['lost'] = 'unknown'
        else:
            ret['lost'] = True
            lo, hi = 0, end  # lo は解ける、hi は解けないと分かった局面
            while hi - lo > 1:
                mid = (lo + hi) // 2
                vm = verdict_at(mid)
                if vm == 'unknown':
                    break
                if vm == 'win':
                    lo = mid
                else:
                    hi = mid
            ret['exact'] = hi - lo == 1
            ret['lose_lo'], ret['lose_hi'] = lo, hi

            def nf(ks):
                return sum(k in ('t2f', 's2f', 't2t', 's2t') for k in ks)
            # 解けなくした手は lo→lo+1 .. hi-1→hi のどれか。手詰まりまでに打った手（取り消す手）の数
            ret['tail_non_flip_min'] = nf(g_kinds[hi - 1:end])
            ret['tail_non_flip_max'] = nf(g_kinds[lo:end])
            ret['tail_all_min'] = end - hi + 1
            ret['tail_all_max'] = end - lo
            ret['tail_fnd_min'] = sum(k in ('t2f', 's2f') for k in g_kinds[hi - 1:end])
            ret['head_non_flip_max'] = nf(g_kinds[:hi - 1])
            ret['head_non_flip_min'] = nf(g_kinds[:lo])
            ret['fnd_at_end'] = sum(g_states[end][2])
        ret['progress_at_end'] = progress_possible(*g_states[end], limit=limit)[0]
        ret['probes'] = probes
        row['retreat'] = ret
    row['sec'] = round(time.time() - t_start, 1)
    return row


def cmd_rows(start, end, limit):
    for seed in range(start, end):
        print(json.dumps(survey_row(seed, limit), ensure_ascii=False), flush=True)


def cmd_agg():
    per = [json.loads(l) for l in sys.stdin if l.startswith('{')]
    per.sort(key=lambda r: r['seed'])
    wins = [r for r in per if r['verdict'] == 'win']
    out = {
        'n': len(per), 'seeds': [per[0]['seed'], per[-1]['seed']],
        'verdict': {v: sum(r['verdict'] == v for r in per) for v in ('win', 'lose', 'unknown')},
        'greedy_win': sum(r['greedy'] for r in per),
        'greedy_win_among_win': sum(r['greedy'] for r in wins),
        'unknown_seeds': [r['seed'] for r in per if r['verdict'] == 'unknown'],
        'lose_seeds': [r['seed'] for r in per if r['verdict'] == 'lose'],
        'sec_total': round(sum(r['sec'] for r in per), 1),
    }
    if wins:
        for k in ('non_flip', 't2f', 's2f', 't2t', 's2t', 'f2t', 'auto', 'flips', 'redeals'):
            out[f'dfs_{k}'] = summary([r['dfs'][k] for r in wins])
        out['dfs_flips_perm_ratio'] = summary([round(r['dfs']['flips_perm_max'] / max(1, r['dfs']['flips_perm_min']), 2) for r in wins])
        vr = [max(x['non_flip'] for x in r['variants'] + [r['dfs']]) / min(x['non_flip'] for x in r['variants'] + [r['dfs']]) for r in wins if r['variants']]
        out['variant_non_flip_ratio'] = summary([round(x, 2) for x in vr])
        out['without_f2t'] = {v: sum(r['without_f2t'] == v for r in wins) for v in ('win', 'lose', 'unknown')}
        out['without_f2t_lose_seeds'] = [r['seed'] for r in wins if r['without_f2t'] == 'lose']
        out['f2t_used_in_dfs'] = sum(r['f2t_in_dfs'] > 0 for r in wins)
    gw = [r for r in per if r.get('greedy_ops')]
    if gw:
        for k in ('non_flip', 't2t', 's2t', 'flip', 'redeal'):
            out[f'greedy_{k}'] = summary([r['greedy_ops'][k] for r in gw])
        both = [r for r in gw if r.get('dfs')]
        out['dfs_over_greedy_non_flip'] = summary([round(r['dfs']['non_flip'] / r['greedy_ops']['non_flip'], 2) for r in both])
    rt = [r['retreat'] for r in per if 'retreat' in r]
    if rt:
        lost = [x for x in rt if x['lost'] is True]
        ex = [x for x in lost if x['exact']]
        out['retreat'] = {
            'cases': len(rt),
            'not_lost_at_greedy_stop': sum(x['lost'] is False for x in rt),
            'lost': len(lost), 'lost_exact': len(ex),
            'lost_unknown': sum(x['lost'] == 'unknown' for x in rt),
            'tail_non_flip_min': summary([x['tail_non_flip_min'] for x in lost]),
            'tail_non_flip_exact': summary([x['tail_non_flip_min'] for x in ex]),
            'tail_all_exact': summary([x['tail_all_min'] for x in ex]),
            'tail_fnd_exact': summary([x['tail_fnd_min'] for x in ex]),
            'head_non_flip_exact': summary([x['head_non_flip_max'] for x in ex]),
            'end_non_flip': summary([x['end_non_flip'] for x in rt]),
            'fnd_at_end_lost': summary([x['fnd_at_end'] for x in lost]),
            'progress_at_end_lost': {v: sum(x['progress_at_end'] == v for x in lost) for v in ('yes', 'no', 'unknown')},
            'progress_at_end_not_lost': {v: sum(x['progress_at_end'] == v for x in rt if x['lost'] is False) for v in ('yes', 'no', 'unknown')},
            'probe_nodes': summary([p['nodes'] for x in rt for p in x['probes']]),
            'probe_sec': summary([p['sec'] for x in rt for p in x['probes']]),
            'probe_unknown': sum(p['v'] == 'unknown' for x in rt for p in x['probes']),
            'probe_total': sum(len(x['probes']) for x in rt),
            'detail': [{'seed': r['seed'], **{k: r['retreat'][k] for k in r['retreat'] if k != 'probes'}} for r in per if 'retreat' in r],
        }
    print(json.dumps(out, ensure_ascii=False))


def cmd_greedy_perm(n, perms):
    """素朴な解き方で解けるかが、山札の順番で変わるか"""
    orig = w2l = l2w = 0
    for seed in range(n):
        tab, stock = deal(seed)
        ok = greedy_path(tab, stock)[0]
        orig += ok
        for r in range(perms):
            p = list(stock)
            random.Random(10_000 * seed + r).shuffle(p)
            ok2 = greedy_path(tab, tuple(p))[0]
            w2l += ok and not ok2
            l2w += (not ok) and ok2
    print(json.dumps({'n': n, 'perms': perms, 'greedy_win_orig': orig,
                      'win_to_lose': [w2l, orig * perms], 'lose_to_win': [l2w, (n - orig) * perms]}))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'greedy_perm':
        cmd_greedy_perm(int(sys.argv[2]), int(sys.argv[3]))
    if cmd == 'validate':
        cmd_validate(int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))
    elif cmd == 'rows':
        cmd_rows(int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]))
    elif cmd == 'agg':
        cmd_agg()
