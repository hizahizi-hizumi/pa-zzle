import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import {
  type BridgesBoardSize,
  type BridgesGenerationConditions,
  bridgesBoardSizes,
  bridgesDoubleBridgeRates,
  bridgesExtraBridgeRates,
  bridgesIslandDensities,
} from "@/games/bridges/problem/problem";
import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";

export type BridgesDifficulty = DifficultyLevel;

/**
 * 1つのレベルが求める組み合わせ。
 * - `boardSize`: 盤面の一辺。読む範囲と架ける量で、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 * - `countRoundCount`: 「ちょうど」で止まり「少なくとも1本はここへ」と読む手詰まりの回数。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながり（閉じる組・孤立・唯一の通り道・1手の先読み）を読む手詰まりの回数。
 * - `countReasoningUndecidedRatio`: 数字の読みだけでは決まらない行き先の割合。早くからつながりを読まなければならないほど大きい。
 * - `trialBacktrackCount`: 素朴な解き方（数字の読みと試し置き）が戻した回数の中央値。試しに架けて直す進め方で押し切れないことの下限。
 */
export type BridgesLevelCombination = {
  boardSize: NumericRange<BridgesBoardSize>;
  countRoundCount: NumericRange;
  connectivityRoundCount: NumericRange;
  countReasoningUndecidedRatio: NumericRange;
  trialBacktrackCount: NumericRange;
};

const anyCount: NumericRange = {
  minimum: 0,
  maximum: Number.POSITIVE_INFINITY,
};

/**
 * 各レベルの組み合わせ。上のレベルはどの系統も下げず、隣のレベルとは盤面の一辺を1つ共有する。
 * 共有する盤面では、推論の特徴でだけレベルが分かれる。境界は人間の実プレイで確かめる前の暫定値。
 */
export const bridgesLevelCombinations = {
  "1": {
    boardSize: { minimum: 6, maximum: 7 },
    countRoundCount: { minimum: 0, maximum: 0 },
    connectivityRoundCount: { minimum: 0, maximum: 0 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0 },
    trialBacktrackCount: anyCount,
  },
  "2": {
    boardSize: { minimum: 7, maximum: 8 },
    countRoundCount: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    connectivityRoundCount: { minimum: 0, maximum: 0 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0 },
    trialBacktrackCount: anyCount,
  },
  "3": {
    boardSize: { minimum: 8, maximum: 9 },
    countRoundCount: anyCount,
    connectivityRoundCount: { minimum: 1, maximum: 1 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0.5 },
    trialBacktrackCount: anyCount,
  },
  "4": {
    boardSize: { minimum: 9, maximum: 10 },
    countRoundCount: anyCount,
    connectivityRoundCount: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    countReasoningUndecidedRatio: {
      minimum: 0.5,
      maximum: 1,
      excludesMinimum: true,
    },
    trialBacktrackCount: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
  },
  "5": {
    boardSize: { minimum: 10, maximum: 10 },
    countRoundCount: anyCount,
    connectivityRoundCount: { minimum: 2, maximum: Number.POSITIVE_INFINITY },
    countReasoningUndecidedRatio: {
      minimum: 0.6,
      maximum: 1,
      excludesMinimum: true,
    },
    trialBacktrackCount: { minimum: 3, maximum: Number.POSITIVE_INFINITY },
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelCombination>;

/** 分類に使った特徴。 */
export type BridgesAssessedFeatures = {
  boardSize: number;
  countRoundCount: number;
  connectivityRoundCount: number;
  countReasoningUndecidedRatio: number;
  trialBacktrackCount: number;
};

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが提供しない。
 *   - `requires-trial`: 推理（段 A1〜D）では決まらず、試し置きが要る。推理だけで解ける問題だけを出す。
 *   - `unlisted-combination`: 特徴と盤面の組み合わせがどのレベルにも当たらない。
 * - `unsupported`: 一意解だが、試し置きまで使っても決まらない。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
export type BridgesDifficultyAssessment = DifficultyAssessment<{
  classified: { features: BridgesAssessedFeatures };
  outOfRange:
    | { reason: "requires-trial" }
    | { reason: "unlisted-combination"; features: BridgesAssessedFeatures };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function matchesLevelCombination(
  features: BridgesAssessedFeatures,
  combination: BridgesLevelCombination,
): boolean {
  return (
    isInNumericRange(features.boardSize, combination.boardSize) &&
    isInNumericRange(features.countRoundCount, combination.countRoundCount) &&
    isInNumericRange(
      features.connectivityRoundCount,
      combination.connectivityRoundCount,
    ) &&
    isInNumericRange(
      features.countReasoningUndecidedRatio,
      combination.countReasoningUndecidedRatio,
    ) &&
    isInNumericRange(
      features.trialBacktrackCount,
      combination.trialBacktrackCount,
    )
  );
}

/**
 * 分析結果を難易度へ分類する。2つのレベルの組み合わせに当たる問題（レベル4 と 5 の両方に当たる 10×10 など）は、高い方のレベルにする。
 */
export function assessBridgesDifficulty(
  analysis: BridgesDifficultyAnalysis,
): BridgesDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      if (analysis.requiresTrial) {
        return { status: "out-of-range", reason: "requires-trial" };
      }
      const { scale, reasoning, trial } = analysis;
      const features = {
        boardSize: scale.size,
        countRoundCount: reasoning.countRoundCount,
        connectivityRoundCount: reasoning.connectivityRoundCount,
        countReasoningUndecidedRatio: reasoning.countReasoningUndecidedRatio,
        trialBacktrackCount: trial.medianBacktrackCount,
      };
      const difficulty = difficultyLevels.findLast(({ id }) =>
        matchesLevelCombination(features, bridgesLevelCombinations[id]),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, features }
        : { status: "out-of-range", reason: "unlisted-combination", features };
    }
  }
}

/**
 * レベルの盤面の範囲に入る生成条件をすべて挙げる。問題の候補を作る範囲に使う。
 * 密度・2本の割合・輪の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 */
export function listBridgesGenerationConditions(
  difficulty: BridgesDifficulty,
): BridgesGenerationConditions[] {
  const { boardSize } = bridgesLevelCombinations[difficulty];
  return bridgesBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      bridgesIslandDensities.flatMap((islandDensity) =>
        bridgesDoubleBridgeRates.flatMap((doubleBridgeRate) =>
          bridgesExtraBridgeRates.map((extraBridgeRate) => ({
            size,
            islandDensity,
            doubleBridgeRate,
            extraBridgeRate,
          })),
        ),
      ),
    );
}
