import json, sys, os
game, dev = sys.argv[1:3]
for v in ['before', 'after']:
    p = f'shots/{game}/{dev}/{v}/report.json'
    if not os.path.exists(p): print(v, 'missing'); continue
    r = json.load(open(p))
    print(f'== {v} goal={r["goal"]} errors={r["errors"][:3]}')
    for t, info in r['tabs'].items():
        print(f'  [{t}] scroll={info["scroll"]} flows={info["flows"]}')
        for h in info['heads'][:14]: print('    ', h)
    for q in r['panels']:
        a = q['after']
        if not a: continue
        print(f'  P {q["tab"]}{q["idx"]} {a["placement"]:15} pad={a["pad"]:10} h={a["h"]} figs={a["figs"]} steps={q["steps"]} resetOk={q["resetOk"]} reset={a["reset"]} | {a["heading"][:28]}')
