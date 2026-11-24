"""送迎パーキング 採点の前提の調査（調査用。製品のコードではない）。

認識合わせで遊んだ試作の問題例のうち、Lv1〜Lv5 の代表と境界 15問について、
採点の前提を考えるために次を数える。ルールは試作（合意のルール）と同じ。

- 状態数と解の数、クリアに要る出庫数（台数と同じか）
- 罠: 勝てる状態から、選ぶと解けなくなる出庫（負ける出庫）
- 罠の後: 最善でも何人まで乗れるか（帰結の距離）、すぐ詰むか、
  詰むまでに出せる出庫の数（最小・最大・無作為に出したときの期待値）
- 無作為に出したときに勝つ確率
- 「無作為に出し、罠に入ったら詰むまで進め、罠の直前まで1手ずつ戻す」遊び手の
  罠に入る回数と、待ったの回数の期待値（罠1回あたりの待ったがレベルで変わるか）

問題例は試作 (claude/wizardly-darwin-yvsr1u の
scripts/research/parking_jam_passenger_levels.examples.json と同じ問題) を埋め込んだ。
乱数は使わない（期待値は厳密に計算する）。標準ライブラリだけで動く。

使い方: python3 shuttle-parking_scoring.py [--check 期待値.json]
"""
from __future__ import annotations

import json
import statistics
import sys
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

PROBLEMS = json.loads('''[{"id":"plv-lv1-rep1","bays":4,"queue":"ADCBAADDCBDCADBACCAB","w":7,"h":7,"cars":[[2,1,"v",2,"B"],[2,5,"v",3,"A"],[4,4,"v",3,"A"],[4,3,"v",2,"D"],[0,4,"v",2,"C"],[1,3,"v",3,"D"],[0,1,"v",2,"B"],[0,6,"v",3,"C"]],"open":[["up",0,7]],"solutions":1080},{"id":"plv-lv1-rep2","bays":4,"queue":"CCCDBDBBCADDACAABBCDA","w":7,"h":7,"cars":[[1,5,"v",3,"B"],[1,1,"v",3,"A"],[2,6,"v",3,"C"],[0,0,"v",3,"C"],[0,6,"v",2,"A"],[1,2,"v",3,"D"],[1,3,"v",2,"D"],[1,4,"v",2,"B"]],"open":[["up",0,7]],"solutions":2076},{"id":"plv-lv2-rep1","bays":3,"queue":"BDCDBAADACCDBCAACBA","w":7,"h":7,"cars":[[4,2,"v",2,"D"],[0,2,"v",3,"A"],[0,3,"v",3,"A"],[5,1,"v",2,"B"],[3,1,"v",2,"C"],[0,1,"v",2,"B"],[4,4,"v",3,"C"],[2,0,"v",2,"D"]],"open":[["up",0,7]],"solutions":30},{"id":"plv-lv2-rep2","bays":3,"queue":"BCBBAABBACCACAACABA","w":7,"h":7,"cars":[[4,0,"v",2,"B"],[1,0,"v",2,"B"],[5,4,"h",2,"A"],[0,0,"h",3,"A"],[0,4,"h",3,"C"],[1,4,"h",3,"A"],[0,3,"v",2,"B"],[2,4,"h",2,"C"]],"open":[["right",0,7],["up",0,7]],"solutions":8},{"id":"plv-lv3-rep1","bays":4,"queue":"DDCABACADACCBBABDDCB","w":6,"h":6,"cars":[[2,0,"v",3,"D"],[0,4,"v",2,"C"],[0,0,"v",2,"B"],[3,3,"v",2,"A"],[0,3,"v",3,"C"],[0,2,"v",3,"B"],[1,5,"v",2,"D"],[3,1,"v",3,"A"]],"open":[["up",0,6]],"solutions":468},{"id":"plv-lv3-rep2","bays":3,"queue":"AABABCABABACCCAABBAB","w":6,"h":6,"cars":[[3,2,"v",2,"C"],[2,2,"h",3,"A"],[2,5,"v",3,"A"],[0,4,"h",2,"B"],[5,3,"h",2,"C"],[1,0,"v",3,"B"],[0,1,"v",3,"A"],[1,2,"h",2,"B"]],"open":[["right",0,6],["up",0,6]],"solutions":264},{"id":"plv-lv4-rep1","bays":4,"queue":"ABCAAACBDDBDDBBCCDBCDA","w":7,"h":7,"cars":[[4,3,"v",2,"A"],[2,3,"v",2,"C"],[0,0,"v",3,"D"],[3,5,"v",3,"A"],[0,5,"v",3,"C"],[0,4,"v",3,"D"],[2,6,"v",3,"B"],[1,1,"v",3,"B"]],"open":[["up",0,7]],"solutions":96},{"id":"plv-lv4-rep2","bays":3,"queue":"CAACBDDBDADCBCABCBA","w":7,"h":7,"cars":[[4,1,"h",2,"D"],[4,4,"h",2,"C"],[0,5,"h",2,"A"],[3,0,"h",3,"B"],[2,4,"v",2,"B"],[3,3,"v",3,"A"],[1,3,"h",2,"D"],[5,4,"h",3,"C"]],"open":[["right",0,7],["up",0,7]],"solutions":99},{"id":"plv-lv5-rep1","bays":3,"queue":"CCCBBBBAAAAACCBBABB","w":6,"h":6,"cars":[[3,1,"v",2,"A"],[3,2,"h",2,"A"],[1,4,"v",3,"C"],[0,0,"h",3,"B"],[0,5,"v",2,"B"],[1,3,"v",2,"A"],[4,3,"h",3,"B"],[5,1,"h",2,"C"]],"open":[["right",0,6],["up",0,6]],"solutions":276},{"id":"plv-lv5-rep2","bays":3,"queue":"DDBCBABBCDABAAACADCC","w":7,"h":7,"cars":[[3,6,"v",3,"A"],[0,6,"v",3,"C"],[2,5,"v",2,"C"],[0,4,"v",3,"A"],[0,5,"v",2,"D"],[4,3,"v",2,"B"],[2,0,"v",2,"D"],[1,3,"v",3,"B"]],"open":[["up",0,7]],"solutions":12},{"id":"plv-lv1-boundary","bays":3,"queue":"DADABBCBABAACDCACD","w":6,"h":6,"cars":[[3,3,"v",2,"D"],[2,3,"h",2,"D"],[2,5,"v",3,"A"],[0,0,"v",3,"A"],[0,1,"h",2,"C"],[0,5,"v",2,"B"],[5,3,"h",2,"B"],[0,4,"v",2,"C"]],"open":[["right",0,6],["up",0,6]],"solutions":8},{"id":"plv-lv2-boundary","bays":3,"queue":"CBAAABBCBACBACAABACBCB","w":6,"h":6,"cars":[[3,1,"h",3,"B"],[5,1,"h",2,"B"],[3,4,"v",2,"A"],[0,4,"v",3,"C"],[2,5,"v",3,"B"],[5,3,"h",3,"A"],[0,3,"v",3,"A"],[3,0,"v",3,"C"]],"open":[["right",0,6],["up",0,6]],"solutions":234},{"id":"plv-lv3-boundary","bays":3,"queue":"DBDABBCCABDBADCCA","w":7,"h":7,"cars":[[0,4,"h",2,"C"],[0,6,"v",3,"B"],[2,3,"v",2,"D"],[0,3,"v",2,"C"],[4,1,"v",2,"D"],[1,1,"v",2,"A"],[6,1,"h",2,"B"],[6,5,"h",2,"A"]],"open":[["right",0,7],["up",0,7]],"solutions":33},{"id":"plv-lv4-boundary","bays":3,"queue":"BCABBBBABBCBAACCAAAA","w":6,"h":6,"cars":[[2,0,"v",3,"A"],[0,0,"v",2,"A"],[1,3,"v",3,"A"],[1,5,"v",3,"B"],[1,4,"v",2,"C"],[0,1,"v",3,"B"],[4,2,"v",2,"B"],[2,2,"v",2,"C"]],"open":[["up",0,6]],"solutions":474},{"id":"plv-lv5-boundary","bays":3,"queue":"CABADBCDACDABBBCCBDCD","w":7,"h":7,"cars":[[4,0,"v",3,"D"],[0,0,"v",3,"C"],[2,5,"v",3,"C"],[4,6,"v",2,"D"],[0,5,"h",2,"A"],[2,2,"v",3,"B"],[1,1,"h",3,"B"],[6,5,"h",2,"A"]],"open":[["right",0,7],["up",0,7]],"solutions":12}]''')


class Game:
    def __init__(self, p):
        self.p = p
        self.cars = p["cars"]
        self.n = len(self.cars)
        self.queue = p["queue"]
        self.bays = p["bays"]
        cells = []
        for r, c, o, ln, _ in self.cars:
            cells.append({(r, c + i) if o == "h" else (r + i, c) for i in range(ln)})
        self.cells = cells
        # 出口へ向かう進路ごとに、塞ぐ車の集合（ビット）
        self.rays = []
        for i, (r, c, o, ln, _) in enumerate(self.cars):
            rays = []
            dirs = ("left", "right") if o == "h" else ("up", "down")
            for d in dirs:
                off = r if o == "h" else c
                if not any(s == d and a <= off < a + L for s, a, L in p["open"]):
                    continue
                if d == "left":
                    path = {(r, x) for x in range(c)}
                elif d == "right":
                    path = {(r, x) for x in range(c + ln, p["w"])}
                elif d == "up":
                    path = {(y, c) for y in range(r)}
                else:
                    path = {(y, c) for y in range(r + ln, p["h"])}
                mask = 0
                for j in range(self.n):
                    if j != i and cells[j] & path:
                        mask |= 1 << j
                rays.append(mask)
            self.rays.append(rays)
        self.start = ((1 << self.n) - 1, (), 0)

    def legal(self, s):
        rem, wait, _ = s
        if len(wait) >= self.bays:
            return []
        return [i for i in range(self.n) if rem >> i & 1 and any(not (m & rem & ~(1 << i)) for m in self.rays[i])]

    def step(self, s, i):
        rem, wait, head = s
        wait = [list(w) for w in wait] + [[i, 0]]
        while head < len(self.queue):
            k = next((k for k, w in enumerate(wait) if self.cars[w[0]][4] == self.queue[head]), None)
            if k is None:
                break
            wait[k][1] += 1
            head += 1
            if wait[k][1] == self.cars[wait[k][0]][3]:
                wait.pop(k)
        return (rem & ~(1 << i), tuple(tuple(w) for w in wait), head)

    def won(self, s):
        return s[0] == 0 and not s[1] and s[2] == len(self.queue)


ALL_TRAPS: list[dict] = []
BANDS = (("0", 0, 0), ("1-4", 1, 4), ("5-7", 5, 7), ("8+", 8, 99))


def analyse(p):
    g = Game(p)
    seen = set()

    @lru_cache(maxsize=None)
    def wins(s):  # 解の数
        seen.add(s)
        if g.won(s):
            return 1
        return sum(wins(g.step(s, i)) for i in g.legal(s))

    @lru_cache(maxsize=None)
    def reach(s):  # 最善で乗れる人数（head の最大）
        nx = g.legal(s)
        return max([s[2]] + [reach(g.step(s, i)) for i in nx])

    @lru_cache(maxsize=None)
    def exits_to_stuck(s):  # 負けの状態から詰むまでの出庫数 (最小, 最大, 無作為の期待値)
        nx = g.legal(s)
        if not nx:
            return (0, 0, Fraction(0))
        sub = [exits_to_stuck(g.step(s, i)) for i in nx]
        return (1 + min(a for a, _, _ in sub), 1 + max(b for _, b, _ in sub), 1 + sum(e for *_, e in sub) / len(sub))

    @lru_cache(maxsize=None)
    def p_random(s):
        if g.won(s):
            return Fraction(1)
        nx = g.legal(s)
        if not nx:
            return Fraction(0)
        return sum(p_random(g.step(s, i)) for i in nx) / len(nx)

    @lru_cache(maxsize=None)
    def backtracker(s):  # 勝てる状態 s から: (罠に入る回数の期待値, 待ったの回数の期待値)
        if g.won(s):
            return (Fraction(0), Fraction(0))
        nx = g.legal(s)
        good = [g.step(s, i) for i in nx if wins(g.step(s, i))]
        bad = [g.step(s, i) for i in nx if not wins(g.step(s, i))]
        # 無作為に選び、罠なら詰むまで無作為に進めて罠の直前まで戻し、同じ状態から選び直す
        # （同じ罠を再び選ぶこともある遊び手。選び直しは独立とする）
        q = Fraction(len(bad), len(nx))
        undo_per_bad = sum(1 + exits_to_stuck(b)[2] for b in bad) / len(bad) if bad else Fraction(0)
        # 罠に入る回数は幾何分布: 期待値 q/(1-q)
        traps_here = q / (1 - q)
        after = [backtracker(x) for x in good]
        t_after = sum(a for a, _ in after) / len(after)
        u_after = sum(b for _, b in after) / len(after)
        return (traps_here + t_after, traps_here * undo_per_bad + u_after)

    sols = wins(g.start)
    # 勝てる状態のうち、開始から勝てる出庫だけで届くもの
    on_path, stack = set(), [g.start]
    while stack:
        s = stack.pop()
        if s in on_path or g.won(s):
            continue
        on_path.add(s)
        for i in g.legal(s):
            t = g.step(s, i)
            if wins(t):
                stack.append(t)
    traps = []
    for s in on_path:
        for i in g.legal(s):
            t = g.step(s, i)
            if not wins(t):
                lo, hi, ex = exits_to_stuck(t)
                traps.append({"distance": reach(t) - s[2], "immediate": lo == 0 and hi == 0,
                              "minExits": lo, "maxExits": hi, "randomExits": float(ex)})
    bt_traps, bt_undo = backtracker(g.start)
    ALL_TRAPS.extend(dict(t, level=int(p["id"].split("-")[1][2])) for t in traps)
    level = int(p["id"].split("-")[1][2])
    return {
        "id": p["id"], "level": level, "cars": g.n, "bays": g.bays, "queue": len(g.queue),
        "states": len(seen), "solutions": sols, "solutionsMatchPrototype": sols == p["solutions"],
        "trapCount": len(traps),
        "trapImmediateShare": round(sum(t["immediate"] for t in traps) / len(traps), 3) if traps else None,
        "trapDistanceMax": max((t["distance"] for t in traps), default=0),
        "trapRandomExitsMedian": statistics.median(t["randomExits"] for t in traps) if traps else None,
        "trapMaxExitsMax": max((t["maxExits"] for t in traps), default=0),
        "randomWin": round(float(p_random(g.start)), 4),
        "backtrackerTraps": round(float(bt_traps), 3),
        "backtrackerUndos": round(float(bt_undo), 3),
        "undosPerTrap": round(float(bt_undo / bt_traps), 2) if bt_traps else None,
    }


def main():
    rows = [analyse(p) for p in PROBLEMS]
    by_level = {}
    for lv in range(1, 6):
        rs = [r for r in rows if r["level"] == lv]
        by_level[str(lv)] = {
            "problems": len(rs),
            "randomWin": [r["randomWin"] for r in rs],
            "backtrackerTraps": [r["backtrackerTraps"] for r in rs],
            "undosPerTrap": [r["undosPerTrap"] for r in rs],
            "trapDistanceMax": [r["trapDistanceMax"] for r in rs],
            "trapImmediateShare": [r["trapImmediateShare"] for r in rs],
        }
    by_distance = {}
    for name, lo, hi in BANDS:
        ts = [t for t in ALL_TRAPS if lo <= t["distance"] <= hi]
        by_distance[name] = {
            "traps": len(ts),
            "immediateShare": round(sum(t["immediate"] for t in ts) / len(ts), 3) if ts else None,
            "minExitsMedian": statistics.median(t["minExits"] for t in ts) if ts else None,
            "maxExitsMedian": statistics.median(t["maxExits"] for t in ts) if ts else None,
            "randomExitsMean": round(statistics.mean(t["randomExits"] for t in ts), 2) if ts else None,
        }
    result = {"rows": rows, "byLevel": by_level, "trapsByDistance": by_distance,
              "cleanExitsEqualCars": True}
    text = json.dumps(result, ensure_ascii=False, indent=1)
    if len(sys.argv) == 3 and sys.argv[1] == "--check":
        ok = json.loads(Path(sys.argv[2]).read_text()) == result
        print("一致" if ok else "不一致")
        sys.exit(0 if ok else 1)
    print(text)


if __name__ == "__main__":
    main()
