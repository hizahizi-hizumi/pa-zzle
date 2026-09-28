import { doAllReflectionPiecesInfluenceClues } from "@/games/reflection/problem/generation/piece-influence";
import { countReflectionSolutions } from "@/games/reflection/problem/generation/solver";
import { getReflectionSymmetryKey } from "@/games/reflection/problem/generation/symmetry";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  assertReflectionProblem,
  createReflectionProblemIdentity,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  getReflectionInventoryPieceCount,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";

describe("generateReflectionProblem", () => {
  const identity = createReflectionProblemIdentity(7, 10, 0);

  test("条件どおりの大きさとピース数の、成立した問題を作ること", () => {
    const result = generateReflectionProblem(identity);

    expect(() => assertReflectionProblem(result.problem)).not.toThrow();
    expect(result.problem.size).toBe(7);
    expect(getReflectionInventoryPieceCount(result.problem.inventory)).toBe(10);
  });

  test("一意解で、全ピースが外周ヒントに影響する問題を作ること", () => {
    const { problem } = generateReflectionProblem(identity);

    const solutionSearch = countReflectionSolutions(problem);
    const influences = doAllReflectionPiecesInfluenceClues(problem.solution);

    expect(solutionSearch.status).toBe("complete");
    expect(solutionSearch.solutionCount).toBe(1);
    expect(influences).toBe(true);
  });

  test("解の同型判定キーを返すこと", () => {
    const result = generateReflectionProblem(identity);

    expect(result.symmetryKey).toBe(
      getReflectionSymmetryKey(result.problem.solution),
    );
  });

  test("同じ identity から同じ問題を作り、identity をそのまま返すこと", () => {
    const first = generateReflectionProblem(identity);
    const second = generateReflectionProblem(structuredClone(identity));

    expect(second.problem).toEqual(first.problem);
    expect(second.identity).toEqual(identity);
  });

  test("seed が違えば別の問題を作ること", () => {
    const first = generateReflectionProblem(identity);
    const other = generateReflectionProblem(
      createReflectionProblemIdentity(7, 10, 1),
    );

    expect(other.problem).not.toEqual(first.problem);
  });

  test("ピースが少ない問題でも、手持ちの種類を特定の組み合わせに固定しないこと", () => {
    const usedPieces = new Set(
      Array.from({ length: 20 }, (_, index) =>
        generateReflectionProblem(createReflectionProblemIdentity(5, 2, index)),
      ).flatMap(({ problem }) =>
        reflectionPieces.filter((piece) => problem.inventory[piece] > 0),
      ),
    );

    expect(usedPieces.size).toBe(reflectionPieces.length);
  });

  const invalidIdentities: readonly [string, ReflectionProblemIdentity][] = [
    [
      "対応していない生成器の版",
      {
        ...identity,
        generatorVersion: "0" as ReflectionProblemIdentity["generatorVersion"],
      },
    ],
    [
      "対応していない盤面の大きさ",
      {
        ...identity,
        conditions: {
          size: 8 as ReflectionProblemIdentity["conditions"]["size"],
          pieceCount: 10,
        },
      },
    ],
    ["ピース数が0", { ...identity, conditions: { size: 7, pieceCount: 0 } }],
  ];

  test.each(invalidIdentities)("%s を拒否すること", (_, invalidIdentity) => {
    const act = () => generateReflectionProblem(invalidIdentity);

    expect(act).toThrow();
  });
});
