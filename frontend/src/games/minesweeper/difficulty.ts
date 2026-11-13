import {
  type DifficultyAssessment,
  type DifficultyLevel,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  MinesweeperDifficultyAnalysis,
  MinesweeperHumanSolveFeatures,
  MinesweeperScaleMetrics,
} from "@/games/minesweeper/problem/difficulty-analysis";

export type MinesweeperDifficulty = DifficultyLevel;

export type MinesweeperBoardSize = { rows: number; columns: number };

/** 浮動小数の誤差を避けるため百分率の整数で持つ。 */
type MinesweeperMineDensityPercentRange = NumericRange;

export type MinesweeperDifficultyBoardRange = {
  sizes: readonly MinesweeperBoardSize[];
  mineDensityPercent: MinesweeperMineDensityPercentRange;
};

function boardSizes(
  ...sizes: readonly (readonly [rows: number, columns: number])[]
): MinesweeperBoardSize[] {
  return sizes.map(([rows, columns]) => ({ rows, columns }));
}

export const minesweeperDifficultyBoardRanges = {
  "1": {
    sizes: boardSizes([9, 9], [10, 9], [10, 10]),
    mineDensityPercent: { minimum: 11, maximum: 13 },
  },
  "2": {
    sizes: boardSizes([9, 9], [10, 9], [10, 10], [11, 10], [12, 10]),
    mineDensityPercent: { minimum: 13, maximum: 15 },
  },
  "3": {
    sizes: boardSizes([10, 10], [11, 10], [12, 10], [13, 10], [14, 10]),
    mineDensityPercent: { minimum: 15, maximum: 17 },
  },
  "4": {
    sizes: boardSizes([12, 10], [12, 12], [14, 10], [14, 12], [16, 12]),
    mineDensityPercent: { minimum: 16, maximum: 18 },
  },
  "5": {
    sizes: boardSizes([14, 10], [14, 12], [16, 10], [16, 12]),
    mineDensityPercent: { minimum: 18, maximum: 20 },
  },
} as const satisfies Record<
  MinesweeperDifficulty,
  MinesweeperDifficultyBoardRange
>;

function isMineCountInDensityRange(
  cellCount: number,
  mineCount: number,
  { minimum, maximum }: MinesweeperMineDensityPercentRange,
): boolean {
  return isInNumericRange(mineCount * 100, {
    minimum: minimum * cellCount,
    maximum: maximum * cellCount,
  });
}

function listMineCountsInDensityRange(
  cellCount: number,
  densityRange: MinesweeperMineDensityPercentRange,
): number[] {
  const mineCounts: number[] = [];
  for (
    let mineCount = Math.ceil((densityRange.minimum * cellCount) / 100);
    isMineCountInDensityRange(cellCount, mineCount, densityRange);
    mineCount += 1
  ) {
    mineCounts.push(mineCount);
  }
  return mineCounts;
}

export type MinesweeperDifficultyBoardCondition = MinesweeperBoardSize & {
  mineCount: number;
};

/** 盤面サイズの定義順・地雷数の昇順で返す。 */
export function listMinesweeperDifficultyBoardConditions(
  difficulty: MinesweeperDifficulty,
): MinesweeperDifficultyBoardCondition[] {
  const { sizes, mineDensityPercent } =
    minesweeperDifficultyBoardRanges[difficulty];
  return sizes.flatMap(({ rows, columns }) =>
    listMineCountsInDensityRange(rows * columns, mineDensityPercent).map(
      (mineCount) => ({ rows, columns, mineCount }),
    ),
  );
}

export function isInMinesweeperDifficultyBoardRange(
  difficulty: MinesweeperDifficulty,
  { rows, columns, mineCount }: MinesweeperDifficultyBoardCondition,
): boolean {
  const { sizes, mineDensityPercent } =
    minesweeperDifficultyBoardRanges[difficulty];
  return (
    sizes.some((size) => size.rows === rows && size.columns === columns) &&
    isMineCountInDensityRange(rows * columns, mineCount, mineDensityPercent)
  );
}

/** `unsupported` は、分析で難易度を評価できないもの。 */
export type MinesweeperDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange:
    | { reason: "too-light" | "too-heavy" }
    | {
        reason: "outside-board-range";
        inferenceDifficulty: MinesweeperDifficulty;
      };
  unsupported: { reason: "technique-limit" | "computation-limit" };
  invalid: NoAssessmentDetail;
}>;

const minimumProvidedRoundCount = 6;
const maximumProvidedInitialRevealedSafeCellRatio = 0.6;
const maximumProvidedInferenceWidth = 4;
const minimumOverlapEquivalentRoundCountForDifficulty4 = 2;

function isTooHeavy(features: MinesweeperHumanSolveFeatures): boolean {
  return (features.maximumInferenceWidth ?? 0) > maximumProvidedInferenceWidth;
}

function isTooLight(
  scale: MinesweeperScaleMetrics,
  features: MinesweeperHumanSolveFeatures,
): boolean {
  return (
    features.roundCount < minimumProvidedRoundCount ||
    scale.initialRevealedSafeCellRatio >
      maximumProvidedInitialRevealedSafeCellRatio
  );
}

/** 盤面の大きさを見ずに、解くのに要る推論の種類だけで決まる難易度。 */
export function classifyMinesweeperInferenceDifficulty(
  features: MinesweeperHumanSolveFeatures,
): MinesweeperDifficulty {
  if (features.chainedGroupRoundCount > 0) {
    return "5";
  }
  if (
    features.overlapEquivalentRoundCount >=
      minimumOverlapEquivalentRoundCountForDifficulty4 ||
    features.multiNumberTotalMineCountRoundCount > 0
  ) {
    return "4";
  }
  if (features.overlapEquivalentRoundCount > 0) {
    return "3";
  }
  if (features.containmentEquivalentRoundCount > 0) {
    return "2";
  }
  return "1";
}

function assessAnalyzedChallenge(
  scale: MinesweeperScaleMetrics,
  features: MinesweeperHumanSolveFeatures,
  boardSize: MinesweeperBoardSize,
): MinesweeperDifficultyAssessment {
  if (isTooHeavy(features)) {
    return { status: "out-of-range", reason: "too-heavy" };
  }
  if (isTooLight(scale, features)) {
    return { status: "out-of-range", reason: "too-light" };
  }
  const difficulty = classifyMinesweeperInferenceDifficulty(features);
  if (
    !isInMinesweeperDifficultyBoardRange(difficulty, {
      ...boardSize,
      mineCount: scale.mineCount,
    })
  ) {
    return {
      status: "out-of-range",
      reason: "outside-board-range",
      inferenceDifficulty: difficulty,
    };
  }
  return { status: "classified", difficulty };
}

export function assessMinesweeperDifficulty(
  analysis: MinesweeperDifficultyAnalysis,
  boardSize: MinesweeperBoardSize,
): MinesweeperDifficultyAssessment {
  switch (analysis.status) {
    case "unsupported":
      return { status: "unsupported", reason: analysis.reason };
    case "invalid":
      return { status: "invalid" };
    case "analyzed":
      return assessAnalyzedChallenge(
        analysis.scale,
        analysis.features,
        boardSize,
      );
  }
}
