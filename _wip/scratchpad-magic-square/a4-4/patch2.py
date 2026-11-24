import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old, s.count(old))
    s = s.replace(old, new)
rep('''    "short_joint_sets": 0,  # >0 なら段2で、組が short_joint_sets 通り以下の jointk の組も読む
}''', '''    "short_joint_sets": 0,  # >0 なら段2で、組が short_joint_sets 通り以下の jointk の組も読む
    "pair1": False,         # True なら段1で、組が1通りの空き2の列も読む（49 = 24 + 25 のような列）
    "pair1_lock": True,     # pair1 の列から段1でも組の数を他で使わない
}''')
rep('''                    elif opt["short_joint_sets"] and tier == 2 and u["kind"] == "joint":
                        short3 = opt["short_joint_sets"]''', '''                    elif opt["short_joint_sets"] and tier == 2 and u["kind"] == "joint":
                        short3 = opt["short_joint_sets"]
                    elif opt["pair1"] and tier == 1 and u["kind"] == "line" and e == 2:
                        short3 = 1''')
rep('''                if (tier >= opt["lock_min_tier"] and req and (u["kind"] != "chain" or opt["chain_lock"])''',
'''                if ((tier >= opt["lock_min_tier"] or (short3 and tier == 1 and opt["pair1_lock"]))
                        and req and (u["kind"] != "chain" or opt["chain_lock"])''')
open(p, "w").write(s)
print("patched")
