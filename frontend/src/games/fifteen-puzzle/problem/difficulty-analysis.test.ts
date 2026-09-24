// @vitest-environment node

import { analyzeFifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/problem/difficulty-analysis";
import type { FifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/state";

describe("analyzeFifteenPuzzleDifficulty", () => {
  // 1 行目で 1 と 2、3 と 4 が入れ替わっている。最短手数 28 手は solver で求めた値。
  const swappedRowBoard: FifteenPuzzleBoard = [
    2, 1, 4, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
  ];

  test("遠回り手数を最短手数とマンハッタン距離の差の半分として求めること", () => {
    const result = analyzeFifteenPuzzleDifficulty(swappedRowBoard, 28);

    expect(result).toEqual({
      status: "analyzed",
      features: {
        optimalMoveCount: 28,
        manhattanDistance: 4,
        detourMoveCount: 12,
        misplacedTileCount: 4,
        linearConflictPairCount: 2,
      },
    });
  });

  test("最短手数が不明な問題を評価不能とすること", () => {
    const result = analyzeFifteenPuzzleDifficulty(swappedRowBoard, null);

    expect(result).toEqual({ status: "unsupported" });
  });

  const inconsistentOptimalMoveCounts = [2, 5, 6.5];

  test.each(inconsistentOptimalMoveCounts)(
    "マンハッタン距離と矛盾する最短手数を拒否すること: %s",
    (optimalMoveCount) => {
      const act = () =>
        analyzeFifteenPuzzleDifficulty(swappedRowBoard, optimalMoveCount);

      expect(act).toThrow(RangeError);
    },
  );
});
