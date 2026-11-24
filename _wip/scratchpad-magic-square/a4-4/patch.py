import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old, s.count(old))
    s = s.replace(old, new)

rep('''    "diag_chain": True,     # 斜めの列を鎖（と jointk の組）につなぐか
}''', '''    "diag_chain": True,     # 斜めの列を鎖（と jointk の組）につなぐか
    # --- 確かめ役（A4 の4回目）の向き ---
    "esc": None,            # hi: 段2の1巡で置けなければ段3へ上げ、所は段3と数える / lo: 巡ごとに段2で置けるかを先に見る
    "sets_cap": 0,          # >0 なら、組が sets_cap 通りより多い段2の単位（空き2の列・鎖）は読まない
    "sets_cap_all": False,  # True なら空き2以上の全部の単位に sets_cap を当てる
    "lock_unique": False,   # 組の数を他で使わないを、組が1通りの単位からだけ
    "memo_excl": False,     # memo_max を超えるマスでも、消した数が memo_max 個以下なら覚える
    "chain_late": False,    # 段2以上の各段の1巡目は鎖を読まない（列を1本ずつ読んでから鎖をつなぐ）
    "short_joint_sets": 0,  # >0 なら段2で、組が short_joint_sets 通り以下の jointk の組も読む
}''')

rep('''    def run_tier(tier: int, cur: dict[int, int], units, empties):
        """段 tier 以下の単位を、置けるか動かなくなるまで巡ごとに読む。"""''',
'''    def run_tier(tier: int, cur: dict[int, int], units, empties, max_sweeps: int = 0):
        """段 tier 以下の単位を、置けるか動かなくなるまで巡ごとに読む。"""''')

rep('''                short3 = False
                if u["tier"] > tier:
                    if opt["short3_sets"] and tier == 2 and u["kind"] == "line" and e == 3:
                        short3 = True
                    else:
                        continue''', '''                short3 = False
                if u["tier"] > tier:
                    if opt["short3_sets"] and tier == 2 and u["kind"] == "line" and e == 3:
                        short3 = opt["short3_sets"]
                    elif opt["short_joint_sets"] and tier == 2 and u["kind"] == "joint":
                        short3 = opt["short_joint_sets"]
                    else:
                        continue
                if opt["chain_late"] and sweeps == 1 and tier >= 2 and u["kind"] == "chain":
                    continue''')

rep('''                if short3 and (nsets == 0 or nsets > opt["short3_sets"]):
                    continue''', '''                if short3 and (nsets == 0 or nsets > short3):
                    continue
                if opt["sets_cap"] and e >= 2 and (u["tier"] == 2 or opt["sets_cap_all"]) and nsets > opt["sets_cap"]:
                    continue''')

rep('''                if tier >= opt["lock_min_tier"] and req and (u["kind"] != "chain" or opt["chain_lock"]):''',
'''                if (tier >= opt["lock_min_tier"] and req and (u["kind"] != "chain" or opt["chain_lock"])
                        and (not opt["lock_unique"] or nsets == 1)):''')

rep('''                if opt["lock_scope"] == "units" and c not in unit_cells:
                    continue''', '''                if opt["lock_scope"] == "units" and c not in unit_cells:
                    continue
                if opt["lock_scope"] == "memo" and c not in unit_cells and cur[c] == unused:
                    continue''')

rep('''            if placements or not changed:
                return {"placements": placements, "kinds": kinds, "sweeps": sweeps, "lock": lock_changed,
                        "combos": combos_first, "chain": chain_first, "cur": cur}''',
'''            if placements or not changed or (max_sweeps and sweeps >= max_sweeps):
                return {"placements": placements, "kinds": kinds, "sweeps": sweeps, "lock": lock_changed,
                        "combos": combos_first, "chain": chain_first, "cur": cur, "changed": changed}''')

rep('''            elif opt["memo_hull"]:
                out[c] = geo.range_mask(lowest(v), v.bit_length() - 1) & unused''',
'''            elif opt["memo_excl"] and popcount(unused & ~v) <= K:
                out[c] = v
            elif opt["memo_hull"]:
                out[c] = geo.range_mask(lowest(v), v.bit_length() - 1) & unused''')

rep('''            if opt["tier_choice"] == "fewest":''', '''            if opt["esc"]:
                r1 = run_tier(1, dict(stall_start), units, empties)
                if r1["placements"]:
                    chosen = (1, r1)
                elif opt["esc"] == "hi":
                    r2 = run_tier(2, dict(stall_start), units, empties, max_sweeps=1)
                    if r2["placements"]:
                        chosen = (2, r2)
                    else:
                        r3 = run_tier(3, dict(r2["cur"]), units, empties)
                        if r3["placements"]:
                            r3 = dict(r3)
                            r3["sweeps"] += 1 if r2["changed"] else 0
                            chosen = (3, r3)
                        elif max_tier >= 4:
                            r = run_tier(4, dict(stall_start), units, empties)
                            if r["placements"]:
                                chosen = (4, r)
                else:  # lo: 巡ごとに、段2で置けるかを先に見て、置けなければ段3も同じ写しで読む
                    cur_l = dict(stall_start)
                    s = 0
                    while chosen is None:
                        s += 1
                        r2 = run_tier(2, dict(cur_l), units, empties, max_sweeps=1)
                        if r2["placements"]:
                            r2 = dict(r2); r2["sweeps"] = s
                            chosen = (2, r2)
                            break
                        r3 = run_tier(3, dict(cur_l), units, empties, max_sweeps=1)
                        if r3["placements"]:
                            r3 = dict(r3); r3["sweeps"] = s
                            chosen = (3, r3)
                            break
                        if not r3["changed"]:
                            break
                        cur_l = r3["cur"]
                    if chosen is None and max_tier >= 4:
                        r = run_tier(4, dict(stall_start), units, empties)
                        if r["placements"]:
                            chosen = (4, r)
            elif opt["tier_choice"] == "fewest":''')
open(p, "w").write(s)
print("patched")
