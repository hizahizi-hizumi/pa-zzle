import {
  assertSlidePuzzleProblem,
  type SlidePuzzleProblem,
} from "@/games/slide-puzzle/problem/problem";

describe("assertSlidePuzzleProblem", () => {
  describe("各タイルと空白を1つずつ並べた盤面の場合", () => {
    const problem: SlidePuzzleProblem = {
      initialBoard: [1, 2, 3, 4, 5, 6, 7, 0, 8],
    };

    test("受け入れること", () => {
      function act() {
        assertSlidePuzzleProblem(problem);
      }

      expect(act).not.toThrow();
    });
  });

  const invalidCases = [
    ["扱わないマス数", [1, 2, 3, 0]],
    ["同じタイルが2つある", [1, 1, 3, 4, 5, 6, 7, 0, 8]],
    ["範囲外のタイルがある", [1, 2, 3, 4, 5, 6, 7, 0, 9]],
  ] as const;

  test.each(invalidCases)("%s盤面を拒否すること", (_, initialBoard) => {
    function act() {
      assertSlidePuzzleProblem({ initialBoard });
    }

    expect(act).toThrow();
  });
});
