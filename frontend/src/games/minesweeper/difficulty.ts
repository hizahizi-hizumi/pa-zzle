import type {
  MinesweeperDifficultyAnalysis,
  MinesweeperHumanSolveFeatures,
  MinesweeperScaleMetrics,
} from "@/games/minesweeper/problem/difficulty-analysis";

export const minesweeperDifficulties = [
  { id: "1", label: "難易度 1" },
  { id: "2", label: "難易度 2" },
  { id: "3", label: "難易度 3" },
  { id: "4", label: "難易度 4" },
  { id: "5", label: "難易度 5" },
] as const;

export type MinesweeperDifficulty =
  (typeof minesweeperDifficulties)[number]["id"];

export function parseMinesweeperDifficulty(
  value: string | undefined,
): MinesweeperDifficulty | undefined {
  return minesweeperDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export type MinesweeperBoardSize = { rows: number; columns: number };

/** 地雷密度の範囲。浮動小数の誤差を避けるため百分率の整数で持ち、両端を含む。 */
type MinesweeperMineDensityPercentRange = {
  minimum: number;
  maximum: number;
};

export type MinesweeperDifficultyBoardRange = {
  sizes: readonly MinesweeperBoardSize[];
  mineDensityPercent: MinesweeperMineDensityPercentRange;
};

function boardSizes(
  ...sizes: readonly (readonly [rows: number, columns: number])[]
): MinesweeperBoardSize[] {
  return sizes.map(([rows, columns]) => ({ rows, columns }));
}

/**
 * 難易度ごとに提供する盤面サイズと地雷密度。
 * 上の難易度ほど盤面・地雷密度を上げ、どの数字が効くかを見抜く負担も推論と一緒に上げる。
 * 隣り合う難易度はサイズが一部重なってよいが、離れた難易度同士はサイズと密度の組が重ならない。
 * 盤面は正方形か縦長（行数 ≥ 列数）で、最大 16行×12列。
 */
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
  return (
    mineCount * 100 >= minimum * cellCount &&
    mineCount * 100 <= maximum * cellCount
  );
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

/** 難易度の盤面範囲に入る盤面サイズと地雷数の組を、盤面サイズの定義順・地雷数の昇順で返す。 */
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

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 推測なしで解けるが提供しない。挑戦が薄すぎる（`too-light`）か重すぎる（`too-heavy`）か、
 *   推論で決まる難易度 `inferenceDifficulty` の盤面範囲に盤面サイズ・地雷数が入らない（`outside-board-range`）。
 * - `unsupported` / `unsolvable`: 分析で難易度を評価できない、または推測が必要で成立しない。
 */
export type MinesweeperDifficultyAssessment =
  | { status: "classified"; difficulty: MinesweeperDifficulty }
  | { status: "out-of-range"; reason: "too-light" | "too-heavy" }
  | {
      status: "out-of-range";
      reason: "outside-board-range";
      inferenceDifficulty: MinesweeperDifficulty;
    }
  | {
      status: "unsupported";
      reason: "technique-limit" | "computation-limit";
    }
  | { status: "unsolvable" };

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

/** 分析結果と盤面サイズから、推論で決まる難易度とその盤面範囲に入るかを判定する。 */
export function assessMinesweeperDifficulty(
  analysis: MinesweeperDifficultyAnalysis,
  boardSize: MinesweeperBoardSize,
): MinesweeperDifficultyAssessment {
  switch (analysis.status) {
    case "unsupported":
      return { status: "unsupported", reason: analysis.reason };
    case "unsolvable":
      return { status: "unsolvable" };
    case "analyzed":
      return assessAnalyzedChallenge(
        analysis.scale,
        analysis.features,
        boardSize,
      );
  }
}
