// @vitest-environment node

import { assessSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
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

describe("assessSlidePuzzleDifficulty", () => {
  const cases = [
    [3, 12, 0, "1"],
    [3, 28, 3, "1"],
    [4, 16, 2, "2"],
    [4, 30, 3, "2"],
    [4, 30, 4, "3"],
    [4, 60, 12, "3"],
    [5, 24, 5, "4"],
    [5, 40, 7, "4"],
    [5, 40, 8, "5"],
    [5, 70, 14, "5"],
  ] as const;

  test.each(cases)(
    "一辺 %i・最短 %i 手・遠回り %i 手の問題をレベル %s と判定すること",
    (boardSize, optimalMoveCount, detourMoveCount, expected) => {
      const result = assessSlidePuzzleDifficulty(
        createAnalysis(boardSize, optimalMoveCount, detourMoveCount),
      );

      expect(result).toEqual({ status: "classified", difficulty: expected });
    },
  );

  const notClassifiedCases = [
    [
      "3×3 で最短 12 手より短い問題",
      createAnalysis(3, 11, 0),
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "4×4 で最短 16 手より短い問題",
      createAnalysis(4, 15, 2),
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "5×5 で最短 24 手より短い問題",
      createAnalysis(5, 23, 6),
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "3×3 で遠回りが 4 手以上の問題",
      createAnalysis(3, 24, 4),
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "4×4 で遠回りが 2 手より少ない問題",
      createAnalysis(4, 30, 1),
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "5×5 で遠回りが 5 手より少ない問題",
      createAnalysis(5, 40, 4),
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "最短手数が分からない問題",
      { status: "unsupported" },
      { status: "unsupported" },
    ],
  ] as const;

  test.each(notClassifiedCases)(
    "%s を分類しないこと",
    (_label, analysis, expected) => {
      const result = assessSlidePuzzleDifficulty(analysis);

      expect(result).toEqual(expected);
    },
  );
});
