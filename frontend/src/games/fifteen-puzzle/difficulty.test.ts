// @vitest-environment node

import {
  assessFifteenPuzzleDifficulty,
  getFifteenPuzzleDifficultyLabel,
  parseFifteenPuzzleDifficulty,
} from "@/games/fifteen-puzzle/difficulty";
import type { FifteenPuzzleDifficultyAnalysis } from "@/games/fifteen-puzzle/problem/difficulty-analysis";

function createAnalysis(
  optimalMoveCount: number,
  detourMoveCount: number,
): FifteenPuzzleDifficultyAnalysis {
  return {
    status: "analyzed",
    features: {
      optimalMoveCount,
      manhattanDistance: optimalMoveCount - detourMoveCount * 2,
      detourMoveCount,
      misplacedTileCount: 0,
      linearConflictPairCount: 0,
    },
  };
}

describe("parseFifteenPuzzleDifficulty", () => {
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
      const result = parseFifteenPuzzleDifficulty(value);

      expect(result).toBe(expected);
    },
  );
});

describe("getFifteenPuzzleDifficultyLabel", () => {
  const cases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
  ] as const;

  test.each(cases)("難易度の表示名を返すこと: %s", (difficulty, expected) => {
    const result = getFifteenPuzzleDifficultyLabel(difficulty);

    expect(result).toBe(expected);
  });
});

describe("assessFifteenPuzzleDifficulty", () => {
  const cases = [
    [8, 0, "1"],
    [20, 1, "1"],
    [20, 2, "2"],
    [30, 3, "2"],
    [30, 4, "3"],
    [30, 5, "3"],
    [30, 6, "4"],
    [40, 7, "4"],
    [40, 8, "5"],
    [60, 12, "5"],
  ] as const;

  test.each(cases)(
    "最短 %i 手・遠回り %i 手の問題をレベル %s と判定すること",
    (optimalMoveCount, detourMoveCount, expected) => {
      const result = assessFifteenPuzzleDifficulty(
        createAnalysis(optimalMoveCount, detourMoveCount),
      );

      expect(result).toBe(expected);
    },
  );

  const outOfRangeCases = [
    ["提供範囲の下限より短い問題", createAnalysis(7, 0)],
    ["最短手数が分からない問題", { status: "unsupported" } as const],
  ] as const;

  test.each(outOfRangeCases)("%s を分類しないこと", (_label, analysis) => {
    const result = assessFifteenPuzzleDifficulty(analysis);

    expect(result).toBeNull();
  });
});
