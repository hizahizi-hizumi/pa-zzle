import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import {
  type BridgesReasoningTier,
  bridgesConnectivityTiers,
  bridgesReasoningTiers,
  countBridgesOpeningEdges,
  traceBridgesHumanSolve,
} from "@/games/bridges/problem/generation/human-solver";
import { tryBridgesNaively } from "@/games/bridges/problem/generation/naive-solver";
import type { BridgesProblem } from "@/games/bridges/problem/problem";
import {
  formatBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * 難易度特徴と比べるための問題の規模。挑戦ではなく、架ける量と盤面の広さの側の値。
 * - `size`: 正方形の盤面の一辺。
 * - `islandCount`・`edgeCount`: 島の数と、橋を架けられる島の組（行き先）の数。
 * - `bridgeCount`: 解の橋の本数の合計（2本の組は2と数える）。
 */
export type BridgesScaleMetrics = {
  size: number;
  islandCount: number;
  edgeCount: number;
  bridgeCount: number;
};

/**
 * 人間向け解法器（段 A1〜D）で、数字と盤面だけから橋を決め切った経過から求めた特徴。
 * - `maximumTier`: 使った最も高い段。
 * - `countRoundCount`: 「ちょうど」で止まり、「少なくとも・多くとも」（A2）が要った手詰まりの回数。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながりの読み（C1p・C1g・C3・D）が要った手詰まりの回数。
 * - `roundCountByTier`: 段ごとの手詰まりの回数。
 * - `countReasoningUndecidedRatio`: 数字の読み（A1・A2）だけでは本数が決まらない行き先の割合。
 *   数字の読みで止まり、つながりを読み始めなければならない範囲の広さ。
 * - `openingEdgeRatio`: 解き始めの盤面で、数字の読みだけで範囲を狭められる行き先の割合（入口の広さ）。
 */
export type BridgesReasoningFeatures = {
  maximumTier: Exclude<BridgesReasoningTier, "T">;
  countRoundCount: number;
  connectivityRoundCount: number;
  roundCountByTier: Readonly<Record<BridgesReasoningTier, number>>;
  countReasoningUndecidedRatio: number;
  openingEdgeRatio: number;
};

/**
 * 素朴な解き方（数字の読みと試し置き）を問題ごとに決まった乱数で数回試した結果。
 * - `medianBacktrackCount`: 戻した回数の中央値。試しに架けて直す進め方で、何度やり直しになるか。
 * - `medianDisconnectedFullCount`: 全島の本数がちょうどなのに、つながっていなかった回数の中央値。
 * - `firstTrySolvedRatio`: 1度も戻さずに解けた試行の割合。
 */
export type BridgesTrialFeatures = {
  medianBacktrackCount: number;
  medianDisconnectedFullCount: number;
  firstTrySolvedRatio: number;
};

/**
 * - `analyzed`: 一意解。`requiresTrial` が偽なら段 A1〜D で決め切れ、`reasoning` はその経過。真なら試し置き（T）が要り、
 *   推理だけでは決まらない（`reasoning` は使わない）。
 * - `unsupported`: 一意解だが、試し置きまで使っても決まらない辺が残る。評価不能。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
export type BridgesDifficultyAnalysis =
  | {
      status: "analyzed";
      requiresTrial: false;
      scale: BridgesScaleMetrics;
      reasoning: BridgesReasoningFeatures;
      trial: BridgesTrialFeatures;
    }
  | { status: "analyzed"; requiresTrial: true; scale: BridgesScaleMetrics }
  | { status: "unsupported"; scale: BridgesScaleMetrics }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-limit";
    };

/** 一意性を確かめる探索の局面の数の上限。研究用の解法器と同じ値で、10×10 でも届いた問題は無い。 */
export const BRIDGES_UNIQUENESS_NODE_LIMIT = 200_000;

/** 素朴な解き方を1問に試す回数。 */
export const BRIDGES_NAIVE_TRIAL_COUNT = 5;

/** 推理の段。試し置き（T）を除く。 */
const bridgesDeductionTiers = bridgesReasoningTiers.filter(
  (tier): tier is Exclude<BridgesReasoningTier, "T"> => tier !== "T",
);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function measureScale(
  problem: BridgesProblem,
  solution: readonly number[],
): BridgesScaleMetrics {
  return {
    size: problem.width,
    islandCount: problem.islands.length,
    edgeCount: getBridgesNetwork(problem).edges.length,
    bridgeCount: solution.reduce((total, count) => total + count, 0),
  };
}

/**
 * 素朴な解き方を、盤面だけから決まる乱数で試す。同じ盤面からは同じ結果になる。
 */
export function measureBridgesTrialFeatures(
  problem: BridgesProblem,
): BridgesTrialFeatures {
  const boardText = formatBridgesBoard(problem).join("/");
  const results = Array.from(
    { length: BRIDGES_NAIVE_TRIAL_COUNT },
    (_, trial) =>
      tryBridgesNaively(
        problem,
        createProblemSeededRandom(`bridges-naive:${trial}:${boardText}`),
      ),
  );
  return {
    medianBacktrackCount: median(
      results.map((result) => result.backtrackCount),
    ),
    medianDisconnectedFullCount: median(
      results.map((result) => result.disconnectedFullCount),
    ),
    firstTrySolvedRatio:
      results.filter((result) => result.solved && result.backtrackCount === 0)
        .length / results.length,
  };
}

function countRounds(
  rounds: readonly { tier: BridgesReasoningTier }[],
): Record<BridgesReasoningTier, number> {
  const counts = Object.fromEntries(
    bridgesReasoningTiers.map((tier) => [tier, 0]),
  ) as Record<BridgesReasoningTier, number>;
  for (const { tier } of rounds) {
    counts[tier] += 1;
  }
  return counts;
}

/**
 * 問題を分析する。完全解法器で一意解かを確かめ、人間向け解法器で段 A1〜D の経過を求め、素朴な解き方を試す。
 * 人間向け解法器が解き切った橋は、完全解法器の解と一致することを確かめる。
 */
export function analyzeBridgesDifficulty(
  problem: BridgesProblem,
): BridgesDifficultyAnalysis {
  const count = countBridgesSolutions(problem, {
    limit: 2,
    nodeLimit: BRIDGES_UNIQUENESS_NODE_LIMIT,
  });
  if (count.exceededNodeLimit) {
    return { status: "invalid", reason: "search-limit" };
  }
  if (count.solutionCount !== 1 || count.firstSolution === null) {
    return {
      status: "invalid",
      reason: count.solutionCount === 0 ? "no-solution" : "multiple-solutions",
    };
  }
  const solution = count.firstSolution;
  const scale = measureScale(problem, solution);
  const trace = traceBridgesHumanSolve(problem, "T");
  if (trace.status !== "solved") {
    return { status: "unsupported", scale };
  }
  if (trace.bridges.some((bridges, edge) => bridges !== solution[edge])) {
    throw new Error("The human solver disagrees with the exact solver");
  }
  const roundCountByTier = countRounds(trace.rounds);
  if (roundCountByTier.T > 0) {
    return { status: "analyzed", requiresTrial: true, scale };
  }
  const maximumTier =
    bridgesDeductionTiers.findLast((tier) => roundCountByTier[tier] > 0) ??
    "A1";
  const countTrace = traceBridgesHumanSolve(problem, "A2");
  return {
    status: "analyzed",
    requiresTrial: false,
    scale,
    reasoning: {
      maximumTier,
      countRoundCount: roundCountByTier.A2,
      connectivityRoundCount: bridgesConnectivityTiers.reduce(
        (total, tier) => total + roundCountByTier[tier],
        0,
      ),
      roundCountByTier,
      countReasoningUndecidedRatio: countTrace.undecidedEdgeRatio,
      openingEdgeRatio:
        scale.edgeCount === 0
          ? 0
          : countBridgesOpeningEdges(problem) / scale.edgeCount,
    },
    trial: measureBridgesTrialFeatures(problem),
  };
}
