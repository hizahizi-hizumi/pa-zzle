"""箱入り娘 調査: 問題供給。

4×5 の盤で、駒の組（縦長 v・横長 h・小駒 s の数。娘は1つ）ごとに、
娘が出口の前（左上が行3・列1）にある状態から多始点 BFS で連結成分を全部たどり、
各状態の最短手数（1手 = 同じ駒の連続移動。曲がってもよい）を求める。

数え方:
- 同じ形の駒は区別しない（状態は形ごとの占有で表す）。
- 左右反転を同じ問題とみなす数え方（canon）と、別の問題とみなす数え方（raw）を両方出す。
- 始まりの形の制約の案: any（どこからでも）/ top（娘が最上段 = 左上の行0）/
  topmid（娘が上の真ん中 = 行0・列1、横刀立馬の形）。
- 局所最大（隣のどの状態より最短手数が短くない状態）だけを数える案も出す。

使い方:
  python3 hakoiri_musume_supply.py enumerate [--min-empty 2] [--max-empty 6] [--only "4,1,4;4,1,2"] > out.json
      駒の組ごとの状態数・連結成分数・最短手数の分布（数え方ごと）。
  python3 hakoiri_musume_supply.py bands --min-empty 2 --max-empty 3 --start any --seed 1 [--radii 3,6,10]
      最短手数の帯ごとに、互いに r 手以内で行き来できる問題を除いた数（seed 順の貪欲法、駒の組ごとに上限 3000）。
  python3 hakoiri_musume_supply.py pool --seed 1 --per-level 500,500,500,500,300 --radius 6 [--mirror raw] [--dump f.json]
      仮の5段階（TRIAL_LEVELS）で問題集を作り、件数・最短手数・JSON の大きさを測る。
標準ライブラリだけを使う。
"""

from __future__ import annotations

import gzip
import json
import random
import sys
import time
from collections import deque

W, H = 4, 5
N = W * H
GOAL_POS = 3 * W + 1

# 形: (高さ, 幅)
SHAPES = {"A": (2, 2), "V": (2, 1), "H": (1, 2), "S": (1, 1)}


def build_tables():
    mask = {}
    nbr = {}
    for t, (h, w) in SHAPES.items():
        m = {}
        for r in range(H - h + 1):
            for c in range(W - w + 1):
                bits = 0
                for i in range(h):
                    for j in range(w):
                        bits |= 1 << ((r + i) * W + c + j)
                m[r * W + c] = bits
        mask[t] = m
        nb = {}
        for p in m:
            r, c = divmod(p, W)
            lst = []
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (r + dr) * W + (c + dc)
                if 0 <= r + dr and 0 <= c + dc and q in m and (r + dr) * W + c + dc == q:
                    if 0 <= c + dc <= W - w and 0 <= r + dr <= H - h:
                        lst.append(q)
            nb[p] = lst
        nbr[t] = nb
    return mask, nbr


MASK, NBR = build_tables()
TYPES = ("A", "V", "H", "S")


def bits_of(x):
    while x:
        b = x & -x
        yield b.bit_length() - 1
        x ^= b


# 状態 = (a, vm, hm, sm)。a は娘の左上の位置、他は駒の左上の位置のビット集合。
def pack(a, vm, hm, sm):
    return a | (vm << 5) | (hm << 25) | (sm << 45)


def unpack(k):
    return k & 31, (k >> 5) & 0xFFFFF, (k >> 25) & 0xFFFFF, (k >> 45) & 0xFFFFF


def occupancy(a, vm, hm, sm):
    o = MASK["A"][a]
    for p in bits_of(vm):
        o |= MASK["V"][p]
    for p in bits_of(hm):
        o |= MASK["H"][p]
    return o | sm


def neighbors(k):
    a, vm, hm, sm = unpack(k)
    occ = occupancy(a, vm, hm, sm)
    out = []
    groups = (("A", None), ("V", vm), ("H", hm), ("S", sm))
    for t, m in groups:
        positions = [a] if t == "A" else list(bits_of(m))
        tm = MASK[t]
        tn = NBR[t]
        for p in positions:
            free = occ & ~tm[p]
            seen = {p}
            q = deque([p])
            while q:
                x = q.popleft()
                for y in tn[x]:
                    if y not in seen and not (tm[y] & free):
                        seen.add(y)
                        q.append(y)
                        if t == "A":
                            out.append(pack(y, vm, hm, sm))
                        elif t == "V":
                            out.append(pack(a, (vm & ~(1 << p)) | (1 << y), hm, sm))
                        elif t == "H":
                            out.append(pack(a, vm, (hm & ~(1 << p)) | (1 << y), sm))
                        else:
                            out.append(pack(a, vm, hm, (sm & ~(1 << p)) | (1 << y)))
    return out


def fill(occ, counts, start=0):
    """occ 以外のマスに counts=(v,h,s) の駒を置くすべての置き方。(vm,hm,sm) を返す。"""
    v, h, s = counts
    if v == 0 and h == 0 and s == 0:
        yield 0, 0, 0
        return
    # 最初の空きマスを決め、そこを覆う駒（そのマスが左上になる）か空きにする
    p = start
    while p < N and (occ >> p) & 1:
        p += 1
    if p >= N:
        return
    remaining_cells = N - bin(occ).count("1")
    need = 2 * v + 2 * h + s
    if need > remaining_cells:
        return
    # 空きのまま
    if need <= remaining_cells - 1:
        yield from fill(occ | (1 << p), counts, p + 1)  # p は空き（占有の結果には含めない）
    for t, idx in (("V", 0), ("H", 1), ("S", 2)):
        if counts[idx] == 0:
            continue
        m = MASK[t].get(p)
        if m is None or (m & occ):
            continue
        nc = list(counts)
        nc[idx] -= 1
        for vm, hm, sm in fill(occ | m, tuple(nc), p + 1):
            if t == "V":
                vm |= 1 << p
            elif t == "H":
                hm |= 1 << p
            else:
                sm |= 1 << p
            yield vm, hm, sm


def mirror(k):
    a, vm, hm, sm = unpack(k)

    def mpos(p, w):
        r, c = divmod(p, W)
        return r * W + (W - w - c)

    na = mpos(a, 2)
    nvm = 0
    for p in bits_of(vm):
        nvm |= 1 << mpos(p, 1)
    nhm = 0
    for p in bits_of(hm):
        nhm |= 1 << mpos(p, 2)
    nsm = 0
    for p in bits_of(sm):
        nsm |= 1 << mpos(p, 1)
    return pack(na, nvm, nhm, nsm)


def to_rows(k):
    a, vm, hm, sm = unpack(k)
    g = ["."] * N
    for i in range(2):
        for j in range(2):
            g[a + i * W + j] = "A"
    for p in bits_of(vm):
        g[p] = "v"
        g[p + W] = "w"
    for p in bits_of(hm):
        g[p] = "h"
        g[p + 1] = "i"
    for p in bits_of(sm):
        g[p] = "s"
    return "".join(g)


def analyse(counts):
    """駒の組の、出口に着ける連結成分の全状態と最短手数。"""
    t0 = time.time()
    gocc = MASK["A"][GOAL_POS]
    dist = {}
    q = deque()
    for vm, hm, sm in fill(gocc, counts):
        k = pack(GOAL_POS, vm, hm, sm)
        dist[k] = 0
        q.append(k)
    nbrs = {}
    while q:
        k = q.popleft()
        d = dist[k] + 1
        ns = neighbors(k)
        nbrs[k] = ns
        for n in ns:
            if n not in dist:
                dist[n] = d
                q.append(n)
    # 連結成分の数（出口に着ける成分だけ）
    comp = {}
    ncomp = 0
    for k in dist:
        if k in comp:
            continue
        ncomp += 1
        comp[k] = ncomp
        st = [k]
        while st:
            x = st.pop()
            for y in nbrs[x]:
                if y not in comp:
                    comp[y] = ncomp
                    st.append(y)
    elapsed = time.time() - t0
    return dist, nbrs, comp, ncomp, elapsed


def summarise(counts):
    dist, nbrs, comp, ncomp, elapsed = analyse(counts)
    v, h, s = counts
    pieces = 1 + v + h + s
    empty = N - 4 - 2 * v - 2 * h - s
    if not dist:
        return {"counts": {"v": v, "h": h, "s": s}, "pieces": pieces, "empty": empty,
                "states": 0, "components": 0, "max_moves": None, "hardest_example": None,
                "seconds": round(elapsed, 2), "hist": {}}
    # 各状態の属性
    hist = {}  # (filter, rule, maxlocal) -> {d: count}
    filters = {
        "any": lambda a: True,
        "top": lambda a: a < W,
        "topmid": lambda a: a == 1,
    }
    for k, d in dist.items():
        if d == 0:
            continue
        a = k & 31
        m = mirror(k)
        canon_first = k <= m  # 左右反転の組の代表（対称な状態は自分自身）
        localmax = all(dist[n] <= d for n in nbrs[k])
        for fn, f in filters.items():
            if not f(a):
                continue
            for rule, ok in (("raw", True), ("canon", canon_first)):
                if not ok:
                    continue
                for lm in (False, True):
                    if lm and not localmax:
                        continue
                    key = f"{fn}/{rule}/{'localmax' if lm else 'all'}"
                    hd = hist.setdefault(key, {})
                    hd[d] = hd.get(d, 0) + 1
    maxd = max(dist.values())
    hardest = sorted(k for k, d in dist.items() if d == maxd)
    return {
        "counts": {"v": v, "h": h, "s": s},
        "pieces": pieces,
        "empty": empty,
        "states": len(dist),
        "components": ncomp,
        "max_moves": maxd,
        "hardest_example": to_rows(min(hardest)),
        "seconds": round(elapsed, 2),
        "hist": {k: {str(d): c for d, c in sorted(v.items())} for k, v in sorted(hist.items())},
    }


def piece_sets(min_empty, max_empty):
    out = []
    for v in range(0, 9):
        for h in range(0, 9):
            for s in range(0, 17):
                e = N - 4 - 2 * v - 2 * h - s
                if min_empty <= e <= max_empty:
                    out.append((v, h, s))
    return out


def cmd_enumerate(argv):
    min_e = int(argv[argv.index("--min-empty") + 1]) if "--min-empty" in argv else 2
    max_e = int(argv[argv.index("--max-empty") + 1]) if "--max-empty" in argv else 6
    only = None
    if "--only" in argv:
        only = [tuple(map(int, x.split(","))) for x in argv[argv.index("--only") + 1].split(";")]
    res = []
    sets = only or piece_sets(min_e, max_e)
    for cs in sets:
        r = summarise(cs)
        res.append(r)
        print(
            f"v{cs[0]} h{cs[1]} s{cs[2]} e{r['empty']} states={r['states']} comps={r['components']} "
            f"max={r['max_moves']} t={r['seconds']}s",
            file=sys.stderr,
            flush=True,
        )
    json.dump(res, sys.stdout)


def ball(start, nbrs, radius):
    seen = {start}
    frontier = [start]
    for _ in range(radius):
        nxt = []
        for x in frontier:
            for y in nbrs[x]:
                if y not in seen:
                    seen.add(y)
                    nxt.append(y)
        frontier = nxt
    return seen


def separated(cands, nbrs, radius, seed, cap):
    """seed で並べた候補を順に見て、採った問題（と左右反転）から radius 手以内に無いものだけ採る。"""
    order = sorted(cands)
    random.Random(seed).shuffle(order)
    blocked = set()
    taken = []
    for k in order:
        if k in blocked:
            continue
        taken.append(k)
        if len(taken) >= cap:
            break
        if radius > 0:
            blocked |= ball(k, nbrs, radius)
            blocked |= ball(mirror(k), nbrs, radius)
    return taken


def band_rows(counts, bands, radii, seed, cap, start_filter):
    dist, nbrs, comp, ncomp, elapsed = analyse(counts)
    rows = []
    if not dist:
        return rows, elapsed
    filt = {"any": lambda a: True, "top": lambda a: a < W, "topmid": lambda a: a == 1}[start_filter]
    for lo, hi in bands:
        cands = []
        comps = set()
        for k, d in dist.items():
            if lo <= d <= hi and filt(k & 31) and k <= mirror(k):
                cands.append(k)
                comps.add(comp[k])
        if not cands:
            continue
        row = {"band": [lo, hi], "canon": len(cands), "components": len(comps)}
        for r in radii:
            row[f"sep{r}"] = len(separated(cands, nbrs, r, seed, cap))
        rows.append(row)
    return rows, elapsed


def cmd_bands(argv):
    def arg(name, default):
        return argv[argv.index(name) + 1] if name in argv else default

    min_e = int(arg("--min-empty", "2"))
    max_e = int(arg("--max-empty", "3"))
    bands = [tuple(map(int, b.split("-"))) for b in arg("--bands", "1-15,16-30,31-50,51-70,71-100").split(",")]
    radii = [int(x) for x in arg("--radii", "3,6,10").split(",")]
    seed = int(arg("--seed", "1"))
    cap = int(arg("--cap", "3000"))
    start_filter = arg("--start", "any")
    out = []
    for cs in piece_sets(min_e, max_e):
        rows, el = band_rows(cs, bands, radii, seed, cap, start_filter)
        e = N - 4 - 2 * sum(cs[:2]) - cs[2]
        for row in rows:
            row.update({"v": cs[0], "h": cs[1], "s": cs[2], "empty": e})
            out.append(row)
        print(f"v{cs[0]} h{cs[1]} s{cs[2]} done {el:.1f}s", file=sys.stderr, flush=True)
    json.dump(out, sys.stdout)


# 仮の5段階（難易度の観点が決める前の、供給を測るための帯。最短手数と空きの数を軸にする）
TRIAL_LEVELS = [
    {"level": 1, "moves": [8, 15], "empty": [3, 4]},
    {"level": 2, "moves": [16, 30], "empty": [2, 3]},
    {"level": 3, "moves": [31, 50], "empty": [2, 3]},
    {"level": 4, "moves": [51, 70], "empty": [2, 3]},
    {"level": 5, "moves": [71, 95], "empty": [2, 2]},
]


def cmd_pool(argv):
    def arg(name, default):
        return argv[argv.index(name) + 1] if name in argv else default

    seed = int(arg("--seed", "1"))
    per_level_arg = [int(x) for x in arg("--per-level", "500").split(",")]
    targets = {lv["level"]: per_level_arg[min(i, len(per_level_arg) - 1)] for i, lv in enumerate(TRIAL_LEVELS)}
    per_level = max(targets.values())
    radius = int(arg("--radius", "3"))
    mirror_rule = arg("--mirror", "canon")  # canon: 左右反転を同じ問題 / raw: 別の問題
    t0 = time.time()
    emin = min(lv["empty"][0] for lv in TRIAL_LEVELS)
    emax = max(lv["empty"][1] for lv in TRIAL_LEVELS)
    per_set = {lv["level"]: [] for lv in TRIAL_LEVELS}
    for cs in piece_sets(emin, emax):
        e = N - 4 - 2 * (cs[0] + cs[1]) - cs[2]
        levels = [lv for lv in TRIAL_LEVELS if lv["empty"][0] <= e <= lv["empty"][1]]
        if not levels:
            continue
        dist, nbrs, comp, ncomp, _ = analyse(cs)
        for lv in levels:
            lo, hi = lv["moves"]
            cands = [k for k, d in dist.items() if lo <= d <= hi and (mirror_rule == "raw" or k <= mirror(k))]
            if not cands:
                continue
            if mirror_rule == "raw":
                order = sorted(cands)
                random.Random(seed).shuffle(order)
                taken = []
                blocked = set()
                for k in order:
                    if k in blocked:
                        continue
                    taken.append(k)
                    if len(taken) >= per_level:
                        break
                    blocked |= ball(k, nbrs, radius)
            else:
                taken = separated(cands, nbrs, radius, seed, per_level)
            per_set[lv["level"]].append((cs, [(to_rows(k), dist[k]) for k in taken]))
        del dist, nbrs, comp
    pool = {}
    summary = []
    for lv in TRIAL_LEVELS:
        lists = per_set[lv["level"]]
        random.Random(seed * 100 + lv["level"]).shuffle(lists)
        # 駒の組を巡回して採る（1つの組に張り付かせない）
        chosen = []
        i = 0
        want = targets[lv["level"]]
        while len(chosen) < want and any(i < len(x[1]) for x in lists):
            for cs, items in lists:
                if i < len(items) and len(chosen) < want:
                    chosen.append(items[i])
            i += 1
        chosen.sort(key=lambda x: (x[1], x[0]))
        pool[str(lv["level"])] = [[b, d] for b, d in chosen]
        avail = sum(len(x[1]) for x in lists)
        ds = [d for _, d in chosen]
        summary.append({
            "level": lv["level"], "taken": len(chosen), "available_upto_cap": avail,
            "piece_sets": len(lists), "moves_min": min(ds) if ds else None,
            "moves_max": max(ds) if ds else None,
            "moves_median": sorted(ds)[len(ds) // 2] if ds else None,
        })
    raw = json.dumps({"generatorVersion": "trial", "levels": pool}, separators=(",", ":")).encode()
    result = {
        "seed": seed, "per_level": per_level_arg, "radius": radius, "mirror": mirror_rule,
        "levels": summary, "json_bytes": len(raw), "gzip_bytes": len(gzip.compress(raw, 9)),
        "seconds": round(time.time() - t0, 1),
        "first_of_each_level": {k: v[0] for k, v in pool.items() if v},
        "last_of_each_level": {k: v[-1] for k, v in pool.items() if v},
    }
    if "--dump" in argv:
        with open(arg("--dump", ""), "w") as f:
            f.write(raw.decode())
    json.dump(result, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "enumerate"
    if cmd == "enumerate":
        cmd_enumerate(sys.argv[2:])
    elif cmd == "pool":
        cmd_pool(sys.argv[2:])
    elif cmd == "bands":
        cmd_bands(sys.argv[2:])
    else:
        print("unknown command", file=sys.stderr)
        sys.exit(2)
