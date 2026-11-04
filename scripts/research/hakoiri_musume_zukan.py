"""箱入り娘 調査: 図鑑と問題の特徴。

始めたときの盤面で分かる特徴の案ごとに、
(1) レベルの中で値が分かれるか（値の種類と各値の問題の数）、
(2) ほかの案の特徴と重ならないか（特徴どうしの順位相関）、
(3) 難易度の写しにならないか（読みの量との順位相関）
を測る。

盤は 4 列 × 5 行。駒は娘 (2×2)・縦長 (縦2×横1)・横長 (縦1×横2)・小駒 (1×1)。
1手 = 同じ駒の連続した移動（何マス・何回曲がっても1手）。娘の左上が (行3, 列1) でクリア。

読みの量は `READING_MEASURES` から選ぶ（既定は最短手数）。難易度の観点が別の量を選んだら、
状態と最短手数・連結成分を受け取る関数を足して `--reading` で差し替える。

レベルは仮の分け方（`PROVISIONAL_LEVELS`）。駒の構成（空きマスの数）と最短手数の帯で5つに分ける。
問題集は、各レベルの条件に当たる全状態から seed を固定して `--per-level` 問ずつ引く（左右の鏡像は1つにまとめる）。

標準ライブラリだけで書く。
    python3 scripts/research/hakoiri_musume_zukan.py [--seed 1] [--per-level 300] [--reading shortest]
    python3 scripts/research/hakoiri_musume_zukan.py --sample composition   # 構成を一様に選んでから引く
    python3 scripts/research/hakoiri_musume_zukan.py --cache-dir <作業ディレクトリ>   # 構成ごとの候補を置いて2回目から速くする
    python3 scripts/research/hakoiri_musume_zukan.py --write-expected   # 期待値を書き出す（seed 1〜3、--sample の方式）
    python3 scripts/research/hakoiri_musume_zukan.py --check-expected   # 期待値と照らす

最初の実行は 99 構成の全配置を BFS するので、計測した環境で約8分かかった（構成ごとの候補を置けば2回目からは約7秒）。
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from collections import Counter, deque
from pathlib import Path

W, H = 4, 5
N = W * H
GOAL_TOP_LEFT = 3 * W + 1

# 1マスごとの文字。駒の中の位置まで書くので、同じ種類の駒が隣り合っても読み違えない。
# 娘: a b / c d、縦長: v / w、横長: h i、小駒: s、空き: .
SHAPES = {
    "A": ((0, 0, "a"), (0, 1, "b"), (1, 0, "c"), (1, 1, "d")),
    "V": ((0, 0, "v"), (1, 0, "w")),
    "H": ((0, 0, "h"), (0, 1, "i")),
    "S": ((0, 0, "s"),),
}
SIZE = {"A": (2, 2), "V": (2, 1), "H": (1, 2), "S": (1, 1)}
TOP_CHAR = {"a": "A", "v": "V", "h": "H", "s": "S"}


def mask_of(kind: str, r: int, c: int) -> int:
    m = 0
    for dr, dc, _ in SHAPES[kind]:
        m |= 1 << ((r + dr) * W + (c + dc))
    return m


MASKS = {
    k: {
        (r, c): mask_of(k, r, c)
        for r in range(H - SIZE[k][0] + 1)
        for c in range(W - SIZE[k][1] + 1)
    }
    for k in SHAPES
}


def pieces_of(state: str) -> list[tuple[str, int, int]]:
    out = []
    for i, ch in enumerate(state):
        k = TOP_CHAR.get(ch)
        if k:
            out.append((k, i // W, i % W))
    return out


def occupancy(state: str) -> int:
    m = 0
    for i, ch in enumerate(state):
        if ch != ".":
            m |= 1 << i
    return m


def place(cells: list[str], kind: str, r: int, c: int, fill: str | None = None) -> None:
    for dr, dc, ch in SHAPES[kind]:
        cells[(r + dr) * W + (c + dc)] = fill if fill is not None else ch


def neighbors(state: str):
    occ = occupancy(state)
    for kind, r, c in pieces_of(state):
        own = MASKS[kind][(r, c)]
        rest = occ & ~own
        masks = MASKS[kind]
        seen = {(r, c)}
        q = deque([(r, c)])
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if (ny, nx) in seen:
                    continue
                m = masks.get((ny, nx))
                if m is None or m & rest:
                    continue
                seen.add((ny, nx))
                q.append((ny, nx))
        seen.discard((r, c))
        if not seen:
            continue
        base = list(state)
        place(base, kind, r, c, ".")
        for ny, nx in seen:
            cells = base[:]
            place(cells, kind, ny, nx)
            yield "".join(cells)


def is_goal(state: str) -> bool:
    return state[GOAL_TOP_LEFT] == "a"


def mirror(state: str) -> str:
    rows = [state[i * W:(i + 1) * W][::-1] for i in range(H)]
    swap = str.maketrans({"a": "b", "b": "a", "c": "d", "d": "c", "h": "i", "i": "h"})
    return "".join(rows).translate(swap)


def enumerate_states(nv: int, nh: int, ns: int) -> list[str]:
    """娘1・縦長 nv・横長 nh・小駒 ns の全配置。"""
    out: list[str] = []
    cells = [""] * N
    need = {"A": 1, "V": nv, "H": nh, "S": ns}
    empty_left = [N - 4 - 2 * nv - 2 * nh - ns]

    def rec(i: int) -> None:
        while i < N and cells[i] != "":
            i += 1
        if i == N:
            if all(v == 0 for v in need.values()) and empty_left[0] == 0:
                out.append("".join(cells))
            return
        r, c = divmod(i, W)
        if empty_left[0] > 0:
            empty_left[0] -= 1
            cells[i] = "."
            rec(i + 1)
            cells[i] = ""
            empty_left[0] += 1
        for kind in ("S", "V", "H", "A"):
            if need[kind] == 0:
                continue
            h, w = SIZE[kind]
            if r + h > H or c + w > W:
                continue
            if any(cells[(r + dr) * W + (c + dc)] != "" for dr, dc, _ in SHAPES[kind]):
                continue
            need[kind] -= 1
            place(cells, kind, r, c)
            rec(i + 1)
            place(cells, kind, r, c, "")
            need[kind] += 1

    rec(0)
    return out


def goal_distances(states: list[str]) -> dict[str, int]:
    """全状態から、クリアの状態までの最短手数（多始点 BFS）。解けない状態は含めない。"""
    dist: dict[str, int] = {}
    q: deque[str] = deque()
    for s in states:
        if is_goal(s):
            dist[s] = 0
            q.append(s)
    while q:
        s = q.popleft()
        d = dist[s] + 1
        for t in neighbors(s):
            if t not in dist:
                dist[t] = d
                q.append(t)
    return dist


# ---- 仮のレベル ----------------------------------------------------------------
# 駒の構成は、空きマスの数で3つの帯に分ける。どの構成も小駒は 2〜4、縦長+横長は 2〜5。
# 最短手数の帯は、空き2マスの構成で横刀立馬（81手）がレベル5 に入るように置いた仮の値。
# (名前, 空きマスの数の集合, 最短手数の下限, 上限)
PROVISIONAL_LEVELS = [
    (1, {4, 5, 6}, 8, 20),
    (2, {3, 4}, 21, 35),
    (3, {2, 3}, 36, 55),
    (4, {2}, 56, 75),
    (5, {2}, 76, 200),
]


def compositions() -> list[tuple[int, int, int]]:
    """娘1と、縦長+横長 1〜7・小駒 0〜6 で、空きが 2〜6 マスになる構成。"""
    out = []
    for nv in range(0, 8):
        for nh in range(0, 8):
            if not 1 <= nv + nh <= 7:
                continue
            for ns in range(0, 7):
                empty = N - 4 - 2 * (nv + nh) - ns
                if 2 <= empty <= 6:
                    out.append((nv, nh, ns))
    return out


MIN_SHORTEST = min(lo for _, _, lo, _ in PROVISIONAL_LEVELS)


def composition_candidates(comp, cache_dir: Path | None, log) -> list[tuple[str, int]]:
    """構成の全配置のうち、解けて最短手数が MIN_SHORTEST 以上の状態（鏡像は1つにまとめる）。"""
    nv, nh, ns = comp
    path = cache_dir / f"c{nv}{nh}{ns}.json" if cache_dir else None
    if path and path.exists():
        return [tuple(x) for x in json.loads(path.read_text())]
    t0 = time.time()
    states = enumerate_states(nv, nh, ns)
    dist = goal_distances(states)
    empty = N - 4 - 2 * (nv + nh) - ns
    mx = max(dist.values()) if dist else 0
    log(f"  構成 縦{nv} 横{nh} 小{ns} 空{empty}: 配置 {len(states)} 解ける {len(dist)} 最長 {mx} ({time.time() - t0:.0f}s)")
    out = sorted((s, d) for s, d in dist.items() if d >= MIN_SHORTEST and s <= mirror(s))
    if path:
        path.write_text(json.dumps(out))
    return out


# ---- 特徴の案（始めたときの盤面で分かるもの） --------------------------------------


def a_pos(state: str) -> tuple[int, int]:
    i = state.index("a")
    return divmod(i, W)


def feat_pieces(state: str) -> int:
    return len(pieces_of(state))


def feat_small(state: str) -> int:
    return state.count("s")


def feat_vertical(state: str) -> int:
    return state.count("v")


def feat_horizontal(state: str) -> int:
    return state.count("h")


def feat_long(state: str) -> int:
    return state.count("v") + state.count("h")


def feat_empty(state: str) -> int:
    return state.count(".")


def feat_daughter_rows(state: str) -> int:
    """娘が出口まで下りる行の数（0〜3）。"""
    return 3 - a_pos(state)[0]


def feat_blockers(state: str) -> int:
    """娘から出口までの通り道（娘の列の、娘より下のマス）にかかる駒の数。"""
    r, c = a_pos(state)
    seen = set()
    for rr in range(r + 2, H):
        for cc in (c, c + 1):
            ch = state[rr * W + cc]
            if ch == ".":
                continue
            # 駒の左上を探す
            k = ch
            y, x = rr, cc
            if k == "w":
                y -= 1
            elif k == "i":
                x -= 1
            seen.add((y, x))
    return len(seen)


def feat_exit_blockers(state: str) -> int:
    """出口の前の2×2（行3〜4・列1〜2）にかかる、娘以外の駒の数。"""
    seen = set()
    for rr in (3, 4):
        for cc in (1, 2):
            ch = state[rr * W + cc]
            if ch in ".abcd":
                continue
            y, x = rr, cc
            if ch == "w":
                y -= 1
            elif ch == "i":
                x -= 1
            seen.add((y, x))
    return len(seen)


def feat_empty_groups(state: str) -> int:
    """空きマスのかたまりの数（上下左右でつながるものを1つ）。"""
    empties = {i for i, ch in enumerate(state) if ch == "."}
    groups = 0
    while empties:
        groups += 1
        q = [empties.pop()]
        while q:
            i = q.pop()
            r, c = divmod(i, W)
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                j = nr * W + nc
                if 0 <= nr < H and 0 <= nc < W and j in empties:
                    empties.discard(j)
                    q.append(j)
    return groups


FEATURES = {
    "駒の数": feat_pieces,
    "小駒": feat_small,
    "縦長": feat_vertical,
    "横長": feat_horizontal,
    "長い駒": feat_long,
    "空きマス": feat_empty,
    "娘の高さ": feat_daughter_rows,
    "通り道の駒": feat_blockers,
    "出口前の駒": feat_exit_blockers,
    "空きのかたまり": feat_empty_groups,
}


# ---- 読みの量 -----------------------------------------------------------------


def reading_shortest(state: str, dist: dict[str, int]) -> float:
    return dist[state]


READING_MEASURES = {"shortest": reading_shortest}


# ---- 統計 ---------------------------------------------------------------------


def ranks(xs: list[float]) -> list[float]:
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r


def spearman(xs: list[float], ys: list[float]) -> float | None:
    rx, ry = ranks(xs), ranks(ys)
    n = len(xs)
    mx, my = sum(rx) / n, sum(ry) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    sxx = sum((a - mx) ** 2 for a in rx)
    syy = sum((b - my) ** 2 for b in ry)
    if sxx == 0 or syy == 0:
        return None
    return sxy / (sxx * syy) ** 0.5


# ---- 本体 ---------------------------------------------------------------------


def build_candidates(cache_dir: Path | None, log=print):
    """レベルごとの候補を、構成ごとに（鏡像をまとめた代表の状態, 最短手数）で返す。"""
    per_level: dict[int, dict[tuple, list[tuple[str, int]]]] = {lv: {} for lv, *_ in PROVISIONAL_LEVELS}
    for comp in compositions():
        nv, nh, ns = comp
        empty = N - 4 - 2 * (nv + nh) - ns
        for s, d in composition_candidates(comp, cache_dir, log):
            for lv, empties, lo, hi in PROVISIONAL_LEVELS:
                if empty in empties and lo <= d <= hi:
                    per_level[lv].setdefault(comp, []).append((s, d))
    return per_level


def sample_pool(per_level, per_level_count: int, seed: int, mode: str) -> dict[int, list[tuple[str, int]]]:
    """state: レベルの候補の全状態から一様に引く。composition: 構成を一様に選んでから状態を引く。"""
    pool = {}
    for lv, by_comp in per_level.items():
        rng = random.Random(seed * 1000 + lv)
        if mode == "state":
            items = sorted(x for v in by_comp.values() for x in v)
            pool[lv] = rng.sample(items, min(per_level_count, len(items)))
        else:
            comps = sorted(by_comp)
            left = {c: sorted(by_comp[c]) for c in comps}
            chosen: list[tuple[str, int]] = []
            while len(chosen) < per_level_count and any(left.values()):
                c = rng.choice([c for c in comps if left[c]])
                chosen.append(left[c].pop(rng.randrange(len(left[c]))))
            pool[lv] = chosen
    return pool


def analyse(pool, reading: str) -> dict:
    measure = READING_MEASURES[reading]
    out: dict = {"levels": {}}
    names = list(FEATURES)
    for lv, items in pool.items():
        dist = {s: d for s, d in items}
        vals = {n: [FEATURES[n](s) for s, _ in items] for n in names}
        read = [measure(s, dist) for s, _ in items]
        lvout = {
            "problems": len(items),
            "shortest": {"min": min(dist.values()), "max": max(dist.values())},
            "features": {},
        }
        for n in names:
            c = Counter(vals[n])
            rho = spearman(vals[n], read)
            lvout["features"][n] = {
                "values": {str(k): v for k, v in sorted(c.items())},
                "rho_reading": None if rho is None else round(rho, 3),
            }
        pair = {}
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                r = spearman(vals[a], vals[b])
                pair[f"{a}|{b}"] = None if r is None else round(r, 3)
        lvout["pair_rho"] = pair
        out["levels"][str(lv)] = lvout
    # レベルをまたいだ相関（レベルの写しかどうか）
    all_items = [(lv, s, d) for lv, items in pool.items() for s, d in items]
    lv_list = [lv for lv, _, _ in all_items]
    out["across"] = {
        n: round(spearman([FEATURES[n](s) for _, s, _ in all_items], lv_list) or 0, 3) for n in names
    }
    return out


def report(res: dict) -> None:
    for lv, d in res["levels"].items():
        print(f"\n== レベル{lv} {d['problems']}問 最短 {d['shortest']['min']}〜{d['shortest']['max']}手")
        for n, f in d["features"].items():
            print(f"  {n:8s} rho読み={f['rho_reading']}  値: {f['values']}")
        strong = {k: v for k, v in d["pair_rho"].items() if v is not None and abs(v) >= 0.5}
        print("  |rho|>=0.5 の組:", strong)
    print("\n== レベルとの順位相関（全レベル）:", res["across"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--per-level", type=int, default=300)
    ap.add_argument("--reading", default="shortest", choices=sorted(READING_MEASURES))
    ap.add_argument("--sample", default="state", choices=["state", "composition"])
    ap.add_argument("--cache-dir", type=Path, default=None, help="構成ごとの候補を置く作業ディレクトリ")
    ap.add_argument("--json", action="store_true", help="結果を JSON で出す")
    ap.add_argument("--write-expected", action="store_true")
    ap.add_argument("--check-expected", action="store_true")
    args = ap.parse_args()

    if args.cache_dir:
        args.cache_dir.mkdir(parents=True, exist_ok=True)
    per_level = build_candidates(args.cache_dir, log=lambda m: print(m, file=sys.stderr))
    counts = {str(lv): sum(len(v) for v in d.values()) for lv, d in per_level.items()}
    comps = {str(lv): len(d) for lv, d in per_level.items()}
    print("候補の数（鏡像をまとめた後）:", counts, "構成の数:", comps, file=sys.stderr)
    expected_path = Path(__file__).with_suffix(".expected.json")
    if args.write_expected or args.check_expected:
        got = {}
        for seed in (1, 2, 3):
            pool = sample_pool(per_level, args.per_level, seed, args.sample)
            res = analyse(pool, args.reading)
            got[str(seed)] = {
                lv: {n: f["values"] for n, f in d["features"].items() if n in ADOPTED}
                | {"rho_reading": {n: d["features"][n]["rho_reading"] for n in ADOPTED}}
                for lv, d in res["levels"].items()
            }
        got = {"per_level": args.per_level, "reading": args.reading, "adopted": ADOPTED,
               "sample": args.sample, "candidates": counts, "seeds": got}
        if args.write_expected:
            expected_path.write_text(json.dumps(got, ensure_ascii=False, indent=1) + "\n")
            print("wrote", expected_path)
            return 0
        exp = json.loads(expected_path.read_text())
        ok = exp == got
        print("一致" if ok else "不一致")
        return 0 if ok else 1
    pool = sample_pool(per_level, args.per_level, args.seed, args.sample)
    res = analyse(pool, args.reading)
    res["candidates"] = counts
    res["compositions"] = comps
    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        report(res)
    return 0


# 採った案（期待値に書く特徴）。図鑑での書き方は 横長「横長 3個」・小駒「小駒 4個」・娘の高さ「娘の下 3段」の案。
ADOPTED = ["横長", "小駒", "娘の高さ"]

if __name__ == "__main__":
    sys.exit(main())
