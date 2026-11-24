import { countFukumenzanSolutions } from "@/games/fukumenzan/problem/generation/exact-solver";
import { generateFukumenzanProblem } from "@/games/fukumenzan/problem/generator";
import { assertFukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import { createProblemSeededRandom } from "@/games/problem-seed";

describe("generateFukumenzanProblem", () => {
  describe.each([
    { addendLengths: [3, 3], letterCount: 5 },
    { addendLengths: [4, 4, 3], letterCount: 7 },
    { addendLengths: [5, 5, 5], letterCount: 9 },
  ])("足す数の桁 $addendLengths・文字 $letterCount の場合", (conditions) => {
    const generated = generateFukumenzanProblem(
      conditions,
      createProblemSeededRandom("generator-test"),
    )!;

    test("同じ乱数からは同じ問題を作ること", () => {
      const again = generateFukumenzanProblem(
        conditions,
        createProblemSeededRandom("generator-test"),
      );

      expect(again).toEqual(generated);
    });

    test("条件どおりの桁と文字の数で、盤面に描ける一意解の問題を作ること", () => {
      const { problem, solution } = generated;
      const { count, firstSolution } = countFukumenzanSolutions(problem, 2);
      const assertShape = () => assertFukumenzanProblem(problem);

      expect(assertShape).not.toThrow();
      expect({
        addendLengths: problem.addends.map((addend) => addend.length),
        letterCount: listFukumenzanLetters(problem).length,
        count,
        solution: firstSolution,
      }).toEqual({
        addendLengths: conditions.addendLengths,
        letterCount: conditions.letterCount,
        count: 1,
        solution,
      });
    });
  });
});
