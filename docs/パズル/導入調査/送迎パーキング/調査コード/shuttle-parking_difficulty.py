"""送迎パーキング（shuttle-parking）の難易度の案を比べる調査コード。

標準ライブラリだけで書き、乱数は文字列の seed で固定する。製品のコードではない。

ルール（認識合わせの合意）:
- 駐車場の車（縦か横、長さ2か3。長さ＝定員）は、向きに沿って、開口のある辺まで進路が空なら外へ出て、待機枠に入る。
- 乗客の列（全部見える）の先頭から順に、同じ色の待機車へ1人ずつ乗る（同じ色が複数あれば先に入った車）。
  座席が埋まると出発して枠が空く。待機枠が埋まっていると次の車を出せない。出せる手が無ければ詰み。

盤面と厳密探索は `scripts/research/parking_jam_passenger_reading.py`（別ブランチの研究資料
claude/wizardly-darwin-yvsr1u）を移したもの。状態は（残りの車の集合, 色ごとの待機車の長さの到着順）。
読み手（tier の読み手）と罠の深さ・勝率の曲線は `parking_jam_passenger_levels.py` を移したもの。
ここで足したもの（案の名前は `../送迎パーキング難易度.md` §13 と同じ）:
- 案B〜G は比較の再現用（B 窓の読み手、C 必ず出会う罠、E A と B の一致、F 規則の組・狭い窓・深さ2つ、G 局面ごとの罠の回数）。
- 案H（採用）: 罠を「判断」で数える（勝ち筋の上で同じ車が罠のまま続く局面の並びを1つの判断とする）。
  どの勝ち筋でも出会う判断のうち最も重いものの段（結果が 5・8・10 人以上先）でレベルを決める。
  勝ち筋の最小と最大で同じレベル、深さの2つの取り方と先回りする人（窓5人）でも同じレベルの問題だけを採る。
  素朴な規則の組（8つ、`G_RULES`）は上位を止める条件にだけ使う。待機枠は解ける最小の数だけ。
- 1手戻す人（4種）、意味のない好みの人（8通り）、h 人先まで読む人の勝率、数え方の変種、供給の計測。

サブコマンド（案H）:
  hsurvey --seed S --cars 8 --count N           無作為な問題（案G と同じ問題）を作り、案H と変種の特徴を測る
  hdigest --surveys ... --undo-per-level K      レベルごとの表、変種、1手戻す人・読む人・意味のない好みの人の順
  supply  --seed S --seconds T --cars 8         案H だけで、レベルごとの CPU 1分あたりの採用数
  expected --seed S --count N --cars 8          案H の seed ごとの結果（移植の期待値）
  show    --surveys ... --index I               1問を文字の格子で書き出す
サブコマンド（前の案の再現用）: gsurvey・gdigest（G）、fsurvey・fdigest（F）、survey・digest・naive（A〜E）

判定の入口: analyze_H(problem, bays, variants) で特徴を測り、level_H(row) が (レベル, 範囲外の理由) を返す。
供給と期待値は assess_chosen(problem) -> (解ける最小の待機枠, [{bays, level, level4, why, policies, best, cont, window}])。
level4 は Lv4 と Lv5 を1つにまとめた4段階（人に残す別案）。

再現（案H の数値）:
  hsurvey --seed 988 --cars 8 --count 3000 / 2026・3141・5926 も同じ
  hdigest --surveys <上の4つ> --undo-per-level 300
  supply --seed 988 --seconds 60 --cars 8 / --seed 2026 同じ（CPU 時間で区切るので候補数は機械で変わる）
  expected --seed 988 --count 150 --cars 8
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import cached_property
from multiprocessing import Pool

sys.setrecursionlimit(10000)

# ---------------------------------------------------------------- 盤面


@dataclass(frozen=True)
class Vehicle:
    row: int
    column: int
    direction: str
    length: int
    occupancy: int
    paths: tuple[int, int]


def positions(size: int) -> list[Vehicle]:
    options: list[Vehicle] = []

    def mask(cells):
        return sum(1 << (r * size + c) for r, c in cells)

    for direction in ("horizontal", "vertical"):
        for length in (2, 3):
            for row in range(size - (length if direction == "vertical" else 1) + 1):
                for column in range(size - (length if direction == "horizontal" else 1) + 1):
                    if direction == "horizontal":
                        occupied = [(row, column + j) for j in range(length)]
                        low = [(row, c) for c in range(column)]
                        high = [(row, c) for c in range(column + length, size)]
                    else:
                        occupied = [(row + j, column) for j in range(length)]
                        low = [(r, column) for r in range(row)]
                        high = [(r, column) for r in range(row + length, size)]
                    options.append(Vehicle(row, column, direction, length, mask(occupied), (mask(low), mask(high))))
    return options


OPENINGS_BY_NAME = {
    "all4": frozenset({"top", "right", "bottom", "left"}),
    "adjacent2": frozenset({"top", "right"}),
    "opposite2": frozenset({"top", "bottom"}),
    "one": frozenset({"top"}),
}


def ray_sides(v: Vehicle) -> tuple[str, str]:
    return ("left", "right") if v.direction == "horizontal" else ("top", "bottom")


def open_rays(v: Vehicle, openings) -> list[int]:
    return [ray for ray, side in zip(v.paths, ray_sides(v)) if side in openings]


def legal_open(vehicles, remaining: int, openings) -> list[int]:
    occupied = 0
    for i, v in enumerate(vehicles):
        if remaining >> i & 1:
            occupied |= v.occupancy
    return [i for i, v in enumerate(vehicles)
            if remaining >> i & 1 and any(not occupied & ray for ray in open_rays(v, openings))]


def iter_bits(mask: int):
    while mask:
        low = mask & -mask
        yield low.bit_length() - 1
        mask ^= low


def make_board_lengths(rng, candidates, count, openings, long_share):
    """各車の長さを先に引き（3 の割合 long_share）、置いた時点で開口へ出られる車だけを置く。
    8割の確率で、それまでに出せた車のどれかを塞ぐ位置を選ぶ（逆順が必ず出せる順になる）。"""
    candidates = [v for v in candidates if open_rays(v, openings)]
    vehicles: tuple[Vehicle, ...] = ()
    occupied = 0
    for index in range(count):
        options = [v for v in candidates if not v.occupancy & occupied
                   and any(not ray & occupied for ray in open_rays(v, openings))]
        if not options:
            return None
        length = 3 if rng.random() < long_share else 2
        options = [v for v in options if v.length == length] or options
        before = set(legal_open(vehicles, (1 << index) - 1, openings))
        if before and rng.random() < 0.8:
            blocking = [v for v in options
                        if before - set(legal_open((*vehicles, v), (1 << (index + 1)) - 1, openings))]
            if blocking:
                options = blocking
        chosen = rng.choice(options)
        vehicles = (*vehicles, chosen)
        occupied |= chosen.occupancy
    return vehicles


_POSITIONS: dict[int, list[Vehicle]] = {}


def pool_of(size: int) -> list[Vehicle]:
    if size not in _POSITIONS:
        _POSITIONS[size] = positions(size)
    return _POSITIONS[size]


def generate_board(rng, n, size, openings, long_share, attempts=200):
    for _ in range(attempts):
        board = make_board_lengths(rng, pool_of(size), n, openings, long_share)
        if board is not None:
            return board
    raise RuntimeError(f"no board with {n} cars on {size}x{size}")


def assign_colors(rng, n: int, scheme: str) -> list[str]:
    """`pairs`: n/2 色を2台ずつ。`3`・`4`: その色数で、台数の差が1以内。"""
    count = n // 2 if scheme == "pairs" else int(scheme)
    colors = [chr(65 + j % count) for j in range(n)]
    rng.shuffle(colors)
    return colors


def shuffled_queue(rng, colors, lengths) -> list[str]:
    queue = [c for c, length in zip(colors, lengths) for _ in range(length)]
    rng.shuffle(queue)
    return queue


@dataclass
class Problem:
    vehicles: tuple[Vehicle, ...]
    size: int
    openings: frozenset
    colors: list[str]
    queue: list[str]

    @cached_property
    def sides(self):
        """車ごとに、開口へ向かう進路を塞ぐ車の集合（進路ごと）。"""
        return tuple(tuple(sum(1 << j for j, o in enumerate(self.vehicles) if j != i and o.occupancy & ray)
                           for ray in open_rays(v, self.openings)) for i, v in enumerate(self.vehicles))

    @property
    def lengths(self) -> list[int]:
        return [v.length for v in self.vehicles]

    def game(self, bays: int, geometry: bool = True) -> "Game":
        sides = self.sides if geometry else tuple((0,) for _ in self.vehicles)
        return Game(sides, self.colors, self.lengths, self.queue, bays)

    def to_json(self) -> dict:
        return {"size": self.size, "openings": sorted(self.openings),
                "vehicles": [{"row": v.row, "column": v.column, "orientation": v.direction, "length": v.length,
                              "color": c} for v, c in zip(self.vehicles, self.colors)],
                "queue": self.queue}

    @classmethod
    def from_json(cls, spec: dict) -> "Problem":
        lookup = {(v.row, v.column, v.direction, v.length): v for v in pool_of(spec["size"])}
        vehicles = tuple(lookup[(c["row"], c["column"], c["orientation"], c["length"])] for c in spec["vehicles"])
        return cls(vehicles, spec["size"], frozenset(spec["openings"]), [c["color"] for c in spec["vehicles"]],
                   list(spec["queue"]))

    def key(self) -> str:
        return hashlib.sha256(json.dumps(self.to_json(), sort_keys=True).encode()).hexdigest()[:16]

    def diagram(self) -> str:
        names = "0123456789ab"
        grid = [["." for _ in range(self.size)] for _ in range(self.size)]
        for i, v in enumerate(self.vehicles):
            for j in range(v.length):
                grid[v.row + (j if v.direction == "vertical" else 0)][v.column + (j if v.direction == "horizontal" else 0)] = names[i]

        def edge(side, mark):
            return mark if side in self.openings else "#"

        rows = [edge("left", ">") + "".join(r) + edge("right", "<") for r in grid]
        return "\n".join([" " + edge("top", "v") * self.size + " ", *rows, " " + edge("bottom", "^") * self.size + " "])


# ---------------------------------------------------------------- 厳密探索

State = tuple  # (remaining mask, per color tuple of waiting lengths in arrival order)


class Game:
    def __init__(self, sides, colors, lengths, queue, bays):
        capacity = Counter()
        for c, length in zip(colors, lengths):
            capacity[c] += length
        if capacity != Counter(queue):
            raise ValueError("passengers must match seats per color")
        self.sides, self.colors, self.lengths, self.queue, self.bays = sides, list(colors), list(lengths), list(queue), bays
        self.n = len(sides)
        self.full = (1 << self.n) - 1
        self.palette = sorted(capacity)
        self.color_of = [self.palette.index(c) for c in colors]
        self.queue_colors = [self.palette.index(c) for c in queue]
        self.color_mask = [sum(1 << i for i, c in enumerate(self.color_of) if c == k) for k in range(len(self.palette))]
        self.start: State = (self.full, tuple(() for _ in self.palette))
        self._info, self._legal, self._win, self._reach = {}, {}, {}, {}

    def info(self, mask):
        cached = self._info.get(mask)
        if cached is None:
            supply = [0] * len(self.palette)
            for i in iter_bits(self.full & ~mask):
                supply[self.color_of[i]] += self.lengths[i]
            head = 0
            for c in self.queue_colors:
                if not supply[c]:
                    break
                supply[c] -= 1
                head += 1
            cached = (head, tuple(supply))
            self._info[mask] = cached
        return cached

    def progress(self, state) -> int:
        return self.info(state[0])[0]

    @staticmethod
    def waiting(state) -> int:
        return sum(len(r) for r in state[1])

    def step(self, state, car):
        mask, rows = state
        child = mask & ~(1 << car)
        free = self.info(child)[1]
        settled = []
        for c, row in enumerate(rows):
            if c == self.color_of[car]:
                row = (*row, self.lengths[car])
            consumed = sum(row) - free[c]
            k = 0
            while k < len(row) and consumed >= row[k]:
                consumed -= row[k]
                k += 1
            settled.append(row[k:])
        return child, tuple(settled)

    def geometric_moves(self, mask):
        cached = self._legal.get(mask)
        if cached is None:
            cached = tuple(i for i in iter_bits(mask) if any(not s & mask for s in self.sides[i]))
            self._legal[mask] = cached
        return cached

    def moves(self, state):
        if state[0] == 0 or self.waiting(state) >= self.bays:
            return ()
        return self.geometric_moves(state[0])

    def wins(self, state) -> bool:
        cached = self._win.get(state)
        if cached is None:
            cached = state[0] == 0 or any(self.wins(self.step(state, i)) for i in self.moves(state))
            self._win[state] = cached
        return cached

    def max_reach(self, state) -> int:
        cached = self._reach.get(state)
        if cached is None:
            cached = max([self.progress(state), *(self.max_reach(self.step(state, i)) for i in self.moves(state))])
            self._reach[state] = cached
        return cached

    def solution_count(self) -> int:
        cache = {}

        def count(s):
            if s[0] == 0:
                return 1
            if s not in cache:
                cache[s] = sum(count(self.step(s, i)) for i in self.moves(s))
            return cache[s]

        return count(self.start)

    def win_probability(self, policy: str) -> float:
        """`uniform`: 出せる車から無作為。`head-first`: 先頭の色の車が出せればその中から無作為。"""
        cache = {}

        def visit(s):
            if s[0] == 0:
                return 1.0
            if s in cache:
                return cache[s]
            options = self.moves(s)
            if policy == "head-first" and options:
                head = self.queue_colors[self.progress(s)]
                options = [i for i in options if self.color_of[i] == head] or options
            value = sum(visit(self.step(s, i)) for i in options) / len(options) if options else 0.0
            cache[s] = value
            return value

        return visit(self.start)


def minimum_bays(problem: Problem, geometry: bool = True):
    """解ける最小の待機枠の数。全部出せないなら None。"""
    stuck = len(problem.vehicles) + 1
    probe = problem.game(stuck, geometry)
    cache = {}

    def peak(s):
        if s[0] == 0:
            return 0
        cached = cache.get(s)
        if cached is None:
            values = []
            for i in probe.geometric_moves(s[0]):
                child = probe.step(s, i)
                values.append(max(probe.waiting(child) if child[0] else 0, peak(child)))
            cached = min(values, default=stuck)
            cache[s] = cached
        return cached

    value = peak(probe.start)
    return None if value >= stuck else value + 1


# ---------------------------------------------------------------- 読み手

TIERS = ("cheapest", "headFirst", "run1", "run2", "run3", "all")
TIER_VARIANTS = {name: TIERS[TIERS.index(first):] for name, first in (
    ("naive", "cheapest"), ("run1head", "headFirst"), ("run1", "run1"), ("run2", "run2"), ("all", "all"))}


def window_colors(queue_colors, head, runs):
    colors, seen = set(), 0
    for i in range(head, len(queue_colors)):
        if i == head or queue_colors[i] != queue_colors[i - 1]:
            seen += 1
            if seen > runs:
                break
        colors.add(queue_colors[i])
    return colors


def blocker_closure(sides, mask, seeds):
    found = frontier = seeds
    while frontier:
        added = 0
        for car in iter_bits(frontier):
            for ray in sides[car]:
                added |= ray & mask
        frontier = added & ~found
        found |= frontier
    return found


def cheapest_dig(sides, mask, head_mask):
    costs = {car: min((ray & mask).bit_count() for ray in sides[car]) for car in iter_bits(head_mask)}
    cheapest = min(costs.values())
    seeds = 0
    for car, cost in costs.items():
        if cost == cheapest:
            for ray in sides[car]:
                if (ray & mask).bit_count() == cheapest:
                    seeds |= ray & mask
    return blocker_closure(sides, mask, seeds)


class Model:
    """1つの問題・待機枠の数での読み手たち。罠 = 読み手の候補のうち、どう続けても勝てない手。
    罠の深さ d = その手の後に最善を尽くして乗れる人数（先頭から数える）。d+1 人を見れば負けが見える。"""

    def __init__(self, problem: Problem, bays: int):
        self.problem = problem
        self.game = problem.game(bays)
        self.free = problem.game(bays, geometry=False)
        self.sides = self.game.sides

    def distance(self, state, car) -> int:
        return self.game.max_reach(self.game.step(state, car)) - self.game.progress(state)

    # --- tier の読み手（研究の物差し）
    def tier(self, state, tier):
        game = self.game
        legal = game.moves(state)
        if tier == "all":
            return legal
        mask = state[0]
        head = game.progress(state)
        head_mask = game.color_mask[game.queue_colors[head]] & mask
        if tier in ("cheapest", "headFirst"):
            direct = tuple(i for i in legal if head_mask >> i & 1)
            if direct:
                return direct
            if tier == "cheapest":
                return tuple(i for i in legal if cheapest_dig(self.sides, mask, head_mask) >> i & 1)
            tier = "run1"
        colors = window_colors(game.queue_colors, head, int(tier[3:]))
        targets = sum(game.color_mask[c] for c in colors) & mask
        relevant = blocker_closure(self.sides, mask, targets)
        return tuple(i for i in legal if relevant >> i & 1)

    def tier_candidates(self, state, variant):
        for depth, tier in enumerate(TIER_VARIANTS[variant]):
            options = self.tier(state, tier)
            if any(self.game.wins(self.game.step(state, i)) for i in options):
                return options, depth > 0
        raise ValueError("asked at a losing state")

    # --- 窓の読み手（案B）: 先頭から h 人に出てくる色の車（と、それを塞ぐ車）を候補にする
    def window_candidates(self, state, h, mode):
        game = self.game
        legal = game.moves(state)
        mask = state[0]
        head = game.progress(state)
        end = head + max(h, 1)
        if mode == "run":  # 窓の最後の人の色の区間の終わりまで広げる
            while end < len(game.queue_colors) and game.queue_colors[end] == game.queue_colors[end - 1]:
                end += 1
        colors = set(game.queue_colors[head:end])
        targets = sum(game.color_mask[c] for c in colors) & mask
        relevant = targets if mode == "cars" else blocker_closure(self.sides, mask, targets)
        options = tuple(i for i in legal if relevant >> i & 1)
        if any(game.wins(game.step(state, i)) for i in options):
            return options, False
        return legal, True

    def graph(self, candidates):
        """勝てる候補の手だけでたどれる勝ち局面 R と、各局面の (勝つ子, 罠の(車, 深さ, 列だけ)) 。"""
        game = self.game
        nodes = {}
        order = [game.start]
        while order:
            state = order.pop()
            if state in nodes or state[0] == 0:
                continue
            options, fallback = candidates(state)
            winners, losers, cars = [], [], []
            for car in options:
                child = game.step(state, car)
                if game.wins(child):
                    winners.append(child)
                    cars.append(car)
                else:
                    losers.append((car, self.distance(state, car), not self.free.wins(child)))
            # (勝つ子, 罠の(車, 深さ, 列だけ), 広げたか, 勝つ手の車)
            nodes[state] = (tuple(winners), tuple(losers), fallback, tuple(cars))
            order.extend(c for c in winners if c not in nodes)
        return nodes


def win_probability(nodes, start, horizon):
    """h 人先まで見える読み手（d < h の罠を避け、残りの候補から無作為）の勝率。"""
    cache = {}

    def value(s):
        if s[0] == 0:
            return 1.0
        cached = cache.get(s)
        if cached is None:
            winners, losers = nodes[s][0], nodes[s][1]
            options = len(winners) + sum(1 for _, d, _ in losers if d >= horizon)
            cached = sum(value(c) for c in winners) / options
            cache[s] = cached
        return cached

    return value(start)


def run_bounds(nodes, start, local):
    """勝つ候補を選び続ける筋の上で、local(局面) の (最大の最小, 合計の最小) を返す。
    1つ目: どの勝ち筋を通っても出会う最も深い罠。2つ目: どの勝ち筋でも出会う回数（local>0 を数える）。"""
    cache = {}

    def visit(s):
        if s[0] == 0:
            return 0, 0
        cached = cache.get(s)
        if cached is None:
            here = local(s)
            kids = [visit(c) for c in nodes[s][0]]
            cached = (max(here, min(k[0] for k in kids)), (here > 0) + min(k[1] for k in kids))
            cache[s] = cached
        return cached

    return visit(start)


def first_horizon(curve, level):
    return next((h for h, p in enumerate(curve) if p >= level - 1e-12), len(curve))


def tier_profile(model: Model, variant: str) -> dict:
    game = model.game
    nodes = model.graph(lambda s: model.tier_candidates(s, variant))
    traps = [(s, car, d, q) for s, (_, losers, *_) in nodes.items() for car, d, q in losers]
    lookahead = max((d for *_, d, _ in traps), default=-1) + 1
    curve = [round(win_probability(nodes, game.start, h), 6) for h in range(lookahead + 1)]

    def local_depth(s):
        return max((d for _, d, _ in nodes[s][1]), default=-1) + 1

    unavoidable, _ = run_bounds(nodes, game.start, local_depth)
    _, deep_every = run_bounds(nodes, game.start, lambda s: int(local_depth(s) >= 5))
    _, mid_every = run_bounds(nodes, game.start, lambda s: int(local_depth(s) >= 2))
    queue_only = [t for t in traps if t[3] and t[2] >= 1]
    queue_runs = 0
    for s, _, d, _ in traps:
        head = game.progress(s)
        part = game.queue_colors[head:head + d + 1]
        queue_runs = max(queue_runs, sum(1 for i, c in enumerate(part) if i == 0 or part[i - 1] != c))
    return {"L": lookahead, "Lruns": queue_runs, "curve": curve, "h50": first_horizon(curve, 0.5),
            "h90": first_horizon(curve, 0.9), "U": unavoidable, "deepEvery": deep_every, "midEvery": mid_every,
            "states": len(nodes), "fallback": sum(n[2] for n in nodes.values()), "traps": len(traps),
            "queueOnlyTraps": len(queue_only),
            "Lblocking": max((d for _, _, d, q in traps if not q), default=-1) + 1}


WINDOW_CAP = 24


def window_profile(model: Model, mode: str) -> dict:
    """案B: 窓の読み手の勝率の曲線 q_h。h ごとに候補が変わるので、h ごとに R を作り直す。"""
    game = model.game
    cap = min(len(game.queue), WINDOW_CAP)
    curve, states, fallback = [], 0, 0
    for h in range(cap + 1):
        nodes = model.graph(lambda s, h=h: model.window_candidates(s, h, mode))
        curve.append(round(win_probability(nodes, game.start, h), 6))
        states += len(nodes)
        fallback += sum(n[2] for n in nodes.values())
        if h >= 2 and curve[-1] >= 1 - 1e-12 and curve[-2] >= 1 - 1e-12 and h >= 9:
            break
    full = next((h for h in range(len(curve)) if all(p >= 1 - 1e-12 for p in curve[h:])), len(curve))
    monotone = all(curve[i] <= curve[i + 1] + 1e-12 for i in range(len(curve) - 1))
    return {"curve": curve, "h50": first_horizon(curve, 0.5), "h90": first_horizon(curve, 0.9), "full": full,
            "monotone": monotone, "states": states, "fallback": fallback}


def naive_options(game: Game, state):
    """先頭の色の車が出せれば出す。無ければ塞ぎの少ない先頭色の車を掘る。すぐ詰む手は避ける。"""
    options = tuple(i for i in game.moves(state)
                    if game.step(state, i)[0] == 0 or game.waiting(game.step(state, i)) < game.bays)
    if not options:
        return ()
    mask = state[0]
    head_mask = game.color_mask[game.queue_colors[game.progress(state)]] & mask
    direct = tuple(i for i in options if head_mask >> i & 1)
    if direct:
        return direct
    dig = cheapest_dig(game.sides, mask, head_mask)
    return tuple(i for i in options if dig >> i & 1) or options


def naive_win_probability(game: Game) -> float:
    cache = {}

    def value(s):
        if s[0] == 0:
            return 1.0
        if not game.wins(s):
            return 0.0
        cached = cache.get(s)
        if cached is None:
            options = naive_options(game, s)
            cached = sum(value(game.step(s, i)) for i in options) / len(options) if options else 0.0
            cache[s] = cached
        return cached

    return value(game.start)


# ---------------------------------------------------------------- 案ごとの分類

CUTS = (1, 5, 8)  # Lv2・Lv3・Lv4 の下限（見る人数）
LV5_H50 = 5
NAIVE_CEILING = 0.8


def band(value: int) -> int:
    return 1 + sum(value >= c for c in CUTS)


def level_A(tp: dict, naive: float):
    """案A（研究の物差し）: 自然な読み手の勝率の曲線。h90 で帯、Lv5 は h50>=5。
    最も深い罠が h90 より深い帯にある問題と、Lv3 以上で素朴な解き方が8割勝つ問題は範囲外。"""
    level = band(tp["h90"])
    if band(tp["L"]) > level:
        return None
    if level == 4 and tp["h50"] >= LV5_H50:
        level = 5
    if level >= 3 and naive >= NAIVE_CEILING:
        return None
    return level


def level_B(wp: dict, naive: float):
    """案B（窓の読み手）: 先頭から h 人に出る色の車を候補にする読み手の曲線。帯と除外は案A と同じ形。"""
    level = band(wp["h90"])
    if band(wp["full"]) > level:
        return None
    if level == 4 and wp["h50"] >= LV5_H50:
        level = 5
    if level >= 3 and naive >= NAIVE_CEILING:
        return None
    return level


def level_C(tp: dict, naive: float):
    """案C（必ず出会う罠）: どの勝ち筋でも出会う最も深い罠 U で帯。Lv5 は U>=8 で、5人以上先の罠に
    どの勝ち筋でも2回以上出会う。最も深い罠 L が U より深い帯にある問題は範囲外。"""
    level = band(tp["U"])
    if band(tp["L"]) > level:
        return None
    if level == 4 and tp["deepEvery"] >= 2:
        level = 5
    if level >= 3 and naive >= NAIVE_CEILING:
        return None
    return level


NAIVE_CUTS = (0.9, 0.6, 0.35, 0.15)


def level_D(naive: float):
    """案D（素朴な解き方の勝率）: 先読みの量ではなく、先頭に合う車を出していく人の勝率で帯。"""
    return 1 + sum(naive < c for c in NAIVE_CUTS)


# ---------------------------------------------------------------- 計測

POPULATIONS = {
    # 研究の「有利な条件」: 定員混在・無作為な列・開口が隣り合う2辺か1辺
    "main": {"cars": [8, 10, 12], "opening": ["adjacent2", "one"], "longShare": [0.5], "colors": ["3", "4", "pairs"]},
    # 対照: 定員をそろえる（2だけ・3だけ）
    "short": {"cars": [8, 10, 12], "opening": ["adjacent2", "one"], "longShare": [0.0], "colors": ["3", "4", "pairs"]},
    "long": {"cars": [8, 10, 12], "opening": ["adjacent2", "one"], "longShare": [1.0], "colors": ["3", "4", "pairs"]},
    # 対照: 開口を広げる
    "wide": {"cars": [8, 10, 12], "opening": ["all4", "opposite2"], "longShare": [0.5], "colors": ["3", "4", "pairs"]},
}
SIZES = {8: (6, 7), 10: (7,), 12: (7, 8)}
SLACKS = (0, 1)
BAYS = (2, 3, 4)


def draw(rng, population):
    spec = POPULATIONS[population]
    cars = rng.choice(spec["cars"])
    return {"cars": cars, "size": rng.choice(SIZES[cars]), "opening": rng.choice(spec["opening"]),
            "longShare": rng.choice(spec["longShare"]), "colors": rng.choice(spec["colors"])}


def build(rng, cond) -> Problem:
    openings = OPENINGS_BY_NAME[cond["opening"]]
    board = generate_board(rng, cond["cars"], cond["size"], openings, cond["longShare"])
    colors = assign_colors(rng, cond["cars"], cond["colors"])
    problem = Problem(board, cond["size"], openings, colors, [])
    problem.queue = shuffled_queue(rng, colors, problem.lengths)
    return problem


def analyze(problem: Problem, bays: int, k_min: int, full: bool = True) -> dict:
    model = Model(problem, bays)
    game = model.game
    naive = round(naive_win_probability(game), 6)
    row = {"bays": bays, "slack": bays - k_min, "naive": naive,
           "headFirst": round(game.win_probability("head-first"), 6),
           "uniform": round(game.win_probability("uniform"), 6)}
    variants = TIER_VARIANTS if full else ("run1head",)
    row["tier"] = {v: tier_profile(model, v) for v in variants}
    # "run"（窓を色の区間の終わりまで広げる）は、足される人が窓の最後の人と同じ色なので候補が変わらず、
    # 主の窓の読み手と常に一致する（最初の計測で 0% だった）。記録だけ残して分類の変種には使わない。
    modes = ("both", "cars", "run") if full else ("both",)
    row["window"] = {m: window_profile(model, m) for m in modes}
    row["solutions"] = game.solution_count()
    return row


def level_E(a, b):
    """案E（採用）: 先頭に合わせて出す読み手（案A）と、窓の色を先回りして出す読み手（案B）が
    同じ帯に置く問題だけを、その帯にする。食い違えば範囲外。"""
    return a if a is not None and a == b else None


def levels_of(row: dict) -> dict:
    t, w, n = row["tier"], row["window"], row["naive"]
    out = {"A": level_A(t["run1head"], n), "B": level_B(w["both"], n), "C": level_C(t["run1head"], n),
           "D": level_D(n)}
    out["E"] = level_E(out["A"], out["B"])
    # 数え方の変種（A3）
    for v in ("naive", "run1", "run2", "all"):
        if v in t:
            out[f"A@{v}"] = level_A(t[v], n)
            out[f"C@{v}"] = level_C(t[v], n)
            out[f"E@{v}"] = level_E(out[f"A@{v}"], out["B"])
    if "cars" in w:
        out["B@cars"] = level_B(w["cars"], n)
        out["E@cars"] = level_E(out["A"], out["B@cars"])
    out["D@headFirst"] = level_D(row["headFirst"])
    return out


def relevel(record: dict) -> dict:
    """保存済みの記録の levels を、今の分類の定義で付け直す（特徴は測り直さない）。"""
    for row in record["rows"]:
        row["levels"] = levels_of(row)
    return record


def survey_one(args):
    seed, population, index = args
    begun = time.process_time()
    rng = random.Random(f"shuttle-difficulty:{seed}:{population}:{index}")
    cond = draw(rng, population)
    problem = build(rng, cond)
    k_min = minimum_bays(problem)
    rows = []
    if k_min is not None:
        for slack in SLACKS:
            bays = k_min + slack
            if min(BAYS) <= bays <= max(BAYS):
                row = analyze(problem, bays, k_min)
                row["levels"] = levels_of(row)
                rows.append(row)
    return {"seed": seed, "population": population, "index": index, **cond, "kMin": k_min,
            "kMinFree": minimum_bays(problem, geometry=False), "queueLength": len(problem.queue),
            "queueRuns": sum(1 for i, c in enumerate(problem.queue) if i == 0 or problem.queue[i - 1] != c),
            "rows": rows, "seconds": round(time.process_time() - begun, 4), "problem": problem.to_json()}


def cmd_survey(args):
    jobs = [(args.seed, args.population, i) for i in range(args.start, args.start + args.count)]
    with Pool(args.workers) as pool, open(args.output, "a", encoding="utf-8") as out:
        for record in pool.imap(survey_one, jobs, chunksize=4):
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()


def load_records(paths):
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield relevel(json.loads(line))


def q3(values):
    """10 / 50 / 90 パーセンタイル（件数が少なければ最小・中央・最大）。"""
    values = sorted(values)
    if not values:
        return None
    if len(values) < 10:
        return [values[0], values[len(values) // 2], values[-1]]
    q = statistics.quantiles(values, n=10, method="inclusive")
    return [round(q[0], 3), round(statistics.median(values), 3), round(q[-1], 3)]


def spearman(xs, ys):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2
            i = j + 1
        return r

    if len(xs) < 3:
        return None
    rx, ry = ranks(xs), ranks(ys)
    mx, my = statistics.fmean(rx), statistics.fmean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return round(num / den, 3) if den else None


def share(a, b):
    return round(a / b, 4) if b else None


SCHEMES = ("A", "B", "C", "D", "E")
SCHEME_VARIANTS = {"A": ("A@naive", "A@run1", "A@run2", "A@all"), "B": ("B@cars",),
                   "C": ("C@naive", "C@run1", "C@run2", "C@all"), "D": ("D@headFirst",),
                   "E": ("E@naive", "E@run1", "E@cars", "E@run2", "E@all")}
# E の変種で「その読み手だけのレベル」（交わりを取らない）を比べるための対応
VARIANT_ALONE = {"E@naive": "A@naive", "E@run1": "A@run1", "E@cars": "B@cars", "E@run2": "A@run2", "E@all": "A@all"}


def primary(scheme, row):
    t, w = row["tier"]["run1head"], row["window"]["both"]
    return {"A": t["h90"], "B": w["h90"], "C": t["U"], "D": round(1 - row["naive"], 3), "E": w["h90"]}[scheme]


def digest(records):
    rows = [(r, row) for r in records for row in r["rows"]]
    by_pop = defaultdict(list)
    for r, row in rows:
        by_pop[r["population"]].append((r, row))
    result = {"rows": len(rows), "problems": len(records),
              "cpuSeconds": round(sum(r["seconds"] for r in records), 1)}
    main = by_pop["main"]
    schemes = {}
    for s in SCHEMES:
        block = {}
        levels = [row["levels"][s] for _, row in main]
        block["counts"] = dict(sorted(Counter(str(x) for x in levels).items()))
        block["countsBySlack"] = {str(sl): dict(sorted(Counter(str(row["levels"][s]) for _, row in main
                                                               if row["slack"] == sl).items())) for sl in SLACKS}
        # A3: 数え方の変種でレベルが変わる割合（レベルごと）と、2段以上動く割合
        a3 = {}
        for v in SCHEME_VARIANTS[s]:
            per, two = {}, 0
            scoped = [(row["levels"][s], row["levels"][v]) for _, row in main if row["levels"][s] is not None]
            for lv in range(1, 6):
                sel = [(a, b) for a, b in scoped if a == lv]
                per[str(lv)] = share(sum(a != b for a, b in sel), len(sel))
            two = sum(1 for a, b in scoped if b is None or abs(a - b) >= 2)
            a3[v] = {"all": share(sum(a != b for a, b in scoped), len(scoped)), "byLevel": per,
                     "twoOrMoreOrOut": share(two, len(scoped))}
            alone = VARIANT_ALONE.get(v, v)
            cross = defaultdict(Counter)
            for _, row in main:
                if row["levels"][s] is not None:
                    cross[str(row["levels"][s])][str(row["levels"][alone])] += 1
            far = sum(c for a, cs in cross.items() for b, c in cs.items() if b == "None" or abs(int(a) - int(b)) >= 2)
            a3[v]["aloneCross"] = {a: dict(sorted(cs.items())) for a, cs in sorted(cross.items())}
            a3[v]["aloneTwoOrMoreOrOut"] = share(far, len(scoped))
        block["A3"] = a3
        eight = [(r, row) for r, row in main if r["cars"] == 8]
        block["cars8"] = {
            "rows": len(eight),
            "counts": dict(sorted(Counter(str(row["levels"][s]) for _, row in eight).items())),
            "bySize": {str(z): dict(sorted(Counter(str(row["levels"][s]) for r, row in eight if r["size"] == z).items()))
                       for z in SIZES[8]},
            "primaryByLevel": {str(lv): q3([primary(s, row) for _, row in eight if row["levels"][s] == lv])
                               for lv in range(1, 6)},
            "naiveByLevel": {str(lv): q3([row["naive"] for _, row in eight if row["levels"][s] == lv])
                             for lv in range(1, 6)},
            "h50ByLevel": {str(lv): q3([row["window"]["both"]["h50"] for _, row in eight if row["levels"][s] == lv])
                           for lv in range(1, 6)},
            "queueOnlyByLevel": {str(lv): share(sum(row["tier"]["run1head"]["queueOnlyTraps"] > 0 for _, row in eight
                                                    if row["levels"][s] == lv),
                                                sum(1 for _, row in eight if row["levels"][s] == lv))
                                 for lv in range(1, 6)},
            "baysByLevel": {str(lv): dict(sorted(Counter(f"{row['bays']}/{row['slack']}" for _, row in eight
                                                         if row["levels"][s] == lv).items())) for lv in range(1, 6)},
        }
        # B1・C1・D1: レベルごとの分布
        feats = {}
        for lv in range(1, 6):
            sel = [(r, row) for r, row in main if row["levels"][s] == lv]
            t = [row["tier"]["run1head"] for _, row in sel]
            w = [row["window"]["both"] for _, row in sel]
            feats[str(lv)] = {
                "count": len(sel),
                "primary": q3([primary(s, row) for _, row in sel]),
                "A_h90": q3([x["h90"] for x in t]), "A_h50": q3([x["h50"] for x in t]), "A_L": q3([x["L"] for x in t]),
                "B_h90": q3([x["h90"] for x in w]), "B_h50": q3([x["h50"] for x in w]),
                "C_U": q3([x["U"] for x in t]), "deepEvery": q3([x["deepEvery"] for x in t]),
                "midEvery": q3([x["midEvery"] for x in t]),
                "Lruns": q3([x["Lruns"] for x in t]),
                "naive": q3([row["naive"] for _, row in sel]), "headFirst": q3([row["headFirst"] for _, row in sel]),
                "uniform": q3([row["uniform"] for _, row in sel]),
                "queueLength": q3([r["queueLength"] for r, _ in sel]),
                "cars": dict(sorted(Counter(str(r["cars"]) for r, _ in sel).items())),
                "bays": dict(sorted(Counter(str(row["bays"]) for _, row in sel).items())),
                "slack1": share(sum(row["slack"] == 1 for _, row in sel), len(sel)),
                "withQueueOnlyTrap": share(sum(x["queueOnlyTraps"] > 0 for x in t), len(t)),
                "deepestIsBlocking": share(sum(x["Lblocking"] >= x["L"] for x in t), len(t)),
                "solutions": q3([row["solutions"] for _, row in sel]),
                "entryMoves": None,
            }
        block["features"] = feats
        # B2: 同じ台数での隣のレベルの主な特徴の中央値と、台数・列の長さとレベルの順位相関
        scoped = [(r, row) for r, row in main if row["levels"][s] is not None]
        block["B2"] = {
            "rhoCarsLevel": spearman([r["cars"] for r, _ in scoped], [row["levels"][s] for _, row in scoped]),
            "rhoQueueLevel": spearman([r["queueLength"] for r, _ in scoped], [row["levels"][s] for _, row in scoped]),
            "rhoBaysLevel": spearman([row["bays"] for _, row in scoped], [row["levels"][s] for _, row in scoped]),
            "byCars": {str(c): dict(sorted(Counter(str(row["levels"][s]) for r, row in main if r["cars"] == c).items()))
                       for c in (8, 10, 12)},
            "byBays": {str(b): dict(sorted(Counter(str(row["levels"][s]) for r, row in main if row["bays"] == b).items()))
                       for b in BAYS},
        }
        # A5: 作業量（台数）をそろえた層の中でのレベルの分かれ方は byCars。主な特徴と列の長さの相関（レベル内）
        block["A5"] = {str(lv): spearman([r["queueLength"] for r, row in scoped if row["levels"][s] == lv],
                                         [primary(s, row) for r, row in scoped if row["levels"][s] == lv])
                       for lv in range(2, 6)}
        # E1: 無作為な生成での CPU 1分あたり（全案を測った時間で割るので、下限の目安）
        minutes = sum(r["seconds"] for r in records if r["population"] == "main") / 60
        block["E1perCpuMinuteLowerBound"] = {str(lv): round(sum(1 for _, row in main if row["levels"][s] == lv) / minutes, 2)
                                             for lv in range(1, 6)} if minutes else None
        schemes[s] = block
    result["schemes"] = schemes
    # B4: 系統どうしの相関（主集団の全行）
    t = [row["tier"]["run1head"] for _, row in main]
    w = [row["window"]["both"] for _, row in main]
    result["B4"] = {
        "A_h90~B_h90": spearman([x["h90"] for x in t], [x["h90"] for x in w]),
        "A_h90~C_U": spearman([x["h90"] for x in t], [x["U"] for x in t]),
        "A_h90~naiveLoss": spearman([x["h90"] for x in t], [1 - row["naive"] for _, row in main]),
        "C_U~deepEvery": spearman([x["U"] for x in t], [x["deepEvery"] for x in t]),
        "B_h90~queueLength": spearman([x["h90"] for x in w], [r["queueLength"] for r, _ in main]),
        "B_h90~cars": spearman([x["h90"] for x in w], [r["cars"] for r, _ in main]),
        "windowMonotoneShare": share(sum(x["monotone"] for x in w), len(w)),
    }
    # 案どうしのレベルの一致
    agree = {}
    for a in SCHEMES:
        for b in SCHEMES:
            if a < b:
                pairs = [(row["levels"][a], row["levels"][b]) for _, row in main
                         if row["levels"][a] is not None and row["levels"][b] is not None]
                agree[f"{a}-{b}"] = share(sum(x == y for x, y in pairs), len(pairs))
    result["agreement"] = agree
    # 母集団（定員・開口）ごとの比較
    pops = {}
    for name, sel in by_pop.items():
        t = [row["tier"]["run1head"] for _, row in sel]
        pops[name] = {
            "rows": len(sel),
            "levelsB": dict(sorted(Counter(str(row["levels"]["B"]) for _, row in sel).items())),
            "levelsE": dict(sorted(Counter(str(row["levels"]["E"]) for _, row in sel).items())),
            "levelsE8": dict(sorted(Counter(str(row["levels"]["E"]) for r, row in sel if r["cars"] == 8).items())),
            "levelsA": dict(sorted(Counter(str(row["levels"]["A"]) for _, row in sel).items())),
            "withTrap": share(sum(x["L"] > 0 for x in t), len(t)),
            "blockingShareOfTraps": share(sum(x["traps"] - x["queueOnlyTraps"] for x in t), sum(x["traps"] for x in t)),
            "withQueueOnlyTrap": share(sum(x["queueOnlyTraps"] > 0 for x in t), len(t)),
            "kMin": dict(sorted(Counter(str(r["kMin"]) for r in records if r["population"] == name).items())),
            "unsolvable": sum(1 for r in records if r["population"] == name and r["kMin"] is None),
        }
    result["populations"] = pops
    return result


def cmd_digest(args):
    data = digest(list(load_records(args.surveys)))
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


# ---------------------------------------------------------------- 案F（採用。案E を直したもの）
#
# 案E の読み手は、候補から一様に選ぶので、盤面に見える手がかり（他の車を塞いでいる方を先に出す、など）を
# 使わない2択まで深い罠に数えていた。案F では、測る前に決めた少数の素朴な規則を組にして固定し、
# 先頭に合わせる人はその規則のどれか1つを使えるとする（どれか1つで読む深さが最も浅く済むものを、その問題の値にする）。
# 先回りする人は、h 人見えていても、それより狭い窓で候補を選んでよいとする。


def blocks(game: Game, state, car) -> int:
    """残っている車のうち、いま出られず、car がその進路の上にいる車の数（car を出すと開く見込みのある車）。"""
    mask = state[0]
    count = 0
    for j in iter_bits(mask):
        if j != car and all(ray & mask for ray in game.sides[j]) and any(ray >> car & 1 for ray in game.sides[j]):
            count += 1
    return count


# 先頭の色の車がすぐ出せるとき、その中のどれを選ぶか（固定の組。値の小さい車を選び、同じなら無作為）。
RULES = {
    "headAny": lambda g, s, i: 0,                                  # 先頭の色ならどれでも
    "headSmall": lambda g, s, i: g.lengths[i],                     # 定員の小さい順
    "headBig": lambda g, s, i: -g.lengths[i],                      # 定員の大きい順
    "headUnblock": lambda g, s, i: (-blocks(g, s, i), g.lengths[i]),  # 他を塞いでいる車、並べば定員の小さい順
}


def rule_filter(game: Game, state, options, key):
    head = game.color_mask[game.queue_colors[game.progress(state)]] & state[0]
    direct = [i for i in options if head >> i & 1]
    if not direct:
        return list(options)
    best = min(key(game, state, i) for i in direct)
    return [i for i in direct if key(game, state, i) == best]


def policy_win(game: Game, key) -> float:
    """先読みせず規則だけで出す人の勝率。先頭の色の車が出せなければ塞ぎの最も少ない先頭色の車を掘る。
    すぐ詰む手（待機枠が埋まる手）は避ける（素朴な解き方 `naive_options` と同じ）。"""
    cache = {}

    def value(s):
        if s[0] == 0:
            return 1.0
        if not game.wins(s):
            return 0.0
        cached = cache.get(s)
        if cached is None:
            options = naive_options(game, s)
            options = rule_filter(game, s, options, key) if options else options
            cached = sum(value(game.step(s, i)) for i in options) / len(options) if options else 0.0
            cache[s] = cached
        return cached

    return value(game.start)


def rule_curve(model: Model, nodes, key, cap: int):
    """h 人先まで見える読み手が、d < h の罠を避けた残りの候補に規則 key を当てて選んだときの勝率 p(h)。
    h について単調に増える（罠を避けるほど、選ばれる手の中の負けが減る）。1 に届いたら打ち切る。"""
    game = model.game
    curve = []
    for h in range(cap + 1):
        cache = {}

        def value(s, h=h):
            if s[0] == 0:
                return 1.0
            cached = cache.get(s)
            if cached is None:
                winners, losers, _, cars = nodes[s]
                options = list(cars) + [car for car, d, _ in losers if d >= h]
                options = rule_filter(game, s, options, key)
                win = dict(zip(cars, winners))
                cached = sum(value(win[i]) for i in options if i in win) / len(options)
                cache[s] = cached
            return cached

        curve.append(round(value(game.start), 6))
        if curve[-1] >= 1 - 1e-12:
            break
    return curve


def curve_stats(curve, cap):
    full = len(curve) - 1 if curve[-1] >= 1 - 1e-12 else cap + 1
    return {"curve": curve, "h90": first_horizon(curve, 0.9), "h50": first_horizon(curve, 0.5), "full": full}


def head_family(model: Model, tier: str = "run1head", rules=tuple(RULES)) -> dict:
    """先頭に合わせる人（規則の組のどれか1つを使う）。規則ごとの曲線と、最も浅く済む値。"""
    nodes = model.graph(lambda s: model.tier_candidates(s, tier))
    deepest = max((d for n in nodes.values() for _, d, _ in n[1]), default=-1) + 1
    per = {name: curve_stats(rule_curve(model, nodes, RULES[name], deepest), deepest) for name in rules}
    return {"rules": per, "h90": min(p["h90"] for p in per.values()), "h50": min(p["h50"] for p in per.values()),
            "full": min(p["full"] for p in per.values()), "states": len(nodes), "deepest": deepest,
            "queueOnlyTraps": sum(1 for n in nodes.values() for _, d, q in n[1] if q and d >= 1)}


def window_family(model: Model, mode: str = "both") -> dict:
    """先回りする人: h 人見えていて（d < h の罠を避け）、候補は h 以下の好きな窓 h' から取る。
    p(h) = max_{h'<=h} q(h', h)。窓を狭めてよいので h について単調に増える。"""
    game = model.game
    cap = min(len(game.queue), WINDOW_CAP)
    graphs, curve, states = [], [], 0
    for h in range(cap + 1):
        graphs.append(model.graph(lambda s, h=h: model.window_candidates(s, h, mode)))
        states += len(graphs[-1])
        curve.append(round(max(win_probability(g, game.start, h) for g in graphs), 6))
        if curve[-1] >= 1 - 1e-12:
            break
    return {**curve_stats(curve, cap), "states": states}


def family_level(fam: dict, policy_max: float):
    """深さ（h90 の帯: 0 / 1〜4 / 5〜7 / 8以上）と重なり（h50 が 5 以上 = 5人先まで読んでも半分も勝てない）で決める。
    Lv1: 深さ0。Lv2: 深さ1〜4。Lv3: 深さ5〜7で重ならない。Lv4: 深さ5〜7で重なる、または深さ8以上で重ならない。
    Lv5: 深さ8以上で重なる。上のレベルは深さも重なりも下げない。"""
    depth = band(fam["h90"])
    if band(fam["full"]) > depth:
        return None, "rareDeepTrap"
    overlap = fam["h50"] >= LV5_H50
    if depth <= 2:
        level = depth
    elif depth == 3:
        level = 4 if overlap else 3
    else:
        level = 5 if overlap else 4
    if level >= 3 and policy_max >= NAIVE_CEILING:
        return None, "naiveCeiling"
    return level, None


def level_F(row: dict, head_key="head", window_key="window", cont=("headCont", "windowCont")):
    """案F のレベルと、範囲外の理由。2人の読み手 × 深さの2つの取り方（最善の続き・先頭に合わせた続き）の
    4つのレベルがすべて同じときだけ採る。"""
    pmax = max(row["policies"].values())
    keys = [("head", head_key), ("window", window_key)] + ([("headCont", cont[0]), ("windowCont", cont[1])] if cont else [])
    levels = []
    for label, key in keys:
        level, why = family_level(row[key], pmax)
        if level is None:
            return None, f"{label}:{why}"
        levels.append(level)
    if len(set(levels[:2])) > 1:
        return None, "familiesDisagree"
    if len(set(levels)) > 1:
        return None, "depthDefinitionsDisagree"
    a = levels[0]
    if a <= 2 and pmax == 0:
        return None, "headPoliciesAllLose"  # 先頭に合わせる規則がどれも必ず負ける問題を Lv1・Lv2 に置かない
    return a, None


class MeanDepthModel(Model):
    """数え方の変種: 罠の深さを、負けた後に出せる車から一様に選び続けたときの進みの期待値（切り捨て）で取る。"""

    def __init__(self, problem, bays):
        super().__init__(problem, bays)
        self._mean = {}

    def _expected(self, s):
        cached = self._mean.get(s)
        if cached is None:
            game = self.game
            moves = game.moves(s)
            cached = game.progress(s) if not moves else sum(self._expected(game.step(s, i)) for i in moves) / len(moves)
            self._mean[s] = cached
        return cached

    def distance(self, state, car):
        child = self.game.step(state, car)
        if self.game.wins(child):
            return super().distance(state, car)
        return int(self._expected(child) - self.game.progress(state))


class ContinuationDepthModel(Model):
    """深さの2つ目の取り方: 罠の手の後、先頭に合わせて出し続ける人（素朴な解き方 `naive_options`）が
    詰むまでに乗せる人数の期待値（切り捨て）。罠に気づかずに続けた人が、何人先で詰みに出会うか。"""

    def __init__(self, problem, bays):
        super().__init__(problem, bays)
        self._cont = {}

    def _expected(self, s):
        cached = self._cont.get(s)
        if cached is None:
            game = self.game
            options = naive_options(game, s) if s[0] else ()
            cached = game.progress(s) if not options else sum(self._expected(game.step(s, i)) for i in options) / len(options)
            self._cont[s] = cached
        return cached

    def distance(self, state, car):
        child = self.game.step(state, car)
        if self.game.wins(child):
            return super().distance(state, car)
        return int(self._expected(child) - self.game.progress(state))


def analyze_F(problem: Problem, bays: int, k_min: int, variants: bool = True) -> dict:
    model = Model(problem, bays)
    game = model.game
    row = {"bays": bays, "slack": bays - k_min,
           "policies": {name: round(policy_win(game, key), 6) for name, key in RULES.items()},
           "head": head_family(model), "window": window_family(model)}
    cont = ContinuationDepthModel(problem, bays)
    row["headCont"] = head_family(cont)
    row["windowCont"] = window_family(cont)
    if variants:
        row["v_tierRun1"] = head_family(model, "run1")
        row["v_tierAll"] = head_family(model, "all")
        row["v_windowCars"] = window_family(model, "cars")
        row["v_noUnblock"] = {**row["head"], **{k: min(p[k] for n, p in row["head"]["rules"].items() if n != "headUnblock")
                                               for k in ("h90", "h50", "full")}}
        mean = MeanDepthModel(problem, bays)
        row["v_meanHead"] = head_family(mean)
        row["v_meanWindow"] = window_family(mean)
        row["solutions"] = game.solution_count()
    return row


# 変種: (先頭に合わせる人の鍵, 先回りする人の鍵)。深さの2つ目の取り方（続き）はそのまま当てる。
F_VARIANTS = {"tierRun1": ("v_tierRun1", "window"), "tierAll": ("v_tierAll", "window"),
              "windowCars": ("head", "v_windowCars"), "noUnblock": ("v_noUnblock", "window"),
              "meanDepth": ("v_meanHead", "v_meanWindow")}


def f_levels(record: dict) -> dict:
    """行ごとの案F のレベルと変種のレベル。待機枠を1つ増やした行が元の行より高いレベルなら、増やした行を範囲外にする。"""
    for row in record["rows"]:
        row["F"], row["Fwhy"] = level_F(row)
        row["Fvar"] = {name: level_F(row, *keys)[0] for name, keys in F_VARIANTS.items() if keys[0] in row and keys[1] in row}
    by_slack = {row["slack"]: row for row in record["rows"]}
    if 0 in by_slack and 1 in by_slack:
        low, high = by_slack[0]["F"], by_slack[1]["F"]
        if low is not None and high is not None and high > low:
            by_slack[1]["F"], by_slack[1]["Fwhy"] = None, "moreBaysHigher"
    return record


def fsurvey_one(args):
    seed, index, cars = args
    begun = time.process_time()
    rng = random.Random(f"shuttle-f:{seed}:{cars}:{index}")
    cond = draw_supply(rng, cars)
    problem = build(rng, cond)
    k_min = minimum_bays(problem)
    rows = []
    if k_min is not None:
        for slack in SLACKS:
            bays = k_min + slack
            if min(BAYS) <= bays <= max(BAYS):
                rows.append(analyze_F(problem, bays, k_min))
    record = {"seed": seed, "index": index, **cond, "kMin": k_min, "queueLength": len(problem.queue), "rows": rows,
              "seconds": round(time.process_time() - begun, 4), "problem": problem.to_json()}
    return f_levels(record)


def cmd_fsurvey(args):
    jobs = [(args.seed, i, args.cars) for i in range(args.start, args.start + args.count)]
    with Pool(args.workers) as pool, open(args.output, "a", encoding="utf-8") as out:
        for record in pool.imap(fsurvey_one, jobs, chunksize=4):
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()


def load_f(paths):
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield f_levels(json.loads(line))


def ordering(lower, upper):
    """上のレベルの値が下のレベルの値より大きい確率（同点は半分）。"""
    if not lower or not upper:
        return None
    from bisect import bisect_left, bisect_right
    a = sorted(lower)
    total = sum(bisect_left(a, v) + 0.5 * (bisect_right(a, v) - bisect_left(a, v)) for v in upper)
    return round(total / (len(a) * len(upper)), 3)


def undo_one(args):
    """1手戻す人の戻し回数（7回の中央値）。先頭の色を優先して試す人と、無作為に試す人。"""
    spec, bays, seed, cap = args
    problem = Problem.from_json(spec)
    game = problem.game(bays)
    rng = random.Random(f"shuttle-undo:{seed}:{problem.key()}:{bays}")
    head = sorted(trial_undo(game, rng, cap)[0] for _ in range(7))[3]
    rand = sorted(trial_undo(game, rng, cap, prefer_head=False)[0] for _ in range(7))[3]
    return head, rand


def fdigest(records, undo_per_level, seed, workers, cap):
    rows = [(r, row) for r in records for row in r["rows"]]
    out = {"rows": len(rows), "problems": len(records), "cpuMinutes": round(sum(r["seconds"] for r in records) / 60, 2)}
    out["counts"] = dict(sorted(Counter(str(row["F"]) for _, row in rows).items()))
    out["outReasons"] = dict(Counter(row["Fwhy"] for _, row in rows if row["F"] is None))
    out["countsBySlack"] = {str(s): dict(sorted(Counter(str(row["F"]) for _, row in rows if row["slack"] == s).items()))
                            for s in SLACKS}
    out["countsBySize"] = {str(z): dict(sorted(Counter(str(row["F"]) for r, row in rows if r["size"] == z).items()))
                           for z in (6, 7)}
    feats = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["F"] == lv]
        feats[str(lv)] = {
            "count": len(sel),
            "headH90": q3([row["head"]["h90"] for _, row in sel]), "windowH90": q3([row["window"]["h90"] for _, row in sel]),
            "headH50": q3([row["head"]["h50"] for _, row in sel]), "windowH50": q3([row["window"]["h50"] for _, row in sel]),
            "uniformHeadH90": q3([row["head"]["rules"]["headAny"]["h90"] for _, row in sel]),
            "bestRule": dict(Counter(min(row["head"]["rules"], key=lambda n: (row["head"]["rules"][n]["h90"], n))
                                     for _, row in sel)),
            "policies": {n: q3([row["policies"][n] for _, row in sel]) for n in RULES},
            "policyMax": q3([max(row["policies"].values()) for _, row in sel]),
            "rulesAtLeast09": {n: share(sum(row["policies"][n] >= 0.9 for _, row in sel), len(sel)) for n in RULES},
            "queueOnly": share(sum(row["head"]["queueOnlyTraps"] > 0 for _, row in sel), len(sel)),
            "queueLength": q3([r["queueLength"] for r, _ in sel]),
            "bays": dict(sorted(Counter(f"{row['bays']}/{row['slack']}" for _, row in sel).items())),
            "solutions": q3([row["solutions"] for _, row in sel]),
        }
    out["features"] = feats
    # A3
    a3 = {}
    scoped = [row for _, row in rows if row["F"] is not None]
    for name in F_VARIANTS:
        pairs = [(row["F"], row["Fvar"][name]) for row in scoped]
        a3[name] = {"changed": share(sum(a != b for a, b in pairs), len(pairs)),
                    "twoOrMoreOrOut": share(sum(b is None or abs(a - b) >= 2 for a, b in pairs), len(pairs)),
                    "byLevel": {str(lv): share(sum(a != b for a, b in pairs if a == lv), sum(1 for a, _ in pairs if a == lv))
                                for lv in range(1, 6)}}
    # 変種の読み手だけのレベル（2人の一致を取らない）と元のレベルの差
    for name, (hk, wk) in F_VARIANTS.items():
        key = hk if hk != "head" else wk
        moved = far = n = 0
        for row in scoped:
            if key not in row:
                continue
            alone = family_level(row[key], max(row["policies"].values()))[0]
            n += 1
            moved += alone != row["F"]
            far += alone is None or abs(alone - row["F"]) >= 2
        a3[name]["aloneChanged"] = share(moved, n)
        a3[name]["aloneTwoOrMoreOrOut"] = share(far, n)
    out["A3"] = a3
    # 待機枠を増やしたときの検査（直した後に残る、上がる組の数）
    pairs = mono = higher_h90 = 0
    for r in records:
        by = {row["slack"]: row for row in r["rows"]}
        if 0 in by and 1 in by:
            pairs += 1
            a, b = by[0]["F"], by[1]["F"]
            mono += a is not None and b is not None and b > a
            higher_h90 += by[1]["window"]["h90"] > by[0]["window"]["h90"] or by[1]["head"]["h90"] > by[0]["head"]["h90"]
    out["moreBays"] = {"pairs": pairs, "levelHigherAfterCheck": mono, "h90Higher": higher_h90,
                       "removedByCheck": sum(1 for _, row in rows if row["Fwhy"] == "moreBaysHigher")}
    # 戻し回数（標本）
    rng = random.Random(f"shuttle-undo-pick:{seed}")
    picked = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["F"] == lv]
        rng.shuffle(sel)
        picked[lv] = sel[:undo_per_level]
    with Pool(workers) as pool:
        undos = {lv: pool.map(undo_one, [(r["problem"], row["bays"], seed, cap) for r, row in picked[lv]])
                 for lv in range(1, 6)}
    out["undo"] = {str(lv): {"n": len(u), "headFirst": q3([a for a, _ in u]), "random": q3([b for _, b in u]),
                             "headFirstMedian": statistics.median([a for a, _ in u]) if u else None}
                   for lv, u in undos.items()}
    out["undoOrder"] = {f"{lv}-{lv + 1}": {"headFirst": ordering([a for a, _ in undos[lv]], [a for a, _ in undos[lv + 1]]),
                                           "random": ordering([b for _, b in undos[lv]], [b for _, b in undos[lv + 1]])}
                        for lv in range(1, 5)}
    out["undoSample"] = {str(lv): [{"id": f"{r['seed']}:{r['index']}", "bays": row["bays"], "undoHead": u[0], "undoRandom": u[1]}
                                   for (r, row), u in zip(picked[lv], undos[lv])] for lv in range(1, 6)}
    # B2・A5（8台に固定）
    sc = [(r, row) for r, row in rows if row["F"] is not None]
    out["rho"] = {"queueLength~level": spearman([r["queueLength"] for r, _ in sc], [row["F"] for _, row in sc]),
                  "slack~level": spearman([row["slack"] for _, row in sc], [row["F"] for _, row in sc]),
                  "headH90~windowH90": spearman([row["head"]["h90"] for _, row in sc], [row["window"]["h90"] for _, row in sc]),
                  "windowH90~policyLoss": spearman([row["window"]["h90"] for _, row in sc],
                                                   [1 - max(row["policies"].values()) for _, row in sc])}
    out["E1perCpuMinuteLowerBound"] = {str(lv): round(feats[str(lv)]["count"] / out["cpuMinutes"], 1) for lv in range(1, 6)}
    return out


def cmd_fdigest(args):
    data = fdigest(list(load_f(args.surveys)), args.undo_per_level, args.seed, args.workers, args.cap)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


# ---------------------------------------------------------------- 案G（採用。案F を直したもの）
#
# 案F は「h 人先まで読めば何割勝てるか」を、同点を無作為に割った勝率で測っていた。これでは、二択の罠に
# 1回だけ出会う問題と、罠を何度も通る問題が区別できない。案G は、勝ち筋の上で「どの勝ち筋を通っても
# 出会う罠の回数」を、罠の結果が何人先に出るか（深さ）の段ごとに数え、回数と深さでレベルを決める。
# 罠かどうかは、前もって固定した素朴な規則の組のどれか1つに従う人から見て決める（規則で避けられる手は罠に数えない）。
# 待機枠は解ける最小の数だけにする（枠を増やすと易しくなるとは限らないので、枠を変えた比較を判定に入れない）。

G_INF = 10 ** 6


def blocked_by(game: Game, state, car):
    """残っている車のうち、いま出られず、car がその進路の上にいる車。"""
    mask = state[0]
    return [j for j in iter_bits(mask)
            if j != car and all(ray & mask for ray in game.sides[j]) and any(ray >> car & 1 for ray in game.sides[j])]


def shortage_positions(game: Game, state, exclude=None):
    """色ごとに、外に出ている車の空き座席と、いますぐ出せる車（exclude 以外）の座席で、列のどこで足りなくなるか。"""
    head, supply = game.info(state[0])
    supply = list(supply)
    for j in game.geometric_moves(state[0]):
        if j != exclude:
            supply[game.color_of[j]] += game.lengths[j]
    short = {}
    for k in range(head, len(game.queue_colors)):
        c = game.queue_colors[k]
        if supply[c] > 0:
            supply[c] -= 1
        elif c not in short:
            short[c] = k
    return short


def key_needed(game, state, car):
    """塞いでいる車の色が最も早く足りなくなる車を先に（定員から逆算）。並べば定員の小さい車。"""
    short = shortage_positions(game, state, car)
    return (min((short.get(game.color_of[j], G_INF) for j in blocked_by(game, state, car)), default=G_INF),
            game.lengths[car])


def key_fill(game, state, car):
    """出すと座席が最も早く埋まって出ていく車を先に（その色の列の何人目で埋まるか）。"""
    head, supply = game.info(state[0])
    c = game.color_of[car]
    target, seen = supply[c] + game.lengths[car], 0
    for k in range(head, len(game.queue_colors)):
        if game.queue_colors[k] == c:
            seen += 1
            if seen == target:
                return k
    return G_INF


G_KEYS = {
    "any": lambda g, s, i: 0,
    "small": lambda g, s, i: g.lengths[i],
    "big": lambda g, s, i: -g.lengths[i],
    "unblock": lambda g, s, i: (-len(blocked_by(g, s, i)), g.lengths[i]),
    "needed": key_needed,
    "fill": key_fill,
}


def wide_options(game: Game, state):
    """掘る場面で、塞ぎの最も少ない先頭色の車だけでなく、どの先頭色の車を掘ってもよい候補。"""
    moves = [i for i in game.moves(state) if game.step(state, i)[0] == 0 or game.waiting(game.step(state, i)) < game.bays]
    if not moves:
        return ()
    mask = state[0]
    head_mask = game.color_mask[game.queue_colors[game.progress(state)]] & mask
    direct = [i for i in moves if head_mask >> i & 1]
    if direct:
        return tuple(direct)
    seeds = 0
    for car in iter_bits(head_mask):
        for ray in game.sides[car]:
            seeds |= ray & mask
    dig = blocker_closure(game.sides, mask, seeds)
    return tuple(i for i in moves if dig >> i & 1) or tuple(moves)


# 素朴な規則の組（前もって固定する。掘る場面にも、先頭色をすぐ出せる場面にも同じ鍵を当てる）
G_RULES = {
    "any": ("cheapest", "any"), "small": ("cheapest", "small"), "big": ("cheapest", "big"),
    "unblock": ("cheapest", "unblock"), "needed": ("cheapest", "needed"), "fill": ("cheapest", "fill"),
    "wideNeeded": ("wide", "needed"), "wideFill": ("wide", "fill"),
}
G_RULES_OLD = ("any", "small", "big", "unblock")  # 数え方の変種: 案F の4規則だけ


def g_rule_options(game: Game, state, rule):
    base, key = G_RULES[rule]
    options = naive_options(game, state) if base == "cheapest" else wide_options(game, state)
    if not options:
        return ()
    fn = G_KEYS[key]
    values = {i: fn(game, state, i) for i in options}
    best = min(values.values())
    return tuple(i for i in options if values[i] == best)


def g_policy_win(game: Game, rule) -> float:
    """先読みせず規則だけで出す人の勝率（候補が同点なら一様）。"""
    cache = {}

    def value(s):
        if s[0] == 0:
            return 1.0
        if not game.wins(s):
            return 0.0
        cached = cache.get(s)
        if cached is None:
            options = g_rule_options(game, s, rule)
            cached = sum(value(game.step(s, i)) for i in options) / len(options) if options else 0.0
            cache[s] = cached
        return cached

    return value(game.start)


G_THRESHOLDS = (1, 5, 8)  # 罠の結果が何人先に出るか（見る人数 = 深さ + 1）の段


def g_counts(model: Model, widen=("headFirst", "run1", "run2", "run3", "all")) -> dict:
    """先頭に合わせる人の勝ち筋の上で、罠に出会う回数を、罠の重さの段ごとに数える。

    局面ごとの候補: widen の段を順に試し、勝つ手を含む最初の段（既定では、先頭の色の車ですぐ出せる車 →
    先頭の色の車とそれを間接的にも塞ぐ車 → 列の2つ目の色の区間まで → 3つ目まで → 出せる車すべて）。
    候補に負ける手があれば、その局面は罠に出会う局面で、罠の重さは負ける手の深さ（その手の後に乗れる人数）の
    最大 +1（負けが見えるのに要る人数）。勝ち筋 = 各局面で候補のうち勝つ手だけを選び続ける筋。
    返り値: 段 θ（1・5・8）ごとに、どの勝ち筋でも出会う「重さ θ 以上の罠」の回数の最小（K1・K5・K8）と、
    最も多く出会う勝ち筋での重さ1以上の回数（K1max）、局面の数。"""
    game = model.game
    memo = {}

    def options(s):
        for tier in widen:
            opts = model.tier(s, tier)
            if any(game.wins(game.step(s, i)) for i in opts):
                return opts
        raise ValueError("winning state without a winning move")

    def visit(s):
        if s[0] == 0:
            return (0,) * (len(G_THRESHOLDS) + 1)
        cached = memo.get(s)
        if cached is None:
            opts = options(s)
            winners = [game.step(s, i) for i in opts if game.wins(game.step(s, i))]
            weight = max((model.distance(s, i) + 1 for i in opts if not game.wins(game.step(s, i))), default=0)
            kids = [visit(c) for c in winners]
            mins = tuple((weight >= t) + min(k[n] for k in kids) for n, t in enumerate(G_THRESHOLDS))
            cached = (*mins, (weight >= 1) + max(k[-1] for k in kids))
            memo[s] = cached
        return cached

    counts = visit(game.start)
    return {"K1": counts[0], "K5": counts[1], "K8": counts[2], "K1max": counts[3], "states": len(memo)}


def g_level_from_counts(c: dict) -> int:
    """Lv1: どの勝ち筋でも罠に出会わない（先頭に合わせて出せば、どれを選んでも勝てる）。
    Lv2: 罠に出会うが、どの勝ち筋でも5人以上先の罠には出会わずに済む。Lv3: 5人以上先の罠に、どの勝ち筋でも1回。
    Lv4: 5人以上先の罠に、どの勝ち筋でも2回。
    Lv5: 深い罠が重なる。どの勝ち筋でも、5人以上先の罠に3回以上か、8人以上先の罠に2回以上出会う。"""
    if c["K1max"] == 0:
        return 1
    if c["K5"] == 0:
        return 2
    if c["K5"] == 1:
        return 3
    return 5 if c["K5"] >= 3 or c["K8"] >= 2 else 4


def g_family(model: Model, widen=("headFirst", "run1", "run2", "run3", "all")) -> dict:
    counts = g_counts(model, widen)
    return {**counts, "level": g_level_from_counts(counts)}


def analyze_G(problem: Problem, bays: int, variants: bool = True) -> dict:
    model = Model(problem, bays)
    cont = ContinuationDepthModel(problem, bays)
    game = model.game
    row = {"bays": bays, "policies": {r: round(g_policy_win(game, r), 6) for r in G_RULES},
           "best": g_family(model), "cont": g_family(cont),
           "window": g_family(WindowFixedModel(problem, bays, G_WINDOW), widen=("window",))}
    if variants:
        row["v_widenAll"] = g_family(model, widen=("all",))
        row["v_digCheapest"] = g_family(model, widen=("cheapest", "headFirst", "run1", "run2", "run3", "all"))
        row["v_window3"] = g_family(WindowFixedModel(problem, bays, 3), widen=("window",))
        row["v_window8"] = g_family(WindowFixedModel(problem, bays, 8), widen=("window",))
        mean = MeanDepthModel(problem, bays)
        row["v_meanDepth"] = g_family(mean)
        row["solutions"] = game.solution_count()
    return row


G_WINDOW = 5  # 先回りする人が候補にする窓（先頭から何人に出てくる色か）


def level_G(row: dict, keys=("best", "cont"), rules=tuple(G_RULES), window="window"):
    """案G のレベルと範囲外の理由。
    - 先頭に合わせる人で、深さの2つの取り方（最善の続き・先頭に合わせて続けた場合）が同じレベルであること。
    - 先回りする人（窓 G_WINDOW 人）でも同じレベルであること。ただし Lv1 では、先回りする人が浅い罠（Lv2）に
      出会うのは許す（先頭に合わせて出せば罠に出会わない、という Lv1 の意味は保たれる）。
    - Lv3 以上で、規則の組のどれかの勝率が 0.8 以上なら範囲外。Lv2 で、規則が全部必ず負けるなら範囲外。"""
    levels = [g_level_from_counts(row[k]) for k in keys]
    if len(set(levels)) > 1:
        return None, "depthDefinitionsDisagree"
    level = levels[0]
    if window is not None:
        w = g_level_from_counts(row[window])
        if not (w == level or (level == 1 and w == 2)):
            return None, "playStylesDisagree"
    pmax = max(row["policies"][r] for r in rules)
    if level >= 3 and pmax >= NAIVE_CEILING:
        return None, "naiveCeiling"
    if level <= 2 and level >= 2 and pmax == 0:
        return None, "headPoliciesAllLose"
    return level, None


# 変種: 名前 → (先頭に合わせる人の鍵の組, 規則の組, 先回りする人の鍵)
G_VARIANTS = {"oldRules": (("best", "cont"), G_RULES_OLD, "window"),
              "widenAll": (("v_widenAll", "cont"), tuple(G_RULES), "window"),
              "digCheapest": (("v_digCheapest", "cont"), tuple(G_RULES), "window"),
              "window3": (("best", "cont"), tuple(G_RULES), "v_window3"),
              "window8": (("best", "cont"), tuple(G_RULES), "v_window8"),
              "meanDepth": (("v_meanDepth", "cont"), tuple(G_RULES), "window"),
              "noWindowCheck": (("best", "cont"), tuple(G_RULES), None)}
# 変種の読み手だけのレベル（一致を取らない）を比べるための鍵
G_VARIANT_ALONE = {"widenAll": "v_widenAll", "digCheapest": "v_digCheapest", "window3": "v_window3",
                   "window8": "v_window8", "meanDepth": "v_meanDepth"}


class WindowFixedModel(Model):
    """数え方の変種: 先回りする人（先頭から w 人に出てくる色の車と、それを塞ぐ車を候補にする）。"""

    def __init__(self, problem, bays, w):
        super().__init__(problem, bays)
        self.w = w

    def tier(self, state, tier):
        if tier == "window":
            return self.window_candidates(state, self.w, "both")[0]
        return super().tier(state, tier)


def g_levels(record: dict) -> dict:
    for row in record["rows"]:
        row["G"], row["Gwhy"] = level_G(row)
        row["Gvar"] = {n: level_G(row, keys, rules, w)[0] for n, (keys, rules, w) in G_VARIANTS.items()
                       if all(k in row for k in keys) and (w is None or w in row)}
    return record


def gsurvey_one(args):
    seed, index, cars = args
    begun = time.process_time()
    rng = random.Random(f"shuttle-g:{seed}:{cars}:{index}")
    cond = draw_supply(rng, cars)
    problem = build(rng, cond)
    k_min = minimum_bays(problem)
    rows = []
    if k_min is not None and min(BAYS) <= k_min <= max(BAYS):
        rows.append(analyze_G(problem, k_min))
    record = {"seed": seed, "index": index, **cond, "kMin": k_min, "queueLength": len(problem.queue), "rows": rows,
              "seconds": round(time.process_time() - begun, 4), "problem": problem.to_json()}
    return g_levels(record)


def cmd_gsurvey(args):
    jobs = [(args.seed, i, args.cars) for i in range(args.start, args.start + args.count)]
    with Pool(args.workers) as pool, open(args.output, "a", encoding="utf-8") as out:
        for record in pool.imap(gsurvey_one, jobs, chunksize=4):
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()


def load_g(paths):
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield g_levels(json.loads(line))


def trial_undo_g(game: Game, rng: random.Random, cap: int, order_kind: str, remember: bool = False):
    """1手戻す人。order_kind: headFirst（先頭の色を先に）/ random / rule（規則 needed の候補を先に、次に先頭の色）。
    remember: 詰んだと分かった局面を覚えて、もう入らない。"""
    dead = set()

    def order(s):
        moves = list(game.moves(s))
        rng.shuffle(moves)
        if not s[0] or not moves:
            return iter(moves)
        head = game.queue_colors[game.progress(s)]
        if order_kind == "headFirst":
            moves.sort(key=lambda i: game.color_of[i] != head)
        elif order_kind == "rule":
            pref = set(g_rule_options(game, s, "needed"))
            moves.sort(key=lambda i: (i not in pref, game.color_of[i] != head))
        return iter(moves)

    stack = [(game.start, order(game.start))]
    undos = 0
    while stack:
        state, it = stack[-1]
        if state[0] == 0:
            return undos
        car = next(it, None)
        if car is None:
            dead.add(state)
            stack.pop()
            undos += 1
            if undos > cap:
                return undos
            continue
        child = game.step(state, car)
        if remember and child in dead:
            continue
        stack.append((child, order(child)))
    return undos


G_UNDO = {"headFirst": ("headFirst", False), "random": ("random", False), "rule": ("rule", False),
          "remember": ("headFirst", True)}


def g_undo_one(args):
    spec, bays, seed, cap = args
    problem = Problem.from_json(spec)
    game = problem.game(bays)
    rng = random.Random(f"shuttle-gundo:{seed}:{problem.key()}:{bays}")
    return {name: sorted(trial_undo_g(game, rng, cap, kind, rem) for _ in range(7))[3]
            for name, (kind, rem) in G_UNDO.items()}


def g_placebo_one(args):
    """意味のない好みの人（車ごとに固定の優先順。8通り）: 素朴な解き方の候補から、優先順の最も高い車を必ず選ぶ。勝った人数。"""
    spec, bays, seed = args
    problem = Problem.from_json(spec)
    game = problem.game(bays)
    wins = 0
    for t in range(8):
        rng = random.Random(f"shuttle-placebo:{seed}:{problem.key()}:{t}")
        priority = list(range(game.n))
        rng.shuffle(priority)
        s = game.start
        while s[0]:
            options = naive_options(game, s)
            if not options:
                break
            s = game.step(s, min(options, key=lambda i: priority[i]))
        wins += s[0] == 0
    return wins


def gdigest(records, undo_per_level, seed, workers, cap):
    rows = [(r, row) for r in records for row in r["rows"]]
    out = {"rows": len(rows), "problems": len(records), "cpuMinutes": round(sum(r["seconds"] for r in records) / 60, 2)}
    out["counts"] = dict(sorted(Counter(str(row["G"]) for _, row in rows).items()))
    out["outReasons"] = dict(Counter(row["Gwhy"] for _, row in rows if row["G"] is None))
    out["countsBySize"] = {str(z): dict(sorted(Counter(str(row["G"]) for r, row in rows if r["size"] == z).items())) for z in (6, 7)}
    out["countsByOpening"] = {o: dict(sorted(Counter(str(row["G"]) for r, row in rows if r["opening"] == o).items()))
                              for o in ("one", "adjacent2")}
    out["countsByColors"] = {c: dict(sorted(Counter(str(row["G"]) for r, row in rows if r["colors"] == c).items()))
                             for c in ("3", "4", "pairs")}
    out["countsByBays"] = {str(b): dict(sorted(Counter(str(row["G"]) for _, row in rows if row["bays"] == b).items())) for b in BAYS}
    feats = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["G"] == lv]
        best = [row["best"] for _, row in sel]
        feats[str(lv)] = {
            "count": len(sel),
            "K1": q3([c["K1"] for c in best]), "K5": q3([c["K5"] for c in best]), "K8": q3([c["K8"] for c in best]),
            "K1max": q3([c["K1max"] for c in best]),
            "policies": {r: q3([row["policies"][r] for _, row in sel]) for r in G_RULES},
            "policyMax": q3([max(row["policies"].values()) for _, row in sel]),
            "rulesAtLeast08": {r: share(sum(row["policies"][r] >= 0.8 for _, row in sel), len(sel)) for r in G_RULES},
            "queueLength": q3([r["queueLength"] for r, _ in sel]),
            "bays": dict(sorted(Counter(str(row["bays"]) for _, row in sel).items())),
            "solutions": q3([row["solutions"] for _, row in sel]),
        }
    out["features"] = feats
    scoped = [row for _, row in rows if row["G"] is not None]
    a3 = {}
    for name in G_VARIANTS:
        pairs = [(row["G"], row["Gvar"].get(name)) for row in scoped]
        a3[name] = {"changed": share(sum(a != b for a, b in pairs), len(pairs)),
                    "twoOrMoreOrOut": share(sum(b is None or abs(a - b) >= 2 for a, b in pairs), len(pairs)),
                    "byLevel": {str(lv): share(sum(a != b for a, b in pairs if a == lv), sum(1 for a, _ in pairs if a == lv))
                                for lv in range(1, 6)},
                    "cross": {str(lv): dict(Counter(str(b) for a, b in pairs if a == lv)) for lv in range(1, 6)}}
        if name in G_VARIANT_ALONE:
            alone = [(row["G"], g_level_from_counts(row[G_VARIANT_ALONE[name]])) for row in scoped]
            a3[name]["aloneChanged"] = share(sum(a != b for a, b in alone), len(alone))
            a3[name]["aloneTwoOrMore"] = share(sum(abs(a - b) >= 2 for a, b in alone), len(alone))
            a3[name]["aloneCross"] = {str(lv): dict(Counter(str(b) for a, b in alone if a == lv)) for lv in range(1, 6)}
    out["A3"] = a3
    rng = random.Random(f"shuttle-gundo-pick:{seed}")
    picked = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["G"] == lv]
        rng.shuffle(sel)
        picked[lv] = sel[:undo_per_level]
    with Pool(workers) as pool:
        undos = {lv: pool.map(g_undo_one, [(r["problem"], row["bays"], seed, cap) for r, row in picked[lv]]) for lv in range(1, 6)}
        placebo = {lv: pool.map(g_placebo_one, [(r["problem"], row["bays"], seed) for r, row in picked[lv]]) for lv in range(1, 6)}
    out["undo"] = {str(lv): {"n": len(u), **{name: q3([x[name] for x in u]) for name in G_UNDO}} for lv, u in undos.items()}
    out["undoOrder"] = {f"{lv}-{lv + 1}": {name: ordering([x[name] for x in undos[lv]], [x[name] for x in undos[lv + 1]])
                                           for name in G_UNDO} for lv in range(1, 5)}
    out["placebo"] = {str(lv): {"allWin": share(sum(w == 8 for w in p), len(p)), "split": share(sum(0 < w < 8 for w in p), len(p)),
                                "allLose": share(sum(w == 0 for w in p), len(p)), "meanWins": round(statistics.fmean(p), 2) if p else None}
                      for lv, p in placebo.items()}
    # Lv5 の色数・待機枠ごとの戻し回数（偏りの確かめ）
    by = defaultdict(list)
    for lv in (4, 5):
        for (r, row), u in zip(picked[lv], undos[lv]):
            by[f"{lv}:colors{r['colors']}"].append(u)
            by[f"{lv}:bays{row['bays']}"].append(u)
    out["undoByGroup"] = {k: {"n": len(v), "remember": q3([x["remember"] for x in v]), "headFirst": q3([x["headFirst"] for x in v]),
                              "K5": None} for k, v in sorted(by.items())}
    out["undoSample"] = {str(lv): [{"id": f"{r['seed']}:{r['index']}", "bays": row["bays"], **u}
                                   for (r, row), u in zip(picked[lv], undos[lv])] for lv in range(1, 6)}
    sc = [(r, row) for r, row in rows if row["G"] is not None]
    out["rho"] = {"queueLength~level": spearman([r["queueLength"] for r, _ in sc], [row["G"] for _, row in sc])}
    out["E1perCpuMinuteLowerBound"] = {str(lv): round(feats[str(lv)]["count"] / out["cpuMinutes"], 1) for lv in range(1, 6)}
    return out


def cmd_gdigest(args):
    data = gdigest(list(load_g(args.surveys)), args.undo_per_level, args.seed, args.workers, args.cap)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


# ---------------------------------------------------------------- 案H（採用。案G を直したもの）
#
# 案G は罠を「局面」の数で数えていたので、先頭の色の車を出すために塞ぐ車を1台ずつ出している間、
# 同じ「その車を先に出してはいけない」罠が局面ごとに数え直され、回数が掘る台数（作業量）で増えた。
# 案H は罠を「判断」で数える: 勝ち筋の上で、同じ車が罠のまま続く局面の並びを1つの判断とする。
# 量の取り方は全レベルで「どの勝ち筋でも」にそろえ、勝ち筋の最小と最大で同じレベルになる問題だけを採る。
# 深さと回数は、どちらも上のレベルで下がらない格子に組む。

H_THRESHOLDS = (1, 5, 8, 10)


def h_counts(model: Model, widen=("headFirst", "run1", "run2", "run3", "all"), thresholds=H_THRESHOLDS) -> dict:
    """勝ち筋の上の判断を、重さの段ごとに数える。

    局面ごとの候補と罠の重さは案G と同じ（`g_counts`）。段 θ ごとに、その局面で重さ θ 以上の罠になっている車の
    集合 T_θ を取る（罠の重さ = その車の深さ + 1）。勝ち筋の上で、T_θ が空でなく、直前の局面の T_θ と共通の車が
    無いとき、新しい判断として1回数える（共通の車があれば、同じ判断が続いているとみなす）。
    返り値: 段ごとの、どの勝ち筋でも出会う判断の回数の最小（D1・D5・D8）と最大（D1max・D5max・D8max）、
    通った（局面, 直前の罠の集合）の組の数 states。"""
    game = model.game
    memo = {}
    n = len(thresholds)

    def options(s):
        for tier in widen:
            opts = model.tier(s, tier)
            if any(game.wins(game.step(s, i)) for i in opts):
                return opts
        raise ValueError("winning state without a winning move")

    def visit(s, previous):
        if s[0] == 0:
            return (0,) * (2 * n)
        key = (s, previous)
        cached = memo.get(key)
        if cached is None:
            opts = options(s)
            masks = [0] * n
            winners = []
            for i in opts:
                child = game.step(s, i)
                if game.wins(child):
                    winners.append(child)
                    continue
                weight = model.distance(s, i) + 1
                for k, t in enumerate(thresholds):
                    if weight >= t:
                        masks[k] |= 1 << i
            new = [int(bool(m) and not m & p) for m, p in zip(masks, previous)]
            kids = [visit(c, tuple(masks)) for c in winners]
            cached = (tuple(new[k] + min(x[k] for x in kids) for k in range(n))
                      + tuple(new[k] + max(x[n + k] for x in kids) for k in range(n)))
            memo[key] = cached
        return cached

    c = visit(game.start, (0,) * n)
    out = {f"D{t}": c[k] for k, t in enumerate(thresholds)}
    out.update({f"D{t}max": c[n + k] for k, t in enumerate(thresholds)})
    out["states"] = len(memo)
    return out


def h_level(d1, d5, d8) -> int:
    """判断の回数（重さ 1・5・8 以上）からレベル。深さも回数も上のレベルで下がらない格子。
    Lv1: 判断なし。Lv2: 判断はあるが、どれも結果が4人先まで。Lv3: 5〜7人先の判断が1つ（8人以上先なし）。
    Lv4: 5人以上先の判断が2つで8人以上先なし、または5人以上先の判断が1つでそれが8人以上先。
    Lv5: 5人以上先の判断が3つ以上、または2つ以上でうち1つ以上が8人以上先。"""
    if d1 == 0:
        return 1
    if d5 == 0:
        return 2
    if d5 == 1:
        return 4 if d8 >= 1 else 3
    if d5 == 2 and d8 == 0:
        return 4
    return 5


def h_level_depth(d1, d5, d8, d10) -> int:
    """深さの段（案H の採用）: どの勝ち筋でも出会う判断のうち、最も重いものの段でレベルを決める。
    Lv1: 判断なし。Lv2: 判断はどれも結果が4人先まで。Lv3: 5〜7人先の判断がある（8人以上先は避けられる）。
    Lv4: 8〜9人先の判断がある。Lv5: 10人以上先の判断がある。"""
    if d1 == 0:
        return 1
    if d5 == 0:
        return 2
    if d8 == 0:
        return 3
    if d10 == 0:
        return 4
    return 5


H_SCHEME = "depth"  # 採用。"lattice" は回数と深さの格子（比較用）


def h_family(model: Model, widen=("headFirst", "run1", "run2", "run3", "all"), thresholds=H_THRESHOLDS) -> dict:
    """thresholds は (1, a, b, c) の4段。レベルの関数には段の値を順に渡す（境目を動かす変種もこの形）。"""
    c = h_counts(model, widen, thresholds)
    lo = [c[f"D{t}"] for t in thresholds]
    hi = [c[f"D{t}max"] for t in thresholds]
    return {**c, "depthMin": h_level_depth(*lo), "depthMax": h_level_depth(*hi),
            "latticeMin": h_level(*lo[:3]), "latticeMax": h_level(*hi[:3])}


def h_reader_curve(model: Model) -> dict:
    """記録だけ: 先頭に合わせる人（一様に選ぶ）が h 人先まで見えるときの勝率 p(4)・p(7)（案A の曲線）。"""
    nodes = model.graph(lambda s: model.tier_candidates(s, "run1head"))
    return {f"p{h}": round(win_probability(nodes, model.game.start, h), 6) for h in (4, 7)}


def analyze_H(problem: Problem, bays: int, variants: bool = True) -> dict:
    model = Model(problem, bays)
    cont = ContinuationDepthModel(problem, bays)
    game = model.game
    row = {"bays": bays, "policies": {r: round(g_policy_win(game, r), 6) for r in G_RULES},
           "best": h_family(model), "cont": h_family(cont),
           "window": h_family(WindowFixedModel(problem, bays, G_WINDOW), widen=("window",))}
    if variants:
        row["readers"] = h_reader_curve(model)
        row["v_low"] = h_family(model, thresholds=(1, 4, 7, 9))
        row["v_high"] = h_family(model, thresholds=(1, 6, 9, 11))
        row["v_window3"] = h_family(WindowFixedModel(problem, bays, 3), widen=("window",))
        row["v_window8"] = h_family(WindowFixedModel(problem, bays, 8), widen=("window",))
        row["v_widenAll"] = h_family(model, widen=("all",))
        row["v_meanDepth"] = h_family(MeanDepthModel(problem, bays))
        row["v_states"] = g_family(model)  # 案G の局面の数え方（比較用）
        row["solutions"] = game.solution_count()
    return row


def level_H(row: dict, keys=("best", "cont"), window="window", rules=tuple(G_RULES), path_check=True, scheme=None):
    """案H のレベルと範囲外の理由（判定の順）。
    1. 先頭に合わせる人で、勝ち筋の最小と最大のレベルが違えば範囲外（pathDependent。進め方でレベルが変わる）。
    2. 深さの2つの取り方（最善の続き・素朴に続けた場合）でレベルが違えば範囲外（depthDefinitionsDisagree）。
    3. 先回りする人（窓 G_WINDOW 人）の最小のレベルが違えば範囲外（playStylesDisagree）。Lv1 で先回りする人が Lv2 なのは許す。
    4. Lv3 以上で規則の組のどれかの勝率が 0.8 以上なら範囲外（naiveCeiling）。
    5. Lv2 で規則の組がどれも勝率 0 なら範囲外（headPoliciesAllLose）。"""
    scheme = scheme or H_SCHEME
    lo, hi = f"{scheme}Min", f"{scheme}Max"
    fams = [row[k] for k in keys]
    if path_check and any(f[lo] != f[hi] for f in fams):
        return None, "pathDependent"
    levels = {f[lo] for f in fams}
    if len(levels) > 1:
        return None, "depthDefinitionsDisagree"
    level = levels.pop()
    if window is not None:
        w = row[window][lo]
        if not (w == level or (level == 1 and w == 2)):
            return None, "playStylesDisagree"
    pmax = max(row["policies"][r] for r in rules)
    if level >= 3 and pmax >= NAIVE_CEILING:
        return None, "naiveCeiling"
    if level == 2 and pmax == 0:
        return None, "headPoliciesAllLose"
    return level, None


H_VARIANTS = {
    "thresholds4-7": dict(keys=("v_low", "cont"), window="window"),
    "thresholds6-9": dict(keys=("v_high", "cont"), window="window"),
    "window3": dict(window="v_window3"), "window8": dict(window="v_window8"),
    "widenAll": dict(keys=("v_widenAll", "cont")), "meanDepth": dict(keys=("v_meanDepth", "cont")),
    "noPathCheck": dict(path_check=False), "lattice": dict(scheme="lattice"),
}
H_VARIANT_ALONE = {"thresholds4-7": "v_low", "thresholds6-9": "v_high", "window3": "v_window3", "window8": "v_window8",
                   "widenAll": "v_widenAll", "meanDepth": "v_meanDepth"}


def h_levels(record: dict) -> dict:
    for row in record["rows"]:
        row["H"], row["Hwhy"] = level_H(row)
        row["Hvar"] = {n: level_H(row, **kw)[0] for n, kw in H_VARIANTS.items()
                       if all(k in row for k in kw.get("keys", ())) and kw.get("window", "window") in row}
        if "v_low" in row:
            # 境目から離れているか: 境目を ±1 人動かしても同じレベル
            row["Hrobust"] = row["H"] is not None and row["Hvar"].get("thresholds4-7") == row["H"] == row["Hvar"].get("thresholds6-9")
    return record


def hsurvey_one(args):
    seed, index, cars = args
    begun = time.process_time()
    rng = random.Random(f"shuttle-g:{seed}:{cars}:{index}")  # 案G と同じ問題を作る
    cond = draw_supply(rng, cars)
    problem = build(rng, cond)
    k_min = minimum_bays(problem)
    rows = []
    if k_min is not None and min(BAYS) <= k_min <= max(BAYS):
        rows.append(analyze_H(problem, k_min))
    record = {"seed": seed, "index": index, **cond, "kMin": k_min, "queueLength": len(problem.queue), "rows": rows,
              "seconds": round(time.process_time() - begun, 4), "problem": problem.to_json()}
    return h_levels(record)


def cmd_hsurvey(args):
    jobs = [(args.seed, i, args.cars) for i in range(args.start, args.start + args.count)]
    with Pool(args.workers) as pool, open(args.output, "a", encoding="utf-8") as out:
        for record in pool.imap(hsurvey_one, jobs, chunksize=4):
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()


def load_h(paths):
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield h_levels(json.loads(line))


def trial_undo_look(game: Game, model: Model, rng: random.Random, cap: int, look: int):
    """1手戻す人（先頭の色を優先）で、負けが look 人以内に見える手（深さ+1 <= look）は試さない人。"""
    def order(s):
        moves = list(game.moves(s))
        rng.shuffle(moves)
        if s[0] and moves:
            head = game.queue_colors[game.progress(s)]
            moves = [i for i in moves if game.wins(game.step(s, i)) or model.distance(s, i) + 1 > look] or moves
            moves.sort(key=lambda i: game.color_of[i] != head)
        return iter(moves)

    stack = [(game.start, order(game.start))]
    undos = 0
    while stack:
        state, it = stack[-1]
        if state[0] == 0:
            return undos
        car = next(it, None)
        if car is None:
            stack.pop()
            undos += 1
            if undos > cap:
                return undos
            continue
        child = game.step(state, car)
        stack.append((child, order(child)))
    return undos


H_UNDO = ("headFirst", "random", "remember", "look4")


def h_undo_one(args):
    spec, bays, seed, cap = args
    problem = Problem.from_json(spec)
    game = problem.game(bays)
    model = Model(problem, bays)
    rng = random.Random(f"shuttle-hundo:{seed}:{problem.key()}:{bays}")
    out = {}
    for name in H_UNDO:
        if name == "look4":
            runs = [trial_undo_look(game, model, rng, cap, 4) for _ in range(7)]
        else:
            kind, rem = G_UNDO[name]
            runs = [trial_undo_g(game, rng, cap, kind, rem) for _ in range(7)]
        out[name] = sorted(runs)[3]
    return out


def hdigest(records, undo_per_level, seed, workers, cap):
    rows = [(r, row) for r in records for row in r["rows"]]
    out = {"rows": len(rows), "problems": len(records), "cpuMinutes": round(sum(r["seconds"] for r in records) / 60, 2)}
    out["counts"] = dict(sorted(Counter(str(row["H"]) for _, row in rows).items()))
    out["countsRobust"] = dict(sorted(Counter(str(row["H"]) for _, row in rows if row.get("Hrobust")).items()))
    out["outReasons"] = dict(Counter(row["Hwhy"] for _, row in rows if row["H"] is None))
    for name, field in (("countsByColors", "colors"), ("countsByOpening", "opening"), ("countsBySize", "size")):
        out[name] = {str(v): dict(sorted(Counter(str(row["H"]) for r, row in rows if r[field] == v).items()))
                     for v in sorted({r[field] for r, _ in rows}, key=str)}
    out["countsByBays"] = {str(b): dict(sorted(Counter(str(row["H"]) for _, row in rows if row["bays"] == b).items())) for b in BAYS}
    feats = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["H"] == lv]
        b = [row["best"] for _, row in sel]
        g = [row["v_states"] for _, row in sel]
        feats[str(lv)] = {
            "count": len(sel), "robust": share(sum(bool(row.get("Hrobust")) for _, row in sel), len(sel)),
            "D1": q3([x["D1"] for x in b]), "D5": q3([x["D5"] for x in b]), "D8": q3([x["D8"] for x in b]),
            "D10": q3([x["D10"] for x in b]),
            "D5pattern": dict(Counter(f"{x['D5']}/{x['D8']}/{x['D10']}" for x in b)),
            "stateCountsK5": q3([x["K5"] for x in g]),
            "p4": q3([row["readers"]["p4"] for _, row in sel]), "p7": q3([row["readers"]["p7"] for _, row in sel]),
            "policyMax": q3([max(row["policies"].values()) for _, row in sel]),
            "rulesAtLeast08": {r: share(sum(row["policies"][r] >= 0.8 for _, row in sel), len(sel)) for r in G_RULES},
            "queueLength": q3([r["queueLength"] for r, _ in sel]),
            "bays": dict(sorted(Counter(str(row["bays"]) for _, row in sel).items())),
            "solutions": q3([row["solutions"] for _, row in sel]),
        }
    out["features"] = feats
    scoped = [row for _, row in rows if row["H"] is not None]
    a3 = {}
    for name in H_VARIANTS:
        pairs = [(row["H"], row["Hvar"].get(name)) for row in scoped]
        a3[name] = {"changed": share(sum(a != b for a, b in pairs), len(pairs)),
                    "twoOrMoreOrOut": share(sum(b is None or abs(a - b) >= 2 for a, b in pairs), len(pairs)),
                    "byLevel": {str(lv): share(sum(a != b for a, b in pairs if a == lv), sum(1 for a, _ in pairs if a == lv))
                                for lv in range(1, 6)}}
        if name in H_VARIANT_ALONE:
            alone = [(row["H"], row[H_VARIANT_ALONE[name]][f"{H_SCHEME}Min"]) for row in scoped]
            a3[name]["aloneChanged"] = share(sum(a != b for a, b in alone), len(alone))
            a3[name]["aloneTwoOrMore"] = share(sum(abs(a - b) >= 2 for a, b in alone), len(alone))
            a3[name]["aloneCross"] = {str(lv): dict(Counter(str(b) for a, b in alone if a == lv)) for lv in range(1, 6)}
    out["A3"] = a3
    rng = random.Random(f"shuttle-hundo-pick:{seed}")
    picked = {}
    for lv in range(1, 6):
        sel = [(r, row) for r, row in rows if row["H"] == lv]
        rng.shuffle(sel)
        picked[lv] = sel[:undo_per_level]
    with Pool(workers) as pool:
        undos = {lv: pool.map(h_undo_one, [(r["problem"], row["bays"], seed, cap) for r, row in picked[lv]]) for lv in range(1, 6)}
        placebo = {lv: pool.map(g_placebo_one, [(r["problem"], row["bays"], seed) for r, row in picked[lv]]) for lv in range(1, 6)}
    out["undo"] = {str(lv): {"n": len(u), **{name: q3([x[name] for x in u]) for name in H_UNDO}} for lv, u in undos.items()}
    out["undoOrder"] = {f"{lv}-{lv + 1}": {name: ordering([x[name] for x in undos[lv]], [x[name] for x in undos[lv + 1]])
                                           for name in H_UNDO} for lv in range(1, 5)}
    readers = {lv: [(row["readers"]["p4"], row["readers"]["p7"]) for _, row in picked[lv]] for lv in range(1, 6)}
    # 読む人の順: 上のレベルの方が勝率が低い確率（1 - ordering）
    out["readerOrder"] = {f"{lv}-{lv + 1}": {f"p{h}": round(1 - ordering([x[k] for x in readers[lv]], [x[k] for x in readers[lv + 1]]), 3)
                                             for k, h in ((0, 4), (1, 7))} for lv in range(1, 5)}
    out["placebo"] = {str(lv): {"allWin": share(sum(w == 8 for w in p), len(p)), "split": share(sum(0 < w < 8 for w in p), len(p)),
                                "allLose": share(sum(w == 0 for w in p), len(p))} for lv, p in placebo.items()}
    # 判断の数の順: 上のレベルの D5 が下より多い確率
    out["decisionOrder"] = {f"{lv}-{lv + 1}": ordering([row["best"]["D5"] for _, row in picked[lv]], [row["best"]["D5"] for _, row in picked[lv + 1]])
                            for lv in range(1, 5)}
    # 境目から離れた問題だけでの戻し回数の順
    rob = {lv: [u for (r, row), u in zip(picked[lv], undos[lv]) if row.get("Hrobust")] for lv in range(1, 6)}
    out["undoOrderRobust"] = {f"{lv}-{lv + 1}": {name: ordering([x[name] for x in rob[lv]], [x[name] for x in rob[lv + 1]])
                                                 for name in H_UNDO} for lv in range(1, 5) if rob[lv] and rob[lv + 1]}
    by = defaultdict(list)
    for lv in (3, 4, 5):
        for (r, row), u in zip(picked[lv], undos[lv]):
            by[f"{lv}:colors{r['colors']}"].append(u["remember"])
            by[f"{lv}:bays{row['bays']}"].append(u["remember"])
            by[f"{lv}:open{r['opening']}"].append(u["remember"])
    out["undoRememberByGroup"] = {k: {"n": len(v), "q": q3(v)} for k, v in sorted(by.items())}
    out["undoSample"] = {str(lv): [{"id": f"{r['seed']}:{r['index']}", "bays": row["bays"], "robust": row.get("Hrobust"), **u}
                                   for (r, row), u in zip(picked[lv], undos[lv])] for lv in range(1, 6)}
    sc = [(r, row) for r, row in rows if row["H"] is not None]
    out["rho"] = {"queueLength~level": spearman([r["queueLength"] for r, _ in sc], [row["H"] for _, row in sc])}
    return out


def cmd_hdigest(args):
    data = hdigest(list(load_h(args.surveys)), args.undo_per_level, args.seed, args.workers, args.cap)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


# ---------------------------------------------------------------- 素朴な解き方（試し置きと1手戻す）


def trial_undo(game: Game, rng: random.Random, cap: int, prefer_head: bool = True):
    """1手戻すがあるプレイ条件での試し置き: 先頭の色の車を優先し（同じなら無作為）、ほかは無作為の順に出す。
    出せる手が無くなったら1手戻して次を試す。詰んだ局面を覚えない。戻した回数と、解けたかを返す。"""

    def order(s):
        moves = list(game.moves(s))
        rng.shuffle(moves)
        head = game.queue_colors[game.progress(s)] if s[0] else -1
        return iter(sorted(moves, key=lambda i: game.color_of[i] != head) if prefer_head else moves)

    stack = [(game.start, order(game.start))]
    undos = 0
    while stack:
        state, it = stack[-1]
        if state[0] == 0:
            return undos, True
        car = next(it, None)
        if car is None:
            stack.pop()
            undos += 1
            if undos > cap:
                return undos, False
            continue
        child = game.step(state, car)
        stack.append((child, order(child)))
    return undos, False


def naive_one(args):
    spec, bays, seed, trials, cap = args
    problem = Problem.from_json(spec)
    game = problem.game(bays)
    rng = random.Random(f"shuttle-naive:{seed}:{problem.key()}:{bays}")
    results = [trial_undo(game, rng, cap) for _ in range(trials)]
    # B3・C3: 勝ち局面 R（案A の読み手）での、出せる車の数と、先頭の色の車がすぐ出せない局面の割合
    model = Model(problem, bays)
    nodes = model.graph(lambda s: model.tier_candidates(s, "run1head"))
    legal = [len(game.moves(s)) for s in nodes]
    buried = [not any(game.color_of[i] == game.queue_colors[game.progress(s)] for i in game.moves(s)) for s in nodes]
    reading = {"legalMean": statistics.fmean(legal), "buriedShare": sum(buried) / len(buried),
               "entry": len(game.moves(game.start)), "colors": len(game.palette)}
    return results, reading


def cmd_naive(args):
    records = list(load_records(args.surveys))
    rng = random.Random(f"shuttle-naive-pick:{args.seed}")
    out = {}
    for scheme in args.schemes.split(","):
        picked = defaultdict(list)
        rows = [(r, row) for r in records if r["population"] == "main" for row in r["rows"]
                if not args.cars or r["cars"] == args.cars]
        rng.shuffle(rows)
        for r, row in rows:
            lv = row["levels"][scheme]
            if lv is not None and len(picked[lv]) < args.per_level:
                picked[lv].append((r, row))
        block = {}
        with Pool(args.workers) as pool:
            for lv in range(1, 6):
                jobs = [(r["problem"], row["bays"], args.seed, args.trials, args.cap) for r, row in picked[lv]]
                results = pool.map(naive_one, jobs)
                flat = [x for res, _ in results for x in res]
                reading = [rd for _, rd in results]
                undos = [u for u, ok in flat if ok]
                block[str(lv)] = {
                    "problems": len(jobs), "trials": len(flat),
                    "firstTry": share(sum(1 for u, ok in flat if ok and u == 0), len(flat)),
                    "solvedWithinCap": share(sum(ok for _, ok in flat), len(flat)),
                    "undos": q3(undos),
                    "headFirstWin": q3([row["headFirst"] for _, row in picked[lv]]),
                    "naiveWin": q3([row["naive"] for _, row in picked[lv]]),
                    "uniformWin": q3([row["uniform"] for _, row in picked[lv]]),
                    "B3legalMean": q3([round(x["legalMean"], 2) for x in reading]),
                    "B3buriedHeadShare": q3([round(x["buriedShare"], 3) for x in reading]),
                    "C3entryMoves": q3([x["entry"] for x in reading]),
                    "colors": dict(sorted(Counter(str(x["colors"]) for x in reading).items())),
                }
        out[scheme] = block
    out["conditions"] = {"trials": args.trials, "cap": args.cap, "perLevel": args.per_level, "seed": args.seed,
                         "cars": args.cars}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(out, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


# ---------------------------------------------------------------- 供給（採った案だけ）

CHOSEN = "H"


def assess_chosen(problem: Problem):
    """採った案H だけを測る（変種は測らない）。待機枠は解ける最小の数だけ。
    level は5段階（深さの段 5・8・10）、level4 は4段階にまとめたもの（Lv4 と Lv5 を1つにする。人に残す別案）。"""
    k_min = minimum_bays(problem)
    found = []
    if k_min is None or not min(BAYS) <= k_min <= max(BAYS):
        return k_min, found
    row = analyze_H(problem, k_min, variants=False)
    level, why = level_H(row)
    keys = [f"D{t}" for t in H_THRESHOLDS] + [f"D{t}max" for t in H_THRESHOLDS] + ["states"]
    found.append({"bays": k_min, "level": level, "level4": None if level is None else min(level, 4), "why": why,
                  "policies": row["policies"], **{k: {c: row[k][c] for c in keys} for k in ("best", "cont", "window")}})
    return k_min, found


def draw_supply(rng, cars):
    cond = draw(rng, "main")
    if cars:
        cond["cars"] = cars
        cond["size"] = rng.choice(SIZES[cars])
    return cond


def supply_worker(args):
    seed, worker, seconds, cars = args
    rng = random.Random(f"shuttle-supply:{seed}:{cars}:{worker}")
    deadline = time.process_time() + seconds
    out = []
    while time.process_time() < deadline:
        begun = time.process_time()
        cond = draw_supply(rng, cars)
        problem = build(rng, cond)
        k_min, found = assess_chosen(problem)
        out.append({"seconds": time.process_time() - begun, "cars": cond["cars"], "opening": cond["opening"],
                    "key": problem.key(), "found": [(f["bays"], f.get("slack", 0), f["level"]) for f in found]})
    return out


def cmd_supply(args):
    with Pool(args.workers) as pool:
        chunks = pool.map(supply_worker, [(args.seed, w, args.seconds, args.cars) for w in range(args.workers)])
    attempts = [a for c in chunks for a in c]
    minutes = sum(a["seconds"] for a in attempts) / 60
    per = Counter()
    per_slack = Counter()
    keys = defaultdict(set)
    for a in attempts:
        for bays, slack, lv in a["found"]:
            if lv is not None:
                per[lv] += 1
                per_slack[(lv, slack)] += 1
                keys[lv].add((a["key"], bays))
    times = sorted(a["seconds"] for a in attempts)
    data = {"seed": args.seed, "cars": args.cars, "workers": args.workers, "cpuMinutes": round(minutes, 2),
            "attempts": len(attempts),
            "perCpuMinute": {str(lv): round(per[lv] / minutes, 1) for lv in range(1, 6)},
            "perCpuMinuteSlack0": {str(lv): round(per_slack[(lv, 0)] / minutes, 1) for lv in range(1, 6)},
            "duplicates": {str(lv): per[lv] - len(keys[lv]) for lv in range(1, 6)},
            "secondsPerCandidate": {"p50": round(times[len(times) // 2], 3), "p95": round(times[int(len(times) * .95)], 3)}}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


def cmd_expected(args):
    """移植の期待値: 採った案（B）の、seed ごとの問題と結果。探索の量（R の局面数）も残す。"""
    entries = []
    for index in range(args.count):
        rng = random.Random(f"shuttle-expected:{args.seed}:{args.cars}:{index}")
        cond = draw_supply(rng, args.cars)
        problem = build(rng, cond)
        k_min, found = assess_chosen(problem)
        rows = []
        for f in found:
            game = problem.game(f["bays"])
            rows.append({**f, "solutions": game.solution_count()})
        entries.append({"seed": f"shuttle-expected:{args.seed}:{args.cars}:{index}", "conditions": cond,
                        "kMin": k_min, "problem": problem.to_json(), "rows": rows})
    data = {"scheme": CHOSEN, "definitions": {"thresholds": list(H_THRESHOLDS), "naiveCeiling": NAIVE_CEILING,
                                           "window": G_WINDOW, "bays": "kMin only, within " + str(list(BAYS)),
                                           "rules": {k: list(v) for k, v in G_RULES.items()}},
            "entries": entries}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
        handle.write("\n")


def cmd_show(args):
    """1問を文字の格子で書き出す（試遊・反例探しに渡す用）。hsurvey（案H）・gsurvey（案G）・fsurvey（案F）・survey の出力を読める。"""
    for path in args.surveys:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                if record["index"] != args.index or record.get("population", "main") != args.population:
                    continue
                problem = Problem.from_json(record["problem"])
                print(problem.diagram())
                print("queue:", "".join(problem.queue))
                print("cars:", " ".join(f"{i}:{c}{v.length}" for i, (v, c) in enumerate(zip(problem.vehicles, problem.colors))))
                if record["rows"] and "D1" in record["rows"][0].get("best", {}):
                    h_levels(record)
                    for row in record["rows"]:
                        print("bays", row["bays"], "level", row["H"], row["Hwhy"] or "",
                              *(f"{k} D1/D5/D8/D10 {row[k]['D1']}/{row[k]['D5']}/{row[k]['D8']}/{row[k]['D10']}"
                                f" max {row[k]['D1max']}/{row[k]['D5max']}/{row[k]['D8max']}/{row[k]['D10max']}"
                                for k in ("best", "cont", "window")), "policies", row["policies"])
                elif record["rows"] and "best" in record["rows"][0]:
                    g_levels(record)
                    for row in record["rows"]:
                        print("bays", row["bays"], "level", row["G"], row["Gwhy"] or "",
                              *(f"{k} K1/K5/K8/K1max {row[k]['K1']}/{row[k]['K5']}/{row[k]['K8']}/{row[k]['K1max']}"
                                for k in ("best", "cont", "window")), "policies", row["policies"])
                elif record["rows"] and "head" in record["rows"][0]:
                    f_levels(record)
                    for row in record["rows"]:
                        print("bays", row["bays"], "level", row["F"], row["Fwhy"] or "",
                              "head h90/h50", row["head"]["h90"], row["head"]["h50"],
                              "window h90/h50", row["window"]["h90"], row["window"]["h50"], "policies", row["policies"])
                else:
                    relevel(record)
                    for row in record["rows"]:
                        print("bays", row["bays"], "levels", row["levels"])
                return


def main():
    parser = argparse.ArgumentParser(description="shuttle-parking difficulty research")
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("survey")
    s.add_argument("--seed", required=True)
    s.add_argument("--population", default="main", choices=sorted(POPULATIONS))
    s.add_argument("--start", type=int, default=0)
    s.add_argument("--count", type=int, default=200)
    s.add_argument("--workers", type=int, default=4)
    s.add_argument("--output", required=True)
    d = sub.add_parser("digest")
    d.add_argument("--surveys", nargs="+", required=True)
    d.add_argument("--output", required=True)
    n = sub.add_parser("naive")
    n.add_argument("--surveys", nargs="+", required=True)
    n.add_argument("--schemes", default="A,B,C,D")
    n.add_argument("--per-level", type=int, default=30)
    n.add_argument("--trials", type=int, default=5)
    n.add_argument("--cap", type=int, default=2000)
    n.add_argument("--seed", default="1")
    n.add_argument("--cars", type=int, default=0)
    n.add_argument("--workers", type=int, default=4)
    n.add_argument("--output", required=True)
    p = sub.add_parser("supply")
    p.add_argument("--seed", required=True)
    p.add_argument("--seconds", type=float, default=60)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--cars", type=int, default=0, help="0 なら 8・10・12 台から無作為")
    p.add_argument("--output", required=True)
    e = sub.add_parser("expected")
    e.add_argument("--seed", required=True)
    e.add_argument("--count", type=int, default=40)
    e.add_argument("--cars", type=int, default=8)
    e.add_argument("--output", required=True)
    fs = sub.add_parser("fsurvey")
    fs.add_argument("--seed", required=True)
    fs.add_argument("--cars", type=int, default=8)
    fs.add_argument("--start", type=int, default=0)
    fs.add_argument("--count", type=int, default=200)
    fs.add_argument("--workers", type=int, default=4)
    fs.add_argument("--output", required=True)
    fd = sub.add_parser("fdigest")
    fd.add_argument("--surveys", nargs="+", required=True)
    fd.add_argument("--undo-per-level", type=int, default=40)
    fd.add_argument("--cap", type=int, default=5000)
    fd.add_argument("--seed", default="1")
    fd.add_argument("--workers", type=int, default=4)
    fd.add_argument("--output", required=True)
    gs = sub.add_parser("gsurvey")
    gs.add_argument("--seed", required=True)
    gs.add_argument("--cars", type=int, default=8)
    gs.add_argument("--start", type=int, default=0)
    gs.add_argument("--count", type=int, default=200)
    gs.add_argument("--workers", type=int, default=4)
    gs.add_argument("--output", required=True)
    gd = sub.add_parser("gdigest")
    gd.add_argument("--surveys", nargs="+", required=True)
    gd.add_argument("--undo-per-level", type=int, default=300)
    gd.add_argument("--cap", type=int, default=5000)
    gd.add_argument("--seed", default="1")
    gd.add_argument("--workers", type=int, default=4)
    gd.add_argument("--output", required=True)
    hs = sub.add_parser("hsurvey")
    hs.add_argument("--seed", required=True)
    hs.add_argument("--cars", type=int, default=8)
    hs.add_argument("--start", type=int, default=0)
    hs.add_argument("--count", type=int, default=200)
    hs.add_argument("--workers", type=int, default=4)
    hs.add_argument("--output", required=True)
    hd = sub.add_parser("hdigest")
    hd.add_argument("--surveys", nargs="+", required=True)
    hd.add_argument("--undo-per-level", type=int, default=300)
    hd.add_argument("--cap", type=int, default=5000)
    hd.add_argument("--seed", default="1")
    hd.add_argument("--workers", type=int, default=4)
    hd.add_argument("--output", required=True)
    w = sub.add_parser("show")
    w.add_argument("--surveys", nargs="+", required=True)
    w.add_argument("--population", default="main")
    w.add_argument("--index", type=int, required=True)
    args = parser.parse_args()
    {"survey": cmd_survey, "digest": cmd_digest, "naive": cmd_naive, "supply": cmd_supply,
     "expected": cmd_expected, "show": cmd_show, "fsurvey": cmd_fsurvey, "fdigest": cmd_fdigest, "gsurvey": cmd_gsurvey, "gdigest": cmd_gdigest, "hsurvey": cmd_hsurvey, "hdigest": cmd_hdigest}[args.command](args)


if __name__ == "__main__":
    main()
