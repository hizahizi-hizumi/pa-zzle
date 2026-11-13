"""箱入り娘 導入判断の計測（標準ライブラリだけ、乱数なし）。

近いゲーム（スライドパズル SPEC-011、ブロック脱出 PUZZLE-041）との違いを、
同じ盤面の手数の数え方と、最短解の中の駒の動き方で測る。

- 盤: 4列×5行。駒: 娘 2×2、縦長 1×2（縦）、横長 2×1（横）、小駒 1×1。
- クリア: 娘の左上が行3・列1。
- 同じ形の駒は区別しない（状態は形の並びの文字列）。

手数の数え方を3つ比べる:
- piece: 合意の数え方。同じ駒の連続した移動は、何マス・何回曲がっても1手。
- straight: 1手 = 1つの駒を縦か横の一方向へ1マス以上（ブロック脱出の1手の数え方）。
- step: 1手 = 1つの駒を1マス（スライドパズルの1枚1マスに近い数え方）。

実行: python3 scripts/research/hakoiri_musume_decision.py
"""

from __future__ import annotations

import json
import time
from collections import deque

W, H = 4, 5
SHAPES = {"A": (2, 2), "V": (2, 1), "H": (1, 2), "s": (1, 1)}  # 型: (高さ, 幅)

BOARDS = {
    # 合意の易しい例（最短13手と合意で計測済み）
    "easy": ["bAAc", "bAAc", "d..f", "dEEf", "g..h"],
    # 横刀立馬（最短81手と合意で計測済み）
    "yokoto": ["bAAc", "bAAc", "dEEf", "dghf", "i..j"],
}


def parse(rows: list[str]) -> list[tuple[str, int, int]]:
    """盤の文字列 → [(型, 行, 列)]。同じ文字 = 同じ駒、'.' = 空き。"""
    cells: dict[str, list[tuple[int, int]]] = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != ".":
                cells.setdefault(ch, []).append((r, c))
    pieces = []
    for _, v in sorted(cells.items()):
        rs = [a for a, _ in v]
        cs = [b for _, b in v]
        h, w = max(rs) - min(rs) + 1, max(cs) - min(cs) + 1
        t = {shape: k for k, shape in SHAPES.items()}[(h, w)]
        pieces.append((t, min(rs), min(cs)))
    return pieces


def to_key(pieces: list[tuple[str, int, int]]) -> str:
    g = ["."] * (W * H)
    for t, r, c in pieces:
        h, w = SHAPES[t]
        for i in range(h):
            for j in range(w):
                g[(r + i) * W + c + j] = t
    return "".join(g)


def from_key(key: str) -> list[tuple[str, int, int]]:
    seen = [False] * (W * H)
    pieces = []
    for idx, ch in enumerate(key):
        if ch == "." or seen[idx]:
            continue
        h, w = SHAPES[ch]
        r, c = divmod(idx, W)
        for i in range(h):
            for j in range(w):
                seen[(r + i) * W + c + j] = True
        pieces.append((ch, r, c))
    return pieces


def fits(occ: set[int], t: str, r: int, c: int) -> bool:
    h, w = SHAPES[t]
    if r < 0 or c < 0 or r + h > H or c + w > W:
        return False
    return all((r + i) * W + c + j not in occ for i in range(h) for j in range(w))


def occupied(pieces, skip: int) -> set[int]:
    occ = set()
    for k, (t, r, c) in enumerate(pieces):
        if k == skip:
            continue
        h, w = SHAPES[t]
        for i in range(h):
            for j in range(w):
                occ.add((r + i) * W + c + j)
    return occ


DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def moves(key: str, metric: str):
    """(次の状態, その手が一直線で届くか) を返す。"""
    pieces = from_key(key)
    for k, (t, r, c) in enumerate(pieces):
        occ = occupied(pieces, k)
        if metric == "step":
            targets = [((r + dy, c + dx), True) for dy, dx in DIRS if fits(occ, t, r + dy, c + dx)]
        elif metric == "straight":
            targets = []
            for dy, dx in DIRS:
                y, x = r + dy, c + dx
                while fits(occ, t, y, x):
                    targets.append(((y, x), True))
                    y, x = y + dy, x + dx
        else:  # piece: 曲がってもよい連続移動
            straight = set()
            for dy, dx in DIRS:
                y, x = r + dy, c + dx
                while fits(occ, t, y, x):
                    straight.add((y, x))
                    y, x = y + dy, x + dx
            seen = {(r, c)}
            q = deque([(r, c)])
            targets = []
            while q:
                y, x = q.popleft()
                for dy, dx in DIRS:
                    n = (y + dy, x + dx)
                    if n in seen or not fits(occ, t, *n):
                        continue
                    seen.add(n)
                    q.append(n)
                    targets.append((n, n in straight))
        for (y, x), is_straight in targets:
            nxt = list(pieces)
            nxt[k] = (t, y, x)
            yield to_key(nxt), is_straight


def is_goal(key: str) -> bool:
    return key[3 * W + 1] == "A" and key[3 * W + 2] == "A" and key[4 * W + 1] == "A" and key[4 * W + 2] == "A"


def component(start: str) -> dict[str, list[tuple[str, bool]]]:
    """start を含む連結成分（piece の数え方の辺）。辺は対称（可逆）のはず。"""
    adj: dict[str, list[tuple[str, bool]]] = {}
    q = deque([start])
    adj[start] = []
    while q:
        u = q.popleft()
        out = list(moves(u, "piece"))
        adj[u] = out
        for v, _ in out:
            if v not in adj:
                adj[v] = []
                q.append(v)
    return adj


def shortest(start: str, metric: str) -> int | None:
    dist = {start: 0}
    q = deque([start])
    while q:
        u = q.popleft()
        if is_goal(u):
            return dist[u]
        for v, _ in moves(u, metric):
            if v not in dist:
                dist[v] = dist[u] + 1
                q.append(v)
    return None


def min_bend_optimal_path(start: str, adj) -> tuple[int, int, list[str]]:
    """piece の数え方で最短の解のうち、一直線で届かない手（曲がる手）が最も少ない解。"""
    dist = {start: 0}
    bends = {start: 0}
    parent: dict[str, str | None] = {start: None}
    layer = [start]
    while layer:
        goals = [u for u in layer if is_goal(u)]
        if goals:
            g = min(goals, key=lambda u: (bends[u], u))
            path = []
            x: str | None = g
            while x is not None:
                path.append(x)
                x = parent[x]
            return dist[g], bends[g], path[::-1]
        nxt: list[str] = []
        for u in sorted(layer):
            for v, is_straight in adj[u]:
                b = bends[u] + (0 if is_straight else 1)
                if v not in dist:
                    dist[v] = dist[u] + 1
                    bends[v] = b
                    parent[v] = u
                    nxt.append(v)
                elif dist[v] == dist[u] + 1 and b < bends[v]:
                    bends[v] = b
                    parent[v] = u
        layer = nxt
    raise ValueError("解なし")


def piece_axes(rows: list[str], path: list[str]) -> dict:
    """解の道順で、各駒（文字で区別）が縦・横のどちらに動いたかを数える。"""
    labels: dict[int, str] = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != ".":
                labels[r * W + c] = ch
    shape_of = {}
    for t, r, c in parse(rows):
        shape_of[labels[r * W + c]] = t
    axes: dict[str, set[str]] = {ch: set() for ch in shape_of}
    moved_count = {ch: 0 for ch in shape_of}
    for a, b in zip(path, path[1:]):
        vacated = [i for i in range(W * H) if a[i] != "." and (b[i] != a[i])]
        filled = [i for i in range(W * H) if b[i] != "." and (a[i] != b[i])]
        ch = labels[vacated[0]] if vacated else None
        # 動いた駒の全マス（同じ文字）を移す
        old = sorted(i for i, x in labels.items() if x == ch)
        t = shape_of[ch]
        h, w = SHAPES[t]
        orr, occ_ = divmod(old[0], W)
        # 新しい左上: b の中で、filled と old の残りから同型の駒の左上を探す
        cand = set(filled) | (set(old) - set(vacated))
        top = min(cand)
        nr, nc = divmod(top, W)
        if nr != orr:
            axes[ch].add("縦")
        if nc != occ_:
            axes[ch].add("横")
        moved_count[ch] += 1
        for i in old:
            del labels[i]
        for i in range(h):
            for j in range(w):
                labels[(nr + i) * W + nc + j] = ch
    by_shape: dict[str, dict[str, int]] = {}
    names = {"A": "娘", "V": "縦長", "H": "横長", "s": "小駒"}
    for ch, t in shape_of.items():
        d = by_shape.setdefault(names[t], {"駒": 0, "動いた駒": 0, "縦横の両方に動いた駒": 0})
        d["駒"] += 1
        if moved_count[ch]:
            d["動いた駒"] += 1
        if len(axes[ch]) == 2:
            d["縦横の両方に動いた駒"] += 1
    return by_shape


def main() -> None:
    out = {}
    for name, rows in BOARDS.items():
        t0 = time.time()
        start = to_key(parse(rows))
        adj = component(start)
        symmetric = all(any(w == u for w, _ in adj[v]) for u in adj for v, _ in adj[u])
        res = {
            "盤": rows,
            "連結成分の状態数（同じ形の駒を区別しない）": len(adj),
            "辺が対称（全手が逆の1手で戻せる）": symmetric,
            "成分の中のクリア状態数": sum(1 for u in adj if is_goal(u)),
            "最短手数": {m: shortest(start, m) for m in ("piece", "straight", "step")},
        }
        n, b, path = min_bend_optimal_path(start, adj)
        res["piece最短の解のうち曲がる手が最少の解"] = {"手数": n, "曲がる手": b}
        res["その解での駒の動き"] = piece_axes(rows, path)
        res["秒"] = round(time.time() - t0, 1)
        out[name] = res
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
