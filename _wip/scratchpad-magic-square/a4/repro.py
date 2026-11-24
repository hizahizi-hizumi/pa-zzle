"""反例の再現（入力の問題の例だけで動く）。
python3 -I repro.py <このディレクトリ>
表示は (最初の1マス空きの列, 最初の1マスの巡, 最大の巡, 組の突き合わせの回数, 段3の回数) と段（C2、仮想の列の確かめなし）。
"""
import sys
import functools
sys.path.insert(0, sys.argv[1])
from common import m, level  # noqa: E402
import gread as G  # noqa: E402
import one_choice as O  # noqa: E402
from examples import EXAMPLES  # noqa: E402


def show(f, n):
    return f"L{G.lvl_of(f, n)} (入口{f['start_one']}, 最初の巡{f['first_sweeps']}, 最大の巡{f['depth_max']}, 突き合わせ{f['hard']}, 段3 {f['t3']})"


VARS = {
    "基準（read_solve）": lambda geo, g: m.read_solve(geo, g),
    "1マスずつ置く（batch=False）": lambda geo, g: m.read_solve(geo, g, batch=False),
    "2本の列の差（空き2マスの式）": lambda geo, g: G.gsolve(geo, g, units_fn=functools.partial(G.combo_units, k=2, max_unknowns=2), max_tier=3),
    "交わる2本を一緒に読む": lambda geo, g: G.gsolve(geo, g, units_fn=functools.partial(G.joint_units, max_union=3), max_tier=3),
    "空き2マスの列の鎖を1つの数で表す": lambda geo, g: G.gsolve(geo, g, units_fn=G.chain_units, max_tier=3),
    "段3の巡を盤面から数える（段2の巡も入れる）": lambda geo, g: G.gsolve_policy(geo, g, policy="fresh3"),
    "列の順に読んですぐ使う（sync=False）": lambda geo, g: m.read_solve(geo, g, sync=False),
}

CASES = ["ms4-T2-k0-31", "ms5-T2-k1-7", "ms5-T2-k0-57", "ms6-T2-k0-29", "ms5-T3-k1-15",
         "ms5-T3-k12-35", "ms6-T3-k12-34", "ms5-T2-k12-49", "ms5-T2-k12-48", "ms6-T3-k12-4"]

for nm in CASES:
    g, sol = EXAMPLES[nm]
    n = int(len(g) ** 0.5)
    geo = m.geo_of(n)
    lv, f, res = level(n, g)
    print(f"{nm}  prop_C2 = L{lv}")
    for lab, fn in VARS.items():
        fv = m.read_features(geo, g, fn(geo, g))
        print(f"   {lab:<28} {show(fv, n)}")
    if lv in (2, 3):
        print(f"   1マスずつ置く・置く順を全部試したときの突き合わせ (最小, 最大) = {O.explore(geo, g)}")
