"""範囲内の候補（data/superset.jsonl。後で組み合わせの一致で絞る）に、新しい読み方を当ててレベルを比べる。
python3 -I run_exp.py <組の名前> [jobs]  → data/res_<組>.jsonl に (id, 読み方, レベル, 理由, 特徴の要点) を書く（続きから）。"""
import collections
import json
import multiprocessing as mp
import os
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6")
import exp  # noqa: E402

m = exp.m
D = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-6/data"

SETS = {
    # 3. 鎖の延ばし方の別の形
    "ext": {
        "ext_rowcol": (None, {"x_ext_rowcol": True}),
        "ext_short2": (None, {"x_ext_maxlines": 2}),
        "ext_short3": (None, {"x_ext_maxlines": 3}),
        "ext_nolock": (None, {"x_ext_nolock": True}),
        "ext_nomemo": (None, {"x_ext_nomemo": True}),
        "ext_coef1": (None, {"x_ext_coef": {1}}),
        "ext_coef01": (None, {"x_ext_coef": {0, 1}}),
        "ext_nocheck": (None, {"x_ext_nocheck": True}),
        "ext_cells6": (None, {"x_ext_maxcells": 6}),
        "ext_cells8": (None, {"x_ext_maxcells": 8}),
        "ext_late": (None, {"x_ext_late": True}),
        "ext_t3": (None, {"x_ext_t3": True}),
        "ext_c2t3": (None, {"x_ext_coef2_t3": True}),
    },
    # 組の数を他で使わないの範囲・メモ
    "lock": {
        "lock_line": (None, {"x_lock_line": True}),
        "lock_t2": (None, {"x_lock_maxtier": 2}),
        "lock_s3": (None, {"x_lock_maxsets": 3}),
        "memo_t2only": (None, {"x_memo_t2only": True}),
        "memo4_t2only": ("memo4", {"x_memo_t2only": True}),
    },
    # メモの上限を巡の中でも当てる（頭の中で2つの列の候補を重ねない人）
    "memo": {
        "memo4s": (None, {"memo_max": 4, "x_memo_strict": 4}),
        "memo4q": (None, {"memo_max": 4, "x_memo_seq": 4}),
        "memo5s": (None, {"memo_max": 5, "x_memo_strict": 5}),
        "memo6s": (None, {"memo_max": 6, "x_memo_strict": 6}),
        "memo8s": (None, {"memo_max": 8, "x_memo_strict": 8}),
        "memo6q": (None, {"memo_max": 6, "x_memo_seq": 6}),
    },
    # 組が K 通りを超える単位（空き3の列・鎖も）を読まない
    "cap": {
        "capall3": (None, {"sets_cap": 3, "sets_cap_all": True}),
        "capall4": (None, {"sets_cap": 4, "sets_cap_all": True}),
        "capall6": (None, {"sets_cap": 6, "sets_cap_all": True}),
        "capall8": (None, {"sets_cap": 8, "sets_cap_all": True}),
        "capall12": (None, {"sets_cap": 12, "sets_cap_all": True}),
        "capall20": (None, {"sets_cap": 20, "sets_cap_all": True}),
    },
    # 部品をたくさん重ねた端（4つ以上の組の上限を見るため。人の読みとしては不自然）
    "bundle": {
        "W_A": ("weak+lock_eph+chain_late+diag_nochain+tchain_none+chain4t3+one", {}),
        "W_B": ("cum+lock_next+chain2+nohidden+chain_nolock+memo4+lock_eph+chain_late+diag_nochain+tchain_none+chain4t3+one", {}),
        "W_C": ("memo4+chain_late+lock_eph+tchain_none+diag_nochain", {}),
        "W_D": ("memo4+chain_late+carry+lock_eph", {}),
        "S_A": ("strong+mrange1+short3_4+jointk2_s2+pair1+fewest", {}),
        "S_B": ("range1+mrange1+lock_all+carry", {}),
        "M_A": ("memo4+chain_late+carry+lock_eph+pair1", {}),
    },
}

NEWS = {**SETS["ext"], **SETS["lock"], "capall6": SETS["cap"]["capall6"], "capall8": SETS["cap"]["capall8"]}
SETS["xcomp"] = {f"{a}+{c}": (c, b[1]) for a, b in NEWS.items() if b[0] is None for c in m.AGREE}

NEWS2 = {"cap2_4": (None, {"sets_cap": 4}), "cap2_6": (None, {"sets_cap": 6}), "cap2_8": (None, {"sets_cap": 8}),
         "memo4s": SETS["memo"]["memo4s"]}
SETS["cap2"] = dict(NEWS2)
M4 = {"memo4s": {"memo_max": 4, "x_memo_strict": 4}, "memo4q": {"memo_max": 4, "x_memo_seq": 4},
      "memo4q_few": {"memo_max": 4, "x_memo_seq": 4, "x_order": "few"},
      "memo4q_rev": {"memo_max": 4, "x_memo_seq": 4, "x_order": "rev"},
      "memo6s": {"memo_max": 6, "x_memo_strict": 6}, "memo8s": {"memo_max": 8, "x_memo_strict": 8}}
SETS["late"] = {f"{a}+{c}": (c, b) for a, b in M4.items() for c in ("chain_late", "diag_nochain", "tchain_none", "chain2", "chain4t3", "weak")}
SETS["capl"] = {f"capL{k}{'f' if f else ''}+{c}": (c, {"x_cap_line2": k, "x_cap_first": f})
                for k in (3, 4, 5, 6) for f in (False, True) for c in (None, "chain_late", "diag_nochain", "memo4", "chain_late+memo4", "diag_nochain+memo4")}
SETS["late2"] = {}
for K in (4, 6, 8, 10):
    for o in (None, "few"):
        for c in ("chain_late", "diag_nochain", None):
            SETS["late2"][f"memo{K}q{'_few' if o else ''}+{c}"] = (c, {"memo_max": K, "x_memo_seq": K, "x_order": o})
    SETS["late2"][f"memo{K}s+chain_late"] = ("chain_late", {"memo_max": K, "x_memo_strict": K})
    SETS["late2"][f"memo{K}s+diag_nochain"] = ("diag_nochain", {"memo_max": K, "x_memo_strict": K})
SETS["late"].update({f"cap2_{k}+{c}": (c, {"sets_cap": k}) for k in (3, 4, 5, 6, 8) for c in ("chain_late", "diag_nochain", "tchain_none", "chain2", "weak")})
SETS["xcomp2"] = {f"{a}+{c}": (c, b[1]) for a, b in NEWS2.items() for c in m.AGREE}


def spec_kw(spec):
    name, extra = spec
    kw = m.variant_kw(name, merge=True) if name else {}
    assert kw is not None, name
    return {**kw, **extra}


def job(args):
    d, names, specs = args
    out = []
    for nm in names:
        kw = spec_kw(specs[nm])
        geo = m.geo_of(d["n"])
        res = exp.read_solve_x(geo, d["givens"], **kw)
        f = m.read_features(geo, d["givens"], res)
        if d["n"] == 4:
            f["_virtual"] = m.read_features(geo, d["givens"], exp.read_solve_x(geo, d["givens"], extra_lines=m.VIRTUAL4, **kw))
        lv, why = m.single_level_v6(f, d["n"], None, cap=None)
        out.append({"id": d["id"], "v": nm, "lv": lv, "why": why,
                    "f": {k: f[k] for k in ("entry", "first_tier", "first_sweeps", "tier_max", "d2max", "t3", "d3max", "status")},
                    "steps": [[s["tier"], s["sweeps"], s["found"]] for s in res["steps"]]})
    return out


def load_superset():
    return [json.loads(x) for x in open(f"{D}/superset.jsonl") if '"level":null' not in x]


def main():
    setname = sys.argv[1]
    jobs = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    specs = SETS[setname]
    rows = load_superset()
    path = f"{D}/res_{setname}.jsonl"
    done = collections.defaultdict(set)
    if os.path.exists(path):
        for x in open(path):
            r = json.loads(x)
            done[r["id"]].add(r["v"])
    todo = [(d, [nm for nm in specs if nm not in done[d["id"]]], specs) for d in rows]
    todo = [t for t in todo if t[1]]
    with mp.Pool(jobs) as pool, open(path, "a") as fh:
        for out in pool.imap_unordered(job, todo, chunksize=2):
            for r in out:
                fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            fh.flush()
    summarize(setname)


def summarize(setname, ids=None):
    rows = {d["id"]: d for d in load_superset()}
    if ids is not None:
        rows = {k: v for k, v in rows.items() if k in ids}
    res = [json.loads(x) for x in open(f"{D}/res_{setname}.jsonl")]
    by = collections.defaultdict(list)
    for r in res:
        if r["id"] in rows:
            by[r["v"]].append(r)
    tot = collections.Counter(d["n"] for d in rows.values())
    for v, rs in by.items():
        mv = [r for r in rs if r["lv"] != rows[r["id"]]["raw"]]
        per = collections.Counter(rows[r["id"]]["n"] for r in mv)
        tr = collections.Counter((rows[r["id"]]["n"], rows[r["id"]]["raw"], r["lv"] or r["why"]) for r in mv)
        print(f"{v}: {len(mv)}/{len(rs)} ({len(mv) / max(len(rs), 1):.1%}) "
              + " ".join(f"{n}x{n} {per[n]}/{tot[n]}" for n in (4, 5, 6))
              + " | " + ", ".join(f"{n}:L{a}->{b} {k}" for (n, a, b), k in sorted(tr.items(), key=str)))


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "sum":
        summarize(sys.argv[1])
    else:
        main()
