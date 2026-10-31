import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import {
  decodeReflectionPoolSolution,
  encodeReflectionPoolSolution,
  findReflectionPooledProblem,
  findReflectionPooledProblemByProblemId,
  formatReflectionPoolProblemId,
  listReflectionPoolEntries,
  restoreReflectionPoolEntry,
  toReflectionPooledProblem,
  toReflectionPoolIdentity,
} from "@/games/reflection/problem/problem-pool";
import { parseReflectionBoard } from "@/games/reflection/puzzle/board";

describe("encodeReflectionPoolSolution", () => {
  const solution = parseReflectionBoard([
    "/....",
    ".\\...",
    "..|..",
    "...=.",
    "o...@",
  ]);

  test("解の各マスを行優先の番号1桁で表すこと", () => {
    const encoded = encodeReflectionPoolSolution(solution);

    expect(encoded).toBe("1000002000003000004050006");
  });
});

describe("decodeReflectionPoolSolution", () => {
  describe("encodeReflectionPoolSolution で表した解", () => {
    const { solution } = generateReflectionProblem(
      createReflectionProblemIdentity(7, 10, 0),
    ).problem;
    const encoded = encodeReflectionPoolSolution(solution);

    test("元の解へ戻すこと", () => {
      const decoded = decodeReflectionPoolSolution(encoded);

      expect(decoded).toEqual(solution);
    });
  });

  const invalidCases = [
    ["扱わない盤面サイズの桁数", "0".repeat(16)],
    ["正方形にならない桁数", "0".repeat(26)],
    ["番号でない文字", `${"0".repeat(24)}7`],
  ] as const;

  test.each(invalidCases)("%s を拒否すること", (_, encoded) => {
    const act = () => decodeReflectionPoolSolution(encoded);

    expect(act).toThrow();
  });
});

describe("toReflectionPoolIdentity", () => {
  test("解から求めた盤面サイズ・ピース数と候補番号から identity を作ること", () => {
    const identity = toReflectionPoolIdentity([
      12,
      "1000002000003000004050006",
      0,
      0,
      null,
    ]);

    expect(identity).toEqual(createReflectionProblemIdentity(5, 6, 12));
    expect(identity.seed).toBe("rf-5-6-12");
  });
});

describe("restoreReflectionPoolEntry", () => {
  const generated = generateReflectionProblem(
    createReflectionProblemIdentity(6, 8, 3),
  );
  const reference = { poolVersion: "2", problemId: "4-9" };

  test("解から手持ちと外周ヒントを求めた問題と、問題集の作業の量を伴うこと", () => {
    const pooled = restoreReflectionPoolEntry(
      [3, encodeReflectionPoolSolution(generated.problem.solution), 7, 0, 11],
      reference,
    );

    expect(pooled).toEqual({
      problem: generated.problem,
      identity: generated.identity,
      poolReference: reference,
      workload: {
        pieceCount: 8,
        clueCount: 24,
        propagationRoundCount: 7,
        assumptionTestCount: 0,
        trialMoveCount: 11,
      },
    });
  });
});

describe("findReflectionPooledProblem", () => {
  const pooled = toReflectionPooledProblem("3", 4);

  test("問題集の identity から同じ問題を引くこと", () => {
    const found = findReflectionPooledProblem(structuredClone(pooled.identity));

    expect(found).toEqual(pooled);
  });

  test("盤面サイズの違う identity には null を返すこと", () => {
    const found = findReflectionPooledProblem({
      ...pooled.identity,
      conditions: { ...pooled.identity.conditions, size: 7 },
    });

    expect(found).toBeNull();
  });
});

describe("findReflectionPooledProblemByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listReflectionPoolEntries(difficulty).map((entry, entryIndex) => ({
      difficulty,
      poolProblemId: formatReflectionPoolProblemId(difficulty, entryIndex),
      problemId: createProblemId(toReflectionPoolIdentity(entry)),
    })),
  );

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, poolProblemId, problemId }) =>
        findReflectionPooledProblemByProblemId(difficulty, problemId)
          ?.poolReference.problemId !== poolProblemId,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});
