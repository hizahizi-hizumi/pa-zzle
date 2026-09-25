import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import {
  assertTakuzuProblem,
  createTakuzuProblemIdentity,
  type TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";

function countGivens(identity: TakuzuProblemIdentity): number {
  return generateTakuzuProblem(identity).problem.givens.cells.filter(
    (cell) => cell !== null,
  ).length;
}

describe("generateTakuzuProblem", () => {
  const identity = createTakuzuProblemIdentity("single-remaining", 0, 0);

  test("一意解で、人間向け解法器で解き切れる 8×8 の問題を作ること", () => {
    const result = generateTakuzuProblem(identity);

    expect(() => assertTakuzuProblem(result.problem)).not.toThrow();
    expect(result.problem.givens.size).toBe(8);
    expect(result.difficultyAnalysis.status).toBe("analyzed");
  });

  test("同じ identity から同じ問題を作り、identity をそのまま返すこと", () => {
    const first = generateTakuzuProblem(identity);
    const second = generateTakuzuProblem(structuredClone(identity));

    expect(second.problem).toEqual(first.problem);
    expect(second.identity).toEqual(identity);
  });

  test("seed が違えば別の問題を作ること", () => {
    const first = generateTakuzuProblem(identity);
    const other = generateTakuzuProblem(
      createTakuzuProblemIdentity("single-remaining", 0, 1),
    );

    expect(other.problem).not.toEqual(first.problem);
  });

  test("対応していない生成器の版を拒否すること", () => {
    const act = () =>
      generateTakuzuProblem({
        ...identity,
        generatorVersion: "0" as TakuzuProblemIdentity["generatorVersion"],
      });

    expect(act).toThrow();
  });

  describe("解から戻すマスの数", () => {
    const extraGivenCount = 5;

    test("戻した数だけ初期配置が増えること", () => {
      const withoutExtra = countGivens(identity);
      const withExtra = countGivens({
        ...identity,
        conditions: { ...identity.conditions, extraGivenCount },
      });

      expect(withExtra - withoutExtra).toBe(extraGivenCount);
    });
  });

  describe("手筋の上限を隣接・挟みにした条件", () => {
    const adjacencyOnly = createTakuzuProblemIdentity("adjacency", 0, 0);

    test("隣接・挟みだけで解ける問題を作ること", () => {
      const result = generateTakuzuProblem(adjacencyOnly);

      expect(result.difficultyAnalysis).toMatchObject({
        status: "analyzed",
        features: { deepestTechnique: "adjacency" },
      });
    });
  });
});
