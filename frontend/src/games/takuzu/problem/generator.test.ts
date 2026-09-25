import {
  generateTakuzuProblem,
  type TakuzuGenerationConditions,
} from "@/games/takuzu/problem/generator";
import { assertTakuzuProblem } from "@/games/takuzu/problem/problem";

function countGivens(conditions: TakuzuGenerationConditions): number {
  return generateTakuzuProblem(conditions).problem.givens.cells.filter(
    (cell) => cell !== null,
  ).length;
}

describe("generateTakuzuProblem", () => {
  const conditions: TakuzuGenerationConditions = {
    seed: "generator-test",
    removalTechniqueLimit: "single-remaining",
    extraGivenCount: 0,
  };

  test("一意解で、人間向け解法器で解き切れる 8×8 の問題を作ること", () => {
    const result = generateTakuzuProblem(conditions);

    expect(() => assertTakuzuProblem(result.problem)).not.toThrow();
    expect(result.problem.givens.size).toBe(8);
    expect(result.difficultyAnalysis.status).toBe("analyzed");
  });

  test("同じ条件から同じ問題を作ること", () => {
    const first = generateTakuzuProblem(conditions);
    const second = generateTakuzuProblem(conditions);

    expect(second.problem).toEqual(first.problem);
  });

  describe("解から戻すマスの数", () => {
    const extraGivenCount = 5;

    test("戻した数だけ初期配置が増えること", () => {
      const withoutExtra = countGivens(conditions);
      const withExtra = countGivens({ ...conditions, extraGivenCount });

      expect(withExtra - withoutExtra).toBe(extraGivenCount);
    });
  });

  describe("手筋の上限を隣接・挟みにした条件", () => {
    const adjacencyOnly: TakuzuGenerationConditions = {
      ...conditions,
      removalTechniqueLimit: "adjacency",
    };

    test("隣接・挟みだけで解ける問題を作ること", () => {
      const result = generateTakuzuProblem(adjacencyOnly);

      expect(result.difficultyAnalysis).toMatchObject({
        status: "analyzed",
        features: { deepestTechnique: "adjacency" },
      });
    });
  });
});
