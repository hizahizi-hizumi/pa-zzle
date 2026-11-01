import {
  countHamiltonianPathHoleLayoutViolations,
  measureHamiltonianPathHoleLayout,
} from "@/games/hamiltonian-path/problem/generation/hole-layout";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

/** 穴が4つの区画に1つずつ散らばった 6×6 の盤面。穴に触れる 2×2 のブロックは25のうち9。 */
const scatteredBoard = parseHamiltonianPathBoard([
  "# . . . . .",
  ". . . . . #",
  ". . S . . .",
  ". . . . . .",
  ". # . . . .",
  ". . . . # .",
]);

/** 左上に4つの穴が固まった 6×6 の盤面。 */
const clusteredBoard = parseHamiltonianPathBoard([
  "# # . . . .",
  "# # . . . .",
  ". . S . . .",
  ". . . . . .",
  ". . . . . .",
  ". . . . . .",
]);

describe("measureHamiltonianPathHoleLayout", () => {
  test("穴の数・最も大きい塊・穴のある区画の数・穴の無い 2×2 のブロックの割合を測ること", () => {
    const layouts = [scatteredBoard, clusteredBoard].map(
      measureHamiltonianPathHoleLayout,
    );

    expect(layouts).toEqual([
      {
        holeCount: 4,
        largestHoleClusterSize: 1,
        quadrantsWithHolesCount: 4,
        openBlockRatio: 16 / 25,
      },
      {
        holeCount: 4,
        largestHoleClusterSize: 4,
        quadrantsWithHolesCount: 1,
        openBlockRatio: 21 / 25,
      },
    ]);
  });

  describe("一辺が奇数の盤面の中央の穴の場合", () => {
    const board = parseHamiltonianPathBoard([
      "S . . . .",
      ". . . . .",
      ". . # . .",
      ". . . . .",
      ". . . . .",
    ]);

    test("4つの区画すべてに数えること", () => {
      const layout = measureHamiltonianPathHoleLayout(board);

      expect(layout.quadrantsWithHolesCount).toBe(4);
    });
  });
});

describe("countHamiltonianPathHoleLayoutViolations", () => {
  const holelessBoard = parseHamiltonianPathBoard([
    "S . . . . .",
    ". . . . . .",
    ". . . . . .",
    ". . . . . .",
    ". . . . . .",
    ". . . . . .",
  ]);
  /** 2×2 のブロックの半分以上に穴が触れる、通路だらけの盤面。 */
  const corridorBoard = parseHamiltonianPathBoard([
    "S . . . . .",
    ". # . # . .",
    ". . . . . .",
    ". # . # . .",
    ". . . . . .",
    ". # . # . .",
  ]);
  const cases = [
    ["穴が散らばった", scatteredBoard, 0],
    ["穴が無く、6×6 の下限の3つに足りない", holelessBoard, 3],
    ["塊が1マス大きく、穴のある区画が2つ足りない", clusteredBoard, 3],
    ["穴の無い 2×2 のブロックが 5/25 しかない", corridorBoard, 3],
  ] as const;

  test.each(cases)("%s盤面の違反を %i と数えること", (_, board, expected) => {
    const violations = countHamiltonianPathHoleLayoutViolations(board);

    expect(violations).toBe(expected);
  });
});
