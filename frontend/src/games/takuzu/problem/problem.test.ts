import {
  assertTakuzuProblem,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

const solution = parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BABA"]);

describe("assertTakuzuProblem", () => {
  const cases: readonly [string, TakuzuProblem][] = [
    [
      "初期配置が解と食い違う問題",
      {
        givens: parseTakuzuBoard(["B...", "....", "....", "...."]),
        solution,
      },
    ],
    [
      "解がルールを満たさない問題",
      {
        givens: parseTakuzuBoard(["A...", "....", "....", "...."]),
        solution: parseTakuzuBoard(["ABAB", "BABA", "ABAB", "BABA"]),
      },
    ],
    [
      "初期配置と解の大きさが違う問題",
      {
        givens: parseTakuzuBoard(["A.", ".."]),
        solution,
      },
    ],
  ];

  test.each(cases)("%s を拒否すること", (_, problem) => {
    const act = () => assertTakuzuProblem(problem);

    expect(act).toThrow();
  });
});
