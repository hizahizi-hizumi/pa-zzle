"""変種のレベルを定義（base）と比べる。 使い方: compare.py <作業ディレクトリ> <変種名...>"""
import collections
import json
import sys

WD = sys.argv[1]


def load(name):
    return {x["id"]: x for x in map(json.loads, open(f"{WD}/var_{name}.jsonl"))}


base = load("base")
inr = [i for i, x in base.items() if x["level"]]
for name in sys.argv[2:]:
    v = load(name)
    err = sum(1 for x in v.values() if "error" in x)
    ch = [i for i in inr if v[i].get("level") != base[i]["level"]]
    trans = collections.Counter((base[i]["f"]["n"], base[i]["level"], v[i].get("level") or v[i].get("reason") or v[i].get("error", "")[:30]) for i in ch)
    bylv = collections.Counter((base[i]["f"]["n"], base[i]["level"]) for i in inr)
    chlv = collections.Counter((base[i]["f"]["n"], base[i]["level"]) for i in ch)
    into = [i for i, x in base.items() if not x["level"] and v[i].get("level")]
    print(f"== {name}: errors {err}; in-range {len(inr)} changed {len(ch)} ({100*len(ch)/len(inr):.1f}%); "
          f"out->in {len(into)}")
    for n in (4, 5, 6):
        a = sum(c for (nn, l), c in bylv.items() if nn == n)
        b = sum(c for (nn, l), c in chlv.items() if nn == n)
        if a:
            print(f"   {n}x{n}: {b}/{a} ({100*b/a:.1f}%)", end="")
    print()
    for k, c in sorted(trans.items(), key=lambda kv: (-kv[1], str(kv[0])))[:12]:
        print("   ", k, c)
