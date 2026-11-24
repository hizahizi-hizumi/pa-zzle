"""範囲内の問題に、名前つきの読み方（設定）を当て、レベルが動く割合を出す。
python3 -I run_probe.py <group> [--limit N]
group: pairs / triples / new / tiers / ...（下の GROUPS）"""
from __future__ import annotations

import collections
import itertools
import json
import multiprocessing as mp
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlib  # noqa: E402

m = xlib.m
BASE19 = [v for v in m.AGREE if v not in ("strong", "weak")]


def _conflict(names):
    seen = {}
    for nm in names:
        for k, v in m.VARIANTS[nm].items():
            if k in seen and seen[k] != v:
                return True
            seen[k] = v
    return False


def combo(names):
    kw = {}
    for nm in names:
        kw.update(m.VARIANTS[nm])
    return kw


def group_pairs():
    out = {}
    for a, b in itertools.combinations(BASE19, 2):
        if not _conflict([a, b]):
            out[f"{a}+{b}"] = (combo([a, b]), False)
    return out


def group_triples(k=100000, seed=7):
    allt = [t for t in itertools.combinations(BASE19, 3) if not _conflict(t)]
    r = random.Random(seed)
    pick = r.sample(allt, min(k, len(allt)))
    return {"+".join(t): (combo(t), False) for t in pick}


def group_sw():
    """strong・weak に、それに入っていない変種を1つ足す。"""
    out = {}
    for base in ("strong", "weak"):
        for v in BASE19:
            names = [base, v]
            kw = dict(m.VARIANTS[base])
            clash = any(k in kw and kw[k] != val for k, val in m.VARIANTS[v].items())
            if clash:
                continue
            kw.update(m.VARIANTS[v])
            if kw == m.VARIANTS[base]:
                continue
            out[f"{base}+{v}"] = (kw, False)
    return out


def group_new():
    S = {}
    for K in (2, 3, 4, 6):
        S[f"memo<={K}"] = ({"memo_max": K}, True)
    S["naked2"] = ({"naked": 2}, True)
    S["naked3"] = ({"naked": 3}, True)
    S["naked2_t2"] = ({"naked": 2, "naked_tier": 2}, True)
    S["hpair"] = ({"hpair": True}, True)
    S["naked3+hpair"] = ({"naked": 3, "hpair": True}, True)
    S["trial2"] = ({"trial": 2}, True)
    S["trial3"] = ({"trial": 3}, True)
    S["trial2c3"] = ({"trial": 2, "trial_maxc": 3}, True)
    S["pair_t1"] = ({"pair_t1": True}, True)
    S["one_max"] = ({"batch": False, "one_pick": "max"}, True)
    S["one+memoryless"] = ({"batch": False, "memory": False}, True)
    return S


def group_tiers():
    S = {}
    S["jk2@t2"] = ({"jointk": 2, "jointk_tier": 2}, True)
    S["jk3d2@t2"] = ({"jointk": 3, "jointk_dof": 2, "jointk_tier": 2}, True)
    S["chain>=3@t3"] = ({"chain_tier3_from": 3}, True)
    S["chain>=4@t3"] = ({"chain_tier3_from": 4}, True)
    S["chain@t3"] = ({"chain_tier3_from": 2}, True)
    S["lock@t3"] = ({"lock_min_tier": 3}, True)
    S["hidden@t3"] = ({"hidden_min_tier": 3}, True)
    S["short3_1@t2+chain>=3@t3"] = ({"short3_sets": 1, "chain_tier3_from": 3}, True)
    S["jk2@t2+chain>=3@t3"] = ({"jointk": 2, "jointk_tier": 2, "chain_tier3_from": 3}, True)
    return S


def group_selfcheck():
    """xlib の写しが元と同じ結果になるかの確かめ（use_x=True で元の変種を当てる）。"""
    return {f"x:{v}": (m.VARIANTS[v], True) for v in ("carry", "lock_next", "weak", "strong", "one", "memoryless")} | {
        "x:base": ({}, True)}


def group_new2():
    S = {}
    S["line_hidden"] = ({"line_hidden_only": True}, True)
    S["line_hidden_plus"] = ({"line_hidden_plus": True}, True)
    for K in (2, 3, 4, 6):
        S[f"memo_step<={K}"] = ({"memo_max": K, "memo_scope": "step"}, True)
    for K in (5, 8, 10, 12):
        S[f"memo<={K}"] = ({"memo_max": K}, True)
    S["chain>=5@t3"] = ({"chain_tier3_from": 5}, True)
    # memo<=K に一致の変種を重ねる
    for v in ("carry", "cum", "lock_all", "range2", "short3_2", "strong", "weak"):
        S[f"memo<=6+{v}"] = ({**m.VARIANTS[v], "memo_max": 6}, True)
    return S


def group_new3():
    S = {}
    for K in (0, 2, 4, 6):
        S[f"memo_hull<={K}"] = ({"memo_max": K, "memo_hull": True}, True)
    for v in ("range1", "jointk2", "short3_1", "viol1", "one", "fewest", "lock_eph", "memoryless"):
        S[f"memo<=6+{v}"] = ({**m.VARIANTS[v], "memo_max": 6}, True)
    S["memo<=8+cum"] = ({**m.VARIANTS["cum"], "memo_max": 8}, True)
    S["memo<=8+weak"] = ({**m.VARIANTS["weak"], "memo_max": 8}, True)
    S["memo<=10+weak"] = ({**m.VARIANTS["weak"], "memo_max": 10}, True)
    S["memo<=7"] = ({"memo_max": 7}, True)
    S["line_hidden+lock_all"] = ({"line_hidden_only": True, "lock_scope": "all"}, True)
    return S


def group_diag():
    S = {}
    S["diag_nochain"] = ({"diag_mode": "nochain"}, True)
    S["diag_t1only"] = ({"diag_mode": "t1only"}, True)
    return S


def group_lne():
    S = {}
    S["lock_next_eph"] = ({"lock_next": True, "lock_next_eph": True, "lock_ephemeral": True}, True)
    S["lock_next_eph+nohidden"] = ({"lock_next": True, "lock_next_eph": True, "lock_ephemeral": True, "hidden": False}, True)
    S["lock_next_eph+memoryless"] = ({"lock_next": True, "lock_next_eph": True, "lock_ephemeral": True, "memory": False}, True)
    S["lock_next_eph+cum"] = ({"lock_next": True, "lock_next_eph": True, "lock_ephemeral": True, "count": "cum"}, True)
    S["weak_eph"] = ({**m.VARIANTS["weak"], "lock_next_eph": True, "lock_ephemeral": True}, True)
    return S


GROUPS = {"lne": group_lne, "diag": group_diag, "new3": group_new3, "pairs": group_pairs, "triples": group_triples, "sw": group_sw, "new": group_new, "tiers": group_tiers,
          "selfcheck": group_selfcheck, "new2": group_new2}

_SET = None


def _init(settings):
    global _SET
    _SET = settings


def _work(d):
    n = d["features"]["n"]
    g = d["givens"]
    out = {}
    for name, (kw, use_x) in _SET.items():
        try:
            lv, why, f = xlib.level_of(n, g, kw, use_x)
        except Exception as e:  # noqa: BLE001
            lv, why, f = None, f"error:{type(e).__name__}", {}
        out[name] = [lv, why, f.get("entry"), f.get("first_tier"), f.get("first_sweeps"), f.get("d2max"),
                     f.get("t3"), f.get("d3max"), f.get("tier_max")]
    return d["id"], out


def summarize(ins, res, settings, fh=sys.stdout):
    byid = {d["id"]: d for d in ins}
    rows = []
    for name in settings:
        ch = collections.Counter()
        per_n = collections.Counter()
        tot_n = collections.Counter()
        per_k = collections.Counter()
        tot_k = collections.Counter()
        for i, r in res.items():
            d = byid[i]
            n = d["features"]["n"]
            pk = "k12" if d["k"] == 12 else "k0-2"
            tot_n[n] += 1
            tot_k[pk] += 1
            lv = r[name][0]
            if lv != d["level"]:
                ch[(d["level"], lv if lv else r[name][1])] += 1
                per_n[n] += 1
                per_k[pk] += 1
        c = sum(ch.values())
        rows.append((c, name, ch, per_n, tot_n, per_k, tot_k))
    rows.sort(key=lambda x: -x[0])
    for c, name, ch, per_n, tot_n, per_k, tot_k in rows:
        tot = sum(tot_n.values())
        pn = " ".join(f"{n}×{n} {per_n[n]}/{tot_n[n]}" for n in sorted(tot_n))
        pk = " ".join(f"{k} {per_k[k]}/{tot_k[k]}" for k in sorted(tot_k))
        mv = ", ".join(f"L{a}→{b if isinstance(b, str) else 'L' + str(b)} {k}" for (a, b), k in ch.most_common(5))
        print(f"{name}: {c}/{tot} ({c / tot:.1%}) | {pn} | {pk} | {mv}", file=fh)


def main():
    grp = sys.argv[1]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[2] == "--limit" else None
    settings = GROUPS[grp]()
    _, ins = xlib.load_inrange()
    if limit:
        ins = ins[:limit]
    t0 = time.time()
    with mp.Pool(4, initializer=_init, initargs=(settings,)) as pool:
        res = dict(pool.imap_unordered(_work, ins, chunksize=2))
    outp = os.path.join(xlib.HERE, f"res_{grp}.jsonl")
    with open(outp, "w") as fh:
        for i, r in res.items():
            fh.write(json.dumps({"id": i, "r": r}) + "\n")
    print(f"{grp}: {len(settings)} settings × {len(ins)} problems in {time.time() - t0:.0f}s")
    summarize(ins, res, settings)


if __name__ == "__main__":
    main()
