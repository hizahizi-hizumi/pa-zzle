// @vitest-environment node

import {
  assessSlidePuzzleDifficulty,
  getSlidePuzzleDifficultyLabel,
  parseSlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleDifficultyAnalysis } from "@/games/slide-puzzle/problem/difficulty-analysis";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

function createAnalysis(
  boardSize: SlidePuzzleBoardSize,
  optimalMoveCount: number,
  detourMoveCount: number,
): SlidePuzzleDifficultyAnalysis {
  return {
    status: "analyzed",
    features: {
      boardSize,
      optimalMoveCount,
      manhattanDistance: optimalMoveCount - detourMoveCount * 2,
      detourMoveCount,
      misplacedTileCount: 0,
      linearConflictPairCount: 0,
    },
  };
}

describe("parseSlidePuzzleDifficulty", () => {
  const cases = [
    ["1", "1"],
    ["5", "5"],
    ["0", undefined],
    ["6", undefined],
    ["easy", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)(
    "レベル 1〜5 の ID だけを難易度として認めること: %s",
    (value, expected) => {
      const result = parseSlidePuzzleDifficulty(value);

      expect(result).toBe(expected);
    },
  );
});

describe("getSlidePuzzleDifficultyLabel", () => {
  const cases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
  ] as const;

  test.each(cases)("難易度の表示名を返すこと: %s", (difficulty, expected) => {
    const result = getSlidePuzzleDifficultyLabel(difficulty);

    expect(result).toBe(expected);
  });
});

describe("assessSlidePuzzleDifficulty", () => {
  const cases = [
    [3, 12, 0, "1"],
    [3, 28, 3, "1"],
    [4, 16, 2, "2"],
    [4, 30, 3, "2"],
    [4, 30, 4, "3"],
    [4, 30, 5, "3"],
    [4, 30, 6, "4"],
    [4, 60, 12, "4"],
    [5, 24, 6, "5"],
    [5, 70, 14, "5"],
  ] as const;

  test.each(cases)(
    "一辺 %i・最短 %i 手・遠回り %i 手の問題をレベル %s と判定すること",
    (boardSize, optimalMoveCount, detourMoveCount, expected) => {
      const result = assessSlidePuzzleDifficulty(
        createAnalysis(boardSize, optimalMoveCount, detourMoveCount),
      );

      expect(result).toBe(expected);
    },
  );

  const outOfRangeCases = [
    ["3×3 で最短 12 手より短い問題", createAnalysis(3, 11, 0)],
    ["4×4 で最短 16 手より短い問題", createAnalysis(4, 15, 2)],
    ["5×5 で最短 24 手より短い問題", createAnalysis(5, 23, 6)],
    ["3×3 で遠回りが 4 手以上の問題", createAnalysis(3, 24, 4)],
    ["4×4 で遠回りが 2 手より少ない問題", createAnalysis(4, 30, 1)],
    ["5×5 で遠回りが 6 手より少ない問題", createAnalysis(5, 40, 5)],
    ["最短手数が分からない問題", { status: "unsupported" } as const],
  ] as const;

  test.each(outOfRangeCases)("%s を分類しないこと", (_label, analysis) => {
    const result = assessSlidePuzzleDifficulty(analysis);

    expect(result).toBeNull();
  });
});
