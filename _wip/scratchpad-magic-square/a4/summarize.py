import sys, json, collections
rs = [json.loads(l) for l in open(sys.argv[1])]
names = list(rs[0]["var"])
for nm in names:
    tot = collections.Counter()
    chg = collections.Counter()
    trans = collections.Counter()
    feat_moves = collections.Counter()
    ex = {}
    for r in rs:
        L = r["level"]
        if L is None:
            continue
        v = r["var"][nm]
        tot[L] += 1
        if v["level"] != L:
            chg[L] += 1
            trans[(L, v["level"])] += 1
            ex.setdefault((L, v["level"]), r["id"])
        for k in ("start_one", "first_sweeps", "hard", "depth_max", "t3"):
            if v[k] != r["base"][k]:
                feat_moves[k] += 1
    n_in = sum(tot.values())
    print(f"== {nm}: 段が変わる {sum(chg.values())}/{n_in} ({sum(chg.values())/n_in:.1%})")
    print("   段ごと:", {L: f"{chg[L]}/{tot[L]} ({chg[L]/tot[L]:.0%})" for L in sorted(tot)})
    print("   移り:", dict(sorted(trans.items(), key=lambda x: (x[0][0], x[0][1] or 0))))
    print("   特徴が動いた件数:", dict(feat_moves))
    print("   例:", ex)
