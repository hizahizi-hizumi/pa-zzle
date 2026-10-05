import {
  assertWaterSortProblem,
  type WaterSortProblem,
} from "@/games/water-sort/problem/problem";

describe("assertWaterSortProblem", () => {
  describe("色ごとに容量分のブロックがあり、空の瓶を持つ初期状態の場合", () => {
    const problem: WaterSortProblem = {
      initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
    };

    test("受け入れること", () => {
      function act() {
        assertWaterSortProblem(problem);
      }

      expect(act).not.toThrow();
    });
  });

  const invalidCases = [
    ["満杯でない瓶がある", [[0, 0, 0], [0, 1, 1, 1], [1], []]],
    ["色のブロック数が容量と違う", [[0, 0, 0, 0], [0, 1, 1, 1], [], []]],
    [
      "空の瓶が無い",
      [
        [0, 0, 0, 1],
        [1, 1, 1, 0],
      ],
    ],
  ] as const;

  test.each(invalidCases)("%s初期状態を拒否すること", (_, initialState) => {
    function act() {
      assertWaterSortProblem({ initialState });
    }

    expect(act).toThrow();
  });
});
