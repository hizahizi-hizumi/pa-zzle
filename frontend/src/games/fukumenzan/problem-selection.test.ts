import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import { listFukumenzanPoolProblemIds } from "@/games/fukumenzan/problem/problem-pool";
import {
  canSelectFukumenzanProblemById,
  restoreFukumenzanProblem,
  selectFukumenzanProblemById,
  selectFukumenzanProblemForDifficulty,
} from "@/games/fukumenzan/problem-selection";
import { createProblemId } from "@/games/problem-id";

describe("selectFukumenzanProblemForDifficulty", () => {
  test("同じ seed からは同じ問題を選ぶこと", () => {
    const problems = [0, 1].map(() =>
      selectFukumenzanProblemForDifficulty("3", "same-seed"),
    );

    expect(problems[0]).toEqual(problems[1]);
  });

  test.each(["1", "5"] as const)(
    "レベル %s の問題集にある問題を選ぶこと",
    (difficulty) => {
      const { identity } = selectFukumenzanProblemForDifficulty(
        difficulty,
        "seed",
      );

      expect(listFukumenzanPoolProblemIds(difficulty)).toContain(
        createProblemId(identity),
      );
    },
  );
});

describe("selectFukumenzanProblemById", () => {
  const selected = selectFukumenzanProblemForDifficulty("2", "seed");
  const problemId = createProblemId(selected.identity);

  test("選んだ問題をその問題 ID で引けること", () => {
    const found = selectFukumenzanProblemById("2", problemId);

    expect(found).toEqual(selected);
  });

  test.each([
    ["別の難易度の問題集の ID", "4", problemId],
    ["問題集に無い ID", "2", "unknown"],
  ] as const)("%sには null を返すこと", (_, difficulty, id) => {
    const found = selectFukumenzanProblemById(difficulty, id);
    const canSelect = canSelectFukumenzanProblemById(difficulty, id);

    expect({ found, canSelect }).toEqual({ found: null, canSelect: false });
  });
});

describe("restoreFukumenzanProblem", () => {
  const selected = selectFukumenzanProblemForDifficulty("4", "seed");

  test("identity から問題集の問題を作り直すこと", () => {
    const restored = restoreFukumenzanProblem(selected.identity);

    expect(restored).toEqual(selected);
  });

  test.each([
    [
      "問題集に無い式",
      createFukumenzanProblemIdentity({ addends: ["AB", "CD"], result: "EF" }),
    ],
    [
      "生成器の版が違う",
      { generatorVersion: "0", seed: "old", conditions: {} },
    ],
  ])("%sの identity には null を返すこと", (_, identity) => {
    const restored = restoreFukumenzanProblem(identity);

    expect(restored).toBeNull();
  });
});
