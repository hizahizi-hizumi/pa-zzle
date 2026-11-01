import { difficultyLevels } from "@/games/difficulty";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import {
  decodeNanpurePoolProblem,
  encodeNanpurePoolProblem,
  findNanpurePoolEntryByProblemId,
  findNanpurePoolProblemFeatures,
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
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listNanpurePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toNanpurePoolIdentity(entry)),
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
      ({ difficulty, entry, problemId }) =>
        findNanpurePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});

describe("findNanpurePoolProblemFeatures", () => {
  const [entry] = listNanpurePoolEntries("3");
  if (!entry) {
    throw new Error("No level 3 nanpure pool entry");
  }
  const problemId = createProblemId(toNanpurePoolIdentity(entry));
  const { clues } = toNanpurePooledProblem(entry).problem;

  test("問題集の1問の特徴を、復元した問題の初期数字の数で返すこと", () => {
    const features = findNanpurePoolProblemFeatures("3", problemId);

    expect(features).toEqual({
      clueCount: clues.filter((cell) => cell !== null).length,
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findNanpurePoolProblemFeatures("3", "unknown");
    const otherDifficulty = findNanpurePoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
