import { tryBridgesNaively } from "@/games/bridges/problem/generation/naive-solver";
import researchCases from "@/games/bridges/problem/generation/research-solver-cases.json";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

const uniqueBoards = researchCases
  .filter(({ solutionCount }) => solutionCount === 1)
  .map(({ board }) => parseBridgesBoard(board.split("/")));

describe("tryBridgesNaively", () => {
  describe("一意解の盤面の場合", () => {
    test("試し置きと戻しで解き切ること", () => {
      const solved = uniqueBoards.map(
        (board, index) =>
          tryBridgesNaively(board, createProblemSeededRandom(`naive-${index}`))
            .solved,
      );

      expect(solved).toEqual(uniqueBoards.map(() => true));
    });

    test("戻す盤面も戻さない盤面もあること", () => {
      const backtracked = new Set(
        uniqueBoards.map(
          (board, index) =>
            tryBridgesNaively(
              board,
              createProblemSeededRandom(`naive-${index}`),
            ).backtrackCount > 0,
        ),
      );

      expect([...backtracked].sort()).toEqual([false, true]);
    });

    test.each(["random", "most-constrained"] as const)(
      "選び方 %s で、同じ乱数列からは同じ結果になること",
      (choice) => {
        const results = [0, 1].map(() =>
          tryBridgesNaively(
            uniqueBoards[0]!,
            createProblemSeededRandom("naive-repeat"),
            choice,
          ),
        );

        expect(results[0]).toEqual(results[1]);
      },
    );
  });

  describe("数字の読みだけで決まる盤面の場合", () => {
    const board = parseBridgesBoard(["1.3.1", ".....", "..1.."]);

    test("戻さずに解くこと", () => {
      const result = tryBridgesNaively(
        board,
        createProblemSeededRandom("naive-count-only"),
      );

      expect(result).toEqual({
        solved: true,
        backtrackCount: 0,
        disconnectedFullCount: 0,
        exceededNodeLimit: false,
      });
    });
  });

  describe("1-1 の組が2つに分かれうる盤面の場合", () => {
    // 4つの角の 1 と真ん中の 4。角どうしをつなぐと全島ちょうどなのに2組に分かれる。
    const board = parseBridgesBoard(["1.1", "...", "1.1"]);

    test("解けず、全島ちょうどで分かれた配置で戻すこと", () => {
      const result = tryBridgesNaively(
        board,
        createProblemSeededRandom("naive-split"),
      );

      expect(result).toMatchObject({
        solved: false,
        disconnectedFullCount: 2,
      });
    });
  });
});
