import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { createMinesweeperDeductionState } from "@/games/minesweeper/problem/generation/deduction-state";
import {
  _private,
  findMinesweeperCertainCells,
  solveMinesweeperLogically,
} from "@/games/minesweeper/problem/generation/solver";

const { splitConstraintComponents, selectMineCountsConsistentWithTotal } =
  _private;

/** `*` は未開示の地雷、`#` は未開示の安全マス、`.` は開示済みの安全マス。行は `/` で区切る。 */
function problemFromPicture(picture: string): MinesweeperProblem {
  const rows = picture.split("/");
  const cells = rows.join("").split("");
  return {
    board: {
      rows: rows.length,
      columns: rows[0]!.length,
      mineCellIndices: cells.flatMap((cell, index) =>
        cell === "*" ? [index] : [],
      ),
    },
    initialRevealedCellIndices: cells.flatMap((cell, index) =>
      cell === "." ? [index] : [],
    ),
  };
}

describe("findMinesweeperCertainCells", () => {
  describe("角の2択が残る局面の場合", () => {
    const state = createMinesweeperDeductionState(
      problemFromPicture("*#/../.."),
    );

    test("どのマスも確定しないこと", () => {
      const result = findMinesweeperCertainCells(state);

      expect(result).toEqual({
        status: "complete",
        withoutTotalMineCount: { safeCellIndices: [], mineCellIndices: [] },
        withTotalMineCount: { safeCellIndices: [], mineCellIndices: [] },
      });
    });
  });

  describe("数字に隣接しない未確定マスがある局面の場合", () => {
    const state = createMinesweeperDeductionState(
      problemFromPicture(".*#/###/###"),
    );

    test("総地雷数を使ったときだけ数字に隣接しないマスを安全と確定すること", () => {
      const result = findMinesweeperCertainCells(state);

      expect(result).toEqual({
        status: "complete",
        withoutTotalMineCount: { safeCellIndices: [], mineCellIndices: [] },
        withTotalMineCount: {
          safeCellIndices: [2, 5, 6, 7, 8],
          mineCellIndices: [],
        },
      });
    });
  });

  describe("3つの数字を同時に考える必要がある局面の場合", () => {
    const state = createMinesweeperDeductionState(
      problemFromPicture("**##*##/*.....*/#.....#"),
    );

    test("制約の全解列挙から確定すること", () => {
      const result = findMinesweeperCertainCells(state);

      expect(result.status).toBe("complete");
      expect(
        result.status === "complete" && result.withoutTotalMineCount,
      ).toEqual({ safeCellIndices: [3, 6], mineCellIndices: [0] });
    });

    test("列挙ノード数の上限を超えると打ち切ること", () => {
      const result = findMinesweeperCertainCells(state, {
        maximumNodeCount: 3,
      });

      expect(result).toEqual({ status: "truncated" });
    });
  });
});

describe("solveMinesweeperLogically", () => {
  const cases = [
    ["角の2択", "*#/../..", "guess-required"],
    ["開けた場所の1-2", "*##**##/*.....*/#.....#", "solved"],
    ["総地雷数が必要な終盤", ".*#/###/###", "solved"],
  ] as const;

  test.each(cases)("%sを判定すること", (_name, picture, expectedStatus) => {
    const result = solveMinesweeperLogically(problemFromPicture(picture));

    expect(result.status).toBe(expectedStatus);
  });

  describe("列挙ノード数の上限が小さすぎる場合", () => {
    const problem = problemFromPicture("*##**##/*.....*/#.....#");

    test("計算量上限で打ち切ったことを返すこと", () => {
      const result = solveMinesweeperLogically(problem, {
        maximumNodeCount: 1,
      });

      expect(result).toEqual({ status: "computation-limit", roundCount: 0 });
    });
  });
});

describe("splitConstraintComponents", () => {
  const constraints = [
    { cellIndices: [0, 1], mineCount: 1 },
    { cellIndices: [5, 6], mineCount: 1 },
    { cellIndices: [1, 2], mineCount: 1 },
  ];

  test("未確定マスを共有する制約を同じ成分にまとめること", () => {
    const result = splitConstraintComponents(constraints);

    expect(result).toEqual([
      [constraints[0], constraints[2]],
      [constraints[1]],
    ]);
  });
});

describe("selectMineCountsConsistentWithTotal", () => {
  const components = [
    {
      system: {
        cellIndices: [0, 1],
        constraintIdsByPosition: [[0], [0]],
        constraintMineCounts: [1],
        constraintCellCounts: [2],
      },
      possibleValuesByMineCount: new Map([
        [1, { canBeMine: Uint8Array.of(1, 1), canBeSafe: Uint8Array.of(1, 1) }],
        [2, { canBeMine: Uint8Array.of(1, 1), canBeSafe: Uint8Array.of(0, 0) }],
      ]),
    },
  ];

  test("残り地雷数と内部マス数に収まる成分の地雷数だけを残すこと", () => {
    const result = selectMineCountsConsistentWithTotal(components, 3, 1);

    expect(result.feasibleMineCountsByComponent).toEqual([new Set([2])]);
    expect(result.interiorMineCounts).toEqual([1]);
  });
});
