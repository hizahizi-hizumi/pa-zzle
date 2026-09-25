import { createProblemSeededRandom } from "@/games/problem-seed";
import {
  countTakuzuSolutions,
  findRandomTakuzuSolution,
} from "@/games/takuzu/problem/generation/solver";
import {
  listTakuzuPoolEntries,
  toTakuzuPooledProblem,
} from "@/games/takuzu/problem/problem-pool";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import { isTakuzuSolved } from "@/games/takuzu/puzzle/rules";

describe("countTakuzuSolutions", () => {
  describe("一意解の問題", () => {
    const { problem } = toTakuzuPooledProblem(listTakuzuPoolEntries("3")[0]!);

    test("解を1つと数え、その解を返すこと", () => {
      const result = countTakuzuSolutions(problem.givens);

      expect(result.solutionCount).toBe(1);
      expect(result.firstSolution).toEqual(problem.solution);
    });
  });

  describe("解が2つ以上ある初期配置", () => {
    const givens = parseTakuzuBoard(["A...", "....", "....", "...."]);

    test("2以上として数えること", () => {
      const result = countTakuzuSolutions(givens);

      expect(result.solutionCount).toBe(2);
    });
  });

  describe("解が無い初期配置", () => {
    const cases = [
      [
        "3連続を含む初期配置",
        parseTakuzuBoard(["AAA.", "....", "....", "...."]),
      ],
      [
        "完成済みの行と同じ並びにしかならない行がある初期配置",
        parseTakuzuBoard(["ABBA", "AB.A", "....", "...."]),
      ],
    ] as const;

    test.each(cases)("%s を0と数えること", (_, givens) => {
      const result = countTakuzuSolutions(givens);

      expect(result).toEqual({ solutionCount: 0, firstSolution: null });
    });
  });

  describe("列の重複だけで解が絞られる初期配置", () => {
    const givens = parseTakuzuBoard(["AB..", "BA..", "....", "...."]);

    test("列どうしが同じ並びになる盤面を解として数えないこと", () => {
      const result = countTakuzuSolutions(givens);

      expect(
        result.firstSolution !== null && isTakuzuSolved(result.firstSolution),
      ).toBe(true);
    });
  });
});

describe("findRandomTakuzuSolution", () => {
  const emptyBoard = parseTakuzuBoard(Array(6).fill("......"));

  test("ルールをすべて満たす完成盤を返すこと", () => {
    const result = findRandomTakuzuSolution(
      emptyBoard,
      createProblemSeededRandom("solver-test"),
    );

    expect(result !== null && isTakuzuSolved(result)).toBe(true);
  });

  test("同じ乱数列から同じ完成盤を返すこと", () => {
    const first = findRandomTakuzuSolution(
      emptyBoard,
      createProblemSeededRandom("solver-test"),
    );
    const second = findRandomTakuzuSolution(
      emptyBoard,
      createProblemSeededRandom("solver-test"),
    );

    expect(second).toEqual(first);
  });
});
