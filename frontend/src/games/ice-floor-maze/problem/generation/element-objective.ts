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
 * もろい岩・薄い氷のある問題の目的関数と採用条件（研究用の生成 v4 の `Weights`・`violations`・`hardness`・`evaluate`）。
 */

/** 盤面に置く要素の組み合わせ。 */
export type ElementVariant = "brittle-rock" | "thin-ice" | "mixed";

/** 難しさの点の重みと上限。 */
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

/** 山登りで比べる状態の読み深さの上限より、候補を比べるときの上限を深くする。 */
export const STATE_READING_DEPTH_CAP = 8;

/**
 * 1つの生成条件。最短手数・要素の数の範囲と、採用条件に効く値。
 * - `minimumEach`: `mixed` で、もろい岩・薄い氷それぞれの下限。
 * - `minimumUses`: 最短解で要素を使う（崩す・崩れた跡を通る・水面で止まる）回数の下限。
 * - `decoyShare`: おとりを要素の数のこの割合（切り上げ、最低1）以上置く。
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
};

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
  | "brittle-chain"
  | "irrelevant-element"
  | "few-decoys"
  | "element-count"
  | "element-mix"
  | "few-uses"
  | "static-shortcut"
  | "forced";

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
  if (metrics.brittleChainCount > 0) {
    violations.push("brittle-chain");
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
  if (
    recipe.variant === "mixed" &&
    Math.min(metrics.brittleCount, metrics.thinCount) < recipe.minimumEach
  ) {
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
    Math.min(metrics.brittleChainCount, 3) +
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
    (recipe.variant === "mixed"
      ? Math.max(
          0,
          recipe.minimumEach -
            Math.min(metrics.brittleCount, metrics.thinCount),
        )
      : 0) +
    Number(metrics.useCount < recipe.minimumUses) +
    Number(hasStaticShortcut(metrics)) +
    Number(metrics.forcedMoveCount > recipe.forcedShare * metrics.shortest)
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

/** 山登りで最大にする点（読み深さの点を除く）。 */
function scoreElementProblem(
  metrics: ElementMetrics,
  recipe: ElementRecipe,
): number {
  const w = elementWeights;
  return (
    scoreElementHardness(metrics) -
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
 * 読み深さは重いので、読み深さの点を足しても `floor` に届かないゴールでは求めない。
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
  const readBonus = w.read * (w.readCap + 1);
  let best: ElementEvaluation | null = null;
  for (const candidate of scored) {
    let { score } = candidate;
    if (best && score + readBonus <= best.score) {
      break;
    }
    if (score + readBonus >= floor) {
      score += w.read * measureStateReadingDepth(candidate.space, w.readCap);
    }
    if (!best || score > best.score) {
      best = { score, goal: candidate.goal, metrics: candidate.metrics };
    }
  }
  return best!;
}

export const _private = { evaluateElementContext, scoreElementProblem };
