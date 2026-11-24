import sys, json
sys.path.insert(0, sys.argv[1])
import rs2
m = rs2.m
v = {x['id']: x for x in map(json.loads, open(sys.argv[1] + '/var_carry.jsonl'))}
ds = [json.loads(l) for l in open(sys.argv[1] + '/classified.jsonl')]
diff = 0; ch = 0
for d in ds:
    n = d['features']['n']; g = d['givens']; geo = m.geo_of(n)
    f = m.read_features(geo, g, m.read_solve(geo, g, **m.VARIANTS['oldtier']))
    dd = {"n": n, "givens": g, "var": {}}
    if n == 4: dd["var"]["virtual"] = m.read_features(geo, g, m.read_solve(geo, g, extra_lines=m.VIRTUAL4, **m.VARIANTS['oldtier']))
    lv, rs = m.level_and_reason(m.PROPOSALS['C2'], f, dd)
    if lv != v[d['id']]['level']: diff += 1
    if d['level'] and lv != d['level']: ch += 1
print('carry vs original oldtier level diffs', diff, '; oldtier in-range changes', ch)
