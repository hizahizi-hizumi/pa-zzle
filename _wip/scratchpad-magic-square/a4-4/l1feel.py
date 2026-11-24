"""L1 と not-minimal を、段1の回の数・最初の回で置けるマス・最初の1マス空きの列の数で比べる。"""
import sys, json, collections, statistics
sys.path.insert(0, "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード")
import magic_square_difficulty as m
W = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4"
rows = [json.loads(x) for x in open(W + "/classified.jsonl")]
geo = m.geo_of(4)
def meas(d):
    g = d["givens"]
    r = m.read_solve(geo, g, max_tier=1)
    st = r["steps"]
    # 1マスずつ置く人: 回の数（置く順は最小番号）
    r1 = m.read_solve(geo, g, max_tier=1, batch=False)
    # 最初の盤面の1マス空きの列の数・最初の回で置けるマス
    return {"rounds": len(st), "first": st[0]["found"] if st else 0, "start_one": r["start_one"],
            "givens": sum(1 for v in g if v), "per_round": [s["found"] for s in st],
            "naive": d["naive_rp_undos"]}
grp = {"L1": [d for d in rows if d["level"] == 1], "not-minimal": [d for d in rows if d["reason"] == "not-minimal"]}
for k, g in grp.items():
    ms = [meas(d) for d in g]
    def q(key):
        xs = sorted(x[key] for x in ms)
        return f"{xs[0]} / {m.pct(xs, .25)} / {m.pct(xs, .5)} / {m.pct(xs, .75)} / {xs[-1]}"
    print(k, len(g), "givens", q("givens"), "| rounds", q("rounds"), "| first-round cells", q("first"), "| start 1-empty lines", q("start_one"), "| naive undos", q("naive"))
    print("   rounds hist", sorted(collections.Counter(x["rounds"] for x in ms).items()), "first hist", sorted(collections.Counter(x["first"] for x in ms).items()))
