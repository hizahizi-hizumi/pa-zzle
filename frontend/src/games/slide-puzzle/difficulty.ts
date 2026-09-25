import type { SlidePuzzleDifficultyAnalysis } from "@/games/slide-puzzle/problem/difficulty-analysis";

export const slidePuzzleDifficulties = [
  {
    id: "1",
    label: "レベル 1",
    description: "近いタイルから順に滑らせれば揃います",
  },
  {
    id: "2",
    label: "レベル 2",
    description: "ときどき、揃えかけたタイルを一度どかす必要があります",
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
    description: "盤面全体が入り組み、長い先読みで無駄の少ない手順を探します",
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

/** 提供範囲の下限。これより短い問題は、干渉を解く計画がほとんど要らない。 */
export const SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT = 8;

type SlidePuzzleDifficultyCriteria = {
  /** 問題集を作るときに候補を生成する撹拌手数。分類には使わない。 */
  scrambleLengths: readonly number[];
  minimumDetourMoveCount: number;
  maximumDetourMoveCount: number | null;
};

export const slidePuzzleDifficultyCriteria: Record<
  SlidePuzzleDifficulty,
  SlidePuzzleDifficultyCriteria
> = {
  "1": {
    scrambleLengths: [15, 20, 25, 30],
    minimumDetourMoveCount: 0,
    maximumDetourMoveCount: 1,
  },
  "2": {
    scrambleLengths: [20, 25, 30, 35],
    minimumDetourMoveCount: 2,
    maximumDetourMoveCount: 3,
  },
  "3": {
    scrambleLengths: [30, 35, 40, 50],
    minimumDetourMoveCount: 4,
    maximumDetourMoveCount: 5,
  },
  "4": {
    scrambleLengths: [40, 50, 60, 80],
    minimumDetourMoveCount: 6,
    maximumDetourMoveCount: 7,
  },
  "5": {
    scrambleLengths: [60, 80, 100, 120],
    minimumDetourMoveCount: 8,
    maximumDetourMoveCount: null,
  },
};

/**
 * 遠回り手数（タイルを一時的にゴールから遠ざける必要がある手の数）でレベルを決める。
 * 最短手数が分からない問題と、提供範囲の下限より短い問題は分類しない。
 */
export function assessSlidePuzzleDifficulty(
  analysis: SlidePuzzleDifficultyAnalysis,
): SlidePuzzleDifficulty | null {
  if (analysis.status !== "analyzed") {
    return null;
  }

  const { optimalMoveCount, detourMoveCount } = analysis.features;
  if (optimalMoveCount < SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT) {
    return null;
  }

  return (
    slidePuzzleDifficulties.find(({ id }) => {
      const { minimumDetourMoveCount, maximumDetourMoveCount } =
        slidePuzzleDifficultyCriteria[id];
      return (
        detourMoveCount >= minimumDetourMoveCount &&
        (maximumDetourMoveCount === null ||
          detourMoveCount <= maximumDetourMoveCount)
      );
    })?.id ?? null
  );
}
