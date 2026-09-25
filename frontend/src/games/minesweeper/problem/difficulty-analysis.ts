import {
  type MinesweeperDeductionLevel,
  type MinesweeperHumanSolveRound,
  type MinesweeperHumanSolverOptions,
  type MinesweeperTotalMineCountUsage,
  minesweeperDeductionLevels,
  traceMinesweeperHumanSolve,
} from "@/games/minesweeper/problem/generation/human-solver";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { getMinesweeperCellCount } from "@/games/minesweeper/puzzle/board";

/** 難易度特徴と比べるための盤面規模の指標。 */
export type MinesweeperScaleMetrics = {
  cellCount: number;
  mineCount: number;
  mineDensity: number;
  initialRevealedCellCount: number;
  initialRevealedSafeCellRatio: number;
  safeCellCountToReveal: number;
};

/**
 * 人間向け推論モデルで解き切った経過から求めた特徴。
 * 発見数はラウンドごとの「その段階で確定を与える最小の制約集合」の数で、1のラウンドは進め方が1通りしかない隘路を表す。
 * 初期開示だけで解き終わっている問題ではラウンドが無いため、ラウンドから求める値は `null` になる。
 *
 * 総地雷数も「未確定マス全体に残り地雷数がある」という数字1つとみなし、段階をまたいで同じ構造の推論をまとめて数える。
 * - `containmentEquivalentRoundCount`: 2つの数字の包含で確定するラウンド。段階2と、段階5のうち1つの数字だけを総地雷数と突き合わせるもの。
 * - `overlapEquivalentRoundCount`: 2つの数字の部分的な重なりに相当するラウンド。段階3、段階5のうち離れた2つの数字の和を総地雷数と突き合わせるもの、段階4のうち3つの数字の `nested-sum`。
 * - `multiNumberTotalMineCountRoundCount`: 段階5のうち、3つ以上の数字や数字のまとまりの組合せを総地雷数と突き合わせるラウンド。
 * - `chainedGroupRoundCount`: 段階4のうち、上の `nested-sum` 以外のラウンド。
 */
export type MinesweeperHumanSolveFeatures = {
  highestDeductionLevel: MinesweeperDeductionLevel | null;
  roundCountByDeductionLevel: Readonly<
    Record<MinesweeperDeductionLevel, number>
  >;
  overlapOrHarderRoundCount: number;
  maximumInferenceWidth: number | null;
  roundCount: number;
  meanDiscoveryCount: number | null;
  minimumDiscoveryCount: number | null;
  singleDiscoveryRoundCount: number;
  singleLocationRoundCount: number;
  totalMineCountUsage: MinesweeperTotalMineCountUsage;
  maximumDiscoveryRowSpan: number | null;
  maximumDiscoveryColumnSpan: number | null;
  containmentEquivalentRoundCount: number;
  overlapEquivalentRoundCount: number;
  multiNumberTotalMineCountRoundCount: number;
  chainedGroupRoundCount: number;
};

/**
 * - `analyzed`: 人間向け推論モデルで推測なしに解き切れた。
 * - `unsupported`: 推測は不要だが人間向け推論モデルの範囲外（`technique-limit`）か、計算量上限で評価できない（`computation-limit`）。
 * - `unsolvable`: 可視情報だけでは確定できない局面が残り、推測が必要。
 */
export type MinesweeperDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: MinesweeperScaleMetrics;
      features: MinesweeperHumanSolveFeatures;
    }
  | {
      status: "unsupported";
      reason: "technique-limit" | "computation-limit";
      scale: MinesweeperScaleMetrics;
    }
  | {
      status: "unsolvable";
      scale: MinesweeperScaleMetrics;
    };

function measureScale(problem: MinesweeperProblem): MinesweeperScaleMetrics {
  const cellCount = getMinesweeperCellCount(problem.board);
  const mineCount = problem.board.mineCellIndices.length;
  const safeCellCount = cellCount - mineCount;
  const initialRevealedCellCount = problem.initialRevealedCellIndices.length;

  return {
    cellCount,
    mineCount,
    mineDensity: mineCount / cellCount,
    initialRevealedCellCount,
    initialRevealedSafeCellRatio: initialRevealedCellCount / safeCellCount,
    safeCellCountToReveal: safeCellCount - initialRevealedCellCount,
  };
}

const totalMineCountUsageOrder: readonly MinesweeperTotalMineCountUsage[] = [
  "none",
  "trivial",
  "combination",
];

function maximumOrNull(values: readonly (number | null)[]): number | null {
  const presentValues = values.filter((value) => value !== null);
  return presentValues.length > 0 ? Math.max(...presentValues) : null;
}

const NESTED_SUM_OVERLAP_EQUIVALENT_INFERENCE_WIDTH = 3;

function isContainmentEquivalentRound(
  round: MinesweeperHumanSolveRound,
): boolean {
  return (
    round.deductionLevel === 2 ||
    round.totalMineCountCombinationShape === "one-number"
  );
}

function isOverlapEquivalentRound(round: MinesweeperHumanSolveRound): boolean {
  return (
    round.deductionLevel === 3 ||
    round.totalMineCountCombinationShape === "two-disjoint-numbers" ||
    (round.connectedGroupShape === "nested-sum" &&
      round.inferenceWidth === NESTED_SUM_OVERLAP_EQUIVALENT_INFERENCE_WIDTH)
  );
}

function isMultiNumberTotalMineCountRound(
  round: MinesweeperHumanSolveRound,
): boolean {
  return (
    round.totalMineCountCombinationShape === "three-or-more-disjoint-numbers" ||
    round.totalMineCountCombinationShape === "component-combination"
  );
}

function isChainedGroupRound(round: MinesweeperHumanSolveRound): boolean {
  return round.deductionLevel === 4 && !isOverlapEquivalentRound(round);
}

function summarizeRounds(
  rounds: readonly MinesweeperHumanSolveRound[],
): MinesweeperHumanSolveFeatures {
  const roundCountByDeductionLevel = Object.fromEntries(
    minesweeperDeductionLevels.map((level) => [
      level,
      rounds.filter((round) => round.deductionLevel === level).length,
    ]),
  ) as Record<MinesweeperDeductionLevel, number>;
  const discoveryCounts = rounds.map((round) => round.discoveryCount);
  const hasRounds = rounds.length > 0;

  return {
    highestDeductionLevel: maximumOrNull(
      rounds.map((round) => round.deductionLevel),
    ) as MinesweeperDeductionLevel | null,
    roundCountByDeductionLevel,
    overlapOrHarderRoundCount: rounds.filter(
      (round) => round.deductionLevel >= 3,
    ).length,
    maximumInferenceWidth: maximumOrNull(
      rounds.map((round) => round.inferenceWidth),
    ),
    roundCount: rounds.length,
    meanDiscoveryCount: hasRounds
      ? discoveryCounts.reduce((sum, count) => sum + count, 0) / rounds.length
      : null,
    minimumDiscoveryCount: hasRounds ? Math.min(...discoveryCounts) : null,
    singleDiscoveryRoundCount: discoveryCounts.filter((count) => count === 1)
      .length,
    singleLocationRoundCount: rounds.filter(
      (round) => round.deductionLocationCount === 1,
    ).length,
    totalMineCountUsage:
      totalMineCountUsageOrder[
        maximumOrNull(
          rounds.map((round) =>
            totalMineCountUsageOrder.indexOf(round.totalMineCountUsage),
          ),
        ) ?? 0
      ]!,
    maximumDiscoveryRowSpan: maximumOrNull(
      rounds.map((round) => round.maximumDiscoveryRowSpan),
    ),
    maximumDiscoveryColumnSpan: maximumOrNull(
      rounds.map((round) => round.maximumDiscoveryColumnSpan),
    ),
    containmentEquivalentRoundCount: rounds.filter(isContainmentEquivalentRound)
      .length,
    overlapEquivalentRoundCount: rounds.filter(isOverlapEquivalentRound).length,
    multiNumberTotalMineCountRoundCount: rounds.filter(
      isMultiNumberTotalMineCountRound,
    ).length,
    chainedGroupRoundCount: rounds.filter(isChainedGroupRound).length,
  };
}

export function analyzeMinesweeperDifficulty(
  problem: MinesweeperProblem,
  options: MinesweeperHumanSolverOptions = {},
): MinesweeperDifficultyAnalysis {
  const scale = measureScale(problem);
  const solve = traceMinesweeperHumanSolve(problem, options);

  switch (solve.status) {
    case "solved":
      return {
        status: "analyzed",
        scale,
        features: summarizeRounds(solve.rounds),
      };
    case "unsupported":
      return { status: "unsupported", reason: solve.reason, scale };
    case "guess-required":
      return { status: "unsolvable", scale };
  }
}
