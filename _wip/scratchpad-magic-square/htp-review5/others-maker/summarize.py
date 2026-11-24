"""Print before/after metric differences: python3 -I summarize.py <game> [dev]"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def load(game, v, dev):
    p = os.path.join(ROOT, "shots", game, f"{v}-{dev}-result.json")
    return json.load(open(p)) if os.path.exists(p) else None


def main(game, devs):
    for dev in devs:
        b, a = load(game, "before", dev), load(game, "after", dev)
        print(f"########## {game} {dev}")
        if not a or not b:
            print("missing", bool(b), bool(a))
            continue
        for r, v in ((b, "before"), (a, "after")):
            if r.get("fatal"):
                print(v, "FATAL", r["fatal"][:300])
            if r.get("errors"):
                print(v, "errors", r["errors"][:5])
        print("goal before", b.get("goal"))
        print("goal after ", a.get("goal"))
        for tab in ("rules", "operations", "scoring"):
            tb, ta = b["tabs"].get(tab), a["tabs"].get(tab)
            if not tb or not ta:
                print(tab, "missing")
                continue
            mb, ma = tb["metrics"], ta["metrics"]
            print(f"--- {tab}")
            hb = [(h["tag"], h["fs"], h["fw"], h["text"][:18]) for h in mb["headings"]]
            ha = [(h["tag"], h["fs"], h["fw"], h["text"][:18]) for h in ma["headings"]]
            for x, y in zip(hb, ha):
                mark = "" if x[:3] == y[:3] else "  <== changed"
                print("  H", x[:3], "->", y[:3], y[3], mark)
            if len(hb) != len(ha):
                print("  heading count", len(hb), len(ha))
            for pb_, pa_ in zip(mb["panels"], ma["panels"]):
                print(
                    f"  P {pb_['placement']}/{pb_['pt']}/{pb_['pb']}/h{pb_['rect']['h']} -> {pa_['placement']}/{pa_['pt']}/{pa_['pb']}/h{pa_['rect']['h']} figs={len(pa_['figs'])} nested={[f['nested'] for f in pa_['figs']]} | {pa_['heading']}"
                )
            if len(mb["panels"]) != len(ma["panels"]):
                print("  panel count", len(mb["panels"]), len(ma["panels"]))
            visp = ma["panels"]
            for t in ta.get("touches", []):
                init = visp[t["panel"]] if t["panel"] < len(visp) else None
                for tc in t["touches"]:
                    if not tc["touched"]:
                        print(f"  T p{t['panel']} f{tc['fig']} NOT TOUCHED")
                        continue
                    g = tc["geo"]
                    near = min(range(len(g["dists"])), key=lambda i: g["dists"][i])
                    flag = []
                    if g["hits"]:
                        flag.append("OVERLAP " + ",".join(h["tag"] + ":" + h["text"] for h in g["hits"][:4]))
                    if not g["btnInPanel"]:
                        flag.append("BTN OUTSIDE PANEL")
                    if len(g["dists"]) > 1 and near != tc["fig"]:
                        flag.append(f"btn nearest fig{near} (touched fig{tc['fig']})")
                    if init and tc["state"]["placement"] != init["placement"]:
                        flag.append(f"PLACEMENT CHANGED {init['placement']}->{tc['state']['placement']}")
                    if init and abs(tc["state"]["ph"] - init["rect"]["h"]) > 1:
                        flag.append(f"PANEL H {init['rect']['h']}->{round(tc['state']['ph'],1)}")
                    if tc["afterReset"] and tc["afterReset"]["visible"]:
                        flag.append("RESET STILL VISIBLE")
                    print(f"  T p{t['panel']} f{tc['fig']} {tc['how']} {tc['state']['placement']} dists={g['dists']} {' / '.join(flag)}")
            # touches before for comparison of not-touched
            for t in tb.get("touches", []):
                for tc in t["touches"]:
                    if not tc["touched"]:
                        print(f"  (before) T p{t['panel']} f{tc['fig']} NOT TOUCHED")
                    elif tc["geo"]["hits"]:
                        print(f"  (before) T p{t['panel']} f{tc['fig']} OVERLAP", [h['tag'] + ':' + h['text'] for h in tc['geo']['hits'][:4]])
            for fb, fa in zip(mb["flows"], ma["flows"]):
                print(f"  F bg {fb['bg']} -> {fa['bg']} border {fa['border']} rect {fb['rect']['w']}x{fb['rect']['h']} -> {fa['rect']['w']}x{fa['rect']['h']} child L{fa['childMinL']} R{fa['childMaxR']} B{fa['childMaxB']} panel r{fa['rect']['r']} b{fa['rect']['b']} inert={fa['inert']}")
            if len(mb["flows"]) != len(ma["flows"]):
                print("  flow count", len(mb["flows"]), len(ma["flows"]))
            for x, y in zip(mb["menus"], ma["menus"]):
                print(f"  M lead {x['lead']} -> {y['lead']}; items r {[i['rect']['r'] for i in x['items']]} -> {[i['rect']['r'] for i in y['items']]} menu r {y['rect']['r']}")
            for x, y in zip(mb["scoreRows"], ma["scoreRows"]):
                pb = [(p["tag"], p["fs"]) for p in x["parts"]]
                pa = [(p["tag"], p["fs"]) for p in y["parts"]]
                if pb != pa:
                    print(f"  S {y['head']}: {pb} -> {pa}")
            if ma["overflow"]:
                print("  OVERFLOW after", ma["overflow"][:5])
            if mb["overflow"]:
                print("  OVERFLOW before", mb["overflow"][:3])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:] or ["phone", "pc"])
