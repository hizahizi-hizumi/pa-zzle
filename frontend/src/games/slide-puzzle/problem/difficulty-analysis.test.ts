// @vitest-environment node

import { analyzeSlidePuzzleDifficulty } from "@/games/slide-puzzle/problem/difficulty-analysis";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";

describe("analyzeSlidePuzzleDifficulty", () => {
  // 1 行目で 1 と 2、3 と 4 が入れ替わっている。最短手数 28 手は solver で求めた値。
  const swappedRowBoard: SlidePuzzleBoard = [
    2, 1, 4, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
  ];

  test("遠回り手数を最短手数とマンハッタン距離の差の半分として求めること", () => {
    const result = analyzeSlidePuzzleDifficulty(swappedRowBoard, 28);

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

  const sizedCases = [
    [
      // 3×3 の全状態で遠回り手数が最大になる配置のひとつ。最短手数 22 手は全状態の幅優先探索で求めた値。
      "3×3 で 1 と 2、7 と 8 が入れ替わった盤面",
      [2, 1, 3, 4, 5, 6, 8, 7, 0],
      22,
      {
        optimalMoveCount: 22,
        manhattanDistance: 4,
        detourMoveCount: 9,
        misplacedTileCount: 4,
        linearConflictPairCount: 2,
      },
    ],
    [
      "5×5 で右下のタイルを 1 枚ずらした盤面",
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 0, 24,
      ],
      1,
      {
        optimalMoveCount: 1,
        manhattanDistance: 1,
        detourMoveCount: 0,
        misplacedTileCount: 1,
        linearConflictPairCount: 0,
      },
    ],
  ] as const;

  test.each(sizedCases)(
    "盤面サイズに合わせて特徴を求めること: %s",
    (_, board, optimalMoveCount, features) => {
      const result = analyzeSlidePuzzleDifficulty(board, optimalMoveCount);

      expect(result).toEqual({ status: "analyzed", features });
    },
  );

  test("最短手数が不明な問題を評価不能とすること", () => {
    const result = analyzeSlidePuzzleDifficulty(swappedRowBoard, null);

    expect(result).toEqual({ status: "unsupported" });
  });

  const inconsistentOptimalMoveCounts = [2, 5, 6.5];

  test.each(inconsistentOptimalMoveCounts)(
    "マンハッタン距離と矛盾する最短手数を拒否すること: %s",
    (optimalMoveCount) => {
      const act = () =>
        analyzeSlidePuzzleDifficulty(swappedRowBoard, optimalMoveCount);

      expect(act).toThrow(RangeError);
    },
  );
});
