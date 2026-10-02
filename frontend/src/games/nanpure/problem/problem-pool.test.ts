import { nanpureDifficulties } from "@/games/nanpure/difficulty";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import {
  decodeNanpurePoolProblem,
  encodeNanpurePoolProblem,
  findNanpurePoolEntryByProblemId,
  listNanpurePoolEntries,
  toNanpurePooledProblem,
  toNanpurePoolIdentity,
} from "@/games/nanpure/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

const { problem } = generateNanpureProblem(
  createNanpureProblemIdentity("naked-single", 0),
);

describe("encodeNanpurePoolProblem", () => {
  test("解の81桁とヒントの位置の16進21桁で表すこと", () => {
    const encoded = encodeNanpurePoolProblem(problem);

    expect(encoded).toMatch(/^[1-9]{81}[0-9a-f]{21}$/);
    expect(encoded.slice(0, 81)).toBe(problem.solution.join(""));
  });
});

describe("decodeNanpurePoolProblem", () => {
  describe("encodeNanpurePoolProblem で表した問題", () => {
    const encoded = encodeNanpurePoolProblem(problem);

    test("元の問題へ戻すこと", () => {
      const decoded = decodeNanpurePoolProblem(encoded);

      expect(decoded).toEqual(problem);
    });
  });

  const invalidCases = [
    ["桁数が違う", "1".repeat(101)],
    ["解に 0 を含む", `0${"1".repeat(80)}${"0".repeat(21)}`],
    ["解が完成盤でない", `${"1".repeat(81)}${"0".repeat(21)}`],
  ] as const;

  test.each(invalidCases)("%s 表記を拒否すること", (_, encoded) => {
    const act = () => decodeNanpurePoolProblem(encoded);

    expect(act).toThrow();
  });
});

describe("toNanpurePoolIdentity", () => {
  test("手筋の上限と候補番号から identity を作ること", () => {
    const identity = toNanpurePoolIdentity(["xyz-wing", 160, ""]);

    expect(identity).toEqual(createNanpureProblemIdentity("xyz-wing", 160));
  });

  test("一意解だけを保つ条件の identity を作ること", () => {
    const identity = toNanpurePoolIdentity([null, 3, ""]);

    expect(identity.seed).toBe("np-uniqueness-3");
  });
});

describe("toNanpurePooledProblem", () => {
  const encoded = encodeNanpurePoolProblem(problem);

  test("問題と identity を復元すること", () => {
    const pooled = toNanpurePooledProblem(["naked-single", 0, encoded]);

    expect(pooled).toEqual({
      problem,
      identity: createNanpureProblemIdentity("naked-single", 0),
    });
  });
});

describe("findNanpurePoolEntryByProblemId", () => {
  const poolEntries = nanpureDifficulties.flatMap(({ id: difficulty }) =>
    listNanpurePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toNanpurePoolIdentity(entry)),
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
        findNanpurePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findNanpurePoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findNanpurePoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});
