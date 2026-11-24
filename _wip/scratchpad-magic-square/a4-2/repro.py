"""反例の再現（1問ずつ）。 python3 -I repro.py <作業ディレクトリ>"""
import sys
sys.path.insert(0, sys.argv[1])
import rs2
from run_variants import VAR
m = rs2.m
CASES = [
    ("ms5-T3-k1-8 長い列の上下限を段2で", 5, [0,20,0,4,14,2,23,0,13,0,0,0,1,0,16,6,0,10,0,15,0,0,0,0,0], ["range2"]),
    ("ms5-T3-k0-10 組1通りの空き3を段2で", 5, [20,23,0,13,0,0,0,19,18,0,5,6,0,0,0,0,0,9,0,0,0,0,25,0,0], ["short3_1"]),
    ("ms5-T2-k12-22 2マス空きの列の上下限を段1で", 5, [0,0,4,25,18,20,0,0,0,0,12,0,0,17,0,0,10,0,0,0,6,23,2,15,19], ["range1"]),
    ("ms5-T3-k12-4 段を上げる時の巡の数え方", 5, [10,0,0,0,8,0,2,14,0,0,0,25,0,6,0,0,3,13,18,0,16,0,0,0,0], ["carry", "cum"]),
    ("ms5-T2-k12-26 組の数をメモに残さない", 5, [0,8,14,0,0,0,0,2,17,0,0,16,15,0,0,0,4,0,12,25,0,0,0,10,6], ["lock_eph"]),
    ("ms5-T3-k0-27 r0+c0 を一緒に読む", 5, [0,7,0,0,22,14,0,24,0,0,0,18,1,0,0,6,0,0,21,2,20,0,8,0,0], ["jointk2"]),
]
for label, n, g, names in CASES:
    lv, rs, f, r = rs2.level_of(n, g)
    print(label)
    print(f"   定義: L{lv} {rs or ''} 入口{f['entry']} 最初{f['first_sweeps']} 最大{f['depth_max']} 段3:{f['t3']} 所={[(s['tier'], s['sweeps']) for s in r['steps']]}")
    for nm in names:
        lv2, rs2_, f2, r2 = rs2.level_of(n, g, **VAR[nm])
        print(f"   {nm}: L{lv2} {rs2_ or ''} 入口{f2['entry']} 最初{f2['first_sweeps']} 最大{f2['depth_max']} 段3:{f2['t3']} 所={[(s['tier'], s['sweeps']) for s in r2['steps']]}")
