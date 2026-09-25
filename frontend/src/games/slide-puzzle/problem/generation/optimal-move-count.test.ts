// @vitest-environment node

import { createSlidePuzzleOptimalMoveCounter } from "@/games/slide-puzzle/problem/generation/optimal-move-count";

describe("createSlidePuzzleOptimalMoveCounter", () => {
  describe("3×3 の場合", () => {
    const countOptimalMoves = createSlidePuzzleOptimalMoveCounter(3);
    const cases = [
      ["完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 0], 0],
      ["1 と 2、7 と 8 が入れ替わった盤面", [2, 1, 3, 4, 5, 6, 8, 7, 0], 22],
    ] as const;

    test.each(cases)(
      "全状態の表から最短手数を引くこと: %s",
      (_, board, expected) => {
        const result = countOptimalMoves(board);

        expect(result).toBe(expected);
      },
    );
  });
});
