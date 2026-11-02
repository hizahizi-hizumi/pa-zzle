import {
  countUnusedStaticCells,
  createStaticBoardGraph,
  hasStaticTacticTag,
  listPassedStaticCells,
  measureStaticFloors,
  measureStaticReadingDepth,
  measureStaticTactics,
  type StaticTactics,
  type StaticTacticTag,
} from "@/games/ice-floor-maze/problem/generation/static-tactics";
import type { ProblemRandom } from "@/games/problem-seed";

/**
 * 氷と岩だけの問題の山登り（研究用の生成 v2 の目的関数 `tactic_score`・`evaluate_tactics` と、v1 の `Searcher` の山登り）。
 * 研究用と違い、駒が通らないマス（盤面の外になるマス）を v4 と同じく減点する。
 */

/**
 * 手筋の重みと、効き目の上限（その数を超えても点が増えない）。研究用 v2 の `Weights` に、滑りの手触りを足した。
 * - `slide` / `slideCap`: 最短の道筋の滑りの長さの平均（`slideCap` まで）の重み。
 * - `maximumShortSlideShare` / `maximumChoicelessStair`: 1マスだけの滑りの割合と選択肢の無い階段の長さの上限。超えた分を
 *   `constraint` で減点する。既定の重みは研究用 v2 と同じ点になるよう、手触りを点にしない。
 */
export type TacticWeights = {
  stopper: number;
  passLure: number;
  passTrap: number;
  trapLure: number;
  silentTrap: number;
  reentry: number;
  wrap: number;
  funnel: number;
  falseLead: number;
  detour: number;
  fork: number;
  forced: number;
  near: number;
  optimalPaths: number;
  excessRock: number;
  read: number;
  readCap: number;
  unused: number;
  capPass: number;
  capTrap: number;
  capReentry: number;
  capFunnel: number;
  capDetour: number;
  capFalseLead: number;
  slide: number;
  slideCap: number;
  maximumShortSlideShare: number;
  maximumChoicelessStair: number;
  required: readonly StaticTacticTag[];
  forbidden: readonly StaticTacticTag[];
  constraint: number;
};

const defaultTacticWeights = {
  stopper: 0,
  passLure: 2,
  passTrap: 2,
  trapLure: 3,
  silentTrap: 0,
  reentry: 2,
  wrap: 1,
  funnel: 1.5,
  falseLead: 1.5,
  detour: 1.5,
  fork: 0.5,
  forced: 2,
  near: 1.5,
  optimalPaths: 2,
  excessRock: 0.3,
  read: 1.5,
  readCap: 3,
  unused: 0.3,
  capPass: 2,
  capTrap: 2,
  capReentry: 2,
  capFunnel: 4,
  capDetour: 2,
  capFalseLead: 10,
  slide: 0,
  slideCap: 4,
  maximumShortSlideShare: 1,
  maximumChoicelessStair: Number.POSITIVE_INFINITY,
  required: [],
  forbidden: [],
  constraint: 6,
} as const satisfies TacticWeights;

/** 関係する岩の目安の割合。超えた岩を減点する。 */
const ROCK_TARGET = 0.22;

type TacticWeightName = Exclude<
  keyof TacticWeights,
  | "required"
  | "forbidden"
  | `cap${string}`
  | "readCap"
  | "slideCap"
  | `maximum${string}`
>;

/** タグを目的関数で強める・抑えるときに動かす重み。 */
const weightByTag = {
  stopper: "stopper",
  "wrap-around": "wrap",
  "pass-lure": "passLure",
  reentry: "reentry",
  "trap-lure": "trapLure",
  "pass-trap": "passTrap",
  "silent-trap": "silentTrap",
  detour: "detour",
  "double-detour": "detour",
  "backward-funnel": "funnel",
  fork: "fork",
} as const satisfies Record<StaticTacticTag, TacticWeightName>;

const REQUIRED_FACTOR = 2;
/** 既定の重みが0のタグを必須にしたときの重み。 */
const baseWeightOfZeroTag: Partial<Record<TacticWeightName, number>> = {
  stopper: 3,
  silentTrap: 4,
};
const FORBIDDEN_WEIGHT = -4;

/** 必須のタグの重みを強め、含めないタグの重みを負にする（研究用 v2 の `weights_for`）。 */
export function createTacticWeights(
  required: readonly StaticTacticTag[],
  forbidden: readonly StaticTacticTag[],
  base: TacticWeights = defaultTacticWeights,
): TacticWeights {
  const weights: TacticWeights = { ...base, required, forbidden };
  for (const tag of required) {
    const name = weightByTag[tag];
    weights[name] = baseWeightOfZeroTag[name] ?? base[name] * REQUIRED_FACTOR;
  }
  for (const tag of forbidden) {
    weights[weightByTag[tag]] = FORBIDDEN_WEIGHT;
  }
  return weights;
}

function scoreTactics(
  tactics: StaticTactics,
  weights: TacticWeights,
  cellCount: number,
  unusedCellCount: number,
): number {
  const w = weights;
  const excess = Math.max(
    0,
    tactics.relevantRockCount - ROCK_TARGET * cellCount,
  );
  return (
    w.stopper * Number(hasStaticTacticTag(tactics, "stopper")) +
    w.passLure * Math.min(tactics.passLureCount, w.capPass) +
    w.passTrap * Math.min(tactics.passTrapCount, 1) +
    w.trapLure * Math.min(tactics.trapLureCount, w.capTrap) +
    w.silentTrap * Math.min(tactics.silentTrapLureCount, 1) +
    w.reentry * Math.min(tactics.reentryCount, w.capReentry) +
    w.wrap * Number(tactics.wraps) +
    w.funnel * Math.min(tactics.funnelDepth, w.capFunnel) +
    w.falseLead * Math.min(tactics.falseLeadCount, w.capFalseLead) +
    w.detour * Math.min(tactics.detourCount, w.capDetour) +
    w.fork * tactics.forkCount -
    w.forced * tactics.forcedMoveCount -
    w.near * tactics.nearStateCount -
    w.optimalPaths * Math.log2(Math.max(tactics.optimalPathCount, 1)) -
    w.excessRock * excess -
    w.unused * unusedCellCount +
    w.slide * Math.min(tactics.averageSlideLength, w.slideCap) -
    w.constraint *
      Math.max(
        0,
        tactics.shortSlideCount -
          Math.floor(w.maximumShortSlideShare * tactics.shortest + 1e-9),
      ) -
    w.constraint *
      Math.max(0, tactics.longestChoicelessStair - w.maximumChoicelessStair) -
    w.constraint *
      w.required.filter((tag) => !hasStaticTacticTag(tactics, tag)).length -
    w.constraint *
      w.forbidden.filter((tag) => hasStaticTacticTag(tactics, tag)).length
  );
}

/**
 * 床を置く山登りの条件。床の数を `minimum`〜`maximum` に保ち、最短解で止まる床とおとりの床が1つ以上ずつあり、
 * 効かない床・同じ向きが続く手・連打が無く、床で区切った読み深さが `minimumReadingDepth` 以上の盤面を求める。
 */
export type TacticFloorRecipe = {
  minimum: number;
  maximum: number;
  minimumReadingDepth: number;
};

/** 床の採用条件を満たさない1つあたりの減点を、手触りの条件の何倍にするか。手筋の点で埋め合わせられないようにする。 */
const FLOOR_SHORTFALL_FACTOR = 3;

/** 床の採用条件を満たさない分の数。満たせば0。 */
function countFloorShortfalls(
  graph: ReturnType<typeof createStaticBoardGraph>,
  start: number,
  goal: number,
  floors: TacticFloorRecipe,
): number {
  const measured = measureStaticFloors(
    graph,
    start,
    goal,
    floors.minimumReadingDepth - 1,
  );
  if (measured.floorCount === 0) {
    return floors.minimum;
  }
  const splitShortfall =
    measured.floorStopCount === 0
      ? 0
      : Math.max(0, floors.minimumReadingDepth - measured.splitReadingDepth);
  return (
    Math.max(0, 1 - measured.usedFloorCount) +
    Math.max(0, 1 - measured.decoyFloorCount) +
    measured.irrelevantFloorCount +
    measured.repeatCount +
    measured.tapCount +
    splitShortfall
  );
}

/** 範囲の最短手数で比べるゴールの数。 */
const MAXIMUM_GOAL_CANDIDATES = 8;

export type TacticEvaluation = {
  score: number;
  goal: number;
  shortest: number;
};

/**
 * 範囲の最短手数で止まれるゴールのうち、手筋の点が最もよいもの（研究用 v2 の `evaluate_tactics`）。
 * 長さには点を与えず、範囲に届かない盤面は長さだけで比べて罰を与える。読み深さの点は重いので、
 * 手筋の点の高い順に、読み深さの点を足しても勝てないゴールは調べない。
 */
function evaluateTacticBoard(
  width: number,
  height: number,
  stopper: Uint8Array,
  start: number,
  shortestRange: { minimum: number; maximum: number },
  weights: TacticWeights,
  floor: Uint8Array | null = null,
  floors: TacticFloorRecipe | null = null,
): TacticEvaluation {
  const graph = createStaticBoardGraph(
    width,
    height,
    stopper,
    start,
    null,
    floor,
  );
  const inRange = [...graph.order]
    .filter((cell) => {
      const distance = graph.distances[cell]!;
      return (
        floor?.[cell] !== 1 &&
        shortestRange.minimum <= distance &&
        distance <= shortestRange.maximum
      );
    })
    .sort(
      (left, right) =>
        graph.distances[right]! - graph.distances[left]! || left - right,
    )
    .slice(0, MAXIMUM_GOAL_CANDIDATES);
  if (inRange.length === 0) {
    let longest = 0;
    for (const cell of graph.order) {
      longest = Math.max(longest, graph.distances[cell]!);
    }
    return { score: longest - 100, goal: start, shortest: 0 };
  }
  const unusedCellCount =
    weights.unused === 0 ? 0 : countUnusedStaticCells(graph);
  const scored = inRange
    .map((goal) => ({
      score: scoreTactics(
        measureStaticTactics(graph, start, goal),
        weights,
        width * height,
        unusedCellCount,
      ),
      goal,
    }))
    .sort((left, right) => right.score - left.score);
  const readBonus = weights.read * (weights.readCap + 1);
  let best: TacticEvaluation | null = null;
  for (const candidate of scored) {
    let { score } = candidate;
    if (best && score + readBonus <= best.score) {
      break;
    }
    if (floors) {
      score -=
        FLOOR_SHORTFALL_FACTOR *
        weights.constraint *
        countFloorShortfalls(graph, start, candidate.goal, floors);
    }
    if (weights.read !== 0) {
      score +=
        weights.read *
        measureStaticReadingDepth(
          graph,
          start,
          candidate.goal,
          weights.readCap,
        );
    }
    if (!best || score > best.score) {
      best = {
        score,
        goal: candidate.goal,
        shortest: graph.distances[candidate.goal]!,
      };
    }
  }
  return best!;
}

/** 研究用 v1 の山登りの岩の密度。 */
const INITIAL_ROCK_DENSITY = 0.2;
const MINIMUM_ROCK_DENSITY = 0.08;

/** 山登りの条件。`floors` は床を置くときの条件で、`null` なら氷と岩だけ。 */
export type TacticRecipe = {
  width: number;
  height: number;
  shortest: { minimum: number; maximum: number };
  weights: TacticWeights;
  iterations: number;
  maximumRockDensity: number;
  floors?: TacticFloorRecipe | null;
};

/** 床の近傍（床の追加・削除・移動）を選ぶ割合。研究用の床の比べ直し（PoC §10.1）と同じ。 */
const FLOOR_MOVE_SHARE = 0.2;

export type TacticSearchResult = {
  score: number;
  stopper: Uint8Array;
  floor: Uint8Array;
  start: number;
  goal: number;
  shortest: number;
};

/**
 * 悪くならなければ受理する山登りで、点が最もよかった盤面を返す（研究用 v1 の `Searcher` の `hc`）。
 * 範囲の最短手数で止まれる位置が一度も無ければ `null`。
 */
export function searchTacticProblem(
  recipe: TacticRecipe,
  random: ProblemRandom,
): TacticSearchResult | null {
  const { width, height } = recipe;
  const cellCount = width * height;
  const minimumRocks = Math.floor(MINIMUM_ROCK_DENSITY * cellCount);
  const maximumRocks = Math.floor(recipe.maximumRockDensity * cellCount);
  function randomIndex(length: number): number {
    return Math.floor(random() * length);
  }
  function listIce(rock: Uint8Array): number[] {
    const ice: number[] = [];
    rock.forEach((value, cell) => {
      if (value === 0) {
        ice.push(cell);
      }
    });
    return ice;
  }
  function countRocks(rock: Uint8Array): number {
    return rock.reduce((sum, value) => sum + value, 0);
  }

  const floors = recipe.floors ?? null;
  let best: TacticSearchResult | null = null;
  function evaluate(
    rock: Uint8Array,
    floor: Uint8Array,
    start: number,
  ): number {
    const evaluation = evaluateTacticBoard(
      width,
      height,
      rock,
      start,
      recipe.shortest,
      recipe.weights,
      floors ? floor : null,
      floors,
    );
    if (!best || evaluation.score > best.score) {
      best = {
        score: evaluation.score,
        stopper: rock,
        floor,
        start,
        goal: evaluation.goal,
        shortest: evaluation.shortest,
      };
    }
    return evaluation.score;
  }

  let rock: Uint8Array = Uint8Array.from({ length: cellCount }, () =>
    random() < INITIAL_ROCK_DENSITY ? 1 : 0,
  );
  let rocks = countRocks(rock);
  while (rocks < minimumRocks || rocks > maximumRocks) {
    const cell = randomIndex(cellCount);
    if (rocks < minimumRocks && rock[cell] === 0) {
      rock[cell] = 1;
      rocks += 1;
    } else if (rocks > maximumRocks && rock[cell] === 1) {
      rock[cell] = 0;
      rocks -= 1;
    }
  }
  const initialIce = listIce(rock);
  let start = initialIce[randomIndex(initialIce.length)]!;
  let floor: Uint8Array = new Uint8Array(cellCount);
  if (floors) {
    const candidates = initialIce.filter((cell) => cell !== start);
    for (let placed = 0; placed < floors.maximum && candidates.length > 0; ) {
      const [cell] = candidates.splice(randomIndex(candidates.length), 1);
      floor[cell!] = 1;
      placed += 1;
    }
  }
  let score = evaluate(rock, floor, start);

  /**
   * 床の追加・削除・移動（各1/3）。床の数を範囲に保ち、開始位置と岩には置かない。置く先は、今の盤面で到達できる滑りが
   * 通り抜けるマス（そこに置けば止まり方が変わるマス）から選ぶ。
   */
  function mutateFloor(range: TacticFloorRecipe): Uint8Array {
    const next = floor.slice();
    const placed = listIce(rock).filter((cell) => next[cell] === 1);
    const free = listPassedStaticCells(
      createStaticBoardGraph(width, height, rock, start, null, floor),
    ).filter((cell) => next[cell] === 0);
    const roll = random();
    if (roll < 1 / 3 && placed.length < range.maximum && free.length > 0) {
      next[free[randomIndex(free.length)]!] = 1;
    } else if (
      roll < 2 / 3 &&
      placed.length > range.minimum &&
      placed.length > 0
    ) {
      next[placed[randomIndex(placed.length)]!] = 0;
    } else if (placed.length > 0 && free.length > 0) {
      next[placed[randomIndex(placed.length)]!] = 0;
      next[free[randomIndex(free.length)]!] = 1;
    }
    return next;
  }

  function mutate(): [Uint8Array, Uint8Array, number] {
    if (floors && random() < FLOOR_MOVE_SHARE) {
      return [rock, mutateFloor(floors), start];
    }
    const next = rock.slice();
    const roll = random();
    if (roll < 0.1) {
      const ice = listIce(next).filter((cell) => floor[cell] === 0);
      return [next, floor, ice[randomIndex(ice.length)]!];
    }
    const count = countRocks(next);
    const cell = randomIndex(cellCount);
    if (cell === start || floor[cell] === 1) {
      return [next, floor, start];
    }
    const toggles = roll < 0.55;
    if (
      toggles &&
      (next[cell] === 1 ? minimumRocks < count : count < maximumRocks)
    ) {
      next[cell] = next[cell] === 1 ? 0 : 1;
      return [next, floor, start];
    }
    if (next[cell] === 1) {
      const target = randomIndex(cellCount);
      if (next[target] === 0 && target !== start && floor[target] === 0) {
        next[cell] = 0;
        next[target] = 1;
      }
    } else {
      const source = randomIndex(cellCount);
      if (next[source] === 1) {
        next[source] = 0;
        next[cell] = 1;
      }
    }
    return [next, floor, start];
  }

  for (let step = 1; step < recipe.iterations; step += 1) {
    const [candidate, candidateFloor, candidateStart] = mutate();
    const value = evaluate(candidate, candidateFloor, candidateStart);
    if (value >= score) {
      rock = candidate;
      floor = candidateFloor;
      start = candidateStart;
      score = value;
    }
  }
  const found = best as TacticSearchResult | null;
  return found && found.shortest > 0 ? found : null;
}

export const _private = {
  defaultTacticWeights,
  evaluateTacticBoard,
  scoreTactics,
};
