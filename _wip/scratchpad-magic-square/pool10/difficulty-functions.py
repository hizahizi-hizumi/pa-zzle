# --- Geometry (lines 41-80)
class Geometry:
    """n×n の盤面。マスは行優先の番号 0..n²-1、数は 1..n²。"""

    def __init__(self, n: int):
        self.n = n
        self.N = n * n
        self.M = n * (n * n + 1) // 2
        rows = [tuple(r * n + c for c in range(n)) for r in range(n)]
        cols = [tuple(r * n + c for r in range(n)) for c in range(n)]
        diag = tuple(i * n + i for i in range(n))
        anti = tuple(i * n + (n - 1 - i) for i in range(n))
        self.lines: list[tuple[int, ...]] = rows + cols + [diag, anti]
        self.line_names = [f"r{r}" for r in range(n)] + [f"c{c}" for c in range(n)] + ["d", "a"]
        self.cell_lines = [[li for li, L in enumerate(self.lines) if c in L] for c in range(self.N)]
        self.full = 0
        for v in range(1, self.N + 1):
            self.full |= 1 << v

    def range_mask(self, lo: int, hi: int) -> int:
        lo = max(lo, 1)
        hi = min(hi, self.N)
        if lo > hi:
            return 0
        return ((1 << (hi + 1)) - 1) ^ ((1 << lo) - 1)

    def symmetries(self) -> list[list[int]]:
        """回転と裏返しの8通り。perm[c] = 写した先のマス。"""
        n = self.n
        out = []
        for k in range(8):
            perm = []
            for c in range(self.N):
                r, q = divmod(c, n)
                for _ in range(k % 4):
                    r, q = q, n - 1 - r
                if k >= 4:
                    q = n - 1 - q
                perm.append(r * n + q)
            out.append(perm)
        return out

# --- geo_of (lines 86-89)
def geo_of(n: int) -> Geometry:
    if n not in GEOS:
        GEOS[n] = Geometry(n)
    return GEOS[n]

# --- line_allowed_masks (lines 112-151)
def line_allowed_masks(geo: Geometry, grid: list[int], unused: int) -> list[int] | None:
    """列ごとに、空きの1マスに入りうる数の範囲（緩めた上下限）。成り立たない列があれば None。"""
    vals = sorted(bits(unused))
    pre = [0]
    for v in vals:
        pre.append(pre[-1] + v)
    suf = [0]
    for v in reversed(vals):
        suf.append(suf[-1] + v)
    out = []
    M = geo.M
    for L in geo.lines:
        s = 0
        k = 0
        for c in L:
            v = grid[c]
            if v:
                s += v
            else:
                k += 1
        r = M - s
        if k == 0:
            if r != 0:
                return None
            out.append(0)
            continue
        if k > len(vals):
            return None
        if r < pre[k] or r > suf[k]:
            return None
        if k == 1:
            if 1 <= r <= geo.N and (unused >> r) & 1:
                out.append(1 << r)
            else:
                return None
        else:
            lo = r - suf[k - 1]
            hi = r - pre[k - 1]
            out.append(geo.range_mask(lo, hi))
    return out

# --- count_solutions (lines 154-213)
def count_solutions(geo: Geometry, grid0: list[int], limit: int = 2, node_cap: int | None = None,
                    rng: random.Random | None = None, collect: bool = False):
    """解の数（limit で止める）と探索した節点の数。node_cap に達したら capped=True。

    探索: 各節点で、列ごとの上下限から全空きマスの候補を作り、候補の最も少ないマスを分ける。
    rng を渡すと、分ける数の順を乱数で並べ替える（乱択の魔方陣を作るときに使う）。
    """
    grid = list(grid0)
    used = 0
    for v in grid:
        if v:
            if (used >> v) & 1:
                return {"count": 0, "nodes": 0, "capped": False, "solutions": []}
            used |= 1 << v
    unused = geo.full & ~used
    state = {"count": 0, "nodes": 0, "capped": False, "solutions": []}

    def rec(unused: int):
        if state["count"] >= limit or state["capped"]:
            return
        state["nodes"] += 1
        if node_cap is not None and state["nodes"] > node_cap:
            state["capped"] = True
            return
        allowed = line_allowed_masks(geo, grid, unused)
        if allowed is None:
            return
        best = -1
        best_mask = 0
        best_cnt = 10 ** 9
        for c in range(geo.N):
            if grid[c]:
                continue
            m = unused
            for li in geo.cell_lines[c]:
                m &= allowed[li]
            cnt = popcount(m)
            if cnt < best_cnt:
                best_cnt = cnt
                best = c
                best_mask = m
                if cnt == 0:
                    return
        if best < 0:
            state["count"] += 1
            if collect:
                state["solutions"].append(list(grid))
            return
        vs = list(bits(best_mask))
        if rng is not None:
            rng.shuffle(vs)
        for v in vs:
            grid[best] = v
            rec(unused & ~(1 << v))
            grid[best] = 0
            if state["count"] >= limit or state["capped"]:
                return

    rec(unused)
    return state

# --- random_magic_square (lines 216-224)
def random_magic_square(n: int, rng: random.Random, node_cap: int = 200000) -> tuple[list[int], int]:
    """乱択の深さ優先探索で魔方陣を1つ作る。打ち切ったらやり直す。(盤面, 使った節点の合計)"""
    geo = geo_of(n)
    total = 0
    while True:
        st = count_solutions(geo, [0] * geo.N, limit=1, node_cap=node_cap, rng=rng, collect=True)
        total += st["nodes"]
        if st["solutions"]:
            return st["solutions"][0], total

# --- all_squares4 (lines 1400-1405)
def all_squares4() -> list[list[int]]:
    global _SQUARES4
    if _SQUARES4 is None:
        st = count_solutions(geo_of(4), [0] * 16, limit=10 ** 6, collect=True)
        _SQUARES4 = st["solutions"]
    return _SQUARES4
