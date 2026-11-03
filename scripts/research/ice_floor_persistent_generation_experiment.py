"""氷の床迷路（作業名）の生成 v5: 一回でなくならない要素（踏み固まる雪・滑る岩）の試作。

試遊記録の分析で、人の難しさを生むのは「初期盤面に無い止め役を自分の手で作り、それに何手も後で
頼ること」だと分かった。v4 の要素のうちそれを作れるのは薄い氷だけで、もろい岩（崩れて消える）と
v3 の雪（溶けて消える）は一回でなくなるので作れない。v5 は、雪と岩を一回でなくならない形に作り直し、
「自作依存の点」を主項にした目的関数で山登りして、薄い氷だけの場合と比べる。

規則（盤面の文字）:
- ``#`` 岩、``x`` 盤面の外、外壁: 止め役。``.`` 氷: 滑れる。
- ``c`` 薄い氷: v4 と同じ。滑りの出発マスと途中で通過したマスは、その滑りの後で水面（止め役）に
  なる。
- ``s`` 雪（踏み固まる雪）: 滑っている駒は雪のマスに入るとそこで止まる。駒がそこから動いた滑りの
  後で、そのマスは踏み固められた雪の塊になり、止め役として残る（岩と同じ）。開始位置・ゴールにしない。
- ``m`` 滑る岩: 止め役。駒が1マス以上滑ってきて滑る岩の手前で止まると、その滑りの後で、滑る岩は同じ
  向きに次の止め役（岩・外壁・盤面の外・水面・雪・踏み固まった雪・ほかの滑る岩）の手前まで滑って止まる
  （1マスも動けなければ動かない）。ゴールの上は通過・停止してよく、ゴールの上にある間は駒がゴールへ
  入れない（その岩をまた押せばどく）。薄い氷の上は割らずに通過・停止する。
- 動かない入力は手にならない（何も変化しない）。

自作依存の点（試遊記録の分析と同じ定義を、作った止め役・通り道の種類に広げたもの）:
  2×varied_stop + 1×(varied_use − varied_stop) + 0.5×quick_return + 2×goal_stop_self
マスのふるまい（通れる・入ると止まる・止め役）が初期盤面と違うマスを自分の手で作ったものとみなす。
水面・踏み固まった雪・押して動かした滑る岩で止まるのは「自作の止め役で止まる」、滑る岩をどかして
空いたマスを通る・そこで止まるのは「自作の通り道を使う」。

Python標準ライブラリだけを使う。乱数はすべて seed と条件名から作り、結果を再現可能にする。
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
from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from itertools import pairwise
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_RESEARCH = (
    _HERE
    if (_HERE / "ice_floor_hardest_generation_experiment.py").exists()
    else Path("/home/user/pa-zzle/scripts/research")
)
sys.path.insert(0, str(_RESEARCH))

from ice_floor_difficulty_experiment import Shape  # noqa: E402
from ice_floor_dynamic_generation_experiment import (  # noqa: E402
    Graph,
    Puzzle,
    StaticResult,
    canonical_solution,
    count_plans,
    dynamic_depth,
    replay,
    reverse_layers,
    with_goal,
)
from ice_floor_hard_generation_experiment import parallel, stop_tables  # noqa: E402
from ice_floor_hardest_generation_experiment import (  # noqa: E402
    DETOUR,
    FALSE_LEAD_COST,
    NEAR_SLACK,
    Effect,
    option_profile,
    solution_options,
)
from ice_floor_supply_experiment import DX, DY, ICE, ROCK  # noqa: E402

THIN = "c"
SNOW = "s"
SLIDER = "m"
OUTSIDE = "x"
FLOOR = "f"  # 中立化した雪（入ると止まるが固まらない床）。生成の内部だけで使う
WATER = "w"  # 1マスずつの実装だけが使う
PACKED = "S"  # 同上（踏み固まった雪）
ELEMENT_TILES = (THIN, SNOW, SLIDER)
NEUTRAL = {THIN: ICE, SNOW: FLOOR, SLIDER: ROCK}  # 変化しないとみなした見た目どおりの形
OTHER = {THIN: ROCK, SNOW: ROCK, SLIDER: ICE}  # 変化した後の形（もう一方の静的盤面）
# slider は滑る岩の修正案（押し進む: 駒は岩を押しながら一緒に滑り、岩の止まった手前で止まる）、
# slider_kick は最初の案（駒は岩の手前で止まり、岩だけが滑っていく）。
# snow は押し出す雪（v6）、snow_pack は踏み固まる雪（v5）。
VARIANTS = (
    "snow",
    "slider",
    "snow_thin",
    "slider_thin",
    "thin",
    "slider_kick",
    "slider_kick_thin",
    "snow_pack",
    "snow_pack_thin",
)
VARIANT_TILES = {
    "snow_pack": (SNOW,),
    "snow_pack_thin": (SNOW, THIN),
    "snow": (SNOW,),
    "slider": (SLIDER,),
    "snow_thin": (SNOW, THIN),
    "slider_thin": (SLIDER, THIN),
    "thin": (THIN,),
    "slider_kick": (SLIDER,),
    "slider_kick_thin": (SLIDER, THIN),
}
VARIANT_LABEL = {
    "snow_pack": "雪（踏み固まる案）",
    "snow_pack_thin": "雪（踏み固まる案）＋薄い氷",
    "snow": "雪",
    "slider": "滑る岩",
    "snow_thin": "雪＋薄い氷",
    "slider_thin": "滑る岩＋薄い氷",
    "thin": "薄い氷",
    "slider_kick": "滑る岩（最初の案）",
    "slider_kick_thin": "滑る岩（最初の案）＋薄い氷",
}
TILE_LABEL = {THIN: "薄い氷", SNOW: "雪", SLIDER: "滑る岩"}
STATE_CAP = 20000
MAX_GOALS = 4
POLISH_EVERY = 400
DYN_DEPTH_CAP = 8
PASS, STOPIN, BLOCK = 0, 1, 2


# ---------------------------------------------------------------------------
# 規則


class Rules:
    """状態は mask * n + 駒の位置。mask の下位 E ビットは薄い氷（割れた）・雪のビット、その上の
    n ビットは滑る岩のあるマス（区別しない）。雪は、押し出す雪（plow）では1つにつき3ビット
    （押し出したか・押し出した向き2ビット）、踏み固まる雪（pack）では1ビット（固まったか）。
    手は方向番号（0=上, 1=右, 2=下, 3=左）。

    v3 の BFS・最短解・再生の関数（Graph を使うもの）と v4 の選択肢の関数にそのまま渡せる形に
    してある（tables(mask) が今の盤面の滑りの表を返す）。"""

    variant = "v5"

    def __init__(
        self, width: int, height: int, cells: str, carry: bool = True, plow: bool = True
    ) -> None:
        self.carry = carry  # 滑る岩を押し進む（修正案）か、岩だけが滑っていく（最初の案）か
        self.plow = plow  # 雪を押し出す（v6）か、踏み固める（v5）か
        self.width = width
        self.height = height
        self.n = n = width * height
        self.cells = cells
        self.base_rock = [t in (ROCK, OUTSIDE) for t in cells]
        self.base_floor = [t == FLOOR for t in cells]
        self.elements = [c for c, t in enumerate(cells) if t in ELEMENT_TILES]
        self.kinds = [cells[c] for c in self.elements]
        self.element_of = [-1] * n
        for j, cell in enumerate(self.elements):
            self.element_of[cell] = j
        bit_cells = [c for c in self.elements if cells[c] in (THIN, SNOW)]
        self.bit_at = [-1] * n
        b = 0
        for c in bit_cells:
            self.bit_at[c] = b
            b += 3 if plow and cells[c] == SNOW else 1
        self.E = b
        self.thin_bits = sum(1 << self.bit_at[c] for c in bit_cells if cells[c] == THIN)
        self.snow_bits = sum(1 << self.bit_at[c] for c in bit_cells if cells[c] == SNOW)
        self.thin_cells = [c for c in bit_cells if cells[c] == THIN]
        self.snow_cells = [c for c in bit_cells if cells[c] == SNOW]
        self.homes = [c for c in self.elements if cells[c] == SLIDER]
        self.occ0 = sum(1 << c for c in self.homes)
        # 要素 j の変化: 薄い氷・雪はビット、滑る岩は「元のマスに岩が無い」
        self.elem_bit = [self.bit_at[c] if cells[c] != SLIDER else -1 for c in self.elements]
        self.beyond = [
            [
                (y + DY[d]) * width + x + DX[d]
                if 0 <= x + DX[d] < width and 0 <= y + DY[d] < height
                else -1
                for y in range(height)
                for x in range(width)
            ]
            for d in range(4)
        ]
        self.delta = tuple(DY[d] * width + DX[d] for d in range(4))
        self._tables: dict[int, tuple] = {}
        self._changed: dict[int, int] = {}

    # --- 盤面 ---
    def layers(self, mask: int) -> tuple[list[bool], list[bool]]:
        """今の盤面の止め役（rock）と、入ると止まるマス（floor）。"""
        rock = list(self.base_rock)
        floor = list(self.base_floor)
        for c in self.thin_cells:
            if mask >> self.bit_at[c] & 1:
                rock[c] = True
        for c in self.snow_cells:
            b = self.bit_at[c]
            if not mask >> b & 1:
                floor[c] = True
            elif self.plow:
                rock[self.beyond[mask >> (b + 1) & 3][c]] = True  # 押し出した雪山
            else:
                rock[c] = True  # 踏み固まった雪
        occ = mask >> self.E
        while occ:
            low = occ & -occ
            rock[low.bit_length() - 1] = True
            occ ^= low
        return rock, floor

    def entry(self, mask: int) -> tuple:
        found = self._tables.get(mask)
        if found is None:
            rock, floor = self.layers(mask)
            tables = stop_tables(self.width, self.height, rock, floor)
            kinds = [
                BLOCK if r else STOPIN if f else PASS for r, f in zip(rock, floor, strict=True)
            ]
            found = self._tables[mask] = (tables, rock, floor, kinds)
        return found

    def tables(self, mask: int) -> tuple[list[int], ...]:
        return self.entry(mask)[0]

    def kinds_of(self, mask: int) -> list[int]:
        return self.entry(mask)[3]

    def initial(self, start: int, partner: int = -1) -> int:
        return (self.occ0 << self.E) * self.n + start

    def changed(self, mask: int) -> int:
        """要素ごとの「変化した」ビット（要素の番号 j）。"""
        found = self._changed.get(mask)
        if found is None:
            found = 0
            occ = mask >> self.E
            for j, cell in enumerate(self.elements):
                b = self.elem_bit[j]
                if b >= 0:
                    found |= (mask >> b & 1) << j
                elif not occ >> cell & 1:
                    found |= 1 << j
            self._changed[mask] = found
        return found

    def rock_slide(self, rock: list[bool], floor: list[bool], occ: int, hit: int, d: int) -> int:
        """hit の滑る岩が向き d に滑って止まるマス（動けなければ hit）。"""
        beyond = self.beyond[d]
        cur = hit
        while True:
            nxt = beyond[cur]
            if nxt < 0 or rock[nxt] or floor[nxt] or occ >> nxt & 1:
                return cur
            cur = nxt

    def moves(self, state: int) -> list[tuple[int, int]]:
        n, E = self.n, self.E
        pos, mask = state % n, state // n
        tables, rock, floor, _ = self.entry(mask)
        bit_at = self.bit_at
        out = []
        for d in range(4):
            end = tables[d][pos]
            if end == pos:
                continue
            after = mask
            b = bit_at[end]
            if self.plow and b >= 0 and self.snow_bits >> b & 1 and not mask >> b & 1:
                # 押し出す雪: 1マス先へ押し出せれば雪山にして駒は雪のマスで止まる。
                # 押し出せなければ雪は動かず、駒は雪の手前で止まる（雪が止め役）
                ahead = self.beyond[d][end]
                if ahead < 0 or rock[ahead] or floor[ahead]:
                    end -= self.delta[d]
                    if end == pos:
                        continue
                else:
                    after |= (1 | d << 1) << b
            elif self.homes and not floor[end]:
                hit = self.beyond[d][end]
                if hit >= 0 and mask >> (E + hit) & 1:
                    occ = mask >> E
                    dest = self.rock_slide(rock, floor, occ, hit, d)
                    if dest != hit:
                        after = after ^ (1 << (E + hit)) ^ (1 << (E + dest))
                        if self.carry:
                            # 押し進む: 駒は岩の止まったマスの手前まで一緒に滑り、通った薄い氷を割る
                            end = dest - self.delta[d]
            if self.thin_bits:
                cell, step = pos, self.delta[d]
                while cell != end:
                    b = bit_at[cell]
                    if b >= 0 and self.thin_bits >> b & 1:
                        after |= 1 << b
                    cell += step
            if self.snow_bits and not self.plow:
                b = bit_at[pos]
                if b >= 0 and self.snow_bits >> b & 1:
                    after |= 1 << b
            out.append((d, after * n + end))
        return out

    def path(self, pos: int, end: int, d: int) -> list[int]:
        cells = [pos]
        while cells[-1] != end:
            cells.append(cells[-1] + self.delta[d])
        return cells

    def events(self, state: int, move: int, target: int) -> list[str]:
        """1手の出来事（表示用）。crack: 薄い氷を割る、stop_on_water: 水面で止まる、plow: 雪を押し
        出して雪のマスで止まる、snow_stuck: 押し出せない雪の手前で止まる、stop_on_pile: 押し出した
        雪山で止まる、pass_cleared: 雪をどけた跡を通る、enter_snow: 雪に入って止まる（踏み固める
        雪）、pack: 雪を踏み固める、stop_on_packed: 踏み固めた雪で止まる、push: 滑る岩を
        押して動かす（push_moved は前に動かした岩をまた動かす）、push_stuck: 押したが動かない、
        stop_on_moved: 動かした滑る岩で止まる、pass_vacated: 滑る岩が元あったマスを通る・そこで
        止まる。"""
        n, E = self.n, self.E
        pos, end, mask, tmask = state % n, target % n, state // n, target // n
        d = move
        kinds = self.kinds_of(mask)
        found = []
        cells = self.path(pos, end, d)
        for c in cells[:-1]:
            if self.cells[c] == THIN:
                found.append(f"crack:{self.element_of[c]}")
        if self.cells[pos] == SNOW and not self.plow:
            found.append(f"pack:{self.element_of[pos]}")
        if kinds[end] == STOPIN and self.cells[end] == SNOW:
            found.append(f"{'plow' if self.plow else 'enter_snow'}:{self.element_of[end]}")
        for c in cells[1:]:
            if self.cells[c] == SNOW and kinds[c] == PASS:
                found.append(f"pass_cleared:{self.element_of[c]}")
        hit = self.beyond[d][end]
        if kinds[end] != STOPIN and hit >= 0:
            t = self.cells[hit]
            if t == THIN and kinds[hit] == BLOCK:
                found.append(f"stop_on_water:{self.element_of[hit]}")
            if t == SNOW and kinds[hit] == BLOCK:
                found.append(f"stop_on_packed:{self.element_of[hit]}")
            if t == SNOW and kinds[hit] == STOPIN and self.plow:
                found.append(f"snow_stuck:{self.element_of[hit]}")
            if self.plow and kinds[hit] == BLOCK and t not in (ROCK, OUTSIDE, THIN, SLIDER):
                if not mask >> (E + hit) & 1:
                    found.append(f"stop_on_pile:{hit}")
            if mask >> (E + hit) & 1 and tmask >> (E + hit) & 1:
                if t != SLIDER:
                    found.append(f"stop_on_moved:{hit}")
                found.append("push_stuck")
        o1, o2 = mask >> E, tmask >> E
        if o1 != o2:
            moved = (o1 & ~o2).bit_length() - 1
            found.append("push" if self.cells[moved] == SLIDER else "push_moved")
        for c in cells[1:]:
            if self.cells[c] == SLIDER and not mask >> (E + c) & 1:
                found.append(f"pass_vacated:{self.element_of[c]}")
        return found


def is_carry(variant: str) -> bool:
    return "kick" not in variant


def is_plow(variant: str) -> bool:
    return "pack" not in variant


def rules_of(p: Puzzle) -> Rules:
    return Rules(p.width, p.height, p.cells, is_carry(p.variant), is_plow(p.variant))


def explore(rules: Rules, start: int, goal: int = -1, cap: int = STATE_CAP) -> Graph | None:
    """状態の BFS（上限を超えれば None）。start は駒の位置（初期の状態は rules.initial）。"""
    n = rules.n
    s0 = rules.initial(start)
    dist = {s0: 0}
    order = [s0]
    succ: dict[int, list[tuple[int, int]]] = {}
    for state in order:
        if state % n == goal:
            succ[state] = []
            continue
        out = rules.moves(state)
        succ[state] = out
        step = dist[state] + 1
        for _, nxt in out:
            if nxt not in dist:
                dist[nxt] = step
                order.append(nxt)
                if len(order) > cap:
                    return None
    return Graph(rules, s0, goal, dist, order, succ)


def neutral_cells(cells: str, only: int = -1) -> str:
    if only >= 0:
        return cells[:only] + NEUTRAL[cells[only]] + cells[only + 1 :]
    return "".join(NEUTRAL.get(t, t) for t in cells)


# ---------------------------------------------------------------------------
# 自作依存（試遊記録の分析の dependency_trace を、マスのふるまいの変化で一般化したもの）


@dataclass(frozen=True)
class SelfDep:
    varied_stop: int
    varied_use: int
    quick_return: int
    goal_stop_self: int
    uses: int  # 自作の止め役・通り道を使う回数（quick_return を含む）
    dep_moves: int
    lag_sum: int
    pending_max: int
    reused: int
    by_kind: dict[str, int]  # 使った自作の止め役・通り道の種類ごとの回数
    one_cell: int
    zigzag: int
    reversals: int

    @property
    def score(self) -> float:
        return (
            2 * self.varied_stop
            + (self.varied_use - self.varied_stop)
            + 0.5 * self.quick_return
            + 2 * self.goal_stop_self
        )


def dependency_trace(rules: Rules, start: int, solution: Sequence[int]) -> list[dict]:
    """解を再生し、各手が頼る「初期盤面とふるまいの違うマス」と、それを作った手を返す。"""
    n = rules.n
    state = rules.initial(start)
    k0 = rules.kinds_of(state // n)
    cell_at: dict[int, int] = {}
    trace = []
    for i, d in enumerate(solution):
        target = dict(rules.moves(state))[d]
        pos, end = state % n, target % n
        ks, kt = rules.kinds_of(state // n), rules.kinds_of(target // n)
        cells = rules.path(pos, end, d)[1:]
        deps = []
        for c in cells[:-1]:
            if k0[c] != PASS:
                deps.append(("pass", c, cell_at.get(c)))
        if k0[end] != ks[end]:
            deps.append(("pass", end, cell_at.get(end)))
        stopper = -1
        if ks[end] != STOPIN:
            stopper = rules.beyond[d][end]
            if stopper >= 0 and k0[stopper] != BLOCK:
                deps.append(("stop", stopper, cell_at.get(stopper)))
        if rules.carry and rules.homes:
            # 押し進む: 自分で動かした岩をもう一度押して運ぶのも、自作の止め役を使う手とみなす
            o1, o2 = (state // n) >> rules.E, (target // n) >> rules.E
            if o1 != o2:
                hit = (o1 & ~o2).bit_length() - 1
                if k0[hit] != BLOCK:
                    deps.append(("stop", hit, cell_at.get(hit)))
        deps = [x for x in deps if x[2] is not None]
        changes = [c for c in range(n) if ks[c] != kt[c]]
        for c in changes:
            cell_at[c] = i
        trace.append(
            dict(move=d, frm=pos, to=end, path=cells, deps=deps, stopper=stopper, changes=changes)
        )
        state = target
    return trace


def selfdep_of(rules: Rules, start: int, solution: Sequence[int]) -> SelfDep:
    tr = dependency_trace(rules, start, solution)
    opt = len(solution)
    deps = [(j, i, k, c) for i, st in enumerate(tr) for (k, c, j) in st["deps"]]
    uses = {(i, c): (j, k) for j, i, k, c in deps}
    quick = sum(1 for (i, _), (j, k) in uses.items() if k == "stop" and i - j == 1)
    varied_stop = sum(1 for (i, _), (j, k) in uses.items() if k == "stop" and i - j >= 2)
    goal_stop_self = int(any(k == "stop" for k, _, _ in tr[-1]["deps"])) if tr else 0
    by_kind: Counter[str] = Counter()
    for (_, c), (_, k) in uses.items():
        tile = rules.cells[c]
        snow = "雪をどけた跡" if rules.plow else "固まった雪"
        moved = "雪山" if rules.plow and not rules.homes else "動かした岩"
        if rules.plow and rules.homes and rules.snow_cells:
            moved = "動かした岩・雪山"
        name = {THIN: "水面", SNOW: snow, SLIDER: "岩の跡"}.get(tile, moved)
        by_kind[f"{k}:{name}"] += 1
    last_use: dict[tuple[int, int], int] = {}
    for j, i, _, c in deps:
        last_use[(j, c)] = max(last_use.get((j, c), -1), i)
    pend = [sum(1 for (j, _), u in last_use.items() if j <= t < u) for t in range(opt)]
    cc = Counter((j, c) for j, _, _, c in deps)
    dirs = list(solution)
    return SelfDep(
        varied_stop=varied_stop,
        varied_use=len(uses) - quick,
        quick_return=quick,
        goal_stop_self=goal_stop_self,
        uses=len(uses),
        dep_moves=len({i for _, i, _, _ in deps}),
        lag_sum=sum(i - j for j, i, _, _ in deps),
        pending_max=max(pend, default=0),
        reused=sum(1 for v in cc.values() if v >= 2),
        by_kind=dict(by_kind),
        one_cell=sum(1 for st in tr if len(st["path"]) == 1),
        zigzag=sum(
            1 for i in range(2, opt) if dirs[i] == dirs[i - 2] and dirs[i - 1] % 2 != dirs[i] % 2
        ),
        reversals=sum(1 for a, b in pairwise(dirs) if b == (a + 2) % 4),
    )


# ---------------------------------------------------------------------------
# 特徴量（v4 の measure を、要素の変化を Rules.changed で表して一般化したもの）


@dataclass(frozen=True)
class Metrics:
    shortest: int
    plans: int
    states: int
    near_extra: int
    dead_states: int
    forced: int
    lures: int
    dead_options: int
    distinct: int
    events: dict[str, int]
    elements: int
    counts: dict[str, int]  # 要素の種類ごとの数
    unused: int
    roles: tuple[str, ...]
    effects: tuple[Effect, ...]
    precedence: int
    soft_precedence: int
    order_chain: int
    order_traps: int
    order_lures: int
    solution_repeats: int
    near_repeats: int
    chains: int  # 同じ向きの2手が続けて雪に入る・続けて滑る岩を動かす組（全状態）
    repeat_moves: int
    repeat_live: int
    looks: StaticResult
    other: StaticResult
    solution: tuple[int, ...]
    dep: SelfDep

    @property
    def decoys(self) -> int:
        return self.roles.count("decoy")

    @property
    def weak_decoys(self) -> int:
        return self.roles.count("weak_decoy")

    @property
    def irrelevant(self) -> int:
        return self.roles.count("irrelevant")

    @property
    def looks_class(self) -> str:
        looks = self.looks
        if looks.shortest is None:
            return "unsolvable"
        if not looks.canonical_valid:
            return "misleading"
        if looks.shortest >= self.shortest + DETOUR:
            return "detour"
        return "shortcut"

    @property
    def static_shortcut(self) -> bool:
        other = self.other
        return self.looks_class == "shortcut" or (
            other.shortest is not None
            and other.canonical_valid
            and other.shortest <= self.shortest + NEAR_SLACK
        )


def static_result(free: Graph | None, goal: int, rules: Rules, start: int) -> StaticResult:
    if free is None:
        return StaticResult(None, False)
    g = with_goal(free, goal)
    to_goal = reverse_layers(g)
    if g.start not in to_goal:
        return StaticResult(None, False)
    moves = canonical_solution(g, to_goal)
    return StaticResult(len(moves), replay(rules, rules.initial(start), moves, goal))


def trigger(rules: Rules, s: int, t: int) -> str:
    """同じ向きの連打を数えるための、1手が要素を働かせたか: snow（雪に入った）・push（滑る岩を
    動かした）・空文字。"""
    n, E = rules.n, rules.E
    end = t % n
    if rules.plow and ((s // n) ^ (t // n)) & rules.snow_bits:
        return "snow"
    if not rules.plow and rules.cells[end] == SNOW and rules.kinds_of(t // n)[end] == STOPIN:
        return "snow"
    if rules.homes and (s // n) >> E != (t // n) >> E:
        return "push"
    return ""


def repeat_stats(g: Graph, to_goal: dict[int, int], shortest: int):
    near = chains = moves = live = 0
    rules = g.rules
    for s in g.order:
        for d, t in g.succ[s]:
            u = dict(g.succ.get(t, ())).get(d)
            if u is None:
                continue
            moves += 1
            live += u in to_goal
            if u in to_goal and g.dist[s] + to_goal[u] <= shortest:
                near += 1
            first = trigger(rules, s, t)
            if first and first == trigger(rules, t, u):
                chains += 1
    return near, chains, moves, live


def precedence_of(g: Graph, first_change: dict[int, int], shortest: int) -> tuple[int, int, int]:
    rules = g.rules
    n = rules.n
    goal = g.goal
    used = sorted(first_change, key=first_change.__getitem__)
    strict: list[tuple[int, int]] = []
    soft = 0
    ch = rules.changed
    for i, a in enumerate(used):
        for b in used[i + 1 :]:
            if first_change[a] == first_change[b]:
                continue
            dist = {g.start: 0}
            queue = [g.start]
            reached = None
            for s in queue:
                if s % n == goal:
                    reached = dist[s]
                    break
                cs = ch(s // n)
                for _, t in g.succ[s]:
                    ct = ch(t // n)
                    if ct >> a & 1 and not cs >> a & 1 and not ct >> b & 1:
                        continue
                    if t not in dist:
                        dist[t] = dist[s] + 1
                        queue.append(t)
            if reached is None:
                strict.append((a, b))
            elif reached >= shortest + FALSE_LEAD_COST:
                soft += 1
    chain = {j: 1 for j in used}
    for a, b in sorted(strict, key=lambda ab: first_change[ab[0]]):
        chain[b] = max(chain[b], chain[a] + 1)
    return len(strict), soft, max(chain.values(), default=0)


def used_cells(g: Graph) -> set[int]:
    """到達できる全状態で、駒が通過・停止するマスと、滑る岩が通過・停止するマス。"""
    rules = g.rules
    n, E = rules.n, rules.E
    used: set[int] = set()
    segments: set[tuple[int, int, int]] = set()
    for s, out in g.succ.items():
        for d, t in out:
            segments.add((s % n, d, t % n))
            if rules.plow and ((s // n) ^ (t // n)) & rules.snow_bits:
                used.add(rules.beyond[d][t % n])  # 雪を押し出した先（雪山）
            if rules.homes:
                o1, o2 = (s // n) >> E, (t // n) >> E
                if o1 != o2:
                    a = (o1 & ~o2).bit_length() - 1
                    b = (o2 & ~o1).bit_length() - 1
                    used.update(rules.path(a, b, d))
    for origin, d, end in segments:
        used.update(rules.path(origin, end, d))
    return used


def touched_elements(g: Graph) -> set[int]:
    rules = g.rules
    n = rules.n
    found = 0
    for s in g.order:
        found |= rules.changed(s // n)
    return {j for j in range(len(rules.elements)) if found >> j & 1}


def measure(
    p: Puzzle, g: Graph, neutral_free, looks_free, other_free, optimistic: bool = False
) -> Metrics | None:
    """p.goal の問題の特徴量。optimistic では要素を中立化した盤面を調べず、使わない要素をすべて
    おとりとみなす（点の上界。山登りで、上界でも今の点に届かない近傍を早く捨てるために使う）。"""
    rules: Rules = g.rules
    n = rules.n
    start = g.start
    to_goal = reverse_layers(g)
    if start not in to_goal:
        return None
    shortest = to_goal[start]
    solution = canonical_solution(g, to_goal)
    plans = count_plans(g, to_goal, shortest)
    steps = solution_options(g, to_goal, solution, p.goal)
    assert steps is not None
    ch = rules.changed
    events: Counter[str] = Counter()
    first_change: dict[int, int] = {}
    state = start
    for i, move in enumerate(solution):
        target = dict(g.succ[state])[move]
        for e in rules.events(state, move, target):
            events[e.split(":")[0]] += 1
        newly = ch(target // n) & ~ch(state // n)
        for j in range(len(rules.elements)):
            if newly >> j & 1:
                first_change.setdefault(j, i)
        state = target
    used_mask = sum(1 << j for j in first_change)

    visited = {start}
    forced = lures = dead_options = order_traps = order_lures = 0
    decoy_any: set[int] = set()
    decoy_plausible: set[int] = set()
    for i, (s, options) in enumerate(steps):
        fresh = [o for o in options if o.target not in visited]
        forced += len(fresh) == 1
        nxt = {o.move: o.target for o in options}[solution[i]]
        for o in options:
            if o.move == solution[i]:
                continue
            bad = o.kind > 0
            lures += bad and o.plausible
            dead_options += o.kind == 2
            newly = ch(o.target // n) & ~ch(s // n)
            early = [j for j, step in first_change.items() if step > i and newly >> j & 1]
            if bad and early:
                order_traps += 1
                order_lures += o.plausible
            branches = [(o, o.plausible)] + [(t, o.plausible and t.plausible) for t in o.then]
            for step, tempting in branches:
                if step.kind == 0:
                    continue
                changed = ch(step.target // n) & ~ch(step.source // n) & ~used_mask
                for j in range(len(rules.elements)):
                    if changed >> j & 1:
                        decoy_any.add(j)
                        if tempting:
                            decoy_plausible.add(j)
        visited.add(nxt)

    profile = option_profile(steps)
    effects = []
    for j in range(len(rules.elements)):
        if optimistic:
            effects.append(Effect(True, True, True))
            continue
        free = neutral_free[j]
        if free is None:
            effects.append(Effect(True, True, True))
            continue
        ng = with_goal(free, p.goal)
        nt = reverse_layers(ng)
        if ng.start not in nt:
            effects.append(Effect(True, True, True))
            continue
        n_short = nt[ng.start]
        n_solution = canonical_solution(ng, nt)
        n_plans = count_plans(ng, nt, n_short)
        n_profile = option_profile(solution_options(ng, nt, solution, p.goal))
        effects.append(
            Effect(
                n_short != shortest,
                n_plans != plans or tuple(n_solution) != tuple(solution),
                n_profile != profile,
            )
        )
    roles = []
    for j, effect in enumerate(effects):
        if not effect.relevant:
            roles.append("irrelevant")
        elif used_mask >> j & 1:
            roles.append("used")
        elif optimistic:
            roles.append("decoy")
        elif j in decoy_plausible:
            roles.append("decoy")
        elif j in decoy_any:
            roles.append("weak_decoy")
        else:
            roles.append("other")

    near = sum(
        1
        for s, d in g.dist.items()
        if s in to_goal and shortest < d + to_goal[s] <= shortest + NEAR_SLACK
    )
    near_rep, chains, rep_moves, rep_live = repeat_stats(g, to_goal, shortest)
    precedence, soft_precedence, chain = precedence_of(g, first_change, shortest)
    solution_repeats = sum(1 for a, b in pairwise(solution) if a == b)
    used = used_cells(g)
    unused = sum(
        1 for c, t in enumerate(p.cells) if t not in (ROCK, OUTSIDE, SLIDER) and c not in used
    )
    return Metrics(
        shortest=shortest,
        plans=plans,
        states=len(g.dist),
        near_extra=near,
        dead_states=sum(1 for s in g.dist if s not in to_goal),
        forced=forced,
        lures=lures,
        dead_options=dead_options,
        distinct=len(first_change),
        events=dict(events),
        elements=len(rules.elements),
        counts=dict(Counter(rules.kinds)),
        unused=unused,
        roles=tuple(roles),
        effects=tuple(effects),
        precedence=precedence,
        soft_precedence=soft_precedence,
        order_chain=chain,
        order_traps=order_traps,
        order_lures=order_lures,
        solution_repeats=solution_repeats,
        near_repeats=near_rep,
        chains=chains,
        repeat_moves=rep_moves,
        repeat_live=rep_live,
        looks=static_result(looks_free, p.goal, rules, p.start),
        other=static_result(other_free, p.goal, rules, p.start),
        solution=tuple(solution),
        dep=selfdep_of(rules, p.start, solution),
    )


@dataclass
class Context:
    rules: Rules
    free: Graph | None
    neutral_free: list[Graph | None]
    looks_free: Graph | None
    other_free: Graph | None


def context_of(p: Puzzle, neutral_too: bool = True) -> Context:
    rules = rules_of(p)
    free = explore(rules, p.start)
    neutral: list[Graph | None] = []
    if free is not None and neutral_too:
        for cell in rules.elements:
            nr = Rules(p.width, p.height, neutral_cells(p.cells, cell), rules.carry, rules.plow)
            neutral.append(explore(nr, p.start))
    looks_rules = Rules(p.width, p.height, neutral_cells(p.cells), rules.carry, rules.plow)
    other_cells = "".join(OTHER.get(t, t) for t in p.cells)
    other_rules = Rules(p.width, p.height, other_cells, rules.carry, rules.plow)
    return Context(
        rules, free, neutral, explore(looks_rules, p.start), explore(other_rules, p.start)
    )


def measure_puzzle(p: Puzzle, ctx: Context | None = None) -> Metrics | None:
    ctx = ctx or context_of(p)
    if ctx.free is None:
        return None
    g = with_goal(ctx.free, p.goal)
    return measure(p, g, ctx.neutral_free, ctx.looks_free, ctx.other_free)


# ---------------------------------------------------------------------------
# 目的関数と山登り


@dataclass(frozen=True)
class Weights:
    selfdep: float = 3.0  # 主項: 自作依存の点
    cap_selfdep: float = 16.0
    looks_unsolvable: float = 2.0
    looks_mislead: float = 3.0
    looks_detour: float = 1.0
    decoy: float = 1.5
    cap_decoy: int = 3
    weak_decoy: float = 0.5
    precedence: float = 0.3
    cap_precedence: int = 8
    chain: float = 0.5
    cap_chain: int = 4
    lure: float = 0.3
    cap_lure: int = 4
    forced: float = 1.5
    near: float = 0.3
    cap_near: int = 60
    plans: float = 2.0
    unused: float = 0.3
    # 1マス滑り・階段・同じ手筋の繰り返しを抑える
    one_cell: float = 1.0  # 最短手数の 25% を超えた1マス滑り1つあたり
    zigzag: float = 0.7  # 2つを超えた階段1つあたり
    quick_repeat: float = 1.0  # 2つを超えた「作ってすぐ戻る」1つあたり
    constraint: float = 6.0


@dataclass(frozen=True)
class Recipe:
    name: str
    variant: str
    shape: Shape
    lo: int
    hi: int
    min_elements: int
    max_elements: int
    min_each: int = 0
    min_uses: int = 3
    decoy_share: float = 0.2
    iterations: int = 1500
    max_density: float = 0.30
    weights: Weights = field(default_factory=Weights)
    # 自作依存の点の帯 [dep_lo, dep_hi)。dep_hi が 0 なら上限なし（帯を使わない v5 の生成も
    # 上限なし）
    dep_lo: float = 0.0
    dep_hi: float = 0.0

    def in_band(self, dep: float) -> bool:
        return dep >= self.dep_lo and (not self.dep_hi or dep < self.dep_hi)

    def band_gap(self, dep: float) -> float:
        top = self.dep_hi - 0.5 if self.dep_hi else math.inf
        return max(0.0, self.dep_lo - dep) + max(0.0, dep - top)

    @property
    def tiles(self) -> tuple[str, ...]:
        return VARIANT_TILES[self.variant]

    @property
    def label(self) -> str:
        return (
            f"{VARIANT_LABEL[self.variant]} {self.shape.label} {self.lo}〜{self.hi}手 "
            f"要素{self.min_elements}〜{self.max_elements}個"
        )

    def decoys_needed(self, elements: int) -> int:
        return max(1, math.ceil(self.decoy_share * elements - 1e-9))


def violations(m: Metrics, r: Recipe) -> list[str]:
    reasons = []
    if not r.in_band(m.dep.score):
        reasons.append("自作依存の帯")
    if not r.lo <= m.shortest <= r.hi:
        reasons.append("最短手数")
    if m.plans > 1:
        reasons.append("最短解が複数")
    if m.solution_repeats or m.near_repeats:
        reasons.append("条件1: 同じ向きが続く")
    if m.chains:
        reasons.append("条件1: 要素の連打")
    if m.irrelevant:
        reasons.append("条件2: 効かない要素")
    if m.decoys < r.decoys_needed(m.elements):
        reasons.append("条件2: おとり不足")
    if not r.min_elements <= m.elements <= r.max_elements:
        reasons.append("要素の数")
    if len(r.tiles) > 1 and min(m.counts.get(t, 0) for t in r.tiles) < r.min_each:
        reasons.append("要素の内訳")
    if m.dep.uses < r.min_uses:
        reasons.append("使う回数")
    if m.static_shortcut:
        reasons.append("静的な近道")
    if m.forced > 0.25 * m.shortest:
        reasons.append("一本道")
    if m.dep.one_cell > 0.25 * m.shortest:
        reasons.append("1マス滑り")
    return reasons


def shortfall(m: Metrics, r: Recipe) -> float:
    each = 0
    if len(r.tiles) > 1:
        each = max(0, r.min_each - min(m.counts.get(t, 0) for t in r.tiles))
    return (
        (m.plans > 1)
        + min(m.solution_repeats + m.near_repeats, 3)
        + min(m.chains, 3)
        + m.irrelevant
        + max(0, r.decoys_needed(m.elements) - m.decoys)
        + max(0, m.elements - r.max_elements, r.min_elements - m.elements)
        + each
        + (m.dep.uses < r.min_uses)
        + m.static_shortcut
        + (m.forced > 0.25 * m.shortest)
        + (not r.in_band(m.dep.score))
    )


def secondary(m: Metrics, w: Weights) -> float:
    looks = {
        "unsolvable": w.looks_unsolvable,
        "misleading": w.looks_mislead,
        "detour": w.looks_detour,
        "shortcut": 0.0,
    }[m.looks_class]
    return (
        looks
        + w.decoy * min(m.decoys, w.cap_decoy)
        + w.weak_decoy * min(m.weak_decoys, max(0, w.cap_decoy - m.decoys))
        + w.precedence * min(m.precedence, w.cap_precedence)
        + w.chain * max(0, min(m.order_chain, w.cap_chain) - 1)
        + w.lure * min(m.lures, w.cap_lure)
    )


def score_of(m: Metrics, r: Recipe) -> float:
    w = r.weights
    dep = m.dep
    cap = min(w.cap_selfdep, r.dep_hi - 0.5) if r.dep_hi else w.cap_selfdep
    return (
        w.selfdep * min(dep.score, cap)
        - 2 * w.selfdep * r.band_gap(dep.score)
        + secondary(m, w)
        - w.forced * m.forced
        - w.near * min(m.near_extra, w.cap_near)
        - w.plans * math.log2(max(m.plans, 1))
        - w.unused * m.unused
        - w.one_cell * max(0.0, dep.one_cell - 0.25 * m.shortest)
        - w.zigzag * max(0, dep.zigzag - 2)
        - w.quick_repeat * max(0, dep.quick_return - 2)
        - w.constraint * shortfall(m, r)
    )


Evaluation = tuple[float, int, Metrics | None]


def evaluate(p: Puzzle, r: Recipe, floor: float = -math.inf) -> Evaluation:
    """範囲 [lo, hi] の最短手数で駒が止まれる氷のマスのうち、点が最もよいゴール。まず要素を中立化
    した
    盤面を調べない上界（measure の optimistic）を求め、上界が floor に届かなければそこで返す。"""
    ctx = context_of(p, neutral_too=False)
    if ctx.free is None:
        return -1000.0, -1, None
    free = ctx.free
    n = ctx.rules.n
    first: dict[int, int] = {}
    for s in free.order:
        first.setdefault(s % n, free.dist[s])
    candidates = sorted(
        (c for c, d in first.items() if r.lo <= d <= r.hi and p.cells[c] == ICE and c != p.start),
        key=lambda c: (-first[c], c),
    )[:MAX_GOALS]
    if not candidates:
        return max(first.values(), default=0) - 100.0, -1, None
    bounds = []
    for goal in candidates:
        g = with_goal(free, goal)
        m = measure(replace(p, goal=goal), g, [], ctx.looks_free, ctx.other_free, optimistic=True)
        if m is not None:
            bounds.append((score_of(m, r), goal, g))
    if not bounds:
        return -500.0, -1, None
    bounds.sort(key=lambda item: -item[0])
    if bounds[0][0] < floor:
        return bounds[0][0], -1, None
    neutral: list[Graph | None] = []
    for cell in ctx.rules.elements:
        nr = Rules(p.width, p.height, neutral_cells(p.cells, cell), ctx.rules.carry, ctx.rules.plow)
        neutral.append(explore(nr, p.start))
    best: Evaluation | None = None
    for bound, goal, g in bounds:
        if best is not None and bound <= best[0]:
            break
        m = measure(replace(p, goal=goal), g, neutral, ctx.looks_free, ctx.other_free)
        if m is None:
            continue
        value = score_of(m, r)
        if best is None or value > best[0]:
            best = (value, goal, m)
    return best if best is not None else (-500.0, -1, None)


class Searcher:
    """v4 と同じ山登り（悪くならなければ受理）。"""

    def __init__(self, recipe: Recipe, rng: random.Random) -> None:
        self.r = recipe
        self.rng = rng
        self.w, self.h = recipe.shape.width, recipe.shape.height
        self.n = self.w * self.h
        self.tiles = recipe.tiles
        self.max_rocks = int(recipe.max_density * self.n)
        self.min_rocks = int(0.08 * self.n)

    def hosts(self, cells: list[str], start: int, tile: str) -> list[int]:
        allowed = (ICE, ROCK) if tile == SLIDER else (ICE,)
        return [c for c, t in enumerate(cells) if t in allowed and c != start]

    def pick_tile(self, cells: list[str]) -> str:
        if len(self.tiles) == 1:
            return self.tiles[0]
        counts = {t: cells.count(t) for t in self.tiles}
        short = [t for t in self.tiles if counts[t] < self.r.min_each]
        return self.rng.choice(short or list(self.tiles))

    def initial(self) -> Puzzle:
        rng, r = self.rng, self.r
        cells = [ROCK if rng.random() < 0.18 else ICE for _ in range(self.n)]
        ice = [c for c, t in enumerate(cells) if t == ICE]
        start = ice[rng.randrange(len(ice))]
        for _ in range((r.min_elements + r.max_elements) // 2):
            tile = self.pick_tile(cells)
            cells[rng.choice(self.hosts(cells, start, tile))] = tile
        return Puzzle(r.variant, self.w, self.h, "".join(cells), start)

    def mutate(self, p: Puzzle) -> Puzzle:
        rng = self.rng
        cells = list(p.cells)
        start = p.start
        roll = rng.random()
        if roll < 0.08:
            free = [c for c, t in enumerate(cells) if t == ICE and c != start]
            if free:
                start = rng.choice(free)
        elif roll < 0.40:
            self.mutate_elements(cells, start)
        else:
            self.mutate_rocks(cells, start)
        return replace(p, cells="".join(cells), start=start)

    def mutate_elements(self, cells: list[str], start: int) -> None:
        rng, r = self.rng, self.r
        placed = [c for c, t in enumerate(cells) if t in self.tiles]
        op = rng.random()
        if (op < 0.3 or not placed) and len(placed) < r.max_elements:
            tile = self.pick_tile(cells)
            hosts = self.hosts(cells, start, tile)
            if hosts:
                cells[rng.choice(hosts)] = tile
        elif op < 0.5 and len(placed) > r.min_elements:
            cell = rng.choice(placed)
            cells[cell] = rng.choice((ICE, ROCK)) if cells[cell] == SLIDER else ICE
        elif placed:
            source = rng.choice(placed)
            tile = cells[source]
            if len(self.tiles) > 1 and rng.random() < 0.2:
                tile = rng.choice([t for t in self.tiles if t != tile])
            cells[source] = ROCK if cells[source] == SLIDER and rng.random() < 0.5 else ICE
            hosts = self.hosts(cells, start, tile)
            if hosts:
                cells[rng.choice(hosts)] = tile

    def mutate_rocks(self, cells: list[str], start: int) -> None:
        rng = self.rng
        rocks = cells.count(ROCK)
        cell = rng.randrange(self.n)
        if cell == start or cells[cell] not in (ICE, ROCK):
            return
        if rng.random() < 0.5:
            if cells[cell] == ROCK and rocks > self.min_rocks:
                cells[cell] = ICE
            elif cells[cell] == ICE and rocks < self.max_rocks:
                cells[cell] = ROCK
            return
        other = rng.randrange(self.n)
        if other == start or cells[other] not in (ICE, ROCK):
            return
        cells[cell], cells[other] = cells[other], cells[cell]

    def lure_spots(self, p: Puzzle, solution: Sequence[int]) -> list[tuple[int, str]]:
        """おとりになりうる置き方: 最短解から外れた1手目・2手目の滑りを止める岩を滑る岩にする、
        その滑りが通る氷を要素にする。"""
        rules = rules_of(p)
        n = rules.n
        slides: set[tuple[int, int, int]] = set()
        state = rules.initial(p.start)
        for move in solution:
            options = rules.moves(state)
            for d, t in options:
                if d == move:
                    continue
                slides.add((state % n, d, t % n))
                if t % n != p.goal:
                    slides.update((t % n, d2, t2 % n) for d2, t2 in rules.moves(t))
            state = dict(options)[move]
        spots: set[tuple[int, str]] = set()
        for origin, d, end in slides:
            stopper = rules.beyond[d][end]
            if SLIDER in self.tiles and stopper >= 0 and p.cells[stopper] == ROCK:
                spots.add((stopper, SLIDER))
            cell = origin
            while cell != end:
                cell += rules.delta[d]
                if p.cells[cell] == ICE and cell not in (p.start, p.goal):
                    spots.update((cell, tile) for tile in self.tiles)
        return sorted(spots)

    def polish(self, p: Puzzle, score: float, solution: Sequence[int]):
        found = None
        while sum(1 for t in p.cells if t in self.tiles) < self.r.max_elements:
            best = None
            for cell, tile in self.lure_spots(p, solution):
                q = replace(p, cells=p.cells[:cell] + tile + p.cells[cell + 1 :])
                value, goal, m = evaluate(q, self.r, max(score, best[0]) if best else score)
                if m is not None and value > score and (best is None or value > best[0]):
                    best = (value, replace(q, goal=goal), m)
            if best is None:
                break
            score, p, m = best
            solution = m.solution
            found = best
        return found

    def run(self) -> tuple[float, Puzzle, Metrics | None]:
        p = self.initial()
        score, goal, m = evaluate(p, self.r)
        p = replace(p, goal=goal)
        best = (score, p, m)
        solution = m.solution if m else ()
        for i in range(1, self.r.iterations):
            if i % POLISH_EVERY == 0 and solution:
                polished = self.polish(p, score, solution)
                if polished is not None:
                    score, p, m = polished
                    solution = m.solution
                    if score >= best[0]:
                        best = polished
                continue
            q = self.mutate(p)
            value, q_goal, q_m = evaluate(q, self.r, score)
            if value >= score and q_m is not None:
                p, score = replace(q, goal=q_goal), value
                solution = q_m.solution if q_m else ()
                if value >= best[0]:
                    best = (value, p, q_m)
        return best


# ---------------------------------------------------------------------------
# 盤面の外（x）への置き換え


def outside_marked(p: Puzzle) -> Puzzle:
    """駒も滑る岩も一度も通らない氷・要素を x にし、そのマスにしか接していない岩も x にする。
    どの状態でも動かない滑る岩は岩にする。外周の x だけの行・列を切り落とす。"""
    rules = rules_of(p)
    g = explore(rules, p.start, p.goal, cap=10**7)
    assert g is not None
    used = used_cells(g)
    touched = touched_elements(g)
    w, h = p.width, p.height
    cells = list(p.cells)
    for c, t in enumerate(p.cells):
        if c in used:
            continue
        if t in (ROCK, SLIDER):
            x, y = c % w, c // w
            near = [
                (y + DY[d]) * w + x + DX[d]
                for d in range(4)
                if 0 <= x + DX[d] < w and 0 <= y + DY[d] < h
            ]
            if not any(cell in used for cell in near):
                cells[c] = OUTSIDE
            elif t == SLIDER and rules.element_of[c] not in touched:
                cells[c] = ROCK
        else:
            cells[c] = OUTSIDE
    rows = ["".join(cells[y * w : (y + 1) * w]) for y in range(h)]
    keep_rows = [y for y, row in enumerate(rows) if set(row) != {OUTSIDE}]
    keep_cols = [x for x in range(w) if any(rows[y][x] != OUTSIDE for y in range(h))]
    y0, y1, x0, x1 = keep_rows[0], keep_rows[-1], keep_cols[0], keep_cols[-1]
    nw = x1 - x0 + 1

    def moved(c: int) -> int:
        return (c // w - y0) * nw + (c % w - x0)

    cropped = "".join(rows[y][x0 : x1 + 1] for y in range(y0, y1 + 1))
    return Puzzle(p.variant, nw, y1 - y0 + 1, cropped, moved(p.start), moved(p.goal))


def same_game(a: Puzzle, b: Puzzle) -> bool:
    ma, mb = measure_puzzle(a), measure_puzzle(b)
    if ma is None or mb is None:
        return False
    return (ma.states, ma.shortest, ma.plans, ma.solution) == (
        mb.states,
        mb.shortest,
        mb.plans,
        mb.solution,
    )


# ---------------------------------------------------------------------------
# 生成と採用


@dataclass
class Made:
    recipe: Recipe
    puzzle: Puzzle
    raw: Puzzle
    score: float
    seconds: float
    metrics: Metrics
    dyn_depth: int
    reasons: list[str]

    @property
    def variant(self) -> str:
        return self.recipe.variant

    @property
    def accepted(self) -> bool:
        return not self.reasons

    @property
    def selfdep(self) -> float:
        return self.metrics.dep.score


def make(recipe: Recipe, seed: str) -> Made | None:
    started = time.perf_counter()
    score, raw, _ = Searcher(recipe, random.Random(seed)).run()
    if raw.goal < 0:
        return None
    puzzle = outside_marked(raw)
    assert same_game(raw, puzzle), f"{recipe.name}: x への置き換えで解が変わった"
    m = measure_puzzle(puzzle)
    if m is None:
        return None
    rules = rules_of(puzzle)
    g = explore(rules, puzzle.start, puzzle.goal, cap=10**7)
    depth = dynamic_depth(puzzle, DYN_DEPTH_CAP, g)
    return Made(
        recipe, puzzle, raw, score, time.perf_counter() - started, m, depth, violations(m, recipe)
    )


def make_task(task: tuple[Recipe, str]) -> Made | None:
    return make(*task)


SHAPES = (
    (Shape(8, 8), 12, 15),
    (Shape(10, 10), 14, 19),
    (Shape(10, 12), 17, 22),
)
# (下限, 上限, 2種類のときの各下限)
ELEMENT_RANGE = {
    "snow": (3, 7, 0),
    "slider": (2, 5, 0),
    "snow_thin": (4, 8, 2),
    "slider_thin": (4, 8, 2),
    "thin": (3, 7, 0),
    "slider_kick": (2, 5, 0),
    "slider_kick_thin": (4, 8, 2),
    "snow_pack": (3, 7, 0),
    "snow_pack_thin": (4, 8, 2),
}


def plan_for(variant: str) -> list[Recipe]:
    lo_el, hi_el, each = ELEMENT_RANGE[variant]
    return [
        Recipe(
            f"{variant}-{shape.width}x{shape.height}",
            variant,
            shape,
            lo,
            hi,
            min_elements=lo_el,
            max_elements=hi_el,
            min_each=each,
        )
        for shape, lo, hi in SHAPES
    ]


# 難しさの帯（v6）: 自作依存の点の帯ごとに盤面と最短手数の範囲を決める
BANDS = {
    "L3": (2.0, 4.0, Shape(7, 7), 9, 12),
    "L3w": (2.0, 4.0, Shape(8, 8), 11, 14),  # L3 を 8×8 で（雪は 7×7 だと1マス滑りが多い）
    "L4": (4.0, 6.0, Shape(8, 8), 12, 15),
    "L5": (6.0, 0.0, Shape(10, 10), 14, 19),
}


def plan_band(variant: str, band: str) -> Recipe:
    lo_el, hi_el, each = ELEMENT_RANGE[variant]
    dep_lo, dep_hi, shape, lo, hi = BANDS[band]
    return Recipe(
        f"{variant}-{band}-{shape.width}x{shape.height}",
        variant,
        shape,
        lo,
        hi,
        min_elements=lo_el,
        max_elements=hi_el,
        min_each=each,
        min_uses=2 if band.startswith("L3") else 3,
        dep_lo=dep_lo,
        dep_hi=dep_hi,
    )


def recipe_named(variant: str, name: str) -> Recipe:
    plans = plan_for(variant) + [plan_band(variant, b) for b in BANDS]
    return next(r for r in plans if r.name == name)


# ---------------------------------------------------------------------------
# 検証: 1マスずつ進めて盤面を書き換える独立の実装


SLOW_STOP = {ROCK, OUTSIDE, WATER, PACKED, "P"}  # "P" は押し出した雪山


@dataclass(frozen=True)
class Slow:
    """1マスずつの実装の状態。grid は床の文字（. # x c w s S P）、rocks は滑る岩のあるマス、
    plowed は押し出した雪（元のマス, 向き）。雪山 P は床の文字を上書きする（雪山の下の薄い氷は
    もう誰も触れない）。"""

    grid: tuple[str, ...]
    rocks: frozenset[int]
    plowed: frozenset[tuple[int, int]]
    pos: int


def slow_moves(p: Puzzle, st: Slow) -> list[tuple[int, Slow]]:
    w, h = p.width, p.height
    carry, plow = is_carry(p.variant), is_plow(p.variant)
    grid, rocks, pos = st.grid, st.rocks, st.pos

    def step(c: int, d: int) -> int:
        x, y = c % w + DX[d], c // w + DY[d]
        return y * w + x if 0 <= x < w and 0 <= y < h else -1

    out = []
    for d in range(4):
        cur = pos
        path = [cur]
        stopped_in_snow = False
        plowed_now = None
        while True:
            nxt = step(cur, d)
            if nxt < 0 or grid[nxt] in SLOW_STOP or nxt in rocks:
                break
            if grid[nxt] == SNOW:
                if plow:
                    ahead = step(nxt, d)
                    if (
                        ahead < 0
                        or grid[ahead] in SLOW_STOP
                        or grid[ahead] == SNOW
                        or ahead in rocks
                    ):
                        break  # 押し出せない雪は止め役
                    plowed_now = (nxt, ahead)
                cur = nxt
                path.append(cur)
                stopped_in_snow = True
                break
            cur = nxt
            path.append(cur)
        if cur == pos:
            continue
        new = list(grid)
        new_rocks = rocks
        new_plowed = st.plowed
        hit = step(cur, d)
        if not stopped_in_snow and hit >= 0 and hit in rocks:
            r = hit
            while True:
                nr = step(r, d)
                if nr < 0 or grid[nr] in SLOW_STOP or grid[nr] == SNOW or nr in rocks or nr == cur:
                    break
                r = nr
            if r != hit:
                new_rocks = (rocks - {hit}) | {r}
                if carry:
                    while step(cur, d) != r:
                        cur = step(cur, d)
                        path.append(cur)
        for c in path[:-1]:
            if new[c] == THIN:
                new[c] = WATER
        if not plow and new[pos] == SNOW:
            new[pos] = PACKED
        if plowed_now:
            snow_cell, ahead = plowed_now
            new[snow_cell] = ICE
            new[ahead] = "P"
            new_plowed = new_plowed | {(snow_cell, d)}
        out.append((d, Slow(tuple(new), frozenset(new_rocks), new_plowed, cur)))
    return out


def slow_initial(p: Puzzle) -> Slow:
    grid = tuple(ICE if t == SLIDER else t for t in p.cells)
    rocks = frozenset(c for c, t in enumerate(p.cells) if t == SLIDER)
    return Slow(grid, rocks, frozenset(), p.start)


def encode(rules: Rules, st: Slow) -> int:
    mask = 0
    for c in rules.thin_cells:
        if st.grid[c] == WATER:
            mask |= 1 << rules.bit_at[c]
    for c in rules.snow_cells:
        if not rules.plow and st.grid[c] == PACKED:
            mask |= 1 << rules.bit_at[c]
    for c, d in st.plowed:
        mask |= (1 | d << 1) << rules.bit_at[c]
    mask |= sum(1 << c for c in st.rocks) << rules.E
    return mask * rules.n + st.pos


def check_slow(p: Puzzle, limit: int = 3000) -> int:
    rules = rules_of(p)
    st0 = slow_initial(p)
    queue = [st0]
    seen = {encode(rules, st0)}
    mismatches = 0
    for st in queue:
        if len(seen) > limit:
            break
        fast = sorted(rules.moves(encode(rules, st)))
        slow = slow_moves(p, st)
        mismatches += fast != sorted((d, encode(rules, s2)) for d, s2 in slow)
        for _, s2 in slow:
            key = encode(rules, s2)
            if key not in seen:
                seen.add(key)
                queue.append(s2)
    return mismatches


def slow_replay(p: Puzzle, moves: Sequence[int]) -> bool:
    st = slow_initial(p)
    for i, move in enumerate(moves):
        options = dict(slow_moves(p, st))
        if move not in options:
            return False
        st = options[move]
        if st.pos == p.goal and i < len(moves) - 1:
            return False
    return st.pos == p.goal


def slow_shortest(p: Puzzle) -> int | None:
    st0 = slow_initial(p)
    queue = [(st0, 0)]
    seen = {st0}
    for st, d in queue:
        if st.pos == p.goal:
            return d
        for _, s2 in slow_moves(p, st):
            if s2 not in seen:
                seen.add(s2)
                queue.append((s2, d + 1))
    return None


def run_hand_checks() -> None:
    def rules(rows: list[str], carry: bool = False, plow: bool = False) -> Rules:
        return Rules(len(rows[0]), len(rows), "".join(rows), carry, plow)

    def go(r: Rules, state: int, move: int) -> int:
        return dict(r.moves(state))[move]

    def pos_of(r: Rules, s: int) -> int:
        return s % r.n

    def floor_kind(r: Rules, s: int, c: int) -> int:
        return r.kinds_of(s // r.n)[c]

    # 雪
    r = rules(["..s.."])
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 2 and floor_kind(r, s, 2) == STOPIN, "雪に入って止まる。乗っている間は雪"
    s = go(r, s, 1)
    assert pos_of(r, s) == 4 and floor_kind(r, s, 2) == BLOCK, "離れると踏み固まった雪（止め役）"
    s = go(r, s, 3)
    assert pos_of(r, s) == 3, "踏み固まった雪の手前で止まる"
    r = rules([".s", ".."])
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1, "隣の雪へ1マス滑って止まる"
    assert 0 not in dict(r.moves(s)) and 1 not in dict(r.moves(s)), "外壁へ向けた入力は手にならない"
    assert floor_kind(r, s, 1) == STOPIN, "動かない入力では固まらない"
    s = go(r, s, 2)
    assert floor_kind(r, s, 1) == BLOCK, "下へ離れると固まる"
    # 雪の連なり: 同じ向きの連打（条件で数える）
    r = rules(["s#s."])
    g = explore(r, 3)
    assert g is not None and repeat_stats(g, {}, 0)[1] == 0, "雪の先が岩なら連打にならない"
    r = rules(["..ss"])
    g = explore(r, 0)
    assert g is not None and repeat_stats(g, {}, 0)[1] == 1, (
        "雪に入った直後に同じ向きで次の雪に入る"
    )

    # 滑る岩
    r = rules(["..m..#"])
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1, "滑る岩の手前で止まる"
    assert floor_kind(r, s, 2) == PASS and floor_kind(r, s, 4) == BLOCK, "岩は岩の手前まで滑る"
    s2 = go(r, s, 1)
    assert pos_of(r, s2) == 3 and floor_kind(r, s2, 4) == BLOCK, (
        "どいた跡を通り、動いた岩の手前で止まる"
    )
    assert floor_kind(r, go(r, s, 1), 4) == BLOCK, "動けない岩は動かない"
    r = rules([".m..", "...."])
    assert 1 not in dict(r.moves(r.initial(0))), "隣の滑る岩へ向けた入力は手にならず、岩も動かない"
    r = rules(["..mm.."])
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1 and floor_kind(r, s, 2) == BLOCK and floor_kind(r, s, 3) == BLOCK, (
        "前に滑る岩があると動かない"
    )
    r = rules(["..m...", "......"])
    s = go(r, r.initial(0), 1)
    assert floor_kind(r, s, 5) == BLOCK and floor_kind(r, s, 2) == PASS, "外壁の手前まで滑る"
    # ゴールの上も滑る岩は通過・停止する。ゴールに岩がある間は入れない
    r = rules(["..m.", "...."])
    g = explore(r, 0, goal=3)
    assert g is not None
    s = go(r, r.initial(0), 1)
    assert floor_kind(r, s, 3) == BLOCK, "滑る岩がゴールの上で止まる"
    assert all(t % r.n != 3 for _, t in r.moves(s)), "岩がある間はゴールに入れない"
    # 薄い氷の上は割らずに滑る
    r = rules(["..m.cc#"])
    s = go(r, r.initial(0), 1)
    assert floor_kind(r, s, 5) == BLOCK and floor_kind(r, s, 4) == PASS, "薄い氷の上を割らずに滑る"
    assert s // r.n & ((1 << r.E) - 1) == 0, "薄い氷は割れていない"
    # 水面の手前で滑る岩が止まる
    r = rules(["c.m...", "......"])
    s = go(r, r.initial(1), 3)  # 薄い氷へ1マス（左は外壁）: 薄い氷に乗る
    s = go(r, s, 1)  # 右へ: 出発マスの薄い氷が水面、滑る岩の手前で止まり、岩は外壁まで
    assert floor_kind(r, s, 0) == BLOCK and pos_of(r, s) == 1 and floor_kind(r, s, 5) == BLOCK
    s = go(r, s, 1)
    s = go(r, s, 3)
    assert pos_of(r, s) == 1, "水面の手前で止まる"
    r = rules(["...m.c", "......"])
    s = go(r, r.initial(5 + 6), 0)
    s = go(r, s, 3)  # 左へ: 出発マスの薄い氷が水面、滑る岩の手前で止まり、岩は外壁まで
    assert floor_kind(r, s, 5) == BLOCK and pos_of(r, s) == 4 and floor_kind(r, s, 0) == BLOCK
    r = rules(["..x.."])
    assert dict(r.moves(r.initial(0)))[1] == r.initial(1), "x は外壁と同じ止め役"

    # 滑る岩の修正案（押し進む）
    r = rules(["..m..#"], carry=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 3 and floor_kind(r, s, 4) == BLOCK and floor_kind(r, s, 2) == PASS, (
        "押し進む: 岩は岩の手前まで滑り、駒はその手前で止まる"
    )
    assert 1 not in dict(r.moves(s)), "押し進んだ直後は同じ向きに動けない"
    r = rules([".m..", "...."], carry=True)
    assert 1 not in dict(r.moves(r.initial(0))), "押し進む: 隣の岩へ向けた入力は手にならない"
    r = rules(["..mm.."], carry=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1 and floor_kind(r, s, 2) == BLOCK, "押し進む: 動けない岩の手前で止まる"
    r = rules(["..cm.cc#"], carry=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 5 and floor_kind(r, s, 6) == BLOCK, "押し進む: 岩は薄い氷の上で止まる"
    assert floor_kind(r, s, 2) == BLOCK and floor_kind(r, s, 5) == PASS, (
        "駒が通った薄い氷だけ割れる"
    )
    r = rules(["..m.", "...."], carry=True)
    g = explore(r, 0, goal=2)
    assert g is not None and any(t % r.n == 2 for _, t in r.moves(r.initial(0))), (
        "押し進む: 岩の手前のマスがゴールならそこで止まってクリア"
    )

    # 押し出す雪（v6）
    r = rules(["..s...", "......"], plow=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 2 and floor_kind(r, s, 2) == PASS and floor_kind(r, s, 3) == BLOCK, (
        "雪を1マス先へ押し出して雪山にし、駒は雪のあったマス（氷になる）で止まる"
    )
    assert 1 not in dict(r.moves(s)), "押し出した直後は同じ向きに動けない（雪山が前にある）"
    s3 = go(r, go(r, go(r, s, 3), 2), 1)  # 左→下→右: 下の段を右端まで
    assert pos_of(r, s3) == 11
    s4 = go(r, s3, 0)
    assert pos_of(r, s4) == 5, "上の段の右端へ"
    s5 = go(r, s4, 3)
    assert pos_of(r, s5) == 4, "雪山の手前で止まる"
    r = rules(["..s#..", "......"], plow=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1 and floor_kind(r, s, 2) == STOPIN, (
        "押し出せない雪は動かず、手前で止まる"
    )
    assert 1 not in dict(r.moves(s)), "押し出せない雪へ向けた入力は手にならない"
    r = rules(["..ss.."], plow=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 1, "雪の先が雪なら押し出せない（雪山は積み重ならない）"
    r = rules([".s.s..", "......"], plow=True)
    s = go(r, r.initial(5), 3)
    assert pos_of(r, s) == 3 and floor_kind(r, s, 2) == BLOCK, "左へ押し出して雪山"
    s = go(r, go(r, go(r, s, 2), 3), 0)  # 下→左→上: 左上の角
    assert pos_of(r, s) == 0
    assert 1 not in dict(r.moves(s)), "隣の雪の先が雪山なので押し出せず、入力は手にならない"
    r = rules(["..s.", "...."], plow=True)
    s = go(r, r.initial(0), 1)
    assert floor_kind(r, s, 3) == BLOCK, "雪はゴールの上にも押し出せ、ゴールは雪山でふさがる"
    r = rules(["..sc#", "....."], plow=True)
    s = go(r, r.initial(0), 1)
    assert floor_kind(r, s, 3) == BLOCK and s // r.n & r.thin_bits == 0, "薄い氷の上に雪山"
    r = rules([".cs.", "...."], plow=True)
    s = go(r, r.initial(0), 1)
    assert pos_of(r, s) == 2 and floor_kind(r, s, 1) == BLOCK, "通った薄い氷は割れる"

    # 自作依存: 押し出した雪山で後から止まる（右へ押し出し→下→左→上→右で雪山の手前）
    r = rules([".s....", "......", "......"], plow=True)
    tr = dependency_trace(r, 0, [1, 2, 3, 0, 1])
    stops = [d for st in tr for d in st["deps"] if d[0] == "stop"]
    assert stops and stops[0][2] == 0 and stops[0][1] == 2, "1手目で押し出した雪山で5手目に止まる"

    # 自作依存: 踏み固めた雪で後から止まる
    r = rules([".....", "s....", ".....", "....."])
    # 駒(0,3) 上→雪(0,1)に入る 右→(4,1) で雪が固まる ... 手で確かめる
    tr = dependency_trace(r, 15, [0, 1, 2, 3, 0])
    stops = [d for st in tr for d in st["deps"] if d[0] == "stop"]
    assert stops and stops[0][2] == 1, "2手目で固めた雪で止まる"
    print("hand checks: ok")


def random_puzzle(rng: random.Random, shape: Shape, tiles: Sequence[str]) -> Puzzle:
    w, h = shape.width, shape.height
    cells = [ROCK if rng.random() < 0.2 else ICE for _ in range(w * h)]
    start = rng.choice([c for c, t in enumerate(cells) if t == ICE])
    pool = [c for c in range(w * h) if c != start]
    for c in rng.sample(pool, rng.randrange(2, 7)):
        tile = rng.choice(tiles)
        if tile != SLIDER and cells[c] == ROCK:
            continue
        cells[c] = tile
    return Puzzle("mixed", w, h, "".join(cells), start)


def run_verify(args: argparse.Namespace) -> None:
    run_hand_checks()
    rng = random.Random(f"{args.seed}-v5-verify")
    for tiles, variant in (
        ((SNOW, THIN), "snow_thin"),
        ((SNOW, THIN), "snow_pack_thin"),
        ((SLIDER, THIN), "slider_thin"),
        ((SLIDER, THIN), "slider_kick_thin"),
        ((SNOW, SLIDER, THIN), "mixed"),
    ):
        mismatches = marked = changed = 0
        for _ in range(args.samples):
            p = random_puzzle(rng, Shape(rng.choice((5, 6, 7)), rng.choice((5, 6, 7))), tiles)
            p = replace(p, variant=variant)
            mismatches += check_slow(p)
            rules = rules_of(p)
            g = explore(rules, p.start, cap=10**7)
            assert g is not None
            n = rules.n
            spots = sorted({s % n for s in g.order if p.cells[s % n] == ICE and s % n != p.start})
            if not spots:
                continue
            q = replace(p, goal=rng.choice(spots))
            marked += 1
            changed += not same_game(q, outside_marked(q))
        names = "・".join(TILE_LABEL[t] for t in tiles) + (
            "（滑る岩は最初の案）" if "kick" in variant else ""
        )
        names += "（雪は踏み固まる案）" if "pack" in variant else ""
        print(
            f"{names}: samples={args.samples} 速い実装との不一致={mismatches} "
            f"x 置き換え {marked} 問で解が変わった={changed}"
        )


# ---------------------------------------------------------------------------
# 出力


DIRECTION_WORDS = ("up", "right", "down", "left")
LOOKS_LABEL = {
    "unsolvable": "解なし",
    "misleading": "解が通らない",
    "detour": "遠回り",
    "shortcut": "近道",
}


def render(p: Puzzle) -> list[str]:
    rows = [list(row) for row in p.rows]
    w = p.width
    rows[p.start // w][p.start % w] = "S"
    rows[p.goal // w][p.goal % w] = "G"
    return ["".join(row) for row in rows]


def candidate_entry(made: Made) -> dict:
    p, m = made.puzzle, made.metrics
    assert slow_replay(p, m.solution), "解を1マスずつ再生してもゴールで止まらない"
    assert set(p.cells) <= {ICE, ROCK, THIN, SNOW, SLIDER, OUTSIDE}
    assert p.cells[p.start] == ICE and p.cells[p.goal] == ICE
    assert check_slow(p, limit=10**6) == 0
    slow = slow_shortest(p)
    assert slow == m.shortest, (slow, m.shortest)
    rules = rules_of(p)
    w = p.width
    dep = m.dep
    condition1 = m.solution_repeats == 0 and m.near_repeats == 0 and m.chains == 0
    condition2 = m.irrelevant == 0 and m.decoys >= made.recipe.decoys_needed(m.elements)
    return {
        "variant": p.variant,
        "width": p.width,
        "height": p.height,
        "rows": p.rows,
        "start": [p.start % w, p.start // w],
        "goal": [p.goal % w, p.goal // w],
        "optimal": m.shortest,
        "solution": [DIRECTION_WORDS[d] for d in m.solution],
        "features": {
            "recipe": made.recipe.name,
            "selfdep": dep.score,
            "varied_stop": dep.varied_stop,
            "varied_use": dep.varied_use,
            "quick_return": dep.quick_return,
            "goal_stop_self": dep.goal_stop_self,
            "self_uses": dep.uses,
            "self_uses_by_kind": dep.by_kind,
            "dep_moves": dep.dep_moves,
            "lag_sum": dep.lag_sum,
            "pending_max": dep.pending_max,
            "reused_cells": dep.reused,
            "one_cell": dep.one_cell,
            "zigzag": dep.zigzag,
            "reversals": dep.reversals,
            "elements": [
                {"at": [c % w, c // w], "kind": rules.kinds[j], "role": m.roles[j]}
                for j, c in enumerate(rules.elements)
            ],
            "counts": m.counts,
            "decoys": m.decoys,
            "weak_decoys": m.weak_decoys,
            "distinct": m.distinct,
            "events": m.events,
            "precedence_pairs": m.precedence,
            "soft_precedence_pairs": m.soft_precedence,
            "order_chain": m.order_chain,
            "order_traps": m.order_traps,
            "lures": m.lures,
            "looks": m.looks_class,
            "static_looks": m.looks.shortest,
            "static_looks_valid": m.looks.canonical_valid,
            "static_other": m.other.shortest,
            "dynamic_depth": made.dyn_depth,
            "plans": m.plans,
            "states": m.states,
            "near_extra": m.near_extra,
            "forced": m.forced,
            "solution_repeats": m.solution_repeats,
            "near_repeats": m.near_repeats,
            "element_chains": m.chains,
            "repeat_moves_all": m.repeat_moves,
            "repeat_moves_live": m.repeat_live,
            "condition1": condition1,
            "condition2": condition2,
            "slow_shortest": slow,
            "outside_cells": p.cells.count(OUTSIDE),
            "seconds": round(made.seconds, 2),
        },
    }


def med(values: Sequence[float]) -> str:
    return f"{statistics.median(values):g}" if values else "-"


def summary_row(variant: str, made: Sequence[Made]) -> dict:
    ok = [m for m in made if m.accepted]
    dist = sorted(m.selfdep for m in ok)
    return {
        "variant": variant,
        "label": VARIANT_LABEL[variant],
        "made": len(made),
        "accepted": len(ok),
        "seconds_mean": round(statistics.mean([m.seconds for m in made]), 1) if made else None,
        "reasons": dict(Counter(r for m in made for r in m.reasons)),
        "selfdep_accepted": dist,
        "selfdep_all": sorted(m.selfdep for m in made),
        "median": {
            "shortest": med([m.metrics.shortest for m in ok]),
            "states": med([m.metrics.states for m in ok]),
            "elements": med([m.metrics.elements for m in ok]),
            "selfdep": med(dist),
            "varied_stop": med([m.metrics.dep.varied_stop for m in ok]),
            "varied_use": med([m.metrics.dep.varied_use for m in ok]),
            "quick_return": med([m.metrics.dep.quick_return for m in ok]),
            "goal_stop_self": med([m.metrics.dep.goal_stop_self for m in ok]),
            "decoys": med([m.metrics.decoys for m in ok]),
            "precedence": med([m.metrics.precedence for m in ok]),
            "dyn_depth": med([m.dyn_depth for m in ok]),
            "repeat_moves": med([m.metrics.repeat_moves for m in ok]),
        },
        "looks": dict(Counter(m.metrics.looks_class for m in ok)),
        "by_shape": {
            r: f"{sum(m.accepted for m in made if m.recipe.name == r)}/"
            f"{sum(1 for m in made if m.recipe.name == r)}"
            for r in sorted({m.recipe.name for m in made})
        },
    }


def made_record(m: Made) -> dict:
    """生成した全問の記録（候補を選び直すため）。"""
    p = m.puzzle
    w = p.width
    return {
        "recipe": m.recipe.name,
        "variant": m.variant,
        "accepted": m.accepted,
        "reasons": m.reasons,
        "seconds": round(m.seconds, 1),
        "score": round(m.score, 2),
        "selfdep": m.selfdep,
        "varied_stop": m.metrics.dep.varied_stop,
        "varied_use": m.metrics.dep.varied_use,
        "quick_return": m.metrics.dep.quick_return,
        "goal_stop_self": m.metrics.dep.goal_stop_self,
        "shortest": m.metrics.shortest,
        "states": m.metrics.states,
        "elements": m.metrics.elements,
        "decoys": m.metrics.decoys,
        "looks": m.metrics.looks_class,
        "dyn_depth": m.dyn_depth,
        "width": p.width,
        "height": p.height,
        "rows": p.rows,
        "start": [p.start % w, p.start // w],
        "goal": [p.goal % w, p.goal // w],
    }


def run_generate(args: argparse.Namespace) -> None:
    """各種類・各盤面を --runs 回作り、全問を --output（JSON Lines）に書く。"""
    if args.bands:
        recipes = [
            replace(plan_band(v, b), iterations=args.iterations)
            for v in args.variants
            for b in args.bands
        ]
    else:
        recipes = [
            replace(r, iterations=args.iterations) for v in args.variants for r in plan_for(v)
        ]
    if args.shape >= 0:
        recipes = [r for r in recipes if r.shape == SHAPES[args.shape][0]]
    tasks = [
        (recipe, f"{args.seed}-v5-{recipe.name}-{run}")
        for recipe in recipes
        for run in range(args.runs)
    ]
    started = time.perf_counter()
    made = [m for m in parallel(make_task, tasks, args.workers) if m is not None]
    print(f"generated {len(made)} in {time.perf_counter() - started:.0f}s")
    out = Path(args.output)
    with out.open("a") as f:
        for m in made:
            f.write(json.dumps(made_record(m), ensure_ascii=False) + "\n")
    for variant in args.variants:
        row = summary_row(variant, [m for m in made if m.variant == variant])
        print(json.dumps(row, ensure_ascii=False))


def puzzle_of(record: dict) -> Puzzle:
    w = record["width"]
    sx, sy = record["start"]
    gx, gy = record["goal"]
    return Puzzle(
        record["variant"], w, record["height"], "".join(record["rows"]), sy * w + sx, gy * w + gx
    )


def run_candidates(args: argparse.Namespace) -> None:
    """generate の記録から、候補を選ぶ（--pick は id 順の "種類:行番号" の並び）。"""
    records = [json.loads(line) for line in Path(args.records).read_text().splitlines() if line]
    output = []
    for number, key in enumerate(args.pick, 1):
        index = int(key)
        rec = records[index]
        recipe = recipe_named(rec["variant"], rec["recipe"])
        p = puzzle_of(rec)
        m = measure_puzzle(p)
        assert m is not None
        g = explore(rules_of(p), p.start, p.goal, cap=10**7)
        made = Made(
            recipe,
            p,
            p,
            rec["score"],
            rec["seconds"],
            m,
            dynamic_depth(p, DYN_DEPTH_CAP, g),
            violations(m, recipe),
        )
        assert made.accepted, (key, made.reasons)
        entry = {"id": f"{args.prefix}{number:02d}", **candidate_entry(made)}
        entry["features"]["band"] = next((b for b in BANDS if f"-{b}-" in made.recipe.name), None)
        output.append(entry)
        f = entry["features"]
        print(
            f"{entry['id']} {VARIANT_LABEL[p.variant]} {p.width}x{p.height} 最短{m.shortest} "
            f"自作依存{f['selfdep']} (varied_stop {f['varied_stop']} varied_use {f['varied_use']} "
            f"quick {f['quick_return']} goal_stop_self {f['goal_stop_self']}) 要素{m.counts} "
            f"役割{dict(Counter(m.roles))} 状態{m.states} 読み{made.dyn_depth} "
            f"見た目{LOOKS_LABEL[m.looks_class]}"
        )
        for line in render(p):
            print("    " + line)
        print("    解: " + " ".join(entry["solution"]))
        print(f"    使った自作: {f['self_uses_by_kind']} 出来事: {m.events}")
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(output)} problems to {args.output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("verify", "generate", "candidates"))
    parser.add_argument("--variants", nargs="+", default=list(VARIANTS), choices=VARIANTS)
    parser.add_argument("--bands", nargs="*", default=[], choices=list(BANDS))
    parser.add_argument("--shape", type=int, default=-1, help="generate の盤面（0〜2、-1 は全部）")
    parser.add_argument("--iterations", type=int, default=1500)
    parser.add_argument("--runs", type=int, default=4)
    parser.add_argument("--samples", type=int, default=100)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261101)
    parser.add_argument("--records", default="/tmp/persistent/made.jsonl")
    parser.add_argument("--pick", nargs="*", default=[])
    parser.add_argument("--prefix", default="p", help="candidates の id の頭文字")
    parser.add_argument("--output", default="/tmp/persistent/made.jsonl")
    args = parser.parse_args()
    {"verify": run_verify, "generate": run_generate, "candidates": run_candidates}[args.suite](args)


if __name__ == "__main__":
    main()
