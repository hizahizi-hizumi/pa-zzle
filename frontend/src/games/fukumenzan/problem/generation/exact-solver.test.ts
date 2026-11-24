import { countFukumenzanSolutions } from "@/games/fukumenzan/problem/generation/exact-solver";
import researchCases from "@/games/fukumenzan/problem/generation/research-difficulty-cases.json";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

describe("countFukumenzanSolutions", () => {
  describe.each(
    researchCases.classification.flatMap(({ equation, solution }) =>
      solution === undefined ? [] : [[equation, solution] as const],
    ),
  )("研究用の期待値の %s の場合", (equation, solution) => {
    const problem = parseFukumenzanEquation(equation)!;

    test("解が1つで、研究用のコードと同じ解を返すこと", () => {
      const { count, firstSolution } = countFukumenzanSolutions(problem, 3);

      expect({ count, solution: firstSolution?.join("") }).toEqual({
        count: 1,
        solution,
      });
    });
  });

  describe("解が2つ以上ある式の場合", () => {
    // 12＋21＝33 と 21＋12＝33 のように、A と B を入れ替えても成り立つ。
    const problem = { addends: ["AB", "BA"], result: "CC" };

    test("上限の数まで数えて止まること", () => {
      const { count } = countFukumenzanSolutions(problem, 2);

      expect(count).toBe(2);
    });
  });

  describe("解の無い式の場合", () => {
    // A は先頭なので1以上で、A＋A は2桁の AB（10×A＋B）に届かない。
    const problem = { addends: ["A", "A"], result: "AB" };

    test("0を返し、解を返さないこと", () => {
      const solutions = countFukumenzanSolutions(problem, 2);

      expect(solutions).toEqual({ count: 0, firstSolution: null });
    });
  });
});
