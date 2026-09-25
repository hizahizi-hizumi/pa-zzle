// @vitest-environment node

import {
  calculateSlidePuzzleManhattanDistance,
  createSolvedSlidePuzzleBoard,
  getSlidePuzzleBoardSize,
  isSlidePuzzleSolved,
  isStandardSlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

describe("isSlidePuzzleSolved", () => {
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
    ["3×3 の完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 0], true],
    ["3×3 の空白が右下にない盤面", [1, 2, 3, 4, 5, 6, 7, 0, 8], false],
    [
      "5×5 の完成盤面",
      Array.from({ length: 25 }, (_, index) => (index + 1) % 25),
      true,
    ],
  ] as const;

  test.each(cases)(
    "完成しているかを判定できること: %s",
    (_, board, expected) => {
      const result = isSlidePuzzleSolved(board);

      expect(result).toBe(expected);
    },
  );
});

describe("createSolvedSlidePuzzleBoard", () => {
  const cases = [
    [3, [1, 2, 3, 4, 5, 6, 7, 8, 0]],
    [4, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]],
    [
      5,
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 0,
      ],
    ],
  ] as const;

  test.each(cases)(
    "一辺 %i の盤面でタイルを行優先で並べ右下を空白にした盤面を返すこと",
    (boardSize, expected) => {
      const result = createSolvedSlidePuzzleBoard(boardSize);

      expect(result).toEqual(expected);
    },
  );
});

describe("getSlidePuzzleBoardSize", () => {
  const cases = [
    [9, 3],
    [16, 4],
    [25, 5],
  ] as const;

  test.each(cases)(
    "%i マスの盤面の一辺を %i とすること",
    (cellCount, expected) => {
      const result = getSlidePuzzleBoardSize(
        Array.from({ length: cellCount }, (_, index) => index),
      );

      expect(result).toBe(expected);
    },
  );

  const unsupportedCases = [4, 15, 36] as const;

  test.each(unsupportedCases)(
    "遊べるサイズではない %i マスの盤面を拒否すること",
    (cellCount) => {
      const act = () =>
        getSlidePuzzleBoardSize(
          Array.from({ length: cellCount }, (_, index) => index),
        );

      expect(act).toThrow(RangeError);
    },
  );
});

describe("calculateSlidePuzzleManhattanDistance", () => {
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
    ["3×3 で 1 と 8 が入れ替わった盤面", [8, 2, 3, 4, 5, 6, 7, 1, 0], 6],
    [
      "5×5 で 1 と 24 が入れ替わった盤面",
      [
        24, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 1, 0,
      ],
      14,
    ],
  ] as const;

  test.each(cases)(
    "空白を除くタイルのゴールまでの距離を合計すること: %s",
    (_, board, expected) => {
      const result = calculateSlidePuzzleManhattanDistance(board);

      expect(result).toBe(expected);
    },
  );
});

describe("isStandardSlidePuzzleBoard", () => {
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
    ["3×3 の 0〜8 の並べ替え", [8, 7, 6, 5, 4, 3, 2, 1, 0], true],
    ["3×3 で範囲外のタイルがある", [1, 2, 3, 4, 5, 6, 7, 9, 0], false],
    [
      "5×5 の 0〜24 の並べ替え",
      Array.from({ length: 25 }, (_, index) => 24 - index),
      true,
    ],
    [
      "遊べるサイズではない 6×6 の並べ替え",
      Array.from({ length: 36 }, (_, index) => index),
      false,
    ],
  ] as const;

  test.each(cases)(
    "遊べるサイズのマス数で空白とタイルを 1 つずつ並べた盤面だけを認めること: %s",
    (_, board, expected) => {
      const result = isStandardSlidePuzzleBoard(board);

      expect(result).toBe(expected);
    },
  );
});
