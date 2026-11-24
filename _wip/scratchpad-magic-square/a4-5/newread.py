"""A4 の5回目の確かめ役が当てる新しい読み方（調査コードは書き換えず、read_solve の写しに口を足す）。

read_solve_x(geo, givens, **kw) は m.read_solve と同じ。kw に次を足せる:
  tchain: 0 / 3 / 4   鎖を、空きが e マス（e <= tchain）でそのうち e-1 マスが鎖の中にある列でも延ばす（t の1つで決まる）。段2
  tchain_close: True  延ばした先のマスから、さらに空き2の列・上の列をたどる（閉包）。False なら鎖から1歩だけ
  tchain_coef0: True  延ばす列は、残る1マスが t に依らない（定数になる）ものだけ
  parity: 段 t     この段から偶奇で絞る（列の空きのうち1マスを除く全部のメモが同じ偶奇なら、残る1マスの偶奇が決まる）
  parity_e: e      偶奇を当てる列の空きの下限
  chain_nodist: True 鎖・延ばした鎖の中で、同じ列に入らないマスどうしの数が違うことを確かめない
  eager: True      近道を、近道なしで置ける所でも一緒に読む（近道で見つかったマスも置く。所の段は近道なしの段）
"""
import inspect
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m  # noqa: E402

bits = m.bits
popcount = m.popcount


def _tchain_units(geo, grid, opt, lines, base_units):
    E = opt.get("tchain", 0)
    if not E:
        return []
    clines = lines if opt["diag_chain"] else [L for i, L in enumerate(lines) if i not in (2 * geo.n, 2 * geo.n + 1)]
    st = [(li, em, r) for li, em, r in m._line_states(geo, grid, clines) if 2 <= len(em) <= E]
    diag_cells = {tuple(sorted(geo.lines[2 * geo.n])), tuple(sorted(geo.lines[2 * geo.n + 1]))}
    if opt.get("tchain_nodiag"):
        # 斜めの列を、延ばす列にも、延ばす元の鎖にも使わない（基準の鎖はそのまま）
        dg = set(geo.lines[2 * geo.n]) | set(geo.lines[2 * geo.n + 1])
        st = [(li, em, r) for li, em, r in m._line_states(geo, grid, [L for i, L in enumerate(clines) if i not in (2 * geo.n, 2 * geo.n + 1)]) if 2 <= len(em) <= E]
    out = []
    seen = set()
    for u in base_units:
        if u["kind"] != "chain":
            continue
        if opt.get("tchain_nodiag") and u["key"][1:] and any(k >= 2 * geo.n for k in u["key"][1:]):
            continue
        # 係数を追う: 鎖の最初のマスを +t とする
        eqs = list(u["eqs"])
        keys = set()
        for cc, co, r in eqs:
            keys.add(tuple(sorted(cc)))
        cells = set(u["cells"])
        coef = {}
        # 鎖の係数を BFS で
        start = u["cells"][0]
        coef[start] = 1
        changed = True
        while changed:
            changed = False
            for cc, co, r in eqs:
                kn = [c for c in cc if c in coef]
                un = [c for c in cc if c not in coef]
                if len(un) == 1 and kn:
                    coef[un[0]] = -sum(coef[c] for c in kn)
                    changed = True
        orig = set(cells)
        added = 0
        grow = True
        while grow:
            grow = False
            for li, em, r in st:
                key = tuple(sorted(em))
                if key in keys:
                    continue
                inside = [c for c in em if c in cells]
                base_set = cells if opt.get("tchain_close", True) else orig
                inside_b = [c for c in em if c in base_set]
                if len(em) - len(inside_b) > 1 or len(inside_b) < len(em) - 1:
                    continue
                if len(em) == 2:
                    # 空き2の列は、延ばした先のマス（鎖の外）からつながる列だけ足す（鎖そのものは鎖の単位のまま）
                    if not opt.get("tchain_close", True) or any(c in orig for c in em):
                        continue
                new = [c for c in em if c not in cells]
                if len(em) >= 3 and opt.get("tchain_coef0") and new:
                    if all(c in coef for c in inside) and sum(coef[c] for c in inside) != 0:
                        continue
                keys.add(key)
                eqs.append((em, (1,) * len(em), r))
                for c in new:
                    cells.add(c)
                    if all(x in coef for x in inside):
                        coef[c] = -sum(coef[x] for x in inside)
                if len(em) >= 3:
                    added += 1
                grow = True
        if not added:
            continue
        k = tuple(sorted(keys))
        if k in seen:
            continue
        seen.add(k)
        out.append({"kind": "chain", "cells": sorted(cells), "eqs": eqs, "tier": 2,
                    "key": ("TK",) + k, "lines": len(eqs)})
    return out


def _dof_units(geo, grid, opt, lines):
    """空き2〜dof_e の列のつながった2〜dofk 本の組（空き3以上の列を含むもの）。段は 仮に置く数の数 = マス − 式 + 1（2 以上）。"""
    K = opt.get("dofk", 0)
    if not K:
        return []
    E = opt.get("dof_e", 3)
    tmax = opt.get("dof_tmax", 3)
    clines = lines if opt["diag_chain"] else [L for i, L in enumerate(lines) if i not in (2 * geo.n, 2 * geo.n + 1)]
    st = [(li, em, r) for li, em, r in m._line_states(geo, grid, clines) if 2 <= len(em) <= E]
    idx = list(range(len(st)))
    adj = {i: {j for j in idx if j != i and set(st[i][1]) & set(st[j][1])} for i in idx}
    out = []
    for kk in range(2, K + 1):
        for sub in m._connected_subsets(idx, adj, kk):
            if all(len(st[i][1]) == 2 for i in sub):
                continue
            eqs = [(st[i][1], (1,) * len(st[i][1]), st[i][2]) for i in sub]
            cells = sorted({c for i in sub for c in st[i][1]})
            t = max(2, len(cells) - len(eqs) + 1)
            if t > tmax:
                continue
            out.append({"kind": "joint", "cells": cells, "eqs": eqs, "tier": t, "natural": t,
                        "key": ("DK",) + tuple(sorted(st[i][0] for i in sub)), "lines": kk})
    return out


def _build_units_x(geo, grid, opt, lines):
    units = m.build_units(geo, grid, opt, lines)
    if opt.get("dofk"):
        units = units + _dof_units(geo, grid, opt, lines)
    if opt.get("tchain"):
        # 鎖の基の単位（chain_limit に従う）から延ばす
        base = [u for u in units if u["kind"] == "chain" and u["key"][0] == "K"]
        units = units + _tchain_units(geo, grid, opt, lines, base)
    return units


def _enumerate_eqs_nodist(cells, eqs, cand, N, cap):
    """enumerate_eqs と同じだが、数が違うことは同じ式の中だけで確かめる。"""
    e = len(cells)
    pos = {c: i for i, c in enumerate(cells)}
    es = [([pos[c] for c in cc], list(co), r) for cc, co, r in eqs]
    order = []
    left = set(range(e))
    first = min(left, key=lambda i: popcount(cand[cells[i]]))
    order.append(first)
    left.discard(first)
    while left:
        def score(i):
            k = 0
            for vs, co, r in es:
                if i in vs:
                    k += sum(1 for v in vs if v in order)
            return (-k, popcount(cand[cells[i]]))
        nxt = min(left, key=score)
        order.append(nxt)
        left.discard(nxt)
    rank = {i: k for k, i in enumerate(order)}
    by_last = {}
    for j, (vs, co, r) in enumerate(es):
        by_last.setdefault(max(rank[v] for v in vs), []).append(j)
    nb = {i: set() for i in range(e)}
    for vs, co, r in es:
        for a in vs:
            for b in vs:
                if a != b:
                    nb[a].add(b)
    val = [0] * e
    assigned = [False] * e
    sup = [0] * e
    sets = set()
    req = [-1]
    cnt = [0]
    nodes = [0]

    def rec(k):
        nodes[0] += 1
        if nodes[0] > cap:
            raise m.LineReadCap
        if k == e:
            s = 0
            for i in range(e):
                sup[i] |= 1 << val[i]
                s |= 1 << val[i]
            sets.add(s)
            req[0] &= s
            cnt[0] += 1
            return
        i = order[k]
        forced = None
        for j in by_last.get(k, []):
            vs, co, r = es[j]
            acc = r
            ci = 0
            for v, c in zip(vs, co):
                if v == i:
                    ci += c
                else:
                    acc -= c * val[v]
            if ci == 0:
                continue
            if acc % ci:
                return
            x = acc // ci
            if forced is None:
                forced = x
            elif forced != x:
                return
        used = 0
        for j in nb[i]:
            if assigned[j]:
                used |= 1 << val[j]
        mm = cand[cells[i]] & ~used
        if forced is not None:
            opts = [forced] if 1 <= forced <= N and (mm >> forced) & 1 else []
        else:
            opts = list(bits(mm))
        for x in opts:
            val[i] = x
            ok = True
            for j in by_last.get(k, []):
                vs, co, r = es[j]
                if sum(c * val[v] for v, c in zip(vs, co)) != r:
                    ok = False
                    break
            if ok:
                assigned[i] = True
                rec(k + 1)
                assigned[i] = False

    rec(0)
    # 必ず使う数は、単位の中で数が重なりうるので、全部の入れ方に出る数（重なりを数えない）
    return sup, (req[0] if cnt[0] else 0), len(sets), cnt[0]


def _read_unit_x(u, src, N, cap, opt):
    if u["kind"] == "chain" and opt.get("chain_nodist"):
        return _enumerate_eqs_nodist(u["cells"], u["eqs"], src, N, cap)
    return m.read_unit(u, src, N, cap)


def _parity_hook(opt, geo, grid, lines, new, src, unused, tier, empties):
    pt = opt.get("parity")
    if not pt or tier < pt:
        return
    pe = opt.get("parity_e", 3)
    odd = 0
    for v in bits(unused):
        if v & 1:
            odd |= 1 << v
    even = unused & ~odd
    for li, em, r in m._line_states(geo, grid, lines):
        e = len(em)
        if e < max(pe, 2):
            continue
        par = {}
        for c in em:
            s = src[c]
            if s & odd and not s & even:
                par[c] = 1
            elif s & even and not s & odd:
                par[c] = 0
        if len(par) < e - 1:
            continue
        for c in em:
            others = [x for x in em if x != c]
            if all(x in par for x in others):
                p = (r - sum(par[x] for x in others)) & 1
                new[c] &= odd if p else even


def _make():
    src = inspect.getsource(m.read_solve)
    src = src.replace("def read_solve(", "def read_solve_x(", 1)
    a = 'sup, req, nsets, _ = read_unit(u, src, N, opt["enum_cap"])'
    assert src.count(a) == 1
    src = src.replace(a, 'sup, req, nsets, _ = _read_unit_x(u, src, N, opt["enum_cap"], opt)')
    a = "            apply_bounds(new, empties, tier)\n"
    assert src.count(a) == 1
    src = src.replace(a, a + "            _parity_hook(opt, geo, grid, lines, new, src, unused, tier, empties)\n")
    a = "units = build_units(geo, grid, opt, lines)"
    assert src.count(a) == 1
    src = src.replace(a, "units = _build_units_x(geo, grid, opt, lines)")
    # eager: 近道なしで置けた所でも、近道を一緒に読んだ結果を使う（所の段は近道なしの段、巡は近道なしの巡を超えない）
    a = """        r = run_tier(tier, dict(start), units, empties, max_sweeps, plain=True)
        if r["placements"]:
            return tier, r
"""
    assert src.count(a) == 1
    b = """        r = run_tier(tier, dict(start), units, empties, max_sweeps, plain=True)
        if r["placements"]:
            if opt.get("eager"):
                re_ = run_tier(tier, dict(start), units, empties, max_sweeps)
                if re_["placements"] and re_["sweeps"] <= r["sweeps"]:
                    if opt["eager"] == "split":
                        extra = set(re_["placements"]) - set(r["placements"])
                        if extra and re_["sweeps"] == r["sweeps"]:
                            re_ = dict(re_)
                            re_["split"] = set(r["placements"])
                            return tier, re_
                        if extra and re_["sweeps"] < r["sweeps"]:
                            return tier + 1, re_
                        return tier, r
                    return tier, re_
            return tier, r
"""
    src = src.replace(a, b)
    a = """            "cells": sorted(placements),
        })
"""
    assert src.count(a) == 1
    src = src.replace(a, a + """        if r.get("split"):
            st_ = steps.pop()
            a_ = dict(st_)
            a_["cells"] = [c for c in st_["cells"] if c in r["split"]]
            a_["placed"] = a_["found"] = len(a_["cells"])
            b_ = dict(st_)
            b_["tier"] = tier + 1
            b_["cells"] = [c for c in st_["cells"] if c not in r["split"]]
            b_["placed"] = b_["found"] = len(b_["cells"])
            steps.append(a_)
            steps.append(b_)
""")
    # chain_eph: 鎖で絞った候補をメモに書かない（その巡の置き場所探しにだけ使う）
    a = """                for c, m in zip(u["cells"], sup):
                    new[c] &= m
"""
    assert src.count(a) == 1
    src = src.replace(a, """                if opt.get("chain_eph") and u["kind"] == "chain":
                    for c, m in zip(u["cells"], sup):
                        ceph[c] = ceph.get(c, -1) & m
                else:
                    for c, m in zip(u["cells"], sup):
                        new[c] &= m
""")
    a = "            lock_later = []\n"
    assert src.count(a) == 1
    src = src.replace(a, a + "            ceph = {}\n")
    a = "            placements: dict[int, int] = {}\n"
    assert src.count(a) == 1
    src = src.replace(a, """            eff_mem = eff
            if ceph:
                eff = dict(eff)
                for c, mm in ceph.items():
                    eff[c] &= mm
""" + a)
    a = 'nxt = memo_filter(new if opt["lock_ephemeral"] else eff)'
    assert src.count(a) == 1
    src = src.replace(a, 'nxt = memo_filter(new if opt["lock_ephemeral"] else (eff_mem if ceph else eff))')
    import textwrap
    src = textwrap.dedent(src)
    g = m.__dict__
    g["_read_unit_x"] = _read_unit_x
    g["_parity_hook"] = _parity_hook
    g["_build_units_x"] = _build_units_x
    exec(compile(src, "<read_solve_x>", "exec"), g)
    return g["read_solve_x"]


read_solve_x = _make()

NEW = {
    "tchain3": {"tchain": 3},
    "tchain3_1": {"tchain": 3, "tchain_close": False},
    "tchain3_c0": {"tchain": 3, "tchain_coef0": True},
    "tchain4": {"tchain": 4},
    "tchain3_nodiag": {"tchain": 3, "tchain_nodiag": True},
    "parity1": {"parity": 1, "parity_e": 3},
    "parity2": {"parity": 2, "parity_e": 3},
    "parity1e2": {"parity": 1, "parity_e": 2},
    "chain_nodist": {"chain_nodist": True},
    "lock_memo": {"lock_scope": "memo"},
    "chain_eph": {"chain_eph": True},
    "dof3": {"dofk": 3, "dof_e": 3},          # 3本まで、空き3まで、段は仮に置く数の数
    "dof4": {"dofk": 4, "dof_e": 3},
    "dof3e4": {"dofk": 3, "dof_e": 4},
    "dof3t2": {"dofk": 3, "dof_e": 3, "dof_tmax": 2},  # 仮に置く数が1つの組だけ（段2）
    "memo4x": {"memo_max": 4, "memo_excl": True},
    "eager_pair1": {"pair1": True, "pair1_raw": True, "eager": True},
    "split_pair1": {"pair1": True, "pair1_raw": True, "eager": "split"},
    "split_short3_2": {"short3_sets": 2, "eager": "split"},
    "split_short3_4": {"short3_sets": 4, "eager": "split"},
    "split_jk2s2": {"jointk": 2, "short_joint_sets": 2, "eager": "split"},
    "eager_short3_1": {"short3_sets": 1, "eager": True},
    "eager_short3_2": {"short3_sets": 2, "eager": True},
    "eager_short3_4": {"short3_sets": 4, "eager": True},
    "eager_jk2s2": {"jointk": 2, "short_joint_sets": 2, "eager": True},
}


def kw_of(name):
    """部品の名前と NEW の名前を + でつないだもの。部品の設定は variant_kw（merge）で重ねる。"""
    parts = name.split("+")
    std = [p for p in parts if p in m.VARIANTS]
    new = [p for p in parts if p in NEW]
    assert len(std) + len(new) == len(parts), name
    kw = m.variant_kw("+".join(std), merge=True) if std else {}
    kw = dict(kw)
    for p in new:
        for k, v in NEW[p].items():
            if k in kw and kw[k] != v and k in m.MERGE_MAX:
                v = max(kw[k], v)
            kw[k] = v
    return kw


def level_of(n, g, kw, sizes=None):
    geo = m.geo_of(n)
    res = read_solve_x(geo, g, **kw)
    f = m.read_features(geo, g, res)
    if n == 4:
        f["_virtual"] = m.read_features(geo, g, read_solve_x(geo, g, extra_lines=m.VIRTUAL4, **kw))
    lv, why = m.single_level_v6(f, n, sizes, cap=None)
    return lv, why, f, res
