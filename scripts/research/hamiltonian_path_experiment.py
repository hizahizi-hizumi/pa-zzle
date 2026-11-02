"""PUZZLE-056 ハミルトン路（全マス一筆書き）の問題供給・難易度運用の調査用実験。

標準ライブラリのみ。盤面は長方形格子、通行不可マス（壁）と隣接マス間の仕切りがあり得て、
上下左右の隣接だけで有効マスをちょうど1回ずつ通る1本の道を引く。

サブコマンド:
    variants         ルール変種（始点のみ / 始点と終点 / 指定なし）ごとの一意解の出やすさ
    unique           一意解の生成（マス壁の山登り / 仕切り追加）と人間向け解法器による帯
    anypath          一意性を問わない問題の生成と描画視点の分岐分析
    report           unique / anypath の保存結果から集計表を出す
    diversity        同型重複と蛇行の多さ
    examples         一意性を問わない問題の帯別の代表例
    unique-examples  一意解問題の帯別の代表例
    selfcheck        全解探索の既知値と人間向け解法器の健全性の確認

例:
    python3 scripts/research/hamiltonian_path_experiment.py unique --seed 20261031 --jsonl /tmp/ham_unique.jsonl
    python3 scripts/research/hamiltonian_path_experiment.py report --unique-jsonl /tmp/ham_unique.jsonl
"""

# ruff: noqa: C901, PLR0912, PLR0915, PLR0917, PLR2004, S311, FBT001, FBT002, FBT003, INP001, RUF002, RUF003

from __future__ import annotations

import argparse
import multiprocessing
import random
import statistics
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from itertools import pairwise
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Sequence

sys.setrecursionlimit(20000)

UNK = 0
YES = 1
NO = -1

ROLE_MID = 0
ROLE_END = 1
ROLE_CAND = 2


class Timeout(Exception):  # noqa: N818
    pass


@dataclass(frozen=True)
class Board:
    rows: int
    cols: int
    open_cells: frozenset[int]  # index = r * (cols + 1) + c （右端に番兵列）
    blocked: frozenset[tuple[int, int]] = frozenset()  # 隣接マス間の仕切り（小さい方, 大きい方）

    @property
    def width(self) -> int:
        return self.cols + 1

    @property
    def size(self) -> int:
        return self.rows * self.width

    def idx(self, r: int, c: int) -> int:
        return r * self.width + c

    def rc(self, i: int) -> tuple[int, int]:
        return divmod(i, self.width)

    def color(self, i: int) -> int:
        r, c = self.rc(i)
        return (r + c) & 1

    def neighbors(self, i: int) -> list[int]:
        r, c = self.rc(i)
        out = []
        for dr, dc in ((-1, 0), (0, 1), (1, 0), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols:
                j = self.idx(nr, nc)
                if j in self.open_cells and (min(i, j), max(i, j)) not in self.blocked:
                    out.append(j)
        return out


def board_from_path(
    rows: int, cols: int, path: Sequence[int], blocked: frozenset[tuple[int, int]] = frozenset()
) -> Board:
    return Board(rows, cols, frozenset(path), blocked)


def render(board: Board, start: int | None, end: int | None, path: Sequence[int] | None = None) -> str:
    """# は壁マス、S/E は始点/終点、数字は通過順。仕切りは | と --- で表す。"""
    order = {v: k for k, v in enumerate(path)} if path else {}

    def label(i: int) -> str:
        if i not in board.open_cells:
            return " # "
        if i == start:
            return " S "
        if i == end:
            return " E "
        return f"{order[i] + 1:2d} " if i in order else " . "

    def cut(i: int, j: int) -> bool:
        return (min(i, j), max(i, j)) in board.blocked

    lines = []
    for r in range(board.rows):
        row = ""
        for c in range(board.cols):
            i = board.idx(r, c)
            row += label(i)
            if c + 1 < board.cols:
                row += "|" if cut(i, i + 1) else " "
        lines.append(row.rstrip())
        if r + 1 < board.rows and board.blocked:
            under = ""
            for c in range(board.cols):
                i = board.idx(r, c)
                under += ("---" if cut(i, i + board.width) else "   ") + " "
            lines.append(under.rstrip())
    return "\n".join(lines)


def serpentine(rows: int, cols: int) -> list[int]:
    w = cols + 1
    out = []
    for r in range(rows):
        cs = range(cols) if r % 2 == 0 else range(cols - 1, -1, -1)
        out.extend(r * w + c for c in cs)
    return out


def grid_nbrs_table(rows: int, cols: int) -> list[list[int]]:
    w = cols + 1
    table: list[list[int]] = [[] for _ in range(rows * w)]
    for r in range(rows):
        for c in range(cols):
            i = r * w + c
            for dr, dc in ((-1, 0), (0, 1), (1, 0), (0, -1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols:
                    table[i].append(nr * w + nc)
    return table


def mutate_path(path: list[int], nbrs: list[list[int]], rng: random.Random, allow_reptation: bool) -> list[int]:
    """backbite（端点を経路上の隣へつなぎ替え）とreptation（片端を伸ばし反対端を縮める）の1手。"""
    seq = path[::-1] if rng.random() < 0.5 else path
    x = rng.choice(nbrs[seq[-1]])
    k = seq.index(x) if x in seq else None
    if k is None:
        if not allow_reptation:
            return seq
        return [*seq[1:], x]
    if k == len(seq) - 2:
        return seq
    return seq[: k + 1] + seq[k + 1 :][::-1]


def random_full_path(rows: int, cols: int, rng: random.Random, sweeps: int = 30) -> list[int]:
    """全面盤のランダムなハミルトン路（蛇行から backbite で混合）。"""
    nbrs = grid_nbrs_table(rows, cols)
    path = serpentine(rows, cols)
    for _ in range(sweeps * rows * cols):
        path = mutate_path(path, nbrs, rng, allow_reptation=False)
    return path


def random_saw(rows: int, cols: int, n_open: int, rng: random.Random, sweeps: int = 30) -> list[int]:
    """長さ n_open の自己回避路（backbite + reptation）。通らないマスが壁になる。"""
    nbrs = grid_nbrs_table(rows, cols)
    path = serpentine(rows, cols)
    offset = rng.randrange(0, rows * cols - n_open + 1)
    path = path[offset : offset + n_open]
    for _ in range(sweeps * rows * cols):
        path = mutate_path(path, nbrs, rng, allow_reptation=True)
    return path


def random_walk_path(rows: int, cols: int, rng: random.Random, alpha: float) -> list[int]:
    """ランダム歩行（Warnsdorff 寄りの重み）で行き詰まるまで進む。通らないマスが壁になる。"""
    nbrs = grid_nbrs_table(rows, cols)
    cells = [r * (cols + 1) + c for r in range(rows) for c in range(cols)]
    cur = rng.choice(cells)
    seen = {cur}
    path = [cur]
    while True:
        cand = [x for x in nbrs[cur] if x not in seen]
        if not cand:
            return path
        weights = []
        for x in cand:
            onward = sum(1 for y in nbrs[x] if y not in seen)
            weights.append(1.0 / (1 + onward) ** alpha)
        cur = rng.choices(cand, weights)[0]
        seen.add(cur)
        path.append(cur)


@dataclass
class CountResult:
    count: int
    nodes: int
    timeout: bool
    solutions: list[list[int]]
    max_depth: int = 0


class PathCounter:
    """先頭から道を伸ばす全解探索。枝刈り: 孤立マス / 行き止まりマス数 / パリティ / 連結性。"""

    def __init__(self, board: Board) -> None:
        self.b = board
        size = board.size
        self.nbrs: list[list[int]] = [[] for _ in range(size)]
        for v in board.open_cells:
            self.nbrs[v] = board.neighbors(v)
        self.color = [0] * size
        for v in board.open_cells:
            self.color[v] = board.color(v)
        self.open_mask = 0
        for v in board.open_cells:
            self.open_mask |= 1 << v
        self.w = board.width

    def _connected(self, head: int, unvisited: int) -> bool:
        if self.b.blocked:
            return self._connected_bfs(head, unvisited)
        allowed = unvisited | (1 << head)
        reach = 1 << head
        w = self.w
        while True:
            nxt = (reach | (reach << 1) | (reach >> 1) | (reach << w) | (reach >> w)) & allowed
            if nxt == reach:
                return reach == allowed
            reach = nxt

    def _connected_bfs(self, head: int, unvisited: int) -> bool:
        seen = {head}
        stack = [head]
        while stack:
            v = stack.pop()
            for x in self.nbrs[v]:
                if x not in seen and (unvisited >> x) & 1:
                    seen.add(x)
                    stack.append(x)
        return len(seen) == unvisited.bit_count() + 1

    def _cut_ok(self, head: int, end: int | None, visited: bytearray, remaining: int) -> bool:
        """未訪問マス+先頭の関節点検査。先頭側以外へ切り離される成分は高々1つで、終点とパリティが整合する。"""
        nbrs = self.nbrs
        color = self.color
        n = self.b.size
        disc = [-1] * n
        low = [0] * n
        size = [0] * n
        cnt0 = [0] * n
        has_end = [False] * n
        separated = [0] * n
        disc[head] = 0
        size[head] = 1
        cnt0[head] = 1 - color[head]
        total = remaining + 1
        timer = 1
        root_children = 0
        stack = [(head, -1, iter(nbrs[head]))]
        while stack:
            v, parent, it = stack[-1]
            pushed = False
            for x in it:
                if (visited[x] and x != head) or x == parent:
                    continue
                if disc[x] >= 0:
                    low[v] = min(low[v], disc[x])
                    continue
                disc[x] = low[x] = timer
                timer += 1
                size[x] = 1
                cnt0[x] = 1 - color[x]
                has_end[x] = x == end
                stack.append((x, v, iter(nbrs[x])))
                pushed = True
                break
            if pushed:
                continue
            stack.pop()
            if parent == -1:
                continue
            low[parent] = min(low[parent], low[v])
            size[parent] += size[v]
            cnt0[parent] += cnt0[v]
            if has_end[v]:
                has_end[parent] = True
            if parent == head:
                root_children += 1
                if root_children >= 2:
                    return False
                continue
            if low[v] >= disc[parent]:
                separated[parent] += 1
                if separated[parent] >= 2:
                    return False
                if end is not None and not has_end[v]:
                    return False
                comp = size[v]
                cv = color[parent]
                n_first = cnt0[v] if cv == 1 else comp - cnt0[v]
                if n_first != (comp + 1) // 2:
                    return False
                prefix_len = total - comp
                at_parent = color[head] if prefix_len % 2 == 1 else 1 - color[head]
                if at_parent != cv:
                    return False
        return True

    def count(
        self,
        prefix: Sequence[int],
        end: int | None = None,
        limit: int = 2,
        node_limit: int = 200_000,
        use_conn: bool = True,
        use_parity: bool = True,
        keep: int = 2,
        use_cut: bool = True,
        order_rng: random.Random | None = None,
    ) -> CountResult:
        nbrs = self.nbrs
        color = self.color
        visited = bytearray(self.b.size)
        for v in prefix:
            visited[v] = 1
        unvisited = self.open_mask
        for v in prefix:
            unvisited &= ~(1 << v)
        deg = [0] * self.b.size
        cnt = [0, 0]
        rest = [v for v in self.b.open_cells if not visited[v]]
        for v in rest:
            deg[v] = sum(1 for x in nbrs[v] if not visited[x])
            cnt[color[v]] += 1
        head = prefix[-1]
        head_adj = set(nbrs[head])
        dead = 0
        for v in rest:
            a = deg[v] + (1 if v in head_adj else 0)
            if a == 0:
                return CountResult(0, 0, False, [])
            if a == 1 and v != end:
                dead += 1
        r0 = len(rest)
        if r0 == 0:
            ok = end is None or head == end
            return CountResult(1 if ok else 0, 0, False, [list(prefix)] if ok else [])
        state = {"nodes": 0, "count": 0, "maxd": 0}
        sols: list[list[int]] = []
        path = list(prefix)

        def dfs(head: int, r: int, dead: int, unvisited: int) -> None:
            state["nodes"] += 1
            if state["nodes"] > node_limit:
                raise Timeout
            d = len(path)
            state["maxd"] = max(state["maxd"], d)
            cand = [x for x in nbrs[head] if not visited[x]]
            if order_rng is None:
                cand.sort(key=lambda x: deg[x])
            else:
                order_rng.shuffle(cand)
            for x in cand:
                rr = r - 1
                if end is not None and x == end and rr > 0:
                    continue
                if deg[x] == 0 and rr > 0:
                    continue
                ndead = dead
                if deg[x] == 0 and x != end:
                    ndead -= 1  # x was a dead end (only head)
                # parity
                if use_parity and rr > 0:
                    c2 = cnt[0] - (color[x] == 0), cnt[1] - (color[x] == 1)
                    nc = 1 - color[x]
                    if c2[nc] != (rr + 1) // 2 or c2[1 - nc] != rr // 2:
                        continue
                    if end is not None:
                        ec = nc if rr % 2 == 1 else 1 - nc
                        if color[end] != ec:
                            continue
                # apply
                visited[x] = 1
                cnt[color[x]] -= 1
                nun = unvisited & ~(1 << x)
                for z in nbrs[x]:
                    if not visited[z]:
                        deg[z] -= 1
                bad = False
                for y in nbrs[head]:
                    if visited[y] or y == x:
                        continue
                    if deg[y] == 0:
                        bad = True
                    elif deg[y] == 1 and y != end:
                        ndead += 1
                if not bad and rr > 0:
                    limit_dead = 0 if end is not None else 1
                    if ndead > limit_dead:
                        bad = True
                if not bad and rr > 0 and use_conn and not self._connected(x, nun):
                    bad = True
                if not bad and rr > 2 and use_cut and not self._cut_ok(x, end, visited, rr):
                    bad = True
                if not bad:
                    path.append(x)
                    if rr == 0:
                        state["count"] += 1
                        if len(sols) < keep:
                            sols.append(list(path))
                    else:
                        dfs(x, rr, ndead, nun)
                    path.pop()
                for z in nbrs[x]:
                    if not visited[z]:
                        deg[z] += 1
                cnt[color[x]] += 1
                visited[x] = 0
                if state["count"] >= limit:
                    return

        timeout = False
        try:
            dfs(head, r0, dead, unvisited)
        except Timeout:
            timeout = True
        return CountResult(min(state["count"], limit), state["nodes"], timeout, sols, state["maxd"])


def count_variant(board: Board, variant: str, start: int, end: int, limit: int, node_limit: int) -> CountResult:
    """variant: 'a' 始点のみ, 'b' 始点と終点, 'c' 指定なし（無向の道の数を返す）。"""
    pc = PathCounter(board)
    if variant == "a":
        return pc.count([start], None, limit, node_limit)
    if variant == "b":
        return pc.count([start], end, limit, node_limit)
    # c: 全始点から有向に数え、無向化する（各道は両端から2回数えられる）
    total = 0
    nodes = 0
    sols: list[list[int]] = []
    n = len(board.open_cells)
    blacks = sum(1 for v in board.open_cells if board.color(v) == 0)
    whites = n - blacks
    for s in sorted(board.open_cells):
        if blacks != whites and board.color(s) != (0 if blacks > whites else 1):
            continue
        res = pc.count([s], None, 2 * limit + 1 - total, max(1, node_limit - nodes))
        nodes += res.nodes
        total += res.count
        sols.extend(res.solutions)
        if res.timeout or nodes >= node_limit:
            return CountResult(min(total // 2, limit), nodes, True, sols)
        if total >= 2 * limit:
            break
    return CountResult(min((total + 1) // 2, limit), nodes, False, sols)


class Contradiction(Exception):  # noqa: N818
    pass


class BudgetExceeded(Exception):  # noqa: N818
    pass


class SolveTimeout(Exception):  # noqa: N818
    pass


LEVEL_NAMES = {
    1: "局所次数",
    2: "閉路・端点連結禁止",
    3: "分断・到達",
    4: "パリティ",
    5: "1段仮置き",
    6: "2段仮置き",
}


@dataclass
class Tracker:
    budget: int | None = None
    steps: int = 0
    firings: Counter[int] = field(default_factory=Counter)
    decided: Counter[int] = field(default_factory=Counter)

    def fire(self, level: int, decided_edges: int) -> None:
        self.steps += 1
        self.firings[level] += 1
        self.decided[level] += decided_edges
        if self.budget is not None and self.steps > self.budget:
            raise BudgetExceeded


@dataclass
class SolverState:
    es: list[int]
    ycnt: list[int]
    ucnt: list[int]
    role: list[int]
    free_end: int
    yes_total: int
    parity_applied: bool

    def copy(self) -> SolverState:
        return SolverState(
            self.es[:], self.ycnt[:], self.ucnt[:], self.role[:], self.free_end, self.yes_total, self.parity_applied
        )


@dataclass
class SolveReport:
    solved: bool
    timeout: bool
    max_level: int
    firings: dict[int, int]
    decided: dict[int, int]
    trials: int
    deep_trials: int
    trial_chains: list[int]
    stalls: int
    first_stall_ratio: float
    first_trial_ratio: float
    edges: int
    seconds: float


class HumanSolver:
    """人間が使う推論を段階別に適用する辺ベースの解法器。

    variant 'a' は始点のみ（終点は未知の候補から推論）、'b' は始点・終点とも既知。
    """

    def __init__(self, board: Board, start: int, end: int | None) -> None:
        cells = sorted(board.open_cells)
        self.cid = {v: k for k, v in enumerate(cells)}
        self.cells = cells
        self.n = len(cells)
        self.color = [board.color(v) for v in cells]
        self.edges: list[tuple[int, int]] = []
        self.inc: list[list[int]] = [[] for _ in cells]
        for v in cells:
            for x in board.neighbors(v):
                if v < x:
                    a, b = self.cid[v], self.cid[x]
                    self.inc[a].append(len(self.edges))
                    self.inc[b].append(len(self.edges))
                    self.edges.append((a, b))
        self.start = self.cid[start]
        self.end = self.cid[end] if end is not None else None
        self.deadline = float("inf")

    def initial_state(self) -> SolverState:
        role = [ROLE_CAND if self.end is None else ROLE_MID] * self.n
        role[self.start] = ROLE_END
        if self.end is not None:
            role[self.end] = ROLE_END
        return SolverState(
            [UNK] * len(self.edges),
            [0] * self.n,
            [len(self.inc[v]) for v in range(self.n)],
            role,
            -1 if self.end is None else self.end,
            0,
            parity_applied=False,
        )

    def other(self, e: int, v: int) -> int:
        a, b = self.edges[e]
        return b if a == v else a

    def set_edge(self, st: SolverState, e: int, val: int) -> bool:
        cur = st.es[e]
        if cur == val:
            return False
        if cur != UNK:
            raise Contradiction
        st.es[e] = val
        for v in self.edges[e]:
            st.ucnt[v] -= 1
            if val == YES:
                st.ycnt[v] += 1
        if val == YES:
            st.yes_total += 1
        return True

    def make_end(self, st: SolverState, v: int) -> None:
        if st.free_end not in (-1, v):
            raise Contradiction
        st.free_end = v
        for u in range(self.n):
            if st.role[u] == ROLE_CAND:
                st.role[u] = ROLE_MID
        st.role[v] = ROLE_END

    def level1(self, st: SolverState, tr: Tracker) -> bool:
        progressed = False
        changed = True
        while changed:
            changed = False
            for v in range(self.n):
                y, u, role = st.ycnt[v], st.ucnt[v], st.role[v]
                maxdeg = 1 if role == ROLE_END else 2
                mindeg = 2 if role == ROLE_MID else 1
                if y > maxdeg or y + u < mindeg:
                    raise Contradiction
                if role == ROLE_CAND and y + u == 1:
                    self.make_end(st, v)
                    tr.fire(1, 0)
                    changed = progressed = True
                    continue
                if role == ROLE_CAND and y == 2:
                    st.role[v] = ROLE_MID
                if u == 0:
                    continue
                if y == maxdeg:
                    k = sum(self.set_edge(st, e, NO) for e in self.inc[v] if st.es[e] == UNK)
                    tr.fire(1, k)
                    changed = progressed = True
                elif role != ROLE_CAND and y + u == mindeg:
                    k = sum(self.set_edge(st, e, YES) for e in self.inc[v] if st.es[e] == UNK)
                    tr.fire(1, k)
                    changed = progressed = True
        return progressed

    def segments(self, st: SolverState) -> list[int]:
        parent = list(range(self.n))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for e, (a, b) in enumerate(self.edges):
            if st.es[e] == YES:
                ra, rb = find(a), find(b)
                if ra == rb:
                    raise Contradiction
                parent[ra] = rb
        return [find(v) for v in range(self.n)]

    def level2(self, st: SolverState, tr: Tracker) -> bool:
        seg = self.segments(st)
        size = Counter(seg)
        ends = [v for v in range(self.n) if st.role[v] == ROLE_END]
        end_segs = {seg[v] for v in ends}
        if len(ends) == 2 and len(end_segs) == 1 and size[seg[ends[0]]] < self.n:
            raise Contradiction
        progressed = False
        for e, (a, b) in enumerate(self.edges):
            if st.es[e] != UNK:
                continue
            sa, sb = seg[a], seg[b]
            closes_loop = sa == sb
            joins_ends = len(ends) == 2 and len(end_segs) == 2 and {sa, sb} == end_segs and size[sa] + size[sb] < self.n
            if closes_loop or joins_ends:
                self.set_edge(st, e, NO)
                tr.fire(2, 1)
                progressed = True
        return progressed

    def level34(self, st: SolverState, tr: Tracker, parity: bool) -> bool:
        if parity and not st.parity_applied:
            st.parity_applied = True
            if self.global_parity(st):
                tr.fire(4, 0)
                return True
        n = self.n
        adj: list[list[tuple[int, int]]] = [[] for _ in range(n)]
        for e, (a, b) in enumerate(self.edges):
            if st.es[e] != NO:
                adj[a].append((b, e))
                adj[b].append((a, e))
        disc = [-1] * n
        low = [0] * n
        # 部分木ごとに マス数・色0の数・色1の数・端点数・終点候補数 を集計する
        summ = [[0, 0, 0, 0, 0] for _ in range(n)]
        cuts: dict[int, list[list[int]]] = {}
        bridges: list[int] = []
        timer = [0]

        def own(v: int) -> list[int]:
            return [
                1,
                1 - self.color[v],
                self.color[v],
                1 if st.role[v] == ROLE_END else 0,
                1 if st.role[v] == ROLE_CAND else 0,
            ]

        def dfs(v: int, pe: int) -> None:
            disc[v] = low[v] = timer[0]
            timer[0] += 1
            summ[v] = own(v)
            for x, e in adj[v]:
                if e == pe:
                    continue
                if disc[x] == -1:
                    dfs(x, e)
                    low[v] = min(low[v], low[x])
                    for k in range(5):
                        summ[v][k] += summ[x][k]
                    if low[x] > disc[v]:
                        bridges.append(e)
                    if low[x] >= disc[v]:
                        cuts.setdefault(v, []).append(summ[x][:])
                else:
                    low[v] = min(low[v], disc[x])

        dfs(self.start, -1)
        if timer[0] != n:
            raise Contradiction
        total = summ[self.start]
        comps_by_cut: dict[int, list[list[int]]] = {}
        for v, children in cuts.items():
            comps = list(children)
            if v != self.start:
                mine = own(v)
                rest = [total[k] - mine[k] - sum(c[k] for c in children) for k in range(5)]
                if rest[0] > 0:
                    comps.append(rest)
            if len(comps) >= 2:
                comps_by_cut[v] = comps
        progressed = False
        for e in bridges:
            if st.es[e] == UNK:
                self.set_edge(st, e, YES)
                tr.fire(3, 1)
                progressed = True
        for v, comps in comps_by_cut.items():
            if len(comps) >= 3 or st.role[v] == ROLE_END:
                raise Contradiction
            for comp in comps:
                if comp[3] == 0 and comp[4] == 0:
                    raise Contradiction
            if st.role[v] == ROLE_CAND:
                st.role[v] = ROLE_MID
                tr.fire(3, 0)
                progressed = True
            if parity:
                cv = self.color[v]
                for comp in comps:
                    sz, c0, c1 = comp[0], comp[1], comp[2]
                    cnt = (c0, c1)
                    if comp[3] >= 1:
                        # 端点を含む側: 端点から v の隣までを交互に塗る
                        ec = self.end_color_in(st, comp, v)
                        last = ec if sz % 2 == 1 else 1 - ec
                        if cnt[ec] != (sz + 1) // 2 or cnt[1 - ec] != sz // 2 or last != 1 - cv:
                            raise Contradiction
                    else:
                        nc = 1 - cv
                        if cnt[nc] != (sz + 1) // 2 or cnt[1 - nc] != sz // 2:
                            raise Contradiction
        return progressed

    def end_color_in(self, st: SolverState, comp: list[int], cut: int) -> int:
        """comp に含まれる既知端点の色。S は常に既知なので、S を含むかを部分和で判定できないときは探索する。"""
        ends = [v for v in range(self.n) if st.role[v] == ROLE_END]
        if len(ends) == 1:
            return self.color[ends[0]]
        # 2端点のうち comp 側の端点を、cut を除く到達で判定する
        seen = {cut}
        stack = [ends[0]]
        seen.add(ends[0])
        size = 0
        while stack:
            v = stack.pop()
            size += 1
            for e in self.inc[v]:
                if st.es[e] == NO:
                    continue
                x = self.other(e, v)
                if x not in seen:
                    seen.add(x)
                    stack.append(x)
        return self.color[ends[0]] if size == comp[0] else self.color[ends[1]]

    def global_parity(self, st: SolverState) -> bool:
        """全体の色数から自由終点の色を決め、色の合わない終点候補を外す。"""
        if st.free_end != -1:
            return False
        sc = self.color[self.start]
        end_color = sc if self.n % 2 == 1 else 1 - sc
        changed = False
        for v in range(self.n):
            if st.role[v] == ROLE_CAND and self.color[v] != end_color:
                st.role[v] = ROLE_MID
                changed = True
        return changed

    def propagate(self, st: SolverState, tr: Tracker, max_level: int = 4) -> None:
        while st.yes_total < self.n - 1:
            if time.perf_counter() > self.deadline:
                raise SolveTimeout
            if self.level1(st, tr):
                continue
            if max_level >= 2 and self.level2(st, tr):
                continue
            if max_level >= 3 and self.level34(st, tr, parity=max_level >= 4):
                continue
            return
        for e in range(len(self.edges)):
            if st.es[e] == UNK:
                self.set_edge(st, e, NO)
        self.segments(st)
        for v in range(self.n):
            need = 1 if st.role[v] == ROLE_END or (st.role[v] == ROLE_CAND and st.ycnt[v] == 1) else 2
            if st.ycnt[v] != need:
                raise Contradiction

    def candidate_edges(self, st: SolverState) -> list[int]:
        def key(e: int) -> tuple[int, int]:
            a, b = self.edges[e]
            return (min(st.ucnt[a], st.ucnt[b]), e)

        return sorted((e for e in range(len(self.edges)) if st.es[e] == UNK), key=key)

    def try_assume(self, st: SolverState, e: int, val: int, budget: int, inner: bool) -> int | None:
        """仮置きして矛盾すれば、矛盾までの推論手数を返す。"""
        st2 = st.copy()
        tr = Tracker(budget=budget)
        try:
            self.set_edge(st2, e, val)
            self.propagate(st2, tr)
            if inner:
                for _ in range(3):
                    if st2.yes_total >= self.n - 1:
                        break
                    if self.single_trial(st2, Tracker(), budgets=(4, 12)) is None:
                        break
                    self.propagate(st2, tr)
        except Contradiction:
            return tr.steps
        except BudgetExceeded:
            return None
        return None

    def single_trial(self, st: SolverState, tr: Tracker, budgets: Sequence[int] = (3, 8, 20, 60)) -> int | None:
        cands = self.candidate_edges(st)
        for budget in budgets:
            for e in cands:
                for val in (YES, NO):
                    chain = self.try_assume(st, e, val, budget, inner=False)
                    if chain is not None:
                        self.set_edge(st, e, -val)
                        tr.fire(5, 1)
                        return chain
        return None

    def deep_trial(self, st: SolverState, tr: Tracker, max_edges: int) -> int | None:
        cands = self.candidate_edges(st)[:max_edges]
        for e in cands:
            for val in (YES, NO):
                chain = self.try_assume(st, e, val, budget=200, inner=True)
                if chain is not None:
                    self.set_edge(st, e, -val)
                    tr.fire(6, 1)
                    return chain
        return None

    def solve(self, time_limit: float = 20.0, allow_deep: bool = True, deep_edges: int = 24) -> SolveReport:
        t0 = time.perf_counter()
        self.deadline = t0 + time_limit
        st = self.initial_state()
        tr = Tracker()
        trials = deep = stalls = 0
        chains: list[int] = []
        first_stall = first_trial = -1.0
        n_edges = len(self.edges)
        timeout = False

        def decided_ratio() -> float:
            return sum(1 for s in st.es if s != UNK) / n_edges

        try:
            while True:
                # 段階1〜2で止まった時点を「停滞」として記録する
                self.propagate(st, tr, max_level=2)
                if st.yes_total >= self.n - 1:
                    break
                stalls += 1
                if first_stall < 0:
                    first_stall = decided_ratio()
                before = st.yes_total, st.es.count(UNK)
                self.propagate(st, tr, max_level=4)
                if st.yes_total >= self.n - 1:
                    break
                if (st.yes_total, st.es.count(UNK)) != before:
                    continue
                if first_trial < 0:
                    first_trial = decided_ratio()
                chain = self.single_trial(st, tr)
                if chain is not None:
                    trials += 1
                    chains.append(chain)
                    continue
                if not allow_deep:
                    break
                chain = self.deep_trial(st, tr, deep_edges)
                if chain is None:
                    break
                deep += 1
                chains.append(chain)
        except SolveTimeout:
            timeout = True
        solved = st.yes_total >= self.n - 1 and not timeout
        levels = [lv for lv, k in tr.firings.items() if k > 0]
        return SolveReport(
            solved=solved,
            timeout=timeout,
            max_level=max(levels, default=0),
            firings=dict(tr.firings),
            decided=dict(tr.decided),
            trials=trials,
            deep_trials=deep,
            trial_chains=chains,
            stalls=stalls,
            first_stall_ratio=1.0 if first_stall < 0 else first_stall,
            first_trial_ratio=1.0 if first_trial < 0 else first_trial,
            edges=n_edges,
            seconds=time.perf_counter() - t0,
        )


def solution_cost(board: Board, path: Sequence[int], variant: str, cap: int, node_limit: int) -> tuple[int, float]:
    t0 = time.perf_counter()
    res = PathCounter(board).count([path[0]], path[-1] if variant == "b" else None, cap, node_limit)
    cost = cap + 1 if res.timeout else res.count
    return cost, time.perf_counter() - t0


def make_saw(rows: int, cols: int, wall_ratio: float, rng: random.Random) -> list[int]:
    n_open = round(rows * cols * (1 - wall_ratio))
    if n_open >= rows * cols:
        return random_full_path(rows, cols, rng)
    return random_saw(rows, cols, n_open, rng)


def gen_reject(
    rows: int, cols: int, wall_ratio: float, variant: str, rng: random.Random, node_limit: int
) -> tuple[list[int] | None, float, float, bool]:
    """1回の候補生成と一意性確認。戻り値: (一意なら経路, 生成秒, 確認秒, 確認打ち切り)。"""
    t0 = time.perf_counter()
    path = make_saw(rows, cols, wall_ratio, rng)
    gen = time.perf_counter() - t0
    cost, check = solution_cost(board_from_path(rows, cols, path), path, variant, 2, node_limit)
    return (path if cost == 1 else None), gen, check, cost == 3


def gen_thin(
    rows: int, cols: int, wall_ratio: float, variant: str, rng: random.Random, node_limit: int
) -> tuple[list[int] | None, frozenset[tuple[int, int]], float, int]:
    """マス壁はそのままに、別解が使う辺へ仕切りを足して一意化し、不要な仕切りを外す。

    戻り値: (経路, 仕切り集合, 秒, 解数評価回数)。
    """
    t0 = time.perf_counter()
    path = make_saw(rows, cols, wall_ratio, rng)
    used = {(min(a, b), max(a, b)) for a, b in pairwise(path)}
    end = path[-1] if variant == "b" else None
    blocked: set[tuple[int, int]] = set()
    evals = 0

    def solutions(blk: set[tuple[int, int]]) -> CountResult:
        nonlocal evals
        evals += 1
        board = board_from_path(rows, cols, path, frozenset(blk))
        return PathCounter(board).count([path[0]], end, 2, node_limit)

    while True:
        res = solutions(blocked)
        if res.timeout:
            return None, frozenset(), time.perf_counter() - t0, evals
        if res.count == 1:
            break
        other = next(s for s in res.solutions if s != path)
        extra = [(min(a, b), max(a, b)) for a, b in pairwise(other) if (min(a, b), max(a, b)) not in used]
        blocked.add(rng.choice(extra))
    for wall in sorted(blocked, key=lambda _: rng.random()):
        trial = blocked - {wall}
        res = solutions(trial)
        if not res.timeout and res.count == 1:
            blocked = trial
    return path, frozenset(blocked), time.perf_counter() - t0, evals


def gen_climb(
    rows: int,
    cols: int,
    wall_ratio: float,
    variant: str,
    rng: random.Random,
    node_limit: int,
    iters: int,
    cap: int = 6,
) -> tuple[list[int] | None, float, int, int]:
    """経路の局所変形（壁配置も動く）で解の数を減らす山登り。戻り値: (経路, 秒, 評価回数, 打ち切り回数)。"""
    t0 = time.perf_counter()
    nbrs = grid_nbrs_table(rows, cols)
    reptation = wall_ratio > 0
    path = make_saw(rows, cols, wall_ratio, rng)
    cost, _ = solution_cost(board_from_path(rows, cols, path), path, variant, cap, node_limit)
    evals = 1
    timeouts = int(cost > cap)
    for _ in range(iters):
        if cost == 1:
            break
        cand = path
        for _ in range(rng.randint(1, 3)):
            cand = mutate_path(cand, nbrs, rng, allow_reptation=reptation)
        c2, _ = solution_cost(board_from_path(rows, cols, cand), cand, variant, cap, node_limit)
        evals += 1
        timeouts += int(c2 > cap)
        if c2 <= cost:
            path, cost = cand, c2
    if cost != 1:
        return None, time.perf_counter() - t0, evals, timeouts
    # 最終確認は打ち切りを大きくとった2解探索で行う
    final, _ = solution_cost(board_from_path(rows, cols, path), path, variant, 2, node_limit * 5)
    ok = final == 1
    return (path if ok else None), time.perf_counter() - t0, evals, timeouts


def naive_ok(pc: PathCounter, visited: set[int], head: int, end: int | None) -> bool:
    """盤面を見てすぐ分かる破綻（孤立マス・行き止まり過多・分断）がないか。"""
    rest = [v for v in pc.b.open_cells if v not in visited]
    if not rest:
        return end is None or head == end
    if end is not None and end == head:
        return False
    head_adj = set(pc.nbrs[head])
    dead = 0
    for v in rest:
        avail = sum(1 for x in pc.nbrs[v] if x not in visited) + (1 if v in head_adj else 0)
        if avail == 0:
            return False
        if avail == 1 and v != end:
            dead += 1
    if dead > (0 if end is not None else 1):
        return False
    mask = 0
    for v in rest:
        mask |= 1 << v
    return pc._connected(head, mask)  # noqa: SLF001


def open_block_ratio(board: Board) -> float:
    """有効マスだけでできた2×2ブロックの割合（局所的な付け替え余地の目安）。"""
    total = (board.rows - 1) * (board.cols - 1)
    k = 0
    for r in range(board.rows - 1):
        for c in range(board.cols - 1):
            cells = (board.idx(r, c), board.idx(r + 1, c), board.idx(r, c + 1), board.idx(r + 1, c + 1))
            if all(v in board.open_cells for v in cells):
                k += 1
    return k / total if total else 0.0


def straight_ratio(path: Sequence[int], run: int = 4) -> float:
    """長さ run 以上の直進区間に含まれるマスの割合（蛇行・単調さの目安）。"""
    if len(path) < 3:
        return 0.0
    dirs = [path[i + 1] - path[i] for i in range(len(path) - 1)]
    covered = [False] * len(path)
    i = 0
    while i < len(dirs):
        j = i
        while j + 1 < len(dirs) and dirs[j + 1] == dirs[i]:
            j += 1
        cells = j - i + 2
        if cells >= run:
            for k in range(i, j + 2):
                covered[k] = True
        i = j + 1
    return sum(covered) / len(path)


def refutation_level(solver: HumanSolver, prefix: Sequence[int], move: int) -> int:
    """道を prefix から move へ伸ばした局面が破綻すると示せる最小の推論段階（2〜5、示せなければ6）。"""
    edge_of = {}
    for e, (a, b) in enumerate(solver.edges):
        edge_of[a, b] = e
        edge_of[b, a] = e
    cells = [solver.cid[v] for v in [*prefix, move]]
    base = solver.initial_state()
    try:
        for a, b in pairwise(cells):
            solver.set_edge(base, edge_of[a, b], YES)
    except Contradiction:
        return 1
    for level in (2, 3, 4):
        st = base.copy()
        try:
            solver.propagate(st, Tracker(), max_level=level)
        except Contradiction:
            return level
    st = base.copy()
    try:
        solver.propagate(st, Tracker(), max_level=4)
        for _ in range(8):
            if st.yes_total >= solver.n - 1 or solver.single_trial(st, Tracker(), budgets=(8, 30)) is None:
                break
            solver.propagate(st, Tracker(), max_level=4)
    except Contradiction:
        return 5
    return 6


@dataclass
class DecisionProfile:
    decisions: int
    fatal_decisions: int
    by_level: dict[int, int]
    max_level: int
    max_trap_depth: int


def decision_profile(board: Board, path: Sequence[int], variant: str, unique: bool) -> DecisionProfile:
    """始点から解の道をたどり、各分岐で誤り手を退けるのに要る推論段階を測る。

    分岐 = すぐ見える破綻のない手が2つ以上ある地点。誤り手 = 完成できない手。
    その分岐の難しさ = 誤り手のうち最も見抜きにくいものの段階。
    """
    pc = PathCounter(board)
    end = path[-1] if variant == "b" else None
    solver = HumanSolver(board, path[0], end)
    solver.deadline = float("inf")
    visited: set[int] = set()
    decisions = fatal_decisions = 0
    by_level: Counter[int] = Counter()
    max_depth = 0
    for i in range(len(path) - 1):
        head = path[i]
        visited.add(head)
        options = []
        for x in pc.nbrs[head]:
            if x in visited:
                continue
            visited.add(x)
            if naive_ok(pc, visited, x, end):
                options.append(x)
            visited.discard(x)
        if len(options) < 2:
            continue
        decisions += 1
        prefix = list(path[: i + 1])
        hardest = 0
        for x in options:
            if x == path[i + 1]:
                continue
            if not unique:
                res = pc.count([*prefix, x], end, 1, 20_000)
                if res.timeout or res.count > 0:
                    continue
            hardest = max(hardest, refutation_level(solver, prefix, x))
            naive = pc.count([*prefix, x], end, 1, 3000, use_parity=False, use_cut=False)
            max_depth = max(max_depth, naive.max_depth - len(prefix) if not naive.timeout else 99)
        if hardest:
            fatal_decisions += 1
            by_level[hardest] += 1
    return DecisionProfile(decisions, fatal_decisions, dict(by_level), max(by_level, default=0), max_depth)


def sample_solutions(board: Board, start: int, end: int | None, k: int, rng: random.Random) -> list[list[int]]:
    """乱択順の探索で解を k 本まで拾う（重複は除く）。"""
    pc = PathCounter(board)
    found: list[list[int]] = []
    for _ in range(k * 2):
        res = pc.count([start], end, 1, 50_000, order_rng=rng)
        if res.solutions and res.solutions[0] not in found:
            found.append(res.solutions[0])
        if len(found) >= k:
            break
    return found


def band_of(profile: DecisionProfile) -> str:
    """分岐の推論段階から難易度帯（仮説）を返す。'0' は提供範囲外（誤り手のない自明問題）。"""
    lv = profile.by_level
    local = lv.get(1, 0) + lv.get(2, 0)
    region = lv.get(3, 0) + lv.get(4, 0)
    trial = lv.get(5, 0)
    deep = lv.get(6, 0)
    if local + region + trial + deep == 0:
        return "0"
    if deep >= 1 or trial >= 2:
        return "5"
    if trial == 1 or region >= 3:
        return "4"
    if region >= 1:
        return "3"
    if local >= 4:
        return "2"
    return "1"


def seeded_rng(seed: int, *parts: object) -> random.Random:
    return random.Random(":".join(str(x) for x in (seed, *parts)))


def task_variants(task: dict) -> dict:
    rng = seeded_rng(task["seed"], "variants", task["n"], task["rho"], task["i"])
    n, rho = task["n"], task["rho"]
    path = make_saw(n, n, rho, rng)
    board = board_from_path(n, n, path)
    out: dict = {"n": n, "rho": rho, "blocks": open_block_ratio(board)}
    for variant in ("a", "b", "c"):
        if variant == "c" and n > task["c_max"]:
            continue
        cap = 2 if variant == "c" else task["cap"]
        t0 = time.perf_counter()
        res = count_variant(board, variant, path[0], path[-1], cap, task["node_limit"])
        out[variant] = {"count": res.count, "timeout": res.timeout, "sec": time.perf_counter() - t0}
    return out


def generate_anypath(task: dict, rng: random.Random) -> tuple[list[int], int, float]:
    """一意性を問わない問題の生成。戻り値: (解の1本, 始点, 生成秒)。"""
    n, rho = task["n"], task["rho"]
    t0 = time.perf_counter()
    while True:
        if task["gen"] == "walk":
            path = random_walk_path(n, n, rng, alpha=task.get("alpha", 2.0))
            if len(path) < 0.5 * n * n:
                continue
        else:
            path = make_saw(n, n, rho, rng)
        board = board_from_path(n, n, path)
        if task["start"] == "pathend":
            return path, path[0], time.perf_counter() - t0
        # 解が存在する有効マスを無作為に選び、始点にする
        cells = sorted(board.open_cells)
        rng.shuffle(cells)
        pc = PathCounter(board)
        for s in cells[:8]:
            res = pc.count([s], None, 1, 50_000, order_rng=rng)
            if res.count and res.solutions:
                return res.solutions[0], s, time.perf_counter() - t0


def task_anypath(task: dict) -> dict:
    rng = seeded_rng(task["seed"], "any", task["n"], task["rho"], task["gen"], task["start"], task["i"])
    path, start, gen_sec = generate_anypath(task, rng)
    n = task["n"]
    board = board_from_path(n, n, path)
    t0 = time.perf_counter()
    uniq = PathCounter(board).count([start], None, 2, 50_000)
    sols = [path, *[s for s in sample_solutions(board, start, None, 5, rng) if s != path]][:5]
    profiles = [decision_profile(board, s, "a", unique=uniq.count == 1 and not uniq.timeout) for s in sols]
    bands = [band_of(p) for p in profiles]
    return {
        "n": n,
        "rho": task["rho"],
        "gen": task["gen"],
        "start_mode": task["start"],
        "walls": n * n - len(path),
        "path": path,
        "gen_sec": gen_sec,
        "analysis_sec": time.perf_counter() - t0,
        "unique": uniq.count == 1 and not uniq.timeout,
        "bands": bands,
        "band": sorted(bands)[len(bands) // 2],
        "profile": profiles[0].__dict__,
        "blocks": open_block_ratio(board),
        "straight": straight_ratio(path),
    }


def task_unique(task: dict) -> dict:
    method = task["method"]
    rng = seeded_rng(task["seed"], "unique", method, task["n"], task["rho"], task["variant"], task["i"])
    n, rho, variant = task["n"], task["rho"], task["variant"]
    blocked: frozenset[tuple[int, int]] = frozenset()
    if method == "thin":
        path, blocked, sec, evals = gen_thin(n, n, rho, variant, rng, task["node_limit"])
        timeouts = int(path is None)
    else:
        path, sec, evals, timeouts = gen_climb(n, n, rho, variant, rng, task["node_limit"], task["iters"])
    out: dict = {
        "n": n,
        "rho": rho,
        "method": method,
        "variant": variant,
        "ok": path is not None,
        "sec": sec,
        "evals": evals,
        "eval_timeouts": timeouts,
    }
    if path is None:
        return out
    board = board_from_path(n, n, path, blocked)
    _, check_sec = solution_cost(board, path, variant, 2, task["node_limit"] * 5)
    end = path[-1] if variant == "b" else None
    report = HumanSolver(board, path[0], end).solve(time_limit=30.0)
    profile = decision_profile(board, path, variant, unique=True)
    out.update(
        path=path,
        blocked=sorted(blocked),
        check_sec=check_sec,
        solver=report.__dict__,
        profile=profile.__dict__,
        band=band_of(profile),
        blocks=open_block_ratio(board),
        straight=straight_ratio(path),
    )
    return out


def run_tasks(func: Callable[[dict], dict], tasks: list[dict], workers: int) -> list[dict]:
    if workers <= 1:
        return [func(t) for t in tasks]
    with multiprocessing.Pool(workers) as pool:
        return list(pool.imap(func, tasks, chunksize=1))


def pct(values: Iterable[float], q: float) -> float:
    xs = sorted(values)
    if not xs:
        return float("nan")
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def fmt_ms(sec: float) -> str:
    return f"{sec * 1000:.1f}"


def parse_sizes(text: str) -> list[int]:
    return [int(x) for x in text.split(",")]


def run_variants(args: argparse.Namespace) -> None:
    tasks = [
        {
            "seed": args.seed,
            "n": n,
            "rho": rho,
            "i": i,
            "cap": 64,
            "c_max": 6,
            "node_limit": args.node_limit,
        }
        for n in parse_sizes(args.sizes)
        for rho in (0.0, 0.15, 0.3)
        for i in range(args.samples)
    ]
    results = run_tasks(task_variants, tasks, args.workers)
    print(
        "| 盤面 | 壁率 | 問題数 | 一意率 a(始点) | 一意率 b(始点終点) | 一意率 c(指定なし) "
        "| 解数中央値 a | 解数中央値 b | 64解以上 a | 打切 a/b | 確認p95 ms a/b |"
    )
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    groups: dict[tuple[int, float], list[dict]] = {}
    for r in results:
        groups.setdefault((r["n"], r["rho"]), []).append(r)
    for (n, rho), rs in sorted(groups.items()):

        def rate(v: str, rs: list[dict] = rs) -> str:
            xs = [r[v] for r in rs if v in r]
            if not xs:
                return "-"
            return f"{100 * sum(1 for x in xs if x['count'] == 1 and not x['timeout']) / len(xs):.1f}%"

        med_a = statistics.median(r["a"]["count"] for r in rs)
        med_b = statistics.median(r["b"]["count"] for r in rs)
        cap_a = sum(1 for r in rs if r["a"]["count"] >= 64) / len(rs)
        to = f"{sum(r['a']['timeout'] for r in rs)}/{sum(r['b']['timeout'] for r in rs)}"
        p95 = f"{fmt_ms(pct((r['a']['sec'] for r in rs), 0.95))}/{fmt_ms(pct((r['b']['sec'] for r in rs), 0.95))}"
        print(
            f"| {n}×{n} | {rho:.2f} | {len(rs)} | {rate('a')} | {rate('b')} | {rate('c')} | {med_a:g} | {med_b:g} "
            f"| {100 * cap_a:.0f}% | {to} | {p95} |"
        )


def summarize_unique(results: list[dict]) -> None:
    print(
        "| 盤面 | 方式 | 壁率 | 変種 | 試行 | 成功率 | 成功1問あたり総秒 / 成功試行p90秒 | 解数評価回数中央値 "
        "| 評価打切率 | 一意性確認 p50/p95 ms | 仕切り数中央値 | 全体解法 帯(1〜5,x) | 描画分岐 帯(0〜5) |"
    )
    print("|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---|")
    groups: dict[tuple[int, str, float, str], list[dict]] = {}
    for r in results:
        groups.setdefault((r["n"], r["method"], r["rho"], r["variant"]), []).append(r)
    for (n, method, rho, variant), rs in sorted(groups.items()):
        ok = [r for r in rs if r["ok"]]
        total_sec = sum(r["sec"] for r in rs)
        per = total_sec / len(ok) if ok else float("inf")
        evals = statistics.median(r["evals"] for r in rs)
        to_rate = sum(r["eval_timeouts"] for r in rs) / max(1, sum(r["evals"] for r in rs))
        checks = [r["check_sec"] for r in ok]
        gbands = Counter(global_band(r["solver"]) for r in ok)
        bands = Counter(r["band"] for r in ok)
        gb = " ".join(f"{k}:{gbands.get(k, 0)}" for k in "12345x")
        bd = " ".join(f"{k}:{bands.get(k, 0)}" for k in "012345")
        p90 = pct((r["sec"] for r in ok), 0.9) if ok else float("nan")
        thin = statistics.median(len(r["blocked"]) for r in ok) if ok else float("nan")
        print(
            f"| {n}×{n} | {method} | {rho:.2f} | {variant} | {len(rs)} | {100 * len(ok) / len(rs):.1f}% "
            f"| {per:.2f} / {p90:.2f} | {evals:g} | {100 * to_rate:.1f}% "
            f"| {fmt_ms(pct(checks, 0.5))}/{fmt_ms(pct(checks, 0.95))} | {thin:g} | {gb} | {bd} |"
        )


def summarize_anypath(results: list[dict]) -> None:
    print(
        "| 盤面 | 生成 | 壁率指定 | 始点 | 問題数 | 壁数中央値 | 一意 | 生成 p50 ms | 分析 p50/p95 s "
        "| 分岐中央値 | 致命分岐中央値 | 帯分布(0〜5) | 解の取り方で帯が揺れた率 |"
    )
    print("|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|")
    groups: dict[tuple[int, str, float, str], list[dict]] = {}
    for r in results:
        groups.setdefault((r["n"], r["gen"], r["rho"], r["start_mode"]), []).append(r)
    for (n, gen, rho, start_mode), rs in sorted(groups.items()):
        bands = Counter(r["band"] for r in rs)
        bd = " ".join(f"{k}:{bands.get(k, 0)}" for k in "012345")
        unstable = sum(1 for r in rs if len(set(r["bands"])) > 1) / len(rs)
        print(
            f"| {n}×{n} | {gen} | {rho:.2f} | {start_mode} | {len(rs)} "
            f"| {statistics.median(r['walls'] for r in rs):g} | {100 * sum(r['unique'] for r in rs) / len(rs):.0f}% "
            f"| {fmt_ms(pct((r['gen_sec'] for r in rs), 0.5))} "
            f"| {pct((r['analysis_sec'] for r in rs), 0.5):.2f}/{pct((r['analysis_sec'] for r in rs), 0.95):.2f} "
            f"| {statistics.median(r['profile']['decisions'] for r in rs):g} "
            f"| {statistics.median(r['profile']['fatal_decisions'] for r in rs):g} | {bd} | {100 * unstable:.0f}% |"
        )


def dump_jsonl(path: str | None, results: list[dict]) -> None:
    if not path:
        return
    import json  # noqa: PLC0415

    with open(path, "w", encoding="utf-8") as f:  # noqa: PTH123
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in results)


UNIQUE_CONDITIONS = (
    ("climb", 0.15, "a"),
    ("climb", 0.15, "b"),
    ("climb", 0.25, "a"),
    ("climb", 0.25, "b"),
    ("thin", 0.0, "a"),
    ("thin", 0.15, "a"),
)


def global_band(solver: dict) -> str:
    """全体を論理で解くときの仮置き回数による帯（仮説）。'x' は評価不能（未解決・時間切れ）。"""
    if not solver["solved"]:
        return "x"
    trials = solver["trials"]
    if solver["deep_trials"] or trials >= 7:
        return "5"
    if trials >= 4:
        return "4"
    if trials >= 2:
        return "3"
    if trials == 1 or solver["stalls"]:
        return "2"
    return "1"


def run_unique(args: argparse.Namespace) -> None:
    tasks = [
        {
            "seed": args.seed,
            "n": n,
            "rho": rho,
            "variant": variant,
            "method": method,
            "i": i,
            "node_limit": args.node_limit,
            "iters": args.iters,
        }
        for n in parse_sizes(args.sizes)
        for method, rho, variant in UNIQUE_CONDITIONS
        for i in range(args.samples)
    ]
    results = run_tasks(task_unique, tasks, args.workers)
    dump_jsonl(args.jsonl, results)
    summarize_unique(results)


def anypath_tasks(args: argparse.Namespace) -> list[dict]:
    conditions = [("saw", rho, "pathend") for rho in (0.0, 0.15, 0.3)]
    conditions += [("saw", 0.15, "random"), ("walk", -1.0, "pathend")]
    return [
        {"seed": args.seed, "n": n, "rho": rho, "gen": gen, "start": start, "i": i}
        for n in parse_sizes(args.sizes)
        for gen, rho, start in conditions
        for i in range(args.samples)
    ]


def run_anypath(args: argparse.Namespace) -> None:
    results = run_tasks(task_anypath, anypath_tasks(args), args.workers)
    dump_jsonl(args.jsonl, results)
    summarize_anypath(results)
    print()
    print("帯ごとの供給（全条件を候補源としたときの、1問あたり生成+分析秒）")
    print("| 盤面 | 帯0 | 帯1 | 帯2 | 帯3 | 帯4 | 帯5 |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    by_n: dict[int, list[dict]] = {}
    for r in results:
        by_n.setdefault(r["n"], []).append(r)
    for n, rs in sorted(by_n.items()):
        total = sum(r["gen_sec"] + r["analysis_sec"] for r in rs)
        cells = []
        for b in "012345":
            k = sum(1 for r in rs if r["band"] == b)
            cells.append(f"{100 * k / len(rs):.1f}% / {total / k:.2f}s" if k else "0% / -")
        print(f"| {n}×{n} | " + " | ".join(cells) + " |")


def canonical(rows: int, walls: frozenset[tuple[int, int]], start: tuple[int, int]) -> tuple:
    forms = []
    for k in range(8):

        def tf(rc: tuple[int, int], k: int = k) -> tuple[int, int]:
            r, c = rc
            n = rows - 1
            for _ in range(k % 4):
                r, c = c, n - r
            if k >= 4:
                c = n - c
            return r, c

        forms.append((tuple(sorted(tf(w) for w in walls)), tf(start)))
    return min(forms)


def task_generate_only(task: dict) -> dict:
    rng = seeded_rng(task["seed"], "any", task["n"], task["rho"], task["gen"], task["start"], task["i"])
    path, start, _ = generate_anypath(task, rng)
    return {"path": path, "start": start, "straight": straight_ratio(path)}


def run_diversity(args: argparse.Namespace) -> None:
    print("| 盤面 | 条件 | 問題数 | 完全一致重複 | 回転・反転込み重複 | 直進率0.6以上 | 全面盤の角始点 |")
    print("|---|---|---:|---:|---:|---:|---:|")
    for n in parse_sizes(args.sizes):
        for gen, rho, start in (("saw", 0.0, "pathend"), ("saw", 0.15, "pathend"), ("saw", 0.3, "pathend")):
            tasks = [
                {"seed": args.seed, "n": n, "rho": rho, "gen": gen, "start": start, "i": i} for i in range(args.samples)
            ]
            results = run_tasks(task_generate_only, tasks, args.workers)
            raw: set[tuple] = set()
            canon: set[tuple] = set()
            raw_dup = canon_dup = corner = 0
            for r in results:
                board = board_from_path(n, n, r["path"])
                walls = frozenset(
                    (rr, cc) for rr in range(n) for cc in range(n) if board.idx(rr, cc) not in board.open_cells
                )
                st = board.rc(r["start"])
                key = (walls, st)
                raw_dup += key in raw
                raw.add(key)
                ck = canonical(n, walls, st)
                canon_dup += ck in canon
                canon.add(ck)
                corner += not walls and st[0] in (0, n - 1) and st[1] in (0, n - 1)
            straight = sum(1 for r in results if r["straight"] >= 0.6)
            m = len(results)
            print(
                f"| {n}×{n} | {gen} 壁率{rho:.2f} | {m} | {raw_dup} | {canon_dup} "
                f"| {100 * straight / m:.1f}% | {corner} |"
            )


def run_examples(args: argparse.Namespace) -> None:
    n = parse_sizes(args.sizes)[0]
    tasks = [
        {"seed": args.seed, "n": n, "rho": rho, "gen": "saw", "start": "pathend", "i": i}
        for rho in (0.0, 0.15, 0.3)
        for i in range(args.samples)
    ]
    results = run_tasks(task_anypath, tasks, args.workers)
    shown: Counter[str] = Counter()
    for r in results:
        b = r["band"]
        if shown[b] >= args.per_band or len(set(r["bands"])) > 1:
            continue
        shown[b] += 1
        board = board_from_path(n, n, r["path"])
        print(f"### 帯{b} 例{shown[b]}（{n}×{n}、壁{r['walls']}、一意={r['unique']}）")
        print(
            f"分岐{r['profile']['decisions']} 致命分岐{r['profile']['fatal_decisions']} "
            f"段階別{r['profile']['by_level']} 最大誤進入{r['profile']['max_trap_depth']}"
        )
        print("```text")
        print(render(board, r["path"][0], None))
        print()
        print(render(board, None, None, r["path"]))
        print("```")


def run_unique_examples(args: argparse.Namespace) -> None:
    n = parse_sizes(args.sizes)[0]
    tasks = [
        {
            "seed": args.seed,
            "n": n,
            "rho": rho,
            "variant": "a",
            "method": method,
            "i": i,
            "node_limit": args.node_limit,
            "iters": args.iters,
        }
        for method, rho in (("climb", 0.25), ("thin", 0.0), ("thin", 0.15))
        for i in range(args.samples)
    ]
    results = [r for r in run_tasks(task_unique, tasks, args.workers) if r["ok"]]
    shown: Counter[str] = Counter()
    for r in results:
        band = global_band(r["solver"])
        if shown[band] >= args.per_band:
            continue
        shown[band] += 1
        board = board_from_path(n, n, r["path"], frozenset(tuple(x) for x in r["blocked"]))
        sv = r["solver"]
        print(
            f"### 一意解 全体解法帯{band} 例{shown[band]}（{n}×{n}、{r['method']}、壁{n * n - len(r['path'])}、"
            f"仕切り{len(r['blocked'])}）"
        )
        print(
            f"段階別発火{dict(sorted(sv['firings'].items()))} 仮置き{sv['trials']} 2段仮置き{sv['deep_trials']} "
            f"矛盾までの手数{sv['trial_chains']} 描画分岐{r['profile']['by_level']}"
        )
        print("```text")
        print(render(board, r["path"][0], None))
        print()
        print(render(board, None, None, r["path"]))
        print("```")


def load_jsonl(path: str) -> list[dict]:
    import json  # noqa: PLC0415

    with open(path, encoding="utf-8") as f:  # noqa: PTH123
        return [json.loads(line) for line in f]


def band_supply_table(title: str, results: list[dict], band_key: Callable[[dict], str | None], bands: str) -> None:
    """全試行の総秒を、その帯に入った問題数で割った「帯1問あたり秒」と出現率。"""
    print(title)
    print("| 盤面 | 試行 | " + " | ".join(f"帯{b}" for b in bands) + " |")
    print("|---|---:|" + "---:|" * len(bands))
    by_n: dict[int, list[dict]] = {}
    for r in results:
        by_n.setdefault(r["n"], []).append(r)
    for n, rs in sorted(by_n.items()):
        total = sum(r.get("sec", 0.0) + r.get("gen_sec", 0.0) + r.get("analysis_sec", 0.0) for r in rs)
        cells = []
        for b in bands:
            k = sum(1 for r in rs if band_key(r) == b)
            cells.append(f"{100 * k / len(rs):.1f}% / {total / k:.2f}s" if k else "0% / -")
        print(f"| {n}×{n} | {len(rs)} | " + " | ".join(cells) + " |")
    print()


def puzzle_key(r: dict) -> tuple:
    n = r["n"]
    board = board_from_path(n, n, r["path"])
    walls = tuple(sorted((rr, cc) for rr in range(n) for cc in range(n) if board.idx(rr, cc) not in board.open_cells))
    blocked = tuple(sorted((board.rc(a), board.rc(b)) for a, b in r.get("blocked", [])))
    end = board.rc(r["path"][-1]) if r.get("variant") == "b" else None
    return n, walls, blocked, board.rc(r["path"][0]), end


def canonical_key(r: dict) -> tuple:
    n, walls, blocked, start, end = puzzle_key(r)
    last = n - 1

    def tf(rc: tuple[int, int], k: int) -> tuple[int, int]:
        y, x = rc
        for _ in range(k % 4):
            y, x = x, last - y
        if k >= 4:
            x = last - x
        return y, x

    forms = [
        (
            tuple(sorted(tf(w, k) for w in walls)),
            tuple(sorted(tuple(sorted((tf(a, k), tf(b, k)))) for a, b in blocked)),
            tf(start, k),
            tf(end, k) if end else None,
        )
        for k in range(8)
    ]
    return min(forms, key=repr)


def band_spread(bands: Sequence[str]) -> int:
    return max(int(b) for b in bands) - min(int(b) for b in bands)


def run_report(args: argparse.Namespace) -> None:
    if args.unique_jsonl:
        results = load_jsonl(args.unique_jsonl)
        summarize_unique(results)
        print()
        thin = [r for r in results if r["method"] == "thin"]
        band_supply_table(
            "一意解・仕切りあり（thin、壁率0と0.15を合わせた候補源）の全体解法帯ごとの出現率 / 帯1問あたり秒",
            thin,
            lambda r: global_band(r["solver"]) if r["ok"] else None,
            "12345x",
        )
        print("一意解・仕切りあり: 全体解法の特徴量（成功問題）")
        print(
            "| 盤面 | 壁率 | 問題数 | 停滞なし率 | 仮置き回数 中央値/p90/最大 | 停滞回数中央値 "
            "| 初停滞時の確定辺率中央値 | 解法器 p50/p95 秒 |"
        )
        print("|---|---:|---:|---:|---:|---:|---:|---:|")
        groups: dict[tuple[int, float], list[dict]] = {}
        for r in thin:
            if r["ok"]:
                groups.setdefault((r["n"], r["rho"]), []).append(r)
        for (n, rho), rs in sorted(groups.items()):
            trials = [r["solver"]["trials"] for r in rs]
            seconds = [r["solver"]["seconds"] for r in rs]
            no_stall = sum(1 for r in rs if not r["solver"]["stalls"]) / len(rs)
            print(
                f"| {n}×{n} | {rho:.2f} | {len(rs)} | {100 * no_stall:.0f}% "
                f"| {statistics.median(trials):g}/{pct(trials, 0.9):g}/{max(trials)} "
                f"| {statistics.median(r['solver']['stalls'] for r in rs):g} "
                f"| {statistics.median(r['solver']['first_stall_ratio'] for r in rs):.2f} "
                f"| {pct(seconds, 0.5):.2f}/{pct(seconds, 0.95):.2f} |"
            )
        print()
        print("一意解・仕切りあり: 全体解法帯ごとの仮置きの中身（成功問題、全盤面）")
        print("| 帯 | 問題数 | 盤面の内訳 | 仮置き回数 中央値 | 矛盾までの最長手数 中央値 | 段階3〜4の発火あり率 |")
        print("|---|---:|---|---:|---:|---:|")
        by_band: dict[str, list[dict]] = {}
        for r in thin:
            if r["ok"]:
                by_band.setdefault(global_band(r["solver"]), []).append(r)
        for band, rs in sorted(by_band.items()):
            sizes = Counter(r["n"] for r in rs)
            longest = [max(r["solver"]["trial_chains"], default=0) for r in rs]
            l34 = sum(1 for r in rs if r["solver"]["firings"].get("3", 0) + r["solver"]["firings"].get("4", 0))
            print(
                f"| {band} | {len(rs)} | {' '.join(f'{k}:{v}' for k, v in sorted(sizes.items()))} "
                f"| {statistics.median(r['solver']['trials'] for r in rs):g} | {statistics.median(longest):g} "
                f"| {100 * l34 / len(rs):.0f}% |"
            )
        print()
        print("一意解問題の多様性（成功問題、壁・仕切り・始点の配置で比較）")
        print("| 方式 | 問題数 | 完全一致重複 | 回転・反転込み重複 | 直進率0.6以上 | うち全体解法帯1 |")
        print("|---|---:|---:|---:|---:|---:|")
        for method in ("climb", "thin"):
            rs = [r for r in results if r["ok"] and r["method"] == method]
            raw: set[tuple] = set()
            canon: set[tuple] = set()
            raw_dup = canon_dup = 0
            for r in rs:
                key = puzzle_key(r)
                raw_dup += key in raw
                raw.add(key)
                ck = canonical_key(r)
                canon_dup += ck in canon
                canon.add(ck)
            straight = [r for r in rs if r["straight"] >= 0.6]
            band1 = sum(1 for r in straight if global_band(r["solver"]) == "1")
            print(f"| {method} | {len(rs)} | {raw_dup} | {canon_dup} | {len(straight)} | {band1} |")
        print()
    if args.anypath_jsonl:
        results = load_jsonl(args.anypath_jsonl)
        summarize_anypath(results)
        print()
        band_supply_table(
            "一意性を問わない（全条件を合わせた候補源）の描画分岐帯ごとの出現率 / 帯1問あたり秒",
            results,
            lambda r: r["band"],
            "012345",
        )
        print("一意性を問わない: 分岐段階の内訳（全条件、生成時の道で分析）")
        print(
            "| 盤面 | 問題数 | 分岐中央値 | 致命分岐 中央値 | 段階1〜2 中央値 | 段階3〜4 中央値 | 段階5 あり率 "
            "| 段階6 あり率 | 最大誤進入 中央値 | 5本の道で帯が揺れた率 | うち帯差2以上 |"
        )
        print("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
        by_n: dict[int, list[dict]] = {}
        for r in results:
            by_n.setdefault(r["n"], []).append(r)
        for n, rs in sorted(by_n.items()):

            def lv(r: dict, keys: Sequence[str]) -> int:
                return sum(r["profile"]["by_level"].get(k, 0) for k in keys)

            print(
                f"| {n}×{n} | {len(rs)} | {statistics.median(r['profile']['decisions'] for r in rs):g} "
                f"| {statistics.median(r['profile']['fatal_decisions'] for r in rs):g} "
                f"| {statistics.median(lv(r, ('1', '2')) for r in rs):g} "
                f"| {statistics.median(lv(r, ('3', '4')) for r in rs):g} "
                f"| {100 * sum(1 for r in rs if lv(r, ('5',))) / len(rs):.0f}% "
                f"| {100 * sum(1 for r in rs if lv(r, ('6',))) / len(rs):.0f}% "
                f"| {statistics.median(r['profile']['max_trap_depth'] for r in rs):g} "
                f"| {100 * sum(1 for r in rs if len(set(r['bands'])) > 1) / len(rs):.0f}% "
                f"| {100 * sum(1 for r in rs if band_spread(r['bands']) >= 2) / len(rs):.0f}% |"
            )


def run_selfcheck(args: argparse.Namespace) -> None:
    """全解探索の既知値との一致と、人間向け解法器が完成可能な手を誤って退けないことを確かめる。"""
    for n, expected in ((4, 52), (5, 824), (6, 22144)):
        board = Board(n, n, frozenset(r * (n + 1) + c for r in range(n) for c in range(n)))
        got = PathCounter(board).count([0], None, 10**9, 10**8).count
        print(f"{n}×{n} 全面盤・角始点のハミルトン路数: {got}（既知値 {expected}）")
    rng = seeded_rng(args.seed, "selfcheck")
    unique_checked = unique_wrong = safe_checked = safe_wrong = 0
    boards = 0
    while boards < args.samples:
        n = rng.choice((5, 6, 7))
        rho = rng.choice((0.0, 0.15, 0.3))
        path = make_saw(n, n, rho, rng)
        board = board_from_path(n, n, path)
        pc = PathCounter(board)
        solver = HumanSolver(board, path[0], None)
        boards += 1
        unique = pc.count([path[0]], None, 2, 200_000)
        if unique.count == 1 and not unique.timeout:
            unique_checked += 1
            unique_wrong += not HumanSolver(board, path[0], None).solve().solved
        for i in range(1, len(path) - 1):
            prefix = path[:i]
            for x in pc.nbrs[path[i - 1]]:
                if x in prefix or pc.count([*prefix, x], None, 1, 100_000).count == 0:
                    continue
                safe_checked += 1
                safe_wrong += refutation_level(solver, prefix, x) != 6
    print(f"盤面 {boards}: 完成可能な手 {safe_checked} 件のうち誤って退けた手 {safe_wrong} 件")
    print(f"うち一意解 {unique_checked} 問: 人間向け解法器で解けなかった問題 {unique_wrong} 問")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "suite",
        choices=("variants", "unique", "anypath", "diversity", "examples", "unique-examples", "report", "selfcheck"),
    )
    parser.add_argument("--seed", type=int, default=20261031)
    parser.add_argument("--samples", type=int, default=100)
    parser.add_argument("--sizes", default="5,6,7,8,9,10")
    parser.add_argument("--workers", type=int, default=max(1, (multiprocessing.cpu_count() or 1)))
    parser.add_argument("--node-limit", type=int, default=20_000)
    parser.add_argument("--iters", type=int, default=300)
    parser.add_argument("--per-band", type=int, default=2)
    parser.add_argument("--jsonl", help="結果を JSON Lines で保存する（unique / anypath）")
    parser.add_argument("--unique-jsonl", help="report: unique の保存結果")
    parser.add_argument("--anypath-jsonl", help="report: anypath の保存結果")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.samples < 1:
        raise SystemExit("--samples must be at least 1")
    runners = {
        "variants": run_variants,
        "unique": run_unique,
        "anypath": run_anypath,
        "diversity": run_diversity,
        "examples": run_examples,
        "unique-examples": run_unique_examples,
        "report": run_report,
        "selfcheck": run_selfcheck,
    }
    t0 = time.perf_counter()
    runners[args.suite](args)
    if args.suite != "report":
        print(f"\n(seed={args.seed} samples={args.samples} sizes={args.sizes} elapsed={time.perf_counter() - t0:.1f}s)")


if __name__ == "__main__":
    main()
