// @vitest-environment node

import {
  calculateFifteenPuzzleManhattanDistance,
  createSolvedFifteenPuzzleBoard,
  isFifteenPuzzleSolved,
  isStandardFifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";

describe("isFifteenPuzzleSolved", () => {
  const cases = [
    ["完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0], true],
    [
      "空白が右下にない盤面",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      false,
    ],
    [
      "タイルが入れ替わった盤面",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0],
      false,
    ],
  ] as const;

  test.each(cases)(
    "完成しているかを判定できること: %s",
    (_, board, expected) => {
      const result = isFifteenPuzzleSolved(board);

      expect(result).toBe(expected);
    },
  );
});

describe("createSolvedFifteenPuzzleBoard", () => {
  test("1〜15 を行優先で並べ右下を空白にした盤面を返すこと", () => {
    const result = createSolvedFifteenPuzzleBoard();

    expect(result).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
    ]);
  });
});

describe("calculateFifteenPuzzleManhattanDistance", () => {
  const cases = [
    ["完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0], 0],
    [
      "15 が 1 マスずれた盤面",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      1,
    ],
    [
      "1 と 15 が入れ替わった盤面",
      [15, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 1, 0],
      10,
    ],
  ] as const;

  test.each(cases)(
    "空白を除くタイルのゴールまでの距離を合計すること: %s",
    (_, board, expected) => {
      const result = calculateFifteenPuzzleManhattanDistance(board);

      expect(result).toBe(expected);
    },
  );
});

describe("isStandardFifteenPuzzleBoard", () => {
  const cases = [
    [
      "0〜15 の並べ替え",
      [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1],
      true,
    ],
    ["マスが足りない", [1, 2, 3, 0], false],
    [
      "タイルが重複している",
      [1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
      false,
    ],
    [
      "範囲外のタイルがある",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 0],
      false,
    ],
    ["配列ではない", "1,2,3", false],
  ] as const;

  test.each(cases)(
    "0〜15 の並べ替えだけを盤面として認めること: %s",
    (_, board, expected) => {
      const result = isStandardFifteenPuzzleBoard(board);

      expect(result).toBe(expected);
    },
  );
});
