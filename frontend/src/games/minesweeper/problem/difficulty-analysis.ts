import { getMinesweeperCellCount } from "../puzzle/board";
import {
  type MinesweeperDeductionLevel,
  type MinesweeperHumanSolveRound,
  type MinesweeperHumanSolverOptions,
  type MinesweeperTotalMineCountUsage,
  minesweeperDeductionLevels,
  traceMinesweeperHumanSolve,
} from "./generation/human-solver";
import type { MinesweeperProblem } from "./problem";

/** 難易度特徴と比べるための盤面規模の指標。 */
export type MinesweeperScaleMetrics = {
  cellCount: number;
  mineCount: number;
  mineDensity: number;
  initialRevealedCellCount: number;
  safeCellCountToReveal: number;
};

/**
 * 人間向け推論モデルで解き切った経過から求めた特徴。
 * 発見数はラウンドごとの「その段階で確定を与える最小の制約集合」の数で、1のラウンドは進め方が1通りしかない隘路を表す。
 * 初期開示だけで解き終わっている問題ではラウンドが無いため、ラウンドから求める値は `null` になる。
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
  const initialRevealedCellCount = problem.initialRevealedCellIndices.length;

  return {
    cellCount,
    mineCount,
    mineDensity: mineCount / cellCount,
    initialRevealedCellCount,
    safeCellCountToReveal: cellCount - mineCount - initialRevealedCellCount,
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
