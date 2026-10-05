import {
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NumericRange,
} from "@/games/difficulty";
import type { SlidePuzzleDifficultyAnalysis } from "@/games/slide-puzzle/problem/difficulty-analysis";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleDifficulty = DifficultyLevel;

/**
 * 盤面サイズごとの提供範囲の下限（最短手数）。無作為に「近づける手」を選び続けるだけで
 * 5% 以上完成してしまう層を外す（難易度再設計調査 §6.2）。
 */
export const slidePuzzleMinimumOptimalMoveCountByBoardSize = {
  3: 12,
  4: 16,
  5: 24,
} as const satisfies Record<SlidePuzzleBoardSize, number>;

type SlidePuzzleDifficultyCriteria = {
  /**
   * 盤面が大きいほど、盤面の把握・読みの深さ・大きい盤面を小さい盤面へ落とし込む過程の負荷が
   * 強まるとみなす（人間の判断による仮決定。実プレイで検証する）。
   */
  boardSize: SlidePuzzleBoardSize;
  detourMoveCount: NumericRange;
  /** 問題集を作るときに候補を生成する撹拌手数。分類には使わない。 */
  scrambleLengths: readonly number[];
};

/**
 * 盤面を大きくする境目（1→2、3→4）では遠回り手数の帯をそろえ、同じ盤面の中（2→3、4→5）では遠回り手数を上げる。
 * どの境目でも、盤面サイズと遠回り手数のどちらも下げない。
 */
export const slidePuzzleDifficultyCriteria = {
  "1": {
    boardSize: 3,
    detourMoveCount: { minimum: 0, maximum: 3 },
    scrambleLengths: [20, 30, 40, 60],
  },
  "2": {
    boardSize: 4,
    detourMoveCount: { minimum: 2, maximum: 3 },
    scrambleLengths: [20, 25, 30, 35],
  },
  "3": {
    boardSize: 4,
    detourMoveCount: { minimum: 4, maximum: Number.POSITIVE_INFINITY },
    scrambleLengths: [30, 40, 60, 80],
  },
  "4": {
    boardSize: 5,
    detourMoveCount: { minimum: 5, maximum: 7 },
    scrambleLengths: [40, 50, 60, 70],
  },
  "5": {
    boardSize: 5,
    detourMoveCount: { minimum: 8, maximum: Number.POSITIVE_INFINITY },
    scrambleLengths: [60, 70, 80],
  },
} as const satisfies Record<
  SlidePuzzleDifficulty,
  SlidePuzzleDifficultyCriteria
>;

/**
 * 盤面サイズと遠回り手数（タイルを一時的にゴールから遠ざける必要がある手の数）の組でレベルを決める。
 * 最短手数が分からない問題、盤面サイズごとの提供範囲の下限より短い問題、
 * どのレベルの組にも入らない問題は分類しない。
 */
export function assessSlidePuzzleDifficulty(
  analysis: SlidePuzzleDifficultyAnalysis,
): SlidePuzzleDifficulty | null {
  if (analysis.status !== "analyzed") {
    return null;
  }

  const { boardSize, optimalMoveCount, detourMoveCount } = analysis.features;
  if (
    optimalMoveCount < slidePuzzleMinimumOptimalMoveCountByBoardSize[boardSize]
  ) {
    return null;
  }

  return (
    difficultyLevels.find(({ id }) => {
      const criteria = slidePuzzleDifficultyCriteria[id];
      return (
        criteria.boardSize === boardSize &&
        isInNumericRange(detourMoveCount, criteria.detourMoveCount)
      );
    })?.id ?? null
  );
}

/** 記録・診断から読み戻した問題が、そのレベルで遊ぶ盤面サイズで作られているかを確かめる。 */
export function isSlidePuzzleProblemIdentityOfDifficulty(
  identity: SlidePuzzleProblemIdentity,
  difficulty: SlidePuzzleDifficulty,
): boolean {
  return (
    identity.conditions.size ===
    slidePuzzleDifficultyCriteria[difficulty].boardSize
  );
}
