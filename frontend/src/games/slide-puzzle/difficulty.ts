import type { SlidePuzzleDifficultyAnalysis } from "@/games/slide-puzzle/problem/difficulty-analysis";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export const slidePuzzleDifficulties = [
  {
    id: "1",
    label: "レベル 1",
    description: "小さな盤面で、ときどき回り込みながら揃えます",
  },
  {
    id: "2",
    label: "レベル 2",
    description:
      "盤面が広がり、ときどき揃えかけたタイルを一度どかす必要があります",
  },
  {
    id: "3",
    label: "レベル 3",
    description: "タイル同士が道をふさぎ、回り込む順番を考える必要があります",
  },
  {
    id: "4",
    label: "レベル 4",
    description: "何枚ものタイルの退避と送り込みを組み合わせて計画します",
  },
  {
    id: "5",
    label: "レベル 5",
    description:
      "広い盤面を見渡し、外側から順に小さな盤面へ落とし込みながら、入り組んだ手順を読みます",
  },
] as const;

export type SlidePuzzleDifficulty =
  (typeof slidePuzzleDifficulties)[number]["id"];

export function parseSlidePuzzleDifficulty(
  value: string | undefined,
): SlidePuzzleDifficulty | undefined {
  return slidePuzzleDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getSlidePuzzleDifficultyLabel(
  difficulty: SlidePuzzleDifficulty,
): string {
  return (
    slidePuzzleDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

/**
 * 盤面サイズごとの提供範囲の下限（最短手数）。無作為に「近づける手」を選び続けるだけで
 * 5% 以上完成してしまう層を外す（難易度再設計調査 §6.2）。
 */
export const slidePuzzleMinimumOptimalMoveCountByBoardSize: Record<
  SlidePuzzleBoardSize,
  number
> = {
  3: 12,
  4: 16,
  5: 24,
};

type SlidePuzzleDifficultyCriteria = {
  /**
   * 盤面が大きいほど、盤面の把握・読みの深さ・大きい盤面を小さい盤面へ落とし込む過程の負荷が
   * 強まるとみなす（人間の判断による仮決定。実プレイで検証する）。
   */
  boardSize: SlidePuzzleBoardSize;
  minimumDetourMoveCount: number;
  maximumDetourMoveCount: number | null;
  /** 問題集を作るときに候補を生成する撹拌手数。分類には使わない。 */
  scrambleLengths: readonly number[];
};

/**
 * 盤面を大きくする境目（1→2、4→5）では遠回り手数の帯をそろえ、同じ盤面の中（2→3→4）では遠回り手数を上げる。
 * どの境目でも、盤面サイズと遠回り手数のどちらも下げない。
 */
export const slidePuzzleDifficultyCriteria: Record<
  SlidePuzzleDifficulty,
  SlidePuzzleDifficultyCriteria
> = {
  "1": {
    boardSize: 3,
    minimumDetourMoveCount: 0,
    maximumDetourMoveCount: 3,
    scrambleLengths: [20, 30, 40, 60],
  },
  "2": {
    boardSize: 4,
    minimumDetourMoveCount: 2,
    maximumDetourMoveCount: 3,
    scrambleLengths: [20, 25, 30, 35],
  },
  "3": {
    boardSize: 4,
    minimumDetourMoveCount: 4,
    maximumDetourMoveCount: 5,
    scrambleLengths: [30, 35, 40, 50],
  },
  "4": {
    boardSize: 4,
    minimumDetourMoveCount: 6,
    maximumDetourMoveCount: null,
    scrambleLengths: [40, 60, 80, 120],
  },
  "5": {
    boardSize: 5,
    minimumDetourMoveCount: 6,
    maximumDetourMoveCount: null,
    scrambleLengths: [40, 50, 60, 70, 80],
  },
};

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
    slidePuzzleDifficulties.find(({ id }) => {
      const criteria = slidePuzzleDifficultyCriteria[id];
      return (
        criteria.boardSize === boardSize &&
        detourMoveCount >= criteria.minimumDetourMoveCount &&
        (criteria.maximumDetourMoveCount === null ||
          detourMoveCount <= criteria.maximumDetourMoveCount)
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
