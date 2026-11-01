"""氷の床迷路（作業名）の生成 v2: 手筋を含む問題を作る実験。

生成 v1（ice_floor_hard_generation_experiment）の目的関数は「最短手数＋読みどころ」で、長くすると
このパズル固有の手筋（ゴールを通り過ぎる誘い・詰みの誘い手・入り直し・逆算）が消えた。
ここでは手筋の特徴量を定義し、最短手数は範囲の制約にだけ使い、手筋を目的関数と採用条件に入れる。

盤面は氷と岩だけ。乱数はすべて seed と条件名から作り、結果を再現可能にする。
Python標準ライブラリだけを使う。
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import sys
import time
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass, replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ice_floor_difficulty_experiment import TIE_ORDERS, Shape, parse_shape  # noqa: E402
from ice_floor_hard_generation_experiment import (  # noqa: E402
    LEVEL_PLANS,
    UNREAD,
    Evaluation,
    Features,
    LevelResult,
    Searcher,
    SearchSpec,
    features_of,
    level_task,
    normalize,
    parallel,
    render_marked,
    rows_of,
    stop_tables,
    to_board,
)
from ice_floor_supply_experiment import (  # noqa: E402
    DX,
    DY,
    ROCK,
    Board,
    canonical_key,
    coreachable,
    count_shortest_paths,
    explore,
    percentile,
    random_board,
    slide,
)

DIRECTION_NAMES = "上右下左"
# 近い道筋とみなす、最短手数からの遠回りの手数（v1 の近い別解と同じ）
NEAR_SLACK = 2
# 逆算の1段で候補がこの数以下なら「止め石を探す段」とみなす
FUNNEL_WIDTH = 2
# 偽の道とみなす、最短からの遠回りの手数
FALSE_LEAD_COST = 3
# 1回の評価で比べるゴールの候補の数
MAX_GOALS = 8


# ---------------------------------------------------------------------------
# 手筋の特徴量


@dataclass(frozen=True)
class Tactics:
    """最短の道筋（方向番号の小さい手を優先、v1 の path_choices と同じ）と盤面から測る手筋。

    「もっともらしい手」は、滑った先がゴールへ近づく（マンハッタン距離が減る）、ゴールと見通しで
    揃う、滑りがゴールを通過する、のどれかに当たる手。人が目先で選びたくなる手のモデル。"""

    shortest: int
    optimal_paths: int
    # 最短+NEAR_SLACK 手以内の道筋に乗る停止点（最短の道筋の停止点を除く）。近い別解の多さの軽い代理
    near_states: int
    dead_states: int  # 到達できる停止点のうち、ゴールへ二度と止まれない停止点
    # ゴール通過の誘い: 近い道筋に乗る停止点から、ゴールを通過して止まらない滑り
    pass_lures: int
    pass_traps: int  # そのうち、通過した先が詰み
    pass_slides: int  # 到達できる全停止点から、ゴールを通過する滑り
    # 詰みの誘い手: 最短の道筋上の各停止点で、詰みに入る選択肢と、そのうちもっともらしいもの
    trap_options: int
    trap_lures: int
    # そのうち、入った直後に閉じ込めの知らせ（SPEC-019）が出ないもの。知らせが出る詰みは
    # その場で待ったへ導かれるので、誘いとして弱い
    silent_trap_lures: int
    # 入り直し: 最短の道筋で、ゴールと見通しで揃った停止点から、揃わない停止点へ離れる回数
    reentries: int
    # 回り込み: 最後の滑りが開始位置の側へ向かう（ゴールの向こう側から入る）
    wrap: bool
    # 逆算の段数: ゴールから盤面全体の停止点を逆にたどり、候補が FUNNEL_WIDTH 以下の段が続く数。
    # 開始位置から1手で行ける停止点に届いたら打ち切る
    funnel: int
    entries: int  # ゴールに1手で止まれる停止点（盤面全体）
    # 分岐の質: もっともらしい選択肢が2つ以上ある手、正しい手がもっともらしくないのに
    # 別のもっともらしい手がある手（目先の近づく手が報われない）、戻らない選択肢が1つしかない手
    forks: int
    lure_steps: int
    forced: int
    # 偽の道: 最短の道筋上の、もっともらしいが FALSE_LEAD_COST 手以上の遠回りか詰みになる選択肢
    false_leads: int
    # 遠回り: ゴールから離れる手が続く区間のうち、もっともらしい別の手を捨てて始まるもの
    detours: int
    away_runs: int  # 最短の道筋でゴールから離れる手が続く区間の数
    goal_rock_stop: bool  # ゴールで止める壁が岩（外壁でない）
    rock_stops: int  # 最短の道筋の停止のうち、岩で止まる停止
    relevant_rocks: int


@dataclass
class BoardGraph:
    """1つの盤面と開始位置について、ゴールによらない量。"""

    width: int
    height: int
    tables: tuple[list[int], ...]
    dist: dict[int, int]
    succ: dict[int, list[tuple[int, int]]]
    pred: dict[int, list[int]]
    global_tables: tuple[list[int], ...]  # 無関係な岩を除いた（出題される）盤面の滑り
    global_pred: dict[int, list[tuple[int, int]]]  # 盤面全体の停止点への滑り [(方向, 滑る前)]
    start_ball: frozenset[int]  # 開始位置と、そこから1手で止まる停止点
    relevant_rocks: int


def board_graph(width: int, height: int, rock: Sequence[bool], start: int) -> BoardGraph:
    tables = stop_tables(width, height, rock)
    dist = {start: 0}
    succ: dict[int, list[tuple[int, int]]] = {}
    queue = [start]
    stoppers: set[int] = set()
    for state in queue:
        moves = []
        for d in range(4):
            end = tables[d][state]
            x, y = end % width + DX[d], end // width + DY[d]
            if 0 <= x < width and 0 <= y < height:
                stoppers.add(y * width + x)
            if end == state:
                continue
            moves.append((d, end))
            if end not in dist:
                dist[end] = dist[state] + 1
                queue.append(end)
        succ[state] = moves
    pred: dict[int, list[int]] = {s: [] for s in dist}
    for s, moves in succ.items():
        for _, end in moves:
            pred[end].append(s)
    # 逆向きに考える人は到達できるかを知らずに盤面全体を見るが、見る盤面は無関係な岩を除いた
    # 出題される盤面なので、関係する岩だけで滑りを作り直す
    relevant = [cell in stoppers for cell in range(width * height)]
    global_tables = tables if relevant == list(rock) else stop_tables(width, height, relevant)
    nodes = {start}
    for cell in range(width * height):
        if not relevant[cell]:
            nodes.update(table[cell] for table in global_tables)
    global_pred: dict[int, list[tuple[int, int]]] = {node: [] for node in nodes}
    for node in nodes:
        for d, table in enumerate(global_tables):
            end = table[node]
            if end != node:
                global_pred[end].append((d, node))
    start_ball = frozenset([start, *(end for _, end in succ[start])])
    return BoardGraph(
        width,
        height,
        tables,
        dist,
        succ,
        pred,
        global_tables,
        global_pred,
        start_ball,
        len(stoppers),
    )


def backward_layers(pred: dict[int, list[int]], goal: int) -> dict[int, int]:
    to_goal = {goal: 0}
    queue = [goal]
    for state in queue:
        for prev in pred[state]:
            if prev not in to_goal:
                to_goal[prev] = to_goal[state] + 1
                queue.append(prev)
    return to_goal


def global_layers(g: BoardGraph, goal: int) -> dict[int, int]:
    to_goal = {goal: 0}
    queue = [goal]
    for state in queue:
        for _, prev in g.global_pred[state]:
            if prev not in to_goal:
                to_goal[prev] = to_goal[state] + 1
                queue.append(prev)
    return to_goal


def confined(g: BoardGraph, state: int) -> bool:
    """SPEC-019 の閉じ込め（ゴールが無ければ知らせる）: 今の位置から滑って行けるどの位置からも
    今の位置へ戻れる。"""
    ahead = {state}
    queue = [state]
    for s in queue:
        for _, end in g.succ[s]:
            if end not in ahead:
                ahead.add(end)
                queue.append(end)
    return ahead <= set(backward_layers(g.pred, state))


def tactics_of(g: BoardGraph, start: int, goal: int) -> Tactics:
    w = g.width
    gx, gy = goal % w, goal // w
    tables = g.tables

    def gap(s: int) -> int:
        return abs(s % w - gx) + abs(s // w - gy)

    def toward(s: int) -> int:
        """ゴールと同じ行・列にあるとき、ゴールへ向かう方向。無ければ -1。"""
        sx, sy = s % w, s // w
        if sx == gx and sy != gy:
            return 2 if gy > sy else 0
        if sy == gy and sx != gx:
            return 1 if gx > sx else 3
        return -1

    def sees(s: int) -> bool:
        d = toward(s)
        if d < 0:
            return False
        end = tables[d][s]
        ex, ey = end % w, end // w
        return (ey <= gy, ex >= gx, ey >= gy, ex <= gx)[d]

    def passes(s: int, d: int) -> bool:
        return d == toward(s) and sees(s) and tables[d][s] != goal

    dist = g.dist
    to_goal = backward_layers(g.pred, goal)
    shortest = dist[goal]

    ways = {start: 1}
    for state in sorted(dist, key=dist.__getitem__):
        count = ways.get(state, 0)
        if count:
            for _, end in g.succ[state]:
                if dist[end] == dist[state] + 1:
                    ways[end] = ways.get(end, 0) + count
    near = {s for s, d in dist.items() if s in to_goal and d + to_goal[s] <= shortest + NEAR_SLACK}
    pass_lures = pass_traps = 0
    for s in near:
        if s == goal:
            continue
        d = toward(s)
        if d >= 0 and passes(s, d):
            pass_lures += 1
            pass_traps += tables[d][s] not in to_goal
    pass_slides = sum(1 for s in dist if s != goal and toward(s) >= 0 and passes(s, toward(s)))

    def plausible(s: int, d: int, end: int) -> bool:
        return end == goal or gap(end) < gap(s) or sees(end) or passes(s, d)

    state = start
    prefix = {start}
    path = [start]
    forced = forks = trap_options = trap_lures = rock_stops = false_leads = 0
    silent_traps = 0
    lured: list[bool] = []
    last_direction = -1
    while state != goal:
        remaining = to_goal[state]
        options = [(d, end) for d, end in g.succ[state] if end not in prefix]
        nd, nxt = next((d, end) for d, end in g.succ[state] if to_goal.get(end) == remaining - 1)
        good = [(d, end) for d, end in options if plausible(state, d, end)]
        forced += len(options) == 1
        forks += len(good) >= 2
        lured.append(bool(good) and not plausible(state, nd, nxt))
        for d, end in options:
            after = to_goal.get(end)
            if after is None:
                trap_options += 1
                if plausible(state, d, end):
                    trap_lures += 1
                    silent_traps += not confined(g, end)
            if (after is None or after + 1 - remaining >= FALSE_LEAD_COST) and plausible(
                state, d, end
            ):
                false_leads += 1
        bx, by = nxt % w + DX[nd], nxt // w + DY[nd]
        rock_stops += 0 <= bx < w and 0 <= by < g.height
        state, last_direction = nxt, nd
        prefix.add(state)
        path.append(state)

    seen_flags = [sees(s) for s in path[:-1]]
    reentries = sum(1 for a, b in zip(seen_flags, seen_flags[1:], strict=False) if a and not b)
    away_flags = [gap(b) > gap(a) for a, b in zip(path, path[1:], strict=False)]
    run_starts = [
        i for i, away in enumerate(away_flags) if away and (i == 0 or not away_flags[i - 1])
    ]
    sx, sy = start % w, start // w
    wrap = DX[last_direction] * (sx - gx) + DY[last_direction] * (sy - gy) > 0
    bx, by = gx + DX[last_direction], gy + DY[last_direction]

    global_to_goal = global_layers(g, goal)
    layers = Counter(global_to_goal.values())
    layer_members: dict[int, set[int]] = {}
    for s, d in global_to_goal.items():
        layer_members.setdefault(d, set()).add(s)
    funnel = 0
    for k in range(1, max(layers) + 1):
        members = layer_members.get(k, set())
        if not members or members & g.start_ball or len(members) > FUNNEL_WIDTH:
            break
        funnel += 1

    return Tactics(
        shortest=shortest,
        optimal_paths=ways.get(goal, 0),
        near_states=len(near) - (shortest + 1),
        dead_states=sum(1 for s in dist if s not in to_goal),
        pass_lures=pass_lures,
        pass_traps=pass_traps,
        pass_slides=pass_slides,
        trap_options=trap_options,
        trap_lures=trap_lures,
        silent_trap_lures=silent_traps,
        reentries=reentries,
        wrap=wrap,
        funnel=funnel,
        entries=layers.get(1, 0),
        forks=forks,
        lure_steps=sum(lured),
        forced=forced,
        false_leads=false_leads,
        detours=sum(1 for i in run_starts if lured[i]),
        away_runs=len(run_starts),
        goal_rock_stop=0 <= bx < w and 0 <= by < g.height,
        rock_stops=rock_stops,
        relevant_rocks=g.relevant_rocks,
    )


Succ = dict[int, list[tuple[int, int]]]


def aligned(g: BoardGraph, a: int, b: int) -> bool:
    """a と b が同じ行・列にあり、間に岩が無い。"""
    w = g.width
    ax, ay, bx, by = a % w, a // w, b % w, b // w
    if ax == bx and ay != by:
        d = 2 if by > ay else 0
    elif ay == by and ax != bx:
        d = 1 if bx > ax else 3
    else:
        return a == b
    end = g.global_tables[d][a]
    ex, ey = end % w, end // w
    return (ey <= by, ex >= bx, ey >= by, ex <= bx)[d]


def lookahead_solves(
    succ: Succ,
    origin: int,
    targets: frozenset[int],
    score_of: Callable[[int], tuple[int, ...]],
    depth: int,
    limit: int,
    tie_order: Sequence[int],
) -> bool:
    """v1 の先読みプレイヤー（lookahead_solves）と同じ規則を、全点対の距離を作らずに行う。

    浅い読み深さだけを調べるので、各停止点から depth 手以内の停止点を小さい BFS で求める。"""
    balls: dict[tuple[int, int], set[int]] = {}

    def ball(node: int, radius: int) -> set[int]:
        key = (node, radius)
        found = balls.get(key)
        if found is None:
            found = {node}
            frontier = [node]
            for _ in range(radius):
                frontier = [e for s in frontier for _, e in succ.get(s, ()) if e not in found]
                found.update(frontier)
            balls[key] = found
        return found

    scores: dict[int, tuple[int, ...]] = {}

    def score(node: int) -> tuple[int, ...]:
        value = scores.get(node)
        if value is None:
            value = scores[node] = score_of(node)
        return value

    state = origin
    visited = {origin}
    for _ in range(limit):
        if not targets.isdisjoint(ball(state, depth)):
            return True
        best: tuple[tuple[int, ...], tuple[int, ...], int] | None = None
        best_end = -1
        for d, end in succ.get(state, ()):
            if end in visited:
                continue
            key = (min(score(t) for t in ball(end, depth - 1)), score(end), tie_order[d])
            if best is None or key < best:
                best, best_end = key, end
        if best is None:
            return False
        state = best_end
        visited.add(state)
    return False


def shallow_depth(g: BoardGraph, start: int, goal: int, max_depth: int) -> int:
    """v1 の読み深さ（human_depth: 前向き・逆向き・両方向の最小）を max_depth まで求める。
    max_depth でも読めなければ max_depth + 1。"""
    w = g.width
    shortest = g.dist[goal]
    limit = shortest + (shortest + 1) // 2 + 2
    to_goal = global_layers(g, goal)

    def gap_to(target: int) -> Callable[[int], int]:
        tx, ty = target % w, target // w
        return lambda s: abs(s % w - tx) + abs(s // w - ty)

    def toward(target: int, align: bool) -> Callable[[int], tuple[int, ...]]:
        gap = gap_to(target)
        if align:
            return lambda s: (0 if aligned(g, s, target) else 1, gap(s))
        return lambda s: (gap(s),)

    reverse: Succ = {node: list(moves) for node, moves in g.global_pred.items()}
    for depth in range(1, max_depth + 1):
        members = frozenset(s for s, d in to_goal.items() if d <= depth)
        gaps = [gap_to(m) for m in members]
        attempts = [
            (g.succ, start, frozenset((goal,)), toward(goal, False)),
            (g.succ, start, frozenset((goal,)), toward(goal, True)),
            (reverse, goal, frozenset((start,)), toward(start, False)),
            (reverse, goal, frozenset((start,)), toward(start, True)),
            (g.succ, start, members, lambda s, gaps=gaps: (min(gap(s) for gap in gaps),)),
        ]
        for succ, origin, targets, score_of in attempts:
            for order in TIE_ORDERS:
                if lookahead_solves(succ, origin, targets, score_of, depth, limit, order):
                    return depth
    return max_depth + 1


def board_tactics(board: Board, start: int, goal: int) -> Tactics:
    rock = [tile == ROCK for tile in board.cells]
    return tactics_of(board_graph(board.width, board.height, rock, start), start, goal)


# ---------------------------------------------------------------------------
# 手筋のタグ


TAG_RULES: dict[str, Callable[[Tactics], bool]] = {
    "止め石": lambda t: t.goal_rock_stop and t.entries <= 2,
    "回り込み": lambda t: t.wrap,
    "通過の誘い": lambda t: t.pass_lures >= 1,
    "入り直し": lambda t: t.reentries >= 1,
    "詰みの誘い": lambda t: t.trap_lures >= 1,
    "通過で詰む": lambda t: t.pass_traps >= 1,
    "知らせのない詰み": lambda t: t.silent_trap_lures >= 1,
    "遠回り": lambda t: t.detours >= 1,
    "遠回り2回": lambda t: t.detours >= 2,
    "逆算3段": lambda t: t.funnel >= 3,
    "分かれ道": lambda t: t.forks * 4 >= t.shortest,
}


def tags_of(t: Tactics) -> list[str]:
    return [name for name, rule in TAG_RULES.items() if rule(t)]


# ---------------------------------------------------------------------------
# 目的関数


@dataclass(frozen=True)
class Weights:
    """手筋の重みと、効き目の上限（その数を超えても点が増えない）。"""

    stopper: float = 0.0  # ゴールを岩で止め、入口が2つ以下
    pass_lure: float = 2.0
    pass_trap: float = 2.0
    trap_lure: float = 3.0
    silent_trap: float = 0.0
    reentry: float = 2.0
    wrap: float = 1.0
    funnel: float = 1.5
    false_lead: float = 1.5
    detour: float = 1.5
    fork: float = 0.5
    forced: float = 2.0
    near: float = 1.5
    optimal_paths: float = 2.0
    excess_rock: float = 0.3  # 関係する岩が盤面の ROCK_TARGET を超えた1個あたり
    # v1 の読み深さ（read_cap まで）1あたり。素朴な先読みで読めてしまう問題を下げる
    read: float = 1.5
    read_cap: int = 3
    cap_pass: int = 2
    cap_trap: int = 2
    cap_reentry: int = 2
    cap_funnel: int = 4
    cap_detour: int = 2
    cap_false_lead: int = 10
    # 必須のタグが無い・含めないタグがある1つあたりの罰。重みだけでは山登りが手筋を
    # 作り切れないので、採用条件そのものも目的関数に入れる
    required: tuple[str, ...] = ()
    forbidden: tuple[str, ...] = ()
    constraint: float = 6.0


ROCK_TARGET = 0.22
# タグを目的関数で強める・抑えるときに動かす重み
TAG_WEIGHT = {
    "止め石": "stopper",
    "回り込み": "wrap",
    "通過の誘い": "pass_lure",
    "入り直し": "reentry",
    "詰みの誘い": "trap_lure",
    "通過で詰む": "pass_trap",
    "知らせのない詰み": "silent_trap",
    "遠回り": "detour",
    "遠回り2回": "detour",
    "逆算3段": "funnel",
    "分かれ道": "fork",
}
REQUIRED_FACTOR = 2.0
# 既定の重みが0のタグを必須にしたときの重み
TAG_BASE_WEIGHT = {"stopper": 3.0, "silent_trap": 4.0}
FORBIDDEN_WEIGHT = -4.0


def weights_for(
    required: Sequence[str], forbidden: Sequence[str], base: Weights | None = None
) -> Weights:
    weights = base or Weights()
    changes: dict[str, float] = {}
    for tag in required:
        name = TAG_WEIGHT[tag]
        changes[name] = TAG_BASE_WEIGHT.get(name, getattr(weights, name) * REQUIRED_FACTOR)
    for tag in forbidden:
        changes[TAG_WEIGHT[tag]] = FORBIDDEN_WEIGHT
    return replace(weights, **changes, required=tuple(required), forbidden=tuple(forbidden))


def tactic_score(t: Tactics, wt: Weights, cells: int) -> float:
    excess = max(0.0, t.relevant_rocks - ROCK_TARGET * cells)
    return (
        wt.stopper * TAG_RULES["止め石"](t)
        + wt.pass_lure * min(t.pass_lures, wt.cap_pass)
        + wt.pass_trap * min(t.pass_traps, 1)
        + wt.trap_lure * min(t.trap_lures, wt.cap_trap)
        + wt.silent_trap * min(t.silent_trap_lures, 1)
        + wt.reentry * min(t.reentries, wt.cap_reentry)
        + wt.wrap * t.wrap
        + wt.funnel * min(t.funnel, wt.cap_funnel)
        + wt.false_lead * min(t.false_leads, wt.cap_false_lead)
        + wt.detour * min(t.detours, wt.cap_detour)
        + wt.fork * t.forks
        - wt.forced * t.forced
        - wt.near * t.near_states
        - wt.optimal_paths * math.log2(max(t.optimal_paths, 1))
        - wt.excess_rock * excess
        - wt.constraint * sum(not TAG_RULES[tag](t) for tag in wt.required)
        - wt.constraint * sum(TAG_RULES[tag](t) for tag in wt.forbidden)
    )


def evaluate_tactics(
    width: int, height: int, rock: Sequence[bool], start: int, lo: int, hi: int, wt: Weights
) -> Evaluation:
    """範囲 [lo, hi] の最短手数で止まれるゴールのうち、手筋の点が最もよいもの。

    長さには点を与えない。範囲に届かない盤面は長さだけで比べ、罰を与える。
    読み深さの点は重いので、手筋の点の高い順に、読み深さの点を足しても勝てないゴールは調べない。"""
    g = board_graph(width, height, rock, start)
    in_range = sorted(
        (s for s, d in g.dist.items() if lo <= d <= hi), key=lambda s: (-g.dist[s], s)
    )[:MAX_GOALS]
    if not in_range:
        return float(max(g.dist.values())) - 100.0, start, 0
    scored = sorted(
        ((tactic_score(tactics_of(g, start, goal), wt, width * height), goal) for goal in in_range),
        key=lambda item: -item[0],
    )
    read_bonus = wt.read * (wt.read_cap + 1)
    best: Evaluation | None = None
    for score, goal in scored:
        if best is not None and score + read_bonus <= best[0]:
            break
        if wt.read:
            score += wt.read * shallow_depth(g, start, goal, wt.read_cap)
        if best is None or score > best[0]:
            best = (score, goal, g.dist[goal])
    assert best is not None
    return best


class TacticSearcher(Searcher):
    def __init__(self, spec: SearchSpec, rng: random.Random, weights: Weights) -> None:
        super().__init__(spec, rng)
        self.weights = weights

    def objective(self, rock: list[bool], start: int) -> Evaluation:
        spec = self.spec
        return evaluate_tactics(
            spec.width, spec.height, rock, start, spec.min_shortest, spec.max_shortest, self.weights
        )

    def ceiling(self) -> float:
        return 0


# ---------------------------------------------------------------------------
# 生成と採用


@dataclass(frozen=True)
class Recipe:
    """1つの生成条件。required のタグをすべて含み、forbidden のタグを含まず、共通の条件
    （最短解が一意、一本道が最短手数の max_forced_share 以下、近い別解・読み深さ）を満たす
    問題を採用する。"""

    name: str
    shape: Shape
    lo: int
    hi: int
    required: tuple[str, ...] = ()
    forbidden: tuple[str, ...] = ()
    min_human_depth: int = 0
    max_human_depth: int = UNREAD - 1
    max_near_paths: int = 0  # 0 は上限なし
    weights: Weights | None = None  # None は required / forbidden から weights_for で作る
    iterations: int = 2000
    max_density: float = 0.34
    max_forced_share: float = 0.25

    @property
    def search_weights(self) -> Weights:
        return self.weights or weights_for(self.required, self.forbidden)

    @property
    def label(self) -> str:
        parts = [f"{self.shape.label} {self.lo}〜{self.hi}手"]
        if self.required:
            parts.append("+" + "・".join(self.required))
        if self.forbidden:
            parts.append("−" + "・".join(self.forbidden))
        if self.max_human_depth < UNREAD - 1:
            parts.append(f"読み{self.min_human_depth}〜{self.max_human_depth}")
        elif self.min_human_depth:
            parts.append(f"読み{self.min_human_depth}以上")
        if self.max_near_paths:
            parts.append(f"近い別解{self.max_near_paths}以下")
        return " ".join(parts)


@dataclass
class Made:
    recipe: str
    width: int
    height: int
    cells: str
    start: int
    goal: int
    score: float
    seconds: float
    tactics: Tactics
    features: Features | None
    tags: list[str]
    reasons: list[str]

    @property
    def board(self) -> Board:
        return Board(self.width, self.height, self.cells)

    @property
    def accepted(self) -> bool:
        return not self.reasons


def rejections(recipe: Recipe, t: Tactics, f: Features | None, tags: Sequence[str]) -> list[str]:
    reasons = [f"手筋が無い（{name}）" for name in recipe.required if name not in tags]
    reasons += [f"手筋を含む（{name}）" for name in recipe.forbidden if name in tags]
    if t.optimal_paths > 1:
        reasons.append("最短解が複数")
    if t.forced > recipe.max_forced_share * t.shortest:
        reasons.append("一本道")
    if f is not None:
        if recipe.max_near_paths and f.near_paths > recipe.max_near_paths:
            reasons.append("近い別解")
        if f.human_depth == UNREAD:
            reasons.append("読めない")
        elif not recipe.min_human_depth <= f.human_depth <= recipe.max_human_depth:
            reasons.append("読み深さ")
    return reasons


def make(recipe: Recipe, seed: str) -> Made:
    started = time.perf_counter()
    spec = SearchSpec(
        recipe.shape.width,
        recipe.shape.height,
        "hc",
        "tactics",
        recipe.iterations,
        max_density=recipe.max_density,
        min_shortest=recipe.lo,
        max_shortest=recipe.hi,
    )
    searcher = TacticSearcher(spec, random.Random(seed), recipe.search_weights)
    searcher.run()
    assert searcher.best is not None
    score, rock, start, goal, shortest = searcher.best
    board = normalize(to_board(spec.width, spec.height, rock), start)
    seconds = time.perf_counter() - started
    assert shortest, f"{recipe.label}: 範囲の最短手数に届かなかった"
    assert explore(board, start).dist[goal] == shortest, "explore() disagrees"
    tactics = board_tactics(board, start, goal)
    features = features_of(board, start, goal)
    tags = tags_of(tactics)
    return Made(
        recipe.name,
        spec.width,
        spec.height,
        board.cells,
        start,
        goal,
        score,
        seconds,
        tactics,
        features,
        tags,
        rejections(recipe, tactics, features, tags),
    )


def make_task(task: tuple[Recipe, str]) -> Made:
    return make(*task)


def v1_task(task: tuple) -> tuple[LevelResult, Tactics]:
    result = level_task(task)
    g = result.generated
    return result, board_tactics(g.board, g.start, g.goal)


def solution(board: Board, start: int, goal: int) -> str:
    """方向番号の小さい手を優先した最短の道筋（tactics_of と同じ道筋）。"""
    reach = explore(board, start)
    pred: dict[int, list[int]] = {s: [] for s in reach.dist}
    for s, moves in reach.succ.items():
        for _, end in moves:
            pred[end].append(s)
    to_goal = backward_layers(pred, goal)
    state, moves = start, []
    while state != goal:
        d, state = next(
            (d, end) for d, end in reach.succ[state] if to_goal.get(end) == to_goal[state] - 1
        )
        moves.append(DIRECTION_NAMES[d])
    return "".join(moves)


# ---------------------------------------------------------------------------
# 集計


def med(values: Sequence[float]) -> str:
    if not values:
        return "-"
    return f"{statistics.median(values):g}"


def share(count: int, total: int) -> str:
    return f"{count}/{total}"


COMPARE_TACTICS = (
    "shortest",
    "pass_slides",
    "pass_lures",
    "trap_options",
    "trap_lures",
    "silent_trap_lures",
    "dead_states",
    "reentries",
    "funnel",
    "entries",
    "forks",
    "false_leads",
    "detours",
    "forced",
    "near_states",
)
COMPARE_FEATURES = ("near_paths", "human_depth", "trial_moves", "decisions", "density")


def describe(
    label: str, tactics: Sequence[Tactics], features: Sequence[Features], seconds: Sequence[float]
) -> None:
    print(f"## {label}（{len(tactics)}問、1回 平均{statistics.mean(seconds):.2f}s）")
    print("  " + " ".join(f"{c}={med([getattr(t, c) for t in tactics])}" for c in COMPARE_TACTICS))
    print(
        "  " + " ".join(f"{c}={med([getattr(f, c) for f in features])}" for c in COMPARE_FEATURES)
    )
    counts = Counter(tag for t in tactics for tag in tags_of(t))
    print(
        "  タグ: " + " ".join(f"{name}={share(counts[name], len(tactics))}" for name in TAG_RULES)
    )
    print(
        "  ゴールを通過する滑りが0: "
        f"{share(sum(t.pass_slides == 0 for t in tactics), len(tactics))}"
        f" 詰みの停止点が0: {share(sum(t.dead_states == 0 for t in tactics), len(tactics))}"
    )


# ---------------------------------------------------------------------------
# suites


def run_verify(args: argparse.Namespace) -> None:
    """手筋の特徴量を、1マスずつ滑らせる独立の実装（供給実験の explore）と、
    浅い読み深さを v1 の features_of と突き合わせる。"""
    rng = random.Random(f"{args.seed}-tactic-verify")
    checked = mismatches = 0
    for _ in range(args.samples):
        shape = args.sizes[rng.randrange(len(args.sizes))]
        board = random_board(shape.width, shape.height, rng, 0.22)
        ice = [c for c, tile in enumerate(board.cells) if tile != ROCK]
        start = ice[rng.randrange(len(ice))]
        board = normalize(board, start)
        reach = explore(board, start)
        goals = [s for s, d in reach.dist.items() if d >= 3]
        if not goals:
            continue
        goal = goals[rng.randrange(len(goals))]
        t = board_tactics(board, start, goal)
        g = board_graph(board.width, board.height, [c == ROCK for c in board.cells], start)
        checked += 1
        alive = coreachable(reach, goal)
        slides = [slide(board, s, d) for s in reach.dist if s != goal for d in range(4)]
        expected_pass = sum(1 for r in slides if goal in r.path and r.end != goal)
        ok = (
            t.shortest == reach.dist[goal]
            and t.optimal_paths == count_shortest_paths(reach, goal)
            and t.dead_states == sum(1 for s in reach.dist if s not in alive)
            and t.pass_slides == expected_pass
            and shallow_depth(g, start, goal, 4)
            == min(features_of(board, start, goal).human_depth, 5)
        )
        mismatches += not ok
    print(f"checked={checked} mismatches={mismatches}")


def run_probe(args: argparse.Namespace) -> None:
    """1つの条件で、手筋の目的関数と、手筋も読み深さも点にしない目的関数を並べる。"""
    shape = args.sizes[0]
    lo, hi = args.range
    no_tactics = replace(
        Weights(),
        **{name: 0.0 for name in set(TAG_WEIGHT.values()) | {"false_lead", "near", "read"}},
    )
    for label, weights in (("手筋", Weights()), ("手筋なし", no_tactics)):
        recipe = Recipe(label, shape, lo, hi, weights=weights, iterations=args.iterations)
        tasks = [(recipe, f"{args.seed}-probe-{label}-{run}") for run in range(args.runs)]
        made: list[Made] = parallel(make_task, tasks, args.workers)
        describe(
            f"{recipe.label} {label}",
            [m.tactics for m in made],
            [m.features for m in made if m.features],
            [m.seconds for m in made],
        )


def run_compare(args: argparse.Namespace) -> None:
    """v1 の5段階の案（盤面・最短手数の範囲）ごとに、v1 の合成の目的関数と v2 の手筋の目的関数で
    作った問題の手筋を比べる。v1 は v1 の levels と同じ seed で作る。v2 も最短手数の上限を
    試行ごとに範囲内で回し、長さの分布を v1 に揃える。"""
    plans = [plan for plan in LEVEL_PLANS if plan.level in args.levels]
    v1_tasks = [
        (plan, f"{args.seed}-levels-{plan.level}-{run}", run)
        for plan in plans
        for run in range(args.runs)
    ]
    v1_results: list[tuple[LevelResult, Tactics]] = parallel(v1_task, v1_tasks, args.workers)
    v2_tasks = []
    for plan in plans:
        for run in range(args.runs):
            cap = plan.min_shortest + run % (plan.max_shortest - plan.min_shortest + 1)
            recipe = Recipe(
                f"L{plan.level}",
                plan.shape,
                max(plan.min_shortest, cap - 1),
                cap,
                iterations=args.iterations,
            )
            v2_tasks.append((recipe, f"{args.seed}-compare-{plan.level}-{run}"))
    v2_results: list[Made] = parallel(make_task, v2_tasks, args.workers)
    for plan in plans:
        v1 = [(r, t) for r, t in v1_results if r.level == plan.level]
        v2 = [m for m in v2_results if m.recipe == f"L{plan.level}"]
        describe(
            f"v1 {plan.label}",
            [t for _, t in v1],
            [r.features for r, _ in v1],
            [r.generated.seconds for r, _ in v1],
        )
        print(f"  v1 の採用条件に合う: {share(sum(r.accepted for r, _ in v1), len(v1))}")
        describe(
            f"v2 {plan.shape.label} {plan.min_shortest}〜{plan.max_shortest}",
            [m.tactics for m in v2],
            [m.features for m in v2 if m.features],
            [m.seconds for m in v2],
        )
        v1_ok = sum(
            plan.min_human_depth <= m.features.human_depth <= plan.max_human_depth
            and m.tactics.forced <= plan.max_forced_share * m.tactics.shortest
            and m.tactics.optimal_paths <= plan.max_optimal_paths
            for m in v2
            if m.features
        )
        print(f"  v1 の採用条件に合う: {share(v1_ok, len(v2))}")


@dataclass(frozen=True)
class Level:
    level: int
    idea: str
    recipe: Recipe


# 上の段の手筋（回り込み・通過の誘い・詰みの誘い・逆算）を含めない
L1_FORBIDDEN = ("回り込み", "通過の誘い", "詰みの誘い", "逆算3段")
L5_TAGS = ("逆算3段", "詰みの誘い", "知らせのない詰み", "通過の誘い", "入り直し", "分かれ道")
LEVELS: tuple[Level, ...] = (
    Level(
        1,
        "止め石を1つ使う",
        Recipe(
            "L1",
            Shape(8, 8),
            7,
            10,
            required=("止め石",),
            forbidden=L1_FORBIDDEN,
            max_human_depth=2,
            weights=replace(weights_for(("止め石",), L1_FORBIDDEN), read=0.0),
        ),
    ),
    Level(
        2,
        "入口へ回り込む",
        Recipe(
            "L2",
            Shape(10, 10),
            9,
            13,
            required=("止め石", "回り込み"),
            forbidden=("詰みの誘い",),
            min_human_depth=2,
            max_near_paths=30,
        ),
    ),
    Level(
        3,
        "通過の誘い＋遠回り1回",
        Recipe(
            "L3",
            Shape(10, 10),
            12,
            16,
            required=("通過の誘い", "入り直し", "遠回り"),
            forbidden=("詰みの誘い",),
            min_human_depth=3,
            max_near_paths=40,
        ),
    ),
    Level(
        4,
        "詰みの誘い手＋遠回り2回",
        Recipe(
            "L4",
            Shape(12, 12),
            15,
            21,
            required=("詰みの誘い", "知らせのない詰み", "通過の誘い", "遠回り2回"),
            min_human_depth=4,
            max_near_paths=80,
        ),
    ),
    Level(
        5,
        "3段以上の逆算＋誘い手の組み合わせ",
        Recipe(
            "L5",
            Shape(12, 14),
            18,
            26,
            required=L5_TAGS,
            min_human_depth=5,
            max_near_paths=120,
            weights=replace(weights_for(L5_TAGS, ()), read_cap=5),
        ),
    ),
)


def run_levels(args: argparse.Namespace) -> None:
    """v2 の5段階の案ごとに、採用率・1問あたりの時間・特徴量の分布を測る。"""
    levels = [lv for lv in LEVELS if lv.level in args.levels]
    tasks = []
    for lv in levels:
        r = lv.recipe
        for run in range(args.runs):
            cap = r.lo + run % (r.hi - r.lo + 1)
            recipe = replace(r, lo=max(r.lo, cap - 1), hi=cap)
            tasks.append((recipe, f"{args.seed}-v2-levels-{lv.level}-{run}"))
    made: list[Made] = parallel(make_task, tasks, args.workers)
    for lv in levels:
        ms = [m for m in made if m.recipe == lv.recipe.name]
        ok = [m for m in ms if m.accepted]
        keys = {canonical_key(m.board, m.start, m.goal) for m in ok}
        seconds = [m.seconds for m in ms]
        rate = len(ok) / len(ms)
        per_problem = statistics.mean(seconds) / rate if rate else float("inf")
        print(
            f"# L{lv.level} {lv.idea}: {lv.recipe.label}\n"
            f"  採用 {len(ok)}/{len(ms)}（同型除き {len(keys)}） "
            f"1回 平均{statistics.mean(seconds):.2f}s"
            f"（90%点 {percentile(seconds, 0.9):.2f}s） → 1問 {per_problem:.2f}s、"
            f"500問 {per_problem * 500 / 60:.1f}分（1コア）"
        )
        print(f"  外れた理由: {dict(Counter(reason for m in ms for reason in m.reasons))}")
        if ok:
            describe(
                f"L{lv.level} 採用",
                [m.tactics for m in ok],
                [m.features for m in ok if m.features],
                [m.seconds for m in ok],
            )


# 試遊候補の手筋の組み合わせ（必須のタグ, 含めないタグ, 読み深さの下限）
COMBOS: dict[str, tuple[tuple[str, ...], tuple[str, ...], int]] = {
    "止め石だけ": (("止め石",), ("通過の誘い", "詰みの誘い", "入り直し"), 0),
    "回り込み": (("止め石", "回り込み"), ("詰みの誘い",), 2),
    "通過の誘い・入り直し": (("通過の誘い", "入り直し"), ("詰みの誘い",), 3),
    "詰みの誘い": (("詰みの誘い", "知らせのない詰み"), ("通過の誘い",), 3),
    "通過で詰む": (("通過の誘い", "通過で詰む"), (), 3),
    "逆算・分かれ道": (("逆算3段", "分かれ道"), (), 3),
    "詰み・遠回り2回・入り直し": (
        ("詰みの誘い", "知らせのない詰み", "遠回り2回", "入り直し"),
        (),
        4,
    ),
    "全部入り": (
        ("逆算3段", "通過の誘い", "詰みの誘い", "知らせのない詰み", "入り直し", "回り込み"),
        (),
        4,
    ),
}

# 試遊候補 20問の (盤面, 最短手数の範囲, 手筋の組み合わせ)
CANDIDATE_PLAN: tuple[tuple[Shape, int, int, str], ...] = (
    (Shape(8, 8), 8, 9, "止め石だけ"),
    (Shape(8, 8), 9, 10, "回り込み"),
    (Shape(8, 8), 10, 11, "通過の誘い・入り直し"),
    (Shape(8, 8), 11, 12, "詰みの誘い"),
    (Shape(10, 10), 11, 12, "通過で詰む"),
    (Shape(10, 10), 12, 13, "逆算・分かれ道"),
    (Shape(10, 10), 13, 14, "回り込み"),
    (Shape(10, 10), 14, 15, "詰み・遠回り2回・入り直し"),
    (Shape(10, 13), 15, 16, "通過の誘い・入り直し"),
    (Shape(10, 13), 16, 17, "詰みの誘い"),
    (Shape(10, 13), 17, 18, "全部入り"),
    (Shape(12, 12), 18, 19, "通過で詰む"),
    (Shape(12, 12), 19, 20, "逆算・分かれ道"),
    (Shape(12, 12), 20, 21, "止め石だけ"),
    (Shape(12, 12), 21, 22, "詰み・遠回り2回・入り直し"),
    (Shape(10, 13), 22, 23, "通過の誘い・入り直し"),
    (Shape(12, 12), 24, 25, "全部入り"),
    (Shape(12, 14), 26, 27, "詰みの誘い"),
    (Shape(12, 14), 28, 29, "逆算・分かれ道"),
    (Shape(12, 14), 29, 30, "回り込み"),
)
# 長い問題は採用率が低いので、この最短手数の上限以上の条件は --runs の3倍作る
LONG_CANDIDATE = 22


def candidate_recipes() -> list[Recipe]:
    recipes = []
    for index, (shape, lo, hi, combo) in enumerate(CANDIDATE_PLAN):
        required, forbidden, depth = COMBOS[combo]
        recipes.append(
            Recipe(
                f"{index:02d} {combo}",
                shape,
                lo,
                hi,
                required=required,
                forbidden=forbidden,
                min_human_depth=depth,
                max_near_paths=4 * hi,
            )
        )
    return recipes


def display_tags(tags: Sequence[str]) -> list[str]:
    return [tag for tag in tags if not (tag == "遠回り" and "遠回り2回" in tags)]


def candidate_entry(m: Made) -> dict:
    board = m.board
    reach = explore(board, m.start)
    shortest = reach.dist[m.goal]
    assert shortest == m.tactics.shortest and count_shortest_paths(reach, m.goal) == 1
    w = m.width
    return {
        "width": m.width,
        "height": m.height,
        "rows": rows_of(board),
        "start": [m.start % w, m.start // w],
        "goal": [m.goal % w, m.goal // w],
        "optimal": shortest,
        "tactics": display_tags(m.tags),
        "features": {
            "solution": solution(board, m.start, m.goal),
            "recipe": m.recipe,
            **asdict(m.tactics),
            **{k: v for k, v in asdict(m.features).items() if k != "shortest"},
        },
    }


def run_candidates(args: argparse.Namespace) -> None:
    """試遊候補 20問。条件ごとに --runs 回作り、採用した問題のうち目的関数の点が
    最もよいものを採る。"""
    recipes = candidate_recipes()
    tasks = [
        (recipe, f"{args.seed}-candidates-{recipe.name}-{run}")
        for recipe in recipes
        for run in range(args.runs * (3 if recipe.hi >= LONG_CANDIDATE else 1))
    ]
    made: list[Made] = parallel(make_task, tasks, args.workers)
    chosen: list[Made] = []
    for recipe in recipes:
        ms = [m for m in made if m.recipe == recipe.name]
        ok = sorted((m for m in ms if m.accepted), key=lambda m: -m.score)
        print(
            f"{recipe.name}: {recipe.label} 採用 {len(ok)}/{len(ms)} "
            f"外れた理由 {dict(Counter(reason for m in ms for reason in m.reasons))}"
        )
        if ok:
            chosen.append(ok[0])
    order = list(range(len(chosen)))
    random.Random(f"{args.seed}-candidate-order").shuffle(order)
    output = []
    for number, index in enumerate(order, 1):
        m = chosen[index]
        entry = {"id": f"q{number:02d}", **candidate_entry(m)}
        output.append(entry)
        f, t = m.features, m.tactics
        assert f is not None
        print(
            f"\n{entry['id']} {m.width}x{m.height} 最短{t.shortest} "
            f"[{'・'.join(entry['tactics'])}] "
            f"（{m.recipe}）\n  読み{f.human_depth}（前{f.forward_depth}/逆{f.backward_depth}/"
            f"両{f.bidir_depth}） 試行{f.trial_moves} 近い別解{f.near_paths} 一本道{t.forced} "
            f"通過の誘い{t.pass_lures} 詰みの誘い{t.trap_lures}（知らせなし{t.silent_trap_lures}） "
            f"入り直し{t.reentries} "
            f"逆算{t.funnel} 分かれ道{t.forks} 遠回り{t.detours} 岩{f.density}"
        )
        for line in render_marked(m.board, m.start, m.goal):
            print("    " + line)
        print("    解: " + entry["features"]["solution"])
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(output)} problems to {args.output}")


def main_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("verify", "probe", "compare", "levels", "candidates"))
    parser.add_argument("--sizes", type=parse_shape, nargs="+", default=[Shape(12, 14)])
    parser.add_argument(
        "--range",
        type=lambda text: tuple(int(x) for x in text.split("-")),
        default=(22, 30),
        help="probe の最短手数の範囲（例: 22-30）",
    )
    parser.add_argument("--iterations", type=int, default=2000)
    parser.add_argument("--runs", type=int, default=16)
    parser.add_argument("--samples", type=int, default=300)
    parser.add_argument("--levels", type=int, nargs="+", default=[1, 2, 3, 4, 5])
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--output", default="/tmp/v2-candidates.json")
    return parser.parse_args()


def main() -> None:
    args = main_args()
    suites: dict[str, Callable[[argparse.Namespace], None]] = {
        "verify": run_verify,
        "probe": run_probe,
        "compare": run_compare,
        "levels": run_levels,
        "candidates": run_candidates,
    }
    suites[args.suite](args)


if __name__ == "__main__":
    main()
