"""ブリッジパズル（bridges）の問題供給の調査用スクリプト。標準ライブラリだけで動く。

研究用のコードで、製品コードの性能を表すものではない。

ルール（合意）: 数字つきの島の間に縦横まっすぐ橋を架ける。橋は間に島のない2島だけをつなぐ。
同じ2島の間は2本まで。橋どうしは交差しない。各島の橋の本数は数字と同じ。全島が1つにつながる。

生成法（完成グラフ先行）:
  1. 島を1つ置き、既存の島から縦横に2マス以上離れた空きマスへ橋を伸ばして新しい島を置く、を繰り返す
     （橋の通るマス・島の周り4近傍には置かない）。橋は確率 p_double で2本、それ以外は1本。
     木として育つので連結は構成上保証される。
  2. 見通せる島の組で、まだ橋が無く既存の橋と交差しない組に確率 p_extra で橋を足す（閉路を作る）。
  3. 各島の数字 = 出ている橋の本数。
一意性の確認は、交差・連結を含む完全な解法器で解を2つまで数える。

推理だけで解けるか（この調査での定義。難易度の観点の定義とは揃えていない）:
  R1 数字の推理: 各島で「出せる本数の合計」と「出ている本数の下限」から各辺の下限・上限を締める
     （例: 3 で行き先が2つなら各1本以上、1 と 1 の間は1本まで）。橋が確定した辺と交差する辺は0本。
  R2 つながりの推理: R1 に加え、(a) 架けうる辺のグラフで、その辺を除くと島が分断される辺は1本以上、
     (b) その辺にその本数を架けると、確定した橋でつながった島の群が全部ちょうど満たされて閉じ、
     全島ではない群ができるなら、その本数は架けない（孤立の回避）。
  R3 1段仮置き: 未確定の辺の下限か上限の値を仮定して R2 まで進め、矛盾すればその値を外す。
  「推理だけで解ける」= R2 までで全辺が確定する。R3 が要るものは試し置きが要る問題とみなす。

サブコマンド:
  selfcheck  解法器どうしの突き合わせ（R2 で解けた盤は完全解法器でも解が1つ、など）
  rates      盤面の大きさ×島の密度×2本の割合×閉路の割合ごとに、一意解の割合・推理だけで解ける割合・時間
  pool       レベル想定の盤面で問題を集め、問題集の大きさ（JSON・gzip）と集める時間を測る
"""

from __future__ import annotations

import argparse
import gzip
import json
import random
import statistics
import time
from dataclasses import dataclass, field

DIRS = ((0, 1), (1, 0), (0, -1), (-1, 0))


@dataclass
class Puzzle:
    width: int
    height: int
    islands: list[tuple[int, int]]
    numbers: list[int]
    # 辺: (島a, 島b, 通るマスの集合, 横なら True)
    edges: list[tuple[int, int, frozenset[tuple[int, int]], bool]] = field(
        default_factory=list
    )
    incident: list[list[int]] = field(default_factory=list)
    crossing: list[list[int]] = field(default_factory=list)

    def build(self) -> None:
        index = {cell: i for i, cell in enumerate(self.islands)}
        self.edges = []
        for i, (r, c) in enumerate(self.islands):
            for dr, dc, horizontal in ((0, 1, True), (1, 0, False)):
                cells = []
                rr, cc = r + dr, c + dc
                while 0 <= rr < self.height and 0 <= cc < self.width:
                    if (rr, cc) in index:
                        if cells:  # 隣接した島どうしは生成しないが、念のため間のマスが1つ以上の組だけを辺にする
                            self.edges.append(
                                (i, index[(rr, cc)], frozenset(cells), horizontal)
                            )
                        break
                    cells.append((rr, cc))
                    rr, cc = rr + dr, cc + dc
        n = len(self.islands)
        self.incident = [[] for _ in range(n)]
        for e, (a, b, _, _) in enumerate(self.edges):
            self.incident[a].append(e)
            self.incident[b].append(e)
        self.crossing = [[] for _ in self.edges]
        for e, (_, _, cells_e, h_e) in enumerate(self.edges):
            for f in range(e + 1, len(self.edges)):
                _, _, cells_f, h_f = self.edges[f]
                if h_e != h_f and cells_e & cells_f:
                    self.crossing[e].append(f)
                    self.crossing[f].append(e)


# ---------------------------------------------------------------- 生成


def generate(
    rng: random.Random,
    width: int,
    height: int,
    density: float,
    p_double: float,
    p_extra: float,
    max_fail: int = 400,
    p_split: float = 0.0,
) -> tuple[Puzzle, dict[tuple[int, int], int]]:
    """完成グラフを作り、数字を付けた問題と、作ったときの橋（島の組→本数）を返す。"""
    target = max(2, round(density * width * height))
    islands: list[tuple[int, int]] = []
    island_set: set[tuple[int, int]] = set()
    bridge_cells: set[tuple[int, int]] = set()
    bridges: dict[tuple[int, int], int] = {}
    paths: dict[tuple[int, int], list[tuple[int, int]]] = {}
    start = (rng.randrange(height), rng.randrange(width))
    islands.append(start)
    island_set.add(start)

    def blocked_for_island(cell: tuple[int, int], source: tuple[int, int]) -> bool:
        if cell in island_set or cell in bridge_cells:
            return True
        r, c = cell
        for dr, dc in DIRS:
            nb = (r + dr, c + dc)
            if nb in island_set:
                return True
        return False

    failures = 0
    while len(islands) < target and failures < max_fail:
        if bridges and rng.random() < p_split:
            # 分割: 既存の橋の途中（両端から2マス以上）に島を置き、橋を2本に分ける。本数は元の橋と同じ
            key = rng.choice(list(bridges))
            path = paths[key]
            if len(path) < 3:
                failures += 1
                continue
            k = rng.randrange(1, len(path) - 1)
            cell = path[k]
            r, c = cell
            if any((r + dr, c + dc) in island_set for dr, dc in DIRS):
                failures += 1
                continue
            failures = 0
            a, b = key
            x = len(islands)
            islands.append(cell)
            island_set.add(cell)
            bridge_cells.discard(cell)
            mult = bridges.pop(key)
            del paths[key]
            bridges[(a, x)] = mult
            paths[(a, x)] = path[:k]
            bridges[(x, b)] = mult
            paths[(x, b)] = path[k + 1 :]
            continue
        src_i = rng.randrange(len(islands))
        sr, sc = islands[src_i]
        dr, dc = DIRS[rng.randrange(4)]
        max_len = (
            (width - 1 - sc) if dc > 0 else sc if dc < 0 else
            (height - 1 - sr) if dr > 0 else sr
        )
        if max_len < 2:
            failures += 1
            continue
        length = rng.randint(2, min(max_len, max(2, min(width, height) // 2 + 1)))
        path = [(sr + dr * k, sc + dc * k) for k in range(1, length)]
        dest = (sr + dr * length, sc + dc * length)
        if any(p in island_set or p in bridge_cells for p in path) or blocked_for_island(
            dest, (sr, sc)
        ):
            failures += 1
            continue
        failures = 0
        dest_i = len(islands)
        islands.append(dest)
        island_set.add(dest)
        bridge_cells.update(path)
        bridges[(src_i, dest_i)] = 2 if rng.random() < p_double else 1
        paths[(src_i, dest_i)] = path

    puzzle = Puzzle(width, height, islands, [0] * len(islands))
    puzzle.build()
    pair_to_edge = {}
    for e, (a, b, _, _) in enumerate(puzzle.edges):
        pair_to_edge[(min(a, b), max(a, b))] = e
    value = [0] * len(puzzle.edges)
    for (a, b), k in bridges.items():
        e = pair_to_edge.get((min(a, b), max(a, b)))
        if e is None:  # 後から置いた島が間に入った（橋のマスには置かないので起きないはず）
            raise AssertionError("bridge lost")
        value[e] = k
    # 閉路を足す
    used_cells = set(bridge_cells)
    order = list(range(len(puzzle.edges)))
    rng.shuffle(order)
    for e in order:
        if value[e] or rng.random() >= p_extra:
            continue
        cells = puzzle.edges[e][2]
        if cells & used_cells:
            continue
        value[e] = 2 if rng.random() < p_double else 1
        used_cells |= cells
    numbers = [0] * len(islands)
    for e, (a, b, _, _) in enumerate(puzzle.edges):
        numbers[a] += value[e]
        numbers[b] += value[e]
    puzzle.numbers = numbers
    return puzzle, {e: v for e, v in enumerate(value) if v}


# ---------------------------------------------------------------- 推論


class Contradiction(Exception):
    pass


def propagate_numbers(p: Puzzle, lo: list[int], hi: list[int]) -> None:
    """R1: 島の数字による下限・上限の締め込みと、確定した橋と交差する辺の除外。"""
    work = list(range(len(p.islands)))
    in_work = [True] * len(p.islands)
    cross_done = [False] * len(p.edges)
    while work:
        i = work.pop()
        in_work[i] = False
        num = p.numbers[i]
        inc = p.incident[i]
        slo = sum(lo[e] for e in inc)
        shi = sum(hi[e] for e in inc)
        if slo > num or shi < num:
            raise Contradiction
        for e in inc:
            nl = max(lo[e], num - (shi - hi[e]))
            nh = min(hi[e], num - (slo - lo[e]))
            if nl > nh:
                raise Contradiction
            if nl != lo[e] or nh != hi[e]:
                slo += nl - lo[e]
                shi += nh - hi[e]
                lo[e], hi[e] = nl, nh
                a, b, _, _ = p.edges[e]
                other = b if a == i else a
                if not in_work[other]:
                    in_work[other] = True
                    work.append(other)
                if not in_work[i]:
                    in_work[i] = True
                    work.append(i)
            if lo[e] > 0 and not cross_done[e]:
                cross_done[e] = True
                for f in p.crossing[e]:
                    if lo[f] > 0:
                        raise Contradiction
                    if hi[f] > 0:
                        hi[f] = 0
                        for j in p.edges[f][:2]:
                            if not in_work[j]:
                                in_work[j] = True
                                work.append(j)


def components(n: int, p: Puzzle, active: list[bool]) -> list[int]:
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e, (a, b, _, _) in enumerate(p.edges):
        if active[e]:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb
    return [find(i) for i in range(n)]


def potential_connected(p: Puzzle, hi: list[int]) -> bool:
    n = len(p.islands)
    comp = components(n, p, [h > 0 for h in hi])
    return len(set(comp)) == 1


def cut_edges(p: Puzzle, hi: list[int]) -> list[int]:
    """架けうる辺のグラフの橋（除くと分断される辺）。Tarjan。"""
    n = len(p.islands)
    adj: list[list[tuple[int, int]]] = [[] for _ in range(n)]
    for e, (a, b, _, _) in enumerate(p.edges):
        if hi[e] > 0:
            adj[a].append((b, e))
            adj[b].append((a, e))
    disc = [-1] * n
    low = [0] * n
    result = []
    timer = 0
    stack = [(0, -1, iter(adj[0]))]
    disc[0] = low[0] = timer
    timer += 1
    while stack:
        v, pe, it = stack[-1]
        advanced = False
        for w, e in it:
            if e == pe:
                continue
            if disc[w] == -1:
                disc[w] = low[w] = timer
                timer += 1
                stack.append((w, e, iter(adj[w])))
                advanced = True
                break
            low[v] = min(low[v], disc[w])
        if not advanced:
            stack.pop()
            if stack:
                u = stack[-1][0]
                low[u] = min(low[u], low[v])
                if low[v] > disc[u]:
                    result.append(pe)
    return result


def closes_early(p: Puzzle, lo: list[int], e: int, v: int) -> bool:
    """辺 e に v 本架けると、確定した橋でつながる群が全部満たされて閉じ、全島ではない群になるか。"""
    n = len(p.islands)
    a, b, _, _ = p.edges[e]
    # e を含む群を、lo>0 の辺と e でたどる
    seen = {a}
    stack = [a]
    while stack:
        i = stack.pop()
        for f in p.incident[i]:
            if f != e and lo[f] == 0:
                continue
            x, y, _, _ = p.edges[f]
            j = y if x == i else x
            if j not in seen:
                seen.add(j)
                stack.append(j)
    if len(seen) == n:
        return False
    for i in seen:
        s = sum((v if f == e else lo[f]) for f in p.incident[i])
        if s != p.numbers[i]:
            return False
    return True


def propagate_connectivity(p: Puzzle, lo: list[int], hi: list[int]) -> bool:
    """R2 の1巡。何か締めたら True。矛盾は例外。"""
    if not potential_connected(p, hi):
        raise Contradiction
    changed = False
    for e in cut_edges(p, hi):
        if lo[e] == 0:
            lo[e] = 1
            changed = True
    for e in range(len(p.edges)):
        while hi[e] > lo[e] and hi[e] > 0 and closes_early(p, lo, e, hi[e]):
            hi[e] -= 1
            changed = True
        if lo[e] > 0 and closes_early(p, lo, e, lo[e]) and lo[e] == hi[e]:
            raise Contradiction
    return changed


def deduce(p: Puzzle, lo: list[int], hi: list[int], level: int, stats: dict | None = None) -> None:
    """level 1: R1 だけ。2: R1+R2。3: R1+R2+1段仮置き。到達できる所まで締める。矛盾は例外。"""
    while True:
        propagate_numbers(p, lo, hi)
        if level < 2:
            return
        if propagate_connectivity(p, lo, hi):
            if stats is not None:
                stats["r2"] = stats.get("r2", 0) + 1
            continue
        if level < 3 or all(lo[e] == hi[e] for e in range(len(p.edges))):
            return
        progressed = False
        for e in range(len(p.edges)):
            if lo[e] == hi[e]:
                continue
            for v in (lo[e], hi[e]):
                tlo, thi = lo[:], hi[:]
                tlo[e] = thi[e] = v
                try:
                    deduce(p, tlo, thi, 2)
                except Contradiction:
                    if v == lo[e]:
                        lo[e] += 1
                    else:
                        hi[e] -= 1
                    progressed = True
                    if stats is not None:
                        stats["r3"] = stats.get("r3", 0) + 1
                    break
            if progressed:
                break
        if not progressed:
            return


def grade(p: Puzzle) -> int:
    """推理で解き切れる最小の段（1, 2, 3）。解き切れなければ 4。"""
    for level in (1, 2, 3):
        lo = [0] * len(p.edges)
        hi = [2] * len(p.edges)
        try:
            deduce(p, lo, hi, level)
        except Contradiction:
            raise AssertionError("contradiction on a solvable puzzle")
        if all(lo[e] == hi[e] for e in range(len(p.edges))):
            if level == 1 and not potential_connected(p, hi):
                return 4  # 数字だけで決まったが連結でない（起きないはず）
            return level
    return 4


# ---------------------------------------------------------------- 完全解法器


def count_solutions(p: Puzzle, limit: int = 2, node_limit: int = 200_000) -> tuple[int, int, bool]:
    """解を limit 個まで数える。(解の数, ノード数, 打ち切ったか)。R1 と連結の枝刈り（R2）つきの深さ優先。"""
    nodes = 0
    found = 0
    aborted = False

    def rec(lo: list[int], hi: list[int]) -> None:
        nonlocal nodes, found, aborted
        if found >= limit or aborted:
            return
        nodes += 1
        if nodes > node_limit:
            aborted = True
            return
        try:
            deduce(p, lo, hi, 2)
        except Contradiction:
            return
        undecided = [e for e in range(len(p.edges)) if lo[e] != hi[e]]
        if not undecided:
            if potential_connected(p, hi):
                found += 1
            return
        # 未確定の辺の多い島の辺を避け、両端の余りの少ない辺から分ける
        e = min(undecided, key=lambda f: hi[f] - lo[f])
        for v in range(lo[e], hi[e] + 1):
            nlo, nhi = lo[:], hi[:]
            nlo[e] = nhi[e] = v
            rec(nlo, nhi)

    rec([0] * len(p.edges), [2] * len(p.edges))
    return found, nodes, aborted


def brute_count(p: Puzzle, limit: int = 10) -> int:
    """小さい盤用の素朴な全探索（R2 を使わず、葉で数字・交差・連結を確かめる）。"""
    m = len(p.edges)
    count = 0
    value = [0] * m

    def ok_leaf() -> bool:
        for i, inc in enumerate(p.incident):
            if sum(value[e] for e in inc) != p.numbers[i]:
                return False
        for e in range(m):
            if value[e]:
                for f in p.crossing[e]:
                    if value[f]:
                        return False
        return potential_connected(p, value)

    def rec(k: int) -> None:
        nonlocal count
        if count >= limit:
            return
        if k == m:
            if ok_leaf():
                count += 1
            return
        a, b, _, _ = p.edges[k]
        for v in range(3):
            value[k] = v
            if sum(value[e] for e in p.incident[a] if e <= k) > p.numbers[a]:
                continue
            if sum(value[e] for e in p.incident[b] if e <= k) > p.numbers[b]:
                continue
            rec(k + 1)
        value[k] = 0

    rec(0)
    return count


# ---------------------------------------------------------------- 符号化


def encode_cells(p: Puzzle) -> str:
    """盤の全マスを行優先に1文字ずつ（空き 0、島は数字 1〜8）。"""
    grid = ["0"] * (p.width * p.height)
    for (r, c), n in zip(p.islands, p.numbers):
        grid[r * p.width + c] = str(n)
    return "".join(grid)


def encode_compact(p: Puzzle) -> str:
    """島の有無のビット列（16進）+ 島の数字を行優先に並べた列。"""
    bits = [0] * (p.width * p.height)
    order = sorted(range(len(p.islands)), key=lambda i: p.islands[i])
    for (r, c) in p.islands:
        bits[r * p.width + c] = 1
    hexs = ""
    for k in range(0, len(bits), 4):
        d = 0
        for j in range(4):
            d = d * 2 + (bits[k + j] if k + j < len(bits) else 0)
        hexs += "0123456789abcdef"[d]
    return hexs + ":" + "".join(str(p.numbers[i]) for i in order)


# ---------------------------------------------------------------- サブコマンド


def parse_size(text: str) -> tuple[int, int]:
    w, h = text.lower().split("x")
    return int(w), int(h)


MAX_FAIL = 400
P_SPLIT = 0.0


def one_candidate(rng: random.Random, w: int, h: int, density: float, pd: float, px: float, node_limit: int) -> dict:
    t0 = time.perf_counter()
    p, solution = generate(rng, w, h, density, pd, px, MAX_FAIL, P_SPLIT)
    t1 = time.perf_counter()
    count, nodes, aborted = count_solutions(p, 2, node_limit)
    t2 = time.perf_counter()
    g = grade(p) if count == 1 and not aborted else None
    t3 = time.perf_counter()
    doubles = sum(1 for v in solution.values() if v == 2)
    return {
        "puzzle": p,
        "islands": len(p.islands),
        "density": len(p.islands) / (w * h),
        "bridges": len(solution),
        "double_share": doubles / len(solution) if solution else 0.0,
        "unique": count == 1 and not aborted,
        "aborted": aborted,
        "nodes": nodes,
        "grade": g,
        "t_gen": t1 - t0,
        "t_count": t2 - t1,
        "t_grade": t3 - t2,
    }


def cmd_selfcheck(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    checked = 0
    mismatches = 0
    graded_unique = 0
    for _ in range(args.samples):
        w, h = rng.choice([(4, 4), (5, 5), (5, 4)])
        p, solution = generate(rng, w, h, rng.choice([0.3, 0.4]), 0.3, rng.choice([0.0, 0.3]), MAX_FAIL, P_SPLIT)
        if len(p.edges) > 14:
            continue
        bc = brute_count(p, 10)
        sc, _, aborted = count_solutions(p, 10, 10**6)
        checked += 1
        if bc != sc or aborted:
            mismatches += 1
            print("mismatch", bc, sc, encode_cells(p), w, h)
        # 作った解は満たす
        assert bc >= 1
        if sc == 1:
            gr = grade(p)
            if gr <= 3:
                graded_unique += 1
    # R2 で解き切れた盤は、確定した値が作った解と一致し、完全解法器でも1解
    rng2 = random.Random(args.seed + 1)
    deduce_ok = 0
    deduce_total = 0
    for _ in range(args.samples):
        p, solution = generate(rng2, 8, 8, 0.25, 0.3, 0.2, MAX_FAIL, P_SPLIT)
        lo = [0] * len(p.edges)
        hi = [2] * len(p.edges)
        deduce(p, lo, hi, 3)
        if all(lo[e] == hi[e] for e in range(len(p.edges))):
            deduce_total += 1
            sol = [solution.get(e, 0) for e in range(len(p.edges))]
            c, _, _ = count_solutions(p, 2, 10**6)
            if lo == sol and c == 1:
                deduce_ok += 1
            else:
                print("deduction mismatch", encode_cells(p))
    print(f"brute vs solver: checked={checked} mismatches={mismatches} unique_graded={graded_unique}")
    print(f"deduction(R3) solved={deduce_total} consistent_with_generated_and_unique={deduce_ok}")


def cmd_rates(args: argparse.Namespace) -> None:
    sizes = [parse_size(s) for s in args.sizes.split(",")]
    densities = [float(x) for x in args.densities.split(",")]
    doubles = [float(x) for x in args.doubles.split(",")]
    extras = [float(x) for x in args.extras.split(",")]
    print(
        "size\tdens\tpdbl\tpext\tn\tislands_med\treal_dens\tdbl_share\tunique%\taborted\tR1%\tR2%\tR3%\tunsolved%\t"
        "deducible%(R<=2 of all)\tms/cand_med\tms/cand_p95\ts/deducible"
    )
    for (w, h) in sizes:
        for d in densities:
            for pd in doubles:
                for px in extras:
                    rng = random.Random(f"{args.seed}-{w}x{h}-{d}-{pd}-{px}")
                    rows = [one_candidate(rng, w, h, d, pd, px, args.node_limit) for _ in range(args.samples)]
                    n = len(rows)
                    uniq = [r for r in rows if r["unique"]]
                    grades = [r["grade"] for r in uniq]
                    total_time = sum(r["t_gen"] + r["t_count"] + r["t_grade"] for r in rows)
                    times = sorted((r["t_gen"] + r["t_count"] + r["t_grade"]) * 1000 for r in rows)
                    deducible = sum(1 for g in grades if g <= 2)
                    per = (total_time / deducible) if deducible else float("inf")
                    print(
                        f"{w}x{h}\t{d}\t{pd}\t{px}\t{n}\t{statistics.median(r['islands'] for r in rows)}\t"
                        f"{statistics.mean(r['density'] for r in rows):.2f}\t"
                        f"{statistics.mean(r['double_share'] for r in rows):.2f}\t"
                        f"{100 * len(uniq) / n:.0f}\t{sum(r['aborted'] for r in rows)}\t"
                        f"{100 * grades.count(1) / n:.0f}\t{100 * grades.count(2) / n:.0f}\t"
                        f"{100 * grades.count(3) / n:.0f}\t{100 * grades.count(4) / n:.0f}\t"
                        f"{100 * deducible / n:.0f}\t{times[n // 2]:.1f}\t{times[int(n * 0.95)]:.1f}\t{per:.3f}",
                        flush=True,
                    )


def cmd_pool(args: argparse.Namespace) -> None:
    """レベル想定の盤ごとに、推理だけで解ける一意解の問題を per 問集め、時間と問題集の大きさを測る。"""
    plan = []
    for spec in args.plan.split(","):
        level, size, dens = spec.split(":")
        w, h = parse_size(size)
        plan.append((level, w, h, float(dens)))
    levels_cells: dict[str, list] = {}
    levels_compact: dict[str, list] = {}
    print("level\tsize\tdens\taccepted\tcandidates\tdup\tseconds\ts/accepted\tR2share")
    for level, w, h, dens in plan:
        rng = random.Random(f"{args.seed}-pool-{level}")
        accepted = 0
        candidates = 0
        dup = 0
        seen: set[str] = set()
        r2 = 0
        t0 = time.perf_counter()
        cells_list: list = []
        compact_list: list = []
        while accepted < args.per_level and candidates < args.budget:
            candidates += 1
            row = one_candidate(rng, w, h, dens, args.double, args.extra, args.node_limit)
            if not row["unique"] or row["grade"] > 2:
                continue
            p = row["puzzle"]
            key = canonical(p)
            if key in seen:
                dup += 1
                continue
            seen.add(key)
            accepted += 1
            r2 += row["grade"] == 2
            cells_list.append([w, h, candidates - 1, encode_cells(p), row["grade"], len(p.islands)])
            compact_list.append([w, h, candidates - 1, encode_compact(p), row["grade"], len(p.islands)])
        sec = time.perf_counter() - t0
        levels_cells[level] = cells_list
        levels_compact[level] = compact_list
        print(
            f"{level}\t{w}x{h}\t{dens}\t{accepted}\t{candidates}\t{dup}\t{sec:.1f}\t"
            f"{sec / max(accepted, 1):.3f}\t{r2 / max(accepted, 1):.2f}",
            flush=True,
        )
    for name, levels in (("cells", levels_cells), ("compact", levels_compact)):
        body = json.dumps({"generatorVersion": "1", "levels": levels}, separators=(",", ":"))
        # 既存の問題集と同じく、1問1行で書いた場合
        lines = ["{", '  "generatorVersion": "1",', '  "levels": {']
        for li, (lv, entries) in enumerate(levels.items()):
            lines.append(f'    "{lv}": [')
            for k, entry in enumerate(entries):
                lines.append("      " + json.dumps(entry, separators=(",", ":")) + ("," if k + 1 < len(entries) else ""))
            lines.append("    ]" + ("," if li + 1 < len(levels) else ""))
        lines.append("  }")
        lines.append("}")
        pretty = "\n".join(lines) + "\n"
        total = sum(len(v) for v in levels.values())
        print(
            f"format={name}\tproblems={total}\tjson_min={len(body)}\tjson_lines={len(pretty)}\t"
            f"gzip_lines={len(gzip.compress(pretty.encode(), 9))}\tbytes/problem={len(pretty) / max(total, 1):.0f}"
        )
    if args.write_sample:
        with open(args.write_sample, "w") as fh:
            json.dump({"levels": levels_cells}, fh, separators=(",", ":"))


def canonical(p: Puzzle) -> str:
    """回転・反転（8通り）で同型の盤を同じキーにする。"""
    keys = []
    for t in range(8):
        cells = []
        for (r, c), n in zip(p.islands, p.numbers):
            w, h = p.width, p.height
            rr, cc, ww = r, c, w
            if t & 4:
                rr, cc = cc, rr
                ww = h
            if t & 1:
                rr = (h if not t & 4 else w) - 1 - rr
            if t & 2:
                cc = ww - 1 - cc
            cells.append((rr, cc, n))
        keys.append(str(sorted(cells)))
    return min(keys)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("selfcheck")
    s.add_argument("--seed", type=int, default=20261102)
    s.add_argument("--samples", type=int, default=300)
    s.add_argument("--split", type=float, default=0.0)
    r = sub.add_parser("rates")
    r.add_argument("--seed", type=int, default=20261102)
    r.add_argument("--sizes", default="7x7,8x8,9x9,10x10,7x9,8x10")
    r.add_argument("--densities", default="0.2,0.28")
    r.add_argument("--doubles", default="0.3")
    r.add_argument("--extras", default="0.2")
    r.add_argument("--samples", type=int, default=200)
    r.add_argument("--node-limit", type=int, default=200_000)
    r.add_argument("--max-fail", type=int, default=400)
    r.add_argument("--split", type=float, default=0.0)
    q = sub.add_parser("pool")
    q.add_argument("--seed", type=int, default=20261102)
    q.add_argument("--plan", default="1:7x7:0.25,2:8x8:0.25,3:9x9:0.25,4:10x10:0.25,5:10x10:0.3")
    q.add_argument("--per-level", type=int, default=500)
    q.add_argument("--budget", type=int, default=20000)
    q.add_argument("--double", type=float, default=0.3)
    q.add_argument("--extra", type=float, default=0.2)
    q.add_argument("--node-limit", type=int, default=200_000)
    q.add_argument("--write-sample", default="")
    args = parser.parse_args()
    global MAX_FAIL, P_SPLIT
    MAX_FAIL = getattr(args, "max_fail", MAX_FAIL)
    P_SPLIT = getattr(args, "split", P_SPLIT)
    {"selfcheck": cmd_selfcheck, "rates": cmd_rates, "pool": cmd_pool}[args.cmd](args)


if __name__ == "__main__":
    main()
