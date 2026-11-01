import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  NonogramClueShape,
  NonogramDifficultyAnalysis,
  NonogramReadingFeatures,
  NonogramScaleMetrics,
} from "@/games/nonogram/problem/difficulty-analysis";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";

export type NonogramDifficulty = DifficultyLevel;

/**
 * 1つのレベルが求める組み合わせ。挑戦（連鎖を、手を付けられる場所が少ない局面でも見つけ続けてたどること）を、
 * 連鎖の深さを主に、入口の広さと細い段の数を上限・下限として重ねて表す。1本ずつの読みの重さは塊の分かれ方で表す。
 * - `boardSizes`: 許す盤面の大きさ。見渡す範囲で、単独でレベルを決めないよう隣のレベルと重ねる。
 * - `roundCount`: 連鎖の深さ（段の数）。
 * - `entryLineCount`: 最初の段で進められる行・列の数。少ないほど入口が狭い。
 * - `narrowRoundCount`: 進められる行・列が2本以下の段の数。
 * - `blockCountPerLine`: 行・列あたりの塊の数の平均。連鎖の深さとはほぼ独立に図柄の作り方で決まるので、
 *   連鎖が深くても塊が1つの行・列ばかりでなぞるだけになる問題を上のレベルから除く。
 */
export type NonogramLevelCombination = {
  boardSizes: readonly NonogramGridSize[];
  roundCount: NumericRange;
  entryLineCount: NumericRange;
  narrowRoundCount: NumericRange;
  blockCountPerLine: NumericRange;
};

const unbounded = Number.POSITIVE_INFINITY;

/**
 * 各レベルの組み合わせ。連鎖の深さの範囲は重ならず、上のレベルほど深い。入口の上限は下げ、細い段の下限は上げ、
 * 盤面の大きさは広げる（隣のレベルと1つ以上重ねる）。行・列あたりの塊の数の範囲は上のレベルほど0.4ずつ多い側へ動かし、
 * 隣のレベルとは0.2だけ重ねる（レベル1は下限なし、レベル5は上限なし）。どのレベルにも当たらない問題は提供しない。
 * 連鎖の深さの上限20は、最上位の帯の中のばらつきを抑えるため。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const nonogramLevelCombinations = {
  "1": {
    boardSizes: [
      { width: 7, height: 7 },
      { width: 8, height: 8 },
    ],
    roundCount: { minimum: 2, maximum: 4 },
    entryLineCount: { minimum: 0, maximum: unbounded },
    narrowRoundCount: { minimum: 0, maximum: unbounded },
    blockCountPerLine: { minimum: 0, maximum: 1.6 },
  },
  "2": {
    boardSizes: [
      { width: 8, height: 8 },
      { width: 9, height: 9 },
    ],
    roundCount: { minimum: 5, maximum: 6 },
    entryLineCount: { minimum: 0, maximum: 12 },
    narrowRoundCount: { minimum: 0, maximum: unbounded },
    blockCountPerLine: { minimum: 1.4, maximum: 2.0 },
  },
  "3": {
    boardSizes: [
      { width: 9, height: 9 },
      { width: 10, height: 10 },
    ],
    roundCount: { minimum: 7, maximum: 8 },
    entryLineCount: { minimum: 0, maximum: 10 },
    narrowRoundCount: { minimum: 1, maximum: unbounded },
    blockCountPerLine: { minimum: 1.8, maximum: 2.4 },
  },
  "4": {
    boardSizes: [
      { width: 10, height: 10 },
      { width: 10, height: 12 },
    ],
    roundCount: { minimum: 9, maximum: 11 },
    entryLineCount: { minimum: 0, maximum: 8 },
    narrowRoundCount: { minimum: 2, maximum: unbounded },
    blockCountPerLine: { minimum: 2.2, maximum: 2.8 },
  },
  "5": {
    boardSizes: [
      { width: 10, height: 12 },
      { width: 10, height: 13 },
      { width: 10, height: 15 },
    ],
    roundCount: { minimum: 12, maximum: 20 },
    entryLineCount: { minimum: 0, maximum: 7 },
    narrowRoundCount: { minimum: 3, maximum: unbounded },
    blockCountPerLine: { minimum: 2.6, maximum: unbounded },
  },
} as const satisfies Record<NonogramDifficulty, NonogramLevelCombination>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 線の読みだけで解けるが、盤面の大きさと特徴の組み合わせがどのレベルにも当たらないので提供しない。
 * - `unsupported`: 解はただ1つだが仮置きが要り、挑戦の強さを評価できない。
 * - `invalid`: 解が2つ以上あるなど、問題として成立しない。
 */
export type NonogramDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: { reason: "unlisted-combination" };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function coversBoardSize(
  { boardSizes }: NonogramLevelCombination,
  { width, height }: NonogramGridSize,
): boolean {
  return boardSizes.some(
    (size) => size.width === width && size.height === height,
  );
}

function matchesLevelCombination(
  scale: NonogramScaleMetrics,
  clueShape: NonogramClueShape,
  features: NonogramReadingFeatures,
  combination: NonogramLevelCombination,
): boolean {
  return (
    coversBoardSize(combination, scale) &&
    isInNumericRange(
      clueShape.blockCountPerLine,
      combination.blockCountPerLine,
    ) &&
    isInNumericRange(features.roundCount, combination.roundCount) &&
    isInNumericRange(features.entryLineCount, combination.entryLineCount) &&
    isInNumericRange(features.narrowRoundCount, combination.narrowRoundCount)
  );
}

export function assessNonogramDifficulty(
  analysis: NonogramDifficultyAnalysis,
): NonogramDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(
          analysis.scale,
          analysis.clueShape,
          analysis.features,
          nonogramLevelCombinations[id],
        ),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty }
        : { status: "out-of-range", reason: "unlisted-combination" };
    }
  }
}
