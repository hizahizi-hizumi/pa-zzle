import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { createMinesweeperDeductionState } from "@/games/minesweeper/problem/generation/deduction-state";
import { _private, traceMinesweeperHumanSolve } from "@/games/minesweeper/problem/generation/human-solver";
import { findMinesweeperCertainCells } from "@/games/minesweeper/problem/generation/solver";

const { findEasiestDiscoveries, forEachConnectedConstraintGroup } = _private;

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

describe("traceMinesweeperHumanSolve", () => {
  describe("1つの数字だけで確定できる局面の場合", () => {
    const problem = problemFromPicture("#*#/.#./.#.");

    test("段階1で1つの数字が隣接する未確定マスを全て安全と確定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 1,
        inferenceWidth: 1,
        totalMineCountUsage: "none",
        discoveryCount: 1,
        safeCellCount: 2,
        mineCellCount: 0,
      });
    });
  });

  describe("壁際の1-1の場合", () => {
    const problem = problemFromPicture("*##*/....");

    test("段階2で包含する2つの数字の差から安全マスを確定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.status).toBe("solved");
      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 2,
        inferenceWidth: 2,
        discoveryCount: 2,
        safeCellCount: 2,
        mineCellCount: 0,
      });
    });
  });

  describe("壁際の1-2の場合", () => {
    const problem = problemFromPicture("*#*#/....");

    test("段階2で包含する2つの数字の差から地雷を確定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 2,
        safeCellCount: 1,
        mineCellCount: 1,
      });
    });
  });

  describe("開けた場所の1-2の場合", () => {
    const problem = problemFromPicture("*##**##/*.....*/#.....#");

    test("段階3で部分的に重なる2つの数字の同時充足から確定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 3,
        inferenceWidth: 2,
        discoveryCount: 1,
        safeCellCount: 1,
        mineCellCount: 1,
        maximumDiscoveryRowSpan: 1,
        maximumDiscoveryColumnSpan: 4,
      });
    });
  });

  describe("開けた場所の1-2-1の場合", () => {
    const problem = problemFromPicture("##*#*##/*.....*/#.....#");

    test("段階3で両側の1-2から2つの発見を数えること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 3,
        discoveryCount: 2,
        safeCellCount: 2,
        mineCellCount: 2,
      });
    });
  });

  describe("3つの数字を同時に考える必要がある局面の場合", () => {
    const problem = problemFromPicture("**##*##/*.....*/#.....#");

    test("段階4で推論幅3の確定を記録すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 4,
        inferenceWidth: 3,
        discoveryCount: 1,
      });
    });

    test("推論幅の上限を下回ると人間モデル範囲外とすること", () => {
      const result = traceMinesweeperHumanSolve(problem, {
        maximumInferenceWidth: 2,
      });

      expect(result).toEqual({
        status: "unsupported",
        reason: "technique-limit",
        rounds: [],
      });
    });
  });

  describe("数字に隣接しない未確定マスが総地雷数の組合せで決まる局面の場合", () => {
    const problem = problemFromPicture(".*#/###/###");

    test("段階5で数字に隣接しないマスを安全と確定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[0]).toMatchObject({
        deductionLevel: 5,
        inferenceWidth: null,
        totalMineCountUsage: "combination",
        safeCellCount: 5,
      });
    });
  });

  describe("既知地雷で残り地雷数が0になった局面の場合", () => {
    const problem = problemFromPicture("..../..../..**/..*#");

    test("総地雷数だけの自明な確定を段階1として記録すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.rounds[1]).toMatchObject({
        deductionLevel: 1,
        inferenceWidth: null,
        totalMineCountUsage: "trivial",
        safeCellCount: 1,
      });
    });
  });

  describe("角の2択が残る局面の場合", () => {
    const problem = problemFromPicture("*#/../..");

    test("推測が必要と判定すること", () => {
      const result = traceMinesweeperHumanSolve(problem);

      expect(result.status).toBe("guess-required");
    });
  });

  describe("局所探索の計算量上限を超える場合", () => {
    const problem = problemFromPicture("*##**##/*.....*/#.....#");

    test("計算量上限による評価不能とすること", () => {
      const result = traceMinesweeperHumanSolve(problem, {
        maximumLocalSearchNodeCount: 1,
      });

      expect(result).toEqual({
        status: "unsupported",
        reason: "computation-limit",
        rounds: [],
      });
    });
  });
});

describe("findEasiestDiscoveries", () => {
  const cases = [
    "#*#/.#./.#.",
    "*##*/....",
    "*#*#/....",
    "*##**##/*.....*/#.....#",
    "##*#*##/*.....*/#.....#",
    "**##*##/*.....*/#.....#",
    ".*#/###/###",
  ].map(
    (picture) =>
      [
        picture,
        createMinesweeperDeductionState(problemFromPicture(picture)),
      ] as const,
  );

  test.each(cases)(
    "人間モデルで確定したマスを検証器でも確定すること: %s",
    (_picture, state) => {
      const discoveries = findEasiestDiscoveries(state, {});
      const certainCells = findMinesweeperCertainCells(state);

      expect(discoveries.status).toBe("found");
      expect(certainCells.status).toBe("complete");
      const humanDeductions =
        discoveries.status === "found"
          ? discoveries.levelDiscoveries.discoveries.map(
              (discovery) => discovery.deduction,
            )
          : [];
      const verifiedDeduction =
        certainCells.status === "complete"
          ? certainCells.withTotalMineCount
          : { safeCellIndices: [], mineCellIndices: [] };
      for (const deduction of humanDeductions) {
        expect(verifiedDeduction.safeCellIndices).toEqual(
          expect.arrayContaining([...deduction.safeCellIndices]),
        );
        expect(verifiedDeduction.mineCellIndices).toEqual(
          expect.arrayContaining([...deduction.mineCellIndices]),
        );
      }
    },
  );
});

describe("forEachConnectedConstraintGroup", () => {
  const pathGraph = [[1], [0, 2], [1, 3], [2]];
  const starGraph = [[1, 2, 3], [0], [0], [0]];

  test.each([
    [
      "直線状の4制約",
      pathGraph,
      [
        [0, 1, 2],
        [1, 2, 3],
      ],
    ],
    [
      "星形の4制約",
      starGraph,
      [
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
      ],
    ],
  ] as const)(
    "%sから連結した3制約の組を重複なく列挙すること",
    (_name, graph, expected) => {
      const groups: number[][] = [];

      forEachConnectedConstraintGroup(graph, 3, (constraintIds) => {
        groups.push([...constraintIds].sort((left, right) => left - right));
      });

      expect(
        groups.sort((left, right) => left.join().localeCompare(right.join())),
      ).toEqual(expected);
    },
  );
});
