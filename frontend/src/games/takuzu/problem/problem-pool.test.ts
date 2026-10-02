import { createProblemId } from "@/games/problem-id";
import { takuzuDifficulties } from "@/games/takuzu/difficulty";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  decodeTakuzuPoolProblem,
  encodeTakuzuPoolProblem,
  findTakuzuPoolEntryByProblemId,
  getTakuzuRemovalTechniqueLimitCode,
  listTakuzuPoolEntries,
  toTakuzuPooledProblem,
  toTakuzuPoolIdentity,
} from "@/games/takuzu/problem/problem-pool";

describe("encodeTakuzuPoolProblem", () => {
  const { problem } = generateTakuzuProblem(
    createTakuzuProblemIdentity("count-completion", 2, 0),
  );

  test("解と初期配置を32桁の16進で表すこと", () => {
    const encoded = encodeTakuzuPoolProblem(problem);

    expect(encoded).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("decodeTakuzuPoolProblem", () => {
  describe("encodeTakuzuPoolProblem で表した問題", () => {
    const { problem } = generateTakuzuProblem(
      createTakuzuProblemIdentity("count-completion", 2, 0),
    );
    const encoded = encodeTakuzuPoolProblem(problem);

    test("元の問題へ戻すこと", () => {
      const decoded = decodeTakuzuPoolProblem(encoded);

      expect(decoded).toEqual(problem);
    });
  });

  describe("桁数の違う表記", () => {
    const encoded = "0".repeat(31);

    test("拒否すること", () => {
      const act = () => decodeTakuzuPoolProblem(encoded);

      expect(act).toThrow();
    });
  });
});

describe("toTakuzuPoolIdentity", () => {
  test("手筋の上限の1文字表記・戻す数・候補番号から identity を作ること", () => {
    const identity = toTakuzuPoolIdentity(["D", 2, 160, "0".repeat(32), 18, 2]);

    expect(identity).toEqual(
      createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
    );
    expect(identity.seed).toBe("tk-duplicate-avoidance-2-160");
  });
});

describe("getTakuzuRemovalTechniqueLimitCode", () => {
  const cases = [
    ["adjacency", "A"],
    ["count-completion", "B"],
    ["single-remaining", "C"],
    ["duplicate-avoidance", "D"],
    ["general-line", "E"],
  ] as const;

  test.each(cases)("%s を %s と表すこと", (technique, expected) => {
    const code = getTakuzuRemovalTechniqueLimitCode(technique);

    expect(code).toBe(expected);
  });
});

describe("toTakuzuPooledProblem", () => {
  test("問題集の作業の量と、初期配置から数えた空きマスの数を伴うこと", () => {
    const { problem } = generateTakuzuProblem(
      createTakuzuProblemIdentity("count-completion", 2, 0),
    );
    const emptyCellCount = problem.givens.cells.filter(
      (cell) => cell === null,
    ).length;

    const pooled = toTakuzuPooledProblem([
      "B",
      2,
      0,
      encodeTakuzuPoolProblem(problem),
      12,
      0,
    ]);

    expect(pooled.problem).toEqual(problem);
    expect(pooled.workload).toEqual({
      emptyCellCount,
      roundCount: 12,
      lineReadingRoundCount: 0,
    });
  });
});

describe("findTakuzuPoolEntryByProblemId", () => {
  const poolEntries = takuzuDifficulties.flatMap(({ id: difficulty }) =>
    listTakuzuPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toTakuzuPoolIdentity(entry)),
    })),
  );
  const firstLevel2Entry = poolEntries.find(
    ({ difficulty }) => difficulty === "2",
  );
  const unknownProblemId = "0000000000";

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findTakuzuPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findTakuzuPoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findTakuzuPoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});
