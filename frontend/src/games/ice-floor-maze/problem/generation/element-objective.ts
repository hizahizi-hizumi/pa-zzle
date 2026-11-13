import {
  classifyLooksReading,
  countRoles,
  createElementContext,
  type ElementContext,
  type ElementMetrics,
  hasStaticShortcut,
  type LooksReading,
  measureElementMetrics,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import { measureStateReadingDepth } from "@/games/ice-floor-maze/problem/generation/reading-model";
import {
  CELL_ICE,
  type GenerationBoard,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/**
 * 要素のある問題の目的関数と採用条件（研究用の生成 v4 の `Weights`・`violations`・`hardness`・`evaluate`）。
 */

export type ElementVariant =
  | "brittle-rock"
  | "thin-ice"
  | "mixed"
  | "snow"
  | "snow-thin-ice"
  | "sliding-block"
  | "sliding-block-thin-ice";

const elementWeights = {
  looks: {
    unsolvable: 5,
    misleading: 6,
    detour: 3,
    shortcut: 0,
  } satisfies Record<LooksReading, number>,
  use: 0.8,
  useCap: 10,
  distinct: 1,
  distinctCap: 6,
  precedence: 1,
  softPrecedence: 0.5,
  precedenceCap: 8,
  chain: 1.5,
  chainCap: 4,
  orderTrap: 1,
  orderTrapCap: 4,
  decoy: 3,
  decoyCap: 3,
  weakDecoy: 1,
  lure: 0.5,
  lureCap: 4,
  read: 1.5,
  readCap: 4,
  forced: 1.5,
  near: 0.3,
  nearCap: 60,
  solutions: 2,
  unused: 0.3,
  constraint: 6,
} as const;

/**
 * 問題集の山登りで最大にする挑戦の点の重み。試遊の記録で人の難しさと揃った自作依存の点を主にし、見た目どおりの読みは解なしを
 * 誤るより重くする。おとり・誘い・順序の依存・状態の読み深さは試遊の難しさと揃わなかったので、おとりを少し残すだけにする。
 */
const challengeWeights = {
  dependence: 3,
  looks: {
    unsolvable: 6,
    misleading: 3,
    detour: 1,
    shortcut: 0,
  } satisfies Record<LooksReading, number>,
  decoy: 0.5,
  decoyCap: 2,
  slide: 1,
  slideCap: 4,
  rock: 30,
} as const;

/**
 * 問題集の山登りで、最短解そのものに同じ向きが続く手を、近い道筋の分に加えて減点する倍率。崩れた跡を通る手は自作依存の点を
 * 上げるので、もろい岩を崩してそのまま同じ向きへ通り抜ける解に山登りが留まりやすい。
 */
const SOLUTION_REPEAT_FACTOR = 2;

/** 盤面として描くマスのうち、これを超える岩の割合を減点する。 */
const ROCK_SHARE_TARGET = 0.22;

/** 山登りで比べる状態の読み深さの上限より、候補を比べるときの上限を深くする。 */
export const STATE_READING_DEPTH_CAP = 8;

/**
 * - `minimumEach`: 2種類を置く組み合わせで、それぞれの種類の下限。
 * - `minimumUses`: 最短解で要素を使う（崩す・押し出す・動かす・自分で作った地形を使う）回数の下限。
 * - `decoyShare`: おとりを要素の数のこの割合（切り上げ、最低1）以上置く。
 * - `pool`: 問題集の生成条件。`null` なら研究用の生成 v4 と同じ目的関数（難しさの点と状態の読み深さ）と採用条件。
 */
export type ElementRecipe = {
  variant: ElementVariant;
  width: number;
  height: number;
  shortest: { minimum: number; maximum: number };
  elements: { minimum: number; maximum: number };
  minimumEach: number;
  minimumUses: number;
  decoyShare: number;
  forcedShare: number;
  maximumRockDensity: number;
  pool: ElementPoolConditions | null;
};

/**
 * 問題集の生成条件。挑戦の点（自作依存の点が主）を最大にし、次を採用条件に足す。
 * - `selfMadeDependence`: 自作依存の点の範囲。上限を超えた分も目的関数で減点する。
 * - `minimumDistantStops`: 2手以上前に作った止め役で止まる回数の下限。
 * - `maximumUsedElements`: 最短解で変化させる要素の数の上限。
 * - `maximumLingeringDecoys`: 変化させた直後が閉じ込めにならないおとりの数の上限。
 */
export type ElementPoolConditions = {
  selfMadeDependence: { minimum: number; maximum: number };
  minimumDistantStops: number;
  maximumUsedElements: number;
  maximumLingeringDecoys: number;
  texture: ElementTextureLimits;
};

/**
 * 最短解の手触りの条件（`SolutionTexture` の値に当てる）。
 * - `maximumShortSlideShare`: 1マスだけの滑りを最少手数のこの割合まで。
 * - `maximumChoicelessStair`: 選択肢の無い階段の長さの上限。
 * - `maximumQuickReturns` / `minimumVariedUses`: 作ってすぐ戻る手筋の回数の上限と、自分で作った地形のそれ以外の使い方の回数の下限。
 * - `maximumIdleRun`: 読みどころの無い区間の長さの上限。
 */
export type ElementTextureLimits = {
  maximumShortSlideShare: number;
  maximumChoicelessStair: number;
  maximumQuickReturns: number;
  minimumVariedUses: number;
  maximumIdleRun: number;
};

const tileCounts = {
  "brittle-rock": (metrics) => [metrics.brittleCount],
  "thin-ice": (metrics) => [metrics.thinCount],
  mixed: (metrics) => [metrics.brittleCount, metrics.thinCount],
  snow: (metrics) => [metrics.snowCount],
  "snow-thin-ice": (metrics) => [metrics.snowCount, metrics.thinCount],
  "sliding-block": (metrics) => [metrics.blockCount],
  "sliding-block-thin-ice": (metrics) => [
    metrics.blockCount,
    metrics.thinCount,
  ],
} as const satisfies Record<
  ElementVariant,
  (metrics: ElementMetrics) => readonly number[]
>;

/** 2種類を置く組み合わせで、少ない方の種類の数。1種類なら `Infinity`（内訳の下限を課さない）。 */
function countScarceTile(
  metrics: ElementMetrics,
  variant: ElementVariant,
): number {
  const counts = tileCounts[variant](metrics);
  return counts.length > 1 ? Math.min(...counts) : Number.POSITIVE_INFINITY;
}

export function countNeededDecoys(
  decoyShare: number,
  elementCount: number,
): number {
  return Math.max(1, Math.ceil(decoyShare * elementCount - 1e-9));
}

/** 採用条件（条件1・2を含む）を満たさない理由。 */
export type ElementViolation =
  | "shortest"
  | "multiple-solutions"
  | "repeated-direction"
  | "element-chain"
  | "irrelevant-element"
  | "few-decoys"
  | "element-count"
  | "element-mix"
  | "few-uses"
  | "static-shortcut"
  | "forced"
  | "short-slides"
  | "choiceless-stair"
  | "repeated-tactic"
  | "idle-run"
  | "used-elements"
  | "lingering-decoy"
  | "self-made-dependence"
  | "distant-stops";

type PoolViolation = Extract<
  ElementViolation,
  | "short-slides"
  | "choiceless-stair"
  | "repeated-tactic"
  | "idle-run"
  | "used-elements"
  | "lingering-decoy"
  | "self-made-dependence"
  | "distant-stops"
>;

/** 問題集の生成条件から外れた量。条件ごとに0なら満たす。 */
function measurePoolExcess(
  metrics: ElementMetrics,
  pool: ElementPoolConditions | null,
): [PoolViolation, number][] {
  if (!pool) {
    return [];
  }
  const { texture } = metrics;
  const limits = pool.texture;
  const dependence = metrics.selfMadeDependence;
  return Object.entries({
    "short-slides": Math.max(
      0,
      texture.shortSlideCount -
        Math.floor(limits.maximumShortSlideShare * metrics.shortest + 1e-9),
    ),
    "choiceless-stair": Math.max(
      0,
      texture.longestChoicelessStair - limits.maximumChoicelessStair,
    ),
    "repeated-tactic":
      Math.max(0, texture.quickReturnCount - limits.maximumQuickReturns) +
      Math.max(0, limits.minimumVariedUses - texture.variedUseCount),
    "idle-run": Math.max(0, texture.longestIdleRun - limits.maximumIdleRun),
    "used-elements": Math.max(
      0,
      metrics.changedElementCount - pool.maximumUsedElements,
    ),
    "lingering-decoy": Math.max(
      0,
      metrics.lingeringDecoyCount - pool.maximumLingeringDecoys,
    ),
    "self-made-dependence": Math.max(
      0,
      pool.selfMadeDependence.minimum - dependence,
      dependence - pool.selfMadeDependence.maximum,
    ),
    "distant-stops": Math.max(
      0,
      pool.minimumDistantStops - texture.distantStopCount,
    ),
  } satisfies Record<PoolViolation, number>) as [PoolViolation, number][];
}

export function listElementViolations(
  metrics: ElementMetrics,
  recipe: ElementRecipe,
): ElementViolation[] {
  const violations: ElementViolation[] = [];
  const { shortest, elements } = recipe;
  if (
    metrics.shortest < shortest.minimum ||
    metrics.shortest > shortest.maximum
  ) {
    violations.push("shortest");
  }
  if (metrics.solutionCount > 1) {
    violations.push("multiple-solutions");
  }
  if (metrics.solutionRepeatCount > 0 || metrics.nearRepeatCount > 0) {
    violations.push("repeated-direction");
  }
  if (metrics.elementChainCount > 0) {
    violations.push("element-chain");
  }
  if (countRoles(metrics, "irrelevant") > 0) {
    violations.push("irrelevant-element");
  }
  if (
    countRoles(metrics, "decoy") <
    countNeededDecoys(recipe.decoyShare, metrics.elementCount)
  ) {
    violations.push("few-decoys");
  }
  if (
    metrics.elementCount < elements.minimum ||
    metrics.elementCount > elements.maximum
  ) {
    violations.push("element-count");
  }
  if (countScarceTile(metrics, recipe.variant) < recipe.minimumEach) {
    violations.push("element-mix");
  }
  if (metrics.useCount < recipe.minimumUses) {
    violations.push("few-uses");
  }
  if (hasStaticShortcut(metrics)) {
    violations.push("static-shortcut");
  }
  if (metrics.forcedMoveCount > recipe.forcedShare * metrics.shortest) {
    violations.push("forced");
  }
  for (const [violation, excess] of measurePoolExcess(metrics, recipe.pool)) {
    if (excess > 0) {
      violations.push(violation);
    }
  }
  return violations;
}

function measureShortfall(
  metrics: ElementMetrics,
  recipe: ElementRecipe,
): number {
  const { elements } = recipe;
  return (
    Number(metrics.solutionCount > 1) +
    Math.min(metrics.nearRepeatCount, 3) +
    (recipe.pool
      ? SOLUTION_REPEAT_FACTOR * Math.min(metrics.solutionRepeatCount, 3)
      : 0) +
    Math.min(metrics.elementChainCount, 3) +
    countRoles(metrics, "irrelevant") +
    Math.max(
      0,
      countNeededDecoys(recipe.decoyShare, metrics.elementCount) -
        countRoles(metrics, "decoy"),
    ) +
    Math.max(
      0,
      metrics.elementCount - elements.maximum,
      elements.minimum - metrics.elementCount,
    ) +
    Math.max(0, recipe.minimumEach - countScarceTile(metrics, recipe.variant)) +
    Number(metrics.useCount < recipe.minimumUses) +
    Number(hasStaticShortcut(metrics)) +
    Number(metrics.forcedMoveCount > recipe.forcedShare * metrics.shortest) +
    measurePoolExcess(metrics, recipe.pool).reduce(
      (sum, [, excess]) => sum + Math.min(excess, 3),
      0,
    )
  );
}

/** 難しさの点（状態の読み深さを除く）。大きいほど難しいとみなす。 */
export function scoreElementHardness(metrics: ElementMetrics): number {
  const w = elementWeights;
  const decoys = countRoles(metrics, "decoy");
  return (
    w.looks[classifyLooksReading(metrics)] +
    w.use * Math.min(metrics.useCount, w.useCap) +
    w.distinct * Math.min(metrics.changedElementCount, w.distinctCap) +
    w.precedence * Math.min(metrics.precedenceCount, w.precedenceCap) +
    w.softPrecedence * Math.min(metrics.softPrecedenceCount, w.precedenceCap) +
    w.chain * Math.max(0, Math.min(metrics.orderChain, w.chainCap) - 1) +
    w.orderTrap * Math.min(metrics.orderTrapCount, w.orderTrapCap) +
    w.decoy * Math.min(decoys, w.decoyCap) +
    w.weakDecoy *
      Math.min(
        countRoles(metrics, "weak-decoy"),
        Math.max(0, w.decoyCap - decoys),
      ) +
    w.lure * Math.min(metrics.lureCount, w.lureCap)
  );
}

/** 難しさの点に、状態の読み深さ（`STATE_READING_DEPTH_CAP` まで。読めなければ上限+1）を足した、候補を比べる点。 */
export function scoreElementHardnessWithReading(
  metrics: ElementMetrics,
  stateReadingDepth: number,
): number {
  return (
    scoreElementHardness(metrics) + elementWeights.read * stateReadingDepth
  );
}

/**
 * 問題集の挑戦の点。自作依存の点と見た目どおりの読みを主にし、おとりを少し足す。長く滑る解と、岩の少ない盤面を良しとする。
 * 自作依存の点は帯の上限で頭打ちにする（上限を超えた分は採用条件の不足として減点するだけでは、滑る氷の塊のように点を上げやすい
 * 要素で山登りが帯の上へ抜けたまま戻らないため）。
 */
function scoreElementChallenge(
  metrics: ElementMetrics,
  pool: ElementPoolConditions,
): number {
  const w = challengeWeights;
  return (
    w.dependence *
      Math.min(metrics.selfMadeDependence, pool.selfMadeDependence.maximum) +
    w.looks[classifyLooksReading(metrics)] +
    w.decoy * Math.min(countRoles(metrics, "decoy"), w.decoyCap) +
    w.slide * Math.min(metrics.texture.averageSlideLength, w.slideCap) -
    w.rock * Math.max(0, metrics.rockShare - ROCK_SHARE_TARGET)
  );
}

/** 山登りで最大にする点（読み深さの点を除く）。 */
function scoreElementProblem(
  metrics: ElementMetrics,
  recipe: ElementRecipe,
): number {
  const w = elementWeights;
  return (
    (recipe.pool
      ? scoreElementChallenge(metrics, recipe.pool)
      : scoreElementHardness(metrics)) -
    w.forced * metrics.forcedMoveCount -
    w.near * Math.min(metrics.nearExtraStateCount, w.nearCap) -
    w.solutions * Math.log2(Math.max(metrics.solutionCount, 1)) -
    w.unused * metrics.unusedCellCount -
    w.constraint * measureShortfall(metrics, recipe)
  );
}

/** 範囲の最短手数で比べるゴールの数。 */
const MAXIMUM_GOAL_CANDIDATES = 4;

/** 盤面と開始位置の評価。`goal` が -1 なら範囲の最短手数で止まれる氷のマスが無い。 */
export type ElementEvaluation = {
  score: number;
  goal: number;
  metrics: ElementMetrics | null;
};

/**
 * 範囲の最短手数で駒が止まれる氷のマスのうち、点が最もよいゴール（研究用の `evaluate`）。
 * 研究用の目的関数では状態の読み深さを点に足す。読み深さは重いので、足しても `floor` に届かないゴールでは求めない。
 */
export function evaluateElementBoard(
  board: GenerationBoard,
  start: number,
  recipe: ElementRecipe,
  floor = Number.NEGATIVE_INFINITY,
): ElementEvaluation {
  const context = createElementContext(board, start);
  return evaluateElementContext(context, recipe, floor);
}

function evaluateElementContext(
  context: ElementContext,
  recipe: ElementRecipe,
  floor = Number.NEGATIVE_INFINITY,
): ElementEvaluation {
  const { free, board, start } = context;
  if (!free) {
    return { score: -1000, goal: -1, metrics: null };
  }
  const firstDistance = new Map<number, number>();
  for (let state = 0; state < free.count; state += 1) {
    const position = free.positions[state]!;
    if (!firstDistance.has(position)) {
      firstDistance.set(position, free.distances[state]!);
    }
  }
  const candidates = [...firstDistance]
    .filter(
      ([cell, distance]) =>
        recipe.shortest.minimum <= distance &&
        distance <= recipe.shortest.maximum &&
        board.cells[cell] === CELL_ICE &&
        cell !== start,
    )
    .sort(
      ([leftCell, left], [rightCell, right]) =>
        right - left || leftCell - rightCell,
    )
    .slice(0, MAXIMUM_GOAL_CANDIDATES);
  if (candidates.length === 0) {
    return {
      score: Math.max(0, ...firstDistance.values()) - 100,
      goal: -1,
      metrics: null,
    };
  }
  const scored = candidates
    .map(([goal]) => {
      const space = withGoal(free, goal);
      const metrics = measureElementMetrics(context, goal, space)!;
      return {
        score: scoreElementProblem(metrics, recipe),
        goal,
        metrics,
        space,
      };
    })
    .sort((left, right) => right.score - left.score);
  const w = elementWeights;
  const readBonus = recipe.pool ? 0 : w.read * (w.readCap + 1);
  let best: ElementEvaluation | null = null;
  for (const candidate of scored) {
    let { score } = candidate;
    if (best && score + readBonus <= best.score) {
      break;
    }
    if (readBonus > 0 && score + readBonus >= floor) {
      score += w.read * measureStateReadingDepth(candidate.space, w.readCap);
    }
    if (!best || score > best.score) {
      best = { score, goal: candidate.goal, metrics: candidate.metrics };
    }
  }
  return best!;
}

export const _private = { evaluateElementContext, scoreElementProblem };
